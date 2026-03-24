/**
 * Tests for Rate Exceeded fix — concurrency limiter + reduced polling intervals
 */
import { describe, it, expect } from "vitest";

describe("Evolution API Concurrency Limiter", () => {
  it("getEvoConcurrencyStats returns expected shape", async () => {
    const { getEvoConcurrencyStats } = await import("./evolutionApi");
    const stats = getEvoConcurrencyStats();
    expect(stats).toHaveProperty("active");
    expect(stats).toHaveProperty("queued");
    expect(typeof stats.active).toBe("number");
    expect(typeof stats.queued).toBe("number");
    expect(stats.active).toBeGreaterThanOrEqual(0);
    expect(stats.queued).toBeGreaterThanOrEqual(0);
  });

  it("concurrency stats start at zero when idle", async () => {
    const { getEvoConcurrencyStats } = await import("./evolutionApi");
    const stats = getEvoConcurrencyStats();
    // At test start, no requests should be in flight
    expect(stats.active).toBe(0);
    expect(stats.queued).toBe(0);
  });
});

describe("Polling interval configuration", () => {
  it("FastPoll interval is 60s (not 30s)", async () => {
    // Verify the index.ts calls startFastPoll with 60 * 1000
    const fs = await import("fs");
    const content = fs.readFileSync("server/_core/index.ts", "utf-8");
    expect(content).toContain("startFastPoll(60 * 1000)");
    expect(content).not.toContain("startFastPoll(30 * 1000)");
  });

  it("PeriodicSync interval is 10 minutes (not 5)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/_core/index.ts", "utf-8");
    expect(content).toContain("startPeriodicSync(10 * 60 * 1000)");
    expect(content).not.toContain("startPeriodicSync(5 * 60 * 1000)");
  });

  it("Reconciliation interval is 10 minutes", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/messageReconciliation.ts", "utf-8");
    expect(content).toContain("RECONCILIATION_INTERVAL_MS = 10 * 60 * 1000");
  });

  it("Reconciliation max conversations is 5", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/messageReconciliation.ts", "utf-8");
    expect(content).toContain("MAX_CONVERSATIONS_PER_CYCLE = 5");
  });

  it("FastPoll checks top 8 chats (not 15)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/whatsappEvolution.ts", "utf-8");
    expect(content).toContain("individualChats.slice(0, 8)");
    expect(content).not.toContain("individualChats.slice(0, 15)");
  });

  it("QuickSync processes max 25 chats (not 50)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/whatsappEvolution.ts", "utf-8");
    expect(content).toContain("MAX_CHATS = 25");
    expect(content).not.toContain("MAX_CHATS = 50");
  });

  it("PeriodicSync minimum gap is 8 minutes", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/whatsappEvolution.ts", "utf-8");
    expect(content).toContain("8 * 60 * 1000");
    // Should not have old 4 min gap
    expect(content).not.toMatch(/now - lastSync > 4 \* 60 \* 1000/);
  });
});

describe("Frontend rate limit protection", () => {
  it("refetchOnWindowFocus is disabled globally", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/main.tsx", "utf-8");
    expect(content).toContain("refetchOnWindowFocus: false");
  });

  it("refetchOnReconnect is disabled globally", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/main.tsx", "utf-8");
    expect(content).toContain("refetchOnReconnect: false");
  });

  it("MAX_RETRIES is reduced to 2", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/evolutionApi.ts", "utf-8");
    expect(content).toContain("MAX_RETRIES = 2");
    expect(content).not.toContain("MAX_RETRIES = 3");
  });

  it("BASE_DELAY_MS is increased to 1500", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/evolutionApi.ts", "utf-8");
    expect(content).toContain("BASE_DELAY_MS = 1500");
    expect(content).not.toContain("BASE_DELAY_MS = 1000");
  });
});
