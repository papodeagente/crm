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
  ChevronRight, Loader2, AlertTriangle, Package, Users as UsersIcon,
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
const REPORT_PAGES = [
  { label: "Produtos", path: "/analytics/products", icon: Package, description: "Análise de produtos vendidos" },
  { label: "Insights WhatsApp", path: "/insights", icon: BarChart3, description: "Métricas de mensagens e atendimento" },
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
  const usersQ = trpc.admin.users.list.useQuery();

  const filterInput = useMemo(() => ({
    dateFrom: dateFilter.dates.dateFrom,
    dateTo: dateFilter.dates.dateTo,
    pipelineId: selectedPipeline !== "all" ? Number(selectedPipeline) : undefined,
    ownerUserId: selectedUser !== "all" ? Number(selectedUser) : undefined,
  }), [dateFilter.dates, selectedPipeline, selectedUser]);

  const summaryQ = trpc.crmAnalytics.summary.useQuery(filterInput);
  const lossReasonsQ = trpc.crmAnalytics.topLossReasons.useQuery({ ...filterInput, limit: 5 });
  const dealsByPeriodQ = trpc.crmAnalytics.dealsByPeriod.useQuery(filterInput);

  const funnelPipelineId = selectedPipeline !== "all"
    ? Number(selectedPipeline)
    : pipelinesQ.data?.[0]?.id;

  const funnelQ = trpc.crmAnalytics.pipelineFunnel.useQuery(
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
                <SelectItem value="all">Todos os funis</SelectItem>
                {pipelinesQ.data?.map(p => (
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

        {/* ─── Pipeline Funnel ─── */}
        {funnelPipelineId && (
          <Card className="border-border/50">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Funil de Vendas
                {selectedPipeline === "all" && pipelinesQ.data?.[0] && (
                  <Badge variant="secondary" className="text-[10px] ml-1.5">{pipelinesQ.data[0].name}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              {funnelQ.isLoading ? (
                <div className="flex items-center justify-center h-[180px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !funnelQ.data?.length ? (
                <div className="flex flex-col items-center justify-center h-[180px] text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm">Nenhuma etapa configurada</p>
                </div>
              ) : (
                <div className="space-y-3 mt-1">
                  {funnelQ.data.map((stage) => {
                    const maxCount = Math.max(...funnelQ.data!.map(s => s.dealCount), 1);
                    const pct = (stage.dealCount / maxCount) * 100;
                    return (
                      <Tooltip key={stage.stageId}>
                        <TooltipTrigger asChild>
                          <div className="group cursor-default">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1.5">
                              <div className="flex items-center gap-2.5">
                                <span
                                  className="w-3 h-3 rounded-sm shrink-0"
                                  style={{ backgroundColor: stage.stageColor }}
                                />
                                <span className="text-sm font-medium">{stage.stageName}</span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground pl-5 sm:pl-0">
                                <span className="font-semibold text-foreground/80">{stage.dealCount} negociações</span>
                                <span>{formatCompact(stage.valueCents)}</span>
                              </div>
                            </div>
                            <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out group-hover:brightness-110"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: stage.stageColor,
                                }}
                              />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">{stage.stageName}: {stage.dealCount} negociações ({formatCurrency(stage.valueCents)})</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── Quick Navigation to Other Reports ─── */}
        <div className="pt-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Outros Relatórios
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {REPORT_PAGES.map(page => (
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
