import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, Briefcase, Trophy, Inbox, TrendingUp } from "lucide-react";

const TENANT_ID = 1;

export default function Insights() {
  const dashboard = trpc.insights.dashboard.useQuery({ tenantId: TENANT_ID });
  const d = dashboard.data;

  const metrics = [
    { label: "Contatos", value: d?.totalContacts ?? 0, icon: Users, color: "text-blue-600" },
    { label: "Negócios Abertos", value: d?.openDeals ?? 0, icon: Briefcase, color: "text-amber-600" },
    { label: "Negócios Ganhos", value: d?.wonDeals ?? 0, icon: Trophy, color: "text-emerald-600" },
    { label: "Conversas Abertas", value: d?.openConversations ?? 0, icon: Inbox, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Insights</h1><p className="text-muted-foreground">Métricas e análises do seu CRM.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${m.color}`}><m.icon className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold">{m.value}</p><p className="text-xs text-muted-foreground">{m.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Valor Total do Pipeline</CardTitle></CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((d?.pipelineValueCents ?? 0) / 100)}</p>
          <p className="text-sm text-muted-foreground mt-2">Soma de todos os negócios abertos</p>
        </CardContent>
      </Card>
    </div>
  );
}
