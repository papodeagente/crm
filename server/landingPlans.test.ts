import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    saasUser: null,
    req: {
      protocol: "https",
      hostname: "test.manus.computer",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Landing Page — plan.public endpoint", () => {
  it("1. plan.public returns an array", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.public();
    expect(Array.isArray(result)).toBe(true);
  });

  it("2. plan.public is accessible without authentication", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.public();
    expect(result).toBeDefined();
  });

  it("3. each plan has required PublicPlan fields", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.public();
    if (result.length > 0) {
      const plan = result[0];
      expect(plan).toHaveProperty("slug");
      expect(plan).toHaveProperty("name");
      expect(plan).toHaveProperty("priceCents");
      expect(plan).toHaveProperty("billingCycle");
      expect(plan).toHaveProperty("isPopular");
      expect(plan).toHaveProperty("sortOrder");
      expect(plan).toHaveProperty("limits");
      expect(plan).toHaveProperty("features");
      expect(typeof plan.slug).toBe("string");
      expect(typeof plan.name).toBe("string");
      expect(typeof plan.priceCents).toBe("number");
    }
  });

  it("4. each plan has limits with maxUsers, maxWhatsAppAccounts, maxAttendantsPerAccount", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.public();
    for (const plan of result) {
      expect(plan.limits).toHaveProperty("maxUsers");
      expect(plan.limits).toHaveProperty("maxWhatsAppAccounts");
      expect(plan.limits).toHaveProperty("maxAttendantsPerAccount");
      expect(typeof plan.limits.maxUsers).toBe("number");
      expect(typeof plan.limits.maxWhatsAppAccounts).toBe("number");
      expect(typeof plan.limits.maxAttendantsPerAccount).toBe("number");
    }
  });

  it("5. each plan has features array with key, label, isEnabled", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.public();
    for (const plan of result) {
      expect(Array.isArray(plan.features)).toBe(true);
      if (plan.features.length > 0) {
        const feature = plan.features[0];
        expect(feature).toHaveProperty("key");
        expect(feature).toHaveProperty("label");
        expect(feature).toHaveProperty("isEnabled");
        expect(typeof feature.key).toBe("string");
        expect(typeof feature.label).toBe("string");
        expect(typeof feature.isEnabled).toBe("boolean");
      }
    }
  });

  it("6. plans are sorted by sortOrder ascending", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.public();
    if (result.length > 1) {
      for (let i = 1; i < result.length; i++) {
        expect(result[i].sortOrder).toBeGreaterThanOrEqual(result[i - 1].sortOrder);
      }
    }
  });

  it("7. plan.public does NOT expose internal fields (internalId, stripeProductId, etc.)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.public();
    for (const plan of result) {
      expect(plan).not.toHaveProperty("internalId");
      expect(plan).not.toHaveProperty("stripeProductId");
      expect(plan).not.toHaveProperty("stripePriceId");
      expect(plan).not.toHaveProperty("hotmartProductId");
    }
  });

  it("8. plan.public returns at least one plan (fallback or DB)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.public();
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("9. each plan has description and commercialCopy strings", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.public();
    for (const plan of result) {
      expect(typeof plan.description).toBe("string");
      expect(typeof plan.commercialCopy).toBe("string");
    }
  });

  it("10. plan.public returns consistent results on repeated calls (cache)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result1 = await caller.plan.public();
    const result2 = await caller.plan.public();
    expect(result1.length).toBe(result2.length);
    if (result1.length > 0) {
      expect(result1[0].slug).toBe(result2[0].slug);
      expect(result1[0].priceCents).toBe(result2[0].priceCents);
    }
  });
});
