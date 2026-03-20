import { describe, it, expect } from "vitest";

// ─── Bug Fix 1: Optimistic Reaction Update ───
// The handleReact function now updates reactionsMap immediately before calling mutate.
// This test validates the optimistic update logic extracted from WhatsAppChat.tsx.

type Reaction = { emoji: string; senderJid: string; fromMe: boolean };

function optimisticReactionUpdate(
  reactionsMap: Record<string, Reaction[]>,
  targetId: string,
  emoji: string,
  sessionId: string,
): Record<string, Reaction[]> {
  const existing = [...(reactionsMap[targetId] || [])];
  // Remove any previous reaction from me
  const filtered = existing.filter(r => !r.fromMe);
  // Add new reaction (or remove if emoji is empty)
  if (emoji) {
    filtered.push({ emoji, senderJid: sessionId + "@s.whatsapp.net", fromMe: true });
  }
  return { ...reactionsMap, [targetId]: filtered };
}

describe("Optimistic reaction update (Bug Fix 1)", () => {
  it("should add a reaction to an empty reactionsMap", () => {
    const result = optimisticReactionUpdate({}, "msg-1", "👍", "session1");
    expect(result["msg-1"]).toHaveLength(1);
    expect(result["msg-1"][0]).toEqual({
      emoji: "👍",
      senderJid: "session1@s.whatsapp.net",
      fromMe: true,
    });
  });

  it("should replace my previous reaction on the same message", () => {
    const initial: Record<string, Reaction[]> = {
      "msg-1": [{ emoji: "👍", senderJid: "session1@s.whatsapp.net", fromMe: true }],
    };
    const result = optimisticReactionUpdate(initial, "msg-1", "❤️", "session1");
    expect(result["msg-1"]).toHaveLength(1);
    expect(result["msg-1"][0].emoji).toBe("❤️");
    expect(result["msg-1"][0].fromMe).toBe(true);
  });

  it("should preserve other people's reactions when I add mine", () => {
    const initial: Record<string, Reaction[]> = {
      "msg-1": [
        { emoji: "😂", senderJid: "other@s.whatsapp.net", fromMe: false },
        { emoji: "🔥", senderJid: "another@s.whatsapp.net", fromMe: false },
      ],
    };
    const result = optimisticReactionUpdate(initial, "msg-1", "👍", "session1");
    expect(result["msg-1"]).toHaveLength(3);
    expect(result["msg-1"].filter(r => !r.fromMe)).toHaveLength(2);
    expect(result["msg-1"].find(r => r.fromMe)?.emoji).toBe("👍");
  });

  it("should remove my reaction when emoji is empty", () => {
    const initial: Record<string, Reaction[]> = {
      "msg-1": [
        { emoji: "👍", senderJid: "session1@s.whatsapp.net", fromMe: true },
        { emoji: "❤️", senderJid: "other@s.whatsapp.net", fromMe: false },
      ],
    };
    const result = optimisticReactionUpdate(initial, "msg-1", "", "session1");
    expect(result["msg-1"]).toHaveLength(1);
    expect(result["msg-1"][0].senderJid).toBe("other@s.whatsapp.net");
  });

  it("should not mutate the original reactionsMap", () => {
    const initial: Record<string, Reaction[]> = {
      "msg-1": [{ emoji: "👍", senderJid: "session1@s.whatsapp.net", fromMe: true }],
    };
    const result = optimisticReactionUpdate(initial, "msg-1", "❤️", "session1");
    // Original should be unchanged
    expect(initial["msg-1"][0].emoji).toBe("👍");
    expect(result["msg-1"][0].emoji).toBe("❤️");
    expect(result).not.toBe(initial);
  });

  it("should handle reaction on a different message without affecting others", () => {
    const initial: Record<string, Reaction[]> = {
      "msg-1": [{ emoji: "👍", senderJid: "session1@s.whatsapp.net", fromMe: true }],
    };
    const result = optimisticReactionUpdate(initial, "msg-2", "❤️", "session1");
    expect(result["msg-1"]).toHaveLength(1);
    expect(result["msg-1"][0].emoji).toBe("👍");
    expect(result["msg-2"]).toHaveLength(1);
    expect(result["msg-2"][0].emoji).toBe("❤️");
  });
});

// ─── Bug Fix 1: Rollback on error ───
// When sendReaction fails, the optimistic reaction should be rolled back.

function rollbackReaction(
  reactionsMap: Record<string, Reaction[]>,
  targetId: string,
  sessionId: string,
): Record<string, Reaction[]> {
  const existing = [...(reactionsMap[targetId] || [])];
  const filtered = existing.filter(r => r.senderJid !== sessionId + "@s.whatsapp.net");
  return { ...reactionsMap, [targetId]: filtered };
}

describe("Reaction rollback on error (Bug Fix 1)", () => {
  it("should remove my reaction on rollback", () => {
    const afterOptimistic: Record<string, Reaction[]> = {
      "msg-1": [
        { emoji: "❤️", senderJid: "other@s.whatsapp.net", fromMe: false },
        { emoji: "👍", senderJid: "session1@s.whatsapp.net", fromMe: true },
      ],
    };
    const result = rollbackReaction(afterOptimistic, "msg-1", "session1");
    expect(result["msg-1"]).toHaveLength(1);
    expect(result["msg-1"][0].senderJid).toBe("other@s.whatsapp.net");
  });

  it("should handle rollback when no reactions exist for message", () => {
    const result = rollbackReaction({}, "msg-1", "session1");
    expect(result["msg-1"]).toHaveLength(0);
  });
});

