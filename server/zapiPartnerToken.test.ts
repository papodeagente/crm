import { describe, it, expect } from "vitest";

/**
 * Z-API Partner Token Validation
 *
 * IMPORTANT: This test MUST NOT create real Z-API instances.
 * We are a Partner account — each instance creation costs money
 * and consumes slots. Only validate that credentials are configured.
 */

describe("Z-API Partner Token Validation", () => {
  it("should have ZAPI_PARTNER_TOKEN configured", () => {
    const token = process.env.ZAPI_PARTNER_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(0);
  });

  it("should have a valid JWT format for partner token", () => {
    const token = process.env.ZAPI_PARTNER_TOKEN;
    if (!token) return; // skip if not set
    // JWT has 3 parts separated by dots
    const parts = token.split(".");
    expect(parts.length).toBe(3);
  });

  it("should have ZAPI_CLIENT_TOKEN configured", () => {
    const token = process.env.ZAPI_CLIENT_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(0);
  });
});
