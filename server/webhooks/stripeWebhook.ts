import type { Request, Response } from "express";
import Stripe from "stripe";
import { ENV } from "../_core/env";
import { syncSubscriptionFromStripe } from "../services/stripeService";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2025-02-24.acacia" as any });
  }
  return _stripe;
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string;

  if (!sig) {
    console.error("[Stripe Webhook] Missing stripe-signature header");
    return res.status(400).json({ error: "Missing signature" });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, ENV.stripeWebhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Test event detection
  if (event.id.startsWith("evt_test_")) {
    console.log("[Stripe Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await syncSubscriptionFromStripe(subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionFromStripe(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as any;
        if (invoice.subscription) {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(
            typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id
          );
          await syncSubscriptionFromStripe(subscription);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        console.warn(`[Stripe Webhook] Payment failed for invoice ${invoice.id}`);
        if (invoice.subscription) {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(
            typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id
          );
          await syncSubscriptionFromStripe(subscription);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (err: any) {
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, err.message);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
