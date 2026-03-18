/**
 * Message Worker — Processes queued webhook events asynchronously
 * 
 * Handles ALL message-related events:
 * 1. messages.upsert / send.message → Insert new messages (all types incl. sticker)
 * 2. messages.update → Status updates (sent ✓ / delivered ✓✓ / read ✓✓ blue)
 * 3. messages.delete → Mark messages as deleted
 * 
 * Processing flow for new messages:
 * a. Validate & dedup by messageId
 * b. Insert message into DB
 * c. Resolve conversation (upsert wa_conversations)
 * d. Update lastMessage + incremental unreadCount
 * e. Emit Socket.IO event
 * f. Background: media download, contact update, notification
 * 
 * This worker is started from server/_core/index.ts alongside the Express server.
 */

import { getDb, getTenantAiSettings } from "./db";
import { and, eq, sql } from "drizzle-orm";
import { waMessages, waContacts, waConversations } from "../drizzle/schema";
import { resolveInbound, updateConversationLastMessage, propagateLatestMessageToConversation, getConversationByJid } from "./conversationResolver";
import { storagePut } from "./storage";
import { createNotification } from "./db";
import * as evo from "./evolutionApi";
import { nanoid } from "nanoid";
import type { MessageEventPayload } from "./messageQueue";
import { startMessageWorker, isQueueEnabled, isRedisReady } from "./messageQueue";

// ── Types ──────────────────────────────────────────────────────

interface SessionInfo {
  sessionId: string;
  tenantId: number;
  instanceName: string;
}

// ── Session Resolver ───────────────────────────────────────────

// The worker needs to resolve session info from instanceName
// We import the whatsappManager lazily to avoid circular deps
async function getSessionInfo(instanceName: string, sessionId?: string): Promise<SessionInfo | null> {
  const { whatsappManager } = await import("./whatsappEvolution");
  
  // Try to get from in-memory sessions
  if (sessionId) {
    const session = whatsappManager.getSession(sessionId);
    if (session) {
      return {
        sessionId: session.sessionId,
        tenantId: session.tenantId,
        instanceName: session.instanceName,
      };
    }
  }

  // Fallback: try to find session by iterating active sessions
  const allSessions = whatsappManager.getAllSessions();
  for (const s of allSessions) {
    if (s.instanceName === instanceName) {
      return {
        sessionId: s.sessionId,
        tenantId: s.tenantId,
        instanceName: s.instanceName,
      };
    }
  }

  return null;
}

// ── Message Content Extraction ─────────────────────────────────

function extractMessageContent(data: any): string | null {
  if (!data?.message) {
    return data?.body || data?.conversation || null;
  }

  const msg = data.message;
  
  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage?.caption) return msg.imageMessage.caption;
  if (msg.videoMessage?.caption) return msg.videoMessage.caption;
  if (msg.documentMessage?.caption) return msg.documentMessage.caption;
  if (msg.documentMessage?.fileName) return `📄 ${msg.documentMessage.fileName}`;
  if (msg.stickerMessage) return "🏷️ Figurinha";
  if (msg.audioMessage || msg.pttMessage) return "🎵 Áudio";
  if (msg.imageMessage) return "📷 Imagem";
  if (msg.videoMessage) return "🎥 Vídeo";
  if (msg.contactMessage) return `👤 ${msg.contactMessage.displayName || "Contato"}`;
  if (msg.locationMessage) return "📍 Localização";
  if (msg.listResponseMessage?.title) return msg.listResponseMessage.title;
  if (msg.buttonsResponseMessage?.selectedDisplayText) return msg.buttonsResponseMessage.selectedDisplayText;
  if (msg.templateButtonReplyMessage?.selectedDisplayText) return msg.templateButtonReplyMessage.selectedDisplayText;
  if (msg.reactionMessage?.text) return `${msg.reactionMessage.text}`;

  return data?.body || null;
}

