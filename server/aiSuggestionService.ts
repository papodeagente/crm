/**
 * aiSuggestionService.ts
 * 
 * Serviço isolado e desacoplado de sugestão de resposta com IA.
 * Responsável por:
 * - Buscar histórico completo da conversa do banco
 * - Enriquecer contexto com dados CRM (contato, deal, stage)
 * - Classificar intenção da última mensagem
 * - Gerar sugestão profissional com SPIN Selling implícito
 * - Suportar estilos de resposta (curta, humana, objetiva, consultiva)
 * - Quebrar texto de forma natural para envio em partes
 */

import { getDb, getAiIntegration, getActiveAiIntegration, getAnyActiveAiIntegration, getTenantAiSettings } from "./db";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { waMessages, contacts, deals, pipelineStages, aiSuggestionLogs } from "../drizzle/schema";
import { getConversationByJid } from "./conversationResolver";
import { TRPCError } from "@trpc/server";

// ════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════

export type ResponseStyle = "default" | "shorter" | "human" | "objective" | "consultive";

export interface SuggestionInput {
  tenantId: number;
  sessionId: string;
  remoteJid: string;
  contactName?: string;
  /** Override: specific integration ID */
  integrationId?: number;
  /** Override: specific model */
  overrideModel?: string;
  /** Response style */
  style?: ResponseStyle;
  /** Custom instruction from user */
  customInstruction?: string;
}

export interface SuggestionResult {
  suggestion: string;
  parts: string[];
  provider: string;
  model: string;
  intentClassified: string;
  durationMs: number;
  contextMessageCount: number;
  hasCrmContext: boolean;
}

export interface RefinementInput {
  tenantId: number;
  originalText: string;
  style: ResponseStyle;
  integrationId?: number;
  overrideModel?: string;
}

interface ConversationMessage {
  fromMe: boolean;
  content: string;
  timestamp: Date;
  messageType: string;
}

interface CrmContext {
  contactName?: string;
  contactEmail?: string;
  lifecycleStage?: string;
  stageClassification?: string;
  totalPurchases?: number;
  totalSpentCents?: number;
  activeDeal?: {
    title: string;
    valueCents: number;
    stageName: string;
    status: string;
  };
}

// ════════════════════════════════════════════════════════════
// INTENT CLASSIFICATION
// ════════════════════════════════════════════════════════════

const INTENT_CATEGORIES = [
  "duvida",
  "objecao",
  "pedido_preco",
  "pedido_prazo",
  "interesse",
  "indecisao",
  "retomada",
  "fechamento",
  "saudacao",
  "agradecimento",
  "reclamacao",
  "outro",
] as const;

export type IntentCategory = typeof INTENT_CATEGORIES[number];

/**
 * Classifica a intenção da última mensagem do cliente.
 * Classificação heurística rápida (sem LLM) para uso no prompt.
 */
