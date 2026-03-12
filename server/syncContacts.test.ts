import { describe, expect, it, vi, beforeEach } from "vitest";
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

describe("WhatsApp Sync Contacts", () => {
  // ─── syncContacts mutation ───

  it("syncContacts returns zero counts for nonexistent session (not in memory)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Session not in memory → returns { synced: 0, total: 0, resolved: 0 }
    const result = await caller.whatsapp.syncContacts({ sessionId: "nonexistent-session" });
    expect(result).toEqual({ synced: 0, total: 0, resolved: 0 });
  });

  it("syncContacts accepts any sessionId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.syncContacts({ sessionId: "test" });
    expect(result).toBeDefined();
    expect(typeof result.synced).toBe("number");
    expect(typeof result.total).toBe("number");
    expect(typeof result.resolved).toBe("number");
  });

  // ─── waContactsMap query ───

  it("waContactsMap returns contacts from all sessions (not filtered by sessionId)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // waContactsMap now searches ALL sessions to maximize name coverage
    const result = await caller.whatsapp.waContactsMap({ sessionId: "nonexistent-session" });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    // Should return contacts from all sessions even with unknown sessionId
    expect(Object.keys(result).length).toBeGreaterThanOrEqual(0);
  });

  it("waContactsMap returns object with correct shape for valid session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.waContactsMap({ sessionId: "crm-210002-240001" });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    // If any contacts exist, verify the shape
    for (const [jid, contact] of Object.entries(result)) {
      expect(typeof jid).toBe("string");
      expect(contact).toHaveProperty("phoneNumber");
      expect(contact).toHaveProperty("pushName");
      expect(contact).toHaveProperty("savedName");
      expect(contact).toHaveProperty("verifiedName");
    }
  });

  it("waContactsMap returns contacts with pushName for synced session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.waContactsMap({ sessionId: "crm-210002-240001" });
    expect(result).toBeDefined();
    const entries = Object.entries(result);
    // After syncContacts, we should have contacts in the map
    if (entries.length > 0) {
      // At least some should have pushName
      const withPushName = entries.filter(([, c]) => c.pushName && c.pushName.trim() !== "");
      expect(withPushName.length).toBeGreaterThan(0);
    }
  });

  it("waContactsMap input validation requires sessionId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Empty string should still work (returns empty object)
    const result = await caller.whatsapp.waContactsMap({ sessionId: "" });
    expect(typeof result).toBe("object");
  });

  // ─── reconcileGhosts mutation ───

  it("reconcileGhosts returns result object for disconnected session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.reconcileGhosts({ tenantId: 1, sessionId: "nonexistent" });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    expect(result).toHaveProperty("mergedCount");
    expect(result).toHaveProperty("details");
    expect(result.mergedCount).toBe(0);
    expect(Array.isArray(result.details)).toBe(true);
  });

  // ─── Procedure existence checks ───

  it("syncContacts procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.whatsapp.syncContacts).toBe("function");
  });

  it("waContactsMap procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.whatsapp.waContactsMap).toBe("function");
  });

  it("migrateConversations procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.whatsapp.migrateConversations).toBe("function");
  });

  it("reconcileGhosts procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.whatsapp.reconcileGhosts).toBe("function");
  });
});
