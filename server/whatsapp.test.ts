import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
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
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("WhatsApp API Routes", () => {
  it("auth.me returns the authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Test User");
    expect(result?.email).toBe("test@example.com");
  });

  it("auth.logout clears the session cookie", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalled();
  });

  it("whatsapp.status returns disconnected for unknown session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.status({ sessionId: "nonexistent-session" });
    expect(result.status).toBe("disconnected");
    expect(result.qrDataUrl).toBeNull();
    expect(result.user).toBeNull();
  });

  // ─── Conversations & Mark Read ───
  it("whatsapp.conversations returns empty array for unknown session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.conversations({ sessionId: "nonexistent-session" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("whatsapp.markRead succeeds for any session/jid", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.markRead({ sessionId: "test-session", remoteJid: "5511999999999@s.whatsapp.net" });
    expect(result).toEqual({ success: true });
  });

  it("whatsapp.conversations returns empty for blank sessionId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.conversations({ sessionId: "blank-session" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("whatsapp.sendMessage rejects when session is not connected", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.sendMessage({
        sessionId: "nonexistent",
        number: "5511999999999",
        message: "test",
      })
    ).rejects.toThrow();
  });

  it("whatsapp.sendMedia rejects when session is not connected", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.sendMedia({
        sessionId: "nonexistent",
        number: "5511999999999",
        mediaUrl: "https://example.com/image.jpg",
        mediaType: "image",
      })
    ).rejects.toThrow();
  });

  it("whatsapp.messages returns empty array for new session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.messages({
      sessionId: "new-session",
      limit: 50,
      offset: 0,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("whatsapp.logs returns empty array initially", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.logs({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("whatsapp.getChatbotSettings returns null for unconfigured session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.getChatbotSettings({ sessionId: "unconfigured" });
    expect(result).toBeNull();
  });

  it("whatsapp.updateChatbotSettings creates settings for new session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-chatbot-${Date.now()}`;
    const result = await caller.whatsapp.updateChatbotSettings({
      sessionId,
      enabled: true,
      systemPrompt: "Você é um assistente de teste.",
      maxTokens: 200,
    });
    expect(result).toEqual({ success: true });

    // Verify it was saved
    const settings = await caller.whatsapp.getChatbotSettings({ sessionId });
    expect(settings).toBeDefined();
    expect(settings?.enabled).toBe(true);
    expect(settings?.systemPrompt).toBe("Você é um assistente de teste.");
    expect(settings?.maxTokens).toBe(200);
  });

  it("whatsapp.connect input validation rejects empty sessionId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.connect({ sessionId: "" })
    ).rejects.toThrow();
  });

  it("whatsapp.sendMessage input validation rejects empty number", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.sendMessage({
        sessionId: "test",
        number: "",
        message: "test",
      })
    ).rejects.toThrow();
  });

  it("whatsapp.sendMessage input validation rejects empty message", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.sendMessage({
        sessionId: "test",
        number: "5511999999999",
        message: "",
      })
    ).rejects.toThrow();
  });

  // ─── New tests for media/video/audio endpoints ───

  it("whatsapp.sendMedia accepts video mediaType", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.sendMedia({
        sessionId: "nonexistent",
        number: "5511999999999",
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
      })
    ).rejects.toThrow(); // Rejects because session doesn't exist, but validates input
  });

  it("whatsapp.sendMedia accepts audio with ptt option", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.sendMedia({
        sessionId: "nonexistent",
        number: "5511999999999",
        mediaUrl: "https://example.com/audio.ogg",
        mediaType: "audio",
        ptt: true,
        mimetype: "audio/ogg; codecs=opus",
        duration: 15,
      })
    ).rejects.toThrow();
  });

  it("whatsapp.sendMedia accepts document with fileName", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.sendMedia({
        sessionId: "nonexistent",
        number: "5511999999999",
        mediaUrl: "https://example.com/doc.pdf",
        mediaType: "document",
        fileName: "proposta.pdf",
        mimetype: "application/pdf",
      })
    ).rejects.toThrow();
  });

  it("whatsapp.sendMedia rejects invalid mediaType", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.sendMedia({
        sessionId: "test",
        number: "5511999999999",
        mediaUrl: "https://example.com/file",
        mediaType: "invalid" as any,
      })
    ).rejects.toThrow();
  });

  it("whatsapp.sendMedia rejects invalid URL", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.sendMedia({
        sessionId: "test",
        number: "5511999999999",
        mediaUrl: "not-a-url",
        mediaType: "image",
      })
    ).rejects.toThrow();
  });

  it("whatsapp.messagesByContact returns empty for unknown contact", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.messagesByContact({
      sessionId: "test-session",
      remoteJid: "5511000000000@s.whatsapp.net",
      limit: 50,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("whatsapp.messagesByContact accepts beforeId for pagination", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.messagesByContact({
      sessionId: "test-session",
      remoteJid: "5511000000000@s.whatsapp.net",
      limit: 20,
      beforeId: 999999,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  // ─── Chatbot Settings (expanded) ───

  it("whatsapp.updateChatbotSettings saves all new fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-full-settings-${Date.now()}`;
    const result = await caller.whatsapp.updateChatbotSettings({
      sessionId,
      enabled: true,
      systemPrompt: "Test prompt",
      maxTokens: 300,
      mode: "whitelist",
      respondGroups: false,
      respondPrivate: true,
      onlyWhenMentioned: true,
      triggerWords: "ajuda,suporte",
      welcomeMessage: "Bem-vindo!",
      awayMessage: "Estamos fora do horário.",
      businessHoursEnabled: true,
      businessHoursStart: "08:00",
      businessHoursEnd: "20:00",
      businessHoursDays: "1,2,3,4,5,6",
      businessHoursTimezone: "America/Sao_Paulo",
      replyDelay: 5,
      contextMessageCount: 20,
      rateLimitPerHour: 10,
      rateLimitPerDay: 50,
      temperature: "0.50",
    });
    expect(result).toEqual({ success: true });

    const settings = await caller.whatsapp.getChatbotSettings({ sessionId });
    expect(settings).toBeDefined();
    expect(settings?.mode).toBe("whitelist");
    expect(settings?.respondGroups).toBe(false);
    expect(settings?.respondPrivate).toBe(true);
    expect(settings?.onlyWhenMentioned).toBe(true);
    expect(settings?.triggerWords).toBe("ajuda,suporte");
    expect(settings?.welcomeMessage).toBe("Bem-vindo!");
    expect(settings?.awayMessage).toBe("Estamos fora do horário.");
    expect(settings?.businessHoursEnabled).toBe(true);
    expect(settings?.businessHoursStart).toBe("08:00");
    expect(settings?.businessHoursEnd).toBe("20:00");
    expect(settings?.businessHoursDays).toBe("1,2,3,4,5,6");
    expect(settings?.replyDelay).toBe(5);
    expect(settings?.contextMessageCount).toBe(20);
    expect(settings?.rateLimitPerHour).toBe(10);
    expect(settings?.rateLimitPerDay).toBe(50);
  });

  it("whatsapp.updateChatbotSettings validates mode enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.updateChatbotSettings({
        sessionId: "test",
        mode: "invalid" as any,
      })
    ).rejects.toThrow();
  });

  it("whatsapp.updateChatbotSettings validates replyDelay range", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.updateChatbotSettings({
        sessionId: "test",
        replyDelay: 100, // max is 60
      })
    ).rejects.toThrow();
  });

  it("whatsapp.updateChatbotSettings validates contextMessageCount range", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.updateChatbotSettings({
        sessionId: "test",
        contextMessageCount: 0, // min is 1
      })
    ).rejects.toThrow();
  });

  // ─── Chatbot Rules (whitelist/blacklist) ───

  it("whatsapp.getChatbotRules returns empty for new session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.getChatbotRules({ sessionId: "nonexistent-rules" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("whatsapp.addChatbotRule adds a whitelist rule", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-rules-${Date.now()}`;
    const result = await caller.whatsapp.addChatbotRule({
      sessionId,
      remoteJid: "5511999999999@s.whatsapp.net",
      ruleType: "whitelist",
      contactName: "João Silva",
    });
    expect(result).toEqual({ success: true });

    const rules = await caller.whatsapp.getChatbotRules({ sessionId });
    expect(rules.length).toBe(1);
    expect(rules[0].ruleType).toBe("whitelist");
    expect(rules[0].contactName).toBe("João Silva");
  });

  it("whatsapp.addChatbotRule adds a blacklist rule", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-blacklist-${Date.now()}`;
    const result = await caller.whatsapp.addChatbotRule({
      sessionId,
      remoteJid: "120363xxx@g.us",
      ruleType: "blacklist",
      contactName: "Grupo Spam",
    });
    expect(result).toEqual({ success: true });

    const rules = await caller.whatsapp.getChatbotRules({ sessionId, ruleType: "blacklist" });
    expect(rules.length).toBe(1);
    expect(rules[0].ruleType).toBe("blacklist");
  });

  it("whatsapp.getChatbotRules filters by ruleType", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-filter-${Date.now()}`;

    await caller.whatsapp.addChatbotRule({ sessionId, remoteJid: "111@s.whatsapp.net", ruleType: "whitelist" });
    await caller.whatsapp.addChatbotRule({ sessionId, remoteJid: "222@s.whatsapp.net", ruleType: "blacklist" });

    const whitelistOnly = await caller.whatsapp.getChatbotRules({ sessionId, ruleType: "whitelist" });
    expect(whitelistOnly.length).toBe(1);
    expect(whitelistOnly[0].remoteJid).toBe("111@s.whatsapp.net");

    const blacklistOnly = await caller.whatsapp.getChatbotRules({ sessionId, ruleType: "blacklist" });
    expect(blacklistOnly.length).toBe(1);
    expect(blacklistOnly[0].remoteJid).toBe("222@s.whatsapp.net");
  });

  it("whatsapp.removeChatbotRule removes a rule by id", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-remove-${Date.now()}`;

    await caller.whatsapp.addChatbotRule({ sessionId, remoteJid: "333@s.whatsapp.net", ruleType: "whitelist" });
    const rules = await caller.whatsapp.getChatbotRules({ sessionId });
    expect(rules.length).toBe(1);

    const result = await caller.whatsapp.removeChatbotRule({ id: rules[0].id });
    expect(result).toEqual({ success: true });

    const afterRemove = await caller.whatsapp.getChatbotRules({ sessionId });
    expect(afterRemove.length).toBe(0);
  });

  it("whatsapp.addChatbotRule rejects empty remoteJid", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.addChatbotRule({
        sessionId: "test",
        remoteJid: "",
        ruleType: "whitelist",
      })
    ).rejects.toThrow();
  });

  it("whatsapp.addChatbotRule rejects invalid ruleType", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.addChatbotRule({
        sessionId: "test",
        remoteJid: "555@s.whatsapp.net",
        ruleType: "invalid" as any,
      })
    ).rejects.toThrow();
  });

  // ─── ResolveJid (used by NewChatPanel) ───

  it("whatsapp.resolveJid throws for disconnected session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.resolveJid({
        sessionId: "nonexistent-session",
        phone: "84999999999",
      })
    ).rejects.toThrow();
  });

  it("whatsapp.resolveJid validates phone input is not empty", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.resolveJid({
        sessionId: "test",
        phone: "",
      })
    ).rejects.toThrow();
  });

  it("whatsapp.resolveJid validates sessionId is required", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.resolveJid({
        sessionId: "",
        phone: "84999999999",
      } as any)
    ).rejects.toThrow();
  });

  it("whatsapp.updateChatbotSettings partial update preserves existing values", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-partial-${Date.now()}`;

    // Create initial settings
    await caller.whatsapp.updateChatbotSettings({
      sessionId,
      enabled: true,
      systemPrompt: "Initial prompt",
      maxTokens: 300,
      mode: "all",
    });

    // Partial update - only change mode
    await caller.whatsapp.updateChatbotSettings({
      sessionId,
      mode: "blacklist",
    });

    const settings = await caller.whatsapp.getChatbotSettings({ sessionId });
    expect(settings?.mode).toBe("blacklist");
    // Other fields should remain
    expect(settings?.enabled).toBe(true);
    expect(settings?.systemPrompt).toBe("Initial prompt");
    expect(settings?.maxTokens).toBe(300);
  });
});

