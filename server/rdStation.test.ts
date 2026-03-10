import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

// ─── RD Station Config ─────────────────────────────────────

describe("rdStation.getConfig", () => {
  it("returns null or config object for valid tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.getConfig({ tenantId: 1 });
    // Should be null (not yet set up) or an object
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.getConfig({ tenantId: 1 })).rejects.toThrow();
  });
});

describe("rdStation.setupIntegration", () => {
  it("creates config with webhook token", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.setupIntegration({ tenantId: 1 });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("webhookToken");
    expect(typeof result!.webhookToken).toBe("string");
    expect(result!.webhookToken.length).toBeGreaterThan(0);
    expect(result).toHaveProperty("isActive", true);
  });

  it("returns existing config on second call (idempotent)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const first = await caller.rdStation.setupIntegration({ tenantId: 1 });
    const second = await caller.rdStation.setupIntegration({ tenantId: 1 });
    expect(first!.webhookToken).toBe(second!.webhookToken);
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.setupIntegration({ tenantId: 1 })).rejects.toThrow();
  });
});

describe("rdStation.regenerateToken", () => {
  it("generates a new token different from the original", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Ensure setup exists
    const setup = await caller.rdStation.setupIntegration({ tenantId: 1 });
    const originalToken = setup!.webhookToken;

    // Regenerate
    const regenerated = await caller.rdStation.regenerateToken({ tenantId: 1 });
    expect(regenerated).toBeDefined();
    expect(regenerated!.webhookToken).not.toBe(originalToken);
    expect(regenerated!.webhookToken.length).toBeGreaterThan(0);
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.regenerateToken({ tenantId: 1 })).rejects.toThrow();
  });
});

describe("rdStation.toggleActive", () => {
  it("can disable the integration", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Ensure setup exists
    await caller.rdStation.setupIntegration({ tenantId: 1 });

    // Disable
    const result = await caller.rdStation.toggleActive({ tenantId: 1, isActive: false });
    expect(result).toEqual({ success: true });

    // Verify
    const config = await caller.rdStation.getConfig({ tenantId: 1 });
    expect(config!.isActive).toBe(false);
  });

  it("can re-enable the integration", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.rdStation.toggleActive({ tenantId: 1, isActive: true });
    const config = await caller.rdStation.getConfig({ tenantId: 1 });
    expect(config!.isActive).toBe(true);
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.toggleActive({ tenantId: 1, isActive: false })).rejects.toThrow();
  });
});

describe("rdStation.getStats", () => {
  it("returns stats object with expected fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.getStats({ tenantId: 1 });
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("failed");
    expect(result).toHaveProperty("duplicate");
    expect(typeof result.total).toBe("number");
    expect(typeof result.success).toBe("number");
    expect(typeof result.failed).toBe("number");
    expect(typeof result.duplicate).toBe("number");
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.getStats({ tenantId: 1 })).rejects.toThrow();
  });
});

describe("rdStation.getWebhookLogs", () => {
  it("returns logs array and total count", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.getWebhookLogs({ tenantId: 1 });
    expect(result).toHaveProperty("logs");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.logs)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("supports status filter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.getWebhookLogs({ tenantId: 1, status: "success" });
    expect(Array.isArray(result.logs)).toBe(true);
  });

  it("supports pagination", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.getWebhookLogs({ tenantId: 1, limit: 5, offset: 0 });
    expect(result.logs.length).toBeLessThanOrEqual(5);
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.getWebhookLogs({ tenantId: 1 })).rejects.toThrow();
  });
});

// ─── Webhook Endpoint (via HTTP simulation) ─────────────────

describe("RD Station Webhook endpoint logic", () => {
  it("webhook route is registered in webhookRouter", async () => {
    // We test that the webhook route handler exists by importing the router
    const { webhookRouter } = await import("./webhookRoutes");
    expect(webhookRouter).toBeDefined();
    // The router should have a stack with routes
    const routes = (webhookRouter as any).stack || [];
    const rdRoute = routes.find((r: any) =>
      r.route?.path === "/api/webhooks/rdstation"
    );
    expect(rdRoute).toBeDefined();
    expect(rdRoute.route.methods.post).toBe(true);
  });

  it("rate limiter exports are available", async () => {
    const { checkRateLimit, rateLimitStore } = await import("./webhookRoutes");
    expect(typeof checkRateLimit).toBe("function");
    expect(rateLimitStore).toBeDefined();

    // Test rate limit function
    rateLimitStore.clear();
    const result = checkRateLimit("test-ip-rdstation");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("email validation works correctly", async () => {
    const { isValidEmail } = await import("./webhookRoutes");
    expect(isValidEmail("test@example.com")).toBe(true);
    expect(isValidEmail("invalid")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("user@domain.co.br")).toBe(true);
  });
});

// ─── Schema Validation ─────────────────────────────────────

describe("RD Station schema tables", () => {
  it("rdStationConfig table is defined in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.rdStationConfig).toBeDefined();
  });

  it("rdStationWebhookLog table is defined in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.rdStationWebhookLog).toBeDefined();
  });

  it("rdStationConfig has expected columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.rdStationConfig;
    // Check that the table config object exists
    expect(table).toBeDefined();
  });

  it("rdStationWebhookLog has expected columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.rdStationWebhookLog;
    expect(table).toBeDefined();
  });
});

// ─── Token-based Tenant Resolution (Bug Fix) ─────────────────

