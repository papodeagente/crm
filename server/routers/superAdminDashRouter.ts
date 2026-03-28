/**
 * Super Admin Dashboard Router
 * 
 * Provides cross-tenant consolidated data for the SaaS owner.
 * All procedures are protected by superAdmin check.
 * No tenant-level queries are affected.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";

// ─── Auth helper ────────────────────────────────────────────
function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  cookieHeader.split(";").forEach((c) => {
    const [key, ...vals] = c.trim().split("=");
    if (key) map.set(key.trim(), vals.join("=").trim());
  });
  return map;
}

const SAAS_COOKIE = "entur_saas_session";

async function requireSuperAdmin(ctx: any) {
  const { verifySaasSession, isSuperAdminAsync } = await import("../saasAuth");
  const cookies = parseCookies(ctx.req.headers.cookie);
  const token = cookies.get(SAAS_COOKIE);
  const session = await verifySaasSession(token);
  if (!session || !(await isSuperAdminAsync(session.email))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
  }
  return session;
}

async function getDatabase() {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

// ─── Router ─────────────────────────────────────────────────
export const superAdminDashRouter = router({

  // ═══════════════════════════════════════
  // 1. VISÃO GERAL — KPIs consolidados
  // ═══════════════════════════════════════
  overview: publicProcedure.query(async ({ ctx }) => {
    await requireSuperAdmin(ctx);
    const db = await getDatabase();

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const prevMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Single consolidated query for all KPIs
    const [result] = await db.execute(sql`
      SELECT
        -- Tenants
        (SELECT COUNT(*) FROM tenants WHERE status = 'active') AS tenantsActive,
        (SELECT COUNT(*) FROM tenants) AS tenantsTotal,
        (SELECT COUNT(*) FROM tenants WHERE billingStatus = 'trialing') AS tenantsTrial,
        (SELECT COUNT(*) FROM tenants WHERE billingStatus IN ('active') AND plan != 'free') AS tenantsPaying,
        (SELECT COUNT(*) FROM tenants WHERE billingStatus IN ('past_due', 'restricted')) AS tenantsOverdue,
        (SELECT COUNT(*) FROM tenants WHERE billingStatus IN ('cancelled', 'expired')) AS tenantsChurned,
        
        -- Users
        (SELECT COUNT(*) FROM crm_users WHERE status = 'active') AS usersActive,
        (SELECT COUNT(DISTINCT cu.id) FROM crm_users cu WHERE cu.lastActiveAt >= ${sevenDaysAgo}) AS usersActive7d,
        
        -- Deals this month
        (SELECT COUNT(*) FROM deals WHERE createdAt >= ${monthStart} AND deletedAt IS NULL) AS dealsCreatedMonth,
        (SELECT COUNT(*) FROM deals WHERE status = 'won' AND updatedAt >= ${monthStart} AND deletedAt IS NULL) AS dealsWonMonth,
        (SELECT COUNT(*) FROM deals WHERE status = 'lost' AND updatedAt >= ${monthStart} AND deletedAt IS NULL) AS dealsLostMonth,
        (SELECT COALESCE(SUM(valueCents), 0) FROM deals WHERE status = 'won' AND updatedAt >= ${monthStart} AND deletedAt IS NULL) AS wonCentsMonth,
        
        -- Deals total
        (SELECT COUNT(*) FROM deals WHERE status = 'open' AND deletedAt IS NULL) AS dealsOpenTotal,
        (SELECT COALESCE(AVG(valueCents), 0) FROM deals WHERE status = 'won' AND deletedAt IS NULL AND valueCents > 0) AS avgTicketCents,
        
        -- WhatsApp
        (SELECT COUNT(*) FROM whatsapp_sessions WHERE status = 'connected') AS waConnected,
        (SELECT COUNT(*) FROM whatsapp_sessions) AS waTotal,
        (SELECT COUNT(*) FROM messages WHERE createdAt >= ${monthStart}) AS waMessagesMonth,
        
        -- Contacts
        (SELECT COUNT(*) FROM contacts WHERE deletedAt IS NULL) AS contactsTotal,
        
        -- Integrations
        (SELECT COUNT(*) FROM integrations WHERE status = 'active') AS integrationsActive,
        
        -- Tasks
        (SELECT COUNT(*) FROM crm_tasks WHERE createdAt >= ${monthStart}) AS tasksCreatedMonth,
        
        -- AI usage (chatbot_settings via whatsapp_sessions join)
        (SELECT COUNT(DISTINCT ws2.tenantId) FROM chatbot_settings cs JOIN whatsapp_sessions ws2 ON ws2.sessionId = cs.sessionId WHERE cs.enabled = 1) AS tenantsWithAI,
        
        -- Subscriptions MRR
        (SELECT COALESCE(SUM(priceInCents), 0) FROM subscriptions WHERE status = 'active') AS mrrCents,
        
        -- Tenants without recent use (no user active in 30 days)
        (SELECT COUNT(*) FROM tenants t WHERE t.status = 'active' AND NOT EXISTS (
          SELECT 1 FROM crm_users cu WHERE cu.tenantId = t.id AND cu.lastActiveAt >= ${thirtyDaysAgo}
        )) AS tenantsNoRecentUse,
        
        -- Previous month deals for comparison
        (SELECT COUNT(*) FROM deals WHERE createdAt >= ${prevMonthStart} AND createdAt < ${monthStart} AND deletedAt IS NULL) AS dealsCreatedPrevMonth,
        (SELECT COALESCE(SUM(valueCents), 0) FROM deals WHERE status = 'won' AND updatedAt >= ${prevMonthStart} AND updatedAt < ${monthStart} AND deletedAt IS NULL) AS wonCentsPrevMonth
    `) as any;

    const row = Array.isArray(result) ? result[0] : result;

    const dealsWon = Number(row?.dealsWonMonth || 0);
    const dealsLost = Number(row?.dealsLostMonth || 0);
    const dealsDecided = dealsWon + dealsLost;
    const conversionRate = dealsDecided > 0 ? Math.round((dealsWon / dealsDecided) * 100) : 0;

    return {
      tenantsActive: Number(row?.tenantsActive || 0),
      tenantsTotal: Number(row?.tenantsTotal || 0),
      tenantsTrial: Number(row?.tenantsTrial || 0),
      tenantsPaying: Number(row?.tenantsPaying || 0),
      tenantsOverdue: Number(row?.tenantsOverdue || 0),
      tenantsChurned: Number(row?.tenantsChurned || 0),
      tenantsNoRecentUse: Number(row?.tenantsNoRecentUse || 0),
      tenantsWithAI: Number(row?.tenantsWithAI || 0),
      usersActive: Number(row?.usersActive || 0),
      usersActive7d: Number(row?.usersActive7d || 0),
      dealsCreatedMonth: Number(row?.dealsCreatedMonth || 0),
      dealsWonMonth: dealsWon,
      dealsLostMonth: dealsLost,
      wonCentsMonth: Number(row?.wonCentsMonth || 0),
      dealsOpenTotal: Number(row?.dealsOpenTotal || 0),
      avgTicketCents: Math.round(Number(row?.avgTicketCents || 0)),
      conversionRate,
      waConnected: Number(row?.waConnected || 0),
      waTotal: Number(row?.waTotal || 0),
      waMessagesMonth: Number(row?.waMessagesMonth || 0),
      contactsTotal: Number(row?.contactsTotal || 0),
      integrationsActive: Number(row?.integrationsActive || 0),
      tasksCreatedMonth: Number(row?.tasksCreatedMonth || 0),
      mrrCents: Number(row?.mrrCents || 0),
      dealsCreatedPrevMonth: Number(row?.dealsCreatedPrevMonth || 0),
      wonCentsPrevMonth: Number(row?.wonCentsPrevMonth || 0),
    };
  }),

  // ═══════════════════════════════════════
  // 1b. VISÃO GERAL — Gráficos (evolução mensal)
  // ═══════════════════════════════════════
  overviewCharts: publicProcedure.query(async ({ ctx }) => {
    await requireSuperAdmin(ctx);
    const db = await getDatabase();

    // Tenants created per month (last 12 months)
    const [tenantsPerMonth] = await db.execute(sql`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, COUNT(*) AS count
      FROM tenants
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month ORDER BY month
    `) as any;

    // Deals created per month (last 12 months)
    const [dealsPerMonth] = await db.execute(sql`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, COUNT(*) AS count,
             SUM(CASE WHEN status = 'won' THEN COALESCE(valueCents, 0) ELSE 0 END) AS wonCents
      FROM deals
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH) AND deletedAt IS NULL
      GROUP BY month ORDER BY month
    `) as any;

    // WA messages per month (last 6 months)
    const [waPerMonth] = await db.execute(sql`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, COUNT(*) AS count
      FROM messages
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month
    `) as any;

    // Plan distribution
    const [planDist] = await db.execute(sql`
      SELECT plan, COUNT(*) AS count FROM tenants WHERE status = 'active' GROUP BY plan
    `) as any;

    return {
      tenantsPerMonth: (tenantsPerMonth || []).map((r: any) => ({ month: r.month, count: Number(r.count) })),
      dealsPerMonth: (dealsPerMonth || []).map((r: any) => ({ month: r.month, count: Number(r.count), wonCents: Number(r.wonCents) })),
      waPerMonth: (waPerMonth || []).map((r: any) => ({ month: r.month, count: Number(r.count) })),
      planDistribution: (planDist || []).map((r: any) => ({ plan: r.plan, count: Number(r.count) })),
    };
  }),

  // ═══════════════════════════════════════
  // 1c. ALERTAS — Tenants que precisam de atenção
  // ═══════════════════════════════════════
  alerts: publicProcedure.query(async ({ ctx }) => {
    await requireSuperAdmin(ctx);
    const db = await getDatabase();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Tenants with WA disconnected
    const [waDisconnected] = await db.execute(sql`
      SELECT t.id, t.name, t.plan FROM tenants t
      WHERE t.status = 'active'
        AND EXISTS (SELECT 1 FROM whatsapp_sessions ws WHERE ws.tenantId = t.id)
        AND NOT EXISTS (SELECT 1 FROM whatsapp_sessions ws WHERE ws.tenantId = t.id AND ws.status = 'connected')
      LIMIT 20
    `) as any;

    // Tenants with no recent activity
    const [noActivity] = await db.execute(sql`
      SELECT t.id, t.name, t.plan FROM tenants t
      WHERE t.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM crm_users cu WHERE cu.tenantId = t.id AND cu.lastActiveAt >= ${thirtyDaysAgo})
      LIMIT 20
    `) as any;

    // Tenants with overdue billing
    const [overdue] = await db.execute(sql`
      SELECT t.id, t.name, t.plan, t.billingStatus FROM tenants t
      WHERE t.billingStatus IN ('past_due', 'restricted')
      LIMIT 20
    `) as any;

    // Tenants with many users but low deal count
    const [lowAdoption] = await db.execute(sql`
      SELECT t.id, t.name, t.plan,
        (SELECT COUNT(*) FROM crm_users cu WHERE cu.tenantId = t.id AND cu.status = 'active') AS userCount,
        (SELECT COUNT(*) FROM deals d WHERE d.tenantId = t.id AND d.deletedAt IS NULL AND d.createdAt >= ${thirtyDaysAgo}) AS recentDeals
      FROM tenants t
      WHERE t.status = 'active'
      HAVING userCount >= 2 AND recentDeals <= 1
      ORDER BY userCount DESC
      LIMIT 20
    `) as any;

    return {
      waDisconnected: (waDisconnected || []).map((r: any) => ({ id: Number(r.id), name: r.name, plan: r.plan })),
      noActivity: (noActivity || []).map((r: any) => ({ id: Number(r.id), name: r.name, plan: r.plan })),
      overdue: (overdue || []).map((r: any) => ({ id: Number(r.id), name: r.name, plan: r.plan, billingStatus: r.billingStatus })),
      lowAdoption: (lowAdoption || []).map((r: any) => ({ id: Number(r.id), name: r.name, plan: r.plan, userCount: Number(r.userCount), recentDeals: Number(r.recentDeals) })),
    };
  }),

  // ═══════════════════════════════════════
  // 2. GESTÃO DE TENANTS — Lista com métricas
  // ═══════════════════════════════════════
  tenantsList: publicProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(10).max(100).default(25),
      search: z.string().optional(),
      plan: z.string().optional(),
      status: z.string().optional(),
      billingStatus: z.string().optional(),
      sortBy: z.string().optional(),
      sortDir: z.enum(["asc", "desc"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireSuperAdmin(ctx);
      const db = await getDatabase();

      const monthStart = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1));
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const offset = (input.page - 1) * input.pageSize;

      // Build WHERE conditions
      const conditions: string[] = ["1=1"];
      if (input.search) conditions.push(`t.name LIKE '%${input.search.replace(/'/g, "''")}%'`);
      if (input.plan && input.plan !== "all") conditions.push(`t.plan = '${input.plan.replace(/'/g, "''")}'`);
      if (input.status && input.status !== "all") conditions.push(`t.status = '${input.status.replace(/'/g, "''")}'`);
      if (input.billingStatus && input.billingStatus !== "all") conditions.push(`t.billingStatus = '${input.billingStatus.replace(/'/g, "''")}'`);

      const whereClause = conditions.join(" AND ");

      // Count total
      const [countResult] = await db.execute(sql.raw(`
        SELECT COUNT(*) AS total FROM tenants t WHERE ${whereClause}
      `)) as any;
      const total = Number((countResult || [])[0]?.total || 0);

      // Main query with metrics
      const sortCol = input.sortBy === "name" ? "t.name" 
        : input.sortBy === "createdAt" ? "t.createdAt"
        : input.sortBy === "userCount" ? "userCount"
        : input.sortBy === "dealsMonth" ? "dealsMonth"
        : input.sortBy === "wonCentsMonth" ? "wonCentsMonth"
        : "t.createdAt";
      const sortDirection = input.sortDir === "asc" ? "ASC" : "DESC";

      const [rows] = await db.execute(sql.raw(`
        SELECT
          t.id, t.name, t.plan, t.status, t.billingStatus, t.createdAt, t.freemiumDays, t.freemiumExpiresAt,
          COALESCE(u.userCount, 0) AS userCount,
          COALESCE(d.dealsMonth, 0) AS dealsMonth,
          COALESCE(d.dealsOpen, 0) AS dealsOpen,
          COALESCE(d.wonCentsMonth, 0) AS wonCentsMonth,
          COALESCE(d.dealsWon, 0) AS dealsWon,
          COALESCE(d.dealsLost, 0) AS dealsLost,
          COALESCE(c.contactsTotal, 0) AS contactsTotal,
          COALESCE(w.waConnected, 0) AS waConnected,
          COALESCE(w.waTotal, 0) AS waTotal,
          COALESCE(ai.aiEnabled, 0) AS aiEnabled,
          COALESCE(ig.integCount, 0) AS integCount,
          (SELECT MAX(cu.lastActiveAt) FROM crm_users cu WHERE cu.tenantId = t.id) AS lastActivity
        FROM tenants t
        LEFT JOIN (
          SELECT tenantId, COUNT(*) AS userCount FROM crm_users WHERE status = 'active' GROUP BY tenantId
        ) u ON u.tenantId = t.id
        LEFT JOIN (
          SELECT tenantId,
            SUM(CASE WHEN createdAt >= '${monthStart.toISOString().slice(0,19).replace('T',' ')}' AND deletedAt IS NULL THEN 1 ELSE 0 END) AS dealsMonth,
            SUM(CASE WHEN status = 'open' AND deletedAt IS NULL THEN 1 ELSE 0 END) AS dealsOpen,
            SUM(CASE WHEN status = 'won' AND updatedAt >= '${monthStart.toISOString().slice(0,19).replace('T',' ')}' AND deletedAt IS NULL THEN COALESCE(valueCents, 0) ELSE 0 END) AS wonCentsMonth,
            SUM(CASE WHEN status = 'won' AND deletedAt IS NULL THEN 1 ELSE 0 END) AS dealsWon,
            SUM(CASE WHEN status = 'lost' AND deletedAt IS NULL THEN 1 ELSE 0 END) AS dealsLost
          FROM deals GROUP BY tenantId
        ) d ON d.tenantId = t.id
        LEFT JOIN (
          SELECT tenantId, COUNT(*) AS contactsTotal FROM contacts WHERE deletedAt IS NULL GROUP BY tenantId
        ) c ON c.tenantId = t.id
        LEFT JOIN (
          SELECT tenantId,
            SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) AS waConnected,
            COUNT(*) AS waTotal
          FROM whatsapp_sessions GROUP BY tenantId
        ) w ON w.tenantId = t.id
        LEFT JOIN (
          SELECT ws2.tenantId, COUNT(*) AS aiEnabled FROM chatbot_settings cs JOIN whatsapp_sessions ws2 ON ws2.sessionId = cs.sessionId WHERE cs.enabled = 1 GROUP BY ws2.tenantId
        ) ai ON ai.tenantId = t.id
        LEFT JOIN (
          SELECT tenantId, COUNT(*) AS integCount FROM integrations WHERE status = 'active' GROUP BY tenantId
        ) ig ON ig.tenantId = t.id
        WHERE ${whereClause}
        ORDER BY ${sortCol} ${sortDirection}
        LIMIT ${input.pageSize} OFFSET ${offset}
      `)) as any;

      return {
        total,
        page: input.page,
        pageSize: input.pageSize,
        tenants: (rows || []).map((r: any) => {
          const won = Number(r.dealsWon || 0);
          const lost = Number(r.dealsLost || 0);
          const decided = won + lost;
          const convRate = decided > 0 ? Math.round((won / decided) * 100) : 0;
          return {
            id: Number(r.id),
            name: r.name,
            plan: r.plan,
            status: r.status,
            billingStatus: r.billingStatus,
            createdAt: r.createdAt,
            freemiumDays: Number(r.freemiumDays || 0),
            freemiumExpiresAt: r.freemiumExpiresAt,
            userCount: Number(r.userCount || 0),
            dealsMonth: Number(r.dealsMonth || 0),
            dealsOpen: Number(r.dealsOpen || 0),
            wonCentsMonth: Number(r.wonCentsMonth || 0),
            conversionRate: convRate,
            contactsTotal: Number(r.contactsTotal || 0),
            waConnected: Number(r.waConnected || 0),
            waTotal: Number(r.waTotal || 0),
            aiEnabled: Number(r.aiEnabled || 0) > 0,
            integCount: Number(r.integCount || 0),
            lastActivity: r.lastActivity,
          };
        }),
      };
    }),

  // ═══════════════════════════════════════
  // 3. DETALHE DO TENANT — Diagnóstico completo
  // ═══════════════════════════════════════
  tenantDetail: publicProcedure
    .input(z.object({ tenantId: z.number().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireSuperAdmin(ctx);
      const db = await getDatabase();

      const monthStart = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1));
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const tid = input.tenantId;

      const [result] = await db.execute(sql`
        SELECT
          t.id, t.name, t.plan, t.status, t.billingStatus, t.createdAt, t.freemiumDays, t.freemiumExpiresAt,
          
          -- Users
          (SELECT COUNT(*) FROM crm_users WHERE tenantId = ${tid} AND status = 'active') AS usersActive,
          (SELECT COUNT(*) FROM crm_users WHERE tenantId = ${tid}) AS usersTotal,
          (SELECT COUNT(DISTINCT id) FROM crm_users WHERE tenantId = ${tid} AND lastActiveAt >= ${sevenDaysAgo}) AS usersActive7d,
          (SELECT COUNT(DISTINCT id) FROM crm_users WHERE tenantId = ${tid} AND lastActiveAt >= ${thirtyDaysAgo}) AS usersActive30d,
          
          -- Deals
          (SELECT COUNT(*) FROM deals WHERE tenantId = ${tid} AND status = 'open' AND deletedAt IS NULL) AS dealsOpen,
          (SELECT COUNT(*) FROM deals WHERE tenantId = ${tid} AND status = 'won' AND updatedAt >= ${monthStart} AND deletedAt IS NULL) AS dealsWonMonth,
          (SELECT COUNT(*) FROM deals WHERE tenantId = ${tid} AND status = 'lost' AND updatedAt >= ${monthStart} AND deletedAt IS NULL) AS dealsLostMonth,
          (SELECT COALESCE(SUM(valueCents), 0) FROM deals WHERE tenantId = ${tid} AND status = 'won' AND updatedAt >= ${monthStart} AND deletedAt IS NULL) AS wonCentsMonth,
          (SELECT COALESCE(AVG(valueCents), 0) FROM deals WHERE tenantId = ${tid} AND status = 'won' AND deletedAt IS NULL AND valueCents > 0) AS avgTicket,
          (SELECT COUNT(*) FROM deals WHERE tenantId = ${tid} AND deletedAt IS NULL) AS dealsTotal,
          
          -- Contacts
          (SELECT COUNT(*) FROM contacts WHERE tenantId = ${tid} AND deletedAt IS NULL) AS contactsTotal,
          
          -- Tasks
          (SELECT COUNT(*) FROM crm_tasks WHERE tenantId = ${tid} AND createdAt >= ${monthStart}) AS tasksCreatedMonth,
          (SELECT COUNT(*) FROM crm_tasks WHERE tenantId = ${tid} AND status = 'done') AS tasksDone,
          
          -- WhatsApp
          (SELECT COUNT(*) FROM whatsapp_sessions WHERE tenantId = ${tid} AND status = 'connected') AS waConnected,
          (SELECT COUNT(*) FROM whatsapp_sessions WHERE tenantId = ${tid}) AS waTotal,
          (SELECT COUNT(*) FROM messages WHERE sessionId IN (SELECT sessionId FROM whatsapp_sessions WHERE tenantId = ${tid}) AND createdAt >= ${monthStart}) AS waMessagesMonth,
          
          -- Integrations
          (SELECT COUNT(*) FROM integrations WHERE tenantId = ${tid} AND status = 'active') AS integrationsActive,
          
          -- AI (via whatsapp_sessions join)
          (SELECT COUNT(*) FROM chatbot_settings cs JOIN whatsapp_sessions ws2 ON ws2.sessionId = cs.sessionId WHERE ws2.tenantId = ${tid} AND cs.enabled = 1) AS aiEnabled,
          
          -- Pipelines
          (SELECT COUNT(*) FROM pipelines WHERE tenantId = ${tid}) AS pipelinesCount,
          
          -- Automations
          (SELECT COUNT(*) FROM pipeline_automations WHERE tenantId = ${tid} AND isActive = 1) AS automationsActive,
          
          -- Proposals
          (SELECT COUNT(*) FROM proposals WHERE tenantId = ${tid}) AS proposalsTotal,
          
          -- Subscription
          (SELECT s.plan FROM subscriptions s WHERE s.tenantId = ${tid} AND s.status = 'active' LIMIT 1) AS subPlan,
          (SELECT s.status FROM subscriptions s WHERE s.tenantId = ${tid} ORDER BY s.createdAt DESC LIMIT 1) AS subStatus,
          (SELECT s.priceInCents FROM subscriptions s WHERE s.tenantId = ${tid} AND s.status = 'active' LIMIT 1) AS subPriceCents
          
        FROM tenants t WHERE t.id = ${tid}
      `) as any;

      const row = Array.isArray(result) ? result[0] : result;
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant não encontrado" });

      // Calculate maturity scores (0-100)
      const usersActive = Number(row.usersActive || 0);
      const dealsTotal = Number(row.dealsTotal || 0);
      const contactsTotal = Number(row.contactsTotal || 0);
      const pipelinesCount = Number(row.pipelinesCount || 0);
      const tasksCreatedMonth = Number(row.tasksCreatedMonth || 0);
      const waConnected = Number(row.waConnected || 0);
      const automationsActive = Number(row.automationsActive || 0);
      const integrationsActive = Number(row.integrationsActive || 0);
      const aiEnabled = Number(row.aiEnabled || 0);
      const proposalsTotal = Number(row.proposalsTotal || 0);

      const maturity = {
        crm: Math.min(100, (contactsTotal > 0 ? 20 : 0) + (dealsTotal > 0 ? 20 : 0) + Math.min(20, usersActive * 10) + (dealsTotal > 10 ? 20 : dealsTotal * 2) + (contactsTotal > 50 ? 20 : Math.min(20, contactsTotal * 0.4))),
        pipeline: Math.min(100, (pipelinesCount > 0 ? 30 : 0) + (pipelinesCount > 1 ? 20 : 0) + (dealsTotal > 5 ? 25 : dealsTotal * 5) + (automationsActive > 0 ? 25 : 0)),
        tasks: Math.min(100, (tasksCreatedMonth > 0 ? 30 : 0) + Math.min(40, tasksCreatedMonth * 4) + (Number(row.tasksDone || 0) > 0 ? 30 : 0)),
        whatsapp: Math.min(100, (waConnected > 0 ? 40 : 0) + Math.min(40, Number(row.waMessagesMonth || 0) / 10) + (Number(row.waTotal || 0) > 1 ? 20 : 0)),
        automations: Math.min(100, (automationsActive > 0 ? 50 : 0) + Math.min(50, automationsActive * 10)),
        reports: Math.min(100, (dealsTotal > 5 ? 40 : 0) + (Number(row.dealsWonMonth || 0) > 0 ? 30 : 0) + (contactsTotal > 20 ? 30 : 0)),
        ai: Math.min(100, (aiEnabled > 0 ? 60 : 0) + Math.min(40, aiEnabled * 20)),
        integrations: Math.min(100, (integrationsActive > 0 ? 50 : 0) + Math.min(50, integrationsActive * 25)),
      };

      const avgMaturity = Math.round(Object.values(maturity).reduce((a, b) => a + b, 0) / Object.keys(maturity).length);
      const maturityLevel = avgMaturity >= 80 ? "Avançado" : avgMaturity >= 60 ? "Maduro" : avgMaturity >= 40 ? "Operando" : avgMaturity >= 20 ? "Em adoção" : "Inicial";

      // Risk signals
      const dealsWon = Number(row.dealsWonMonth || 0);
      const dealsLost = Number(row.dealsLostMonth || 0);
      const decided = dealsWon + dealsLost;
      const convRate = decided > 0 ? Math.round((dealsWon / decided) * 100) : 0;

      const risks: string[] = [];
      if (Number(row.usersActive7d || 0) === 0) risks.push("Nenhum usuário ativo nos últimos 7 dias");
      if (Number(row.usersActive30d || 0) === 0) risks.push("Nenhum usuário ativo nos últimos 30 dias");
      if (dealsTotal === 0) risks.push("Nenhuma negociação criada");
      if (Number(row.dealsOpen || 0) === 0 && dealsTotal > 0) risks.push("Sem negociações abertas");
      if (waConnected === 0 && Number(row.waTotal || 0) > 0) risks.push("WhatsApp desconectado");
      if (convRate < 20 && decided > 3) risks.push("Taxa de conversão muito baixa");
      if (tasksCreatedMonth === 0) risks.push("Sem tarefas criadas no mês");
      if (aiEnabled === 0) risks.push("IA não ativada");
      if (integrationsActive === 0) risks.push("Sem integrações ativas");

      // Growth opportunities
      const opportunities: string[] = [];
      if (row.plan === "free" || row.plan === "start") opportunities.push("Pode subir de plano");
      if (usersActive < 3) opportunities.push("Pode ativar mais usuários");
      if (waConnected === 0) opportunities.push("Pode ativar WhatsApp");
      if (automationsActive === 0) opportunities.push("Pode ativar automações");
      if (aiEnabled === 0) opportunities.push("Pode usar IA");
      if (pipelinesCount <= 1) opportunities.push("Pode melhorar adoção do funil");
      if (proposalsTotal === 0) opportunities.push("Pode usar propostas comerciais");
      if (integrationsActive === 0) opportunities.push("Pode integrar ferramentas externas");

      return {
        tenant: {
          id: Number(row.id),
          name: row.name,
          plan: row.plan,
          status: row.status,
          billingStatus: row.billingStatus,
          createdAt: row.createdAt,
          freemiumDays: Number(row.freemiumDays || 0),
          freemiumExpiresAt: row.freemiumExpiresAt,
          accountAge: Math.floor((Date.now() - new Date(row.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        },
        metrics: {
          usersActive,
          usersTotal: Number(row.usersTotal || 0),
          usersActive7d: Number(row.usersActive7d || 0),
          usersActive30d: Number(row.usersActive30d || 0),
          dealsOpen: Number(row.dealsOpen || 0),
          dealsWonMonth: dealsWon,
          dealsLostMonth: dealsLost,
          wonCentsMonth: Number(row.wonCentsMonth || 0),
          avgTicketCents: Math.round(Number(row.avgTicket || 0)),
          conversionRate: convRate,
          contactsTotal,
          tasksCreatedMonth,
          tasksDone: Number(row.tasksDone || 0),
          waConnected,
          waTotal: Number(row.waTotal || 0),
          waMessagesMonth: Number(row.waMessagesMonth || 0),
          integrationsActive,
          aiEnabled,
          pipelinesCount,
          automationsActive,
          proposalsTotal,
          subPlan: row.subPlan || null,
          subStatus: row.subStatus || null,
          subPriceCents: Number(row.subPriceCents || 0),
        },
        maturity,
        maturityLevel,
        avgMaturity,
        risks,
        opportunities,
      };
    }),

  // ═══════════════════════════════════════
  // 4. ADOÇÃO DE PRODUTO — Features usage
  // ═══════════════════════════════════════
  featureAdoption: publicProcedure.query(async ({ ctx }) => {
    await requireSuperAdmin(ctx);
    const db = await getDatabase();

    const monthStart = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1));

    const [result] = await db.execute(sql`
      SELECT
        (SELECT COUNT(DISTINCT tenantId) FROM contacts WHERE deletedAt IS NULL) AS tenantsWithContacts,
        (SELECT COUNT(DISTINCT tenantId) FROM deals WHERE deletedAt IS NULL) AS tenantsWithDeals,
        (SELECT COUNT(DISTINCT tenantId) FROM pipelines) AS tenantsWithPipelines,
        (SELECT COUNT(DISTINCT tenantId) FROM crm_tasks) AS tenantsWithTasks,
        (SELECT COUNT(DISTINCT tenantId) FROM pipeline_automations WHERE isActive = 1) AS tenantsWithAutomations,
        (SELECT COUNT(DISTINCT tenantId) FROM whatsapp_sessions WHERE status = 'connected') AS tenantsWithWA,
        (SELECT COUNT(DISTINCT ws2.tenantId) FROM chatbot_settings cs JOIN whatsapp_sessions ws2 ON ws2.sessionId = cs.sessionId WHERE cs.enabled = 1) AS tenantsWithAI,
        (SELECT COUNT(DISTINCT tenantId) FROM integrations WHERE status = 'active') AS tenantsWithIntegrations,
        (SELECT COUNT(DISTINCT tenantId) FROM proposals) AS tenantsWithProposals,
        (SELECT COUNT(DISTINCT tenantId) FROM courses) AS tenantsWithAcademy,
        (SELECT COUNT(*) FROM tenants WHERE status = 'active') AS totalActive
    `) as any;

    const row = Array.isArray(result) ? result[0] : result;
    const totalActive = Number(row?.totalActive || 1);

    const features = [
      { name: "CRM (Contatos)", key: "contacts", tenants: Number(row?.tenantsWithContacts || 0) },
      { name: "Negociações", key: "deals", tenants: Number(row?.tenantsWithDeals || 0) },
      { name: "Funil de Vendas", key: "pipelines", tenants: Number(row?.tenantsWithPipelines || 0) },
      { name: "Tarefas", key: "tasks", tenants: Number(row?.tenantsWithTasks || 0) },
      { name: "Automações", key: "automations", tenants: Number(row?.tenantsWithAutomations || 0) },
      { name: "WhatsApp", key: "whatsapp", tenants: Number(row?.tenantsWithWA || 0) },
      { name: "IA / Chatbot", key: "ai", tenants: Number(row?.tenantsWithAI || 0) },
      { name: "Integrações", key: "integrations", tenants: Number(row?.tenantsWithIntegrations || 0) },
      { name: "Propostas", key: "proposals", tenants: Number(row?.tenantsWithProposals || 0) },
      { name: "Academy", key: "academy", tenants: Number(row?.tenantsWithAcademy || 0) },
    ];

    return {
      totalActive,
      features: features.map(f => ({
        ...f,
        adoptionRate: Math.round((f.tenants / totalActive) * 100),
      })),
    };
  }),

  // ═══════════════════════════════════════
  // 5. SAÚDE OPERACIONAL
  // ═══════════════════════════════════════
  operationalHealth: publicProcedure.query(async ({ ctx }) => {
    await requireSuperAdmin(ctx);
    const db = await getDatabase();

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [result] = await db.execute(sql`
      SELECT
        -- Jobs
        (SELECT COUNT(*) FROM jobs WHERE status = 'failed' AND createdAt >= ${oneDayAgo}) AS jobsFailed24h,
        (SELECT COUNT(*) FROM jobs WHERE status = 'pending') AS jobsPending,
        (SELECT COUNT(*) FROM job_dlq) AS jobsDlq,
        
        -- WA sessions
        (SELECT COUNT(*) FROM whatsapp_sessions WHERE status = 'connected') AS waConnected,
        (SELECT COUNT(*) FROM whatsapp_sessions WHERE status = 'disconnected') AS waDisconnected,
        
        -- Integration errors
        (SELECT COUNT(*) FROM integration_connections WHERE status = 'error') AS integErrors,
        
        -- Webhook failures (webhook_config has no lastError column, count inactive instead)
        (SELECT COUNT(*) FROM webhook_config WHERE isActive = 0) AS webhookErrors
    `) as any;

    const row = Array.isArray(result) ? result[0] : result;

    return {
      jobsFailed24h: Number(row?.jobsFailed24h || 0),
      jobsPending: Number(row?.jobsPending || 0),
      jobsDlq: Number(row?.jobsDlq || 0),
      waConnected: Number(row?.waConnected || 0),
      waDisconnected: Number(row?.waDisconnected || 0),
      integErrors: Number(row?.integErrors || 0),
      webhookErrors: Number(row?.webhookErrors || 0),
    };
  }),

  // ═══════════════════════════════════════
  // 6. COMERCIAL E EXPANSÃO
  // ═══════════════════════════════════════
  commercialExpansion: publicProcedure.query(async ({ ctx }) => {
    await requireSuperAdmin(ctx);
    const db = await getDatabase();

    const now = new Date();
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Trial tenants with details
    const [trials] = await db.execute(sql`
      SELECT t.id, t.name, t.plan, t.freemiumExpiresAt, t.createdAt,
        (SELECT COUNT(*) FROM crm_users cu WHERE cu.tenantId = t.id AND cu.status = 'active') AS userCount,
        (SELECT COUNT(*) FROM deals d WHERE d.tenantId = t.id AND d.deletedAt IS NULL) AS dealsCount,
        (SELECT COUNT(*) FROM whatsapp_sessions ws WHERE ws.tenantId = t.id AND ws.status = 'connected') AS waConnected
      FROM tenants t
      WHERE t.billingStatus = 'trialing'
      ORDER BY t.freemiumExpiresAt ASC
      LIMIT 50
    `) as any;

    // Tenants with upgrade potential (high usage on low plan)
    const [upgradeCandiates] = await db.execute(sql`
      SELECT t.id, t.name, t.plan,
        (SELECT COUNT(*) FROM crm_users cu WHERE cu.tenantId = t.id AND cu.status = 'active') AS userCount,
        (SELECT COUNT(*) FROM deals d WHERE d.tenantId = t.id AND d.deletedAt IS NULL) AS dealsCount,
        (SELECT COALESCE(SUM(d.valueCents), 0) FROM deals d WHERE d.tenantId = t.id AND d.status = 'won' AND d.deletedAt IS NULL) AS totalWonCents
      FROM tenants t
      WHERE t.plan IN ('free', 'start') AND t.status = 'active'
      HAVING userCount >= 2 OR dealsCount >= 10
      ORDER BY dealsCount DESC
      LIMIT 30
    `) as any;

    // Churn risk (active but no recent activity)
    const [churnRisk] = await db.execute(sql`
      SELECT t.id, t.name, t.plan,
        (SELECT MAX(cu.lastActiveAt) FROM crm_users cu WHERE cu.tenantId = t.id) AS lastActivity,
        (SELECT COUNT(*) FROM crm_users cu WHERE cu.tenantId = t.id AND cu.status = 'active') AS userCount
      FROM tenants t
      WHERE t.status = 'active' AND t.billingStatus NOT IN ('cancelled', 'expired')
        AND NOT EXISTS (SELECT 1 FROM crm_users cu WHERE cu.tenantId = t.id AND cu.lastActiveAt >= ${thirtyDaysAgo})
      ORDER BY lastActivity ASC
      LIMIT 30
    `) as any;

    return {
      trials: (trials || []).map((r: any) => ({
        id: Number(r.id), name: r.name, plan: r.plan,
        freemiumExpiresAt: r.freemiumExpiresAt, createdAt: r.createdAt,
        userCount: Number(r.userCount || 0), dealsCount: Number(r.dealsCount || 0),
        waConnected: Number(r.waConnected || 0),
        expiringsSoon: r.freemiumExpiresAt && new Date(r.freemiumExpiresAt) <= sevenDaysFromNow,
        highUsage: Number(r.dealsCount || 0) >= 5 || Number(r.userCount || 0) >= 3,
      })),
      upgradeCandidates: (upgradeCandiates || []).map((r: any) => ({
        id: Number(r.id), name: r.name, plan: r.plan,
        userCount: Number(r.userCount || 0), dealsCount: Number(r.dealsCount || 0),
        totalWonCents: Number(r.totalWonCents || 0),
      })),
      churnRisk: (churnRisk || []).map((r: any) => ({
        id: Number(r.id), name: r.name, plan: r.plan,
        lastActivity: r.lastActivity, userCount: Number(r.userCount || 0),
      })),
    };
  }),

  // ═══════════════════════════════════════
  // 7. CENTRAL DE AJUDA ESTRATÉGICA
  // ═══════════════════════════════════════
  strategicHelp: publicProcedure
    .input(z.object({ tenantId: z.number().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireSuperAdmin(ctx);
      const db = await getDatabase();

      const tid = input.tenantId;
      const monthStart = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1));

      const [result] = await db.execute(sql`
        SELECT
          t.name, t.plan,
          (SELECT COUNT(*) FROM crm_users WHERE tenantId = ${tid} AND status = 'active') AS usersActive,
          (SELECT COUNT(*) FROM deals WHERE tenantId = ${tid} AND deletedAt IS NULL) AS dealsTotal,
          (SELECT COUNT(*) FROM deals WHERE tenantId = ${tid} AND status = 'open' AND deletedAt IS NULL) AS dealsOpen,
          (SELECT COUNT(*) FROM deals WHERE tenantId = ${tid} AND status = 'won' AND deletedAt IS NULL) AS dealsWon,
          (SELECT COUNT(*) FROM deals WHERE tenantId = ${tid} AND status = 'lost' AND deletedAt IS NULL) AS dealsLost,
          (SELECT COUNT(*) FROM contacts WHERE tenantId = ${tid} AND deletedAt IS NULL) AS contacts,
          (SELECT COUNT(*) FROM crm_tasks WHERE tenantId = ${tid} AND createdAt >= ${monthStart}) AS tasksMonth,
          (SELECT COUNT(*) FROM pipelines WHERE tenantId = ${tid}) AS pipelines,
          (SELECT COUNT(*) FROM pipeline_automations WHERE tenantId = ${tid} AND isActive = 1) AS automations,
          (SELECT COUNT(*) FROM whatsapp_sessions WHERE tenantId = ${tid} AND status = 'connected') AS waConnected,
          (SELECT COUNT(*) FROM chatbot_settings cs JOIN whatsapp_sessions ws2 ON ws2.sessionId = cs.sessionId WHERE ws2.tenantId = ${tid} AND cs.enabled = 1) AS aiEnabled,
          (SELECT COUNT(*) FROM integrations WHERE tenantId = ${tid} AND status = 'active') AS integrations,
          (SELECT COUNT(*) FROM proposals WHERE tenantId = ${tid}) AS proposals
        FROM tenants t WHERE t.id = ${tid}
      `) as any;

      const row = Array.isArray(result) ? result[0] : result;
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const recommendations: { type: "action" | "risk" | "opportunity"; title: string; description: string; priority: "high" | "medium" | "low" }[] = [];

      // Generate smart recommendations
      const usersActive = Number(row.usersActive || 0);
      const dealsTotal = Number(row.dealsTotal || 0);
      const dealsWon = Number(row.dealsWon || 0);
      const dealsLost = Number(row.dealsLost || 0);
      const decided = dealsWon + dealsLost;
      const convRate = decided > 0 ? (dealsWon / decided) * 100 : 0;

      if (Number(row.pipelines || 0) <= 1) {
        recommendations.push({ type: "action", title: "Estruturar funil comercial", description: "Tenant usa apenas 1 funil. Criar funis separados para vendas, pós-venda e suporte pode melhorar a organização.", priority: "high" });
      }
      if (Number(row.tasksMonth || 0) === 0) {
        recommendations.push({ type: "action", title: "Ativar tarefas obrigatórias", description: "Nenhuma tarefa criada no mês. Configurar tarefas automáticas por etapa do funil.", priority: "high" });
      }
      if (convRate < 25 && decided > 3) {
        recommendations.push({ type: "risk", title: "Taxa de conversão baixa", description: `Apenas ${Math.round(convRate)}% de conversão. Revisar qualificação de leads e processo de follow-up.`, priority: "high" });
      }
      if (Number(row.automations || 0) === 0) {
        recommendations.push({ type: "action", title: "Ativar automações", description: "Nenhuma automação ativa. Configurar automações de mudança de etapa, notificações e tarefas.", priority: "medium" });
      }
      if (Number(row.waConnected || 0) === 0) {
        recommendations.push({ type: "opportunity", title: "Integrar WhatsApp", description: "WhatsApp não conectado. Ativar para melhorar comunicação com clientes.", priority: "medium" });
      }
      if (Number(row.aiEnabled || 0) === 0) {
        recommendations.push({ type: "opportunity", title: "Ativar IA para ganho operacional", description: "Chatbot IA não ativado. Pode automatizar atendimento e qualificação.", priority: "medium" });
      }
      if (Number(row.integrations || 0) === 0) {
        recommendations.push({ type: "opportunity", title: "Integrar ferramentas externas", description: "Sem integrações ativas. Conectar RD Station, Meta Ads ou outras ferramentas.", priority: "low" });
      }
      if (Number(row.proposals || 0) === 0 && dealsTotal > 5) {
        recommendations.push({ type: "action", title: "Usar propostas comerciais", description: "Tenant tem negociações mas não usa propostas. Ativar para profissionalizar vendas.", priority: "low" });
      }
      if (usersActive < 2 && dealsTotal > 10) {
        recommendations.push({ type: "opportunity", title: "Ativar mais usuários", description: "Apenas 1 usuário ativo com volume alto de negociações. Distribuir carga.", priority: "medium" });
      }
      if (dealsTotal > 0 && Number(row.dealsOpen || 0) > dealsTotal * 0.7) {
        recommendations.push({ type: "risk", title: "Muitas negociações paradas", description: "Mais de 70% das negociações estão abertas. Revisar acompanhamento.", priority: "high" });
      }

      return {
        tenantName: row.name,
        plan: row.plan,
        recommendations: recommendations.sort((a, b) => {
          const p = { high: 0, medium: 1, low: 2 };
          return p[a.priority] - p[b.priority];
        }),
      };
    }),

  // ═══════════════════════════════════════
  // TENANT USERS LIST (for detail page)
  // ═══════════════════════════════════════
  tenantUsers: publicProcedure
    .input(z.object({ tenantId: z.number().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireSuperAdmin(ctx);
      const db = await getDatabase();

      const [rows] = await db.execute(sql`
        SELECT id, name, email, crm_user_role AS role, status, lastActiveAt, lastLoginAt, createdAt
        FROM crm_users WHERE tenantId = ${input.tenantId}
        ORDER BY ISNULL(lastActiveAt), lastActiveAt DESC
        LIMIT 100
      `) as any;

      return (rows || []).map((r: any) => ({
        id: Number(r.id),
        name: r.name,
        email: r.email,
        role: r.role,
        status: r.status,
        lastActiveAt: r.lastActiveAt,
        lastLoginAt: r.lastLoginAt,
        createdAt: r.createdAt,
      }));
    }),
});
