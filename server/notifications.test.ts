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

describe("Notifications Endpoints", () => {
  it("notifications.list returns an array", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.list({ tenantId: 1 });

    expect(Array.isArray(result)).toBe(true);
  });

  it("notifications.list supports onlyUnread filter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.list({ tenantId: 1, onlyUnread: true });

    expect(Array.isArray(result)).toBe(true);
    // All returned should be unread
    for (const n of result) {
      expect(n.isRead).toBe(false);
    }
  });

  it("notifications.list supports limit and offset", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.list({ tenantId: 1, limit: 5, offset: 0 });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("notifications.unreadCount returns a number", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.unreadCount({ tenantId: 1 });

    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("notifications.unreadCount returns 0 for non-existent tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.unreadCount({ tenantId: 99999 });

    expect(result).toBe(0);
  });

  it("notifications.markRead returns success", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Use a non-existent ID — should still succeed (no-op)
    const result = await caller.notifications.markRead({ id: 999999 });

    expect(result).toEqual({ success: true });
  });

  it("notifications.markAllRead returns success", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.markAllRead({ tenantId: 1 });

    expect(result).toEqual({ success: true });
  });

  it("notification items have correct shape", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.list({ tenantId: 1 });

    if (result.length > 0) {
      const n = result[0];
      expect(typeof n.id).toBe("number");
      expect(typeof n.tenantId).toBe("number");
      expect(typeof n.type).toBe("string");
      expect(typeof n.title).toBe("string");
      expect(typeof n.isRead).toBe("boolean");
      expect(typeof n.createdAt).toBe("number");
    }
  });

  it("notifications.list returns empty for non-existent tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.list({ tenantId: 99999 });

    expect(result.length).toBe(0);
  });
});
