import { eq, desc, and, or, like, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, whatsappSessions, waMessages as messages, activityLogs, chatbotSettings, chatbotRules, conversationAssignments, crmUsers, teams, teamMembers, distributionRules, customFields, customFieldValues } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// WhatsApp Sessions
export async function getSessionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(whatsappSessions).where(eq(whatsappSessions.userId, userId));
}

export async function getSessionBySessionId(sessionId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(whatsappSessions).where(eq(whatsappSessions.sessionId, sessionId)).limit(1);
  return result[0] || null;
}

// Messages
export async function getMessages(sessionId: string, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getMessagesByContact(sessionId: string, remoteJid: string, limit = 50, beforeId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(messages.sessionId, sessionId), eq(messages.remoteJid, remoteJid)];
  if (beforeId) {
    conditions.push(lt(messages.id, beforeId));
  }
  return db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

// Activity Logs
export async function getLogs(sessionId: string, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.sessionId, sessionId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

export async function getAllLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(activityLogs)
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

// Chatbot Settings
export async function getChatbotSettings(sessionId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(chatbotSettings).where(eq(chatbotSettings.sessionId, sessionId)).limit(1);
  return result[0] || null;
}

export async function upsertChatbotSettings(sessionId: string, data: Partial<typeof chatbotSettings.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  const existing = await getChatbotSettings(sessionId);
  if (existing) {
    await db
      .update(chatbotSettings)
      .set(data)
      .where(eq(chatbotSettings.sessionId, sessionId));
  } else {
    await db.insert(chatbotSettings).values({
      sessionId,
      enabled: data.enabled ?? false,
      systemPrompt: data.systemPrompt || "Você é um assistente virtual amigável e prestativo. Responda de forma concisa e educada em português.",
      maxTokens: data.maxTokens || 500,
      mode: data.mode || "all",
      respondGroups: data.respondGroups ?? true,
      respondPrivate: data.respondPrivate ?? true,
      onlyWhenMentioned: data.onlyWhenMentioned ?? false,
      triggerWords: data.triggerWords || null,
      welcomeMessage: data.welcomeMessage || null,
      awayMessage: data.awayMessage || null,
      businessHoursEnabled: data.businessHoursEnabled ?? false,
      businessHoursStart: data.businessHoursStart || "09:00",
      businessHoursEnd: data.businessHoursEnd || "18:00",
      businessHoursDays: data.businessHoursDays || "1,2,3,4,5",
      businessHoursTimezone: data.businessHoursTimezone || "America/Sao_Paulo",
      replyDelay: data.replyDelay ?? 0,
      contextMessageCount: data.contextMessageCount ?? 10,
      rateLimitPerHour: data.rateLimitPerHour ?? 0,
      rateLimitPerDay: data.rateLimitPerDay ?? 0,
      temperature: data.temperature || "0.70",
    });
  }
}

// Chatbot Rules (whitelist/blacklist)
export async function getChatbotRules(sessionId: string, ruleType?: "whitelist" | "blacklist") {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(chatbotRules.sessionId, sessionId)];
  if (ruleType) conditions.push(eq(chatbotRules.ruleType, ruleType));
  return db.select().from(chatbotRules).where(and(...conditions)).orderBy(desc(chatbotRules.createdAt));
}

export async function addChatbotRule(sessionId: string, remoteJid: string, ruleType: "whitelist" | "blacklist", contactName?: string) {
  const db = await getDb();
  if (!db) return;
  // Upsert: if exists, update ruleType
  try {
    await db.insert(chatbotRules).values({ sessionId, remoteJid, ruleType, contactName: contactName || null });
  } catch (e: any) {
    if (e.code === "ER_DUP_ENTRY") {
      await db.update(chatbotRules).set({ ruleType, contactName: contactName || null }).where(and(eq(chatbotRules.sessionId, sessionId), eq(chatbotRules.remoteJid, remoteJid)));
    } else throw e;
  }
}

export async function removeChatbotRule(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(chatbotRules).where(eq(chatbotRules.id, id));
}

// WhatsApp Conversations List (grouped by remoteJid)
export async function getConversationsList(sessionId: string) {
  const db = await getDb();
  if (!db) return [];
  // Internal Baileys types to exclude from conversation preview
  const skipTypes = [
    'protocolMessage','senderKeyDistributionMessage','messageContextInfo',
    'reactionMessage','ephemeralMessage','deviceSentMessage',
    'bcallMessage','callLogMesssage','keepInChatMessage',
    'encReactionMessage','editedMessage','viewOnceMessageV2Extension'
  ];
  const skipTypesSQL = skipTypes.map(t => `'${t}'`).join(',');
  
  // Get distinct remoteJids with last REAL message info + pushName
  const result = await db.execute(sql`
    SELECT 
      m.remoteJid,
      m.content AS lastMessage,
      m.messageType AS lastMessageType,
      m.fromMe AS lastFromMe,
      m.timestamp AS lastTimestamp,
      m.status AS lastStatus,
      (
        SELECT m4.pushName FROM messages m4 
        WHERE m4.sessionId = ${sessionId} 
        AND m4.remoteJid = m.remoteJid 
        AND m4.fromMe = 0 
        AND m4.pushName IS NOT NULL 
        AND m4.pushName != ''
        ORDER BY m4.id DESC LIMIT 1
      ) AS contactPushName,
      (
        SELECT COUNT(*) FROM messages m2 
        WHERE m2.sessionId = ${sessionId} 
        AND m2.remoteJid = m.remoteJid 
        AND m2.fromMe = 0 
        AND (m2.status IS NULL OR m2.status = 'received')
        AND m2.messageType NOT IN (${sql.raw(skipTypesSQL)})
      ) AS unreadCount,
      (
        SELECT COUNT(*) FROM messages m3 
        WHERE m3.sessionId = ${sessionId} 
        AND m3.remoteJid = m.remoteJid
        AND m3.messageType NOT IN (${sql.raw(skipTypesSQL)})
      ) AS totalMessages
    FROM messages m
    INNER JOIN (
      SELECT remoteJid, MAX(id) AS maxId
      FROM messages
      WHERE sessionId = ${sessionId}
      AND remoteJid NOT LIKE '%@g.us'
      AND messageType NOT IN (${sql.raw(skipTypesSQL)})
      GROUP BY remoteJid
    ) latest ON m.remoteJid = latest.remoteJid AND m.id = latest.maxId
    WHERE m.sessionId = ${sessionId}
    AND m.remoteJid NOT LIKE '%@g.us'
    ORDER BY m.timestamp DESC
  `);
  return (result as any)[0] || [];
}

// Mark conversation as read
export async function markConversationRead(sessionId: string, remoteJid: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(messages)
    .set({ status: "read" })
    .where(and(
      eq(messages.sessionId, sessionId),
      eq(messages.remoteJid, remoteJid),
      eq(messages.fromMe, false)
    ));
}


// ─── Conversation Assignments (Multi-Agent) ───

export async function getOrCreateAssignment(tenantId: number, sessionId: string, remoteJid: string) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(conversationAssignments)
    .where(and(
      eq(conversationAssignments.tenantId, tenantId),
      eq(conversationAssignments.sessionId, sessionId),
      eq(conversationAssignments.remoteJid, remoteJid)
    )).limit(1);
  if (existing.length > 0) return existing[0];
  // Auto-create assignment with status open, no agent assigned
  await db.insert(conversationAssignments).values({ tenantId, sessionId, remoteJid, status: "open" });
  const created = await db.select().from(conversationAssignments)
    .where(and(
      eq(conversationAssignments.tenantId, tenantId),
      eq(conversationAssignments.sessionId, sessionId),
      eq(conversationAssignments.remoteJid, remoteJid)
    )).limit(1);
  return created[0] || null;
}

