import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useEffect } from "react";
import { useTenantId } from "@/hooks/useTenantId";
import {
  Briefcase, Users, Plane, CheckSquare, MessageSquare,
  TrendingUp, ArrowUpRight, ArrowDownRight, Clock,
  ChevronRight, Plus, Zap, AlertTriangle,
  Phone, Mail, Video, MessageCircle, Send, Inbox,
  BarChart3, Target, DollarSign, Activity, Eye, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { formatTime, formatDateShort, SYSTEM_TIMEZONE, SYSTEM_LOCALE } from "../../../shared/dateUtils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

/* ─── Polling interval for real-time sync (15 seconds) ─── */
const REFETCH_INTERVAL = 15_000;

/* ─── ENTUR Brand Colors ─── */
const ENTUR = {
  peach: "#FFC7AC",
  coral: "#FF614C",
  red: "#FF2B61",
  magenta: "#DC00E7",
  purple: "#600FED",
  lime: "#C4ED0F",
  bg: "#06091A",
};

/* ─── Brand gradient stops for funnel (interpolated) ─── */
function getEnturFunnelColor(index: number, total: number): string {
  const colors = [
    "#FFC7AC", "#FFB08E", "#FF9A70", "#FF7D5A", "#FF614C",
    "#FF4C57", "#FF3761", "#FF2B61", "#ED16A4", "#DC00E7",
    "#AE07EA", "#800EED", "#600FED", "#4A0BC0", "#350893",
  ];
  if (total <= 1) return colors[0];
  const step = (colors.length - 1) / (total - 1);
  const i = Math.round(index * step);
  return colors[Math.min(i, colors.length - 1)];
}

/* ─── Skeleton Pulse ─── */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/60 ${className}`} />;
}

/* ─── Animated Number ─── */
function AnimatedValue({ value, prefix = "", suffix = "" }: { value: string; prefix?: string; suffix?: string }) {
  return <span>{prefix}{value}{suffix}</span>;
}

/* ─── Metric Card with ENTUR brand gradients ─── */
function MetricCard({ label, value, change, changeType, icon: Icon, gradient, iconColor, loading, subtitle }: {
  label: string; value: string; change?: string; changeType?: "up" | "down" | "neutral";
  icon: any; gradient: string; iconColor: string; loading?: boolean; subtitle?: string;
}) {
  return (
    <div className="relative group">
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
        background: gradient, filter: "blur(24px)", transform: "scale(0.8) translateY(10px)"
      }} />
      <div className="surface relative p-5 flex flex-col gap-3 overflow-hidden hover:scale-[1.02] transition-transform duration-300">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: gradient }} />
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">{label}</span>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{
            background: gradient, opacity: 0.15
          }}>
            <Icon className="h-5 w-5" style={{ color: iconColor }} />
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

/* ═══════════════════════════════════════════════════════════════
   VisualFunnel — Professional SVG funnel with ENTUR brand gradient
   ═══════════════════════════════════════════════════════════════ */
function VisualFunnel({ stages }: { stages: any[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 150);
    return () => clearTimeout(t);
  }, []);

  const totalCount = stages.reduce((s, st) => s + st.dealCount, 0) || 1;
  const totalValue = stages.reduce((s, st) => s + st.totalValueCents, 0);

  // SVG dimensions
  const svgW = 460;
  const stageH = stages.length <= 4 ? 56 : stages.length <= 6 ? 48 : 42;
  const gap = 3;
  const topPad = 6;
  const svgH = topPad + stages.length * stageH + (stages.length - 1) * gap + 6;
  const maxW = svgW - 20; // max trapezoid width
  const minW = maxW * 0.22; // minimum width at bottom

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full"
        style={{ maxHeight: Math.min(svgH, 500), overflow: "visible" }}
      >
        <defs>
          {/* Per-stage horizontal gradients for 3D cylinder effect */}
          {stages.map((_, i) => {
            const c = getEnturFunnelColor(i, stages.length);
            return (
              <linearGradient key={`fg-${i}`} id={`fg-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={c} stopOpacity={0.55} />
                <stop offset="18%" stopColor={c} stopOpacity={0.85} />
                <stop offset="45%" stopColor={c} stopOpacity={1} />
                <stop offset="55%" stopColor={c} stopOpacity={1} />
                <stop offset="82%" stopColor={c} stopOpacity={0.85} />
                <stop offset="100%" stopColor={c} stopOpacity={0.55} />
              </linearGradient>
            );
          })}
          {/* Top shine gradient */}
          <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          {/* Glow filter */}
          <filter id="fglow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {stages.map((stage, i) => {
          const y = topPad + i * (stageH + gap);
          const cx = svgW / 2;
          const isHov = hoveredIndex === i;
          const c = getEnturFunnelColor(i, stages.length);

          // Width interpolation: linear from maxW to minW
          const t = stages.length > 1 ? i / (stages.length - 1) : 0;
          const w = maxW - t * (maxW - minW);
          // Next stage width (for bottom edge of trapezoid)
          const tNext = stages.length > 1 ? Math.min((i + 1) / (stages.length - 1), 1) : 0;
          const wNext = i < stages.length - 1 ? maxW - tNext * (maxW - minW) : w * 0.75;

          const topL = cx - w / 2;
          const topR = cx + w / 2;
          const botL = cx - wNext / 2;
          const botR = cx + wNext / 2;
          const pts = `${topL},${y} ${topR},${y} ${botR},${y + stageH} ${botL},${y + stageH}`;

          // Conversion rate
          const convRate = i > 0 && stages[i - 1].dealCount > 0
            ? Math.round((stage.dealCount / stages[i - 1].dealCount) * 100)
            : null;

          return (
            <g
              key={stage.id || i}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(8px)",
                transition: `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.06}s`,
              }}
            >
              {/* Hover glow behind */}
              {isHov && (
                <polygon
                  points={pts}
                  fill={c}
                  opacity={0.3}
                  filter="url(#fglow)"
                />
              )}

              {/* Main trapezoid with 3D gradient */}
              <polygon
                points={pts}
                fill={`url(#fg-${i})`}
                stroke={isHov ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.06)"}
                strokeWidth={isHov ? 1.2 : 0.4}
                style={{
                  transition: "all 0.3s ease",
                  transform: isHov ? `scale(1.025)` : "scale(1)",
                  transformOrigin: `${cx}px ${y + stageH / 2}px`,
                }}
              />

              {/* Top shine strip */}
              <polygon
                points={`${topL + 4},${y + 0.5} ${topR - 4},${y + 0.5} ${topR - 8},${y + 7} ${topL + 8},${y + 7}`}
                fill="url(#shine)"
              />

              {/* Stage name */}
              <text
                x={cx}
                y={y + stageH / 2 - 5}
                textAnchor="middle"
                fill="#fff"
                fontSize="11.5"
                fontWeight="700"
                style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
              >
                {stage.name}
              </text>

              {/* Count + Value */}
              <text
                x={cx}
                y={y + stageH / 2 + 10}
                textAnchor="middle"
                fill="rgba(255,255,255,0.8)"
                fontSize="9.5"
                fontWeight="500"
              >
                {stage.dealCount} neg. · {formatCurrency(stage.totalValueCents)}
              </text>

              {/* Conversion rate between stages */}
              {convRate !== null && (
                <g>
                  <text
                    x={cx}
                    y={y - gap / 2 + 1}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.35)"
                    fontSize="8"
                    fontWeight="700"
                    letterSpacing="0.5"
                  >
                    ▼ {convRate}%
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Total summary with brand accent */}
      <div className="flex items-center justify-center gap-8 mt-4 pt-4 border-t border-border/30">
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.1em]">Total</span>
          <p className="text-[18px] font-extrabold text-foreground mt-0.5">{totalCount} <span className="text-[12px] font-medium text-muted-foreground">neg.</span></p>
        </div>
        <div className="h-8 w-px bg-border/40" />
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.1em]">Valor Total</span>
          <p className="text-[18px] font-extrabold mt-0.5" style={{ color: ENTUR.lime }}>
            {formatCurrency(totalValue)}
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

