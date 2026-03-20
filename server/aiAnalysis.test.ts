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

const caller = appRouter.createCaller(createAuthContext().ctx);

describe("aiAnalysis", () => {
  describe("getLatest", () => {
    it("should return null when no analysis exists for a deal", async () => {
      const result = await caller.aiAnalysis.getLatest({ dealId: 999999 });
      expect(result).toBeNull();
    });
  });

  describe("getHistory", () => {
    it("should return empty array when no analysis history exists", async () => {
      const result = await caller.aiAnalysis.getHistory({ dealId: 999999 });
      expect(result).toEqual([]);
    });
  });

  describe("analyze", () => {
    it("should throw NOT_FOUND when deal does not exist", async () => {
      await expect(
        caller.aiAnalysis.analyze({ dealId: 999999 })
      ).rejects.toThrow(/não encontrada/i);
    });

    it("should accept forceNew parameter", async () => {
      // Should still throw NOT_FOUND since deal doesn't exist
      await expect(
        caller.aiAnalysis.analyze({ dealId: 999999, forceNew: true })
      ).rejects.toThrow(/não encontrada/i);
    });
  });

  describe("router registration", () => {
    it("should have aiAnalysis router registered", () => {
      expect(caller.aiAnalysis).toBeDefined();
      expect(caller.aiAnalysis.getLatest).toBeDefined();
      expect(caller.aiAnalysis.getHistory).toBeDefined();
      expect(caller.aiAnalysis.analyze).toBeDefined();
    });
  });
});
