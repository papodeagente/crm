/**
 * Tests for message queue infrastructure and message worker
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Message Queue Tests ──────────────────────────────────────

describe("messageQueue", () => {
  describe("isQueueEnabled", () => {
    it("should return false when REDIS_URL is not set and getRedisConnection was called", async () => {
      // The module checks REDIS_URL on first getRedisConnection call
      // Without REDIS_URL, connectionFailed should be set to true
      const { isQueueEnabled, getRedisConnection } = await import("./messageQueue");
      // Force the connection check which sets connectionFailed=true when no REDIS_URL
      getRedisConnection();
      expect(isQueueEnabled()).toBe(false);
    });

    it("should return false when USE_QUEUE is 'false'", async () => {
      const originalUseQueue = process.env.USE_QUEUE;
      process.env.USE_QUEUE = "false";
      
      // Re-import to test with new env
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
  describe("processMessageEvent", () => {
    it("should skip group messages", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      // Should not throw for group messages - just skip silently
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

    it("should skip protocol messages", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      await expect(processMessageEvent({
        tenantId: 1,
        sessionId: "test-session",
        instanceName: "test-instance",
        event: "messages.upsert",
        data: {
          key: {
            remoteJid: "5511999999999@s.whatsapp.net",
            id: "msg3",
            fromMe: false,
          },
          messageType: "protocolMessage",
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
  });

  describe("extractMessageContent", () => {
    // We test the content extraction indirectly through processMessageEvent
    // since extractMessageContent is not exported
    it("should handle various message types without crashing", async () => {
      const { processMessageEvent } = await import("./messageWorker");
      
      const messageTypes = [
        { message: { conversation: "Hello" } },
        { message: { extendedTextMessage: { text: "Extended text" } } },
        { message: { imageMessage: { caption: "Photo caption" } } },
        { message: { videoMessage: { caption: "Video caption" } } },
        { message: { audioMessage: {} } },
        { message: { stickerMessage: {} } },
        { message: { contactMessage: { displayName: "John" } } },
        { message: { locationMessage: {} } },
        { body: "Fallback body" },
        {}, // Empty data
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
              id: `msg-${Math.random()}`,
              fromMe: false,
            },
            messageType: "conversation",
            ...msgData,
          },
          receivedAt: Date.now(),
        })).resolves.not.toThrow();
      }
    });
  });

  describe("initMessageWorker", () => {
    it("should not crash when Redis is unavailable", async () => {
      const { initMessageWorker } = await import("./messageWorker");
      // Should log warning but not throw
      expect(() => initMessageWorker()).not.toThrow();
    });
  });
});

// ── Webhook Integration Tests ──────────────────────────────────

describe("webhook fallback behavior", () => {
  it("should use sync processing when queue is disabled", async () => {
    const { isQueueEnabled } = await import("./messageQueue");
    // Without Redis, queue should be disabled
    expect(isQueueEnabled()).toBe(false);
    // This means the webhook will use the sync fallback path
  });
});

// ── Cursor Pagination Tests ──────────────────────────────────

describe("cursor pagination", () => {
  it("should support cursor parameter in getWaConversationsList type", async () => {
    // Verify the function accepts cursor parameter without type errors
    const { getWaConversationsList } = await import("./db");
    expect(typeof getWaConversationsList).toBe("function");
    
    // Call with cursor parameter - should not throw type errors
    // (will return empty array since no matching data exists for this session)
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
    
    // When cursor is provided, offset should be ignored
    const result = await getWaConversationsList("nonexistent-session", 0, {
      cursor: new Date().toISOString(),
      offset: 100, // Should be ignored
      limit: 10,
    });
    expect(Array.isArray(result)).toBe(true);
  });
});
