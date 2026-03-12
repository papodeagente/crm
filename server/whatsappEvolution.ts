/**
 * WhatsApp Evolution Manager
 * 
 * Integração com Evolution API v2. Cada usuário CRM tem exatamente
 * UMA instância. O sistema gerencia nomes de instância automaticamente.
 * 
 * Fluxo:
 * - Se o usuário nunca logou → cria instância + gera QR
 * - Se já logou → reconecta na mesma instância
 * - Ao conectar → sincroniza conversas (todas se primeira vez, novas se já conectou)
 * 
 * Mantém EventEmitter para compatibilidade com Socket.IO.
 */

import { EventEmitter } from "events";
import { getDb } from "./db";
import { whatsappSessions, waMessages, waConversations } from "../drizzle/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import * as evo from "./evolutionApi";
import { resolveInbound, updateConversationLastMessage } from "./conversationResolver";
import { createNotification } from "./db";

// ════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════

export interface EvolutionSessionState {
  instanceName: string;
  sessionId: string;
  userId: number;
  tenantId: number;
  status: "connecting" | "connected" | "disconnected" | "reconnecting";
  qrCode: string | null;
  qrDataUrl: string | null;
  user: { id: string; name: string; imgUrl?: string } | null;
  lastConnectedAt: number | null;
}

// ════════════════════════════════════════════════════════════
// EVOLUTION WHATSAPP MANAGER
// ════════════════════════════════════════════════════════════

class WhatsAppEvolutionManager extends EventEmitter {
  private sessions: Map<string, EvolutionSessionState> = new Map();
  private instanceToSession: Map<string, string> = new Map();

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  // ─── SESSION STATE ───

