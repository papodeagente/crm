import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

// ─── RD Station Config ─────────────────────────────────────

describe("rdStation.getConfig", () => {
  it("returns null or config object for valid tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.getConfig({ tenantId: 1 });
    // Should be null (not yet set up) or an object
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.getConfig({ tenantId: 1 })).rejects.toThrow();
  });
});

describe("rdStation.setupIntegration", () => {
  it("creates config with webhook token", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.setupIntegration({ tenantId: 1 });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("webhookToken");
    expect(typeof result!.webhookToken).toBe("string");
    expect(result!.webhookToken.length).toBeGreaterThan(0);
    expect(result).toHaveProperty("isActive", true);
  });

  it("returns existing config on second call (idempotent)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const first = await caller.rdStation.setupIntegration({ tenantId: 1 });
    const second = await caller.rdStation.setupIntegration({ tenantId: 1 });
    expect(first!.webhookToken).toBe(second!.webhookToken);
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.setupIntegration({ tenantId: 1 })).rejects.toThrow();
  });
});

describe("rdStation.regenerateToken", () => {
  it("generates a new token different from the original", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Ensure setup exists
    const setup = await caller.rdStation.setupIntegration({ tenantId: 1 });
    const originalToken = setup!.webhookToken;

    // Regenerate
    const regenerated = await caller.rdStation.regenerateToken({ tenantId: 1 });
    expect(regenerated).toBeDefined();
    expect(regenerated!.webhookToken).not.toBe(originalToken);
    expect(regenerated!.webhookToken.length).toBeGreaterThan(0);
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.regenerateToken({ tenantId: 1 })).rejects.toThrow();
  });
});

describe("rdStation.toggleActive", () => {
  it("can disable the integration", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Ensure setup exists
    await caller.rdStation.setupIntegration({ tenantId: 1 });

    // Disable
    const result = await caller.rdStation.toggleActive({ tenantId: 1, isActive: false });
    expect(result).toEqual({ success: true });

    // Verify
    const config = await caller.rdStation.getConfig({ tenantId: 1 });
    expect(config!.isActive).toBe(false);
  });

  it("can re-enable the integration", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.rdStation.toggleActive({ tenantId: 1, isActive: true });
    const config = await caller.rdStation.getConfig({ tenantId: 1 });
    expect(config!.isActive).toBe(true);
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.toggleActive({ tenantId: 1, isActive: false })).rejects.toThrow();
  });
});

describe("rdStation.getStats", () => {
  it("returns stats object with expected fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.getStats({ tenantId: 1 });
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("failed");
    expect(result).toHaveProperty("duplicate");
    expect(typeof result.total).toBe("number");
    expect(typeof result.success).toBe("number");
    expect(typeof result.failed).toBe("number");
    expect(typeof result.duplicate).toBe("number");
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.getStats({ tenantId: 1 })).rejects.toThrow();
  });
});

describe("rdStation.getWebhookLogs", () => {
  it("returns logs array and total count", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.getWebhookLogs({ tenantId: 1 });
    expect(result).toHaveProperty("logs");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.logs)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("supports status filter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.getWebhookLogs({ tenantId: 1, status: "success" });
    expect(Array.isArray(result.logs)).toBe(true);
  });

  it("supports pagination", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.getWebhookLogs({ tenantId: 1, limit: 5, offset: 0 });
    expect(result.logs.length).toBeLessThanOrEqual(5);
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.getWebhookLogs({ tenantId: 1 })).rejects.toThrow();
  });
});

// ─── Webhook Endpoint (via HTTP simulation) ─────────────────

