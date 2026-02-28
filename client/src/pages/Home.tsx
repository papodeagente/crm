import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";
import DateRangeFilter, { useDateFilter } from "@/components/DateRangeFilter";
import {
  Briefcase, Users, Plane, CheckSquare, MessageSquare,
  TrendingUp, ArrowUpRight, ArrowDownRight, Clock, Calendar,
  ChevronRight, Plus, Zap, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

/* ─── Skeleton Pulse ─── */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/60 ${className}`} />;
}

/* ─── Metric Card with gradient accent ─── */
function MetricCard({ label, value, change, changeType, icon: Icon, gradient, iconBg, iconColor, loading }: {
  label: string; value: string; change?: string; changeType?: "up" | "down" | "neutral"; icon: any; gradient: string; iconBg: string; iconColor: string; loading?: boolean;
}) {
  return (
    <div className="surface p-5 flex flex-col gap-3 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-200">
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: gradient }} />
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <span className="text-[28px] font-bold tracking-tight text-foreground leading-none">{value}</span>
        )}
        {!loading && change && changeType !== "neutral" && (
          <span className={`flex items-center gap-0.5 text-[12px] font-semibold mb-1 ${
            changeType === "up" ? "text-emerald-600" : "text-red-500"
          }`}>
            {changeType === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {change}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Activity Item ─── */
function ActivityItem({ title, subtitle, time, icon: Icon, color }: {
  title: string; subtitle: string; time: string; icon: any; color: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 group">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground leading-snug">{title}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <span className="text-[11px] text-muted-foreground/70 shrink-0 mt-0.5">{time}</span>
    </div>
  );
}

/* ─── Task Item ─── */
function TaskItem({ title, dueTime, priority }: {
  title: string; dueTime: string; priority: "high" | "medium" | "low" | "urgent";
}) {
  const priorityColors: Record<string, string> = {
    urgent: "bg-red-600",
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-emerald-500",
  };

  return (
    <div className="flex items-center gap-3 py-2.5 group">
      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${priorityColors[priority] || "bg-muted-foreground"}`} />
      <span className="text-[13px] text-foreground flex-1 truncate">{title}</span>
      <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {dueTime}
      </span>
    </div>
  );
}

/* ─── Quick Action ─── */
function QuickAction({ label, icon: Icon, href, iconColor }: { label: string; icon: any; href: string; iconColor: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border/50 transition-all duration-200 group"
    >
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-[13px] font-medium text-foreground">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 ml-auto group-hover:text-muted-foreground transition-colors duration-150" />
    </Link>
  );
}

