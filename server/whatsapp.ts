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
import { getDb } from "./db";
import { whatsappSessions, waMessages as messages, activityLogs, chatbotSettings, chatbotRules } from "../drizzle/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

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

        await notifyOwner({
          title: "WhatsApp Desconectado",
          content: `A sessão "${sessionId}" foi desconectada. Código: ${statusCode}. ${shouldReconnect ? "Tentando reconectar..." : "Sessão encerrada pelo usuário."}`,
        });

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

        await notifyOwner({
          title: "WhatsApp Conectado",
          content: `A sessão "${sessionId}" foi conectada com sucesso como ${sock.user?.name || sock.user?.id}.`,
        });
      }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages: msgs, type }) => {
      for (const msg of msgs) {
        if (!msg.message) continue;

        const remoteJid = msg.key.remoteJid || "";
        const fromMe = msg.key.fromMe || false;
        const messageType = Object.keys(msg.message)[0] || "unknown";
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

        // Save message to DB
        try {
          const db = await getDb();
          if (db) {
            await db.insert(messages).values({
              sessionId,
              messageId: msg.key.id || undefined,
              remoteJid,
              fromMe,
              messageType,
              content,
              mediaUrl,
              mediaMimeType,
              mediaFileName,
              mediaDuration,
              isVoiceNote,
              status: initialStatus,
              timestamp: new Date(((msg.messageTimestamp as number) || Date.now() / 1000) * 1000),
            });
          }
        } catch (e) {
          console.error("Error saving message:", e);
        }

        this.emit("message", { sessionId, message: msg, content, fromMe, remoteJid, messageType, mediaUrl, mediaMimeType, mediaFileName, mediaDuration, isVoiceNote, status: initialStatus });

        // Chatbot auto-reply
        if (!fromMe && content && type === "notify") {
          await this.handleChatbot(sessionId, remoteJid, content, sock);
        }

        // Notify owner of incoming messages
        if (!fromMe && content) {
          const senderName = remoteJid.replace("@s.whatsapp.net", "");
          await notifyOwner({
            title: "Nova Mensagem no WhatsApp",
            content: `De: ${senderName}\nMensagem: ${content.substring(0, 200)}`,
          });
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

  async sendTextMessage(sessionId: string, jid: string, text: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session?.socket || session.status !== "connected") {
      throw new Error("Sessão não conectada");
    }

    const formattedJid = jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
    const result = await session.socket.sendMessage(formattedJid, { text });

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
          status: "sent",
        });
      }
    } catch (e) {
      console.error("Error saving sent message:", e);
    }

    await this.logActivity(sessionId, "message_sent", `Mensagem enviada para ${formattedJid}`);
    return result;
  }

  async sendMediaMessage(sessionId: string, jid: string, mediaUrl: string, mediaType: "image" | "audio" | "document" | "video", caption?: string, fileName?: string, opts?: { ptt?: boolean; mimetype?: string; duration?: number }): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session?.socket || session.status !== "connected") {
      throw new Error("Sessão não conectada");
    }

    const formattedJid = jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
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

    try {
      const db = await getDb();
      if (db) {
        await db.insert(messages).values({
          sessionId,
          messageId: result?.key?.id || undefined,
          remoteJid: formattedJid,
          fromMe: true,
          messageType: mediaType,
          content: caption || (mediaType === "audio" ? "[Áudio]" : `[${mediaType}]`),
          mediaUrl,
          mediaMimeType: opts?.mimetype,
          mediaFileName: fileName,
          mediaDuration: opts?.duration,
          isVoiceNote: opts?.ptt || false,
          status: "sent",
        });
      }
    } catch (e) {
      console.error("Error saving media message:", e);
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
