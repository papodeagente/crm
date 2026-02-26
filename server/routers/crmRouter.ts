import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as crm from "../crmDb";
import { emitEvent } from "../middleware/eventLog";
import { createNotification } from "../db";

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
        // In-app notification
        await createNotification(input.tenantId, {
          type: "contact_created",
          title: `Novo contato: ${input.name}`,
          body: input.email || input.phone || undefined,
          entityType: "contact",
          entityId: String(result?.id),
        });
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

  // ─── ACCOUNTS ───
  accounts: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return crm.listAccounts(input.tenantId);
      }),
    get: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .query(async ({ input }) => {
        return crm.getAccountById(input.tenantId, input.id);
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
      .input(z.object({ tenantId: z.number(), pipelineId: z.number().optional(), stageId: z.number().optional(), status: z.string().optional(), limit: z.number().default(200), offset: z.number().default(0) }))
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
        accountId: z.number().optional(),
        pipelineId: z.number(), stageId: z.number(), valueCents: z.number().optional(),
        ownerUserId: z.number().optional(), teamId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createDeal({ ...input, createdBy: ctx.user.id });
        // Log creation in deal history
        if (result?.id) {
          await crm.createDealHistory({
            tenantId: input.tenantId,
            dealId: result.id,
            action: "created",
            description: `Negociação "${input.title}" criada`,
            toStageId: input.stageId,
            actorUserId: ctx.user.id,
            actorName: ctx.user.name || "Sistema",
          });
        }
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "deal", entityId: result?.id, action: "create" });
        // In-app notification
        await createNotification(input.tenantId, {
          type: "deal_created",
          title: `Nova negociação: "${input.title}"`,
          body: input.valueCents ? `Valor: R$ ${(input.valueCents / 100).toFixed(2)}` : undefined,
          entityType: "deal",
          entityId: String(result?.id),
        });
        return result;
      }),
    update: protectedProcedure
      .input(z.object({
        tenantId: z.number(), id: z.number(), title: z.string().optional(),
        contactId: z.number().nullable().optional(), accountId: z.number().nullable().optional(),
        stageId: z.number().optional(), status: z.enum(["open", "won", "lost"]).optional(),
        valueCents: z.number().optional(), probability: z.number().optional(), ownerUserId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { tenantId, id, ...data } = input;
        // Get current deal for history
        const currentDeal = await crm.getDealById(tenantId, id);
        await crm.updateDeal(tenantId, id, { ...data, updatedBy: ctx.user.id } as any);

        // Log field changes in history
        if (currentDeal) {
          if (data.title && data.title !== currentDeal.title) {
            await crm.createDealHistory({
              tenantId, dealId: id, action: "field_changed", description: `Título alterado`,
              fieldChanged: "title", oldValue: currentDeal.title, newValue: data.title,
              actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
            });
          }
          if (data.valueCents !== undefined && data.valueCents !== currentDeal.valueCents) {
            await crm.createDealHistory({
              tenantId, dealId: id, action: "field_changed", description: `Valor alterado`,
              fieldChanged: "valueCents",
              oldValue: String(currentDeal.valueCents || 0),
              newValue: String(data.valueCents),
              actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
            });
          }
          if (data.status && data.status !== currentDeal.status) {
            await crm.createDealHistory({
              tenantId, dealId: id, action: "status_changed", description: `Status alterado para ${data.status}`,
              fieldChanged: "status", oldValue: currentDeal.status || "", newValue: data.status,
              actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
            });
          }
          if (data.contactId !== undefined && data.contactId !== currentDeal.contactId) {
            await crm.createDealHistory({
              tenantId, dealId: id, action: "field_changed", description: data.contactId ? `Contato associado` : `Contato desvinculado`,
              fieldChanged: "contactId", oldValue: String(currentDeal.contactId || ""), newValue: String(data.contactId || ""),
              actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
            });
          }
          if (data.accountId !== undefined && data.accountId !== currentDeal.accountId) {
            await crm.createDealHistory({
              tenantId, dealId: id, action: "field_changed", description: data.accountId ? `Empresa associada` : `Empresa desvinculada`,
              fieldChanged: "accountId", oldValue: String(currentDeal.accountId || ""), newValue: String(data.accountId || ""),
              actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
            });
          }
        }
        await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "deal", entityId: id, action: "update" });
        return { success: true };
      }),
    moveStage: protectedProcedure
      .input(z.object({
        tenantId: z.number(), dealId: z.number(),
        fromStageId: z.number(), toStageId: z.number(),
        fromStageName: z.string(), toStageName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Update the deal's stage
        await crm.updateDeal(input.tenantId, input.dealId, { stageId: input.toStageId, updatedBy: ctx.user.id });
        // Record in deal history
        await crm.createDealHistory({
          tenantId: input.tenantId,
          dealId: input.dealId,
          action: "stage_moved",
          description: `Movido de "${input.fromStageName}" para "${input.toStageName}"`,
          fromStageId: input.fromStageId,
          toStageId: input.toStageId,
          fromStageName: input.fromStageName,
          toStageName: input.toStageName,
          actorUserId: ctx.user.id,
          actorName: ctx.user.name || "Sistema",
        });
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "deal", entityId: input.dealId, action: "stage_moved" });
        // In-app notification
        await createNotification(input.tenantId, {
          type: "deal_moved",
          title: `Negociação movida para "${input.toStageName}"`,
          body: `De "${input.fromStageName}" para "${input.toStageName}"`,
          entityType: "deal",
          entityId: String(input.dealId),
        });
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

    // ─── DEAL PRODUCTS (Orçamento) ───
    products: router({
      list: protectedProcedure
        .input(z.object({ tenantId: z.number(), dealId: z.number() }))
        .query(async ({ input }) => {
          return crm.listDealProducts(input.tenantId, input.dealId);
        }),
      create: protectedProcedure
        .input(z.object({
          tenantId: z.number(), dealId: z.number(), name: z.string().min(1),
          description: z.string().optional(),
          category: z.enum(["flight", "hotel", "tour", "transfer", "insurance", "cruise", "visa", "other"]).optional(),
          quantity: z.number().default(1), unitPriceCents: z.number().default(0),
          discountCents: z.number().optional(), supplier: z.string().optional(),
          checkIn: z.string().optional(), checkOut: z.string().optional(), notes: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const result = await crm.createDealProduct({
            ...input,
            checkIn: input.checkIn ? new Date(input.checkIn) : undefined,
            checkOut: input.checkOut ? new Date(input.checkOut) : undefined,
          });
          await crm.createDealHistory({
            tenantId: input.tenantId, dealId: input.dealId, action: "product_added",
            description: `Produto "${input.name}" adicionado ao orçamento`,
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          return result;
        }),
      update: protectedProcedure
        .input(z.object({
          tenantId: z.number(), id: z.number(), dealId: z.number(),
          name: z.string().optional(), description: z.string().optional(),
          category: z.enum(["flight", "hotel", "tour", "transfer", "insurance", "cruise", "visa", "other"]).optional(),
          quantity: z.number().optional(), unitPriceCents: z.number().optional(),
          discountCents: z.number().optional(), supplier: z.string().optional(),
          checkIn: z.string().optional(), checkOut: z.string().optional(), notes: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { tenantId, id, dealId, checkIn, checkOut, ...data } = input;
          await crm.updateDealProduct(tenantId, id, {
            ...data,
            checkIn: checkIn ? new Date(checkIn) : undefined,
            checkOut: checkOut ? new Date(checkOut) : undefined,
          });
          await crm.createDealHistory({
            tenantId, dealId, action: "product_updated",
            description: `Produto atualizado no orçamento`,
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ tenantId: z.number(), id: z.number(), dealId: z.number(), productName: z.string() }))
        .mutation(async ({ ctx, input }) => {
          await crm.deleteDealProduct(input.tenantId, input.id);
          await crm.createDealHistory({
            tenantId: input.tenantId, dealId: input.dealId, action: "product_removed",
            description: `Produto "${input.productName}" removido do orçamento`,
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          return { success: true };
        }),
    }),

    // ─── DEAL HISTORY ───
    history: router({
      list: protectedProcedure
        .input(z.object({ tenantId: z.number(), dealId: z.number() }))
        .query(async ({ input }) => {
          return crm.listDealHistory(input.tenantId, input.dealId);
        }),
    }),

    // ─── DEAL PARTICIPANTS ───
    participants: router({
      list: protectedProcedure
        .input(z.object({ tenantId: z.number(), dealId: z.number() }))
        .query(async ({ input }) => {
          return crm.listDealParticipants(input.tenantId, input.dealId);
        }),
      add: protectedProcedure
        .input(z.object({
          tenantId: z.number(), dealId: z.number(), contactId: z.number(),
          role: z.enum(["decision_maker", "traveler", "payer", "companion", "other"]).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const result = await crm.addDealParticipant(input);
          await crm.createDealHistory({
            tenantId: input.tenantId, dealId: input.dealId, action: "participant_added",
            description: `Participante adicionado à negociação`,
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          return result;
        }),
      remove: protectedProcedure
        .input(z.object({ tenantId: z.number(), id: z.number(), dealId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          await crm.removeDealParticipant(input.tenantId, input.id);
          await crm.createDealHistory({
            tenantId: input.tenantId, dealId: input.dealId, action: "participant_removed",
            description: `Participante removido da negociação`,
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          return { success: true };
        }),
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
        // In-app notification
        await createNotification(input.tenantId, {
          type: "task_created",
          title: `Nova tarefa: ${input.title}`,
          body: input.dueAt ? `Vencimento: ${new Date(input.dueAt).toLocaleDateString("pt-BR")}` : undefined,
          entityType: "task",
          entityId: String(result?.id),
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
