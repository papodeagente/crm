import { z } from "zod";
import { tenantProcedure, getTenantId, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  deals, pipelineStages, pipelines, lossReasons,
  contacts, accounts, crmUsers, teams, dealProducts, productCatalog,
} from "../../drizzle/schema";
import { eq, and, sql, isNull, gte, lt, isNotNull, like, inArray } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════
// SOURCES & CAMPAIGNS REPORT ROUTER
// Relatório estratégico de Fontes e Campanhas
// Visão por vendas, perdas e negociações ativas
// ═══════════════════════════════════════════════════════════════

const filterSchema = z.object({
  // Date range
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  // View mode
  viewMode: z.enum(["won", "lost", "open"]).default("won"),
  // UTM filters
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  // Standard Entur OS filters
  leadSource: z.string().optional(),
  campaignName: z.string().optional(),
  // Advanced filters
  pipelineId: z.number().optional(),
  stageId: z.number().optional(),
  ownerUserId: z.number().optional(),
  teamId: z.number().optional(),
  accountId: z.number().optional(),
  contactId: z.number().optional(),
  lossReasonId: z.number().optional(),
  productId: z.number().optional(),
  titleSearch: z.string().optional(),
  valueMin: z.number().optional(),
  valueMax: z.number().optional(),
  channelOrigin: z.string().optional(),
  // Qualification / probability
  probabilityMin: z.number().optional(),
  probabilityMax: z.number().optional(),
  // Activity dates
  lastActivityDateFrom: z.string().optional(),
  lastActivityDateTo: z.string().optional(),
  expectedCloseDateFrom: z.string().optional(),
  expectedCloseDateTo: z.string().optional(),
});

type FilterInput = z.infer<typeof filterSchema>;

function buildConditions(tenantId: number, input: FilterInput) {
  const conditions: any[] = [
    eq(deals.tenantId, tenantId),
    isNull(deals.deletedAt),
  ];

  // View mode (status filter)
  if (input.viewMode) {
    conditions.push(eq(deals.status, input.viewMode));
  }

  // Date range
  if (input.dateFrom) {
    conditions.push(gte(deals.createdAt, new Date(input.dateFrom)));
  }
  if (input.dateTo) {
    const endDate = new Date(input.dateTo);
    endDate.setDate(endDate.getDate() + 1);
    conditions.push(lt(deals.createdAt, endDate));
  }

  // UTM filters
  if (input.utmSource) conditions.push(eq(deals.utmSource, input.utmSource));
  if (input.utmMedium) conditions.push(eq(deals.utmMedium, input.utmMedium));
  if (input.utmCampaign) conditions.push(eq(deals.utmCampaign, input.utmCampaign));
  if (input.utmContent) conditions.push(eq(deals.utmContent, input.utmContent));
  if (input.utmTerm) conditions.push(eq(deals.utmTerm, input.utmTerm));

  // Standard Entur OS filters
  if (input.leadSource) conditions.push(eq(deals.leadSource, input.leadSource));
  if (input.campaignName) conditions.push(eq(deals.utmCampaign, input.campaignName));

  // Advanced filters
  if (input.pipelineId) conditions.push(eq(deals.pipelineId, input.pipelineId));
  if (input.stageId) conditions.push(eq(deals.stageId, input.stageId));
  if (input.ownerUserId) conditions.push(eq(deals.ownerUserId, input.ownerUserId));
  if (input.teamId) conditions.push(eq(deals.teamId, input.teamId));
  if (input.accountId) conditions.push(eq(deals.accountId, input.accountId));
  if (input.contactId) conditions.push(eq(deals.contactId, input.contactId));
  if (input.lossReasonId) conditions.push(eq(deals.lossReasonId, input.lossReasonId));
  if (input.channelOrigin) conditions.push(eq(deals.channelOrigin, input.channelOrigin));
  if (input.titleSearch) conditions.push(like(deals.title, `%${input.titleSearch}%`));

  // Value range
  if (input.valueMin !== undefined) conditions.push(gte(deals.valueCents, input.valueMin));
  if (input.valueMax !== undefined) conditions.push(lt(deals.valueCents, input.valueMax));

  // Probability range
  if (input.probabilityMin !== undefined) conditions.push(gte(deals.probability, input.probabilityMin));
  if (input.probabilityMax !== undefined) conditions.push(lt(deals.probability, input.probabilityMax + 1));

  // Activity date range
  if (input.lastActivityDateFrom) conditions.push(gte(deals.lastActivityAt, new Date(input.lastActivityDateFrom)));
  if (input.lastActivityDateTo) {
    const end = new Date(input.lastActivityDateTo);
    end.setDate(end.getDate() + 1);
    conditions.push(lt(deals.lastActivityAt, end));
  }

  // Expected close date range
  if (input.expectedCloseDateFrom) conditions.push(gte(deals.expectedCloseAt, new Date(input.expectedCloseDateFrom)));
  if (input.expectedCloseDateTo) {
    const end = new Date(input.expectedCloseDateTo);
    end.setDate(end.getDate() + 1);
    conditions.push(lt(deals.expectedCloseAt, end));
  }

  return conditions;
}

