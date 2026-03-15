import { describe, it, expect, vi } from "vitest";

describe("Super Admin - Backend", () => {
  describe("listTenantUsersAdmin", () => {
    it("should export the function", async () => {
      const mod = await import("./saasAuth");
      expect(typeof mod.listTenantUsersAdmin).toBe("function");
    });

    it("should export updateUserStatusAdmin", async () => {
      const mod = await import("./saasAuth");
      expect(typeof mod.updateUserStatusAdmin).toBe("function");
    });

    it("should export isSuperAdmin", async () => {
      const mod = await import("./saasAuth");
      expect(typeof mod.isSuperAdmin).toBe("function");
    });

    it("isSuperAdmin should return true for admin email", async () => {
      const { isSuperAdmin } = await import("./saasAuth");
      expect(isSuperAdmin("bruno@entur.com.br")).toBe(true);
    });

    it("isSuperAdmin should return false for non-admin email", async () => {
      const { isSuperAdmin } = await import("./saasAuth");
      expect(isSuperAdmin("user@example.com")).toBe(false);
    });

    it("isSuperAdmin should be case-insensitive", async () => {
      const { isSuperAdmin } = await import("./saasAuth");
      expect(isSuperAdmin("BRUNO@ENTUR.COM.BR")).toBe(true);
    });
  });

  describe("saasAuthRouter endpoints", () => {
    it("should have adminListTenantUsers procedure", async () => {
      const mod = await import("./routers/saasAuthRouter");
      const router = mod.saasAuthRouter;
      expect(router).toBeDefined();
      // The router should have the procedure defined
      expect((router as any)._def.procedures.adminListTenantUsers).toBeDefined();
    });

    it("should have adminUpdateUserStatus procedure", async () => {
      const mod = await import("./routers/saasAuthRouter");
      const router = mod.saasAuthRouter;
      expect((router as any)._def.procedures.adminUpdateUserStatus).toBeDefined();
    });

    it("should have adminListTenants procedure", async () => {
      const mod = await import("./routers/saasAuthRouter");
      const router = mod.saasAuthRouter;
      expect((router as any)._def.procedures.adminListTenants).toBeDefined();
    });

    it("should have adminUpdateFreemium procedure", async () => {
      const mod = await import("./routers/saasAuthRouter");
      const router = mod.saasAuthRouter;
      expect((router as any)._def.procedures.adminUpdateFreemium).toBeDefined();
    });

    it("should have adminUpdatePlan procedure", async () => {
      const mod = await import("./routers/saasAuthRouter");
      const router = mod.saasAuthRouter;
      expect((router as any)._def.procedures.adminUpdatePlan).toBeDefined();
    });

    it("should have adminToggleTenantStatus procedure", async () => {
      const mod = await import("./routers/saasAuthRouter");
      const router = mod.saasAuthRouter;
      expect((router as any)._def.procedures.adminToggleTenantStatus).toBeDefined();
    });

    it("should have adminDeleteTenant procedure", async () => {
      const mod = await import("./routers/saasAuthRouter");
      const router = mod.saasAuthRouter;
      expect((router as any)._def.procedures.adminDeleteTenant).toBeDefined();
    });
  });

  describe("deleteTenantCompletely - table coverage", () => {
    it("should include all required tables for cascading delete", async () => {
      const fs = await import("fs");
      const source = fs.readFileSync("./server/saasAuth.ts", "utf-8");

      // These tables must be in the delete function
      const requiredTables = [
        "ai_conversation_analyses",
        "ai_integrations",
        "wa_audit_log",
        "wa_identities",
        "wa_conversations",
        "rfv_contacts",
        "rfv_filter_snapshots",
        "session_shares",
        "quick_replies",
        "google_calendar_tokens",
        "internal_notes",
        "conversation_events",
        "contact_action_logs",
        "bulk_campaign_messages",
        "bulk_campaigns",
        "messages",
        "deals",
        "contacts",
        "crm_users",
        "tenants",
      ];

      for (const table of requiredTables) {
        expect(source, `Table "${table}" should be in deleteTenantCompletely`).toContain(`"${table}"`);
      }
    });

    it("should prevent deleting tenant with ID <= 0", async () => {
      const { deleteTenantCompletely } = await import("./saasAuth");
      await expect(deleteTenantCompletely(0)).rejects.toThrow("Invalid tenant ID");
      await expect(deleteTenantCompletely(-1)).rejects.toThrow("Invalid tenant ID");
    });
  });
});
