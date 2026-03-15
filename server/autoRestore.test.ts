import { describe, it, expect } from "vitest";

/**
 * Tests for the Evolution auto-restore and periodic sync filters.
 *
 * Three layers of protection:
 * 1. autoRestoreSessions: DB query filters status='connected' only
 * 2. autoRestoreSessions + periodicSyncCheck: Evolution API check accepts ONLY connectionStatus='open'
 *    - 'connecting', 'close', 'qrcode' are all skipped and marked 'disconnected'
 * 3. periodicSyncCheck: 5-minute timeout for sessions stuck in 'connecting'
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

interface InMemorySession {
  sessionId: string;
  status: "connecting" | "connected" | "disconnected" | "reconnecting";
  connectingStartedAt: number | null;
}

// ─── Simulate the filter logic ───────────────────────────────────

/** Layer 1: DB query — only 'connected' sessions (used by autoRestore AND periodicSyncCheck) */
function filterDbSessions(sessions: DbSession[]): DbSession[] {
  return sessions.filter(s => s.status === "connected");
}

/** Layer 2: Evolution API check — ONLY 'open' instances get restored/synced */
function shouldProcessInstance(inst: EvolutionInstance): {
  process: boolean;
  reason: string;
} {
  if (inst.connectionStatus !== "open") {
    return {
      process: false,
      reason: `Evolution status '${inst.connectionStatus}', marking disconnected`,
    };
  }
  return { process: true, reason: "open — processing" };
}

/** Layer 3: 5-minute timeout for stuck 'connecting' sessions */
function checkConnectingTimeout(
  session: InMemorySession,
  now: number,
  timeoutMs: number = 5 * 60 * 1000
): { timedOut: boolean; elapsedMs: number } {
  if (session.status !== "connecting" || !session.connectingStartedAt) {
    return { timedOut: false, elapsedMs: 0 };
  }
  const elapsed = now - session.connectingStartedAt;
  return { timedOut: elapsed > timeoutMs, elapsedMs: elapsed };
}

// ─── Tests ────────────────────────────────────────────────────────

