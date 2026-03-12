import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
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
import { whatsappSessions, waMessages as messages, activityLogs, chatbotSettings, chatbotRules, waContacts } from "../drizzle/schema";
import { eq, desc, and, gte, sql, isNotNull } from "drizzle-orm";
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
  status: "connecting" | "connected" | "disconnected" | "reconnecting";
  user: any;
  sessionId: string;
  userId: number;
  tenantId: number;
  /** Timestamp of last successful connection */
  lastConnectedAt: number | null;
  /** Timestamp of last health check ping */
  lastHealthCheck: number | null;
  /** Number of messages processed since last connect */
  messagesProcessed: number;
  /** Number of DB write errors since last connect */
  dbWriteErrors: number;
}

// ─── STABILITY CONSTANTS ───
// These values are tuned for long-running WhatsApp connections (days/weeks)
const KEEPALIVE_INTERVAL_MS = 30_000;       // 30s — WhatsApp default, less aggressive than 25s
const CONNECT_TIMEOUT_MS = 45_000;          // 45s — generous timeout for slow networks
const DEFAULT_QUERY_TIMEOUT_MS = 0;         // DISABLED — prevents silent connection kills
const RETRY_REQUEST_DELAY_MS = 500;         // 500ms between request retries
const HEALTH_CHECK_INTERVAL_MS = 5 * 60_000; // 5 minutes — periodic health check
const BASE_RECONNECT_DELAY_MS = 3_000;      // 3s initial backoff
const MAX_RECONNECT_DELAY_MS = 5 * 60_000;  // 5 minutes max backoff (was 2min)
const IMMEDIATE_RECONNECT_CODES = new Set([428, 408, 503]); // connectionClosed, timedOut, unavailable (515 restartRequired handled separately)
const FATAL_CODES = new Set([401, 403]); // loggedOut, banned — stop reconnecting
const AUTO_RESTORE_DELAY_MS = 10_000;       // 10s delay before auto-restoring sessions on startup

// ─── DB WRITE QUEUE: Fire-and-forget for non-critical DB operations ───
type DbWriteTask = () => Promise<void>;
class DbWriteQueue {
  private queue: DbWriteTask[] = [];
  private processing = false;
  private errorCount = 0;
  private readonly MAX_QUEUE_SIZE = 500;
  private readonly BATCH_DELAY_MS = 50;

