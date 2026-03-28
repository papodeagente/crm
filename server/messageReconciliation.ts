/**
 * Safe Message Reconciliation
 *
 * Lightweight background task that reconciles recent messages
 * from Z-API API to prevent message loss.
 *
 * Strict limits:
 * - Max 20 conversations per cycle (only those with activity in last 24h)
 * - Max 10 messages per conversation
 * - Runs every 3 minutes
 * - Skips if CPU > 70% or Redis queue is overloaded
 * - Deduplicates by messageId before insert
 *
 * Maximum additional load: ~200 message checks per cycle.
 */

import { getDb } from "./db";
import { waConversations, waMessages } from "../drizzle/schema";
import { eq, and, sql, gt, desc } from "drizzle-orm";
// Z-API API removed — Z-API only
import { normalizeToUnixSeconds } from "./providers/zapiProvider";
import { resolveProviderForSession } from "./providers/providerFactory";
import { resolveInbound, updateConversationLastMessage } from "./conversationResolver";
import os from "os";

// ─── CONSTANTS ──────────────────────────────────────────────
// Reduced from 10 to 5 conversations per cycle to lower Z-API API load
const MAX_CONVERSATIONS_PER_CYCLE = 5;
const MAX_MESSAGES_PER_CONVERSATION = 15;
// Increased from 5 to 10 minutes to reduce API call frequency
const RECONCILIATION_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
// Part 14: server load protection
const CPU_THRESHOLD = 0.70; // 70%
const QUEUE_LENGTH_THRESHOLD = 500;
// Part 11: only reconcile conversations with activity in last 48h
const RECENT_WINDOW_HOURS = 48;

// ─── STATE ──────────────────────────────────────────────────
let reconciliationInterval: ReturnType<typeof setInterval> | null = null;
let isReconciling = false;

// ─── CPU CHECK ──────────────────────────────────────────────
function getCpuUsage(): number {
  const cpus = os.cpus();
  if (!cpus.length) return 0;
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    totalIdle += cpu.times.idle;
    totalTick += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }
  return 1 - (totalIdle / totalTick);
}

// ─── QUEUE CHECK ────────────────────────────────────────────
async function getQueueLength(): Promise<number> {
  try {
    const { getQueueStats, isQueueEnabled } = await import("./messageQueue");
    if (!isQueueEnabled()) return 0;
    const stats = await getQueueStats();
    if (!stats) return 0;
    return stats.waiting + stats.active;
  } catch {
    return 0;
  }
}

// ─── BACKOFF CHECK ──────────────────────────────────────────
async function shouldSkipReconciliation(): Promise<{ skip: boolean; reason?: string }> {
  // Check CPU
  const cpuUsage = getCpuUsage();
  if (cpuUsage > CPU_THRESHOLD) {
    return { skip: true, reason: `CPU usage ${(cpuUsage * 100).toFixed(1)}% > ${CPU_THRESHOLD * 100}%` };
  }

  // Check Redis queue
  const queueLength = await getQueueLength();
  if (queueLength > QUEUE_LENGTH_THRESHOLD) {
    return { skip: true, reason: `Queue length ${queueLength} > ${QUEUE_LENGTH_THRESHOLD}` };
  }

  return { skip: false };
}

// ─── MAIN RECONCILIATION ───────────────────────────────────
export async function reconcileRecentMessages(
  sessions: Map<string, { sessionId: string; tenantId: number; instanceName: string; status: string }>
): Promise<{ reconciled: number; skipped: number; inserted: number }> {
  if (isReconciling) {
    console.log("[Reconciliation] Already in progress, skipping");
    return { reconciled: 0, skipped: 0, inserted: 0 };
  }

  // Backoff check
  const backoff = await shouldSkipReconciliation();
  if (backoff.skip) {
    console.log(`[Reconciliation] Skipped: ${backoff.reason}`);
    return { reconciled: 0, skipped: 0, inserted: 0 };
  }

  isReconciling = true;
  let totalReconciled = 0;
  let totalSkipped = 0;
  let totalInserted = 0;

  try {
    const db = await getDb();
    if (!db) return { reconciled: 0, skipped: 0, inserted: 0 };

    // For each connected session
    const sessionEntries = Array.from(sessions.values());
    for (const session of sessionEntries) {
      if (session.status !== "connected") continue;

      try {
        const result = await reconcileSessionMessages(db, session);
        totalReconciled += result.reconciled;
        totalSkipped += result.skipped;
        totalInserted += result.inserted;
      } catch (e: any) {
        console.warn(`[Reconciliation] Error for session ${session.sessionId}:`, e.message);
      }
    }

    if (totalInserted > 0) {
      console.log(`[Reconciliation] Complete: ${totalReconciled} convs checked, ${totalInserted} new msgs, ${totalSkipped} dupes`);
    }
  } finally {
    isReconciling = false;
  }

  return { reconciled: totalReconciled, skipped: totalSkipped, inserted: totalInserted };
}

