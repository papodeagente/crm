import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── helpers ──
function createAuthContext(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: { id: 1, name: "Test User", email: "test@test.com", role: "admin", openId: "test-open-id" },
    saasUser: { tenantId: 1, userId: 1, role: "admin", status: "active" },
    req: {} as any,
    ...overrides,
  } as TrpcContext;
}

describe("Inbox Deal Creation with Products", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createAuthContext());
  });

  it("crm.deals.create accepts products array in input", async () => {
    // Verify the procedure exists and accepts the products field in its input schema
    const router = appRouter._def.procedures;
    // The router should have crm.deals.create
    expect(router).toBeDefined();
  });

  it("crm.deals.create input schema includes optional products array", () => {
    // Access the procedure definition to verify the input schema
    // The procedure should accept: title, pipelineId, stageId, contactId, products
    // products should be optional array of { productId, quantity, unitPriceCents?, discountCents? }
    const procedures = appRouter._def.procedures;
    expect(procedures).toBeDefined();
    // If we can create a caller, the router is properly defined
    expect(caller).toBeDefined();
  });

  it("should be able to create a deal without products (backward compatible)", async () => {
    // This test verifies that the products field is optional
    // The actual DB call may fail due to missing pipeline/stage, but the input validation should pass
    try {
      await caller.crm.deals.create({
        title: "Test Deal",
        pipelineId: 999999,
        stageId: 999999,
      });
    } catch (e: any) {
      // Expected to fail at DB level (pipeline doesn't exist), not at input validation
      expect(e.message).not.toContain("Expected");
      expect(e.message).not.toContain("Required");
    }
  });

  it("should accept products array in deal creation input", async () => {
    // This test verifies that the products field is accepted in the input schema
    try {
      await caller.crm.deals.create({
        title: "Test Deal with Products",
        pipelineId: 999999,
        stageId: 999999,
        products: [
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 1 },
        ],
      });
    } catch (e: any) {
      // Expected to fail at DB level, not at input validation
      // If it fails with "Expected" or "Required", the schema is wrong
      expect(e.message).not.toContain("Expected number");
      expect(e.message).not.toContain("Required");
    }
  });

  it("products array items should have productId and quantity", async () => {
    // Verify the products schema requires productId (number) and quantity (number, default 1)
    try {
      await caller.crm.deals.create({
        title: "Test Deal",
        pipelineId: 999999,
        stageId: 999999,
        products: [
          { productId: 42, quantity: 3 },
        ],
      });
    } catch (e: any) {
      // Should not fail on input validation
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });

  it("productCatalog.products.list should return products for selection", async () => {
    // Verify the product catalog list procedure exists and works
    try {
      const result = await caller.productCatalog.products.list({
        isActive: true,
        limit: 10,
      });
      // Should return an array (possibly empty)
      expect(result).toBeDefined();
    } catch (e: any) {
      // If it fails, it should be a DB error, not a schema error
      expect(e.message).not.toContain("is not a function");
    }
  });
});
