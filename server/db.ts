import { eq, desc, and, or, like, lt, gt, isNotNull, isNull, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import { InsertUser, users, whatsappSessions, waMessages as messages, activityLogs, chatbotSettings, chatbotRules, conversationAssignments, crmUsers, teams, teamMembers, distributionRules, customFields, customFieldValues, waConversations, userPreferences, sessionShares, conversationEvents, internalNotes, quickReplies, waContacts, aiIntegrations, aiTrainingConfigs, tenants, conversationLocks, waReactions, conversationTags, waConversationTagLinks, scheduledMessages } from "../drizzle/schema";
import { ENV } from './_core/env';
import { normalizeJid } from "./phoneUtils";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Convert timestamp strings from db.execute() to Date objects.
 * node-postgres may return TIMESTAMP columns as strings like "2026-03-16 15:07:00" (UTC).
 * Without conversion, browsers parse these as local time (missing Z suffix), causing timezone offset.
 * Converting to Date objects lets superjson serialize them with type metadata,
 * so the frontend receives proper Date objects that are timezone-aware.
 */
/**
 * `db.execute(sql\`...\`)` from drizzle-orm/node-postgres returns the raw pg
 * QueryResult `{ rows, rowCount, fields, ... }` for raw SQL, NOT an array.
 * This helper unwraps to rows safely.
 */
export function rowsOf<T = any>(result: any): T[] {
  return Array.isArray(result) ? result : (result?.rows ?? []);
}

function fixTimestampFields(rows: any[]): any[] {
  const tsFields = ['lastTimestamp', 'lastMessageAt', 'queuedAt', 'firstResponseAt', 'slaDeadlineAt', 'waitingSince', 'oldestEntry'];
  return rows.map((row: any) => {
    const r = { ...row };
    for (const field of tsFields) {
      if (r[field] && typeof r[field] === 'string') {
        const str = r[field];
        r[field] = new Date(str.includes('T') || str.endsWith('Z') ? str : str.replace(' ', 'T') + 'Z');
      }
    }
    return r;
  });
}

/** Deduplicate conversation rows by remoteJid, keeping the one with newest lastTimestamp */
function dedupConversations(rows: any[]): any[] {
  if (rows.length === 0) return rows;
  const map = new Map<string, any>();
  for (const row of rows) {
    const jid = row.remoteJid;
    if (!jid) continue;
    const existing = map.get(jid);
    if (!existing) {
      map.set(jid, row);
    } else {
      const existingTs = existing.lastTimestamp ? new Date(existing.lastTimestamp).getTime() : 0;
      const newTs = row.lastTimestamp ? new Date(row.lastTimestamp).getTime() : 0;
      if (newTs > existingTs) map.set(jid, row);
    }
  }
  return Array.from(map.values());
}

let _autoLinkTriggerInstalled = false;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle({
        connection: process.env.DATABASE_URL,
      });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }

  // ── Auto-link de mensagens em deals abertos via trigger Postgres ──
  // Cobre TODOS os INSERTs em "messages" (in + out) sem precisar editar callsites.
  // Trata 9º dígito brasileiro: candidata `com 9` (11) e `sem 9` (10) do nacional.
  // Defensivo: EXCEPTION WHEN OTHERS THEN RETURN NEW — nunca quebra INSERT da mensagem.
  if (_db && !_autoLinkTriggerInstalled) {
    _autoLinkTriggerInstalled = true;
    _db.execute(sql`
      CREATE OR REPLACE FUNCTION trg_auto_link_message_to_deals_fn()
      RETURNS TRIGGER AS $$
      DECLARE
        jid_digits TEXT;
        national TEXT;
        candidate_a TEXT;
        candidate_b TEXT;
        effective_tenant INTEGER;
      BEGIN
        IF NEW."remoteJid" IS NULL THEN RETURN NEW; END IF;

        jid_digits := REGEXP_REPLACE(SPLIT_PART(NEW."remoteJid", '@', 1), '[^0-9]', '', 'g');
        IF LENGTH(jid_digits) < 10 THEN RETURN NEW; END IF;

        IF LEFT(jid_digits, 2) = '55' AND LENGTH(jid_digits) >= 12 THEN
          national := SUBSTRING(jid_digits, 3);
        ELSE
          national := jid_digits;
        END IF;

        candidate_a := NULL;
        candidate_b := NULL;
        IF LENGTH(national) = 11 AND SUBSTRING(national, 3, 1) = '9' THEN
          candidate_a := national;
          candidate_b := SUBSTRING(national, 1, 2) || SUBSTRING(national, 4);
        ELSIF LENGTH(national) = 10 THEN
          candidate_b := national;
          candidate_a := SUBSTRING(national, 1, 2) || '9' || SUBSTRING(national, 3);
        ELSE
          candidate_a := RIGHT(national, 11);
        END IF;

        IF NEW."tenantId" IS NOT NULL AND NEW."tenantId" > 0 THEN
          effective_tenant := NEW."tenantId";
        ELSE
          SELECT "tenantId" INTO effective_tenant
          FROM whatsapp_sessions WHERE "sessionId" = NEW."sessionId" LIMIT 1;
        END IF;
        IF effective_tenant IS NULL THEN RETURN NEW; END IF;

        INSERT INTO deal_message_links ("tenantId", "dealId", "messageDbId", "linkedBy")
        SELECT effective_tenant, d.id, NEW.id, 'auto'
        FROM deals d
        INNER JOIN contacts c ON c.id = d."contactId"
        WHERE d."tenantId" = effective_tenant
          AND d.status = 'open'
          AND (
            (candidate_a IS NOT NULL AND c."phoneLast11" = candidate_a)
            OR (candidate_b IS NOT NULL AND c."phoneLast11" = candidate_b)
          )
        ON CONFLICT ("dealId", "messageDbId") DO NOTHING;

        RETURN NEW;
      EXCEPTION WHEN OTHERS THEN
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `).catch((e: any) => console.warn("[Migration] auto-link trigger fn:", e?.message));
    _db.execute(sql`DROP TRIGGER IF EXISTS trg_auto_link_message_to_deals ON "messages"`).catch(() => {});
    _db.execute(sql`
      CREATE TRIGGER trg_auto_link_message_to_deals
      AFTER INSERT ON "messages"
      FOR EACH ROW EXECUTE FUNCTION trg_auto_link_message_to_deals_fn()
    `).catch((e: any) => console.warn("[Migration] auto-link trigger:", e?.message));
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

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
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
  return db.select().from(whatsappSessions).where(
    and(eq(whatsappSessions.userId, userId), sql`${whatsappSessions.status} != 'deleted'`)
  );
}

export async function getSessionsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(whatsappSessions).where(
    and(eq(whatsappSessions.tenantId, tenantId), sql`${whatsappSessions.status} != 'deleted'`)
  );
}

export async function getSessionBySessionId(sessionId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(whatsappSessions).where(eq(whatsappSessions.sessionId, sessionId)).limit(1);
  return result[0] || null;
}

/**
 * Validate that a session belongs to the given user.
 * Returns the session if valid, throws TRPCError FORBIDDEN if not.
 * 
 * Access rules:
 * - SaaS users can only access their own sessions (userId match)
 * - CRM admins can access any session in their tenant
 * - Platform owner (non-SaaS Manus OAuth) can access all sessions
 */
export async function validateSessionOwnership(
  sessionId: string,
  userId: number,
  opts?: { tenantId?: number; role?: string; isSaasUser?: boolean },
  _getSession?: typeof getSessionBySessionId
): Promise<void> {
  if (!sessionId) return; // No session to validate
  
  // Platform owner (Manus OAuth, non-SaaS) has full access
  if (!opts?.isSaasUser) return;
  
  const fetchSession = _getSession || getSessionBySessionId;
  const session = await fetchSession(sessionId);
  if (!session) return; // Session doesn't exist, let downstream handle
  
  // CRM admin can access any session in their tenant
  if (opts?.role === 'admin' && opts?.tenantId && session.tenantId === opts.tenantId) return;
  
  // Cross-tenant check: even admins cannot access sessions from other tenants
  if (opts?.tenantId && session.tenantId && session.tenantId !== opts.tenantId) {
    console.warn(`[SECURITY] User ${userId} (tenant ${opts.tenantId}) attempted cross-tenant access to session ${sessionId} (tenant ${session.tenantId})`);
    const { TRPCError } = await import('@trpc/server');
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Você não tem permissão para acessar esta sessão do WhatsApp.',
    });
  }

  // Regular user: must own the session OR have an active share
  if (session.userId !== userId) {
    // Check if user has an active session share for this session
    const hasShare = await hasActiveShareForSession(
      opts?.tenantId || session.tenantId || 0,
      userId,
      sessionId,
    );
    if (hasShare) return; // User has a valid share, allow access

    console.warn(`[SECURITY] User ${userId} attempted to access session ${sessionId} owned by user ${session.userId}`);
    const { TRPCError } = await import('@trpc/server');
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Você não tem permissão para acessar esta sessão do WhatsApp.',
    });
  }
}

// Messages
export async function getMessages(sessionId: string, limit = 50, beforeId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(messages.sessionId, sessionId)];
  if (beforeId) {
    conditions.push(lt(messages.id, beforeId));
  }
  return db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.timestamp))
    .limit(limit);
}

export async function getMessagesByContact(sessionId: string, remoteJid: string, limit = 50, beforeId?: number) {
  const db = await getDb();
  if (!db) return [];
  // Get all JID variants to fetch messages stored under either format
  const { getAllJidVariants } = await import("./phoneUtils");
  const jidVariants = getAllJidVariants(remoteJid);
  
  const conditions: any[] = [
    eq(messages.sessionId, sessionId),
    jidVariants.length === 1
      ? eq(messages.remoteJid, jidVariants[0])
      : or(...jidVariants.map(jid => eq(messages.remoteJid, jid))),
  ];
  if (beforeId) {
    conditions.push(lt(messages.id, beforeId));
  }
  return db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.timestamp))
    .limit(limit);
}

// Reactions
export async function getReactionsForMessages(sessionId: string, messageIds: string[]) {
  const db = await getDb();
  if (!db || messageIds.length === 0) return [];
  return db
    .select()
    .from(waReactions)
    .where(and(
      eq(waReactions.sessionId, sessionId),
      inArray(waReactions.targetMessageId, messageIds),
    ));
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
// Uses normalization to merge conversations that differ only by 9th digit
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
  
  // JIDs are now pre-normalized in the database (migration applied),
  // so we can use simple GROUP BY without expensive CASE WHEN expressions
  const result = await db.execute(sql`
    SELECT 
      m."remoteJid",
      m.content AS lastMessage,
      m."messageType" AS lastMessageType,
      m."fromMe" AS lastFromMe,
      m.timestamp AS lastTimestamp,
      m.status AS lastStatus,
      (
        SELECT m4."pushName" FROM messages m4 
        WHERE m4."sessionId" = ${sessionId} 
        AND m4."remoteJid" = m."remoteJid"
        AND m4."fromMe" = false
        AND m4."pushName" IS NOT NULL 
        AND m4."pushName" != ''
        ORDER BY m4.id DESC LIMIT 1
      ) AS contactPushName,
      (
        SELECT COUNT(*) FROM messages m2 
        WHERE m2."sessionId" = ${sessionId} 
        AND m2."remoteJid" = m."remoteJid"
        AND m2."fromMe" = false
        AND (m2.status IS NULL OR m2.status = 'received')
        AND m2."messageType" NOT IN (${sql.raw(skipTypesSQL)})
      ) AS unreadCount,
      (
        SELECT COUNT(*) FROM messages m3 
        WHERE m3."sessionId" = ${sessionId} 
        AND m3."remoteJid" = m."remoteJid"
        AND m3."messageType" NOT IN (${sql.raw(skipTypesSQL)})
      ) AS totalMessages
    FROM messages m
    INNER JOIN (
      SELECT "remoteJid", MAX(id) AS maxId
      FROM messages
      WHERE "sessionId" = ${sessionId}
      AND "remoteJid" NOT LIKE '%@g.us'
      AND "remoteJid" != 'status@broadcast'
      AND "messageType" NOT IN (${sql.raw(skipTypesSQL)})
      GROUP BY "remoteJid"
    ) latest ON m."remoteJid" = latest."remoteJid" AND m.id = latest.maxId
    WHERE m."sessionId" = ${sessionId}
    AND m."remoteJid" NOT LIKE '%@g.us'
    AND m."remoteJid" != 'status@broadcast'
    ORDER BY m.timestamp DESC
  `);
  
  const rows = rowsOf(result);
  return dedupConversations(fixTimestampFields(rows));
}

// Mark conversation as read (handles both JID variants)
export async function markConversationRead(sessionId: string, remoteJid: string) {
  const db = await getDb();
  if (!db) return;
  // Normalize the JID and get all variants to mark all messages as read
  const { getAllJidVariants } = await import("./phoneUtils");
  const jidVariants = getAllJidVariants(remoteJid);
  
  for (const jid of jidVariants) {
    await db.update(messages)
      .set({ status: "read" })
      .where(and(
        eq(messages.sessionId, sessionId),
        eq(messages.remoteJid, jid),
        eq(messages.fromMe, false)
      ));
  }
  // Also update unreadCount in wa_conversations
  const { waConversations } = await import("../drizzle/schema");
  for (const jid of jidVariants) {
    await db.update(waConversations)
      .set({ unreadCount: 0 })
      .where(and(
        eq(waConversations.sessionId, sessionId),
        eq(waConversations.remoteJid, jid)
      ));
  }
}


// ─── Conversation Assignments (Multi-Agent) ───

export async function getOrCreateAssignment(tenantId: number, sessionId: string, remoteJid: string) {
  const db = await getDb();
  if (!db) return null;
  // Normalize JID to canonical format to prevent duplicate assignments
  const normalizedJid = normalizeJid(remoteJid);
  
  // Also check for the non-normalized variant in case it was stored before normalization
  const { getAllJidVariants } = await import("./phoneUtils");
  const jidVariants = getAllJidVariants(normalizedJid);
  
  // Search for existing assignment with any variant
  for (const jid of jidVariants) {
    const existing = await db.select().from(conversationAssignments)
      .where(and(
        eq(conversationAssignments.tenantId, tenantId),
        eq(conversationAssignments.sessionId, sessionId),
        eq(conversationAssignments.remoteJid, jid)
      )).limit(1);
    if (existing.length > 0) return existing[0];
  }
  
  // Auto-create assignment with normalized JID
  await db.insert(conversationAssignments).values({ tenantId, sessionId, remoteJid: normalizedJid, status: "open" });
  const created = await db.select().from(conversationAssignments)
    .where(and(
      eq(conversationAssignments.tenantId, tenantId),
      eq(conversationAssignments.sessionId, sessionId),
      eq(conversationAssignments.remoteJid, normalizedJid)
    )).limit(1);
  return created[0] || null;
}

export async function assignConversation(tenantId: number, sessionId: string, remoteJid: string, assignedUserId: number | null, assignedTeamId?: number | null, assignedByUserId?: number) {
  const db = await getDb();
  if (!db) return null;
  // Get previous assignment for event logging
  const prev = await getOrCreateAssignment(tenantId, sessionId, remoteJid);
  const updateData: any = { assignedUserId, lastAssignedAt: new Date() };
  if (assignedTeamId !== undefined) updateData.assignedTeamId = assignedTeamId;
  await db.update(conversationAssignments)
    .set(updateData)
    .where(and(
      eq(conversationAssignments.tenantId, tenantId),
      eq(conversationAssignments.sessionId, sessionId),
      eq(conversationAssignments.remoteJid, remoteJid)
    ));
  // Denormalize to wa_conversations
  const wcUpdate: any = { assignedUserId, queuedAt: assignedUserId ? null : undefined };
  if (assignedTeamId !== undefined) wcUpdate.assignedTeamId = assignedTeamId;
  await db.update(waConversations)
    .set(wcUpdate)
    .where(and(
      eq(waConversations.tenantId, tenantId),
      eq(waConversations.sessionId, sessionId),
      eq(waConversations.remoteJid, remoteJid)
    ));
  // Log event
  const waConv = await db.select({ id: waConversations.id }).from(waConversations)
    .where(and(eq(waConversations.tenantId, tenantId), eq(waConversations.sessionId, sessionId), eq(waConversations.remoteJid, remoteJid)))
    .limit(1);
  if (waConv.length > 0) {
    const isTransfer = prev && prev.assignedUserId && assignedUserId && prev.assignedUserId !== assignedUserId;
    await db.insert(conversationEvents).values({
      tenantId,
      waConversationId: waConv[0].id,
      sessionId,
      remoteJid,
      eventType: isTransfer ? "transferred" : "assigned",
      fromUserId: prev?.assignedUserId || assignedByUserId || undefined,
      toUserId: assignedUserId || undefined,
      fromTeamId: prev?.assignedTeamId || undefined,
      toTeamId: assignedTeamId || undefined,
    });
  }
  return getOrCreateAssignment(tenantId, sessionId, remoteJid);
}

export async function updateAssignmentStatus(tenantId: number, sessionId: string, remoteJid: string, status: "open" | "pending" | "resolved" | "closed", userId?: number) {
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
  // Denormalize status to wa_conversations
  await db.update(waConversations)
    .set({ status })
    .where(and(
      eq(waConversations.tenantId, tenantId),
      eq(waConversations.sessionId, sessionId),
      eq(waConversations.remoteJid, remoteJid)
    ));
  // Log event
  const waConv = await db.select({ id: waConversations.id }).from(waConversations)
    .where(and(eq(waConversations.tenantId, tenantId), eq(waConversations.sessionId, sessionId), eq(waConversations.remoteJid, remoteJid)))
    .limit(1);
  if (waConv.length > 0) {
    const eventType = status === "resolved" ? "resolved" as const : status === "closed" ? "closed" as const : status === "open" ? "reopened" as const : "assigned" as const;
    await db.insert(conversationEvents).values({
      tenantId,
      waConversationId: waConv[0].id,
      sessionId,
      remoteJid,
      eventType,
      fromUserId: userId || undefined,
      metadata: { status },
    });
  }
}

