/**
 * Analytics Router — Isolated tRPC procedures for the Analytics page.
 * Does NOT modify any existing router or procedure.
 */
import { z } from "zod";
import { router } from "../_core/trpc";
import { tenantProcedure, tenantWriteProcedure, getTenantId } from "../_core/trpc";
import { getAnalyticsSummary, getTopLossReasons, getPipelineFunnel, getDealsByPeriod, getFunnelConversion, getSalesRanking, getLeadSources, getForecast, getStagnation, getAppointmentsAnalytics } from "../crmAnalytics";
import { getGoalsReport, generateGoalsAIAnalysis } from "../goalsAnalytics";
import { getCrmLiveCover, getCrmLiveOperation } from "../crmLive";

export const analyticsRouter = router({
  summary: tenantProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      pipelineId: z.number().optional(),
      ownerUserId: z.number().optional(),
      pipelineType: z.enum(["sales", "post_sale", "support"]).optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return getAnalyticsSummary({
        tenantId: getTenantId(ctx),
        dateFrom: input?.dateFrom,
        dateTo: input?.dateTo,
        pipelineId: input?.pipelineId,
        ownerUserId: input?.ownerUserId,
        pipelineType: input?.pipelineType,
      });
    }),

  topLossReasons: tenantProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      pipelineId: z.number().optional(),
      ownerUserId: z.number().optional(),
      pipelineType: z.enum(["sales", "post_sale", "support"]).optional(),
      limit: z.number().optional().default(5),
    }).optional())
    .query(async ({ input, ctx }) => {
      return getTopLossReasons({
        tenantId: getTenantId(ctx),
        dateFrom: input?.dateFrom,
        dateTo: input?.dateTo,
        pipelineId: input?.pipelineId,
        ownerUserId: input?.ownerUserId,
        pipelineType: input?.pipelineType,
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
      pipelineType: z.enum(["sales", "post_sale", "support"]).optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return getDealsByPeriod({
        tenantId: getTenantId(ctx),
        dateFrom: input?.dateFrom,
        dateTo: input?.dateTo,
        pipelineId: input?.pipelineId,
        ownerUserId: input?.ownerUserId,
        pipelineType: input?.pipelineType,
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

  goalsAIAnalysis: tenantWriteProcedure
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

  /* ─── Indicadores estendidos ─── */

  salesRanking: tenantProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      pipelineId: z.number().optional(),
      pipelineType: z.enum(["sales", "post_sale", "support"]).optional(),
      limit: z.number().min(1).max(50).default(10),
    }).optional())
    .query(async ({ input, ctx }) => {
      return getSalesRanking({
        tenantId: getTenantId(ctx),
        dateFrom: input?.dateFrom,
        dateTo: input?.dateTo,
        pipelineId: input?.pipelineId,
        pipelineType: input?.pipelineType,
      }, input?.limit ?? 10);
    }),

  leadSources: tenantProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      pipelineId: z.number().optional(),
      ownerUserId: z.number().optional(),
      pipelineType: z.enum(["sales", "post_sale", "support"]).optional(),
      limit: z.number().min(1).max(30).default(8),
    }).optional())
    .query(async ({ input, ctx }) => {
      return getLeadSources({
        tenantId: getTenantId(ctx),
        dateFrom: input?.dateFrom,
        dateTo: input?.dateTo,
        pipelineId: input?.pipelineId,
        ownerUserId: input?.ownerUserId,
        pipelineType: input?.pipelineType,
      }, input?.limit ?? 8);
    }),

  forecast: tenantProcedure
    .input(z.object({
      pipelineId: z.number().optional(),
      ownerUserId: z.number().optional(),
      pipelineType: z.enum(["sales", "post_sale", "support"]).optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return getForecast({
        tenantId: getTenantId(ctx),
        pipelineId: input?.pipelineId,
        ownerUserId: input?.ownerUserId,
        pipelineType: input?.pipelineType,
      });
    }),

  stagnation: tenantProcedure
    .input(z.object({
      pipelineId: z.number().optional(),
      ownerUserId: z.number().optional(),
      pipelineType: z.enum(["sales", "post_sale", "support"]).optional(),
      thresholdDays: z.number().min(1).max(365).default(14),
    }).optional())
    .query(async ({ input, ctx }) => {
      return getStagnation({
        tenantId: getTenantId(ctx),
        pipelineId: input?.pipelineId,
        ownerUserId: input?.ownerUserId,
        pipelineType: input?.pipelineType,
      }, input?.thresholdDays ?? 14, 10);
    }),

  /**
   * Análise de Agendamentos × Vendas. Correlaciona status do appointment
   * (confirmado/concluído/cancelado/falta) com a tabela de deals via dealId
   * para gerar KPIs comerciais usados no relatório de Análises.
   */
  appointmentVendings: tenantProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return getAppointmentsAnalytics({
        tenantId: getTenantId(ctx),
        dateFrom: input?.dateFrom,
        dateTo: input?.dateTo,
      });
    }),
});
