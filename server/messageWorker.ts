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

import { getDb } from "./db";
import { and, eq, sql } from "drizzle-orm";
import { waMessages, waContacts, waConversations, waReactions } from "../drizzle/schema";
import { resolveInbound, updateConversationLastMessage } from "./conversationResolver";
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

    // reactionMessage: store in wa_reactions table and emit socket event
    if (messageType === "reactionMessage") {
      const reactionMsg = data?.message?.reactionMessage;
      const targetMsgId = reactionMsg?.key?.id;
      const emoji = reactionMsg?.text || "";
      const senderJid = key.fromMe ? (sessionId + "@s.whatsapp.net") : key.remoteJid;
      
      if (targetMsgId) {
        const db = await getDb();
        if (db) {
          if (emoji) {
            // Upsert reaction (replace existing reaction from same sender on same message)
            await db.insert(waReactions).values({
              sessionId,
              targetMessageId: targetMsgId,
              senderJid,
              emoji,
              fromMe: key.fromMe || false,
              timestamp: new Date(),
            }).onDuplicateKeyUpdate({
              set: { emoji, timestamp: new Date() },
            });
            console.log(`[Worker] Reaction stored: ${emoji} on ${targetMsgId} from ${senderJid}`);
          } else {
            // Empty emoji = reaction removed
            await db.delete(waReactions).where(and(
              eq(waReactions.sessionId, sessionId),
              eq(waReactions.targetMessageId, targetMsgId),
              eq(waReactions.senderJid, senderJid),
            ));
            console.log(`[Worker] Reaction removed on ${targetMsgId} from ${senderJid}`);
          }
          
          // Emit socket event for real-time UI update
          const { whatsappManager } = await import("./whatsappEvolution");
          whatsappManager.emit("reaction", {
            sessionId,
            tenantId,
            targetMessageId: targetMsgId,
            senderJid,
            emoji,
            fromMe: key.fromMe || false,
            remoteJid: key.remoteJid,
          });
        }
      }
      return; // Don't insert reaction as a regular message
    }

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
    // Non-preview message types must NOT overwrite the conversation preview.
    // Reactions, protocol messages, etc. should be stored in wa_messages but
    // should never become the "last message" shown in the inbox sidebar.
    const NON_PREVIEW_TYPES = new Set([
      'reactionMessage', 'protocolMessage', 'senderKeyDistributionMessage',
      'messageContextInfo', 'ephemeralMessage', 'editedMessage',
      'deviceSentMessage', 'bcallMessage', 'callLogMesssage',
      'keepInChatMessage', 'encReactionMessage', 'viewOnceMessageV2Extension',
    ]);
    const isPreviewWorthy = !NON_PREVIEW_TYPES.has(messageType);

    try {
      const resolveStart = Date.now();
      const contactPushName = fromMe ? null : pushName;
      const resolved = await resolveInbound(tenantId, sessionId, remoteJid, contactPushName, { skipContactCreation: true });
      const resolveEnd = Date.now();
      console.log(`[TRACE][RESOLVE_INBOUND] timestamp: ${resolveEnd} | delta: ${resolveEnd - resolveStart}ms | msgId: ${messageId}`);
      if (resolved && isPreviewWorthy) {
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
      } else if (resolved && !isPreviewWorthy) {
        console.log(`[TRACE][SKIP_PREVIEW_UPDATE] msgType: ${messageType} | msgId: ${messageId} — non-preview type, conversation preview not updated`);
        // Still increment unread for incoming non-preview messages
        if (!fromMe) {
          await updateConversationLastMessage(resolved.conversationId, {
            incrementUnread: true,
          });
        }
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

    // 5d. Auto-transcribe audio messages (both incoming and sent from inbox)
    const audioTypes = ["audioMessage", "pttMessage"];
    if (audioTypes.includes(messageType) && messageId) {
      // Fetch the inserted row ID for the transcription worker
      (async () => {
        try {
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

      // ── Monotonic status enforcement ──
      // Status must only progress forward: error(0) < pending(1) < sent(2) < delivered(3) < read(4) < played(5)
      // Never allow regression (e.g., delivered → sent)
      const STATUS_ORDER: Record<string, number> = {
        error: 0, pending: 1, sent: 2, delivered: 3, read: 4, played: 5,
      };
      const newStatusOrder = STATUS_ORDER[newStatus] ?? -1;

      // Check current status of the message before updating
      const [currentMsg] = await db.select({ status: waMessages.status })
        .from(waMessages)
        .where(and(
          eq(waMessages.sessionId, sessionId),
          eq(waMessages.messageId, messageId)
        ))
        .limit(1);

      if (currentMsg) {
        const currentOrder = STATUS_ORDER[currentMsg.status || ""] ?? -1;
        if (newStatusOrder <= currentOrder) {
          console.log(`[Worker] Status update SKIPPED (monotonic): ${messageId} ${currentMsg.status}(${currentOrder}) -> ${newStatus}(${newStatusOrder}) — would regress`);
          continue;
        }
      }

      // Update message status in DB (only forward progression)
      await db.update(waMessages)
        .set({ status: newStatus })
        .where(and(
          eq(waMessages.sessionId, sessionId),
          eq(waMessages.messageId, messageId)
        ));

      // Also update lastStatus in wa_conversations if this is the last message from us
      // AND the new status is higher than the current lastStatus (monotonic)
      if (remoteJid && fromMe) {
        // Use SQL-level comparison to ensure atomicity
        const statusCase = sql`CASE 
          WHEN lastStatus = 'error' THEN 0
          WHEN lastStatus = 'pending' THEN 1  
          WHEN lastStatus = 'sent' THEN 2
          WHEN lastStatus = 'delivered' THEN 3
          WHEN lastStatus = 'read' THEN 4
          WHEN lastStatus = 'played' THEN 5
          ELSE -1
        END`;
        await db.update(waConversations)
          .set({ lastStatus: newStatus })
          .where(and(
            eq(waConversations.sessionId, sessionId),
            eq(waConversations.remoteJid, remoteJid),
            eq(waConversations.lastFromMe, true),
            sql`${statusCase} < ${newStatusOrder}`
          ));
      }

      // Emit Socket.IO event for real-time UI update
      const { whatsappManager } = await import("./whatsappEvolution");
      whatsappManager.emit("message:status", {
        sessionId,
        messageId,
        status: newStatus,
        remoteJid: remoteJid || null,
        timestamp: Date.now(),
      });
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

    // Get the message before marking as deleted (to check if it's the last message)
    const [deletedMsg] = await db.select({
      id: waMessages.id,
      waConversationId: waMessages.waConversationId,
      content: waMessages.content,
    }).from(waMessages).where(and(
      eq(waMessages.sessionId, sessionId),
      eq(waMessages.messageId, messageId)
    )).limit(1);

    // Mark message as deleted in DB
    await db.update(waMessages)
      .set({ content: "[Mensagem apagada]", messageType: "protocolMessage" })
      .where(and(
        eq(waMessages.sessionId, sessionId),
        eq(waMessages.messageId, messageId)
      ));

    // If this message was in a conversation, check if it was the last message
    // and update the preview to "[Mensagem apagada]" if so
    if (deletedMsg?.waConversationId) {
      const convId = deletedMsg.waConversationId;
      // Check if the conversation's lastMessagePreview matches the deleted message content
      const [conv] = await db.select({
        lastMessagePreview: waConversations.lastMessagePreview,
      }).from(waConversations).where(eq(waConversations.id, convId)).limit(1);

      if (conv && conv.lastMessagePreview === deletedMsg.content) {
        await db.update(waConversations)
          .set({ lastMessagePreview: "[Mensagem apagada]", lastMessageType: "protocolMessage" })
          .where(eq(waConversations.id, convId));
      }
    }

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
