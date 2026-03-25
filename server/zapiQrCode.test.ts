/**
 * Z-API QR Code Generation Tests
 *
 * Tests the full QR code generation flow via Z-API automatic provisioning.
 * Uses the active provisioned instance (tenant 330007).
 */
import { describe, it, expect, beforeAll } from "vitest";

const INSTANCE_ID = "3F0A27FB145F70C9A6AFB28EF986C64C";
const INSTANCE_TOKEN = "16D46B6D88E44759A3B1E5CABAD2EA47";

describe("Z-API QR Code Generation (Automatic Provisioning)", () => {
  let clientToken: string;

  beforeAll(() => {
    clientToken = process.env.ZAPI_CLIENT_TOKEN || "";
    if (!clientToken) {
      throw new Error("ZAPI_CLIENT_TOKEN env var is required for these tests");
    }
  });

  it("ZAPI_CLIENT_TOKEN is configured", () => {
    expect(clientToken.length).toBeGreaterThan(10);
  });

  it("instance status endpoint works with Client-Token", async () => {
    const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/status`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    // Instance should respond with connected status info
    expect(data).toHaveProperty("connected");
    expect(data).toHaveProperty("session");
    expect(data).toHaveProperty("smartphoneConnected");
  });

  it("QR code image endpoint returns base64 PNG", async () => {
    const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/qr-code/image`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("value");
    expect(typeof data.value).toBe("string");
    expect(data.value).toMatch(/^data:image\/png;base64,/);
    // Should be a substantial image (at least 1KB of base64)
    expect(data.value.length).toBeGreaterThan(1000);
  });

  it("QR code bytes endpoint returns raw QR data", async () => {
    const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/qr-code`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("value");
    expect(typeof data.value).toBe("string");
    // Raw QR data is a long string (not base64 image)
    expect(data.value.length).toBeGreaterThan(50);
  });

  it("zapiProvider.connectInstance correctly parses QR response", async () => {
    // Simulate what zapiProvider.connectInstance does
    const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/qr-code/image`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
    });
    const result = await res.json();

    // Replicate the parsing logic from zapiProvider.ts line 423
    const base64 = typeof result === "string" ? result : result?.value || result?.qrcode || "";
    const qrDataUrl = base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;

    expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(qrDataUrl.length).toBeGreaterThan(1000);
  });

  it("rejects requests without Client-Token (security enabled)", async () => {
    const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/status`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });
    // Should return 400 because Client-Token is required
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("client-token");
  });

  it("rejects requests with wrong Client-Token", async () => {
    const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/status`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", "Client-Token": "wrong-token-12345" },
    });
    expect(res.status).toBe(403);
  });
});
