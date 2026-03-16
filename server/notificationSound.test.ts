import { describe, it, expect } from "vitest";

/**
 * Notification Sound System Tests
 *
 * These tests verify the notification sound logic rules
 * by simulating the guard conditions from Inbox.tsx.
 * The actual sound playback (Web Audio API) cannot be tested
 * in Node.js, but we can verify the decision logic.
 */

// Simulate the guard logic from Inbox.tsx
interface SocketMessage {
  sessionId: string;
  content: string;
  fromMe: boolean;
  remoteJid: string;
  messageType: string;
  timestamp: number;
  isSync?: boolean;
}

interface NotificationDecision {
  shouldPlay: boolean;
  reason: string;
}

const SKIP_TYPES = ["protocolMessage", "senderKeyDistributionMessage", "internal_note"];

function shouldPlayNotification(
  msg: SocketMessage,
  opts: {
    isMuted: boolean;
    selectedJid: string | null;
    soundSuppressedUntil: number;
    processedSigs: Set<string>;
    now?: number;
  }
): NotificationDecision {
  const now = opts.now || Date.now();
  const msgSig = `${msg.remoteJid}:${msg.content}:${msg.timestamp}`;

  // Guard 1: Already processed
  if (opts.processedSigs.has(msgSig)) {
    return { shouldPlay: false, reason: "duplicate" };
  }
  opts.processedSigs.add(msgSig);

  // Guard 2: fromMe
  if (msg.fromMe) {
    return { shouldPlay: false, reason: "fromMe" };
  }

  // Guard 3: Sync batch
  if (msg.isSync) {
    return { shouldPlay: false, reason: "sync" };
  }

  // Guard 4: Skip types
  if (SKIP_TYPES.includes(msg.messageType)) {
    return { shouldPlay: false, reason: "skipType" };
  }

  // Guard 5: Muted
  if (opts.isMuted) {
    return { shouldPlay: false, reason: "muted" };
  }

  // Guard 6: Sound suppressed (conversation just opened)
  if (now < opts.soundSuppressedUntil) {
    return { shouldPlay: false, reason: "suppressed" };
  }

  // Guard 7: Currently viewed conversation
  if (opts.selectedJid === msg.remoteJid) {
    return { shouldPlay: false, reason: "activeConversation" };
  }

  return { shouldPlay: true, reason: "passed" };
}

// Debounce logic
function shouldDebounce(lastPlayedAt: number, now: number, debounceMs: number = 1500): boolean {
  return now - lastPlayedAt < debounceMs;
}

