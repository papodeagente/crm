import { describe, it, expect } from "vitest";

/**
 * Tests for the lead distribution logic used in the RD Station webhook.
 * We test the pure round-robin algorithm and mode selection logic
 * without hitting the actual database.
 */

// ─── Pure Round-Robin Algorithm ─────────────────────────
// This mirrors the logic in webhookRoutes.ts for both random_all and random_team modes

function getNextRoundRobin(sortedUserIds: number[], lastAssignedUserId: number | null): number {
  if (sortedUserIds.length === 0) throw new Error("No users available");
  const lastId = lastAssignedUserId ?? 0;
  return sortedUserIds.find(id => id > lastId) ?? sortedUserIds[0]!;
}

// ─── Assignment Mode Resolver ───────────────────────────
// This mirrors the logic in webhookRoutes.ts for resolving the ownerUserId

interface ConfigInput {
  assignmentMode: "specific_user" | "random_all" | "random_team";
  defaultOwnerUserId: number | null;
  assignmentTeamId: number | null;
  lastRoundRobinUserId: number | null;
}

function resolveAssignmentMode(config: ConfigInput): "specific_user" | "random_all" | "random_team" {
  return config.assignmentMode || "random_all";
}

function shouldUseSpecificUser(config: ConfigInput): boolean {
  return resolveAssignmentMode(config) === "specific_user" && config.defaultOwnerUserId !== null;
}

function shouldUseTeamRoundRobin(config: ConfigInput): boolean {
  return resolveAssignmentMode(config) === "random_team" && config.assignmentTeamId !== null;
}

// ─── Tests ──────────────────────────────────────────────

describe("Lead Distribution - Round-Robin Algorithm", () => {
  it("should cycle through users in order", () => {
    const users = [100, 200, 300];
    
    const first = getNextRoundRobin(users, null);
    expect(first).toBe(100);
    
    const second = getNextRoundRobin(users, 100);
    expect(second).toBe(200);
    
    const third = getNextRoundRobin(users, 200);
    expect(third).toBe(300);
  });

  it("should wrap around to the first user after the last", () => {
    const users = [100, 200, 300];
    const next = getNextRoundRobin(users, 300);
    expect(next).toBe(100);
  });

  it("should handle a single user", () => {
    const users = [42];
    expect(getNextRoundRobin(users, null)).toBe(42);
    expect(getNextRoundRobin(users, 42)).toBe(42);
  });

  it("should handle lastAssignedUserId not in the current user list (user was removed)", () => {
    const users = [100, 300, 500];
    // lastAssignedUserId=200 is not in the list, should pick next > 200 → 300
    expect(getNextRoundRobin(users, 200)).toBe(300);
  });

  it("should handle lastAssignedUserId greater than all users (wrap around)", () => {
    const users = [100, 200, 300];
    expect(getNextRoundRobin(users, 999)).toBe(100);
  });

  it("should throw on empty user list", () => {
    expect(() => getNextRoundRobin([], null)).toThrow("No users available");
  });

  it("should distribute evenly across 2 users over 6 iterations", () => {
    const users = [10, 20];
    const assignments: number[] = [];
    let lastId: number | null = null;
    
    for (let i = 0; i < 6; i++) {
      const next = getNextRoundRobin(users, lastId);
      assignments.push(next);
      lastId = next;
    }
    
    expect(assignments).toEqual([10, 20, 10, 20, 10, 20]);
    const count10 = assignments.filter(a => a === 10).length;
    const count20 = assignments.filter(a => a === 20).length;
    expect(count10).toBe(3);
    expect(count20).toBe(3);
  });

  it("should distribute evenly across 3 users over 9 iterations", () => {
    const users = [5, 15, 25];
    const assignments: number[] = [];
    let lastId: number | null = null;
    
    for (let i = 0; i < 9; i++) {
      const next = getNextRoundRobin(users, lastId);
      assignments.push(next);
      lastId = next;
    }
    
    expect(assignments).toEqual([5, 15, 25, 5, 15, 25, 5, 15, 25]);
  });
});

