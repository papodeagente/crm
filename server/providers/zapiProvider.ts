/**
 * Z-API Provider
 *
 * Implements the WhatsAppProvider interface for Z-API.
 * All Z-API-specific shapes are translated to the canonical types
 * defined in types.ts. The rest of the system never sees Z-API payloads.
 *
 * Z-API URL pattern: https://api.z-api.io/instances/{instanceId}/token/{token}/{endpoint}
 * Authentication: Client-Token header (optional security layer)
 *
 * Key differences from Evolution API:
 * - Phone format: plain numbers (5511999999999) vs JID (5511999999999@s.whatsapp.net)
 * - Send response: { zaapId, messageId } vs { key: { remoteJid, fromMe, id }, messageTimestamp, status }
 * - Message format: { text: { message } } vs { message: { conversation } }
 * - Webhooks: separate URLs per event type vs single URL
 * - Instance: id+token pair vs name-based
 * - Media: direct URLs in webhook vs getBase64FromMediaMessage
 */

import type {
  WhatsAppProvider,
  WAInstance,
  WACreateResult,
  WAQrCode,
  WASendResult,
  WAChat,
  WAContact,
  WAMessage,
  WAMediaResult,
  WAHealthResult,
  WAWebhookConfig,
  WANumberCheck,
  WAWebhookEvent,
  WAWebhookEventType,
} from "./types";

// ════════════════════════════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════════════════════════════

const ZAPI_BASE_URL = "https://api.z-api.io";

/**
 * Z-API session config stored in DB per whatsapp_session.
 * The instanceId + token pair identifies a Z-API instance.
 */
export interface ZApiSessionConfig {
  instanceId: string;
  token: string;
  clientToken?: string; // Account security token (optional)
}

/**
 * Registry of Z-API sessions.
 * In production, this is populated from the DB (whatsapp_sessions table).
 * The key is the canonical instanceName used by the system (e.g. "crm-1-2").
 */
const sessionRegistry = new Map<string, ZApiSessionConfig>();

export function registerZApiSession(instanceName: string, config: ZApiSessionConfig): void {
  sessionRegistry.set(instanceName, config);
}

export function unregisterZApiSession(instanceName: string): void {
  sessionRegistry.delete(instanceName);
}

export function getZApiSession(instanceName: string): ZApiSessionConfig | undefined {
  return sessionRegistry.get(instanceName);
}

// ════════════════════════════════════════════════════════════
// HTTP CLIENT — Thin wrapper for Z-API calls
// ════════════════════════════════════════════════════════════

interface ZApiFetchOpts {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  timeout?: number;
}

