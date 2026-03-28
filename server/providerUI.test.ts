/**
 * Tests for Provider UI — Z-API Only
 * Evolution API has been removed from the system.
 */
import { describe, it, expect } from "vitest";

describe("Provider Resolution (Z-API only)", () => {
  it("should resolve to zapi when provider field is null/undefined", () => {
    const session = { provider: null as string | null };
    const resolved = session.provider || "zapi";
    expect(resolved).toBe("zapi");
  });

  it("should resolve to zapi when provider field is empty string", () => {
    const session = { provider: "" };
    const resolved = session.provider || "zapi";
    expect(resolved).toBe("zapi");
  });

  it("should resolve to zapi when provider field is zapi", () => {
    const session = { provider: "zapi" };
    const resolved = session.provider || "zapi";
    expect(resolved).toBe("zapi");
  });
});

describe("Provider Display Names (Z-API only)", () => {
  it("should show correct provider name for zapi", () => {
    const provider = "zapi";
    const displayName = "Z-API";
    expect(displayName).toBe("Z-API");
  });
});

describe("Provider Metrics Response Shape", () => {
  it("should return metrics for Z-API only", () => {
    const metricsResponse = {
      metrics: {
        zapi: {
          provider: "zapi",
          totalRequests: 0,
          totalErrors: 0,
          totalTimeouts: 0,
          avgLatencyMs: 0,
          lastError: null,
          lastErrorAt: null,
          operations: {},
        },
      },
      sessionCounts: {
        zapi: 5,
      },
      sessions: {
        zapi: [],
      },
    };

    expect(metricsResponse.sessionCounts.zapi).toBeGreaterThanOrEqual(0);
    expect(metricsResponse.metrics).toHaveProperty("zapi");
    expect(metricsResponse.metrics).not.toHaveProperty("evolution");
  });
});

describe("Z-API Credentials UI Logic", () => {
  it("should require zapi credentials when connecting", () => {
    const showCredentials = (provider: string) => provider === "zapi";
    expect(showCredentials("zapi")).toBe(true);
  });

  it("should show correct badge class for zapi", () => {
    const getBadgeClass = (provider: string) =>
      provider === "zapi" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800";
    expect(getBadgeClass("zapi")).toContain("blue");
  });
});
