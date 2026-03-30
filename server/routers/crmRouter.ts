import { z } from "zod";
import { tenantProcedure, tenantWriteProcedure, getTenantId, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as crm from "../crmDb";
import { listDealFiles, createDealFile, deleteDealFile, getDealFile, countDealFiles } from "../db";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { emitEvent } from "../middleware/eventLog";
import { createNotification } from "../db";
import { getDb } from "../db";
import { tenants } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { resolveVisibilityFilter } from "../services/visibilityService";
import * as bulkDealService from "../services/bulkDealService";
import { startBulkSendCrm, getBulkSendProgress, cancelBulkSend, getActiveSessionForTenant, listCampaigns, getCampaignDetail, getCampaignMessages } from "../bulkMessage";

export const crmRouter = router({
  // ─── CONTACTS ───
  contacts: router({
    list: tenantProcedure
      .input(z.object({ search: z.string().optional(), stage: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), limit: z.number().default(50), offset: z.number().default(0), dateFrom: z.string().optional(), dateTo: z.string().optional(), customFieldFilters: z.array(z.object({ fieldId: z.number(), value: z.string() })).optional() }))
      .query(async ({ ctx, input }) => {
        const isAdmin = ctx.saasUser?.role === "admin";
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const tenantId = getTenantId(ctx);
        const { ownerUserIds } = await resolveVisibilityFilter(userId, tenantId, "contacts", isAdmin);
        const items = await crm.listContacts(tenantId, { ...input, ownerUserIds });
        const totalCount = await crm.countContacts(tenantId, { ...input, ownerUserIds });
        return { items, totalCount };
      }),
    get: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const contact = await crm.getContactById(getTenantId(ctx), input.id);
        if (!contact) return null;
        const isAdmin = ctx.saasUser?.role === "admin";
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const { ownerUserIds } = await resolveVisibilityFilter(userId, getTenantId(ctx), "contacts", isAdmin);
        if (ownerUserIds && !ownerUserIds.includes(contact.ownerUserId!)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem permissão para visualizar este contato" });
        }
        return contact;
      }),
    create: tenantWriteProcedure
      .input(z.object({
        name: z.string().min(1), type: z.enum(["person", "company"]).optional(),
        email: z.string().optional(), phone: z.string().optional(), source: z.string().optional(),
        ownerUserId: z.number().optional(), teamId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createContact({ ...input, tenantId: getTenantId(ctx), createdBy: ctx.user.id });
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "contact", entityId: result?.id, action: "create" });
        // In-app notification
        await createNotification(getTenantId(ctx), {
          type: "contact_created",
          title: `Novo contato: ${input.name}`,
          body: input.email || input.phone || undefined,
          entityType: "contact",
          entityId: String(result?.id),
        });
        return result;
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(), name: z.string().optional(), email: z.string().optional(),
        phone: z.string().optional(), lifecycleStage: z.enum(["lead", "prospect", "customer", "churned"]).optional(),
        notes: z.string().optional(), ownerUserId: z.number().optional(),
        birthDate: z.string().nullable().optional(), weddingDate: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        await crm.updateContact(tenantId, id, { ...data, updatedBy: ctx.user.id });
        await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "contact", entityId: id, action: "update" });
        return { success: true };
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await crm.deleteContact(getTenantId(ctx), input.id);
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "contact", entityId: input.id, action: "delete" });
        return { success: true };
      }),
    count: tenantProcedure
      
      .query(async ({ input, ctx }) => {
        const isAdmin = ctx.saasUser?.role === "admin";
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const tenantId = getTenantId(ctx);
        const { ownerUserIds } = await resolveVisibilityFilter(userId, tenantId, "contacts", isAdmin);
        return crm.countContacts(tenantId, { ownerUserIds });
      }),
    bulkDelete: tenantWriteProcedure
      .input(z.object({ ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const count = await crm.bulkSoftDeleteContacts(getTenantId(ctx), input.ids);
        for (const id of input.ids) {
          await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "contact", entityId: id, action: "delete" });
        }
        return { success: true, count };
      }),
    listDeleted: tenantProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ input, ctx }) => {
        return crm.listDeletedContacts(getTenantId(ctx), input.limit);
      }),
    restore: tenantWriteProcedure
      .input(z.object({ ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const count = await crm.restoreContacts(getTenantId(ctx), input.ids);
        for (const id of input.ids) {
          await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "contact", entityId: id, action: "restore" });
        }
        return { success: true, count };
      }),
    hardDelete: tenantWriteProcedure
      .input(z.object({ ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new Error("Apenas administradores podem excluir permanentemente.");
        const count = await crm.hardDeleteContacts(getTenantId(ctx), input.ids);
        return { success: true, count };
      }),

    // ─── Conversion History ───
    conversionHistory: tenantProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getConversionHistory } = await import("../services/contactDedup");
        return getConversionHistory(getTenantId(ctx), input.contactId);
      }),

    // ─── Merge History ───
    mergeHistory: tenantProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getMergeHistory } = await import("../services/contactDedup");
        return getMergeHistory(getTenantId(ctx), input.contactId);
      }),

    // ─── Find Duplicates ───
    findDuplicates: tenantProcedure
      .input(z.object({ contactId: z.number(), email: z.string().optional(), phone: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const { findDuplicateContacts } = await import("../services/contactDedup");
        return findDuplicateContacts(getTenantId(ctx), input.email, input.phone, input.contactId);
      }),

    // ─── Manual Merge ───
    merge: tenantWriteProcedure
      .input(z.object({
        primaryContactId: z.number(),
        secondaryContactId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { mergeContacts } = await import("../services/contactDedup");
        const result = await mergeContacts(
          getTenantId(ctx),
          input.primaryContactId,
          input.secondaryContactId,
          "manual",
          String(ctx.user.id)
        );
        await emitEvent({
          tenantId: getTenantId(ctx),
          actorUserId: ctx.user.id,
          entityType: "contact",
          entityId: input.primaryContactId,
          action: "contact_merged",
          metadataJson: {
            mergeId: result.mergeId,
            secondaryContactId: input.secondaryContactId,
            movedDeals: result.movedDeals,
            movedTasks: result.movedTasks,
          },
        });
        return result;
      }),

    // ─── Confirm Merge ───
    confirmMerge: tenantWriteProcedure
      .input(z.object({ mergeId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { confirmMerge } = await import("../services/contactDedup");
        return confirmMerge(getTenantId(ctx), input.mergeId, String(ctx.user.id));
      }),

    // ─── Revert Merge ───
    revertMerge: tenantWriteProcedure
      .input(z.object({ mergeId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { revertMerge } = await import("../services/contactDedup");
        const result = await revertMerge(getTenantId(ctx), input.mergeId, String(ctx.user.id));
        if (result.success) {
          await emitEvent({
            tenantId: getTenantId(ctx),
            actorUserId: ctx.user.id,
            entityType: "contact",
            entityId: 0,
            action: "merge_reverted",
            metadataJson: { mergeId: input.mergeId },
          });
        }
        return result;
      }),

    // ─── Pending Merges (for admin review) ───
    pendingMerges: tenantProcedure
      .query(async ({ ctx }) => {
        const { getPendingMerges } = await import("../services/contactDedup");
        return getPendingMerges(getTenantId(ctx));
      }),
    // ─── BULK WHATSAPP SEND (Contacts) ───
    bulkWhatsApp: tenantWriteProcedure
      .input(z.object({
        contactIds: z.array(z.number()).min(1),
        messageTemplate: z.string().min(1),
        sessionId: z.string(),
        delayMs: z.number().default(3000),
        randomDelay: z.boolean().default(false),
        campaignName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { assertFeatureAccess } = await import("../services/planLimitsService");
        await assertFeatureAccess(getTenantId(ctx), "segmentedBroadcast");
        return startBulkSendCrm({
          tenantId: getTenantId(ctx),
          userId: ctx.user.id,
          userName: ctx.user.name || undefined,
          entityIds: input.contactIds,
          messageTemplate: input.messageTemplate,
          sessionId: input.sessionId,
          delayMs: input.delayMs,
          randomDelay: input.randomDelay,
          campaignName: input.campaignName,
          source: "contacts",
        });
      }),
    activeSession: tenantProcedure
      .query(async ({ ctx }) => {
        const userId = ctx.saasUser?.userId || ctx.user?.id;
        return getActiveSessionForTenant(getTenantId(ctx), userId);
      }),
    bulkProgress: tenantProcedure
      .query(async ({ ctx }) => {
        return getBulkSendProgress(getTenantId(ctx));
      }),
    cancelBulk: tenantWriteProcedure
      .mutation(async ({ ctx }) => {
        return cancelBulkSend(getTenantId(ctx));
      }),
  }),

  // ─── ACCOUNTS ───
  accounts: router({
    list: tenantProcedure
      
      .query(async ({ ctx, input }) => {
        const isAdmin = ctx.saasUser?.role === "admin";
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const tenantId = getTenantId(ctx);
        const { ownerUserIds } = await resolveVisibilityFilter(userId, tenantId, "accounts", isAdmin);
        return crm.listAccounts(tenantId, { ownerUserIds });
      }),
    get: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const account = await crm.getAccountById(getTenantId(ctx), input.id);
        if (!account) return null;
        const isAdmin = ctx.saasUser?.role === "admin";
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const { ownerUserIds } = await resolveVisibilityFilter(userId, getTenantId(ctx), "accounts", isAdmin);
        if (ownerUserIds && !ownerUserIds.includes(account.ownerUserId!)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Voc\u00ea n\u00e3o tem permiss\u00e3o para visualizar esta empresa" });
        }
        return account;
      }),
    create: tenantWriteProcedure
      .input(z.object({
        name: z.string().min(1),
        primaryContactId: z.number().optional(), ownerUserId: z.number().optional(), teamId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createAccount({ ...input, tenantId: getTenantId(ctx), createdBy: ctx.user.id });
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "account", entityId: result?.id, action: "create" });
        return result;
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(), name: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        await crm.updateAccount(tenantId, id, { ...data, updatedBy: ctx.user.id });
        await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "account", entityId: id, action: "update" });
        return { success: true };
      }),
    search: tenantProcedure
      .input(z.object({ search: z.string() }))
      .query(async ({ input, ctx }) => {
        const isAdmin = ctx.saasUser?.role === "admin";
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const tenantId = getTenantId(ctx);
        const { ownerUserIds } = await resolveVisibilityFilter(userId, tenantId, "accounts", isAdmin);
        return crm.searchAccounts(tenantId, input.search, { ownerUserIds });
      }),
  }),

  // ─── PIPELINES & STAGES ───
  pipelines: router({
    list: tenantProcedure
      .input(z.object({ includeArchived: z.boolean().optional() }))
      .query(async ({ input, ctx }) => {
        return crm.listPipelines(getTenantId(ctx), input.includeArchived ?? false);
      }),
    get: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return crm.getPipelineById(getTenantId(ctx), input.id);
      }),
    create: tenantWriteProcedure
      .input(z.object({ name: z.string().min(1), description: z.string().optional(), color: z.string().optional(), pipelineType: z.enum(["sales", "post_sale", "support"]).optional(), isDefault: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        return crm.createPipeline({ ...input, tenantId: getTenantId(ctx) });
      }),
    update: tenantWriteProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional(), color: z.string().optional(), pipelineType: z.enum(["sales", "post_sale", "support"]).optional(), isDefault: z.boolean().optional(), isArchived: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        return crm.updatePipeline(tenantId, id, data);
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return crm.deletePipeline(getTenantId(ctx), input.id);
      }),
    stages: tenantProcedure
      .input(z.object({ pipelineId: z.number() }))
      .query(async ({ input, ctx }) => {
        return crm.listStages(getTenantId(ctx), input.pipelineId);
      }),
    createStage: tenantWriteProcedure
      .input(z.object({ pipelineId: z.number(), name: z.string(), color: z.string().optional(), orderIndex: z.number(), probabilityDefault: z.number().optional(), isWon: z.boolean().optional(), isLost: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        return crm.createStage({ ...input, tenantId: getTenantId(ctx) });
      }),
    updateStage: tenantWriteProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), color: z.string().optional(), orderIndex: z.number().optional(), probabilityDefault: z.number().optional(), isWon: z.boolean().optional(), isLost: z.boolean().optional(), coolingEnabled: z.boolean().optional(), coolingDays: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        return crm.updateStage(tenantId, id, data);
      }),
    deleteStage: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const count = await crm.countDealsInStage(getTenantId(ctx), input.id);
        if (count > 0) throw new Error(`Não é possível excluir: ${count} negociação(ões) ativa(s) nesta etapa. Mova-as primeiro.`);
        return crm.deleteStage(getTenantId(ctx), input.id);
      }),
    reorderStages: tenantWriteProcedure
      .input(z.object({ pipelineId: z.number(), stageOrders: z.array(z.object({ id: z.number(), orderIndex: z.number() })) }))
      .mutation(async ({ input, ctx }) => {
        return crm.reorderStages(getTenantId(ctx), input.pipelineId, input.stageOrders);
      }),
    countDealsInStage: tenantProcedure
      .input(z.object({ stageId: z.number() }))
      .query(async ({ input, ctx }) => {
        return crm.countDealsInStage(getTenantId(ctx), input.stageId);
      }),
  }),

  // ─── PIPELINE AUTOMATIONS ───
  pipelineAutomations: router({
    list: tenantProcedure
      .input(z.object({ sourcePipelineId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const { assertFeatureAccess } = await import("../services/planLimitsService");
        await assertFeatureAccess(getTenantId(ctx), "salesAutomation");
        return crm.listPipelineAutomations(getTenantId(ctx), input.sourcePipelineId);
      }),
    create: tenantWriteProcedure
      .input(z.object({
        name: z.string().min(1), sourcePipelineId: z.number(),
        triggerEvent: z.enum(["deal_won", "deal_lost", "stage_reached"]),
        triggerStageId: z.number().optional(), targetPipelineId: z.number(), targetStageId: z.number(),
        copyProducts: z.boolean().optional(), copyParticipants: z.boolean().optional(), copyCustomFields: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return crm.createPipelineAutomation({ ...input, tenantId: getTenantId(ctx) });
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(), name: z.string().optional(),
        triggerEvent: z.string().optional(), triggerStageId: z.number().optional(),
        targetPipelineId: z.number().optional(), targetStageId: z.number().optional(),
        copyProducts: z.boolean().optional(), copyParticipants: z.boolean().optional(),
        copyCustomFields: z.boolean().optional(), isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        return crm.updatePipelineAutomation(tenantId, id, data);
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return crm.deletePipelineAutomation(getTenantId(ctx), input.id);
      }),
  }),

  // ─── DEALS ───
  deals: router({
    list: tenantProcedure
      .input(z.object({
        pipelineId: z.number().optional(),
        stageId: z.number().optional(),
        status: z.string().optional(),
        limit: z.number().default(5000),
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
        ownerUserId: z.number().optional(),
        customFieldFilters: z.array(z.object({ fieldId: z.number(), value: z.string() })).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const isAdmin = ctx.saasUser?.role === "admin";
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const tenantId = getTenantId(ctx);
        const { ownerUserIds } = await resolveVisibilityFilter(userId, tenantId, "deals", isAdmin);
        // Permissão define o teto; filtro define o recorte dentro do teto
        let finalOpts: any;
        if (ownerUserIds) {
          // Non-geral: visibility limits the universe
          if (input.ownerUserId && ownerUserIds.includes(input.ownerUserId)) {
            // User wants to filter by a specific owner within their allowed set
            finalOpts = { ...input, ownerUserIds: undefined, ownerUserId: input.ownerUserId };
          } else {
            // No specific filter or filter outside scope → show full allowed set
            finalOpts = { ...input, ownerUserIds, ownerUserId: undefined };
          }
        } else {
          // Geral: no visibility restriction, pass ownerUserId filter as-is
          finalOpts = { ...input, ownerUserId: input.ownerUserId };
        }
        const items = await crm.listDeals(tenantId, finalOpts);
        const totalCount = await crm.countDeals(tenantId, input.status, finalOpts);
        return { items, totalCount };
      }),
    get: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const deal = await crm.getDealById(getTenantId(ctx), input.id);
        if (!deal) return null;
        const isAdmin = ctx.saasUser?.role === "admin";
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const { ownerUserIds } = await resolveVisibilityFilter(userId, getTenantId(ctx), "deals", isAdmin);
        if (ownerUserIds && !ownerUserIds.includes(deal.ownerUserId!)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Voc\u00ea n\u00e3o tem permiss\u00e3o para visualizar esta negocia\u00e7\u00e3o" });
        }
        return deal;
      }),
    create: tenantWriteProcedure
      .input(z.object({
        title: z.string().min(1), contactId: z.number().optional(),
        accountId: z.number().optional(),
        pipelineId: z.number(), stageId: z.number(),
        ownerUserId: z.number().optional(), teamId: z.number().optional(),
        leadSource: z.string().optional(), channelOrigin: z.string().optional(),
        boardingDate: z.string().nullable().optional(),
        returnDate: z.string().nullable().optional(),
        products: z.array(z.object({
          productId: z.number(),
          quantity: z.number().default(1),
          unitPriceCents: z.number().optional(),
          discountCents: z.number().optional(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { products: productItems, boardingDate, returnDate, ...dealInput } = input;
        // REGRA 1: Auto-assign owner to the creating user if not specified
        const result = await crm.createDeal({
          ...dealInput,
          tenantId: getTenantId(ctx),
          ownerUserId: dealInput.ownerUserId || ctx.saasUser?.userId || ctx.user.id,
          createdBy: ctx.user.id,
          boardingDate: boardingDate ? new Date(boardingDate) : null,
          returnDate: returnDate ? new Date(returnDate) : null,
        });
        // Log creation in deal history
        if (result?.id) {
          await crm.createDealHistory({
            tenantId: getTenantId(ctx),
            dealId: result.id,
            action: "created",
            description: `Negociação "${input.title}" criada`,
            toStageId: input.stageId,
            actorUserId: ctx.user.id,
            actorName: ctx.user.name || "Sistema",
          });

          // 5. Add products if provided and recalc value
          if (productItems && productItems.length > 0) {
            for (const item of productItems) {
              const catalogProduct = await crm.getCatalogProductById(getTenantId(ctx), item.productId);
              if (!catalogProduct || !catalogProduct.isActive) continue;
              const unitPrice = item.unitPriceCents ?? catalogProduct.basePriceCents;
              const discount = item.discountCents || 0;
              const finalPrice = item.quantity * unitPrice - discount;
              await crm.createDealProduct({
                tenantId: getTenantId(ctx),
                dealId: result.id,
                productId: item.productId,
                name: catalogProduct.name,
                description: catalogProduct.description || undefined,
                category: catalogProduct.productType as any,
                quantity: item.quantity,
                unitPriceCents: unitPrice,
                discountCents: discount,
                finalPriceCents: finalPrice,
                supplier: catalogProduct.supplier || undefined,
              });
            }
            await crm.recalcDealValue(getTenantId(ctx), result.id);
          }
        }
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "deal", entityId: result?.id, action: "create" });
        // In-app notification
        await createNotification(getTenantId(ctx), {
          type: "deal_created",
          title: `Nova negociação: "${input.title}"`,
          body: undefined,
          entityType: "deal",
          entityId: String(result?.id),
        });
        return result;
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(), title: z.string().optional(),
        contactId: z.number().nullable().optional(), accountId: z.number().nullable().optional(),
        stageId: z.number().optional(), status: z.enum(["open", "won", "lost"]).optional(),
        probability: z.number().optional(), ownerUserId: z.number().optional(),
        expectedCloseAt: z.string().nullable().optional(), channelOrigin: z.string().nullable().optional(),
        leadSource: z.string().nullable().optional(),
        lossReasonId: z.number().nullable().optional(),
        lossNotes: z.string().nullable().optional(),
        boardingDate: z.string().nullable().optional(),
        returnDate: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        // Non-admin users can only update their own deals
        const isAdminUser = ctx.saasUser?.role === "admin";
        if (!isAdminUser) {
          const currentOwnerCheck = await crm.getDealById(tenantId, id);
          if (currentOwnerCheck && currentOwnerCheck.ownerUserId !== ctx.saasUser?.userId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Voc\u00ea n\u00e3o tem permiss\u00e3o para editar esta negocia\u00e7\u00e3o" });
          }
        }
        // Validate lossReasonId is required when marking as lost
        if (data.status === "lost" && !data.lossReasonId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Motivo de perda é obrigatório ao marcar como perdida" });
        }
        // Get current deal for history
        const currentDeal = await crm.getDealById(tenantId, id);
        const { expectedCloseAt, boardingDate, returnDate, ...restData } = data;
        const updatePayload: any = { ...restData, updatedBy: ctx.user.id };
        if (boardingDate !== undefined) {
          updatePayload.boardingDate = boardingDate ? new Date(boardingDate) : null;
        }
        if (returnDate !== undefined) {
          updatePayload.returnDate = returnDate ? new Date(returnDate) : null;
        }
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
              // Classification engine: auto-classify contact on won/lost
              try {
                const contactId = currentDeal?.contactId || data.contactId;
                if (contactId) {
                  if (data.status === "won") {
                    const { onDealWon } = await import("../classificationEngine");
                    await onDealWon(tenantId, id, contactId, currentDeal?.valueCents || 0);
                  } else {
                    const { onDealLost } = await import("../classificationEngine");
                    await onDealLost(tenantId, id, contactId);
                  }
                }
              } catch (e) {
                console.error("[Classification] Error on deal status change:", e);
              }
            }
          }
          if (data.ownerUserId !== undefined && data.ownerUserId !== currentDeal.ownerUserId) {
            await crm.createDealHistory({
              tenantId, dealId: id, action: "field_changed", description: `Responsável alterado`,
              fieldChanged: "ownerUserId", oldValue: String(currentDeal.ownerUserId || ""), newValue: String(data.ownerUserId || ""),
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
    moveStage: tenantWriteProcedure
      .input(z.object({
        dealId: z.number(),
        fromStageId: z.number(), toStageId: z.number(),
        fromStageName: z.string(), toStageName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Non-admin users can only move their own deals
        const isAdmin = ctx.saasUser?.role === "admin";
        if (!isAdmin) {
          const deal = await crm.getDealById(getTenantId(ctx), input.dealId);
          if (deal && deal.ownerUserId !== ctx.saasUser?.userId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Voc\u00ea n\u00e3o tem permiss\u00e3o para mover esta negocia\u00e7\u00e3o" });
          }
        }
        // Update the deal's stage
        await crm.updateDeal(getTenantId(ctx), input.dealId, { stageId: input.toStageId, updatedBy: ctx.user.id });
        // Record in deal history
        await crm.createDealHistory({
          tenantId: getTenantId(ctx),
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
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "deal", entityId: input.dealId, action: "stage_moved" });
        // In-app notification
        await createNotification(getTenantId(ctx), {
          type: "deal_moved",
          title: `Negociação movida para "${input.toStageName}"`,
          body: `De "${input.fromStageName}" para "${input.toStageName}"`,
          entityType: "deal",
          entityId: String(input.dealId),
        });
        // Classification engine: auto-classify contact on stage move
        // + Task automation engine: create tasks when deal enters a stage
        try {
          const deal = await crm.getDealById(getTenantId(ctx), input.dealId);
          if (deal?.contactId) {
            const { onDealMoved } = await import("../classificationEngine");
            await onDealMoved(getTenantId(ctx), input.dealId, input.toStageId, deal.contactId, deal.pipelineId);
          }
          // Execute task automations for the new stage
          if (deal) {
            const createdTaskIds = await crm.executeTaskAutomations(
              getTenantId(ctx),
              input.dealId,
              input.toStageId,
              { ownerUserId: deal.ownerUserId, boardingDate: deal.boardingDate, returnDate: deal.returnDate },
              ctx.user.id
            );
            if (createdTaskIds.length > 0) {
              console.log(`[TaskAutomation] Created ${createdTaskIds.length} tasks for deal ${input.dealId} at stage ${input.toStageId}`);
            }
          }
          // Execute stage owner rule: auto-reassign deal owner
          try {
            const ownerResult = await crm.executeStageOwnerRule(
              getTenantId(ctx), input.dealId, input.toStageId, ctx.user.id
            );
            if (ownerResult) {
              console.log(`[StageOwnerRule] Deal ${input.dealId} reassigned to ${ownerResult.assignedUserName} (userId: ${ownerResult.assignedUserId})`);
            }
          } catch (ownerErr) {
            console.error("[StageOwnerRule] Error:", ownerErr);
          }
        } catch (e) {
          console.error("[Classification/TaskAutomation] Error on deal moved:", e);
        }
        return { success: true };
      }),
    changePipeline: tenantWriteProcedure
      .input(z.object({
        dealId: z.number(),
        newPipelineId: z.number(),
        newStageId: z.number(),
        newPipelineName: z.string(),
        newStageName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 1. Get current deal
        const deal = await crm.getDealById(getTenantId(ctx), input.dealId);
        if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Negociação não encontrada" });
        // 2. Validate pipeline belongs to tenant
        const pipelines = await crm.listPipelines(getTenantId(ctx));
        const targetPipeline = pipelines.find((p: any) => p.id === input.newPipelineId);
        if (!targetPipeline) throw new TRPCError({ code: "BAD_REQUEST", message: "Funil não encontrado neste tenant" });
        // 3. Validate stage belongs to the target pipeline
        const stages = await crm.listStages(getTenantId(ctx), input.newPipelineId);
        const targetStage = stages.find((s: any) => s.id === input.newStageId);
        if (!targetStage) throw new TRPCError({ code: "BAD_REQUEST", message: "Etapa não pertence ao funil selecionado" });
        // 4. Get old pipeline/stage names for history
        const oldPipeline = pipelines.find((p: any) => p.id === deal.pipelineId);
        const oldStages = await crm.listStages(getTenantId(ctx), deal.pipelineId);
        const oldStage = oldStages.find((s: any) => s.id === deal.stageId);
        const oldPipelineName = oldPipeline?.name || `Funil #${deal.pipelineId}`;
        const oldStageName = oldStage?.name || `Etapa #${deal.stageId}`;
        // 5. Update deal with new pipelineId and stageId
        await crm.updateDeal(getTenantId(ctx), input.dealId, {
          pipelineId: input.newPipelineId,
          stageId: input.newStageId,
          updatedBy: ctx.user.id,
        });
        // 6. Record pipeline change in history
        await crm.createDealHistory({
          tenantId: getTenantId(ctx),
          dealId: input.dealId,
          action: "field_changed",
          description: `Funil alterado de "${oldPipelineName}" para "${input.newPipelineName}"`,
          fieldChanged: "pipelineId",
          oldValue: oldPipelineName,
          newValue: input.newPipelineName,
          actorUserId: ctx.user.id,
          actorName: ctx.user.name || "Sistema",
        });
        // 7. Record stage change in history
        await crm.createDealHistory({
          tenantId: getTenantId(ctx),
          dealId: input.dealId,
          action: "stage_moved",
          description: `Etapa alterada de "${oldStageName}" para "${input.newStageName}"`,
          fromStageId: deal.stageId,
          toStageId: input.newStageId,
          fromStageName: oldStageName,
          toStageName: input.newStageName,
          actorUserId: ctx.user.id,
          actorName: ctx.user.name || "Sistema",
        });
        // 8. Emit event
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "deal", entityId: input.dealId, action: "stage_moved" });
        // 9. Notification
        await createNotification(getTenantId(ctx), {
          type: "deal_moved",
          title: `Negociação movida para funil "${input.newPipelineName}"`,
          body: `De "${oldPipelineName}" para "${input.newPipelineName}", etapa "${input.newStageName}"`,
          entityType: "deal",
          entityId: String(input.dealId),
        });
        // 10. Classification + task automations
        try {
          if (deal.contactId) {
            const { onDealMoved } = await import("../classificationEngine");
            await onDealMoved(getTenantId(ctx), input.dealId, input.newStageId, deal.contactId, input.newPipelineId);
          }
          const createdTaskIds = await crm.executeTaskAutomations(
            getTenantId(ctx),
            input.dealId,
            input.newStageId,
            { ownerUserId: deal.ownerUserId, boardingDate: deal.boardingDate, returnDate: deal.returnDate },
            ctx.user.id
          );
          if (createdTaskIds.length > 0) {
            console.log(`[TaskAutomation] Created ${createdTaskIds.length} tasks for deal ${input.dealId} at new pipeline stage ${input.newStageId}`);
          }
          // Execute stage owner rule: auto-reassign deal owner on pipeline change
          try {
            const ownerResult = await crm.executeStageOwnerRule(
              getTenantId(ctx), input.dealId, input.newStageId, ctx.user.id
            );
            if (ownerResult) {
              console.log(`[StageOwnerRule] Deal ${input.dealId} reassigned to ${ownerResult.assignedUserName} on pipeline change`);
            }
          } catch (ownerErr) {
            console.error("[StageOwnerRule] Error on pipeline change:", ownerErr);
          }
        } catch (e) {
          console.error("[Classification/TaskAutomation] Error on pipeline change:", e);
        }
        return { success: true };
      }),
    count: tenantProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        return crm.countDeals(getTenantId(ctx), input.status);
      }),
    bulkDelete: tenantWriteProcedure
      .input(z.object({ ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const count = await crm.bulkSoftDeleteDeals(getTenantId(ctx), input.ids);
        for (const id of input.ids) {
          await crm.createDealHistory({
            tenantId: getTenantId(ctx), dealId: id, action: "deleted",
            description: "Negociação movida para lixeira",
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "deal", entityId: id, action: "delete" });
        }
        return { success: true, count };
      }),
    listDeleted: tenantProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ input, ctx }) => {
        return crm.listDeletedDeals(getTenantId(ctx), input.limit);
      }),
    restore: tenantWriteProcedure
      .input(z.object({ ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const count = await crm.restoreDeals(getTenantId(ctx), input.ids);
        for (const id of input.ids) {
          await crm.createDealHistory({
            tenantId: getTenantId(ctx), dealId: id, action: "restored",
            description: "Negociação restaurada da lixeira",
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "deal", entityId: id, action: "restore" });
        }
        return { success: true, count };
      }),
    hardDelete: tenantWriteProcedure
      .input(z.object({ ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new Error("Apenas administradores podem excluir permanentemente.");
        const count = await crm.hardDeleteDeals(getTenantId(ctx), input.ids);
        return { success: true, count };
      }),
    totalValue: tenantProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        return crm.sumDealValue(getTenantId(ctx), input.status);
      }),

    // ─── BULK WHATSAPP SEND (Deals) ───
    bulkWhatsApp: tenantWriteProcedure
      .input(z.object({
        dealIds: z.array(z.number()).min(1),
        messageTemplate: z.string().min(1),
        sessionId: z.string(),
        delayMs: z.number().default(3000),
        randomDelay: z.boolean().default(false),
        campaignName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { assertFeatureAccess } = await import("../services/planLimitsService");
        await assertFeatureAccess(getTenantId(ctx), "segmentedBroadcast");
        return startBulkSendCrm({
          tenantId: getTenantId(ctx),
          userId: ctx.user.id,
          userName: ctx.user.name || undefined,
          entityIds: input.dealIds,
          messageTemplate: input.messageTemplate,
          sessionId: input.sessionId,
          delayMs: input.delayMs,
          randomDelay: input.randomDelay,
          campaignName: input.campaignName,
          source: "deals",
        });
      }),
    activeSession: tenantProcedure
      .query(async ({ ctx }) => {
        const userId = ctx.saasUser?.userId || ctx.user?.id;
        return getActiveSessionForTenant(getTenantId(ctx), userId);
      }),
    bulkProgress: tenantProcedure
      .query(async ({ ctx }) => {
        return getBulkSendProgress(getTenantId(ctx));
      }),
    cancelBulk: tenantWriteProcedure
      .mutation(async ({ ctx }) => {
        return cancelBulkSend(getTenantId(ctx));
      }),

    // ─── DEAL PRODUCTS (Orçamento) ───
    products: router({
      list: tenantProcedure
        .input(z.object({ dealId: z.number() }))
        .query(async ({ input, ctx }) => {
          return crm.listDealProducts(getTenantId(ctx), input.dealId);
        }),
      create: tenantWriteProcedure
        .input(z.object({
          dealId: z.number(), productId: z.number(),
          quantity: z.number().default(1),
          unitPriceCents: z.number().optional(),  // override do preço (se não informado, usa base do catálogo)
          discountCents: z.number().optional(),
          supplier: z.string().optional(),
          checkIn: z.string().optional(), checkOut: z.string().optional(), notes: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          // Buscar produto do catálogo para snapshot
          const catalogProduct = await crm.getCatalogProductById(getTenantId(ctx), input.productId);
          if (!catalogProduct) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado no catálogo" });
          if (!catalogProduct.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Produto desativado. Não é possível adicionar a novas negociações." });
          
          const unitPrice = input.unitPriceCents ?? catalogProduct.basePriceCents;
          const discount = input.discountCents || 0;
          const finalPrice = input.quantity * unitPrice - discount;
          
          const result = await crm.createDealProduct({
            tenantId: getTenantId(ctx),
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
            tenantId: getTenantId(ctx), dealId: input.dealId, action: "product_added",
            description: `Produto "${catalogProduct.name}" adicionado ao orçamento (${(unitPrice / 100).toFixed(2)})`,
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          // Recalcular valor total da negociação
          await crm.recalcDealValue(getTenantId(ctx), input.dealId);
          return result;
        }),
      update: tenantWriteProcedure
        .input(z.object({
          id: z.number(), dealId: z.number(),
          quantity: z.number().optional(), unitPriceCents: z.number().optional(),
          discountCents: z.number().optional(), supplier: z.string().optional(),
          checkIn: z.string().optional(), checkOut: z.string().optional(), notes: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
const tenantId = getTenantId(ctx); const { id, dealId, checkIn, checkOut, ...data } = input;
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
      delete: tenantWriteProcedure
        .input(z.object({ id: z.number(), dealId: z.number(), productName: z.string() }))
        .mutation(async ({ ctx, input }) => {
          await crm.deleteDealProduct(getTenantId(ctx), input.id);
          await crm.createDealHistory({
            tenantId: getTenantId(ctx), dealId: input.dealId, action: "product_removed",
            description: `Produto "${input.productName}" removido do orçamento`,
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          // Recalcular valor total da negociação
          await crm.recalcDealValue(getTenantId(ctx), input.dealId);
          return { success: true };
        }),
    }),

    // ─── DEAL HISTORY ───
    history: router({
      list: tenantProcedure
        .input(z.object({ dealId: z.number() }))
        .query(async ({ input, ctx }) => {
          return crm.listDealHistory(getTenantId(ctx), input.dealId);
        }),
    }),

    /** Unified timeline: deal_history + wa_messages + notes + conversions */
    timeline: tenantProcedure
      .input(z.object({
        dealId: z.number(),
        categories: z.array(z.string()).optional(),
        limit: z.number().min(1).max(200).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        includeWhatsApp: z.boolean().optional().default(true),
      }))
      .query(async ({ input, ctx }) => {
        const result = await crm.getDealTimeline(getTenantId(ctx), input.dealId, {
          categories: input.categories,
          limit: input.limit,
          offset: input.offset,
          includeWhatsApp: input.includeWhatsApp,
        });

        // Merge notes from crm_notes that DON'T already have a matching deal_history entry.
        // crm.notes.create (manual notes) writes BOTH crm_notes + deal_history, so those are already
        // in the timeline via deal_history. But importConversationAsNote and other flows may create
        // crm_notes entries whose deal_history counterpart has NO noteId in metadataJson, so we
        // need to include those.
        if (!input.categories || input.categories.length === 0 || input.categories.includes('note')) {
          const notes = await crm.listNotes(getTenantId(ctx), 'deal', input.dealId);
          // Collect noteIds already referenced in deal_history events
          const existingNoteIds = new Set<number>();
          for (const ev of result.events) {
            const meta = ev.metadataJson as any;
            if (meta?.noteId) existingNoteIds.add(Number(meta.noteId));
          }
          // Only add notes not already present via deal_history
          notes.forEach((n: any) => {
            if (existingNoteIds.has(n.id)) return; // skip duplicates
            result.events.push({
              id: `note-${n.id}`,
              type: 'note',
              action: 'note',
              description: n.body,
              actorName: n.createdByName || 'Anotação',
              actorUserId: n.createdBy,
              eventCategory: 'note',
              eventSource: 'user',
              metadataJson: { noteId: n.id },
              occurredAt: n.createdAt,
              createdAt: n.createdAt,
            });
          });
        }

        // Also merge conversion events if no category filter or 'conversion' is in categories
        if (!input.categories || input.categories.length === 0 || input.categories.includes('conversion')) {
          try {
            const { contactConversionEvents } = await import("../../drizzle/schema");
            const { eq, and: andOp, desc: descOp } = await import("drizzle-orm");
            const { getDb } = await import("../db");
            const db = await getDb();
            if (db) {
              const convEvents = await db.select()
                .from(contactConversionEvents)
                .where(andOp(
                  eq(contactConversionEvents.tenantId, getTenantId(ctx)),
                  eq(contactConversionEvents.dealId, input.dealId),
                ))
                .orderBy(descOp(contactConversionEvents.receivedAt))
                .limit(50);
              convEvents.forEach((ce: any) => {
                result.events.push({
                  id: `conv-${ce.id}`,
                  type: 'conversion',
                  action: 'conversion',
                  description: ce.conversionIdentifier || ce.source || 'Convers\u00e3o',
                  actorName: ce.source || 'Sistema',
                  eventCategory: 'conversion',
                  eventSource: ce.source || 'webhook',
                  metadataJson: {
                    conversionIdentifier: ce.conversionIdentifier,
                    source: ce.source,
                    utmSource: ce.utmSource,
                    utmMedium: ce.utmMedium,
                    utmCampaign: ce.utmCampaign,
                    utmContent: ce.utmContent,
                    utmTerm: ce.utmTerm,
                    customFields: ce.customFields,
                  },
                  occurredAt: ce.receivedAt || ce.createdAt,
                  createdAt: ce.createdAt,
                });
              });
            }
          } catch (e) { /* ignore if table doesn't exist */ }
        }

        // Re-sort after merging all sources
        result.events.sort((a: any, b: any) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
        result.total = result.events.length;
        // Apply limit
        result.events = result.events.slice(0, input.limit);
        result.hasMore = result.total > input.limit;
        return result;
      }),

    // ─── DEAL CONVERSION EVENTS ───
    conversionEvents: tenantProcedure
      .input(z.object({ dealId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { contactConversionEvents } = await import("../../drizzle/schema");
        const { eq, and, desc } = await import("drizzle-orm");
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) return [];
        return db.select()
          .from(contactConversionEvents)
          .where(and(
            eq(contactConversionEvents.tenantId, getTenantId(ctx)),
            eq(contactConversionEvents.dealId, input.dealId),
          ))
          .orderBy(desc(contactConversionEvents.receivedAt));
      }),

    // ─── BULK ACTIONS ───
    bulkActions: router({
      /** Resolve selection and return count for confirmation */
      resolveCount: tenantProcedure
        .input(z.object({
          selectedIds: z.array(z.number()).optional(),
          allMatchingFilter: z.boolean().optional(),
          exclusionIds: z.array(z.number()).optional(),
          filterSnapshot: z.object({
            pipelineId: z.number().optional(),
            stageId: z.number().optional(),
            status: z.string().optional(),
            titleSearch: z.string().optional(),
            accountId: z.number().optional(),
            leadSource: z.string().optional(),
            ownerUserId: z.number().optional(),
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
            valueMin: z.number().optional(),
            valueMax: z.number().optional(),
          }).optional(),
        }))
        .query(async ({ ctx, input }) => {
          const isAdmin = ctx.saasUser?.role === "admin";
          const bCtx: bulkDealService.BulkActionContext = {
            tenantId: getTenantId(ctx), userId: ctx.user.id,
            userName: ctx.user.name || "Sistema", isAdmin,
            saasUserId: ctx.saasUser?.userId,
          };
          const ids = await bulkDealService.resolveSelection(input, bCtx);
          return { count: ids.length };
        }),

      transfer: tenantWriteProcedure
        .input(z.object({
          selectedIds: z.array(z.number()).optional(),
          allMatchingFilter: z.boolean().optional(),
          exclusionIds: z.array(z.number()).optional(),
          filterSnapshot: z.object({
            pipelineId: z.number().optional(), stageId: z.number().optional(),
            status: z.string().optional(), titleSearch: z.string().optional(),
            ownerUserId: z.number().optional(),
          }).optional(),
          newOwnerUserId: z.number(),
        }))
        .mutation(async ({ ctx, input }) => {
          const isAdmin = ctx.saasUser?.role === "admin";
          const bCtx: bulkDealService.BulkActionContext = {
            tenantId: getTenantId(ctx), userId: ctx.user.id,
            userName: ctx.user.name || "Sistema", isAdmin,
            saasUserId: ctx.saasUser?.userId,
          };
          const ids = await bulkDealService.resolveSelection(input, bCtx);
          if (ids.length === 0) return { success: true, totalSelected: 0, totalProcessed: 0, totalSkipped: 0, errors: [] };
          return bulkDealService.bulkTransfer(ids, input.newOwnerUserId, bCtx);
        }),

      changeStatus: tenantWriteProcedure
        .input(z.object({
          selectedIds: z.array(z.number()).optional(),
          allMatchingFilter: z.boolean().optional(),
          exclusionIds: z.array(z.number()).optional(),
          filterSnapshot: z.object({
            pipelineId: z.number().optional(), stageId: z.number().optional(),
            status: z.string().optional(), ownerUserId: z.number().optional(),
          }).optional(),
          newStatus: z.enum(["open", "won", "lost"]),
          lossReasonId: z.number().optional(),
          lossNotes: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const isAdmin = ctx.saasUser?.role === "admin";
          const bCtx: bulkDealService.BulkActionContext = {
            tenantId: getTenantId(ctx), userId: ctx.user.id,
            userName: ctx.user.name || "Sistema", isAdmin,
            saasUserId: ctx.saasUser?.userId,
          };
          const ids = await bulkDealService.resolveSelection(input, bCtx);
          if (ids.length === 0) return { success: true, totalSelected: 0, totalProcessed: 0, totalSkipped: 0, errors: [] };
          return bulkDealService.bulkChangeStatus(ids, input.newStatus, input.lossReasonId, input.lossNotes, bCtx);
        }),

      moveStage: tenantWriteProcedure
        .input(z.object({
          selectedIds: z.array(z.number()).optional(),
          allMatchingFilter: z.boolean().optional(),
          exclusionIds: z.array(z.number()).optional(),
          filterSnapshot: z.object({
            pipelineId: z.number().optional(), stageId: z.number().optional(),
            status: z.string().optional(), ownerUserId: z.number().optional(),
          }).optional(),
          toStageId: z.number(),
          toStageName: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
          const isAdmin = ctx.saasUser?.role === "admin";
          const bCtx: bulkDealService.BulkActionContext = {
            tenantId: getTenantId(ctx), userId: ctx.user.id,
            userName: ctx.user.name || "Sistema", isAdmin,
            saasUserId: ctx.saasUser?.userId,
          };
          const ids = await bulkDealService.resolveSelection(input, bCtx);
          if (ids.length === 0) return { success: true, totalSelected: 0, totalProcessed: 0, totalSkipped: 0, errors: [] };
          return bulkDealService.bulkMoveStage(ids, input.toStageId, input.toStageName, bCtx);
        }),

      updateFields: tenantWriteProcedure
        .input(z.object({
          selectedIds: z.array(z.number()).optional(),
          allMatchingFilter: z.boolean().optional(),
          exclusionIds: z.array(z.number()).optional(),
          filterSnapshot: z.object({
            pipelineId: z.number().optional(), stageId: z.number().optional(),
            status: z.string().optional(), ownerUserId: z.number().optional(),
          }).optional(),
          fields: z.object({
            leadSource: z.string().optional(),
            channelOrigin: z.string().optional(),
            accountId: z.number().nullable().optional(),
          }),
        }))
        .mutation(async ({ ctx, input }) => {
          const isAdmin = ctx.saasUser?.role === "admin";
          const bCtx: bulkDealService.BulkActionContext = {
            tenantId: getTenantId(ctx), userId: ctx.user.id,
            userName: ctx.user.name || "Sistema", isAdmin,
            saasUserId: ctx.saasUser?.userId,
          };
          const ids = await bulkDealService.resolveSelection(input, bCtx);
          if (ids.length === 0) return { success: true, totalSelected: 0, totalProcessed: 0, totalSkipped: 0, errors: [] };
          return bulkDealService.bulkUpdateFields(ids, input.fields, bCtx);
        }),

      createTask: tenantWriteProcedure
        .input(z.object({
          selectedIds: z.array(z.number()).optional(),
          allMatchingFilter: z.boolean().optional(),
          exclusionIds: z.array(z.number()).optional(),
          filterSnapshot: z.object({
            pipelineId: z.number().optional(), stageId: z.number().optional(),
            status: z.string().optional(), ownerUserId: z.number().optional(),
          }).optional(),
          title: z.string().min(1),
          taskType: z.string().optional(),
          dueAt: z.string().optional(),
          priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
          description: z.string().optional(),
          assignToOwner: z.boolean().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const isAdmin = ctx.saasUser?.role === "admin";
          const bCtx: bulkDealService.BulkActionContext = {
            tenantId: getTenantId(ctx), userId: ctx.user.id,
            userName: ctx.user.name || "Sistema", isAdmin,
            saasUserId: ctx.saasUser?.userId,
          };
          const ids = await bulkDealService.resolveSelection(input, bCtx);
          if (ids.length === 0) return { success: true, totalSelected: 0, totalProcessed: 0, totalSkipped: 0, errors: [] };
          return bulkDealService.bulkCreateTask(ids, {
            title: input.title,
            taskType: input.taskType,
            dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
            priority: input.priority,
            description: input.description,
            assignToOwner: input.assignToOwner,
          }, bCtx);
        }),

      export: tenantProcedure
        .input(z.object({
          selectedIds: z.array(z.number()).optional(),
          allMatchingFilter: z.boolean().optional(),
          exclusionIds: z.array(z.number()).optional(),
          filterSnapshot: z.object({
            pipelineId: z.number().optional(), stageId: z.number().optional(),
            status: z.string().optional(), ownerUserId: z.number().optional(),
          }).optional(),
        }))
        .query(async ({ ctx, input }) => {
          const isAdmin = ctx.saasUser?.role === "admin";
          const bCtx: bulkDealService.BulkActionContext = {
            tenantId: getTenantId(ctx), userId: ctx.user.id,
            userName: ctx.user.name || "Sistema", isAdmin,
            saasUserId: ctx.saasUser?.userId,
          };
          const ids = await bulkDealService.resolveSelection(input, bCtx);
          if (ids.length === 0) return { deals: [], totalExported: 0 };
          return bulkDealService.bulkExport(ids, bCtx);
        }),
    }),

    // ─── DEAL PARTICIPANTS ───
    participants: router({
      list: tenantProcedure
        .input(z.object({ dealId: z.number() }))
        .query(async ({ input, ctx }) => {
          return crm.listDealParticipants(getTenantId(ctx), input.dealId);
        }),
      add: tenantWriteProcedure
        .input(z.object({
          dealId: z.number(), contactId: z.number(),
          role: z.enum(["decision_maker", "traveler", "payer", "companion", "other"]).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const result = await crm.addDealParticipant({ ...input, tenantId: getTenantId(ctx) });
          await crm.createDealHistory({
            tenantId: getTenantId(ctx), dealId: input.dealId, action: "participant_added",
            description: `Participante adicionado à negociação`,
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          return result;
        }),
      remove: tenantWriteProcedure
        .input(z.object({ id: z.number(), dealId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          await crm.removeDealParticipant(getTenantId(ctx), input.id);
          await crm.createDealHistory({
            tenantId: getTenantId(ctx), dealId: input.dealId, action: "participant_removed",
            description: `Participante removido da negociação`,
            actorUserId: ctx.user.id, actorName: ctx.user.name || "Sistema",
          });
          return { success: true };
        }),
    }),

    // ─── DEAL FILES (Repositório de Arquivos) ───
    files: router({
      list: tenantProcedure
        .input(z.object({ dealId: z.number() }))
        .query(async ({ input, ctx }) => {
          return listDealFiles(getTenantId(ctx), input.dealId);
        }),
      count: tenantProcedure
        .input(z.object({ dealId: z.number() }))
        .query(async ({ input, ctx }) => {
          return countDealFiles(getTenantId(ctx), input.dealId);
        }),
      upload: tenantWriteProcedure
        .input(z.object({
          dealId: z.number(),
          fileName: z.string(),
          fileBase64: z.string(),
          contentType: z.string(),
          sizeBytes: z.number().optional(),
          description: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const tid = getTenantId(ctx);
          const fileBuffer = Buffer.from(input.fileBase64, "base64");
          const ext = input.fileName.split(".").pop() || "bin";
          const fileKey = `deal-files/${tid}/${input.dealId}/${nanoid()}.${ext}`;
          const { url } = await storagePut(fileKey, fileBuffer, input.contentType);
          const result = await createDealFile({
            tenantId: tid,
            dealId: input.dealId,
            fileName: input.fileName,
            fileKey,
            url,
            mimeType: input.contentType,
            sizeBytes: input.sizeBytes || fileBuffer.length,
            description: input.description || null,
            uploadedBy: ctx.user.id,
          });
          return { id: result.id, url, fileName: input.fileName };
        }),
      delete: tenantWriteProcedure
        .input(z.object({ id: z.number(), dealId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          await deleteDealFile(getTenantId(ctx), input.id);
          return { success: true };
        }),
      get: tenantProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input, ctx }) => {
          return getDealFile(getTenantId(ctx), input.id);
        }),
    }),
  }),

  // ─── TRIPS ───
  trips: router({
    list: tenantProcedure
      
      .query(async ({ input, ctx }) => {
        return crm.listTrips(getTenantId(ctx));
      }),
    get: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return crm.getTripById(getTenantId(ctx), input.id);
      }),
    create: tenantWriteProcedure
      .input(z.object({
        dealId: z.number().optional(), destinationSummary: z.string().optional(),
        startDate: z.string().optional(), endDate: z.string().optional(), ownerUserId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createTrip({ ...input, tenantId: getTenantId(ctx), startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          createdBy: ctx.user.id,
        });
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "trip", entityId: result?.id, action: "create" });
        return result;
      }),
  }),

  // ─── TASKS ───
  tasks: router({
    list: tenantProcedure
      .input(z.object({
        entityType: z.string().optional(),
        entityId: z.number().optional(),
        status: z.string().optional(),
        taskType: z.string().optional(),
        assigneeUserId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        // Non-admin users only see tasks they created or are assigned to
        const isAdmin = ctx.saasUser?.role === "admin";
        const createdByUserId = isAdmin ? undefined : ctx.saasUser?.userId;
        return crm.listTasksEnriched(getTenantId(ctx), { ...input, createdByUserId });
      }),
    create: tenantWriteProcedure
      .input(z.object({
        entityType: z.string(), entityId: z.number(), title: z.string().min(1),
        taskType: z.string().optional(),
        dueAt: z.string().optional(), assignedToUserId: z.number().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        description: z.string().optional(),
        markAsDone: z.boolean().optional(),
        assigneeUserIds: z.array(z.number()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { markAsDone, assigneeUserIds, ...taskInput } = input;
        const result = await crm.createTask({
          ...taskInput,
          tenantId: getTenantId(ctx),
          dueAt: taskInput.dueAt ? new Date(taskInput.dueAt) : undefined,
          createdByUserId: ctx.user.id,
        });
        // Mark as done if requested
        if (markAsDone && result?.id) {
          await crm.updateTask(getTenantId(ctx), result.id, { status: "done" });
        }
        // Add assignees
        if (result?.id && assigneeUserIds && assigneeUserIds.length > 0) {
          for (const userId of assigneeUserIds) {
            await crm.addTaskAssignee(result.id, userId, getTenantId(ctx));
          }
        }
        // Auto-sync to Google Calendar (fire-and-forget)
        if (result?.id && taskInput.dueAt) {
          import("../googleCalendarSync").then(async ({ syncTaskToCalendar }) => {
            try {
              const syncResult = await syncTaskToCalendar({
                id: result.id!,
                title: input.title,
                description: input.description,
                dueAt: taskInput.dueAt,
                priority: input.priority,
                status: markAsDone ? "done" : "pending",
                entityType: input.entityType,
                entityId: input.entityId,
              });
              if (syncResult.synced && syncResult.eventId) {
                const { getDb } = await import("../db");
                const { tasks } = await import("../../drizzle/schema");
                const { eq } = await import("drizzle-orm");
                const db = await getDb();
                if (db) {
                  await db.update(tasks).set({
                    googleEventId: syncResult.eventId,
                    googleCalendarSynced: true,
                  }).where(eq(tasks.id, result.id!));
                }
                console.log(`[GCal AutoSync] Task ${result.id} synced, eventId: ${syncResult.eventId}`);
              }
            } catch (e) {
              console.error(`[GCal AutoSync] Failed for task ${result?.id}:`, e);
            }
          });
        }
        // In-app notification
        await createNotification(getTenantId(ctx), {
          type: "task_created",
          title: `Nova tarefa: ${input.title}`,
          body: input.dueAt ? `Vencimento: ${new Date(input.dueAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : undefined,
          entityType: "task",
          entityId: String(result?.id),
        });
        // Log task creation in deal timeline
        if (input.entityType === "deal" && input.entityId) {
          await crm.createDealHistory({
            tenantId: getTenantId(ctx), dealId: input.entityId,
            action: "task_created", description: `Tarefa criada: ${input.title}`,
            actorUserId: ctx.user.id, actorName: ctx.saasUser?.name || ctx.user.name || undefined,
            eventCategory: "task", eventSource: "user",
            metadataJson: { taskId: result?.id, taskTitle: input.title, taskType: input.taskType, priority: input.priority, dueAt: input.dueAt },
          });
        }
        return result;
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(), title: z.string().optional(),
        status: z.enum(["pending", "in_progress", "done", "cancelled"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        taskType: z.string().optional(),
        dueAt: z.string().optional(), assignedToUserId: z.number().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
const tenantId = getTenantId(ctx); const { id, dueAt, ...data } = input;
        // Get task before update for timeline logging
        const taskBefore = await crm.getTaskById(tenantId, id);
        await crm.updateTask(tenantId, id, { ...data, dueAt: dueAt ? new Date(dueAt) : undefined });
        // Log task update in deal timeline
        if (taskBefore && taskBefore.entityType === "deal" && taskBefore.entityId) {
          let action = "task_edited";
          let description = `Tarefa editada: ${taskBefore.title}`;
          if (input.status === "done") { action = "task_completed"; description = `Tarefa conclu\u00edda: ${taskBefore.title}`; }
          else if (input.status === "cancelled") { action = "task_cancelled"; description = `Tarefa cancelada: ${taskBefore.title}`; }
          else if (input.status === "pending" && taskBefore.status !== "pending") { action = "task_reopened"; description = `Tarefa reaberta: ${taskBefore.title}`; }
          else if (input.dueAt && taskBefore.dueAt && new Date(input.dueAt).getTime() !== new Date(taskBefore.dueAt).getTime()) { action = "task_postponed"; description = `Tarefa adiada: ${taskBefore.title}`; }
          await crm.createDealHistory({
            tenantId, dealId: taskBefore.entityId,
            action, description,
            actorUserId: ctx.user.id, actorName: ctx.saasUser?.name || ctx.user.name || undefined,
            eventCategory: "task", eventSource: "user",
            metadataJson: { taskId: id, taskTitle: taskBefore.title, oldStatus: taskBefore.status, newStatus: input.status, oldDueAt: taskBefore.dueAt, newDueAt: input.dueAt },
          });
        }

        // Auto-sync to Google Calendar (fire-and-forget)
        import("../googleCalendarSync").then(async (gcSync) => {
          try {
            const { getDb } = await import("../db");
            const { tasks } = await import("../../drizzle/schema");
            const { eq, and } = await import("drizzle-orm");
            const db = await getDb();
            if (!db) return;
            const [task] = await db.select().from(tasks)
              .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)))
              .limit(1);
            if (!task) return;

            // If task is done/cancelled, mark in calendar
            if (input.status === "done" || input.status === "cancelled") {
              await gcSync.markTaskCompletedInCalendar({
                id: task.id,
                title: task.title,
                googleEventId: task.googleEventId,
                status: input.status,
              });
            } else if (task.googleEventId) {
              // Update existing event
              await gcSync.syncTaskToCalendar(task);
            } else if (task.dueAt) {
              // Create new event for task that now has a due date
              const result = await gcSync.syncTaskToCalendar(task);
              if (result.synced && result.eventId) {
                await db.update(tasks).set({
                  googleEventId: result.eventId,
                  googleCalendarSynced: true,
                }).where(eq(tasks.id, id));
              }
            }
          } catch (e) {
            console.error(`[GCal AutoSync] Failed for task update ${id}:`, e);
          }
        });

        return { success: true };
      }),
    addAssignee: tenantWriteProcedure
      .input(z.object({ taskId: z.number(), userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await crm.addTaskAssignee(input.taskId, input.userId, getTenantId(ctx));
        return { success: true };
      }),
    removeAssignee: tenantWriteProcedure
      .input(z.object({ taskId: z.number(), userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await crm.removeTaskAssignee(input.taskId, input.userId, getTenantId(ctx));
        return { success: true };
      }),
    overdueSummary: tenantProcedure
      .input(z.object({ dealIds: z.array(z.number()).optional() }))
      .query(async ({ input, ctx }) => {
        return crm.getOverdueTasksByDeal(getTenantId(ctx), input.dealIds);
      }),
    pendingCounts: tenantProcedure
      
      .query(async ({ input, ctx }) => {
        return crm.getPendingTaskCountsByDeal(getTenantId(ctx));
      }),
    // ── Scheduled WhatsApp Send ──
    scheduledWhatsApp: router({
      create: tenantWriteProcedure
        .input(z.object({
          entityType: z.string(),
          entityId: z.number(),
          contactId: z.number(),
          dealId: z.number().optional(),
          messageBody: z.string().min(1),
          scheduledAt: z.string(),
          timezone: z.string().default("America/Sao_Paulo"),
          channelId: z.number().optional(),
          assignedToUserId: z.number().optional(),
          priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
          title: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { createScheduledWhatsApp } = await import("../services/scheduledWhatsAppService");
          return createScheduledWhatsApp({
            ...input,
            tenantId: getTenantId(ctx),
            createdByUserId: ctx.user.id,
          });
        }),
      cancel: tenantWriteProcedure
        .input(z.object({ taskId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const { cancelScheduledWhatsApp } = await import("../services/scheduledWhatsAppService");
          return cancelScheduledWhatsApp(input.taskId, getTenantId(ctx), ctx.user.id);
        }),
      reschedule: tenantWriteProcedure
        .input(z.object({
          taskId: z.number(),
          scheduledAt: z.string(),
          timezone: z.string().optional(),
          messageBody: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { rescheduleWhatsApp } = await import("../services/scheduledWhatsAppService");
          return rescheduleWhatsApp({ ...input, tenantId: getTenantId(ctx) }, ctx.user.id);
        }),
      retry: tenantWriteProcedure
        .input(z.object({ taskId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const { retryScheduledWhatsApp } = await import("../services/scheduledWhatsAppService");
          return retryScheduledWhatsApp(input.taskId, getTenantId(ctx), ctx.user.id);
        }),
    }),
  }),

  // ─── NOTES ───
  notes: router({
    list: tenantProcedure
      .input(z.object({ entityType: z.string(), entityId: z.number() }))
      .query(async ({ input, ctx }) => {
        return crm.listNotes(getTenantId(ctx), input.entityType, input.entityId);
      }),
    create: tenantWriteProcedure
      .input(z.object({ entityType: z.string(), entityId: z.number(), body: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createNote({ ...input, tenantId: getTenantId(ctx), createdByUserId: ctx.user.id });
        // Log note creation in deal timeline
        if (input.entityType === "deal" && input.entityId) {
          await crm.createDealHistory({
            tenantId: getTenantId(ctx), dealId: input.entityId,
            action: "note", description: input.body.substring(0, 200),
            actorUserId: ctx.user.id, actorName: ctx.saasUser?.name || ctx.user.name || undefined,
            eventCategory: "note", eventSource: "user",
            metadataJson: { noteId: result?.id },
          });
        }
        return result;
      }),
  }),

  // ─── WHATSAPP MESSAGES BY DEAL ───
  dealWhatsApp: router({
    messages: tenantProcedure
      .input(z.object({ dealId: z.number(), limit: z.number().optional(), beforeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        return crm.getWhatsAppMessagesByDeal(input.dealId, getTenantId(ctx), { limit: input.limit, beforeId: input.beforeId });
      }),
    count: tenantProcedure
      .input(z.object({ dealId: z.number(), }))
      .query(async ({ input, ctx }) => {
        return crm.countWhatsAppMessagesByDeal(input.dealId, getTenantId(ctx));
      }),
    unreadByContact: tenantProcedure
      
      .query(async ({ input, ctx }) => {
        return crm.getWhatsAppUnreadByContact(getTenantId(ctx));
      }),
  }),

  // ─── LEAD SOURCES ───
  leadSources: router({
    list: tenantProcedure
      .input(z.object({ includeDeleted: z.boolean().optional() }))
      .query(async ({ input, ctx }) => {
        return crm.listLeadSources(getTenantId(ctx), input.includeDeleted);
      }),
    create: tenantWriteProcedure
      .input(z.object({ name: z.string().min(1), color: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createLeadSource({ ...input, tenantId: getTenantId(ctx) });
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "lead_source", entityId: result?.id, action: "create" });
        return result;
      }),
    update: tenantWriteProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).optional(), color: z.string().optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        return crm.updateLeadSource(id, data);
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return crm.softDeleteLeadSource(input.id);
      }),
    restore: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return crm.restoreLeadSource(input.id);
      }),
    hardDelete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return crm.hardDeleteLeadSource(input.id);
      }),
  }),

  // ─── CAMPAIGNS ───
  campaigns: router({
    list: tenantProcedure
      .input(z.object({ sourceId: z.number().optional(), includeDeleted: z.boolean().optional() }))
      .query(async ({ input, ctx }) => {
        return crm.listCampaigns(getTenantId(ctx), input.sourceId, input.includeDeleted);
      }),
    create: tenantWriteProcedure
      .input(z.object({ sourceId: z.number().optional(), name: z.string().min(1), color: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createCampaign({ ...input, tenantId: getTenantId(ctx) });
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "campaign", entityId: result?.id, action: "create" });
        return result;
      }),
    update: tenantWriteProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).optional(), color: z.string().optional(), sourceId: z.number().nullish(), isActive: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        return crm.updateCampaign(id, data);
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return crm.softDeleteCampaign(input.id);
      }),
    restore: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return crm.restoreCampaign(input.id);
      }),
    hardDelete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return crm.hardDeleteCampaign(input.id);
      }),
  }),

  // ─── LOSS REASONS ───
  lossReasons: router({
    list: tenantProcedure
      .input(z.object({ includeDeleted: z.boolean().optional() }))
      .query(async ({ input, ctx }) => {
        return crm.listLossReasons(getTenantId(ctx), input.includeDeleted);
      }),
    create: tenantWriteProcedure
      .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createLossReason({ ...input, tenantId: getTenantId(ctx) });
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "loss_reason", entityId: result?.id, action: "create" });
        return result;
      }),
    update: tenantWriteProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).optional(), description: z.string().optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        return crm.updateLossReason(id, data);
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return crm.softDeleteLossReason(input.id);
      }),
    restore: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return crm.restoreLossReason(input.id);
      }),
    hardDelete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return crm.hardDeleteLossReason(input.id);
      }),
  }),
  // ─── CLASSIFICATION ENGINE ───
  classification: router({
    getConfig: tenantProcedure
      
      .query(async () => {
        const { STAGE_CLASSIFICATIONS, CLASSIFICATION_CONFIG } = await import("../classificationEngine");
        return { classifications: STAGE_CLASSIFICATIONS, config: CLASSIFICATION_CONFIG };
      }),
    getSettings: tenantProcedure
      
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { inactivityDays: 360, referralWindowDays: 90, autoClassifyOnMove: true, autoClassifyOnWon: true, autoClassifyOnLost: true, autoCreatePostSaleDeal: true };
        const rows = await db.select({ settingsJson: tenants.settingsJson }).from(tenants).where(eq(tenants.id, getTenantId(ctx))).limit(1);
        const settings = (rows[0]?.settingsJson as any) || {};
        const cls = settings.classificationEngine || {};
        return {
          inactivityDays: cls.inactivityDays ?? 360,
          referralWindowDays: cls.referralWindowDays ?? 90,
          autoClassifyOnMove: cls.autoClassifyOnMove ?? true,
          autoClassifyOnWon: cls.autoClassifyOnWon ?? true,
          autoClassifyOnLost: cls.autoClassifyOnLost ?? true,
          autoCreatePostSaleDeal: cls.autoCreatePostSaleDeal ?? true,
        };
      }),
    saveSettings: tenantWriteProcedure
      .input(z.object({
        inactivityDays: z.number().min(30).max(3650),
        referralWindowDays: z.number().min(7).max(365),
        autoClassifyOnMove: z.boolean(),
        autoClassifyOnWon: z.boolean(),
        autoClassifyOnLost: z.boolean(),
        autoCreatePostSaleDeal: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { success: false };
        const rows = await db.select({ settingsJson: tenants.settingsJson }).from(tenants).where(eq(tenants.id, getTenantId(ctx))).limit(1);
        const currentSettings = (rows[0]?.settingsJson as any) || {};
        currentSettings.classificationEngine = {
          inactivityDays: input.inactivityDays,
          referralWindowDays: input.referralWindowDays,
          autoClassifyOnMove: input.autoClassifyOnMove,
          autoClassifyOnWon: input.autoClassifyOnWon,
          autoClassifyOnLost: input.autoClassifyOnLost,
          autoCreatePostSaleDeal: input.autoCreatePostSaleDeal,
        };
        await db.update(tenants).set({ settingsJson: currentSettings }).where(eq(tenants.id, getTenantId(ctx)));
        return { success: true };
      }),
    updateContact: tenantWriteProcedure
      .input(z.object({ contactId: z.number(), classification: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const { updateContactClassification } = await import("../classificationEngine");
        await updateContactClassification(getTenantId(ctx), input.contactId, input.classification as any);
        return { success: true };
      }),
    confirmReferral: tenantWriteProcedure
      .input(z.object({ referrerContactId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { onReferralConfirmed } = await import("../classificationEngine");
        await onReferralConfirmed(getTenantId(ctx), input.referrerContactId);
        return { success: true };
      }),
    processInactive: tenantWriteProcedure
      .input(z.object({ inactivityDays: z.number().default(360) }))
      .mutation(async ({ input, ctx }) => {
        const { processInactiveClients, processReferralWindows } = await import("../classificationEngine");
        await processInactiveClients(getTenantId(ctx), input.inactivityDays);
        await processReferralWindows(getTenantId(ctx));
        return { success: true };
      }),
    seedDefaultPipelines: tenantWriteProcedure
      
      .mutation(async ({ input, ctx }) => {
        const { createDefaultPipelines } = await import("../classificationEngine");
        const result = await createDefaultPipelines(getTenantId(ctx));
        return result;
      }),
  }),

  // ─── TASK AUTOMATIONS ───
  taskAutomations: router({
    list: tenantProcedure
      .input(z.object({ pipelineId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const { assertFeatureAccess } = await import("../services/planLimitsService");
        await assertFeatureAccess(getTenantId(ctx), "salesAutomation");
        return crm.listTaskAutomations(getTenantId(ctx), input.pipelineId);
      }),
    create: tenantWriteProcedure
      .input(z.object({
        pipelineId: z.number(),
        stageId: z.number(),
        taskTitle: z.string().min(1),
        taskDescription: z.string().optional(),
        taskType: z.enum(["whatsapp", "phone", "email", "video", "task"]).default("task"),
        deadlineReference: z.enum(["current_date", "boarding_date", "return_date"]).default("current_date"),
        deadlineOffsetDays: z.number().default(0),
        deadlineOffsetUnit: z.enum(["minutes", "hours", "days"]).default("days"),
        deadlineTime: z.string().default("09:00"),
        assignToOwner: z.boolean().default(true),
        assignToUserIds: z.array(z.number()).optional(),
        waMessageTemplate: z.string().nullable().optional(),
        isActive: z.boolean().default(true),
        orderIndex: z.number().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        return crm.createTaskAutomation({ ...input, tenantId: getTenantId(ctx) });
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(),
        taskTitle: z.string().min(1).optional(),
        taskDescription: z.string().nullable().optional(),
        taskType: z.enum(["whatsapp", "phone", "email", "video", "task"]).optional(),
        deadlineReference: z.enum(["current_date", "boarding_date", "return_date"]).optional(),
        deadlineOffsetDays: z.number().optional(),
        deadlineOffsetUnit: z.enum(["minutes", "hours", "days"]).optional(),
        deadlineTime: z.string().optional(),
        assignToOwner: z.boolean().optional(),
        assignToUserIds: z.array(z.number()).nullable().optional(),
        waMessageTemplate: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        orderIndex: z.number().optional(),
        stageId: z.number().optional(),
        pipelineId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        return crm.updateTaskAutomation(id, getTenantId(ctx), data);
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number(), }))
      .mutation(async ({ input, ctx }) => {
        return crm.deleteTaskAutomation(input.id, getTenantId(ctx));
      }),
  }),

  // ─── DATE-BASED AUTOMATIONS ───
  dateAutomations: router({
    list: tenantProcedure
      .input(z.object({ pipelineId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const { assertFeatureAccess } = await import("../services/planLimitsService");
        await assertFeatureAccess(getTenantId(ctx), "salesAutomation");
        return crm.listDateAutomations(getTenantId(ctx), input.pipelineId);
      }),
    create: tenantWriteProcedure
      .input(z.object({
        name: z.string().min(1), description: z.string().optional(),
        pipelineId: z.number(),
        dateField: z.enum(["boardingDate", "returnDate", "expectedCloseAt", "createdAt"]),
        condition: z.enum(["days_before", "days_after", "on_date"]),
        offsetDays: z.number().min(0).default(0),
        sourceStageId: z.number().optional(),
        targetStageId: z.number(),
        dealStatusFilter: z.enum(["open", "won", "lost"]).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return crm.createDateAutomation({ ...input, tenantId: getTenantId(ctx) });
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(), description: z.string().optional(),
        dateField: z.enum(["boardingDate", "returnDate", "expectedCloseAt", "createdAt"]).optional(),
        condition: z.enum(["days_before", "days_after", "on_date"]).optional(),
        offsetDays: z.number().min(0).optional(),
        sourceStageId: z.number().nullable().optional(),
        targetStageId: z.number().optional(),
        dealStatusFilter: z.enum(["open", "won", "lost"]).nullable().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        return crm.updateDateAutomation(tenantId, id, data);
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return crm.deleteDateAutomation(getTenantId(ctx), input.id);
      }),
    runNow: tenantWriteProcedure
      
      .mutation(async ({ input, ctx }) => {
        const { runDateAutomationsForTenant } = await import("../dateAutomationScheduler");
        return runDateAutomationsForTenant(getTenantId(ctx));
      }),
  }),

  // ─── STAGE OWNER RULES (Mudar responsável ao mover etapa) ───
  stageOwnerRules: router({
    list: tenantProcedure
      .input(z.object({ pipelineId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const { assertFeatureAccess } = await import("../services/planLimitsService");
        await assertFeatureAccess(getTenantId(ctx), "salesAutomation");
        return crm.listStageOwnerRules(getTenantId(ctx), input.pipelineId);
      }),
    create: tenantWriteProcedure
      .input(z.object({
        pipelineId: z.number(),
        stageId: z.number(),
        assignToUserId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await crm.createStageOwnerRule({ ...input, tenantId: getTenantId(ctx) });
        return { id };
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(),
        assignToUserId: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await crm.updateStageOwnerRule(getTenantId(ctx), id, data);
        return { success: true };
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await crm.deleteStageOwnerRule(getTenantId(ctx), input.id);
        return { success: true };
      }),
  }),
});
