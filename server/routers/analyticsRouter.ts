/**
 * Analytics Router — Isolated tRPC procedures for the Analytics page.
 * Does NOT modify any existing router or procedure.
 */
import { z } from "zod";
import { router } from "../_core/trpc";
import { tenantProcedure, getTenantId } from "../_core/trpc";
import { getAnalyticsSummary, getTopLossReasons, getPipelineFunnel, getDealsByPeriod, getFunnelConversion } from "../crmAnalytics";
import { getGoalsReport, generateGoalsAIAnalysis } from "../goalsAnalytics";
import { getCrmLiveCover, getCrmLiveOperation } from "../crmLive";

export const analyticsRouter = router({
  summary: tenantProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      pipelineId: z.number().optional(),
      ownerUserId: z.number().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return getAnalyticsSummary({
        tenantId: getTenantId(ctx),
        dateFrom: input?.dateFrom,
        dateTo: input?.dateTo,
        pipelineId: input?.pipelineId,
        ownerUserId: input?.ownerUserId,
      });
    }),

  topLossReasons: tenantProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      pipelineId: z.number().optional(),
      ownerUserId: z.number().optional(),
      limit: z.number().optional().default(5),
    }).optional())
    .query(async ({ input, ctx }) => {
      return getTopLossReasons({
        tenantId: getTenantId(ctx),
        dateFrom: input?.dateFrom,
        dateTo: input?.dateTo,
        pipelineId: input?.pipelineId,
        ownerUserId: input?.ownerUserId,
      }, input?.limit ?? 5);
    }),

  pipelineFunnel: tenantProcedure
    .input(z.object({
      pipelineId: z.number(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      ownerUserId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      return getPipelineFunnel({
        tenantId: getTenantId(ctx),
        pipelineId: input.pipelineId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        ownerUserId: input.ownerUserId,
      });
    }),

  dealsByPeriod: tenantProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      pipelineId: z.number().optional(),
      ownerUserId: z.number().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return getDealsByPeriod({
        tenantId: getTenantId(ctx),
        dateFrom: input?.dateFrom,
        dateTo: input?.dateTo,
        pipelineId: input?.pipelineId,
        ownerUserId: input?.ownerUserId,
      });
    }),

  funnelConversion: tenantProcedure
    .input(z.object({
      pipelineId: z.number(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      ownerUserId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      return getFunnelConversion({
        tenantId: getTenantId(ctx),
        pipelineId: input.pipelineId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        ownerUserId: input.ownerUserId,
      });
    }),

  goalsReport: tenantProcedure
    .query(async ({ ctx }) => {
      return getGoalsReport(getTenantId(ctx));
    }),

  goalsAIAnalysis: tenantProcedure
    .mutation(async ({ ctx }) => {
      const reportData = await getGoalsReport(getTenantId(ctx));
      return generateGoalsAIAnalysis(getTenantId(ctx), reportData);
    }),

  crmLiveCover: tenantProcedure
    .input(z.object({
      tab: z.enum(["finalized", "in_progress"]),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      pipelineId: z.number().optional(),
      ownerUserId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      return getCrmLiveCover({
        tenantId: getTenantId(ctx),
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        pipelineId: input.pipelineId,
        ownerUserId: input.ownerUserId,
      }, input.tab);
    }),

  crmLiveOperation: tenantProcedure
    .input(z.object({
      tab: z.enum(["finalized", "in_progress"]),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      pipelineId: z.number().optional(),
      ownerUserId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      return getCrmLiveOperation({
        tenantId: getTenantId(ctx),
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        pipelineId: input.pipelineId,
        ownerUserId: input.ownerUserId,
      }, input.tab);
    }),
});
