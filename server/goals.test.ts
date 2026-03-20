import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTenantContext(tenantId = 1): TrpcContext {
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

  return {
    user,
    saasUser: { userId: 1, tenantId, role: "admin" as const, email: "test@example.com", name: "Test User" },
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

describe("management.goals", () => {
  const ctx = createTenantContext(999);
  const caller = appRouter.createCaller(ctx);

  // ── CREATE ──

  it("creates a goal with scope=user and metricKey=total_sold", async () => {
    const result = await caller.management.goals.create({
      name: "Meta vendas Q1",
      scope: "user",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
      metricKey: "total_sold",
      targetValue: 100000,
      userId: 1,
    });
    expect(result).toBeTruthy();
    expect(result).toHaveProperty("id");
  });

  it("creates a goal with scope=company and metricKey=deals_count", async () => {
    const result = await caller.management.goals.create({
      name: "Meta negociações empresa",
      scope: "company",
      periodStart: "2026-01-01",
      periodEnd: "2026-06-30",
      metricKey: "deals_count",
      targetValue: 50,
      companyId: 1,
    });
    expect(result).toBeTruthy();
    expect(result).toHaveProperty("id");
  });

  it("creates a goal with scope=user and metricKey=conversion_rate", async () => {
    const result = await caller.management.goals.create({
      scope: "user",
      periodStart: "2026-04-01",
      periodEnd: "2026-06-30",
      metricKey: "conversion_rate",
      targetValue: 25,
      userId: 1,
    });
    expect(result).toBeTruthy();
    expect(result).toHaveProperty("id");
  });

  it("creates a goal with scope=company and metricKey=total_sold", async () => {
    const result = await caller.management.goals.create({
      scope: "company",
      periodStart: "2026-07-01",
      periodEnd: "2026-12-31",
      metricKey: "total_sold",
      targetValue: 500000,
      companyId: 2,
    });
    expect(result).toBeTruthy();
    expect(result).toHaveProperty("id");
  });

  it("creates a goal with scope=user and metricKey=deals_count", async () => {
    const result = await caller.management.goals.create({
      scope: "user",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      metricKey: "deals_count",
      targetValue: 100,
    });
    expect(result).toBeTruthy();
    expect(result).toHaveProperty("id");
  });

  it("creates a goal with scope=company and metricKey=conversion_rate", async () => {
    const result = await caller.management.goals.create({
      scope: "company",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
      metricKey: "conversion_rate",
      targetValue: 30,
    });
    expect(result).toBeTruthy();
    expect(result).toHaveProperty("id");
  });

  // ── LIST ──

  it("lists goals for the tenant", async () => {
    const list = await caller.management.goals.list();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(6);
    // All goals should belong to tenant 999
    for (const g of list) {
      expect(g.tenantId).toBe(999);
    }
  });

  // ── GET ──

  it("gets a single goal by id", async () => {
    const list = await caller.management.goals.list();
    const first = list[0];
    if (!first) return; // skip if no goals
    const goal = await caller.management.goals.get({ id: first.id });
    expect(goal).toBeTruthy();
    expect(goal!.id).toBe(first.id);
    expect(goal!.tenantId).toBe(999);
  });

  // ── UPDATE ──

  it("updates a goal name and targetValue", async () => {
    const list = await caller.management.goals.list();
    const first = list[0];
    if (!first) return;
    const result = await caller.management.goals.update({
      id: first.id,
      name: "Meta atualizada",
      targetValue: 999999,
    });
    expect(result).toHaveProperty("id", first.id);

    // Verify update
    const updated = await caller.management.goals.get({ id: first.id });
    expect(updated!.name).toBe("Meta atualizada");
    expect(updated!.targetValue).toBe(999999);
  });

  // ── DELETE ──

  it("deletes a goal", async () => {
    const list = await caller.management.goals.list();
    const last = list[list.length - 1];
    if (!last) return;
    const result = await caller.management.goals.delete({ id: last.id });
    expect(result).toHaveProperty("id", last.id);

    // Verify deletion
    const deleted = await caller.management.goals.get({ id: last.id });
    expect(deleted).toBeNull();
  });

  // ── VALIDATION ──

  it("rejects targetValue <= 0", async () => {
    await expect(
      caller.management.goals.create({
        scope: "user",
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        metricKey: "total_sold",
        targetValue: 0,
      })
    ).rejects.toThrow();
  });

  it("rejects negative targetValue", async () => {
    await expect(
      caller.management.goals.create({
        scope: "user",
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        metricKey: "total_sold",
        targetValue: -100,
      })
    ).rejects.toThrow();
  });

  // ── TENANT ISOLATION ──

  it("does not return goals from another tenant", async () => {
    const otherCtx = createTenantContext(888);
    const otherCaller = appRouter.createCaller(otherCtx);
    const otherList = await otherCaller.management.goals.list();
    // Should not contain any goals from tenant 999
    for (const g of otherList) {
      expect(g.tenantId).not.toBe(999);
    }
  });

  // ── COMPANIES LIST ──

  it("lists companies for the tenant", async () => {
    const list = await caller.management.companies.list();
    expect(Array.isArray(list)).toBe(true);
  });

  // ── CLEANUP: delete all test goals ──

  it("cleanup: delete all goals created by tests", async () => {
    const list = await caller.management.goals.list();
    for (const g of list) {
      await caller.management.goals.delete({ id: g.id });
    }
    const afterCleanup = await caller.management.goals.list();
    expect(afterCleanup.length).toBe(0);
  });
});
