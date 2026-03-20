import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Retry on rate limit / network errors up to 3 times
        if (error instanceof TRPCClientError) {
          const msg = error.message || "";
          if (msg.includes("Rate exceeded") || msg.includes("Unexpected token") || msg.includes("fetch failed")) {
            return failureCount < 3;
          }
          // Don't retry auth errors
          if (msg === UNAUTHED_ERR_MSG) return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 30 * 1000, // 30s global default: avoid refetching data that was just fetched
      refetchOnWindowFocus: false, // prevent refetch storms when user switches tabs
    },
    mutations: {
      retry: (failureCount, error) => {
        if (error instanceof TRPCClientError) {
          const msg = error.message || "";
          if (msg.includes("Rate exceeded") || msg.includes("Unexpected token") || msg.includes("fetch failed")) {
            return failureCount < 3;
          }
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
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
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        const maxRetries = 3;
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const response = await globalThis.fetch(input, {
              ...(init ?? {}),
              credentials: "include",
            });
            // Check if response is actually JSON (rate limit returns plain text)
            const contentType = response.headers.get("content-type") || "";
            if (!response.ok && !contentType.includes("application/json")) {
              const text = await response.text();
              if (text.includes("Rate exceeded") && attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                continue;
              }
              throw new Error(text || `HTTP ${response.status}`);
            }
            return response;
          } catch (err: any) {
            lastError = err;
            if (attempt < maxRetries && (err.message?.includes("Rate exceeded") || err.message?.includes("fetch failed"))) {
              await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
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
