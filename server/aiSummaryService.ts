/**
 * aiSummaryService.ts
 *
 * Fase 1 — Resumo dinâmico da deal.
 * Gera um resumo curto (1-2 frases) que responde "o que é essa deal, onde está,
 * o que precisa agora". Mostrado no topo do DealDetail.
 *
 * Gatilhos de re-cálculo:
 *  - Manual (botão "Atualizar resumo")
 *  - Após grupo de 5+ mensagens novas
 *  - Após mudança de stage
 *  - Após nova entidade extraída aceita
 *
 * Persistência em `deals.aiSummary` + `deals.aiSummaryUpdatedAt`.
 * Ver `specs/domains/ai-deal-intelligence.spec.md`.
 */

import { sql, eq, and } from "drizzle-orm";
import { deals } from "../drizzle/schema";
import { getDb, callTenantAi, getAiTrainingConfig } from "./db";
import {
  getDealById,
  getContactById,
  getWhatsAppMessagesByDeal,
  listDealHistory,
  listTasks,
} from "./crmDb";
import { getAiFeatureFlags } from "./aiSettings";
import { logAiUsage } from "./aiUsageLog";

// Cooldown por deal (mesma lógica do scoring): evita clique compulsivo.
export const SUMMARY_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

export interface RefreshSummaryInput {
  tenantId: number;
  dealId: number;
  /** Override de provider+modelo — default é seguir tenant settings */
  integrationId?: number;
  overrideModel?: string;
  /** Máximo de mensagens de WhatsApp no contexto */
  maxMessages?: number;
  /** quem disparou (null quando vem de trigger automático) */
  userId?: number | null;
  /** flag interna: pula cooldown (triggers automáticos já têm backoff próprio) */
  skipCooldown?: boolean;
}

export interface RefreshSummaryResult {
  summary: string;
  updatedAt: Date;
  provider: string;
  model: string;
  messagesConsidered: number;
}

export async function refreshDealSummary(input: RefreshSummaryInput): Promise<RefreshSummaryResult> {
  const { tenantId, dealId, userId } = input;

  // Guardrail 1: feature flag (opt-in explícito do admin). Ver ai-deal-intelligence.spec §1.
  const flags = await getAiFeatureFlags(tenantId);
  if (!flags.dealSummaryEnabled) throw new Error("DEAL_SUMMARY_DISABLED");

  const deal = await getDealById(tenantId, dealId);
  if (!deal) throw new Error("DEAL_NOT_FOUND");

  // Guardrail 2: cooldown de 5min por deal (evita clique compulsivo).
  if (!input.skipCooldown && deal.aiSummaryUpdatedAt) {
    const sinceMs = Date.now() - new Date(deal.aiSummaryUpdatedAt).getTime();
    if (sinceMs < SUMMARY_REFRESH_COOLDOWN_MS) throw new Error("RATE_LIMIT_DEAL");
  }

  // Contato
  let contactName = "Contato";
  if (deal.contactId) {
    const contact = await getContactById(tenantId, deal.contactId);
    if (contact?.name) contactName = contact.name;
  }

  // Mensagens recentes (limite conservador — resumo não precisa de contexto completo)
  const maxMessages = input.maxMessages ?? 40;
  const msgResult = await getWhatsAppMessagesByDeal(dealId, tenantId, { limit: maxMessages });
  const messages = msgResult.messages || [];

  const formattedMessages = messages.length
    ? messages
        .map((m: any) => {
          const sender = m.fromMe ? "AGENTE" : contactName.toUpperCase();
          const content = m.content || `[${m.messageType || "mídia"}]`;
          return `${sender}: ${content}`;
        })
        .join("\n")
    : "(Sem mensagens WhatsApp nesta deal.)";

  // Histórico de stages + tarefas (resumo rápido)
  const [historyEntries, tasksResult] = await Promise.all([
    listDealHistory(tenantId, dealId),
    listTasks(tenantId, { entityType: "deal", entityId: dealId, limit: 20 }),
  ]);

  const stageHistoryContext = historyEntries.length
    ? historyEntries
        .slice(0, 10)
        .filter((h: any) => h.fromStageName && h.toStageName)
        .map((h: any) => `- ${h.fromStageName} → ${h.toStageName}`)
        .join("\n") || "(Sem mudanças de stage.)"
    : "(Sem histórico.)";

  const pendingTasksContext = tasksResult.tasks
    .filter((t: any) => t.status === "pending" || t.status === "in_progress")
    .slice(0, 5)
    .map((t: any) => `- ${t.title || t.taskType}`)
    .join("\n") || "(Nenhuma tarefa pendente.)";

  // Training config customizado (opcional)
  const trainingConfig = await getAiTrainingConfig(tenantId, "summary" as any);
  const customInstructions = trainingConfig?.instructions || "";

  const systemPrompt = `Você é um analista de CRM pra uma agência de viagens. Gere um resumo EXTREMAMENTE curto (máx 2 frases, ~30 palavras) da deal abaixo respondendo: quem é o cliente, o que quer, em que pé a negociação está.

Formato: 1-2 frases diretas em português brasileiro. Sem listas, sem markdown, sem aspas.
Exemplo bom: "Família Silva, 4 pessoas, Cancun em Nov/2026, budget ~R$18k; aguardando proposta de 2 hotéis."
Exemplo ruim: "O cliente está interessado em viajar." (genérico demais)

${customInstructions ? `--- INSTRUÇÕES DO GESTOR ---\n${customInstructions}` : ""}`;

  const userPrompt = `## Deal
- Título: ${deal.title}
- Valor: ${deal.valueCents ? `R$ ${(Number(deal.valueCents) / 100).toLocaleString("pt-BR")}` : "não informado"}
- Status: ${deal.status}
- Contato: ${contactName}

## Mudanças de stage recentes
${stageHistoryContext}

## Tarefas pendentes
${pendingTasksContext}

## Últimas mensagens WhatsApp (${messages.length})
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
      maxTokens: 180,
      integrationId: input.integrationId,
      overrideModel: input.overrideModel,
    });
  } catch (err: any) {
    await logAiUsage({
      tenantId,
      feature: "deal_summary",
      provider: "openai",
      model: input.overrideModel || "unknown",
      success: false,
      errorCode: String(err?.message || "UNKNOWN").slice(0, 64),
      durationMs: Date.now() - startedAt,
      dealId,
      userId: userId ?? null,
    });
    throw err;
  }

  const summary = aiResult.content.trim().replace(/^["']|["']$/g, "");
  if (!summary) {
    await logAiUsage({
      tenantId,
      feature: "deal_summary",
      provider: aiResult.provider as any,
      model: aiResult.model,
      inputTokens: aiResult.inputTokens,
      outputTokens: aiResult.outputTokens,
      totalTokens: aiResult.totalTokens,
      success: false,
      errorCode: "AI_EMPTY_RESPONSE",
      durationMs: Date.now() - startedAt,
      dealId,
      userId: userId ?? null,
    });
    throw new Error("AI_EMPTY_RESPONSE");
  }

  const updatedAt = new Date();

  const db = await getDb();
  if (db) {
    await db
      .update(deals)
      .set({ aiSummary: summary, aiSummaryUpdatedAt: updatedAt })
      .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)));
  }

  await logAiUsage({
    tenantId,
    feature: "deal_summary",
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
    summary,
    updatedAt,
    provider: aiResult.provider,
    model: aiResult.model,
    messagesConsidered: messages.length,
  };
}
