/**
 * Message Worker — Processes queued webhook events asynchronously
 * 
 * Extracts the heavy processing logic from handleIncomingMessage:
 * 1. Validate & dedup by messageId
 * 2. Insert message into DB
 * 3. Resolve conversation (upsert wa_conversations)
 * 4. Update lastMessage + incremental unreadCount
 * 5. Emit Socket.IO event
 * 6. Background: media download, contact update, notification
 * 
 * This worker is started from server/_core/index.ts alongside the Express server.
 */

import { getDb } from "./db";
import { and, eq, sql } from "drizzle-orm";
import { waMessages, waContacts } from "../drizzle/schema";
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
  if (msg.audioMessage || msg.pttMessage) return "🎵 Áudio";
  if (msg.imageMessage) return "📷 Imagem";
  if (msg.videoMessage) return "🎥 Vídeo";
  if (msg.stickerMessage) return "🏷️ Sticker";
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
    msg.documentMessage?.contextInfo;
  if (contextInfo?.quotedMessage) {
    result.quotedMessageId = contextInfo.stanzaId || null;
  }

  // Media types
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

// ── Core Message Processor ─────────────────────────────────────

/**
 * Process a single message event from the queue.
 * This is the same logic as handleIncomingMessage but extracted for worker use.
 */
export async function processMessageEvent(payload: MessageEventPayload): Promise<void> {
  const { event, data, sessionId: payloadSessionId, instanceName, tenantId: payloadTenantId } = payload;

  // For non-message events, delegate back to the manager
  if (event !== "messages.upsert" && event !== "send.message") {
    const { whatsappManager } = await import("./whatsappEvolution");
    await whatsappManager.handleWebhookEvent({
      event: event as import("./evolutionApi").WebhookEventType,
      instance: instanceName,
      data,
    });
    return;
  }

  // Resolve session
  const session = await getSessionInfo(instanceName, payloadSessionId);
  if (!session) {
    console.warn(`[Worker] No session found for instance: ${instanceName}`);
    return;
  }

  const { sessionId, tenantId } = session;

  try {
    const key = data?.key;
    if (!key?.remoteJid) return;

    // Skip groups, broadcast, LID
    if (key.remoteJid === "status@broadcast") return;
    if (key.remoteJid.endsWith("@g.us")) return;
    if (key.remoteJid.endsWith("@lid")) return;

    // Skip protocol messages
    const messageType = data?.messageType || "conversation";
    const skipTypes = ["protocolMessage", "senderKeyDistributionMessage", "messageContextInfo", "ephemeralMessage"];
    if (skipTypes.includes(messageType)) return;

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
    if (messageId) {
      const existing = await db.select({ id: waMessages.id })
        .from(waMessages)
        .where(and(
          eq(waMessages.sessionId, sessionId),
          eq(waMessages.messageId, messageId)
        ))
        .limit(1);

      if (existing.length > 0) return;
    }

    // ── Step 2: Insert message ──
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

    // ── Step 3: Resolve conversation + update last message ──
    try {
      const contactPushName = fromMe ? null : pushName;
      const resolved = await resolveInbound(tenantId, sessionId, remoteJid, contactPushName, { skipContactCreation: true });
      if (resolved) {
        await updateConversationLastMessage(resolved.conversationId, {
          content: content || "",
          fromMe,
          timestamp: new Date(timestamp),
          incrementUnread: !fromMe,
        });
      }
    } catch (e) {
      console.warn("[Worker] Conversation resolver error:", e);
    }

    // ── Step 4: Emit Socket.IO event ──
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
    const hasMediaType = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage", "pttMessage"].includes(messageType);
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

  } catch (error) {
    console.error("[Worker] Error processing message event:", error);
    throw error; // Re-throw so BullMQ can retry
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
