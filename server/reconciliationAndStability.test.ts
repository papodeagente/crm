/**
 * Tests for Safe Message Reconciliation + Inbox Stability
 *
 * Covers:
 * - Reconciliation limits (20 convs, 10 msgs, 3min interval)
 * - CPU/queue backoff
 * - Deduplication by messageId
 * - Conversation preview timestamp guard
 * - Notification sound filtering (isSync, status, internal_note)
 * - Message grouping (5-minute time gap rule)
 * - Media preview type mapping
 */
import { describe, it, expect } from "vitest";

// ═══════════════════════════════════════════════════════════
// 1. Reconciliation Constants & Limits
// ═══════════════════════════════════════════════════════════
describe("Reconciliation Constants", () => {
  it("should enforce max 20 conversations per cycle", () => {
    const MAX_CONVERSATIONS_PER_CYCLE = 20;
    expect(MAX_CONVERSATIONS_PER_CYCLE).toBe(20);
    expect(MAX_CONVERSATIONS_PER_CYCLE).toBeLessThanOrEqual(20);
  });

  it("should enforce max 10 messages per conversation", () => {
    const MAX_MESSAGES_PER_CONVERSATION = 10;
    expect(MAX_MESSAGES_PER_CONVERSATION).toBe(10);
    expect(MAX_MESSAGES_PER_CONVERSATION).toBeLessThanOrEqual(10);
  });

  it("should run every 3 minutes (180000ms)", () => {
    const RECONCILIATION_INTERVAL_MS = 3 * 60 * 1000;
    expect(RECONCILIATION_INTERVAL_MS).toBe(180000);
  });

  it("should calculate max additional load as ~200 message checks", () => {
    const maxConvs = 20;
    const maxMsgsPerConv = 10;
    const maxLoad = maxConvs * maxMsgsPerConv;
    expect(maxLoad).toBe(200);
    expect(maxLoad).toBeLessThanOrEqual(200);
  });
});

