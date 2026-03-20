import { describe, it, expect } from "vitest";
import { validateSessionOwnership } from "./db";

/**
 * Security tests for WhatsApp session ownership validation.
 * 
 * These tests verify that:
 * 1. validateSessionOwnership correctly blocks unauthorized access
 * 2. CRM admins can access sessions within their tenant
 * 3. Platform owner (Manus OAuth) can access all sessions
 * 4. Regular users can ONLY access their own sessions
 * 5. Cross-tenant access is always blocked
 */

// Helper: create a mock session fetcher
function mockFetcher(session: Record<string, unknown> | null) {
  return async (_sessionId: string) => session as any;
}

describe("validateSessionOwnership", () => {
  // ─── Platform owner (non-SaaS) bypasses all checks ───
  it("should allow platform owner (non-SaaS) to access any session", async () => {
    const fetcher = mockFetcher({ sessionId: "crm-210002-240001", userId: 240001, tenantId: 210002 });
    await expect(
      validateSessionOwnership("crm-210002-240001", 999, { isSaasUser: false }, fetcher)
    ).resolves.toBeUndefined();
  });

  it("should allow platform owner without opts to access any session", async () => {
    const fetcher = mockFetcher({ sessionId: "crm-210002-240001", userId: 240001, tenantId: 210002 });
    await expect(
      validateSessionOwnership("crm-210002-240001", 999, undefined, fetcher)
    ).resolves.toBeUndefined();
  });

  // ─── Regular SaaS user: own session ───
  it("should allow regular user to access their own session", async () => {
    const fetcher = mockFetcher({
      sessionId: "crm-210002-240001",
      userId: 240001,
      tenantId: 210002,
    });
    await expect(
      validateSessionOwnership("crm-210002-240001", 240001, {
        tenantId: 210002,
        role: "user",
        isSaasUser: true,
      }, fetcher)
    ).resolves.toBeUndefined();
  });

  // ─── Regular SaaS user: another user's session → BLOCKED ───
  it("should BLOCK regular user from accessing another user's session", async () => {
    const fetcher = mockFetcher({
      sessionId: "crm-210002-240001",
      userId: 240001, // Fernando's session
      tenantId: 210002,
    });
    // Bruno (userId 210001) tries to access Fernando's session
    await expect(
      validateSessionOwnership("crm-210002-240001", 210001, {
        tenantId: 210002,
        role: "user",
        isSaasUser: true,
      }, fetcher)
    ).rejects.toThrow("Você não tem permissão para acessar esta sessão do WhatsApp.");
  });

  // ─── Regular SaaS user: session from different tenant → BLOCKED ───
  it("should BLOCK user from accessing session in different tenant", async () => {
    const fetcher = mockFetcher({
      sessionId: "crm-150002-150001",
      userId: 150001,
      tenantId: 150002, // Entur tenant
    });
    // User from Boxtour (tenant 210002) tries to access Entur session
    await expect(
      validateSessionOwnership("crm-150002-150001", 210001, {
        tenantId: 210002,
        role: "user",
        isSaasUser: true,
      }, fetcher)
    ).rejects.toThrow("Você não tem permissão");
  });

  // ─── CRM admin: can access any session in their tenant ───
  it("should allow CRM admin to access any session in their tenant", async () => {
    const fetcher = mockFetcher({
      sessionId: "crm-210002-240001",
      userId: 240001, // Fernando's session
      tenantId: 210002,
    });
    // Bruno as admin (userId 210001) accesses Fernando's session in same tenant
    await expect(
      validateSessionOwnership("crm-210002-240001", 210001, {
        tenantId: 210002,
        role: "admin",
        isSaasUser: true,
      }, fetcher)
    ).resolves.toBeUndefined();
  });

  // ─── CRM admin: cannot access session in different tenant ───
  it("should BLOCK CRM admin from accessing session in different tenant", async () => {
    const fetcher = mockFetcher({
      sessionId: "crm-150002-150001",
      userId: 150001,
      tenantId: 150002, // Entur tenant
    });
    // Admin from Boxtour (tenant 210002) tries to access Entur session
    await expect(
      validateSessionOwnership("crm-150002-150001", 210001, {
        tenantId: 210002,
        role: "admin",
        isSaasUser: true,
      }, fetcher)
    ).rejects.toThrow("Você não tem permissão");
  });

  // ─── Edge cases ───
  it("should skip validation for empty sessionId", async () => {
    const fetcher = mockFetcher({ sessionId: "x", userId: 1, tenantId: 1 });
    await expect(
      validateSessionOwnership("", 240001, { isSaasUser: true, tenantId: 210002, role: "user" }, fetcher)
    ).resolves.toBeUndefined();
  });

  it("should skip validation when session not found in database", async () => {
    const fetcher = mockFetcher(null);
    await expect(
      validateSessionOwnership("nonexistent-session", 240001, {
        isSaasUser: true,
        tenantId: 210002,
        role: "user",
      }, fetcher)
    ).resolves.toBeUndefined();
  });

  // ─── Realistic scenario: Bruno vs Fernando at Boxtour ───
  it("should prevent Bruno from sending messages via Fernando's WhatsApp", async () => {
    const fetcher = mockFetcher({
      sessionId: "crm-210002-240001",
      userId: 240001, // Fernando
      tenantId: 210002,
      phoneNumber: "554892118034",
    });
    // Bruno (userId 210001, role user) tries to use Fernando's session
    await expect(
      validateSessionOwnership("crm-210002-240001", 210001, {
        tenantId: 210002,
        role: "user",
        isSaasUser: true,
      }, fetcher)
    ).rejects.toThrow("Você não tem permissão");
  });

  it("should allow user to access own session even if userId matches across tenants", async () => {
    const fetcher = mockFetcher({
      sessionId: "crm-150002-240001",
      userId: 240001,
      tenantId: 150002, // Different tenant
    });
    // Same userId but different tenant — cross-tenant check should BLOCK
    await expect(
      validateSessionOwnership("crm-150002-240001", 240001, {
        tenantId: 210002, // User's actual tenant is different
        role: "user",
        isSaasUser: true,
      }, fetcher)
    ).rejects.toThrow("Você não tem permissão");
  });
});

