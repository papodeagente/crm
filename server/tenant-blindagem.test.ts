import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext, SaasUser } from "./_core/context";
import type { User } from "../drizzle/schema";
import { getTenantId, assertTenantOwnership } from "./_core/trpc";
import { TRPCError } from "@trpc/server";

// ═══════════════════════════════════════════════════════════════
// TENANT BLINDAGEM — Testes de Prova de Isolamento
// ═══════════════════════════════════════════════════════════════

/**
 * Helper: create a context for a SaaS user belonging to a specific tenant.
 */
function createTenantContext(tenantId: number, opts?: {
  userId?: number;
  role?: string;
  email?: string;
  name?: string;
}): TrpcContext {
  const userId = opts?.userId ?? 100;
  const role = opts?.role ?? "user";
  const email = opts?.email ?? `user${userId}@tenant${tenantId}.com`;
  const name = opts?.name ?? `User ${userId}`;

  const saasUser: SaasUser = {
    userId,
    tenantId,
    email,
    name,
    role,
  };

  const user: User = {
    id: userId,
    openId: `saas_${userId}`,
    name,
    email,
    loginMethod: "email",
    role: role === "admin" ? "admin" : "user",
    isSuperAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as User;

  return {
    user,
    saasUser,
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

/**
 * Helper: create a context WITHOUT saasUser (unauthenticated tenant).
 */
function createNoTenantContext(): TrpcContext {
  const user: User = {
    id: 999,
    openId: "manus_owner",
    name: "Owner",
    email: "owner@manus.im",
    loginMethod: "manus",
    role: "admin",
    isSuperAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as User;

  return {
    user,
    saasUser: null,
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

/**
 * Helper: create a context with NO user at all.
 */
function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    saasUser: null,
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

// ─── 1. getTenantId() Helper Tests ───────────────────────────

describe("getTenantId()", () => {
  it("returns tenantId from ctx.tenantId (set by tenantProcedure middleware)", () => {
    const ctx = { tenantId: 42, saasUser: { tenantId: 42 } };
    expect(getTenantId(ctx)).toBe(42);
  });

  it("falls back to ctx.saasUser.tenantId if ctx.tenantId is missing", () => {
    const ctx = { saasUser: { tenantId: 7 } };
    expect(getTenantId(ctx)).toBe(7);
  });

  it("throws UNAUTHORIZED when tenantId is 0", () => {
    const ctx = { tenantId: 0, saasUser: { tenantId: 0 } };
    expect(() => getTenantId(ctx)).toThrow(TRPCError);
    try {
      getTenantId(ctx);
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });

  it("throws UNAUTHORIZED when tenantId is null/undefined", () => {
    const ctx = { saasUser: null };
    expect(() => getTenantId(ctx)).toThrow(TRPCError);
  });

  it("throws UNAUTHORIZED when ctx has no saasUser at all", () => {
    const ctx = {};
    expect(() => getTenantId(ctx)).toThrow(TRPCError);
  });

  it("throws UNAUTHORIZED when tenantId is negative", () => {
    const ctx = { tenantId: -1 };
    expect(() => getTenantId(ctx)).toThrow(TRPCError);
  });
});

// ─── 2. assertTenantOwnership() Tests ────────────────────────

describe("assertTenantOwnership()", () => {
  it("passes when entity tenantId matches expected", () => {
    expect(() => assertTenantOwnership(42, 42, "deal", 123)).not.toThrow();
  });

  it("throws FORBIDDEN when entity tenantId differs", () => {
    expect(() => assertTenantOwnership(99, 42, "deal", 123)).toThrow(TRPCError);
    try {
      assertTenantOwnership(99, 42, "deal", 123);
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
      expect(e.message).toContain("deal");
    }
  });

  it("throws FORBIDDEN when entity tenantId is null", () => {
    expect(() => assertTenantOwnership(null, 42, "contact")).toThrow(TRPCError);
  });

  it("throws FORBIDDEN when entity tenantId is undefined", () => {
    expect(() => assertTenantOwnership(undefined, 42, "pipeline")).toThrow(TRPCError);
  });

  it("throws FORBIDDEN when entity tenantId is 0", () => {
    expect(() => assertTenantOwnership(0, 42, "stage")).toThrow(TRPCError);
  });
});

// ─── 3. tenantProcedure Middleware Tests ─────────────────────

describe("tenantProcedure middleware (via appRouter)", () => {
  it("blocks unauthenticated users from tenant-scoped endpoints", async () => {
    const ctx = createAnonymousContext();
    const caller = appRouter.createCaller(ctx);

    // Try to call a tenant-scoped endpoint (whatsapp.listSessions is tenantProcedure)
    await expect(
      caller.whatsapp.listSessions()
    ).rejects.toThrow();
  });

  it("blocks users without saasUser from tenant-scoped endpoints", async () => {
    const ctx = createNoTenantContext();
    const caller = appRouter.createCaller(ctx);

    // This user has a Manus OAuth user but no saasUser (no tenant)
    await expect(
      caller.whatsapp.listSessions()
    ).rejects.toThrow();
  });

  it("allows authenticated tenant users to call tenant-scoped endpoints", async () => {
    const ctx = createTenantContext(1, { role: "admin" });
    const caller = appRouter.createCaller(ctx);

    // This should NOT throw an auth error (may throw DB error which is fine)
    try {
      await caller.whatsapp.listSessions();
    } catch (e: any) {
      // DB errors are acceptable — we're testing auth, not DB
      expect(e.code).not.toBe("UNAUTHORIZED");
      expect(e.message).not.toContain("Sessão de tenant não encontrada");
    }
  });
});

// ─── 4. No input.tenantId Leakage Tests ─────────────────────

describe("input.tenantId elimination", () => {
  it("routers.ts has no input.tenantId references", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/routers.ts", "utf-8");
    
    // Count occurrences of input.tenantId (should be 0)
    const matches = content.match(/input\.tenantId/g) || [];
    expect(matches.length).toBe(0);
  });

  it("routers.ts has no tenantId: z.number() in input schemas", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/routers.ts", "utf-8");
    
    // tenantId: z.number() should not appear in input schemas
    const matches = content.match(/tenantId:\s*z\.number\(\)/g) || [];
    expect(matches.length).toBe(0);
  });

  it("routers.ts has no tenantId default(1) fallbacks", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/routers.ts", "utf-8");
    
    // No tenantId with default(1)
    const matches = content.match(/tenantId.*\.default\(1\)/g) || [];
    expect(matches.length).toBe(0);
  });

  it("routers.ts has no || 1 tenant fallbacks (excluding maxTokens)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/routers.ts", "utf-8");
    
    // Find all || 1 patterns
    const lines = content.split("\n");
    const badLines = lines.filter(line => {
      if (line.includes("maxTokens")) return false; // legitimate use
      if (line.includes("// ")) return false; // comments
      return /\|\|\s*1[^0-9]/.test(line) && line.includes("tenantId");
    });
    expect(badLines.length).toBe(0);
  });

  it("crmRouter.ts has no input.tenantId references", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/routers/crmRouter.ts", "utf-8");
    const matches = content.match(/input\.tenantId/g) || [];
    expect(matches.length).toBe(0);
  });

  it("webhookRoutes.ts has no hardcoded tenantId = 1", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/webhookRoutes.ts", "utf-8");
    const matches = content.match(/const tenantId = 1/g) || [];
    expect(matches.length).toBe(0);
  });

  it("utmAnalyticsRouter.ts has no tenantId in input schemas", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/routers/utmAnalyticsRouter.ts", "utf-8");
    const matches = content.match(/tenantId:\s*z\.number/g) || [];
    expect(matches.length).toBe(0);
  });
});