  enqueue(task: DbWriteTask): void {
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      // Drop oldest task to prevent memory leak
      this.queue.shift();
      this.errorCount++;
    }
    this.queue.push(task);
    if (!this.processing) this.process();
  }

  private async process(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        await task();
      } catch (e) {
        this.errorCount++;
        console.error("[DbWriteQueue] Task failed:", (e as Error).message);
      }
      // Small delay between writes to avoid overwhelming DB
      if (this.queue.length > 0) {
        await new Promise(r => setTimeout(r, this.BATCH_DELAY_MS));
      }
    }
    this.processing = false;
  }

  getStats(): { pending: number; errors: number } {
    return { pending: this.queue.length, errors: this.errorCount };
  }

  /** Wait for all queued tasks to complete */
  async drain(): Promise<void> {
    // If nothing is processing and queue is empty, return immediately
    if (!this.processing && this.queue.length === 0) return;
    // Poll until queue is drained
    return new Promise((resolve) => {
      const check = () => {
        if (!this.processing && this.queue.length === 0) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
}

class WhatsAppManager extends EventEmitter {
  private sessions: Map<string, WhatsAppState> = new Map();
  private authDir = path.join(process.cwd(), "auth_sessions");
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private connectLocks: Set<string> = new Set(); // Mutex for connect()
  private dbQueue = new DbWriteQueue();
  private isShuttingDown = false;

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

  // ─── AUTO-RESTORE: Reconnect all previously connected sessions on server startup ───
  async autoRestoreSessions(): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.log("[WA AutoRestore] Database not available, skipping auto-restore");
        return;
      }

      // Find all sessions that were "connected" before server restart (exclude deleted)
      const connectedSessions = await db.select().from(whatsappSessions)
        .where(and(eq(whatsappSessions.status, "connected"), sql`${whatsappSessions.status} != 'deleted'`));

      if (connectedSessions.length === 0) {
        console.log("[WA AutoRestore] No sessions to restore");
        return;
      }

      console.log(`[WA AutoRestore] Found ${connectedSessions.length} session(s) to restore`);

      for (const session of connectedSessions) {
        // Check if auth files exist for this session
        const sessionDir = path.join(this.authDir, session.sessionId);
        if (!fs.existsSync(sessionDir)) {
          console.log(`[WA AutoRestore] No auth files for ${session.sessionId}, skipping (DB status preserved for production)`);
          // Do NOT mark as disconnected here — in production the auth files exist.
          // The getActiveSessionForTenant will handle reconnection when needed.
          continue;
        }

        console.log(`[WA AutoRestore] Restoring session ${session.sessionId} (user: ${session.userId}, tenant: ${session.tenantId})`);
        try {
          await this.connect(session.sessionId, session.userId, session.tenantId);
        } catch (e) {
          console.error(`[WA AutoRestore] Failed to restore ${session.sessionId}:`, e);
        }

        // Stagger reconnections to avoid overwhelming the server
        await new Promise(r => setTimeout(r, 3000));
      }

      console.log("[WA AutoRestore] Restore complete");
    } catch (e) {
      console.error("[WA AutoRestore] Error during auto-restore:", e);
    }
  }

  // ─── HEALTH CHECK: Periodically verify connection is alive ───
  private startHealthCheck(sessionId: string): void {
    this.stopHealthCheck(sessionId);

    const timer = setInterval(async () => {
      const session = this.sessions.get(sessionId);
      if (!session || session.status !== "connected" || !session.socket) {
        this.stopHealthCheck(sessionId);
        return;
      }

      try {
        // Send a lightweight query to verify the connection is alive
        // If this throws or times out, the connection is dead
        const ws = (session.socket as any)?.ws;
        if (ws && ws.readyState !== 1) { // WebSocket.OPEN = 1
          console.log(`[WA Health] Session ${sessionId}: WebSocket not open (state: ${ws.readyState}), triggering reconnect`);
          session.status = "disconnected";
          this.emit("status", { sessionId, status: "disconnected", reason: "health_check_ws_closed" });
          await this.logActivity(sessionId, "health_check_fail", `WebSocket closed (state: ${ws.readyState})`);
          this.scheduleReconnect(sessionId, session.userId, 0); // immediate reconnect
          return;
        }

        session.lastHealthCheck = Date.now();
        // Log health check success every 30 minutes (every 6th check)
        const checkCount = Math.floor((Date.now() - (session.lastConnectedAt || Date.now())) / HEALTH_CHECK_INTERVAL_MS);
        if (checkCount % 6 === 0) {
          const uptimeMinutes = session.lastConnectedAt ? Math.floor((Date.now() - session.lastConnectedAt) / 60000) : 0;
          console.log(`[WA Health] Session ${sessionId}: OK (uptime: ${uptimeMinutes}min)`);
        }
      } catch (e) {
        console.error(`[WA Health] Session ${sessionId}: Health check failed:`, e);
        await this.logActivity(sessionId, "health_check_error", `Health check error: ${(e as Error).message}`);
      }
    }, HEALTH_CHECK_INTERVAL_MS);

    this.healthCheckTimers.set(sessionId, timer);
  }

  private stopHealthCheck(sessionId: string): void {
    const timer = this.healthCheckTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(sessionId);
    }
  }

  // ─── RECONNECT SCHEDULER: Infinite reconnect with intelligent backoff ───
  private scheduleReconnect(sessionId: string, userId: number, overrideDelay?: number): void {
    // Clear any existing timer
    const existingTimer = this.reconnectTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.reconnectTimers.delete(sessionId);
    }

    if (this.isShuttingDown) return;

    const attempts = this.reconnectAttempts.get(sessionId) || 0;

    let delay: number;
    if (overrideDelay !== undefined) {
      delay = overrideDelay;
    } else {
      // Exponential backoff: 3s, 4.5s, 6.75s, ... up to 5min max
      // After 20 attempts, stays at 5min forever (never gives up)
      const baseDelay = BASE_RECONNECT_DELAY_MS * Math.pow(1.5, Math.min(attempts, 20));
      const jitter = Math.random() * 3000; // 0-3s jitter
      delay = Math.min(baseDelay + jitter, MAX_RECONNECT_DELAY_MS);
    }

    console.log(`[WA Reconnect] Session ${sessionId}: scheduling reconnect in ${Math.round(delay / 1000)}s (attempt ${attempts + 1})`);

    this.reconnectAttempts.set(sessionId, attempts + 1);
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(sessionId);
      this.connect(sessionId, userId).catch(e => {
        console.error(`[WA Reconnect] Session ${sessionId}: reconnect failed:`, e);
        // Schedule another attempt
        this.scheduleReconnect(sessionId, userId);
      });
    }, delay);
    this.reconnectTimers.set(sessionId, timer);
  }

  async connect(sessionId: string, userId: number, tenantId?: number): Promise<WhatsAppState> {
    const existing = this.sessions.get(sessionId);
    if (existing?.status === "connected") {
      return existing;
    }

    // If already connecting or reconnecting, don't create a duplicate
    if ((existing?.status === "connecting" || existing?.status === "reconnecting") && existing.socket) {
      return existing;
    }

    // ─── CONNECTION MUTEX: Prevent duplicate socket creation ───
    if (this.connectLocks.has(sessionId)) {
      console.log(`[WA] Session ${sessionId}: connect() already in progress, skipping duplicate call`);
      if (existing) return existing;
      // Wait briefly for the lock to release
      await new Promise(r => setTimeout(r, 2000));
      const afterWait = this.sessions.get(sessionId);
      if (afterWait) return afterWait;
      throw new Error(`Session ${sessionId} is being created by another call`);
    }
    this.connectLocks.add(sessionId);
    try {
      return await this._doConnect(sessionId, userId, tenantId);
    } finally {
      this.connectLocks.delete(sessionId);
    }
  }

  private async _doConnect(sessionId: string, userId: number, tenantId?: number): Promise<WhatsAppState> {

    // Resolve tenantId: use provided value, or look up from DB
    let resolvedTenantId = tenantId ?? 0;
    if (!tenantId) {
      try {
        const db = await getDb();
        if (db) {
          const existingSession = await db.select().from(whatsappSessions).where(eq(whatsappSessions.sessionId, sessionId)).limit(1);
          if (existingSession.length && existingSession[0].tenantId) {
            resolvedTenantId = existingSession[0].tenantId;
          }
        }
      } catch (e) { /* ignore */ }
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
      userId,
      tenantId: resolvedTenantId,
      lastConnectedAt: null,
      lastHealthCheck: null,
      messagesProcessed: 0,
      dbWriteErrors: 0,
    };
    this.sessions.set(sessionId, sessionState);

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      // ─── STABILITY-OPTIMIZED CONFIG ───
      browser: Browsers.macOS("Desktop"),       // Simulate desktop app (less bot detection)
      generateHighQualityLinkPreview: false,     // Reduce API calls
      keepAliveIntervalMs: KEEPALIVE_INTERVAL_MS,
      connectTimeoutMs: CONNECT_TIMEOUT_MS,
      defaultQueryTimeoutMs: DEFAULT_QUERY_TIMEOUT_MS,  // DISABLED — critical for stability
      retryRequestDelayMs: RETRY_REQUEST_DELAY_MS,
      markOnlineOnConnect: false,                // Don't mark online (reduces detection)
      syncFullHistory: false,                    // Don't sync full history (reduces load)
      emitOwnEvents: true,
    });

    sessionState.socket = sock;

    // Track QR generation count to detect scan failures
    let qrGenerationCount = 0;
    const MAX_QR_GENERATIONS = 5; // After 5 QR codes without scan, something is wrong

    // ─── CONNECTION EVENT HANDLER ───
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications } = update;

      // Handle partial updates — log but don't block the flow
      // IMPORTANT: Do NOT return early here. Partial updates are informational
      // and the connection/qr fields may still be set in the same event.
      if (receivedPendingNotifications) {
        console.log(`[WA] Session ${sessionId}: received pending notifications`);
      }
      if (isNewLogin) {
        console.log(`[WA] Session ${sessionId}: new login detected`);
      }

      if (qr) {
        qrGenerationCount++;
        console.log(`[WA] Session ${sessionId}: QR code generated (#${qrGenerationCount})`);
        sessionState.qrCode = qr;
        sessionState.status = "connecting";
        try {
          sessionState.qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        } catch (e) {
          console.error("QR generation error:", e);
        }
        this.emit("qr", { sessionId, qr, qrDataUrl: sessionState.qrDataUrl });
        await this.logActivity(sessionId, "qr_generated", `QR Code #${qrGenerationCount} gerado`);
        await this.updateSessionDb(sessionId, userId, "connecting");

        // If too many QR codes generated without connection, warn user
        if (qrGenerationCount >= MAX_QR_GENERATIONS) {
          console.warn(`[WA] Session ${sessionId}: ${qrGenerationCount} QR codes generated without scan. Consider restarting.`);
          try {
            await createNotification(resolvedTenantId, {
              type: "whatsapp_warning",
              title: "QR Code não escaneado",
              body: `Sessão "${sessionId}" gerou ${qrGenerationCount} QR Codes sem conexão. Tente deletar e recriar a sessão.`,
              entityType: "session",
              entityId: sessionId,
            });
          } catch (e) { /* ignore */ }
        }
      }

      if (connection === "close") {
        this.stopHealthCheck(sessionId);

        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const errorMessage = (lastDisconnect?.error as Boom)?.message || "unknown";

        console.log(`[WA] Session ${sessionId}: connection closed (code: ${statusCode}, msg: ${errorMessage})`);

        // ─── CRITICAL: restartRequired (515) after QR scan ───
        // Per Baileys docs: "After scanning the code, WhatsApp will forcibly disconnect you,
        // forcing a reconnect such that we can present the authentication credentials."
        // The old socket is USELESS — we must create a brand new one IMMEDIATELY.
        if (statusCode === DisconnectReason.restartRequired) {
          console.log(`[WA] Session ${sessionId}: restartRequired (515) — creating new socket IMMEDIATELY (post-QR-scan handshake)`);
          sessionState.status = "connecting";
          sessionState.qrCode = null;
          sessionState.qrDataUrl = null;
          // Kill the old socket reference
          sessionState.socket = null;
          this.emit("status", { sessionId, status: "connecting", statusCode });
          // Reset reconnect counter — this is not a failure, it's the normal post-scan flow
          this.reconnectAttempts.delete(sessionId);
          // Create new socket immediately (no delay, no backoff)
          // We must NOT go through connect() because it has a mutex that would block us.
          // Instead, call _doConnect directly after clearing the lock.
          this.connectLocks.delete(sessionId);
          this._doConnect(sessionId, userId, resolvedTenantId).catch(e => {
            console.error(`[WA] Session ${sessionId}: restartRequired reconnect failed:`, e);
            sessionState.status = "disconnected";
            this.emit("status", { sessionId, status: "disconnected" });
          });
          return;
        }

        sessionState.status = "disconnected";
        sessionState.qrCode = null;
        sessionState.qrDataUrl = null;

        this.emit("status", { sessionId, status: "disconnected", statusCode });
        await this.logActivity(sessionId, "disconnected", `Desconectado. Código: ${statusCode}. Erro: ${errorMessage}`);
        await this.updateSessionDb(sessionId, userId, "disconnected");

        // ─── DECISION: Should we reconnect? ───
        if (FATAL_CODES.has(statusCode!)) {
          // FATAL: Logged out or banned — clean up completely
          console.log(`[WA] Session ${sessionId}: FATAL disconnect (code: ${statusCode}). Cleaning up.`);
          this.reconnectAttempts.delete(sessionId);
          this.sessions.delete(sessionId);
          // Clean auth files
          if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
          }
           // Notify user
           try {
             await createNotification(resolvedTenantId, {
               type: "whatsapp_disconnected",
               title: "WhatsApp Desconectado Permanentemente",
               body: `Sessão "${sessionId}" foi ${statusCode === 401 ? "deslogada" : "banida"}. Reconecte manualmente com novo QR Code.`,
               entityType: "session",
               entityId: sessionId,
            });
          } catch (e) { console.error("Error creating fatal notification:", e); }
          return;
        }

        if (statusCode === DisconnectReason.badSession) {
          // BAD SESSION: Auth corrupted — clean auth and allow fresh connection
          console.log(`[WA] Session ${sessionId}: bad session detected. Cleaning auth for fresh start.`);
          this.reconnectAttempts.delete(sessionId);
          this.sessions.delete(sessionId);
          if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
          }
           try {
             await createNotification(resolvedTenantId, {
               type: "whatsapp_disconnected",
               title: "WhatsApp — Sessão Corrompida",
               body: `Sessão "${sessionId}" teve dados corrompidos. Reconecte com novo QR Code.`,
               entityType: "session",
               entityId: sessionId,
            });
          } catch (e) { console.error("Error creating bad session notification:", e); }
          return;
        }

        // ─── RECONNECTABLE: Schedule reconnect (NEVER give up) ───
        sessionState.status = "reconnecting";
        this.emit("status", { sessionId, status: "reconnecting", statusCode });
        const isImmediate = IMMEDIATE_RECONNECT_CODES.has(statusCode!);
        const attempts = this.reconnectAttempts.get(sessionId) || 0;

        // Notify on first disconnect and every 10 attempts
        if (attempts === 0 || attempts % 10 === 0) {
           try {
             await createNotification(resolvedTenantId, {
               type: "whatsapp_disconnected",
               title: "WhatsApp Reconectando",
               body: `Sessão "${sessionId}" desconectada (código: ${statusCode}). Reconectando automaticamente (tentativa ${attempts + 1})...`,
               entityType: "session",
               entityId: sessionId,
            });
          } catch (e) { console.error("Error creating reconnect notification:", e); }
        }

        // For immediate codes (428, 408, etc), reconnect faster
        this.scheduleReconnect(sessionId, userId, isImmediate ? 2000 : undefined);

      } else if (connection === "open") {
        sessionState.status = "connected";
        sessionState.qrCode = null;
        sessionState.qrDataUrl = null;
        sessionState.user = sock.user;
        sessionState.lastConnectedAt = Date.now();
        sessionState.lastHealthCheck = Date.now();

        // Reset reconnect counter on successful connection
        this.reconnectAttempts.delete(sessionId);

        // Start periodic health check
        this.startHealthCheck(sessionId);

        this.emit("status", { sessionId, status: "connected", user: sock.user });
        await this.logActivity(sessionId, "connected", `Conectado como ${sock.user?.name || sock.user?.id}`);
        await this.updateSessionDb(sessionId, userId, "connected", sock.user);

        // notifyOwner desativado — notificações apenas in-app
        try {
          await createNotification(resolvedTenantId, {
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

    sock.ev.on("messages.upsert", async ({ messages: msgs, type }: { messages: any[]; type: string }) => {
      for (const msg of msgs) {
        if (!msg.message) continue;

        const rawRemoteJid = msg.key.remoteJid || "";
        // Skip group messages — CRM only handles individual contacts
        if (rawRemoteJid.endsWith("@g.us")) continue;
        // IMPORTANT: Use the raw JID from WhatsApp as-is for storage and replies.
        // Do NOT normalize here — normalizing changes the JID (e.g. 12→13 digits)
        // which causes replies to go to a "ghost" number that doesn't exist on WhatsApp.
        // The Conversation Identity Resolver handles deduplication via phoneE164/conversationKey.
        const remoteJid = rawRemoteJid;
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
        } else if (msg.message.videoMessage) {
          content = msg.message.videoMessage.caption || "";
          mediaMimeType = msg.message.videoMessage.mimetype || "video/mp4";
          mediaDuration = msg.message.videoMessage.seconds || undefined;
        } else if (msg.message.documentMessage) {
          mediaFileName = msg.message.documentMessage.fileName || "document";
          mediaMimeType = msg.message.documentMessage.mimetype || "application/octet-stream";
          content = msg.message.documentMessage.caption || `[Documento: ${mediaFileName}]`;
        } else if (msg.message.audioMessage) {
          mediaMimeType = msg.message.audioMessage.mimetype || "audio/ogg";
          mediaDuration = msg.message.audioMessage.seconds || undefined;
          isVoiceNote = msg.message.audioMessage.ptt || false;
          content = isVoiceNote ? "[Áudio]" : "[Áudio]";
        } else if (msg.message.stickerMessage) {
          content = "[Sticker]";
          mediaMimeType = "image/webp";
        }

        // ─── ASYNC MEDIA DOWNLOAD: Don't block message processing ───
        // Media is downloaded in the background and the DB row is updated later.
        const hasMedia = !!(msg.message.imageMessage || msg.message.videoMessage || msg.message.documentMessage || msg.message.audioMessage || msg.message.stickerMessage);
        const capturedMsgId = msg.key.id;
        const capturedMimeType = mediaMimeType;
        const capturedFileName = mediaFileName;
        if (hasMedia && capturedMsgId) {
          // Fire-and-forget: download media in background via dbQueue
          this.dbQueue.enqueue(async () => {
            try {
              const buffer = await downloadMediaMessage(msg, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
              let ext = "bin";
              if (msg.message.stickerMessage) ext = "webp";
              else if (capturedMimeType) ext = capturedMimeType.split("/")[1]?.split(";")[0] || "bin";
              const key = capturedFileName
                ? `whatsapp-media/${nanoid()}-${capturedFileName}`
                : `whatsapp-media/${nanoid()}.${ext}`;
              const contentType = msg.message.stickerMessage ? "image/webp" : (capturedMimeType || "application/octet-stream");
              const { url: uploadedUrl } = await storagePut(key, buffer as Buffer, contentType);
              // Update the already-saved message row with the media URL
              const db = await getDb();
              if (db) {
                await db.update(messages)
                  .set({ mediaUrl: uploadedUrl })
                  .where(and(eq(messages.messageId, capturedMsgId), eq(messages.sessionId, sessionId)));
              }
            } catch (e) {
              console.error(`[WA] Async media download failed for ${capturedMsgId}:`, (e as Error).message);
            }
          });
        }

        // Determine initial status for sent messages
        const initialStatus = fromMe ? "sent" : "received";

        // ─── Conversation Identity Resolver ───
        let waConversationId: number | undefined;
        try {
          const resolved = await resolveInbound(resolvedTenantId, sessionId, remoteJid, msg.pushName || null);
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

        // Increment messages processed counter
        sessionState.messagesProcessed++;

        this.emit("message", { sessionId, message: msg, content, fromMe, remoteJid, messageType, mediaUrl, mediaMimeType, mediaFileName, mediaDuration, isVoiceNote, status: initialStatus });

        // Chatbot auto-reply
        if (!fromMe && content && type === "notify") {
          await this.handleChatbot(sessionId, remoteJid, content, sock);
        }

        // Notificação apenas in-app (notifyOwner/email desativado)
        if (!fromMe && content) {
          const senderName = msg.pushName || remoteJid.replace("@s.whatsapp.net", "");
          const msgTenantId = this.sessions.get(sessionId)?.tenantId ?? resolvedTenantId ?? 0;
          try {
            await createNotification(msgTenantId, {
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

    // ─── Message Receipt Updates (delivered / read) — queued for stability ───
    sock.ev.on("message-receipt.update", async (updates: any[]) => {
      for (const update of updates) {
        const msgId = update.key.id;
        const receiptType = update.receipt?.receiptTimestamp ? "delivered" : "sent";
        let newStatus = receiptType;

        if (update.receipt?.readTimestamp) {
          newStatus = "read";
        } else if ((update as any).receipt?.receiptTimestamp) {
          newStatus = "delivered";
        }

        // Queue DB write — status updates are non-critical
        this.dbQueue.enqueue(async () => {
          const db = await getDb();
          if (db && msgId) {
            await db.update(messages)
              .set({ status: newStatus })
              .where(eq(messages.messageId, msgId));
          }
        });

        this.emit("message:status", { sessionId, messageId: msgId, status: newStatus });
      }
    });

    // ─── Message Update (status changes from Baileys) — queued for stability ───
    sock.ev.on("messages.update", async (updates: any[]) => {
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
          // Queue DB write — status updates are non-critical
          this.dbQueue.enqueue(async () => {
            const db = await getDb();
            if (db) {
              await db.update(messages)
                .set({ status: newStatus })
                .where(eq(messages.messageId, msgId));
            }
          });

          this.emit("message:status", { sessionId, messageId: msgId, status: newStatus });
        }
      }
    });

    // ─── Contacts sync (LID ↔ Phone mapping) — queued for stability ───
    sock.ev.on("contacts.upsert" as any, async (contacts: any[]) => {
      this.dbQueue.enqueue(async () => {
        const db = await getDb();
        if (!db) return;
        for (const contact of contacts) {
          if (!contact.id) continue;
          // Skip group JIDs
          if (contact.id.includes("@g.us")) continue;
          
          const jid = contact.id;
          const lid = contact.lid || null;
          const phoneNumber = contact.phoneNumber || null;
          const pushName = contact.notify || null;
          const savedName = contact.name || null;
          const verifiedName = contact.verifiedName || null;

          // Upsert: check if exists by sessionId+jid
          const existing = await db.select({ id: waContacts.id }).from(waContacts)
            .where(and(eq(waContacts.sessionId, sessionId), eq(waContacts.jid, jid)))
            .limit(1);
          
          if (existing.length > 0) {
            await db.update(waContacts).set({
              lid: lid || undefined,
              phoneNumber: phoneNumber || undefined,
              pushName: pushName || undefined,
              savedName: savedName || undefined,
              verifiedName: verifiedName || undefined,
            }).where(eq(waContacts.id, existing[0].id));
          } else {
            await db.insert(waContacts).values({
              sessionId,
              jid,
              lid,
              phoneNumber,
              pushName,
              savedName,
              verifiedName,
            });
          }

          // Also insert reverse mapping if LID is present
          if (lid && lid !== jid) {
            const existingLid = await db.select({ id: waContacts.id }).from(waContacts)
              .where(and(eq(waContacts.sessionId, sessionId), eq(waContacts.jid, lid)))
              .limit(1);
            if (existingLid.length > 0) {
              await db.update(waContacts).set({
                phoneNumber: phoneNumber || jid.includes("@s.whatsapp.net") ? jid : undefined,
                pushName: pushName || undefined,
                savedName: savedName || undefined,
                verifiedName: verifiedName || undefined,
              }).where(eq(waContacts.id, existingLid[0].id));
            } else {
              await db.insert(waContacts).values({
                sessionId,
                jid: lid,
                lid: lid,
                phoneNumber: phoneNumber || (jid.includes("@s.whatsapp.net") ? jid : null),
                pushName,
                savedName,
                verifiedName,
              });
            }
          }
        }
      });
    });

    // Also handle contacts.update for incremental updates — queued for stability
    sock.ev.on("contacts.update" as any, async (contacts: any[]) => {
      this.dbQueue.enqueue(async () => {
        const db = await getDb();
        if (!db) return;
        for (const contact of contacts) {
          if (!contact.id) continue;
          if (contact.id.includes("@g.us")) continue;
          const existing = await db.select({ id: waContacts.id }).from(waContacts)
            .where(and(eq(waContacts.sessionId, sessionId), eq(waContacts.jid, contact.id)))
            .limit(1);
          if (existing.length > 0) {
            const updates: any = {};
            if (contact.notify) updates.pushName = contact.notify;
            if (contact.name) updates.savedName = contact.name;
            if (contact.verifiedName) updates.verifiedName = contact.verifiedName;
            if (contact.lid) updates.lid = contact.lid;
            if (contact.phoneNumber) updates.phoneNumber = contact.phoneNumber;
            if (Object.keys(updates).length > 0) {
              await db.update(waContacts).set(updates).where(eq(waContacts.id, existing[0].id));
            }
          } else {
            await db.insert(waContacts).values({
              sessionId,
              jid: contact.id,
              lid: contact.lid || null,
              phoneNumber: contact.phoneNumber || null,
              pushName: contact.notify || null,
              savedName: contact.name || null,
              verifiedName: contact.verifiedName || null,
            });
          }
        }
      });
    });

    return sessionState;
  }

  async disconnect(sessionId: string): Promise<void> {
    console.log(`[WA] Disconnecting session ${sessionId}`);
    const session = this.sessions.get(sessionId);
    this.stopHealthCheck(sessionId);

    // Clear reconnect timers FIRST to prevent auto-reconnect
    const timer = this.reconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(sessionId);
    }
    this.reconnectAttempts.delete(sessionId);

    if (session?.socket) {
      // IMPORTANT: Do NOT call socket.logout() here!
      // logout() invalidates the session on WhatsApp's servers,
      // which means the user would need to scan QR again.
      // We only want to close the local connection, preserving auth files
      // so the user can reconnect later without scanning QR again.
      try {
        session.socket.end(undefined);
      } catch (e) {
        console.error(`[WA] Error during end() for ${sessionId}:`, e);
      }
      session.socket = null;
    }

    if (session) {
      session.status = "disconnected";
      session.qrCode = null;
      session.qrDataUrl = null;
    }
    // Keep session in memory map with disconnected status (don't delete)
    // so the UI can still show it and the user can reconnect
    this.emit("status", { sessionId, status: "disconnected", reason: "manual" });
    await this.logActivity(sessionId, "manual_disconnect", "Sessão desconectada manualmente");
    await this.updateSessionDb(sessionId, session?.userId || 0, "disconnected");
    console.log(`[WA] Session ${sessionId} disconnected successfully`);
  }

  /**
   * Delete a WhatsApp session completely:
   * 1. Disconnect socket if active
   * 2. Clean auth files from disk
   * 3. Soft-delete: mark as 'deleted' in DB / Hard-delete: remove from DB
   */
  async deleteSession(sessionId: string, hardDelete: boolean = false): Promise<void> {
    console.log(`[WA] Deleting session ${sessionId} (hardDelete: ${hardDelete})`);

    // 1. Stop health check and reconnect timers
    this.stopHealthCheck(sessionId);
    const timer = this.reconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(sessionId);
    }
    this.reconnectAttempts.delete(sessionId);

    // 2. Close socket if active — use logout() here since we're deleting
    const session = this.sessions.get(sessionId);
    if (session?.socket) {
      try {
        // logout() invalidates the session on WhatsApp's servers
        // This is intentional for delete — we want a clean break
        await session.socket.logout();
      } catch (e) {
        // Ignore logout errors — session may already be disconnected
        console.log(`[WA] Logout during delete for ${sessionId}: ${(e as Error).message}`);
      }
      try {
        session.socket.end(undefined);
      } catch (e) { /* ignore */ }
      session.socket = null;
    }
    // Remove from in-memory map
    this.sessions.delete(sessionId);

    // 3. Clean auth files from disk
    const sessionDir = path.join(this.authDir, sessionId);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log(`[WA] Auth files deleted for ${sessionId}`);
      }
    } catch (e) {
      console.error(`[WA] Error deleting auth files for ${sessionId}:`, e);
    }

    // 4. Update DB — this is the critical step
    try {
      const db = await getDb();
      if (db) {
        if (hardDelete) {
          // Hard delete: remove from DB entirely
          await db.delete(whatsappSessions).where(eq(whatsappSessions.sessionId, sessionId));
          console.log(`[WA] Session ${sessionId} hard-deleted from DB`);
        } else {
          // Soft delete: mark as 'deleted' in the enum
          await db.update(whatsappSessions)
            .set({ status: "deleted" })
            .where(eq(whatsappSessions.sessionId, sessionId));
          console.log(`[WA] Session ${sessionId} soft-deleted in DB`);
        }
      } else {
        console.error(`[WA] Cannot delete session ${sessionId}: database not available`);
      }
    } catch (e) {
      console.error(`[WA] Error updating DB during delete for ${sessionId}:`, e);
      // If DB update fails, throw so the frontend knows
      throw new Error(`Erro ao excluir sessão do banco de dados: ${(e as Error).message}`);
    }

    this.emit("status", { sessionId, status: "deleted", reason: hardDelete ? "hard_delete" : "soft_delete" });
    await this.logActivity(sessionId, hardDelete ? "hard_delete" : "soft_delete", `Sessão ${hardDelete ? "excluída permanentemente" : "movida para lixeira"}`);
    console.log(`[WA] Session ${sessionId} deleted successfully`);
  }

  /**
   * Normalize a phone number to a valid WhatsApp JID.
   * Handles Brazilian numbers: adds country code 55 if missing,
   * and uses onWhatsApp() to verify the actual registered JID.
   */
  private async resolveJid(sessionId: string, input: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session?.socket) throw new Error("Sessão não conectada");

    // Extract digits from input (strip @s.whatsapp.net suffix, +, spaces, etc.)
    let digits: string;
    if (input.includes("@")) {
      // Already a JID — extract the number part
      digits = input.replace(/@.*$/, "").replace(/\D/g, "");
    } else {
      digits = input.replace(/\D/g, "");
    }

    // Add Brazil country code if not present
    if (!digits.startsWith("55") && digits.length <= 11) {
      digits = `55${digits}`;
    }

    // ALWAYS verify with onWhatsApp() to get the REAL registered JID
    // This is critical: WhatsApp may register the number with or without the 9th digit,
    // and we must send to the exact JID that WhatsApp recognizes.
    try {
      const results = await session.socket.onWhatsApp(digits);
      if (results && results.length > 0 && results[0].exists) {
        // Use the JID returned by WhatsApp AS-IS (only add suffix if needed)
        // Do NOT normalize — WhatsApp knows the correct format for this contact
        const realJid = results[0].jid;
        console.log(`[JID Resolve] ${input} -> ${realJid} (verified by onWhatsApp)`);
        return realJid;
      }
    } catch (e) {
      console.warn("[JID Resolve] onWhatsApp failed, trying variants:", e);
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
            const realJid = results[0].jid;
            console.log(`[JID Resolve] ${input} -> ${realJid} (verified without 9th digit by onWhatsApp)`);
            return realJid;
          }
        } catch (e) { /* ignore */ }
      }

      // If number has 8 digits after DDD (without 9th digit), try with it
      if (rest.length === 8) {
        const with9 = `55${ddd}9${rest}`;
        try {
          const results = await session.socket.onWhatsApp(with9);
          if (results && results.length > 0 && results[0].exists) {
            const realJid = results[0].jid;
            console.log(`[JID Resolve] ${input} -> ${realJid} (verified with 9th digit by onWhatsApp)`);
            return realJid;
          }
        } catch (e) { /* ignore */ }
      }
    }

    // Final fallback: if onWhatsApp() failed for all variants,
    // use the original JID if it was a full JID, otherwise construct one
    if (input.includes("@")) {
      // Return the original JID as-is — do NOT normalize
      // This preserves the JID format that WhatsApp originally sent us
      console.log(`[JID Resolve] ${input} -> ${input} (original JID preserved as fallback)`);
      return input;
    }
    const fallbackJid = `${digits}@s.whatsapp.net`;
    console.log(`[JID Resolve] ${input} -> ${fallbackJid} (fallback, no verification)`);
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
      const sState = this.sessions.get(sessionId);
      const resolved = await resolveOutbound(sState?.tenantId ?? 0, sessionId, formattedJid);
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
      const sState = this.sessions.get(sessionId);
      const resolved = await resolveOutbound(sState?.tenantId ?? 0, sessionId, formattedJid);
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
        const chatbotResult = await sock.sendMessage(remoteJid, { text: replyText });

        // Resolve outbound conversation for chatbot reply
        let chatbotConvId: number | undefined;
        try {
          const sState = this.sessions.get(sessionId);
          const resolved = await resolveOutbound(sState?.tenantId ?? 0, sessionId, remoteJid);
          chatbotConvId = resolved.conversationId;
        } catch (e) {
          console.error("[ConvResolver] Error resolving chatbot outbound:", e);
        }

        await db.insert(messages).values({
          sessionId,
          messageId: chatbotResult?.key?.id || undefined,
          remoteJid,
          fromMe: true,
          messageType: "text",
          content: replyText,
          waConversationId: chatbotConvId || undefined,
          status: "sent",
        });

        // Update conversation last message
        if (chatbotConvId) {
          try {
            await updateConversationLastMessage(chatbotConvId, {
              content: replyText,
              messageType: "text",
              fromMe: true,
              status: "sent",
              timestamp: new Date(),
            });
          } catch (e) {
            console.error("[ConvResolver] Error updating chatbot last message:", e);
          }
        }

        this.dbQueue.enqueue(async () => {
          await this.logActivity(sessionId, "chatbot_reply", `Chatbot respondeu para ${remoteJid}`);
        });
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

      // Get tenantId from the in-memory session state
      const sessionState = this.sessions.get(sessionId);
      const tenantId = sessionState?.tenantId ?? 0;

      const existing = await db.select().from(whatsappSessions).where(eq(whatsappSessions.sessionId, sessionId)).limit(1);

      if (existing.length) {
        await db
          .update(whatsappSessions)
          .set({
            status: status as any,
            tenantId,
            phoneNumber: user?.id?.split(":")[0] || existing[0].phoneNumber,
            pushName: user?.name || existing[0].pushName,
          })
          .where(eq(whatsappSessions.sessionId, sessionId));
      } else {
        await db.insert(whatsappSessions).values({
          sessionId,
          userId,
          tenantId,
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

  /** Force sync contacts: fetch all unique JIDs from messages and resolve them via onWhatsApp + store */
  async syncContacts(sessionId: string): Promise<{ synced: number; total: number; resolved: number }> {
    const session = this.sessions.get(sessionId);
    if (!session?.socket || session.status !== "connected") {
      throw new Error("WhatsApp não está conectado");
    }
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // waContacts already imported at top level

    // Get all unique JIDs from messages table for this session
    const allJids = await db.selectDistinct({ jid: messages.remoteJid })
      .from(messages)
      .where(and(
        eq(messages.sessionId, sessionId),
        isNotNull(messages.remoteJid)
      ));

    const jids = allJids
      .map(r => r.jid)
      .filter((j): j is string => !!j && !j.includes("@g.us") && !j.includes("@broadcast"));

    let synced = 0;
    let resolved = 0;
    const batchSize = 20;

    // Phase 1: Sync all JIDs from messages into wa_contacts
    for (let i = 0; i < jids.length; i += batchSize) {
      const batch = jids.slice(i, i + batchSize);
      for (const jid of batch) {
        try {
          const phone = jid.split("@")[0];
          let phoneNumber: string | null = null;

          if (jid.endsWith("@s.whatsapp.net")) {
            phoneNumber = phone;
          }

          // Try to get push name from the latest message
          const latestMsg = await db.select({ pushName: messages.pushName })
            .from(messages)
            .where(and(
              eq(messages.sessionId, sessionId),
              eq(messages.remoteJid, jid),
              isNotNull(messages.pushName)
            ))
            .orderBy(desc(messages.timestamp))
            .limit(1);

          const pushName = latestMsg[0]?.pushName || null;

          // Upsert into wa_contacts
          const existing = await db.select({ id: waContacts.id, phoneNumber: waContacts.phoneNumber }).from(waContacts)
            .where(and(eq(waContacts.sessionId, sessionId), eq(waContacts.jid, jid)))
            .limit(1);

          if (existing.length > 0) {
            const updates: any = {};
            if (pushName) updates.pushName = pushName;
            if (phoneNumber && !existing[0].phoneNumber) updates.phoneNumber = phoneNumber;
            if (Object.keys(updates).length > 0) {
              await db.update(waContacts).set(updates).where(eq(waContacts.id, existing[0].id));
            }
          } else {
            await db.insert(waContacts).values({
              sessionId,
              jid,
              phoneNumber,
              pushName,
              lid: jid.endsWith("@lid") ? jid : null,
            });
          }
          synced++;
        } catch (e) {
          // Skip individual contact errors
        }
      }
      // Small delay between batches to avoid overwhelming
      await new Promise(r => setTimeout(r, 100));
    }

    // Phase 2: Cross-reference LID JIDs with phone JIDs
    // For each LID without a phoneNumber, check if there's a phone JID with the same pushName
    try {
      const unresolvedLids = await db.select().from(waContacts)
        .where(and(
          eq(waContacts.sessionId, sessionId),
          sql`${waContacts.jid} LIKE '%@lid'`,
          sql`(${waContacts.phoneNumber} IS NULL OR ${waContacts.phoneNumber} = '')`
        ));

      for (const lidContact of unresolvedLids) {
        if (!lidContact.pushName) continue;
        // Try to find a phone JID with the same pushName
        const phoneMatch = await db.select().from(waContacts)
          .where(and(
            eq(waContacts.sessionId, sessionId),
            eq(waContacts.pushName, lidContact.pushName),
            sql`${waContacts.jid} LIKE '%@s.whatsapp.net'`,
            isNotNull(waContacts.phoneNumber)
          ))
          .limit(1);

        if (phoneMatch.length > 0 && phoneMatch[0].phoneNumber) {
          // Update the LID contact with the phone number
          await db.update(waContacts).set({
            phoneNumber: phoneMatch[0].phoneNumber,
          }).where(eq(waContacts.id, lidContact.id));

          // Also update the phone contact with the LID
          await db.update(waContacts).set({
            lid: lidContact.jid,
          }).where(eq(waContacts.id, phoneMatch[0].id));

          resolved++;
        }
      }
    } catch (e) {
      console.error("[SyncContacts] Error cross-referencing LIDs:", e);
    }

    // Phase 3: Try to fetch profile pictures for contacts without one
    try {
      const contactsWithoutPic = await db.select({ id: waContacts.id, jid: waContacts.jid }).from(waContacts)
        .where(and(
          eq(waContacts.sessionId, sessionId),
          sql`(${waContacts.profilePictureUrl} IS NULL OR ${waContacts.profilePictureUrl} = '')`,
          sql`${waContacts.jid} LIKE '%@s.whatsapp.net'`
        ))
        .limit(50); // Limit to avoid too many API calls

      for (const contact of contactsWithoutPic) {
        try {
          const url = await session.socket!.profilePictureUrl(contact.jid, "image");
          if (url) {
            await db.update(waContacts).set({ profilePictureUrl: url }).where(eq(waContacts.id, contact.id));
          }
        } catch {
          // Profile picture not available (privacy settings)
        }
      }
    } catch (e) {
      console.error("[SyncContacts] Error fetching profile pictures:", e);
    }

    return { synced, total: jids.length, resolved };
  }

  /** Get connection statistics for monitoring */
  getConnectionStats(sessionId: string): { uptime: number; healthChecks: number; reconnectAttempts: number; status: string } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return {
      uptime: session.lastConnectedAt ? Date.now() - session.lastConnectedAt : 0,
      healthChecks: session.lastHealthCheck ? Math.floor((Date.now() - (session.lastConnectedAt || Date.now())) / HEALTH_CHECK_INTERVAL_MS) : 0,
      reconnectAttempts: this.reconnectAttempts.get(sessionId) || 0,
      status: session.status,
    };
  }

  /** Graceful shutdown: stop all health checks, reconnect timers, and drain DB queue */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.healthCheckTimers.forEach((timer) => clearInterval(timer));
    this.healthCheckTimers.clear();
    this.reconnectTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectTimers.clear();
    // Drain the DB write queue (wait up to 10s)
    try {
      await Promise.race([
        this.dbQueue.drain(),
        new Promise(r => setTimeout(r, 10000)),
      ]);
    } catch (e) {
      console.error("[WA] Error draining DB queue during shutdown:", e);
    }
    console.log(`[WA] Shutdown complete — all timers cleared, DB queue drained`);
  }
}

export const whatsappManager = new WhatsAppManager();
