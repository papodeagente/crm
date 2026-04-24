/**
 * Classification Engine — Motor de Regras de Classificação Estratégica
 * 
 * 9 Públicos Estratégicos:
 * - desconhecido: Contato sem interação significativa
 * - seguidor: Contato que acompanha mas não entrou no funil
 * - lead: Entrou no funil, etapas 1-2 (Novo atendimento, Atendimento iniciado)
 * - oportunidade: Avançou para etapas 3-7 (Diagnóstico → Reserva)
 * - cliente_primeira_compra: Primeira venda ganha
 * - cliente_ativo: Possui compra e está dentro do ciclo operacional (360 dias)
 * - cliente_recorrente: Total de vendas > 1
 * - ex_cliente: Já comprou mas inativo por 360+ dias
 * - promotor: Indicou pelo menos 1 cliente confirmado
 */

import { getDb } from "./db";
import { contacts, deals, pipelines, pipelineStages, pipelineAutomations } from "../drizzle/schema";
import { eq, and, sql, isNull } from "drizzle-orm";

// ═══════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════

export const STAGE_CLASSIFICATIONS = [
  "desconhecido",
  "seguidor",
  "lead",
  "oportunidade",
  "cliente_primeira_compra",
  "cliente_ativo",
  "cliente_recorrente",
  "ex_cliente",
  "promotor",
] as const;

export type StageClassification = typeof STAGE_CLASSIFICATIONS[number];

// Default inactivity threshold in days (configurable per tenant via settingsJson)
const DEFAULT_INACTIVITY_DAYS = 360;
// Referral window in days
const REFERRAL_WINDOW_DAYS = 90;

// ═══════════════════════════════════════
// SALES PIPELINE STAGES (order matters)
// ═══════════════════════════════════════
export const SALES_PIPELINE_STAGES = [
  { name: "Novo atendimento", orderIndex: 0, probabilityDefault: 5, color: "#3b82f6" },
  { name: "Atendimento iniciado", orderIndex: 1, probabilityDefault: 10, color: "#06b6d4" },
  { name: "Diagnóstico", orderIndex: 2, probabilityDefault: 25, color: "#8b5cf6" },
  { name: "Cotação", orderIndex: 3, probabilityDefault: 40, color: "#f59e0b" },
  { name: "Apresentação", orderIndex: 4, probabilityDefault: 60, color: "#f97316" },
  { name: "Acompanhamento", orderIndex: 5, probabilityDefault: 75, color: "#22c55e" },
  { name: "Reserva", orderIndex: 6, probabilityDefault: 90, color: "#10b981" },
];

export const POST_SALE_PIPELINE_STAGES = [
  { name: "Nova venda", orderIndex: 0, probabilityDefault: 100, color: "#3b82f6" },
  { name: "Agendado", orderIndex: 1, probabilityDefault: 100, color: "#06b6d4" },
  { name: "Confirmado", orderIndex: 2, probabilityDefault: 100, color: "#8b5cf6" },
  { name: "Em atendimento", orderIndex: 3, probabilityDefault: 100, color: "#f59e0b" },
  { name: "Follow-up", orderIndex: 4, probabilityDefault: 100, color: "#22c55e" },
  { name: "Pós atendimento", orderIndex: 5, probabilityDefault: 100, color: "#f97316" },
  { name: "Finalizado", orderIndex: 6, probabilityDefault: 100, color: "#10b981" },
];

// ═══════════════════════════════════════
// SEGMENT-SPECIFIC PIPELINE STAGES
// ═══════════════════════════════════════

