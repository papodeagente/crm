import type { Request, Response } from "express";
import * as crm from "./crmDb";

/**
 * ASAAS Webhook Handler
 *
 * Configure on ASAAS dashboard:
 *   URL: https://crm.clinilucro.com.br/api/webhooks/asaas
 *   Auth Token: define a per-tenant secret on the dashboard. Same value
 *               must be set as env var ASAAS_WEBHOOK_TOKEN (single-token
 *               mode) or sent in `asaas-access-token` header — we accept
 *               either header.
 *
 * Idempotency: ASAAS sends each event with a unique `id`. We persist
 * (eventId, payload) into asaas_webhook_events and skip duplicates.
 *
 * Events: PAYMENT_CREATED, PAYMENT_UPDATED, PAYMENT_CONFIRMED,
 * PAYMENT_RECEIVED, PAYMENT_RECEIVED_IN_CASH, PAYMENT_OVERDUE,
 * PAYMENT_DELETED, PAYMENT_REFUNDED, PAYMENT_CHARGEBACK_REQUESTED,
 * PAYMENT_AWAITING_RISK_ANALYSIS, etc.
 */

interface AsaasWebhookPayload {
  id?: string;
  event: string;
  dateCreated?: string;
  payment?: {
    id: string;
    customer?: string;
    status: string;
    value?: number;
    netValue?: number;
    billingType?: string;
    dueDate?: string;
    paymentDate?: string;
    clientPaymentDate?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    externalReference?: string;
  };
}

const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

function authorize(req: Request): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) {
    // No auth configured — allow but log.
    console.warn("[ASAAS] ASAAS_WEBHOOK_TOKEN not set — webhook is open. Configure it for production.");
    return true;
  }
  const provided =
    (req.headers["asaas-access-token"] as string | undefined) ||
    (req.headers["asaas-token"] as string | undefined) ||
    (req.headers["authorization"] as string | undefined)?.replace(/^Bearer\s+/i, "");
  return provided === expected;
}

function parseProposalIdFromExternalRef(ref?: string): number | null {
  if (!ref) return null;
  const match = ref.match(/^proposal:(\d+)$/);
  return match ? Number(match[1]) : null;
}

function parseDealIdFromExternalRef(ref?: string): number | null {
  if (!ref) return null;
  const match = ref.match(/^deal:(\d+)$/);
  return match ? Number(match[1]) : null;
}

export async function handleAsaasWebhook(req: Request, res: Response) {
  try {
    if (!authorize(req)) {
      console.warn("[ASAAS] Webhook: unauthorized request");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = req.body as AsaasWebhookPayload;
    if (!payload?.event) {
      return res.status(400).json({ error: "Missing event" });
    }

    const eventId = payload.id || `${payload.event}::${payload.payment?.id || "no-payment"}::${payload.dateCreated || Date.now()}`;
    const paymentId = payload.payment?.id || null;

    // Idempotency check
    const existing = await crm.findAsaasWebhookEvent(eventId);
    if (existing?.processedAt) {
      return res.status(200).json({ ok: true, idempotent: true });
    }

    // Find proposal OR deal via externalReference or stored asaasPaymentId
    let tenantId: number | null = null;
    let proposalId: number | null = parseProposalIdFromExternalRef(payload.payment?.externalReference);
    let dealId: number | null = parseDealIdFromExternalRef(payload.payment?.externalReference);

    if (paymentId && !proposalId && !dealId) {
      const proposal = await crm.findProposalByAsaasPaymentId(paymentId);
      if (proposal) {
        proposalId = proposal.id;
        tenantId = proposal.tenantId;
      } else {
        const deal = await crm.findDealByAsaasPaymentId(paymentId);
        if (deal) {
          dealId = deal.id;
          tenantId = deal.tenantId;
        }
      }
    } else if (proposalId) {
      const { getDb } = await import("./db");
      const { proposals } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const rows = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
        if (rows[0]) tenantId = rows[0].tenantId;
      }
    } else if (dealId) {
      const { getDb } = await import("./db");
      const { deals } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const rows = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
        if (rows[0]) tenantId = rows[0].tenantId;
      }
    }

    // Record audit row up-front so duplicates are caught even if processing fails
    const audit = await crm.recordAsaasWebhookEvent({
      tenantId,
      eventId,
      eventType: payload.event,
      paymentId,
      rawPayload: payload,
    });

    let errorMsg: string | null = null;
    try {
      if (proposalId && tenantId && payload.payment) {
        const isPaid = PAID_STATUSES.has(payload.payment.status);
        const isOverdue = payload.payment.status === "OVERDUE";
        const paidAt = isPaid && payload.payment.paymentDate ? new Date(payload.payment.paymentDate) : null;
        await crm.setProposalAsaasPayment(tenantId, proposalId, {
          asaasPaymentId: payload.payment.id,
          asaasInvoiceUrl: payload.payment.invoiceUrl ?? null,
          asaasBankSlipUrl: payload.payment.bankSlipUrl ?? null,
          asaasBillingType: payload.payment.billingType ?? null,
          asaasPaymentStatus: payload.payment.status,
          asaasPaidAt: paidAt,
        });
        if (isPaid) {
          await crm.updateProposal(tenantId, proposalId, { status: "accepted", acceptedAt: paidAt || new Date() });
        }
        // Auto-notify client via WhatsApp (best-effort, non-blocking failure)
        // Idempotent: only fires once per kind per proposal
        if (isPaid || isOverdue) {
          const { sendProposalWhatsAppNotification } = await import("./services/proposalNotifications");
          const kind = isPaid ? "paid" : "overdue";
          const alreadyNotified = isPaid
            ? !!(await crm.getProposalById(tenantId, proposalId))?.whatsappPaidNotifiedAt
            : !!(await crm.getProposalById(tenantId, proposalId))?.whatsappOverdueNotifiedAt;
          if (!alreadyNotified) {
            sendProposalWhatsAppNotification(tenantId, proposalId, kind)
              .then(async (r) => {
                if (r.sent) {
                  await crm.updateProposal(tenantId, proposalId, isPaid
                    ? { whatsappPaidNotifiedAt: new Date() }
                    : { whatsappOverdueNotifiedAt: new Date() });
                }
              })
              .catch((e) => console.error("[ASAAS] Auto WhatsApp notify failed:", e?.message || e));
          }
        }
      } else if (dealId && tenantId && payload.payment) {
        const isPaid = PAID_STATUSES.has(payload.payment.status);
        const paidAt = isPaid && payload.payment.paymentDate ? new Date(payload.payment.paymentDate) : null;
        await crm.updateDealFromAsaasStatus(dealId, tenantId, {
          asaasPaymentStatus: payload.payment.status,
          asaasPaidAt: paidAt,
        });
      } else {
        errorMsg = "Charge not resolved from webhook payload (proposal nor deal)";
        console.warn("[ASAAS] Webhook unresolved:", { event: payload.event, paymentId, externalRef: payload.payment?.externalReference });
      }
    } catch (err: any) {
      errorMsg = err.message || String(err);
      console.error("[ASAAS] Webhook processing error:", err);
    }

    if (audit?.id) {
      await crm.markAsaasWebhookProcessed(audit.id, errorMsg || undefined);
    }

    return res.status(200).json({ ok: true, processed: !errorMsg });
  } catch (err: any) {
    console.error("[ASAAS] Webhook handler crashed:", err);
    return res.status(500).json({ error: err.message || "internal" });
  }
}
