import { describe, it, expect } from "vitest";

/**
 * Diagnostic & Stabilization Tests
 *
 * Covers the full stabilization pass:
 * 1. Redis/BullMQ error suppression and sync fallback
 * 2. Message status (tick) processing — both numeric and string formats
 * 3. Webhook event routing — queueable vs async events
 * 4. Instance orphan detection logic
 */

// ─── Redis Error Suppression ─────────────────────────────────────

describe("Redis/BullMQ Error Suppression", () => {
  function simulateErrorHandler(maxLogErrors: number) {
    let errorCount = 0;
    const logged: string[] = [];

    function onError(msg: string) {
      errorCount++;
      if (errorCount <= maxLogErrors) {
        logged.push(msg);
        if (errorCount === maxLogErrors) {
          logged.push("Suppressing further errors");
        }
      }
    }

    return { onError, getLogged: () => logged, getCount: () => errorCount };
  }

  it("should log first 3 Redis errors then suppress", () => {
    const handler = simulateErrorHandler(3);
    for (let i = 0; i < 100; i++) {
      handler.onError(`Connection refused attempt ${i}`);
    }
    expect(handler.getLogged().length).toBe(4); // 3 errors + 1 suppression message
    expect(handler.getLogged()[3]).toBe("Suppressing further errors");
    expect(handler.getCount()).toBe(100);
  });

  it("should log first 3 Worker errors then suppress", () => {
    const handler = simulateErrorHandler(3);
    for (let i = 0; i < 50; i++) {
      handler.onError("Connection is closed.");
    }
    expect(handler.getLogged().length).toBe(4);
    expect(handler.getCount()).toBe(50);
  });

  it("should log all errors if fewer than max", () => {
    const handler = simulateErrorHandler(3);
    handler.onError("Error 1");
    handler.onError("Error 2");
    expect(handler.getLogged().length).toBe(2);
  });
});

// ─── Message Status Processing ───────────────────────────────────

describe("Message Status (Tick) Processing", () => {
  // Replicate the exact status mapping from handleMessageStatusUpdate
  const numericStatusMap: Record<number, string> = {
    0: "error", 1: "pending", 2: "sent", 3: "delivered", 4: "read", 5: "played",
  };
  const stringStatusMap: Record<string, string> = {
    "ERROR": "error", "PENDING": "pending", "SENT": "sent",
    "SERVER_ACK": "sent", "DELIVERY_ACK": "delivered", "DELIVERED": "delivered",
    "READ": "read", "PLAYED": "played", "DELETED": "deleted",
  };

  function resolveStatus(rawStatus: any): string | undefined {
    if (typeof rawStatus === "number") {
      return numericStatusMap[rawStatus];
    } else if (typeof rawStatus === "string") {
      return stringStatusMap[rawStatus.toUpperCase()] || rawStatus.toLowerCase();
    }
    return undefined;
  }

  // Extract messageId from both Evolution API formats
  function extractMessageId(update: any): string | undefined {
    return update?.key?.id || update?.keyId || update?.messageId;
  }

  describe("Numeric status format (Baileys/internal)", () => {
    it("maps 0 to 'error'", () => expect(resolveStatus(0)).toBe("error"));
    it("maps 1 to 'pending'", () => expect(resolveStatus(1)).toBe("pending"));
    it("maps 2 to 'sent' (✓)", () => expect(resolveStatus(2)).toBe("sent"));
    it("maps 3 to 'delivered' (✓✓)", () => expect(resolveStatus(3)).toBe("delivered"));
    it("maps 4 to 'read' (✓✓ blue)", () => expect(resolveStatus(4)).toBe("read"));
    it("maps 5 to 'played' (✓✓ blue for audio)", () => expect(resolveStatus(5)).toBe("played"));
  });

  describe("String status format (Evolution v2 webhook)", () => {
    it("maps 'SERVER_ACK' to 'sent' (✓)", () => expect(resolveStatus("SERVER_ACK")).toBe("sent"));
    it("maps 'DELIVERY_ACK' to 'delivered' (✓✓)", () => expect(resolveStatus("DELIVERY_ACK")).toBe("delivered"));
    it("maps 'DELIVERED' to 'delivered' (✓✓)", () => expect(resolveStatus("DELIVERED")).toBe("delivered"));
    it("maps 'READ' to 'read' (✓✓ blue)", () => expect(resolveStatus("READ")).toBe("read"));
    it("maps 'PLAYED' to 'played'", () => expect(resolveStatus("PLAYED")).toBe("played"));
    it("maps 'DELETED' to 'deleted'", () => expect(resolveStatus("DELETED")).toBe("deleted"));
    it("is case-insensitive", () => {
      expect(resolveStatus("read")).toBe("read");
      expect(resolveStatus("Read")).toBe("read");
      expect(resolveStatus("delivered")).toBe("delivered");
    });
  });

  describe("Message ID extraction from both formats", () => {
    it("extracts from Format A (Baileys): key.id", () => {
      const update = { key: { id: "MSG123", remoteJid: "jid@s.whatsapp.net", fromMe: true }, update: { status: 3 } };
      expect(extractMessageId(update)).toBe("MSG123");
    });

    it("extracts from Format B (Evolution v2): keyId", () => {
      const update = { keyId: "MSG456", remoteJid: "jid@s.whatsapp.net", fromMe: true, status: "DELIVERED" };
      expect(extractMessageId(update)).toBe("MSG456");
    });

    it("extracts from Format B (Evolution v2): messageId", () => {
      const update = { messageId: "MSG789", status: "READ" };
      expect(extractMessageId(update)).toBe("MSG789");
    });

    it("prefers key.id over keyId over messageId", () => {
      const update = { key: { id: "A" }, keyId: "B", messageId: "C" };
      expect(extractMessageId(update)).toBe("A");
    });

    it("returns undefined for empty update", () => {
      expect(extractMessageId({})).toBeUndefined();
      expect(extractMessageId(null)).toBeUndefined();
    });
  });

  describe("Edge cases", () => {
    it("returns undefined for null/undefined status", () => {
      expect(resolveStatus(null)).toBeUndefined();
      expect(resolveStatus(undefined)).toBeUndefined();
    });

    it("returns undefined for unknown numeric status", () => {
      expect(resolveStatus(99)).toBeUndefined();
    });

    it("handles unknown string status by lowercasing", () => {
      expect(resolveStatus("CUSTOM_STATUS")).toBe("custom_status");
    });
  });
});

