/**
 * Z-API Webhook Normalizer
 *
 * Translates Z-API webhook payloads into the Evolution API WebhookPayload format
 * so that the existing whatsappManager.handleWebhookEvent() works unchanged.
 *
 * Z-API webhook events:
 * - on-message-received → messages.upsert (incoming)
 * - on-message-send     → send.message (outgoing)
 * - on-whatsapp-message-status-changes → messages.update (status ticks)
 * - on-whatsapp-message-revoked → messages.delete
 * - on-connection        → connection.update
 *
 * The normalizer maps each Z-API event to the Evolution format, preserving
 * the same data.key, data.message, data.messageTimestamp structure.
 */

import type { WebhookPayload, WebhookEventType } from "../evolutionApi";
import { normalizeToUnixSeconds } from "./zapiProvider";

// ════════════════════════════════════════════════════════════
// Z-API WEBHOOK PAYLOAD TYPES
// ════════════════════════════════════════════════════════════

/** Z-API on-message-received / on-message-send payload */
interface ZApiMessagePayload {
  phone?: string;          // "5511999999999"
  chatName?: string;       // Contact or group name
  messageId?: string;      // "BAE5F..." or "3EB0..."
  momment?: number;        // Unix timestamp (seconds)
  timestamp?: number;      // Unix timestamp (seconds)
  type?: string;           // "ReceivedCallback" or "MessageStatusCallback"
  fromMe?: boolean;
  isGroup?: boolean;
  isNewsletter?: boolean;
  chatId?: string;         // "5511999999999@c.us" or "120363...@g.us"
  senderName?: string;     // Push name
  senderPhoto?: string;    // Profile photo URL
  photo?: string;          // Profile photo URL
  broadcast?: boolean;
  participantPhone?: string; // In groups
  // Text message
  text?: { message?: string };
  // Image message
  image?: { imageUrl?: string; caption?: string; mimeType?: string; thumbnailUrl?: string };
  // Audio message
  audio?: { audioUrl?: string; mimeType?: string; ptt?: boolean };
  // Video message
  video?: { videoUrl?: string; caption?: string; mimeType?: string };
  // Document message
  document?: { documentUrl?: string; mimeType?: string; fileName?: string; title?: string; caption?: string };
  // Sticker message
  sticker?: { stickerUrl?: string; mimeType?: string };
  // Location message
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  // Contact message
  contact?: { displayName?: string; vCard?: string };
  // Reaction message
  reaction?: { value?: string; reactionBy?: string; reference?: string };
  // Quoted message
  quotedMessage?: { messageId?: string };
  // Status update
  status?: string;         // "SENT", "DELIVERED", "READ", "PLAYED"
  ids?: string[];          // Array of message IDs for status updates
  // Connection
  connected?: boolean;
  // Raw body for fallback
  [key: string]: any;
}

// ════════════════════════════════════════════════════════════
// NORMALIZER — Z-API → Evolution WebhookPayload
// ════════════════════════════════════════════════════════════

/**
 * Determine the Z-API webhook event type from the request path or body.
 * Z-API sends webhooks to configured URLs, typically one URL per event type.
 * We use the route parameter to determine the event type.
 */
export type ZApiWebhookEvent =
  | "on-message-received"
  | "on-message-send"
  | "on-whatsapp-message-status-changes"
  | "on-whatsapp-message-revoked"
  | "on-connection"
  | "on-disconnect"
  | "unknown";

/**
 * Map Z-API event type to Evolution event type.
 */
function mapEventType(zapiEvent: ZApiWebhookEvent): WebhookEventType {
  switch (zapiEvent) {
    case "on-message-received":
      return "messages.upsert";
    case "on-message-send":
      return "send.message";
    case "on-whatsapp-message-status-changes":
      return "messages.update";
    case "on-whatsapp-message-revoked":
      return "messages.delete";
    case "on-connection":
      return "connection.update";
    case "on-disconnect":
      return "connection.update";
    default:
      return "messages.upsert"; // fallback
  }
}

/**
 * Convert Z-API phone/chatId to Evolution-style remoteJid.
 * Z-API uses "5511999999999" or "5511999999999@c.us"
 * Evolution uses "5511999999999@s.whatsapp.net"
 */
function toRemoteJid(phone?: string, chatId?: string, isGroup?: boolean): string {
  if (chatId) {
    // Already has @g.us or @c.us suffix
    if (chatId.includes("@g.us")) return chatId;
    if (chatId.includes("@c.us")) return chatId.replace("@c.us", "@s.whatsapp.net");
    if (chatId.includes("@s.whatsapp.net")) return chatId;
    // Raw number
    return `${chatId}@s.whatsapp.net`;
  }
  if (phone) {
    const cleaned = phone.replace(/\D/g, "");
    if (isGroup) return `${cleaned}@g.us`;
    return `${cleaned}@s.whatsapp.net`;
  }
  return "unknown@s.whatsapp.net";
}

