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

describe("Dashboard Endpoints", () => {
  it("dashboard.metrics returns all metric fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.metrics({ tenantId: 1 });

    expect(result).toBeDefined();
    expect(typeof result.activeDeals).toBe("number");
    expect(typeof result.activeDealsChange).toBe("number");
    expect(typeof result.totalContacts).toBe("number");
    expect(typeof result.totalContactsChange).toBe("number");
    expect(typeof result.activeTrips).toBe("number");
    expect(typeof result.activeTripsChange).toBe("number");
    expect(typeof result.pendingTasks).toBe("number");
    expect(typeof result.pendingTasksChange).toBe("number");
    expect(typeof result.totalDealValueCents).toBe("number");
  });

  it("dashboard.metrics returns zero values for non-existent tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.metrics({ tenantId: 99999 });

    expect(result.activeDeals).toBe(0);
    expect(result.totalContacts).toBe(0);
    expect(result.activeTrips).toBe(0);
    expect(result.pendingTasks).toBe(0);
    expect(result.totalDealValueCents).toBe(0);
  });

  it("dashboard.pipelineSummary returns array of stages", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.pipelineSummary({ tenantId: 1 });

    expect(Array.isArray(result)).toBe(true);
    // Each stage should have the correct shape including new fields
    if (result.length > 0) {
      const stage = result[0];
      expect(typeof stage.stageId).toBe("number");
      expect(typeof stage.stageName).toBe("string");
      expect(stage).toHaveProperty("stageColor");
      expect(typeof stage.orderIndex).toBe("number");
      expect(typeof stage.dealCount).toBe("number");
      expect(typeof stage.totalValueCents).toBe("number");
      expect(typeof stage.isWon).toBe("boolean");
      expect(typeof stage.isLost).toBe("boolean");
    }
  });

  it("dashboard.pipelineSummary returns empty array for non-existent tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.pipelineSummary({ tenantId: 99999 });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("dashboard.recentActivity returns array of activities", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.recentActivity({ tenantId: 1 });

    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      const activity = result[0];
      expect(typeof activity.id).toBe("number");
      expect(typeof activity.dealId).toBe("number");
      expect(typeof activity.action).toBe("string");
      expect(typeof activity.description).toBe("string");
      expect(typeof activity.createdAt).toBe("number");
    }
  });

  it("dashboard.recentActivity respects limit parameter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.recentActivity({ tenantId: 1, limit: 2 });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("dashboard.upcomingTasks returns array of tasks with isOverdue and taskType", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.upcomingTasks({ tenantId: 1 });

    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      const task = result[0];
      expect(typeof task.id).toBe("number");
      expect(typeof task.title).toBe("string");
      expect(typeof task.priority).toBe("string");
      expect(["low", "medium", "high", "urgent"]).toContain(task.priority);
      expect(typeof task.status).toBe("string");
      expect(["pending", "in_progress"]).toContain(task.status);
      expect(typeof task.isOverdue).toBe("boolean");
      expect(typeof task.taskType).toBe("string");
    }
  });

  it("dashboard.upcomingTasks respects limit parameter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.upcomingTasks({ tenantId: 1, limit: 3 });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("dashboard.upcomingTasks returns empty for non-existent tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.upcomingTasks({ tenantId: 99999 });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});
