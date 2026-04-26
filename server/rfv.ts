/**
 * RFV (Recência, Frequência, Valor) — Backend Logic
 * Classificação automática de contatos em 9 públicos comerciais
 */
import { getDb, rowsOf } from "./db";
import { rfvContacts, contactActionLogs, deals, type RfvContact, type NewRfvContact } from "../drizzle/schema";
import { eq, and, sql, desc, asc, like, isNull, or, lte, gte, between, inArray, gt, not } from "drizzle-orm";

// ─── Smart Filter Types ───
export const SMART_FILTERS = [
  "potencial_ex_cliente",
  "potencial_indicador",
  "potencial_indicador_pos_atendimento",
  "potencial_indicador_fiel",
  "abordagem_nao_cliente",
  "indicadores_ativos",
  "indicados_convertidos",
] as const;

export type SmartFilter = typeof SMART_FILTERS[number];

export const SMART_FILTER_CONFIG: Record<SmartFilter, { label: string; description: string }> = {
  potencial_ex_cliente: {
    label: "Potencial Ex-Cliente",
    description: "250 a 350 dias sem comprar",
  },
  potencial_indicador: {
    label: "Potencial Indicador",
    description: "Compra nos últimos 30 dias",
  },
  potencial_indicador_pos_atendimento: {
    label: "Pós Atendimento",
    description: "30 dias após follow-up do atendimento",
  },
  potencial_indicador_fiel: {
    label: "Indicador Fiel",
    description: "Mais de 1 compra realizada",
  },
  abordagem_nao_cliente: {
    label: "Abordagem Não Cliente",
    description: "Venda perdida nos últimos 90 dias",
  },
  indicadores_ativos: {
    label: "Indicadores Ativos",
    description: "Clientes que fizeram pelo menos 1 indicação",
  },
  indicados_convertidos: {
    label: "Indicados Convertidos",
    description: "Contatos indicados que já compraram",
  },
};

// ─── Audience Types ───
export const AUDIENCE_TYPES = [
  "desconhecido", "seguidor", "lead", "oportunidade",
  "nao_cliente", "cliente_primeira_compra", "cliente_recorrente",
  "ex_cliente", "indicado",
] as const;

export type AudienceType = typeof AUDIENCE_TYPES[number];

// ─── Classification Rules (strict order) ───
export function classifyContact(params: {
  estadoMaisRecente: string | null;
  totalCompras: number;
  diasDesdeUltimaCompra: number;
  totalAtendimentos: number;
}): AudienceType {
  const { estadoMaisRecente, totalCompras, diasDesdeUltimaCompra, totalAtendimentos } = params;
  const estado = (estadoMaisRecente || "").toLowerCase().trim();

  // Rule 1: Open/in-progress deals
  if (["em andamento", "aberto", "open"].includes(estado)) {
    return "oportunidade";
  }

  // Rule 2: Lost deal, no purchases
  if (["perdido", "perdida", "lost"].includes(estado) && totalCompras === 0) {
    return "nao_cliente";
  }

  // Rule 3: Recurring customer
  if (totalCompras >= 2 && diasDesdeUltimaCompra <= 300) {
    return "cliente_recorrente";
  }

  // Rule 4: First-time customer
  if (totalCompras === 1 && diasDesdeUltimaCompra <= 300) {
    return "cliente_primeira_compra";
  }

  // Rule 5: Ex-customer
  if (totalCompras > 0 && diasDesdeUltimaCompra > 300) {
    return "ex_cliente";
  }

  // Rule 6: Non-customer with interactions
  if (totalCompras === 0 && totalAtendimentos > 0) {
    return "nao_cliente";
  }

  // Rule 7: Fallback
  return "lead";
}

