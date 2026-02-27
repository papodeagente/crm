import { eq, and, desc, asc, like, sql, inArray, count, sum, gte, lt, isNull, isNotNull } from "drizzle-orm";
import { getDb } from "./db";
import {
  tenants, crmUsers, teams, teamMembers, roles, permissions, rolePermissions, userRoles, apiKeys,
  contacts, accounts, deals, dealParticipants, pipelines, pipelineStages, pipelineAutomations, trips, tripItems,
  tasks, crmNotes, crmAttachments, dealProducts, dealHistory,
  channels, conversations, inboxMessages,
  proposalTemplates, proposals, proposalItems, proposalSignatures,
  portalUsers, portalSessions, portalTickets,
  goals, performanceSnapshots, metricsDaily, alerts,
  courses, lessons, enrollments,
  integrations, integrationConnections, integrationCredentials, webhooks, jobs, jobDlq,
  eventLog,
  productCategories, productCatalog,
  waMessages, whatsappSessions,
  aiConversationAnalyses,
} from "../drizzle/schema";

// ═══════════════════════════════════════
// TENANTS
// ═══════════════════════════════════════
export async function createTenant(data: { name: string; plan?: "starter" | "business" | "enterprise" }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(tenants).values({ name: data.name, plan: data.plan || "starter" }).$returningId();
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
export async function listContacts(tenantId: number, opts?: { search?: string; stage?: string; limit?: number; offset?: number; includeDeleted?: boolean }) {
  const db = await getDb(); if (!db) return [];
  const conditions: any[] = [eq(contacts.tenantId, tenantId)];
  if (!opts?.includeDeleted) conditions.push(isNull(contacts.deletedAt));
  if (opts?.search) conditions.push(like(contacts.name, `%${opts.search}%`));
  return db.select().from(contacts).where(and(...conditions)).orderBy(desc(contacts.updatedAt)).limit(opts?.limit || 50).offset(opts?.offset || 0);
}
export async function updateContact(tenantId: number, id: number, data: Partial<{ name: string; email: string; phone: string; lifecycleStage: "lead" | "prospect" | "customer" | "churned"; notes: string; ownerUserId: number; updatedBy: number }>) {
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
export async function countContacts(tenantId: number) {
  const db = await getDb(); if (!db) return 0;
  const rows = await db.select({ count: sql<number>`count(*)` }).from(contacts).where(eq(contacts.tenantId, tenantId));
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
export async function listPipelines(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(pipelines).where(eq(pipelines.tenantId, tenantId));
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
export async function createDeal(data: { tenantId: number; title: string; contactId?: number; pipelineId: number; stageId: number; valueCents?: number; ownerUserId?: number; teamId?: number; createdBy?: number }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(deals).values(data).$returningId();
  return result;
}
export async function getDealById(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(deals).where(and(eq(deals.id, id), eq(deals.tenantId, tenantId))).limit(1);
  return rows[0] || null;
}
export async function listDeals(tenantId: number, opts?: { pipelineId?: number; stageId?: number; status?: string; limit?: number; offset?: number; includeDeleted?: boolean }) {
  const db = await getDb(); if (!db) return [];
  const conditions: any[] = [eq(deals.tenantId, tenantId)];
  if (!opts?.includeDeleted) conditions.push(isNull(deals.deletedAt));
  if (opts?.pipelineId) conditions.push(eq(deals.pipelineId, opts.pipelineId));
  if (opts?.stageId) conditions.push(eq(deals.stageId, opts.stageId));
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
export async function updateDeal(tenantId: number, id: number, data: Partial<{ title: string; stageId: number; status: "open" | "won" | "lost"; valueCents: number; probability: number; ownerUserId: number; updatedBy: number }>) {
  const db = await getDb(); if (!db) return;
  await db.update(deals).set({ ...data, lastActivityAt: new Date() }).where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)));
}
export async function countDeals(tenantId: number, status?: string) {
  const db = await getDb(); if (!db) return 0;
  const conditions = [eq(deals.tenantId, tenantId)];
  if (status) conditions.push(eq(deals.status, status as any));
  const rows = await db.select({ count: sql<number>`count(*)` }).from(deals).where(and(...conditions));
  return rows[0]?.count || 0;
}
export async function sumDealValue(tenantId: number, status?: string) {
  const db = await getDb(); if (!db) return 0;
  const conditions = [eq(deals.tenantId, tenantId)];
  if (status) conditions.push(eq(deals.status, status as any));
  const rows = await db.select({ total: sql<number>`COALESCE(SUM(valueCents), 0)` }).from(deals).where(and(...conditions));
  return rows[0]?.total || 0;
}

// ═══════════════════════════════════════
// ACCOUNTS
// ═══════════════════════════════════════
export async function listAccounts(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(accounts).where(eq(accounts.tenantId, tenantId)).orderBy(desc(accounts.createdAt));
}
export async function getAccountById(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.tenantId, tenantId))).limit(1);
  return rows[0] || null;
}