export function classifyIntent(lastMessage: string): IntentCategory {
  const msg = lastMessage.toLowerCase().trim();

  // Saudação
  if (/^(oi|ol[aá]|bom dia|boa tarde|boa noite|eae|e a[ií]|fala|hey|hello|hi)(\b|$|[,!? ])/.test(msg)) {
    return "saudacao";
  }

  // Agradecimento
  if (/\b(obrigad[oa]|valeu|agradeço|thanks|brigad)\b/.test(msg)) {
    return "agradecimento";
  }

  // Reclamação
  if (/\b(reclam|insatisf|p[eé]ssim|horr[ií]vel|absurd|decep|raiva|revoltad)/.test(msg)) {
    return "reclamacao";
  }

  // Pedido de preço
  if (/\b(preço|preco|valor|quanto|custa|custo|orçamento|orcamento|investimento|tabela|cotação|cotacao)\b/.test(msg)) {
    return "pedido_preco";
  }

  // Pedido de prazo
  if (/\b(prazo|quando|data\b|disponib|vaga|per[ií]odo|checkin|check-in|checkout|check-out|embarque|sa[ií]da)/.test(msg)) {
    return "pedido_prazo";
  }

  // Objeção
  if (/\b(caro|barato|não sei|nao sei|vou pensar|pensar|depois|talvez|complicad|difícil|dificil|não posso|nao posso|sem condição|sem condicao)\b/.test(msg)) {
    return "objecao";
  }

  // Fechamento
  if (/\b(fechar|fechamos|quero|vamos|pode reservar|reservar|confirmar|confirmo|pagar|pagamento|pix|cartão|cartao|boleto)\b/.test(msg)) {
    return "fechamento";
  }

  // Interesse
  if (/\b(interes|gostei|legal|show|bacana|adorei|quero saber|me conta|me fala|pode me|gostaria)/.test(msg)) {
    return "interesse";
  }

  // Indecisão
  if (/(n[aã]o tenho certeza|ainda estou|preciso ver|vou ver|deixa eu|sei l[aá]|hmm|hum\b)/.test(msg)) {
    return "indecisao";
  }

  // Retomada
  if (/\b(voltei|lembra|aquele|sobre aquilo|retomando|continuando|ainda tem|ainda vale)\b/.test(msg)) {
    return "retomada";
  }

  // Dúvida (catch-all para perguntas)
  if (/\?|como|onde|qual|quais|pode|tem|existe|funciona|inclui|incluso/.test(msg)) {
    return "duvida";
  }

  return "outro";
}

// ════════════════════════════════════════════════════════════
// CONTEXT BUILDING
// ════════════════════════════════════════════════════════════

/**
 * Busca mensagens da conversa diretamente do banco de dados.
 * Retorna em ordem cronológica (mais antigas primeiro).
 */
async function fetchConversationMessages(
  sessionId: string,
  remoteJid: string,
  maxMessages = 80,
): Promise<ConversationMessage[]> {
  const db = await getDb();
  if (!db) return [];

  // Import phone utils for JID normalization
  const { getAllJidVariants } = await import("./phoneUtils");
  const jidVariants = getAllJidVariants(remoteJid);

  const jidCondition = jidVariants.length === 1
    ? eq(waMessages.remoteJid, jidVariants[0])
    : sql`${waMessages.remoteJid} IN (${sql.join(jidVariants.map(j => sql`${j}`), sql`, `)})`;

  const rows = await db
    .select({
      fromMe: waMessages.fromMe,
      content: waMessages.content,
      timestamp: waMessages.timestamp,
      messageType: waMessages.messageType,
    })
    .from(waMessages)
    .where(and(
      eq(waMessages.sessionId, sessionId),
      jidCondition,
    ))
    .orderBy(desc(waMessages.timestamp))
    .limit(maxMessages);

  // Reverse to get chronological order (oldest first)
  return rows.reverse().map(r => ({
    fromMe: r.fromMe,
    content: r.content || "",
    timestamp: r.timestamp,
    messageType: r.messageType,
  }));
}

/**
 * Busca dados CRM do contato vinculado à conversa.
 */
