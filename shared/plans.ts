/**
 * FALLBACK ESTÁTICO — Definição centralizada dos planos do Clinilucro.
 *
 * IMPORTANTE: O sistema agora consome planos dinamicamente do banco de dados
 * via `server/services/dynamicPlanService.ts`. Este arquivo serve apenas como
 * FALLBACK caso o banco esteja vazio ou inacessível.
 *
 * Para alterar planos, use o painel SuperAdmin > Gestão de Planos.
 * As alterações no banco são refletidas automaticamente em todo o sistema
 * (cache TTL 5min, invalidado imediatamente após CRUD no SuperAdmin).
 *
 * Nomenclatura comercial:
 *   Essencial (id: "start")  → estrutura e controle para começar
 *   Pro       (id: "growth") → performance e automação para crescer
 *   Elite     (id: "scale")  → escala e prioridade para operações robustas
 */

export type PlanId = "start" | "growth" | "scale";

export interface PlanFeatures {
  /** CRM completo, contatos, negociações, funil, tarefas, histórico */
  crmCore: boolean;
  /** WhatsApp integrado dentro do CRM */
  whatsappEmbedded: boolean;
  /** Disparo de mensagens segmentadas */
  segmentedBroadcast: boolean;
  /** Matriz RFV / Classificação Estratégica */
  rfvEnabled: boolean;
  /** Central de Automações de vendas */
  salesAutomation: boolean;
  /** Suporte prioritário */
  prioritySupport: boolean;
  /** Comunidade Acelera Turismo */
  communityAccess: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  /** Nome comercial do plano */
  name: string;
  /** Descrição curta do posicionamento */
  description: string;
  /** Copy comercial para landing page */
  commercialCopy: string;
  /** Preço em centavos (0 = sob consulta) */
  priceInCents: number;
  /** Limite de usuários (-1 = ilimitado) */
  maxUsers: number;
  /** Limite de contas WhatsApp */
  maxWhatsAppAccounts: number;
  /** Limite de atendentes por conta WhatsApp */
  maxAttendantsPerAccount: number;
  /** Feature flags */
  features: PlanFeatures;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  start: {
    id: "start",
    name: "Essencial",
    description: "Estrutura e controle para começar",
    commercialCopy: "Para organizar sua operação comercial e vender com processo, mesmo começando sozinho.",
    priceInCents: 9700,
    maxUsers: 1,
    maxWhatsAppAccounts: 0,
    maxAttendantsPerAccount: 0,
    features: {
      crmCore: true,
      whatsappEmbedded: false,
      segmentedBroadcast: false,
      rfvEnabled: false,
      salesAutomation: false,
      prioritySupport: false,
      communityAccess: true,
    },
  },
  growth: {
    id: "growth",
    name: "Pro",
    description: "Performance e automação para crescer",
    commercialCopy: "Para agências que querem usar WhatsApp, segmentação, RFV e automações para vender mais com inteligência.",
    priceInCents: 29700,
    maxUsers: 4,
    maxWhatsAppAccounts: 1,
    maxAttendantsPerAccount: 4,
    features: {
      crmCore: true,
      whatsappEmbedded: true,
      segmentedBroadcast: true,
      rfvEnabled: true,
      salesAutomation: true,
      prioritySupport: false,
      communityAccess: true,
    },
  },
  scale: {
    id: "scale",
    name: "Elite",
    description: "Escala e prioridade para operações robustas",
    commercialCopy: "Para equipes que precisam de escala, mais usuários e atendimento prioritário.",
    priceInCents: 0,
    maxUsers: 15,
    maxWhatsAppAccounts: 1,
    maxAttendantsPerAccount: 15,
    features: {
      crmCore: true,
      whatsappEmbedded: true,
      segmentedBroadcast: true,
      rfvEnabled: true,
      salesAutomation: true,
      prioritySupport: true,
      communityAccess: true,
    },
  },
};

/** Ordered list of plans for comparison tables */
export const PLAN_ORDER: PlanId[] = ["start", "growth", "scale"];

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
  feature: keyof PlanFeatures
): boolean {
  return getPlanDefinition(planIdOrLegacy).features[feature];
}

/** Retorna o limite de usuários para um plano */
export function getPlanUserLimit(planIdOrLegacy: string): number {
  return getPlanDefinition(planIdOrLegacy).maxUsers;
}

/** Retorna o nome comercial do plano */
export function getPlanDisplayName(planIdOrLegacy: string): string {
  return getPlanDefinition(planIdOrLegacy).name;
}

/** Retorna o plano mínimo necessário para uma feature */
export function getMinPlanForFeature(feature: keyof PlanFeatures): PlanDefinition {
  for (const id of PLAN_ORDER) {
    if (PLANS[id].features[feature]) return PLANS[id];
  }
  return PLANS.scale; // fallback
}

/** Descrições amigáveis de cada feature para modais de upgrade */
export const FEATURE_DESCRIPTIONS: Record<keyof PlanFeatures, { title: string; description: string; benefit: string }> = {
  crmCore: {
    title: "CRM Completo",
    description: "Gestão de contatos, negociações, funil de vendas, tarefas e histórico comercial.",
    benefit: "Organize sua operação comercial e venda com processo.",
  },
  whatsappEmbedded: {
    title: "WhatsApp no CRM",
    description: "Atenda seus clientes diretamente pelo WhatsApp dentro do CRM, com histórico unificado.",
    benefit: "Centralize toda a comunicação em um só lugar e nunca perca uma conversa.",
  },
  segmentedBroadcast: {
    title: "Disparo Segmentado",
    description: "Envie mensagens segmentadas para grupos específicos de contatos pelo WhatsApp.",
    benefit: "Alcance os clientes certos com a mensagem certa, no momento certo.",
  },
  rfvEnabled: {
    title: "Matriz RFV",
    description: "Classificação estratégica de clientes por Recência, Frequência e Valor.",
    benefit: "Identifique seus melhores clientes e saiba onde focar seus esforços.",
  },
  salesAutomation: {
    title: "Automação de Vendas",
    description: "Automações de follow-up, mudança de etapa, reativação e tarefas automáticas.",
    benefit: "Automatize tarefas repetitivas e foque no que realmente importa: vender.",
  },
  prioritySupport: {
    title: "Suporte Prioritário",
    description: "Atendimento prioritário com tempo de resposta reduzido.",
    benefit: "Tenha suporte dedicado para sua operação nunca parar.",
  },
  communityAccess: {
    title: "Comunidade Acelera Turismo",
    description: "Acesso à comunidade exclusiva de agências de turismo.",
    benefit: "Troque experiências e aprenda com outras agências.",
  },
};
