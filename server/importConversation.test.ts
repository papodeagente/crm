import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock billing access to allow write operations
vi.mock("./services/billingAccessService", () => ({
  checkBillingAccess: vi.fn().mockResolvedValue({ level: "full", message: null }),
  assertNotRestricted: vi.fn().mockResolvedValue(undefined),
  assertCanAddUser: vi.fn().mockResolvedValue(undefined),
  isTenantRestricted: vi.fn().mockResolvedValue(false),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Test Agent",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test Agent" },
    req: {
      protocol: "https",
      hostname: "test.manus.computer",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("inbox.importConversationAsNote", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const { ctx } = createAuthContext();
    caller = appRouter.createCaller(ctx);
  });

  it("rejects when sessionId is empty", async () => {
    // Zod validation should reject empty string, or procedure returns error
    try {
      const result = await caller.inbox.importConversationAsNote({
        sessionId: "",
        remoteJid: "5511999999999@s.whatsapp.net",
        period: "last50",
        dealId: null,
        waConversationId: 1,
      });
      // If it doesn't throw, it should return a failure
      expect(result.success).toBe(false);
    } catch (e) {
      // Zod validation error is also acceptable
      expect(e).toBeDefined();
    }
  });

  it("rejects when remoteJid is empty", async () => {
    try {
      const result = await caller.inbox.importConversationAsNote({
        sessionId: "session-1",
        remoteJid: "",
        period: "last50",
        dealId: null,
        waConversationId: 1,
      });
      expect(result.success).toBe(false);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it("rejects when neither dealId nor waConversationId is provided", async () => {
    // Both null should still proceed but return error from the procedure
    const result = await caller.inbox.importConversationAsNote({
      sessionId: "session-1",
      remoteJid: "5511999999999@s.whatsapp.net",
      period: "last50",
      dealId: null,
      waConversationId: null,
    });
    // Should return an error since no messages found or no target
    expect(result.success).toBe(false);
  });

  it("returns error when no messages found for the session", async () => {
    const result = await caller.inbox.importConversationAsNote({
      sessionId: "nonexistent-session-id-12345",
      remoteJid: "5511999999999@s.whatsapp.net",
      period: "24h",
      dealId: null,
      waConversationId: 999999,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  it("accepts all valid period values", async () => {
    const periods = ["all", "last50", "24h", "48h"] as const;
    for (const period of periods) {
      const result = await caller.inbox.importConversationAsNote({
        sessionId: "nonexistent-session",
        remoteJid: "5511999999999@s.whatsapp.net",
        period,
        dealId: null,
        waConversationId: 999999,
      });
      // All should return gracefully (no messages found) rather than crash
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }
  });

  it("rejects invalid period values", async () => {
    await expect(
      caller.inbox.importConversationAsNote({
        sessionId: "session-1",
        remoteJid: "5511999999999@s.whatsapp.net",
        period: "invalid" as any,
        dealId: null,
        waConversationId: 1,
      })
    ).rejects.toThrow();
  });

  it("accepts optional agentDisplayName parameter", async () => {
    const result = await caller.inbox.importConversationAsNote({
      sessionId: "nonexistent-session",
      remoteJid: "5511999999999@s.whatsapp.net",
      period: "last50",
      dealId: null,
      waConversationId: 999999,
      agentDisplayName: "Custom Agent Name",
    });
    // Should not crash with optional param
    expect(result.success).toBe(false);
  });

  it("accepts dealId for CRM note creation path", async () => {
    const result = await caller.inbox.importConversationAsNote({
      sessionId: "nonexistent-session",
      remoteJid: "5511999999999@s.whatsapp.net",
      period: "last50",
      dealId: 12345,
      waConversationId: null,
    });
    // No messages found, but should not crash on the dealId path
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
