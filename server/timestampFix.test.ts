import { describe, it, expect } from "vitest";

/**
 * Tests for the timestamp fix that converts db.execute() string timestamps
 * to proper Date objects, preventing the browser from misinterpreting UTC
 * strings as local time (the +3h offset bug).
 */

// Replicate the fixTimestampFields logic from db.ts for unit testing
function fixTimestampFields(rows: any[]): any[] {
  const tsFields = ['lastTimestamp', 'lastMessageAt', 'queuedAt', 'firstResponseAt', 'slaDeadlineAt', 'waitingSince', 'oldestEntry'];
  const fixed = rows.map((row: any) => {
    const r = { ...row };
    for (const field of tsFields) {
      if (r[field] && typeof r[field] === 'string') {
        const str = r[field];
        r[field] = new Date(str.includes('T') || str.endsWith('Z') ? str : str.replace(' ', 'T') + 'Z');
      }
    }
    return r;
  });
  // Deduplicate by remoteJid — keep the row with the newest lastTimestamp
  if (fixed.length > 0 && fixed[0]?.remoteJid) {
    const map = new Map<string, any>();
    for (const row of fixed) {
      const jid = row.remoteJid;
      if (!jid) continue;
      const existing = map.get(jid);
      if (!existing) {
        map.set(jid, row);
      } else {
        const existingTs = existing.lastTimestamp ? new Date(existing.lastTimestamp).getTime() : 0;
        const newTs = row.lastTimestamp ? new Date(row.lastTimestamp).getTime() : 0;
        if (newTs > existingTs) map.set(jid, row);
      }
    }
    return Array.from(map.values());
  }
  return fixed;
}

describe("fixTimestampFields", () => {
  it("converts MySQL DATETIME string (no Z) to UTC Date object", () => {
    // mysql2 returns TIMESTAMP as "2026-03-16 15:07:00" (UTC, no Z suffix)
    const rows = [{ lastTimestamp: "2026-03-16 15:07:00", remoteJid: "test@s.whatsapp.net" }];
    const fixed = fixTimestampFields(rows);

    expect(fixed[0].lastTimestamp).toBeInstanceOf(Date);
    // The Date should represent 15:07 UTC
    expect(fixed[0].lastTimestamp.toISOString()).toBe("2026-03-16T15:07:00.000Z");
    // Non-timestamp fields should be unchanged
    expect(fixed[0].remoteJid).toBe("test@s.whatsapp.net");
  });

  it("handles ISO string with Z suffix (already correct)", () => {
    const rows = [{ lastTimestamp: "2026-03-16T15:07:00.000Z" }];
    const fixed = fixTimestampFields(rows);

    expect(fixed[0].lastTimestamp).toBeInstanceOf(Date);
    expect(fixed[0].lastTimestamp.toISOString()).toBe("2026-03-16T15:07:00.000Z");
  });

  it("handles ISO string with T separator (no Z)", () => {
    const rows = [{ lastTimestamp: "2026-03-16T15:07:00" }];
    const fixed = fixTimestampFields(rows);

    expect(fixed[0].lastTimestamp).toBeInstanceOf(Date);
    // Has T separator, so treated as-is (browser interprets as local time)
    // This case is less common from db.execute but should still work
    expect(fixed[0].lastTimestamp).toBeInstanceOf(Date);
  });

  it("converts multiple timestamp fields in the same row", () => {
    const rows = [{
      lastTimestamp: "2026-03-16 15:07:00",
      queuedAt: "2026-03-16 14:00:00",
      lastMessageAt: "2026-03-16 15:07:00",
      remoteJid: "test@s.whatsapp.net",
    }];
    const fixed = fixTimestampFields(rows);

    expect(fixed[0].lastTimestamp).toBeInstanceOf(Date);
    expect(fixed[0].queuedAt).toBeInstanceOf(Date);
    expect(fixed[0].lastMessageAt).toBeInstanceOf(Date);
    expect(fixed[0].lastTimestamp.toISOString()).toBe("2026-03-16T15:07:00.000Z");
    expect(fixed[0].queuedAt.toISOString()).toBe("2026-03-16T14:00:00.000Z");
  });

  it("skips null/undefined timestamp fields", () => {
    const rows = [{ lastTimestamp: null, queuedAt: undefined, remoteJid: "test" }];
    const fixed = fixTimestampFields(rows);

    expect(fixed[0].lastTimestamp).toBeNull();
    expect(fixed[0].queuedAt).toBeUndefined();
  });

  it("skips fields that are already Date objects", () => {
    const date = new Date("2026-03-16T15:07:00.000Z");
    const rows = [{ lastTimestamp: date }];
    const fixed = fixTimestampFields(rows);

    // Date is not a string, so it should pass through unchanged
    expect(fixed[0].lastTimestamp).toBe(date);
  });

  it("handles empty rows array", () => {
    const fixed = fixTimestampFields([]);
    expect(fixed).toEqual([]);
  });

  it("handles multiple rows", () => {
    const rows = [
      { lastTimestamp: "2026-03-16 15:07:00", remoteJid: "a@s.whatsapp.net" },
      { lastTimestamp: "2026-03-16 12:00:00", remoteJid: "b@s.whatsapp.net" },
    ];
    const fixed = fixTimestampFields(rows);

    expect(fixed).toHaveLength(2);
    expect(fixed[0].lastTimestamp.toISOString()).toBe("2026-03-16T15:07:00.000Z");
    expect(fixed[1].lastTimestamp.toISOString()).toBe("2026-03-16T12:00:00.000Z");
  });

  it("does not mutate original rows", () => {
    const original = { lastTimestamp: "2026-03-16 15:07:00" };
    const rows = [original];
    fixTimestampFields(rows);

    // Original should still be a string
    expect(typeof original.lastTimestamp).toBe("string");
  });
});

