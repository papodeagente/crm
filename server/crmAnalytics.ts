/**
 * CRM Analytics — Isolated query helpers for the Analytics page.
 * Does NOT modify any existing table or query. Read-only aggregations.
 */
import { eq, and, sql, gte, lte, isNull, desc } from "drizzle-orm";
import { getDb } from "./db";
import { deals, lossReasons, pipelines, pipelineStages } from "../drizzle/schema";

/* ─── Types ─── */
export interface AnalyticsFilters {
  tenantId: number;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  pipelineId?: number;
  ownerUserId?: number;
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

export interface DealsByPeriod {
  period: string;  // YYYY-MM or YYYY-MM-DD depending on granularity
  won: number;
  lost: number;
  open: number;
  wonValueCents: number;
  lostValueCents: number;
}

/* ─── Helpers ─── */
function buildConditions(f: AnalyticsFilters) {
  const conds: any[] = [eq(deals.tenantId, f.tenantId), isNull(deals.deletedAt)];
  if (f.dateFrom) conds.push(gte(deals.createdAt, new Date(f.dateFrom + "T00:00:00")));
  if (f.dateTo) conds.push(lte(deals.createdAt, new Date(f.dateTo + "T23:59:59")));
  if (f.pipelineId) conds.push(eq(deals.pipelineId, f.pipelineId));
  if (f.ownerUserId) conds.push(eq(deals.ownerUserId, f.ownerUserId));
  return and(...conds);
}

/* ─── 1. Summary KPIs ─── */
export async function getAnalyticsSummary(f: AnalyticsFilters): Promise<AnalyticsSummary> {
  const db = await getDb();
  if (!db) return { totalDeals: 0, openDeals: 0, wonDeals: 0, lostDeals: 0, totalValueCents: 0, wonValueCents: 0, lostValueCents: 0, openValueCents: 0, conversionRate: 0, avgTicketCents: 0, avgCycleDays: 0 };

  const where = buildConditions(f);

  const rows = await db.select({
    status: deals.status,
    cnt: sql<number>`COUNT(*)`,
    val: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
    avgCycle: sql<number>`COALESCE(AVG(DATEDIFF(${deals.updatedAt}, ${deals.createdAt})), 0)`,
  }).from(deals).where(where).groupBy(deals.status);

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

  const rows = await db.select({
    reasonId: deals.lossReasonId,
    reasonName: sql<string>`COALESCE(${lossReasons.name}, 'Sem motivo')`,
    count: sql<number>`COUNT(*)`,
    valueCents: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
  })
    .from(deals)
    .leftJoin(lossReasons, eq(deals.lossReasonId, lossReasons.id))
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

/* ─── 4. Deals by Period (monthly) ─── */
export async function getDealsByPeriod(f: AnalyticsFilters): Promise<DealsByPeriod[]> {
  const db = await getDb();
  if (!db) return [];

  const where = buildConditions(f);

  const periodExpr = sql<string>`DATE_FORMAT(${deals.createdAt}, '%Y-%m')`.as('period');
  const rows = await db.select({
    period: periodExpr,
    status: deals.status,
    cnt: sql<number>`COUNT(*)`,
    val: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
  })
    .from(deals)
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
