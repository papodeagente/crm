/**
 * Plan Limits Service
 * Enforcement centralizado de limites e restrições por plano.
 * Usa a definição de shared/plans.ts como fonte da verdade.
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { tenants, crmUsers } from "../../drizzle/schema";
import { getPlanDefinition, planHasFeature, type PlanId } from "../../shared/plans";

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
  const def = getPlanDefinition(plan);
  const currentCount = await countTenantUsers(tenantId);

  if (def.maxUsers === -1) {
    return { allowed: true, currentCount, limit: -1 };
  }

  if (currentCount >= def.maxUsers) {
    return {
      allowed: false,
      reason: `O plano ${def.name} permite no máximo ${def.maxUsers} usuário(s). Você já tem ${currentCount}. Faça upgrade para adicionar mais.`,
      currentCount,
      limit: def.maxUsers,
    };
  }

  return { allowed: true, currentCount, limit: def.maxUsers };
}

/** Guard: lança erro se não puder adicionar usuário */
export async function assertCanAddUser(tenantId: number): Promise<void> {
  const result = await canAddUser(tenantId);
  if (!result.allowed) {
    throw new Error(result.reason ?? "PLAN_USER_LIMIT_REACHED");
  }
}

// ─── Feature Access Enforcement ────────────────────────────────────

/** Verifica se o tenant tem acesso à Central de Automações */
export async function canAccessAutomationCenter(tenantId: number): Promise<boolean> {
  const plan = await getTenantPlan(tenantId);
  return planHasFeature(plan, "automationCenter");
}

/** Verifica se o tenant tem acesso à Classificação Estratégica */
export async function canAccessStrategicClassification(tenantId: number): Promise<boolean> {
  const plan = await getTenantPlan(tenantId);
  return planHasFeature(plan, "strategicClassification");
}

/** Retorna um resumo completo dos limites e features do tenant */
export async function getTenantPlanSummary(tenantId: number) {
  const plan = await getTenantPlan(tenantId);
  const def = getPlanDefinition(plan);
  const currentUsers = await countTenantUsers(tenantId);

  return {
    planId: def.id,
    planName: def.name,
    maxUsers: def.maxUsers,
    currentUsers,
    maxWhatsAppInstances: def.maxWhatsAppInstances,
    maxUsersPerInstance: def.maxUsersPerInstance,
    features: def.features,
  };
}
