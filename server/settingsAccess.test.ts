import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Tests for Settings Panel access control:
 * - Supervisão, Chatbot IA, Meta, Avançado = admin-only
 * - Non-admin users must be blocked with FORBIDDEN
 * - Admin users must access normally
 */

function createCtx(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    saasUser: {
      userId: 1,
      tenantId: 1,
      role,
      email: "test@example.com",
      name: "Test User",
    },
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

describe("Settings Panel Access Control", () => {
  // ─── Supervisão (sessionTenantAdminProcedure) ───
  describe("Supervisão - admin only", () => {
    it("admin can access supervision.agentWorkload", async () => {
      const caller = appRouter.createCaller(createCtx("admin"));
      try {
        await caller.whatsapp.supervision.agentWorkload({ sessionId: "test" });
      } catch (e: any) {
        expect(e.code).not.toBe("FORBIDDEN");
      }
    });

    it("non-admin is FORBIDDEN from supervision.agentWorkload", async () => {
      const caller = appRouter.createCaller(createCtx("user"));
      await expect(caller.whatsapp.supervision.agentWorkload({ sessionId: "test" })).rejects.toThrow(
        /administradores|FORBIDDEN/i
      );
    });
  });

  // ─── Chatbot IA (sessionTenantAdminProcedure) ───
  describe("Chatbot IA - admin only", () => {
    it("admin can access getChatbotSettings", async () => {
      const caller = appRouter.createCaller(createCtx("admin"));
      try {
        await caller.whatsapp.getChatbotSettings({ sessionId: "test" });
      } catch (e: any) {
        expect(e.code).not.toBe("FORBIDDEN");
      }
    });

    it("non-admin is FORBIDDEN from getChatbotSettings", async () => {
      const caller = appRouter.createCaller(createCtx("user"));
      await expect(caller.whatsapp.getChatbotSettings({ sessionId: "test" })).rejects.toThrow(
        /administradores|FORBIDDEN/i
      );
    });
  });

  // ─── Meta (tenantAdminProcedure) ───
  describe("Meta config - admin only", () => {
    it("admin can access leadCapture.getMetaConfig", async () => {
      const caller = appRouter.createCaller(createCtx("admin"));
      try {
        await caller.leadCapture.getMetaConfig();
      } catch (e: any) {
        expect(e.code).not.toBe("FORBIDDEN");
      }
    });

    it("non-admin is FORBIDDEN from leadCapture.getMetaConfig", async () => {
      const caller = appRouter.createCaller(createCtx("user"));
      await expect(caller.leadCapture.getMetaConfig()).rejects.toThrow(
        /administradores|FORBIDDEN/i
      );
    });
  });

  // ─── Avançado: Integrações (tenantAdminProcedure) ───
  describe("Integrações - admin only", () => {
    it("admin can access integrationHub.integrations.list", async () => {
      const caller = appRouter.createCaller(createCtx("admin"));
      try {
        await caller.integrationHub.integrations.list();
      } catch (e: any) {
        expect(e.code).not.toBe("FORBIDDEN");
      }
    });

    it("non-admin is FORBIDDEN from integrationHub.integrations.list", async () => {
      const caller = appRouter.createCaller(createCtx("user"));
      await expect(caller.integrationHub.integrations.list()).rejects.toThrow(
        /administradores|FORBIDDEN/i
      );
    });
  });

  // ─── Avançado: RD Station (tenantAdminProcedure) ───
  describe("RD Station - admin only", () => {
    it("admin can access rdStation.listConfigs", async () => {
      const caller = appRouter.createCaller(createCtx("admin"));
      try {
        await caller.rdStation.listConfigs();
      } catch (e: any) {
        expect(e.code).not.toBe("FORBIDDEN");
      }
    });

    it("non-admin is FORBIDDEN from rdStation.listConfigs", async () => {
      const caller = appRouter.createCaller(createCtx("user"));
      await expect(caller.rdStation.listConfigs()).rejects.toThrow(
        /administradores|FORBIDDEN/i
      );
    });
  });

  // ─── Avançado: Field Mappings (tenantAdminProcedure) ───
  describe("Field Mappings - admin only", () => {
    it("admin can access fieldMappings.list", async () => {
      const caller = appRouter.createCaller(createCtx("admin"));
      try {
        await caller.fieldMappings.list();
      } catch (e: any) {
        expect(e.code).not.toBe("FORBIDDEN");
      }
    });

    it("non-admin is FORBIDDEN from fieldMappings.list", async () => {
      const caller = appRouter.createCaller(createCtx("user"));
      await expect(caller.fieldMappings.list()).rejects.toThrow(
        /administradores|FORBIDDEN/i
      );
    });
  });

  // ─── Avançado: RD CRM Import (tenantAdminProcedure) ───
  describe("RD CRM Import - admin only", () => {
    it("non-admin is FORBIDDEN from rdCrmImport.getProgress", async () => {
      const caller = appRouter.createCaller(createCtx("user"));
      await expect(caller.rdCrmImport.getProgress()).rejects.toThrow(
        /administradores|FORBIDDEN/i
      );
    });
  });

  // ─── Metas (tenantAdminProcedure) ───
  describe("Metas - admin only", () => {
    it("admin can access management.goals.list", async () => {
      const caller = appRouter.createCaller(createCtx("admin"));
      try {
        await caller.management.goals.list();
      } catch (e: any) {
        expect(e.code).not.toBe("FORBIDDEN");
      }
    });

    it("non-admin is FORBIDDEN from management.goals.list", async () => {
      const caller = appRouter.createCaller(createCtx("user"));
      await expect(caller.management.goals.list()).rejects.toThrow(
        /administradores|FORBIDDEN/i
      );
    });
  });

  // ─── AI Integration (tenantAdminProcedure) ───
  describe("AI Integration - admin only", () => {
    it("non-admin is FORBIDDEN from ai.list", async () => {
      const caller = appRouter.createCaller(createCtx("user"));
      await expect(caller.ai.list()).rejects.toThrow(
        /administradores|FORBIDDEN/i
      );
    });
  });

  // ─── Endpoints that should remain accessible to non-admin ───
  describe("Non-restricted endpoints still accessible", () => {
    it("non-admin can access saasAuth.me", async () => {
      const caller = appRouter.createCaller(createCtx("user"));
      // Should not throw FORBIDDEN
      try {
        await caller.saasAuth.me();
      } catch (e: any) {
        expect(e.code).not.toBe("FORBIDDEN");
      }
    });
  });
});