const SEGMENT_SALES_STAGES: Record<string, typeof SALES_PIPELINE_STAGES> = {
  estetica: [
    { name: "Consulta inicial", orderIndex: 0, probabilityDefault: 10, color: "#3b82f6" },
    { name: "Avaliação", orderIndex: 1, probabilityDefault: 20, color: "#06b6d4" },
    { name: "Orçamento", orderIndex: 2, probabilityDefault: 40, color: "#8b5cf6" },
    { name: "Negociação", orderIndex: 3, probabilityDefault: 60, color: "#f59e0b" },
    { name: "Agendamento", orderIndex: 4, probabilityDefault: 80, color: "#22c55e" },
    { name: "Fechado", orderIndex: 5, probabilityDefault: 95, color: "#10b981" },
  ],
  odontologia: [
    { name: "Triagem", orderIndex: 0, probabilityDefault: 10, color: "#3b82f6" },
    { name: "Consulta", orderIndex: 1, probabilityDefault: 20, color: "#06b6d4" },
    { name: "Plano de tratamento", orderIndex: 2, probabilityDefault: 35, color: "#8b5cf6" },
    { name: "Orçamento", orderIndex: 3, probabilityDefault: 50, color: "#f59e0b" },
    { name: "Aprovação", orderIndex: 4, probabilityDefault: 75, color: "#f97316" },
    { name: "Agendamento", orderIndex: 5, probabilityDefault: 90, color: "#22c55e" },
  ],
  salao: [
    { name: "Novo contato", orderIndex: 0, probabilityDefault: 15, color: "#3b82f6" },
    { name: "Interesse", orderIndex: 1, probabilityDefault: 30, color: "#06b6d4" },
    { name: "Agendamento", orderIndex: 2, probabilityDefault: 60, color: "#8b5cf6" },
    { name: "Confirmado", orderIndex: 3, probabilityDefault: 85, color: "#22c55e" },
    { name: "Atendido", orderIndex: 4, probabilityDefault: 95, color: "#10b981" },
  ],
  advocacia: [
    { name: "Consulta inicial", orderIndex: 0, probabilityDefault: 10, color: "#3b82f6" },
    { name: "Análise do caso", orderIndex: 1, probabilityDefault: 25, color: "#06b6d4" },
    { name: "Proposta de honorários", orderIndex: 2, probabilityDefault: 45, color: "#8b5cf6" },
    { name: "Negociação", orderIndex: 3, probabilityDefault: 65, color: "#f59e0b" },
    { name: "Contrato assinado", orderIndex: 4, probabilityDefault: 90, color: "#22c55e" },
  ],
  clinica: [
    { name: "Primeiro contato", orderIndex: 0, probabilityDefault: 10, color: "#3b82f6" },
    { name: "Consulta", orderIndex: 1, probabilityDefault: 25, color: "#06b6d4" },
    { name: "Diagnóstico", orderIndex: 2, probabilityDefault: 40, color: "#8b5cf6" },
    { name: "Orçamento", orderIndex: 3, probabilityDefault: 55, color: "#f59e0b" },
    { name: "Aprovação", orderIndex: 4, probabilityDefault: 75, color: "#f97316" },
    { name: "Tratamento", orderIndex: 5, probabilityDefault: 90, color: "#22c55e" },
  ],
};

