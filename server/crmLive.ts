/**
 * CRM Live Report — Backend helpers
 * 
 * Two main views:
 * 1. Cover (Capa Executiva): performance highlights, KPIs with period comparison, conversion, losses, top loss reasons
 * 2. Operation (Operação Pipeline): open deals summary, task feed, stage distribution, probability grouping
 */

import { getDb } from "./db";
import { deals, crmUsers, pipelineStages, lossReasons, tasks } from "../drizzle/schema";
import { eq, and, gte, lte, sql, desc, inArray, count, sum } from "drizzle-orm";

/* ─── Types ─── */

export interface CrmLiveFilters {
  tenantId: number;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  pipelineId?: number;
  ownerUserId?: number;
}

export interface PerformanceHighlight {
  userId: number;
  userName: string;
  avatarUrl: string | null;
  value: number;
}

export interface PeriodComparison {
  current: number;
  previous: number;
}

export interface LossReasonTop {
  name: string;
  count: number;
  percentage: number;
}

export interface CrmLiveCoverData {
  // Tab context
  tab: "finalized" | "in_progress";
  
  // Performance highlights (finalized tab)
  topDealCreator: PerformanceHighlight | null;
  topSellerByUnits: PerformanceHighlight | null;
  topSellerByValue: PerformanceHighlight | null;
  
  // KPIs with period comparison
  newDeals: PeriodComparison;
  salesUnits: PeriodComparison;
  salesValueCents: PeriodComparison;
  
  // Conversion
  conversionRate: number; // percentage
  
  // Losses
  lostDeals: PeriodComparison;
  
  // Top 3 loss reasons
  topLossReasons: LossReasonTop[];
}

export interface StageDistribution {
  stageId: number;
  stageName: string;
  orderIndex: number;
  dealCount: number;
  valueCents: number;
}

export interface TaskFeedItem {
  id: number;
  title: string;
  taskType: string;
  status: string;
  assignedUserName: string | null;
  dueAt: Date | null;
  updatedAt: Date;
}

export interface ProbabilityGroup {
  label: string;
  stars: number;
  dealCount: number;
  valueCents: number;
}

export interface CrmLiveOperationData {
  // Tab context
  tab: "finalized" | "in_progress";
  
  // Summary
  totalDeals: number;
  totalValueCents: number;
  
  // Task feed (recent activities)
  taskFeed: TaskFeedItem[];
  
  // Stage distribution
  stages: StageDistribution[];
  
  // Probability grouping (operational lower section)
  probabilityGroups: ProbabilityGroup[];
  
  // Finalized-specific
  wonCount?: number;
  wonValueCents?: number;
  lostCount?: number;
  lostValueCents?: number;
}

/* ─── Helpers ─── */

function buildDateConditions(f: CrmLiveFilters) {
  const conds = [eq(deals.tenantId, f.tenantId)];
  if (f.dateFrom) conds.push(gte(deals.createdAt, new Date(f.dateFrom + "T00:00:00")));
  if (f.dateTo) conds.push(lte(deals.createdAt, new Date(f.dateTo + "T23:59:59")));
  if (f.pipelineId) conds.push(eq(deals.pipelineId, f.pipelineId));
  if (f.ownerUserId) conds.push(eq(deals.ownerUserId, f.ownerUserId));
  return conds;
}

/** Calculate the previous period equivalent dates */
function getPreviousPeriod(dateFrom?: string, dateTo?: string): { prevFrom: string; prevTo: string } {
  if (!dateFrom || !dateTo) {
    // Default: current month vs previous month
    const now = new Date();
    const curFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const curTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevTo = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      prevFrom: prevFrom.toISOString().split("T")[0],
      prevTo: prevTo.toISOString().split("T")[0],
    };
  }
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const diffMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 86400000); // day before dateFrom
  const prevFrom = new Date(prevTo.getTime() - diffMs);
  return {
    prevFrom: prevFrom.toISOString().split("T")[0],
    prevTo: prevTo.toISOString().split("T")[0],
  };
}

/* ─── Cover Data ─── */

