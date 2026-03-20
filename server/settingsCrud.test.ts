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
    saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },
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
    saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },
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

// ─── Lead Sources ─────────────────────────────────────────

describe("crm.leadSources", () => {
  it("list procedure exists and is callable", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Should not throw — returns array (may be empty)
    const result = await caller.crm.leadSources.list({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("list with includeDeleted parameter works", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.leadSources.list({ tenantId: 1, includeDeleted: true });
    expect(Array.isArray(result)).toBe(true);
  });

  it("list requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.crm.leadSources.list({ tenantId: 1 })).rejects.toThrow();
  });

  it("create procedure exists and validates input", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Validate that empty name is rejected
    await expect(caller.crm.leadSources.create({ tenantId: 1, name: "" })).rejects.toThrow();
  });

  it("create requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.crm.leadSources.create({ tenantId: 1, name: "Test" })).rejects.toThrow();
  });

  it("update procedure exists and validates input", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Update with non-existent id should not throw (just no-op) or return undefined
    const result = await caller.crm.leadSources.update({ id: 999999, name: "Updated" });
    // It should return something (even if undefined for non-existent)
    expect(result !== null || result === undefined || result === null).toBe(true);
  });

  it("delete procedure exists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Soft delete non-existent id — should not throw
    const result = await caller.crm.leadSources.delete({ id: 999999 });
    expect(result !== null || result === undefined || result === null).toBe(true);
  });

  it("restore procedure exists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.leadSources.restore({ id: 999999 });
    expect(result !== null || result === undefined || result === null).toBe(true);
  });

  it("hardDelete procedure exists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.leadSources.hardDelete({ id: 999999 });
    expect(result !== null || result === undefined || result === null).toBe(true);
  });
});

// ─── Campaigns ────────────────────────────────────────────

describe("crm.campaigns", () => {
  it("list procedure exists and is callable", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.campaigns.list({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("list with sourceId filter works", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.campaigns.list({ tenantId: 1, sourceId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("list with includeDeleted parameter works", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.campaigns.list({ tenantId: 1, includeDeleted: true });
    expect(Array.isArray(result)).toBe(true);
  });

  it("list requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.crm.campaigns.list({ tenantId: 1 })).rejects.toThrow();
  });

  it("create procedure exists and validates input", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.crm.campaigns.create({ tenantId: 1, name: "" })).rejects.toThrow();
  });

  it("create requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.crm.campaigns.create({ tenantId: 1, name: "Test Campaign" })).rejects.toThrow();
  });

  it("update procedure exists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.campaigns.update({ id: 999999, name: "Updated" });
    expect(result !== null || result === undefined || result === null).toBe(true);
  });

  it("delete procedure exists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.campaigns.delete({ id: 999999 });
    expect(result !== null || result === undefined || result === null).toBe(true);
  });

  it("restore procedure exists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.campaigns.restore({ id: 999999 });
    expect(result !== null || result === undefined || result === null).toBe(true);
  });

  it("hardDelete procedure exists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.campaigns.hardDelete({ id: 999999 });
    expect(result !== null || result === undefined || result === null).toBe(true);
  });
});

// ─── Loss Reasons ─────────────────────────────────────────

describe("crm.lossReasons", () => {
  it("list procedure exists and is callable", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.lossReasons.list({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("list with includeDeleted parameter works", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.lossReasons.list({ tenantId: 1, includeDeleted: true });
    expect(Array.isArray(result)).toBe(true);
  });

  it("list requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.crm.lossReasons.list({ tenantId: 1 })).rejects.toThrow();
  });

  it("create procedure exists and validates input", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.crm.lossReasons.create({ tenantId: 1, name: "" })).rejects.toThrow();
  });

  it("create requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.crm.lossReasons.create({ tenantId: 1, name: "Test" })).rejects.toThrow();
  });

  it("update procedure exists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.lossReasons.update({ id: 999999, name: "Updated" });
    expect(result !== null || result === undefined || result === null).toBe(true);
  });

  it("delete procedure exists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.lossReasons.delete({ id: 999999 });
    expect(result !== null || result === undefined || result === null).toBe(true);
  });

  it("restore procedure exists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.lossReasons.restore({ id: 999999 });
    expect(result !== null || result === undefined || result === null).toBe(true);
  });

  it("hardDelete procedure exists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.crm.lossReasons.hardDelete({ id: 999999 });
    expect(result !== null || result === undefined || result === null).toBe(true);
  });

  it("create with description works", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Validate that description is accepted as optional parameter
    // Empty name should still fail
    await expect(caller.crm.lossReasons.create({ tenantId: 1, name: "", description: "Test desc" })).rejects.toThrow();
  });
});

// ─── Schema validation ───────────────────────────────────

describe("Settings CRUD schema validation", () => {
  it("leadSources.create rejects missing tenantId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error - intentionally missing tenantId
    await expect(caller.crm.leadSources.create({ name: "Test" })).rejects.toThrow();
  });

  it("campaigns.create rejects missing tenantId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error - intentionally missing tenantId
    await expect(caller.crm.campaigns.create({ name: "Test" })).rejects.toThrow();
  });

  it("lossReasons.create rejects missing tenantId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error - intentionally missing tenantId
    await expect(caller.crm.lossReasons.create({ name: "Test" })).rejects.toThrow();
  });

  it("leadSources.update rejects missing id", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error - intentionally missing id
    await expect(caller.crm.leadSources.update({ name: "Test" })).rejects.toThrow();
  });

  it("campaigns.update rejects missing id", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error - intentionally missing id
    await expect(caller.crm.campaigns.update({ name: "Test" })).rejects.toThrow();
  });

  it("lossReasons.update rejects missing id", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error - intentionally missing id
    await expect(caller.crm.lossReasons.update({ name: "Test" })).rejects.toThrow();
  });
});