export async function finishAttendance(tenantId: number, sessionId: string, remoteJid: string, userId: number) {
  const db = await getDb();
  if (!db) return;
  console.log(`[finishAttendance] START tenantId=${tenantId} sessionId=${sessionId} remoteJid=${remoteJid} userId=${userId}`);
  
  // Normalize the JID to match what's stored in the DB
  const normalizedJid = normalizeJid(remoteJid);
  // Try both the raw JID and normalized JID
  const jidVariants = [remoteJid];
  if (normalizedJid !== remoteJid) jidVariants.push(normalizedJid);
  
  // Set assignment status to resolved (try all JID variants)
  for (const jid of jidVariants) {
    const caResult = await db.update(conversationAssignments)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(and(
        eq(conversationAssignments.tenantId, tenantId),
        eq(conversationAssignments.sessionId, sessionId),
        eq(conversationAssignments.remoteJid, jid)
      ));
    const caAffected = (caResult as any).rowCount ?? 0;
    if (caAffected > 0) {
      console.log(`[finishAttendance] conversation_assignments resolved: ${caAffected} rows (jid: ${jid})`);
      break;
    }
  }
  
  // Clear assignedUserId and set status on wa_conversations so it leaves "Meus Chats"
  let wcAffected = 0;
  for (const jid of jidVariants) {
    const wcResult = await db.update(waConversations)
      .set({ assignedUserId: null, assignedTeamId: null, status: "resolved", queuedAt: null })
      .where(and(
        eq(waConversations.tenantId, tenantId),
        eq(waConversations.sessionId, sessionId),
        eq(waConversations.remoteJid, jid)
      ));
    wcAffected = (wcResult as any).rowCount ?? 0;
    if (wcAffected > 0) {
      console.log(`[finishAttendance] wa_conversations resolved: ${wcAffected} rows (jid: ${jid})`);
      break;
    }
  }
  
  // Fallback: if no rows matched by exact JID, try by phone digits
  if (wcAffected === 0) {
    const jidDigits = remoteJid.replace(/@.*$/, '').replace(/\D/g, '');
    console.log(`[finishAttendance] WARNING: 0 rows matched by exact JID, trying digits fallback: ${jidDigits}`);
    if (jidDigits) {
      // Find the conversation by phone digits
      const matchByDigits = await db.select({ id: waConversations.id, remoteJid: waConversations.remoteJid })
        .from(waConversations)
        .where(and(
          eq(waConversations.tenantId, tenantId),
          eq(waConversations.sessionId, sessionId),
          sql`("phoneDigits" = ${jidDigits} OR "phoneLast11" = ${jidDigits.slice(-11)})`
        ))
        .limit(1);
      if (matchByDigits.length > 0) {
        const matchedJid = matchByDigits[0].remoteJid;
        console.log(`[finishAttendance] Found by digits: id=${matchByDigits[0].id} jid=${matchedJid}`);
        await db.update(waConversations)
          .set({ assignedUserId: null, assignedTeamId: null, status: "resolved", queuedAt: null })
          .where(eq(waConversations.id, matchByDigits[0].id));
        // Also update assignment
        await db.update(conversationAssignments)
          .set({ status: "resolved", resolvedAt: new Date() })
          .where(and(
            eq(conversationAssignments.tenantId, tenantId),
            eq(conversationAssignments.sessionId, sessionId),
            eq(conversationAssignments.remoteJid, matchedJid)
          ));
      }
    }
  }
  
  // Log event
  const waConv = await db.select({ id: waConversations.id }).from(waConversations)
    .where(and(
      eq(waConversations.tenantId, tenantId),
      eq(waConversations.sessionId, sessionId),
      or(...jidVariants.map(jid => eq(waConversations.remoteJid, jid)))
    ))
    .limit(1);
  if (waConv.length > 0) {
    await db.insert(conversationEvents).values({
      tenantId,
      waConversationId: waConv[0].id,
      sessionId,
      remoteJid,
      eventType: "resolved" as const,
      fromUserId: userId,
      metadata: { action: "finish_attendance" },
    });
  }
  console.log(`[finishAttendance] DONE for ${remoteJid}`);
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

// Round-robin assignment: get next agent for a tenant
export async function getNextRoundRobinAgent(tenantId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  // Get all active + available agents (Disponível toggle)
  const agents = await db.select({ id: crmUsers.id }).from(crmUsers)
    .where(and(eq(crmUsers.tenantId, tenantId), eq(crmUsers.status, "active"), eq(crmUsers.isAvailable, true)));
  if (agents.length === 0) return null;
  // Get the agent with the fewest open assignments
  const result = await db.execute(sql`
    SELECT cu.id, COUNT(ca.id) as "assignmentCount"
    FROM crm_users cu
    LEFT JOIN conversation_assignments ca
      ON ca."assignedUserId" = cu.id
      AND ca."tenantId" = ${tenantId}
      AND ca.status IN ('open', 'pending')
    WHERE cu."tenantId" = ${tenantId} AND cu.status = 'active' AND cu."isAvailable" = true
    GROUP BY cu.id
    ORDER BY "assignmentCount" ASC, cu.id ASC
    LIMIT 1
  `);
  const rows = rowsOf(result);
  return rows?.[0]?.id || null;
}

// ─── Dashboard Metrics ───

export async function getDashboardMetrics(tenantId: number, userId?: number, pipelineId?: number, dealStatus?: string, dateFrom?: string, dateTo?: string) {
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

  // Date range filter for deals, contacts, service deliveries, tasks
  const dealDateFilter = dateFrom || dateTo
    ? sql`${dateFrom ? sql`AND d_inner.createdAt >= ${new Date(dateFrom + "T00:00:00")}` : sql``} ${dateTo ? sql`AND d_inner.createdAt <= ${new Date(dateTo + "T23:59:59")}` : sql``}`
    : sql``;
  const contactDateFilter = dateFrom || dateTo
    ? sql`${dateFrom ? sql`AND c.createdAt >= ${new Date(dateFrom + "T00:00:00")}` : sql``} ${dateTo ? sql`AND c.createdAt <= ${new Date(dateTo + "T23:59:59")}` : sql``}`
    : sql``;
  const taskDateFilter = dateFrom || dateTo
    ? sql`${dateFrom ? sql`AND createdAt >= ${new Date(dateFrom + "T00:00:00")}` : sql``} ${dateTo ? sql`AND createdAt <= ${new Date(dateTo + "T23:59:59")}` : sql``}`
    : sql``;

  // Owner filter: if userId provided, filter deals/contacts/tasks by owner
  const ownerFilter = userId ? sql`AND d_inner."ownerUserId" = ${userId}` : sql``;
  const contactOwnerFilter = userId ? sql`AND "ownerUserId" = ${userId}` : sql``;
  const taskAssigneeFilter = userId ? sql`AND "assignedToUserId" = ${userId}` : sql``;
  // Pipeline filter: if pipelineId provided, filter by specific pipeline; otherwise by type 'sales'
  const pipelineFilter = pipelineId
    ? sql`AND d_inner."pipelineId" = ${pipelineId}`
    : sql``;
  const pipelineJoin = pipelineId
    ? sql`JOIN pipelines p ON p.id = d_inner."pipelineId"`
    : sql`JOIN pipelines p ON p.id = d_inner."pipelineId" AND p."pipelineType" = 'sales'`;
  // Deal status filter: 'open' (em andamento), 'won' (ganho), 'lost' (perdido), or undefined/all
  const statusFilter = dealStatus === 'won'
    ? sql`AND d_inner.status = 'won'`
    : dealStatus === 'lost'
      ? sql`AND d_inner.status = 'lost'`
      : dealStatus === 'all'
        ? sql`AND d_inner."deletedAt" IS NULL`
        : sql`AND d_inner.status = 'open'`;

  const result = await db.execute(sql`
    SELECT
      -- Deals filtered by status
      (SELECT COUNT(*) FROM deals d_inner
        ${pipelineJoin}
        WHERE d_inner."tenantId" = ${tenantId} AND d_inner."deletedAt" IS NULL ${statusFilter} ${pipelineFilter} ${ownerFilter} ${dealDateFilter}) AS activeDeals,
      -- Deals created last 30 days
      (SELECT COUNT(*) FROM deals d_inner
        ${pipelineJoin}
        WHERE d_inner."tenantId" = ${tenantId} AND d_inner."deletedAt" IS NULL ${statusFilter} ${pipelineFilter} ${ownerFilter} ${dealDateFilter}
        AND d_inner."createdAt" >= ${thirtyDaysAgo}) AS dealsLast30,
      -- Deals created previous 30 days
      (SELECT COUNT(*) FROM deals d_inner
        ${pipelineJoin}
        WHERE d_inner."tenantId" = ${tenantId} AND d_inner."deletedAt" IS NULL ${statusFilter} ${pipelineFilter} ${ownerFilter} ${dealDateFilter}
        AND d_inner."createdAt" >= ${sixtyDaysAgo} AND d_inner."createdAt" < ${thirtyDaysAgo}) AS dealsPrev30,

      -- Total unique contacts in user's portfolio
      (SELECT COUNT(DISTINCT c.id) FROM contacts c
        WHERE c."tenantId" = ${tenantId} AND c."deletedAt" IS NULL ${contactOwnerFilter} ${contactDateFilter}) AS totalContacts,
      -- Contacts added last 30 days
      (SELECT COUNT(DISTINCT c.id) FROM contacts c
        WHERE c."tenantId" = ${tenantId} AND c."deletedAt" IS NULL ${contactOwnerFilter} ${contactDateFilter}
        AND c."createdAt" >= ${thirtyDaysAgo}) AS contactsLast30,
      -- Contacts added previous 30 days
      (SELECT COUNT(DISTINCT c.id) FROM contacts c
        WHERE c."tenantId" = ${tenantId} AND c."deletedAt" IS NULL ${contactOwnerFilter} ${contactDateFilter}
        AND c."createdAt" >= ${sixtyDaysAgo} AND c."createdAt" < ${thirtyDaysAgo}) AS contactsPrev30,

      -- Active service deliveries: deals in post_sale pipeline EXCEPT stages where name contains 'finalizada' or "isWon"=true
      (SELECT COUNT(*) FROM deals d_inner
        JOIN pipelines p ON p.id = d_inner."pipelineId" AND p."pipelineType" = 'post_sale'
        JOIN pipeline_stages ps ON ps.id = d_inner."stageId"
        WHERE d_inner."tenantId" = ${tenantId} AND d_inner.status = 'open' AND d_inner."deletedAt" IS NULL
        AND ps."isWon" = false AND ps."isLost" = false
        AND LOWER(ps.name) NOT LIKE '%finalizada%'
        ${ownerFilter} ${dealDateFilter}) AS activeServiceDeliveries,
      -- Service deliveries last 30 days
      (SELECT COUNT(*) FROM deals d_inner
        JOIN pipelines p ON p.id = d_inner."pipelineId" AND p."pipelineType" = 'post_sale'
        JOIN pipeline_stages ps ON ps.id = d_inner."stageId"
        WHERE d_inner."tenantId" = ${tenantId} AND d_inner.status = 'open' AND d_inner."deletedAt" IS NULL
        AND ps."isWon" = false AND ps."isLost" = false
        AND LOWER(ps.name) NOT LIKE '%finalizada%'
        ${ownerFilter} ${dealDateFilter}
        AND d_inner."createdAt" >= ${thirtyDaysAgo}) AS serviceDeliveriesLast30,
      -- Service deliveries previous 30 days
      (SELECT COUNT(*) FROM deals d_inner
        JOIN pipelines p ON p.id = d_inner."pipelineId" AND p."pipelineType" = 'post_sale'
        JOIN pipeline_stages ps ON ps.id = d_inner."stageId"
        WHERE d_inner."tenantId" = ${tenantId} AND d_inner.status = 'open' AND d_inner."deletedAt" IS NULL
        AND ps."isWon" = false AND ps."isLost" = false
        AND LOWER(ps.name) NOT LIKE '%finalizada%'
        ${ownerFilter} ${dealDateFilter}
        AND d_inner."createdAt" >= ${sixtyDaysAgo} AND d_inner."createdAt" < ${thirtyDaysAgo}) AS serviceDeliveriesPrev30,

      -- Pending tasks for user
      (SELECT COUNT(*) FROM crm_tasks WHERE "tenantId" = ${tenantId} AND status IN ('pending', 'in_progress') ${taskAssigneeFilter} ${taskDateFilter}) AS pendingTasks,
      -- Tasks last 30 days
      (SELECT COUNT(*) FROM crm_tasks WHERE "tenantId" = ${tenantId} AND status IN ('pending', 'in_progress') ${taskAssigneeFilter} ${taskDateFilter}
        AND "createdAt" >= ${thirtyDaysAgo}) AS tasksLast30,
      -- Tasks previous 30 days
      (SELECT COUNT(*) FROM crm_tasks WHERE "tenantId" = ${tenantId} AND status IN ('pending', 'in_progress') ${taskAssigneeFilter} ${taskDateFilter}
        AND "createdAt" >= ${sixtyDaysAgo} AND "createdAt" < ${thirtyDaysAgo}) AS tasksPrev30,

      -- Total deal value filtered by status
      (SELECT COALESCE(SUM(d_inner."valueCents"), 0) FROM deals d_inner
        ${pipelineJoin}
        WHERE d_inner."tenantId" = ${tenantId} AND d_inner."deletedAt" IS NULL ${statusFilter} ${pipelineFilter} ${ownerFilter} ${dealDateFilter}) AS totalDealValueCents
  `);

  const row = rowsOf(result)[0] || {};

  function calcChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  return {
    activeDeals: Number(row.activeDeals) || 0,
    activeDealsChange: calcChange(Number(row.dealsLast30) || 0, Number(row.dealsPrev30) || 0),
    totalContacts: Number(row.totalContacts) || 0,
    totalContactsChange: calcChange(Number(row.contactsLast30) || 0, Number(row.contactsPrev30) || 0),
    activeTrips: Number(row.activeServiceDeliveries) || 0,
    activeTripsChange: calcChange(Number(row.serviceDeliveriesLast30) || 0, Number(row.serviceDeliveriesPrev30) || 0),
    pendingTasks: Number(row.pendingTasks) || 0,
    pendingTasksChange: calcChange(Number(row.tasksLast30) || 0, Number(row.tasksPrev30) || 0),
    totalDealValueCents: Number(row.totalDealValueCents) || 0,
  };
}

// ─── Pipeline Summary for Dashboard ───

export async function getPipelineSummary(tenantId: number, userId?: number, pipelineId?: number, dealStatus?: string, dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  if (!db) return [];

  const ownerFilter = userId ? sql`AND d."ownerUserId" = ${userId}` : sql``;
  const dateFilter = dateFrom || dateTo
    ? sql`${dateFrom ? sql`AND d.createdAt >= ${new Date(dateFrom + "T00:00:00")}` : sql``} ${dateTo ? sql`AND d.createdAt <= ${new Date(dateTo + "T23:59:59")}` : sql``}`
    : sql``;
  // If pipelineId provided, filter by specific pipeline; otherwise by type 'sales'
  const pipelineCondition = pipelineId
    ? sql`AND p.id = ${pipelineId}`
    : sql`AND p."pipelineType" = 'sales'`;
  // Deal status filter for pipeline summary
  const statusFilter = dealStatus === 'won'
    ? sql`AND d.status = 'won'`
    : dealStatus === 'lost'
      ? sql`AND d.status = 'lost'`
      : dealStatus === 'all'
        ? sql`AND d."deletedAt" IS NULL`
        : sql`AND d.status = 'open'`;

  const rows = await db.execute(sql`
    SELECT
      ps.id AS stageId,
      ps.name AS stageName,
      ps.color AS stageColor,
      ps."orderIndex",
      ps."isWon",
      ps."isLost",
      COUNT(d.id) AS dealCount,
      COALESCE(SUM(d."valueCents"), 0) AS totalValueCents
    FROM pipeline_stages ps
    JOIN pipelines p ON p.id = ps."pipelineId" ${pipelineCondition}
    LEFT JOIN deals d ON d."stageId" = ps.id AND d."tenantId" = ${tenantId} AND d."deletedAt" IS NULL ${statusFilter} ${ownerFilter} ${dateFilter}
    WHERE ps."tenantId" = ${tenantId}
    GROUP BY ps.id, ps.name, ps.color, ps."orderIndex", ps."isWon", ps."isLost"
    ORDER BY ps."orderIndex" ASC
  `);

  return rowsOf(rows).map((r: any) => ({
    stageId: Number(r.stageId),
    stageName: String(r.stageName),
    stageColor: r.stageColor ? String(r.stageColor) : null,
    orderIndex: Number(r.orderIndex),
    isWon: Boolean(Number(r.isWon)),
    isLost: Boolean(Number(r.isLost)),
    dealCount: Number(r.dealCount) || 0,
    totalValueCents: Number(r.totalValueCents) || 0,
  }));
}

// ─── Recent Activity for Dashboard ───

export async function getRecentActivity(tenantId: number, limit = 8, dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  if (!db) return [];

  const dateConditions = [];
  if (dateFrom) dateConditions.push(sql`AND "createdAt" >= ${new Date(dateFrom + "T00:00:00")}`);
  if (dateTo) dateConditions.push(sql`AND "createdAt" <= ${new Date(dateTo + "T23:59:59")}`);
  const dateFilter = dateConditions.length > 0 ? sql.join(dateConditions, sql` `) : sql``;

  const rows = await db.execute(sql`
    SELECT id, "dealId", action, description, "fromStageName", "toStageName",
           "actorName", "createdAt"
    FROM deal_history
    WHERE "tenantId" = ${tenantId} ${dateFilter}
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `);

  return rowsOf(rows).map((r: any) => ({
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

export async function getUpcomingTasks(tenantId: number, userId?: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const assigneeFilter = userId ? sql`AND t."assignedToUserId" = ${userId}` : sql``;

  // Get today's start and end for "focus of the day" in SP timezone
  const now = new Date();
  const nowSP = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const todayStart = new Date(nowSP.getFullYear(), nowSP.getMonth(), nowSP.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Tasks that are: (1) due today and open/in_progress, OR (2) overdue (past due, still open)
  const rows = await db.execute(sql`
    SELECT t.id, t.title, t."dueAt", t.priority, t.status,
           t."entityType", t."entityId", t."taskType"
    FROM crm_tasks t
    WHERE t."tenantId" = ${tenantId}
      AND t.status IN ('pending', 'in_progress')
      ${assigneeFilter}
      AND (
        (t."dueAt" >= ${todayStart} AND t."dueAt" < ${todayEnd})
        OR (t."dueAt" < ${now} AND t."dueAt" IS NOT NULL)
        OR (t."dueAt" IS NULL)
      )
    ORDER BY
      CASE
        WHEN t."dueAt" < ${now} AND t."dueAt" IS NOT NULL THEN 0
        WHEN t."dueAt" IS NOT NULL THEN 1
        ELSE 2
      END ASC,
      t."dueAt" ASC,
      CASE t.priority
        WHEN 'urgent' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END ASC
    LIMIT ${limit}
  `);

  return rowsOf(rows).map((r: any) => ({
    id: Number(r.id),
    title: String(r.title),
    dueAt: r.dueAt ? new Date(r.dueAt).getTime() : null,
    priority: String(r.priority) as "low" | "medium" | "high" | "urgent",
    status: String(r.status),
    entityType: String(r.entityType),
    entityId: Number(r.entityId),
    taskType: r.taskType ? String(r.taskType) : "task",
    isOverdue: r.dueAt ? new Date(r.dueAt).getTime() < now.getTime() : false,
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
  const contactRows = await db.execute(sql`
    SELECT id, name, email, phone, type, "lifecycleStage"
    FROM contacts
    WHERE "tenantId" = ${tenantId}
      AND (name LIKE ${searchTerm} OR email LIKE ${searchTerm} OR phone LIKE ${searchTerm})
    ORDER BY "updatedAt" DESC
    LIMIT ${limit}
  `);

  // Search deals (title)
  const dealRows = await db.execute(sql`
    SELECT d.id, d.title, d."valueCents", d.status,
           ps.name AS stageName
    FROM deals d
    LEFT JOIN pipeline_stages ps ON ps.id = d."stageId"
    WHERE d."tenantId" = ${tenantId}
      AND d.title LIKE ${searchTerm}
    ORDER BY d."updatedAt" DESC
    LIMIT ${limit}
  `);

  // Search tasks (title)
  const taskRows = await db.execute(sql`
    SELECT id, title, "dueAt", priority, status, "entityType", "entityId"
    FROM crm_tasks
    WHERE "tenantId" = ${tenantId}
      AND title LIKE ${searchTerm}
    ORDER BY "updatedAt" DESC
    LIMIT ${limit}
  `);

  const contacts = rowsOf(contactRows).map((r: any) => ({
    id: Number(r.id),
    name: String(r.name),
    email: r.email ? String(r.email) : null,
    phone: r.phone ? String(r.phone) : null,
    type: String(r.type) as "person" | "company",
    lifecycleStage: String(r.lifecycleStage),
  }));

  const deals = rowsOf(dealRows).map((r: any) => ({
    id: Number(r.id),
    title: String(r.title),
    valueCents: Number(r.valueCents) || 0,
    status: String(r.status),
    stageName: r.stageName ? String(r.stageName) : null,
  }));

  const tasks = rowsOf(taskRows).map((r: any) => ({
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

/**
 * Global search with visibility filtering.
 * ownerIds arrays restrict results to records owned by those users.
 * If undefined, no restriction (geral mode).
 */
export async function globalSearchWithVisibility(
  tenantId: number,
  query: string,
  limit = 5,
  visibility: {
    dealOwnerIds?: number[];
    contactOwnerIds?: number[];
  }
) {
  const db = await getDb();
  if (!db || !query.trim()) {
    return { contacts: [], deals: [], tasks: [] };
  }

  const searchTerm = `%${query.trim()}%`;

  // Build contact owner filter
  const contactOwnerClause = visibility.contactOwnerIds && visibility.contactOwnerIds.length > 0
    ? sql`AND "ownerUserId" IN (${sql.join(visibility.contactOwnerIds.map(id => sql`${id}`), sql`, `)})`
    : sql``;

  const contactRows = await db.execute(sql`
    SELECT id, name, email, phone, type, "lifecycleStage"
    FROM contacts
    WHERE "tenantId" = ${tenantId}
      AND (name LIKE ${searchTerm} OR email LIKE ${searchTerm} OR phone LIKE ${searchTerm})
      ${contactOwnerClause}
    ORDER BY "updatedAt" DESC
    LIMIT ${limit}
  `);

  // Build deal owner filter
  const dealOwnerClause = visibility.dealOwnerIds && visibility.dealOwnerIds.length > 0
    ? sql`AND d."ownerUserId" IN (${sql.join(visibility.dealOwnerIds.map(id => sql`${id}`), sql`, `)})`
    : sql``;

  const dealRows = await db.execute(sql`
    SELECT d.id, d.title, d."valueCents", d.status,
           ps.name AS stageName
    FROM deals d
    LEFT JOIN pipeline_stages ps ON ps.id = d."stageId"
    WHERE d."tenantId" = ${tenantId}
      AND d.title LIKE ${searchTerm}
      ${dealOwnerClause}
    ORDER BY d."updatedAt" DESC
    LIMIT ${limit}
  `);

  const taskRows = await db.execute(sql`
    SELECT id, title, "dueAt", priority, status, "entityType", "entityId"
    FROM crm_tasks
    WHERE "tenantId" = ${tenantId}
      AND title LIKE ${searchTerm}
    ORDER BY "updatedAt" DESC
    LIMIT ${limit}
  `);

  const contacts = rowsOf(contactRows).map((r: any) => ({
    id: Number(r.id),
    name: String(r.name),
    email: r.email ? String(r.email) : null,
    phone: r.phone ? String(r.phone) : null,
    type: String(r.type) as "person" | "company",
    lifecycleStage: String(r.lifecycleStage),
  }));

  const deals = rowsOf(dealRows).map((r: any) => ({
    id: Number(r.id),
    title: String(r.title),
    valueCents: Number(r.valueCents) || 0,
    status: String(r.status),
    stageName: r.stageName ? String(r.stageName) : null,
  }));

  const tasks = rowsOf(taskRows).map((r: any) => ({
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

  const result = await db.execute(sql`
    INSERT INTO notifications ("tenantId", type, title, body, "entityType", "entityId")
    VALUES (${tenantId}, ${data.type}, ${data.title}, ${data.body || null}, ${data.entityType || null}, ${data.entityId || null})
  `);

  return result;
}

export async function getNotifications(tenantId: number, opts?: { onlyUnread?: boolean; limit?: number; beforeId?: number }) {
  const db = await getDb();
  if (!db) return [];

  const limit = opts?.limit ?? 50;
  const cursorClause = opts?.beforeId ? sql`AND id < ${opts.beforeId}` : sql``;

  let rows: any;
  if (opts?.onlyUnread) {
    rows = await db.execute(sql`
      SELECT id, "tenantId", type, title, body, "entityType", "entityId", "isRead", "createdAt"
      FROM notifications
      WHERE "tenantId" = ${tenantId} AND "isRead" = false ${cursorClause}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `);
  } else {
    rows = await db.execute(sql`
      SELECT id, "tenantId", type, title, body, "entityType", "entityId", "isRead", "createdAt"
      FROM notifications
      WHERE "tenantId" = ${tenantId} ${cursorClause}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `);
  }

  return rowsOf(rows).map((r: any) => ({
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

  const rows = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM notifications
    WHERE "tenantId" = ${tenantId} AND "isRead" = false
  `);

  return Number(rowsOf(rows)[0]?.cnt) || 0;
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`
    UPDATE notifications SET "isRead" = true WHERE id = ${id}
  `);
}

export async function markAllNotificationsRead(tenantId: number) {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`
    UPDATE notifications SET "isRead" = true WHERE "tenantId" = ${tenantId} AND "isRead" = false
  `);
}


// ════════════════════════════════════════════════════════════
// TEAM MANAGEMENT (CRUD)
// ════════════════════════════════════════════════════════════

export async function createTeam(tenantId: number, data: { name: string; description?: string; color?: string; maxMembers?: number }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.execute(sql`
    INSERT INTO teams ("tenantId", name, description, color, "maxMembers")
    VALUES (${tenantId}, ${data.name}, ${data.description || null}, ${data.color || "#6366f1"}, ${data.maxMembers || 50})
    RETURNING id
  `);
  const insertId = rowsOf(result)[0]?.id;
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
      "maxMembers" = COALESCE(${data.maxMembers ?? null}, "maxMembers")
    WHERE id = ${id} AND "tenantId" = ${tenantId}
  `);
  return { id, ...data };
}

export async function deleteTeam(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) return;
  // Remove all team members first
  await db.execute(sql`DELETE FROM team_members WHERE "teamId" = ${id} AND "tenantId" = ${tenantId}`);
  // Remove distribution rules linked to this team
  await db.execute(sql`UPDATE distribution_rules SET "teamId" = NULL WHERE "teamId" = ${id} AND "tenantId" = ${tenantId}`);
  // Delete the team
  await db.execute(sql`DELETE FROM teams WHERE id = ${id} AND "tenantId" = ${tenantId}`);
}

export async function getTeamWithMembers(teamId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  const teamRows = await db.execute(sql`
    SELECT id, "tenantId", name, description, color, "maxMembers", "createdAt", "updatedAt"
    FROM teams WHERE id = ${teamId} AND "tenantId" = ${tenantId} LIMIT 1
  `);
  const team = rowsOf(teamRows)[0];
  if (!team) return null;
  
  const memberRows = await db.execute(sql`
    SELECT tm.id AS membershipId, tm."userId", tm.role, tm."createdAt",
           cu.name, cu.email, cu."avatarUrl", cu.status
    FROM team_members tm
    JOIN crm_users cu ON cu.id = tm."userId"
    WHERE tm."teamId" = ${teamId} AND tm."tenantId" = ${tenantId}
    ORDER BY tm.role DESC, cu.name ASC
  `);
  
  return {
    ...team,
    members: rowsOf(memberRows).map((m: any) => ({
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
  const existing = await db.execute(sql`
    SELECT id FROM team_members WHERE "tenantId" = ${tenantId} AND "teamId" = ${teamId} AND "userId" = ${userId} LIMIT 1
  `);
  if (rowsOf(existing).length > 0) return { alreadyMember: true };
  
  const result = await db.execute(sql`
    INSERT INTO team_members ("tenantId", "teamId", "userId", role)
    VALUES (${tenantId}, ${teamId}, ${userId}, ${role})
    RETURNING id
  `);
  return { id: rowsOf(result)[0]?.id, tenantId, teamId, userId, role };
}

export async function removeTeamMember(tenantId: number, teamId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    DELETE FROM team_members WHERE "tenantId" = ${tenantId} AND "teamId" = ${teamId} AND "userId" = ${userId}
  `);
}

export async function updateTeamMemberRole(tenantId: number, teamId: number, userId: number, role: "member" | "leader") {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    UPDATE team_members SET role = ${role}
    WHERE "tenantId" = ${tenantId} AND "teamId" = ${teamId} AND "userId" = ${userId}
  `);
}

// ════════════════════════════════════════════════════════════
// AGENT MANAGEMENT (extended)
// ════════════════════════════════════════════════════════════

export async function getAgentsWithTeams(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT cu.id, cu.name, cu.email, cu.phone, cu."avatarUrl", cu.status, cu.crm_user_role, cu."lastLoginAt", cu."createdAt",
      (SELECT STRING_AGG(t.id || ':' || t.name || ':' || COALESCE(t.color, '#6366f1'), '|')
       FROM team_members tm JOIN teams t ON t.id = tm."teamId"
       WHERE tm."userId" = cu.id AND tm."tenantId" = ${tenantId}
      ) AS "teamsList",
      (SELECT COUNT(*) FROM conversation_assignments ca
       WHERE ca."assignedUserId" = cu.id AND ca."tenantId" = ${tenantId} AND ca.status IN ('open', 'pending')
      ) AS "openAssignments"
    FROM crm_users cu
    WHERE cu."tenantId" = ${tenantId}
    ORDER BY cu.status ASC, cu.name ASC
  `);
  return rowsOf(rows).map((r: any) => ({
    id: Number(r.id),
    name: String(r.name),
    email: String(r.email),
    phone: r.phone ? String(r.phone) : null,
    avatarUrl: r.avatarUrl ? String(r.avatarUrl) : null,
    status: String(r.status),
    role: String(r.crm_user_role || "user"),
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
    UPDATE crm_users SET status = ${status} WHERE id = ${userId} AND "tenantId" = ${tenantId}
  `);
}

// ════════════════════════════════════════════════════════════
// DISTRIBUTION RULES (CRUD)
// ════════════════════════════════════════════════════════════

export async function getDistributionRules(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT dr.*, t.name AS teamName, t.color AS teamColor
    FROM distribution_rules dr
    LEFT JOIN teams t ON t.id = dr."teamId"
    WHERE dr."tenantId" = ${tenantId}
    ORDER BY dr.priority DESC, dr."createdAt" ASC
  `);
  return rowsOf(rows).map((r: any) => ({
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
    await db.execute(sql`UPDATE distribution_rules SET "isDefault" = false WHERE "tenantId" = ${tenantId}`);
  }
  
  const result = await db.execute(sql`
    INSERT INTO distribution_rules ("tenantId", name, description, strategy, "teamId", "isActive", "isDefault", priority, "configJson")
    VALUES (${tenantId}, ${data.name}, ${data.description || null}, ${data.strategy}, ${data.teamId || null},
            ${data.isActive !== false}, ${data.isDefault || false}, ${data.priority || 0}, ${data.configJson ? JSON.stringify(data.configJson) : null})
    RETURNING id
  `);
  return { id: rowsOf(result)[0]?.id, tenantId, ...data };
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
    await db.execute(sql`UPDATE distribution_rules SET "isDefault" = false WHERE "tenantId" = ${tenantId} AND id != ${id}`);
  }
  
  await db.execute(sql`
    UPDATE distribution_rules SET
      name = COALESCE(${data.name ?? null}, name),
      description = ${data.description !== undefined ? (data.description || null) : sql`description`},
      strategy = COALESCE(${data.strategy ?? null}, strategy),
      "teamId" = ${data.teamId !== undefined ? (data.teamId || null) : sql`teamId`},
      "isActive" = COALESCE(${data.isActive !== undefined ? data.isActive : null}, "isActive"),
      "isDefault" = COALESCE(${data.isDefault !== undefined ? data.isDefault : null}, "isDefault"),
      priority = COALESCE(${data.priority ?? null}, priority),
      "configJson" = ${data.configJson !== undefined ? (data.configJson ? JSON.stringify(data.configJson) : null) : sql`configJson`}
    WHERE id = ${id} AND "tenantId" = ${tenantId}
  `);
  return { id, ...data };
}

export async function deleteDistributionRule(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`DELETE FROM distribution_rules WHERE id = ${id} AND "tenantId" = ${tenantId}`);
}

export async function toggleDistributionRule(id: number, tenantId: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE distribution_rules SET "isActive" = ${isActive} WHERE id = ${id} AND "tenantId" = ${tenantId}`);
}


// ════════════════════════════════════════════════════════════
// CONTACT PROFILE & METRICS
// ════════════════════════════════════════════════════════════

export async function getContactMetrics(tenantId: number, contactId: number) {
  const db = await getDb();
  if (!db) return { totalDeals: 0, wonDeals: 0, totalSpentCents: 0, daysSinceLastPurchase: null };

  const rows = rowsOf(await db.execute(sql`
    SELECT
      COUNT(*) as totalDeals,
      SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wonDeals,
      SUM(CASE WHEN status = 'won' THEN COALESCE("valueCents", 0) ELSE 0 END) as totalSpentCents,
      MAX(CASE WHEN status = 'won' THEN "updatedAt" ELSE NULL END) as lastPurchaseDate
    FROM deals
    WHERE "tenantId" = ${tenantId} AND "contactId" = ${contactId}
  `));

  const row = rows[0] || {};
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

/**
 * Métricas comerciais agregadas do contato — KPIs para a aba "Negociações".
 * Cobre volume, receita, conversão, ticket médio, ciclo de venda, recência.
 */
export async function getContactCommercialMetrics(tenantId: number, contactId: number) {
  const db = await getDb();
  if (!db) {
    return {
      totalDeals: 0,
      openDeals: 0,
      wonDeals: 0,
      lostDeals: 0,
      totalNegotiatedCents: 0,
      totalWonCents: 0,
      totalLostCents: 0,
      totalOpenCents: 0,
      conversionRate: null as number | null,
      avgTicketCents: null as number | null,
      avgSalesCycleDays: null as number | null,
      lastDealCreatedAt: null as string | null,
      lastWonAt: null as string | null,
      daysSinceLastDeal: null as number | null,
      daysSinceLastWon: null as number | null,
      lostByStage: [] as Array<{ stageName: string; count: number; valueCents: number }>,
    };
  }

  const aggRows = rowsOf(await db.execute(sql`
    SELECT
      COUNT(*)::int AS "totalDeals",
      COUNT(*) FILTER (WHERE status = 'open')::int AS "openDeals",
      COUNT(*) FILTER (WHERE status = 'won')::int AS "wonDeals",
      COUNT(*) FILTER (WHERE status = 'lost')::int AS "lostDeals",
      COALESCE(SUM("valueCents"), 0)::bigint AS "totalNegotiatedCents",
      COALESCE(SUM(CASE WHEN status = 'won' THEN "valueCents" ELSE 0 END), 0)::bigint AS "totalWonCents",
      COALESCE(SUM(CASE WHEN status = 'lost' THEN "valueCents" ELSE 0 END), 0)::bigint AS "totalLostCents",
      COALESCE(SUM(CASE WHEN status = 'open' THEN "valueCents" ELSE 0 END), 0)::bigint AS "totalOpenCents",
      MAX("createdAt") AS "lastDealCreatedAt",
      MAX(CASE WHEN status = 'won' THEN "updatedAt" END) AS "lastWonAt",
      AVG(CASE WHEN status = 'won' THEN EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400 END) AS "avgSalesCycleDays"
    FROM deals
    WHERE "tenantId" = ${tenantId} AND "contactId" = ${contactId} AND "deletedAt" IS NULL
  `));
  const a = aggRows[0] || {} as any;

  const lostByStageRows = rowsOf(await db.execute(sql`
    SELECT
      COALESCE(ps.name, 'Sem etapa') AS "stageName",
      COUNT(*)::int AS count,
      COALESCE(SUM(d."valueCents"), 0)::bigint AS "valueCents"
    FROM deals d
    LEFT JOIN pipeline_stages ps ON ps.id = d."stageId"
    WHERE d."tenantId" = ${tenantId} AND d."contactId" = ${contactId}
      AND d.status = 'lost' AND d."deletedAt" IS NULL
    GROUP BY ps.name
    ORDER BY count DESC, "valueCents" DESC
    LIMIT 5
  `));

  const wonDeals = Number(a.wonDeals || 0);
  const lostDeals = Number(a.lostDeals || 0);
  const decided = wonDeals + lostDeals;
  const conversionRate = decided > 0 ? wonDeals / decided : null;
  const avgTicketCents = wonDeals > 0 ? Math.round(Number(a.totalWonCents || 0) / wonDeals) : null;

  const lastDealCreatedAt = a.lastDealCreatedAt ? new Date(a.lastDealCreatedAt) : null;
  const lastWonAt = a.lastWonAt ? new Date(a.lastWonAt) : null;
  const daysSinceLastDeal = lastDealCreatedAt
    ? Math.floor((Date.now() - lastDealCreatedAt.getTime()) / 86_400_000)
    : null;
  const daysSinceLastWon = lastWonAt
    ? Math.floor((Date.now() - lastWonAt.getTime()) / 86_400_000)
    : null;

  return {
    totalDeals: Number(a.totalDeals || 0),
    openDeals: Number(a.openDeals || 0),
    wonDeals,
    lostDeals,
    totalNegotiatedCents: Number(a.totalNegotiatedCents || 0),
    totalWonCents: Number(a.totalWonCents || 0),
    totalLostCents: Number(a.totalLostCents || 0),
    totalOpenCents: Number(a.totalOpenCents || 0),
    conversionRate,
    avgTicketCents,
    avgSalesCycleDays: a.avgSalesCycleDays ? Math.round(Number(a.avgSalesCycleDays)) : null,
    lastDealCreatedAt: lastDealCreatedAt?.toISOString() ?? null,
    lastWonAt: lastWonAt?.toISOString() ?? null,
    daysSinceLastDeal,
    daysSinceLastWon,
    lostByStage: lostByStageRows.map((r: any) => ({
      stageName: String(r.stageName),
      count: Number(r.count),
      valueCents: Number(r.valueCents),
    })),
  };
}

export async function getContactDeals(tenantId: number, contactId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = rowsOf(await db.execute(sql`
    SELECT
      d.id, d.title, d.status, d."valueCents", d.currency, d.probability,
      d."expectedCloseAt", d."createdAt", d."updatedAt", d."lastActivityAt",
      ps.name as stageName, p.name as pipelineName
    FROM deals d
    LEFT JOIN pipeline_stages ps ON ps.id = d."stageId" AND ps."tenantId" = ${tenantId}
    LEFT JOIN pipelines p ON p.id = d."pipelineId" AND p."tenantId" = ${tenantId}
    WHERE d."tenantId" = ${tenantId} AND d."contactId" = ${contactId}
    ORDER BY d."updatedAt" DESC
  `));

  return rows;
}

// ════════════════════════════════════════════════════════════
// CUSTOM FIELDS CRUD
// ════════════════════════════════════════════════════════════

function parseOptionsJson(val: unknown): any[] | null {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.trim()) {
    try { return JSON.parse(val); } catch { return null; }
  }
  return null;
}

function normalizeCustomField(r: any) {
  return {
    ...r,
    optionsJson: parseOptionsJson(r.optionsJson),
    isRequired: !!r.isRequired,
    isVisibleOnForm: !!r.isVisibleOnForm,
    isVisibleOnProfile: !!r.isVisibleOnProfile,
  };
}

export async function listCustomFields(tenantId: number, entity: string) {
  const db = await getDb();
  if (!db) return [];

  const rows = rowsOf(await db.execute(sql`
    SELECT * FROM custom_fields
    WHERE "tenantId" = ${tenantId} AND entity = ${entity}
    ORDER BY "sortOrder" ASC, id ASC
  `));

  return rows.map(normalizeCustomField);
}

export async function getCustomFieldById(tenantId: number, id: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = rowsOf(await db.execute(sql`
    SELECT * FROM custom_fields WHERE "tenantId" = ${tenantId} AND id = ${id} LIMIT 1
  `));

  const row = rows[0] || null;
  return row ? normalizeCustomField(row) : null;
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
    INSERT INTO custom_fields ("tenantId", entity, name, label, "fieldType", "optionsJson", "defaultValue", placeholder, "isRequired", "isVisibleOnForm", "isVisibleOnProfile", "sortOrder", "groupName")
    VALUES (
      ${data.tenantId}, ${data.entity}, ${data.name}, ${data.label}, ${data.fieldType},
      ${data.optionsJson ? JSON.stringify(data.optionsJson) : null},
      ${data.defaultValue || null}, ${data.placeholder || null},
      ${data.isRequired ?? false}, ${data.isVisibleOnForm ?? true},
      ${data.isVisibleOnProfile ?? true}, ${data.sortOrder ?? 0},
      ${data.groupName || null}
    )
  `);

  const rows = rowsOf(await db.execute(sql`SELECT * FROM custom_fields WHERE "tenantId" = ${data.tenantId} AND name = ${data.name} AND entity = ${data.entity} ORDER BY id DESC LIMIT 1`));
  const row = rows[0] || null;
  return row ? normalizeCustomField(row) : null;
}

export async function updateCustomField(tenantId: number, id: number, data: {
  label?: string; fieldType?: string; optionsJson?: any; defaultValue?: string;
  placeholder?: string; isRequired?: boolean; isVisibleOnForm?: boolean;
  isVisibleOnProfile?: boolean; sortOrder?: number; groupName?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const optionsValue = data.optionsJson !== undefined
    ? (data.optionsJson ? (typeof data.optionsJson === 'string' ? data.optionsJson : JSON.stringify(data.optionsJson)) : null)
    : undefined;

  try {
    await db.execute(sql`
      UPDATE custom_fields SET
        label = COALESCE(${data.label ?? null}, label),
        "fieldType" = COALESCE(${data.fieldType ?? null}, "fieldType"),
        "optionsJson" = ${optionsValue !== undefined ? optionsValue : sql`optionsJson`},
        "defaultValue" = ${data.defaultValue !== undefined ? data.defaultValue : sql`defaultValue`},
        placeholder = ${data.placeholder !== undefined ? data.placeholder : sql`placeholder`},
        "isRequired" = COALESCE(${data.isRequired !== undefined ? (data.isRequired ? 1 : 0) : null}, "isRequired"),
        "isVisibleOnForm" = COALESCE(${data.isVisibleOnForm !== undefined ? (data.isVisibleOnForm ? 1 : 0) : null}, "isVisibleOnForm"),
        "isVisibleOnProfile" = COALESCE(${data.isVisibleOnProfile !== undefined ? (data.isVisibleOnProfile ? 1 : 0) : null}, "isVisibleOnProfile"),
        "sortOrder" = COALESCE(${data.sortOrder ?? null}, "sortOrder"),
        "groupName" = ${data.groupName !== undefined ? data.groupName : sql`groupName`}
      WHERE id = ${id} AND "tenantId" = ${tenantId}
    `);
  } catch (err) {
    console.error("[updateCustomField] SQL error:", err, { tenantId, id, data });
    throw err;
  }

  return getCustomFieldById(tenantId, id);
}

export async function deleteCustomField(tenantId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  // Delete values first, then the field
  await db.execute(sql`DELETE FROM custom_field_values WHERE "fieldId" = ${id} AND "tenantId" = ${tenantId}`);
  await db.execute(sql`DELETE FROM custom_fields WHERE id = ${id} AND "tenantId" = ${tenantId}`);
}

export async function reorderCustomFields(tenantId: number, entity: string, orderedIds: number[]) {
  const db = await getDb();
  if (!db) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute(sql`UPDATE custom_fields SET "sortOrder" = ${i} WHERE id = ${orderedIds[i]} AND "tenantId" = ${tenantId} AND entity = ${entity}`);
  }
}

// ════════════════════════════════════════════════════════════
// CUSTOM FIELD VALUES
// ════════════════════════════════════════════════════════════

export async function getCustomFieldValues(tenantId: number, entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = rowsOf(await db.execute(sql`
    SELECT cfv.*, cf.name as fieldName, cf.label as fieldLabel, cf."fieldType", cf."optionsJson", cf."isRequired", cf."isVisibleOnForm", cf."isVisibleOnProfile", cf."groupName"
    FROM custom_field_values cfv
    JOIN custom_fields cf ON cf.id = cfv."fieldId" AND cf."tenantId" = cfv."tenantId"
    WHERE cfv."tenantId" = ${tenantId} AND cfv."entityType" = ${entityType} AND cfv."entityId" = ${entityId}
    ORDER BY cf."sortOrder" ASC
  `));

  return rows.map(normalizeCustomField);
}

export async function setCustomFieldValue(tenantId: number, fieldId: number, entityType: string, entityId: number, value: string | null) {
  const db = await getDb();
  if (!db) return;

  // Upsert: check if exists
  const existing = rowsOf(await db.execute(sql`
    SELECT id FROM custom_field_values
    WHERE "tenantId" = ${tenantId} AND "fieldId" = ${fieldId} AND "entityType" = ${entityType} AND "entityId" = ${entityId}
    LIMIT 1
  `));

  if (existing[0]) {
    await db.execute(sql`
      UPDATE custom_field_values SET value = ${value}
      WHERE "tenantId" = ${tenantId} AND "fieldId" = ${fieldId} AND "entityType" = ${entityType} AND "entityId" = ${entityId}
    `);
  } else {
    await db.execute(sql`
      INSERT INTO custom_field_values ("tenantId", "fieldId", "entityType", "entityId", value)
      VALUES (${tenantId}, ${fieldId}, ${entityType}, ${entityId}, ${value})
    `);
  }
}

export async function setCustomFieldValues(tenantId: number, entityType: string, entityId: number, values: { fieldId: number; value: string | null }[]) {
  for (const v of values) {
    await setCustomFieldValue(tenantId, v.fieldId, entityType, entityId, v.value);
  }
}

// ════════════════════════════════════════════════════════════
// WA Conversations — Queries baseadas na tabela canônica
// ════════════════════════════════════════════════════════════

/**
 * Lista conversas usando wa_conversations como fonte primária.
 * Muito mais eficiente que agrupar messages por remoteJid.
 * Inclui dados de assignment (multi-agent).
 */
export async function getWaConversationsList(
  sessionId: string,
  tenantId: number,
  filter?: {
    assignedUserId?: number;
    assignedTeamId?: number;
    status?: string;
    unassignedOnly?: boolean;
    limit?: number;
    offset?: number;
    cursor?: string; // ISO timestamp for cursor-based pagination (preferred over offset)
  }
) {
  const db = await getDb();
  if (!db) return [];

  // ═══════════════════════════════════════════════════════════════════════
  // INSTANT INBOX: Single-table query — NO JOIN with wa_messages.
  // All preview data is pre-computed in wa_conversations at write time.
  // Target latency: < 15ms.
  // ═══════════════════════════════════════════════════════════════════════

  // Build assignment filter referencing wa_conversations directly (wc."assignedUserId")
  // since helpdesk fields are denormalized into wa_conversations
  let assignmentFilterWc = '';
  if (filter?.assignedUserId) {
    assignmentFilterWc += ` AND "assignedUserId" = ${filter.assignedUserId}`;
  }
  if (filter?.assignedTeamId) {
    assignmentFilterWc += ` AND "assignedTeamId" = ${filter.assignedTeamId}`;
  }
  if (filter?.status) {
    // status comes from a validated enum upstream; re-validate as defense-in-depth
    const allowed = new Set(["open", "pending", "resolved", "closed"]);
    if (allowed.has(filter.status)) {
      assignmentFilterWc += ` AND status = '${filter.status}'`;
    }
  }
  if (filter?.unassignedOnly) {
    assignmentFilterWc += ` AND "assignedUserId" IS NULL`;
  }

  // Optimized: subquery limits to N rows FIRST, then JOINs only those rows
  // This avoids JOINing 2000+ rows when we only need 100
  const result = await db.execute(sql`
    SELECT
      wc.id AS "conversationId",
      wc."sessionId",
      wc."remoteJid",
      wc."phoneE164",
      wc."contactId",
      wc."contactPushName",
      -- Quando lastMessagePreview está vazio/null (bug histórico em algumas convs),
      -- faz fallback pegando o conteúdo da mensagem mais recente.
      COALESCE(
        NULLIF(wc."lastMessagePreview", ''),
        (
          SELECT m.content FROM messages m
          WHERE m."sessionId" = wc."sessionId"
            AND m."remoteJid" = wc."remoteJid"
            AND m.content IS NOT NULL
            AND m.content <> ''
          ORDER BY m.timestamp DESC NULLS LAST, m.id DESC
          LIMIT 1
        )
      ) AS "lastMessage",
      wc."lastMessageType" AS "lastMessageType",
      wc."lastFromMe" AS "lastFromMe",
      wc."lastMessageAt" AS "lastTimestamp",
      wc."lastStatus" AS "lastStatus",
      wc."unreadCount",
      wc.status AS "conversationStatus",
      wc."conversationKey",
      wc."queuedAt",
      wc."firstResponseAt",
      wc."slaDeadlineAt",
      wc."assignedUserId" AS "assignedUserId",
      wc."assignedTeamId" AS "assignedTeamId",
      wc."isPinned",
      wc."isArchived",
      ca.status AS "assignmentStatus",
      ca.priority AS "assignmentPriority",
      agent.name AS "assignedAgentName",
      agent."avatarUrl" AS "assignedAgentAvatar",
      c.name AS "contactName",
      c.email AS "contactEmail",
      c.phone AS "contactPhone"
    FROM (
      SELECT wac.* FROM wa_conversations wac
      WHERE wac."sessionId" = ${sessionId}
      AND wac."tenantId" = ${tenantId}
      AND wac."mergedIntoId" IS NULL
      AND wac."isArchived" = false
      -- Exclude ghost conversations: convs that have no real message AND aren't explicitly assigned.
      -- A periodic backfill bulk-stamps lastMessageAt on contact-imported placeholders, so we
      -- can't trust that column alone — require either an actual message OR an explicit assignment.
      AND (
        EXISTS (SELECT 1 FROM messages m WHERE m."sessionId" = wac."sessionId" AND m."remoteJid" = wac."remoteJid")
        OR wac."assignedUserId" IS NOT NULL
      )
      ${sql.raw(assignmentFilterWc)}
      ${filter?.cursor ? sql`AND wac."lastMessageAt" < ${new Date(filter.cursor)}` : sql``}
      ORDER BY wac."isPinned" DESC, wac."lastMessageAt" DESC NULLS LAST, wac.id DESC
      LIMIT ${filter?.limit ?? 100}
      ${!filter?.cursor && (filter?.offset ?? 0) > 0 ? sql`OFFSET ${filter?.offset ?? 0}` : sql``}
    ) wc
    LEFT JOIN conversation_assignments ca
      ON ca."sessionId" = wc."sessionId"
      AND ca."remoteJid" = wc."remoteJid"
      AND ca."tenantId" = wc."tenantId"
    LEFT JOIN crm_users agent ON agent.id = wc."assignedUserId"
    LEFT JOIN contacts c ON c.id = wc."contactId"
    ORDER BY wc."isPinned" DESC, wc."lastMessageAt" DESC, wc.id DESC
  `);

  const rows = rowsOf(result);
  return dedupConversations(fixTimestampFields(rows));
}

/**
 * Busca mensagens por waConversationId (conversa canônica).
 * Garante que Inbox e Negociação exibam exatamente o mesmo thread.
 */
export async function getMessagesByConversationId(
  conversationId: number,
  limit = 50,
  beforeId?: number,
) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [
    eq(messages.waConversationId, conversationId),
  ];
  if (beforeId) {
    conditions.push(lt(messages.id, beforeId));
  }

  return db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.timestamp))
    .limit(limit);
}

/**
 * Marca conversa como lida via wa_conversations + messages.
 */
export async function markWaConversationReadDb(conversationId: number) {
  const db = await getDb();
  if (!db) return;

  // Zerar unreadCount na wa_conversations
  await db.update(waConversations)
    .set({ unreadCount: 0 })
    .where(eq(waConversations.id, conversationId));

  // Marcar mensagens como lidas
  await db.update(messages)
    .set({ status: "read" })
    .where(and(
      eq(messages.waConversationId, conversationId),
      eq(messages.fromMe, false),
    ));
}


// ════════════════════════════════════════════════════════════
// MESSAGE MONITORING METRICS
// ════════════════════════════════════════════════════════════

/**
 * Get message status distribution for a given period.
 * Returns counts for each status: sent, delivered, read, played, received, failed.
 */
export async function getMessageStatusMetrics(sessionId: string, periodDays: number = 7, dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  if (!db) return [];

  const dateCondition = dateFrom || dateTo
    ? sql`${dateFrom ? sql`AND timestamp >= ${new Date(dateFrom + "T00:00:00")}` : sql``} ${dateTo ? sql`AND timestamp <= ${new Date(dateTo + "T23:59:59")}` : sql``}`
    : sql`AND timestamp >= NOW() - INTERVAL '1 day' * ${periodDays}`;

  const result = await db.execute(sql`
    SELECT
      CASE
        WHEN "fromMe" = true THEN COALESCE(status, 'sent')
        ELSE 'received'
      END AS statusGroup,
      COUNT(*) AS count
    FROM messages
    WHERE "sessionId" = ${sessionId}
      ${dateCondition}
      AND "remoteJid" NOT LIKE '%@g.us'
      AND "remoteJid" != 'status@broadcast'
      AND "messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage','deviceSentMessage','bcallMessage','callLogMesssage','keepInChatMessage','encReactionMessage','editedMessage','viewOnceMessageV2Extension')
    GROUP BY statusGroup
    ORDER BY count DESC
  `);
  return rowsOf(result);
}

/**
 * Get message volume over time (hourly or daily buckets).
 * Returns sent/received counts per time bucket.
 */
export async function getMessageVolumeOverTime(sessionId: string, periodDays: number = 7, granularity: "hour" | "day" = "day", dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  if (!db) return [];

  const dateFormat = granularity === "hour" ? "YYYY-MM-DD HH24:00" : "YYYY-MM-DD";
  const dateCondition = dateFrom || dateTo
    ? sql`${dateFrom ? sql`AND timestamp >= ${new Date(dateFrom + "T00:00:00")}` : sql``} ${dateTo ? sql`AND timestamp <= ${new Date(dateTo + "T23:59:59")}` : sql``}`
    : sql`AND timestamp >= NOW() - INTERVAL '1 day' * ${periodDays}`;

  const result = await db.execute(sql`
    SELECT
      TO_CHAR(timestamp, ${dateFormat}) AS timeBucket,
      SUM(CASE WHEN "fromMe" = true THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN "fromMe" = false THEN 1 ELSE 0 END) AS received,
      COUNT(*) AS total
    FROM messages
    WHERE "sessionId" = ${sessionId}
      ${dateCondition}
      AND "remoteJid" NOT LIKE '%@g.us'
      AND "remoteJid" != 'status@broadcast'
      AND "messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage','deviceSentMessage','bcallMessage','callLogMesssage','keepInChatMessage','encReactionMessage','editedMessage','viewOnceMessageV2Extension')
    GROUP BY timeBucket
    ORDER BY timeBucket ASC
  `);
  return rowsOf(result);
}

/**
 * Get delivery rate metrics: percentage of sent messages that were delivered/read.
 */
export async function getDeliveryRateMetrics(sessionId: string, periodDays: number = 7, dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  if (!db) return null;

  const dateCondition = dateFrom || dateTo
    ? sql`${dateFrom ? sql`AND timestamp >= ${new Date(dateFrom + "T00:00:00")}` : sql``} ${dateTo ? sql`AND timestamp <= ${new Date(dateTo + "T23:59:59")}` : sql``}`
    : sql`AND timestamp >= NOW() - INTERVAL '1 day' * ${periodDays}`;

  const result = await db.execute(sql`
    SELECT
      COUNT(*) AS totalSent,
      SUM(CASE WHEN status IN ('delivered','read','played') THEN 1 ELSE 0 END) AS delivered,
      SUM(CASE WHEN status IN ('read','played') THEN 1 ELSE 0 END) AS readCount,
      SUM(CASE WHEN status = 'played' THEN 1 ELSE 0 END) AS played,
      SUM(CASE WHEN status = 'failed' OR status = 'error' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN status = 'sent' OR status IS NULL THEN 1 ELSE 0 END) AS pending
    FROM messages
    WHERE "sessionId" = ${sessionId}
      AND "fromMe" = true
      ${dateCondition}
      AND "remoteJid" NOT LIKE '%@g.us'
      AND "remoteJid" != 'status@broadcast'
      AND "messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage','deviceSentMessage','bcallMessage','callLogMesssage','keepInChatMessage','encReactionMessage','editedMessage','viewOnceMessageV2Extension')
  `);
  const rows = rowsOf(result);
  return rows[0] || null;
}

/**
 * Get recent message activity feed (latest messages with status info).
 */
export async function getRecentMessageActivity(sessionId: string, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT 
      m.id,
      m."messageId",
      m."remoteJid",
      m."fromMe",
      m."pushName",
      m."messageType",
      m.content,
      m.status,
      m.timestamp,
      m."senderAgentId"
    FROM messages m
    WHERE m."sessionId" = ${sessionId}
      AND m."remoteJid" NOT LIKE '%@g.us'
      AND m."remoteJid" != 'status@broadcast'
      AND m."messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage','deviceSentMessage','bcallMessage','callLogMesssage','keepInChatMessage','encReactionMessage','editedMessage','viewOnceMessageV2Extension')
    ORDER BY m.timestamp DESC
    LIMIT ${limit}
  `);
  return rowsOf(result);
}

/**
 * Get message type distribution for the period.
 */
export async function getMessageTypeDistribution(sessionId: string, periodDays: number = 7, dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  if (!db) return [];

  const dateCondition = dateFrom || dateTo
    ? sql`${dateFrom ? sql`AND timestamp >= ${new Date(dateFrom + "T00:00:00")}` : sql``} ${dateTo ? sql`AND timestamp <= ${new Date(dateTo + "T23:59:59")}` : sql``}`
    : sql`AND timestamp >= NOW() - INTERVAL '1 day' * ${periodDays}`;

  const result = await db.execute(sql`
    SELECT
      "messageType",
      COUNT(*) AS count,
      SUM(CASE WHEN "fromMe" = true THEN 1 ELSE 0 END) AS sentCount,
      SUM(CASE WHEN "fromMe" = false THEN 1 ELSE 0 END) AS receivedCount
    FROM messages
    WHERE "sessionId" = ${sessionId}
      ${dateCondition}
      AND "remoteJid" NOT LIKE '%@g.us'
      AND "remoteJid" != 'status@broadcast'
      AND "messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage','deviceSentMessage','bcallMessage','callLogMesssage','keepInChatMessage','encReactionMessage','editedMessage','viewOnceMessageV2Extension')
    GROUP BY "messageType"
    ORDER BY count DESC
  `);
  return rowsOf(result);
}

/**
 * Get top contacts by message volume.
 */
export async function getTopContactsByVolume(sessionId: string, periodDays: number = 7, limit: number = 10, dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  if (!db) return [];

  const dateCondition = dateFrom || dateTo
    ? sql`${dateFrom ? sql`AND m.timestamp >= ${new Date(dateFrom + "T00:00:00")}` : sql``} ${dateTo ? sql`AND m.timestamp <= ${new Date(dateTo + "T23:59:59")}` : sql``}`
    : sql`AND m.timestamp >= NOW() - INTERVAL '1 day' * ${periodDays}`;

  const result = await db.execute(sql`
    SELECT
      m."remoteJid",
      (
        SELECT m2."pushName" FROM messages m2
        WHERE m2."sessionId" = ${sessionId}
        AND m2."remoteJid" = m."remoteJid"
        AND m2."fromMe" = false
        AND m2."pushName" IS NOT NULL
        AND m2."pushName" != ''
        ORDER BY m2.id DESC LIMIT 1
      ) AS contactName,
      COUNT(*) AS totalMessages,
      SUM(CASE WHEN m."fromMe" = true THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN m."fromMe" = false THEN 1 ELSE 0 END) AS received,
      MAX(m.timestamp) AS lastActivity
    FROM messages m
    WHERE m."sessionId" = ${sessionId}
      ${dateCondition}
      AND m."remoteJid" NOT LIKE '%@g.us'
      AND m."remoteJid" != 'status@broadcast'
      AND m."messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage','deviceSentMessage','bcallMessage','callLogMesssage','keepInChatMessage','encReactionMessage','editedMessage','viewOnceMessageV2Extension')
    GROUP BY m."remoteJid"
    ORDER BY totalMessages DESC
    LIMIT ${limit}
  `);
  return rowsOf(result);
}

/**
 * Get response time metrics (average time between received and first reply).
 */
export async function getResponseTimeMetrics(sessionId: string, periodDays: number = 7, dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  if (!db) return null;

  const inDateCondition = dateFrom || dateTo
    ? sql`${dateFrom ? sql`AND m_in.timestamp >= ${new Date(dateFrom + "T00:00:00")}` : sql``} ${dateTo ? sql`AND m_in.timestamp <= ${new Date(dateTo + "T23:59:59")}` : sql``}`
    : sql`AND m_in.timestamp >= NOW() - INTERVAL '1 day' * ${periodDays}`;

  const result = await db.execute(sql`
    SELECT
      COUNT(*) AS totalConversations,
      AVG(response_time_seconds) AS avgResponseTimeSec,
      MIN(response_time_seconds) AS minResponseTimeSec,
      MAX(response_time_seconds) AS maxResponseTimeSec,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_seconds) AS medianResponseTimeSec
    FROM (
      SELECT
        m_in."remoteJid",
        m_in.id AS inbound_id,
        m_in.timestamp AS inbound_time,
        MIN(m_out.timestamp) AS first_reply_time,
        EXTRACT(EPOCH FROM (MIN(m_out.timestamp) - m_in.timestamp))::int AS response_time_seconds
      FROM messages m_in
      INNER JOIN messages m_out ON m_out."sessionId" = m_in."sessionId"
        AND m_out."remoteJid" = m_in."remoteJid"
        AND m_out."fromMe" = true
        AND m_out.timestamp > m_in.timestamp
        AND m_out.timestamp <= m_in.timestamp + INTERVAL '24 hours'
      WHERE m_in."sessionId" = ${sessionId}
        AND m_in."fromMe" = false
        ${inDateCondition}
        AND m_in."remoteJid" NOT LIKE '%@g.us'
        AND m_in."remoteJid" != 'status@broadcast'
      GROUP BY m_in."remoteJid", m_in.id, m_in.timestamp
    ) response_data
  `);
  const rows = rowsOf(result);
  return rows[0] || null;
}


// ═══ USER PREFERENCES ═══

export async function getUserPreference(userId: number, tenantId: number, prefKey: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(userPreferences)
    .where(and(
      eq(userPreferences.userId, userId),
      eq(userPreferences.tenantId, tenantId),
      eq(userPreferences.prefKey, prefKey),
    ))
    .limit(1);
  return rows[0]?.prefValue ?? null;
}

export async function setUserPreference(userId: number, tenantId: number, prefKey: string, prefValue: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Upsert: try update first, then insert
  const existing = await db.select({ id: userPreferences.id }).from(userPreferences)
    .where(and(
      eq(userPreferences.userId, userId),
      eq(userPreferences.tenantId, tenantId),
      eq(userPreferences.prefKey, prefKey),
    ))
    .limit(1);
  if (existing.length > 0) {
    await db.update(userPreferences)
      .set({ prefValue })
      .where(eq(userPreferences.id, existing[0].id));
  } else {
    await db.insert(userPreferences).values({ userId, tenantId, prefKey, prefValue });
  }
}

export async function getAllUserPreferences(userId: number, tenantId: number): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(userPreferences)
    .where(and(
      eq(userPreferences.userId, userId),
      eq(userPreferences.tenantId, tenantId),
    ));
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (row.prefValue !== null) result[row.prefKey] = row.prefValue;
  }
  return result;
}

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
      gt(waConversations.unreadCount, 0),
    ))
    .groupBy(waConversations.contactId);
  const result: Record<number, number> = {};
  for (const row of rows) {
    if (row.contactId) result[row.contactId] = Number(row.totalUnread) || 0;
  }
  return result;
}


// ─── Enhanced Dashboard v2 ───

export async function getDashboardWhatsAppMetrics(tenantId: number) {
  const db = await getDb();
  if (!db) return {
    totalMessages: 0, sentMessages: 0, receivedMessages: 0,
    totalConversations: 0, unreadConversations: 0,
    messagesByDay: [] as { date: string; sent: number; received: number }[],
    avgResponseTimeMinutes: 0,
  };

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const totalResult = await db.execute(sql`
    SELECT
      COUNT(*) as totalMessages,
      SUM(CASE WHEN "fromMe" = true THEN 1 ELSE 0 END) as sentMessages,
      SUM(CASE WHEN "fromMe" = false THEN 1 ELSE 0 END) as receivedMessages
    FROM ${messages}
    WHERE "tenantId" = ${tenantId}
  `);

  const convResult = await db.execute(sql`
    SELECT
      COUNT(*) as totalConversations,
      SUM(CASE WHEN "unreadCount" > 0 THEN 1 ELSE 0 END) as unreadConversations
    FROM ${waConversations}
    WHERE "tenantId" = ${tenantId}
  `);

  const msgsByDay = await db.execute(sql`
    SELECT
      DATE(timestamp) as dt,
      SUM(CASE WHEN "fromMe" = true THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN "fromMe" = false THEN 1 ELSE 0 END) as received
    FROM ${messages}
    WHERE "tenantId" = ${tenantId} AND timestamp >= ${fourteenDaysAgo}
    GROUP BY DATE(timestamp)
    ORDER BY dt ASC
  `);

  const totals = rowsOf(totalResult)[0] || {};
  const convTotals = rowsOf(convResult)[0] || {};

  return {
    totalMessages: Number(totals.totalMessages) || 0,
    sentMessages: Number(totals.sentMessages) || 0,
    receivedMessages: Number(totals.receivedMessages) || 0,
    totalConversations: Number(convTotals.totalConversations) || 0,
    unreadConversations: Number(convTotals.unreadConversations) || 0,
    messagesByDay: rowsOf(msgsByDay).map((r: any) => ({
      date: new Date(r.dt).toISOString().split("T")[0],
      sent: Number(r.sent) || 0,
      received: Number(r.received) || 0,
    })),
    avgResponseTimeMinutes: 0,
  };
}

export async function getDashboardDealsTimeline(tenantId: number, days = 30) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db.execute(sql`
    SELECT
      DATE("createdAt") as dt,
      COUNT(*) as newDeals,
      SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wonDeals,
      SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lostDeals,
      COALESCE(SUM("valueCents"), 0) as totalValueCents,
      COALESCE(SUM(CASE WHEN status = 'won' THEN "valueCents" ELSE 0 END), 0) as wonValueCents
    FROM deals
    WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL AND "createdAt" >= ${startDate}
    GROUP BY DATE("createdAt")
    ORDER BY dt ASC
  `);

  return rowsOf(rows).map((r: any) => ({
    date: new Date(r.dt).toISOString().split("T")[0],
    newDeals: Number(r.newDeals) || 0,
    wonDeals: Number(r.wonDeals) || 0,
    lostDeals: Number(r.lostDeals) || 0,
    totalValueCents: Number(r.totalValueCents) || 0,
    wonValueCents: Number(r.wonValueCents) || 0,
  }));
}

export async function getDashboardConversionRates(tenantId: number) {
  const db = await getDb();
  if (!db) return { totalDeals: 0, wonDeals: 0, lostDeals: 0, openDeals: 0, conversionRate: 0, avgDealValueCents: 0, topLeadSources: [] as { source: string; count: number }[] };

  const statusResult = await db.execute(sql`
    SELECT
      COUNT(*) as totalDeals,
      SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wonDeals,
      SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lostDeals,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as openDeals,
      COALESCE(AVG(CASE WHEN status = 'won' THEN "valueCents" END), 0) as avgWonValueCents,
      COALESCE(AVG("valueCents"), 0) as avgDealValueCents
    FROM deals
    WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL
  `);

  const leadSources = await db.execute(sql`
    SELECT
      COALESCE("leadSource", 'direto') as source,
      COUNT(*) as cnt
    FROM deals
    WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL
    GROUP BY "leadSource"
    ORDER BY cnt DESC
    LIMIT 5
  `);

  const row = rowsOf(statusResult)[0] || {};
  const total = Number(row.totalDeals) || 0;
  const won = Number(row.wonDeals) || 0;
  const closed = won + (Number(row.lostDeals) || 0);

  return {
    totalDeals: total,
    wonDeals: won,
    lostDeals: Number(row.lostDeals) || 0,
    openDeals: Number(row.openDeals) || 0,
    conversionRate: closed > 0 ? Math.round((won / closed) * 100) : 0,
    avgDealValueCents: Math.round(Number(row.avgDealValueCents) || 0),
    topLeadSources: rowsOf(leadSources).map((r: any) => ({
      source: String(r.source),
      count: Number(r.cnt) || 0,
    })),
  };
}

export async function getDashboardFunnelData(tenantId: number, pipelineId?: number) {
  const db = await getDb();
  if (!db) return { pipelineName: "", stages: [] as any[] };

  // Get the pipeline
  const pipelineFilter = pipelineId
    ? sql`AND p.id = ${pipelineId}`
    : sql``;

  const pipelineRows = await db.execute(sql`
    SELECT p.id, p.name FROM pipelines p
    WHERE p."tenantId" = ${tenantId} ${pipelineFilter}
    ORDER BY p.id ASC
    LIMIT 1
  `);

  const pipeline = rowsOf(pipelineRows)[0];
  if (!pipeline) return { pipelineName: "", stages: [] };

  const stageRows = await db.execute(sql`
    SELECT
      ps.id, ps.name, ps.color, ps."orderIndex", ps."isWon", ps."isLost",
      COUNT(d.id) as dealCount,
      COALESCE(SUM(d."valueCents"), 0) as totalValueCents
    FROM pipeline_stages ps
    LEFT JOIN deals d ON d."stageId" = ps.id AND d."tenantId" = ${tenantId} AND d."deletedAt" IS NULL AND d.status = 'open'
    WHERE ps."pipelineId" = ${pipeline.id} AND ps."tenantId" = ${tenantId}
    GROUP BY ps.id, ps.name, ps.color, ps."orderIndex", ps."isWon", ps."isLost"
    ORDER BY ps."orderIndex" ASC
  `);

  return {
    pipelineName: String(pipeline.name),
    stages: rowsOf(stageRows).map((r: any) => ({
      id: Number(r.id),
      name: String(r.name),
      color: r.color ? String(r.color) : null,
      orderIndex: Number(r.orderIndex),
      isWon: Boolean(Number(r.isWon)),
      isLost: Boolean(Number(r.isLost)),
      dealCount: Number(r.dealCount) || 0,
      totalValueCents: Number(r.totalValueCents) || 0,
    })),
  };
}

export async function getDashboardAllPipelines(tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.execute(sql`
    SELECT id, name FROM pipelines WHERE "tenantId" = ${tenantId} ORDER BY id ASC
  `);

  return rowsOf(rows).map((r: any) => ({
    id: Number(r.id),
    name: String(r.name),
  }));
}


// ════════════════════════════════════════════════════════════
// SESSION SHARING HELPERS
// ════════════════════════════════════════════════════════════

/**
 * Get the active session share for a target user.
 * A user can have at most ONE active share at a time.
 */
export async function getActiveShareForUser(tenantId: number, targetUserId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(sessionShares)
    .where(and(
      eq(sessionShares.tenantId, tenantId),
      eq(sessionShares.targetUserId, targetUserId),
      eq(sessionShares.status, "active"),
    ))
    .limit(1);
  return rows[0] || null;
}

/**
 * Get all shares for a given session (active and revoked).
 */
export async function getSharesForSession(tenantId: number, sourceSessionId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessionShares)
    .where(and(
      eq(sessionShares.tenantId, tenantId),
      eq(sessionShares.sourceSessionId, sourceSessionId),
    ))
    .orderBy(desc(sessionShares.createdAt));
}

/**
 * Get all active shares for a tenant (for admin listing).
 */
export async function getAllSharesForTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessionShares)
    .where(eq(sessionShares.tenantId, tenantId))
    .orderBy(desc(sessionShares.createdAt));
}

/**
 * Create a session share. Automatically revokes any existing active share
 * for the target user (a user can only have ONE active share).
 */
export async function createSessionShare(
  tenantId: number,
  sourceSessionId: string,
  sourceUserId: number,
  targetUserId: number,
  sharedBy: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Revoke any existing active share for this target user
  await db.update(sessionShares)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(and(
      eq(sessionShares.tenantId, tenantId),
      eq(sessionShares.targetUserId, targetUserId),
      eq(sessionShares.status, "active"),
    ));

  // Create the new share
  const result = await db.insert(sessionShares).values({
    tenantId,
    sourceSessionId,
    sourceUserId,
    targetUserId,
    sharedBy,
    status: "active",
  }).returning({ id: sessionShares.id });

  return { id: Number(result[0].id) };
}

/**
 * Revoke a specific share by ID.
 */
export async function revokeSessionShare(shareId: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(sessionShares)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(and(
      eq(sessionShares.id, shareId),
      eq(sessionShares.tenantId, tenantId),
    ));
}

/**
 * Revoke all active shares for a given session (e.g., when session is deleted).
 */
export async function revokeAllSharesForSession(tenantId: number, sourceSessionId: string) {
  const db = await getDb();
  if (!db) return;

  await db.update(sessionShares)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(and(
      eq(sessionShares.tenantId, tenantId),
      eq(sessionShares.sourceSessionId, sourceSessionId),
      eq(sessionShares.status, "active"),
    ));
}

/**
 * Check if a user has an active share for a specific session.
 */
export async function hasActiveShareForSession(tenantId: number, targetUserId: number, sessionId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: sessionShares.id }).from(sessionShares)
    .where(and(
      eq(sessionShares.tenantId, tenantId),
      eq(sessionShares.targetUserId, targetUserId),
      eq(sessionShares.sourceSessionId, sessionId),
      eq(sessionShares.status, "active"),
    ))
    .limit(1);
  return rows.length > 0;
}


// ════════════════════════════════════════════════════════════
// HELPDESK — Internal Notes
// ════════════════════════════════════════════════════════════

export async function createInternalNote(
  tenantId: number, waConversationId: number, sessionId: string, remoteJid: string,
  authorUserId: number, content: string, mentionedUserIds?: number[],
  category?: string, priority?: string, isCustomerGlobalNote?: boolean
) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(internalNotes).values({
    tenantId,
    waConversationId,
    sessionId,
    remoteJid,
    authorUserId,
    content,
    mentionedUserIds: mentionedUserIds ? JSON.stringify(mentionedUserIds) : undefined,
    category: category || "other",
    priority: priority || "normal",
    isCustomerGlobalNote: isCustomerGlobalNote || false,
  }).returning({ id: internalNotes.id });
  // Also log as event
  await db.insert(conversationEvents).values({
    tenantId,
    waConversationId,
    sessionId,
    remoteJid,
    eventType: "note",
    fromUserId: authorUserId,
    content,
  });
  return result;
}

export async function getInternalNotes(tenantId: number, waConversationId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT 
      n.id,
      n."waConversationId",
      n.content,
      n."mentionedUserIds",
      n.category,
      n.priority,
      n."isCustomerGlobalNote",
      n."createdAt",
      n."authorUserId",
      u.name AS authorName,
      u."avatarUrl" AS authorAvatar
    FROM internal_notes n
    LEFT JOIN crm_users u ON u.id = n."authorUserId"
    WHERE n."tenantId" = ${tenantId}
    AND n."waConversationId" = ${waConversationId}
    ORDER BY n."createdAt" ASC
  `);
  // db.execute(sql`...`) returns createdAt as a string (e.g. "2026-03-16 04:18:05")
  // WITHOUT timezone info. Drizzle select().from() treats these as UTC, so we must do
  // the same: append 'Z' to force UTC interpretation, matching how messages are handled.
  // Without 'Z', new Date(str) interprets as server local time (EDT), causing a 4h shift.
  const rows = rowsOf(result);
  return rows.map((row: any) => ({
    ...row,
    createdAt: row.createdAt instanceof Date
      ? row.createdAt
      : new Date(typeof row.createdAt === 'string' && !row.createdAt.endsWith('Z')
          ? row.createdAt.replace(' ', 'T') + 'Z'
          : row.createdAt),
  }));
}

// Get customer global notes for a specific remoteJid (across all conversations)
export async function getCustomerGlobalNotes(tenantId: number, remoteJid: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      n.id,
      n."waConversationId",
      n.content,
      n.category,
      n.priority,
      n."createdAt",
      n."authorUserId",
      u.name AS authorName
    FROM internal_notes n
    LEFT JOIN crm_users u ON u.id = n."authorUserId"
    WHERE n."tenantId" = ${tenantId}
    AND n."remoteJid" = ${remoteJid}
    AND n."isCustomerGlobalNote" = true
    ORDER BY n."createdAt" DESC
  `);
  // Convert string timestamps to Date objects for proper Superjson serialization.
  // Append 'Z' to treat as UTC (matching Drizzle select().from() behavior for messages).
  const rows = rowsOf(result);
  return rows.map((row: any) => ({
    ...row,
    createdAt: row.createdAt instanceof Date
      ? row.createdAt
      : new Date(typeof row.createdAt === 'string' && !row.createdAt.endsWith('Z')
          ? row.createdAt.replace(' ', 'T') + 'Z'
          : row.createdAt),
  }));
}

export async function updateInternalNote(
  tenantId: number, noteId: number,
  data: { content?: string; category?: string; priority?: string }
) {
  const db = await getDb();
  if (!db) return;
  const updates: Record<string, any> = {};
  if (data.content !== undefined) updates.content = data.content;
  if (data.category !== undefined) updates.category = data.category;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (Object.keys(updates).length === 0) return;
  await db.update(internalNotes)
    .set(updates)
    .where(and(
      eq(internalNotes.tenantId, tenantId),
      eq(internalNotes.id, noteId),
    ));
}

export async function deleteInternalNote(tenantId: number, noteId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(internalNotes).where(and(
    eq(internalNotes.tenantId, tenantId),
    eq(internalNotes.id, noteId),
  ));
}

// ════════════════════════════════════════════════════════════
// HELPDESK — Conversation Events (Timeline)
// ════════════════════════════════════════════════════════════

export async function getConversationEvents(tenantId: number, waConversationId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT 
      e.id,
      e."eventType",
      e."fromUserId",
      e."toUserId",
      e."fromTeamId",
      e."toTeamId",
      e.content,
      e.metadata,
      e."createdAt",
      fu.name AS fromUserName,
      tu.name AS toUserName,
      ft.name AS fromTeamName,
      tt.name AS toTeamName
    FROM conversation_events e
    LEFT JOIN crm_users fu ON fu.id = e."fromUserId"
    LEFT JOIN crm_users tu ON tu.id = e."toUserId"
    LEFT JOIN teams ft ON ft.id = e."fromTeamId"
    LEFT JOIN teams tt ON tt.id = e."toTeamId"
    WHERE e."tenantId" = ${tenantId}
    AND e."waConversationId" = ${waConversationId}
    ORDER BY e."createdAt" ASC
  `);
  return rowsOf(result);
}

export async function logConversationEvent(
  tenantId: number, waConversationId: number, sessionId: string, remoteJid: string,
  eventType: "created" | "assigned" | "transferred" | "note" | "resolved" | "reopened" | "queued" | "sla_breach" | "closed" | "priority_changed",
  opts?: { fromUserId?: number; toUserId?: number; fromTeamId?: number; toTeamId?: number; content?: string; metadata?: any }
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(conversationEvents).values({
    tenantId,
    waConversationId,
    sessionId,
    remoteJid,
    eventType,
    fromUserId: opts?.fromUserId,
    toUserId: opts?.toUserId,
    fromTeamId: opts?.fromTeamId,
    toTeamId: opts?.toTeamId,
    content: opts?.content,
    metadata: opts?.metadata,
  });
}

// ════════════════════════════════════════════════════════════
// HELPDESK — Queue (Fila de espera)
// ════════════════════════════════════════════════════════════

export async function getQueueConversations(sessionId: string, tenantId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  // Part 1 fix: Derive preview from the REAL last message in wa_messages
  const result = await db.execute(sql`
    SELECT
      wc.id AS "conversationId",
      wc."sessionId",
      wc."remoteJid",
      wc."phoneE164",
      wc."contactId",
      wc."contactPushName",
      lm.content AS "lastMessage",
      lm."messageType" AS "lastMessageType",
      lm."fromMe" AS "lastFromMe",
      lm.timestamp AS "lastTimestamp",
      wc."unreadCount",
      wc.status AS "conversationStatus",
      wc."conversationKey",
      wc."queuedAt",
      c.name AS "contactName",
      c.email AS "contactEmail",
      c.phone AS "contactPhone"
    FROM wa_conversations wc
    LEFT JOIN (
      SELECT m1."sessionId", m1."remoteJid", m1.content, m1."messageType", m1."fromMe", m1.timestamp, m1.status
      FROM messages m1
      INNER JOIN (
        SELECT "sessionId", "remoteJid", MAX(timestamp) AS maxTs
        FROM messages
        WHERE "sessionId" = ${sessionId}
        AND "messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage')
        GROUP BY "sessionId", "remoteJid"
      ) m2 ON m1."sessionId" = m2."sessionId" AND m1."remoteJid" = m2."remoteJid" AND m1.timestamp = m2.maxTs
      WHERE m1."sessionId" = ${sessionId}
      AND m1."messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage')
    ) lm ON lm."sessionId" = wc."sessionId" AND lm."remoteJid" = wc."remoteJid"
    LEFT JOIN contacts c ON c.id = wc."contactId"
    WHERE wc."sessionId" = ${sessionId}
    AND wc."tenantId" = ${tenantId}
    AND wc."mergedIntoId" IS NULL
    AND (wc."assignedUserId" IS NULL)
    AND wc.status IN ('open', 'pending')
    AND (wc."unreadCount" > 0 OR wc."queuedAt" IS NOT NULL)
    ORDER BY COALESCE(wc."queuedAt", lm.timestamp, wc."lastMessageAt", wc."createdAt") DESC
    LIMIT ${limit}
  `);
  return dedupConversations(fixTimestampFields(rowsOf(result)));
}

export async function claimConversation(tenantId: number, sessionId: string, remoteJid: string, userId: number) {
  // "Puxar da fila" — assign to self
  return assignConversation(tenantId, sessionId, remoteJid, userId, undefined, userId);
}

export async function enqueueConversation(tenantId: number, sessionId: string, remoteJid: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(waConversations)
    .set({ assignedUserId: null, queuedAt: new Date() })
    .where(and(
      eq(waConversations.tenantId, tenantId),
      eq(waConversations.sessionId, sessionId),
      eq(waConversations.remoteJid, remoteJid)
    ));
  // Also clear assignment
  await db.update(conversationAssignments)
    .set({ assignedUserId: null })
    .where(and(
      eq(conversationAssignments.tenantId, tenantId),
      eq(conversationAssignments.sessionId, sessionId),
      eq(conversationAssignments.remoteJid, remoteJid)
    ));
  // Log event
  const waConv = await db.select({ id: waConversations.id }).from(waConversations)
    .where(and(eq(waConversations.tenantId, tenantId), eq(waConversations.sessionId, sessionId), eq(waConversations.remoteJid, remoteJid)))
    .limit(1);
  if (waConv.length > 0) {
    await db.insert(conversationEvents).values({
      tenantId,
      waConversationId: waConv[0].id,
      sessionId,
      remoteJid,
      eventType: "queued",
    });
  }
}

// ════════════════════════════════════════════════════════════
// HELPDESK — Supervision Dashboard
// ════════════════════════════════════════════════════════════

export async function getAgentWorkload(tenantId: number, sessionId: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      cu.id AS "agentId",
      cu.name AS "agentName",
      cu.email AS "agentEmail",
      cu."avatarUrl" AS "agentAvatar",
      cu.status AS "agentStatus",
      cu."lastActiveAt" AS "lastActiveAt",
      CASE WHEN cu."lastActiveAt" >= NOW() - INTERVAL '5 minutes' THEN 1 ELSE 0 END AS "isOnline",
      COUNT(CASE WHEN wc.status IN ('open', 'pending') THEN 1 END) AS "activeConversations",
      COUNT(CASE WHEN wc."unreadCount" > 0 THEN 1 END) AS "unreadConversations",
      MIN(wc."lastMessageAt") AS "oldestConversation",
      MAX(wc."lastMessageAt") AS "newestConversation"
    FROM crm_users cu
    LEFT JOIN wa_conversations wc
      ON wc."assignedUserId" = cu.id
      AND wc."tenantId" = ${tenantId}
      AND wc."sessionId" = ${sessionId}
      AND wc.status IN ('open', 'pending')
      AND wc."mergedIntoId" IS NULL
    WHERE cu."tenantId" = ${tenantId}
    AND cu.status = 'active'
    GROUP BY cu.id, cu.name, cu.email, cu."avatarUrl", cu.status, cu."lastActiveAt"
    ORDER BY "isOnline" DESC, "activeConversations" DESC
  `);
  return rowsOf(result);
}

export async function getAgentConversations(tenantId: number, sessionId: string, agentId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  // Part 1 fix: Derive preview from the REAL last message in wa_messages
  const result = await db.execute(sql`
    SELECT
      wc.id AS "conversationId",
      wc."sessionId",
      wc."remoteJid",
      wc."contactPushName",
      lm.content AS "lastMessage",
      lm.timestamp AS "lastTimestamp",
      wc."unreadCount",
      wc.status AS "conversationStatus",
      c.name AS "contactName"
    FROM wa_conversations wc
    LEFT JOIN (
      SELECT m1."sessionId", m1."remoteJid", m1.content, m1.timestamp
      FROM messages m1
      INNER JOIN (
        SELECT "sessionId", "remoteJid", MAX(timestamp) AS maxTs
        FROM messages
        WHERE "sessionId" = ${sessionId}
        AND "messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage')
        GROUP BY "sessionId", "remoteJid"
      ) m2 ON m1."sessionId" = m2."sessionId" AND m1."remoteJid" = m2."remoteJid" AND m1.timestamp = m2.maxTs
      WHERE m1."sessionId" = ${sessionId}
      AND m1."messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage')
    ) lm ON lm."sessionId" = wc."sessionId" AND lm."remoteJid" = wc."remoteJid"
    LEFT JOIN contacts c ON c.id = wc."contactId"
    WHERE wc."tenantId" = ${tenantId}
    AND wc."sessionId" = ${sessionId}
    AND wc."assignedUserId" = ${agentId}
    AND wc.status IN ('open', 'pending')
    AND wc."mergedIntoId" IS NULL
    ORDER BY COALESCE(lm.timestamp, wc."lastMessageAt", wc."createdAt") DESC
    LIMIT ${limit}
  `);
  return dedupConversations(fixTimestampFields(rowsOf(result)));
}

export async function getQueueStats(tenantId: number, sessionId: string) {
  const db = await getDb();
  if (!db) return { total: 0, oldest: null, items: [] };
  // Get count + oldest — derive from wa_messages, not cached fields
  const countResult = await db.execute(sql`
    SELECT
      COUNT(*) AS total,
      MIN(COALESCE(wc."queuedAt", lm.timestamp)) AS "oldestEntry"
    FROM wa_conversations wc
    LEFT JOIN (
      SELECT m1."sessionId", m1."remoteJid", m1.timestamp
      FROM messages m1
      INNER JOIN (
        SELECT "sessionId", "remoteJid", MAX(timestamp) AS maxTs
        FROM messages
        WHERE "sessionId" = ${sessionId}
        AND "messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage')
        GROUP BY "sessionId", "remoteJid"
      ) m2 ON m1."sessionId" = m2."sessionId" AND m1."remoteJid" = m2."remoteJid" AND m1.timestamp = m2.maxTs
      WHERE m1."sessionId" = ${sessionId}
      AND m1."messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage')
    ) lm ON lm."sessionId" = wc."sessionId" AND lm."remoteJid" = wc."remoteJid"
    WHERE wc."tenantId" = ${tenantId}
    AND wc."sessionId" = ${sessionId}
    AND wc."assignedUserId" IS NULL
    AND wc.status IN ('open', 'pending')
    AND wc."mergedIntoId" IS NULL
    AND (wc."unreadCount" > 0 OR wc."queuedAt" IS NOT NULL)
  `);
  const countRows = rowsOf(countResult);
  // Get queue items with details — derive preview from wa_messages
  const itemsResult = await db.execute(sql`
    SELECT
      wc."remoteJid",
      wc."contactPushName",
      lm.content AS "lastMessage",
      lm.timestamp AS "lastMessageAt",
      wc."unreadCount",
      COALESCE(wc."queuedAt", lm.timestamp) AS "waitingSince",
      c.name AS "contactName"
    FROM wa_conversations wc
    LEFT JOIN (
      SELECT m1."sessionId", m1."remoteJid", m1.content, m1.timestamp
      FROM messages m1
      INNER JOIN (
        SELECT "sessionId", "remoteJid", MAX(timestamp) AS maxTs
        FROM messages
        WHERE "sessionId" = ${sessionId}
        AND "messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage')
        GROUP BY "sessionId", "remoteJid"
      ) m2 ON m1."sessionId" = m2."sessionId" AND m1."remoteJid" = m2."remoteJid" AND m1.timestamp = m2.maxTs
      WHERE m1."sessionId" = ${sessionId}
      AND m1."messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage')
    ) lm ON lm."sessionId" = wc."sessionId" AND lm."remoteJid" = wc."remoteJid"
    LEFT JOIN contacts c ON c.id = wc."contactId"
    WHERE wc."tenantId" = ${tenantId}
    AND wc."sessionId" = ${sessionId}
    AND wc."assignedUserId" IS NULL
    AND wc.status IN ('open', 'pending')
    AND wc."mergedIntoId" IS NULL
    AND (wc."unreadCount" > 0 OR wc."queuedAt" IS NOT NULL)
    ORDER BY COALESCE(wc."queuedAt", lm.timestamp, wc."lastMessageAt", wc."createdAt") ASC
    LIMIT 50
  `);
  // Fix timestamp strings from db.execute for both count and items
  const fixedCount = fixTimestampFields(countRows);
  const fixedItems = dedupConversations(fixTimestampFields(rowsOf(itemsResult)));
  return {
    total: Number(fixedCount[0]?.total || 0),
    oldest: fixedCount[0]?.oldestEntry || null,
    items: fixedItems,
  };
}

// ════════════════════════════════════════════════════════════
// HELPDESK — Quick Replies
// ════════════════════════════════════════════════════════════

export async function getQuickReplies(tenantId: number, teamId?: number, category?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(quickReplies.tenantId, tenantId)];
  if (teamId) conditions.push(or(eq(quickReplies.teamId, teamId), sql`${quickReplies.teamId} IS NULL`)!);
  if (category) conditions.push(eq(quickReplies.category, category));
  return db.select().from(quickReplies)
    .where(and(...conditions))
    .orderBy(desc(quickReplies.usageCount), quickReplies.shortcut);
}

export async function createQuickReply(tenantId: number, data: { shortcut: string; title: string; content: string; contentType?: string; mediaUrl?: string; teamId?: number; category?: string; createdBy: number }) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(quickReplies).values({
    tenantId,
    shortcut: data.shortcut,
    title: data.title,
    content: data.content,
    contentType: (data.contentType as any) || "text",
    mediaUrl: data.mediaUrl,
    teamId: data.teamId,
    category: data.category,
    createdBy: data.createdBy,
  }).returning({ id: quickReplies.id });
  return result;
}

export async function updateQuickReply(tenantId: number, id: number, data: { shortcut?: string; title?: string; content?: string; contentType?: string; mediaUrl?: string; category?: string }) {
  const db = await getDb();
  if (!db) return;
  const updates: Record<string, any> = {};
  if (data.shortcut !== undefined) updates.shortcut = data.shortcut;
  if (data.title !== undefined) updates.title = data.title;
  if (data.content !== undefined) updates.content = data.content;
  if (data.contentType !== undefined) updates.contentType = data.contentType;
  if (data.mediaUrl !== undefined) updates.mediaUrl = data.mediaUrl;
  if (data.category !== undefined) updates.category = data.category;
  if (Object.keys(updates).length === 0) return;
  await db.update(quickReplies).set(updates).where(and(eq(quickReplies.tenantId, tenantId), eq(quickReplies.id, id)));
}

export async function incrementQuickReplyUsage(tenantId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(quickReplies).set({ usageCount: sql`${quickReplies.usageCount} + 1` }).where(and(eq(quickReplies.tenantId, tenantId), eq(quickReplies.id, id)));
}

export async function deleteQuickReply(tenantId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quickReplies).where(and(
    eq(quickReplies.tenantId, tenantId),
    eq(quickReplies.id, id),
  ));
}

