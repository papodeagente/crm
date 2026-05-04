import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Target,
  Trophy, XCircle, Clock, Briefcase, Filter,
  ChevronRight, Loader2, AlertTriangle, Package, Users as UsersIcon, Activity, Megaphone,
  Plane, LifeBuoy, Crown, Globe, Sparkles, AlertCircle, CalendarCheck, FileText,
} from "lucide-react";
import DateRangeFilter, { useDateFilter } from "@/components/DateRangeFilter";
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from "recharts";

/* ─── Constants ─── */
const CHART_COLORS = {
  won: "#22c55e",
  lost: "#ef4444",
  open: "#6366f1",
  primary: "#600FED",
  secondary: "#DC00E7",
  accent: "#FF2B61",
};

const LOSS_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#a3a3a3"];

/* ─── Helpers ─── */
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatCompact(cents: number): string {
  const val = cents / 100;
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `R$ ${(val / 1_000).toFixed(1)}K`;
  return formatCurrency(cents);
}

function formatPercent(v: number): string {
  return `${v.toFixed(1)}%`;
}

function formatDayLabel(period: string): string {
  // period is YYYY-MM-DD
  const parts = period.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`; // DD/MM
  }
  return period;
}

/* ─── Sub-pages for navigation ─── */
// requiresPipelineType: o card só aparece se houver pipeline desse tipo no
// tenant. Evita mostrar Pós-Venda/Suporte vazios em tenants que não usam.
const REPORT_PAGES: Array<{
  label: string;
  path: string;
  icon: any;
  description: string;
  requiresPipelineType?: "sales" | "post_sale" | "support";
}> = [
  { label: "CRM Live", path: "/analytics/crm-live", icon: Activity, description: "Visão em tempo real da operação comercial" },
  { label: "Metas", path: "/analytics/goals", icon: Target, description: "Acompanhamento de metas com análise IA" },
  { label: "Produtos", path: "/analytics/products", icon: Package, description: "Análise de produtos vendidos" },
  { label: "Insights WhatsApp", path: "/insights", icon: BarChart3, description: "Métricas de mensagens e atendimento" },
  { label: "Agenda × Vendas", path: "/analytics/appointments", icon: CalendarCheck, description: "Comparecimento, no-show e conversão em vendas" },
  { label: "Orçamentos", path: "/analytics/proposals", icon: FileText, description: "Taxa de aceite, ciclo de fechamento e ranking comercial" },
  { label: "Fontes e Campanhas", path: "/analytics/sources-campaigns", icon: Megaphone, description: "Análise de origem por fonte, campanha e UTMs" },
  { label: "Relatório de Pós-Venda", path: "/analytics/post-sale", icon: Plane, description: "Análise operacional da carteira em entrega", requiresPipelineType: "post_sale" },
  { label: "Relatório de Suporte", path: "/analytics/support", icon: LifeBuoy, description: "Análise operacional de casos e tratativas", requiresPipelineType: "support" },
];

/* ─── Main Component ─── */
export default function Analytics() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Filters
  const dateFilter = useDateFilter("last30");
  const [selectedPipeline, setSelectedPipeline] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");

  // Data queries
  const pipelinesQ = trpc.crm.pipelines.list.useQuery({});
  // Only show sales pipelines in the dropdown
  const salesPipelines = useMemo(() =>
    (pipelinesQ.data ?? []).filter(p => p.pipelineType === "sales"),
    [pipelinesQ.data]
  );
  // Tipos de pipeline existentes neste tenant — usado para esconder cards
  // de relatórios que dependem de pipelines vazias (ex.: Suporte sem dados).
  const pipelineTypesPresent = useMemo(() => {
    const set = new Set<string>();
    for (const p of (pipelinesQ.data ?? [])) {
      if (p.pipelineType) set.add(p.pipelineType);
    }
    return set;
  }, [pipelinesQ.data]);
  const visibleReportPages = useMemo(() => {
    return REPORT_PAGES.filter(p => !p.requiresPipelineType || pipelineTypesPresent.has(p.requiresPipelineType));
  }, [pipelineTypesPresent]);
  const usersQ = trpc.admin.users.list.useQuery();

  const filterInput = useMemo(() => ({
    dateFrom: dateFilter.dates.dateFrom,
    dateTo: dateFilter.dates.dateTo,
    pipelineId: selectedPipeline !== "all" ? Number(selectedPipeline) : undefined,
    ownerUserId: selectedUser !== "all" ? Number(selectedUser) : undefined,
    pipelineType: "sales" as const,
  }), [dateFilter.dates, selectedPipeline, selectedUser]);

  const summaryQ = trpc.crmAnalytics.summary.useQuery(filterInput);
  const lossReasonsQ = trpc.crmAnalytics.topLossReasons.useQuery({ ...filterInput, limit: 5 });
  const dealsByPeriodQ = trpc.crmAnalytics.dealsByPeriod.useQuery(filterInput);
  // Indicadores estendidos
  const rankingQ = trpc.crmAnalytics.salesRanking.useQuery({ ...filterInput, limit: 10 });
  const sourcesQ = trpc.crmAnalytics.leadSources.useQuery({ ...filterInput, limit: 8 });
  const forecastQ = trpc.crmAnalytics.forecast.useQuery({
    pipelineId: filterInput.pipelineId,
    ownerUserId: filterInput.ownerUserId,
    pipelineType: filterInput.pipelineType,
  });
  const stagnationQ = trpc.crmAnalytics.stagnation.useQuery({
    pipelineId: filterInput.pipelineId,
    ownerUserId: filterInput.ownerUserId,
    pipelineType: filterInput.pipelineType,
    thresholdDays: 14,
  });

  // Funnel pipeline: default to first pipeline, allow switching
  const defaultPipelineId = salesPipelines[0]?.id;
  const [funnelPipelineOverride, setFunnelPipelineOverride] = useState<string | null>(null);
  const funnelPipelineId = funnelPipelineOverride
    ? Number(funnelPipelineOverride)
    : (selectedPipeline !== "all" ? Number(selectedPipeline) : defaultPipelineId);

  const funnelConversionQ = trpc.crmAnalytics.funnelConversion.useQuery(
    {
      pipelineId: funnelPipelineId ?? 0,
      dateFrom: filterInput.dateFrom,
      dateTo: filterInput.dateTo,
      ownerUserId: filterInput.ownerUserId,
    },
    { enabled: !!funnelPipelineId }
  );

  const summary = summaryQ.data;
  const isLoading = summaryQ.isLoading;

  // KPI cards data
  const kpis = useMemo(() => {
    if (!summary) return [];
    return [
      {
        title: "Total de Negociações",
        value: summary.totalDeals.toLocaleString("pt-BR"),
        subtitle: formatCurrency(summary.totalValueCents),
        icon: Briefcase,
        color: "text-indigo-500",
        bgColor: "bg-indigo-500/10",
      },
      {
        title: "Negociações Ganhas",
        value: summary.wonDeals.toLocaleString("pt-BR"),
        subtitle: formatCurrency(summary.wonValueCents),
        icon: Trophy,
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
      },
      {
        title: "Negociações Perdidas",
        value: summary.lostDeals.toLocaleString("pt-BR"),
        subtitle: formatCurrency(summary.lostValueCents),
        icon: XCircle,
        color: "text-red-500",
        bgColor: "bg-red-500/10",
      },
      {
        title: "Taxa de Conversão",
        value: formatPercent(summary.conversionRate),
        subtitle: `${summary.wonDeals + summary.lostDeals} decididas`,
        icon: Target,
        color: "text-violet-500",
        bgColor: "bg-violet-500/10",
        trend: summary.conversionRate >= 50 ? "up" : summary.conversionRate > 0 ? "down" : undefined,
      },
      {
        title: "Ticket Médio",
        value: formatCompact(summary.avgTicketCents),
        subtitle: "por negociação ganha",
        icon: DollarSign,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
      },
      {
        title: "Ciclo Médio",
        value: `${summary.avgCycleDays}d`,
        subtitle: "até o fechamento",
        icon: Clock,
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
      },
    ];
  }, [summary]);

  // Chart data
  const chartData = useMemo(() => {
    if (!dealsByPeriodQ.data) return [];
    return dealsByPeriodQ.data.map(d => ({
      ...d,
      label: formatDayLabel(d.period),
      wonValue: d.wonValueCents / 100,
      lostValue: d.lostValueCents / 100,
    }));
  }, [dealsByPeriodQ.data]);

  return (
    <div className="page-content">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ─── Header + Filters ─── */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight">Análises</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Visão geral do desempenho comercial
            </p>
          </div>

          {/* Filters — stack on mobile, row on desktop */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
              <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Todos os funis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os funis de vendas</SelectItem>
                {salesPipelines.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
                <UsersIcon className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Todos os usuários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                {usersQ.data?.map((u: any) => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="w-full sm:w-auto">
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
          </div>
        </div>

        {/* ─── KPI Cards ─── */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {kpis.map((kpi, i) => (
              <Card
                key={i}
                className="relative overflow-hidden border-border/50 hover:border-border/80 hover:shadow-md transition-all duration-200"
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={`p-2 rounded-xl ${kpi.bgColor}`}>
                      <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                    </div>
                    {kpi.trend && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0.5 ${
                          kpi.trend === "up"
                            ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
                            : "text-red-500 border-red-500/30 bg-red-500/5"
                        }`}
                      >
                        {kpi.trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl sm:text-[26px] font-bold tracking-tight leading-none">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-2 leading-snug">{kpi.title}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{kpi.subtitle}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ─── Charts Row ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Deals by Period — takes 3/5 on lg */}
          <Card className="lg:col-span-3 border-border/50">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Negociações por Período
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-5 pb-5 pt-0">
              {dealsByPeriodQ.isLoading ? (
                <div className="flex items-center justify-center h-[260px] sm:h-[300px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[260px] sm:h-[300px] text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm">Nenhum dado no período</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Ajuste os filtros para ver dados</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="wonGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.won} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.won} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="lostGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.lost} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.lost} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 10,
                        fontSize: 12,
                        padding: "10px 14px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      }}
                      formatter={(value: number, name: string) => [
                        value.toLocaleString("pt-BR"),
                        name === "won" ? "Ganhas" : name === "lost" ? "Perdidas" : "Abertas",
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      formatter={(value: string) =>
                        value === "won" ? "Ganhas" : value === "lost" ? "Perdidas" : "Abertas"
                      }
                    />
                    <Area type="monotone" dataKey="won" stroke={CHART_COLORS.won} fill="url(#wonGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="lost" stroke={CHART_COLORS.lost} fill="url(#lostGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top Loss Reasons — takes 2/5 on lg */}
          <Card className="lg:col-span-2 border-border/50">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                Top Motivos de Perda
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              {lossReasonsQ.isLoading ? (
                <div className="flex items-center justify-center h-[260px] sm:h-[300px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !lossReasonsQ.data?.length ? (
                <div className="flex flex-col items-center justify-center h-[260px] sm:h-[300px] text-muted-foreground">
                  <Trophy className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm">Nenhuma perda registrada</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Boas notícias!</p>
                </div>
              ) : (
                <div className="space-y-4 mt-1">
                  {lossReasonsQ.data.map((r, i) => (
                    <div key={r.reasonId ?? "none"} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: LOSS_COLORS[i] || "#a3a3a3" }}
                          />
                          <span className="text-sm font-medium truncate">
                            {r.reasonName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                          <span className="font-medium">{r.count}x</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                            {formatPercent(r.percentage)}
                          </Badge>
                        </div>
                      </div>
                      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${r.percentage}%`,
                            backgroundColor: LOSS_COLORS[i] || "#a3a3a3",
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 pl-5">
                        {formatCurrency(r.valueCents)} em valor perdido
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Funnel: Conversão por Volume ─── */}
        {funnelPipelineId && (
          <Card className="border-border/50">
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Conversão por Volume
                </CardTitle>
                <Select
                  value={String(funnelPipelineId)}
                  onValueChange={(v) => setFunnelPipelineOverride(v)}
                >
                  <SelectTrigger className="w-full sm:w-[220px] h-8 text-xs">
                    <SelectValue placeholder="Selecione o funil" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesPipelines.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              {funnelConversionQ.isLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !funnelConversionQ.data?.stages?.length ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm">Nenhuma etapa configurada</p>
                </div>
              ) : (() => {
                const fc = funnelConversionQ.data!;
                // maxTotal = first stage total (widest bar = 100%)
                const maxTotal = fc.stages.length > 0 ? Math.max(fc.stages[0].total, 1) : 1;
                return (
                  <div className="space-y-1">
                    {/* Legend */}
                    <div className="flex items-center justify-end gap-4 mb-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#4A90D9]" />
                        <span className="text-muted-foreground">Conversão</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#22c55e]" />
                        <span className="text-muted-foreground">Vendas</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
                        <span className="text-muted-foreground">Perdidos</span>
                      </div>
                    </div>

                    {/* Stage bars — conversion funnel */}
                    {fc.stages.map((stage, i) => {
                      // The full bar width = total that reached this stage (relative to 1st stage)
                      const barWidthPct = (stage.total / maxTotal) * 100;

                      // Inside the bar: blue = conversion (total that passed), red = lost here
                      // Blue represents the full stage volume (conversion), red is overlaid at the end
                      const blueWidth = stage.total > 0 ? ((stage.total - stage.lost) / stage.total) * 100 : 100;
                      const redWidth = stage.total > 0 ? (stage.lost / stage.total) * 100 : 0;

                      return (
                        <Tooltip key={stage.stageId}>
                          <TooltipTrigger asChild>
                            <div className="group cursor-default py-1.5">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-[140px] sm:w-[180px] text-right truncate shrink-0 font-medium">
                                  {stage.stageName}
                                </span>
                                <div className="flex-1 relative">
                                  <div
                                    className="h-8 sm:h-9 rounded-sm flex overflow-hidden transition-all duration-500 group-hover:brightness-110"
                                    style={{ width: `${Math.max(barWidthPct, 2)}%` }}
                                  >
                                    {/* Blue = conversion (deals that passed through / are progressing) */}
                                    <div
                                      className="h-full transition-all duration-500"
                                      style={{
                                        width: `${blueWidth}%`,
                                        backgroundColor: "#4A90D9",
                                      }}
                                    />
                                    {/* Red = lost at this stage (at the end of the bar) */}
                                    <div
                                      className="h-full transition-all duration-500"
                                      style={{
                                        width: `${redWidth}%`,
                                        backgroundColor: "#ef4444",
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[300px]">
                            <div className="space-y-1.5 text-xs">
                              <p className="font-semibold text-sm">{stage.stageName}</p>
                              <div className="flex items-center justify-between gap-4 text-[#4A90D9]">
                                <span>Passaram por esta etapa:</span>
                                <span className="font-semibold">{stage.total}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-[#ef4444]">
                                <span>Perdidos nesta etapa:</span>
                                <span className="font-medium">{stage.lost}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-[#22c55e]">
                                <span>Ganhos nesta etapa:</span>
                                <span className="font-medium">{stage.won}</span>
                              </div>
                              {i > 0 && (
                                <div className="pt-1.5 border-t border-border/50 flex items-center justify-between gap-4">
                                  <span className="text-muted-foreground">Conversão da etapa anterior:</span>
                                  <span className="font-semibold">{formatPercent(stage.conversionFromPrev)}</span>
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}

                    {/* Final conversion row — green (won) + red (lost) */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="group cursor-default py-1.5 mt-1 border-t border-border/30 pt-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xs w-[140px] sm:w-[180px] text-right shrink-0 font-semibold text-emerald-500">
                              Conversão final
                            </span>
                            <div className="flex-1 relative">
                              {(() => {
                                const decided = fc.totalWon + fc.totalLost;
                                const finalBarWidth = maxTotal > 0 ? (decided / maxTotal) * 100 : 0;
                                const greenPct = decided > 0 ? (fc.totalWon / decided) * 100 : 0;
                                const redPct = decided > 0 ? (fc.totalLost / decided) * 100 : 0;
                                return (
                                  <div
                                    className="h-8 sm:h-9 rounded-sm flex overflow-hidden transition-all duration-500 group-hover:brightness-110"
                                    style={{ width: `${Math.max(finalBarWidth, 2)}%` }}
                                  >
                                    {/* Green = won */}
                                    <div
                                      className="h-full transition-all duration-500"
                                      style={{
                                        width: `${greenPct}%`,
                                        backgroundColor: "#22c55e",
                                      }}
                                    />
                                    {/* Red = lost */}
                                    <div
                                      className="h-full transition-all duration-500"
                                      style={{
                                        width: `${redPct}%`,
                                        backgroundColor: "#ef4444",
                                      }}
                                    />
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[300px]">
                        <div className="space-y-1.5 text-xs">
                          <p className="font-semibold text-sm">Conversão Final do Funil</p>
                          <div className="flex items-center justify-between gap-4">
                            <span>Total de negociações:</span>
                            <span className="font-semibold">{fc.totalDeals}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-[#22c55e]">
                            <span>Vendas realizadas:</span>
                            <span className="font-semibold">{fc.totalWon}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-[#ef4444]">
                            <span>Total perdidos:</span>
                            <span className="font-semibold">{fc.totalLost}</span>
                          </div>
                          <div className="pt-1.5 border-t border-border/50 flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Taxa de conversão final:</span>
                            <span className="font-bold text-sm">{formatPercent(fc.finalConversionRate)}</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>

                    {/* X-axis label */}
                    <div className="flex items-center gap-3 pt-2">
                      <span className="w-[140px] sm:w-[180px] shrink-0" />
                      <div className="flex-1 flex justify-between text-[10px] text-muted-foreground/60">
                        <span>0</span>
                        <span>{Math.round(maxTotal / 4)}</span>
                        <span>{Math.round(maxTotal / 2)}</span>
                        <span>{Math.round(maxTotal * 3 / 4)}</span>
                        <span className="font-medium text-foreground/60">{maxTotal}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-[140px] sm:w-[180px] shrink-0" />
                      <p className="text-center flex-1 text-[11px] text-muted-foreground/50">Negociações</p>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* ─── Forecast + Risco do Pipeline ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="border-border/50">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Receita projetada (forecast ponderado)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              {forecastQ.isLoading ? (
                <div className="flex items-center justify-center h-[160px]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (() => {
                const f = forecastQ.data;
                if (!f) return null;
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Pipeline aberto</p>
                        <p className="text-lg font-bold tabular-nums">{f.openDeals}</p>
                        <p className="text-[11px] text-muted-foreground">{formatCurrency(f.openValueCents)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Probabilidade média</p>
                        <p className="text-lg font-bold tabular-nums">{f.avgProbability}%</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Forecast (×prob.)</p>
                        <p className="text-lg font-bold tabular-nums text-primary">{formatCurrency(f.weightedForecastCents)}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Soma do valor de cada deal aberto multiplicado pela probabilidade da etapa. Visão conservadora do quanto deve fechar.
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Negociações em risco (≥ 14 dias sem atividade)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              {stagnationQ.isLoading ? (
                <div className="flex items-center justify-center h-[160px]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (() => {
                const s = stagnationQ.data;
                if (!s) return null;
                const pct = s.totalOpen > 0 ? Math.round((s.stagnantCount / s.totalOpen) * 100) : 0;
                return (
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-3">
                      <p className="text-3xl font-bold tabular-nums text-amber-600">{s.stagnantCount}</p>
                      <p className="text-sm text-muted-foreground">de {s.totalOpen} abertas ({pct}%)</p>
                    </div>
                    {s.topStagnant.length > 0 ? (
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {s.topStagnant.slice(0, 6).map((d: any) => (
                          <div key={d.id} className="flex items-center justify-between text-xs gap-2 border-b border-border/30 last:border-0 pb-1.5">
                            <span className="truncate flex-1">{d.title}</span>
                            <span className="text-muted-foreground shrink-0">{d.daysSinceActivity}d</span>
                            <span className="font-medium tabular-nums shrink-0">{formatCurrency(d.valueCents)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma estagnada no período. 🎯</p>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* ─── Ranking de vendedores + Origem dos leads ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="border-border/50">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                Ranking de vendedores
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              {rankingQ.isLoading ? (
                <div className="flex items-center justify-center h-[200px]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !rankingQ.data?.length ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem dados no período.</p>
              ) : (
                <div className="space-y-2">
                  {rankingQ.data.slice(0, 10).map((r: any, i: number) => (
                    <div key={r.ownerUserId} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
                      <span className={`text-xs font-bold tabular-nums w-5 text-center ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-700" : "text-muted-foreground"}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.ownerName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.wonDeals} ganhas · {r.lostDeals} perdidas · {formatPercent(r.conversionRate)}
                        </p>
                      </div>
                      <span className="text-sm font-bold tabular-nums shrink-0">{formatCompact(r.wonValueCents)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Origem dos leads
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              {sourcesQ.isLoading ? (
                <div className="flex items-center justify-center h-[200px]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !sourcesQ.data?.length ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem dados no período.</p>
              ) : (() => {
                const total = sourcesQ.data.reduce((s: number, r: any) => s + r.totalDeals, 0);
                return (
                  <div className="space-y-3">
                    {sourcesQ.data.slice(0, 8).map((src: any) => {
                      const pct = total > 0 ? (src.totalDeals / total) * 100 : 0;
                      return (
                        <div key={src.source} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium truncate">{src.source}</span>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                              <span>{src.totalDeals}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{Math.round(pct)}%</Badge>
                            </div>
                          </div>
                          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                            <div className="absolute inset-y-0 left-0 rounded-full bg-primary/70 transition-all duration-700" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[11px] text-muted-foreground/70">
                            {src.wonDeals} ganhas · {formatPercent(src.conversionRate)} conv. · {formatCurrency(src.wonValueCents)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* ─── Quick Navigation to Other Reports ─── */}
        <div className="pt-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Outros Relatórios
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleReportPages.map(page => (
              <Card
                key={page.path}
                className="border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer group"
                onClick={() => navigate(page.path)}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                    <page.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{page.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{page.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
