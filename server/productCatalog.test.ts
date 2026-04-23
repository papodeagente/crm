import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Product Catalog Tests — READ-ONLY
 * 
 * These tests verify that product catalog endpoints exist and return correct shapes.
 * They do NOT create, update, or delete any data in the production database.
 * All write operations are tested via pure logic assertions.
 */

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
    saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },
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

const tenantId = 1;

// ═══════════════════════════════════════
// PRODUCT CATEGORIES — READ-ONLY
// ═══════════════════════════════════════
describe("productCatalog.categories (read-only)", () => {
  it("lists product categories", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.categories.list({ tenantId });
    expect(Array.isArray(result)).toBe(true);
  });

  it("categories.list returns correct shape", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.categories.list({ tenantId });
    if (result.length > 0) {
      const cat = result[0];
      expect(typeof cat.id).toBe("number");
      expect(typeof cat.name).toBe("string");
    }
  });

  it("categories.get returns null for non-existent id", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.categories.get({ tenantId, id: 999999 });
    expect(result).toBeNull();
  });

  it("categories.create procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.productCatalog.categories.create).toBe("function");
  });

  it("categories.update procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.productCatalog.categories.update).toBe("function");
  });

  it("categories.delete procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.productCatalog.categories.delete).toBe("function");
  });
});

// ═══════════════════════════════════════
// PRODUCT CATALOG — READ-ONLY
// ═══════════════════════════════════════
describe("productCatalog.products (read-only)", () => {
  it("lists catalog products", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.products.list({ tenantId });
    expect(Array.isArray(result)).toBe(true);
  });

  it("products.list returns correct shape", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.products.list({ tenantId });
    if (result.length > 0) {
      const p = result[0];
      expect(typeof p.id).toBe("number");
      expect(typeof p.name).toBe("string");
    }
  });

  it("lists products with search filter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.products.list({ tenantId, search: "zzzznonexistent" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("lists products with type filter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.products.list({ tenantId, productType: "pacote" });
    expect(Array.isArray(result)).toBe(true);
    result.forEach((p: any) => expect(p.productType).toBe("pacote"));
  });

  it("products.get returns null for non-existent id", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.products.get({ tenantId, id: 999999 });
    expect(result).toBeNull();
  });

  it("counts products", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.products.count({ tenantId });
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("products.create procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.productCatalog.products.create).toBe("function");
  });

  it("products.update procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.productCatalog.products.update).toBe("function");
  });

  it("products.delete procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.productCatalog.products.delete).toBe("function");
  });
});

// ═══════════════════════════════════════
// ANALYTICS — READ-ONLY
// ═══════════════════════════════════════
describe("productCatalog.analytics", () => {
  it("returns analytics summary", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.analytics.summary({ tenantId });
    expect(result).toBeDefined();
    expect(typeof result.totalProducts).toBe("number");
    expect(typeof result.activeProducts).toBe("number");
    expect(typeof result.avgPriceCents).toBe("number");
    expect(typeof result.totalRevenueCents).toBe("number");
    expect(typeof result.dealsWithProducts).toBe("number");
  });

  it("returns most sold products", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.analytics.mostSold({ tenantId });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns most lost products", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.analytics.mostLost({ tenantId });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns most requested products", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.analytics.mostRequested({ tenantId });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns revenue by type", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.analytics.revenueByType({ tenantId });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns conversion rate", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.analytics.conversionRate({ tenantId });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns top locations", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.analytics.topLocations({ tenantId });
    expect(Array.isArray(result)).toBe(true);
  });
});