// ─── Bug Fix 2: Template Message Visibility ───
// The message filter now allows rich message types (templateMessage, interactiveMessage, etc.)
// to pass through even when content is empty or "[Template]".

interface MockMessage {
  messageType: string;
  content: string | null;
}

function shouldShowMessage(m: MockMessage): boolean {
  const HIDDEN_MSG_TYPES = new Set([
    "protocolMessage", "senderKeyDistributionMessage", "messageContextInfo",
    "ephemeralMessage", "reactionMessage", "associatedChildMessage",
    "placeholderMessage", "albumMessage", "peerDataOperationRequestResponseMessage",
    "botInvokeMessage", "newsletterAdminInviteMessage", "encReactionMessage",
    "keepInChatMessage", "pinInChatMessage", "pollUpdateMessage",
    "groupInviteMessage", "lottieStickerMessage",
  ]);
  const MEDIA_TYPES = new Set([
    "imageMessage", "videoMessage", "audioMessage", "pttMessage",
    "documentMessage", "stickerMessage", "ptvMessage",
  ]);
  const SPECIAL_TYPES = new Set([
    "locationMessage", "contactMessage", "contactsArrayMessage",
    "pollCreationMessage", "pollCreationMessageV3",
  ]);
  const RICH_TYPES = new Set([
    "templateMessage", "interactiveMessage", "buttonsMessage",
    "listMessage", "listResponseMessage", "buttonsResponseMessage",
    "templateButtonReplyMessage", "interactiveResponseMessage",
    "orderMessage", "productMessage",
  ]);

  if (HIDDEN_MSG_TYPES.has(m.messageType)) return false;
  if (MEDIA_TYPES.has(m.messageType)) return true;
  if (SPECIAL_TYPES.has(m.messageType)) return true;
  if (RICH_TYPES.has(m.messageType)) return true;
  const content = m.content?.trim();
  if (!content) return false;
  if (/^\[\w+\]$/.test(content)) return false;
  return true;
}

describe("Template message visibility (Bug Fix 2)", () => {
  it("should show templateMessage even with null content", () => {
    expect(shouldShowMessage({ messageType: "templateMessage", content: null })).toBe(true);
  });

  it("should show templateMessage even with [Template] content", () => {
    expect(shouldShowMessage({ messageType: "templateMessage", content: "[Template]" })).toBe(true);
  });

  it("should show templateMessage with actual content", () => {
    expect(shouldShowMessage({ messageType: "templateMessage", content: "Hello from template" })).toBe(true);
  });

  it("should show interactiveMessage even with null content", () => {
    expect(shouldShowMessage({ messageType: "interactiveMessage", content: null })).toBe(true);
  });

  it("should show buttonsMessage even with empty content", () => {
    expect(shouldShowMessage({ messageType: "buttonsMessage", content: "" })).toBe(true);
  });

  it("should show listMessage even with null content", () => {
    expect(shouldShowMessage({ messageType: "listMessage", content: null })).toBe(true);
  });

  it("should show listResponseMessage", () => {
    expect(shouldShowMessage({ messageType: "listResponseMessage", content: "Option A" })).toBe(true);
  });

  it("should show buttonsResponseMessage", () => {
    expect(shouldShowMessage({ messageType: "buttonsResponseMessage", content: "Button 1" })).toBe(true);
  });

  it("should show templateButtonReplyMessage", () => {
    expect(shouldShowMessage({ messageType: "templateButtonReplyMessage", content: "Reply" })).toBe(true);
  });

  it("should show interactiveResponseMessage", () => {
    expect(shouldShowMessage({ messageType: "interactiveResponseMessage", content: null })).toBe(true);
  });

  it("should show orderMessage", () => {
    expect(shouldShowMessage({ messageType: "orderMessage", content: null })).toBe(true);
  });

  it("should show productMessage", () => {
    expect(shouldShowMessage({ messageType: "productMessage", content: null })).toBe(true);
  });

  // Ensure non-rich types still respect the content filters
  it("should still hide conversation messages with null content", () => {
    expect(shouldShowMessage({ messageType: "conversation", content: null })).toBe(false);
  });

  it("should still hide conversation messages with empty content", () => {
    expect(shouldShowMessage({ messageType: "conversation", content: "" })).toBe(false);
  });

  it("should show conversation messages with actual content", () => {
    expect(shouldShowMessage({ messageType: "conversation", content: "Hello" })).toBe(true);
  });

  it("should still hide protocol messages", () => {
    expect(shouldShowMessage({ messageType: "protocolMessage", content: "something" })).toBe(false);
  });

  it("should still hide reaction messages", () => {
    expect(shouldShowMessage({ messageType: "reactionMessage", content: "👍" })).toBe(false);
  });

  it("should show media types regardless of content", () => {
    expect(shouldShowMessage({ messageType: "imageMessage", content: null })).toBe(true);
    expect(shouldShowMessage({ messageType: "videoMessage", content: null })).toBe(true);
    expect(shouldShowMessage({ messageType: "audioMessage", content: null })).toBe(true);
  });

  it("should show special types regardless of content", () => {
    expect(shouldShowMessage({ messageType: "locationMessage", content: null })).toBe(true);
    expect(shouldShowMessage({ messageType: "contactMessage", content: null })).toBe(true);
    expect(shouldShowMessage({ messageType: "pollCreationMessage", content: null })).toBe(true);
  });
});
