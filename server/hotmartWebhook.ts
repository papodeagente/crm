import { eq, and } from "drizzle-orm";
import { tenants, subscriptions } from "../drizzle/schema";
import { getDb } from "./db";
import type { Request, Response } from "express";

/**
 * Hotmart Webhook Handler
 * 
 * Events handled:
 * - PURCHASE_COMPLETE: New subscription activated
 * - PURCHASE_CANCELED: Subscription cancelled
 * - PURCHASE_REFUNDED: Subscription refunded
 * - PURCHASE_DELAYED: Payment delayed
 * - PURCHASE_APPROVED: Payment approved (recurring)
 * - SUBSCRIPTION_CANCELLATION: Subscription cancelled by user
 * - PURCHASE_PROTEST: Payment disputed
 * - PURCHASE_CHARGEBACK: Chargeback received
 */

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
      price: {
        value: number;
        currency_value: string;
      };
      approved_date?: number;
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
  };
}

export async function handleHotmartWebhook(req: Request, res: Response) {
  try {
    // Verify hottok
    const hottok = req.headers["x-hotmart-hottok"] || req.query.hottok;
    const expectedHottok = process.env.HOTMART_HOTTOK;
    
    if (expectedHottok && hottok !== expectedHottok) {
      console.warn("[Hotmart Webhook] Invalid hottok");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = req.body as HotmartWebhookPayload;
    const event = payload.event;
    const buyerEmail = payload.data?.buyer?.email;

    if (!buyerEmail) {
      console.warn("[Hotmart Webhook] Missing buyer email");
      return res.status(400).json({ error: "Missing buyer email" });
    }

    console.log(`[Hotmart Webhook] Event: ${event} | Email: ${buyerEmail}`);

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    // Find tenant by hotmartEmail
    const tenantRows = await db.select().from(tenants)
      .where(eq(tenants.hotmartEmail, buyerEmail))
      .limit(1);

    if (tenantRows.length === 0) {
      console.warn(`[Hotmart Webhook] No tenant found for email: ${buyerEmail}`);
      // Still return 200 to avoid Hotmart retries
      return res.status(200).json({ status: "no_tenant_found" });
    }

    const tenant = tenantRows[0];
    const transactionId = payload.data?.purchase?.transaction;
    const subscriptionId = payload.data?.subscription?.subscriber_code;
    const productId = payload.data?.product?.id?.toString();
    const priceInCents = Math.round((payload.data?.purchase?.price?.value || 97) * 100);

    switch (event) {
      case "PURCHASE_COMPLETE":
      case "PURCHASE_APPROVED": {
        // Activate subscription
        await db.update(tenants).set({
          plan: "pro",
          status: "active",
        }).where(eq(tenants.id, tenant.id));

        // Upsert subscription
        const existingSub = await db.select().from(subscriptions)
          .where(eq(subscriptions.tenantId, tenant.id))
          .limit(1);

        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        if (existingSub.length > 0) {
          await db.update(subscriptions).set({
            plan: "pro",
            status: "active",
            hotmartTransactionId: transactionId,
            hotmartSubscriptionId: subscriptionId,
            hotmartProductId: productId,
            hotmartBuyerEmail: buyerEmail,
            priceInCents,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          }).where(eq(subscriptions.id, existingSub[0].id));
        } else {
          await db.insert(subscriptions).values({
            tenantId: tenant.id,
            plan: "pro",
            status: "active",
            hotmartTransactionId: transactionId,
            hotmartSubscriptionId: subscriptionId,
            hotmartProductId: productId,
            hotmartBuyerEmail: buyerEmail,
            priceInCents,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          });
        }

        console.log(`[Hotmart Webhook] Tenant ${tenant.id} activated as Pro`);
        break;
      }

      case "PURCHASE_CANCELED":
      case "PURCHASE_REFUNDED":
      case "SUBSCRIPTION_CANCELLATION":
      case "PURCHASE_CHARGEBACK": {
        // Suspend tenant
        await db.update(tenants).set({
          status: "suspended",
        }).where(eq(tenants.id, tenant.id));

        // Update subscription
        const sub = await db.select().from(subscriptions)
          .where(eq(subscriptions.tenantId, tenant.id))
          .limit(1);

        if (sub.length > 0) {
          await db.update(subscriptions).set({
            status: event === "SUBSCRIPTION_CANCELLATION" ? "cancelled" : "expired",
            cancelledAt: new Date(),
          }).where(eq(subscriptions.id, sub[0].id));
        }

        console.log(`[Hotmart Webhook] Tenant ${tenant.id} suspended (${event})`);
        break;
      }

      case "PURCHASE_DELAYED":
      case "PURCHASE_PROTEST": {
        // Mark as past_due but don't suspend yet
        const subPastDue = await db.select().from(subscriptions)
          .where(eq(subscriptions.tenantId, tenant.id))
          .limit(1);

        if (subPastDue.length > 0) {
          await db.update(subscriptions).set({
            status: "past_due",
          }).where(eq(subscriptions.id, subPastDue[0].id));
        }

        console.log(`[Hotmart Webhook] Tenant ${tenant.id} marked as past_due (${event})`);
        break;
      }

      default:
        console.log(`[Hotmart Webhook] Unhandled event: ${event}`);
    }

    return res.status(200).json({ status: "ok" });
  } catch (error: any) {
    console.error("[Hotmart Webhook] Error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
}
