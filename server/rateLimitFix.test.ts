/**
 * Tests para o ciclo de catch-up de mensagens.
 *
 * [F6] As 3 mecânicas legadas (fastPoll, periodicSync, reconciliation) foram
 * desativadas no boot porque dependiam de findMessages (que virou no-op em F5
 * — Z-API multi-device não expõe /chat-messages). Webhooks são a única fonte
 * de mensagens novas em produção.
 */
import { describe, it, expect } from "vitest";

describe("[F6] Catch-up legado desativado no boot", () => {
  it("_core/index.ts NÃO chama mais startFastPoll", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/_core/index.ts", "utf-8");
    expect(content).not.toMatch(/whatsappManager\.startFastPoll\(/);
  });
  it("_core/index.ts NÃO chama mais startPeriodicSync", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/_core/index.ts", "utf-8");
    expect(content).not.toMatch(/whatsappManager\.startPeriodicSync\(/);
  });
  it("_core/index.ts NÃO chama mais startReconciliation", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/_core/index.ts", "utf-8");
    expect(content).not.toMatch(/startReconciliation\(/);
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