const SEGMENT_POST_SALE_STAGES: Record<string, typeof POST_SALE_PIPELINE_STAGES> = {
  estetica: [
    { name: "Procedimento agendado", orderIndex: 0, probabilityDefault: 100, color: "#3b82f6" },
    { name: "Em execução", orderIndex: 1, probabilityDefault: 100, color: "#06b6d4" },
    { name: "Pós-procedimento", orderIndex: 2, probabilityDefault: 100, color: "#8b5cf6" },
    { name: "Retorno agendado", orderIndex: 3, probabilityDefault: 100, color: "#f59e0b" },
    { name: "Finalizado", orderIndex: 4, probabilityDefault: 100, color: "#10b981" },
  ],
  odontologia: [
    { name: "Tratamento iniciado", orderIndex: 0, probabilityDefault: 100, color: "#3b82f6" },
    { name: "Em andamento", orderIndex: 1, probabilityDefault: 100, color: "#06b6d4" },
    { name: "Sessão concluída", orderIndex: 2, probabilityDefault: 100, color: "#8b5cf6" },
    { name: "Retorno/Revisão", orderIndex: 3, probabilityDefault: 100, color: "#f59e0b" },
    { name: "Alta", orderIndex: 4, probabilityDefault: 100, color: "#10b981" },
  ],
  salao: [
    { name: "Agendado", orderIndex: 0, probabilityDefault: 100, color: "#3b82f6" },
    { name: "Em atendimento", orderIndex: 1, probabilityDefault: 100, color: "#06b6d4" },
    { name: "Concluído", orderIndex: 2, probabilityDefault: 100, color: "#22c55e" },
    { name: "Reagendamento", orderIndex: 3, probabilityDefault: 100, color: "#10b981" },
  ],
  advocacia: [
    { name: "Caso em andamento", orderIndex: 0, probabilityDefault: 100, color: "#3b82f6" },
    { name: "Diligências", orderIndex: 1, probabilityDefault: 100, color: "#06b6d4" },
    { name: "Audiência", orderIndex: 2, probabilityDefault: 100, color: "#8b5cf6" },
    { name: "Decisão", orderIndex: 3, probabilityDefault: 100, color: "#f59e0b" },
    { name: "Encerrado", orderIndex: 4, probabilityDefault: 100, color: "#10b981" },
  ],
  clinica: [
    { name: "Tratamento iniciado", orderIndex: 0, probabilityDefault: 100, color: "#3b82f6" },
    { name: "Sessões em andamento", orderIndex: 1, probabilityDefault: 100, color: "#06b6d4" },
    { name: "Acompanhamento", orderIndex: 2, probabilityDefault: 100, color: "#8b5cf6" },
    { name: "Retorno", orderIndex: 3, probabilityDefault: 100, color: "#f59e0b" },
    { name: "Alta", orderIndex: 4, probabilityDefault: 100, color: "#10b981" },
  ],
};

// ═══════════════════════════════════════
// TENANT ONBOARDING — Create default pipelines
// ═══════════════════════════════════════

// Segment-specific pipeline names
const SEGMENT_PIPELINE_NAMES: Record<string, { sales: string; postSale: string }> = {
  estetica: { sales: "Funil de Vendas - Estética", postSale: "Pós-Atendimento - Estética" },
  odontologia: { sales: "Funil de Vendas - Odontologia", postSale: "Pós-Atendimento - Odontologia" },
  advocacia: { sales: "Funil de Vendas - Advocacia", postSale: "Pós-Atendimento - Advocacia" },
  salao: { sales: "Funil de Vendas - Salão", postSale: "Pós-Atendimento - Salão" },
  clinica: { sales: "Funil de Vendas - Clínica", postSale: "Pós-Atendimento - Clínica" },
};

