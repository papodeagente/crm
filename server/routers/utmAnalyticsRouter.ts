import { z } from "zod";
import { tenantProcedure, getTenantId, router } from "../_core/trpc";
import { getDb } from "../db";
import { deals, dealHistory, leadSources, campaigns, pipelineStages, lossReasons } from "../../drizzle/schema";
import { eq, and, sql, isNull, gte, lt, isNotNull, desc, asc } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════
// UTM ANALYTICS ROUTER
// Dashboard de rastreamento de vendas por UTM — dados diretos do banco
// Garante que venda ganha = status "won", e retroação correta
// ═══════════════════════════════════════════════════════════════

const dateFilterSchema = z.object({
  dateFrom: z.string().optional(), // ISO date string
  dateTo: z.string().optional(),   // ISO date string
  pipelineId: z.number().optional(),
});

function buildDateConditions(tenantId: number, dateFrom?: string, dateTo?: string, pipelineId?: number) {
  const conditions: any[] = [
    eq(deals.tenantId, tenantId),
    isNull(deals.deletedAt),
  ];
  if (dateFrom) {
    conditions.push(gte(deals.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    // dateTo is inclusive, add 1 day
    const endDate = new Date(dateTo);
    endDate.setDate(endDate.getDate() + 1);
    conditions.push(lt(deals.createdAt, endDate));
  }
  if (pipelineId) {
    conditions.push(eq(deals.pipelineId, pipelineId));
  }
  return conditions;
}

export const utmAnalyticsRouter = router({
  // ─── Overview KPIs ───────────────────────────────────────
  // Retorna métricas gerais: total de deals, ganhos, perdidos, abertos, valor total, taxa de conversão
  overview: tenantProcedure
    .input(dateFilterSchema)
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const conditions = buildDateConditions(getTenantId(ctx), input.dateFrom, input.dateTo, input.pipelineId);

      const [result] = await db.select({
        totalDeals: sql<number>`COUNT(*)`,
        wonDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'won' THEN 1 END)`,
        lostDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'lost' THEN 1 END)`,
        openDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'open' THEN 1 END)`,
        totalValueCents: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
        wonValueCents: sql<number>`COALESCE(SUM(CASE WHEN ${deals.status} = 'won' THEN ${deals.valueCents} ELSE 0 END), 0)`,
        lostValueCents: sql<number>`COALESCE(SUM(CASE WHEN ${deals.status} = 'lost' THEN ${deals.valueCents} ELSE 0 END), 0)`,
        openValueCents: sql<number>`COALESCE(SUM(CASE WHEN ${deals.status} = 'open' THEN ${deals.valueCents} ELSE 0 END), 0)`,
        dealsWithUtm: sql<number>`COUNT(CASE WHEN (${deals.utmSource} IS NOT NULL AND ${deals.utmSource} != '') OR (${deals.utmMedium} IS NOT NULL AND ${deals.utmMedium} != '') OR (${deals.utmCampaign} IS NOT NULL AND ${deals.utmCampaign} != '') THEN 1 END)`,
      }).from(deals).where(and(...conditions));

      const totalDeals = Number(result?.totalDeals ?? 0);
      const wonDeals = Number(result?.wonDeals ?? 0);
      const conversionRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;

      return {
        totalDeals,
        wonDeals,
        lostDeals: Number(result?.lostDeals ?? 0),
        openDeals: Number(result?.openDeals ?? 0),
        totalValueCents: Number(result?.totalValueCents ?? 0),
        wonValueCents: Number(result?.wonValueCents ?? 0),
        lostValueCents: Number(result?.lostValueCents ?? 0),
        openValueCents: Number(result?.openValueCents ?? 0),
        dealsWithUtm: Number(result?.dealsWithUtm ?? 0),
        conversionRate: Math.round(conversionRate * 100) / 100,
      };
    }),

  // ─── Breakdown by UTM dimension ──────────────────────────
  // Retorna dados agrupados por qualquer dimensão UTM
  byDimension: tenantProcedure
    .input(dateFilterSchema.extend({
      dimension: z.enum(["utmSource", "utmMedium", "utmCampaign", "utmTerm", "utmContent", "leadSource", "channelOrigin"]),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = buildDateConditions(getTenantId(ctx), input.dateFrom, input.dateTo, input.pipelineId);

      // Map dimension to column
      const dimCol = {
        utmSource: deals.utmSource,
        utmMedium: deals.utmMedium,
        utmCampaign: deals.utmCampaign,
        utmTerm: deals.utmTerm,
        utmContent: deals.utmContent,
        leadSource: deals.leadSource,
        channelOrigin: deals.channelOrigin,
      }[input.dimension];

      const dimExpr = sql`COALESCE(${dimCol}, '(não informado)')`;
      const rows = await db.select({
        dimension: sql<string>`${dimExpr}`.as("dimension"),
        totalDeals: sql<number>`COUNT(*)`,
        wonDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'won' THEN 1 END)`,
        lostDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'lost' THEN 1 END)`,
        openDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'open' THEN 1 END)`,
        totalValueCents: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
        wonValueCents: sql<number>`COALESCE(SUM(CASE WHEN ${deals.status} = 'won' THEN ${deals.valueCents} ELSE 0 END), 0)`,
      }).from(deals)
        .where(and(...conditions))
        .groupBy(dimExpr)
        .orderBy(sql`COUNT(CASE WHEN ${deals.status} = 'won' THEN 1 END) DESC`);

      return rows.map(r => ({
        dimension: String(r.dimension),
        totalDeals: Number(r.totalDeals),
        wonDeals: Number(r.wonDeals),
        lostDeals: Number(r.lostDeals),
        openDeals: Number(r.openDeals),
        totalValueCents: Number(r.totalValueCents),
        wonValueCents: Number(r.wonValueCents),
        conversionRate: Number(r.totalDeals) > 0
          ? Math.round((Number(r.wonDeals) / Number(r.totalDeals)) * 10000) / 100
          : 0,
      }));
    }),

  // ─── Cross-tabulation: Source × Medium ───────────────────
  // Retorna tabela cruzada de Source × Medium para análise detalhada
  crossTable: tenantProcedure
    .input(dateFilterSchema)
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = buildDateConditions(getTenantId(ctx), input.dateFrom, input.dateTo, input.pipelineId);

      const srcExpr = sql`COALESCE(${deals.utmSource}, '(não informado)')`;
      const medExpr = sql`COALESCE(${deals.utmMedium}, '(não informado)')`;
      const cmpExpr = sql`COALESCE(${deals.utmCampaign}, '(não informado)')`;
      const rows = await db.select({
        source: sql<string>`${srcExpr}`.as("source"),
        medium: sql<string>`${medExpr}`.as("medium"),
        campaign: sql<string>`${cmpExpr}`.as("campaign"),
        totalDeals: sql<number>`COUNT(*)`,
        wonDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'won' THEN 1 END)`,
        lostDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'lost' THEN 1 END)`,
        openDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'open' THEN 1 END)`,
        totalValueCents: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
        wonValueCents: sql<number>`COALESCE(SUM(CASE WHEN ${deals.status} = 'won' THEN ${deals.valueCents} ELSE 0 END), 0)`,
      }).from(deals)
        .where(and(...conditions))
        .groupBy(srcExpr, medExpr, cmpExpr)
        .orderBy(sql`COUNT(CASE WHEN ${deals.status} = 'won' THEN 1 END) DESC`);

      return rows.map(r => ({
        source: String(r.source),
        medium: String(r.medium),
        campaign: String(r.campaign),
        totalDeals: Number(r.totalDeals),
        wonDeals: Number(r.wonDeals),
        lostDeals: Number(r.lostDeals),
        openDeals: Number(r.openDeals),
        totalValueCents: Number(r.totalValueCents),
        wonValueCents: Number(r.wonValueCents),
        conversionRate: Number(r.totalDeals) > 0
          ? Math.round((Number(r.wonDeals) / Number(r.totalDeals)) * 10000) / 100
          : 0,
      }));
    }),

  // ─── Timeline: deals over time by status ─────────────────
  // Retorna dados agrupados por mês para gráfico de evolução
  timeline: tenantProcedure
    .input(dateFilterSchema)
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = buildDateConditions(getTenantId(ctx), input.dateFrom, input.dateTo, input.pipelineId);

      const monthExpr = sql`DATE_FORMAT(${deals.createdAt}, '%Y-%m')`;
      const rows = await db.select({
        month: sql<string>`${monthExpr}`.as("month"),
        totalDeals: sql<number>`COUNT(*)`,
        wonDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'won' THEN 1 END)`,
        lostDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'lost' THEN 1 END)`,
        openDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'open' THEN 1 END)`,
        totalValueCents: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
        wonValueCents: sql<number>`COALESCE(SUM(CASE WHEN ${deals.status} = 'won' THEN ${deals.valueCents} ELSE 0 END), 0)`,
      }).from(deals)
        .where(and(...conditions))
        .groupBy(monthExpr)
        .orderBy(sql`${monthExpr} ASC`);

      return rows.map(r => ({
        month: String(r.month),
        totalDeals: Number(r.totalDeals),
        wonDeals: Number(r.wonDeals),
        lostDeals: Number(r.lostDeals),
        openDeals: Number(r.openDeals),
        totalValueCents: Number(r.totalValueCents),
        wonValueCents: Number(r.wonValueCents),
      }));
    }),

  // ─── Available filter values ─────────────────────────────
  // Retorna todos os valores distintos de UTMs para popular filtros
  filterValues: tenantProcedure
    
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { sources: [], mediums: [], campaigns: [], terms: [], contents: [], leadSources: [], channels: [] };

      const baseConditions = [eq(deals.tenantId, getTenantId(ctx)), isNull(deals.deletedAt)];

      const [sources, mediums, campaignsData, terms, contents, leadSourcesData, channels] = await Promise.all([
        db.selectDistinct({ value: deals.utmSource })
          .from(deals)
          .where(and(...baseConditions, isNotNull(deals.utmSource), sql`${deals.utmSource} != ''`))
          .orderBy(asc(deals.utmSource)),
        db.selectDistinct({ value: deals.utmMedium })
          .from(deals)
          .where(and(...baseConditions, isNotNull(deals.utmMedium), sql`${deals.utmMedium} != ''`))
          .orderBy(asc(deals.utmMedium)),
        db.selectDistinct({ value: deals.utmCampaign })
          .from(deals)
          .where(and(...baseConditions, isNotNull(deals.utmCampaign), sql`${deals.utmCampaign} != ''`))
          .orderBy(asc(deals.utmCampaign)),
        db.selectDistinct({ value: deals.utmTerm })
          .from(deals)
          .where(and(...baseConditions, isNotNull(deals.utmTerm), sql`${deals.utmTerm} != ''`))
          .orderBy(asc(deals.utmTerm)),
        db.selectDistinct({ value: deals.utmContent })
          .from(deals)
          .where(and(...baseConditions, isNotNull(deals.utmContent), sql`${deals.utmContent} != ''`))
          .orderBy(asc(deals.utmContent)),
        db.selectDistinct({ value: deals.leadSource })
          .from(deals)
          .where(and(...baseConditions, isNotNull(deals.leadSource), sql`${deals.leadSource} != ''`))
          .orderBy(asc(deals.leadSource)),
        db.selectDistinct({ value: deals.channelOrigin })
          .from(deals)
          .where(and(...baseConditions, isNotNull(deals.channelOrigin), sql`${deals.channelOrigin} != ''`))
          .orderBy(asc(deals.channelOrigin)),
      ]);

      return {
        sources: sources.map(r => r.value).filter(Boolean) as string[],
        mediums: mediums.map(r => r.value).filter(Boolean) as string[],
        campaigns: campaignsData.map(r => r.value).filter(Boolean) as string[],
        terms: terms.map(r => r.value).filter(Boolean) as string[],
        contents: contents.map(r => r.value).filter(Boolean) as string[],
        leadSources: leadSourcesData.map(r => r.value).filter(Boolean) as string[],
        channels: channels.map(r => r.value).filter(Boolean) as string[],
      };
    }),

  // ─── Deal list with UTM data ─────────────────────────────
  // Lista deals com dados UTM para tabela detalhada
  dealList: tenantProcedure
    .input(dateFilterSchema.extend({
      status: z.enum(["all", "open", "won", "lost"]).default("all"),
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { deals: [], total: 0 };
      const conditions = buildDateConditions(getTenantId(ctx), input.dateFrom, input.dateTo, input.pipelineId);

      if (input.status !== "all") {
        conditions.push(eq(deals.status, input.status as any));
      }
      if (input.utmSource) {
        conditions.push(eq(deals.utmSource, input.utmSource));
      }
      if (input.utmMedium) {
        conditions.push(eq(deals.utmMedium, input.utmMedium));
      }
      if (input.utmCampaign) {
        conditions.push(eq(deals.utmCampaign, input.utmCampaign));
      }

      const [rows, [countResult]] = await Promise.all([
        db.select({
          id: deals.id,
          title: deals.title,
          status: deals.status,
          valueCents: deals.valueCents,
          utmSource: deals.utmSource,
          utmMedium: deals.utmMedium,
          utmCampaign: deals.utmCampaign,
          utmTerm: deals.utmTerm,
          utmContent: deals.utmContent,
          leadSource: deals.leadSource,
          channelOrigin: deals.channelOrigin,
          createdAt: deals.createdAt,
        }).from(deals)
          .where(and(...conditions))
          .orderBy(desc(deals.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ count: sql<number>`COUNT(*)` })
          .from(deals)
          .where(and(...conditions)),
      ]);

      return {
        deals: rows.map(r => ({
          ...r,
          valueCents: Number(r.valueCents ?? 0),
        })),
        total: Number(countResult?.count ?? 0),
      };
    }),  // ─── Loss Reasons Analytics ──────────────────────────────
  // Retorna contagem e valor de deals perdidos agrupados por motivo de perda
  lossReasonsAnalytics: tenantProcedure
    .input(dateFilterSchema)
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = buildDateConditions(getTenantId(ctx), input.dateFrom, input.dateTo, input.pipelineId);
      conditions.push(eq(deals.status, "lost" as any));
      conditions.push(isNotNull(deals.lossReasonId));

      const rows = await db.select({
        lossReasonId: deals.lossReasonId,
        reasonName: lossReasons.name,
        count: sql<number>`COUNT(*)`,
        totalValueCents: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
      }).from(deals)
        .leftJoin(lossReasons, eq(deals.lossReasonId, lossReasons.id))
        .where(and(...conditions))
        .groupBy(deals.lossReasonId, lossReasons.name)
        .orderBy(sql`COUNT(*) DESC`);

      // Also get deals lost without a reason (legacy)
      const legacyConditions = buildDateConditions(getTenantId(ctx), input.dateFrom, input.dateTo, input.pipelineId);
      legacyConditions.push(eq(deals.status, "lost" as any));
      legacyConditions.push(isNull(deals.lossReasonId));
      const [legacyResult] = await db.select({
        count: sql<number>`COUNT(*)`,
        totalValueCents: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
      }).from(deals).where(and(...legacyConditions));

      const results = rows.map(r => ({
        lossReasonId: Number(r.lossReasonId),
        reasonName: String(r.reasonName || "Sem motivo"),
        count: Number(r.count),
        totalValueCents: Number(r.totalValueCents),
      }));

      // Add legacy if any
      if (Number(legacyResult?.count ?? 0) > 0) {
        results.push({
          lossReasonId: 0,
          reasonName: "Sem motivo informado",
          count: Number(legacyResult.count),
          totalValueCents: Number(legacyResult.totalValueCents),
        });
      }

      return results;
    }),

  // ─── Stage time analytics (for tooltip) ────────────────────── // Calcula tempo médio de permanência em cada etapa do pipeline
  stageTime: tenantProcedure
    .input(z.object({
      dealId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      // Get all stage change history for this deal, ordered by time
      const history = await db.select({
        id: dealHistory.id,
        action: dealHistory.action,
        fromStageId: dealHistory.fromStageId,
        toStageId: dealHistory.toStageId,
        fromStageName: dealHistory.fromStageName,
        toStageName: dealHistory.toStageName,
        createdAt: dealHistory.createdAt,
      }).from(dealHistory)
        .where(and(
          eq(dealHistory.tenantId, getTenantId(ctx)),
          eq(dealHistory.dealId, input.dealId),
        ))
        .orderBy(asc(dealHistory.createdAt));

      // Also get the deal creation date and current stage
      const [deal] = await db.select({
        stageId: deals.stageId,
        createdAt: deals.createdAt,
      }).from(deals)
        .where(and(eq(deals.id, input.dealId), eq(deals.tenantId, getTenantId(ctx))))
        .limit(1);

      if (!deal) return [];

      // Build stage timeline
      // Filter only stage_changed and created events
      const stageEvents = history.filter(h =>
        h.action === "stage_changed" || h.action === "created" || h.action === "moved_stage"
      );

      // Get all stages for this pipeline
      const stages = await db.select({
        id: pipelineStages.id,
        name: pipelineStages.name,
        orderIndex: pipelineStages.orderIndex,
      }).from(pipelineStages)
        .where(eq(pipelineStages.tenantId, getTenantId(ctx)))
        .orderBy(asc(pipelineStages.orderIndex));

      // Calculate time in each stage
      const stageTimeMap = new Map<number, { name: string; durationMs: number; enteredAt: Date | null }>();

      // Initialize with deal creation
      let currentStageId = stageEvents.length > 0 && stageEvents[0].toStageId
        ? stageEvents[0].toStageId
        : deal.stageId;
      let currentEnteredAt = new Date(deal.createdAt);

      for (const event of stageEvents) {
        if (event.action === "created" && event.toStageId) {
          currentStageId = event.toStageId;
          currentEnteredAt = new Date(event.createdAt);
          continue;
        }

        if ((event.action === "stage_changed" || event.action === "moved_stage") && event.fromStageId && event.toStageId) {
          // Record time in previous stage
          const durationMs = new Date(event.createdAt).getTime() - currentEnteredAt.getTime();
          const existing = stageTimeMap.get(event.fromStageId);
          if (existing) {
            existing.durationMs += durationMs;
          } else {
            stageTimeMap.set(event.fromStageId, {
              name: event.fromStageName || `Etapa ${event.fromStageId}`,
              durationMs,
              enteredAt: currentEnteredAt,
            });
          }

          // Move to new stage
          currentStageId = event.toStageId;
          currentEnteredAt = new Date(event.createdAt);
        }
      }

      // Add current stage time (still in this stage)
      const currentDuration = Date.now() - currentEnteredAt.getTime();
      const existingCurrent = stageTimeMap.get(currentStageId);
      if (existingCurrent) {
        existingCurrent.durationMs += currentDuration;
      } else {
        const currentStage = stages.find(s => s.id === currentStageId);
        stageTimeMap.set(currentStageId, {
          name: currentStage?.name || `Etapa ${currentStageId}`,
          durationMs: currentDuration,
          enteredAt: currentEnteredAt,
        });
      }

      // Return all stages with their times
      return stages.map(stage => {
        const time = stageTimeMap.get(stage.id);
        return {
          stageId: stage.id,
          stageName: stage.name,
          orderIndex: stage.orderIndex,
          durationMs: time?.durationMs ?? 0,
          enteredAt: time?.enteredAt?.toISOString() ?? null,
        };
      });
    }),
});
