import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";
import { useTenantId } from "@/hooks/useTenantId";
import {
  Briefcase, Users, Plane, CheckSquare, MessageSquare,
  TrendingUp, ArrowUpRight, ArrowDownRight, Clock,
  ChevronRight, Plus, Zap, AlertTriangle,
  Phone, Mail, Video, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import FunnelChart from "@/components/FunnelChart";
import { formatTime, formatDateShort, SYSTEM_TIMEZONE, SYSTEM_LOCALE } from "../../../shared/dateUtils";

/* ─── Polling interval for real-time sync (15 seconds) ─── */
const REFETCH_INTERVAL = 15_000;

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

/* ─── Task Item for Focus of the Day ─── */
const TASK_TYPE_ICONS: Record<string, { icon: any; color: string }> = {
  whatsapp: { icon: MessageCircle, color: "text-green-500 bg-green-500/15" },
  phone: { icon: Phone, color: "text-blue-500 bg-blue-500/15" },
  email: { icon: Mail, color: "text-amber-500 bg-amber-500/15" },
  video: { icon: Video, color: "text-purple-500 bg-purple-500/15" },
  task: { icon: CheckSquare, color: "text-teal-500 bg-teal-500/15" },
};

function FocusTaskItem({ task }: { task: any }) {
  const typeInfo = TASK_TYPE_ICONS[task.taskType] || TASK_TYPE_ICONS.task;
  const TypeIcon = typeInfo.icon;
  const isOverdue = task.isOverdue;

  const dueLabel = (() => {
    if (!task.dueAt) return "Sem prazo";
    const d = new Date(task.dueAt);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = formatTime(d);
    if (isOverdue) return `Atrasada`;
    if (isToday) return time;
    return formatDateShort(d);
  })();

  return (
    <div className={`flex items-center gap-3 py-2.5 group ${isOverdue ? "opacity-90" : ""}`}>
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${typeInfo.color.split(" ")[1]}`}>
        <TypeIcon className={`h-4 w-4 ${typeInfo.color.split(" ")[0]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">{task.title}</p>
      </div>
      <span className={`text-[11px] shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
        isOverdue
          ? "bg-red-500/15 text-red-500"
          : task.dueAt
            ? "bg-muted text-muted-foreground"
            : "text-muted-foreground/60"
      }`}>
        {isOverdue && <AlertTriangle className="h-3 w-3" />}
        <Clock className="h-3 w-3" />
        {dueLabel}
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

/* ─── Main Dashboard ─── */
export default function Home() {
  const { user } = useAuth();
  const tenantId = useTenantId();

  // All queries with refetchInterval for real-time sync
  const metricsQ = trpc.dashboard.metrics.useQuery(
    { tenantId },
    { refetchInterval: REFETCH_INTERVAL }
  );
  const pipelineQ = trpc.dashboard.pipelineSummary.useQuery(
    { tenantId },
    { refetchInterval: REFETCH_INTERVAL }
  );
  const tasksQ = trpc.dashboard.upcomingTasks.useQuery(
    { tenantId, limit: 8 },
    { refetchInterval: REFETCH_INTERVAL }
  );

  const metrics = metricsQ.data;
  const loading = metricsQ.isLoading;

  const dealsChange = useMemo(() => formatChange(metrics?.activeDealsChange ?? 0), [metrics]);
  const contactsChange = useMemo(() => formatChange(metrics?.totalContactsChange ?? 0), [metrics]);
  const tripsChange = useMemo(() => formatChange(metrics?.activeTripsChange ?? 0), [metrics]);
  const tasksChange = useMemo(() => formatChange(metrics?.pendingTasksChange ?? 0), [metrics]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  })();

  const today = new Date().toLocaleDateString(SYSTEM_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: SYSTEM_TIMEZONE,
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
          {/* Real-time indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-600">Tempo real</span>
          </div>
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
          {/* Focus of the day — today's tasks + overdue */}
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <h2 className="text-[14px] font-semibold text-foreground">Foco do Dia</h2>
                {tasksQ.data && tasksQ.data.length > 0 && (
                  <span className="text-[10px] bg-amber-500/15 text-amber-600 px-2 py-0.5 rounded-full font-semibold">
                    {tasksQ.data.length}
                  </span>
                )}
              </div>
              <Link href="/tasks" className="text-[12px] text-primary font-medium hover:underline">
                Ver todas
              </Link>
            </div>
            {tasksQ.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : tasksQ.data && tasksQ.data.length > 0 ? (
              <div className="divide-y divide-border/50">
                {tasksQ.data.map((t: any) => (
                  <FocusTaskItem key={t.id} task={t} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <CheckSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[13px] text-muted-foreground">Nenhuma tarefa para hoje</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Tarefas do dia e atrasadas aparecerão aqui</p>
              </div>
            )}
          </div>

          {/* Funnel Chart — Sales Pipeline Only */}
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-purple-400" />
                </div>
                <h2 className="text-[14px] font-semibold text-foreground">Funil de Vendas</h2>
              </div>
              <Link href="/pipeline" className="text-[12px] text-primary font-medium hover:underline">
                Abrir Pipeline
              </Link>
            </div>
            <FunnelChart
              stages={pipelineQ.data || []}
              loading={pipelineQ.isLoading}
            />
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

          {/* Pipeline stages as list (complementary to funnel) */}
          {pipelineQ.data && pipelineQ.data.length > 0 && (
            <div className="surface p-5">
              <h2 className="text-[14px] font-semibold text-foreground mb-4">Etapas do Funil</h2>
              <div className="space-y-3">
                {pipelineQ.data.map((s: any) => (
                  <div key={s.stageId} className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: s.stageColor || "#6b7280" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[12.5px] font-medium text-foreground truncate">{s.stageName}</span>
                        <span className="text-[11px] text-muted-foreground font-medium shrink-0 ml-2">
                          {s.dealCount} neg.
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden mt-1">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.max((s.dealCount / Math.max(...pipelineQ.data.map((x: any) => x.dealCount), 1)) * 100, 4)}%`,
                            backgroundColor: s.stageColor || "#6b7280",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
