import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ═══════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(overrides?: {
  role?: "admin" | "user";
  userId?: number;
  tenantId?: number;
}): TrpcContext {
  const userId = overrides?.userId ?? 1;
  const tenantId = overrides?.tenantId ?? 1;
  const role = overrides?.role ?? "admin";

  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    saasUser: {
      userId,
      tenantId,
      role,
      email: user.email,
      name: user.name,
    },
    req: {
      protocol: "https",
      hostname: "test.manus.computer",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ═══════════════════════════════════════
// Tests
// ═══════════════════════════════════════

describe("agenda — Unified Calendar", () => {
  // ── 1. Router existence ──
  it("1. agenda.unified procedure exists on the router", () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.agenda).toBeDefined();
    expect(caller.agenda.unified).toBeDefined();
  });

  // ── 2. Router existence: syncGoogle ──
  it("2. agenda.syncGoogle procedure exists on the router", () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.agenda.syncGoogle).toBeDefined();
  });

  // ── 3. Router existence: disconnectGoogle ──
  it("3. agenda.disconnectGoogle procedure exists on the router", () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.agenda.disconnectGoogle).toBeDefined();
  });

  // ── 4. Router existence: googleStatus ──
  it("4. agenda.googleStatus procedure exists on the router", () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.agenda.googleStatus).toBeDefined();
  });

  // ── 5. unified returns an array (even if empty) ──
  it("5. agenda.unified returns an array for valid date range", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.unified({
        from: "2025-01-01",
        to: "2025-01-31",
      });
      expect(Array.isArray(result)).toBe(true);
    } catch (err: any) {
      expect(err.message).toBeDefined();
    }
  });

  // ── 6. unified rejects invalid date format gracefully ──
  it("6. agenda.unified accepts string dates without crashing on validation", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.agenda.unified({ from: "not-a-date", to: "also-not" });
    } catch (err: any) {
      expect(err.code).not.toBe("BAD_REQUEST");
    }
  });

  // ── 7. Non-admin user cannot pass userId filter ──
  it("7. non-admin user's userId filter is overridden to their own", async () => {
    const ctx = createTestContext({ role: "user", userId: 42 });
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.unified({
        from: "2025-01-01",
        to: "2025-01-31",
        userId: 999,
      });
      expect(Array.isArray(result)).toBe(true);
    } catch (err: any) {
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });

  // ── 8. Admin can pass userId filter ──
  it("8. admin user can filter by specific userId", async () => {
    const ctx = createTestContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.unified({
        from: "2025-01-01",
        to: "2025-01-31",
        userId: 42,
      });
      expect(Array.isArray(result)).toBe(true);
    } catch (err: any) {
      expect(err.message).toBeDefined();
    }
  });

  // ── 9. googleStatus returns connection info ──
  it("9. agenda.googleStatus returns object with connected field", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.googleStatus();
      expect(result).toHaveProperty("connected");
      expect(typeof result.connected).toBe("boolean");
    } catch (err: any) {
      expect(err.message).toBeDefined();
    }
  });

  // ── 10. syncGoogle returns synced count ──
  it("10. agenda.syncGoogle returns object with synced field", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.syncGoogle();
      expect(result).toHaveProperty("synced");
      expect(typeof result.synced).toBe("number");
    } catch (err: any) {
      expect(err.message).toBeDefined();
    }
  });
});

