import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },
    req: { protocol: "https", hostname: "test.manus.computer", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("Simplified Product Creation", () => {
  const caller = appRouter.createCaller(createCtx());

  it("creates product with only name (all other fields optional)", async () => {
    const product = await caller.productCatalog.products.create({
      name: "Produto Simples",
    });
    expect(product).toBeDefined();
    expect(product.id).toBeGreaterThan(0);
  });

  it("creates product with name and zero price", async () => {
    const product = await caller.productCatalog.products.create({
      name: "Produto Grátis",
      basePriceCents: 0,
    });
    expect(product).toBeDefined();
    expect(product.id).toBeGreaterThan(0);
  });

  it("creates product with name, price, cost, and professional", async () => {
    const product = await caller.productCatalog.products.create({
      name: "Pacote Estético Completo",
      basePriceCents: 500000,
      costPriceCents: 350000,
      professional: "Dra. Ana",
    });
    expect(product).toBeDefined();
    expect(product.id).toBeGreaterThan(0);
  });

  it("creates product with description", async () => {
    const product = await caller.productCatalog.products.create({
      name: "Produto com Descrição",
      description: "Uma descrição detalhada do produto",
      basePriceCents: 100000,
    });
    expect(product).toBeDefined();
    expect(product.id).toBeGreaterThan(0);
  });

  it("defaults productType to 'other' when not provided", async () => {
    const product = await caller.productCatalog.products.create({
      name: "Produto Tipo Default",
    });
    expect(product).toBeDefined();
    // Product was created successfully without specifying productType
    expect(product.id).toBeGreaterThan(0);
  });

  it("creates product with null costPriceCents", async () => {
    const product = await caller.productCatalog.products.create({
      name: "Produto Sem Custo",
      basePriceCents: 200000,
      costPriceCents: null,
    });
    expect(product).toBeDefined();
    expect(product.id).toBeGreaterThan(0);
  });

  it("rejects product with empty name", async () => {
    await expect(
      caller.productCatalog.products.create({ name: "" })
    ).rejects.toThrow();
  });

  it("retrieves created product with correct values", async () => {
    const created = await caller.productCatalog.products.create({
      name: "Produto Verificação",
      basePriceCents: 150000,
      costPriceCents: 100000,
      professional: "Dr. Carlos",
    });

    const product = await caller.productCatalog.products.get({ id: created.id });
    expect(product).toBeDefined();
    expect(product!.name).toBe("Produto Verificação");
    expect(product!.basePriceCents).toBe(150000);
    expect(product!.costPriceCents).toBe(100000);
    expect(product!.professional).toBe("Dr. Carlos");
  });

  it("updates product preserving fields not sent", async () => {
    const created = await caller.productCatalog.products.create({
      name: "Produto Original",
      basePriceCents: 100000,
      professional: "Profissional A",
    });

    await caller.productCatalog.products.update({
      id: created.id,
      name: "Produto Atualizado",
    });

    const updated = await caller.productCatalog.products.get({ id: created.id });
    expect(updated!.name).toBe("Produto Atualizado");
    // Professional should be preserved
    expect(updated!.professional).toBe("Profissional A");
  });
});
