/**
 * Dynamic Plan Service
 * 
 * Fonte da verdade para definições de planos no sistema inteiro.
 * Lê do banco (plan_definitions + plan_features) com cache TTL 5min.
 * Fallback para shared/plans.ts quando o banco estiver vazio.
 * 
 * REGRA: Todo código que precisar de informações de plano DEVE usar este serviço.
 * shared/plans.ts é mantido apenas como fallback estático.
 */

import { eq, sql, asc } from "drizzle-orm";
import { getDb } from "../db";
import { planDefinitions, planFeatures } from "../../drizzle/schema";
import {
  PLANS,
  PLAN_ORDER,
  LEGACY_PLAN_MAP,
  FEATURE_DESCRIPTIONS,
  type PlanDefinition as StaticPlanDefinition,
  type PlanFeatures as StaticPlanFeatures,
  type PlanId,
} from "../../shared/plans";

// ─── Types ─────────────────────────────────────────────────────────

export interface DynamicPlanDefinition {
  id: string;           // slug (ex: "start", "growth", "scale")
  dbId: number;         // DB primary key
  name: string;         // Nome comercial (ex: "Essencial", "Pro", "Elite")
  description: string;
  commercialCopy: string;
  priceInCents: number;
  billingCycle: "monthly" | "annual";
  isActive: boolean;
  isPublic: boolean;
  hotmartOfferCode: string | null;
  displayOrder: number;
  maxUsers: number;
  maxWhatsAppAccounts: number;
  maxAttendantsPerAccount: number;
  features: Record<string, boolean>;
}

export interface DynamicPlanCache {
  plans: Record<string, DynamicPlanDefinition>;
  planOrder: string[];
  fetchedAt: number;
}

// ─── Cache ─────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let planCache: DynamicPlanCache | null = null;

/**
 * Invalida o cache forçando reload na próxima chamada.
 * Chamar após qualquer alteração em plan_definitions ou plan_features.
 */
export function invalidatePlanCache(): void {
  planCache = null;
  console.log("[DynamicPlanService] Cache invalidated");
}

/**
 * Converte os planos estáticos do shared/plans.ts para o formato dinâmico.
 * Usado como fallback quando o banco está vazio.
 */
function buildStaticFallback(): DynamicPlanCache {
  const plans: Record<string, DynamicPlanDefinition> = {};
  let order = 1;

  for (const planId of PLAN_ORDER) {
    const staticPlan = PLANS[planId];
    plans[planId] = {
      id: planId,
      dbId: 0,
      name: staticPlan.name,
      description: staticPlan.description,
      commercialCopy: staticPlan.commercialCopy,
      priceInCents: staticPlan.priceInCents,
      billingCycle: "monthly",
      isActive: true,
      isPublic: true,
      hotmartOfferCode: null,
      displayOrder: order++,
      maxUsers: staticPlan.maxUsers,
      maxWhatsAppAccounts: staticPlan.maxWhatsAppAccounts,
      maxAttendantsPerAccount: staticPlan.maxAttendantsPerAccount,
      features: { ...staticPlan.features },
    };
  }

  return {
    plans,
    planOrder: [...PLAN_ORDER],
    fetchedAt: Date.now(),
  };
}

/**
 * Carrega planos do banco de dados.
 * Retorna null se o banco estiver vazio (fallback para estático).
 */