describe("Notification Sound System", () => {
  const baseMsg: SocketMessage = {
    sessionId: "session-1",
    content: "Hello",
    fromMe: false,
    remoteJid: "5511999999999@s.whatsapp.net",
    messageType: "conversation",
    timestamp: Date.now(),
  };

  const defaultOpts = {
    isMuted: false,
    selectedJid: null as string | null,
    soundSuppressedUntil: 0,
    processedSigs: new Set<string>(),
  };

  describe("Problem 1: Sound on sent messages", () => {
    it("should NEVER play sound for fromMe messages", () => {
      const msg = { ...baseMsg, fromMe: true };
      const result = shouldPlayNotification(msg, { ...defaultOpts, processedSigs: new Set() });
      expect(result.shouldPlay).toBe(false);
      expect(result.reason).toBe("fromMe");
    });

    it("should play sound for incoming messages", () => {
      const msg = { ...baseMsg, fromMe: false };
      const result = shouldPlayNotification(msg, { ...defaultOpts, processedSigs: new Set() });
      expect(result.shouldPlay).toBe(true);
    });
  });

  describe("Problem 2: Sound without message", () => {
    it("should NOT play sound for protocolMessage", () => {
      const msg = { ...baseMsg, messageType: "protocolMessage" };
      const result = shouldPlayNotification(msg, { ...defaultOpts, processedSigs: new Set() });
      expect(result.shouldPlay).toBe(false);
      expect(result.reason).toBe("skipType");
    });

    it("should NOT play sound for senderKeyDistributionMessage", () => {
      const msg = { ...baseMsg, messageType: "senderKeyDistributionMessage" };
      const result = shouldPlayNotification(msg, { ...defaultOpts, processedSigs: new Set() });
      expect(result.shouldPlay).toBe(false);
      expect(result.reason).toBe("skipType");
    });

    it("should NOT play sound for internal_note", () => {
      const msg = { ...baseMsg, messageType: "internal_note" };
      const result = shouldPlayNotification(msg, { ...defaultOpts, processedSigs: new Set() });
      expect(result.shouldPlay).toBe(false);
      expect(result.reason).toBe("skipType");
    });

    it("should NOT play sound for sync batches", () => {
      const msg = { ...baseMsg, isSync: true };
      const result = shouldPlayNotification(msg, { ...defaultOpts, processedSigs: new Set() });
      expect(result.shouldPlay).toBe(false);
      expect(result.reason).toBe("sync");
    });

    it("should play sound for real conversation messages", () => {
      const msg = { ...baseMsg, messageType: "conversation" };
      const result = shouldPlayNotification(msg, { ...defaultOpts, processedSigs: new Set() });
      expect(result.shouldPlay).toBe(true);
    });

    it("should play sound for imageMessage", () => {
      const msg = { ...baseMsg, messageType: "imageMessage" };
      const result = shouldPlayNotification(msg, { ...defaultOpts, processedSigs: new Set() });
      expect(result.shouldPlay).toBe(true);
    });
  });

  describe("Problem 3: Multiple sounds when opening chat", () => {
    it("should NOT play sound when sound is suppressed (conversation just opened)", () => {
      const msg = { ...baseMsg };
      const now = Date.now();
      const result = shouldPlayNotification(msg, {
        ...defaultOpts,
        processedSigs: new Set(),
        soundSuppressedUntil: now + 2000, // suppressed for 2 more seconds
        now,
      });
      expect(result.shouldPlay).toBe(false);
      expect(result.reason).toBe("suppressed");
    });

    it("should play sound after suppression period ends", () => {
      const msg = { ...baseMsg };
      const now = Date.now();
      const result = shouldPlayNotification(msg, {
        ...defaultOpts,
        processedSigs: new Set(),
        soundSuppressedUntil: now - 1, // suppression already expired
        now,
      });
      expect(result.shouldPlay).toBe(true);
    });

    it("should NOT play sound for the currently viewed conversation", () => {
      const msg = { ...baseMsg };
      const result = shouldPlayNotification(msg, {
        ...defaultOpts,
        processedSigs: new Set(),
        selectedJid: msg.remoteJid,
      });
      expect(result.shouldPlay).toBe(false);
      expect(result.reason).toBe("activeConversation");
    });
  });

  describe("Problem 4: Unread counter delay", () => {
    it("should optimistically set unreadCount to 0 when opening conversation", () => {
      // Simulate the optimistic update logic
      const conversations = [
        { remoteJid: "jid1", unreadCount: 5 },
        { remoteJid: "jid2", unreadCount: 3 },
        { remoteJid: "jid3", unreadCount: 0 },
      ];
      const openedJid = "jid1";
      const updated = conversations.map(c =>
        c.remoteJid === openedJid ? { ...c, unreadCount: 0 } : c
      );
      expect(updated[0].unreadCount).toBe(0);
      expect(updated[1].unreadCount).toBe(3); // other conversations unchanged
      expect(updated[2].unreadCount).toBe(0);
    });
  });

  describe("Problem 5: Sound flood protection (debounce)", () => {
    it("should debounce sounds within 1500ms", () => {
      const now = Date.now();
      const lastPlayed = now - 500; // 500ms ago
      expect(shouldDebounce(lastPlayed, now)).toBe(true);
    });

    it("should allow sound after 1500ms", () => {
      const now = Date.now();
      const lastPlayed = now - 1600; // 1600ms ago
      expect(shouldDebounce(lastPlayed, now)).toBe(false);
    });

    it("should allow first sound (lastPlayedAt = 0)", () => {
      const now = Date.now();
      expect(shouldDebounce(0, now)).toBe(false);
    });

    it("should debounce rapid successive messages", () => {
      const now = Date.now();
      // First message plays
      expect(shouldDebounce(0, now)).toBe(false);
      // Second message 200ms later — debounced
      expect(shouldDebounce(now, now + 200)).toBe(true);
      // Third message 800ms later — still debounced
      expect(shouldDebounce(now, now + 800)).toBe(true);
      // Fourth message 1600ms later — allowed
      expect(shouldDebounce(now, now + 1600)).toBe(false);
    });
  });

  describe("Duplicate message detection", () => {
    it("should NOT play sound for duplicate messages (same signature)", () => {
      const msg = { ...baseMsg };
      const processedSigs = new Set<string>();

      // First time — should play
      const result1 = shouldPlayNotification(msg, { ...defaultOpts, processedSigs });
      expect(result1.shouldPlay).toBe(true);

      // Same message again — should NOT play
      const result2 = shouldPlayNotification(msg, { ...defaultOpts, processedSigs });
      expect(result2.shouldPlay).toBe(false);
      expect(result2.reason).toBe("duplicate");
    });

    it("should play sound for different messages from same contact", () => {
      const processedSigs = new Set<string>();
      const msg1 = { ...baseMsg, content: "Hello", timestamp: 1000 };
      const msg2 = { ...baseMsg, content: "World", timestamp: 2000 };

      const result1 = shouldPlayNotification(msg1, { ...defaultOpts, processedSigs });
      expect(result1.shouldPlay).toBe(true);

      const result2 = shouldPlayNotification(msg2, { ...defaultOpts, processedSigs });
      expect(result2.shouldPlay).toBe(true);
    });
  });

  describe("Mute functionality", () => {
    it("should NOT play sound when muted", () => {
      const msg = { ...baseMsg };
      const result = shouldPlayNotification(msg, {
        ...defaultOpts,
        processedSigs: new Set(),
        isMuted: true,
      });
      expect(result.shouldPlay).toBe(false);
      expect(result.reason).toBe("muted");
    });
  });

  describe("Combined scenarios", () => {
    it("should handle fromMe + sync correctly (fromMe takes priority)", () => {
      const msg = { ...baseMsg, fromMe: true, isSync: true };
      const result = shouldPlayNotification(msg, { ...defaultOpts, processedSigs: new Set() });
      expect(result.shouldPlay).toBe(false);
      expect(result.reason).toBe("fromMe");
    });

    it("should handle incoming message from different contact while viewing another", () => {
      const msg = { ...baseMsg, remoteJid: "5511888888888@s.whatsapp.net" };
      const result = shouldPlayNotification(msg, {
        ...defaultOpts,
        processedSigs: new Set(),
        selectedJid: "5511999999999@s.whatsapp.net", // viewing different contact
      });
      expect(result.shouldPlay).toBe(true);
    });
  });
});
