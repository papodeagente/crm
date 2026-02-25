import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Briefcase, Trophy, Inbox, TrendingUp, MessageSquare, Plane, ClipboardList } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";

const TENANT_ID = 1;

function MetricCard({ title, value, icon: Icon, subtitle, color }: { title: string; value: string | number; icon: any; subtitle?: string; color: string }) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

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
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-64" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const data = dashboard.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greeting()}, {user?.name?.split(" ")[0] || "Usuário"}</h1>
        <p className="text-muted-foreground mt-1">Aqui está o resumo da sua operação.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total de Contatos" value={data?.totalContacts ?? 0} icon={Users} color="bg-blue-600" subtitle="Cadastrados no CRM" />
        <MetricCard title="Negócios Abertos" value={data?.openDeals ?? 0} icon={Briefcase} color="bg-amber-600" subtitle="Em andamento" />
        <MetricCard title="Negócios Ganhos" value={data?.wonDeals ?? 0} icon={Trophy} color="bg-emerald-600" subtitle="Fechados com sucesso" />
        <MetricCard title="Conversas Abertas" value={data?.openConversations ?? 0} icon={Inbox} color="bg-purple-600" subtitle="Inbox ativo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Valor do Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((data?.pipelineValueCents ?? 0) / 100)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Valor total dos negócios abertos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { label: "Novo Contato", path: "/contacts", icon: Users },
              { label: "Novo Negócio", path: "/deals", icon: Briefcase },
              { label: "Nova Viagem", path: "/trips", icon: Plane },
              { label: "Nova Tarefa", path: "/tasks", icon: ClipboardList },
            ].map((a) => (
              <a
                key={a.path}
                href={a.path}
                className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-sm font-medium"
              >
                <a.icon className="h-4 w-4 text-muted-foreground" />
                {a.label}
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