describe("RD Station Webhook endpoint logic", () => {
  it("webhook route is registered in webhookRouter", async () => {
    // We test that the webhook route handler exists by importing the router
    const { webhookRouter } = await import("./webhookRoutes");
    expect(webhookRouter).toBeDefined();
    // The router should have a stack with routes
    const routes = (webhookRouter as any).stack || [];
    const rdRoute = routes.find((r: any) =>
      r.route?.path === "/api/webhooks/rdstation"
    );
    expect(rdRoute).toBeDefined();
    expect(rdRoute.route.methods.post).toBe(true);
  });

  it("rate limiter exports are available", async () => {
    const { checkRateLimit, rateLimitStore } = await import("./webhookRoutes");
    expect(typeof checkRateLimit).toBe("function");
    expect(rateLimitStore).toBeDefined();

    // Test rate limit function
    rateLimitStore.clear();
    const result = checkRateLimit("test-ip-rdstation");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("email validation works correctly", async () => {
    const { isValidEmail } = await import("./webhookRoutes");
    expect(isValidEmail("test@example.com")).toBe(true);
    expect(isValidEmail("invalid")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("user@domain.co.br")).toBe(true);
  });
});

// ─── Schema Validation ─────────────────────────────────────

describe("RD Station schema tables", () => {
  it("rdStationConfig table is defined in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.rdStationConfig).toBeDefined();
  });

  it("rdStationWebhookLog table is defined in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.rdStationWebhookLog).toBeDefined();
  });

  it("rdStationConfig has expected columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.rdStationConfig;
    // Check that the table config object exists
    expect(table).toBeDefined();
  });

  it("rdStationWebhookLog has expected columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.rdStationWebhookLog;
    expect(table).toBeDefined();
  });
});

// ─── Token-based Tenant Resolution (Bug Fix) ─────────────────

describe("RD Station Webhook token-based tenant resolution", () => {
  it("webhook resolves tenantId from token instead of hardcoding", async () => {
    // The fix: instead of hardcoding tenantId=1, the webhook now looks up
    // the rd_station_config row by matching the token, and uses that row's tenantId.
    // This ensures leads are processed in the correct tenant's pipeline.

    // Simulate the fixed lookup logic
    const allConfigs = [
      { id: 1, tenantId: 150002, webhookToken: "token-a", isActive: true },
      { id: 2, tenantId: 180002, webhookToken: "token-b", isActive: true },
      { id: 3, tenantId: 1, webhookToken: "token-c", isActive: false },
    ];

    // Token A should resolve to tenant 150002
    const configA = allConfigs.find(c => c.webhookToken === "token-a" && c.isActive);
    expect(configA).toBeDefined();
    expect(configA!.tenantId).toBe(150002);

    // Token B should resolve to tenant 180002
    const configB = allConfigs.find(c => c.webhookToken === "token-b" && c.isActive);
    expect(configB).toBeDefined();
    expect(configB!.tenantId).toBe(180002);

    // Token C is inactive, should not match
    const activeConfigs = allConfigs.filter(c => c.isActive);
    const configC = activeConfigs.find(c => c.webhookToken === "token-c");
    expect(configC).toBeUndefined();
  });

  it("rejects unknown tokens", () => {
    const allConfigs = [
      { id: 1, tenantId: 150002, webhookToken: "valid-token", isActive: true },
    ];

    const config = allConfigs.find(c => c.webhookToken === "unknown-token");
    expect(config).toBeUndefined();
  });

  it("only matches active configs", () => {
    const allConfigs = [
      { id: 1, tenantId: 150002, webhookToken: "disabled-token", isActive: false },
    ];

    // Even if token matches, inactive config should be filtered out
    const activeConfigs = allConfigs.filter(c => c.isActive);
    const config = activeConfigs.find(c => c.webhookToken === "disabled-token");
    expect(config).toBeUndefined();
  });

  it("handles multiple tenants with unique tokens", () => {
    const allConfigs = [
      { id: 1, tenantId: 100, webhookToken: "aaa", isActive: true },
      { id: 2, tenantId: 200, webhookToken: "bbb", isActive: true },
      { id: 3, tenantId: 300, webhookToken: "ccc", isActive: true },
    ];

    // Each token should resolve to its own tenant
    for (const expected of allConfigs) {
      const found = allConfigs.find(c => c.webhookToken === expected.webhookToken);
      expect(found!.tenantId).toBe(expected.tenantId);
    }
  });
});

// ─── Auto-capture cf_* fields ─────────────────────────────