// ════════════════════════════════════════════════════════════
// INBOX — Conversation Tags
// ════════════════════════════════════════════════════════════

export async function listConversationTags(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversationTags).where(eq(conversationTags.tenantId, tenantId)).orderBy(conversationTags.name);
}

export async function createConversationTag(tenantId: number, name: string, color?: string) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(conversationTags).values({ tenantId, name, color: color || "#6366f1" }).returning({ id: conversationTags.id });
  return result;
}

export async function deleteConversationTag(tenantId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  // Remove all links first
  await db.delete(waConversationTagLinks).where(eq(waConversationTagLinks.tagId, id));
  await db.delete(conversationTags).where(and(eq(conversationTags.tenantId, tenantId), eq(conversationTags.id, id)));
}

export async function getTagsForConversation(waConversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: conversationTags.id, name: conversationTags.name, color: conversationTags.color })
    .from(waConversationTagLinks)
    .innerJoin(conversationTags, eq(waConversationTagLinks.tagId, conversationTags.id))
    .where(eq(waConversationTagLinks.waConversationId, waConversationId));
}

export async function addTagToConversation(waConversationId: number, tagId: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(waConversationTagLinks).values({ waConversationId, tagId });
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") return; // already linked
    throw e;
  }
}

export async function removeTagFromConversation(waConversationId: number, tagId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(waConversationTagLinks).where(and(
    eq(waConversationTagLinks.waConversationId, waConversationId),
    eq(waConversationTagLinks.tagId, tagId),
  ));
}

