/**
 * CRM Analytics — Isolated query helpers for the Analytics page.
 * Does NOT modify any existing table or query. Read-only aggregations.
 */
import { eq, and, sql, gte, lte, isNull, desc } from "drizzle-orm";
import { getDb, rowsOf } from "./db";
import { deals, lossReasons, pipelines, pipelineStages } from "../drizzle/schema";

/* ─── Types ─── */
export interface AnalyticsFilters {
  tenantId: number;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  pipelineId?: number;
  ownerUserId?: number;
  pipelineType?: string; // 'sales' | 'post_sale' | 'support'
}

export interface AnalyticsSummary {
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalValueCents: number;
  wonValueCents: number;
  lostValueCents: number;
  openValueCents: number;
  conversionRate: number;       // won / (won + lost) * 100
  avgTicketCents: number;       // wonValueCents / wonDeals
  avgCycleDays: number;         // avg days from createdAt to updatedAt for won deals
}

export interface LossReasonStat {
  reasonId: number | null;
  reasonName: string;
  count: number;
  percentage: number;
  valueCents: number;
}

export interface PipelineFunnel {
  stageId: number;
  stageName: string;
  stageColor: string;
  orderIndex: number;
  dealCount: number;
  valueCents: number;
}

export interface FunnelConversionStage {
  stageId: number;
  stageName: string;
  orderIndex: number;
  open: number;
  won: number;
  lost: number;
  total: number;            // open + won + lost that passed through this stage
  conversionFromPrev: number; // % of deals that reached this stage from the previous one
}

export interface FunnelConversionResult {
  stages: FunnelConversionStage[];
  totalDeals: number;       // total deals in the pipeline
  totalWon: number;
  totalLost: number;
  finalConversionRate: number; // won / (won + lost) * 100
}

export interface DealsByPeriod {
  period: string;  // YYYY-MM or YYYY-MM-DD depending on granularity
  won: number;
  lost: number;
  open: number;
  wonValueCents: number;
  lostValueCents: number;
}

export interface SalesRankingRow {
  ownerUserId: number;
  ownerName: string;
  totalDeals: number;
  wonDeals: number;
  lostDeals: number;
  wonValueCents: number;
  conversionRate: number;
}

export interface LeadSourceRow {
  source: string;        // ex.: "whatsapp", "instagram", "ads"; "—" para vazio
  totalDeals: number;
  wonDeals: number;
  wonValueCents: number;
  conversionRate: number;
}

export interface ForecastResult {
  openDeals: number;
  openValueCents: number;
  weightedForecastCents: number;  // soma de open × probability
  avgProbability: number;          // % média ponderada
}

export interface StagnationResult {
  stagnantCount: number;        // open deals sem atividade há > thresholdDays
  thresholdDays: number;
  totalOpen: number;
  topStagnant: Array<{
    id: number;
    title: string;
    valueCents: number;
    stageName: string | null;
    ownerName: string | null;
    daysSinceActivity: number;
  }>;
}

/* ─── Helpers ─── */
function buildConditions(f: AnalyticsFilters, joinPipeline = false) {
  const conds: any[] = [eq(deals.tenantId, f.tenantId), isNull(deals.deletedAt)];
  if (f.dateFrom) conds.push(gte(deals.createdAt, new Date(f.dateFrom + "T00:00:00")));
  if (f.dateTo) conds.push(lte(deals.createdAt, new Date(f.dateTo + "T23:59:59")));
  if (f.pipelineId) conds.push(eq(deals.pipelineId, f.pipelineId));
  if (f.ownerUserId) conds.push(eq(deals.ownerUserId, f.ownerUserId));
  if (f.pipelineType) conds.push(eq(pipelines.pipelineType, f.pipelineType as any));
  return and(...conds);
}

