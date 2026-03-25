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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (clientToken) {
    headers["Client-Token"] = clientToken;
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
      throw new Error(`[Z-API] ${method} /${endpoint} returned ${response.status}: ${text}`);
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
      throw new Error(`[Z-API] ${method} /${endpoint} timed out after ${timeout}ms`);
    }
    throw err;
  }
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

  return {
    remoteJid,
    name: chat.name || null,
    lastMessage: chat.lastMessageTime
      ? {
          key: { id: "", fromMe: false, remoteJid },
          message: null,
          messageTimestamp: parseInt(chat.lastMessageTime, 10) || 0,
          messageType: null,
          pushName: chat.name || null,
        }
      : null,
    updatedAt: chat.lastMessageTime
      ? new Date(parseInt(chat.lastMessageTime, 10) * 1000).toISOString()
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
    messageTimestamp: msg.momment
      ? Math.floor(msg.momment / 1000) // Z-API uses ms, we use seconds
      : Math.floor(Date.now() / 1000),
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

  async fetchInstance(instanceName: string): Promise<WAInstance | null> {
    try {
      const status = await zapiFetch(instanceName, "status");
      const session = sessionRegistry.get(instanceName);

      if (!status) return null;

      return {
        instanceId: session?.instanceId || instanceName,
        name: instanceName,
        connectionStatus: status.connected ? "open" : "close",
        ownerJid: status.phone ? phoneToJid(status.phone) : null,
        profileName: null, // Z-API /status doesn't return profile name
        profilePicUrl: null,
        phoneNumber: status.phone || null,
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
    await zapiFetch(instanceName, "restore-session");
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
    mediaType: "image" | "video" | "audio" | "document",
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
        body = { phone, video: mediaUrl, caption: opts?.caption };
        break;
      case "audio":
        endpoint = "send-audio";
        body = { phone, audio: mediaUrl };
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
      body: { phone, audio: audioUrl, waveform: true },
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
    const result = await zapiFetch(instanceName, "contacts");
    const contacts = Array.isArray(result) ? result : [];
    return contacts.map(zapiContactToCanonical);
  }

  async findMessages(
    instanceName: string,
    remoteJid: string,
    opts?: { limit?: number; page?: number }
  ): Promise<WAMessage[]> {
    const phone = jidToPhone(remoteJid);
    const amount = opts?.limit || 20;

    // Z-API: GET /chat-messages/{phone}?amount=X
    const result = await zapiFetch(instanceName, `chat-messages/${phone}?amount=${amount}`);
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

  async markMessageAsUnread(_instanceName: string, _remoteJid: string, _messageId: string): Promise<void> {
    // Z-API doesn't have a "mark as unread" endpoint.
    // This is a no-op for Z-API.
    console.warn("[Z-API] markMessageAsUnread is not supported by Z-API");
  }

  async deleteMessageForEveryone(
    instanceName: string,
    remoteJid: string,
    messageId: string,
    fromMe: boolean
  ): Promise<void> {
    const phone = jidToPhone(remoteJid);
    // Z-API uses DELETE with query params
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
    // Z-API sends one contact at a time; for multiple, use send-multiple-contacts
    const first = contact[0];
    if (!first) throw new Error("[Z-API] sendContact requires at least one contact");

    const result = await zapiFetch(instanceName, "send-contact", {
      method: "POST",
      body: {
        phone,
        contactName: first.fullName,
        contactPhone: first.phoneNumber,
      },
    });
    return zapiSendResultToCanonical(result, phone);
  }

  async sendPoll(
    instanceName: string,
    number: string,
    name: string,
    values: string[],
    _selectableCount: number = 1
  ): Promise<WASendResult> {
    const phone = jidToPhone(number);
    // Z-API may not have a direct poll endpoint; use send-option-list as fallback
    const result = await zapiFetch(instanceName, "send-option-list", {
      method: "POST",
      body: {
        phone,
        optionList: {
          title: name,
          buttonLabel: "Votar",
          options: values.map((v, i) => ({ id: String(i + 1), description: "", title: v })),
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
    _messageId: string,
    _options?: { remoteJid?: string; fromMe?: boolean; convertToMp4?: boolean }
  ): Promise<WAMediaResult | null> {
    // Z-API provides direct URLs in webhook payloads (imageUrl, audioUrl, etc.)
    // There's no need to call a separate endpoint to get media.
    // This method is kept for interface compatibility but should rarely be needed.
    // If called, we'd need the original webhook data which we don't have here.
    console.warn("[Z-API] getBase64FromMediaMessage: Z-API provides direct URLs in webhooks. Use those instead.");
    return null;
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
    // We return a synthetic config based on what we know.
    return {
      enabled: true,
      url: process.env.ZAPI_WEBHOOK_BASE_URL || "",
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
    const url = opts?.url || process.env.ZAPI_WEBHOOK_BASE_URL || "";
    if (!url) return false;

    try {
      await zapiFetch(instanceName, "update-every-webhooks", {
        method: "PUT",
        body: { value: url, notifySentByMe: true },
      });
      return true;
    } catch {
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
