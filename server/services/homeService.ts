/**
 * Home Dashboard Service
 * 
 * Provides all data for the redesigned Home page:
 * - homeExecutive: month KPIs (no-task deals, cooling deals, active deals, value, conversion, forecast)
 * - homeTasks: today's tasks ordered by most overdue first
 * - homeRFV: smart filter counts for RFV opportunities
 * - homeOnboarding: checklist progress per tenant
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

// ═══════════════════════════════════════
// 1. HOME EXECUTIVE — Month KPIs
// ═══════════════════════════════════════

export async function getHomeExecutive(tenantId: number, userId?: number) {
  const db = await getDb();
  if (!db) {
    return {
      dealsWithoutTask: 0,
      dealsWithoutTaskList: [] as any[],
      coolingDeals: 0,
      coolingDealsList: [] as any[],
      activeDeals: 0,
      activeValueCents: 0,
      conversionRate: 0,
      wonValueCents: 0,
      forecastCents: 0,
      wonDeals: 0,
      lostDeals: 0,
    };
  }

  const now = new Date();
  // Month boundaries in SP timezone
  const nowSP = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const monthStart = new Date(nowSP.getFullYear(), nowSP.getMonth(), 1);

  // Owner filter for non-admin users
  const ownerFilter = userId ? sql`AND d.ownerUserId = ${userId}` : sql``;

  // 1. Active open deals (in sales pipelines)
  const [activeResult] = await db.execute(sql`
    SELECT 
      COUNT(*) as activeDeals,
      COALESCE(SUM(d.valueCents), 0) as activeValueCents
    FROM deals d
    JOIN pipelines p ON p.id = d.pipelineId AND p.pipelineType = 'sales'
    WHERE d.tenantId = ${tenantId} 
      AND d.deletedAt IS NULL 
      AND d.status = 'open'
      ${ownerFilter}
  `);
  const active = (activeResult as unknown as any[])[0] || {};
  const activeDeals = Number(active.activeDeals) || 0;
  const activeValueCents = Number(active.activeValueCents) || 0;

  // 2. Won/Lost this month (for conversion rate)
  const [monthResult] = await db.execute(sql`
    SELECT 
      SUM(CASE WHEN d.status = 'won' THEN 1 ELSE 0 END) as wonDeals,
      SUM(CASE WHEN d.status = 'lost' THEN 1 ELSE 0 END) as lostDeals,
      COALESCE(SUM(CASE WHEN d.status = 'won' THEN d.valueCents ELSE 0 END), 0) as wonValueCents
    FROM deals d
    JOIN pipelines p ON p.id = d.pipelineId AND p.pipelineType = 'sales'
    WHERE d.tenantId = ${tenantId} 
      AND d.deletedAt IS NULL
      AND d.updatedAt >= ${monthStart}
      AND d.status IN ('won', 'lost')
      ${ownerFilter}
  `);
  const month = (monthResult as unknown as any[])[0] || {};
  const wonDeals = Number(month.wonDeals) || 0;
  const lostDeals = Number(month.lostDeals) || 0;
  const wonValueCents = Number(month.wonValueCents) || 0;
  const closedDeals = wonDeals + lostDeals;
  const conversionRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0;

  // Forecast: wonValueCents + (activeValueCents * conversionRate / 100)
  const forecastCents = wonValueCents + Math.round(activeValueCents * (conversionRate / 100));

  // 3. Deals without any pending/in_progress task
  const [noTaskResult] = await db.execute(sql`
    SELECT d.id, d.title, d.valueCents, d.ownerUserId, d.stageId, d.createdAt, d.lastActivityAt,
           ps.name as stageName,
           c.name as contactName,
           u.name as ownerName
    FROM deals d
    JOIN pipelines p ON p.id = d.pipelineId AND p.pipelineType = 'sales'
    LEFT JOIN pipeline_stages ps ON ps.id = d.stageId
    LEFT JOIN contacts c ON c.id = d.contactId
    LEFT JOIN crm_users u ON u.id = d.ownerUserId AND u.tenantId = ${tenantId}
    WHERE d.tenantId = ${tenantId}
      AND d.deletedAt IS NULL
      AND d.status = 'open'
      ${ownerFilter}
      AND d.id NOT IN (
        SELECT DISTINCT t.entityId FROM crm_tasks t
        WHERE t.tenantId = ${tenantId}
          AND t.entityType = 'deal'
          AND t.status IN ('pending', 'in_progress')
      )
    ORDER BY d.lastActivityAt ASC
    LIMIT 100
  `);
  const dealsWithoutTaskList = (noTaskResult as unknown as any[]).map((r: any) => ({
    id: Number(r.id),
    title: String(r.title || ""),
    valueCents: Number(r.valueCents) || 0,
    stageName: r.stageName ? String(r.stageName) : "",
    contactName: r.contactName ? String(r.contactName) : "",
    ownerName: r.ownerName ? String(r.ownerName) : "",
    lastActivityAt: r.lastActivityAt ? new Date(r.lastActivityAt).getTime() : null,
  }));

  // 4. Cooling deals — uses per-stage coolingEnabled + coolingDays from pipeline config
  const [coolingResult] = await db.execute(sql`
    SELECT d.id, d.title, d.valueCents, d.ownerUserId, d.stageId, d.createdAt, d.lastActivityAt,
           ps.name as stageName, ps.coolingDays,
           c.name as contactName,
           u.name as ownerName
    FROM deals d
    JOIN pipelines p ON p.id = d.pipelineId AND p.pipelineType = 'sales'
    INNER JOIN pipeline_stages ps ON ps.id = d.stageId AND ps.coolingEnabled = 1
    LEFT JOIN contacts c ON c.id = d.contactId
    LEFT JOIN crm_users u ON u.id = d.ownerUserId AND u.tenantId = ${tenantId}
    WHERE d.tenantId = ${tenantId}
      AND d.deletedAt IS NULL
      AND d.status = 'open'
      ${ownerFilter}
      AND COALESCE(d.lastActivityAt, d.createdAt) < DATE_SUB(NOW(), INTERVAL COALESCE(ps.coolingDays, 3) DAY)
    ORDER BY COALESCE(d.lastActivityAt, d.createdAt) ASC
    LIMIT 100
  `);
  const coolingDealsList = (coolingResult as unknown as any[]).map((r: any) => ({
    id: Number(r.id),
    title: String(r.title || ""),
    valueCents: Number(r.valueCents) || 0,
    stageName: r.stageName ? String(r.stageName) : "",
    contactName: r.contactName ? String(r.contactName) : "",
    ownerName: r.ownerName ? String(r.ownerName) : "",
    lastActivityAt: r.lastActivityAt ? new Date(r.lastActivityAt).getTime() : new Date(r.createdAt).getTime(),
    coolingDays: Number(r.coolingDays) || 3,
  }));

  return {
    dealsWithoutTask: dealsWithoutTaskList.length,
    dealsWithoutTaskList,
    coolingDeals: coolingDealsList.length,
    coolingDealsList,
    activeDeals,
    activeValueCents,
    conversionRate,
    wonValueCents,
    forecastCents,
    wonDeals,
    lostDeals,
  };
}

// ═══════════════════════════════════════
// 2. HOME TASKS — Real CRM tasks ordered by urgency
//    Ordering: overdue oldest→newest → today → future upcoming
//    Includes: deal title, contact name, account name
//    Respects: multi-tenant, user ownership (assignedTo + task_assignees + createdBy)
// ═══════════════════════════════════════

export async function getHomeTasks(tenantId: number, userId?: number, limit = 15) {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const nowSP = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const todayEnd = new Date(nowSP.getFullYear(), nowSP.getMonth(), nowSP.getDate() + 1);
  // Include tasks up to 7 days in the future for "upcoming" view
  const futureLimit = new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);

  // User filter: match the CRM task module logic
  // Non-admin users see tasks they created, are assigned to (direct), or are in task_assignees
  const userFilter = userId
    ? sql`AND (
        t.assignedToUserId = ${userId}
        OR t.createdByUserId = ${userId}
        OR t.id IN (SELECT taskId FROM task_assignees WHERE userId = ${userId})
      )`
    : sql``;

  const [rows] = await db.execute(sql`
    SELECT t.id, t.title, t.dueAt, t.priority, t.status, t.taskType,
           t.entityType, t.entityId, t.description,
           d.title as dealTitle,
           d.valueCents as dealValueCents,
           c.name as contactName,
           a.name as accountName
    FROM crm_tasks t
    LEFT JOIN deals d ON t.entityType = 'deal' AND d.id = t.entityId AND d.tenantId = ${tenantId}
    LEFT JOIN contacts c ON (
      (t.entityType = 'contact' AND c.id = t.entityId)
      OR (t.entityType = 'deal' AND d.contactId IS NOT NULL AND c.id = d.contactId)
    ) AND c.tenantId = ${tenantId}
    LEFT JOIN accounts a ON t.entityType = 'deal' AND d.accountId IS NOT NULL AND a.id = d.accountId AND a.tenantId = ${tenantId}
    WHERE t.tenantId = ${tenantId}
      AND t.status IN ('pending', 'in_progress')
      ${userFilter}
      AND (
        t.dueAt IS NULL
        OR t.dueAt < ${futureLimit}
      )
    ORDER BY
      CASE
        WHEN t.dueAt IS NOT NULL AND t.dueAt < ${now} THEN 0
        WHEN t.dueAt IS NOT NULL AND t.dueAt < ${todayEnd} THEN 1
        WHEN t.dueAt IS NOT NULL THEN 2
        ELSE 3
      END ASC,
      CASE
        WHEN t.dueAt IS NOT NULL AND t.dueAt < ${now} THEN t.dueAt
        ELSE NULL
      END ASC,
      CASE
        WHEN t.dueAt IS NOT NULL AND t.dueAt >= ${now} THEN t.dueAt
        ELSE NULL
      END ASC,
      CASE t.priority
        WHEN 'urgent' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END ASC
    LIMIT ${limit}
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    id: Number(r.id),
    title: String(r.title),
    description: r.description ? String(r.description) : null,
    dueAt: r.dueAt ? new Date(r.dueAt).getTime() : null,
    priority: String(r.priority) as "low" | "medium" | "high" | "urgent",
    status: String(r.status),
    taskType: r.taskType ? String(r.taskType) : "task",
    entityType: String(r.entityType),
    entityId: Number(r.entityId),
    dealTitle: r.dealTitle ? String(r.dealTitle) : null,
    dealValueCents: r.dealValueCents ? Number(r.dealValueCents) : null,
    contactName: r.contactName ? String(r.contactName) : null,
    accountName: r.accountName ? String(r.accountName) : null,
    isOverdue: r.dueAt ? new Date(r.dueAt).getTime() < now.getTime() : false,
  }));
}

// ═══════════════════════════════════════
// 3. HOME RFV — Smart filter counts for opportunities
// ═══════════════════════════════════════

export async function getHomeRFV(tenantId: number) {
  const db = await getDb();
  if (!db) {
    return {
      indicacao: 0,
      recuperacao: 0,
      recorrencia: 0,
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [result] = await db.execute(sql`
    SELECT
      (
        SELECT COUNT(*) FROM rfv_contacts rc
        WHERE rc.tenantId = ${tenantId} AND rc.deletedAt IS NULL AND rc.fScore > 0 AND rc.lastPurchaseAt >= ${thirtyDaysAgo}
      ) AS indicacao,
      (
        SELECT COUNT(*) FROM rfv_contacts rc
        WHERE rc.tenantId = ${tenantId} AND rc.deletedAt IS NULL AND rc.rScore BETWEEN 250 AND 350 AND rc.fScore > 0
      ) AS recuperacao,
      (
        SELECT COUNT(*) FROM rfv_contacts rc
        WHERE rc.tenantId = ${tenantId} AND rc.deletedAt IS NULL AND rc.fScore > 1
      ) AS recorrencia
  `);

  const row = (result as unknown as any[])[0] || {};
  return {
    indicacao: Number(row.indicacao) || 0,
    recuperacao: Number(row.recuperacao) || 0,
    recorrencia: Number(row.recorrencia) || 0,
  };
}

// ═══════════════════════════════════════
// 4. HOME ONBOARDING — Checklist progress per tenant
// ═══════════════════════════════════════

export const ONBOARDING_STEPS = [
  { key: "team", label: "Cadastrar equipe ou usuários", href: "/settings/users", description: "Adicione os membros da sua equipe comercial" },
  { key: "pipeline", label: "Configurar funil de vendas", href: "/settings/pipelines", description: "Personalize as etapas do seu processo de vendas" },
  { key: "stages", label: "Configurar etapas do funil", href: "/settings/pipelines", description: "Defina as etapas que suas negociações percorrem" },
  { key: "products", label: "Cadastrar produtos", href: "/settings/products", description: "Adicione seus produtos e serviços ao catálogo" },
  { key: "loss_reasons", label: "Cadastrar motivos de perda", href: "/settings/loss-reasons", description: "Defina os motivos pelos quais negociações são perdidas" },
  { key: "import", label: "Importar contatos e negociações", href: "/settings/import", description: "Importe sua base de dados existente" },
  { key: "custom_fields", label: "Configurar campos personalizados", href: "/settings/custom-fields", description: "Crie campos específicos para seu negócio" },
  { key: "goals", label: "Configurar metas", href: "/settings/goals", description: "Defina metas de vendas para sua equipe" },
  { key: "automations", label: "Configurar automações", href: "/settings/automations", description: "Automatize tarefas repetitivas do CRM" },
  { key: "first_deal", label: "Criar primeiras negociações", href: "/pipeline", description: "Comece a registrar suas oportunidades de venda" },
  { key: "first_task", label: "Criar tarefas para o time", href: "/tasks", description: "Organize as atividades da equipe comercial" },
  { key: "rfv", label: "Revisar RFV e oportunidades", href: "/rfv", description: "Analise o perfil de compra dos seus contatos" },
  { key: "channels", label: "Conectar canais de comunicação", href: "/settings/whatsapp", description: "Integre WhatsApp e outros canais" },
  { key: "validate", label: "Validar operação do time", href: "/analytics/crm-live", description: "Verifique se o time está operando corretamente" },
] as const;

export type OnboardingStepKey = typeof ONBOARDING_STEPS[number]["key"];

export async function getHomeOnboarding(tenantId: number) {
  const db = await getDb();
  if (!db) {
    return {
      steps: ONBOARDING_STEPS.map(s => ({ ...s, completed: false })),
      completedCount: 0,
      totalSteps: ONBOARDING_STEPS.length,
      progressPercent: 0,
    };
  }

  // Auto-detect completion based on real data
  const [checks] = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM crm_users WHERE tenantId = ${tenantId}) as userCount,
      (SELECT COUNT(*) FROM pipelines WHERE tenantId = ${tenantId}) as pipelineCount,
      (SELECT COUNT(*) FROM pipeline_stages WHERE tenantId = ${tenantId}) as stageCount,
      (SELECT COUNT(*) FROM product_catalog WHERE tenantId = ${tenantId} AND isActive = 1) as productCount,
      (SELECT COUNT(*) FROM loss_reasons WHERE tenantId = ${tenantId} AND deletedAt IS NULL) as lossReasonCount,
      (SELECT COUNT(*) FROM contacts WHERE tenantId = ${tenantId} AND deletedAt IS NULL) as contactCount,
      (SELECT COUNT(*) FROM custom_fields WHERE tenantId = ${tenantId}) as customFieldCount,
      (SELECT COUNT(*) FROM goals WHERE tenantId = ${tenantId}) as goalCount,
      (SELECT COUNT(*) FROM pipeline_automations WHERE tenantId = ${tenantId}) as automationCount,
      (SELECT COUNT(*) FROM deals WHERE tenantId = ${tenantId} AND deletedAt IS NULL) as dealCount,
      (SELECT COUNT(*) FROM crm_tasks WHERE tenantId = ${tenantId}) as taskCount,
      (SELECT COUNT(*) FROM rfv_contacts WHERE tenantId = ${tenantId} AND deletedAt IS NULL) as rfvCount,
      (SELECT COUNT(*) FROM whatsapp_sessions WHERE tenantId = ${tenantId}) as channelCount
  `);

  const data = (checks as unknown as any[])[0] || {};
  
  // Also check for manually dismissed items from user_preferences
  const [prefRows] = await db.execute(sql`
    SELECT prefValue FROM user_preferences
    WHERE tenantId = ${tenantId} AND prefKey = 'onboarding_completed_steps'
    LIMIT 1
  `);
  const manuallyCompleted: string[] = (() => {
    try {
      const val = (prefRows as unknown as any[])[0]?.prefValue;
      return val ? JSON.parse(val) : [];
    } catch { return []; }
  })();

  const autoComplete: Record<string, boolean> = {
    team: Number(data.userCount) > 1,
    pipeline: Number(data.pipelineCount) > 0,
    stages: Number(data.stageCount) > 2,
    products: Number(data.productCount) > 0,
    loss_reasons: Number(data.lossReasonCount) > 0,
    import: Number(data.contactCount) > 5,
    custom_fields: Number(data.customFieldCount) > 0,
    goals: Number(data.goalCount) > 0,
    automations: Number(data.automationCount) > 0,
    first_deal: Number(data.dealCount) > 0,
    first_task: Number(data.taskCount) > 0,
    rfv: Number(data.rfvCount) > 0,
    channels: Number(data.channelCount) > 0,
    validate: false, // Manual only
  };

  const steps = ONBOARDING_STEPS.map(s => ({
    ...s,
    completed: autoComplete[s.key] || manuallyCompleted.includes(s.key),
  }));

  const completedCount = steps.filter(s => s.completed).length;

  return {
    steps,
    completedCount,
    totalSteps: ONBOARDING_STEPS.length,
    progressPercent: Math.round((completedCount / ONBOARDING_STEPS.length) * 100),
  };
}

export async function toggleOnboardingStep(tenantId: number, userId: number, stepKey: string, completed: boolean) {
  const db = await getDb();
  if (!db) return { success: false };

  // Get current manually completed steps
  const [prefRows] = await db.execute(sql`
    SELECT prefValue FROM user_preferences
    WHERE tenantId = ${tenantId} AND prefKey = 'onboarding_completed_steps'
    LIMIT 1
  `);
  
  let steps: string[] = [];
  try {
    const val = (prefRows as unknown as any[])[0]?.prefValue;
    steps = val ? JSON.parse(val) : [];
  } catch { steps = []; }

  if (completed && !steps.includes(stepKey)) {
    steps.push(stepKey);
  } else if (!completed) {
    steps = steps.filter(s => s !== stepKey);
  }

  const value = JSON.stringify(steps);

  // Upsert
  const [existing] = await db.execute(sql`
    SELECT id FROM user_preferences
    WHERE tenantId = ${tenantId} AND prefKey = 'onboarding_completed_steps'
    LIMIT 1
  `);

  if ((existing as unknown as any[]).length > 0) {
    await db.execute(sql`
      UPDATE user_preferences SET prefValue = ${value}, updatedAt = NOW()
      WHERE tenantId = ${tenantId} AND prefKey = 'onboarding_completed_steps'
    `);
  } else {
    await db.execute(sql`
      INSERT INTO user_preferences (userId, tenantId, prefKey, prefValue, createdAt, updatedAt)
      VALUES (${userId}, ${tenantId}, 'onboarding_completed_steps', ${value}, NOW(), NOW())
    `);
  }

  return { success: true };
}

export async function dismissOnboarding(tenantId: number, userId: number) {
  const db = await getDb();
  if (!db) return { success: false };

  const [existing] = await db.execute(sql`
    SELECT id FROM user_preferences
    WHERE tenantId = ${tenantId} AND prefKey = 'onboarding_dismissed'
    LIMIT 1
  `);

  if ((existing as unknown as any[]).length > 0) {
    await db.execute(sql`
      UPDATE user_preferences SET prefValue = 'true', updatedAt = NOW()
      WHERE tenantId = ${tenantId} AND prefKey = 'onboarding_dismissed'
    `);
  } else {
    await db.execute(sql`
      INSERT INTO user_preferences (userId, tenantId, prefKey, prefValue, createdAt, updatedAt)
      VALUES (${userId}, ${tenantId}, 'onboarding_dismissed', 'true', NOW(), NOW())
    `);
  }

  return { success: true };
}

export async function isOnboardingDismissed(tenantId: number) {
  const db = await getDb();
  if (!db) return false;

  const [rows] = await db.execute(sql`
    SELECT prefValue FROM user_preferences
    WHERE tenantId = ${tenantId} AND prefKey = 'onboarding_dismissed'
    LIMIT 1
  `);

  return (rows as unknown as any[])[0]?.prefValue === 'true';
}
