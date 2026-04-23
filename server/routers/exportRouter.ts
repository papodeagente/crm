import { z } from "zod";
import { tenantProcedure, getTenantId, router } from "../_core/trpc";
import { getDb } from "../db";
import { contacts, deals, pipelines, pipelineStages, crmUsers, customFields, customFieldValues, rfvContacts, lossReasons } from "../../drizzle/schema";
import { eq, and, isNull, desc, inArray, sql } from "drizzle-orm";
import * as XLSX from "xlsx";

// ─── Helpers ───

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const lifecycleLabels: Record<string, string> = {
  lead: "Lead",
  prospect: "Prospect",
  customer: "Cliente",
  churned: "Perdido",
  merged: "Mesclado",
};

const statusLabels: Record<string, string> = {
  open: "Aberta",
  won: "Ganha",
  lost: "Perdida",
};

const audienceLabels: Record<string, string> = {
  desconhecido: "Desconhecido",
  seguidor: "Seguidor",
  lead: "Lead",
  oportunidade: "Oportunidade",
  nao_cliente: "Não Cliente",
  cliente_primeira_compra: "1a Compra",
  cliente_recorrente: "Recorrente",
  ex_cliente: "Ex-Cliente",
  indicado: "Indicado",
};

const flagLabels: Record<string, string> = {
  none: "",
  potencial_indicador: "Potencial Indicador",
  risco_ex_cliente: "Risco Ex-Cliente",
  abordagem_nao_cliente: "Abordagem Não Cliente",
};

async function getCustomFieldsMap(db: any, tenantId: number, entity: "contact" | "deal") {
  const fields = await db.select().from(customFields)
    .where(and(eq(customFields.tenantId, tenantId), eq(customFields.entity, entity)))
    .orderBy(customFields.sortOrder);
  return fields as Array<{ id: number; label: string; name: string; fieldType: string }>;
}

async function getCustomFieldValuesForEntities(db: any, tenantId: number, entityType: "contact" | "deal", entityIds: number[]) {
  if (entityIds.length === 0) return new Map<number, Map<number, string>>();
  
  const values = await db.select({
    entityId: customFieldValues.entityId,
    fieldId: customFieldValues.fieldId,
    value: customFieldValues.value,
  }).from(customFieldValues)
    .where(and(
      eq(customFieldValues.tenantId, tenantId),
      eq(customFieldValues.entityType, entityType),
      inArray(customFieldValues.entityId, entityIds),
    ));

  // Map: entityId -> Map<fieldId, value>
  const map = new Map<number, Map<number, string>>();
  for (const v of values) {
    if (!map.has(v.entityId)) map.set(v.entityId, new Map());
    map.get(v.entityId)!.set(v.fieldId, v.value || "");
  }
  return map;
}

