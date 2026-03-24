/**
 * Billing Access Service
 *
 * Centralized billing access control.
 * Determines whether a tenant can perform write operations based on billing status.
 *
 * Rules:
 * - Legacy tenants (isLegacy=true) → always full access (grandfathered)
 * - billingStatus "active" or "trialing" → full access
 * - billingStatus "past_due" → full access (grace period)
 * - billingStatus "cancelled" with active period → full access until period ends
 * - billingStatus "restricted" / "expired" → read-only mode
 * - billingStatus "cancelled" with expired period → read-only mode
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { tenants, subscriptions } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export type BillingAccessLevel = "full" | "restricted";

export interface BillingAccessResult {
  level: BillingAccessLevel;
  isLegacy: boolean;
  billingStatus: string;
  plan: string;
  reason?: string;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  /** Human-readable message for the frontend */
  message?: string;
}

/**
 * Check billing access for a tenant.
 * Returns "full" or "restricted" access level.
 */
export async function checkBillingAccess(tenantId: number): Promise<BillingAccessResult> {
  const db = await getDb();
  if (!db) {
    return { level: "full", isLegacy: false, billingStatus: "active", plan: "start", reason: "DB_UNAVAILABLE" };
  }

  const tenantRows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (tenantRows.length === 0) {
    return { level: "restricted", isLegacy: false, billingStatus: "expired", plan: "start", reason: "TENANT_NOT_FOUND" };
  }

  const tenant = tenantRows[0];

  // Legacy tenants always have full access (grandfathered)
  if (tenant.isLegacy) {
    return {
      level: "full",
      isLegacy: true,
      billingStatus: tenant.billingStatus,
      plan: tenant.plan,
      reason: "LEGACY_GRANDFATHERED",
    };
  }

  // Get subscription info
  const subRows = await db.select().from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);
  const sub = subRows[0] || null;

  const now = new Date();

  switch (tenant.billingStatus) {
    case "active":
      return {
        level: "full",
        isLegacy: false,
        billingStatus: "active",
        plan: tenant.plan,
        currentPeriodEnd: sub?.currentPeriodEnd,
      };

    case "trialing":
      // Check if trial has expired
      if (sub?.trialEndsAt && sub.trialEndsAt < now) {
        // Trial expired — restrict
        await db.update(tenants).set({ billingStatus: "restricted" }).where(eq(tenants.id, tenantId));
        return {
          level: "restricted",
          isLegacy: false,
          billingStatus: "restricted",
          plan: tenant.plan,
          reason: "TRIAL_EXPIRED",
          trialEndsAt: sub.trialEndsAt,
          message: "Seu período de teste expirou. Assine um plano para continuar usando o sistema.",
        };
      }
      return {
        level: "full",
        isLegacy: false,
        billingStatus: "trialing",
        plan: tenant.plan,
        trialEndsAt: sub?.trialEndsAt,
      };

    case "past_due":
      // Grace period — still allow access
      return {
        level: "full",
        isLegacy: false,
        billingStatus: "past_due",
        plan: tenant.plan,
        currentPeriodEnd: sub?.currentPeriodEnd,
        message: "Seu pagamento está pendente. Regularize para evitar a suspensão do acesso.",
      };

    case "cancelled":
      // Check if still within paid period
      if (sub?.currentPeriodEnd && sub.currentPeriodEnd > now) {
        return {
          level: "full",
          isLegacy: false,
          billingStatus: "cancelled",
          plan: tenant.plan,
          currentPeriodEnd: sub.currentPeriodEnd,
          message: `Sua assinatura foi cancelada. Acesso disponível até ${sub.currentPeriodEnd.toLocaleDateString("pt-BR")}.`,
        };
      }
      // Period expired
      return {
        level: "restricted",
        isLegacy: false,
        billingStatus: "cancelled",
        plan: tenant.plan,
        reason: "CANCELLED_PERIOD_EXPIRED",
        message: "Sua assinatura foi cancelada e o período pago expirou. Assine novamente para continuar.",
      };

    case "restricted":
      return {
        level: "restricted",
        isLegacy: false,
        billingStatus: "restricted",
        plan: tenant.plan,
        reason: "BILLING_RESTRICTED",
        message: "Seu acesso está restrito. Regularize sua assinatura para continuar usando o sistema.",
      };

    case "expired":
      return {
        level: "restricted",
        isLegacy: false,
        billingStatus: "expired",
        plan: tenant.plan,
        reason: "SUBSCRIPTION_EXPIRED",
        message: "Sua assinatura expirou. Assine um plano para continuar usando o sistema.",
      };

    default:
      // Defensive: unknown status → full access to avoid false blocks
      return {
        level: "full",
        isLegacy: false,
        billingStatus: tenant.billingStatus,
        plan: tenant.plan,
        reason: "UNKNOWN_STATUS",
      };
  }
}

/**
 * Quick check: is the tenant in restricted mode?
 */
export async function isTenantRestricted(tenantId: number): Promise<boolean> {
  const result = await checkBillingAccess(tenantId);
  return result.level === "restricted";
}

/**
 * Guard: throws if tenant is in restricted mode.
 * Use in mutation endpoints that should be blocked for restricted tenants.
 */
export async function assertNotRestricted(tenantId: number): Promise<void> {
  const result = await checkBillingAccess(tenantId);
  if (result.level === "restricted") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: result.message || "Seu acesso está restrito. Assine um plano para continuar.",
    });
  }
}
