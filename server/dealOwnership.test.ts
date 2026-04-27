import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for Deal Ownership & Visibility Rules (v2 — visibility-service based)
 *
 * Validates:
 * 1. Auto-assign owner on deal creation (REGRA 1)
 * 2. Owner change is allowed and logged in history (REGRA 2)
 * 3. Non-admin users visibility controlled by resolveVisibilityFilter (REGRA 3)
 * 4. Admin users can see all deals (REGRA 4)
 * 5. Non-admin users cannot update/move other users' deals
 * 6. Dashboard metrics respect ownership
 */

// ─── Mocks ───
const mockDeal = {
  id: 1,
  tenantId: 1,
  title: "Test Deal",
  pipelineId: 1,
  stageId: 1,
  status: "open",
  ownerUserId: 10, // owned by user 10
  contactId: null,
  accountId: null,
  valueCents: 0,
  probability: null,
  expectedCloseAt: null,
  channelOrigin: null,
  leadSource: null,
  appointmentDate: null,
  followUpDate: null,
  lossReasonId: null,
  lossNotes: null,
  utmCampaign: null,
  utmSource: null,
  utmMedium: null,
  utmTerm: null,
  utmContent: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock("./crmDb", () => ({
  createDeal: vi.fn().mockResolvedValue({ id: 99 }),
  getDealById: vi.fn().mockImplementation((_tenantId: number, id: number) => {
    if (id === 1) return Promise.resolve({ ...mockDeal });
    if (id === 2) return Promise.resolve({ ...mockDeal, id: 2, ownerUserId: 20 }); // owned by user 20
    return Promise.resolve(null);
  }),
  listDeals: vi.fn().mockResolvedValue([]),
  countDeals: vi.fn().mockResolvedValue(0),
  updateDeal: vi.fn().mockResolvedValue(undefined),
  createDealHistory: vi.fn().mockResolvedValue({ id: 1 }),
  createDealProduct: vi.fn().mockResolvedValue({ id: 1 }),
  getCatalogProductById: vi.fn().mockResolvedValue(null),
  listPipelines: vi.fn().mockResolvedValue([{ id: 1, name: "Default", isDefault: true }]),
  listStages: vi.fn().mockResolvedValue([{ id: 1, name: "New", position: 0 }]),
  executePipelineAutomation: vi.fn().mockResolvedValue([]),
  executeTaskAutomations: vi.fn().mockResolvedValue([]),
  incrementLossReasonUsage: vi.fn().mockResolvedValue(undefined),
  bulkSoftDeleteDeals: vi.fn().mockResolvedValue(1),
  listDeletedDeals: vi.fn().mockResolvedValue([]),
  restoreDeals: vi.fn().mockResolvedValue(1),
  hardDeleteDeals: vi.fn().mockResolvedValue(1),
}));

vi.mock("./middleware/eventLog", () => ({
  emitEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
  }),
  createNotification: vi.fn().mockResolvedValue({ id: 1 }),
  getDashboardMetrics: vi.fn().mockResolvedValue({ activeDeals: 0, activeDealsChange: 0, totalContacts: 0, totalContactsChange: 0, activeTrips: 0, activeTripsChange: 0, pendingTasks: 0, pendingTasksChange: 0, totalDealValueCents: 0 }),
  getPipelineSummary: vi.fn().mockResolvedValue([]),
  getRecentActivity: vi.fn().mockResolvedValue([]),
  getUpcomingTasks: vi.fn().mockResolvedValue([]),
  getDashboardWhatsAppMetrics: vi.fn().mockResolvedValue({}),
  getDashboardDealsTimeline: vi.fn().mockResolvedValue([]),
  getDashboardConversionRates: vi.fn().mockResolvedValue({}),
  getDashboardFunnelData: vi.fn().mockResolvedValue([]),
  getDashboardAllPipelines: vi.fn().mockResolvedValue([]),
  getUserPreference: vi.fn().mockResolvedValue(null),
  setUserPreference: vi.fn().mockResolvedValue(undefined),
}));