function buildWorkbook(sheetName: string, rows: Record<string, any>[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  
  // Auto-size columns
  const colWidths: number[] = [];
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    for (let i = 0; i < headers.length; i++) {
      let maxLen = headers[i].length;
      for (const row of rows) {
        const val = String(row[headers[i]] ?? "");
        if (val.length > maxLen) maxLen = val.length;
      }
      colWidths.push(Math.min(maxLen + 2, 50));
    }
    ws["!cols"] = colWidths.map(w => ({ wch: w }));
  }
  
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ─── Router ───

export const exportRouter = router({
  
  // ═══════════════════════════════════════
  // EXPORT CONTACTS
  // ═══════════════════════════════════════
  contacts: tenantProcedure
    .mutation(async ({ ctx }) => {
      const tenantId = getTenantId(ctx);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch all active contacts
      const allContacts = await db.select().from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), isNull(contacts.deletedAt)))
        .orderBy(desc(contacts.updatedAt));

      // Fetch owner names
      const users = await db.select({ id: crmUsers.id, name: crmUsers.name })
        .from(crmUsers).where(eq(crmUsers.tenantId, tenantId));
      const userMap = new Map(users.map(u => [u.id, u.name]));

      // Fetch custom fields
      const cfFields = await getCustomFieldsMap(db, tenantId, "contact");
      const entityIds = allContacts.map(c => c.id);
      const cfValues = await getCustomFieldValuesForEntities(db, tenantId, "contact", entityIds);

      // Build rows
      const rows = allContacts.map(c => {
        const row: Record<string, any> = {
          "Nome": c.name || "",
          "E-mail": c.email || "",
          "Telefone": c.phone || "",
          "CPF/CNPJ": c.docId || "",
          "Tipo": c.type === "company" ? "Empresa" : "Pessoa",
          "Estágio": lifecycleLabels[c.lifecycleStage] || c.lifecycleStage,
          "Classificação": audienceLabels[c.stageClassification] || c.stageClassification,
          "Responsável": c.ownerUserId ? (userMap.get(c.ownerUserId) || "") : "",
          "Tags": Array.isArray(c.tagsJson) ? (c.tagsJson as string[]).join(", ") : "",
          "Origem": c.source || "",
          "Total Compras": c.totalPurchases || 0,
          "Valor Total": formatCurrency(c.totalSpentCents),
          "Última Compra": formatDate(c.lastPurchaseAt),
          "Data Nascimento": c.birthDate || "",
          "Data Casamento": c.weddingDate || "",
          "Observações": c.notes || "",
          "Criado em": formatDate(c.createdAt),
          "Atualizado em": formatDate(c.updatedAt),
        };

        // Add custom fields
        const entityCfValues = cfValues.get(c.id);
        for (const cf of cfFields) {
          row[cf.label] = entityCfValues?.get(cf.id) || "";
        }

        return row;
      });

      const buffer = buildWorkbook("Contatos", rows);
      return {
        base64: buffer.toString("base64"),
        filename: `contatos_${new Date().toISOString().slice(0, 10)}.xlsx`,
        count: rows.length,
      };
    }),

  // ═══════════════════════════════════════
  // EXPORT DEALS
  // ═══════════════════════════════════════
  deals: tenantProcedure
    .input(z.object({
      pipelineId: z.number().optional(),
      status: z.string().optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Build conditions
      const conditions: any[] = [eq(deals.tenantId, tenantId), isNull(deals.deletedAt)];
      if (input?.pipelineId) conditions.push(eq(deals.pipelineId, input.pipelineId));
      if (input?.status) conditions.push(eq(deals.status, input.status as any));

      // Fetch all deals with joins
      const allDeals = await db.select({
        id: deals.id,
        title: deals.title,
        valueCents: deals.valueCents,
        status: deals.status,
        probability: deals.probability,
        contactId: deals.contactId,
        ownerUserId: deals.ownerUserId,
        pipelineId: deals.pipelineId,
        stageId: deals.stageId,
        channelOrigin: deals.channelOrigin,
        leadSource: deals.leadSource,
        expectedCloseAt: deals.expectedCloseAt,
        appointmentDate: deals.appointmentDate,
        followUpDate: deals.followUpDate,
        lossReasonId: deals.lossReasonId,
        lossNotes: deals.lossNotes,
        utmCampaign: deals.utmCampaign,
        utmSource: deals.utmSource,
        utmMedium: deals.utmMedium,
        lastActivityAt: deals.lastActivityAt,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
        contactName: contacts.name,
        contactPhone: contacts.phone,
        contactEmail: contacts.email,
        stageName: pipelineStages.name,
        pipelineName: pipelines.name,
      })
        .from(deals)
        .leftJoin(contacts, eq(deals.contactId, contacts.id))
        .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
        .leftJoin(pipelines, eq(deals.pipelineId, pipelines.id))
        .where(and(...conditions))
        .orderBy(desc(deals.updatedAt));

      // Fetch owner names
      const users = await db.select({ id: crmUsers.id, name: crmUsers.name })
        .from(crmUsers).where(eq(crmUsers.tenantId, tenantId));
      const userMap = new Map(users.map(u => [u.id, u.name]));

      // Fetch loss reasons
      const reasons = await db.select({ id: lossReasons.id, name: lossReasons.name })
        .from(lossReasons).where(eq(lossReasons.tenantId, tenantId));
      const reasonMap = new Map(reasons.map(r => [r.id, r.name]));

      // Fetch custom fields
      const cfFields = await getCustomFieldsMap(db, tenantId, "deal");
      const entityIds = allDeals.map(d => d.id);
      const cfValues = await getCustomFieldValuesForEntities(db, tenantId, "deal", entityIds);

      // Build rows
      const rows = allDeals.map(d => {
        const row: Record<string, any> = {
          "Título": d.title || "",
          "Contato": d.contactName || "",
          "Telefone Contato": d.contactPhone || "",
          "E-mail Contato": d.contactEmail || "",
          "Funil": d.pipelineName || "",
          "Etapa": d.stageName || "",
          "Status": statusLabels[d.status] || d.status,
          "Valor": formatCurrency(d.valueCents),
          "Probabilidade": d.probability != null ? `${d.probability}%` : "",
          "Responsável": d.ownerUserId ? (userMap.get(d.ownerUserId) || "") : "",
          "Origem do Lead": d.leadSource || "",
          "Canal de Origem": d.channelOrigin || "",
          "Previsão de Fechamento": formatDate(d.expectedCloseAt),
          "Data do Atendimento": formatDate(d.appointmentDate),
          "Data de Retorno/Follow-up": formatDate(d.followUpDate),
          "Motivo de Perda": d.lossReasonId ? (reasonMap.get(d.lossReasonId) || "") : "",
          "Notas de Perda": d.lossNotes || "",
          "UTM Campaign": d.utmCampaign || "",
          "UTM Source": d.utmSource || "",
          "UTM Medium": d.utmMedium || "",
          "Última Atividade": formatDate(d.lastActivityAt),
          "Criado em": formatDate(d.createdAt),
          "Atualizado em": formatDate(d.updatedAt),
        };

        // Add custom fields
        const entityCfValues = cfValues.get(d.id);
        for (const cf of cfFields) {
          row[cf.label] = entityCfValues?.get(cf.id) || "";
        }

        return row;
      });

      const buffer = buildWorkbook("Negociações", rows);
      return {
        base64: buffer.toString("base64"),
        filename: `negociacoes_${new Date().toISOString().slice(0, 10)}.xlsx`,
        count: rows.length,
      };
    }),

  // ═══════════════════════════════════════
  // EXPORT RFV MATRIX
  // ═══════════════════════════════════════
  rfv: tenantProcedure
    .mutation(async ({ ctx }) => {
      const tenantId = getTenantId(ctx);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { assertFeatureAccess } = await import("../services/planLimitsService");
      await assertFeatureAccess(tenantId, "rfvEnabled");

      // Fetch all RFV contacts
      const allRfv = await db.select().from(rfvContacts)
        .where(and(eq(rfvContacts.tenantId, tenantId), isNull(rfvContacts.deletedAt)))
        .orderBy(desc(rfvContacts.vScore));

      const rows = allRfv.map(r => ({
        "Nome": r.name || "",
        "E-mail": r.email || "",
        "Telefone": r.phone || "",
        "Classificação": audienceLabels[r.audienceType] || r.audienceType,
        "Flag": flagLabels[r.rfvFlag] || r.rfvFlag,
        "Valor Total (R$)": formatCurrency(r.vScore),
        "Qtd Compras": r.fScore,
        "Dias Desde Última Compra": r.rScore === 9999 ? "Nunca comprou" : r.rScore,
        "Total Atendimentos": r.totalAtendimentos,
        "Vendas Ganhas": r.totalVendasGanhas,
        "Vendas Perdidas": r.totalVendasPerdidas,
        "Taxa Conversão (%)": r.taxaConversao,
        "Última Compra": formatDate(r.lastPurchaseAt),
        "Última Ação": formatDate(r.lastActionDate),
        "Criado em": formatDate(r.createdAt),
      }));

      const buffer = buildWorkbook("Matriz RFV", rows);
      return {
        base64: buffer.toString("base64"),
        filename: `matriz_rfv_${new Date().toISOString().slice(0, 10)}.xlsx`,
        count: rows.length,
      };
    }),
});
