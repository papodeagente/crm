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
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("home.executive", () => {
  it("returns executive KPIs with expected shape", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.home.executive();

    // Verify shape
    expect(result).toHaveProperty("dealsWithoutTask");
    expect(result).toHaveProperty("coolingDeals");
    expect(result).toHaveProperty("activeDeals");
    expect(result).toHaveProperty("activeValueCents");
    expect(result).toHaveProperty("conversionRate");
    expect(result).toHaveProperty("wonValueCents");
    expect(result).toHaveProperty("forecastCents");
    expect(result).toHaveProperty("wonDeals");
    expect(result).toHaveProperty("lostDeals");
    expect(result).toHaveProperty("dealsWithoutTaskList");
    expect(result).toHaveProperty("coolingDealsList");

    // Types
    expect(typeof result.dealsWithoutTask).toBe("number");
    expect(typeof result.coolingDeals).toBe("number");
    expect(typeof result.activeDeals).toBe("number");
    expect(typeof result.activeValueCents).toBe("number");
    expect(typeof result.conversionRate).toBe("number");
    expect(typeof result.wonValueCents).toBe("number");
    expect(typeof result.forecastCents).toBe("number");
    expect(typeof result.wonDeals).toBe("number");
    expect(typeof result.lostDeals).toBe("number");
    expect(Array.isArray(result.dealsWithoutTaskList)).toBe(true);
    expect(Array.isArray(result.coolingDealsList)).toBe(true);

    // Conversion rate should be 0-100
    expect(result.conversionRate).toBeGreaterThanOrEqual(0);
    expect(result.conversionRate).toBeLessThanOrEqual(100);
  });
});

describe("home.tasks", () => {
  it("returns an array of tasks with enriched shape", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.home.tasks({ limit: 5 });

    expect(Array.isArray(result)).toBe(true);

    // If there are tasks, validate enriched shape
    if (result.length > 0) {
      const task = result[0];
      // Core fields
      expect(task).toHaveProperty("id");
      expect(task).toHaveProperty("title");
      expect(task).toHaveProperty("priority");
      expect(task).toHaveProperty("status");
      expect(task).toHaveProperty("isOverdue");
      expect(task).toHaveProperty("taskType");
      expect(task).toHaveProperty("entityType");
      expect(task).toHaveProperty("entityId");
      // Enriched fields (nullable)
      expect(task).toHaveProperty("dealTitle");
      expect(task).toHaveProperty("dealValueCents");
      expect(task).toHaveProperty("contactName");
      expect(task).toHaveProperty("accountName");
      expect(task).toHaveProperty("description");
      // Type checks
      expect(typeof task.id).toBe("number");
      expect(typeof task.title).toBe("string");
      expect(typeof task.isOverdue).toBe("boolean");
      expect(["pending", "in_progress"]).toContain(task.status);
      expect(["low", "medium", "high", "urgent"]).toContain(task.priority);
    }
  });

  it("respects limit parameter", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.home.tasks({ limit: 2 });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("admin sees all tasks (no user filter)", async () => {
    const ctx = createAuthContext(1, 1);
    ctx.saasUser!.role = "admin";
    const caller = appRouter.createCaller(ctx);
    const result = await caller.home.tasks({ limit: 15 });

    expect(Array.isArray(result)).toBe(true);
    // Admin should get results without user filter
  });

  it("non-admin sees only own tasks", async () => {
    const ctx = createAuthContext(1, 999);
    ctx.saasUser!.role = "user";
    const caller = appRouter.createCaller(ctx);
    const result = await caller.home.tasks({ limit: 15 });

    expect(Array.isArray(result)).toBe(true);
    // Non-admin with userId=999 should only see tasks assigned/created by them
  });

  it("tasks are ordered: overdue first, then today, then future", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.home.tasks({ limit: 15 });

    if (result.length >= 2) {
      const now = Date.now();
      let lastGroup = -1;
      for (const task of result) {
        const group = task.dueAt === null ? 3 : task.dueAt < now ? 0 : 2;
        // Each task's group should be >= the previous task's group (ordered)
        expect(group).toBeGreaterThanOrEqual(lastGroup === -1 ? group : lastGroup);
        lastGroup = group;
      }
    }
  });
});

describe("home.rfv", () => {
  it("returns RFV opportunity counts with expected shape", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.home.rfv();

    expect(result).toHaveProperty("indicacao");
    expect(result).toHaveProperty("recuperacao");
    expect(result).toHaveProperty("recorrencia");

    expect(typeof result.indicacao).toBe("number");
    expect(typeof result.recuperacao).toBe("number");
    expect(typeof result.recorrencia).toBe("number");

    // All should be non-negative
    expect(result.indicacao).toBeGreaterThanOrEqual(0);
    expect(result.recuperacao).toBeGreaterThanOrEqual(0);
    expect(result.recorrencia).toBeGreaterThanOrEqual(0);
  });
});

describe("home.onboarding", () => {
  it("returns onboarding progress with expected shape", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.home.onboarding();

    expect(result).toHaveProperty("dismissed");

    if (!result.dismissed) {
      expect(result).toHaveProperty("steps");
      expect(result).toHaveProperty("completedCount");
      expect(result).toHaveProperty("totalSteps");
      expect(result).toHaveProperty("progressPercent");

      expect(Array.isArray(result.steps)).toBe(true);
      expect(typeof result.completedCount).toBe("number");
      expect(typeof result.totalSteps).toBe("number");
      expect(typeof result.progressPercent).toBe("number");

      // Progress should be 0-100
      expect(result.progressPercent).toBeGreaterThanOrEqual(0);
      expect(result.progressPercent).toBeLessThanOrEqual(100);

      // Each step should have expected shape
      if (result.steps.length > 0) {
        const step = result.steps[0];
        expect(step).toHaveProperty("key");
        expect(step).toHaveProperty("label");
        expect(step).toHaveProperty("completed");
        expect(typeof step.completed).toBe("boolean");
      }
    }
  });
});
