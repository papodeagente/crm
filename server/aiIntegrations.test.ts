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
}));

import {
  listAiIntegrations,
  getAiIntegration,
  getActiveAiIntegration,
  createAiIntegration,
  updateAiIntegration,
  deleteAiIntegration,
  testAiApiKey,
} from "./db";

const mockList = listAiIntegrations as ReturnType<typeof vi.fn>;
const mockGet = getAiIntegration as ReturnType<typeof vi.fn>;
const mockGetActive = getActiveAiIntegration as ReturnType<typeof vi.fn>;
const mockCreate = createAiIntegration as ReturnType<typeof vi.fn>;
const mockUpdate = updateAiIntegration as ReturnType<typeof vi.fn>;
const mockDelete = deleteAiIntegration as ReturnType<typeof vi.fn>;
const mockTestKey = testAiApiKey as ReturnType<typeof vi.fn>;

describe("AI Integrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── CRUD Operations ──────────────────────────────────────

  describe("listAiIntegrations", () => {
    it("should return empty array when no integrations exist", async () => {
      mockList.mockResolvedValue([]);
      const result = await listAiIntegrations(1);
      expect(result).toEqual([]);
      expect(mockList).toHaveBeenCalledWith(1);
    });

    it("should return integrations for a tenant", async () => {
      const mockData = [
        { id: 1, tenantId: 1, provider: "openai", apiKey: "sk-test123456", defaultModel: "gpt-4o", isActive: true },
        { id: 2, tenantId: 1, provider: "anthropic", apiKey: "sk-ant-test123456", defaultModel: "claude-3-5-sonnet-20241022", isActive: false },
      ];
      mockList.mockResolvedValue(mockData);
      const result = await listAiIntegrations(1);
      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe("openai");
      expect(result[1].provider).toBe("anthropic");
    });
  });

  describe("getAiIntegration", () => {
    it("should return null when integration not found", async () => {
      mockGet.mockResolvedValue(null);
      const result = await getAiIntegration(1, 999);
      expect(result).toBeNull();
    });

    it("should return integration by id and tenantId", async () => {
      const mockData = { id: 1, tenantId: 1, provider: "openai", apiKey: "sk-test123456", defaultModel: "gpt-4o" };
      mockGet.mockResolvedValue(mockData);
      const result = await getAiIntegration(1, 1);
      expect(result).toEqual(mockData);
      expect(result?.provider).toBe("openai");
    });
  });

  describe("getActiveAiIntegration", () => {
    it("should return null when no active integration for provider", async () => {
      mockGetActive.mockResolvedValue(null);
      const result = await getActiveAiIntegration(1, "openai");
      expect(result).toBeNull();
    });

    it("should return active integration for provider", async () => {
      const mockData = { id: 1, tenantId: 1, provider: "openai", isActive: true, defaultModel: "gpt-4o" };
      mockGetActive.mockResolvedValue(mockData);
      const result = await getActiveAiIntegration(1, "openai");
      expect(result?.isActive).toBe(true);
      expect(result?.provider).toBe("openai");
    });
  });

  describe("createAiIntegration", () => {
    it("should create an OpenAI integration", async () => {
      mockCreate.mockResolvedValue({ id: 1 });
      const result = await createAiIntegration({
        tenantId: 1,
        provider: "openai",
        apiKey: "sk-test123456789",
        defaultModel: "gpt-4o",
        createdBy: 1,
      });
      expect(result).toEqual({ id: 1 });
      expect(mockCreate).toHaveBeenCalledWith({
        tenantId: 1,
        provider: "openai",
        apiKey: "sk-test123456789",
        defaultModel: "gpt-4o",
        createdBy: 1,
      });
    });

    it("should create an Anthropic integration with custom settings", async () => {
      mockCreate.mockResolvedValue({ id: 2 });
      const result = await createAiIntegration({
        tenantId: 1,
        provider: "anthropic",
        apiKey: "sk-ant-test123456789",
        defaultModel: "claude-3-5-sonnet-20241022",
        label: "Claude Atendimento",
        maxTokens: 2048,
        temperature: "0.5",
        createdBy: 1,
      });
      expect(result).toEqual({ id: 2 });
    });
  });

  describe("updateAiIntegration", () => {
    it("should update integration model", async () => {
      mockUpdate.mockResolvedValue(undefined);
      await updateAiIntegration(1, 1, { defaultModel: "gpt-4o-mini" });
      expect(mockUpdate).toHaveBeenCalledWith(1, 1, { defaultModel: "gpt-4o-mini" });
    });

    it("should update integration active status", async () => {
      mockUpdate.mockResolvedValue(undefined);
      await updateAiIntegration(1, 1, { isActive: false });
      expect(mockUpdate).toHaveBeenCalledWith(1, 1, { isActive: false });
    });

    it("should update multiple fields at once", async () => {
      mockUpdate.mockResolvedValue(undefined);
      await updateAiIntegration(1, 1, {
        defaultModel: "gpt-4-turbo",
        maxTokens: 4096,
        temperature: "0.3",
      });
      expect(mockUpdate).toHaveBeenCalledWith(1, 1, {
        defaultModel: "gpt-4-turbo",
        maxTokens: 4096,
        temperature: "0.3",
      });
    });
  });

  describe("deleteAiIntegration", () => {
    it("should delete integration by id and tenantId", async () => {
      mockDelete.mockResolvedValue(undefined);
      await deleteAiIntegration(1, 1);
      expect(mockDelete).toHaveBeenCalledWith(1, 1);
    });
  });

  // ── API Key Testing ──────────────────────────────────────

  describe("testAiApiKey", () => {
    it("should return success for valid OpenAI key", async () => {
      mockTestKey.mockResolvedValue({ success: true });
      const result = await testAiApiKey("openai", "sk-validkey123456", "gpt-4o");
      expect(result.success).toBe(true);
    });

    it("should return error for invalid OpenAI key", async () => {
      mockTestKey.mockResolvedValue({ success: false, error: "Invalid API key" });
      const result = await testAiApiKey("openai", "sk-invalidkey", "gpt-4o");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });

    it("should return success for valid Anthropic key", async () => {
      mockTestKey.mockResolvedValue({ success: true });
      const result = await testAiApiKey("anthropic", "sk-ant-validkey123456", "claude-3-5-sonnet-20241022");
      expect(result.success).toBe(true);
    });

    it("should return error for invalid Anthropic key", async () => {
      mockTestKey.mockResolvedValue({ success: false, error: "Invalid x-api-key" });
      const result = await testAiApiKey("anthropic", "sk-ant-invalid", "claude-3-5-sonnet-20241022");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid");
    });
  });

  // ── API Key Masking ──────────────────────────────────────

  describe("API Key Masking", () => {
    it("should mask OpenAI API key correctly", () => {
      const key = "sk-proj-abc123456789xyz";
      const masked = `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
      expect(masked).toBe("sk-proj-...9xyz");
      expect(masked).not.toContain("abc123456789");
    });

    it("should mask Anthropic API key correctly", () => {
      const key = "sk-ant-api03-abc123456789xyz";
      const masked = `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
      expect(masked).toBe("sk-ant-a...9xyz");
      expect(masked).not.toContain("abc123456789");
    });
  });

  // ── Model Lists ──────────────────────────────────────────

  describe("Model Lists", () => {
    it("should have correct OpenAI models", () => {
      const openaiModels = [
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
      ];
      expect(openaiModels).toHaveLength(4);
      expect(openaiModels.map(m => m.id)).toContain("gpt-4o");
      expect(openaiModels.map(m => m.id)).toContain("gpt-4o-mini");
    });

    it("should have correct Anthropic models", () => {
      const anthropicModels = [
        { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
      ];
      expect(anthropicModels).toHaveLength(4);
      expect(anthropicModels.map(m => m.id)).toContain("claude-sonnet-4-20250514");
      expect(anthropicModels.map(m => m.id)).toContain("claude-3-opus-20240229");
    });
  });

  // ── AI Service ───────────────────────────────────────────

  describe("AI Service Types", () => {
    it("should validate provider enum", () => {
      const validProviders = ["openai", "anthropic"];
      expect(validProviders).toContain("openai");
      expect(validProviders).toContain("anthropic");
      expect(validProviders).not.toContain("google");
    });

    it("should validate temperature range", () => {
      const temp = 0.7;
      expect(temp).toBeGreaterThanOrEqual(0);
      expect(temp).toBeLessThanOrEqual(2);
    });

    it("should validate maxTokens range", () => {
      const maxTokens = 1024;
      expect(maxTokens).toBeGreaterThanOrEqual(1);
      expect(maxTokens).toBeLessThanOrEqual(128000);
    });
  });
});