async function fetchCrmContext(
  tenantId: number,
  sessionId: string,
  remoteJid: string,
): Promise<CrmContext> {
  const db = await getDb();
  if (!db) return {};

  try {
    // Find conversation and linked contact
    const conv = await getConversationByJid(tenantId, sessionId, remoteJid);
    if (!conv?.contactId) return {};

    // Fetch contact
    const [contact] = await db.select({
      name: contacts.name,
      email: contacts.email,
      lifecycleStage: contacts.lifecycleStage,
      stageClassification: contacts.stageClassification,
      totalPurchases: contacts.totalPurchases,
      totalSpentCents: contacts.totalSpentCents,
    })
      .from(contacts)
      .where(and(eq(contacts.id, conv.contactId), eq(contacts.tenantId, tenantId)))
      .limit(1);

    if (!contact) return {};

    const ctx: CrmContext = {
      contactName: contact.name,
      contactEmail: contact.email || undefined,
      lifecycleStage: contact.lifecycleStage,
      stageClassification: contact.stageClassification,
      totalPurchases: contact.totalPurchases,
      totalSpentCents: contact.totalSpentCents,
    };

    // Fetch most recent open deal for this contact
    const [deal] = await db.select({
      title: deals.title,
      valueCents: deals.valueCents,
      stageId: deals.stageId,
      status: deals.status,
    })
      .from(deals)
      .where(and(
        eq(deals.tenantId, tenantId),
        eq(deals.contactId, conv.contactId),
        eq(deals.status, "open"),
        isNull(deals.deletedAt),
      ))
      .orderBy(desc(deals.updatedAt))
      .limit(1);

    if (deal) {
      // Fetch stage name
      let stageName = "N/A";
      const [stage] = await db.select({ name: pipelineStages.name })
        .from(pipelineStages)
        .where(eq(pipelineStages.id, deal.stageId))
        .limit(1);
      if (stage) stageName = stage.name;

      ctx.activeDeal = {
        title: deal.title,
        valueCents: deal.valueCents || 0,
        stageName,
        status: deal.status,
      };
    }

    return ctx;
  } catch (err) {
    console.warn("[AiSuggestion] Failed to fetch CRM context:", err);
    return {};
  }
}

/**
 * Monta o contexto estruturado da conversa para o prompt.
 * Estratégia:
 * - Últimas 40 mensagens: completas com timestamps
 * - Mensagens anteriores (41-80): resumidas em bloco
 */
function buildStructuredContext(
  messages: ConversationMessage[],
  contactName: string,
  crmContext: CrmContext,
): string {
  if (messages.length === 0) return "Nenhuma mensagem na conversa.";

  const RECENT_THRESHOLD = 40;
  const recentMessages = messages.slice(-RECENT_THRESHOLD);
  const olderMessages = messages.slice(0, Math.max(0, messages.length - RECENT_THRESHOLD));

  let context = "";

  // Summarize older messages if they exist
  if (olderMessages.length > 0) {
    const agentMsgs = olderMessages.filter(m => m.fromMe).length;
    const clientMsgs = olderMessages.filter(m => !m.fromMe).length;
    const topics = extractTopics(olderMessages);
    context += `[Resumo das ${olderMessages.length} mensagens anteriores: ${clientMsgs} do cliente, ${agentMsgs} do agente. Tópicos abordados: ${topics}]\n\n`;
  }

  // Recent messages with timestamps
  context += "--- Conversa recente ---\n";
  for (const msg of recentMessages) {
    if (!msg.content) continue;
    const sender = msg.fromMe ? "Agente" : contactName;
    const time = formatTimestamp(msg.timestamp);
    const contentLabel = msg.messageType !== "text" && msg.messageType !== "extendedTextMessage"
      ? `[${msg.messageType}] ${msg.content}`
      : msg.content;
    context += `[${time}] ${sender}: ${contentLabel}\n`;
  }

  // Highlight last client message
  const lastClientMsg = [...messages].reverse().find(m => !m.fromMe && m.content);
  if (lastClientMsg) {
    context += `\n>>> ÚLTIMA MENSAGEM DO CLIENTE: "${lastClientMsg.content}" <<<\n`;
  }

  // CRM context
  if (crmContext.activeDeal || crmContext.lifecycleStage) {
    context += "\n--- Contexto CRM ---\n";
    if (crmContext.lifecycleStage) {
      context += `Estágio do contato: ${crmContext.lifecycleStage}\n`;
    }
    if (crmContext.stageClassification) {
      context += `Classificação: ${crmContext.stageClassification}\n`;
    }
    if (crmContext.totalPurchases && crmContext.totalPurchases > 0) {
      context += `Compras anteriores: ${crmContext.totalPurchases} (total: R$ ${((crmContext.totalSpentCents || 0) / 100).toFixed(2)})\n`;
    }
    if (crmContext.activeDeal) {
      const d = crmContext.activeDeal;
      context += `Negócio ativo: "${d.title}" - R$ ${(d.valueCents / 100).toFixed(2)} - Etapa: ${d.stageName}\n`;
    }
  }

  return context;
}

