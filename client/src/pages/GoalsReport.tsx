/**
 * GoalsReport — Relatório de Metas com gráficos em pizza e análise IA.
 * Acessível via /analytics/goals. Não altera nenhum módulo existente.
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
} from "recharts";
import { Streamdown } from "streamdown";
import {
  ArrowLeft, Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Sparkles, Loader2, BarChart3, ShoppingBag, Lightbulb, Zap,
} from "lucide-react";

// ─── Colors ──────────────────────────────────────────────────

const STATUS_COLORS = {
  completed: "#22c55e",
  ahead: "#3b82f6",
  on_track: "#8b5cf6",
  behind: "#f59e0b",
  critical: "#ef4444",
};

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];

const METRIC_LABELS: Record<string, string> = {
  total_sold: "Valor Vendido",
  deals_count: "Qtd Negociações",
  conversion_rate: "Taxa de Conversão",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Concluída",
  ahead: "Acima do previsto",
  on_track: "No ritmo",
  behind: "Abaixo",
  critical: "Crítico",
};

const URGENCY_COLORS: Record<string, string> = {
  low: "text-green-500",
  medium: "text-yellow-500",
  high: "text-orange-500",
  critical: "text-red-500",
};

const VERDICT_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  above: { label: "Acima do Previsto", color: "text-green-500", icon: TrendingUp },
  on_track: { label: "No Ritmo", color: "text-blue-500", icon: Target },
  below: { label: "Abaixo do Previsto", color: "text-yellow-500", icon: TrendingDown },
  critical: { label: "Situação Crítica", color: "text-red-500", icon: AlertTriangle },
};

// ─── Helpers ─────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function formatMetricValue(value: number, metricKey: string): string {
  if (metricKey === "total_sold") return formatCurrency(value);
  if (metricKey === "conversion_rate") return `${value}%`;
  return String(value);
}

// ─── Custom Pie Label ────────────────────────────────────────

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ─── Component ───────────────────────────────────────────────

export default function GoalsReport() {
  const [, navigate] = useLocation();
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const reportQ = trpc.crmAnalytics.goalsReport.useQuery(undefined, {
    staleTime: 60_000,
    retry: 1,
  });

  const aiMutation = trpc.crmAnalytics.goalsAIAnalysis.useMutation({
    onSuccess: (data) => {
      setAiAnalysis(data);
      setAiError(null);
    },
    onError: (err) => {
      setAiError(err.message);
    },
  });

  // ─── Derived data for charts ─────────────────────────────

  const statusPieData = useMemo(() => {
    if (!reportQ.data) return [];
    const { goalsCompleted, goalsAhead, goalsOnTrack, goalsBehind, goalsCritical } = reportQ.data;
    return [
      { name: "Concluídas", value: goalsCompleted, color: STATUS_COLORS.completed },
      { name: "Acima", value: goalsAhead, color: STATUS_COLORS.ahead },
      { name: "No ritmo", value: goalsOnTrack, color: STATUS_COLORS.on_track },
      { name: "Abaixo", value: goalsBehind, color: STATUS_COLORS.behind },
      { name: "Críticas", value: goalsCritical, color: STATUS_COLORS.critical },
    ].filter(d => d.value > 0);
  }, [reportQ.data]);

  const dealsPieData = useMemo(() => {
    if (!reportQ.data) return [];
    const dm = reportQ.data.dealMetrics;
    return [
      { name: "Ganhas", value: dm.wonDeals, color: "#22c55e" },
      { name: "Perdidas", value: dm.lostDeals, color: "#ef4444" },
      { name: "Em andamento", value: dm.openDeals, color: "#3b82f6" },
    ].filter(d => d.value > 0);
  }, [reportQ.data]);

  const productsPieData = useMemo(() => {
    if (!reportQ.data?.topProducts?.length) return [];
    return reportQ.data.topProducts.map((p, i) => ({
      name: p.name,
      value: p.totalValueCents,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [reportQ.data]);

  // ─── Loading state ───────────────────────────────────────

  if (reportQ.isLoading) {
    return (
      <div className="page-content">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (reportQ.error) {
    return (
      <div className="page-content">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" onClick={() => navigate("/analytics")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Análises
          </Button>
          <Card className="border-destructive/50">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <p className="text-lg font-medium">Erro ao carregar relatório de metas</p>
              <p className="text-muted-foreground mt-2">{reportQ.error.message}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const report = reportQ.data!;
  const hasGoals = report.goals.length > 0;

  return (
    <div className="page-content">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/analytics")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Target className="w-6 h-6 text-primary" />
                Relatório de Metas
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Acompanhamento de metas ativas com análise inteligente
              </p>
            </div>
          </div>
          <Button
            onClick={() => aiMutation.mutate()}
            disabled={aiMutation.isPending || !hasGoals}
            className="gap-2"
            size="lg"
          >
            {aiMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {aiMutation.isPending ? "Analisando..." : "Gerar Análise IA"}
          </Button>
        </div>

        {/* Empty state */}
        {!hasGoals && (
          <Card>
            <CardContent className="p-12 text-center">
              <Target className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Nenhuma meta ativa</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Crie metas no módulo de Metas para visualizar o relatório de acompanhamento com gráficos e análise IA.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => navigate("/goals")}>
                Ir para Metas
              </Button>
            </CardContent>
          </Card>
        )}

        {hasGoals && (
          <>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                    <Target className="w-3.5 h-3.5" />
                    Progresso Geral
                  </div>
                  <p className="text-2xl font-bold">{report.overallProgress.toFixed(1)}%</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-green-500 text-xs mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Concluídas
                  </div>
                  <p className="text-2xl font-bold">{report.goalsCompleted}</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-blue-500 text-xs mb-2">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Acima / No ritmo
                  </div>
                  <p className="text-2xl font-bold">{report.goalsAhead + report.goalsOnTrack}</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-yellow-500 text-xs mb-2">
                    <TrendingDown className="w-3.5 h-3.5" />
                    Abaixo
                  </div>
                  <p className="text-2xl font-bold">{report.goalsBehind}</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-red-500 text-xs mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Críticas
                  </div>
                  <p className="text-2xl font-bold">{report.goalsCritical}</p>
                </CardContent>
              </Card>
            </div>

            {/* Pie Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Status das Metas */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Status das Metas
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {statusPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={statusPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          labelLine={false}
                          label={renderCustomLabel}
                        >
                          {statusPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: any, name: string) => [`${value} meta(s)`, name]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          iconType="circle"
                          iconSize={8}
                          formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                      Sem dados
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Negociações do Mês */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Negociações do Mês
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {dealsPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={dealsPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          labelLine={false}
                          label={renderCustomLabel}
                        >
                          {dealsPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: any, name: string) => [`${value} negociação(ões)`, name]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          iconType="circle"
                          iconSize={8}
                          formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                      Nenhuma negociação no mês
                    </div>
                  )}
                  {/* Summary below chart */}
                  <div className="grid grid-cols-2 gap-3 mt-2 text-center">
                    <div className="bg-muted/50 rounded-lg p-2.5">
                      <p className="text-xs text-muted-foreground">Ticket Médio</p>
                      <p className="text-sm font-semibold">{formatCurrency(report.dealMetrics.avgTicketCents)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2.5">
                      <p className="text-xs text-muted-foreground">Conversão</p>
                      <p className="text-sm font-semibold">{report.dealMetrics.conversionRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Produtos Mais Vendidos */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-primary" />
                    Top Produtos Vendidos
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {productsPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={productsPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          labelLine={false}
                          label={renderCustomLabel}
                        >
                          {productsPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: any, name: string) => [formatCurrency(Number(value)), name]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          iconType="circle"
                          iconSize={8}
                          formatter={(value) => (
                            <span className="text-xs text-muted-foreground truncate max-w-[100px] inline-block align-middle">
                              {value}
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                      Nenhum produto vendido no mês
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Individual Goals Progress */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Progresso Individual das Metas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {report.goals.map((goal) => {
                    const statusColor = STATUS_COLORS[goal.status];
                    const progressClamped = Math.min(goal.progressPct, 100);
                    return (
                      <Tooltip key={goal.id}>
                        <TooltipTrigger asChild>
                          <div className="group cursor-default">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: statusColor }}
                                />
                                <span className="text-sm font-medium truncate">
                                  {goal.name || METRIC_LABELS[goal.metricKey] || goal.metricKey}
                                </span>
                                {goal.userName && (
                                  <span className="text-xs text-muted-foreground">({goal.userName})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 shrink-0 ml-3">
                                <span className="text-xs text-muted-foreground">
                                  {formatMetricValue(goal.currentValue, goal.metricKey)} / {formatMetricValue(goal.targetValue, goal.metricKey)}
                                </span>
                                <span
                                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor: `${statusColor}20`,
                                    color: statusColor,
                                  }}
                                >
                                  {STATUS_LABELS[goal.status]}
                                </span>
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                              {/* Expected progress marker */}
                              <div
                                className="absolute top-0 h-full w-0.5 bg-foreground/20 z-10"
                                style={{ left: `${Math.min(goal.expectedProgressPct, 100)}%` }}
                              />
                              {/* Actual progress */}
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${progressClamped}%`,
                                  backgroundColor: statusColor,
                                }}
                              />
                            </div>
                            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                              <span>{goal.daysElapsed}d decorridos</span>
                              <span>{goal.daysRemaining}d restantes</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[280px]">
                          <div className="space-y-1 text-xs">
                            <p className="font-semibold">{goal.name || METRIC_LABELS[goal.metricKey]}</p>
                            <p>Progresso: <strong>{goal.progressPct.toFixed(1)}%</strong></p>
                            <p>Esperado: <strong>{goal.expectedProgressPct.toFixed(1)}%</strong></p>
                            <p>Período: {goal.totalDays} dias ({goal.daysRemaining} restantes)</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* AI Analysis Section */}
            {(aiAnalysis || aiMutation.isPending || aiError) && (
              <Card className="border-primary/30 hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Análise Inteligente — Gestor Sênior Comercial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {aiMutation.isPending && (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <Loader2 className="w-10 h-10 animate-spin text-primary" />
                      <p className="text-muted-foreground">Analisando dados e gerando plano de ação...</p>
                    </div>
                  )}

                  {aiError && (
                    <div className="text-center py-8">
                      <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
                      <p className="text-sm text-destructive">{aiError}</p>
                      <Button variant="outline" className="mt-4" onClick={() => aiMutation.mutate()}>
                        Tentar novamente
                      </Button>
                    </div>
                  )}

                  {aiAnalysis && !aiMutation.isPending && (
                    <div className="space-y-6">
                      {/* Verdict Badge */}
                      {(() => {
                        const v = VERDICT_CONFIG[aiAnalysis.performanceVerdict] || VERDICT_CONFIG.below;
                        const Icon = v.icon;
                        return (
                          <div className={`flex items-center gap-3 p-4 rounded-xl bg-muted/50 ${v.color}`}>
                            <Icon className="w-8 h-8" />
                            <div>
                              <p className="text-lg font-bold">{v.label}</p>
                              <p className={`text-xs ${URGENCY_COLORS[aiAnalysis.urgencyLevel]}`}>
                                Urgência: {aiAnalysis.urgencyLevel === "low" ? "Baixa" : aiAnalysis.urgencyLevel === "medium" ? "Média" : aiAnalysis.urgencyLevel === "high" ? "Alta" : "Crítica"}
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Expected Sales */}
                      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-start gap-3">
                          <TrendingUp className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-semibold text-sm mb-1">Projeção de Vendas</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">{aiAnalysis.expectedSalesText}</p>
                          </div>
                        </div>
                      </div>

                      {/* Required Deals */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-muted/50 text-center">
                          <p className="text-3xl font-bold text-primary">{aiAnalysis.requiredDeals}</p>
                          <p className="text-xs text-muted-foreground mt-1">Negociações necessárias</p>
                        </div>
                        <div className="p-4 rounded-xl bg-muted/50 text-center">
                          <p className="text-3xl font-bold text-primary">{formatCurrency(aiAnalysis.requiredValueCents)}</p>
                          <p className="text-xs text-muted-foreground mt-1">Valor a ser vendido</p>
                        </div>
                      </div>

                      {/* Overall Assessment */}
                      <div>
                        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" />
                          Avaliação Geral
                        </h3>
                        <div className="prose prose-sm max-w-none text-muted-foreground">
                          <Streamdown>{aiAnalysis.overallAssessment}</Streamdown>
                        </div>
                      </div>

                      {/* Action Plan */}
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-primary" />
                          Plano de Ação
                        </h3>
                        <div className="prose prose-sm max-w-none text-muted-foreground">
                          <Streamdown>{aiAnalysis.actionPlan}</Streamdown>
                        </div>
                      </div>

                      {/* Recommended Products */}
                      {aiAnalysis.recommendedProducts?.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <ShoppingBag className="w-4 h-4" />
                            Produtos Recomendados
                          </h3>
                          <div className="space-y-2">
                            {aiAnalysis.recommendedProducts.map((product: string, i: number) => (
                              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                  {i + 1}
                                </span>
                                <p className="text-sm text-muted-foreground">{product}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Commercial Guidelines */}
                      {aiAnalysis.commercialGuidelines?.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4" />
                            Orientações Comerciais
                          </h3>
                          <div className="space-y-2">
                            {aiAnalysis.commercialGuidelines.map((guideline: string, i: number) => (
                              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-muted-foreground">{guideline}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
