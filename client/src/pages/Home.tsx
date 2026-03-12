import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useTenantId } from "@/hooks/useTenantId";
import {
  Briefcase, Users, Plane, CheckSquare, MessageSquare,
  TrendingUp, ArrowUpRight, ArrowDownRight, Clock,
  ChevronRight, Plus, Zap, AlertTriangle,
  Phone, Mail, Video, MessageCircle, Send, Inbox,
  BarChart3, Target, DollarSign, Activity, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { formatTime, formatDateShort, SYSTEM_TIMEZONE, SYSTEM_LOCALE } from "../../../shared/dateUtils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

/* ─── Polling interval for real-time sync (15 seconds) ─── */
const REFETCH_INTERVAL = 15_000;

/* ─── Skeleton Pulse ─── */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/60 ${className}`} />;
}

/* ─── Animated Number ─── */
function AnimatedValue({ value, prefix = "", suffix = "" }: { value: string; prefix?: string; suffix?: string }) {
  return <span>{prefix}{value}{suffix}</span>;
}

/* ─── Metric Card with glassmorphism ─── */
function MetricCard({ label, value, change, changeType, icon: Icon, gradient, loading, subtitle }: {
  label: string; value: string; change?: string; changeType?: "up" | "down" | "neutral";
  icon: any; gradient: string; loading?: boolean; subtitle?: string;
}) {
  return (
    <div className="relative group">
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
        background: gradient, filter: "blur(20px)", transform: "scale(0.85) translateY(8px)"
      }} />
      <div className="surface relative p-5 flex flex-col gap-3 overflow-hidden hover:scale-[1.02] transition-transform duration-300">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: gradient }} />
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">{label}</span>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{
            background: gradient, opacity: 0.15
          }}>
            <Icon className="h-5 w-5" style={{ color: gradient.includes("270") ? "#a78bfa" : gradient.includes("155") ? "#34d399" : gradient.includes("320") ? "#f472b6" : "#38bdf8" }} />
          </div>
        </div>
        <div>
          {loading ? (
            <Skeleton className="h-9 w-20" />
          ) : (
            <div className="flex items-end gap-2">
              <span className="text-[32px] font-extrabold tracking-tight text-foreground leading-none">
                <AnimatedValue value={value} />
              </span>
              {change && changeType !== "neutral" && (
                <span className={`flex items-center gap-0.5 text-[12px] font-bold mb-1.5 px-1.5 py-0.5 rounded-full ${
                  changeType === "up" ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
                }`}>
                  {changeType === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {change}
                </span>
              )}
            </div>
          )}
          {subtitle && <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── Chart Card Wrapper ─── */
function ChartCard({ title, icon: Icon, iconColor, children, action, className = "" }: {
  title: string; icon: any; iconColor: string; children: React.ReactNode;
  action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={`surface p-5 ${className}`}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${iconColor}`}>
            <Icon className="h-4 w-4" />
          </div>
          <h2 className="text-[14px] font-bold text-foreground tracking-tight">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ─── Custom Tooltip ─── */
function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl px-4 py-3 shadow-xl">
      <p className="text-[11px] text-muted-foreground font-medium mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-[12px]">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold text-foreground">{formatter ? formatter(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Visual Sales Funnel (SVG trapezoid shape) ─── */
const FUNNEL_COLORS = [
  "#8b5cf6", "#a78bfa", "#7c3aed", "#6d28d9", "#5b21b6",
  "#c084fc", "#9333ea", "#7e22ce", "#6b21a8", "#581c87",
];

