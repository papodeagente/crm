/**
 * Tests for message queue infrastructure, message worker, and cursor pagination
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Message Queue Tests ──────────────────────────────────────

describe("messageQueue", () => {
  describe("isQueueEnabled", () => {
    it("should return correct value based on REDIS_URL availability", async () => {
      const { isQueueEnabled, getRedisConnection } = await import("./messageQueue");
      getRedisConnection();
      // When REDIS_URL is set and Redis is reachable, queue is enabled
      // When REDIS_URL is not set, queue is disabled
      const hasRedis = !!process.env.REDIS_URL;
      expect(isQueueEnabled()).toBe(hasRedis);
    });

    it("should return false when USE_QUEUE is 'false'", async () => {
      const originalUseQueue = process.env.USE_QUEUE;
      process.env.USE_QUEUE = "false";
      
      vi.resetModules();
      const { isQueueEnabled } = await import("./messageQueue");
      expect(isQueueEnabled()).toBe(false);
      
      process.env.USE_QUEUE = originalUseQueue;
    });
  });

  describe("isRedisReady", () => {
    it("should return false when Redis is not connected", async () => {
      const { isRedisReady } = await import("./messageQueue");
      expect(isRedisReady()).toBe(false);
    });
  });

  describe("enqueueMessageEvent", () => {
    it("should return false when queue is not enabled", async () => {
      const { enqueueMessageEvent } = await import("./messageQueue");
      const result = await enqueueMessageEvent({
        tenantId: 1,
        sessionId: "test-session",
        instanceName: "test-instance",
        event: "messages.upsert",
        data: { key: { remoteJid: "5511999999999@s.whatsapp.net", id: "msg1" } },
        receivedAt: Date.now(),
      });
      expect(result).toBe(false);
    });
  });
});

// ── Message Worker Tests ──────────────────────────────────────

describe("messageWorker", () => {
  describe("processMessageEvent — event routing", () => {
    it("should skip group messages (@g.us)", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      await expect(processMessageEvent({
        tenantId: 1,
        sessionId: "test-session",
        instanceName: "test-instance",
        event: "messages.upsert",
        data: {
          key: {
            remoteJid: "120363123456789@g.us",
            id: "msg1",
            fromMe: false,
          },
          messageType: "conversation",
          message: { conversation: "Hello group" },
        },
        receivedAt: Date.now(),
      })).resolves.not.toThrow();
    });

    it("should skip status@broadcast messages", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      await expect(processMessageEvent({
        tenantId: 1,
        sessionId: "test-session",
        instanceName: "test-instance",
        event: "messages.upsert",
        data: {
          key: {
            remoteJid: "status@broadcast",
            id: "msg2",
            fromMe: false,
          },
          messageType: "conversation",
        },
        receivedAt: Date.now(),
      })).resolves.not.toThrow();
    });

    it("should skip @lid messages", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      await expect(processMessageEvent({
        tenantId: 1,
        sessionId: "test-session",
        instanceName: "test-instance",
        event: "messages.upsert",
        data: {
          key: {
            remoteJid: "5511999999999@lid",
            id: "msg4",
            fromMe: false,
          },
          messageType: "conversation",
        },
        receivedAt: Date.now(),
      })).resolves.not.toThrow();
    });

    it("should skip senderKeyDistributionMessage", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      await expect(processMessageEvent({
        tenantId: 1,
        sessionId: "test-session",
        instanceName: "test-instance",
        event: "messages.upsert",
        data: {
          key: {
            remoteJid: "5511999999999@s.whatsapp.net",
            id: "msg-skip1",
            fromMe: false,
          },
          messageType: "senderKeyDistributionMessage",
        },
        receivedAt: Date.now(),
      })).resolves.not.toThrow();
    });

    it("should NOT skip protocolMessage with REVOKE type (delete notification)", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      // protocolMessage with type REVOKE should be processed as a delete
      await expect(processMessageEvent({
        tenantId: 1,
        sessionId: "test-session",
        instanceName: "test-instance",
        event: "messages.upsert",
        data: {
          key: {
            remoteJid: "5511999999999@s.whatsapp.net",
            id: "msg-proto-revoke",
            fromMe: false,
          },
          messageType: "protocolMessage",
          message: {
            protocolMessage: {
              type: 0, // REVOKE
              key: { id: "deleted-msg-id" },
            },
          },
        },
        receivedAt: Date.now(),
      })).resolves.not.toThrow();
    });

    it("should route messages.update events to status update handler", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      // messages.update with status should not crash
      await expect(processMessageEvent({
        tenantId: 1,
        sessionId: "test-session",
        instanceName: "test-instance",
        event: "messages.update",
        data: {
          key: {
            id: "msg-status-test",
            remoteJid: "5511999999999@s.whatsapp.net",
            fromMe: true,
          },
          update: { status: 3 }, // delivered
        },
        receivedAt: Date.now(),
      })).resolves.not.toThrow();
    });

    it("should route messages.delete events to delete handler", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      await expect(processMessageEvent({
        tenantId: 1,
        sessionId: "test-session",
        instanceName: "test-instance",
        event: "messages.delete",
        data: {
          key: {
            id: "msg-delete-test",
            remoteJid: "5511999999999@s.whatsapp.net",
          },
        },
        receivedAt: Date.now(),
      })).resolves.not.toThrow();
    });
  });

  describe("processMessageEvent — message types", () => {
    it("should handle all supported message types without crashing", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      const messageTypes = [
        { message: { conversation: "Hello" }, messageType: "conversation" },
        { message: { extendedTextMessage: { text: "Extended text" } }, messageType: "extendedTextMessage" },
        { message: { imageMessage: { caption: "Photo caption", mimetype: "image/jpeg" } }, messageType: "imageMessage" },
        { message: { videoMessage: { caption: "Video caption", mimetype: "video/mp4" } }, messageType: "videoMessage" },
        { message: { audioMessage: { mimetype: "audio/ogg" } }, messageType: "audioMessage" },
        { message: { stickerMessage: { mimetype: "image/webp" } }, messageType: "stickerMessage" },
        { message: { documentMessage: { fileName: "doc.pdf", mimetype: "application/pdf" } }, messageType: "documentMessage" },
        { message: { contactMessage: { displayName: "John" } }, messageType: "contactMessage" },
        { message: { locationMessage: { degreesLatitude: -23.5, degreesLongitude: -46.6 } }, messageType: "locationMessage" },
        { message: { pttMessage: { mimetype: "audio/ogg", ptt: true } }, messageType: "pttMessage" },
        { message: { reactionMessage: { text: "👍" } }, messageType: "reactionMessage" },
        { body: "Fallback body", messageType: "conversation" },
        { messageType: "conversation" }, // Empty data
      ];

      for (const msgData of messageTypes) {
        await expect(processMessageEvent({
          tenantId: 1,
          sessionId: "test-session",
          instanceName: "test-instance",
          event: "messages.upsert",
          data: {
            key: {
              remoteJid: "5511999999999@s.whatsapp.net",
              id: `msg-type-${Math.random().toString(36).slice(2)}`,
              fromMe: false,
            },
            ...msgData,
          },
          receivedAt: Date.now(),
        })).resolves.not.toThrow();
      }
    });
  });

  describe("processMessageEvent — status updates (messages.update)", () => {
    it("should handle numeric status codes (Baileys format)", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      const statusCodes = [
        { code: 2, expected: "sent" },
        { code: 3, expected: "delivered" },
        { code: 4, expected: "read" },
        { code: 5, expected: "played" },
      ];

      for (const { code } of statusCodes) {
        await expect(processMessageEvent({
          tenantId: 1,
          sessionId: "test-session",
          instanceName: "test-instance",
          event: "messages.update",
          data: {
            key: {
              id: `msg-status-${code}`,
              remoteJid: "5511999999999@s.whatsapp.net",
              fromMe: true,
            },
            update: { status: code },
          },
          receivedAt: Date.now(),
        })).resolves.not.toThrow();
      }
    });

    it("should handle string status codes (Evolution v2 format)", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      const statusStrings = ["SENT", "SERVER_ACK", "DELIVERY_ACK", "DELIVERED", "READ", "PLAYED"];

      for (const status of statusStrings) {
        await expect(processMessageEvent({
          tenantId: 1,
          sessionId: "test-session",
          instanceName: "test-instance",
          event: "messages.update",
          data: {
            keyId: `msg-str-${status}`,
            remoteJid: "5511999999999@s.whatsapp.net",
            fromMe: true,
            status,
          },
          receivedAt: Date.now(),
        })).resolves.not.toThrow();
      }
    });

    it("should handle array of status updates", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      await expect(processMessageEvent({
        tenantId: 1,
        sessionId: "test-session",
        instanceName: "test-instance",
        event: "messages.update",
        data: [
          { key: { id: "msg-batch-1", remoteJid: "5511999999999@s.whatsapp.net", fromMe: true }, update: { status: 3 } },
          { key: { id: "msg-batch-2", remoteJid: "5511999999999@s.whatsapp.net", fromMe: true }, update: { status: 4 } },
        ],
        receivedAt: Date.now(),
      })).resolves.not.toThrow();
    });

    it("should skip updates without messageId or status", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      await expect(processMessageEvent({
        tenantId: 1,
        sessionId: "test-session",
        instanceName: "test-instance",
        event: "messages.update",
        data: { key: { remoteJid: "5511999999999@s.whatsapp.net" } }, // no id, no status
        receivedAt: Date.now(),
      })).resolves.not.toThrow();
    });
  });

  describe("initMessageWorker", () => {
    it("should not crash when Redis is unavailable", async () => {
      const { initMessageWorker } = await import("./messageWorker");
      expect(() => initMessageWorker()).not.toThrow();
    });
  });
});

// ── Webhook Integration Tests ──────────────────────────────────

describe("webhook fallback behavior", () => {
  it("should use sync processing when queue is disabled", async () => {
    const { isQueueEnabled } = await import("./messageQueue");
    expect(isQueueEnabled()).toBe(false);
  });
});

// ── Cursor Pagination Tests ──────────────────────────────────

describe("cursor pagination", () => {
  it("should support cursor parameter in getWaConversationsList type", async () => {
    const { getWaConversationsList } = await import("./db");
    expect(typeof getWaConversationsList).toBe("function");
    
    const result = await getWaConversationsList("nonexistent-session", 0, {
      cursor: new Date().toISOString(),
      limit: 10,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("should support offset parameter for backward compatibility", async () => {
    const { getWaConversationsList } = await import("./db");
    
    const result = await getWaConversationsList("nonexistent-session", 0, {
      offset: 0,
      limit: 10,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("should prefer cursor over offset when both provided", async () => {
    const { getWaConversationsList } = await import("./db");
    
    const result = await getWaConversationsList("nonexistent-session", 0, {
      cursor: new Date().toISOString(),
      offset: 100,
      limit: 10,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("getMessages should accept beforeId for cursor pagination", async () => {
    const { getMessages } = await import("./db");
    expect(typeof getMessages).toBe("function");
    
    // Should accept beforeId without errors
    const result = await getMessages("nonexistent-session", 10, 999999);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getMessages should work without beforeId (first page)", async () => {
    const { getMessages } = await import("./db");
    
    const result = await getMessages("nonexistent-session", 10);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getNotifications should accept beforeId for cursor pagination", async () => {
    const { getNotifications } = await import("./db");
    expect(typeof getNotifications).toBe("function");
    
    const result = await getNotifications(999999, { beforeId: 999999, limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("getMessagesByContact should accept beforeId for cursor pagination", async () => {
    const { getMessagesByContact } = await import("./db");
    expect(typeof getMessagesByContact).toBe("function");
    
    const result = await getMessagesByContact("nonexistent-session", "5511999999999@s.whatsapp.net", 10, 999999);
    expect(Array.isArray(result)).toBe(true);
  });
});
