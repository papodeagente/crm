import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Target,
  Trophy, XCircle, Clock, ArrowRight, Briefcase, Filter,
  ChevronRight, Loader2, AlertTriangle, Package, Users as UsersIcon,
} from "lucide-react";
import DateRangeFilter, { useDateFilter } from "@/components/DateRangeFilter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
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

function formatMonthLabel(period: string): string {
  const [y, m] = period.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m, 10) - 1]}/${y.slice(2)}`;
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
      label: formatMonthLabel(d.period),
      wonValue: d.wonValueCents / 100,
      lostValue: d.lostValueCents / 100,
    }));
  }, [dealsByPeriodQ.data]);

  return (
    <div className="space-y-6 pb-8">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Análises</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão geral do desempenho comercial
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pipeline filter */}
          <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
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

          {/* User filter */}
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
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

          {/* Date filter */}
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

      {/* ─── KPI Cards ─── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((kpi, i) => (
            <Card key={i} className="relative overflow-hidden border-border/50 hover:border-border transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded-lg ${kpi.bgColor}`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                  {kpi.trend && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${kpi.trend === "up" ? "text-emerald-500 border-emerald-500/30" : "text-red-500 border-red-500/30"}`}>
                      {kpi.trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    </Badge>
                  )}
                </div>
                <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{kpi.title}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{kpi.subtitle}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Charts Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Deals by Period */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Negociações por Período
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {dealsByPeriodQ.isLoading ? (
              <div className="flex items-center justify-center h-[280px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
                <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Nenhum dado no período</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [
                      value.toLocaleString("pt-BR"),
                      name === "won" ? "Ganhas" : name === "lost" ? "Perdidas" : "Abertas",
                    ]}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === "won" ? "Ganhas" : value === "lost" ? "Perdidas" : "Abertas"
                    }
                  />
                  <Area type="monotone" dataKey="won" stroke={CHART_COLORS.won} fill="url(#wonGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="lost" stroke={CHART_COLORS.lost} fill="url(#lostGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Loss Reasons */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Top Motivos de Perda
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {lossReasonsQ.isLoading ? (
              <div className="flex items-center justify-center h-[280px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !lossReasonsQ.data?.length ? (
              <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
                <Trophy className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma perda registrada</p>
              </div>
            ) : (
              <div className="space-y-3 mt-2">
                {lossReasonsQ.data.map((r, i) => (
                  <div key={r.reasonId ?? "none"} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: LOSS_COLORS[i] || "#a3a3a3" }}
                        />
                        <span className="text-sm font-medium truncate max-w-[160px]">
                          {r.reasonName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{r.count}x</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {formatPercent(r.percentage)}
                        </Badge>
                      </div>
                    </div>
                    <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                        style={{
                          width: `${r.percentage}%`,
                          backgroundColor: LOSS_COLORS[i] || "#a3a3a3",
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Funil de Vendas
              {selectedPipeline === "all" && pipelinesQ.data?.[0] && (
                <Badge variant="secondary" className="text-[10px] ml-1">{pipelinesQ.data[0].name}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {funnelQ.isLoading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !funnelQ.data?.length ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma etapa configurada</p>
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                {funnelQ.data.map((stage, i) => {
                  const maxCount = Math.max(...funnelQ.data!.map(s => s.dealCount), 1);
                  const pct = (stage.dealCount / maxCount) * 100;
                  return (
                    <Tooltip key={stage.stageId}>
                      <TooltipTrigger asChild>
                        <div className="group cursor-default">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{ backgroundColor: stage.stageColor }}
                              />
                              <span className="text-sm font-medium">{stage.stageName}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="font-medium">{stage.dealCount} negociações</span>
                              <span>{formatCompact(stage.valueCents)}</span>
                            </div>
                          </div>
                          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 group-hover:opacity-80"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: stage.stageColor,
                              }}
                            />
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{stage.stageName}: {stage.dealCount} negociações ({formatCurrency(stage.valueCents)})</p>
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
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Outros Relatórios</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REPORT_PAGES.map(page => (
            <Card
              key={page.path}
              className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer group"
              onClick={() => navigate(page.path)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <page.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{page.label}</p>
                  <p className="text-xs text-muted-foreground">{page.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
