import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  proto,
  downloadMediaMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import { EventEmitter } from "events";
import { getDb, createNotification } from "./db";
import { whatsappSessions, waMessages as messages, activityLogs, chatbotSettings, chatbotRules } from "../drizzle/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
// notifyOwner desativado — todas as notificações são apenas in-app
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { normalizeJid } from "./phoneUtils";
import { resolveInbound, resolveOutbound, updateConversationLastMessage } from "./conversationResolver";

const logger = pino({ level: "silent" });

export interface WhatsAppState {
  socket: WASocket | null;
  qrCode: string | null;
  qrDataUrl: string | null;
  status: "connecting" | "connected" | "disconnected";
  user: any;
  sessionId: string;
}

class WhatsAppManager extends EventEmitter {
  private sessions: Map<string, WhatsAppState> = new Map();
  private authDir = path.join(process.cwd(), "auth_sessions");
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  getSession(sessionId: string): WhatsAppState | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): WhatsAppState[] {
    return Array.from(this.sessions.values());
  }

  async connect(sessionId: string, userId: number): Promise<WhatsAppState> {
    const existing = this.sessions.get(sessionId);
    if (existing?.status === "connected") {
      return existing;
    }

    const sessionDir = path.join(this.authDir, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sessionState: WhatsAppState = {
      socket: null,
      qrCode: null,
      qrDataUrl: null,
      status: "connecting",
      user: null,
      sessionId,
    };
    this.sessions.set(sessionId, sessionState);

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      generateHighQualityLinkPreview: true,
    });

    sessionState.socket = sock;

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        sessionState.qrCode = qr;
        sessionState.status = "connecting";
        try {
          sessionState.qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        } catch (e) {
          console.error("QR generation error:", e);
        }
        this.emit("qr", { sessionId, qr, qrDataUrl: sessionState.qrDataUrl });
        await this.logActivity(sessionId, "qr_generated", "Novo QR Code gerado");
        await this.updateSessionDb(sessionId, userId, "connecting");
      }

      if (connection === "close") {
        sessionState.status = "disconnected";
        sessionState.qrCode = null;
        sessionState.qrDataUrl = null;

        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        this.emit("status", { sessionId, status: "disconnected", statusCode });
        await this.logActivity(sessionId, "disconnected", `Desconectado. Código: ${statusCode}`);
        await this.updateSessionDb(sessionId, userId, "disconnected");

        // notifyOwner desativado — notificações apenas in-app
        try {
          await createNotification(1, {
            type: "whatsapp_disconnected",
            title: "WhatsApp Desconectado",
            body: `Sessão "${sessionId}" desconectada. Código: ${statusCode}. ${shouldReconnect ? "Tentando reconectar..." : "Sessão encerrada."}`,
            entityType: "session",
            entityId: sessionId,
          });
        } catch (e) { console.error("Error creating disconnect notification:", e); }

        if (shouldReconnect) {
          const timer = setTimeout(() => {
            this.connect(sessionId, userId);
          }, 5000);
          this.reconnectTimers.set(sessionId, timer);
        } else {
          this.sessions.delete(sessionId);
          // Clean auth files on logout
          if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
          }
        }
      } else if (connection === "open") {
        sessionState.status = "connected";
        sessionState.qrCode = null;
        sessionState.qrDataUrl = null;
        sessionState.user = sock.user;

        this.emit("status", { sessionId, status: "connected", user: sock.user });
        await this.logActivity(sessionId, "connected", `Conectado como ${sock.user?.name || sock.user?.id}`);
        await this.updateSessionDb(sessionId, userId, "connected", sock.user);

        // notifyOwner desativado — notificações apenas in-app
        try {
          await createNotification(1, {
            type: "whatsapp_connected",
            title: "WhatsApp Conectado",
            body: `Sessão "${sessionId}" conectada como ${sock.user?.name || sock.user?.id}.`,
            entityType: "session",
            entityId: sessionId,
          });
        } catch (e) { console.error("Error creating connect notification:", e); }

        // Sync historical messages on connect
        this.syncHistoricalMessages(sessionId, sock).catch((e: any) =>
          console.error("Error syncing historical messages:", e)
        );
      }
    });

    sock.ev.on("creds.update", saveCreds);

    // ─── Historical message sync (messaging-history.set) ───
    // Internal Baileys message types that should be skipped (not real user messages)
    const SKIP_MESSAGE_TYPES = new Set([
      "protocolMessage", "senderKeyDistributionMessage", "messageContextInfo",
      "reactionMessage", "ephemeralMessage", "deviceSentMessage",
      "bcallMessage", "callLogMesssage", "keepInChatMessage",
      "encReactionMessage", "editedMessage", "viewOnceMessageV2Extension",
    ]);

    sock.ev.on("messaging-history.set", async ({ messages: histMsgs, isLatest }) => {
      if (!histMsgs?.length) return;
      try {
        const db = await getDb();
        if (!db) return;
        let synced = 0;
        for (const msg of histMsgs) {
          if (!msg.message || !msg.key.id) continue;
          // Check if already exists
          const existing = await db.select({ id: messages.id }).from(messages)
            .where(and(eq(messages.messageId, msg.key.id), eq(messages.sessionId, sessionId)))
            .limit(1);
          if (existing.length > 0) continue;

          const remoteJid = msg.key.remoteJid || "";
          // Skip group messages — CRM only handles individual contacts
          if (remoteJid.endsWith("@g.us")) continue;
          const fromMe = msg.key.fromMe || false;
          
          // Determine the real message type, skipping internal protocol types
          const msgKeys = Object.keys(msg.message);
          const realType = msgKeys.find(k => !SKIP_MESSAGE_TYPES.has(k) && k !== "messageContextInfo") || msgKeys[0] || "unknown";
          // Skip entirely internal protocol messages (no user-visible content)
          if (SKIP_MESSAGE_TYPES.has(realType)) continue;
          
          const messageType = realType;
          let content = "";
          if (msg.message.conversation) content = msg.message.conversation;
          else if (msg.message.extendedTextMessage?.text) content = msg.message.extendedTextMessage.text;
          else if (msg.message.imageMessage) content = msg.message.imageMessage.caption || "[Imagem]";
          else if (msg.message.videoMessage) content = msg.message.videoMessage.caption || "[Vídeo]";
          else if (msg.message.documentMessage) content = `[Documento: ${msg.message.documentMessage.fileName || "arquivo"}]`;
          else if (msg.message.audioMessage) content = "[Áudio]";
          else if (msg.message.stickerMessage) content = "[Sticker]";
          else if (msg.message.contactMessage || msg.message.contactsArrayMessage) content = "[Contato]";
          else if (msg.message.locationMessage || msg.message.liveLocationMessage) content = "[Localização]";
          else if (msg.message.templateMessage) content = msg.message.templateMessage?.hydratedTemplate?.hydratedContentText || "[Template]";
          else if (msg.message.buttonsMessage) content = msg.message.buttonsMessage?.contentText || "[Botões]";
          else if (msg.message.listMessage) content = msg.message.listMessage?.description || "[Lista]";
          else if (msg.message.viewOnceMessage || msg.message.viewOnceMessageV2) {
            const inner = (msg.message.viewOnceMessage || msg.message.viewOnceMessageV2)?.message;
            if (inner?.imageMessage) content = "[Foto única]";
            else if (inner?.videoMessage) content = "[Vídeo único]";
            else content = "[Visualização única]";
          }
          else content = `[${messageType}]`;

          await db.insert(messages).values({
            sessionId,
            messageId: msg.key.id,
            remoteJid,
            fromMe,
            pushName: msg.pushName || null,
            messageType,
            content,
            status: fromMe ? "sent" : "received",
            timestamp: new Date(((msg.messageTimestamp as number) || Date.now() / 1000) * 1000),
          });
          synced++;
        }
        if (synced > 0) {
          await this.logActivity(sessionId, "history_sync", `${synced} mensagens históricas sincronizadas`);
        }
      } catch (e) {
        console.error("Error syncing history batch:", e);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages: msgs, type }) => {
      for (const msg of msgs) {
        if (!msg.message) continue;

        const rawRemoteJid = msg.key.remoteJid || "";
        // Skip group messages — CRM only handles individual contacts
        if (rawRemoteJid.endsWith("@g.us")) continue;
        // Normalize Brazilian phone JID to canonical format (always 13 digits with 9th digit)
        const remoteJid = normalizeJid(rawRemoteJid);
        const fromMe = msg.key.fromMe || false;
        
        // Determine the real message type, skipping internal protocol types
        const upsertKeys = Object.keys(msg.message);
        const upsertRealType = upsertKeys.find(k => !SKIP_MESSAGE_TYPES.has(k) && k !== "messageContextInfo") || upsertKeys[0] || "unknown";
        // Skip entirely internal protocol messages (no user-visible content)
        if (SKIP_MESSAGE_TYPES.has(upsertRealType)) continue;
        
        const messageType = upsertRealType;
        let content = "";
        let mediaUrl: string | undefined;
        let mediaMimeType: string | undefined;
        let mediaFileName: string | undefined;
        let mediaDuration: number | undefined;
        let isVoiceNote = false;

        if (msg.message.conversation) {
          content = msg.message.conversation;
        } else if (msg.message.extendedTextMessage?.text) {
          content = msg.message.extendedTextMessage.text;
        } else if (msg.message.imageMessage) {
          content = msg.message.imageMessage.caption || "";
          mediaMimeType = msg.message.imageMessage.mimetype || "image/jpeg";
          // Download and upload image to S3
          try {
            const buffer = await downloadMediaMessage(msg, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
            const ext = mediaMimeType.split("/")[1] || "jpg";
            const key = `whatsapp-media/${nanoid()}.${ext}`;
            const { url } = await storagePut(key, buffer as Buffer, mediaMimeType);
            mediaUrl = url;
          } catch (e) { console.error("Error downloading image:", e); }
        } else if (msg.message.videoMessage) {
          content = msg.message.videoMessage.caption || "";
          mediaMimeType = msg.message.videoMessage.mimetype || "video/mp4";
          mediaDuration = msg.message.videoMessage.seconds || undefined;
          try {
            const buffer = await downloadMediaMessage(msg, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
            const ext = mediaMimeType.split("/")[1] || "mp4";
            const key = `whatsapp-media/${nanoid()}.${ext}`;
            const { url } = await storagePut(key, buffer as Buffer, mediaMimeType);
            mediaUrl = url;
          } catch (e) { console.error("Error downloading video:", e); }
        } else if (msg.message.documentMessage) {
          mediaFileName = msg.message.documentMessage.fileName || "document";
          mediaMimeType = msg.message.documentMessage.mimetype || "application/octet-stream";
          content = msg.message.documentMessage.caption || `[Documento: ${mediaFileName}]`;
          try {
            const buffer = await downloadMediaMessage(msg, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
            const key = `whatsapp-media/${nanoid()}-${mediaFileName}`;
            const { url } = await storagePut(key, buffer as Buffer, mediaMimeType);
            mediaUrl = url;
          } catch (e) { console.error("Error downloading document:", e); }
        } else if (msg.message.audioMessage) {
          mediaMimeType = msg.message.audioMessage.mimetype || "audio/ogg";
          mediaDuration = msg.message.audioMessage.seconds || undefined;
          isVoiceNote = msg.message.audioMessage.ptt || false;
          content = isVoiceNote ? "[Áudio]" : "[Áudio]";
          try {
            const buffer = await downloadMediaMessage(msg, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
            const ext = isVoiceNote ? "ogg" : (mediaMimeType.split("/")[1] || "ogg");
            const key = `whatsapp-media/${nanoid()}.${ext}`;
            const { url } = await storagePut(key, buffer as Buffer, mediaMimeType);
            mediaUrl = url;
          } catch (e) { console.error("Error downloading audio:", e); }
        } else if (msg.message.stickerMessage) {
          content = "[Sticker]";
          mediaMimeType = "image/webp";
          try {
            const buffer = await downloadMediaMessage(msg, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
            const key = `whatsapp-media/${nanoid()}.webp`;
            const { url } = await storagePut(key, buffer as Buffer, "image/webp");
            mediaUrl = url;
          } catch (e) { console.error("Error downloading sticker:", e); }
        }

        // Determine initial status for sent messages
        const initialStatus = fromMe ? "sent" : "received";

        // ─── Conversation Identity Resolver ───
        let waConversationId: number | undefined;
        try {
          const resolved = await resolveInbound(1, sessionId, remoteJid, msg.pushName || null);
          waConversationId = resolved.conversationId;
        } catch (e) {
          console.error("[ConvResolver] Error resolving inbound:", e);
        }

        // Save message to DB (skip if already saved by sendTextMessage/sendMediaMessage)
        const msgTimestamp = new Date(((msg.messageTimestamp as number) || Date.now() / 1000) * 1000);
        try {
          const db = await getDb();
          if (db) {
            const msgId = msg.key.id;
            let alreadyExists = false;
            if (msgId) {
              const existing = await db.select({ id: messages.id }).from(messages)
                .where(and(eq(messages.messageId, msgId), eq(messages.sessionId, sessionId)))
                .limit(1);
              alreadyExists = existing.length > 0;
            }

            if (!alreadyExists) {
              await db.insert(messages).values({
                sessionId,
                messageId: msgId || undefined,
                remoteJid,
                fromMe,
                pushName: msg.pushName || null,
                messageType,
                content,
                mediaUrl,
                mediaMimeType,
                mediaFileName,
                mediaDuration,
                isVoiceNote,
                waConversationId: waConversationId || undefined,
                status: initialStatus,
                timestamp: msgTimestamp,
              });
            } else if (fromMe) {
              // Update existing message with any new data (e.g. media URL from download)
              const updateData: any = {};
              if (mediaUrl) updateData.mediaUrl = mediaUrl;
              if (mediaMimeType) updateData.mediaMimeType = mediaMimeType;
              if (mediaFileName) updateData.mediaFileName = mediaFileName;
              if (mediaDuration) updateData.mediaDuration = mediaDuration;
              if (waConversationId) updateData.waConversationId = waConversationId;
              if (Object.keys(updateData).length > 0) {
                await db.update(messages).set(updateData)
                  .where(and(eq(messages.messageId, msgId!), eq(messages.sessionId, sessionId)));
              }
            }
          }
        } catch (e) {
          console.error("Error saving message:", e);
        }

        // ─── Update conversation last message ───
        if (waConversationId) {
          try {
            await updateConversationLastMessage(waConversationId, {
              content,
              messageType,
              fromMe,
              status: initialStatus,
              timestamp: msgTimestamp,
              incrementUnread: !fromMe,
            });
          } catch (e) {
            console.error("[ConvResolver] Error updating last message:", e);
          }
        }

        this.emit("message", { sessionId, message: msg, content, fromMe, remoteJid, messageType, mediaUrl, mediaMimeType, mediaFileName, mediaDuration, isVoiceNote, status: initialStatus });

        // Chatbot auto-reply
        if (!fromMe && content && type === "notify") {
          await this.handleChatbot(sessionId, remoteJid, content, sock);
        }

        // Notificação apenas in-app (notifyOwner/email desativado)
        if (!fromMe && content) {
          const senderName = msg.pushName || remoteJid.replace("@s.whatsapp.net", "");
          try {
            await createNotification(1, {
              type: "whatsapp_message",
              title: `Nova mensagem de ${senderName}`,
              body: content.substring(0, 300),
              entityType: "message",
              entityId: remoteJid,
            });
          } catch (e) { console.error("Error creating notification:", e); }
        }
      }
    });

    // ─── Message Receipt Updates (delivered / read) ───
    sock.ev.on("message-receipt.update", async (updates) => {
      for (const update of updates) {
        const msgId = update.key.id;
        const receiptType = update.receipt?.receiptTimestamp ? "delivered" : "sent";
        let newStatus = receiptType;

        // readTimestamp indicates the message was read
        if (update.receipt?.readTimestamp) {
          newStatus = "read";
        } else if ((update as any).receipt?.receiptTimestamp) {
          newStatus = "delivered";
        }

        try {
          const db = await getDb();
          if (db && msgId) {
            await db.update(messages)
              .set({ status: newStatus })
              .where(eq(messages.messageId, msgId));
          }
        } catch (e) {
          console.error("Error updating message status:", e);
        }

        this.emit("message:status", { sessionId, messageId: msgId, status: newStatus });
      }
    });

    // ─── Message Update (status changes from Baileys) ───
    sock.ev.on("messages.update", async (updates) => {
      for (const update of updates) {
        const msgId = update.key.id;
        const statusMap: Record<number, string> = {
          2: "sent",      // MESSAGE_STATUS_SERVER_ACK
          3: "delivered", // MESSAGE_STATUS_DELIVERY_ACK  
          4: "read",      // MESSAGE_STATUS_READ
          5: "played",    // MESSAGE_STATUS_PLAYED (for audio)
        };
        const newStatus = statusMap[(update.update as any)?.status] || null;

        if (newStatus && msgId) {
          try {
            const db = await getDb();
            if (db) {
              await db.update(messages)
                .set({ status: newStatus })
                .where(eq(messages.messageId, msgId));
            }
          } catch (e) {
            console.error("Error updating message status:", e);
          }

          this.emit("message:status", { sessionId, messageId: msgId, status: newStatus });
        }
      }
    });

    return sessionState;
  }

  async disconnect(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session?.socket) {
      await session.socket.logout();
      session.socket = null;
    }
    const timer = this.reconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(sessionId);
    }
    this.sessions.delete(sessionId);
    await this.logActivity(sessionId, "manual_disconnect", "Sessão desconectada manualmente");
  }

  /**
   * Normalize a phone number to a valid WhatsApp JID.
   * Handles Brazilian numbers: adds country code 55 if missing,
   * and uses onWhatsApp() to verify the actual registered JID.
   */
  private async resolveJid(sessionId: string, input: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session?.socket) throw new Error("Sessão não conectada");

    // If already a full JID, normalize and return
    if (input.includes("@")) return normalizeJid(input);

    // Strip all non-digit characters
    let digits = input.replace(/\D/g, "");

    // Add Brazil country code if not present
    if (!digits.startsWith("55") && digits.length <= 11) {
      digits = `55${digits}`;
    }

    // Try to find the real WhatsApp JID using onWhatsApp()
    try {
      const results = await session.socket.onWhatsApp(digits);
      if (results && results.length > 0 && results[0].exists) {
        const resolvedJid = normalizeJid(results[0].jid);
        console.log(`[JID Resolve] ${input} -> ${resolvedJid} (verified + normalized)`);
        return resolvedJid;
      }
    } catch (e) {
      console.warn("[JID Resolve] onWhatsApp failed, using fallback:", e);
    }

    // Fallback: for Brazilian mobile numbers, try with and without 9th digit
    if (digits.startsWith("55") && digits.length >= 12) {
      const ddd = digits.substring(2, 4);
      const rest = digits.substring(4);

      // If number has 9 digits after DDD (with 9th digit), try without it
      if (rest.length === 9 && rest.startsWith("9")) {
        const without9 = `55${ddd}${rest.substring(1)}`;
        try {
          const results = await session.socket.onWhatsApp(without9);
          if (results && results.length > 0 && results[0].exists) {
            const resolvedJid = normalizeJid(results[0].jid);
            console.log(`[JID Resolve] ${input} -> ${resolvedJid} (verified without 9th digit + normalized)`);
            return resolvedJid;
          }
        } catch (e) { /* ignore */ }
      }

      // If number has 8 digits after DDD (without 9th digit), try with it
      if (rest.length === 8) {
        const with9 = `55${ddd}9${rest}`;
        try {
          const results = await session.socket.onWhatsApp(with9);
          if (results && results.length > 0 && results[0].exists) {
            const resolvedJid = normalizeJid(results[0].jid);
            console.log(`[JID Resolve] ${input} -> ${resolvedJid} (verified with 9th digit + normalized)`);
            return resolvedJid;
          }
        } catch (e) { /* ignore */ }
      }
    }

    // Final fallback: normalize and use @s.whatsapp.net
    const fallbackJid = normalizeJid(`${digits}@s.whatsapp.net`);
    console.log(`[JID Resolve] ${input} -> ${fallbackJid} (fallback + normalized)`);
    return fallbackJid;
  }

  /** Public wrapper for resolveJid to be called from router */
  async resolveJidPublic(sessionId: string, phone: string): Promise<string> {
    return this.resolveJid(sessionId, phone);
  }

  /** Get group names for multiple group JIDs */
  async getGroupNames(sessionId: string, groupJids: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const session = this.sessions.get(sessionId);
    if (!session?.socket || session.status !== "connected") return result;
    const batchSize = 5;
    for (let i = 0; i < groupJids.length; i += batchSize) {
      const batch = groupJids.slice(i, i + batchSize);
      await Promise.all(batch.map(async (jid) => {
        try {
          const metadata = await session.socket!.groupMetadata(jid);
          if (metadata?.subject) result[jid] = metadata.subject;
        } catch {
          // Group not found or no access
        }
      }));
    }
    return result;
  }

  /** Get contact/push names from the store */
  async getContactNames(sessionId: string, jids: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const session = this.sessions.get(sessionId);
    if (!session?.socket || session.status !== "connected") return result;
    // Try to get push names from the store
    for (const jid of jids) {
      try {
        if (jid.includes("@g.us")) continue; // Skip groups
        const contacts = await session.socket.onWhatsApp(jid.split("@")[0]);
        const contact = contacts?.[0];
        // onWhatsApp doesn't return names, but we can try the contact store
      } catch {
        // ignore
      }
    }
    return result;
  }

  /** Get profile picture URL for a JID */
  async getProfilePicture(sessionId: string, jid: string): Promise<string | null> {
    const session = this.sessions.get(sessionId);
    if (!session?.socket || session.status !== "connected") return null;
    try {
      const formattedJid = jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
      const url = await session.socket.profilePictureUrl(formattedJid, "image");
      return url || null;
    } catch {
      return null;
    }
  }

  /** Get profile pictures for multiple JIDs (batch) */
  async getProfilePictures(sessionId: string, jids: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    const session = this.sessions.get(sessionId);
    if (!session?.socket || session.status !== "connected") {
      for (const jid of jids) result[jid] = null;
      return result;
    }
    // Process in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < jids.length; i += batchSize) {
      const batch = jids.slice(i, i + batchSize);
      const promises = batch.map(async (jid) => {
        try {
          const url = await session.socket!.profilePictureUrl(jid, "image");
          result[jid] = url || null;
        } catch {
          result[jid] = null;
        }
      });
      await Promise.all(promises);
    }
    return result;
  }

  async sendTextMessage(sessionId: string, jid: string, text: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session?.socket || session.status !== "connected") {
      throw new Error("Sessão não conectada");
    }

    const formattedJid = await this.resolveJid(sessionId, jid);
    const result = await session.socket.sendMessage(formattedJid, { text });

    // ─── Resolve outbound conversation ───
    let waConversationId: number | undefined;
    try {
      const resolved = await resolveOutbound(1, sessionId, formattedJid);
      waConversationId = resolved.conversationId;
    } catch (e) {
      console.error("[ConvResolver] Error resolving outbound:", e);
    }

    // Save sent message
    try {
      const db = await getDb();
      if (db) {
        await db.insert(messages).values({
          sessionId,
          messageId: result?.key?.id || undefined,
          remoteJid: formattedJid,
          fromMe: true,
          messageType: "text",
          content: text,
          waConversationId: waConversationId || undefined,
          status: "sent",
        });
      }
    } catch (e) {
      console.error("Error saving sent message:", e);
    }

    // Update conversation last message
    if (waConversationId) {
      try {
        await updateConversationLastMessage(waConversationId, {
          content: text,
          messageType: "text",
          fromMe: true,
          status: "sent",
          timestamp: new Date(),
        });
      } catch (e) {
        console.error("[ConvResolver] Error updating outbound last message:", e);
      }
    }

    await this.logActivity(sessionId, "message_sent", `Mensagem enviada para ${formattedJid}`);
    return result;
  }

  async sendMediaMessage(sessionId: string, jid: string, mediaUrl: string, mediaType: "image" | "audio" | "document" | "video", caption?: string, fileName?: string, opts?: { ptt?: boolean; mimetype?: string; duration?: number }): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session?.socket || session.status !== "connected") {
      throw new Error("Sessão não conectada");
    }

    const formattedJid = await this.resolveJid(sessionId, jid);
    let messageContent: any;

    if (mediaType === "image") {
      messageContent = { image: { url: mediaUrl }, caption: caption || "" };
    } else if (mediaType === "audio") {
      messageContent = { audio: { url: mediaUrl }, mimetype: opts?.mimetype || "audio/ogg; codecs=opus", ptt: opts?.ptt ?? true };
    } else if (mediaType === "video") {
      messageContent = { video: { url: mediaUrl }, caption: caption || "" };
    } else {
      messageContent = { document: { url: mediaUrl }, mimetype: opts?.mimetype || "application/octet-stream", fileName: fileName || "document" };
    }

    const result = await session.socket.sendMessage(formattedJid, messageContent);

    // ─── Resolve outbound conversation ───
    let waConversationId: number | undefined;
    try {
      const resolved = await resolveOutbound(1, sessionId, formattedJid);
      waConversationId = resolved.conversationId;
    } catch (e) {
      console.error("[ConvResolver] Error resolving outbound media:", e);
    }

    const mediaContent = caption || (mediaType === "audio" ? "[Áudio]" : `[${mediaType}]`);
    try {
      const db = await getDb();
      if (db) {
        await db.insert(messages).values({
          sessionId,
          messageId: result?.key?.id || undefined,
          remoteJid: formattedJid,
          fromMe: true,
          messageType: mediaType,
          content: mediaContent,
          mediaUrl,
          mediaMimeType: opts?.mimetype,
          mediaFileName: fileName,
          mediaDuration: opts?.duration,
          isVoiceNote: opts?.ptt || false,
          waConversationId: waConversationId || undefined,
          status: "sent",
        });
      }
    } catch (e) {
      console.error("Error saving media message:", e);
    }

    // Update conversation last message
    if (waConversationId) {
      try {
        await updateConversationLastMessage(waConversationId, {
          content: mediaContent,
          messageType: mediaType,
          fromMe: true,
          status: "sent",
          timestamp: new Date(),
        });
      } catch (e) {
        console.error("[ConvResolver] Error updating outbound media last message:", e);
      }
    }

    await this.logActivity(sessionId, "media_sent", `Mídia (${mediaType}) enviada para ${formattedJid}`);
    return result;
  }

  private async handleChatbot(sessionId: string, remoteJid: string, incomingText: string, sock: WASocket) {
    try {
      const db = await getDb();
      if (!db) return;

      const settingsArr = await db.select().from(chatbotSettings).where(eq(chatbotSettings.sessionId, sessionId)).limit(1);
      if (!settingsArr.length || !settingsArr[0].enabled) {
        // If away message is set and bot is disabled, send it
        if (settingsArr.length && settingsArr[0].awayMessage) {
          await this.sendAwayMessageIfNeeded(sessionId, remoteJid, settingsArr[0].awayMessage, sock, db);
        }
        return;
      }

      const s = settingsArr[0];
      const isGroup = remoteJid.endsWith("@g.us");

      // ─── Filter: Chat type ───
      if (isGroup && !s.respondGroups) return;
      if (!isGroup && !s.respondPrivate) return;

      // ─── Filter: Only when mentioned (groups) ───
      // Note: mention detection would need msg.mentionedJid, simplified here with bot name check
      // For now we skip this check as it requires the full message object

      // ─── Filter: Whitelist / Blacklist ───
      const mode = s.mode || "all";
      if (mode === "whitelist" || mode === "blacklist") {
        const rules = await db.select().from(chatbotRules).where(
          and(eq(chatbotRules.sessionId, sessionId), eq(chatbotRules.ruleType, mode as any))
        );
        const jids = rules.map((r) => r.remoteJid);
        if (mode === "whitelist" && !jids.includes(remoteJid)) {
          return; // Not in whitelist, skip
        }
        if (mode === "blacklist" && jids.includes(remoteJid)) {
          return; // In blacklist, skip
        }
      }

      // ─── Filter: Business hours ───
      if (s.businessHoursEnabled) {
        const tz = s.businessHoursTimezone || "America/Sao_Paulo";
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" });
        const parts = formatter.formatToParts(now);
        const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
        const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
        const dayMap: Record<string, string> = { Sun: "0", Mon: "1", Tue: "2", Wed: "3", Thu: "4", Fri: "5", Sat: "6" };
        const currentDay = dayMap[parts.find((p) => p.type === "weekday")?.value || "Mon"] || "1";
        const allowedDays = (s.businessHoursDays || "1,2,3,4,5").split(",");

        if (!allowedDays.includes(currentDay)) {
          if (s.awayMessage) await this.sendAwayMessageIfNeeded(sessionId, remoteJid, s.awayMessage, sock, db);
          return;
        }

        const [startH, startM] = (s.businessHoursStart || "09:00").split(":").map(Number);
        const [endH, endM] = (s.businessHoursEnd || "18:00").split(":").map(Number);
        const currentMinutes = hour * 60 + minute;
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
          if (s.awayMessage) await this.sendAwayMessageIfNeeded(sessionId, remoteJid, s.awayMessage, sock, db);
          return;
        }
      }

      // ─── Filter: Trigger words ───
      if (s.triggerWords) {
        const triggers = s.triggerWords.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
        if (triggers.length > 0) {
          const lowerText = incomingText.toLowerCase();
          const hasMatch = triggers.some((t) => lowerText.includes(t));
          if (!hasMatch) return;
        }
      }

      // ─── Filter: Rate limits ───
      const rateLimitPerHour = s.rateLimitPerHour || 0;
      const rateLimitPerDay = s.rateLimitPerDay || 0;

      if (rateLimitPerHour > 0 || rateLimitPerDay > 0) {
        if (rateLimitPerHour > 0) {
          const oneHourAgo = new Date(Date.now() - 3600000);
          const hourCount = await db.select({ count: sql<number>`count(*)` }).from(messages)
            .where(and(
              eq(messages.sessionId, sessionId),
              eq(messages.remoteJid, remoteJid),
              eq(messages.fromMe, true),
              gte(messages.createdAt, oneHourAgo)
            ));
          if ((hourCount[0]?.count || 0) >= rateLimitPerHour) return;
        }
        if (rateLimitPerDay > 0) {
          const oneDayAgo = new Date(Date.now() - 86400000);
          const dayCount = await db.select({ count: sql<number>`count(*)` }).from(messages)
            .where(and(
              eq(messages.sessionId, sessionId),
              eq(messages.remoteJid, remoteJid),
              eq(messages.fromMe, true),
              gte(messages.createdAt, oneDayAgo)
            ));
          if ((dayCount[0]?.count || 0) >= rateLimitPerDay) return;
        }
      }

      // ─── Reply delay ───
      const delay = s.replyDelay || 0;
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay * 1000));
      }

      // ─── Build context and invoke LLM ───
      const systemPrompt = s.systemPrompt || "Você é um assistente virtual amigável e prestativo. Responda de forma concisa e educada em português.";
      const contextCount = s.contextMessageCount || 10;

      const recentMessages = await db
        .select()
        .from(messages)
        .where(and(eq(messages.sessionId, sessionId), eq(messages.remoteJid, remoteJid)))
        .orderBy(desc(messages.createdAt))
        .limit(contextCount);

      const conversationHistory = recentMessages.reverse().map((m) => ({
        role: m.fromMe ? ("assistant" as const) : ("user" as const),
        content: m.content || "",
      }));

      const temp = parseFloat(s.temperature?.toString() || "0.70");

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: incomingText },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const replyText = typeof rawContent === 'string' ? rawContent : null;
      if (replyText) {
        await sock.sendMessage(remoteJid, { text: replyText });

        await db.insert(messages).values({
          sessionId,
          remoteJid,
          fromMe: true,
          messageType: "text",
          content: replyText,
          status: "sent",
        });

        await this.logActivity(sessionId, "chatbot_reply", `Chatbot respondeu para ${remoteJid}`);
      }
    } catch (e) {
      console.error("Chatbot error:", e);
      await this.logActivity(sessionId, "chatbot_error", `Erro no chatbot: ${(e as Error).message}`);
    }
  }

  /** Send away message at most once per contact per 4 hours */
  private async sendAwayMessageIfNeeded(sessionId: string, remoteJid: string, awayMessage: string, sock: WASocket, db: any) {
    try {
      const fourHoursAgo = new Date(Date.now() - 4 * 3600000);
      const recentAway = await db.select({ count: sql<number>`count(*)` }).from(messages)
        .where(and(
          eq(messages.sessionId, sessionId),
          eq(messages.remoteJid, remoteJid),
          eq(messages.fromMe, true),
          eq(messages.content, awayMessage),
          gte(messages.createdAt, fourHoursAgo)
        ));
      if ((recentAway[0]?.count || 0) > 0) return;

      await sock.sendMessage(remoteJid, { text: awayMessage });
      await db.insert(messages).values({
        sessionId,
        remoteJid,
        fromMe: true,
        messageType: "text",
        content: awayMessage,
        status: "sent",
      });
      await this.logActivity(sessionId, "away_message", `Mensagem de ausência enviada para ${remoteJid}`);
    } catch (e) {
      console.error("Away message error:", e);
    }
  }

  /** Sync historical messages using Baileys fetchMessageHistory */
  private async syncHistoricalMessages(sessionId: string, sock: WASocket) {
    try {
      const db = await getDb();
      if (!db) return;

      // Check if we already have messages for this session
      const existingCount = await db.select({ count: sql<number>`count(*)` }).from(messages)
        .where(eq(messages.sessionId, sessionId));
      const count = existingCount[0]?.count || 0;

      // If we already have messages, skip full sync (incremental sync via messaging-history.set)
      if (count > 50) {
        await this.logActivity(sessionId, "history_sync_skip", `Já existem ${count} mensagens, sync incremental ativo`);
        return;
      }

      await this.logActivity(sessionId, "history_sync_start", "Iniciando sincronização de histórico de mensagens");
    } catch (e) {
      console.error("Error in syncHistoricalMessages:", e);
    }
  }

  private async updateSessionDb(sessionId: string, userId: number, status: string, user?: any) {
    try {
      const db = await getDb();
      if (!db) return;

      const existing = await db.select().from(whatsappSessions).where(eq(whatsappSessions.sessionId, sessionId)).limit(1);

      if (existing.length) {
        await db
          .update(whatsappSessions)
          .set({
            status: status as any,
            phoneNumber: user?.id?.split(":")[0] || existing[0].phoneNumber,
            pushName: user?.name || existing[0].pushName,
          })
          .where(eq(whatsappSessions.sessionId, sessionId));
      } else {
        await db.insert(whatsappSessions).values({
          sessionId,
          userId,
          status: status as any,
          phoneNumber: user?.id?.split(":")[0] || null,
          pushName: user?.name || null,
        });
      }
    } catch (e) {
      console.error("Error updating session DB:", e);
    }
  }

  private async logActivity(sessionId: string, eventType: string, description: string, metadata?: any) {
    try {
      const db = await getDb();
      if (!db) return;
      await db.insert(activityLogs).values({ sessionId, eventType, description, metadata: metadata || null });
    } catch (e) {
      console.error("Error logging activity:", e);
    }
  }
}

export const whatsappManager = new WhatsAppManager();