  getSession(sessionId: string): EvolutionSessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get session with live check against Evolution API.
   * If session is in memory, returns it. Otherwise, queries Evolution API
   * and populates the in-memory cache.
   */
  async getSessionLive(sessionId: string): Promise<EvolutionSessionState | undefined> {
    // First check in-memory
    const cached = this.sessions.get(sessionId);
    if (cached && cached.status === "connected") return cached;

    // Try to fetch from Evolution API directly
    try {
      const inst = await evo.fetchInstance(sessionId);
      if (!inst) return cached; // Not found on Evolution API, return whatever we have

      const state: EvolutionSessionState = {
        instanceName: sessionId,
        sessionId,
        userId: cached?.userId || 0,
        tenantId: cached?.tenantId || 0,
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

      // Update in-memory cache
      this.sessions.set(sessionId, state);
      this.instanceToSession.set(sessionId, sessionId);

      // Also update DB status
      const db = await getDb();
      if (db) {
        const dbStatus = state.status === "reconnecting" ? "connecting" as const : state.status as "connecting" | "connected" | "disconnected";
        await db.update(whatsappSessions)
          .set({
            status: dbStatus,
            phoneNumber: inst.ownerJid ? inst.ownerJid.replace("@s.whatsapp.net", "") : undefined,
          })
          .where(eq(whatsappSessions.sessionId, sessionId));
      }

      return state;
    } catch (e) {
      return cached;
    }
  }

  getAllSessions(): EvolutionSessionState[] {
    return Array.from(this.sessions.values());
  }

  // ─── CONNECT (Automatic — 1 instance per user) ───
  // sessionId is auto-generated from tenantId + userId
  // No user input needed — just call connectUser(userId, tenantId)

  async connectUser(userId: number, tenantId: number): Promise<EvolutionSessionState> {
    const instanceName = evo.getInstanceName(tenantId, userId);
    const sessionId = instanceName; // sessionId = instanceName for simplicity

    // Check if we already have this session in memory and connected
    const existing = this.sessions.get(sessionId);
    if (existing?.status === "connected") {
      return existing;
    }

    // Create initial state
    const state: EvolutionSessionState = {
      instanceName,
      sessionId,
      userId,
      tenantId,
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
          // Already connected — sync conversations in background
          state.status = "connected";
          state.user = existingInstance.ownerJid ? {
            id: existingInstance.ownerJid,
            name: existingInstance.profileName || "",
            imgUrl: existingInstance.profilePicUrl || undefined,
          } : null;
          state.lastConnectedAt = Date.now();

          await this.updateSessionInDb(sessionId, userId, tenantId, "connected", existingInstance);
          this.emit("status", { sessionId, status: "connected", user: state.user });

          // Sync new conversations in background
          this.syncConversationsBackground(state, false);
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
          console.warn(`[EvoWA] Connect failed for ${instanceName}, will recreate:`, e.message);
          try { await evo.deleteInstance(instanceName); } catch {}
          await this.createNewInstance(instanceName, state);
        }
      } else {
        // First time — create new instance
        await this.createNewInstance(instanceName, state);
      }

      // Save to DB
      await this.updateSessionInDb(sessionId, userId, tenantId, "connecting");
      return state;
    } catch (error: any) {
      console.error(`[EvoWA] Error connecting ${sessionId}:`, error);
      state.status = "disconnected";
      this.emit("status", { sessionId, status: "disconnected" });
      throw error;
    }
  }

  // Legacy connect method (for backward compatibility with existing code)
  async connect(sessionId: string, userId: number, tenantId?: number): Promise<EvolutionSessionState> {
    return this.connectUser(userId, tenantId || 0);
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
    if (!session) throw new Error(`Sessão não encontrada. Conecte seu WhatsApp primeiro.`);
    if (session.status !== "connected") throw new Error(`WhatsApp não está conectado. Reconecte seu WhatsApp.`);

    const number = this.jidToNumber(jid);
    return evo.sendText(session.instanceName, number, text);
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
    if (!session) throw new Error(`Sessão não encontrada. Conecte seu WhatsApp primeiro.`);
    if (session.status !== "connected") throw new Error(`WhatsApp não está conectado. Reconecte seu WhatsApp.`);

    const number = this.jidToNumber(jid);

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
    const cleaned = phone.replace(/[^\d]/g, "");
    return `${cleaned}@s.whatsapp.net`;
  }

  // ─── SYNC CONTACTS (interface compatibility) ───

  async syncContacts(sessionId: string): Promise<{ synced: number; total: number; resolved: number }> {
    return { synced: 0, total: 0, resolved: 0 };
  }

  // ─── SYNC CONVERSATIONS ───
  // Sincroniza conversas da Evolution API para o banco de dados.
  // - isFirstSync=true: sincroniza TODOS os chats e suas últimas mensagens
  // - isFirstSync=false: sincroniza apenas chats com mensagens mais recentes que as do banco

  private async syncConversationsBackground(session: EvolutionSessionState, isFirstSync: boolean): Promise<void> {
    try {
      console.log(`[EvoWA Sync] Starting ${isFirstSync ? "FULL" : "incremental"} sync for ${session.instanceName}`);
      
      // Fetch all chats from Evolution API
      const chats = await evo.findChats(session.instanceName);
      console.log(`[EvoWA Sync] Found ${chats.length} chats on Evolution API`);

      let synced = 0;
      let skipped = 0;

      for (const chat of chats) {
        try {
          const remoteJid = chat.remoteJid;
          if (!remoteJid) continue;

          // Skip groups and broadcast
          if (remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast" || remoteJid.endsWith("@lid")) {
            skipped++;
            continue;
          }

          const pushName = chat.pushName || null;

          // Resolve conversation in our DB (creates if not exists)
          const resolved = await resolveInbound(session.tenantId, session.sessionId, remoteJid, pushName);
          if (!resolved) continue;

          // Check if we need to sync messages for this chat
          const db = await getDb();
          if (!db) continue;

          // Get the latest message timestamp we have for this conversation
          const latestMsg = await db.select({ timestamp: waMessages.timestamp })
            .from(waMessages)
            .where(and(
              eq(waMessages.sessionId, session.sessionId),
              eq(waMessages.remoteJid, remoteJid)
            ))
            .orderBy(desc(waMessages.timestamp))
            .limit(1);

          const lastSyncedTimestamp = latestMsg.length > 0 ? latestMsg[0].timestamp : null;

          // If not first sync and we already have messages, check if Evolution has newer ones
          if (!isFirstSync && lastSyncedTimestamp) {
            const lastMessageAt = chat.lastMessage?.messageTimestamp
              ? new Date(Number(chat.lastMessage.messageTimestamp) * 1000)
              : null;

            if (lastMessageAt && lastMessageAt <= lastSyncedTimestamp) {
              skipped++;
              continue; // No new messages
            }
          }

          // Fetch messages from Evolution API for this chat
          const messages = await evo.findMessages(session.instanceName, remoteJid, {
            limit: isFirstSync ? 50 : 20, // More messages on first sync
          });

          let newMsgCount = 0;
          for (const msg of messages) {
            const key = msg?.key;
            if (!key?.id) continue;

            const messageId = key.id;
            const fromMe = key.fromMe || false;
            const messageType = msg.messageType || "conversation";
            const msgTimestamp = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000) : new Date();

            // Skip if we already have this message
            if (lastSyncedTimestamp && msgTimestamp <= lastSyncedTimestamp && !isFirstSync) continue;

            // Check for duplicate by messageId
            const existing = await db.select({ id: waMessages.id })
              .from(waMessages)
              .where(and(
                eq(waMessages.sessionId, session.sessionId),
                eq(waMessages.messageId, messageId)
              ))
              .limit(1);

            if (existing.length > 0) continue;

            const content = this.extractMessageContent(msg);

            await db.insert(waMessages).values({
              sessionId: session.sessionId,
              tenantId: session.tenantId,
              messageId,
              remoteJid,
              fromMe,
              messageType,
              content: content || null,
              pushName: msg.pushName || null,
              status: fromMe ? "sent" : "received",
              timestamp: msgTimestamp,
            });
            newMsgCount++;
          }

          // Update conversation with last message info
          if (messages.length > 0) {
            const lastMsg = messages[0]; // Most recent
            const lastContent = this.extractMessageContent(lastMsg);
            const lastTimestamp = lastMsg.messageTimestamp
              ? new Date(Number(lastMsg.messageTimestamp) * 1000)
              : new Date();

            await updateConversationLastMessage(resolved.conversationId, {
              content: lastContent || "",
              fromMe: lastMsg.key?.fromMe || false,
              timestamp: lastTimestamp,
              incrementUnread: false,
            });
          }

          if (newMsgCount > 0) synced++;
        } catch (e: any) {
          // Skip individual chat errors
          console.warn(`[EvoWA Sync] Error syncing chat:`, e.message);
        }
      }

      console.log(`[EvoWA Sync] Done: ${synced} chats synced, ${skipped} skipped`);
    } catch (error) {
      console.error("[EvoWA Sync] Error:", error);
    }
  }

  // ─── WEBHOOK HANDLER ───

  async handleWebhookEvent(payload: evo.WebhookPayload): Promise<void> {
    const instanceName = payload.instance;
    const sessionId = this.instanceToSession.get(instanceName);

    let session = sessionId ? this.sessions.get(sessionId) : undefined;
    if (!session) {
      const loaded = await this.loadSessionByInstanceName(instanceName);
      if (loaded) session = loaded;
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

            // Sync conversations after connection
            // Check if this is first time (no messages in DB for this session)
            const db = await getDb();
            if (db) {
              const msgCount = await db.select({ count: sql<number>`count(*)` })
                .from(waMessages)
                .where(eq(waMessages.sessionId, session.sessionId));
              const isFirstSync = (msgCount[0]?.count || 0) === 0;
              this.syncConversationsBackground(session, isFirstSync);
            }
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

      if (key.remoteJid === "status@broadcast") return;
      if (key.remoteJid.endsWith("@g.us")) return; // Skip groups
      if (key.remoteJid.endsWith("@lid")) return; // Skip LID

      const messageType = data?.messageType || "conversation";
      const skipTypes = ["protocolMessage", "senderKeyDistributionMessage", "messageContextInfo", "reactionMessage", "ephemeralMessage"];
      if (skipTypes.includes(messageType)) return;

      const fromMe = key.fromMe || false;
      const remoteJid = key.remoteJid;
      const messageId = key.id;
      const pushName = data?.pushName || "";
      const timestamp = data?.messageTimestamp ? Number(data.messageTimestamp) * 1000 : Date.now();

      const content = this.extractMessageContent(data);

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
        fromMe,
        messageType,
        content: content || null,
        pushName: pushName || null,
        status: fromMe ? "sent" : "received",
        timestamp: new Date(timestamp),
      });

      // Resolve conversation
      try {
        const resolved = await resolveInbound(session.tenantId, session.sessionId, remoteJid, pushName);
        if (resolved) {
          await updateConversationLastMessage(resolved.conversationId, {
            content: content || "",
            fromMe,
            timestamp: new Date(timestamp),
            incrementUnread: !fromMe,
          });
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
      if (remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") return;

      const messageId = key.id;
      const content = this.extractMessageContent(data);
      const messageType = data?.messageType || "conversation";
      const timestamp = data?.messageTimestamp ? Number(data.messageTimestamp) * 1000 : Date.now();

      const db = await getDb();
      if (!db) return;

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

      try {
        const resolved = await resolveInbound(session.tenantId, session.sessionId, remoteJid);
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
      const updates = Array.isArray(data) ? data : [data];
      const db = await getDb();
      if (!db) return;

      for (const update of updates) {
        const messageId = update?.key?.id;
        const statusMap: Record<number, string> = {
          0: "error", 1: "pending", 2: "sent", 3: "delivered", 4: "read", 5: "played",
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
    return jid.replace(/@.*$/, "").replace(/[^\d]/g, "");
  }

  /**
   * Get the session for a specific user (by tenantId + userId).
   * Returns undefined if user has no session.
   */
  getSessionForUser(tenantId: number, userId: number): EvolutionSessionState | undefined {
    const instanceName = evo.getInstanceName(tenantId, userId);
    const sessionId = this.instanceToSession.get(instanceName) || instanceName;
    return this.sessions.get(sessionId);
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

      const match = instanceName.match(/^crm-(\d+)-(\d+)$/);
      if (!match) return undefined;

      const tenantId = parseInt(match[1]);
      const userId = parseInt(match[2]);

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

      const rows = await db.select()
        .from(whatsappSessions)
        .where(sql`${whatsappSessions.status} != 'deleted'`);

      console.log(`[EvoWA AutoRestore] Found ${rows.length} sessions to check`);

      for (const row of rows) {
        const instanceName = evo.getInstanceName(row.tenantId, row.userId);

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

            const dbStatus = inst.connectionStatus === "open" ? "connected" : "disconnected";
            await db.update(whatsappSessions)
              .set({ status: dbStatus })
              .where(eq(whatsappSessions.sessionId, row.sessionId));

            console.log(`[EvoWA AutoRestore] ${row.sessionId} -> ${instanceName} -> ${dbStatus}`);
          } else {
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

// ─── SINGLETON ───

export const whatsappManager = new WhatsAppEvolutionManager();
export default whatsappManager;
