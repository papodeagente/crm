/**
 * AI Usage Log — observabilidade de consumo LLM.
 *
 * Toda chamada LLM (sucesso ou falha) registra uma row em `ai_usage_log`:
 * tokens consumidos, custo estimado em centavos, duração, erro (se houver).
 *
 * Ver specs/domains/ai-deal-intelligence.spec.md § Invariantes operacionais #5.
 */

import { getDb } from "./db";
import { aiUsageLog } from "../drizzle/schema";
import { and, eq, gte, desc, sql } from "drizzle-orm";

export type AiFeature = "lead_scoring" | "deal_summary" | "entity_extraction" | "chat_suggestion";
export type AiProvider = "openai" | "anthropic";

export interface AiUsageRecord {
  tenantId: number;
  feature: AiFeature;
  provider: AiProvider;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  dealId?: number | null;
  userId?: number | null;
  durationMs?: number;
  success: boolean;
  errorCode?: string | null;
}

/**
 * Tabela de preços em USD por 1M tokens (input, output).
 * Atualizar conforme Anthropic/OpenAI mudam pricing.
 * Snapshot de abril/2026.
 */
const MODEL_PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-7": { input: 15, output: 75 },
  // OpenAI
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
};

const USD_TO_BRL_ROUGH = 5.5; // aproximado; só pra dar uma ordem de grandeza pro admin

/**
 * Calcula custo estimado em centavos BRL com base no modelo e tokens.
 * Retorna null se modelo não conhecido (não queremos mentir pro admin).
 */
export function estimateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = MODEL_PRICING_USD_PER_1M[model];
  if (!pricing) return null;
  const usd = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
  const brl = usd * USD_TO_BRL_ROUGH;
  return Math.round(brl * 100); // centavos
}

/**
 * Grava uma row em ai_usage_log. Silencioso em erro (logging não deve quebrar
 * o fluxo crítico — se o log falha, o report principal já deu certo).
 */
export async function logAiUsage(record: AiUsageRecord): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const inputTokens = record.inputTokens ?? 0;
    const outputTokens = record.outputTokens ?? 0;
    const totalTokens = record.totalTokens ?? (inputTokens + outputTokens);
    const estimatedCostCents = totalTokens > 0
      ? estimateCostCents(record.model, inputTokens, outputTokens)
      : null;

    await db.insert(aiUsageLog).values({
      tenantId: record.tenantId,
      feature: record.feature,
      provider: record.provider,
      model: record.model,
      inputTokens: inputTokens || null,
      outputTokens: outputTokens || null,
      totalTokens: totalTokens || null,
      estimatedCostCents,
      dealId: record.dealId ?? null,
      userId: record.userId ?? null,
      durationMs: record.durationMs ?? null,
      success: record.success,
      errorCode: record.errorCode ?? null,
    });
  } catch (err: any) {
    console.warn("[aiUsageLog] failed to log:", err?.message);
  }
}

/**
 * Lista últimas N chamadas de um tenant (pra tela de histórico).
 */
export async function listRecentUsage(tenantId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiUsageLog)
    .where(eq(aiUsageLog.tenantId, tenantId))
    .orderBy(desc(aiUsageLog.createdAt))
    .limit(limit);
}

/**
 * Agregado por feature em um período (para cards de resumo).
 */
export async function aggregateUsageByFeature(tenantId: number, daysBack = 30) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      feature: aiUsageLog.feature,
      calls: sql<number>`COUNT(*)::int`,
      successCalls: sql<number>`COUNT(*) FILTER (WHERE ${aiUsageLog.success} = true)::int`,
      totalTokens: sql<number>`COALESCE(SUM(${aiUsageLog.totalTokens}), 0)::int`,
      estimatedCostCents: sql<number>`COALESCE(SUM(${aiUsageLog.estimatedCostCents}), 0)::int`,
    })
    .from(aiUsageLog)
    .where(and(
      eq(aiUsageLog.tenantId, tenantId),
      gte(aiUsageLog.createdAt, since),
    ))
    .groupBy(aiUsageLog.feature);
  return rows;
}