// ─── Flag Rules (mutually exclusive) ───
export function computeFlag(params: {
  audienceType: AudienceType;
  totalVendasGanhas: number;
  diasDesdeUltimaCompra: number;
  totalCompras: number;
  createdAt: Date;
  referralCount?: number;
}): string {
  const { audienceType, totalVendasGanhas, diasDesdeUltimaCompra, totalCompras, createdAt, referralCount = 0 } = params;
  const now = new Date();
  const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  // Flag 0: Top Indicador (3+ referrals)
  if (referralCount >= 3) {
    return "top_indicador";
  }

  // Flag 1: Potencial Indicador
  if (totalVendasGanhas > 0 && diasDesdeUltimaCompra >= 10 && diasDesdeUltimaCompra <= 20) {
    return "potencial_indicador";
  }

  // Flag 2: Risco Ex Cliente
  if (totalCompras > 0 && diasDesdeUltimaCompra >= 280 && diasDesdeUltimaCompra <= 310) {
    return "risco_ex_cliente";
  }

  // Flag 3: Abordagem Não Cliente
  if (audienceType === "nao_cliente" && daysSinceCreation <= 90) {
    return "abordagem_nao_cliente";
  }

  return "none";
}

// ─── Normalize phone for WhatsApp link ───
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return withCountry;
}

export function whatsappLink(phone: string | null | undefined): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://web.whatsapp.com/send?phone=${normalized}`;
}

// ─── Conversion badge ───
export function conversionBadge(taxaConversao: number): "alta" | "media" | "baixa" {
  if (taxaConversao >= 50) return "alta";
  if (taxaConversao >= 20) return "media";
  return "baixa";
}

// ─── Normalize deal status ───
export function normalizeEstado(estado: string): string {
  const lower = estado.toLowerCase().trim();
  if (["em andamento", "aberto", "open"].includes(lower)) return "em andamento";
  if (["perdido", "perdida", "lost"].includes(lower)) return "perdido";
  if (["vendido", "ganho", "won"].includes(lower)) return "vendido";
  return lower;
}

// ─── DB Helpers ───

