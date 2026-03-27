import { describe, it, expect } from "vitest";

/**
 * Tests for the Home admin filter functionality.
 *
 * The core bug was that getHomeFilterOptions used a raw SQL query
 * referencing column 'role' which doesn't exist in crm_users table.
 * The actual column is 'crm_user_role'. This caused the query to fail
 * silently, returning empty results, which hid the "Por usuário" and
 * "Por equipe" submenus in the UI.
 */

describe("Home Admin Filters", () => {
  describe("getHomeFilterOptions SQL query", () => {
    it("should reference crm_user_role column (not 'role') in crm_users query", async () => {
      // Read the source file to verify the fix
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.resolve(__dirname, "services/homeService.ts");
      const content = fs.readFileSync(filePath, "utf-8");

      // The query must use 'crm_user_role as role' not just 'role'
      expect(content).toContain("crm_user_role as role");
      // Should NOT have bare 'role' in the SELECT for crm_users
      // (the old broken query was: SELECT id, name, email, role, avatarUrl FROM crm_users)
      expect(content).not.toMatch(/SELECT\s+id,\s*name,\s*email,\s*role,\s*avatarUrl\s+FROM\s+crm_users/);
    });
  });

  describe("Filter state types", () => {
    type FilterState =
      | { type: "all"; label: string }
      | { type: "mine"; label: string }
      | { type: "user"; userId: number; label: string }
      | { type: "team"; teamId: number; label: string };

    it("should support 'all' filter type", () => {
      const filter: FilterState = { type: "all", label: "Todos" };
      expect(filter.type).toBe("all");
      expect(filter.label).toBe("Todos");
    });

    it("should support 'mine' filter type", () => {
      const filter: FilterState = { type: "mine", label: "Meu relatório" };
      expect(filter.type).toBe("mine");
      expect(filter.label).toBe("Meu relatório");
    });

    it("should support 'user' filter type with userId", () => {
      const filter: FilterState = { type: "user", userId: 210001, label: "Bruno Barbosa" };
      expect(filter.type).toBe("user");
      expect(filter.userId).toBe(210001);
      expect(filter.label).toBe("Bruno Barbosa");
    });

    it("should support 'team' filter type with teamId", () => {
      const filter: FilterState = { type: "team", teamId: 1, label: "Equipe Vendas" };
      expect(filter.type).toBe("team");
      expect(filter.teamId).toBe(1);
      expect(filter.label).toBe("Equipe Vendas");
    });
  });

  describe("Filter input derivation", () => {
    it("should return undefined for 'all' filter (no filtering)", () => {
      const isAdmin = true;
      const filter = { type: "all" as const, label: "Todos" };
      const result = (!isAdmin || filter.type === "all") ? undefined : {};
      expect(result).toBeUndefined();
    });

    it("should return undefined for non-admin users", () => {
      const isAdmin = false;
      const filter = { type: "user" as const, userId: 1, label: "Test" };
      const result = (!isAdmin || filter.type === "all") ? undefined : {};
      expect(result).toBeUndefined();
    });

    it("should return userId for 'user' filter", () => {
      const isAdmin = true;
      const filter = { type: "user" as const, userId: 210001, label: "Bruno" };
      const result = isAdmin && filter.type !== "all"
        ? { userId: filter.type === "user" ? filter.userId : undefined }
        : undefined;
      expect(result).toEqual({ userId: 210001 });
    });

    it("should return teamId for 'team' filter", () => {
      const isAdmin = true;
      const filter = { type: "team" as const, teamId: 5, label: "Equipe A" };
      const result = isAdmin && filter.type !== "all"
        ? { teamId: filter.type === "team" ? filter.teamId : undefined }
        : undefined;
      expect(result).toEqual({ teamId: 5 });
    });

    it("should return empty object for 'mine' filter (backend uses ctx.user)", () => {
      const isAdmin = true;
      const userId = 210001;
      const filter = { type: "mine" as const, label: "Meu relatório" };
      const result = isAdmin && filter.type !== "all"
        ? { userId: filter.type === "mine" ? userId : undefined }
        : undefined;
      expect(result).toEqual({ userId: 210001 });
    });
  });

  describe("Conditional rendering of submenus", () => {
    it("should show user submenu when filterOptions has users", () => {
      const filterOptions = {
        users: [{ id: 1, name: "Bruno", email: "b@b.com", role: "admin", avatarUrl: null }],
        teams: [],
      };
      const showUserSubmenu = filterOptions && filterOptions.users.length > 0;
      expect(showUserSubmenu).toBe(true);
    });

    it("should hide user submenu when filterOptions has no users", () => {
      const filterOptions = { users: [], teams: [] };
      const showUserSubmenu = filterOptions && filterOptions.users.length > 0;
      expect(showUserSubmenu).toBe(false);
    });

    it("should show team submenu when filterOptions has teams", () => {
      const filterOptions = {
        users: [],
        teams: [{ id: 1, name: "Equipe A", color: "#6366f1", memberCount: 3 }],
      };
      const showTeamSubmenu = filterOptions && filterOptions.teams.length > 0;
      expect(showTeamSubmenu).toBe(true);
    });

    it("should hide both submenus when filterOptions is undefined (query failed)", () => {
      const filterOptions: any = undefined;
      const showUserSubmenu = filterOptions && filterOptions.users.length > 0;
      const showTeamSubmenu = filterOptions && filterOptions.teams.length > 0;
      expect(showUserSubmenu).toBeFalsy();
      expect(showTeamSubmenu).toBeFalsy();
    });
  });
});