// ═══════════════════════════════════════
// DEAL PRODUCTS
// ═══════════════════════════════════════
export async function createDealProduct(data: { tenantId: number; dealId: number; name: string; description?: string; category?: "flight" | "hotel" | "tour" | "transfer" | "insurance" | "cruise" | "visa" | "other"; quantity?: number; unitPriceCents?: number; discountCents?: number; supplier?: string; checkIn?: Date; checkOut?: Date; notes?: string }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(dealProducts).values(data).$returningId();
  return result;
}
export async function listDealProducts(tenantId: number, dealId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(dealProducts).where(and(eq(dealProducts.tenantId, tenantId), eq(dealProducts.dealId, dealId))).orderBy(desc(dealProducts.createdAt));
}
export async function updateDealProduct(tenantId: number, id: number, data: Partial<{ name: string; description: string; category: "flight" | "hotel" | "tour" | "transfer" | "insurance" | "cruise" | "visa" | "other"; quantity: number; unitPriceCents: number; discountCents: number; supplier: string; checkIn: Date; checkOut: Date; notes: string }>) {
  const db = await getDb(); if (!db) return;
  await db.update(dealProducts).set(data).where(and(eq(dealProducts.id, id), eq(dealProducts.tenantId, tenantId)));
}
export async function deleteDealProduct(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return;
  await db.delete(dealProducts).where(and(eq(dealProducts.id, id), eq(dealProducts.tenantId, tenantId)));
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
export async function createTask(data: { tenantId: number; entityType: string; entityId: number; title: string; dueAt?: Date; assignedToUserId?: number; createdByUserId?: number; priority?: "low" | "medium" | "high" | "urgent" }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(tasks).values(data).$returningId();
  return result;
}
export async function listTasks(tenantId: number, opts?: { entityType?: string; entityId?: number; status?: string }) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(tasks.tenantId, tenantId)];
  if (opts?.entityType) conditions.push(eq(tasks.entityType, opts.entityType));
  if (opts?.entityId) conditions.push(eq(tasks.entityId, opts.entityId));
  return db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.createdAt));
}
export async function updateTask(tenantId: number, id: number, data: Partial<{ title: string; status: "pending" | "in_progress" | "done" | "cancelled"; priority: "low" | "medium" | "high" | "urgent"; dueAt: Date; assignedToUserId: number }>) {
  const db = await getDb(); if (!db) return;
  await db.update(tasks).set(data).where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)));
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
export async function countConversations(tenantId: number, status?: string) {
  const db = await getDb(); if (!db) return 0;
  const conditions = [eq(conversations.tenantId, tenantId)];
  if (status) conditions.push(eq(conversations.status, status as any));
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
export async function createGoal(data: { tenantId: number; periodStart: Date; periodEnd: Date; metricKey: string; targetValue: number; teamId?: number; userId?: number }) {
  const db = await getDb(); if (!db) return null;
  const [result] = await db.insert(goals).values(data).$returningId();
  return result;
}
export async function listGoals(tenantId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(goals).where(eq(goals.tenantId, tenantId)).orderBy(desc(goals.createdAt));
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
export async function updateStage(tenantId: number, id: number, data: { name?: string; color?: string; orderIndex?: number; probabilityDefault?: number; isWon?: boolean; isLost?: boolean }) {
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
          tenantId, dealId: newDeal.id, name: p.name, description: p.description || undefined,
          category: p.category as any, quantity: p.quantity, unitPriceCents: p.unitPriceCents,
          discountCents: p.discountCents || 0,
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