export async function getRfvContacts(tenantId: number, params: {
  page?: number;
  pageSize?: number;
  search?: string;
  audienceType?: string;
  smartFilter?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const page = params.page || 1;
  const pageSize = params.pageSize || 50;
  const offset = (page - 1) * pageSize;

  // For smart filters that need JOINs, we use raw SQL subqueries
  const smartFilter = params.smartFilter as SmartFilter | undefined;
  let smartFilterContactIds: number[] | null = null;

  if (smartFilter) {
    smartFilterContactIds = await getSmartFilterContactIds(db, tenantId, smartFilter);
  }

  const conditions: any[] = [
    eq(rfvContacts.tenantId, tenantId),
    isNull(rfvContacts.deletedAt),
  ];

  if (params.search) {
    conditions.push(like(rfvContacts.name, `%${params.search}%`));
  }

  if (params.audienceType && params.audienceType !== "all") {
    conditions.push(eq(rfvContacts.audienceType, params.audienceType));
  }

  // Apply smart filter
  if (smartFilterContactIds !== null) {
    if (smartFilterContactIds.length === 0) {
      // No matches — return empty
      return { contacts: [], total: 0, page, pageSize, totalPages: 0 };
    }
    conditions.push(inArray(rfvContacts.id, smartFilterContactIds));
  }

  // Sort
  let orderBy: any;
  const dir = params.sortDir === "asc" ? asc : desc;
  switch (params.sortBy) {
    case "valor": orderBy = dir(rfvContacts.vScore); break;
    case "compras": orderBy = dir(rfvContacts.fScore); break;
    case "recencia": orderBy = dir(rfvContacts.rScore); break;
    case "conversao": orderBy = dir(rfvContacts.taxaConversao); break;
    case "atendimentos": orderBy = dir(rfvContacts.totalAtendimentos); break;
    default: orderBy = desc(rfvContacts.updatedAt);
  }

  const [rows, countResult] = await Promise.all([
    db.select()
      .from(rfvContacts)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(rfvContacts)
      .where(and(...conditions)),
  ]);

  return {
    contacts: rows,
    total: countResult[0]?.count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((countResult[0]?.count || 0) / pageSize),
  };
}

// ─── Smart Filter Logic ───

async function getSmartFilterContactIds(db: any, tenantId: number, filter: SmartFilter): Promise<number[]> {
  const now = new Date();

  switch (filter) {
    case "potencial_ex_cliente": {
      // 250-350 dias sem comprar (rScore entre 250 e 350, com pelo menos 1 compra)
      const rows = await db.select({ id: rfvContacts.id })
        .from(rfvContacts)
        .where(and(
          eq(rfvContacts.tenantId, tenantId),
          isNull(rfvContacts.deletedAt),
          gte(rfvContacts.rScore, 250),
          lte(rfvContacts.rScore, 350),
          gt(rfvContacts.fScore, 0),
        ));
      return rows.map((r: any) => r.id);
    }

    case "potencial_indicador": {
      // Compra nos últimos 30 dias
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const rows = await db.select({ id: rfvContacts.id })
        .from(rfvContacts)
        .where(and(
          eq(rfvContacts.tenantId, tenantId),
          isNull(rfvContacts.deletedAt),
          gt(rfvContacts.fScore, 0),
          gte(rfvContacts.lastPurchaseAt, thirtyDaysAgo),
        ));
      return rows.map((r: any) => r.id);
    }

    case "potencial_indicador_pos_atendimento": {
      // 30 dias após a data de follow-up do atendimento (followUpDate no deal)
      // Busca contatos cujo deal tem followUpDate entre 25-35 dias atrás (janela de ~30 dias)
      const windowStart = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);

      const dealRows = await db.execute(sql`
        SELECT DISTINCT rc.id
        FROM rfv_contacts rc
        INNER JOIN contacts c ON c.id = rc."contactId" AND c."tenantId" = ${tenantId}
        INNER JOIN deals d ON d."contactId" = c.id AND d."tenantId" = ${tenantId} AND d."deletedAt" IS NULL
        WHERE rc."tenantId" = ${tenantId}
          AND rc."deletedAt" IS NULL
          AND d.status = 'won'
          AND d."followUpDate" IS NOT NULL
          AND d."followUpDate" BETWEEN ${windowStart} AND ${windowEnd}
      `);
      const resultRows = (dealRows as unknown as any[]) || [];
      return resultRows.map((r: any) => r.id);
    }

    case "potencial_indicador_fiel": {
      // Mais de 1 compra realizada (fScore > 1)
      const rows = await db.select({ id: rfvContacts.id })
        .from(rfvContacts)
        .where(and(
          eq(rfvContacts.tenantId, tenantId),
          isNull(rfvContacts.deletedAt),
          gt(rfvContacts.fScore, 1),
        ));
      return rows.map((r: any) => r.id);
    }

    case "abordagem_nao_cliente": {
      // Venda perdida nos últimos 90 dias
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const dealRows = await db.execute(sql`
        SELECT DISTINCT rc.id
        FROM rfv_contacts rc
        INNER JOIN contacts c ON c.id = rc."contactId" AND c."tenantId" = ${tenantId}
        INNER JOIN deals d ON d."contactId" = c.id AND d."tenantId" = ${tenantId} AND d."deletedAt" IS NULL
        WHERE rc."tenantId" = ${tenantId}
          AND rc."deletedAt" IS NULL
          AND d.status = 'lost'
          AND d."updatedAt" >= ${ninetyDaysAgo}
      `);
      const resultRows = (dealRows as unknown as any[]) || [];
      return resultRows.map((r: any) => r.id);
    }

    case "indicadores_ativos": {
      // Clientes que fizeram pelo menos 1 indicação (referralCount > 0)
      const rows = await db.execute(sql`
        SELECT DISTINCT rc.id
        FROM rfv_contacts rc
        INNER JOIN contacts c ON c.id = rc."contactId" AND c."tenantId" = ${tenantId}
        WHERE rc."tenantId" = ${tenantId}
          AND rc."deletedAt" IS NULL
          AND COALESCE(c."referralCount", 0) > 0
      `);
      const resultRows = rowsOf(rows);
      return resultRows.map((r: any) => r.id);
    }

    case "indicados_convertidos": {
      // Contatos que foram indicados e já compraram (status = 'converted' na tabela referrals)
      const rows = await db.execute(sql`
        SELECT DISTINCT rc.id
        FROM rfv_contacts rc
        INNER JOIN contacts c ON c.id = rc."contactId" AND c."tenantId" = ${tenantId}
        INNER JOIN referrals r ON r."referredId" = c.id AND r."tenantId" = ${tenantId}
        WHERE rc."tenantId" = ${tenantId}
          AND rc."deletedAt" IS NULL
          AND r.status = 'converted'
      `);
      const resultRows = rowsOf(rows);
      return resultRows.map((r: any) => r.id);
    }

    default:
      return [];
  }
}

