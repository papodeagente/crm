import { useState, useMemo } from "react";
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
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">{title}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-current/10 shrink-0 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {trend !== undefined && trend !== null && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
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
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {data.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Sem dados no período</p>
        ) : (
          <div className="flex items-end gap-1 h-24">
            {data.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-primary/70 rounded-t-sm min-h-[2px] transition-all hover:bg-primary"
                  style={{ height: `${Math.max((d.count / max) * 100, 2)}%` }}
                  title={`${d.month}: ${fmtNum(d.count)}`}
                />
                <span className="text-[9px] text-muted-foreground leading-none">
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
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          {title}
          <Badge variant="secondary" className="text-xs ml-auto">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(`/super-admin/tenant/${item.id}`)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors text-left group"
            >
              <span className="text-sm text-foreground truncate">{item.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                {item.extra && <span className="text-xs text-muted-foreground">{item.extra}</span>}
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!meQuery.data?.isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
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
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Visão Geral</h1>
        <p className="text-sm text-muted-foreground mt-1">Painel executivo do SaaS — dados consolidados de todos os tenants</p>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <KpiCard title="Tenants Ativos" value={fmtNum(d?.tenantsActive || 0)} subtitle={`${d?.tenantsTotal || 0} total`} icon={Building2} color="text-blue-400" />
        <KpiCard title="Usuários Ativos" value={fmtNum(d?.usersActive || 0)} subtitle={`${d?.usersActive7d || 0} nos últimos 7d`} icon={Users} color="text-purple-400" />
        <KpiCard title="Negociações (mês)" value={fmtNum(d?.dealsCreatedMonth || 0)} icon={Handshake} color="text-amber-400" trend={dealsTrend} />
        <KpiCard title="Vendas (mês)" value={fmtNum(d?.dealsWonMonth || 0)} subtitle={`${d?.dealsLostMonth || 0} perdidas`} icon={Target} color="text-emerald-400" />
        <KpiCard title="Receita (mês)" value={fmt(d?.wonCentsMonth || 0)} icon={DollarSign} color="text-green-400" trend={revenueTrend} />
        <KpiCard title="Taxa Conversão" value={`${d?.conversionRate || 0}%`} icon={BarChart3} color="text-cyan-400" />
        <KpiCard title="Ticket Médio" value={fmt(d?.avgTicketCents || 0)} icon={CreditCard} color="text-indigo-400" />
        <KpiCard title="Mensagens WA (mês)" value={fmtNum(d?.waMessagesMonth || 0)} icon={MessageSquare} color="text-emerald-400" />
        <KpiCard title="WA Conectados" value={`${d?.waConnected || 0}/${d?.waTotal || 0}`} icon={Wifi} color="text-green-400" />
        <KpiCard title="Integrações Ativas" value={fmtNum(d?.integrationsActive || 0)} icon={Zap} color="text-yellow-400" />
        <KpiCard title="Tenants com IA" value={fmtNum(d?.tenantsWithAI || 0)} icon={Brain} color="text-pink-400" />
        <KpiCard title="Em Trial" value={fmtNum(d?.tenantsTrial || 0)} icon={Activity} color="text-purple-400" />
        <KpiCard title="Pagantes" value={fmtNum(d?.tenantsPaying || 0)} icon={CreditCard} color="text-emerald-400" />
        <KpiCard title="Inadimplentes" value={fmtNum(d?.tenantsOverdue || 0)} icon={AlertTriangle} color="text-red-400" />
        <KpiCard title="MRR Estimado" value={fmt(d?.mrrCents || 0)} icon={TrendingUp} color="text-green-400" />
        <KpiCard title="Churn (período)" value={fmtNum(d?.tenantsChurned || 0)} icon={TrendingDown} color="text-red-400" />
        <KpiCard title="Sem Uso Recente" value={fmtNum(d?.tenantsNoRecentUse || 0)} subtitle="30 dias sem atividade" icon={Gauge} color="text-orange-400" />
        <KpiCard title="Contatos Total" value={fmtNum(d?.contactsTotal || 0)} icon={Users} color="text-blue-400" />
        <KpiCard title="Tarefas (mês)" value={fmtNum(d?.tasksCreatedMonth || 0)} icon={Activity} color="text-teal-400" />
        <KpiCard title="Negociações Abertas" value={fmtNum(d?.dealsOpenTotal || 0)} icon={Handshake} color="text-amber-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MiniBarChart data={charts?.tenantsPerMonth || []} label="Novos Tenants por Mês" />
        <MiniBarChart data={charts?.dealsPerMonth || []} label="Negociações Criadas por Mês" />
        <MiniBarChart data={charts?.waPerMonth || []} label="Mensagens WhatsApp por Mês" />
      </div>

      {/* Plan Distribution */}
      {charts?.planDistribution && charts.planDistribution.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Distribuição por Plano</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex gap-4 flex-wrap">
              {charts.planDistribution.map((p: any) => (
                <div key={p.plan} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    p.plan === "pro" ? "bg-purple-400" : p.plan === "enterprise" ? "bg-blue-400" : "bg-gray-400"
                  }`} />
                  <span className="text-sm text-foreground font-medium capitalize">{p.plan || "free"}</span>
                  <span className="text-sm text-muted-foreground">({p.count})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Alertas e Atenção</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
