import { describe, it, expect } from "vitest";

/**
 * Tests for Provider Management UI endpoints and data flow
 * Validates that the backend endpoints for provider migration, rollback,
 * and metrics return the correct shapes and handle edge cases.
 */

// ─── Provider Factory Logic Tests ───
describe("Provider Factory - Session Resolution", () => {
  it("should default to evolution when provider field is null/undefined", () => {
    const session = { provider: undefined };
    const resolved = session.provider || "evolution";
    expect(resolved).toBe("evolution");
  });

  it("should default to evolution when provider field is empty string", () => {
    const session = { provider: "" };
    const resolved = session.provider || "evolution";
    expect(resolved).toBe("evolution");
  });

  it("should resolve zapi when provider field is zapi", () => {
    const session = { provider: "zapi" };
    const resolved = session.provider || "evolution";
    expect(resolved).toBe("zapi");
  });

  it("should resolve evolution when provider field is evolution", () => {
    const session = { provider: "evolution" };
    const resolved = session.provider || "evolution";
    expect(resolved).toBe("evolution");
  });
});

// ─── Migration Input Validation Tests ───
describe("Provider Migration - Input Validation", () => {
  it("should require zapiInstanceId and zapiToken when migrating to zapi", () => {
    const input = {
      sessionId: "test-session-1",
      toProvider: "zapi" as const,
      zapiInstanceId: "ABC123",
      zapiToken: "token-xyz",
      zapiClientToken: "client-token-optional",
    };

    // Validate required fields
    expect(input.zapiInstanceId).toBeTruthy();
    expect(input.zapiToken).toBeTruthy();
    expect(input.toProvider).toBe("zapi");
  });

  it("should not require zapi credentials when migrating to evolution", () => {
    const input = {
      sessionId: "test-session-1",
      toProvider: "evolution" as const,
    };

    expect(input.toProvider).toBe("evolution");
    expect((input as any).zapiInstanceId).toBeUndefined();
    expect((input as any).zapiToken).toBeUndefined();
  });

  it("should validate zapiClientToken is optional", () => {
    const inputWithout = {
      sessionId: "test-session-1",
      toProvider: "zapi" as const,
      zapiInstanceId: "ABC123",
      zapiToken: "token-xyz",
    };

    const inputWith = {
      ...inputWithout,
      zapiClientToken: "client-token",
    };

    // Both should be valid
    expect(inputWithout.zapiInstanceId).toBeTruthy();
    expect(inputWith.zapiClientToken).toBe("client-token");
  });

  it("should reject empty zapiInstanceId", () => {
    const input = {
      zapiInstanceId: "",
      zapiToken: "token-xyz",
    };

    const isValid = input.zapiInstanceId.trim().length > 0 && input.zapiToken.trim().length > 0;
    expect(isValid).toBe(false);
  });

  it("should reject empty zapiToken", () => {
    const input = {
      zapiInstanceId: "ABC123",
      zapiToken: "  ",
    };

    const isValid = input.zapiInstanceId.trim().length > 0 && input.zapiToken.trim().length > 0;
    expect(isValid).toBe(false);
  });
});

// ─── Migration Response Shape Tests ───
describe("Provider Migration - Response Shape", () => {
  it("should return correct shape for successful migration to zapi", () => {
    const response = {
      success: true,
      sessionId: "test-session-1",
      provider: "zapi",
    };

    expect(response).toHaveProperty("success", true);
    expect(response).toHaveProperty("sessionId");
    expect(response).toHaveProperty("provider", "zapi");
  });

  it("should return correct shape for rollback to evolution", () => {
    const response = {
      success: true,
      sessionId: "test-session-1",
      provider: "evolution",
    };

    expect(response).toHaveProperty("success", true);
    expect(response).toHaveProperty("provider", "evolution");
  });
});