// ─── Smart Filter Counts ───
export async function getSmartFilterCounts(tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const windowStart = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);

  const baseWhere = `rc.tenantId = ${tenantId} AND rc.deletedAt IS NULL`;

  const result = await db.execute(sql`
    SELECT
      (
        SELECT COUNT(*) FROM rfv_contacts rc
        WHERE ${sql.raw(baseWhere)} AND rc."rScore" BETWEEN 250 AND 350 AND rc."fScore" > 0
      ) AS potencial_ex_cliente,
      (
        SELECT COUNT(*) FROM rfv_contacts rc
        WHERE ${sql.raw(baseWhere)} AND rc."fScore" > 0 AND rc."lastPurchaseAt" >= ${thirtyDaysAgo}
      ) AS potencial_indicador,
      (
        SELECT COUNT(DISTINCT rc.id) FROM rfv_contacts rc
        INNER JOIN contacts c ON c.id = rc."contactId" AND c."tenantId" = ${tenantId}
        INNER JOIN deals d ON d."contactId" = c.id AND d."tenantId" = ${tenantId} AND d."deletedAt" IS NULL
        WHERE ${sql.raw(baseWhere)} AND d.status = 'won' AND d."followUpDate" IS NOT NULL
          AND d."followUpDate" BETWEEN ${windowStart} AND ${windowEnd}
      ) AS potencial_indicador_pos_atendimento,
      (
        SELECT COUNT(*) FROM rfv_contacts rc
        WHERE ${sql.raw(baseWhere)} AND rc."fScore" > 1
      ) AS potencial_indicador_fiel,
      (
        SELECT COUNT(DISTINCT rc.id) FROM rfv_contacts rc
        INNER JOIN contacts c ON c.id = rc."contactId" AND c."tenantId" = ${tenantId}
        INNER JOIN deals d ON d."contactId" = c.id AND d."tenantId" = ${tenantId} AND d."deletedAt" IS NULL
        WHERE ${sql.raw(baseWhere)} AND d.status = 'lost' AND d."updatedAt" >= ${ninetyDaysAgo}
      ) AS abordagem_nao_cliente,
      (
        SELECT COUNT(DISTINCT rc.id) FROM rfv_contacts rc
        INNER JOIN contacts c ON c.id = rc."contactId" AND c."tenantId" = ${tenantId}
        WHERE ${sql.raw(baseWhere)} AND COALESCE(c."referralCount", 0) > 0
      ) AS indicadores_ativos,
      (
        SELECT COUNT(DISTINCT rc.id) FROM rfv_contacts rc
        INNER JOIN contacts c ON c.id = rc."contactId" AND c."tenantId" = ${tenantId}
        INNER JOIN referrals r ON r."referredId" = c.id AND r."tenantId" = ${tenantId}
        WHERE ${sql.raw(baseWhere)} AND r.status = 'converted'
      ) AS indicados_convertidos
  `);

  const row = rowsOf(result)[0] || {};
  return {
    potencial_ex_cliente: Number(row.potencial_ex_cliente || 0),
    potencial_indicador: Number(row.potencial_indicador || 0),
    potencial_indicador_pos_atendimento: Number(row.potencial_indicador_pos_atendimento || 0),
    potencial_indicador_fiel: Number(row.potencial_indicador_fiel || 0),
    abordagem_nao_cliente: Number(row.abordagem_nao_cliente || 0),
    indicadores_ativos: Number(row.indicadores_ativos || 0),
    indicados_convertidos: Number(row.indicados_convertidos || 0),
  };
}

export async function getRfvDashboard(tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const baseCondition = and(eq(rfvContacts.tenantId, tenantId), isNull(rfvContacts.deletedAt));

  const [totals, audienceDistribution] = await Promise.all([
    db.select({
      totalContatos: sql<number>`count(*)`,
      receitaTotal: sql<number>`COALESCE(sum(vScore), 0)`,
      oportunidades: sql<number>`sum(CASE WHEN audienceType = 'oportunidade' THEN 1 ELSE 0 END)`,
      conversaoMedia: sql<number>`COALESCE(avg(taxaConversao), 0)`,
    })
      .from(rfvContacts)
      .where(baseCondition),
    db.select({
      audienceType: rfvContacts.audienceType,
      count: sql<number>`count(*)`,
      totalValue: sql<number>`COALESCE(sum(vScore), 0)`,
    })
      .from(rfvContacts)
      .where(baseCondition)
      .groupBy(rfvContacts.audienceType),
  ]);

  return {
    totalContatos: totals[0]?.totalContatos || 0,
    receitaTotal: totals[0]?.receitaTotal || 0,
    oportunidades: totals[0]?.oportunidades || 0,
    conversaoMedia: Number(totals[0]?.conversaoMedia || 0),
    audienceDistribution,
  };
}

