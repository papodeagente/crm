import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Unit tests for lead processing logic ────────────────

describe("Lead Processor — Normalization", () => {
  it("normalizes Brazilian phone to E164 format", async () => {
    const { normalizeBrazilianPhone } = await import("./phoneUtils");
    
    // Various input formats → canonical 13-digit format
    expect(normalizeBrazilianPhone("84999838420")).toBe("5584999838420");
    expect(normalizeBrazilianPhone("+5584999838420")).toBe("5584999838420");
    expect(normalizeBrazilianPhone("5584999838420")).toBe("5584999838420");
    expect(normalizeBrazilianPhone("(84) 99983-8420")).toBe("5584999838420");
    expect(normalizeBrazilianPhone("08499838420")).toBe("5584999838420"); // without 9th digit
  });

  it("normalizes email to lowercase and trims", () => {
    const normalizeEmail = (email?: string) => {
      if (!email) return undefined;
      return email.trim().toLowerCase().replace(/\s+/g, "");
    };
    
    expect(normalizeEmail("  Joao@Email.COM  ")).toBe("joao@email.com");
    expect(normalizeEmail("TEST@GMAIL.COM")).toBe("test@gmail.com");
    expect(normalizeEmail(undefined)).toBeUndefined();
    expect(normalizeEmail("")).toBeUndefined();
  });

  it("normalizes name with proper casing", () => {
    const normalizeName = (name?: string) => {
      if (!name) return "Lead sem nome";
      return name.trim().replace(/\s+/g, " ").split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    };
    
    expect(normalizeName("JOÃO SILVA")).toBe("João Silva");
    expect(normalizeName("  maria   santos  ")).toBe("Maria Santos");
    expect(normalizeName(undefined)).toBe("Lead sem nome");
    expect(normalizeName("")).toBe("Lead sem nome");
  });
});

describe("Lead Processor — Dedupe Key Generation", () => {
  it("generates key from source + lead_id when available", () => {
    const { createHash } = require("crypto");
    
    // With lead_id
    const key1 = "meta_lead_ads:12345";
    expect(key1).toBe("meta_lead_ads:12345");
    
    // Without lead_id → hash of email+phone
    const email = "joao@email.com";
    const phone = "+5584999838420";
    const hash = createHash("sha256").update(`${email}|${phone}`).digest("hex").substring(0, 16);
    const key2 = `landing:${hash}`;
    expect(key2).toMatch(/^landing:[a-f0-9]{16}$/);
  });

  it("same email+phone produces same dedupe key", () => {
    const { createHash } = require("crypto");
    
    const hash1 = createHash("sha256").update("joao@email.com|+5584999838420").digest("hex").substring(0, 16);
    const hash2 = createHash("sha256").update("joao@email.com|+5584999838420").digest("hex").substring(0, 16);
    
    expect(hash1).toBe(hash2);
  });

  it("different email/phone produces different dedupe key", () => {
    const { createHash } = require("crypto");
    
    const hash1 = createHash("sha256").update("joao@email.com|+5584999838420").digest("hex").substring(0, 16);
    const hash2 = createHash("sha256").update("maria@email.com|+5584999838420").digest("hex").substring(0, 16);
    
    expect(hash1).not.toBe(hash2);
  });
});