async function zapiFetch(
  instanceName: string,
  endpoint: string,
  opts: ZApiFetchOpts = {}
): Promise<any> {
  const session = sessionRegistry.get(instanceName);
  if (!session) {
    throw new Error(`[Z-API] No session config found for instance "${instanceName}". Register it first.`);
  }

  const { instanceId, token, clientToken } = session;
  const url = `${ZAPI_BASE_URL}/instances/${instanceId}/token/${token}/${endpoint}`;
  const method = opts.method || "GET";
  const timeout = opts.timeout || 30000;
  const maxRetries = opts.method === "GET" ? 3 : 2; // More retries for idempotent GETs
  const retryDelays = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (clientToken) {
    headers["Client-Token"] = clientToken;
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = retryDelays[attempt - 1] || 4000;
      console.warn(`[Z-API] Retry ${attempt}/${maxRetries} for ${method} /${endpoint} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const status = response.status;
        // Retry on 429 (rate limit) and 5xx (server errors)
        if ((status === 429 || status >= 500) && attempt < maxRetries) {
          lastError = new Error(`[Z-API] ${method} /${endpoint} returned ${status}: ${text}`);
          continue; // Retry
        }
        throw new Error(`[Z-API] ${method} /${endpoint} returned ${status}: ${text}`);
      }

      // Some endpoints return 204 No Content
      if (response.status === 204) return null;

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return response.json();
      }
      return response.text();
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        lastError = new Error(`[Z-API] ${method} /${endpoint} timed out after ${timeout}ms`);
        if (attempt < maxRetries) continue; // Retry on timeout
        throw lastError;
      }
      // Network errors (ECONNREFUSED, etc.) — retry
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
        lastError = err;
        if (attempt < maxRetries) continue;
      }
      throw err;
    }
  }
  throw lastError || new Error(`[Z-API] ${method} /${endpoint} failed after ${maxRetries} retries`);
}

/**
 * Z-API Partner API call (for creating instances).
 * Uses a different base URL pattern.
 */
async function zapiPartnerFetch(
  endpoint: string,
  opts: ZApiFetchOpts & { clientToken?: string } = {}
): Promise<any> {
  const url = `${ZAPI_BASE_URL}/instances/${endpoint}`;
  const method = opts.method || "POST";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.clientToken) {
    headers["Client-Token"] = opts.clientToken;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`[Z-API Partner] ${method} /${endpoint} returned ${response.status}: ${text}`);
  }

  return response.json();
}

// ════════════════════════════════════════════════════════════
// PHONE / JID HELPERS
// ════════════════════════════════════════════════════════════

/** Convert JID to plain phone number for Z-API */
function jidToPhone(jid: string): string {
  if (!jid) return "";
  // Remove @s.whatsapp.net, @g.us, @lid, etc.
  return jid.split("@")[0];
}

/** Convert plain phone to JID for canonical format */
function phoneToJid(phone: string, isGroup: boolean = false): string {
  if (!phone) return "";
  if (phone.includes("@")) return phone; // Already a JID
  const clean = phone.replace(/\D/g, "");
  return isGroup ? `${clean}@g.us` : `${clean}@s.whatsapp.net`;
}

/** Detect if a phone/JID is a group */
function isGroupJid(phoneOrJid: string): boolean {
  return phoneOrJid.includes("@g.us") || phoneOrJid.includes("-");
}

// ════════════════════════════════════════════════════════════
// RESPONSE TRANSLATORS — Z-API shapes → Canonical types
// ════════════════════════════════════════════════════════════

/**
 * Normalize a timestamp to Unix seconds.
 * Z-API is inconsistent: some fields return seconds, others milliseconds.
 * If the value is > 1e12, it's milliseconds; otherwise it's seconds.
 * Also validates the result is within a sane range (2000-2100).
 */
export function normalizeToUnixSeconds(raw: number | string | undefined | null): number {
  if (raw == null) return Math.floor(Date.now() / 1000);
  const num = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  if (!num || isNaN(num) || num <= 0) return Math.floor(Date.now() / 1000);
  // If > 1e12, it's milliseconds → convert to seconds
  const seconds = num > 1e12 ? Math.floor(num / 1000) : Math.floor(num);
  // Sanity check: must be between year 2000 and 2100
  const year = new Date(seconds * 1000).getFullYear();
  if (year < 2000 || year > 2100) return Math.floor(Date.now() / 1000);
  return seconds;
}

function zapiSendResultToCanonical(zapiResult: any, phone: string): WASendResult {
  return {
    key: {
      remoteJid: phoneToJid(phone),
      fromMe: true,
      id: zapiResult.messageId || zapiResult.zaapId || "",
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    status: "PENDING",
  };
}

function zapiChatToCanonical(chat: any): WAChat {
  const phone = chat.phone || "";
  const isGroup = chat.isGroup === true;
  const remoteJid = phoneToJid(phone, isGroup);
  const tsSec = chat.lastMessageTime ? normalizeToUnixSeconds(chat.lastMessageTime) : 0;

  return {
    remoteJid,
    name: chat.name || null,
    lastMessage: tsSec > 0
      ? {
          key: { id: "", fromMe: false, remoteJid },
          message: null,
          messageTimestamp: tsSec,
          messageType: null,
          pushName: chat.name || null,
        }
      : null,
    updatedAt: tsSec > 0
      ? new Date(tsSec * 1000).toISOString()
      : null,
    unreadCount: parseInt(chat.unread, 10) || chat.messagesUnread || 0,
  };
}

function zapiContactToCanonical(contact: any): WAContact {
  const phone = contact.phone || contact.id || "";
  return {
    remoteJid: phoneToJid(phone),
    pushName: contact.name || contact.notify || null,
    profilePicUrl: contact.profileThumbnail || contact.imgUrl || null,
  };
}

/**
 * Detect message type from Z-API message object.
 * Z-API uses top-level keys: text, image, audio, video, document, sticker, location, contact
 */
function detectZapiMessageType(msg: any): string {
  if (msg.image) return "imageMessage";
  if (msg.audio) return "audioMessage";
  if (msg.video) return "videoMessage";
  if (msg.document) return "documentMessage";
  if (msg.sticker) return "stickerMessage";
  if (msg.location) return "locationMessage";
  if (msg.contact) return "contactMessage";
  if (msg.text) return "conversation";
  return "unknown";
}

/**
 * Convert Z-API message content to Evolution-compatible message object.
 * This ensures backward compatibility with the existing system.
 */
function zapiMessageContentToEvo(msg: any): Record<string, any> | null {
  if (msg.text) {
    return { conversation: msg.text.message || "" };
  }
  if (msg.image) {
    return {
      imageMessage: {
        url: msg.image.imageUrl || "",
        caption: msg.image.caption || "",
        mimetype: msg.image.mimeType || "image/jpeg",
        thumbnailUrl: msg.image.thumbnailUrl || "",
      },
    };
  }
  if (msg.audio) {
    return {
      audioMessage: {
        url: msg.audio.audioUrl || "",
        mimetype: msg.audio.mimeType || "audio/ogg; codecs=opus",
        ptt: true,
      },
    };
  }
  if (msg.video) {
    return {
      videoMessage: {
        url: msg.video.videoUrl || "",
        caption: msg.video.caption || "",
        mimetype: msg.video.mimeType || "video/mp4",
      },
    };
  }
  if (msg.document) {
    return {
      documentMessage: {
        url: msg.document.documentUrl || "",
        mimetype: msg.document.mimeType || "application/octet-stream",
        fileName: msg.document.fileName || msg.document.title || "document",
        title: msg.document.title || msg.document.fileName || "",
        pageCount: msg.document.pageCount || 0,
      },
    };
  }
  if (msg.sticker) {
    return {
      stickerMessage: {
        url: msg.sticker.stickerUrl || "",
        mimetype: msg.sticker.mimeType || "image/webp",
      },
    };
  }
  if (msg.location) {
    return {
      locationMessage: {
        degreesLatitude: msg.location.latitude,
        degreesLongitude: msg.location.longitude,
        name: msg.location.name || "",
        address: msg.location.address || "",
      },
    };
  }
  if (msg.contact) {
    return {
      contactMessage: {
        displayName: msg.contact.displayName || "",
        vcard: msg.contact.vCard || "",
      },
    };
  }
  return null;
}

function zapiMessageToCanonical(msg: any): WAMessage {
  const phone = msg.phone || "";
  const isGroup = msg.isGroup === true;
  const remoteJid = phoneToJid(phone, isGroup);
  const messageType = detectZapiMessageType(msg);

  return {
    key: {
      id: msg.messageId || "",
      fromMe: msg.fromMe === true,
      remoteJid,
    },
    message: zapiMessageContentToEvo(msg),
    messageType,
    messageTimestamp: normalizeToUnixSeconds(msg.momment),
    pushName: msg.senderName || msg.chatName || null,
    status: zapiStatusToNumeric(msg.status),
  };
}

/** Convert Z-API status string to numeric status used internally */
function zapiStatusToNumeric(status: string | undefined): number {
  switch (status) {
    case "PENDING": return 0;
    case "SENT": return 1;
    case "RECEIVED": return 2;
    case "READ": return 3;
    case "PLAYED": return 4;
    default: return 1;
  }
}

// ════════════════════════════════════════════════════════════
// Z-API PROVIDER IMPLEMENTATION
// ════════════════════════════════════════════════════════════

export class ZApiProvider implements WhatsAppProvider {
  readonly type = "zapi" as const;

  // ─── Instance Management ───

  getInstanceName(tenantId: number, userId: number): string {
    // Same naming convention as Evolution for consistency
    return `crm-${tenantId}-${userId}`;
  }

  async createInstance(instanceName: string, opts?: { syncFullHistory?: boolean }): Promise<WACreateResult> {
    // Z-API instance creation requires the Partner API
    // The clientToken should be stored in env or DB
    const clientToken = process.env.ZAPI_CLIENT_TOKEN;

    const webhookBaseUrl = process.env.ZAPI_WEBHOOK_BASE_URL || "";

    const result = await zapiPartnerFetch("integrator/on-demand", {
      method: "POST",
      clientToken,
      body: {
        name: instanceName,
        receivedAndDeliveryCallbackUrl: webhookBaseUrl ? `${webhookBaseUrl}/api/webhooks/zapi` : undefined,
        messageStatusCallbackUrl: webhookBaseUrl ? `${webhookBaseUrl}/api/webhooks/zapi` : undefined,
        disconnectedCallbackUrl: webhookBaseUrl ? `${webhookBaseUrl}/api/webhooks/zapi` : undefined,
        connectedCallbackUrl: webhookBaseUrl ? `${webhookBaseUrl}/api/webhooks/zapi` : undefined,
      },
    });

    // Register the new session
    registerZApiSession(instanceName, {
      instanceId: result.id,
      token: result.token,
      clientToken,
    });

    return {
      instanceId: result.id,
      instanceName: instanceName,
      status: "created",
      qrCode: null, // QR code is fetched separately
    };
  }

  async connectInstance(instanceName: string): Promise<WAQrCode> {
    // Z-API returns base64 image from /qr-code/image
    const result = await zapiFetch(instanceName, "qr-code/image");

    // Z-API returns the base64 image directly or as { value: "base64..." }
    const base64 = typeof result === "string" ? result : result?.value || result?.qrcode || "";

    return {
      base64: base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`,
    };
  }

  /**
   * Get a phone code for connecting WhatsApp (alternative to QR code).
   * Docs: https://developer.z-api.io/instance/phone-code
   * Endpoint: GET /phone-code/{phone}
   * Returns a numeric code that the user enters in their WhatsApp app.
   */
  async getPhoneCode(instanceName: string, phone: string): Promise<string> {
    const cleanPhone = phone.replace(/\D/g, "");
    const result = await zapiFetch(instanceName, `phone-code/${cleanPhone}`);
    return result?.code || result?.value || "";
  }

  async fetchInstance(instanceName: string): Promise<WAInstance | null> {
    try {
      const status = await zapiFetch(instanceName, "status");
      const session = sessionRegistry.get(instanceName);

      if (!status) return null;

      // Enrich with profile data when connected
      // /me returns instance metadata (webhooks, payment status, etc.)
      // /profile-name and /profile-picture return WhatsApp profile data
      let profileName: string | null = null;
      let profilePicUrl: string | null = null;
      let phone = status.phone || null;

      if (status.connected && phone) {
        try {
          // GET /profile-picture requires ?phone= param even for own picture (docs: expires in 48h)
          const [nameResult, picResult] = await Promise.allSettled([
            zapiFetch(instanceName, "profile-name"),
            zapiFetch(instanceName, `profile-picture?phone=${phone}`),
          ]);
          if (nameResult.status === "fulfilled" && nameResult.value) {
            profileName = nameResult.value?.name || nameResult.value?.value || null;
          }
          if (picResult.status === "fulfilled" && picResult.value) {
            profilePicUrl = picResult.value?.link || null;
          }
        } catch {
          // Profile data is optional, don't fail fetchInstance
        }
      }

      return {
        instanceId: session?.instanceId || instanceName,
        name: instanceName,
        connectionStatus: status.connected ? "open" : "close",
        ownerJid: phone ? phoneToJid(phone) : null,
        profileName,
        profilePicUrl,
        phoneNumber: phone,
      };
    } catch {
      return null;
    }
  }

  async fetchAllInstances(): Promise<WAInstance[]> {
    // Z-API doesn't have a "list all instances" endpoint.
    // We iterate over registered sessions and check each one.
    const instances: WAInstance[] = [];
    for (const [name] of Array.from(sessionRegistry)) {
      try {
        const inst = await this.fetchInstance(name);
        if (inst) instances.push(inst);
      } catch {
        // Skip failed instances
      }
    }
    return instances;
  }

  async logoutInstance(instanceName: string): Promise<void> {
    await zapiFetch(instanceName, "disconnect");
  }

  async deleteInstance(instanceName: string): Promise<void> {
    // Z-API doesn't have a direct "delete instance" endpoint via instance API.
    // Disconnect and unregister from our registry.
    try {
      await zapiFetch(instanceName, "disconnect");
    } catch {
      // May already be disconnected
    }
    unregisterZApiSession(instanceName);
  }

  async restartInstance(instanceName: string): Promise<void> {
    // Z-API: GET /restart (not POST /restore-session)
    // Docs: https://developer.z-api.io/instance/restart
    await zapiFetch(instanceName, "restart");
  }

  // ─── Messaging ───

  async sendText(instanceName: string, number: string, text: string): Promise<WASendResult> {
    const phone = jidToPhone(number);
    const result = await zapiFetch(instanceName, "send-text", {
      method: "POST",
      body: { phone, message: text },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  async sendMedia(
    instanceName: string,
    number: string,
    mediaUrl: string,
    mediaType: "image" | "video" | "audio" | "document" | "gif",
    opts?: { caption?: string; fileName?: string; mimetype?: string }
  ): Promise<WASendResult> {
    const phone = jidToPhone(number);

    let endpoint: string;
    let body: Record<string, any>;

    switch (mediaType) {
      case "image":
        endpoint = "send-image";
        body = { phone, image: mediaUrl, caption: opts?.caption };
        break;
      case "video":
        endpoint = "send-video";
        // async: true lets Z-API process large videos in background without timeout
        body = { phone, video: mediaUrl, caption: opts?.caption, async: true };
        break;
      case "audio":
        endpoint = "send-audio";
        // async: true lets Z-API process large audios in background without timeout
        body = { phone, audio: mediaUrl, async: true };
        break;
      case "gif":
        // Z-API: POST /send-gif — animated GIF messages
        // Docs: https://developer.z-api.io/message/send-message-gif
        endpoint = "send-gif";
        body = { phone, gif: mediaUrl, caption: opts?.caption };
        break;
      case "document": {
        // Z-API requires extension in the URL path
        const ext = opts?.fileName?.split(".").pop() || "pdf";
        endpoint = `send-document/${ext}`;
        body = { phone, document: mediaUrl, fileName: opts?.fileName };
        break;
      }
    }

    const result = await zapiFetch(instanceName, endpoint, {
      method: "POST",
      body,
    });
    return zapiSendResultToCanonical(result, phone);
  }

  async sendAudio(instanceName: string, number: string, audioUrl: string): Promise<WASendResult> {
    const phone = jidToPhone(number);
    const result = await zapiFetch(instanceName, "send-audio", {
      method: "POST",
      body: { phone, audio: audioUrl, waveform: true, async: true },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  async sendPtv(instanceName: string, number: string, videoUrl: string): Promise<WASendResult> {
    const phone = jidToPhone(number);
    // Z-API: POST /send-ptv — video message (like voice note but video)
    // Docs: https://developer.z-api.io/message/send-message-ptv
    const result = await zapiFetch(instanceName, "send-ptv", {
      method: "POST",
      body: { phone, ptv: videoUrl, async: true },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  async sendTextWithQuote(
    instanceName: string,
    number: string,
    text: string,
    quoted: { key: { id: string }; message: { conversation: string } }
  ): Promise<WASendResult> {
    const phone = jidToPhone(number);
    const result = await zapiFetch(instanceName, "send-text", {
      method: "POST",
      body: {
        phone,
        message: text,
        messageId: quoted.key.id, // Z-API uses messageId for quoting
      },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  /**
   * Send a link with preview via Z-API POST /send-link
   * Docs: https://developer.z-api.io/message/send-message-link
   * Note: Link is only clickable if the recipient has the sender's number saved
   */
  async sendLink(
    instanceName: string,
    number: string,
    linkUrl: string,
    opts?: { message?: string; image?: string; title?: string; linkDescription?: string }
  ): Promise<WASendResult> {
    const phone = jidToPhone(number);
    // Z-API requires the linkUrl to be appended at the end of the message text
    let message = opts?.message || "";
    if (!message.includes(linkUrl)) {
      message = message ? `${message} ${linkUrl}` : linkUrl;
    }
    const result = await zapiFetch(instanceName, "send-link", {
      method: "POST",
      body: {
        phone,
        message,
        image: opts?.image || "",
        linkUrl,
        title: opts?.title || "",
        linkDescription: opts?.linkDescription || "",
      },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  // ─── Chat Sync ───

  async findChats(instanceName: string): Promise<WAChat[]> {
    // Z-API uses pagination: /chats?page=1&pageSize=100
    const allChats: WAChat[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const result = await zapiFetch(instanceName, `chats?page=${page}&pageSize=${pageSize}`);
      const chats = Array.isArray(result) ? result : [];

      for (const chat of chats) {
        allChats.push(zapiChatToCanonical(chat));
      }

      hasMore = chats.length === pageSize;
      page++;

      // Safety limit
      if (page > 50) break;
    }

    return allChats;
  }

  async findContacts(instanceName: string): Promise<WAContact[]> {
    // Z-API supports pagination: GET /contacts?page=X&pageSize=Y
    // Ref: https://developer.z-api.io/contacts/get-contacts
    const allContacts: WAContact[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const result = await zapiFetch(instanceName, `contacts?page=${page}&pageSize=${pageSize}`);
      const contacts = Array.isArray(result) ? result : [];
      allContacts.push(...contacts.map(zapiContactToCanonical));
      hasMore = contacts.length === pageSize;
      page++;
      if (page > 50) break; // Safety limit
    }

    return allContacts;
  }

  async findMessages(
    instanceName: string,
    remoteJid: string,
    opts?: { limit?: number; page?: number; lastMessageId?: string }
  ): Promise<WAMessage[]> {
    const phone = jidToPhone(remoteJid);
    const amount = opts?.limit || 20;

    // Z-API: GET /chat-messages/{phone}?amount=X&lastMessageId=Y
    // Docs: https://developer.z-api.io/chats/get-message-chats
    // Without lastMessageId, always returns the latest N messages.
    // With lastMessageId, returns N messages older than the given message.
    let url = `chat-messages/${phone}?amount=${amount}`;
    if (opts?.lastMessageId) {
      url += `&lastMessageId=${encodeURIComponent(opts.lastMessageId)}`;
    }
    const result = await zapiFetch(instanceName, url);
    const messages = Array.isArray(result) ? result : [];

    return messages.map(zapiMessageToCanonical);
  }

  // ─── Chat Actions ───

  async markMessageAsRead(instanceName: string, remoteJid: string, messageIds: string[]): Promise<void> {
    const phone = jidToPhone(remoteJid);
    // Z-API reads one message at a time
    for (const messageId of messageIds) {
      await zapiFetch(instanceName, "read-message", {
        method: "POST",
        body: { phone, messageId },
      });
    }
  }

  async markMessageAsUnread(instanceName: string, remoteJid: string, _messageId: string): Promise<void> {
    // Z-API supports unread via POST /modify-chat with action "unread"
    // Ref: https://developer.z-api.io/chats/archive-chat (same endpoint, different action)
    const phone = jidToPhone(remoteJid);
    await zapiFetch(instanceName, "modify-chat", {
      method: "POST",
      body: { phone, action: "unread" },
    });
  }

  async deleteMessageForEveryone(
    instanceName: string,
    remoteJid: string,
    messageId: string,
    fromMe: boolean
  ): Promise<void> {
    const phone = jidToPhone(remoteJid);
    // Z-API: DELETE /messages with query params
    // Docs: https://developer.z-api.io/message/delete-message
    await zapiFetch(
      instanceName,
      `messages?messageId=${encodeURIComponent(messageId)}&phone=${phone}&owner=${fromMe}`,
      { method: "DELETE" }
    );
  }

  async updateMessage(
    instanceName: string,
    number: string,
    messageId: string,
    text: string
  ): Promise<WASendResult> {
    const phone = jidToPhone(number);
    // Z-API uses editMessageId in send-text
    const result = await zapiFetch(instanceName, "send-text", {
      method: "POST",
      body: { phone, message: text, editMessageId: messageId },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  async sendPresence(
    _instanceName: string,
    _number: string,
    _presence: "composing" | "recording" | "available" | "unavailable" | "paused"
  ): Promise<void> {
    // Z-API has delayTyping parameter on send-text but no standalone presence endpoint.
    // This is a no-op for now. Could be implemented via Z-API's chat presence webhook.
    console.warn("[Z-API] sendPresence is not directly supported. Use delayTyping on send-text instead.");
  }

  async archiveChat(instanceName: string, remoteJid: string, archive: boolean): Promise<void> {
    const phone = jidToPhone(remoteJid);
    await zapiFetch(instanceName, "modify-chat", {
      method: "POST",
      body: { phone, action: archive ? "archive" : "unarchive" },
    });
  }

  async pinChat(instanceName: string, remoteJid: string, pin: boolean): Promise<void> {
    const phone = jidToPhone(remoteJid);
    // Z-API: POST /modify-chat action:"pin"/"unpin"
    // Docs: https://developer.z-api.io/chats/archive-chat
    await zapiFetch(instanceName, "modify-chat", {
      method: "POST",
      body: { phone, action: pin ? "pin" : "unpin" },
    });
  }

  async muteChat(instanceName: string, remoteJid: string, mute: boolean): Promise<void> {
    const phone = jidToPhone(remoteJid);
    // Z-API: POST /modify-chat action:"mute"/"unmute"
    // Docs: https://developer.z-api.io/chats/archive-chat
    await zapiFetch(instanceName, "modify-chat", {
      method: "POST",
      body: { phone, action: mute ? "mute" : "unmute" },
    });
  }

  async deleteChat(instanceName: string, remoteJid: string): Promise<void> {
    const phone = jidToPhone(remoteJid);
    // Z-API: POST /modify-chat action:"delete"
    // Docs: https://developer.z-api.io/chats/archive-chat
    await zapiFetch(instanceName, "modify-chat", {
      method: "POST",
      body: { phone, action: "delete" },
    });
  }

  async pinMessage(instanceName: string, remoteJid: string, messageId: string, pin: boolean): Promise<void> {
    const phone = jidToPhone(remoteJid);
    // Z-API: POST /pin-message
    // Docs: https://developer.z-api.io/message/pin-message
    await zapiFetch(instanceName, "pin-message", {
      method: "POST",
      body: { phone, messageId, messageAction: pin ? "pin" : "unpin" },
    });
  }

  async forwardMessage(instanceName: string, fromJid: string, toJid: string, messageId: string): Promise<WASendResult> {
    const phone = jidToPhone(toJid);
    const messagePhone = jidToPhone(fromJid);
    // Z-API: POST /forward-message
    // Docs: https://developer.z-api.io/message/forward-message
    const result = await zapiFetch(instanceName, "forward-message", {
      method: "POST",
      body: { phone, messageId, messagePhone },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  async updateBlockStatus(instanceName: string, number: string, status: "block" | "unblock"): Promise<void> {
    const phone = jidToPhone(number);
    await zapiFetch(instanceName, "contacts/modify-blocked", {
      method: "POST",
      body: { phone, action: status },
    });
  }

  async checkIsWhatsApp(instanceName: string, numbers: string[]): Promise<WANumberCheck[]> {
    const results: WANumberCheck[] = [];
    for (const num of numbers) {
      const phone = jidToPhone(num);
      try {
        const result = await zapiFetch(instanceName, `phone-exists/${phone}`);
        results.push({
          exists: result?.exists === true,
          jid: phoneToJid(phone),
          number: phone,
        });
      } catch {
        results.push({ exists: false, jid: phoneToJid(phone), number: phone });
      }
    }
    return results;
  }

  async checkIsWhatsAppBatch(instanceName: string, phones: string[]): Promise<WANumberCheck[]> {
    // Z-API: POST /phone-exists-batch — validate multiple numbers at once
    // Docs: https://developer.z-api.io/contacts/batch-phone-exists
    const cleanPhones = phones.map((p) => jidToPhone(p).replace(/\D/g, ""));
    try {
      const result = await zapiFetch(instanceName, "phone-exists-batch", {
        method: "POST",
        body: { phones: cleanPhones },
      });
      const items = Array.isArray(result) ? result : result?.results || [];
      return items.map((item: any) => ({
        exists: item?.exists === true,
        jid: phoneToJid(item?.phone || ""),
        number: item?.phone || "",
      }));
    } catch {
      // Fallback to individual checks
      return this.checkIsWhatsApp(instanceName, phones);
    }
  }

  // ─── Reactions & Rich Messages ───

  async sendReaction(
    instanceName: string,
    key: { remoteJid: string; fromMe: boolean; id: string },
    reaction: string
  ): Promise<WASendResult> {
    const phone = jidToPhone(key.remoteJid);
    const result = await zapiFetch(instanceName, "send-reaction", {
      method: "POST",
      body: { phone, messageId: key.id, reaction },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  async sendSticker(instanceName: string, number: string, stickerUrl: string): Promise<WASendResult> {
    const phone = jidToPhone(number);
    const result = await zapiFetch(instanceName, "send-sticker", {
      method: "POST",
      body: { phone, sticker: stickerUrl },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  async sendLocation(
    instanceName: string,
    number: string,
    latitude: number,
    longitude: number,
    name: string,
    address: string
  ): Promise<WASendResult> {
    const phone = jidToPhone(number);
    const result = await zapiFetch(instanceName, "send-location", {
      method: "POST",
      body: { phone, latitude: String(latitude), longitude: String(longitude), title: name, address },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  async sendContact(
    instanceName: string,
    number: string,
    contact: Array<{ fullName: string; wuid?: string; phoneNumber: string }>
  ): Promise<WASendResult> {
    const phone = jidToPhone(number);
    if (!contact.length) throw new Error("[Z-API] sendContact requires at least one contact");

    if (contact.length === 1) {
      // Single contact: POST /send-contact
      // Docs: https://developer.z-api.io/message/send-message-contact
      const c = contact[0];
      const result = await zapiFetch(instanceName, "send-contact", {
        method: "POST",
        body: { phone, contactName: c.fullName, contactPhone: c.phoneNumber },
      });
      return zapiSendResultToCanonical(result, phone);
    }

    // Multiple contacts: POST /send-contacts (plural)
    // Docs: https://developer.z-api.io/message/send-message-contacts
    const result = await zapiFetch(instanceName, "send-contacts", {
      method: "POST",
      body: {
        phone,
        contacts: contact.map((c) => ({
          contactName: c.fullName,
          contactPhone: c.phoneNumber,
        })),
      },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  async sendPoll(
    instanceName: string,
    number: string,
    name: string,
    values: string[],
    selectableCount: number = 1
  ): Promise<WASendResult> {
    const phone = jidToPhone(number);
    // Z-API native poll: POST /send-poll
    // Docs: https://developer.z-api.io/message/send-message-poll
    const result = await zapiFetch(instanceName, "send-poll", {
      method: "POST",
      body: {
        phone,
        poll: {
          name,
          selectableCount,
          values,
        },
      },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  async sendList(
    instanceName: string,
    number: string,
    title: string,
    description: string,
    buttonText: string,
    _footerText: string,
    sections: Array<{ title: string; rows: Array<{ title: string; description?: string; rowId: string }> }>
  ): Promise<WASendResult> {
    const phone = jidToPhone(number);
    const result = await zapiFetch(instanceName, "send-option-list", {
      method: "POST",
      body: {
        phone,
        optionList: {
          title,
          description,
          buttonLabel: buttonText,
          options: sections.flatMap((s) =>
            s.rows.map((r) => ({
              id: r.rowId,
              title: r.title,
              description: r.description || "",
            }))
          ),
        },
      },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  async sendButtons(
    instanceName: string,
    number: string,
    title: string,
    description: string,
    _footer: string,
    buttons: Array<{ buttonId: string; buttonText: { displayText: string } }>
  ): Promise<WASendResult> {
    const phone = jidToPhone(number);
    const result = await zapiFetch(instanceName, "send-button-list", {
      method: "POST",
      body: {
        phone,
        message: description,
        title,
        buttons: buttons.map((b) => ({
          id: b.buttonId,
          label: b.buttonText.displayText,
        })),
      },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  // ─── Profile ───

  async getProfilePicture(instanceName: string, number: string): Promise<string | null> {
    const phone = jidToPhone(number);
    try {
      const result = await zapiFetch(instanceName, `profile-picture?phone=${phone}`);
      return result?.link || result?.profilePictureUrl || null;
    } catch {
      return null;
    }
  }

  async fetchProfile(instanceName: string, number: string): Promise<any> {
    const phone = jidToPhone(number);
    return zapiFetch(instanceName, `contact-metadata/${phone}`);
  }

  async fetchBusinessProfile(instanceName: string, number: string): Promise<any> {
    // Z-API doesn't have a separate business profile endpoint
    return this.fetchProfile(instanceName, number);
  }

  /**
   * Get the instance's own profile picture.
   * Docs: https://developer.z-api.io/contacts/get-profile-picture
   * GET /profile-picture?phone={ownPhone} — URL expires in 48h
   */
  async getOwnProfilePicture(instanceName: string): Promise<string | null> {
    try {
      // Need connected phone to query own picture
      const status = await zapiFetch(instanceName, "status");
      const phone = status?.phone;
      if (!phone) return null;
      const result = await zapiFetch(instanceName, `profile-picture?phone=${phone}`);
      return result?.link || null;
    } catch {
      return null;
    }
  }

  /**
   * Update the instance's own profile picture.
   * Docs: https://developer.z-api.io/instance/profile-picture
   * PUT /profile-picture { value: "https://url-da-imagem.jpg" }
   */
  async updateOwnProfilePicture(instanceName: string, imageUrl: string): Promise<boolean> {
    try {
      await zapiFetch(instanceName, "profile-picture", {
        method: "PUT",
        body: { value: imageUrl },
      });
      return true;
    } catch {
      return false;
    }
  }

  // ─── Profile Management ───

  async updateProfileName(instanceName: string, name: string): Promise<boolean> {
    // Z-API: PUT /profile-name
    // Docs: https://developer.z-api.io/instance/profile-name
    try {
      await zapiFetch(instanceName, "profile-name", {
        method: "PUT",
        body: { value: name },
      });
      return true;
    } catch {
      return false;
    }
  }

  async updateProfileDescription(instanceName: string, description: string): Promise<boolean> {
    // Z-API: PUT /profile-description
    // Docs: https://developer.z-api.io/instance/profile-description
    try {
      await zapiFetch(instanceName, "profile-description", {
        method: "PUT",
        body: { value: description },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getDeviceInfo(instanceName: string): Promise<any> {
    // Z-API: GET /device
    // Docs: https://developer.z-api.io/instance/device
    try {
      return await zapiFetch(instanceName, "device");
    } catch {
      return null;
    }
  }

  async getBlockedContacts(instanceName: string): Promise<WAContact[]> {
    // Z-API: GET /contacts/blocked
    // Docs: https://developer.z-api.io/contacts/get-blocked-contacts
    try {
      const result = await zapiFetch(instanceName, "contacts/blocked");
      const contacts = Array.isArray(result) ? result : [];
      return contacts.map(zapiContactToCanonical);
    } catch {
      return [];
    }
  }

  async getMessageQueue(instanceName: string): Promise<{ count: number; messages: any[] }> {
    // Z-API: GET /queue
    // Docs: https://developer.z-api.io/queue/get-queue
    try {
      const result = await zapiFetch(instanceName, "queue");
      const messages = Array.isArray(result) ? result : result?.messages || [];
      return { count: messages.length, messages };
    } catch {
      return { count: 0, messages: [] };
    }
  }

  async clearMessageQueue(instanceName: string): Promise<boolean> {
    // Z-API: DELETE /queue
    // Docs: https://developer.z-api.io/queue/delete-queue
    try {
      await zapiFetch(instanceName, "queue", { method: "DELETE" });
      return true;
    } catch {
      return false;
    }
  }

  // ─── Product Catalog (WhatsApp Business) ───

  /**
   * List products from WhatsApp Business catalog.
   * Uses V2 (POST-based) to avoid HTTP 414 with long cursor strings.
   * Docs: https://developer.z-api.io/business/get-products-v2
   * POST /catalogs { nextCursor? }
   */
  async getCatalogProducts(instanceName: string, nextCursor?: string): Promise<{ products: any[]; nextCursor?: string; cartEnabled?: boolean }> {
    try {
      const result = await zapiFetch(instanceName, "catalogs", {
        method: "POST",
        body: nextCursor ? { nextCursor } : {},
      });
      return {
        products: result?.products || [],
        nextCursor: result?.nextCursor || undefined,
        cartEnabled: result?.cartEnabled,
      };
    } catch {
      return { products: [] };
    }
  }

  /**
   * Send a product from the catalog to a contact.
   * Docs: https://developer.z-api.io/message/send-message-product
   * POST /send-product { phone, catalogPhone, productId }
   */
  async sendProduct(instanceName: string, number: string, catalogPhone: string, productId: string): Promise<WASendResult> {
    const phone = jidToPhone(number);
    const result = await zapiFetch(instanceName, "send-product", {
      method: "POST",
      body: { phone, catalogPhone, productId },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  /**
   * Send full catalog link to a contact.
   * Docs: https://developer.z-api.io/message/send-message-catalog
   * POST /send-catalog { phone, catalogPhone, message?, title?, catalogDescription?, translation? }
   */
  async sendCatalog(
    instanceName: string,
    number: string,
    catalogPhone: string,
    opts?: { message?: string; title?: string; catalogDescription?: string }
  ): Promise<WASendResult> {
    const phone = jidToPhone(number);
    const result = await zapiFetch(instanceName, "send-catalog", {
      method: "POST",
      body: {
        phone,
        catalogPhone,
        translation: "PT",
        message: opts?.message || "",
        title: opts?.title || "",
        catalogDescription: opts?.catalogDescription || "",
      },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  // ─── Groups ───

  async createGroup(instanceName: string, subject: string, participants: string[], _description?: string): Promise<any> {
    const phones = participants.map(jidToPhone);
    return zapiFetch(instanceName, "create-group", {
      method: "POST",
      body: { groupName: subject, phones },
    });
  }

  async fetchAllGroups(instanceName: string): Promise<any[]> {
    const allGroups: any[] = [];
    let page = 1;
    const pageSize = 50;
    let hasMore = true;

    while (hasMore) {
      const result = await zapiFetch(instanceName, `groups?page=${page}&pageSize=${pageSize}`);
      const groups = Array.isArray(result) ? result : [];
      allGroups.push(...groups);
      hasMore = groups.length === pageSize;
      page++;
      if (page > 20) break;
    }

    return allGroups;
  }

  async findGroupByJid(instanceName: string, groupJid: string): Promise<any> {
    const groupId = jidToPhone(groupJid);
    return zapiFetch(instanceName, `group-metadata/${groupId}`);
  }

  async findGroupMembers(instanceName: string, groupJid: string): Promise<any[]> {
    const metadata = await this.findGroupByJid(instanceName, groupJid);
    return metadata?.participants || [];
  }

  async updateGroupMembers(
    instanceName: string,
    groupJid: string,
    action: "add" | "remove" | "promote" | "demote",
    participants: string[]
  ): Promise<any> {
    const groupId = jidToPhone(groupJid);
    const phones = participants.map(jidToPhone);

    const endpointMap: Record<string, string> = {
      add: "add-participant",
      remove: "remove-participant",
      promote: "promote-participant",
      demote: "demote-participant",
    };

    return zapiFetch(instanceName, endpointMap[action], {
      method: "POST",
      body: { groupId, phones },
    });
  }

  async updateGroupSubject(instanceName: string, groupJid: string, subject: string): Promise<any> {
    const groupId = jidToPhone(groupJid);
    return zapiFetch(instanceName, "update-group-name", {
      method: "PUT",
      body: { groupId, groupName: subject },
    });
  }

  async updateGroupDescription(instanceName: string, groupJid: string, description: string): Promise<any> {
    const groupId = jidToPhone(groupJid);
    return zapiFetch(instanceName, "update-group-description", {
      method: "PUT",
      body: { groupId, groupDescription: description },
    });
  }

  async fetchInviteCode(instanceName: string, groupJid: string): Promise<string | null> {
    const groupId = jidToPhone(groupJid);
    try {
      const result = await zapiFetch(instanceName, `group-invite-link/${groupId}`);
      return result?.invitationLink || result?.link || null;
    } catch {
      return null;
    }
  }

  async revokeInviteCode(instanceName: string, groupJid: string): Promise<string | null> {
    const groupId = jidToPhone(groupJid);
    try {
      const result = await zapiFetch(instanceName, `revoke-group-invite-link/${groupId}`);
      return result?.invitationLink || result?.link || null;
    } catch {
      return null;
    }
  }

  async updateGroupSetting(
    _instanceName: string,
    _groupJid: string,
    _action: "announcement" | "not_announcement" | "locked" | "unlocked"
  ): Promise<any> {
    // Z-API has limited group settings support
    console.warn("[Z-API] updateGroupSetting has limited support");
    return {};
  }

  async toggleEphemeral(
    _instanceName: string,
    _groupJid: string,
    _expiration: number
  ): Promise<any> {
    console.warn("[Z-API] toggleEphemeral is not supported");
    return {};
  }

  async leaveGroup(instanceName: string, groupJid: string): Promise<any> {
    const groupId = jidToPhone(groupJid);
    return zapiFetch(instanceName, "leave-group", {
      method: "POST",
      body: { groupId },
    });
  }

  // ─── Media ───

  async getBase64FromMediaMessage(
    _instanceName: string,
    messageId: string,
    options?: { remoteJid?: string; fromMe?: boolean; convertToMp4?: boolean }
  ): Promise<WAMediaResult | null> {
    // Z-API provides direct URLs in webhook payloads (imageUrl, audioUrl, etc.)
    // These URLs are saved to waMessages.mediaUrl by the messageWorker.
    // This fallback looks up the URL from DB and downloads the media.
    try {
      const { getDb } = await import("../db");
      const { waMessages } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db || !messageId) return null;

      // Look up the message to get its mediaUrl
      const conditions = [eq(waMessages.messageId, messageId)];
      if (options?.remoteJid) {
        conditions.push(eq(waMessages.remoteJid, options.remoteJid));
      }
      const [msg] = await db.select({
        mediaUrl: waMessages.mediaUrl,
        mediaMimeType: waMessages.mediaMimeType,
        mediaFileName: waMessages.mediaFileName,
      }).from(waMessages).where(and(...conditions)).limit(1);

      if (!msg?.mediaUrl) return null;

      // Download the media from the URL
      const response = await fetch(msg.mediaUrl, {
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        console.warn(`[Z-API] getBase64FromMediaMessage: download failed (${response.status}) for ${msg.mediaUrl.substring(0, 80)}`);
        return null;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const base64 = buffer.toString("base64");
      const mimetype = msg.mediaMimeType || response.headers.get("content-type") || "application/octet-stream";

      return {
        base64,
        mimetype,
        fileName: msg.mediaFileName || undefined,
      };
    } catch (err: any) {
      console.warn(`[Z-API] getBase64FromMediaMessage failed: ${err.message}`);
      return null;
    }
  }

  // ─── Health & Webhooks ───

  async healthCheck(): Promise<WAHealthResult> {
    const start = Date.now();
    try {
      // Check if at least one registered session is reachable
      const firstSession = sessionRegistry.entries().next().value;
      if (!firstSession) {
        return {
          ok: false,
          provider: "zapi",
          error: "No Z-API sessions registered",
          latencyMs: Date.now() - start,
        };
      }

      const [name] = firstSession;
      const status = await zapiFetch(name, "status");

      return {
        ok: true,
        provider: "zapi",
        version: "z-api-v1",
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        ok: false,
        provider: "zapi",
        error: err.message,
        latencyMs: Date.now() - start,
      };
    }
  }

  async findWebhook(instanceName: string): Promise<WAWebhookConfig | null> {
    // Z-API doesn't have a "get webhook" endpoint.
    // We return a synthetic config based on the sessionId (= instanceName).
    const baseUrl = process.env.ZAPI_WEBHOOK_BASE_URL || "https://crm.enturos.com";
    return {
      enabled: true,
      url: `${baseUrl}/api/webhooks/zapi/${instanceName}`,
      events: [
        "ReceivedCallBack",
        "DeliveryCallback",
        "MessageStatusCallback",
        "DisconnectedCallback",
        "ConnectedCallback",
      ],
    };
  }

  async setWebhook(instanceName: string, opts?: { url?: string; events?: string[] }): Promise<boolean> {
    // Build the correct webhook URL using the sessionId (= instanceName).
    // This matches the per-event URLs set during provisioning in zapiProvisioningService.ts.
    const baseUrl = process.env.ZAPI_WEBHOOK_BASE_URL || "https://crm.enturos.com";
    const url = opts?.url || `${baseUrl}/api/webhooks/zapi/${instanceName}`;
    if (!url) return false;

    try {
      await zapiFetch(instanceName, "update-every-webhooks", {
        method: "PUT",
        body: { value: url, notifySentByMe: true },
      });
      console.log(`[Z-API] Webhook set for ${instanceName} → ${url}`);
      return true;
    } catch (e: any) {
      console.warn(`[Z-API] setWebhook failed for ${instanceName}:`, e.message);
      return false;
    }
  }

  async ensureWebhook(instanceName: string): Promise<boolean> {
    return this.setWebhook(instanceName);
  }

  // ─── Webhook Normalization ───

  normalizeWebhookPayload(rawPayload: any): WAWebhookEvent | null {
    if (!rawPayload || !rawPayload.type) return null;

    const instanceName = rawPayload._instanceName || "unknown";

    switch (rawPayload.type) {
      case "ReceivedCallBack": {
        // Inbound or outbound message
        const phone = rawPayload.phone || "";
        const isGroup = rawPayload.isGroup === true;
        const remoteJid = phoneToJid(phone, isGroup);
        const messageType = detectZapiMessageType(rawPayload);
        const messageContent = zapiMessageContentToEvo(rawPayload);

        return {
          event: "messages.upsert",
          instance: instanceName,
          data: {
            key: {
              remoteJid,
              fromMe: rawPayload.fromMe === true,
              id: rawPayload.messageId || "",
            },
            pushName: rawPayload.senderName || rawPayload.chatName || "",
            message: messageContent,
            messageType,
            messageTimestamp: rawPayload.momment
              ? Math.floor(rawPayload.momment / 1000)
              : Math.floor(Date.now() / 1000),
            status: zapiStatusToNumeric(rawPayload.status),
            participant: rawPayload.participantPhone
              ? phoneToJid(rawPayload.participantPhone)
              : undefined,
          },
          provider: "zapi",
          receivedAt: new Date().toISOString(),
        };
      }

      case "DeliveryCallback": {
        // Message sent confirmation
        const phone = rawPayload.phone || "";
        return {
          event: "send.message",
          instance: instanceName,
          data: {
            key: {
              remoteJid: phoneToJid(phone),
              fromMe: true,
              id: rawPayload.messageId || rawPayload.zaapId || "",
            },
            status: 1, // SENT
            messageTimestamp: Math.floor(Date.now() / 1000),
          },
          provider: "zapi",
          receivedAt: new Date().toISOString(),
        };
      }

      case "MessageStatusCallback": {
        // Message status update (ack)
        const phone = rawPayload.phone || "";
        return {
          event: "messages.update",
          instance: instanceName,
          data: {
            key: {
              remoteJid: phoneToJid(phone),
              fromMe: true,
              id: rawPayload.messageId || "",
            },
            update: {
              status: zapiStatusToNumeric(rawPayload.status),
            },
            messageTimestamp: rawPayload.momment
              ? Math.floor(rawPayload.momment / 1000)
              : Math.floor(Date.now() / 1000),
          },
          provider: "zapi",
          receivedAt: new Date().toISOString(),
        };
      }

      case "ConnectedCallback": {
        return {
          event: "connection.update",
          instance: instanceName,
          data: {
            state: "open",
            statusReason: 200,
          },
          provider: "zapi",
          receivedAt: new Date().toISOString(),
        };
      }

      case "DisconnectedCallback": {
        return {
          event: "connection.update",
          instance: instanceName,
          data: {
            state: "close",
            statusReason: 401,
          },
          provider: "zapi",
          receivedAt: new Date().toISOString(),
        };
      }

      default:
        console.warn(`[Z-API] Unknown webhook type: ${rawPayload.type}`);
        return null;
    }
  }
}

/** Singleton instance */
export const zapiProvider = new ZApiProvider();