export async function getAlertaDinheiroParado(tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = await db.select({
    audienceType: rfvContacts.audienceType,
    count: sql<number>`count(*)`,
    valorPotencial: sql<number>`COALESCE(sum(vScore), 0)`,
  })
    .from(rfvContacts)
    .where(and(
      eq(rfvContacts.tenantId, tenantId),
      isNull(rfvContacts.deletedAt),
      or(
        isNull(rfvContacts.lastActionDate),
        lte(rfvContacts.lastActionDate, sevenDaysAgo),
      ),
      // Focus audiences only
      sql`"audienceType" IN ('oportunidade', 'cliente_primeira_compra', 'cliente_recorrente', 'nao_cliente')`,
    ))
    .groupBy(rfvContacts.audienceType);

  const totalContatos = rows.reduce((sum, r) => sum + r.count, 0);
  const valorPotencial = rows.reduce((sum, r) => sum + r.valorPotencial, 0);

  return {
    totalContatos,
    valorPotencial,
    distribuicao: rows,
  };
}

export async function upsertRfvContact(tenantId: number, data: {
  name: string;
  email?: string | null;
  phone?: string | null;
  vScore: number;
  fScore: number;
  rScore: number;
  totalAtendimentos: number;
  totalVendasGanhas: number;
  totalVendasPerdidas: number;
  taxaConversao: number;
  lastPurchaseAt?: Date | null;
  lastActionDate?: Date | null;
  audienceType: string;
  rfvFlag: string;
  contactId?: number | null;
  createdBy?: number | null;
  createdAt?: Date;
}): Promise<RfvContact> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Try to find existing by phone, email, or name
  let existing: RfvContact | undefined;

  if (data.phone) {
    const phoneDigits = data.phone.replace(/\D/g, "");
    if (phoneDigits.length >= 10) {
      const rows = await db.select().from(rfvContacts)
        .where(and(
          eq(rfvContacts.tenantId, tenantId),
          isNull(rfvContacts.deletedAt),
          like(rfvContacts.phone, `%${phoneDigits.slice(-11)}%`),
        ))
        .limit(1);
      existing = rows[0];
    }
  }

  if (!existing && data.email) {
    const rows = await db.select().from(rfvContacts)
      .where(and(
        eq(rfvContacts.tenantId, tenantId),
        isNull(rfvContacts.deletedAt),
        eq(rfvContacts.email, data.email),
      ))
      .limit(1);
    existing = rows[0];
  }

  if (!existing && data.name) {
    const rows = await db.select().from(rfvContacts)
      .where(and(
        eq(rfvContacts.tenantId, tenantId),
        isNull(rfvContacts.deletedAt),
        eq(rfvContacts.name, data.name),
      ))
      .limit(1);
    existing = rows[0];
  }

  if (existing) {
    // UPDATE
    await db.update(rfvContacts)
      .set({
        name: data.name,
        email: data.email || existing.email,
        phone: data.phone || existing.phone,
        vScore: data.vScore,
        fScore: data.fScore,
        rScore: data.rScore,
        totalAtendimentos: data.totalAtendimentos,
        totalVendasGanhas: data.totalVendasGanhas,
        totalVendasPerdidas: data.totalVendasPerdidas,
        taxaConversao: String(data.taxaConversao),
        lastPurchaseAt: data.lastPurchaseAt,
        lastActionDate: data.lastActionDate,
        audienceType: data.audienceType,
        rfvFlag: data.rfvFlag,
        contactId: data.contactId ?? existing.contactId,
      })
      .where(eq(rfvContacts.id, existing.id));

    const updated = await db.select().from(rfvContacts).where(eq(rfvContacts.id, existing.id)).limit(1);
    return updated[0];
  } else {
    // INSERT
    const result = await db.insert(rfvContacts).values({
      tenantId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      vScore: data.vScore,
      fScore: data.fScore,
      rScore: data.rScore,
      totalAtendimentos: data.totalAtendimentos,
      totalVendasGanhas: data.totalVendasGanhas,
      totalVendasPerdidas: data.totalVendasPerdidas,
      taxaConversao: String(data.taxaConversao),
      lastPurchaseAt: data.lastPurchaseAt,
      lastActionDate: data.lastActionDate,
      audienceType: data.audienceType,
      rfvFlag: data.rfvFlag,
      contactId: data.contactId,
      createdBy: data.createdBy,
      createdAt: data.createdAt || new Date(),
    });

    const insertId = (result as any).id ?? (result as any)[0]?.id;
    const inserted = await db.select().from(rfvContacts).where(eq(rfvContacts.id, insertId)).limit(1);
    return inserted[0];
  }
}

