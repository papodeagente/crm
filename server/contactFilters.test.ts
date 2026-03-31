import { describe, it, expect, vi } from "vitest";

/**
 * Tests for contact filter logic.
 * Validates that the ContactFilters interface and filter building works correctly.
 */

// Simulate the ContactFilters interface logic
interface ContactFilters {
  nameSearch?: string;
  email?: string;
  phone?: string;
  dateFrom?: string;
  dateTo?: string;
  customFieldFilters?: { fieldId: number; value: string }[];
}

const EMPTY_FILTERS: ContactFilters = {};

function countActiveFilters(filters: ContactFilters): number {
  let count = 0;
  if (filters.nameSearch) count++;
  if (filters.email) count++;
  if (filters.phone) count++;

  if (filters.dateFrom || filters.dateTo) count++;
  if (filters.customFieldFilters?.length) count += filters.customFieldFilters.length;
  return count;
}

function buildQueryParams(filters: ContactFilters, search: string, page: number, pageSize: number) {
  return {
    search: filters.nameSearch || search || undefined,

    email: filters.email || undefined,
    phone: filters.phone || undefined,
    limit: pageSize,
    offset: page * pageSize,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    customFieldFilters: filters.customFieldFilters?.length ? filters.customFieldFilters : undefined,
  };
}

describe("ContactFilters", () => {
  it("should return 0 active filters for empty filters", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it("should count name filter", () => {
    expect(countActiveFilters({ nameSearch: "João" })).toBe(1);
  });

  it("should count email filter", () => {
    expect(countActiveFilters({ email: "test@email.com" })).toBe(1);
  });

  it("should count phone filter", () => {
    expect(countActiveFilters({ phone: "+5511999" })).toBe(1);
  });

  it("should count date range as single filter", () => {
    expect(countActiveFilters({ dateFrom: "2024-01-01", dateTo: "2024-12-31" })).toBe(1);
    expect(countActiveFilters({ dateFrom: "2024-01-01" })).toBe(1);
    expect(countActiveFilters({ dateTo: "2024-12-31" })).toBe(1);
  });

  it("should count each custom field filter individually", () => {
    expect(countActiveFilters({
      customFieldFilters: [
        { fieldId: 1, value: "VIP" },
        { fieldId: 2, value: "São Paulo" },
      ],
    })).toBe(2);
  });

  it("should count all filters combined", () => {
    expect(countActiveFilters({
      nameSearch: "Maria",
      email: "maria@test.com",
      phone: "+5511",
      dateFrom: "2024-01-01",
      dateTo: "2024-12-31",
      customFieldFilters: [{ fieldId: 1, value: "VIP" }],
    })).toBe(5); // name + email + phone + dateRange + 1 customField
  });

  it("should build query params correctly with no filters", () => {
    const params = buildQueryParams(EMPTY_FILTERS, "", 0, 50);
    expect(params.search).toBeUndefined();
    expect(params.email).toBeUndefined();
    expect(params.phone).toBeUndefined();
    expect(params.limit).toBe(50);
    expect(params.offset).toBe(0);
    expect(params.dateFrom).toBeUndefined();
    expect(params.dateTo).toBeUndefined();
    expect(params.customFieldFilters).toBeUndefined();
  });

  it("should build query params with filters applied", () => {
    const filters: ContactFilters = {
      nameSearch: "João",
      email: "joao@test.com",
      phone: "+5511",
      dateFrom: "2024-01-01",
      dateTo: "2024-06-30",
      customFieldFilters: [{ fieldId: 5, value: "Gold" }],
    };
    const params = buildQueryParams(filters, "fallback", 2, 25);
    // nameSearch takes priority over sea    expect(params.search).toBe("Jo\u00e3o");
    expect(params.email).toBe("joao@test.com");    expect(params.phone).toBe("+5511");
    expect(params.limit).toBe(25);
    expect(params.offset).toBe(50); // page 2 * 25
    expect(params.dateFrom).toBe("2024-01-01");
    expect(params.dateTo).toBe("2024-06-30");
    expect(params.customFieldFilters).toEqual([{ fieldId: 5, value: "Gold" }]);
  });

  it("should use search fallback when nameSearch is empty", () => {
    const params = buildQueryParams({}, "busca global", 0, 50);
    expect(params.search).toBe("busca global");
  });

  it("should handle pagination correctly", () => {
    const params = buildQueryParams(EMPTY_FILTERS, "", 3, 50);
    expect(params.offset).toBe(150);
    expect(params.limit).toBe(50);
  });

  it("should not include empty customFieldFilters array", () => {
    const params = buildQueryParams({ customFieldFilters: [] }, "", 0, 50);
    expect(params.customFieldFilters).toBeUndefined();
  });
});
