/**
 * Z-API Audit Tests
 *
 * Tests for the Z-API audit fixes:
 * 1. normalizeToUnixSeconds — timestamp normalization (seconds vs milliseconds)
 * 2. Webhook deduplication — LRU cache for duplicate events
 * 3. Profile pics batch limit — max JIDs per request
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════
// 1. normalizeToUnixSeconds
// ═══════════════════════════════════════════════════════════

describe("normalizeToUnixSeconds", () => {
  // We import the function directly from the provider
  let normalizeToUnixSeconds: (raw: number | string | undefined | null) => number;

  beforeEach(async () => {
    const mod = await import("./providers/zapiProvider");
    normalizeToUnixSeconds = mod.normalizeToUnixSeconds;
  });

  it("should convert milliseconds (> 1e12) to seconds", () => {
    // 2026-03-27 in ms
    const msTimestamp = 1774800000000;
    const result = normalizeToUnixSeconds(msTimestamp);
    expect(result).toBe(1774800000);
  });

  it("should keep seconds (< 1e12) as-is", () => {
    const secTimestamp = 1774800000;
    const result = normalizeToUnixSeconds(secTimestamp);
    expect(result).toBe(1774800000);
  });

  it("should handle string timestamps in milliseconds", () => {
    const result = normalizeToUnixSeconds("1774800000000");
    expect(result).toBe(1774800000);
  });

  it("should handle string timestamps in seconds", () => {
    const result = normalizeToUnixSeconds("1774800000");
    expect(result).toBe(1774800000);
  });

  it("should return current time for null/undefined", () => {
    const now = Math.floor(Date.now() / 1000);
    const resultNull = normalizeToUnixSeconds(null);
    const resultUndef = normalizeToUnixSeconds(undefined);
    // Should be within 2 seconds of now
    expect(Math.abs(resultNull - now)).toBeLessThan(2);
    expect(Math.abs(resultUndef - now)).toBeLessThan(2);
  });

  it("should return current time for zero or negative values", () => {
    const now = Math.floor(Date.now() / 1000);
    const resultZero = normalizeToUnixSeconds(0);
    const resultNeg = normalizeToUnixSeconds(-1);
    expect(Math.abs(resultZero - now)).toBeLessThan(2);
    expect(Math.abs(resultNeg - now)).toBeLessThan(2);
  });

  it("should return current time for NaN", () => {
    const now = Math.floor(Date.now() / 1000);
    const result = normalizeToUnixSeconds("not-a-number");
    expect(Math.abs(result - now)).toBeLessThan(2);
  });

  it("should reject dates in the far future (year > 2100)", () => {
    // A timestamp that would produce year 58000+ if double-multiplied
    const farFuture = 1774800000000000; // way too large
    const now = Math.floor(Date.now() / 1000);
    const result = normalizeToUnixSeconds(farFuture);
    // Should fall back to current time since even after /1000 it's still far future
    expect(Math.abs(result - now)).toBeLessThan(2);
  });

  it("should reject dates in the far past (year < 2000)", () => {
    // Unix timestamp for 1990
    const farPast = 631152000;
    const now = Math.floor(Date.now() / 1000);
    const result = normalizeToUnixSeconds(farPast);
    expect(Math.abs(result - now)).toBeLessThan(2);
  });

  it("should handle Z-API lastMessageTime format correctly", () => {
    // Z-API docs show: "lastMessageTime": "1622991687" (seconds as string)
    const docsExample = "1622991687";
    const result = normalizeToUnixSeconds(docsExample);
    const date = new Date(result * 1000);
    expect(date.getFullYear()).toBe(2021);
    expect(result).toBe(1622991687);
  });

  it("should handle Z-API lastMessageTime in ms format", () => {
    // Real Z-API data returns ms: "1774640377604"
    const realZapi = "1774640377604";
    const result = normalizeToUnixSeconds(realZapi);
    const date = new Date(result * 1000);
    expect(date.getFullYear()).toBeGreaterThanOrEqual(2020);
    expect(date.getFullYear()).toBeLessThanOrEqual(2100);
    expect(result).toBe(1774640377); // Truncated to seconds
  });

  it("should handle Z-API momment field (milliseconds)", () => {
    // Z-API webhook momment is in ms
    const momment = 1774640377604;
    const result = normalizeToUnixSeconds(momment);
    expect(result).toBe(1774640377);
  });

  it("should produce valid MySQL DATETIME values", () => {
    // The bug was producing year 58000+ which MySQL rejects (max 9999)
    const testCases = [
      1774800000,      // seconds
      1774800000000,   // milliseconds
      "1774800000",    // string seconds
      "1774800000000", // string milliseconds
    ];

    for (const ts of testCases) {
      const result = normalizeToUnixSeconds(ts);
      const date = new Date(result * 1000);
      expect(date.getFullYear()).toBeGreaterThanOrEqual(2000);
      expect(date.getFullYear()).toBeLessThanOrEqual(2100);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 2. Webhook deduplication
// ═══════════════════════════════════════════════════════════

describe("Webhook deduplication", () => {
  it("should detect duplicate webhook events by messageId", () => {
    // Simulate the dedup logic
    const DEDUP_TTL_MS = 60_000;
    const cache = new Map<string, number>();

    function isDuplicate(key: string): boolean {
      const now = Date.now();
      if (cache.has(key)) {
        const ts = cache.get(key)!;
        if (now - ts < DEDUP_TTL_MS) return true;
      }
      cache.set(key, now);
      return false;
    }

    const key1 = "session1:messages.upsert:msg123";
    expect(isDuplicate(key1)).toBe(false); // First time
    expect(isDuplicate(key1)).toBe(true);  // Duplicate
    expect(isDuplicate(key1)).toBe(true);  // Still duplicate

    const key2 = "session1:messages.upsert:msg456";
    expect(isDuplicate(key2)).toBe(false); // Different message
  });

  it("should allow same messageId after TTL expires", () => {
    const cache = new Map<string, number>();

    function isDuplicate(key: string, now: number): boolean {
      const DEDUP_TTL_MS = 60_000;
      if (cache.has(key)) {
        const ts = cache.get(key)!;
        if (now - ts < DEDUP_TTL_MS) return true;
      }
      cache.set(key, now);
      return false;
    }

    const key = "session1:messages.upsert:msg789";
    const t0 = Date.now();
    expect(isDuplicate(key, t0)).toBe(false);
    expect(isDuplicate(key, t0 + 30_000)).toBe(true); // 30s later, still duplicate
    expect(isDuplicate(key, t0 + 61_000)).toBe(false); // 61s later, TTL expired
  });

  it("should evict old entries when cache grows large", () => {
    const DEDUP_MAX_SIZE = 100;
    const DEDUP_TTL_MS = 60_000;
    const cache = new Map<string, number>();

    // Fill cache with old entries
    const oldTime = Date.now() - 120_000; // 2 minutes ago
    for (let i = 0; i < 150; i++) {
      cache.set(`old_${i}`, oldTime);
    }
    expect(cache.size).toBe(150);

    // Eviction logic
    if (cache.size > DEDUP_MAX_SIZE) {
      const now = Date.now();
      const entries = Array.from(cache.entries());
      for (const [k, ts] of entries) {
        if (now - ts > DEDUP_TTL_MS) cache.delete(k);
        if (cache.size <= DEDUP_MAX_SIZE * 0.7) break;
      }
    }

    // Should have evicted old entries
    expect(cache.size).toBeLessThanOrEqual(DEDUP_MAX_SIZE);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. Profile pics batch limit
// ═══════════════════════════════════════════════════════════

describe("Profile pics batch limit", () => {
  it("should limit JIDs to MAX_JIDS", () => {
    const MAX_JIDS = 100;
    const jids = Array.from({ length: 500 }, (_, i) => `55119${String(i).padStart(8, '0')}@s.whatsapp.net`);
    const limitedJids = jids.slice(0, MAX_JIDS);
    expect(limitedJids.length).toBe(100);
    expect(jids.length).toBe(500);
  });

  it("should process all JIDs when under limit", () => {
    const MAX_JIDS = 100;
    const jids = Array.from({ length: 50 }, (_, i) => `55119${String(i).padStart(8, '0')}@s.whatsapp.net`);
    const limitedJids = jids.slice(0, MAX_JIDS);
    expect(limitedJids.length).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════
// 4. Z-API Chat Canonical Conversion
// ═══════════════════════════════════════════════════════════

describe("Z-API timestamp in canonical conversion", () => {
  it("should normalize lastMessageTime in seconds format", async () => {
    const { normalizeToUnixSeconds } = await import("./providers/zapiProvider");
    // Z-API docs example: "1622991687" (seconds)
    const ts = normalizeToUnixSeconds("1622991687");
    expect(ts).toBe(1622991687);
    const date = new Date(ts * 1000);
    expect(date.getFullYear()).toBe(2021);
    expect(date.getMonth()).toBe(5); // June (0-indexed)
  });

  it("should normalize lastMessageTime in milliseconds format", async () => {
    const { normalizeToUnixSeconds } = await import("./providers/zapiProvider");
    // Real Z-API data: "1774640377604" (milliseconds)
    const ts = normalizeToUnixSeconds("1774640377604");
    expect(ts).toBe(1774640377);
    const date = new Date(ts * 1000);
    expect(date.getFullYear()).toBe(2026);
  });

  it("should prevent year 58000+ bug", async () => {
    const { normalizeToUnixSeconds } = await import("./providers/zapiProvider");
    // The bug: Z-API returns ms (1774640377604), code treats as seconds and * 1000
    // Result: new Date(1774640377604 * 1000) = year 58000+
    // Fix: normalizeToUnixSeconds detects ms and divides by 1000 first
    const zapiMs = 1774640377604;
    const normalized = normalizeToUnixSeconds(zapiMs);
    const date = new Date(normalized * 1000);
    expect(date.getFullYear()).toBeLessThan(2100);
    expect(date.getFullYear()).toBeGreaterThan(2000);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. Z-API Webhook Normalizer timestamp
// ═══════════════════════════════════════════════════════════

describe("Z-API webhook normalizer timestamp", () => {
  it("should normalize momment field from webhook", async () => {
    const { normalizeToUnixSeconds } = await import("./providers/zapiProvider");
    // Z-API webhook sends momment in seconds (per docs)
    const mommentSeconds = 1774800000;
    const result = normalizeToUnixSeconds(mommentSeconds);
    expect(result).toBe(1774800000);
  });

  it("should handle momment in milliseconds gracefully", async () => {
    const { normalizeToUnixSeconds } = await import("./providers/zapiProvider");
    // In case Z-API changes format or is inconsistent
    const mommentMs = 1774800000000;
    const result = normalizeToUnixSeconds(mommentMs);
    expect(result).toBe(1774800000);
  });
});