export async function createDefaultPipelines(tenantId: number, segment?: string): Promise<{ salesPipelineId: number; postSalePipelineId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  // Check if tenant already has pipelines
  const existing = await db.select({ id: pipelines.id }).from(pipelines).where(eq(pipelines.tenantId, tenantId)).limit(1);
  if (existing.length > 0) {
    // Already has pipelines, skip
    return null;
  }

  // Create Sales Pipeline
  const pipelineNames = segment && SEGMENT_PIPELINE_NAMES[segment] ? SEGMENT_PIPELINE_NAMES[segment] : { sales: "Funil de Vendas", postSale: "Funil de Pós-Venda" };
  const [salesPipeline] = await db.insert(pipelines).values({
    tenantId,
    name: pipelineNames.sales,
    description: "Pipeline principal de vendas com classificação automática de leads e oportunidades",
    color: "#3b82f6",
    pipelineType: "sales",
    isDefault: true,
  }).returning({ id: pipelines.id });

  // Create Sales Pipeline Stages (segment-specific or default)
  const salesStages = (segment && SEGMENT_SALES_STAGES[segment]) || SALES_PIPELINE_STAGES;
  for (const stage of salesStages) {
    await db.insert(pipelineStages).values({
      tenantId,
      pipelineId: salesPipeline.id,
      ...stage,
    });
  }

  // Create Post-Sale Pipeline
  const [postSalePipeline] = await db.insert(pipelines).values({
    tenantId,
    name: pipelineNames.postSale,
    description: "Pipeline de acompanhamento pós-venda com etapas de atendimento",
    color: "#22c55e",
    pipelineType: "post_sale",
    isDefault: false,
  }).returning({ id: pipelines.id });

  // Create Post-Sale Pipeline Stages (segment-specific or default)
  const postSaleStages = (segment && SEGMENT_POST_SALE_STAGES[segment]) || POST_SALE_PIPELINE_STAGES;
  const postSaleStageIds: number[] = [];
  for (const stage of postSaleStages) {
    const [stageResult] = await db.insert(pipelineStages).values({
      tenantId,
      pipelineId: postSalePipeline.id,
      ...stage,
    }).returning({ id: pipelineStages.id });
    postSaleStageIds.push(stageResult.id);
  }

  // Create automation: DealWon in Sales → Create deal in Post-Sale (stage "Nova venda")
  await db.insert(pipelineAutomations).values({
    tenantId,
    name: "Venda Ganha → Pós-Venda",
    sourcePipelineId: salesPipeline.id,
    triggerEvent: "deal_won",
    targetPipelineId: postSalePipeline.id,
    targetStageId: postSaleStageIds[0], // "Nova venda"
    copyProducts: true,
    copyParticipants: true,
    copyCustomFields: true,
    isActive: true,
  });

  return { salesPipelineId: salesPipeline.id, postSalePipelineId: postSalePipeline.id };
}

// ═══════════════════════════════════════
// CLASSIFICATION RULES ENGINE
// ═══════════════════════════════════════

/**
 * Get the stage order index for a deal's current stage within its pipeline
 */
export async function getStageOrderIndex(tenantId: number, stageId: number): Promise<number> {
  const db = await getDb();
  if (!db) return -1;
  const rows = await db.select({ orderIndex: pipelineStages.orderIndex })
    .from(pipelineStages)
    .where(and(eq(pipelineStages.id, stageId), eq(pipelineStages.tenantId, tenantId)))
    .limit(1);
  return rows[0]?.orderIndex ?? -1;
}

/**
 * Check if a pipeline is a sales pipeline
 */
export async function isSalesPipeline(tenantId: number, pipelineId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ pipelineType: pipelines.pipelineType })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.tenantId, tenantId)))
    .limit(1);
  return rows[0]?.pipelineType === "sales";
}

/**
 * Count won deals for a contact
 */
export async function countWonDealsForContact(tenantId: number, contactId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ count: sql<number>`count(*)` })
    .from(deals)
    .where(and(
      eq(deals.tenantId, tenantId),
      eq(deals.contactId, contactId),
      eq(deals.status, "won"),
      isNull(deals.deletedAt),
    ));
  return rows[0]?.count || 0;
}

/**
 * Update contact classification
 */
export async function updateContactClassification(
  tenantId: number,
  contactId: number,
  classification: StageClassification,
  extraFields?: Partial<{
    referralWindowStart: Date | null;
    referralCount: number;
    lastPurchaseAt: Date | null;
    totalPurchases: number;
    totalSpentCents: number;
    lifecycleStage: "lead" | "prospect" | "customer" | "churned";
  }>
) {
  const db = await getDb();
  if (!db) return;
  const updateData: any = { stageClassification: classification };
  if (extraFields) {
    Object.assign(updateData, extraFields);
  }
  await db.update(contacts).set(updateData)
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));
}

/**
 * Get contact's current classification and purchase data
 */
export async function getContactClassificationData(tenantId: number, contactId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({
    id: contacts.id,
    stageClassification: contacts.stageClassification,
    referralWindowStart: contacts.referralWindowStart,
    referralCount: contacts.referralCount,
    lastPurchaseAt: contacts.lastPurchaseAt,
    totalPurchases: contacts.totalPurchases,
    totalSpentCents: contacts.totalSpentCents,
    lifecycleStage: contacts.lifecycleStage,
  }).from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
    .limit(1);
  return rows[0] || null;
}