export const sourcesCampaignsRouter = router({

  // ─── KPIs Overview ───────────────────────────────────────
  overview: tenantProcedure
    .input(filterSchema)
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const tenantId = getTenantId(ctx);
      const conditions = buildConditions(tenantId, input);

      // Also get product filter via subquery if needed
      let dealIdsFromProduct: number[] | null = null;
      if (input.productId) {
        const productDeals = await db.select({ dealId: dealProducts.dealId })
          .from(dealProducts)
          .where(eq(dealProducts.productId, input.productId));
        dealIdsFromProduct = productDeals.map(r => r.dealId).filter(Boolean) as number[];
        if (dealIdsFromProduct.length === 0) {
          return { totalDeals: 0, totalValueCents: 0, avgValueCents: 0, avgTicket: 0 };
        }
        conditions.push(inArray(deals.id, dealIdsFromProduct));
      }

      const [result] = await db.select({
        totalDeals: sql<number>`COUNT(*)`,
        totalValueCents: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
        avgValueCents: sql<number>`COALESCE(AVG(${deals.valueCents}), 0)`,
      }).from(deals).where(and(...conditions));

      return {
        totalDeals: Number(result.totalDeals),
        totalValueCents: Number(result.totalValueCents),
        avgValueCents: Math.round(Number(result.avgValueCents)),
        avgTicket: Number(result.totalDeals) > 0
          ? Math.round(Number(result.totalValueCents) / Number(result.totalDeals))
          : 0,
      };
    }),

  // ─── By Source (grouped) ─────────────────────────────────
  bySources: tenantProcedure
    .input(filterSchema)
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const tenantId = getTenantId(ctx);
      const conditions = buildConditions(tenantId, input);

      if (input.productId) {
        const productDeals = await db.select({ dealId: dealProducts.dealId })
          .from(dealProducts)
          .where(eq(dealProducts.productId, input.productId));
        const ids = productDeals.map(r => r.dealId).filter(Boolean) as number[];
        if (ids.length === 0) return [];
        conditions.push(inArray(deals.id, ids));
      }

      // Group by leadSource (Entur OS standard source)
      const dimExpr = sql`COALESCE(${deals.leadSource}, '(não informado)')`;
      const rows = await db.select({
        source: sql<string>`${dimExpr}`.as("source"),
        count: sql<number>`COUNT(*)`,
        valueCents: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
        avgValueCents: sql<number>`COALESCE(AVG(${deals.valueCents}), 0)`,
      }).from(deals)
        .where(and(...conditions))
        .groupBy(dimExpr)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(50);

      const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
      return rows.map(r => ({
        source: String(r.source),
        count: Number(r.count),
        valueCents: Number(r.valueCents),
        avgValueCents: Math.round(Number(r.avgValueCents)),
        percentage: total > 0 ? Math.round((Number(r.count) / total) * 10000) / 100 : 0,
      }));
    }),

  // ─── By Campaign (grouped) ──────────────────────────────
  byCampaigns: tenantProcedure
    .input(filterSchema)
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const tenantId = getTenantId(ctx);
      const conditions = buildConditions(tenantId, input);

      if (input.productId) {
        const productDeals = await db.select({ dealId: dealProducts.dealId })
          .from(dealProducts)
          .where(eq(dealProducts.productId, input.productId));
        const ids = productDeals.map(r => r.dealId).filter(Boolean) as number[];
        if (ids.length === 0) return [];
        conditions.push(inArray(deals.id, ids));
      }

      // Group by utmCampaign
      const dimExpr = sql`COALESCE(${deals.utmCampaign}, '(não informado)')`;
      const rows = await db.select({
        campaign: sql<string>`${dimExpr}`.as("campaign"),
        count: sql<number>`COUNT(*)`,
        valueCents: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
        avgValueCents: sql<number>`COALESCE(AVG(${deals.valueCents}), 0)`,
      }).from(deals)
        .where(and(...conditions))
        .groupBy(dimExpr)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(50);

      const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
      return rows.map(r => ({
        campaign: String(r.campaign),
        count: Number(r.count),
        valueCents: Number(r.valueCents),
        avgValueCents: Math.round(Number(r.avgValueCents)),
        percentage: total > 0 ? Math.round((Number(r.count) / total) * 10000) / 100 : 0,
      }));
    }),

  // ─── By UTM Dimension (flexible) ────────────────────────
  byUtmDimension: tenantProcedure
    .input(filterSchema.extend({
      dimension: z.enum(["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm"]),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const tenantId = getTenantId(ctx);
      const conditions = buildConditions(tenantId, input);

      if (input.productId) {
        const productDeals = await db.select({ dealId: dealProducts.dealId })
          .from(dealProducts)
          .where(eq(dealProducts.productId, input.productId));
        const ids = productDeals.map(r => r.dealId).filter(Boolean) as number[];
        if (ids.length === 0) return [];
        conditions.push(inArray(deals.id, ids));
      }

      const dimCol = {
        utmSource: deals.utmSource,
        utmMedium: deals.utmMedium,
        utmCampaign: deals.utmCampaign,
        utmContent: deals.utmContent,
        utmTerm: deals.utmTerm,
      }[input.dimension];

      const dimExpr = sql`COALESCE(${dimCol}, '(não informado)')`;
      const rows = await db.select({
        dimension: sql<string>`${dimExpr}`.as("dimension"),
        count: sql<number>`COUNT(*)`,
        valueCents: sql<number>`COALESCE(SUM(${deals.valueCents}), 0)`,
        avgValueCents: sql<number>`COALESCE(AVG(${deals.valueCents}), 0)`,
      }).from(deals)
        .where(and(...conditions))
        .groupBy(dimExpr)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(50);

      const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
      return rows.map(r => ({
        dimension: String(r.dimension),
        count: Number(r.count),
        valueCents: Number(r.valueCents),
        avgValueCents: Math.round(Number(r.avgValueCents)),
        percentage: total > 0 ? Math.round((Number(r.count) / total) * 10000) / 100 : 0,
      }));
    }),

  // ─── Deal List (detailed table) ──────────────────────────
  dealList: tenantProcedure
    .input(filterSchema.extend({
      page: z.number().default(1),
      limit: z.number().default(50),
      sortBy: z.enum(["createdAt", "valueCents", "title"]).default("createdAt"),
      sortDir: z.enum(["asc", "desc"]).default("desc"),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { deals: [], total: 0 };
      const tenantId = getTenantId(ctx);
      const conditions = buildConditions(tenantId, input);

      if (input.productId) {
        const productDeals = await db.select({ dealId: dealProducts.dealId })
          .from(dealProducts)
          .where(eq(dealProducts.productId, input.productId));
        const ids = productDeals.map(r => r.dealId).filter(Boolean) as number[];
        if (ids.length === 0) return { deals: [], total: 0 };
        conditions.push(inArray(deals.id, ids));
      }

      const whereClause = and(...conditions);

      // Count
      const [countResult] = await db.select({ total: sql<number>`COUNT(*)` })
        .from(deals).where(whereClause);
      const total = Number(countResult.total);

      // Sort
      const sortCol = {
        createdAt: deals.createdAt,
        valueCents: deals.valueCents,
        title: deals.title,
      }[input.sortBy];
      const orderExpr = input.sortDir === "asc" ? sql`${sortCol} ASC` : sql`${sortCol} DESC`;

      // Fetch
      const rows = await db.select({
        id: deals.id,
        title: deals.title,
        valueCents: deals.valueCents,
        status: deals.status,
        leadSource: deals.leadSource,
        utmSource: deals.utmSource,
        utmMedium: deals.utmMedium,
        utmCampaign: deals.utmCampaign,
        utmContent: deals.utmContent,
        utmTerm: deals.utmTerm,
        channelOrigin: deals.channelOrigin,
        contactName: contacts.name,
        accountName: accounts.name,
        ownerName: crmUsers.name,
        stageName: pipelineStages.name,
        pipelineName: pipelines.name,
        createdAt: deals.createdAt,
        lossReasonName: lossReasons.name,
      }).from(deals)
        .leftJoin(contacts, eq(deals.contactId, contacts.id))
        .leftJoin(accounts, eq(deals.accountId, accounts.id))
        .leftJoin(crmUsers, eq(deals.ownerUserId, crmUsers.id))
        .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
        .leftJoin(pipelines, eq(deals.pipelineId, pipelines.id))
        .leftJoin(lossReasons, eq(deals.lossReasonId, lossReasons.id))
        .where(whereClause)
        .orderBy(orderExpr)
        .limit(input.limit)
        .offset((input.page - 1) * input.limit);

      return {
        deals: rows.map(r => ({
          id: r.id,
          title: r.title,
          valueCents: Number(r.valueCents || 0),
          status: r.status,
          leadSource: r.leadSource,
          utmSource: r.utmSource,
          utmMedium: r.utmMedium,
          utmCampaign: r.utmCampaign,
          utmContent: r.utmContent,
          utmTerm: r.utmTerm,
          channelOrigin: r.channelOrigin,
          contactName: r.contactName,
          accountName: r.accountName,
          ownerName: r.ownerName,
          stageName: r.stageName,
          pipelineName: r.pipelineName,
          createdAt: r.createdAt,
          lossReasonName: r.lossReasonName,
        })),
        total,
      };
    }),

  // ─── Filter Options (for dropdowns) ─────────────────────
  filterOptions: tenantProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return {
        utmSources: [], utmMediums: [], utmCampaigns: [], utmContents: [], utmTerms: [],
        leadSources: [], channels: [], pipelines: [], stages: [], owners: [],
        teams: [], accounts: [], lossReasons: [],
      };
      const tenantId = getTenantId(ctx);
      const base = [eq(deals.tenantId, tenantId), isNull(deals.deletedAt)];

      const [
        utmSources, utmMediums, utmCampaigns, utmContents, utmTerms,
        leadSourcesData, channelsData,
        pipelinesData, stagesData, ownersData, teamsData, accountsData, lossReasonsData,
      ] = await Promise.all([
        db.selectDistinct({ v: deals.utmSource }).from(deals)
          .where(and(...base, isNotNull(deals.utmSource), sql`${deals.utmSource} != '' AND ${deals.utmSource} != 'unknown'`)),
        db.selectDistinct({ v: deals.utmMedium }).from(deals)
          .where(and(...base, isNotNull(deals.utmMedium), sql`${deals.utmMedium} != '' AND ${deals.utmMedium} != 'unknown'`)),
        db.selectDistinct({ v: deals.utmCampaign }).from(deals)
          .where(and(...base, isNotNull(deals.utmCampaign), sql`${deals.utmCampaign} != '' AND ${deals.utmCampaign} != 'unknown'`)),
        db.selectDistinct({ v: deals.utmContent }).from(deals)
          .where(and(...base, isNotNull(deals.utmContent), sql`${deals.utmContent} != ''`)),
        db.selectDistinct({ v: deals.utmTerm }).from(deals)
          .where(and(...base, isNotNull(deals.utmTerm), sql`${deals.utmTerm} != ''`)),
        db.selectDistinct({ v: deals.leadSource }).from(deals)
          .where(and(...base, isNotNull(deals.leadSource), sql`${deals.leadSource} != ''`)),
        db.selectDistinct({ v: deals.channelOrigin }).from(deals)
          .where(and(...base, isNotNull(deals.channelOrigin), sql`${deals.channelOrigin} != ''`)),
        db.select({ id: pipelines.id, name: pipelines.name }).from(pipelines)
          .where(eq(pipelines.tenantId, tenantId)),
        db.select({ id: pipelineStages.id, name: pipelineStages.name, pipelineId: pipelineStages.pipelineId })
          .from(pipelineStages)
          .where(eq(pipelineStages.tenantId, tenantId)),
        db.select({ id: crmUsers.id, name: crmUsers.name }).from(crmUsers)
          .where(and(eq(crmUsers.tenantId, tenantId), eq(crmUsers.status, "active"))),
        db.select({ id: teams.id, name: teams.name }).from(teams)
          .where(eq(teams.tenantId, tenantId)),
        db.select({ id: accounts.id, name: accounts.name }).from(accounts)
          .where(eq(accounts.tenantId, tenantId)),
        db.select({ id: lossReasons.id, name: lossReasons.name }).from(lossReasons)
          .where(and(eq(lossReasons.tenantId, tenantId), eq(lossReasons.isActive, true))),
      ]);

      return {
        utmSources: utmSources.map(r => r.v).filter(Boolean) as string[],
        utmMediums: utmMediums.map(r => r.v).filter(Boolean) as string[],
        utmCampaigns: utmCampaigns.map(r => r.v).filter(Boolean) as string[],
        utmContents: utmContents.map(r => r.v).filter(Boolean) as string[],
        utmTerms: utmTerms.map(r => r.v).filter(Boolean) as string[],
        leadSources: leadSourcesData.map(r => r.v).filter(Boolean) as string[],
        channels: channelsData.map(r => r.v).filter(Boolean) as string[],
        pipelines: pipelinesData,
        stages: stagesData,
        owners: ownersData,
        teams: teamsData,
        accounts: accountsData,
        lossReasons: lossReasonsData,
      };
    }),
});