/* ─── 1. Summary KPIs ─── */
export async function getAnalyticsSummary(f: AnalyticsFilters): Promise<AnalyticsSummary> {
  const db = await getDb();
  if (!db) return { totalDeals: 0, openDeals: 0, wonDeals: 0, lostDeals: 0, totalValueCents: 0, wonValueCents: 0, lostValueCents: 0, openValueCents: 0, conversionRate: 0, avgTicketCents: 0, avgCycleDays: 0 };

  const where = buildConditions(f);

  let q = db.select({
    status: deals.status,
    cnt: sql<number>`COUNT(*)`,
    val: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
    avgCycle: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${deals.updatedAt} - ${deals.createdAt})) / 86400.0), 0)`,
  }).from(deals);
  if (f.pipelineType) q = q.innerJoin(pipelines, eq(deals.pipelineId, pipelines.id)) as any;
  const rows = await q.where(where).groupBy(deals.status);

  let totalDeals = 0, openDeals = 0, wonDeals = 0, lostDeals = 0;
  let totalValueCents = 0, wonValueCents = 0, lostValueCents = 0, openValueCents = 0;
  let avgCycleDays = 0;

  for (const r of rows) {
    const cnt = Number(r.cnt);
    const val = Number(r.val);
    totalDeals += cnt;
    totalValueCents += val;
    if (r.status === "open") { openDeals = cnt; openValueCents = val; }
    if (r.status === "won") { wonDeals = cnt; wonValueCents = val; avgCycleDays = Number(r.avgCycle); }
    if (r.status === "lost") { lostDeals = cnt; lostValueCents = val; }
  }

  const decided = wonDeals + lostDeals;
  const conversionRate = decided > 0 ? Math.round((wonDeals / decided) * 10000) / 100 : 0;
  const avgTicketCents = wonDeals > 0 ? Math.round(wonValueCents / wonDeals) : 0;

  return { totalDeals, openDeals, wonDeals, lostDeals, totalValueCents, wonValueCents, lostValueCents, openValueCents, conversionRate, avgTicketCents, avgCycleDays: Math.round(avgCycleDays) };
}

/* ─── 2. Top Loss Reasons ─── */
export async function getTopLossReasons(f: AnalyticsFilters, limit = 5): Promise<LossReasonStat[]> {
  const db = await getDb();
  if (!db) return [];

  const conds: any[] = [eq(deals.tenantId, f.tenantId), isNull(deals.deletedAt), eq(deals.status, "lost" as any)];
  if (f.dateFrom) conds.push(gte(deals.createdAt, new Date(f.dateFrom + "T00:00:00")));
  if (f.dateTo) conds.push(lte(deals.createdAt, new Date(f.dateTo + "T23:59:59")));
  if (f.pipelineId) conds.push(eq(deals.pipelineId, f.pipelineId));
  if (f.ownerUserId) conds.push(eq(deals.ownerUserId, f.ownerUserId));

  let lossQ = db.select({
    reasonId: deals.lossReasonId,
    reasonName: sql<string>`COALESCE(${lossReasons.name}, 'Sem motivo')`,
    count: sql<number>`COUNT(*)`,
    valueCents: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
  })
    .from(deals)
    .leftJoin(lossReasons, eq(deals.lossReasonId, lossReasons.id));
  if (f.pipelineType) {
    conds.push(eq(pipelines.pipelineType, f.pipelineType as any));
    lossQ = lossQ.innerJoin(pipelines, eq(deals.pipelineId, pipelines.id)) as any;
  }
  const rows = await lossQ
    .where(and(...conds))
    .groupBy(deals.lossReasonId, lossReasons.name)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);

  const totalLost = rows.reduce((s, r) => s + Number(r.count), 0);

  return rows.map(r => ({
    reasonId: r.reasonId,
    reasonName: r.reasonName,
    count: Number(r.count),
    percentage: totalLost > 0 ? Math.round((Number(r.count) / totalLost) * 10000) / 100 : 0,
    valueCents: Number(r.valueCents),
  }));
}

/* ─── 3. Pipeline Funnel ─── */
export async function getPipelineFunnel(f: AnalyticsFilters & { pipelineId: number }): Promise<PipelineFunnel[]> {
  const db = await getDb();
  if (!db) return [];

  const conds: any[] = [
    eq(deals.tenantId, f.tenantId),
    isNull(deals.deletedAt),
    eq(deals.pipelineId, f.pipelineId),
    eq(deals.status, "open" as any),
  ];
  if (f.dateFrom) conds.push(gte(deals.createdAt, new Date(f.dateFrom + "T00:00:00")));
  if (f.dateTo) conds.push(lte(deals.createdAt, new Date(f.dateTo + "T23:59:59")));
  if (f.ownerUserId) conds.push(eq(deals.ownerUserId, f.ownerUserId));

  const rows = await db.select({
    stageId: pipelineStages.id,
    stageName: pipelineStages.name,
    stageColor: pipelineStages.color,
    orderIndex: pipelineStages.orderIndex,
    dealCount: sql<number>`COUNT(${deals.id})`,
    valueCents: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
  })
    .from(pipelineStages)
    .leftJoin(deals, and(eq(deals.stageId, pipelineStages.id), ...conds))
    .where(and(eq(pipelineStages.pipelineId, f.pipelineId), eq(pipelineStages.tenantId, f.tenantId)))
    .groupBy(pipelineStages.id, pipelineStages.name, pipelineStages.color, pipelineStages.orderIndex)
    .orderBy(pipelineStages.orderIndex);

  return rows.map(r => ({
    stageId: r.stageId,
    stageName: r.stageName,
    stageColor: r.stageColor || "#6366f1",
    orderIndex: r.orderIndex,
    dealCount: Number(r.dealCount),
    valueCents: Number(r.valueCents),
  }));
}

/* ─── 4. Deals by Period (daily) ─── */
export async function getDealsByPeriod(f: AnalyticsFilters): Promise<DealsByPeriod[]> {
  const db = await getDb();
  if (!db) return [];

  const where = buildConditions(f);

  const periodExpr = sql<string>`DATE_FORMAT(${deals.createdAt}, '%Y-%m-%d')`.as('period');
  let q = db.select({
    period: periodExpr,
    status: deals.status,
    cnt: sql<number>`COUNT(*)`,
    val: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
  }).from(deals);
  if (f.pipelineType) q = q.innerJoin(pipelines, eq(deals.pipelineId, pipelines.id)) as any;
  const rows = await q
    .where(where)
    .groupBy(periodExpr, deals.status)
    .orderBy(periodExpr);

  // Pivot rows into periods
  const periodMap = new Map<string, DealsByPeriod>();
  for (const r of rows) {
    const p = r.period;
    if (!periodMap.has(p)) periodMap.set(p, { period: p, won: 0, lost: 0, open: 0, wonValueCents: 0, lostValueCents: 0 });
    const entry = periodMap.get(p)!;
    const cnt = Number(r.cnt);
    const val = Number(r.val);
    if (r.status === "won") { entry.won = cnt; entry.wonValueCents = val; }
    if (r.status === "lost") { entry.lost = cnt; entry.lostValueCents = val; }
    if (r.status === "open") { entry.open = cnt; }
  }

  return Array.from(periodMap.values());
}

/* ─── 5. Funnel Conversion by Volume ─── */
/**
 * Returns conversion-by-volume data for a pipeline.
 * For each stage: how many deals are open, won, or lost.
 * "Won" and "lost" deals are attributed to the LAST stage they occupied before closing.
 * The concept: a deal that reached stage 3 before being won counts in stages 1, 2, 3 for "passed through".
 * But for the stacked bar chart, we show per-stage: open (still there), won (closed-won from that stage or beyond), lost (closed-lost from that stage).
 *
 * Simpler approach matching the reference image:
 * - For each stage, count deals currently in that stage (open) + deals that were won/lost while in that stage.
 * - The "total" for a stage = cumulative deals that reached at least that stage.
 * - Conversion between stages = total(stage N) / total(stage N-1) * 100
 */
export async function getFunnelConversion(f: AnalyticsFilters & { pipelineId: number }): Promise<FunnelConversionResult> {
  const db = await getDb();
  if (!db) return { stages: [], totalDeals: 0, totalWon: 0, totalLost: 0, finalConversionRate: 0 };

  // Base conditions (no status filter — we want all statuses)
  const baseConds: any[] = [
    eq(deals.tenantId, f.tenantId),
    isNull(deals.deletedAt),
    eq(deals.pipelineId, f.pipelineId),
  ];
  if (f.dateFrom) baseConds.push(gte(deals.createdAt, new Date(f.dateFrom + "T00:00:00")));
  if (f.dateTo) baseConds.push(lte(deals.createdAt, new Date(f.dateTo + "T23:59:59")));
  if (f.ownerUserId) baseConds.push(eq(deals.ownerUserId, f.ownerUserId));

  // Get all stages for this pipeline
  const stagesRows = await db.select({
    id: pipelineStages.id,
    name: pipelineStages.name,
    orderIndex: pipelineStages.orderIndex,
  })
    .from(pipelineStages)
    .where(and(eq(pipelineStages.pipelineId, f.pipelineId), eq(pipelineStages.tenantId, f.tenantId)))
    .orderBy(pipelineStages.orderIndex);

  if (stagesRows.length === 0) return { stages: [], totalDeals: 0, totalWon: 0, totalLost: 0, finalConversionRate: 0 };

  // Get deal counts grouped by stageId and status
  const dealRows = await db.select({
    stageId: deals.stageId,
    status: deals.status,
    cnt: sql<number>`COUNT(*)`,
  })
    .from(deals)
    .where(and(...baseConds))
    .groupBy(deals.stageId, deals.status);

  // Build a map: stageId -> { open, won, lost }
  const stageMap = new Map<number, { open: number; won: number; lost: number }>();
  for (const s of stagesRows) {
    stageMap.set(s.id, { open: 0, won: 0, lost: 0 });
  }
  for (const r of dealRows) {
    const entry = stageMap.get(r.stageId);
    if (!entry) continue;
    const cnt = Number(r.cnt);
    if (r.status === "open") entry.open = cnt;
    if (r.status === "won") entry.won = cnt;
    if (r.status === "lost") entry.lost = cnt;
  }

  // Build cumulative funnel: deals that "passed through" each stage
  // A deal at stage N has passed through stages 0..N
  // So for stage i, cumulative = sum of (open+won+lost) for stages i..last
  // This gives us the "volume" that reached at least stage i
  const stageData = stagesRows.map(s => {
    const d = stageMap.get(s.id)!;
    return { ...s, open: d.open, won: d.won, lost: d.lost, direct: d.open + d.won + d.lost };
  });

  // Calculate cumulative from bottom up (deals that reached at least this stage)
  // cumulative[i] = direct[i] + direct[i+1] + ... + direct[last]
  const cumulativeTotal: number[] = new Array(stageData.length).fill(0);
  let runningTotal = 0;
  for (let i = stageData.length - 1; i >= 0; i--) {
    runningTotal += stageData[i].direct;
    cumulativeTotal[i] = runningTotal;
  }

  // For the stacked bar: each stage shows its own open/won/lost counts
  // But the "total" bar width should represent cumulative volume
  // The "lost" at each stage = deals lost at that stage specifically
  // The "open" = deals still open at that stage
  // The "conversion" (blue) = deals that moved past this stage = cumulative of next stages
  const stages: FunnelConversionStage[] = stageData.map((s, i) => {
    const total = cumulativeTotal[i];
    const prevTotal = i === 0 ? total : cumulativeTotal[i - 1];
    const conversionFromPrev = prevTotal > 0 ? Math.round((total / prevTotal) * 10000) / 100 : 100;

    return {
      stageId: s.id,
      stageName: s.name,
      orderIndex: s.orderIndex,
      open: s.open,
      won: s.won,
      lost: s.lost,
      total,
      conversionFromPrev,
    };
  });

  const totalDeals = cumulativeTotal[0] || 0;
  const totalWon = stageData.reduce((s, d) => s + d.won, 0);
  const totalLost = stageData.reduce((s, d) => s + d.lost, 0);
  const decided = totalWon + totalLost;
  const finalConversionRate = decided > 0 ? Math.round((totalWon / decided) * 10000) / 100 : 0;

  return { stages, totalDeals, totalWon, totalLost, finalConversionRate };
}

/* ─── helpers de sanitização para sql.raw ─── */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PIPELINE_TYPES = new Set(["sales", "post_sale", "support"]);
function safeDate(s: string | undefined): string | undefined {
  return s && ISO_DATE_RE.test(s) ? s : undefined;
}
function safePipelineType(s: string | undefined): string | undefined {
  return s && PIPELINE_TYPES.has(s) ? s : undefined;
}
function safeInt(n: number | undefined): number | undefined {
  return Number.isInteger(n) ? n : undefined;
}

/* ─── 6. Sales Ranking — top vendedores por valor ganho ─── */
export async function getSalesRanking(f: AnalyticsFilters, limit = 10): Promise<SalesRankingRow[]> {
  const db = await getDb();
  if (!db) return [];

  const tenantId = safeInt(f.tenantId)!;
  const dateFrom = safeDate(f.dateFrom);
  const dateTo = safeDate(f.dateTo);
  const pipelineId = safeInt(f.pipelineId);
  const pipelineType = safePipelineType(f.pipelineType);
  const safeLimit = Math.min(Math.max(safeInt(limit) ?? 10, 1), 50);

  const conds: string[] = [`d."tenantId" = ${tenantId}`, `d."deletedAt" IS NULL`];
  if (dateFrom) conds.push(`d."createdAt" >= '${dateFrom} 00:00:00'`);
  if (dateTo) conds.push(`d."createdAt" <= '${dateTo} 23:59:59'`);
  if (pipelineId) conds.push(`d."pipelineId" = ${pipelineId}`);
  const pipelineJoin = pipelineType ? `INNER JOIN pipelines p ON p.id = d."pipelineId" AND p."pipelineType" = '${pipelineType}'` : '';

  const result = await db.execute(sql.raw(`
    SELECT
      d."ownerUserId",
      COALESCE(u.name, '—') AS "ownerName",
      COUNT(*)::int AS "totalDeals",
      COUNT(*) FILTER (WHERE d.status = 'won')::int AS "wonDeals",
      COUNT(*) FILTER (WHERE d.status = 'lost')::int AS "lostDeals",
      COALESCE(SUM(CASE WHEN d.status = 'won' THEN d."valueCents" ELSE 0 END), 0)::bigint AS "wonValueCents"
    FROM deals d
    ${pipelineJoin}
    LEFT JOIN crm_users u ON u.id = d."ownerUserId"
    WHERE ${conds.join(' AND ')} AND d."ownerUserId" IS NOT NULL
    GROUP BY d."ownerUserId", u.name
    ORDER BY "wonValueCents" DESC, "wonDeals" DESC
    LIMIT ${safeLimit}
  `));

  return rowsOf(result).map((r: any) => {
    const won = Number(r.wonDeals || 0);
    const lost = Number(r.lostDeals || 0);
    const decided = won + lost;
    return {
      ownerUserId: Number(r.ownerUserId),
      ownerName: String(r.ownerName || '—'),
      totalDeals: Number(r.totalDeals || 0),
      wonDeals: won,
      lostDeals: lost,
      wonValueCents: Number(r.wonValueCents || 0),
      conversionRate: decided > 0 ? Math.round((won / decided) * 10000) / 100 : 0,
    };
  });
}

/* ─── 7. Lead Sources — top origens de leads ─── */
export async function getLeadSources(f: AnalyticsFilters, limit = 8): Promise<LeadSourceRow[]> {
  const db = await getDb();
  if (!db) return [];

  const tenantId = safeInt(f.tenantId)!;
  const dateFrom = safeDate(f.dateFrom);
  const dateTo = safeDate(f.dateTo);
  const pipelineId = safeInt(f.pipelineId);
  const ownerUserId = safeInt(f.ownerUserId);
  const pipelineType = safePipelineType(f.pipelineType);
  const safeLimit = Math.min(Math.max(safeInt(limit) ?? 8, 1), 30);

  const conds: string[] = [`d."tenantId" = ${tenantId}`, `d."deletedAt" IS NULL`];
  if (dateFrom) conds.push(`d."createdAt" >= '${dateFrom} 00:00:00'`);
  if (dateTo) conds.push(`d."createdAt" <= '${dateTo} 23:59:59'`);
  if (pipelineId) conds.push(`d."pipelineId" = ${pipelineId}`);
  if (ownerUserId) conds.push(`d."ownerUserId" = ${ownerUserId}`);
  const pipelineJoin = pipelineType ? `INNER JOIN pipelines p ON p.id = d."pipelineId" AND p."pipelineType" = '${pipelineType}'` : '';

  const result = await db.execute(sql.raw(`
    SELECT
      COALESCE(NULLIF(TRIM(d."leadSource"), ''), '—') AS source,
      COUNT(*)::int AS "totalDeals",
      COUNT(*) FILTER (WHERE d.status = 'won')::int AS "wonDeals",
      COALESCE(SUM(CASE WHEN d.status = 'won' THEN d."valueCents" ELSE 0 END), 0)::bigint AS "wonValueCents",
      COUNT(*) FILTER (WHERE d.status IN ('won','lost'))::int AS decided
    FROM deals d
    ${pipelineJoin}
    WHERE ${conds.join(' AND ')}
    GROUP BY COALESCE(NULLIF(TRIM(d."leadSource"), ''), '—')
    ORDER BY "totalDeals" DESC, "wonValueCents" DESC
    LIMIT ${safeLimit}
  `));

  return rowsOf(result).map((r: any) => {
    const won = Number(r.wonDeals || 0);
    const decided = Number(r.decided || 0);
    return {
      source: String(r.source),
      totalDeals: Number(r.totalDeals || 0),
      wonDeals: won,
      wonValueCents: Number(r.wonValueCents || 0),
      conversionRate: decided > 0 ? Math.round((won / decided) * 10000) / 100 : 0,
    };
  });
}

/* ─── 8. Forecast — projeção ponderada do pipeline aberto ─── */
export async function getForecast(f: AnalyticsFilters): Promise<ForecastResult> {
  const db = await getDb();
  if (!db) return { openDeals: 0, openValueCents: 0, weightedForecastCents: 0, avgProbability: 0 };

  const tenantId = safeInt(f.tenantId)!;
  const pipelineId = safeInt(f.pipelineId);
  const ownerUserId = safeInt(f.ownerUserId);
  const pipelineType = safePipelineType(f.pipelineType);

  const conds: string[] = [`d."tenantId" = ${tenantId}`, `d."deletedAt" IS NULL`, `d.status = 'open'`];
  if (pipelineId) conds.push(`d."pipelineId" = ${pipelineId}`);
  if (ownerUserId) conds.push(`d."ownerUserId" = ${ownerUserId}`);
  const pipelineJoin = pipelineType ? `INNER JOIN pipelines p ON p.id = d."pipelineId" AND p."pipelineType" = '${pipelineType}'` : '';

  const result = await db.execute(sql.raw(`
    SELECT
      COUNT(*)::int AS "openDeals",
      COALESCE(SUM(d."valueCents"), 0)::bigint AS "openValueCents",
      COALESCE(SUM(d."valueCents" * COALESCE(d.probability, 0) / 100.0), 0)::bigint AS "weightedForecastCents",
      COALESCE(AVG(NULLIF(d.probability, 0)), 0) AS "avgProbability"
    FROM deals d
    ${pipelineJoin}
    WHERE ${conds.join(' AND ')}
  `));

  const r = rowsOf(result)[0] as any || {};
  return {
    openDeals: Number(r.openDeals || 0),
    openValueCents: Number(r.openValueCents || 0),
    weightedForecastCents: Number(r.weightedForecastCents || 0),
    avgProbability: Math.round(Number(r.avgProbability || 0)),
  };
}

/* ─── 9. Stagnation — open deals sem atividade há > thresholdDays ─── */
export async function getStagnation(f: AnalyticsFilters, thresholdDays = 14, listLimit = 10): Promise<StagnationResult> {
  const db = await getDb();
  if (!db) return { stagnantCount: 0, thresholdDays, totalOpen: 0, topStagnant: [] };

  const tenantId = safeInt(f.tenantId)!;
  const pipelineId = safeInt(f.pipelineId);
  const ownerUserId = safeInt(f.ownerUserId);
  const pipelineType = safePipelineType(f.pipelineType);
  const safeThreshold = Math.min(Math.max(safeInt(thresholdDays) ?? 14, 1), 365);
  const safeListLimit = Math.min(Math.max(safeInt(listLimit) ?? 10, 1), 50);

  const conds: string[] = [`d."tenantId" = ${tenantId}`, `d."deletedAt" IS NULL`, `d.status = 'open'`];
  if (pipelineId) conds.push(`d."pipelineId" = ${pipelineId}`);
  if (ownerUserId) conds.push(`d."ownerUserId" = ${ownerUserId}`);
  const pipelineJoin = pipelineType ? `INNER JOIN pipelines p ON p.id = d."pipelineId" AND p."pipelineType" = '${pipelineType}'` : '';

  const aggResult = await db.execute(sql.raw(`
    SELECT
      COUNT(*)::int AS "totalOpen",
      COUNT(*) FILTER (
        WHERE COALESCE(d."lastActivityAt", d."updatedAt", d."createdAt") < NOW() - INTERVAL '${safeThreshold} days'
      )::int AS "stagnantCount"
    FROM deals d
    ${pipelineJoin}
    WHERE ${conds.join(' AND ')}
  `));
  const agg = rowsOf(aggResult)[0] as any || {};

  const topResult = await db.execute(sql.raw(`
    SELECT
      d.id, d.title, d."valueCents",
      ps.name AS "stageName",
      u.name AS "ownerName",
      EXTRACT(EPOCH FROM (NOW() - COALESCE(d."lastActivityAt", d."updatedAt", d."createdAt"))) / 86400 AS "daysSinceActivity"
    FROM deals d
    ${pipelineJoin}
    LEFT JOIN pipeline_stages ps ON ps.id = d."stageId"
    LEFT JOIN crm_users u ON u.id = d."ownerUserId"
    WHERE ${conds.join(' AND ')}
      AND COALESCE(d."lastActivityAt", d."updatedAt", d."createdAt") < NOW() - INTERVAL '${safeThreshold} days'
    ORDER BY d."valueCents" DESC NULLS LAST, "daysSinceActivity" DESC
    LIMIT ${listLimit}
  `));

  return {
    thresholdDays,
    totalOpen: Number(agg.totalOpen || 0),
    stagnantCount: Number(agg.stagnantCount || 0),
    topStagnant: rowsOf(topResult).map((r: any) => ({
      id: Number(r.id),
      title: String(r.title || ''),
      valueCents: Number(r.valueCents || 0),
      stageName: r.stageName || null,
      ownerName: r.ownerName || null,
      daysSinceActivity: Math.floor(Number(r.daysSinceActivity || 0)),
    })),
  };
}