describe("Lead Distribution - Assignment Mode Selection", () => {
  it("should use specific_user mode when configured", () => {
    const config: ConfigInput = {
      assignmentMode: "specific_user",
      defaultOwnerUserId: 42,
      assignmentTeamId: null,
      lastRoundRobinUserId: null,
    };
    expect(resolveAssignmentMode(config)).toBe("specific_user");
    expect(shouldUseSpecificUser(config)).toBe(true);
    expect(shouldUseTeamRoundRobin(config)).toBe(false);
  });

  it("should use random_all mode when configured", () => {
    const config: ConfigInput = {
      assignmentMode: "random_all",
      defaultOwnerUserId: null,
      assignmentTeamId: null,
      lastRoundRobinUserId: null,
    };
    expect(resolveAssignmentMode(config)).toBe("random_all");
    expect(shouldUseSpecificUser(config)).toBe(false);
    expect(shouldUseTeamRoundRobin(config)).toBe(false);
  });

  it("should use random_team mode when configured with a team", () => {
    const config: ConfigInput = {
      assignmentMode: "random_team",
      defaultOwnerUserId: null,
      assignmentTeamId: 7,
      lastRoundRobinUserId: null,
    };
    expect(resolveAssignmentMode(config)).toBe("random_team");
    expect(shouldUseSpecificUser(config)).toBe(false);
    expect(shouldUseTeamRoundRobin(config)).toBe(true);
  });

  it("should not use specific_user if defaultOwnerUserId is null", () => {
    const config: ConfigInput = {
      assignmentMode: "specific_user",
      defaultOwnerUserId: null,
      assignmentTeamId: null,
      lastRoundRobinUserId: null,
    };
    expect(shouldUseSpecificUser(config)).toBe(false);
  });

  it("should not use random_team if assignmentTeamId is null", () => {
    const config: ConfigInput = {
      assignmentMode: "random_team",
      defaultOwnerUserId: null,
      assignmentTeamId: null,
      lastRoundRobinUserId: null,
    };
    expect(shouldUseTeamRoundRobin(config)).toBe(false);
  });
});

describe("Lead Distribution - Persistence", () => {
  it("should maintain round-robin state across simulated server restarts", () => {
    const users = [100, 200, 300];
    
    // Simulate: server processes 2 leads, persists lastRoundRobinUserId=200
    let lastId: number | null = null;
    lastId = getNextRoundRobin(users, lastId); // 100
    lastId = getNextRoundRobin(users, lastId); // 200
    expect(lastId).toBe(200);
    
    // Simulate: server restarts, loads lastRoundRobinUserId=200 from DB
    const persistedLastId = 200;
    const nextAfterRestart = getNextRoundRobin(users, persistedLastId);
    expect(nextAfterRestart).toBe(300); // continues from where it left off
  });

  it("should handle user list changes between restarts", () => {
    // Before restart: users [100, 200, 300], last assigned = 200
    const persistedLastId = 200;
    
    // After restart: user 200 was deactivated, new list is [100, 300, 400]
    const newUsers = [100, 300, 400];
    const next = getNextRoundRobin(newUsers, persistedLastId);
    expect(next).toBe(300); // picks next > 200
  });
});

describe("Lead Distribution - Isolation per Config", () => {
  it("should maintain separate round-robin state per config", () => {
    const usersConfigA = [10, 20];
    const usersConfigB = [30, 40, 50];
    
    // Config A processes 3 leads
    let lastA: number | null = null;
    lastA = getNextRoundRobin(usersConfigA, lastA); // 10
    lastA = getNextRoundRobin(usersConfigA, lastA); // 20
    lastA = getNextRoundRobin(usersConfigA, lastA); // 10
    expect(lastA).toBe(10);
    
    // Config B processes 2 leads (independent state)
    let lastB: number | null = null;
    lastB = getNextRoundRobin(usersConfigB, lastB); // 30
    lastB = getNextRoundRobin(usersConfigB, lastB); // 40
    expect(lastB).toBe(40);
    
    // Config A continues from its own state
    lastA = getNextRoundRobin(usersConfigA, lastA); // 20
    expect(lastA).toBe(20);
  });
});