describe("sessionTenantProcedure middleware coverage", () => {
  it("should have sessionTenantProcedure exported from trpc.ts", async () => {
    const trpc = await import("./_core/trpc");
    expect(trpc.sessionTenantProcedure).toBeDefined();
    expect(typeof trpc.sessionTenantProcedure).toBe("object");
  });

  it("should have validateSessionOwnership exported from db.ts", async () => {
    const db = await import("./db");
    expect(db.validateSessionOwnership).toBeDefined();
    expect(typeof db.validateSessionOwnership).toBe("function");
  });
});

describe("Security audit: all sessionId endpoints use sessionTenantProcedure", () => {
  it("should have no tenantProcedure endpoints with sessionId input in whatsapp router", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
    
    const lines = routersContent.split("\n");
    let inWhatsappRouter = false;
    let depth = 0;
    const violations: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("whatsapp: router({")) {
        inWhatsappRouter = true;
        depth = 1;
        continue;
      }
      if (!inWhatsappRouter) continue;
      
      depth += (line.match(/{/g) || []).length;
      depth -= (line.match(/}/g) || []).length;
      if (depth <= 0) break;
      
      if (line.includes("tenantProcedure") && !line.includes("sessionTenantProcedure")) {
        for (let j = 1; j <= 3; j++) {
          if (i + j < lines.length && lines[i + j].includes("sessionId: z.string()")) {
            const name = line.trim().split(":")[0].trim();
            violations.push(`Line ${i + 1}: ${name} uses tenantProcedure but accepts sessionId`);
            break;
          }
        }
        if (line.includes("sessionId: z.string()")) {
          const name = line.trim().split(":")[0].trim();
          violations.push(`Line ${i + 1}: ${name} uses tenantProcedure but accepts sessionId`);
        }
      }
    }
    
    expect(violations).toEqual([]);
  });

  it("should have no tenantProcedure endpoints with sessionId input in monitoring router", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
    
    const lines = routersContent.split("\n");
    let inMonitoringRouter = false;
    let depth = 0;
    const violations: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("monitoring: router({")) {
        inMonitoringRouter = true;
        depth = 1;
        continue;
      }
      if (!inMonitoringRouter) continue;
      
      depth += (line.match(/{/g) || []).length;
      depth -= (line.match(/}/g) || []).length;
      if (depth <= 0) break;
      
      if (line.includes("tenantProcedure") && !line.includes("sessionTenantProcedure")) {
        for (let j = 1; j <= 3; j++) {
          if (i + j < lines.length && lines[i + j].includes("sessionId: z.string()")) {
            const name = line.trim().split(":")[0].trim();
            violations.push(`Line ${i + 1}: ${name}`);
            break;
          }
        }
      }
    }
    
    expect(violations).toEqual([]);
  });

  it("should have no tenantProcedure with sessionId in rfvRouter", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/rfvRouter.ts", "utf-8");
    
    const lines = content.split("\n");
    const violations: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("tenantProcedure") && !line.includes("sessionTenantProcedure")) {
        for (let j = 1; j <= 3; j++) {
          if (i + j < lines.length && lines[i + j].includes("sessionId:")) {
            const name = line.trim().split(":")[0].trim();
            violations.push(`Line ${i + 1}: ${name}`);
            break;
          }
        }
      }
    }
    
    expect(violations).toEqual([]);
  });
});