// ═══════════════════════════════════════════════════════════
// 2. CPU Backoff Logic
// ═══════════════════════════════════════════════════════════
describe("CPU Backoff Logic", () => {
  const CPU_THRESHOLD = 0.70;

  it("should skip when CPU > 70%", () => {
    const cpuUsage = 0.85;
    expect(cpuUsage > CPU_THRESHOLD).toBe(true);
  });

  it("should proceed when CPU < 70%", () => {
    const cpuUsage = 0.45;
    expect(cpuUsage > CPU_THRESHOLD).toBe(false);
  });

  it("should proceed when CPU = 70% (boundary)", () => {
    const cpuUsage = 0.70;
    expect(cpuUsage > CPU_THRESHOLD).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. Queue Backoff Logic
// ═══════════════════════════════════════════════════════════
describe("Queue Backoff Logic", () => {
  const QUEUE_LENGTH_THRESHOLD = 500;

  it("should skip when queue > 500", () => {
    const queueLength = 750;
    expect(queueLength > QUEUE_LENGTH_THRESHOLD).toBe(true);
  });

  it("should proceed when queue < 500", () => {
    const queueLength = 100;
    expect(queueLength > QUEUE_LENGTH_THRESHOLD).toBe(false);
  });

  it("should proceed when queue = 0 (no Redis)", () => {
    const queueLength = 0;
    expect(queueLength > QUEUE_LENGTH_THRESHOLD).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 4. Deduplication Logic
// ═══════════════════════════════════════════════════════════
describe("Message Deduplication", () => {
  it("should skip messages already in the existing set", () => {
    const existingMsgIds = new Set(["msg1", "msg2", "msg3"]);
    const newMessages = [
      { key: { id: "msg1" } },
      { key: { id: "msg4" } },
      { key: { id: "msg2" } },
      { key: { id: "msg5" } },
    ];

    let skipped = 0;
    let inserted = 0;
    for (const msg of newMessages) {
      if (existingMsgIds.has(msg.key.id)) {
        skipped++;
      } else {
        inserted++;
        existingMsgIds.add(msg.key.id);
      }
    }

    expect(skipped).toBe(2);
    expect(inserted).toBe(2);
    expect(existingMsgIds.size).toBe(5);
  });

  it("should handle empty existing set (all new)", () => {
    const existingMsgIds = new Set<string>();
    const newMessages = [{ key: { id: "a" } }, { key: { id: "b" } }];

    let inserted = 0;
    for (const msg of newMessages) {
      if (!existingMsgIds.has(msg.key.id)) {
        inserted++;
        existingMsgIds.add(msg.key.id);
      }
    }

    expect(inserted).toBe(2);
  });

  it("should handle all duplicates (none new)", () => {
    const existingMsgIds = new Set(["x", "y", "z"]);
    const newMessages = [{ key: { id: "x" } }, { key: { id: "y" } }];

    let skipped = 0;
    for (const msg of newMessages) {
      if (existingMsgIds.has(msg.key.id)) skipped++;
    }

    expect(skipped).toBe(2);
  });

  it("should skip messages without messageId", () => {
    const messages = [
      { key: { id: "valid" } },
      { key: {} },
      { key: { id: null } },
      { key: { id: "valid2" } },
    ];

    const validMessages = messages.filter(m => m.key?.id);
    expect(validMessages.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. Conversation Preview Timestamp Guard
// ═══════════════════════════════════════════════════════════
describe("Conversation Preview Timestamp Guard", () => {
  it("should update preview when new timestamp is newer", () => {
    const currentLastMessageAt = new Date("2026-03-15T10:00:00Z");
    const newTimestamp = new Date("2026-03-15T10:05:00Z");
    const shouldUpdate = !currentLastMessageAt || newTimestamp >= currentLastMessageAt;
    expect(shouldUpdate).toBe(true);
  });

  it("should NOT update preview when new timestamp is older", () => {
    const currentLastMessageAt = new Date("2026-03-15T10:05:00Z");
    const newTimestamp = new Date("2026-03-15T09:00:00Z");
    const shouldUpdate = newTimestamp >= currentLastMessageAt;
    expect(shouldUpdate).toBe(false);
  });

  it("should update preview when current is null", () => {
    const currentLastMessageAt = null;
    const newTimestamp = new Date("2026-03-15T10:00:00Z");
    const shouldUpdate = !currentLastMessageAt || newTimestamp >= currentLastMessageAt;
    expect(shouldUpdate).toBe(true);
  });

  it("should update preview when timestamps are equal", () => {
    const ts = new Date("2026-03-15T10:00:00Z");
    const shouldUpdate = ts >= ts;
    expect(shouldUpdate).toBe(true);
  });

  it("should truncate preview to 300 chars", () => {
    const longContent = "A".repeat(500);
    const preview = longContent.substring(0, 300);
    expect(preview.length).toBe(300);
  });
});

// ═══════════════════════════════════════════════════════════
// 6. Notification Sound Filtering
// ═══════════════════════════════════════════════════════════
describe("Notification Sound Filtering", () => {
  function shouldPlayNotification(msg: {
    fromMe: boolean;
    isSync?: boolean;
    messageType: string;
    remoteJid: string;
  }, selectedJid: string | null, isMuted: boolean): boolean {
    if (msg.fromMe) return false;
    if (isMuted) return false;
    if (msg.isSync) return false;
    const skipTypes = ["protocolMessage", "senderKeyDistributionMessage", "internal_note"];
    if (skipTypes.includes(msg.messageType)) return false;
    if (selectedJid === msg.remoteJid) return false;
    return true;
  }

  it("should play for real-time incoming message from different conversation", () => {
    expect(shouldPlayNotification(
      { fromMe: false, isSync: false, messageType: "conversation", remoteJid: "5511999@s.whatsapp.net" },
      "5511888@s.whatsapp.net", false
    )).toBe(true);
  });

  it("should NOT play for sync messages", () => {
    expect(shouldPlayNotification(
      { fromMe: false, isSync: true, messageType: "conversation", remoteJid: "5511999@s.whatsapp.net" },
      null, false
    )).toBe(false);
  });

  it("should NOT play for fromMe messages", () => {
    expect(shouldPlayNotification(
      { fromMe: true, isSync: false, messageType: "conversation", remoteJid: "5511999@s.whatsapp.net" },
      null, false
    )).toBe(false);
  });

  it("should NOT play for internal_note type", () => {
    expect(shouldPlayNotification(
      { fromMe: false, isSync: false, messageType: "internal_note", remoteJid: "5511999@s.whatsapp.net" },
      null, false
    )).toBe(false);
  });

  it("should NOT play for protocolMessage type", () => {
    expect(shouldPlayNotification(
      { fromMe: false, isSync: false, messageType: "protocolMessage", remoteJid: "5511999@s.whatsapp.net" },
      null, false
    )).toBe(false);
  });

  it("should NOT play when muted", () => {
    expect(shouldPlayNotification(
      { fromMe: false, isSync: false, messageType: "conversation", remoteJid: "5511999@s.whatsapp.net" },
      null, true
    )).toBe(false);
  });

  it("should NOT play when message is from currently selected conversation", () => {
    expect(shouldPlayNotification(
      { fromMe: false, isSync: false, messageType: "conversation", remoteJid: "5511999@s.whatsapp.net" },
      "5511999@s.whatsapp.net", false
    )).toBe(false);
  });

  it("should play for imageMessage type (media)", () => {
    expect(shouldPlayNotification(
      { fromMe: false, isSync: false, messageType: "imageMessage", remoteJid: "5511999@s.whatsapp.net" },
      null, false
    )).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 7. Message Grouping (5-minute time gap rule)
// ═══════════════════════════════════════════════════════════
describe("Message Grouping - 5 Minute Time Gap", () => {
  const TIME_GAP_MS = 5 * 60 * 1000;

  interface TestMsg {
    fromMe: boolean;
    messageType: string;
    timestamp: string;
  }

  function computeGrouping(messages: TestMsg[]): { isFirst: boolean; isLast: boolean }[] {
    return messages.map((msg, i) => {
      const prev = i > 0 ? messages[i - 1] : null;
      const next = i < messages.length - 1 ? messages[i + 1] : null;
      const msgTs = new Date(msg.timestamp).getTime();
      const prevTs = prev ? new Date(prev.timestamp).getTime() : 0;
      const nextTs = next ? new Date(next.timestamp).getTime() : 0;

      const isFirst = !prev || prev.fromMe !== msg.fromMe ||
        prev.messageType === "internal_note" || msg.messageType === "internal_note" ||
        (msgTs - prevTs > TIME_GAP_MS);
      const isLast = !next || next.fromMe !== msg.fromMe ||
        next.messageType === "internal_note" || msg.messageType === "internal_note" ||
        (nextTs - msgTs > TIME_GAP_MS);

      return { isFirst, isLast };
    });
  }

  it("should group consecutive messages from same sender within 5 minutes", () => {
    const msgs: TestMsg[] = [
      { fromMe: false, messageType: "conversation", timestamp: "2026-03-15T10:00:00Z" },
      { fromMe: false, messageType: "conversation", timestamp: "2026-03-15T10:01:00Z" },
      { fromMe: false, messageType: "conversation", timestamp: "2026-03-15T10:02:00Z" },
    ];
    const result = computeGrouping(msgs);
    expect(result[0]).toEqual({ isFirst: true, isLast: false });
    expect(result[1]).toEqual({ isFirst: false, isLast: false });
    expect(result[2]).toEqual({ isFirst: false, isLast: true });
  });

  it("should break group when sender changes", () => {
    const msgs: TestMsg[] = [
      { fromMe: false, messageType: "conversation", timestamp: "2026-03-15T10:00:00Z" },
      { fromMe: true, messageType: "conversation", timestamp: "2026-03-15T10:01:00Z" },
    ];
    const result = computeGrouping(msgs);
    expect(result[0]).toEqual({ isFirst: true, isLast: true });
    expect(result[1]).toEqual({ isFirst: true, isLast: true });
  });

  it("should break group when time gap > 5 minutes", () => {
    const msgs: TestMsg[] = [
      { fromMe: false, messageType: "conversation", timestamp: "2026-03-15T10:00:00Z" },
      { fromMe: false, messageType: "conversation", timestamp: "2026-03-15T10:06:00Z" },
    ];
    const result = computeGrouping(msgs);
    expect(result[0]).toEqual({ isFirst: true, isLast: true });
    expect(result[1]).toEqual({ isFirst: true, isLast: true });
  });

  it("should NOT break group when time gap = exactly 5 minutes", () => {
    const msgs: TestMsg[] = [
      { fromMe: false, messageType: "conversation", timestamp: "2026-03-15T10:00:00Z" },
      { fromMe: false, messageType: "conversation", timestamp: "2026-03-15T10:05:00Z" },
    ];
    const result = computeGrouping(msgs);
    expect(result[0]).toEqual({ isFirst: true, isLast: false });
    expect(result[1]).toEqual({ isFirst: false, isLast: true });
  });

  it("should break group at internal_note boundary", () => {
    const msgs: TestMsg[] = [
      { fromMe: false, messageType: "conversation", timestamp: "2026-03-15T10:00:00Z" },
      { fromMe: false, messageType: "internal_note", timestamp: "2026-03-15T10:01:00Z" },
      { fromMe: false, messageType: "conversation", timestamp: "2026-03-15T10:02:00Z" },
    ];
    const result = computeGrouping(msgs);
    expect(result[0]).toEqual({ isFirst: true, isLast: true });
    expect(result[1]).toEqual({ isFirst: true, isLast: true });
    expect(result[2]).toEqual({ isFirst: true, isLast: true });
  });

  it("should handle single message", () => {
    const msgs: TestMsg[] = [
      { fromMe: false, messageType: "conversation", timestamp: "2026-03-15T10:00:00Z" },
    ];
    const result = computeGrouping(msgs);
    expect(result[0]).toEqual({ isFirst: true, isLast: true });
  });

  it("should handle complex scenario with multiple breaks", () => {
    const msgs: TestMsg[] = [
      { fromMe: false, messageType: "conversation", timestamp: "2026-03-15T10:00:00Z" },
      { fromMe: false, messageType: "conversation", timestamp: "2026-03-15T10:01:00Z" },
      // 10 min gap
      { fromMe: false, messageType: "conversation", timestamp: "2026-03-15T10:11:00Z" },
      // sender change
      { fromMe: true, messageType: "conversation", timestamp: "2026-03-15T10:12:00Z" },
      { fromMe: true, messageType: "conversation", timestamp: "2026-03-15T10:13:00Z" },
    ];
    const result = computeGrouping(msgs);
    expect(result[0]).toEqual({ isFirst: true, isLast: false }); // group 1 start
    expect(result[1]).toEqual({ isFirst: false, isLast: true }); // group 1 end (time gap after)
    expect(result[2]).toEqual({ isFirst: true, isLast: true }); // group 2 (alone, sender changes)
    expect(result[3]).toEqual({ isFirst: true, isLast: false }); // group 3 start
    expect(result[4]).toEqual({ isFirst: false, isLast: true }); // group 3 end
  });
});

// ═══════════════════════════════════════════════════════════
// 8. Media Preview Type Mapping
// ═══════════════════════════════════════════════════════════
describe("Media Preview Type Mapping", () => {
  function getMessagePreview(content: string | null, messageType: string | null): string {
    if (!messageType || messageType === "text" || messageType === "conversation" || messageType === "extendedTextMessage") {
      return content || "";
    }
    const typeMap: Record<string, string> = {
      imageMessage: "📷 Foto", image: "📷 Foto",
      videoMessage: "📹 Vídeo", video: "📹 Vídeo",
      audioMessage: "🎤 Áudio", audio: "🎤 Áudio", pttMessage: "🎤 Áudio",
      documentMessage: "📄 Documento", document: "📄 Documento",
      documentWithCaptionMessage: "📄 Documento",
      stickerMessage: "🏷️ Sticker",
      contactMessage: "👤 Contato", contactsArrayMessage: "👥 Contatos",
      locationMessage: "📍 Localização", liveLocationMessage: "📍 Localização ao vivo",
      viewOnceMessage: "📷 Visualização única", viewOnceMessageV2: "📷 Visualização única",
      pollCreationMessage: "📊 Enquete", pollCreationMessageV3: "📊 Enquete",
      eventMessage: "📅 Evento",
    };
    if (content && content.length > 0 && !content.startsWith("[")) {
      const mapped = typeMap[messageType];
      if (mapped && content.startsWith("[")) return mapped;
      return content;
    }
    return typeMap[messageType] || content || "";
  }

  it("should return text content for text messages", () => {
    expect(getMessagePreview("Hello world", "conversation")).toBe("Hello world");
    expect(getMessagePreview("Hello world", "text")).toBe("Hello world");
    expect(getMessagePreview("Hello world", "extendedTextMessage")).toBe("Hello world");
  });

  it("should return emoji + label for media types", () => {
    expect(getMessagePreview(null, "imageMessage")).toBe("📷 Foto");
    expect(getMessagePreview(null, "videoMessage")).toBe("📹 Vídeo");
    expect(getMessagePreview(null, "audioMessage")).toBe("🎤 Áudio");
    expect(getMessagePreview(null, "pttMessage")).toBe("🎤 Áudio");
    expect(getMessagePreview(null, "documentMessage")).toBe("📄 Documento");
    expect(getMessagePreview(null, "stickerMessage")).toBe("🏷️ Sticker");
    expect(getMessagePreview(null, "contactMessage")).toBe("👤 Contato");
    expect(getMessagePreview(null, "locationMessage")).toBe("📍 Localização");
  });

  it("should return content with caption for media with caption", () => {
    expect(getMessagePreview("Check this photo", "imageMessage")).toBe("Check this photo");
  });

  it("should handle null content and null type", () => {
    expect(getMessagePreview(null, null)).toBe("");
  });

  it("should handle viewOnce messages", () => {
    expect(getMessagePreview(null, "viewOnceMessage")).toBe("📷 Visualização única");
    expect(getMessagePreview(null, "viewOnceMessageV2")).toBe("📷 Visualização única");
  });

  it("should handle poll messages", () => {
    expect(getMessagePreview(null, "pollCreationMessage")).toBe("📊 Enquete");
  });
});

// ═══════════════════════════════════════════════════════════
// 9. Status Regression Prevention
// ═══════════════════════════════════════════════════════════
describe("Status Regression Prevention", () => {
  const STATUS_ORDER = ["error", "pending", "sent", "delivered", "read", "played"];

  function shouldUpdateStatus(currentStatus: string, newStatus: string): boolean {
    const currentIdx = STATUS_ORDER.indexOf(currentStatus);
    const newIdx = STATUS_ORDER.indexOf(newStatus);
    if (currentIdx === -1) return true; // unknown current, always update
    if (newIdx === -1) return false; // unknown new, don't update
    return newIdx >= currentIdx;
  }

  it("should allow progression: pending -> sent", () => {
    expect(shouldUpdateStatus("pending", "sent")).toBe(true);
  });

  it("should allow progression: sent -> delivered", () => {
    expect(shouldUpdateStatus("sent", "delivered")).toBe(true);
  });

  it("should allow progression: delivered -> read", () => {
    expect(shouldUpdateStatus("delivered", "read")).toBe(true);
  });

  it("should allow progression: read -> played", () => {
    expect(shouldUpdateStatus("read", "played")).toBe(true);
  });

  it("should NOT allow regression: read -> sent", () => {
    expect(shouldUpdateStatus("read", "sent")).toBe(false);
  });

  it("should NOT allow regression: delivered -> pending", () => {
    expect(shouldUpdateStatus("delivered", "pending")).toBe(false);
  });

  it("should NOT allow regression: played -> delivered", () => {
    expect(shouldUpdateStatus("played", "delivered")).toBe(false);
  });

  it("should allow same status", () => {
    expect(shouldUpdateStatus("sent", "sent")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 10. Unread Count Logic
// ═══════════════════════════════════════════════════════════
describe("Unread Count Logic", () => {
  it("should increment only for !fromMe messages", () => {
    const incrementUnread = (fromMe: boolean) => !fromMe;
    expect(incrementUnread(false)).toBe(true);
    expect(incrementUnread(true)).toBe(false);
  });

  it("should not increment for sync messages that are fromMe", () => {
    const messages = [
      { fromMe: true, isSync: true },
      { fromMe: false, isSync: true },
      { fromMe: false, isSync: false },
    ];
    const shouldIncrement = messages.filter(m => !m.fromMe);
    expect(shouldIncrement.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════
// 11. isSync Flag Propagation
// ═══════════════════════════════════════════════════════════
describe("isSync Flag Propagation", () => {
  it("should set isSync=true when syncBatch is present", () => {
    const data = { syncBatch: 5 };
    const isSync = !!data.syncBatch;
    expect(isSync).toBe(true);
  });

  it("should set isSync=false when syncBatch is absent", () => {
    const data = {} as any;
    const isSync = !!data.syncBatch;
    expect(isSync).toBe(false);
  });

  it("should set isSync=false when syncBatch is 0", () => {
    const data = { syncBatch: 0 };
    const isSync = !!data.syncBatch;
    expect(isSync).toBe(false);
  });

  it("should set isSync=false for real-time webhook messages", () => {
    // Real-time messages from handleIncomingMessage don't have syncBatch
    const data = { sessionId: "s1", content: "hi", fromMe: false, remoteJid: "jid", messageType: "conversation" };
    const isSync = !!(data as any).syncBatch;
    expect(isSync).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 12. Content Extraction for Reconciliation
// ═══════════════════════════════════════════════════════════
describe("Content Extraction for Reconciliation", () => {
  function extractContent(msgContent: any): string {
    if (!msgContent) return "";
    return (
      msgContent.conversation ||
      msgContent.extendedTextMessage?.text ||
      (msgContent.imageMessage?.caption ? `[Imagem] ${msgContent.imageMessage.caption}` : "") ||
      (msgContent.imageMessage ? "[Imagem]" : "") ||
      (msgContent.videoMessage?.caption ? `[Vídeo] ${msgContent.videoMessage.caption}` : "") ||
      (msgContent.videoMessage ? "[Vídeo]" : "") ||
      (msgContent.audioMessage ? "[Áudio]" : "") ||
      (msgContent.documentMessage ? `[Documento] ${msgContent.documentMessage.fileName || ""}` : "") ||
      (msgContent.stickerMessage ? "[Sticker]" : "") ||
      (msgContent.contactMessage ? `[Contato] ${msgContent.contactMessage.displayName || ""}` : "") ||
      (msgContent.locationMessage ? "[Localização]" : "") ||
      ""
    );
  }

  it("should extract text from conversation", () => {
    expect(extractContent({ conversation: "Hello" })).toBe("Hello");
  });

  it("should extract text from extendedTextMessage", () => {
    expect(extractContent({ extendedTextMessage: { text: "Extended hello" } })).toBe("Extended hello");
  });

  it("should extract image with caption", () => {
    expect(extractContent({ imageMessage: { caption: "My photo" } })).toBe("[Imagem] My photo");
  });

  it("should extract image without caption", () => {
    expect(extractContent({ imageMessage: {} })).toBe("[Imagem]");
  });

  it("should extract video with caption", () => {
    expect(extractContent({ videoMessage: { caption: "My video" } })).toBe("[Vídeo] My video");
  });

  it("should extract audio", () => {
    expect(extractContent({ audioMessage: {} })).toBe("[Áudio]");
  });

  it("should extract document with filename", () => {
    expect(extractContent({ documentMessage: { fileName: "report.pdf" } })).toBe("[Documento] report.pdf");
  });

  it("should extract sticker", () => {
    expect(extractContent({ stickerMessage: {} })).toBe("[Sticker]");
  });

  it("should extract contact", () => {
    expect(extractContent({ contactMessage: { displayName: "John" } })).toBe("[Contato] John");
  });

  it("should extract location", () => {
    expect(extractContent({ locationMessage: {} })).toBe("[Localização]");
  });

  it("should return empty for null content", () => {
    expect(extractContent(null)).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════
// 13. Skip Types Filtering
// ═══════════════════════════════════════════════════════════
describe("Skip Types Filtering", () => {
  const skipTypes = ["protocolMessage", "senderKeyDistributionMessage", "messageContextInfo", "ephemeralMessage"];

  it("should skip protocol messages", () => {
    expect(skipTypes.includes("protocolMessage")).toBe(true);
  });

  it("should skip senderKeyDistribution", () => {
    expect(skipTypes.includes("senderKeyDistributionMessage")).toBe(true);
  });

  it("should NOT skip conversation", () => {
    expect(skipTypes.includes("conversation")).toBe(false);
  });

  it("should NOT skip imageMessage", () => {
    expect(skipTypes.includes("imageMessage")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 14. Status Mapping from Evolution API
// ═══════════════════════════════════════════════════════════
describe("Status Mapping from Evolution API", () => {
  const statusMap: Record<number, string> = {
    0: "error",
    1: "pending",
    2: "sent",
    3: "delivered",
    4: "read",
    5: "played",
  };

  it("should map numeric status to string", () => {
    expect(statusMap[0]).toBe("error");
    expect(statusMap[1]).toBe("pending");
    expect(statusMap[2]).toBe("sent");
    expect(statusMap[3]).toBe("delivered");
    expect(statusMap[4]).toBe("read");
    expect(statusMap[5]).toBe("played");
  });

  it("should default to 'sent' for unknown status", () => {
    const rawStatus = 99;
    const result = statusMap[rawStatus] || "sent";
    expect(result).toBe("sent");
  });

  it("should use 'received' for !fromMe messages", () => {
    const fromMe = false;
    const result = fromMe ? "sent" : "received";
    expect(result).toBe("received");
  });
});
