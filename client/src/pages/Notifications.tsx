import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Bell, MessageSquare, ArrowRightLeft, UserPlus, ClipboardList, Briefcase, Check, CheckCheck, TrendingUp } from "lucide-react";
import { formatDate } from "../../../shared/dateUtils";
import { useLocation } from "wouter";
import { useTenantId } from "@/hooks/useTenantId";


const typeConfig: Record<string, { icon: any; bg: string; iconBg: string; iconColor: string; label: string; route?: (entityId: string) => string }> = {
  whatsapp_message: {
    icon: MessageSquare,
    bg: "border-l-4 border-l-emerald-500",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    label: "WhatsApp",
    route: () => "/settings/inbox",
  },
  deal_moved: {
    icon: ArrowRightLeft,
    bg: "border-l-4 border-l-indigo-500",
    iconBg: "bg-indigo-500/15",
    iconColor: "text-indigo-400",
    label: "Pipeline",
    route: (id) => `/deals/${id}`,
  },
  deal_created: {
    icon: Briefcase,
    bg: "border-l-4 border-l-blue-500",
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-400",
    label: "Negociação",
    route: (id) => `/deals/${id}`,
  },
  contact_created: {
    icon: UserPlus,
    bg: "border-l-4 border-l-violet-500",
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-400",
    label: "Contato",
    route: (id) => `/contacts?id=${id}`,
  },
  task_created: {
    icon: ClipboardList,
    bg: "border-l-4 border-l-amber-500",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
    label: "Tarefa",
    route: () => "/tasks",
  },
  rfv_filter_alert: {
    icon: TrendingUp,
    bg: "border-l-4 border-l-orange-500",
    iconBg: "bg-orange-500/15",
    iconColor: "text-orange-400",
    label: "Matriz RFV",
    route: (filterKey) => `/rfv?filter=${filterKey}`,
  },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  return formatDate(ts);
}

export default function NotificationsPage() {
  const TENANT_ID = useTenantId();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const notifications = trpc.notifications.list.useQuery({ tenantId: TENANT_ID, limit: 100 });
  const unreadCount = trpc.notifications.unreadCount.useQuery({ tenantId: TENANT_ID });

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const handleClick = (n: any) => {
    if (!n.isRead) {
      markRead.mutate({ id: n.id });
    }
    const cfg = typeConfig[n.type];
    if (cfg?.route && n.entityId) {
      navigate(cfg.route(n.entityId));
    }
  };

  return (
    <div className="page-content max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{
            background: "linear-gradient(135deg, oklch(0.55 0.25 270), oklch(0.60 0.25 320), oklch(0.65 0.20 200))"
          }}>
            <Bell className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notificações</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {(unreadCount.data ?? 0) > 0
                ? `${unreadCount.data} não lida${(unreadCount.data ?? 0) > 1 ? "s" : ""}`
                : "Todas lidas"}
            </p>
          </div>
        </div>
        {(unreadCount.data ?? 0) > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate({ tenantId: TENANT_ID })}
            disabled={markAllRead.isPending}
            className="gap-1.5 text-[13px]"
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {notifications.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
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
      ) : !notifications.data?.length ? (
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
        <div className="space-y-2">
          {notifications.data.map((n: any) => {
            const cfg = typeConfig[n.type] || typeConfig["whatsapp_message"];
            const Icon = cfg.icon;
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`surface overflow-hidden cursor-pointer transition-all hover:shadow-md ${cfg.bg} ${!n.isRead ? "bg-primary/[0.03]" : ""}`}
              >
                <div className="p-4 flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${cfg.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <p className={`text-[14px] font-semibold text-foreground ${!n.isRead ? "" : "opacity-70"}`}>
                        {n.title}
                      </p>
                      <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.iconBg} ${cfg.iconColor}`}>
                        {cfg.label}
                      </span>
                      {!n.isRead && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    {n.body && (
                      <p className={`text-[13px] text-muted-foreground mt-1 line-clamp-2 ${n.isRead ? "opacity-60" : ""}`}>
                        {n.body}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markRead.mutate({ id: n.id }); }}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
                      title="Marcar como lida"
                    >
                      <Check className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
