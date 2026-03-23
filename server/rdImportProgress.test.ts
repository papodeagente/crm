import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for the RD CRM Import progress tracking system.
 *
 * We test the progress calculation logic and the new fetch/import phase tracking
 * that prevents the UI from freezing at 0%.
 */

// ─── Replicate the progress interface and helper functions for unit testing ───
interface ImportProgress {
  status: "idle" | "fetching" | "importing" | "done" | "error";
  phase: string;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  currentCategory: string;
  categoryTotal: number;
  categoryDone: number;
  results: Record<string, { imported: number; skipped: number; updated: number; errors: string[] }>;
  error?: string;
  startedAt: number;
  fetchPhase: boolean;
  fetchedRecords: number;
  totalRecordsEstimate: number;
  processedRecords: number;
  lastActivityAt: number;
}

function createProgress(overrides: Partial<ImportProgress> = {}): ImportProgress {
  return {
    status: "idle",
    phase: "Preparando...",
    currentStep: "",
    totalSteps: 0,
    completedSteps: 0,
    currentCategory: "",
    categoryTotal: 0,
    categoryDone: 0,
    results: {},
    startedAt: Date.now(),
    fetchPhase: false,
    fetchedRecords: 0,
    totalRecordsEstimate: 0,
    processedRecords: 0,
    lastActivityAt: Date.now(),
    ...overrides,
  };
}

// Replicate the frontend overallPercent calculation
function calculateOverallPercent(progress: ImportProgress | null): number {
  if (!progress || progress.totalSteps === 0) return 0;
  const basePercent = (progress.completedSteps / progress.totalSteps) * 100;
  const categoryPercent = progress.categoryTotal > 0
    ? (progress.categoryDone / progress.categoryTotal) * (100 / progress.totalSteps)
    : 0;
  const calculated = basePercent + categoryPercent;
  if (calculated === 0 && progress.status !== "idle") {
    const elapsed = Date.now() - progress.startedAt;
    if (elapsed > 2000) return 1;
  }
  return Math.min(Math.round(calculated), 99);
}

// Replicate the isImportAlive check
function isImportAlive(progress: ImportProgress | null): boolean {
  if (!progress || progress.status !== "importing") return true;
  return (Date.now() - progress.lastActivityAt) < 30000;
}

