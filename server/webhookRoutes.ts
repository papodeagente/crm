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
import { eventLog } from "../drizzle/schema";
import { ENV } from "./_core/env";

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

router.post("/webhooks/wp-leads", async (req: Request, res: Response) => {
  const tenantId = 1; // Single-tenant for now
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";

  try {
    // 1. Rate limiting
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      await logEvent({
        tenantId,
        actorType: "webhook",
        entityType: "lead",
        action: "rate_limited",
        metadataJson: { ip: clientIp, origin: "elementor_webhook" },
      });
      return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
    }

    // 2. Validate api_key
    const { api_key } = req.body || {};
    if (!api_key || typeof api_key !== "string") {
      await logEvent({
        tenantId,
        actorType: "webhook",
        entityType: "lead",
        action: "auth_failed",
        metadataJson: { ip: clientIp, reason: "missing_api_key", origin: "elementor_webhook" },
      });
      return res.status(401).json({ error: "Unauthorized" });
    }

    const wpSecret = ENV.wpSecret;
    if (!wpSecret || api_key !== wpSecret) {
      await logEvent({
        tenantId,
        actorType: "webhook",
        entityType: "lead",
        action: "auth_failed",
        metadataJson: { ip: clientIp, reason: "invalid_api_key", origin: "elementor_webhook" },
      });
      return res.status(401).json({ error: "Unauthorized" });
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

router.post("/webhooks/leads", async (req: Request, res: Response) => {
  const tenantId = 1; // Single-tenant for now

  try {
    // Auth: Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = authHeader.substring(7);
    const config = await getWebhookConfig(tenantId);
    if (!config || config.webhookSecret !== token) {
      return res.status(403).json({ error: "Invalid webhook token" });
    }

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

router.get("/webhooks/meta", async (req: Request, res: Response) => {
  const tenantId = 1;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode !== "subscribe") {
    return res.status(400).json({ error: "Invalid mode" });
  }

  const config = await getMetaConfig(tenantId);
  if (!config || config.verifyToken !== token) {
    return res.status(403).json({ error: "Invalid verify token" });
  }

  console.log("[Meta Webhook] Verification challenge accepted");
  return res.status(200).send(challenge);
});

// ─── Meta Lead Ads: Receive Notifications ────────────────

router.post("/webhooks/meta", async (req: Request, res: Response) => {
  const tenantId = 1;

  try {
    // Validate X-Hub-Signature-256
    const config = await getMetaConfig(tenantId);
    if (!config || config.status !== "connected") {
      return res.status(503).json({ error: "Meta integration not configured" });
    }

    if (config.appSecret) {
      const signature = req.headers["x-hub-signature-256"] as string;
      if (signature) {
        const expectedSig = "sha256=" + createHmac("sha256", config.appSecret)
          .update(JSON.stringify(req.body))
          .digest("hex");

        if (signature !== expectedSig) {
          console.warn("[Meta Webhook] Invalid signature");
          return res.status(403).json({ error: "Invalid signature" });
        }
      }
    }

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

export { router as webhookRouter };

// Export for testing
export { checkRateLimit, isValidEmail, rateLimitStore };
