/**
 * aiSuggestionWorker.ts
 *
 * Async AI suggestion generation with:
 * - Socket.IO streaming (chunks emitted as they arrive)
 * - 8-second timeout with fallback message
 * - Cancellation via requestId
 * - Rate limit: 1 suggestion per conversation per 10s
 * - In-memory cache (30s TTL) with Redis upgrade path
 * - BullMQ integration when Redis is available, sync fallback otherwise
 */

import { getIo } from "./socketSingleton";
import {
  type SuggestionResult,
  fetchConversationMessages,
  fetchCrmContext,
  classifyIntent,
  buildStructuredContext,
  buildSystemPrompt,
  buildUserPrompt,
  parseAiResponse,
  logSuggestionTelemetry,
} from "./aiSuggestionService";
import { getAiIntegration, getAnyActiveAiIntegration, getTenantAiSettings } from "./db";

// ════════════════════════════════════════════════════════════
// IN-MEMORY STORES (fallback when Redis unavailable)
// ════════════════════════════════════════════════════════════

/** Rate limit: chatKey -> last request timestamp */
const rateLimitMap = new Map<string, number>();

/** Cache: cacheKey -> { result, expiresAt } */
const cacheMap = new Map<string, { result: SuggestionResult; expiresAt: number }>();

/** Active requests: requestId -> AbortController */
const activeRequests = new Map<string, AbortController>();

// Cleanup stale entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of Array.from(rateLimitMap)) {
    if (now - ts > 15_000) rateLimitMap.delete(key);
  }
  for (const [key, entry] of Array.from(cacheMap)) {
    if (now > entry.expiresAt) cacheMap.delete(key);
  }
}, 60_000);

// ════════════════════════════════════════════════════════════
// RATE LIMIT
// ════════════════════════════════════════════════════════════

const RATE_LIMIT_MS = 10_000; // 10 seconds per conversation

function checkRateLimit(chatKey: string): { allowed: boolean; retryAfterMs: number } {
  const lastRequest = rateLimitMap.get(chatKey);
  if (!lastRequest) return { allowed: true, retryAfterMs: 0 };
  const elapsed = Date.now() - lastRequest;
  if (elapsed >= RATE_LIMIT_MS) return { allowed: true, retryAfterMs: 0 };
  return { allowed: false, retryAfterMs: RATE_LIMIT_MS - elapsed };
}

function setRateLimit(chatKey: string): void {
  rateLimitMap.set(chatKey, Date.now());
}

// ════════════════════════════════════════════════════════════
// CACHE
// ════════════════════════════════════════════════════════════

const CACHE_TTL_MS = 30_000; // 30 seconds

function getCachedSuggestion(cacheKey: string): SuggestionResult | null {
  const entry = cacheMap.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheMap.delete(cacheKey);
    return null;
  }
  return entry.result;
}

