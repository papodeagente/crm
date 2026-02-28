import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val, op: "eq" })),
  and: vi.fn((...args) => ({ args, op: "and" })),
  desc: vi.fn((col) => ({ col, op: "desc" })),
  sql: vi.fn(),
  count: vi.fn(),
}));

// Mock schema
vi.mock("../drizzle/schema", () => ({
  tenants: { id: "tenants.id", name: "tenants.name", status: "tenants.status", plan: "tenants.plan", hotmartEmail: "tenants.hotmartEmail", freemiumExpiresAt: "tenants.freemiumExpiresAt", ownerEmail: "tenants.ownerEmail", createdAt: "tenants.createdAt" },
  crmUsers: { id: "crmUsers.id", email: "crmUsers.email", passwordHash: "crmUsers.passwordHash", tenantId: "crmUsers.tenantId", name: "crmUsers.name", role: "crmUsers.role", isActive: "crmUsers.isActive" },
  subscriptions: { id: "subscriptions.id", tenantId: "subscriptions.tenantId", plan: "subscriptions.plan", status: "subscriptions.status" },
}));

// Mock db
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  then: vi.fn(),
};

vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn((pwd: string) => Promise.resolve(`hashed_${pwd}`)),
    compare: vi.fn((pwd: string, hash: string) => Promise.resolve(hash === `hashed_${pwd}`)),
  },
}));

describe("SaaS Auth - Module Structure", () => {
  it("exports SAAS_COOKIE constant", async () => {
    const mod = await import("./saasAuth");
    expect(mod.SAAS_COOKIE).toBe("entur_saas_session");
  });

  it("exports SESSION_DURATION_MS constant", async () => {
    const mod = await import("./saasAuth");
    expect(mod.SESSION_DURATION_MS).toBeGreaterThan(0);
    // Should be at least 7 days
    expect(mod.SESSION_DURATION_MS).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });

  it("exports isSuperAdmin function", async () => {
    const mod = await import("./saasAuth");
    expect(typeof mod.isSuperAdmin).toBe("function");
  });

  it("isSuperAdmin returns true for bruno@entur.com.br", async () => {
    const mod = await import("./saasAuth");
    expect(mod.isSuperAdmin("bruno@entur.com.br")).toBe(true);
  });

  it("isSuperAdmin returns false for other emails", async () => {
    const mod = await import("./saasAuth");
    expect(mod.isSuperAdmin("other@test.com")).toBe(false);
  });

  it("exports registerTenantAndUser function", async () => {
    const mod = await import("./saasAuth");
    expect(typeof mod.registerTenantAndUser).toBe("function");
  });

  it("exports loginWithEmail function", async () => {
    const mod = await import("./saasAuth");
    expect(typeof mod.loginWithEmail).toBe("function");
  });

  it("exports createSaasSessionToken function", async () => {
    const mod = await import("./saasAuth");
    expect(typeof mod.createSaasSessionToken).toBe("function");
  });

  it("exports verifySaasSession function", async () => {
    const mod = await import("./saasAuth");
    expect(typeof mod.verifySaasSession).toBe("function");
  });

  it("exports checkTenantAccess function", async () => {
    const mod = await import("./saasAuth");
    expect(typeof mod.checkTenantAccess).toBe("function");
  });

  it("exports listAllTenantsAdmin function", async () => {
    const mod = await import("./saasAuth");
    expect(typeof mod.listAllTenantsAdmin).toBe("function");
  });

  it("exports updateFreemiumPeriod function", async () => {
    const mod = await import("./saasAuth");
    expect(typeof mod.updateFreemiumPeriod).toBe("function");
  });

  it("exports updateTenantPlan function", async () => {
    const mod = await import("./saasAuth");
    expect(typeof mod.updateTenantPlan).toBe("function");
  });
});

describe("SaaS Auth - verifySaasSession", () => {
  it("returns null for empty token", async () => {
    const mod = await import("./saasAuth");
    const result = await mod.verifySaasSession(undefined);
    expect(result).toBeNull();
  });

  it("returns null for empty string token", async () => {
    const mod = await import("./saasAuth");
    const result = await mod.verifySaasSession("");
    expect(result).toBeNull();
  });

  it("returns null for invalid JWT token", async () => {
    const mod = await import("./saasAuth");
    const result = await mod.verifySaasSession("invalid.token.here");
    expect(result).toBeNull();
  });
});

describe("SaaS Auth - createSaasSessionToken", () => {
  it("creates a valid JWT token string", async () => {
    const mod = await import("./saasAuth");
    const token = await mod.createSaasSessionToken({
      userId: 1,
      tenantId: 1,
      email: "test@test.com",
      name: "Test User",
      role: "admin",
    });
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
  });

  it("token can be verified back", async () => {
    const mod = await import("./saasAuth");
    const token = await mod.createSaasSessionToken({
      userId: 42,
      tenantId: 7,
      email: "verify@test.com",
      name: "Verify User",
      role: "user",
    });
    const session = await mod.verifySaasSession(token);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe(42);
    expect(session?.tenantId).toBe(7);
    expect(session?.email).toBe("verify@test.com");
  });
});

describe("Hotmart Webhook - Module Structure", () => {
  it("exports handleHotmartWebhook function", async () => {
    const mod = await import("./hotmartWebhook");
    expect(typeof mod.handleHotmartWebhook).toBe("function");
  });
});
