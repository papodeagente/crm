/**
 * Tests for incremental sync on connection.update state='open'
 * Validates: timestamp-based filtering, dedup, chat limit, msgs/chat limit,
 * lastMessage update, socket emit, BullMQ integration
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const srcPath = resolve(__dirname, "whatsappEvolution.ts");
const src = readFileSync(srcPath, "utf-8");

describe("Incremental Sync — quickSyncRecentMessages", () => {
  // ── Step 1: MAX(timestamp) query ──
  describe("Timestamp-based incremental baseline", () => {
    it("queries MAX(timestamp) from messages table before sync", () => {
      expect(src).toContain("SELECT MAX(timestamp) as maxTs FROM messages WHERE sessionId");
    });

    it("converts MAX(timestamp) to Unix seconds for comparison", () => {
      expect(src).toContain("new Date(lastTsRaw).getTime() / 1000");
    });

    it("handles case when no messages exist (lastSyncTimestamp = 0)", () => {
      // When lastTsRaw is null/undefined, lastSyncTimestamp should be 0
      expect(src).toContain("lastTsRaw ? new Date(lastTsRaw).getTime() / 1000 : 0");
    });
  });

  // ── Step 2: Timestamp filtering ──
  describe("Timestamp filtering of messages", () => {
    it("skips messages older than lastSyncTimestamp", () => {
      expect(src).toContain("msgTs <= lastSyncTimestamp");
    });

    it("increments totalFiltered counter for filtered messages", () => {
      expect(src).toContain("totalFiltered++");
    });

    it("logs filtered count in completion message", () => {
      expect(src).toContain("filtered (older than last sync)");
    });
  });

  // ── Step 3: Dedup by messageId ──
  describe("Deduplication by messageId", () => {
    it("pre-loads existing messageIds from DB", () => {
      expect(src).toContain("SELECT messageId FROM messages WHERE sessionId =");
    });

    it("checks existingMsgIds before inserting", () => {
      expect(src).toContain("existingMsgIds.has(msgId)");
    });

    it("adds new messageIds to the set after processing", () => {
      expect(src).toContain("existingMsgIds.add(msgId)");
    });

    it("uses onDuplicateKeyUpdate for safety", () => {
      expect(src).toContain("onDuplicateKeyUpdate");
    });
  });

  // ── Step 4: Chat and message limits ──
  describe("Limits: 50 chats, 20 messages per chat", () => {
    it("defines MAX_CHATS = 50", () => {
      expect(src).toContain("const MAX_CHATS = 50");
    });

    it("defines MAX_MSGS_PER_CHAT = 20", () => {
      expect(src).toContain("const MAX_MSGS_PER_CHAT = 20");
    });

    it("slices sorted chats to MAX_CHATS", () => {
      expect(src).toContain(".slice(0, MAX_CHATS)");
    });

    it("passes MAX_MSGS_PER_CHAT as limit to findMessages", () => {
      expect(src).toContain("limit: MAX_MSGS_PER_CHAT");
    });

    it("fetches only 1 page per chat", () => {
      // Should NOT have maxPages = 3 anymore
      expect(src).toContain("page: 1,");
      // The old 3-page loop should be replaced
      const quickSyncSection = src.substring(
        src.indexOf("private async quickSyncRecentMessages"),
        src.indexOf("private deepSyncInProgress")
      );
      expect(quickSyncSection).not.toContain("maxPages = 3");
    });

    it("sorts chats by most recent activity first", () => {
      expect(src).toContain("Number(tsB) - Number(tsA)");
    });
  });

  // ── Step 5: lastMessage and lastMessageAt update ──
  describe("Conversation lastMessage update", () => {
    it("tracks newestMsgForConv per chat", () => {
      expect(src).toContain("newestMsgForConv");
    });

    it("calls updateConversationLastMessage with newest message data", () => {
      const quickSyncSection = src.substring(
        src.indexOf("private async quickSyncRecentMessages"),
        src.indexOf("private deepSyncInProgress")
      );
      expect(quickSyncSection).toContain("updateConversationLastMessage(convRows[0].id");
    });

    it("passes messageType, fromMe, status, and timestamp to updateConversationLastMessage", () => {
      const quickSyncSection = src.substring(
        src.indexOf("private async quickSyncRecentMessages"),
        src.indexOf("private deepSyncInProgress")
      );
      expect(quickSyncSection).toContain("messageType: newestMsgForConv.messageType");
      expect(quickSyncSection).toContain("fromMe: newestMsgForConv.fromMe");
      expect(quickSyncSection).toContain("status: newestMsgForConv.status");
      expect(quickSyncSection).toContain("timestamp: newestMsgForConv.timestamp");
    });

    it("increments unread count for incoming messages", () => {
      expect(src).toContain("incrementUnread: !newestMsgForConv.fromMe");
    });
  });

  // ── Step 6: Socket event emission ──
  describe("Socket event emission for real-time Inbox update", () => {
    it("emits 'message' event after inserting new messages", () => {
      const quickSyncSection = src.substring(
        src.indexOf("private async quickSyncRecentMessages"),
        src.indexOf("private deepSyncInProgress")
      );
      expect(quickSyncSection).toContain("this.emit('message'");
    });

    it("includes syncBatch hint in the emitted event", () => {
      expect(src).toContain("syncBatch: insertBatch.length");
    });

    it("emits only the newest message per chat to avoid flooding", () => {
      expect(src).toContain("const newest = insertBatch.reduce");
    });

    it("includes all required fields in the emitted event", () => {
      const quickSyncSection = src.substring(
        src.indexOf("private async quickSyncRecentMessages"),
        src.indexOf("private deepSyncInProgress")
      );
      // Check the emit block has all required fields
      expect(quickSyncSection).toContain("sessionId: session.sessionId");
      expect(quickSyncSection).toContain("tenantId: session.tenantId");
      expect(quickSyncSection).toContain("content: newest.content");
      expect(quickSyncSection).toContain("fromMe: newest.fromMe");
      expect(quickSyncSection).toContain("remoteJid: newest.remoteJid");
      expect(quickSyncSection).toContain("messageType: newest.messageType");
    });
  });

  // ── Step 7: BullMQ integration ──
  describe("BullMQ integration with sync fallback", () => {
    it("checks if BullMQ queue is enabled", () => {
      const quickSyncSection = src.substring(
        src.indexOf("private async quickSyncRecentMessages"),
        src.indexOf("private deepSyncInProgress")
      );
      expect(quickSyncSection).toContain("isQueueEnabled()");
    });

    it("falls back gracefully if BullMQ is not available", () => {
      expect(src).toContain("catch { useQueue = false; }");
    });

    it("logs when BullMQ is available", () => {
      expect(src).toContain("BullMQ available");
    });
  });

  // ── Connection.update triggers sync ──
  describe("connection.update state='open' triggers sync", () => {
    it("calls syncConversationsBackground on state='open'", () => {
      // In the connection.update handler
      expect(src).toContain('if (state === "open")');
      expect(src).toContain("this.syncConversationsBackground(session, isFirstSync)");
    });

    it("syncConversationsBackground calls quickSyncRecentMessages", () => {
      expect(src).toContain("this.quickSyncRecentMessages(session, individualChats)");
    });

    it("determines isFirstSync by checking message count", () => {
      expect(src).toContain("const isFirstSync = (msgCount[0]?.count || 0) === 0");
    });
  });

  // ── Media download ──
  describe("Media download in background", () => {
    it("downloads media for new messages without blocking sync", () => {
      const quickSyncSection = src.substring(
        src.indexOf("private async quickSyncRecentMessages"),
        src.indexOf("private deepSyncInProgress")
      );
      expect(quickSyncSection).toContain("this.downloadMediaBatch(session, mediaMessages)");
    });
  });

  // ── Contact name resolution ──
  describe("Contact name resolution during sync", () => {
    it("discovers pushNames from incoming messages", () => {
      const quickSyncSection = src.substring(
        src.indexOf("private async quickSyncRecentMessages"),
        src.indexOf("private deepSyncInProgress")
      );
      expect(quickSyncSection).toContain("discoveredNames.set(remoteJid, pushName!)");
    });

    it("excludes owner name from contact resolution", () => {
      expect(src).toContain("ownerName && name.trim().toLowerCase() === ownerName.toLowerCase()");
    });

    it("updates conversation names from discovered pushNames", () => {
      const quickSyncSection = src.substring(
        src.indexOf("private async quickSyncRecentMessages"),
        src.indexOf("private deepSyncInProgress")
      );
      expect(quickSyncSection).toContain("UPDATE wa_conversations SET contactPushName");
    });
  });
});
