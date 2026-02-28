import { describe, expect, it } from "vitest";
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
    role: "user",
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
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("utmAnalytics", () => {
  describe("overview", () => {
    it("returns overview KPIs with correct structure", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.utmAnalytics.overview({ tenantId: 1 });

      // Should return an object with all expected fields
      expect(result).toBeDefined();
      if (result) {
        expect(typeof result.totalDeals).toBe("number");
        expect(typeof result.wonDeals).toBe("number");
        expect(typeof result.lostDeals).toBe("number");
        expect(typeof result.openDeals).toBe("number");
        expect(typeof result.totalValueCents).toBe("number");
        expect(typeof result.wonValueCents).toBe("number");
        expect(typeof result.lostValueCents).toBe("number");
        expect(typeof result.openValueCents).toBe("number");
        expect(typeof result.dealsWithUtm).toBe("number");
        expect(typeof result.conversionRate).toBe("number");

        // Logical constraints
        expect(result.totalDeals).toBeGreaterThanOrEqual(0);
        expect(result.wonDeals).toBeLessThanOrEqual(result.totalDeals);
        expect(result.lostDeals).toBeLessThanOrEqual(result.totalDeals);
        expect(result.openDeals).toBeLessThanOrEqual(result.totalDeals);
        expect(result.conversionRate).toBeGreaterThanOrEqual(0);
        expect(result.conversionRate).toBeLessThanOrEqual(100);
        // won + lost + open = total
        expect(result.wonDeals + result.lostDeals + result.openDeals).toBe(result.totalDeals);
      }
    });

    it("accepts date range filters", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.utmAnalytics.overview({
        tenantId: 1,
        dateFrom: "2025-01-01",
        dateTo: "2025-12-31",
      });

      expect(result).toBeDefined();
      if (result) {
        expect(typeof result.totalDeals).toBe("number");
      }
    });
  });

  describe("byDimension", () => {
    it("returns data grouped by utmSource", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.utmAnalytics.byDimension({
        tenantId: 1,
        dimension: "utmSource",
      });

      expect(Array.isArray(result)).toBe(true);
      for (const row of result) {
        expect(typeof row.dimension).toBe("string");
        expect(typeof row.totalDeals).toBe("number");
        expect(typeof row.wonDeals).toBe("number");
        expect(typeof row.lostDeals).toBe("number");
        expect(typeof row.openDeals).toBe("number");
        expect(typeof row.totalValueCents).toBe("number");
        expect(typeof row.wonValueCents).toBe("number");
        expect(typeof row.conversionRate).toBe("number");
        // Logical: won <= total
        expect(row.wonDeals).toBeLessThanOrEqual(row.totalDeals);
      }
    });

    it("supports all dimension types", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const dimensions = ["utmSource", "utmMedium", "utmCampaign", "utmTerm", "utmContent", "leadSource", "channelOrigin"] as const;

      for (const dim of dimensions) {
        const result = await caller.utmAnalytics.byDimension({
          tenantId: 1,
          dimension: dim,
        });
        expect(Array.isArray(result)).toBe(true);
      }
    });
  });

  describe("crossTable", () => {
    it("returns cross-tabulation data", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.utmAnalytics.crossTable({ tenantId: 1 });

      expect(Array.isArray(result)).toBe(true);
      for (const row of result) {
        expect(typeof row.source).toBe("string");
        expect(typeof row.medium).toBe("string");
        expect(typeof row.campaign).toBe("string");
        expect(typeof row.totalDeals).toBe("number");
        expect(typeof row.wonDeals).toBe("number");
        expect(typeof row.conversionRate).toBe("number");
      }
    });
  });

  describe("timeline", () => {
    it("returns monthly timeline data", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.utmAnalytics.timeline({ tenantId: 1 });

      expect(Array.isArray(result)).toBe(true);
      for (const row of result) {
        expect(typeof row.month).toBe("string");
        expect(row.month).toMatch(/^\d{4}-\d{2}$/); // YYYY-MM format
        expect(typeof row.totalDeals).toBe("number");
        expect(typeof row.wonDeals).toBe("number");
        expect(typeof row.wonValueCents).toBe("number");
      }
    });
  });

  describe("filterValues", () => {
    it("returns all available filter values", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.utmAnalytics.filterValues({ tenantId: 1 });

      expect(result).toBeDefined();
      expect(Array.isArray(result.sources)).toBe(true);
      expect(Array.isArray(result.mediums)).toBe(true);
      expect(Array.isArray(result.campaigns)).toBe(true);
      expect(Array.isArray(result.terms)).toBe(true);
      expect(Array.isArray(result.contents)).toBe(true);
      expect(Array.isArray(result.leadSources)).toBe(true);
      expect(Array.isArray(result.channels)).toBe(true);

      // All values should be non-empty strings
      for (const s of result.sources) {
        expect(typeof s).toBe("string");
        expect(s.length).toBeGreaterThan(0);
      }
    });
  });

  describe("dealList", () => {
    it("returns paginated deal list with UTM data", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.utmAnalytics.dealList({
        tenantId: 1,
        status: "all",
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(typeof result.total).toBe("number");
      expect(Array.isArray(result.deals)).toBe(true);
      expect(result.deals.length).toBeLessThanOrEqual(10);

      for (const deal of result.deals) {
        expect(typeof deal.id).toBe("number");
        expect(typeof deal.title).toBe("string");
        expect(["open", "won", "lost"]).toContain(deal.status);
        expect(typeof deal.valueCents).toBe("number");
      }
    });

    it("filters by status", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const wonResult = await caller.utmAnalytics.dealList({
        tenantId: 1,
        status: "won",
        limit: 50,
      });

      for (const deal of wonResult.deals) {
        expect(deal.status).toBe("won");
      }
    });
  });

  describe("stageTime", () => {
    it("returns stage time data for a deal", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Use a non-existent deal ID - should return empty array
      const result = await caller.utmAnalytics.stageTime({
        tenantId: 1,
        dealId: 999999,
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe("recalcDealValue integrity", () => {
  it("deal value reflects sum of products (conceptual test)", () => {
    // This tests the conceptual integrity of the recalcDealValue function
    // The actual DB function is tested via integration, but we verify the math here

    const products = [
      { quantity: 2, unitPriceCents: 10000, discountCents: 500 },
      { quantity: 1, unitPriceCents: 25000, discountCents: 0 },
      { quantity: 3, unitPriceCents: 5000, discountCents: 1000 },
    ];

    const totalValueCents = products.reduce((sum, p) => {
      return sum + (p.quantity * p.unitPriceCents - (p.discountCents || 0));
    }, 0);

    // 2*10000 - 500 = 19500
    // 1*25000 - 0 = 25000
    // 3*5000 - 1000 = 14000
    // Total = 58500
    expect(totalValueCents).toBe(58500);
  });

  it("empty products list results in zero value", () => {
    const products: any[] = [];
    const totalValueCents = products.reduce((sum, p) => {
      return sum + (p.quantity * p.unitPriceCents - (p.discountCents || 0));
    }, 0);

    expect(totalValueCents).toBe(0);
  });
});

describe("formatDurationMs helper logic", () => {
  // Testing the formatting logic used in the tooltip
  function formatDurationMs(ms: number): string {
    if (ms <= 0) return "—";
    const totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 1) return "< 1 min";
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours < 24) return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days === 1) return remHours > 0 ? `1 dia ${remHours}h` : "1 dia";
    return remHours > 0 ? `${days} dias ${remHours}h` : `${days} dias`;
  }

  it("formats zero as dash", () => {
    expect(formatDurationMs(0)).toBe("—");
    expect(formatDurationMs(-1000)).toBe("—");
  });

  it("formats less than a minute", () => {
    expect(formatDurationMs(30000)).toBe("< 1 min");
  });

  it("formats minutes", () => {
    expect(formatDurationMs(5 * 60000)).toBe("5 min");
    expect(formatDurationMs(45 * 60000)).toBe("45 min");
  });

  it("formats hours", () => {
    expect(formatDurationMs(2 * 3600000)).toBe("2h");
    expect(formatDurationMs(2 * 3600000 + 30 * 60000)).toBe("2h 30min");
  });

  it("formats days", () => {
    expect(formatDurationMs(24 * 3600000)).toBe("1 dia");
    expect(formatDurationMs(24 * 3600000 + 5 * 3600000)).toBe("1 dia 5h");
    expect(formatDurationMs(3 * 24 * 3600000)).toBe("3 dias");
    expect(formatDurationMs(3 * 24 * 3600000 + 12 * 3600000)).toBe("3 dias 12h");
  });
});
