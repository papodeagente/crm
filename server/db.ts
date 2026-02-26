import { eq, desc, and, or, like, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, whatsappSessions, waMessages as messages, activityLogs, chatbotSettings } from "../drizzle/schema";
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

export async function upsertChatbotSettings(sessionId: string, enabled: boolean, systemPrompt?: string, maxTokens?: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await getChatbotSettings(sessionId);
  if (existing) {
    await db
      .update(chatbotSettings)
      .set({ enabled, systemPrompt: systemPrompt ?? existing.systemPrompt, maxTokens: maxTokens ?? existing.maxTokens })
      .where(eq(chatbotSettings.sessionId, sessionId));
  } else {
    await db.insert(chatbotSettings).values({
      sessionId,
      enabled,
      systemPrompt: systemPrompt || "Você é um assistente virtual amigável e prestativo. Responda de forma concisa e educada em português.",
      maxTokens: maxTokens || 500,
    });
  }
}