export async function assignConversation(tenantId: number, sessionId: string, remoteJid: string, assignedUserId: number | null, assignedTeamId?: number | null) {
  const db = await getDb();
  if (!db) return null;
  // Ensure assignment exists
  await getOrCreateAssignment(tenantId, sessionId, remoteJid);
  const updateData: any = { assignedUserId, lastAssignedAt: new Date() };
  if (assignedTeamId !== undefined) updateData.assignedTeamId = assignedTeamId;
  await db.update(conversationAssignments)
    .set(updateData)
    .where(and(
      eq(conversationAssignments.tenantId, tenantId),
      eq(conversationAssignments.sessionId, sessionId),
      eq(conversationAssignments.remoteJid, remoteJid)
    ));
  return getOrCreateAssignment(tenantId, sessionId, remoteJid);
}

export async function updateAssignmentStatus(tenantId: number, sessionId: string, remoteJid: string, status: "open" | "pending" | "resolved" | "closed") {
  const db = await getDb();
  if (!db) return;
  const updateData: any = { status };
  if (status === "resolved") updateData.resolvedAt = new Date();
  await db.update(conversationAssignments)
    .set(updateData)
    .where(and(
      eq(conversationAssignments.tenantId, tenantId),
      eq(conversationAssignments.sessionId, sessionId),
      eq(conversationAssignments.remoteJid, remoteJid)
    ));
}

export async function getAssignmentsForSession(tenantId: number, sessionId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversationAssignments)
    .where(and(
      eq(conversationAssignments.tenantId, tenantId),
      eq(conversationAssignments.sessionId, sessionId)
    ));
}

export async function getAssignmentForConversation(tenantId: number, sessionId: string, remoteJid: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(conversationAssignments)
    .where(and(
      eq(conversationAssignments.tenantId, tenantId),
      eq(conversationAssignments.sessionId, sessionId),
      eq(conversationAssignments.remoteJid, remoteJid)
    )).limit(1);
  return result[0] || null;
}

// Get agents (crmUsers) for a tenant
export async function getAgentsForTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: crmUsers.id,
    name: crmUsers.name,
    email: crmUsers.email,
    avatarUrl: crmUsers.avatarUrl,
    status: crmUsers.status,
  }).from(crmUsers)
    .where(and(
      eq(crmUsers.tenantId, tenantId),
      eq(crmUsers.status, "active")
    ));
}

// Get teams for a tenant
export async function getTeamsForTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teams).where(eq(teams.tenantId, tenantId));
}

