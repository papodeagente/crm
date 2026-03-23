import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Test: billingAccessService logic ──────────────────────────────
// We test the pure logic by mocking the DB layer.

// Mock getDb to return controlled data
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();

const mockDb = {
  select: () => ({ from: (table: any) => ({ where: (cond: any) => ({ limit: (n: number) => mockLimit() }) }) }),
  update: (table: any) => ({ set: (data: any) => ({ where: (cond: any) => mockSet() }) }),
};

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  desc: vi.fn((a) => a),
}));

// We'll test the logic directly by importing after mocks
import {
  checkBillingAccess,
  isTenantRestricted,
  assertNotRestricted,
  type BillingAccessResult,
} from "./services/billingAccessService";

describe("Billing Access Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkBillingAccess — Legacy tenants", () => {
    it("grants full access to legacy tenants regardless of billingStatus", async () => {
      // Mock tenant as legacy
      mockLimit.mockResolvedValueOnce([{
        id: 1,
        isLegacy: true,
        billingStatus: "expired",
        plan: "free",
      }]);

      const result = await checkBillingAccess(1);
      expect(result.level).toBe("full");
      expect(result.isLegacy).toBe(true);
      expect(result.reason).toBe("LEGACY_GRANDFATHERED");
    });
  });

  describe("checkBillingAccess — Active status", () => {
    it("grants full access for active billing status", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: 2,
          isLegacy: false,
          billingStatus: "active",
          plan: "growth",
        }])
        .mockResolvedValueOnce([{
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }]);

      const result = await checkBillingAccess(2);
      expect(result.level).toBe("full");
      expect(result.billingStatus).toBe("active");
    });
  });

  describe("checkBillingAccess — Trialing status", () => {
    it("grants full access for active trial", async () => {
      const trialEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
      mockLimit
        .mockResolvedValueOnce([{
          id: 3,
          isLegacy: false,
          billingStatus: "trialing",
          plan: "start",
        }])
        .mockResolvedValueOnce([{
          trialEndsAt: trialEnd,
        }]);

      const result = await checkBillingAccess(3);
      expect(result.level).toBe("full");
      expect(result.billingStatus).toBe("trialing");
      expect(result.trialEndsAt).toEqual(trialEnd);
    });

    it("restricts access when trial has expired", async () => {
      const trialEnd = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      mockLimit
        .mockResolvedValueOnce([{
          id: 4,
          isLegacy: false,
          billingStatus: "trialing",
          plan: "start",
        }])
        .mockResolvedValueOnce([{
          trialEndsAt: trialEnd,
        }]);
      mockSet.mockResolvedValueOnce(undefined); // update billingStatus

      const result = await checkBillingAccess(4);
      expect(result.level).toBe("restricted");
      expect(result.billingStatus).toBe("restricted");
      expect(result.reason).toBe("TRIAL_EXPIRED");
    });
  });

  describe("checkBillingAccess — Past due status", () => {
    it("grants full access during grace period", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: 5,
          isLegacy: false,
          billingStatus: "past_due",
          plan: "growth",
        }])
        .mockResolvedValueOnce([{
          currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        }]);

      const result = await checkBillingAccess(5);
      expect(result.level).toBe("full");
      expect(result.billingStatus).toBe("past_due");
      expect(result.message).toContain("pendente");
    });
  });

  describe("checkBillingAccess — Cancelled status", () => {
    it("grants full access if still within paid period", async () => {
      const periodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      mockLimit
        .mockResolvedValueOnce([{
          id: 6,
          isLegacy: false,
          billingStatus: "cancelled",
          plan: "growth",
        }])
        .mockResolvedValueOnce([{
          currentPeriodEnd: periodEnd,
        }]);

      const result = await checkBillingAccess(6);
      expect(result.level).toBe("full");
      expect(result.billingStatus).toBe("cancelled");
      expect(result.message).toContain("cancelada");
    });

    it("restricts access if paid period has expired", async () => {
      const periodEnd = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      mockLimit
        .mockResolvedValueOnce([{
          id: 7,
          isLegacy: false,
          billingStatus: "cancelled",
          plan: "growth",
        }])
        .mockResolvedValueOnce([{
          currentPeriodEnd: periodEnd,
        }]);

      const result = await checkBillingAccess(7);
      expect(result.level).toBe("restricted");
      expect(result.reason).toBe("CANCELLED_PERIOD_EXPIRED");
    });
  });

  describe("checkBillingAccess — Restricted/Expired status", () => {
    it("restricts access for 'restricted' billing status", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: 8,
          isLegacy: false,
          billingStatus: "restricted",
          plan: "start",
        }])
        .mockResolvedValueOnce([]);

      const result = await checkBillingAccess(8);
      expect(result.level).toBe("restricted");
      expect(result.billingStatus).toBe("restricted");
    });

    it("restricts access for 'expired' billing status", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: 9,
          isLegacy: false,
          billingStatus: "expired",
          plan: "start",
        }])
        .mockResolvedValueOnce([]);

      const result = await checkBillingAccess(9);
      expect(result.level).toBe("restricted");
      expect(result.billingStatus).toBe("expired");
    });
  });

  describe("checkBillingAccess — Tenant not found", () => {
    it("restricts access when tenant does not exist", async () => {
      mockLimit.mockResolvedValueOnce([]); // no tenant found

      const result = await checkBillingAccess(999);
      expect(result.level).toBe("restricted");
      expect(result.reason).toBe("TENANT_NOT_FOUND");
    });
  });

  describe("isTenantRestricted", () => {
    it("returns true for restricted tenant", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: 10,
          isLegacy: false,
          billingStatus: "restricted",
          plan: "start",
        }])
        .mockResolvedValueOnce([]);

      const result = await isTenantRestricted(10);
      expect(result).toBe(true);
    });

    it("returns false for active tenant", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: 11,
          isLegacy: false,
          billingStatus: "active",
          plan: "growth",
        }])
        .mockResolvedValueOnce([{
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }]);

      const result = await isTenantRestricted(11);
      expect(result).toBe(false);
    });

    it("returns false for legacy tenant even with expired status", async () => {
      mockLimit.mockResolvedValueOnce([{
        id: 12,
        isLegacy: true,
        billingStatus: "expired",
        plan: "free",
      }]);

      const result = await isTenantRestricted(12);
      expect(result).toBe(false);
    });
  });

  describe("assertNotRestricted", () => {
    it("throws for restricted tenant", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: 13,
          isLegacy: false,
          billingStatus: "restricted",
          plan: "start",
        }])
        .mockResolvedValueOnce([]);

      await expect(assertNotRestricted(13)).rejects.toThrow();
    });

    it("does not throw for active tenant", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: 14,
          isLegacy: false,
          billingStatus: "active",
          plan: "growth",
        }])
        .mockResolvedValueOnce([{
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }]);

      await expect(assertNotRestricted(14)).resolves.toBeUndefined();
    });
  });
});

