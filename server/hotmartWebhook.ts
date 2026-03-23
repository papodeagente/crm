import { eq } from "drizzle-orm";
import { tenants, subscriptions, subscriptionEvents } from "../drizzle/schema";
import { getDb } from "./db";
import type { Request, Response } from "express";

/**
 * Hotmart Webhook Handler — v2
 *
 * Robust implementation with:
 * - HOTTOK authentication
 * - Idempotency via event+transaction composite key
 * - Full payload audit trail (subscription_events)
 * - Internal status translation layer
 * - Defensive tenant matching by email
 * - Legacy tenant protection (isLegacy tenants keep full access)
 */

// ─── Hotmart Event → Internal Status Translation ────────────────────

type InternalBillingStatus = "active" | "trialing" | "past_due" | "restricted" | "cancelled" | "expired";

interface StatusTranslation {
  internalStatus: InternalBillingStatus;
  subscriptionStatus: "active" | "trialing" | "past_due" | "cancelled" | "expired";
  shouldSuspendTenant: boolean;
}

const EVENT_STATUS_MAP: Record<string, StatusTranslation> = {
  // Compra aprovada / pagamento recorrente aprovado
  PURCHASE_COMPLETE: { internalStatus: "active", subscriptionStatus: "active", shouldSuspendTenant: false },
  PURCHASE_APPROVED: { internalStatus: "active", subscriptionStatus: "active", shouldSuspendTenant: false },

  // Trial iniciado (se Hotmart enviar)
  SUBSCRIPTION_TRIAL: { internalStatus: "trialing", subscriptionStatus: "trialing", shouldSuspendTenant: false },

  // Pagamento atrasado / protestado
  PURCHASE_DELAYED: { internalStatus: "past_due", subscriptionStatus: "past_due", shouldSuspendTenant: false },
  PURCHASE_PROTEST: { internalStatus: "past_due", subscriptionStatus: "past_due", shouldSuspendTenant: false },

  // Cancelamento pelo usuário
  SUBSCRIPTION_CANCELLATION: { internalStatus: "cancelled", subscriptionStatus: "cancelled", shouldSuspendTenant: false },
  PURCHASE_CANCELED: { internalStatus: "cancelled", subscriptionStatus: "cancelled", shouldSuspendTenant: false },

  // Reembolso / chargeback → modo restrito imediato
  PURCHASE_REFUNDED: { internalStatus: "restricted", subscriptionStatus: "expired", shouldSuspendTenant: true },
  PURCHASE_CHARGEBACK: { internalStatus: "restricted", subscriptionStatus: "expired", shouldSuspendTenant: true },

  // Expiração
  PURCHASE_EXPIRED: { internalStatus: "expired", subscriptionStatus: "expired", shouldSuspendTenant: true },
};

// ─── Hotmart Payload Types ──────────────────────────────────────────

interface HotmartWebhookPayload {
  event: string;
  data: {
    buyer: {
      email: string;
      name: string;
    };
    purchase: {
      transaction: string;
      status: string;
      price?: {
        value: number;
        currency_value?: string;
      };
      approved_date?: number;
      order_date?: number;
    };
    subscription?: {
      subscriber_code: string;
      status: string;
      plan?: {
        name: string;
      };
    };
    product?: {
      id: number;
      name: string;
    };
    offer?: {
      code: string;
    };
  };
}

// ─── Build Idempotency Key ──────────────────────────────────────────

function buildIdempotencyKey(event: string, transactionId: string | undefined, buyerEmail: string): string {
  return `${event}::${transactionId || "no-txn"}::${buyerEmail}`;
}

// ─── Determine Plan from Product/Offer ──────────────────────────────

function determinePlanFromPayload(payload: HotmartWebhookPayload): "start" | "growth" | "scale" {
  const planName = payload.data?.subscription?.plan?.name?.toLowerCase() || "";
  const productName = payload.data?.product?.name?.toLowerCase() || "";
  const combined = `${planName} ${productName}`;

  if (combined.includes("scale") || combined.includes("enterprise")) return "scale";
  if (combined.includes("growth") || combined.includes("pro")) return "growth";
  return "start";
}

