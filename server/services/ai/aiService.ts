/**
 * Generic AI Service — Unified interface for OpenAI and Anthropic Claude
 * 
 * Simple wrapper to invoke AI completions from both providers.
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

// ── OpenAI Models (Março 2026) ────────────────────────────────
export const OPENAI_MODELS = [
  { id: "gpt-5.4", name: "GPT-5.4", description: "Modelo mais inteligente da OpenAI para raciocínio e código", contextWindow: "1M" },
  { id: "gpt-5-mini", name: "GPT-5 Mini", description: "Rápido e econômico, ideal para alto volume", contextWindow: "400K" },
] as const;

// ── Anthropic Models (Março 2026) ─────────────────────────────
export const ANTHROPIC_MODELS = [
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", description: "Mais inteligente para agentes e código", contextWindow: "1M" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "Melhor equilíbrio entre velocidade e inteligência", contextWindow: "1M" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", description: "Mais rápido e econômico", contextWindow: "200K" },
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
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages: req.messages.map(m => ({ role: m.role, content: m.content })),
      max_completion_tokens: req.maxTokens ?? 1024,
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
  const systemMsg = req.messages.find(m => m.role === "system");
  const nonSystemMsgs = req.messages.filter(m => m.role !== "system");

  const body: Record<string, unknown> = {
    model: req.model,
    messages: nonSystemMsgs.map(m => ({ role: m.role, content: m.content })),
    max_tokens: req.maxTokens ?? 1024,
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
    const testModel = model || (provider === "openai" ? "gpt-5-mini" : "claude-haiku-4-5");
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
