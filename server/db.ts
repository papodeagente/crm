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
      GROUP BY remoteJid
    ) latest ON m.remoteJid = latest.remoteJid AND m.id = latest.maxId
    WHERE m.sessionId = ${sessionId}
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
