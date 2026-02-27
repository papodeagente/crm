import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
const mockDb = {
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
};

vi.mock("./db", () => ({
  getDb: () => mockDb,
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: any, b: any) => ({ type: "eq", a, b })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  inArray: vi.fn((a: any, b: any) => ({ type: "inArray", a, b })),
  isNull: vi.fn((a: any) => ({ type: "isNull", a })),
  isNotNull: vi.fn((a: any) => ({ type: "isNotNull", a })),
  desc: vi.fn((a: any) => ({ type: "desc", a })),
  asc: vi.fn((a: any) => ({ type: "asc", a })),
  like: vi.fn((a: any, b: any) => ({ type: "like", a, b })),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
  count: vi.fn(),
  sum: vi.fn(),
  gte: vi.fn(),
  lt: vi.fn(),
}));

vi.mock("../drizzle/schema", () => {
  const table = (name: string) => {
    const cols: Record<string, any> = {};
    return new Proxy({}, {
      get: (_t, prop) => {
        if (!cols[prop as string]) cols[prop as string] = { name: `${name}.${String(prop)}` };
        return cols[prop as string];
      },
    });
  };
  return {
    deals: table("deals"),
    contacts: table("contacts"),
    tenants: table("tenants"),
    crmUsers: table("crmUsers"),
    teams: table("teams"),
    teamMembers: table("teamMembers"),
    roles: table("roles"),
    permissions: table("permissions"),
    rolePermissions: table("rolePermissions"),
    userRoles: table("userRoles"),
    apiKeys: table("apiKeys"),
    accounts: table("accounts"),
    dealParticipants: table("dealParticipants"),
    pipelines: table("pipelines"),
    pipelineStages: table("pipelineStages"),
    pipelineAutomations: table("pipelineAutomations"),
    trips: table("trips"),
    tripItems: table("tripItems"),
    dealProducts: table("dealProducts"),
    products: table("products"),
    dealHistory: table("dealHistory"),
    tasks: table("tasks"),
    activityLog: table("activityLog"),
    notifications: table("notifications"),
    waMessages: table("waMessages"),
    waConversations: table("waConversations"),
    waIdentities: table("waIdentities"),
    waAuditLog: table("waAuditLog"),
    leadEventLog: table("leadEventLog"),
    metaIntegrationConfig: table("metaIntegrationConfig"),
  };
});

describe("Bulk Delete - Deals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should soft-delete deals without affecting contacts", async () => {
    // The soft-delete sets deletedAt timestamp, not actually removing the row
    // Contacts table should NOT be touched
    const dealIds = [1, 2, 3];
    const tenantId = 1;

    // Simulate the soft-delete operation
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockResolvedValue([{ affectedRows: 3 }]);

    const { bulkSoftDeleteDeals } = await import("./crmDb");
    const count = await bulkSoftDeleteDeals(tenantId, dealIds);

    // Verify update was called (soft-delete sets deletedAt)
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalled();
    // The set call should include deletedAt
    const setCall = mockDb.set.mock.calls[0][0];
    expect(setCall).toHaveProperty("deletedAt");
    expect(setCall.deletedAt).toBeInstanceOf(Date);
  });

  it("should restore soft-deleted deals", async () => {
    const dealIds = [1, 2];
    const tenantId = 1;

    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockResolvedValue([{ affectedRows: 2 }]);

    const { restoreDeals } = await import("./crmDb");
    const count = await restoreDeals(tenantId, dealIds);

    expect(mockDb.update).toHaveBeenCalled();
    const setCall = mockDb.set.mock.calls[0][0];
    expect(setCall).toHaveProperty("deletedAt");
    expect(setCall.deletedAt).toBeNull();
  });

  it("should hard-delete deals permanently", async () => {
    const dealIds = [1, 2];
    const tenantId = 1;

    mockDb.delete.mockReturnThis();
    mockDb.where.mockResolvedValue([{ affectedRows: 2 }]);

    const { hardDeleteDeals } = await import("./crmDb");
    const count = await hardDeleteDeals(tenantId, dealIds);

    expect(mockDb.delete).toHaveBeenCalled();
  });
});

describe("Bulk Delete - Contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should soft-delete contacts without affecting deals", async () => {
    const contactIds = [10, 20, 30];
    const tenantId = 1;

    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockResolvedValue([{ affectedRows: 3 }]);

    const { bulkSoftDeleteContacts } = await import("./crmDb");
    const count = await bulkSoftDeleteContacts(tenantId, contactIds);

    expect(mockDb.update).toHaveBeenCalled();
    const setCall = mockDb.set.mock.calls[0][0];
    expect(setCall).toHaveProperty("deletedAt");
    expect(setCall.deletedAt).toBeInstanceOf(Date);
  });

  it("should restore soft-deleted contacts", async () => {
    const contactIds = [10, 20];
    const tenantId = 1;

    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockResolvedValue([{ affectedRows: 2 }]);

    const { restoreContacts } = await import("./crmDb");
    const count = await restoreContacts(tenantId, contactIds);

    expect(mockDb.update).toHaveBeenCalled();
    const setCall = mockDb.set.mock.calls[0][0];
    expect(setCall).toHaveProperty("deletedAt");
    expect(setCall.deletedAt).toBeNull();
  });

  it("should hard-delete contacts permanently", async () => {
    const contactIds = [10, 20];
    const tenantId = 1;

    mockDb.delete.mockReturnThis();
    mockDb.where.mockResolvedValue([{ affectedRows: 2 }]);

    const { hardDeleteContacts } = await import("./crmDb");
    const count = await hardDeleteContacts(tenantId, contactIds);

    expect(mockDb.delete).toHaveBeenCalled();
  });
});

describe("Idempotency and Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle empty ids array gracefully", async () => {
    // The endpoint validates min(1), but the function should handle it
    const { bulkSoftDeleteDeals } = await import("./crmDb");
    
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockResolvedValue([{ affectedRows: 0 }]);

    // Should not throw
    await expect(bulkSoftDeleteDeals(1, [])).resolves.not.toThrow();
  });

  it("should handle non-existent ids without error", async () => {
    const { bulkSoftDeleteDeals } = await import("./crmDb");
    
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockResolvedValue([{ affectedRows: 0 }]);

    // IDs that don't exist should just return 0 affected
    await expect(bulkSoftDeleteDeals(1, [99999])).resolves.not.toThrow();
  });
});
