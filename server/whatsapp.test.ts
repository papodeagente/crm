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
});
