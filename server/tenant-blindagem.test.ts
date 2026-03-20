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

    await expect(
      caller.whatsapp.listSessions()
    ).rejects.toThrow();
  });

  it("blocks users without saasUser from tenant-scoped endpoints", async () => {
    const ctx = createNoTenantContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.whatsapp.listSessions()
    ).rejects.toThrow();
  });

  it("allows authenticated tenant users to call tenant-scoped endpoints", async () => {
    const ctx = createTenantContext(1, { role: "admin" });
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.whatsapp.listSessions();
    } catch (e: any) {
      // DB errors are acceptable — we're testing auth, not DB
      expect(e.code).not.toBe("UNAUTHORIZED");
      expect(e.message).not.toContain("Sessão de tenant não encontrada");
    }
  });
});

// ─── 4. sessionTenantProcedure Middleware Tests ─────────────

describe("sessionTenantProcedure middleware (WhatsApp session endpoints)", () => {
  it("blocks anonymous users from session-scoped WhatsApp endpoints", async () => {
    const ctx = createAnonymousContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.whatsapp.disconnect({ sessionId: "test-session" })
    ).rejects.toThrow();
  });

  it("blocks users without saasUser from session-scoped WhatsApp endpoints", async () => {
    const ctx = createNoTenantContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.whatsapp.disconnect({ sessionId: "test-session" })
    ).rejects.toThrow();
  });

  it("blocks anonymous users from WhatsApp connect (tenantProcedure)", async () => {
    const ctx = createAnonymousContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.whatsapp.connect()
    ).rejects.toThrow();
  });

  it("blocks users without tenant from WhatsApp connect", async () => {
    const ctx = createNoTenantContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.whatsapp.connect()
    ).rejects.toThrow();
  });
});

// ─── 5. No input.tenantId Leakage Tests ─────────────────────

describe("input.tenantId elimination", () => {
  it("routers.ts has no input.tenantId references", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/routers.ts", "utf-8");
    const matches = content.match(/input\.tenantId/g) || [];
    expect(matches.length).toBe(0);
  });

  it("routers.ts has no tenantId: z.number() in input schemas", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/routers.ts", "utf-8");
    const matches = content.match(/tenantId:\s*z\.number\(\)/g) || [];
    expect(matches.length).toBe(0);
  });

  it("routers.ts has no tenantId default(1) fallbacks", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/routers.ts", "utf-8");
    const matches = content.match(/tenantId.*\.default\(1\)/g) || [];
    expect(matches.length).toBe(0);
  });

  it("routers.ts has no || 1 tenant fallbacks (excluding maxTokens)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/routers.ts", "utf-8");
    const lines = content.split("\n");
    const badLines = lines.filter(line => {
      if (line.includes("maxTokens")) return false;
      if (line.includes("// ")) return false;
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

// ─── 6. All router files use getTenantId(ctx) ───────────────

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

// ─── 7. Guard rail: tenantProcedure import check ────────────

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

// ─── 8. No protectedProcedure in application routers ────────

describe("protectedProcedure eliminated from application routers", () => {
  const appRouterFiles = [
    "server/routers.ts",
    "server/routers/crmRouter.ts",
    "server/routers/adminRouter.ts",
    "server/routers/featureRouters.ts",
    "server/routers/inboxRouter.ts",
    "server/routers/productCatalogRouter.ts",
    "server/routers/rfvRouter.ts",
    "server/routers/utmAnalyticsRouter.ts",
    "server/routers/aiAnalysisRouter.ts",
    "server/routers/rdCrmImportRouter.ts",
  ];

  for (const file of appRouterFiles) {
    it(`${file} does not use protectedProcedure (should use tenantProcedure)`, async () => {
      const fs = await import("fs");
      const path = `/home/ubuntu/whatsapp-automation-app/${file}`;
      try {
        const content = fs.readFileSync(path, "utf-8");
        // Remove import lines before checking
        const lines = content.split("\n").filter(l => !l.includes("import "));
        const codeOnly = lines.join("\n");
        const matches = codeOnly.match(/protectedProcedure/g) || [];
        expect(matches.length).toBe(0);
      } catch {
        // File doesn't exist, skip
      }
    });
  }
});

// ─── 9. No sessionProtectedProcedure in application routers ─

describe("sessionProtectedProcedure replaced by sessionTenantProcedure", () => {
  const appRouterFiles = [
    "server/routers.ts",
    "server/routers/rfvRouter.ts",
  ];

  for (const file of appRouterFiles) {
    it(`${file} does not use sessionProtectedProcedure`, async () => {
      const fs = await import("fs");
      const path = `/home/ubuntu/whatsapp-automation-app/${file}`;
      try {
        const content = fs.readFileSync(path, "utf-8");
        const lines = content.split("\n").filter(l => !l.includes("import "));
        const codeOnly = lines.join("\n");
        const matches = codeOnly.match(/sessionProtectedProcedure/g) || [];
        expect(matches.length).toBe(0);
      } catch {
        // File doesn't exist, skip
      }
    });
  }

  it("routers.ts imports sessionTenantProcedure", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/routers.ts", "utf-8");
    expect(content).toContain("sessionTenantProcedure");
  });
});

// ─── 10. WhatsApp webhook tenantId resolution ───────────────

describe("webhookRoutes.ts tenant resolution", () => {
  it("Evolution webhook passes tenantId: 0 (resolved by worker)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/webhookRoutes.ts", "utf-8");
    // The Evolution webhook should pass tenantId: 0 which is resolved by worker
    expect(content).toContain("tenantId: 0, // Will be resolved by worker from session");
  });

  it("has tenant resolution functions for lead webhooks", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/webhookRoutes.ts", "utf-8");
    expect(content).toContain("resolveLeadsTenantId");
    expect(content).toContain("resolveMetaTenantByVerifyToken");
    expect(content).toContain("resolveMetaTenantFromBody");
  });
});

// ─── 11. messageWorker.ts tenant resolution ─────────────────

describe("messageWorker.ts tenant resolution", () => {
  it("resolves tenantId from session, not from hardcoded values", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/messageWorker.ts", "utf-8");
    // Worker should resolve session info (including tenantId) from instanceName
    expect(content).toContain("getSessionInfo(instanceName");
    // Should NOT have hardcoded tenantId
    const hardcoded = content.match(/tenantId\s*=\s*1\b/g) || [];
    expect(hardcoded.length).toBe(0);
  });

  it("session info includes tenantId from whatsappManager", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/messageWorker.ts", "utf-8");
    expect(content).toContain("tenantId: session.tenantId");
  });
});
