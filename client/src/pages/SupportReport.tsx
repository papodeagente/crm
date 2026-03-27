import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LifeBuoy, ArrowLeft, Briefcase, Users as UsersIcon, DollarSign,
  AlertTriangle, TrendingUp, Loader2, UserCheck, UserPlus, Filter, XCircle,
} from "lucide-react";
import DateRangeFilter, { useDateFilter } from "@/components/DateRangeFilter";
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from "recharts";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatCompact(cents: number): string {
  const val = cents / 100;
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `R$ ${(val / 1_000).toFixed(1)}K`;
  return formatCurrency(cents);
}

export default function SupportReport() {
  const [, navigate] = useLocation();
  const dateFilter = useDateFilter("last30");
  const [selectedPipeline, setSelectedPipeline] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");

  // Fetch only support pipelines
  const pipelinesQ = trpc.crm.pipelines.list.useQuery({});
  const supportPipelines = useMemo(() =>
    (pipelinesQ.data ?? []).filter(p => p.pipelineType === "support"),
    [pipelinesQ.data]
  );
  const usersQ = trpc.admin.users.list.useQuery();

  const filterInput = useMemo(() => ({
    dateFrom: dateFilter.dates.dateFrom,
    dateTo: dateFilter.dates.dateTo,
    pipelineId: selectedPipeline !== "all" ? Number(selectedPipeline) : undefined,
    ownerUserId: selectedUser !== "all" ? Number(selectedUser) : undefined,
    pipelineType: "support" as const,
  }), [dateFilter.dates, selectedPipeline, selectedUser]);

  const summaryQ = trpc.crmAnalytics.summary.useQuery(filterInput);
  const dealsByPeriodQ = trpc.crmAnalytics.dealsByPeriod.useQuery(filterInput);
  const lossReasonsQ = trpc.crmAnalytics.topLossReasons.useQuery({ ...filterInput, limit: 5 });

  const summary = summaryQ.data;
  const isLoading = summaryQ.isLoading;

  // KPIs for support context
  const kpis = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: "Casos em Gestão",
        value: summary.totalDeals,
        icon: Briefcase,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        subtitle: `${summary.openDeals} em aberto`,
      },
      {
        label: "Valor Impactado",
        value: formatCompact(summary.totalValueCents),
        icon: DollarSign,
        color: "text-red-500",
        bg: "bg-red-500/10",
        subtitle: `${formatCompact(summary.openValueCents)} em tratativa`,
      },
      {
        label: "Ticket Médio Suporte",
        value: summary.totalDeals > 0 ? formatCompact(Math.round(summary.totalValueCents / summary.totalDeals)) : "R$ 0",
        icon: TrendingUp,
        color: "text-cyan-500",
        bg: "bg-cyan-500/10",
        subtitle: "Valor médio por caso",
      },
      {
        label: "Resolvidos",
        value: summary.wonDeals,
        icon: UserCheck,
        color: "text-green-500",
        bg: "bg-green-500/10",
        subtitle: `${((summary.wonDeals / (summary.wonDeals + summary.lostDeals || 1)) * 100).toFixed(0)}% de resolução`,
      },
      {
        label: "Não resolvido",
        value: summary.lostDeals,
        icon: XCircle,
        color: "text-red-500",
        bg: "bg-red-500/10",
        subtitle: summary.lostValueCents > 0 ? `${formatCompact(summary.lostValueCents)} em valor` : "Nenhum no período",
      },
    ];
  }, [summary]);

  // Chart data
  const chartData = useMemo(() => {
    if (!dealsByPeriodQ.data) return [];
    return dealsByPeriodQ.data.map(d => ({
      period: d.period.split("-").slice(1).join("/"),
      emAberto: d.open,
      resolvidos: d.won,
      encerrados: d.lost,
    }));
  }, [dealsByPeriodQ.data]);

  // Top motivos (reusing loss reasons as "motivos de ocorrência")
  const topMotivos = lossReasonsQ.data ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/analytics")}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10">
            <LifeBuoy className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Relatório de Suporte</h1>
            <p className="text-sm text-muted-foreground">Análise operacional de casos e tratativas</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
          <SelectTrigger className="w-full sm:w-[220px] h-9 text-sm">
            <Filter className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Todos os funis de suporte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os funis de suporte</SelectItem>
            {supportPipelines.map(p => (
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
              <SelectItem key={u.userId} value={String(u.userId)}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {/* KPIs */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${kpi.bg}`}>
                      <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart: Casos por Período */}
          {chartData.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Casos por Período</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Bar dataKey="emAberto" name="Em Aberto" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="resolvidos" name="Resolvidos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="encerrados" name="Encerrados" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Motivos de Ocorrência */}
          {topMotivos.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Principais Motivos de Ocorrência</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topMotivos.map((m, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 text-center">
                        <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{m.reasonName}</span>
                          <span className="text-xs text-muted-foreground">{m.count} casos ({m.percentage}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all"
                            style={{ width: `${m.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info about support context */}
          <Card className="border-border/50 bg-amber-500/5">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <LifeBuoy className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold mb-1">Sobre este relatório</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Este relatório apresenta a visão operacional dos casos de suporte.
                    Os indicadores refletem apenas funis do tipo <strong>Suporte</strong> e não
                    incluem métricas comerciais de vendas, conversão ou forecast. Use este painel
                    para acompanhar remarcações, problemas operacionais e tratativas pós-venda.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
