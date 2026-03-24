import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  DollarSign, TrendingUp, TrendingDown, Users, ArrowLeft,
  Shield, Activity, AlertTriangle, CheckCircle, Clock,
  Zap, BarChart3, PieChart, Webhook, ExternalLink,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw,
  Copy, XCircle, Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function SaasBillingDashboard() {
  const [, navigate] = useLocation();
  const meQuery = trpc.saasAuth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 });

  const dashboardQuery = trpc.billing.adminSaasDashboard.useQuery(
    { months: 6 },
    {
      enabled: !!meQuery.data?.isSuperAdmin,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
    }
  );

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  if (meQuery.isLoading || dashboardQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!meQuery.data?.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Acesso negado</p>
      </div>
    );
  }

  const data = dashboardQuery.data;
  if (!data) return null;

  const { overview, churn, planDistribution, statusDistribution, evolution, hotmart, trialConversion, recentEvents } = data;

  // Colors for plan distribution
  const planColors: Record<string, string> = {
    start: "#a855f7",
    growth: "#8b5cf6",
    scale: "#6366f1",
  };

  const statusColors: Record<string, string> = {
    legacy: "#06b6d4",
    active: "#10b981",
    trialing: "#a855f7",
    past_due: "#f59e0b",
    restricted: "#ef4444",
    cancelled: "#f97316",
    expired: "#dc2626",
  };

  const hotmartStatusConfig = {
    healthy: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Saudável" },
    warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", label: "Atenção" },
    error: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", label: "Erro" },
    no_events: { icon: Clock, color: "text-slate-400", bg: "bg-slate-500/10", label: "Sem eventos" },
  };

  const hotmartStatus = hotmartStatusConfig[hotmart.status];

  // Calculate max MRR for bar chart scaling
  const maxMrr = Math.max(...evolution.map(e => e.mrr), 1);
  const maxTenants = Math.max(...evolution.map(e => e.totalTenants), 1);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border sticky top-0 z-40 bg-card/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/super-admin")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg">Dashboard Financeiro</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => dashboardQuery.refetch()}
              disabled={dashboardQuery.isFetching}
              className="gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${dashboardQuery.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4 text-purple-400" />
              {meQuery.data?.email}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ═══ Row 1: KPI Cards ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* MRR */}
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                {evolution.length >= 2 && (
                  <TrendIndicator
                    current={evolution[evolution.length - 1]?.mrr || 0}
                    previous={evolution[evolution.length - 2]?.mrr || 0}
                  />
                )}
              </div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(overview.mrr)}</p>
              <p className="text-xs text-muted-foreground mt-1">MRR (Receita Mensal Recorrente)</p>
            </CardContent>
          </Card>

          {/* Active Subscribers */}
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-xs text-muted-foreground">{overview.totalTenants} total</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{overview.activeTenants}</p>
              <p className="text-xs text-muted-foreground mt-1">Assinantes Ativos (pagantes)</p>
            </CardContent>
          </Card>

          {/* Churn Rate */}
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                </div>
                {churn.trend === "down" ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                    <ArrowDownRight className="w-3 h-3 mr-0.5" /> Melhorando
                  </Badge>
                ) : churn.trend === "up" ? (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                    <ArrowUpRight className="w-3 h-3 mr-0.5" /> Piorando
                  </Badge>
                ) : (
                  <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-xs">
                    <Minus className="w-3 h-3 mr-0.5" /> Estável
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground">{formatPercent(churn.currentMonth.rate)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Churn Rate (mês atual) — {churn.currentMonth.churned} cancelamento{churn.currentMonth.churned !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          {/* ARPU */}
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(overview.arpu)}</p>
              <p className="text-xs text-muted-foreground mt-1">ARPU (Receita Média por Usuário)</p>
            </CardContent>
          </Card>
        </div>

        {/* ═══ Row 2: MRR Evolution + Subscriber Evolution ═══ */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* MRR Evolution */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Evolução do MRR
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-end gap-2 h-40">
                {evolution.map((month, i) => {
                  const height = maxMrr > 0 ? (month.mrr / maxMrr) * 100 : 0;
                  return (
                    <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {formatCurrency(month.mrr)}
                      </span>
                      <div className="w-full flex items-end" style={{ height: "120px" }}>
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-500"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{month.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Subscriber Evolution */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Evolução de Assinantes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-end gap-2 h-40">
                {evolution.map((month) => {
                  const totalH = maxTenants > 0 ? (month.totalTenants / maxTenants) * 100 : 0;
                  const activeH = maxTenants > 0 ? (month.activePaying / maxTenants) * 100 : 0;
                  return (
                    <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {month.totalTenants}
                      </span>
                      <div className="w-full flex items-end gap-0.5" style={{ height: "120px" }}>
                        <div
                          className="flex-1 rounded-t-sm bg-purple-500/30 transition-all duration-500"
                          style={{ height: `${Math.max(totalH, 2)}%` }}
                          title={`Total: ${month.totalTenants}`}
                        />
                        <div
                          className="flex-1 rounded-t-sm bg-emerald-500 transition-all duration-500"
                          style={{ height: `${Math.max(activeH, 2)}%` }}
                          title={`Pagantes: ${month.activePaying}`}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{month.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 justify-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-purple-500/30" />
                  <span className="text-[10px] text-muted-foreground">Total</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">Pagantes</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ Row 3: Distributions + Trial Conversion ═══ */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Plan Distribution */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Distribuição por Plano
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-3">
              {planDistribution.map((item) => (
                <div key={item.plan} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{item.planName}</span>
                    <span className="text-muted-foreground">
                      {item.count} ({formatPercent(item.percentage)})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: planColors[item.plan] || "#6366f1",
                      }}
                    />
                  </div>
                  {item.mrr > 0 && (
                    <p className="text-[10px] text-muted-foreground">MRR: {formatCurrency(item.mrr)}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Billing Status Distribution */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Distribuição por Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-3">
              {statusDistribution.map((item) => (
                <div key={item.status} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{item.label}</span>
                    <span className="text-muted-foreground">
                      {item.count} ({formatPercent(item.percentage)})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: statusColors[item.status] || "#64748b",
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Trial Conversion */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Conversão de Trial
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="text-center mb-4">
                <p className="text-4xl font-bold text-foreground">{formatPercent(trialConversion.conversionRate)}</p>
                <p className="text-xs text-muted-foreground mt-1">Taxa de conversão</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="text-muted-foreground">Em trial</span>
                  </div>
                  <span className="font-medium text-foreground">{trialConversion.active}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">Convertidos</span>
                  </div>
                  <span className="font-medium text-foreground">{trialConversion.converted}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">Expirados</span>
                  </div>
                  <span className="font-medium text-foreground">{trialConversion.expired}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total de trials</span>
                  <span className="font-medium text-foreground">{trialConversion.totalTrials}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ Row 4: Hotmart Integration + Quick Stats ═══ */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Hotmart Integration Health */}
          <Card className="border-border bg-card lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Webhook className="w-4 h-4" />
                Integração Hotmart
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="grid sm:grid-cols-2 gap-6">
                {/* Status */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl ${hotmartStatus.bg} flex items-center justify-center`}>
                      <hotmartStatus.icon className={`w-6 h-6 ${hotmartStatus.color}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{hotmartStatus.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {hotmart.lastEventAt
                          ? `Último evento: ${new Date(hotmart.lastEventAt).toLocaleString("pt-BR")}`
                          : "Nenhum evento recebido"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">HOTTOK configurado</span>
                      {hotmart.hottokConfigured ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Sim</Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Não</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Eventos processados</span>
                      <span className="font-medium text-foreground">{hotmart.processedEvents}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Eventos com erro</span>
                      <span className={`font-medium ${hotmart.failedEvents > 0 ? "text-red-400" : "text-foreground"}`}>
                        {hotmart.failedEvents}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Event Counts */}
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-xl font-bold text-foreground">{hotmart.totalEventsToday}</p>
                      <p className="text-[10px] text-muted-foreground">Hoje</p>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-xl font-bold text-foreground">{hotmart.totalEventsThisWeek}</p>
                      <p className="text-[10px] text-muted-foreground">Semana</p>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-xl font-bold text-foreground">{hotmart.totalEventsThisMonth}</p>
                      <p className="text-[10px] text-muted-foreground">Mês</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">URL do Webhook:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted/50 px-3 py-2 rounded-md text-foreground break-all">
                        {hotmart.webhookUrl}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(hotmart.webhookUrl);
                          toast.success("URL copiada!");
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Resumo Rápido
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-3">
              <div className="flex items-center justify-between text-sm py-2 border-b border-border">
                <span className="text-muted-foreground">Total de agências</span>
                <span className="font-bold text-foreground">{overview.totalTenants}</span>
              </div>
              <div className="flex items-center justify-between text-sm py-2 border-b border-border">
                <span className="text-muted-foreground">Pagantes ativos</span>
                <span className="font-bold text-emerald-400">{overview.activeTenants}</span>
              </div>
              <div className="flex items-center justify-between text-sm py-2 border-b border-border">
                <span className="text-muted-foreground">Em trial</span>
                <span className="font-bold text-purple-400">{overview.trialingTenants}</span>
              </div>
              <div className="flex items-center justify-between text-sm py-2 border-b border-border">
                <span className="text-muted-foreground">Legacy (grandfathered)</span>
                <span className="font-bold text-cyan-400">{overview.legacyTenants}</span>
              </div>
              <div className="flex items-center justify-between text-sm py-2 border-b border-border">
                <span className="text-muted-foreground">Restritos / Expirados</span>
                <span className="font-bold text-red-400">{overview.restrictedTenants}</span>
              </div>
              <div className="flex items-center justify-between text-sm py-2 border-b border-border">
                <span className="text-muted-foreground">Cancelados</span>
                <span className="font-bold text-orange-400">{overview.cancelledTenants}</span>
              </div>
              <div className="flex items-center justify-between text-sm py-2">
                <span className="text-muted-foreground">Total de usuários</span>
                <span className="font-bold text-foreground">{overview.totalUsers}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ Row 5: Recent Webhook Events ═══ */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Últimos Eventos do Webhook
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {recentEvents.length} eventos
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {recentEvents.length === 0 ? (
              <div className="text-center py-8">
                <Webhook className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum evento recebido ainda</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure o webhook na Hotmart para começar a receber eventos
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Data</th>
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Evento</th>
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Status</th>
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Agência</th>
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Email</th>
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Processado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvents.map((event) => (
                      <tr key={event.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-2 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(event.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2.5 px-2">
                          <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded text-foreground">
                            {event.externalEvent}
                          </code>
                        </td>
                        <td className="py-2.5 px-2">
                          <EventStatusBadge status={event.internalStatus} />
                        </td>
                        <td className="py-2.5 px-2 text-xs text-foreground">
                          {event.tenantName || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground">
                          {event.buyerEmail || "—"}
                        </td>
                        <td className="py-2.5 px-2">
                          {event.processed ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          ) : event.errorMessage ? (
                            <div className="flex items-center gap-1" title={event.errorMessage}>
                              <XCircle className="w-4 h-4 text-red-400" />
                            </div>
                          ) : (
                            <Clock className="w-4 h-4 text-amber-400" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ Row 6: Monthly Breakdown Table ═══ */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Evolução Mensal Detalhada
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Mês</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">MRR</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Total</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Pagantes</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Trial</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Novos</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Churn</th>
                  </tr>
                </thead>
                <tbody>
                  {evolution.map((month, i) => {
                    const prevMrr = i > 0 ? evolution[i - 1].mrr : month.mrr;
                    const mrrChange = month.mrr - prevMrr;
                    return (
                      <tr key={month.month} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-foreground">{month.label}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="font-medium text-foreground">{formatCurrency(month.mrr)}</span>
                          {i > 0 && mrrChange !== 0 && (
                            <span className={`ml-1.5 text-[10px] ${mrrChange > 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {mrrChange > 0 ? "+" : ""}{formatCurrency(mrrChange)}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-foreground">{month.totalTenants}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-400">{month.activePaying}</td>
                        <td className="py-2.5 px-3 text-right text-purple-400">{month.trialing}</td>
                        <td className="py-2.5 px-3 text-right text-blue-400">+{month.newSignups}</td>
                        <td className="py-2.5 px-3 text-right text-red-400">{month.churned > 0 ? `-${month.churned}` : "0"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

// ─── Helper Components ─────────────────────────────────────────────

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  const isPositive = change >= 0;

  return (
    <Badge className={`text-xs ${isPositive ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
      {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
      {Math.abs(change).toFixed(1)}%
    </Badge>
  );
}

function EventStatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; label: string }> = {
    active: { className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Ativo" },
    trialing: { className: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "Trial" },
    past_due: { className: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Inadimplente" },
    cancelled: { className: "bg-orange-500/20 text-orange-400 border-orange-500/30", label: "Cancelado" },
    expired: { className: "bg-red-500/20 text-red-400 border-red-500/30", label: "Expirado" },
    restricted: { className: "bg-red-500/20 text-red-400 border-red-500/30", label: "Restrito" },
    refunded: { className: "bg-slate-500/20 text-slate-400 border-slate-500/30", label: "Reembolsado" },
    chargeback: { className: "bg-red-500/20 text-red-400 border-red-500/30", label: "Chargeback" },
    unknown: { className: "bg-slate-500/20 text-slate-400 border-slate-500/30", label: status },
  };

  const c = config[status] || config.unknown;
  return <Badge className={`${c.className} text-xs`}>{c.label}</Badge>;
}
