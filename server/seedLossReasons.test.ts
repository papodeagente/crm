import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_LOSS_REASONS, seedDefaultLossReasons } from "./seedLossReasons";

// Mock the database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
};

vi.mock("./db", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("../drizzle/schema", () => ({
  lossReasons: {
    tenantId: "tenantId",
    name: "name",
  },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => ({ type: "eq", args })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Setup select chain: db.select({ name }).from(lossReasons).where(eq(...))
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  // Setup insert chain: db.insert(lossReasons).values([...])
  mockInsert.mockReturnValue({ values: mockValues });
});

describe("seedDefaultLossReasons", () => {
  it("exports exactly 15 default loss reasons", () => {
    expect(DEFAULT_LOSS_REASONS).toHaveLength(15);
  });

  it("each default reason has name and description", () => {
    for (const r of DEFAULT_LOSS_REASONS) {
      expect(typeof r.name).toBe("string");
      expect(r.name.length).toBeGreaterThan(0);
      expect(typeof r.description).toBe("string");
      expect(r.description.length).toBeGreaterThan(0);
    }
  });

  it("all default reason names are unique", () => {
    const names = DEFAULT_LOSS_REASONS.map((r) => r.name.toLowerCase().trim());
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("inserts all 15 reasons when tenant has none", async () => {
    mockWhere.mockResolvedValue([]); // no existing reasons
    mockValues.mockResolvedValue(undefined);

    const count = await seedDefaultLossReasons(999);

    expect(count).toBe(15);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledTimes(1);

    // Verify the values passed to insert
    const insertedValues = mockValues.mock.calls[0][0];
    expect(insertedValues).toHaveLength(15);
    for (const v of insertedValues) {
      expect(v.tenantId).toBe(999);
      expect(typeof v.name).toBe("string");
      expect(typeof v.description).toBe("string");
    }
  });

  it("inserts nothing when all 15 reasons already exist", async () => {
    // Simulate all 15 already existing
    mockWhere.mockResolvedValue(
      DEFAULT_LOSS_REASONS.map((r) => ({ name: r.name }))
    );

    const count = await seedDefaultLossReasons(999);

    expect(count).toBe(0);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("is idempotent: only inserts missing reasons", async () => {
    // Simulate 3 already existing
    mockWhere.mockResolvedValue([
      { name: "Orçamento incompatível" },
      { name: "Prioridade adiada" },
      { name: "Data inviável" },
    ]);
    mockValues.mockResolvedValue(undefined);

    const count = await seedDefaultLossReasons(999);

    expect(count).toBe(12); // 15 - 3 = 12
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertedValues = mockValues.mock.calls[0][0];
    expect(insertedValues).toHaveLength(12);

    // Verify none of the existing ones are re-inserted
    const insertedNames = insertedValues.map((v: any) => v.name);
    expect(insertedNames).not.toContain("Orçamento incompatível");
    expect(insertedNames).not.toContain("Prioridade adiada");
    expect(insertedNames).not.toContain("Data inviável");
  });

  it("matching is case-insensitive", async () => {
    mockWhere.mockResolvedValue([
      { name: "ORÇAMENTO INCOMPATÍVEL" },
      { name: "prioridade adiada" },
    ]);
    mockValues.mockResolvedValue(undefined);

    const count = await seedDefaultLossReasons(999);

    expect(count).toBe(13); // 15 - 2 = 13
  });

  it("sets correct tenantId on all inserted records", async () => {
    mockWhere.mockResolvedValue([]);
    mockValues.mockResolvedValue(undefined);

    await seedDefaultLossReasons(42);

    const insertedValues = mockValues.mock.calls[0][0];
    for (const v of insertedValues) {
      expect(v.tenantId).toBe(42);
    }
  });

  it("does not set any special flags (records are normal and editable)", async () => {
    mockWhere.mockResolvedValue([]);
    mockValues.mockResolvedValue(undefined);

    await seedDefaultLossReasons(1);

    const insertedValues = mockValues.mock.calls[0][0];
    for (const v of insertedValues) {
      // Should only have tenantId, name, description — no isProtected, isSystem, etc.
      const keys = Object.keys(v);
      expect(keys).toContain("tenantId");
      expect(keys).toContain("name");
      expect(keys).toContain("description");
      expect(keys).not.toContain("isProtected");
      expect(keys).not.toContain("isSystem");
      expect(keys).not.toContain("isDefault");
      expect(keys).not.toContain("isLocked");
    }
  });
});
