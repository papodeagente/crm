/**
 * Tests for Rate Exceeded fix — reduced polling intervals & frontend protection
 * Evolution API has been removed; Z-API is the only provider.
 */
import { describe, it, expect } from "vitest";

describe("Polling interval configuration", () => {
  it("FastPoll interval is 60s (not 30s)", async () => {
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
});