function extractMediaInfo(data: any): {
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  mediaDuration?: number | null;
  isVoiceNote?: boolean;
  quotedMessageId?: string | null;
} {
  const msg = data?.message;
  if (!msg) return {};

  const result: any = {};

  // Check for quoted message
  const contextInfo = msg.extendedTextMessage?.contextInfo ||
    msg.imageMessage?.contextInfo ||
    msg.videoMessage?.contextInfo ||
    msg.audioMessage?.contextInfo ||
    msg.documentMessage?.contextInfo ||
    msg.stickerMessage?.contextInfo;
  if (contextInfo?.quotedMessage) {
    result.quotedMessageId = contextInfo.stanzaId || null;
  }

  // Media types — including stickerMessage
  const mediaTypes = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage", "pttMessage"];
  for (const type of mediaTypes) {
    if (msg[type]) {
      result.mediaUrl = msg[type].url || data?.media?.url || null;
      result.mediaMimeType = msg[type].mimetype || null;
      result.mediaFileName = msg[type].fileName || null;
      result.mediaDuration = msg[type].seconds || null;
      result.isVoiceNote = type === "pttMessage" || (type === "audioMessage" && msg[type].ptt);
      break;
    }
  }

  return result;
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
    "application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  return map[mime] || mime.split("/")[1] || "bin";
}

// ── Determine message type from payload ───────────────────────

/**
 * Determine the actual message type from the Evolution API payload.
 * The messageType field from Evolution may not always be accurate,
 * so we also inspect the message object directly.
 */
function resolveMessageType(data: any): string {
  const reportedType = data?.messageType || "conversation";
  const msg = data?.message;
  
  if (!msg) return reportedType;
  
  // Check actual message content to determine type
  if (msg.stickerMessage) return "stickerMessage";
  if (msg.imageMessage) return "imageMessage";
  if (msg.videoMessage) return "videoMessage";
  if (msg.audioMessage) return "audioMessage";
  if (msg.pttMessage) return "pttMessage";
  if (msg.documentMessage) return "documentMessage";
  if (msg.extendedTextMessage) return "extendedTextMessage";
  if (msg.conversation) return "conversation";
  if (msg.contactMessage) return "contactMessage";
  if (msg.locationMessage) return "locationMessage";
  if (msg.listResponseMessage) return "listResponseMessage";
  if (msg.buttonsResponseMessage) return "buttonsResponseMessage";
  if (msg.templateButtonReplyMessage) return "templateButtonReplyMessage";
  if (msg.reactionMessage) return "reactionMessage";
  
  return reportedType;
}

// ── Status Maps ───────────────────────────────────────────────

const NUMERIC_STATUS_MAP: Record<number, string> = {
  0: "error", 1: "pending", 2: "sent", 3: "delivered", 4: "read", 5: "played",
};

const STRING_STATUS_MAP: Record<string, string> = {
  "ERROR": "error", "PENDING": "pending", "SENT": "sent",
  "SERVER_ACK": "sent", "DELIVERY_ACK": "delivered", "DELIVERED": "delivered",
  "READ": "read", "PLAYED": "played", "DELETED": "deleted",
};

// ── MONOTONIC STATUS PRECEDENCE ──────────────────────────────
// Status must NEVER go backwards. Higher number = higher precedence.
const STATUS_PRECEDENCE: Record<string, number> = {
  error: 0, pending: 1, sent: 2, delivered: 3, read: 4, played: 5, deleted: 6,
};

/** Returns true if newStatus has higher precedence than currentStatus */
function isStatusUpgrade(currentStatus: string | null | undefined, newStatus: string): boolean {
  const current = STATUS_PRECEDENCE[currentStatus || ""] ?? -1;
  const incoming = STATUS_PRECEDENCE[newStatus] ?? -1;
  return incoming > current;
}

// ── Core Event Processor ──────────────────────────────────────

/**
 * Process a single event from the queue.
 * Routes to the appropriate handler based on event type.
 */
