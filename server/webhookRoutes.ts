/**
 * Webhook Routes — Express routes for inbound lead capture.
 *
 * POST /webhooks/leads     → Landing Page webhook (Bearer token auth)
 * POST /webhooks/meta      → Meta Lead Ads webhook (X-Hub-Signature-256)
 * GET  /webhooks/meta      → Meta verification challenge
 * POST /webhooks/wp-leads  → WordPress Elementor webhook (api_key in body)
 */

import { Router, Request, Response } from "express";
import { createHmac } from "crypto";
import {
  processInboundLead,
  getWebhookConfig,
  getMetaConfig,
  type InboundLeadPayload,
} from "./leadProcessor";
import { getDb } from "./db";
import { eventLog, trackingTokens, rdStationConfig, rdStationWebhookLog, whatsappSessions, rdStationConfigTasks, productCatalog, dealProducts, tasks, webhookConfig, metaIntegrationConfig, teamMembers, crmUsers } from "../drizzle/schema";
import { createDealProduct, createTask, recalcDealValue } from "./crmDb";
import { eq, and, sql } from "drizzle-orm";
import { ENV } from "./_core/env";
import { generateTrackerScript } from "./tracker-script";
import { applyFieldMappings } from "./services/applyFieldMappings";


// ─── Tenant Resolution Helpers for Webhooks ───────────────

async function resolveWpTenantId(): Promise<number> {
  // WP_SECRET is global — resolve to the first active tenant that has a webhook config
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const configs = await db.select().from(webhookConfig).limit(1);
  if (configs.length === 0) throw new Error("No webhook config found for WP tenant");
  return configs[0].tenantId;
}

async function resolveLeadsTenantId(bearerToken: string): Promise<{ tenantId: number; config: any } | null> {
  const db = await getDb();
  if (!db) return null;
  const configs = await db.select().from(webhookConfig);
  const match = configs.find(c => c.webhookSecret === bearerToken);
  if (!match) return null;
  return { tenantId: match.tenantId, config: match };
}

async function resolveMetaTenantByVerifyToken(token: string): Promise<{ tenantId: number; config: any } | null> {
  const db = await getDb();
  if (!db) return null;
  const configs = await db.select().from(metaIntegrationConfig);
  const match = configs.find(c => c.verifyToken === token);
  if (!match) return null;
  return { tenantId: match.tenantId, config: match };
}

async function resolveMetaTenantFromBody(req: Request): Promise<{ tenantId: number; config: any } | null> {
  const db = await getDb();
  if (!db) return null;
  // Get all active meta configs and try to validate signature against each
  const configs = await db.select().from(metaIntegrationConfig).where(eq(metaIntegrationConfig.status, "connected"));
  for (const config of configs) {
    if (config.appSecret) {
      const signature = req.headers["x-hub-signature-256"] as string;
      if (signature) {
        const expectedSig = "sha256=" + createHmac("sha256", config.appSecret).update(JSON.stringify(req.body)).digest("hex");
        if (signature === expectedSig) {
          return { tenantId: config.tenantId, config };
        }
      }
    }
  }
  // Fallback: if only one config exists, use it
  if (configs.length === 1) return { tenantId: configs[0].tenantId, config: configs[0] };
  return null;
}

const router = Router();

// ─── Rate Limiter (in-memory, per IP) ───────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 30;       // max requests
const RATE_LIMIT_WINDOW = 60000; // 1 minute in ms

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const keys = Array.from(rateLimitStore.keys());
  for (const key of keys) {
    const entry = rateLimitStore.get(key);
    if (entry && now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW };
    rateLimitStore.set(ip, entry);
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// ─── EventLog Helper ────────────────────────────────────

async function logEvent(opts: {
  tenantId: number;
  actorType: "user" | "system" | "api" | "webhook";
  entityType: string;
  entityId?: number;
  action: string;
  metadataJson?: Record<string, any>;
}) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(eventLog).values({
      tenantId: opts.tenantId,
      actorType: opts.actorType,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      action: opts.action,
      metadataJson: opts.metadataJson ?? null,
    });
  } catch (err) {
    console.error("[EventLog] Failed to log event:", err);
  }
}

// ─── Email Validation ───────────────────────────────────

function isValidEmail(email: string): boolean {
  // Simple but effective email regex
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim().toLowerCase());
}

// ─── WordPress Elementor Webhook ────────────────────────

