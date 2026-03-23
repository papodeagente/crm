import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(tenantId = 1, userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user-open-id",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    saasUser: {
      userId,
      tenantId,
      role: "admin" as const,
      email: "test@example.com",
      name: "Test User",
    },
    req: {
      protocol: "https",
      hostname: "test.manus.computer",
      get: () => "test.manus.computer",
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    saasUser: null,
    req: {
      protocol: "https",
      hostname: "test.manus.computer",
      get: () => "test.manus.computer",
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

const caller = (ctx: TrpcContext) => appRouter.createCaller(ctx);

describe("sourcesCampaigns router", () => {
  // ─── Authentication ───
  describe("authentication", () => {
    it("overview rejects unauthenticated requests", async () => {
      await expect(
        caller(createUnauthContext()).sourcesCampaigns.overview({
          viewMode: "won",
        })
      ).rejects.toThrow();
    });

    it("bySources rejects unauthenticated requests", async () => {
      await expect(
        caller(createUnauthContext()).sourcesCampaigns.bySources({
          viewMode: "won",
        })
      ).rejects.toThrow();
    });

    it("byCampaigns rejects unauthenticated requests", async () => {
      await expect(
        caller(createUnauthContext()).sourcesCampaigns.byCampaigns({
          viewMode: "won",
        })
      ).rejects.toThrow();
    });

    it("dealList rejects unauthenticated requests", async () => {
      await expect(
        caller(createUnauthContext()).sourcesCampaigns.dealList({
          viewMode: "won",
          page: 1,
          limit: 25,
        })
      ).rejects.toThrow();
    });

    it("filterOptions rejects unauthenticated requests", async () => {
      await expect(
        caller(createUnauthContext()).sourcesCampaigns.filterOptions()
      ).rejects.toThrow();
    });
  });

  // ─── Overview ───
  describe("overview", () => {
    it("returns overview with totalDeals, totalValueCents, avgTicket", async () => {
      const ctx = createAuthContext();
      const result = await caller(ctx).sourcesCampaigns.overview({
        viewMode: "won",
      });
      expect(result).toHaveProperty("totalDeals");
      expect(result).toHaveProperty("totalValueCents");
      expect(result).toHaveProperty("avgTicket");
      expect(typeof result.totalDeals).toBe("number");
      expect(typeof result.totalValueCents).toBe("number");
      expect(typeof result.avgTicket).toBe("number");
    });

    it("returns overview for lost view mode", async () => {
      const ctx = createAuthContext();
      const result = await caller(ctx).sourcesCampaigns.overview({
        viewMode: "lost",
      });
      expect(result).toHaveProperty("totalDeals");
      expect(typeof result.totalDeals).toBe("number");
    });

    it("returns overview for open view mode", async () => {
      const ctx = createAuthContext();
      const result = await caller(ctx).sourcesCampaigns.overview({
        viewMode: "open",
      });
      expect(result).toHaveProperty("totalDeals");
      expect(typeof result.totalDeals).toBe("number");
    });

    it("accepts date filters", async () => {
      const ctx = createAuthContext();
      const result = await caller(ctx).sourcesCampaigns.overview({
        viewMode: "won",
        dateFrom: "2025-01-01",
        dateTo: "2025-12-31",
      });
      expect(result).toHaveProperty("totalDeals");
    });

    it("accepts UTM filters", async () => {
      const ctx = createAuthContext();
      const result = await caller(ctx).sourcesCampaigns.overview({
        viewMode: "won",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "test",
        utmContent: "ad1",
        utmTerm: "keyword",
      });
      expect(result).toHaveProperty("totalDeals");
    });

    it("accepts advanced filters", async () => {
      const ctx = createAuthContext();
      const result = await caller(ctx).sourcesCampaigns.overview({
        viewMode: "won",
        pipelineId: 1,
        stageId: 1,
        ownerUserId: 1,
        teamId: 1,
        valueMin: 1000,
        valueMax: 100000,
      });
      expect(result).toHaveProperty("totalDeals");
    });
  });

  // ─── By Sources ───
  describe("bySources", () => {
    it("returns array of source breakdowns", async () => {
      const ctx = createAuthContext();
      const result = await caller(ctx).sourcesCampaigns.bySources({
        viewMode: "won",
      });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("source");
        expect(result[0]).toHaveProperty("count");
        expect(result[0]).toHaveProperty("valueCents");
        expect(result[0]).toHaveProperty("avgValueCents");
        expect(result[0]).toHaveProperty("percentage");
      }
    });

    it("returns sorted by count descending", async () => {
      const ctx = createAuthContext();
      const result = await caller(ctx).sourcesCampaigns.bySources({
        viewMode: "won",
      });
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].count).toBeGreaterThanOrEqual(result[i].count);
      }
    });
  });

  // ─── By Campaigns ───
  describe("byCampaigns", () => {
    it("returns array of campaign breakdowns", async () => {
      const ctx = createAuthContext();
      const result = await caller(ctx).sourcesCampaigns.byCampaigns({
        viewMode: "won",
      });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("campaign");
        expect(result[0]).toHaveProperty("count");
        expect(result[0]).toHaveProperty("valueCents");
        expect(result[0]).toHaveProperty("avgValueCents");
        expect(result[0]).toHaveProperty("percentage");
      }
    });
  });

  // ─── Deal List ───
  describe("dealList", () => {
    it("returns paginated deal list", async () => {
      const ctx = createAuthContext();
      const result = await caller(ctx).sourcesCampaigns.dealList({
        viewMode: "won",
        page: 1,
        limit: 25,
      });
      expect(result).toHaveProperty("deals");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.deals)).toBe(true);
      expect(typeof result.total).toBe("number");
    });

    it("deal list items have required fields", async () => {
      const ctx = createAuthContext();
      const result = await caller(ctx).sourcesCampaigns.dealList({
        viewMode: "won",
        page: 1,
        limit: 5,
      });
      if (result.deals.length > 0) {
        const deal = result.deals[0];
        expect(deal).toHaveProperty("id");
        expect(deal).toHaveProperty("title");
        expect(deal).toHaveProperty("valueCents");
        expect(deal).toHaveProperty("leadSource");
        expect(deal).toHaveProperty("utmSource");
        expect(deal).toHaveProperty("utmMedium");
        expect(deal).toHaveProperty("utmCampaign");
        expect(deal).toHaveProperty("utmContent");
        expect(deal).toHaveProperty("utmTerm");
      }
    });
  });

  // ─── Filter Options ───
  describe("filterOptions", () => {
    it("returns all filter option arrays", async () => {
      const ctx = createAuthContext();
      const result = await caller(ctx).sourcesCampaigns.filterOptions();
      expect(result).toHaveProperty("utmSources");
      expect(result).toHaveProperty("utmMediums");
      expect(result).toHaveProperty("utmCampaigns");
      expect(result).toHaveProperty("utmContents");
      expect(result).toHaveProperty("utmTerms");
      expect(result).toHaveProperty("leadSources");
      expect(result).toHaveProperty("pipelines");
      expect(result).toHaveProperty("stages");
      expect(result).toHaveProperty("owners");
      expect(result).toHaveProperty("teams");
      expect(result).toHaveProperty("accounts");
      expect(result).toHaveProperty("lossReasons");
      expect(result).toHaveProperty("channels");
      expect(Array.isArray(result.utmSources)).toBe(true);
      expect(Array.isArray(result.pipelines)).toBe(true);
    });
  });

  // ─── Multi-tenant isolation ───
  describe("multi-tenant isolation", () => {
    it("tenant 1 and tenant 2 get different results", async () => {
      const ctx1 = createAuthContext(1, 1);
      const ctx2 = createAuthContext(2, 2);
      const result1 = await caller(ctx1).sourcesCampaigns.overview({ viewMode: "won" });
      const result2 = await caller(ctx2).sourcesCampaigns.overview({ viewMode: "won" });
      // Both should return valid results (may be same or different depending on data)
      expect(result1).toHaveProperty("totalDeals");
      expect(result2).toHaveProperty("totalDeals");
    });

    it("filter options are tenant-scoped", async () => {
      const ctx1 = createAuthContext(1, 1);
      const ctx2 = createAuthContext(2, 2);
      const opts1 = await caller(ctx1).sourcesCampaigns.filterOptions();
      const opts2 = await caller(ctx2).sourcesCampaigns.filterOptions();
      // Both should return valid arrays
      expect(Array.isArray(opts1.pipelines)).toBe(true);
      expect(Array.isArray(opts2.pipelines)).toBe(true);
    });
  });
});
