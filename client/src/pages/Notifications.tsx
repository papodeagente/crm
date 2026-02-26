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

export default function NotificationsPage() {
  const alerts = trpc.insights.alerts.list.useQuery({ tenantId: TENANT_ID });

  return (
    <div className="page-content max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{
            background: "linear-gradient(135deg, oklch(0.65 0.24 25), oklch(0.58 0.24 15))"
          }}>
            <Bell className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notificações</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Alertas e atualizações importantes do sistema</p>
          </div>
        </div>
      </div>

      {alerts.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="surface p-5 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-muted rounded" />
                  <div className="h-3 w-full bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !alerts.data?.length ? (
        <div className="surface">
          <div className="p-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Bell className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p className="text-[15px] font-medium text-muted-foreground/60">Nenhuma notificação</p>
            <p className="text-[13px] text-muted-foreground/40 mt-1.5">Você será notificado quando houver algo importante.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.data.map((a: any) => {
            const cfg = severityConfig[a.severity] || severityConfig["info"];
            const Icon = cfg.icon;
            return (
              <div key={a.id} className={`surface overflow-hidden ${cfg.bg}`}>
                <div className="p-5 flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${cfg.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <p className="text-[14px] font-semibold text-foreground">{a.title}</p>
                      <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.iconBg} ${cfg.iconColor}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground mt-1.5">{a.description || "Sem detalhes"}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-2">
                      {a.createdAt ? new Date(a.createdAt).toLocaleString("pt-BR") : "—"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
