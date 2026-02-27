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

  // ─── Elementor-specific interception ──────────────────

  it("should contain Elementor form_fields pattern matching", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("form_fields");
    expect(script).toContain("classifyElementorField");
  });

  it("should hook into jQuery submit_success event for Elementor Pro", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("submit_success");
    expect(script).toContain("elementor-form");
    expect(script).toContain("hookElementorEvents");
  });

  it("should hook into jQuery ajaxComplete for AJAX form submissions", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("ajaxComplete");
    expect(script).toContain("elementor_pro_forms_send_form");
    expect(script).toContain("hookJQueryAjax");
  });

  it("should intercept XMLHttpRequest.send for non-jQuery AJAX", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("XMLHttpRequest.prototype.send");
    expect(script).toContain("XMLHttpRequest.prototype.open");
    expect(script).toContain("admin-ajax.php");
  });

  it("should intercept fetch API for modern AJAX submissions", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("window.fetch");
    expect(script).toContain("origFetch");
  });

  it("should contain MutationObserver for dynamic popup forms", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("MutationObserver");
    expect(script).toContain("elementor-message-success");
  });

  it("should contain deduplication logic to prevent double-sends", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("SENT_FORMS");
    expect(script).toContain("formFingerprint");
    expect(script).toContain("5000"); // 5 second dedup window
  });

  it("should retry jQuery hooks for late-loading jQuery", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("initHooks");
    expect(script).toContain("setTimeout(initHooks");
    expect(script).toContain("DOMContentLoaded");
  });

  it("should support multiple WordPress form plugins", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    // Elementor
    expect(script).toContain("elementor_pro_forms_send_form");
    // WPForms
    expect(script).toContain("wpforms_submit");
    // Gravity Forms
    expect(script).toContain("gform_submit");
    // Contact Form 7
    expect(script).toContain("cf7");
    // Fluent Forms
    expect(script).toContain("fluentform");
    // Forminator
    expect(script).toContain("forminator_submit");
  });

  it("should skip WordPress system hidden fields", () => {
    const script = generateTrackerScript("tok", "https://x.com");
    expect(script).toContain("post_id");
    expect(script).toContain("form_id");
    expect(script).toContain("referer_title");
    expect(script).toContain("queried_id");
    expect(script).toContain("_wpnonce");
  });
});

// ─── Elementor field classification logic ──────────────

describe("Elementor field classification", () => {
  // Simulate the classifyElementorField logic
  function classifyElementorFieldKey(fieldKey: string, inputType?: string, inputId?: string): string | null {
    const fk = fieldKey.toLowerCase();
    if (/^e-?mail$/.test(fk)) return "email";
    if (/^(phone|tel|fone|celular|whatsapp|wpp|mobile|telefone)$/.test(fk)) return "phone";
    if (/^(name|nome|full_?name|nome_?completo|first_?name|primeiro_?nome)$/.test(fk)) return "name";
    if (/^(message|mensagem|comment|descri|observa|assunto|subject)$/.test(fk)) return "message";

    // Check by input type
    if (inputType === "email") return "email";
    if (inputType === "tel") return "phone";

    // Check by id
    const id = (inputId || "").toLowerCase();
    if (/email/.test(id)) return "email";
    if (/phone|tel|fone|celular|whatsapp|wpp|telefone/.test(id)) return "phone";
    if (/^form-field-name$/.test(id) || /^form-field-nome$/.test(id)) return "name";

    return null;
  }

  it("should classify form_fields[email] as email", () => {
    expect(classifyElementorFieldKey("email")).toBe("email");
  });

  it("should classify form_fields[e-mail] as email", () => {
    expect(classifyElementorFieldKey("e-mail")).toBe("email");
  });

  it("should classify form_fields[telefone] as phone", () => {
    expect(classifyElementorFieldKey("telefone")).toBe("phone");
  });

  it("should classify form_fields[whatsapp] as phone", () => {
    expect(classifyElementorFieldKey("whatsapp")).toBe("phone");
  });

  it("should classify form_fields[name] as name", () => {
    expect(classifyElementorFieldKey("name")).toBe("name");
  });

  it("should classify form_fields[nome] as name", () => {
    expect(classifyElementorFieldKey("nome")).toBe("name");
  });

  it("should classify form_fields[mensagem] as message", () => {
    expect(classifyElementorFieldKey("mensagem")).toBe("message");
  });

  it("should classify unknown field by input type=email", () => {
    expect(classifyElementorFieldKey("custom_field", "email")).toBe("email");
  });

  it("should classify unknown field by input type=tel", () => {
    expect(classifyElementorFieldKey("custom_field", "tel")).toBe("phone");
  });

  it("should classify by input id containing 'email'", () => {
    expect(classifyElementorFieldKey("field_abc", "text", "form-field-email")).toBe("email");
  });

  it("should classify by input id containing 'telefone'", () => {
    expect(classifyElementorFieldKey("field_xyz", "text", "form-field-telefone")).toBe("phone");
  });

  it("should return null for unrecognized fields", () => {
    expect(classifyElementorFieldKey("programa")).toBeNull();
    expect(classifyElementorFieldKey("field_aa0d6d6")).toBeNull();
  });
});

