/**
 * WhatsApp Evolution Manager
 * 
 * Substitui o WhatsAppManager baseado em Baileys por uma integração
 * com a Evolution API v2. Cada usuário CRM tem sua própria instância.
 * 
 * Mantém a mesma interface de eventos (EventEmitter) para compatibilidade
 * com Socket.IO e o restante do sistema.
 */

import { EventEmitter } from "events";
import { getDb } from "./db";
import { whatsappSessions, waMessages } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import * as evo from "./evolutionApi";
import { resolveInbound, resolveOutbound, updateConversationLastMessage } from "./conversationResolver";
import { createNotification } from "./db";

// ════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════

export interface EvolutionSessionState {
  instanceName: string;
  sessionId: string; // same as instanceName for Evolution API
  userId: number;
  tenantId: number;
  status: "connecting" | "connected" | "disconnected" | "reconnecting";
  qrCode: string | null;
  qrDataUrl: string | null; // base64 QR from Evolution API
  user: { id: string; name: string; imgUrl?: string } | null;
  lastConnectedAt: number | null;
}

// ════════════════════════════════════════════════════════════
// EVOLUTION WHATSAPP MANAGER
// ════════════════════════════════════════════════════════════

class WhatsAppEvolutionManager extends EventEmitter {
  private sessions: Map<string, EvolutionSessionState> = new Map();
  // Map instanceName -> sessionId (for webhook routing)
  private instanceToSession: Map<string, string> = new Map();

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  // ─── SESSION STATE ───

