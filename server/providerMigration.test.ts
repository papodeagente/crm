/**
 * Tests for WhatsApp Provider — Z-API Only
 *
 * Covers:
 * - Provider interface contract compliance (Z-API)
 * - Provider factory resolution
 * - Webhook normalization (Z-API → canonical format)
 * - Consumer migration (fallback pattern)
 * - Metrics/observability
 */
import { describe, it, expect, beforeEach } from "vitest";

// ════════════════════════════════════════════════════════════
// 1. PROVIDER INTERFACE — Contract compliance
// ════════════════════════════════════════════════════════════

describe("Provider Interface Contract", () => {
  it("zapiProvider implements WhatsAppProvider interface", async () => {
    const { zapiProvider } = await import("./providers/zapiProvider");
    const requiredMethods = [
      "createInstance", "connectInstance", "deleteInstance", "fetchAllInstances",
      "fetchInstance", "restartInstance", "logoutInstance",
      "sendText", "sendMedia", "sendReaction", "sendContact", "sendLocation",
      "sendSticker", "sendAudio", "sendTextWithQuote",
      "findChats", "findMessages", "findContacts",
      "archiveChat", "markMessageAsUnread", "markMessageAsRead",
      "updateBlockStatus", "checkIsWhatsApp",
      "fetchAllGroups", "findGroupByJid", "createGroup",
      "getBase64FromMediaMessage",
      "healthCheck", "findWebhook", "setWebhook", "ensureWebhook",
      "normalizeWebhookPayload",
    ];
    for (const method of requiredMethods) {
      expect(typeof (zapiProvider as any)[method]).toBe("function");
    }
    expect(zapiProvider.type).toBe("zapi");
  });
});

// ════════════════════════════════════════════════════════════
// 2. PROVIDER FACTORY — Resolution & caching
// ════════════════════════════════════════════════════════════