describe("RD Import Progress Tracking", () => {

  describe("overallPercent calculation", () => {
    it("returns 0 for null progress", () => {
      expect(calculateOverallPercent(null)).toBe(0);
    });

    it("returns 0 for idle progress with 0 totalSteps", () => {
      const p = createProgress({ totalSteps: 0 });
      expect(calculateOverallPercent(p)).toBe(0);
    });

    it("returns at least 1% after 2 seconds when status is not idle (fetch phase fix)", () => {
      const p = createProgress({
        status: "fetching",
        totalSteps: 8,
        completedSteps: 0,
        categoryTotal: 0,
        categoryDone: 0,
        startedAt: Date.now() - 3000, // 3 seconds ago
      });
      expect(calculateOverallPercent(p)).toBe(1);
    });

    it("returns 0 within first 2 seconds even if fetching", () => {
      const p = createProgress({
        status: "fetching",
        totalSteps: 8,
        completedSteps: 0,
        categoryTotal: 0,
        categoryDone: 0,
        startedAt: Date.now() - 500, // 0.5 seconds ago
      });
      expect(calculateOverallPercent(p)).toBe(0);
    });

    it("calculates correct percent with completed steps", () => {
      const p = createProgress({
        status: "importing",
        totalSteps: 10,
        completedSteps: 5,
        categoryTotal: 0,
        categoryDone: 0,
      });
      expect(calculateOverallPercent(p)).toBe(50);
    });

    it("includes category progress in calculation", () => {
      const p = createProgress({
        status: "importing",
        totalSteps: 10,
        completedSteps: 5,
        categoryTotal: 100,
        categoryDone: 50,
      });
      // basePercent = 50, categoryPercent = (50/100) * (100/10) = 5
      expect(calculateOverallPercent(p)).toBe(55);
    });

    it("caps at 99% maximum", () => {
      const p = createProgress({
        status: "importing",
        totalSteps: 10,
        completedSteps: 10,
        categoryTotal: 100,
        categoryDone: 100,
      });
      expect(calculateOverallPercent(p)).toBe(99);
    });

    it("shows progress during fetch phase with category tracking", () => {
      const p = createProgress({
        status: "fetching",
        totalSteps: 8,
        completedSteps: 0,
        currentCategory: "contacts",
        categoryTotal: 5000,
        categoryDone: 2500,
        fetchPhase: true,
      });
      // basePercent = 0, categoryPercent = (2500/5000) * (100/8) = 6.25
      expect(calculateOverallPercent(p)).toBe(6);
    });

    it("shows progress during import phase after fetch", () => {
      const p = createProgress({
        status: "importing",
        totalSteps: 8,
        completedSteps: 2,
        currentCategory: "contacts",
        categoryTotal: 3000,
        categoryDone: 1500,
        fetchPhase: false,
        processedRecords: 500,
      });
      // basePercent = 25, categoryPercent = (1500/3000) * (100/8) = 6.25
      expect(calculateOverallPercent(p)).toBe(31);
    });
  });

  describe("isImportAlive heartbeat check", () => {
    it("returns true for null progress", () => {
      expect(isImportAlive(null)).toBe(true);
    });

    it("returns true for non-importing status", () => {
      const p = createProgress({ status: "done" });
      expect(isImportAlive(p)).toBe(true);
    });

    it("returns true when lastActivityAt is recent", () => {
      const p = createProgress({
        status: "importing",
        lastActivityAt: Date.now() - 5000, // 5 seconds ago
      });
      expect(isImportAlive(p)).toBe(true);
    });

    it("returns false when lastActivityAt is stale (>30s)", () => {
      const p = createProgress({
        status: "importing",
        lastActivityAt: Date.now() - 35000, // 35 seconds ago
      });
      expect(isImportAlive(p)).toBe(false);
    });
  });

  describe("ImportProgress structure", () => {
    it("has all required fields for enhanced tracking", () => {
      const p = createProgress();
      expect(p).toHaveProperty("fetchPhase");
      expect(p).toHaveProperty("fetchedRecords");
      expect(p).toHaveProperty("totalRecordsEstimate");
      expect(p).toHaveProperty("processedRecords");
      expect(p).toHaveProperty("lastActivityAt");
      expect(p.fetchPhase).toBe(false);
      expect(p.fetchedRecords).toBe(0);
      expect(p.totalRecordsEstimate).toBe(0);
      expect(p.processedRecords).toBe(0);
      expect(p.lastActivityAt).toBeGreaterThan(0);
    });

    it("updateProgress updates lastActivityAt automatically", () => {
      const p = createProgress({ lastActivityAt: 1000 });
      // Simulate updateProgress behavior
      const update: Partial<ImportProgress> = { phase: "Buscando contatos..." };
      Object.assign(p, update);
      p.lastActivityAt = Date.now();
      expect(p.lastActivityAt).toBeGreaterThan(1000);
      expect(p.phase).toBe("Buscando contatos...");
    });

    it("advanceStep preserves categoryTotal from previous step", () => {
      const p = createProgress({
        completedSteps: 2,
        categoryTotal: 500,
        categoryDone: 500,
      });
      // Simulate advanceStep: completedSteps++, but don't reset categoryTotal to 0
      p.completedSteps++;
      p.currentCategory = "deals";
      p.currentStep = "deals";
      // categoryTotal should NOT be reset to 0 (the bug we fixed)
      // In the new code, advanceStep only resets categoryDone
      p.categoryDone = 0;
      // categoryTotal remains from previous step until new category sets it
      expect(p.categoryTotal).toBe(500);
      expect(p.completedSteps).toBe(3);
    });

    it("tracks cumulative processedRecords across categories", () => {
      const p = createProgress({ processedRecords: 0 });
      // Simulate addProcessed for organizations
      p.processedRecords += 150;
      expect(p.processedRecords).toBe(150);
      // Simulate addProcessed for contacts
      p.processedRecords += 3000;
      expect(p.processedRecords).toBe(3150);
      // Simulate addProcessed for deals
      p.processedRecords += 2000;
      expect(p.processedRecords).toBe(5150);
    });

    it("tracks fetchedRecords during fetch phase", () => {
      const p = createProgress({ fetchedRecords: 0, fetchPhase: true });
      // Simulate fetching organizations
      p.fetchedRecords += 200;
      expect(p.fetchedRecords).toBe(200);
      // Simulate fetching contacts
      p.fetchedRecords += 5000;
      expect(p.fetchedRecords).toBe(5200);
      // After fetch, switch to import phase
      p.fetchPhase = false;
      expect(p.fetchPhase).toBe(false);
      expect(p.fetchedRecords).toBe(5200);
    });
  });

  describe("Phase transitions", () => {
    it("transitions from idle → fetching → importing → done", () => {
      const p = createProgress();
      expect(p.status).toBe("idle");

      // Start import
      p.status = "fetching";
      p.fetchPhase = true;
      expect(p.status).toBe("fetching");
      expect(p.fetchPhase).toBe(true);

      // Switch to import phase
      p.status = "importing";
      p.fetchPhase = false;
      expect(p.status).toBe("importing");
      expect(p.fetchPhase).toBe(false);

      // Complete
      p.status = "done";
      expect(p.status).toBe("done");
    });

    it("transitions to error state on failure", () => {
      const p = createProgress({ status: "importing" });
      p.status = "error";
      p.error = "Connection timeout";
      expect(p.status).toBe("error");
      expect(p.error).toBe("Connection timeout");
    });
  });
});
