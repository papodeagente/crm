/**
 * Generic AI Service — Unified interface for OpenAI and Anthropic Claude
 * 
 * This service provides a common interface for invoking AI completions
 * from both providers, handling the API differences transparently.
 */

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompletionRequest {
  provider: "openai" | "anthropic";
  apiKey: string;
  model: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AiCompletionResponse {
  content: string;
  model: string;
  provider: "openai" | "anthropic";
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

// ── OpenAI Models ──────────────────────────────────────────
export const OPENAI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o", description: "Modelo mais capaz e rápido da OpenAI", contextWindow: "128K", recommended: true },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Versão compacta e econômica do GPT-4o", contextWindow: "128K", recommended: false },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "GPT-4 otimizado para velocidade", contextWindow: "128K", recommended: false },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Modelo rápido e econômico", contextWindow: "16K", recommended: false },
] as const;

// ── Anthropic Models ───────────────────────────────────────
export const ANTHROPIC_MODELS = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "Equilíbrio ideal entre inteligência e velocidade", contextWindow: "200K", recommended: true },
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Modelo rápido e inteligente", contextWindow: "200K", recommended: false },
  { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", description: "Modelo mais rápido e econômico", contextWindow: "200K", recommended: false },
  { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Modelo mais poderoso para tarefas complexas", contextWindow: "200K", recommended: false },
] as const;

/**
 * Invoke an AI completion from either OpenAI or Anthropic
 */
export async function invokeAiCompletion(req: AiCompletionRequest): Promise<AiCompletionResponse> {
  if (req.provider === "openai") {
    return invokeOpenAI(req);
  } else {
    return invokeAnthropic(req);
  }
}

async function invokeOpenAI(req: AiCompletionRequest): Promise<AiCompletionResponse> {
  const messages = req.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `OpenAI API error: HTTP ${res.status}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content || "",
    model: data.model,
    provider: "openai",
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    finishReason: choice?.finish_reason || "unknown",
  };
}

async function invokeAnthropic(req: AiCompletionRequest): Promise<AiCompletionResponse> {
  // Anthropic uses a separate system parameter instead of system role messages
  const systemMsg = req.messages.find(m => m.role === "system");
  const nonSystemMsgs = req.messages.filter(m => m.role !== "system");

  const body: Record<string, unknown> = {
    model: req.model,
    messages: nonSystemMsgs.map(m => ({ role: m.role, content: m.content })),
    max_tokens: req.maxTokens ?? 1024,
    temperature: req.temperature ?? 0.7,
  };

  if (systemMsg) {
    body.system = systemMsg.content;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": req.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Anthropic API error: HTTP ${res.status}`);
  }

  const data = await res.json();

  return {
    content: data.content?.[0]?.text || "",
    model: data.model,
    provider: "anthropic",
    usage: {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
    finishReason: data.stop_reason || "unknown",
  };
}

/**
 * Validate an API key by making a minimal request
 */
export async function validateApiKey(
  provider: "openai" | "anthropic",
  apiKey: string,
  model?: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const testModel = model || (provider === "openai" ? "gpt-3.5-turbo" : "claude-3-5-haiku-20241022");
    await invokeAiCompletion({
      provider,
      apiKey,
      model: testModel,
      messages: [{ role: "user", content: "Hi" }],
      maxTokens: 5,
    });
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}