// Get conversations list with assignment info (multi-agent aware)
export async function getConversationsListMultiAgent(sessionId: string, tenantId: number, filter?: { assignedUserId?: number; assignedTeamId?: number; status?: string; unassignedOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const skipTypes = [
    'protocolMessage','senderKeyDistributionMessage','messageContextInfo',
    'reactionMessage','ephemeralMessage','deviceSentMessage',
    'bcallMessage','callLogMesssage','keepInChatMessage',
    'encReactionMessage','editedMessage','viewOnceMessageV2Extension'
  ];
  const skipTypesSQL = skipTypes.map(t => `'${t}'`).join(',');
  
  // Build WHERE clause for assignment filters
  let assignmentFilter = '';
  if (filter?.assignedUserId) {
    assignmentFilter += ` AND ca.assignedUserId = ${filter.assignedUserId}`;
  }
  if (filter?.assignedTeamId) {
    assignmentFilter += ` AND ca.assignedTeamId = ${filter.assignedTeamId}`;
  }
  if (filter?.status) {
    assignmentFilter += ` AND ca.status = '${filter.status}'`;
  }
  if (filter?.unassignedOnly) {
    assignmentFilter += ` AND ca.assignedUserId IS NULL`;
  }

  const result = await db.execute(sql`
    SELECT 
      m.remoteJid,
      m.content AS lastMessage,
      m.messageType AS lastMessageType,
      m.fromMe AS lastFromMe,
      m.timestamp AS lastTimestamp,
      m.status AS lastStatus,
      m.senderAgentId AS lastSenderAgentId,
      (
        SELECT m4.pushName FROM messages m4 
        WHERE m4.sessionId = ${sessionId} 
        AND m4.remoteJid = m.remoteJid 
        AND m4.fromMe = 0 
        AND m4.pushName IS NOT NULL 
        AND m4.pushName != ''
        ORDER BY m4.id DESC LIMIT 1
      ) AS contactPushName,
      (
        SELECT COUNT(*) FROM messages m2 
        WHERE m2.sessionId = ${sessionId} 
        AND m2.remoteJid = m.remoteJid 
        AND m2.fromMe = 0 
        AND (m2.status IS NULL OR m2.status = 'received')
        AND m2.messageType NOT IN (${sql.raw(skipTypesSQL)})
      ) AS unreadCount,
      (
        SELECT COUNT(*) FROM messages m3 
        WHERE m3.sessionId = ${sessionId} 
        AND m3.remoteJid = m.remoteJid
        AND m3.messageType NOT IN (${sql.raw(skipTypesSQL)})
      ) AS totalMessages,
      ca.assignedUserId,
      ca.assignedTeamId,
      ca.status AS assignmentStatus,
      ca.priority AS assignmentPriority,
      agent.name AS assignedAgentName,
      agent.avatarUrl AS assignedAgentAvatar
    FROM messages m
    INNER JOIN (
      SELECT remoteJid, MAX(id) AS maxId
      FROM messages
      WHERE sessionId = ${sessionId}
      AND remoteJid NOT LIKE '%@g.us'
      AND messageType NOT IN (${sql.raw(skipTypesSQL)})
      GROUP BY remoteJid
    ) latest ON m.remoteJid = latest.remoteJid AND m.id = latest.maxId
    LEFT JOIN conversation_assignments ca 
      ON ca.sessionId = ${sessionId} 
      AND ca.remoteJid = m.remoteJid
      AND ca.tenantId = ${tenantId}
    LEFT JOIN crm_users agent ON agent.id = ca.assignedUserId
    WHERE m.sessionId = ${sessionId}
    AND m.remoteJid NOT LIKE '%@g.us'
    ${sql.raw(assignmentFilter)}
    ORDER BY m.timestamp DESC
  `);
  return (result as any)[0] || [];
}

// Round-robin assignment: get next agent for a tenant
export async function getNextRoundRobinAgent(tenantId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  // Get all active agents
  const agents = await db.select({ id: crmUsers.id }).from(crmUsers)
    .where(and(eq(crmUsers.tenantId, tenantId), eq(crmUsers.status, "active")));
  if (agents.length === 0) return null;
  // Get the agent with the fewest open assignments
  const result = await db.execute(sql`
    SELECT cu.id, COUNT(ca.id) as assignmentCount
    FROM crm_users cu
    LEFT JOIN conversation_assignments ca 
      ON ca.assignedUserId = cu.id 
      AND ca.tenantId = ${tenantId}
      AND ca.status IN ('open', 'pending')
    WHERE cu.tenantId = ${tenantId} AND cu.status = 'active'
    GROUP BY cu.id
    ORDER BY assignmentCount ASC, cu.id ASC
    LIMIT 1
  `);
  const rows = (result as any)[0];
  return rows?.[0]?.id || null;
}

// ─── Dashboard Metrics ───

export async function getDashboardMetrics(tenantId: number) {
  const db = await getDb();
  if (!db) {
    return {
      activeDeals: 0,
      activeDealsChange: 0,
      totalContacts: 0,
      totalContactsChange: 0,
      activeTrips: 0,
      activeTripsChange: 0,
      pendingTasks: 0,
      pendingTasksChange: 0,
      totalDealValueCents: 0,
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [result] = await db.execute(sql`
    SELECT
      -- Active deals (status = 'open')
      (SELECT COUNT(*) FROM deals WHERE tenantId = ${tenantId} AND status = 'open') AS activeDeals,
      -- Deals created in last 30 days
      (SELECT COUNT(*) FROM deals WHERE tenantId = ${tenantId} AND status = 'open' AND createdAt >= ${thirtyDaysAgo}) AS dealsLast30,
      -- Deals created in previous 30 days (30-60 days ago)
      (SELECT COUNT(*) FROM deals WHERE tenantId = ${tenantId} AND status = 'open' AND createdAt >= ${sixtyDaysAgo} AND createdAt < ${thirtyDaysAgo}) AS dealsPrev30,

      -- Total contacts
      (SELECT COUNT(*) FROM contacts WHERE tenantId = ${tenantId}) AS totalContacts,
      -- Contacts created in last 30 days
      (SELECT COUNT(*) FROM contacts WHERE tenantId = ${tenantId} AND createdAt >= ${thirtyDaysAgo}) AS contactsLast30,
      -- Contacts created in previous 30 days
      (SELECT COUNT(*) FROM contacts WHERE tenantId = ${tenantId} AND createdAt >= ${sixtyDaysAgo} AND createdAt < ${thirtyDaysAgo}) AS contactsPrev30,

      -- Active trips (planning, confirmed, in_progress)
      (SELECT COUNT(*) FROM trips WHERE tenantId = ${tenantId} AND status IN ('planning', 'confirmed', 'in_progress')) AS activeTrips,
      -- Trips created in last 30 days
      (SELECT COUNT(*) FROM trips WHERE tenantId = ${tenantId} AND status IN ('planning', 'confirmed', 'in_progress') AND createdAt >= ${thirtyDaysAgo}) AS tripsLast30,
      -- Trips created in previous 30 days
      (SELECT COUNT(*) FROM trips WHERE tenantId = ${tenantId} AND status IN ('planning', 'confirmed', 'in_progress') AND createdAt >= ${sixtyDaysAgo} AND createdAt < ${thirtyDaysAgo}) AS tripsPrev30,

      -- Pending tasks (pending or in_progress)
      (SELECT COUNT(*) FROM crm_tasks WHERE tenantId = ${tenantId} AND status IN ('pending', 'in_progress')) AS pendingTasks,
      -- Tasks created in last 30 days
      (SELECT COUNT(*) FROM crm_tasks WHERE tenantId = ${tenantId} AND status IN ('pending', 'in_progress') AND createdAt >= ${thirtyDaysAgo}) AS tasksLast30,
      -- Tasks created in previous 30 days
      (SELECT COUNT(*) FROM crm_tasks WHERE tenantId = ${tenantId} AND status IN ('pending', 'in_progress') AND createdAt >= ${sixtyDaysAgo} AND createdAt < ${thirtyDaysAgo}) AS tasksPrev30,

      -- Total deal value (open deals)
      (SELECT COALESCE(SUM(valueCents), 0) FROM deals WHERE tenantId = ${tenantId} AND status = 'open') AS totalDealValueCents
  `);

  const row = (result as any)[0] || {};

  // Calculate percentage changes
  function calcChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  return {
    activeDeals: Number(row.activeDeals) || 0,
    activeDealsChange: calcChange(Number(row.dealsLast30) || 0, Number(row.dealsPrev30) || 0),
    totalContacts: Number(row.totalContacts) || 0,
    totalContactsChange: calcChange(Number(row.contactsLast30) || 0, Number(row.contactsPrev30) || 0),
    activeTrips: Number(row.activeTrips) || 0,
    activeTripsChange: calcChange(Number(row.tripsLast30) || 0, Number(row.tripsPrev30) || 0),
    pendingTasks: Number(row.pendingTasks) || 0,
    pendingTasksChange: calcChange(Number(row.tasksLast30) || 0, Number(row.tasksPrev30) || 0),
    totalDealValueCents: Number(row.totalDealValueCents) || 0,
  };
}

// ─── Pipeline Summary for Dashboard ───

export async function getPipelineSummary(tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  const [rows] = await db.execute(sql`
    SELECT
      ps.id AS stageId,
      ps.name AS stageName,
      ps.orderIndex,
      COUNT(d.id) AS dealCount,
      COALESCE(SUM(d.valueCents), 0) AS totalValueCents
    FROM pipeline_stages ps
    LEFT JOIN deals d ON d.stageId = ps.id AND d.tenantId = ${tenantId} AND d.status = 'open'
    WHERE ps.tenantId = ${tenantId}
    GROUP BY ps.id, ps.name, ps.orderIndex
    ORDER BY ps.orderIndex ASC
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    stageId: Number(r.stageId),
    stageName: String(r.stageName),
    orderIndex: Number(r.orderIndex),
    dealCount: Number(r.dealCount) || 0,
    totalValueCents: Number(r.totalValueCents) || 0,
  }));
}

// ─── Recent Activity for Dashboard ───

export async function getRecentActivity(tenantId: number, limit = 8) {
  const db = await getDb();
  if (!db) return [];

  const [rows] = await db.execute(sql`
    SELECT id, dealId, action, description, fromStageName, toStageName,
           actorName, createdAt
    FROM deal_history
    WHERE tenantId = ${tenantId}
    ORDER BY createdAt DESC
    LIMIT ${limit}
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    id: Number(r.id),
    dealId: Number(r.dealId),
    action: String(r.action),
    description: String(r.description || ""),
    fromStageName: r.fromStageName ? String(r.fromStageName) : null,
    toStageName: r.toStageName ? String(r.toStageName) : null,
    actorName: r.actorName ? String(r.actorName) : null,
    createdAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
  }));
}

// ─── Upcoming Tasks for Dashboard ───

export async function getUpcomingTasks(tenantId: number, limit = 6) {
  const db = await getDb();
  if (!db) return [];

  const [rows] = await db.execute(sql`
    SELECT t.id, t.title, t.dueAt, t.priority, t.status,
           t.entityType, t.entityId
    FROM crm_tasks t
    WHERE t.tenantId = ${tenantId}
      AND t.status IN ('pending', 'in_progress')
    ORDER BY
      CASE t.priority
        WHEN 'urgent' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END ASC,
      t.dueAt ASC
    LIMIT ${limit}
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    id: Number(r.id),
    title: String(r.title),
    dueAt: r.dueAt ? new Date(r.dueAt).getTime() : null,
    priority: String(r.priority) as "low" | "medium" | "high" | "urgent",
    status: String(r.status),
    entityType: String(r.entityType),
    entityId: Number(r.entityId),
  }));
}


// ─── Global Search ───

export async function globalSearch(tenantId: number, query: string, limit = 5) {
  const db = await getDb();
  if (!db || !query.trim()) {
    return { contacts: [], deals: [], tasks: [] };
  }

  const searchTerm = `%${query.trim()}%`;

  // Search contacts (name, email, phone)
  const [contactRows] = await db.execute(sql`
    SELECT id, name, email, phone, type, lifecycleStage
    FROM contacts
    WHERE tenantId = ${tenantId}
      AND (name LIKE ${searchTerm} OR email LIKE ${searchTerm} OR phone LIKE ${searchTerm})
    ORDER BY updatedAt DESC
    LIMIT ${limit}
  `);

  // Search deals (title)
  const [dealRows] = await db.execute(sql`
    SELECT d.id, d.title, d.valueCents, d.status,
           ps.name AS stageName
    FROM deals d
    LEFT JOIN pipeline_stages ps ON ps.id = d.stageId
    WHERE d.tenantId = ${tenantId}
      AND d.title LIKE ${searchTerm}
    ORDER BY d.updatedAt DESC
    LIMIT ${limit}
  `);

  // Search tasks (title)
  const [taskRows] = await db.execute(sql`
    SELECT id, title, dueAt, priority, status, entityType, entityId
    FROM crm_tasks
    WHERE tenantId = ${tenantId}
      AND title LIKE ${searchTerm}
    ORDER BY updatedAt DESC
    LIMIT ${limit}
  `);

  const contacts = (contactRows as unknown as any[]).map((r: any) => ({
    id: Number(r.id),
    name: String(r.name),
    email: r.email ? String(r.email) : null,
    phone: r.phone ? String(r.phone) : null,
    type: String(r.type) as "person" | "company",
    lifecycleStage: String(r.lifecycleStage),
  }));

  const deals = (dealRows as unknown as any[]).map((r: any) => ({
    id: Number(r.id),
    title: String(r.title),
    valueCents: Number(r.valueCents) || 0,
    status: String(r.status),
    stageName: r.stageName ? String(r.stageName) : null,
  }));

  const tasks = (taskRows as unknown as any[]).map((r: any) => ({
    id: Number(r.id),
    title: String(r.title),
    dueAt: r.dueAt ? new Date(r.dueAt).getTime() : null,
    priority: String(r.priority) as "low" | "medium" | "high" | "urgent",
    status: String(r.status),
    entityType: String(r.entityType),
    entityId: Number(r.entityId),
  }));

  return { contacts, deals, tasks };
}


// ─── Notifications ───

export async function createNotification(tenantId: number, data: {
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const [result] = await db.execute(sql`
    INSERT INTO notifications (tenantId, type, title, body, entityType, entityId)
    VALUES (${tenantId}, ${data.type}, ${data.title}, ${data.body || null}, ${data.entityType || null}, ${data.entityId || null})
  `);

  return result;
}

export async function getNotifications(tenantId: number, opts?: { onlyUnread?: boolean; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];

  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  let rows: any;
  if (opts?.onlyUnread) {
    [rows] = await db.execute(sql`
      SELECT id, tenantId, type, title, body, entityType, entityId, isRead, createdAt
      FROM notifications
      WHERE tenantId = ${tenantId} AND isRead = false
      ORDER BY createdAt DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
  } else {
    [rows] = await db.execute(sql`
      SELECT id, tenantId, type, title, body, entityType, entityId, isRead, createdAt
      FROM notifications
      WHERE tenantId = ${tenantId}
      ORDER BY createdAt DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
  }

  return (rows as unknown as any[]).map((r: any) => ({
    id: Number(r.id),
    tenantId: Number(r.tenantId),
    type: String(r.type),
    title: String(r.title),
    body: r.body ? String(r.body) : null,
    entityType: r.entityType ? String(r.entityType) : null,
    entityId: r.entityId ? String(r.entityId) : null,
    isRead: Boolean(r.isRead),
    createdAt: new Date(r.createdAt).getTime(),
  }));
}

export async function getUnreadNotificationCount(tenantId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const [rows] = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM notifications
    WHERE tenantId = ${tenantId} AND isRead = false
  `);

  return Number((rows as unknown as any[])[0]?.cnt) || 0;
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`
    UPDATE notifications SET isRead = true WHERE id = ${id}
  `);
}

export async function markAllNotificationsRead(tenantId: number) {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`
    UPDATE notifications SET isRead = true WHERE tenantId = ${tenantId} AND isRead = false
  `);
}


