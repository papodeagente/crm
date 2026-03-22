import { describe, it, expect } from "vitest";
import { getCrmLiveCover, getCrmLiveOperation } from "./crmLive";

const TENANT_ID = 1;
const NOW = new Date();
const FROM = new Date(NOW.getFullYear(), NOW.getMonth(), 1).toISOString().slice(0, 10);
const TO = NOW.toISOString().slice(0, 10);

describe("crmLive", () => {
  describe("getCrmLiveCover", () => {
    it("returns correct shape for finalized tab", async () => {
      const result = await getCrmLiveCover(
        { tenantId: TENANT_ID, dateFrom: FROM, dateTo: TO },
        "finalized"
      );
      expect(result).toHaveProperty("tab", "finalized");
      expect(result).toHaveProperty("topDealCreator");
      expect(result).toHaveProperty("topSellerByUnits");
      expect(result).toHaveProperty("topSellerByValue");
      expect(result).toHaveProperty("newDeals");
      expect(result.newDeals).toHaveProperty("current");
      expect(result.newDeals).toHaveProperty("previous");
      expect(result).toHaveProperty("salesUnits");
      expect(result).toHaveProperty("salesValueCents");
      expect(result).toHaveProperty("conversionRate");
      expect(typeof result.conversionRate).toBe("number");
      expect(result).toHaveProperty("lostDeals");
      expect(result).toHaveProperty("topLossReasons");
      expect(Array.isArray(result.topLossReasons)).toBe(true);
    });

    it("returns correct shape for in_progress tab", async () => {
      const result = await getCrmLiveCover(
        { tenantId: TENANT_ID, dateFrom: FROM, dateTo: TO },
        "in_progress"
      );
      expect(result).toHaveProperty("tab", "in_progress");
      expect(result).toHaveProperty("newDeals");
      expect(result).toHaveProperty("salesUnits");
    });

    it("handles pipeline filter", async () => {
      const result = await getCrmLiveCover(
        { tenantId: TENANT_ID, dateFrom: FROM, dateTo: TO, pipelineId: 1 },
        "finalized"
      );
      expect(result).toHaveProperty("tab", "finalized");
      expect(typeof result.newDeals.current).toBe("number");
    });

    it("handles user filter", async () => {
      const result = await getCrmLiveCover(
        { tenantId: TENANT_ID, dateFrom: FROM, dateTo: TO, ownerUserId: 1 },
        "finalized"
      );
      expect(result).toHaveProperty("tab", "finalized");
    });

    it("returns numeric values for all comparison fields", async () => {
      const result = await getCrmLiveCover(
        { tenantId: TENANT_ID, dateFrom: FROM, dateTo: TO },
        "finalized"
      );
      expect(typeof result.newDeals.current).toBe("number");
      expect(typeof result.newDeals.previous).toBe("number");
      expect(typeof result.salesUnits.current).toBe("number");
      expect(typeof result.salesUnits.previous).toBe("number");
      expect(typeof result.salesValueCents.current).toBe("number");
      expect(typeof result.salesValueCents.previous).toBe("number");
      expect(typeof result.lostDeals.current).toBe("number");
      expect(typeof result.lostDeals.previous).toBe("number");
    });

    it("topLossReasons have correct structure", async () => {
      const result = await getCrmLiveCover(
        { tenantId: TENANT_ID, dateFrom: FROM, dateTo: TO },
        "finalized"
      );
      for (const r of result.topLossReasons) {
        expect(r).toHaveProperty("name");
        expect(r).toHaveProperty("count");
        expect(r).toHaveProperty("percentage");
        expect(typeof r.name).toBe("string");
        expect(typeof r.count).toBe("number");
        expect(typeof r.percentage).toBe("number");
      }
    });
  });

  describe("getCrmLiveOperation", () => {
    it("returns correct shape for in_progress tab", async () => {
      const result = await getCrmLiveOperation(
        { tenantId: TENANT_ID, dateFrom: FROM, dateTo: TO },
        "in_progress"
      );
      expect(result).toHaveProperty("tab", "in_progress");
      expect(result).toHaveProperty("totalDeals");
      expect(typeof result.totalDeals).toBe("number");
      expect(result).toHaveProperty("totalValueCents");
      expect(typeof result.totalValueCents).toBe("number");
      expect(result).toHaveProperty("taskFeed");
      expect(Array.isArray(result.taskFeed)).toBe(true);
      expect(result).toHaveProperty("stages");
      expect(Array.isArray(result.stages)).toBe(true);
      expect(result).toHaveProperty("probabilityGroups");
      expect(Array.isArray(result.probabilityGroups)).toBe(true);
    });

    it("returns correct shape for finalized tab", async () => {
      const result = await getCrmLiveOperation(
        { tenantId: TENANT_ID, dateFrom: FROM, dateTo: TO },
        "finalized"
      );
      expect(result).toHaveProperty("tab", "finalized");
      expect(result).toHaveProperty("totalDeals");
      expect(result).toHaveProperty("stages");
    });

    it("stages have correct structure", async () => {
      const result = await getCrmLiveOperation(
        { tenantId: TENANT_ID, dateFrom: FROM, dateTo: TO },
        "in_progress"
      );
      for (const s of result.stages) {
        expect(s).toHaveProperty("stageId");
        expect(s).toHaveProperty("stageName");
        expect(s).toHaveProperty("dealCount");
        expect(s).toHaveProperty("valueCents");
        expect(typeof s.stageId).toBe("number");
        expect(typeof s.stageName).toBe("string");
        expect(typeof s.dealCount).toBe("number");
        expect(typeof s.valueCents).toBe("number");
      }
    });

    it("probabilityGroups have 5 entries with correct structure", async () => {
      const result = await getCrmLiveOperation(
        { tenantId: TENANT_ID, dateFrom: FROM, dateTo: TO },
        "in_progress"
      );
      expect(result.probabilityGroups.length).toBe(5);
      for (const pg of result.probabilityGroups) {
        expect(pg).toHaveProperty("label");
        expect(pg).toHaveProperty("stars");
        expect(pg).toHaveProperty("dealCount");
        expect(pg).toHaveProperty("valueCents");
        expect(typeof pg.stars).toBe("number");
        expect(pg.stars).toBeGreaterThanOrEqual(1);
        expect(pg.stars).toBeLessThanOrEqual(5);
      }
    });

    it("taskFeed items have correct structure", async () => {
      const result = await getCrmLiveOperation(
        { tenantId: TENANT_ID, dateFrom: FROM, dateTo: TO },
        "in_progress"
      );
      for (const t of result.taskFeed) {
        expect(t).toHaveProperty("id");
        expect(t).toHaveProperty("title");
        expect(t).toHaveProperty("taskType");
        expect(t).toHaveProperty("status");
        expect(t).toHaveProperty("updatedAt");
      }
    });

    it("handles pipeline filter for operation", async () => {
      const result = await getCrmLiveOperation(
        { tenantId: TENANT_ID, dateFrom: FROM, dateTo: TO, pipelineId: 1 },
        "in_progress"
      );
      expect(result).toHaveProperty("tab", "in_progress");
      expect(typeof result.totalDeals).toBe("number");
    });
  });
});
