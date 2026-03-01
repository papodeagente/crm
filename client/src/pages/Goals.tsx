import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Plus, Calendar } from "lucide-react";
import { formatDate } from "../../../shared/dateUtils";
import { toast } from "sonner";
import { useTenantId } from "@/hooks/useTenantId";


export default function Goals() {
  const TENANT_ID = useTenantId();
  const goals = trpc.management.goals.list.useQuery({ tenantId: TENANT_ID });

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Metas</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Defina e acompanhe metas da equipe.</p>
        </div>
        <Button className="h-9 gap-2 px-5 rounded-lg bg-primary hover:bg-primary/90 shadow-sm text-[13px] font-medium transition-colors" onClick={() => toast("Criação de meta em breve")}>
          <Plus className="h-4 w-4" />Nova Meta
        </Button>
      </div>

      {/* Goals grid */}
      {goals.isLoading ? (
        <p className="text-[13px] text-muted-foreground text-center py-12">Carregando...</p>
      ) : !goals.data?.length ? (
        <Card className="border border-border/40 shadow-none rounded-xl">
          <div className="p-12 text-center text-muted-foreground">
            <Target className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-[14px] font-medium text-muted-foreground/60">Nenhuma meta definida</p>
            <p className="text-[13px] text-muted-foreground/40 mt-1">Crie metas para acompanhar o desempenho da equipe.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.data.map((g: any) => {
            const pct = g.targetValue > 0 ? Math.min(100, Math.round(((g.currentValue ?? 0) / g.targetValue) * 100)) : 0;
            const isComplete = pct >= 100;
            return (
              <Card key={g.id} className="border border-border/40 shadow-none rounded-xl hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${isComplete ? "bg-emerald-50" : "bg-primary/10"}`}>
                        <Target className={`h-4 w-4 ${isComplete ? "text-emerald-600" : "text-primary"}`} />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold">{g.metricKey}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {g.periodStart ? formatDate(g.periodStart) : "—"} — {g.periodEnd ? formatDate(g.periodEnd) : "—"}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[20px] font-bold ${isComplete ? "text-emerald-600" : "text-foreground"}`}>{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-muted-foreground">Atual: {g.currentValue ?? 0}</span>
                    <span className="text-[11px] text-muted-foreground">Alvo: {g.targetValue}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