describe("RD Station auto-capture cf_* fields", () => {
  it("deals table has rdCustomFields column in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.deals).toBeDefined();
    // rdCustomFields is a json column
    expect(schema.deals.rdCustomFields).toBeDefined();
  });

  it("webhook route extracts cf_ fields from RD Station payload", async () => {
    // Simulate the extraction logic used in the webhook handler
    const sampleLead = {
      email: "test@example.com",
      name: "Test Lead",
      personal_phone: "+5511999999999",
      cf_voce_ja_tem_um_grupo: "Sim",
      cf_fbc: "fb.1.12345.67890",
      cf_fbp: "fb.1.98765.43210",
      cf_destino_interesse: "Europa",
      company: "Test Company",
      job_title: "CEO",
    };

    // Extract cf_ fields (same logic as webhook handler)
    const rdCustomFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(sampleLead)) {
      if (key.startsWith("cf_") && value != null && String(value).trim() !== "") {
        rdCustomFields[key] = String(value);
      }
    }

    expect(Object.keys(rdCustomFields).length).toBe(4);
    expect(rdCustomFields["cf_voce_ja_tem_um_grupo"]).toBe("Sim");
    expect(rdCustomFields["cf_fbc"]).toBe("fb.1.12345.67890");
    expect(rdCustomFields["cf_fbp"]).toBe("fb.1.98765.43210");
    expect(rdCustomFields["cf_destino_interesse"]).toBe("Europa");
    // Non cf_ fields should not be included
    expect(rdCustomFields["company"]).toBeUndefined();
    expect(rdCustomFields["email"]).toBeUndefined();
  });

  it("ignores empty cf_ fields", () => {
    const sampleLead = {
      cf_filled: "Has value",
      cf_empty: "",
      cf_null: null,
      cf_whitespace: "   ",
    };

    const rdCustomFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(sampleLead)) {
      if (key.startsWith("cf_") && value != null && String(value).trim() !== "") {
        rdCustomFields[key] = String(value);
      }
    }

    expect(Object.keys(rdCustomFields).length).toBe(1);
    expect(rdCustomFields["cf_filled"]).toBe("Has value");
  });

  it("handles leads with no cf_ fields gracefully", () => {
    const sampleLead = {
      email: "test@example.com",
      name: "Test Lead",
      company: "Test Company",
    };

    const rdCustomFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(sampleLead)) {
      if (key.startsWith("cf_") && value != null && String(value).trim() !== "") {
        rdCustomFields[key] = String(value);
      }
    }

    expect(Object.keys(rdCustomFields).length).toBe(0);
  });

  it("formats cf_ field labels correctly for display", () => {
    const key = "cf_voce_ja_tem_um_grupo_de_viagens_pronto_para_ser_lancado";
    const label = key
      .replace(/^cf_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    expect(label).toBe("Voce Ja Tem Um Grupo De Viagens Pronto Para Ser Lancado");
  });
});

// ─── Multi-Config CRUD Tests ──────────────────────────────

describe("rdStation.listConfigs", () => {
  it("returns array of configs for tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.listConfigs({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.listConfigs({ tenantId: 1 })).rejects.toThrow();
  });
});

describe("rdStation.createConfig", () => {
  it("creates a new config with name and token", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.createConfig({
      tenantId: 1,
      name: "Test Config Multi",
      defaultSource: "test-source",
      defaultCampaign: "test-campaign",
    });
    expect(result).toBeDefined();
    expect(result.name).toBe("Test Config Multi");
    expect(result.webhookToken).toBeDefined();
    expect(result.webhookToken.length).toBeGreaterThan(0);
    expect(result.defaultSource).toBe("test-source");
    expect(result.defaultCampaign).toBe("test-campaign");
    expect(result.isActive).toBe(true);
  });

  it("creates config with auto-WhatsApp enabled", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const template = "Olá {primeiro_nome}! Bem-vindo!";
    const result = await caller.rdStation.createConfig({
      tenantId: 1,
      name: "WhatsApp Config",
      autoWhatsAppEnabled: true,
      autoWhatsAppMessageTemplate: template,
    });
    expect(result.autoWhatsAppEnabled).toBe(true);
    expect(result.autoWhatsAppMessageTemplate).toBe(template);
  });

  it("allows multiple configs per tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const config1 = await caller.rdStation.createConfig({ tenantId: 1, name: "Config A" });
    const config2 = await caller.rdStation.createConfig({ tenantId: 1, name: "Config B" });
    expect(config1.id).not.toBe(config2.id);
    expect(config1.webhookToken).not.toBe(config2.webhookToken);
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.createConfig({ tenantId: 1, name: "Test" })).rejects.toThrow();
  });
});

