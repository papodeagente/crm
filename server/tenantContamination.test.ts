import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Tenant Contamination Guard Tests
 * Ensures super admin endpoints use input.tenantId (not getTenantId(ctx))
 * and login/reset handle multi-tenant users correctly.
 */

const saasAuthRouterSrc = readFileSync(
  resolve(__dirname, "routers/saasAuthRouter.ts"),
  "utf-8"
);
const saasAuthSrc = readFileSync(
  resolve(__dirname, "saasAuth.ts"),
  "utf-8"
);
const whatsAppChatSrc = readFileSync(
  resolve(__dirname, "../client/src/components/WhatsAppChat.tsx"),
  "utf-8"
);

describe("Super Admin Endpoints — Tenant Isolation", () => {
  // Extract all super admin endpoint bodies
  const adminEndpoints = [
    "adminUpdateFreemium",
    "adminUpdatePlan",
    "adminListTenantUsers",
    "adminDeleteTenant",
    "adminToggleTenantStatus",
  ];

  for (const name of adminEndpoints) {
    it(`${name} must NOT use getTenantId(ctx) — must use input.tenantId`, () => {
      // Find the endpoint block
      const startIdx = saasAuthRouterSrc.indexOf(`${name}:`);
      expect(startIdx).toBeGreaterThan(-1);
      // Get a reasonable chunk of the endpoint body (800 chars)
      const block = saasAuthRouterSrc.slice(startIdx, startIdx + 1200);
      expect(block).not.toContain("getTenantId(ctx)");
      // Ensure input.tenantId is used (except adminUpdateUserStatus which uses input.userId)
      if (name !== "adminUpdateUserStatus") {
        expect(block).toContain("input.tenantId");
      }
    });
  }

  it("adminUpdateUserStatus must NOT use getTenantId(ctx)", () => {
    const startIdx = saasAuthRouterSrc.indexOf("adminUpdateUserStatus:");
    expect(startIdx).toBeGreaterThan(-1);
    const block = saasAuthRouterSrc.slice(startIdx, startIdx + 800);
    expect(block).not.toContain("getTenantId(ctx)");
  });
});

describe("Login — Multi-Tenant Safety", () => {
  it("loginWithEmail must fetch ALL users (no LIMIT 1)", () => {
    const fnStart = saasAuthSrc.indexOf("async function loginWithEmail");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBlock = saasAuthSrc.slice(fnStart, fnStart + 1500);
    // Must NOT have LIMIT 1 on the initial email query for crmUsers
    // The fix fetches ALL users then filters in code
    expect(fnBlock).toContain("allUsers");
    // The crmUsers query must NOT have .limit(1) — the tenants query later is OK
    const emailQueryLine = fnBlock.split('\n').find(l => l.includes('from(crmUsers)') && l.includes('email'));
    expect(emailQueryLine).toBeDefined();
    expect(emailQueryLine).not.toContain('.limit(1)');
    // Must prioritize active users
    expect(fnBlock).toContain("active");
  });

  it("requestPasswordReset must fetch ALL users (no LIMIT 1)", () => {
    const fnStart = saasAuthSrc.indexOf("async function requestPasswordReset");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBlock = saasAuthSrc.slice(fnStart, fnStart + 800);
    expect(fnBlock).not.toMatch(/where\(eq\(crmUsers\.email.*\.limit\(1\)/s);
    expect(fnBlock).toContain("active");
  });
});

describe("WhatsAppChat — Template Visibility & Reactions", () => {
  it("message filter must include RICH_TYPES for templateMessage", () => {
    expect(whatsAppChatSrc).toContain("RICH_TYPES");
    expect(whatsAppChatSrc).toContain('"templateMessage"');
    expect(whatsAppChatSrc).toContain("RICH_TYPES.has(m.messageType)");
  });

  it("handleReact must have optimistic update via utils.wa.messages.setData", () => {
    // Search for the specific handleReact (not handleReaction)
    const reactStart = whatsAppChatSrc.indexOf("const handleReact = useCallback");
    expect(reactStart).toBeGreaterThan(-1);
    const reactBlock = whatsAppChatSrc.slice(reactStart, reactStart + 1200);
    expect(reactBlock).toContain("utils.wa.messages.setData");
    expect(reactBlock).toContain("reactions");
  });
});
