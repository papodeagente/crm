/**
 * SaaS Metrics Service
 *
 * Provides key SaaS metrics for the Super Admin dashboard:
 * - MRR (Monthly Recurring Revenue)
 * - Churn rate
 * - Subscriber evolution over time
 * - Distribution by plan and billing status
 * - Hotmart integration health
 * - LTV, ARPU, trial conversion rate
 */

import { eq, sql, desc, and, gte, lte, count } from "drizzle-orm";
import { getDb } from "../db";
import { tenants, subscriptions, subscriptionEvents, crmUsers } from "../../drizzle/schema";
import { PLANS, getPlanDefinition, type PlanId } from "../../shared/plans";

// ─── Types ─────────────────────────────────────────────────────────

export interface SaasOverview {
  totalTenants: number;
  activeTenants: number;
  trialingTenants: number;
  legacyTenants: number;
  restrictedTenants: number;
  cancelledTenants: number;
  totalUsers: number;
  mrr: number; // in cents
  mrrFormatted: string;
  arpu: number; // in cents (MRR / active paying tenants)
  arpuFormatted: string;
}

export interface ChurnMetrics {
  currentMonth: {
    churned: number;
    startOfMonth: number;
    rate: number; // percentage
  };
  previousMonth: {
    churned: number;
    startOfMonth: number;
    rate: number;
  };
  trend: "up" | "down" | "stable";
}

export interface PlanDistribution {
  plan: string;
  planName: string;
  count: number;
  percentage: number;
  mrr: number;
}

export interface BillingStatusDistribution {
  status: string;
  label: string;
  count: number;
  percentage: number;
}

export interface MonthlyEvolution {
  month: string; // YYYY-MM
  label: string; // "Jan 2026"
  totalTenants: number;
  activePaying: number;
  trialing: number;
  churned: number;
  newSignups: number;
  mrr: number;
}

export interface HotmartHealth {
  lastEventAt: Date | null;
  lastEventType: string | null;
  lastEventTenantName: string | null;
  totalEventsToday: number;
  totalEventsThisWeek: number;
  totalEventsThisMonth: number;
  processedEvents: number;
  failedEvents: number;
  hottokConfigured: boolean;
  webhookUrl: string;
  status: "healthy" | "warning" | "error" | "no_events";
}

export interface TrialConversion {
  totalTrials: number;
  converted: number;
  expired: number;
  active: number;
  conversionRate: number; // percentage
}

export interface RecentEvent {
  id: number;
  tenantId: number | null;
  tenantName: string | null;
  externalEvent: string;
  internalStatus: string;
  buyerEmail: string | null;
  transactionId: string | null;
  processed: boolean;
  errorMessage: string | null;
  createdAt: Date;
}

// ─── Service Functions ─────────────────────────────────────────────

export async function getSaasOverview(): Promise<SaasOverview> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const allTenants = await db.select().from(tenants);
  const allUsers = await db.select({ count: count() }).from(crmUsers);

  const totalTenants = allTenants.length;
  const activeTenants = allTenants.filter(t => t.billingStatus === "active" && !t.isLegacy).length;
  const trialingTenants = allTenants.filter(t => t.billingStatus === "trialing").length;
  const legacyTenants = allTenants.filter(t => t.isLegacy).length;
  const restrictedTenants = allTenants.filter(t => t.billingStatus === "restricted" || t.billingStatus === "expired").length;
  const cancelledTenants = allTenants.filter(t => t.billingStatus === "cancelled").length;
  const totalUsers = allUsers[0]?.count || 0;

  // Calculate MRR from active subscriptions
  const activeSubs = await db.select().from(subscriptions)
    .where(eq(subscriptions.status, "active"));

  let mrr = 0;
  for (const sub of activeSubs) {
    mrr += sub.priceInCents || 0;
  }

  const payingTenants = activeTenants > 0 ? activeTenants : 1;
  const arpu = Math.round(mrr / payingTenants);

  return {
    totalTenants,
    activeTenants,
    trialingTenants,
    legacyTenants,
    restrictedTenants,
    cancelledTenants,
    totalUsers,
    mrr,
    mrrFormatted: formatBRL(mrr),
    arpu,
    arpuFormatted: formatBRL(arpu),
  };
}

