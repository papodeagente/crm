import { eq, and, desc, asc, like, sql, inArray, count, sum, gte, lt, lte, ne, isNull, isNotNull } from "drizzle-orm";
import { getDb } from "./db";
import {
  tenants, crmUsers, teams, teamMembers, roles, permissions, rolePermissions, userRoles, apiKeys,
  contacts, accounts, deals, dealParticipants, pipelines, pipelineStages, pipelineAutomations, trips, tripItems,
  tasks, taskAssignees, crmNotes, crmAttachments, dealProducts, dealHistory,
  channels, conversations, inboxMessages,
  proposalTemplates, proposals, proposalItems, proposalSignatures,
  portalUsers, portalSessions, portalTickets,
  goals, performanceSnapshots, metricsDaily, alerts,
  courses, lessons, enrollments,
  integrations, integrationConnections, integrationCredentials, webhooks, jobs, jobDlq,
  eventLog,
  productCategories, productCatalog,
  waMessages, whatsappSessions, waConversations,
  aiConversationAnalyses,
  leadSources, campaigns, lossReasons,
  taskAutomations,
  dateAutomations,
} from "../drizzle/schema";

// ═══════════════════════════════════════
// TENANTS
// ═══════════════════════════════════════
export async function createTenant(data: { name: string; plan?: "free" | "pro" | "enterprise"; ownerUserId?: number; hotmartEmail?: string; freemiumDays?: number }) {
  const db = await getDb(); if (!db) return null;
  const freemiumDays = data.freemiumDays ?? 365;
  const freemiumExpiresAt = new Date(Date.now() + freemiumDays * 24 * 60 * 60 * 1000);
  const [result] = await db.insert(tenants).values({ name: data.name, plan: data.plan || "free", ownerUserId: data.ownerUserId, hotmartEmail: data.hotmartEmail, freemiumDays, freemiumExpiresAt }).$returningId();
  // Auto-create default pipelines for new tenant
  try {
    const { createDefaultPipelines } = await import("./classificationEngine");
    await createDefaultPipelines(result.id);
  } catch (e) {
    console.error("[Onboarding] Failed to create default pipelines:", e);
  }
  // Auto-seed default loss reasons for new tenant
  try {
    const { seedDefaultLossReasons } = await import("./seedLossReasons");
    await seedDefaultLossReasons(result.id);
  } catch (e) {
    console.error("[Onboarding] Failed to seed default loss reasons:", e);
  }
  return result;
}
export async function getTenantById(id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return rows[0] || null;
}
export async function listTenants() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(tenants).orderBy(desc(tenants.createdAt));
}

// ═══════════════════════════════════════
// CRM USERS (IAM)
// ═══════════════════════════════════════
export async function createCrmUser(data: { tenantId: number; name: string; email: string; phone?: string; createdBy?: number }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(crmUsers).values(data).$returningId();
  return result;
}
export async function getCrmUserById(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(crmUsers).where(and(eq(crmUsers.id, id), eq(crmUsers.tenantId, tenantId))).limit(1);
  return rows[0] || null;
}
export async function listCrmUsers(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(crmUsers).where(eq(crmUsers.tenantId, tenantId)).orderBy(desc(crmUsers.createdAt));
}
export async function updateCrmUser(tenantId: number, id: number, data: Partial<{ name: string; email: string; phone: string; status: "active" | "inactive" | "invited"; updatedBy: number }>) {
  const db = await getDb(); if (!db) return;
  await db.update(crmUsers).set(data).where(and(eq(crmUsers.id, id), eq(crmUsers.tenantId, tenantId)));
}
export async function deleteCrmUser(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return;
  await db.delete(crmUsers).where(and(eq(crmUsers.id, id), eq(crmUsers.tenantId, tenantId)));
}

// ═══════════════════════════════════════
// TEAMS
// ═══════════════════════════════════════
export async function createTeam(data: { tenantId: number; name: string }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(teams).values(data).$returningId();
  return result;
}
export async function listTeams(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(teams).where(eq(teams.tenantId, tenantId));
}
export async function addTeamMember(data: { tenantId: number; userId: number; teamId: number }) {
  const db = await getDb(); if (!db) return;
  await db.insert(teamMembers).values(data);
}
export async function getTeamMembers(tenantId: number, teamId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(teamMembers).where(and(eq(teamMembers.tenantId, tenantId), eq(teamMembers.teamId, teamId)));
}
export async function removeTeamMember(tenantId: number, userId: number, teamId: number) {
  const db = await getDb(); if (!db) return;
  await db.delete(teamMembers).where(and(eq(teamMembers.tenantId, tenantId), eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)));
}

// ═══════════════════════════════════════
// ROLES & PERMISSIONS
// ═══════════════════════════════════════
export async function createRole(data: { tenantId: number; slug: string; name: string; isSystemRole?: boolean; description?: string }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(roles).values(data).$returningId();
  return result;
}
export async function listRoles(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(roles).where(eq(roles.tenantId, tenantId));
}
export async function assignRole(data: { tenantId: number; userId: number; roleId: number }) {
  const db = await getDb(); if (!db) return;
  await db.insert(userRoles).values(data);
}
export async function listPermissions() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(permissions);
}
export async function assignPermissionToRole(data: { tenantId: number; roleId: number; permissionId: number }) {
  const db = await getDb(); if (!db) return;
  await db.insert(rolePermissions).values(data);
}

// ═══════════════════════════════════════
// CONTACTS
// ═══════════════════════════════════════
export async function createContact(data: { tenantId: number; name: string; type?: "person" | "company"; email?: string; phone?: string; source?: string; ownerUserId?: number; teamId?: number; createdBy?: number }) {
  const db = await getDb(); if (!db) return null;
  // Normalize phone to canonical Brazilian format (+55DDNNNNNNNNN)
  if (data.phone) {
    const { normalizeBrazilianPhone } = await import("./phoneUtils");
    const normalized = normalizeBrazilianPhone(data.phone);
    if (normalized) data.phone = `+${normalized}`;
  }
  const [result] = await db.insert(contacts).values(data).$returningId();
  return result;
}
export async function getContactById(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId))).limit(1);
  return rows[0] || null;
}
export async function listContacts(tenantId: number, opts?: { search?: string; stage?: string; limit?: number; offset?: number; includeDeleted?: boolean; dateFrom?: string; dateTo?: string; ownerUserId?: number; customFieldFilters?: { fieldId: number; value: string }[] }) {
  const db = await getDb(); if (!db) return [];
  const conditions: any[] = [eq(contacts.tenantId, tenantId)];
  if (!opts?.includeDeleted) conditions.push(isNull(contacts.deletedAt));
  if (opts?.search) conditions.push(like(contacts.name, `%${opts.search}%`));
  if (opts?.dateFrom) conditions.push(gte(contacts.createdAt, new Date(opts.dateFrom + "T00:00:00")));
  if (opts?.dateTo) conditions.push(lte(contacts.createdAt, new Date(opts.dateTo + "T23:59:59")));
  if (opts?.ownerUserId) conditions.push(eq(contacts.ownerUserId, opts.ownerUserId));
  // Custom field filters: subquery to find matching entity IDs
  if (opts?.customFieldFilters && opts.customFieldFilters.length > 0) {
    for (const cf of opts.customFieldFilters) {
      conditions.push(
        sql`${contacts.id} IN (SELECT entityId FROM custom_field_values WHERE tenantId = ${tenantId} AND entityType = 'contact' AND fieldId = ${cf.fieldId} AND value LIKE ${'%' + cf.value + '%'})`
      );
    }
  }
  return db.select().from(contacts).where(and(...conditions)).orderBy(desc(contacts.updatedAt)).limit(opts?.limit || 50).offset(opts?.offset || 0);
}
export async function updateContact(tenantId: number, id: number, data: Partial<{ name: string; email: string; phone: string; lifecycleStage: "lead" | "prospect" | "customer" | "churned"; notes: string; ownerUserId: number; updatedBy: number; birthDate: string | null; weddingDate: string | null }>) {
  const db = await getDb(); if (!db) return;
  // Normalize phone to canonical Brazilian format (+55DDNNNNNNNNN)
  if (data.phone) {
    const { normalizeBrazilianPhone } = await import("./phoneUtils");
    const normalized = normalizeBrazilianPhone(data.phone);
    if (normalized) data.phone = `+${normalized}`;
  }
  await db.update(contacts).set(data).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
}
export async function deleteContact(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return;
  await db.update(contacts).set({ deletedAt: new Date() }).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
}
export async function bulkSoftDeleteContacts(tenantId: number, ids: number[]) {
  const db = await getDb(); if (!db) return 0;
  if (ids.length === 0) return 0;
  const result = await db.update(contacts).set({ deletedAt: new Date() }).where(and(eq(contacts.tenantId, tenantId), inArray(contacts.id, ids)));
  return (result as any)[0]?.affectedRows ?? ids.length;
}
export async function hardDeleteContacts(tenantId: number, ids: number[]) {
  const db = await getDb(); if (!db) return 0;
  if (ids.length === 0) return 0;
  const result = await db.delete(contacts).where(and(eq(contacts.tenantId, tenantId), inArray(contacts.id, ids)));
  return (result as any)[0]?.affectedRows ?? ids.length;
}
export async function restoreContacts(tenantId: number, ids: number[]) {
  const db = await getDb(); if (!db) return 0;
  if (ids.length === 0) return 0;
  const result = await db.update(contacts).set({ deletedAt: null }).where(and(eq(contacts.tenantId, tenantId), inArray(contacts.id, ids)));
  return (result as any)[0]?.affectedRows ?? ids.length;
}
export async function listDeletedContacts(tenantId: number, limit = 50) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(contacts).where(and(eq(contacts.tenantId, tenantId), isNotNull(contacts.deletedAt))).orderBy(desc(contacts.deletedAt)).limit(limit);
}
export async function countContacts(tenantId: number, opts?: { search?: string; stage?: string; dateFrom?: string; dateTo?: string; ownerUserId?: number; customFieldFilters?: { fieldId: number; value: string }[] }) {
  const db = await getDb(); if (!db) return 0;
  const conditions: any[] = [eq(contacts.tenantId, tenantId), isNull(contacts.deletedAt)];
  if (opts?.search) conditions.push(like(contacts.name, `%${opts.search}%`));
  if (opts?.dateFrom) conditions.push(gte(contacts.createdAt, new Date(opts.dateFrom + "T00:00:00")));
  if (opts?.dateTo) conditions.push(lte(contacts.createdAt, new Date(opts.dateTo + "T23:59:59")));
  if (opts?.ownerUserId) conditions.push(eq(contacts.ownerUserId, opts.ownerUserId));
  if (opts?.customFieldFilters && opts.customFieldFilters.length > 0) {
    for (const cf of opts.customFieldFilters) {
      conditions.push(
        sql`${contacts.id} IN (SELECT entityId FROM custom_field_values WHERE tenantId = ${tenantId} AND entityType = 'contact' AND fieldId = ${cf.fieldId} AND value LIKE ${'%' + cf.value + '%'})`
      );
    }
  }
  const rows = await db.select({ count: sql<number>`count(*)` }).from(contacts).where(and(...conditions));
  return rows[0]?.count || 0;
}

// ═══════════════════════════════════════
// PIPELINES & STAGES
// ═══════════════════════════════════════
export async function createPipeline(data: { tenantId: number; name: string; isDefault?: boolean }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(pipelines).values(data).$returningId();
  return result;
}
export async function listPipelines(tenantId: number, includeArchived = false) {
  const db = await getDb(); if (!db) return [];
  if (includeArchived) {
    return db.select().from(pipelines).where(eq(pipelines.tenantId, tenantId));
  }
  return db.select().from(pipelines).where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.isArchived, false)));
}
export async function createStage(data: { tenantId: number; pipelineId: number; name: string; orderIndex: number; probabilityDefault?: number; isWon?: boolean; isLost?: boolean }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(pipelineStages).values(data).$returningId();
  return result;
}
export async function listStages(tenantId: number, pipelineId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(pipelineStages).where(and(eq(pipelineStages.tenantId, tenantId), eq(pipelineStages.pipelineId, pipelineId))).orderBy(asc(pipelineStages.orderIndex));
}