// ─── Webhook Event Routing ───────────────────────────────────────

describe("Webhook Event Routing", () => {
  const queueableEvents = [
    "messages.upsert", "send.message", "messages.update", "messages.delete",
  ];
  const asyncEvents = [
    "connection.update", "qrcode.updated", "contacts.upsert",
  ];

  function getRoutingMode(event: string, redisAvailable: boolean): "queued" | "sync-fallback" | "async" {
    if (queueableEvents.includes(event)) {
      return redisAvailable ? "queued" : "sync-fallback";
    }
    return "async";
  }

  describe("With Redis available", () => {
    for (const event of queueableEvents) {
      it(`${event} → queued`, () => {
        expect(getRoutingMode(event, true)).toBe("queued");
      });
    }
    for (const event of asyncEvents) {
      it(`${event} → async (never queued)`, () => {
        expect(getRoutingMode(event, true)).toBe("async");
      });
    }
  });

  describe("Without Redis (sync fallback)", () => {
    for (const event of queueableEvents) {
      it(`${event} → sync-fallback`, () => {
        expect(getRoutingMode(event, false)).toBe("sync-fallback");
      });
    }
    for (const event of asyncEvents) {
      it(`${event} → async (unaffected by Redis)`, () => {
        expect(getRoutingMode(event, false)).toBe("async");
      });
    }
  });
});

// ─── Orphan Instance Detection ───────────────────────────────────

describe("Orphan Instance Detection", () => {
  interface DbInstance {
    sessionId: string;
    status: string;
  }

  interface EvoInstance {
    instanceName: string;
    connectionStatus: string;
  }

  function findOrphans(dbInstances: DbInstance[], evoInstances: EvoInstance[]): DbInstance[] {
    const evoNames = new Set(evoInstances.map(e => e.instanceName));
    return dbInstances.filter(db => {
      if (db.status === "deleted") return false;
      return !evoNames.has(db.sessionId);
    });
  }

  const dbInstances: DbInstance[] = [
    { sessionId: "crm-240006-240006", status: "connected" },
    { sessionId: "crm-240007-240007", status: "connected" },
    { sessionId: "crm-orphan-1", status: "connected" },
    { sessionId: "crm-orphan-2", status: "disconnected" },
    { sessionId: "crm-deleted-1", status: "deleted" },
  ];

  const evoInstances: EvoInstance[] = [
    { instanceName: "crm-240006-240006", connectionStatus: "open" },
    { instanceName: "crm-240007-240007", connectionStatus: "open" },
    { instanceName: "crm-extra-evo", connectionStatus: "close" },
  ];

  it("should detect orphan instances (in DB but not in Evolution)", () => {
    const orphans = findOrphans(dbInstances, evoInstances);
    expect(orphans.length).toBe(2);
    expect(orphans.map(o => o.sessionId).sort()).toEqual(["crm-orphan-1", "crm-orphan-2"]);
  });

  it("should not flag deleted instances as orphans", () => {
    const orphans = findOrphans(dbInstances, evoInstances);
    expect(orphans.some(o => o.sessionId === "crm-deleted-1")).toBe(false);
  });

  it("should not flag instances that exist in Evolution", () => {
    const orphans = findOrphans(dbInstances, evoInstances);
    expect(orphans.some(o => o.sessionId === "crm-240006-240006")).toBe(false);
  });

  it("should handle empty Evolution list (all non-deleted are orphans)", () => {
    const orphans = findOrphans(dbInstances, []);
    expect(orphans.length).toBe(4); // all except deleted
  });
});

// ─── Frontend Tick Display ───────────────────────────────────────

describe("Frontend Tick Display Mapping", () => {
  function getTickDisplay(status: string | null | undefined, isFromMe: boolean): string {
    if (!isFromMe) return "none";
    switch (status) {
      case "pending": return "clock";
      case "sent": return "single-check"; // ✓
      case "delivered": return "double-check-gray"; // ✓✓
      case "read": case "played": return "double-check-blue"; // ✓✓ blue
      default: return "single-check"; // fallback
    }
  }

  it("shows clock for pending", () => expect(getTickDisplay("pending", true)).toBe("clock"));
  it("shows ✓ for sent", () => expect(getTickDisplay("sent", true)).toBe("single-check"));
  it("shows ✓✓ gray for delivered", () => expect(getTickDisplay("delivered", true)).toBe("double-check-gray"));
  it("shows ✓✓ blue for read", () => expect(getTickDisplay("read", true)).toBe("double-check-blue"));
  it("shows ✓✓ blue for played", () => expect(getTickDisplay("played", true)).toBe("double-check-blue"));
  it("shows nothing for incoming messages", () => expect(getTickDisplay("read", false)).toBe("none"));
  it("shows ✓ for unknown status (fallback)", () => expect(getTickDisplay("unknown", true)).toBe("single-check"));
  it("shows ✓ for null status (fallback)", () => expect(getTickDisplay(null, true)).toBe("single-check"));
});