export async function processMessageEvent(payload: MessageEventPayload): Promise<void> {
  const workerStartTime = Date.now();
  const { event, data, sessionId: payloadSessionId, instanceName, receivedAt } = payload;
  const msgId = data?.key?.id || 'N/A';
  console.log(`[TRACE][WORKER_START] timestamp: ${workerStartTime} | delta_from_webhook: ${receivedAt ? workerStartTime - receivedAt : 'N/A'}ms | event: ${event} | msgId: ${msgId}`);

  // Resolve session for all event types
  const session = await getSessionInfo(instanceName, payloadSessionId);
  const sessionResolveTime = Date.now();
  console.log(`[TRACE][SESSION_RESOLVED] timestamp: ${sessionResolveTime} | delta: ${sessionResolveTime - workerStartTime}ms | msgId: ${msgId}`);
  if (!session) {
    console.warn(`[Worker] No session found for instance: ${instanceName} (event: ${event})`);
    return;
  }

  switch (event) {
    case "messages.upsert":
    case "send.message":
      await processNewMessage(session, data, workerStartTime);
      break;

    case "messages.update":
      await processStatusUpdate(session, data);
      break;

    case "messages.delete":
      await processMessageDelete(session, data);
      break;

    default:
      // Delegate unknown events back to the manager
      const { whatsappManager } = await import("./whatsappEvolution");
      await whatsappManager.handleWebhookEvent({
        event: event as import("./evolutionApi").WebhookEventType,
        instance: instanceName,
        data,
      });
      break;
  }
}

// ── New Message Handler ───────────────────────────────────────

