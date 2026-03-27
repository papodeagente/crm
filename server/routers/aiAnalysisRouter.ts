import { z } from "zod";
import { router, tenantProcedure, getTenantId } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getLatestAnalysis,
  getAnalysisHistory,
  saveAnalysis,
  getWhatsAppMessagesByDeal,
  countWhatsAppMessagesByDeal,
  getDealById,
  getContactById,
  listDealHistory,
  listTasks,
} from "../crmDb";
import { callTenantAi, getAiTrainingConfig } from "../db";

export const aiAnalysisRouter = router({
  // Get latest analysis for a deal
  getLatest: tenantProcedure
    .input(z.object({ dealId: z.number() }))
    .query(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      return getLatestAnalysis(tenantId, input.dealId);
    }),

  // Get analysis history for a deal
  getHistory: tenantProcedure
    .input(z.object({ dealId: z.number() }))
    .query(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      return getAnalysisHistory(tenantId, input.dealId);
    }),

  // Analyze conversation with AI — now uses tenant's AI provider + deal history
  analyze: tenantProcedure
    .input(z.object({
      dealId: z.number(),
      forceNew: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      const userId = ctx.user.id;

      // Check if there's a recent analysis (less than 1 hour old) unless forced
      if (!input.forceNew) {
        const existing = await getLatestAnalysis(tenantId, input.dealId);
        if (existing && existing.createdAt) {
          const ageMs = Date.now() - new Date(existing.createdAt).getTime();
          if (ageMs < 60 * 60 * 1000) {
            return { cached: true, analysis: existing };
          }
        }
      }

      // Get deal info
      const deal = await getDealById(tenantId, input.dealId);
      if (!deal) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Negociação não encontrada" });
      }

      // Get message count
      const msgCount = await countWhatsAppMessagesByDeal(input.dealId, tenantId);
      if (msgCount === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma mensagem WhatsApp encontrada para esta negociação. Verifique se o contato possui telefone cadastrado.",
        });
      }

      // Get messages
      const msgResult = await getWhatsAppMessagesByDeal(input.dealId, tenantId, { limit: 200 });
      const messages = msgResult.messages || [];

      // Get contact info
      let contactName = "Contato";
      if (msgResult.contact?.name) {
        contactName = msgResult.contact.name;
      } else if (deal.contactId) {
        const contact = await getContactById(tenantId, deal.contactId);
        if (contact) contactName = contact.name;
      }

      // ─── NEW: Get deal history (stage changes, field edits, etc.) ───
      const historyEntries = await listDealHistory(tenantId, input.dealId);
      const historyContext = historyEntries.length > 0
        ? historyEntries.slice(0, 50).map((h: any) => {
            const date = h.createdAt
              ? new Date(h.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
              : "data desconhecida";
            let line = `[${date}] ${h.action}`;
            if (h.fromStageName && h.toStageName) {
              line += ` — De "${h.fromStageName}" para "${h.toStageName}"`;
            }
            if (h.fieldChanged) {
              line += ` — Campo: ${h.fieldChanged}`;
              if (h.oldValue) line += ` (de: ${h.oldValue})`;
              if (h.newValue) line += ` (para: ${h.newValue})`;
            }
            if (h.description && !h.fromStageName) {
              line += ` — ${h.description}`;
            }
            if (h.actorName) line += ` [por ${h.actorName}]`;
            return line;
          }).join("\n")
        : "Nenhum histórico de movimentação registrado.";

      // ─── NEW: Get deal tasks ───
      const tasksResult = await listTasks(tenantId, { entityType: "deal", entityId: input.dealId, limit: 30 });
      const tasksContext = tasksResult.tasks.length > 0
        ? tasksResult.tasks.map((t: any) => {
            const dueDate = t.dueDate
              ? new Date(t.dueDate).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" })
              : "sem prazo";
            return `- [${t.status}] ${t.title || t.taskType} — Prazo: ${dueDate}`;
          }).join("\n")
        : "Nenhuma tarefa registrada.";

      // Format messages for LLM
      const formattedMessages = messages
        .map((msg: any) => {
          const time = msg.timestamp
            ? new Date(Number(msg.timestamp) * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
            : "horário desconhecido";
          const sender = msg.fromMe ? "AGENTE" : contactName.toUpperCase();
          const content = msg.content || `[${msg.messageType || "mídia"}]`;
          return `[${time}] ${sender}: ${content}`;
        })
        .join("\n");

      // ─── NEW: Get custom training instructions ───
      const trainingConfig = await getAiTrainingConfig(tenantId, "analysis");
      const customInstructions = trainingConfig?.instructions || "";

      // Build the analysis prompt with full context
      const systemPrompt = `Você é um especialista em análise de atendimento ao cliente para agências de turismo. 
Analise a conversa WhatsApp abaixo entre um AGENTE (vendedor) e um CONTATO (cliente potencial).
Você também receberá o HISTÓRICO COMPLETO da negociação (movimentações de etapa, alterações de campos, etc.) e as TAREFAS associadas.

Avalie os seguintes critérios de 0 a 100:
1. **Tom e Empatia** (toneScore): O agente foi cordial, empático e profissional?
2. **Responsividade** (responsivenessScore): O agente respondeu rapidamente? Houve longos períodos sem resposta?
3. **Clareza** (clarityScore): As informações foram claras, completas e bem organizadas?
4. **Fechamento** (closingScore): O agente conduziu bem a negociação para o fechamento? Usou técnicas de venda?

Forneça também:
- Um resumo geral do atendimento (2-3 frases) considerando TODO o contexto (mensagens + histórico + tarefas)
- Lista de pontos fortes (máximo 5)
- Lista de pontos de melhoria (máximo 5)
- Lista de sugestões acionáveis e específicas (máximo 5)
- Lista de oportunidades perdidas durante a conversa (máximo 3)
- Tempo médio estimado de resposta do agente

IMPORTANTE: 
- Responda EXCLUSIVAMENTE em português brasileiro
- Seja específico e prático nas sugestões
- Considere o histórico de movimentações para entender o ciclo de vida da negociação
- Considere as tarefas para avaliar se o acompanhamento está adequado
${customInstructions ? `\n--- INSTRUÇÕES PERSONALIZADAS DO GESTOR ---\n${customInstructions}` : ""}

Responda no formato JSON conforme o schema fornecido.`;

      const userPrompt = `## Informações da Negociação
- **Título**: ${deal.title}
- **Valor**: R$ ${deal.valueCents ? (Number(deal.valueCents) / 100).toLocaleString("pt-BR") : "não informado"}
- **Status**: ${deal.status}
- **Contato**: ${contactName}

## Histórico de Movimentações (${historyEntries.length} eventos)
${historyContext}

## Tarefas da Negociação (${tasksResult.tasks.length} tarefas)
${tasksContext}

## Conversa WhatsApp (${messages.length} mensagens)
${formattedMessages}`;

      try {
        const aiResult = await callTenantAi({
          tenantId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          maxTokens: 1200,
          responseFormat: {
            type: "json_schema",
            json_schema: {
              name: "conversation_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  overallScore: { type: "integer", description: "Nota geral de 0 a 100" },
                  toneScore: { type: "integer", description: "Nota de tom e empatia de 0 a 100" },
                  responsivenessScore: { type: "integer", description: "Nota de responsividade de 0 a 100" },
                  clarityScore: { type: "integer", description: "Nota de clareza de 0 a 100" },
                  closingScore: { type: "integer", description: "Nota de fechamento de 0 a 100" },
                  summary: { type: "string", description: "Resumo geral do atendimento em 2-3 frases" },
                  strengths: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de pontos fortes (máximo 5)",
                  },
                  improvements: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de pontos de melhoria (máximo 5)",
                  },
                  suggestions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de sugestões acionáveis (máximo 5)",
                  },
                  missedOpportunities: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de oportunidades perdidas (máximo 3)",
                  },
                  responseTimeAvg: { type: "string", description: "Tempo médio estimado de resposta do agente" },
                },
                required: [
                  "overallScore", "toneScore", "responsivenessScore", "clarityScore",
                  "closingScore", "summary", "strengths", "improvements", "suggestions",
                  "missedOpportunities", "responseTimeAvg",
                ],
                additionalProperties: false,
              },
            },
          },
        });

        const analysis = JSON.parse(aiResult.content);

        // Save to database
        const saved = await saveAnalysis({
          tenantId,
          dealId: input.dealId,
          contactId: deal.contactId,
          analyzedBy: userId,
          overallScore: analysis.overallScore,
          toneScore: analysis.toneScore,
          responsivenessScore: analysis.responsivenessScore,
          clarityScore: analysis.clarityScore,
          closingScore: analysis.closingScore,
          summary: analysis.summary,
          strengths: analysis.strengths,
          improvements: analysis.improvements,
          suggestions: analysis.suggestions,
          missedOpportunities: analysis.missedOpportunities,
          responseTimeAvg: analysis.responseTimeAvg,
          messagesAnalyzed: messages.length,
          rawAnalysis: aiResult.content,
        });

        // Fetch the saved record to return
        const result = await getLatestAnalysis(tenantId, input.dealId);
        return { cached: false, analysis: result, provider: aiResult.provider, model: aiResult.model };
      } catch (error: any) {
        console.error("[AI Analysis] Error:", error.message);
        if (error.message === "NO_AI_CONFIGURED") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Nenhum provedor de IA configurado. Acesse Integrações > IA para configurar.",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao analisar conversa: ${error.message}`,
        });
      }
    }),
});
