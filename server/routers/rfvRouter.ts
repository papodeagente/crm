/**
 * RFV Router — tRPC endpoints for Matriz RFV
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
} from "../bulkMessage";

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
    }))
    .mutation(async ({ input }) => {
      return startBulkSend(input);
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
});
