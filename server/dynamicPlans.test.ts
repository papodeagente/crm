import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

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

function createAuthContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },
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

describe("Dynamic Plans — plan.active endpoint", () => {
  it("1. plan.active returns an array of plans", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.active();
    expect(result).toHaveProperty("plans");
    expect(Array.isArray(result.plans)).toBe(true);
  });

  it("2. plan.active returns featureDescriptions object", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.active();
    expect(result).toHaveProperty("featureDescriptions");
    expect(typeof result.featureDescriptions).toBe("object");
  });

  it("3. each plan has required fields (id, name, priceInCents, features)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.active();
    if (result.plans.length > 0) {
      const plan = result.plans[0];
      expect(plan).toHaveProperty("id");
      expect(plan).toHaveProperty("name");
      expect(plan).toHaveProperty("priceInCents");
      expect(plan).toHaveProperty("features");
      expect(typeof plan.id).toBe("string");
      expect(typeof plan.name).toBe("string");
      expect(typeof plan.priceInCents).toBe("number");
      expect(typeof plan.features).toBe("object");
    }
  });

  it("4. each plan has limit fields (maxUsers, maxWhatsAppAccounts, maxAttendantsPerAccount)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.active();
    if (result.plans.length > 0) {
      const plan = result.plans[0];
      expect(plan).toHaveProperty("maxUsers");
      expect(plan).toHaveProperty("maxWhatsAppAccounts");
      expect(plan).toHaveProperty("maxAttendantsPerAccount");
      expect(typeof plan.maxUsers).toBe("number");
      expect(typeof plan.maxWhatsAppAccounts).toBe("number");
      expect(typeof plan.maxAttendantsPerAccount).toBe("number");
    }
  });

  it("5. plans are sorted by displayOrder ascending", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.active();
    if (result.plans.length > 1) {
      for (let i = 1; i < result.plans.length; i++) {
        expect(result.plans[i].displayOrder).toBeGreaterThanOrEqual(result.plans[i - 1].displayOrder);
      }
    }
  });

  it("6. all returned plans are active and public", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.active();
    for (const plan of result.plans) {
      expect(plan.isActive).toBe(true);
      expect(plan.isPublic).toBe(true);
    }
  });

  it("7. each plan has commercialCopy and description strings", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.active();
    for (const plan of result.plans) {
      expect(typeof plan.description).toBe("string");
      expect(typeof plan.commercialCopy).toBe("string");
    }
  });

  it("8. plan.active is accessible without authentication (publicProcedure)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    // Should not throw UNAUTHORIZED
    const result = await caller.plan.active();
    expect(result).toBeDefined();
  });

  it("9. featureDescriptions contains known feature keys", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.active();
    const fd = result.featureDescriptions as Record<string, any>;
    // Should have at least crmCore
    expect(fd).toHaveProperty("crmCore");
    if (fd.crmCore) {
      expect(fd.crmCore).toHaveProperty("title");
      expect(fd.crmCore).toHaveProperty("description");
    }
  });

  it("10. plan features are boolean values", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.active();
    for (const plan of result.plans) {
      for (const [key, value] of Object.entries(plan.features)) {
        expect(typeof value).toBe("boolean");
      }
    }
  });

  it("11. plan.active returns consistent results on repeated calls (cache)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result1 = await caller.plan.active();
    const result2 = await caller.plan.active();
    expect(result1.plans.length).toBe(result2.plans.length);
    if (result1.plans.length > 0) {
      expect(result1.plans[0].id).toBe(result2.plans[0].id);
      expect(result1.plans[0].priceInCents).toBe(result2.plans[0].priceInCents);
    }
  });

  it("12. plan.active returns at least one plan (fallback or DB)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.plan.active();
    expect(result.plans.length).toBeGreaterThanOrEqual(1);
  });
});