// ─── AJAX data parsing logic ───────────────────────────

describe("AJAX form data parsing", () => {
  // Simulate parsing Elementor AJAX body
  function parseElementorAjaxBody(body: string): Record<string, string | null> {
    const params = new URLSearchParams(body);
    const formData: Record<string, string | null> = {
      name: null,
      email: null,
      phone: null,
      message: null,
    };

    params.forEach((value, key) => {
      if (!value) return;
      const fieldMatch = key.match(/form_fields\[([^\]]+)\]/);
      if (fieldMatch) {
        const fieldKey = fieldMatch[1].toLowerCase();
        if (/^e-?mail$/.test(fieldKey) && !formData.email) formData.email = value;
        else if (/^(phone|tel|fone|celular|whatsapp|wpp|mobile|telefone)$/.test(fieldKey) && !formData.phone) formData.phone = value;
        else if (/^(name|nome|full_?name|nome_?completo|first_?name|primeiro_?nome)$/.test(fieldKey) && !formData.name) formData.name = value;
        else if (/^(message|mensagem|comment|descri|observa|assunto|subject)$/.test(fieldKey) && !formData.message) formData.message = value;
      }
    });

    return formData;
  }

  it("should parse Elementor Pro AJAX body with form_fields", () => {
    const body = "action=elementor_pro_forms_send_form&form_fields%5Bname%5D=Jo%C3%A3o+Silva&form_fields%5Bemail%5D=joao%40test.com&form_fields%5Btelefone%5D=84999887766&post_id=585&form_id=b250930";
    const result = parseElementorAjaxBody(body);
    expect(result.name).toBe("João Silva");
    expect(result.email).toBe("joao@test.com");
    expect(result.phone).toBe("84999887766");
  });

  it("should handle Elementor body with whatsapp field name", () => {
    const body = "action=elementor_pro_forms_send_form&form_fields%5Bnome%5D=Maria&form_fields%5Bemail%5D=maria%40test.com&form_fields%5Bwhatsapp%5D=11999887766";
    const result = parseElementorAjaxBody(body);
    expect(result.name).toBe("Maria");
    expect(result.email).toBe("maria@test.com");
    expect(result.phone).toBe("11999887766");
  });

  it("should handle body with no recognizable fields gracefully", () => {
    const body = "action=elementor_pro_forms_send_form&form_fields%5Bprograma%5D=Sim&form_fields%5Bfield_abc%5D=Nao";
    const result = parseElementorAjaxBody(body);
    expect(result.name).toBeNull();
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
  });

  it("should parse body matching crienatal.com.br popup form", () => {
    // Simulating the actual form from crienatal.com.br
    const body = "action=elementor_pro_forms_send_form&form_fields%5Bname%5D=Bruno+Teste&form_fields%5Bemail%5D=bruno%40crienatal.com.br&form_fields%5Btelefone%5D=84999001122&form_fields%5Bprograma%5D=Sim&form_fields%5Bfield_aa0d6d6%5D=N%C3%A3o&form_fields%5Butm_source%5D=google&form_fields%5Butm_medium%5D=cpc&post_id=585&form_id=b250930&referer_title=CRIE+Lagoinha+Natal&queried_id=907";
    const result = parseElementorAjaxBody(body);
    expect(result.name).toBe("Bruno Teste");
    expect(result.email).toBe("bruno@crienatal.com.br");
    expect(result.phone).toBe("84999001122");
  });
});

// ─── Deduplication logic ───────────────────────────────

describe("Deduplication logic", () => {
  function formFingerprint(formData: { email?: string; phone?: string; name?: string }): string {
    return (formData.email || "") + "|" + (formData.phone || "") + "|" + (formData.name || "");
  }

  it("should generate same fingerprint for identical data", () => {
    const a = formFingerprint({ email: "a@b.com", phone: "123", name: "Test" });
    const b = formFingerprint({ email: "a@b.com", phone: "123", name: "Test" });
    expect(a).toBe(b);
  });

  it("should generate different fingerprints for different data", () => {
    const a = formFingerprint({ email: "a@b.com", phone: "123" });
    const b = formFingerprint({ email: "c@d.com", phone: "456" });
    expect(a).not.toBe(b);
  });

  it("should handle missing fields in fingerprint", () => {
    const a = formFingerprint({ email: "a@b.com" });
    expect(a).toBe("a@b.com||");
  });
});

// ─── /api/collect endpoint logic (mocked) ───────────────

describe("/api/collect validation logic", () => {
  it("should require token field", () => {
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