export async function recalculateRfvFromDeals(tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Step 1: Delete existing RFV data for this tenant (clean recalc)
  await db.delete(rfvContacts).where(eq(rfvContacts.tenantId, tenantId));

  // Step 2: Get all contacts with their deal aggregations in a single query
  const contactDeals = await db.execute(sql`
    SELECT 
      c.id as contactId,
      c.name,
      c.email,
      c.phone,
      COUNT(d.id) as totalAtendimentos,
      SUM(CASE WHEN d.status = 'won' THEN 1 ELSE 0 END) as totalVendasGanhas,
      SUM(CASE WHEN d.status = 'lost' THEN 1 ELSE 0 END) as totalVendasPerdidas,
      COALESCE(SUM(CASE WHEN d.status = 'won' THEN d."valueCents" ELSE 0 END), 0) as totalValor,
      MAX(CASE WHEN d.status = 'won' THEN d."updatedAt" ELSE NULL END) as ultimaCompraDate,
      (SELECT d2.status FROM deals d2 WHERE d2."contactId" = c.id AND d2."tenantId" = ${tenantId} AND d2."deletedAt" IS NULL ORDER BY d2."updatedAt" DESC LIMIT 1) as estadoMaisRecente,
      MAX(d."updatedAt") as lastActionDate,
      c."createdAt" as contactCreatedAt
    FROM contacts c
    LEFT JOIN deals d ON d."contactId" = c.id AND d."tenantId" = ${tenantId} AND d."deletedAt" IS NULL
    WHERE c."tenantId" = ${tenantId} AND c."deletedAt" IS NULL
    GROUP BY c.id, c.name, c.email, c.phone, c."createdAt"
  `);

  const rows = (contactDeals as unknown as any[]) || [];
  const now = new Date();
  const statusMap: Record<string, string> = { open: "em andamento", won: "vendido", lost: "perdido" };

  // Step 3: Process rows in memory and batch insert using Drizzle
  const BATCH_SIZE = 200;
  let processed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const insertRows: NewRfvContact[] = [];

    for (const row of batch) {
      const totalCompras = Number(row.totalVendasGanhas || 0);
      const totalAtendimentos = Number(row.totalAtendimentos || 0);
      const totalVendasGanhas = Number(row.totalVendasGanhas || 0);
      const totalVendasPerdidas = Number(row.totalVendasPerdidas || 0);
      const totalValor = Number(row.totalValor || 0);
      const ultimaCompraDate = row.ultimaCompraDate ? new Date(row.ultimaCompraDate) : null;
      const lastActionDate = row.lastActionDate ? new Date(row.lastActionDate) : null;
      const contactCreatedAt = row.contactCreatedAt ? new Date(row.contactCreatedAt) : now;

      const estadoMaisRecente = statusMap[row.estadoMaisRecente] || row.estadoMaisRecente || "";
      const diasDesdeUltimaCompra = ultimaCompraDate
        ? Math.floor((now.getTime() - ultimaCompraDate.getTime()) / (1000 * 60 * 60 * 24))
        : 9999;

      const taxaConversao = totalAtendimentos > 0
        ? Math.round((totalVendasGanhas / totalAtendimentos) * 10000) / 100
        : 0;

      const audienceType = classifyContact({
        estadoMaisRecente,
        totalCompras,
        diasDesdeUltimaCompra,
        totalAtendimentos,
      });

      const rfvFlag = computeFlag({
        audienceType,
        totalVendasGanhas,
        diasDesdeUltimaCompra,
        totalCompras,
        createdAt: contactCreatedAt,
      });

      insertRows.push({
        tenantId,
        name: row.name || 'Sem nome',
        email: row.email || null,
        phone: row.phone || null,
        vScore: totalValor,
        fScore: totalCompras,
        rScore: diasDesdeUltimaCompra,
        totalAtendimentos,
        totalVendasGanhas,
        totalVendasPerdidas,
        taxaConversao: String(taxaConversao),
        lastPurchaseAt: ultimaCompraDate,
        lastActionDate,
        audienceType,
        rfvFlag,
        contactId: row.contactId || null,
        createdAt: contactCreatedAt,
      });
    }

    if (insertRows.length > 0) {
      await db.insert(rfvContacts).values(insertRows);
      processed += insertRows.length;
    }
  }

  return { processed, total: rows.length };
}

