import { z } from "zod";
import { tenantProcedure, tenantWriteProcedure, tenantAdminProcedure, publicProcedure, getTenantId, router } from "../_core/trpc";
import * as crm from "../crmDb";
import { emitEvent } from "../middleware/eventLog";

// ═══════════════════════════════════════
// M3 — PROPOSTAS
// ═══════════════════════════════════════
export const proposalRouter = router({
  templates: router({
    list: tenantProcedure
      
      .query(async ({ input, ctx }) => crm.listProposalTemplates(getTenantId(ctx))),
    create: tenantWriteProcedure
      .input(z.object({ name: z.string().min(1), htmlBody: z.string().optional(), variablesJson: z.any().optional() }))
      .mutation(async ({ input, ctx }) => crm.createProposalTemplate({ ...input, tenantId: getTenantId(ctx) })),
  }),
  list: tenantProcedure
    .input(z.object({ dealId: z.number().optional(), dealIds: z.array(z.number()).optional(), status: z.string().optional() }))
    .query(async ({ input, ctx }) => crm.listProposals(getTenantId(ctx), input)),
  get: tenantProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => crm.getProposalById(getTenantId(ctx), input.id)),
  create: tenantWriteProcedure
    .input(z.object({ dealId: z.number(), totalCents: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await crm.createProposal({ ...input, tenantId: getTenantId(ctx), createdBy: ctx.user.id });
      await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "proposal", entityId: result?.id, action: "create" });
      return result;
    }),
  update: tenantWriteProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["draft", "sent", "viewed", "accepted", "rejected", "expired"]).optional(),
      totalCents: z.number().optional(),
      discountCents: z.number().int().min(0).optional(),
      taxCents: z.number().int().min(0).optional(),
      pdfUrl: z.string().optional(),
      notes: z.string().nullable().optional(),
      validUntil: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      const { id, validUntil, ...rest } = input;
      const data: any = { ...rest };
      if (validUntil !== undefined) data.validUntil = validUntil ? new Date(validUntil) : null;
      await crm.updateProposal(tenantId, id, data);
      // Recalc total se discount/tax mudaram
      if (input.discountCents !== undefined || input.taxCents !== undefined) {
        await crm.recalcProposalTotal(tenantId, id);
      }
      await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "proposal", entityId: id, action: "update" });
      return { success: true };
    }),

  items: router({
    list: tenantProcedure
      .input(z.object({ proposalId: z.number() }))
      .query(async ({ input, ctx }) => crm.listProposalItems(getTenantId(ctx), input.proposalId)),
    create: tenantWriteProcedure
      .input(z.object({
        proposalId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        qty: z.number().int().min(1).default(1),
        unit: z.string().max(16).optional(),
        unitPriceCents: z.number().int().min(0).default(0),
        discountCents: z.number().int().min(0).default(0),
        productId: z.number().int().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        const lineTotal = Math.max(0, (input.qty ?? 1) * (input.unitPriceCents ?? 0) - (input.discountCents ?? 0));
        const result = await crm.createProposalItem({ ...input, tenantId, totalCents: lineTotal });
        await crm.recalcProposalTotal(tenantId, input.proposalId);
        return result;
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(),
        proposalId: z.number(),
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        qty: z.number().int().min(1).optional(),
        unit: z.string().max(16).nullable().optional(),
        unitPriceCents: z.number().int().min(0).optional(),
        discountCents: z.number().int().min(0).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        const { id, proposalId, ...rest } = input;
        // Recalcula totalCents da linha quando qty/unit/disc mudou
        const items = await crm.listProposalItems(tenantId, proposalId);
        const current = items.find(i => i.id === id);
        if (current) {
          const qty = rest.qty ?? Number(current.qty ?? 1);
          const unitPrice = rest.unitPriceCents ?? Number(current.unitPriceCents ?? 0);
          const discount = rest.discountCents ?? Number(current.discountCents ?? 0);
          (rest as any).totalCents = Math.max(0, qty * unitPrice - discount);
        }
        await crm.updateProposalItem(tenantId, id, rest as any);
        await crm.recalcProposalTotal(tenantId, proposalId);
        return { success: true };
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number(), proposalId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        await crm.deleteProposalItem(tenantId, input.id);
        await crm.recalcProposalTotal(tenantId, input.proposalId);
        return { success: true };
      }),
    reorder: tenantWriteProcedure
      .input(z.object({ proposalId: z.number(), ids: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        await crm.reorderProposalItems(tenantId, input.proposalId, input.ids);
        return { success: true };
      }),
    addFromCatalog: tenantWriteProcedure
      .input(z.object({
        proposalId: z.number(),
        products: z.array(z.object({ productId: z.number(), qty: z.number().int().min(1).default(1) })).min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        const { getDb } = await import("../db");
        const { productCatalog } = await import("../../drizzle/schema");
        const { and, eq, inArray } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return { added: 0 };

        const productIds = input.products.map(p => p.productId);
        const products = await db.select().from(productCatalog)
          .where(and(eq(productCatalog.tenantId, tenantId), inArray(productCatalog.id, productIds)));

        // Determinar próximo orderIndex
        const existing = await crm.listProposalItems(tenantId, input.proposalId);
        let nextOrder = existing.length;

        for (const p of input.products) {
          const product: any = products.find((pr: any) => pr.id === p.productId);
          if (!product) continue;
          // Para produtos por unidade (mL/g), o "preço unitário" do orçamento
          // é o preço por unidade; a coluna unit guarda mL/g/etc.
          const isPerUnit = product.pricingMode === "per_unit"
            && product.pricePerUnitCents
            && product.unitOfMeasure;
          const unitPrice = isPerUnit
            ? Number(product.pricePerUnitCents)
            : Number(product.basePriceCents ?? 0);
          const unit = isPerUnit
            ? product.unitOfMeasure
            : (product.productType === "servico" ? "h" : "un");
          const lineTotal = unitPrice * p.qty;
          await (crm as any).createProposalItem({
            tenantId,
            proposalId: input.proposalId,
            title: product.name,
            description: product.description ?? undefined,
            qty: p.qty,
            unit,
            unitPriceCents: unitPrice,
            discountCents: 0,
            totalCents: lineTotal,
            productId: product.id,
            imageUrl: product.imageUrl ?? null,
            orderIndex: nextOrder++,
          });
        }
        await crm.recalcProposalTotal(tenantId, input.proposalId);
        return { added: input.products.length };
      }),
  }),

  /** Envia a proposta por email com PDF anexo. */
  sendEmail: tenantWriteProcedure
    .input(z.object({
      id: z.number(),
      to: z.string().email().optional(),  // se omitido, usa o email do contato
      message: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { TRPCError } = await import("@trpc/server");
      const tenantId = getTenantId(ctx);

      const proposal = await crm.getProposalById(tenantId, input.id);
      if (!proposal) throw new TRPCError({ code: "NOT_FOUND", message: "Proposta não encontrada" });

      const deal = await crm.getDealById(tenantId, proposal.dealId);
      const contact = deal?.contactId ? await crm.getContactById(tenantId, deal.contactId) : null;

      const recipient = input.to || contact?.email;
      if (!recipient) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Sem email destino — preencha o email do contato ou informe um destinatário." });
      }

      const branding = await crm.getTenantBranding(tenantId);

      // Gerar PDF
      const { generateProposalPdf } = await import("../services/proposalPdfService");
      const { buffer } = await generateProposalPdf(tenantId, input.id);
      const pdfBase64 = buffer.toString("base64");

      // URLs
      const origin = (ctx as any).req?.headers?.origin || (ctx as any).req?.headers?.referer?.split("/").slice(0, 3).join("/") || "";
      const publicUrl = proposal.publicToken && origin ? `${origin}/p/${proposal.publicToken}` : null;
      const totalText = ((Number(proposal.totalCents ?? 0) || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: proposal.currency || "BRL" });

      const { sendProposalEmail } = await import("../emailService");
      const result = await sendProposalEmail({
        to: recipient,
        clientName: contact?.name || "Cliente",
        proposalId: proposal.id,
        totalText,
        publicUrl,
        paymentUrl: proposal.asaasInvoiceUrl,
        customMessage: input.message,
        branding: {
          name: branding?.name,
          primaryColor: branding?.primaryColor,
          logoUrl: branding?.logoUrl,
        },
        pdfBase64,
      });

      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Falha ao enviar email: ${result.error}` });
      }

      // Marca como enviada se ainda em draft
      if (proposal.status === "draft") {
        await crm.updateProposal(tenantId, proposal.id, { status: "sent", sentAt: new Date() } as any);
      }

      await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "proposal", entityId: proposal.id, action: "send_email" });
      return { success: true, to: recipient };
    }),

  /** Cria uma nova versão (cópia draft) da proposta. */
  duplicate: tenantWriteProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      const created = await crm.duplicateProposal(tenantId, input.id, ctx.user.id);
      if (!created?.id) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao duplicar proposta." });
      }
      await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "proposal", entityId: created.id, action: "duplicate" });
      return { id: created.id };
    }),

  /** Gera (ou retorna o existente) token público e marca como enviada. */
  publish: tenantWriteProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      const proposal = await crm.getProposalById(tenantId, input.id);
      if (!proposal) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "NOT_FOUND", message: "Proposta não encontrada" });
      }
      const items = await crm.listProposalItems(tenantId, input.id);
      if (items.length === 0) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "BAD_REQUEST", message: "Adicione ao menos um item antes de publicar" });
      }
      // Snapshot do cliente
      const deal = await crm.getDealById(tenantId, proposal.dealId);
      const contact = deal?.contactId ? await crm.getContactById(tenantId, deal.contactId) : null;
      const snapshot = contact ? {
        name: contact.name,
        email: contact.email,
        phone: contact.phoneE164 || contact.phone,
        docId: contact.docId,
      } : null;

      let publicToken = proposal.publicToken;
      if (!publicToken) {
        const { randomBytes } = await import("crypto");
        publicToken = randomBytes(24).toString("base64url");
      }
      await crm.updateProposal(tenantId, input.id, {
        publicToken,
        clientSnapshotJson: snapshot,
        status: proposal.status === "draft" ? "sent" : proposal.status,
        sentAt: proposal.sentAt || new Date(),
      } as any);
      return { publicToken, publicUrl: publicToken ? `/p/${publicToken}` : null };
    }),

  /**
   * Aceitar proposta pelo back-office (sem assinatura). Útil quando o
   * cliente confirma por WhatsApp/telefone e o atendente registra
   * manualmente. Idempotente — se já estava aceita, não falha.
   */
  accept: tenantWriteProcedure
    .input(z.object({
      id: z.number(),
      acceptedClientName: z.string().max(255).optional(),
      acceptedClientEmail: z.string().email().max(320).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      const proposal = await crm.getProposalById(tenantId, input.id);
      if (!proposal) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "NOT_FOUND", message: "Proposta não encontrada" });
      }
      if (proposal.status === "accepted") return { success: true, alreadyAccepted: true };
      await crm.updateProposal(tenantId, input.id, {
        status: "accepted",
        acceptedAt: new Date(),
        acceptedClientName: input.acceptedClientName ?? proposal.acceptedClientName ?? null,
        acceptedClientEmail: input.acceptedClientEmail ?? proposal.acceptedClientEmail ?? null,
        // Limpa rejeição se voltou de rejected → accepted (correção manual).
        rejectedAt: null,
        rejectionReason: null,
      } as any);
      await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "proposal", entityId: input.id, action: "accept" });
      return { success: true };
    }),

  /**
   * Rejeitar proposta pelo back-office. Pede motivo opcional.
   */
  reject: tenantWriteProcedure
    .input(z.object({
      id: z.number(),
      rejectionReason: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      const proposal = await crm.getProposalById(tenantId, input.id);
      if (!proposal) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "NOT_FOUND", message: "Proposta não encontrada" });
      }
      if (proposal.status === "rejected") return { success: true, alreadyRejected: true };
      await crm.updateProposal(tenantId, input.id, {
        status: "rejected",
        rejectedAt: new Date(),
        rejectionReason: input.rejectionReason || null,
        // Limpa aceite se voltou de accepted → rejected (correção manual).
        acceptedAt: null,
        acceptedClientName: null,
        acceptedClientEmail: null,
      } as any);
      await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "proposal", entityId: input.id, action: "reject" });
      return { success: true };
    }),

  /**
   * Cria uma proposta a partir dos produtos da negociação. Atalho que
   * une as áreas Produtos × Orçamentos: usuário não precisa importar do
   * catálogo — o que está no deal vira o orçamento.
   */
  createFromDeal: tenantWriteProcedure
    .input(z.object({ dealId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      const deal = await crm.getDealById(tenantId, input.dealId);
      if (!deal) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "NOT_FOUND", message: "Negociação não encontrada" });
      }
      const dealProductsList = await crm.listDealProducts(tenantId, input.dealId);
      // Cria a proposta vazia
      const created = await (crm as any).createProposal({
        tenantId,
        dealId: input.dealId,
        createdBy: ctx.user.id,
      });
      if (!created?.id) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar proposta" });
      }
      // Importa cada deal_product como item da proposta — preserva snapshot
      // (preço, modo per_unit, imagem) sem depender do catálogo atual.
      let order = 0;
      for (const dp of dealProductsList as any[]) {
        const isPerUnit = dp.pricingMode === "per_unit" && dp.pricePerUnitCents;
        const qty = isPerUnit
          ? Number(dp.quantityPerUnit ?? 1)
          : Number(dp.quantity ?? 1);
        const unitPrice = isPerUnit
          ? Number(dp.pricePerUnitCents)
          : Number(dp.unitPriceCents ?? 0);
        const unit = isPerUnit ? (dp.unitOfMeasure || "un") : "un";
        const lineTotal = Number(dp.finalPriceCents ?? Math.round(qty * unitPrice));
        await (crm as any).createProposalItem({
          tenantId,
          proposalId: created.id,
          title: dp.name,
          description: dp.description ?? undefined,
          qty: isPerUnit ? 1 : qty,
          unit,
          unitPriceCents: unitPrice,
          discountCents: Number(dp.discountCents ?? 0),
          totalCents: lineTotal,
          productId: dp.productId,
          imageUrl: dp.imageUrl ?? null,
          quantityPerUnit: isPerUnit ? qty : null,
          orderIndex: order++,
        });
      }
      await crm.recalcProposalTotal(tenantId, created.id);
      await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "proposal", entityId: created.id, action: "create" });
      return { id: created.id, items: dealProductsList.length };
    }),

  // ─── PDF generation (returns base64 for download) ───
  getPdfBase64: tenantProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const { generateProposalPdf } = await import("../services/proposalPdfService");
      const { buffer, fileName } = await generateProposalPdf(getTenantId(ctx), input.id);
      return { base64: buffer.toString("base64"), fileName };
    }),

  // ─── Send proposal PDF + invoice link via WhatsApp ───
  sendWhatsApp: tenantWriteProcedure
    .input(z.object({
      id: z.number(),
      message: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { TRPCError } = await import("@trpc/server");
      const tenantId = getTenantId(ctx);

      const proposal = await crm.getProposalById(tenantId, input.id);
      if (!proposal) throw new TRPCError({ code: "NOT_FOUND", message: "Proposta não encontrada" });

      const deal = await crm.getDealById(tenantId, proposal.dealId);
      if (!deal?.contactId) throw new TRPCError({ code: "BAD_REQUEST", message: "Negócio sem contato vinculado" });

      const contact = await crm.getContactById(tenantId, deal.contactId);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contato não encontrado" });
      const phone = contact.phoneE164 || contact.phone || contact.phoneDigits;
      if (!phone) throw new TRPCError({ code: "BAD_REQUEST", message: "Contato sem telefone — preencha o WhatsApp do cliente" });

      // Find a connected WhatsApp session for this tenant
      const { getDb } = await import("../db");
      const { whatsappSessions } = await import("../../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
      const sessions = await db.select().from(whatsappSessions)
        .where(and(eq(whatsappSessions.tenantId, tenantId), eq(whatsappSessions.status, "connected")))
        .limit(1);
      const session = sessions[0];
      if (!session) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Conecte o WhatsApp da clínica em Configurações → WhatsApp antes de enviar." });
      }

      // Generate PDF
      const { generateProposalPdf } = await import("../services/proposalPdfService");
      const { buffer, fileName } = await generateProposalPdf(tenantId, input.id);
      const pdfDataUrl = `data:application/pdf;base64,${buffer.toString("base64")}`;

      // Build caption
      const tenant = await crm.getTenantBranding(tenantId);
      const clinicName = tenant?.name || "Clínica";
      const greeting = contact.name ? `Olá, ${contact.name.split(" ")[0]}!` : "Olá!";
      const lines = [
        input.message?.trim() || `${greeting} Segue a proposta da ${clinicName}.`,
      ];
      if (proposal.asaasInvoiceUrl) {
        lines.push("");
        lines.push(`Link para pagamento (PIX, boleto ou cartão):`);
        lines.push(proposal.asaasInvoiceUrl);
      }
      const caption = lines.join("\n");

      // Send via Z-API
      const { whatsappManager } = await import("../whatsappEvolution");
      try {
        await whatsappManager.sendMediaMessage(
          session.sessionId,
          phone,
          pdfDataUrl,
          "document",
          caption,
          fileName,
          undefined,
          ctx.user.id,
        );
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Falha ao enviar WhatsApp: ${e.message || e}` });
      }

      // Mark proposal as sent if still draft
      if (proposal.status === "draft") {
        await crm.updateProposal(tenantId, proposal.id, { status: "sent", sentAt: new Date() } as any);
      }

      return { success: true };
    }),
});

