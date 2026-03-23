import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { crmUsers, tenants } from "../../drizzle/schema";
import { eq, and, ne } from "drizzle-orm";
import { getPlanConfig, type PlanCode } from "./stripeService";
import { sql } from "drizzle-orm";

// ═══════════════════════════════════════
// ACCESS LEVEL TYPES
// ═══════════════════════════════════════

export type AccessLevel = "full" | "read_only" | "billing_only";

// ═══════════════════════════════════════
// ACCESS LEVEL FROM SUBSCRIPTION STATUS
// ═══════════════════════════════════════

export function getAccessLevel(subscriptionStatus: string | null): AccessLevel {
  if (!subscriptionStatus) return "full";
  switch (subscriptionStatus) {
    case "active":
    case "trialing":
    case "incomplete":
      return "full";
    case "past_due":
    case "unpaid":
    case "cancelled":
    case "expired":
      return "read_only";
    default:
      return "read_only";
  }
}

// ═══════════════════════════════════════
// ASSERT FULL ACCESS (for mutations)
// ═══════════════════════════════════════

export function assertFullAccess(accessLevel: AccessLevel) {
  if (accessLevel !== "full") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Sua assinatura não permite esta ação. Regularize seu pagamento em Configurações > Assinatura.",
    });
  }
}

// ═══════════════════════════════════════
// USER LIMIT CHECK
// ═══════════════════════════════════════

export async function assertCanAddUser(tenantId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const [tenant] = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tenant não encontrado" });
  }

  const planCode = tenant.plan as PlanCode;
  let config;
  try {
    config = getPlanConfig(planCode);
  } catch {
    config = getPlanConfig("solo");
  }

  if (config.maxUsers === -1) return;

  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(crmUsers)
    .where(
      and(
        eq(crmUsers.tenantId, tenantId),
        ne(crmUsers.status, "inactive")
      )
    );

  const currentUsers = result?.count || 0;

  if (currentUsers >= config.maxUsers) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Limite de ${config.maxUsers} usuário(s) atingido no plano ${config.name}. Faça upgrade para adicionar mais usuários.`,
    });
  }
}

// ═══════════════════════════════════════
// GET LIMITS INFO (for UI)
// ═══════════════════════════════════════

export async function getTenantLimits(tenantId: number) {
  const db = await getDb();
  if (!db) return { plan: "solo" as PlanCode, maxUsers: 1, currentUsers: 0, canAddUser: true, remainingSlots: 1 };

  const [tenant] = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const planCode = (tenant?.plan || "free") as PlanCode;
  
  let config;
  try {
    config = getPlanConfig(planCode);
  } catch {
    config = getPlanConfig("solo");
  }

  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(crmUsers)
    .where(
      and(
        eq(crmUsers.tenantId, tenantId),
        ne(crmUsers.status, "inactive")
      )
    );

  const currentUsers = result?.count || 0;

  return {
    plan: planCode,
    maxUsers: config.maxUsers,
    currentUsers,
    canAddUser: config.maxUsers === -1 || currentUsers < config.maxUsers,
    remainingSlots: config.maxUsers === -1 ? -1 : Math.max(0, config.maxUsers - currentUsers),
  };
}
