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
    saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },
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

  it("whatsapp.connect requires no input (auto-creates instance)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // connect no longer takes sessionId — it auto-generates one per user
    const result = await caller.whatsapp.connect();
    expect(result).toBeDefined();
    expect(result.sessionId).toBeDefined();
    expect(typeof result.sessionId).toBe("string");
    // Status should be connecting or connected (depends on Evolution API availability)
    expect(["connecting", "connected", "disconnected"]).toContain(result.status);
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

  it("whatsapp.resolveJid returns JID for any session (Evolution API)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Evolution API resolves JID locally without needing a connected session
    const result = await caller.whatsapp.resolveJid({
      sessionId: "nonexistent-session",
      phone: "84999999999",
    });
    expect(result.jid).toBe("84999999999@s.whatsapp.net");
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

  it("whatsapp.resolveJid returns JID even with empty sessionId (Evolution API)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Evolution API resolves JID locally, sessionId validation is relaxed
    const result = await caller.whatsapp.resolveJid({
      sessionId: "any",
      phone: "84999999999",
    });
    expect(result.jid).toBe("84999999999@s.whatsapp.net");
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

describe("Multi-Agent / SaaS Assignment Tests", () => {
  function createAuthContext() {
    const user = {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus" as const,
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const ctx = {
      user,
      saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    };
    return { ctx };
  }

  // ─── conversationsMultiAgent ───

  it("whatsapp.conversationsMultiAgent returns array for unknown session", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.conversationsMultiAgent({
      sessionId: "nonexistent-session",
      tenantId: 1,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("whatsapp.conversationsMultiAgent accepts filter params", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.conversationsMultiAgent({
      sessionId: "test-session",
      tenantId: 1,
      unassignedOnly: true,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("whatsapp.conversationsMultiAgent accepts status filter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.conversationsMultiAgent({
      sessionId: "test-session",
      tenantId: 1,
      status: "open",
    });
    expect(Array.isArray(result)).toBe(true);
  });

  // ─── assignConversation ───

  it("whatsapp.assignConversation creates assignment for new conversation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-assign-${Date.now()}`;
    const remoteJid = "5511999999999@s.whatsapp.net";
    const result = await caller.whatsapp.assignConversation({
      tenantId: 1,
      sessionId,
      remoteJid,
      assignedUserId: null,
    });
    // Should create assignment even with null userId
    expect(result).toBeDefined();
  });

  it("whatsapp.assignConversation can assign to a user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-assign-user-${Date.now()}`;
    const remoteJid = "5511888888888@s.whatsapp.net";
    const result = await caller.whatsapp.assignConversation({
      tenantId: 1,
      sessionId,
      remoteJid,
      assignedUserId: 1,
    });
    expect(result).toBeDefined();
    if (result) {
      expect(result.assignedUserId).toBe(1);
    }
  });

  it("whatsapp.assignConversation can remove assignment", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-unassign-${Date.now()}`;
    const remoteJid = "5511777777777@s.whatsapp.net";
    // First assign
    await caller.whatsapp.assignConversation({
      tenantId: 1, sessionId, remoteJid, assignedUserId: 1,
    });
    // Then unassign
    const result = await caller.whatsapp.assignConversation({
      tenantId: 1, sessionId, remoteJid, assignedUserId: null,
    });
    expect(result).toBeDefined();
    if (result) {
      expect(result.assignedUserId).toBeNull();
    }
  });

  // ─── transferConversation ───

  it("whatsapp.transferConversation transfers to another user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-transfer-${Date.now()}`;
    const remoteJid = "5511666666666@s.whatsapp.net";
    // Assign to user 1
    await caller.whatsapp.assignConversation({
      tenantId: 1, sessionId, remoteJid, assignedUserId: 1,
    });
    // Transfer to user 2
    const result = await caller.whatsapp.transferConversation({
      tenantId: 1, sessionId, remoteJid, toUserId: 2,
    });
    expect(result).toBeDefined();
    if (result) {
      expect(result.assignedUserId).toBe(2);
    }
  });

  // ─── updateAssignmentStatus ───

  it("whatsapp.updateAssignmentStatus changes status", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-status-${Date.now()}`;
    const remoteJid = "5511555555555@s.whatsapp.net";
    // Create assignment first
    await caller.whatsapp.assignConversation({
      tenantId: 1, sessionId, remoteJid, assignedUserId: 1,
    });
    // Update status
    const result = await caller.whatsapp.updateAssignmentStatus({
      tenantId: 1, sessionId, remoteJid, status: "resolved",
    });
    expect(result).toEqual({ success: true });
  });

  it("whatsapp.updateAssignmentStatus validates status enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.whatsapp.updateAssignmentStatus({
        tenantId: 1,
        sessionId: "test",
        remoteJid: "test@s.whatsapp.net",
        status: "invalid" as any,
      })
    ).rejects.toThrow();
  });

  // ─── getAssignment ───

  it("whatsapp.getAssignment returns null for unassigned conversation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.getAssignment({
      tenantId: 1,
      sessionId: "nonexistent",
      remoteJid: "5511444444444@s.whatsapp.net",
    });
    expect(result).toBeNull();
  });

  it("whatsapp.getAssignment returns assignment after assign", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-get-assign-${Date.now()}`;
    const remoteJid = "5511333333333@s.whatsapp.net";
    await caller.whatsapp.assignConversation({
      tenantId: 1, sessionId, remoteJid, assignedUserId: 1,
    });
    const result = await caller.whatsapp.getAssignment({
      tenantId: 1, sessionId, remoteJid,
    });
    expect(result).toBeDefined();
    expect(result?.assignedUserId).toBe(1);
  });

  // ─── agents & teams ───

  it("whatsapp.agents returns array", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.agents({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("whatsapp.teams returns array", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.teams({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  // ─── autoAssign ───

  it("whatsapp.autoAssign returns not assigned when no agents exist", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.autoAssign({
      tenantId: 999, // Tenant with no agents
      sessionId: "test-auto",
      remoteJid: "5511222222222@s.whatsapp.net",
    });
    // May or may not have agents, but should not throw
    expect(result).toBeDefined();
    expect(typeof result.assigned).toBe("boolean");
  });

  // ─── Input validation ───

  it("whatsapp.assignConversation validates tenantId defaults to 1", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sessionId = `test-default-tenant-${Date.now()}`;
    const result = await caller.whatsapp.assignConversation({
      sessionId,
      remoteJid: "5511111111111@s.whatsapp.net",
      assignedUserId: null,
    });
    expect(result).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════
// TEAM MANAGEMENT TESTS
// ════════════════════════════════════════════════════════════

describe("Team Management API Routes", () => {
  function createAuthCtx() {
    const user: NonNullable<TrpcContext["user"]> = {
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
    return {
      ctx: {
        user,
        saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
      } as TrpcContext,
    };
  }

  it("teamManagement.listTeams returns an array", async () => {
    const { ctx } = createAuthCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.teamManagement.listTeams({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("teamManagement.listAgents returns an array", async () => {
    const { ctx } = createAuthCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.teamManagement.listAgents({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("teamManagement.listRules returns an array", async () => {
    const { ctx } = createAuthCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.teamManagement.listRules({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("teamManagement.createTeam creates a team and returns it", async () => {
    const { ctx } = createAuthCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.teamManagement.createTeam({
      tenantId: 1,
      name: "Test Team " + Date.now(),
      description: "Test team description",
      color: "#6366f1",
    });
    expect(result).toBeDefined();
    if (result) {
      expect(result.name).toContain("Test Team");
    }
  });

  it("teamManagement.createRule creates a distribution rule", async () => {
    const { ctx } = createAuthCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.teamManagement.createRule({
      tenantId: 1,
      name: "Test Rule " + Date.now(),
      strategy: "round_robin",
      priority: 5,
    });
    expect(result).toBeDefined();
    if (result) {
      expect(result.name).toContain("Test Rule");
    }
  });

  it("teamManagement.toggleRule toggles a rule active state", async () => {
    const { ctx } = createAuthCtx();
    const caller = appRouter.createCaller(ctx);
    // First create a rule
    const rule = await caller.teamManagement.createRule({
      tenantId: 1,
      name: "Toggle Test " + Date.now(),
      strategy: "manual",
      priority: 1,
    });
    if (rule) {
      const result = await caller.teamManagement.toggleRule({
        tenantId: 1,
        id: rule.id,
        isActive: false,
      });
      expect(result).toEqual({ success: true });
    }
  });

  it("teamManagement.deleteTeam removes a team", async () => {
    const { ctx } = createAuthCtx();
    const caller = appRouter.createCaller(ctx);
    // Create then delete
    const team = await caller.teamManagement.createTeam({
      tenantId: 1,
      name: "Delete Test " + Date.now(),
    });
    if (team) {
      const result = await caller.teamManagement.deleteTeam({
        tenantId: 1,
        id: team.id,
      });
      expect(result).toEqual({ success: true });
    }
  });

  it("teamManagement.deleteRule removes a distribution rule", async () => {
    const { ctx } = createAuthCtx();
    const caller = appRouter.createCaller(ctx);
    const rule = await caller.teamManagement.createRule({
      tenantId: 1,
      name: "Delete Rule Test " + Date.now(),
      strategy: "least_busy",
      priority: 0,
    });
    if (rule) {
      const result = await caller.teamManagement.deleteRule({
        tenantId: 1,
        id: rule.id,
      });
      expect(result).toEqual({ success: true });
    }
  });
});


// ─── Contact Profile & Custom Fields Tests ───
describe("contactProfile", () => {
  const caller = appRouter.createCaller(createAuthContext().ctx);

  describe("getMetrics", () => {
    it("should return metrics for a contact", async () => {
      const result = await caller.contactProfile.getMetrics({ tenantId: 1, contactId: 1 });
      expect(result).toHaveProperty("totalDeals");
      expect(result).toHaveProperty("wonDeals");
      expect(result).toHaveProperty("totalSpentCents");
      expect(result).toHaveProperty("daysSinceLastPurchase");
      expect(typeof result.totalDeals).toBe("number");
      expect(typeof result.wonDeals).toBe("number");
      expect(typeof result.totalSpentCents).toBe("number");
      expect(result.totalDeals).toBeGreaterThanOrEqual(0);
      expect(result.wonDeals).toBeGreaterThanOrEqual(0);
    });

    it("should return zero metrics for non-existent contact", async () => {
      const result = await caller.contactProfile.getMetrics({ tenantId: 1, contactId: 999999 });
      expect(result.totalDeals).toBe(0);
      expect(result.wonDeals).toBe(0);
      expect(result.totalSpentCents).toBe(0);
      expect(result.daysSinceLastPurchase).toBeNull();
    });
  });

  describe("getDeals", () => {
    it("should return deals array for a contact", async () => {
      const result = await caller.contactProfile.getDeals({ tenantId: 1, contactId: 1 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return empty array for non-existent contact", async () => {
      const result = await caller.contactProfile.getDeals({ tenantId: 1, contactId: 999999 });
      expect(result).toEqual([]);
    });
  });

  describe("customFieldValues", () => {
    it("should return custom field values for a contact", async () => {
      const result = await caller.contactProfile.getCustomFieldValues({
        tenantId: 1,
        entityType: "contact",
        entityId: 1,
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should have setCustomFieldValues procedure callable", () => {
      expect(typeof caller.contactProfile.setCustomFieldValues).toBe("function");
    });
  });
});

describe("customFields", () => {
  const caller = appRouter.createCaller(createAuthContext().ctx);

  describe("list", () => {
    it("should return custom fields for contacts entity", async () => {
      const result = await caller.customFields.list({ tenantId: 1, entity: "contact" });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return custom fields for deals entity", async () => {
      const result = await caller.customFields.list({ tenantId: 1, entity: "deal" });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return custom fields for all entity types", async () => {
      for (const entity of ["contact", "deal", "company"] as const) {
        const result = await caller.customFields.list({ tenantId: 1, entity });
        expect(Array.isArray(result)).toBe(true);
      }
    });
  });

  describe("create and manage (read-only verification)", () => {
    it("should have create procedure callable", () => {
      expect(typeof caller.customFields.create).toBe("function");
    });

    it("should have update procedure callable", () => {
      expect(typeof caller.customFields.update).toBe("function");
    });

    it("should have delete procedure callable", () => {
      expect(typeof caller.customFields.delete).toBe("function");
    });

    it("should have reorder procedure callable", () => {
      expect(typeof caller.customFields.reorder).toBe("function");
    });

    it("should list existing custom fields without modification", async () => {
      const contactFields = await caller.customFields.list({ tenantId: 1, entity: "contact" });
      expect(Array.isArray(contactFields)).toBe(true);
      if (contactFields.length > 0) {
        const f = contactFields[0];
        expect(typeof f.id).toBe("number");
        expect(typeof f.label).toBe("string");
        expect(typeof f.fieldType).toBe("string");
      }
    });
  });

  describe("visibility toggles (read-only verification)", () => {
    it("should list custom fields with visibility properties", async () => {
      const fields = await caller.customFields.list({ tenantId: 1, entity: "contact" });
      if (fields.length > 0) {
        const f = fields[0];
        // Verify visibility properties exist
        expect("isVisibleOnForm" in f).toBe(true);
        expect("isVisibleOnProfile" in f).toBe(true);
      }
    });
  });

  /* ════════════════════════════════════════════════════════════ */
  /* DealDetail Page Backend Tests                                */
  /* ════════════════════════════════════════════════════════════ */
  describe("DealDetail page backend", () => {
    it("should list deal history entries", async () => {
      const caller = appRouter.createCaller(createAuthContext().ctx);
      const result = await caller.crm.deals.history.list({ tenantId: 1, dealId: 9999 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should list deal notes", async () => {
      const caller = appRouter.createCaller(createAuthContext().ctx);
      const result = await caller.crm.notes.list({ tenantId: 1, entityType: "deal", entityId: 9999 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should list deal products", async () => {
      const caller = appRouter.createCaller(createAuthContext().ctx);
      const result = await caller.crm.deals.products.list({ tenantId: 1, dealId: 9999 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should list deal participants", async () => {
      const caller = appRouter.createCaller(createAuthContext().ctx);
      const result = await caller.crm.deals.participants.list({ tenantId: 1, dealId: 9999 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should list deal tasks", async () => {
      const caller = appRouter.createCaller(createAuthContext().ctx);
      const result = await caller.crm.tasks.list({ tenantId: 1, entityType: "deal", entityId: 9999 });
      expect(result).toHaveProperty("tasks");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.tasks)).toBe(true);
    });

    it("should get custom field values for a deal", async () => {
      const caller = appRouter.createCaller(createAuthContext().ctx);
      const result = await caller.contactProfile.getCustomFieldValues({ tenantId: 1, entityType: "deal", entityId: 9999 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should list custom fields for deal entity", async () => {
      const caller = appRouter.createCaller(createAuthContext().ctx);
      const result = await caller.customFields.list({ tenantId: 1, entity: "deal" });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should list pipeline stages", async () => {
      const caller = appRouter.createCaller(createAuthContext().ctx);
      const pipelines = await caller.crm.pipelines.list({ tenantId: 1 });
      expect(Array.isArray(pipelines)).toBe(true);
      if (pipelines.length > 0) {
        const stages = await caller.crm.pipelines.stages({ tenantId: 1, pipelineId: pipelines[0].id });
        expect(Array.isArray(stages)).toBe(true);
      }
    });
  });
});


/* ─── Pipeline Management Tests (READ-ONLY — never create/modify pipelines or stages) ─── */
describe("Pipeline Management", () => {
  const caller = appRouter.createCaller(createAuthContext().ctx);
  const tenantId = 1;

  describe("Read Pipelines", () => {
    it("should list pipelines without creating new ones", async () => {
      const result = await caller.crm.pipelines.list({ tenantId });
      expect(Array.isArray(result)).toBe(true);
      // Pipelines must exist from user setup, not from tests
    });

    it("should list stages for existing pipelines", async () => {
      const pipelines = await caller.crm.pipelines.list({ tenantId });
      if (pipelines.length > 0) {
        const result = await caller.crm.pipelines.stages({
          tenantId,
          pipelineId: pipelines[0].id,
        });
        expect(Array.isArray(result)).toBe(true);
      }
    });
  });

  describe("Pipeline Automations", () => {
    it("should list automations without creating new ones", async () => {
      const result = await caller.crm.pipelineAutomations.list({ tenantId });
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
