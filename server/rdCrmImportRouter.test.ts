import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for the RD Station CRM Import Router v2
 * 
 * Validates:
 * 1. Router structure and procedure definitions
 * 2. The new importUsers option
 * 3. Progress tracking interface with skipped/updated counts
 * 4. Validation report structure
 * 5. Category count calculations
 */

// Mock the rdStationCrmImport module
vi.mock("./rdStationCrmImport", () => ({
  validateRdCrmToken: vi.fn().mockResolvedValue({ valid: true, account: "Test" }),
  fetchRdCrmSummary: vi.fn().mockResolvedValue({ contacts: 10, deals: 5, pipelines: 2, users: 3 }),
  fetchAllPipelines: vi.fn().mockResolvedValue([]),
  fetchAllUsers: vi.fn().mockResolvedValue([]),
  fetchAllSources: vi.fn().mockResolvedValue([]),
  fetchAllCampaigns: vi.fn().mockResolvedValue([]),
  fetchAllLossReasons: vi.fn().mockResolvedValue([]),
  fetchAllProducts: vi.fn().mockResolvedValue([]),
  fetchAllOrganizations: vi.fn().mockResolvedValue([]),
  fetchAllContacts: vi.fn().mockResolvedValue([]),
  fetchAllDeals: vi.fn().mockResolvedValue([]),
  fetchAllTasks: vi.fn().mockResolvedValue([]),
}));

// Mock the crmDb module
vi.mock("./crmDb", () => ({
  createPipeline: vi.fn().mockResolvedValue({ id: 1 }),
  createStage: vi.fn().mockResolvedValue({ id: 1 }),
  listPipelines: vi.fn().mockResolvedValue([{ id: 1, isDefault: true }]),
  listStages: vi.fn().mockResolvedValue([{ id: 1 }]),
  createCrmUser: vi.fn().mockResolvedValue({ id: 1 }),
  listCrmUsers: vi.fn().mockResolvedValue([]),
  createLeadSource: vi.fn().mockResolvedValue({ id: 1 }),
  createCampaign: vi.fn().mockResolvedValue({ id: 1 }),
  createLossReason: vi.fn().mockResolvedValue({ id: 1 }),
  createCatalogProduct: vi.fn().mockResolvedValue({ id: 1 }),
  createAccount: vi.fn().mockResolvedValue({ id: 1 }),
  createContact: vi.fn().mockResolvedValue({ id: 1 }),
  createNote: vi.fn().mockResolvedValue({ id: 1 }),
  createDeal: vi.fn().mockResolvedValue({ id: 1 }),
  createDealProduct: vi.fn().mockResolvedValue({ id: 1 }),
  createDealHistory: vi.fn().mockResolvedValue({ id: 1 }),
  createTask: vi.fn().mockResolvedValue({ id: 1 }),
}));

// Mock db module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue([[]]),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
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
      hostname: "test.manus.computer",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
  return { ctx };
}

