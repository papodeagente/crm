/**
 * Seed Default Loss Reasons — Inserts 15 standard loss reasons for a tenant.
 * Idempotent: skips reasons that already exist (matched by tenantId + name).
 * All records are normal, editable, deletable — no special flags.
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { lossReasons } from "../drizzle/schema";

export interface DefaultLossReason {
  name: string;
  description: string;
}

export const DEFAULT_LOSS_REASONS: DefaultLossReason[] = [
  {
    name: "Orçamento incompatível",
    description: "O valor da viagem ficou acima do que o cliente estava disposto ou podia investir.",
  },
  {
    name: "Prioridade adiada",
    description: "O cliente decidiu postergar a compra porque a viagem não era prioridade naquele momento.",
  },
  {
    name: "Data inviável",
    description: "As datas desejadas não funcionavam para o cliente, acompanhantes ou operação da viagem.",
  },
  {
    name: "Proposta sem aderência",
    description: "A solução apresentada não se encaixou no perfil, expectativa ou objetivo da viagem.",
  },
  {
    name: "Indecisão do viajante",
    description: "O cliente não conseguiu avançar por insegurança, falta de definição ou excesso de dúvidas.",
  },
  {
    name: "Condição comercial não aceita",
    description: "O cliente não aprovou condições de pagamento, entrada, parcelamento ou regras comerciais.",
  },
  {
    name: "Disponibilidade indisponível",
    description: "Não havia disponibilidade de voo, hotel, serviço, bloqueio ou tarifa no momento da decisão.",
  },
  {
    name: "Compra por outro canal",
    description: "O cliente optou por fechar com concorrente, fornecedor direto, site ou outro canal.",
  },
  {
    name: "Grupo sem consenso",
    description: "A decisão dependia de outras pessoas e o grupo ou família não chegou a um acordo.",
  },
  {
    name: "Exigência documental",
    description: "A negociação travou por visto, passaporte, vacinas, documentação ou exigências do destino.",
  },
  {
    name: "Mudança de plano de viagem",
    description: "O cliente alterou destino, formato ou contexto da viagem e a negociação perdeu sentido.",
  },
  {
    name: "Atendimento abandonado",
    description: "O cliente iniciou o processo, mas deixou de responder ou interrompeu o avanço.",
  },
  {
    name: "Lead sem maturidade de compra",
    description: "O contato tinha interesse inicial, mas ainda não estava pronto para comprar.",
  },
  {
    name: "Rentabilidade inviável",
    description: "A venda exigia condições que tornavam a operação financeiramente ruim para a agência.",
  },
  {
    name: "Cadastro ou negociação inválida",
    description: "Registro gerado por teste, erro operacional, duplicidade ou informação sem validade comercial.",
  },
];

/**
 * Seeds default loss reasons for a given tenant.
 * Idempotent: only inserts reasons whose name doesn't already exist for the tenant.
 * Returns the count of newly inserted reasons.
 */
export async function seedDefaultLossReasons(tenantId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Fetch existing reason names for this tenant (including deleted ones to avoid re-creating)
  const existing = await db
    .select({ name: lossReasons.name })
    .from(lossReasons)
    .where(eq(lossReasons.tenantId, tenantId));

  const existingNames = new Set(existing.map((r) => r.name.toLowerCase().trim()));

  // Filter to only new reasons
  const toInsert = DEFAULT_LOSS_REASONS.filter(
    (r) => !existingNames.has(r.name.toLowerCase().trim())
  );

  if (toInsert.length === 0) return 0;

  // Insert all missing reasons in one batch
  await db.insert(lossReasons).values(
    toInsert.map((r) => ({
      tenantId,
      name: r.name,
      description: r.description,
    }))
  );

  console.log(
    `[SeedLossReasons] Tenant ${tenantId}: inserted ${toInsert.length} default loss reasons (${DEFAULT_LOSS_REASONS.length - toInsert.length} already existed)`
  );

  return toInsert.length;
}
