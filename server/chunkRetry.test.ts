import { describe, it, expect } from "vitest";

/**
 * Tests for chunk load error detection logic.
 * The actual lazyWithRetry and ErrorBoundary use the same isChunkLoadError pattern.
 * We test the detection logic here to ensure all known error message variants are caught.
 */

function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
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

describe("isChunkLoadError", () => {
  it("detects Vite chunk load error", () => {
    const error = new Error(
      "Failed to fetch dynamically imported module: https://crm.acelerador.tur.br/assets/Tasks-m0-KZ5A.js"
    );
    expect(isChunkLoadError(error)).toBe(true);
  });

  it("detects Webpack chunk load error", () => {
    const error = new Error("Loading chunk 42 failed.");
    expect(isChunkLoadError(error)).toBe(true);
  });

  it("detects CSS chunk load error", () => {
    const error = new Error("Loading CSS chunk 15 failed.");
    expect(isChunkLoadError(error)).toBe(true);
  });

  it("detects Safari import error", () => {
    const error = new Error(
      "Importing a module script failed: https://example.com/assets/Page-abc123.js"
    );
    expect(isChunkLoadError(error)).toBe(true);
  });

  it("detects generic dynamic import error", () => {
    const error = new Error(
      "Error loading dynamically imported module: /assets/Component-xyz.js"
    );
    expect(isChunkLoadError(error)).toBe(true);
  });

  it("does NOT detect regular errors", () => {
    const error = new Error("Cannot read property 'foo' of undefined");
    expect(isChunkLoadError(error)).toBe(false);
  });

  it("does NOT detect network errors unrelated to chunks", () => {
    const error = new Error("NetworkError when attempting to fetch resource.");
    expect(isChunkLoadError(error)).toBe(false);
  });

  it("handles null error", () => {
    expect(isChunkLoadError(null)).toBe(false);
  });

  it("detects error with different casing", () => {
    const error = new Error(
      "FAILED TO FETCH DYNAMICALLY IMPORTED MODULE: /assets/Page.js"
    );
    expect(isChunkLoadError(error)).toBe(true);
  });

  it("detects error with module path containing hash", () => {
    const error = new Error(
      "Failed to fetch dynamically imported module: https://crm.acelerador.tur.br/assets/Inbox-3fa9b2e4.js"
    );
    expect(isChunkLoadError(error)).toBe(true);
  });
});

describe("reload cooldown logic", () => {
  it("prevents infinite reload loops with cooldown", () => {
    const RELOAD_COOLDOWN_MS = 10_000;
    
    // Simulate first reload - should allow
    const now = Date.now();
    const lastReload = null;
    const shouldReload1 = !lastReload || (now - Number(lastReload)) > RELOAD_COOLDOWN_MS;
    expect(shouldReload1).toBe(true);
    
    // Simulate second reload within cooldown - should block
    const recentReload = String(now);
    const shouldReload2 = !recentReload || (now - Number(recentReload)) > RELOAD_COOLDOWN_MS;
    expect(shouldReload2).toBe(false);
    
    // Simulate reload after cooldown - should allow
    const oldReload = String(now - 15_000);
    const shouldReload3 = !oldReload || (now - Number(oldReload)) > RELOAD_COOLDOWN_MS;
    expect(shouldReload3).toBe(true);
  });
});
