import Stripe from "stripe";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { subscriptions, tenants } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ═══════════════════════════════════════
// PLAN CONFIGURATION
// ═══════════════════════════════════════

export interface PlanConfig {
  code: PlanCode;
  name: string;
  maxUsers: number; // -1 = unlimited
  trialDays: number;
  priceInCents: number;
  stripePriceId: string;
}

export type PlanCode = "solo" | "growth" | "scale";

const PLAN_CONFIGS: Record<PlanCode, PlanConfig> = {
  solo: {
    code: "solo",
    name: "Solo",
    maxUsers: 1,
    trialDays: 10,
    priceInCents: 9700,
    stripePriceId: ENV.stripePriceSolo,
  },
  growth: {
    code: "growth",
    name: "Growth",
    maxUsers: 5,
    trialDays: 10,
    priceInCents: 29700,
    stripePriceId: ENV.stripePriceGrowth,
  },
  scale: {
    code: "scale",
    name: "Scale",
    maxUsers: -1,
    trialDays: 0,
    priceInCents: 0,
    stripePriceId: "",
  },
};

export function getPlanConfigs() {
  return PLAN_CONFIGS;
}

export function getPlanConfig(code: PlanCode): PlanConfig {
  return PLAN_CONFIGS[code];
}

// ═══════════════════════════════════════
// STRIPE CLIENT
// ═══════════════════════════════════════

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    if (!ENV.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    _stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2025-02-24.acacia" as any });
  }
  return _stripe;
}

// ═══════════════════════════════════════
// CHECKOUT SESSION
// ═══════════════════════════════════════

export async function createCheckoutSession(opts: {
  plan: PlanCode;
  tenantId: number;
  userId: number;
  email: string;
  name: string;
  origin: string;
}) {
  const stripe = getStripe();
  const config = PLAN_CONFIGS[opts.plan];

  if (!config.stripePriceId) {
    throw new Error(`Price ID not configured for plan: ${opts.plan}`);
  }

  const customerId = await findOrCreateCustomer(opts.tenantId, opts.email, opts.name);
  if (!customerId) throw new Error("Failed to create/find Stripe customer");

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: config.stripePriceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: config.trialDays,
      metadata: {
        tenant_id: opts.tenantId.toString(),
        plan: opts.plan,
      },
    },
    client_reference_id: opts.userId.toString(),
    metadata: {
      user_id: opts.userId.toString(),
      tenant_id: opts.tenantId.toString(),
      plan: opts.plan,
      customer_email: opts.email,
      customer_name: opts.name,
    },
    allow_promotion_codes: true,
    success_url: `${opts.origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/register?plan=${opts.plan}&cancelled=true`,
  });

  return { checkoutUrl: session.url!, sessionId: session.id };
}

// ═══════════════════════════════════════
// BILLING PORTAL
// ═══════════════════════════════════════

export async function createBillingPortalSession(tenantId: number, origin: string) {
  const stripe = getStripe();

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.billingProvider, "stripe")
      )
    )
    .limit(1);

  if (!sub?.stripeCustomerId) {
    throw new Error("NO_BILLING_CUSTOMER");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${origin}/settings/subscription`,
  });

  return { portalUrl: session.url };
}

// ═══════════════════════════════════════
// CUSTOMER MANAGEMENT
// ═══════════════════════════════════════

async function findOrCreateCustomer(tenantId: number, email: string, name: string): Promise<string> {
  const stripe = getStripe();
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [tenant] = await db
    .select({ billingCustomerId: tenants.billingCustomerId })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (tenant?.billingCustomerId) {
    return tenant.billingCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { tenant_id: tenantId.toString() },
  });

  await db
    .update(tenants)
    .set({ billingCustomerId: customer.id })
    .where(eq(tenants.id, tenantId));

  return customer.id;
}

// ═══════════════════════════════════════
// SUBSCRIPTION SYNC (from webhooks)
// ═══════════════════════════════════════

export async function syncSubscriptionFromStripe(stripeSubscription: Stripe.Subscription) {
  const tenantId = parseInt(stripeSubscription.metadata?.tenant_id || "0", 10);
  const plan = (stripeSubscription.metadata?.plan || "solo") as PlanCode;

  if (!tenantId) {
    console.error("[Stripe] Missing tenant_id in subscription metadata:", stripeSubscription.id);
    return;
  }

  const status = mapStripeStatus(stripeSubscription.status);
  const customerId = typeof stripeSubscription.customer === "string"
    ? stripeSubscription.customer
    : (stripeSubscription.customer as any)?.id;

  const firstItem = stripeSubscription.items?.data?.[0];
  const priceId = firstItem?.price?.id || null;
  const priceInCents = firstItem?.price?.unit_amount || null;

  const db = await getDb();
  if (!db) {
    console.error("[Stripe] Database not available for sync");
    return;
  }

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.billingProvider, "stripe")
      )
    )
    .limit(1);

  const now = new Date();
  const trialStart = stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null;
  const trialEnd = stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null;
  const periodStart = (stripeSubscription as any).current_period_start
    ? new Date((stripeSubscription as any).current_period_start * 1000)
    : null;
  const periodEnd = (stripeSubscription as any).current_period_end
    ? new Date((stripeSubscription as any).current_period_end * 1000)
    : null;
  const cancelledAt = stripeSubscription.canceled_at
    ? new Date(stripeSubscription.canceled_at * 1000)
    : null;

  const subData = {
    plan,
    status,
    billingProvider: "stripe" as const,
    stripeCustomerId: customerId,
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId: priceId,
    priceInCents: priceInCents,
    trialStartedAt: trialStart,
    trialEndsAt: trialEnd,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelledAt,
    subscriptionStartedAt: now,
  };

  if (existing) {
    await db
      .update(subscriptions)
      .set(subData)
      .where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({
      tenantId,
      ...subData,
    });
  }

  await db
    .update(tenants)
    .set({ plan, billingCustomerId: customerId })
    .where(eq(tenants.id, tenantId));

  console.log(`[Stripe] Synced subscription for tenant ${tenantId}: plan=${plan}, status=${status}`);
}

function mapStripeStatus(stripeStatus: string): "active" | "trialing" | "past_due" | "cancelled" | "expired" | "unpaid" | "incomplete" {
  switch (stripeStatus) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "past_due": return "past_due";
    case "canceled": return "cancelled";
    case "unpaid": return "unpaid";
    case "incomplete": return "incomplete";
    case "incomplete_expired": return "expired";
    default: return "expired";
  }
}

// ═══════════════════════════════════════
// GET SUBSCRIPTION FOR TENANT
// ═══════════════════════════════════════

export async function getActiveSubscription(tenantId: number) {
  const db = await getDb();
  if (!db) return null;

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(subscriptions.createdAt)
    .limit(1);

  return sub || null;
}
