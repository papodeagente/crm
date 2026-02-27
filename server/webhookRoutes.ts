/**
 * Webhook Routes — Express routes for inbound lead capture.
 *
 * POST /webhooks/leads   → Landing Page webhook (Bearer token auth)
 * POST /webhooks/meta    → Meta Lead Ads webhook (X-Hub-Signature-256)
 * GET  /webhooks/meta    → Meta verification challenge
 */

import { Router, Request, Response } from "express";
import { createHmac } from "crypto";
import {
  processInboundLead,
  getWebhookConfig,
  getMetaConfig,
  type InboundLeadPayload,
} from "./leadProcessor";

const router = Router();

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
