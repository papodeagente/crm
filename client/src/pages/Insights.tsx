import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Users, Briefcase, Trophy, Inbox, TrendingUp, DollarSign } from "lucide-react";

const TENANT_ID = 1;

export default function Insights() {
  const dashboard = trpc.insights.dashboard.useQuery({ tenantId: TENANT_ID });
  const d = dashboard.data;

  const metrics = [
    { label: "Contatos", value: d?.totalContacts ?? 0, icon: Users, bg: "bg-blue-50", iconColor: "text-blue-600" },
    { label: "Negócios Abertos", value: d?.openDeals ?? 0, icon: Briefcase, bg: "bg-amber-50", iconColor: "text-amber-600" },
    { label: "Negócios Ganhos", value: d?.wonDeals ?? 0, icon: Trophy, bg: "bg-emerald-50", iconColor: "text-emerald-600" },
    { label: "Conversas Abertas", value: d?.openConversations ?? 0, icon: Inbox, bg: "bg-violet-50", iconColor: "text-violet-600" },
  ];

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Insights</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Métricas e análises do seu CRM.</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label} className="border border-border/40 shadow-none rounded-xl hover:shadow-md transition-shadow">
            <div className="p-5 flex items-center gap-4">
              <div className={`h-11 w-11 rounded-xl ${m.bg} flex items-center justify-center shrink-0`}>
                <m.icon className={`h-5 w-5 ${m.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{dashboard.isLoading ? "—" : m.value}</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mt-0.5">{m.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pipeline value */}
      <Card className="border border-border/40 shadow-none rounded-xl">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[14px] font-semibold">Valor Total do Pipeline</p>
              <p className="text-[12px] text-muted-foreground">Soma de todos os negócios abertos</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <DollarSign className="h-6 w-6 text-emerald-600" />
            <p className="text-4xl font-bold tracking-tight">
              {dashboard.isLoading ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((d?.pipelineValueCents ?? 0) / 100)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