export async function resetAgencyRfvData(tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete all action logs for tenant
  const logResult = await db.execute(sql`
    DELETE FROM contact_action_logs
    WHERE "tenantId" = ${tenantId}
  `);
  const totalDeleted = (logResult as any).rowCount || 0;

  // Delete all rfv contacts for tenant
  const contactResult = await db.execute(sql`
    DELETE FROM rfv_contacts
    WHERE "tenantId" = ${tenantId}
  `);
  const contactsDeleted = (contactResult as any).rowCount || 0;

  return { logsDeleted: totalDeleted, contactsDeleted };
}

// ─── CSV Import helpers ───

export interface CsvRow {
  nome?: string;
  email?: string;
  telefone?: string;
  valor?: string;
  estado?: string;
  data_fechamento?: string;
  data_criacao?: string;
}

export function parseCsvRows(csvText: string): CsvRow[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const separator = headerLine.includes(";") ? ";" : ",";
  const headers = headerLine.split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ""));

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ""));
    const row: any = {};
    headers.forEach((h, idx) => {
      const mapped = mapCsvHeader(h);
      if (mapped) row[mapped] = values[idx] || "";
    });
    if (row.nome) rows.push(row);
  }

  return rows;
}

function mapCsvHeader(header: string): string | null {
  const map: Record<string, string> = {
    "nome": "nome",
    "name": "nome",
    "email": "email",
    "e-mail": "email",
    "telefone": "telefone",
    "phone": "telefone",
    "celular": "telefone",
    "valor": "valor",
    "value": "valor",
    "estado": "estado",
    "status": "estado",
    "stage": "estado",
    "etapa": "estado",
    "data fechamento": "data_fechamento",
    "data_fechamento": "data_fechamento",
    "close date": "data_fechamento",
    "data operacao": "data_fechamento",
    "data_operacao": "data_fechamento",
    "data criação": "data_criacao",
    "data_criacao": "data_criacao",
    "data criacao": "data_criacao",
    "created at": "data_criacao",
    "created_at": "data_criacao",
  };
  return map[header] || null;
}

export interface GroupedContact {
  name: string;
  email: string | null;
  phone: string | null;
  totalAtendimentos: number;
  totalVendasGanhas: number;
  totalVendasPerdidas: number;
  totalValor: number;
  totalCompras: number;
  ultimaCompraDate: Date | null;
  estadoMaisRecente: string;
  dataCriacaoMaisAntiga: Date;
  lastActionDate: Date | null;
}

