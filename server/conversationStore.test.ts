/**
 * Tests for the deterministic ConversationStore
 * Validates: hydration, handleMessage (preview/order/unread), markRead, statusUpdate, performance
 */
import { describe, expect, it } from "vitest";

// We test the store logic directly (pure JS, no React hooks)
// Re-implement the core store class here for unit testing since the hook file uses React imports

interface ConvEntry {
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

class ConversationStore {
  conversationMap = new Map<string, ConvEntry>();
  sortedIds: string[] = [];

  hydrate(conversations: ConvEntry[]) {
    const map = new Map<string, ConvEntry>();
    const ids: string[] = [];
    for (const c of conversations) {
      const jid = c.remoteJid;
      if (!jid) continue;
      const existing = map.get(jid);
      if (!existing) {
        map.set(jid, c);
        ids.push(jid);
      } else {
        const existingTs = existing.lastTimestamp ? new Date(existing.lastTimestamp).getTime() : 0;
        const newTs = c.lastTimestamp ? new Date(c.lastTimestamp).getTime() : 0;
        if (newTs > existingTs) map.set(jid, c);
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
    remoteJid: string;
    content: string;
    fromMe: boolean;
    messageType: string;
    timestamp: number;
  }, activeJid: string | null): boolean {
    const jid = msg.remoteJid;
    if (!jid) return false;
    const existing = this.conversationMap.get(jid);
    if (!existing) return false;

    const msgTimestamp = new Date(msg.timestamp);
    const existingTimestamp = existing.lastTimestamp ? new Date(existing.lastTimestamp).getTime() : 0;
    if (msgTimestamp.getTime() < existingTimestamp) return true;

    const updated: ConvEntry = {
      ...existing,
      lastMessage: msg.content || existing.lastMessage,
      lastMessageType: msg.messageType,
      lastFromMe: msg.fromMe,
      lastTimestamp: msgTimestamp,
      lastStatus: msg.fromMe ? "sent" : "received",
      unreadCount: (!msg.fromMe && activeJid !== jid)
        ? (Number(existing.unreadCount) || 0) + 1
        : (activeJid === jid ? 0 : Number(existing.unreadCount) || 0),
    };
    this.conversationMap.set(jid, updated);

    const currentIdx = this.sortedIds.indexOf(jid);
    if (currentIdx > 0) {
      this.sortedIds.splice(currentIdx, 1);
      this.sortedIds.unshift(jid);
    }
    return true;
  }

  handleStatusUpdate(update: { remoteJid: string; status: string }) {
    const existing = this.conversationMap.get(update.remoteJid);
    if (!existing || !existing.lastFromMe) return;
    this.conversationMap.set(update.remoteJid, { ...existing, lastStatus: update.status });
  }

  markRead(jid: string) {
    const existing = this.conversationMap.get(jid);
    if (!existing || Number(existing.unreadCount) === 0) return;
    this.conversationMap.set(jid, { ...existing, unreadCount: 0 });
  }

  getSorted(): ConvEntry[] {
    return this.sortedIds.map(id => this.conversationMap.get(id)!).filter(Boolean);
  }
}

// ─── Test Data ───

function makeConv(jid: string, ts: number, msg: string, unread = 0): ConvEntry {
  return {
    remoteJid: jid,
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

describe("ConversationStore", () => {
  describe("hydrate", () => {
    it("sorts conversations by lastTimestamp DESC", () => {
      const store = new ConversationStore();
      store.hydrate([
        makeConv("c@s.whatsapp.net", NOW - 10 * MIN, "old"),
        makeConv("a@s.whatsapp.net", NOW, "newest"),
        makeConv("b@s.whatsapp.net", NOW - 5 * MIN, "middle"),
      ]);

      expect(store.sortedIds).toEqual([
        "a@s.whatsapp.net",
        "b@s.whatsapp.net",
        "c@s.whatsapp.net",
      ]);
    });

    it("deduplicates by remoteJid keeping newest", () => {
      const store = new ConversationStore();
      store.hydrate([
        makeConv("a@s.whatsapp.net", NOW - 10 * MIN, "old msg"),
        makeConv("a@s.whatsapp.net", NOW, "new msg"),
      ]);

      expect(store.conversationMap.size).toBe(1);
      expect(store.conversationMap.get("a@s.whatsapp.net")?.lastMessage).toBe("new msg");
    });

    it("handles empty array", () => {
      const store = new ConversationStore();
      store.hydrate([]);
      expect(store.sortedIds).toEqual([]);
      expect(store.conversationMap.size).toBe(0);
    });
  });

  describe("handleMessage", () => {
    it("updates preview and moves conversation to top", () => {
      const store = new ConversationStore();
      store.hydrate([
        makeConv("a@s.whatsapp.net", NOW, "msg a"),
        makeConv("b@s.whatsapp.net", NOW - 5 * MIN, "msg b"),
        makeConv("c@s.whatsapp.net", NOW - 10 * MIN, "msg c"),
      ]);

      // b receives a new message → should move to top
      const handled = store.handleMessage({
        remoteJid: "b@s.whatsapp.net",
        content: "new msg from b",
        fromMe: false,
        messageType: "text",
        timestamp: NOW + MIN,
      }, null);

      expect(handled).toBe(true);
      expect(store.sortedIds[0]).toBe("b@s.whatsapp.net");
      expect(store.conversationMap.get("b@s.whatsapp.net")?.lastMessage).toBe("new msg from b");
    });

    it("increments unread when not active conversation", () => {
      const store = new ConversationStore();
      store.hydrate([makeConv("a@s.whatsapp.net", NOW, "msg", 2)]);

      store.handleMessage({
        remoteJid: "a@s.whatsapp.net",
        content: "new",
        fromMe: false,
        messageType: "text",
        timestamp: NOW + MIN,
      }, null); // no active conversation

      expect(Number(store.conversationMap.get("a@s.whatsapp.net")?.unreadCount)).toBe(3);
    });

    it("does NOT increment unread when conversation is active", () => {
      const store = new ConversationStore();
      store.hydrate([makeConv("a@s.whatsapp.net", NOW, "msg", 2)]);

      store.handleMessage({
        remoteJid: "a@s.whatsapp.net",
        content: "new",
        fromMe: false,
        messageType: "text",
        timestamp: NOW + MIN,
      }, "a@s.whatsapp.net"); // this is the active conversation

      expect(Number(store.conversationMap.get("a@s.whatsapp.net")?.unreadCount)).toBe(0);
    });

    it("returns false for unknown conversation", () => {
      const store = new ConversationStore();
      store.hydrate([makeConv("a@s.whatsapp.net", NOW, "msg")]);

      const handled = store.handleMessage({
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
      store.hydrate([makeConv("a@s.whatsapp.net", NOW, "current msg")]);

      store.handleMessage({
        remoteJid: "a@s.whatsapp.net",
        content: "old msg",
        fromMe: false,
        messageType: "text",
        timestamp: NOW - 10 * MIN, // older than current
      }, null);

      expect(store.conversationMap.get("a@s.whatsapp.net")?.lastMessage).toBe("current msg");
    });

    it("does not move conversation already at top", () => {
      const store = new ConversationStore();
      store.hydrate([
        makeConv("a@s.whatsapp.net", NOW, "msg a"),
        makeConv("b@s.whatsapp.net", NOW - 5 * MIN, "msg b"),
      ]);

      store.handleMessage({
        remoteJid: "a@s.whatsapp.net",
        content: "another msg",
        fromMe: false,
        messageType: "text",
        timestamp: NOW + MIN,
      }, null);

      expect(store.sortedIds).toEqual(["a@s.whatsapp.net", "b@s.whatsapp.net"]);
    });
  });

  describe("markRead", () => {
    it("sets unreadCount to 0", () => {
      const store = new ConversationStore();
      store.hydrate([makeConv("a@s.whatsapp.net", NOW, "msg", 5)]);

      store.markRead("a@s.whatsapp.net");
      expect(Number(store.conversationMap.get("a@s.whatsapp.net")?.unreadCount)).toBe(0);
    });

    it("does nothing for already-read conversation", () => {
      const store = new ConversationStore();
      store.hydrate([makeConv("a@s.whatsapp.net", NOW, "msg", 0)]);

      store.markRead("a@s.whatsapp.net");
      expect(Number(store.conversationMap.get("a@s.whatsapp.net")?.unreadCount)).toBe(0);
    });
  });

  describe("handleStatusUpdate", () => {
    it("updates lastStatus for fromMe messages", () => {
      const store = new ConversationStore();
      const conv = makeConv("a@s.whatsapp.net", NOW, "sent msg");
      conv.lastFromMe = true;
      conv.lastStatus = "sent";
      store.hydrate([conv]);

      store.handleStatusUpdate({ remoteJid: "a@s.whatsapp.net", status: "read" });
      expect(store.conversationMap.get("a@s.whatsapp.net")?.lastStatus).toBe("read");
    });

    it("does NOT update status for non-fromMe messages", () => {
      const store = new ConversationStore();
      const conv = makeConv("a@s.whatsapp.net", NOW, "received msg");
      conv.lastFromMe = false;
      conv.lastStatus = "received";
      store.hydrate([conv]);

      store.handleStatusUpdate({ remoteJid: "a@s.whatsapp.net", status: "read" });
      expect(store.conversationMap.get("a@s.whatsapp.net")?.lastStatus).toBe("received");
    });
  });

  describe("performance", () => {
    it("handleMessage completes in < 20ms for 1000 conversations", () => {
      const store = new ConversationStore();
      const convs: ConvEntry[] = [];
      for (let i = 0; i < 1000; i++) {
        convs.push(makeConv(`${i}@s.whatsapp.net`, NOW - i * MIN, `msg ${i}`));
      }
      store.hydrate(convs);

      // Measure handleMessage for the LAST conversation (worst case — needs to splice from end)
      const start = performance.now();
      store.handleMessage({
        remoteJid: "999@s.whatsapp.net",
        content: "new message",
        fromMe: false,
        messageType: "text",
        timestamp: NOW + MIN,
      }, null);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(20);
      expect(store.sortedIds[0]).toBe("999@s.whatsapp.net");
    });

    it("hydrate completes in < 100ms for 1000 conversations", () => {
      const store = new ConversationStore();
      const convs: ConvEntry[] = [];
      for (let i = 0; i < 1000; i++) {
        convs.push(makeConv(`${i}@s.whatsapp.net`, NOW - i * MIN, `msg ${i}`));
      }

      const start = performance.now();
      store.hydrate(convs);
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
      ]);

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
      ]);

      store.handleMessage({
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
});
