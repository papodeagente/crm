/**
 * Inbox Stabilization Tests
 * 
 * Covers:
 * 1. messageType passed to updateConversationLastMessage in all 8 call sites
 * 2. Status regression prevention (read → delivered should NOT regress)
 * 3. Redis error suppression (max 3 errors logged)
 * 4. conversationResolver accepts messageType and status fields
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Helper: read source files ──
const serverDir = path.resolve(__dirname);
const evoFile = fs.readFileSync(path.join(serverDir, "whatsappEvolution.ts"), "utf-8");
const workerFile = fs.readFileSync(path.join(serverDir, "messageWorker.ts"), "utf-8");
const resolverFile = fs.readFileSync(path.join(serverDir, "conversationResolver.ts"), "utf-8");
const queueFile = fs.readFileSync(path.join(serverDir, "messageQueue.ts"), "utf-8");

// ── 1. messageType in all updateConversationLastMessage calls ──

describe("messageType in updateConversationLastMessage calls", () => {
  // Extract all blocks that call updateConversationLastMessage
  function extractCallBlocks(source: string): string[] {
    const blocks: string[] = [];
    const regex = /updateConversationLastMessage\([\s\S]*?\{[\s\S]*?\}\)/g;
    let match;
    while ((match = regex.exec(source)) !== null) {
      blocks.push(match[0]);
    }
    return blocks;
  }

  it("whatsappEvolution.ts — all 7 calls include messageType", () => {
    const calls = extractCallBlocks(evoFile);
    // Filter out the import line
    const actualCalls = calls.filter(c => c.includes("content"));
    expect(actualCalls.length).toBeGreaterThanOrEqual(7);
    for (const call of actualCalls) {
      expect(call).toContain("messageType");
    }
  });

  it("messageWorker.ts — call includes messageType", () => {
    const calls = extractCallBlocks(workerFile);
    const actualCalls = calls.filter(c => c.includes("content"));
    expect(actualCalls.length).toBeGreaterThanOrEqual(1);
    for (const call of actualCalls) {
      expect(call).toContain("messageType");
    }
  });

  it("all calls include status field", () => {
    const evoCalls = extractCallBlocks(evoFile).filter(c => c.includes("content"));
    const workerCalls = extractCallBlocks(workerFile).filter(c => c.includes("content"));
    const allCalls = [...evoCalls, ...workerCalls];
    expect(allCalls.length).toBeGreaterThanOrEqual(8);
    for (const call of allCalls) {
      expect(call).toContain("status");
    }
  });

  it("sendTextMessage uses messageType 'conversation'", () => {
    // The sendTextMessage call should use "conversation" as messageType
    // Find the block between sendTextMessage function and sendMediaMessage function
    const sendTextBlock = evoFile.match(/sendTextMessage[\s\S]*?sendMediaMessage/)?.[0] || "";
    expect(sendTextBlock).toContain('messageType: "conversation"');
  });

  it("sendTextWithQuote uses messageType 'extendedTextMessage'", () => {
    const sendQuoteBlock = evoFile.match(/sendTextWithQuote[\s\S]*?deleteMessage/)?.[0] || "";
    expect(sendQuoteBlock).toContain('messageType: "extendedTextMessage"');
  });

  it("sendMediaMessage uses dynamic messageType based on media type", () => {
    const sendMediaBlock = evoFile.match(/sendMediaMessage[\s\S]*?sendTextWithQuote/)?.[0] || "";
    expect(sendMediaBlock).toContain("pttMessage");
    expect(sendMediaBlock).toContain("documentMessage");
  });
});

// ── 2. Status regression prevention ──

describe("status regression prevention", () => {
  it("handleMessageStatusUpdate has statusPriority map", () => {
    expect(evoFile).toContain("statusPriority");
    expect(evoFile).toContain("error: 0, pending: 1, sent: 2, delivered: 3, read: 4, played: 5");
  });

  it("uses SQL FIELD() for conditional update", () => {
    expect(evoFile).toContain("FIELD(status, 'error','pending','sent','delivered','read','played')");
    expect(evoFile).toContain("FIELD(${newStatus}, 'error','pending','sent','delivered','read','played')");
  });

  it("only updates if new status has higher priority", () => {
    // The SQL should use < comparison to only update when current < new
    const regressionBlock = evoFile.match(/Prevent status regression[\s\S]*?Unknown status/)?.[0] || "";
    expect(regressionBlock).toContain("< FIELD(${newStatus}");
  });

  it("falls back to unconditional update for unknown statuses", () => {
    const regressionBlock = evoFile.match(/Prevent status regression[\s\S]*?Unknown status[\s\S]*?\}/)?.[0] || "";
    expect(regressionBlock).toContain("Unknown status, update unconditionally");
  });

  it("status priority order is correct: error < pending < sent < delivered < read < played", () => {
    const priorityMatch = evoFile.match(/statusPriority.*?=.*?\{([^}]+)\}/);
    expect(priorityMatch).toBeTruthy();
    const priorityStr = priorityMatch![1];
    // Extract values
    const errorVal = parseInt(priorityStr.match(/error:\s*(\d+)/)?.[1] || "-1");
    const pendingVal = parseInt(priorityStr.match(/pending:\s*(\d+)/)?.[1] || "-1");
    const sentVal = parseInt(priorityStr.match(/sent:\s*(\d+)/)?.[1] || "-1");
    const deliveredVal = parseInt(priorityStr.match(/delivered:\s*(\d+)/)?.[1] || "-1");
    const readVal = parseInt(priorityStr.match(/read:\s*(\d+)/)?.[1] || "-1");
    const playedVal = parseInt(priorityStr.match(/played:\s*(\d+)/)?.[1] || "-1");

    expect(errorVal).toBeLessThan(pendingVal);
    expect(pendingVal).toBeLessThan(sentVal);
    expect(sentVal).toBeLessThan(deliveredVal);
    expect(deliveredVal).toBeLessThan(readVal);
    expect(readVal).toBeLessThan(playedVal);
  });
});

// ── 3. conversationResolver accepts messageType and status ──

describe("conversationResolver updateConversationLastMessage", () => {
  it("function signature accepts messageType parameter", () => {
    expect(resolverFile).toContain("messageType?: string");
  });

  it("function signature accepts status parameter", () => {
    expect(resolverFile).toContain("status?: string");
  });

  it("defaults messageType to 'text' when not provided", () => {
    expect(resolverFile).toContain('lastMessageType: data.messageType || "text"');
  });

  it("defaults status to 'received' when not provided", () => {
    expect(resolverFile).toContain('lastStatus: data.status || "received"');
  });

  it("stores lastMessagePreview truncated to 300 chars", () => {
    expect(resolverFile).toContain("substring(0, 300)");
  });

  it("increments unreadCount only for incoming messages", () => {
    expect(resolverFile).toContain("data.incrementUnread && !data.fromMe");
  });
});

// ── 4. Redis error suppression ──

describe("Redis error suppression", () => {
  it("worker error handler limits logged errors", () => {
    expect(queueFile).toContain("workerErrorCount");
    expect(queueFile).toContain("workerErrorCount <= 3");
  });

  it("shows suppression message after 3 errors", () => {
    expect(queueFile).toContain("Suppressing further worker errors");
  });

  it("Redis connection error handler logs only first error", () => {
    expect(queueFile).toContain("firstErrorLogged");
  });

  it("retryStrategy stops after 5 retries", () => {
    expect(queueFile).toContain("times > 5");
  });
});

// ── 5. handleMessageStatusUpdate supports both numeric and string formats ──

describe("message status format support", () => {
  it("supports numeric status format (Baileys)", () => {
    expect(evoFile).toContain("numericStatusMap");
    expect(evoFile).toContain("0: \"error\", 1: \"pending\", 2: \"sent\", 3: \"delivered\", 4: \"read\", 5: \"played\"");
  });

  it("supports string status format (Evolution v2)", () => {
    expect(evoFile).toContain("stringStatusMap");
    expect(evoFile).toContain("SERVER_ACK");
    expect(evoFile).toContain("DELIVERY_ACK");
  });

  it("emits message:status event with correct payload", () => {
    const statusBlock = evoFile.match(/this\.emit\("message:status"[\s\S]*?\}\)/)?.[0] || "";
    expect(statusBlock).toContain("sessionId");
    expect(statusBlock).toContain("messageId");
    expect(statusBlock).toContain("status: newStatus");
  });
});

// ── 6. Sync status resolution ──

describe("sync status resolution", () => {
  it("syncConversationsBackground resolves status from Evolution data", () => {
    const syncBlock = evoFile.match(/syncConversationsBackground[\s\S]*?Done:/)?.[0] || "";
    expect(syncBlock).toContain("convStatus");
    expect(syncBlock).toContain("fromMe ? 'sent' : 'received'");
  });

  it("fastPollSession passes msgStatus to conversation update", () => {
    // The fastPollSession method contains msgStatus for status resolution
    const pollBlock = evoFile.match(/fastPollSession[\s\S]{0,15000}?msgStatus/)?.[0] || "";
    expect(pollBlock.length).toBeGreaterThan(0);
    // Verify the status is passed to updateConversationLastMessage
    const fullPollBlock = evoFile.match(/fastPollSession[\s\S]{0,20000}?updateConversationLastMessage[\s\S]*?\}\)/)?.[0] || "";
    expect(fullPollBlock).toContain("msgStatus");
  });
});