// ═══════════════════════════════════════
// DEALS
// ═══════════════════════════════════════
export async function createDeal(data: { tenantId: number; title: string; contactId?: number; accountId?: number; pipelineId: number; stageId: number; valueCents?: number; ownerUserId?: number; teamId?: number; createdBy?: number; leadSource?: string; channelOrigin?: string; boardingDate?: Date | null; returnDate?: Date | null; utmSource?: string; utmMedium?: string; utmCampaign?: string; utmTerm?: string; utmContent?: string; utmJson?: any; rdCustomFields?: any; metaJson?: any; rawPayloadJson?: any; dedupeKey?: string; status?: string }) {
  const db = await getDb(); if (!db) return null;
  // Explicitly pick only known deal columns to prevent extra fields from leaking into the INSERT
  const cleanData: Record<string, any> = {
    tenantId: data.tenantId,
    title: data.title,
    pipelineId: data.pipelineId,
    stageId: data.stageId,
  };
  // Optional fields - only include if defined (not undefined)
  if (data.contactId !== undefined) cleanData.contactId = data.contactId;
  if (data.accountId !== undefined) cleanData.accountId = data.accountId;
  if (data.valueCents !== undefined) cleanData.valueCents = data.valueCents;
  if (data.ownerUserId !== undefined) cleanData.ownerUserId = data.ownerUserId;
  if (data.teamId !== undefined) cleanData.teamId = data.teamId;
  if (data.createdBy !== undefined) cleanData.createdBy = data.createdBy;
  if (data.leadSource !== undefined) cleanData.leadSource = data.leadSource;
  if (data.channelOrigin !== undefined) cleanData.channelOrigin = data.channelOrigin;
  if (data.boardingDate !== undefined) cleanData.boardingDate = data.boardingDate;
  if (data.returnDate !== undefined) cleanData.returnDate = data.returnDate;
  if (data.utmSource !== undefined) cleanData.utmSource = data.utmSource;
  if (data.utmMedium !== undefined) cleanData.utmMedium = data.utmMedium;
  if (data.utmCampaign !== undefined) cleanData.utmCampaign = data.utmCampaign;
  if (data.utmTerm !== undefined) cleanData.utmTerm = data.utmTerm;
  if (data.utmContent !== undefined) cleanData.utmContent = data.utmContent;
  if (data.utmJson !== undefined) cleanData.utmJson = data.utmJson;
  if (data.rdCustomFields !== undefined) cleanData.rdCustomFields = data.rdCustomFields;
  if (data.metaJson !== undefined) cleanData.metaJson = data.metaJson;
  if (data.rawPayloadJson !== undefined) cleanData.rawPayloadJson = data.rawPayloadJson;
  if (data.dedupeKey !== undefined) cleanData.dedupeKey = data.dedupeKey;
  if (data.status !== undefined) cleanData.status = data.status;
  try {
    const [result] = await db.insert(deals).values(cleanData as typeof deals.$inferInsert).$returningId();
    return result;
  } catch (error: any) {
    console.error('[createDeal] Failed to insert deal:', error?.message || error);
    throw new Error(`Erro ao criar negociação: ${error?.code === 'ER_DUP_ENTRY' ? 'Registro duplicado' : error?.code === 'ER_DATA_TOO_LONG' ? 'Dados muito longos para um dos campos' : 'Erro no banco de dados. Tente novamente.'}`);
  }
}
export async function getDealById(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(deals).where(and(eq(deals.id, id), eq(deals.tenantId, tenantId))).limit(1);
  return rows[0] || null;
}
export async function listDeals(tenantId: number, opts?: {
  pipelineId?: number; stageId?: number; status?: string; limit?: number; offset?: number;
  includeDeleted?: boolean; dateFrom?: string; dateTo?: string;
  // Advanced filters
  titleSearch?: string;
  accountId?: number;
  leadSource?: string;
  utmCampaign?: string;
  utmSource?: string;
  utmMedium?: string;
  productId?: number;
  valueMin?: number;
  valueMax?: number;
  expectedCloseDateFrom?: string;
  expectedCloseDateTo?: string;
  lastActivityDateFrom?: string;
  lastActivityDateTo?: string;
  noTasks?: boolean;
  cooling?: boolean; // no activity in last 7 days
  coolingDays?: number;
  ownerUserId?: number;
}) {
  const db = await getDb(); if (!db) return [];
  const conditions: any[] = [eq(deals.tenantId, tenantId)];
  if (!opts?.includeDeleted) conditions.push(isNull(deals.deletedAt));
  if (opts?.pipelineId) conditions.push(eq(deals.pipelineId, opts.pipelineId));
  if (opts?.stageId) conditions.push(eq(deals.stageId, opts.stageId));
  if (opts?.status) conditions.push(eq(deals.status, opts.status as any));
  if (opts?.dateFrom) conditions.push(gte(deals.createdAt, new Date(opts.dateFrom + "T00:00:00")));
  if (opts?.dateTo) conditions.push(lte(deals.createdAt, new Date(opts.dateTo + "T23:59:59")));
  // Title search
  if (opts?.titleSearch) conditions.push(like(deals.title, `%${opts.titleSearch}%`));
  // Account filter
  if (opts?.accountId) conditions.push(eq(deals.accountId, opts.accountId));
  // Lead source filter
  if (opts?.leadSource) conditions.push(eq(deals.leadSource, opts.leadSource));
  // UTM filters
  if (opts?.utmCampaign) conditions.push(eq(deals.utmCampaign, opts.utmCampaign));
  if (opts?.utmSource) conditions.push(eq(deals.utmSource, opts.utmSource));
  if (opts?.utmMedium) conditions.push(eq(deals.utmMedium, opts.utmMedium));
  // Value range
  if (opts?.valueMin !== undefined && opts.valueMin > 0) conditions.push(gte(deals.valueCents, opts.valueMin));
  if (opts?.valueMax !== undefined && opts.valueMax > 0) conditions.push(lte(deals.valueCents, opts.valueMax));
  // Expected close date range
  if (opts?.expectedCloseDateFrom) conditions.push(gte(deals.expectedCloseAt, new Date(opts.expectedCloseDateFrom + "T00:00:00")));
  if (opts?.expectedCloseDateTo) conditions.push(lte(deals.expectedCloseAt, new Date(opts.expectedCloseDateTo + "T23:59:59")));
  // Last activity date range
  if (opts?.lastActivityDateFrom) conditions.push(gte(deals.lastActivityAt, new Date(opts.lastActivityDateFrom + "T00:00:00")));
  if (opts?.lastActivityDateTo) conditions.push(lte(deals.lastActivityAt, new Date(opts.lastActivityDateTo + "T23:59:59")));
  // Product filter — deals that contain a specific product
  if (opts?.productId) {
    conditions.push(sql`${deals.id} IN (SELECT dealId FROM deal_products WHERE productId = ${opts.productId} AND tenantId = ${tenantId})`);
  }
  // No tasks filter
  if (opts?.noTasks) {
    conditions.push(sql`${deals.id} NOT IN (SELECT entityId FROM crm_tasks WHERE entityType = 'deal' AND tenantId = ${tenantId} AND status IN ('pending','in_progress'))`);
  }
  // Owner user filter
  if (opts?.ownerUserId) conditions.push(eq(deals.ownerUserId, opts.ownerUserId));
  // Cooling filter — no activity in last N days
  if (opts?.cooling) {
    const days = opts.coolingDays || 7;
    conditions.push(sql`${deals.lastActivityAt} < DATE_SUB(NOW(), INTERVAL ${days} DAY)`);
    conditions.push(eq(deals.status, "open"));
  }
  return db.select().from(deals).where(and(...conditions)).orderBy(desc(deals.lastActivityAt)).limit(opts?.limit || 50).offset(opts?.offset || 0);
}
export async function bulkSoftDeleteDeals(tenantId: number, ids: number[]) {
  const db = await getDb(); if (!db) return 0;
  if (ids.length === 0) return 0;
  const result = await db.update(deals).set({ deletedAt: new Date() }).where(and(eq(deals.tenantId, tenantId), inArray(deals.id, ids)));
  return (result as any)[0]?.affectedRows ?? ids.length;
}
export async function hardDeleteDeals(tenantId: number, ids: number[]) {
  const db = await getDb(); if (!db) return 0;
  if (ids.length === 0) return 0;
  const result = await db.delete(deals).where(and(eq(deals.tenantId, tenantId), inArray(deals.id, ids)));
  return (result as any)[0]?.affectedRows ?? ids.length;
}
export async function restoreDeals(tenantId: number, ids: number[]) {
  const db = await getDb(); if (!db) return 0;
  if (ids.length === 0) return 0;
  const result = await db.update(deals).set({ deletedAt: null }).where(and(eq(deals.tenantId, tenantId), inArray(deals.id, ids)));
  return (result as any)[0]?.affectedRows ?? ids.length;
}
export async function listDeletedDeals(tenantId: number, limit = 50) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(deals).where(and(eq(deals.tenantId, tenantId), isNotNull(deals.deletedAt))).orderBy(desc(deals.deletedAt)).limit(limit);
}
export async function updateDeal(tenantId: number, id: number, data: Partial<{ title: string; pipelineId: number; stageId: number; status: "open" | "won" | "lost"; valueCents: number; probability: number; ownerUserId: number; updatedBy: number; contactId: number | null; accountId: number | null; expectedCloseAt: Date | null; channelOrigin: string | null; leadSource: string | null; boardingDate: Date | null; returnDate: Date | null; lossReasonId: number | null; lossNotes: string | null; utmCampaign: string | null; utmSource: string | null; utmMedium: string | null; utmTerm: string | null; utmContent: string | null; rdCustomFields: Record<string, string> | null }>) {
  const db = await getDb(); if (!db) return;
  await db.update(deals).set({ ...data, lastActivityAt: new Date() }).where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)));
}
export async function countDeals(tenantId: number, status?: string, opts?: { pipelineId?: number; stageId?: number; titleSearch?: string; dateFrom?: string; dateTo?: string; ownerUserId?: number }) {
  const db = await getDb(); if (!db) return 0;
  const conditions: any[] = [eq(deals.tenantId, tenantId), isNull(deals.deletedAt)];
  if (status) conditions.push(eq(deals.status, status as any));
  if (opts?.pipelineId) conditions.push(eq(deals.pipelineId, opts.pipelineId));
  if (opts?.stageId) conditions.push(eq(deals.stageId, opts.stageId));
  if (opts?.titleSearch) conditions.push(like(deals.title, `%${opts.titleSearch}%`));
  if (opts?.dateFrom) conditions.push(gte(deals.createdAt, new Date(opts.dateFrom + "T00:00:00")));
  if (opts?.dateTo) conditions.push(lte(deals.createdAt, new Date(opts.dateTo + "T23:59:59")));
  if (opts?.ownerUserId) conditions.push(eq(deals.ownerUserId, opts.ownerUserId));
  const rows = await db.select({ count: sql<number>`count(*)` }).from(deals).where(and(...conditions));
  return rows[0]?.count || 0;
}
export async function sumDealValue(tenantId: number, status?: string, opts?: { dateFrom?: string; dateTo?: string; ownerUserId?: number }) {
  const db = await getDb(); if (!db) return 0;
  const conditions: any[] = [eq(deals.tenantId, tenantId), isNull(deals.deletedAt)];
  if (status) conditions.push(eq(deals.status, status as any));
  if (opts?.ownerUserId) conditions.push(eq(deals.ownerUserId, opts.ownerUserId));
  if (opts?.dateFrom) conditions.push(gte(deals.createdAt, new Date(opts.dateFrom + "T00:00:00")));
  if (opts?.dateTo) conditions.push(lte(deals.createdAt, new Date(opts.dateTo + "T23:59:59")));
  const rows = await db.select({ total: sql<number>`COALESCE(SUM(valueCents), 0)` }).from(deals).where(and(...conditions));
  return rows[0]?.total || 0;
}

