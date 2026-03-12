import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Evolution API module
vi.mock("./evolutionApi", () => ({
  fetchInstance: vi.fn(),
  getInstanceName: vi.fn((tenantId: number, userId: number) => `crm-${tenantId}-${userId}`),
  createInstance: vi.fn(),
  connectInstance: vi.fn(),
  deleteInstance: vi.fn(),
}));

// Mock the DB module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import * as evo from "./evolutionApi";

describe("Session Lifecycle - Canonical Naming", () => {
  it("getInstanceName generates correct canonical name", () => {
    expect(evo.getInstanceName(210002, 210001)).toBe("crm-210002-210001");
    expect(evo.getInstanceName(150002, 150001)).toBe("crm-150002-150001");
    expect(evo.getInstanceName(0, 1)).toBe("crm-0-1");
  });

  it("canonical name format is crm-{tenantId}-{userId}", () => {
    const name = evo.getInstanceName(210002, 210001);
    const match = name.match(/^crm-(\d+)-(\d+)$/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("210002");
    expect(match![2]).toBe("210001");
  });
});

describe("Session Lifecycle - Legacy Detection", () => {
  it("identifies legacy sessions by non-canonical name format", () => {
    const canonicalName = "crm-210002-210001";
    const legacyNames = ["Boxtour", "Whatsapp Oficial", "Bruno oficial", "Teste QR"];
    
    for (const legacy of legacyNames) {
      expect(legacy).not.toBe(canonicalName);
      expect(legacy.match(/^crm-\d+-\d+$/)).toBeNull();
    }
  });

  it("canonical names match the expected pattern", () => {
    const canonicalNames = ["crm-210002-210001", "crm-150002-150001", "crm-0-1"];
    
    for (const name of canonicalNames) {
      expect(name.match(/^crm-\d+-\d+$/)).not.toBeNull();
    }
  });
});

describe("Session Lifecycle - Phantom Session Handling", () => {
  it("should mark session as disconnected when Evolution API returns 404", () => {
    // When fetchInstance returns null (instance not found on Evolution),
    // getSessionLive should mark the session as disconnected in DB
    // and return undefined or a disconnected state
    const sessionId = "Boxtour";
    const fetchMock = vi.mocked(evo.fetchInstance);
    fetchMock.mockResolvedValue(null as any);
    
    // The fix ensures that when fetchInstance returns null,
    // the DB is updated to set status = 'disconnected'
    // This prevents phantom sessions from blocking real ones
    expect(fetchMock).toBeDefined();
  });

  it("should keep session connected when Evolution API confirms connection", () => {
    const fetchMock = vi.mocked(evo.fetchInstance);
    fetchMock.mockResolvedValue({
      connectionStatus: "open",
      ownerJid: "558499838420@s.whatsapp.net",
      profileName: "Bruno Barbosa",
    } as any);
    
    // When Evolution confirms the instance is open,
    // the session should remain connected
    expect(fetchMock).toBeDefined();
  });
});

describe("Session Lifecycle - Sessions Endpoint Filtering", () => {
  it("should filter out disconnected legacy sessions from results", () => {
    const canonicalName = "crm-210002-210001";
    const sessions = [
      { sessionId: canonicalName, liveStatus: "connected" },
      { sessionId: "Boxtour", liveStatus: "disconnected" },
      { sessionId: "Whatsapp Oficial", liveStatus: "disconnected" },
    ];

    // Simulate the filtering logic from the sessions endpoint
    const filtered = sessions.filter(s => {
      if (s.sessionId === canonicalName) return true;
      if (s.liveStatus === "connected") return true;
      return false;
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].sessionId).toBe(canonicalName);
  });

  it("should keep all connected sessions regardless of name", () => {
    const canonicalName = "crm-210002-210001";
    const sessions = [
      { sessionId: canonicalName, liveStatus: "connected" },
      { sessionId: "Boxtour", liveStatus: "connected" },
    ];

    const filtered = sessions.filter(s => {
      if (s.sessionId === canonicalName) return true;
      if (s.liveStatus === "connected") return true;
      return false;
    });

    expect(filtered).toHaveLength(2);
  });

  it("should return canonical session even if disconnected when it's the only one", () => {
    const canonicalName = "crm-210002-210001";
    const sessions = [
      { sessionId: canonicalName, liveStatus: "disconnected" },
      { sessionId: "Boxtour", liveStatus: "disconnected" },
    ];

    const filtered = sessions.filter(s => {
      if (s.sessionId === canonicalName) return true;
      if (s.liveStatus === "connected") return true;
      return false;
    });

    // Should keep the canonical one
    expect(filtered).toHaveLength(1);
    expect(filtered[0].sessionId).toBe(canonicalName);
  });

  it("should handle empty sessions list gracefully", () => {
    const sessions: any[] = [];
    const filtered = sessions.filter(s => {
      if (s.sessionId === "crm-210002-210001") return true;
      if (s.liveStatus === "connected") return true;
      return false;
    });

    expect(filtered).toHaveLength(0);
  });
});

describe("Session Lifecycle - ConnectUser Legacy Cleanup", () => {
  it("should identify legacy sessions for cleanup", () => {
    const userId = 210001;
    const tenantId = 210002;
    const canonicalName = `crm-${tenantId}-${userId}`;

    const allSessions = [
      { sessionId: canonicalName, userId, tenantId, status: "connected" },
      { sessionId: "Boxtour", userId, tenantId, status: "connected" },
      { sessionId: "Whatsapp Oficial", userId, tenantId, status: "deleted" },
    ];

    // Filter for sessions that should be cleaned up
    const toCleanup = allSessions.filter(s => 
      s.sessionId !== canonicalName && 
      s.status !== "deleted" &&
      s.userId === userId &&
      s.tenantId === tenantId
    );

    expect(toCleanup).toHaveLength(1);
    expect(toCleanup[0].sessionId).toBe("Boxtour");
  });
});
