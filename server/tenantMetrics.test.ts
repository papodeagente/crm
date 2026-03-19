import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for getTenantMetricsAdmin function.
 * We mock the database layer to verify the aggregation logic.
 */

// Mock db module
const mockExecute = vi.fn();
vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    execute: mockExecute,
  })),
}));

import { getTenantMetricsAdmin, type TenantMetrics } from "./saasAuth";

describe("getTenantMetricsAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when db is unavailable", async () => {
    const { getDb } = await import("./db");
    (getDb as any).mockResolvedValueOnce(null);

    const result = await getTenantMetricsAdmin();
    expect(result).toEqual([]);
  });

  it("returns metrics for multiple tenants", async () => {
    mockExecute.mockResolvedValueOnce([
      [
        {
          tenantId: 1,
          dealsOpen: "5",
          dealsTotal: "20",
          contactsTotal: "150",
          connectedCount: "2",
          wonThisMonthCents: "500000",
        },
        {
          tenantId: 2,
          dealsOpen: "0",
          dealsTotal: "3",
          contactsTotal: "10",
          connectedCount: "0",
          wonThisMonthCents: "0",
        },
      ],
    ]);

    const result = await getTenantMetricsAdmin();

    expect(result).toHaveLength(2);

    expect(result[0]).toEqual({
      tenantId: 1,
      dealsOpen: 5,
      dealsTotal: 20,
      contactsTotal: 150,
      whatsappConnected: true,
      wonThisMonthCents: 500000,
    });

    expect(result[1]).toEqual({
      tenantId: 2,
      dealsOpen: 0,
      dealsTotal: 3,
      contactsTotal: 10,
      whatsappConnected: false,
      wonThisMonthCents: 0,
    });
  });

  it("handles tenants with no data (all zeros)", async () => {
    mockExecute.mockResolvedValueOnce([
      [
        {
          tenantId: 99,
          dealsOpen: "0",
          dealsTotal: "0",
          contactsTotal: "0",
          connectedCount: "0",
          wonThisMonthCents: "0",
        },
      ],
    ]);

    const result = await getTenantMetricsAdmin();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      tenantId: 99,
      dealsOpen: 0,
      dealsTotal: 0,
      contactsTotal: 0,
      whatsappConnected: false,
      wonThisMonthCents: 0,
    });
  });

  it("converts string values from SQL to numbers", async () => {
    mockExecute.mockResolvedValueOnce([
      [
        {
          tenantId: "42",
          dealsOpen: "15",
          dealsTotal: "100",
          contactsTotal: "999",
          connectedCount: "1",
          wonThisMonthCents: "1234567",
        },
      ],
    ]);

    const result = await getTenantMetricsAdmin();

    expect(result[0].tenantId).toBe(42);
    expect(result[0].dealsOpen).toBe(15);
    expect(result[0].dealsTotal).toBe(100);
    expect(result[0].contactsTotal).toBe(999);
    expect(result[0].whatsappConnected).toBe(true);
    expect(result[0].wonThisMonthCents).toBe(1234567);
  });

  it("returns empty array when query returns no rows", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const result = await getTenantMetricsAdmin();
    expect(result).toEqual([]);
  });

  it("handles null/undefined in first element of result", async () => {
    mockExecute.mockResolvedValueOnce([undefined]);

    const result = await getTenantMetricsAdmin();
    expect(result).toEqual([]);
  });
});

describe("TenantMetrics type", () => {
  it("has the correct shape", () => {
    const metrics: TenantMetrics = {
      tenantId: 1,
      dealsOpen: 5,
      dealsTotal: 20,
      contactsTotal: 150,
      whatsappConnected: true,
      wonThisMonthCents: 500000,
    };

    expect(metrics.tenantId).toBeTypeOf("number");
    expect(metrics.dealsOpen).toBeTypeOf("number");
    expect(metrics.dealsTotal).toBeTypeOf("number");
    expect(metrics.contactsTotal).toBeTypeOf("number");
    expect(metrics.whatsappConnected).toBeTypeOf("boolean");
    expect(metrics.wonThisMonthCents).toBeTypeOf("number");
  });
});

describe("formatCurrency (frontend helper)", () => {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  };

  it("formats zero correctly", () => {
    expect(formatCurrency(0)).toContain("0,00");
  });

  it("formats large values correctly", () => {
    const result = formatCurrency(1500000);
    expect(result).toContain("15.000,00");
  });

  it("formats small values correctly", () => {
    const result = formatCurrency(9990);
    expect(result).toContain("99,90");
  });
});

describe("formatCompact (frontend helper)", () => {
  const formatCompact = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return String(n);
  };

  it("returns raw number for values under 1000", () => {
    expect(formatCompact(0)).toBe("0");
    expect(formatCompact(999)).toBe("999");
  });

  it("formats thousands with k suffix", () => {
    expect(formatCompact(1000)).toBe("1k");
    expect(formatCompact(1500)).toBe("1.5k");
    expect(formatCompact(10000)).toBe("10k");
    expect(formatCompact(15300)).toBe("15.3k");
  });
});