function VisualFunnel({ stages }: { stages: any[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const totalCount = stages.reduce((s, st) => s + st.dealCount, 0) || 1;
  const svgWidth = 500;
  const svgHeight = stages.length * 56 + 20;
  const topPadding = 10;
  const stageHeight = 50;
  const stageGap = 6;
  const maxWidth = svgWidth - 40;
  const minWidth = 60;

  // Each stage gets a width proportional to its position (funnel narrows)
  const stageWidths = stages.map((_, i) => {
    const ratio = 1 - (i / Math.max(stages.length - 1, 1)) * 0.75;
    return minWidth + (maxWidth - minWidth) * ratio;
  });

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        style={{ maxHeight: Math.min(svgHeight, 400) }}
      >
        <defs>
          {stages.map((stage, i) => {
            const color = stage.color || FUNNEL_COLORS[i % FUNNEL_COLORS.length];
            return (
              <linearGradient key={`grad-${i}`} id={`funnel-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={color} stopOpacity={0.85} />
                <stop offset="50%" stopColor={color} stopOpacity={1} />
                <stop offset="100%" stopColor={color} stopOpacity={0.85} />
              </linearGradient>
            );
          })}
          <filter id="funnel-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {stages.map((stage, i) => {
          const y = topPadding + i * (stageHeight + stageGap);
          const currentWidth = stageWidths[i];
          const nextWidth = i < stages.length - 1 ? stageWidths[i + 1] : currentWidth * 0.7;
          const cx = svgWidth / 2;
          const isHovered = hoveredIndex === i;
          const color = stage.color || FUNNEL_COLORS[i % FUNNEL_COLORS.length];

          // Trapezoid points: top-left, top-right, bottom-right, bottom-left
          const topLeft = cx - currentWidth / 2;
          const topRight = cx + currentWidth / 2;
          const bottomLeft = cx - nextWidth / 2;
          const bottomRight = cx + nextWidth / 2;

          const points = `${topLeft},${y} ${topRight},${y} ${bottomRight},${y + stageHeight} ${bottomLeft},${y + stageHeight}`;

          return (
            <g
              key={stage.id || i}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
              style={{ transition: "transform 0.2s" }}
            >
              {/* Shadow/glow on hover */}
              {isHovered && (
                <polygon
                  points={points}
                  fill={color}
                  opacity={0.3}
                  filter="url(#funnel-glow)"
                />
              )}
              {/* Main trapezoid */}
              <polygon
                points={points}
                fill={`url(#funnel-grad-${i})`}
                stroke={isHovered ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)"}
                strokeWidth={isHovered ? 1.5 : 0.5}
                style={{
                  transition: "all 0.3s ease",
                  transform: isHovered ? "scale(1.02)" : "scale(1)",
                  transformOrigin: `${cx}px ${y + stageHeight / 2}px`,
                }}
              />
              {/* Shine effect */}
              <polygon
                points={`${topLeft + 2},${y + 1} ${topRight - 2},${y + 1} ${topRight - 4},${y + 6} ${topLeft + 4},${y + 6}`}
                fill="rgba(255,255,255,0.12)"
              />
              {/* Stage name */}
              <text
                x={cx}
                y={y + stageHeight / 2 - 6}
                textAnchor="middle"
                className="fill-white text-[11px] font-semibold"
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
              >
                {stage.name}
              </text>
              {/* Count + Value */}
              <text
                x={cx}
                y={y + stageHeight / 2 + 10}
                textAnchor="middle"
                className="fill-white/80 text-[10px] font-medium"
              >
                {stage.dealCount} neg. · {formatCurrency(stage.totalValueCents)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Total summary below funnel */}
      <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-border/30">
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total</span>
          <p className="text-[14px] font-bold text-foreground">{totalCount} neg.</p>
        </div>
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Valor</span>
          <p className="text-[14px] font-bold text-foreground">
            {formatCurrency(stages.reduce((s, st) => s + st.totalValueCents, 0))}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Task Item ─── */
const TASK_TYPE_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  whatsapp: { icon: MessageCircle, color: "text-green-400", bg: "bg-green-500/15" },
  phone: { icon: Phone, color: "text-blue-400", bg: "bg-blue-500/15" },
  email: { icon: Mail, color: "text-amber-400", bg: "bg-amber-500/15" },
  video: { icon: Video, color: "text-purple-400", bg: "bg-purple-500/15" },
  task: { icon: CheckSquare, color: "text-teal-400", bg: "bg-teal-500/15" },
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
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${typeInfo.bg}`}>
        <TypeIcon className={`h-4 w-4 ${typeInfo.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">{task.title}</p>
      </div>
      <span className={`text-[11px] shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
        isOverdue ? "bg-red-500/15 text-red-400" : task.dueAt ? "bg-muted text-muted-foreground" : "text-muted-foreground/60"
      }`}>
        {isOverdue && <AlertTriangle className="h-3 w-3" />}
        <Clock className="h-3 w-3" />
        {dueLabel}
      </span>
    </div>
  );
}

/* ─── Helpers ─── */
function formatCurrency(cents: number): string {
  if (cents >= 100_000_00) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
  }
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatCurrencyFull(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatChange(pct: number): { text: string; type: "up" | "down" | "neutral" } {
  if (pct === 0) return { text: "", type: "neutral" };
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, type: pct > 0 ? "up" : "down" };
}

function formatNumber(n: number): string {
  if (n >= 1000) return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  return String(n);
}

/* ─── Conversion Donut ─── */
function ConversionDonut({ rate, won, lost, open }: { rate: number; won: number; lost: number; open: number }) {
  const data = [
    { name: "Ganhas", value: won, color: "#34d399" },
    { name: "Perdidas", value: lost, color: "#f87171" },
    { name: "Em aberto", value: open, color: "#a78bfa" },
  ].filter(d => d.value > 0);

  if (data.length === 0) data.push({ name: "Sem dados", value: 1, color: "#374151" });

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-[130px] h-[130px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data} cx="50%" cy="50%"
              innerRadius={42} outerRadius={60}
              paddingAngle={3} dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] font-extrabold text-foreground">{rate}%</span>
          <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Conversão</span>
        </div>
      </div>
      <div className="space-y-3 flex-1">
        {data.filter(d => d.name !== "Sem dados").map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-[12px] text-muted-foreground flex-1">{d.name}</span>
            <span className="text-[13px] font-bold text-foreground">{formatNumber(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function Home() {
  const { user } = useAuth();
  const tenantId = useTenantId();

  const [dealStatus, setDealStatus] = useState<'open' | 'won' | 'lost' | 'all'>('open');

  // Load user's default pipeline preference
  const defaultPipelinePref = trpc.preferences.get.useQuery(
    { tenantId, key: "default_pipeline_id" },
    { enabled: !!tenantId }
  );
  const defaultPipelineId = defaultPipelinePref.data?.value ? Number(defaultPipelinePref.data.value) : undefined;

  // All queries with refetchInterval for real-time sync
  const metricsQ = trpc.dashboard.metrics.useQuery(
    { tenantId, pipelineId: defaultPipelineId, dealStatus },
    { refetchInterval: REFETCH_INTERVAL }
  );
  const pipelineQ = trpc.dashboard.pipelineSummary.useQuery(
    { tenantId, pipelineId: defaultPipelineId, dealStatus },
    { refetchInterval: REFETCH_INTERVAL }
  );
  const tasksQ = trpc.dashboard.upcomingTasks.useQuery(
    { tenantId, limit: 6 },
    { refetchInterval: REFETCH_INTERVAL }
  );
  const waMetricsQ = trpc.dashboard.whatsappMetrics.useQuery(
    { tenantId },
    { refetchInterval: REFETCH_INTERVAL }
  );
  const conversionQ = trpc.dashboard.conversionRates.useQuery(
    { tenantId },
    { refetchInterval: REFETCH_INTERVAL }
  );
  const funnelQ = trpc.dashboard.funnelData.useQuery(
    { tenantId, pipelineId: defaultPipelineId },
    { refetchInterval: REFETCH_INTERVAL }
  );

  const metrics = metricsQ.data;
  const loading = metricsQ.isLoading;
  const waMetrics = waMetricsQ.data;
  const conversion = conversionQ.data;
  const funnel = funnelQ.data;

  const dealsChange = useMemo(() => formatChange(metrics?.activeDealsChange ?? 0), [metrics]);
  const contactsChange = useMemo(() => formatChange(metrics?.totalContactsChange ?? 0), [metrics]);
  const tripsChange = useMemo(() => formatChange(metrics?.activeTripsChange ?? 0), [metrics]);
  const tasksChange = useMemo(() => formatChange(metrics?.pendingTasksChange ?? 0), [metrics]);

  // WhatsApp chart data
  const waChartData = useMemo(() => {
    if (!waMetrics?.messagesByDay) return [];
    return waMetrics.messagesByDay.map(d => ({
      date: new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      Enviadas: d.sent,
      Recebidas: d.received,
    }));
  }, [waMetrics]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  })();

  const today = new Date().toLocaleDateString(SYSTEM_LOCALE, {
    weekday: "long", day: "numeric", month: "long",
    timeZone: SYSTEM_TIMEZONE,
  });

  return (
    <div className="page-content">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">
            {greeting}, {user?.name?.split(" ")[0] || "Usuário"}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1 capitalize">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-500">Tempo real</span>
          </div>
          <Link href="/pipeline">
            <Button size="sm" className="h-9 rounded-xl text-[13px] font-medium gap-1.5 shadow-sm entur-gradient text-white border-0">
              <Plus className="h-3.5 w-3.5" />
              Nova Negociação
            </Button>
          </Link>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1.5 mb-6 p-1 rounded-xl bg-muted/40 w-fit">
        {([
          { value: 'open' as const, label: 'Em andamento' },
          { value: 'won' as const, label: 'Ganho' },
          { value: 'lost' as const, label: 'Perdido' },
          { value: 'all' as const, label: 'Todos' },
        ]).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDealStatus(opt.value)}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${
              dealStatus === opt.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ─── KPI Row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard
          label={dealStatus === 'won' ? 'Ganhas' : dealStatus === 'lost' ? 'Perdidas' : dealStatus === 'all' ? 'Negociações' : 'Ativas'}
          value={String(metrics?.activeDeals ?? 0)}
          change={dealsChange.text} changeType={dealsChange.type}
          icon={Briefcase}
          gradient="linear-gradient(135deg, #a78bfa, #818cf8)"
          loading={loading}
          subtitle={metrics?.totalDealValueCents ? formatCurrency(metrics.totalDealValueCents) : undefined}
        />
        <MetricCard
          label="Contatos"
          value={formatNumber(metrics?.totalContacts ?? 0)}
          change={contactsChange.text} changeType={contactsChange.type}
          icon={Users}
          gradient="linear-gradient(135deg, #38bdf8, #22d3ee)"
          loading={loading}
        />
        <MetricCard
          label="Viagens"
          value={String(metrics?.activeTrips ?? 0)}
          change={tripsChange.text} changeType={tripsChange.type}
          icon={Plane}
          gradient="linear-gradient(135deg, #f472b6, #e879f9)"
          loading={loading}
        />
        <MetricCard
          label="Tarefas"
          value={String(metrics?.pendingTasks ?? 0)}
          change={tasksChange.text} changeType={tasksChange.type}
          icon={CheckSquare}
          gradient="linear-gradient(135deg, #fb923c, #f59e0b)"
          loading={loading}
        />
        <MetricCard
          label="WhatsApp"
          value={formatNumber(waMetrics?.totalMessages ?? 0)}
          icon={MessageCircle}
          gradient="linear-gradient(135deg, #34d399, #22c55e)"
          loading={waMetricsQ.isLoading}
          subtitle={waMetrics ? `${waMetrics.unreadConversations} não lidas` : undefined}
        />
      </div>

      {/* ─── Main Grid ─── */}
      <div className="grid lg:grid-cols-12 gap-5">

        {/* ─── WhatsApp Messages Chart (8 cols) ─── */}
        <div className="lg:col-span-8">
          <ChartCard
            title="Mensagens WhatsApp"
            icon={MessageCircle}
            iconColor="bg-green-500/15 text-green-400"
            action={
              <div className="flex items-center gap-4 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-6 rounded-full bg-emerald-400" />
                  <span className="text-muted-foreground">Enviadas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-6 rounded-full bg-violet-400" />
                  <span className="text-muted-foreground">Recebidas</span>
                </div>
              </div>
            }
          >
            {waMetricsQ.isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : waChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={waChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradReceived" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Enviadas" stroke="#34d399" strokeWidth={2.5} fill="url(#gradSent)" dot={false} />
                  <Area type="monotone" dataKey="Recebidas" stroke="#a78bfa" strokeWidth={2.5} fill="url(#gradReceived)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados de mensagens
              </div>
            )}
            {/* WhatsApp mini stats */}
            {waMetrics && (
              <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/50">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Send className="h-3 w-3 text-emerald-400" />
                    <span className="text-[10px] text-muted-foreground font-medium">Enviadas</span>
                  </div>
                  <span className="text-[16px] font-bold text-foreground">{formatNumber(waMetrics.sentMessages)}</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Inbox className="h-3 w-3 text-violet-400" />
                    <span className="text-[10px] text-muted-foreground font-medium">Recebidas</span>
                  </div>
                  <span className="text-[16px] font-bold text-foreground">{formatNumber(waMetrics.receivedMessages)}</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <MessageSquare className="h-3 w-3 text-blue-400" />
                    <span className="text-[10px] text-muted-foreground font-medium">Conversas</span>
                  </div>
                  <span className="text-[16px] font-bold text-foreground">{formatNumber(waMetrics.totalConversations)}</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Eye className="h-3 w-3 text-amber-400" />
                    <span className="text-[10px] text-muted-foreground font-medium">Não lidas</span>
                  </div>
                  <span className="text-[16px] font-bold text-foreground">{waMetrics.unreadConversations}</span>
                </div>
              </div>
            )}
          </ChartCard>
        </div>

        {/* ─── Conversion Rate (4 cols) ─── */}
        <div className="lg:col-span-4">
          <ChartCard
            title="Taxa de Conversão"
            icon={Target}
            iconColor="bg-emerald-500/15 text-emerald-400"
            className="h-full"
          >
            {conversionQ.isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : conversion ? (
              <div>
                <ConversionDonut
                  rate={conversion.conversionRate}
                  won={conversion.wonDeals}
                  lost={conversion.lostDeals}
                  open={conversion.openDeals}
                />
                <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Ticket Médio</span>
                    <p className="text-[15px] font-bold text-foreground mt-0.5">
                      {formatCurrencyFull(conversion.avgDealValueCents)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total</span>
                    <p className="text-[15px] font-bold text-foreground mt-0.5">
                      {formatNumber(conversion.totalDeals)} neg.
                    </p>
                  </div>
                </div>
                {/* Lead Sources */}
                {conversion.topLeadSources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Origens</span>
                    <div className="mt-2 space-y-1.5">
                      {conversion.topLeadSources.slice(0, 3).map((s) => (
                        <div key={s.source} className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground capitalize">{s.source.replace(/_/g, " ")}</span>
                          <span className="text-[11px] font-bold text-foreground">{formatNumber(s.count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </ChartCard>
        </div>

        {/* ─── Sales Funnel (7 cols) ─── */}
        <div className="lg:col-span-7">
          <ChartCard
            title={funnel?.pipelineName || "Funil de Vendas"}
            icon={BarChart3}
            iconColor="bg-purple-500/15 text-purple-400"
            action={
              <Link href="/pipeline" className="text-[12px] text-primary font-medium hover:underline flex items-center gap-1">
                Abrir Pipeline <ChevronRight className="h-3 w-3" />
              </Link>
            }
          >
            {funnelQ.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : funnel && funnel.stages.length > 0 ? (
              <VisualFunnel stages={funnel.stages} />
            ) : (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Nenhuma etapa configurada
              </div>
            )}
          </ChartCard>
        </div>

        {/* ─── Focus of the Day (5 cols) ─── */}
        <div className="lg:col-span-5">
          <ChartCard
            title="Foco do Dia"
            icon={Zap}
            iconColor="bg-amber-500/15 text-amber-400"
            className="h-full"
            action={
              <div className="flex items-center gap-2">
                {tasksQ.data && tasksQ.data.length > 0 && (
                  <span className="text-[10px] bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded-full font-semibold">
                    {tasksQ.data.length}
                  </span>
                )}
                <Link href="/tasks" className="text-[12px] text-primary font-medium hover:underline">
                  Ver todas
                </Link>
              </div>
            }
          >
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
              <div className="py-10 text-center">
                <CheckSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[13px] text-muted-foreground">Nenhuma tarefa para hoje</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Tarefas do dia e atrasadas aparecerão aqui</p>
              </div>
            )}
          </ChartCard>
        </div>

        {/* ─── Pipeline Stages List (5 cols) ─── */}
        {pipelineQ.data && pipelineQ.data.length > 0 && (
          <div className="lg:col-span-5">
            <ChartCard
              title="Etapas do Pipeline"
              icon={Activity}
              iconColor="bg-indigo-500/15 text-indigo-400"
            >
              <div className="space-y-3">
                {pipelineQ.data.map((s: any) => {
                  const maxDealCount = Math.max(...pipelineQ.data!.map((x: any) => x.dealCount), 1);
                  return (
                    <div key={s.stageId} className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.stageColor || "#6b7280" }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-medium text-foreground truncate">{s.stageName}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-[11px] text-muted-foreground font-medium">{s.dealCount}</span>
                            <span className="text-[10px] text-muted-foreground/70">{formatCurrency(s.totalValueCents)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.max((s.dealCount / maxDealCount) * 100, 3)}%`,
                              backgroundColor: s.stageColor || "#6b7280",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ChartCard>
          </div>
        )}

        {/* ─── Quick Actions (2 cols or 7 cols) ─── */}
        <div className={pipelineQ.data && pipelineQ.data.length > 0 ? "lg:col-span-7" : "lg:col-span-12"}>
          <ChartCard
            title="Ações Rápidas"
            icon={Zap}
            iconColor="bg-blue-500/15 text-blue-400"
          >
            <div className={`grid ${pipelineQ.data && pipelineQ.data.length > 0 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-4"} gap-3`}>
              {[
                { label: "Nova Negociação", icon: Briefcase, href: "/pipeline", color: "bg-purple-500/15 text-purple-400" },
                { label: "Novo Contato", icon: Users, href: "/contacts", color: "bg-cyan-500/15 text-cyan-400" },
                { label: "Enviar Mensagem", icon: MessageSquare, href: "/inbox", color: "bg-green-500/15 text-green-400" },
                { label: "Criar Proposta", icon: Plane, href: "/proposals", color: "bg-pink-500/15 text-pink-400" },
              ].map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex flex-col items-center gap-2.5 px-4 py-4 rounded-xl bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border/50 transition-all duration-200 group"
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${action.color}`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[12px] font-medium text-foreground text-center">{action.label}</span>
                </Link>
              ))}
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
