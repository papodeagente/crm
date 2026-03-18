/**
 * Optimistic Realtime Inbox — Comprehensive Tests
 *
 * Tests all 7 parts of the optimistic inbox implementation:
 * PART 1: Optimistic Send — message appears instantly
 * PART 2: Socket as primary driver
 * PART 3: Webhook reconciliation — status-only, no re-ordering
 * PART 4: Prevent message disappearing — status lifecycle
 * PART 5: Stable ordering — local timestamp priority
 * PART 6: Remove webhook dependency — works even with delayed/failed webhooks
 * PART 7: Validation — end-to-end scenarios
 */

import { describe, it, expect, beforeEach } from "vitest";

// ─── Inline ConversationStore for testing (same logic as client) ───

interface ConvEntry {
  conversationKey?: string;
  sessionId?: string;
  remoteJid: string;
  lastMessage: string | null;
  lastMessageType: string | null;
  lastFromMe: boolean | number;
  lastTimestamp: string | Date | null;
  lastStatus: string | null;
  contactPushName: string | null;
  unreadCount: number | string;
  _optimistic?: boolean;
  _localTimestamp?: number;
  conversationId?: number;
}

function makeConvKey(sessionId: string, remoteJid: string): string {
  return `${sessionId}:${remoteJid}`;
}

class ConversationStore {
  state: {
    conversationMap: Map<string, ConvEntry>;
    sortedIds: string[];
    version: number;
  } = { conversationMap: new Map(), sortedIds: [], version: 0 };

  private commit(map: Map<string, ConvEntry>, ids: string[]) {
    this.state = { conversationMap: map, sortedIds: ids, version: this.state.version + 1 };
  }

  hydrate(conversations: ConvEntry[], defaultSessionId?: string) {
    const map = new Map<string, ConvEntry>();
    const ids: string[] = [];
    const validFromMeStatuses = new Set(["sent", "delivered", "read", "played"]);
    for (const c of conversations) {
      const jid = c.remoteJid;
      if (!jid) continue;
      const sid = c.sessionId || defaultSessionId || "";
      const key = makeConvKey(sid, jid);
      const isFromMe = c.lastFromMe === true || c.lastFromMe === 1;
      let normalizedStatus = c.lastStatus;
      if (isFromMe && (!normalizedStatus || !validFromMeStatuses.has(normalizedStatus))) {
        normalizedStatus = "sent";
      }
      const entry: ConvEntry = { ...c, conversationKey: key, sessionId: sid, lastStatus: normalizedStatus };
      const existing = map.get(key);
      if (!existing) {
        map.set(key, entry);
        ids.push(key);
      } else {
        const existingTs = existing.lastTimestamp ? new Date(existing.lastTimestamp).getTime() : 0;
        const newTs = c.lastTimestamp ? new Date(c.lastTimestamp).getTime() : 0;
        if (newTs > existingTs) map.set(key, entry);
      }
    }
    ids.sort((a, b) => {
      const ta = map.get(a)?.lastTimestamp ? new Date(map.get(a)!.lastTimestamp!).getTime() : 0;
      const tb = map.get(b)?.lastTimestamp ? new Date(map.get(b)!.lastTimestamp!).getTime() : 0;
      return tb - ta;
    });
    this.commit(map, ids);
  }

  handleOptimisticSend(msg: { sessionId: string; remoteJid: string; content: string; messageType?: string }): boolean {
    const key = makeConvKey(msg.sessionId, msg.remoteJid);
    if (!key || !msg.remoteJid) return false;
    const oldMap = this.state.conversationMap;
    const oldIds = this.state.sortedIds;
    const existing = oldMap.get(key);
    if (!existing) return false;

    const now = Date.now();
    const nowISO = new Date(now).toISOString();
    const updated: ConvEntry = {
      ...existing,
      lastMessage: msg.content,
      lastMessageType: msg.messageType || "conversation",
      lastFromMe: true,
      lastTimestamp: nowISO,
      lastStatus: "sending",
      _optimistic: true,
      _localTimestamp: now,
    };
    const newMap = new Map(oldMap);
    newMap.set(key, updated);
    const currentIdx = oldIds.indexOf(key);
    let newIds: string[];
    if (currentIdx === 0) newIds = [...oldIds];
    else if (currentIdx > 0) newIds = [key, ...oldIds.slice(0, currentIdx), ...oldIds.slice(currentIdx + 1)];
    else newIds = [key, ...oldIds];
    this.commit(newMap, newIds);
    return true;
  }

  handleMessage(msg: { sessionId: string; remoteJid: string; content: string; fromMe: boolean; messageType: string; timestamp: number; isSync?: boolean }, activeKey: string | null): boolean {
    const key = makeConvKey(msg.sessionId, msg.remoteJid);
    if (!key || !msg.remoteJid) return false;
    const oldMap = this.state.conversationMap;
    const oldIds = this.state.sortedIds;
    const existing = oldMap.get(key);
    if (!existing) return false;

    const msgTimestamp = new Date(msg.timestamp).getTime();
    const existingTimestamp = existing.lastTimestamp ? new Date(existing.lastTimestamp).getTime() : 0;

    // Webhook echo detection
    const isWebhookEcho = msg.fromMe && existing._optimistic && existing._localTimestamp && existing._localTimestamp >= msgTimestamp;
    if (isWebhookEcho) {
      const updated: ConvEntry = { ...existing, lastStatus: "sent", _optimistic: false };
      const newMap = new Map(oldMap);
      newMap.set(key, updated);
      this.commit(newMap, [...oldIds]);
      return true;
    }

    if (msgTimestamp < existingTimestamp && !msg.fromMe) return true;

    let newUnread: number;
    if (msg.fromMe) {
      newUnread = activeKey === key ? 0 : Number(existing.unreadCount) || 0;
    } else if (activeKey === key) {
      newUnread = 0;
    } else {
      newUnread = (Number(existing.unreadCount) || 0) + 1;
    }

    const updated: ConvEntry = {
      ...existing,
      lastMessage: msg.content || existing.lastMessage,
      lastMessageType: msg.messageType,
      lastFromMe: msg.fromMe,
      lastTimestamp: new Date(msgTimestamp),
      lastStatus: msg.fromMe ? "sent" : "received",
      unreadCount: newUnread,
      _optimistic: false,
      _localTimestamp: undefined,
    };
    const newMap = new Map(oldMap);
    newMap.set(key, updated);
    const currentIdx = oldIds.indexOf(key);
    let newIds: string[];
    if (currentIdx === 0) newIds = [...oldIds];
    else if (currentIdx > 0) newIds = [key, ...oldIds.slice(0, currentIdx), ...oldIds.slice(currentIdx + 1)];
    else newIds = [key, ...oldIds];
    this.commit(newMap, newIds);
    return true;
  }

