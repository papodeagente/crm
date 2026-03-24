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
// CIRCUIT BREAKER — Global rate limit protection
// When a 429 is received, non-critical requests pause for a cooldown period.
// Auth-related requests (auth.me, auth.logout) are NEVER blocked.
// ═══════════════════════════════════════
let rateLimitedUntil = 0;
let consecutiveRateLimits = 0;

function getRateLimitCooldown(): number {
  // Less aggressive cooldown: 5s → 10s → 20s → 30s (max)
  const base = 5_000;
  const multiplier = Math.min(consecutiveRateLimits, 3);
  return base * (multiplier + 1);
}

function activateCircuitBreaker() {
  consecutiveRateLimits++;
  const cooldown = getRateLimitCooldown();
  rateLimitedUntil = Date.now() + cooldown;
  console.warn(
    `[CircuitBreaker] Rate limited. Pausing non-critical requests for ${cooldown / 1000}s ` +
    `(consecutive: ${consecutiveRateLimits})`
  );
}

function resetCircuitBreaker() {
  if (consecutiveRateLimits > 0) {
    console.info("[CircuitBreaker] Requests flowing normally again.");
  }
  consecutiveRateLimits = 0;
  rateLimitedUntil = 0;
}

function isCircuitBreakerOpen(): boolean {
  return Date.now() < rateLimitedUntil;
}

// Check if a request URL targets auth-related endpoints that should never be blocked
function isAuthRequest(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  // tRPC batch requests encode procedure names in the URL
  // Allow auth.me, auth.logout, saasAuth, plan.summary through always
  return /auth\.me|auth\.logout|saasAuth|plan\.summary|oauth/i.test(url);
}

// ═══════════════════════════════════════
// QUERY CLIENT — Conservative retry policy
// ═══════════════════════════════════════
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof TRPCClientError) {
          const msg = error.message || "";
          // NEVER retry rate limits — circuit breaker handles recovery
          if (msg.includes("Rate exceeded") || msg.includes("RATE_LIMITED")) return false;
          // NEVER retry auth errors — redirect handles it
          if (msg === UNAUTHED_ERR_MSG) return false;
          // Network errors: retry once with delay
          if (msg.includes("fetch failed") || msg.includes("Unexpected token")) {
            return failureCount < 1;
          }
        }
        // Default: retry once for transient errors
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(3000 * 2 ** attemptIndex, 15000),
      // Global staleTime: avoid re-fetching data that was just fetched
      staleTime: 15_000,
      // CRITICAL: Disable refetchOnWindowFocus globally to prevent burst of ~291 queries on tab switch
      // Individual queries can override this if they truly need fresh data on focus
      refetchOnWindowFocus: false,
      // Disable refetchOnReconnect to prevent burst after network recovery
      refetchOnReconnect: false,
    },
    mutations: {
      // Never retry mutations automatically
      retry: false,
    },
  },
});

// ═══════════════════════════════════════
// AUTH REDIRECT — Centralized unauthorized handler
// ═══════════════════════════════════════
const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;
  if (error.message !== UNAUTHED_ERR_MSG) return;
  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
  }
});

// ═══════════════════════════════════════
// tRPC CLIENT — Zero fetch-level retries, circuit breaker integration
// Auth requests bypass circuit breaker to ensure login always works
// ═══════════════════════════════════════
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        // Auth requests ALWAYS go through — never blocked by circuit breaker
        const isAuth = isAuthRequest(input);

        // Check circuit breaker BEFORE making non-auth requests
        if (!isAuth && isCircuitBreakerOpen()) {
          const waitMs = rateLimitedUntil - Date.now();
          throw new Error(
            `RATE_LIMITED: Sistema pausado por ${Math.ceil(waitMs / 1000)}s. Aguarde.`
          );
        }

        const response = await globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });

        // Handle non-JSON responses (platform rate limit returns plain text)
        const contentType = response.headers.get("content-type") || "";
        if (!response.ok && !contentType.includes("application/json")) {
          const text = await response.text();
          if (text.includes("Rate exceeded") || response.status === 429) {
            activateCircuitBreaker();
            throw new Error("Rate exceeded");
          }
          throw new Error(text || `HTTP ${response.status}`);
        }

        // Successful response — reset circuit breaker
        if (response.ok) {
          resetCircuitBreaker();
        }

        return response;
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
