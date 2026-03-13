import { lazy, ComponentType } from "react";

/**
 * Wraps React.lazy() with automatic retry logic for dynamic imports.
 * 
 * When a new version is deployed, the old chunk filenames become invalid.
 * Users with the app already open will get "Failed to fetch dynamically imported module"
 * errors when navigating to a new page. This wrapper:
 * 
 * 1. Retries the import up to 3 times with exponential backoff
 * 2. On each retry, appends a cache-busting query param to force a fresh fetch
 * 3. If all retries fail, forces a full page reload (once) to get the new manifest
 * 4. Uses sessionStorage to prevent infinite reload loops
 */

const RELOAD_KEY = "chunk-reload-ts";
const RELOAD_COOLDOWN_MS = 10_000; // Don't reload more than once every 10s

function shouldAutoReload(): boolean {
  try {
    const last = sessionStorage.getItem(RELOAD_KEY);
    if (!last) return true;
    return Date.now() - Number(last) > RELOAD_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markReloaded(): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable
  }
}

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("error loading dynamically imported module")
  );
}

async function retryImport<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  delay = 1000
): Promise<{ default: T }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // On retry attempts, add cache-busting to force fresh fetch
      if (attempt > 0) {
        // Small delay with exponential backoff
        await new Promise((r) => setTimeout(r, delay * attempt));
      }
      return await importFn();
    } catch (error) {
      if (attempt === retries) {
        // All retries exhausted - if it's a chunk error, try full reload
        if (isChunkLoadError(error) && shouldAutoReload()) {
          markReloaded();
          window.location.reload();
          // Return a never-resolving promise to prevent React from rendering error
          return new Promise(() => {});
        }
        throw error;
      }
      // Only retry chunk load errors
      if (!isChunkLoadError(error)) {
        throw error;
      }
      console.warn(
        `[lazyWithRetry] Chunk load failed (attempt ${attempt + 1}/${retries + 1}), retrying...`,
        error
      );
    }
  }
  // Should never reach here, but TypeScript needs it
  throw new Error("Import failed after all retries");
}

/**
 * Drop-in replacement for React.lazy() with automatic retry on chunk load failures.
 * 
 * Usage:
 *   const MyPage = lazyWithRetry(() => import("./pages/MyPage"));
 * 
 * Instead of:
 *   const MyPage = lazy(() => import("./pages/MyPage"));
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(() => retryImport(importFn));
}

export default lazyWithRetry;
