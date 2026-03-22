/**
 * Goals Analytics — Backend helpers for the Goals Report page.
 * Queries goals + deals data and provides AI-powered commercial analysis.
 * Does NOT modify any existing module.
 */
import { getDb } from "./db";
import { sql, eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { goals, deals, dealProducts, crmUsers } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";

// ─── Types ───────────────────────────────────────────────────

export interface GoalWithProgress {
  id: number;
  name: string | null;
  scope: "user" | "company";
  metricKey: string;
  targetValue: number;
  currentValue: number;
  progressPct: number;
  periodStart: Date;
  periodEnd: Date;
  userId: number | null;
  userName?: string;
  daysRemaining: number;
  daysElapsed: number;
  totalDays: number;
  expectedProgressPct: number; // what % should be done by now (linear)
  status: "ahead" | "on_track" | "behind" | "critical" | "completed";
}

export interface GoalsReportData {
  goals: GoalWithProgress[];
  overallProgress: number; // weighted average
  goalsAhead: number;
  goalsOnTrack: number;
  goalsBehind: number;
  goalsCritical: number;
  goalsCompleted: number;
  // Aggregated deal metrics for the current month
  dealMetrics: {
    totalDeals: number;
    wonDeals: number;
    lostDeals: number;
    openDeals: number;
    totalValueCents: number;
    wonValueCents: number;
    avgTicketCents: number;
    conversionRate: number;
  };
  // Top products sold this month
  topProducts: Array<{
    name: string;
    category: string;
    quantity: number;
    totalValueCents: number;
  }>;
}

export interface AIGoalsAnalysis {
  overallAssessment: string;
  performanceVerdict: "above" | "on_track" | "below" | "critical";
  expectedSalesText: string;
  actionPlan: string;
  requiredDeals: number;
  requiredValueCents: number;
  recommendedProducts: string[];
  commercialGuidelines: string[];
  urgencyLevel: "low" | "medium" | "high" | "critical";
}

// ─── Helpers ─────────────────────────────────────────────────

function getGoalStatus(progressPct: number, expectedPct: number): GoalWithProgress["status"] {
  if (progressPct >= 100) return "completed";
  if (expectedPct === 0) return "on_track";
  const ratio = progressPct / expectedPct;
  if (ratio >= 1.1) return "ahead";
  if (ratio >= 0.8) return "on_track";
  if (ratio >= 0.5) return "behind";
  return "critical";
}

// ─── Main Functions ──────────────────────────────────────────

export async function getGoalsReport(tenantId: number): Promise<GoalsReportData> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const now = new Date();

  // 1. Fetch active goals (period includes today)
  const activeGoals = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.tenantId, tenantId),
        lte(goals.periodStart, now),
        gte(goals.periodEnd, now)
      )
    )
    .orderBy(desc(goals.createdAt));

  // 2. Get user names for goals with userId
  const userIdsSet = new Set<number>();
  for (const g of activeGoals) {
    if (g.userId) userIdsSet.add(g.userId);
  }
  const userIds: number[] = [];
  userIdsSet.forEach(id => userIds.push(id));
  let usersMap: Record<number, string> = {};
  if (userIds.length > 0) {
    const users = await db.select({ id: crmUsers.id, name: crmUsers.name }).from(crmUsers)
      .where(and(inArray(crmUsers.id, userIds as number[]), eq(crmUsers.tenantId, tenantId)));
    usersMap = Object.fromEntries(users.map((u: any) => [u.id, u.name]));
  }

  // 3. Calculate progress for each goal using raw SQL (same logic as crmDb)
  const goalsWithProgress: GoalWithProgress[] = [];
  for (const goal of activeGoals) {
    const periodStart = new Date(goal.periodStart);
    const periodEnd = new Date(goal.periodEnd);
    const totalDays = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
    const daysElapsed = Math.max(0, Math.ceil((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const expectedProgressPct = Math.min(100, (daysElapsed / totalDays) * 100);

    let currentValue = 0;
    try {
      const baseConds = [
        `d.tenantId = ${Number(tenantId)}`,
        `d.deletedAt IS NULL`,
        `d.createdAt >= '${periodStart.toISOString().slice(0, 19).replace('T', ' ')}'`,
        `d.createdAt <= '${periodEnd.toISOString().slice(0, 19).replace('T', ' ')}'`,
      ];
      if (goal.scope === 'user' && goal.userId) {
        baseConds.push(`d.ownerUserId = ${Number(goal.userId)}`);
      }
      const whereClause = baseConds.join(' AND ');

      if (goal.metricKey === 'total_sold') {
        const [rows] = await db.execute(
          sql`SELECT COALESCE(SUM(d.valueCents), 0) as total FROM deals d WHERE ${sql.raw(whereClause)} AND d.status = 'won'`
        );
        currentValue = Number((rows as any)[0]?.total ?? 0);
      } else if (goal.metricKey === 'deals_count') {
        const [rows] = await db.execute(
          sql`SELECT COUNT(*) as total FROM deals d WHERE ${sql.raw(whereClause)}`
        );
        currentValue = Number((rows as any)[0]?.total ?? 0);
      } else if (goal.metricKey === 'conversion_rate') {
        const [rows] = await db.execute(
          sql`SELECT COUNT(*) as total, SUM(CASE WHEN d.status = 'won' THEN 1 ELSE 0 END) as won FROM deals d WHERE ${sql.raw(whereClause)}`
        );
        const total = Number((rows as any)[0]?.total ?? 0);
        const won = Number((rows as any)[0]?.won ?? 0);
        currentValue = total === 0 ? 0 : Math.round((won / total) * 100 * 10) / 10;
      }
    } catch (err) {
      console.error('[goalsAnalytics] Error calculating progress:', err);
    }

    const targetValue = Number(goal.targetValue ?? 0);
    const progressPct = targetValue > 0 ? Math.min(200, (currentValue / targetValue) * 100) : 0;

    goalsWithProgress.push({
      id: goal.id,
      name: goal.name,
      scope: goal.scope,
      metricKey: goal.metricKey,
      targetValue,
      currentValue,
      progressPct: Math.round(progressPct * 10) / 10,
      periodStart,
      periodEnd,
      userId: goal.userId,
      userName: goal.userId ? usersMap[goal.userId] : undefined,
      daysRemaining,
      daysElapsed,
      totalDays,
      expectedProgressPct: Math.round(expectedProgressPct * 10) / 10,
      status: getGoalStatus(progressPct, expectedProgressPct),
    });
  }

  // 4. Deal metrics for the current month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const mStart = monthStart.toISOString().slice(0, 19).replace('T', ' ');
  const mEnd = monthEnd.toISOString().slice(0, 19).replace('T', ' ');

  const [dealRows] = await db.execute(sql`
    SELECT 
      COUNT(*) as totalDeals,
      SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wonDeals,
      SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lostDeals,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as openDeals,
      COALESCE(SUM(valueCents), 0) as totalValueCents,
      COALESCE(SUM(CASE WHEN status = 'won' THEN valueCents ELSE 0 END), 0) as wonValueCents
    FROM deals
    WHERE tenantId = ${tenantId}
      AND deletedAt IS NULL
      AND createdAt >= ${sql.raw(`'${mStart}'`)}
      AND createdAt <= ${sql.raw(`'${mEnd}'`)}
  `);
  const dm = (dealRows as any)[0] || {};
  const totalDeals = Number(dm.totalDeals ?? 0);
  const wonDeals = Number(dm.wonDeals ?? 0);
  const wonValueCents = Number(dm.wonValueCents ?? 0);
  const dealMetrics = {
    totalDeals,
    wonDeals,
    lostDeals: Number(dm.lostDeals ?? 0),
    openDeals: Number(dm.openDeals ?? 0),
    totalValueCents: Number(dm.totalValueCents ?? 0),
    wonValueCents,
    avgTicketCents: wonDeals > 0 ? Math.round(wonValueCents / wonDeals) : 0,
    conversionRate: totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100 * 10) / 10 : 0,
  };

  // 5. Top products sold this month
  const [prodRows] = await db.execute(sql`
    SELECT 
      dp.name,
      dp.category,
      SUM(dp.quantity) as qty,
      SUM(dp.finalPriceCents) as totalValue
    FROM deal_products dp
    JOIN deals d ON dp.dealId = d.id AND dp.tenantId = d.tenantId
    WHERE dp.tenantId = ${tenantId}
      AND d.status = 'won'
      AND d.deletedAt IS NULL
      AND d.createdAt >= ${sql.raw(`'${mStart}'`)}
      AND d.createdAt <= ${sql.raw(`'${mEnd}'`)}
    GROUP BY dp.name, dp.category
    ORDER BY totalValue DESC
    LIMIT 5
  `);
  const topProducts = (prodRows as unknown as any[]).map((r: any) => ({
    name: r.name,
    category: r.category,
    quantity: Number(r.qty ?? 0),
    totalValueCents: Number(r.totalValue ?? 0),
  }));

  // 6. Aggregate status counts
  const goalsCompleted = goalsWithProgress.filter(g => g.status === "completed").length;
  const goalsAhead = goalsWithProgress.filter(g => g.status === "ahead").length;
  const goalsOnTrack = goalsWithProgress.filter(g => g.status === "on_track").length;
  const goalsBehind = goalsWithProgress.filter(g => g.status === "behind").length;
  const goalsCritical = goalsWithProgress.filter(g => g.status === "critical").length;

  const overallProgress = goalsWithProgress.length > 0
    ? Math.round(goalsWithProgress.reduce((sum, g) => sum + g.progressPct, 0) / goalsWithProgress.length * 10) / 10
    : 0;

  return {
    goals: goalsWithProgress,
    overallProgress,
    goalsAhead,
    goalsOnTrack,
    goalsBehind,
    goalsCritical,
    goalsCompleted,
    dealMetrics,
    topProducts,
  };
}

// ─── AI Analysis ─────────────────────────────────────────────

export async function generateGoalsAIAnalysis(
  tenantId: number,
  reportData: GoalsReportData
): Promise<AIGoalsAnalysis> {
  const { goals: goalsList, dealMetrics, topProducts } = reportData;

  // Build context for the LLM
  const goalsContext = goalsList.map(g => {
    const metricLabel = g.metricKey === 'total_sold' ? 'Valor vendido (R$)'
      : g.metricKey === 'deals_count' ? 'Qtd negociações'
      : 'Taxa de conversão (%)';
    const currentFormatted = g.metricKey === 'total_sold'
      ? `R$ ${(g.currentValue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : g.metricKey === 'conversion_rate'
        ? `${g.currentValue}%`
        : String(g.currentValue);
    const targetFormatted = g.metricKey === 'total_sold'
      ? `R$ ${(g.targetValue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : g.metricKey === 'conversion_rate'
        ? `${g.targetValue}%`
        : String(g.targetValue);
    return `- ${g.name || metricLabel}${g.userName ? ` (${g.userName})` : ''}: ${currentFormatted} de ${targetFormatted} (${g.progressPct.toFixed(1)}% realizado, esperado ${g.expectedProgressPct.toFixed(1)}%) — ${g.daysRemaining} dias restantes — Status: ${g.status}`;
  }).join('\n');

  const productsContext = topProducts.length > 0
    ? topProducts.map(p => `- ${p.name} (${p.category}): ${p.quantity} vendidos, R$ ${(p.totalValueCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join('\n')
    : '- Nenhum produto vendido no período';

  const systemPrompt = `Você é um gestor sênior comercial de uma agência de turismo com 20 anos de experiência. 
Analise os dados de metas e performance comercial abaixo e gere uma análise estratégica completa.

Seu papel é:
1. Avaliar se a operação está acima ou abaixo do previsto para o período
2. Calcular quantas negociações precisam ser geradas com base no ticket médio e taxa de conversão atuais
3. Recomendar produtos específicos a serem vendidos (com base nos dados de produtos)
4. Dar orientações comerciais assertivas e práticas como um gestor sênior faria em uma reunião de resultados

IMPORTANTE: 
- Seja direto, prático e assertivo
- Use dados concretos nos cálculos
- Responda EXCLUSIVAMENTE em português brasileiro
- Forneça números específicos (não arredonde demais)
- O tom deve ser de um líder comercial experiente: motivador quando está bem, firme quando está mal`;

  const userPrompt = `## Métricas do Mês Atual
- Total de negociações: ${dealMetrics.totalDeals}
- Negociações ganhas: ${dealMetrics.wonDeals}
- Negociações perdidas: ${dealMetrics.lostDeals}
- Em andamento: ${dealMetrics.openDeals}
- Valor total vendido: R$ ${(dealMetrics.wonValueCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Ticket médio: R$ ${(dealMetrics.avgTicketCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Taxa de conversão: ${dealMetrics.conversionRate}%

## Metas Ativas
${goalsContext || '- Nenhuma meta ativa no período'}

## Produtos Mais Vendidos no Mês
${productsContext}

## Progresso Geral
- Progresso médio das metas: ${reportData.overallProgress.toFixed(1)}%
- Metas concluídas: ${reportData.goalsCompleted}
- Acima do previsto: ${reportData.goalsAhead}
- No ritmo: ${reportData.goalsOnTrack}
- Abaixo: ${reportData.goalsBehind}
- Críticas: ${reportData.goalsCritical}

Gere a análise estratégica completa conforme o schema JSON.`;

  try {
    const llmResponse = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "goals_ai_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              overallAssessment: {
                type: "string",
                description: "Avaliação geral da performance (3-5 parágrafos). Inclua análise do ritmo atual vs esperado, projeção de fechamento, e diagnóstico claro.",
              },
              performanceVerdict: {
                type: "string",
                enum: ["above", "on_track", "below", "critical"],
                description: "Veredicto: acima, no ritmo, abaixo ou crítico",
              },
              expectedSalesText: {
                type: "string",
                description: "Texto explicando quanto deveria ter sido vendido até agora e quanto falta, com números específicos",
              },
              actionPlan: {
                type: "string",
                description: "Plano de ação detalhado (3-5 parágrafos) com passos concretos para atingir as metas. Inclua quantas negociações precisam ser geradas, valor necessário, e timeline.",
              },
              requiredDeals: {
                type: "integer",
                description: "Número de negociações que precisam ser geradas para atingir a meta, considerando a taxa de conversão atual",
              },
              requiredValueCents: {
                type: "integer",
                description: "Valor em centavos que ainda precisa ser vendido para atingir as metas de valor",
              },
              recommendedProducts: {
                type: "array",
                items: { type: "string" },
                description: "Lista de 3-5 recomendações de produtos/serviços a serem vendidos, com justificativa breve",
              },
              commercialGuidelines: {
                type: "array",
                items: { type: "string" },
                description: "Lista de 5-7 orientações comerciais assertivas e práticas de um gestor sênior",
              },
              urgencyLevel: {
                type: "string",
                enum: ["low", "medium", "high", "critical"],
                description: "Nível de urgência das ações recomendadas",
              },
            },
            required: [
              "overallAssessment", "performanceVerdict", "expectedSalesText",
              "actionPlan", "requiredDeals", "requiredValueCents",
              "recommendedProducts", "commercialGuidelines", "urgencyLevel",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = llmResponse.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("LLM retornou resposta vazia");
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    return JSON.parse(content) as AIGoalsAnalysis;
  } catch (err: any) {
    console.error("[goalsAnalytics] AI Analysis error:", err.message);
    throw new Error(`Erro ao gerar análise IA: ${err.message}`);
  }
}
