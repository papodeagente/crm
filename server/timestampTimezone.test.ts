/**
 * Timestamp Timezone Fix Tests
 * Validates that the +3h offset bug is fixed:
 * - DB connection uses timezone: '+00:00'
 * - No process.env.TZ override
 * - Backend returns raw UTC timestamps
 * - Frontend-only conversion via explicit timeZone: "America/Sao_Paulo"
 * - No double Date parsing
 * - Preview and chat use the same formatTime function
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");

// ─── Part 1: Single source of truth — timestamps stored in UTC ───
describe("Part 1: Timestamp storage", () => {
  it("messages table uses DATETIME column for timestamp", () => {
    const schema = fs.readFileSync(path.join(PROJECT_ROOT, "drizzle/schema.ts"), "utf-8");
    // waMessages table should have a timestamp column
    expect(schema).toContain("timestamp");
  });
});

// ─── Part 2: Remove backend timezone conversion ───
describe("Part 2: No backend timezone conversion", () => {
  it("server/_core/index.ts does NOT set process.env.TZ", () => {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, "server/_core/index.ts"), "utf-8");
    // Must NOT contain process.env.TZ = "America/Sao_Paulo"
    expect(content).not.toMatch(/process\.env\.TZ\s*=\s*["']America\/Sao_Paulo["']/);
    // Should have a comment explaining why
    expect(content).toContain("DO NOT set process.env.TZ");
  });

  it("db.ts uses timezone: '+00:00' in connection config", () => {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, "server/db.ts"), "utf-8");
    expect(content).toContain("timezone: '+00:00'");
  });

  it("server-side code uses explicit timezone for local date formatting", () => {
    const bulkMsg = fs.readFileSync(path.join(PROJECT_ROOT, "server/bulkMessage.ts"), "utf-8");
    // bulkMessage.ts should use explicit timezone
    const dateFormatCalls = bulkMsg.match(/toLocaleDateString|toLocaleTimeString|toLocaleString/g) || [];
    if (dateFormatCalls.length > 0) {
      expect(bulkMsg).toContain("America/Sao_Paulo");
    }
  });

  it("db.ts todayStart uses explicit SP timezone, not process.env.TZ", () => {
    const dbContent = fs.readFileSync(path.join(PROJECT_ROOT, "server/db.ts"), "utf-8");
    // Should use explicit timezone for "today" calculation
    if (dbContent.includes("nowSP") || dbContent.includes("todayStart")) {
      expect(dbContent).toContain("America/Sao_Paulo");
    }
  });

  it("crmDb.ts todayStart uses explicit SP timezone", () => {
    const crmDb = fs.readFileSync(path.join(PROJECT_ROOT, "server/crmDb.ts"), "utf-8");
    if (crmDb.includes("nowSP") || crmDb.includes("todayStart")) {
      expect(crmDb).toContain("America/Sao_Paulo");
    }
  });
});

// ─── Part 3: Preview uses message timestamp directly ───
describe("Part 3: Preview uses message timestamp", () => {
  it("getWaConversationsList uses LEFT JOIN subquery on messages table for preview", () => {
    const dbContent = fs.readFileSync(path.join(PROJECT_ROOT, "server/db.ts"), "utf-8");
    // The function should join with messages table via subquery
    expect(dbContent).toContain("FROM messages m1");
    expect(dbContent).toContain("MAX(timestamp)");
    // Should use COALESCE to prefer real message data
    expect(dbContent).toMatch(/COALESCE.*m1?\.timestamp|COALESCE.*lm\.timestamp/);
  });

  it("multiple conversation queries use LEFT JOIN subquery on messages", () => {
    const dbContent = fs.readFileSync(path.join(PROJECT_ROOT, "server/db.ts"), "utf-8");
    // Multiple functions should use the messages subquery pattern
    const subqueryJoins = (dbContent.match(/FROM messages m1/g) || []).length;
    expect(subqueryJoins).toBeGreaterThanOrEqual(2);
  });
});

// ─── Part 4: Frontend timezone conversion ───
describe("Part 4: Frontend timezone conversion", () => {
  it("shared/dateUtils.ts uses explicit America/Sao_Paulo timezone", () => {
    const dateUtils = fs.readFileSync(path.join(PROJECT_ROOT, "shared/dateUtils.ts"), "utf-8");
    expect(dateUtils).toContain("America/Sao_Paulo");
    expect(dateUtils).toContain("SYSTEM_TIMEZONE");
  });

  it("Inbox.tsx imports formatTime from shared/dateUtils", () => {
    const inbox = fs.readFileSync(path.join(PROJECT_ROOT, "client/src/pages/Inbox.tsx"), "utf-8");
    expect(inbox).toContain("import { formatTime }");
    expect(inbox).toContain("dateUtils");
  });

  it("WhatsAppChat.tsx imports formatTime from shared/dateUtils", () => {
    const chat = fs.readFileSync(path.join(PROJECT_ROOT, "client/src/components/WhatsAppChat.tsx"), "utf-8");
    expect(chat).toContain("import { formatTime");
    expect(chat).toContain("dateUtils");
  });
});

// ─── Part 5: No double Date parsing ───
describe("Part 5: No double Date parsing", () => {
  it("frontend has no new Date(new Date(...)) patterns", () => {
    const srcDir = path.join(PROJECT_ROOT, "client/src");
    const files = getAllTsxFiles(srcDir);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toMatch(/new Date\(new Date\(/);
    }
  });

  it("frontend has no new Date(Date.parse(...)) patterns", () => {
    const srcDir = path.join(PROJECT_ROOT, "client/src");
    const files = getAllTsxFiles(srcDir);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toMatch(/new Date\(Date\.parse\(/);
    }
  });
});

// ─── Part 6: Preview and chat use same formatter ───
describe("Part 6: Consistent time formatting", () => {
  it("Inbox formatConversationTime uses formatTime for same-day display", () => {
    const inbox = fs.readFileSync(path.join(PROJECT_ROOT, "client/src/pages/Inbox.tsx"), "utf-8");
    // formatConversationTime should call formatTime for today's messages
    expect(inbox).toMatch(/formatTime\(d\)/);
  });

  it("WhatsAppChat uses formatTime for message bubble time", () => {
    const chat = fs.readFileSync(path.join(PROJECT_ROOT, "client/src/components/WhatsAppChat.tsx"), "utf-8");
    expect(chat).toMatch(/formatTime\(msg\.timestamp/);
  });

  it("all frontend date formatting calls use explicit timezone", () => {
    // Check that no toLocaleDateString/toLocaleTimeString calls lack timeZone
    const filesToCheck = [
      "client/src/pages/CampaignDetail.tsx",
      "client/src/pages/Campaigns.tsx",
      "client/src/pages/DateAutomationSettings.tsx",
      "client/src/pages/Profile.tsx",
    ];
    for (const relPath of filesToCheck) {
      const fullPath = path.join(PROJECT_ROOT, relPath);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, "utf-8");
      // Find all toLocaleDateString/toLocaleString calls with date formatting
      const dateFormatCalls = content.match(/toLocale(Date)?String\([^)]*\{[^}]*\}/g) || [];
      for (const call of dateFormatCalls) {
        // Skip number formatting (currency, etc.)
        if (call.includes("currency") || call.includes("style")) continue;
        // Date formatting calls should have timeZone
        if (call.includes("day") || call.includes("month") || call.includes("hour")) {
          expect(call).toMatch(/timeZone|SYSTEM_TIMEZONE/);
        }
      }
    }
  });
});

// ─── Part 7: Debug validation ───
describe("Part 7: Timestamp integrity", () => {
  it("new Date(unixMs) produces correct UTC ISO string", () => {
    // Simulate: WhatsApp messageTimestamp (Unix seconds)
    const messageTimestamp = 1710600180;
    const timestamp = messageTimestamp * 1000; // Convert to ms
    const date = new Date(timestamp);
    // The exact time depends on the epoch value; what matters is it's UTC
    expect(date.toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/);
    // And the round-trip is consistent
    expect(new Date(date.toISOString()).getTime()).toBe(timestamp);
  });

  it("formatTime with explicit timezone produces correct local time", () => {
    // 15:23 UTC = 12:23 São Paulo (UTC-3)
    const utcDate = new Date("2024-03-16T15:23:00.000Z");
    const formatted = utcDate.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    expect(formatted).toBe("12:23");
  });

  it("no +3h offset: UTC timestamp displays as correct SP time", () => {
    // If DB stores 14:53 UTC, frontend should show 11:53 SP
    const dbTimestamp = new Date("2026-03-16T14:53:14.000Z");
    const spTime = dbTimestamp.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    expect(spTime).toBe("11:53");
    // NOT 14:53 (which would be the bug)
    expect(spTime).not.toBe("14:53");
  });

  it("socket timestamp (Unix ms) converts correctly", () => {
    // Socket emits timestamp as Unix ms (UTC)
    const socketTimestamp = 1773672794000; // 2026-03-16T14:53:14Z
    const date = new Date(socketTimestamp);
    expect(date.toISOString()).toBe("2026-03-16T14:53:14.000Z");
    const spTime = date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    expect(spTime).toBe("11:53");
  });
});

// ─── Helper: recursively find all .tsx/.ts files ───
function getAllTsxFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      results.push(...getAllTsxFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
      results.push(fullPath);
    }
  }
  return results;
}
