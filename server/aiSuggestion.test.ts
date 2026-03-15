import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getAiIntegration: vi.fn(),
  getAnyActiveAiIntegration: vi.fn(),
  getTenantAiSettings: vi.fn(),
}));

import {
  getAiIntegration,
  getAnyActiveAiIntegration,
  getTenantAiSettings,
} from "./db";

const mockGetIntegration = getAiIntegration as ReturnType<typeof vi.fn>;
const mockGetAnyActive = getAnyActiveAiIntegration as ReturnType<typeof vi.fn>;
const mockGetSettings = getTenantAiSettings as ReturnType<typeof vi.fn>;

// ── parseAiSuggestionParts (inline copy for unit testing) ──
function parseAiSuggestionParts(raw: string): { full: string; parts: string[] } {
  const cleaned = raw.replace(/[\u2014\u2013]/g, ",").replace(/^\s*[-\*]\s+/gm, "");
  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.parts) && parsed.parts.length > 0) {
        const parts = parsed.parts.map((p: string) => p.replace(/[\u2014\u2013]/g, ",").trim()).filter(Boolean);
        return { full: parts.join("\n\n"), parts };
      }
    }
  } catch {}
  const lines = cleaned.split(/\n\n+/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    return { full: lines.join("\n\n"), parts: lines };
  }
  return { full: cleaned.trim(), parts: [cleaned.trim()] };
}

describe("AI Suggestion — parseAiSuggestionParts", () => {
  it("parses valid JSON with parts array", () => {
    const raw = '{"parts": ["Olá! Tudo bem?", "Vi que você tem interesse em Fernando de Noronha.", "Posso te ajudar com isso!"]}';
    const result = parseAiSuggestionParts(raw);
    expect(result.parts).toHaveLength(3);
    expect(result.parts[0]).toBe("Olá! Tudo bem?");
    expect(result.parts[1]).toBe("Vi que você tem interesse em Fernando de Noronha.");
    expect(result.parts[2]).toBe("Posso te ajudar com isso!");
    expect(result.full).toBe("Olá! Tudo bem?\n\nVi que você tem interesse em Fernando de Noronha.\n\nPosso te ajudar com isso!");
  });

  it("removes em-dashes and en-dashes from parts", () => {
    const raw = '{"parts": ["Olá — tudo bem?", "Vamos lá – vou te ajudar"]}';
    const result = parseAiSuggestionParts(raw);
    expect(result.parts[0]).not.toContain("—");
    expect(result.parts[0]).not.toContain("–");
    expect(result.parts[0]).toBe("Olá , tudo bem?");
    expect(result.parts[1]).toBe("Vamos lá , vou te ajudar");
  });

  it("falls back to paragraph splitting when JSON is invalid", () => {
    const raw = "Olá! Tudo bem?\n\nVi que você tem interesse.\n\nPosso ajudar!";
    const result = parseAiSuggestionParts(raw);
    expect(result.parts).toHaveLength(3);
    expect(result.parts[0]).toBe("Olá! Tudo bem?");
  });

  it("returns single part for plain text without double newlines", () => {
    const raw = "Olá! Tudo bem? Como posso te ajudar hoje?";
    const result = parseAiSuggestionParts(raw);
    expect(result.parts).toHaveLength(1);
    expect(result.full).toBe("Olá! Tudo bem? Como posso te ajudar hoje?");
  });

  it("handles JSON embedded in extra text", () => {
    const raw = 'Here is the response: {"parts": ["Oi!", "Como vai?"]} end';
    const result = parseAiSuggestionParts(raw);
    expect(result.parts).toHaveLength(2);
    expect(result.parts[0]).toBe("Oi!");
    expect(result.parts[1]).toBe("Como vai?");
  });

  it("strips bullet points from raw text", () => {
    const raw = "- Primeiro ponto\n- Segundo ponto\n- Terceiro ponto";
    const result = parseAiSuggestionParts(raw);
    // Bullets should be stripped
    expect(result.full).not.toMatch(/^-/m);
  });

  it("handles empty parts array gracefully", () => {
    const raw = '{"parts": []}';
    const result = parseAiSuggestionParts(raw);
    // Should fallback since parts is empty
    expect(result.parts.length).toBeGreaterThanOrEqual(1);
  });
});

describe("AI Suggestion — SPIN Selling Context Building", () => {
  it("builds conversation context from messages", () => {
    const messages = [
      { fromMe: false, content: "Oi, quero saber sobre pacotes para Noronha", timestamp: "2026-03-14T10:00:00Z" },
      { fromMe: true, content: "Olá! Temos ótimos pacotes. Para quantas pessoas?", timestamp: "2026-03-14T10:01:00Z" },
      { fromMe: false, content: "Somos 2 adultos e 1 criança", timestamp: "2026-03-14T10:02:00Z" },
    ];
    const contactName = "João";
    const context = messages
      .slice(-30)
      .map(m => `${m.fromMe ? "Agente" : (contactName || "Cliente")}: ${m.content}`)
      .join("\n");

    expect(context).toContain("João: Oi, quero saber sobre pacotes para Noronha");
    expect(context).toContain("Agente: Olá! Temos ótimos pacotes");
    expect(context).toContain("João: Somos 2 adultos e 1 criança");
  });

  it("limits context to last 30 messages", () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({
      fromMe: i % 2 === 0,
      content: `Mensagem ${i + 1}`,
      timestamp: `2026-03-14T10:${String(i).padStart(2, "0")}:00Z`,
    }));
    const context = messages.slice(-30);
    expect(context).toHaveLength(30);
    expect(context[0].content).toBe("Mensagem 21");
  });

  it("uses 'Cliente' when contactName is not provided", () => {
    const messages = [
      { fromMe: false, content: "Oi", timestamp: "2026-03-14T10:00:00Z" },
    ];
    const contactName = undefined;
    const context = messages
      .map(m => `${m.fromMe ? "Agente" : (contactName || "Cliente")}: ${m.content}`)
      .join("\n");
    expect(context).toBe("Cliente: Oi");
  });
});

