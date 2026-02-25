import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as crm from "../crmDb";
import { emitEvent } from "../middleware/eventLog";

// ═══════════════════════════════════════
// M3 — PROPOSTAS
// ═══════════════════════════════════════
export const proposalRouter = router({
  templates: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => crm.listProposalTemplates(input.tenantId)),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), name: z.string().min(1), htmlBody: z.string().optional(), variablesJson: z.any().optional() }))
      .mutation(async ({ input }) => crm.createProposalTemplate(input)),
  }),
  list: protectedProcedure
    .input(z.object({ tenantId: z.number(), dealId: z.number().optional(), status: z.string().optional() }))
    .query(async ({ input }) => crm.listProposals(input.tenantId, input)),
  get: protectedProcedure
    .input(z.object({ tenantId: z.number(), id: z.number() }))
    .query(async ({ input }) => crm.getProposalById(input.tenantId, input.id)),
  create: protectedProcedure
    .input(z.object({ tenantId: z.number(), dealId: z.number(), totalCents: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await crm.createProposal({ ...input, createdBy: ctx.user.id });
      await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "proposal", entityId: result?.id, action: "create" });
      return result;
    }),
  update: protectedProcedure
    .input(z.object({ tenantId: z.number(), id: z.number(), status: z.enum(["draft", "sent", "viewed", "accepted", "rejected", "expired"]).optional(), totalCents: z.number().optional(), pdfUrl: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId, id, ...data } = input;
      await crm.updateProposal(tenantId, id, data);
      await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "proposal", entityId: id, action: "update" });
      return { success: true };
    }),
  items: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), proposalId: z.number() }))
      .query(async ({ input }) => crm.listProposalItems(input.tenantId, input.proposalId)),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), proposalId: z.number(), title: z.string(), description: z.string().optional(), qty: z.number().optional(), unitPriceCents: z.number().optional(), totalCents: z.number().optional() }))
      .mutation(async ({ input }) => crm.createProposalItem(input)),
  }),
});

// ═══════════════════════════════════════
// M4 — PORTAL DO CLIENTE
// ═══════════════════════════════════════
export const portalRouter = router({
  users: router({
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), contactId: z.number(), email: z.string().email() }))
      .mutation(async ({ input }) => crm.createPortalUser(input)),
  }),
  tickets: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), contactId: z.number().optional(), status: z.string().optional() }))
      .query(async ({ input }) => crm.listPortalTickets(input.tenantId, input)),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), contactId: z.number(), subject: z.string().min(1), tripId: z.number().optional(), priority: z.enum(["low", "medium", "high", "urgent"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createPortalTicket(input);
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "portal_ticket", entityId: result?.id, action: "create" });
        return result;
      }),
  }),
});

// ═══════════════════════════════════════
// M5 — GESTÃO
// ═══════════════════════════════════════
export const managementRouter = router({
  goals: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => crm.listGoals(input.tenantId)),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), periodStart: z.string(), periodEnd: z.string(), metricKey: z.string(), targetValue: z.number(), teamId: z.number().optional(), userId: z.number().optional() }))
      .mutation(async ({ input }) => {
        return crm.createGoal({ ...input, periodStart: new Date(input.periodStart), periodEnd: new Date(input.periodEnd) });
      }),
  }),
});

// ═══════════════════════════════════════
// M6 — INSIGHTS
// ═══════════════════════════════════════
export const insightsRouter = router({
  alerts: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), status: z.string().optional() }))
      .query(async ({ input }) => crm.listAlerts(input.tenantId, input)),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), type: z.string(), entityType: z.string().optional(), entityId: z.number().optional(), payloadJson: z.any().optional() }))
      .mutation(async ({ input }) => crm.createAlert(input)),
  }),
  dashboard: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      const [totalContacts, openDeals, wonDeals, openConversations, dealValue] = await Promise.all([
        crm.countContacts(input.tenantId),
        crm.countDeals(input.tenantId, "open"),
        crm.countDeals(input.tenantId, "won"),
        crm.countConversations(input.tenantId, "open"),
        crm.sumDealValue(input.tenantId, "open"),
      ]);
      return { totalContacts, openDeals, wonDeals, openConversations, pipelineValueCents: dealValue };
    }),
});

// ═══════════════════════════════════════
// M7 — ACADEMY
// ═══════════════════════════════════════
export const academyRouter = router({
  courses: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => crm.listCourses(input.tenantId)),
    get: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .query(async ({ input }) => crm.getCourseById(input.tenantId, input.id)),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), title: z.string().min(1), description: z.string().optional(), coverUrl: z.string().optional() }))
      .mutation(async ({ input }) => crm.createCourse(input)),
  }),
  lessons: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), courseId: z.number() }))
      .query(async ({ input }) => crm.listLessons(input.tenantId, input.courseId)),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), courseId: z.number(), title: z.string(), contentBody: z.string().optional(), contentUrl: z.string().optional(), orderIndex: z.number() }))
      .mutation(async ({ input }) => crm.createLesson(input)),
  }),
  enrollments: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), userId: z.number() }))
      .query(async ({ input }) => crm.listEnrollments(input.tenantId, input.userId)),
    enroll: protectedProcedure
      .input(z.object({ tenantId: z.number(), userId: z.number(), courseId: z.number() }))
      .mutation(async ({ input }) => crm.enrollUser(input)),
  }),
});

// ═══════════════════════════════════════
// M8 — INTEGRATION HUB
// ═══════════════════════════════════════
export const integrationHubRouter = router({
  integrations: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => crm.listIntegrations(input.tenantId)),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), provider: z.string(), name: z.string() }))
      .mutation(async ({ input }) => crm.createIntegration(input)),
  }),
  webhooks: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => crm.listWebhooks(input.tenantId)),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), provider: z.string(), endpoint: z.string().url(), secretHash: z.string().optional() }))
      .mutation(async ({ input }) => crm.createWebhook(input)),
  }),
  jobs: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), status: z.string().optional() }))
      .query(async ({ input }) => crm.listJobs(input.tenantId, input)),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), type: z.string(), payloadJson: z.any().optional() }))
      .mutation(async ({ input }) => crm.createJob(input)),
  }),
});
