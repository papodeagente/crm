/**
 * AgendaCalendar — Unified Calendar for CRM Dashboard
 *
 * Merges CRM tasks and Google Calendar events into a single view.
 * Supports Day / Week / Month views with mobile-first responsiveness.
 *
 * Colors:
 *  - CRM tasks: primary/violet
 *  - Google Calendar: #4285F4 (Google blue)
 *  - Overdue: red border
 *  - Completed: opacity-50 + line-through
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Clock,
  CheckSquare,
  MessageCircle,
  Phone,
  Mail,
  Video,
  AlertTriangle,
  Loader2,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  LinkIcon,
} from "lucide-react";
import { formatTime, SYSTEM_TIMEZONE, SYSTEM_LOCALE } from "../../../shared/dateUtils";

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

type ViewMode = "day" | "week" | "month";

interface AgendaItem {
  id: string;
  source: "crm" | "google";
  title: string;
  description?: string | null;
  startAt: number;
  endAt: number;
  allDay: boolean;
  status: string;
  priority?: string;
  taskType?: string;
  entityType?: string;
  entityId?: number;
  dealTitle?: string | null;
  contactName?: string | null;
  isOverdue: boolean;
  isCompleted: boolean;
  location?: string | null;
  htmlLink?: string | null;
  userId?: number;
  calendarEmail?: string | null;
}

// ═══════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════

const TASK_TYPE_ICONS: Record<string, any> = {
  whatsapp: MessageCircle,
  phone: Phone,
  email: Mail,
  video: Video,
  task: CheckSquare,
};

const WEEKDAY_NAMES_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ═══════════════════════════════════════
// DATE HELPERS
// ═══════════════════════════════════════

function toLocalDate(date: Date): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: SYSTEM_TIMEZONE }));
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTimeShort(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(SYSTEM_LOCALE, { hour: "2-digit", minute: "2-digit", timeZone: SYSTEM_TIMEZONE });
}

// ═══════════════════════════════════════
// AGENDA EVENT PILL
// ═══════════════════════════════════════

function AgendaEventPill({ item }: { item: AgendaItem }) {
  const isGoogle = item.source === "google";
  const Icon = isGoogle ? CalendarIcon : (TASK_TYPE_ICONS[item.taskType || "task"] || CheckSquare);

  const baseClasses = "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] leading-tight transition-all cursor-pointer group";

  const colorClasses = isGoogle
    ? "bg-[#4285F4]/10 text-[#4285F4] hover:bg-[#4285F4]/20 border border-[#4285F4]/20"
    : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20";

  const overdueClasses = item.isOverdue ? "!border-red-500/60 !bg-red-500/10 !text-red-600 dark:!text-red-400" : "";
  const completedClasses = item.isCompleted ? "opacity-50 line-through" : "";

  const content = (
    <div className={`${baseClasses} ${colorClasses} ${overdueClasses} ${completedClasses}`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate font-medium">{item.title}</span>
      {!item.allDay && (
        <span className="text-[9px] opacity-70 shrink-0 ml-auto">{formatTimeShort(item.startAt)}</span>
      )}
      {item.isOverdue && <AlertTriangle className="h-2.5 w-2.5 text-red-500 shrink-0" />}
    </div>
  );

  // CRM tasks link to deal/contact; Google events open in new tab
  if (isGoogle && item.htmlLink) {
    return (
      <a href={item.htmlLink} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }

  if (!isGoogle && item.entityType === "deal" && item.entityId) {
    return <Link href={`/deal/${item.entityId}`} className="block">{content}</Link>;
  }

  if (!isGoogle && item.entityType === "contact" && item.entityId) {
    return <Link href={`/contacts/${item.entityId}`} className="block">{content}</Link>;
  }

  return <div>{content}</div>;
}

// ═══════════════════════════════════════
// DAY VIEW
// ═══════════════════════════════════════

function DayView({ items, date }: { items: AgendaItem[]; date: Date }) {
  const allDayItems = items.filter(i => i.allDay);
  const timedItems = items.filter(i => !i.allDay).sort((a, b) => a.startAt - b.startAt);

  // Group timed items by hour
  const hourGroups: Record<number, AgendaItem[]> = {};
  timedItems.forEach(item => {
    const hour = new Date(item.startAt).getHours();
    if (!hourGroups[hour]) hourGroups[hour] = [];
    hourGroups[hour].push(item);
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  // Only show hours that have events, plus surrounding context
  const activeHours = new Set<number>();
  Object.keys(hourGroups).forEach(h => {
    const hour = Number(h);
    activeHours.add(Math.max(0, hour - 1));
    activeHours.add(hour);
    activeHours.add(Math.min(23, hour + 1));
  });

  // If no events, show business hours (8-18)
  if (activeHours.size === 0) {
    for (let h = 8; h <= 18; h++) activeHours.add(h);
  }

  const visibleHours = hours.filter(h => activeHours.has(h));

  return (
    <div className="space-y-1">
      {/* All-day events */}
      {allDayItems.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Dia inteiro</p>
          <div className="space-y-1">
            {allDayItems.map(item => <AgendaEventPill key={item.id} item={item} />)}
          </div>
        </div>
      )}

      {/* Timed events */}
      <div className="space-y-0">
        {visibleHours.map(hour => (
          <div key={hour} className="flex gap-2 min-h-[32px]">
            <div className="w-10 text-[10px] text-muted-foreground font-medium text-right pt-1 shrink-0">
              {String(hour).padStart(2, "0")}:00
            </div>
            <div className="flex-1 border-t border-border/30 pt-1 pb-1">
              {hourGroups[hour] ? (
                <div className="space-y-1">
                  {hourGroups[hour].map(item => <AgendaEventPill key={item.id} item={item} />)}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="py-8 text-center">
          <CalendarIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[13px] text-muted-foreground">Nenhum evento neste dia</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// WEEK VIEW
// ═══════════════════════════════════════

function WeekView({ items, weekStart }: { items: AgendaItem[]; weekStart: Date }) {
  const today = toLocalDate(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Group items by day
  const dayGroups: Record<string, AgendaItem[]> = {};
  days.forEach(d => { dayGroups[formatDateISO(d)] = []; });

  items.forEach(item => {
    const itemDate = new Date(item.startAt);
    const key = formatDateISO(toLocalDate(itemDate));
    if (dayGroups[key]) dayGroups[key].push(item);
  });

  return (
    <div className="grid grid-cols-7 gap-px bg-border/30 rounded-lg overflow-hidden">
      {days.map((day, idx) => {
        const key = formatDateISO(day);
        const isToday = isSameDay(day, today);
        const dayItems = dayGroups[key] || [];

        return (
          <div
            key={key}
            className={`bg-card p-1.5 min-h-[100px] ${isToday ? "ring-1 ring-primary/40 ring-inset" : ""}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">{WEEKDAY_NAMES_SHORT[idx]}</span>
              <span className={`text-[11px] font-bold ${isToday ? "bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center" : "text-foreground"}`}>
                {day.getDate()}
              </span>
            </div>
            <div className="space-y-0.5">
              {dayItems.slice(0, 4).map(item => (
                <AgendaEventPill key={item.id} item={item} />
              ))}
              {dayItems.length > 4 && (
                <p className="text-[9px] text-muted-foreground text-center font-medium">+{dayItems.length - 4} mais</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════
// MONTH VIEW
// ═══════════════════════════════════════

function MonthView({ items, date }: { items: AgendaItem[]; date: Date }) {
  const today = toLocalDate(new Date());
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart);

  // Build 6 weeks of days
  const weeks: Date[][] = [];
  let current = calendarStart;
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current = addDays(current, 1);
    }
    weeks.push(week);
    // Stop if we've passed the month
    if (current > addDays(monthEnd, 7)) break;
  }

  // Group items by day
  const dayGroups: Record<string, AgendaItem[]> = {};
  items.forEach(item => {
    const itemDate = new Date(item.startAt);
    const key = formatDateISO(toLocalDate(itemDate));
    if (!dayGroups[key]) dayGroups[key] = [];
    dayGroups[key].push(item);
  });

  return (
    <div>
      {/* Header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_NAMES_SHORT.map(name => (
          <div key={name} className="text-center text-[9px] font-bold text-muted-foreground uppercase tracking-wider py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="grid gap-px bg-border/20 rounded-lg overflow-hidden">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-px">
            {week.map((day, di) => {
              const key = formatDateISO(day);
              const isToday = isSameDay(day, today);
              const isCurrentMonth = day.getMonth() === date.getMonth();
              const dayItems = dayGroups[key] || [];

              return (
                <div
                  key={key}
                  className={`bg-card p-1 min-h-[60px] sm:min-h-[72px] ${
                    !isCurrentMonth ? "opacity-40" : ""
                  } ${isToday ? "ring-1 ring-primary/40 ring-inset" : ""}`}
                >
                  <span className={`text-[10px] font-bold block text-right mb-0.5 ${
                    isToday ? "bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center ml-auto" : "text-foreground"
                  }`}>
                    {day.getDate()}
                  </span>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map(item => {
                      const isGoogle = item.source === "google";
                      const dotColor = item.isOverdue ? "bg-red-500" : isGoogle ? "bg-[#4285F4]" : "bg-primary";
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-1 text-[9px] leading-tight truncate ${item.isCompleted ? "opacity-40 line-through" : ""}`}
                          title={item.title}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                          <span className="truncate text-foreground">{item.title}</span>
                        </div>
                      );
                    })}
                    {dayItems.length > 3 && (
                      <p className="text-[8px] text-muted-foreground text-center">+{dayItems.length - 3}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════

interface AgendaCalendarProps {
  filterUserId?: number;
  filterTeamId?: number;
}

export default function AgendaCalendar({ filterUserId, filterTeamId }: AgendaCalendarProps) {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();

  // Responsive: default to day on mobile
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return "day";
    return "week";
  });

  const [currentDate, setCurrentDate] = useState(() => toLocalDate(new Date()));

  // Compute date range based on view mode
  const { from, to } = useMemo(() => {
    if (viewMode === "day") {
      const day = startOfDay(currentDate);
      return { from: formatDateISO(day), to: formatDateISO(day) };
    }
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate);
      const we = addDays(ws, 6);
      return { from: formatDateISO(ws), to: formatDateISO(we) };
    }
    // month
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    // Include surrounding days for calendar grid
    const calStart = startOfWeek(ms);
    const calEnd = addDays(me, 6 - me.getDay());
    return { from: formatDateISO(calStart), to: formatDateISO(calEnd) };
  }, [viewMode, currentDate]);

  // Query
  const queryInput = useMemo(() => ({
    from,
    to,
    userId: filterUserId,
    teamId: filterTeamId,
  }), [from, to, filterUserId, filterTeamId]);

  const agendaQ = trpc.agenda.unified.useQuery(queryInput, {
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const googleStatusQ = trpc.agenda.googleStatus.useQuery(undefined, {
    staleTime: 120_000,
  });

  const syncGoogleMut = trpc.agenda.syncGoogle.useMutation({
    onSuccess: () => agendaQ.refetch(),
  });

  const items = agendaQ.data || [];

  // Navigation
  const goToday = useCallback(() => setCurrentDate(toLocalDate(new Date())), []);

  const goPrev = useCallback(() => {
    setCurrentDate(prev => {
      if (viewMode === "day") return addDays(prev, -1);
      if (viewMode === "week") return addDays(prev, -7);
      return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
    });
  }, [viewMode]);

  const goNext = useCallback(() => {
    setCurrentDate(prev => {
      if (viewMode === "day") return addDays(prev, 1);
      if (viewMode === "week") return addDays(prev, 7);
      return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
    });
  }, [viewMode]);

  // Title
  const title = useMemo(() => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString(SYSTEM_LOCALE, {
        weekday: "long", day: "numeric", month: "long",
        timeZone: SYSTEM_TIMEZONE,
      });
    }
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate);
      const we = addDays(ws, 6);
      const sameMonth = ws.getMonth() === we.getMonth();
      if (sameMonth) {
        return `${ws.getDate()} – ${we.getDate()} de ${MONTH_NAMES[ws.getMonth()]}`;
      }
      return `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()].slice(0, 3)} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()].slice(0, 3)}`;
    }
    return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [viewMode, currentDate]);

  // Counts
  const crmCount = items.filter(i => i.source === "crm").length;
  const gcalCount = items.filter(i => i.source === "google").length;
  const overdueCount = items.filter(i => i.isOverdue).length;

  const isGoogleConnected = googleStatusQ.data?.connected ?? false;

  return (
    <section className="mb-6 sm:mb-8">
      <div className="surface p-4 sm:p-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary/10 shrink-0">
              <CalendarIcon className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-foreground tracking-tight">Agenda</h2>
              <p className="text-[11px] text-muted-foreground">
                Tarefas CRM
                {isGoogleConnected && " + Google Calendar"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Counts */}
            {crmCount > 0 && (
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                {crmCount} tarefa{crmCount > 1 ? "s" : ""}
              </span>
            )}
            {gcalCount > 0 && (
              <span className="text-[10px] bg-[#4285F4]/10 text-[#4285F4] px-2 py-0.5 rounded-full font-bold">
                {gcalCount} evento{gcalCount > 1 ? "s" : ""}
              </span>
            )}
            {overdueCount > 0 && (
              <span className="text-[10px] bg-red-500/15 text-red-500 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {overdueCount} atrasada{overdueCount > 1 ? "s" : ""}
              </span>
            )}

            {/* Google Calendar Sync */}
            {isGoogleConnected ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] gap-1 text-[#4285F4] hover:text-[#4285F4]/80"
                onClick={() => syncGoogleMut.mutate()}
                disabled={syncGoogleMut.isPending}
              >
                {syncGoogleMut.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Sincronizar
              </Button>
            ) : (
              <Link href="/profile">
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground">
                  <LinkIcon className="h-3 w-3" />
                  Conectar Google
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-[12px] font-semibold px-2" onClick={goToday}>
              Hoje
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-[12px] sm:text-[13px] font-semibold text-foreground capitalize truncate flex-1 text-center">
            {title}
          </p>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode("day")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                viewMode === "day" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              <span className="hidden sm:inline">Dia</span>
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                viewMode === "week" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarRange className="h-3 w-3" />
              <span className="hidden sm:inline">Semana</span>
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                viewMode === "month" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3 w-3" />
              <span className="hidden sm:inline">Mês</span>
            </button>
          </div>
        </div>

        {/* Loading */}
        {agendaQ.isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-[13px]">Carregando agenda...</span>
          </div>
        ) : (
          <>
            {viewMode === "day" && <DayView items={items} date={currentDate} />}
            {viewMode === "week" && <WeekView items={items} weekStart={startOfWeek(currentDate)} />}
            {viewMode === "month" && <MonthView items={items} date={currentDate} />}
          </>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[10px] text-muted-foreground">Tarefas CRM</span>
          </div>
          {isGoogleConnected && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4285F4]" />
              <span className="text-[10px] text-muted-foreground">Google Calendar</span>
            </div>
          )}
          {overdueCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[10px] text-muted-foreground">Atrasadas</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