/**
 * Extrai tópicos principais de um conjunto de mensagens.
 */
function extractTopics(messages: ConversationMessage[]): string {
  const keywords = new Set<string>();
  const topicPatterns = [
    { pattern: /\b(pacote|viagem|destino|hotel|voo|passagem|resort|cruzeiro)\b/i, topic: "viagem/pacote" },
    { pattern: /\b(preço|valor|orçamento|custo|pagamento|parcela)\b/i, topic: "valores" },
    { pattern: /\b(data|período|quando|checkin|checkout|embarque)\b/i, topic: "datas" },
    { pattern: /\b(documento|passaporte|visto|seguro)\b/i, topic: "documentação" },
    { pattern: /\b(transfer|traslado|passeio|excursão)\b/i, topic: "serviços" },
    { pattern: /\b(família|casal|lua de mel|aniversário|grupo)\b/i, topic: "ocasião" },
  ];

  for (const msg of messages) {
    if (!msg.content) continue;
    for (const { pattern, topic } of topicPatterns) {
      if (pattern.test(msg.content)) keywords.add(topic);
    }
  }

  return keywords.size > 0 ? Array.from(keywords).join(", ") : "conversa geral";
}

function formatTimestamp(ts: Date): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  } catch {
    return "";
  }
}

// ════════════════════════════════════════════════════════════
// PROMPT BUILDING (SPIN Selling Framework)
// ════════════════════════════════════════════════════════════

const STYLE_INSTRUCTIONS: Record<ResponseStyle, string> = {
  default: "Equilibre naturalidade, clareza e próximo passo objetivo.",
  shorter: "Seja MUITO breve. Máximo 1-2 frases curtas. Vá direto ao ponto.",
  human: "Seja extremamente natural e informal. Use gírias leves, emojis moderados. Como se fosse um amigo ajudando.",
  objective: "Seja direto e profissional. Sem rodeios. Foque em informação e próximo passo concreto.",
  consultive: "Use abordagem consultiva. Faça perguntas estratégicas para entender melhor a necessidade antes de oferecer soluções.",
};

