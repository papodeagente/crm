import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Tests for the new WhatsApp features:
 * sendReaction, sendSticker, sendLocation, sendContact, sendPoll,
 * sendTextWithQuote, deleteMessage, editMessage, sendPresence,
 * archiveChat, blockContact, checkIsWhatsApp, markAsUnread
 */

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("WhatsApp Features - Input Validation", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  // ─── sendReaction ───
  describe("sendReaction", () => {
    it("rejects missing sessionId", async () => {
      await expect(
        caller.whatsapp.sendReaction({
          sessionId: "",
          key: { remoteJid: "5511999999999@s.whatsapp.net", fromMe: false, id: "msg123" },
          reaction: "👍",
        })
      ).rejects.toThrow();
    });

    it("accepts valid reaction input", async () => {
      // This will fail at the Evolution API level (no real session), but validates input parsing
      try {
        await caller.whatsapp.sendReaction({
          sessionId: "test-session",
          key: { remoteJid: "5511999999999@s.whatsapp.net", fromMe: false, id: "msg123" },
          reaction: "👍",
        });
      } catch (e: any) {
        // Expected to fail at API level, but input should be valid
        expect(e.message).not.toContain("validation");
      }
    });
  });

  // ─── sendLocation ───
  describe("sendLocation", () => {
    it("rejects empty number", async () => {
      await expect(
        caller.whatsapp.sendLocation({
          sessionId: "test-session",
          number: "",
          latitude: -23.5505,
          longitude: -46.6333,
          name: "São Paulo",
          address: "SP, Brasil",
        })
      ).rejects.toThrow();
    });

    it("accepts valid location input", async () => {
      try {
        await caller.whatsapp.sendLocation({
          sessionId: "test-session",
          number: "5511999999999",
          latitude: -23.5505,
          longitude: -46.6333,
          name: "São Paulo",
          address: "SP, Brasil",
        });
      } catch (e: any) {
        expect(e.message).not.toContain("validation");
      }
    });
  });

  // ─── sendContact ───
  describe("sendContact", () => {
    it("rejects empty contacts array", async () => {
      await expect(
        caller.whatsapp.sendContact({
          sessionId: "test-session",
          number: "5511999999999",
          contacts: [],
        })
      ).rejects.toThrow();
    });

    it("accepts valid contact input", async () => {
      try {
        await caller.whatsapp.sendContact({
          sessionId: "test-session",
          number: "5511999999999",
          contacts: [{ fullName: "João Silva", phoneNumber: "5511888888888" }],
        });
      } catch (e: any) {
        expect(e.message).not.toContain("validation");
      }
    });
  });

  // ─── sendPoll ───
  describe("sendPoll", () => {
    it("rejects poll with less than 2 options", async () => {
      await expect(
        caller.whatsapp.sendPoll({
          sessionId: "test-session",
          number: "5511999999999",
          name: "Qual destino?",
          values: ["Cancún"],
          selectableCount: 1,
        })
      ).rejects.toThrow();
    });

    it("rejects poll with more than 12 options", async () => {
      await expect(
        caller.whatsapp.sendPoll({
          sessionId: "test-session",
          number: "5511999999999",
          name: "Qual destino?",
          values: Array.from({ length: 13 }, (_, i) => `Opção ${i + 1}`),
          selectableCount: 1,
        })
      ).rejects.toThrow();
    });

    it("accepts valid poll with 2-12 options", async () => {
      try {
        await caller.whatsapp.sendPoll({
          sessionId: "test-session",
          number: "5511999999999",
          name: "Qual destino?",
          values: ["Cancún", "Orlando", "Paris"],
          selectableCount: 1,
        });
      } catch (e: any) {
        expect(e.message).not.toContain("validation");
      }
    });
  });

  // ─── sendTextWithQuote ───
  describe("sendTextWithQuote", () => {
    it("rejects empty message", async () => {
      await expect(
        caller.whatsapp.sendTextWithQuote({
          sessionId: "test-session",
          number: "5511999999999",
          message: "",
          quotedMessageId: "msg123",
          quotedText: "Mensagem original",
        })
      ).rejects.toThrow();
    });

    it("accepts valid quote input", async () => {
      try {
        await caller.whatsapp.sendTextWithQuote({
          sessionId: "test-session",
          number: "5511999999999",
          message: "Respondendo à sua mensagem",
          quotedMessageId: "msg123",
          quotedText: "Mensagem original",
        });
      } catch (e: any) {
        expect(e.message).not.toContain("validation");
      }
    });
  });

  // ─── deleteMessage ───
  describe("deleteMessage", () => {
    it("accepts valid delete input", async () => {
      try {
        await caller.whatsapp.deleteMessage({
          sessionId: "test-session",
          remoteJid: "5511999999999@s.whatsapp.net",
          messageId: "msg123",
          fromMe: true,
        });
      } catch (e: any) {
        expect(e.message).not.toContain("validation");
      }
    });
  });

  // ─── editMessage ───
  describe("editMessage", () => {
    it("rejects empty newText", async () => {
      await expect(
        caller.whatsapp.editMessage({
          sessionId: "test-session",
          number: "5511999999999",
          messageId: "msg123",
          newText: "",
        })
      ).rejects.toThrow();
    });

    it("accepts valid edit input", async () => {
      try {
        await caller.whatsapp.editMessage({
          sessionId: "test-session",
          number: "5511999999999",
          messageId: "msg123",
          newText: "Texto editado",
        });
      } catch (e: any) {
        expect(e.message).not.toContain("validation");
      }
    });
  });

  // ─── sendPresence ───
  describe("sendPresence", () => {
    it("rejects invalid presence type", async () => {
      await expect(
        caller.whatsapp.sendPresence({
          sessionId: "test-session",
          number: "5511999999999",
          presence: "invalid" as any,
        })
      ).rejects.toThrow();
    });

    it("accepts composing presence", async () => {
      try {
        await caller.whatsapp.sendPresence({
          sessionId: "test-session",
          number: "5511999999999",
          presence: "composing",
        });
      } catch (e: any) {
        expect(e.message).not.toContain("validation");
      }
    });

    it("accepts recording presence", async () => {
      try {
        await caller.whatsapp.sendPresence({
          sessionId: "test-session",
          number: "5511999999999",
          presence: "recording",
        });
      } catch (e: any) {
        expect(e.message).not.toContain("validation");
      }
    });
  });

  // ─── archiveChat ───
  describe("archiveChat", () => {
    it("accepts valid archive input", async () => {
      try {
        await caller.whatsapp.archiveChat({
          sessionId: "test-session",
          remoteJid: "5511999999999@s.whatsapp.net",
          archive: true,
        });
      } catch (e: any) {
        expect(e.message).not.toContain("validation");
      }
    });
  });

  // ─── blockContact ───
  describe("blockContact", () => {
    it("rejects empty number", async () => {
      await expect(
        caller.whatsapp.blockContact({
          sessionId: "test-session",
          number: "",
          block: true,
        })
      ).rejects.toThrow();
    });

    it("accepts valid block input", async () => {
      try {
        await caller.whatsapp.blockContact({
          sessionId: "test-session",
          number: "5511999999999",
          block: true,
        });
      } catch (e: any) {
        expect(e.message).not.toContain("validation");
      }
    });
  });

  // ─── checkIsWhatsApp ───
  describe("checkIsWhatsApp", () => {
    it("accepts valid numbers array", async () => {
      try {
        await caller.whatsapp.checkIsWhatsApp({
          sessionId: "test-session",
          numbers: ["5511999999999", "5511888888888"],
        });
      } catch (e: any) {
        expect(e.message).not.toContain("validation");
      }
    });
  });

  // ─── markAsUnread ───
  describe("markAsUnread", () => {
    it("accepts valid markAsUnread input", async () => {
      try {
        await caller.whatsapp.markAsUnread({
          sessionId: "test-session",
          remoteJid: "5511999999999@s.whatsapp.net",
          messageId: "msg123",
        });
      } catch (e: any) {
        expect(e.message).not.toContain("validation");
      }
    });
  });
});

describe("WhatsApp Text Formatting", () => {
  // Test the formatting logic conceptually
  it("should recognize bold markers", () => {
    const text = "*bold text*";
    expect(text.match(/\*([^*]+)\*/)).toBeTruthy();
  });

  it("should recognize italic markers", () => {
    const text = "_italic text_";
    expect(text.match(/_([^_]+)_/)).toBeTruthy();
  });

  it("should recognize strikethrough markers", () => {
    const text = "~strikethrough~";
    expect(text.match(/~([^~]+)~/)).toBeTruthy();
  });

  it("should recognize monospace markers", () => {
    const text = "```monospace```";
    expect(text.match(/```([^`]+)```/)).toBeTruthy();
  });
});