/* ─── Conversion Donut with ENTUR colors ─── */
function ConversionDonut({ rate, won, lost, open }: { rate: number; won: number; lost: number; open: number }) {
  const data = [
    { name: "Ganhas", value: won, color: ENTUR.lime },
    { name: "Perdidas", value: lost, color: ENTUR.red },
    { name: "Em aberto", value: open, color: ENTUR.purple },
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

      {/* ─── KPI Row with ENTUR brand gradients ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard
          label={dealStatus === 'won' ? 'Ganhas' : dealStatus === 'lost' ? 'Perdidas' : dealStatus === 'all' ? 'Negociações' : 'Ativas'}
          value={String(metrics?.activeDeals ?? 0)}
          change={dealsChange.text} changeType={dealsChange.type}
          icon={Briefcase}
          gradient={`linear-gradient(135deg, ${ENTUR.purple}, ${ENTUR.magenta})`}
          iconColor={ENTUR.purple}
          loading={loading}
          subtitle={metrics?.totalDealValueCents ? formatCurrency(metrics.totalDealValueCents) : undefined}
        />
        <MetricCard
          label="Contatos"
          value={formatNumber(metrics?.totalContacts ?? 0)}
          change={contactsChange.text} changeType={contactsChange.type}
          icon={Users}
          gradient={`linear-gradient(135deg, ${ENTUR.coral}, ${ENTUR.red})`}
          iconColor={ENTUR.coral}
          loading={loading}
        />
        <MetricCard
          label="Viagens"
          value={String(metrics?.activeTrips ?? 0)}
          change={tripsChange.text} changeType={tripsChange.type}
          icon={Plane}
          gradient={`linear-gradient(135deg, ${ENTUR.red}, ${ENTUR.magenta})`}
          iconColor={ENTUR.red}
          loading={loading}
        />
        <MetricCard
          label="Tarefas"
          value={String(metrics?.pendingTasks ?? 0)}
          change={tasksChange.text} changeType={tasksChange.type}
          icon={CheckSquare}
          gradient={`linear-gradient(135deg, ${ENTUR.peach}, ${ENTUR.coral})`}
          iconColor={ENTUR.peach}
          loading={loading}
        />
        <MetricCard
          label="WhatsApp"
          value={formatNumber(waMetrics?.totalMessages ?? 0)}
          icon={MessageCircle}
          gradient={`linear-gradient(135deg, ${ENTUR.lime}, #8BC34A)`}
          iconColor={ENTUR.lime}
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
                  <div className="h-2 w-6 rounded-full" style={{ background: ENTUR.lime }} />
                  <span className="text-muted-foreground">Enviadas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-6 rounded-full" style={{ background: ENTUR.purple }} />
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
                      <stop offset="0%" stopColor={ENTUR.lime} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={ENTUR.lime} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradReceived" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ENTUR.purple} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={ENTUR.purple} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Enviadas" stroke={ENTUR.lime} strokeWidth={2.5} fill="url(#gradSent)" dot={false} />
                  <Area type="monotone" dataKey="Recebidas" stroke={ENTUR.purple} strokeWidth={2.5} fill="url(#gradReceived)" dot={false} />
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
                    <Send className="h-3 w-3" style={{ color: ENTUR.lime }} />
                    <span className="text-[10px] text-muted-foreground font-medium">Enviadas</span>
                  </div>
                  <span className="text-[16px] font-bold text-foreground">{formatNumber(waMetrics.sentMessages)}</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Inbox className="h-3 w-3" style={{ color: ENTUR.purple }} />
                    <span className="text-[10px] text-muted-foreground font-medium">Recebidas</span>
                  </div>
                  <span className="text-[16px] font-bold text-foreground">{formatNumber(waMetrics.receivedMessages)}</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <MessageSquare className="h-3 w-3" style={{ color: ENTUR.coral }} />
                    <span className="text-[10px] text-muted-foreground font-medium">Conversas</span>
                  </div>
                  <span className="text-[16px] font-bold text-foreground">{formatNumber(waMetrics.totalConversations)}</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Eye className="h-3 w-3" style={{ color: ENTUR.red }} />
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
                {pipelineQ.data.map((s: any, idx: number) => {
                  const maxDealCount = Math.max(...pipelineQ.data!.map((x: any) => x.dealCount), 1);
                  const barColor = getEnturFunnelColor(idx, pipelineQ.data!.length);
                  return (
                    <div key={s.stageId} className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
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
                              backgroundColor: barColor,
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

        {/* ─── Quick Actions ─── */}
        <div className={pipelineQ.data && pipelineQ.data.length > 0 ? "lg:col-span-7" : "lg:col-span-12"}>
          <ChartCard
            title="Ações Rápidas"
            icon={Zap}
            iconColor="bg-blue-500/15 text-blue-400"
          >
            <div className={`grid ${pipelineQ.data && pipelineQ.data.length > 0 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-4"} gap-3`}>
              {[
                { label: "Nova Negociação", icon: Briefcase, href: "/pipeline", color: ENTUR.purple, bg: "rgba(96,15,237,0.12)" },
                { label: "Novo Contato", icon: Users, href: "/contacts", color: ENTUR.coral, bg: "rgba(255,97,76,0.12)" },
                { label: "Enviar Mensagem", icon: MessageSquare, href: "/inbox", color: ENTUR.lime, bg: "rgba(196,237,15,0.12)" },
                { label: "Criar Proposta", icon: Plane, href: "/proposals", color: ENTUR.magenta, bg: "rgba(220,0,231,0.12)" },
              ].map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex flex-col items-center gap-2.5 px-4 py-4 rounded-xl bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border/50 transition-all duration-200 group"
                >
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: action.bg }}>
                    <action.icon className="h-5 w-5" style={{ color: action.color }} />
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