// ═══════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════

/**
 * Handle DealMoved event — classify contact as Lead or Oportunidade
 * Stages 0-1 (Novo atendimento, Atendimento iniciado) → Lead
 * Stages 2-6 (Diagnóstico → Reserva) → Oportunidade
 */
export async function onDealMoved(tenantId: number, dealId: number, toStageId: number, contactId: number | null, pipelineId: number) {
  if (!contactId) return;

  // Only apply to sales pipelines
  const isSales = await isSalesPipeline(tenantId, pipelineId);
  if (!isSales) return;

  const orderIndex = await getStageOrderIndex(tenantId, toStageId);
  if (orderIndex < 0) return;

  const contactData = await getContactClassificationData(tenantId, contactId);
  if (!contactData) return;

  // Don't downgrade customers/promoters
  const protectedClassifications: StageClassification[] = [
    "cliente_primeira_compra", "cliente_ativo", "cliente_recorrente", "promotor"
  ];
  if (protectedClassifications.includes(contactData.stageClassification as StageClassification)) {
    return;
  }

  if (orderIndex <= 1) {
    // Stages 0-1: Lead
    await updateContactClassification(tenantId, contactId, "lead", {
      lifecycleStage: "lead",
    });
  } else {
    // Stages 2-6: Oportunidade
    await updateContactClassification(tenantId, contactId, "oportunidade", {
      lifecycleStage: "prospect",
    });
  }
}

/**
 * Handle DealWon event
 * - No previous purchases → Cliente Primeira Compra
 * - Has previous purchases → Cliente Recorrente
 * - Start referral window (90 days)
 * - Update purchase tracking
 */
export async function onDealWon(tenantId: number, dealId: number, contactId: number | null, dealValueCents: number) {
  if (!contactId) return;

  const contactData = await getContactClassificationData(tenantId, contactId);
  if (!contactData) return;

  const wonCount = await countWonDealsForContact(tenantId, contactId);
  // wonCount includes the current deal that was just marked as won
  const previousPurchases = contactData.totalPurchases;
  const newTotalPurchases = previousPurchases + 1;
  const newTotalSpent = (contactData.totalSpentCents || 0) + (dealValueCents || 0);
  const now = new Date();

  let newClassification: StageClassification;
  if (previousPurchases === 0) {
    // First purchase ever
    newClassification = "cliente_primeira_compra";
  } else {
    // Recurrent customer
    newClassification = "cliente_recorrente";
  }

  await updateContactClassification(tenantId, contactId, newClassification, {
    lifecycleStage: "customer",
    lastPurchaseAt: now,
    totalPurchases: newTotalPurchases,
    totalSpentCents: newTotalSpent,
    referralWindowStart: now, // Start 90-day referral window
  });
}

/**
 * Handle DealLost event
 * - Never purchased → Desconhecido (Não Cliente)
 * - Has purchased before → Keep current classification
 */
export async function onDealLost(tenantId: number, dealId: number, contactId: number | null) {
  if (!contactId) return;

  const contactData = await getContactClassificationData(tenantId, contactId);
  if (!contactData) return;

  // Only downgrade if never purchased
  if (contactData.totalPurchases === 0) {
    await updateContactClassification(tenantId, contactId, "desconhecido", {
      lifecycleStage: "lead",
    });
  }
  // If they have purchased before, keep their current classification
}

/**
 * Check and update referral window expiration
 * Should be called periodically (e.g., daily cron job)
 */
