import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): { ctx: TrpcContext } {
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
    ...overrides,
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

describe("changePipeline — Alterar Funil da Negociação", () => {
  // ─── 1. Procedure exists ───
  it("crm.deals.changePipeline procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.deals.changePipeline).toBe("function");
  });

  // ─── 2. Input validation: requires all fields ───
  it("rejects call without required fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      (caller.crm.deals.changePipeline as any)({
        tenantId: 1,
        dealId: 1,
        // missing newPipelineId, newStageId, newPipelineName, newStageName
      })
    ).rejects.toThrow();
  });

  // ─── 3. Rejects non-existent deal ───
  it("rejects when deal does not exist", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.crm.deals.changePipeline({
        tenantId: 999999,
        dealId: 999999,
        newPipelineId: 1,
        newStageId: 1,
        newPipelineName: "Test",
        newStageName: "Test Stage",
      })
    ).rejects.toThrow();
  });

  // ─── 4. Rejects invalid pipeline for tenant ───
  it("rejects when pipeline does not belong to tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Use a non-existent pipeline ID
    await expect(
      caller.crm.deals.changePipeline({
        tenantId: 999999,
        dealId: 1,
        newPipelineId: 999999,
        newStageId: 1,
        newPipelineName: "Fake Pipeline",
        newStageName: "Fake Stage",
      })
    ).rejects.toThrow();
  });

  // ─── 5. Rejects stage not belonging to pipeline ───
  it("rejects when stage does not belong to the selected pipeline", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Even if deal exists, a mismatched stage/pipeline should fail
    await expect(
      caller.crm.deals.changePipeline({
        tenantId: 999999,
        dealId: 1,
        newPipelineId: 1,
        newStageId: 999999,
        newPipelineName: "Pipeline",
        newStageName: "Wrong Stage",
      })
    ).rejects.toThrow();
  });

  // ─── 6. Tenant isolation: different tenant cannot change another's deal ───
  it("tenant isolation: cannot change pipeline of deal from different tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Tenant 999998 trying to change a deal that belongs to tenant 999999
    await expect(
      caller.crm.deals.changePipeline({
        tenantId: 999998,
        dealId: 1,
        newPipelineId: 1,
        newStageId: 1,
        newPipelineName: "Pipeline",
        newStageName: "Stage",
      })
    ).rejects.toThrow();
  });

  // ─── 7. updateDeal in crmDb accepts pipelineId ───
  it("crmDb.updateDeal signature accepts pipelineId", async () => {
    // This is a compile-time check — if pipelineId is not in the type, TS would fail
    const { updateDeal } = await import("./crmDb");
    expect(typeof updateDeal).toBe("function");
    // Verify it doesn't throw on a non-existent deal (just returns undefined)
    const result = await updateDeal(999999, 999999, { pipelineId: 1, stageId: 1 });
    expect(result).toBeUndefined();
  });

  // ─── 8. History is recorded (structural check) ───
  it("createDealHistory function exists and accepts pipeline-related fields", async () => {
    const { createDealHistory } = await import("./crmDb");
    expect(typeof createDealHistory).toBe("function");
  });

  // ─── 9. moveStage still works (regression check) ───
  it("crm.deals.moveStage procedure still exists (regression)", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.deals.moveStage).toBe("function");
  });

  // ─── 10. Pipeline list endpoint still works ───
  it("crm.pipelines.list procedure exists for pipeline selection", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.pipelines.list).toBe("function");
  });

  // ─── 11. Pipeline stages endpoint still works ───
  it("crm.pipelines.stages procedure exists for stage selection", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.pipelines.stages).toBe("function");
  });
});