function buildSystemPrompt(
  contactName: string,
  intent: IntentCategory,
  style: ResponseStyle,
  customInstruction?: string,
): string {
  const styleInstr = STYLE_INSTRUCTIONS[style];

  return `Você é um assistente que ajuda o AGENTE (vendedor) de uma agência de viagens a responder mensagens no WhatsApp.

CONTEXTO:
- "Agente" é o vendedor da agência. Você está escrevendo a resposta que o AGENTE vai enviar.
- "${contactName}" é o cliente que está conversando com o agente.
- Você deve sugerir o que o AGENTE deve responder ao cliente.

FRAMEWORK DE RACIOCÍNIO (use internamente, NÃO exponha no texto):
1. SITUAÇÃO: Analise o contexto completo da conversa. O que já foi discutido? Em que ponto estamos?
2. PROBLEMA: Qual é a necessidade ou dor do cliente? O que ele busca resolver?
3. IMPLICAÇÃO: Se o cliente não resolver isso agora, o que pode acontecer? (use sutilmente)
4. NECESSIDADE-SOLUÇÃO: Como o agente pode ajudar? Qual o próximo passo natural?

INTENÇÃO DETECTADA NA ÚLTIMA MENSAGEM: ${intent}
${intent === "duvida" ? "→ Responda a dúvida de forma clara e ofereça mais informações." : ""}
${intent === "objecao" ? "→ Acolha a objeção, reformule o valor e sugira alternativa." : ""}
${intent === "pedido_preco" ? "→ Se tiver info de valor no CRM, referencie. Senão, pergunte detalhes para montar proposta." : ""}
${intent === "pedido_prazo" ? "→ Responda sobre disponibilidade/datas e sugira próximo passo." : ""}
${intent === "interesse" ? "→ Aproveite o interesse! Aprofunde e direcione para proposta." : ""}
${intent === "indecisao" ? "→ Reduza a incerteza com informação concreta e prova social sutil." : ""}
${intent === "retomada" ? "→ Retome com contexto do que foi discutido antes e atualize." : ""}
${intent === "fechamento" ? "→ Facilite o fechamento! Confirme detalhes e oriente próximos passos." : ""}
${intent === "saudacao" ? "→ Cumprimente e pergunte como pode ajudar." : ""}
${intent === "agradecimento" ? "→ Agradeça de volta e ofereça ajuda adicional." : ""}
${intent === "reclamacao" ? "→ Acolha, peça desculpas se necessário, e ofereça solução." : ""}

ESTILO: ${styleInstr}
${customInstruction ? `INSTRUÇÃO ADICIONAL DO USUÁRIO: ${customInstruction}` : ""}

REGRAS OBRIGATÓRIAS:
1. Analise TODA a conversa para entender o contexto. Foque na ÚLTIMA MENSAGEM DO CLIENTE.
2. A resposta é o que o AGENTE vai enviar. Você NÃO é o cliente.
3. A resposta deve soar 100% humana, natural, como digitada por uma pessoa real no WhatsApp.
4. NUNCA use travessão (—), asteriscos, bullet points ou formatação markdown. Apenas texto corrido.
5. Use português brasileiro informal mas profissional.
6. NÃO invente informações que não existem na conversa ou no CRM.
7. Responda APENAS com JSON válido: {"parts": ["mensagem 1", "mensagem 2"]}
8. Cada "part" é uma mensagem separada. Use 1 a 3 partes curtas (1-2 frases cada).
9. Não inclua explicações fora do JSON.
10. Se houver dados CRM, use-os naturalmente sem parecer robótico.`;
}

function buildUserPrompt(
  contactName: string,
  conversationContext: string,
): string {
  return `${conversationContext}

O que o AGENTE deve responder ao cliente agora?
Lembre-se: você está escrevendo A RESPOSTA DO AGENTE, não do cliente.
Responda APENAS em JSON: {"parts": ["msg1", "msg2"]}`;
}

// ════════════════════════════════════════════════════════════
// AI PROVIDER CALLS
// ════════════════════════════════════════════════════════════

async function callAiProvider(
  integration: { provider: string; apiKey: string },
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  if (integration.provider === "openai") {
    return callOpenAI(integration.apiKey, model, systemPrompt, userPrompt);
  } else {
    return callAnthropic(integration.apiKey, model, systemPrompt, userPrompt);
  }
}

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
  const systemRole = isReasoningModel ? "developer" : "system";
  const tokenParam = isReasoningModel ? { max_completion_tokens: 600 } : { max_tokens: 600 };
  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      { role: systemRole, content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    ...tokenParam,
  };
  if (isReasoningModel) {
    requestBody.reasoning_effort = "low";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: body?.error?.message || `OpenAI error: ${res.status}`,
      });
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new TRPCError({
        code: "TIMEOUT",
        message: `O modelo ${model} demorou demais. Tente um modelo mais rápido como gpt-4.1-mini.`,
      });
    }
    if (err instanceof TRPCError) throw err;
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message || "OpenAI call failed" });
  }
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: 600,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: body?.error?.message || `Anthropic error: ${res.status}`,
      });
    }

    const data = await res.json();
    return data.content?.[0]?.text || "";
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new TRPCError({
        code: "TIMEOUT",
        message: `O modelo ${model} demorou demais. Tente um modelo mais rápido.`,
      });
    }
    if (err instanceof TRPCError) throw err;
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message || "Anthropic call failed" });
  }
}

// ════════════════════════════════════════════════════════════
// RESPONSE PARSING
// ════════════════════════════════════════════════════════════

/**
 * Parse AI response into parts. Handles JSON or plain text fallback.
 * Removes em-dashes, en-dashes, and bullet points.
 */