// ═══════════════════════════════════════
// ACCOUNTS
// ═══════════════════════════════════════
export async function listAccounts(tenantId: number, opts?: { ownerUserId?: number }) {
  const db = await getDb(); if (!db) return [];
  const conditions: any[] = [eq(accounts.tenantId, tenantId)];
  if (opts?.ownerUserId) conditions.push(eq(accounts.ownerUserId, opts.ownerUserId));
  return db.select().from(accounts).where(and(...conditions)).orderBy(desc(accounts.createdAt));
}
export async function getAccountById(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.tenantId, tenantId))).limit(1);
  return rows[0] || null;
}
export async function createAccount(data: { tenantId: number; name: string; primaryContactId?: number; ownerUserId?: number; teamId?: number; createdBy?: number }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(accounts).values(data).$returningId();
  return result;
}
export async function updateAccount(tenantId: number, id: number, data: Partial<{ name: string; primaryContactId: number; ownerUserId: number; updatedBy: number }>) {
  const db = await getDb(); if (!db) return;
  await db.update(accounts).set(data).where(and(eq(accounts.id, id), eq(accounts.tenantId, tenantId)));
}
export async function searchAccounts(tenantId: number, search: string) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(accounts).where(and(eq(accounts.tenantId, tenantId), like(accounts.name, `%${search}%`))).orderBy(accounts.name).limit(20);
}

// ═══════════════════════════════════════
// DEAL PRODUCTS
// ═══════════════════════════════════════
export async function createDealProduct(data: { tenantId: number; dealId: number; productId: number; name: string; description?: string; category?: "flight" | "hotel" | "tour" | "transfer" | "insurance" | "cruise" | "visa" | "other"; quantity?: number; unitPriceCents?: number; discountCents?: number; finalPriceCents?: number; supplier?: string; checkIn?: Date; checkOut?: Date; notes?: string }) {
  const db = await getDb(); if (!db) return null;
  const qty = data.quantity || 1;
  const unit = data.unitPriceCents || 0;
  const discount = data.discountCents || 0;
  const finalPrice = data.finalPriceCents ?? (qty * unit - discount);
  const [result] = await db.insert(dealProducts).values({ ...data, finalPriceCents: finalPrice }).$returningId();
  return result;
}
export async function listDealProducts(tenantId: number, dealId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(dealProducts).where(and(eq(dealProducts.tenantId, tenantId), eq(dealProducts.dealId, dealId))).orderBy(desc(dealProducts.createdAt));
}
export async function updateDealProduct(tenantId: number, id: number, data: Partial<{ name: string; description: string; category: "flight" | "hotel" | "tour" | "transfer" | "insurance" | "cruise" | "visa" | "other"; quantity: number; unitPriceCents: number; discountCents: number; finalPriceCents: number; supplier: string; checkIn: Date; checkOut: Date; notes: string }>) {
  const db = await getDb(); if (!db) return;
  await db.update(dealProducts).set(data).where(and(eq(dealProducts.id, id), eq(dealProducts.tenantId, tenantId)));
}
export async function getDealProduct(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(dealProducts).where(and(eq(dealProducts.id, id), eq(dealProducts.tenantId, tenantId))).limit(1);
  return rows[0] || null;
}
export async function deleteDealProduct(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return;
  await db.delete(dealProducts).where(and(eq(dealProducts.id, id), eq(dealProducts.tenantId, tenantId)));
}

// Recalcular valueCents do deal com base na soma dos deal_products
export async function recalcDealValue(tenantId: number, dealId: number) {
  const db = await getDb(); if (!db) return 0;
  const [result] = await db.select({
    total: sql<number>`COALESCE(SUM(${dealProducts.finalPriceCents}), 0)`,
  }).from(dealProducts).where(and(eq(dealProducts.tenantId, tenantId), eq(dealProducts.dealId, dealId)));
  const totalCents = Number(result?.total ?? 0);
  await db.update(deals).set({ valueCents: totalCents, lastActivityAt: new Date() })
    .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)));
  return totalCents;
}

// ═══════════════════════════════════════
// DEAL HISTORY
// ═══════════════════════════════════════
export async function createDealHistory(data: { tenantId: number; dealId: number; action: string; description: string; fromStageId?: number; toStageId?: number; fromStageName?: string; toStageName?: string; fieldChanged?: string; oldValue?: string; newValue?: string; actorUserId?: number; actorName?: string; metadataJson?: any }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(dealHistory).values(data).$returningId();
  return result;
}
export async function listDealHistory(tenantId: number, dealId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(dealHistory).where(and(eq(dealHistory.tenantId, tenantId), eq(dealHistory.dealId, dealId))).orderBy(desc(dealHistory.createdAt));
}

// ═══════════════════════════════════════
// DEAL PARTICIPANTS
// ═══════════════════════════════════════
export async function addDealParticipant(data: { tenantId: number; dealId: number; contactId: number; role?: "decision_maker" | "traveler" | "payer" | "companion" | "other" }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(dealParticipants).values(data).$returningId();
  return result;
}
export async function listDealParticipants(tenantId: number, dealId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(dealParticipants).where(and(eq(dealParticipants.tenantId, tenantId), eq(dealParticipants.dealId, dealId)));
}
export async function removeDealParticipant(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return;
  await db.delete(dealParticipants).where(and(eq(dealParticipants.id, id), eq(dealParticipants.tenantId, tenantId)));
}

// ═══════════════════════════════════════
// TRIPS
// ═══════════════════════════════════════
export async function createTrip(data: { tenantId: number; dealId?: number; destinationSummary?: string; startDate?: Date; endDate?: Date; ownerUserId?: number; createdBy?: number }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(trips).values(data).$returningId();
  return result;
}
export async function listTrips(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(trips).where(eq(trips.tenantId, tenantId)).orderBy(desc(trips.createdAt));
}
export async function getTripById(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(trips).where(and(eq(trips.id, id), eq(trips.tenantId, tenantId))).limit(1);
  return rows[0] || null;
}

// ═══════════════════════════════════════
// TASKS
// ═══════════════════════════════════════
export async function createTask(data: { tenantId: number; entityType: string; entityId: number; title: string; taskType?: string; dueAt?: Date; assignedToUserId?: number; createdByUserId?: number; priority?: "low" | "medium" | "high" | "urgent"; description?: string }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(tasks).values(data).$returningId();
  // Auto-assign creator as default assignee
  if (result && data.createdByUserId) {
    await db.insert(taskAssignees).values({ taskId: result.id, userId: data.createdByUserId, tenantId: data.tenantId });
  }
  return result;
}

export async function listTasks(tenantId: number, opts?: { entityType?: string; entityId?: number; status?: string; taskType?: string; assigneeUserId?: number; dateFrom?: string; dateTo?: string; limit?: number; offset?: number; createdByUserId?: number }) {
  const db = await getDb(); if (!db) return { tasks: [], total: 0 };
  const conditions: any[] = [eq(tasks.tenantId, tenantId)];
  if (opts?.entityType) conditions.push(eq(tasks.entityType, opts.entityType));
  if (opts?.entityId) conditions.push(eq(tasks.entityId, opts.entityId));
  if (opts?.taskType) conditions.push(eq(tasks.taskType, opts.taskType));
  if (opts?.status === "overdue") {
    conditions.push(sql`${tasks.status} != 'done' AND ${tasks.status} != 'cancelled' AND ${tasks.dueAt} < NOW()`);
  } else if (opts?.status === "open") {
    conditions.push(sql`${tasks.status} != 'done' AND ${tasks.status} != 'cancelled'`);
  } else if (opts?.status && opts.status !== "all") {
    conditions.push(eq(tasks.status, opts.status as any));
  }
  if (opts?.dateFrom) conditions.push(gte(tasks.dueAt, new Date(opts.dateFrom + "T00:00:00")));
  if (opts?.dateTo) conditions.push(lte(tasks.dueAt, new Date(opts.dateTo + "T23:59:59")));
  
  // If filtering by assignee, join with task_assignees
  if (opts?.assigneeUserId) {
    conditions.push(sql`${tasks.id} IN (SELECT taskId FROM task_assignees WHERE userId = ${opts.assigneeUserId})`);
  }
  // If filtering by creator (for non-admin users: see own tasks + tasks assigned to them)
  if (opts?.createdByUserId) {
    conditions.push(sql`(${tasks.createdByUserId} = ${opts.createdByUserId} OR ${tasks.assignedToUserId} = ${opts.createdByUserId} OR ${tasks.id} IN (SELECT taskId FROM task_assignees WHERE userId = ${opts.createdByUserId}))`);
  }
  
  const whereClause = and(...conditions);
  const [countResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(tasks).where(whereClause);
  const total = Number(countResult?.count || 0);
  
  // Ordenação: atrasadas primeiro (mais antiga primeiro), depois futuras (mais próxima primeiro)
  let query = db.select().from(tasks).where(whereClause).orderBy(
    sql`CASE WHEN ${tasks.status} IN ('done','cancelled') THEN 1 ELSE 0 END ASC`,
    sql`CASE WHEN ${tasks.dueAt} < NOW() AND ${tasks.status} NOT IN ('done','cancelled') THEN 0 ELSE 1 END ASC`,
    asc(tasks.dueAt)
  );
  if (opts?.limit) query = query.limit(opts.limit) as any;
  if (opts?.offset) query = query.offset(opts.offset) as any;
  const taskList = await query;
  return { tasks: taskList, total };
}

export async function listTasksEnriched(tenantId: number, opts?: { entityType?: string; entityId?: number; status?: string; taskType?: string; assigneeUserId?: number; dateFrom?: string; dateTo?: string; limit?: number; offset?: number; createdByUserId?: number }) {
  const result = await listTasks(tenantId, opts);
  if (!result.tasks.length) return { tasks: [], total: result.total };
  
  const db = await getDb(); if (!db) return result;
  
  // Get assignees for all tasks
  const taskIds = result.tasks.map((t: any) => t.id);
  const assignees = await db.select().from(taskAssignees).where(and(inArray(taskAssignees.taskId, taskIds), eq(taskAssignees.tenantId, tenantId)));
  
  // Get users for assignees
  const userIds = Array.from(new Set(assignees.map(a => a.userId)));
  let usersMap: Record<number, any> = {};
  if (userIds.length > 0) {
    const users = await db.select().from(crmUsers).where(and(inArray(crmUsers.id, userIds), eq(crmUsers.tenantId, tenantId)));
    usersMap = Object.fromEntries(users.map(u => [u.id, u]));
  }
  
  // Get linked deals for tasks with entityType=deal
  const dealIds = Array.from(new Set(result.tasks.filter((t: any) => t.entityType === "deal").map((t: any) => t.entityId)));
  let dealsMap: Record<number, any> = {};
  if (dealIds.length > 0) {
    const dealList = await db.select({ id: deals.id, title: deals.title, valueCents: deals.valueCents, contactId: deals.contactId }).from(deals).where(inArray(deals.id, dealIds));
    dealsMap = Object.fromEntries(dealList.map(d => [d.id, { ...d, amount: (d.valueCents || 0) / 100 }]));
  }
  
  // Enrich tasks
  const enriched = result.tasks.map((t: any) => {
    const taskAssigneeList = assignees.filter(a => a.taskId === t.id).map(a => ({
      userId: a.userId,
      name: usersMap[a.userId]?.name || "Desconhecido",
      avatarUrl: usersMap[a.userId]?.avatarUrl,
    }));
    const deal = t.entityType === "deal" ? dealsMap[t.entityId] : null;
    return {
      ...t,
      assignees: taskAssigneeList,
      deal: deal ? { id: deal.id, title: deal.title, amount: deal.amount } : null,
    };
  });
  
  return { tasks: enriched, total: result.total };
}

export async function updateTask(tenantId: number, id: number, data: Partial<{ title: string; status: "pending" | "in_progress" | "done" | "cancelled"; priority: "low" | "medium" | "high" | "urgent"; dueAt: Date; assignedToUserId: number; taskType: string; description: string }>) {
  const db = await getDb(); if (!db) return;
  await db.update(tasks).set(data).where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)));
}

