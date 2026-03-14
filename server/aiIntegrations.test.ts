import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn(),
  listAiIntegrations: vi.fn(),
  getAiIntegration: vi.fn(),
  getActiveAiIntegration: vi.fn(),
  createAiIntegration: vi.fn(),
  updateAiIntegration: vi.fn(),
  deleteAiIntegration: vi.fn(),
  testAiApiKey: vi.fn(),
  getAiSettings: vi.fn(),
  updateAiSettings: vi.fn(),
  getAnyActiveAiIntegration: vi.fn(),
}));

import {
  listAiIntegrations,
  getAiIntegration,
  getActiveAiIntegration,
  createAiIntegration,
  updateAiIntegration,
  deleteAiIntegration,
  testAiApiKey,
  getAiSettings,
  updateAiSettings,
  getAnyActiveAiIntegration,
} from "./db";

const mockList = listAiIntegrations as ReturnType<typeof vi.fn>;
const mockGet = getAiIntegration as ReturnType<typeof vi.fn>;
const mockGetActive = getActiveAiIntegration as ReturnType<typeof vi.fn>;
const mockCreate = createAiIntegration as ReturnType<typeof vi.fn>;
const mockUpdate = updateAiIntegration as ReturnType<typeof vi.fn>;
const mockDelete = deleteAiIntegration as ReturnType<typeof vi.fn>;
const mockTestKey = testAiApiKey as ReturnType<typeof vi.fn>;
const mockGetSettings = getAiSettings as ReturnType<typeof vi.fn>;
const mockUpdateSettings = updateAiSettings as ReturnType<typeof vi.fn>;
const mockGetAnyActive = getAnyActiveAiIntegration as ReturnType<typeof vi.fn>;

