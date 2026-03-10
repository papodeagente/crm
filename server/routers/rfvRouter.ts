/**
 * RFV Router — tRPC endpoints for Matriz RFV + Campaign Registry
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
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
  dashboard: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return getRfvDashboard(input.tenantId);
    }),

  // ─── List contacts with pagination, search, filters ───
  list: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(50),
      search: z.string().optional(),
      audienceType: z.string().optional(),
      smartFilter: z.string().optional(),
      sortBy: z.string().optional(),
      sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
    }))
    .query(async ({ input }) => {
      return getRfvContacts(input.tenantId, {
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
  smartFilterCounts: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return getSmartFilterCounts(input.tenantId);
    }),

  // ─── Smart Filter Config ───
  smartFilterConfig: protectedProcedure
    .query(() => {
      return { filters: SMART_FILTERS, config: SMART_FILTER_CONFIG };
    }),

  // ─── Alerta Dinheiro Parado ───
  alertaDinheiroParado: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return getAlertaDinheiroParado(input.tenantId);
    }),

  // ─── Recalculate RFV from existing deals ───
  recalculate: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .mutation(async ({ input }) => {
      return recalculateRfvFromDeals(input.tenantId);
    }),

  // ─── Import CSV ───
  importCsv: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      csvText: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      return importCsvAndRecalculate(input.tenantId, input.csvText, userId);
    }),

  // ─── Reset agency RFV data ───
  resetData: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .mutation(async ({ input }) => {
      return resetAgencyRfvData(input.tenantId);
    }),

  // ─── Get audience types ───
  audienceTypes: protectedProcedure
    .query(() => {
      return AUDIENCE_TYPES;
    }),

  // ─── Bulk Send WhatsApp Messages ───
  bulkSend: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      contactIds: z.array(z.number()).min(1).max(5000),
      messageTemplate: z.string().min(1).max(4096),
      sessionId: z.string().min(1),
      delayMs: z.number().min(1000).max(30000).optional(),
      campaignName: z.string().max(255).optional(),
      audienceFilter: z.string().max(128).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return startBulkSend({
        ...input,
        userId: ctx.user.id,
        userName: ctx.user.name || undefined,
        source: "rfv",
      });
    }),

  // ─── Get Bulk Send Progress ───
  bulkSendProgress: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return getBulkSendProgress(input.tenantId);
    }),

  // ─── Cancel Bulk Send ───
  cancelBulkSend: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .mutation(async ({ input }) => {
      const cancelled = cancelBulkSend(input.tenantId);
      if (!cancelled) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum envio em andamento" });
      return { cancelled: true };
    }),

  // ─── Get Active WhatsApp Session for Tenant ───
  activeSession: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return getActiveSessionForTenant(input.tenantId);
    }),

  // ─── Run RFV Notification Check (manual trigger) ───
  checkNotifications: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .mutation(async ({ input }) => {
      return runRfvNotificationCheck(input.tenantId);
    }),

  // ─── Get Filter Snapshots ───
  filterSnapshots: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return getRfvFilterSnapshots(input.tenantId);
    }),

  // ═══════════════════════════════════════════════════════
  // CAMPAIGN REGISTRY
  // ═══════════════════════════════════════════════════════

  // ─── List Campaigns ───
  campaigns: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(20),
      status: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return listCampaigns(input.tenantId, {
        page: input.page,
        pageSize: input.pageSize,
        status: input.status,
      });
    }),

  // ─── Campaign Detail ───
  campaignDetail: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      tenantId: z.number(),
    }))
    .query(async ({ input }) => {
      const detail = await getCampaignDetail(input.campaignId, input.tenantId);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });
      return detail;
    }),

  // ─── Campaign Messages ───
  campaignMessages: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      tenantId: z.number(),
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(50),
      status: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return getCampaignMessages(input.campaignId, input.tenantId, {
        page: input.page,
        pageSize: input.pageSize,
        status: input.status,
      });
    }),
});