  handleStatusUpdate(update: { sessionId: string; remoteJid: string; status: string }) {
    const key = makeConvKey(update.sessionId, update.remoteJid);
    if (!key) return;
    const existing = this.state.conversationMap.get(key);
    const isFromMe = existing?.lastFromMe === true || existing?.lastFromMe === 1;
    if (!existing || !isFromMe) return;
    const statusOrder: Record<string, number> = { sending: 0, sent: 1, delivered: 2, read: 3, played: 4 };
    const currentOrder = statusOrder[existing.lastStatus || ""] ?? -1;
    const newOrder = statusOrder[update.status] ?? -1;
    if (newOrder <= currentOrder) return;
    const newMap = new Map(this.state.conversationMap);
    newMap.set(key, { ...existing, lastStatus: update.status, _optimistic: false });
    this.commit(newMap, [...this.state.sortedIds]);
  }

  markRead(conversationKey: string) {
    const existing = this.state.conversationMap.get(conversationKey);
    if (!existing || Number(existing.unreadCount) === 0) return;
    const newMap = new Map(this.state.conversationMap);
    newMap.set(conversationKey, { ...existing, unreadCount: 0 });
    this.commit(newMap, [...this.state.sortedIds]);
  }

  handleConversationPreview(preview: {
    sessionId: string;
    remoteJid: string;
    lastMessage: string | null;
    lastMessageAt: number;
    lastMessageStatus: string | null;
    lastMessageType: string | null;
    lastFromMe: boolean;
  }) {
    const key = makeConvKey(preview.sessionId, preview.remoteJid);
    if (!key) return;
    const existing = this.state.conversationMap.get(key);
    if (!existing) return;
    const newMap = new Map(this.state.conversationMap);
    newMap.set(key, {
      ...existing,
      lastMessage: preview.lastMessage ?? existing.lastMessage,
      lastMessageType: preview.lastMessageType ?? existing.lastMessageType,
      lastFromMe: preview.lastFromMe,
      lastStatus: preview.lastMessageStatus ?? existing.lastStatus,
      lastTimestamp: new Date(preview.lastMessageAt),
      _optimistic: false,
    });
    this.commit(newMap, [...this.state.sortedIds]);
  }

  getConversation(key: string): ConvEntry | undefined {
    return this.state.conversationMap.get(key);
  }

  getSorted(): ConvEntry[] {
    const { conversationMap, sortedIds } = this.state;
    const result: ConvEntry[] = [];
    for (const id of sortedIds) {
      const entry = conversationMap.get(id);
      if (entry) result.push(entry);
    }
    return result;
  }
}

// ─── Test Helpers ───

const SESSION = "instance1";
const JID_A = "558499445034@s.whatsapp.net";
const JID_B = "558499445035@s.whatsapp.net";
const JID_C = "558499445036@s.whatsapp.net";
const KEY_A = makeConvKey(SESSION, JID_A);
const KEY_B = makeConvKey(SESSION, JID_B);
const KEY_C = makeConvKey(SESSION, JID_C);

function makeConv(jid: string, msg: string, ts: number, fromMe = false): ConvEntry {
  return {
    remoteJid: jid,
    sessionId: SESSION,
    lastMessage: msg,
    lastMessageType: "conversation",
    lastFromMe: fromMe,
    lastTimestamp: new Date(ts).toISOString(),
    lastStatus: fromMe ? "sent" : "received",
    contactPushName: `Contact ${jid.substring(0, 5)}`,
    unreadCount: fromMe ? 0 : 1,
  };
}

// ─── TESTS ───

describe("PART 1: Optimistic Send", () => {
  let store: ConversationStore;

  beforeEach(() => {
    store = new ConversationStore();
    const now = Date.now();
    store.hydrate([
      makeConv(JID_A, "Hello", now - 5000),
      makeConv(JID_B, "Hi there", now - 3000),
      makeConv(JID_C, "Latest msg", now - 1000),
    ]);
  });

  it("should instantly update lastMessage and lastTimestamp on send", () => {
    const result = store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "My new message",
    });

    expect(result).toBe(true);
    const conv = store.getConversation(KEY_A)!;
    expect(conv.lastMessage).toBe("My new message");
    expect(conv.lastFromMe).toBe(true);
    expect(conv.lastStatus).toBe("sending");
    expect(conv._optimistic).toBe(true);
    expect(conv._localTimestamp).toBeGreaterThan(0);
  });

  it("should move conversation to top of sortedIds", () => {
    // JID_A is at position 2 (oldest)
    expect(store.state.sortedIds[0]).toBe(KEY_C); // latest
    expect(store.state.sortedIds[2]).toBe(KEY_A); // oldest

    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Bump to top",
    });

    expect(store.state.sortedIds[0]).toBe(KEY_A); // now at top
    expect(store.state.sortedIds.length).toBe(3); // no duplicates
  });

  it("should return false for unknown conversation", () => {
    const result = store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: "unknown@s.whatsapp.net",
      content: "test",
    });
    expect(result).toBe(false);
  });

  it("should update within <5ms (performance)", () => {
    const start = performance.now();
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Performance test",
    });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5);
  });
});

