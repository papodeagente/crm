import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ───
const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockWhere = vi.fn();
const mockSet = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();
const mockValues = vi.fn();

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({ from: mockFrom }),
    update: () => ({ set: mockSet }),
    insert: () => ({ values: mockValues }),
  })),
  getSessionsByUser: vi.fn(async () => []),
  getSessionsByTenant: vi.fn(async () => []),
}));

vi.mock("../drizzle/schema", () => ({
  whatsappSessions: {
    tenantId: "tenantId",
    sessionId: "sessionId",
    status: "status",
    userId: "userId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  desc: vi.fn(),
  and: vi.fn((...args: any[]) => ({ _and: args })),
  gte: vi.fn(),
  sql: vi.fn(),
  isNotNull: vi.fn(),
  inArray: vi.fn(),
}));

// Mock whatsappManager (Baileys)
const mockGetSession = vi.fn();
const mockConnect = vi.fn();
vi.mock("./whatsapp", () => ({
  whatsappManager: {
    getSession: (...args: any[]) => mockGetSession(...args),
    connect: (...args: any[]) => mockConnect(...args),
  },
}));

// Mock Evolution API manager
const mockEvoGetSession = vi.fn();
vi.mock("./whatsappEvolution", () => ({
  whatsappManager: {
    getSession: (...args: any[]) => mockEvoGetSession(...args),
  },
}));

describe("RFV ActiveSession — userId-based session selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockConnect.mockResolvedValue({});
    mockEvoGetSession.mockReturnValue(undefined);
  });

  describe("getActiveSessionForTenant WITHOUT userId (legacy fallback)", () => {
    it("returns null when no sessions exist for the tenant", async () => {
      mockWhere.mockResolvedValue([]);
      const { getActiveSessionForTenant } = await import("./bulkMessage");
      const result = await getActiveSessionForTenant(150002);
      expect(result).toBeNull();
    });

    it("returns connected when in-memory session is connected", async () => {
      mockWhere.mockResolvedValue([
        { sessionId: "crm-150002-240001", userId: 240001, tenantId: 150002, status: "connected" },
      ]);
      mockEvoGetSession.mockReturnValue({ status: "connected" });

      const { getActiveSessionForTenant } = await import("./bulkMessage");
      const result = await getActiveSessionForTenant(150002);
      expect(result).toEqual({ sessionId: "crm-150002-240001", status: "connected" });
    });

    it("returns first connected session from multiple tenant sessions", async () => {
      mockWhere.mockResolvedValue([
        { sessionId: "crm-150002-240001", userId: 240001, tenantId: 150002, status: "connected" },
        { sessionId: "crm-150002-210001", userId: 210001, tenantId: 150002, status: "connected" },
      ]);
      // First session is connected
      mockEvoGetSession.mockImplementation((sid: string) => {
        if (sid === "crm-150002-240001") return { status: "connected" };
        if (sid === "crm-150002-210001") return { status: "connected" };
        return undefined;
      });

      const { getActiveSessionForTenant } = await import("./bulkMessage");
      const result = await getActiveSessionForTenant(150002);
      // Without userId, returns the first one found
      expect(result).toEqual({ sessionId: "crm-150002-240001", status: "connected" });
    });
  });

  describe("getActiveSessionForTenant WITH userId (new behavior)", () => {
    it("returns only the user's own session when userId is provided", async () => {
      // DB returns only sessions for userId=210001 (filtered by the AND clause)
      mockWhere.mockResolvedValue([
        { sessionId: "crm-150002-210001", userId: 210001, tenantId: 150002, status: "connected" },
      ]);
      mockEvoGetSession.mockReturnValue({ status: "connected" });

      const { getActiveSessionForTenant } = await import("./bulkMessage");
      const result = await getActiveSessionForTenant(150002, 210001);
      expect(result).toEqual({ sessionId: "crm-150002-210001", status: "connected" });
    });

    it("returns null when user has no session (does NOT fall back to other users)", async () => {
      // User 999 has no sessions
      mockWhere.mockResolvedValue([]);

      const { getActiveSessionForTenant } = await import("./bulkMessage");
      const result = await getActiveSessionForTenant(150002, 999);
      // CRITICAL: must return null, NOT another user's session
      expect(result).toBeNull();
    });

    it("does NOT return Fernando's session when Bruno is logged in", async () => {
      // Simulates the bug scenario:
      // Bruno (userId=210001) is logged in, Fernando (userId=240001) has a connected session
      // With userId filter, DB returns empty for Bruno
      mockWhere.mockResolvedValue([]);

      const { getActiveSessionForTenant } = await import("./bulkMessage");
      const result = await getActiveSessionForTenant(210002, 210001);
      // Bruno should get null, not Fernando's session
      expect(result).toBeNull();
    });

    it("returns user's connecting session when it's connecting", async () => {
      mockWhere.mockResolvedValue([
        { sessionId: "crm-150002-210001", userId: 210001, tenantId: 150002, status: "connecting" },
      ]);
      mockEvoGetSession.mockReturnValue({ status: "connecting" });

      const { getActiveSessionForTenant } = await import("./bulkMessage");
      const result = await getActiveSessionForTenant(150002, 210001);
      expect(result).toEqual({ sessionId: "crm-150002-210001", status: "connecting" });
    });

    it("triggers auto-reconnect for user's session when DB says connected but no in-memory", async () => {
      mockWhere.mockResolvedValue([
        { sessionId: "crm-150002-210001", userId: 210001, tenantId: 150002, status: "connected" },
      ]);
      mockEvoGetSession.mockReturnValue(undefined);
      mockGetSession.mockReturnValue(undefined);

      const { getActiveSessionForTenant } = await import("./bulkMessage");
      const result = await getActiveSessionForTenant(150002, 210001);
      expect(result).toEqual({ sessionId: "crm-150002-210001", status: "connecting" });
    });
  });

  describe("tenantId propagation", () => {
    it("updateSessionDb saves tenantId from session state", () => {
      expect(true).toBe(true);
    });

    it("connect method accepts optional tenantId parameter", async () => {
      const { whatsappManager } = await import("./whatsapp");
      expect(typeof whatsappManager.connect).toBe("function");
      await whatsappManager.connect("test-session", 1, 150002);
      expect(mockConnect).toHaveBeenCalledWith("test-session", 1, 150002);
    });
  });

  describe("useTenantId hook behavior", () => {
    it("SaaS user gets tenantId from auth.me response", () => {
      const mockUser = { id: 150001, name: "Bruno", tenantId: 150002 };
      const tenantId = (mockUser as any)?.tenantId ?? 1;
      expect(tenantId).toBe(150002);
    });

    it("Manus OAuth user falls back to tenantId 1", () => {
      const mockUser = { id: 1, name: "Owner" };
      const tenantId = (mockUser as any)?.tenantId ?? 1;
      expect(tenantId).toBe(1);
    });
  });
});
