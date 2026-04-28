import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getDb and sql
const mockExecute = vi.fn();
vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    execute: mockExecute,
  })),
  createNotification: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
}));

import { purgeExpiredTrashItems, PURGE_AFTER_DAYS } from "./trashAutoPurgeScheduler";

describe("Trash Auto-Purge Scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export PURGE_AFTER_DAYS as 30", () => {
    expect(PURGE_AFTER_DAYS).toBe(30);
  });

  it("should purge expired deals and contacts", async () => {
    mockExecute
      .mockResolvedValueOnce([{ affectedRows: 5 }]) // deals
      .mockResolvedValueOnce([{ affectedRows: 3 }]); // contacts

    const result = await purgeExpiredTrashItems();

    expect(result.purgedDeals).toBe(5);
    expect(result.purgedContacts).toBe(3);
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("should return zeros when no items to purge", async () => {
    mockExecute
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);

    const result = await purgeExpiredTrashItems();

    expect(result.purgedDeals).toBe(0);
    expect(result.purgedContacts).toBe(0);
  });

  it("should return zeros when db is null", async () => {
    const { getDb } = await import("./db");
    (getDb as any).mockResolvedValueOnce(null);

    const result = await purgeExpiredTrashItems();

    expect(result.purgedDeals).toBe(0);
    expect(result.purgedContacts).toBe(0);
  });

  it("should handle database errors gracefully", async () => {
    mockExecute.mockRejectedValueOnce(new Error("DB error"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await purgeExpiredTrashItems();

    expect(result.purgedDeals).toBe(0);
    expect(result.purgedContacts).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[TrashAutoPurge] Error during purge:",
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it("should execute DELETE queries for both deals and contacts", async () => {
    mockExecute
      .mockResolvedValueOnce([{ affectedRows: 2 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    await purgeExpiredTrashItems();

    // First call: deals DELETE
    const firstCall = mockExecute.mock.calls[0][0];
    expect(firstCall.strings.join("")).toContain("DELETE FROM deals");

    // Second call: contacts DELETE
    const secondCall = mockExecute.mock.calls[1][0];
    expect(secondCall.strings.join("")).toContain("DELETE FROM contacts");
  });
});
