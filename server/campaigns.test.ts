/**
 * Tests for Bulk Campaign Registry
 * Tests the campaign creation, listing, detail, and message tracking functions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted — cannot reference top-level variables
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./whatsapp", () => ({
  whatsappManager: {
    getSession: vi.fn(),
    sendTextMessage: vi.fn(),
    connect: vi.fn(),
  },
}));

vi.mock("../drizzle/schema", () => ({
  rfvContacts: { tenantId: "tenantId", id: "id" },
  whatsappSessions: { tenantId: "tenantId", sessionId: "sessionId", userId: "userId", status: "status" },
  bulkCampaigns: { id: "id", tenantId: "tenantId", status: "status", createdAt: "createdAt" },
  bulkCampaignMessages: { id: "id", campaignId: "campaignId", tenantId: "tenantId", status: "status", contactId: "contactId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => ({ type: "eq", args })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  inArray: vi.fn((...args: any[]) => ({ type: "inArray", args })),
  desc: vi.fn((col: any) => ({ type: "desc", col })),
  sql: vi.fn(),
  count: vi.fn(() => "count"),
}));

import { getDb } from "./db";
import { whatsappManager } from "./whatsapp";
import {
  interpolateTemplate,
  getBulkSendProgress,
  cancelBulkSend,
  listCampaigns,
  getCampaignDetail,
  getCampaignMessages,
  getActiveSessionForTenant,
} from "./bulkMessage";

function createMockDb() {
  const db: any = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ insertId: 42 }]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return db;
}

describe("Campaign Registry", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockResolvedValue(mockDb);
    vi.mocked(whatsappManager.getSession).mockReturnValue({ status: "connected", socket: {} } as any);
    vi.mocked(whatsappManager.sendTextMessage).mockResolvedValue({ key: { id: "wa-msg-123" } } as any);
  });

  // ─── interpolateTemplate ───
  describe("interpolateTemplate", () => {
    it("replaces all template variables correctly", () => {
      const template = "Olá {primeiro_nome}, seu nome completo é {nome}. Email: {email}, Tel: {telefone}. Público: {publico}, Valor: {valor}";
      const contact = {
        name: "Maria Silva",
        email: "maria@test.com",
        phone: "11999887766",
        audienceType: "cliente_ativo",
        vScore: 150000,
      };
      const result = interpolateTemplate(template, contact);
      expect(result).toContain("Maria");
      expect(result).toContain("Maria Silva");
      expect(result).toContain("maria@test.com");
      expect(result).toContain("11999887766");
      expect(result).toContain("cliente_ativo");
      expect(result).toContain("1.500");
    });

    it("handles missing email and phone gracefully", () => {
      const template = "Olá {primeiro_nome}, email: {email}, tel: {telefone}";
      const contact = {
        name: "João",
        email: null,
        phone: null,
        audienceType: "novo",
        vScore: 0,
      };
      const result = interpolateTemplate(template, contact);
      expect(result).toContain("João");
      expect(result).not.toContain("{primeiro_nome}");
    });

    it("is case-insensitive for variable names", () => {
      const template = "{NOME} {Nome} {nome}";
      const contact = { name: "Test", email: null, phone: null, audienceType: "x", vScore: 0 };
      const result = interpolateTemplate(template, contact);
      expect(result).toBe("Test Test Test");
    });

    it("formats vScore as BRL currency", () => {
      const template = "Valor: {valor}";
      const contact = { name: "A", email: null, phone: null, audienceType: "x", vScore: 99900 };
      const result = interpolateTemplate(template, contact);
      expect(result).toContain("999");
    });

    it("extracts first name correctly", () => {
      const template = "{primeiro_nome}";
      const contact = { name: "Ana Paula Costa", email: null, phone: null, audienceType: "x", vScore: 0 };
      const result = interpolateTemplate(template, contact);
      expect(result).toBe("Ana");
    });
  });

  // ─── getBulkSendProgress ───
  describe("getBulkSendProgress", () => {
    it("returns null when no job exists", () => {
      const result = getBulkSendProgress(999);
      expect(result).toBeNull();
    });
  });

  // ─── cancelBulkSend ───
  describe("cancelBulkSend", () => {
    it("returns false when no job exists", () => {
      const result = cancelBulkSend(999);
      expect(result).toBe(false);
    });
  });

  // ─── listCampaigns ───
  describe("listCampaigns", () => {
    it("returns campaigns and total count", async () => {
      const mockCampaigns = [
        { id: 1, name: "Test Campaign", status: "completed" },
      ];

      // Promise.all calls: campaigns query (with offset) and count query (with where)
      let offsetCalls = 0;
      mockDb.offset.mockImplementation(() => {
        offsetCalls++;
        return Promise.resolve(mockCampaigns);
      });
      // The count query goes through where -> resolves
      let whereCalls = 0;
      mockDb.where.mockImplementation(() => {
        whereCalls++;
        if (whereCalls % 2 === 0) {
          // second where call is for the count query
          return Promise.resolve([{ total: 1 }]);
        }
        return mockDb;
      });

      const result = await listCampaigns(1);
      expect(result).toBeDefined();
      expect(result).toHaveProperty("campaigns");
      expect(result).toHaveProperty("total");
    });

    it("returns empty when db is null", async () => {
      vi.mocked(getDb).mockResolvedValue(null as any);
      const result = await listCampaigns(1);
      expect(result.campaigns).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ─── getCampaignDetail ───
  describe("getCampaignDetail", () => {
    it("returns null when campaign not found", async () => {
      mockDb.where.mockResolvedValue([]);
      const result = await getCampaignDetail(999, 1);
      expect(result).toBeNull();
    });

    it("returns campaign with breakdown when found", async () => {
      const mockCampaign = { id: 1, name: "Test", status: "completed", totalContacts: 10 };
      const mockBreakdown = [
        { status: "sent", count: 8 },
        { status: "failed", count: 2 },
      ];

      let whereCalls = 0;
      mockDb.where.mockImplementation(() => {
        whereCalls++;
        if (whereCalls === 1) return Promise.resolve([mockCampaign]);
        return mockDb;
      });
      mockDb.groupBy.mockResolvedValue(mockBreakdown);

      const result = await getCampaignDetail(1, 1);
      expect(result).toBeDefined();
      if (result) {
        expect(result.name).toBe("Test");
        expect(result.breakdown).toBeDefined();
        expect(result.breakdown.sent).toBe(8);
        expect(result.breakdown.failed).toBe(2);
      }
    });

    it("returns empty breakdown when no messages exist", async () => {
      const mockCampaign = { id: 1, name: "Empty", status: "running", totalContacts: 0 };

      let whereCalls = 0;
      mockDb.where.mockImplementation(() => {
        whereCalls++;
        if (whereCalls === 1) return Promise.resolve([mockCampaign]);
        return mockDb;
      });
      mockDb.groupBy.mockResolvedValue([]);

      const result = await getCampaignDetail(1, 1);
      expect(result).toBeDefined();
      expect(result?.breakdown).toEqual({});
    });
  });

  // ─── getCampaignMessages ───
  describe("getCampaignMessages", () => {
    it("returns messages and total count", async () => {
      const mockMessages = [
        { id: 1, contactName: "Maria", status: "sent" },
      ];

      let offsetCalls = 0;
      mockDb.offset.mockImplementation(() => {
        offsetCalls++;
        return Promise.resolve(mockMessages);
      });
      let whereCalls = 0;
      mockDb.where.mockImplementation(() => {
        whereCalls++;
        if (whereCalls % 2 === 0) return Promise.resolve([{ total: 1 }]);
        return mockDb;
      });

      const result = await getCampaignMessages(1, 1);
      expect(result).toBeDefined();
      expect(result).toHaveProperty("messages");
      expect(result).toHaveProperty("total");
    });

    it("returns empty when db is null", async () => {
      vi.mocked(getDb).mockResolvedValue(null as any);
      const result = await getCampaignMessages(1, 1);
      expect(result.messages).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ─── getActiveSessionForTenant ───
  describe("getActiveSessionForTenant", () => {
    it("returns null when no sessions exist", async () => {
      mockDb.where.mockResolvedValue([]);
      const result = await getActiveSessionForTenant(999);
      expect(result).toBeNull();
    });

    it("returns connected session when in-memory session exists", async () => {
      mockDb.where.mockResolvedValue([
        { sessionId: "test-session", tenantId: 1, userId: 1, status: "connected" },
      ]);
      vi.mocked(whatsappManager.getSession).mockReturnValue({ status: "connected", socket: {} } as any);

      const result = await getActiveSessionForTenant(1);
      expect(result).toBeDefined();
      expect(result?.status).toBe("connected");
      expect(result?.sessionId).toBe("test-session");
    });

    it("triggers auto-reconnect when DB says connected but no in-memory session", async () => {
      mockDb.where.mockResolvedValue([
        { sessionId: "test-session", tenantId: 150002, userId: 150001, status: "connected" },
      ]);
      vi.mocked(whatsappManager.getSession).mockReturnValue(null as any);
      vi.mocked(whatsappManager.connect).mockResolvedValue(undefined as any);

      const result = await getActiveSessionForTenant(150002);
      expect(result).toBeDefined();
      expect(result?.status).toBe("connecting");
      expect(whatsappManager.connect).toHaveBeenCalledWith("test-session", 150001, 150002);
    });

    it("returns disconnected when DB session is not connected", async () => {
      mockDb.where.mockResolvedValue([
        { sessionId: "test-session", tenantId: 1, userId: 1, status: "disconnected" },
      ]);
      vi.mocked(whatsappManager.getSession).mockReturnValue(null as any);

      const result = await getActiveSessionForTenant(1);
      expect(result).toBeDefined();
      expect(result?.status).toBe("disconnected");
    });

    it("returns null when db is unavailable", async () => {
      vi.mocked(getDb).mockResolvedValue(null as any);
      const result = await getActiveSessionForTenant(1);
      expect(result).toBeNull();
    });
  });
});
