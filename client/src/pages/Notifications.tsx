import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Bell, MessageSquare, ArrowRightLeft, UserPlus, ClipboardList, Briefcase,
  Check, CheckCheck, TrendingUp, Settings2, Clock, Cake, Heart,
  Wifi, WifiOff, AlertTriangle, Zap, UserCheck, X, Plane,
} from "lucide-react";
import { formatDate } from "../../../shared/dateUtils";
import { useLocation } from "wouter";
import { toast } from "sonner";

// ─── Notification Type Config ───
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
    route: (id) => `/deal/${id}`,
  },
  deal_created: {
    icon: Briefcase,
    bg: "border-l-4 border-l-blue-500",
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-400",
    label: "Negociação",
    route: (id) => `/deal/${id}`,
  },
  contact_created: {
    icon: UserPlus,
    bg: "border-l-4 border-l-violet-500",
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-400",
    label: "Passageiro",
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
  task_due_soon: {
    icon: Clock,
    bg: "border-l-4 border-l-red-500",
    iconBg: "bg-red-500/15",
    iconColor: "text-red-400",
    label: "Tarefa Vencendo",
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
  birthday: {
    icon: Cake,
    bg: "border-l-4 border-l-pink-500",
    iconBg: "bg-pink-500/15",
    iconColor: "text-pink-400",
    label: "Aniversário",
    route: (id) => `/contacts?id=${id}`,
  },
  wedding_anniversary: {
    icon: Heart,
    bg: "border-l-4 border-l-rose-500",
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-400",
    label: "Casamento",
    route: (id) => `/contacts?id=${id}`,
  },
  new_lead: {
    icon: UserCheck,
    bg: "border-l-4 border-l-teal-500",
    iconBg: "bg-teal-500/15",
    iconColor: "text-teal-400",
    label: "Novo Lead",
    route: (id) => `/deal/${id}`,
  },
  whatsapp_connected: {
    icon: Wifi,
    bg: "border-l-4 border-l-green-500",
    iconBg: "bg-green-500/15",
    iconColor: "text-green-400",
    label: "WhatsApp",
  },
  whatsapp_disconnected: {
    icon: WifiOff,
    bg: "border-l-4 border-l-red-500",
    iconBg: "bg-red-500/15",
    iconColor: "text-red-400",
    label: "WhatsApp",
    route: () => "/settings/inbox",
  },
  whatsapp_warning: {
    icon: AlertTriangle,
    bg: "border-l-4 border-l-yellow-500",
    iconBg: "bg-yellow-500/15",
    iconColor: "text-yellow-400",
    label: "WhatsApp",
    route: () => "/settings/inbox",
  },
  automation_triggered: {
    icon: Zap,
    bg: "border-l-4 border-l-cyan-500",
    iconBg: "bg-cyan-500/15",
    iconColor: "text-cyan-400",
    label: "Automação",
  },
  departure_soon: {
    icon: Plane,
    bg: "border-l-4 border-l-sky-500",
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-400",
    label: "Embarque Próximo",
    route: (id) => `/deals/${id}`,
  },
};

// ─── Preference Categories ───
const PREF_CATEGORIES = [
  {
    title: "Padrão",
    description: "Notificações essenciais ativas por padrão",
    items: [
      { key: "deal_created", label: "Novas negociações", description: "Quando uma nova negociação é criada", icon: Briefcase, isDefault: true },
      { key: "rfv_filter_alert", label: "Alertas da Matriz RFV", description: "Quando contatos entram em novos segmentos RFV", icon: TrendingUp, isDefault: true },
      { key: "task_due_soon", label: "Tarefas vencendo em 3 horas", description: "Alerta quando uma tarefa está prestes a vencer", icon: Clock, isDefault: true },
      { key: "birthday", label: "Aniversáriantes do dia", description: "Contatos que fazem aniversário hoje", icon: Cake, isDefault: true },
      { key: "departure_soon", label: "Embarques próximos", description: "Alerta sobre viagens com embarque nos próximos 7 dias", icon: Plane, isDefault: true },
    ],
  },
  {
    title: "Vendas & CRM",
    description: "Movimentações no funil e contatos",
    items: [
      { key: "deal_moved", label: "Negociação movida no funil", description: "Quando uma negociação muda de etapa", icon: ArrowRightLeft, isDefault: false },
      { key: "contact_created", label: "Novo contato criado", description: "Quando um novo contato é adicionado", icon: UserPlus, isDefault: false },
      { key: "new_lead", label: "Novo lead capturado", description: "Quando um lead é capturado automaticamente", icon: UserCheck, isDefault: false },
      { key: "task_created", label: "Nova tarefa criada", description: "Quando uma tarefa é criada no sistema", icon: ClipboardList, isDefault: false },
    ],
  },
  {
    title: "WhatsApp",
    description: "Status de conexão e mensagens",
    items: [
      { key: "whatsapp_message", label: "Mensagens recebidas", description: "Novas mensagens no WhatsApp", icon: MessageSquare, isDefault: false },
      { key: "whatsapp_connected", label: "WhatsApp conectado", description: "Quando o WhatsApp é conectado com sucesso", icon: Wifi, isDefault: false },
      { key: "whatsapp_disconnected", label: "WhatsApp desconectado", description: "Quando o WhatsApp perde a conexão", icon: WifiOff, isDefault: false },
      { key: "whatsapp_warning", label: "Alertas do WhatsApp", description: "Avisos importantes sobre o WhatsApp", icon: AlertTriangle, isDefault: false },
    ],
  },
  {
    title: "Outros",
    description: "Datas especiais e automações",
    items: [
      { key: "wedding_anniversary", label: "Aniversário de casamento", description: "Contatos com aniversário de casamento hoje", icon: Heart, isDefault: false },
      { key: "automation_triggered", label: "Automação disparada", description: "Quando uma automação é executada", icon: Zap, isDefault: false },
    ],
  },
];

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
  const [, navigate] = useLocation();

  const utils = trpc.useUtils();
  const [showPreferences, setShowPreferences] = useState(false);

  const notifications = trpc.notifications.list.useQuery({ limit: 100 });
  const unreadCount = trpc.notifications.unreadCount.useQuery();
  const preferences = trpc.notifications.getPreferences.useQuery();

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

  const setPreferences = trpc.notifications.setPreferences.useMutation({
    onSuccess: () => {
      utils.notifications.getPreferences.invalidate();
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      toast.success("Preferências de notificação atualizadas");
    },
  });

  const handleTogglePref = (key: string, value: boolean) => {
    if (!preferences.data) return;
    const updated = { ...preferences.data, [key]: value };
    setPreferences.mutate({ preferences: updated });
  };

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreferences(!showPreferences)}
            className={`gap-1.5 text-[13px] ${showPreferences ? "bg-primary/10 border-primary/30" : ""}`}
          >
            <Settings2 className="h-4 w-4" />
            Preferências
          </Button>
          {(unreadCount.data ?? 0) > 0 && !showPreferences && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="gap-1.5 text-[13px]"
            >
              <CheckCheck className="h-4 w-4" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
      </div>

      {/* Preferences Panel */}
      {showPreferences && (
        <div className="mb-8 surface overflow-hidden">
          <div className="p-5 border-b border-border/40 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Preferências de Notificação</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">Selecione quais notificações deseja receber no sino</p>
            </div>
            <button
              onClick={() => setShowPreferences(false)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="divide-y divide-border/40">
            {PREF_CATEGORIES.map((category) => (
              <div key={category.title} className="p-5">
                <div className="mb-4">
                  <h3 className="text-[14px] font-semibold text-foreground">{category.title}</h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">{category.description}</p>
                </div>
                <div className="space-y-3">
                  {category.items.map((item) => {
                    const Icon = item.icon;
                    const isEnabled = preferences.data ? preferences.data[item.key] !== false : item.isDefault;
                    return (
                      <div key={item.key} className="flex items-center justify-between gap-4 py-1.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isEnabled ? "bg-primary/10" : "bg-muted/50"
                          }`}>
                            <Icon className={`h-4 w-4 ${isEnabled ? "text-primary" : "text-muted-foreground/50"}`} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-[13px] font-medium ${isEnabled ? "text-foreground" : "text-muted-foreground"}`}>
                              {item.label}
                              {item.isDefault && (
                                <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                  padrão
                                </span>
                              )}
                            </p>
                            <p className="text-[12px] text-muted-foreground/70 truncate">{item.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) => handleTogglePref(item.key, checked)}
                          disabled={setPreferences.isPending}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notification List */}
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
            const cfg = typeConfig[n.type] || {
              icon: Bell,
              bg: "border-l-4 border-l-gray-500",
              iconBg: "bg-gray-500/15",
              iconColor: "text-gray-400",
              label: n.type,
            };
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