// ════════════════════════════════════════════════════════════
// INBOX — Pin / Archive
// ════════════════════════════════════════════════════════════

export async function pinConversation(tenantId: number, sessionId: string, remoteJid: string, pin: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(waConversations).set({ isPinned: pin }).where(and(
    eq(waConversations.tenantId, tenantId),
    eq(waConversations.sessionId, sessionId),
    eq(waConversations.remoteJid, remoteJid),
  ));
}

export async function archiveConversation(tenantId: number, sessionId: string, remoteJid: string, archive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(waConversations).set({ isArchived: archive }).where(and(
    eq(waConversations.tenantId, tenantId),
    eq(waConversations.sessionId, sessionId),
    eq(waConversations.remoteJid, remoteJid),
  ));
}

// ════════════════════════════════════════════════════════════
// INBOX — Scheduled Messages
// ════════════════════════════════════════════════════════════

export async function listScheduledMessages(tenantId: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(scheduledMessages.tenantId, tenantId)];
  if (status) conditions.push(eq(scheduledMessages.status, status as any));
  return db.select().from(scheduledMessages).where(and(...conditions)).orderBy(scheduledMessages.scheduledAt);
}

export async function createScheduledMessage(tenantId: number, data: { sessionId: string; remoteJid: string; content: string; contentType?: string; mediaUrl?: string; scheduledAt: Date; createdBy?: number }) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(scheduledMessages).values({
    tenantId,
    sessionId: data.sessionId,
    remoteJid: data.remoteJid,
    content: data.content,
    contentType: (data.contentType as any) || "text",
    mediaUrl: data.mediaUrl,
    scheduledAt: data.scheduledAt,
    createdBy: data.createdBy,
  }).returning({ id: scheduledMessages.id });
  return result;
}