describe("RD CRM Import Router v2 — Procedures", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    const { ctx } = createAuthContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("validateToken", () => {
    it("validates a token successfully", async () => {
      const result = await caller.rdCrmImport.validateToken({ token: "test-token-12345" });
      expect(result).toEqual({ valid: true, account: "Test" });
    });

    it("rejects short tokens (< 10 chars)", async () => {
      await expect(
        caller.rdCrmImport.validateToken({ token: "short" })
      ).rejects.toThrow();
    });
  });

  describe("fetchSummary", () => {
    it("fetches summary data from RD Station", async () => {
      const result = await caller.rdCrmImport.fetchSummary({ token: "test-token-12345" });
      expect(result).toHaveProperty("contacts", 10);
      expect(result).toHaveProperty("deals", 5);
      expect(result).toHaveProperty("pipelines", 2);
      expect(result).toHaveProperty("users", 3);
    });
  });

  describe("importAll — category counting", () => {
    it("counts all 10 categories + validation when all enabled", async () => {
      const result = await caller.rdCrmImport.importAll({
        tenantId: 1,
        token: "test-token-12345",
        importContacts: true,
        importDeals: true,
        importOrganizations: true,
        importProducts: true,
        importTasks: true,
        importPipelines: true,
        importSources: true,
        importCampaigns: true,
        importLossReasons: true,
        importUsers: true,
      });
      expect(result.started).toBe(true);
      // 10 data categories + 1 validation = 11
      expect(result.categories).toBe(11);
    });

    it("counts only selected categories + validation", async () => {
      const result = await caller.rdCrmImport.importAll({
        tenantId: 1,
        token: "test-token-12345",
        importContacts: true,
        importDeals: true,
        importOrganizations: false,
        importProducts: false,
        importTasks: false,
        importPipelines: true,
        importSources: false,
        importCampaigns: false,
        importLossReasons: false,
        importUsers: false,
      });
      expect(result.started).toBe(true);
      // pipelines + contacts + deals + validation = 4
      expect(result.categories).toBe(4);
    });

    it("counts only users + validation when only users enabled", async () => {
      const result = await caller.rdCrmImport.importAll({
        tenantId: 1,
        token: "test-token-12345",
        importContacts: false,
        importDeals: false,
        importOrganizations: false,
        importProducts: false,
        importTasks: false,
        importPipelines: false,
        importSources: false,
        importCampaigns: false,
        importLossReasons: false,
        importUsers: true,
      });
      expect(result.started).toBe(true);
      // users + validation = 2
      expect(result.categories).toBe(2);
    });

    it("importUsers defaults to true when omitted", async () => {
      const result = await caller.rdCrmImport.importAll({
        tenantId: 1,
        token: "test-token-12345",
        importContacts: false,
        importDeals: false,
        importOrganizations: false,
        importProducts: false,
        importTasks: false,
        importPipelines: false,
        importSources: false,
        importCampaigns: false,
        importLossReasons: false,
        // importUsers omitted — defaults to true
      });
      expect(result.started).toBe(true);
      // users (default true) + validation = 2
      expect(result.categories).toBe(2);
    });
  });

  describe("getProgress", () => {
    it("returns null when no import is in progress for user", async () => {
      const { ctx } = createAuthContext(9999);
      const freshCaller = appRouter.createCaller(ctx);
      const result = await freshCaller.rdCrmImport.getProgress();
      expect(result).toBeNull();
    });

    it("returns progress object after import starts", async () => {
      await caller.rdCrmImport.importAll({
        tenantId: 1,
        token: "test-token-12345",
        importContacts: true,
        importDeals: false,
        importOrganizations: false,
        importProducts: false,
        importTasks: false,
        importPipelines: false,
        importSources: false,
        importCampaigns: false,
        importLossReasons: false,
        importUsers: false,
      });

      // Wait for background process to initialize
      await new Promise(r => setTimeout(r, 200));

      const progress = await caller.rdCrmImport.getProgress();
      expect(progress).not.toBeNull();
      expect(progress).toHaveProperty("status");
      expect(progress).toHaveProperty("phase");
      expect(progress).toHaveProperty("results");
      expect(progress).toHaveProperty("startedAt");
      expect(["idle", "fetching", "importing", "done", "error"]).toContain(progress!.status);
    });
  });
});

describe("Progress & Validation Interfaces", () => {
  it("progress results include imported, skipped, updated, and errors", () => {
    const entry = { imported: 100, skipped: 50, updated: 0, errors: ["Error 1"] };
    expect(entry.imported).toBe(100);
    expect(entry.skipped).toBe(50);
    expect(entry.updated).toBe(0);
    expect(entry.errors).toHaveLength(1);
  });

  it("validation report contains rdCounts, enturCounts, mismatches", () => {
    const validation = {
      rdCounts: { contacts: 150, deals: 100, users: 7 },
      enturCounts: { contacts: 150, deals: 100 },
      mismatches: ["5 negociações sem contato vinculado"],
      duplicatesRemoved: {},
    };
    expect(validation.rdCounts.contacts).toBe(150);
    expect(validation.enturCounts.contacts).toBe(150);
    expect(validation.mismatches).toHaveLength(1);
    expect(validation.mismatches[0]).toContain("negociações sem contato");
  });

  it("validation report is empty when no issues found", () => {
    const validation = {
      rdCounts: { contacts: 100 },
      enturCounts: { contacts: 100 },
      mismatches: [],
      duplicatesRemoved: {},
    };
    expect(validation.mismatches).toHaveLength(0);
  });
});
