/**
 * AgendaCalendar — Premium Unified Calendar for CRM Dashboard
 *
 * Merges CRM tasks, Google Calendar events, and manual CRM appointments
 * into a single view. Supports Day / Week / Month views.
 *
 * Design: Premium UX with real timeline, current-time indicator,
 * colored event blocks, and clean typography.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
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
  Plus,
  MapPin,
  Trash2,
  Check,
  Users,
  X,
  Search,
  ExternalLink,
} from "lucide-react";
import { formatTime, SYSTEM_TIMEZONE, SYSTEM_LOCALE } from "../../../shared/dateUtils";

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

type ViewMode = "day" | "week" | "month";

interface AgendaItem {
  id: string;
  source: "crm" | "google" | "appointment";
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
  color?: string | null;
  participants?: Array<{ userId: number; name: string }>;
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
const WEEKDAY_NAMES_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const APPOINTMENT_COLORS: { value: string; label: string; tw: string }[] = [
  { value: "emerald", label: "Verde", tw: "bg-emerald-500" },
  { value: "blue", label: "Azul", tw: "bg-blue-500" },
  { value: "purple", label: "Roxo", tw: "bg-purple-500" },
  { value: "amber", label: "Amarelo", tw: "bg-amber-500" },
  { value: "rose", label: "Rosa", tw: "bg-rose-500" },
  { value: "cyan", label: "Ciano", tw: "bg-cyan-500" },
];

// Hour range for day/week views
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
const HOUR_HEIGHT_PX = 56; // pixels per hour slot

function getSourceColor(item: AgendaItem) {
  if (item.isOverdue) return { bg: "bg-red-500/12", border: "border-l-red-500", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" };
  if (item.source === "google") return { bg: "bg-sky-500/10", border: "border-l-sky-500", text: "text-sky-600 dark:text-sky-400", dot: "bg-sky-500" };
  if (item.source === "appointment") {
    const c = item.color || "emerald";
    const map: Record<string, { bg: string; border: string; text: string; dot: string }> = {
      emerald: { bg: "bg-emerald-500/10", border: "border-l-emerald-500", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
      blue: { bg: "bg-blue-500/10", border: "border-l-blue-500", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
      purple: { bg: "bg-purple-500/10", border: "border-l-purple-500", text: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500" },
      amber: { bg: "bg-amber-500/10", border: "border-l-amber-500", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
      rose: { bg: "bg-rose-500/10", border: "border-l-rose-500", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
      cyan: { bg: "bg-cyan-500/10", border: "border-l-cyan-500", text: "text-cyan-700 dark:text-cyan-400", dot: "bg-cyan-500" },
    };
    return map[c] || map.emerald;
  }
  // CRM task
  return { bg: "bg-primary/10", border: "border-l-primary", text: "text-primary", dot: "bg-primary" };
}

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
  const day = d.getDay();
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

function toLocalInputDatetime(date: Date): string {
  const local = new Date(date.toLocaleString("en-US", { timeZone: SYSTEM_TIMEZONE }));
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  const h = String(local.getHours()).padStart(2, "0");
  const min = String(local.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function toLocalInputDate(date: Date): string {
  const local = new Date(date.toLocaleString("en-US", { timeZone: SYSTEM_TIMEZONE }));
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLocalHour(ts: number): number {
  const d = new Date(ts);
  const local = new Date(d.toLocaleString("en-US", { timeZone: SYSTEM_TIMEZONE }));
  return local.getHours() + local.getMinutes() / 60;
}

// ═══════════════════════════════════════
// EVENT BLOCK (for Day/Week timeline)
// ═══════════════════════════════════════

function EventBlock({ item, onClickAppt, compact }: { item: AgendaItem; onClickAppt?: (item: AgendaItem) => void; compact?: boolean }) {
  const colors = getSourceColor(item);
  const Icon = item.source === "google"
    ? CalendarIcon
    : item.source === "appointment"
      ? Clock
      : (TASK_TYPE_ICONS[item.taskType || "task"] || CheckSquare);

  const completedCls = item.isCompleted ? "opacity-40" : "";
  const hasParticipants = item.source === "appointment" && item.participants && item.participants.length > 1;

  const inner = (
    <div
      className={`
        group relative flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg border-l-[3px]
        ${colors.bg} ${colors.border} ${colors.text} ${completedCls}
        hover:shadow-md transition-all duration-150 cursor-pointer
        ${compact ? "text-[11px]" : "text-[12px]"}
      `}
      title={`${item.title}${item.description ? "\n" + item.description : ""}`}
    >
      <Icon className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} shrink-0 mt-0.5`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className={`font-semibold truncate ${item.isCompleted ? "line-through" : ""}`}>
            {item.title}
          </span>
          {item.isOverdue && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
        </div>
        {!compact && (
          <div className="flex items-center gap-2 mt-0.5 text-[10px] opacity-70">
            {!item.allDay && (
              <span>{formatTimeShort(item.startAt)} – {formatTimeShort(item.endAt)}</span>
            )}
            {item.dealTitle && <span className="truncate">• {item.dealTitle}</span>}
            {item.contactName && !item.dealTitle && <span className="truncate">• {item.contactName}</span>}
            {item.location && <span className="truncate">• {item.location}</span>}
          </div>
        )}
        {compact && !item.allDay && (
          <span className="text-[9px] opacity-60">{formatTimeShort(item.startAt)}</span>
        )}
      </div>
      {hasParticipants && (
        <span className="flex items-center gap-0.5 shrink-0 opacity-60 text-[9px]" title={item.participants!.map(p => p.name).join(", ")}>
          <Users className="h-3 w-3" />
          {item.participants!.length}
        </span>
      )}
    </div>
  );

  if (item.source === "appointment" && onClickAppt) {
    return <div onClick={() => onClickAppt(item)}>{inner}</div>;
  }
  if (item.source === "google" && item.htmlLink) {
    return <a href={item.htmlLink} target="_blank" rel="noopener noreferrer" className="block">{inner}</a>;
  }
  if (item.source === "crm" && item.entityType === "deal" && item.entityId) {
    return <Link href={`/deal/${item.entityId}`} className="block">{inner}</Link>;
  }
  if (item.source === "crm" && item.entityType === "contact" && item.entityId) {
    return <Link href={`/contacts/${item.entityId}`} className="block">{inner}</Link>;
  }
  return <div>{inner}</div>;
}

// ═══════════════════════════════════════
// CURRENT TIME INDICATOR
// ═══════════════════════════════════════

function useCurrentTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// ═══════════════════════════════════════
// DAY VIEW — Premium Timeline
// ═══════════════════════════════════════

function DayView({ items, date, onClickAppt, onClickHour }: {
  items: AgendaItem[];
  date: Date;
  onClickAppt?: (item: AgendaItem) => void;
  onClickHour?: (hour: number) => void;
}) {
  const now = useCurrentTime();
  const localNow = toLocalDate(now);
  const isToday = isSameDay(date, toLocalDate(new Date()));
  const currentHourFrac = localNow.getHours() + localNow.getMinutes() / 60;
  const scrollRef = useRef<HTMLDivElement>(null);

  const allDayItems = items.filter(i => i.allDay);
  const timedItems = items.filter(i => !i.allDay);

  // Group items by hour slot
  const hourSlots: Record<number, AgendaItem[]> = {};
  timedItems.forEach(item => {
    const h = Math.floor(getLocalHour(item.startAt));
    const clamped = Math.max(DAY_START_HOUR, Math.min(DAY_END_HOUR - 1, h));
    if (!hourSlots[clamped]) hourSlots[clamped] = [];
    hourSlots[clamped].push(item);
  });

  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => i + DAY_START_HOUR);

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (isToday && scrollRef.current) {
      const offset = (currentHourFrac - DAY_START_HOUR) * HOUR_HEIGHT_PX - 100;
      scrollRef.current.scrollTop = Math.max(0, offset);
    }
  }, []);

  return (
    <div className="space-y-3">
      {/* All-day events */}
      {allDayItems.length > 0 && (
        <div className="border-b border-border/40 pb-3">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Dia inteiro</span>
          <div className="space-y-1.5">
            {allDayItems.map(item => <EventBlock key={item.id} item={item} onClickAppt={onClickAppt} />)}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div ref={scrollRef} className="relative overflow-y-auto max-h-[480px] scrollbar-thin" style={{ scrollbarGutter: "stable" }}>
        <div className="relative" style={{ height: hours.length * HOUR_HEIGHT_PX }}>
          {/* Hour grid lines */}
          {hours.map((hour, idx) => (
            <div
              key={hour}
              className="absolute left-0 right-0 flex group/slot cursor-pointer"
              style={{ top: idx * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
              onClick={() => !hourSlots[hour]?.length && onClickHour?.(hour)}
            >
              {/* Time label */}
              <div className="w-14 shrink-0 pr-3 text-right">
                <span className="text-[11px] font-medium text-muted-foreground/70 -mt-2 block">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
              {/* Grid line + events */}
              <div className="flex-1 border-t border-border/30 relative">
                {hourSlots[hour] && (
                  <div className="absolute inset-x-0 top-1 space-y-1 pr-1 z-10">
                    {hourSlots[hour].map(item => <EventBlock key={item.id} item={item} onClickAppt={onClickAppt} />)}
                  </div>
                )}
                {/* Hover hint */}
                {!hourSlots[hour]?.length && (
                  <div className="absolute inset-x-0 top-0 bottom-0 flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity">
                    <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                      <Plus className="h-3 w-3" /> Novo compromisso
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Current time indicator */}
          {isToday && currentHourFrac >= DAY_START_HOUR && currentHourFrac <= DAY_END_HOUR && (
            <div
              className="absolute left-12 right-0 z-20 pointer-events-none flex items-center"
              style={{ top: (currentHourFrac - DAY_START_HOUR) * HOUR_HEIGHT_PX }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
              <div className="flex-1 h-[2px] bg-red-500/80" />
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="py-12 text-center">
          <CalendarIcon className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-[13px] text-muted-foreground/60 font-medium">Nenhum evento neste dia</p>
          <p className="text-[11px] text-muted-foreground/40 mt-1">Clique em um horário para criar um compromisso</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// WEEK VIEW — Compact Grid
// ═══════════════════════════════════════

function WeekView({ items, weekStart, onClickAppt }: {
  items: AgendaItem[];
  weekStart: Date;
  onClickAppt?: (item: AgendaItem) => void;
}) {
  const today = toLocalDate(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dayGroups: Record<string, AgendaItem[]> = {};
  days.forEach(d => { dayGroups[formatDateISO(d)] = []; });

  items.forEach(item => {
    const itemDate = new Date(item.startAt);
    const key = formatDateISO(toLocalDate(itemDate));
    if (dayGroups[key]) dayGroups[key].push(item);
  });

  return (
    <div className="grid grid-cols-7 gap-[1px] bg-border/20 rounded-xl overflow-hidden">
      {days.map((day, idx) => {
        const key = formatDateISO(day);
        const isToday = isSameDay(day, today);
        const dayItems = dayGroups[key] || [];
        const isPast = day < startOfDay(today);

        return (
          <div
            key={key}
            className={`
              bg-card p-2 min-h-[120px] transition-colors
              ${isToday ? "bg-primary/[0.03] dark:bg-primary/[0.06]" : ""}
              ${isPast && !isToday ? "opacity-60" : ""}
            `}
          >
            {/* Day header */}
            <div className="text-center mb-2">
              <span className={`text-[9px] font-bold uppercase tracking-wider block ${
                isToday ? "text-primary" : "text-muted-foreground/60"
              }`}>
                {WEEKDAY_NAMES_SHORT[idx]}
              </span>
              <span className={`
                text-[13px] font-bold inline-flex items-center justify-center
                ${isToday
                  ? "bg-primary text-primary-foreground w-7 h-7 rounded-full"
                  : "text-foreground"
                }
              `}>
                {day.getDate()}
              </span>
            </div>

            {/* Events */}
            <div className="space-y-1">
              {dayItems.slice(0, 4).map(item => (
                <EventBlock key={item.id} item={item} onClickAppt={onClickAppt} compact />
              ))}
              {dayItems.length > 4 && (
                <p className="text-[10px] text-muted-foreground text-center font-semibold py-0.5">
                  +{dayItems.length - 4} mais
                </p>
              )}
            </div>

            {/* Empty day indicator */}
            {dayItems.length === 0 && (
              <div className="flex items-center justify-center h-12">
                <span className="text-[10px] text-muted-foreground/30">—</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════
// MONTH VIEW — Clean Grid
// ═══════════════════════════════════════

function MonthView({ items, date, onClickAppt }: {
  items: AgendaItem[];
  date: Date;
  onClickAppt?: (item: AgendaItem) => void;
}) {
  const today = toLocalDate(new Date());
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart);

  const weeks: Date[][] = [];
  let current = calendarStart;
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current = addDays(current, 1);
    }
    weeks.push(week);
    if (current > addDays(monthEnd, 7)) break;
  }

  const dayGroups: Record<string, AgendaItem[]> = {};
  items.forEach(item => {
    const itemDate = new Date(item.startAt);
    const key = formatDateISO(toLocalDate(itemDate));
    if (!dayGroups[key]) dayGroups[key] = [];
    dayGroups[key].push(item);
  });

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_NAMES_SHORT.map(name => (
          <div key={name} className="text-center text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest py-2">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid gap-[1px] bg-border/15 rounded-xl overflow-hidden">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-[1px]">
            {week.map((day) => {
              const key = formatDateISO(day);
              const isToday = isSameDay(day, today);
              const isCurrentMonth = day.getMonth() === date.getMonth();
              const dayItems = dayGroups[key] || [];
              const hasOverdue = dayItems.some(i => i.isOverdue);

              return (
                <div
                  key={key}
                  className={`
                    bg-card p-1.5 min-h-[68px] sm:min-h-[80px] transition-colors
                    ${!isCurrentMonth ? "opacity-30" : ""}
                    ${isToday ? "bg-primary/[0.04] dark:bg-primary/[0.07]" : ""}
                  `}
                >
                  {/* Date number */}
                  <div className="flex items-center justify-end mb-1">
                    <span className={`
                      text-[11px] font-bold
                      ${isToday
                        ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center"
                        : "text-foreground/80"
                      }
                    `}>
                      {day.getDate()}
                    </span>
                  </div>

                  {/* Event bars */}
                  <div className="space-y-[3px]">
                    {dayItems.slice(0, 3).map(item => {
                      const colors = getSourceColor(item);
                      return (
                        <div
                          key={item.id}
                          className={`
                            flex items-center gap-1 px-1.5 py-[2px] rounded
                            ${colors.bg} border-l-2 ${colors.border}
                            cursor-pointer hover:opacity-80 transition-opacity
                            ${item.isCompleted ? "opacity-35 line-through" : ""}
                          `}
                          title={`${item.title}${!item.allDay ? " • " + formatTimeShort(item.startAt) : ""}`}
                          onClick={() => item.source === "appointment" && onClickAppt?.(item)}
                        >
                          <span className={`text-[9px] sm:text-[10px] font-medium truncate ${colors.text}`}>
                            {item.title}
                          </span>
                        </div>
                      );
                    })}
                    {dayItems.length > 3 && (
                      <p className="text-[9px] text-muted-foreground/60 text-center font-semibold">
                        +{dayItems.length - 3}
                      </p>
                    )}
                  </div>

                  {/* Overdue indicator dot */}
                  {hasOverdue && dayItems.length === 0 && (
                    <div className="flex justify-center mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    </div>
                  )}
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
// CREATE/EDIT APPOINTMENT MODAL
// ═══════════════════════════════════════

interface AppointmentModalProps {
  open: boolean;
  onClose: () => void;
  editItem?: AgendaItem | null;
  defaultDate?: Date;
  defaultHour?: number;
  onSaved: () => void;
}

function AppointmentModal({ open, onClose, editItem, defaultDate, defaultHour, onSaved }: AppointmentModalProps) {
  const { user } = useAuth();
  const isEdit = !!editItem;
  const editId = editItem ? Number(editItem.id.replace("appt-", "")) : undefined;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [color, setColor] = useState("emerald");
  const [selectedParticipants, setSelectedParticipants] = useState<Array<{ userId: number; name: string }>>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [showParticipantPicker, setShowParticipantPicker] = useState(false);

  const tenantUsersQ = trpc.agenda.tenantUsers.useQuery(undefined, {
    enabled: open,
    staleTime: 60_000,
  });

  // Reset form when modal opens
  useMemo(() => {
    if (!open) return;
    if (editItem) {
      setTitle(editItem.title);
      setDescription(editItem.description || "");
      setAllDay(editItem.allDay);
      setLocation(editItem.location || "");
      setColor(editItem.color || "emerald");
      if (editItem.allDay) {
        setStartStr(toLocalInputDate(new Date(editItem.startAt)));
        setEndStr(toLocalInputDate(new Date(editItem.endAt)));
      } else {
        setStartStr(toLocalInputDatetime(new Date(editItem.startAt)));
        setEndStr(toLocalInputDatetime(new Date(editItem.endAt)));
      }
      setSelectedParticipants(editItem.participants || []);
    } else {
      setTitle("");
      setDescription("");
      setAllDay(false);
      setLocation("");
      setColor("emerald");
      const base = defaultDate || toLocalDate(new Date());
      const hour = defaultHour ?? base.getHours();
      const start = new Date(base);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      setStartStr(toLocalInputDatetime(start));
      setEndStr(toLocalInputDatetime(end));
      if (user) {
        setSelectedParticipants([{ userId: user.id, name: user.name || "Eu" }]);
      } else {
        setSelectedParticipants([]);
      }
    }
    setParticipantSearch("");
    setShowParticipantPicker(false);
  }, [open, editItem, defaultDate, defaultHour, user]);

  const createMut = trpc.agenda.createAppointment.useMutation({ onSuccess: () => { onSaved(); onClose(); } });
  const updateMut = trpc.agenda.updateAppointment.useMutation({ onSuccess: () => { onSaved(); onClose(); } });
  const deleteMut = trpc.agenda.deleteAppointment.useMutation({ onSuccess: () => { onSaved(); onClose(); } });
  const isPending = createMut.isPending || updateMut.isPending || deleteMut.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const startAt = new Date(startStr).getTime();
    let endAt = new Date(endStr).getTime();
    if (allDay) {
      const endDate = new Date(endStr);
      endDate.setHours(23, 59, 59, 999);
      endAt = endDate.getTime();
    }
    if (endAt <= startAt) endAt = startAt + 60 * 60 * 1000;
    const participantIds = selectedParticipants.map(p => p.userId);
    const payload = { title: title.trim(), description: description.trim() || undefined, startAt, endAt, allDay, location: location.trim() || undefined, color, participantIds };
    if (isEdit && editId) { updateMut.mutate({ id: editId, ...payload }); } else { createMut.mutate(payload); }
  };

  const handleDelete = () => {
    if (!editId) return;
    if (confirm("Excluir este compromisso?")) deleteMut.mutate({ id: editId });
  };

  const handleToggleComplete = () => {
    if (!editId) return;
    updateMut.mutate({ id: editId, isCompleted: !editItem?.isCompleted });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold">
            {isEdit ? "Editar Compromisso" : "Novo Compromisso"}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {isEdit ? "Altere os dados do compromisso" : "Crie um compromisso na sua agenda CRM"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="appt-title" className="text-[12px] font-semibold">Título *</Label>
            <Input id="appt-title" placeholder="Ex: Reunião com cliente, Follow-up..." value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 text-[13px]" autoFocus required />
          </div>

          <div className="flex items-center gap-3">
            <Switch id="appt-allday" checked={allDay} onCheckedChange={setAllDay} />
            <Label htmlFor="appt-allday" className="text-[12px] cursor-pointer">Dia inteiro</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="appt-start" className="text-[12px] font-semibold">Início</Label>
              <Input id="appt-start" type={allDay ? "date" : "datetime-local"} value={allDay ? startStr.split("T")[0] : startStr}
                onChange={(e) => {
                  setStartStr(e.target.value);
                  if (!allDay) {
                    const s = new Date(e.target.value).getTime();
                    const eVal = new Date(endStr).getTime();
                    if (s >= eVal) setEndStr(toLocalInputDatetime(new Date(s + 60 * 60 * 1000)));
                  }
                }}
                className="h-9 text-[13px]" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-end" className="text-[12px] font-semibold">{allDay ? "Fim" : "Término"}</Label>
              <Input id="appt-end" type={allDay ? "date" : "datetime-local"} value={allDay ? endStr.split("T")[0] : endStr} onChange={(e) => setEndStr(e.target.value)} className="h-9 text-[13px]" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-location" className="text-[12px] font-semibold flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Local <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input id="appt-location" placeholder="Ex: Escritório, Google Meet, Zoom..." value={location} onChange={(e) => setLocation(e.target.value)} className="h-9 text-[13px]" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold">Cor</Label>
            <div className="flex items-center gap-2.5">
              {APPOINTMENT_COLORS.map(c => (
                <button key={c.value} type="button" onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-full ${c.tw} transition-all ${color === c.value ? "ring-2 ring-offset-2 ring-offset-background ring-foreground/40 scale-110" : "opacity-50 hover:opacity-80"}`}
                  title={c.label} />
              ))}
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold flex items-center gap-1">
              <Users className="h-3 w-3" /> Participantes
            </Label>
            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
              {selectedParticipants.map(p => (
                <span key={p.userId} className="inline-flex items-center gap-1.5 bg-muted/80 px-2.5 py-1 rounded-full text-[11px] font-medium border border-border/50">
                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate max-w-[100px]">{p.name}</span>
                  {p.userId !== user?.id && (
                    <button type="button" className="text-muted-foreground hover:text-foreground ml-0.5" onClick={() => setSelectedParticipants(prev => prev.filter(x => x.userId !== p.userId))}>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              <button type="button" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-full border border-dashed border-border/60 hover:border-foreground/30 transition-colors"
                onClick={() => setShowParticipantPicker(!showParticipantPicker)}>
                <Plus className="h-3 w-3" /> Adicionar
              </button>
            </div>
            {showParticipantPicker && (
              <div className="border border-border rounded-lg bg-popover text-popover-foreground p-2 space-y-2 shadow-lg">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input placeholder="Buscar usuário..." value={participantSearch} onChange={(e) => setParticipantSearch(e.target.value)} className="h-7 text-[12px] pl-7" autoFocus />
                </div>
                <div className="max-h-[120px] overflow-y-auto space-y-0.5">
                  {(tenantUsersQ.data || []).filter(u => {
                    if (selectedParticipants.some(p => p.userId === u.userId)) return false;
                    if (participantSearch) {
                      const q = participantSearch.toLowerCase();
                      return u.name.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
                    }
                    return true;
                  }).map(u => (
                    <button key={u.userId} type="button" className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-left transition-colors"
                      onClick={() => { setSelectedParticipants(prev => [...prev, { userId: u.userId, name: u.name }]); setParticipantSearch(""); }}>
                      <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">{u.name.charAt(0).toUpperCase()}</span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium truncate">{u.name}</p>
                        {u.email && <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>}
                      </div>
                    </button>
                  ))}
                  {tenantUsersQ.isLoading && (
                    <div className="flex items-center justify-center py-2"><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /></div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-desc" className="text-[12px] font-semibold">Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Textarea id="appt-desc" placeholder="Detalhes adicionais..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-[13px] min-h-[60px] resize-none" rows={2} />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/40">
            <div className="flex items-center gap-2">
              {isEdit && (
                <>
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-[12px] text-red-500 hover:text-red-600 hover:bg-red-500/10 gap-1" onClick={handleDelete} disabled={isPending}>
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className={`h-8 text-[12px] gap-1 ${editItem?.isCompleted ? "text-amber-500" : "text-emerald-500"}`} onClick={handleToggleComplete} disabled={isPending}>
                    <Check className="h-3.5 w-3.5" /> {editItem?.isCompleted ? "Reabrir" : "Concluir"}
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-8 text-[12px]" onClick={onClose} disabled={isPending}>Cancelar</Button>
              <Button type="submit" size="sm" className="h-8 text-[12px] gap-1 px-4" disabled={isPending || !title.trim()}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {isEdit ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return "day";
    return "week";
  });

  const [currentDate, setCurrentDate] = useState(() => toLocalDate(new Date()));

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<AgendaItem | null>(null);
  const [defaultHour, setDefaultHour] = useState<number | undefined>(undefined);

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
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    const calStart = startOfWeek(ms);
    const calEnd = addDays(me, 6 - me.getDay());
    return { from: formatDateISO(calStart), to: formatDateISO(calEnd) };
  }, [viewMode, currentDate]);

  const queryInput = useMemo(() => ({
    from, to, userId: filterUserId, teamId: filterTeamId,
  }), [from, to, filterUserId, filterTeamId]);

  const agendaQ = trpc.agenda.unified.useQuery(queryInput, {
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const googleStatusQ = trpc.agenda.googleStatus.useQuery(undefined, { staleTime: 120_000 });
  const syncGoogleMut = trpc.agenda.syncGoogle.useMutation({ onSuccess: () => agendaQ.refetch() });

  const items = agendaQ.data || [];

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

  const title = useMemo(() => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString(SYSTEM_LOCALE, {
        weekday: "long", day: "numeric", month: "long", timeZone: SYSTEM_TIMEZONE,
      });
    }
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate);
      const we = addDays(ws, 6);
      const sameMonth = ws.getMonth() === we.getMonth();
      if (sameMonth) return `${ws.getDate()} – ${we.getDate()} de ${MONTH_NAMES[ws.getMonth()]}`;
      return `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()].slice(0, 3)} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()].slice(0, 3)}`;
    }
    return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [viewMode, currentDate]);

  const crmCount = items.filter(i => i.source === "crm").length;
  const gcalCount = items.filter(i => i.source === "google").length;
  const apptCount = items.filter(i => i.source === "appointment").length;
  const overdueCount = items.filter(i => i.isOverdue).length;
  const totalCount = items.length;
  const isGoogleConnected = googleStatusQ.data?.connected ?? false;

  const openCreateModal = useCallback((hour?: number) => {
    setEditItem(null);
    setDefaultHour(hour);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((item: AgendaItem) => {
    if (item.source !== "appointment") return;
    setEditItem(item);
    setDefaultHour(undefined);
    setModalOpen(true);
  }, []);

  return (
    <section className="mb-6 sm:mb-8">
      <div className="surface p-4 sm:p-6">
        {/* ── Header ── */}
        <div className="flex flex-col gap-4 mb-5">
          {/* Top row: title + actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary/10 shrink-0">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-foreground tracking-tight">Agenda</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {totalCount > 0 ? `${totalCount} evento${totalCount > 1 ? "s" : ""} no período` : "Nenhum evento"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                className="h-8 text-[12px] gap-1.5 shadow-sm"
                onClick={() => openCreateModal()}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Compromisso</span>
              </Button>

              {isGoogleConnected ? (
                <Button variant="ghost" size="sm" className="h-8 text-[11px] gap-1 text-sky-500 hover:text-sky-600"
                  onClick={() => syncGoogleMut.mutate()} disabled={syncGoogleMut.isPending}>
                  {syncGoogleMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  <span className="hidden sm:inline">Sync</span>
                </Button>
              ) : (
                <Link href="/profile">
                  <Button variant="ghost" size="sm" className="h-8 text-[11px] gap-1 text-muted-foreground hover:text-foreground">
                    <LinkIcon className="h-3 w-3" />
                    <span className="hidden sm:inline">Google</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Stats badges */}
          {totalCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {crmCount > 0 && (
                <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold border border-primary/10">
                  {crmCount} tarefa{crmCount > 1 ? "s" : ""}
                </span>
              )}
              {apptCount > 0 && (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full font-bold border border-emerald-500/10">
                  {apptCount} compromisso{apptCount > 1 ? "s" : ""}
                </span>
              )}
              {gcalCount > 0 && (
                <span className="text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2.5 py-1 rounded-full font-bold border border-sky-500/10">
                  {gcalCount} Google
                </span>
              )}
              {overdueCount > 0 && (
                <span className="text-[10px] bg-red-500/10 text-red-500 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-red-500/10">
                  <AlertTriangle className="h-3 w-3" />
                  {overdueCount} atrasada{overdueCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Navigation Bar ── */}
        <div className="flex items-center justify-between gap-2 mb-4 pb-4 border-b border-border/30">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-[12px] font-semibold px-3" onClick={goToday}>
              Hoje
            </Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-[13px] sm:text-[14px] font-bold text-foreground capitalize truncate flex-1 text-center">
            {title}
          </p>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted/60 rounded-lg p-1 gap-0.5 border border-border/30">
            {([
              { mode: "day" as ViewMode, icon: CalendarDays, label: "Dia" },
              { mode: "week" as ViewMode, icon: CalendarRange, label: "Semana" },
              { mode: "month" as ViewMode, icon: LayoutGrid, label: "Mês" },
            ]).map(({ mode, icon: ModeIcon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                  viewMode === mode
                    ? "bg-background text-foreground shadow-sm border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ModeIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Calendar Content ── */}
        {agendaQ.isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2.5 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-[13px] font-medium">Carregando agenda...</span>
          </div>
        ) : (
          <>
            {viewMode === "day" && <DayView items={items} date={currentDate} onClickAppt={openEditModal} onClickHour={(h) => openCreateModal(h)} />}
            {viewMode === "week" && <WeekView items={items} weekStart={startOfWeek(currentDate)} onClickAppt={openEditModal} />}
            {viewMode === "month" && <MonthView items={items} date={currentDate} onClickAppt={openEditModal} />}
          </>
        )}

        {/* ── Legend ── */}
        <div className="flex items-center gap-5 mt-4 pt-4 border-t border-border/30 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-[11px] text-muted-foreground font-medium">Tarefas CRM</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-muted-foreground font-medium">Compromissos</span>
          </div>
          {isGoogleConnected && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <span className="text-[11px] text-muted-foreground font-medium">Google Calendar</span>
            </div>
          )}
          {overdueCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-[11px] text-muted-foreground font-medium">Atrasadas</span>
            </div>
          )}
        </div>
      </div>

      {/* Appointment Modal */}
      <AppointmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditItem(null); }}
        editItem={editItem}
        defaultDate={currentDate}
        defaultHour={defaultHour}
        onSaved={() => agendaQ.refetch()}
      />
    </section>
  );
}
