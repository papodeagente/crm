import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

const caller = appRouter.createCaller(createAuthContext().ctx);

// ═══════════════════════════════════════════════════════════
// FIELD MAPPINGS (RD Station ↔ Entur OS)
// ═══════════════════════════════════════════════════════════

describe("fieldMappings", () => {
  describe("list", () => {
    it("should return an array", async () => {
      const result = await caller.fieldMappings.list({ tenantId: 1 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("enturStandardFields", () => {
    it("should return standard fields list", async () => {
      const result = await caller.fieldMappings.enturStandardFields();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      // Should include UTM fields
      const keys = result.map((f: any) => f.key);
      expect(keys).toContain("deal.utmSource");
      expect(keys).toContain("deal.utmMedium");
      expect(keys).toContain("deal.utmCampaign");
      expect(keys).toContain("deal.utmTerm");
      expect(keys).toContain("deal.utmContent");
      // Should include contact fields
      expect(keys).toContain("contact.name");
      expect(keys).toContain("contact.email");
      expect(keys).toContain("contact.phone");
    });

    it("should have key, label, and entity for each field", async () => {
      const result = await caller.fieldMappings.enturStandardFields();
      for (const field of result) {
        expect(field).toHaveProperty("key");
        expect(field).toHaveProperty("label");
        expect(field).toHaveProperty("entity");
        expect(typeof field.key).toBe("string");
        expect(typeof field.label).toBe("string");
        expect(["contact", "account", "deal"]).toContain(field.entity);
      }
    });
  });

  describe("enturCustomFields", () => {
    it("should return an array", async () => {
      const result = await caller.fieldMappings.enturCustomFields({ tenantId: 1 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("CRUD operations", () => {
    let createdId: number;

    it("should create a standard field mapping", async () => {
      const result = await caller.fieldMappings.create({
        tenantId: 1,
        rdFieldKey: "test_company",
        rdFieldLabel: "Empresa (teste)",
        enturFieldType: "standard",
        enturFieldKey: "account.name",
      });
      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
      createdId = result.id;
    });

    it("should list the created mapping", async () => {
      const result = await caller.fieldMappings.list({ tenantId: 1 });
      const found = result.find((m: any) => m.id === createdId);
      expect(found).toBeDefined();
      expect(found!.rdFieldKey).toBe("test_company");
      expect(found!.rdFieldLabel).toBe("Empresa (teste)");
      expect(found!.enturFieldType).toBe("standard");
      expect(found!.enturFieldKey).toBe("account.name");
      expect(found!.isActive).toBe(true);
    });

    it("should update the mapping", async () => {
      const result = await caller.fieldMappings.update({
        id: createdId,
        tenantId: 1,
        rdFieldLabel: "Empresa (atualizado)",
        isActive: false,
      });
      expect(result.success).toBe(true);

      const list = await caller.fieldMappings.list({ tenantId: 1 });
      const found = list.find((m: any) => m.id === createdId);
      expect(found!.rdFieldLabel).toBe("Empresa (atualizado)");
      expect(found!.isActive).toBe(false);
    });

    it("should delete the mapping", async () => {
      const result = await caller.fieldMappings.delete({ id: createdId, tenantId: 1 });
      expect(result.success).toBe(true);

      const list = await caller.fieldMappings.list({ tenantId: 1 });
      const found = list.find((m: any) => m.id === createdId);
      expect(found).toBeUndefined();
    });

    it("should create a custom field mapping", async () => {
      const result = await caller.fieldMappings.create({
        tenantId: 1,
        rdFieldKey: "cf_destino_interesse",
        rdFieldLabel: "Destino de Interesse",
        enturFieldType: "custom",
        enturCustomFieldId: 999,
      });
      expect(result).toHaveProperty("id");
      // Cleanup
      await caller.fieldMappings.delete({ id: result.id, tenantId: 1 });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// DEAL PRODUCTS (DealItem with FK to Product catalog)
// ═══════════════════════════════════════════════════════════

describe("deals.products (DealItem with catalog FK)", () => {
  describe("create with productId", () => {
    it("should reject creation without valid productId", async () => {
      try {
        await caller.crm.deals.products.create({
          tenantId: 1,
          dealId: 999999,
          productId: 999999, // non-existent product
          name: "Test Product",
          quantity: 1,
          unitPriceCents: 1000,
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (e: any) {
        expect(e.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("catalog product validation", () => {
    it("should list catalog products", async () => {
      const result = await caller.productCatalog.products.list({
        tenantId: 1,
        page: 1,
        limit: 10,
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// RD STATION CONFIG
// ═══════════════════════════════════════════════════════════

describe("rdStation", () => {
  describe("getConfig", () => {
    it("should return config or null", async () => {
      const result = await caller.rdStation.getConfig({ tenantId: 1 });
      // Can be null if not configured yet
      if (result) {
        expect(result).toHaveProperty("id");
        expect(result).toHaveProperty("webhookToken");
        expect(result).toHaveProperty("isActive");
      }
    });
  });

  describe("getStats", () => {
    it("should return stats object", async () => {
      const result = await caller.rdStation.getStats({ tenantId: 1 });
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("failed");
      expect(result).toHaveProperty("duplicate");
      expect(typeof result.total).toBe("number");
    });
  });

  describe("setupIntegration", () => {
    it("should create or return existing config", async () => {
      const result = await caller.rdStation.setupIntegration({ tenantId: 1 });
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("webhookToken");
      expect(typeof result.webhookToken).toBe("string");
      expect(result.webhookToken.length).toBeGreaterThan(10);
    });
  });
});