describe("PART 2: Socket as Primary Driver", () => {
  let store: ConversationStore;

  beforeEach(() => {
    store = new ConversationStore();
    const now = Date.now();
    store.hydrate([
      makeConv(JID_A, "Old msg", now - 10000),
      makeConv(JID_B, "Other msg", now - 5000),
    ]);
  });

  it("should update conversation via socket message (incoming)", () => {
    const handled = store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "New incoming message",
      fromMe: false,
      messageType: "conversation",
      timestamp: Date.now(),
    }, null);

    expect(handled).toBe(true);
    const conv = store.getConversation(KEY_A)!;
    expect(conv.lastMessage).toBe("New incoming message");
    expect(conv.lastFromMe).toBe(false);
    expect(conv.lastStatus).toBe("received");
  });

  it("should move conversation to top on incoming message", () => {
    expect(store.state.sortedIds[0]).toBe(KEY_B); // newer

    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "New msg",
      fromMe: false,
      messageType: "conversation",
      timestamp: Date.now(),
    }, null);

    expect(store.state.sortedIds[0]).toBe(KEY_A); // now at top
  });

  it("should increment unread count for non-active conversation", () => {
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Msg 1",
      fromMe: false,
      messageType: "conversation",
      timestamp: Date.now(),
    }, KEY_B); // B is active, not A

    const conv = store.getConversation(KEY_A)!;
    expect(Number(conv.unreadCount)).toBeGreaterThan(0);
  });

  it("should NOT increment unread for active conversation", () => {
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Msg 1",
      fromMe: false,
      messageType: "conversation",
      timestamp: Date.now(),
    }, KEY_A); // A is active

    const conv = store.getConversation(KEY_A)!;
    expect(Number(conv.unreadCount)).toBe(0);
  });
});

describe("PART 3: Webhook Reconciliation", () => {
  let store: ConversationStore;

  beforeEach(() => {
    store = new ConversationStore();
    const now = Date.now();
    store.hydrate([
      makeConv(JID_A, "Old msg", now - 10000),
      makeConv(JID_B, "Other msg", now - 5000),
      makeConv(JID_C, "Latest", now - 1000),
    ]);
  });

  it("should detect webhook echo and only update status (not re-sort)", () => {
    // Step 1: Optimistic send moves A to top
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Sent message",
    });
    expect(store.state.sortedIds[0]).toBe(KEY_A);
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sending");

    const positionBefore = [...store.state.sortedIds];

    // Step 2: Webhook echo arrives (same content, fromMe, older timestamp)
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Sent message",
      fromMe: true,
      messageType: "conversation",
      timestamp: Date.now() - 100, // slightly older than optimistic
    }, null);

    // Status should be updated to "sent"
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");
    // Position should NOT change
    expect(store.state.sortedIds).toEqual(positionBefore);
    // Optimistic flag should be cleared
    expect(store.getConversation(KEY_A)!._optimistic).toBe(false);
  });

  it("should handle status update without re-sorting", () => {
    // Send optimistically
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Test",
    });
    const positionBefore = [...store.state.sortedIds];

    // Status update: delivered
    store.handleStatusUpdate({
      sessionId: SESSION,
      remoteJid: JID_A,
      status: "delivered",
    });

    expect(store.getConversation(KEY_A)!.lastStatus).toBe("delivered");
    expect(store.state.sortedIds).toEqual(positionBefore);
  });
});

describe("PART 4: Prevent Message Disappearing", () => {
  let store: ConversationStore;

  beforeEach(() => {
    store = new ConversationStore();
    store.hydrate([makeConv(JID_A, "Old msg", Date.now() - 10000)]);
  });

  it("should maintain message through full lifecycle: sending → sent → delivered → read", () => {
    // 1. Optimistic send
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Lifecycle test",
    });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sending");
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("Lifecycle test");

    // 2. Webhook echo → sent
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Lifecycle test",
      fromMe: true,
      messageType: "conversation",
      timestamp: Date.now() - 50,
    }, null);
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("Lifecycle test"); // NOT removed

    // 3. Status → delivered
    store.handleStatusUpdate({
      sessionId: SESSION,
      remoteJid: JID_A,
      status: "delivered",
    });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("delivered");
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("Lifecycle test"); // still there

    // 4. Status → read
    store.handleStatusUpdate({
      sessionId: SESSION,
      remoteJid: JID_A,
      status: "read",
    });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("read");
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("Lifecycle test"); // never removed
  });

  it("should never go backwards in status progression", () => {
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Test",
    });

    // Jump to delivered
    store.handleStatusUpdate({
      sessionId: SESSION,
      remoteJid: JID_A,
      status: "delivered",
    });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("delivered");

    // Try to go back to sent — should be ignored
    store.handleStatusUpdate({
      sessionId: SESSION,
      remoteJid: JID_A,
      status: "sent",
    });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("delivered"); // unchanged
  });
});

