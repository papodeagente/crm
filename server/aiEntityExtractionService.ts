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
  "destino",
  "data_ida",
  "data_volta",
  "passageiros_adultos",
  "passageiros_criancas",
  "orcamento_max",
  "ocasiao",
  "preferencias",
  "origem",
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

  const systemPrompt = `Você extrai dados estruturados de viagem de uma conversa WhatsApp entre agente e cliente.
Extraia APENAS o que foi mencionado explicitamente — NUNCA invente dados.

Campos a procurar (padrão):
- destino: cidade/país principal mencionado pelo cliente
- origem: cidade de partida
- data_ida: data de embarque (formato YYYY-MM-DD quando possível, ou "Mar/2026")
- data_volta: data de retorno (mesmo formato)
- passageiros_adultos: número de adultos
- passageiros_criancas: número de crianças
- orcamento_max: orçamento em reais mencionado (apenas número, sem "R$")
- ocasiao: lua de mel, aniversário, férias família, formatura, etc.
- preferencias: praia, cidade, aventura, luxo, econômico, all-inclusive, etc. (lista separada por vírgula)

Para cada campo extraído, atribua uma confiança (0-100):
- 90+: cliente afirmou de forma explícita ("vamos dia 15 de março")
- 50-89: mencionado mas sem certeza ("acho que março")
- 0-49: inferência indireta (melhor dispensar)

Responda EXCLUSIVAMENTE com JSON válido no formato:
{
  "entities": [
    { "fieldKey": "destino", "value": "Cancún, México", "confidence": 95 },
    { "fieldKey": "data_ida", "value": "2026-11-15", "confidence": 80 }
  ]
}

Regras:
- Não incluir campos que não foram mencionados
- Confiança < 40 não inclui no resultado
- Datas sempre em ISO quando houver dia exato
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
