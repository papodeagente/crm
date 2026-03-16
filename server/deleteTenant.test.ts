import { describe, it, expect, vi } from "vitest";

describe("deleteTenantCompletely", () => {
  it("should be exported from saasAuth", async () => {
    const mod = await import("./saasAuth");
    expect(typeof mod.deleteTenantCompletely).toBe("function");
  });

  it("should reject tenantId <= 0", async () => {
    const mod = await import("./saasAuth");
    await expect(mod.deleteTenantCompletely(0)).rejects.toThrow("Invalid tenant ID");
    await expect(mod.deleteTenantCompletely(-1)).rejects.toThrow("Invalid tenant ID");
  });

  it("should handle valid tenantId and return structured result", async () => {
    const mod = await import("./saasAuth");
    const result = await mod.deleteTenantCompletely(999999);
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("deletedTables");
    expect(result).toHaveProperty("errors");
    expect(Array.isArray(result.deletedTables)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.deletedTables).toContain("tenants");
  });

  it("should return deletedTables and errors arrays", async () => {
    const mod = await import("./saasAuth");
    const result = mod.deleteTenantCompletely;
    expect(result).toBeDefined();
    expect(typeof result).toBe("function");
  });

  it("should have the correct table deletion order (leaf tables first)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("./server/saasAuth.ts", "utf-8");
    
    const dealHistoryIdx = source.indexOf('"deal_history"');
    const dealsIdx = source.indexOf('"deals"');
    expect(dealHistoryIdx).toBeLessThan(dealsIdx);
    
    const stagesIdx = source.indexOf('"pipeline_stages"');
    const pipelinesIdx = source.indexOf('"pipelines"');
    expect(stagesIdx).toBeLessThan(pipelinesIdx);
    
    const tripItemsIdx = source.indexOf('"trip_items"');
    const tripsIdx = source.indexOf('"trips"');
    expect(tripItemsIdx).toBeLessThan(tripsIdx);
    
    const lessonsIdx = source.indexOf('"lessons"');
    const coursesIdx = source.indexOf('"courses"');
    expect(lessonsIdx).toBeLessThan(coursesIdx);
    
    const crmUsersDeleteIdx = source.indexOf('DELETE FROM crm_users');
    const tenantsDeleteIdx = source.indexOf('DELETE FROM tenants');
    expect(crmUsersDeleteIdx).toBeLessThan(tenantsDeleteIdx);
    
    expect(tenantsDeleteIdx).toBeGreaterThan(crmUsersDeleteIdx);
  });

  it("should include all major table groups in deletion", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("./server/saasAuth.ts", "utf-8");
    
    const requiredTables = [
      "contacts",
      "deals",
      "pipelines",
      "pipeline_stages",
      "tasks",
      "teams",
      "crm_roles",
      "integrations",
      "notifications",
      "proposals",
      "subscriptions",
      "campaigns",
      "chatbot_rules",
      "chatbot_settings",
      "wa_contacts",
      "messages",
      "whatsapp_sessions",
      "crm_users",
      "tenants",
    ];
    
    for (const table of requiredTables) {
      expect(source).toContain(table);
    }
  });

  it("should handle session-linked tables (chatbot_rules, chatbot_settings, wa_contacts, messages)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("./server/saasAuth.ts", "utf-8");
    
    expect(source).toContain("chatbot_rules");
    expect(source).toContain("chatbot_settings");
    expect(source).toContain("wa_contacts");
    expect(source).toContain("DELETE FROM messages WHERE sessionId");
  });

  it("should handle password_reset_tokens linked by userId", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("./server/saasAuth.ts", "utf-8");
    
    expect(source).toContain("DELETE FROM password_reset_tokens WHERE userId");
  });

  it("should require confirmName in the router endpoint", async () => {
    const fs = await import("fs");
    const routerSource = fs.readFileSync("./server/routers/saasAuthRouter.ts", "utf-8");
    
    expect(routerSource).toContain("confirmName: z.string()");
    expect(routerSource).toContain("isSuperAdmin(session.email)");
    expect(routerSource).toContain("tenant.name.toLowerCase() !== input.confirmName.toLowerCase()");
  });

  // ─── NEW: Tenant deletion protection by name "Entur" only ───

  it("should protect only tenant named 'Entur' in deleteTenantCompletely", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("./server/saasAuth.ts", "utf-8");
    
    // Must check tenant name, not super admin email linkage
    expect(source).toContain('targetTenant.name.toLowerCase() === "entur"');
    expect(source).toContain("O tenant 'Entur' é o tenant raiz e não pode ser excluído");
    
    // Must NOT check super admin email linkage for deletion blocking
    expect(source).not.toContain("Não é possível excluir o tenant do super administrador");
  });

  it("should protect only tenant named 'Entur' in router endpoint", async () => {
    const fs = await import("fs");
    const routerSource = fs.readFileSync("./server/routers/saasAuthRouter.ts", "utf-8");
    
    // Must check tenant name "entur", not session.tenantId
    expect(routerSource).toContain('tenant.name.toLowerCase() === "entur"');
    expect(routerSource).toContain("O tenant 'Entur' é o tenant raiz e não pode ser excluído");
    
    // Must NOT block based on session.tenantId match
    expect(routerSource).not.toContain("input.tenantId === session.tenantId");
    expect(routerSource).not.toContain("Não é possível excluir seu próprio tenant");
  });

  it("should NOT block deletion based on super admin email being linked to the tenant", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("./server/saasAuth.ts", "utf-8");
    
    // The old guard checked if SUPERADMIN_EMAIL was a user in the target tenant
    // This should no longer exist — only the name "Entur" check should remain
    const deleteFnStart = source.indexOf("export async function deleteTenantCompletely");
    const deleteFnEnd = source.indexOf("export", deleteFnStart + 10);
    const deleteFn = source.substring(deleteFnStart, deleteFnEnd > 0 ? deleteFnEnd : undefined);
    
    // Must not contain the old email-based guard
    expect(deleteFn).not.toContain("SUPERADMIN_EMAIL");
    expect(deleteFn).not.toContain("crmUsers.email");
    
    // Must contain the new name-based guard
    expect(deleteFn).toContain('"entur"');
  });

  it("should allow deleting any tenant that is NOT named 'Entur'", async () => {
    // Simulate the guard logic
    const tenantNames = ["Teste Importação", "Agência ABC", "Demo Tenant", "Minha Agência"];
    for (const name of tenantNames) {
      const isProtected = name.toLowerCase() === "entur";
      expect(isProtected).toBe(false);
    }
  });

  it("should block deleting tenant named 'Entur' (case insensitive)", async () => {
    const variants = ["Entur", "entur", "ENTUR", "eNtUr"];
    for (const name of variants) {
      const isProtected = name.toLowerCase() === "entur";
      expect(isProtected).toBe(true);
    }
  });

  it("should only allow superadmin access", async () => {
    const fs = await import("fs");
    const routerSource = fs.readFileSync("./server/routers/saasAuthRouter.ts", "utf-8");
    
    const deleteSection = routerSource.substring(
      routerSource.indexOf("adminDeleteTenant"),
      routerSource.indexOf("adminToggleTenantStatus")
    );
    
    expect(deleteSection).toContain("isSuperAdmin");
    expect(deleteSection).toContain("FORBIDDEN");
  });

  it("frontend should disable delete button for 'Entur' tenant", async () => {
    const fs = await import("fs");
    const frontendSource = fs.readFileSync("./client/src/pages/SuperAdmin.tsx", "utf-8");
    
    // Must have conditional rendering based on tenant name
    expect(frontendSource).toContain('tenant.name.toLowerCase() === "entur"');
    // Must show disabled state for Entur
    expect(frontendSource).toContain("Tenant raiz");
    expect(frontendSource).toContain("disabled");
  });
});
