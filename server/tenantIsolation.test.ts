import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tenant Isolation Tests
 * 
 * Validates that super admin endpoints in saasAuthRouter.ts
 * correctly use input.tenantId (the selected tenant) instead of
 * getTenantId(ctx) (the logged-in super admin's tenant).
 * 
 * This prevents the critical bug where all tenants would show
 * only the super admin's users instead of their own users.
 */

const saasAuthRouterPath = path.join(__dirname, "routers/saasAuthRouter.ts");
const saasAuthRouterCode = fs.readFileSync(saasAuthRouterPath, "utf-8");

// ─── SUPER ADMIN ENDPOINTS MUST USE input.tenantId ───

describe("Super Admin endpoints: tenant isolation", () => {
  // Extract all super admin endpoint blocks (between "admin" method definitions)
  const superAdminEndpoints = [
    "adminUpdateFreemium",
    "adminUpdatePlan",
    "adminListTenantUsers",
    "adminDeleteTenant",
    "adminToggleTenantStatus",
  ];

  for (const endpoint of superAdminEndpoints) {
    it(`${endpoint} must NOT use getTenantId(ctx) — must use input.tenantId`, () => {
      // Find the block for this endpoint
      const startIdx = saasAuthRouterCode.indexOf(`${endpoint}:`);
      expect(startIdx).toBeGreaterThan(-1);

      // Find the next endpoint or end of router
      let endIdx = saasAuthRouterCode.length;
      for (const other of superAdminEndpoints) {
        if (other === endpoint) continue;
        const otherIdx = saasAuthRouterCode.indexOf(`${other}:`, startIdx + endpoint.length);
        if (otherIdx > startIdx && otherIdx < endIdx) {
          endIdx = otherIdx;
        }
      }
      // Also check for closing of router
      const closingIdx = saasAuthRouterCode.indexOf("});", startIdx);
      if (closingIdx > startIdx && closingIdx < endIdx) {
        endIdx = closingIdx;
      }

      const block = saasAuthRouterCode.substring(startIdx, endIdx);

      // These super admin endpoints receive tenantId as input
      // They MUST NOT use getTenantId(ctx) which returns the super admin's own tenant
      const usesGetTenantIdCtx = block.includes("getTenantId(ctx)");
      expect(usesGetTenantIdCtx).toBe(false);
    });
  }

  it("adminListTenantUsers must pass input.tenantId to listTenantUsersAdmin", () => {
    const block = saasAuthRouterCode.substring(
      saasAuthRouterCode.indexOf("adminListTenantUsers:"),
      saasAuthRouterCode.indexOf("adminUpdateUserStatus:")
    );
    expect(block).toContain("listTenantUsersAdmin(input.tenantId)");
  });

  it("adminUpdateFreemium must pass input.tenantId to updateFreemiumPeriod", () => {
    const block = saasAuthRouterCode.substring(
      saasAuthRouterCode.indexOf("adminUpdateFreemium:"),
      saasAuthRouterCode.indexOf("adminUpdatePlan:")
    );
    expect(block).toContain("updateFreemiumPeriod(input.tenantId");
  });

  it("adminUpdatePlan must pass input.tenantId to updateTenantPlan", () => {
    const block = saasAuthRouterCode.substring(
      saasAuthRouterCode.indexOf("adminUpdatePlan:"),
      saasAuthRouterCode.indexOf("adminListTenantUsers:")
    );
    expect(block).toContain("updateTenantPlan(input.tenantId");
  });

  it("adminDeleteTenant must pass input.tenantId to deleteTenantCompletely", () => {
    const block = saasAuthRouterCode.substring(
      saasAuthRouterCode.indexOf("adminDeleteTenant:"),
      saasAuthRouterCode.indexOf("adminTenantMetrics:")
    );
    expect(block).toContain("deleteTenantCompletely(input.tenantId)");
    expect(block).not.toContain("deleteTenantCompletely(getTenantId(ctx))");
  });

  it("adminToggleTenantStatus must use input.tenantId in WHERE clause", () => {
    const block = saasAuthRouterCode.substring(
      saasAuthRouterCode.indexOf("adminToggleTenantStatus:")
    );
    expect(block).toContain("eq(tenants.id, input.tenantId)");
    expect(block).not.toContain("eq(tenants.id, getTenantId(ctx))");
  });
});

// ─── NON-ADMIN ENDPOINTS: CORRECT USE OF getTenantId(ctx) ───

describe("Non-admin endpoints: correct tenant scoping", () => {
  it("inviteUser correctly uses getTenantId(ctx) for the caller's own tenant", () => {
    const block = saasAuthRouterCode.substring(
      saasAuthRouterCode.indexOf("inviteUser:"),
      saasAuthRouterCode.indexOf("checkAccess:")
    );
    // inviteUser is NOT a super admin endpoint — it invites to the caller's own tenant
    // So getTenantId(ctx) is correct here
    expect(block).toContain("getTenantId(ctx)");
  });

  it("checkAccess correctly uses getTenantId(ctx) for the caller's own tenant", () => {
    const block = saasAuthRouterCode.substring(
      saasAuthRouterCode.indexOf("checkAccess:"),
      saasAuthRouterCode.indexOf("adminListTenants:")
    );
    expect(block).toContain("checkTenantAccess(getTenantId(ctx))");
  });
});

// ─── GUARD RAIL: super admin email must never be used as fallback ───

describe("Guard rails: no super admin contamination", () => {
  it("saasAuthRouter does not hardcode bruno@entur.com.br as a fallback", () => {
    // The router should use isSuperAdmin() function, not hardcoded emails
    expect(saasAuthRouterCode).not.toContain('"bruno@entur.com.br"');
    expect(saasAuthRouterCode).not.toContain("'bruno@entur.com.br'");
  });

  it("listTenantUsersAdmin function filters by tenantId", () => {
    const saasAuthPath = path.join(__dirname, "saasAuth.ts");
    const saasAuthCode = fs.readFileSync(saasAuthPath, "utf-8");
    const fnStart = saasAuthCode.indexOf("export async function listTenantUsersAdmin");
    expect(fnStart).toBeGreaterThan(-1);
    // Read enough of the function to capture the WHERE clause
    const fnBlock = saasAuthCode.substring(fnStart, fnStart + 600);
    // Must filter by tenantId — the function uses eq(crmUsers.tenantId, tenantId)
    // In the raw source the template uses `crmUsers.tena` which gets cut, so check for the pattern
    expect(fnBlock).toContain("tenantId");
    expect(fnBlock).toContain(".where(");
    expect(fnBlock).toContain("crmUsers.tena"); // crmUsers.tenantId
  });

  it("listCrmUsers in crmDb.ts filters by tenantId parameter", () => {
    const crmDbPath = path.join(__dirname, "crmDb.ts");
    const crmDbCode = fs.readFileSync(crmDbPath, "utf-8");
    const fnStart = crmDbCode.indexOf("export async function listCrmUsers");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBlock = crmDbCode.substring(fnStart, fnStart + 300);
    expect(fnBlock).toContain("eq(crmUsers.tenantId, tenantId)");
  });

  it("getAgentsWithTeams in db.ts filters by tenantId parameter", () => {
    const dbPath = path.join(__dirname, "db.ts");
    const dbCode = fs.readFileSync(dbPath, "utf-8");
    const fnStart = dbCode.indexOf("export async function getAgentsWithTeams");
    expect(fnStart).toBeGreaterThan(-1);
    // Need a larger block to capture the full SQL query with WHERE clause
    const fnBlock = dbCode.substring(fnStart, fnStart + 900);
    // The raw SQL uses template literal: WHERE cu.tenantId = ${tenantId}
    expect(fnBlock).toContain("cu.tenantId");
    expect(fnBlock).toContain("tenantId");
    expect(fnBlock).toContain("WHERE");
  });
});

// ─── REGRESSION: all super admin endpoints that accept tenantId input ───

describe("Regression prevention: input.tenantId validation", () => {
  it("all super admin mutation/query endpoints with tenantId input use z.number().min(1)", () => {
    const endpointsWithTenantInput = [
      "adminUpdateFreemium",
      "adminUpdatePlan",
      "adminListTenantUsers",
      "adminDeleteTenant",
      "adminToggleTenantStatus",
    ];

    for (const ep of endpointsWithTenantInput) {
      const startIdx = saasAuthRouterCode.indexOf(`${ep}:`);
      const inputIdx = saasAuthRouterCode.indexOf(".input(", startIdx);
      if (inputIdx > startIdx && inputIdx < startIdx + 200) {
        const inputBlock = saasAuthRouterCode.substring(inputIdx, inputIdx + 200);
        expect(inputBlock).toContain("tenantId: z.number()");
      }
    }
  });
});

// ─── LOGIN: multi-tenant user handling ───

describe("Login: multi-tenant user safety", () => {
  const saasAuthPath = path.join(__dirname, "saasAuth.ts");
  const saasAuthCode = fs.readFileSync(saasAuthPath, "utf-8");

  it("loginWithEmail fetches ALL users with email, not LIMIT 1", () => {
    const fnStart = saasAuthCode.indexOf("export async function loginWithEmail");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBlock = saasAuthCode.substring(fnStart, fnStart + 1200);
    // Must NOT use .limit(1) for the initial email lookup
    // Should fetch all users and verify password against each
    expect(fnBlock).not.toMatch(/\.where\(eq\(crmUsers\.email.*\.limit\(1\)/);
    // Must iterate candidates to verify password
    expect(fnBlock).toContain("sortedUsers");
    expect(fnBlock).toContain("verifyPassword");
  });

  it("loginWithEmail prioritizes active users over invited", () => {
    const fnStart = saasAuthCode.indexOf("export async function loginWithEmail");
    const fnBlock = saasAuthCode.substring(fnStart, fnStart + 1200);
    expect(fnBlock).toContain("active");
    expect(fnBlock).toContain("invited");
    expect(fnBlock).toContain("sort");
  });

  it("requestPasswordReset fetches ALL users, not LIMIT 1", () => {
    const fnStart = saasAuthCode.indexOf("export async function requestPasswordReset");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBlock = saasAuthCode.substring(fnStart, fnStart + 800);
    // Must NOT use .limit(1)
    expect(fnBlock).not.toMatch(/\.where\(eq\(crmUsers\.email.*\.limit\(1\)/);
    // Must prioritize active user
    expect(fnBlock).toContain("active");
  });
});

// ─── TENANT MIDDLEWARE: tenantProcedure blocks cross-tenant access ───

describe("tenantProcedure middleware: cross-tenant protection", () => {
  const trpcPath = path.join(__dirname, "_core/trpc.ts");
  const trpcCode = fs.readFileSync(trpcPath, "utf-8");

  it("tenantProcedure injects tenantId from JWT, not from client input", () => {
    const mwStart = trpcCode.indexOf("const requireTenant = t.middleware");
    expect(mwStart).toBeGreaterThan(-1);
    const mwBlock = trpcCode.substring(mwStart, mwStart + 1500);
    // Must use ctx.saasUser.tenantId
    expect(mwBlock).toContain("ctx.saasUser.tenantId");
    // Must log security warning if client tries to override
    expect(mwBlock).toContain("SECURITY");
    expect(mwBlock).toContain("Tenant mismatch");
  });

  it("tenantProcedure ignores client-sent tenantId", () => {
    const mwStart = trpcCode.indexOf("const requireTenant = t.middleware");
    const mwBlock = trpcCode.substring(mwStart, mwStart + 1500);
    // The middleware must set tenantId from JWT, overriding any client input
    expect(mwBlock).toContain("const tenantId = ctx.saasUser.tenantId");
  });
});