// ════════════════════════════════════════════════════════════
// TEAM MANAGEMENT (CRUD)
// ════════════════════════════════════════════════════════════

export async function createTeam(tenantId: number, data: { name: string; description?: string; color?: string; maxMembers?: number }) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.execute(sql`
    INSERT INTO teams (tenantId, name, description, color, maxMembers)
    VALUES (${tenantId}, ${data.name}, ${data.description || null}, ${data.color || "#6366f1"}, ${data.maxMembers || 50})
  `);
  const insertId = (result as any).insertId;
  return { id: insertId, tenantId, ...data };
}

export async function updateTeam(id: number, tenantId: number, data: { name?: string; description?: string; color?: string; maxMembers?: number }) {
  const db = await getDb();
  if (!db) return null;
  const sets: string[] = [];
  if (data.name !== undefined) sets.push(`name = ${db.execute(sql`SELECT ${data.name}`)}`);
  // Use raw SQL for flexibility
  const updates: string[] = [];
  if (data.name !== undefined) updates.push("name");
  if (data.description !== undefined) updates.push("description");
  if (data.color !== undefined) updates.push("color");
  if (data.maxMembers !== undefined) updates.push("maxMembers");
  
  await db.execute(sql`
    UPDATE teams SET
      name = COALESCE(${data.name ?? null}, name),
      description = ${data.description !== undefined ? data.description : sql`description`},
      color = COALESCE(${data.color ?? null}, color),
      maxMembers = COALESCE(${data.maxMembers ?? null}, maxMembers)
    WHERE id = ${id} AND tenantId = ${tenantId}
  `);
  return { id, ...data };
}