export async function cancelScheduledMessage(tenantId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduledMessages).set({ status: "cancelled" }).where(and(
    eq(scheduledMessages.tenantId, tenantId),
    eq(scheduledMessages.id, id),
    eq(scheduledMessages.status, "pending"),
  ));
}

export async function markScheduledMessageSent(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduledMessages).set({ status: "sent", sentAt: new Date() }).where(eq(scheduledMessages.id, id));
}

export async function markScheduledMessageFailed(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduledMessages).set({ status: "failed" }).where(eq(scheduledMessages.id, id));
}

export async function getPendingScheduledMessages() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scheduledMessages).where(and(
    eq(scheduledMessages.status, "pending"),
    sql`${scheduledMessages.scheduledAt} <= NOW()`,
  ));
}

// ════════════════════════════════════════════════════════════
// HELPDESK — Transfer with note
// ════════════════════════════════════════════════════════════

export async function transferConversationWithNote(
  tenantId: number, sessionId: string, remoteJid: string,
  fromUserId: number, toUserId: number, toTeamId?: number | null,
  note?: string
) {
  const db = await getDb();
  if (!db) return null;
  // If there's a transfer note, create internal note first
  if (note) {
    const waConv = await db.select({ id: waConversations.id }).from(waConversations)
      .where(and(eq(waConversations.tenantId, tenantId), eq(waConversations.sessionId, sessionId), eq(waConversations.remoteJid, remoteJid)))
      .limit(1);
    if (waConv.length > 0) {
      await createInternalNote(tenantId, waConv[0].id, sessionId, remoteJid, fromUserId, note);
    }
  }
  // Perform the assignment (which logs the transfer event)
  return assignConversation(tenantId, sessionId, remoteJid, toUserId, toTeamId, fromUserId);
}


