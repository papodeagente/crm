import { z } from "zod";
import { tenantProcedure, getTenantId, router } from "../_core/trpc";
import * as crm from "../crmDb";
import { emitEvent } from "../middleware/eventLog";

// ═══════════════════════════════════════
// M3 — PROPOSTAS
// ═══════════════════════════════════════
export const proposalRouter = router({
  templates: router({
    list: tenantProcedure
      
      .query(async ({ input, ctx }) => crm.listProposalTemplates(getTenantId(ctx))),
    create: tenantProcedure
      .input(z.object({ name: z.string().min(1), htmlBody: z.string().optional(), variablesJson: z.any().optional() }))
      .mutation(async ({ input, ctx }) => crm.createProposalTemplate({ ...input, tenantId: getTenantId(ctx) })),
  }),
  list: tenantProcedure
    .input(z.object({ dealId: z.number().optional(), status: z.string().optional() }))
    .query(async ({ input, ctx }) => crm.listProposals(getTenantId(ctx), input)),
  get: tenantProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => crm.getProposalById(getTenantId(ctx), input.id)),
  create: tenantProcedure
    .input(z.object({ dealId: z.number(), totalCents: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await crm.createProposal({ ...input, tenantId: getTenantId(ctx), createdBy: ctx.user.id });
      await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "proposal", entityId: result?.id, action: "create" });
      return result;
    }),
  update: tenantProcedure
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
    create: tenantProcedure
      .input(z.object({ proposalId: z.number(), title: z.string(), description: z.string().optional(), qty: z.number().optional(), unitPriceCents: z.number().optional(), totalCents: z.number().optional() }))
      .mutation(async ({ input, ctx }) => crm.createProposalItem({ ...input, tenantId: getTenantId(ctx) })),
  }),
});

// ═══════════════════════════════════════
// M4 — PORTAL DO CLIENTE
// ═══════════════════════════════════════
export const portalRouter = router({
  users: router({
    create: tenantProcedure
      .input(z.object({ contactId: z.number(), email: z.string().email() }))
      .mutation(async ({ input, ctx }) => crm.createPortalUser({ ...input, tenantId: getTenantId(ctx) })),
  }),
  tickets: router({
    list: tenantProcedure
      .input(z.object({ contactId: z.number().optional(), status: z.string().optional() }))
      .query(async ({ input, ctx }) => crm.listPortalTickets(getTenantId(ctx), input)),
    create: tenantProcedure
      .input(z.object({ contactId: z.number(), subject: z.string().min(1), tripId: z.number().optional(), priority: z.enum(["low", "medium", "high", "urgent"]).optional() }))
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
    list: tenantProcedure
      .query(async ({ input, ctx }) => crm.listGoals(getTenantId(ctx))),
    get: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => crm.getGoalById(getTenantId(ctx), input.id)),
    create: tenantProcedure
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
    update: tenantProcedure
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
    delete: tenantProcedure
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
    create: tenantProcedure
      .input(z.object({ type: z.string(), entityType: z.string().optional(), entityId: z.number().optional(), payloadJson: z.any().optional() }))
      .mutation(async ({ input, ctx }) => crm.createAlert({ ...input, tenantId: getTenantId(ctx) })),
  }),
  dashboard: tenantProcedure
    
    .query(async ({ input, ctx }) => {
      const [totalContacts, openDeals, wonDeals, openConversations, dealValue] = await Promise.all([
        crm.countContacts(getTenantId(ctx)),
        crm.countDeals(getTenantId(ctx), "open"),
        crm.countDeals(getTenantId(ctx), "won"),
        crm.countConversations(getTenantId(ctx), "open"),
        crm.sumDealValue(getTenantId(ctx), "open"),
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
    create: tenantProcedure
      .input(z.object({ title: z.string().min(1), description: z.string().optional(), coverUrl: z.string().optional() }))
      .mutation(async ({ input, ctx }) => crm.createCourse({ ...input, tenantId: getTenantId(ctx) })),
  }),
  lessons: router({
    list: tenantProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input, ctx }) => crm.listLessons(getTenantId(ctx), input.courseId)),
    create: tenantProcedure
      .input(z.object({ courseId: z.number(), title: z.string(), contentBody: z.string().optional(), contentUrl: z.string().optional(), orderIndex: z.number() }))
      .mutation(async ({ input, ctx }) => crm.createLesson({ ...input, tenantId: getTenantId(ctx) })),
  }),
  enrollments: router({
    list: tenantProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input, ctx }) => crm.listEnrollments(getTenantId(ctx), input.userId)),
    enroll: tenantProcedure
      .input(z.object({ userId: z.number(), courseId: z.number() }))
      .mutation(async ({ input, ctx }) => crm.enrollUser({ ...input, tenantId: getTenantId(ctx) })),
  }),
});

// ═══════════════════════════════════════
// M8 — INTEGRATION HUB
// ═══════════════════════════════════════
export const integrationHubRouter = router({
  integrations: router({
    list: tenantProcedure
      
      .query(async ({ input, ctx }) => crm.listIntegrations(getTenantId(ctx))),
    create: tenantProcedure
      .input(z.object({ provider: z.string(), name: z.string() }))
      .mutation(async ({ input, ctx }) => crm.createIntegration({ ...input, tenantId: getTenantId(ctx) })),
  }),
  webhooks: router({
    list: tenantProcedure
      
      .query(async ({ input, ctx }) => crm.listWebhooks(getTenantId(ctx))),
    create: tenantProcedure
      .input(z.object({ provider: z.string(), endpoint: z.string().url(), secretHash: z.string().optional() }))
      .mutation(async ({ input, ctx }) => crm.createWebhook({ ...input, tenantId: getTenantId(ctx) })),
  }),
  jobs: router({
    list: tenantProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input, ctx }) => crm.listJobs(getTenantId(ctx), input)),
    create: tenantProcedure
      .input(z.object({ type: z.string(), payloadJson: z.any().optional() }))
      .mutation(async ({ input, ctx }) => crm.createJob({ ...input, tenantId: getTenantId(ctx) })),
  }),
});
