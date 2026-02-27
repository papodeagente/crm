import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import {
  getLatestAnalysis,
  getAnalysisHistory,
  saveAnalysis,
  getWhatsAppMessagesByDeal,
  countWhatsAppMessagesByDeal,
  getDealById,
  getContactById,
} from "../crmDb";

export const aiAnalysisRouter = router({
  // Get latest analysis for a deal
  getLatest: protectedProcedure
    .input(z.object({ dealId: z.number() }))
    .query(async ({ ctx, input }) => {
      const tenantId = (ctx.user as any).tenantId ?? 1;
      return getLatestAnalysis(tenantId, input.dealId);
    }),

  // Get analysis history for a deal
  getHistory: protectedProcedure
    .input(z.object({ dealId: z.number() }))
    .query(async ({ ctx, input }) => {
      const tenantId = (ctx.user as any).tenantId ?? 1;
      return getAnalysisHistory(tenantId, input.dealId);
    }),

  // Analyze conversation with AI
  analyze: protectedProcedure
    .input(z.object({
      dealId: z.number(),
      forceNew: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = (ctx.user as any).tenantId ?? 1;
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

      // Get message count (note: params are dealId, tenantId)
      const msgCount = await countWhatsAppMessagesByDeal(input.dealId, tenantId);
      if (msgCount === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma mensagem WhatsApp encontrada para esta negociação. Verifique se o contato possui telefone cadastrado.",
        });
      }

      // Get messages (note: params are dealId, tenantId, opts)
      const result = await getWhatsAppMessagesByDeal(input.dealId, tenantId, { limit: 200 });
      const messages = result.messages || [];

      // Get contact info
      let contactName = "Contato";
      if (result.contact?.name) {
        contactName = result.contact.name;
      } else if (deal.contactId) {
        const contact = await getContactById(tenantId, deal.contactId);
        if (contact) contactName = contact.name;
      }

      // Format messages for LLM (already in chronological order from the query)
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

      // Build the analysis prompt
      const systemPrompt = `Você é um especialista em análise de atendimento ao cliente para agências de turismo. 
Analise a conversa WhatsApp abaixo entre um AGENTE (vendedor) e um CONTATO (cliente potencial).

Avalie os seguintes critérios de 0 a 100:
1. **Tom e Empatia** (toneScore): O agente foi cordial, empático e profissional?
2. **Responsividade** (responsivenessScore): O agente respondeu rapidamente? Houve longos períodos sem resposta?
3. **Clareza** (clarityScore): As informações foram claras, completas e bem organizadas?
4. **Fechamento** (closingScore): O agente conduziu bem a negociação para o fechamento? Usou técnicas de venda?

Forneça também:
- Um resumo geral do atendimento (2-3 frases)
- Lista de pontos fortes (máximo 5)
- Lista de pontos de melhoria (máximo 5)
- Lista de sugestões acionáveis e específicas (máximo 5)
- Lista de oportunidades perdidas durante a conversa (máximo 3)
- Tempo médio estimado de resposta do agente

IMPORTANTE: Responda EXCLUSIVAMENTE em português brasileiro. Seja específico e prático nas sugestões.

Responda no formato JSON conforme o schema fornecido.`;

      const userPrompt = `## Informações da Negociação
- **Título**: ${deal.title}
- **Valor**: R$ ${deal.valueCents ? (Number(deal.valueCents) / 100).toLocaleString("pt-BR") : "não informado"}
- **Status**: ${deal.status}
- **Contato**: ${contactName}

## Conversa WhatsApp (${messages.length} mensagens)

${formattedMessages}`;

      try {
        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
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

        const rawContent = llmResponse.choices?.[0]?.message?.content;
        if (!rawContent) {
          throw new Error("LLM retornou resposta vazia");
        }
        const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

        const analysis = JSON.parse(content);

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
          rawAnalysis: content as string,
        });

        // Fetch the saved record to return
        const result = await getLatestAnalysis(tenantId, input.dealId);
        return { cached: false, analysis: result };
      } catch (error: any) {
        console.error("[AI Analysis] Error:", error.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao analisar conversa: ${error.message}`,
        });
      }
    }),
});