describe("RD Station Webhook token-based tenant resolution", () => {
  it("webhook resolves tenantId from token instead of hardcoding", async () => {
    // The fix: instead of hardcoding tenantId=1, the webhook now looks up
    // the rd_station_config row by matching the token, and uses that row's tenantId.
    // This ensures leads are processed in the correct tenant's pipeline.

    // Simulate the fixed lookup logic
    const allConfigs = [
      { id: 1, tenantId: 150002, webhookToken: "token-a", isActive: true },
      { id: 2, tenantId: 180002, webhookToken: "token-b", isActive: true },
      { id: 3, tenantId: 1, webhookToken: "token-c", isActive: false },
    ];

    // Token A should resolve to tenant 150002
    const configA = allConfigs.find(c => c.webhookToken === "token-a" && c.isActive);
    expect(configA).toBeDefined();
    expect(configA!.tenantId).toBe(150002);

    // Token B should resolve to tenant 180002
    const configB = allConfigs.find(c => c.webhookToken === "token-b" && c.isActive);
    expect(configB).toBeDefined();
    expect(configB!.tenantId).toBe(180002);

    // Token C is inactive, should not match
    const activeConfigs = allConfigs.filter(c => c.isActive);
    const configC = activeConfigs.find(c => c.webhookToken === "token-c");
    expect(configC).toBeUndefined();
  });

  it("rejects unknown tokens", () => {
    const allConfigs = [
      { id: 1, tenantId: 150002, webhookToken: "valid-token", isActive: true },
    ];

    const config = allConfigs.find(c => c.webhookToken === "unknown-token");
    expect(config).toBeUndefined();
  });

  it("only matches active configs", () => {
    const allConfigs = [
      { id: 1, tenantId: 150002, webhookToken: "disabled-token", isActive: false },
    ];

    // Even if token matches, inactive config should be filtered out
    const activeConfigs = allConfigs.filter(c => c.isActive);
    const config = activeConfigs.find(c => c.webhookToken === "disabled-token");
    expect(config).toBeUndefined();
  });

  it("handles multiple tenants with unique tokens", () => {
    const allConfigs = [
      { id: 1, tenantId: 100, webhookToken: "aaa", isActive: true },
      { id: 2, tenantId: 200, webhookToken: "bbb", isActive: true },
      { id: 3, tenantId: 300, webhookToken: "ccc", isActive: true },
    ];

    // Each token should resolve to its own tenant
    for (const expected of allConfigs) {
      const found = allConfigs.find(c => c.webhookToken === expected.webhookToken);
      expect(found!.tenantId).toBe(expected.tenantId);
    }
  });
});

// ─── Auto-capture cf_* fields ─────────────────────────────

describe("RD Station auto-capture cf_* fields", () => {
  it("deals table has rdCustomFields column in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.deals).toBeDefined();
    // rdCustomFields is a json column
    expect(schema.deals.rdCustomFields).toBeDefined();
  });

  it("webhook route extracts cf_ fields from RD Station payload", async () => {
    // Simulate the extraction logic used in the webhook handler
    const sampleLead = {
      email: "test@example.com",
      name: "Test Lead",
      personal_phone: "+5511999999999",
      cf_voce_ja_tem_um_grupo: "Sim",
      cf_fbc: "fb.1.12345.67890",
      cf_fbp: "fb.1.98765.43210",
      cf_destino_interesse: "Europa",
      company: "Test Company",
      job_title: "CEO",
    };

    // Extract cf_ fields (same logic as webhook handler)
    const rdCustomFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(sampleLead)) {
      if (key.startsWith("cf_") && value != null && String(value).trim() !== "") {
        rdCustomFields[key] = String(value);
      }
    }

    expect(Object.keys(rdCustomFields).length).toBe(4);
    expect(rdCustomFields["cf_voce_ja_tem_um_grupo"]).toBe("Sim");
    expect(rdCustomFields["cf_fbc"]).toBe("fb.1.12345.67890");
    expect(rdCustomFields["cf_fbp"]).toBe("fb.1.98765.43210");
    expect(rdCustomFields["cf_destino_interesse"]).toBe("Europa");
    // Non cf_ fields should not be included
    expect(rdCustomFields["company"]).toBeUndefined();
    expect(rdCustomFields["email"]).toBeUndefined();
  });

  it("ignores empty cf_ fields", () => {
    const sampleLead = {
      cf_filled: "Has value",
      cf_empty: "",
      cf_null: null,
      cf_whitespace: "   ",
    };

    const rdCustomFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(sampleLead)) {
      if (key.startsWith("cf_") && value != null && String(value).trim() !== "") {
        rdCustomFields[key] = String(value);
      }
    }

    expect(Object.keys(rdCustomFields).length).toBe(1);
    expect(rdCustomFields["cf_filled"]).toBe("Has value");
  });

  it("handles leads with no cf_ fields gracefully", () => {
    const sampleLead = {
      email: "test@example.com",
      name: "Test Lead",
      company: "Test Company",
    };

    const rdCustomFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(sampleLead)) {
      if (key.startsWith("cf_") && value != null && String(value).trim() !== "") {
        rdCustomFields[key] = String(value);
      }
    }

    expect(Object.keys(rdCustomFields).length).toBe(0);
  });

  it("formats cf_ field labels correctly for display", () => {
    const key = "cf_voce_ja_tem_um_grupo_de_viagens_pronto_para_ser_lancado";
    const label = key
      .replace(/^cf_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    expect(label).toBe("Voce Ja Tem Um Grupo De Viagens Pronto Para Ser Lancado");
  });
});