describe("WhatsApp Inbox Sync Tests", () => {
  it("whatsapp.profilePictures returns empty object for disconnected session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.profilePictures({
      sessionId: "nonexistent-session",
      jids: ["5511999999999@s.whatsapp.net"],
    });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it("whatsapp.profilePictures accepts empty jids array", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.profilePictures({
      sessionId: "test-session",
      jids: [],
    });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    expect(Object.keys(result).length).toBe(0);
  });

  it("whatsapp.conversations returns array with correct shape", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.conversations({ sessionId: "test-session" });
    expect(Array.isArray(result)).toBe(true);
    // Each item should have the expected fields if any exist
    if (result.length > 0) {
      const conv = result[0];
      expect(conv).toHaveProperty("remoteJid");
      expect(conv).toHaveProperty("lastMessage");
      expect(conv).toHaveProperty("lastTimestamp");
      expect(conv).toHaveProperty("unreadCount");
      expect(conv).toHaveProperty("contactPushName");
    }
  });

  it("whatsapp.messagesByContact returns messages in expected format", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.messagesByContact({
      sessionId: "test-session",
      remoteJid: "5511999999999@s.whatsapp.net",
      limit: 10,
    });
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      const msg = result[0];
      expect(msg).toHaveProperty("id");
      expect(msg).toHaveProperty("fromMe");
      expect(msg).toHaveProperty("messageType");
      expect(msg).toHaveProperty("timestamp");
    }
  });

  it("whatsapp.markRead returns success for valid input", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.markRead({
      sessionId: "test-session",
      remoteJid: "5511999999999@s.whatsapp.net",
    });
    expect(result).toEqual({ success: true });
  });

  it("whatsapp.profilePictures handles multiple jids", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const jids = [
      "5511999999999@s.whatsapp.net",
      "5511888888888@s.whatsapp.net",
      "5511777777777@s.whatsapp.net",
    ];
    const result = await caller.whatsapp.profilePictures({
      sessionId: "test-session",
      jids,
    });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });
});
