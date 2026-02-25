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
import { whatsappSessions, messages, activityLogs, chatbotSettings } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
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

        if (msg.message.conversation) {
          content = msg.message.conversation;
        } else if (msg.message.extendedTextMessage?.text) {
          content = msg.message.extendedTextMessage.text;
        } else if (msg.message.imageMessage?.caption) {
          content = msg.message.imageMessage.caption;
        } else if (msg.message.videoMessage?.caption) {
          content = msg.message.videoMessage.caption;
        } else if (msg.message.documentMessage?.fileName) {
          content = `[Documento: ${msg.message.documentMessage.fileName}]`;
        } else if (msg.message.audioMessage) {
          content = "[Áudio]";
        }

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
              timestamp: new Date(((msg.messageTimestamp as number) || Date.now() / 1000) * 1000),
            });
          }
        } catch (e) {
          console.error("Error saving message:", e);
        }

        this.emit("message", { sessionId, message: msg, content, fromMe, remoteJid, messageType });

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
        });
      }
    } catch (e) {
      console.error("Error saving sent message:", e);
    }

    await this.logActivity(sessionId, "message_sent", `Mensagem enviada para ${formattedJid}`);
    return result;
  }

  async sendMediaMessage(sessionId: string, jid: string, mediaUrl: string, mediaType: "image" | "audio" | "document", caption?: string, fileName?: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session?.socket || session.status !== "connected") {
      throw new Error("Sessão não conectada");
    }

    const formattedJid = jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
    let messageContent: any;

    if (mediaType === "image") {
      messageContent = { image: { url: mediaUrl }, caption: caption || "" };
    } else if (mediaType === "audio") {
      messageContent = { audio: { url: mediaUrl }, mimetype: "audio/mpeg" };
    } else {
      messageContent = { document: { url: mediaUrl }, mimetype: "application/octet-stream", fileName: fileName || "document" };
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
          content: caption || `[${mediaType}]`,
          mediaUrl,
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

      const settings = await db.select().from(chatbotSettings).where(eq(chatbotSettings.sessionId, sessionId)).limit(1);
      if (!settings.length || !settings[0].enabled) return;

      const systemPrompt = settings[0].systemPrompt || "Você é um assistente virtual amigável e prestativo. Responda de forma concisa e educada em português.";

      // Get recent conversation context
      const recentMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.remoteJid, remoteJid))
        .orderBy(desc(messages.createdAt))
        .limit(10);

      const conversationHistory = recentMessages.reverse().map((m) => ({
        role: m.fromMe ? ("assistant" as const) : ("user" as const),
        content: m.content || "",
      }));

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
        });

        await this.logActivity(sessionId, "chatbot_reply", `Chatbot respondeu para ${remoteJid}`);
      }
    } catch (e) {
      console.error("Chatbot error:", e);
      await this.logActivity(sessionId, "chatbot_error", `Erro no chatbot: ${(e as Error).message}`);
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
