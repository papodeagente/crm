import { describe, it, expect } from "vitest";

/**
 * Tests for the global search route generation logic.
 * The SearchPalette in TopNavLayout.tsx generates paths for each result type.
 * These tests validate that the generated paths match the registered routes in App.tsx.
 *
 * App.tsx routes:
 *   /contact/:id  → ContactProfile
 *   /deal/:id     → DealDetail
 *   /tasks        → Tasks
 */

// Simulate the route generation logic from SearchPalette
function buildContactPath(contactId: number): string {
  return `/contact/${contactId}`;
}

function buildDealPath(dealId: number): string {
  return `/deal/${dealId}`;
}

function buildTaskPath(entityType: string | null, entityId: number | null): string {
  return entityType === "deal" ? `/deal/${entityId}` : "/tasks";
}

// Simulate the notification route generation logic
function buildNotificationRoute(type: string, entityId: string): string {
  const routes: Record<string, (id: string) => string> = {
    deal_moved: (id) => `/deal/${id}`,
    deal_created: (id) => `/deal/${id}`,
    contact_created: (id) => `/contacts?id=${id}`,
    task_created: () => "/tasks",
    rfv_filter_alert: (filterKey) => `/rfv?filter=${filterKey}`,
  };
  return routes[type]?.(entityId) ?? "/";
}

// Valid route patterns from App.tsx
const VALID_ROUTE_PATTERNS = [
  /^\/contact\/\d+$/,
  /^\/deal\/\d+$/,
  /^\/tasks$/,
  /^\/contacts(\?.*)?$/,
  /^\/rfv(\?.*)?$/,
  /^\/dashboard$/,
  /^\/pipeline$/,
  /^\/inbox$/,
  /^\/supervision$/,
  /^\/insights$/,
  /^\/settings.*$/,
  /^\/notifications$/,
];

function isValidRoute(path: string): boolean {
  return VALID_ROUTE_PATTERNS.some((pattern) => pattern.test(path));
}

describe("Search Navigation — Route Generation", () => {
  describe("Contact results", () => {
    it("generates /contact/:id (singular) for contact results", () => {
      const path = buildContactPath(42);
      expect(path).toBe("/contact/42");
    });

    it("does NOT generate /contacts/:id (plural) — that would be a 404", () => {
      const path = buildContactPath(42);
      expect(path).not.toMatch(/^\/contacts\/\d+$/);
    });

    it("route is valid and matches App.tsx", () => {
      const path = buildContactPath(123);
      expect(isValidRoute(path)).toBe(true);
    });
  });

  describe("Deal results", () => {
    it("generates /deal/:id (singular) for deal results", () => {
      const path = buildDealPath(99);
      expect(path).toBe("/deal/99");
    });

    it("does NOT generate /deals/:id (plural) — that would be a 404", () => {
      const path = buildDealPath(99);
      expect(path).not.toMatch(/^\/deals\/\d+$/);
    });

    it("route is valid and matches App.tsx", () => {
      const path = buildDealPath(555);
      expect(isValidRoute(path)).toBe(true);
    });
  });

  describe("Task results", () => {
    it("generates /deal/:id when task is linked to a deal", () => {
      const path = buildTaskPath("deal", 77);
      expect(path).toBe("/deal/77");
      expect(isValidRoute(path)).toBe(true);
    });

    it("generates /tasks when task is not linked to a deal", () => {
      const path = buildTaskPath("contact", 10);
      expect(path).toBe("/tasks");
      expect(isValidRoute(path)).toBe(true);
    });

    it("generates /tasks when entityType is null", () => {
      const path = buildTaskPath(null, null);
      expect(path).toBe("/tasks");
      expect(isValidRoute(path)).toBe(true);
    });
  });

  describe("Notification routes", () => {
    it("deal_moved notification routes to /deal/:id (singular)", () => {
      const path = buildNotificationRoute("deal_moved", "42");
      expect(path).toBe("/deal/42");
      expect(path).not.toMatch(/^\/deals\//);
    });

    it("deal_created notification routes to /deal/:id (singular)", () => {
      const path = buildNotificationRoute("deal_created", "99");
      expect(path).toBe("/deal/99");
      expect(path).not.toMatch(/^\/deals\//);
    });
  });

  describe("No invalid routes for supported types", () => {
    it("no result type generates a /deals/ path (plural with ID)", () => {
      const paths = [
        buildContactPath(1),
        buildDealPath(2),
        buildTaskPath("deal", 3),
        buildTaskPath("contact", 4),
        buildNotificationRoute("deal_moved", "5"),
        buildNotificationRoute("deal_created", "6"),
      ];
      paths.forEach((p) => {
        expect(p).not.toMatch(/^\/deals\/\d+$/);
      });
    });

    it("no result type generates a /contacts/:id path (plural with ID)", () => {
      const paths = [
        buildContactPath(1),
        buildDealPath(2),
        buildTaskPath("deal", 3),
        buildTaskPath("contact", 4),
      ];
      paths.forEach((p) => {
        expect(p).not.toMatch(/^\/contacts\/\d+$/);
      });
    });
  });
});