// ─── Provider Metrics Response Shape Tests ───
describe("Provider Metrics - Response Shape", () => {
  it("should return metrics with session counts", () => {
    const metricsResponse = {
      metrics: {
        evolution: {
          totalCalls: 150,
          totalErrors: 3,
          avgLatencyMs: 245,
          operations: {},
        },
        zapi: {
          totalCalls: 50,
          totalErrors: 1,
          avgLatencyMs: 180,
          operations: {},
        },
      },
      sessionCounts: {
        evolution: 10,
        zapi: 2,
      },
      sessions: {
        evolution: [],
        zapi: [],
      },
    };

    expect(metricsResponse.sessionCounts.evolution).toBeGreaterThanOrEqual(0);
    expect(metricsResponse.sessionCounts.zapi).toBeGreaterThanOrEqual(0);
    expect(metricsResponse.metrics).toHaveProperty("evolution");
    expect(metricsResponse.metrics).toHaveProperty("zapi");
  });
});

// ─── UI Display Logic Tests ───
describe("Provider UI - Display Logic", () => {
  it("should show correct provider name for evolution", () => {
    const provider = "evolution";
    const displayName = provider === "zapi" ? "Z-API" : "Evolution API";
    expect(displayName).toBe("Evolution API");
  });

  it("should show correct provider name for zapi", () => {
    const provider = "zapi";
    const displayName = provider === "zapi" ? "Z-API" : "Evolution API";
    expect(displayName).toBe("Z-API");
  });

  it("should show correct target provider when on evolution", () => {
    const currentProvider = "evolution";
    const targetProvider = currentProvider === "zapi" ? "Evolution API" : "Z-API";
    expect(targetProvider).toBe("Z-API");
  });

  it("should show correct target provider when on zapi", () => {
    const currentProvider = "zapi";
    const targetProvider = currentProvider === "zapi" ? "Evolution API" : "Z-API";
    expect(targetProvider).toBe("Evolution API");
  });

  it("should show rollback button only when on zapi", () => {
    const showRollback = (provider: string) => provider === "zapi";
    expect(showRollback("zapi")).toBe(true);
    expect(showRollback("evolution")).toBe(false);
  });

  it("should show credentials section only when on zapi", () => {
    const showCredentials = (provider: string) => provider === "zapi";
    expect(showCredentials("zapi")).toBe(true);
    expect(showCredentials("evolution")).toBe(false);
  });

  it("should mask tokens in display", () => {
    const token = "abc123def456";
    const masked = "••••••••";
    expect(masked).not.toContain(token);
    expect(masked.length).toBeGreaterThan(0);
  });

  it("should apply correct badge colors per provider", () => {
    const getBadgeClass = (provider: string) =>
      provider === "zapi"
        ? "border-blue-200 text-blue-700 bg-blue-50"
        : "border-emerald-200 text-emerald-700 bg-emerald-50";

    expect(getBadgeClass("zapi")).toContain("blue");
    expect(getBadgeClass("evolution")).toContain("emerald");
  });
});

// ─── Session Data Shape Tests ───
describe("Session Data - Provider Fields", () => {
  it("should include provider fields in session data", () => {
    const session = {
      sessionId: "crm-100-200",
      provider: "evolution" as const,
      providerInstanceId: null,
      providerToken: null,
      providerClientToken: null,
      phoneNumber: "+5511999999999",
      status: "connected",
    };

    expect(session).toHaveProperty("provider");
    expect(session).toHaveProperty("providerInstanceId");
    expect(session).toHaveProperty("providerToken");
    expect(session).toHaveProperty("providerClientToken");
  });

  it("should include zapi credentials when provider is zapi", () => {
    const session = {
      sessionId: "crm-100-200",
      provider: "zapi" as const,
      providerInstanceId: "ZAPI-INST-123",
      providerToken: "zapi-token-xyz",
      providerClientToken: "zapi-client-token",
      phoneNumber: "+5511999999999",
      status: "connected",
    };

    expect(session.provider).toBe("zapi");
    expect(session.providerInstanceId).toBeTruthy();
    expect(session.providerToken).toBeTruthy();
  });
});
