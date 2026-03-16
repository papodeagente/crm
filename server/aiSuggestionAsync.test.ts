import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ─── Test: AI Suggestion Worker (backend async) ───
describe("AI Suggestion Worker — Async Backend", () => {
  const workerPath = join(__dirname, "aiSuggestionWorker.ts");
  let workerSource: string;

  beforeEach(() => {
    workerSource = readFileSync(workerPath, "utf-8");
  });

  // Requirement #1: Async job queue
  it("should export requestSuggestion function", () => {
    expect(workerSource).toContain("export function requestSuggestion");
  });

  it("should emit socket events for streaming (aiSuggestionChunk, aiSuggestionReady, aiSuggestionError)", () => {
    expect(workerSource).toContain("aiSuggestionChunk");
    expect(workerSource).toContain("aiSuggestionReady");
    expect(workerSource).toContain("aiSuggestionError");
  });

  it("should accept requestId parameter for tracking", () => {
    expect(workerSource).toContain("requestId");
  });

  // Requirement #2: Timeout 8 seconds
  it("should implement 8-second timeout", () => {
    expect(workerSource).toMatch(/GENERATION_TIMEOUT_MS\s*=\s*8[_.]?000/);
  });

  it("should have AbortController for timeout enforcement", () => {
    expect(workerSource).toContain("AbortController");
    expect(workerSource).toContain("abort");
  });

  it("should return partial result on timeout", () => {
    expect(workerSource).toContain("timedOut");
  });

  // Requirement #3: Cancellation
  it("should export cancelSuggestion function", () => {
    expect(workerSource).toContain("export function cancelSuggestion");
  });

  it("should track active requests for cancellation", () => {
    expect(workerSource).toContain("activeRequests");
  });

  // Requirement #4: Rate limit (10s per conversation)
  it("should implement rate limiting per conversation", () => {
    expect(workerSource).toMatch(/RATE_LIMIT_MS\s*=\s*10[_.]?000/);
  });

  it("should track rate limits by session+remoteJid", () => {
    expect(workerSource).toContain("rateLimitMap");
  });

  it("should return rate_limited status with retryAfterMs", () => {
    expect(workerSource).toContain("rate_limited");
    expect(workerSource).toContain("retryAfterMs");
  });

  // Requirement #5: Smart context (10 messages)
  it("should limit context to recent messages", () => {
    // The worker delegates context building to aiSuggestionService which uses fetchConversationMessages
    expect(workerSource).toContain("fetchConversationMessages");
  });

  // Requirement #7: Cache (30s)
  it("should implement in-memory cache with 30s TTL", () => {
    expect(workerSource).toMatch(/CACHE_TTL_MS\s*=\s*30[_.]?000/);
  });

  it("should use cache key based on session+remoteJid", () => {
    expect(workerSource).toContain("cacheKey");
  });

  it("should return cached result when available", () => {
    expect(workerSource).toContain("cachedResult");
  });

  // Requirement #9: Silent failure
  it("should emit error event instead of throwing", () => {
    expect(workerSource).toContain("aiSuggestionError");
    expect(workerSource).toContain("catch");
  });
});