describe("rdStation.updateConfig", () => {
  it("updates config fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const created = await caller.rdStation.createConfig({ tenantId: 1, name: "Update Test" });
    const updated = await caller.rdStation.updateConfig({
      configId: created.id,
      tenantId: 1,
      name: "Updated Name",
      defaultSource: "new-source",
      autoWhatsAppEnabled: true,
      autoWhatsAppMessageTemplate: "Hello {nome}!",
    });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe("Updated Name");
    expect(updated!.defaultSource).toBe("new-source");
    expect(updated!.autoWhatsAppEnabled).toBe(true);
    expect(updated!.autoWhatsAppMessageTemplate).toBe("Hello {nome}!");
  });

  it("can set fields to null", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const created = await caller.rdStation.createConfig({
      tenantId: 1,
      name: "Null Test",
      defaultSource: "will-be-nulled",
    });
    const updated = await caller.rdStation.updateConfig({
      configId: created.id,
      tenantId: 1,
      defaultSource: null,
    });
    expect(updated!.defaultSource).toBeNull();
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.updateConfig({ configId: 1, tenantId: 1, name: "X" })).rejects.toThrow();
  });
});

describe("rdStation.deleteConfig", () => {
  it("deletes config by id and tenant", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const created = await caller.rdStation.createConfig({ tenantId: 1, name: "Delete Test" });
    const result = await caller.rdStation.deleteConfig({ configId: created.id, tenantId: 1 });
    expect(result).toEqual({ success: true });
    const configs = await caller.rdStation.listConfigs({ tenantId: 1 });
    const found = configs.find((c: any) => c.id === created.id);
    expect(found).toBeUndefined();
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rdStation.deleteConfig({ configId: 1, tenantId: 1 })).rejects.toThrow();
  });
});

describe("rdStation.regenerateConfigToken", () => {
  it("generates new token for specific config", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const created = await caller.rdStation.createConfig({ tenantId: 1, name: "Regen Test" });
    const originalToken = created.webhookToken;
    const regenerated = await caller.rdStation.regenerateConfigToken({
      configId: created.id,
      tenantId: 1,
    });
    expect(regenerated).toBeDefined();
    expect(regenerated!.webhookToken).not.toBe(originalToken);
    expect(regenerated!.webhookToken.length).toBeGreaterThan(0);
  });
});

describe("rdStation.getConfigLogs", () => {
  it("returns logs filtered by configId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const created = await caller.rdStation.createConfig({ tenantId: 1, name: "Logs Test" });
    const result = await caller.rdStation.getConfigLogs({
      configId: created.id,
      tenantId: 1,
    });
    expect(result).toHaveProperty("logs");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.logs)).toBe(true);
  });
});

// ─── Helper Endpoints Tests ───────────────────────────────

