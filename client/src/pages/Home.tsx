import { useAuth } from "@/_core/hooks/useAuth";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import {
  AlertTriangle, Clock, ChevronRight, Zap,
  Phone, Mail, Video, MessageCircle, CheckSquare,
  Target, DollarSign, TrendingUp, Flame, ListTodo,
  Sparkles, Users, Settings, Package, FileText,
  Import, BarChart3, Radio, ShieldCheck, X,
  CheckCircle2, Circle, Eye, ArrowRight,
  Filter, User, UsersRound, Building2, ChevronDown,
  Brain, Loader2, Plane, CalendarDays, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link, useLocation } from "wouter";
import { formatTime, SYSTEM_TIMEZONE, SYSTEM_LOCALE } from "../../../shared/dateUtils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import TrialCountdownBanner from "@/components/TrialCountdownBanner";
import HomeAgendaWidget from "@/components/home/HomeAgendaWidget";

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
   FILTER TYPES
   ═══════════════════════════════════════════════════════════════ */
type FilterType = "all" | "mine" | "user" | "team";
interface HomeFilter {
  type: FilterType;
  userId?: number;
  teamId?: number;
  label: string;
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

  const entityHref = task.entityType === "deal" ? `/deal/${task.entityId}` : task.entityType === "contact" ? `/contact/${task.entityId}` : "#";
  
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
   FILTER ICON MAP
   ═══════════════════════════════════════════════════════════════ */
const FILTER_ICONS: Record<FilterType, any> = {
  all: UsersRound,
  mine: User,
  user: User,
  team: Building2,
};

/* ─── AI Forecast Button (inside forecast card) ─── */
function AiForecastButton() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const forecastQ = trpc.home.aiForecast.useQuery(undefined, {
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const handleClick = () => {
    setOpen(true);
    setEnabled(true);
  };

  const handleRefresh = () => {
    forecastQ.refetch();
  };

  const aiText = forecastQ.data?.available
    ? (typeof forecastQ.data.forecast === "string" ? forecastQ.data.forecast : JSON.stringify(forecastQ.data.forecast, null, 2))
    : forecastQ.data?.error || null;

  const noAiConfigured = forecastQ.error?.message === "NO_AI_CONFIGURED" || (!forecastQ.data?.available && forecastQ.data?.error);

  return (
    <>
      <button
        onClick={handleClick}
        className="mt-2 flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-semibold transition-colors"
      >
        <Brain className="h-3 w-3" />
        Previsão inteligente
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Previsão Inteligente com IA
            </DialogTitle>
            <DialogDescription>
              Análise preditiva baseada nos seus dados de vendas do mês atual
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            {forecastQ.isLoading || forecastQ.isFetching ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Analisando dados...</span>
              </div>
            ) : noAiConfigured ? (
              <div className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4">
                Configure uma integração de IA em Configurações &gt; Avançado &gt; Integrações para usar a previsão inteligente.
              </div>
            ) : forecastQ.error ? (
              <div className="text-sm text-destructive bg-destructive/5 rounded-xl p-4">
                Erro: {forecastQ.error.message}
              </div>
            ) : aiText ? (
              <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-xl p-4 max-h-[400px] overflow-y-auto">
                {aiText}
              </div>
            ) : null}
          </div>
          {forecastQ.data && !forecastQ.isLoading && !forecastQ.isFetching && (
            <div className="flex justify-end mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Gerar nova análise
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN HOME COMP
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [, navigate] = useLocation();

  // Modals
  const [noTaskModalOpen, setNoTaskModalOpen] = useState(false);
  const [coolingModalOpen, setCoolingModalOpen] = useState(false);
  const [departureModalOpen, setDepartureModalOpen] = useState(false);

  // ─── Filter State (admin only) ───
  const [filter, setFilter] = useState<HomeFilter>({ type: "all", label: "Todos" });

  // Build query params from filter
  const execFilterInput = useMemo(() => {
    if (!isAdmin || filter.type === "all") return undefined;
    if (filter.type === "mine") return { userId: user?.id };
    if (filter.type === "user" && filter.userId) return { userId: filter.userId };
    if (filter.type === "team" && filter.teamId) return { teamId: filter.teamId };
    return undefined;
  }, [isAdmin, filter, user?.id]);

  const taskFilterInput = useMemo(() => {
    const base: { limit: number; userId?: number; teamId?: number } = { limit: 10 };
    if (!isAdmin || filter.type === "all") return base;
    if (filter.type === "mine") return { ...base, userId: user?.id };
    if (filter.type === "user" && filter.userId) return { ...base, userId: filter.userId };
    if (filter.type === "team" && filter.teamId) return { ...base, teamId: filter.teamId };
    return base;
  }, [isAdmin, filter, user?.id]);

  // ─── Data Queries ───
  const filterOptionsQ = trpc.home.filterOptions.useQuery(undefined, {
    staleTime: 120000,
    enabled: isAdmin,
  });

  const execQ = trpc.home.executive.useQuery(execFilterInput, {
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 30000,
    refetchIntervalInBackground: false,
  });
  const tasksQ = trpc.home.tasks.useQuery(taskFilterInput, {
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 30000,
    refetchIntervalInBackground: false,
  });
  // [Agenda Geral] RFV foi removido em prol da Agenda da Clínica — única fonte
  // unificada (crm_appointments). HomeAgendaWidget cuida da query/renderização
  // própria. Manter apenas o que ainda é consumido por outras seções.
  const departuresQ = trpc.home.upcomingDepartures.useQuery(execFilterInput, {
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
  const departures = departuresQ.data;
  const onboarding = onboardingQ.data;
  const loading = execQ.isLoading;
  const filterOptions = filterOptionsQ.data;

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

  // Filter icon
  const FilterIcon = FILTER_ICONS[filter.type] || Filter;

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
          {/* ─── ADMIN FILTER DROPDOWN ─── */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 text-[12px] font-medium border-border/60 bg-background hover:bg-muted/50"
                >
                  <FilterIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="max-w-[140px] truncate">{filter.label}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
                  Filtrar relatório por
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* All */}
                <DropdownMenuItem
                  onClick={() => setFilter({ type: "all", label: "Todos" })}
                  className={`cursor-pointer gap-2.5 rounded-lg ${filter.type === "all" ? "bg-primary/10 text-primary" : ""}`}
                >
                  <UsersRound className="h-3.5 w-3.5" />
                  <span className="text-[13px] font-medium">Todos</span>
                  {filter.type === "all" && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
                </DropdownMenuItem>

                {/* Mine */}
                <DropdownMenuItem
                  onClick={() => setFilter({ type: "mine", label: "Meu relatório" })}
                  className={`cursor-pointer gap-2.5 rounded-lg ${filter.type === "mine" ? "bg-primary/10 text-primary" : ""}`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span className="text-[13px] font-medium">Meu relatório</span>
                  {filter.type === "mine" && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Users submenu */}
                {filterOptions && filterOptions.users.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2.5 rounded-lg cursor-pointer">
                      <Users className="h-3.5 w-3.5" />
                      <span className="text-[13px] font-medium">Por usuário</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-[300px] overflow-y-auto w-56">
                      {filterOptions.users.map((u) => (
                        <DropdownMenuItem
                          key={u.id}
                          onClick={() => setFilter({ type: "user", userId: u.id, label: u.name })}
                          className={`cursor-pointer gap-2.5 rounded-lg ${filter.type === "user" && filter.userId === u.id ? "bg-primary/10 text-primary" : ""}`}
                        >
                          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} className="h-6 w-6 rounded-full object-cover" alt="" />
                            ) : (
                              u.name?.charAt(0)?.toUpperCase() || "?"
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium truncate">{u.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{u.role === "admin" ? "Admin" : "Usuário"}</p>
                          </div>
                          {filter.type === "user" && filter.userId === u.id && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}

                {/* Teams submenu */}
                {filterOptions && filterOptions.teams.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2.5 rounded-lg cursor-pointer">
                      <Building2 className="h-3.5 w-3.5" />
                      <span className="text-[13px] font-medium">Por equipe</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-[300px] overflow-y-auto w-56">
                      {filterOptions.teams.map((t) => (
                        <DropdownMenuItem
                          key={t.id}
                          onClick={() => setFilter({ type: "team", teamId: t.id, label: t.name })}
                          className={`cursor-pointer gap-2.5 rounded-lg ${filter.type === "team" && filter.teamId === t.id ? "bg-primary/10 text-primary" : ""}`}
                        >
                          <div
                            className="h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{ backgroundColor: t.color || "#6366f1" }}
                          >
                            {t.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium truncate">{t.name}</p>
                            <p className="text-[10px] text-muted-foreground">{t.memberCount} membro{t.memberCount !== 1 ? "s" : ""}</p>
                          </div>
                          {filter.type === "team" && filter.teamId === t.id && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <span className="text-[11px] text-muted-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-lg capitalize">
            {monthLabel}
          </span>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-500">Tempo real</span>
          </div>
        </div>
      </div>

      {/* ─── ACTIVE FILTER BADGE (when not "all") ─── */}
      {isAdmin && filter.type !== "all" && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/15">
            <FilterIcon className="h-3.5 w-3.5 text-primary" />
            <span className="text-[12px] font-medium text-primary">
              Filtrando: {filter.label}
            </span>
            <button
              onClick={() => setFilter({ type: "all", label: "Todos" })}
              className="ml-1 h-4 w-4 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
            >
              <X className="h-2.5 w-2.5 text-primary" />
            </button>
          </div>
        </div>
      )}

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
            {/* AI Forecast button */}
            <AiForecastButton />
          </div>
        </div>

        {/* Second row: Agendamentos card */}
        {departures && departures.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setDepartureModalOpen(true)}
              className="surface relative p-4 text-left group hover:scale-[1.01] transition-all duration-300 cursor-pointer w-full"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-400 to-blue-500" />
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-sky-500/10 shrink-0">
                  <CalendarDays className="h-5 w-5 text-sky-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">Proximos Agendamentos</span>
                    <span className="text-[10px] bg-sky-500/15 text-sky-500 px-2 py-0.5 rounded-full font-bold">
                      {departures.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {(() => {
                      const today = departures.filter((d: any) => {
                        const bd = new Date(d.appointmentDate);
                        const diff = Math.ceil((bd.getTime() - Date.now()) / (1000*60*60*24));
                        return diff <= 0;
                      }).length;
                      const thisWeek = departures.filter((d: any) => {
                        const bd = new Date(d.appointmentDate);
                        const diff = Math.ceil((bd.getTime() - Date.now()) / (1000*60*60*24));
                        return diff > 0 && diff <= 7;
                      }).length;
                      const parts = [];
                      if (today > 0) parts.push(`${today} hoje`);
                      if (thisWeek > 0) parts.push(`${thisWeek} esta semana`);
                      return parts.length > 0 ? parts.join(' · ') : 'Servicos com data agendada';
                    })()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {/* Mini urgency badges */}
                  {(() => {
                    const todayCount = departures.filter((d: any) => {
                      const diff = Math.ceil((new Date(d.appointmentDate).getTime() - Date.now()) / (1000*60*60*24));
                      return diff <= 0;
                    }).length;
                    const soonCount = departures.filter((d: any) => {
                      const diff = Math.ceil((new Date(d.appointmentDate).getTime() - Date.now()) / (1000*60*60*24));
                      return diff > 0 && diff <= 3;
                    }).length;
                    return (
                      <div className="flex items-center gap-1.5">
                        {todayCount > 0 && (
                          <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                            {todayCount} hoje
                          </span>
                        )}
                        {soonCount > 0 && (
                          <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                            {soonCount} em 3d
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">Ver todos <ChevronRight className="inline h-3 w-3" /></span>
                </div>
              </div>
            </button>
          </div>
        )}
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

        {/* ─── BLOCO 3: Agenda da Clínica (4 cols) ─── */}
        {/* Espelho da única fonte de agenda (crm_appointments). Marcar consulta
            por aqui exige contato + negociação — regra reforçada no dialog. */}
        <HomeAgendaWidget />
      </div>



      {/* ═══════════════════════════════════════════════════
          BLOCO 5 — CHECKLIST DIDÁTICO DE ONBOARDING
          ═════════════════════════════════════════════════ */}
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

      {/* Departure Detail Modal */}
      <Dialog open={departureModalOpen} onOpenChange={setDepartureModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-sky-500/10 text-sky-500">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Proximos Agendamentos</DialogTitle>
                <DialogDescription className="text-[12px]">
                  {departures?.length ?? 0} servico{(departures?.length ?? 0) !== 1 ? 's' : ''} agendados nos proximos dias
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-2">
            {(!departures || departures.length === 0) ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Nenhum agendamento proximo encontrado</div>
            ) : (
              <div className="space-y-1">
                {departures.map((dep: any) => {
                  const boardDate = dep.appointmentDate ? new Date(dep.appointmentDate) : null;
                  const retDate = dep.followUpDate ? new Date(dep.followUpDate) : null;
                  const now = new Date();
                  const daysUntil = boardDate ? Math.ceil((boardDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

                  let urgencyClass = "text-sky-500 bg-sky-500/10";
                  let urgencyLabel = daysUntil !== null ? `${daysUntil}d` : "";
                  let urgencyRing = "";
                  if (daysUntil !== null) {
                    if (daysUntil <= 0) {
                      urgencyClass = "text-red-500 bg-red-500/10";
                      urgencyLabel = "Hoje";
                      urgencyRing = "ring-2 ring-red-500/30";
                    } else if (daysUntil <= 3) {
                      urgencyClass = "text-amber-500 bg-amber-500/10";
                      urgencyLabel = `${daysUntil}d`;
                      urgencyRing = "ring-2 ring-amber-500/20";
                    } else if (daysUntil <= 7) {
                      urgencyClass = "text-orange-500 bg-orange-500/10";
                      urgencyLabel = `${daysUntil}d`;
                    }
                  }

                  return (
                    <Link key={dep.id} href={`/deal/${dep.id}`}>
                      <div className={`flex items-center gap-3 py-3 px-3 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors group ${urgencyRing}`}>
                        {/* Urgency badge */}
                        <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${urgencyClass}`}>
                          <span className="text-[12px] font-extrabold">{urgencyLabel}</span>
                        </div>

                        {/* Deal info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-foreground truncate">{dep.title}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {dep.contactName && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {dep.contactName}
                              </span>
                            )}
                            {boardDate && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                Agendamento: {boardDate.toLocaleDateString(SYSTEM_LOCALE, { day: '2-digit', month: 'short', year: 'numeric', timeZone: SYSTEM_TIMEZONE })}
                              </span>
                            )}
                            {retDate && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                Retorno/Revisao: {retDate.toLocaleDateString(SYSTEM_LOCALE, { day: '2-digit', month: 'short', timeZone: SYSTEM_TIMEZONE })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Value + Owner */}
                        <div className="text-right shrink-0">
                          {dep.valueCents > 0 && (
                            <p className="text-[13px] font-bold text-foreground">{formatCurrency(dep.valueCents)}</p>
                          )}
                          {dep.ownerName && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">{dep.ownerName}</p>
                          )}
                        </div>

                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