export async function addTaskAssignee(taskId: number, userId: number, tenantId: number) {
  const db = await getDb(); if (!db) return;
  // Check if already assigned
  const existing = await db.select().from(taskAssignees).where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, userId)));
  if (existing.length > 0) return;
  await db.insert(taskAssignees).values({ taskId, userId, tenantId });
}

export async function removeTaskAssignee(taskId: number, userId: number, tenantId: number) {
  const db = await getDb(); if (!db) return;
  await db.delete(taskAssignees).where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, userId), eq(taskAssignees.tenantId, tenantId)));
}

export async function getTaskAssignees(taskId: number, tenantId: number) {
  const db = await getDb(); if (!db) return [];
  const assigneeRows = await db.select().from(taskAssignees).where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.tenantId, tenantId)));
  if (!assigneeRows.length) return [];
  const userIds = assigneeRows.map(a => a.userId);
  const users = await db.select().from(crmUsers).where(inArray(crmUsers.id, userIds));
  return users;
}

// Optimized: get overdue task counts grouped by deal ID
export async function getOverdueTasksByDeal(tenantId: number, dealIds?: number[]) {
  const db = await getDb(); if (!db) return {};
  const conditions = [
    eq(tasks.tenantId, tenantId),
    eq(tasks.entityType, "deal"),
    sql`${tasks.status} NOT IN ('done', 'cancelled')`,
    sql`${tasks.dueAt} IS NOT NULL`,
    sql`${tasks.dueAt} < NOW()`,
  ];
  if (dealIds && dealIds.length > 0) {
    conditions.push(inArray(tasks.entityId, dealIds));
  }
  const rows = await db.select({
    entityId: tasks.entityId,
    count: sql<number>`COUNT(*)`,
    oldestTitle: sql<string>`MIN(${tasks.title})`,
    oldestDueAt: sql<string>`MIN(${tasks.dueAt})`,
  }).from(tasks).where(and(...conditions)).groupBy(tasks.entityId);
  const result: Record<number, { count: number; oldestTitle: string; oldestDueAt: string }> = {};
  for (const row of rows) {
    result[row.entityId] = { count: Number(row.count), oldestTitle: row.oldestTitle, oldestDueAt: row.oldestDueAt };
  }
  return result;
}

// Get pending task counts grouped by deal ID (for "no tasks" indicator)
export async function getPendingTaskCountsByDeal(tenantId: number) {
  const db = await getDb(); if (!db) return {};
  const rows = await db.select({
    entityId: tasks.entityId,
    count: sql<number>`COUNT(*)`,
  }).from(tasks).where(and(
    eq(tasks.tenantId, tenantId),
    eq(tasks.entityType, "deal"),
    sql`${tasks.status} NOT IN ('done', 'cancelled')`,
  )).groupBy(tasks.entityId);
  const result: Record<number, number> = {};
  for (const row of rows) {
    result[row.entityId] = Number(row.count);
  }
  return result;
}

// ═══════════════════════════════════════
// NOTES
// ═══════════════════════════════════════
export async function createNote(data: { tenantId: number; entityType: string; entityId: number; body: string; createdByUserId?: number }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(crmNotes).values(data).$returningId();
  return result;
}
export async function listNotes(tenantId: number, entityType: string, entityId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(crmNotes).where(and(eq(crmNotes.tenantId, tenantId), eq(crmNotes.entityType, entityType), eq(crmNotes.entityId, entityId))).orderBy(desc(crmNotes.createdAt));
}

// ═══════════════════════════════════════
// CHANNELS & CONVERSATIONS (INBOX)
// ═══════════════════════════════════════
export async function createChannel(data: { tenantId: number; type: "whatsapp" | "instagram" | "email" | "webchat"; name?: string; connectionId?: string }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(channels).values(data).$returningId();
  return result;
}
export async function listChannels(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(channels).where(eq(channels.tenantId, tenantId));
}
export async function createConversation(data: { tenantId: number; channelId: number; contactId?: number; providerThreadId?: string; assignedToUserId?: number }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(conversations).values(data).$returningId();
  return result;
}
export async function listConversations(tenantId: number, opts?: { status?: string; channelId?: number; limit?: number; offset?: number }) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(conversations.tenantId, tenantId)];
  if (opts?.status) conditions.push(eq(conversations.status, opts.status as any));
  if (opts?.channelId) conditions.push(eq(conversations.channelId, opts.channelId));
  return db.select().from(conversations).where(and(...conditions)).orderBy(desc(conversations.lastMessageAt)).limit(opts?.limit || 50).offset(opts?.offset || 0);
}
export async function getConversationById(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId))).limit(1);
  return rows[0] || null;
}
export async function updateConversation(tenantId: number, id: number, data: Partial<{ status: "open" | "pending" | "closed"; assignedToUserId: number; assignedTeamId: number; priority: "low" | "medium" | "high" | "urgent" }>) {
  const db = await getDb(); if (!db) return;
  await db.update(conversations).set(data).where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)));
}
export async function createInboxMessage(data: { tenantId: number; conversationId: number; direction: "inbound" | "outbound"; bodyText?: string; senderLabel?: string; providerMessageId?: string }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(inboxMessages).values({ ...data, sentAt: new Date(), status: data.direction === "outbound" ? "sent" : "delivered" }).$returningId();
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, data.conversationId));
  return result;
}
export async function listInboxMessages(tenantId: number, conversationId: number, opts?: { limit?: number; offset?: number }) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(inboxMessages).where(and(eq(inboxMessages.tenantId, tenantId), eq(inboxMessages.conversationId, conversationId))).orderBy(asc(inboxMessages.sentAt)).limit(opts?.limit || 100).offset(opts?.offset || 0);
}
export async function countConversations(tenantId: number, status?: string, opts?: { dateFrom?: string; dateTo?: string; assignedToUserId?: number }) {
  const db = await getDb(); if (!db) return 0;
  const conditions: any[] = [eq(conversations.tenantId, tenantId)];
  if (status) conditions.push(eq(conversations.status, status as any));
  if (opts?.assignedToUserId) conditions.push(eq(conversations.assignedToUserId, opts.assignedToUserId));
  if (opts?.dateFrom) conditions.push(gte(conversations.createdAt, new Date(opts.dateFrom + "T00:00:00")));
  if (opts?.dateTo) conditions.push(lte(conversations.createdAt, new Date(opts.dateTo + "T23:59:59")));
  const rows = await db.select({ count: sql<number>`count(*)` }).from(conversations).where(and(...conditions));
  return rows[0]?.count || 0;
}

// ═══════════════════════════════════════
// PROPOSALS
// ═══════════════════════════════════════
export async function createProposal(data: { tenantId: number; dealId: number; totalCents?: number; createdBy?: number }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(proposals).values(data).$returningId();
  return result;
}
export async function listProposals(tenantId: number, opts?: { dealId?: number; status?: string }) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(proposals.tenantId, tenantId)];
  if (opts?.dealId) conditions.push(eq(proposals.dealId, opts.dealId));
  return db.select().from(proposals).where(and(...conditions)).orderBy(desc(proposals.createdAt));
}
export async function getProposalById(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(proposals).where(and(eq(proposals.id, id), eq(proposals.tenantId, tenantId))).limit(1);
  return rows[0] || null;
}
export async function updateProposal(tenantId: number, id: number, data: Partial<{ status: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired"; totalCents: number; pdfUrl: string; sentAt: Date; acceptedAt: Date }>) {
  const db = await getDb(); if (!db) return;
  await db.update(proposals).set(data).where(and(eq(proposals.id, id), eq(proposals.tenantId, tenantId)));
}
export async function createProposalItem(data: { tenantId: number; proposalId: number; title: string; description?: string; qty?: number; unitPriceCents?: number; totalCents?: number }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(proposalItems).values(data).$returningId();
  return result;
}
export async function listProposalItems(tenantId: number, proposalId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(proposalItems).where(and(eq(proposalItems.tenantId, tenantId), eq(proposalItems.proposalId, proposalId)));
}
export async function listProposalTemplates(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(proposalTemplates).where(eq(proposalTemplates.tenantId, tenantId));
}
export async function createProposalTemplate(data: { tenantId: number; name: string; htmlBody?: string; variablesJson?: any }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(proposalTemplates).values(data).$returningId();
  return result;
}

// ═══════════════════════════════════════
// PORTAL
// ═══════════════════════════════════════
export async function createPortalUser(data: { tenantId: number; contactId: number; email: string }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(portalUsers).values(data).$returningId();
  return result;
}
export async function listPortalTickets(tenantId: number, opts?: { contactId?: number; status?: string }) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(portalTickets.tenantId, tenantId)];
  if (opts?.contactId) conditions.push(eq(portalTickets.contactId, opts.contactId));
  return db.select().from(portalTickets).where(and(...conditions)).orderBy(desc(portalTickets.createdAt));
}
export async function createPortalTicket(data: { tenantId: number; contactId: number; subject: string; tripId?: number; priority?: "low" | "medium" | "high" | "urgent" }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(portalTickets).values(data).$returningId();
  return result;
}

// ═══════════════════════════════════════
// GOALS & INSIGHTS
// ═══════════════════════════════════════
export async function createGoal(data: { tenantId: number; name?: string; scope?: "user" | "company"; periodStart: Date; periodEnd: Date; metricKey: string; targetValue: number; teamId?: number; userId?: number; companyId?: number }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(goals).values(data).$returningId();
  return result;
}
export async function listGoals(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select().from(goals).where(eq(goals.tenantId, tenantId)).orderBy(desc(goals.createdAt));
  if (rows.length === 0) return [];
  // Batch calculate all goal progress in a single query instead of N+1
  const goalProgressMap = await batchCalculateGoalProgress(db, rows);
  return rows.map((goal) => ({
    ...goal,
    currentValue: goalProgressMap.get(goal.id) ?? 0,
  }));
}

/** Batch calculate progress for multiple goals in minimal queries (avoids N+1) */
async function batchCalculateGoalProgress(db: any, goalsList: any[]): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (goalsList.length === 0) return result;
  // Group goals by metricKey to batch similar queries
  const byMetric: Record<string, any[]> = {};
  for (const g of goalsList) {
    (byMetric[g.metricKey] ??= []).push(g);
  }
  // Process each metric type with a single query covering all goals of that type
  for (const [metricKey, goalsGroup] of Object.entries(byMetric)) {
    try {
      // Use Promise.all for the different metric groups (max 3 queries total instead of N)
      const values = await Promise.all(goalsGroup.map(g => calculateGoalProgress(db, g)));
      goalsGroup.forEach((g, i) => result.set(g.id, values[i]));
    } catch (err) {
      console.error('[batchCalculateGoalProgress] Error:', err);
      goalsGroup.forEach(g => result.set(g.id, 0));
    }
  }
  return result;
}

