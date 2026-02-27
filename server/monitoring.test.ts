import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
const mockExecute = vi.fn();
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    execute: mockExecute,
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onDuplicateKeyUpdate: vi.fn().mockReturnThis(),
  }),
}));

describe("Message Monitoring Metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMessageStatusMetrics", () => {
    it("should return status distribution grouped by statusGroup", async () => {
      mockExecute.mockResolvedValueOnce([[
        { statusGroup: "sent", count: 50 },
        { statusGroup: "delivered", count: 30 },
        { statusGroup: "read", count: 15 },
        { statusGroup: "received", count: 100 },
        { statusGroup: "failed", count: 2 },
      ]]);

      const { getMessageStatusMetrics } = await import("./db");
      const result = await getMessageStatusMetrics("test-session", 7);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(5);
      expect(result[0]).toHaveProperty("statusGroup");
      expect(result[0]).toHaveProperty("count");
    });

    it("should return empty array when no data", async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const { getMessageStatusMetrics } = await import("./db");
      const result = await getMessageStatusMetrics("test-session", 7);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getMessageVolumeOverTime", () => {
    it("should return volume data with time buckets", async () => {
      mockExecute.mockResolvedValueOnce([[
        { timeBucket: "2026-02-20", sent: 10, received: 15, total: 25 },
        { timeBucket: "2026-02-21", sent: 12, received: 8, total: 20 },
        { timeBucket: "2026-02-22", sent: 20, received: 25, total: 45 },
      ]]);

      const { getMessageVolumeOverTime } = await import("./db");
      const result = await getMessageVolumeOverTime("test-session", 7, "day");

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty("timeBucket");
      expect(result[0]).toHaveProperty("sent");
      expect(result[0]).toHaveProperty("received");
    });

    it("should support hourly granularity", async () => {
      mockExecute.mockResolvedValueOnce([[
        { timeBucket: "2026-02-22 10:00", sent: 5, received: 3, total: 8 },
        { timeBucket: "2026-02-22 11:00", sent: 8, received: 6, total: 14 },
      ]]);

      const { getMessageVolumeOverTime } = await import("./db");
      const result = await getMessageVolumeOverTime("test-session", 1, "hour");

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });
  });

  describe("getDeliveryRateMetrics", () => {
    it("should return delivery funnel data", async () => {
      mockExecute.mockResolvedValueOnce([[{
        totalSent: 100,
        delivered: 85,
        readCount: 60,
        played: 5,
        failed: 3,
        pending: 12,
      }]]);

      const { getDeliveryRateMetrics } = await import("./db");
      const result = await getDeliveryRateMetrics("test-session", 7);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty("totalSent");
      expect(result).toHaveProperty("delivered");
      expect(result).toHaveProperty("readCount");
      expect(result).toHaveProperty("failed");
      expect(result).toHaveProperty("pending");
    });

    it("should return null when no data", async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const { getDeliveryRateMetrics } = await import("./db");
      const result = await getDeliveryRateMetrics("test-session", 7);

      // Returns null or undefined when no rows
      expect(result === null || result === undefined).toBe(true);
    });
  });

  describe("getRecentMessageActivity", () => {
    it("should return recent messages with status info", async () => {
      mockExecute.mockResolvedValueOnce([[
        {
          id: 1,
          messageId: "msg-001",
          remoteJid: "5584999838420@s.whatsapp.net",
          fromMe: true,
          pushName: null,
          messageType: "text",
          content: "Olá, tudo bem?",
          status: "delivered",
          timestamp: new Date("2026-02-22T10:00:00Z"),
          senderAgentId: null,
        },
        {
          id: 2,
          messageId: "msg-002",
          remoteJid: "5584999838420@s.whatsapp.net",
          fromMe: false,
          pushName: "João",
          messageType: "text",
          content: "Tudo ótimo!",
          status: null,
          timestamp: new Date("2026-02-22T10:01:00Z"),
          senderAgentId: null,
        },
      ]]);

      const { getRecentMessageActivity } = await import("./db");
      const result = await getRecentMessageActivity("test-session", 50);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty("messageId");
      expect(result[0]).toHaveProperty("status");
      expect(result[0]).toHaveProperty("fromMe");
    });
  });

  describe("getMessageTypeDistribution", () => {
    it("should return message type counts", async () => {
      mockExecute.mockResolvedValueOnce([[
        { messageType: "text", count: 200, sentCount: 100, receivedCount: 100 },
        { messageType: "imageMessage", count: 30, sentCount: 10, receivedCount: 20 },
        { messageType: "audioMessage", count: 15, sentCount: 5, receivedCount: 10 },
      ]]);

      const { getMessageTypeDistribution } = await import("./db");
      const result = await getMessageTypeDistribution("test-session", 7);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty("messageType");
      expect(result[0]).toHaveProperty("count");
      expect(result[0]).toHaveProperty("sentCount");
      expect(result[0]).toHaveProperty("receivedCount");
    });
  });

  describe("getTopContactsByVolume", () => {
    it("should return top contacts sorted by message volume", async () => {
      mockExecute.mockResolvedValueOnce([[
        {
          remoteJid: "5584999838420@s.whatsapp.net",
          contactName: "João",
          totalMessages: 50,
          sent: 20,
          received: 30,
          lastActivity: new Date("2026-02-22T10:00:00Z"),
        },
        {
          remoteJid: "5584988887777@s.whatsapp.net",
          contactName: "Maria",
          totalMessages: 35,
          sent: 15,
          received: 20,
          lastActivity: new Date("2026-02-22T09:00:00Z"),
        },
      ]]);

      const { getTopContactsByVolume } = await import("./db");
      const result = await getTopContactsByVolume("test-session", 7, 10);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty("remoteJid");
      expect(result[0]).toHaveProperty("totalMessages");
      expect(Number(result[0].totalMessages)).toBeGreaterThanOrEqual(Number(result[1].totalMessages));
    });
  });

  describe("getResponseTimeMetrics", () => {
    it("should return response time statistics", async () => {
      mockExecute.mockResolvedValueOnce([[{
        totalConversations: 25,
        avgResponseTimeSec: 180,
        minResponseTimeSec: 15,
        maxResponseTimeSec: 3600,
        medianResponseTimeSec: 120,
      }]]);

      const { getResponseTimeMetrics } = await import("./db");
      const result = await getResponseTimeMetrics("test-session", 7);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty("avgResponseTimeSec");
      expect(result).toHaveProperty("minResponseTimeSec");
      expect(result).toHaveProperty("maxResponseTimeSec");
    });
  });
});

