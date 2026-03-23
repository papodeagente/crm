import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// ═══════════════════════════════════════
// GLOBAL RATE LIMIT CIRCUIT BREAKER
// Prevents retry amplification when the
// platform returns 429 Rate exceeded.
// ═══════════════════════════════════════
let rateLimitedUntil = 0;

function isRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

function markRateLimited(backoffMs: number) {
  const until = Date.now() + backoffMs;
  if (until > rateLimitedUntil) {
    rateLimitedUntil = until;
    console.warn(`[RateLimit] Backing off for ${backoffMs}ms until ${new Date(until).toISOString()}`);
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Never retry if we're in a rate-limit backoff window
        if (isRateLimited()) return false;

        if (error instanceof TRPCClientError) {
          const msg = error.message || "";
          // Don't retry auth errors at all
          if (msg === UNAUTHED_ERR_MSG) return false;
          // Rate limit: let the fetch-level handler deal with it, don't double-retry
          if (msg.includes("Rate exceeded")) return false;
          // Network errors: retry once
          if (msg.includes("fetch failed") || msg.includes("Unexpected token")) {
            return failureCount < 1;
          }
        }
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 15000),
    },
    mutations: {
      retry: (failureCount, error) => {
        if (isRateLimited()) return false;
        if (error instanceof TRPCClientError) {
          const msg = error.message || "";
          if (msg.includes("Rate exceeded")) return false;
        }
        return false;
      },
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    // Only log non-rate-limit errors to avoid console spam
    if (!(error instanceof TRPCClientError && error.message?.includes("Rate exceeded"))) {
      console.error("[API Query Error]", error);
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    if (!(error instanceof TRPCClientError && error.message?.includes("Rate exceeded"))) {
      console.error("[API Mutation Error]", error);
    }
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        // If we're in a rate-limit backoff window, wait before even trying
        if (isRateLimited()) {
          const waitMs = rateLimitedUntil - Date.now();
          if (waitMs > 0) {
            await new Promise(r => setTimeout(r, waitMs));
          }
        }

        const MAX_RETRIES = 2; // Only 2 retries at fetch level (total 3 attempts)
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const response = await globalThis.fetch(input, {
              ...(init ?? {}),
              credentials: "include",
            });

            const contentType = response.headers.get("content-type") || "";

            if (response.status === 429) {
              const text = await response.text();
              // Exponential backoff: 3s, 6s, 12s
              const backoffMs = 3000 * Math.pow(2, attempt);
              markRateLimited(backoffMs);

              if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, backoffMs));
                continue;
              }
              throw new Error("Rate exceeded");
            }

            if (!response.ok && !contentType.includes("application/json")) {
              const text = await response.text();
              throw new Error(text || `HTTP ${response.status}`);
            }

            return response;
          } catch (err: any) {
            lastError = err;
            if (err.message?.includes("Rate exceeded")) {
              if (attempt >= MAX_RETRIES) throw err;
              // Already handled above via markRateLimited
              continue;
            }
            if (attempt < MAX_RETRIES && err.message?.includes("fetch failed")) {
              await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
              continue;
            }
            throw err;
          }
        }
        throw lastError || new Error("Max retries exceeded");
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
