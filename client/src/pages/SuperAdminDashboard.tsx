import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Building2, Users, Handshake, DollarSign, MessageSquare, Wifi,
  WifiOff, Zap, Brain, CreditCard, TrendingDown, TrendingUp,
  AlertTriangle, Loader2, ArrowRight, BarChart3, Activity,
  Target, ShieldAlert, Gauge
} from "lucide-react";

const fmt = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
const pctChange = (curr: number, prev: number) => {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
};

function KpiCard({ title, value, subtitle, icon: Icon, color = "text-primary", trend }: {
  title: string; value: string | number; subtitle?: string;
  icon: any; color?: string; trend?: number | null;
}) {
  return (
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">{title}</p>
            <p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 text-foreground truncate">{value}</p>
            {subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-current/10 shrink-0 ${color}`}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
        {trend !== undefined && trend !== null && (
          <div className={`flex items-center gap-1 mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-medium ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend >= 0 ? "+" : ""}{trend}% vs mês anterior
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniBarChart({ data, label }: { data: { month: string; count: number }[]; label: string }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
        {data.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Sem dados no período</p>
        ) : (
          <div className="flex items-end gap-0.5 sm:gap-1 h-20 sm:h-24">
            {data.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5 sm:gap-1">
                <div
                  className="w-full bg-primary/70 rounded-t-sm min-h-[2px] transition-all hover:bg-primary"
                  style={{ height: `${Math.max((d.count / max) * 100, 2)}%` }}
                  title={`${d.month}: ${fmtNum(d.count)}`}
                />
                <span className="text-[8px] sm:text-[9px] text-muted-foreground leading-none">
                  {d.month.slice(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertBlock({ title, items, icon: Icon, color }: {
  title: string; items: { id: number; name: string; plan?: string; extra?: string }[];
  icon: any; color: string;
}) {
  const [, navigate] = useLocation();
  if (items.length === 0) return null;
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
        <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="truncate">{title}</span>
          <Badge variant="secondary" className="text-[10px] sm:text-xs ml-auto shrink-0">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-4 pb-3">
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(`/super-admin/tenant/${item.id}`)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors text-left group"
            >
              <span className="text-xs sm:text-sm text-foreground truncate">{item.name}</span>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {item.extra && <span className="text-[10px] sm:text-xs text-muted-foreground hidden xs:inline">{item.extra}</span>}
                <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminDashboard() {
  const [, navigate] = useLocation();
  const meQuery = trpc.saasAuth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });

  const overviewQ = trpc.superAdminDash.overview.useQuery(undefined, {
    enabled: !!meQuery.data?.isSuperAdmin,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const chartsQ = trpc.superAdminDash.overviewCharts.useQuery(undefined, {
    enabled: !!meQuery.data?.isSuperAdmin,
    staleTime: 120_000,
  });

  const alertsQ = trpc.superAdminDash.alerts.useQuery(undefined, {
    enabled: !!meQuery.data?.isSuperAdmin,
    staleTime: 60_000,
  });

  if (meQuery.isLoading || overviewQ.isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!meQuery.data?.isSuperAdmin) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Card className="max-w-md border-border">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-foreground">Acesso Restrito</h2>
            <p className="text-muted-foreground">Esta área é exclusiva para Super Admins.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = overviewQ.data;
  const charts = chartsQ.data;
  const alerts = alertsQ.data;

  const dealsTrend = d ? pctChange(d.dealsCreatedMonth, d.dealsCreatedPrevMonth) : null;
  const revenueTrend = d ? pctChange(d.wonCentsMonth, d.wonCentsPrevMonth) : null;

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Visão Geral</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Painel executivo do SaaS — dados consolidados</p>
      </div>

      {/* KPIs Grid — responsive: 2 cols mobile, 3 tablet, 4-5 desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
        <KpiCard title="Tenants Ativos" value={fmtNum(d?.tenantsActive || 0)} subtitle={`${d?.tenantsTotal || 0} total`} icon={Building2} color="text-blue-400" />
        <KpiCard title="Usuários Ativos" value={fmtNum(d?.usersActive || 0)} subtitle={`${d?.usersActive7d || 0} nos últimos 7d`} icon={Users} color="text-purple-400" />
        <KpiCard title="Negociações (mês)" value={fmtNum(d?.dealsCreatedMonth || 0)} icon={Handshake} color="text-amber-400" trend={dealsTrend} />
        <KpiCard title="Vendas (mês)" value={fmtNum(d?.dealsWonMonth || 0)} subtitle={`${d?.dealsLostMonth || 0} perdidas`} icon={Target} color="text-emerald-400" />
        <KpiCard title="Receita (mês)" value={fmt(d?.wonCentsMonth || 0)} icon={DollarSign} color="text-green-400" trend={revenueTrend} />
        <KpiCard title="Taxa Conversão" value={`${d?.conversionRate || 0}%`} icon={BarChart3} color="text-cyan-400" />
        <KpiCard title="Ticket Médio" value={fmt(d?.avgTicketCents || 0)} icon={CreditCard} color="text-indigo-400" />
        <KpiCard title="Mensagens WA" value={fmtNum(d?.waMessagesMonth || 0)} icon={MessageSquare} color="text-emerald-400" />
        <KpiCard title="WA Conectados" value={`${d?.waConnected || 0}/${d?.waTotal || 0}`} icon={Wifi} color="text-green-400" />
        <KpiCard title="Integrações" value={fmtNum(d?.integrationsActive || 0)} icon={Zap} color="text-yellow-400" />
        <KpiCard title="Tenants com IA" value={fmtNum(d?.tenantsWithAI || 0)} icon={Brain} color="text-pink-400" />
        <KpiCard title="Em Trial" value={fmtNum(d?.tenantsTrial || 0)} icon={Activity} color="text-purple-400" />
        <KpiCard title="Pagantes" value={fmtNum(d?.tenantsPaying || 0)} icon={CreditCard} color="text-emerald-400" />
        <KpiCard title="Inadimplentes" value={fmtNum(d?.tenantsOverdue || 0)} icon={AlertTriangle} color="text-red-400" />
        <KpiCard title="MRR Estimado" value={fmt(d?.mrrCents || 0)} icon={TrendingUp} color="text-green-400" />
        <KpiCard title="Churn" value={fmtNum(d?.tenantsChurned || 0)} icon={TrendingDown} color="text-red-400" />
        <KpiCard title="Sem Uso (30d)" value={fmtNum(d?.tenantsNoRecentUse || 0)} icon={Gauge} color="text-orange-400" />
        <KpiCard title="Contatos Total" value={fmtNum(d?.contactsTotal || 0)} icon={Users} color="text-blue-400" />
        <KpiCard title="Tarefas (mês)" value={fmtNum(d?.tasksCreatedMonth || 0)} icon={Activity} color="text-teal-400" />
        <KpiCard title="Negociações Abertas" value={fmtNum(d?.dealsOpenTotal || 0)} icon={Handshake} color="text-amber-400" />
      </div>

      {/* Charts — responsive: 1 col mobile, 2 tablet, 3 desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <MiniBarChart data={charts?.tenantsPerMonth || []} label="Novos Tenants por Mês" />
        <MiniBarChart data={charts?.dealsPerMonth || []} label="Negociações Criadas por Mês" />
        <MiniBarChart data={charts?.waPerMonth || []} label="Mensagens WhatsApp por Mês" />
      </div>

      {/* Plan Distribution */}
      {charts?.planDistribution && charts.planDistribution.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Distribuição por Plano</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
            <div className="flex gap-3 sm:gap-4 flex-wrap">
              {charts.planDistribution.map((p: any) => (
                <div key={p.plan} className="flex items-center gap-1.5 sm:gap-2">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${
                    p.plan === "pro" ? "bg-purple-400" : p.plan === "enterprise" ? "bg-blue-400" : "bg-gray-400"
                  }`} />
                  <span className="text-xs sm:text-sm text-foreground font-medium capitalize">{p.plan || "free"}</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">({p.count})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts — responsive: 1 col mobile, 2 desktop */}
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-foreground mb-2 sm:mb-3">Alertas e Atenção</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <AlertBlock
            title="WhatsApp Desconectado"
            items={(alerts?.waDisconnected || []).map((t: any) => ({ ...t, extra: t.plan }))}
            icon={WifiOff}
            color="text-red-400"
          />
          <AlertBlock
            title="Sem Atividade (30 dias)"
            items={(alerts?.noActivity || []).map((t: any) => ({ ...t, extra: t.plan }))}
            icon={TrendingDown}
            color="text-orange-400"
          />
          <AlertBlock
            title="Inadimplentes"
            items={(alerts?.overdue || []).map((t: any) => ({ ...t, extra: t.billingStatus }))}
            icon={AlertTriangle}
            color="text-red-400"
          />
          <AlertBlock
            title="Baixa Adoção Comercial"
            items={(alerts?.lowAdoption || []).map((t: any) => ({ ...t, extra: `${t.userCount} users, ${t.recentDeals} deals` }))}
            icon={BarChart3}
            color="text-amber-400"
          />
        </div>
      </div>
    </div>
  );
}
