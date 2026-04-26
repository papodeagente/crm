/**
 * AI Settings — leitura/escrita das feature flags de IA no tenant.
 *
 * Estrutura em `tenants.settingsJson.ai`:
 *   {
 *     leadScoringEnabled: boolean (default false)
 *     dealSummaryEnabled: boolean (default false)
 *     enabledBy?: number   // userId do admin que ativou a última flag
 *     enabledAt?: string   // ISO timestamp
 *   }
 *
 * Default = false pra ambas. Admin precisa ativar explicitamente em
 * Configurações → Integrações → IA. Sem opt-in, scheduler pula e endpoints
 * respondem LEAD_SCORING_DISABLED / DEAL_SUMMARY_DISABLED.
 *
 * Ver specs/domains/ai-deal-intelligence.spec.md § Invariantes operacionais #1.
 */

import { getDb } from "./db";
import { tenants } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export interface AiFeatureFlags {
  leadScoringEnabled: boolean;
  dealSummaryEnabled: boolean;
  enabledBy?: number;
  enabledAt?: string;
}

const DEFAULT_FLAGS: AiFeatureFlags = {
  leadScoringEnabled: false,
  dealSummaryEnabled: false,
};

/**
 * Lê as flags de IA do tenant. Retorna defaults (tudo false) quando tenant
 * ainda não tem a sub-object `ai` em settingsJson.
 */
export async function getAiFeatureFlags(tenantId: number): Promise<AiFeatureFlags> {
  const db = await getDb();
  if (!db) return { ...DEFAULT_FLAGS };
  const [row] = await db.select({ settingsJson: tenants.settingsJson })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const ai = ((row?.settingsJson as any)?.ai) || {};
  return {
    leadScoringEnabled: Boolean(ai.leadScoringEnabled),
    dealSummaryEnabled: Boolean(ai.dealSummaryEnabled),
    enabledBy: ai.enabledBy,
    enabledAt: ai.enabledAt,
  };
}

/**
 * Atualiza as flags de IA do tenant. Preserva outras chaves de settingsJson.
 * Atualiza enabledBy/enabledAt pra trilha (útil pra entender quem ativou e quando).
 */
export async function setAiFeatureFlags(
  tenantId: number,
  updates: Partial<Pick<AiFeatureFlags, "leadScoringEnabled" | "dealSummaryEnabled">>,
  actorUserId?: number,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const [row] = await db.select({ settingsJson: tenants.settingsJson })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const currentSettings = (row?.settingsJson as any) || {};
  const currentAi = currentSettings.ai || {};
  const nextAi: AiFeatureFlags = {
    leadScoringEnabled: updates.leadScoringEnabled ?? Boolean(currentAi.leadScoringEnabled),
    dealSummaryEnabled: updates.dealSummaryEnabled ?? Boolean(currentAi.dealSummaryEnabled),
    enabledBy: actorUserId ?? currentAi.enabledBy,
    enabledAt: new Date().toISOString(),
  };
  const nextSettings = { ...currentSettings, ai: nextAi };
  await db.update(tenants).set({ settingsJson: nextSettings }).where(eq(tenants.id, tenantId));
}
