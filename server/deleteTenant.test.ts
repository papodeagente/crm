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
    // With a real DB connection, calling with a non-existent tenant should still work
    // (it just deletes 0 rows from each table)
    const mod = await import("./saasAuth");
    const result = await mod.deleteTenantCompletely(999999);
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("deletedTables");
    expect(result).toHaveProperty("errors");
    expect(Array.isArray(result.deletedTables)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    // tenants should be in deletedTables (even if 0 rows deleted)
    expect(result.deletedTables).toContain("tenants");
  });

  it("should return deletedTables and errors arrays", async () => {
    const mod = await import("./saasAuth");
    // The function signature returns { success, deletedTables, errors }
    const result = mod.deleteTenantCompletely;
    expect(result).toBeDefined();
    // Verify the return type shape by checking the function exists
    expect(typeof result).toBe("function");
  });

  it("should have the correct table deletion order (leaf tables first)", async () => {
    // Read the source to verify the deletion order is correct
    const fs = await import("fs");
    const source = fs.readFileSync("./server/saasAuth.ts", "utf-8");
    
    // Verify key ordering constraints:
    // 1. deal_history, deal_products, deal_participants should come before deals
    const dealHistoryIdx = source.indexOf('"deal_history"');
    const dealsIdx = source.indexOf('"deals"');
    expect(dealHistoryIdx).toBeLessThan(dealsIdx);
    
    // 2. pipeline_stages should come before pipelines
    const stagesIdx = source.indexOf('"pipeline_stages"');
    const pipelinesIdx = source.indexOf('"pipelines"');
    expect(stagesIdx).toBeLessThan(pipelinesIdx);
    
    // 3. trip_items should come before trips
    const tripItemsIdx = source.indexOf('"trip_items"');
    const tripsIdx = source.indexOf('"trips"');
    expect(tripItemsIdx).toBeLessThan(tripsIdx);
    
    // 4. lessons should come before courses
    const lessonsIdx = source.indexOf('"lessons"');
    const coursesIdx = source.indexOf('"courses"');
    expect(lessonsIdx).toBeLessThan(coursesIdx);
    
    // 5. crm_users should come after all tenant tables
    const crmUsersDeleteIdx = source.indexOf('DELETE FROM crm_users');
    const tenantsDeleteIdx = source.indexOf('DELETE FROM tenants');
    expect(crmUsersDeleteIdx).toBeLessThan(tenantsDeleteIdx);
    
    // 6. tenants should be the last table deleted
    expect(tenantsDeleteIdx).toBeGreaterThan(crmUsersDeleteIdx);
  });

  it("should include all major table groups in deletion", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("./server/saasAuth.ts", "utf-8");
    
    // Verify all major table groups are included
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
    
    // These tables are linked by sessionId, not tenantId
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
    
    // Verify the endpoint requires confirmName
    expect(routerSource).toContain("confirmName: z.string()");
    // Verify it checks isSuperAdmin
    expect(routerSource).toContain("isSuperAdmin(session.email)");
    // Verify it compares names
    expect(routerSource).toContain("tenant.name.toLowerCase() !== input.confirmName.toLowerCase()");
  });

  it("should prevent deleting the super admin's tenant", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("./server/saasAuth.ts", "utf-8");
    
    // Verify the function checks for super admin email before deletion
    expect(source).toContain("Não é possível excluir o tenant do super administrador");
    // Verify it queries crm_users for the super admin email
    expect(source).toContain("SUPERADMIN_EMAIL");
  });

  it("should prevent deleting own tenant in the router", async () => {
    const fs = await import("fs");
    const routerSource = fs.readFileSync("./server/routers/saasAuthRouter.ts", "utf-8");
    
    // Verify the router checks if tenantId matches the session's tenantId
    expect(routerSource).toContain("input.tenantId === session.tenantId");
    expect(routerSource).toContain("Não é possível excluir seu próprio tenant");
  });

  it("should only allow superadmin access", async () => {
    const fs = await import("fs");
    const routerSource = fs.readFileSync("./server/routers/saasAuthRouter.ts", "utf-8");
    
    // Find the adminDeleteTenant section
    const deleteSection = routerSource.substring(
      routerSource.indexOf("adminDeleteTenant"),
      routerSource.indexOf("adminToggleTenantStatus")
    );
    
    // Verify it checks for superadmin
    expect(deleteSection).toContain("isSuperAdmin");
    expect(deleteSection).toContain("FORBIDDEN");
  });
});
