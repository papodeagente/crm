import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Plus } from "lucide-react";
import { toast } from "sonner";

const TENANT_ID = 1;

export default function Goals() {
  const goals = trpc.management.goals.list.useQuery({ tenantId: TENANT_ID });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Metas</h1><p className="text-muted-foreground">Defina e acompanhe metas da equipe.</p></div>
        <Button onClick={() => toast("Criação de meta em breve")}><Plus className="h-4 w-4 mr-2" />Nova Meta</Button>
      </div>
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/30"><th className="text-left p-3 font-medium">Métrica</th><th className="text-left p-3 font-medium">Alvo</th><th className="text-left p-3 font-medium">Atual</th><th className="text-left p-3 font-medium">Período</th></tr></thead>
        <tbody>
          {goals.isLoading ? <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
          : !goals.data?.length ? <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><Target className="h-8 w-8 mx-auto mb-2 opacity-40" />Nenhuma meta definida.</td></tr>
          : goals.data.map((g: any) => (
            <tr key={g.id} className="border-b hover:bg-muted/20">
              <td className="p-3 font-medium">{g.metricKey}</td>
              <td className="p-3">{g.targetValue}</td>
              <td className="p-3">{g.currentValue ?? 0}</td>
              <td className="p-3 text-muted-foreground">{g.periodStart ? new Date(g.periodStart).toLocaleDateString("pt-BR") : "—"} — {g.periodEnd ? new Date(g.periodEnd).toLocaleDateString("pt-BR") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table></div></CardContent></Card>
    </div>
  );
}
