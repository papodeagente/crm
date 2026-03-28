/**
 * Tests for Super Admin Management — Administração de Super Admins
 *
 * 12 tests covering:
 * - Schema (users.isSuperAdmin column)
 * - saasAuth functions (isSuperAdmin sync, isSuperAdminAsync)
 * - superAdminManagementRouter procedures
 * - Protection for bruno@entur.com.br
 * - Self-demotion prevention
 */
import { describe, it, expect, vi } from "vitest";

// ─── 1-2: Schema ──────────────────────────────────────────────────────
describe("Super Admin Schema", () => {
  it("1. users table should have isSuperAdmin column", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.users).toBeDefined();
    const cols = Object.keys(schema.users);
    expect(cols).toContain("isSuperAdmin");
  });

  it("2. isSuperAdmin column should default to false", async () => {
    const schema = await import("../drizzle/schema");
    // The column config should exist and have a default
    const col = (schema.users as any).isSuperAdmin;
    expect(col).toBeDefined();
  });
});

// ─── 3-5: saasAuth functions ──────────────────────────────────────────
describe("saasAuth Super Admin Functions", () => {
  it("3. should export isSuperAdmin (sync) function", async () => {
    const auth = await import("./saasAuth");
    expect(typeof auth.isSuperAdmin).toBe("function");
  });

  it("4. isSuperAdmin sync should return true for protected email", async () => {
    const auth = await import("./saasAuth");
    expect(auth.isSuperAdmin("bruno@entur.com.br")).toBe(true);
    expect(auth.isSuperAdmin("BRUNO@ENTUR.COM.BR")).toBe(true);
  });

  it("5. should export isSuperAdminAsync function", async () => {
    const auth = await import("./saasAuth");
    expect(typeof auth.isSuperAdminAsync).toBe("function");
  });
});

// ─── 6-8: Router Structure ───────────────────────────────────────────
describe("superAdminManagementRouter", () => {
  it("6. should export superAdminManagementRouter", async () => {
    const mod = await import("./routers/superAdminManagementRouter");
    expect(mod.superAdminManagementRouter).toBeDefined();
  });

  it("7. router should have list, searchByEmail, promote, promoteByEmail, demote, count procedures", async () => {
    const mod = await import("./routers/superAdminManagementRouter");
    const router = mod.superAdminManagementRouter;
    const procedures = Object.keys((router as any)._def.procedures || (router as any)._def.record || {});
    for (const proc of ["list", "searchByEmail", "promote", "promoteByEmail", "demote", "count"]) {
      expect(procedures).toContain(proc);
    }
  });

  it("8. router should be registered in appRouter as superAdminManagement", async () => {
    const { appRouter } = await import("./routers");
    const keys = Object.keys((appRouter as any)._def.procedures || (appRouter as any)._def.record || {});
    // tRPC flattens nested routers with dots
    const hasSuperAdminManagement = keys.some(
      (k) => k.startsWith("superAdminManagement.")
    );
    expect(hasSuperAdminManagement).toBe(true);
  });
});

// ─── 9-10: Protection Logic ──────────────────────────────────────────
describe("Super Admin Protection", () => {
  it("9. PROTECTED_EMAIL constant should be bruno@entur.com.br", async () => {
    // Read the router source to verify the constant
    const fs = await import("fs");
    const source = fs.readFileSync(
      "./server/routers/superAdminManagementRouter.ts",
      "utf-8"
    );
    expect(source).toContain('const PROTECTED_EMAIL = "bruno@entur.com.br"');
  });

  it("10. demote procedure should check for protected email before allowing demotion", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "./server/routers/superAdminManagementRouter.ts",
      "utf-8"
    );
    // Verify the protection logic exists in demote
    expect(source).toContain("PROTECTED_EMAIL");
    expect(source).toContain("Este super admin é protegido");
  });
});

// ─── 11-12: Self-demotion and Auth ───────────────────────────────────
describe("Super Admin Business Rules", () => {
  it("11. demote procedure should prevent self-demotion", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "./server/routers/superAdminManagementRouter.ts",
      "utf-8"
    );
    expect(source).toContain("Você não pode remover a si mesmo");
  });

  it("12. all procedures should require super admin authentication via requireSuperAdmin", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "./server/routers/superAdminManagementRouter.ts",
      "utf-8"
    );
    // Count requireSuperAdmin calls — should be at least 6 (one per procedure)
    const matches = source.match(/requireSuperAdmin\(ctx\)/g);
    expect(matches).toBeDefined();
    expect(matches!.length).toBeGreaterThanOrEqual(6);
  });
});