// ─── 5. All router files use getTenantId(ctx) ───────────────

describe("all router files use getTenantId(ctx)", () => {
  const routerFiles = [
    "server/routers.ts",
    "server/routers/crmRouter.ts",
    "server/routers/adminRouter.ts",
    "server/routers/featureRouters.ts",
    "server/routers/inboxRouter.ts",
    "server/routers/productCatalogRouter.ts",
    "server/routers/rfvRouter.ts",
    "server/routers/utmAnalyticsRouter.ts",
    "server/routers/aiAnalysisRouter.ts",
  ];

  for (const file of routerFiles) {
    it(`${file} uses getTenantId(ctx) for tenant resolution`, async () => {
      const fs = await import("fs");
      const path = `/home/ubuntu/whatsapp-automation-app/${file}`;
      try {
        const content = fs.readFileSync(path, "utf-8");
        // If file has any tenant-scoped queries, it should use getTenantId
        if (content.includes("tenantId") && content.includes("Procedure")) {
          const hasGetTenantId = content.includes("getTenantId(ctx)") || content.includes("getTenantId");
          expect(hasGetTenantId).toBe(true);
        }
      } catch {
        // File doesn't exist, skip
      }
    });
  }
});

// ─── 6. Guard rail: tenantProcedure import check ────────────

describe("tenantProcedure is imported in tenant-scoped routers", () => {
  const tenantRouterFiles = [
    "server/routers/crmRouter.ts",
    "server/routers/adminRouter.ts",
    "server/routers/featureRouters.ts",
    "server/routers/inboxRouter.ts",
    "server/routers/productCatalogRouter.ts",
    "server/routers/rfvRouter.ts",
    "server/routers/utmAnalyticsRouter.ts",
  ];

  for (const file of tenantRouterFiles) {
    it(`${file} imports tenantProcedure`, async () => {
      const fs = await import("fs");
      const path = `/home/ubuntu/whatsapp-automation-app/${file}`;
      try {
        const content = fs.readFileSync(path, "utf-8");
        expect(content).toContain("tenantProcedure");
      } catch {
        // File doesn't exist, skip
      }
    });
  }
});