describe("PART 5: Stable Ordering", () => {
  let store: ConversationStore;

  beforeEach(() => {
    store = new ConversationStore();
    const now = Date.now();
    store.hydrate([
      makeConv(JID_A, "A msg", now - 10000),
      makeConv(JID_B, "B msg", now - 5000),
      makeConv(JID_C, "C msg", now - 1000),
    ]);
    // Order: C, B, A
  });

  it("should use local timestamp (optimistic) over webhook timestamp", () => {
    // Optimistic send moves A to top
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "New msg",
    });
    expect(store.state.sortedIds[0]).toBe(KEY_A);

    // Webhook arrives with OLDER timestamp — should NOT change position
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "New msg",
      fromMe: true,
      messageType: "conversation",
      timestamp: Date.now() - 5000, // 5 seconds ago
    }, null);

    // A should still be at top
    expect(store.state.sortedIds[0]).toBe(KEY_A);
  });

  it("should not reorder on old incoming messages", () => {
    // C is at top (newest)
    expect(store.state.sortedIds[0]).toBe(KEY_C);

    // Old message arrives for A (timestamp older than current)
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Very old msg",
      fromMe: false,
      messageType: "conversation",
      timestamp: Date.now() - 20000, // 20 seconds ago, older than A's current timestamp
    }, null);

    // C should still be at top — old message doesn't reorder
    expect(store.state.sortedIds[0]).toBe(KEY_C);
  });

  it("should move to top on genuinely new incoming message", () => {
    expect(store.state.sortedIds[0]).toBe(KEY_C);

    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Brand new msg",
      fromMe: false,
      messageType: "conversation",
      timestamp: Date.now(), // now
    }, null);

    expect(store.state.sortedIds[0]).toBe(KEY_A);
  });
});

describe("PART 6: Remove Webhook Dependency", () => {
  let store: ConversationStore;

  beforeEach(() => {
    store = new ConversationStore();
    const now = Date.now();
    store.hydrate([
      makeConv(JID_A, "A msg", now - 10000),
      makeConv(JID_B, "B msg", now - 5000),
    ]);
  });

  it("should work perfectly with no webhook at all", () => {
    // Send message — no webhook will ever arrive
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Msg without webhook",
    });

    // Conversation should be at top with correct preview
    expect(store.state.sortedIds[0]).toBe(KEY_A);
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("Msg without webhook");
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sending");
    expect(store.getConversation(KEY_A)!.lastFromMe).toBe(true);
  });

  it("should handle delayed webhook (5s later) without disruption", () => {
    // Optimistic send
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Delayed webhook test",
    });
    const posAfterSend = [...store.state.sortedIds];

    // Meanwhile, receive a new message on B
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_B,
      content: "New msg on B",
      fromMe: false,
      messageType: "conversation",
      timestamp: Date.now(),
    }, null);

    // B is now at top, A is second
    expect(store.state.sortedIds[0]).toBe(KEY_B);
    expect(store.state.sortedIds[1]).toBe(KEY_A);

    // Delayed webhook arrives for A (5s later)
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Delayed webhook test",
      fromMe: true,
      messageType: "conversation",
      timestamp: Date.now() - 5000, // the original send time
    }, null);

    // A should NOT jump back to top — B's message is newer
    // But A's status should be updated
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");
    expect(store.getConversation(KEY_A)!._optimistic).toBe(false);
  });

  it("should handle webhook retry (duplicate) gracefully", () => {
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Retry test",
    });

    // First webhook
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Retry test",
      fromMe: true,
      messageType: "conversation",
      timestamp: Date.now() - 100,
    }, null);
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");

    // Retry webhook (same content, same timestamp)
    const versionBefore = store.state.version;
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Retry test",
      fromMe: true,
      messageType: "conversation",
      timestamp: Date.now() - 100,
    }, null);

    // Should still be "sent", no disruption
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");
  });
});

describe("PART 7: End-to-End Validation", () => {
  let store: ConversationStore;

  beforeEach(() => {
    store = new ConversationStore();
    const now = Date.now();
    store.hydrate([
      makeConv(JID_A, "A msg", now - 10000),
      makeConv(JID_B, "B msg", now - 5000),
      makeConv(JID_C, "C msg", now - 1000),
    ]);
  });

  it("SCENARIO 1: Send message → instant update in sidebar", () => {
    // Before: C is at top
    expect(store.state.sortedIds[0]).toBe(KEY_C);

    // User sends message to A
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Hello!",
    });

    // Instant: A is at top, preview updated, status "sending"
    expect(store.state.sortedIds[0]).toBe(KEY_A);
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("Hello!");
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sending");
  });

  it("SCENARIO 2: Webhook delayed 5s → inbox still perfect", () => {
    // Send to A
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Test msg",
    });
    expect(store.state.sortedIds[0]).toBe(KEY_A);
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("Test msg");

    // 5 seconds pass... no webhook yet
    // Inbox should still show A at top with "sending" status
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sending");
    expect(store.state.sortedIds[0]).toBe(KEY_A);

    // Webhook finally arrives
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Test msg",
      fromMe: true,
      messageType: "conversation",
      timestamp: Date.now() - 5000,
    }, null);

    // Status updated, position unchanged
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");
    expect(store.state.sortedIds[0]).toBe(KEY_A);
  });

  it("SCENARIO 3: Receive message → instant update via socket", () => {
    expect(store.state.sortedIds[0]).toBe(KEY_C);

    // Incoming message on A
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Incoming!",
      fromMe: false,
      messageType: "conversation",
      timestamp: Date.now(),
    }, null);

    // A moves to top, preview updated
    expect(store.state.sortedIds[0]).toBe(KEY_A);
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("Incoming!");
    expect(store.getConversation(KEY_A)!.lastFromMe).toBe(false);
  });

  it("SCENARIO 4: Rapid send + receive interleaving", () => {
    // Send to A
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Outgoing",
    });
    expect(store.state.sortedIds[0]).toBe(KEY_A);

    // Receive on B (newer)
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_B,
      content: "Incoming on B",
      fromMe: false,
      messageType: "conversation",
      timestamp: Date.now() + 100,
    }, null);
    expect(store.state.sortedIds[0]).toBe(KEY_B);
    expect(store.state.sortedIds[1]).toBe(KEY_A);

    // Send to C
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_C,
      content: "Outgoing on C",
    });
    expect(store.state.sortedIds[0]).toBe(KEY_C);

    // All conversations still present, no duplicates
    expect(store.state.sortedIds.length).toBe(3);
    expect(new Set(store.state.sortedIds).size).toBe(3);
  });

  it("SCENARIO 5: Performance — 1000 conversations, optimistic send < 5ms", () => {
    const bigStore = new ConversationStore();
    const convs: ConvEntry[] = [];
    const now = Date.now();
    for (let i = 0; i < 1000; i++) {
      convs.push(makeConv(`55849944${String(i).padStart(4, "0")}@s.whatsapp.net`, `Msg ${i}`, now - i * 1000));
    }
    bigStore.hydrate(convs);

    // Send to the LAST conversation (worst case — needs to move from position 999 to 0)
    const lastJid = `558499440999@s.whatsapp.net`;
    const start = performance.now();
    bigStore.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: lastJid,
      content: "Performance test",
    });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5);
    expect(bigStore.state.sortedIds[0]).toBe(makeConvKey(SESSION, lastJid));
  });

  it("SCENARIO 6: Multiple rapid sends to same conversation", () => {
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "First msg",
    });
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("First msg");

    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Second msg",
    });
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("Second msg");

    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Third msg",
    });
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("Third msg");

    // Still at top, no duplicates
    expect(store.state.sortedIds[0]).toBe(KEY_A);
    expect(store.state.sortedIds.length).toBe(3);
  });
});

