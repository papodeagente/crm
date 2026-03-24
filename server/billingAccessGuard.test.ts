/**
 * Tests for billing access guard (restrictedWriteGuard middleware)
 * and cooling deals query logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── assertNotRestricted unit tests ───
describe("assertNotRestricted", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should NOT throw for legacy tenants", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  { id: 1, isLegacy: true, billingStatus: "active", plan: "start" },
                ]),
            }),
          }),
        }),
      }),
    }));

    const { assertNotRestricted } = await import("./services/billingAccessService");
    await expect(assertNotRestricted(1)).resolves.toBeUndefined();
  });

  it("should NOT throw for active billing status", async () => {
    let callCount = 0;
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => {
                callCount++;
                if (callCount === 1) {
                  return Promise.resolve([
                    { id: 1, isLegacy: false, billingStatus: "active", plan: "pro" },
                  ]);
                }
                return Promise.resolve([]);
              },
            }),
          }),
        }),
      }),
    }));

    const { assertNotRestricted } = await import("./services/billingAccessService");
    await expect(assertNotRestricted(1)).resolves.toBeUndefined();
  });

  it("should throw TRPCError for restricted billing status", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  { id: 1, isLegacy: false, billingStatus: "restricted", plan: "start" },
                ]),
            }),
          }),
        }),
      }),
    }));

    const { assertNotRestricted } = await import("./services/billingAccessService");
    await expect(assertNotRestricted(1)).rejects.toThrow();
  });

  it("should throw with FORBIDDEN code for restricted tenants", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  { id: 1, isLegacy: false, billingStatus: "restricted", plan: "start" },
                ]),
            }),
          }),
        }),
      }),
    }));

    const { assertNotRestricted } = await import("./services/billingAccessService");
    try {
      await assertNotRestricted(1);
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("FORBIDDEN");
    }
  });

  it("should NOT throw when DB is unavailable (fail-open)", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue(null),
    }));

    const { assertNotRestricted } = await import("./services/billingAccessService");
    await expect(assertNotRestricted(1)).resolves.toBeUndefined();
  });
});

// ─── checkBillingAccess unit tests ───
describe("checkBillingAccess", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should return full access for trialing status with valid trial", async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    let callCount = 0;
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => {
                callCount++;
                if (callCount === 1) {
                  return Promise.resolve([
                    { id: 1, isLegacy: false, billingStatus: "trialing", plan: "pro" },
                  ]);
                }
                return Promise.resolve([
                  { trialEndsAt: futureDate, currentPeriodEnd: null },
                ]);
              },
            }),
          }),
        }),
      }),
    }));

    const { checkBillingAccess } = await import("./services/billingAccessService");
    const result = await checkBillingAccess(1);
    expect(result.level).toBe("full");
    expect(result.billingStatus).toBe("trialing");
  });

  it("should return restricted for expired billing status", async () => {
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  { id: 1, isLegacy: false, billingStatus: "expired", plan: "start" },
                ]),
            }),
          }),
        }),
      }),
    }));

    const { checkBillingAccess } = await import("./services/billingAccessService");
    const result = await checkBillingAccess(1);
    expect(result.level).toBe("restricted");
    expect(result.billingStatus).toBe("expired");
  });

  it("should return full access for past_due (grace period)", async () => {
    let callCount = 0;
    vi.doMock("../drizzle/schema", () => ({
      tenants: { id: "id" },
      subscriptions: { tenantId: "tenantId" },
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => {
                callCount++;
                if (callCount === 1) {
                  return Promise.resolve([
                    { id: 1, isLegacy: false, billingStatus: "past_due", plan: "pro" },
                  ]);
                }
                return Promise.resolve([
                  { currentPeriodEnd: new Date(Date.now() + 86400000) },
                ]);
              },
            }),
          }),
        }),
      }),
    }));

    const { checkBillingAccess } = await import("./services/billingAccessService");
    const result = await checkBillingAccess(1);
    expect(result.level).toBe("full");
    expect(result.billingStatus).toBe("past_due");
  });
});

// ─── tenantWriteProcedure export test ───
describe("tenantWriteProcedure export", () => {
  it("should be exported from trpc module", async () => {
    const trpc = await import("./_core/trpc");
    expect(trpc.tenantWriteProcedure).toBeDefined();
    expect(trpc.sessionTenantWriteProcedure).toBeDefined();
  });
});
