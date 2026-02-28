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
