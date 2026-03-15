import { describe, it, expect } from "vitest";

/**
 * Tests for the Evolution auto-restore filter.
 *
 * Two-layer filter:
 * 1. DB query: only sessions with status = 'connected' are fetched
 * 2. Evolution API check: only instances with connectionStatus = 'open' are restored.
 *    Instances with 'connecting' or 'close' are marked disconnected and skipped.
 *    This prevents QR code generation loops from 'connecting' instances.
 */

// ─── Types ────────────────────────────────────────────────────────

type DbSessionStatus = "connecting" | "connected" | "disconnected" | "deleted";
type EvoConnectionStatus = "open" | "connecting" | "close";

interface DbSession {
  sessionId: string;
  userId: number;
  tenantId: number;
  status: DbSessionStatus;
}

interface EvolutionInstance {
  connectionStatus: EvoConnectionStatus;
  ownerJid: string | null;
  profileName: string | null;
}

// ─── Simulate the two-layer filter ───────────────────────────────

/** Layer 1: DB query — only 'connected' sessions */
function filterDbSessions(sessions: DbSession[]): DbSession[] {
  return sessions.filter(s => s.status === "connected");
}

/** Layer 2: Evolution API check — only 'open' instances get restored */
function shouldRestoreFromEvolution(inst: EvolutionInstance): {
  restore: boolean;
  reason: string;
} {
  if (inst.connectionStatus !== "open") {
    return {
      restore: false,
      reason: `Evolution status '${inst.connectionStatus}', skipping (only 'open' restored)`,
    };
  }
  return { restore: true, reason: "connected" };
}

// ─── Tests ────────────────────────────────────────────────────────

describe("Auto-Restore Filter", () => {
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

  describe("Layer 1: DB session filter (status = 'connected')", () => {
    it("should only select sessions with status 'connected'", () => {
      const filtered = filterDbSessions(allSessions);
      expect(filtered.length).toBe(5);
      expect(filtered.every(s => s.status === "connected")).toBe(true);
    });

    it("should exclude 'disconnected' sessions", () => {
      const filtered = filterDbSessions(allSessions);
      expect(filtered.some(s => s.status === "disconnected")).toBe(false);
    });

    it("should exclude 'connecting' sessions", () => {
      const filtered = filterDbSessions(allSessions);
      expect(filtered.some(s => s.status === "connecting")).toBe(false);
    });

    it("should exclude 'deleted' sessions", () => {
      const filtered = filterDbSessions(allSessions);
      expect(filtered.some(s => s.status === "deleted")).toBe(false);
    });

    it("should return empty when no connected sessions exist", () => {
      const none: DbSession[] = [
        { sessionId: "s1", userId: 1, tenantId: 1, status: "disconnected" },
        { sessionId: "s2", userId: 2, tenantId: 2, status: "connecting" },
      ];
      expect(filterDbSessions(none).length).toBe(0);
    });
  });

  describe("Layer 2: Evolution connectionStatus filter (only 'open')", () => {
    it("should restore instance with connectionStatus 'open'", () => {
      const inst: EvolutionInstance = { connectionStatus: "open", ownerJid: "jid@s.whatsapp.net", profileName: "User" };
      const result = shouldRestoreFromEvolution(inst);
      expect(result.restore).toBe(true);
    });

    it("should SKIP instance with connectionStatus 'connecting' (causes QR loop)", () => {
      const inst: EvolutionInstance = { connectionStatus: "connecting", ownerJid: "jid@s.whatsapp.net", profileName: "User" };
      const result = shouldRestoreFromEvolution(inst);
      expect(result.restore).toBe(false);
      expect(result.reason).toContain("connecting");
    });

    it("should SKIP instance with connectionStatus 'close'", () => {
      const inst: EvolutionInstance = { connectionStatus: "close", ownerJid: "jid@s.whatsapp.net", profileName: "User" };
      const result = shouldRestoreFromEvolution(inst);
      expect(result.restore).toBe(false);
      expect(result.reason).toContain("close");
    });

    it("should SKIP 'connecting' even with valid ownerJid", () => {
      const inst: EvolutionInstance = { connectionStatus: "connecting", ownerJid: "5511999@s.whatsapp.net", profileName: "Valid User" };
      const result = shouldRestoreFromEvolution(inst);
      expect(result.restore).toBe(false);
    });

    it("should SKIP 'close' even with valid ownerJid", () => {
      const inst: EvolutionInstance = { connectionStatus: "close", ownerJid: "5511999@s.whatsapp.net", profileName: "Valid User" };
      const result = shouldRestoreFromEvolution(inst);
      expect(result.restore).toBe(false);
    });

    it("should restore 'open' even without ownerJid (edge case)", () => {
      const inst: EvolutionInstance = { connectionStatus: "open", ownerJid: null, profileName: null };
      const result = shouldRestoreFromEvolution(inst);
      expect(result.restore).toBe(true);
    });
  });

  describe("Combined two-layer filter (real scenario)", () => {
    // Simulate: 5 sessions pass DB filter, then Evolution API returns mixed statuses
    const evolutionResponses: Record<string, EvolutionInstance> = {
      "crm-240005-240005": { connectionStatus: "open", ownerJid: "jid1", profileName: "User1" },
      "crm-240006-240006": { connectionStatus: "open", ownerJid: "jid2", profileName: "User2" },
      "crm-240007-240007": { connectionStatus: "connecting", ownerJid: "jid3", profileName: "User3" },
      "crm-240010-240010": { connectionStatus: "close", ownerJid: "jid4", profileName: "User4" },
      "crm-270008-270062": { connectionStatus: "open", ownerJid: "jid5", profileName: "User5" },
    };

    it("should pass 5 sessions through DB filter", () => {
      const dbFiltered = filterDbSessions(allSessions);
      expect(dbFiltered.length).toBe(5);
    });

    it("should only restore 3 of 5 after Evolution check (open only)", () => {
      const dbFiltered = filterDbSessions(allSessions);
      const restored = dbFiltered.filter(s => {
        const inst = evolutionResponses[s.sessionId];
        return inst && shouldRestoreFromEvolution(inst).restore;
      });
      expect(restored.length).toBe(3);
      expect(restored.map(s => s.sessionId).sort()).toEqual([
        "crm-240005-240005",
        "crm-240006-240006",
        "crm-270008-270062",
      ]);
    });

    it("should skip crm-240007-240007 (Evolution status 'connecting')", () => {
      const inst = evolutionResponses["crm-240007-240007"];
      expect(shouldRestoreFromEvolution(inst).restore).toBe(false);
    });

    it("should skip crm-240010-240010 (Evolution status 'close')", () => {
      const inst = evolutionResponses["crm-240010-240010"];
      expect(shouldRestoreFromEvolution(inst).restore).toBe(false);
    });
  });

  describe("Real production instance names", () => {
    const shouldBeRestored = ["crm-240006-240006", "crm-240007-240007", "crm-240010-240010", "crm-270008-270062"];
    const shouldBeExcludedFromDb = ["crm-0-1", "crm-210002-240001", "crm-150002-150001", "crm-240005-270063"];

    for (const name of shouldBeExcludedFromDb) {
      it(`should exclude ${name} at DB layer (not 'connected')`, () => {
        const filtered = filterDbSessions(allSessions);
        expect(filtered.some(s => s.sessionId === name)).toBe(false);
      });
    }

    for (const name of shouldBeRestored) {
      it(`should include ${name} at DB layer (was 'connected')`, () => {
        const filtered = filterDbSessions(allSessions);
        expect(filtered.some(s => s.sessionId === name)).toBe(true);
      });
    }
  });
});
