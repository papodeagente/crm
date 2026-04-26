/**
 * aiLeadScoringService.ts
 *
 * Fase 1 — Classificação automática de deals em 3 tiers (quente/morno/frio)
 * com base em sinais da conversa WhatsApp + estado no CRM.
 *
 * "hot"   → cliente demonstra urgência, pergunta pagamento, quer fechar
 * "warm"  → interessado mas sem sinal claro de fechamento
 * "cold"  → sem resposta, objeções não resolvidas, intenção baixa
 *
 * Persistência em `deals.aiLeadScore` + `aiLeadScoreReason` + `aiLeadScoreAt`.
 * Ver `specs/domains/ai-deal-intelligence.spec.md`.
 */

import { sql, eq, and, isNull, desc, inArray } from "drizzle-orm";
import { deals } from "../drizzle/schema";
import { getDb, callTenantAi, getAiTrainingConfig, getAnyActiveAiIntegration } from "./db";
import {
  getDealById,
  getContactById,
  getWhatsAppMessagesByDeal,
} from "./crmDb";
import { getAiFeatureFlags } from "./aiSettings";
import { logAiUsage } from "./aiUsageLog";

export type LeadScore = "hot" | "warm" | "cold";

// Guardrails: mínimo de dados necessários pra a IA conseguir pontuar com sentido.
// Foi pedido pelo usuário após reportar que conversas só com "oi" viravam "warm".
export const MIN_CLIENT_MESSAGES = 3;
export const MIN_TOTAL_MESSAGES = 10;
// Cooldown por deal (on-demand). Scheduler tem cooldown separado de 18h (logo abaixo).
export const DEAL_RESCORE_COOLDOWN_MS = 5 * 60 * 1000;

export interface ScoreDealInput {
  tenantId: number;
  dealId: number;
  integrationId?: number;
  overrideModel?: string;
  /** quem disparou a pontuação (null quando vem do scheduler) */
  userId?: number | null;
  /** flag interna: quando true (scheduler), NÃO aplica cooldown curto por deal
   *  — o scheduler já tem cooldown de 18h próprio em `scoreDealsForTenant`. */
  skipDealCooldown?: boolean;
}

export interface ScoreDealResult {
  score: LeadScore;
  reason: string;
  provider: string;
  model: string;
  messagesConsidered: number;
}

