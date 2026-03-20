import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const TEST_TENANT = 777;

function createTenantContext(tenantId = TEST_TENANT): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-goals-progress",
    email: "test-goals@example.com",
    name: "Test Goals User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    saasUser: { userId: 1, tenantId, role: "admin" as const, email: "test-goals@example.com", name: "Test Goals User" },
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

describe("Goals progress calculation from pipeline", () => {
  const ctx = createTenantContext();
  const caller = appRouter.createCaller(ctx);

  // We need a pipeline and stage to create deals
  let pipelineId: number;
  let stageId: number;
  let wonStageId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Clean up any previous test data for this tenant
    await db.execute(sql`DELETE FROM deals WHERE tenantId = ${TEST_TENANT}`);
    await db.execute(sql`DELETE FROM goals WHERE tenantId = ${TEST_TENANT}`);
    await db.execute(sql`DELETE FROM pipeline_stages WHERE tenantId = ${TEST_TENANT}`);
    await db.execute(sql`DELETE FROM pipelines WHERE tenantId = ${TEST_TENANT}`);

    // Create a test pipeline
    const [pipelineResult] = await db.execute(
      sql`INSERT INTO pipelines (tenantId, name) VALUES (${TEST_TENANT}, 'Test Pipeline')`
    );
    pipelineId = (pipelineResult as any).insertId;

    // Create stages
    const [stageResult] = await db.execute(
      sql`INSERT INTO pipeline_stages (tenantId, pipelineId, name, orderIndex, probabilityDefault) VALUES (${TEST_TENANT}, ${pipelineId}, 'Open', 1, 0)`
    );
    stageId = (stageResult as any).insertId;

    const [wonStageResult] = await db.execute(
      sql`INSERT INTO pipeline_stages (tenantId, pipelineId, name, orderIndex, probabilityDefault, isWon) VALUES (${TEST_TENANT}, ${pipelineId}, 'Won', 2, 100, 1)`
    );
    wonStageId = (wonStageResult as any).insertId;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    // Clean up test data
    await db.execute(sql`DELETE FROM deals WHERE tenantId = ${TEST_TENANT}`);
    await db.execute(sql`DELETE FROM goals WHERE tenantId = ${TEST_TENANT}`);
    await db.execute(sql`DELETE FROM pipeline_stages WHERE tenantId = ${TEST_TENANT}`);
    await db.execute(sql`DELETE FROM pipelines WHERE tenantId = ${TEST_TENANT}`);
  });

  // ── total_sold: value of won deals ──

  it("total_sold goal starts at 0 with no won deals", async () => {
    const goal = await caller.management.goals.create({
      name: "Meta Valor Vendido",
      scope: "user",
      periodStart: "2025-01-01",
      periodEnd: "2027-12-31",
      metricKey: "total_sold",
      targetValue: 100000,
      userId: 1,
    });

    const list = await caller.management.goals.list();
    const g = list.find((x: any) => x.id === goal.id);
    expect(g).toBeTruthy();
    expect(g!.currentValue).toBe(0);
  });

  it("total_sold advances when a deal is marked as won", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Create a deal with status=won and valueCents=5000000 (R$50.000)
    await db.execute(
      sql`INSERT INTO deals (tenantId, title, pipelineId, stageId, valueCents, status, ownerUserId, createdAt) VALUES (${TEST_TENANT}, 'Won Deal 1', ${pipelineId}, ${wonStageId}, 5000000, 'won', 1, '2026-06-15 12:00:00')`
    );

    const list = await caller.management.goals.list();
    const g = list.find((x: any) => x.name === "Meta Valor Vendido");
    expect(g).toBeTruthy();
    expect(g!.currentValue).toBe(5000000); // 5000000 cents = R$50.000
  });

  it("total_sold accumulates multiple won deals", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Add another won deal
    await db.execute(
      sql`INSERT INTO deals (tenantId, title, pipelineId, stageId, valueCents, status, ownerUserId, createdAt) VALUES (${TEST_TENANT}, 'Won Deal 2', ${pipelineId}, ${wonStageId}, 3000000, 'won', 1, '2026-07-01 12:00:00')`
    );

    const list = await caller.management.goals.list();
    const g = list.find((x: any) => x.name === "Meta Valor Vendido");
    expect(g!.currentValue).toBe(8000000); // 5M + 3M = 8M cents
  });

  it("total_sold does NOT count open deals", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Add an open deal (should NOT count)
    await db.execute(
      sql`INSERT INTO deals (tenantId, title, pipelineId, stageId, valueCents, status, ownerUserId, createdAt) VALUES (${TEST_TENANT}, 'Open Deal', ${pipelineId}, ${stageId}, 9999999, 'open', 1, '2026-06-15 12:00:00')`
    );

    const list = await caller.management.goals.list();
    const g = list.find((x: any) => x.name === "Meta Valor Vendido");
    expect(g!.currentValue).toBe(8000000); // Still 8M, open deal not counted
  });

  it("total_sold does NOT count deals outside the period", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Add a won deal outside the period (2024, before period start)
    await db.execute(
      sql`INSERT INTO deals (tenantId, title, pipelineId, stageId, valueCents, status, ownerUserId, createdAt) VALUES (${TEST_TENANT}, 'Old Won Deal', ${pipelineId}, ${wonStageId}, 1000000, 'won', 1, '2024-01-01 12:00:00')`
    );

    const list = await caller.management.goals.list();
    const g = list.find((x: any) => x.name === "Meta Valor Vendido");
    expect(g!.currentValue).toBe(8000000); // Old deal not counted
  });

  // ── deals_count: number of deals created ──

  it("deals_count counts all deals created in the period", async () => {
    const goal = await caller.management.goals.create({
      name: "Meta Qtd Negociações",
      scope: "user",
      periodStart: "2025-01-01",
      periodEnd: "2027-12-31",
      metricKey: "deals_count",
      targetValue: 50,
      userId: 1,
    });

    const list = await caller.management.goals.list();
    const g = list.find((x: any) => x.id === goal.id);
    expect(g).toBeTruthy();
    // We have 3 deals in period (Won Deal 1, Won Deal 2, Open Deal) for user 1
    expect(g!.currentValue).toBe(3);
  });

  it("deals_count does NOT count deals outside the period", async () => {
    // The old deal from 2024 should not be counted
    const list = await caller.management.goals.list();
    const g = list.find((x: any) => x.name === "Meta Qtd Negociações");
    expect(g!.currentValue).toBe(3); // Only 3 in-period deals
  });

  // ── conversion_rate: won/total * 100 ──

  it("conversion_rate calculates correctly", async () => {
    const goal = await caller.management.goals.create({
      name: "Meta Taxa Conversão",
      scope: "user",
      periodStart: "2025-01-01",
      periodEnd: "2027-12-31",
      metricKey: "conversion_rate",
      targetValue: 80,
      userId: 1,
    });

    const list = await caller.management.goals.list();
    const g = list.find((x: any) => x.id === goal.id);
    expect(g).toBeTruthy();
    // 2 won out of 3 in-period deals = 66.7%
    expect(g!.currentValue).toBeCloseTo(66.7, 0);
  });

  // ── Scope: company ──

  it("company scope filters by accountId", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Create a deal for company (accountId=42)
    await db.execute(
      sql`INSERT INTO deals (tenantId, title, pipelineId, stageId, valueCents, status, accountId, createdAt) VALUES (${TEST_TENANT}, 'Company Deal', ${pipelineId}, ${wonStageId}, 2000000, 'won', 42, '2026-06-15 12:00:00')`
    );

    const goal = await caller.management.goals.create({
      name: "Meta Empresa",
      scope: "company",
      periodStart: "2025-01-01",
      periodEnd: "2027-12-31",
      metricKey: "total_sold",
      targetValue: 100000,
      companyId: 42,
    });

    const list = await caller.management.goals.list();
    const g = list.find((x: any) => x.id === goal.id);
    expect(g).toBeTruthy();
    expect(g!.currentValue).toBe(2000000); // Only the company deal
  });

  // ── Scope: user isolation ──

  it("user scope only counts deals for that user", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Create a deal for a different user (ownerUserId=99)
    await db.execute(
      sql`INSERT INTO deals (tenantId, title, pipelineId, stageId, valueCents, status, ownerUserId, createdAt) VALUES (${TEST_TENANT}, 'Other User Deal', ${pipelineId}, ${wonStageId}, 7000000, 'won', 99, '2026-06-15 12:00:00')`
    );

    // The "Meta Valor Vendido" goal is for userId=1, should NOT include userId=99 deal
    const list = await caller.management.goals.list();
    const g = list.find((x: any) => x.name === "Meta Valor Vendido");
    expect(g!.currentValue).toBe(8000000); // Still 8M, other user's deal not counted
  });

  // ── Tenant isolation ──

  it("goals from another tenant don't see this tenant's deals", async () => {
    const otherCtx = createTenantContext(666);
    const otherCaller = appRouter.createCaller(otherCtx);

    const goal = await otherCaller.management.goals.create({
      name: "Other Tenant Goal",
      scope: "user",
      periodStart: "2025-01-01",
      periodEnd: "2027-12-31",
      metricKey: "total_sold",
      targetValue: 100000,
    });

    const list = await otherCaller.management.goals.list();
    const g = list.find((x: any) => x.id === goal.id);
    expect(g!.currentValue).toBe(0); // No deals in tenant 666

    // Cleanup
    await otherCaller.management.goals.delete({ id: goal.id });
  });

  // ── Pipeline still works ──

  it("pipeline listing still works normally", async () => {
    // Just verify that the CRM deal listing still works (returns data without error)
    const result = await caller.crm.deals.list({ pipelineId, limit: 10 });
    expect(result).toBeTruthy();
  });

  // ── Cleanup ──

  it("cleanup: delete all test goals", async () => {
    const list = await caller.management.goals.list();
    for (const g of list) {
      await caller.management.goals.delete({ id: g.id });
    }
    const afterCleanup = await caller.management.goals.list();
    expect(afterCleanup.length).toBe(0);
  });
});