export async function deleteTeam(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) return;
  // Remove all team members first
  await db.execute(sql`DELETE FROM team_members WHERE teamId = ${id} AND tenantId = ${tenantId}`);
  // Remove distribution rules linked to this team
  await db.execute(sql`UPDATE distribution_rules SET teamId = NULL WHERE teamId = ${id} AND tenantId = ${tenantId}`);
  // Delete the team
  await db.execute(sql`DELETE FROM teams WHERE id = ${id} AND tenantId = ${tenantId}`);
}

export async function getTeamWithMembers(teamId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  const [teamRows] = await db.execute(sql`
    SELECT id, tenantId, name, description, color, maxMembers, createdAt, updatedAt
    FROM teams WHERE id = ${teamId} AND tenantId = ${tenantId} LIMIT 1
  `);
  const team = (teamRows as unknown as any[])[0];
  if (!team) return null;
  
  const [memberRows] = await db.execute(sql`
    SELECT tm.id AS membershipId, tm.userId, tm.role, tm.createdAt,
           cu.name, cu.email, cu.avatarUrl, cu.status
    FROM team_members tm
    JOIN crm_users cu ON cu.id = tm.userId
    WHERE tm.teamId = ${teamId} AND tm.tenantId = ${tenantId}
    ORDER BY tm.role DESC, cu.name ASC
  `);
  
  return {
    ...team,
    members: (memberRows as unknown as any[]).map((m: any) => ({
      membershipId: Number(m.membershipId),
      userId: Number(m.userId),
      role: String(m.role),
      name: String(m.name),
      email: String(m.email),
      avatarUrl: m.avatarUrl ? String(m.avatarUrl) : null,
      status: String(m.status),
      createdAt: m.createdAt,
    })),
  };
}

