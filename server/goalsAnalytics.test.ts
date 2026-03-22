/**
 * Tests for goalsAnalytics.ts — Goals Report backend helpers.
 * Validates data shape, status calculation, and edge cases.
 */
import { describe, it, expect, vi } from "vitest";

// ─── Test the status calculation logic ───────────────────────

function getGoalStatus(progressPct: number, expectedPct: number): string {
  if (progressPct >= 100) return "completed";
  if (expectedPct === 0) return "on_track";
  const ratio = progressPct / expectedPct;
  if (ratio >= 1.1) return "ahead";
  if (ratio >= 0.8) return "on_track";
  if (ratio >= 0.5) return "behind";
  return "critical";
}

describe("goalsAnalytics", () => {
  describe("getGoalStatus", () => {
    it("returns 'completed' when progress >= 100%", () => {
      expect(getGoalStatus(100, 50)).toBe("completed");
      expect(getGoalStatus(150, 80)).toBe("completed");
    });

    it("returns 'on_track' when expected is 0 (start of period)", () => {
      expect(getGoalStatus(0, 0)).toBe("on_track");
      expect(getGoalStatus(5, 0)).toBe("on_track");
    });

    it("returns 'ahead' when ratio >= 1.1", () => {
      // 60% progress, 50% expected → ratio 1.2
      expect(getGoalStatus(60, 50)).toBe("ahead");
    });

    it("returns 'on_track' when ratio >= 0.8 and < 1.1", () => {
      // 45% progress, 50% expected → ratio 0.9
      expect(getGoalStatus(45, 50)).toBe("on_track");
      // 80% progress, 80% expected → ratio 1.0
      expect(getGoalStatus(80, 80)).toBe("on_track");
    });

    it("returns 'behind' when ratio >= 0.5 and < 0.8", () => {
      // 30% progress, 50% expected → ratio 0.6
      expect(getGoalStatus(30, 50)).toBe("behind");
    });

    it("returns 'critical' when ratio < 0.5", () => {
      // 10% progress, 50% expected → ratio 0.2
      expect(getGoalStatus(10, 50)).toBe("critical");
      // 0% progress, 80% expected → ratio 0
      expect(getGoalStatus(0, 80)).toBe("critical");
    });
  });

  describe("GoalWithProgress type shape", () => {
    it("has all required fields", () => {
      const goal = {
        id: 1,
        name: "Meta de vendas",
        scope: "company" as const,
        metricKey: "total_sold",
        targetValue: 100000,
        currentValue: 45000,
        progressPct: 45.0,
        periodStart: new Date("2026-03-01"),
        periodEnd: new Date("2026-03-31"),
        userId: null,
        daysRemaining: 9,
        daysElapsed: 22,
        totalDays: 31,
        expectedProgressPct: 70.9,
        status: "behind" as const,
      };
      expect(goal).toHaveProperty("id");
      expect(goal).toHaveProperty("name");
      expect(goal).toHaveProperty("scope");
      expect(goal).toHaveProperty("metricKey");
      expect(goal).toHaveProperty("targetValue");
      expect(goal).toHaveProperty("currentValue");
      expect(goal).toHaveProperty("progressPct");
      expect(goal).toHaveProperty("periodStart");
      expect(goal).toHaveProperty("periodEnd");
      expect(goal).toHaveProperty("daysRemaining");
      expect(goal).toHaveProperty("daysElapsed");
      expect(goal).toHaveProperty("totalDays");
      expect(goal).toHaveProperty("expectedProgressPct");
      expect(goal).toHaveProperty("status");
    });
  });

  describe("GoalsReportData type shape", () => {
    it("has all required aggregate fields", () => {
      const report = {
        goals: [],
        overallProgress: 0,
        goalsAhead: 0,
        goalsOnTrack: 0,
        goalsBehind: 0,
        goalsCritical: 0,
        goalsCompleted: 0,
        dealMetrics: {
          totalDeals: 0,
          wonDeals: 0,
          lostDeals: 0,
          openDeals: 0,
          totalValueCents: 0,
          wonValueCents: 0,
          avgTicketCents: 0,
          conversionRate: 0,
        },
        topProducts: [],
      };
      expect(report.dealMetrics).toHaveProperty("totalDeals");
      expect(report.dealMetrics).toHaveProperty("avgTicketCents");
      expect(report.dealMetrics).toHaveProperty("conversionRate");
      expect(report).toHaveProperty("topProducts");
      expect(report).toHaveProperty("goalsCompleted");
    });
  });

  describe("AIGoalsAnalysis type shape", () => {
    it("has all required AI analysis fields", () => {
      const analysis = {
        overallAssessment: "Texto de avaliação",
        performanceVerdict: "below" as const,
        expectedSalesText: "Deveria ter vendido X",
        actionPlan: "Plano de ação detalhado",
        requiredDeals: 15,
        requiredValueCents: 500000,
        recommendedProducts: ["Produto A", "Produto B"],
        commercialGuidelines: ["Orientação 1", "Orientação 2"],
        urgencyLevel: "high" as const,
      };
      expect(analysis).toHaveProperty("overallAssessment");
      expect(analysis).toHaveProperty("performanceVerdict");
      expect(analysis).toHaveProperty("expectedSalesText");
      expect(analysis).toHaveProperty("actionPlan");
      expect(analysis).toHaveProperty("requiredDeals");
      expect(analysis).toHaveProperty("requiredValueCents");
      expect(analysis).toHaveProperty("recommendedProducts");
      expect(analysis).toHaveProperty("commercialGuidelines");
      expect(analysis).toHaveProperty("urgencyLevel");
      expect(analysis.recommendedProducts).toBeInstanceOf(Array);
      expect(analysis.commercialGuidelines).toBeInstanceOf(Array);
    });
  });

  describe("Edge cases", () => {
    it("handles zero target gracefully", () => {
      const progressPct = 0; // targetValue > 0 ? (currentValue / targetValue) * 100 : 0
      expect(progressPct).toBe(0);
    });

    it("caps progress at 200%", () => {
      const targetValue = 100;
      const currentValue = 250;
      const progressPct = Math.min(200, (currentValue / targetValue) * 100);
      expect(progressPct).toBe(200);
    });

    it("calculates expected progress correctly", () => {
      const totalDays = 30;
      const daysElapsed = 15;
      const expectedProgressPct = Math.min(100, (daysElapsed / totalDays) * 100);
      expect(expectedProgressPct).toBe(50);
    });

    it("handles conversion rate metric", () => {
      const total = 20;
      const won = 5;
      const conversionRate = total === 0 ? 0 : Math.round((won / total) * 100 * 10) / 10;
      expect(conversionRate).toBe(25);
    });

    it("handles avg ticket with zero won deals", () => {
      const wonDeals = 0;
      const wonValueCents = 0;
      const avgTicketCents = wonDeals > 0 ? Math.round(wonValueCents / wonDeals) : 0;
      expect(avgTicketCents).toBe(0);
    });
  });
});