// ─── PER-SESSION RECONCILIATION ─────────────────────────────
async function reconcileSessionMessages(
  db: any,
  session: { sessionId: string; tenantId: number; instanceName: string }
): Promise<{ reconciled: number; skipped: number; inserted: number }> {
  // Get conversations with activity in last 24h, limited to MAX_CONVERSATIONS_PER_CYCLE
  const cutoff = new Date(Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000);

  const recentConvs = await db
    .select({
      id: waConversations.id,
      remoteJid: waConversations.remoteJid,
      lastMessageAt: waConversations.lastMessageAt,
    })
    .from(waConversations)
    .where(
      and(
        eq(waConversations.sessionId, session.sessionId),
        gt(waConversations.lastMessageAt, cutoff)
      )
    )
    .orderBy(desc(waConversations.lastMessageAt))
    .limit(MAX_CONVERSATIONS_PER_CYCLE);

  if (recentConvs.length === 0) return { reconciled: 0, skipped: 0, inserted: 0 };

  let totalSkipped = 0;
  let totalInserted = 0;

  for (const conv of recentConvs) {
    try {
      const result = await reconcileConversation(db, session, conv);
      totalSkipped += result.skipped;
      totalInserted += result.inserted;
    } catch (e: any) {
      console.warn(`[Reconciliation] Error for ${conv.remoteJid}:`, e.message);
    }

    // Small delay between conversations to avoid overloading
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return { reconciled: recentConvs.length, skipped: totalSkipped, inserted: totalInserted };
}

// ─── PER-CONVERSATION RECONCILIATION ────────────────────────
async function reconcileConversation(
  db: any,
  session: { sessionId: string; tenantId: number; instanceName: string },
  conv: { id: number; remoteJid: string; lastMessageAt: Date | null }
): Promise<{ skipped: number; inserted: number }> {
  // Pre-load existing messageIds for this conversation
  const existingRows = await db.execute(
    sql`SELECT messageId FROM messages WHERE sessionId = ${session.sessionId} AND remoteJid = ${conv.remoteJid} AND messageId IS NOT NULL ORDER BY id DESC LIMIT 100`
  );
  const existingMsgIds = new Set<string>();
  const rows = (existingRows as any)[0] || [];
  for (const r of rows) {
    if (r.messageId) existingMsgIds.add(r.messageId);
  }

  // Part 10/12: Fetch last MAX_MESSAGES_PER_CONVERSATION messages from provider
  // Use provider factory to resolve the correct provider for this session
  let messages: any[];
  try {
    const provider = await resolveProviderForSession(session.sessionId);
    messages = await provider.findMessages(session.instanceName, conv.remoteJid, {
      limit: MAX_MESSAGES_PER_CONVERSATION,
      page: 1,
    });
  } catch (err: any) {
    console.warn(`[Reconciliation] Provider findMessages failed for ${conv.remoteJid}:`, err.message);
    messages = [];
  }

  if (!messages || messages.length === 0) return { skipped: 0, inserted: 0 };

  let skipped = 0;
  let inserted = 0;
  let newestMsg: { content: string; messageType: string; fromMe: boolean; status: string; timestamp: Date } | null = null;

  for (const msg of messages) {
    const msgId = msg.key?.id;
    if (!msgId) continue;

    // Duplicate check
    if (existingMsgIds.has(msgId)) {
      skipped++;
      continue;
    }

    const fromMe = msg.key?.fromMe || false;
    const messageType = msg.messageType || "conversation";
    const skipTypes = ["protocolMessage", "senderKeyDistributionMessage", "messageContextInfo", "ephemeralMessage"];
    if (skipTypes.includes(messageType)) continue;

    const timestamp = new Date(normalizeToUnixSeconds(msg.messageTimestamp) * 1000);

    const pushName = msg.pushName || null;
    const msgContent = msg.message;
    let content = "";
    if (msgContent) {
      content =
        msgContent.conversation ||
        msgContent.extendedTextMessage?.text ||
        (msgContent.imageMessage?.caption ? `[Imagem] ${msgContent.imageMessage.caption}` : "") ||
        (msgContent.imageMessage ? "[Imagem]" : "") ||
        (msgContent.videoMessage?.caption ? `[Vídeo] ${msgContent.videoMessage.caption}` : "") ||
        (msgContent.videoMessage ? "[Vídeo]" : "") ||
        (msgContent.audioMessage ? "[Áudio]" : "") ||
        (msgContent.documentMessage ? `[Documento] ${msgContent.documentMessage.fileName || ""}` : "") ||
        (msgContent.stickerMessage ? "[Sticker]" : "") ||
        (msgContent.contactMessage ? `[Contato] ${msgContent.contactMessage.displayName || ""}` : "") ||
        (msgContent.locationMessage ? "[Localização]" : "") ||
        "";
    }

    let msgStatus = fromMe ? "sent" : "received";
    const rawStatus = msg.status;
    if (fromMe && typeof rawStatus === "number") {
      const statusMap: Record<number, string> = { 0: "error", 1: "pending", 2: "sent", 3: "delivered", 4: "read", 5: "played" };
      msgStatus = statusMap[rawStatus] || "sent";
    }

    // INSERT IGNORE to prevent duplicates
    try {
      const insertResult = await db.execute(
        sql`INSERT IGNORE INTO messages (sessionId, tenantId, messageId, remoteJid, fromMe, messageType, content, pushName, status, timestamp)
            VALUES (${session.sessionId}, ${session.tenantId}, ${msgId}, ${conv.remoteJid}, ${fromMe}, ${messageType}, ${content || null}, ${fromMe ? null : (pushName || null)}, ${msgStatus}, ${timestamp})`
      );

      const affectedRows = (insertResult as any)[0]?.affectedRows ?? 0;
      if (affectedRows > 0) {
        inserted++;
        existingMsgIds.add(msgId);

        // Track newest message for conversation preview update
        if (!newestMsg || timestamp.getTime() > newestMsg.timestamp.getTime()) {
          newestMsg = { content: content || "", messageType, fromMe, status: msgStatus, timestamp };
        }
      }
    } catch (e: any) {
      // Silently skip insert errors (duplicates, etc.)
    }
  }

  // Update conversation preview if we found new messages
  if (newestMsg) {
    try {
      await updateConversationLastMessage(conv.id, {
        content: newestMsg.content,
        messageType: newestMsg.messageType,
        fromMe: newestMsg.fromMe,
        status: newestMsg.status,
        timestamp: newestMsg.timestamp,
        incrementUnread: !newestMsg.fromMe,
      });
    } catch {}
  }

  return { skipped, inserted };
}

// ─── SYNC ON CONVERSATION OPEN ──────────────────────────────
/**
 * Part 12: Lightweight sync triggered when an agent opens a conversation.
 * Fetches last 15 messages and inserts only missing ones.
 * Part 13: Deduplicates by messageId before insert.
 */
export async function syncOnConversationOpen(
  sessionId: string,
  tenantId: number,
  instanceName: string,
  remoteJid: string,
  conversationId: number
): Promise<{ inserted: number; skipped: number }> {
  const db = await getDb();
  if (!db) return { inserted: 0, skipped: 0 };

  const conv = { id: conversationId, remoteJid, lastMessageAt: null };
  const session = { sessionId, tenantId, instanceName };

  return reconcileConversation(db, session, conv);
}

// ─── LIFECYCLE ──────────────────────────────────────────────
export function startReconciliation(
  getSessions: () => Map<string, { sessionId: string; tenantId: number; instanceName: string; status: string }>
): void {
  if (reconciliationInterval) return;

  console.log(`[Reconciliation] Starting (every ${RECONCILIATION_INTERVAL_MS / 1000}s, max ${MAX_CONVERSATIONS_PER_CYCLE} convs, ${MAX_MESSAGES_PER_CONVERSATION} msgs/conv)`);

  reconciliationInterval = setInterval(() => {
    reconcileRecentMessages(getSessions()).catch(e =>
      console.error("[Reconciliation] Error:", e.message)
    );
  }, RECONCILIATION_INTERVAL_MS);
}

export function stopReconciliation(): void {
  if (reconciliationInterval) {
    clearInterval(reconciliationInterval);
    reconciliationInterval = null;
    console.log("[Reconciliation] Stopped");
  }
}