describe("Socket.IO message:status event forwarding", () => {
  it("should have message:status event emitter in WhatsApp manager", async () => {
    // Verify that the WhatsApp manager emits message:status events
    // by checking the event handler registration in whatsapp.ts
    const fs = await import("fs");
    const whatsappCode = fs.readFileSync("server/whatsapp.ts", "utf-8");

    // Verify message:status is emitted in message-receipt.update handler
    expect(whatsappCode).toContain('this.emit("message:status"');

    // Verify it's emitted in messages.update handler too
    const statusEmitCount = (whatsappCode.match(/this\.emit\("message:status"/g) || []).length;
    expect(statusEmitCount).toBeGreaterThanOrEqual(2);
  });

  it("should forward message:status to Socket.IO in index.ts", async () => {
    const fs = await import("fs");
    const indexCode = fs.readFileSync("server/_core/index.ts", "utf-8");

    // Verify Socket.IO forwards the event
    expect(indexCode).toContain('whatsappManager.on("message:status"');
    expect(indexCode).toContain('io.emit("whatsapp:message:status"');
  });
});

describe("Monitoring tRPC endpoints", () => {
  it("should have monitoring router with all required endpoints", async () => {
    const fs = await import("fs");
    const routersCode = fs.readFileSync("server/routers.ts", "utf-8");

    // Verify all monitoring endpoints exist
    expect(routersCode).toContain("monitoring: router({");
    expect(routersCode).toContain("statusMetrics:");
    expect(routersCode).toContain("volumeOverTime:");
    expect(routersCode).toContain("deliveryRate:");
    expect(routersCode).toContain("recentActivity:");
    expect(routersCode).toContain("typeDistribution:");
    expect(routersCode).toContain("topContacts:");
    expect(routersCode).toContain("responseTime:");
  });
});
