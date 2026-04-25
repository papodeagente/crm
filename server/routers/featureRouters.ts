import { z } from "zod";
import { tenantProcedure, tenantWriteProcedure, tenantAdminProcedure, getTenantId, router } from "../_core/trpc";
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
    .input(z.object({ dealId: z.number().optional(), status: z.string().optional() }))
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
    .input(z.object({ id: z.number(), status: z.enum(["draft", "sent", "viewed", "accepted", "rejected", "expired"]).optional(), totalCents: z.number().optional(), pdfUrl: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
      await crm.updateProposal(tenantId, id, data);
      await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "proposal", entityId: id, action: "update" });
      return { success: true };
    }),
  items: router({
    list: tenantProcedure
      .input(z.object({ proposalId: z.number() }))
      .query(async ({ input, ctx }) => crm.listProposalItems(getTenantId(ctx), input.proposalId)),
    create: tenantWriteProcedure
      .input(z.object({ proposalId: z.number(), title: z.string(), description: z.string().optional(), qty: z.number().optional(), unitPriceCents: z.number().optional(), totalCents: z.number().optional() }))
      .mutation(async ({ input, ctx }) => crm.createProposalItem({ ...input, tenantId: getTenantId(ctx) })),
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
