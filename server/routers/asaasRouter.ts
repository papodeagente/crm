import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { tenantProcedure, tenantWriteProcedure, getTenantId, router } from "../_core/trpc";
import * as crm from "../crmDb";
import { emitEvent } from "../middleware/eventLog";
import { encryptSecret, decryptSecret, maskApiKey } from "../services/asaasEncryption";
import { createAsaasClient, AsaasError, type AsaasBillingType } from "../services/asaasService";

const billingTypeEnum = z.enum(["BOLETO", "CREDIT_CARD", "PIX", "UNDEFINED"]);

async function loadClient(tenantId: number) {
  const cred = await crm.getAsaasCredential(tenantId);
  if (!cred) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "ASAAS não está conectado. Conecte sua conta em Integrações.",
    });
  }
  let payload: { apiKey: string; sandbox?: boolean };
  try {
    payload = JSON.parse(decryptSecret(cred.encryptedSecret));
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao ler credencial ASAAS." });
  }
  return { client: createAsaasClient(payload), credential: cred, sandbox: !!payload.sandbox };
}

export const asaasRouter = router({
  // ─── Connection management ────────────────────────────────
  getStatus: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = getTenantId(ctx);
    const cred = await crm.getAsaasCredential(tenantId);
    if (!cred) return { connected: false as const };
    let masked: string | null = null;
    let sandbox = false;
    try {
      const payload = JSON.parse(decryptSecret(cred.encryptedSecret));
      masked = maskApiKey(payload.apiKey || "");
      sandbox = !!payload.sandbox;
    } catch { /* ignore */ }
    return {
      connected: true as const,
      sandbox,
      maskedApiKey: masked,
      connectedAt: cred.createdAt,
    };
  }),

  connect: tenantWriteProcedure
    .input(z.object({ apiKey: z.string().min(20), sandbox: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      const apiKey = input.apiKey.trim();
      // Validate by calling /myAccount
      const client = createAsaasClient({ apiKey, sandbox: input.sandbox });
      let account;
      try {
        account = await client.getCurrentAccount();
      } catch (err: any) {
        const msg = err instanceof AsaasError
          ? `ASAAS rejeitou a chave: ${err.message}`
          : `Falha ao validar chave: ${err.message}`;
        throw new TRPCError({ code: "BAD_REQUEST", message: msg });
      }
      const encrypted = encryptSecret(JSON.stringify({ apiKey, sandbox: input.sandbox }));
      await crm.upsertAsaasCredential({ tenantId, encryptedSecret: encrypted });
      await emitEvent({
        tenantId,
        actorUserId: ctx.user.id,
        entityType: "integration",
        entityId: 0,
        action: "asaas_connect",
      });
      return { success: true, account };
    }),

  disconnect: tenantWriteProcedure.mutation(async ({ ctx }) => {
    const tenantId = getTenantId(ctx);
    await crm.disconnectAsaasCredential(tenantId);
    await emitEvent({
      tenantId,
      actorUserId: ctx.user.id,
      entityType: "integration",
      entityId: 0,
      action: "asaas_disconnect",
    });
    return { success: true };
  }),

  testConnection: tenantProcedure.query(async ({ ctx }) => {
    const { client, sandbox } = await loadClient(getTenantId(ctx));
    try {
      const account = await client.getCurrentAccount();
      return { ok: true as const, sandbox, account };
    } catch (err: any) {
      throw new TRPCError({
        code: "FAILED_PRECONDITION",
        message: err instanceof AsaasError ? err.message : `Falha ASAAS: ${err.message}`,
      });
    }
  }),

  // ─── Charge generation ────────────────────────────────────
  generateChargeForProposal: tenantWriteProcedure
    .input(z.object({
      proposalId: z.number(),
      billingType: billingTypeEnum.default("UNDEFINED"),
      dueDateISO: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      const proposal = await crm.getProposalById(tenantId, input.proposalId);
      if (!proposal) throw new TRPCError({ code: "NOT_FOUND", message: "Proposta não encontrada." });
      if (!proposal.totalCents || proposal.totalCents <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Proposta sem valor — defina um total antes de gerar a cobrança." });
      }
      if (proposal.asaasPaymentId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta proposta já possui uma cobrança ASAAS gerada.",
        });
      }

      const deal = await crm.getDealById(tenantId, proposal.dealId);
      if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Negócio vinculado não encontrado." });
      if (!deal.contactId) throw new TRPCError({ code: "BAD_REQUEST", message: "Negócio sem contato vinculado." });

      const contact = await crm.getContactById(tenantId, deal.contactId);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contato do negócio não encontrado." });
      if (!contact.name) throw new TRPCError({ code: "BAD_REQUEST", message: "Contato sem nome — preencha antes de gerar cobrança." });

      const { client } = await loadClient(tenantId);

      // Resolve customer: reuse cached id, search by docId/email, or create.
      let customerId = contact.asaasCustomerId;
      if (!customerId) {
        if (contact.docId) {
          try {
            const found = await client.findCustomerByCpfCnpj(contact.docId);
            if (found.data?.[0]) customerId = found.data[0].id;
          } catch { /* fall through to create */ }
        }
        if (!customerId && contact.email) {
          try {
            const found = await client.findCustomerByEmail(contact.email);
            if (found.data?.[0]) customerId = found.data[0].id;
          } catch { /* fall through to create */ }
        }
        if (!customerId) {
          try {
            const created = await client.createCustomer({
              name: contact.name,
              cpfCnpj: contact.docId || undefined,
              email: contact.email || undefined,
              mobilePhone: contact.phoneE164 || contact.phone || undefined,
              externalReference: `contact:${contact.id}`,
            });
            customerId = created.id;
          } catch (err: any) {
            const msg = err instanceof AsaasError ? err.message : err.message;
            throw new TRPCError({ code: "BAD_REQUEST", message: `Falha ao criar cliente no ASAAS: ${msg}` });
          }
        }
        if (customerId) {
          await crm.setContactAsaasCustomerId(tenantId, contact.id, customerId);
        }
      }

      if (!customerId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível resolver o cliente ASAAS." });
      }

      const dueDate = input.dueDateISO
        ? new Date(input.dueDateISO)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const dueDateStr = dueDate.toISOString().slice(0, 10);
      const value = Number((proposal.totalCents / 100).toFixed(2));

      let payment;
      try {
        payment = await client.createPayment({
          customer: customerId,
          billingType: input.billingType,
          value,
          dueDate: dueDateStr,
          description: input.description || `Proposta #${proposal.id}`,
          externalReference: `proposal:${proposal.id}`,
        });
      } catch (err: any) {
        const msg = err instanceof AsaasError ? err.message : err.message;
        throw new TRPCError({ code: "BAD_REQUEST", message: `Falha ao criar cobrança ASAAS: ${msg}` });
      }

      await crm.setProposalAsaasPayment(tenantId, proposal.id, {
        asaasPaymentId: payment.id,
        asaasInvoiceUrl: payment.invoiceUrl ?? null,
        asaasBankSlipUrl: payment.bankSlipUrl ?? null,
        asaasBillingType: payment.billingType,
        asaasPaymentStatus: payment.status,
        asaasDueDate: payment.dueDate ? new Date(payment.dueDate) : null,
      });

      // Mark proposal as sent if still draft
      if (proposal.status === "draft") {
        await crm.updateProposal(tenantId, proposal.id, { status: "sent", sentAt: new Date() });
      }

      await emitEvent({
        tenantId,
        actorUserId: ctx.user.id,
        entityType: "proposal",
        entityId: proposal.id,
        action: "asaas_charge_created",
      });

      return {
        success: true as const,
        paymentId: payment.id,
        invoiceUrl: payment.invoiceUrl,
        bankSlipUrl: payment.bankSlipUrl,
        status: payment.status,
        billingType: payment.billingType,
        dueDate: payment.dueDate,
      };
    }),

  // ─── Sync charge status from ASAAS ────────────────────────
  syncProposalCharge: tenantWriteProcedure
    .input(z.object({ proposalId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      const proposal = await crm.getProposalById(tenantId, input.proposalId);
      if (!proposal?.asaasPaymentId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Proposta sem cobrança ASAAS." });
      }
      const { client } = await loadClient(tenantId);
      const payment = await client.getPayment(proposal.asaasPaymentId);
      const isPaid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(payment.status);
      await crm.setProposalAsaasPayment(tenantId, proposal.id, {
        asaasPaymentId: payment.id,
        asaasInvoiceUrl: payment.invoiceUrl ?? null,
        asaasBankSlipUrl: payment.bankSlipUrl ?? null,
        asaasBillingType: payment.billingType,
        asaasPaymentStatus: payment.status,
        asaasPaidAt: isPaid && payment.paymentDate ? new Date(payment.paymentDate) : null,
      });
      if (isPaid && proposal.status !== "accepted") {
        await crm.updateProposal(tenantId, proposal.id, { status: "accepted", acceptedAt: new Date() });
      }
      return { ok: true as const, status: payment.status };
    }),
});
