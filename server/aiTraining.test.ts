import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Test helpers ──
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(tenantId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    saasUser: { userId: 1, tenantId, role: "admin" as const, email: "admin@example.com", name: "Admin User" },
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

function createNonAdminContext(tenantId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    saasUser: { userId: 2, tenantId, role: "user" as const, email: "user@example.com", name: "Regular User" },
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

describe("AI Training Configs", () => {
  // Use a unique tenant ID to avoid collisions with real data
  const TEST_TENANT_ID = 99999;

  describe("ai.trainingConfigs.list", () => {
    it("returns an array (possibly empty) for admin users", async () => {
      const ctx = createAdminContext(TEST_TENANT_ID);
      const caller = appRouter.createCaller(ctx);
      const result = await caller.ai.trainingConfigs.list();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("ai.trainingConfigs.upsert", () => {
    it("creates a new training config for suggestion type", async () => {
      const ctx = createAdminContext(TEST_TENANT_ID);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.ai.trainingConfigs.upsert({
        configType: "suggestion",
        instructions: "Sempre cumprimente o cliente pelo nome. Use linguagem informal.",
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty("id");
    });

    it("updates an existing training config", async () => {
      const ctx = createAdminContext(TEST_TENANT_ID);
      const caller = appRouter.createCaller(ctx);

      // First create
      await caller.ai.trainingConfigs.upsert({
        configType: "summary",
        instructions: "Instruções originais",
      });

      // Then update
      const result = await caller.ai.trainingConfigs.upsert({
        configType: "summary",
        instructions: "Instruções atualizadas com mais detalhes",
      });

      expect(result).toBeDefined();
      expect(result.updated).toBe(true);
    });

    it("validates minimum instruction length", async () => {
      const ctx = createAdminContext(TEST_TENANT_ID);
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.ai.trainingConfigs.upsert({
          configType: "analysis",
          instructions: "", // empty string should fail
        })
      ).rejects.toThrow();
    });
  });

  describe("ai.trainingConfigs.get", () => {
    it("returns a config that was previously created", async () => {
      const ctx = createAdminContext(TEST_TENANT_ID);
      const caller = appRouter.createCaller(ctx);

      // Ensure it exists
      await caller.ai.trainingConfigs.upsert({
        configType: "suggestion",
        instructions: "Instruções de teste para get",
      });

      const result = await caller.ai.trainingConfigs.get({ configType: "suggestion" });
      expect(result).toBeDefined();
      expect(result?.configType).toBe("suggestion");
      expect(result?.instructions).toContain("Instruções de teste para get");
    });

    it("returns null for non-existent config type", async () => {
      const ctx = createAdminContext(TEST_TENANT_ID);
      const caller = appRouter.createCaller(ctx);

      // Delete first to ensure it doesn't exist
      try {
        await caller.ai.trainingConfigs.delete({ configType: "analysis" });
      } catch { /* ignore */ }

      const result = await caller.ai.trainingConfigs.get({ configType: "analysis" });
      expect(result).toBeNull();
    });
  });

  describe("ai.trainingConfigs.delete", () => {
    it("deletes an existing training config", async () => {
      const ctx = createAdminContext(TEST_TENANT_ID);
      const caller = appRouter.createCaller(ctx);

      // Create first
      await caller.ai.trainingConfigs.upsert({
        configType: "analysis",
        instructions: "Instruções para deletar",
      });

      // Delete
      const result = await caller.ai.trainingConfigs.delete({ configType: "analysis" });
      expect(result).toEqual({ success: true });

      // Verify it's gone
      const check = await caller.ai.trainingConfigs.get({ configType: "analysis" });
      expect(check).toBeNull();
    });
  });

  describe("ai.trainingConfigs.list after operations", () => {
    it("lists all configs for the tenant", async () => {
      const ctx = createAdminContext(TEST_TENANT_ID);
      const caller = appRouter.createCaller(ctx);

      // Create suggestion and summary
      await caller.ai.trainingConfigs.upsert({
        configType: "suggestion",
        instructions: "Instruções de sugestão",
      });
      await caller.ai.trainingConfigs.upsert({
        configType: "summary",
        instructions: "Instruções de resumo",
      });

      const list = await caller.ai.trainingConfigs.list();
      expect(list.length).toBeGreaterThanOrEqual(2);

      const types = list.map((c: any) => c.configType);
      expect(types).toContain("suggestion");
      expect(types).toContain("summary");
    });
  });

  // Cleanup: delete test data
  describe("cleanup", () => {
    it("removes test training configs", async () => {
      const ctx = createAdminContext(TEST_TENANT_ID);
      const caller = appRouter.createCaller(ctx);

      for (const configType of ["suggestion", "summary", "analysis"] as const) {
        try {
          await caller.ai.trainingConfigs.delete({ configType });
        } catch { /* ignore */ }
      }
    });
  });
});

describe("AI Models endpoint", () => {
  it("returns OpenAI models list", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const models = await caller.ai.models({ provider: "openai" });
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty("id");
    expect(models[0]).toHaveProperty("name");
  });

  it("returns Anthropic models list", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const models = await caller.ai.models({ provider: "anthropic" });
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty("id");
    expect(models[0]).toHaveProperty("name");
  });
});
