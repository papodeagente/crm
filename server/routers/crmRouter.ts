import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as crm from "../crmDb";
import { emitEvent } from "../middleware/eventLog";

export const crmRouter = router({
  // ─── CONTACTS ───
  contacts: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), search: z.string().optional(), stage: z.string().optional(), limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return crm.listContacts(input.tenantId, input);
      }),
    get: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .query(async ({ input }) => {
        return crm.getContactById(input.tenantId, input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(), name: z.string().min(1), type: z.enum(["person", "company"]).optional(),
        email: z.string().optional(), phone: z.string().optional(), source: z.string().optional(),
        ownerUserId: z.number().optional(), teamId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createContact({ ...input, createdBy: ctx.user.id });
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "contact", entityId: result?.id, action: "create" });
        return result;
      }),
    update: protectedProcedure
      .input(z.object({
        tenantId: z.number(), id: z.number(), name: z.string().optional(), email: z.string().optional(),
        phone: z.string().optional(), lifecycleStage: z.enum(["lead", "prospect", "customer", "churned"]).optional(),
        notes: z.string().optional(), ownerUserId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { tenantId, id, ...data } = input;
        await crm.updateContact(tenantId, id, { ...data, updatedBy: ctx.user.id });
        await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "contact", entityId: id, action: "update" });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await crm.deleteContact(input.tenantId, input.id);
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "contact", entityId: input.id, action: "delete" });
        return { success: true };
      }),
    count: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return crm.countContacts(input.tenantId);
      }),
  }),

  // ─── PIPELINES & STAGES ───
  pipelines: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return crm.listPipelines(input.tenantId);
      }),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), name: z.string().min(1), isDefault: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        return crm.createPipeline(input);
      }),
    stages: protectedProcedure
      .input(z.object({ tenantId: z.number(), pipelineId: z.number() }))
      .query(async ({ input }) => {
        return crm.listStages(input.tenantId, input.pipelineId);
      }),
    createStage: protectedProcedure
      .input(z.object({ tenantId: z.number(), pipelineId: z.number(), name: z.string(), orderIndex: z.number(), probabilityDefault: z.number().optional(), isWon: z.boolean().optional(), isLost: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        return crm.createStage(input);
      }),
  }),

  // ─── DEALS ───
  deals: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), pipelineId: z.number().optional(), stageId: z.number().optional(), status: z.string().optional(), limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return crm.listDeals(input.tenantId, input);
      }),
    get: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .query(async ({ input }) => {
        return crm.getDealById(input.tenantId, input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(), title: z.string().min(1), contactId: z.number().optional(),
        pipelineId: z.number(), stageId: z.number(), valueCents: z.number().optional(),
        ownerUserId: z.number().optional(), teamId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createDeal({ ...input, createdBy: ctx.user.id });
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "deal", entityId: result?.id, action: "create" });
        return result;
      }),
    update: protectedProcedure
      .input(z.object({
        tenantId: z.number(), id: z.number(), title: z.string().optional(),
        stageId: z.number().optional(), status: z.enum(["open", "won", "lost"]).optional(),
        valueCents: z.number().optional(), probability: z.number().optional(), ownerUserId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { tenantId, id, ...data } = input;
        await crm.updateDeal(tenantId, id, { ...data, updatedBy: ctx.user.id });
        await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "deal", entityId: id, action: "update" });
        return { success: true };
      }),
    count: protectedProcedure
      .input(z.object({ tenantId: z.number(), status: z.string().optional() }))
      .query(async ({ input }) => {
        return crm.countDeals(input.tenantId, input.status);
      }),
    totalValue: protectedProcedure
      .input(z.object({ tenantId: z.number(), status: z.string().optional() }))
      .query(async ({ input }) => {
        return crm.sumDealValue(input.tenantId, input.status);
      }),
  }),

  // ─── TRIPS ───
  trips: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return crm.listTrips(input.tenantId);
      }),
    get: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .query(async ({ input }) => {
        return crm.getTripById(input.tenantId, input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(), dealId: z.number().optional(), destinationSummary: z.string().optional(),
        startDate: z.string().optional(), endDate: z.string().optional(), ownerUserId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createTrip({
          ...input,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          createdBy: ctx.user.id,
        });
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "trip", entityId: result?.id, action: "create" });
        return result;
      }),
  }),

  // ─── TASKS ───
  tasks: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), entityType: z.string().optional(), entityId: z.number().optional(), status: z.string().optional() }))
      .query(async ({ input }) => {
        return crm.listTasks(input.tenantId, input);
      }),
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(), entityType: z.string(), entityId: z.number(), title: z.string().min(1),
        dueAt: z.string().optional(), assignedToUserId: z.number().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createTask({
          ...input,
          dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
          createdByUserId: ctx.user.id,
        });
        return result;
      }),
    update: protectedProcedure
      .input(z.object({
        tenantId: z.number(), id: z.number(), title: z.string().optional(),
        status: z.enum(["pending", "in_progress", "done", "cancelled"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        dueAt: z.string().optional(), assignedToUserId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { tenantId, id, dueAt, ...data } = input;
        await crm.updateTask(tenantId, id, { ...data, dueAt: dueAt ? new Date(dueAt) : undefined });
        return { success: true };
      }),
  }),

  // ─── NOTES ───
  notes: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), entityType: z.string(), entityId: z.number() }))
      .query(async ({ input }) => {
        return crm.listNotes(input.tenantId, input.entityType, input.entityId);
      }),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), entityType: z.string(), entityId: z.number(), body: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return crm.createNote({ ...input, createdByUserId: ctx.user.id });
      }),
  }),
});
