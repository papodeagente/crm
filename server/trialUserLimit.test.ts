/**
 * Tests for trial user limit (assertCanAddUser).
 *
 * Rules:
 * - Trial (any plan): max 1 user
 * - Active Start/Free: max 1 user
 * - Active Growth/Scale/Enterprise: unlimited (999)
 * - Legacy: no restrictions
 * - DB unavailable: fail-open
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Creates a mock DB that handles the two queries in assertCanAddUser:
 * 1. db.select().from(tenants).where(...).limit(1) → returns tenantData
 * 2. db.select({ count: ... }).from(crmUsers).where(...) → returns [{ count: userCount }]
 *
 * The key difference: query 1 uses .limit(), query 2 does NOT use .limit()
 */
function createMockDb(tenantData: any, userCount: number) {
  let queryIndex = 0;
  return {
    select: (fields?: any) => {
      const isCountQuery = fields && typeof fields === "object" && "count" in fields;
      return {
        from: () => ({
          where: () => {
            const result = {
              limit: () => {
                queryIndex++;
                // This is the tenant query (uses .limit())
                return Promise.resolve(tenantData ? [tenantData] : []);
              },
              // Make it thenable for queries without .limit() (count query)
              then: (resolve: any, reject?: any) => {
                queryIndex++;
                const promise = Promise.resolve([{ count: userCount }]);
                return promise.then(resolve, reject);
              },
            };
            return result;
          },
        }),
      };
    },
  };
}

describe("assertCanAddUser", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should allow adding user when trial has 0 users", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
      crmUsers: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue(
        createMockDb({ id: 1, isLegacy: false, billingStatus: "trialing", plan: "growth" }, 0)
      ),
    }));
    const { assertCanAddUser } = await import("./services/billingAccessService");
    await expect(assertCanAddUser(1)).resolves.toBeUndefined();
  });

  it("should BLOCK adding user when trial already has 1 user", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
      crmUsers: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue(
        createMockDb({ id: 1, isLegacy: false, billingStatus: "trialing", plan: "growth" }, 1)
      ),
    }));
    const { assertCanAddUser } = await import("./services/billingAccessService");
    await expect(assertCanAddUser(1)).rejects.toThrow("período de teste");
  });

  it("should BLOCK trial even if plan is Growth — throws FORBIDDEN", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
      crmUsers: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue(
        createMockDb({ id: 1, isLegacy: false, billingStatus: "trialing", plan: "growth" }, 1)
      ),
    }));
    const { assertCanAddUser } = await import("./services/billingAccessService");
    try {
      await assertCanAddUser(1);
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("FORBIDDEN");
      expect(err.message).toContain("upgrade");
    }
  });

  it("should allow adding user for active Growth plan with many users", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
      crmUsers: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue(
        createMockDb({ id: 1, isLegacy: false, billingStatus: "active", plan: "growth" }, 5)
      ),
    }));
    const { assertCanAddUser } = await import("./services/billingAccessService");
    await expect(assertCanAddUser(1)).resolves.toBeUndefined();
  });

  it("should BLOCK adding user for active Start plan with 1 user", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
      crmUsers: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue(
        createMockDb({ id: 1, isLegacy: false, billingStatus: "active", plan: "start" }, 1)
      ),
    }));
    const { assertCanAddUser } = await import("./services/billingAccessService");
    await expect(assertCanAddUser(1)).rejects.toThrow("plano Start");
  });

  it("should allow adding user for active Start plan with 0 users", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
      crmUsers: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue(
        createMockDb({ id: 1, isLegacy: false, billingStatus: "active", plan: "start" }, 0)
      ),
    }));
    const { assertCanAddUser } = await import("./services/billingAccessService");
    await expect(assertCanAddUser(1)).resolves.toBeUndefined();
  });

  it("should always allow legacy tenants regardless of user count", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
      crmUsers: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue(
        createMockDb({ id: 1, isLegacy: true, billingStatus: "active", plan: "start" }, 10)
      ),
    }));
    const { assertCanAddUser } = await import("./services/billingAccessService");
    await expect(assertCanAddUser(1)).resolves.toBeUndefined();
  });

  it("should fail-open when DB is unavailable", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
      crmUsers: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue(null),
    }));
    const { assertCanAddUser } = await import("./services/billingAccessService");
    await expect(assertCanAddUser(1)).resolves.toBeUndefined();
  });

  it("should throw NOT_FOUND for non-existent tenant", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
      crmUsers: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue(
        createMockDb(null, 0)
      ),
    }));
    const { assertCanAddUser } = await import("./services/billingAccessService");
    try {
      await assertCanAddUser(999);
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("NOT_FOUND");
    }
  });

  it("should allow active Scale plan with 50 users", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
      crmUsers: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue(
        createMockDb({ id: 1, isLegacy: false, billingStatus: "active", plan: "scale" }, 50)
      ),
    }));
    const { assertCanAddUser } = await import("./services/billingAccessService");
    await expect(assertCanAddUser(1)).resolves.toBeUndefined();
  });
});