// ═══════════════════════════════════════
// TENANT BRANDING (clinic name + logo)
// ═══════════════════════════════════════
export const tenantBrandingRouter = router({
  get: tenantProcedure.query(async ({ ctx }) => {
    return crm.getTenantBranding(getTenantId(ctx));
  }),
  update: tenantAdminProcedure
    .input(z.object({
      name: z.string().min(1).max(255).optional(),
      logoUrl: z.string().nullable().optional(),
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor deve estar no formato #RRGGBB").optional(),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor deve estar no formato #RRGGBB").optional(),
      fontFamily: z.string().max(64).optional(),
      footerText: z.string().max(500).nullable().optional(),
      address: z.string().max(255).nullable().optional(),
      phone: z.string().max(64).nullable().optional(),
      website: z.string().max(255).nullable().optional(),
      whatsappAutoPaid: z.boolean().optional(),
      whatsappAutoOverdue: z.boolean().optional(),
      whatsappAutoFollowup: z.boolean().optional(),
      whatsappFollowupDays: z.number().int().min(1).max(30).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate logo size if data URL (~max 1MB encoded)
      if (input.logoUrl && input.logoUrl.startsWith("data:") && input.logoUrl.length > 1_400_000) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "BAD_REQUEST", message: "Logo muito grande. Use uma imagem menor que 1MB." });
      }
      await crm.setTenantBranding(getTenantId(ctx), input);
      return { success: true };
    }),
});