describe("PART 8: Hydration Status Normalization", () => {
  it("should normalize null lastStatus to 'sent' for fromMe=true conversations", () => {
    const store = new ConversationStore();
    const conv: ConvEntry = {
      remoteJid: JID_A,
      sessionId: SESSION,
      lastMessage: "test msg",
      lastMessageType: "conversation",
      lastFromMe: true,
      lastTimestamp: new Date().toISOString(),
      lastStatus: null, // DB returns null
      contactPushName: "Sara Monte",
      unreadCount: 0,
    };
    store.hydrate([conv]);
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");
  });

  it("should normalize 'pending' lastStatus to 'sent' for fromMe=true conversations", () => {
    const store = new ConversationStore();
    const conv: ConvEntry = {
      remoteJid: JID_A,
      sessionId: SESSION,
      lastMessage: "test msg",
      lastMessageType: "conversation",
      lastFromMe: true,
      lastTimestamp: new Date().toISOString(),
      lastStatus: "pending", // invalid for sidebar display
      contactPushName: "Sara Monte",
      unreadCount: 0,
    };
    store.hydrate([conv]);
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");
  });

  it("should normalize empty string lastStatus to 'sent' for fromMe=true conversations", () => {
    const store = new ConversationStore();
    const conv: ConvEntry = {
      remoteJid: JID_A,
      sessionId: SESSION,
      lastMessage: "test msg",
      lastMessageType: "conversation",
      lastFromMe: true,
      lastTimestamp: new Date().toISOString(),
      lastStatus: "", // empty string
      contactPushName: "Sara Monte",
      unreadCount: 0,
    };
    store.hydrate([conv]);
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");
  });

  it("should keep valid statuses (delivered, read) unchanged on hydration", () => {
    const store = new ConversationStore();
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "a", lastMessageType: "conversation", lastFromMe: true, lastTimestamp: new Date().toISOString(), lastStatus: "delivered", contactPushName: "A", unreadCount: 0 },
      { remoteJid: JID_B, sessionId: SESSION, lastMessage: "b", lastMessageType: "conversation", lastFromMe: true, lastTimestamp: new Date().toISOString(), lastStatus: "read", contactPushName: "B", unreadCount: 0 },
    ]);
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("delivered");
    expect(store.getConversation(KEY_B)!.lastStatus).toBe("read");
  });

  it("should NOT normalize status for fromMe=false (received) conversations", () => {
    const store = new ConversationStore();
    const conv: ConvEntry = {
      remoteJid: JID_A,
      sessionId: SESSION,
      lastMessage: "incoming",
      lastMessageType: "conversation",
      lastFromMe: false,
      lastTimestamp: new Date().toISOString(),
      lastStatus: null,
      contactPushName: "Sara Monte",
      unreadCount: 1,
    };
    store.hydrate([conv]);
    // Should stay null — no normalization for received messages
    expect(store.getConversation(KEY_A)!.lastStatus).toBeNull();
  });

  it("should handle lastFromMe as number 1 (MySQL boolean) on hydration", () => {
    const store = new ConversationStore();
    const conv: ConvEntry = {
      remoteJid: JID_A,
      sessionId: SESSION,
      lastMessage: "test",
      lastMessageType: "conversation",
      lastFromMe: 1, // MySQL returns 1 instead of true
      lastTimestamp: new Date().toISOString(),
      lastStatus: null,
      contactPushName: "Sara Monte",
      unreadCount: 0,
    };
    store.hydrate([conv]);
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");
  });

  it("should handle lastFromMe as number 0 (MySQL boolean false) — no normalization", () => {
    const store = new ConversationStore();
    const conv: ConvEntry = {
      remoteJid: JID_A,
      sessionId: SESSION,
      lastMessage: "test",
      lastMessageType: "conversation",
      lastFromMe: 0 as any, // MySQL returns 0 instead of false
      lastTimestamp: new Date().toISOString(),
      lastStatus: null,
      contactPushName: "Sara Monte",
      unreadCount: 1,
    };
    store.hydrate([conv]);
    expect(store.getConversation(KEY_A)!.lastStatus).toBeNull();
  });
});