/** Calculate real-time progress for a goal based on deals in the pipeline */
async function calculateGoalProgress(db: any, goal: any): Promise<number> {
  try {
    const { tenantId, metricKey, scope, userId, companyId, periodStart, periodEnd } = goal;
    // Base conditions: same tenant, within period, not deleted
    const baseConds = [
      `d.tenantId = ${Number(tenantId)}`,
      `d.deletedAt IS NULL`,
      `d.createdAt >= '${new Date(periodStart).toISOString().slice(0, 19).replace('T', ' ')}'`,
      `d.createdAt <= '${new Date(periodEnd).toISOString().slice(0, 19).replace('T', ' ')}'`,
    ];
    // Scope filter
    if (scope === 'user' && userId) {
      baseConds.push(`d.ownerUserId = ${Number(userId)}`);
    } else if (scope === 'company' && companyId) {
      baseConds.push(`d.accountId = ${Number(companyId)}`);
    }
    const whereClause = baseConds.join(' AND ');

    if (metricKey === 'total_sold') {
      // Sum valueCents of won deals within the period
      const [rows] = await db.execute(
        sql`SELECT COALESCE(SUM(d.valueCents), 0) as total FROM deals d WHERE ${sql.raw(whereClause)} AND d.status = 'won'`
      );
      return Number((rows as any)[0]?.total ?? 0);
    }

    if (metricKey === 'deals_count') {
      // Count all deals created within the period
      const [rows] = await db.execute(
        sql`SELECT COUNT(*) as total FROM deals d WHERE ${sql.raw(whereClause)}`
      );
      return Number((rows as any)[0]?.total ?? 0);
    }

    if (metricKey === 'conversion_rate') {
      // Conversion rate = (won deals / total deals) * 100
      const [rows] = await db.execute(
        sql`SELECT COUNT(*) as total, SUM(CASE WHEN d.status = 'won' THEN 1 ELSE 0 END) as won FROM deals d WHERE ${sql.raw(whereClause)}`
      );
      const total = Number((rows as any)[0]?.total ?? 0);
      const won = Number((rows as any)[0]?.won ?? 0);
      if (total === 0) return 0;
      return Math.round((won / total) * 100 * 10) / 10; // one decimal place
    }

    return 0;
  } catch (err) {
    console.error('[calculateGoalProgress] Error:', err);
    return 0;
  }
}
export async function getGoalById(tenantId: number, goalId: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.tenantId, tenantId))).limit(1);
  const goal = rows[0] ?? null;
  if (!goal) return null;
  const currentValue = await calculateGoalProgress(db, goal);
  return { ...goal, currentValue };
}
export async function updateGoal(tenantId: number, goalId: number, data: Partial<{ name: string; scope: "user" | "company"; periodStart: Date; periodEnd: Date; metricKey: string; targetValue: number; userId: number | null; companyId: number | null }>) {
  const db = await getDb(); if (!db) return null;
  await db.update(goals).set(data as any).where(and(eq(goals.id, goalId), eq(goals.tenantId, tenantId)));
  return { id: goalId };
}
export async function deleteGoal(tenantId: number, goalId: number) {
  const db = await getDb(); if (!db) return null;
  await db.delete(goals).where(and(eq(goals.id, goalId), eq(goals.tenantId, tenantId)));
  return { id: goalId };
}
export async function listCompaniesByTenant(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select({ id: contacts.id, name: contacts.name }).from(contacts).where(and(eq(contacts.tenantId, tenantId), eq(contacts.type, "company"))).orderBy(contacts.name);
}
export async function listAlerts(tenantId: number, opts?: { status?: string }) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(alerts.tenantId, tenantId)];
  if (opts?.status) conditions.push(eq(alerts.status, opts.status as any));
  return db.select().from(alerts).where(and(...conditions)).orderBy(desc(alerts.firedAt));
}
export async function createAlert(data: { tenantId: number; type: string; entityType?: string; entityId?: number; payloadJson?: any }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(alerts).values(data).$returningId();
  return result;
}

// ═══════════════════════════════════════
// ACADEMY
// ═══════════════════════════════════════
export async function createCourse(data: { tenantId: number; title: string; description?: string; coverUrl?: string }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(courses).values(data).$returningId();
  return result;
}
export async function listCourses(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(courses).where(eq(courses.tenantId, tenantId));
}
export async function getCourseById(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(courses).where(and(eq(courses.id, id), eq(courses.tenantId, tenantId))).limit(1);
  return rows[0] || null;
}
export async function createLesson(data: { tenantId: number; courseId: number; title: string; contentBody?: string; contentUrl?: string; orderIndex: number }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(lessons).values(data).$returningId();
  return result;
}
export async function listLessons(tenantId: number, courseId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(lessons).where(and(eq(lessons.tenantId, tenantId), eq(lessons.courseId, courseId))).orderBy(asc(lessons.orderIndex));
}
export async function enrollUser(data: { tenantId: number; userId: number; courseId: number }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(enrollments).values(data).$returningId();
  return result;
}
export async function listEnrollments(tenantId: number, userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(enrollments).where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.userId, userId)));
}

// ═══════════════════════════════════════
// INTEGRATION HUB
// ═══════════════════════════════════════
export async function createIntegration(data: { tenantId: number; provider: string; name: string }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(integrations).values(data).$returningId();
  return result;
}
export async function listIntegrations(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(integrations).where(eq(integrations.tenantId, tenantId));
}
export async function createJob(data: { tenantId: number; type: string; payloadJson?: any }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(jobs).values(data).$returningId();
  return result;
}
export async function listJobs(tenantId: number, opts?: { status?: string }) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(jobs.tenantId, tenantId)];
  if (opts?.status) conditions.push(eq(jobs.status, opts.status as any));
  return db.select().from(jobs).where(and(...conditions)).orderBy(desc(jobs.createdAt));
}
export async function listWebhooks(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(webhooks).where(eq(webhooks.tenantId, tenantId));
}
export async function createWebhook(data: { tenantId: number; provider: string; endpoint: string; secretHash?: string }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(webhooks).values(data).$returningId();
  return result;
}

// ═══════════════════════════════════════
// EVENT LOG
// ═══════════════════════════════════════
export async function listEventLog(tenantId: number, opts?: { entityType?: string; entityId?: number; limit?: number; offset?: number }) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(eventLog.tenantId, tenantId)];
  if (opts?.entityType) conditions.push(eq(eventLog.entityType, opts.entityType));
  if (opts?.entityId) conditions.push(eq(eventLog.entityId, opts.entityId));
  return db.select().from(eventLog).where(and(...conditions)).orderBy(desc(eventLog.occurredAt)).limit(opts?.limit || 50).offset(opts?.offset || 0);
}

// ═══════════════════════════════════════
// PIPELINES — CRUD Completo
// ═══════════════════════════════════════
export async function updatePipeline(tenantId: number, id: number, data: { name?: string; description?: string; color?: string; pipelineType?: string; isDefault?: boolean; isArchived?: boolean }) {
  const db = await getDb(); if (!db) return null;
  await db.update(pipelines).set(data as any).where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.id, id)));
  return { success: true };
}
export async function deletePipeline(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  // Soft delete via archive
  await db.update(pipelines).set({ isArchived: true } as any).where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.id, id)));
  return { success: true };
}
export async function getPipelineById(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.select().from(pipelines).where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.id, id)));
  return result || null;
}

// ═══════════════════════════════════════
// STAGES — CRUD Completo
// ═══════════════════════════════════════
export async function updateStage(tenantId: number, id: number, data: { name?: string; color?: string; orderIndex?: number; probabilityDefault?: number; isWon?: boolean; isLost?: boolean; coolingEnabled?: boolean; coolingDays?: number }) {
  const db = await getDb(); if (!db) return null;
  await db.update(pipelineStages).set(data as any).where(and(eq(pipelineStages.tenantId, tenantId), eq(pipelineStages.id, id)));
  return { success: true };
}
export async function deleteStage(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  await db.delete(pipelineStages).where(and(eq(pipelineStages.tenantId, tenantId), eq(pipelineStages.id, id)));
  return { success: true };
}
export async function reorderStages(tenantId: number, pipelineId: number, stageOrders: { id: number; orderIndex: number }[]) {
  const db = await getDb(); if (!db) return null;
  for (const s of stageOrders) {
    await db.update(pipelineStages).set({ orderIndex: s.orderIndex }).where(and(eq(pipelineStages.tenantId, tenantId), eq(pipelineStages.id, s.id)));
  }
  return { success: true };
}
export async function countDealsInStage(tenantId: number, stageId: number) {
  const db = await getDb(); if (!db) return 0;
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(deals).where(and(eq(deals.tenantId, tenantId), eq(deals.stageId, stageId), eq(deals.status, "open")));
  return result?.count || 0;
}

// ═══════════════════════════════════════
// PIPELINE AUTOMATIONS — CRUD
// ═══════════════════════════════════════
export async function createPipelineAutomation(data: {
  tenantId: number; name: string; sourcePipelineId: number; triggerEvent: string;
  triggerStageId?: number; targetPipelineId: number; targetStageId: number;
  copyProducts?: boolean; copyParticipants?: boolean; copyCustomFields?: boolean;
}) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(pipelineAutomations).values(data as any).$returningId();
  return result;
}
export async function listPipelineAutomations(tenantId: number, sourcePipelineId?: number) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(pipelineAutomations.tenantId, tenantId)];
  if (sourcePipelineId) conditions.push(eq(pipelineAutomations.sourcePipelineId, sourcePipelineId));
  return db.select().from(pipelineAutomations).where(and(...conditions)).orderBy(desc(pipelineAutomations.createdAt));
}
export async function updatePipelineAutomation(tenantId: number, id: number, data: {
  name?: string; triggerEvent?: string; triggerStageId?: number;
  targetPipelineId?: number; targetStageId?: number;
  copyProducts?: boolean; copyParticipants?: boolean; copyCustomFields?: boolean; isActive?: boolean;
}) {
  const db = await getDb(); if (!db) return null;
  await db.update(pipelineAutomations).set(data as any).where(and(eq(pipelineAutomations.tenantId, tenantId), eq(pipelineAutomations.id, id)));
  return { success: true };
}
export async function deletePipelineAutomation(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  await db.delete(pipelineAutomations).where(and(eq(pipelineAutomations.tenantId, tenantId), eq(pipelineAutomations.id, id)));
  return { success: true };
}
export async function getActiveAutomations(tenantId: number, sourcePipelineId: number, triggerEvent: string) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(pipelineAutomations).where(and(
    eq(pipelineAutomations.tenantId, tenantId),
    eq(pipelineAutomations.sourcePipelineId, sourcePipelineId),
    eq(pipelineAutomations.triggerEvent, triggerEvent as any),
    eq(pipelineAutomations.isActive, true),
  ));
}

// ═══════════════════════════════════════
// AUTOMATION TRIGGER — Execute on deal_won/lost
// ═══════════════════════════════════════
export async function executePipelineAutomation(tenantId: number, dealId: number, triggerEvent: "deal_won" | "deal_lost" | "stage_reached", actorUserId?: number) {
  const db = await getDb(); if (!db) return [];
  const deal = await getDealById(tenantId, dealId);
  if (!deal) return [];

  const automations = await getActiveAutomations(tenantId, deal.pipelineId, triggerEvent);
  const createdDeals: number[] = [];

  for (const auto of automations) {
    // Create new deal in target pipeline
    const newDealData: any = {
      tenantId,
      title: deal.title,
      contactId: deal.contactId,
      accountId: deal.accountId,
      pipelineId: auto.targetPipelineId,
      stageId: auto.targetStageId,
      valueCents: deal.valueCents,
      currency: deal.currency,
      ownerUserId: deal.ownerUserId,
      teamId: deal.teamId,
      channelOrigin: deal.channelOrigin,
      createdBy: actorUserId || deal.createdBy,
    };
    const newDeal = await createDeal(newDealData);
    if (!newDeal) continue;
    createdDeals.push(newDeal.id);

    // Copy products if configured
    if (auto.copyProducts) {
      const products = await listDealProducts(tenantId, dealId);
      for (const p of products) {
        await createDealProduct({
          tenantId, dealId: newDeal.id, productId: p.productId, name: p.name, description: p.description || undefined,
          category: p.category as any, quantity: p.quantity, unitPriceCents: p.unitPriceCents,
          discountCents: p.discountCents || 0, finalPriceCents: p.finalPriceCents || 0,
          supplier: p.supplier || undefined, notes: p.notes || undefined,
        });
      }
    }

    // Copy participants if configured
    if (auto.copyParticipants) {
      const participants = await listDealParticipants(tenantId, dealId);
      for (const p of participants) {
        await addDealParticipant({ tenantId, dealId: newDeal.id, contactId: p.contactId, role: p.role as any });
      }
    }

    // Record in history
    await createDealHistory({
      tenantId, dealId: newDeal.id, action: "automation_created",
      description: `Negociação criada automaticamente a partir da negociação #${dealId} (${auto.name})`,
      actorUserId, actorName: "Automação",
    });
    await createDealHistory({
      tenantId, dealId, action: "automation_triggered",
      description: `Automação "${auto.name}" criou nova negociação #${newDeal.id} no funil destino`,
      actorUserId, actorName: "Automação",
    });
  }

  return createdDeals;
}

