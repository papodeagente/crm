/**
 * ProductReports — Dashboard comercial sênior de produtos.
 *
 * Foco: ajudar o gestor a decidir onde investir esforço — qual produto
 * traz mais receita, qual gera mais lucro absoluto, qual tem a melhor
 * margem, qual está sendo perdido. Cada bloco vem com benchmark e
 * diagnóstico narrativo no final.
 *
 * Fonte: getProductCommercialSummary + getProductCommercialRanking
 * (correlaciona deal_products com product_catalog para custo).
 */
import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, DollarSign, TrendingUp, Target, Coins, Loader2,
  Award, Sparkles, AlertTriangle, Trophy, Package, BarChart3,
} from "lucide-react";
import DateRangeFilter, { useDateFilter } from "@/components/DateRangeFilter";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function formatCompact(cents: number): string {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
  return formatCurrency(cents);
}
function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n);
}

// Benchmarks de mercado para clínica de estética:
//  - Margem saudável: ≥40% (procedimentos premium); aceitável 25–40%; alerta <25%.
//  - Conversão saudável: ≥50% pós-consulta; mediano 30–50%; baixo <30%.
function diagnoseMargin(rate: number): { tone: "ok" | "warn" | "alert"; label: string } {
  if (rate >= 40) return { tone: "ok", label: "Saudável" };
  if (rate >= 25) return { tone: "warn", label: "Aceitável" };
  return { tone: "alert", label: "Alerta" };
}
function diagnoseConversion(rate: number, decided: number): { tone: "ok" | "warn" | "alert"; label: string } {
  if (decided === 0) return { tone: "warn", label: "Sem dados" };
  if (rate >= 50) return { tone: "ok", label: "Saudável" };
  if (rate >= 30) return { tone: "warn", label: "Mediano" };
  return { tone: "alert", label: "Baixo" };
}

function ToneBadge({ tone, children }: { tone: "ok" | "warn" | "alert"; children: React.ReactNode }) {
  const cls = tone === "ok"
    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
    : tone === "warn"
    ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
    : "bg-red-500/10 text-red-500 border-red-500/30";
  return <Badge variant="outline" className={`text-[10px] font-semibold ${cls}`}>{children}</Badge>;
}

interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  badge?: { tone: "ok" | "warn" | "alert"; label: string };
}
function KpiCard({ label, value, subtitle, icon: Icon, color, bg, badge }: KpiCardProps) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${bg}`}>
            <Icon className={`h-4.5 w-4.5 ${color}`} />
          </div>
          {badge && <ToneBadge tone={badge.tone}>{badge.label}</ToneBadge>}
        </div>
        <p className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-[26px] font-extrabold text-foreground leading-tight mt-1">{value}</p>
        {subtitle && <p className="text-[11.5px] text-muted-foreground mt-1.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

interface RankingRowItem {
  productId: number | null;
  name: string;
  value: number;
  suffix?: string;
  formatter: (v: number) => string;
}
function MiniRanking({ title, icon: Icon, accent, items, emptyText }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  items: RankingRowItem[];
  emptyText: string;
}) {
  return (
    <Card className="border-border/50 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${accent}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-[11.5px] text-muted-foreground py-3 text-center">{emptyText}</p>
        ) : (
          <ol className="space-y-1.5">
            {items.map((it, idx) => (
              <li key={`${it.productId ?? "x"}-${idx}`} className="flex items-center gap-2 text-[12.5px]">
                <span className="w-4 text-[10.5px] text-muted-foreground tabular-nums">{idx + 1}.</span>
                <span className="flex-1 truncate font-medium" title={it.name}>{it.name}</span>
                <span className="font-semibold tabular-nums shrink-0">
                  {it.formatter(it.value)}
                  {it.suffix && <span className="text-muted-foreground ml-0.5">{it.suffix}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProductReports() {
  const [, navigate] = useLocation();
  const dateFilter = useDateFilter("last3months");

  const filterInput = useMemo(() => ({
    dateFrom: dateFilter.dates.dateFrom,
    dateTo: dateFilter.dates.dateTo,
  }), [dateFilter.dates]);

  const summaryQ = trpc.productCatalog.analytics.commercialSummary.useQuery(filterInput);
  const rankingQ = trpc.productCatalog.analytics.commercialRanking.useQuery({ ...filterInput, limit: 50 });

  const m = summaryQ.data;
  const ranking = rankingQ.data || [];

  // Top 5 rankings derivados do ranking master
  const topRevenue = useMemo(() =>
    [...ranking].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 5)
  , [ranking]);
  const topProfit = useMemo(() =>
    [...ranking].filter(r => r.profitCents > 0).sort((a, b) => b.profitCents - a.profitCents).slice(0, 5)
  , [ranking]);
  const topVolume = useMemo(() =>
    [...ranking].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5)
  , [ranking]);
  const topMargin = useMemo(() =>
    [...ranking]
      .filter(r => r.dealsCount >= 2 && r.revenueCents > 0)  // exige volume mínimo pra margem ser confiável
      .sort((a, b) => b.marginPercent - a.marginPercent)
      .slice(0, 5)
  , [ranking]);

  const marginDx = m ? diagnoseMargin(m.marginPercent) : null;

  // Diagnóstico narrativo dinâmico
  const narrative = useMemo(() => {
    if (!m) return [];
    const lines: string[] = [];
    if (m.dealsWithProducts === 0) {
      lines.push("Nenhuma venda registrada no período. Antes de avaliar produtos, é preciso ter movimento — confirme se há negociações marcadas como ganhas.");
      return lines;
    }
    lines.push(
      `No período selecionado, **${m.dealsWithProducts} negociações** foram fechadas com produtos vinculados, gerando **${formatCompact(m.totalRevenueCents)}** em receita e **${formatCompact(m.totalProfitCents)}** em lucro bruto (margem média de **${m.marginPercent}%**${marginDx ? ` — ${marginDx.label.toLowerCase()}` : ""}).`,
    );

    if (topRevenue.length > 0 && topProfit.length > 0) {
      const cashCow = topRevenue[0];
      const profitKing = topProfit[0];
      if (cashCow.productId === profitKing.productId) {
        lines.push(
          `**${cashCow.name}** é simultaneamente o maior gerador de receita (${formatCompact(cashCow.revenueCents)}) e de lucro (${formatCompact(cashCow.profitCents)}, margem ${cashCow.marginPercent}%) — produto âncora do mix. Mantenha estoque, treinamento e comunicação focados nele.`,
        );
      } else {
        lines.push(
          `O carro-chefe em receita é **${cashCow.name}** (${formatCompact(cashCow.revenueCents)}, margem ${cashCow.marginPercent}%), mas quem mais entrega lucro em reais é **${profitKing.name}** (${formatCompact(profitKing.profitCents)}, margem ${profitKing.marginPercent}%). Volume nem sempre é lucratividade — vale priorizar comunicação para os dois lados conforme o objetivo do mês.`,
        );
      }
    }

    if (topMargin.length > 0) {
      const best = topMargin[0];
      lines.push(
        `Maior margem percentual: **${best.name}** com ${best.marginPercent}% (lucro de ${formatCompact(best.profitCents)} em ${best.wonDeals} venda(s)). Produto candidato a campanha — cada deal aqui rende mais por R$ investido.`,
      );
    }

    // Diagnóstico de conversão (produtos populares mas que perdem muito)
    const lowConvHighDemand = ranking.filter(r => r.dealsCount >= 3 && r.conversionRate > 0 && r.conversionRate < 30);
    if (lowConvHighDemand.length > 0) {
      const worst = [...lowConvHighDemand].sort((a, b) => a.conversionRate - b.conversionRate)[0];
      lines.push(
        `Atenção: **${worst.name}** aparece em ${worst.dealsCount} negociações mas só fecha em ${worst.conversionRate}% delas (${worst.lostDeals} perdas). Revisar abordagem comercial, preço ou qualificação de leads pra esse produto.`,
      );
    }

    // Margem negativa
    const negative = ranking.filter(r => r.profitCents < 0 && r.wonDeals > 0);
    if (negative.length > 0) {
      const names = negative.slice(0, 3).map(n => n.name).join(", ");
      lines.push(
        `**Crítico:** ${negative.length} produto(s) está(ão) sendo vendido(s) abaixo do custo (${names}${negative.length > 3 ? " e outros" : ""}). Cada venda dessas é prejuízo — corrigir cadastro de custo ou repreçar imediatamente.`,
      );
    }

    return lines;
  }, [m, topRevenue, topProfit, topMargin, ranking, marginDx]);

  // Recomendações dinâmicas
  const recommendations = useMemo(() => {
    if (!m || m.dealsWithProducts === 0) return [];
    const recs: string[] = [];

    if (m.marginPercent < 25) {
      recs.push("Margem média abaixo de 25% — auditar custos no catálogo e repreçar produtos mais sensíveis. Estética premium deveria operar acima de 35%.");
    }
    const noCost = ranking.filter(r => r.wonDeals > 0 && r.costCents === 0);
    if (noCost.length >= 3) {
      recs.push(`${noCost.length} produto(s) vendido(s) sem custo cadastrado — sem isso, margem vira chute. Edite o produto e preencha o custo (ou custo por mL).`);
    }
    const lossLeaders = [...ranking].filter(r => r.lostDeals >= 3 && r.lostDeals > r.wonDeals);
    if (lossLeaders.length > 0) {
      const top = lossLeaders[0];
      recs.push(`Produto **${top.name}** está sendo recusado mais do que aceito (${top.lostDeals} perdas vs ${top.wonDeals} ganhos). Avaliar motivos de perda no relatório comercial.`);
    }
    const highMarginLowVolume = topMargin.filter(r => r.unitsSold < 5);
    if (highMarginLowVolume.length > 0) {
      const top = highMarginLowVolume[0];
      recs.push(`**${top.name}** tem margem excelente (${top.marginPercent}%) mas pouco volume (${top.unitsSold} ${top.unitOfMeasure || "un"}). Faça campanha — cada incremento aqui é altamente rentável.`);
    }
    if (recs.length === 0) {
      recs.push("Mix de produtos saudável. Próximo passo natural: definir metas mensais por produto top (receita e volume) e medir variação MoM.");
    }
    return recs;
  }, [m, ranking, topMargin]);

  const isLoading = summaryQ.isLoading || rankingQ.isLoading;

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate("/analytics")}
            className="h-9 w-9 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight">Análise comercial de produtos</h1>
            <p className="text-[13px] text-muted-foreground">
              Onde a clínica gera receita, lucro e margem — por produto, com diagnóstico de gestor sênior.
            </p>
          </div>
        </div>
        <DateRangeFilter
          compact
          preset={dateFilter.preset}
          onPresetChange={dateFilter.setPreset}
          customFrom={dateFilter.customFrom}
          onCustomFromChange={dateFilter.setCustomFrom}
          customTo={dateFilter.customTo}
          onCustomToChange={dateFilter.setCustomTo}
          onReset={dateFilter.reset}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !m ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Sem dados.</CardContent></Card>
      ) : (
        <>
          {/* Executive summary — 4 cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Receita"
              value={formatCompact(m.totalRevenueCents)}
              subtitle={`${m.dealsWithProducts} ${m.dealsWithProducts === 1 ? "negociação" : "negociações"} fechadas`}
              icon={DollarSign}
              color="text-emerald-500"
              bg="bg-emerald-500/10"
            />
            <KpiCard
              label="Lucro bruto"
              value={formatCompact(m.totalProfitCents)}
              subtitle={`Receita − custo dos produtos vendidos`}
              icon={Coins}
              color="text-blue-500"
              bg="bg-blue-500/10"
            />
            <KpiCard
              label="Margem média"
              value={`${m.marginPercent}%`}
              subtitle="Lucro ÷ receita (ponderada)"
              icon={TrendingUp}
              color="text-violet-500"
              bg="bg-violet-500/10"
              badge={marginDx || undefined}
            />
            <KpiCard
              label="Ticket médio"
              value={formatCompact(m.avgTicketCents)}
              subtitle={`${formatNumber(m.totalUnitsSold)} ${m.totalUnitsSold === 1 ? "unidade" : "unidades"} vendidas`}
              icon={Target}
              color="text-amber-500"
              bg="bg-amber-500/10"
            />
          </div>

          {/* 4 mini rankings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MiniRanking
              title="Top receita"
              icon={Trophy}
              accent="text-emerald-500"
              items={topRevenue.map(r => ({
                productId: r.productId,
                name: r.name,
                value: r.revenueCents,
                formatter: formatCompact,
              }))}
              emptyText="Sem vendas no período"
            />
            <MiniRanking
              title="Top lucro absoluto"
              icon={Coins}
              accent="text-blue-500"
              items={topProfit.map(r => ({
                productId: r.productId,
                name: r.name,
                value: r.profitCents,
                formatter: formatCompact,
              }))}
              emptyText="Sem lucro no período (custo igual ou maior que receita)"
            />
            <MiniRanking
              title="Top volume"
              icon={Package}
              accent="text-amber-500"
              items={topVolume.map(r => ({
                productId: r.productId,
                name: r.name,
                value: r.unitsSold,
                suffix: r.unitOfMeasure || "un",
                formatter: formatNumber,
              }))}
              emptyText="Sem unidades vendidas"
            />
            <MiniRanking
              title="Top margem %"
              icon={TrendingUp}
              accent="text-violet-500"
              items={topMargin.map(r => ({
                productId: r.productId,
                name: r.name,
                value: r.marginPercent,
                formatter: (v) => `${v}%`,
              }))}
              emptyText="Faltam dados de custo"
            />
          </div>

          {/* Diagnóstico do gestor */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-[15px] flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Diagnóstico do gestor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13.5px] leading-relaxed text-foreground/90">
              {narrative.map((p, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>') }} />
              ))}
            </CardContent>
          </Card>

          {/* Tabela master */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-[15px] flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-500" />
                Análise por produto
              </CardTitle>
              <p className="text-[12px] text-muted-foreground">
                Conversão considera apenas negociações decididas (ganha + perdida). Margem usa custo atual do catálogo.
              </p>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="border-y border-border/40 bg-muted/30">
                    <tr className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                      <th className="text-left px-4 py-2 font-semibold">Produto</th>
                      <th className="text-right px-3 py-2 font-semibold">Vendas</th>
                      <th className="text-right px-3 py-2 font-semibold">Receita</th>
                      <th className="text-right px-3 py-2 font-semibold">Lucro</th>
                      <th className="text-right px-3 py-2 font-semibold">Margem</th>
                      <th className="text-right px-3 py-2 font-semibold">Volume</th>
                      <th className="text-right px-3 py-2 font-semibold">Conversão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-muted-foreground">
                          Sem produtos no período selecionado.
                        </td>
                      </tr>
                    ) : ranking.map((r) => {
                      const mDx = diagnoseMargin(r.marginPercent);
                      const cDx = diagnoseConversion(r.conversionRate, r.wonDeals + r.lostDeals);
                      return (
                        <tr key={r.productId ?? r.name} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {r.imageUrl && (
                                <img src={r.imageUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="font-medium truncate">{r.name}</p>
                                <p className="text-[10.5px] text-muted-foreground">
                                  {r.category}
                                  {r.pricingMode === "per_unit" && r.unitOfMeasure && (
                                    <span className="ml-1.5 px-1 rounded bg-emerald-500/10 text-emerald-500">
                                      por {r.unitOfMeasure}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="text-right px-3 py-2.5 tabular-nums">
                            {r.wonDeals}
                            {r.lostDeals > 0 && (
                              <span className="text-rose-400 text-[10.5px]"> /{r.lostDeals}↓</span>
                            )}
                          </td>
                          <td className="text-right px-3 py-2.5 tabular-nums font-semibold">
                            {formatCompact(r.revenueCents)}
                          </td>
                          <td className={`text-right px-3 py-2.5 tabular-nums ${r.profitCents < 0 ? "text-red-500 font-semibold" : ""}`}>
                            {formatCompact(r.profitCents)}
                          </td>
                          <td className="text-right px-3 py-2.5 tabular-nums">
                            {r.revenueCents > 0 ? (
                              <span className={
                                mDx.tone === "ok" ? "text-emerald-500 font-semibold" :
                                mDx.tone === "warn" ? "text-amber-500" : "text-red-500 font-semibold"
                              }>
                                {r.marginPercent}%
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="text-right px-3 py-2.5 tabular-nums text-muted-foreground">
                            {formatNumber(r.unitsSold)} {r.unitOfMeasure || "un"}
                          </td>
                          <td className="text-right px-3 py-2.5 tabular-nums">
                            {(r.wonDeals + r.lostDeals) > 0 ? (
                              <span className={
                                cDx.tone === "ok" ? "text-emerald-500" :
                                cDx.tone === "warn" ? "text-amber-500" : "text-red-500"
                              }>
                                {r.conversionRate}%
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Recomendações */}
          {recommendations.length > 0 && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Próximas ações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed">
                      <span className="text-emerald-500 mt-0.5">→</span>
                      <span dangerouslySetInnerHTML={{ __html: r.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>') }} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Footer button — link para catálogo */}
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={() => navigate("/products")}>
              <Award className="h-4 w-4 mr-1" />
              Gerenciar catálogo de produtos
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
