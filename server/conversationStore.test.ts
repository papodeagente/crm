/**
 * Tests for the deterministic ConversationStore
 * Uses conversationKey = sessionId + ":" + remoteJid
 * Validates: hydration, handleMessage (preview/order/unread), markRead, statusUpdate, performance
 */
import { describe, expect, it } from "vitest";

// Re-implement the core store class for unit testing (no React imports)

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
  conversationId?: number;
  assignedUserId?: number | null;
}

function makeConvKey(sessionId: string, remoteJid: string): string {
  return `${sessionId}:${remoteJid}`;
}

function getJidFromKey(key: string): string {
  const idx = key.indexOf(":");
  return idx >= 0 ? key.slice(idx + 1) : key;
}

class ConversationStore {
  conversationMap = new Map<string, ConvEntry>();
  sortedIds: string[] = [];

  hydrate(conversations: ConvEntry[], defaultSessionId?: string) {
    const map = new Map<string, ConvEntry>();
    const ids: string[] = [];
    for (const c of conversations) {
      const jid = c.remoteJid;
      if (!jid) continue;
      const sid = c.sessionId || defaultSessionId || "";
      const key = makeConvKey(sid, jid);
      const entry: ConvEntry = { ...c, conversationKey: key, sessionId: sid };
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
    this.conversationMap = map;
    this.sortedIds = ids;
  }

  handleMessage(msg: {
    sessionId: string;
    remoteJid: string;
    content: string;
    fromMe: boolean;
    messageType: string;
    timestamp: number;
  }, activeKey: string | null): boolean {
    const key = makeConvKey(msg.sessionId, msg.remoteJid);
    if (!key || !msg.remoteJid) return false;
    const existing = this.conversationMap.get(key);
    if (!existing) return false;

    const msgTimestamp = new Date(msg.timestamp);
    const existingTimestamp = existing.lastTimestamp ? new Date(existing.lastTimestamp).getTime() : 0;
    if (msgTimestamp.getTime() < existingTimestamp) return true;

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
      lastTimestamp: msgTimestamp,
      lastStatus: msg.fromMe ? "sent" : "received",
      unreadCount: newUnread,
    };

    // New Map reference
    this.conversationMap = new Map(this.conversationMap);
    this.conversationMap.set(key, updated);

    // Move to top
    const currentIdx = this.sortedIds.indexOf(key);
    if (currentIdx === 0) {
      this.sortedIds = [...this.sortedIds];
    } else if (currentIdx > 0) {
      this.sortedIds = [key, ...this.sortedIds.slice(0, currentIdx), ...this.sortedIds.slice(currentIdx + 1)];
    } else {
      this.sortedIds = [key, ...this.sortedIds];
    }
    return true;
  }

  handleStatusUpdate(update: { sessionId: string; remoteJid: string; status: string }) {
    const key = makeConvKey(update.sessionId, update.remoteJid);
    const existing = this.conversationMap.get(key);
    if (!existing || !existing.lastFromMe) return;
    this.conversationMap = new Map(this.conversationMap);
    this.conversationMap.set(key, { ...existing, lastStatus: update.status });
  }

  markRead(conversationKey: string) {
    const existing = this.conversationMap.get(conversationKey);
    if (!existing || Number(existing.unreadCount) === 0) return;
    this.conversationMap = new Map(this.conversationMap);
    this.conversationMap.set(conversationKey, { ...existing, unreadCount: 0 });
  }

  getSorted(): ConvEntry[] {
    return this.sortedIds.map(id => this.conversationMap.get(id)!).filter(Boolean);
  }
}

// ─── Test Data ───

const SESSION = "instance1";

function makeConv(jid: string, ts: number, msg: string, unread = 0): ConvEntry {
  return {
    remoteJid: jid,
    sessionId: SESSION,
    lastMessage: msg,
    lastMessageType: "text",
    lastFromMe: false,
    lastTimestamp: new Date(ts).toISOString(),
    lastStatus: "received",
    contactPushName: `User ${jid.split("@")[0]}`,
    unreadCount: unread,
    conversationId: Math.floor(Math.random() * 10000),
  };
}

const NOW = Date.now();
const MIN = 60000;