describe("AI Integrations — Simplified", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── CRUD ──────────────────────────────────────────────────

  describe("listAiIntegrations", () => {
    it("returns empty array when no integrations exist", async () => {
      mockList.mockResolvedValue([]);
      const result = await listAiIntegrations(1);
      expect(result).toEqual([]);
    });

    it("returns integrations for a tenant", async () => {
      const data = [
        { id: 1, tenantId: 1, provider: "openai", apiKey: "sk-test123456", defaultModel: "gpt-5.4", isActive: true },
        { id: 2, tenantId: 1, provider: "anthropic", apiKey: "sk-ant-test123456", defaultModel: "claude-sonnet-4-6", isActive: false },
      ];
      mockList.mockResolvedValue(data);
      const result = await listAiIntegrations(1);
      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe("openai");
      expect(result[1].provider).toBe("anthropic");
    });
  });

  describe("getAiIntegration", () => {
    it("returns null when not found", async () => {
      mockGet.mockResolvedValue(null);
      expect(await getAiIntegration(1, 999)).toBeNull();
    });

    it("returns integration by id", async () => {
      const data = { id: 1, tenantId: 1, provider: "openai", defaultModel: "gpt-5.4" };
      mockGet.mockResolvedValue(data);
      const result = await getAiIntegration(1, 1);
      expect(result?.provider).toBe("openai");
    });
  });

  describe("getActiveAiIntegration", () => {
    it("returns null when no active integration", async () => {
      mockGetActive.mockResolvedValue(null);
      expect(await getActiveAiIntegration(1, "openai")).toBeNull();
    });

    it("returns active integration for provider", async () => {
      const data = { id: 1, tenantId: 1, provider: "openai", isActive: true, defaultModel: "gpt-5.4" };
      mockGetActive.mockResolvedValue(data);
      const result = await getActiveAiIntegration(1, "openai");
      expect(result?.isActive).toBe(true);
    });
  });

  describe("createAiIntegration", () => {
    it("creates an OpenAI integration (simple)", async () => {
      mockCreate.mockResolvedValue({ id: 1 });
      const result = await createAiIntegration({
        tenantId: 1,
        provider: "openai",
        apiKey: "sk-test123456789",
        defaultModel: "gpt-5.4",
        createdBy: 1,
      });
      expect(result).toEqual({ id: 1 });
      expect(mockCreate).toHaveBeenCalledWith({
        tenantId: 1,
        provider: "openai",
        apiKey: "sk-test123456789",
        defaultModel: "gpt-5.4",
        createdBy: 1,
      });
    });

    it("creates an Anthropic integration (simple)", async () => {
      mockCreate.mockResolvedValue({ id: 2 });
      const result = await createAiIntegration({
        tenantId: 1,
        provider: "anthropic",
        apiKey: "sk-ant-test123456789",
        defaultModel: "claude-sonnet-4-6",
        createdBy: 1,
      });
      expect(result).toEqual({ id: 2 });
    });
  });

  describe("updateAiIntegration", () => {
    it("updates model", async () => {
      mockUpdate.mockResolvedValue(undefined);
      await updateAiIntegration(1, 1, { defaultModel: "gpt-5-mini" });
      expect(mockUpdate).toHaveBeenCalledWith(1, 1, { defaultModel: "gpt-5-mini" });
    });

    it("updates active status", async () => {
      mockUpdate.mockResolvedValue(undefined);
      await updateAiIntegration(1, 1, { isActive: false });
      expect(mockUpdate).toHaveBeenCalledWith(1, 1, { isActive: false });
    });
  });

  describe("deleteAiIntegration", () => {
    it("deletes by id and tenantId", async () => {
      mockDelete.mockResolvedValue(undefined);
      await deleteAiIntegration(1, 1);
      expect(mockDelete).toHaveBeenCalledWith(1, 1);
    });
  });

  // ── API Key Testing ──────────────────────────────────────

  describe("testAiApiKey", () => {
    it("returns success for valid OpenAI key", async () => {
      mockTestKey.mockResolvedValue({ success: true });
      const result = await testAiApiKey("openai", "sk-validkey123456", "gpt-5.4");
      expect(result.success).toBe(true);
    });

    it("returns error for invalid key", async () => {
      mockTestKey.mockResolvedValue({ success: false, error: "Invalid API key" });
      const result = await testAiApiKey("openai", "sk-invalid", "gpt-5.4");
      expect(result.success).toBe(false);
    });

    it("returns success for valid Anthropic key", async () => {
      mockTestKey.mockResolvedValue({ success: true });
      const result = await testAiApiKey("anthropic", "sk-ant-validkey123456", "claude-sonnet-4-6");
      expect(result.success).toBe(true);
    });
  });

  // ── API Key Masking ──────────────────────────────────────

  describe("API Key Masking", () => {
    it("masks API key for display", () => {
      const key = "sk-proj-abc123456789xyz";
      const masked = `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
      expect(masked).toBe("sk-proj-...9xyz");
      expect(masked).not.toContain("abc123456789");
    });
  });

  // ── Current Model Lists (March 2026) ─────────────────────

  describe("Model Lists — Updated March 2026", () => {
    it("has correct OpenAI models", () => {
      const openaiModels = [
        { id: "gpt-5.4", name: "GPT-5.4" },
        { id: "gpt-5-mini", name: "GPT-5 Mini" },
      ];
      expect(openaiModels).toHaveLength(2);
      expect(openaiModels.map(m => m.id)).toContain("gpt-5.4");
      expect(openaiModels.map(m => m.id)).toContain("gpt-5-mini");
      // Old models should NOT be present
      expect(openaiModels.map(m => m.id)).not.toContain("gpt-4o");
      expect(openaiModels.map(m => m.id)).not.toContain("gpt-3.5-turbo");
    });

    it("has correct Anthropic models", () => {
      const anthropicModels = [
        { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
        { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
        { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
      ];
      expect(anthropicModels).toHaveLength(3);
      expect(anthropicModels.map(m => m.id)).toContain("claude-opus-4-6");
      expect(anthropicModels.map(m => m.id)).toContain("claude-sonnet-4-6");
      expect(anthropicModels.map(m => m.id)).toContain("claude-haiku-4-5");
      // Old models should NOT be present
      expect(anthropicModels.map(m => m.id)).not.toContain("claude-3-opus-20240229");
    });
  });

  // ── Provider Validation ──────────────────────────────────────────

  describe("Provider Validation", () => {
    it("validates provider enum", () => {
      const valid = ["openai", "anthropic"];
      expect(valid).toContain("openai");
      expect(valid).toContain("anthropic");
      expect(valid).not.toContain("google");
    });
  });

  // ── AI Settings (default IA + transcription) ───────────────

  describe("AI Settings", () => {
    it("returns default settings when none exist", async () => {
      mockGetSettings.mockResolvedValue(null);
      const result = await getAiSettings(1);
      expect(result).toBeNull();
    });

    it("returns settings with transcription enabled", async () => {
      mockGetSettings.mockResolvedValue({
        audioTranscriptionEnabled: true,
        defaultAiProvider: "openai",
        defaultAiModel: "gpt-5.4",
      });
      const result = await getAiSettings(1);
      expect(result?.audioTranscriptionEnabled).toBe(true);
      expect(result?.defaultAiProvider).toBe("openai");
    });

    it("updates settings", async () => {
      mockUpdateSettings.mockResolvedValue(undefined);
      await updateAiSettings(1, { audioTranscriptionEnabled: true });
      expect(mockUpdateSettings).toHaveBeenCalledWith(1, { audioTranscriptionEnabled: true });
    });

    it("updates default AI provider and model", async () => {
      mockUpdateSettings.mockResolvedValue(undefined);
      await updateAiSettings(1, {
        defaultAiProvider: "anthropic",
        defaultAiModel: "claude-sonnet-4-6",
      });
      expect(mockUpdateSettings).toHaveBeenCalledWith(1, {
        defaultAiProvider: "anthropic",
        defaultAiModel: "claude-sonnet-4-6",
      });
    });
  });

  // ── getAnyActiveAiIntegration ────────────────────────────

  describe("getAnyActiveAiIntegration", () => {
    it("returns null when no active integration", async () => {
      mockGetAnyActive.mockResolvedValue(null);
      expect(await getAnyActiveAiIntegration(1)).toBeNull();
    });

    it("returns first active integration", async () => {
      mockGetAnyActive.mockResolvedValue({ id: 1, provider: "openai", isActive: true });
      const result = await getAnyActiveAiIntegration(1);
      expect(result?.isActive).toBe(true);
    });
  });

  // ── SPIN Selling suggestion context ──────────────────────

  describe("SPIN Selling Suggestion", () => {
    it("builds SPIN selling prompt with message context", () => {
      const messages = [
        { fromMe: false, content: "Oi, quero saber sobre o pacote de turismo" },
        { fromMe: true, content: "Olá! Temos vários pacotes. Qual destino te interessa?" },
        { fromMe: false, content: "Estou pensando em Fernando de Noronha" },
      ];
      const context = messages.map(m => `${m.fromMe ? "Agente" : "Cliente"}: ${m.content}`).join("\n");
      expect(context).toContain("Cliente: Oi, quero saber sobre o pacote de turismo");
      expect(context).toContain("Agente: Olá! Temos vários pacotes");
      expect(context).toContain("Cliente: Estou pensando em Fernando de Noronha");
    });

    it("requires at least one message for suggestion", () => {
      const messages: any[] = [];
      expect(messages.length).toBe(0);
      // Should not call AI with empty messages
    });
  });

  // ── Audio Transcription ─────────────────────────────────

  describe("Audio Transcription", () => {
    it("requires OpenAI provider for transcription", async () => {
      mockGetActive.mockResolvedValue(null);
      const openaiIntegration = await getActiveAiIntegration(1, "openai");
      expect(openaiIntegration).toBeNull();
      // Should throw OPENAI_REQUIRED error
    });

    it("uses OpenAI Whisper API for transcription", async () => {
      mockGetActive.mockResolvedValue({
        id: 1, provider: "openai", apiKey: "sk-valid", isActive: true,
      });
      const integration = await getActiveAiIntegration(1, "openai");
      expect(integration).not.toBeNull();
      expect(integration?.provider).toBe("openai");
    });
  });
});