/**
 * Plan Limits Service
 * Enforcement centralizado de limites e restrições por plano.
 * 
 * REFATORADO: Agora usa dynamicPlanService (banco + cache TTL 5min)
 * como fonte da verdade, enriquecida por getEffectiveEntitlement (add-ons + overrides).
 * shared/plans.ts é usado apenas como fallback dentro do dynamicPlanService.
 * 
 * ASSINATURAS MANTIDAS: Nenhuma assinatura de função foi alterada.
 * Todos os consumidores existentes continuam funcionando sem mudanças.
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { tenants, crmUsers } from "../../drizzle/schema";
import { type PlanFeatures } from "../../shared/plans";
import { TRPCError } from "@trpc/server";
import { getEffectiveEntitlement } from "./planEntitlementService";
import {
  getDynamicPlanDefinition,
  dynamicPlanHasFeature,
  getDynamicMinPlanForFeature,
} from "./dynamicPlanService";

// ─── Tenant Plan Lookup ────────────────────────────────────────────

/** Busca o plano atual de um tenant no banco */
export async function getTenantPlan(tenantId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "start";
  const rows = await db.select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return rows[0]?.plan ?? "start";
}

// ─── User Limit Enforcement ────────────────────────────────────────

/** Conta usuários ativos (não deletados) de um tenant */
export async function countTenantUsers(tenantId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ id: crmUsers.id })
    .from(crmUsers)
    .where(and(
      eq(crmUsers.tenantId, tenantId),
      sql`${crmUsers.status} != 'deleted'`
    ));
  return rows.length;
}

/** Verifica se o tenant pode adicionar mais um usuário */
export async function canAddUser(tenantId: number): Promise<{ allowed: boolean; reason?: string; currentCount: number; limit: number }> {
  const plan = await getTenantPlan(tenantId);
  const def = await getDynamicPlanDefinition(plan);
  const currentCount = await countTenantUsers(tenantId);

  // Resolve effective limit: base plan + add-ons + overrides
  let effectiveMaxUsers = def.maxUsers;
  try {
    const entitlement = await getEffectiveEntitlement(tenantId);
    const baseLimit = entitlement.features["maxUsers"]?.limitValue ?? def.maxUsers;
    const addonUsers = entitlement.addons.extraUsers;
    effectiveMaxUsers = baseLimit + addonUsers;
  } catch {
    // Fallback to dynamic definition — never break enforcement
  }

  if (effectiveMaxUsers === -1) {
    return { allowed: true, currentCount, limit: -1 };
  }

  if (currentCount >= effectiveMaxUsers) {
    return {
      allowed: false,
      reason: `O plano ${def.name} permite no máximo ${effectiveMaxUsers} usuário(s). Você já tem ${currentCount}. Faça upgrade para adicionar mais.`,
      currentCount,
      limit: effectiveMaxUsers,
    };
  }

  return { allowed: true, currentCount, limit: effectiveMaxUsers };
}

/** Guard: lança erro se não puder adicionar usuário */
export async function assertCanAddUser(tenantId: number): Promise<void> {
  const result = await canAddUser(tenantId);
  if (!result.allowed) {
    throw new Error(result.reason ?? "PLAN_USER_LIMIT_REACHED");
  }
}

// ─── Feature Access Enforcement ────────────────────────────────────

/** Verifica se o tenant tem acesso a uma feature específica */
export async function canAccessFeature(tenantId: number, feature: keyof PlanFeatures): Promise<boolean> {
  const plan = await getTenantPlan(tenantId);
  const dynamicAccess = await dynamicPlanHasFeature(plan, feature);

  // Check if entitlement overrides or add-ons grant access
  try {
    const entitlement = await getEffectiveEntitlement(tenantId);
    const featureEntry = entitlement.features[feature];
    if (featureEntry !== undefined) {
      return featureEntry.isEnabled;
    }
  } catch {
    // Fallback to dynamic definition
  }

  return dynamicAccess;
}

/** Guard genérico: lança FORBIDDEN se tenant não tem acesso à feature */
export async function assertFeatureAccess(tenantId: number, feature: keyof PlanFeatures): Promise<void> {
  const hasAccess = await canAccessFeature(tenantId, feature);
  if (!hasAccess) {
    const minPlan = await getDynamicMinPlanForFeature(feature);
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `PLAN_FEATURE_BLOCKED:${feature}:${minPlan.name}`,
    });
  }
}

// ─── Backward-compatible aliases ───────────────────────────────────

/** Verifica se o tenant tem acesso à Central de Automações (salesAutomation) */
export async function canAccessAutomationCenter(tenantId: number): Promise<boolean> {
  return canAccessFeature(tenantId, "salesAutomation");
}

/** Verifica se o tenant tem acesso à Classificação Estratégica (rfvEnabled) */
export async function canAccessStrategicClassification(tenantId: number): Promise<boolean> {
  return canAccessFeature(tenantId, "rfvEnabled");
}

/** Verifica se o tenant tem acesso ao WhatsApp integrado */
export async function canAccessWhatsApp(tenantId: number): Promise<boolean> {
  return canAccessFeature(tenantId, "whatsappEmbedded");
}

/** Verifica se o tenant tem acesso ao disparo segmentado */
export async function canAccessSegmentedBroadcast(tenantId: number): Promise<boolean> {
  return canAccessFeature(tenantId, "segmentedBroadcast");
}

// ─── Plan Summary ──────────────────────────────────────────────────

/** Retorna um resumo completo dos limites e features do tenant */
export async function getTenantPlanSummary(tenantId: number) {
  const plan = await getTenantPlan(tenantId);
  const def = await getDynamicPlanDefinition(plan);
  const currentUsers = await countTenantUsers(tenantId);

  // Enrich with effective entitlement (add-ons + overrides)
  let effectiveMaxUsers = def.maxUsers;
  let effectiveMaxWA = def.maxWhatsAppAccounts;
  let effectiveMaxAttendants = def.maxAttendantsPerAccount;
  try {
    const entitlement = await getEffectiveEntitlement(tenantId);
    effectiveMaxUsers = (entitlement.features["maxUsers"]?.limitValue ?? def.maxUsers) + entitlement.addons.extraUsers;
    effectiveMaxWA = (entitlement.features["maxWhatsAppAccounts"]?.limitValue ?? def.maxWhatsAppAccounts) + entitlement.addons.whatsappNumbers;
    effectiveMaxAttendants = entitlement.features["maxAttendantsPerAccount"]?.limitValue ?? def.maxAttendantsPerAccount;
  } catch {
    // Fallback to dynamic definition
  }

  return {
    planId: def.id,
    planName: def.name,
    description: def.description,
    commercialCopy: def.commercialCopy,
    maxUsers: effectiveMaxUsers,
    currentUsers,
    maxWhatsAppAccounts: effectiveMaxWA,
    maxAttendantsPerAccount: effectiveMaxAttendants,
    features: def.features,
    priceInCents: def.priceInCents,
  };
}