// ═══════════════════════════════════════
// PUBLIC PROPOSAL VIEW (sem auth, em /p/:token)
// ═══════════════════════════════════════
export const publicProposalRouter = router({
  /** Retorna proposta + items + branding para exibição pública. */
  get: publicProcedure
    .input(z.object({ token: z.string().min(8).max(64) }))
    .query(async ({ input }) => {
      const proposal = await crm.findProposalByPublicToken(input.token);
      if (!proposal) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "NOT_FOUND", message: "Proposta não encontrada ou link inválido." });
      }
      const tenantId = proposal.tenantId;
      const items = await crm.listProposalItems(tenantId, proposal.id);
      const branding = await crm.getTenantBranding(tenantId);
      const isExpired = proposal.validUntil ? new Date(proposal.validUntil) < new Date() : false;
      return {
        id: proposal.id,
        status: proposal.status,
        currency: proposal.currency,
        subtotalCents: Number(proposal.subtotalCents ?? 0),
        discountCents: Number(proposal.discountCents ?? 0),
        taxCents: Number(proposal.taxCents ?? 0),
        totalCents: Number(proposal.totalCents ?? 0),
        notes: proposal.notes,
        validUntil: proposal.validUntil,
        sentAt: proposal.sentAt,
        acceptedAt: proposal.acceptedAt,
        client: proposal.clientSnapshotJson,
        asaasInvoiceUrl: proposal.asaasInvoiceUrl,
        asaasPaymentStatus: proposal.asaasPaymentStatus,
        items: items.map((i: any) => ({
          id: i.id, title: i.title, description: i.description,
          qty: Number(i.qty ?? 1), unit: i.unit,
          unitPriceCents: Number(i.unitPriceCents ?? 0),
          discountCents: Number(i.discountCents ?? 0),
          totalCents: Number(i.totalCents ?? 0),
          orderIndex: Number(i.orderIndex ?? 0),
        })),
        branding,
        isExpired,
      };
    }),

  accept: publicProcedure
    .input(z.object({
      token: z.string().min(8).max(64),
      signerName: z.string().min(1).max(255),
      signerEmail: z.string().email().optional(),
      /** PNG data URL (canvas exportado) — opcional. */
      signatureDataUrl: z.string().max(500_000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const proposal = await crm.findProposalByPublicToken(input.token);
      if (!proposal) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "NOT_FOUND", message: "Proposta não encontrada." });
      }
      if (proposal.status === "accepted") {
        return { success: true, alreadyAccepted: true };
      }
      const isExpired = proposal.validUntil ? new Date(proposal.validUntil) < new Date() : false;
      if (isExpired) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Esta proposta está vencida." });
      }
      const ip = ((ctx as any).req?.headers?.["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        || (ctx as any).req?.socket?.remoteAddress
        || null;
      await crm.updateProposal(proposal.tenantId, proposal.id, {
        status: "accepted",
        acceptedAt: new Date(),
        acceptedClientName: input.signerName,
        acceptedClientEmail: input.signerEmail ?? null,
        acceptedClientIp: ip ?? null,
      } as any);
      // Persiste registro de assinatura (com ou sem PNG)
      try {
        const { getDb } = await import("../db");
        const { proposalSignatures } = await import("../../drizzle/schema");
        const db = await getDb();
        if (db) {
          await db.insert(proposalSignatures).values({
            tenantId: proposal.tenantId,
            proposalId: proposal.id,
            signerName: input.signerName,
            signerEmail: input.signerEmail ?? null,
            signatureDataUrl: input.signatureDataUrl ?? null,
            signedAt: new Date(),
            ip: ip ?? null,
          } as any);
        }
      } catch (e: any) {
        // Não falhar o aceite se assinatura não persistir
        console.warn("[publicProposal.accept] signature persist failed:", e?.message);
      }
      return { success: true, asaasInvoiceUrl: proposal.asaasInvoiceUrl };
    }),

  /**
   * Rejeitar proposta pelo cliente (via /p/:token). Sem auth — registra
   * IP + nome (se informado) + motivo opcional. Idempotente.
   */
  reject: publicProcedure
    .input(z.object({
      token: z.string().min(8).max(64),
      rejectedClientName: z.string().max(255).optional(),
      rejectionReason: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const proposal = await crm.findProposalByPublicToken(input.token);
      if (!proposal) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "NOT_FOUND", message: "Proposta não encontrada." });
      }
      if (proposal.status === "rejected") return { success: true, alreadyRejected: true };
      if (proposal.status === "accepted") {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esta proposta já foi aceita — não é possível rejeitar." });
      }
      const ip = ((ctx as any).req?.headers?.["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        || (ctx as any).req?.socket?.remoteAddress
        || null;
      await crm.updateProposal(proposal.tenantId, proposal.id, {
        status: "rejected",
        rejectedAt: new Date(),
        rejectedClientName: input.rejectedClientName ?? null,
        rejectedClientIp: ip ?? null,
        rejectionReason: input.rejectionReason ?? null,
      } as any);
      return { success: true };
    }),
});

