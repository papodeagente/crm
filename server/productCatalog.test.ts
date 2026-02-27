import { describe, expect, it, vi } from "vitest";
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

const tenantId = 1;

// ═══════════════════════════════════════
// PRODUCT CATEGORIES
// ═══════════════════════════════════════
describe("productCatalog.categories", () => {
  let createdCategoryId: number;

  it("creates a product category", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.categories.create({
      tenantId,
      name: "Destinos Europa",
      color: "#3b82f6",
      icon: "globe",
    });
    expect(result).toBeDefined();
    expect(result?.id).toBeGreaterThan(0);
    createdCategoryId = result!.id;
  });

  it("lists product categories", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.categories.list({ tenantId });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const found = result.find((c: any) => c.name === "Destinos Europa");
    expect(found).toBeDefined();
  });

  it("gets a category by id", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.categories.get({ tenantId, id: createdCategoryId });
    expect(result).toBeDefined();
    expect(result?.name).toBe("Destinos Europa");
    expect(result?.color).toBe("#3b82f6");
  });

  it("updates a category", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.categories.update({
      tenantId,
      id: createdCategoryId,
      name: "Europa Premium",
      color: "#8b5cf6",
    });
    expect(result).toEqual({ success: true });

    // Verify update
    const updated = await caller.productCatalog.categories.get({ tenantId, id: createdCategoryId });
    expect(updated?.name).toBe("Europa Premium");
    expect(updated?.color).toBe("#8b5cf6");
  });

  it("deletes a category", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.categories.delete({ tenantId, id: createdCategoryId });
    expect(result).toEqual({ success: true });

    // Verify deletion
    const deleted = await caller.productCatalog.categories.get({ tenantId, id: createdCategoryId });
    expect(deleted).toBeNull();
  });
});

// ═══════════════════════════════════════
// PRODUCT CATALOG
// ═══════════════════════════════════════
describe("productCatalog.products", () => {
  let createdProductId: number;

  it("creates a catalog product", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.products.create({
      tenantId,
      name: "Pacote Paris 7 Noites",
      description: "Pacote completo com aéreo + hotel em Paris",
      productType: "package",
      basePriceCents: 1500000, // R$ 15.000,00
      costPriceCents: 1200000, // R$ 12.000,00
      supplier: "CVC",
      destination: "Paris, França",
      duration: "7 noites",
      sku: "PKG-PAR-001",
      isActive: true,
    });
    expect(result).toBeDefined();
    expect(result?.id).toBeGreaterThan(0);
    createdProductId = result!.id;
  });

  it("lists catalog products", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.products.list({ tenantId });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const found = result.find((p: any) => p.name === "Pacote Paris 7 Noites");
    expect(found).toBeDefined();
    expect(found?.productType).toBe("package");
  });

  it("lists products with search filter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.products.list({ tenantId, search: "Paris" });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]?.name).toContain("Paris");
  });

  it("lists products with type filter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.products.list({ tenantId, productType: "package" });
    expect(result.length).toBeGreaterThanOrEqual(1);
    result.forEach((p: any) => expect(p.productType).toBe("package"));
  });

  it("gets a product by id", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.products.get({ tenantId, id: createdProductId });
    expect(result).toBeDefined();
    expect(result?.name).toBe("Pacote Paris 7 Noites");
    expect(result?.basePriceCents).toBe(1500000);
    expect(result?.costPriceCents).toBe(1200000);
    expect(result?.destination).toBe("Paris, França");
    expect(result?.sku).toBe("PKG-PAR-001");
  });

  it("updates a product", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.products.update({
      tenantId,
      id: createdProductId,
      name: "Pacote Paris Premium 7 Noites",
      basePriceCents: 1800000,
    });
    expect(result).toEqual({ success: true });

    // Verify update
    const updated = await caller.productCatalog.products.get({ tenantId, id: createdProductId });
    expect(updated?.name).toBe("Pacote Paris Premium 7 Noites");
    expect(updated?.basePriceCents).toBe(1800000);
  });

  it("toggles product active status", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Deactivate
    await caller.productCatalog.products.update({ tenantId, id: createdProductId, isActive: false });
    const deactivated = await caller.productCatalog.products.get({ tenantId, id: createdProductId });
    expect(Boolean(deactivated?.isActive)).toBe(false);

    // Reactivate
    await caller.productCatalog.products.update({ tenantId, id: createdProductId, isActive: true });
    const reactivated = await caller.productCatalog.products.get({ tenantId, id: createdProductId });
    expect(Boolean(reactivated?.isActive)).toBe(true);
  });

  it("counts products", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.products.count({ tenantId });
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it("deletes a product", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.products.delete({ tenantId, id: createdProductId });
    expect(result).toEqual({ success: true });

    // Verify deletion
    const deleted = await caller.productCatalog.products.get({ tenantId, id: createdProductId });
    expect(deleted).toBeNull();
  });
});

// ═══════════════════════════════════════
// ANALYTICS
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

  it("returns top destinations", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productCatalog.analytics.topDestinations({ tenantId });
    expect(Array.isArray(result)).toBe(true);
  });
});
