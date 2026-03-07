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
  AUDIENCE_TYPES,
} from "../rfv";

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
      sortBy: z.string().optional(),
      sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
    }))
    .query(async ({ input }) => {
      return getRfvContacts(input.tenantId, {
        page: input.page,
        pageSize: input.pageSize,
        search: input.search,
        audienceType: input.audienceType,
        sortBy: input.sortBy,
        sortDir: input.sortDir,
      });
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
});
