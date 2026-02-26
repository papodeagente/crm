import { eq, desc, and, or, like, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, whatsappSessions, waMessages as messages, activityLogs, chatbotSettings, chatbotRules } from "../drizzle/schema";
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
  // Get distinct remoteJids with last message info + pushName from most recent non-fromMe message
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
      ) AS unreadCount,
      (
        SELECT COUNT(*) FROM messages m3 
        WHERE m3.sessionId = ${sessionId} 
        AND m3.remoteJid = m.remoteJid
      ) AS totalMessages
    FROM messages m
    INNER JOIN (
      SELECT remoteJid, MAX(id) AS maxId
      FROM messages
      WHERE sessionId = ${sessionId}
      AND remoteJid NOT LIKE '%@g.us'
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
