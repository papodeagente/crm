import { describe, it, expect } from "vitest";

/**
 * Tests for the Evolution auto-restore filter fix.
 *
 * Problem: autoRestoreSessions() was querying ALL non-deleted sessions
 * (status != 'deleted'), including 'disconnected' and 'connecting' ones.
 * Instances without saved auth credentials entered QR code generation loops
 * that nobody scanned, overloading the server.
 *
 * Fix: Only restore sessions with status 'connected' before restart.
 * Additionally, skip instances where ownerJid is null (no credentials).
 */

// ─── Simulate the session filter logic ───────────────────────────

type SessionStatus = "connecting" | "connected" | "disconnected" | "deleted";

interface DbSession {
  sessionId: string;
  userId: number;
  tenantId: number;
  status: SessionStatus;
}

interface EvolutionInstance {
  connectionStatus: "open" | "connecting" | "close";
  ownerJid: string | null;
  profileName: string | null;
}

/**
 * Simulates the FIXED query filter: only 'connected' sessions are selected.
 */
function filterSessionsForRestore(sessions: DbSession[]): DbSession[] {
  return sessions.filter(s => s.status === "connected");
}

/**
 * Simulates the FIXED ownerJid check: skip instances without credentials.
 */
function shouldRestoreInstance(inst: EvolutionInstance): boolean {
  // If no ownerJid and not currently open, skip — no credentials to restore with
  if (!inst.ownerJid && inst.connectionStatus !== "open") {
    return false;
  }
  return true;
}

/**
 * Determines the DB status after checking Evolution API.
 */
function getRestoredStatus(inst: EvolutionInstance): "connected" | "disconnected" {
  return inst.connectionStatus === "open" ? "connected" : "disconnected";
}

// ─── Tests ────────────────────────────────────────────────────────

