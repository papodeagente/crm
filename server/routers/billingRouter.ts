import { z } from "zod";
import { publicProcedure, tenantProcedure, getTenantId, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, desc } from "drizzle-orm";
import { subscriptions, subscriptionEvents, tenants } from "../../drizzle/schema";
import { getDb } from "../db";
import { checkBillingAccess } from "../services/billingAccessService";
import { verifySaasSession, isSuperAdmin, SAAS_COOKIE } from "../saasAuth";

export const billingRouter = router({
  // ─── Get current billing status for the logged-in tenant ───
  myBilling: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = getTenantId(ctx);
    const billing = await checkBillingAccess(tenantId);

    // Get subscription details
    const db = await getDb();
    let subscription = null;
    if (db) {
      const subs = await db.select().from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .limit(1);
      subscription = subs[0] || null;
    }

    return {
      ...billing,
      subscription: subscription ? {
        id: subscription.id,
        provider: subscription.provider,
        plan: subscription.plan,
        status: subscription.status,
        trialStartedAt: subscription.trialStartedAt,
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelledAt: subscription.cancelledAt,
        priceInCents: subscription.priceInCents,
        currency: subscription.currency,
        lastEventAt: subscription.lastEventAt,
      } : null,
    };
  }),

  // ─── SuperAdmin: list subscription events (audit trail) ───
  adminListEvents: publicProcedure
    .input(z.object({
      tenantId: z.number().optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const cookies = parseCookies(ctx.req.headers.cookie);
      const token = cookies.get(SAAS_COOKIE);
      const session = await verifySaasSession(token);
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let events;
      if (input.tenantId) {
        events = await db.select().from(subscriptionEvents)
          .where(eq(subscriptionEvents.tenantId, input.tenantId))
          .orderBy(desc(subscriptionEvents.createdAt))
          .limit(input.limit).offset(input.offset);
      } else {
        events = await db.select().from(subscriptionEvents)
          .orderBy(desc(subscriptionEvents.createdAt))
          .limit(input.limit).offset(input.offset);
      }
      return events;
    }),

  // ─── SuperAdmin: get billing summary for a specific tenant ───
  adminTenantBilling: publicProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ ctx, input }) => {
      const cookies = parseCookies(ctx.req.headers.cookie);
      const token = cookies.get(SAAS_COOKIE);
      const session = await verifySaasSession(token);
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const billing = await checkBillingAccess(input.tenantId);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const subs = await db.select().from(subscriptions)
        .where(eq(subscriptions.tenantId, input.tenantId))
        .limit(1);

      const events = await db.select().from(subscriptionEvents)
        .where(eq(subscriptionEvents.tenantId, input.tenantId))
        .orderBy(desc(subscriptionEvents.createdAt))
        .limit(20);

      return {
        billing,
        subscription: subs[0] || null,
        recentEvents: events,
      };
    }),

  // ─── SuperAdmin: manually update tenant billing status ───
  adminUpdateBillingStatus: publicProcedure
    .input(z.object({
      tenantId: z.number(),
      billingStatus: z.enum(["active", "trialing", "past_due", "restricted", "cancelled", "expired"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const cookies = parseCookies(ctx.req.headers.cookie);
      const token = cookies.get(SAAS_COOKIE);
      const session = await verifySaasSession(token);
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(tenants).set({ billingStatus: input.billingStatus })
        .where(eq(tenants.id, input.tenantId));

      return { success: true };
    }),

  // ─── SuperAdmin: toggle legacy flag ───
  adminToggleLegacy: publicProcedure
    .input(z.object({
      tenantId: z.number(),
      isLegacy: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const cookies = parseCookies(ctx.req.headers.cookie);
      const token = cookies.get(SAAS_COOKIE);
      const session = await verifySaasSession(token);
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(tenants).set({ isLegacy: input.isLegacy })
        .where(eq(tenants.id, input.tenantId));

      return { success: true };
    }),
});

// Helper to parse cookies
function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  cookieHeader.split(";").forEach((cookie) => {
    const [key, ...vals] = cookie.trim().split("=");
    if (key) map.set(key.trim(), vals.join("=").trim());
  });
  return map;
}
