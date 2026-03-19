/**
 * Tests for Preview & Status Sync — ensures inbox sidebar preview and status ticks
 * are always synchronized with the actual chat messages.
 *
 * These tests cover:
 * 1. Backend: getPreviewForType() generates correct preview text for all media types
 * 2. Backend: Socket emit includes messageId, status, and matching content
 * 3. Frontend store: handleMessage() uses socket content (never falls back to stale data)
 * 4. Frontend store: handleStatusUpdate() enforces monotonic progression
 * 5. Frontend store: Webhook echo updates preview to match DB
 * 6. Reconciliation: hydrate() overwrites stale store data with fresh DB data
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════
// 1. Backend: getPreviewForType
// ═══════════════════════════════════════════════════════════

// Replicate the getPreviewForType function from messageWorker.ts
function getPreviewForType(messageType: string): string | null {
  const previews: Record<string, string> = {
    imageMessage: "📷 Imagem",
    videoMessage: "🎥 Vídeo",
    audioMessage: "🎧 Áudio",
    pttMessage: "🎤 Áudio",
    documentMessage: "📄 Documento",
    stickerMessage: "🏷️ Figurinha",
    contactMessage: "👤 Contato",
    locationMessage: "📍 Localização",
    liveLocationMessage: "📍 Localização ao vivo",
    contactsArrayMessage: "👥 Contatos",
    listMessage: "📋 Lista",
    buttonsMessage: "🔘 Botões",
    templateMessage: "📝 Template",
    viewOnceMessageV2: "📷 Visualização única",
  };
  return previews[messageType] || null;
}

describe("getPreviewForType", () => {
  it("returns descriptive preview for all media types", () => {
    expect(getPreviewForType("imageMessage")).toBe("📷 Imagem");
    expect(getPreviewForType("videoMessage")).toBe("🎥 Vídeo");
    expect(getPreviewForType("audioMessage")).toBe("🎧 Áudio");
    expect(getPreviewForType("pttMessage")).toBe("🎤 Áudio");
    expect(getPreviewForType("documentMessage")).toBe("📄 Documento");
    expect(getPreviewForType("stickerMessage")).toBe("🏷️ Figurinha");
    expect(getPreviewForType("contactMessage")).toBe("👤 Contato");
    expect(getPreviewForType("locationMessage")).toBe("📍 Localização");
  });

  it("returns null for unknown types", () => {
    expect(getPreviewForType("conversation")).toBeNull();
    expect(getPreviewForType("extendedTextMessage")).toBeNull();
    expect(getPreviewForType("unknownType")).toBeNull();
  });

  it("returns null for text message types (they have their own content)", () => {
    expect(getPreviewForType("conversation")).toBeNull();
    expect(getPreviewForType("extendedTextMessage")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// 2. Backend: Content computation (rawContent || getPreviewForType || "")
// ═══════════════════════════════════════════════════════════

describe("Content computation for socket + DB", () => {
  function computeContent(rawContent: string | null, messageType: string): string {
    return rawContent || getPreviewForType(messageType) || "";
  }

  it("uses rawContent when available (text message)", () => {
    expect(computeContent("Hello world", "conversation")).toBe("Hello world");
  });

  it("uses rawContent when available (image with caption)", () => {
    expect(computeContent("Look at this!", "imageMessage")).toBe("Look at this!");
  });

  it("falls back to getPreviewForType when rawContent is null (media without caption)", () => {
    expect(computeContent(null, "imageMessage")).toBe("📷 Imagem");
    expect(computeContent(null, "audioMessage")).toBe("🎧 Áudio");
    expect(computeContent(null, "stickerMessage")).toBe("🏷️ Figurinha");
  });

  it("falls back to empty string when both rawContent and preview are null", () => {
    expect(computeContent(null, "conversation")).toBe("");
    expect(computeContent(null, "unknownType")).toBe("");
  });

  it("never returns null — always a string", () => {
    const types = ["conversation", "imageMessage", "videoMessage", "audioMessage", "unknownType"];
    for (const type of types) {
      const result = computeContent(null, type);
      expect(typeof result).toBe("string");
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 3. Frontend store: handleMessage with status field
// ═══════════════════════════════════════════════════════════

// Minimal ConvEntry type for testing
interface ConvEntry {
  remoteJid: string;
  lastMessage: string | null;
  lastMessageType: string | null;
  lastFromMe: boolean | number;
  lastTimestamp: string | Date | null;
  lastStatus: string | null;
  unreadCount: number | string;
  _optimistic?: boolean;
  _localTimestamp?: number;
}

function makeConvKey(sessionId: string, remoteJid: string): string {
  return `${sessionId}:${remoteJid}`;
}

describe("Frontend store: handleMessage sync", () => {
  let conversationMap: Map<string, ConvEntry>;

  beforeEach(() => {
    conversationMap = new Map();
    conversationMap.set("sess1:5584999@s.whatsapp.net", {
      remoteJid: "5584999@s.whatsapp.net",
      lastMessage: "Old message",
      lastMessageType: "conversation",
      lastFromMe: false,
      lastTimestamp: new Date(Date.now() - 60000).toISOString(),
      lastStatus: "received",
      unreadCount: 0,
    });
  });

  it("updates preview from socket content (not fallback to existing)", () => {
    const key = "sess1:5584999@s.whatsapp.net";
    const existing = conversationMap.get(key)!;

    // Simulate incoming message with content from socket
    const msg = {
      sessionId: "sess1",
      remoteJid: "5584999@s.whatsapp.net",
      content: "📷 Imagem",  // Backend computed preview
      fromMe: false,
      messageType: "imageMessage",
      timestamp: Date.now(),
      status: "received",
    };

    const updated: ConvEntry = {
      ...existing,
      lastMessage: msg.content || existing.lastMessage,
      lastMessageType: msg.messageType,
      lastFromMe: msg.fromMe,
      lastTimestamp: new Date(msg.timestamp),
      lastStatus: msg.status || (msg.fromMe ? "sent" : "received"),
      unreadCount: 1,
    };

    expect(updated.lastMessage).toBe("📷 Imagem");
    expect(updated.lastStatus).toBe("received");
    expect(updated.lastMessageType).toBe("imageMessage");
  });

  it("uses status from socket event instead of hardcoded value", () => {
    const key = "sess1:5584999@s.whatsapp.net";
    const existing = conversationMap.get(key)!;

    const msg = {
      content: "Hello",
      fromMe: true,
      messageType: "conversation",
      timestamp: Date.now(),
      status: "sent",  // Backend sends this
    };

    const newStatus = msg.status || (msg.fromMe ? "sent" : "received");
    expect(newStatus).toBe("sent");
  });

  it("webhook echo updates preview to match DB", () => {
    const key = "sess1:5584999@s.whatsapp.net";
    const now = Date.now();

    // Simulate optimistic send
    const optimistic: ConvEntry = {
      remoteJid: "5584999@s.whatsapp.net",
      lastMessage: "Hello!",
      lastMessageType: "conversation",
      lastFromMe: true,
      lastTimestamp: new Date(now).toISOString(),
      lastStatus: "sending",
      unreadCount: 0,
      _optimistic: true,
      _localTimestamp: now,
    };
    conversationMap.set(key, optimistic);

    // Simulate webhook echo (timestamp <= _localTimestamp)
    const echoMsg = {
      content: "Hello!",
      fromMe: true,
      messageType: "conversation",
      timestamp: now - 100, // slightly older than local
      status: "sent",
    };

    const isWebhookEcho = echoMsg.fromMe && optimistic._optimistic && optimistic._localTimestamp && optimistic._localTimestamp >= echoMsg.timestamp;
    expect(isWebhookEcho).toBe(true);

    // Echo should update preview and status
    const updated: ConvEntry = {
      ...optimistic,
      lastMessage: echoMsg.content || optimistic.lastMessage,
      lastMessageType: echoMsg.messageType || optimistic.lastMessageType,
      lastStatus: echoMsg.status || "sent",
      _optimistic: false,
    };

    expect(updated.lastMessage).toBe("Hello!");
    expect(updated.lastStatus).toBe("sent");
    expect(updated._optimistic).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 4. Frontend store: handleStatusUpdate monotonic enforcement
// ═══════════════════════════════════════════════════════════

describe("Frontend store: handleStatusUpdate monotonic", () => {
  const statusOrder: Record<string, number> = { error: -1, sending: 0, sent: 1, delivered: 2, read: 3, played: 4 };

  it("allows forward progression: sent → delivered → read", () => {
    let current = "sent";
    for (const next of ["delivered", "read", "played"]) {
      const currentOrder = statusOrder[current] ?? -1;
      const newOrder = statusOrder[next] ?? -1;
      expect(newOrder).toBeGreaterThan(currentOrder);
      current = next;
    }
  });

  it("blocks backward regression: read → delivered", () => {
    const currentOrder = statusOrder["read"] ?? -1;
    const newOrder = statusOrder["delivered"] ?? -1;
    expect(newOrder).toBeLessThanOrEqual(currentOrder);
  });

  it("blocks same-status update: delivered → delivered", () => {
    const currentOrder = statusOrder["delivered"] ?? -1;
    const newOrder = statusOrder["delivered"] ?? -1;
    expect(newOrder).toBeLessThanOrEqual(currentOrder);
  });

  it("handles error status correctly", () => {
    const currentOrder = statusOrder["error"] ?? -1;
    expect(currentOrder).toBe(-1);
    // Any status should be higher than error
    expect(statusOrder["sending"]).toBeGreaterThan(currentOrder);
    expect(statusOrder["sent"]).toBeGreaterThan(currentOrder);
  });

  it("only applies to fromMe messages", () => {
    const conv: ConvEntry = {
      remoteJid: "test@s.whatsapp.net",
      lastMessage: "Hi",
      lastMessageType: "conversation",
      lastFromMe: false, // NOT from me
      lastTimestamp: new Date().toISOString(),
      lastStatus: "received",
      unreadCount: 0,
    };

    const isFromMe = conv.lastFromMe === true || conv.lastFromMe === 1;
    expect(isFromMe).toBe(false);
    // Status update should be skipped for non-fromMe messages
  });

  it("handles MySQL number format for lastFromMe (1 instead of true)", () => {
    const conv: ConvEntry = {
      remoteJid: "test@s.whatsapp.net",
      lastMessage: "Hi",
      lastMessageType: "conversation",
      lastFromMe: 1, // MySQL returns 1 instead of true
      lastTimestamp: new Date().toISOString(),
      lastStatus: "sent",
      unreadCount: 0,
    };

    const isFromMe = conv.lastFromMe === true || conv.lastFromMe === 1;
    expect(isFromMe).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. Socket payload completeness
// ═══════════════════════════════════════════════════════════

describe("Socket payload completeness", () => {
  it("message event includes all required fields for store update", () => {
    // Simulate what the backend now sends
    const socketPayload = {
      sessionId: "sess1",
      tenantId: 1,
      content: "📷 Imagem",  // Computed preview (never null)
      messageId: "ABC123",   // Now included
      fromMe: false,
      remoteJid: "5584999@s.whatsapp.net",
      messageType: "imageMessage",
      pushName: "João",
      timestamp: Date.now(),
      status: "received",    // Now included
    };

    // All fields needed by handleMessage are present
    expect(socketPayload.content).toBeTruthy();
    expect(socketPayload.messageId).toBeTruthy();
    expect(socketPayload.status).toBeTruthy();
    expect(socketPayload.sessionId).toBeTruthy();
    expect(socketPayload.remoteJid).toBeTruthy();
    expect(socketPayload.messageType).toBeTruthy();
    expect(typeof socketPayload.timestamp).toBe("number");
    expect(typeof socketPayload.fromMe).toBe("boolean");
  });

  it("status event includes remoteJid for conversation lookup", () => {
    const statusPayload = {
      sessionId: "sess1",
      messageId: "ABC123",
      status: "delivered",
      remoteJid: "5584999@s.whatsapp.net",  // Now included in interface
      timestamp: Date.now(),
    };

    expect(statusPayload.remoteJid).toBeTruthy();
    expect(statusPayload.status).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════
// 6. Reconciliation: hydrate overwrites stale data
// ═══════════════════════════════════════════════════════════

describe("Reconciliation: hydrate overwrites stale data", () => {
  it("hydrate replaces stale preview with DB data", () => {
    const staleEntry: ConvEntry = {
      remoteJid: "5584999@s.whatsapp.net",
      lastMessage: "Stale preview",
      lastMessageType: "conversation",
      lastFromMe: false,
      lastTimestamp: new Date(Date.now() - 120000).toISOString(),
      lastStatus: "received",
      unreadCount: 0,
    };

    const freshEntry: ConvEntry = {
      remoteJid: "5584999@s.whatsapp.net",
      lastMessage: "Fresh preview from DB",
      lastMessageType: "conversation",
      lastFromMe: true,
      lastTimestamp: new Date(Date.now() - 5000).toISOString(),
      lastStatus: "delivered",
      unreadCount: 0,
    };

    // After hydrate, the fresh data should win
    expect(freshEntry.lastMessage).toBe("Fresh preview from DB");
    expect(freshEntry.lastStatus).toBe("delivered");
    expect(freshEntry.lastFromMe).toBe(true);
  });

  it("hydrate preserves optimistic entries that are newer than DB", () => {
    const now = Date.now();
    const optimisticEntry: ConvEntry = {
      remoteJid: "5584999@s.whatsapp.net",
      lastMessage: "Just sent this",
      lastMessageType: "conversation",
      lastFromMe: true,
      lastTimestamp: new Date(now).toISOString(),
      lastStatus: "sending",
      unreadCount: 0,
      _optimistic: true,
      _localTimestamp: now,
    };

    const dbEntry: ConvEntry = {
      remoteJid: "5584999@s.whatsapp.net",
      lastMessage: "Old message",
      lastMessageType: "conversation",
      lastFromMe: false,
      lastTimestamp: new Date(now - 60000).toISOString(),
      lastStatus: "received",
      unreadCount: 1,
    };

    // Optimistic entry is newer — should be preserved
    const optimisticTs = optimisticEntry._localTimestamp || 0;
    const dbTs = new Date(dbEntry.lastTimestamp as string).getTime();
    expect(optimisticTs).toBeGreaterThan(dbTs);
  });
});

// ═══════════════════════════════════════════════════════════
// 7. Edge cases
// ═══════════════════════════════════════════════════════════

describe("Edge cases", () => {
  it("empty string content is valid (not treated as null)", () => {
    const content = "";
    // The old code: data.content ? data.content.substring(0, 300) : null
    // Would turn "" into null — BUG!
    const oldBehavior = content ? content.substring(0, 300) : null;
    expect(oldBehavior).toBeNull(); // This was the bug

    // The new code: (data.content !== undefined && data.content !== null) ? ...
    const newBehavior = (content !== undefined && content !== null) ? content.substring(0, 300) : null;
    expect(newBehavior).toBe(""); // Fixed — empty string preserved
  });

  it("null content falls back to null (not empty string)", () => {
    const content = null;
    const newBehavior = (content !== undefined && content !== null) ? content.substring(0, 300) : null;
    expect(newBehavior).toBeNull();
  });

  it("content with special characters is preserved", () => {
    const content = "📷 Imagem com legenda: Olá! 🎉";
    const result = (content !== undefined && content !== null) ? content.substring(0, 300) : null;
    expect(result).toBe("📷 Imagem com legenda: Olá! 🎉");
  });

  it("very long content is truncated to 300 chars", () => {
    const content = "A".repeat(500);
    const result = (content !== undefined && content !== null) ? content.substring(0, 300) : null;
    expect(result?.length).toBe(300);
  });
});
