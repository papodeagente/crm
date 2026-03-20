import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { rdStationConfig, teams, teamMembers, crmUsers } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const TEST_TENANT = 999888;

function createTestContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-team-assign",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    saasUser: { userId: 1, tenantId: TEST_TENANT, role: "admin" as const, email: "test@example.com", name: "Test User" },
    req: { protocol: "https", hostname: "test.manus.computer", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

let testTeamId: number;
let testUserId1: number;
let testUserId2: number;
let testUserId3: number;

describe("Team Assignment Distribution", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Clean up any previous test data
    await db.delete(teamMembers).where(eq(teamMembers.tenantId, TEST_TENANT));
    await db.delete(teams).where(eq(teams.tenantId, TEST_TENANT));
    await db.delete(rdStationConfig).where(eq(rdStationConfig.tenantId, TEST_TENANT));
    await db.delete(crmUsers).where(eq(crmUsers.tenantId, TEST_TENANT));

    // Create test CRM users
    const [u1] = await db.insert(crmUsers).values({
      tenantId: TEST_TENANT,
      name: "User A",
      email: "usera@test.com",
      status: "active",
      crm_user_role: "agent",
    }).$returningId();
    testUserId1 = u1!.id;

    const [u2] = await db.insert(crmUsers).values({
      tenantId: TEST_TENANT,
      name: "User B",
      email: "userb@test.com",
      status: "active",
      crm_user_role: "agent",
    }).$returningId();
    testUserId2 = u2!.id;

    const [u3] = await db.insert(crmUsers).values({
      tenantId: TEST_TENANT,
      name: "User C",
      email: "userc@test.com",
      status: "inactive",
      crm_user_role: "agent",
    }).$returningId();
    testUserId3 = u3!.id;

    // Create a test team
    const [team] = await db.insert(teams).values({
      tenantId: TEST_TENANT,
      name: "Test Sales Team",
    }).$returningId();
    testTeamId = team!.id;

    // Add users to team (2 active, 1 inactive)
    await db.insert(teamMembers).values([
      { tenantId: TEST_TENANT, userId: testUserId1, teamId: testTeamId, role: "member" },
      { tenantId: TEST_TENANT, userId: testUserId2, teamId: testTeamId, role: "member" },
      { tenantId: TEST_TENANT, userId: testUserId3, teamId: testTeamId, role: "member" },
    ]);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(teamMembers).where(eq(teamMembers.tenantId, TEST_TENANT));
    await db.delete(teams).where(eq(teams.tenantId, TEST_TENANT));
    await db.delete(rdStationConfig).where(eq(rdStationConfig.tenantId, TEST_TENANT));
    await db.delete(crmUsers).where(eq(crmUsers.tenantId, TEST_TENANT));
  });

  it("createConfig accepts assignmentTeamId", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const config = await caller.rdStation.createConfig({
      name: "Team Config Test",
      assignmentTeamId: testTeamId,
    });

    expect(config).toBeDefined();
    expect(config.assignmentTeamId).toBe(testTeamId);
    expect(config.defaultOwnerUserId).toBeNull();

    // Clean up
    await caller.rdStation.deleteConfig({ configId: config.id });
  });

  it("createConfig with user-specific mode sets defaultOwnerUserId and no team", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const config = await caller.rdStation.createConfig({
      name: "User Config Test",
      defaultOwnerUserId: testUserId1,
    });

    expect(config).toBeDefined();
    expect(config.defaultOwnerUserId).toBe(testUserId1);
    expect(config.assignmentTeamId).toBeNull();

    await caller.rdStation.deleteConfig({ configId: config.id });
  });

  it("createConfig with auto mode has both null", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const config = await caller.rdStation.createConfig({
      name: "Auto Config Test",
    });

    expect(config).toBeDefined();
    expect(config.defaultOwnerUserId).toBeNull();
    expect(config.assignmentTeamId).toBeNull();

    await caller.rdStation.deleteConfig({ configId: config.id });
  });

  it("updateConfig can switch from user to team mode", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create with user mode
    const config = await caller.rdStation.createConfig({
      name: "Switch Test",
      defaultOwnerUserId: testUserId1,
    });

    // Switch to team mode
    const updated = await caller.rdStation.updateConfig({
      configId: config.id,
      defaultOwnerUserId: null,
      assignmentTeamId: testTeamId,
    });

    expect(updated).toBeDefined();
    expect(updated!.defaultOwnerUserId).toBeNull();
    expect(updated!.assignmentTeamId).toBe(testTeamId);

    await caller.rdStation.deleteConfig({ configId: config.id });
  });

  it("updateConfig can switch from team to auto mode", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create with team mode
    const config = await caller.rdStation.createConfig({
      name: "Team to Auto Test",
      assignmentTeamId: testTeamId,
    });

    // Switch to auto mode
    const updated = await caller.rdStation.updateConfig({
      configId: config.id,
      assignmentTeamId: null,
      defaultOwnerUserId: null,
    });

    expect(updated).toBeDefined();
    expect(updated!.defaultOwnerUserId).toBeNull();
    expect(updated!.assignmentTeamId).toBeNull();

    await caller.rdStation.deleteConfig({ configId: config.id });
  });

  it("listTeamsForAssignment returns teams for the tenant", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const teams = await caller.rdStation.listTeamsForAssignment();

    expect(Array.isArray(teams)).toBe(true);
    const testTeam = teams.find((t: any) => t.id === testTeamId);
    expect(testTeam).toBeDefined();
    expect(testTeam!.name).toBe("Test Sales Team");
  });

  it("listTeamMembers returns active users for the tenant", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const members = await caller.rdStation.listTeamMembers();

    expect(Array.isArray(members)).toBe(true);
    // Should include active users
    const activeIds = members.map((m: any) => m.id);
    expect(activeIds).toContain(testUserId1);
    expect(activeIds).toContain(testUserId2);
    // Should NOT include inactive user
    expect(activeIds).not.toContain(testUserId3);
  });
});
