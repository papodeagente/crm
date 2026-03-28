import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft, Building2, Users, Handshake, DollarSign, MessageSquare,
  Wifi, WifiOff, Brain, Zap, Loader2, Calendar, Target, Activity,
  AlertTriangle, TrendingUp, ShieldAlert, CheckCircle, XCircle,
  Lightbulb, Clock, BarChart3, Mail
} from "lucide-react";

const fmt = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

function MaturityBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-emerald-400" : value >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">{value}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function MetricRow({ label, value, icon: Icon }: { label: string; value: string | number; icon?: any }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </div>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function SuperAdminTenantDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/super-admin/tenant/:id");
  const tenantId = Number(params?.id);

  const meQuery = trpc.saasAuth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });

  const detailQ = trpc.superAdminDash.tenantDetail.useQuery(
    { tenantId },
    { enabled: !!meQuery.data?.isSuperAdmin && tenantId > 0, staleTime: 30_000 }
  );

  const usersQ = trpc.superAdminDash.tenantUsers.useQuery(
    { tenantId },
    { enabled: !!meQuery.data?.isSuperAdmin && tenantId > 0, staleTime: 60_000 }
  );

  const helpQ = trpc.superAdminDash.strategicHelp.useQuery(
    { tenantId },
    { enabled: !!meQuery.data?.isSuperAdmin && tenantId > 0, staleTime: 120_000 }
  );

  if (meQuery.isLoading || detailQ.isLoading) {
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
          </CardContent>
        </Card>
      </div>
    );
  }

  if (detailQ.error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md border-border">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-foreground">Tenant não encontrado</h2>
            <Button onClick={() => navigate("/super-admin/tenants")} className="mt-4">Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = detailQ.data;
  if (!d) return null;

  const maturityLevelColor: Record<string, string> = {
    "Inicial": "text-red-400",
    "Em adoção": "text-amber-400",
    "Operando": "text-blue-400",
    "Maduro": "text-emerald-400",
    "Avançado": "text-purple-400",
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/super-admin/tenants")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{d.tenant.name}</h1>
            <Badge className={
              d.tenant.billingStatus === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" :
              d.tenant.billingStatus === "trialing" ? "bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/20" :
              "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20"
            }>
              {d.tenant.billingStatus || d.tenant.status}
            </Badge>
            <Badge variant="secondary" className="capitalize">{d.tenant.plan}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Conta criada há {d.tenant.accountAge} dias — ID: {d.tenant.id}
          </p>
        </div>
      </div>

      {/* Resumo Executivo */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Usuários Ativos</p>
            <p className="text-xl font-bold text-foreground">{d.metrics.usersActive}</p>
            <p className="text-[10px] text-muted-foreground">{d.metrics.usersActive7d} nos últimos 7d</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Negociações Abertas</p>
            <p className="text-xl font-bold text-foreground">{d.metrics.dealsOpen}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Vendas (mês)</p>
            <p className="text-xl font-bold text-emerald-400">{d.metrics.dealsWonMonth}</p>
            <p className="text-[10px] text-muted-foreground">{fmt(d.metrics.wonCentsMonth)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Ticket Médio</p>
            <p className="text-xl font-bold text-foreground">{fmt(d.metrics.avgTicketCents)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Conversão</p>
            <p className="text-xl font-bold text-foreground">{d.metrics.conversionRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics + Maturity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Metrics */}
        <Card className="border-border/50 lg:col-span-1">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Métricas Detalhadas</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <MetricRow label="Contatos" value={fmtNum(d.metrics.contactsTotal)} icon={Users} />
            <MetricRow label="Tarefas (mês)" value={d.metrics.tasksCreatedMonth} icon={Activity} />
            <MetricRow label="Tarefas Concluídas" value={d.metrics.tasksDone} icon={CheckCircle} />
            <MetricRow label="WA Conectados" value={`${d.metrics.waConnected}/${d.metrics.waTotal}`} icon={Wifi} />
            <MetricRow label="Mensagens WA (mês)" value={fmtNum(d.metrics.waMessagesMonth)} icon={MessageSquare} />
            <MetricRow label="Integrações" value={d.metrics.integrationsActive} icon={Zap} />
            <MetricRow label="IA Ativada" value={d.metrics.aiEnabled > 0 ? "Sim" : "Não"} icon={Brain} />
            <MetricRow label="Funis" value={d.metrics.pipelinesCount} icon={BarChart3} />
            <MetricRow label="Automações" value={d.metrics.automationsActive} icon={Activity} />
            <MetricRow label="Propostas" value={d.metrics.proposalsTotal} icon={Target} />
            {d.metrics.subPriceCents > 0 && (
              <MetricRow label="Assinatura" value={fmt(d.metrics.subPriceCents) + "/mês"} icon={DollarSign} />
            )}
          </CardContent>
        </Card>

        {/* Maturity */}
        <Card className="border-border/50 lg:col-span-1">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Maturidade de Uso
              <span className={`text-xs font-bold ${maturityLevelColor[d.maturityLevel] || "text-foreground"}`}>
                {d.maturityLevel} ({d.avgMaturity}%)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <MaturityBar label="CRM" value={d.maturity.crm} />
            <MaturityBar label="Funil" value={d.maturity.pipeline} />
            <MaturityBar label="Tarefas" value={d.maturity.tasks} />
            <MaturityBar label="WhatsApp" value={d.maturity.whatsapp} />
            <MaturityBar label="Automações" value={d.maturity.automations} />
            <MaturityBar label="Relatórios" value={d.maturity.reports} />
            <MaturityBar label="IA" value={d.maturity.ai} />
            <MaturityBar label="Integrações" value={d.maturity.integrations} />
          </CardContent>
        </Card>

        {/* Risks + Opportunities */}
        <div className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Sinais de Risco
                {d.risks.length > 0 && <Badge variant="destructive" className="text-[10px] ml-auto">{d.risks.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {d.risks.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum sinal de risco identificado</p>
              ) : (
                <ul className="space-y-1.5">
                  {d.risks.map((r: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span className="text-foreground">{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Oportunidades
                {d.opportunities.length > 0 && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] ml-auto hover:bg-emerald-500/20">{d.opportunities.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {d.opportunities.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Tenant já utiliza bem os recursos</p>
              ) : (
                <ul className="space-y-1.5">
                  {d.opportunities.map((o: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Lightbulb className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-foreground">{o}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Strategic Help */}
      {helpQ.data && helpQ.data.recommendations.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              Recomendações Estratégicas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {helpQ.data.recommendations.map((rec: any, i: number) => (
                <div key={i} className={`p-3 rounded-lg border ${
                  rec.type === "risk" ? "border-red-500/20 bg-red-500/5" :
                  rec.type === "opportunity" ? "border-emerald-500/20 bg-emerald-500/5" :
                  "border-amber-500/20 bg-amber-500/5"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {rec.type === "risk" ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> :
                     rec.type === "opportunity" ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> :
                     <Target className="w-3.5 h-3.5 text-amber-400" />}
                    <span className="text-xs font-semibold text-foreground">{rec.title}</span>
                    <Badge variant="secondary" className="text-[9px] ml-auto capitalize">{rec.priority}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{rec.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            Usuários ({usersQ.data?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {usersQ.isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (usersQ.data || []).length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Nenhum usuário cadastrado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Nome</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Email</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Cargo</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Último Acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {(usersQ.data || []).map((u: any) => (
                    <tr key={u.id} className="border-b border-border/30">
                      <td className="py-2 px-2 text-foreground">{u.name}</td>
                      <td className="py-2 px-2 text-muted-foreground text-xs">{u.email}</td>
                      <td className="py-2 px-2 text-muted-foreground text-xs capitalize">{u.role}</td>
                      <td className="py-2 px-2">
                        <Badge className={u.status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] hover:bg-emerald-500/20" : "bg-red-500/20 text-red-400 border-red-500/30 text-[10px] hover:bg-red-500/20"}>
                          {u.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground text-xs">
                        {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString("pt-BR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
