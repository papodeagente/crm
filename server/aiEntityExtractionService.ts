/**
 * aiEntityExtractionService.ts
 *
 * Fase 1 — Extração de entidades de viagem da conversa WhatsApp.
 * Converte conversas livres em campos estruturados (destino, datas, passageiros,
 * orçamento, ocasião, preferências) que o agente revisa no painel "Dados detectados"
 * e aceita/dispensa. Aceitar popula custom field quando existe um mapeado.
 *
 * Persistência em `deal_extracted_entities` (unique por dealId+fieldKey).
 * Ver `specs/domains/ai-deal-intelligence.spec.md`.
 */

import { sql, eq, and } from "drizzle-orm";
import { callTenantAi, getAiTrainingConfig, getDb } from "./db";
import {
  getDealById,
  getContactById,
  getWhatsAppMessagesByDeal,
} from "./crmDb";

export interface ExtractedEntity {
  fieldKey: string;
  value: string;
  confidence: number;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  provider: string;
  model: string;
  messagesAnalyzed: number;
}

export interface ExtractionInput {
  tenantId: number;
  dealId: number;
  integrationId?: number;
  overrideModel?: string;
  maxMessages?: number;
}

/** Campos padrão que sempre pedimos pra IA tentar extrair. Tenant pode estender via training config. */
const DEFAULT_FIELD_KEYS = [
  "procedimento",
  "area_corpo",
  "objetivo",
  "urgencia",
  "orcamento",
  "agendamento_desejado",
  "contraindicacoes",
  "ja_realizou",
  "preferencias",
] as const;

export async function extractDealEntities(input: ExtractionInput): Promise<ExtractionResult> {
  const { tenantId, dealId } = input;

  const deal = await getDealById(tenantId, dealId);
  if (!deal) throw new Error("DEAL_NOT_FOUND");

  let contactName = "Contato";
  if (deal.contactId) {
    const contact = await getContactById(tenantId, deal.contactId);
    if (contact?.name) contactName = contact.name;
  }

  const maxMessages = input.maxMessages ?? 100;
  const msgResult = await getWhatsAppMessagesByDeal(dealId, tenantId, { limit: maxMessages });
  const messages = msgResult.messages || [];

  if (messages.length === 0) {
    throw new Error("NO_MESSAGES");
  }

  const formattedMessages = messages
    .map((m: any) => {
      const sender = m.fromMe ? "AGENTE" : contactName.toUpperCase();
      const content = m.content || `[${m.messageType || "mídia"}]`;
      return `${sender}: ${content}`;
    })
    .join("\n");

  // Training config para "extraction" é opcional. Em deploys antigos o enum
  // configType pode não ter "extraction" — degrada gracefully sem instruções custom.
  let customInstructions = "";
  try {
    const trainingConfig = await getAiTrainingConfig(tenantId, "extraction" as any);
    customInstructions = trainingConfig?.instructions || "";
  } catch (e: any) {
    console.warn("[entityExtraction] training config indisponível, seguindo sem custom instructions:", e?.message);
  }

  const systemPrompt = `Você extrai dados estruturados de uma conversa WhatsApp entre clínica/consultório e paciente interessado em procedimento estético/clínico.
Extraia APENAS o que foi mencionado explicitamente — NUNCA invente dados.

Campos a procurar (padrão):
- procedimento: procedimento ou tratamento de interesse (ex: "harmonização facial", "botox", "preenchimento labial", "limpeza de pele", "laser", "drenagem")
- area_corpo: região anatômica mencionada (ex: "face", "lábios", "abdômen", "pernas", "rosto inteiro")
- objetivo: motivação/resultado esperado pelo paciente (ex: "rejuvenescer", "reduzir gordura localizada", "tirar manchas", "casamento em 3 meses")
- urgencia: prazo desejado para realizar (ex: "essa semana", "mês que vem", "antes de evento X em DD/MM"). Se houver data específica, use formato YYYY-MM-DD
- orcamento: valor mencionado pelo paciente em reais (apenas número, sem "R$"). Pode ser teto ("até 3000") ou faixa ("entre 1500 e 2500")
- agendamento_desejado: data/horário preferido para a consulta/sessão (formato YYYY-MM-DD ou "manhã/tarde de DD/MM")
- contraindicacoes: condições mencionadas pelo paciente que podem contraindicar — gravidez, amamentação, alergias, uso de medicamento (ex: isotretinoína, anticoagulante), doenças crônicas, cirurgia recente
- ja_realizou: sim/não/qual — se já fez o procedimento antes ou outros similares. Inclua o que foi feito e quando se mencionado
- preferencias: profissional preferido, turno (manhã/tarde/noite), forma de pagamento, particularidades (ex: "só anestesia local", "sem agulha")

Para cada campo extraído, atribua uma confiança (0-100):
- 90+: paciente afirmou de forma explícita ("quero fazer botox na testa")
- 50-89: mencionado mas sem certeza ("estou pensando em harmonização")
- 0-49: inferência indireta (melhor dispensar)

Responda EXCLUSIVAMENTE com JSON válido no formato:
{
  "entities": [
    { "fieldKey": "procedimento", "value": "Harmonização facial", "confidence": 95 },
    { "fieldKey": "agendamento_desejado", "value": "2026-05-10", "confidence": 80 }
  ]
}

Regras:
- Não incluir campos que não foram mencionados
- Confiança < 40 não inclui no resultado
- Datas sempre em ISO quando houver dia exato
- Em "contraindicacoes", se o paciente mencionar várias, separe por vírgula
${customInstructions ? `\n--- INSTRUÇÕES DO GESTOR ---\n${customInstructions}` : ""}`;

  const userPrompt = `## Conversa (${messages.length} mensagens)
${formattedMessages}`;

  const aiResult = await callTenantAi({
    tenantId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 800,
    integrationId: input.integrationId,
    overrideModel: input.overrideModel,
  });

  const entities = parseEntities(aiResult.content);

  await persistEntities(tenantId, dealId, entities);

  return {
    entities,
    provider: aiResult.provider,
    model: aiResult.model,
    messagesAnalyzed: messages.length,
  };
}

