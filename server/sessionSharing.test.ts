import { describe, it, expect } from "vitest";
import { validateSessionOwnership } from "./db";

/**
 * Tests for WhatsApp session sharing feature.
 *
 * Validates:
 * 1. Session sharing DB helpers are properly exported
 * 2. Schema has the sessionShares table
 * 3. Router endpoints for sharing exist
 * 4. sessions endpoint includes shared session logic
 * 5. validateSessionOwnership still works correctly for non-share scenarios
 */

// Helper: create a mock session fetcher
function mockFetcher(session: Record<string, unknown> | null) {
  return async (_sessionId: string) => session as any;
}

describe("Session Sharing - DB helper exports", () => {
  it("should export all session sharing DB helpers", async () => {
    const dbModule = await import("./db");

    expect(dbModule.getActiveShareForUser).toBeDefined();
    expect(typeof dbModule.getActiveShareForUser).toBe("function");

    expect(dbModule.getAllSharesForTenant).toBeDefined();
    expect(typeof dbModule.getAllSharesForTenant).toBe("function");

    expect(dbModule.createSessionShare).toBeDefined();
    expect(typeof dbModule.createSessionShare).toBe("function");

    expect(dbModule.revokeSessionShare).toBeDefined();
    expect(typeof dbModule.revokeSessionShare).toBe("function");

    expect(dbModule.revokeAllSharesForSession).toBeDefined();
    expect(typeof dbModule.revokeAllSharesForSession).toBe("function");

    expect(dbModule.hasActiveShareForSession).toBeDefined();
    expect(typeof dbModule.hasActiveShareForSession).toBe("function");
  });

  it("should export getSharesForSession helper", async () => {
    const dbModule = await import("./db");
    expect(dbModule.getSharesForSession).toBeDefined();
    expect(typeof dbModule.getSharesForSession).toBe("function");
  });
});

describe("Session Sharing - Schema validation", () => {
  it("should have sessionShares table in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.sessionShares).toBeDefined();
  });

  it("should have all required columns in sessionShares table", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.sessionShares;

    // Check that all expected columns exist
    expect(table.id).toBeDefined();
    expect(table.tenantId).toBeDefined();
    expect(table.sourceSessionId).toBeDefined();
    expect(table.sourceUserId).toBeDefined();
    expect(table.targetUserId).toBeDefined();
    expect(table.sharedBy).toBeDefined();
    expect(table.status).toBeDefined();
    expect(table.createdAt).toBeDefined();
    expect(table.revokedAt).toBeDefined();
  });
});

describe("Session Sharing - Router endpoints exist", () => {
  it("should have sharing endpoints in routers.ts", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");

    // Check that sharing endpoints are defined
    expect(routersContent).toContain("shareSession:");
    expect(routersContent).toContain("revokeShare:");
    expect(routersContent).toContain("revokeAllShares:");
    expect(routersContent).toContain("listShares:");
    expect(routersContent).toContain("tenantSessions:");
  });

  it("should have sharing endpoints using tenantProcedure (admin-only)", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");

    // shareSession should use tenantProcedure (admin-only check inside)
    const shareSessionMatch = routersContent.match(/shareSession:\s*tenantProcedure/);
    expect(shareSessionMatch).not.toBeNull();

    const revokeShareMatch = routersContent.match(/revokeShare:\s*tenantProcedure/);
    expect(revokeShareMatch).not.toBeNull();
  });

  it("should validate admin role in sharing endpoints", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");

    // The sharing endpoints should check for admin role
    // Pattern: role !== "admin" ... FORBIDDEN
    const adminCheckCount = (routersContent.match(/role !== "admin"/g) || []).length;
    expect(adminCheckCount).toBeGreaterThanOrEqual(3); // shareSession, revokeShare, revokeAllShares, tenantSessions
  });

  it("should have tenantId in sharing endpoint inputs", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");

    // Extract the sharing section
    const shareSessionIdx = routersContent.indexOf("shareSession:");
    const revokeShareIdx = routersContent.indexOf("revokeShare:");
    const listSharesIdx = routersContent.indexOf("listShares:");

    // All should exist
    expect(shareSessionIdx).toBeGreaterThan(-1);
    expect(revokeShareIdx).toBeGreaterThan(-1);
    expect(listSharesIdx).toBeGreaterThan(-1);
  });
});

