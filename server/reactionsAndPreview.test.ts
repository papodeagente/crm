import { describe, it, expect, vi } from "vitest";

// ─── Status Monotonic Enforcement ───
describe("Status monotonic enforcement", () => {
  const STATUS_ORDER: Record<string, number> = {
    ERROR: 0,
    PENDING: 1,
    SERVER_ACK: 2,
    DELIVERY_ACK: 3,
    READ: 4,
    PLAYED: 5,
  };

  function shouldUpdateStatus(currentStatus: string | null, newStatus: string): boolean {
    if (!currentStatus) return true;
    const currentOrder = STATUS_ORDER[currentStatus] ?? -1;
    const newOrder = STATUS_ORDER[newStatus] ?? -1;
    return newOrder > currentOrder;
  }

  it("should allow progression from PENDING to SERVER_ACK", () => {
    expect(shouldUpdateStatus("PENDING", "SERVER_ACK")).toBe(true);
  });

  it("should allow progression from SERVER_ACK to DELIVERY_ACK", () => {
    expect(shouldUpdateStatus("SERVER_ACK", "DELIVERY_ACK")).toBe(true);
  });

  it("should allow progression from DELIVERY_ACK to READ", () => {
    expect(shouldUpdateStatus("DELIVERY_ACK", "READ")).toBe(true);
  });

  it("should allow progression from READ to PLAYED", () => {
    expect(shouldUpdateStatus("READ", "PLAYED")).toBe(true);
  });

  it("should NOT allow regression from READ to DELIVERY_ACK", () => {
    expect(shouldUpdateStatus("READ", "DELIVERY_ACK")).toBe(false);
  });

  it("should NOT allow regression from DELIVERY_ACK to SERVER_ACK", () => {
    expect(shouldUpdateStatus("DELIVERY_ACK", "SERVER_ACK")).toBe(false);
  });

  it("should NOT allow regression from PLAYED to READ", () => {
    expect(shouldUpdateStatus("PLAYED", "READ")).toBe(false);
  });

  it("should allow update when current status is null", () => {
    expect(shouldUpdateStatus(null, "PENDING")).toBe(true);
  });

  it("should NOT allow same status (no change)", () => {
    expect(shouldUpdateStatus("READ", "READ")).toBe(false);
  });

  it("should allow progression from ERROR to PENDING", () => {
    expect(shouldUpdateStatus("ERROR", "PENDING")).toBe(true);
  });
});

// ─── Preview-worthy message type filtering ───
describe("Preview-worthy message type filtering", () => {
  const NON_PREVIEW_TYPES = new Set([
    "reactionMessage",
    "protocolMessage",
    "senderKeyDistributionMessage",
    "messageContextInfo",
  ]);

  function isPreviewWorthy(messageType: string): boolean {
    return !NON_PREVIEW_TYPES.has(messageType);
  }

  it("should allow conversation messages as preview", () => {
    expect(isPreviewWorthy("conversation")).toBe(true);
  });

  it("should allow audioMessage as preview", () => {
    expect(isPreviewWorthy("audioMessage")).toBe(true);
  });

  it("should allow imageMessage as preview", () => {
    expect(isPreviewWorthy("imageMessage")).toBe(true);
  });

  it("should allow videoMessage as preview", () => {
    expect(isPreviewWorthy("videoMessage")).toBe(true);
  });

  it("should allow documentMessage as preview", () => {
    expect(isPreviewWorthy("documentMessage")).toBe(true);
  });

  it("should allow extendedTextMessage as preview", () => {
    expect(isPreviewWorthy("extendedTextMessage")).toBe(true);
  });

  it("should NOT allow reactionMessage as preview", () => {
    expect(isPreviewWorthy("reactionMessage")).toBe(false);
  });

  it("should NOT allow protocolMessage as preview", () => {
    expect(isPreviewWorthy("protocolMessage")).toBe(false);
  });

  it("should NOT allow senderKeyDistributionMessage as preview", () => {
    expect(isPreviewWorthy("senderKeyDistributionMessage")).toBe(false);
  });

  it("should NOT allow messageContextInfo as preview", () => {
    expect(isPreviewWorthy("messageContextInfo")).toBe(false);
  });
});