async function processNewMessage(session: SessionInfo, data: any, workerStartTime?: number): Promise<void> {
  const { sessionId, tenantId } = session;
  const _traceStart = workerStartTime || Date.now();

  try {
    const key = data?.key;
    if (!key?.remoteJid) return;

    // Skip groups, broadcast, LID
    if (key.remoteJid === "status@broadcast") return;
    if (key.remoteJid.endsWith("@g.us")) return;
    if (key.remoteJid.endsWith("@lid")) return;

    // Resolve the actual message type from the payload
    const messageType = resolveMessageType(data);

    // Only skip truly non-content protocol messages
    // senderKeyDistributionMessage and messageContextInfo are internal WhatsApp protocol
    // ephemeralMessage is a wrapper, not actual content
    // protocolMessage can be a delete notification — but those come via messages.delete event
    const skipTypes = ["senderKeyDistributionMessage", "messageContextInfo", "ephemeralMessage"];
    if (skipTypes.includes(messageType)) return;

    // protocolMessage: check if it contains a delete notification
    if (messageType === "protocolMessage") {
      const protoMsg = data?.message?.protocolMessage;
      if (protoMsg?.type === 0 || protoMsg?.type === "REVOKE") {
        // This is a message revoke/delete — handle it
        const deletedMsgId = protoMsg?.key?.id;
        if (deletedMsgId) {
          await processMessageDelete(session, { key: { id: deletedMsgId, remoteJid: key.remoteJid } });
        }
        return;
      }
      // Other protocol messages (ephemeral settings, etc.) — skip
      return;
    }

    const fromMe = key.fromMe || false;
    const remoteJid = key.remoteJid;
    const messageId = key.id;
    const pushName = data?.pushName || "";
    const timestamp = data?.messageTimestamp ? Number(data.messageTimestamp) * 1000 : Date.now();

    const content = extractMessageContent(data);
    const mediaInfo = extractMediaInfo(data);

    const db = await getDb();
    if (!db) return;

    // ── Step 1: Dedup ──
    const dedupStart = Date.now();
    if (messageId) {
      const existing = await db.select({ id: waMessages.id })
        .from(waMessages)
        .where(and(
          eq(waMessages.sessionId, sessionId),
          eq(waMessages.messageId, messageId)
        ))
        .limit(1);

      if (existing.length > 0) {
        console.log(`[TRACE][DEDUP_HIT] timestamp: ${Date.now()} | delta: ${Date.now() - dedupStart}ms | msgId: ${messageId} — skipped (duplicate)`);
        return;
      }
    }
    console.log(`[TRACE][DEDUP_CHECK] timestamp: ${Date.now()} | delta: ${Date.now() - dedupStart}ms | msgId: ${messageId}`);

    // ── Step 2: Insert message ──
    // Determine sentVia: if fromMe and coming via webhook (not CRM send flow),
    // it was sent from another device (WhatsApp mobile/web).
    // CRM send flow sets sentVia='crm' explicitly in the router.
    // Webhook-originated fromMe messages default to 'other_device'.
    const sentVia = fromMe ? "other_device" : null;

    const insertStart = Date.now();
    await db.insert(waMessages).values({
      sessionId,
      tenantId,
      messageId: messageId || null,
      remoteJid,
      fromMe,
      messageType,
      content: content || null,
      pushName: fromMe ? null : (pushName || null),
      sentVia,
      status: fromMe ? "sent" : "received",
      timestamp: new Date(timestamp),
      mediaUrl: mediaInfo.mediaUrl || null,
      mediaMimeType: mediaInfo.mediaMimeType || null,
      mediaFileName: mediaInfo.mediaFileName || null,
      mediaDuration: mediaInfo.mediaDuration || null,
      isVoiceNote: mediaInfo.isVoiceNote || false,
      quotedMessageId: mediaInfo.quotedMessageId || null,
    }).onDuplicateKeyUpdate({ set: { status: sql`status` } });
    const insertEnd = Date.now();
    console.log(`[TRACE][DB_INSERT] timestamp: ${insertEnd} | delta: ${insertEnd - insertStart}ms | msgId: ${messageId}`);

    // ── Step 3: Resolve conversation + update last message ──
    try {
      const resolveStart = Date.now();
      const contactPushName = fromMe ? null : pushName;
      const resolved = await resolveInbound(tenantId, sessionId, remoteJid, contactPushName, { skipContactCreation: true });
      const resolveEnd = Date.now();
      console.log(`[TRACE][RESOLVE_INBOUND] timestamp: ${resolveEnd} | delta: ${resolveEnd - resolveStart}ms | msgId: ${messageId}`);
      if (resolved) {
        const updateStart = Date.now();
        await updateConversationLastMessage(resolved.conversationId, {
          content: content || "",
          messageType,
          fromMe,
          status: fromMe ? "sent" : "received",
          timestamp: new Date(timestamp),
          incrementUnread: !fromMe,
        });
        const updateEnd = Date.now();
        console.log(`[TRACE][CONVERSATION_UPDATED] timestamp: ${updateEnd} | delta: ${updateEnd - updateStart}ms | msgId: ${messageId}`);
      }
    } catch (e) {
      console.warn("[Worker] Conversation resolver error:", e);
    }

    // ── Step 4: Emit Socket.IO event ──
    const socketEmitStart = Date.now();
    console.log(`[TRACE][PRE_SOCKET_EMIT] timestamp: ${socketEmitStart} | total_worker_so_far: ${socketEmitStart - _traceStart}ms | msgId: ${messageId}`);
    const { whatsappManager } = await import("./whatsappEvolution");
    whatsappManager.emit("message", {
      sessionId,
      tenantId,
      content,
      fromMe,
      remoteJid,
      messageType,
      pushName,
      timestamp,
    });

    // ── Step 5: Background tasks (non-blocking) ──

    // 5a. Download media and upload to S3
    const mediaMessageTypes = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage", "pttMessage"];
    const hasMediaType = mediaMessageTypes.includes(messageType);
    const hasPermanentUrl = mediaInfo.mediaUrl && !mediaInfo.mediaUrl.includes('whatsapp.net');
    if (hasMediaType && !hasPermanentUrl && messageId) {
      downloadAndStoreMedia(session, messageId, remoteJid, fromMe, mediaInfo).catch(e =>
        console.error(`[Worker] Background media download failed for ${messageId}:`, e.message)
      );
    }

    // 5b. Update wa_contacts with pushName
    if (pushName && !fromMe) {
      const cleanedPush = pushName.replace(/[\s\-\(\)\+]/g, '');
      const isRealName = !/^\d+$/.test(cleanedPush) && pushName !== 'Você' && pushName !== 'You';
      if (isRealName) {
        db.insert(waContacts).values({
          sessionId,
          jid: remoteJid,
          phoneNumber: remoteJid.endsWith('@s.whatsapp.net') ? remoteJid : null,
          pushName,
          savedName: null,
          verifiedName: null,
          profilePictureUrl: null,
        }).onDuplicateKeyUpdate({
          set: { pushName: sql`${pushName}` },
        }).catch(() =>
          db.update(waContacts)
            .set({ pushName })
            .where(and(
              eq(waContacts.sessionId, sessionId),
              eq(waContacts.jid, remoteJid)
            )).catch(() => {})
        ).catch(() => {});
      }
    }

    // 5c. Create notification for incoming messages
    if (!fromMe) {
      createNotification(tenantId, {
        type: "whatsapp_message",
        title: `Nova mensagem de ${pushName || remoteJid.split("@")[0]}`,
        body: content?.substring(0, 200) || "Nova mensagem recebida",
        entityType: "whatsapp",
        entityId: sessionId,
      }).catch(() => {});
    }

    // 5d. Auto-transcribe audio messages (incoming only)
    const audioTypes = ["audioMessage", "pttMessage"];
    if (!fromMe && audioTypes.includes(messageType) && messageId) {
      // Check AI settings before enqueuing to avoid unnecessary jobs
      (async () => {
        try {
          const aiSettings = await getTenantAiSettings(tenantId);
          if (!aiSettings.audioTranscriptionEnabled) {
            console.log(`[Worker] Auto-transcription skipped for ${messageId}: disabled for tenant ${tenantId}`);
            return;
          }

          const [inserted] = await db.select({ id: waMessages.id })
            .from(waMessages)
            .where(and(
              eq(waMessages.sessionId, sessionId),
              eq(waMessages.messageId, messageId)
            ))
            .limit(1);
          if (!inserted) return;

          // Set initial status
          await db.update(waMessages)
            .set({ audioTranscriptionStatus: "pending" })
            .where(eq(waMessages.id, inserted.id));

          const { enqueueAudioTranscription } = await import("./audioTranscriptionWorker");
          await enqueueAudioTranscription({
            messageId: inserted.id,
            externalMessageId: messageId,
            sessionId,
            instanceName: session.instanceName || sessionId,
            tenantId,
            remoteJid,
            fromMe,
            mediaMimeType: mediaInfo.mediaMimeType || "audio/ogg",
            mediaDuration: mediaInfo.mediaDuration || null,
          });
        } catch (e: any) {
          console.warn(`[Worker] Auto-transcription enqueue failed for ${messageId}:`, e.message);
        }
      })();
    }

  } catch (error) {
    console.error("[Worker] Error processing new message:", error);
    throw error; // Re-throw so BullMQ can retry
  }
}

