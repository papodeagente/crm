import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plane, ArrowLeft, Briefcase, Users as UsersIcon, DollarSign,
  Package, TrendingUp, Loader2, UserCheck, UserPlus, Filter,
} from "lucide-react";
import DateRangeFilter, { useDateFilter } from "@/components/DateRangeFilter";
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatCompact(cents: number): string {
  const val = cents / 100;
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `R$ ${(val / 1_000).toFixed(1)}K`;
  return formatCurrency(cents);
}

export default function PostSaleReport() {
  const [, navigate] = useLocation();
  const dateFilter = useDateFilter("last30");
  const [selectedPipeline, setSelectedPipeline] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");

  // Fetch only post_sale pipelines
  const pipelinesQ = trpc.crm.pipelines.list.useQuery({});
  const postSalePipelines = useMemo(() =>
    (pipelinesQ.data ?? []).filter(p => p.pipelineType === "post_sale"),
    [pipelinesQ.data]
  );
  const usersQ = trpc.admin.users.list.useQuery();

  const filterInput = useMemo(() => ({
    dateFrom: dateFilter.dates.dateFrom,
    dateTo: dateFilter.dates.dateTo,
    pipelineId: selectedPipeline !== "all" ? Number(selectedPipeline) : undefined,
    ownerUserId: selectedUser !== "all" ? Number(selectedUser) : undefined,
    pipelineType: "post_sale" as const,
  }), [dateFilter.dates, selectedPipeline, selectedUser]);

  const summaryQ = trpc.crmAnalytics.summary.useQuery(filterInput);
  const dealsByPeriodQ = trpc.crmAnalytics.dealsByPeriod.useQuery(filterInput);

  const summary = summaryQ.data;
  const isLoading = summaryQ.isLoading;

  // KPIs for post-sale context
  const kpis = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: "Viagens em Gestão",
        value: summary.totalDeals,
        icon: Briefcase,
        color: "text-violet-500",
        bg: "bg-violet-500/10",
        subtitle: `${summary.openDeals} em andamento`,
      },
      {
        label: "Valor em Entrega",
        value: formatCompact(summary.totalValueCents),
        icon: DollarSign,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        subtitle: `${formatCompact(summary.openValueCents)} em aberto`,
      },
      {
        label: "Ticket Médio Entrega",
        value: summary.totalDeals > 0 ? formatCompact(Math.round(summary.totalValueCents / summary.totalDeals)) : "R$ 0",
        icon: TrendingUp,
        color: "text-cyan-500",
        bg: "bg-cyan-500/10",
        subtitle: "Valor médio por viagem",
      },
      {
        label: "Finalizadas",
        value: summary.wonDeals,
        icon: UserCheck,
        color: "text-green-500",
        bg: "bg-green-500/10",
        subtitle: `${((summary.wonDeals / (summary.wonDeals + summary.lostDeals || 1)) * 100).toFixed(0)}% de conclusão`,
      },
      {
        label: "Viagens canceladas",
        value: summary.lostDeals,
        icon: Package,
        color: "text-red-500",
        bg: "bg-red-500/10",
        subtitle: summary.lostValueCents > 0 ? `${formatCompact(summary.lostValueCents)} em valor` : "Nenhuma no período",
      },
    ];
  }, [summary]);

  // Chart data
  const chartData = useMemo(() => {
    if (!dealsByPeriodQ.data) return [];
    return dealsByPeriodQ.data.map(d => ({
      period: d.period.split("-").slice(1).join("/"),
      emAndamento: d.open,
      finalizadas: d.won,
      canceladas: d.lost,
    }));
  }, [dealsByPeriodQ.data]);

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
          <div className="p-2.5 rounded-xl bg-violet-500/10">
            <Plane className="h-6 w-6 text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Relatório de Pós-Venda</h1>
            <p className="text-sm text-muted-foreground">Análise operacional da carteira em entrega</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
          <SelectTrigger className="w-full sm:w-[220px] h-9 text-sm">
            <Filter className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Todos os funis pós-venda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os funis pós-venda</SelectItem>
            {postSalePipelines.map(p => (
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

          {/* Chart: Viagens por Período */}
          {chartData.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Viagens por Período</CardTitle>
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
                      <Bar dataKey="emAndamento" name="Em Andamento" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="finalizadas" name="Finalizadas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="canceladas" name="Canceladas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info about post-sale context */}
          <Card className="border-border/50 bg-violet-500/5">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Plane className="h-5 w-5 text-violet-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold mb-1">Sobre este relatório</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Este relatório apresenta a visão operacional da carteira de viagens em entrega.
                    Os indicadores refletem apenas funis do tipo <strong>Pós-Venda</strong> e não
                    incluem métricas comerciais de vendas, conversão ou forecast. Use este painel
                    para acompanhar a jornada de entrega dos clientes.
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
