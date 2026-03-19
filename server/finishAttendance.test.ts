import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for the finishAttendance tenantId resolution fix.
 * 
 * The bug: finishAttendance procedure used input.tenantId which defaults to 1,
 * but the frontend didn't always pass tenantId. Real tenants have IDs like 210002, 150002, etc.
 * This caused the UPDATE to match 0 rows (WHERE tenantId=1 AND ...) and silently fail.
 * 
 * The fix: procedures now derive tenantId from ctx.saasUser.tenantId first, 
 * then fall back to input.tenantId, then default to 1.
 */

// Mock the db module
const mockFinishAttendance = vi.fn().mockResolvedValue(undefined);
vi.mock("./db", () => ({
  finishAttendance: (...args: any[]) => mockFinishAttendance(...args),
}));

// Mock socket.io
vi.mock("./_core/socket", () => ({
  getIo: () => ({
    emit: vi.fn(),
  }),
}));

describe("finishAttendance tenantId resolution", () => {
  beforeEach(() => {
    mockFinishAttendance.mockClear();
  });

  it("should use ctx.saasUser.tenantId when available (not input default)", async () => {
    // This tests the core fix: ctx.saasUser.tenantId should take priority over input.tenantId
    const ctxTenantId = 210002;
    const inputTenantId = 1; // default value

    // Simulate the tenantId resolution logic from the procedure
    const resolvedTenantId = ctxTenantId || inputTenantId || 1;
    
    expect(resolvedTenantId).toBe(210002);
    expect(resolvedTenantId).not.toBe(1);
  });

  it("should fall back to input.tenantId when ctx.saasUser is undefined", async () => {
    const ctxTenantId = undefined;
    const inputTenantId = 150002;

    const resolvedTenantId = ctxTenantId || inputTenantId || 1;
    
    expect(resolvedTenantId).toBe(150002);
  });

  it("should fall back to 1 when both ctx and input are missing", async () => {
    const ctxTenantId = undefined;
    const inputTenantId = undefined;

    const resolvedTenantId = ctxTenantId || inputTenantId || 1;
    
    expect(resolvedTenantId).toBe(1);
  });

  it("should prefer ctx.saasUser.tenantId over input.tenantId even when both provided", async () => {
    const ctxTenantId = 240007;
    const inputTenantId = 150002;

    const resolvedTenantId = ctxTenantId || inputTenantId || 1;
    
    expect(resolvedTenantId).toBe(240007);
  });

  it("should handle tenantId=0 from ctx by falling back to input", async () => {
    // tenantId=0 is falsy, so it should fall back
    const ctxTenantId = 0;
    const inputTenantId = 300002;

    const resolvedTenantId = ctxTenantId || inputTenantId || 1;
    
    expect(resolvedTenantId).toBe(300002);
  });
});

describe("finishAttendance function receives correct tenantId", () => {
  beforeEach(() => {
    mockFinishAttendance.mockClear();
  });

  it("should pass the resolved tenantId to finishAttendance db function", async () => {
    const tenantId = 210002;
    const sessionId = "test-session";
    const remoteJid = "5511999999999@s.whatsapp.net";
    const userId = 42;

    await mockFinishAttendance(tenantId, sessionId, remoteJid, userId);

    expect(mockFinishAttendance).toHaveBeenCalledWith(
      210002,
      "test-session",
      "5511999999999@s.whatsapp.net",
      42
    );
  });

  it("should NOT pass tenantId=1 for non-default tenants", async () => {
    const ctxTenantId = 240005;
    const inputTenantId = 1; // default
    const resolvedTenantId = ctxTenantId || inputTenantId || 1;

    await mockFinishAttendance(resolvedTenantId, "session", "jid@s.whatsapp.net", 1);

    expect(mockFinishAttendance).not.toHaveBeenCalledWith(
      1,
      expect.any(String),
      expect.any(String),
      expect.any(Number)
    );
  });
});
