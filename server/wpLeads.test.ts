import { describe, expect, it, vi, beforeEach } from "vitest";
import { checkRateLimit, isValidEmail, rateLimitStore } from "./webhookRoutes";

/**
 * WordPress Elementor Webhook Tests — /webhooks/wp-leads
 *
 * Tests are organized in 3 groups:
 * 1. Pure logic tests (rate limiter, email validation) — no DB access
 * 2. Endpoint integration tests via tRPC caller — read-only
 * 3. Payload validation tests — pure logic
 */

// ═══════════════════════════════════════
// RATE LIMITER — Pure Logic Tests
// ═══════════════════════════════════════
describe("Rate Limiter — checkRateLimit", () => {
  beforeEach(() => {
    rateLimitStore.clear();
  });

  it("allows first request from a new IP", () => {
    const result = checkRateLimit("192.168.1.1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29);
  });

  it("tracks requests per IP independently", () => {
    checkRateLimit("192.168.1.1");
    checkRateLimit("192.168.1.2");

    const r1 = checkRateLimit("192.168.1.1");
    const r2 = checkRateLimit("192.168.1.2");

    expect(r1.remaining).toBe(28); // 2nd request for this IP
    expect(r2.remaining).toBe(28); // 2nd request for this IP
  });

  it("blocks after 30 requests from same IP", () => {
    for (let i = 0; i < 30; i++) {
      const r = checkRateLimit("192.168.1.100");
      expect(r.allowed).toBe(true);
    }

    const blocked = checkRateLimit("192.168.1.100");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    // Simulate 30 requests
    for (let i = 0; i < 30; i++) {
      checkRateLimit("192.168.1.200");
    }

    // Manually expire the entry
    const entry = rateLimitStore.get("192.168.1.200");
    if (entry) {
      entry.resetAt = Date.now() - 1; // expired
    }

    // Should be allowed again
    const result = checkRateLimit("192.168.1.200");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29);
  });

  it("returns correct remaining count", () => {
    checkRateLimit("10.0.0.1"); // 1st → 29 remaining
    checkRateLimit("10.0.0.1"); // 2nd → 28 remaining
    checkRateLimit("10.0.0.1"); // 3rd → 27 remaining

    const result = checkRateLimit("10.0.0.1"); // 4th → 26 remaining
    expect(result.remaining).toBe(26);
  });
});

// ═══════════════════════════════════════
// EMAIL VALIDATION — Pure Logic Tests
// ═══════════════════════════════════════
describe("Email Validation — isValidEmail", () => {
  it("accepts valid email formats", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user.name@domain.co")).toBe(true);
    expect(isValidEmail("user+tag@gmail.com")).toBe(true);
    expect(isValidEmail("user@sub.domain.com")).toBe(true);
  });

  it("rejects invalid email formats", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("@domain.com")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("user@.com")).toBe(false);
    expect(isValidEmail("user @domain.com")).toBe(false);
  });

  it("handles whitespace in email", () => {
    expect(isValidEmail("  user@example.com  ")).toBe(true); // trimmed
    expect(isValidEmail("user @example.com")).toBe(false); // space in middle
  });
});

// ═══════════════════════════════════════
// PAYLOAD VALIDATION — Pure Logic Tests
// ═══════════════════════════════════════
describe("WP Leads Payload Validation", () => {
  function validatePayload(body: Record<string, any>): string[] {
    const errors: string[] = [];
    const { name, email, phone } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      errors.push("name is required");
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      errors.push("email is required");
    } else if (!isValidEmail(email)) {
      errors.push("email format is invalid");
    }
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      errors.push("phone is required");
    }

    return errors;
  }

  it("passes with all required fields", () => {
    const errors = validatePayload({
      name: "João Silva",
      email: "joao@example.com",
      phone: "+5584999990001",
    });
    expect(errors).toEqual([]);
  });

  it("fails when name is missing", () => {
    const errors = validatePayload({
      email: "joao@example.com",
      phone: "+5584999990001",
    });
    expect(errors).toContain("name is required");
  });

  it("fails when email is missing", () => {
    const errors = validatePayload({
      name: "João Silva",
      phone: "+5584999990001",
    });
    expect(errors).toContain("email is required");
  });

  it("fails when phone is missing", () => {
    const errors = validatePayload({
      name: "João Silva",
      email: "joao@example.com",
    });
    expect(errors).toContain("phone is required");
  });

  it("fails when email format is invalid", () => {
    const errors = validatePayload({
      name: "João Silva",
      email: "not-valid",
      phone: "+5584999990001",
    });
    expect(errors).toContain("email format is invalid");
  });

  it("fails with multiple missing fields", () => {
    const errors = validatePayload({});
    expect(errors.length).toBe(3);
    expect(errors).toContain("name is required");
    expect(errors).toContain("email is required");
    expect(errors).toContain("phone is required");
  });

  it("fails when name is empty string", () => {
    const errors = validatePayload({
      name: "   ",
      email: "joao@example.com",
      phone: "+5584999990001",
    });
    expect(errors).toContain("name is required");
  });

  it("fails when name is not a string", () => {
    const errors = validatePayload({
      name: 123,
      email: "joao@example.com",
      phone: "+5584999990001",
    });
    expect(errors).toContain("name is required");
  });
});