export async function getChurnMetrics(): Promise<ChurnMetrics> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Count cancellations this month
  const currentMonthChurned = await db.select({ count: count() }).from(subscriptionEvents)
    .where(and(
      gte(subscriptionEvents.createdAt, startOfCurrentMonth),
      eq(subscriptionEvents.internalStatus, "cancelled"),
    ));

  // Count cancellations previous month
  const prevMonthChurned = await db.select({ count: count() }).from(subscriptionEvents)
    .where(and(
      gte(subscriptionEvents.createdAt, startOfPreviousMonth),
      lte(subscriptionEvents.createdAt, startOfCurrentMonth),
      eq(subscriptionEvents.internalStatus, "cancelled"),
    ));

  // Count active tenants at start of each month (approximate)
  const allTenants = await db.select().from(tenants);
  const tenantsAtStartCurrent = allTenants.filter(t =>
    t.createdAt < startOfCurrentMonth && !t.isLegacy
  ).length || 1;
  const tenantsAtStartPrev = allTenants.filter(t =>
    t.createdAt < startOfPreviousMonth && !t.isLegacy
  ).length || 1;

  const currentChurned = currentMonthChurned[0]?.count || 0;
  const prevChurned = prevMonthChurned[0]?.count || 0;

  const currentRate = (currentChurned / tenantsAtStartCurrent) * 100;
  const prevRate = (prevChurned / tenantsAtStartPrev) * 100;

  return {
    currentMonth: {
      churned: currentChurned,
      startOfMonth: tenantsAtStartCurrent,
      rate: Math.round(currentRate * 10) / 10,
    },
    previousMonth: {
      churned: prevChurned,
      startOfMonth: tenantsAtStartPrev,
      rate: Math.round(prevRate * 10) / 10,
    },
    trend: currentRate < prevRate ? "down" : currentRate > prevRate ? "up" : "stable",
  };
}

export async function getPlanDistribution(): Promise<PlanDistribution[]> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const allTenants = await db.select().from(tenants);
  const total = allTenants.length || 1;

  const planCounts: Record<string, { count: number; mrr: number }> = {};

  for (const t of allTenants) {
    const planDef = getPlanDefinition(t.plan);
    const key = planDef.id;
    if (!planCounts[key]) planCounts[key] = { count: 0, mrr: 0 };
    planCounts[key].count++;
    if (t.billingStatus === "active" && !t.isLegacy) {
      planCounts[key].mrr += planDef.priceInCents;
    }
  }

  return Object.entries(planCounts).map(([plan, data]) => ({
    plan,
    planName: getPlanDefinition(plan).name,
    count: data.count,
    percentage: Math.round((data.count / total) * 1000) / 10,
    mrr: data.mrr,
  }));
}

export async function getBillingStatusDistribution(): Promise<BillingStatusDistribution[]> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const allTenants = await db.select().from(tenants);
  const total = allTenants.length || 1;

  const labels: Record<string, string> = {
    active: "Ativo",
    trialing: "Trial",
    past_due: "Inadimplente",
    restricted: "Restrito",
    cancelled: "Cancelado",
    expired: "Expirado",
  };

  // Count legacy separately
  const legacyCount = allTenants.filter(t => t.isLegacy).length;
  const nonLegacy = allTenants.filter(t => !t.isLegacy);

  const statusCounts: Record<string, number> = {};
  for (const t of nonLegacy) {
    statusCounts[t.billingStatus] = (statusCounts[t.billingStatus] || 0) + 1;
  }

  const result: BillingStatusDistribution[] = [];

  if (legacyCount > 0) {
    result.push({
      status: "legacy",
      label: "Legacy",
      count: legacyCount,
      percentage: Math.round((legacyCount / total) * 1000) / 10,
    });
  }

  for (const [status, cnt] of Object.entries(statusCounts)) {
    result.push({
      status,
      label: labels[status] || status,
      count: cnt,
      percentage: Math.round((cnt / total) * 1000) / 10,
    });
  }

  return result.sort((a, b) => b.count - a.count);
}

export async function getMonthlyEvolution(months: number = 6): Promise<MonthlyEvolution[]> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const allTenants = await db.select().from(tenants);
  const allEvents = await db.select().from(subscriptionEvents);

  const now = new Date();
  const result: MonthlyEvolution[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    const label = monthDate.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

    // Tenants created up to end of this month
    const tenantsUpToMonth = allTenants.filter(t => t.createdAt < nextMonth);
    const newSignups = allTenants.filter(t => t.createdAt >= monthDate && t.createdAt < nextMonth).length;

    // Active paying (non-legacy, active billing)
    const activePaying = tenantsUpToMonth.filter(t =>
      t.billingStatus === "active" && !t.isLegacy
    ).length;

    const trialing = tenantsUpToMonth.filter(t => t.billingStatus === "trialing").length;

    // Churned this month
    const churned = allEvents.filter(e =>
      e.internalStatus === "cancelled" &&
      e.createdAt >= monthDate &&
      e.createdAt < nextMonth
    ).length;

    // MRR estimate
    let mrr = 0;
    for (const t of tenantsUpToMonth) {
      if (t.billingStatus === "active" && !t.isLegacy) {
        mrr += getPlanDefinition(t.plan).priceInCents;
      }
    }

    result.push({
      month: monthStr,
      label,
      totalTenants: tenantsUpToMonth.length,
      activePaying,
      trialing,
      churned,
      newSignups,
      mrr,
    });
  }

  return result;
}