/* ─── Helpers ─── */
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatChange(pct: number): { text: string; type: "up" | "down" | "neutral" } {
  if (pct === 0) return { text: "", type: "neutral" };
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, type: pct > 0 ? "up" : "down" };
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function formatTaskDue(ts: number | null): string {
  if (!ts) return "Sem prazo";
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return time;
  if (isTomorrow) return `Amanhã, ${time}`;
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

const actionIcons: Record<string, { icon: any; color: string }> = {
  stage_change: { icon: TrendingUp, color: "bg-purple-500/15 text-purple-400" },
  created: { icon: Plus, color: "bg-emerald-500/15 text-emerald-400" },
  note_added: { icon: MessageSquare, color: "bg-blue-500/15 text-blue-400" },
  whatsapp_backup: { icon: MessageSquare, color: "bg-green-500/15 text-green-400" },
  value_changed: { icon: TrendingUp, color: "bg-violet-500/15 text-violet-400" },
  status_changed: { icon: Briefcase, color: "bg-amber-500/15 text-amber-400" },
};

const stageBarColors = [
  "bg-indigo-500", "bg-blue-500", "bg-cyan-500", "bg-emerald-500",
  "bg-amber-500", "bg-orange-500", "bg-rose-500", "bg-violet-500",
];

/* ─── Main Dashboard ─── */
export default function Home() {
  const { user } = useAuth();
  const dateFilter = useDateFilter("all");

  // Use tenantId 1 as default (single-tenant for now)
  const tenantId = 1;

  const metricsQ = trpc.dashboard.metrics.useQuery({ tenantId, dateFrom: dateFilter.dates.dateFrom, dateTo: dateFilter.dates.dateTo });
  const pipelineQ = trpc.dashboard.pipelineSummary.useQuery({ tenantId, dateFrom: dateFilter.dates.dateFrom, dateTo: dateFilter.dates.dateTo });
  const activityQ = trpc.dashboard.recentActivity.useQuery({ tenantId, limit: 5, dateFrom: dateFilter.dates.dateFrom, dateTo: dateFilter.dates.dateTo });
  const tasksQ = trpc.dashboard.upcomingTasks.useQuery({ tenantId, limit: 5 });
  const lossReasonsQ = trpc.utmAnalytics.lossReasonsAnalytics.useQuery({ tenantId, dateFrom: dateFilter.dates.dateFrom, dateTo: dateFilter.dates.dateTo });

  const metrics = metricsQ.data;
  const loading = metricsQ.isLoading;

  const dealsChange = useMemo(() => formatChange(metrics?.activeDealsChange ?? 0), [metrics]);
  const contactsChange = useMemo(() => formatChange(metrics?.totalContactsChange ?? 0), [metrics]);
  const tripsChange = useMemo(() => formatChange(metrics?.activeTripsChange ?? 0), [metrics]);
  const tasksChange = useMemo(() => formatChange(metrics?.pendingTasksChange ?? 0), [metrics]);

  // Pipeline max for bar widths
  const pipelineMax = useMemo(() => {
    if (!pipelineQ.data?.length) return 1;
    return Math.max(...pipelineQ.data.map(s => s.dealCount), 1);
  }, [pipelineQ.data]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  })();

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="page-content">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-foreground">
            {greeting}, {user?.name?.split(" ")[0] || "Usuário"}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1 capitalize">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter
            preset={dateFilter.preset}
            onPresetChange={dateFilter.setPreset}
            customFrom={dateFilter.customFrom}
            onCustomFromChange={dateFilter.setCustomFrom}
            customTo={dateFilter.customTo}
            onCustomToChange={dateFilter.setCustomTo}
            onReset={dateFilter.reset}
          />
          <Link href="/pipeline">
            <Button size="sm" className="h-9 rounded-xl text-[13px] font-medium gap-1.5 shadow-sm" style={{
              background: "linear-gradient(135deg, oklch(0.55 0.25 270), oklch(0.60 0.25 320), oklch(0.65 0.20 200))"
            }}>
              <Plus className="h-3.5 w-3.5" />
              Nova Negociação
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Negociações Ativas"
          value={String(metrics?.activeDeals ?? 0)}
          change={dealsChange.text}
          changeType={dealsChange.type}
          icon={Briefcase}
          gradient="linear-gradient(135deg, oklch(0.55 0.25 270), oklch(0.60 0.25 320))"
          iconBg="bg-purple-500/15"
          iconColor="text-purple-400"
          loading={loading}
        />
        <MetricCard
          label="Contatos"
          value={String(metrics?.totalContacts ?? 0)}
          change={contactsChange.text}
          changeType={contactsChange.type}
          icon={Users}
          gradient="linear-gradient(135deg, oklch(0.60 0.22 180), oklch(0.65 0.20 200))"
          iconBg="bg-cyan-500/15"
          iconColor="text-cyan-400"
          loading={loading}
        />
        <MetricCard
          label="Viagens em Andamento"
          value={String(metrics?.activeTrips ?? 0)}
          change={tripsChange.text}
          changeType={tripsChange.type}
          icon={Plane}
          gradient="linear-gradient(135deg, oklch(0.60 0.25 320), oklch(0.55 0.25 340))"
          iconBg="bg-pink-500/15"
          iconColor="text-pink-400"
          loading={loading}
        />
        <MetricCard
          label="Tarefas Pendentes"
          value={String(metrics?.pendingTasks ?? 0)}
          change={tasksChange.text}
          changeType={tasksChange.type}
          icon={CheckSquare}
          gradient="linear-gradient(135deg, oklch(0.50 0.22 270), oklch(0.65 0.20 200))"
          iconBg="bg-indigo-500/15"
          iconColor="text-indigo-400"
          loading={loading}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left — 3 cols */}
        <div className="lg:col-span-3 space-y-6">
          {/* Focus of the day — upcoming tasks */}
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <h2 className="text-[14px] font-semibold text-foreground">Foco do Dia</h2>
              </div>
              <Link href="/tasks" className="text-[12px] text-primary font-medium hover:underline">
                Ver todas
              </Link>
            </div>
            {tasksQ.isLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : tasksQ.data && tasksQ.data.length > 0 ? (
              <div className="divide-y divide-border/50">
                {tasksQ.data.map(t => (
                  <TaskItem
                    key={t.id}
                    title={t.title}
                    dueTime={formatTaskDue(t.dueAt)}
                    priority={t.priority}
                  />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <CheckSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[13px] text-muted-foreground">Nenhuma tarefa pendente</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Crie tarefas nas negociações para vê-las aqui</p>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-foreground">Atividade Recente</h2>
              <Link href="/insights" className="text-[12px] text-primary font-medium hover:underline">
                Ver mais
              </Link>
            </div>
            {activityQ.isLoading ? (
              <div className="space-y-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : activityQ.data && activityQ.data.length > 0 ? (
              <div className="divide-y divide-border/50">
                {activityQ.data.map(a => {
                  const iconInfo = actionIcons[a.action] || { icon: Briefcase, color: "bg-muted text-muted-foreground" };
                  const subtitle = a.fromStageName && a.toStageName
                    ? `${a.fromStageName} → ${a.toStageName}`
                    : a.description.length > 60
                      ? a.description.slice(0, 60) + "…"
                      : a.description;
                  return (
                    <ActivityItem
                      key={a.id}
                      icon={iconInfo.icon}
                      color={iconInfo.color}
                      title={a.description.length > 50 ? a.description.slice(0, 50) + "…" : a.description}
                      subtitle={subtitle}
                      time={timeAgo(a.createdAt)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[13px] text-muted-foreground">Nenhuma atividade recente</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Movimentações de negociações aparecerão aqui</p>
              </div>
            )}
          </div>
        </div>

        {/* Right — 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div className="surface p-5">
            <h2 className="text-[14px] font-semibold text-foreground mb-4">Ações Rápidas</h2>
            <div className="space-y-2">
              <QuickAction label="Nova Negociação" icon={Briefcase} href="/pipeline" iconColor="bg-purple-500/15 text-purple-400" />
              <QuickAction label="Novo Contato" icon={Users} href="/contacts" iconColor="bg-cyan-500/15 text-cyan-400" />
              <QuickAction label="Enviar Mensagem" icon={MessageSquare} href="/inbox" iconColor="bg-blue-500/15 text-blue-400" />
              <QuickAction label="Criar Proposta" icon={Plane} href="/proposals" iconColor="bg-pink-500/15 text-pink-400" />
            </div>
          </div>

          {/* Pipeline Summary — real data */}
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-foreground">Pipeline</h2>
              <Link href="/pipeline" className="text-[12px] text-primary font-medium hover:underline">
                Abrir
              </Link>
            </div>
            {pipelineQ.isLoading ? (
              <div className="space-y-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : pipelineQ.data && pipelineQ.data.length > 0 ? (
              <div className="space-y-3.5">
                {pipelineQ.data.map((s, i) => (
                  <div key={s.stageId}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12.5px] font-medium text-foreground">{s.stageName}</span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {s.dealCount} · {formatCurrency(s.totalValueCents)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${stageBarColors[i % stageBarColors.length]} transition-all duration-700`}
                        style={{ width: `${Math.max((s.dealCount / pipelineMax) * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <Briefcase className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[13px] text-muted-foreground">Pipeline vazio</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Configure etapas em Configurações</p>
              </div>
            )}
          </div>

          {/* ─── Motivos de Perda ─── */}
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-foreground">Motivos de Perda</h2>
              <Link href="/insights" className="text-[12px] text-primary font-medium hover:underline">
                Ver mais
              </Link>
            </div>
            {lossReasonsQ.isLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : lossReasonsQ.data && lossReasonsQ.data.length > 0 ? (() => {
              const maxCount = Math.max(...lossReasonsQ.data.map(r => r.count), 1);
              const lossColors = [
                "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-rose-500",
                "bg-pink-500", "bg-red-400", "bg-orange-400", "bg-amber-400",
              ];
              return (
                <div className="space-y-3.5">
                  {lossReasonsQ.data.slice(0, 6).map((r, i) => (
                    <div key={r.lossReasonId}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12.5px] font-medium text-foreground truncate max-w-[60%]">{r.reasonName}</span>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {r.count} neg. · {formatCurrency(r.totalValueCents)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${lossColors[i % lossColors.length]} transition-all duration-700`}
                          style={{ width: `${Math.max((r.count / maxCount) * 100, 4)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-border/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Total Perdido</span>
                      <span className="text-[13px] font-bold text-red-500">
                        {formatCurrency(lossReasonsQ.data.reduce((sum, r) => sum + r.totalValueCents, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="py-6 text-center">
                <CheckSquare className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[13px] text-muted-foreground">Nenhuma perda registrada</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Negociações perdidas aparecerão aqui</p>
              </div>
            )}
          </div>

          {/* Total Value Card */}
          {metrics && metrics.totalDealValueCents > 0 && (
            <div className="surface p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{
                background: "linear-gradient(135deg, oklch(0.55 0.25 270), oklch(0.60 0.25 320), oklch(0.65 0.20 200))"
              }} />
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <span className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Valor Total em Pipeline
                </span>
              </div>
              <span className="text-[24px] font-bold tracking-tight text-foreground">
                {formatCurrency(metrics.totalDealValueCents)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
