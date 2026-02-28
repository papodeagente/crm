import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as crm from "../crmDb";
import { emitEvent } from "../middleware/eventLog";
import { createNotification } from "../db";

export const crmRouter = router({
  // ─── CONTACTS ───
  contacts: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), search: z.string().optional(), stage: z.string().optional(), limit: z.number().default(50), offset: z.number().default(0), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
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
    bulkDelete: protectedProcedure
      .input(z.object({ tenantId: z.number(), ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const count = await crm.bulkSoftDeleteContacts(input.tenantId, input.ids);
        for (const id of input.ids) {
          await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "contact", entityId: id, action: "delete" });
        }
        return { success: true, count };
      }),
    listDeleted: protectedProcedure
      .input(z.object({ tenantId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return crm.listDeletedContacts(input.tenantId, input.limit);
      }),
    restore: protectedProcedure
      .input(z.object({ tenantId: z.number(), ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const count = await crm.restoreContacts(input.tenantId, input.ids);
        for (const id of input.ids) {
          await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "contact", entityId: id, action: "restore" });
        }
        return { success: true, count };
      }),
    hardDelete: protectedProcedure
      .input(z.object({ tenantId: z.number(), ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new Error("Apenas administradores podem excluir permanentemente.");
        const count = await crm.hardDeleteContacts(input.tenantId, input.ids);
        return { success: true, count };
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
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(), name: z.string().min(1),
        primaryContactId: z.number().optional(), ownerUserId: z.number().optional(), teamId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createAccount({ ...input, createdBy: ctx.user.id });
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "account", entityId: result?.id, action: "create" });
        return result;
      }),
    update: protectedProcedure
      .input(z.object({
        tenantId: z.number(), id: z.number(), name: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { tenantId, id, ...data } = input;
        await crm.updateAccount(tenantId, id, { ...data, updatedBy: ctx.user.id });
        await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "account", entityId: id, action: "update" });
        return { success: true };
      }),
    search: protectedProcedure
      .input(z.object({ tenantId: z.number(), search: z.string() }))
      .query(async ({ input }) => {
        return crm.searchAccounts(input.tenantId, input.search);
      }),
  }),

  // ─── PIPELINES & STAGES ───
  pipelines: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), includeArchived: z.boolean().optional() }))
      .query(async ({ input }) => {
        return crm.listPipelines(input.tenantId, input.includeArchived ?? false);
      }),
    get: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .query(async ({ input }) => {
        return crm.getPipelineById(input.tenantId, input.id);
      }),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), name: z.string().min(1), description: z.string().optional(), color: z.string().optional(), pipelineType: z.enum(["sales", "post_sale", "support", "custom"]).optional(), isDefault: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        return crm.createPipeline(input);
      }),
    update: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number(), name: z.string().optional(), description: z.string().optional(), color: z.string().optional(), pipelineType: z.string().optional(), isDefault: z.boolean().optional(), isArchived: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const { tenantId, id, ...data } = input;
        return crm.updatePipeline(tenantId, id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .mutation(async ({ input }) => {
        return crm.deletePipeline(input.tenantId, input.id);
      }),
    stages: protectedProcedure
      .input(z.object({ tenantId: z.number(), pipelineId: z.number() }))
      .query(async ({ input }) => {
        return crm.listStages(input.tenantId, input.pipelineId);
      }),
    createStage: protectedProcedure
      .input(z.object({ tenantId: z.number(), pipelineId: z.number(), name: z.string(), color: z.string().optional(), orderIndex: z.number(), probabilityDefault: z.number().optional(), isWon: z.boolean().optional(), isLost: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        return crm.createStage(input);
      }),
    updateStage: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number(), name: z.string().optional(), color: z.string().optional(), orderIndex: z.number().optional(), probabilityDefault: z.number().optional(), isWon: z.boolean().optional(), isLost: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const { tenantId, id, ...data } = input;
        return crm.updateStage(tenantId, id, data);
      }),
    deleteStage: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const count = await crm.countDealsInStage(input.tenantId, input.id);
        if (count > 0) throw new Error(`Não é possível excluir: ${count} negociação(ões) ativa(s) nesta etapa. Mova-as primeiro.`);
        return crm.deleteStage(input.tenantId, input.id);
      }),
    reorderStages: protectedProcedure
      .input(z.object({ tenantId: z.number(), pipelineId: z.number(), stageOrders: z.array(z.object({ id: z.number(), orderIndex: z.number() })) }))
      .mutation(async ({ input }) => {
        return crm.reorderStages(input.tenantId, input.pipelineId, input.stageOrders);
      }),
    countDealsInStage: protectedProcedure
      .input(z.object({ tenantId: z.number(), stageId: z.number() }))
      .query(async ({ input }) => {
        return crm.countDealsInStage(input.tenantId, input.stageId);
      }),
  }),

  // ─── PIPELINE AUTOMATIONS ───
  pipelineAutomations: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), sourcePipelineId: z.number().optional() }))
      .query(async ({ input }) => {
        return crm.listPipelineAutomations(input.tenantId, input.sourcePipelineId);
      }),
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(), name: z.string().min(1), sourcePipelineId: z.number(),
        triggerEvent: z.enum(["deal_won", "deal_lost", "stage_reached"]),
        triggerStageId: z.number().optional(), targetPipelineId: z.number(), targetStageId: z.number(),
        copyProducts: z.boolean().optional(), copyParticipants: z.boolean().optional(), copyCustomFields: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return crm.createPipelineAutomation(input);
      }),
    update: protectedProcedure
      .input(z.object({
        tenantId: z.number(), id: z.number(), name: z.string().optional(),
        triggerEvent: z.string().optional(), triggerStageId: z.number().optional(),
        targetPipelineId: z.number().optional(), targetStageId: z.number().optional(),
        copyProducts: z.boolean().optional(), copyParticipants: z.boolean().optional(),
        copyCustomFields: z.boolean().optional(), isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { tenantId, id, ...data } = input;
        return crm.updatePipelineAutomation(tenantId, id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .mutation(async ({ input }) => {
        return crm.deletePipelineAutomation(input.tenantId, input.id);
      }),
  }),

  // ─── DEALS ───
  deals: router({
    list: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        pipelineId: z.number().optional(),
        stageId: z.number().optional(),
        status: z.string().optional(),
        limit: z.number().default(200),
        offset: z.number().default(0),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        // Advanced filters
        titleSearch: z.string().optional(),
        accountId: z.number().optional(),
        leadSource: z.string().optional(),
        utmCampaign: z.string().optional(),
        utmSource: z.string().optional(),
        utmMedium: z.string().optional(),
        productId: z.number().optional(),
        valueMin: z.number().optional(),
        valueMax: z.number().optional(),
        expectedCloseDateFrom: z.string().optional(),
        expectedCloseDateTo: z.string().optional(),
        lastActivityDateFrom: z.string().optional(),
        lastActivityDateTo: z.string().optional(),
        noTasks: z.boolean().optional(),
        cooling: z.boolean().optional(),
        coolingDays: z.number().optional(),
      }))
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
        pipelineId: z.number(), stageId: z.number(),
        ownerUserId: z.number().optional(), teamId: z.number().optional(),
        leadSource: z.string().optional(), channelOrigin: z.string().optional(),
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
          body: undefined,
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
        probability: z.number().optional(), ownerUserId: z.number().optional(),
        expectedCloseAt: z.string().nullable().optional(), channelOrigin: z.string().nullable().optional(),
        leadSource: z.string().nullable().optional(),
        lossReasonId: z.number().nullable().optional(),
        lossNotes: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { tenantId, id, ...data } = input;
        // Validate lossReasonId is required when marking as lost
        if (data.status === "lost" && !data.lossReasonId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Motivo de perda é obrigatório ao marcar como perdida" });
        }
        // Get current deal for history
        const currentDeal = await crm.getDealById(tenantId, id);
        const { expectedCloseAt, ...restData } = data;
        const updatePayload: any = { ...restData, updatedBy: ctx.user.id };
        // Clear loss fields when reopening
        if (data.status === "open" || data.status === "won") {
          updatePayload.lossReasonId = null;
          updatePayload.lossNotes = null;
        }
        if (expectedCloseAt !== undefined) {
          updatePayload.expectedCloseAt = expectedCloseAt ? new Date(expectedCloseAt) : null;
        }
        await crm.updateDeal(tenantId, id, updatePayload);

        // Log field changes in history
        if (currentDeal) {
          if (data.title && data.title !== currentDeal.title) {
            await crm.createDealHistory({
              tenantId, dealId: id, action: "field_changed", description: `Título alterado`,
              fieldChanged: "title", oldValue: currentDeal.title, newValue: data.title,
              actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
            });
          }
          // valueCents agora é calculado automaticamente pela soma dos produtos
          if (data.status && data.status !== currentDeal.status) {
            const lossReasonName = data.lossReasonId ? `(Motivo: #${data.lossReasonId})` : "";
            await crm.createDealHistory({
              tenantId, dealId: id, action: "status_changed",
              description: `Status alterado para ${data.status} ${lossReasonName}`.trim(),
              fieldChanged: "status", oldValue: currentDeal.status || "", newValue: data.status,
              actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
            });
            // Increment loss reason usage count
            if (data.status === "lost" && data.lossReasonId) {
              await crm.incrementLossReasonUsage(data.lossReasonId);
            }
            // Trigger pipeline automations on won/lost
            if (data.status === "won" || data.status === "lost") {
              const triggerEvent = data.status === "won" ? "deal_won" : "deal_lost";
              try {
                const createdDeals = await crm.executePipelineAutomation(tenantId, id, triggerEvent, ctx.user.id);
                if (createdDeals.length > 0) {
                  await createNotification(tenantId, {
                    type: "automation_triggered",
                    title: `Automação executada: ${createdDeals.length} negociação(ões) criada(s)`,
                    body: `Negociação #${id} ${data.status === "won" ? "ganha" : "perdida"} disparou automação`,
                    entityType: "deal",
                    entityId: String(id),
                  });
                }
              } catch (e) {
                console.error("Pipeline automation error:", e);
              }
            }
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
    bulkDelete: protectedProcedure
      .input(z.object({ tenantId: z.number(), ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const count = await crm.bulkSoftDeleteDeals(input.tenantId, input.ids);
        for (const id of input.ids) {
          await crm.createDealHistory({
            tenantId: input.tenantId, dealId: id, action: "deleted",
            description: "Negociação movida para lixeira",
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "deal", entityId: id, action: "delete" });
        }
        return { success: true, count };
      }),
    listDeleted: protectedProcedure
      .input(z.object({ tenantId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return crm.listDeletedDeals(input.tenantId, input.limit);
      }),
    restore: protectedProcedure
      .input(z.object({ tenantId: z.number(), ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const count = await crm.restoreDeals(input.tenantId, input.ids);
        for (const id of input.ids) {
          await crm.createDealHistory({
            tenantId: input.tenantId, dealId: id, action: "restored",
            description: "Negociação restaurada da lixeira",
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "deal", entityId: id, action: "restore" });
        }
        return { success: true, count };
      }),
    hardDelete: protectedProcedure
      .input(z.object({ tenantId: z.number(), ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new Error("Apenas administradores podem excluir permanentemente.");
        const count = await crm.hardDeleteDeals(input.tenantId, input.ids);
        return { success: true, count };
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
          tenantId: z.number(), dealId: z.number(), productId: z.number(),
          quantity: z.number().default(1),
          unitPriceCents: z.number().optional(),  // override do preço (se não informado, usa base do catálogo)
          discountCents: z.number().optional(),
          supplier: z.string().optional(),
          checkIn: z.string().optional(), checkOut: z.string().optional(), notes: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          // Buscar produto do catálogo para snapshot
          const catalogProduct = await crm.getCatalogProductById(input.tenantId, input.productId);
          if (!catalogProduct) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado no catálogo" });
          if (!catalogProduct.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Produto desativado. Não é possível adicionar a novas negociações." });
          
          const unitPrice = input.unitPriceCents ?? catalogProduct.basePriceCents;
          const discount = input.discountCents || 0;
          const finalPrice = input.quantity * unitPrice - discount;
          
          const result = await crm.createDealProduct({
            tenantId: input.tenantId,
            dealId: input.dealId,
            productId: input.productId,
            name: catalogProduct.name,
            description: catalogProduct.description || undefined,
            category: catalogProduct.productType as any,
            quantity: input.quantity,
            unitPriceCents: unitPrice,
            discountCents: discount,
            finalPriceCents: finalPrice,
            supplier: input.supplier || catalogProduct.supplier || undefined,
            checkIn: input.checkIn ? new Date(input.checkIn) : undefined,
            checkOut: input.checkOut ? new Date(input.checkOut) : undefined,
            notes: input.notes,
          });
          await crm.createDealHistory({
            tenantId: input.tenantId, dealId: input.dealId, action: "product_added",
            description: `Produto "${catalogProduct.name}" adicionado ao orçamento (${(unitPrice / 100).toFixed(2)})`,
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          // Recalcular valor total da negociação
          await crm.recalcDealValue(input.tenantId, input.dealId);
          return result;
        }),
      update: protectedProcedure
        .input(z.object({
          tenantId: z.number(), id: z.number(), dealId: z.number(),
          quantity: z.number().optional(), unitPriceCents: z.number().optional(),
          discountCents: z.number().optional(), supplier: z.string().optional(),
          checkIn: z.string().optional(), checkOut: z.string().optional(), notes: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { tenantId, id, dealId, checkIn, checkOut, ...data } = input;
          // Recalcular finalPriceCents se quantidade ou preço mudou
          const existing = await crm.getDealProduct(tenantId, id);
          const qty = data.quantity ?? existing?.quantity ?? 1;
          const unit = data.unitPriceCents ?? existing?.unitPriceCents ?? 0;
          const disc = data.discountCents ?? existing?.discountCents ?? 0;
          const finalPrice = qty * unit - disc;
          
          await crm.updateDealProduct(tenantId, id, {
            ...data,
            finalPriceCents: finalPrice,
            checkIn: checkIn ? new Date(checkIn) : undefined,
            checkOut: checkOut ? new Date(checkOut) : undefined,
          });
          await crm.createDealHistory({
            tenantId, dealId, action: "product_updated",
            description: `Produto atualizado no orçamento`,
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          // Recalcular valor total da negociação
          await crm.recalcDealValue(tenantId, dealId);
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
          // Recalcular valor total da negociação
          await crm.recalcDealValue(input.tenantId, input.dealId);
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
      .input(z.object({ tenantId: z.number(), entityType: z.string().optional(), entityId: z.number().optional(), status: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
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

  // ─── WHATSAPP MESSAGES BY DEAL ───
  dealWhatsApp: router({
    messages: protectedProcedure
      .input(z.object({ dealId: z.number(), tenantId: z.number(), limit: z.number().optional(), beforeId: z.number().optional() }))
      .query(async ({ input }) => {
        return crm.getWhatsAppMessagesByDeal(input.dealId, input.tenantId, { limit: input.limit, beforeId: input.beforeId });
      }),
    count: protectedProcedure
      .input(z.object({ dealId: z.number(), tenantId: z.number() }))
      .query(async ({ input }) => {
        return crm.countWhatsAppMessagesByDeal(input.dealId, input.tenantId);
      }),
  }),

  // ─── LEAD SOURCES ───
  leadSources: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), includeDeleted: z.boolean().optional() }))
      .query(async ({ input }) => {
        return crm.listLeadSources(input.tenantId, input.includeDeleted);
      }),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), name: z.string().min(1), color: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createLeadSource(input);
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "lead_source", entityId: result?.id, action: "create" });
        return result;
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).optional(), color: z.string().optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return crm.updateLeadSource(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return crm.softDeleteLeadSource(input.id);
      }),
    restore: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return crm.restoreLeadSource(input.id);
      }),
    hardDelete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return crm.hardDeleteLeadSource(input.id);
      }),
  }),

  // ─── CAMPAIGNS ───
  campaigns: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), sourceId: z.number().optional(), includeDeleted: z.boolean().optional() }))
      .query(async ({ input }) => {
        return crm.listCampaigns(input.tenantId, input.sourceId, input.includeDeleted);
      }),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), sourceId: z.number().optional(), name: z.string().min(1), color: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createCampaign(input);
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "campaign", entityId: result?.id, action: "create" });
        return result;
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).optional(), color: z.string().optional(), sourceId: z.number().nullish(), isActive: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return crm.updateCampaign(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return crm.softDeleteCampaign(input.id);
      }),
    restore: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return crm.restoreCampaign(input.id);
      }),
    hardDelete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return crm.hardDeleteCampaign(input.id);
      }),
  }),

  // ─── LOSS REASONS ───
  lossReasons: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), includeDeleted: z.boolean().optional() }))
      .query(async ({ input }) => {
        return crm.listLossReasons(input.tenantId, input.includeDeleted);
      }),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), name: z.string().min(1), description: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createLossReason(input);
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "loss_reason", entityId: result?.id, action: "create" });
        return result;
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).optional(), description: z.string().optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return crm.updateLossReason(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return crm.softDeleteLossReason(input.id);
      }),
    restore: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return crm.restoreLossReason(input.id);
      }),
    hardDelete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return crm.hardDeleteLossReason(input.id);
      }),
  }),
});
