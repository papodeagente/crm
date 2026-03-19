import { describe, it, expect, vi } from "vitest";

/**
 * Tests for conversation status tick fixes.
 * 
 * These tests verify the logic that determines how status ticks are displayed
 * in the conversation sidebar preview. The key rules:
 * 
 * 1. New outgoing messages RESET lastStatus to msg.status (typically "sent")
 * 2. Status updates for OLD messages are ignored if _lastOutgoingMessageId doesn't match
 * 3. Status progression is monotonic: sent → delivered → read → played
 * 4. Incoming messages set lastStatus to "received"
 */

// ── Status order helper (mirrors frontend getStatusOrder) ──
function getStatusOrder(status: string | null | undefined): number {
  switch (status) {
    case "error": return 0;
    case "pending": return 1;
    case "sending": return 2;
    case "sent": return 3;
    case "delivered": return 4;
    case "read": return 5;
    case "played": return 6;
    default: return -1;
  }
}

function maxStatus(a: string | null | undefined, b: string | null | undefined): string | null {
  const orderA = getStatusOrder(a);
  const orderB = getStatusOrder(b);
  if (orderA >= orderB) return a ?? null;
  return b ?? null;
}

// ── Simplified ConvEntry for testing ──
interface TestConvEntry {
  lastFromMe: boolean | number;
  lastStatus: string | null;
  _lastOutgoingMessageId?: string;
  _optimistic?: boolean;
  _localTimestamp?: number;
}

// ── handleMessage logic (simplified) ──
function computeNewStatus(
  existing: TestConvEntry,
  msg: { fromMe: boolean; status?: string; messageId?: string },
  isWebhookEcho: boolean
): { lastStatus: string | null; _lastOutgoingMessageId?: string } {
  if (isWebhookEcho) {
    // Webhook echo: use maxStatus (same message, keep higher)
    const resolvedStatus = maxStatus(existing.lastStatus, msg.status || "sent") || "sent";
    return {
      lastStatus: resolvedStatus,
      _lastOutgoingMessageId: msg.messageId || existing._lastOutgoingMessageId,
    };
  }

  if (msg.fromMe) {
    // NEW outgoing message: RESET to msg.status (not maxStatus)
    return {
      lastStatus: msg.status || "sent",
      _lastOutgoingMessageId: msg.messageId || existing._lastOutgoingMessageId,
    };
  }

  // Incoming message
  return {
    lastStatus: "received",
    _lastOutgoingMessageId: existing._lastOutgoingMessageId,
  };
}

// ── handleStatusUpdate logic (simplified) ──
function shouldApplyStatusUpdate(
  existing: TestConvEntry,
  update: { status: string; messageId?: string }
): boolean {
  const isFromMe = existing.lastFromMe === true || existing.lastFromMe === 1;
  if (!isFromMe) return false;

  // Check messageId match
  if (existing._lastOutgoingMessageId && update.messageId &&
      existing._lastOutgoingMessageId !== update.messageId) {
    return false;
  }

  // Monotonic check
  const currentOrder = getStatusOrder(existing.lastStatus);
  const newOrder = getStatusOrder(update.status);
  return newOrder > currentOrder;
}