export async function processReferralWindows(tenantId: number) {
  const db = await getDb();
  if (!db) return;

  const cutoff = new Date(Date.now() - REFERRAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Find contacts with expired referral windows
  await db.execute(sql`
    UPDATE contacts 
    SET referralWindowStart = NULL
    WHERE tenantId = ${tenantId}
      AND referralWindowStart IS NOT NULL
      AND referralWindowStart < ${cutoff}
  `);
}

/**
 * Check and update ex-client status
 * Should be called periodically (e.g., daily cron job)
 * Contacts inactive for 360+ days → ex_cliente
 */
export async function processInactiveClients(tenantId: number, inactivityDays: number = DEFAULT_INACTIVITY_DAYS) {
  const db = await getDb();
  if (!db) return;

  const cutoff = new Date(Date.now() - inactivityDays * 24 * 60 * 60 * 1000);

  // Update clients who have been inactive beyond the threshold
  await db.execute(sql`
    UPDATE contacts 
    SET stageClassification = 'ex_cliente',
        lifecycleStage = 'churned'
    WHERE tenantId = ${tenantId}
      AND totalPurchases > 0
      AND lastPurchaseAt IS NOT NULL
      AND lastPurchaseAt < ${cutoff}
      AND stageClassification IN ('cliente_primeira_compra', 'cliente_ativo', 'cliente_recorrente')
      AND stageClassification != 'promotor'
  `);

  // Update active clients (within cycle)
  await db.execute(sql`
    UPDATE contacts 
    SET stageClassification = CASE 
        WHEN totalPurchases = 1 THEN 'cliente_primeira_compra'
        WHEN totalPurchases > 1 THEN 'cliente_recorrente'
        ELSE stageClassification
      END
    WHERE tenantId = ${tenantId}
      AND totalPurchases > 0
      AND lastPurchaseAt IS NOT NULL
      AND lastPurchaseAt >= ${cutoff}
      AND stageClassification = 'ex_cliente'
  `);
}

/**
 * Increment referral count and potentially upgrade to promotor
 */
export async function onReferralConfirmed(tenantId: number, referrerContactId: number) {
  const db = await getDb();
  if (!db) return;

  const contactData = await getContactClassificationData(tenantId, referrerContactId);
  if (!contactData) return;

  const newCount = (contactData.referralCount || 0) + 1;

  await updateContactClassification(tenantId, referrerContactId, "promotor", {
    referralCount: newCount,
  });
}

// ═══════════════════════════════════════
// CLASSIFICATION DISPLAY HELPERS
// ═══════════════════════════════════════

export const CLASSIFICATION_CONFIG: Record<StageClassification, { label: string; color: string; bgClass: string; icon: string }> = {
  desconhecido: { label: "Desconhecido", color: "#94a3b8", bgClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", icon: "help-circle" },
  seguidor: { label: "Seguidor", color: "#a78bfa", bgClass: "bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300", icon: "eye" },
  lead: { label: "Lead", color: "#3b82f6", bgClass: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300", icon: "user-plus" },
  oportunidade: { label: "Oportunidade", color: "#f59e0b", bgClass: "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300", icon: "target" },
  cliente_primeira_compra: { label: "1a Compra", color: "#22c55e", bgClass: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300", icon: "shopping-bag" },
  cliente_ativo: { label: "Ativo", color: "#10b981", bgClass: "bg-teal-100 text-teal-600 dark:bg-teal-900 dark:text-teal-300", icon: "check-circle" },
  cliente_recorrente: { label: "Recorrente", color: "#0ea5e9", bgClass: "bg-sky-100 text-sky-600 dark:bg-sky-900 dark:text-sky-300", icon: "repeat" },
  ex_cliente: { label: "Ex-Cliente", color: "#ef4444", bgClass: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300", icon: "user-x" },
  promotor: { label: "Promotor", color: "#ec4899", bgClass: "bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-300", icon: "megaphone" },
};

/**
 * Check if a contact is within the referral window (90 days after DealWon)
 */
export function isInReferralWindow(referralWindowStart: Date | string | null): boolean {
  if (!referralWindowStart) return false;
  const start = new Date(referralWindowStart);
  const now = new Date();
  const diffDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= REFERRAL_WINDOW_DAYS;
}
