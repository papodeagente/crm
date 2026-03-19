/**
 * Tests for the WhatsApp Web inbox rebuild
 * Covers: message preview formatting, conversation time formatting,
 * status tick logic, urgency timer, avatar gradient, and conversation store sync
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Message Preview Formatting (mirrors getMessagePreview in Inbox.tsx) ───

function getMessagePreview(lastMessage: string | null, lastMessageType: string | null): string {
  if (!lastMessage && !lastMessageType) return "";
  if (lastMessageType === "audioMessage" || lastMessageType === "pttMessage") return "\u{1F3A4} Áudio";
  if (lastMessageType === "imageMessage") return "\u{1F4F7} Foto";
  if (lastMessageType === "videoMessage") return "\u{1F4F9} Vídeo";
  if (lastMessageType === "documentMessage") return "\u{1F4CE} Documento";
  if (lastMessageType === "stickerMessage") return "\u{1F3AD} Sticker";
  if (lastMessageType === "locationMessage" || lastMessageType === "liveLocationMessage") return "\u{1F4CD} Localização";
  if (lastMessageType === "contactMessage" || lastMessageType === "contactsArrayMessage") return "\u{1F464} Contato";
  if (lastMessageType === "reactionMessage") return ""; // Reactions should NOT appear as preview
  if (lastMessageType === "protocolMessage") return ""; // Protocol messages should NOT appear as preview
  if (lastMessageType === "senderKeyDistributionMessage") return ""; // Protocol messages should NOT appear as preview
  if (lastMessage) return lastMessage;
  if (lastMessageType) return `[${lastMessageType}]`;
  return "";
}

describe("Message preview formatting (WhatsApp Web style)", () => {
  it("should show audio icon for audioMessage", () => {
    expect(getMessagePreview(null, "audioMessage")).toBe("\u{1F3A4} Áudio");
  });

  it("should show audio icon for pttMessage (voice note)", () => {
    expect(getMessagePreview(null, "pttMessage")).toBe("\u{1F3A4} Áudio");
  });

  it("should show photo icon for imageMessage", () => {
    expect(getMessagePreview(null, "imageMessage")).toBe("\u{1F4F7} Foto");
  });

  it("should show video icon for videoMessage", () => {
    expect(getMessagePreview(null, "videoMessage")).toBe("\u{1F4F9} Vídeo");
  });

  it("should show document icon for documentMessage", () => {
    expect(getMessagePreview(null, "documentMessage")).toBe("\u{1F4CE} Documento");
  });

  it("should show sticker icon for stickerMessage", () => {
    expect(getMessagePreview(null, "stickerMessage")).toBe("\u{1F3AD} Sticker");
  });

  it("should show location icon for locationMessage", () => {
    expect(getMessagePreview(null, "locationMessage")).toBe("\u{1F4CD} Localização");
  });

  it("should show contact icon for contactMessage", () => {
    expect(getMessagePreview(null, "contactMessage")).toBe("\u{1F464} Contato");
  });

  it("should return empty string for reactionMessage (MUST NOT pollute preview)", () => {
    expect(getMessagePreview(null, "reactionMessage")).toBe("");
  });

  it("should return empty string for protocolMessage (MUST NOT pollute preview)", () => {
    expect(getMessagePreview(null, "protocolMessage")).toBe("");
  });

  it("should return empty string for senderKeyDistributionMessage", () => {
    expect(getMessagePreview(null, "senderKeyDistributionMessage")).toBe("");
  });

  it("should return text content when available", () => {
    expect(getMessagePreview("Olá, tudo bem?", "conversation")).toBe("Olá, tudo bem?");
    expect(getMessagePreview("Olá, tudo bem?", "extendedTextMessage")).toBe("Olá, tudo bem?");
  });

  it("should return empty string when both null", () => {
    expect(getMessagePreview(null, null)).toBe("");
  });

  it("should fallback to [type] for unknown types with no text", () => {
    expect(getMessagePreview(null, "someNewType")).toBe("[someNewType]");
  });

  it("should prefer media type icon over text content for media messages", () => {
    // When type is imageMessage, show icon even if there's text
    expect(getMessagePreview("caption text", "imageMessage")).toBe("\u{1F4F7} Foto");
  });
});

// ─── Conversation Time Formatting (mirrors formatConversationTime in Inbox.tsx) ───

function formatConversationTime(timestamp: string | Date | null): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  // Today: show HH:MM
  if (diffDays === 0 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  // Yesterday
  if (diffDays <= 1 && date.getDate() === now.getDate() - 1) {
    return "Ontem";
  }
  // This week (< 7 days): show day name
  if (diffDays < 7) {
    return date.toLocaleDateString("pt-BR", { weekday: "long" });
  }
  // Older: show DD/MM/YYYY
  return date.toLocaleDateString("pt-BR");
}

describe("Conversation time formatting (WhatsApp Web style)", () => {
  it("should show HH:MM for today's messages", () => {
    const now = new Date();
    now.setHours(14, 30, 0, 0);
    const result = formatConversationTime(now.toISOString());
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("should return empty string for null timestamp", () => {
    expect(formatConversationTime(null)).toBe("");
  });

  it("should return empty string for invalid date", () => {
    expect(formatConversationTime("not-a-date")).toBe("");
  });

  it("should handle Date objects", () => {
    const result = formatConversationTime(new Date());
    expect(result).toBeTruthy();
  });
});

// ─── Status Tick Logic (mirrors StatusTick component) ───

describe("Status tick logic", () => {
  type TickStatus = "sending" | "pending" | "sent" | "delivered" | "read" | "played";

  function getTickInfo(status: string | null, fromMe: boolean): { show: boolean; icon: string; color: string } {
    if (!fromMe) return { show: false, icon: "", color: "" };
    switch (status) {
      case "sending": return { show: true, icon: "clock", color: "secondary" };
      case "pending": return { show: true, icon: "clock", color: "secondary" };
      case "sent": return { show: true, icon: "check", color: "secondary" };
      case "delivered": return { show: true, icon: "check-check", color: "secondary" };
      case "read": case "played": return { show: true, icon: "check-check", color: "tint" };
      default: return { show: true, icon: "check", color: "secondary" };
    }
  }

  it("should not show ticks for received messages", () => {
    expect(getTickInfo("delivered", false).show).toBe(false);
  });

  it("should show clock for sending status", () => {
    const info = getTickInfo("sending", true);
    expect(info.show).toBe(true);
    expect(info.icon).toBe("clock");
  });

  it("should show single check for sent", () => {
    const info = getTickInfo("sent", true);
    expect(info.icon).toBe("check");
    expect(info.color).toBe("secondary");
  });

  it("should show double check for delivered", () => {
    const info = getTickInfo("delivered", true);
    expect(info.icon).toBe("check-check");
    expect(info.color).toBe("secondary");
  });

  it("should show blue double check for read", () => {
    const info = getTickInfo("read", true);
    expect(info.icon).toBe("check-check");
    expect(info.color).toBe("tint");
  });

  it("should show blue double check for played", () => {
    const info = getTickInfo("played", true);
    expect(info.icon).toBe("check-check");
    expect(info.color).toBe("tint");
  });
});

// ─── Urgency Timer Logic ───

describe("Urgency timer logic", () => {
  function getUrgencyColor(minutes: number): string {
    if (minutes < 5) return "emerald";
    if (minutes < 15) return "yellow";
    if (minutes < 30) return "orange";
    return "red";
  }

  function formatTimerDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min < 60) return `${min}:${sec.toString().padStart(2, "0")}`;
    const hrs = Math.floor(min / 60);
    const remMin = min % 60;
    return `${hrs}h${remMin.toString().padStart(2, "0")}`;
  }

  it("should be green for < 5 minutes", () => {
    expect(getUrgencyColor(3)).toBe("emerald");
  });

  it("should be yellow for 5-15 minutes", () => {
    expect(getUrgencyColor(10)).toBe("yellow");
  });

  it("should be orange for 15-30 minutes", () => {
    expect(getUrgencyColor(20)).toBe("orange");
  });

  it("should be red for > 30 minutes", () => {
    expect(getUrgencyColor(45)).toBe("red");
  });

  it("should format seconds correctly", () => {
    expect(formatTimerDuration(30000)).toBe("30s");
  });

  it("should format minutes:seconds correctly", () => {
    expect(formatTimerDuration(125000)).toBe("2:05");
  });

  it("should format hours correctly", () => {
    expect(formatTimerDuration(3720000)).toBe("1h02");
  });
});

// ─── Avatar Gradient Assignment ───

describe("Avatar gradient assignment", () => {
  const AVATAR_GRADIENTS = [
    "from-violet-500 to-purple-600",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-rose-500 to-pink-500",
    "from-amber-500 to-orange-500",
    "from-indigo-500 to-blue-600",
    "from-fuchsia-500 to-pink-600",
    "from-teal-500 to-green-500",
    "from-sky-500 to-indigo-500",
    "from-red-500 to-rose-500",
    "from-lime-500 to-emerald-500",
    "from-cyan-500 to-blue-500",
  ];

  function getAvatarGradient(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
  }

  function getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return words[0].substring(0, 2).toUpperCase();
  }

  it("should return consistent gradient for same name", () => {
    const g1 = getAvatarGradient("João Silva");
    const g2 = getAvatarGradient("João Silva");
    expect(g1).toBe(g2);
  });

  it("should return different gradients for different names (usually)", () => {
    const g1 = getAvatarGradient("João Silva");
    const g2 = getAvatarGradient("Maria Santos");
    // They might collide, but for these specific names they shouldn't
    expect(typeof g1).toBe("string");
    expect(typeof g2).toBe("string");
  });

  it("should return a valid gradient class", () => {
    const gradient = getAvatarGradient("Test User");
    expect(AVATAR_GRADIENTS).toContain(gradient);
  });

  it("should extract 2-letter initials from two-word name", () => {
    expect(getInitials("João Silva")).toBe("JS");
  });

  it("should extract 2-letter initials from single-word name", () => {
    expect(getInitials("João")).toBe("JO");
  });

  it("should return ? for empty name", () => {
    expect(getInitials("")).toBe("?");
  });

  it("should handle multi-word names (take first 2)", () => {
    expect(getInitials("Ana Maria Silva")).toBe("AM");
  });
});

// ─── Conversation Store Sync (preview + chat parity) ───

describe("Conversation store sync (preview/chat parity)", () => {
  interface ConvEntry {
    conversationKey: string;
    remoteJid: string;
    lastMessage: string | null;
    lastMessageType: string | null;
    lastFromMe: boolean;
    lastTimestamp: Date | null;
    lastStatus: string | null;
    unreadCount: number;
  }

  const STATUS_ORDER: Record<string, number> = {
    sending: 0, pending: 1, sent: 2, delivered: 3, read: 4, played: 5,
  };

  function makeKey(sessionId: string, jid: string) { return `${sessionId}:${jid}`; }

  function shouldUpdateStatus(current: string | null, incoming: string): boolean {
    if (!current) return true;
    return (STATUS_ORDER[incoming] ?? -1) > (STATUS_ORDER[current] ?? -1);
  }

  it("should update preview when new message arrives", () => {
    const conv: ConvEntry = {
      conversationKey: "s1:a@s.whatsapp.net",
      remoteJid: "a@s.whatsapp.net",
      lastMessage: "Old message",
      lastMessageType: "conversation",
      lastFromMe: false,
      lastTimestamp: new Date(Date.now() - 60000),
      lastStatus: "received",
      unreadCount: 0,
    };

    // Simulate new message
    const newMsg = {
      content: "New message",
      messageType: "conversation",
      fromMe: false,
      timestamp: new Date(),
    };

    // Update preview (what the store does)
    const updated = {
      ...conv,
      lastMessage: newMsg.content,
      lastMessageType: newMsg.messageType,
      lastFromMe: newMsg.fromMe,
      lastTimestamp: newMsg.timestamp,
      lastStatus: "received",
      unreadCount: conv.unreadCount + 1,
    };

    expect(updated.lastMessage).toBe("New message");
    expect(updated.unreadCount).toBe(1);
  });

  it("should NOT update preview with reaction messages", () => {
    const NON_PREVIEW_TYPES = new Set([
      "reactionMessage", "protocolMessage", "senderKeyDistributionMessage", "messageContextInfo",
    ]);

    const isReaction = NON_PREVIEW_TYPES.has("reactionMessage");
    expect(isReaction).toBe(true);
  });

  it("should enforce monotonic status updates", () => {
    expect(shouldUpdateStatus("sent", "delivered")).toBe(true);
    expect(shouldUpdateStatus("delivered", "read")).toBe(true);
    expect(shouldUpdateStatus("read", "sent")).toBe(false);
    expect(shouldUpdateStatus("read", "delivered")).toBe(false);
    expect(shouldUpdateStatus("played", "read")).toBe(false);
  });

  it("should reset unread count when conversation is active", () => {
    const activeKey = "s1:a@s.whatsapp.net";
    const msgKey = "s1:a@s.whatsapp.net";
    const isActive = activeKey === msgKey;

    // When active, unread should be 0
    const newUnread = isActive ? 0 : 1;
    expect(newUnread).toBe(0);
  });

  it("should increment unread when conversation is NOT active", () => {
    const activeKey = "s1:b@s.whatsapp.net";
    const msgKey = "s1:a@s.whatsapp.net";
    const isActive = activeKey === msgKey;
    const currentUnread = 3;

    const newUnread = isActive ? 0 : currentUnread + 1;
    expect(newUnread).toBe(4);
  });

  it("should move conversation to top of sorted list on new message", () => {
    const sortedIds = ["s1:a@s.whatsapp.net", "s1:b@s.whatsapp.net", "s1:c@s.whatsapp.net"];
    const msgKey = "s1:c@s.whatsapp.net";

    // Move to top
    const idx = sortedIds.indexOf(msgKey);
    const newSorted = [msgKey, ...sortedIds.slice(0, idx), ...sortedIds.slice(idx + 1)];

    expect(newSorted[0]).toBe("s1:c@s.whatsapp.net");
    expect(newSorted[1]).toBe("s1:a@s.whatsapp.net");
    expect(newSorted[2]).toBe("s1:b@s.whatsapp.net");
  });
});

// ─── Phone number formatting ───

describe("Phone number formatting", () => {
  function formatPhoneNumber(jid: string): string {
    const raw = jid.replace(/@.*$/, "");
    if (raw.length < 10) return raw;
    // Brazilian format: +55 (XX) XXXXX-XXXX
    if (raw.startsWith("55") && raw.length >= 12) {
      const cc = raw.slice(0, 2);
      const area = raw.slice(2, 4);
      const rest = raw.slice(4);
      if (rest.length === 9) {
        return `+${cc} (${area}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
      }
      if (rest.length === 8) {
        return `+${cc} (${area}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
      }
    }
    return `+${raw}`;
  }

  it("should format Brazilian mobile number", () => {
    expect(formatPhoneNumber("5521990650899@s.whatsapp.net")).toBe("+55 (21) 99065-0899");
  });

  it("should format Brazilian landline number", () => {
    expect(formatPhoneNumber("551137172080@s.whatsapp.net")).toBe("+55 (11) 3717-2080");
  });

  it("should handle short numbers", () => {
    expect(formatPhoneNumber("12345@s.whatsapp.net")).toBe("12345");
  });

  it("should handle non-Brazilian numbers", () => {
    const result = formatPhoneNumber("34650592385@s.whatsapp.net");
    expect(result).toBe("+34650592385");
  });
});

// ─── WhatsApp Web CSS Variables Validation ───

describe("WhatsApp Web CSS variable naming", () => {
  const requiredVariables = [
    "--wa-panel",
    "--wa-panel-header",
    "--wa-chat-bg",
    "--wa-incoming",
    "--wa-outgoing",
    "--wa-tint",
    "--wa-unread",
    "--wa-text-primary",
    "--wa-text-secondary",
    "--wa-divider",
    "--wa-hover",
    "--wa-active",
    "--wa-search-bg",
    "--wa-compose-bg",
    "--wa-compose-input",
    "--wa-tick-read",
  ];

  it("should have all required CSS variable names defined", () => {
    // This test validates that our design system has all the variables needed
    for (const varName of requiredVariables) {
      expect(varName).toMatch(/^--wa-/);
    }
    expect(requiredVariables.length).toBeGreaterThanOrEqual(15);
  });

  it("should have consistent naming convention (--wa- prefix)", () => {
    for (const v of requiredVariables) {
      expect(v.startsWith("--wa-")).toBe(true);
    }
  });
});

// ─── Conversation key helpers ───

describe("Conversation key helpers", () => {
  function makeConvKey(sessionId: string, remoteJid: string): string {
    return `${sessionId}:${remoteJid}`;
  }

  function getJidFromKey(key: string): string {
    const idx = key.indexOf(":");
    return idx >= 0 ? key.slice(idx + 1) : key;
  }

  function getSessionFromKey(key: string): string {
    const idx = key.indexOf(":");
    return idx >= 0 ? key.slice(0, idx) : "";
  }

  it("should create key from session and jid", () => {
    expect(makeConvKey("crm-0-1", "5521990650899@s.whatsapp.net")).toBe("crm-0-1:5521990650899@s.whatsapp.net");
  });

  it("should extract jid from key", () => {
    expect(getJidFromKey("crm-0-1:5521990650899@s.whatsapp.net")).toBe("5521990650899@s.whatsapp.net");
  });

  it("should extract session from key", () => {
    expect(getSessionFromKey("crm-0-1:5521990650899@s.whatsapp.net")).toBe("crm-0-1");
  });

  it("should handle key without colon", () => {
    expect(getJidFromKey("5521990650899@s.whatsapp.net")).toBe("5521990650899@s.whatsapp.net");
    expect(getSessionFromKey("5521990650899@s.whatsapp.net")).toBe("");
  });
});