describe("Conversation Status Ticks", () => {
  describe("getStatusOrder", () => {
    it("returns correct order for all statuses", () => {
      expect(getStatusOrder("error")).toBe(0);
      expect(getStatusOrder("pending")).toBe(1);
      expect(getStatusOrder("sending")).toBe(2);
      expect(getStatusOrder("sent")).toBe(3);
      expect(getStatusOrder("delivered")).toBe(4);
      expect(getStatusOrder("read")).toBe(5);
      expect(getStatusOrder("played")).toBe(6);
    });

    it("returns -1 for unknown statuses", () => {
      expect(getStatusOrder(null)).toBe(-1);
      expect(getStatusOrder(undefined)).toBe(-1);
      expect(getStatusOrder("unknown")).toBe(-1);
    });
  });

  describe("computeNewStatus - New outgoing message", () => {
    it("resets lastStatus to 'sent' for new outgoing message (not maxStatus)", () => {
      const existing: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "read", // previous message was read
        _lastOutgoingMessageId: "old-msg-123",
      };

      const result = computeNewStatus(existing, {
        fromMe: true,
        status: "sent",
        messageId: "new-msg-456",
      }, false);

      // CRITICAL: Must be "sent", NOT "read" (maxStatus would return "read")
      expect(result.lastStatus).toBe("sent");
      expect(result._lastOutgoingMessageId).toBe("new-msg-456");
    });

    it("resets lastStatus to 'sent' even when previous was 'played'", () => {
      const existing: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "played",
        _lastOutgoingMessageId: "old-msg",
      };

      const result = computeNewStatus(existing, {
        fromMe: true,
        messageId: "new-msg",
      }, false);

      expect(result.lastStatus).toBe("sent");
    });

    it("preserves _lastOutgoingMessageId when messageId is not provided", () => {
      const existing: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "delivered",
        _lastOutgoingMessageId: "old-msg",
      };

      const result = computeNewStatus(existing, {
        fromMe: true,
        status: "sent",
      }, false);

      expect(result.lastStatus).toBe("sent");
      expect(result._lastOutgoingMessageId).toBe("old-msg");
    });
  });

  describe("computeNewStatus - Webhook echo", () => {
    it("uses maxStatus for webhook echo (same message, keep higher)", () => {
      const existing: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "delivered", // already got delivered via fast status update
        _optimistic: true,
        _localTimestamp: 1000,
      };

      const result = computeNewStatus(existing, {
        fromMe: true,
        status: "sent", // webhook echo brings "sent"
        messageId: "msg-123",
      }, true);

      // maxStatus("delivered", "sent") = "delivered" (keep higher)
      expect(result.lastStatus).toBe("delivered");
    });

    it("upgrades status for webhook echo when new is higher", () => {
      const existing: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "sending", // optimistic "sending"
        _optimistic: true,
      };

      const result = computeNewStatus(existing, {
        fromMe: true,
        status: "sent",
        messageId: "msg-123",
      }, true);

      expect(result.lastStatus).toBe("sent");
    });
  });

  describe("computeNewStatus - Incoming message", () => {
    it("sets lastStatus to 'received' for incoming messages", () => {
      const existing: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "read",
        _lastOutgoingMessageId: "msg-123",
      };

      const result = computeNewStatus(existing, {
        fromMe: false,
        status: "received",
      }, false);

      expect(result.lastStatus).toBe("received");
      // Preserves _lastOutgoingMessageId
      expect(result._lastOutgoingMessageId).toBe("msg-123");
    });
  });

  describe("shouldApplyStatusUpdate", () => {
    it("applies status update when messageId matches", () => {
      const existing: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "sent",
        _lastOutgoingMessageId: "msg-123",
      };

      expect(shouldApplyStatusUpdate(existing, {
        status: "delivered",
        messageId: "msg-123",
      })).toBe(true);
    });

    it("rejects status update when messageId does NOT match", () => {
      const existing: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "sent",
        _lastOutgoingMessageId: "new-msg-456",
      };

      // Status update for an OLD message
      expect(shouldApplyStatusUpdate(existing, {
        status: "read",
        messageId: "old-msg-123",
      })).toBe(false);
    });

    it("allows status update when _lastOutgoingMessageId is not set", () => {
      const existing: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "sent",
        // No _lastOutgoingMessageId — can't verify, so allow
      };

      expect(shouldApplyStatusUpdate(existing, {
        status: "delivered",
        messageId: "msg-123",
      })).toBe(true);
    });

    it("allows status update when update.messageId is not set", () => {
      const existing: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "sent",
        _lastOutgoingMessageId: "msg-123",
      };

      expect(shouldApplyStatusUpdate(existing, {
        status: "delivered",
        // No messageId in update — can't verify, so allow
      })).toBe(true);
    });

    it("rejects status regression (delivered → sent)", () => {
      const existing: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "delivered",
        _lastOutgoingMessageId: "msg-123",
      };

      expect(shouldApplyStatusUpdate(existing, {
        status: "sent",
        messageId: "msg-123",
      })).toBe(false);
    });

    it("rejects status update when lastFromMe is false", () => {
      const existing: TestConvEntry = {
        lastFromMe: false,
        lastStatus: "received",
      };

      expect(shouldApplyStatusUpdate(existing, {
        status: "delivered",
      })).toBe(false);
    });

    it("handles lastFromMe as number (1) from MySQL", () => {
      const existing: TestConvEntry = {
        lastFromMe: 1, // MySQL returns tinyint as number
        lastStatus: "sent",
        _lastOutgoingMessageId: "msg-123",
      };

      expect(shouldApplyStatusUpdate(existing, {
        status: "delivered",
        messageId: "msg-123",
      })).toBe(true);
    });

    it("allows full status progression: sent → delivered → read → played", () => {
      const entry: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "sent",
        _lastOutgoingMessageId: "msg-123",
      };

      expect(shouldApplyStatusUpdate(entry, { status: "delivered", messageId: "msg-123" })).toBe(true);
      entry.lastStatus = "delivered";

      expect(shouldApplyStatusUpdate(entry, { status: "read", messageId: "msg-123" })).toBe(true);
      entry.lastStatus = "read";

      expect(shouldApplyStatusUpdate(entry, { status: "played", messageId: "msg-123" })).toBe(true);
    });
  });

  describe("Real-world scenarios", () => {
    it("Scenario: Send message, receive delivery, receive read", () => {
      // 1. User sends a message
      let conv: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "read", // previous message was read
        _lastOutgoingMessageId: "old-msg",
      };

      // 2. New outgoing message arrives
      const afterSend = computeNewStatus(conv, {
        fromMe: true,
        status: "sent",
        messageId: "new-msg",
      }, false);
      conv.lastStatus = afterSend.lastStatus;
      conv._lastOutgoingMessageId = afterSend._lastOutgoingMessageId;

      expect(conv.lastStatus).toBe("sent"); // 1 tick
      expect(conv._lastOutgoingMessageId).toBe("new-msg");

      // 3. Delivery receipt arrives for the new message
      expect(shouldApplyStatusUpdate(conv, { status: "delivered", messageId: "new-msg" })).toBe(true);
      conv.lastStatus = "delivered";
      expect(conv.lastStatus).toBe("delivered"); // 2 ticks

      // 4. Read receipt arrives for the new message
      expect(shouldApplyStatusUpdate(conv, { status: "read", messageId: "new-msg" })).toBe(true);
      conv.lastStatus = "read";
      expect(conv.lastStatus).toBe("read"); // 2 blue ticks
    });

    it("Scenario: Send message, old message's read receipt arrives (should be ignored)", () => {
      let conv: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "sent",
        _lastOutgoingMessageId: "new-msg",
      };

      // Old message's read receipt arrives — should be IGNORED
      expect(shouldApplyStatusUpdate(conv, { status: "read", messageId: "old-msg" })).toBe(false);
      // Status stays at "sent" (1 tick)
      expect(conv.lastStatus).toBe("sent");
    });

    it("Scenario: Incoming message changes lastFromMe, status updates ignored", () => {
      let conv: TestConvEntry = {
        lastFromMe: true,
        lastStatus: "delivered",
        _lastOutgoingMessageId: "msg-123",
      };

      // Incoming message arrives
      const afterIncoming = computeNewStatus(conv, {
        fromMe: false,
        status: "received",
      }, false);
      conv.lastStatus = afterIncoming.lastStatus;
      conv.lastFromMe = false;

      expect(conv.lastStatus).toBe("received");

      // Status update for the old outgoing message — should be ignored (lastFromMe is false)
      expect(shouldApplyStatusUpdate(conv, { status: "read", messageId: "msg-123" })).toBe(false);
    });
  });
});