export function parseAiResponse(raw: string): { full: string; parts: string[] } {
  const cleaned = raw.replace(/[\u2014\u2013]/g, ",").replace(/^\s*[-\*]\s+/gm, "");
  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.parts) && parsed.parts.length > 0) {
        const parts = parsed.parts
          .map((p: string) => p.replace(/[\u2014\u2013]/g, ",").trim())
          .filter(Boolean);
        return { full: parts.join("\n\n"), parts };
      }
    }
  } catch {}
  // Fallback: split by double newline
  const lines = cleaned.split(/\n\n+/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    return { full: lines.join("\n\n"), parts: lines };
  }
  return { full: cleaned.trim(), parts: [cleaned.trim()] };
}

// ════════════════════════════════════════════════════════════
// TEXT SPLITTING (for broken sending)
// ════════════════════════════════════════════════════════════

/**
 * Divide texto de forma natural para envio em partes.
 * Prioriza: parágrafos > frases completas > blocos curtos.
 * Nunca corta palavras.
 */
export function splitTextNaturally(text: string): string[] {
  // First try splitting by double newline (paragraphs)
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length > 1) {
    return paragraphs;
  }

  // Single paragraph: split by sentences
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g);
  if (sentences && sentences.length > 1) {
    // Group sentences into chunks of ~100 chars
    const chunks: string[] = [];
    let current = "";
    for (const sentence of sentences) {
      if (current.length + sentence.length > 120 && current.length > 0) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 1 ? chunks : [text.trim()];
  }

  // If text has question marks, split by questions
  if (text.includes("?")) {
    const parts = text.split(/(?<=\?)\s+/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }

  // Fallback: return as single message
  return [text.trim()];
}

// ════════════════════════════════════════════════════════════
// MAIN FUNCTIONS
// ════════════════════════════════════════════════════════════

/**
 * Gera sugestão de resposta com contexto completo do banco.
 * Este é o ponto de entrada principal do serviço.
 */
export async function generateSuggestion(input: SuggestionInput): Promise<SuggestionResult> {
  const startTime = Date.now();

  // 1. Resolve AI integration
  let integration: any = null;
  if (input.integrationId) {
    integration = await getAiIntegration(input.tenantId, input.integrationId);
  }
  if (!integration) {
    integration = await getAnyActiveAiIntegration(input.tenantId);
  }
  if (!integration) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "NO_AI_CONFIGURED" });
  }

  const settings = await getTenantAiSettings(input.tenantId);
  const model = input.overrideModel || settings.defaultAiModel || integration.defaultModel;

  // 2. Fetch conversation messages from database
  const messages = await fetchConversationMessages(input.sessionId, input.remoteJid, 80);
  if (messages.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Sem mensagens na conversa para analisar." });
  }

  // 3. Fetch CRM context
  const crmContext = await fetchCrmContext(input.tenantId, input.sessionId, input.remoteJid);
  const contactName = input.contactName || crmContext.contactName || "Cliente";

  // 4. Classify intent of last client message
  const lastClientMsg = [...messages].reverse().find(m => !m.fromMe && m.content);
  const intent = lastClientMsg ? classifyIntent(lastClientMsg.content) : "outro";

  // 5. Build structured context
  const conversationContext = buildStructuredContext(messages, contactName, crmContext);

  // 6. Build prompts
  const style = input.style || "default";
  const systemPrompt = buildSystemPrompt(contactName, intent, style, input.customInstruction);
  const userPrompt = buildUserPrompt(contactName, conversationContext);

  // 7. Call AI provider
  console.log(`[AiSuggestion] Generating: tenant=${input.tenantId}, provider=${integration.provider}, model=${model}, intent=${intent}, msgs=${messages.length}, style=${style}`);
  const rawResponse = await callAiProvider(integration, model, systemPrompt, userPrompt);

  // 8. Parse response
  const parsed = parseAiResponse(rawResponse);
  const durationMs = Date.now() - startTime;

  console.log(`[AiSuggestion] Done: ${durationMs}ms, parts=${parsed.parts.length}, intent=${intent}`);

  // Log telemetry (fire-and-forget)
  logSuggestionTelemetry({
    tenantId: input.tenantId,
    provider: integration.provider,
    model,
    intentClassified: intent,
    style,
    durationMs,
    contextMessageCount: messages.length,
    hasCrmContext: !!(crmContext.activeDeal || crmContext.lifecycleStage),
    success: true,
    partsCount: parsed.parts.length,
  }).catch(() => {});

  return {
    suggestion: parsed.full,
    parts: parsed.parts,
    provider: integration.provider,
    model,
    intentClassified: intent,
    durationMs,
    contextMessageCount: messages.length,
    hasCrmContext: !!(crmContext.activeDeal || crmContext.lifecycleStage),
  };
}

