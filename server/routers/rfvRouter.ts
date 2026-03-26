/**
 * RFV Router — tRPC endpoints for Matriz RFV + Campaign Registry
 */
import { z } from "zod";
import { tenantProcedure, tenantWriteProcedure, getTenantId, sessionTenantProcedure, sessionTenantWriteProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getRfvContacts,
  getRfvDashboard,
  getAlertaDinheiroParado,
  recalculateRfvFromDeals,
  importCsvAndRecalculate,
  resetAgencyRfvData,
  getSmartFilterCounts,
  AUDIENCE_TYPES,
  SMART_FILTERS,
  SMART_FILTER_CONFIG,
} from "../rfv";
import {
  startBulkSend,
  getBulkSendProgress,
  cancelBulkSend,
  getActiveSessionForTenant,
  listCampaigns,
  getCampaignDetail,
  getCampaignMessages,
} from "../bulkMessage";
import {
  runRfvNotificationCheck,
  getRfvFilterSnapshots,
} from "../rfvNotifications";

export const rfvRouter = router({
  // ─── Dashboard KPIs ───
  dashboard: tenantProcedure
    
    .query(async ({ input, ctx }) => {
      const { assertFeatureAccess } = await import("../services/planLimitsService");
      await assertFeatureAccess(getTenantId(ctx), "rfvEnabled");
      return getRfvDashboard(getTenantId(ctx));
    }),

  // ─── List contacts with pagination, search, filters ───
  list: tenantProcedure
    .input(z.object({
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(50),
      search: z.string().optional(),
      audienceType: z.string().optional(),
      smartFilter: z.string().optional(),
      sortBy: z.string().optional(),
      sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
    }))
    .query(async ({ input, ctx }) => {
      const { assertFeatureAccess } = await import("../services/planLimitsService");
      await assertFeatureAccess(getTenantId(ctx), "rfvEnabled");
      return getRfvContacts(getTenantId(ctx), {
        page: input.page,
        pageSize: input.pageSize,
        search: input.search,
        audienceType: input.audienceType,
        smartFilter: input.smartFilter,
        sortBy: input.sortBy,
        sortDir: input.sortDir,
      });
    }),

  // ─── Smart Filter Counts ───
  smartFilterCounts: tenantProcedure
    
    .query(async ({ input, ctx }) => {
      return getSmartFilterCounts(getTenantId(ctx));
    }),

  // ─── Smart Filter Config ───
  smartFilterConfig: tenantProcedure
    .query(() => {
      return { filters: SMART_FILTERS, config: SMART_FILTER_CONFIG };
    }),

  // ─── Alerta Dinheiro Parado ───
  alertaDinheiroParado: tenantProcedure
    
    .query(async ({ input, ctx }) => {
      return getAlertaDinheiroParado(getTenantId(ctx));
    }),

  // ─── Recalculate RFV from existing deals ───
  recalculate: tenantWriteProcedure
    
    .mutation(async ({ input, ctx }) => {
      return recalculateRfvFromDeals(getTenantId(ctx));
    }),

  // ─── Import CSV ───
  importCsv: tenantWriteProcedure
    .input(z.object({
      csvText: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      return importCsvAndRecalculate(getTenantId(ctx), input.csvText, userId);
    }),

  // ─── Reset agency RFV data ───
  resetData: tenantWriteProcedure
    
    .mutation(async ({ input, ctx }) => {
      return resetAgencyRfvData(getTenantId(ctx));
    }),

  // ─── Get audience types ───
  audienceTypes: tenantProcedure
    .query(() => {
      return AUDIENCE_TYPES;
    }),

  // ─── Bulk Send WhatsApp Messages ───
  bulkSend: sessionTenantWriteProcedure
    .input(z.object({
      contactIds: z.array(z.number()).min(1).max(5000),
      messageTemplate: z.string().min(1).max(4096),
      sessionId: z.string().min(1),
      delayMs: z.number().min(1000).max(30000).optional(),
      randomDelay: z.boolean().optional(),
      delayMinMs: z.number().min(1000).max(30000).optional(),
      delayMaxMs: z.number().min(2000).max(60000).optional(),
      campaignName: z.string().max(255).optional(),
      audienceFilter: z.string().max(128).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return startBulkSend({
        ...input,
        tenantId: getTenantId(ctx),
        userId: ctx.user.id,
        userName: ctx.user.name || undefined,
        source: "rfv",
      });
    }),

  // ─── Get Bulk Send Progress ───
  bulkSendProgress: tenantProcedure
    
    .query(async ({ input, ctx }) => {
      return getBulkSendProgress(getTenantId(ctx));
    }),

  // ─── Cancel Bulk Send ───
  cancelBulkSend: tenantWriteProcedure
    
    .mutation(async ({ input, ctx }) => {
      const cancelled = cancelBulkSend(getTenantId(ctx));
      if (!cancelled) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum envio em andamento" });
      return { cancelled: true };
    }),

  // ─── Get Active WhatsApp Session for User ───
  activeSession: tenantProcedure
    
    .query(async ({ input, ctx }) => {
      // Use the logged-in user's CRM userId to find THEIR session, not any tenant session
      const userId = ctx.saasUser?.userId || ctx.user?.id;
      return getActiveSessionForTenant(getTenantId(ctx), userId);
    }),

  // ─── Run RFV Notification Check (manual trigger) ───
  checkNotifications: tenantWriteProcedure
    
    .mutation(async ({ input, ctx }) => {
      return runRfvNotificationCheck(getTenantId(ctx));
    }),

  // ─── Get Filter Snapshots ───
  filterSnapshots: tenantProcedure
    
    .query(async ({ input, ctx }) => {
      return getRfvFilterSnapshots(getTenantId(ctx));
    }),

  // ═══════════════════════════════════════════════════════
  // CAMPAIGN REGISTRY
  // ═══════════════════════════════════════════════════════

  // ─── List Campaigns ───
  campaigns: tenantProcedure
    .input(z.object({
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(20),
      status: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      return listCampaigns(getTenantId(ctx), {
        page: input.page,
        pageSize: input.pageSize,
        status: input.status,
      });
    }),

  // ─── Campaign Detail ───
  campaignDetail: tenantProcedure
    .input(z.object({
      campaignId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const detail = await getCampaignDetail(input.campaignId, getTenantId(ctx));
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });
      return detail;
    }),

  // ─── Campaign Messages ───
  campaignMessages: tenantProcedure
    .input(z.object({
      campaignId: z.number(),
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(50),
      status: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      return getCampaignMessages(input.campaignId, getTenantId(ctx), {
        page: input.page,
        pageSize: input.pageSize,
        status: input.status,
      });
    }),
});