function parseEntities(raw: string): ExtractedEntity[] {
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1]!.trim();
  else {
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return [];
  }

  const arr = Array.isArray(parsed?.entities) ? parsed.entities : [];
  const result: ExtractedEntity[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const fieldKey = typeof item.fieldKey === "string" ? item.fieldKey.trim() : "";
    const value = item.value == null ? "" : String(item.value).trim();
    const confidence = Number(item.confidence) || 0;
    if (!fieldKey || !value || confidence < 40) continue;
    result.push({ fieldKey, value, confidence: Math.max(0, Math.min(100, confidence)) });
  }
  return result;
}

async function persistEntities(tenantId: number, dealId: number, entities: ExtractedEntity[]): Promise<void> {
  if (entities.length === 0) return;
  const db = await getDb();
  if (!db) return;

  // Upsert por (dealId, fieldKey) — mantém acceptedByUserId/acceptedAt se já houve aceite
  for (const e of entities) {
    await db.execute(sql`
      INSERT INTO "deal_extracted_entities" ("tenantId", "dealId", "fieldKey", "value", "confidence", "source")
      VALUES (${tenantId}, ${dealId}, ${e.fieldKey}, ${e.value}, ${e.confidence}, 'whatsapp')
      ON CONFLICT ("dealId", "fieldKey")
      DO UPDATE SET
        "value" = EXCLUDED."value",
        "confidence" = EXCLUDED."confidence",
        "updatedAt" = NOW(),
        "dismissedAt" = NULL
    `).catch((err: any) => {
      console.warn(`[aiEntityExtraction] upsert failed for ${e.fieldKey}:`, err?.message);
    });
  }
}

export async function listExtractedEntities(tenantId: number, dealId: number): Promise<Array<ExtractedEntity & {
  id: number;
  acceptedByUserId: number | null;
  acceptedAt: Date | null;
  dismissedAt: Date | null;
  updatedAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT "id", "fieldKey", "value", "confidence", "acceptedByUserId", "acceptedAt", "dismissedAt", "updatedAt"
    FROM "deal_extracted_entities"
    WHERE "tenantId" = ${tenantId} AND "dealId" = ${dealId}
    ORDER BY "confidence" DESC, "updatedAt" DESC
  `);
  return (rows as any).rows?.map((r: any) => ({
    id: Number(r.id),
    fieldKey: r.fieldKey,
    value: r.value,
    confidence: Number(r.confidence) || 0,
    acceptedByUserId: r.acceptedByUserId ? Number(r.acceptedByUserId) : null,
    acceptedAt: r.acceptedAt ? new Date(r.acceptedAt) : null,
    dismissedAt: r.dismissedAt ? new Date(r.dismissedAt) : null,
    updatedAt: new Date(r.updatedAt),
  })) ?? [];
}

export async function acceptExtractedEntity(params: {
  tenantId: number;
  dealId: number;
  entityId: number;
  userId: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    UPDATE "deal_extracted_entities"
    SET "acceptedByUserId" = ${params.userId}, "acceptedAt" = NOW(), "dismissedAt" = NULL
    WHERE "id" = ${params.entityId} AND "tenantId" = ${params.tenantId} AND "dealId" = ${params.dealId}
  `);
}

export async function dismissExtractedEntity(params: {
  tenantId: number;
  dealId: number;
  entityId: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    UPDATE "deal_extracted_entities"
    SET "dismissedAt" = NOW(), "acceptedByUserId" = NULL, "acceptedAt" = NULL
    WHERE "id" = ${params.entityId} AND "tenantId" = ${params.tenantId} AND "dealId" = ${params.dealId}
  `);
}