/**
 * Refina uma sugestão existente com um estilo diferente.
 */
export async function refineSuggestion(input: RefinementInput): Promise<{ suggestion: string; parts: string[]; provider: string; model: string }> {
  // Resolve integration
  let integration: any = null;
  if (input.integrationId) {
    integration = await getAiIntegration(input.tenantId, input.integrationId);
  }
  if (!integration) {
    integration = await getAnyActiveAiIntegration(input.tenantId);
  }
  if (!integration) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "NO_AI_CONFIGURED" });
  }

  const settings = await getTenantAiSettings(input.tenantId);
  const model = input.overrideModel || settings.defaultAiModel || integration.defaultModel;

  const styleInstr = STYLE_INSTRUCTIONS[input.style];

  const systemPrompt = `Você é um assistente que reescreve mensagens de WhatsApp para agentes de viagens.
Reescreva a mensagem abaixo com o seguinte estilo: ${styleInstr}

REGRAS:
1. Mantenha o mesmo sentido e informações da mensagem original.
2. A resposta deve soar 100% humana e natural.
3. NUNCA use travessão (—), asteriscos, bullet points ou formatação markdown.
4. Use português brasileiro informal mas profissional.
5. Responda APENAS com JSON: {"parts": ["mensagem 1", "mensagem 2"]}
6. Use 1 a 3 partes curtas.`;

  const userPrompt = `Mensagem original:\n"${input.originalText}"\n\nReescreva no estilo "${input.style}". Responda APENAS em JSON: {"parts": ["msg1"]}`;

  const rawResponse = await callAiProvider(integration, model, systemPrompt, userPrompt);
  const parsed = parseAiResponse(rawResponse);

  return {
    suggestion: parsed.full,
    parts: parsed.parts,
    provider: integration.provider,
    model,
  };
}

// ════════════════════════════════════════════════════════════
// TELEMETRY
// ════════════════════════════════════════════════════════════

interface TelemetryData {
  tenantId: number;
  userId?: number;
  provider: string;
  model: string;
  intentClassified?: string;
  style?: string;
  durationMs?: number;
  contextMessageCount?: number;
  hasCrmContext?: boolean;
  success: boolean;
  errorMessage?: string;
  wasEdited?: boolean;
  wasSent?: boolean;
  sendMethod?: string;
  partsCount?: number;
}

/**
 * Log AI suggestion telemetry to the database.
 * Fire-and-forget: errors are silently caught.
 */
export async function logSuggestionTelemetry(data: TelemetryData): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(aiSuggestionLogs).values({
      tenantId: data.tenantId,
      userId: data.userId,
      provider: data.provider,
      model: data.model,
      intentClassified: data.intentClassified,
      style: data.style || "default",
      durationMs: data.durationMs,
      contextMessageCount: data.contextMessageCount,
      hasCrmContext: data.hasCrmContext ?? false,
      success: data.success,
      errorMessage: data.errorMessage,
      wasEdited: data.wasEdited,
      wasSent: data.wasSent,
      sendMethod: data.sendMethod,
      partsCount: data.partsCount,
    });
  } catch (err) {
    console.warn("[AiSuggestion] Telemetry log failed:", err);
  }
}