// ════════════════════════════════════════════════════════════
// TEAM MEMBERS (CRUD)
// ════════════════════════════════════════════════════════════

export async function addTeamMember(tenantId: number, teamId: number, userId: number, role: "member" | "leader" = "member") {
  const db = await getDb();
  if (!db) return null;
  // Check if already a member
  const [existing] = await db.execute(sql`
    SELECT id FROM team_members WHERE tenantId = ${tenantId} AND teamId = ${teamId} AND userId = ${userId} LIMIT 1
  `);
  if ((existing as unknown as any[]).length > 0) return { alreadyMember: true };
  
  const [result] = await db.execute(sql`
    INSERT INTO team_members (tenantId, teamId, userId, role)
    VALUES (${tenantId}, ${teamId}, ${userId}, ${role})
  `);
  return { id: (result as any).insertId, tenantId, teamId, userId, role };
}

export async function removeTeamMember(tenantId: number, teamId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    DELETE FROM team_members WHERE tenantId = ${tenantId} AND teamId = ${teamId} AND userId = ${userId}
  `);
}

export async function updateTeamMemberRole(tenantId: number, teamId: number, userId: number, role: "member" | "leader") {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    UPDATE team_members SET role = ${role}
    WHERE tenantId = ${tenantId} AND teamId = ${teamId} AND userId = ${userId}
  `);
}

// ════════════════════════════════════════════════════════════
// AGENT MANAGEMENT (extended)
// ════════════════════════════════════════════════════════════

export async function getAgentsWithTeams(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  const [rows] = await db.execute(sql`
    SELECT cu.id, cu.name, cu.email, cu.phone, cu.avatarUrl, cu.status, cu.lastLoginAt, cu.createdAt,
      (SELECT GROUP_CONCAT(CONCAT(t.id, ':', t.name, ':', COALESCE(t.color, '#6366f1')) SEPARATOR '|')
       FROM team_members tm JOIN teams t ON t.id = tm.teamId
       WHERE tm.userId = cu.id AND tm.tenantId = ${tenantId}
      ) AS teamsList,
      (SELECT COUNT(*) FROM conversation_assignments ca
       WHERE ca.assignedUserId = cu.id AND ca.tenantId = ${tenantId} AND ca.status IN ('open', 'pending')
      ) AS openAssignments
    FROM crm_users cu
    WHERE cu.tenantId = ${tenantId}
    ORDER BY cu.status ASC, cu.name ASC
  `);
  return (rows as unknown as any[]).map((r: any) => ({
    id: Number(r.id),
    name: String(r.name),
    email: String(r.email),
    phone: r.phone ? String(r.phone) : null,
    avatarUrl: r.avatarUrl ? String(r.avatarUrl) : null,
    status: String(r.status),
    lastLoginAt: r.lastLoginAt ? new Date(r.lastLoginAt).getTime() : null,
    createdAt: new Date(r.createdAt).getTime(),
    openAssignments: Number(r.openAssignments) || 0,
    teams: r.teamsList ? String(r.teamsList).split("|").map((t: string) => {
      const [id, name, color] = t.split(":");
      return { id: Number(id), name, color };
    }) : [],
  }));
}