  getSession(sessionId: string): EvolutionSessionState | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): EvolutionSessionState[] {
    return Array.from(this.sessions.values());
  }

  // ─── CONNECT (Create instance + get QR) ───

  async connect(sessionId: string, userId: number, tenantId?: number): Promise<EvolutionSessionState> {
    const tid = tenantId || 0;
    const instanceName = evo.getInstanceName(tid, userId);

    // Check if we already have this session in memory
    const existing = this.sessions.get(sessionId);
    if (existing?.status === "connected") {
      return existing;
    }

    // Create initial state
    const state: EvolutionSessionState = {
      instanceName,
      sessionId,
      userId,
      tenantId: tid,
      status: "connecting",
      qrCode: null,
      qrDataUrl: null,
      user: null,
      lastConnectedAt: null,
    };
    this.sessions.set(sessionId, state);
    this.instanceToSession.set(instanceName, sessionId);

    try {
      // Check if instance already exists on Evolution API
      const existingInstance = await evo.fetchInstance(instanceName);

      if (existingInstance) {
        if (existingInstance.connectionStatus === "open") {
          // Already connected
          state.status = "connected";
          state.user = existingInstance.ownerJid ? {
            id: existingInstance.ownerJid,
            name: existingInstance.profileName || "",
            imgUrl: existingInstance.profilePicUrl || undefined,
          } : null;
          state.lastConnectedAt = Date.now();

          await this.updateSessionInDb(sessionId, userId, tid, "connected", existingInstance);
          this.emit("status", { sessionId, status: "connected", user: state.user });
          return state;
        }

        // Instance exists but not connected — request new QR
        try {
          const qr = await evo.connectInstance(instanceName);
          if (qr?.base64) {
            state.qrDataUrl = qr.base64;
            state.qrCode = qr.base64;
            this.emit("qr", { sessionId, qrDataUrl: qr.base64 });
          }
        } catch (e: any) {
          console.warn(`[EvoWA] Connect failed for ${instanceName}, will try to recreate:`, e.message);
          // If connect fails, delete and recreate
          try { await evo.deleteInstance(instanceName); } catch {}
          const result = await this.createNewInstance(instanceName, state);
          return result;
        }
      } else {
        // Create new instance
        await this.createNewInstance(instanceName, state);
      }

      // Save to DB
      await this.updateSessionInDb(sessionId, userId, tid, "connecting");

      return state;
    } catch (error: any) {
      console.error(`[EvoWA] Error connecting ${sessionId}:`, error);
      state.status = "disconnected";
      this.emit("status", { sessionId, status: "disconnected" });
      throw error;
    }
  }

  private async createNewInstance(instanceName: string, state: EvolutionSessionState): Promise<EvolutionSessionState> {
    const result = await evo.createInstance(instanceName);

    if (result.qrcode?.base64) {
      state.qrDataUrl = result.qrcode.base64;
      state.qrCode = result.qrcode.base64;
      this.emit("qr", { sessionId: state.sessionId, qrDataUrl: result.qrcode.base64 });
    }

    return state;
  }

  // ─── DISCONNECT ───

  async disconnect(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      await evo.logoutInstance(session.instanceName);
    } catch (e: any) {
      console.warn(`[EvoWA] Logout failed for ${session.instanceName}:`, e.message);
    }

    session.status = "disconnected";
    session.qrCode = null;
    session.qrDataUrl = null;
    session.user = null;

    await this.updateSessionInDb(sessionId, session.userId, session.tenantId, "disconnected");
    this.emit("status", { sessionId, status: "disconnected" });
  }

  // ─── DELETE SESSION ───

  async deleteSession(sessionId: string, hardDelete: boolean = false): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (session) {
      try {
        await evo.deleteInstance(session.instanceName);
      } catch (e: any) {
        console.warn(`[EvoWA] Delete instance failed for ${session.instanceName}:`, e.message);
      }
      this.instanceToSession.delete(session.instanceName);
      this.sessions.delete(sessionId);
    }

    // Update DB
    const db = await getDb();
    if (!db) return;

    if (hardDelete) {
      await db.delete(whatsappSessions).where(eq(whatsappSessions.sessionId, sessionId));
    } else {
      await db.update(whatsappSessions)
        .set({ status: "deleted" })
        .where(eq(whatsappSessions.sessionId, sessionId));
    }

    this.emit("status", { sessionId, status: "deleted" });
  }

  // ─── SEND MESSAGES ───

  async sendTextMessage(sessionId: string, jid: string, text: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Sessão "${sessionId}" não encontrada`);
    if (session.status !== "connected") throw new Error(`Sessão "${sessionId}" não está conectada`);

    // Clean the JID to just the phone number
    const number = this.jidToNumber(jid);
    const result = await evo.sendText(session.instanceName, number, text);

    return result;
  }

  async sendMediaMessage(
    sessionId: string,
    jid: string,
    mediaUrl: string,
    mediaType: "image" | "audio" | "document" | "video",
    caption?: string,
    fileName?: string,
    opts?: { ptt?: boolean; mimetype?: string; duration?: number }
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Sessão "${sessionId}" não encontrada`);
    if (session.status !== "connected") throw new Error(`Sessão "${sessionId}" não está conectada`);

    const number = this.jidToNumber(jid);

    // For PTT audio, use the dedicated audio endpoint
    if (mediaType === "audio" && opts?.ptt) {
      return evo.sendAudio(session.instanceName, number, mediaUrl);
    }

    return evo.sendMedia(session.instanceName, number, mediaUrl, mediaType, {
      caption,
      fileName,
      mimetype: opts?.mimetype,
    });
  }

  // ─── PROFILE PICTURES ───

  async getProfilePicture(sessionId: string, jid: string): Promise<string | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const number = this.jidToNumber(jid);
    return evo.getProfilePicture(session.instanceName, number);
  }

  async getProfilePictures(sessionId: string, jids: string[]): Promise<Record<string, string | null>> {
    const session = this.sessions.get(sessionId);
    if (!session) return {};

    const result: Record<string, string | null> = {};
    // Batch in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < jids.length; i += batchSize) {
      const batch = jids.slice(i, i + batchSize);
      const promises = batch.map(async (jid) => {
        const number = this.jidToNumber(jid);
        const url = await evo.getProfilePicture(session.instanceName, number);
        result[jid] = url;
      });
      await Promise.allSettled(promises);
    }
    return result;
  }

  // ─── RESOLVE JID ───

  async resolveJidPublic(sessionId: string, phone: string): Promise<string> {
    // For Evolution API, the JID is simply the phone@s.whatsapp.net
    const cleaned = phone.replace(/[^\d]/g, "");
    return `${cleaned}@s.whatsapp.net`;
  }

  // ─── SYNC CONTACTS (not needed with Evolution API, but keep interface) ───

  async syncContacts(sessionId: string): Promise<{ synced: number; total: number; resolved: number }> {
    // Evolution API manages contacts internally
    return { synced: 0, total: 0, resolved: 0 };
  }

  // ─── WEBHOOK HANDLER ───
  // Called by the webhook endpoint when Evolution API sends events

  async handleWebhookEvent(payload: evo.WebhookPayload): Promise<void> {
    const instanceName = payload.instance;
    const sessionId = this.instanceToSession.get(instanceName);

    // If we don't have this session in memory, try to find it in DB
    let session = sessionId ? this.sessions.get(sessionId) : undefined;
    if (!session) {
      // Try to load from DB by matching instanceName pattern
      const loaded = await this.loadSessionByInstanceName(instanceName);
      if (loaded) {
        session = loaded;
      }
    }

    switch (payload.event) {
      case "qrcode.updated":
        if (session) {
          const qrBase64 = payload.data?.qrcode?.base64 || payload.data?.base64;
          if (qrBase64) {
            session.qrDataUrl = qrBase64;
            session.qrCode = qrBase64;
            this.emit("qr", { sessionId: session.sessionId, qrDataUrl: qrBase64 });
          }
        }
        break;

      case "connection.update":
        if (session) {
          const state = payload.data?.state || payload.data?.status;
          if (state === "open") {
            session.status = "connected";
            session.qrCode = null;
            session.qrDataUrl = null;
            session.lastConnectedAt = Date.now();

            // Fetch instance details for profile info
            try {
              const inst = await evo.fetchInstance(session.instanceName);
              if (inst) {
                session.user = {
                  id: inst.ownerJid || "",
                  name: inst.profileName || "",
                  imgUrl: inst.profilePicUrl || undefined,
                };
                // Update phone number in DB
                const phoneMatch = inst.ownerJid?.match(/^(\d+)@/);
                if (phoneMatch) {
                  const db = await getDb();
                  if (db) {
                    await db.update(whatsappSessions)
                      .set({ phoneNumber: phoneMatch[1], pushName: inst.profileName || undefined })
                      .where(eq(whatsappSessions.sessionId, session.sessionId));
                  }
                }
              }
            } catch {}

            await this.updateSessionInDb(session.sessionId, session.userId, session.tenantId, "connected");
            this.emit("status", { sessionId: session.sessionId, status: "connected", user: session.user });
          } else if (state === "close") {
            session.status = "disconnected";
            session.qrCode = null;
            session.qrDataUrl = null;
            await this.updateSessionInDb(session.sessionId, session.userId, session.tenantId, "disconnected");
            this.emit("status", { sessionId: session.sessionId, status: "disconnected" });
          }
        }
        break;

      case "messages.upsert":
        if (session) {
          await this.handleIncomingMessage(session, payload.data);
        }
        break;

      case "messages.update":
        if (session) {
          await this.handleMessageStatusUpdate(session, payload.data);
        }
        break;

      case "send.message":
        if (session) {
          await this.handleOutgoingMessage(session, payload.data);
        }
        break;
    }
  }

  // ─── MESSAGE HANDLERS ───

  private async handleIncomingMessage(session: EvolutionSessionState, data: any): Promise<void> {
    try {
      const key = data?.key;
      if (!key?.remoteJid) return;

      // Skip status messages and protocol messages
      if (key.remoteJid === "status@broadcast") return;
      const messageType = data?.messageType || "conversation";
      const skipTypes = ["protocolMessage", "senderKeyDistributionMessage", "messageContextInfo", "reactionMessage", "ephemeralMessage"];
      if (skipTypes.includes(messageType)) return;

      const fromMe = key.fromMe || false;
      const remoteJid = key.remoteJid;
      const messageId = key.id;
      const pushName = data?.pushName || "";
      const timestamp = data?.messageTimestamp ? Number(data.messageTimestamp) * 1000 : Date.now();

      // Extract message content
      const content = this.extractMessageContent(data);

      // Save to DB
      const db = await getDb();
      if (!db) return;

      // Check for duplicate
      const existing = await db.select({ id: waMessages.id })
        .from(waMessages)
        .where(and(
          eq(waMessages.sessionId, session.sessionId),
          eq(waMessages.messageId, messageId || "")
        ))
        .limit(1);

      if (existing.length > 0) return; // Duplicate

      await db.insert(waMessages).values({
        sessionId: session.sessionId,
        tenantId: session.tenantId,
        messageId: messageId || null,
        remoteJid,
        fromMe,
        messageType,
        content: content || null,
        pushName: pushName || null,
        status: fromMe ? "sent" : "received",
        timestamp: new Date(timestamp),
      });

      // Resolve conversation
      try {
        if (fromMe) {
          const resolved = await resolveOutbound(session.tenantId, session.sessionId, remoteJid);
          if (resolved) {
            await updateConversationLastMessage(resolved.conversationId, {
              content: content || "",
              fromMe,
              timestamp: new Date(timestamp),
              incrementUnread: false,
            });
          }
        } else {
          const resolved = await resolveInbound(session.tenantId, session.sessionId, remoteJid, pushName);
          if (resolved) {
            await updateConversationLastMessage(resolved.conversationId, {
              content: content || "",
              fromMe,
              timestamp: new Date(timestamp),
              incrementUnread: true,
            });
          }
        }
      } catch (e) {
        console.warn("[EvoWA] Conversation resolver error:", e);
      }

      // Emit event for Socket.IO
      this.emit("message", {
        sessionId: session.sessionId,
        tenantId: session.tenantId,
        content,
        fromMe,
        remoteJid,
        messageType,
        pushName,
        timestamp,
      });

      // Create notification for incoming messages
      if (!fromMe) {
        try {
          await createNotification(session.tenantId, {
            type: "whatsapp_message",
            title: `Nova mensagem de ${pushName || remoteJid.split("@")[0]}`,
            body: content?.substring(0, 200) || "Nova mensagem recebida",
            entityType: "whatsapp",
            entityId: session.sessionId,
          });
        } catch {}
      }
    } catch (error) {
      console.error("[EvoWA] Error handling incoming message:", error);
    }
  }

  private async handleOutgoingMessage(session: EvolutionSessionState, data: any): Promise<void> {
    try {
      const key = data?.key;
      if (!key?.remoteJid) return;

      const remoteJid = key.remoteJid;
      const messageId = key.id;
      const content = this.extractMessageContent(data);
      const messageType = data?.messageType || "conversation";
      const timestamp = data?.messageTimestamp ? Number(data.messageTimestamp) * 1000 : Date.now();

      const db = await getDb();
      if (!db) return;

      // Check for duplicate
      const existing = await db.select({ id: waMessages.id })
        .from(waMessages)
        .where(and(
          eq(waMessages.sessionId, session.sessionId),
          eq(waMessages.messageId, messageId || "")
        ))
        .limit(1);

      if (existing.length > 0) return;

      await db.insert(waMessages).values({
        sessionId: session.sessionId,
        tenantId: session.tenantId,
        messageId: messageId || null,
        remoteJid,
        fromMe: true,
        messageType,
        content: content || null,
        pushName: null,
        status: "sent",
        timestamp: new Date(timestamp),
      });

      // Resolve conversation
      try {
        const resolved = await resolveOutbound(session.tenantId, session.sessionId, remoteJid);
        if (resolved) {
          await updateConversationLastMessage(resolved.conversationId, {
            content: content || "",
            fromMe: true,
            timestamp: new Date(timestamp),
            incrementUnread: false,
          });
        }
      } catch {}

    } catch (error) {
      console.error("[EvoWA] Error handling outgoing message:", error);
    }
  }

  private async handleMessageStatusUpdate(session: EvolutionSessionState, data: any): Promise<void> {
    try {
      // data can be an array of updates
      const updates = Array.isArray(data) ? data : [data];
      const db = await getDb();
      if (!db) return;

      for (const update of updates) {
        const messageId = update?.key?.id;
        const statusMap: Record<number, string> = {
          0: "error",
          1: "pending",
          2: "sent",
          3: "delivered",
          4: "read",
          5: "played",
        };
        const newStatus = statusMap[update?.update?.status] || update?.update?.status;
        if (!messageId || !newStatus) continue;

        await db.update(waMessages)
          .set({ status: newStatus })
          .where(and(
            eq(waMessages.sessionId, session.sessionId),
            eq(waMessages.messageId, messageId)
          ));

        this.emit("message:status", {
          sessionId: session.sessionId,
          messageId,
          status: newStatus,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error("[EvoWA] Error handling message status update:", error);
    }
  }

  // ─── CONTENT EXTRACTION ───

  private extractMessageContent(data: any): string {
    const msg = data?.message;
    if (!msg) return data?.body || "";

    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return `[Imagem] ${msg.imageMessage.caption}`;
    if (msg.imageMessage) return "[Imagem]";
    if (msg.videoMessage?.caption) return `[Vídeo] ${msg.videoMessage.caption}`;
    if (msg.videoMessage) return "[Vídeo]";
    if (msg.audioMessage) return "[Áudio]";
    if (msg.documentMessage) return `[Documento] ${msg.documentMessage.fileName || ""}`;
    if (msg.stickerMessage) return "[Sticker]";
    if (msg.contactMessage) return `[Contato] ${msg.contactMessage.displayName || ""}`;
    if (msg.locationMessage) return "[Localização]";
    if (msg.liveLocationMessage) return "[Localização ao vivo]";
    if (msg.listMessage) return msg.listMessage.description || "[Lista]";
    if (msg.buttonsMessage) return msg.buttonsMessage.contentText || "[Botões]";
    if (msg.templateMessage) return "[Template]";
    if (msg.reactionMessage) return `[Reação] ${msg.reactionMessage.text || ""}`;

    return data?.body || "";
  }

  // ─── HELPERS ───

  private jidToNumber(jid: string): string {
    // Convert "5584999999999@s.whatsapp.net" to "5584999999999"
    return jid.replace(/@.*$/, "").replace(/[^\d]/g, "");
  }

  private async updateSessionInDb(
    sessionId: string,
    userId: number,
    tenantId: number,
    status: "connecting" | "connected" | "disconnected",
    instanceData?: evo.EvolutionInstance | null
  ): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;

      // Check if session exists
      const existing = await db.select({ id: whatsappSessions.id })
        .from(whatsappSessions)
        .where(eq(whatsappSessions.sessionId, sessionId))
        .limit(1);

      const phoneNumber = instanceData?.ownerJid?.match(/^(\d+)@/)?.[1] || null;
      const pushName = instanceData?.profileName || null;

      if (existing.length > 0) {
        await db.update(whatsappSessions)
          .set({
            status,
            ...(phoneNumber ? { phoneNumber } : {}),
            ...(pushName ? { pushName } : {}),
          })
          .where(eq(whatsappSessions.sessionId, sessionId));
      } else {
        await db.insert(whatsappSessions).values({
          sessionId,
          userId,
          tenantId,
          status,
          phoneNumber,
          pushName,
        });
      }
    } catch (e) {
      console.error("[EvoWA] DB update error:", e);
    }
  }

  private async loadSessionByInstanceName(instanceName: string): Promise<EvolutionSessionState | undefined> {
    try {
      const db = await getDb();
      if (!db) return undefined;

      // Parse tenantId and userId from instanceName (crm-{tenantId}-{userId})
      const match = instanceName.match(/^crm-(\d+)-(\d+)$/);
      if (!match) return undefined;

      const tenantId = parseInt(match[1]);
      const userId = parseInt(match[2]);

      // Find session in DB by tenantId and userId
      const rows = await db.select()
        .from(whatsappSessions)
        .where(and(
          eq(whatsappSessions.tenantId, tenantId),
          eq(whatsappSessions.userId, userId),
          sql`${whatsappSessions.status} != 'deleted'`
        ))
        .limit(1);

      if (rows.length === 0) return undefined;

      const row = rows[0];
      const state: EvolutionSessionState = {
        instanceName,
        sessionId: row.sessionId,
        userId: row.userId,
        tenantId: row.tenantId,
        status: (row.status as any) || "disconnected",
        qrCode: null,
        qrDataUrl: null,
        user: null,
        lastConnectedAt: null,
      };

      this.sessions.set(row.sessionId, state);
      this.instanceToSession.set(instanceName, row.sessionId);

      return state;
    } catch (e) {
      console.error("[EvoWA] loadSessionByInstanceName error:", e);
      return undefined;
    }
  }

  // ─── AUTO-RESTORE ───

  async autoRestoreSessions(): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;

      // Find all non-deleted sessions
      const rows = await db.select()
        .from(whatsappSessions)
        .where(sql`${whatsappSessions.status} != 'deleted'`);

      console.log(`[EvoWA AutoRestore] Found ${rows.length} sessions to check`);

      for (const row of rows) {
        const instanceName = evo.getInstanceName(row.tenantId, row.userId);

        // Check if instance exists and is connected on Evolution API
        try {
          const inst = await evo.fetchInstance(instanceName);
          if (inst) {
            const state: EvolutionSessionState = {
              instanceName,
              sessionId: row.sessionId,
              userId: row.userId,
              tenantId: row.tenantId,
              status: inst.connectionStatus === "open" ? "connected" : "disconnected",
              qrCode: null,
              qrDataUrl: null,
              user: inst.ownerJid ? {
                id: inst.ownerJid,
                name: inst.profileName || "",
                imgUrl: inst.profilePicUrl || undefined,
              } : null,
              lastConnectedAt: inst.connectionStatus === "open" ? Date.now() : null,
            };

            this.sessions.set(row.sessionId, state);
            this.instanceToSession.set(instanceName, row.sessionId);

            // Update DB status
            const dbStatus = inst.connectionStatus === "open" ? "connected" : "disconnected";
            await db.update(whatsappSessions)
              .set({ status: dbStatus })
              .where(eq(whatsappSessions.sessionId, row.sessionId));

            console.log(`[EvoWA AutoRestore] ${row.sessionId} -> ${instanceName} -> ${dbStatus}`);
          } else {
            // Instance doesn't exist on Evolution API
            await db.update(whatsappSessions)
              .set({ status: "disconnected" })
              .where(eq(whatsappSessions.sessionId, row.sessionId));
            console.log(`[EvoWA AutoRestore] ${row.sessionId} -> instance not found, marked disconnected`);
          }
        } catch (e: any) {
          console.warn(`[EvoWA AutoRestore] Error checking ${instanceName}:`, e.message);
        }
      }
    } catch (e) {
      console.error("[EvoWA AutoRestore] Error:", e);
    }
  }

  // ─── SHUTDOWN ───

  async shutdown(): Promise<void> {
    console.log("[EvoWA] Shutting down...");
    this.sessions.clear();
    this.instanceToSession.clear();
    this.removeAllListeners();
  }
}

// ════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ════════════════════════════════════════════════════════════

export const whatsappManager = new WhatsAppEvolutionManager();