describe("Provider Factory", () => {
  it("getProvider returns zapi provider", async () => {
    const { getProvider } = await import("./providers/providerFactory");
    const provider = getProvider("zapi");
    expect(provider).toBeDefined();
    expect(provider.type).toBe("zapi");
  });

  it("getDefaultProviderType defaults to zapi", async () => {
    const { getDefaultProviderType } = await import("./providers/providerFactory");
    const type = getDefaultProviderType();
    // Now that Evolution is removed, default should be zapi
    expect(type).toBe("zapi");
  });

  it("getDefaultProviderType respects WA_PROVIDER env", async () => {
    const { getDefaultProviderType } = await import("./providers/providerFactory");
    const original = process.env.WA_PROVIDER;
    process.env.WA_PROVIDER = "zapi";
    expect(getDefaultProviderType()).toBe("zapi");
    if (original) {
      process.env.WA_PROVIDER = original;
    } else {
      delete process.env.WA_PROVIDER;
    }
  });

  it("invalidateProviderCache does not throw", async () => {
    const { invalidateProviderCache } = await import("./providers/providerFactory");
    expect(() => invalidateProviderCache("test-session")).not.toThrow();
  });

  it("clearProviderCache does not throw", async () => {
    const { clearProviderCache } = await import("./providers/providerFactory");
    expect(() => clearProviderCache()).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════
// 3. WEBHOOK NORMALIZATION — Z-API → Canonical format
// ════════════════════════════════════════════════════════════

describe("Z-API Webhook Normalization", () => {
  it("normalizes incoming text message (ReceivedCallBack)", async () => {
    const { zapiProvider } = await import("./providers/zapiProvider");
    const rawPayload = {
      type: "ReceivedCallBack",
      _instanceName: "test-instance",
      phone: "5511999999999",
      isGroup: false,
      messageId: "ABCDEF123456",
      fromMe: false,
      chatName: "John Doe",
      senderName: "John Doe",
      text: { message: "Hello world" },
      momment: 1700000000000,
    };
    const normalized = zapiProvider.normalizeWebhookPayload(rawPayload);
    expect(normalized).not.toBeNull();
    expect(normalized!.event).toBe("messages.upsert");
    expect(normalized!.data).toBeDefined();
    expect(normalized!.data.key.fromMe).toBe(false);
    expect(normalized!.data.key.id).toBe("ABCDEF123456");
    expect(normalized!.instance).toBe("test-instance");
    expect(normalized!.provider).toBe("zapi");
  });

  it("normalizes message status update (MessageStatusCallback)", async () => {
    const { zapiProvider } = await import("./providers/zapiProvider");
    const rawPayload = {
      type: "MessageStatusCallback",
      _instanceName: "test-instance",
      phone: "5511999999999",
      messageId: "ABCDEF123456",
      status: "DELIVERED",
      momment: 1700000000000,
    };
    const normalized = zapiProvider.normalizeWebhookPayload(rawPayload);
    expect(normalized).not.toBeNull();
    expect(normalized!.event).toBe("messages.update");
    expect(normalized!.data.key.id).toBe("ABCDEF123456");
  });

  it("normalizes connection update (ConnectedCallback)", async () => {
    const { zapiProvider } = await import("./providers/zapiProvider");
    const rawPayload = {
      type: "ConnectedCallback",
      _instanceName: "test-instance",
    };
    const normalized = zapiProvider.normalizeWebhookPayload(rawPayload);
    expect(normalized).not.toBeNull();
    expect(normalized!.event).toBe("connection.update");
    expect(normalized!.data.state).toBe("open");
  });

  it("normalizes disconnection (DisconnectedCallback)", async () => {
    const { zapiProvider } = await import("./providers/zapiProvider");
    const rawPayload = {
      type: "DisconnectedCallback",
      _instanceName: "test-instance",
    };
    const normalized = zapiProvider.normalizeWebhookPayload(rawPayload);
    expect(normalized).not.toBeNull();
    expect(normalized!.event).toBe("connection.update");
    expect(normalized!.data.state).toBe("close");
  });

  it("normalizes sent message (DeliveryCallback)", async () => {
    const { zapiProvider } = await import("./providers/zapiProvider");
    const rawPayload = {
      type: "DeliveryCallback",
      _instanceName: "test-instance",
      phone: "5511888888888",
      messageId: "SENT123",
    };
    const normalized = zapiProvider.normalizeWebhookPayload(rawPayload);
    expect(normalized).not.toBeNull();
    expect(normalized!.event).toBe("send.message");
    expect(normalized!.data.key.fromMe).toBe(true);
  });

  it("returns null for unknown type", async () => {
    const { zapiProvider } = await import("./providers/zapiProvider");
    const rawPayload = {
      type: "UnknownCallbackType",
      _instanceName: "test-instance",
    };
    const normalized = zapiProvider.normalizeWebhookPayload(rawPayload);
    expect(normalized).toBeNull();
  });

  it("returns null for empty/null payload", async () => {
    const { zapiProvider } = await import("./providers/zapiProvider");
    expect(zapiProvider.normalizeWebhookPayload({})).toBeNull();
    expect(zapiProvider.normalizeWebhookPayload(null)).toBeNull();
    expect(zapiProvider.normalizeWebhookPayload(undefined)).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════
// 4. CONSUMER MIGRATION — Fallback pattern verification
// ════════════════════════════════════════════════════════════

describe("Consumer Migration — Provider Factory Usage", () => {
  it("routers.ts uses provider factory for getMediaUrl", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain('resolveProviderForSession(input.sessionId)');
    expect(content).toContain('provider.getBase64FromMediaMessage(instanceName');
  });

  it("routers.ts uses provider factory for fixWebhooks", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("provider.ensureWebhook(sess.instanceName)");
  });
});

// ════════════════════════════════════════════════════════════
// 5. METRICS & OBSERVABILITY
// ════════════════════════════════════════════════════════════

describe("Provider Metrics", () => {
  beforeEach(async () => {
    const { resetProviderMetrics } = await import("./providers/providerFactory");
    resetProviderMetrics();
  });

  it("recordProviderMetric records correctly", async () => {
    const { recordProviderMetric, getProviderMetrics } = await import("./providers/providerFactory");
    recordProviderMetric("zapi", "sendText", 150);
    recordProviderMetric("zapi", "sendText", 250);
    recordProviderMetric("zapi", "findChats", 500, "timeout");

    const metrics = getProviderMetrics("zapi");
    expect(metrics.totalRequests).toBe(3);
    expect(metrics.totalErrors).toBe(1);
    expect(metrics.totalTimeouts).toBe(1);
    expect(metrics.lastError).toBe("timeout");
    expect(metrics.operations["sendText"].count).toBe(2);
    expect(metrics.operations["findChats"].errors).toBe(1);
  });

  it("getAllProviderMetrics returns zapi", async () => {
    const { getAllProviderMetrics } = await import("./providers/providerFactory");
    const all = getAllProviderMetrics();
    expect(all).toHaveProperty("zapi");
    expect(all.zapi.provider).toBe("zapi");
  });

  it("resetProviderMetrics clears all data", async () => {
    const { recordProviderMetric, resetProviderMetrics, getProviderMetrics } = await import("./providers/providerFactory");
    recordProviderMetric("zapi", "sendText", 100);
    resetProviderMetrics();
    const metrics = getProviderMetrics("zapi");
    expect(metrics.totalRequests).toBe(0);
    expect(metrics.totalErrors).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════
// 6. INSTRUMENTED PROVIDER
// ════════════════════════════════════════════════════════════

describe("Instrumented Provider", () => {
  it("instrumentProvider wraps zapiProvider without changing type", async () => {
    const { instrumentProvider } = await import("./providers/instrumentedProvider");
    const { zapiProvider } = await import("./providers/zapiProvider");
    const instrumented = instrumentProvider(zapiProvider);
    expect(instrumented.type).toBe("zapi");
    expect(typeof instrumented.sendText).toBe("function");
    expect(typeof instrumented.findChats).toBe("function");
  });
});

// ════════════════════════════════════════════════════════════
// 7. Z-API SESSION REGISTRATION
// ════════════════════════════════════════════════════════════

describe("Z-API Session Registration", () => {
  it("registerZApiSession and getZApiSession work", async () => {
    const { registerZApiSession, getZApiSession } = await import("./providers/zapiProvider");
    registerZApiSession("test-session-1", {
      instanceId: "inst-123",
      token: "tok-abc",
      clientToken: "ct-xyz",
    });
    const session = getZApiSession("test-session-1");
    expect(session).toBeDefined();
    expect(session!.instanceId).toBe("inst-123");
    expect(session!.token).toBe("tok-abc");
    expect(session!.clientToken).toBe("ct-xyz");
  });

  it("getZApiSession returns undefined for unregistered session", async () => {
    const { getZApiSession } = await import("./providers/zapiProvider");
    const session = getZApiSession("nonexistent-session-xyz");
    expect(session).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════
// 8. DATABASE SCHEMA — Provider fields
// ════════════════════════════════════════════════════════════

describe("Database Schema — Provider Fields", () => {
  it("whatsappSessions schema has provider fields", async () => {
    const { whatsappSessions } = await import("../drizzle/schema");
    const columns = Object.keys(whatsappSessions);
    expect(columns).toContain("provider");
    expect(columns).toContain("providerInstanceId");
    expect(columns).toContain("providerToken");
    expect(columns).toContain("providerClientToken");
  });
});

// ════════════════════════════════════════════════════════════
// 9. WEBHOOK ROUTE — Z-API endpoint exists
// ════════════════════════════════════════════════════════════

describe("Webhook Routes", () => {
  it("webhookRoutes.ts has Z-API webhook handler", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/webhookRoutes.ts", "utf-8");
    expect(content).toContain("/api/webhooks/zapi");
    expect(content).toContain("handleZApiWebhook");
  });
});

// ════════════════════════════════════════════════════════════
// 10. ROUTER ENDPOINTS — Metrics
// ════════════════════════════════════════════════════════════

describe("Router Endpoints", () => {
  it("routers.ts has providerMetrics endpoint", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("providerMetrics:");
    expect(content).toContain("getAllProviderMetrics");
  });
});