// ═══════════════════════════════════════
// PROFILE PICTURES FROM DB (FAST)
// ═══════════════════════════════════════

/**
 * Get profile picture URLs from wa_contacts table (instant DB query, no API calls).
 * Falls back to null for contacts without stored pictures.
 */
export async function getProfilePicturesFromDb(
  sessionId: string,
  jids: string[]
): Promise<Record<string, string | null>> {
  const db = await getDb();
  if (!db || jids.length === 0) return {};

  const result: Record<string, string | null> = {};
  // Initialize all jids as null
  for (const jid of jids) result[jid] = null;

  // Query wa_contacts for all matching jids at once
  const contacts = await db
    .select({
      jid: waContacts.jid,
      lid: waContacts.lid,
      phoneNumber: waContacts.phoneNumber,
      profilePictureUrl: waContacts.profilePictureUrl,
    })
    .from(waContacts)
    .where(
      and(
        eq(waContacts.sessionId, sessionId),
        or(
          inArray(waContacts.jid, jids),
          inArray(waContacts.lid, jids),
          inArray(waContacts.phoneNumber, jids.map(j => j.replace(/@.*/, "")))
        )
      )
    );

  // Map results back to JIDs
  for (const contact of contacts) {
    const url = contact.profilePictureUrl || null;
    if (url) {
      // Match by jid, lid, or phoneNumber
      for (const jid of jids) {
        if (contact.jid === jid || contact.lid === jid || jid.startsWith(contact.phoneNumber || "___")) {
          result[jid] = url;
        }
      }
    }
  }

  return result;
}


