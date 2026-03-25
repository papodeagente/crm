/**
 * Z-API Client Token Validation Test
 *
 * Validates that the ZAPI_CLIENT_TOKEN env var is set and works
 * by making a lightweight API call to the active Z-API instance.
 */
import { describe, it, expect } from "vitest";

describe("Z-API Client Token", () => {
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  const instanceId = "3F0A27FB145F70C9A6AFB28EF986C64C";
  const token = "16D46B6D88E44759A3B1E5CABAD2EA47";

  it("ZAPI_CLIENT_TOKEN env var is set and non-empty", () => {
    expect(clientToken).toBeDefined();
    expect(typeof clientToken).toBe("string");
    expect(clientToken!.length).toBeGreaterThan(10);
  });

  it("Client-Token authenticates successfully against Z-API instance", async () => {
    // Use the /status endpoint as a lightweight health check
    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken!,
      },
    });

    // Should NOT get 400 (missing client-token) or 403 (wrong client-token)
    console.log("Status response:", response.status);
    const body = await response.text();
    console.log("Status body:", body.substring(0, 200));

    expect(response.status).not.toBe(400);
    expect(response.status).not.toBe(403);
    // 200 = success, could also be other codes if instance is disconnected
    expect([200, 201, 204]).toContain(response.status);
  });
});