router.post("/api/webhooks/wp-leads", async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";

  try {
    // 1. Rate limiting
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
    }

    // 2. Validate api_key
    const { api_key } = req.body || {};
    if (!api_key || typeof api_key !== "string") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const wpSecret = ENV.wpSecret;
    if (!wpSecret || api_key !== wpSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 3. Resolve tenantId from webhook config (NOT hardcoded)
    const tenantId = await resolveWpTenantId();
    if (!tenantId) {
      console.error("[Webhook /wp-leads] Could not resolve tenantId");
      return res.status(500).json({ error: "Tenant resolution failed" });
    }

    // 3. Validate required fields
    const { name, email, phone, message, utm_source, utm_medium, utm_campaign } = req.body;

    const errors: string[] = [];
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

    if (errors.length > 0) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    // 4. Build UTM object if any UTM field is present
    const utm: InboundLeadPayload["utm"] = {};
    if (utm_source) utm.source = String(utm_source);
    if (utm_medium) utm.medium = String(utm_medium);
    if (utm_campaign) utm.campaign = String(utm_campaign);
    const hasUtm = Object.keys(utm).length > 0;

    // 5. Build payload for processInboundLead
    const payload: InboundLeadPayload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: message ? String(message).trim() : undefined,
      source: "wordpress",
      lead_id: undefined, // Elementor doesn't provide a unique lead_id
      utm: hasUtm ? utm : undefined,
      meta: {
        channel: "elementor",
        ip: clientIp,
      },
      raw: req.body,
    };

    // 6. Process the lead (creates/updates contact + creates deal)
    const result = await processInboundLead(tenantId, payload);

    if (result.success) {
      // 7. Log success in EventLog
      await logEvent({
        tenantId,
        actorType: "webhook",
        entityType: "lead",
        entityId: result.dealId,
        action: "lead_created",
        metadataJson: {
          origin: "elementor_webhook",
          dealId: result.dealId,
          contactId: result.contactId,
          dedupeKey: result.dedupeKey,
          isExisting: result.isExisting,
          source: "wordpress",
          channel: "elementor",
        },
      });

      return res.status(200).json({
        success: true,
        message: "Lead criado com sucesso",
      });
    } else {
      // Log failure
      await logEvent({
        tenantId,
        actorType: "webhook",
        entityType: "lead",
        action: "lead_failed",
        metadataJson: {
          origin: "elementor_webhook",
          error: result.error,
          dedupeKey: result.dedupeKey,
        },
      });

      return res.status(500).json({ error: "Failed to process lead" });
    }
  } catch (error: any) {
    console.error("[Webhook /wp-leads] Error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Landing Page Webhook ────────────────────────────────

router.post("/api/webhooks/leads", async (req: Request, res: Response) => {
  try {
    // Auth: Bearer token → resolve tenantId from token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = authHeader.substring(7);
    const resolved = await resolveLeadsTenantId(token);
    if (!resolved) {
      return res.status(403).json({ error: "Invalid webhook token" });
    }
    const tenantId = resolved.tenantId;
    const config = resolved.config;

    if (!config.isActive) {
      return res.status(503).json({ error: "Webhook is disabled" });
    }

    // Validate payload
    const body = req.body;
    if (!body || (!body.email && !body.phone)) {
      return res.status(400).json({ error: "Payload must include at least email or phone" });
    }

    const payload: InboundLeadPayload = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      message: body.message,
      source: body.source || "landing",
      lead_id: body.lead_id,
      utm: body.utm,
      meta: body.meta,
      raw: body,
    };

    const result = await processInboundLead(tenantId, payload);

    if (result.success) {
      return res.status(200).json({
        deal_id: result.dealId,
        contact_id: result.contactId,
        dedupe_key: result.dedupeKey,
        is_existing: result.isExisting,
      });
    } else {
      return res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error("[Webhook /leads] Error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Meta Lead Ads: Verification Challenge ───────────────

router.get("/api/webhooks/meta", async (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"];

  if (mode !== "subscribe") {
    return res.status(400).json({ error: "Invalid mode" });
  }

  // Resolve tenantId from verify_token (NOT hardcoded)
  const resolved = await resolveMetaTenantByVerifyToken(token);
  if (!resolved) {
    return res.status(403).json({ error: "Invalid verify token" });
  }

  console.log(`[Meta Webhook] Verification challenge accepted for tenantId=${resolved.tenantId}`);
  return res.status(200).send(challenge);
});

// ─── Meta Lead Ads: Receive Notifications ────────────────

router.post("/api/webhooks/meta", async (req: Request, res: Response) => {
  try {
    // Resolve tenantId from X-Hub-Signature (NOT hardcoded)
    const resolved = await resolveMetaTenantFromBody(req);
    if (!resolved) {
      return res.status(503).json({ error: "Meta integration not configured or signature mismatch" });
    }
    const tenantId = resolved.tenantId;
    const config = resolved.config;

    const body = req.body;

    // Meta sends: { object: "page", entry: [{ id, time, changes: [{ field, value }] }] }
    if (body.object !== "page" || !body.entry) {
      return res.status(200).send("OK"); // Acknowledge but ignore non-page events
    }

    // Process each entry
    for (const entry of body.entry) {
      if (!entry.changes) continue;

      for (const change of entry.changes) {
        if (change.field !== "leadgen") continue;

        const leadgenData = change.value;
        const leadId = leadgenData.leadgen_id;
        const formId = leadgenData.form_id;
        const pageId = leadgenData.page_id;
        const adId = leadgenData.ad_id;
        const createdTime = leadgenData.created_time;

        // Fetch lead details from Graph API
        let leadDetails: any = null;
        if (config.accessToken && leadId) {
          try {
            const graphUrl = `https://graph.facebook.com/v19.0/${leadId}?access_token=${config.accessToken}`;
            const graphRes = await fetch(graphUrl);
            if (graphRes.ok) {
              leadDetails = await graphRes.json();
            } else {
              console.warn(`[Meta Webhook] Failed to fetch lead ${leadId}: ${graphRes.status}`);
            }
          } catch (err: any) {
            console.warn(`[Meta Webhook] Graph API error for lead ${leadId}: ${err.message}`);
          }
        }

        // Extract field data from lead details
        let name = "";
        let email = "";
        let phone = "";
        let message = "";

        if (leadDetails?.field_data) {
          for (const field of leadDetails.field_data) {
            const val = field.values?.[0] || "";
            switch (field.name?.toLowerCase()) {
              case "full_name":
              case "nome_completo":
              case "nome":
              case "name":
                name = val;
                break;
              case "email":
              case "e-mail":
                email = val;
                break;
              case "phone_number":
              case "telefone":
              case "phone":
              case "whatsapp":
                phone = val;
                break;
              case "message":
              case "mensagem":
              case "observacao":
              case "observação":
                message = val;
                break;
            }
          }
        }

        // If no name from fields, try from lead details
        if (!name && leadDetails?.full_name) {
          name = leadDetails.full_name;
        }

        const payload: InboundLeadPayload = {
          name: name || "Lead Meta",
          email,
          phone,
          message,
          source: "meta_lead_ads",
          lead_id: leadId,
          utm: {
            source: "facebook",
            medium: "paid",
            campaign: leadgenData.campaign_id || undefined,
          },
          meta: {
            page_id: pageId,
            form_id: formId,
            ad_id: adId,
            campaign_id: leadgenData.campaign_id,
            adgroup_id: leadgenData.adgroup_id,
            created_time: createdTime,
            leadgen_id: leadId,
          },
          raw: { entry, change, leadDetails },
        };

        const result = await processInboundLead(tenantId, payload);
        console.log(`[Meta Webhook] Lead ${leadId}: ${result.success ? "success" : "failed"} → deal #${result.dealId || "N/A"}`);
      }
    }

    // Always return 200 to Meta to acknowledge receipt
    return res.status(200).send("OK");
  } catch (error: any) {
    console.error("[Meta Webhook] Error:", error.message);
    // Still return 200 to prevent Meta from retrying
    return res.status(200).send("OK");
  }
});

// ─── Tracking Script: GET /tracker.js ──────────────────

router.get("/api/tracker.js", async (req: Request, res: Response) => {
  const token = req.query.t as string;
  if (!token) {
    return res.status(400).type("text/plain").send("// Missing token parameter");
  }

  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).type("text/plain").send("// Service unavailable");
    }

    // Validate token exists and is active
    const rows = await db
      .select()
      .from(trackingTokens)
      .where(and(eq(trackingTokens.token, token), eq(trackingTokens.isActive, true)))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).type("text/plain").send("// Invalid or inactive token");
    }

    // Update lastSeenAt
    await db
      .update(trackingTokens)
      .set({ lastSeenAt: new Date() })
      .where(eq(trackingTokens.id, rows[0]!.id));

    // Determine base URL from request
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "";
    const baseUrl = `${proto}://${host}`;

    const script = generateTrackerScript(token, baseUrl);

    res.set({
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300", // 5 min cache
      "Access-Control-Allow-Origin": "*",
    });
    return res.status(200).send(script);
  } catch (error: any) {
    console.error("[Tracker] Error serving script:", error.message);
    return res.status(500).type("text/plain").send("// Internal error");
  }
});

// ─── Tracking Script: POST /api/collect ─────────────────

router.post("/api/collect", async (req: Request, res: Response) => {
  // CORS headers for cross-origin form capture
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });

  const clientIp = req.ip || req.socket.remoteAddress || "unknown";

  try {
    // Rate limiting (shares the same store as wp-leads)
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    // Parse body — sendBeacon sends as text/plain, so handle both
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
    }
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const { token, name, email, phone, message, utm, page, extra } = body;

    // 1. Validate token
    if (!token || typeof token !== "string") {
      return res.status(401).json({ error: "Missing token" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Service unavailable" });
    }

    const tokenRows = await db
      .select()
      .from(trackingTokens)
      .where(and(eq(trackingTokens.token, token), eq(trackingTokens.isActive, true)))
      .limit(1);

    if (tokenRows.length === 0) {
      // tenantId unknown when token is invalid — log with 0
      await logEvent({
        tenantId: 0,
        actorType: "webhook",
        entityType: "lead",
        action: "auth_failed",
        metadataJson: { ip: clientIp, reason: "invalid_tracking_token", origin: "tracking_script" },
      });
      return res.status(401).json({ error: "Invalid token" });
    }

    const tokenRow = tokenRows[0]!;
    const tenantId = tokenRow.tenantId;

    // 2. Validate domain if allowedDomains is set
    const allowedDomains = tokenRow.allowedDomains as string[] | null;
    if (allowedDomains && allowedDomains.length > 0 && page?.url) {
      try {
        const pageHost = new URL(page.url).hostname.toLowerCase();
        const isAllowed = allowedDomains.some((d: string) => {
          const domain = d.toLowerCase().replace(/^\*\./, "");
          return pageHost === domain || pageHost.endsWith("." + domain);
        });
        if (!isAllowed) {
          await logEvent({
            tenantId,
            actorType: "webhook",
            entityType: "lead",
            action: "domain_rejected",
            metadataJson: { ip: clientIp, domain: pageHost, origin: "tracking_script" },
          });
          return res.status(403).json({ error: "Domain not allowed" });
        }
      } catch { /* ignore URL parse errors */ }
    }

    // 3. Must have at least email or phone
    if ((!email || typeof email !== "string" || !email.trim()) &&
        (!phone || typeof phone !== "string" || !phone.trim())) {
      return res.status(400).json({ error: "Email or phone required" });
    }

    // 4. Build InboundLeadPayload
    const payload: InboundLeadPayload = {
      name: name ? String(name).trim() : undefined,
      email: email ? String(email).trim() : undefined,
      phone: phone ? String(phone).trim() : undefined,
      message: message ? String(message).trim() : undefined,
      source: "tracking_script",
      utm: utm || undefined,
      meta: {
        channel: "form_capture",
        page_url: page?.url || undefined,
        page_title: page?.title || undefined,
        referrer: page?.referrer || undefined,
        ip: clientIp,
        token_name: tokenRow.name,
        extra: extra || undefined,
      },
      raw: body,
    };

    // 5. Process the lead
    const result = await processInboundLead(tenantId, payload);

    // 6. Update token stats
    if (result.success) {
      await db
        .update(trackingTokens)
        .set({
          totalLeads: sql`${trackingTokens.totalLeads} + 1`,
          lastSeenAt: new Date(),
        })
        .where(eq(trackingTokens.id, tokenRow.id));

      await logEvent({
        tenantId,
        actorType: "webhook",
        entityType: "lead",
        entityId: result.dealId,
        action: "lead_created",
        metadataJson: {
          origin: "tracking_script",
          dealId: result.dealId,
          contactId: result.contactId,
          dedupeKey: result.dedupeKey,
          isExisting: result.isExisting,
          source: "tracking_script",
          channel: "form_capture",
          page_url: page?.url,
        },
      });
    }

    // Return minimal response (script doesn't read it, but useful for debugging)
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("[Collect] Error:", error.message);
    return res.status(500).json({ error: "Internal error" });
  }
});

