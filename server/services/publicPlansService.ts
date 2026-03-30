/**
 * publicPlansService.ts
 * 
 * Serviço público para retornar planos ativos para a landing page.
 * Cache em memória com TTL de 10 minutos.
 * Retorna apenas dados seguros — sem IDs internos, configs de tenant ou billing.
 * Fallback para PLANS de shared/plans.ts se banco vazio ou erro.
 */

import { getDb } from "../db";
import { planDefinitions, planFeatures } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { PLANS, PLAN_ORDER } from "../../shared/plans";

// ─── Public plan types (safe for frontend) ───────────────────────
export interface PublicPlanFeature {
  key: string;
  label: string;
  isEnabled: boolean;
}

export interface PublicPlan {
  slug: string;
  name: string;
  description: string;
  commercialCopy: string;
  priceCents: number;
  billingCycle: string;
  isPopular: boolean;
  sortOrder: number;
  checkoutUrl: string | null;
  color: string | null;
  limits: {
    maxUsers: number;
    maxWhatsAppAccounts: number;
    maxAttendantsPerAccount: number;
  };
  features: PublicPlanFeature[];
}

// ─── Cache ────────────────────────────────────────────────────────
let cachedPlans: PublicPlan[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function invalidatePublicPlanCache() {
  cachedPlans = null;
  cacheTimestamp = 0;
}

// ─── Feature key → human label ───────────────────────────────────
function featureKeyToLabel(key: string): string {
  const labels: Record<string, string> = {
    crmCore: "CRM completo (passageiros, negociações, funil, tarefas)",
    communityAccess: "Comunidade Acelera Turismo",
    whatsappEmbedded: "WhatsApp integrado ao CRM",
    segmentedBroadcast: "Disparo segmentado de mensagens",
    rfvEnabled: "Matriz RFV (Classificação Estratégica)",
    salesAutomation: "Automação de vendas",
    prioritySupport: "Suporte prioritário",
    customFields: "Campos personalizados",
    dateAutomation: "Automações por data",
    aiFeatures: "Inteligência artificial",
    apiAccess: "Acesso à API",
    multiPipeline: "Múltiplos funis",
    importExport: "Importação e exportação",
    advancedReports: "Relatórios avançados",
  };
  return labels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

// ─── Fallback from shared/plans.ts ───────────────────────────────
function buildFallbackPlans(): PublicPlan[] {
  return PLAN_ORDER.map((slug, idx) => {
    const def = PLANS[slug];
    return {
      slug,
      name: def.name,
      description: def.description || "",
      commercialCopy: (def as any).commercialCopy || "",
      priceCents: def.priceInCents ?? 0,
      billingCycle: "monthly",
      isPopular: slug === "growth",
      sortOrder: idx,
      checkoutUrl: null,
      color: null,
      limits: {
        maxUsers: def.maxUsers ?? 1,
        maxWhatsAppAccounts: def.maxWhatsAppAccounts ?? 0,
        maxAttendantsPerAccount: def.maxAttendantsPerAccount ?? 0,
      },
      features: Object.entries(def.features || {}).map(([key, enabled]) => ({
        key,
        label: featureKeyToLabel(key),
        isEnabled: !!enabled,
      })),
    };
  });
}

// ─── Main function ───────────────────────────────────────────────
export async function getPublicPlans(): Promise<PublicPlan[]> {
  // Return cache if still fresh
  if (cachedPlans && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPlans;
  }

  try {
    const db = await getDb();
    if (!db) {
      console.log("[PublicPlans] DB not available, using fallback");
      const fallback = buildFallbackPlans();
      cachedPlans = fallback;
      cacheTimestamp = Date.now();
      return fallback;
    }

    // Fetch active plans ordered by displayOrder
    const plans = await db
      .select()
      .from(planDefinitions)
      .where(eq(planDefinitions.isActive, true))
      .orderBy(asc(planDefinitions.displayOrder));

    if (!plans.length) {
      console.log("[PublicPlans] No active plans in DB, using fallback");
      const fallback = buildFallbackPlans();
      cachedPlans = fallback;
      cacheTimestamp = Date.now();
      return fallback;
    }

    // Fetch all features
    const allFeatures = await db
      .select()
      .from(planFeatures);

    // Build feature map by planId
    const featureMap = new Map<number, PublicPlanFeature[]>();
    for (const f of allFeatures) {
      if (!featureMap.has(f.planId)) featureMap.set(f.planId, []);
      featureMap.get(f.planId)!.push({
        key: f.featureKey,
        label: featureKeyToLabel(f.featureKey),
        isEnabled: f.isEnabled ?? true,
      });
    }

    // Filter to only public plans and map to safe output
    const publicPlans: PublicPlan[] = plans
      .filter((p) => p.isPublic)
      .map((p, idx) => {
        const pFeatures = featureMap.get(p.id) || [];
        // Derive limits from plan_features limitValue entries
        const limitMap = new Map<string, number>();
        for (const f of allFeatures.filter((af) => af.planId === p.id && af.limitValue != null)) {
          limitMap.set(f.featureKey, f.limitValue!);
        }
        return {
          slug: p.slug,
          name: p.name,
          description: p.description || "",
          commercialCopy: p.commercialCopy || "",
          priceCents: p.priceCents ?? 0,
          billingCycle: p.billingCycle || "monthly",
          isPopular: p.slug === "growth", // growth/Pro is the popular plan
          sortOrder: p.displayOrder ?? idx,
          checkoutUrl: p.hotmartOfferCode
            ? `https://pay.hotmart.com/S104799458W?off=${p.hotmartOfferCode}`
            : null,
          color: null,
          limits: {
            maxUsers: limitMap.get("maxUsers") ?? 1,
            maxWhatsAppAccounts: limitMap.get("maxWhatsAppAccounts") ?? 0,
            maxAttendantsPerAccount: limitMap.get("maxAttendantsPerAccount") ?? 0,
          },
          features: pFeatures,
        };
      });

    cachedPlans = publicPlans;
    cacheTimestamp = Date.now();
    return publicPlans;
  } catch (err) {
    console.error("[PublicPlans] Error fetching plans from DB, using fallback:", err);
    const fallback = buildFallbackPlans();
    cachedPlans = fallback;
    cacheTimestamp = Date.now();
    return fallback;
  }
}
