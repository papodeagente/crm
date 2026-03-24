import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import {
  AlertTriangle, Clock, ChevronRight, Zap,
  Phone, Mail, Video, MessageCircle, CheckSquare,
  Target, DollarSign, TrendingUp, Flame, ListTodo,
  Sparkles, Users, Settings, Package, FileText,
  Import, BarChart3, Radio, ShieldCheck, X,
  CheckCircle2, Circle, Eye, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link, useLocation } from "wouter";
import { formatTime, SYSTEM_TIMEZONE, SYSTEM_LOCALE } from "../../../shared/dateUtils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import TrialCountdownBanner from "@/components/TrialCountdownBanner";

/* ─── Polling interval for real-time sync (60 seconds) ─── */
const REFETCH_INTERVAL = 60_000;

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

/* ─── Skeleton Pulse ─── */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/60 ${className}`} />;
}

/* ─── Format helpers ─── */
function formatCurrency(cents: number): string {
  if (cents >= 100_000_00) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
  }
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatCurrencyFull(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function timeAgo(ts: number | null): string {
  if (!ts) return "Sem atividade";
  const diff = Date.now() - ts;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 30) return `${days} dias`;
  return `${Math.floor(days / 30)} meses`;
}

/* ═══════════════════════════════════════════════════════════════
   TASK ITEM — for the priority action block
   ═══════════════════════════════════════════════════════════════ */
const TASK_TYPE_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  whatsapp: { icon: MessageCircle, color: "text-green-500", bg: "bg-green-500/10" },
  phone: { icon: Phone, color: "text-blue-500", bg: "bg-blue-500/10" },
  email: { icon: Mail, color: "text-amber-500", bg: "bg-amber-500/10" },
  video: { icon: Video, color: "text-purple-500", bg: "bg-purple-500/10" },
  task: { icon: CheckSquare, color: "text-teal-500", bg: "bg-teal-500/10" },
};

const PRIORITY_STYLES: Record<string, { label: string; className: string }> = {
  urgent: { label: "Urgente", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
  high: { label: "Alta", className: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  medium: { label: "Média", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  low: { label: "Baixa", className: "bg-muted text-muted-foreground" },
};

function TaskItem({ task }: { task: any }) {
  const typeInfo = TASK_TYPE_ICONS[task.taskType] || TASK_TYPE_ICONS.task;
  const TypeIcon = typeInfo.icon;
  const isOverdue = task.isOverdue;
  const priorityInfo = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;

  const dueLabel = (() => {
    if (!task.dueAt) return "Sem prazo";
    const d = new Date(task.dueAt);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const time = formatTime(d);
    if (isOverdue) {
      const diff = now.getTime() - d.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);
      if (days > 0) return `${days}d atrasada`;
      if (hours > 0) return `${hours}h atrasada`;
      return "Atrasada";
    }
    if (isToday) return `Hoje ${time}`;
    if (isTomorrow) return `Amanhã ${time}`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: SYSTEM_TIMEZONE }) + " " + time;
  })();

  const entityHref = task.entityType === "deal" ? `/deal/${task.entityId}` : task.entityType === "contact" ? `/contacts/${task.entityId}` : "#";
  
  // Build subtitle: dealTitle + contactName + accountName
  const subtitleParts: string[] = [];
  if (task.dealTitle) subtitleParts.push(task.dealTitle);
  if (task.contactName) subtitleParts.push(task.contactName);
  if (task.accountName) subtitleParts.push(task.accountName);
  const entityLabel = subtitleParts.join(" · ");

  return (
    <Link href={entityHref}>
      <div className={`flex items-center gap-3 py-3 px-3 -mx-3 rounded-xl cursor-pointer transition-all duration-200 hover:bg-muted/50 group ${isOverdue ? "bg-red-500/5" : ""}`}>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${typeInfo.bg} ${isOverdue ? "ring-2 ring-red-500/30" : ""}`}>
          <TypeIcon className={`h-4.5 w-4.5 ${isOverdue ? "text-red-500" : typeInfo.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{task.title}</p>
            {(task.priority === "urgent" || task.priority === "high") && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${priorityInfo.className}`}>
                {priorityInfo.label}
              </span>
            )}
          </div>
          {entityLabel && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{entityLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {task.dealValueCents > 0 && (
            <span className="text-[11px] font-bold text-foreground">{formatCurrency(task.dealValueCents)}</span>
          )}
          <span className={`text-[11px] flex items-center gap-1 px-2 py-1 rounded-lg font-semibold ${
            isOverdue
              ? "bg-red-500/15 text-red-500"
              : task.dueAt
                ? "bg-muted text-muted-foreground"
                : "text-muted-foreground/50"
          }`}>
            {isOverdue && <AlertTriangle className="h-3 w-3" />}
            <Clock className="h-3 w-3" />
            {dueLabel}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DEAL LIST MODAL — for no-task and cooling deals
   ═══════════════════════════════════════════════════════════════ */
function DealListModal({ open, onOpenChange, title, description, deals, icon: Icon, iconColor }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  deals: any[];
  icon: any;
  iconColor: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${iconColor}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">{title}</DialogTitle>
              <DialogDescription className="text-[12px]">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="max-h-[55vh] mt-2">
          {deals.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma negociação encontrada</div>
          ) : (
            <div className="space-y-1">
              {deals.map((deal: any) => (
                <Link key={deal.id} href={`/deal/${deal.id}`}>
                  <div className="flex items-center gap-3 py-3 px-3 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{deal.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {deal.contactName && (
                          <span className="text-[11px] text-muted-foreground">{deal.contactName}</span>
                        )}
                        {deal.stageName && (
                          <>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="text-[11px] text-muted-foreground">{deal.stageName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {deal.valueCents > 0 && (
                        <p className="text-[12px] font-bold text-foreground">{formatCurrency(deal.valueCents)}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(deal.lastActivityAt)}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ONBOARDING STEPS CONFIG
   ═══════════════════════════════════════════════════════════════ */
const ONBOARDING_ICONS: Record<string, any> = {
  team: Users,
  pipeline: BarChart3,
  stages: Settings,
  products: Package,
  loss_reasons: AlertTriangle,
  import: Import,
  custom_fields: FileText,
  goals: Target,
  automations: Zap,
  first_deal: DollarSign,
  first_task: ListTodo,
  rfv: Sparkles,
  channels: Radio,
  validate: ShieldCheck,
};

/* ═══════════════════════════════════════════════════════════════
   MAIN HOME COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Modals
  const [noTaskModalOpen, setNoTaskModalOpen] = useState(false);
  const [coolingModalOpen, setCoolingModalOpen] = useState(false);

  // ─── Data Queries ───
  const execQ = trpc.home.executive.useQuery(undefined, {
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 30000,
    refetchIntervalInBackground: false,
  });
  const tasksQ = trpc.home.tasks.useQuery({ limit: 10 }, {
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 30000,
    refetchIntervalInBackground: false,
  });
  const rfvQ = trpc.home.rfv.useQuery(undefined, {
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 60000,
    refetchIntervalInBackground: false,
  });
  const onboardingQ = trpc.home.onboarding.useQuery(undefined, {
    staleTime: 120000,
  });

  const toggleStep = trpc.home.toggleOnboardingStep.useMutation({
    onSuccess: () => onboardingQ.refetch(),
  });
  const dismissOnboarding = trpc.home.dismissOnboarding.useMutation({
    onSuccess: () => onboardingQ.refetch(),
  });

  const exec = execQ.data;
  const tasks = tasksQ.data;
  const rfv = rfvQ.data;
  const onboarding = onboardingQ.data;
  const loading = execQ.isLoading;

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const today = useMemo(() => {
    return new Date().toLocaleDateString(SYSTEM_LOCALE, {
      weekday: "long", day: "numeric", month: "long",
      timeZone: SYSTEM_TIMEZONE,
    });
  }, []);

  const monthLabel = useMemo(() => {
    return new Date().toLocaleDateString(SYSTEM_LOCALE, {
      month: "long", year: "numeric",
      timeZone: SYSTEM_TIMEZONE,
    });
  }, []);

  // Overdue task count for urgency badge
  const overdueCount = useMemo(() => {
    return tasks?.filter(t => t.isOverdue).length ?? 0;
  }, [tasks]);

  return (
    <div className="page-content max-w-7xl mx-auto">
      {/* ═══════════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-foreground">
            {greeting}, {user?.name?.split(" ")[0] || "Usuário"}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1 capitalize">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-lg capitalize">
            {monthLabel}
          </span>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-500">Tempo real</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          BLOCO 1 — VISÃO EXECUTIVA IMEDIATA
          ═══════════════════════════════════════════════════════ */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-4 w-4 text-primary" />
          <h2 className="text-[13px] font-bold text-foreground uppercase tracking-[0.06em]">Visão Executiva</h2>
          <span className="text-[10px] text-muted-foreground font-medium ml-1">Mês corrente</span>
        </div>

        {/* Top row: 2 alert cards + 4 metric cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {/* Card 1: Sem Tarefa (clicável) */}
          <button
            onClick={() => setNoTaskModalOpen(true)}
            className="surface relative p-4 text-left group hover:scale-[1.02] transition-all duration-300 cursor-pointer"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 to-orange-500" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Sem Tarefa</span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-amber-500/10">
                <ListTodo className="h-4 w-4 text-amber-500" />
              </div>
            </div>
            {loading ? <Skeleton className="h-8 w-12" /> : (
              <div className="flex items-end gap-1.5">
                <span className="text-[28px] font-extrabold text-foreground leading-none">{exec?.dealsWithoutTask ?? 0}</span>
                <span className="text-[10px] text-muted-foreground mb-1 font-medium">neg.</span>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1.5 group-hover:text-foreground transition-colors">
              Clique para ver detalhes <ChevronRight className="inline h-3 w-3" />
            </p>
          </button>

          {/* Card 2: Esfriando (clicável) */}
          <button
            onClick={() => setCoolingModalOpen(true)}
            className="surface relative p-4 text-left group hover:scale-[1.02] transition-all duration-300 cursor-pointer"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-400 to-rose-500" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Esfriando</span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-red-500/10">
                <Flame className="h-4 w-4 text-red-500" />
              </div>
            </div>
            {loading ? <Skeleton className="h-8 w-12" /> : (
              <div className="flex items-end gap-1.5">
                <span className="text-[28px] font-extrabold text-foreground leading-none">{exec?.coolingDeals ?? 0}</span>
                <span className="text-[10px] text-muted-foreground mb-1 font-medium">neg.</span>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1.5 group-hover:text-foreground transition-colors">
              Conforme config. do funil <ChevronRight className="inline h-3 w-3" />
            </p>
          </button>

          {/* Card 3: Em Andamento */}
          <div className="surface relative p-4">
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${ENTUR.purple}, ${ENTUR.magenta})` }} />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Em Andamento</span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-purple-500/10">
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
            </div>
            {loading ? <Skeleton className="h-8 w-12" /> : (
              <span className="text-[28px] font-extrabold text-foreground leading-none">{exec?.activeDeals ?? 0}</span>
            )}
            <p className="text-[10px] text-muted-foreground mt-1.5">negociações ativas</p>
          </div>

          {/* Card 4: Valor em Andamento */}
          <div className="surface relative p-4">
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${ENTUR.coral}, ${ENTUR.red})` }} />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Valor Ativo</span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-rose-500/10">
                <DollarSign className="h-4 w-4 text-rose-500" />
              </div>
            </div>
            {loading ? <Skeleton className="h-8 w-16" /> : (
              <span className="text-[24px] font-extrabold text-foreground leading-none">{formatCurrency(exec?.activeValueCents ?? 0)}</span>
            )}
            <p className="text-[10px] text-muted-foreground mt-1.5">em pipeline de vendas</p>
          </div>

          {/* Card 5: Taxa de Conversão */}
          <div className="surface relative p-4">
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${ENTUR.lime}, #8BC34A)` }} />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Conversão</span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-500/10">
                <Target className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
            {loading ? <Skeleton className="h-8 w-12" /> : (
              <div className="flex items-end gap-1">
                <span className="text-[28px] font-extrabold text-foreground leading-none">{exec?.conversionRate ?? 0}</span>
                <span className="text-[16px] font-bold text-muted-foreground mb-0.5">%</span>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {exec ? `${exec.wonDeals} ganhas · ${exec.lostDeals} perdidas` : "do mês"}
            </p>
          </div>

          {/* Card 6: Previsão de Fechamento — DESTAQUE */}
          <div className="surface relative p-4 ring-1 ring-primary/20">
            <div className="absolute top-0 left-0 right-0 h-[3px] entur-gradient" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Previsão</span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
            </div>
            {loading ? <Skeleton className="h-8 w-20" /> : (
              <span className="text-[22px] font-extrabold text-foreground leading-none">{formatCurrency(exec?.forecastCents ?? 0)}</span>
            )}
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {exec ? `${formatCurrency(exec.wonValueCents)} vendido + projeção` : "fechamento do mês"}
            </p>
          </div>
        </div>
      </section>

      {/* ─── TRIAL COUNTDOWN BANNER ─── */}
      <TrialCountdownBanner />

      {/* ═══════════════════════════════════════════════════════
          BLOCO 2 + 3 — PRIORIDADES + OPORTUNIDADES (side by side)
          ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 mb-6 sm:mb-8">

        {/* ─── BLOCO 2: Prioridades de Ação (8 cols) ─── */}
        <section className="lg:col-span-8">
          <div className="surface p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-amber-500/10 shrink-0">
                  <Zap className="h-4.5 w-4.5 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-[14px] font-bold text-foreground tracking-tight">Prioridades de Ação</h2>
                  <p className="text-[11px] text-muted-foreground">Atrasadas, hoje e próximos 7 dias</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {overdueCount > 0 && (
                  <span className="text-[10px] bg-red-500/15 text-red-500 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {overdueCount} atrasada{overdueCount > 1 ? "s" : ""}
                  </span>
                )}
                {tasks && tasks.length > 0 && (
                  <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold">
                    {tasks.length}
                  </span>
                )}
                <Link href="/tasks" className="text-[12px] text-primary font-medium hover:underline flex items-center gap-1">
                  Ver todas <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {tasksQ.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : tasks && tasks.length > 0 ? (
              <div className="divide-y divide-border/40">
                {tasks.map((t: any) => (
                  <TaskItem key={t.id} task={t} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500/30 mx-auto mb-3" />
                <p className="text-[14px] font-semibold text-foreground">Tudo em dia!</p>
                <p className="text-[12px] text-muted-foreground mt-1">Nenhuma tarefa pendente ou atrasada</p>
              </div>
            )}
          </div>
        </section>

        {/* ─── BLOCO 3: Oportunidades de Receita — RFV (4 cols) ─── */}
        <section className="lg:col-span-4">
          <div className="surface p-5 h-full">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-emerald-500/10">
                <Sparkles className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-[14px] font-bold text-foreground tracking-tight">Oportunidades RFV</h2>
                <p className="text-[11px] text-muted-foreground">Ações comerciais imediatas</p>
              </div>
            </div>

            {rfvQ.isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : rfv ? (
              <div className="space-y-3">
                {/* Janela de Indicação */}
                <Link href="/rfv?smartFilter=potencial_indicador">
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 hover:bg-emerald-500/10 hover:border-emerald-500/25 transition-all cursor-pointer group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Indicação</span>
                      <ArrowRight className="h-3.5 w-3.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-[32px] font-extrabold text-foreground leading-none">{rfv.indicacao}</span>
                    <p className="text-[11px] text-muted-foreground mt-1">Clientes prontos para indicar</p>
                  </div>
                </Link>

                {/* Janela de Recuperação */}
                <Link href="/rfv?smartFilter=potencial_ex_cliente">
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 hover:bg-amber-500/10 hover:border-amber-500/25 transition-all cursor-pointer group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Recuperação</span>
                      <ArrowRight className="h-3.5 w-3.5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-[32px] font-extrabold text-foreground leading-none">{rfv.recuperacao}</span>
                    <p className="text-[11px] text-muted-foreground mt-1">Ex-clientes na janela de retorno</p>
                  </div>
                </Link>

                {/* Janela de Recorrência */}
                <Link href="/rfv?smartFilter=potencial_indicador_fiel">
                  <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/15 hover:bg-purple-500/10 hover:border-purple-500/25 transition-all cursor-pointer group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Recorrência</span>
                      <ArrowRight className="h-3.5 w-3.5 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-[32px] font-extrabold text-foreground leading-none">{rfv.recorrencia}</span>
                    <p className="text-[11px] text-muted-foreground mt-1">Clientes fiéis com potencial</p>
                  </div>
                </Link>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                RFV não configurado
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════════
          BLOCO 4 — CHECKLIST DIDÁTICO DE ONBOARDING
          ═══════════════════════════════════════════════════════ */}
      {onboarding && !onboarding.dismissed && onboarding.steps && onboarding.steps.length > 0 && (
        <section className="mb-8">
          <div className="surface p-5 relative overflow-hidden">
            {/* Subtle gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-[3px] entur-gradient" />

            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary/10">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-foreground tracking-tight">Configure seu CRM</h2>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Complete as etapas abaixo para aproveitar todo o potencial do sistema
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[20px] font-extrabold text-foreground">{onboarding.progressPercent}%</span>
                  <p className="text-[10px] text-muted-foreground">{onboarding.completedCount}/{onboarding.totalSteps}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => dismissOnboarding.mutate()}
                  title="Ocultar checklist"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-5">
              <Progress value={onboarding.progressPercent} className="h-2" />
            </div>

            {/* Steps grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {onboarding.steps.map((step: any) => {
                const StepIcon = ONBOARDING_ICONS[step.key] || CheckSquare;
                const isCompleted = step.completed;

                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 cursor-pointer group ${
                      isCompleted
                        ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                        : "bg-muted/30 hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      if (!isCompleted) {
                        navigate(step.href);
                      }
                    }}
                  >
                    <button
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStep.mutate({ stepKey: step.key, completed: !isCompleted });
                      }}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] font-semibold truncate ${
                        isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                      }`}>
                        {step.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{step.description}</p>
                    </div>
                    {!isCompleted && (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary shrink-0 transition-colors" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODALS
          ═══════════════════════════════════════════════════════ */}
      <DealListModal
        open={noTaskModalOpen}
        onOpenChange={setNoTaskModalOpen}
        title="Negociações sem Tarefa"
        description={`${exec?.dealsWithoutTask ?? 0} negociações abertas sem nenhuma tarefa pendente`}
        deals={exec?.dealsWithoutTaskList ?? []}
        icon={ListTodo}
        iconColor="bg-amber-500/10 text-amber-500"
      />
      <DealListModal
        open={coolingModalOpen}
        onOpenChange={setCoolingModalOpen}
        title="Negociações Esfriando"
        description={`${exec?.coolingDeals ?? 0} negociações marcadas como esfriando conforme configuração do funil`}
        deals={exec?.coolingDealsList ?? []}
        icon={Flame}
        iconColor="bg-red-500/10 text-red-500"
      />
    </div>
  );
}