export async function updateAgentStatus(tenantId: number, userId: number, status: "active" | "inactive" | "invited") {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    UPDATE crm_users SET status = ${status} WHERE id = ${userId} AND tenantId = ${tenantId}
  `);
}

// ════════════════════════════════════════════════════════════
// DISTRIBUTION RULES (CRUD)
// ════════════════════════════════════════════════════════════

export async function getDistributionRules(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  const [rows] = await db.execute(sql`
    SELECT dr.*, t.name AS teamName, t.color AS teamColor
    FROM distribution_rules dr
    LEFT JOIN teams t ON t.id = dr.teamId
    WHERE dr.tenantId = ${tenantId}
    ORDER BY dr.priority DESC, dr.createdAt ASC
  `);
  return (rows as unknown as any[]).map((r: any) => ({
    id: Number(r.id),
    tenantId: Number(r.tenantId),
    name: String(r.name),
    description: r.description ? String(r.description) : null,
    strategy: String(r.strategy),
    teamId: r.teamId ? Number(r.teamId) : null,
    teamName: r.teamName ? String(r.teamName) : null,
    teamColor: r.teamColor ? String(r.teamColor) : null,
    isActive: Boolean(r.isActive),
    isDefault: Boolean(r.isDefault),
    priority: Number(r.priority),
    configJson: r.configJson || null,
    createdAt: new Date(r.createdAt).getTime(),
    updatedAt: new Date(r.updatedAt).getTime(),
  }));
}

export async function createDistributionRule(tenantId: number, data: {
  name: string;
  description?: string;
  strategy: "round_robin" | "least_busy" | "manual" | "team_round_robin";
  teamId?: number | null;
  isActive?: boolean;
  isDefault?: boolean;
  priority?: number;
  configJson?: any;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // If this is set as default, unset other defaults
  if (data.isDefault) {
    await db.execute(sql`UPDATE distribution_rules SET isDefault = false WHERE tenantId = ${tenantId}`);
  }
  
  const [result] = await db.execute(sql`
    INSERT INTO distribution_rules (tenantId, name, description, strategy, teamId, isActive, isDefault, priority, configJson)
    VALUES (${tenantId}, ${data.name}, ${data.description || null}, ${data.strategy}, ${data.teamId || null}, 
            ${data.isActive !== false}, ${data.isDefault || false}, ${data.priority || 0}, ${data.configJson ? JSON.stringify(data.configJson) : null})
  `);
  return { id: (result as any).insertId, tenantId, ...data };
}

export async function updateDistributionRule(id: number, tenantId: number, data: {
  name?: string;
  description?: string;
  strategy?: "round_robin" | "least_busy" | "manual" | "team_round_robin";
  teamId?: number | null;
  isActive?: boolean;
  isDefault?: boolean;
  priority?: number;
  configJson?: any;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // If this is set as default, unset other defaults
  if (data.isDefault) {
    await db.execute(sql`UPDATE distribution_rules SET isDefault = false WHERE tenantId = ${tenantId} AND id != ${id}`);
  }
  
  await db.execute(sql`
    UPDATE distribution_rules SET
      name = COALESCE(${data.name ?? null}, name),
      description = ${data.description !== undefined ? (data.description || null) : sql`description`},
      strategy = COALESCE(${data.strategy ?? null}, strategy),
      teamId = ${data.teamId !== undefined ? (data.teamId || null) : sql`teamId`},
      isActive = COALESCE(${data.isActive !== undefined ? data.isActive : null}, isActive),
      isDefault = COALESCE(${data.isDefault !== undefined ? data.isDefault : null}, isDefault),
      priority = COALESCE(${data.priority ?? null}, priority),
      configJson = ${data.configJson !== undefined ? (data.configJson ? JSON.stringify(data.configJson) : null) : sql`configJson`}
    WHERE id = ${id} AND tenantId = ${tenantId}
  `);
  return { id, ...data };
}

export async function deleteDistributionRule(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`DELETE FROM distribution_rules WHERE id = ${id} AND tenantId = ${tenantId}`);
}

export async function toggleDistributionRule(id: number, tenantId: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE distribution_rules SET isActive = ${isActive} WHERE id = ${id} AND tenantId = ${tenantId}`);
}


// ════════════════════════════════════════════════════════════
// CONTACT PROFILE & METRICS
// ════════════════════════════════════════════════════════════