/**
 * Detect message type from Z-API payload.
 */
function detectMessageType(body: ZApiMessagePayload): string {
  if (body.audio) return body.audio.ptt ? "pttMessage" : "audioMessage";
  if (body.image) return "imageMessage";
  if (body.video) return "videoMessage";
  if (body.document) return "documentMessage";
  if (body.sticker) return "stickerMessage";
  if (body.location) return "locationMessage";
  if (body.contact) return "contactMessage";
  if (body.reaction) return "reactionMessage";
  if (body.text?.message) return "conversation";
  return "conversation";
}

/**
 * Build Evolution-compatible message object from Z-API payload.
 * The Evolution format uses nested objects like data.message.conversation,
 * data.message.imageMessage, etc.
 */
function buildMessageObject(body: ZApiMessagePayload): Record<string, any> {
  const msg: Record<string, any> = {};

  if (body.text?.message) {
    msg.conversation = body.text.message;
  }

  if (body.image) {
    msg.imageMessage = {
      url: body.image.imageUrl,
      caption: body.image.caption || "",
      mimetype: body.image.mimeType || "image/jpeg",
      thumbnailUrl: body.image.thumbnailUrl,
    };
  }

  if (body.audio) {
    const key = body.audio.ptt ? "audioMessage" : "audioMessage";
    msg[key] = {
      url: body.audio.audioUrl,
      mimetype: body.audio.mimeType || "audio/ogg; codecs=opus",
      ptt: body.audio.ptt || false,
    };
  }

  if (body.video) {
    msg.videoMessage = {
      url: body.video.videoUrl,
      caption: body.video.caption || "",
      mimetype: body.video.mimeType || "video/mp4",
    };
  }

  if (body.document) {
    msg.documentMessage = {
      url: body.document.documentUrl,
      mimetype: body.document.mimeType || "application/octet-stream",
      fileName: body.document.fileName || body.document.title || "document",
      title: body.document.title || body.document.fileName || "document",
      caption: body.document.caption || "",
    };
  }

  if (body.sticker) {
    msg.stickerMessage = {
      url: body.sticker.stickerUrl,
      mimetype: body.sticker.mimeType || "image/webp",
    };
  }

  if (body.location) {
    msg.locationMessage = {
      degreesLatitude: body.location.latitude,
      degreesLongitude: body.location.longitude,
      name: body.location.name || "",
      address: body.location.address || "",
    };
  }

  if (body.contact) {
    msg.contactMessage = {
      displayName: body.contact.displayName || "",
      vcard: body.contact.vCard || "",
    };
  }

  if (body.reaction) {
    msg.reactionMessage = {
      text: body.reaction.value || "",
      key: {
        id: body.reaction.reference,
        remoteJid: toRemoteJid(body.phone, body.chatId, body.isGroup),
      },
    };
  }

  // Add quoted message context if present
  if (body.quotedMessage?.messageId) {
    const msgType = Object.keys(msg)[0];
    if (msgType && msg[msgType] && typeof msg[msgType] === "object") {
      msg[msgType].contextInfo = {
        quotedMessage: {},
        stanzaId: body.quotedMessage.messageId,
      };
    }
  }

  return msg;
}

/**
 * Map Z-API status string to Evolution status number.
 * Evolution uses numeric status: 1=pending, 2=sent/server, 3=delivered, 4=read, 5=played
 */
function mapStatusToNumber(status?: string): number {
  switch (status?.toUpperCase()) {
    case "SENT":
    case "SERVER_ACK":
      return 2; // SERVER_ACK
    case "DELIVERED":
    case "DELIVERY_ACK":
      return 3; // DELIVERY_ACK
    case "READ":
    case "READ_ACK":
      return 4; // READ
    case "PLAYED":
      return 5; // PLAYED
    default:
      return 2;
  }
}

// ════════════════════════════════════════════════════════════
// MAIN NORMALIZER FUNCTION
// ════════════════════════════════════════════════════════════

/**
 * Normalize a Z-API webhook payload into Evolution API WebhookPayload format.
 *
 * @param zapiEvent - The Z-API event type (from route parameter)
 * @param body - The raw Z-API webhook body
 * @param instanceName - The Evolution-compatible instance name (from session mapping)
 * @returns Evolution-compatible WebhookPayload, or null if event should be ignored
 */