// CORS preflight for /api/collect
router.options("/api/collect", (_req: Request, res: Response) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });
  return res.status(204).send();
});

// ─── RD Station Marketing Webhook ───────────────────────

router.post("/api/webhooks/rdstation", async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";

  try {
    // 1. Rate limiting
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    // 2. Validate token from query param
    const token = (req.query.token as string) || "";
    if (!token) {
      console.warn("[RD Station Webhook] Missing token");
      return res.status(401).json({ error: "Missing token parameter" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Service unavailable" });
    }

    // 3. Validate token against ALL configs (resolve tenantId from token)
    // Previously hardcoded tenantId=1 which caused "Nenhum pipeline encontrado" errors
    // because pipelines exist on different tenantIds. Now we look up by token directly.
    const allConfigs = await db
      .select()
      .from(rdStationConfig)
      .where(eq(rdStationConfig.isActive, true));

    const config = allConfigs.find(c => c.webhookToken === token);
    if (!config) {
      console.warn("[RD Station Webhook] Invalid token");
      return res.status(403).json({ error: "Invalid token" });
    }

    // Use the tenantId from the matched config
    const tenantId = config.tenantId;
    console.log(`[RD Station Webhook] Token matched → tenantId=${tenantId}, configId=${config.id}`);

    // 4. Parse RD Station payload
    // RD Station sends: { leads: [ { id, email, name, ... } ] }
    const body = req.body;
    const leads = body?.leads;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      console.warn("[RD Station Webhook] Empty or invalid payload");
      // Log the raw payload for debugging
      await db.insert(rdStationWebhookLog).values({
        tenantId,
        status: "failed",
        error: "Empty or invalid payload: missing leads array",
        rawPayload: body as any,
      });
      return res.status(400).json({ error: "Invalid payload: expected { leads: [...] }" });
    }

    const results: Array<{ email?: string; success: boolean; dealId?: number }> = [];

    for (const lead of leads) {
      try {
        // 5. Extract lead data
        const email = lead.email || "";
        const name = lead.name || "";
        const phone = lead.personal_phone || lead.mobile_phone || "";
        const company = lead.company || "";
        const jobTitle = lead.job_title || "";
        const rdLeadId = lead.id ? String(lead.id) : undefined;

        // 6. Extract UTM from last_conversion.conversion_origin (most recent)
        const lastConversion = lead.last_conversion || lead.first_conversion;
        const conversionOrigin = lastConversion?.conversion_origin || {};
        const conversionIdentifier = lastConversion?.content?.identificador || lastConversion?.content?.form_name || "";

        const utmSource = conversionOrigin.source || "";
        const utmMedium = conversionOrigin.medium || "";
        const utmCampaign = conversionOrigin.campaign || "";
        const utmContent = conversionOrigin.content || "";
        const utmTerm = conversionOrigin.term || "";

        // Also check for direct UTM fields (some RD Station versions)
        // Priority: top-level lead fields → custom_fields (where RD Station MKT often stores UTMs as utm_* or cf_utm_*) → conversion_origin
        const cf = lead.custom_fields && typeof lead.custom_fields === "object" ? lead.custom_fields : {} as Record<string, any>;
        const directUtmSource = lead.utm_source || lead.traffic_source || cf.utm_source || cf.cf_utm_source || utmSource;
        const directUtmMedium = lead.utm_medium || lead.traffic_medium || cf.utm_medium || cf.cf_utm_medium || utmMedium;
        const directUtmCampaign = lead.utm_campaign || lead.traffic_campaign || cf.utm_campaign || cf.cf_utm_campaign || utmCampaign;
        const directUtmContent = lead.utm_content || cf.utm_content || cf.cf_utm_content || utmContent;
        const directUtmTerm = lead.utm_term || cf.utm_term || cf.cf_utm_term || utmTerm;

        // 7. Auto-capture all cf_* custom fields from RD Station
        const rdCustomFields: Record<string, string> = {};
        // Capture from custom_fields object (standard RD format)
        if (lead.custom_fields && typeof lead.custom_fields === "object") {
          for (const [key, value] of Object.entries(lead.custom_fields)) {
            if (value !== null && value !== undefined && String(value).trim() !== "") {
              rdCustomFields[key] = String(value);
            }
          }
        }
        // Also capture any top-level cf_* fields
        for (const [key, value] of Object.entries(lead)) {
          if (key.startsWith("cf_") && value !== null && value !== undefined && String(value).trim() !== "") {
            rdCustomFields[key] = String(value);
          }
        }
        // Capture from last_conversion content (form fields)
        const convContent = lastConversion?.content || {};
        if (typeof convContent === "object") {
          for (const [key, value] of Object.entries(convContent)) {
            if (key.startsWith("cf_") && value !== null && value !== undefined && String(value).trim() !== "") {
              rdCustomFields[key] = String(value);
            }
          }
        }

        const hasCustomFields = Object.keys(rdCustomFields).length > 0;

        // 8. Build payload for lead processor
        const hasUtm = !!(directUtmSource || directUtmMedium || directUtmCampaign || directUtmContent || directUtmTerm);

        const payload: InboundLeadPayload = {
          name: name || company || "Lead RD Station",
          email,
          phone,
          message: conversionIdentifier ? `Conversão: ${conversionIdentifier}` : undefined,
          source: "rdstation",
          lead_id: rdLeadId,
          utm: hasUtm ? {
            source: directUtmSource || undefined,
            medium: directUtmMedium || undefined,
            campaign: directUtmCampaign || undefined,
            content: directUtmContent || undefined,
            term: directUtmTerm || undefined,
          } : undefined,
          rdCustomFields: hasCustomFields ? rdCustomFields : undefined,
          meta: {
            channel: "rdstation",
            company,
            jobTitle,
            city: lead.city || "",
            state: lead.state || "",
            tags: lead.tags || [],
            leadStage: lead.lead_stage || "",
            opportunity: lead.opportunity === "true" || lead.opportunity === true,
            conversionIdentifier,
            numberConversions: lead.number_conversions,
            customFields: lead.custom_fields || {},
          },
          raw: lead,
        };

        // 8a. Custom deal name template
        let customDealTitle: string | undefined;
        if (config.dealNameTemplate && config.dealNameTemplate.trim()) {
          const leadName = name || company || "Lead";
          const firstName = leadName.split(" ")[0] || leadName;
          customDealTitle = config.dealNameTemplate
            .replace(/\{nome\}/gi, leadName)
            .replace(/\{primeiro_nome\}/gi, firstName)
            .replace(/\{telefone\}/gi, phone || "")
            .replace(/\{email\}/gi, email || "")
            .replace(/\{origem\}/gi, config.defaultSource || directUtmSource || "rdstation")
            .replace(/\{campanha\}/gi, config.defaultCampaign || directUtmCampaign || "")
            .trim();
          if (!customDealTitle) customDealTitle = undefined;
        }

        // 8. Resolve ownerUserId based on explicit assignmentMode
        let resolvedOwnerUserId: number | undefined = undefined;
        const mode = config.assignmentMode || "random_all";

        if (mode === "specific_user" && config.defaultOwnerUserId) {
          // Mode 1: Specific user
          resolvedOwnerUserId = config.defaultOwnerUserId;
          console.log(`[RD Station Webhook] Specific user assignment: user #${resolvedOwnerUserId}`);

        } else if (mode === "random_team" && config.assignmentTeamId) {
          // Mode 3: Random among team members
          try {
            const members = await db
              .select({ userId: teamMembers.userId })
              .from(teamMembers)
              .innerJoin(crmUsers, and(
                eq(crmUsers.id, teamMembers.userId),
                eq(crmUsers.tenantId, tenantId),
                eq(crmUsers.status, "active")
              ))
              .where(and(
                eq(teamMembers.teamId, config.assignmentTeamId),
                eq(teamMembers.tenantId, tenantId)
              ));
            if (members.length > 0) {
              // Persistent round-robin within team: find next user after lastRoundRobinUserId
              const sortedIds = members.map(m => m.userId).sort((a, b) => a - b);
              const lastId = config.lastRoundRobinUserId ?? 0;
              const nextUser = sortedIds.find(id => id > lastId) ?? sortedIds[0]!;
              resolvedOwnerUserId = nextUser;
              // Persist the last assigned user for this config
              await db.update(rdStationConfig)
                .set({ lastRoundRobinUserId: nextUser })
                .where(eq(rdStationConfig.id, config.id));
              console.log(`[RD Station Webhook] Team round-robin: team #${config.assignmentTeamId}, picked user #${resolvedOwnerUserId} from ${sortedIds.length} members`);
            } else {
              console.warn(`[RD Station Webhook] Team #${config.assignmentTeamId} has no active members, falling back to random_all`);
            }
          } catch (teamErr: any) {
            console.error(`[RD Station Webhook] Team assignment error: ${teamErr.message}, falling back to random_all`);
          }
        }

        // Mode 2 (random_all) or fallback from team with no members
        if (!resolvedOwnerUserId) {
          try {
            // Persistent round-robin among ALL active users for this tenant
            const allUsers = await db
              .select({ id: crmUsers.id })
              .from(crmUsers)
              .where(and(eq(crmUsers.tenantId, tenantId), eq(crmUsers.status, "active")))
              .orderBy(crmUsers.id);
            if (allUsers.length > 0) {
              const sortedIds = allUsers.map(u => u.id);
              const lastId = config.lastRoundRobinUserId ?? 0;
              const nextUser = sortedIds.find(id => id > lastId) ?? sortedIds[0]!;
              resolvedOwnerUserId = nextUser;
              // Persist the last assigned user for this config
              await db.update(rdStationConfig)
                .set({ lastRoundRobinUserId: nextUser })
                .where(eq(rdStationConfig.id, config.id));
              console.log(`[RD Station Webhook] Global round-robin: picked user #${resolvedOwnerUserId} from ${sortedIds.length} users`);
            } else {
              console.warn(`[RD Station Webhook] No active users for tenant ${tenantId}`);
            }
          } catch (rrErr: any) {
            console.error(`[RD Station Webhook] Round-robin error: ${rrErr.message}`);
          }
        }

        // 8b. Process the lead — pass config overrides
        const result = await processInboundLead(tenantId, payload, {
          pipelineId: config.defaultPipelineId ?? undefined,
          stageId: config.defaultStageId ?? undefined,
          ownerUserId: resolvedOwnerUserId,
          source: config.defaultSource || undefined,
          campaign: config.defaultCampaign || undefined,
          dealTitle: customDealTitle,
        });

        // 8b. Auto-link product to deal
        let autoProductStatus: string | null = null;
        let autoProductError: string | null = null;
        if (config.autoProductId && result.success && result.dealId && !result.isExisting) {
          try {
            const [product] = await db
              .select()
              .from(productCatalog)
              .where(and(eq(productCatalog.id, config.autoProductId), eq(productCatalog.tenantId, tenantId)))
              .limit(1);
            if (!product) {
              autoProductStatus = "skipped";
              autoProductError = `Produto #${config.autoProductId} n\u00e3o encontrado`;
              console.warn(`[RD Station Webhook] Auto-product #${config.autoProductId} not found for tenant ${tenantId}`);
            } else if (!product.isActive) {
              autoProductStatus = "skipped";
              autoProductError = `Produto "${product.name}" est\u00e1 inativo`;
              console.warn(`[RD Station Webhook] Auto-product "${product.name}" is inactive`);
            } else {
              await createDealProduct({
                tenantId,
                dealId: result.dealId,
                productId: product.id,
                name: product.name,
                description: product.description ?? undefined,
                category: (product.productType === "package" ? "other" : product.productType) as any,
                quantity: 1,
                unitPriceCents: product.basePriceCents,
                supplier: product.supplier ?? undefined,
              });
              // Recalcular valor total da negociação após vincular o produto
              await recalcDealValue(tenantId, result.dealId);
              autoProductStatus = "linked";
              console.log(`[RD Station Webhook] Auto-product "${product.name}" linked to deal #${result.dealId} (value recalculated)`);
            }
          } catch (prodErr: any) {
            autoProductStatus = "failed";
            autoProductError = prodErr.message || String(prodErr);
            console.error(`[RD Station Webhook] Auto-product failed:`, prodErr.message);
          }
        }

        // 8c. Auto-create tasks from config templates
        let autoTasksCreated = 0;
        let autoTasksFailed = 0;
        let autoTasksError: string | null = null;
        if (result.success && result.dealId && !result.isExisting) {
          try {
            const taskTemplates = await db
              .select()
              .from(rdStationConfigTasks)
              .where(and(eq(rdStationConfigTasks.configId, config.id), eq(rdStationConfigTasks.tenantId, tenantId)));

            for (const tmpl of taskTemplates) {
              try {
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + (tmpl.dueDaysOffset || 0));
                if (tmpl.dueTime) {
                  const [hours, minutes] = tmpl.dueTime.split(":").map(Number);
                  if (!isNaN(hours!) && !isNaN(minutes!)) {
                    dueDate.setHours(hours!, minutes!, 0, 0);
                  }
                }
                const assignee = tmpl.assignedToUserId ?? config.defaultOwnerUserId ?? undefined;
                await createTask({
                  tenantId,
                  entityType: "deal",
                  entityId: result.dealId,
                  title: tmpl.title,
                  description: tmpl.description ?? undefined,
                  taskType: tmpl.taskType ?? "task",
                  dueAt: dueDate,
                  assignedToUserId: assignee ?? undefined,
                  priority: tmpl.priority as any,
                });
                autoTasksCreated++;
              } catch (taskErr: any) {
                autoTasksFailed++;
                autoTasksError = (autoTasksError ? autoTasksError + "; " : "") + taskErr.message;
                console.error(`[RD Station Webhook] Auto-task "${tmpl.title}" failed:`, taskErr.message);
              }
            }
            if (taskTemplates.length > 0) {
              console.log(`[RD Station Webhook] Auto-tasks: ${autoTasksCreated} created, ${autoTasksFailed} failed for deal #${result.dealId}`);
            }
          } catch (tasksErr: any) {
            autoTasksError = tasksErr.message || String(tasksErr);
            console.error(`[RD Station Webhook] Auto-tasks query failed:`, tasksErr.message);
          }
        }

        // 9. Auto-WhatsApp sending
        let autoWhatsAppStatus: string | null = null;
        let autoWhatsAppError: string | null = null;

        if (config.autoWhatsAppEnabled && result.success && !result.isExisting) {
          const normalizedPhone = phone ? phone.replace(/\D/g, "") : "";
          if (!normalizedPhone || normalizedPhone.length < 10) {
            autoWhatsAppStatus = "skipped";
            autoWhatsAppError = "Telefone ausente ou inválido";
          } else {
            try {
              // Find connected WhatsApp session for this tenant
              const sessionRows = await db
                .select()
                .from(whatsappSessions)
                .where(and(eq(whatsappSessions.tenantId, tenantId), eq(whatsappSessions.status, "connected")))
                .limit(1);

              if (sessionRows.length === 0) {
                autoWhatsAppStatus = "skipped";
                autoWhatsAppError = "Nenhuma sessão WhatsApp conectada";
              } else {
                const session = sessionRows[0]!;
                const template = config.autoWhatsAppMessageTemplate || "";
                if (!template.trim()) {
                  autoWhatsAppStatus = "skipped";
                  autoWhatsAppError = "Template de mensagem vazio";
                } else {
                  // Interpolate variables
                  const leadName = name || company || "Lead";
                  const firstName = leadName.split(" ")[0] || leadName;
                  const message = template
                    .replace(/\{nome\}/gi, leadName)
                    .replace(/\{primeiro_nome\}/gi, firstName)
                    .replace(/\{telefone\}/gi, phone || "")
                    .replace(/\{email\}/gi, email || "")
                    .replace(/\{origem\}/gi, config.defaultSource || directUtmSource || "rdstation")
                    .replace(/\{campanha\}/gi, config.defaultCampaign || directUtmCampaign || "");

                  // Send via WhatsApp manager
                  const { whatsappManager } = await import("./whatsappEvolution");
                  const jid = `${normalizedPhone}@s.whatsapp.net`;
                  await whatsappManager.sendTextMessage(session.sessionId, jid, message);
                  autoWhatsAppStatus = "sent";
                  console.log(`[RD Station Webhook] Auto-WhatsApp sent to ${normalizedPhone} via session ${session.sessionId}`);
                }
              }
            } catch (waErr: any) {
              autoWhatsAppStatus = "failed";
              autoWhatsAppError = waErr.message || String(waErr);
              console.error(`[RD Station Webhook] Auto-WhatsApp failed:`, waErr.message);
            }
          }
        } else if (config.autoWhatsAppEnabled && result.isExisting) {
          autoWhatsAppStatus = "skipped";
          autoWhatsAppError = "Lead duplicado — WhatsApp não reenviado";
        }

        // 9b. Apply field mappings (RD → Entur OS custom fields)
        let fieldMappingApplied = 0;
        let fieldMappingErrors: string[] = [];
        if (result.success && (result.dealId || result.contactId)) {
          try {
            const mappingResult = await applyFieldMappings({
              tenantId,
              dealId: result.dealId,
              contactId: result.contactId,
              leadData: lead,
              rdCustomFields: hasCustomFields ? rdCustomFields : undefined,
            });
            fieldMappingApplied = mappingResult.applied;
            fieldMappingErrors = mappingResult.errors;
            if (mappingResult.applied > 0) {
              console.log(`[RD Station Webhook] Field mappings: ${mappingResult.applied} applied, ${mappingResult.skipped} skipped for deal #${result.dealId || 'N/A'}`);
            }
          } catch (fmErr: any) {
            fieldMappingErrors = [fmErr.message || String(fmErr)];
            console.error(`[RD Station Webhook] Field mapping error (non-blocking):`, fmErr.message);
          }
        }

        // 10. Log in rd_station_webhook_log
        await db.insert(rdStationWebhookLog).values({
          tenantId,
          rdLeadId,
          conversionIdentifier,
          email,
          name: name || company || "Lead RD Station",
          phone,
          utmSource: directUtmSource || null,
          utmMedium: directUtmMedium || null,
          utmCampaign: directUtmCampaign || null,
          utmContent: directUtmContent || null,
          utmTerm: directUtmTerm || null,
          status: result.success ? (result.isExisting ? "duplicate" : "success") : "failed",
          dealId: result.dealId ?? null,
          contactId: result.contactId ?? null,
          configId: config.id,
          autoWhatsAppStatus,
          autoWhatsAppError,
          autoProductStatus,
          autoProductError,
          autoTasksCreated,
          autoTasksFailed,
          autoTasksError,
          customDealName: !!customDealTitle,
          error: result.error || null,
          rawPayload: lead as any,
        });

        // 10. Update config stats
        await db
          .update(rdStationConfig)
          .set({
            totalLeadsReceived: sql`${rdStationConfig.totalLeadsReceived} + 1`,
            lastLeadReceivedAt: new Date(),
          })
          .where(eq(rdStationConfig.id, config.id));

        results.push({ email, success: result.success, dealId: result.dealId });

        console.log(`[RD Station Webhook] Lead ${rdLeadId || email}: ${result.success ? "success" : "failed"} → deal #${result.dealId || "N/A"}`);
      } catch (leadErr: any) {
        console.error(`[RD Station Webhook] Error processing lead:`, leadErr.message);

        await db.insert(rdStationWebhookLog).values({
          tenantId,
          rdLeadId: lead.id ? String(lead.id) : null,
          email: lead.email || null,
          name: lead.name || null,
          status: "failed",
          configId: config.id,
          error: leadErr.message,
          rawPayload: lead as any,
        });

        results.push({ email: lead.email, success: false });
      }
    }

    // Log event
    await logEvent({
      tenantId,
      actorType: "webhook",
      entityType: "lead",
      action: "rdstation_webhook_received",
      metadataJson: {
        leadsCount: leads.length,
        results,
        ip: clientIp,
      },
    });

    return res.status(200).json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error("[RD Station Webhook] Error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Evolution API Webhook REMOVED ─────────────────────
// Evolution API has been fully removed. All WhatsApp traffic now goes through Z-API.
// The Evolution webhook routes (/api/webhooks/evolution) have been deprecated.
// Legacy Evolution webhook calls will receive a 410 Gone response.
router.post("/api/webhooks/evolution", (_req: Request, res: Response) => {
  return res.status(410).json({ error: "Evolution API has been removed. Use Z-API webhooks." });
});
router.post("/api/webhooks/evolution/:eventType", (_req: Request, res: Response) => {
  return res.status(410).json({ error: "Evolution API has been removed. Use Z-API webhooks." });
});

// ─── Z-API Webhook ──────────────────────────────────────
// Receives events from Z-API and normalizes them to the internal webhook format
// so the existing whatsappManager.handleWebhookEvent() works unchanged.
//
// Routes:
//   POST /api/webhooks/zapi/:sessionId                       → generic (event detected from body)
//   POST /api/webhooks/zapi/:sessionId/:eventType             → event-specific
//   POST /api/webhooks/zapi/:sessionId/on-message-received    → incoming message
//   POST /api/webhooks/zapi/:sessionId/on-message-send        → outgoing message
//   POST /api/webhooks/zapi/:sessionId/on-whatsapp-message-status-changes → status ticks
//   POST /api/webhooks/zapi/:sessionId/on-whatsapp-message-revoked → message deleted
//   POST /api/webhooks/zapi/:sessionId/on-connection          → connection status
//   POST /api/webhooks/zapi/:sessionId/on-disconnect          → disconnection

import {
  normalizeZApiWebhook,
  detectZApiEventFromPath,
  validateZApiClientToken,
  type ZApiWebhookEvent,
} from "./providers/zapiWebhookNormalizer";
import { getZApiSession } from "./providers/zapiProvider";
import { resolveProviderTypeForSession } from "./providers/providerFactory";

// ── LRU deduplication cache for webhook events ──
// Z-API can send duplicate events. We track recent messageIds to skip duplicates.
const DEDUP_MAX_SIZE = 2000;
const DEDUP_TTL_MS = 60_000; // 60 seconds
const webhookDedup = new Map<string, number>(); // key → timestamp

function isDuplicateWebhook(key: string): boolean {
  const now = Date.now();
  // Evict expired entries when map grows large
  if (webhookDedup.size > DEDUP_MAX_SIZE) {
    const entries = Array.from(webhookDedup.entries());
    for (const [k, ts] of entries) {
      if (now - ts > DEDUP_TTL_MS) webhookDedup.delete(k);
      if (webhookDedup.size <= DEDUP_MAX_SIZE * 0.7) break;
    }
  }
  if (webhookDedup.has(key)) {
    const ts = webhookDedup.get(key)!;
    if (now - ts < DEDUP_TTL_MS) return true;
  }
  webhookDedup.set(key, now);
  return false;
}

async function handleZApiWebhook(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const { sessionId, eventType } = req.params;
    const body = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId in path" });
    }

    console.log(`[Webhook /zapi] Received | Session: ${sessionId} | Path: ${req.path} | Event: ${eventType || 'auto-detect'}`);

    // Verify this session is actually using Z-API provider
    const providerType = await resolveProviderTypeForSession(sessionId);
    if (providerType !== "zapi") {
      console.warn(`[Webhook /zapi] Session ${sessionId} is not using Z-API provider (using: ${providerType})`);
      return res.status(200).json({ received: true, ignored: true, reason: "session not using zapi" });
    }

    // Validate client token if configured
    const zapiSession = getZApiSession(sessionId);
    if (zapiSession?.clientToken) {
      const receivedToken = req.headers["client-token"] as string || req.query.token as string;
      if (!validateZApiClientToken(receivedToken, zapiSession.clientToken)) {
        console.warn(`[Webhook /zapi] Invalid client-token for session ${sessionId} | received="${receivedToken?.substring(0, 20) || 'NONE'}" expected="${zapiSession.clientToken.substring(0, 20)}"`);
        return res.status(403).json({ error: "Invalid client-token" });
      }
    }

    // Detect event type from path or body
    const zapiEvent: ZApiWebhookEvent = eventType
      ? detectZApiEventFromPath(eventType)
      : detectZApiEventFromBody(body);

    if (zapiEvent === "unknown") {
      console.warn(`[Webhook /zapi] Unknown event type from path: ${eventType}`);
      return res.status(200).json({ received: true, ignored: true });
    }

    // Get the Evolution-compatible instance name for this session
    // The whatsappManager uses instanceName to find sessions
    const { whatsappManager } = await import("./whatsappEvolution");
    const instanceName = whatsappManager.getInstanceNameForSession(sessionId);
    if (!instanceName) {
      console.warn(`[Webhook /zapi] No instance name found for session: ${sessionId}`);
      return res.status(200).json({ received: true, ignored: true, reason: "no instance" });
    }

    // Normalize Z-API payload → Evolution format
    const normalized = normalizeZApiWebhook(zapiEvent, body, instanceName);
    if (!normalized) {
      console.log(`[Webhook /zapi] Event filtered out (group/broadcast/unknown): ${zapiEvent}`);
      return res.status(200).json({ received: true, filtered: true });
    }

    console.log(`[Webhook /zapi] Normalized: ${zapiEvent} → ${normalized.event} | Instance: ${instanceName} | JID: ${normalized.data?.key?.remoteJid || 'N/A'}`);

    // Deduplication: skip if we've seen this exact event recently
    const msgId = normalized.data?.key?.id;
    if (msgId) {
      const dedupKey = `${sessionId}:${normalized.event}:${msgId}`;
      if (isDuplicateWebhook(dedupKey)) {
        console.log(`[Webhook /zapi] Duplicate skipped: ${dedupKey}`);
        return res.status(200).json({ received: true, duplicate: true });
      }
    }

    // Route to the same handler as Evolution webhooks
    // Events that should be enqueued for async processing via BullMQ
    const queueableEvents = [
      'messages.upsert', 'send.message',
      'messages.update', 'messages.delete',
    ];

    if (queueableEvents.includes(normalized.event)) {
      const { enqueueMessageEvent, isQueueEnabled } = await import("./messageQueue");

      if (isQueueEnabled()) {
        const enqueued = await enqueueMessageEvent({
          tenantId: 0, // Resolved by worker from session
          sessionId: '', // Resolved by worker from instanceName
          instanceName: normalized.instance,
          event: normalized.event,
          data: normalized.data,
          receivedAt: Date.now(),
        });

        if (enqueued) {
          console.log(`[Webhook /zapi] Enqueued ${normalized.event} in ${Date.now() - startTime}ms`);
          return res.status(200).json({ received: true, queued: true });
        }
      }

      // Fallback: process async in-process
      whatsappManager.handleWebhookEvent(normalized).catch((e: any) =>
        console.error(`[Webhook /zapi] Async processing error for ${normalized.event}:`, e.message)
      );
      console.log(`[Webhook /zapi] Responded in ${Date.now() - startTime}ms (sync fallback)`);
      return res.status(200).json({ received: true });
    }

    // For other events (connection, etc.), process async
    whatsappManager.handleWebhookEvent(normalized).catch((e: any) =>
      console.error(`[Webhook /zapi] Async processing error for ${normalized.event}:`, e.message)
    );
    console.log(`[Webhook /zapi] Responded in ${Date.now() - startTime}ms (async)`);
    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error(`[Webhook /zapi] Error after ${Date.now() - startTime}ms:`, error.message);
    return res.status(200).json({ received: true, error: error.message });
  }
}

/** Detect Z-API event type from body content when not in URL path */
function detectZApiEventFromBody(body: any): ZApiWebhookEvent {
  if (body?.connected !== undefined) return body.connected ? "on-connection" : "on-disconnect";
  if (body?.type === "PresenceChatCallback") return "on-chat-presence";
  if (body?.status && body?.ids) return "on-whatsapp-message-status-changes";
  if (body?.fromMe === true) return "on-message-send";
  if (body?.phone || body?.chatId) return "on-message-received";
  return "unknown";
}

// Z-API webhook routes
router.post("/api/webhooks/zapi/:sessionId", handleZApiWebhook);
router.post("/api/webhooks/zapi/:sessionId/:eventType", handleZApiWebhook);

export { router as webhookRouter };

// Export for testing
export { checkRateLimit, isValidEmail, rateLimitStore };
