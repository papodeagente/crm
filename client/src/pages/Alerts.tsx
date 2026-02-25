import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

const TENANT_ID = 1;
const severityIcons: Record<string, any> = { critical: AlertTriangle, warning: AlertTriangle, info: Info, success: CheckCircle2 };
const severityColors: Record<string, string> = { critical: "bg-red-100 text-red-700", warning: "bg-amber-100 text-amber-700", info: "bg-blue-100 text-blue-700", success: "bg-emerald-100 text-emerald-700" };

export default function Alerts() {
  const alerts = trpc.insights.alerts.list.useQuery({ tenantId: TENANT_ID });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Alertas</h1><p className="text-muted-foreground">Notificações e alertas do sistema.</p></div>
      {alerts.isLoading ? <p className="text-muted-foreground">Carregando...</p>
      : !alerts.data?.length ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><Bell className="h-12 w-12 mx-auto mb-4 opacity-40" /><p>Nenhum alerta no momento.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {alerts.data.map((a: any) => {
            const Icon = severityIcons[a.severity] || Info;
            return (
              <Card key={a.id}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${severityColors[a.severity] || "bg-muted"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{a.title}</p>
                      <Badge variant="secondary" className={`text-[10px] ${severityColors[a.severity] || ""}`}>{a.severity}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{a.description || "Sem detalhes"}</p>
                    <p className="text-xs text-muted-foreground mt-2">{a.createdAt ? new Date(a.createdAt).toLocaleString("pt-BR") : "—"}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
