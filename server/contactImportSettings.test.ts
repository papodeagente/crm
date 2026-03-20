import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("Contact Import Settings", () => {
  // ─── Procedure existence checks ───

  it("getContactImportSettings procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.whatsapp.getContactImportSettings).toBe("function");
  });

  it("saveContactImportSettings procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.whatsapp.saveContactImportSettings).toBe("function");
  });

  it("cleanupSyncedContacts procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.whatsapp.cleanupSyncedContacts).toBe("function");
  });

  // ─── getContactImportSettings ───

  it("getContactImportSettings returns importContactsFromAgenda field", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.getContactImportSettings({ tenantId: 150002 });
    expect(result).toBeDefined();
    expect(typeof result.importContactsFromAgenda).toBe("boolean");
  });

  it("getContactImportSettings defaults to false for new tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Tenant 99999 likely doesn't exist, should return default false
    const result = await caller.whatsapp.getContactImportSettings({ tenantId: 99999 });
    expect(result.importContactsFromAgenda).toBe(false);
  });

  // ─── saveContactImportSettings ───

  it("saveContactImportSettings saves and returns success", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.saveContactImportSettings({
      tenantId: 150002,
      importContactsFromAgenda: false,
    });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("saveContactImportSettings persists the setting correctly", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Read current value first to restore later
    const original = await caller.whatsapp.getContactImportSettings({ tenantId: 150002 });

    // Save as true
    await caller.whatsapp.saveContactImportSettings({
      tenantId: 150002,
      importContactsFromAgenda: true,
    });

    // Read back
    const result = await caller.whatsapp.getContactImportSettings({ tenantId: 150002 });
    expect(result.importContactsFromAgenda).toBe(true);

    // Restore to original value
    await caller.whatsapp.saveContactImportSettings({
      tenantId: 150002,
      importContactsFromAgenda: original.importContactsFromAgenda,
    });

    // Verify restored
    const restored = await caller.whatsapp.getContactImportSettings({ tenantId: 150002 });
    expect(restored.importContactsFromAgenda).toBe(original.importContactsFromAgenda);
  });

  // ─── cleanupSyncedContacts ───

  it("cleanupSyncedContacts dry run returns expected shape", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.cleanupSyncedContacts({
      tenantId: 150002,
      dryRun: true,
    });
    expect(result).toBeDefined();
    expect(result.dryRun).toBe(true);
    expect(typeof result.contactsToDelete).toBe("number");
    expect(result.contactsToDelete).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.sample)).toBe(true);
  });

  it("cleanupSyncedContacts dry run sample has correct shape", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.cleanupSyncedContacts({
      tenantId: 150002,
      dryRun: true,
    });
    // If there are contacts to delete, verify sample shape
    if (result.sample && (result.sample as any[]).length > 0) {
      const sample = result.sample as Array<{ id: number; name: string; phone: string }>;
      for (const item of sample) {
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("name");
        expect(item).toHaveProperty("phone");
      }
    }
  });

  it("cleanupSyncedContacts dry run returns max 20 samples", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.cleanupSyncedContacts({
      tenantId: 150002,
      dryRun: true,
    });
    expect((result.sample as any[]).length).toBeLessThanOrEqual(20);
  });

  it("cleanupSyncedContacts returns zero for nonexistent tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.cleanupSyncedContacts({
      tenantId: 99999,
      dryRun: true,
    });
    expect(result.contactsToDelete).toBe(0);
    expect((result.sample as any[]).length).toBe(0);
  });

  it("cleanupSyncedContacts actual delete returns contactsDeleted count", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // First do a dry run to see how many would be deleted
    const dryRun = await caller.whatsapp.cleanupSyncedContacts({
      tenantId: 99999, // Use nonexistent tenant to avoid deleting real data
      dryRun: false,
    });
    expect(dryRun).toBeDefined();
    expect(dryRun.dryRun).toBe(false);
    expect(typeof dryRun.contactsDeleted).toBe("number");
    expect(dryRun.contactsDeleted).toBe(0);
  });
});
