import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

/**
 * Helper to create a mock context with configurable role and userId.
 */
function createContext(opts: {
  userId?: number;
  role?: "admin" | "user";
  tenantId?: number;
}): TrpcContext {
  const { userId = 1, role = "user", tenantId = 1 } = opts;
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    loginMethod: "manus",
    role: role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    saasUser: {
      userId,
      tenantId,
      role,
      email: user.email,
      name: user.name,
    },
    req: {
      protocol: "https",
      hostname: "test.manus.computer",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Visibility Service", () => {
  describe("visibilityService module", () => {
    it("exports correct VISIBILITY_PREF_KEYS", async () => {
      const { VISIBILITY_PREF_KEYS } = await import("./services/visibilityService");
      expect(VISIBILITY_PREF_KEYS).toEqual({
        deals: "visibility_deals",
        contacts: "visibility_contacts",
        accounts: "visibility_accounts",
      });
    });

    it("resolveVisibilityFilter returns geral for admin users", async () => {
      const { resolveVisibilityFilter } = await import("./services/visibilityService");
      const result = await resolveVisibilityFilter(1, 1, "deals", true);
      expect(result.mode).toBe("geral");
      expect(result.ownerUserIds).toBeUndefined();
    });

    it("resolveVisibilityFilter returns geral by default for non-admin without preference", async () => {
      const { resolveVisibilityFilter } = await import("./services/visibilityService");
      // Without any preference set, default is "geral"
      const result = await resolveVisibilityFilter(999, 1, "deals", false);
      expect(result.mode).toBe("geral");
      expect(result.ownerUserIds).toBeUndefined();
    });
  });

  describe("admin.users.getVisibility endpoint", () => {
    it("returns visibility modes for a user when called by admin", async () => {
      const ctx = createContext({ userId: 1, role: "admin", tenantId: 1 });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.admin.users.getVisibility({ userId: 2 });
      expect(result).toHaveProperty("deals");
      expect(result).toHaveProperty("contacts");
      expect(result).toHaveProperty("accounts");
      expect(["restrita", "equipe", "geral"]).toContain(result.deals);
      expect(["restrita", "equipe", "geral"]).toContain(result.contacts);
      expect(["restrita", "equipe", "geral"]).toContain(result.accounts);
    });

    it("rejects non-admin users from reading visibility settings", async () => {
      const ctx = createContext({ userId: 2, role: "user", tenantId: 1 });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.users.getVisibility({ userId: 3 })).rejects.toThrow();
    });
  });

  describe("admin.users.setVisibility endpoint", () => {
    it("sets visibility modes when called by admin", async () => {
      const ctx = createContext({ userId: 1, role: "admin", tenantId: 1 });
      const caller = appRouter.createCaller(ctx);

      // Set visibility for user 2
      const result = await caller.admin.users.setVisibility({
        userId: 2,
        deals: "restrita",
        contacts: "equipe",
        accounts: "geral",
      });
      expect(result).toEqual({ success: true });

      // Verify the settings were saved
      const modes = await caller.admin.users.getVisibility({ userId: 2 });
      expect(modes.deals).toBe("restrita");
      expect(modes.contacts).toBe("equipe");
      expect(modes.accounts).toBe("geral");
    });

    it("rejects non-admin users from changing visibility settings", async () => {
      const ctx = createContext({ userId: 2, role: "user", tenantId: 1 });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.admin.users.setVisibility({ userId: 3, deals: "restrita" })
      ).rejects.toThrow();
    });

    it("allows partial updates (only deals)", async () => {
      const ctx = createContext({ userId: 1, role: "admin", tenantId: 1 });
      const caller = appRouter.createCaller(ctx);

      // First set all to geral
      await caller.admin.users.setVisibility({
        userId: 3,
        deals: "geral",
        contacts: "geral",
        accounts: "geral",
      });

      // Then update only deals
      await caller.admin.users.setVisibility({
        userId: 3,
        deals: "equipe",
      });

      const modes = await caller.admin.users.getVisibility({ userId: 3 });
      expect(modes.deals).toBe("equipe");
      expect(modes.contacts).toBe("geral");
      expect(modes.accounts).toBe("geral");
    });
  });

  describe("resolveVisibilityFilter with saved preferences", () => {
    it("returns restrita mode with only user's own ID", async () => {
      const adminCtx = createContext({ userId: 1, role: "admin", tenantId: 1 });
      const adminCaller = appRouter.createCaller(adminCtx);

      // Set user 5 to restrita for deals
      await adminCaller.admin.users.setVisibility({
        userId: 5,
        deals: "restrita",
      });

      const { resolveVisibilityFilter } = await import("./services/visibilityService");
      const result = await resolveVisibilityFilter(5, 1, "deals", false);
      expect(result.mode).toBe("restrita");
      expect(result.ownerUserIds).toEqual([5]);
    });

    it("returns geral mode with undefined ownerUserIds", async () => {
      const adminCtx = createContext({ userId: 1, role: "admin", tenantId: 1 });
      const adminCaller = appRouter.createCaller(adminCtx);

      await adminCaller.admin.users.setVisibility({
        userId: 6,
        contacts: "geral",
      });

      const { resolveVisibilityFilter } = await import("./services/visibilityService");
      const result = await resolveVisibilityFilter(6, 1, "contacts", false);
      expect(result.mode).toBe("geral");
      expect(result.ownerUserIds).toBeUndefined();
    });

    it("admin always gets geral regardless of saved preference", async () => {
      const adminCtx = createContext({ userId: 1, role: "admin", tenantId: 1 });
      const adminCaller = appRouter.createCaller(adminCtx);

      // Even if we set admin's preference to restrita
      await adminCaller.admin.users.setVisibility({
        userId: 1,
        deals: "restrita",
      });

      const { resolveVisibilityFilter } = await import("./services/visibilityService");
      const result = await resolveVisibilityFilter(1, 1, "deals", true);
      expect(result.mode).toBe("geral");
      expect(result.ownerUserIds).toBeUndefined();
    });
  });

  describe("getAllVisibilityModes", () => {
    it("returns all three entity types", async () => {
      const { getAllVisibilityModes } = await import("./services/visibilityService");
      const modes = await getAllVisibilityModes(999, 1);
      expect(modes).toHaveProperty("deals");
      expect(modes).toHaveProperty("contacts");
      expect(modes).toHaveProperty("accounts");
    });

    it("returns geral as default for all entities", async () => {
      const { getAllVisibilityModes } = await import("./services/visibilityService");
      const modes = await getAllVisibilityModes(998, 1);
      expect(modes.deals).toBe("geral");
      expect(modes.contacts).toBe("geral");
      expect(modes.accounts).toBe("geral");
    });
  });

  describe("getTeamMateIds", () => {
    it("always includes the user themselves", async () => {
      const { getTeamMateIds } = await import("./services/visibilityService");
      const ids = await getTeamMateIds(999, 1);
      expect(ids).toContain(999);
    });
  });
});