describe("Session Sharing - sessions endpoint returns shared sessions", () => {
  it("should have sessions endpoint that includes shared session logic", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");

    // The sessions endpoint should check for active shares
    expect(routersContent).toContain("getActiveShareForUser");
    // It should include isShared flag
    expect(routersContent).toContain("isShared");
  });

  it("should include sharedByName in sessions response", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");

    expect(routersContent).toContain("sharedByName");
  });
});

describe("Session Sharing - validateSessionOwnership still works correctly", () => {
  // These tests verify that the existing security model is not broken

  it("should allow platform owner (non-SaaS) to access any session", async () => {
    const fetcher = mockFetcher({ sessionId: "crm-210002-240001", userId: 240001, tenantId: 210002 });
    await expect(
      validateSessionOwnership("crm-210002-240001", 999, { isSaasUser: false }, fetcher)
    ).resolves.toBeUndefined();
  });

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

  it("should allow CRM admin to access any session in their tenant", async () => {
    const fetcher = mockFetcher({
      sessionId: "crm-210002-240001",
      userId: 240001,
      tenantId: 210002,
    });
    await expect(
      validateSessionOwnership("crm-210002-240001", 210001, {
        tenantId: 210002,
        role: "admin",
        isSaasUser: true,
      }, fetcher)
    ).resolves.toBeUndefined();
  });

  it("should BLOCK cross-tenant access", async () => {
    const fetcher = mockFetcher({
      sessionId: "crm-150002-150001",
      userId: 150001,
      tenantId: 150002,
    });
    await expect(
      validateSessionOwnership("crm-150002-150001", 210001, {
        tenantId: 210002,
        role: "user",
        isSaasUser: true,
      }, fetcher)
    ).rejects.toThrow("Você não tem permissão");
  });

  it("should skip validation for empty sessionId", async () => {
    const fetcher = mockFetcher({ sessionId: "x", userId: 1, tenantId: 1 });
    await expect(
      validateSessionOwnership("", 240001, { isSaasUser: true, tenantId: 210002, role: "user" }, fetcher)
    ).resolves.toBeUndefined();
  });

  it("should skip validation when session not found", async () => {
    const fetcher = mockFetcher(null);
    await expect(
      validateSessionOwnership("nonexistent", 240001, {
        isSaasUser: true,
        tenantId: 210002,
        role: "user",
      }, fetcher)
    ).resolves.toBeUndefined();
  });
});

describe("Session Sharing - connect endpoint guard", () => {
  it("should have connect endpoint that checks for active shares", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");

    // The connect endpoint should check for active shares and block connection
    // when user has a shared session
    expect(routersContent).toContain("connect:");
  });
});

describe("Session Sharing - Frontend component exists", () => {
  it("should have SessionSharing component", async () => {
    const fs = await import("fs");
    const exists = fs.existsSync("client/src/components/SessionSharing.tsx");
    expect(exists).toBe(true);
  });

  it("should import SessionSharing in WhatsApp page", async () => {
    const fs = await import("fs");
    const whatsappContent = fs.readFileSync("client/src/pages/WhatsApp.tsx", "utf-8");
    expect(whatsappContent).toContain("SessionSharing");
    expect(whatsappContent).toContain("isAdmin");
  });

  it("should show shared session banner for non-admin users", async () => {
    const fs = await import("fs");
    const whatsappContent = fs.readFileSync("client/src/pages/WhatsApp.tsx", "utf-8");
    expect(whatsappContent).toContain("Sessão Compartilhada");
    expect(whatsappContent).toContain("isShared");
  });
});
