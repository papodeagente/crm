import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthContext(userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: "test-user-" + userId,
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    saasUser: { userId, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("preferences", () => {
  const tenantId = 1;
  const ctx = createAuthContext(999); // Use a unique userId to avoid conflicts

  it("returns null for non-existent preference", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.preferences.get({ tenantId, key: "nonexistent_key_xyz" });
    expect(result).toEqual({ key: "nonexistent_key_xyz", value: null });
  });

  it("sets and gets a preference", async () => {
    const caller = appRouter.createCaller(ctx);
    await caller.preferences.set({ tenantId, key: "test_pref_pipeline", value: "42" });
    const result = await caller.preferences.get({ tenantId, key: "test_pref_pipeline" });
    expect(result).toEqual({ key: "test_pref_pipeline", value: "42" });
  });

  it("updates an existing preference", async () => {
    const caller = appRouter.createCaller(ctx);
    await caller.preferences.set({ tenantId, key: "test_pref_pipeline", value: "99" });
    const result = await caller.preferences.get({ tenantId, key: "test_pref_pipeline" });
    expect(result).toEqual({ key: "test_pref_pipeline", value: "99" });
  });

  it("getAll returns all preferences for user+tenant", async () => {
    const caller = appRouter.createCaller(ctx);
    await caller.preferences.set({ tenantId, key: "test_pref_a", value: "alpha" });
    await caller.preferences.set({ tenantId, key: "test_pref_b", value: "beta" });
    const all = await caller.preferences.getAll({ tenantId });
    expect(all).toHaveProperty("test_pref_a", "alpha");
    expect(all).toHaveProperty("test_pref_b", "beta");
  });

  it("preferences are isolated per user", async () => {
    const ctx2 = createAuthContext(998);
    const caller1 = appRouter.createCaller(ctx);
    const caller2 = appRouter.createCaller(ctx2);
    await caller1.preferences.set({ tenantId, key: "isolated_key", value: "user999" });
    const result = await caller2.preferences.get({ tenantId, key: "isolated_key" });
    expect(result.value).toBeNull();
  });
});