// ═══════════════════════════════════════
// QUICK SEND — WhatsApp ad-hoc por contato
// ═══════════════════════════════════════
export const whatsappQuickRouter = router({
  // Status + telefone resolvidos para um contato — usado pelos botões de envio rápido
  contactStatus: tenantProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      const contact = await crm.getContactById(tenantId, input.contactId);
      if (!contact) return { canSend: false, reason: "contact_not_found" as const };
      const phone = (contact as any).phoneE164 || contact.phone || (contact as any).phoneDigits;
      if (!phone) return { canSend: false, reason: "no_phone" as const };

      const { getDb } = await import("../db");
      const { whatsappSessions } = await import("../../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { canSend: false, reason: "db_unavailable" as const };
      const sess = await db.select({ id: whatsappSessions.sessionId }).from(whatsappSessions)
        .where(and(eq(whatsappSessions.tenantId, tenantId), eq(whatsappSessions.status, "connected")))
        .limit(1);
      if (!sess[0]) return { canSend: false, reason: "no_session" as const, phone };
      return { canSend: true as const, phone };
    }),

  send: tenantWriteProcedure
    .input(z.object({
      contactId: z.number(),
      message: z.string().min(1).max(4000),
    }))
    .mutation(async ({ ctx, input }) => {
      const { TRPCError } = await import("@trpc/server");
      const tenantId = getTenantId(ctx);
      const contact = await crm.getContactById(tenantId, input.contactId);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contato não encontrado" });
      const phone = (contact as any).phoneE164 || contact.phone || (contact as any).phoneDigits;
      if (!phone) throw new TRPCError({ code: "BAD_REQUEST", message: "Contato sem telefone" });

      const { getDb } = await import("../db");
      const { whatsappSessions } = await import("../../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
      const [session] = await db.select().from(whatsappSessions)
        .where(and(eq(whatsappSessions.tenantId, tenantId), eq(whatsappSessions.status, "connected")))
        .limit(1);
      if (!session) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Conecte o WhatsApp da clínica antes de enviar." });
      }

      const { whatsappManager } = await import("../whatsappEvolution");
      try {
        await whatsappManager.sendTextMessage(session.sessionId, phone, input.message);
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Falha ao enviar: ${e.message || e}` });
      }
      await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "contact", entityId: input.contactId, action: "whatsapp_quick_send" });
      return { success: true };
    }),
});

// ═══════════════════════════════════════
// M4 — PORTAL DO CLIENTE
// ═══════════════════════════════════════
export const portalRouter = router({
  users: router({
    create: tenantWriteProcedure
      .input(z.object({ contactId: z.number(), email: z.string().email() }))
      .mutation(async ({ input, ctx }) => crm.createPortalUser({ ...input, tenantId: getTenantId(ctx) })),
  }),
  tickets: router({
    list: tenantProcedure
      .input(z.object({ contactId: z.number().optional(), status: z.string().optional() }))
      .query(async ({ input, ctx }) => crm.listPortalTickets(getTenantId(ctx), input)),
    create: tenantWriteProcedure
      .input(z.object({ contactId: z.number(), subject: z.string().min(1), serviceDeliveryId: z.number().optional(), priority: z.enum(["low", "medium", "high", "urgent"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createPortalTicket({ ...input, tenantId: getTenantId(ctx) });
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "portal_ticket", entityId: result?.id, action: "create" });
        return result;
      }),
  }),
});

// ═══════════════════════════════════════
// M5 — GESTÃO
// ═══════════════════════════════════════
export const managementRouter = router({
  goals: router({
    list: tenantAdminProcedure
      .query(async ({ input, ctx }) => crm.listGoals(getTenantId(ctx))),
    get: tenantAdminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => crm.getGoalById(getTenantId(ctx), input.id)),
    create: tenantAdminProcedure
      .input(z.object({
        name: z.string().min(1).optional(),
        scope: z.enum(["user", "company"]).default("user"),
        periodStart: z.string(),
        periodEnd: z.string(),
        metricKey: z.string(),
        targetValue: z.number().positive(),
        teamId: z.number().optional(),
        userId: z.number().optional(),
        companyId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return crm.createGoal({
          ...input,
          tenantId: getTenantId(ctx),
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
        });
      }),
    update: tenantAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        scope: z.enum(["user", "company"]).optional(),
        periodStart: z.string().optional(),
        periodEnd: z.string().optional(),
        metricKey: z.string().optional(),
        targetValue: z.number().positive().optional(),
        userId: z.number().nullable().optional(),
        companyId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const updateData: any = { ...data };
        if (data.periodStart) updateData.periodStart = new Date(data.periodStart);
        if (data.periodEnd) updateData.periodEnd = new Date(data.periodEnd);
        return crm.updateGoal(getTenantId(ctx), id, updateData);
      }),
    delete: tenantAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => crm.deleteGoal(getTenantId(ctx), input.id)),
  }),
  companies: router({
    list: tenantProcedure
      .query(async ({ input, ctx }) => crm.listCompaniesByTenant(getTenantId(ctx))),
  }),
});

// ═══════════════════════════════════════
// M6 — INSIGHTS
// ═══════════════════════════════════════
export const insightsRouter = router({
  alerts: router({
    list: tenantProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input, ctx }) => crm.listAlerts(getTenantId(ctx), input)),
    create: tenantWriteProcedure
      .input(z.object({ type: z.string(), entityType: z.string().optional(), entityId: z.number().optional(), payloadJson: z.any().optional() }))
      .mutation(async ({ input, ctx }) => crm.createAlert({ ...input, tenantId: getTenantId(ctx) })),
  }),
  dashboard: tenantProcedure
    .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional(), userId: z.number().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const dateOpts: any = {};
      if (input?.dateFrom) dateOpts.dateFrom = input.dateFrom;
      if (input?.dateTo) dateOpts.dateTo = input.dateTo;
      if (input?.userId) { dateOpts.ownerUserId = input.userId; dateOpts.assignedToUserId = input.userId; }
      const hasOpts = Object.keys(dateOpts).length > 0;
      const contactOpts = hasOpts ? { dateFrom: dateOpts.dateFrom, dateTo: dateOpts.dateTo, ownerUserId: dateOpts.ownerUserId } : undefined;
      const dealOpts = hasOpts ? { dateFrom: dateOpts.dateFrom, dateTo: dateOpts.dateTo, ownerUserId: dateOpts.ownerUserId } : undefined;
      const convOpts = hasOpts ? { dateFrom: dateOpts.dateFrom, dateTo: dateOpts.dateTo, assignedToUserId: dateOpts.assignedToUserId } : undefined;
      const valOpts = hasOpts ? { dateFrom: dateOpts.dateFrom, dateTo: dateOpts.dateTo, ownerUserId: dateOpts.ownerUserId } : undefined;
      const [totalContacts, openDeals, wonDeals, openConversations, dealValue] = await Promise.all([
        crm.countContacts(getTenantId(ctx), contactOpts),
        crm.countDeals(getTenantId(ctx), "open", dealOpts),
        crm.countDeals(getTenantId(ctx), "won", dealOpts),
        crm.countConversations(getTenantId(ctx), "open", convOpts),
        crm.sumDealValue(getTenantId(ctx), "open", valOpts),
      ]);
      return { totalContacts, openDeals, wonDeals, openConversations, pipelineValueCents: dealValue };
    }),
});

// ═══════════════════════════════════════
// M7 — ACADEMY
// ═══════════════════════════════════════
export const academyRouter = router({
  courses: router({
    list: tenantProcedure
      
      .query(async ({ input, ctx }) => crm.listCourses(getTenantId(ctx))),
    get: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => crm.getCourseById(getTenantId(ctx), input.id)),
    create: tenantWriteProcedure
      .input(z.object({ title: z.string().min(1), description: z.string().optional(), coverUrl: z.string().optional() }))
      .mutation(async ({ input, ctx }) => crm.createCourse({ ...input, tenantId: getTenantId(ctx) })),
  }),
  lessons: router({
    list: tenantProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input, ctx }) => crm.listLessons(getTenantId(ctx), input.courseId)),
    create: tenantWriteProcedure
      .input(z.object({ courseId: z.number(), title: z.string(), contentBody: z.string().optional(), contentUrl: z.string().optional(), orderIndex: z.number() }))
      .mutation(async ({ input, ctx }) => crm.createLesson({ ...input, tenantId: getTenantId(ctx) })),
  }),
  enrollments: router({
    list: tenantProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input, ctx }) => crm.listEnrollments(getTenantId(ctx), input.userId)),
    enroll: tenantWriteProcedure
      .input(z.object({ userId: z.number(), courseId: z.number() }))
      .mutation(async ({ input, ctx }) => crm.enrollUser({ ...input, tenantId: getTenantId(ctx) })),
  }),
});

// ═══════════════════════════════════════
// M8 — INTEGRATION HUB
// ═══════════════════════════════════════
export const integrationHubRouter = router({
  integrations: router({
    list: tenantAdminProcedure
      
      .query(async ({ input, ctx }) => crm.listIntegrations(getTenantId(ctx))),
    create: tenantAdminProcedure
      .input(z.object({ provider: z.string(), name: z.string() }))
      .mutation(async ({ input, ctx }) => crm.createIntegration({ ...input, tenantId: getTenantId(ctx) })),
  }),
  webhooks: router({
    list: tenantAdminProcedure
      
      .query(async ({ input, ctx }) => crm.listWebhooks(getTenantId(ctx))),
    create: tenantAdminProcedure
      .input(z.object({ provider: z.string(), endpoint: z.string().url(), secretHash: z.string().optional() }))
      .mutation(async ({ input, ctx }) => crm.createWebhook({ ...input, tenantId: getTenantId(ctx) })),
  }),
  jobs: router({
    list: tenantAdminProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input, ctx }) => crm.listJobs(getTenantId(ctx), input)),
    create: tenantAdminProcedure
      .input(z.object({ type: z.string(), payloadJson: z.any().optional() }))
      .mutation(async ({ input, ctx }) => crm.createJob({ ...input, tenantId: getTenantId(ctx) })),
  }),
});