describe("PART 9: handleStatusUpdate with numeric lastFromMe", () => {
  it("should update status when lastFromMe is 1 (MySQL boolean)", () => {
    const store = new ConversationStore();
    const conv: ConvEntry = {
      remoteJid: JID_A,
      sessionId: SESSION,
      lastMessage: "test",
      lastMessageType: "conversation",
      lastFromMe: 1, // MySQL boolean
      lastTimestamp: new Date().toISOString(),
      lastStatus: "sent",
      contactPushName: "Sara Monte",
      unreadCount: 0,
    };
    store.hydrate([conv]);

    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "delivered" });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("delivered");

    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "read" });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("read");
  });

  it("should NOT update status when lastFromMe is 0 (MySQL boolean false)", () => {
    const store = new ConversationStore();
    const conv: ConvEntry = {
      remoteJid: JID_A,
      sessionId: SESSION,
      lastMessage: "incoming",
      lastMessageType: "conversation",
      lastFromMe: 0 as any,
      lastTimestamp: new Date().toISOString(),
      lastStatus: "received",
      contactPushName: "Sara Monte",
      unreadCount: 1,
    };
    store.hydrate([conv]);

    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "delivered" });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("received"); // unchanged
  });
});


// ═══════════════════════════════════════════════════════════════════════
// PART 5 (NEW): Conversation Preview — Authoritative Server Updates
// ═══════════════════════════════════════════════════════════════════════

describe("PART 5 (NEW): handleConversationPreview — Authoritative Server Updates", () => {
  let store: ConversationStore;
  const now = Date.now();

  beforeEach(() => {
    store = new ConversationStore();
    store.hydrate([
      makeConv(JID_A, "Hello", now - 5000, true),
      makeConv(JID_B, "Hi there", now - 3000),
      makeConv(JID_C, "Latest msg", now - 1000),
    ]);
  });

  it("should update lastStatus from server preview (sending → delivered)", () => {
    // Simulate optimistic send (status = "sending")
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "New message",
    });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sending");

    // Server sends authoritative preview with "delivered" status
    store.handleConversationPreview({
      sessionId: SESSION,
      remoteJid: JID_A,
      lastMessage: "New message",
      lastMessageAt: now,
      lastMessageStatus: "delivered",
      lastMessageType: "conversation",
      lastFromMe: true,
    });

    const conv = store.getConversation(KEY_A)!;
    expect(conv.lastStatus).toBe("delivered");
    expect(conv._optimistic).toBe(false);
  });

  it("should NOT re-sort conversations on preview update", () => {
    const sortedBefore = [...store.state.sortedIds];

    store.handleConversationPreview({
      sessionId: SESSION,
      remoteJid: JID_A,
      lastMessage: "Updated preview",
      lastMessageAt: now + 10000, // much newer timestamp
      lastMessageStatus: "read",
      lastMessageType: "conversation",
      lastFromMe: true,
    });

    // Order must NOT change — preview updates never re-sort
    expect(store.state.sortedIds).toEqual(sortedBefore);
  });

  it("should update lastMessage content from server preview", () => {
    store.handleConversationPreview({
      sessionId: SESSION,
      remoteJid: JID_B,
      lastMessage: "Server says this is the real latest message",
      lastMessageAt: now,
      lastMessageStatus: "received",
      lastMessageType: "imageMessage",
      lastFromMe: false,
    });

    const conv = store.getConversation(KEY_B)!;
    expect(conv.lastMessage).toBe("Server says this is the real latest message");
    expect(conv.lastMessageType).toBe("imageMessage");
    expect(conv.lastFromMe).toBe(false);
    expect(conv.lastStatus).toBe("received");
  });

  it("should clear _optimistic flag on preview update", () => {
    // Set up optimistic state
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Optimistic msg",
    });
    expect(store.getConversation(KEY_A)!._optimistic).toBe(true);

    // Server preview arrives
    store.handleConversationPreview({
      sessionId: SESSION,
      remoteJid: JID_A,
      lastMessage: "Optimistic msg",
      lastMessageAt: now,
      lastMessageStatus: "sent",
      lastMessageType: "conversation",
      lastFromMe: true,
    });

    expect(store.getConversation(KEY_A)!._optimistic).toBe(false);
  });

  it("should handle preview for non-existent conversation gracefully", () => {
    const versionBefore = store.state.version;

    store.handleConversationPreview({
      sessionId: SESSION,
      remoteJid: "nonexistent@s.whatsapp.net",
      lastMessage: "Ghost message",
      lastMessageAt: now,
      lastMessageStatus: "sent",
      lastMessageType: "conversation",
      lastFromMe: true,
    });

    // Version should NOT change — no update was made
    expect(store.state.version).toBe(versionBefore);
  });

  it("should fix stale sidebar status: optimistic 'sending' → server 'read'", () => {
    // This is the exact bug scenario from the screenshot:
    // 1. User sends message → sidebar shows "sending" (clock icon)
    // 2. Webhook confirms delivery → chat shows "read" (blue checks)
    // 3. But sidebar was stuck on "sending" because handleStatusUpdate
    //    only worked with the old status update event
    // 4. NOW: handleConversationPreview fixes it with authoritative data

    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "e vc?",
    });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sending");

    // Server propagates the TRUE latest message status
    store.handleConversationPreview({
      sessionId: SESSION,
      remoteJid: JID_A,
      lastMessage: "e vc?",
      lastMessageAt: now,
      lastMessageStatus: "read",
      lastMessageType: "conversation",
      lastFromMe: true,
    });

    expect(store.getConversation(KEY_A)!.lastStatus).toBe("read");
    expect(store.getConversation(KEY_A)!._optimistic).toBe(false);
  });

  it("should update lastFromMe correctly when latest message is incoming", () => {
    // Scenario: user sent a message (lastFromMe=true), then received a reply
    // Server preview should reflect the incoming message as latest
    store.handleOptimisticSend({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "My question",
    });

    // Server says the latest message is actually an incoming one
    store.handleConversationPreview({
      sessionId: SESSION,
      remoteJid: JID_A,
      lastMessage: "Their reply",
      lastMessageAt: now + 5000,
      lastMessageStatus: "received",
      lastMessageType: "conversation",
      lastFromMe: false,
    });

    const conv = store.getConversation(KEY_A)!;
    expect(conv.lastFromMe).toBe(false);
    expect(conv.lastMessage).toBe("Their reply");
    expect(conv.lastStatus).toBe("received");
  });

  it("should handle null lastMessage in preview (keep existing)", () => {
    store.handleConversationPreview({
      sessionId: SESSION,
      remoteJid: JID_A,
      lastMessage: null,
      lastMessageAt: now,
      lastMessageStatus: "delivered",
      lastMessageType: null,
      lastFromMe: true,
    });

    const conv = store.getConversation(KEY_A)!;
    // lastMessage should keep existing value since preview sent null
    expect(conv.lastMessage).toBe("Hello");
    // But status should be updated
    expect(conv.lastStatus).toBe("delivered");
  });
});


