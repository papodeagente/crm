/**
 * Instrumented Provider Wrapper
 *
 * Wraps any WhatsAppProvider to automatically record metrics (latency, errors, counts)
 * for every operation. This is the observability layer — it sits between the consumer
 * and the actual provider, transparently recording performance data.
 *
 * Usage:
 *   const provider = instrumentProvider(zapiProvider);
 *   await provider.sendText(...); // automatically records metrics
 */

import type { WhatsAppProvider, ProviderType } from "./types";
import { recordProviderMetric } from "./providerFactory";

/**
 * Create a Proxy-based instrumented wrapper around a WhatsAppProvider.
 * Every method call is intercepted, timed, and recorded.
 */
export function instrumentProvider(provider: WhatsAppProvider): WhatsAppProvider {
  return new Proxy(provider, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // Only instrument functions (skip 'type' property and non-functions)
      if (typeof value !== "function") return value;

      // Skip internal/non-API methods
      const skipMethods = new Set(["normalizeWebhookPayload", "getInstanceName"]);
      if (skipMethods.has(prop as string)) return value;

      return async function instrumentedCall(...args: any[]) {
        const operation = prop as string;
        const startTime = Date.now();
        let error: string | undefined;

        try {
          const result = await value.apply(target, args);
          return result;
        } catch (err: any) {
          error = err.message || "Unknown error";
          throw err;
        } finally {
          const latencyMs = Date.now() - startTime;
          recordProviderMetric(target.type, operation, latencyMs, error);

          // Log slow operations (>5s)
          if (latencyMs > 5000) {
            console.warn(
              `[Provider:${target.type}] Slow operation: ${operation} took ${latencyMs}ms` +
              (error ? ` (error: ${error})` : "")
            );
          }

          // Log errors
          if (error) {
            console.warn(
              `[Provider:${target.type}] Error in ${operation}: ${error} (${latencyMs}ms)`
            );
          }
        }
      };
    },
  });
}