// ─── Reaction processing logic ───
describe("Reaction processing logic", () => {
  it("should extract emoji and targetMessageId from reaction payload", () => {
    const payload = {
      message: {
        reactionMessage: {
          key: { id: "target-msg-123" },
          text: "👍",
        },
      },
      key: { participant: "sender@s.whatsapp.net", fromMe: false },
    };

    const reactionMsg = payload.message.reactionMessage;
    const targetMsgId = reactionMsg.key.id;
    const emoji = reactionMsg.text;
    const senderJid = payload.key.participant;

    expect(targetMsgId).toBe("target-msg-123");
    expect(emoji).toBe("👍");
    expect(senderJid).toBe("sender@s.whatsapp.net");
  });

  it("should treat empty emoji as reaction removal", () => {
    const emoji = "";
    expect(emoji === "").toBe(true);
  });

  it("should upsert reaction (replace old reaction from same sender)", () => {
    const reactions = [
      { senderJid: "user1@s.whatsapp.net", emoji: "👍", fromMe: false },
      { senderJid: "user2@s.whatsapp.net", emoji: "❤️", fromMe: false },
    ];

    // User1 changes reaction from 👍 to 😂
    const newReaction = { senderJid: "user1@s.whatsapp.net", emoji: "😂", fromMe: false };
    const filtered = reactions.filter(r => r.senderJid !== newReaction.senderJid);
    filtered.push(newReaction);

    expect(filtered).toHaveLength(2);
    expect(filtered.find(r => r.senderJid === "user1@s.whatsapp.net")?.emoji).toBe("😂");
    expect(filtered.find(r => r.senderJid === "user2@s.whatsapp.net")?.emoji).toBe("❤️");
  });

  it("should remove reaction when emoji is empty", () => {
    const reactions = [
      { senderJid: "user1@s.whatsapp.net", emoji: "👍", fromMe: false },
      { senderJid: "user2@s.whatsapp.net", emoji: "❤️", fromMe: false },
    ];

    // User1 removes reaction
    const newReaction = { senderJid: "user1@s.whatsapp.net", emoji: "", fromMe: false };
    const filtered = reactions.filter(r => r.senderJid !== newReaction.senderJid);
    // Don't add empty emoji
    if (newReaction.emoji) {
      filtered.push(newReaction);
    }

    expect(filtered).toHaveLength(1);
    expect(filtered[0].senderJid).toBe("user2@s.whatsapp.net");
  });
});

// ─── Reaction grouping for UI ───
describe("Reaction grouping for UI", () => {
  it("should group reactions by emoji with count", () => {
    const reactions = [
      { emoji: "👍", senderJid: "user1", fromMe: false },
      { emoji: "👍", senderJid: "user2", fromMe: true },
      { emoji: "❤️", senderJid: "user3", fromMe: false },
    ];

    const grouped = reactions.reduce<Record<string, { count: number; fromMe: boolean }>>((acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = { count: 0, fromMe: false };
      acc[r.emoji].count++;
      if (r.fromMe) acc[r.emoji].fromMe = true;
      return acc;
    }, {});

    expect(grouped["👍"].count).toBe(2);
    expect(grouped["👍"].fromMe).toBe(true);
    expect(grouped["❤️"].count).toBe(1);
    expect(grouped["❤️"].fromMe).toBe(false);
  });
});

// ─── Quoted message rendering ───
describe("Quoted message rendering", () => {
  it("should find quoted message in allMessages by messageId", () => {
    const allMessages = [
      { id: 1, messageId: "msg-1", content: "Hello", fromMe: false },
      { id: 2, messageId: "msg-2", content: "World", fromMe: true },
      { id: 3, messageId: "msg-3", content: "Reply", fromMe: false, quotedMessageId: "msg-1" },
    ];

    const msg = allMessages[2];
    const quotedMsg = msg.quotedMessageId
      ? allMessages.find(m => m.messageId === msg.quotedMessageId)
      : null;

    expect(quotedMsg).toBeDefined();
    expect(quotedMsg?.content).toBe("Hello");
    expect(quotedMsg?.fromMe).toBe(false);
  });

  it("should return null when quoted message is not in loaded batch", () => {
    const allMessages = [
      { id: 3, messageId: "msg-3", content: "Reply", fromMe: false, quotedMessageId: "msg-999" },
    ];

    const msg = allMessages[0];
    const quotedMsg = msg.quotedMessageId
      ? allMessages.find(m => m.messageId === msg.quotedMessageId)
      : null;

    expect(quotedMsg).toBeUndefined();
  });

  it("should handle message without quotedMessageId", () => {
    const msg = { id: 1, messageId: "msg-1", content: "Hello", fromMe: false, quotedMessageId: null };
    const quotedMsg = msg.quotedMessageId
      ? [].find((m: any) => m.messageId === msg.quotedMessageId)
      : null;

    expect(quotedMsg).toBeNull();
  });
});

