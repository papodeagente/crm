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
  });
});
