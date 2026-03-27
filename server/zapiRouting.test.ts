/**
 * Tests for Z-API routing in WhatsApp message sending.
 * Validates that sendTextMessage and sendMediaMessage correctly route
 * to Z-API provider when session is registered as Z-API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the zapiProvider module
vi.mock("./providers/zapiProvider", () => ({
  zapiProvider: {
    sendText: vi.fn().mockResolvedValue({
      key: { id: "zapi-msg-123", remoteJid: "5511999999999@s.whatsapp.net", fromMe: true },
      messageTimestamp: 1700000000,
      status: "SENT",
    }),
    sendMedia: vi.fn().mockResolvedValue({
      key: { id: "zapi-media-456", remoteJid: "5511999999999@s.whatsapp.net", fromMe: true },
      messageTimestamp: 1700000000,
      status: "SENT",
    }),
    sendAudio: vi.fn().mockResolvedValue({
      key: { id: "zapi-audio-789", remoteJid: "5511999999999@s.whatsapp.net", fromMe: true },
      messageTimestamp: 1700000000,
      status: "SENT",
    }),
    sendTextWithQuote: vi.fn().mockResolvedValue({
      key: { id: "zapi-quote-101", remoteJid: "5511999999999@s.whatsapp.net", fromMe: true },
      messageTimestamp: 1700000000,
      status: "SENT",
    }),
    sendReaction: vi.fn().mockResolvedValue({ success: true }),
    sendPresence: vi.fn().mockResolvedValue(undefined),
  },
  getZApiSession: vi.fn(),
  registerZApiSession: vi.fn(),
  unregisterZApiSession: vi.fn(),
}));

// Mock Evolution API
vi.mock("./evolutionApi", () => ({
  sendText: vi.fn().mockResolvedValue({
    key: { id: "evo-msg-123", remoteJid: "5511999999999@s.whatsapp.net", fromMe: true },
    messageTimestamp: 1700000000,
    status: "SENT",
  }),
  sendMedia: vi.fn().mockResolvedValue({
    key: { id: "evo-media-456", remoteJid: "5511999999999@s.whatsapp.net", fromMe: true },
    messageTimestamp: 1700000000,
    status: "SENT",
  }),
  sendAudio: vi.fn().mockResolvedValue({
    key: { id: "evo-audio-789", remoteJid: "5511999999999@s.whatsapp.net", fromMe: true },
    messageTimestamp: 1700000000,
    status: "SENT",
  }),
  sendTextWithQuote: vi.fn().mockResolvedValue({
    key: { id: "evo-quote-101", remoteJid: "5511999999999@s.whatsapp.net", fromMe: true },
    messageTimestamp: 1700000000,
    status: "SENT",
  }),
  sendReaction: vi.fn().mockResolvedValue({ success: true }),
  sendPresence: vi.fn().mockResolvedValue({}),
}));

// Mock DB
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock conversationResolver
vi.mock("./conversationResolver", () => ({
  resolveInbound: vi.fn(),
  updateConversationLastMessage: vi.fn(),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-nanoid"),
}));

// Mock schema
vi.mock("../drizzle/schema", () => ({
  whatsappSessions: {},
  waMessages: {},
  waConversations: {},
  waContacts: {},
  tenants: {},
  waChannels: {},
  channelChangeEvents: {},
}));

describe("Z-API Routing in WhatsApp Manager", () => {
  let getZApiSession: any;
  let zapiProvider: any;
  let evo: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const zapiMod = await import("./providers/zapiProvider");
    getZApiSession = zapiMod.getZApiSession;
    zapiProvider = zapiMod.zapiProvider;
    evo = await import("./evolutionApi");
  });

  describe("sendTextMessage routing", () => {
    it("should route to Z-API when session is registered as Z-API", async () => {
      // Setup: getZApiSession returns config for this session
      vi.mocked(getZApiSession).mockReturnValue({
        instanceId: "zapi-inst-123",
        token: "zapi-token-abc",
        clientToken: "client-token-xyz",
      });

      const { whatsappManager } = await import("./whatsappEvolution");

      // Register a connected session
      whatsappManager.setSessionState("crm-1-1", {
        instanceName: "crm-1-1",
        sessionId: "crm-1-1",
        userId: 1,
        tenantId: 1,
        status: "connected",
        qrCode: null,
        qrDataUrl: null,
        user: null,
        lastConnectedAt: Date.now(),
      });

      await whatsappManager.sendTextMessage("crm-1-1", "5511999999999@s.whatsapp.net", "Hello Z-API!");

      // Should have called zapiProvider.sendText
      expect(zapiProvider.sendText).toHaveBeenCalledWith("crm-1-1", "5511999999999", "Hello Z-API!");
      // Should NOT have called evo.sendText
      expect(evo.sendText).not.toHaveBeenCalled();
    });

    it("should route to Evolution when session is NOT registered as Z-API", async () => {
      // Setup: getZApiSession returns undefined (not a Z-API session)
      vi.mocked(getZApiSession).mockReturnValue(undefined);

      const { whatsappManager } = await import("./whatsappEvolution");

      whatsappManager.setSessionState("crm-2-2", {
        instanceName: "crm-2-2",
        sessionId: "crm-2-2",
        userId: 2,
        tenantId: 2,
        status: "connected",
        qrCode: null,
        qrDataUrl: null,
        user: null,
        lastConnectedAt: Date.now(),
      });

      await whatsappManager.sendTextMessage("crm-2-2", "5511888888888@s.whatsapp.net", "Hello Evolution!");

      // Should have called evo.sendText
      expect(evo.sendText).toHaveBeenCalledWith("crm-2-2", "5511888888888", "Hello Evolution!");
      // Should NOT have called zapiProvider.sendText
      expect(zapiProvider.sendText).not.toHaveBeenCalled();
    });

    it("should throw error for non-existent session", async () => {
      const { whatsappManager } = await import("./whatsappEvolution");
      await expect(
        whatsappManager.sendTextMessage("non-existent", "5511999999999@s.whatsapp.net", "test")
      ).rejects.toThrow("Sessão não encontrada");
    });

    it("should throw error for disconnected session", async () => {
      const { whatsappManager } = await import("./whatsappEvolution");
      whatsappManager.setSessionState("crm-3-3", {
        instanceName: "crm-3-3",
        sessionId: "crm-3-3",
        userId: 3,
        tenantId: 3,
        status: "disconnected",
        qrCode: null,
        qrDataUrl: null,
        user: null,
        lastConnectedAt: null,
      });

      await expect(
        whatsappManager.sendTextMessage("crm-3-3", "5511999999999@s.whatsapp.net", "test")
      ).rejects.toThrow("WhatsApp não está conectado");
    });
  });

  describe("sendMediaMessage routing", () => {
    it("should route media to Z-API when session is Z-API", async () => {
      vi.mocked(getZApiSession).mockReturnValue({
        instanceId: "zapi-inst-123",
        token: "zapi-token-abc",
        clientToken: "client-token-xyz",
      });

      const { whatsappManager } = await import("./whatsappEvolution");
      whatsappManager.setSessionState("crm-4-4", {
        instanceName: "crm-4-4",
        sessionId: "crm-4-4",
        userId: 4,
        tenantId: 4,
        status: "connected",
        qrCode: null,
        qrDataUrl: null,
        user: null,
        lastConnectedAt: Date.now(),
      });

      await whatsappManager.sendMediaMessage(
        "crm-4-4", "5511999999999@s.whatsapp.net",
        "https://example.com/image.jpg", "image", "Caption"
      );

      expect(zapiProvider.sendMedia).toHaveBeenCalled();
      expect(evo.sendMedia).not.toHaveBeenCalled();
    });

    it("should route audio to Z-API when session is Z-API and ptt", async () => {
      vi.mocked(getZApiSession).mockReturnValue({
        instanceId: "zapi-inst-123",
        token: "zapi-token-abc",
      });

      const { whatsappManager } = await import("./whatsappEvolution");
      whatsappManager.setSessionState("crm-5-5", {
        instanceName: "crm-5-5",
        sessionId: "crm-5-5",
        userId: 5,
        tenantId: 5,
        status: "connected",
        qrCode: null,
        qrDataUrl: null,
        user: null,
        lastConnectedAt: Date.now(),
      });

      await whatsappManager.sendMediaMessage(
        "crm-5-5", "5511999999999@s.whatsapp.net",
        "https://example.com/audio.ogg", "audio", undefined, undefined,
        { ptt: true }
      );

      expect(zapiProvider.sendAudio).toHaveBeenCalled();
      expect(evo.sendAudio).not.toHaveBeenCalled();
    });
  });

  describe("sendReaction routing", () => {
    it("should route reaction to Z-API when session is Z-API", async () => {
      vi.mocked(getZApiSession).mockReturnValue({
        instanceId: "zapi-inst-123",
        token: "zapi-token-abc",
      });

      const { whatsappManager } = await import("./whatsappEvolution");
      whatsappManager.setSessionState("crm-6-6", {
        instanceName: "crm-6-6",
        sessionId: "crm-6-6",
        userId: 6,
        tenantId: 6,
        status: "connected",
        qrCode: null,
        qrDataUrl: null,
        user: null,
        lastConnectedAt: Date.now(),
      });

      const key = { remoteJid: "5511999999999@s.whatsapp.net", fromMe: false, id: "msg-123" };
      await whatsappManager.sendReaction("crm-6-6", key, "👍");

      expect(zapiProvider.sendReaction).toHaveBeenCalledWith("crm-6-6", key, "👍");
      expect(evo.sendReaction).not.toHaveBeenCalled();
    });
  });

  describe("sendPresenceUpdate routing", () => {
    it("should route presence to Z-API for Z-API sessions", async () => {
      vi.mocked(getZApiSession).mockReturnValue({
        instanceId: "zapi-inst-123",
        token: "zapi-token-abc",
      });

      const { whatsappManager } = await import("./whatsappEvolution");
      whatsappManager.setSessionState("crm-7-7", {
        instanceName: "crm-7-7",
        sessionId: "crm-7-7",
        userId: 7,
        tenantId: 7,
        status: "connected",
        qrCode: null,
        qrDataUrl: null,
        user: null,
        lastConnectedAt: Date.now(),
      });

      await whatsappManager.sendPresenceUpdate("crm-7-7", "5511999999999@s.whatsapp.net", "composing");

      // Should have called zapiProvider.sendPresence, NOT evo.sendPresence
      expect(zapiProvider.sendPresence).toHaveBeenCalled();
      expect(evo.sendPresence).not.toHaveBeenCalled();
    });
  });

  describe("Webhook RD Station scenario", () => {
    it("should correctly send via Z-API when webhook triggers auto-WhatsApp on Z-API session", async () => {
      vi.mocked(getZApiSession).mockReturnValue({
        instanceId: "zapi-inst-999",
        token: "zapi-token-xyz",
        clientToken: "client-token-abc",
      });

      const { whatsappManager } = await import("./whatsappEvolution");
      whatsappManager.setSessionState("crm-10-10", {
        instanceName: "crm-10-10",
        sessionId: "crm-10-10",
        userId: 10,
        tenantId: 10,
        status: "connected",
        qrCode: null,
        qrDataUrl: null,
        user: null,
        lastConnectedAt: Date.now(),
      });

      // Simulate what the webhook does
      const jid = "5511999887766@s.whatsapp.net";
      const message = "Olá João! Recebemos seu cadastro.";
      const result = await whatsappManager.sendTextMessage("crm-10-10", jid, message);

      // Should have routed to Z-API
      expect(zapiProvider.sendText).toHaveBeenCalledWith("crm-10-10", "5511999887766", message);
      expect(evo.sendText).not.toHaveBeenCalled();

      // Result should have canonical format
      expect(result.key.id).toBe("zapi-msg-123");
      expect(result.status).toBe("SENT");
    });
  });
});