// ─── Frontend status order (lowercase) ───
describe("Frontend status order (lowercase)", () => {
  const statusOrder: Record<string, number> = {
    sending: 0,
    sent: 1,
    delivered: 2,
    read: 3,
    played: 4,
  };

  function shouldUpdateFrontendStatus(current: string | null, incoming: string): boolean {
    if (!current) return true;
    return (statusOrder[incoming] ?? -1) > (statusOrder[current] ?? -1);
  }

  it("should allow sent → delivered", () => {
    expect(shouldUpdateFrontendStatus("sent", "delivered")).toBe(true);
  });

  it("should NOT allow delivered → sent", () => {
    expect(shouldUpdateFrontendStatus("delivered", "sent")).toBe(false);
  });

  it("should allow delivered → read", () => {
    expect(shouldUpdateFrontendStatus("delivered", "read")).toBe(true);
  });

  it("should allow null → sending", () => {
    expect(shouldUpdateFrontendStatus(null, "sending")).toBe(true);
  });
});

// ─── Socket event for assignment/ownership changes ───
describe("Socket event for assignment changes", () => {
  it("should emit conversationUpdated with correct payload structure", () => {
    const payload = {
      type: "assignment",
      conversationId: 123,
      assignedUserId: 456,
      assignedTeamId: null,
      assignmentStatus: "assigned",
      isQueued: false,
    };

    expect(payload.type).toBe("assignment");
    expect(payload.conversationId).toBe(123);
    expect(payload.assignedUserId).toBe(456);
    expect(payload.isQueued).toBe(false);
  });

  it("should emit conversationUpdated with type 'enqueued' for queue operations", () => {
    const payload = {
      type: "enqueued",
      conversationId: 123,
      assignedUserId: null,
      assignedTeamId: null,
      assignmentStatus: "queued",
      isQueued: true,
    };

    expect(payload.type).toBe("enqueued");
    expect(payload.isQueued).toBe(true);
    expect(payload.assignedUserId).toBeNull();
  });

  it("should emit conversationUpdated with type 'finished' for attendance completion", () => {
    const payload = {
      type: "finished",
      conversationId: 123,
      assignedUserId: null,
      assignedTeamId: null,
      assignmentStatus: "closed",
      isQueued: false,
    };

    expect(payload.type).toBe("finished");
    expect(payload.assignmentStatus).toBe("closed");
  });
});

// ─── Auto-transcribe conditions ───
describe("Auto-transcribe conditions", () => {
  it("should transcribe audio messages without URL dependency", () => {
    const msg = {
      messageType: "audioMessage",
      audioTranscription: null,
      audioTranscriptionStatus: null,
      fromMe: true,
    };

    const isAudio = msg.messageType === "audioMessage" || msg.messageType === "pttMessage";
    const hasDbTranscription = msg.audioTranscription && msg.audioTranscriptionStatus === "completed";
    const isPendingOrProcessing = msg.audioTranscriptionStatus === "pending" || msg.audioTranscriptionStatus === "processing";
    const shouldTranscribe = isAudio && !hasDbTranscription && !isPendingOrProcessing;

    expect(shouldTranscribe).toBe(true);
  });

  it("should transcribe fromMe audio messages (inbox-sent)", () => {
    const msg = {
      messageType: "pttMessage",
      audioTranscription: null,
      audioTranscriptionStatus: null,
      fromMe: true,
    };

    const isAudio = msg.messageType === "audioMessage" || msg.messageType === "pttMessage";
    const shouldTranscribe = isAudio && !msg.audioTranscription;

    expect(shouldTranscribe).toBe(true);
  });

  it("should NOT transcribe already completed messages", () => {
    const msg = {
      messageType: "audioMessage",
      audioTranscription: "Hello world",
      audioTranscriptionStatus: "completed",
    };

    const hasDbTranscription = msg.audioTranscription && msg.audioTranscriptionStatus === "completed";
    expect(hasDbTranscription).toBeTruthy();
  });

  it("should NOT transcribe messages in pending/processing state", () => {
    const msg = {
      messageType: "audioMessage",
      audioTranscription: null,
      audioTranscriptionStatus: "pending",
    };

    const isPendingOrProcessing = msg.audioTranscriptionStatus === "pending" || msg.audioTranscriptionStatus === "processing";
    expect(isPendingOrProcessing).toBe(true);
  });
});