describe("Auto-Restore & Periodic Sync Filters", () => {
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

  describe("Layer 1: DB filter (status = 'connected' only)", () => {
    it("should only select sessions with status 'connected'", () => {
      const filtered = filterDbSessions(allSessions);
      expect(filtered.length).toBe(5);
      expect(filtered.every(s => s.status === "connected")).toBe(true);
    });

    it("should exclude 'disconnected' sessions", () => {
      expect(filterDbSessions(allSessions).some(s => s.status === "disconnected")).toBe(false);
    });

    it("should exclude 'connecting' sessions", () => {
      expect(filterDbSessions(allSessions).some(s => s.status === "connecting")).toBe(false);
    });

    it("should exclude 'deleted' sessions", () => {
      expect(filterDbSessions(allSessions).some(s => s.status === "deleted")).toBe(false);
    });

    it("should return empty when no connected sessions exist", () => {
      const none: DbSession[] = [
        { sessionId: "s1", userId: 1, tenantId: 1, status: "disconnected" },
        { sessionId: "s2", userId: 2, tenantId: 2, status: "connecting" },
      ];
      expect(filterDbSessions(none).length).toBe(0);
    });
  });

  describe("Layer 2: Evolution connectionStatus filter (ONLY 'open')", () => {
    it("should process instance with connectionStatus 'open'", () => {
      const inst: EvolutionInstance = { connectionStatus: "open", ownerJid: "jid@s.whatsapp.net", profileName: "User" };
      expect(shouldProcessInstance(inst).process).toBe(true);
    });

    it("should REJECT instance with connectionStatus 'connecting'", () => {
      const inst: EvolutionInstance = { connectionStatus: "connecting", ownerJid: "jid@s.whatsapp.net", profileName: "User" };
      const result = shouldProcessInstance(inst);
      expect(result.process).toBe(false);
      expect(result.reason).toContain("connecting");
    });

    it("should REJECT instance with connectionStatus 'close'", () => {
      const inst: EvolutionInstance = { connectionStatus: "close", ownerJid: "jid@s.whatsapp.net", profileName: "User" };
      const result = shouldProcessInstance(inst);
      expect(result.process).toBe(false);
      expect(result.reason).toContain("close");
    });

    it("should REJECT 'connecting' even with valid ownerJid and profileName", () => {
      const inst: EvolutionInstance = { connectionStatus: "connecting", ownerJid: "5511999@s.whatsapp.net", profileName: "Valid User" };
      expect(shouldProcessInstance(inst).process).toBe(false);
    });

    it("should REJECT 'close' even with valid ownerJid and profileName", () => {
      const inst: EvolutionInstance = { connectionStatus: "close", ownerJid: "5511999@s.whatsapp.net", profileName: "Valid User" };
      expect(shouldProcessInstance(inst).process).toBe(false);
    });

    it("should process 'open' even without ownerJid (edge case)", () => {
      const inst: EvolutionInstance = { connectionStatus: "open", ownerJid: null, profileName: null };
      expect(shouldProcessInstance(inst).process).toBe(true);
    });
  });

  describe("Layer 3: 5-minute connecting timeout", () => {
    const FIVE_MINUTES = 5 * 60 * 1000;

    it("should NOT timeout session that just started connecting", () => {
      const session: InMemorySession = {
        sessionId: "crm-test-1",
        status: "connecting",
        connectingStartedAt: Date.now() - 30_000, // 30 seconds ago
      };
      const result = checkConnectingTimeout(session, Date.now());
      expect(result.timedOut).toBe(false);
    });

    it("should NOT timeout session connecting for exactly 4 minutes", () => {
      const now = Date.now();
      const session: InMemorySession = {
        sessionId: "crm-test-2",
        status: "connecting",
        connectingStartedAt: now - (4 * 60 * 1000),
      };
      const result = checkConnectingTimeout(session, now);
      expect(result.timedOut).toBe(false);
    });

    it("should timeout session connecting for 6 minutes", () => {
      const now = Date.now();
      const session: InMemorySession = {
        sessionId: "crm-test-3",
        status: "connecting",
        connectingStartedAt: now - (6 * 60 * 1000),
      };
      const result = checkConnectingTimeout(session, now);
      expect(result.timedOut).toBe(true);
      expect(result.elapsedMs).toBeGreaterThan(FIVE_MINUTES);
    });

    it("should timeout session connecting for 10 minutes", () => {
      const now = Date.now();
      const session: InMemorySession = {
        sessionId: "crm-test-4",
        status: "connecting",
        connectingStartedAt: now - (10 * 60 * 1000),
      };
      const result = checkConnectingTimeout(session, now);
      expect(result.timedOut).toBe(true);
    });

    it("should NOT timeout session that is already connected", () => {
      const session: InMemorySession = {
        sessionId: "crm-test-5",
        status: "connected",
        connectingStartedAt: Date.now() - (10 * 60 * 1000), // old timestamp
      };
      const result = checkConnectingTimeout(session, Date.now());
      expect(result.timedOut).toBe(false);
    });

    it("should NOT timeout session with null connectingStartedAt", () => {
      const session: InMemorySession = {
        sessionId: "crm-test-6",
        status: "connecting",
        connectingStartedAt: null,
      };
      const result = checkConnectingTimeout(session, Date.now());
      expect(result.timedOut).toBe(false);
    });

    it("should NOT timeout disconnected session", () => {
      const session: InMemorySession = {
        sessionId: "crm-test-7",
        status: "disconnected",
        connectingStartedAt: Date.now() - (10 * 60 * 1000),
      };
      const result = checkConnectingTimeout(session, Date.now());
      expect(result.timedOut).toBe(false);
    });
  });

  describe("Combined: periodicSyncCheck behavior", () => {
    // Simulate: 5 sessions pass DB filter, Evolution returns mixed statuses
    const evolutionResponses: Record<string, EvolutionInstance> = {
      "crm-240005-240005": { connectionStatus: "open", ownerJid: "jid1", profileName: "User1" },
      "crm-240006-240006": { connectionStatus: "open", ownerJid: "jid2", profileName: "User2" },
      "crm-240007-240007": { connectionStatus: "connecting", ownerJid: "jid3", profileName: "User3" },
      "crm-240010-240010": { connectionStatus: "close", ownerJid: "jid4", profileName: "User4" },
      "crm-270008-270062": { connectionStatus: "open", ownerJid: "jid5", profileName: "User5" },
    };

    it("should pass 5 sessions through DB filter", () => {
      expect(filterDbSessions(allSessions).length).toBe(5);
    });

    it("should only sync 3 of 5 after Evolution check (open only)", () => {
      const dbFiltered = filterDbSessions(allSessions);
      const synced = dbFiltered.filter(s => {
        const inst = evolutionResponses[s.sessionId];
        return inst && shouldProcessInstance(inst).process;
      });
      expect(synced.length).toBe(3);
      expect(synced.map(s => s.sessionId).sort()).toEqual([
        "crm-240005-240005",
        "crm-240006-240006",
        "crm-270008-270062",
      ]);
    });

    it("should mark crm-240007-240007 as disconnected (Evolution 'connecting')", () => {
      const inst = evolutionResponses["crm-240007-240007"];
      expect(shouldProcessInstance(inst).process).toBe(false);
    });

    it("should mark crm-240010-240010 as disconnected (Evolution 'close')", () => {
      const inst = evolutionResponses["crm-240010-240010"];
      expect(shouldProcessInstance(inst).process).toBe(false);
    });

    it("periodicSyncCheck should NOT reconnect disconnected sessions from DB", () => {
      // The key fix: periodicSyncCheck now queries status='connected' only,
      // so disconnected sessions are never even checked against Evolution API
      const disconnectedInDb = allSessions.filter(s => s.status === "disconnected");
      const wouldBeQueried = filterDbSessions(allSessions);
      for (const disc of disconnectedInDb) {
        expect(wouldBeQueried.some(q => q.sessionId === disc.sessionId)).toBe(false);
      }
    });
  });

  describe("Real production instance names", () => {
    const shouldBeExcludedFromDb = [
      "crm-0-1", "crm-210002-240001", "crm-150002-150001", "crm-240005-270063",
    ];

    for (const name of shouldBeExcludedFromDb) {
      it(`should exclude ${name} at DB layer (not 'connected')`, () => {
        expect(filterDbSessions(allSessions).some(s => s.sessionId === name)).toBe(false);
      });
    }
  });
});