export async function getContactMetrics(tenantId: number, contactId: number) {
  const db = await getDb();
  if (!db) return { totalDeals: 0, wonDeals: 0, totalSpentCents: 0, daysSinceLastPurchase: null };

  const rows = (await db.execute(sql`
    SELECT
      COUNT(*) as totalDeals,
      SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wonDeals,
      SUM(CASE WHEN status = 'won' THEN COALESCE(valueCents, 0) ELSE 0 END) as totalSpentCents,
      MAX(CASE WHEN status = 'won' THEN updatedAt ELSE NULL END) as lastPurchaseDate
    FROM deals
    WHERE tenantId = ${tenantId} AND contactId = ${contactId}
  `)) as unknown as any[];

  const row = rows?.[0]?.[0] || {};
  const lastPurchaseDate = row.lastPurchaseDate ? new Date(row.lastPurchaseDate) : null;
  const daysSinceLastPurchase = lastPurchaseDate
    ? Math.floor((Date.now() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    totalDeals: Number(row.totalDeals || 0),
    wonDeals: Number(row.wonDeals || 0),
    totalSpentCents: Number(row.totalSpentCents || 0),
    daysSinceLastPurchase,
  };
}

export async function getContactDeals(tenantId: number, contactId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = (await db.execute(sql`
    SELECT
      d.id, d.title, d.status, d.valueCents, d.currency, d.probability,
      d.expectedCloseAt, d.createdAt, d.updatedAt, d.lastActivityAt,
      ps.name as stageName, p.name as pipelineName
    FROM deals d
    LEFT JOIN pipeline_stages ps ON ps.id = d.stageId AND ps.tenantId = ${tenantId}
    LEFT JOIN pipelines p ON p.id = d.pipelineId AND p.tenantId = ${tenantId}
    WHERE d.tenantId = ${tenantId} AND d.contactId = ${contactId}
    ORDER BY d.updatedAt DESC
  `)) as unknown as any[];

  return rows?.[0] || [];
}

// ════════════════════════════════════════════════════════════
// CUSTOM FIELDS CRUD
// ════════════════════════════════════════════════════════════

export async function listCustomFields(tenantId: number, entity: string) {
  const db = await getDb();
  if (!db) return [];

  const rows = (await db.execute(sql`
    SELECT * FROM custom_fields
    WHERE tenantId = ${tenantId} AND entity = ${entity}
    ORDER BY sortOrder ASC, id ASC
  `)) as unknown as any[];

  return rows?.[0] || [];
}

export async function getCustomFieldById(tenantId: number, id: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = (await db.execute(sql`
    SELECT * FROM custom_fields WHERE tenantId = ${tenantId} AND id = ${id} LIMIT 1
  `)) as unknown as any[];

  return rows?.[0]?.[0] || null;
}

export async function createCustomField(data: {
  tenantId: number; entity: string; name: string; label: string;
  fieldType: string; optionsJson?: any; defaultValue?: string;
  placeholder?: string; isRequired?: boolean; isVisibleOnForm?: boolean;
  isVisibleOnProfile?: boolean; sortOrder?: number; groupName?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  await db.execute(sql`
    INSERT INTO custom_fields (tenantId, entity, name, label, fieldType, optionsJson, defaultValue, placeholder, isRequired, isVisibleOnForm, isVisibleOnProfile, sortOrder, groupName)
    VALUES (
      ${data.tenantId}, ${data.entity}, ${data.name}, ${data.label}, ${data.fieldType},
      ${data.optionsJson ? JSON.stringify(data.optionsJson) : null},
      ${data.defaultValue || null}, ${data.placeholder || null},
      ${data.isRequired ?? false}, ${data.isVisibleOnForm ?? true},
      ${data.isVisibleOnProfile ?? true}, ${data.sortOrder ?? 0},
      ${data.groupName || null}
    )
  `);

  const rows = (await db.execute(sql`SELECT * FROM custom_fields WHERE tenantId = ${data.tenantId} AND name = ${data.name} AND entity = ${data.entity} ORDER BY id DESC LIMIT 1`)) as unknown as any[];
  return rows?.[0]?.[0] || null;
}

export async function updateCustomField(tenantId: number, id: number, data: {
  label?: string; fieldType?: string; optionsJson?: any; defaultValue?: string;
  placeholder?: string; isRequired?: boolean; isVisibleOnForm?: boolean;
  isVisibleOnProfile?: boolean; sortOrder?: number; groupName?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  await db.execute(sql`
    UPDATE custom_fields SET
      label = COALESCE(${data.label ?? null}, label),
      fieldType = COALESCE(${data.fieldType ?? null}, fieldType),
      optionsJson = ${data.optionsJson !== undefined ? (data.optionsJson ? JSON.stringify(data.optionsJson) : null) : sql`optionsJson`},
      defaultValue = ${data.defaultValue !== undefined ? data.defaultValue : sql`defaultValue`},
      placeholder = ${data.placeholder !== undefined ? data.placeholder : sql`placeholder`},
      isRequired = COALESCE(${data.isRequired !== undefined ? data.isRequired : null}, isRequired),
      isVisibleOnForm = COALESCE(${data.isVisibleOnForm !== undefined ? data.isVisibleOnForm : null}, isVisibleOnForm),
      isVisibleOnProfile = COALESCE(${data.isVisibleOnProfile !== undefined ? data.isVisibleOnProfile : null}, isVisibleOnProfile),
      sortOrder = COALESCE(${data.sortOrder ?? null}, sortOrder),
      groupName = ${data.groupName !== undefined ? data.groupName : sql`groupName`}
    WHERE id = ${id} AND tenantId = ${tenantId}
  `);

  return getCustomFieldById(tenantId, id);
}

export async function deleteCustomField(tenantId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  // Delete values first, then the field
  await db.execute(sql`DELETE FROM custom_field_values WHERE fieldId = ${id} AND tenantId = ${tenantId}`);
  await db.execute(sql`DELETE FROM custom_fields WHERE id = ${id} AND tenantId = ${tenantId}`);
}

export async function reorderCustomFields(tenantId: number, entity: string, orderedIds: number[]) {
  const db = await getDb();
  if (!db) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute(sql`UPDATE custom_fields SET sortOrder = ${i} WHERE id = ${orderedIds[i]} AND tenantId = ${tenantId} AND entity = ${entity}`);
  }
}

// ════════════════════════════════════════════════════════════
// CUSTOM FIELD VALUES
// ════════════════════════════════════════════════════════════

export async function getCustomFieldValues(tenantId: number, entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = (await db.execute(sql`
    SELECT cfv.*, cf.name as fieldName, cf.label as fieldLabel, cf.fieldType, cf.optionsJson, cf.isRequired, cf.isVisibleOnForm, cf.isVisibleOnProfile, cf.groupName
    FROM custom_field_values cfv
    JOIN custom_fields cf ON cf.id = cfv.fieldId AND cf.tenantId = cfv.tenantId
    WHERE cfv.tenantId = ${tenantId} AND cfv.entityType = ${entityType} AND cfv.entityId = ${entityId}
    ORDER BY cf.sortOrder ASC
  `)) as unknown as any[];

  return rows?.[0] || [];
}

export async function setCustomFieldValue(tenantId: number, fieldId: number, entityType: string, entityId: number, value: string | null) {
  const db = await getDb();
  if (!db) return;

  // Upsert: check if exists
  const existing = (await db.execute(sql`
    SELECT id FROM custom_field_values
    WHERE tenantId = ${tenantId} AND fieldId = ${fieldId} AND entityType = ${entityType} AND entityId = ${entityId}
    LIMIT 1
  `)) as unknown as any[];

  if (existing?.[0]?.[0]) {
    await db.execute(sql`
      UPDATE custom_field_values SET value = ${value}
      WHERE tenantId = ${tenantId} AND fieldId = ${fieldId} AND entityType = ${entityType} AND entityId = ${entityId}
    `);
  } else {
    await db.execute(sql`
      INSERT INTO custom_field_values (tenantId, fieldId, entityType, entityId, value)
      VALUES (${tenantId}, ${fieldId}, ${entityType}, ${entityId}, ${value})
    `);
  }
}

export async function setCustomFieldValues(tenantId: number, entityType: string, entityId: number, values: { fieldId: number; value: string | null }[]) {
  for (const v of values) {
    await setCustomFieldValue(tenantId, v.fieldId, entityType, entityId, v.value);
  }
}