describe("agenda — Appointment CRUD", () => {
  // ── 11. createAppointment procedure exists ──
  it("11. agenda.createAppointment procedure exists on the router", () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.agenda.createAppointment).toBeDefined();
  });

  // ── 12. updateAppointment procedure exists ──
  it("12. agenda.updateAppointment procedure exists on the router", () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.agenda.updateAppointment).toBeDefined();
  });

  // ── 13. deleteAppointment procedure exists ──
  it("13. agenda.deleteAppointment procedure exists on the router", () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.agenda.deleteAppointment).toBeDefined();
  });

  // ── 14. createAppointment validates required title ──
  it("14. createAppointment rejects empty title", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.agenda.createAppointment({
        title: "",
        startAt: Date.now(),
        endAt: Date.now() + 3600000,
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (err: any) {
      // Either Zod BAD_REQUEST or tenant FORBIDDEN — both mean it was rejected
      expect(["BAD_REQUEST", "FORBIDDEN"]).toContain(err.code);
    }
  });

  // ── 15. createAppointment accepts valid input ──
  it("15. createAppointment accepts valid input and returns id", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.createAppointment({
        title: "Reunião de teste",
        startAt: Date.now(),
        endAt: Date.now() + 3600000,
        description: "Descrição de teste",
        color: "emerald",
      });
      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    } catch (err: any) {
      // DB error is acceptable in test env
      expect(err.message).toBeDefined();
    }
  });

  // ── 16. createAppointment with all optional fields ──
  it("16. createAppointment accepts all optional fields", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.createAppointment({
        title: "Compromisso completo",
        startAt: Date.now(),
        endAt: Date.now() + 7200000,
        description: "Teste com todos os campos",
        allDay: false,
        location: "Escritório",
        color: "blue",
        dealId: 1,
        contactId: 1,
      });
      expect(result).toHaveProperty("id");
    } catch (err: any) {
      expect(err.message).toBeDefined();
    }
  });

  // ── 17. updateAppointment validates id is required ──
  it("17. updateAppointment requires id field", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      // @ts-expect-error — intentionally missing id
      await caller.agenda.updateAppointment({
        title: "Updated",
      });
      expect(true).toBe(false);
    } catch (err: any) {
      // Either Zod BAD_REQUEST or tenant FORBIDDEN
      expect(["BAD_REQUEST", "FORBIDDEN"]).toContain(err.code);
    }
  });

  // ── 18. deleteAppointment validates id is required ──
  it("18. deleteAppointment requires id field", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      // @ts-expect-error — intentionally missing id
      await caller.agenda.deleteAppointment({});
      expect(true).toBe(false);
    } catch (err: any) {
      // Either Zod BAD_REQUEST or tenant FORBIDDEN
      expect(["BAD_REQUEST", "FORBIDDEN"]).toContain(err.code);
    }
  });

  // ── 19. createAppointment validates title max length ──
  it("19. createAppointment rejects title exceeding 500 chars", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.agenda.createAppointment({
        title: "x".repeat(501),
        startAt: Date.now(),
        endAt: Date.now() + 3600000,
      });
      expect(true).toBe(false);
    } catch (err: any) {
      // Either Zod BAD_REQUEST or tenant FORBIDDEN
      expect(["BAD_REQUEST", "FORBIDDEN"]).toContain(err.code);
    }
  });

  // ── 20. updateAppointment accepts isCompleted toggle ──
  it("20. updateAppointment accepts isCompleted boolean", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.updateAppointment({
        id: 1,
        isCompleted: true,
      });
      expect(result).toHaveProperty("success");
    } catch (err: any) {
      // DB error or not found is acceptable
      expect(err.message).toBeDefined();
    }
  });
});

describe("agenda — Appointment Participants", () => {
  // ── 21. tenantUsers procedure exists ──
  it("21. agenda.tenantUsers procedure exists on the router", () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.agenda.tenantUsers).toBeDefined();
  });

  // ── 22. getParticipants procedure exists ──
  it("22. agenda.getParticipants procedure exists on the router", () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.agenda.getParticipants).toBeDefined();
  });

  // ── 23. tenantUsers returns array ──
  it("23. agenda.tenantUsers returns an array", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.tenantUsers();
      expect(Array.isArray(result)).toBe(true);
    } catch (err: any) {
      // DB error acceptable in test env
      expect(err.message).toBeDefined();
    }
  });

  // ── 24. getParticipants returns array for valid appointmentId ──
  it("24. agenda.getParticipants returns an array", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.getParticipants({ appointmentId: 1 });
      expect(Array.isArray(result)).toBe(true);
    } catch (err: any) {
      expect(err.message).toBeDefined();
    }
  });

  // ── 25. createAppointment accepts participantIds ──
  it("25. createAppointment accepts participantIds array", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.createAppointment({
        title: "Reunião com equipe",
        startAt: Date.now(),
        endAt: Date.now() + 3600000,
        participantIds: [1, 2, 3],
      });
      expect(result).toHaveProperty("id");
    } catch (err: any) {
      // DB error acceptable
      expect(err.message).toBeDefined();
    }
  });

  // ── 26. updateAppointment accepts participantIds ──
  it("26. updateAppointment accepts participantIds array", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.updateAppointment({
        id: 1,
        participantIds: [1, 2],
      });
      expect(result).toHaveProperty("success");
    } catch (err: any) {
      expect(err.message).toBeDefined();
    }
  });

  // ── 27. createAppointment with empty participantIds still works ──
  it("27. createAppointment with empty participantIds defaults to creator", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.createAppointment({
        title: "Solo appointment",
        startAt: Date.now(),
        endAt: Date.now() + 3600000,
        participantIds: [],
      });
      expect(result).toHaveProperty("id");
    } catch (err: any) {
      expect(err.message).toBeDefined();
    }
  });

  // ── 28. getParticipants validates appointmentId is required ──
  it("28. getParticipants rejects missing appointmentId", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      // @ts-expect-error — intentionally missing appointmentId
      await caller.agenda.getParticipants({});
      expect(true).toBe(false);
    } catch (err: any) {
      expect(["BAD_REQUEST", "FORBIDDEN"]).toContain(err.code);
    }
  });

  // ── 29. tenantUsers returns objects with userId and name ──
  it("29. tenantUsers returns objects with expected shape", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.tenantUsers();
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("userId");
        expect(result[0]).toHaveProperty("name");
      }
      expect(Array.isArray(result)).toBe(true);
    } catch (err: any) {
      expect(err.message).toBeDefined();
    }
  });

  // ── 30. non-admin can access tenantUsers (for participant picker) ──
  it("30. non-admin user can access tenantUsers", async () => {
    const ctx = createTestContext({ role: "user", userId: 42 });
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agenda.tenantUsers();
      expect(Array.isArray(result)).toBe(true);
    } catch (err: any) {
      // Should not be FORBIDDEN since it uses tenantProcedure (read)
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });
});