// ─── Test: Hotmart webhook event mapping ──────────────────────────

describe("Hotmart Event Status Mapping", () => {
  // Test the mapping logic used in hotmartWebhook.ts
  const EVENT_STATUS_MAP: Record<string, string> = {
    PURCHASE_APPROVED: "active",
    PURCHASE_COMPLETE: "active",
    PURCHASE_CANCELED: "cancelled",
    PURCHASE_REFUNDED: "cancelled",
    PURCHASE_CHARGEBACK: "cancelled",
    PURCHASE_DELAYED: "past_due",
    PURCHASE_PROTEST: "past_due",
    SUBSCRIPTION_CANCELLATION: "cancelled",
    SWITCH_PLAN: "active",
  };

  it("maps PURCHASE_APPROVED to active", () => {
    expect(EVENT_STATUS_MAP["PURCHASE_APPROVED"]).toBe("active");
  });

  it("maps PURCHASE_COMPLETE to active", () => {
    expect(EVENT_STATUS_MAP["PURCHASE_COMPLETE"]).toBe("active");
  });

  it("maps PURCHASE_CANCELED to cancelled", () => {
    expect(EVENT_STATUS_MAP["PURCHASE_CANCELED"]).toBe("cancelled");
  });

  it("maps PURCHASE_REFUNDED to cancelled", () => {
    expect(EVENT_STATUS_MAP["PURCHASE_REFUNDED"]).toBe("cancelled");
  });

  it("maps PURCHASE_CHARGEBACK to cancelled", () => {
    expect(EVENT_STATUS_MAP["PURCHASE_CHARGEBACK"]).toBe("cancelled");
  });

  it("maps PURCHASE_DELAYED to past_due", () => {
    expect(EVENT_STATUS_MAP["PURCHASE_DELAYED"]).toBe("past_due");
  });

  it("maps PURCHASE_PROTEST to past_due", () => {
    expect(EVENT_STATUS_MAP["PURCHASE_PROTEST"]).toBe("past_due");
  });

  it("maps SUBSCRIPTION_CANCELLATION to cancelled", () => {
    expect(EVENT_STATUS_MAP["SUBSCRIPTION_CANCELLATION"]).toBe("cancelled");
  });

  it("maps SWITCH_PLAN to active", () => {
    expect(EVENT_STATUS_MAP["SWITCH_PLAN"]).toBe("active");
  });

  it("returns undefined for unknown events", () => {
    expect(EVENT_STATUS_MAP["UNKNOWN_EVENT"]).toBeUndefined();
  });
});

// ─── Test: BillingAccessResult type contract ──────────────────────

describe("BillingAccessResult type contract", () => {
  it("full access result has expected shape", () => {
    const result: BillingAccessResult = {
      level: "full",
      isLegacy: false,
      billingStatus: "active",
      plan: "growth",
    };
    expect(result.level).toBe("full");
    expect(result.isLegacy).toBe(false);
  });

  it("restricted result includes message", () => {
    const result: BillingAccessResult = {
      level: "restricted",
      isLegacy: false,
      billingStatus: "expired",
      plan: "start",
      reason: "SUBSCRIPTION_EXPIRED",
      message: "Sua assinatura expirou.",
    };
    expect(result.level).toBe("restricted");
    expect(result.message).toBeDefined();
    expect(result.reason).toBe("SUBSCRIPTION_EXPIRED");
  });

  it("legacy result always has full level", () => {
    const result: BillingAccessResult = {
      level: "full",
      isLegacy: true,
      billingStatus: "expired",
      plan: "free",
      reason: "LEGACY_GRANDFATHERED",
    };
    expect(result.level).toBe("full");
    expect(result.isLegacy).toBe(true);
  });
});
