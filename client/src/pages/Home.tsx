import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Briefcase, Trophy, Inbox, TrendingUp, Plane, ClipboardList, ArrowUpRight, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const TENANT_ID = 1;

const metricColors = [
  { bg: "bg-blue-50", icon: "bg-blue-500", text: "text-blue-600" },
  { bg: "bg-amber-50", icon: "bg-amber-500", text: "text-amber-600" },
  { bg: "bg-emerald-50", icon: "bg-emerald-500", text: "text-emerald-600" },
  { bg: "bg-violet-50", icon: "bg-violet-500", text: "text-violet-600" },
];

function MetricCard({ title, value, icon: Icon, subtitle, colorIdx }: { title: string; value: string | number; icon: any; subtitle?: string; colorIdx: number }) {
  const c = metricColors[colorIdx] || metricColors[0];
  return (
    <Card className="group relative overflow-hidden border-0 shadow-soft hover:shadow-soft-lg transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
            {subtitle && <p className="text-[12px] text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`h-11 w-11 rounded-xl ${c.icon} flex items-center justify-center shadow-sm`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const quickActions = [
  { label: "Novo Contato", path: "/contacts", icon: Users, desc: "Cadastrar cliente" },
  { label: "Novo Negócio", path: "/pipeline", icon: Briefcase, desc: "Criar negociação" },
  { label: "Nova Viagem", path: "/trips", icon: Plane, desc: "Montar roteiro" },
  { label: "Nova Tarefa", path: "/tasks", icon: ClipboardList, desc: "Agendar atividade" },
];

export default function Home() {
  const { user } = useAuth();
  const dashboard = trpc.insights.dashboard.useQuery({ tenantId: TENANT_ID });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  if (dashboard.isLoading) {
    return (
      <div className="page-content space-y-8">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-[180px] rounded-xl" />
          <Skeleton className="h-[180px] rounded-xl" />
        </div>
      </div>
    );
  }

  const data = dashboard.data;
  const pipelineValue = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((data?.pipelineValueCents ?? 0) / 100);

  return (
    <div className="page-content space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">
            {greeting()}, {user?.name?.split(" ")[0] || "Usuário"}
          </h1>
          <p className="text-[15px] text-muted-foreground mt-1">Aqui está o resumo da sua operação.</p>
        </div>
        <Link href="/pipeline">
          <Button className="hidden sm:flex gap-2 h-10 px-5 rounded-xl shadow-soft bg-gradient-to-r from-primary to-[oklch(0.50_0.14_264)] hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" />
            Nova Negociação
          </Button>
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard title="Total de Contatos" value={data?.totalContacts ?? 0} icon={Users} colorIdx={0} subtitle="Cadastrados no CRM" />
        <MetricCard title="Negócios Abertos" value={data?.openDeals ?? 0} icon={Briefcase} colorIdx={1} subtitle="Em andamento" />
        <MetricCard title="Negócios Ganhos" value={data?.wonDeals ?? 0} icon={Trophy} colorIdx={2} subtitle="Fechados com sucesso" />
        <MetricCard title="Conversas Abertas" value={data?.openConversations ?? 0} icon={Inbox} colorIdx={3} subtitle="Inbox ativo" />
      </div>

      {/* Pipeline Value + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Pipeline Value */}
        <Card className="lg:col-span-2 border-0 shadow-soft overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-accent/[0.04]" />
          <CardContent className="p-6 relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <span className="text-[13px] font-semibold text-muted-foreground">Valor do Pipeline</span>
            </div>
            <p className="text-[32px] font-bold tracking-tight text-foreground">{pipelineValue}</p>
            <p className="text-[13px] text-muted-foreground mt-2">Valor total dos negócios abertos</p>
            <Link href="/pipeline" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary mt-4 hover:underline">
              Ver pipeline <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-3 border-0 shadow-soft">
          <CardContent className="p-6">
            <p className="text-[13px] font-semibold text-muted-foreground mb-4">Ações Rápidas</p>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((a) => (
                <Link key={a.path} href={a.path}>
                  <div className="group flex items-center gap-3.5 p-4 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/[0.03] transition-all duration-200 cursor-pointer">
                    <div className="h-10 w-10 rounded-xl bg-muted/80 group-hover:bg-primary/10 flex items-center justify-center transition-colors duration-200 shrink-0">
                      <a.icon className="h-4.5 w-4.5 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">{a.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{a.desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
