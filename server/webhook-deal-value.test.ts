import { describe, expect, it, vi } from "vitest";

/**
 * Tests for the RD Station webhook deal value recalculation fix.
 * 
 * Root cause: When a product was auto-linked to a deal via the RD Station webhook,
 * recalcDealValue() was NOT called, so the deal's valueCents stayed at 0.
 * The manual flow (crmRouter) always called recalcDealValue() after createDealProduct().
 * 
 * Fix: Added recalcDealValue(tenantId, dealId) call right after createDealProduct()
 * in the webhook handler (webhookRoutes.ts line ~899).
 */

describe("Webhook Deal Value Recalculation", () => {
  // 1. Verify that recalcDealValue is now imported in webhookRoutes
  it("webhookRoutes.ts imports recalcDealValue from crmDb", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("./server/webhookRoutes.ts", "utf-8");
    
    // Must import recalcDealValue
    expect(source).toMatch(/import\s*\{[^}]*recalcDealValue[^}]*\}\s*from\s*["']\.\/crmDb["']/);
  });

  // 2. Verify that recalcDealValue is called after createDealProduct in the webhook
  it("webhook calls recalcDealValue after createDealProduct for auto-linked product", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("./server/webhookRoutes.ts", "utf-8");
    
    // Find the auto-product section
    const autoProductSection = source.indexOf("await createDealProduct({");
    expect(autoProductSection).toBeGreaterThan(-1);
    
    // recalcDealValue must appear AFTER createDealProduct in the same section
    const afterCreateProduct = source.indexOf("await recalcDealValue(", autoProductSection);
    expect(afterCreateProduct).toBeGreaterThan(autoProductSection);
    
    // And it must appear BEFORE the autoProductStatus = "linked" line
    const linkedStatus = source.indexOf('autoProductStatus = "linked"', autoProductSection);
    expect(afterCreateProduct).toBeLessThan(linkedStatus);
  });

  // 3. Verify the manual flow (crmRouter) also calls recalcDealValue (baseline)
  it("crmRouter calls recalcDealValue after product operations (baseline)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("./server/routers/crmRouter.ts", "utf-8");
    
    // Manual product add calls recalcDealValue
    const matches = source.match(/recalcDealValue/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3); // create, update, delete
  });

  // 4. Verify recalcDealValue function exists and works correctly
  it("recalcDealValue function is exported from crmDb", async () => {
    const crmDb = await import("./crmDb");
    expect(typeof crmDb.recalcDealValue).toBe("function");
  });

  // 5. Verify createDealProduct function is exported from crmDb
  it("createDealProduct function is exported from crmDb", async () => {
    const crmDb = await import("./crmDb");
    expect(typeof crmDb.createDealProduct).toBe("function");
  });

  // 6. Verify the webhook handler does NOT alter the processInboundLead call
  it("processInboundLead call is unchanged in webhook handler", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("./server/webhookRoutes.ts", "utf-8");
    
    // processInboundLead should still be called with tenantId and payload
    expect(source).toMatch(/await processInboundLead\(tenantId, payload/);
  });

  // 7. Verify the fix only adds recalcDealValue, not changing createDealProduct params
  it("createDealProduct call parameters are unchanged in webhook", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("./server/webhookRoutes.ts", "utf-8");
    
    // The createDealProduct call should still have the same structure
    expect(source).toMatch(/await createDealProduct\(\{[\s\S]*?tenantId,[\s\S]*?dealId: result\.dealId,[\s\S]*?productId: product\.id/);
  });

  // 8. Integration: recalcDealValue correctly sums deal_products
  it("recalcDealValue sums finalPriceCents from deal_products and updates deal", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return; // skip if no DB

    const { recalcDealValue, createDealProduct } = await import("./crmDb");
    const schema = await import("../drizzle/schema");

    // Use a test tenant
    const testTenantId = 999888;
    
    // Find a pipeline stage for the test
    const [stage] = await db.select().from(schema.pipelineStages).limit(1);
    if (!stage) return; // skip if no stages

    // Create a test deal with valueCents = 0
    const [testDeal] = await db.insert(schema.deals).values({
      tenantId: testTenantId,
      title: "Test Webhook Deal Value",
      pipelineId: stage.pipelineId,
      stageId: stage.id,
      valueCents: 0,
      status: "open",
    }).$returningId();

    try {
      // Add a product (simulating webhook auto-link)
      await createDealProduct({
        tenantId: testTenantId,
        dealId: testDeal.id,
        productId: 0,
        name: "Test Product",
        quantity: 1,
        unitPriceCents: 150000, // R$ 1.500,00
      });

      // Before recalc, deal value should still be 0
      const [beforeRecalc] = await db.select({ valueCents: schema.deals.valueCents })
        .from(schema.deals)
        .where(
          (await import("drizzle-orm")).and(
            (await import("drizzle-orm")).eq(schema.deals.id, testDeal.id),
            (await import("drizzle-orm")).eq(schema.deals.tenantId, testTenantId)
          )
        );
      expect(beforeRecalc.valueCents).toBe(0);

      // Now call recalcDealValue (this is what the fix adds)
      const newTotal = await recalcDealValue(testTenantId, testDeal.id);
      expect(newTotal).toBe(150000);

      // Verify the deal's valueCents was updated
      const [afterRecalc] = await db.select({ valueCents: schema.deals.valueCents })
        .from(schema.deals)
        .where(
          (await import("drizzle-orm")).and(
            (await import("drizzle-orm")).eq(schema.deals.id, testDeal.id),
            (await import("drizzle-orm")).eq(schema.deals.tenantId, testTenantId)
          )
        );
      expect(afterRecalc.valueCents).toBe(150000);
    } finally {
      // Cleanup
      const { eq, and } = await import("drizzle-orm");
      await db.delete(schema.dealProducts).where(and(eq(schema.dealProducts.tenantId, testTenantId), eq(schema.dealProducts.dealId, testDeal.id)));
      await db.delete(schema.deals).where(and(eq(schema.deals.id, testDeal.id), eq(schema.deals.tenantId, testTenantId)));
    }
  });
});