export async function scoreDeal(input: ScoreDealInput): Promise<ScoreDealResult> {
  const { tenantId, dealId, userId } = input;

  // Guardrail 1: feature flag (opt-in explícito do admin)
  // Ver specs § Invariantes operacionais #1.
  const flags = await getAiFeatureFlags(tenantId);
  if (!flags.leadScoringEnabled) throw new Error("LEAD_SCORING_DISABLED");

  const deal = await getDealById(tenantId, dealId);
  if (!deal) throw new Error("DEAL_NOT_FOUND");

  // Guardrail 2: rate limit por deal (evita clique compulsivo).
  // Scheduler passa skipDealCooldown=true porque já tem cooldown de 18h próprio.
  if (!input.skipDealCooldown && deal.aiLeadScoreAt) {
    const sinceLastMs = Date.now() - new Date(deal.aiLeadScoreAt).getTime();
    if (sinceLastMs < DEAL_RESCORE_COOLDOWN_MS) throw new Error("RATE_LIMIT_DEAL");
  }

  let contactName = "Contato";
  if (deal.contactId) {
    const contact = await getContactById(tenantId, deal.contactId);
    if (contact?.name) contactName = contact.name;
  }

  const msgResult = await getWhatsAppMessagesByDeal(dealId, tenantId, { limit: 60 });
  const messages = msgResult.messages || [];

  // Guardrail 3: dados mínimos pra IA pontuar com sentido.
  // Sem isso, conversa com 1 "oi" virava "warm" (feedback direto do usuário).
  // Se não atende, NÃO chama LLM — zero custo. Retorna score=warm + reason clara.
  const clientMessages = messages.filter((m: any) => !m.fromMe);
  if (clientMessages.length < MIN_CLIENT_MESSAGES && messages.length < MIN_TOTAL_MESSAGES) {
    throw new Error("INSUFFICIENT_DATA");
  }

  // Sinais pre-computados (dão à IA um resumo rápido dos últimos estados)
  const lastMessage = messages[messages.length - 1];
  const lastActivityIso = deal.lastActivityAt ? new Date(deal.lastActivityAt).toISOString() : "desconhecida";
  const daysSinceActivity = deal.lastActivityAt
    ? Math.floor((Date.now() - new Date(deal.lastActivityAt).getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const lastFromClient = lastMessage && !lastMessage.fromMe;

  const formattedMessages = messages.length
    ? messages
        .slice(-40)
        .map((m: any) => {
          const sender = m.fromMe ? "AGENTE" : contactName.toUpperCase();
          const content = m.content || `[${m.messageType || "mídia"}]`;
          return `${sender}: ${content}`;
        })
        .join("\n")
    : "(Sem mensagens WhatsApp.)";

  const trainingConfig = await getAiTrainingConfig(tenantId, "scoring" as any);
  const customInstructions = trainingConfig?.instructions || "";

  const systemPrompt = `Você classifica o "termômetro" de uma negociação de agência de viagens em 3 tiers:

- "hot": cliente demonstra urgência, quer fechar, pergunta forma de pagamento, responde rápido, pediu dados para reserva
- "warm": interessado, mas sem sinal claro de urgência ou fechamento
- "cold": sem resposta há dias, objeções não resolvidas, intenção baixa, conversa esfriou

Regras:
- Silêncio do cliente por 5+ dias com conversa inconclusiva = cold
- Cliente pedindo pagamento / forma de reservar / data exata = hot
- Cliente só pediu cotação sem follow-up = warm
- Se agente está devendo retorno ao cliente, NÃO é cold (é warm com alerta)

Responda EXCLUSIVAMENTE com JSON:
{ "score": "hot" | "warm" | "cold", "reason": "uma frase curta em PT-BR explicando o porquê" }
${customInstructions ? `\n--- INSTRUÇÕES DO GESTOR ---\n${customInstructions}` : ""}`;

  const userPrompt = `## Deal
- Título: ${deal.title}
- Status: ${deal.status}
- Última atividade: ${lastActivityIso} (${daysSinceActivity != null ? `há ${daysSinceActivity} dias` : "sem data"})
- Última msg foi do ${lastFromClient ? "cliente" : "agente"}
- Valor: ${deal.valueCents ? `R$ ${(Number(deal.valueCents) / 100).toLocaleString("pt-BR")}` : "não informado"}

## Conversa
${formattedMessages}`;

  const startedAt = Date.now();
  let aiResult: Awaited<ReturnType<typeof callTenantAi>>;
  try {
    aiResult = await callTenantAi({
      tenantId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 200,
      integrationId: input.integrationId,
      overrideModel: input.overrideModel,
    });
  } catch (err: any) {
    // Log falha (tokens=0) pra admin ver que teve tentativa + motivo.
    await logAiUsage({
      tenantId,
      feature: "lead_scoring",
      provider: "openai", // best-effort; ao falhar antes do provider ser escolhido, assume openai
      model: input.overrideModel || "unknown",
      success: false,
      errorCode: String(err?.message || "UNKNOWN").slice(0, 64),
      durationMs: Date.now() - startedAt,
      dealId,
      userId: userId ?? null,
    });
    throw err;
  }

  const parsed = parseScore(aiResult.content);

  const now = new Date();
  const db = await getDb();
  if (db) {
    await db
      .update(deals)
      .set({
        aiLeadScore: parsed.score,
        aiLeadScoreReason: parsed.reason,
        aiLeadScoreAt: now,
      })
      .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)));
  }

  await logAiUsage({
    tenantId,
    feature: "lead_scoring",
    provider: aiResult.provider as any,
    model: aiResult.model,
    inputTokens: aiResult.inputTokens,
    outputTokens: aiResult.outputTokens,
    totalTokens: aiResult.totalTokens,
    success: true,
    durationMs: Date.now() - startedAt,
    dealId,
    userId: userId ?? null,
  });

  return {
    score: parsed.score,
    reason: parsed.reason,
    provider: aiResult.provider,
    model: aiResult.model,
    messagesConsidered: messages.length,
  };
}

function parseScore(raw: string): { score: LeadScore; reason: string } {
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1]!.trim();
  else {
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) jsonStr = match[0];
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { score: "warm", reason: "IA retornou resposta inválida; fallback para morno." };
  }

  const rawScore = String(parsed?.score || "").toLowerCase().trim();
  const score: LeadScore = rawScore === "hot" || rawScore === "cold" ? rawScore : "warm";
  const reason = typeof parsed?.reason === "string" && parsed.reason.trim()
    ? parsed.reason.trim().slice(0, 500)
    : "Sem motivo retornado pela IA.";
  return { score, reason };
}

