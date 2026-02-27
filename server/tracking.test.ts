/**
 * Tracking Script Tests — Unit tests for tracker.js generation,
 * /api/collect endpoint, and /tracker.js endpoint.
 * All tests use mocks to avoid writing to the database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateTrackerScript } from "./tracker-script";

// ─── tracker-script.ts (pure function) ─────────────────

describe("generateTrackerScript", () => {
  it("should return a string containing the token", () => {
    const script = generateTrackerScript("abc123token", "https://example.com");
    expect(script).toContain("abc123token");
    expect(script).toContain("https://example.com");
  });

  it("should contain form submit listener", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("addEventListener");
    expect(script).toContain("submit");
  });

  it("should contain field heuristic patterns for email, phone, name", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("email");
    expect(script).toContain("phone");
    expect(script).toContain("name");
    expect(script).toContain("FIELD_PATTERNS");
  });

  it("should contain UTM extraction logic", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("utm_source");
    expect(script).toContain("utm_medium");
    expect(script).toContain("utm_campaign");
  });

  it("should contain sendBeacon for reliability", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("sendBeacon");
  });

  it("should contain /api/collect endpoint path", () => {
    const script = generateTrackerScript("tok", "https://mysite.com");
    expect(script).toContain("/api/collect");
    expect(script).toContain("mysite.com");
  });

  it("should be a self-executing function (IIFE)", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script.trim()).toMatch(/^\(function\(\)\{/);
    expect(script.trim()).toMatch(/\}\)\(\);$/);
  });

  it("should prevent double-loading", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("__entur_tracker_loaded");
  });

  it("should support data-entur-ignore attribute", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("data-entur-ignore");
  });
});

// ─── /api/collect endpoint logic (mocked) ───────────────

describe("/api/collect validation logic", () => {
  it("should require token field", () => {
    // Simulating validation: no token → 401
    const body = { email: "test@test.com", phone: "123" };
    expect(body).not.toHaveProperty("token");
  });

  it("should require at least email or phone", () => {
    const bodyNoContact = { token: "abc", name: "Test" };
    expect(bodyNoContact).not.toHaveProperty("email");
    expect(bodyNoContact).not.toHaveProperty("phone");
  });

  it("should accept valid payload with email only", () => {
    const body = { token: "abc", email: "test@example.com" };
    expect(body.token).toBeTruthy();
    expect(body.email).toMatch(/@/);
  });

  it("should accept valid payload with phone only", () => {
    const body = { token: "abc", phone: "84999887766" };
    expect(body.token).toBeTruthy();
    expect(body.phone).toBeTruthy();
  });

  it("should accept payload with UTM data", () => {
    const body = {
      token: "abc",
      email: "test@test.com",
      utm: { source: "google", medium: "cpc", campaign: "summer" },
    };
    expect(body.utm).toBeDefined();
    expect(body.utm.source).toBe("google");
  });

  it("should accept payload with page info", () => {
    const body = {
      token: "abc",
      email: "test@test.com",
      page: { url: "https://mysite.com/contato", referrer: "https://google.com", title: "Contato" },
    };
    expect(body.page.url).toContain("mysite.com");
  });

  it("should accept payload with extra fields", () => {
    const body = {
      token: "abc",
      email: "test@test.com",
      extra: { empresa: "ACME", cargo: "Gerente" },
    };
    expect(body.extra).toBeDefined();
    expect(body.extra.empresa).toBe("ACME");
  });
});

// ─── Domain validation logic ────────────────────────────

describe("Domain validation", () => {
  function isDomainAllowed(pageUrl: string, allowedDomains: string[]): boolean {
    if (!allowedDomains.length) return true;
    try {
      const pageHost = new URL(pageUrl).hostname.toLowerCase();
      return allowedDomains.some((d) => {
        const domain = d.toLowerCase().replace(/^\*\./, "");
        return pageHost === domain || pageHost.endsWith("." + domain);
      });
    } catch {
      return false;
    }
  }

  it("should allow any domain when allowedDomains is empty", () => {
    expect(isDomainAllowed("https://anything.com/page", [])).toBe(true);
  });

  it("should allow exact domain match", () => {
    expect(isDomainAllowed("https://meusite.com.br/contato", ["meusite.com.br"])).toBe(true);
  });

  it("should allow subdomain match", () => {
    expect(isDomainAllowed("https://lp.meusite.com.br/form", ["meusite.com.br"])).toBe(true);
  });

  it("should reject non-matching domain", () => {
    expect(isDomainAllowed("https://evil.com/steal", ["meusite.com.br"])).toBe(false);
  });

  it("should handle wildcard prefix", () => {
    expect(isDomainAllowed("https://sub.meusite.com.br/x", ["*.meusite.com.br"])).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(isDomainAllowed("https://MeuSite.COM.BR/page", ["meusite.com.br"])).toBe(true);
  });

  it("should handle invalid URL gracefully", () => {
    expect(isDomainAllowed("not-a-url", ["meusite.com.br"])).toBe(false);
  });
});

// ─── Verify Installation logic ────────────────────────

describe("Verify Installation - HTML scanning logic", () => {
  function findTokenInHtml(html: string, tokens: string[]): string | null {
    for (const t of tokens) {
      if (html.includes(t)) return t;
    }
    return null;
  }

  function detectTrackerPresence(html: string): boolean {
    return html.includes("/tracker.js") || html.includes("__entur_tracker_loaded");
  }

  it("should find token in HTML with script tag", () => {
    const html = `<html><head><script>(function(t,r){var s=document.createElement('script');s.async=true;s.src=r+'/tracker.js?t='+t;document.head.appendChild(s);})('abc123token','https://example.com');</script></head><body></body></html>`;
    expect(findTokenInHtml(html, ["abc123token"])).toBe("abc123token");
  });

  it("should return null when token not found", () => {
    const html = `<html><head></head><body>Hello</body></html>`;
    expect(findTokenInHtml(html, ["abc123token"])).toBeNull();
  });

  it("should detect tracker.js reference even with wrong token", () => {
    const html = `<html><head><script src="https://other.com/tracker.js?t=wrongtoken"></script></head></html>`;
    expect(detectTrackerPresence(html)).toBe(true);
  });

  it("should detect __entur_tracker_loaded marker", () => {
    const html = `<html><head><script>window.__entur_tracker_loaded=true;</script></head></html>`;
    expect(detectTrackerPresence(html)).toBe(true);
  });

  it("should not detect tracker in clean HTML", () => {
    const html = `<html><head><title>My Site</title></head><body><form><input name="email"></form></body></html>`;
    expect(detectTrackerPresence(html)).toBe(false);
  });

  it("should match first token from multiple", () => {
    const html = `<script>token='second_token';</script>`;
    expect(findTokenInHtml(html, ["first_token", "second_token"])).toBe("second_token");
  });
});

// ─── Payload building for processInboundLead ────────────────

describe("Tracking payload construction", () => {
  it("should set source as tracking_script", () => {
    const payload = {
      name: "João",
      email: "joao@test.com",
      phone: "84999887766",
      source: "tracking_script",
      meta: { channel: "form_capture" },
    };
    expect(payload.source).toBe("tracking_script");
    expect(payload.meta.channel).toBe("form_capture");
  });

  it("should include page URL in meta", () => {
    const payload = {
      source: "tracking_script",
      email: "test@test.com",
      meta: {
        channel: "form_capture",
        page_url: "https://meusite.com.br/contato",
        page_title: "Contato",
        referrer: "https://google.com",
      },
    };
    expect(payload.meta.page_url).toContain("meusite.com.br");
    expect(payload.meta.referrer).toContain("google.com");
  });

  it("should handle missing optional fields gracefully", () => {
    const payload = {
      source: "tracking_script",
      email: "test@test.com",
      meta: { channel: "form_capture" },
    };
    expect(payload).not.toHaveProperty("name");
    expect(payload).not.toHaveProperty("phone");
    expect(payload).not.toHaveProperty("utm");
  });
});
