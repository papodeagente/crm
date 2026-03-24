/**
 * Definição centralizada dos planos do ENTUR OS.
 * Usado tanto no frontend (limites, labels) quanto no backend (enforcement).
 */

export type PlanId = "start" | "growth" | "scale";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  priceInCents: number; // 0 = sob consulta
  maxUsers: number; // -1 = ilimitado
  maxWhatsAppInstances: number; // -1 = ilimitado
  maxUsersPerInstance: number; // -1 = ilimitado
  features: {
    automationCenter: boolean;
    strategicClassification: boolean;
    allCoreFeatures: boolean;
  };
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  start: {
    id: "start",
    name: "Start",
    description: "Para agências que estão começando a organizar suas vendas",
    priceInCents: 9700,
    maxUsers: 1,
    maxWhatsAppInstances: 1,
    maxUsersPerInstance: 1,
    features: {
      automationCenter: false,
      strategicClassification: false,
      allCoreFeatures: true,
    },
  },
  growth: {
    id: "growth",
    name: "Growth",
    description: "Para agências em crescimento que precisam de automação e equipe",
    priceInCents: 29700,
    maxUsers: 5,
    maxWhatsAppInstances: 1,
    maxUsersPerInstance: 5,
    features: {
      automationCenter: true,
      strategicClassification: true,
      allCoreFeatures: true,
    },
  },
  scale: {
    id: "scale",
    name: "Scale",
    description: "Para agências que precisam de escala total e suporte dedicado",
    priceInCents: 0,
    maxUsers: -1,
    maxWhatsAppInstances: -1,
    maxUsersPerInstance: -1,
    features: {
      automationCenter: true,
      strategicClassification: true,
      allCoreFeatures: true,
    },
  },
};

/** Mapeia os nomes antigos do enum do banco para os novos IDs */
export const LEGACY_PLAN_MAP: Record<string, PlanId> = {
  free: "start",
  pro: "growth",
  enterprise: "scale",
};

/** Retorna a definição do plano, aceitando nomes legados */
export function getPlanDefinition(planIdOrLegacy: string): PlanDefinition {
  const mapped = LEGACY_PLAN_MAP[planIdOrLegacy] ?? planIdOrLegacy;
  return PLANS[mapped as PlanId] ?? PLANS.start;
}

/** Verifica se um plano tem acesso a uma feature */
export function planHasFeature(
  planIdOrLegacy: string,
  feature: keyof PlanDefinition["features"]
): boolean {
  return getPlanDefinition(planIdOrLegacy).features[feature];
}

/** Retorna o limite de usuários para um plano */
export function getPlanUserLimit(planIdOrLegacy: string): number {
  return getPlanDefinition(planIdOrLegacy).maxUsers;
}
