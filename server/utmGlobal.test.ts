import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { seedDefaultUtmMappings, DEFAULT_UTM_MAPPINGS } from "./services/seedDefaultUtmMappings";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(tenantId = 1, userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user-open-id",
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
    saasUser: {
      userId,
      tenantId,
      role: "admin" as const,
      email: "test@example.com",
      name: "Test User",
    },
    req: {
      protocol: "https",
      hostname: "test.manus.computer",
      get: (h: string) => (h === "host" ? "test.manus.computer" : ""),
    } as any,
  };
}

const caller1 = appRouter.createCaller(createAuthContext(150002, 1));
const caller2 = appRouter.createCaller(createAuthContext(210002, 2));

describe("UTM Global Standardization", () => {
  describe("DEFAULT_UTM_MAPPINGS constant", () => {
    it("has exactly 5 UTM mappings", () => {
      expect(DEFAULT_UTM_MAPPINGS).toHaveLength(5);
    });

    it("covers all 5 UTM fields", () => {
      const enturKeys = DEFAULT_UTM_MAPPINGS.map((m) => m.enturFieldKey);
      expect(enturKeys).toContain("deal.utmSource");
      expect(enturKeys).toContain("deal.utmMedium");
      expect(enturKeys).toContain("deal.utmCampaign");
      expect(enturKeys).toContain("deal.utmContent");
      expect(enturKeys).toContain("deal.utmTerm");
    });

    it("all mappings target deal entity with standard type", () => {
      for (const m of DEFAULT_UTM_MAPPINGS) {
        expect(m.targetEntity).toBe("deal");
        expect(m.enturFieldType).toBe("standard");
      }
    });

    it("all rdFieldKeys use cf_utm_ prefix", () => {
      for (const m of DEFAULT_UTM_MAPPINGS) {
        expect(m.rdFieldKey).toMatch(/^cf_utm_/);
      }
    });
  });

  describe("seedDefaultUtmMappings (idempotency)", () => {
    it("returns created=0 for tenant that already has all 5 UTMs (Entur 150002)", async () => {
      const result = await seedDefaultUtmMappings(150002);
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(5);
      expect(result.existing).toHaveLength(5);
    });

    it("returns created=0 for tenant that was already provisioned (210002)", async () => {
      // 210002 was provisioned by the migration script
      const result = await seedDefaultUtmMappings(210002);
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(5);
    });

    it("running twice on same tenant produces identical results", async () => {
      const first = await seedDefaultUtmMappings(150002);
      const second = await seedDefaultUtmMappings(150002);
      expect(first).toEqual(second);
    });
  });

  describe("fieldMappings.list returns UTM mappings for all tenants", () => {
    it("tenant 150002 (Entur) has 5 UTM mappings", async () => {
      const mappings = await caller1.fieldMappings.list();
      const utmMappings = mappings.filter((m: any) =>
        m.enturFieldKey?.startsWith("deal.utm")
      );
      expect(utmMappings.length).toBe(5);
    });

    it("tenant 210002 (Boxtour) has 5 UTM mappings after provisioning", async () => {
      const mappings = await caller2.fieldMappings.list();
      const utmMappings = mappings.filter((m: any) =>
        m.enturFieldKey?.startsWith("deal.utm")
      );
      expect(utmMappings.length).toBe(5);
    });

    it("UTM mappings are all active", async () => {
      const mappings = await caller2.fieldMappings.list();
      const utmMappings = mappings.filter((m: any) =>
        m.enturFieldKey?.startsWith("deal.utm")
      );
      for (const m of utmMappings) {
        expect((m as any).isActive).toBe(true);
      }
    });
  });

  describe("multi-tenant isolation", () => {
    it("tenant 1 cannot see tenant 2 mappings", async () => {
      const mappings1 = await caller1.fieldMappings.list();
      const mappings2 = await caller2.fieldMappings.list();
      
      const ids1 = new Set(mappings1.map((m: any) => m.id));
      const ids2 = new Set(mappings2.map((m: any) => m.id));
      
      // No overlap
      for (const id of ids1) {
        expect(ids2.has(id)).toBe(false);
      }
    });

    it("each tenant has its own independent UTM mappings", async () => {
      const mappings1 = await caller1.fieldMappings.list();
      const mappings2 = await caller2.fieldMappings.list();
      
      const utmKeys1 = mappings1
        .filter((m: any) => m.enturFieldKey?.startsWith("deal.utm"))
        .map((m: any) => m.enturFieldKey)
        .sort();
      const utmKeys2 = mappings2
        .filter((m: any) => m.enturFieldKey?.startsWith("deal.utm"))
        .map((m: any) => m.enturFieldKey)
        .sort();
      
      // Same 5 UTM keys but different records
      expect(utmKeys1).toEqual(utmKeys2);
    });
  });

  describe("no duplication", () => {
    it("no tenant has more than 5 UTM mappings", async () => {
      const mappings1 = await caller1.fieldMappings.list();
      const utmMappings1 = mappings1.filter((m: any) =>
        m.enturFieldKey?.startsWith("deal.utm")
      );
      expect(utmMappings1.length).toBe(5);

      const mappings2 = await caller2.fieldMappings.list();
      const utmMappings2 = mappings2.filter((m: any) =>
        m.enturFieldKey?.startsWith("deal.utm")
      );
      expect(utmMappings2.length).toBe(5);
    });

    it("no duplicate rdFieldKeys within a tenant", async () => {
      const mappings = await caller1.fieldMappings.list();
      const rdKeys = mappings.map((m: any) => m.rdFieldKey);
      const uniqueKeys = new Set(rdKeys);
      expect(rdKeys.length).toBe(uniqueKeys.size);
    });

    it("no duplicate enturFieldKeys within a tenant", async () => {
      const mappings = await caller1.fieldMappings.list();
      const enturKeys = mappings
        .filter((m: any) => m.enturFieldKey)
        .map((m: any) => m.enturFieldKey);
      const uniqueKeys = new Set(enturKeys);
      expect(enturKeys.length).toBe(uniqueKeys.size);
    });
  });

  describe("authentication", () => {
    it("fieldMappings.list rejects unauthenticated requests", async () => {
      const anonCaller = appRouter.createCaller({ user: null, saasUser: null, req: {} as any });
      await expect(anonCaller.fieldMappings.list()).rejects.toThrow();
    });
  });
});
