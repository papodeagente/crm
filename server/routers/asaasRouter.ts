import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { tenantProcedure, tenantWriteProcedure, getTenantId, router } from "../_core/trpc";
import * as crm from "../crmDb";
import { emitEvent } from "../middleware/eventLog";
import { encryptSecret, decryptSecret, maskApiKey } from "../services/asaasEncryption";
import { createAsaasClient, AsaasError, type AsaasBillingType } from "../services/asaasService";
import { resolveAsaasCustomerForContact } from "../services/asaasCustomerResolver";

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

      // Tenta autenticar no ambiente escolhido. Se falhar com 401/invalid_access_token,
      // tenta o OUTRO ambiente — Asaas distribui keys de sandbox e produção em hosts
      // diferentes; é comum o usuário errar o toggle.
      async function tryAuth(sandbox: boolean) {
        const client = createAsaasClient({ apiKey, sandbox });
        const account = await client.getCurrentAccount();
        return { account, sandbox };
      }

      let resolved: { account: any; sandbox: boolean };
      let firstError: AsaasError | Error | null = null;
      try {
        resolved = await tryAuth(input.sandbox);
      } catch (err: any) {
        firstError = err;
        // Se for erro de auth, vale tentar o outro ambiente
        const isAuthError = err instanceof AsaasError && (err.status === 401 || err.code === "invalid_access_token");
        if (isAuthError) {
          try {
            resolved = await tryAuth(!input.sandbox);
          } catch (err2: any) {
            // Os dois falharam — devolve mensagem clara do erro original
            const msg = firstError instanceof AsaasError
              ? `ASAAS rejeitou a chave: ${firstError.message}. Verifique se a chave está correta e se foi gerada para ${input.sandbox ? "sandbox" : "produção"}.`
              : `Falha ao validar chave: ${(firstError as Error).message}`;
            throw new TRPCError({ code: "BAD_REQUEST", message: msg });
          }
        } else {
          // Erro não-auth (rede, timeout, etc.) — não tenta outro ambiente
          const msg = err instanceof AsaasError
            ? `ASAAS rejeitou a chave: ${err.message}`
            : `Falha ao validar chave: ${err.message}`;
          throw new TRPCError({ code: "BAD_REQUEST", message: msg });
        }
      }

      const detectedSandbox = resolved.sandbox;
      const envFlipped = detectedSandbox !== input.sandbox;
      const encrypted = encryptSecret(JSON.stringify({ apiKey, sandbox: detectedSandbox }));
      await crm.upsertAsaasCredential({ tenantId, encryptedSecret: encrypted });
      await emitEvent({
        tenantId,
        actorUserId: ctx.user.id,
        entityType: "integration",
        entityId: 0,
        action: "asaas_connect",
      });
      return {
        success: true,
        account: resolved.account,
        sandbox: detectedSandbox,
        envFlipped,
      };
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
        code: "PRECONDITION_FAILED",
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
      const customerId = await resolveAsaasCustomerForContact(tenantId, contact, client);

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

  // ─── Charge from a Deal (após venda ganha) ────────────────
  generateChargeForDeal: tenantWriteProcedure
    .input(z.object({
      dealId: z.number().int(),
      billingType: billingTypeEnum.default("PIX"),
      dueDateISO: z.string().optional(),
      valueCents: z.number().int().positive().optional(),
      description: z.string().max(500).optional(),
      sendViaWhatsApp: z.boolean().default(false),
      whatsappMessage: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      const deal = await crm.getDealById(tenantId, input.dealId);
      if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Negócio não encontrado." });
      if (!deal.contactId) throw new TRPCError({ code: "BAD_REQUEST", message: "Negócio sem contato vinculado." });
      if (deal.asaasPaymentId) {
        throw new TRPCError({ code: "CONFLICT", message: "Este negócio já possui uma cobrança ASAAS." });
      }

      const valueCents = input.valueCents ?? Number(deal.valueCents ?? 0);
      if (!valueCents || valueCents <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Valor inválido — defina o valor do negócio antes de gerar cobrança." });
      }

      const contact = await crm.getContactById(tenantId, deal.contactId);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contato do negócio não encontrado." });
      if (!contact.email && !contact.docId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Contato precisa ter pelo menos e-mail OU CPF/CNPJ para gerar cobrança." });
      }

      const { client } = await loadClient(tenantId);
      const customerId = await resolveAsaasCustomerForContact(tenantId, contact, client);

      const dueDate = input.dueDateISO
        ? new Date(input.dueDateISO)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const dueDateStr = dueDate.toISOString().slice(0, 10);
      const value = Number((valueCents / 100).toFixed(2));

      let payment;
      try {
        payment = await client.createPayment({
          customer: customerId,
          billingType: input.billingType,
          value,
          dueDate: dueDateStr,
          description: input.description || deal.title,
          externalReference: `deal:${deal.id}`,
        });
      } catch (err: any) {
        const msg = err instanceof AsaasError ? err.message : err.message;
        throw new TRPCError({ code: "BAD_REQUEST", message: `Falha ao criar cobrança ASAAS: ${msg}` });
      }

      let whatsappSent = false;
      let whatsappError: string | null = null;
      let linkSentAt: Date | null = null;

      if (input.sendViaWhatsApp) {
        const targetUrl = payment.invoiceUrl || payment.bankSlipUrl || "";
        const firstName = (contact.name || "").split(/\s+/)[0] || "";
        const valueFmt = value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const dueFmt = dueDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
        const defaultMsg = `Olá, ${firstName}! Aqui está o link de pagamento referente a *${deal.title}* (${valueFmt}):\n\n${targetUrl}\n\nVencimento: ${dueFmt}. Qualquer dúvida, é só me chamar.`;
        const msg = input.whatsappMessage
          ? input.whatsappMessage
              .replace(/\{primeiroNome\}/g, firstName)
              .replace(/\{nome\}/g, contact.name || "")
              .replace(/\{dealTitle\}/g, deal.title)
              .replace(/\{invoiceUrl\}/g, targetUrl)
              .replace(/\{valor\}/g, valueFmt)
              .replace(/\{vencimento\}/g, dueFmt)
              .replace(/\{data\}/g, dueFmt)
          : defaultMsg;

        try {
          const { getSessionsByTenant, getDb } = await import("../db");
          const sessions = await getSessionsByTenant(tenantId);
          const activeSession = sessions.find((s: any) => s.status === "connected") || sessions[0];
          if (!activeSession) {
            whatsappError = "Nenhuma sessão WhatsApp ativa para este tenant.";
          } else {
            // JID: prefere a conversa existente (já lida com variantes do 9º dígito);
            // fallback para phoneE164 montando JID padrão.
            let jid: string | null = null;
            if (deal.waConversationId) {
              const db = await getDb();
              if (db) {
                const { sql } = await import("drizzle-orm");
                const r = await db.execute(sql`SELECT "remoteJid" FROM wa_conversations WHERE id = ${deal.waConversationId} LIMIT 1`);
                const row = ((r as any).rows ?? r)?.[0];
                jid = row?.remoteJid || null;
              }
            }
            if (!jid) {
              const digits = (contact.phoneE164 || contact.phone || "").replace(/\D/g, "");
              if (digits) jid = `${digits}@s.whatsapp.net`;
            }
            if (!jid) {
              whatsappError = "Contato sem telefone WhatsApp.";
            } else {
              const { whatsappManager } = await import("../whatsappEvolution");
              await whatsappManager.sendTextMessage(activeSession.sessionId, jid, msg);
              whatsappSent = true;
              linkSentAt = new Date();
            }
          }
        } catch (err: any) {
          whatsappError = err?.message || "Falha ao enviar WhatsApp";
        }
      }

      await crm.setDealAsaasPayment(tenantId, deal.id, {
        asaasPaymentId: payment.id,
        asaasInvoiceUrl: payment.invoiceUrl ?? null,
        asaasBankSlipUrl: payment.bankSlipUrl ?? null,
        asaasBillingType: payment.billingType,
        asaasPaymentStatus: payment.status,
        asaasDueDate: payment.dueDate ? new Date(payment.dueDate) : null,
        asaasLinkSentToWhatsappAt: linkSentAt,
      });

      await emitEvent({
        tenantId,
        actorUserId: ctx.user.id,
        entityType: "deal",
        entityId: deal.id,
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
        whatsappSent,
        whatsappError,
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