// Mock the visibility service to return "restrita" for non-admin by default
vi.mock("./services/visibilityService", async (importOriginal) => {
  const original = await importOriginal<typeof import("./services/visibilityService")>();
  return {
    ...original,
    resolveVisibilityFilter: vi.fn().mockImplementation(
      async (userId: number, _tenantId: number, _entity: string, isAdmin: boolean) => {
        if (isAdmin) return { mode: "geral" as const, ownerUserIds: undefined };
        // Default mock: non-admin sees only their own (restrita)
        return { mode: "restrita" as const, ownerUserIds: [userId] };
      }
    ),
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as crm from "./crmDb";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(opts: { userId: number; role: "admin" | "user"; saasUserId?: number }): TrpcContext {
  const user: AuthenticatedUser = {
    id: opts.userId,
    openId: `user-${opts.userId}`,
    email: `user${opts.userId}@test.com`,
    name: `User ${opts.userId}`,
    loginMethod: "email",
    role: opts.role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    saasUser: {
      userId: opts.saasUserId ?? opts.userId,
      tenantId: 1,
      email: user.email,
      name: user.name,
      role: opts.role,
    },
    req: {
      protocol: "https",
      hostname: "test.manus.computer",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Deal Ownership & Visibility Rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  // REGRA 1: Auto-assign owner on creation
  // ═══════════════════════════════════════════════════════════
  describe("REGRA 1: Auto-assign owner on creation", () => {
    it("should auto-assign ownerUserId to the creating user when not specified", async () => {
      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      await caller.crm.deals.create({
        tenantId: 1,
        title: "New Deal",
        pipelineId: 1,
        stageId: 1,
        // ownerUserId NOT specified
      });

      expect(crm.createDeal).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUserId: 10, // should be auto-assigned to user 10
          createdBy: 10,
        })
      );
    });

    it("should respect explicitly provided ownerUserId", async () => {
      const ctx = createContext({ userId: 10, role: "admin" });
      const caller = appRouter.createCaller(ctx);

      await caller.crm.deals.create({
        tenantId: 1,
        title: "New Deal",
        pipelineId: 1,
        stageId: 1,
        ownerUserId: 20, // explicitly set to user 20
      });

      expect(crm.createDeal).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUserId: 20,
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // REGRA 2: Change owner
  // ═══════════════════════════════════════════════════════════
  describe("REGRA 2: Change owner", () => {
    it("should allow changing the deal owner via update", async () => {
      const ctx = createContext({ userId: 10, role: "admin" });
      const caller = appRouter.createCaller(ctx);

      await caller.crm.deals.update({
        tenantId: 1,
        id: 1,
        ownerUserId: 20,
      });

      expect(crm.updateDeal).toHaveBeenCalledWith(
        1, 1,
        expect.objectContaining({ ownerUserId: 20 })
      );
    });

    it("should log owner change in deal history", async () => {
      const ctx = createContext({ userId: 10, role: "admin" });
      const caller = appRouter.createCaller(ctx);

      await caller.crm.deals.update({
        tenantId: 1,
        id: 1,
        ownerUserId: 20,
      });

      expect(crm.createDealHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          dealId: 1,
          action: "field_changed",
          fieldChanged: "ownerUserId",
          oldValue: "10",
          newValue: "20",
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // REGRA 3: Non-admin visibility via resolveVisibilityFilter
  // ═══════════════════════════════════════════════════════════
  describe("REGRA 3: Non-admin visibility restriction", () => {
    it("non-admin user listing deals uses visibility filter (ownerUserIds)", async () => {
      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      await caller.crm.deals.list({ tenantId: 1 });

      // listDeals should be called with ownerUserIds = [10] (from visibility mock)
      expect(crm.listDeals).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ ownerUserIds: [10] })
      );
    });

    it("non-admin user cannot filter by ownerUserId outside their visibility scope", async () => {
      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      // Try to pass ownerUserId: 20 (outside scope — restrita only has [10])
      await caller.crm.deals.list({ tenantId: 1, ownerUserId: 20 });

      // Should fall back to full visibility set since 20 is not in [10]
      expect(crm.listDeals).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ ownerUserIds: [10] })
      );
    });

    it("non-admin user CAN filter by their own ownerUserId within visibility scope", async () => {
      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      // Filter by ownerUserId: 10 (within scope — restrita has [10])
      await caller.crm.deals.list({ tenantId: 1, ownerUserId: 10 });

      // Should use ownerUserId filter directly since 10 is within the allowed set
      expect(crm.listDeals).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ ownerUserId: 10 })
      );
    });

    it("non-admin user cannot access another user's deal by ID", async () => {
      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      // Deal 2 is owned by user 20
      await expect(
        caller.crm.deals.get({ tenantId: 1, id: 2 })
      ).rejects.toThrow("Você não tem permissão para visualizar esta negociação");
    });

    it("non-admin user CAN access their own deal by ID", async () => {
      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      // Deal 1 is owned by user 10
      const deal = await caller.crm.deals.get({ tenantId: 1, id: 1 });
      expect(deal).toBeTruthy();
      expect(deal!.ownerUserId).toBe(10);
    });

    it("non-admin user cannot update another user's deal", async () => {
      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      // Deal 2 is owned by user 20
      await expect(
        caller.crm.deals.update({ tenantId: 1, id: 2, title: "Hacked" })
      ).rejects.toThrow("Você não tem permissão para editar esta negociação");
    });

    it("non-admin user cannot move another user's deal stage", async () => {
      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.crm.deals.moveStage({
          tenantId: 1,
          dealId: 2,
          fromStageId: 1,
          toStageId: 2,
          fromStageName: "New",
          toStageName: "Qualified",
        })
      ).rejects.toThrow("Você não tem permissão para mover esta negociação");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // REGRA 4: Admin sees everything
  // ═══════════════════════════════════════════════════════════
  describe("REGRA 4: Admin sees everything", () => {
    it("admin user listing deals should see all (no ownerUserIds filter)", async () => {
      const ctx = createContext({ userId: 1, role: "admin" });
      const caller = appRouter.createCaller(ctx);

      await caller.crm.deals.list({ tenantId: 1 });

      // listDeals should be called WITHOUT ownerUserIds (visibility returns undefined for admin)
      expect(crm.listDeals).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ ownerUserId: undefined })
      );
    });

    it("admin can access any deal by ID", async () => {
      const ctx = createContext({ userId: 1, role: "admin" });
      const caller = appRouter.createCaller(ctx);

      // Deal 2 is owned by user 20, but admin can access it
      const deal = await caller.crm.deals.get({ tenantId: 1, id: 2 });
      expect(deal).toBeTruthy();
      expect(deal!.ownerUserId).toBe(20);
    });

    it("admin can update any deal", async () => {
      const ctx = createContext({ userId: 1, role: "admin" });
      const caller = appRouter.createCaller(ctx);

      // Should not throw
      await caller.crm.deals.update({ tenantId: 1, id: 2, title: "Updated by Admin" });
      expect(crm.updateDeal).toHaveBeenCalled();
    });

    it("admin can filter by specific ownerUserId", async () => {
      const ctx = createContext({ userId: 1, role: "admin" });
      const caller = appRouter.createCaller(ctx);

      await caller.crm.deals.list({ tenantId: 1, ownerUserId: 20 });

      expect(crm.listDeals).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ ownerUserId: 20 })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // REGRA 5: Filter within visibility scope (Geral user)
  // ═══════════════════════════════════════════════════════════
  describe("REGRA 5: Filter within Geral visibility scope", () => {
    it("user with Geral permission can filter by their own ownerUserId", async () => {
      // Override visibility mock to return geral for this test
      const { resolveVisibilityFilter } = await import("./services/visibilityService");
      (resolveVisibilityFilter as any).mockResolvedValueOnce({ mode: "geral", ownerUserIds: undefined });

      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      await caller.crm.deals.list({ tenantId: 1, ownerUserId: 10 });

      // Should pass ownerUserId filter directly (geral has no restriction)
      expect(crm.listDeals).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ ownerUserId: 10 })
      );
    });

    it("user with Geral permission can see all deals when no filter applied", async () => {
      const { resolveVisibilityFilter } = await import("./services/visibilityService");
      (resolveVisibilityFilter as any).mockResolvedValueOnce({ mode: "geral", ownerUserIds: undefined });

      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      await caller.crm.deals.list({ tenantId: 1 });

      // No ownerUserId filter, no ownerUserIds restriction
      expect(crm.listDeals).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ ownerUserId: undefined })
      );
    });

    it("user with Geral permission can filter by another user's ownerUserId", async () => {
      const { resolveVisibilityFilter } = await import("./services/visibilityService");
      (resolveVisibilityFilter as any).mockResolvedValueOnce({ mode: "geral", ownerUserIds: undefined });

      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      await caller.crm.deals.list({ tenantId: 1, ownerUserId: 20 });

      expect(crm.listDeals).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ ownerUserId: 20 })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // REGRA 6: Filter within Equipe visibility scope
  // ═══════════════════════════════════════════════════════════
  describe("REGRA 6: Filter within Equipe visibility scope", () => {
    it("user with Equipe permission can filter by teammate's ownerUserId", async () => {
      const { resolveVisibilityFilter } = await import("./services/visibilityService");
      // Equipe: user 10 sees [10, 11, 12]
      (resolveVisibilityFilter as any).mockResolvedValueOnce({ mode: "equipe", ownerUserIds: [10, 11, 12] });

      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      await caller.crm.deals.list({ tenantId: 1, ownerUserId: 11 });

      // 11 is within the team set, so filter should be applied directly
      expect(crm.listDeals).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ ownerUserId: 11 })
      );
    });

    it("user with Equipe permission cannot filter by non-teammate's ownerUserId", async () => {
      const { resolveVisibilityFilter } = await import("./services/visibilityService");
      // Equipe: user 10 sees [10, 11, 12]
      (resolveVisibilityFilter as any).mockResolvedValueOnce({ mode: "equipe", ownerUserIds: [10, 11, 12] });

      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      await caller.crm.deals.list({ tenantId: 1, ownerUserId: 99 });

      // 99 is NOT in the team set, so should fall back to full team ownerUserIds
      expect(crm.listDeals).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ ownerUserIds: [10, 11, 12] })
      );
    });

    it("user with Equipe permission can filter by own ownerUserId", async () => {
      const { resolveVisibilityFilter } = await import("./services/visibilityService");
      (resolveVisibilityFilter as any).mockResolvedValueOnce({ mode: "equipe", ownerUserIds: [10, 11, 12] });

      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      await caller.crm.deals.list({ tenantId: 1, ownerUserId: 10 });

      // 10 is within the team set
      expect(crm.listDeals).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ ownerUserId: 10 })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Dashboard metrics respect ownership
  // ═══════════════════════════════════════════════════════════
  describe("Dashboard metrics respect ownership", () => {
    it("non-admin user gets filtered dashboard metrics", async () => {
      const { getDashboardMetrics } = await import("./db");
      const ctx = createContext({ userId: 10, role: "user" });
      const caller = appRouter.createCaller(ctx);

      await caller.dashboard.metrics({ tenantId: 1 });

      // Dashboard still uses the old ownerFilter approach (userId for non-admin)
      expect(getDashboardMetrics).toHaveBeenCalledWith(
        1, 10, undefined, undefined, undefined, undefined
      );
    });

    it("admin user gets global dashboard metrics", async () => {
      const { getDashboardMetrics } = await import("./db");
      const ctx = createContext({ userId: 1, role: "admin" });
      const caller = appRouter.createCaller(ctx);

      await caller.dashboard.metrics({ tenantId: 1 });

      expect(getDashboardMetrics).toHaveBeenCalledWith(
        1, undefined, undefined, undefined, undefined, undefined
      );
    });
  });
});