// ── Status Update Handler ─────────────────────────────────────

/**
 * Process message status updates (sent ✓ / delivered ✓✓ / read ✓✓ blue).
 * Replicates the logic from whatsappEvolution.handleMessageStatusUpdate.
 */
async function processStatusUpdate(session: SessionInfo, data: any): Promise<void> {
  const { sessionId } = session;

  try {
    const updates = Array.isArray(data) ? data : [data];
    const db = await getDb();
    if (!db) return;

    for (const update of updates) {
      // Support both Evolution API formats:
      // Format A (Baileys/internal): { key: { id, remoteJid, fromMe }, update: { status: number } }
      // Format B (Evolution v2 webhook): { keyId, remoteJid, fromMe, status: string, messageId }
      const messageId = update?.key?.id || update?.keyId || update?.messageId;
      const remoteJid = update?.key?.remoteJid || update?.remoteJid;
      const fromMe = update?.key?.fromMe ?? update?.fromMe;

      // Resolve status from either format
      let newStatus: string | undefined;
      const rawStatus = update?.update?.status ?? update?.status;
      if (typeof rawStatus === "number") {
        newStatus = NUMERIC_STATUS_MAP[rawStatus];
      } else if (typeof rawStatus === "string") {
        newStatus = STRING_STATUS_MAP[rawStatus.toUpperCase()] || rawStatus.toLowerCase();
      }

      if (!messageId || !newStatus) {
        console.log(`[Worker] Skipping status update - no messageId or status:`, JSON.stringify(update)?.substring(0, 200));
        continue;
      }

      console.log(`[Worker] Status update: ${messageId} -> ${newStatus} (jid: ${remoteJid}, fromMe: ${fromMe})`);

      // ── MONOTONIC STATUS UPDATE: only allow upgrades, never regression ──
      // First, read the current status from DB
      const [existingMsg] = await db.select({ status: waMessages.status })
        .from(waMessages)
        .where(and(
          eq(waMessages.sessionId, sessionId),
          eq(waMessages.messageId, messageId)
        ))
        .limit(1);

      if (!existingMsg) {
        console.log(`[Worker] Status update skipped - message not found: ${messageId}`);
        continue;
      }

      // Only apply if new status has higher precedence
      if (!isStatusUpgrade(existingMsg.status, newStatus)) {
        console.log(`[Worker] Status update BLOCKED (monotonic): ${messageId} ${existingMsg.status} -> ${newStatus} (would regress)`);
        continue;
      }

      // Update message status in DB (monotonic — only upgrades reach here)
      await db.update(waMessages)
        .set({ status: newStatus })
        .where(and(
          eq(waMessages.sessionId, sessionId),
          eq(waMessages.messageId, messageId)
        ));

      // ── PART 3: Propagate status to wa_conversations if this is the latest message ──
      // Instead of blindly updating lastStatus, we find the conversation and check
      // whether the updated message is actually the latest one.
      let previewPayload: any = null;
      if (remoteJid) {
        try {
          // Find the conversation for this message
          const conv = await getConversationByJid(
            session.tenantId,
            sessionId,
            remoteJid
          );
          if (conv) {
            // Propagate from the TRUE latest message (single source of truth)
            previewPayload = await propagateLatestMessageToConversation(conv.conversationId);
          }
        } catch (e: any) {
          console.warn(`[Worker] Failed to propagate status to conversation:`, e.message);
          // Fallback: monotonic update lastStatus directly if propagation fails
          if (fromMe) {
            // Only upgrade, never regress — use SQL CASE to enforce monotonicity
            await db.execute(sql`
              UPDATE wa_conversations
              SET lastStatus = CASE
                WHEN FIELD(${newStatus}, 'error','pending','sent','delivered','read','played','deleted')
                   > FIELD(COALESCE(lastStatus,''), 'error','pending','sent','delivered','read','played','deleted')
                THEN ${newStatus}
                ELSE lastStatus
              END
              WHERE sessionId = ${sessionId}
                AND remoteJid = ${remoteJid}
                AND lastFromMe = 1
            `);
          }
        }
      }

      // Emit Socket.IO events for real-time UI update
      const { whatsappManager } = await import("./whatsappEvolution");

      // 1. Original message:status event (for chat bubble status updates)
      whatsappManager.emit("message:status", {
        sessionId,
        messageId,
        status: newStatus,
        remoteJid: remoteJid || null,
        timestamp: Date.now(),
      });

      // 2. PART 5: New conversation:preview event with full payload
      // This ensures the sidebar preview is ALWAYS in sync with the latest message
      if (previewPayload && remoteJid) {
        whatsappManager.emit("conversation:preview", {
          sessionId,
          remoteJid,
          conversationId: previewPayload.conversationId,
          lastMessage: previewPayload.lastMessage,
          lastMessageAt: previewPayload.lastMessageAt?.getTime() || Date.now(),
          lastMessageStatus: previewPayload.lastMessageStatus,
          lastMessageType: previewPayload.lastMessageType,
          lastFromMe: previewPayload.lastFromMe,
        });
      }
    }
  } catch (error) {
    console.error("[Worker] Error processing status update:", error);
    throw error;
  }
}