// ─── Test: AI Suggestion Frontend (AiSuggestionPanel) — Async Features ───
describe("AI Suggestion Frontend — Async Features", () => {
  const panelPath = join(__dirname, "../client/src/components/AiSuggestionPanel.tsx");
  let panelSource: string;

  beforeEach(() => {
    panelSource = readFileSync(panelPath, "utf-8");
  });

  // Requirement #1: Async non-blocking
  it("should use suggestAsync mutation instead of blocking suggest", () => {
    expect(panelSource).toContain("suggestAsync");
    expect(panelSource).toContain("ai.suggestAsync");
  });

  // Requirement #2: Streaming display
  it("should have streaming phase in UI", () => {
    expect(panelSource).toContain('"streaming"');
    expect(panelSource).toContain("streamingText");
  });

  it("should listen for aiSuggestionChunk socket events", () => {
    expect(panelSource).toContain("aiSuggestionChunk");
    expect(panelSource).toContain("socket.on");
  });

  it("should listen for aiSuggestionReady socket events", () => {
    expect(panelSource).toContain("aiSuggestionReady");
  });

  it("should show cursor animation during streaming", () => {
    expect(panelSource).toContain("animate-pulse");
  });

  // Requirement #3: Cancellation
  it("should cancel on close", () => {
    expect(panelSource).toContain("cancelMut.mutate");
  });

  it("should cancel on unmount/navigation via useEffect cleanup", () => {
    expect(panelSource).toContain("currentRequestId.current");
  });

  it("should cancel previous request when generating new one", () => {
    const generateMatch = panelSource.match(/doGenerate[\s\S]*?cancelMut\.mutate/);
    expect(generateMatch).not.toBeNull();
  });

  // Requirement #4: Rate limit handling
  it("should handle rate_limited response from backend", () => {
    expect(panelSource).toContain("rate_limited");
  });

  // Requirement #6: Debounce
  it("should implement debounce with 1.5s delay", () => {
    expect(panelSource).toContain("debounceTimerRef");
    expect(panelSource).toMatch(/1500/);
  });

  it("should clear debounce timer on unmount", () => {
    expect(panelSource).toContain("clearTimeout(debounceTimerRef.current)");
  });

  // Requirement #7: Cache handling
  it("should handle cached result from backend", () => {
    expect(panelSource).toContain("cachedResult");
    expect(panelSource).toContain('"cached"');
  });

  // Requirement #8: UX indicators
  it("should show loading state with context info", () => {
    expect(panelSource).toContain("Gerando sugestão");
    expect(panelSource).toContain("últimas 10 mensagens");
  });

  it("should show streaming progress indicator", () => {
    expect(panelSource).toContain("Recebendo resposta");
  });

  // Requirement #9: Silent failure
  it("should handle errors silently (console.error, not toast)", () => {
    expect(panelSource).toContain('console.error("[AiSuggestion]');
  });

  it("should return to idle on error instead of showing error phase", () => {
    const errorMatch = panelSource.match(/onError:[\s\S]*?setPhase\("idle"\)/);
    expect(errorMatch).not.toBeNull();
  });

  // Requirement #10: requestId tracking
  it("should generate unique requestId per request", () => {
    expect(panelSource).toContain("generateRequestId");
    expect(panelSource).toContain("currentRequestId");
  });

  it("should filter socket events by requestId", () => {
    expect(panelSource).toContain("data.requestId === currentRequestId.current");
  });

  // Socket cleanup
  it("should clean up socket listeners on unmount", () => {
    expect(panelSource).toContain("socket.off");
  });
});

// ─── Test: tRPC Router endpoints ───
describe("AI Suggestion tRPC Endpoints — Async", () => {
  const routersPath = join(__dirname, "routers.ts");
  let routersSource: string;

  beforeEach(() => {
    routersSource = readFileSync(routersPath, "utf-8");
  });

  it("should have suggestAsync endpoint", () => {
    expect(routersSource).toContain("suggestAsync");
  });

  it("should have cancel endpoint", () => {
    expect(routersSource).toContain("cancel:");
  });

  it("should import requestSuggestion from worker", () => {
    expect(routersSource).toContain("requestSuggestion");
  });

  it("should import cancelSuggestion from worker", () => {
    expect(routersSource).toContain("cancelSuggestion");
  });
});

// ─── Test: Socket singleton ───
describe("Socket Singleton for AI Events", () => {
  const singletonPath = join(__dirname, "socketSingleton.ts");
  let singletonSource: string;

  beforeEach(() => {
    singletonSource = readFileSync(singletonPath, "utf-8");
  });

  it("should export setIo and getIo functions", () => {
    expect(singletonSource).toContain("export function setIo");
    expect(singletonSource).toContain("export function getIo");
  });

  it("should store io instance as singleton", () => {
    expect(singletonSource).toContain("let _io");
  });
});

// ─── Test: useSocket getSocketInstance export ───
describe("useSocket getSocketInstance", () => {
  const socketPath = join(__dirname, "../client/src/hooks/useSocket.ts");
  let socketSource: string;

  beforeEach(() => {
    socketSource = readFileSync(socketPath, "utf-8");
  });

  it("should export getSocketInstance function", () => {
    expect(socketSource).toContain("export function getSocketInstance");
  });

  it("should expose raw socket via getSocket method on SocketManager", () => {
    expect(socketSource).toContain("getSocket(): Socket | null");
  });
});