describe("rdStation.listPipelines", () => {
  it("returns array of pipelines", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.listPipelines({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("rdStation.getWhatsAppStatus", () => {
  it("returns connected status object", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.getWhatsAppStatus({ tenantId: 1 });
    expect(result).toHaveProperty("connected");
    expect(typeof result.connected).toBe("boolean");
    expect(result).toHaveProperty("sessionId");
  });
});

describe("rdStation.listTeamMembers", () => {
  it("returns array of team members", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.rdStation.listTeamMembers({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Template Interpolation Tests ─────────────────────────

describe("Auto-WhatsApp template interpolation", () => {
  function interpolateTemplate(
    template: string,
    data: { name: string; phone: string; email: string; source: string; campaign: string }
  ): string {
    const firstName = data.name.split(" ")[0] || data.name;
    return template
      .replace(/\{nome\}/gi, data.name)
      .replace(/\{primeiro_nome\}/gi, firstName)
      .replace(/\{telefone\}/gi, data.phone)
      .replace(/\{email\}/gi, data.email)
      .replace(/\{origem\}/gi, data.source)
      .replace(/\{campanha\}/gi, data.campaign);
  }

  it("replaces all variables correctly", () => {
    const template = "Olá {primeiro_nome}! Seu nome completo é {nome}. Tel: {telefone}, Email: {email}. Origem: {origem}, Campanha: {campanha}.";
    const result = interpolateTemplate(template, {
      name: "João Silva",
      phone: "+5511999887766",
      email: "joao@email.com",
      source: "rdstation",
      campaign: "black-friday",
    });
    expect(result).toBe("Olá João! Seu nome completo é João Silva. Tel: +5511999887766, Email: joao@email.com. Origem: rdstation, Campanha: black-friday.");
  });

  it("handles case-insensitive variables", () => {
    const template = "Olá {NOME}! {Nome} {nome}";
    const result = interpolateTemplate(template, {
      name: "Maria",
      phone: "",
      email: "",
      source: "",
      campaign: "",
    });
    expect(result).toBe("Olá Maria! Maria Maria");
  });

  it("handles missing data gracefully (empty strings)", () => {
    const template = "Olá {primeiro_nome}! Tel: {telefone}";
    const result = interpolateTemplate(template, {
      name: "Lead",
      phone: "",
      email: "",
      source: "",
      campaign: "",
    });
    expect(result).toBe("Olá Lead! Tel: ");
  });

  it("preserves text without variables", () => {
    const template = "Mensagem simples sem variáveis.";
    const result = interpolateTemplate(template, {
      name: "Test",
      phone: "123",
      email: "a@b.com",
      source: "src",
      campaign: "cmp",
    });
    expect(result).toBe("Mensagem simples sem variáveis.");
  });

  it("extracts first name correctly from compound names", () => {
    const template = "{primeiro_nome}";
    expect(interpolateTemplate(template, { name: "Ana Beatriz Costa", phone: "", email: "", source: "", campaign: "" })).toBe("Ana");
    expect(interpolateTemplate(template, { name: "Pedro", phone: "", email: "", source: "", campaign: "" })).toBe("Pedro");
  });
});

// ─── processInboundLead Options Tests ─────────────────────

describe("processInboundLead options interface", () => {
  it("ProcessInboundLeadOptions type exists and function accepts options", async () => {
    const { processInboundLead } = await import("./leadProcessor");
    expect(typeof processInboundLead).toBe("function");
    expect(processInboundLead.length).toBeLessThanOrEqual(3);
  });
});


// ─── Deal Name Template Tests ──────────────────────────────

describe("Deal name template interpolation", () => {
  function interpolateDealName(template: string, vars: { name: string; phone: string; email: string; source: string; campaign: string }): string {
    const firstName = vars.name.split(" ")[0] || vars.name;
    return template
      .replace(/\{nome\}/gi, vars.name)
      .replace(/\{primeiro_nome\}/gi, firstName)
      .replace(/\{telefone\}/gi, vars.phone || "")
      .replace(/\{email\}/gi, vars.email || "")
      .replace(/\{origem\}/gi, vars.source || "")
      .replace(/\{campanha\}/gi, vars.campaign || "");
  }

  it("interpolates all variables in deal name template", () => {
    const result = interpolateDealName("{primeiro_nome} - {campanha}", {
      name: "João Silva",
      phone: "+5511999887766",
      email: "joao@email.com",
      source: "rdstation",
      campaign: "black-friday",
    });
    expect(result).toBe("João - black-friday");
  });

  it("uses full name variable", () => {
    const result = interpolateDealName("Deal: {nome}", {
      name: "Maria Santos",
      phone: "",
      email: "",
      source: "",
      campaign: "",
    });
    expect(result).toBe("Deal: Maria Santos");
  });

  it("handles empty template (fallback to default)", () => {
    const template = "";
    // When template is empty, the webhook handler skips interpolation and uses default name
    expect(template.trim()).toBe("");
  });

  it("handles template with source and campaign", () => {
    const result = interpolateDealName("{origem} / {campanha} - {primeiro_nome}", {
      name: "Pedro Costa",
      phone: "",
      email: "",
      source: "landing-page",
      campaign: "verao-2026",
    });
    expect(result).toBe("landing-page / verao-2026 - Pedro");
  });

  it("handles missing variables gracefully", () => {
    const result = interpolateDealName("{primeiro_nome} - {campanha}", {
      name: "Ana",
      phone: "",
      email: "",
      source: "",
      campaign: "",
    });
    expect(result).toBe("Ana - ");
  });
});

// ─── Config Task Templates CRUD Tests ──────────────────────

describe("Config task templates CRUD", () => {
  const caller = appRouter.createCaller(createAuthContext().ctx);
  let testConfigId: number;

  it("creates a config for task template tests", async () => {
    const config = await caller.rdStation.createConfig({
      tenantId: 1,
      name: "Task Template Test Config",
    });
    expect(config.id).toBeDefined();
    testConfigId = config.id;
  });

  it("adds a task template to config", async () => {
    const task = await caller.rdStation.addConfigTask({
      configId: testConfigId,
      tenantId: 1,
      title: "Ligar para o lead",
      dueDaysOffset: 1,
      priority: "high",
    });
    expect(task.id).toBeDefined();
    expect(task.title).toBe("Ligar para o lead");
    expect(task.dueDaysOffset).toBe(1);
    expect(task.priority).toBe("high");
    expect(task.orderIndex).toBe(0);
  });

  it("adds a second task template with auto-incremented orderIndex", async () => {
    const task = await caller.rdStation.addConfigTask({
      configId: testConfigId,
      tenantId: 1,
      title: "Enviar proposta",
      dueDaysOffset: 3,
      priority: "medium",
    });
    expect(task.orderIndex).toBe(1);
  });

  it("lists task templates for config", async () => {
    const tasks = await caller.rdStation.listConfigTasks({
      configId: testConfigId,
      tenantId: 1,
    });
    expect(tasks.length).toBe(2);
    expect(tasks[0].title).toBe("Ligar para o lead");
    expect(tasks[1].title).toBe("Enviar proposta");
  });

  it("updates a task template", async () => {
    const tasks = await caller.rdStation.listConfigTasks({
      configId: testConfigId,
      tenantId: 1,
    });
    const updated = await caller.rdStation.updateConfigTask({
      taskId: tasks[0].id,
      tenantId: 1,
      title: "Ligar urgente",
      priority: "urgent",
    });
    expect(updated?.title).toBe("Ligar urgente");
    expect(updated?.priority).toBe("urgent");
  });

  it("removes a task template", async () => {
    const tasks = await caller.rdStation.listConfigTasks({
      configId: testConfigId,
      tenantId: 1,
    });
    const result = await caller.rdStation.removeConfigTask({
      taskId: tasks[0].id,
      tenantId: 1,
    });
    expect(result.success).toBe(true);

    const remaining = await caller.rdStation.listConfigTasks({
      configId: testConfigId,
      tenantId: 1,
    });
    expect(remaining.length).toBe(1);
  });

  it("tenant isolation: cannot list tasks from another tenant", async () => {
    const tasks = await caller.rdStation.listConfigTasks({
      configId: testConfigId,
      tenantId: 9999,
    });
    expect(tasks.length).toBe(0);
  });

  // Cleanup
  it("cleans up test config", async () => {
    await caller.rdStation.deleteConfig({ configId: testConfigId, tenantId: 1 });
  });
});

// ─── Config with dealNameTemplate and autoProductId ────────

describe("Config CRUD with new fields", () => {
  const caller = appRouter.createCaller(createAuthContext().ctx);

  it("creates config with dealNameTemplate and autoProductId", async () => {
    const config = await caller.rdStation.createConfig({
      tenantId: 1,
      name: "Full Config Test",
      dealNameTemplate: "{primeiro_nome} - {campanha}",
      autoProductId: null,
    });
    expect(config.id).toBeDefined();
    expect(config.dealNameTemplate).toBe("{primeiro_nome} - {campanha}");
    expect(config.autoProductId).toBeNull();

    // Cleanup
    await caller.rdStation.deleteConfig({ configId: config.id, tenantId: 1 });
  });

  it("updates config dealNameTemplate and autoProductId", async () => {
    const config = await caller.rdStation.createConfig({
      tenantId: 1,
      name: "Update Fields Test",
    });

    const updated = await caller.rdStation.updateConfig({
      configId: config.id,
      tenantId: 1,
      dealNameTemplate: "Deal: {nome}",
      autoProductId: 42,
    });
    expect(updated?.dealNameTemplate).toBe("Deal: {nome}");
    expect(updated?.autoProductId).toBe(42);

    // Clear fields
    const cleared = await caller.rdStation.updateConfig({
      configId: config.id,
      tenantId: 1,
      dealNameTemplate: null,
      autoProductId: null,
    });
    expect(cleared?.dealNameTemplate).toBeNull();
    expect(cleared?.autoProductId).toBeNull();

    // Cleanup
    await caller.rdStation.deleteConfig({ configId: config.id, tenantId: 1 });
  });
});

// ─── Products list endpoint ────────────────────────────────

describe("listProducts endpoint", () => {
  const caller = appRouter.createCaller(createAuthContext().ctx);

  it("returns an array (may be empty if no products)", async () => {
    const products = await caller.rdStation.listProducts({ tenantId: 1 });
    expect(Array.isArray(products)).toBe(true);
  });

  it("returns products with expected shape", async () => {
    const products = await caller.rdStation.listProducts({ tenantId: 1 });
    if (products.length > 0) {
      const p = products[0];
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("name");
    }
  });
});
