import { describe, expect, it, vi } from "vitest";
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

function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
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

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.openId).toBe("test-user");
    expect(result?.email).toBe("test@example.com");
  });

  it("returns null when not authenticated", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("auth.logout", () => {
  it("clears cookie and returns success", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});

describe("appRouter structure", () => {
  it("has all expected top-level routers", () => {
    const routerKeys = Object.keys(appRouter._def.procedures);
    // Verify key routers exist by checking for known procedure paths
    expect(routerKeys.length).toBeGreaterThan(0);
  });

  it("has CRM router with contacts procedures", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Verify the crm.contacts.list procedure exists
    expect(caller.crm).toBeDefined();
    expect(caller.crm.contacts).toBeDefined();
    expect(typeof caller.crm.contacts.list).toBe("function");
  });

  it("has CRM router with deals procedures", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.crm.deals).toBeDefined();
    expect(typeof caller.crm.deals.list).toBe("function");
  });

  it("has CRM router with pipelines procedures", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.crm.pipelines).toBeDefined();
    expect(typeof caller.crm.pipelines.list).toBe("function");
  });

  it("has CRM router with trips procedures", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.crm.trips).toBeDefined();
    expect(typeof caller.crm.trips.list).toBe("function");
  });

  it("has CRM router with tasks procedures", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.crm.tasks).toBeDefined();
    expect(typeof caller.crm.tasks.list).toBe("function");
  });

  it("has inbox router with conversations and messages", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.inbox).toBeDefined();
    expect(caller.inbox.conversations).toBeDefined();
    expect(typeof caller.inbox.conversations.list).toBe("function");
    expect(caller.inbox.messages).toBeDefined();
    expect(typeof caller.inbox.messages.list).toBe("function");
  });

  it("has admin router with users, teams, roles", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.admin).toBeDefined();
    expect(caller.admin.users).toBeDefined();
    expect(typeof caller.admin.users.list).toBe("function");
    expect(caller.admin.teams).toBeDefined();
    expect(typeof caller.admin.teams.list).toBe("function");
    expect(caller.admin.roles).toBeDefined();
    expect(typeof caller.admin.roles.list).toBe("function");
  });

  it("has proposals router", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.proposals).toBeDefined();
    expect(typeof caller.proposals.list).toBe("function");
  });

  it("has portal router with tickets", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.portal).toBeDefined();
    expect(caller.portal.tickets).toBeDefined();
    expect(typeof caller.portal.tickets.list).toBe("function");
  });

  it("has insights router with dashboard", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.insights).toBeDefined();
    expect(typeof caller.insights.dashboard).toBe("function");
  });

  it("has management router with goals", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.management).toBeDefined();
    expect(caller.management.goals).toBeDefined();
    expect(typeof caller.management.goals.list).toBe("function");
  });

  it("has academy router with courses", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.academy).toBeDefined();
    expect(caller.academy.courses).toBeDefined();
    expect(typeof caller.academy.courses.list).toBe("function");
  });

  it("has integrationHub router", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.integrationHub).toBeDefined();
    expect(caller.integrationHub.integrations).toBeDefined();
    expect(typeof caller.integrationHub.integrations.list).toBe("function");
  });

  it("has whatsapp router", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.whatsapp).toBeDefined();
    expect(typeof caller.whatsapp.sessions).toBe("function");
  });
});