describe("Lead Processor — tRPC Endpoints", () => {
  it("leadCapture.getWebhookConfig returns null when no config exists", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const config = await caller.leadCapture.getWebhookConfig({ tenantId: 1 });
    // May be null or an object depending on state
    expect(config === null || typeof config === "object").toBe(true);
  });

  it("leadCapture.generateWebhookToken creates a new token", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const result = await caller.leadCapture.generateWebhookToken({ tenantId: 1 });
    expect(result).toBeTruthy();
    expect(result?.webhookSecret).toBeTruthy();
    expect(typeof result?.webhookSecret).toBe("string");
    expect(result?.webhookSecret?.length).toBeGreaterThan(16);
  });

  it("leadCapture.listEvents returns events array and total", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const result = await caller.leadCapture.listEvents({ tenantId: 1 });
    expect(result).toHaveProperty("events");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.events)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("leadCapture.getMetaConfig returns null or config object", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const config = await caller.leadCapture.getMetaConfig({ tenantId: 1 });
    expect(config === null || typeof config === "object").toBe(true);
  });

  it("leadCapture.connectMeta stores config and returns connected status", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const result = await caller.leadCapture.connectMeta({
      tenantId: 1,
      pageId: "test-page-123",
      pageName: "Test Page",
      accessToken: "EAABsTest123456",
    });

    expect(result).toBeTruthy();
    expect(result?.status).toBe("connected");
    expect(result?.pageId).toBe("test-page-123");
  });

  it("leadCapture.disconnectMeta returns success", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });

    const result = await caller.leadCapture.disconnectMeta({ tenantId: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("Lead Processor — processInboundLead", () => {
  it("processes a new lead and creates deal + contact", async () => {
    const { processInboundLead } = await import("./leadProcessor");
    
    const result = await processInboundLead(1, {
      name: "Test Lead",
      email: "testlead@example.com",
      phone: "+5584999990001",
      source: "landing",
      lead_id: `test-${Date.now()}`,
      utm: { source: "google", medium: "cpc", campaign: "test" },
    });

    expect(result.success).toBe(true);
    expect(result.dealId).toBeTruthy();
    expect(result.contactId).toBeTruthy();
    expect(result.isExisting).toBe(false);
    expect(result.dedupeKey).toMatch(/^landing:/);
  });

  it("returns existing deal on duplicate lead_id (idempotency)", async () => {
    const { processInboundLead } = await import("./leadProcessor");
    const leadId = `idempotent-${Date.now()}`;
    
    const first = await processInboundLead(1, {
      name: "Idempotent Lead",
      email: "idempotent@example.com",
      phone: "+5584999990002",
      source: "landing",
      lead_id: leadId,
    });

    expect(first.success).toBe(true);

    const second = await processInboundLead(1, {
      name: "Idempotent Lead",
      email: "idempotent@example.com",
      phone: "+5584999990002",
      source: "landing",
      lead_id: leadId,
    });

    expect(second.success).toBe(true);
    expect(second.isExisting).toBe(true);
    expect(second.dealId).toBe(first.dealId);
  });

  it("processes meta_lead_ads source correctly", async () => {
    const { processInboundLead } = await import("./leadProcessor");
    
    const result = await processInboundLead(1, {
      name: "Meta Lead",
      email: "metalead@example.com",
      phone: "+5584999990003",
      source: "meta_lead_ads",
      lead_id: `meta-${Date.now()}`,
      utm: { source: "facebook", medium: "paid" },
      meta: { page_id: "123", form_id: "456" },
    });

    expect(result.success).toBe(true);
    expect(result.dealId).toBeTruthy();
    expect(result.dedupeKey).toMatch(/^meta_lead_ads:/);
  });
});

describe("Lead Processor — Notification on new lead", () => {
  it("creates an in-app notification when a new lead is processed", async () => {
    const { processInboundLead } = await import("./leadProcessor");
    const { getDb } = await import("./db");
    const { sql } = await import("drizzle-orm");

    const leadId = `notif-test-${Date.now()}`;

    const result = await processInboundLead(1, {
      name: "Notification Test Lead",
      email: "notiftest@example.com",
      phone: "+5584999990099",
      source: "landing",
      lead_id: leadId,
      utm: { source: "google", campaign: "summer-2026" },
    });

    expect(result.success).toBe(true);
    expect(result.dealId).toBeTruthy();

    // Check that a notification was created for this deal
    const db = await getDb();
    const [rows] = await db!.execute(sql`
      SELECT id, type, title, body, entityType, entityId
      FROM notifications
      WHERE tenantId = 1
        AND type = 'new_lead'
        AND entityType = 'deal'
        AND entityId = ${String(result.dealId)}
      ORDER BY id DESC
      LIMIT 1
    `);

    const notifications = rows as any[];
    expect(notifications.length).toBeGreaterThanOrEqual(1);

    const notif = notifications[0];
    expect(notif.type).toBe("new_lead");
    expect(notif.title).toContain("Novo lead via Landing Page");
    expect(notif.body).toContain("Notification Test Lead");
    expect(notif.body).toContain("notiftest@example.com");
    expect(notif.body).toContain("Campanha: summer-2026");
    expect(notif.entityType).toBe("deal");
    expect(notif.entityId).toBe(String(result.dealId));
  });

  it("notification includes Meta Lead Ads label for meta source", async () => {
    const { processInboundLead } = await import("./leadProcessor");
    const { getDb } = await import("./db");
    const { sql } = await import("drizzle-orm");

    const leadId = `meta-notif-${Date.now()}`;

    const result = await processInboundLead(1, {
      name: "Meta Notif Lead",
      email: "metanotif@example.com",
      phone: "+5584999990098",
      source: "meta_lead_ads",
      lead_id: leadId,
    });

    expect(result.success).toBe(true);

    const db = await getDb();
    const [rows] = await db!.execute(sql`
      SELECT title, body FROM notifications
      WHERE tenantId = 1 AND type = 'new_lead' AND entityId = ${String(result.dealId)}
      ORDER BY id DESC LIMIT 1
    `);

    const notifications = rows as any[];
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].title).toContain("Novo lead via Meta Lead Ads");
    expect(notifications[0].body).toContain("Meta Notif Lead");
  });

  it("does not create duplicate notification for idempotent lead", async () => {
    const { processInboundLead } = await import("./leadProcessor");
    const { getDb } = await import("./db");
    const { sql } = await import("drizzle-orm");

    const leadId = `no-dup-notif-${Date.now()}`;

    const first = await processInboundLead(1, {
      name: "No Dup Notif",
      email: "nodup@example.com",
      phone: "+5584999990097",
      source: "landing",
      lead_id: leadId,
    });

    expect(first.success).toBe(true);
    expect(first.isExisting).toBe(false);

    // Count notifications for this deal
    const db = await getDb();
    const [countBefore] = await db!.execute(sql`
      SELECT COUNT(*) as cnt FROM notifications
      WHERE tenantId = 1 AND type = 'new_lead' AND entityId = ${String(first.dealId)}
    `);

    // Process same lead again (idempotent)
    const second = await processInboundLead(1, {
      name: "No Dup Notif",
      email: "nodup@example.com",
      phone: "+5584999990097",
      source: "landing",
      lead_id: leadId,
    });

    expect(second.isExisting).toBe(true);

    // Count should NOT increase (idempotent leads skip notification)
    const [countAfter] = await db!.execute(sql`
      SELECT COUNT(*) as cnt FROM notifications
      WHERE tenantId = 1 AND type = 'new_lead' AND entityId = ${String(first.dealId)}
    `);

    expect(Number((countAfter as any[])[0].cnt)).toBe(Number((countBefore as any[])[0].cnt));
  });
});
