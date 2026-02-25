import { eq, and, desc, asc, like, sql, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  tenants, crmUsers, teams, teamMembers, roles, permissions, rolePermissions, userRoles, apiKeys,
  contacts, accounts, deals, dealParticipants, pipelines, pipelineStages, trips, tripItems,
  tasks, crmNotes, crmAttachments,
  channels, conversations, inboxMessages,
  proposalTemplates, proposals, proposalItems, proposalSignatures,
  portalUsers, portalSessions, portalTickets,
  goals, performanceSnapshots, metricsDaily, alerts,
  courses, lessons, enrollments,
  integrations, integrationConnections, integrationCredentials, webhooks, jobs, jobDlq,
  eventLog,
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
  const [result] = await db.insert(contacts).values(data).$returningId();
  return result;
}
export async function getContactById(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId))).limit(1);
  return rows[0] || null;
}
export async function listContacts(tenantId: number, opts?: { search?: string; stage?: string; limit?: number; offset?: number }) {
  const db = await getDb(); if (!db) return [];
  let q = db.select().from(contacts).where(eq(contacts.tenantId, tenantId));
  if (opts?.search) {
    q = db.select().from(contacts).where(and(eq(contacts.tenantId, tenantId), like(contacts.name, `%${opts.search}%`)));
  }
  return q.orderBy(desc(contacts.updatedAt)).limit(opts?.limit || 50).offset(opts?.offset || 0);
}
export async function updateContact(tenantId: number, id: number, data: Partial<{ name: string; email: string; phone: string; lifecycleStage: "lead" | "prospect" | "customer" | "churned"; notes: string; ownerUserId: number; updatedBy: number }>) {
  const db = await getDb(); if (!db) return;
  await db.update(contacts).set(data).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
}
export async function deleteContact(tenantId: number, id: number) {
  const db = await getDb(); if (!db) return;
  await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
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
export async function listDeals(tenantId: number, opts?: { pipelineId?: number; stageId?: number; status?: string; limit?: number; offset?: number }) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(deals.tenantId, tenantId)];
  if (opts?.pipelineId) conditions.push(eq(deals.pipelineId, opts.pipelineId));
  if (opts?.stageId) conditions.push(eq(deals.stageId, opts.stageId));
  return db.select().from(deals).where(and(...conditions)).orderBy(desc(deals.lastActivityAt)).limit(opts?.limit || 50).offset(opts?.offset || 0);
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
