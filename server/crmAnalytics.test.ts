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

describe("CRM Analytics Router", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  it("summary returns all expected KPI fields", async () => {
    const result = await caller.crmAnalytics.summary({});
    expect(result).toBeDefined();
    expect(typeof result.totalDeals).toBe("number");
    expect(typeof result.openDeals).toBe("number");
    expect(typeof result.wonDeals).toBe("number");
    expect(typeof result.lostDeals).toBe("number");
    expect(typeof result.totalValueCents).toBe("number");
    expect(typeof result.wonValueCents).toBe("number");
    expect(typeof result.lostValueCents).toBe("number");
    expect(typeof result.openValueCents).toBe("number");
    expect(typeof result.conversionRate).toBe("number");
    expect(typeof result.avgTicketCents).toBe("number");
    expect(typeof result.avgCycleDays).toBe("number");
    // Rates should be non-negative
    expect(result.conversionRate).toBeGreaterThanOrEqual(0);
    expect(result.avgTicketCents).toBeGreaterThanOrEqual(0);
    expect(result.avgCycleDays).toBeGreaterThanOrEqual(0);
  });

  it("summary accepts date filters", async () => {
    const result = await caller.crmAnalytics.summary({
      dateFrom: "2025-01-01",
      dateTo: "2026-12-31",
    });
    expect(result).toBeDefined();
    expect(typeof result.totalDeals).toBe("number");
  });

  it("summary accepts pipeline filter", async () => {
    const result = await caller.crmAnalytics.summary({
      pipelineId: 1,
    });
    expect(result).toBeDefined();
    expect(typeof result.totalDeals).toBe("number");
  });

  it("topLossReasons returns array with correct shape", async () => {
    const result = await caller.crmAnalytics.topLossReasons({ limit: 3 });
    expect(Array.isArray(result)).toBe(true);
    for (const r of result) {
      expect(typeof r.reasonName).toBe("string");
      expect(typeof r.count).toBe("number");
      expect(typeof r.percentage).toBe("number");
      expect(typeof r.valueCents).toBe("number");
      expect(r.count).toBeGreaterThan(0);
      expect(r.percentage).toBeGreaterThanOrEqual(0);
      expect(r.percentage).toBeLessThanOrEqual(100);
    }
  });

  it("pipelineFunnel returns array of stages", async () => {
    const result = await caller.crmAnalytics.pipelineFunnel({
      pipelineId: 1,
    });
    expect(Array.isArray(result)).toBe(true);
    for (const stage of result) {
      expect(typeof stage.stageId).toBe("number");
      expect(typeof stage.stageName).toBe("string");
      expect(typeof stage.stageColor).toBe("string");
      expect(typeof stage.dealCount).toBe("number");
      expect(typeof stage.valueCents).toBe("number");
      expect(stage.dealCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("dealsByPeriod returns array of daily data", async () => {
    const result = await caller.crmAnalytics.dealsByPeriod({});
    expect(Array.isArray(result)).toBe(true);
    for (const row of result) {
      expect(typeof row.period).toBe("string");
      expect(row.period).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD
      expect(typeof row.won).toBe("number");
      expect(typeof row.lost).toBe("number");
      expect(typeof row.open).toBe("number");
      expect(typeof row.wonValueCents).toBe("number");
      expect(typeof row.lostValueCents).toBe("number");
    }
  });

  it("summary values are consistent (total = open + won + lost)", async () => {
    const result = await caller.crmAnalytics.summary({});
    expect(result.totalDeals).toBe(result.openDeals + result.wonDeals + result.lostDeals);
    expect(result.totalValueCents).toBe(result.openValueCents + result.wonValueCents + result.lostValueCents);
  });

  it("conversion rate is mathematically correct", async () => {
    const result = await caller.crmAnalytics.summary({});
    const decided = result.wonDeals + result.lostDeals;
    if (decided > 0) {
      const expected = Math.round((result.wonDeals / decided) * 10000) / 100;
      expect(result.conversionRate).toBe(expected);
    } else {
      expect(result.conversionRate).toBe(0);
    }
  });
});