/**
 * Batch scoring pro scheduler diário.
 * Só pontua deals com status=open que não foram pontuadas nas últimas 18h
 * (evita custo repetido se o scheduler rodar por engano duas vezes).
 */
export async function scoreDealsForTenant(tenantId: number, limit = 100): Promise<{
  scored: number;
  skipped: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) return { scored: 0, skipped: 0, errors: 0 };

  // Só tenta se há integração ativa — evita erro em loop pra tenants sem IA
  const integration = await getAnyActiveAiIntegration(tenantId);
  if (!integration) return { scored: 0, skipped: 0, errors: 0 };

  // Opt-in obrigatório: admin precisa ter ativado a flag. Sem isso, scheduler
  // NÃO consome tokens do tenant (regra #1 do ai-deal-intelligence.spec).
  const flags = await getAiFeatureFlags(tenantId);
  if (!flags.leadScoringEnabled) return { scored: 0, skipped: 0, errors: 0 };

  const eighteenHoursAgo = new Date(Date.now() - 18 * 60 * 60 * 1000);

  const rows = await db.execute(sql`
    SELECT "id" FROM "deals"
    WHERE "tenantId" = ${tenantId}
      AND "status" = 'open'
      AND "deletedAt" IS NULL
      AND ("aiLeadScoreAt" IS NULL OR "aiLeadScoreAt" < ${eighteenHoursAgo.toISOString()}::timestamp)
    ORDER BY "lastActivityAt" DESC NULLS LAST
    LIMIT ${limit}
  `);

  const dealIds: number[] = ((rows as any).rows || []).map((r: any) => Number(r.id));

  let scored = 0;
  let skipped = 0;
  let errors = 0;

  for (const dealId of dealIds) {
    try {
      // Scheduler usa skipDealCooldown=true (já tem cooldown próprio de 18h acima).
      await scoreDeal({ tenantId, dealId, skipDealCooldown: true });
      scored++;
    } catch (err: any) {
      const msg = err?.message;
      // Erros "aceitáveis" no batch (guardrails fazendo o trabalho): não contam como erro real.
      if (
        msg === "NO_MESSAGES" ||
        msg === "DEAL_NOT_FOUND" ||
        msg === "INSUFFICIENT_DATA" ||
        msg === "LEAD_SCORING_DISABLED"
      ) {
        skipped++;
      } else {
        errors++;
        console.warn(`[aiLeadScoring] tenant=${tenantId} deal=${dealId} error:`, msg);
      }
    }
  }

  return { scored, skipped, errors };
}

/** Itera sobre todos os tenants com integração AI ativa. */
export async function scoreDealsForAllTenants(maxPerTenant = 100): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Lista tenants que têm integração AI ativa (ai_integrations.isActive = true)
  const tenantRows = await db.execute(sql`
    SELECT DISTINCT "tenantId" FROM "ai_integrations" WHERE "isActive" = true
  `);
  const tenantIds: number[] = ((tenantRows as any).rows || []).map((r: any) => Number(r.tenantId));

  let tenantsProcessed = 0;
  let tenantsSkipped = 0;
  let totalScored = 0;
  let totalErrors = 0;

  for (const tenantId of tenantIds) {
    try {
      // Check flag explicitamente aqui pra log auditável (skip vs ran).
      // scoreDealsForTenant também checa; duplicar garante trail nos logs.
      const flags = await getAiFeatureFlags(tenantId);
      if (!flags.leadScoringEnabled) {
        tenantsSkipped++;
        console.log(`[AI Scheduler] skip tenant ${tenantId} (leadScoringEnabled=false)`);
        continue;
      }
      const result = await scoreDealsForTenant(tenantId, maxPerTenant);
      tenantsProcessed++;
      totalScored += result.scored;
      totalErrors += result.errors;
      if (result.scored > 0 || result.errors > 0) {
        console.log(`[aiLeadScoring] tenant=${tenantId} scored=${result.scored} skipped=${result.skipped} errors=${result.errors}`);
      }
    } catch (err: any) {
      totalErrors++;
      console.error(`[aiLeadScoring] tenant=${tenantId} fatal:`, err?.message);
    }
  }

  console.log(`[AI Scheduler] run finished: tenants=${tenantIds.length} processed=${tenantsProcessed} skipped=${tenantsSkipped} scored=${totalScored} errors=${totalErrors}`);
}
