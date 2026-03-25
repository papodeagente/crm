import { describe, it, expect } from "vitest";

describe("Z-API Partner Token Validation", () => {
  it("should have ZAPI_PARTNER_TOKEN configured", () => {
    const token = process.env.ZAPI_PARTNER_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(0);
  });

  it("should authenticate with Partner API using Authorization Bearer header", async () => {
    const token = process.env.ZAPI_PARTNER_TOKEN;
    if (!token) {
      throw new Error("ZAPI_PARTNER_TOKEN not set");
    }

    // Use the create-instance endpoint with a dry-run approach:
    // We create an instance and immediately verify the response format.
    // The instance will auto-expire in 2 days if not subscribed.
    // Instead, we test with a lightweight POST that validates auth.
    // The on-demand endpoint with POST requires a body with name.
    // If auth works, we get 200 with id/token/due.
    // If auth fails, we get 401.
    const response = await fetch(
      "https://api.z-api.io/instances/integrator/on-demand",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: `token-validation-${Date.now()}` }),
      }
    );

    // Should return 200 (instance created) — confirms token is valid
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("token");
    expect(data).toHaveProperty("due");

    // Clean up: cancel the test instance (it will auto-expire in 2 days anyway)
    if (data.id && data.token) {
      try {
        await fetch(
          `https://api.z-api.io/instances/${data.id}/token/${data.token}/integrator/on-demand/cancel`,
          {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            signal: AbortSignal.timeout(10000),
          }
        );
      } catch {
        // Cleanup is best-effort; instance auto-expires in 2 days
      }
    }
  }, 30000);
});