// ── Message Delete Handler ────────────────────────────────────

/**
 * Process message deletion events.
 * Marks the message as deleted in DB and emits Socket.IO event.
 */
async function processMessageDelete(session: SessionInfo, data: any): Promise<void> {
  const { sessionId } = session;

  try {
    const key = data?.key || data;
    const messageId = key?.id;
    if (!messageId) return;

    const db = await getDb();
    if (!db) return;

    // Mark message as deleted in DB
    await db.update(waMessages)
      .set({ content: "[Mensagem apagada]", messageType: "protocolMessage" })
      .where(and(
        eq(waMessages.sessionId, sessionId),
        eq(waMessages.messageId, messageId)
      ));

    // Emit Socket.IO event
    const { whatsappManager } = await import("./whatsappEvolution");
    whatsappManager.emit("message:deleted", {
      sessionId,
      messageId,
      remoteJid: key?.remoteJid,
    });
  } catch (error) {
    console.error("[Worker] Error processing message delete:", error);
    throw error;
  }
}

// ── Media Download Helper ──────────────────────────────────────

async function downloadAndStoreMedia(
  session: SessionInfo,
  messageId: string,
  remoteJid: string,
  fromMe: boolean,
  mediaInfo: { mediaUrl?: string | null; mediaMimeType?: string | null; mediaFileName?: string | null }
): Promise<void> {
  try {
    const base64Data = await evo.getBase64FromMediaMessage(session.instanceName, messageId, {
      remoteJid,
      fromMe,
    });
    if (base64Data?.base64) {
      const ext = mimeToExt(base64Data.mimetype || mediaInfo.mediaMimeType || "application/octet-stream");
      const fileKey = `whatsapp-media/${session.sessionId}/${nanoid()}.${ext}`;
      const buffer = Buffer.from(base64Data.base64, "base64");
      const { url } = await storagePut(fileKey, buffer, base64Data.mimetype || mediaInfo.mediaMimeType || "application/octet-stream");

      // Update the message row with the permanent S3 URL
      const db = await getDb();
      if (db) {
        await db.update(waMessages)
          .set({
            mediaUrl: url,
            mediaMimeType: base64Data.mimetype || mediaInfo.mediaMimeType || null,
            mediaFileName: base64Data.fileName || mediaInfo.mediaFileName || null,
          })
          .where(and(
            eq(waMessages.sessionId, session.sessionId),
            eq(waMessages.messageId, messageId)
          ));

        // Emit media-update event
        const { whatsappManager } = await import("./whatsappEvolution");
        whatsappManager.emit("media_update", {
          sessionId: session.sessionId,
          tenantId: session.tenantId,
          remoteJid,
          messageId,
          mediaUrl: url,
        });
      }
    }
  } catch (e: any) {
    console.error(`[Worker] Failed to download/store media for ${messageId}:`, e.message);
  }
}

// ── Worker Initialization ──────────────────────────────────────

/**
 * Initialize the message worker.
 * Called from server/_core/index.ts during startup.
 * If Redis is unavailable, logs a warning and returns (sync fallback will be used).
 */
export function initMessageWorker(): void {
  if (!isQueueEnabled()) {
    console.log("[Worker] Queue disabled or Redis unavailable — using synchronous processing");
    return;
  }

  const worker = startMessageWorker(processMessageEvent);
  if (worker) {
    console.log("[Worker] Message worker initialized successfully");
  } else {
    console.warn("[Worker] Failed to start message worker — falling back to sync processing");
  }
}