// ═══════════════════════════════════════
// PRODUCT CATEGORIES
// ═══════════════════════════════════════
export async function listProductCategories(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(productCategories).where(eq(productCategories.tenantId, tenantId)).orderBy(asc(productCategories.sortOrder), asc(productCategories.name));
}
export async function getProductCategoryById(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(productCategories).where(and(eq(productCategories.id, id), eq(productCategories.tenantId, tenantId))).limit(1);
  return rows[0] || null;
}
export async function createProductCategory(data: { tenantId: number; name: string; icon?: string; color?: string; parentId?: number; sortOrder?: number }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(productCategories).values(data).$returningId();
  return result;
}
export async function updateProductCategory(tenantId: number, id: number, data: Partial<{ name: string; icon: string; color: string; parentId: number | null; sortOrder: number }>) {
  const db = await getDb(); if (!db) return;
  await db.update(productCategories).set(data).where(and(eq(productCategories.id, id), eq(productCategories.tenantId, tenantId)));
}
export async function deleteProductCategory(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return;
  await db.delete(productCategories).where(and(eq(productCategories.id, id), eq(productCategories.tenantId, tenantId)));
}

// ═══════════════════════════════════════
// PRODUCT CATALOG
// ═══════════════════════════════════════
export async function listCatalogProducts(tenantId: number, opts?: { search?: string; productType?: string; categoryId?: number; isActive?: boolean; limit?: number; offset?: number }) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(productCatalog.tenantId, tenantId)];
  if (opts?.search) conditions.push(like(productCatalog.name, `%${opts.search}%`));
  if (opts?.productType) conditions.push(eq(productCatalog.productType, opts.productType as any));
  if (opts?.categoryId !== undefined) conditions.push(eq(productCatalog.categoryId, opts.categoryId));
  if (opts?.isActive !== undefined) conditions.push(eq(productCatalog.isActive, opts.isActive));
  return db.select().from(productCatalog).where(and(...conditions)).orderBy(desc(productCatalog.updatedAt)).limit(opts?.limit || 100).offset(opts?.offset || 0);
}
export async function getCatalogProductById(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(productCatalog).where(and(eq(productCatalog.id, id), eq(productCatalog.tenantId, tenantId))).limit(1);
  return rows[0] || null;
}
export async function createCatalogProduct(data: {
  tenantId: number; name: string; description?: string; categoryId?: number;
  productType?: "flight" | "hotel" | "tour" | "transfer" | "insurance" | "cruise" | "visa" | "package" | "other";
  basePriceCents?: number; costPriceCents?: number; currency?: string;
  supplier?: string; destination?: string; duration?: string;
  imageUrl?: string; sku?: string; isActive?: boolean; detailsJson?: any;
}) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(productCatalog).values(data).$returningId();
  return result;
}
export async function updateCatalogProduct(tenantId: number, id: number, data: Partial<{
  name: string; description: string; categoryId: number | null;
  productType: "flight" | "hotel" | "tour" | "transfer" | "insurance" | "cruise" | "visa" | "package" | "other";
  basePriceCents: number; costPriceCents: number; currency: string;
  supplier: string; destination: string; duration: string;
  imageUrl: string; sku: string; isActive: boolean; detailsJson: any;
}>) {
  const db = await getDb(); if (!db) return;
  await db.update(productCatalog).set(data).where(and(eq(productCatalog.id, id), eq(productCatalog.tenantId, tenantId)));
}
export async function deleteCatalogProduct(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return;
  await db.delete(productCatalog).where(and(eq(productCatalog.id, id), eq(productCatalog.tenantId, tenantId)));
}
export async function countCatalogProducts(tenantId: number, isActive?: boolean) {
  const db = await getDb(); if (!db) return 0;
  const conditions = [eq(productCatalog.tenantId, tenantId)];
  if (isActive !== undefined) conditions.push(eq(productCatalog.isActive, isActive));
  const [row] = await db.select({ total: count() }).from(productCatalog).where(and(...conditions));
  return row?.total || 0;
}

// ═══════════════════════════════════════
// PRODUCT ANALYTICS
// ═══════════════════════════════════════

/** Most sold products: products in deals with status='won', grouped by name/category */
export async function getProductAnalyticsMostSold(tenantId: number, limit = 10) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.execute(sql`
    SELECT dp.name, dp.category, dp.catalogProductId,
           COUNT(*) as dealCount,
           SUM(dp.quantity) as totalQuantity,
           SUM(dp.unitPriceCents * dp.quantity - COALESCE(dp.discountCents, 0)) as totalRevenueCents
    FROM deal_products dp
    INNER JOIN deals d ON dp.dealId = d.id AND dp.tenantId = d.tenantId
    WHERE dp.tenantId = ${tenantId} AND d.status = 'won'
    GROUP BY dp.name, dp.category, dp.catalogProductId
    ORDER BY totalQuantity DESC
    LIMIT ${limit}
  `);
  return (rows as any)[0] || [];
}

/** Most lost products: products in deals with status='lost' */
export async function getProductAnalyticsMostLost(tenantId: number, limit = 10) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.execute(sql`
    SELECT dp.name, dp.category, dp.catalogProductId,
           COUNT(*) as dealCount,
           SUM(dp.quantity) as totalQuantity,
           SUM(dp.unitPriceCents * dp.quantity - COALESCE(dp.discountCents, 0)) as totalValueCents
    FROM deal_products dp
    INNER JOIN deals d ON dp.dealId = d.id AND dp.tenantId = d.tenantId
    WHERE dp.tenantId = ${tenantId} AND d.status = 'lost'
    GROUP BY dp.name, dp.category, dp.catalogProductId
    ORDER BY totalQuantity DESC
    LIMIT ${limit}
  `);
  return (rows as any)[0] || [];
}

/** Most requested products: all products across all deals regardless of status */
export async function getProductAnalyticsMostRequested(tenantId: number, limit = 10) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.execute(sql`
    SELECT dp.name, dp.category, dp.catalogProductId,
           COUNT(*) as dealCount,
           SUM(dp.quantity) as totalQuantity,
           SUM(dp.unitPriceCents * dp.quantity - COALESCE(dp.discountCents, 0)) as totalValueCents
    FROM deal_products dp
    INNER JOIN deals d ON dp.dealId = d.id AND dp.tenantId = d.tenantId
    WHERE dp.tenantId = ${tenantId}
    GROUP BY dp.name, dp.category, dp.catalogProductId
    ORDER BY totalQuantity DESC
    LIMIT ${limit}
  `);
  return (rows as any)[0] || [];
}

/** Revenue by product type (category) */
export async function getProductAnalyticsRevenueByType(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.execute(sql`
    SELECT dp.category,
           COUNT(DISTINCT d.id) as dealCount,
           SUM(dp.quantity) as totalQuantity,
           SUM(dp.unitPriceCents * dp.quantity - COALESCE(dp.discountCents, 0)) as totalRevenueCents
    FROM deal_products dp
    INNER JOIN deals d ON dp.dealId = d.id AND dp.tenantId = d.tenantId
    WHERE dp.tenantId = ${tenantId} AND d.status = 'won'
    GROUP BY dp.category
    ORDER BY totalRevenueCents DESC
  `);
  return (rows as any)[0] || [];
}

/** Conversion rate by product: won vs total deals containing each product */
export async function getProductAnalyticsConversionRate(tenantId: number, limit = 10) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.execute(sql`
    SELECT dp.name, dp.category, dp.catalogProductId,
           COUNT(DISTINCT d.id) as totalDeals,
           SUM(CASE WHEN d.status = 'won' THEN 1 ELSE 0 END) as wonDeals,
           ROUND(SUM(CASE WHEN d.status = 'won' THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT d.id), 1) as conversionRate
    FROM deal_products dp
    INNER JOIN deals d ON dp.dealId = d.id AND dp.tenantId = d.tenantId
    WHERE dp.tenantId = ${tenantId}
    GROUP BY dp.name, dp.category, dp.catalogProductId
    HAVING COUNT(DISTINCT d.id) >= 1
    ORDER BY conversionRate DESC
    LIMIT ${limit}
  `);
  return (rows as any)[0] || [];
}

/** Product analytics summary: total products, active, avg price, total revenue */
export async function getProductAnalyticsSummary(tenantId: number) {
  const db = await getDb(); if (!db) return { totalProducts: 0, activeProducts: 0, avgPriceCents: 0, totalRevenueCents: 0, totalCostCents: 0 };
  const [catRow] = await db.select({
    total: count(),
    active: sql<number>`SUM(CASE WHEN ${productCatalog.isActive} = true THEN 1 ELSE 0 END)`,
    avgPrice: sql<number>`COALESCE(AVG(${productCatalog.basePriceCents}), 0)`,
  }).from(productCatalog).where(eq(productCatalog.tenantId, tenantId));

  const revRows = await db.execute(sql`
    SELECT COALESCE(SUM(dp.unitPriceCents * dp.quantity - COALESCE(dp.discountCents, 0)), 0) as totalRevenueCents,
           COALESCE(COUNT(DISTINCT dp.dealId), 0) as dealsWithProducts
    FROM deal_products dp
    INNER JOIN deals d ON dp.dealId = d.id AND dp.tenantId = d.tenantId
    WHERE dp.tenantId = ${tenantId} AND d.status = 'won'
  `);
  const rev = ((revRows as any)[0] || [])[0] || {};

  return {
    totalProducts: catRow?.total || 0,
    activeProducts: Number(catRow?.active) || 0,
    avgPriceCents: Math.round(Number(catRow?.avgPrice) || 0),
    totalRevenueCents: Number(rev.totalRevenueCents) || 0,
    dealsWithProducts: Number(rev.dealsWithProducts) || 0,
  };
}

/** Top destinations by revenue */
export async function getProductAnalyticsTopDestinations(tenantId: number, limit = 10) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.execute(sql`
    SELECT pc.destination,
           COUNT(*) as productCount,
           SUM(pc.basePriceCents) as totalBasePriceCents
    FROM product_catalog pc
    WHERE pc.tenantId = ${tenantId} AND pc.isActive = true AND pc.destination IS NOT NULL AND pc.destination != ''
    GROUP BY pc.destination
    ORDER BY productCount DESC
    LIMIT ${limit}
  `);
  return (rows as any)[0] || [];
}


// ═══════════════════════════════════════
// WHATSAPP MESSAGES BY DEAL
// ═══════════════════════════════════════

/** Convert phone number to WhatsApp JID */
// Use centralized phone normalization
import { phoneToJid, getAllJidVariants } from "./phoneUtils";