export async function getCrmLiveCover(f: CrmLiveFilters, tab: "finalized" | "in_progress"): Promise<CrmLiveCoverData> {
  const db = await getDb();
  const emptyResult: CrmLiveCoverData = { tab, topDealCreator: null, topSellerByUnits: null, topSellerByValue: null, newDeals: { current: 0, previous: 0 }, salesUnits: { current: 0, previous: 0 }, salesValueCents: { current: 0, previous: 0 }, conversionRate: 0, lostDeals: { current: 0, previous: 0 }, topLossReasons: [] };
  if (!db) return emptyResult;
  const { prevFrom, prevTo } = getPreviousPeriod(f.dateFrom, f.dateTo);

  // Base conditions for current period
  const baseConds = buildDateConditions(f);
  
  // Tab-specific status filter
  const statusConds = tab === "finalized"
    ? [...baseConds, inArray(deals.status, ["won", "lost"])]
    : [...baseConds, eq(deals.status, "open")];

  // ── Performance Highlights ──
  // Top deal creator (by count of deals created)
  const topCreatorRows = await db
    .select({
      userId: deals.ownerUserId,
      cnt: count().as("cnt"),
    })
    .from(deals)
    .where(and(...baseConds))
    .groupBy(deals.ownerUserId)
    .orderBy(desc(sql`cnt`))
    .limit(1);

  // Top seller by units (won deals count)
  const topSellerUnitsRows = await db
    .select({
      userId: deals.ownerUserId,
      cnt: count().as("cnt"),
    })
    .from(deals)
    .where(and(...baseConds, eq(deals.status, "won")))
    .groupBy(deals.ownerUserId)
    .orderBy(desc(sql`cnt`))
    .limit(1);

  // Top seller by value (won deals value)
  const topSellerValueRows = await db
    .select({
      userId: deals.ownerUserId,
      totalValue: sum(deals.valueCents).as("totalValue"),
    })
    .from(deals)
    .where(and(...baseConds, eq(deals.status, "won")))
    .groupBy(deals.ownerUserId)
    .orderBy(desc(sql`totalValue`))
    .limit(1);

  // Resolve user names
  async function resolveUser(userId: number | null): Promise<PerformanceHighlight | null> {
    if (!userId) return null;
    const [user] = await db!
      .select({ id: crmUsers.id, name: crmUsers.name, avatarUrl: crmUsers.avatarUrl })
      .from(crmUsers)
      .where(and(eq(crmUsers.tenantId, f.tenantId), eq(crmUsers.id, userId)))
      .limit(1);
    return user ? { userId: user.id, userName: user.name, avatarUrl: user.avatarUrl } as PerformanceHighlight : null;
  }

  const topCreator = topCreatorRows[0];
  const topSellerUnits = topSellerUnitsRows[0];
  const topSellerValue = topSellerValueRows[0];

  const topDealCreator = topCreator?.userId
    ? { ...(await resolveUser(topCreator.userId))!, value: Number(topCreator.cnt) }
    : null;
  const topSellerByUnits = topSellerUnits?.userId
    ? { ...(await resolveUser(topSellerUnits.userId))!, value: Number(topSellerUnits.cnt) }
    : null;
  const topSellerByValue = topSellerValue?.userId
    ? { ...(await resolveUser(topSellerValue.userId))!, value: Number(topSellerValue.totalValue || 0) }
    : null;

  // ── KPIs: Current Period ──
  const [currentStats] = await db
    .select({
      totalDeals: count().as("totalDeals"),
      wonCount: sql<number>`SUM(CASE WHEN ${deals.status} = 'won' THEN 1 ELSE 0 END)`.as("wonCount"),
      lostCount: sql<number>`SUM(CASE WHEN ${deals.status} = 'lost' THEN 1 ELSE 0 END)`.as("lostCount"),
      wonValueCents: sql<number>`SUM(CASE WHEN ${deals.status} = 'won' THEN ${deals.valueCents} ELSE 0 END)`.as("wonValueCents"),
    })
    .from(deals)
    .where(and(...baseConds));

  // ── KPIs: Previous Period ──
  const prevConds = [eq(deals.tenantId, f.tenantId)];
  prevConds.push(gte(deals.createdAt, new Date(prevFrom + "T00:00:00")));
  prevConds.push(lte(deals.createdAt, new Date(prevTo + "T23:59:59")));
  if (f.pipelineId) prevConds.push(eq(deals.pipelineId, f.pipelineId));
  if (f.ownerUserId) prevConds.push(eq(deals.ownerUserId, f.ownerUserId));

  const [prevStats] = await db
    .select({
      totalDeals: count().as("totalDeals"),
      wonCount: sql<number>`SUM(CASE WHEN ${deals.status} = 'won' THEN 1 ELSE 0 END)`.as("wonCount"),
      lostCount: sql<number>`SUM(CASE WHEN ${deals.status} = 'lost' THEN 1 ELSE 0 END)`.as("lostCount"),
      wonValueCents: sql<number>`SUM(CASE WHEN ${deals.status} = 'won' THEN ${deals.valueCents} ELSE 0 END)`.as("wonValueCents"),
    })
    .from(deals)
    .where(and(...prevConds));

  const curTotal = Number(currentStats?.totalDeals || 0);
  const curWon = Number(currentStats?.wonCount || 0);
  const curLost = Number(currentStats?.lostCount || 0);
  const curWonValue = Number(currentStats?.wonValueCents || 0);
  const prevTotal = Number(prevStats?.totalDeals || 0);
  const prevWon = Number(prevStats?.wonCount || 0);
  const prevLost = Number(prevStats?.lostCount || 0);
  const prevWonValue = Number(prevStats?.wonValueCents || 0);

  // Conversion rate: won / total created
  const conversionRate = curTotal > 0 ? (curWon / curTotal) * 100 : 0;

  // ── Top 3 Loss Reasons ──
  const lossReasonRows = await db
    .select({
      name: lossReasons.name,
      cnt: count().as("cnt"),
    })
    .from(deals)
    .innerJoin(lossReasons, and(
      eq(deals.lossReasonId, lossReasons.id),
      eq(lossReasons.tenantId, f.tenantId)
    ))
    .where(and(...baseConds, eq(deals.status, "lost")))
    .groupBy(lossReasons.name)
    .orderBy(desc(sql`cnt`))
    .limit(3);

  const totalLostForReasons = lossReasonRows.reduce((s, r) => s + Number(r.cnt), 0);
  const topLossReasons: LossReasonTop[] = lossReasonRows.map(r => ({
    name: r.name,
    count: Number(r.cnt),
    percentage: totalLostForReasons > 0 ? (Number(r.cnt) / curLost) * 100 : 0,
  }));

  return {
    tab,
    topDealCreator,
    topSellerByUnits,
    topSellerByValue,
    newDeals: { current: curTotal, previous: prevTotal },
    salesUnits: { current: curWon, previous: prevWon },
    salesValueCents: { current: curWonValue, previous: prevWonValue },
    conversionRate: Math.round(conversionRate * 100) / 100,
    lostDeals: { current: curLost, previous: prevLost },
    topLossReasons,
  };
}