export async function getHotmartHealth(): Promise<HotmartHealth> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Last event
  const lastEvents = await db.select().from(subscriptionEvents)
    .orderBy(desc(subscriptionEvents.createdAt))
    .limit(1);

  const lastEvent = lastEvents[0] || null;

  // Get tenant name for last event
  let lastEventTenantName: string | null = null;
  if (lastEvent?.tenantId) {
    const t = await db.select({ name: tenants.name }).from(tenants)
      .where(eq(tenants.id, lastEvent.tenantId))
      .limit(1);
    lastEventTenantName = t[0]?.name || null;
  }

  // Event counts
  const todayEvents = await db.select({ count: count() }).from(subscriptionEvents)
    .where(gte(subscriptionEvents.createdAt, todayStart));
  const weekEvents = await db.select({ count: count() }).from(subscriptionEvents)
    .where(gte(subscriptionEvents.createdAt, weekStart));
  const monthEvents = await db.select({ count: count() }).from(subscriptionEvents)
    .where(gte(subscriptionEvents.createdAt, monthStart));

  // Processed vs failed
  const processed = await db.select({ count: count() }).from(subscriptionEvents)
    .where(eq(subscriptionEvents.processed, true));
  const failed = await db.select({ count: count() }).from(subscriptionEvents)
    .where(and(
      eq(subscriptionEvents.processed, false),
      sql`${subscriptionEvents.errorMessage} IS NOT NULL`,
    ));

  const hottokConfigured = !!process.env.HOTMART_HOTTOK;
  const webhookUrl = `${process.env.VITE_APP_URL || "https://crm.acelerador.tur.br"}/api/hotmart/webhook`;

  // Determine health status
  let status: HotmartHealth["status"] = "no_events";
  if (lastEvent) {
    const hoursSinceLastEvent = (now.getTime() - new Date(lastEvent.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastEvent < 72) {
      status = "healthy";
    } else if (hoursSinceLastEvent < 168) {
      status = "warning";
    } else {
      status = "error";
    }
  }
  if (!hottokConfigured) status = "warning";

  return {
    lastEventAt: lastEvent?.createdAt || null,
    lastEventType: lastEvent?.externalEvent || null,
    lastEventTenantName,
    totalEventsToday: todayEvents[0]?.count || 0,
    totalEventsThisWeek: weekEvents[0]?.count || 0,
    totalEventsThisMonth: monthEvents[0]?.count || 0,
    processedEvents: processed[0]?.count || 0,
    failedEvents: failed[0]?.count || 0,
    hottokConfigured,
    webhookUrl,
    status,
  };
}

export async function getTrialConversion(): Promise<TrialConversion> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const allTenants = await db.select().from(tenants).where(eq(tenants.isLegacy, false));

  // Tenants that were ever in trial (non-legacy)
  const totalTrials = allTenants.length;
  const converted = allTenants.filter(t => t.billingStatus === "active").length;
  const expired = allTenants.filter(t =>
    t.billingStatus === "restricted" || t.billingStatus === "expired"
  ).length;
  const active = allTenants.filter(t => t.billingStatus === "trialing").length;

  return {
    totalTrials,
    converted,
    expired,
    active,
    conversionRate: totalTrials > 0 ? Math.round((converted / totalTrials) * 1000) / 10 : 0,
  };
}

export async function getRecentEvents(limit: number = 20): Promise<RecentEvent[]> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const events = await db.select().from(subscriptionEvents)
    .orderBy(desc(subscriptionEvents.createdAt))
    .limit(limit);

  // Enrich with tenant names
  const tenantIds = Array.from(new Set(events.map(e => e.tenantId).filter(Boolean))) as number[];
  const tenantMap = new Map<number, string>();

  if (tenantIds.length > 0) {
    for (const tid of tenantIds) {
      const t = await db.select({ name: tenants.name }).from(tenants)
        .where(eq(tenants.id, tid))
        .limit(1);
      if (t[0]) tenantMap.set(tid, t[0].name);
    }
  }

  return events.map(e => ({
    id: e.id,
    tenantId: e.tenantId,
    tenantName: e.tenantId ? tenantMap.get(e.tenantId) || null : null,
    externalEvent: e.externalEvent,
    internalStatus: e.internalStatus,
    buyerEmail: e.buyerEmail,
    transactionId: e.transactionId,
    processed: e.processed,
    errorMessage: e.errorMessage,
    createdAt: e.createdAt,
  }));
}

// ─── Helpers ───────────────────────────────────────────────────────

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