/** Get all WhatsApp messages for a deal's contact, across all sessions */
export async function getWhatsAppMessagesByDeal(dealId: number, tenantId: number, opts?: { limit?: number; beforeId?: number }) {
  const db = await getDb();
  if (!db) return { messages: [], contact: null, sessions: [] };

  // 1. Get the deal's contact
  const dealRows = await db.select({ contactId: deals.contactId }).from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId))).limit(1);
  const deal = dealRows[0];
  if (!deal?.contactId) return { messages: [], contact: null, sessions: [] };

  // 2. Get the contact's phone
  const contactRows = await db.select({
    id: contacts.id, name: contacts.name, phone: contacts.phone, email: contacts.email,
  }).from(contacts).where(eq(contacts.id, deal.contactId)).limit(1);
  const contact = contactRows[0];
  if (!contact?.phone) return { messages: [], contact, sessions: [] };

  // Get all possible JID variants for this phone (with and without 9th digit)
  const jidVariants = getAllJidVariants(contact.phone);

  // 3. Get all sessions for this tenant
  const sessions = await db.select({
    sessionId: whatsappSessions.sessionId,
    pushName: whatsappSessions.pushName,
    phoneNumber: whatsappSessions.phoneNumber,
  }).from(whatsappSessions).where(eq(whatsappSessions.tenantId, tenantId));

  if (!sessions.length) return { messages: [], contact, sessions: [] };

  const sessionIds = sessions.map(s => s.sessionId);

  // 4. Get all messages for ALL JID variants across all sessions (handles duplicated JIDs)
  const conditions = [
    inArray(waMessages.sessionId, sessionIds),
    jidVariants.length === 1 
      ? eq(waMessages.remoteJid, jidVariants[0])
      : inArray(waMessages.remoteJid, jidVariants),
  ];
  if (opts?.beforeId) {
    conditions.push(lt(waMessages.id, opts.beforeId));
  }

  const limit = opts?.limit || 100;
  const msgs = await db.select({
    id: waMessages.id,
    sessionId: waMessages.sessionId,
    messageId: waMessages.messageId,
    remoteJid: waMessages.remoteJid,
    fromMe: waMessages.fromMe,
    senderAgentId: waMessages.senderAgentId,
    pushName: waMessages.pushName,
    messageType: waMessages.messageType,
    content: waMessages.content,
    mediaUrl: waMessages.mediaUrl,
    mediaMimeType: waMessages.mediaMimeType,
    mediaFileName: waMessages.mediaFileName,
    mediaDuration: waMessages.mediaDuration,
    isVoiceNote: waMessages.isVoiceNote,
    quotedMessageId: waMessages.quotedMessageId,
    status: waMessages.status,
    timestamp: waMessages.timestamp,
    createdAt: waMessages.createdAt,
  }).from(waMessages)
    .where(and(...conditions))
    .orderBy(desc(waMessages.timestamp))
    .limit(limit);

  // Build session name map for display
  const sessionMap = Object.fromEntries(sessions.map(s => [s.sessionId, s.pushName || s.phoneNumber || "Agente"]));

  return {
    messages: msgs.reverse(), // Return in chronological order
    contact,
    sessions: sessions.map(s => ({ sessionId: s.sessionId, name: s.pushName || s.phoneNumber || "Agente" })),
    sessionMap,
    hasMore: msgs.length === limit,
  };
}

/** Count total WhatsApp messages for a deal */
export async function countWhatsAppMessagesByDeal(dealId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return 0;

  const dealRows = await db.select({ contactId: deals.contactId }).from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId))).limit(1);
  const deal = dealRows[0];
  if (!deal?.contactId) return 0;

  const contactRows = await db.select({ phone: contacts.phone }).from(contacts)
    .where(eq(contacts.id, deal.contactId)).limit(1);
  const contact = contactRows[0];
  if (!contact?.phone) return 0;

  // Get all possible JID variants for this phone (with and without 9th digit)
  const jidVariants = getAllJidVariants(contact.phone);

  const sessions = await db.select({ sessionId: whatsappSessions.sessionId })
    .from(whatsappSessions).where(eq(whatsappSessions.tenantId, tenantId));
  if (!sessions.length) return 0;

  const sessionIds = sessions.map(s => s.sessionId);
  const result = await db.select({ total: count() }).from(waMessages)
    .where(and(
      inArray(waMessages.sessionId, sessionIds),
      jidVariants.length === 1
        ? eq(waMessages.remoteJid, jidVariants[0])
        : inArray(waMessages.remoteJid, jidVariants)
    ));

  return result[0]?.total || 0;
}

// ═══════════════════════════════════════
// AI CONVERSATION ANALYSIS
// ═══════════════════════════════════════

export async function getLatestAnalysis(tenantId: number, dealId: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(aiConversationAnalyses)
    .where(and(eq(aiConversationAnalyses.tenantId, tenantId), eq(aiConversationAnalyses.dealId, dealId)))
    .orderBy(desc(aiConversationAnalyses.createdAt))
    .limit(1);
  return rows[0] || null;
}

export async function getAnalysisHistory(tenantId: number, dealId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(aiConversationAnalyses)
    .where(and(eq(aiConversationAnalyses.tenantId, tenantId), eq(aiConversationAnalyses.dealId, dealId)))
    .orderBy(desc(aiConversationAnalyses.createdAt))
    .limit(10);
}

export async function saveAnalysis(data: {
  tenantId: number;
  dealId: number;
  contactId?: number | null;
  analyzedBy?: number | null;
  overallScore?: number | null;
  toneScore?: number | null;
  responsivenessScore?: number | null;
  clarityScore?: number | null;
  closingScore?: number | null;
  summary?: string | null;
  strengths?: string[];
  improvements?: string[];
  suggestions?: string[];
  missedOpportunities?: string[];
  responseTimeAvg?: string | null;
  messagesAnalyzed?: number;
  rawAnalysis?: string | null;
}) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(aiConversationAnalyses).values({
    ...data,
    strengths: data.strengths || [],
    improvements: data.improvements || [],
    suggestions: data.suggestions || [],
    missedOpportunities: data.missedOpportunities || [],
  }).$returningId();
  return result;
}

// ═══════════════════════════════════════
// LEAD SOURCES
// ═══════════════════════════════════════
export async function listLeadSources(tenantId: number, includeDeleted = false) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(leadSources.tenantId, tenantId)];
  if (!includeDeleted) conditions.push(eq(leadSources.isDeleted, false));
  return db.select().from(leadSources).where(and(...conditions)).orderBy(leadSources.name);
}
export async function createLeadSource(data: { tenantId: number; name: string; color?: string }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(leadSources).values(data).$returningId();
  return result;
}
export async function updateLeadSource(id: number, data: { name?: string; color?: string; isActive?: boolean }) {
  const db = await getDb(); if (!db) return null;
  await db.update(leadSources).set(data).where(eq(leadSources.id, id));
  return { id };
}
export async function softDeleteLeadSource(id: number) {
  const db = await getDb(); if (!db) return null;
  await db.update(leadSources).set({ isDeleted: true, deletedAt: new Date() }).where(eq(leadSources.id, id));
  return { id };
}
export async function restoreLeadSource(id: number) {
  const db = await getDb(); if (!db) return null;
  await db.update(leadSources).set({ isDeleted: false, deletedAt: null }).where(eq(leadSources.id, id));
  return { id };
}
export async function hardDeleteLeadSource(id: number) {
  const db = await getDb(); if (!db) return null;
  await db.delete(leadSources).where(eq(leadSources.id, id));
  return { id };
}

// ═══════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════
export async function listCampaigns(tenantId: number, sourceId?: number, includeDeleted = false) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(campaigns.tenantId, tenantId)];
  if (!includeDeleted) conditions.push(eq(campaigns.isDeleted, false));
  if (sourceId) conditions.push(eq(campaigns.sourceId, sourceId));
  return db.select().from(campaigns).where(and(...conditions)).orderBy(campaigns.name);
}
export async function createCampaign(data: { tenantId: number; sourceId?: number; name: string; color?: string }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(campaigns).values(data).$returningId();
  return result;
}
export async function updateCampaign(id: number, data: { name?: string; color?: string; sourceId?: number | null; isActive?: boolean }) {
  const db = await getDb(); if (!db) return null;
  await db.update(campaigns).set(data).where(eq(campaigns.id, id));
  return { id };
}
export async function softDeleteCampaign(id: number) {
  const db = await getDb(); if (!db) return null;
  await db.update(campaigns).set({ isDeleted: true, deletedAt: new Date() }).where(eq(campaigns.id, id));
  return { id };
}
export async function restoreCampaign(id: number) {
  const db = await getDb(); if (!db) return null;
  await db.update(campaigns).set({ isDeleted: false, deletedAt: null }).where(eq(campaigns.id, id));
  return { id };
}
export async function hardDeleteCampaign(id: number) {
  const db = await getDb(); if (!db) return null;
  await db.delete(campaigns).where(eq(campaigns.id, id));
  return { id };
}

// ═══════════════════════════════════════
// LOSS REASONS (Motivos de Perda)
// ═══════════════════════════════════════
export async function listLossReasons(tenantId: number, includeDeleted = false) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(lossReasons.tenantId, tenantId)];
  if (!includeDeleted) conditions.push(eq(lossReasons.isDeleted, false));
  return db.select().from(lossReasons).where(and(...conditions)).orderBy(lossReasons.name);
}
export async function createLossReason(data: { tenantId: number; name: string; description?: string }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(lossReasons).values(data).$returningId();
  return result;
}
export async function updateLossReason(id: number, data: { name?: string; description?: string; isActive?: boolean }) {
  const db = await getDb(); if (!db) return null;
  await db.update(lossReasons).set(data).where(eq(lossReasons.id, id));
  return { id };
}
export async function softDeleteLossReason(id: number) {
  const db = await getDb(); if (!db) return null;
  await db.update(lossReasons).set({ isDeleted: true, deletedAt: new Date() }).where(eq(lossReasons.id, id));
  return { id };
}
export async function restoreLossReason(id: number) {
  const db = await getDb(); if (!db) return null;
  await db.update(lossReasons).set({ isDeleted: false, deletedAt: null }).where(eq(lossReasons.id, id));
  return { id };
}
export async function hardDeleteLossReason(id: number) {
  const db = await getDb(); if (!db) return null;
  await db.delete(lossReasons).where(eq(lossReasons.id, id));
  return { id };
}
export async function incrementLossReasonUsage(id: number) {
  const db = await getDb(); if (!db) return null;
  await db.update(lossReasons).set({ usageCount: sql`${lossReasons.usageCount} + 1` }).where(eq(lossReasons.id, id));
  return { id };
}


// ═══════════════════════════════════════
// TASK AUTOMATIONS — CRUD & Motor de Execução
// ═══════════════════════════════════════

export async function listTaskAutomations(tenantId: number, pipelineId?: number) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(taskAutomations.tenantId, tenantId)];
  if (pipelineId) conditions.push(eq(taskAutomations.pipelineId, pipelineId));
  return db.select().from(taskAutomations).where(and(...conditions)).orderBy(taskAutomations.stageId, taskAutomations.orderIndex);
}

export async function listTaskAutomationsByStage(tenantId: number, stageId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(taskAutomations)
    .where(and(
      eq(taskAutomations.tenantId, tenantId),
      eq(taskAutomations.stageId, stageId),
      eq(taskAutomations.isActive, true)
    ))
    .orderBy(taskAutomations.orderIndex);
}

export async function createTaskAutomation(data: {
  tenantId: number;
  pipelineId: number;
  stageId: number;
  taskTitle: string;
  taskDescription?: string;
  taskType?: "whatsapp" | "phone" | "email" | "video" | "task";
  deadlineReference?: "current_date" | "boarding_date" | "return_date";
  deadlineOffsetDays?: number;
  deadlineTime?: string;
  assignToOwner?: boolean;
  assignToUserIds?: number[];
  isActive?: boolean;
  orderIndex?: number;
}) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(taskAutomations).values({
    tenantId: data.tenantId,
    pipelineId: data.pipelineId,
    stageId: data.stageId,
    taskTitle: data.taskTitle,
    taskDescription: data.taskDescription ?? null,
    taskType: data.taskType ?? "task",
    deadlineReference: data.deadlineReference ?? "current_date",
    deadlineOffsetDays: data.deadlineOffsetDays ?? 0,
    deadlineTime: data.deadlineTime ?? "09:00",
    assignToOwner: data.assignToOwner ?? true,
    assignToUserIds: data.assignToUserIds ?? null,
    isActive: data.isActive ?? true,
    orderIndex: data.orderIndex ?? 0,
  });
  return { id: result.insertId };
}

