import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

/**
 * The superAdminDash router uses its own cookie-based auth via requireSuperAdmin().
 * It reads the `entur_saas_session` cookie from ctx.req.headers.cookie,
 * verifies the JWT, and checks isSuperAdmin(email).
 * 
 * For tests, we mock the saasAuth module to control authentication.
 */

// Mock saasAuth module
vi.mock("./saasAuth", async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    verifySaasSession: vi.fn(async (token: string | undefined) => {
      if (token === "valid-super-admin-token") {
        return { userId: 1, tenantId: 1, email: "bruno@entur.com.br", name: "Bruno", role: "admin" };
      }
      if (token === "valid-regular-user-token") {
        return { userId: 99, tenantId: 5, email: "user@example.com", name: "Regular User", role: "user" };
      }
      return null;
    }),
    isSuperAdmin: vi.fn((email: string) => email.toLowerCase() === "bruno@entur.com.br"),
  };
});

function createContext(cookieValue?: string): TrpcContext {
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

  return {
    user,
    saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },
    req: {
      protocol: "https",
      hostname: "test.manus.computer",
      headers: {
        cookie: cookieValue ? `entur_saas_session=${cookieValue}` : "",
      },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("superAdminDash", () => {
  describe("security - unauthenticated users (no cookie)", () => {
    it("overview rejects when no cookie present", async () => {
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.superAdminDash.overview()).rejects.toThrow("Acesso negado");
    });

    it("tenantsList rejects when no cookie present", async () => {
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.superAdminDash.tenantsList({ page: 1, pageSize: 10 })).rejects.toThrow("Acesso negado");
    });

    it("alerts rejects when no cookie present", async () => {
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.superAdminDash.alerts()).rejects.toThrow("Acesso negado");
    });
  });

  describe("security - non-super-admin users", () => {
    it("overview rejects regular users", async () => {
      const ctx = createContext("valid-regular-user-token");
      const caller = appRouter.createCaller(ctx);
      await expect(caller.superAdminDash.overview()).rejects.toThrow("Acesso negado");
    });

    it("tenantsList rejects regular users", async () => {
      const ctx = createContext("valid-regular-user-token");
      const caller = appRouter.createCaller(ctx);
      await expect(caller.superAdminDash.tenantsList({ page: 1, pageSize: 10 })).rejects.toThrow("Acesso negado");
    });

    it("tenantDetail rejects regular users", async () => {
      const ctx = createContext("valid-regular-user-token");
      const caller = appRouter.createCaller(ctx);
      await expect(caller.superAdminDash.tenantDetail({ tenantId: 1 })).rejects.toThrow("Acesso negado");
    });

    it("featureAdoption rejects regular users", async () => {
      const ctx = createContext("valid-regular-user-token");
      const caller = appRouter.createCaller(ctx);
      await expect(caller.superAdminDash.featureAdoption()).rejects.toThrow("Acesso negado");
    });

    it("operationalHealth rejects regular users", async () => {
      const ctx = createContext("valid-regular-user-token");
      const caller = appRouter.createCaller(ctx);
      await expect(caller.superAdminDash.operationalHealth()).rejects.toThrow("Acesso negado");
    });

    it("commercialExpansion rejects regular users", async () => {
      const ctx = createContext("valid-regular-user-token");
      const caller = appRouter.createCaller(ctx);
      await expect(caller.superAdminDash.commercialExpansion()).rejects.toThrow("Acesso negado");
    });

    it("strategicHelp rejects regular users", async () => {
      const ctx = createContext("valid-regular-user-token");
      const caller = appRouter.createCaller(ctx);
      await expect(caller.superAdminDash.strategicHelp({ tenantId: 1 })).rejects.toThrow("Acesso negado");
    });
  });

  describe("super admin access (valid super admin cookie)", () => {
    it("overview returns data for super admin", async () => {
      const ctx = createContext("valid-super-admin-token");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.superAdminDash.overview();
      expect(result).toBeDefined();
      expect(typeof result.tenantsActive).toBe("number");
      expect(typeof result.tenantsTotal).toBe("number");
      expect(typeof result.usersActive).toBe("number");
      expect(typeof result.dealsCreatedMonth).toBe("number");
      expect(typeof result.wonCentsMonth).toBe("number");
      expect(typeof result.mrrCents).toBe("number");
    });

    it("tenantsList returns paginated data for super admin", async () => {
      const ctx = createContext("valid-super-admin-token");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.superAdminDash.tenantsList({ page: 1, pageSize: 10 });
      expect(result).toBeDefined();
      expect(typeof result.total).toBe("number");
      expect(Array.isArray(result.tenants)).toBe(true);
    });

    it("alerts returns categorized alerts for super admin", async () => {
      const ctx = createContext("valid-super-admin-token");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.superAdminDash.alerts();
      expect(result).toBeDefined();
      expect(Array.isArray(result.waDisconnected)).toBe(true);
      expect(Array.isArray(result.noActivity)).toBe(true);
      expect(Array.isArray(result.overdue)).toBe(true);
      expect(Array.isArray(result.lowAdoption)).toBe(true);
    });

    it("overviewCharts returns chart data for super admin", async () => {
      const ctx = createContext("valid-super-admin-token");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.superAdminDash.overviewCharts();
      expect(result).toBeDefined();
      expect(Array.isArray(result.tenantsPerMonth)).toBe(true);
      expect(Array.isArray(result.dealsPerMonth)).toBe(true);
      expect(Array.isArray(result.waPerMonth)).toBe(true);
      expect(Array.isArray(result.planDistribution)).toBe(true);
    });

    it("featureAdoption returns adoption rates for super admin", async () => {
      const ctx = createContext("valid-super-admin-token");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.superAdminDash.featureAdoption();
      expect(result).toBeDefined();
      expect(typeof result.totalActive).toBe("number");
      expect(Array.isArray(result.features)).toBe(true);
    });

    it("operationalHealth returns health metrics for super admin", async () => {
      const ctx = createContext("valid-super-admin-token");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.superAdminDash.operationalHealth();
      expect(result).toBeDefined();
      expect(typeof result.waConnected).toBe("number");
      expect(typeof result.waDisconnected).toBe("number");
      expect(typeof result.jobsFailed24h).toBe("number");
    });

    it("commercialExpansion returns commercial data for super admin", async () => {
      const ctx = createContext("valid-super-admin-token");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.superAdminDash.commercialExpansion();
      expect(result).toBeDefined();
      expect(Array.isArray(result.trials)).toBe(true);
      expect(Array.isArray(result.upgradeCandidates)).toBe(true);
      expect(Array.isArray(result.churnRisk)).toBe(true);
    });
  });
});