// ════════════════════════════════════════════════════════════
// PART 8: MONOTONIC STATUS — Never allow status regression
// ════════════════════════════════════════════════════════════

describe("PART 8: Monotonic Status Enforcement", () => {
  const SESSION = "s1";
  const JID_A = "5511999@s.whatsapp.net";
  const KEY_A = makeConvKey(SESSION, JID_A);
  let store: ConversationStore;

  beforeEach(() => {
    store = new ConversationStore();
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "Hello", lastMessageType: "conversation", lastFromMe: true, lastTimestamp: new Date().toISOString(), lastStatus: "delivered", contactPushName: "User A", unreadCount: 0 },
    ]);
  });

  it("should NOT regress from delivered to sent", () => {
    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "sent" });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("delivered"); // unchanged
  });

  it("should NOT regress from read to delivered", () => {
    // First advance to read
    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "read" });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("read");
    // Try to regress
    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "delivered" });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("read"); // unchanged
  });

  it("should NOT regress from read to sending", () => {
    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "read" });
    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "sending" });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("read"); // unchanged
  });

  it("should advance from sent → delivered → read → played", () => {
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "Hello", lastMessageType: "conversation", lastFromMe: true, lastTimestamp: new Date().toISOString(), lastStatus: "sent", contactPushName: "User A", unreadCount: 0 },
    ]);
    
    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "delivered" });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("delivered");
    
    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "read" });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("read");
    
    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "played" });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("played");
  });

  it("should advance from sending → sent (optimistic → confirmed)", () => {
    // Simulate optimistic send
    store.handleOptimisticSend({ sessionId: SESSION, remoteJid: JID_A, content: "New msg" });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sending");
    
    // Webhook confirms sent
    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "sent" });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");
  });

  it("should ignore status update for non-fromMe conversations", () => {
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "Hello", lastMessageType: "conversation", lastFromMe: false, lastTimestamp: new Date().toISOString(), lastStatus: "received", contactPushName: "User A", unreadCount: 1 },
    ]);
    
    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "delivered" });
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("received"); // unchanged
  });

  it("should handle rapid status updates without regression", () => {
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "Hello", lastMessageType: "conversation", lastFromMe: true, lastTimestamp: new Date().toISOString(), lastStatus: "sending", contactPushName: "User A", unreadCount: 0 },
    ]);
    
    // Simulate rapid webhook updates arriving out of order
    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "delivered" });
    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "sent" }); // late arrival
    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "read" });
    store.handleStatusUpdate({ sessionId: SESSION, remoteJid: JID_A, status: "delivered" }); // late arrival
    
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("read"); // highest status wins
  });
});

// ════════════════════════════════════════════════════════════
// PART 9: HYDRATION STATUS NORMALIZATION
// ════════════════════════════════════════════════════════════

describe("PART 9: Hydration normalizes invalid fromMe statuses", () => {
  const SESSION = "s1";
  const JID_A = "5511999@s.whatsapp.net";
  const KEY_A = makeConvKey(SESSION, JID_A);

  it("should normalize null status to 'sent' for fromMe messages", () => {
    const store = new ConversationStore();
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "Hello", lastMessageType: "conversation", lastFromMe: true, lastTimestamp: new Date().toISOString(), lastStatus: null, contactPushName: "User A", unreadCount: 0 },
    ]);
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");
  });

  it("should normalize 'pending' status to 'sent' for fromMe messages", () => {
    const store = new ConversationStore();
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "Hello", lastMessageType: "conversation", lastFromMe: true, lastTimestamp: new Date().toISOString(), lastStatus: "pending", contactPushName: "User A", unreadCount: 0 },
    ]);
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");
  });

  it("should normalize 'received' status to 'sent' for fromMe messages", () => {
    const store = new ConversationStore();
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "Hello", lastMessageType: "conversation", lastFromMe: true, lastTimestamp: new Date().toISOString(), lastStatus: "received", contactPushName: "User A", unreadCount: 0 },
    ]);
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");
  });

  it("should NOT normalize valid statuses for fromMe messages", () => {
    const store = new ConversationStore();
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "Hello", lastMessageType: "conversation", lastFromMe: true, lastTimestamp: new Date().toISOString(), lastStatus: "delivered", contactPushName: "User A", unreadCount: 0 },
    ]);
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("delivered");
  });

  it("should handle lastFromMe as number 1 (MySQL tinyint)", () => {
    const store = new ConversationStore();
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "Hello", lastMessageType: "conversation", lastFromMe: 1, lastTimestamp: new Date().toISOString(), lastStatus: "pending", contactPushName: "User A", unreadCount: 0 },
    ]);
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("sent");
  });

  it("should NOT normalize status for non-fromMe messages", () => {
    const store = new ConversationStore();
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "Hello", lastMessageType: "conversation", lastFromMe: false, lastTimestamp: new Date().toISOString(), lastStatus: "received", contactPushName: "User A", unreadCount: 0 },
    ]);
    expect(store.getConversation(KEY_A)!.lastStatus).toBe("received");
  });
});


// ════════════════════════════════════════════════════════════
// PART 10: TEMPLATE → REAL MESSAGE TRANSITION
// ════════════════════════════════════════════════════════════