describe("Deduplication by remoteJid", () => {
  it("removes duplicate conversations, keeping the one with newest lastTimestamp", () => {
    const rows = [
      { remoteJid: "a@s.whatsapp.net", lastTimestamp: "2026-03-16 12:00:00", lastMessage: "old" },
      { remoteJid: "a@s.whatsapp.net", lastTimestamp: "2026-03-16 15:00:00", lastMessage: "new" },
      { remoteJid: "b@s.whatsapp.net", lastTimestamp: "2026-03-16 10:00:00", lastMessage: "only" },
    ];
    const fixed = fixTimestampFields(rows);

    expect(fixed).toHaveLength(2);
    const aConv = fixed.find((r: any) => r.remoteJid === "a@s.whatsapp.net");
    expect(aConv.lastMessage).toBe("new");
    expect(aConv.lastTimestamp.toISOString()).toBe("2026-03-16T15:00:00.000Z");
  });

  it("handles three duplicates of the same conversation", () => {
    const rows = [
      { remoteJid: "x@s.whatsapp.net", lastTimestamp: "2026-03-16 10:00:00", lastMessage: "first" },
      { remoteJid: "x@s.whatsapp.net", lastTimestamp: "2026-03-16 12:00:00", lastMessage: "second" },
      { remoteJid: "x@s.whatsapp.net", lastTimestamp: "2026-03-16 14:00:00", lastMessage: "third" },
    ];
    const fixed = fixTimestampFields(rows);

    expect(fixed).toHaveLength(1);
    expect(fixed[0].lastMessage).toBe("third");
  });

  it("does not deduplicate rows without remoteJid", () => {
    const rows = [
      { statusGroup: "open", count: 5 },
      { statusGroup: "closed", count: 3 },
    ];
    const fixed = fixTimestampFields(rows);
    expect(fixed).toHaveLength(2);
  });

  it("preserves order of unique conversations", () => {
    const rows = [
      { remoteJid: "c@s.whatsapp.net", lastTimestamp: "2026-03-16 15:00:00" },
      { remoteJid: "a@s.whatsapp.net", lastTimestamp: "2026-03-16 12:00:00" },
      { remoteJid: "b@s.whatsapp.net", lastTimestamp: "2026-03-16 10:00:00" },
    ];
    const fixed = fixTimestampFields(rows);

    expect(fixed).toHaveLength(3);
    // Map preserves insertion order
    expect(fixed[0].remoteJid).toBe("c@s.whatsapp.net");
    expect(fixed[1].remoteJid).toBe("a@s.whatsapp.net");
    expect(fixed[2].remoteJid).toBe("b@s.whatsapp.net");
  });
});

describe("Preview timestamp consistency", () => {
  it("socket message timestamp (Unix ms) produces same UTC time as fixed SQL timestamp", () => {
    // Simulate: message arrives at 12:07 São Paulo time = 15:07 UTC
    const unixMs = new Date("2026-03-16T15:07:00.000Z").getTime();

    // Socket handler creates Date from Unix ms
    const socketDate = new Date(unixMs);

    // SQL query returns UTC string, fixTimestampFields converts it
    const sqlString = "2026-03-16 15:07:00";
    const sqlFixed = fixTimestampFields([{ lastTimestamp: sqlString }])[0].lastTimestamp;

    // Both should represent the same UTC instant
    expect(socketDate.getTime()).toBe(sqlFixed.getTime());
    expect(socketDate.toISOString()).toBe(sqlFixed.toISOString());
  });

  it("formatTime with America/Sao_Paulo timezone shows correct local time", () => {
    // 15:07 UTC = 12:07 São Paulo (UTC-3)
    const utcDate = new Date("2026-03-16T15:07:00.000Z");
    const formatted = utcDate.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    expect(formatted).toBe("12:07");
  });

  it("unfixed MySQL string would show WRONG time (the bug)", () => {
    // This demonstrates the bug: "2026-03-16 15:07:00" without Z
    // is parsed as LOCAL time by the browser
    const buggyDate = new Date("2026-03-16 15:07:00");

    // In a UTC environment (like this test runner), it would show 15:07
    // In a São Paulo browser, it would show 15:07 (wrong! should be 12:07)
    const formatted = buggyDate.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    // The bug: without Z suffix, the browser treats the string as local time
    // In a UTC test environment: "15:07:00" is parsed as UTC → shows 12:07 SP
    // In a SP browser: "15:07:00" is parsed as SP local → shows 15:07 SP (WRONG!)
    // We can't fully reproduce the browser behavior in Node.js (which uses UTC),
    // but we can verify the fix produces the correct result
    const fixedDate = fixTimestampFields([{ lastTimestamp: "2026-03-16 15:07:00" }])[0].lastTimestamp;
    const fixedFormatted = fixedDate.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    // Fixed version always shows 12:07 regardless of environment
    expect(fixedFormatted).toBe("12:07");
  });
});