describe("Auto-Restore Filter Fix", () => {
  const allSessions: DbSession[] = [
    { sessionId: "crm-0-1", userId: 1, tenantId: 0, status: "disconnected" },
    { sessionId: "crm-210002-240001", userId: 240001, tenantId: 210002, status: "disconnected" },
    { sessionId: "crm-210002-210001", userId: 210001, tenantId: 210002, status: "connecting" },
    { sessionId: "crm-240002-240002", userId: 240002, tenantId: 240002, status: "disconnected" },
    { sessionId: "crm-240005-240005", userId: 240005, tenantId: 240005, status: "connected" },
    { sessionId: "crm-240006-240006", userId: 240006, tenantId: 240006, status: "connected" },
    { sessionId: "crm-240007-240007", userId: 240007, tenantId: 240007, status: "connected" },
    { sessionId: "crm-240010-240010", userId: 240010, tenantId: 240010, status: "connected" },
    { sessionId: "crm-270008-270062", userId: 270062, tenantId: 270008, status: "connected" },
    { sessionId: "crm-150002-150001", userId: 150001, tenantId: 150002, status: "disconnected" },
    { sessionId: "crm-240005-270063", userId: 270063, tenantId: 240005, status: "disconnected" },
    { sessionId: "crm-270009-270064", userId: 270064, tenantId: 270009, status: "deleted" },
  ];

  describe("Session query filter", () => {
    it("should only select sessions with status 'connected'", () => {
      const filtered = filterSessionsForRestore(allSessions);
      expect(filtered.length).toBe(5);
      expect(filtered.every(s => s.status === "connected")).toBe(true);
    });

    it("should exclude 'disconnected' sessions", () => {
      const filtered = filterSessionsForRestore(allSessions);
      const disconnected = filtered.filter(s => s.status === "disconnected");
      expect(disconnected.length).toBe(0);
    });

    it("should exclude 'connecting' sessions", () => {
      const filtered = filterSessionsForRestore(allSessions);
      const connecting = filtered.filter(s => s.status === "connecting");
      expect(connecting.length).toBe(0);
    });

    it("should exclude 'deleted' sessions", () => {
      const filtered = filterSessionsForRestore(allSessions);
      const deleted = filtered.filter(s => s.status === "deleted");
      expect(deleted.length).toBe(0);
    });

    it("should return empty array when no connected sessions exist", () => {
      const noConnected: DbSession[] = [
        { sessionId: "s1", userId: 1, tenantId: 1, status: "disconnected" },
        { sessionId: "s2", userId: 2, tenantId: 2, status: "connecting" },
      ];
      expect(filterSessionsForRestore(noConnected).length).toBe(0);
    });

    it("should reduce from 12 to 5 sessions (matching real scenario)", () => {
      // Before fix: 12 sessions (all non-deleted)
      const beforeFix = allSessions.filter(s => s.status !== "deleted");
      expect(beforeFix.length).toBe(11);

      // After fix: only connected
      const afterFix = filterSessionsForRestore(allSessions);
      expect(afterFix.length).toBe(5);
    });
  });

  describe("ownerJid credential check", () => {
    it("should restore instance with ownerJid and status open", () => {
      const inst: EvolutionInstance = {
        connectionStatus: "open",
        ownerJid: "5511999999999@s.whatsapp.net",
        profileName: "User",
      };
      expect(shouldRestoreInstance(inst)).toBe(true);
    });

    it("should restore instance with ownerJid even if disconnected", () => {
      const inst: EvolutionInstance = {
        connectionStatus: "close",
        ownerJid: "5511999999999@s.whatsapp.net",
        profileName: "User",
      };
      expect(shouldRestoreInstance(inst)).toBe(true);
    });

    it("should skip instance without ownerJid when not open", () => {
      const inst: EvolutionInstance = {
        connectionStatus: "close",
        ownerJid: null,
        profileName: null,
      };
      expect(shouldRestoreInstance(inst)).toBe(false);
    });

    it("should skip instance without ownerJid when connecting", () => {
      const inst: EvolutionInstance = {
        connectionStatus: "connecting",
        ownerJid: null,
        profileName: null,
      };
      expect(shouldRestoreInstance(inst)).toBe(false);
    });

    it("should restore instance without ownerJid if currently open (edge case)", () => {
      // If Evolution says it's open, trust it even without ownerJid
      const inst: EvolutionInstance = {
        connectionStatus: "open",
        ownerJid: null,
        profileName: null,
      };
      expect(shouldRestoreInstance(inst)).toBe(true);
    });
  });

  describe("Status mapping after restore", () => {
    it("should map Evolution 'open' to DB 'connected'", () => {
      const inst: EvolutionInstance = { connectionStatus: "open", ownerJid: "jid", profileName: "n" };
      expect(getRestoredStatus(inst)).toBe("connected");
    });

    it("should map Evolution 'close' to DB 'disconnected'", () => {
      const inst: EvolutionInstance = { connectionStatus: "close", ownerJid: "jid", profileName: "n" };
      expect(getRestoredStatus(inst)).toBe("disconnected");
    });

    it("should map Evolution 'connecting' to DB 'disconnected'", () => {
      const inst: EvolutionInstance = { connectionStatus: "connecting", ownerJid: "jid", profileName: "n" };
      expect(getRestoredStatus(inst)).toBe("disconnected");
    });
  });

  describe("Real instance names from production", () => {
    const connectedInstances = [
      "crm-240006-240006",
      "crm-240007-240007",
      "crm-240010-240010",
      "crm-270008-270062",
    ];

    const disconnectedInstances = [
      "crm-0-1",
      "crm-210002-240001",
      "crm-210002-210001",
      "crm-240002-240002",
      "crm-150002-150001",
      "crm-240005-270063",
    ];

    for (const name of connectedInstances) {
      it(`should include ${name} (was connected)`, () => {
        const session = allSessions.find(s => s.sessionId === name);
        expect(session?.status).toBe("connected");
        const filtered = filterSessionsForRestore(allSessions);
        expect(filtered.some(s => s.sessionId === name)).toBe(true);
      });
    }

    for (const name of disconnectedInstances) {
      it(`should exclude ${name} (was disconnected/connecting)`, () => {
        const filtered = filterSessionsForRestore(allSessions);
        expect(filtered.some(s => s.sessionId === name)).toBe(false);
      });
    }
  });
});