export function normalizeZApiWebhook(
  zapiEvent: ZApiWebhookEvent,
  body: ZApiMessagePayload,
  instanceName: string
): WebhookPayload | null {
  // Skip group messages (system already filters these)
  if (body.isGroup) return null;

  // Skip broadcast/newsletter
  if (body.broadcast || body.isNewsletter) return null;

  const evoEvent = mapEventType(zapiEvent);
  const remoteJid = toRemoteJid(body.phone, body.chatId, body.isGroup);
  const timestamp = normalizeToUnixSeconds(body.momment || body.timestamp);

  switch (zapiEvent) {
    case "on-message-received": {
      const messageType = detectMessageType(body);
      const message = buildMessageObject(body);

      return {
        event: "messages.upsert",
        instance: instanceName,
        data: {
          key: {
            remoteJid,
            fromMe: false,
            id: body.messageId || `zapi_${Date.now()}`,
          },
          pushName: body.senderName || body.chatName || "",
          message,
          messageType,
          messageTimestamp: timestamp,
          // Z-API provides direct media URLs (no need for getBase64FromMediaMessage)
          _zapiMediaUrls: {
            imageUrl: body.image?.imageUrl,
            audioUrl: body.audio?.audioUrl,
            videoUrl: body.video?.videoUrl,
            documentUrl: body.document?.documentUrl,
            stickerUrl: body.sticker?.stickerUrl,
          },
        },
      };
    }

    case "on-message-send": {
      const messageType = detectMessageType(body);
      const message = buildMessageObject(body);

      return {
        event: "send.message",
        instance: instanceName,
        data: {
          key: {
            remoteJid,
            fromMe: true,
            id: body.messageId || `zapi_out_${Date.now()}`,
          },
          pushName: "",
          message,
          messageType,
          messageTimestamp: timestamp,
          status: "DELIVERY_ACK",
          _zapiMediaUrls: {
            imageUrl: body.image?.imageUrl,
            audioUrl: body.audio?.audioUrl,
            videoUrl: body.video?.videoUrl,
            documentUrl: body.document?.documentUrl,
            stickerUrl: body.sticker?.stickerUrl,
          },
        },
      };
    }

    case "on-whatsapp-message-status-changes": {
      // Z-API sends status updates with an array of message IDs
      const ids = body.ids || (body.messageId ? [body.messageId] : []);
      if (ids.length === 0) return null;

      // Evolution format for status update expects an array of updates
      const updates = ids.map((id: string) => ({
        key: {
          remoteJid,
          fromMe: true, // Status updates are always for sent messages
          id,
        },
        update: {
          status: mapStatusToNumber(body.status),
        },
      }));

      return {
        event: "messages.update",
        instance: instanceName,
        data: updates.length === 1 ? updates[0] : updates,
      };
    }

    case "on-whatsapp-message-revoked": {
      return {
        event: "messages.delete",
        instance: instanceName,
        data: {
          key: {
            remoteJid,
            fromMe: body.fromMe || false,
            id: body.messageId || "",
          },
        },
      };
    }

    case "on-connection": {
      return {
        event: "connection.update",
        instance: instanceName,
        data: {
          state: body.connected ? "open" : "close",
          status: body.connected ? "open" : "close",
        },
      };
    }

    case "on-disconnect": {
      return {
        event: "connection.update",
        instance: instanceName,
        data: {
          state: "close",
          status: "close",
        },
      };
    }

    default:
      console.warn(`[ZApiNormalizer] Unknown Z-API event: ${zapiEvent}`);
      return null;
  }
}

/**
 * Detect Z-API event type from the webhook URL path.
 * Z-API sends webhooks to URLs like:
 *   /api/webhooks/zapi/:instanceId/on-message-received
 *   /api/webhooks/zapi/:instanceId/on-message-send
 *   etc.
 */
export function detectZApiEventFromPath(path: string): ZApiWebhookEvent {
  if (path.includes("on-message-received")) return "on-message-received";
  if (path.includes("on-message-send")) return "on-message-send";
  if (path.includes("on-whatsapp-message-status-changes")) return "on-whatsapp-message-status-changes";
  if (path.includes("on-whatsapp-message-revoked")) return "on-whatsapp-message-revoked";
  if (path.includes("on-disconnect")) return "on-disconnect";
  if (path.includes("on-connection")) return "on-connection";
  return "unknown";
}

/**
 * Check if a Z-API webhook payload has a valid client-token.
 * Used for webhook authentication.
 */
export function validateZApiClientToken(
  receivedToken: string | undefined,
  expectedToken: string | undefined
): boolean {
  if (!expectedToken) return true; // No token configured = accept all
  if (!receivedToken) return false;
  return receivedToken === expectedToken;
}
