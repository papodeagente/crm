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

describe("Global Search Endpoint", () => {
  it("search.global returns contacts, deals, and tasks arrays", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.global({ tenantId: 1, query: "test" });

    expect(result).toBeDefined();
    expect(Array.isArray(result.contacts)).toBe(true);
    expect(Array.isArray(result.deals)).toBe(true);
    expect(Array.isArray(result.tasks)).toBe(true);
  });

  it("search.global returns empty arrays for non-matching query", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.global({ tenantId: 1, query: "zzzznonexistent99999" });

    expect(result.contacts.length).toBe(0);
    expect(result.deals.length).toBe(0);
    expect(result.tasks.length).toBe(0);
  });

  it("search.global returns empty arrays for non-existent tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.global({ tenantId: 99999, query: "a" });

    expect(result.contacts.length).toBe(0);
    expect(result.deals.length).toBe(0);
    expect(result.tasks.length).toBe(0);
  });

  it("search.global respects limit parameter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.global({ tenantId: 1, query: "a", limit: 2 });

    expect(result.contacts.length).toBeLessThanOrEqual(2);
    expect(result.deals.length).toBeLessThanOrEqual(2);
    expect(result.tasks.length).toBeLessThanOrEqual(2);
  });

  it("search.global contact results have correct shape", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.global({ tenantId: 1, query: "a" });

    if (result.contacts.length > 0) {
      const contact = result.contacts[0];
      expect(typeof contact.id).toBe("number");
      expect(typeof contact.name).toBe("string");
      expect(typeof contact.type).toBe("string");
      expect(["person", "company"]).toContain(contact.type);
      expect(typeof contact.lifecycleStage).toBe("string");
    }
  });

  it("search.global deal results have correct shape", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.global({ tenantId: 1, query: "a" });

    if (result.deals.length > 0) {
      const deal = result.deals[0];
      expect(typeof deal.id).toBe("number");
      expect(typeof deal.title).toBe("string");
      expect(typeof deal.valueCents).toBe("number");
      expect(typeof deal.status).toBe("string");
    }
  });

  it("search.global task results have correct shape", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.global({ tenantId: 1, query: "a" });

    if (result.tasks.length > 0) {
      const task = result.tasks[0];
      expect(typeof task.id).toBe("number");
      expect(typeof task.title).toBe("string");
      expect(typeof task.priority).toBe("string");
      expect(["low", "medium", "high", "urgent"]).toContain(task.priority);
    }
  });

  it("search.global rejects empty query", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.search.global({ tenantId: 1, query: "" })
    ).rejects.toThrow();
  });

  it("search.global rejects query longer than 100 chars", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.search.global({ tenantId: 1, query: "a".repeat(101) })
    ).rejects.toThrow();
  });
});
