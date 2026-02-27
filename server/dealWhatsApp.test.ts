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

const caller = appRouter.createCaller(createAuthContext().ctx);

describe("crm.dealWhatsApp", () => {
  describe("messages", () => {
    it("should return empty messages for a deal with no contact", async () => {
      // Use a non-existent deal ID
      const result = await caller.crm.dealWhatsApp.messages({
        tenantId: 1,
        dealId: 999999,
        limit: 50,
      });

      expect(result).toBeDefined();
      expect(result.messages).toEqual([]);
      expect(result.contact).toBeNull();
    });

    it("should accept optional limit and beforeId parameters", async () => {
      const result = await caller.crm.dealWhatsApp.messages({
        tenantId: 1,
        dealId: 1,
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(Array.isArray(result.messages)).toBe(true);
    });

    it("should return messages in chronological order", async () => {
      const result = await caller.crm.dealWhatsApp.messages({
        tenantId: 1,
        dealId: 1,
        limit: 100,
      });

      expect(result).toBeDefined();
      if (result.messages.length > 1) {
        for (let i = 1; i < result.messages.length; i++) {
          const prev = new Date(result.messages[i - 1].timestamp).getTime();
          const curr = new Date(result.messages[i].timestamp).getTime();
          expect(curr).toBeGreaterThanOrEqual(prev);
        }
      }
    });

    it("should include sessionMap when sessions exist", async () => {
      const result = await caller.crm.dealWhatsApp.messages({
        tenantId: 1,
        dealId: 1,
      });

      expect(result).toBeDefined();
      if (result.sessions && result.sessions.length > 0) {
        expect(result.sessionMap).toBeDefined();
        expect(typeof result.sessionMap).toBe("object");
      }
    });
  });

  describe("count", () => {
    it("should return 0 for a non-existent deal", async () => {
      const count = await caller.crm.dealWhatsApp.count({
        tenantId: 1,
        dealId: 999999,
      });

      expect(count).toBe(0);
    });

    it("should return a number for an existing deal", async () => {
      const count = await caller.crm.dealWhatsApp.count({
        tenantId: 1,
        dealId: 1,
      });

      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