async function loadPlansFromDB(): Promise<DynamicPlanCache | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const allPlans = await db
      .select()
      .from(planDefinitions)
      .orderBy(asc(planDefinitions.displayOrder), asc(planDefinitions.id));

    if (allPlans.length === 0) {
      console.warn("[DynamicPlanService] plan_definitions is empty, using static fallback");
      return null;
    }

    const allFeatures = await db.select().from(planFeatures);

    const plans: Record<string, DynamicPlanDefinition> = {};
    const planOrder: string[] = [];

    for (const p of allPlans) {
      const slug = p.slug;
      const pFeatures = allFeatures.filter((f) => f.planId === p.id);

      // Extract limit features
      let maxUsers = 1;
      let maxWhatsAppAccounts = 0;
      let maxAttendantsPerAccount = 0;
      const featureFlags: Record<string, boolean> = {};

      for (const f of pFeatures) {
        if (f.featureKey === "maxUsers") {
          maxUsers = f.limitValue ?? 1;
        } else if (f.featureKey === "maxWhatsAppAccounts") {
          maxWhatsAppAccounts = f.limitValue ?? 0;
        } else if (f.featureKey === "maxAttendantsPerAccount") {
          maxAttendantsPerAccount = f.limitValue ?? 0;
        } else {
          featureFlags[f.featureKey] = f.isEnabled;
        }
      }

      plans[slug] = {
        id: slug,
        dbId: p.id,
        name: p.name,
        description: p.description ?? "",
        commercialCopy: p.commercialCopy ?? "",
        priceInCents: p.priceCents,
        billingCycle: p.billingCycle,
        isActive: p.isActive,
        isPublic: p.isPublic,
        hotmartOfferCode: p.hotmartOfferCode ?? null,
        displayOrder: p.displayOrder,
        maxUsers,
        maxWhatsAppAccounts,
        maxAttendantsPerAccount,
        features: featureFlags,
      };

      if (p.isActive) {
        planOrder.push(slug);
      }
    }

    return { plans, planOrder, fetchedAt: Date.now() };
  } catch (err: any) {
    console.error("[DynamicPlanService] Error loading plans from DB:", err.message);
    return null;
  }
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Retorna todos os planos (do banco com cache, ou fallback estático).
 * Esta é a função principal que todo o sistema deve usar.
 */
export async function getAllPlans(): Promise<DynamicPlanCache> {
  // Check cache
  if (planCache && (Date.now() - planCache.fetchedAt) < CACHE_TTL_MS) {
    return planCache;
  }

  // Try DB
  const dbCache = await loadPlansFromDB();
  if (dbCache) {
    planCache = dbCache;
    return planCache;
  }

  // Fallback to static
  planCache = buildStaticFallback();
  return planCache;
}

/**
 * Retorna a definição de um plano específico por slug.
 * Aceita nomes legados (free → start, pro → growth, enterprise → scale).
 */
export async function getDynamicPlanDefinition(planSlugOrLegacy: string): Promise<DynamicPlanDefinition> {
  const mapped = LEGACY_PLAN_MAP[planSlugOrLegacy] ?? planSlugOrLegacy;
  const cache = await getAllPlans();
  return cache.plans[mapped] ?? cache.plans["start"] ?? buildStaticFallback().plans["start"];
}

/**
 * Verifica se um plano tem acesso a uma feature.
 */
export async function dynamicPlanHasFeature(planSlugOrLegacy: string, feature: string): Promise<boolean> {
  const plan = await getDynamicPlanDefinition(planSlugOrLegacy);
  return plan.features[feature] ?? false;
}

/**
 * Retorna o nome comercial do plano.
 */
export async function getDynamicPlanDisplayName(planSlugOrLegacy: string): Promise<string> {
  const plan = await getDynamicPlanDefinition(planSlugOrLegacy);
  return plan.name;
}

/**
 * Retorna o limite de usuários para um plano.
 */
export async function getDynamicPlanUserLimit(planSlugOrLegacy: string): Promise<number> {
  const plan = await getDynamicPlanDefinition(planSlugOrLegacy);
  return plan.maxUsers;
}

/**
 * Retorna o plano mínimo necessário para uma feature.
 */
export async function getDynamicMinPlanForFeature(feature: string): Promise<DynamicPlanDefinition> {
  const cache = await getAllPlans();
  for (const slug of cache.planOrder) {
    const plan = cache.plans[slug];
    if (plan && plan.features[feature]) return plan;
  }
  // Fallback: last plan
  const lastSlug = cache.planOrder[cache.planOrder.length - 1] ?? "scale";
  return cache.plans[lastSlug] ?? buildStaticFallback().plans["scale"];
}

/**
 * Retorna os planos ativos e públicos para exibição no frontend (landing, upgrade, etc).
 * Ordenados por displayOrder.
 */
export async function getPublicPlans(): Promise<DynamicPlanDefinition[]> {
  const cache = await getAllPlans();
  return cache.planOrder
    .map((slug) => cache.plans[slug])
    .filter((p) => p && p.isActive && p.isPublic);
}

/**
 * Retorna as descrições de features para modais de upgrade.
 * Combina as descrições estáticas com as features dinâmicas.
 */
export function getFeatureDescriptions(): Record<string, { title: string; description: string; benefit: string }> {
  return FEATURE_DESCRIPTIONS as Record<string, { title: string; description: string; benefit: string }>;
}