describe("ConversationStore (conversationKey)", () => {
  describe("hydrate", () => {
    it("sorts conversations by lastTimestamp DESC using conversationKey", () => {
      const store = new ConversationStore();
      store.hydrate([
        makeConv("c@s.whatsapp.net", NOW - 10 * MIN, "old"),
        makeConv("a@s.whatsapp.net", NOW, "newest"),
        makeConv("b@s.whatsapp.net", NOW - 5 * MIN, "middle"),
      ], SESSION);

      expect(store.sortedIds).toEqual([
        makeConvKey(SESSION, "a@s.whatsapp.net"),
        makeConvKey(SESSION, "b@s.whatsapp.net"),
        makeConvKey(SESSION, "c@s.whatsapp.net"),
      ]);
    });

    it("deduplicates by conversationKey keeping newest", () => {
      const store = new ConversationStore();
      store.hydrate([
        makeConv("a@s.whatsapp.net", NOW - 10 * MIN, "old msg"),
        makeConv("a@s.whatsapp.net", NOW, "new msg"),
      ], SESSION);

      const key = makeConvKey(SESSION, "a@s.whatsapp.net");
      expect(store.conversationMap.size).toBe(1);
      expect(store.conversationMap.get(key)?.lastMessage).toBe("new msg");
    });

    it("handles empty array", () => {
      const store = new ConversationStore();
      store.hydrate([], SESSION);
      expect(store.sortedIds).toEqual([]);
      expect(store.conversationMap.size).toBe(0);
    });

    it("sets conversationKey on each entry", () => {
      const store = new ConversationStore();
      store.hydrate([makeConv("a@s.whatsapp.net", NOW, "msg")], SESSION);
      const key = makeConvKey(SESSION, "a@s.whatsapp.net");
      expect(store.conversationMap.get(key)?.conversationKey).toBe(key);
    });
  });

  describe("handleMessage", () => {
    it("updates preview and moves conversation to top", () => {
      const store = new ConversationStore();
      store.hydrate([
        makeConv("a@s.whatsapp.net", NOW, "msg a"),
        makeConv("b@s.whatsapp.net", NOW - 5 * MIN, "msg b"),
        makeConv("c@s.whatsapp.net", NOW - 10 * MIN, "msg c"),
      ], SESSION);

      const handled = store.handleMessage({
        sessionId: SESSION,
        remoteJid: "b@s.whatsapp.net",
        content: "new msg from b",
        fromMe: false,
        messageType: "text",
        timestamp: NOW + MIN,
      }, null);

      const keyB = makeConvKey(SESSION, "b@s.whatsapp.net");
      expect(handled).toBe(true);
      expect(store.sortedIds[0]).toBe(keyB);
      expect(store.conversationMap.get(keyB)?.lastMessage).toBe("new msg from b");
    });

    it("increments unread when not active conversation", () => {
      const store = new ConversationStore();
      store.hydrate([makeConv("a@s.whatsapp.net", NOW, "msg", 2)], SESSION);

      store.handleMessage({
        sessionId: SESSION,
        remoteJid: "a@s.whatsapp.net",
        content: "new",
        fromMe: false,
        messageType: "text",
        timestamp: NOW + MIN,
      }, null);

      const key = makeConvKey(SESSION, "a@s.whatsapp.net");
      expect(Number(store.conversationMap.get(key)?.unreadCount)).toBe(3);
    });

    it("does NOT increment unread when conversation is active (by key)", () => {
      const store = new ConversationStore();
      store.hydrate([makeConv("a@s.whatsapp.net", NOW, "msg", 2)], SESSION);

      const key = makeConvKey(SESSION, "a@s.whatsapp.net");
      store.handleMessage({
        sessionId: SESSION,
        remoteJid: "a@s.whatsapp.net",
        content: "new",
        fromMe: false,
        messageType: "text",
        timestamp: NOW + MIN,
      }, key); // active key matches

      expect(Number(store.conversationMap.get(key)?.unreadCount)).toBe(0);
    });

    it("returns false for unknown conversation", () => {
      const store = new ConversationStore();
      store.hydrate([makeConv("a@s.whatsapp.net", NOW, "msg")], SESSION);

      const handled = store.handleMessage({
        sessionId: SESSION,
        remoteJid: "unknown@s.whatsapp.net",
        content: "hello",
        fromMe: false,
        messageType: "text",
        timestamp: NOW + MIN,
      }, null);

      expect(handled).toBe(false);
    });

    it("ignores older messages", () => {
      const store = new ConversationStore();
      store.hydrate([makeConv("a@s.whatsapp.net", NOW, "current msg")], SESSION);

      store.handleMessage({
        sessionId: SESSION,
        remoteJid: "a@s.whatsapp.net",
        content: "old msg",
        fromMe: false,
        messageType: "text",
        timestamp: NOW - 10 * MIN,
      }, null);

      const key = makeConvKey(SESSION, "a@s.whatsapp.net");
      expect(store.conversationMap.get(key)?.lastMessage).toBe("current msg");
    });

    it("does not move conversation already at top", () => {
      const store = new ConversationStore();
      store.hydrate([
        makeConv("a@s.whatsapp.net", NOW, "msg a"),
        makeConv("b@s.whatsapp.net", NOW - 5 * MIN, "msg b"),
      ], SESSION);

      store.handleMessage({
        sessionId: SESSION,
        remoteJid: "a@s.whatsapp.net",
        content: "another msg",
        fromMe: false,
        messageType: "text",
        timestamp: NOW + MIN,
      }, null);

      expect(store.sortedIds).toEqual([
        makeConvKey(SESSION, "a@s.whatsapp.net"),
        makeConvKey(SESSION, "b@s.whatsapp.net"),
      ]);
    });

    it("creates new Map and array references (immutability)", () => {
      const store = new ConversationStore();
      store.hydrate([
        makeConv("a@s.whatsapp.net", NOW, "msg a"),
        makeConv("b@s.whatsapp.net", NOW - 5 * MIN, "msg b"),
      ], SESSION);

      const oldMap = store.conversationMap;
      const oldIds = store.sortedIds;

      store.handleMessage({
        sessionId: SESSION,
        remoteJid: "b@s.whatsapp.net",
        content: "new msg",
        fromMe: false,
        messageType: "text",
        timestamp: NOW + MIN,
      }, null);

      expect(store.conversationMap).not.toBe(oldMap);
      expect(store.sortedIds).not.toBe(oldIds);
    });
  });

  describe("markRead", () => {
    it("sets unreadCount to 0 using conversationKey", () => {
      const store = new ConversationStore();
      store.hydrate([makeConv("a@s.whatsapp.net", NOW, "msg", 5)], SESSION);

      const key = makeConvKey(SESSION, "a@s.whatsapp.net");
      store.markRead(key);
      expect(Number(store.conversationMap.get(key)?.unreadCount)).toBe(0);
    });

    it("does nothing for already-read conversation", () => {
      const store = new ConversationStore();
      store.hydrate([makeConv("a@s.whatsapp.net", NOW, "msg", 0)], SESSION);

      const key = makeConvKey(SESSION, "a@s.whatsapp.net");
      store.markRead(key);
      expect(Number(store.conversationMap.get(key)?.unreadCount)).toBe(0);
    });
  });

  describe("handleStatusUpdate", () => {
    it("updates lastStatus for fromMe messages using conversationKey", () => {
      const store = new ConversationStore();
      const conv = makeConv("a@s.whatsapp.net", NOW, "sent msg");
      conv.lastFromMe = true;
      conv.lastStatus = "sent";
      store.hydrate([conv], SESSION);

      store.handleStatusUpdate({ sessionId: SESSION, remoteJid: "a@s.whatsapp.net", status: "read" });
      const key = makeConvKey(SESSION, "a@s.whatsapp.net");
      expect(store.conversationMap.get(key)?.lastStatus).toBe("read");
    });

    it("does NOT update status for non-fromMe messages", () => {
      const store = new ConversationStore();
      const conv = makeConv("a@s.whatsapp.net", NOW, "received msg");
      conv.lastFromMe = false;
      conv.lastStatus = "received";
      store.hydrate([conv], SESSION);

      store.handleStatusUpdate({ sessionId: SESSION, remoteJid: "a@s.whatsapp.net", status: "read" });
      const key = makeConvKey(SESSION, "a@s.whatsapp.net");
      expect(store.conversationMap.get(key)?.lastStatus).toBe("received");
    });
  });

  describe("getJidFromKey", () => {
    it("extracts remoteJid from conversationKey", () => {
      expect(getJidFromKey("instance1:558499@s.whatsapp.net")).toBe("558499@s.whatsapp.net");
    });

    it("returns full string if no colon", () => {
      expect(getJidFromKey("558499@s.whatsapp.net")).toBe("558499@s.whatsapp.net");
    });
  });

  describe("performance", () => {
    it("handleMessage completes in < 20ms for 1000 conversations", () => {
      const store = new ConversationStore();
      const convs: ConvEntry[] = [];
      for (let i = 0; i < 1000; i++) {
        convs.push(makeConv(`${i}@s.whatsapp.net`, NOW - i * MIN, `msg ${i}`));
      }
      store.hydrate(convs, SESSION);

      const lastKey = makeConvKey(SESSION, "999@s.whatsapp.net");
      const start = performance.now();
      store.handleMessage({
        sessionId: SESSION,
        remoteJid: "999@s.whatsapp.net",
        content: "new message",
        fromMe: false,
        messageType: "text",
        timestamp: NOW + MIN,
      }, null);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(20);
      expect(store.sortedIds[0]).toBe(lastKey);
    });

    it("hydrate completes in < 100ms for 1000 conversations", () => {
      const store = new ConversationStore();
      const convs: ConvEntry[] = [];
      for (let i = 0; i < 1000; i++) {
        convs.push(makeConv(`${i}@s.whatsapp.net`, NOW - i * MIN, `msg ${i}`));
      }

      const start = performance.now();
      store.hydrate(convs, SESSION);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
      expect(store.conversationMap.size).toBe(1000);
    });
  });

  describe("getSorted", () => {
    it("returns conversations in sorted order", () => {
      const store = new ConversationStore();
      store.hydrate([
        makeConv("c@s.whatsapp.net", NOW - 10 * MIN, "old"),
        makeConv("a@s.whatsapp.net", NOW, "newest"),
        makeConv("b@s.whatsapp.net", NOW - 5 * MIN, "middle"),
      ], SESSION);

      const sorted = store.getSorted();
      expect(sorted.length).toBe(3);
      expect(sorted[0].remoteJid).toBe("a@s.whatsapp.net");
      expect(sorted[1].remoteJid).toBe("b@s.whatsapp.net");
      expect(sorted[2].remoteJid).toBe("c@s.whatsapp.net");
    });

    it("reflects order changes after handleMessage", () => {
      const store = new ConversationStore();
      store.hydrate([
        makeConv("a@s.whatsapp.net", NOW, "msg a"),
        makeConv("b@s.whatsapp.net", NOW - 5 * MIN, "msg b"),
      ], SESSION);

      store.handleMessage({
        sessionId: SESSION,
        remoteJid: "b@s.whatsapp.net",
        content: "new msg",
        fromMe: false,
        messageType: "text",
        timestamp: NOW + MIN,
      }, null);

      const sorted = store.getSorted();
      expect(sorted[0].remoteJid).toBe("b@s.whatsapp.net");
      expect(sorted[0].lastMessage).toBe("new msg");
    });
  });

  describe("multi-session", () => {
    it("treats same JID from different sessions as separate conversations", () => {
      const store = new ConversationStore();
      const conv1 = makeConv("a@s.whatsapp.net", NOW, "from session1");
      conv1.sessionId = "session1";
      const conv2 = makeConv("a@s.whatsapp.net", NOW - MIN, "from session2");
      conv2.sessionId = "session2";

      store.hydrate([conv1, conv2]);

      expect(store.conversationMap.size).toBe(2);
      const key1 = makeConvKey("session1", "a@s.whatsapp.net");
      const key2 = makeConvKey("session2", "a@s.whatsapp.net");
      expect(store.conversationMap.get(key1)?.lastMessage).toBe("from session1");
      expect(store.conversationMap.get(key2)?.lastMessage).toBe("from session2");
    });
  });
});