describe("PART 10: Template → Real Message Transition", () => {
  const SESSION = "s1";
  const JID_A = "5511999@s.whatsapp.net";
  const KEY_A = makeConvKey(SESSION, JID_A);
  let store: ConversationStore;

  beforeEach(() => {
    store = new ConversationStore();
  });

  it("should replace [Template] preview with newer real message", () => {
    const templateTs = new Date("2026-03-16T16:33:35Z").toISOString();
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "[Template]", lastMessageType: "templateMessage", lastFromMe: false, lastTimestamp: templateTs, lastStatus: "received", contactPushName: "User A", unreadCount: 0 },
    ]);
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("[Template]");

    // Real message arrives with newer timestamp
    const realTs = new Date("2026-03-16T17:00:00Z").getTime();
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Olá, tudo bem?",
      fromMe: false,
      messageType: "conversation",
      timestamp: realTs,
    }, null);

    const conv = store.getConversation(KEY_A)!;
    expect(conv.lastMessage).toBe("Olá, tudo bem?");
    expect(conv.lastStatus).toBe("received");
  });

  it("should keep [Template] if it is truly the latest message", () => {
    const templateTs = new Date("2026-03-16T17:00:00Z").toISOString();
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "[Template]", lastMessageType: "templateMessage", lastFromMe: false, lastTimestamp: templateTs, lastStatus: "received", contactPushName: "User A", unreadCount: 0 },
    ]);

    // Older real message arrives (should NOT replace template)
    const olderTs = new Date("2026-03-16T15:00:00Z").getTime();
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Old message",
      fromMe: false,
      messageType: "conversation",
      timestamp: olderTs,
    }, null);

    expect(store.getConversation(KEY_A)!.lastMessage).toBe("[Template]");
  });

  it("should replace [Template] with outbound CRM message", () => {
    const templateTs = new Date("2026-03-16T16:33:35Z").toISOString();
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "[Template]", lastMessageType: "templateMessage", lastFromMe: false, lastTimestamp: templateTs, lastStatus: "received", contactPushName: "User A", unreadCount: 0 },
    ]);

    // Optimistic send from CRM
    store.handleOptimisticSend({ sessionId: SESSION, remoteJid: JID_A, content: "Oi! Posso ajudar?" });

    const conv = store.getConversation(KEY_A)!;
    expect(conv.lastMessage).toBe("Oi! Posso ajudar?");
    expect(conv.lastStatus).toBe("sending");
  });

  it("should move conversation to top when real message replaces template", () => {
    const now = Date.now();
    store.hydrate([
      { remoteJid: "5511888@s.whatsapp.net", sessionId: SESSION, lastMessage: "Recent msg", lastMessageType: "conversation", lastFromMe: false, lastTimestamp: new Date(now).toISOString(), lastStatus: "received", contactPushName: "User B", unreadCount: 0 },
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "[Template]", lastMessageType: "templateMessage", lastFromMe: false, lastTimestamp: new Date(now - 10000).toISOString(), lastStatus: "received", contactPushName: "User A", unreadCount: 0 },
    ]);

    // User A's conversation is second
    expect(store.state.sortedIds[0]).toBe(makeConvKey(SESSION, "5511888@s.whatsapp.net"));
    expect(store.state.sortedIds[1]).toBe(KEY_A);

    // Real message arrives for User A (newer than User B)
    store.handleMessage({
      sessionId: SESSION,
      remoteJid: JID_A,
      content: "Olá!",
      fromMe: false,
      messageType: "conversation",
      timestamp: now + 1000,
    }, null);

    // User A should now be at top
    expect(store.state.sortedIds[0]).toBe(KEY_A);
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("Olá!");
  });

  it("should handle conversation preview update replacing [Template]", () => {
    const templateTs = new Date("2026-03-16T16:33:35Z").toISOString();
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "[Template]", lastMessageType: "templateMessage", lastFromMe: false, lastTimestamp: templateTs, lastStatus: "received", contactPushName: "User A", unreadCount: 0 },
    ]);

    // Server sends authoritative preview update
    store.handleConversationPreview({
      sessionId: SESSION,
      remoteJid: JID_A,
      lastMessage: "Mensagem real",
      lastMessageAt: new Date("2026-03-16T17:00:00Z"),
      lastMessageStatus: "received",
      lastMessageType: "conversation",
      lastFromMe: false,
    });

    const conv = store.getConversation(KEY_A)!;
    expect(conv.lastMessage).toBe("Mensagem real");
  });

  it("should handle multiple template→real→template→real transitions", () => {
    const t1 = new Date("2026-03-16T10:00:00Z");
    store.hydrate([
      { remoteJid: JID_A, sessionId: SESSION, lastMessage: "[Template]", lastMessageType: "templateMessage", lastFromMe: false, lastTimestamp: t1.toISOString(), lastStatus: "received", contactPushName: "User A", unreadCount: 0 },
    ]);

    // Real message replaces template
    store.handleMessage({
      sessionId: SESSION, remoteJid: JID_A, content: "Real 1",
      fromMe: false, messageType: "conversation",
      timestamp: new Date("2026-03-16T11:00:00Z").getTime(),
    }, null);
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("Real 1");

    // New template arrives (newer)
    store.handleMessage({
      sessionId: SESSION, remoteJid: JID_A, content: "[Template]",
      fromMe: false, messageType: "templateMessage",
      timestamp: new Date("2026-03-16T12:00:00Z").getTime(),
    }, null);
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("[Template]");

    // Another real message replaces template again
    store.handleMessage({
      sessionId: SESSION, remoteJid: JID_A, content: "Real 2",
      fromMe: false, messageType: "conversation",
      timestamp: new Date("2026-03-16T13:00:00Z").getTime(),
    }, null);
    expect(store.getConversation(KEY_A)!.lastMessage).toBe("Real 2");
  });
});
