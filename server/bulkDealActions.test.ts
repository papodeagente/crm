import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock crmDb
vi.mock("./crmDb", () => ({
  listDeals: vi.fn(),
  getDealById: vi.fn(),
  updateDeal: vi.fn(),
  createDealHistory: vi.fn(),
  listStages: vi.fn(),
  createTask: vi.fn(),
}));

// Mock eventLog
vi.mock("./middleware/eventLog", () => ({
  emitEvent: vi.fn(),
}));

// Mock db
vi.mock("./db", () => ({
  createNotification: vi.fn(),
}));

// Mock visibilityService
vi.mock("./services/visibilityService", () => ({
  resolveVisibilityFilter: vi.fn().mockResolvedValue({ ownerUserIds: null }),
}));

import * as crm from "./crmDb";
import {
  resolveSelection,
  bulkTransfer,
  bulkChangeStatus,
  bulkMoveStage,
  bulkUpdateFields,
  bulkCreateTask,
  bulkExport,
  type BulkActionContext,
  type BulkSelectionInput,
} from "./services/bulkDealService";

const mockCtx: BulkActionContext = {
  tenantId: 1,
  userId: 10,
  userName: "Test Admin",
  isAdmin: true,
  saasUserId: 10,
};

const mockDeal = (id: number, overrides: any = {}) => ({
  id,
  tenantId: 1,
  title: `Deal ${id}`,
  status: "open",
  stageId: 100,
  pipelineId: 1,
  ownerUserId: 10,
  valueCents: 50000,
  contactId: 5,
  accountId: null,
  createdAt: new Date(),
  ...overrides,
});

describe("Bulk Deal Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: listDeals returns 3 deals
    (crm.listDeals as any).mockResolvedValue([mockDeal(1), mockDeal(2), mockDeal(3)]);
    (crm.getDealById as any).mockImplementation((_tid: number, id: number) =>
      Promise.resolve(mockDeal(id))
    );
    (crm.updateDeal as any).mockResolvedValue(undefined);
    (crm.createDealHistory as any).mockResolvedValue(undefined);
    (crm.createTask as any).mockResolvedValue({ id: 999 });
    (crm.listStages as any).mockResolvedValue([
      { id: 100, name: "Pré venda" },
      { id: 200, name: "Proposta" },
    ]);
  });

  describe("resolveSelection", () => {
    it("should resolve explicit selectedIds", async () => {
      const input: BulkSelectionInput = { selectedIds: [1, 2] };
      const ids = await resolveSelection(input, mockCtx);
      expect(ids).toEqual([1, 2]);
    });

    it("should return empty array for empty input", async () => {
      const input: BulkSelectionInput = {};
      const ids = await resolveSelection(input, mockCtx);
      expect(ids).toEqual([]);
    });

    it("should resolve allMatchingFilter with exclusions", async () => {
      const input: BulkSelectionInput = {
        allMatchingFilter: true,
        exclusionIds: [2],
        filterSnapshot: { pipelineId: 1 },
      };
      const ids = await resolveSelection(input, mockCtx);
      expect(ids).toContain(1);
      expect(ids).toContain(3);
      expect(ids).not.toContain(2);
    });

    it("should filter out invalid IDs not in tenant", async () => {
      const input: BulkSelectionInput = { selectedIds: [1, 2, 999] };
      const ids = await resolveSelection(input, mockCtx);
      expect(ids).toContain(1);
      expect(ids).toContain(2);
      expect(ids).not.toContain(999);
    });
  });

  describe("bulkTransfer", () => {
    it("should transfer deals to new owner", async () => {
      const result = await bulkTransfer([1, 2], 20, mockCtx);
      expect(result.totalProcessed).toBe(2);
      expect(result.totalSkipped).toBe(0);
      expect(crm.updateDeal).toHaveBeenCalledTimes(2);
      expect(crm.createDealHistory).toHaveBeenCalledTimes(2);
    });

    it("should skip deals not found", async () => {
      (crm.getDealById as any).mockImplementation((_tid: number, id: number) =>
        id === 1 ? Promise.resolve(mockDeal(1)) : Promise.resolve(null)
      );
      const result = await bulkTransfer([1, 999], 20, mockCtx);
      expect(result.totalProcessed).toBe(1);
      expect(result.totalSkipped).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("bulkChangeStatus", () => {
    it("should change status of all deals", async () => {
      const result = await bulkChangeStatus([1, 2, 3], "won", undefined, undefined, mockCtx);
      expect(result.totalProcessed).toBe(3);
      expect(crm.updateDeal).toHaveBeenCalledTimes(3);
    });

    it("should include lossReasonId when status is lost", async () => {
      const result = await bulkChangeStatus([1], "lost", 5, "Cliente desistiu", mockCtx);
      expect(result.totalProcessed).toBe(1);
      expect(crm.updateDeal).toHaveBeenCalledWith(1, 1, expect.objectContaining({
        status: "lost",
        lossReasonId: 5,
        lossNotes: "Cliente desistiu",
      }));
    });
  });

  describe("bulkMoveStage", () => {
    it("should move deals to new stage", async () => {
      const result = await bulkMoveStage([1, 2], 200, "Proposta", mockCtx);
      expect(result.totalProcessed).toBe(2);
      expect(crm.updateDeal).toHaveBeenCalledTimes(2);
    });

    it("should skip deals already in target stage", async () => {
      (crm.getDealById as any).mockResolvedValue(mockDeal(1, { stageId: 200 }));
      const result = await bulkMoveStage([1], 200, "Proposta", mockCtx);
      expect(result.totalSkipped).toBe(1);
      expect(result.totalProcessed).toBe(0);
    });
  });

  describe("bulkUpdateFields", () => {
    it("should update specified fields", async () => {
      const result = await bulkUpdateFields(
        [1, 2],
        { leadSource: "Google", channelOrigin: "WhatsApp" },
        mockCtx
      );
      expect(result.totalProcessed).toBe(2);
      expect(crm.updateDeal).toHaveBeenCalledTimes(2);
    });

    it("should skip when no fields provided", async () => {
      const result = await bulkUpdateFields([1], {}, mockCtx);
      expect(result.totalSkipped).toBe(1);
      expect(result.totalProcessed).toBe(0);
    });
  });

  describe("bulkCreateTask", () => {
    it("should create tasks for all deals", async () => {
      const result = await bulkCreateTask(
        [1, 2],
        { title: "Follow-up", taskType: "phone", priority: "high", assignToOwner: true },
        mockCtx
      );
      expect(result.totalProcessed).toBe(2);
      expect(crm.createTask).toHaveBeenCalledTimes(2);
    });

    it("should assign to deal owner when assignToOwner is true", async () => {
      (crm.getDealById as any).mockResolvedValue(mockDeal(1, { ownerUserId: 30 }));
      await bulkCreateTask(
        [1],
        { title: "Test", assignToOwner: true },
        mockCtx
      );
      expect(crm.createTask).toHaveBeenCalledWith(expect.objectContaining({
        assignedToUserId: 30,
      }));
    });
  });

  describe("bulkExport", () => {
    it("should return deals for export", async () => {
      const result = await bulkExport([1, 2], mockCtx);
      expect(result.totalExported).toBe(2);
      expect(result.deals).toHaveLength(2);
    });
  });
});