// ─── Exported helpers for testing ───────────────────────────────────

export { buildIdempotencyKey, determinePlanFromPayload, EVENT_STATUS_MAP };
export type { HotmartWebhookPayload, StatusTranslation, InternalBillingStatus };

// ─── Main Handler ───────────────────────────────────────────────────

export async function handleHotmartWebhook(req: Request, res: Response) {
  const startTime = Date.now();
  let eventLogId: number | null = null;

  try {
    // 1. Authenticate via HOTTOK
    const hottok = req.headers["x-hotmart-hottok"] || req.query.hottok;
    const expectedHottok = process.env.HOTMART_HOTTOK;

    if (expectedHottok && hottok !== expectedHottok) {
      console.warn("[Hotmart Webhook] Invalid hottok — rejecting request");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = req.body as HotmartWebhookPayload;
    const event = payload.event;
    const buyerEmail = payload.data?.buyer?.email?.toLowerCase()?.trim();
    const buyerName = payload.data?.buyer?.name;
    const transactionId = payload.data?.purchase?.transaction;
    const subscriptionCode = payload.data?.subscription?.subscriber_code;
    const productId = payload.data?.product?.id?.toString();
    const offerId = payload.data?.offer?.code;
    const priceValue = payload.data?.purchase?.price?.value;
    const currency = payload.data?.purchase?.price?.currency_value || "BRL";

    if (!buyerEmail) {
      console.warn("[Hotmart Webhook] Missing buyer email");
      return res.status(400).json({ error: "Missing buyer email" });
    }

    if (!event) {
      console.warn("[Hotmart Webhook] Missing event type");
      return res.status(400).json({ error: "Missing event type" });
    }

    console.log(`[Hotmart Webhook] Event: ${event} | Email: ${buyerEmail} | Txn: ${transactionId}`);

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    // 2. Idempotency check
    const idempotencyKey = buildIdempotencyKey(event, transactionId, buyerEmail);
    const existingEvent = await db.select({ id: subscriptionEvents.id })
      .from(subscriptionEvents)
      .where(eq(subscriptionEvents.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existingEvent.length > 0) {
      console.log(`[Hotmart Webhook] Duplicate event skipped: ${idempotencyKey}`);
      return res.status(200).json({ status: "duplicate_skipped", idempotencyKey });
    }

    // 3. Translate event to internal status
    const translation = EVENT_STATUS_MAP[event];
    const internalStatus = translation?.internalStatus || "active";

    // 4. Log the event (always, even if no tenant found)
    const [eventResult] = await db.insert(subscriptionEvents).values({
      provider: "hotmart",
      externalEvent: event,
      internalStatus,
      transactionId,
      buyerEmail,
      rawPayload: payload as any,
      processed: false,
      idempotencyKey,
    }).$returningId();
    eventLogId = eventResult.id;

    // 5. Find tenant by hotmartEmail
    const tenantRows = await db.select().from(tenants)
      .where(eq(tenants.hotmartEmail, buyerEmail))
      .limit(1);

    if (tenantRows.length === 0) {
      // No tenant found — mark event as processed with note
      await db.update(subscriptionEvents).set({
        processed: true,
        processedAt: new Date(),
        errorMessage: `No tenant found for email: ${buyerEmail}`,
      }).where(eq(subscriptionEvents.id, eventLogId));

      console.warn(`[Hotmart Webhook] No tenant found for email: ${buyerEmail}`);
      return res.status(200).json({ status: "no_tenant_found", email: buyerEmail });
    }

    const tenant = tenantRows[0];
    const plan = determinePlanFromPayload(payload);
    const priceInCents = priceValue ? Math.round(priceValue * 100) : undefined;

    // Update event with tenant reference
    await db.update(subscriptionEvents).set({
      tenantId: tenant.id,
    }).where(eq(subscriptionEvents.id, eventLogId));

    // 6. Skip billing enforcement for legacy tenants (grandfathered)
    if (tenant.isLegacy) {
      // Still log the event but don't change tenant billing status
      await db.update(subscriptionEvents).set({
        processed: true,
        processedAt: new Date(),
        errorMessage: "Legacy tenant — billing event logged but not enforced",
      }).where(eq(subscriptionEvents.id, eventLogId));

      console.log(`[Hotmart Webhook] Legacy tenant ${tenant.id} — event logged, no enforcement`);
      return res.status(200).json({ status: "legacy_tenant_logged", tenantId: tenant.id });
    }

    // 7. Upsert subscription
    const existingSub = await db.select().from(subscriptions)
      .where(eq(subscriptions.tenantId, tenant.id))
      .limit(1);

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subData: Record<string, any> = {
      provider: "hotmart",
      plan,
      status: translation?.subscriptionStatus || "active",
      hotmartTransactionId: transactionId,
      hotmartSubscriptionId: subscriptionCode,
      hotmartProductId: productId,
      hotmartOfferId: offerId,
      hotmartBuyerEmail: buyerEmail,
      hotmartBuyerName: buyerName,
      lastEventAt: now,
      lastSyncAt: now,
    };

    if (priceInCents !== undefined) subData.priceInCents = priceInCents;
    if (currency) subData.currency = currency;

    // Set period dates for activation events
    if (translation?.internalStatus === "active") {
      subData.currentPeriodStart = now;
      subData.currentPeriodEnd = periodEnd;
    }

    // Set trial dates
    if (translation?.internalStatus === "trialing") {
      subData.trialStartedAt = now;
      subData.trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }

    // Set cancellation date
    if (translation?.internalStatus === "cancelled" || translation?.internalStatus === "expired") {
      subData.cancelledAt = now;
    }

    let subscriptionId: number;

    if (existingSub.length > 0) {
      await db.update(subscriptions).set(subData)
        .where(eq(subscriptions.id, existingSub[0].id));
      subscriptionId = existingSub[0].id;
    } else {
      const [newSub] = await db.insert(subscriptions).values({
        tenantId: tenant.id,
        ...subData,
      }).$returningId();
      subscriptionId = newSub.id;
    }

    // 8. Update tenant billing status
    const tenantUpdate: Record<string, any> = {
      billingStatus: internalStatus,
      plan,
    };

    // For cancellation: keep access until period end (don't suspend immediately)
    if (translation?.internalStatus === "cancelled") {
      const sub = existingSub[0];
      if (sub?.currentPeriodEnd && sub.currentPeriodEnd > now) {
        tenantUpdate.billingStatus = "cancelled";
        tenantUpdate.status = "active"; // Don't suspend yet
      } else {
        tenantUpdate.billingStatus = "restricted";
        tenantUpdate.status = "active"; // Restricted mode, not suspended
      }
    }

    // For refund/chargeback: immediate restriction
    if (translation?.shouldSuspendTenant) {
      tenantUpdate.billingStatus = "restricted";
      tenantUpdate.status = "active"; // Keep login working, restrict operations
    }

    // For activation: ensure tenant is active
    if (translation?.internalStatus === "active" || translation?.internalStatus === "trialing") {
      tenantUpdate.status = "active";
    }

    await db.update(tenants).set(tenantUpdate).where(eq(tenants.id, tenant.id));

    // 9. Mark event as processed
    await db.update(subscriptionEvents).set({
      subscriptionId,
      processed: true,
      processedAt: new Date(),
    }).where(eq(subscriptionEvents.id, eventLogId));

    const elapsed = Date.now() - startTime;
    console.log(`[Hotmart Webhook] Tenant ${tenant.id} → ${internalStatus} (${event}) [${elapsed}ms]`);

    return res.status(200).json({
      status: "ok",
      tenantId: tenant.id,
      billingStatus: internalStatus,
      plan,
    });

  } catch (error: any) {
    console.error("[Hotmart Webhook] Error:", error.message);

    // Try to mark event as failed
    if (eventLogId) {
      try {
        const db = await getDb();
        if (db) {
          await db.update(subscriptionEvents).set({
            processed: true,
            processedAt: new Date(),
            errorMessage: error.message,
          }).where(eq(subscriptionEvents.id, eventLogId));
        }
      } catch (logErr) {
        console.error("[Hotmart Webhook] Failed to log error:", logErr);
      }
    }

    return res.status(500).json({ error: "Internal server error" });
  }
}