/* ─── Operation Data ─── */

export async function getCrmLiveOperation(f: CrmLiveFilters, tab: "finalized" | "in_progress"): Promise<CrmLiveOperationData> {
  const db = await getDb();
  const emptyResult: CrmLiveOperationData = { tab, totalDeals: 0, totalValueCents: 0, taskFeed: [], stages: [], probabilityGroups: [] };
  if (!db) return emptyResult;

  const baseConds = buildDateConditions(f);

  if (tab === "in_progress") {
    // ── In Progress: Open deals ──
    const openConds = [...baseConds, eq(deals.status, "open")];

    // Summary
    const [summary] = await db
      .select({
        totalDeals: count().as("totalDeals"),
        totalValueCents: sum(deals.valueCents).as("totalValueCents"),
      })
      .from(deals)
      .where(and(...openConds));

    // Task feed: recent tasks for this tenant
    const taskFeedRows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        taskType: tasks.taskType,
        status: tasks.status,
        assignedToUserId: tasks.assignedToUserId,
        dueAt: tasks.dueAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .where(and(
        eq(tasks.tenantId, f.tenantId),
        ...(f.dateFrom ? [gte(tasks.updatedAt, new Date(f.dateFrom + "T00:00:00"))] : []),
        ...(f.dateTo ? [lte(tasks.updatedAt, new Date(f.dateTo + "T23:59:59"))] : []),
      ))
      .orderBy(desc(tasks.updatedAt))
      .limit(10);

    // Resolve user names for tasks
    const userIdsSet = new Set<number>();
    taskFeedRows.forEach(t => { if (t.assignedToUserId) userIdsSet.add(t.assignedToUserId); });
    const userIds = Array.from(userIdsSet);
    const userMap = new Map<number, string>();
    if (userIds.length > 0) {
      const users = await db
        .select({ id: crmUsers.id, name: crmUsers.name })
        .from(crmUsers)
        .where(and(eq(crmUsers.tenantId, f.tenantId), inArray(crmUsers.id, userIds)));
      users.forEach(u => userMap.set(u.id, u.name));
    }

    const taskFeed: TaskFeedItem[] = taskFeedRows.map(t => ({
      id: t.id,
      title: t.title,
      taskType: t.taskType || "task",
      status: t.status,
      assignedUserName: t.assignedToUserId ? (userMap.get(t.assignedToUserId) || null) : null,
      dueAt: t.dueAt,
      updatedAt: t.updatedAt,
    }));

    // Stage distribution: need pipelineId
    let stageRows: StageDistribution[] = [];
    const pipelineId = f.pipelineId;
    if (pipelineId) {
      const stageDistRows = await db
        .select({
          stageId: deals.stageId,
          dealCount: count().as("dealCount"),
          valueCents: sum(deals.valueCents).as("valueCents"),
        })
        .from(deals)
        .where(and(...openConds, eq(deals.pipelineId, pipelineId)))
        .groupBy(deals.stageId);

      // Get stage names
      const stageInfoRows = await db
        .select({ id: pipelineStages.id, name: pipelineStages.name, orderIndex: pipelineStages.orderIndex })
        .from(pipelineStages)
        .where(and(eq(pipelineStages.tenantId, f.tenantId), eq(pipelineStages.pipelineId, pipelineId)))
        .orderBy(pipelineStages.orderIndex);

      const stageMap = new Map(stageDistRows.map(s => [s.stageId, s]));
      stageRows = stageInfoRows.map(si => ({
        stageId: si.id,
        stageName: si.name,
        orderIndex: si.orderIndex,
        dealCount: Number(stageMap.get(si.id)?.dealCount || 0),
        valueCents: Number(stageMap.get(si.id)?.valueCents || 0),
      }));
    }

    // Probability grouping for open deals
    const probGroups = await db
      .select({
        probability: deals.probability,
        dealCount: count().as("dealCount"),
        valueCents: sum(deals.valueCents).as("valueCents"),
      })
      .from(deals)
      .where(and(...openConds))
      .groupBy(deals.probability);

    // Group by star rating (0-20=1star, 21-40=2stars, 41-60=3stars, 61-80=4stars, 81-100=5stars)
    const starBuckets: ProbabilityGroup[] = [
      { label: "Muito baixa", stars: 1, dealCount: 0, valueCents: 0 },
      { label: "Baixa", stars: 2, dealCount: 0, valueCents: 0 },
      { label: "Média", stars: 3, dealCount: 0, valueCents: 0 },
      { label: "Alta", stars: 4, dealCount: 0, valueCents: 0 },
      { label: "Muito alta", stars: 5, dealCount: 0, valueCents: 0 },
    ];

    for (const pg of probGroups) {
      const prob = Number(pg.probability || 0);
      const idx = prob <= 20 ? 0 : prob <= 40 ? 1 : prob <= 60 ? 2 : prob <= 80 ? 3 : 4;
      starBuckets[idx].dealCount += Number(pg.dealCount);
      starBuckets[idx].valueCents += Number(pg.valueCents || 0);
    }

    return {
      tab,
      totalDeals: Number(summary?.totalDeals || 0),
      totalValueCents: Number(summary?.totalValueCents || 0),
      taskFeed,
      stages: stageRows,
      probabilityGroups: starBuckets,
    };
  } else {
    // ── Finalized: Won + Lost deals ──
    const finalConds = [...baseConds, inArray(deals.status, ["won", "lost"])];

    const [summary] = await db
      .select({
        totalDeals: count().as("totalDeals"),
        totalValueCents: sum(deals.valueCents).as("totalValueCents"),
        wonCount: sql<number>`SUM(CASE WHEN ${deals.status} = 'won' THEN 1 ELSE 0 END)`.as("wonCount"),
        wonValueCents: sql<number>`SUM(CASE WHEN ${deals.status} = 'won' THEN ${deals.valueCents} ELSE 0 END)`.as("wonValueCents"),
        lostCount: sql<number>`SUM(CASE WHEN ${deals.status} = 'lost' THEN 1 ELSE 0 END)`.as("lostCount"),
        lostValueCents: sql<number>`SUM(CASE WHEN ${deals.status} = 'lost' THEN ${deals.valueCents} ELSE 0 END)`.as("lostValueCents"),
      })
      .from(deals)
      .where(and(...finalConds));

    // Task feed: recent completed/cancelled tasks
    const taskFeedRows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        taskType: tasks.taskType,
        status: tasks.status,
        assignedToUserId: tasks.assignedToUserId,
        dueAt: tasks.dueAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .where(and(
        eq(tasks.tenantId, f.tenantId),
        inArray(tasks.status, ["done", "cancelled"]),
        ...(f.dateFrom ? [gte(tasks.updatedAt, new Date(f.dateFrom + "T00:00:00"))] : []),
        ...(f.dateTo ? [lte(tasks.updatedAt, new Date(f.dateTo + "T23:59:59"))] : []),
      ))
      .orderBy(desc(tasks.updatedAt))
      .limit(10);

    const userIdsSet2 = new Set<number>();
    taskFeedRows.forEach(t => { if (t.assignedToUserId) userIdsSet2.add(t.assignedToUserId); });
    const userIds = Array.from(userIdsSet2);
    const userMap = new Map<number, string>();
    if (userIds.length > 0) {
      const users = await db
        .select({ id: crmUsers.id, name: crmUsers.name })
        .from(crmUsers)
        .where(and(eq(crmUsers.tenantId, f.tenantId), inArray(crmUsers.id, userIds)));
      users.forEach(u => userMap.set(u.id, u.name));
    }

    const taskFeed: TaskFeedItem[] = taskFeedRows.map(t => ({
      id: t.id,
      title: t.title,
      taskType: t.taskType || "task",
      status: t.status,
      assignedUserName: t.assignedToUserId ? (userMap.get(t.assignedToUserId) || null) : null,
      dueAt: t.dueAt,
      updatedAt: t.updatedAt,
    }));

    // Stage distribution for finalized
    let stageRows: StageDistribution[] = [];
    const pipelineId = f.pipelineId;
    if (pipelineId) {
      const stageDistRows = await db
        .select({
          stageId: deals.stageId,
          dealCount: count().as("dealCount"),
          valueCents: sum(deals.valueCents).as("valueCents"),
        })
        .from(deals)
        .where(and(...finalConds, eq(deals.pipelineId, pipelineId)))
        .groupBy(deals.stageId);

      const stageInfoRows = await db
        .select({ id: pipelineStages.id, name: pipelineStages.name, orderIndex: pipelineStages.orderIndex })
        .from(pipelineStages)
        .where(and(eq(pipelineStages.tenantId, f.tenantId), eq(pipelineStages.pipelineId, pipelineId)))
        .orderBy(pipelineStages.orderIndex);

      const stageMap = new Map(stageDistRows.map(s => [s.stageId, s]));
      stageRows = stageInfoRows.map(si => ({
        stageId: si.id,
        stageName: si.name,
        orderIndex: si.orderIndex,
        dealCount: Number(stageMap.get(si.id)?.dealCount || 0),
        valueCents: Number(stageMap.get(si.id)?.valueCents || 0),
      }));
    }

    // Probability grouping for finalized
    const probGroups = await db
      .select({
        probability: deals.probability,
        dealCount: count().as("dealCount"),
        valueCents: sum(deals.valueCents).as("valueCents"),
      })
      .from(deals)
      .where(and(...finalConds))
      .groupBy(deals.probability);

    const starBuckets: ProbabilityGroup[] = [
      { label: "Muito baixa", stars: 1, dealCount: 0, valueCents: 0 },
      { label: "Baixa", stars: 2, dealCount: 0, valueCents: 0 },
      { label: "Média", stars: 3, dealCount: 0, valueCents: 0 },
      { label: "Alta", stars: 4, dealCount: 0, valueCents: 0 },
      { label: "Muito alta", stars: 5, dealCount: 0, valueCents: 0 },
    ];

    for (const pg of probGroups) {
      const prob = Number(pg.probability || 0);
      const idx = prob <= 20 ? 0 : prob <= 40 ? 1 : prob <= 60 ? 2 : prob <= 80 ? 3 : 4;
      starBuckets[idx].dealCount += Number(pg.dealCount);
      starBuckets[idx].valueCents += Number(pg.valueCents || 0);
    }

    return {
      tab,
      totalDeals: Number(summary?.totalDeals || 0),
      totalValueCents: Number(summary?.totalValueCents || 0),
      taskFeed,
      stages: stageRows,
      probabilityGroups: starBuckets,
      wonCount: Number(summary?.wonCount || 0),
      wonValueCents: Number(summary?.wonValueCents || 0),
      lostCount: Number(summary?.lostCount || 0),
      lostValueCents: Number(summary?.lostValueCents || 0),
    };
  }
}
