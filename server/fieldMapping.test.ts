import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTenantContext(tenantId: number): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    saasUser: { userId: 1, tenantId, role: "admin" as const, email: "test@example.com", name: "Test User" },
    req: { headers: {}, cookies: {} } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    saasUser: null,
    req: { headers: {}, cookies: {} } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  };
}

describe("fieldMappings CRUD", () => {
  const caller1 = appRouter.createCaller(createTenantContext(1));
  const caller2 = appRouter.createCaller(createTenantContext(2));
  const unauthCaller = appRouter.createCaller(createUnauthContext());

  it("should list mappings (returns array)", async () => {
    const result = await caller1.fieldMappings.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should create a mapping with targetEntity=deal", async () => {
    const result = await caller1.fieldMappings.create({
      rdFieldKey: "cf_test_deal",
      rdFieldLabel: "Test Deal Field",
      targetEntity: "deal",
      enturFieldType: "standard",
      enturFieldKey: "deal.utmSource",
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("should create a mapping with targetEntity=contact", async () => {
    const result = await caller1.fieldMappings.create({
      rdFieldKey: "cf_test_contact",
      rdFieldLabel: "Test Contact Field",
      targetEntity: "contact",
      enturFieldType: "standard",
      enturFieldKey: "contact.email",
    });
    expect(result).toHaveProperty("id");
  });

  it("should create a mapping with targetEntity=company", async () => {
    const result = await caller1.fieldMappings.create({
      rdFieldKey: "cf_test_company",
      rdFieldLabel: "Test Company Field",
      targetEntity: "company",
      enturFieldType: "standard",
      enturFieldKey: "account.name",
    });
    expect(result).toHaveProperty("id");
  });

  it("should list created mappings with targetEntity field", async () => {
    const mappings = await caller1.fieldMappings.list();
    const testMappings = mappings.filter((m: any) => m.rdFieldKey.startsWith("cf_test_"));
    expect(testMappings.length).toBeGreaterThanOrEqual(3);
    // Verify each has targetEntity
    for (const m of testMappings) {
      expect(m).toHaveProperty("targetEntity");
      expect(["deal", "contact", "company"]).toContain(m.targetEntity);
    }
  });

  it("should update targetEntity on existing mapping", async () => {
    const mappings = await caller1.fieldMappings.list();
    const testMapping = mappings.find((m: any) => m.rdFieldKey === "cf_test_deal");
    if (testMapping) {
      const result = await caller1.fieldMappings.update({
        id: testMapping.id,
        targetEntity: "contact",
      });
      expect(result).toEqual({ success: true });

      // Verify the update
      const updated = await caller1.fieldMappings.list();
      const found = updated.find((m: any) => m.id === testMapping.id);
      expect(found?.targetEntity).toBe("contact");
    }
  });

  it("should toggle isActive on mapping", async () => {
    const mappings = await caller1.fieldMappings.list();
    const testMapping = mappings.find((m: any) => m.rdFieldKey === "cf_test_deal");
    if (testMapping) {
      const result = await caller1.fieldMappings.update({
        id: testMapping.id,
        isActive: false,
      });
      expect(result).toEqual({ success: true });
    }
  });

  it("should enforce multi-tenant isolation — tenant 2 cannot see tenant 1 mappings", async () => {
    const mappings2 = await caller2.fieldMappings.list();
    const leaked = mappings2.filter((m: any) => m.rdFieldKey.startsWith("cf_test_"));
    expect(leaked.length).toBe(0);
  });

  it("should return standard fields list with entity info", async () => {
    const fields = await caller1.fieldMappings.enturStandardFields();
    expect(Array.isArray(fields)).toBe(true);
    expect(fields.length).toBeGreaterThan(0);
    // Each field should have entity
    for (const f of fields) {
      expect(f).toHaveProperty("key");
      expect(f).toHaveProperty("label");
      expect(f).toHaveProperty("entity");
    }
    // Should have fields for different entities
    const entities = new Set(fields.map(f => f.entity));
    expect(entities.has("deal")).toBe(true);
    expect(entities.has("contact")).toBe(true);
    expect(entities.has("account")).toBe(true);
  });

  it("should return custom fields list with entity info", async () => {
    const fields = await caller1.fieldMappings.enturCustomFields();
    expect(Array.isArray(fields)).toBe(true);
    // Each field should have entity
    for (const f of fields) {
      expect(f).toHaveProperty("id");
      expect(f).toHaveProperty("key");
      expect(f).toHaveProperty("label");
      expect(f).toHaveProperty("entity");
    }
  });

  it("should require authentication for fieldMappings.list", async () => {
    await expect(unauthCaller.fieldMappings.list()).rejects.toThrow();
  });

  it("should delete test mappings (cleanup)", async () => {
    const mappings = await caller1.fieldMappings.list();
    const testMappings = mappings.filter((m: any) => m.rdFieldKey.startsWith("cf_test_"));
    for (const m of testMappings) {
      const result = await caller1.fieldMappings.delete({ id: m.id });
      expect(result).toEqual({ success: true });
    }
    // Verify cleanup
    const remaining = await caller1.fieldMappings.list();
    const leftover = remaining.filter((m: any) => m.rdFieldKey.startsWith("cf_test_"));
    expect(leftover.length).toBe(0);
  });
});

describe("applyFieldMappings service", () => {
  it("should be importable and callable", async () => {
    const { applyFieldMappings } = await import("./services/applyFieldMappings");
    expect(typeof applyFieldMappings).toBe("function");
  });

  it("should return result with 0 mappings when tenant has no mappings configured", async () => {
    const { applyFieldMappings } = await import("./services/applyFieldMappings");
    const result = await applyFieldMappings({
      tenantId: 999999, // non-existent tenant
      dealId: 1,
      contactId: 1,
      leadData: { email: "test@example.com", name: "Test" },
    });
    expect(result.totalMappings).toBe(0);
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  it("should gracefully handle missing field values (skip, not crash)", async () => {
    const { applyFieldMappings } = await import("./services/applyFieldMappings");
    // Even if there are mappings, if the leadData doesn't have the mapped fields, it should skip
    const result = await applyFieldMappings({
      tenantId: 1,
      dealId: undefined,
      contactId: undefined,
      leadData: {}, // empty payload
    });
    // Should not throw, should return gracefully
    expect(result).toHaveProperty("totalMappings");
    expect(result).toHaveProperty("applied");
    expect(result).toHaveProperty("skipped");
    expect(result).toHaveProperty("errors");
    expect(result.errors.length).toBe(0); // no errors, just skips
  });

  it("should handle leadData with rdCustomFields", async () => {
    const { applyFieldMappings } = await import("./services/applyFieldMappings");
    const result = await applyFieldMappings({
      tenantId: 999999,
      dealId: 1,
      contactId: 1,
      leadData: { email: "test@example.com" },
      rdCustomFields: { cf_destino: "Paris", cf_orcamento: "5000" },
    });
    // No mappings for this tenant, so nothing applied
    expect(result.totalMappings).toBe(0);
  });
});