function setCachedSuggestion(cacheKey: string, result: SuggestionResult): void {
  cacheMap.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ════════════════════════════════════════════════════════════
// CANCELLATION
// ════════════════════════════════════════════════════════════

export function cancelSuggestion(requestId: string): boolean {
  const controller = activeRequests.get(requestId);
  if (controller) {
    controller.abort();
    activeRequests.delete(requestId);
    console.log(`[AiWorker] Cancelled request ${requestId}`);
    return true;
  }
  return false;
}

/** Cancel all active requests for a specific chat */
export function cancelChatSuggestions(sessionId: string, remoteJid: string): number {
  const prefix = `${sessionId}:${remoteJid}:`;
  let cancelled = 0;
  for (const [id, controller] of Array.from(activeRequests)) {
    if (id.startsWith(prefix)) {
      controller.abort();
      activeRequests.delete(id);
      cancelled++;
    }
  }
  if (cancelled > 0) console.log(`[AiWorker] Cancelled ${cancelled} requests for ${prefix}`);
  return cancelled;
}

// ════════════════════════════════════════════════════════════
// STREAMING AI CALL
// ════════════════════════════════════════════════════════════

const GENERATION_TIMEOUT_MS = 8_000; // 8 seconds

interface StreamingCallParams {
  provider: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  signal: AbortSignal;
  onChunk: (text: string) => void;
}

async function callAiStreaming(params: StreamingCallParams): Promise<string> {
  const { provider, apiKey, model, systemPrompt, userPrompt, signal, onChunk } = params;

  if (provider === "openai") {
    const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
    const systemRole = isReasoningModel ? "developer" : "system";
    const tokenParam = isReasoningModel ? { max_completion_tokens: 600 } : { max_tokens: 600 };
    const requestBody: Record<string, unknown> = {
      model,
      messages: [
        { role: systemRole, content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: !isReasoningModel, // reasoning models don't support streaming well
      ...tokenParam,
    };
    if (isReasoningModel) requestBody.reasoning_effort = "low";

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `OpenAI error: ${res.status}`);
    }

    // Streaming path
    if (!isReasoningModel && res.body) {
      let fullText = "";
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              onChunk(fullText);
            }
          } catch {}
        }
      }
      return fullText;
    }

    // Non-streaming fallback (reasoning models)
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    onChunk(text);
    return text;

  } else {
    // Anthropic — streaming
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: 600,
        stream: true,
      }),
      signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Anthropic error: ${res.status}`);
    }

    if (res.body) {
      let fullText = "";
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              fullText += parsed.delta.text;
              onChunk(fullText);
            }
          } catch {}
        }
      }
      return fullText;
    }

    // Non-streaming fallback
    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    onChunk(text);
    return text;
  }
}

// ════════════════════════════════════════════════════════════
// MAIN: REQUEST SUGGESTION (async, non-blocking)
// ════════════════════════════════════════════════════════════

export interface SuggestionRequest {
  requestId: string;
  tenantId: number;
  sessionId: string;
  remoteJid: string;
  contactName?: string;
  integrationId?: number;
  overrideModel?: string;
  style?: string;
  customInstruction?: string;
  /** Socket room/client ID to emit events to (optional) */
  socketId?: string;
}

export interface SuggestionRequestResult {
  status: "queued" | "cached" | "rate_limited";
  retryAfterMs?: number;
  cachedResult?: SuggestionResult;
}

/**
 * Request an AI suggestion asynchronously.
 * Returns immediately with status. Result delivered via socket.io events:
 * - "aiSuggestionChunk" { requestId, text } — streaming partial text
 * - "aiSuggestionReady" { requestId, result } — final result
 * - "aiSuggestionError" { requestId, error } — failure (silent on frontend)
 */
export function requestSuggestion(req: SuggestionRequest): SuggestionRequestResult {
  const chatKey = `${req.sessionId}:${req.remoteJid}`;

  // 1. Check rate limit
  const rateCheck = checkRateLimit(chatKey);
  if (!rateCheck.allowed) {
    return { status: "rate_limited", retryAfterMs: rateCheck.retryAfterMs };
  }

  // 2. Check cache
  const lastMsgKey = `${chatKey}:${req.style || "default"}`;
  const cached = getCachedSuggestion(lastMsgKey);
  if (cached) {
    return { status: "cached", cachedResult: cached };
  }

  // 3. Cancel any existing request for this chat
  cancelChatSuggestions(req.sessionId, req.remoteJid);

  // 4. Set rate limit
  setRateLimit(chatKey);

  // 5. Create abort controller
  const controller = new AbortController();
  const requestKey = `${chatKey}:${req.requestId}`;
  activeRequests.set(requestKey, controller);

  // 6. Fire-and-forget async generation
  processGenerationAsync(req, controller, requestKey, lastMsgKey).catch((err) => {
    console.error(`[AiWorker] Unhandled error in generation:`, err);
  });

  return { status: "queued" };
}

async function processGenerationAsync(
  req: SuggestionRequest,
  controller: AbortController,
  requestKey: string,
  cacheKey: string,
): Promise<void> {
  const io = getIo();
  const startTime = Date.now();

  // Timeout: abort after 8 seconds
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, GENERATION_TIMEOUT_MS);

  try {
    // 1. Resolve AI integration
    let integration: any = null;
    if (req.integrationId) {
      integration = await getAiIntegration(req.tenantId, req.integrationId);
    }
    if (!integration) {
      integration = await getAnyActiveAiIntegration(req.tenantId);
    }
    if (!integration) {
      emitError(io, req, "NO_AI_CONFIGURED");
      return;
    }

    const settings = await getTenantAiSettings(req.tenantId);
    const model = req.overrideModel || settings.defaultAiModel || integration.defaultModel;

    // 2. Fetch full conversation context (up to 200 messages for comprehensive AI response)
    const messages = await fetchConversationMessages(req.sessionId, req.remoteJid, 200);
    if (messages.length === 0) {
      emitError(io, req, "NO_MESSAGES");
      return;
    }

    // 3. Fetch CRM context
    const crmContext = await fetchCrmContext(req.tenantId, req.sessionId, req.remoteJid);
    const contactName = req.contactName || crmContext.contactName || "Cliente";

    // 4. Classify intent
    const lastClientMsg = [...messages].reverse().find((m: any) => !m.fromMe && m.content);
    const intent = lastClientMsg ? classifyIntent(lastClientMsg.content) : "outro";

    // 5. Build prompts
    const style = (req.style as any) || "default";
    const systemPrompt = buildSystemPrompt(contactName, intent, style, req.customInstruction);
    const userPrompt = buildUserPrompt(contactName, buildStructuredContext(messages, contactName, crmContext));

    // Check if cancelled before calling AI
    if (controller.signal.aborted) {
      console.log(`[AiWorker] Request ${req.requestId} cancelled before AI call`);
      return;
    }

    // 6. Call AI with streaming
    console.log(`[AiWorker] Streaming: tenant=${req.tenantId}, provider=${integration.provider}, model=${model}, msgs=${messages.length}`);

    const rawResponse = await callAiStreaming({
      provider: integration.provider,
      apiKey: integration.apiKey,
      model,
      systemPrompt,
      userPrompt,
      signal: controller.signal,
      onChunk: (text) => {
        if (io) {
          io.emit("aiSuggestionChunk", {
            requestId: req.requestId,
            sessionId: req.sessionId,
            remoteJid: req.remoteJid,
            text,
          });
        }
      },
    });

    clearTimeout(timeoutId);

    // 7. Parse and emit final result
    const parsed = parseAiResponse(rawResponse);
    const durationMs = Date.now() - startTime;

    const result: SuggestionResult = {
      suggestion: parsed.full,
      parts: parsed.parts,
      provider: integration.provider,
      model,
      intentClassified: intent,
      durationMs,
      contextMessageCount: messages.length,
      hasCrmContext: !!(crmContext.activeDeal || crmContext.lifecycleStage),
    };

    // Cache result
    setCachedSuggestion(cacheKey, result);

    // Emit final result
    if (io) {
      io.emit("aiSuggestionReady", {
        requestId: req.requestId,
        sessionId: req.sessionId,
        remoteJid: req.remoteJid,
        result,
      });
    }

    console.log(`[AiWorker] Done: ${durationMs}ms, parts=${parsed.parts.length}, intent=${intent}`);

    // Log telemetry (fire-and-forget)
    logSuggestionTelemetry({
      tenantId: req.tenantId,
      provider: integration.provider,
      model,
      intentClassified: intent,
      style: req.style || "default",
      durationMs,
      contextMessageCount: messages.length,
      hasCrmContext: !!(crmContext.activeDeal || crmContext.lifecycleStage),
      success: true,
      partsCount: parsed.parts.length,
    }).catch(() => {});

  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError" || controller.signal.aborted) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= GENERATION_TIMEOUT_MS - 500) {
        // Timeout — emit fallback
        console.log(`[AiWorker] Timeout: ${req.requestId} after ${elapsed}ms`);
        if (io) {
          io.emit("aiSuggestionReady", {
            requestId: req.requestId,
            sessionId: req.sessionId,
            remoteJid: req.remoteJid,
            result: {
              suggestion: "Não consegui gerar sugestão agora. Tente novamente.",
              parts: ["Não consegui gerar sugestão agora. Tente novamente."],
              provider: "timeout",
              model: "timeout",
              intentClassified: "timeout",
              durationMs: elapsed,
              contextMessageCount: 0,
              hasCrmContext: false,
            } as SuggestionResult,
            timedOut: true,
          });
        }
      } else {
        // User-initiated cancellation — silent
        console.log(`[AiWorker] Cancelled: ${req.requestId} after ${elapsed}ms`);
      }
      return;
    }

    // Other errors — emit error event (frontend handles silently)
    console.error(`[AiWorker] Error: ${req.requestId}`, err.message);
    emitError(io, req, err.message || "AI generation failed");

  } finally {
    activeRequests.delete(requestKey);
  }
}

function emitError(io: any, req: SuggestionRequest, error: string): void {
  if (io) {
    io.emit("aiSuggestionError", {
      requestId: req.requestId,
      sessionId: req.sessionId,
      remoteJid: req.remoteJid,
      error,
    });
  }
}

// ════════════════════════════════════════════════════════════
// EXPORTS for testing
// ════════════════════════════════════════════════════════════

export const _testing = {
  rateLimitMap,
  cacheMap,
  activeRequests,
  RATE_LIMIT_MS,
  CACHE_TTL_MS,
  GENERATION_TIMEOUT_MS,
  checkRateLimit,
  setRateLimit,
  getCachedSuggestion,
  setCachedSuggestion,
};
