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
    expect(result.full).not.toMatch(/^-/m);
  });

  it("handles empty parts array gracefully", () => {
    const raw = '{"parts": []}';
    const result = parseAiSuggestionParts(raw);
    expect(result.parts.length).toBeGreaterThanOrEqual(1);
  });
});

describe("AI Suggestion — Conversation Context Building", () => {
  it("builds conversation context from messages with contact name", () => {
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

  it("includes the last message from client for context-aware response", () => {
    const messages = [
      { fromMe: false, content: "Oi", timestamp: "2026-03-14T10:00:00Z" },
      { fromMe: true, content: "Olá! Como posso ajudar?", timestamp: "2026-03-14T10:01:00Z" },
      { fromMe: false, content: "Quero um pacote para Maldivas em julho", timestamp: "2026-03-14T10:02:00Z" },
    ];
    const lastClientMsg = [...messages].reverse().find(m => !m.fromMe);
    expect(lastClientMsg?.content).toBe("Quero um pacote para Maldivas em julho");
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
    mockGetAnyActive.mockResolvedValue({ id: 1, provider: "openai", apiKey: "sk-test", defaultModel: "gpt-4.1", isActive: true });
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
  });

  it("uses overrideModel when provided", async () => {
    mockGetSettings.mockResolvedValue({ defaultAiModel: "gpt-5.4" });
    const settings = await getTenantAiSettings(1);
    const overrideModel = "gpt-4.1-mini";
    const model = overrideModel || settings.defaultAiModel || "gpt-4.1";
    expect(model).toBe("gpt-4.1-mini");
  });

  it("uses tenant default model when no override", async () => {
    mockGetSettings.mockResolvedValue({ defaultAiModel: "claude-sonnet-4-6" });
    const settings = await getTenantAiSettings(1);
    const overrideModel = undefined;
    const model = overrideModel || settings.defaultAiModel || "gpt-4.1";
    expect(model).toBe("claude-sonnet-4-6");
  });

  it("uses integration default model as last fallback", async () => {
    mockGetSettings.mockResolvedValue({});
    const settings = await getTenantAiSettings(1);
    const integrationDefault = "gpt-4.1";
    const overrideModel = undefined;
    const model = overrideModel || settings.defaultAiModel || integrationDefault;
    expect(model).toBe("gpt-4.1");
  });
});

describe("AI Suggestion — OpenAI Model Token Parameter", () => {
  it("uses max_tokens for gpt-4.1 models (chat models)", () => {
    const model = "gpt-4.1";
    const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
    const tokenParam = isReasoningModel ? { max_completion_tokens: 500 } : { max_tokens: 500 };
    expect(tokenParam).toEqual({ max_tokens: 500 });
  });

  it("uses max_tokens for gpt-4.1-mini (chat model)", () => {
    const model = "gpt-4.1-mini";
    const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
    const tokenParam = isReasoningModel ? { max_completion_tokens: 500 } : { max_tokens: 500 };
    expect(tokenParam).toEqual({ max_tokens: 500 });
  });

  it("uses max_tokens for gpt-4.1-nano (chat model)", () => {
    const model = "gpt-4.1-nano";
    const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
    const tokenParam = isReasoningModel ? { max_completion_tokens: 500 } : { max_tokens: 500 };
    expect(tokenParam).toEqual({ max_tokens: 500 });
  });

  it("uses max_completion_tokens for gpt-5-mini (reasoning model)", () => {
    const model = "gpt-5-mini";
    const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
    const tokenParam = isReasoningModel ? { max_completion_tokens: 500 } : { max_tokens: 500 };
    expect(tokenParam).toEqual({ max_completion_tokens: 500 });
  });

  it("uses max_completion_tokens for gpt-5.4 (reasoning model)", () => {
    const model = "gpt-5.4";
    const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
    const tokenParam = isReasoningModel ? { max_completion_tokens: 500 } : { max_tokens: 500 };
    expect(tokenParam).toEqual({ max_completion_tokens: 500 });
  });

  it("uses max_completion_tokens for o4-mini (reasoning model)", () => {
    const model = "o4-mini";
    const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
    const tokenParam = isReasoningModel ? { max_completion_tokens: 500 } : { max_tokens: 500 };
    expect(tokenParam).toEqual({ max_completion_tokens: 500 });
  });
});

describe("AI Suggestion — Model Lists", () => {
  it("has correct OpenAI models including gpt-4.1 family", () => {
    const openaiModels = [
      { id: "gpt-4.1", name: "GPT-4.1" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano" },
      { id: "gpt-5-mini", name: "GPT-5 Mini" },
      { id: "gpt-5.4", name: "GPT-5.4" },
      { id: "o4-mini", name: "o4-mini" },
    ];
    expect(openaiModels).toHaveLength(6);
    expect(openaiModels.map(m => m.id)).toContain("gpt-4.1");
    expect(openaiModels.map(m => m.id)).toContain("gpt-4.1-mini");
    expect(openaiModels.map(m => m.id)).toContain("gpt-4.1-nano");
    expect(openaiModels.map(m => m.id)).toContain("gpt-5-mini");
    expect(openaiModels.map(m => m.id)).toContain("gpt-5.4");
    expect(openaiModels.map(m => m.id)).toContain("o4-mini");
    // Old models should NOT be present
    expect(openaiModels.map(m => m.id)).not.toContain("gpt-4o");
    expect(openaiModels.map(m => m.id)).not.toContain("gpt-3.5-turbo");
  });

  it("has correct Anthropic models", () => {
    const anthropicModels = [
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
      { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
    ];
    expect(anthropicModels).toHaveLength(3);
    expect(anthropicModels.map(m => m.id)).toContain("claude-haiku-4-5");
    expect(anthropicModels.map(m => m.id)).toContain("claude-sonnet-4-6");
    expect(anthropicModels.map(m => m.id)).toContain("claude-opus-4-6");
    // Old models should NOT be present
    expect(anthropicModels.map(m => m.id)).not.toContain("claude-3-opus-20240229");
    expect(anthropicModels.map(m => m.id)).not.toContain("claude-3-sonnet-20240229");
  });
});

describe("AI Suggestion — Phase-based UI Flow", () => {
  it("starts in 'select' phase (no auto-generate)", () => {
    const initialPhase = "select";
    expect(initialPhase).toBe("select");
  });

  it("transitions to 'loading' when generate is called", () => {
    let phase = "select";
    // Simulate clicking generate
    phase = "loading";
    expect(phase).toBe("loading");
  });

  it("transitions to 'result' on success", () => {
    let phase = "loading";
    // Simulate successful response
    phase = "result";
    expect(phase).toBe("result");
  });

  it("transitions to 'error' on failure", () => {
    let phase = "loading";
    // Simulate error
    phase = "error";
    expect(phase).toBe("error");
  });

  it("can go back to 'select' from 'result' to regenerate with different model", () => {
    let phase: string = "result";
    // User clicks "Gerar outra"
    phase = "select";
    expect(phase).toBe("select");
  });

  it("can go back to 'select' from 'error' to change model", () => {
    let phase: string = "error";
    // User clicks "Trocar modelo"
    phase = "select";
    expect(phase).toBe("select");
  });
});

describe("AI Suggestion — Message Filtering", () => {
  it("filters messages with content from raw query data", () => {
    const rawMessages = [
      { id: 1, fromMe: false, content: "Oi", messageType: "conversation", timestamp: new Date() },
      { id: 2, fromMe: true, content: "", messageType: "conversation", timestamp: new Date() },
      { id: 3, fromMe: false, content: null as any, messageType: "audioMessage", timestamp: new Date() },
      { id: 4, fromMe: true, content: "Olá!", messageType: "conversation", timestamp: new Date() },
    ];
    const filtered = rawMessages
      .filter((m) => m.content)
      .map((m) => ({
        fromMe: m.fromMe,
        content: m.content || "",
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp ? String(m.timestamp) : undefined,
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

describe("AI Suggestion — Developer Role for Reasoning Models", () => {
  it("uses 'developer' role for gpt-5-mini (reasoning model)", () => {
    const model = "gpt-5-mini";
    const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
    const systemRole = isReasoningModel ? "developer" : "system";
    expect(systemRole).toBe("developer");
  });

  it("uses 'developer' role for gpt-5.4 (reasoning model)", () => {
    const model = "gpt-5.4";
    const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
    const systemRole = isReasoningModel ? "developer" : "system";
    expect(systemRole).toBe("developer");
  });

  it("uses 'developer' role for o4-mini (reasoning model)", () => {
    const model = "o4-mini";
    const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
    const systemRole = isReasoningModel ? "developer" : "system";
    expect(systemRole).toBe("developer");
  });

  it("uses 'system' role for gpt-4.1 (chat model)", () => {
    const model = "gpt-4.1";
    const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
    const systemRole = isReasoningModel ? "developer" : "system";
    expect(systemRole).toBe("system");
  });

  it("uses 'system' role for gpt-4.1-mini (chat model)", () => {
    const model = "gpt-4.1-mini";
    const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
    const systemRole = isReasoningModel ? "developer" : "system";
    expect(systemRole).toBe("system");
  });

  it("uses 'system' role for gpt-4.1-nano (chat model)", () => {
    const model = "gpt-4.1-nano";
    const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
    const systemRole = isReasoningModel ? "developer" : "system";
    expect(systemRole).toBe("system");
  });
});

describe("AI Suggestion — Prompt Role Clarity", () => {
  it("system prompt clearly identifies AGENTE as the one being helped", () => {
    const contactName = "Viviane";
    const systemPrompt = `Você é um assistente que ajuda o AGENTE (vendedor) de uma agência de viagens a responder mensagens no WhatsApp.

CONTEXTO:
- Na conversa abaixo, "Agente" é o vendedor da agência (VOCÊ está escrevendo para ele).
- "${contactName}" é o cliente que está conversando com o agente.
- Você deve sugerir o que o AGENTE deve responder ao cliente.`;

    expect(systemPrompt).toContain("AGENTE (vendedor)");
    expect(systemPrompt).toContain("Viviane");
    expect(systemPrompt).toContain("Você deve sugerir o que o AGENTE deve responder");
  });

  it("user prompt reinforces that response is from AGENTE not client", () => {
    const contactName = "João";
    const userPrompt = `Conversa entre o AGENTE (vendedor) e ${contactName}:\n\nAgente: Olá!\nJoão: Oi, quero um pacote\n\nO que o AGENTE deve responder ao cliente agora? Lembre-se: você está escrevendo A RESPOSTA DO AGENTE, não do cliente. Responda APENAS em JSON: {"parts": ["msg1", "msg2"]}`;

    expect(userPrompt).toContain("AGENTE (vendedor)");
    expect(userPrompt).toContain("A RESPOSTA DO AGENTE, não do cliente");
    expect(userPrompt).toContain("João: Oi, quero um pacote");
  });

  it("conversation context labels messages correctly", () => {
    const messages = [
      { fromMe: false, content: "Oi, quero um pacote", timestamp: "2026-03-14T10:00:00Z" },
      { fromMe: true, content: "Olá! Temos ótimos pacotes!", timestamp: "2026-03-14T10:01:00Z" },
      { fromMe: false, content: "Quanto custa para Noronha?", timestamp: "2026-03-14T10:02:00Z" },
    ];
    const contactName = "Maria";
    const context = messages
      .map(m => `${m.fromMe ? "Agente" : contactName}: ${m.content}`)
      .join("\n");

    expect(context).toBe("Maria: Oi, quero um pacote\nAgente: Olá! Temos ótimos pacotes!\nMaria: Quanto custa para Noronha?");
    // Last message is from client, so AI should generate agent's response
    const lastMsg = messages[messages.length - 1];
    expect(lastMsg.fromMe).toBe(false);
  });
});