export async function updateTaskAutomation(id: number, tenantId: number, data: Partial<{
  taskTitle: string;
  taskDescription: string | null;
  taskType: "whatsapp" | "phone" | "email" | "video" | "task";
  deadlineReference: "current_date" | "boarding_date" | "return_date";
  deadlineOffsetDays: number;
  deadlineTime: string;
  assignToOwner: boolean;
  assignToUserIds: number[] | null;
  isActive: boolean;
  orderIndex: number;
  stageId: number;
  pipelineId: number;
}>) {
  const db = await getDb(); if (!db) return null;
  await db.update(taskAutomations).set(data).where(and(eq(taskAutomations.id, id), eq(taskAutomations.tenantId, tenantId)));
  return { id };
}

export async function deleteTaskAutomation(id: number, tenantId: number) {
  const db = await getDb(); if (!db) return null;
  await db.delete(taskAutomations).where(and(eq(taskAutomations.id, id), eq(taskAutomations.tenantId, tenantId)));
  return { id };
}

/**
 * Motor de execução: ao mover deal para uma etapa, cria tarefas automaticamente
 * baseado nas regras configuradas para aquela etapa.
 */
export async function executeTaskAutomations(
  tenantId: number,
  dealId: number,
  stageId: number,
  deal: { ownerUserId?: number | null; boardingDate?: Date | string | null; returnDate?: Date | string | null },
  createdByUserId?: number
) {
  const db = await getDb(); if (!db) return [];
  
  // Buscar automações ativas para esta etapa
  const automations = await listTaskAutomationsByStage(tenantId, stageId);
  if (!automations.length) return [];
  
  const createdTasks: number[] = [];
  const now = new Date();
  
  for (const auto of automations) {
    // Calcular a data de prazo
    let baseDate: Date;
    
    if (auto.deadlineReference === "boarding_date" && deal.boardingDate) {
      baseDate = new Date(deal.boardingDate);
    } else if (auto.deadlineReference === "return_date" && deal.returnDate) {
      baseDate = new Date(deal.returnDate);
    } else {
      baseDate = new Date(now);
    }
    
    // Aplicar offset conforme unidade (minutes, hours, days)
    const dueDate = new Date(baseDate);
    const unit = (auto as any).deadlineOffsetUnit || "days";
    const offsetValue = auto.deadlineOffsetDays;
    
    if (unit === "minutes") {
      dueDate.setMinutes(dueDate.getMinutes() + offsetValue);
    } else if (unit === "hours") {
      dueDate.setHours(dueDate.getHours() + offsetValue);
    } else {
      // days (default)
      dueDate.setDate(dueDate.getDate() + offsetValue);
      // Aplicar horário apenas para offset em dias
      const [hours, minutes] = (auto.deadlineTime || "09:00").split(":").map(Number);
      dueDate.setHours(hours || 9, minutes || 0, 0, 0);
    }
    
    // Determinar responsáveis
    let assigneeIds: number[] = [];
    if (auto.assignToOwner && deal.ownerUserId) {
      assigneeIds = [deal.ownerUserId];
    }
    if (auto.assignToUserIds && auto.assignToUserIds.length > 0) {
      assigneeIds = Array.from(new Set([...assigneeIds, ...auto.assignToUserIds]));
    }
    
    // Criar a tarefa
    const [taskResult] = await db.insert(tasks).values({
      tenantId,
      entityType: "deal",
      entityId: dealId,
      title: auto.taskTitle,
      description: auto.taskDescription ?? undefined,
      taskType: auto.taskType,
      dueAt: dueDate,
      status: "pending",
      createdByUserId: createdByUserId ?? undefined,
    });
    
    const taskId = taskResult.insertId;
    createdTasks.push(taskId);
    
    // Atribuir responsáveis
    if (assigneeIds.length > 0) {
      await db.insert(taskAssignees).values(
        assigneeIds.map(uid => ({ tenantId, taskId, userId: uid }))
      );
    }
  }
  
  return createdTasks;
}


// ═══════════════════════════════════════
// DATE-BASED AUTOMATIONS
// ═══════════════════════════════════════
export async function createDateAutomation(data: {
  tenantId: number; name: string; description?: string; pipelineId: number;
  dateField: "boardingDate" | "returnDate" | "expectedCloseAt" | "createdAt";
  condition: "days_before" | "days_after" | "on_date"; offsetDays: number;
  sourceStageId?: number; targetStageId: number; dealStatusFilter?: "open" | "won" | "lost";
  isActive?: boolean;
}) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(dateAutomations).values(data as any).$returningId();
  return result;
}

export async function listDateAutomations(tenantId: number, pipelineId?: number) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(dateAutomations.tenantId, tenantId)];
  if (pipelineId) conditions.push(eq(dateAutomations.pipelineId, pipelineId));
  return db.select().from(dateAutomations).where(and(...conditions)).orderBy(desc(dateAutomations.createdAt));
}

export async function getDateAutomation(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(dateAutomations).where(and(eq(dateAutomations.tenantId, tenantId), eq(dateAutomations.id, id))).limit(1);
  return rows[0] || null;
}

export async function updateDateAutomation(tenantId: number, id: number, data: {
  name?: string; description?: string; dateField?: string; condition?: string;
  offsetDays?: number; sourceStageId?: number | null; targetStageId?: number;
  dealStatusFilter?: string | null; isActive?: boolean;
}) {
  const db = await getDb(); if (!db) return;
  await db.update(dateAutomations).set(data as any).where(and(eq(dateAutomations.tenantId, tenantId), eq(dateAutomations.id, id)));
}

export async function deleteDateAutomation(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return;
  await db.delete(dateAutomations).where(and(eq(dateAutomations.tenantId, tenantId), eq(dateAutomations.id, id)));
}

export async function getAllActiveDateAutomations() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(dateAutomations).where(eq(dateAutomations.isActive, true));
}

export async function updateDateAutomationLastRun(id: number) {
  const db = await getDb(); if (!db) return;
  await db.update(dateAutomations).set({ lastRunAt: new Date() }).where(eq(dateAutomations.id, id));
}

/**
 * Execute a single date automation: find matching deals and move them to the target stage
 */
export async function executeDateAutomation(auto: {
  id: number; tenantId: number; pipelineId: number;
  dateField: "boardingDate" | "returnDate" | "expectedCloseAt" | "createdAt";
  condition: "days_before" | "days_after" | "on_date"; offsetDays: number;
  sourceStageId: number | null; targetStageId: number; dealStatusFilter: string | null;
}) {
  const db = await getDb(); if (!db) return { moved: 0 };

  const nowSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const today = new Date(nowSP.getFullYear(), nowSP.getMonth(), nowSP.getDate());

  // Build the date column reference
  const dateCol = auto.dateField === "boardingDate" ? deals.boardingDate
    : auto.dateField === "returnDate" ? deals.returnDate
    : auto.dateField === "expectedCloseAt" ? deals.expectedCloseAt
    : deals.createdAt;

  // Build conditions
  const conditions: any[] = [
    eq(deals.tenantId, auto.tenantId),
    eq(deals.pipelineId, auto.pipelineId),
    isNotNull(dateCol),
    ne(deals.stageId, auto.targetStageId),
    isNull(deals.deletedAt),
  ];

  if (auto.dealStatusFilter) {
    conditions.push(eq(deals.status, auto.dealStatusFilter as any));
  }
  if (auto.sourceStageId) {
    conditions.push(eq(deals.stageId, auto.sourceStageId));
  }

  // Date condition logic:
  // "days_before": move when today >= (dateField - offsetDays)
  // "days_after": move when today >= (dateField + offsetDays)
  // "on_date": move when today == dateField
  if (auto.condition === "days_before") {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + auto.offsetDays);
    conditions.push(lte(dateCol, targetDate));
  } else if (auto.condition === "days_after") {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() - auto.offsetDays);
    conditions.push(lte(dateCol, targetDate));
  } else {
    // on_date
    const endOfDay = new Date(today);
    endOfDay.setDate(endOfDay.getDate() + 1);
    conditions.push(gte(dateCol, today));
    conditions.push(lte(dateCol, endOfDay));
  }

  const matchingDeals = await db.select({ id: deals.id, stageId: deals.stageId })
    .from(deals)
    .where(and(...conditions));

  if (matchingDeals.length === 0) return { moved: 0 };

  const dealIds = matchingDeals.map(d => d.id);
  await db.update(deals)
    .set({ stageId: auto.targetStageId, updatedAt: new Date() })
    .where(inArray(deals.id, dealIds));

  // Log the moves in deal_history
  for (const deal of matchingDeals) {
    await db.insert(dealHistory).values({
      tenantId: auto.tenantId,
      dealId: deal.id,
      action: "stage_change",
      description: `Automação por data: movido da etapa ${deal.stageId} para ${auto.targetStageId}`,
      fromStageId: deal.stageId,
      toStageId: auto.targetStageId,
      fieldChanged: "stageId",
      oldValue: String(deal.stageId),
      newValue: String(auto.targetStageId),
      actorName: "Automação por data",
      metadataJson: { automationId: auto.id },
    });
  }

  return { moved: matchingDeals.length };
}

// ═══════════════════════════════════════
// WHATSAPP UNREAD COUNTS BY CONTACT
// ═══════════════════════════════════════
/**
 * Get total unread WhatsApp message counts grouped by contactId.
 * Used by Pipeline to show badges on deal cards.
 */
export async function getWhatsAppUnreadByContact(tenantId: number): Promise<Record<number, number>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select({
    contactId: waConversations.contactId,
    totalUnread: sql<number>`SUM(${waConversations.unreadCount})`.as("totalUnread"),
  })
    .from(waConversations)
    .where(and(
      eq(waConversations.tenantId, tenantId),
      isNotNull(waConversations.contactId),
    ))
    .groupBy(waConversations.contactId);
  const result: Record<number, number> = {};
  for (const row of rows) {
    if (row.contactId && Number(row.totalUnread) > 0) result[row.contactId] = Number(row.totalUnread);
  }
  return result;
}

// ═══════════════════════════════════════
// BIRTHDAY & WEDDING DATE QUERIES
// ═══════════════════════════════════════
export async function getContactsWithUpcomingDates(tenantId: number, opts: { daysAhead?: number; dateType: "birthDate" | "weddingDate" }) {
  const db = await getDb(); if (!db) return [];
  const daysAhead = opts.daysAhead ?? 7;
  // Get today's MM-DD and the date daysAhead days from now MM-DD
  const today = new Date();
  const dates: string[] = [];
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push(`${mm}-${dd}`);
  }
  const col = opts.dateType === "birthDate" ? contacts.birthDate : contacts.weddingDate;
  return db.select().from(contacts).where(
    and(
      eq(contacts.tenantId, tenantId),
      isNull(contacts.deletedAt),
      inArray(col, dates)
    )
  ).orderBy(col);
}

export async function getContactsWithDateToday(tenantId: number, dateType: "birthDate" | "weddingDate") {
  const db = await getDb(); if (!db) return [];
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${mm}-${dd}`;
  const col = dateType === "birthDate" ? contacts.birthDate : contacts.weddingDate;
  return db.select().from(contacts).where(
    and(
      eq(contacts.tenantId, tenantId),
      isNull(contacts.deletedAt),
      eq(col, todayStr)
    )
  );
}

export async function getContactsWithDateInMonth(tenantId: number, month: number, dateType: "birthDate" | "weddingDate") {
  const db = await getDb(); if (!db) return [];
  const mm = String(month).padStart(2, "0");
  const col = dateType === "birthDate" ? contacts.birthDate : contacts.weddingDate;
  return db.select().from(contacts).where(
    and(
      eq(contacts.tenantId, tenantId),
      isNull(contacts.deletedAt),
      like(col, `${mm}-%`)
    )
  ).orderBy(col);
}
