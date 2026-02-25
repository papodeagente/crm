import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Bell, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

const TENANT_ID = 1;

const severityConfig: Record<string, { icon: any; bg: string; iconBg: string; iconColor: string; label: string }> = {
  critical: { icon: AlertTriangle, bg: "border-l-4 border-l-red-500", iconBg: "bg-red-50", iconColor: "text-red-600", label: "Crítico" },
  warning: { icon: AlertTriangle, bg: "border-l-4 border-l-amber-500", iconBg: "bg-amber-50", iconColor: "text-amber-600", label: "Aviso" },
  info: { icon: Info, bg: "border-l-4 border-l-blue-500", iconBg: "bg-blue-50", iconColor: "text-blue-600", label: "Info" },
  success: { icon: CheckCircle2, bg: "border-l-4 border-l-emerald-500", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", label: "Sucesso" },
};

export default function Alerts() {
  const alerts = trpc.insights.alerts.list.useQuery({ tenantId: TENANT_ID });

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Alertas</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Notificações e alertas do sistema.</p>
      </div>

      {alerts.isLoading ? (
        <p className="text-[13px] text-muted-foreground text-center py-12">Carregando...</p>
      ) : !alerts.data?.length ? (
        <Card className="border-0 shadow-soft rounded-2xl">
          <div className="p-12 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-[14px] font-medium text-muted-foreground/60">Nenhum alerta no momento</p>
            <p className="text-[13px] text-muted-foreground/40 mt-1">Você será notificado quando houver algo importante.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.data.map((a: any) => {
            const cfg = severityConfig[a.severity] || severityConfig["info"];
            const Icon = cfg.icon;
            return (
              <Card key={a.id} className={`border-0 shadow-soft rounded-2xl overflow-hidden ${cfg.bg}`}>
                <div className="p-5 flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${cfg.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <p className="text-[14px] font-semibold">{a.title}</p>
                      <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.iconBg} ${cfg.iconColor}`}>{cfg.label}</span>
                    </div>
                    <p className="text-[13px] text-muted-foreground mt-1.5">{a.description || "Sem detalhes"}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-2">{a.createdAt ? new Date(a.createdAt).toLocaleString("pt-BR") : "—"}</p>
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