export function groupCsvByPerson(rows: CsvRow[]): GroupedContact[] {
  const groups = new Map<string, { rows: CsvRow[]; key: string }>();

  for (const row of rows) {
    // Dedupe priority: phone > email > nome
    const phoneKey = row.telefone ? row.telefone.replace(/\D/g, "") : "";
    const emailKey = row.email ? row.email.toLowerCase().trim() : "";
    const nameKey = (row.nome || "").toLowerCase().trim();

    let key = "";
    if (phoneKey.length >= 10) key = `phone:${phoneKey}`;
    else if (emailKey) key = `email:${emailKey}`;
    else if (nameKey) key = `name:${nameKey}`;
    else continue;

    if (!groups.has(key)) {
      groups.set(key, { rows: [], key });
    }
    groups.get(key)!.rows.push(row);
  }

  const contacts: GroupedContact[] = [];

  for (const group of Array.from(groups.values())) {
    const firstRow = group.rows[0];
    let totalAtendimentos = 0;
    let totalVendasGanhas = 0;
    let totalVendasPerdidas = 0;
    let totalValor = 0;
    let ultimaCompraDate: Date | null = null;
    let estadoMaisRecente = "";
    let lastActionDate: Date | null = null;
    let dataCriacaoMaisAntiga = new Date();
    let latestDate: Date | null = null;

    for (const row of group.rows) {
      totalAtendimentos++;
      const estado = normalizeEstado(row.estado || "");
      const valor = parseFloat((row.valor || "0").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
      const valorCents = Math.round(valor * 100);
      const fechamento = row.data_fechamento ? parseDate(row.data_fechamento) : null;
      const criacao = row.data_criacao ? parseDate(row.data_criacao) : new Date();

      if (criacao && criacao < dataCriacaoMaisAntiga) dataCriacaoMaisAntiga = criacao;

      if (estado === "vendido") {
        totalVendasGanhas++;
        totalValor += valorCents;
        if (fechamento && (!ultimaCompraDate || fechamento > ultimaCompraDate)) {
          ultimaCompraDate = fechamento;
        }
      } else if (estado === "perdido") {
        totalVendasPerdidas++;
      }

      const actionDate = fechamento || criacao;
      if (actionDate && (!lastActionDate || actionDate > lastActionDate)) {
        lastActionDate = actionDate;
      }

      if (!latestDate || (fechamento && fechamento > latestDate) || (criacao && criacao > latestDate)) {
        latestDate = fechamento || criacao;
        estadoMaisRecente = estado || estadoMaisRecente;
      }
    }

    contacts.push({
      name: firstRow.nome || "Sem nome",
      email: firstRow.email || null,
      phone: firstRow.telefone || null,
      totalAtendimentos,
      totalVendasGanhas,
      totalVendasPerdidas,
      totalValor,
      totalCompras: totalVendasGanhas,
      ultimaCompraDate,
      estadoMaisRecente,
      dataCriacaoMaisAntiga,
      lastActionDate,
    });
  }

  return contacts;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Try ISO format
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) return iso;
  // Try DD/MM/YYYY
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (a > 31) return new Date(a, b - 1, c); // YYYY-MM-DD
    if (c > 31) return new Date(c, b - 1, a); // DD/MM/YYYY
  }
  return null;
}

export async function importCsvAndRecalculate(tenantId: number, csvText: string, userId?: number) {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) throw new Error("CSV vazio ou sem dados válidos");

  const grouped = groupCsvByPerson(rows);
  let imported = 0;

  for (const contact of grouped) {
    const now = new Date();
    const diasDesdeUltimaCompra = contact.ultimaCompraDate
      ? Math.floor((now.getTime() - contact.ultimaCompraDate.getTime()) / (1000 * 60 * 60 * 24))
      : 9999;

    const taxaConversao = contact.totalAtendimentos > 0
      ? Math.round((contact.totalVendasGanhas / contact.totalAtendimentos) * 10000) / 100
      : 0;

    const audienceType = classifyContact({
      estadoMaisRecente: contact.estadoMaisRecente,
      totalCompras: contact.totalCompras,
      diasDesdeUltimaCompra,
      totalAtendimentos: contact.totalAtendimentos,
    });

    const rfvFlag = computeFlag({
      audienceType,
      totalVendasGanhas: contact.totalVendasGanhas,
      diasDesdeUltimaCompra,
      totalCompras: contact.totalCompras,
      createdAt: contact.dataCriacaoMaisAntiga,
    });

    await upsertRfvContact(tenantId, {
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      vScore: contact.totalValor,
      fScore: contact.totalCompras,
      rScore: diasDesdeUltimaCompra,
      totalAtendimentos: contact.totalAtendimentos,
      totalVendasGanhas: contact.totalVendasGanhas,
      totalVendasPerdidas: contact.totalVendasPerdidas,
      taxaConversao,
      lastPurchaseAt: contact.ultimaCompraDate,
      lastActionDate: contact.lastActionDate,
      audienceType,
      rfvFlag,
      createdBy: userId,
      createdAt: contact.dataCriacaoMaisAntiga,
    });

    imported++;
  }

  return { totalRows: rows.length, groupedContacts: grouped.length, imported };
}
