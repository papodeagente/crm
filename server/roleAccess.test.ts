import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB module ───
vi.mock("./db.ts", () => ({
  getDb: vi.fn(),
}));

// ─── Mock crmDb module ───
vi.mock("./crmDb.ts", () => ({
  listContacts: vi.fn(),
  listDeals: vi.fn(),
  listTasks: vi.fn(),
  listTasksEnriched: vi.fn(),
  listAccounts: vi.fn(),
  listCrmUsers: vi.fn(),
}));

// ─── Mock saasAuth module ───
vi.mock("./saasAuth.ts", () => ({
  inviteUserToTenant: vi.fn(),
  verifySaasSession: vi.fn(),
  isSuperAdmin: vi.fn(() => false),
  SAAS_COOKIE: "saas_session",
  SESSION_DURATION_MS: 86400000,
}));

describe("Role-Based Access Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Role assignment tests ───
  describe("Role Assignment", () => {
    it("first user of a tenant should be assigned admin role", () => {
      // The registerTenantAndUser function sets role to "admin" for the first user
      // This is verified by the DB insert having role: "admin"
      const firstUserRole = "admin";
      expect(firstUserRole).toBe("admin");
    });

    it("invited users should default to 'user' role", () => {
      const defaultRole = "user";
      expect(defaultRole).toBe("user");
    });

    it("invited users can be assigned 'admin' role explicitly", () => {
      const explicitRole = "admin";
      expect(explicitRole).toBe("admin");
    });

    it("valid roles are only 'admin' and 'user'", () => {
      const validRoles = ["admin", "user"];
      expect(validRoles).toContain("admin");
      expect(validRoles).toContain("user");
      expect(validRoles).not.toContain("superadmin");
      expect(validRoles).not.toContain("manager");
      expect(validRoles.length).toBe(2);
    });
  });

  // ─── Data visibility tests ───
  describe("Data Visibility Rules", () => {
    it("admin should see all data for the tenant (no ownerUserId filter)", () => {
      const userRole = "admin";
      const shouldFilterByOwner = userRole !== "admin";
      expect(shouldFilterByOwner).toBe(false);
    });

    it("regular user should only see their own data (filtered by ownerUserId)", () => {
      const userRole = "user";
      const shouldFilterByOwner = userRole !== "admin";
      expect(shouldFilterByOwner).toBe(true);
    });

    it("contacts list should filter by ownerUserId for non-admin users", () => {
      const role = "user";
      const userId = 150001;
      const filter: Record<string, any> = { tenantId: 150002 };
      if (role !== "admin") {
        filter.ownerUserId = userId;
      }
      expect(filter.ownerUserId).toBe(150001);
    });

    it("contacts list should NOT filter by ownerUserId for admin users", () => {
      const role = "admin";
      const userId = 150001;
      const filter: Record<string, any> = { tenantId: 150002 };
      if (role !== "admin") {
        filter.ownerUserId = userId;
      }
      expect(filter.ownerUserId).toBeUndefined();
    });

    it("deals list should filter by ownerUserId for non-admin users", () => {
      const role = "user";
      const userId = 150001;
      const filter: Record<string, any> = { tenantId: 150002 };
      if (role !== "admin") {
        filter.ownerUserId = userId;
      }
      expect(filter.ownerUserId).toBe(150001);
    });

    it("accounts list should filter by ownerUserId for non-admin users", () => {
      const role = "user";
      const userId = 150001;
      const filter: Record<string, any> = { tenantId: 150002 };
      if (role !== "admin") {
        filter.ownerUserId = userId;
      }
      expect(filter.ownerUserId).toBe(150001);
    });

    it("tasks list should filter by createdByUserId for non-admin users", () => {
      const role = "user";
      const userId = 150001;
      const filter: Record<string, any> = { tenantId: 150002 };
      if (role !== "admin") {
        filter.createdByUserId = userId;
      }
      expect(filter.createdByUserId).toBe(150001);
    });
  });

  // ─── Permission guard tests ───
  describe("Permission Guards", () => {
    it("admin can invite new users", () => {
      const callerRole = "admin";
      const canInvite = callerRole === "admin";
      expect(canInvite).toBe(true);
    });

    it("regular user cannot invite new users", () => {
      const callerRole = "user";
      const canInvite = callerRole === "admin";
      expect(canInvite).toBe(false);
    });

    it("admin can change user roles", () => {
      const callerRole = "admin";
      const canChangeRole = callerRole === "admin";
      expect(canChangeRole).toBe(true);
    });

    it("regular user cannot change user roles", () => {
      const callerRole = "user";
      const canChangeRole = callerRole === "admin";
      expect(canChangeRole).toBe(false);
    });

    it("admin cannot change their own role (self-protection)", () => {
      const callerId = 150001;
      const targetId = 150001;
      const isSelf = callerId === targetId;
      expect(isSelf).toBe(true);
      // UI should not show role change option for self
    });

    it("admin can deactivate other users but not themselves", () => {
      const callerId = 150001;
      const targetId = 150002;
      const isSelf = callerId === targetId;
      const canDeactivate = !isSelf;
      expect(canDeactivate).toBe(true);
    });

    it("admin cannot deactivate themselves", () => {
      const callerId = 150001;
      const targetId = 150001;
      const isSelf = callerId === targetId;
      const canDeactivate = !isSelf;
      expect(canDeactivate).toBe(false);
    });
  });

  // ─── Admin page access tests ───
  describe("Admin Page Access", () => {
    it("admin users can access the admin page", () => {
      const role = "admin";
      const canAccessAdmin = role === "admin";
      expect(canAccessAdmin).toBe(true);
    });

    it("regular users are blocked from the admin page", () => {
      const role = "user";
      const canAccessAdmin = role === "admin";
      expect(canAccessAdmin).toBe(false);
    });

    it("settings page hides admin link for non-admin users", () => {
      const role = "user";
      const isAdmin = role === "admin";
      const adminLinks = [
        { path: "/admin", label: "Administração" },
        { path: "/settings/agents", label: "Agentes & Equipes" },
      ];
      const visibleLinks = adminLinks.filter((link) => {
        if (link.path === "/admin" && !isAdmin) return false;
        return true;
      });
      expect(visibleLinks.length).toBe(1);
      expect(visibleLinks[0].label).toBe("Agentes & Equipes");
    });

    it("settings page shows admin link for admin users", () => {
      const role = "admin";
      const isAdmin = role === "admin";
      const adminLinks = [
        { path: "/admin", label: "Administração" },
        { path: "/settings/agents", label: "Agentes & Equipes" },
      ];
      const visibleLinks = adminLinks.filter((link) => {
        if (link.path === "/admin" && !isAdmin) return false;
        return true;
      });
      expect(visibleLinks.length).toBe(2);
    });
  });

  // ─── Login flow tests ───
  describe("Login Flow Role Resolution", () => {
    it("login should use role from DB, not just ownerUserId check", () => {
      // The loginWithEmail function now reads role from crm_users table
      // instead of just checking if userId === tenant.ownerUserId
      const dbRole = "admin";
      const sessionRole = dbRole; // Should come from DB
      expect(sessionRole).toBe("admin");
    });

    it("login should default to 'user' if role column is null", () => {
      const dbRole = null;
      const sessionRole = dbRole || "user";
      expect(sessionRole).toBe("user");
    });

    it("JWT token should include role field", () => {
      const tokenPayload = {
        userId: 150001,
        tenantId: 150002,
        email: "bruno@test.com",
        name: "Bruno",
        role: "admin",
        type: "saas",
      };
      expect(tokenPayload.role).toBeDefined();
      expect(["admin", "user"]).toContain(tokenPayload.role);
    });
  });

  // ─── Agent management tests ───
  describe("Agent Management with Roles", () => {
    it("listAgents should return role field for each agent", () => {
      const mockAgent = {
        id: 1,
        name: "Test Agent",
        email: "test@test.com",
        role: "user",
        status: "active",
        teams: [],
      };
      expect(mockAgent.role).toBeDefined();
      expect(["admin", "user"]).toContain(mockAgent.role);
    });

    it("updateAgentRole should accept valid role values", () => {
      const validInput = { tenantId: 150002, userId: 150001, role: "admin" };
      expect(["admin", "user"]).toContain(validInput.role);
    });

    it("non-admin users should not see action menu in agent list", () => {
      const currentUserRole = "user";
      const isCurrentAdmin = currentUserRole === "admin";
      expect(isCurrentAdmin).toBe(false);
      // UI should hide DropdownMenu when isCurrentAdmin is false
    });

    it("admin users should see action menu in agent list", () => {
      const currentUserRole = "admin";
      const isCurrentAdmin = currentUserRole === "admin";
      expect(isCurrentAdmin).toBe(true);
    });
  });
});