// ════════════════════════════════════════════════════════════
// AI INTEGRATIONS — CRUD helpers
// ════════════════════════════════════════════════════════════

export async function listAiIntegrations(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiIntegrations)
    .where(eq(aiIntegrations.tenantId, tenantId))
    .orderBy(desc(aiIntegrations.createdAt));
}

export async function getAiIntegration(tenantId: number, id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(aiIntegrations)
    .where(and(eq(aiIntegrations.id, id), eq(aiIntegrations.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getActiveAiIntegration(tenantId: number, provider: "openai" | "anthropic") {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(aiIntegrations)
    .where(and(
      eq(aiIntegrations.tenantId, tenantId),
      eq(aiIntegrations.provider, provider),
      eq(aiIntegrations.isActive, true),
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function createAiIntegration(data: {
  tenantId: number;
  provider: "openai" | "anthropic";
  apiKey: string;
  defaultModel: string;
  isActive?: boolean;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(aiIntegrations).values({
    tenantId: data.tenantId,
    provider: data.provider,
    apiKey: data.apiKey,
    defaultModel: data.defaultModel,
    isActive: data.isActive ?? true,
    createdBy: data.createdBy,
  }).returning({ id: aiIntegrations.id });
  return { id: Number(result[0].id) };
}

export async function updateAiIntegration(tenantId: number, id: number, data: {
  apiKey?: string;
  defaultModel?: string;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Record<string, unknown> = {};
  if (data.apiKey !== undefined) updateData.apiKey = data.apiKey;
  if (data.defaultModel !== undefined) updateData.defaultModel = data.defaultModel;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (Object.keys(updateData).length === 0) return;
  await db.update(aiIntegrations)
    .set(updateData)
    .where(and(eq(aiIntegrations.id, id), eq(aiIntegrations.tenantId, tenantId)));
}

export async function deleteAiIntegration(tenantId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(aiIntegrations)
    .where(and(eq(aiIntegrations.id, id), eq(aiIntegrations.tenantId, tenantId)));
}

/**
 * Valida a API key chamando o endpoint /v1/models do provider.
 * Apenas auth — sem custo de tokens, sem dependência de um modelo específico
 * (a lista de modelos disponíveis varia por conta/preview).
 */
export async function testAiApiKey(provider: "openai" | "anthropic", apiKey: string, _model: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { success: false, error: body?.error?.message || `HTTP ${res.status}` };
      }
      return { success: true };
    } else {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { success: false, error: body?.error?.message || `HTTP ${res.status}` };
      }
      return { success: true };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Connection failed" };
  }
}


// ── Tenant AI Settings (stored in tenants.settingsJson) ──

export interface TenantAiSettings {
  defaultAiProvider?: "openai" | "anthropic";
  defaultAiModel?: string;
  audioTranscriptionEnabled?: boolean;
}

export async function getTenantAiSettings(tenantId: number): Promise<TenantAiSettings> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select({ settingsJson: tenants.settingsJson }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const raw = rows[0]?.settingsJson as Record<string, unknown> | null;
  if (!raw) return {};
  return {
    defaultAiProvider: raw.defaultAiProvider as TenantAiSettings["defaultAiProvider"],
    defaultAiModel: raw.defaultAiModel as string | undefined,
    audioTranscriptionEnabled: raw.audioTranscriptionEnabled as boolean | undefined,
  };
}

export async function updateTenantAiSettings(tenantId: number, patch: Partial<TenantAiSettings>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ settingsJson: tenants.settingsJson }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const existing = (rows[0]?.settingsJson as Record<string, unknown>) || {};
  const merged = { ...existing, ...patch };
  await db.update(tenants).set({ settingsJson: merged }).where(eq(tenants.id, tenantId));
}

// Get the first active AI integration for a tenant (any provider)
export async function getAnyActiveAiIntegration(tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  // Try to get the default provider first
  const settings = await getTenantAiSettings(tenantId);
  if (settings.defaultAiProvider) {
    const preferred = await getActiveAiIntegration(tenantId, settings.defaultAiProvider);
    if (preferred) return preferred;
  }
  // Fallback: any active integration
  const rows = await db.select().from(aiIntegrations)
    .where(and(eq(aiIntegrations.tenantId, tenantId), eq(aiIntegrations.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}


// ════════════════════════════════════════════════════════════
// CONVERSATION LOCKS — Part 8: Agent Collision Prevention
// ════════════════════════════════════════════════════════════

const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Acquire a soft lock on a conversation. Advisory only — doesn't block sending.
 * Returns the lock info if acquired, or the existing lock holder if someone else has it.
 */
export async function acquireConversationLock(
  tenantId: number,
  waConversationId: number,
  agentId: number,
  agentName?: string,
): Promise<{ acquired: boolean; lock: { agentId: number; agentName: string | null; expiresAt: Date } }> {
  const db = await getDb();
  if (!db) return { acquired: true, lock: { agentId, agentName: agentName || null, expiresAt: new Date(Date.now() + LOCK_DURATION_MS) } };

  // Clean expired locks first
  await db.delete(conversationLocks)
    .where(lt(conversationLocks.expiresAt, new Date()));

  // Check for existing active lock
  const [existing] = await db.select()
    .from(conversationLocks)
    .where(and(
      eq(conversationLocks.tenantId, tenantId),
      eq(conversationLocks.waConversationId, waConversationId),
      gt(conversationLocks.expiresAt, new Date()),
    ))
    .limit(1);

  if (existing) {
    if (existing.agentId === agentId) {
      // Same agent — refresh the lock
      const newExpiry = new Date(Date.now() + LOCK_DURATION_MS);
      await db.update(conversationLocks)
        .set({ expiresAt: newExpiry, lockedAt: new Date() })
        .where(eq(conversationLocks.id, existing.id));
      return { acquired: true, lock: { agentId, agentName: existing.agentName, expiresAt: newExpiry } };
    }
    // Different agent holds the lock
    return { acquired: false, lock: { agentId: existing.agentId, agentName: existing.agentName, expiresAt: existing.expiresAt } };
  }

  // No active lock — create one
  const expiresAt = new Date(Date.now() + LOCK_DURATION_MS);
  await db.insert(conversationLocks).values({
    tenantId,
    waConversationId,
    agentId,
    agentName: agentName || null,
    expiresAt,
  });

  return { acquired: true, lock: { agentId, agentName: agentName || null, expiresAt } };
}

/**
 * Release a conversation lock (when agent navigates away or explicitly releases).
 */
export async function releaseConversationLock(
  tenantId: number,
  waConversationId: number,
  agentId: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(conversationLocks)
    .where(and(
      eq(conversationLocks.tenantId, tenantId),
      eq(conversationLocks.waConversationId, waConversationId),
      eq(conversationLocks.agentId, agentId),
    ));
}

/**
 * Get the current lock holder for a conversation (if any).
 */
export async function getConversationLock(
  tenantId: number,
  waConversationId: number,
): Promise<{ agentId: number; agentName: string | null; expiresAt: Date } | null> {
  const db = await getDb();
  if (!db) return null;

  const [lock] = await db.select()
    .from(conversationLocks)
    .where(and(
      eq(conversationLocks.tenantId, tenantId),
      eq(conversationLocks.waConversationId, waConversationId),
      gt(conversationLocks.expiresAt, new Date()),
    ))
    .limit(1);

  return lock ? { agentId: lock.agentId, agentName: lock.agentName, expiresAt: lock.expiresAt } : null;
}


// ════════════════════════════════════════════════════════════
// AI TRAINING CONFIGS — CRUD helpers
// ════════════════════════════════════════════════════════════

export type AiConfigType = "suggestion" | "summary" | "analysis";

export async function getAiTrainingConfig(tenantId: number, configType: AiConfigType) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(aiTrainingConfigs)
    .where(and(eq(aiTrainingConfigs.tenantId, tenantId), eq(aiTrainingConfigs.configType, configType)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAiTrainingConfigs(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiTrainingConfigs)
    .where(eq(aiTrainingConfigs.tenantId, tenantId))
    .orderBy(aiTrainingConfigs.configType);
}

export async function upsertAiTrainingConfig(data: {
  tenantId: number;
  configType: AiConfigType;
  instructions: string;
  updatedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if exists
  const existing = await getAiTrainingConfig(data.tenantId, data.configType);
  if (existing) {
    await db.update(aiTrainingConfigs)
      .set({ instructions: data.instructions, updatedBy: data.updatedBy })
      .where(and(eq(aiTrainingConfigs.tenantId, data.tenantId), eq(aiTrainingConfigs.configType, data.configType)));
    return { id: existing.id, updated: true };
  } else {
    const result = await db.insert(aiTrainingConfigs).values({
      tenantId: data.tenantId,
      configType: data.configType,
      instructions: data.instructions,
      updatedBy: data.updatedBy,
    }).returning({ id: aiTrainingConfigs.id });
    return { id: Number(result[0].id), updated: false };
  }
}

export async function deleteAiTrainingConfig(tenantId: number, configType: AiConfigType) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(aiTrainingConfigs)
    .where(and(eq(aiTrainingConfigs.tenantId, tenantId), eq(aiTrainingConfigs.configType, configType)));
}

// ════════════════════════════════════════════════════════════
// CENTRALIZED AI CALL — Uses tenant's configured provider
// ════════════════════════════════════════════════════════════

export interface TenantAiCallOptions {
  tenantId: number;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  /** Optional JSON schema for structured responses */
  responseFormat?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
  /** Override: usa essa integracao especifica (em vez da primeira ativa) */
  integrationId?: number;
  /** Override: usa esse modelo (em vez do default da integracao/tenant) */
  overrideModel?: string;
}

export interface TenantAiCallResult {
  content: string;
  provider: string;
  model: string;
  /** Tokens consumidos — usado pelo aiUsageLog. undef quando provider não retornou. */
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

/**
 * Centralized function to call AI using the tenant's configured provider.
 * This replaces all direct invokeLLM calls for tenant-facing AI features.
 * Falls back gracefully if no integration is configured.
 */
export async function callTenantAi(opts: TenantAiCallOptions): Promise<TenantAiCallResult> {
  let integration = opts.integrationId
    ? await getAiIntegration(opts.tenantId, opts.integrationId)
    : null;

  if (!integration) {
    integration = await getAnyActiveAiIntegration(opts.tenantId);
  }
  if (!integration) {
    throw new Error("NO_AI_CONFIGURED");
  }

  if (!integration.isActive) {
    throw new Error("NO_AI_CONFIGURED");
  }

  const settings = await getTenantAiSettings(opts.tenantId);
  const model = opts.overrideModel || settings.defaultAiModel || integration.defaultModel;

  if (integration.provider === "openai") {
    return callOpenAiForTenant(integration.apiKey, model, opts);
  } else {
    return callAnthropicForTenant(integration.apiKey, model, opts);
  }
}

async function callOpenAiForTenant(
  apiKey: string,
  model: string,
  opts: TenantAiCallOptions,
): Promise<TenantAiCallResult> {
  const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
  const systemRole = isReasoningModel ? "developer" : "system";
  const tokenParam = isReasoningModel
    ? { max_completion_tokens: opts.maxTokens ?? 1024 }
    : { max_tokens: opts.maxTokens ?? 1024 };

  const formattedMessages = opts.messages.map(m => ({
    role: m.role === "system" ? systemRole : m.role,
    content: m.content,
  }));

  const requestBody: Record<string, unknown> = {
    model,
    messages: formattedMessages,
    ...tokenParam,
  };

  if (isReasoningModel) {
    requestBody.reasoning_effort = "low";
  }

  if (opts.responseFormat) {
    requestBody.response_format = opts.responseFormat;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `OpenAI API error: HTTP ${res.status}`);
    }

    const data = await res.json();
    const inputTokens = data.usage?.prompt_tokens;
    const outputTokens = data.usage?.completion_tokens;
    const totalTokens = data.usage?.total_tokens
      ?? (typeof inputTokens === "number" && typeof outputTokens === "number" ? inputTokens + outputTokens : undefined);
    return {
      content: data.choices?.[0]?.message?.content || "",
      provider: "openai",
      model: data.model || model,
      inputTokens,
      outputTokens,
      totalTokens,
    };
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error(`O modelo ${model} demorou demais para responder (timeout 60s).`);
    }
    throw err;
  }
}

async function callAnthropicForTenant(
  apiKey: string,
  model: string,
  opts: TenantAiCallOptions,
): Promise<TenantAiCallResult> {
  const systemMsg = opts.messages.find(m => m.role === "system");
  const nonSystemMsgs = opts.messages.filter(m => m.role !== "system");

  const body: Record<string, unknown> = {
    model,
    messages: nonSystemMsgs.map(m => ({ role: m.role, content: m.content })),
    max_tokens: opts.maxTokens ?? 1024,
  };

  if (systemMsg) {
    body.system = systemMsg.content;
  }

  // Anthropic doesn't support json_schema natively, but we can ask for JSON in the prompt
  // The response_format hint is handled by the system prompt

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Anthropic API error: HTTP ${res.status}`);
    }

    const data = await res.json();
    const inputTokens = data.usage?.input_tokens;
    const outputTokens = data.usage?.output_tokens;
    const totalTokens = typeof inputTokens === "number" && typeof outputTokens === "number"
      ? inputTokens + outputTokens
      : undefined;
    return {
      content: data.content?.[0]?.text || "",
      provider: "anthropic",
      model: data.model || model,
      inputTokens,
      outputTokens,
      totalTokens,
    };
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error(`O modelo ${model} demorou demais para responder (timeout 60s).`);
    }
    throw err;
  }
}


// ════════════════════════════════════════════════════════════
// DEAL FILES — Repositório de arquivos vinculados a negociações
// ════════════════════════════════════════════════════════════
import { dealFiles, type InsertDealFile } from "../drizzle/schema";

export async function listDealFiles(tenantId: number, dealId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dealFiles)
    .where(and(eq(dealFiles.tenantId, tenantId), eq(dealFiles.dealId, dealId), isNull(dealFiles.deletedAt)))
    .orderBy(desc(dealFiles.createdAt));
}

export async function createDealFile(data: InsertDealFile) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(dealFiles).values(data).returning({ id: dealFiles.id });
  return result;
}

export async function deleteDealFile(tenantId: number, fileId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Soft-delete
  await db.update(dealFiles)
    .set({ deletedAt: new Date() })
    .where(and(eq(dealFiles.id, fileId), eq(dealFiles.tenantId, tenantId)));
}

export async function getDealFile(tenantId: number, fileId: number) {
  const db = await getDb();
  if (!db) return null;
  const [file] = await db.select().from(dealFiles)
    .where(and(eq(dealFiles.id, fileId), eq(dealFiles.tenantId, tenantId), isNull(dealFiles.deletedAt)))
    .limit(1);
  return file || null;
}

export async function countDealFiles(tenantId: number, dealId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(dealFiles)
    .where(and(eq(dealFiles.tenantId, tenantId), eq(dealFiles.dealId, dealId), isNull(dealFiles.deletedAt)));
  return result?.count || 0;
}

// ════════════════════════════════════════════════════════════
// HELPDESK — Agent Availability & Presence
// (porta entur-os-crm — Phase 6, exposto via tRPC whatsapp.supervision.{set,get}Availability)
// ════════════════════════════════════════════════════════════

export type AvailabilityStatus = "auto" | "available" | "away" | "busy" | "offline";

export async function updateAgentAvailability(tenantId: number, userId: number, status: AvailabilityStatus) {
  const db = await getDb();
  if (!db) return null;
  await db.update(crmUsers)
    .set({ availabilityStatus: status })
    .where(and(eq(crmUsers.tenantId, tenantId), eq(crmUsers.id, userId)));
  try {
    const { emitToTenant } = await import("./socketSingleton");
    emitToTenant("agentPresenceChanged", { userId, availabilityStatus: status, tenantId, timestamp: Date.now() }, tenantId);
  } catch {}
  return { userId, availabilityStatus: status };
}

export async function getAgentAvailability(tenantId: number, userId: number): Promise<AvailabilityStatus> {
  const db = await getDb();
  if (!db) return "auto";
  const [row] = await db.select({ availabilityStatus: crmUsers.availabilityStatus })
    .from(crmUsers)
    .where(and(eq(crmUsers.tenantId, tenantId), eq(crmUsers.id, userId)))
    .limit(1);
  return (row?.availabilityStatus as AvailabilityStatus) || "auto";
}

export async function getAvailableAgentIds(tenantId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT cu.id FROM crm_users cu
    WHERE cu."tenantId" = ${tenantId}
      AND cu.status = 'active'
      AND (
        cu."availabilityStatus" = 'available'
        OR (cu."availabilityStatus" = 'auto' AND cu."lastActiveAt" >= NOW() - INTERVAL '5 minutes')
      )
  `);
  const rows = (result as any).rows || (result as any) || [];
  return rows.map((r: any) => Number(r.id));
}

// ════════════════════════════════════════════════════════════
// HELPDESK — Settings + SLA + queue distribution + idle agents
// (porta entur-os-crm — usado por slaEnforcement / idleAgent / helpdeskDistribution schedulers)
// ════════════════════════════════════════════════════════════

export interface HelpdeskSettings {
  autoDistributionEnabled: boolean;
  slaFirstResponseMinutes: number;
  slaResolutionMinutes: number;
  idleAgentTimeoutMinutes: number;
  slaBreachAction: "notify" | "reassign" | "escalate";
}

const HELPDESK_DEFAULTS: HelpdeskSettings = {
  autoDistributionEnabled: false,
  slaFirstResponseMinutes: 30,
  slaResolutionMinutes: 480,
  idleAgentTimeoutMinutes: 0,
  slaBreachAction: "notify",
};

function sanitizeHelpdeskSettingsJson(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return sanitizeHelpdeskSettingsJson(parsed);
      }
    } catch {}
    return {};
  }
  if (typeof raw !== "object") return {};
  return raw as Record<string, unknown>;
}

export async function getHelpdeskSettings(tenantId: number): Promise<HelpdeskSettings> {
  const db = await getDb();
  if (!db) return { ...HELPDESK_DEFAULTS };
  const rows = await db.select({ settingsJson: tenants.settingsJson }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const raw = sanitizeHelpdeskSettingsJson(rows[0]?.settingsJson);
  const h = (raw.helpdesk || {}) as Partial<HelpdeskSettings>;
  return { ...HELPDESK_DEFAULTS, ...h };
}

export async function updateHelpdeskSettings(tenantId: number, patch: Partial<HelpdeskSettings>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ settingsJson: tenants.settingsJson }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const existing = sanitizeHelpdeskSettingsJson(rows[0]?.settingsJson);
  const currentHelpdesk = (existing.helpdesk || {}) as Partial<HelpdeskSettings>;
  const merged = { ...existing, helpdesk: { ...HELPDESK_DEFAULTS, ...currentHelpdesk, ...patch } };
  await db.update(tenants).set({ settingsJson: merged }).where(eq(tenants.id, tenantId));
  return merged.helpdesk;
}

export async function getQueuedConversationsForDistribution(tenantId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT wc.id, wc."tenantId", wc."sessionId", wc."remoteJid", wc."queuedAt"
    FROM wa_conversations wc
    WHERE wc."tenantId" = ${tenantId}
      AND wc."assignedUserId" IS NULL
      AND wc."queuedAt" IS NOT NULL
      AND wc.status IN ('open', 'pending')
      AND wc."mergedIntoId" IS NULL
    ORDER BY wc."queuedAt" ASC
    LIMIT ${limit}
  `);
  return (result as any).rows || (result as any) || [];
}

export async function getTenantsWithAutoDistribution(): Promise<{ id: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT id FROM tenants
    WHERE "settingsJson"->>'helpdesk' IS NOT NULL
      AND ("settingsJson"->'helpdesk'->>'autoDistributionEnabled')::boolean = true
  `);
  return ((result as any).rows || (result as any) || []) as { id: number }[];
}

export async function setSlaDeadline(tenantId: number, conversationId: number) {
  const db = await getDb();
  if (!db) return;
  const settings = await getHelpdeskSettings(tenantId);
  if (!settings.slaFirstResponseMinutes && !settings.slaResolutionMinutes) return;

  const [conv] = await db.select({ firstResponseAt: waConversations.firstResponseAt })
    .from(waConversations).where(eq(waConversations.id, conversationId)).limit(1);

  const minutes = conv?.firstResponseAt ? settings.slaResolutionMinutes : settings.slaFirstResponseMinutes;
  if (!minutes) return;

  const deadline = new Date(Date.now() + minutes * 60 * 1000);
  await db.update(waConversations).set({ slaDeadlineAt: deadline }).where(eq(waConversations.id, conversationId));
}

export async function getTenantsWithSla(): Promise<{ id: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT id FROM tenants
    WHERE "settingsJson"->>'helpdesk' IS NOT NULL
      AND (
        COALESCE(("settingsJson"->'helpdesk'->>'slaFirstResponseMinutes')::int, 0) > 0
        OR COALESCE(("settingsJson"->'helpdesk'->>'slaResolutionMinutes')::int, 0) > 0
      )
  `);
  return ((result as any).rows || (result as any) || []) as { id: number }[];
}

export async function getBreachedConversations(tenantId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT wc.id, wc."tenantId", wc."sessionId", wc."remoteJid", wc."slaDeadlineAt",
           wc."assignedUserId", wc."firstResponseAt"
    FROM wa_conversations wc
    WHERE wc."tenantId" = ${tenantId}
      AND wc."slaDeadlineAt" IS NOT NULL
      AND wc."slaDeadlineAt" <= NOW()
      AND wc."slaBreachedAt" IS NULL
      AND wc.status IN ('open', 'pending')
      AND wc."mergedIntoId" IS NULL
    LIMIT ${limit}
  `);
  return (result as any).rows || (result as any) || [];
}

export async function markSlaBreached(conversationId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(waConversations).set({ slaBreachedAt: new Date() }).where(eq(waConversations.id, conversationId));
}

export async function updateFirstResponseAt(tenantId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.execute(sql`
    UPDATE wa_conversations wc
    SET "firstResponseAt" = sub.first_out
    FROM (
      SELECT wm."waConversationId", MIN(wm.timestamp) AS first_out
      FROM messages wm
      JOIN wa_conversations wc2 ON wc2.id = wm."waConversationId"
      WHERE wc2."tenantId" = ${tenantId}
        AND wc2."firstResponseAt" IS NULL
        AND wc2."assignedUserId" IS NOT NULL
        AND wc2.status IN ('open', 'pending')
        AND wm."fromMe" = true
      GROUP BY wm."waConversationId"
    ) sub
    WHERE wc.id = sub."waConversationId"
      AND wc."firstResponseAt" IS NULL
  `);
  return (result as any).rowCount || 0;
}

export async function getIdleAgentConversations(tenantId: number, timeoutMinutes: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT wc.id, wc."sessionId", wc."remoteJid", wc."assignedUserId"
    FROM wa_conversations wc
    JOIN crm_users cu ON cu.id = wc."assignedUserId" AND cu."tenantId" = ${tenantId}
    WHERE wc."tenantId" = ${tenantId}
      AND wc."assignedUserId" IS NOT NULL
      AND wc.status IN ('open', 'pending')
      AND wc."mergedIntoId" IS NULL
      AND cu."lastActiveAt" < NOW() - INTERVAL '1 minute' * ${timeoutMinutes}
      AND cu."availabilityStatus" IN ('auto', 'offline')
    ORDER BY wc."queuedAt" ASC NULLS LAST
  `);
  return (result as any).rows || (result as any) || [];
}

export async function getTenantsWithIdleTimeout(): Promise<{ id: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT id FROM tenants
    WHERE "settingsJson"->>'helpdesk' IS NOT NULL
      AND COALESCE(("settingsJson"->'helpdesk'->>'idleAgentTimeoutMinutes')::int, 0) > 0
  `);
  return ((result as any).rows || (result as any) || []) as { id: number }[];
}