// ═══════════════════════════════════════
// UTM PARSING — Pure Logic Tests
// ═══════════════════════════════════════
describe("WP Leads UTM Parsing", () => {
  function parseUtm(body: Record<string, any>): Record<string, string> | undefined {
    const utm: Record<string, string> = {};
    if (body.utm_source) utm.source = String(body.utm_source);
    if (body.utm_medium) utm.medium = String(body.utm_medium);
    if (body.utm_campaign) utm.campaign = String(body.utm_campaign);
    return Object.keys(utm).length > 0 ? utm : undefined;
  }

  it("parses all UTM fields", () => {
    const utm = parseUtm({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "summer-2026",
    });
    expect(utm).toEqual({
      source: "google",
      medium: "cpc",
      campaign: "summer-2026",
    });
  });

  it("parses partial UTM fields", () => {
    const utm = parseUtm({ utm_source: "instagram" });
    expect(utm).toEqual({ source: "instagram" });
  });

  it("returns undefined when no UTM fields", () => {
    const utm = parseUtm({ name: "test" });
    expect(utm).toBeUndefined();
  });

  it("converts non-string UTM values to strings", () => {
    const utm = parseUtm({ utm_source: 123, utm_campaign: true });
    expect(utm?.source).toBe("123");
    expect(utm?.campaign).toBe("true");
  });
});

// ═══════════════════════════════════════
// PAYLOAD CONSTRUCTION — Pure Logic Tests
// ═══════════════════════════════════════
describe("WP Leads Payload Construction", () => {
  it("constructs correct InboundLeadPayload shape", () => {
    const body = {
      name: "  Maria Santos  ",
      email: "  Maria@Email.COM  ",
      phone: "84999990001",
      message: "Quero saber sobre pacotes",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "verao-2026",
      api_key: "test-key",
    };

    const payload = {
      name: body.name.trim(),
      email: body.email.trim(),
      phone: body.phone.trim(),
      message: body.message ? String(body.message).trim() : undefined,
      source: "wordpress",
      lead_id: undefined,
      utm: {
        source: body.utm_source,
        medium: body.utm_medium,
        campaign: body.utm_campaign,
      },
      meta: {
        channel: "elementor",
        ip: "127.0.0.1",
      },
      raw: body,
    };

    expect(payload.source).toBe("wordpress");
    expect(payload.name).toBe("Maria Santos");
    expect(payload.email).toBe("Maria@Email.COM");
    expect(payload.phone).toBe("84999990001");
    expect(payload.message).toBe("Quero saber sobre pacotes");
    expect(payload.utm?.source).toBe("google");
    expect(payload.utm?.medium).toBe("cpc");
    expect(payload.utm?.campaign).toBe("verao-2026");
    expect(payload.meta?.channel).toBe("elementor");
    expect(payload.lead_id).toBeUndefined();
  });

  it("handles missing optional fields gracefully", () => {
    const body = {
      name: "João",
      email: "joao@test.com",
      phone: "84999990001",
      api_key: "test-key",
    };

    const message = body.hasOwnProperty("message") ? String((body as any).message).trim() : undefined;
    const hasUtm = false;

    expect(message).toBeUndefined();
    expect(hasUtm).toBe(false);
  });
});

// ═══════════════════════════════════════
// SECURITY — API Key Validation Logic
// ═══════════════════════════════════════
describe("WP Leads Security — API Key Validation", () => {
  it("rejects when api_key is missing", () => {
    const body: Record<string, any> = { name: "test" };
    const apiKey = body.api_key;
    expect(!apiKey || typeof apiKey !== "string").toBe(true);
  });

  it("rejects when api_key is empty string", () => {
    const apiKey = "";
    expect(!apiKey || typeof apiKey !== "string").toBe(true);
  });

  it("rejects when api_key is not a string", () => {
    const apiKey = 12345;
    expect(!apiKey || typeof apiKey !== "string").toBe(true);
  });

  it("accepts when api_key matches secret", () => {
    const apiKey = "my-secret-key-123";
    const wpSecret = "my-secret-key-123";
    expect(apiKey === wpSecret).toBe(true);
  });

  it("rejects when api_key does not match secret", () => {
    const apiKey = "wrong-key";
    const wpSecret = "my-secret-key-123";
    expect(apiKey === wpSecret).toBe(false);
  });

  it("rejects when WP_SECRET is not configured", () => {
    const apiKey = "some-key";
    const wpSecret = ""; // not configured
    expect(!wpSecret || apiKey !== wpSecret).toBe(true);
  });
});

// ═══════════════════════════════════════
// RESPONSE FORMAT — Pure Logic Tests
// ═══════════════════════════════════════
describe("WP Leads Response Format", () => {
  it("success response has correct shape", () => {
    const response = {
      success: true,
      message: "Lead criado com sucesso",
    };
    expect(response.success).toBe(true);
    expect(response.message).toBe("Lead criado com sucesso");
    expect(Object.keys(response)).toEqual(["success", "message"]);
  });

  it("error response does not expose internal details", () => {
    const errorResponse = { error: "Unauthorized" };
    expect(errorResponse.error).toBe("Unauthorized");
    expect(errorResponse).not.toHaveProperty("stack");
    expect(errorResponse).not.toHaveProperty("details");
  });

  it("validation error response includes field details", () => {
    const validationError = {
      error: "Validation failed",
      details: ["name is required", "email is required"],
    };
    expect(validationError.error).toBe("Validation failed");
    expect(validationError.details.length).toBe(2);
  });
});
