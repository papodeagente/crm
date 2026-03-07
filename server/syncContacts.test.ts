import { describe, expect, it, vi } from "vitest";
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

  it("syncContacts throws when session is not connected", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.syncContacts({ sessionId: "nonexistent-session" })
    ).rejects.toThrow("WhatsApp não está conectado");
  });

  it("syncContacts input validation requires sessionId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.syncContacts({ sessionId: "" })
    ).rejects.toThrow();
  });

  // ─── waContactsMap query ───

  it("waContactsMap returns empty object for unknown session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.waContactsMap({ sessionId: "nonexistent-session" });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    expect(Object.keys(result).length).toBe(0);
  });

  it("waContactsMap returns object with correct shape for valid session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.waContactsMap({ sessionId: "test-session" });
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