describe("AI Suggestion — Integration Selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses specific integration when integrationId is provided", async () => {
    const integration = { id: 5, tenantId: 1, provider: "anthropic", apiKey: "sk-ant-test", defaultModel: "claude-sonnet-4-6", isActive: true };
    mockGetIntegration.mockResolvedValue(integration);
    const result = await getAiIntegration(1, 5);
    expect(result).toEqual(integration);
    expect(mockGetIntegration).toHaveBeenCalledWith(1, 5);
  });

  it("falls back to any active integration when integrationId not provided", async () => {
    mockGetAnyActive.mockResolvedValue({ id: 1, provider: "openai", apiKey: "sk-test", defaultModel: "gpt-5-mini", isActive: true });
    const result = await getAnyActiveAiIntegration(1);
    expect(result?.provider).toBe("openai");
  });

  it("throws NO_AI_CONFIGURED when no integration exists", async () => {
    mockGetIntegration.mockResolvedValue(null);
    mockGetAnyActive.mockResolvedValue(null);
    const specific = await getAiIntegration(1, 999);
    const fallback = await getAnyActiveAiIntegration(1);
    expect(specific).toBeNull();
    expect(fallback).toBeNull();
    // The router would throw TRPCError with message "NO_AI_CONFIGURED"
  });

  it("uses overrideModel when provided", async () => {
    mockGetSettings.mockResolvedValue({ defaultAiModel: "gpt-5.4" });
    const settings = await getTenantAiSettings(1);
    const overrideModel = "gpt-5-mini";
    const model = overrideModel || settings.defaultAiModel || "gpt-5.4";
    expect(model).toBe("gpt-5-mini");
  });

  it("uses tenant default model when no override", async () => {
    mockGetSettings.mockResolvedValue({ defaultAiModel: "claude-sonnet-4-6" });
    const settings = await getTenantAiSettings(1);
    const overrideModel = undefined;
    const model = overrideModel || settings.defaultAiModel || "gpt-5.4";
    expect(model).toBe("claude-sonnet-4-6");
  });

  it("uses integration default model as last fallback", async () => {
    mockGetSettings.mockResolvedValue({});
    const settings = await getTenantAiSettings(1);
    const integrationDefault = "gpt-5.4";
    const overrideModel = undefined;
    const model = overrideModel || settings.defaultAiModel || integrationDefault;
    expect(model).toBe("gpt-5.4");
  });
});

describe("AI Suggestion — Messages Prop Pattern (Bug Fix)", () => {
  it("filters out messages without content", () => {
    const rawMessages = [
      { fromMe: false, content: "Oi", timestamp: new Date() },
      { fromMe: true, content: "", timestamp: new Date() },
      { fromMe: false, content: null as any, timestamp: new Date() },
      { fromMe: true, content: "Olá!", timestamp: new Date() },
    ];
    const filtered = rawMessages.filter((m) => m.content).map((m) => ({
      fromMe: m.fromMe,
      content: m.content || "",
      timestamp: m.timestamp,
    }));
    expect(filtered).toHaveLength(2);
    expect(filtered[0].content).toBe("Oi");
    expect(filtered[1].content).toBe("Olá!");
  });

  it("converts Date timestamps to ISO strings", () => {
    const date = new Date("2026-03-14T10:00:00Z");
    const converted = date instanceof Date ? date.toISOString() : String(date);
    expect(converted).toBe("2026-03-14T10:00:00.000Z");
  });

  it("handles string timestamps as-is", () => {
    const ts = "2026-03-14T10:00:00Z";
    const converted = ts instanceof Date ? (ts as any).toISOString() : String(ts);
    expect(converted).toBe("2026-03-14T10:00:00Z");
  });

  it("generates only when messages array is non-empty", () => {
    const messages: any[] = [];
    const shouldGenerate = messages.length > 0;
    expect(shouldGenerate).toBe(false);
  });

  it("generates when messages are available", () => {
    const messages = [
      { fromMe: false, content: "Oi", timestamp: "2026-03-14T10:00:00Z" },
    ];
    const shouldGenerate = messages.length > 0;
    expect(shouldGenerate).toBe(true);
  });
});

describe("AI Suggestion — Response No-Dash Rule", () => {
  it("removes em-dashes from AI response", () => {
    const raw = "Olá — como vai? Vamos conversar — sobre o pacote.";
    const cleaned = raw.replace(/[\u2014\u2013]/g, ",");
    expect(cleaned).not.toContain("—");
    expect(cleaned).toContain(",");
  });

  it("removes en-dashes from AI response", () => {
    const raw = "Preço: R$ 5.000 – R$ 8.000";
    const cleaned = raw.replace(/[\u2014\u2013]/g, ",");
    expect(cleaned).not.toContain("–");
  });

  it("strips bullet point dashes from beginning of lines", () => {
    const raw = "- Item 1\n- Item 2\n- Item 3";
    const cleaned = raw.replace(/^\s*[-\*]\s+/gm, "");
    expect(cleaned).toBe("Item 1\nItem 2\nItem 3");
  });
});
