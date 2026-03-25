import { eq } from "drizzle-orm";
import { tenants, crmUsers, subscriptions, subscriptionEvents } from "../drizzle/schema";
import { getDb } from "./db";
import { hashPassword } from "./saasAuth";
import { sendWelcomeEmail } from "./emailService";
import { provisionZapiForTenant, deprovisionZapiForTenant } from "./services/zapiProvisioningService";
import type { Request, Response } from "express";
import crypto from "crypto";

/**
 * Hotmart Webhook Handler — v2.1
 *
 * Robust implementation with:
 * - HOTTOK authentication (header + body)
 * - Idempotency via event+transaction composite key
 * - Full payload audit trail (subscription_events)
 * - Internal status translation layer
 * - Defensive tenant matching by email
 * - Legacy tenant protection (isLegacy tenants keep full access)
 * - Payload structure matching Hotmart Webhook v2.0.0 docs
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

// ─── Hotmart v2.0.0 Payload Types ──────────────────────────────────

interface HotmartWebhookPayload {
  // Top-level fields
  id?: string;
  hottok?: string;
  creation_date?: number;
  event: string;
  version?: string;
  data: {
    product?: {
      id: number;
      ucode?: string;
      name: string;
    };
    buyer: {
      email: string;
      name: string;
      first_name?: string;
      last_name?: string;
    };
    purchase: {
      transaction: string;
      status: string;
      approved_date?: number;
      order_date?: string;
      date_next_charge?: number;
      recurrence_number?: number;
      price?: {
        value: number;
        currency_value?: string;
      };
      full_price?: {
        value: number;
        currency_value?: string;
      };
      offer?: {
        code: string;
        name?: string;
        description?: string;
      };
      payment?: {
        type?: string;
        installments_number?: number;
      };
    };
    subscription?: {
      status: string;
      plan?: {
        id?: number;
        name: string;
      };
      subscriber?: {
        code: string;
      };
    };
  };
}

// ─── Build Idempotency Key ──────────────────────────────────────────

function buildIdempotencyKey(event: string, transactionId: string | undefined, buyerEmail: string): string {
  return `${event}::${transactionId || "no-txn"}::${buyerEmail}`;
}

// ─── Determine Plan from Offer Code ──────────────────────────────

// Offer code → Plan mapping (from Hotmart checkout links)
const OFFER_PLAN_MAP: Record<string, "start" | "growth" | "scale"> = {
  "axm3bvsz": "start",   // https://pay.hotmart.com/S104799458W?off=axm3bvsz
  "pubryjat": "growth",  // https://pay.hotmart.com/S104799458W?off=pubryjat
};

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  "start": "Start (R$97/mês)",
  "growth": "Growth (R$297/mês)",
  "scale": "Scale",
};

function determinePlanFromPayload(payload: HotmartWebhookPayload): "start" | "growth" | "scale" {
  // 1. First try exact offer code match
  const offerCode = payload.data?.purchase?.offer?.code?.toLowerCase() || "";
  if (OFFER_PLAN_MAP[offerCode]) return OFFER_PLAN_MAP[offerCode];

  // 2. Fallback: keyword matching
  const planName = payload.data?.subscription?.plan?.name?.toLowerCase() || "";
  const productName = payload.data?.product?.name?.toLowerCase() || "";
  const combined = `${planName} ${productName} ${offerCode}`;

  if (combined.includes("scale") || combined.includes("enterprise")) return "scale";
  if (combined.includes("growth") || combined.includes("pro") || combined.includes("pubryjat")) return "growth";
  return "start";
}

// ─── Generate Secure Random Password ───────────────────────────

function generatePassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

// ─── Auto-create Tenant + User on Purchase ──────────────────────

async function autoCreateTenantFromPurchase(opts: {
  buyerEmail: string;
  buyerName: string;
  plan: "start" | "growth" | "scale";
  loginUrl?: string;
}): Promise<{ tenantId: number; userId: number; password: string } | null> {
  const db = await getDb();
  if (!db) return null;

  // Check if email already exists as a CRM user
  const existingUser = await db.select().from(crmUsers)
    .where(eq(crmUsers.email, opts.buyerEmail))
    .limit(1);

  if (existingUser.length > 0) {
    // User already exists — return their tenant
    console.log(`[Hotmart Webhook] User already exists for ${opts.buyerEmail}, tenantId: ${existingUser[0].tenantId}`);
    return { tenantId: existingUser[0].tenantId, userId: existingUser[0].id, password: "" };
  }

  // Generate password and company name from buyer name
  const password = generatePassword(10);
  const companyName = opts.buyerName ? `Agência ${opts.buyerName.split(" ")[0]}` : `Agência ${opts.buyerEmail.split("@")[0]}`;
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 64);

  console.log(`[Hotmart Webhook] Auto-creating tenant for ${opts.buyerEmail} | Plan: ${opts.plan} | Company: ${companyName}`);

  // Create tenant with active billing (paid via Hotmart)
  const [tenantResult] = await db.insert(tenants).values({
    name: companyName,
    slug,
    plan: opts.plan,
    status: "active",
    billingStatus: "active",
    isLegacy: false,
    hotmartEmail: opts.buyerEmail,
    freemiumDays: 0,
    freemiumExpiresAt: null,
  }).$returningId();

  const tenantId = tenantResult.id;

  // Create admin user
  const passwordHash = await hashPassword(password);
  const [userResult] = await db.insert(crmUsers).values({
    tenantId,
    name: opts.buyerName || opts.buyerEmail.split("@")[0],
    email: opts.buyerEmail,
    passwordHash,
    role: "admin",
    status: "active",
  }).$returningId();

  // Set owner
  await db.update(tenants).set({ ownerUserId: userResult.id }).where(eq(tenants.id, tenantId));

  // Create default pipelines
  try {
    const { createDefaultPipelines } = await import("./classificationEngine");
    await createDefaultPipelines(tenantId);
  } catch (e) {
    console.error("[Hotmart Webhook] Failed to create default pipelines:", e);
  }

  // Seed default loss reasons
  try {
    const { seedDefaultLossReasons } = await import("./seedLossReasons");
    await seedDefaultLossReasons(tenantId);
  } catch (e) {
    console.error("[Hotmart Webhook] Failed to seed loss reasons:", e);
  }

  // Seed default UTM mappings
  try {
    const { seedDefaultUtmMappings } = await import("./services/seedDefaultUtmMappings");
    await seedDefaultUtmMappings(tenantId);
  } catch (e) {
    console.error("[Hotmart Webhook] Failed to seed UTM mappings:", e);
  }

  // Send welcome email with credentials
  const loginUrl = opts.loginUrl || "https://crm.acelerador.tur.br/login";
  const planDisplayName = PLAN_DISPLAY_NAMES[opts.plan] || opts.plan;

  try {
    await sendWelcomeEmail({
      to: opts.buyerEmail,
      userName: opts.buyerName || opts.buyerEmail.split("@")[0],
      companyName,
      password,
      planName: planDisplayName,
      loginUrl,
    });
    console.log(`[Hotmart Webhook] Welcome email sent to ${opts.buyerEmail}`);
  } catch (e) {
    console.error(`[Hotmart Webhook] Failed to send welcome email to ${opts.buyerEmail}:`, e);
  }

  return { tenantId, userId: userResult.id, password };
}

// ─── Exported helpers for testing ───────────────────────────────────

export { buildIdempotencyKey, determinePlanFromPayload, EVENT_STATUS_MAP, OFFER_PLAN_MAP, PLAN_DISPLAY_NAMES };
export type { HotmartWebhookPayload, StatusTranslation, InternalBillingStatus };

// ─── Main Handler ───────────────────────────────────────────────────

export async function handleHotmartWebhook(req: Request, res: Response) {
  const startTime = Date.now();
  let eventLogId: number | null = null;

  try {
    console.log("[Hotmart Webhook] ─── Incoming request ───");
    console.log(`[Hotmart Webhook] Method: ${req.method}`);
    console.log(`[Hotmart Webhook] Content-Type: ${req.headers["content-type"]}`);
    console.log(`[Hotmart Webhook] Body type: ${typeof req.body}`);
    console.log(`[Hotmart Webhook] Body keys: ${req.body ? Object.keys(req.body).join(", ") : "EMPTY"}`);

    // 1. Authenticate via HOTTOK (check header AND body)
    const hottokFromHeader = req.headers["x-hotmart-hottok"] as string | undefined;
    const hottokFromBody = req.body?.hottok;
    const hottokFromQuery = req.query.hottok as string | undefined;
    const hottok = hottokFromHeader || hottokFromBody || hottokFromQuery;
    const expectedHottok = process.env.HOTMART_HOTTOK;

    console.log(`[Hotmart Webhook] HOTTOK header: ${hottokFromHeader ? "present" : "missing"}`);
    console.log(`[Hotmart Webhook] HOTTOK body: ${hottokFromBody ? "present" : "missing"}`);
    console.log(`[Hotmart Webhook] HOTTOK query: ${hottokFromQuery ? "present" : "missing"}`);
    console.log(`[Hotmart Webhook] Expected HOTTOK configured: ${expectedHottok ? "yes" : "no"}`);

    if (expectedHottok && hottok !== expectedHottok) {
      console.warn("[Hotmart Webhook] Invalid hottok — rejecting request");
      console.warn(`[Hotmart Webhook] Received: ${hottok?.substring(0, 10)}... Expected: ${expectedHottok?.substring(0, 10)}...`);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = req.body as HotmartWebhookPayload;

    // Extract event from top-level (Hotmart v2.0.0 format)
    const event = payload.event;

    // Extract buyer info from data.buyer
    const buyerEmail = payload.data?.buyer?.email?.toLowerCase()?.trim();
    const buyerName = payload.data?.buyer?.name;

    // Extract purchase info from data.purchase
    const transactionId = payload.data?.purchase?.transaction;
    const priceValue = payload.data?.purchase?.price?.value;
    const currency = payload.data?.purchase?.price?.currency_value || "BRL";

    // Extract subscription info from data.subscription (v2.0.0 structure)
    const subscriptionCode = payload.data?.subscription?.subscriber?.code;

    // Extract product/offer info
    const productId = payload.data?.product?.id?.toString();
    const offerCode = payload.data?.purchase?.offer?.code;

    console.log(`[Hotmart Webhook] Event: ${event}`);
    console.log(`[Hotmart Webhook] Buyer email: ${buyerEmail}`);
    console.log(`[Hotmart Webhook] Buyer name: ${buyerName}`);
    console.log(`[Hotmart Webhook] Transaction: ${transactionId}`);
    console.log(`[Hotmart Webhook] Subscription code: ${subscriptionCode}`);
    console.log(`[Hotmart Webhook] Product ID: ${productId}`);
    console.log(`[Hotmart Webhook] Offer code: ${offerCode}`);
    console.log(`[Hotmart Webhook] Price: ${priceValue} ${currency}`);

    if (!buyerEmail) {
      console.warn("[Hotmart Webhook] Missing buyer email in payload");
      console.warn(`[Hotmart Webhook] Full payload: ${JSON.stringify(payload).substring(0, 500)}`);
      return res.status(400).json({ error: "Missing buyer email" });
    }

    if (!event) {
      console.warn("[Hotmart Webhook] Missing event type in payload");
      console.warn(`[Hotmart Webhook] Full payload: ${JSON.stringify(payload).substring(0, 500)}`);
      return res.status(400).json({ error: "Missing event type" });
    }

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

    console.log(`[Hotmart Webhook] Internal status: ${internalStatus} (mapped: ${!!translation})`);

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

    console.log(`[Hotmart Webhook] Event logged with ID: ${eventLogId}`);

    // 5. Find tenant by hotmartEmail
    const tenantRows = await db.select().from(tenants)
      .where(eq(tenants.hotmartEmail, buyerEmail))
      .limit(1);

    if (tenantRows.length === 0) {
      // No tenant found — for purchase events, auto-create tenant+user
      const isActivationEvent = ["PURCHASE_APPROVED", "PURCHASE_COMPLETE"].includes(event);

      if (isActivationEvent) {
        console.log(`[Hotmart Webhook] No tenant for ${buyerEmail} — auto-creating on purchase event`);
        const plan = determinePlanFromPayload(payload);
        const created = await autoCreateTenantFromPurchase({
          buyerEmail,
          buyerName: buyerName || "",
          plan,
        });

        if (!created) {
          await db.update(subscriptionEvents).set({
            processed: true,
            processedAt: new Date(),
            errorMessage: `Failed to auto-create tenant for: ${buyerEmail}`,
          }).where(eq(subscriptionEvents.id, eventLogId));
          return res.status(500).json({ error: "Failed to create tenant" });
        }

        // Re-fetch the newly created tenant to continue processing
        const newTenantRows = await db.select().from(tenants)
          .where(eq(tenants.id, created.tenantId))
          .limit(1);

        if (newTenantRows.length === 0) {
          return res.status(500).json({ error: "Tenant created but not found" });
        }

        // Push the new tenant into tenantRows so the rest of the handler works
        tenantRows.push(newTenantRows[0]);
        console.log(`[Hotmart Webhook] Tenant auto-created: ${created.tenantId} for ${buyerEmail}`);
      } else {
        // Non-purchase event for unknown email — just log it
        await db.update(subscriptionEvents).set({
          processed: true,
          processedAt: new Date(),
          errorMessage: `No tenant found for email: ${buyerEmail} (event: ${event})`,
        }).where(eq(subscriptionEvents.id, eventLogId));

        console.warn(`[Hotmart Webhook] No tenant for ${buyerEmail} and event ${event} is not a purchase — skipping`);
        return res.status(200).json({ status: "no_tenant_found", email: buyerEmail });
      }
    }

    const tenant = tenantRows[0];
    const plan = determinePlanFromPayload(payload);
    const priceInCents = priceValue ? Math.round(priceValue * 100) : undefined;

    console.log(`[Hotmart Webhook] Tenant found: ${tenant.id} (${tenant.name}) | Plan: ${plan} | Legacy: ${tenant.isLegacy}`);

    // Update event with tenant reference
    await db.update(subscriptionEvents).set({
      tenantId: tenant.id,
    }).where(eq(subscriptionEvents.id, eventLogId));

    // 6. Skip billing enforcement for legacy tenants (grandfathered)
    if (tenant.isLegacy) {
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
      hotmartOfferId: offerCode,
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
      subData.trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
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

    // For cancellation: keep access until period end
    if (translation?.internalStatus === "cancelled") {
      const sub = existingSub[0];
      if (sub?.currentPeriodEnd && sub.currentPeriodEnd > now) {
        tenantUpdate.billingStatus = "cancelled";
        tenantUpdate.status = "active";
      } else {
        tenantUpdate.billingStatus = "restricted";
        tenantUpdate.status = "active";
      }
    }

    // For refund/chargeback: immediate restriction
    if (translation?.shouldSuspendTenant) {
      tenantUpdate.billingStatus = "restricted";
      tenantUpdate.status = "active";
    }

    // For activation: ensure tenant is active
    if (translation?.internalStatus === "active" || translation?.internalStatus === "trialing") {
      tenantUpdate.status = "active";
    }

    await db.update(tenants).set(tenantUpdate).where(eq(tenants.id, tenant.id));

    // 8.5. Auto-provision Z-API instance on trial→paid transition
    const previousBillingStatus = tenant.billingStatus;
    const isTransitionToPaid = (
      translation?.internalStatus === "active" &&
      (previousBillingStatus === "trialing" || previousBillingStatus === "past_due")
    );
    if (isTransitionToPaid) {
      console.log(`[Hotmart Webhook] Tenant ${tenant.id} transitioned from ${previousBillingStatus} → active. Provisioning Z-API instance...`);
      try {
        const provisionResult = await provisionZapiForTenant(tenant.id, tenant.name);
        if (provisionResult.success) {
          if (provisionResult.alreadyProvisioned) {
            console.log(`[Hotmart Webhook] Tenant ${tenant.id} already has Z-API instance: ${provisionResult.instanceId}`);
          } else {
            console.log(`[Hotmart Webhook] ✓ Z-API instance provisioned for tenant ${tenant.id}: ${provisionResult.instanceId}`);
          }
        } else {
          console.error(`[Hotmart Webhook] ✗ Z-API provisioning failed for tenant ${tenant.id}: ${provisionResult.error}`);
          // Non-blocking: provisioning failure should not block the billing update
        }
      } catch (provErr: any) {
        console.error(`[Hotmart Webhook] ✗ Z-API provisioning error for tenant ${tenant.id}:`, provErr.message);
      }
    }

    // 8.6. Deprovision Z-API on cancellation/restriction
    const shouldDeprovision = (
      translation?.shouldSuspendTenant ||
      translation?.internalStatus === "expired" ||
      (translation?.internalStatus === "cancelled" && !(existingSub[0]?.currentPeriodEnd && existingSub[0].currentPeriodEnd > now))
    );
    if (shouldDeprovision) {
      console.log(`[Hotmart Webhook] Tenant ${tenant.id} restricted/expired. Deprovisioning Z-API...`);
      try {
        await deprovisionZapiForTenant(tenant.id);
      } catch (deprovErr: any) {
        console.error(`[Hotmart Webhook] ✗ Z-API deprovision error for tenant ${tenant.id}:`, deprovErr.message);
      }
    }

    // 9. Mark event as processed
    await db.update(subscriptionEvents).set({
      subscriptionId,
      processed: true,
      processedAt: new Date(),
    }).where(eq(subscriptionEvents.id, eventLogId));

    const elapsed = Date.now() - startTime;
    console.log(`[Hotmart Webhook] ✓ Tenant ${tenant.id} → ${internalStatus} (${event}) [${elapsed}ms]`);

    return res.status(200).json({
      status: "ok",
      tenantId: tenant.id,
      billingStatus: internalStatus,
      plan,
    });

  } catch (error: any) {
    console.error("[Hotmart Webhook] Error:", error.message);
    console.error("[Hotmart Webhook] Stack:", error.stack);

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
