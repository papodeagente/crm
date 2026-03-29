/**
 * AgendaCalendar — Unified Calendar for CRM Dashboard
 *
 * Merges CRM tasks, Google Calendar events, and manual CRM appointments
 * into a single view. Supports Day / Week / Month views.
 *
 * Colors:
 *  - CRM tasks: primary/violet
 *  - Google Calendar: #4285F4 (Google blue)
 *  - CRM Appointments: emerald
 *  - Overdue: red border
 *  - Completed: opacity-50 + line-through
 */

import { useState, useMemo, useCallback } from "react";
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

function getApptColorClasses(color?: string | null) {
  switch (color) {
    case "blue": return { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20", dot: "bg-blue-500" };
    case "purple": return { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20", dot: "bg-purple-500" };
    case "amber": return { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20", dot: "bg-amber-500" };
    case "rose": return { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/20", dot: "bg-rose-500" };
    case "cyan": return { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/20", dot: "bg-cyan-500" };
    default: return { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-500" };
  }
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

// ═══════════════════════════════════════
// AGENDA EVENT PILL
// ═══════════════════════════════════════

function AgendaEventPill({ item, onClickAppt }: { item: AgendaItem; onClickAppt?: (item: AgendaItem) => void }) {
  const isGoogle = item.source === "google";
  const isAppt = item.source === "appointment";
  const Icon = isGoogle
    ? CalendarIcon
    : isAppt
      ? Clock
      : (TASK_TYPE_ICONS[item.taskType || "task"] || CheckSquare);

  const baseClasses = "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] leading-tight transition-all cursor-pointer group";

  let colorClasses: string;
  if (isGoogle) {
    colorClasses = "bg-[#4285F4]/10 text-[#4285F4] hover:bg-[#4285F4]/20 border border-[#4285F4]/20";
  } else if (isAppt) {
    const c = getApptColorClasses(item.color);
    colorClasses = `${c.bg} ${c.text} hover:opacity-80 border ${c.border}`;
  } else {
    colorClasses = "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20";
  }

  const overdueClasses = item.isOverdue ? "!border-red-500/60 !bg-red-500/10 !text-red-600 dark:!text-red-400" : "";
  const completedClasses = item.isCompleted ? "opacity-50 line-through" : "";

  const hasParticipants = isAppt && item.participants && item.participants.length > 1;

  const content = (
    <div className={`${baseClasses} ${colorClasses} ${overdueClasses} ${completedClasses}`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate font-medium">{item.title}</span>
      {hasParticipants && (
        <span className="flex items-center gap-0.5 shrink-0 opacity-70" title={item.participants!.map(p => p.name).join(", ")}>
          <Users className="h-2.5 w-2.5" />
          <span className="text-[9px]">{item.participants!.length}</span>
        </span>
      )}
      {!item.allDay && (
        <span className="text-[9px] opacity-70 shrink-0 ml-auto">{formatTimeShort(item.startAt)}</span>
      )}
      {item.isOverdue && <AlertTriangle className="h-2.5 w-2.5 text-red-500 shrink-0" />}
    </div>
  );

  // Appointments open edit modal
  if (isAppt && onClickAppt) {
    return <div onClick={() => onClickAppt(item)}>{content}</div>;
  }

  // CRM tasks link to deal/contact; Google events open in new tab
  if (isGoogle && item.htmlLink) {
    return (
      <a href={item.htmlLink} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }

  if (!isGoogle && !isAppt && item.entityType === "deal" && item.entityId) {
    return <Link href={`/deal/${item.entityId}`} className="block">{content}</Link>;
  }

  if (!isGoogle && !isAppt && item.entityType === "contact" && item.entityId) {
    return <Link href={`/contacts/${item.entityId}`} className="block">{content}</Link>;
  }

  return <div>{content}</div>;
}

// ═══════════════════════════════════════
// DAY VIEW
// ═══════════════════════════════════════

function DayView({ items, date, onClickAppt, onClickHour }: { items: AgendaItem[]; date: Date; onClickAppt?: (item: AgendaItem) => void; onClickHour?: (hour: number) => void }) {
  const allDayItems = items.filter(i => i.allDay);
  const timedItems = items.filter(i => !i.allDay).sort((a, b) => a.startAt - b.startAt);

  const hourGroups: Record<number, AgendaItem[]> = {};
  timedItems.forEach(item => {
    const hour = new Date(item.startAt).getHours();
    if (!hourGroups[hour]) hourGroups[hour] = [];
    hourGroups[hour].push(item);
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const activeHours = new Set<number>();
  Object.keys(hourGroups).forEach(h => {
    const hour = Number(h);
    activeHours.add(Math.max(0, hour - 1));
    activeHours.add(hour);
    activeHours.add(Math.min(23, hour + 1));
  });

  if (activeHours.size === 0) {
    for (let h = 8; h <= 18; h++) activeHours.add(h);
  }

  const visibleHours = hours.filter(h => activeHours.has(h));

  return (
    <div className="space-y-1">
      {allDayItems.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Dia inteiro</p>
          <div className="space-y-1">
            {allDayItems.map(item => <AgendaEventPill key={item.id} item={item} onClickAppt={onClickAppt} />)}
          </div>
        </div>
      )}

      <div className="space-y-0">
        {visibleHours.map(hour => (
          <div
            key={hour}
            className="flex gap-2 min-h-[32px] group/hour cursor-pointer hover:bg-muted/30 rounded transition-colors"
            onClick={() => !hourGroups[hour]?.length && onClickHour?.(hour)}
          >
            <div className="w-10 text-[10px] text-muted-foreground font-medium text-right pt-1 shrink-0">
              {String(hour).padStart(2, "0")}:00
            </div>
            <div className="flex-1 border-t border-border/30 pt-1 pb-1 relative">
              {hourGroups[hour] ? (
                <div className="space-y-1">
                  {hourGroups[hour].map(item => <AgendaEventPill key={item.id} item={item} onClickAppt={onClickAppt} />)}
                </div>
              ) : (
                <div className="opacity-0 group-hover/hour:opacity-100 transition-opacity text-[10px] text-muted-foreground flex items-center gap-1 pt-0.5">
                  <Plus className="h-3 w-3" /> Novo compromisso
                </div>
              )}
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

function WeekView({ items, weekStart, onClickAppt }: { items: AgendaItem[]; weekStart: Date; onClickAppt?: (item: AgendaItem) => void }) {
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
                <AgendaEventPill key={item.id} item={item} onClickAppt={onClickAppt} />
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

function MonthView({ items, date, onClickAppt }: { items: AgendaItem[]; date: Date; onClickAppt?: (item: AgendaItem) => void }) {
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
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_NAMES_SHORT.map(name => (
          <div key={name} className="text-center text-[9px] font-bold text-muted-foreground uppercase tracking-wider py-1">
            {name}
          </div>
        ))}
      </div>

      <div className="grid gap-px bg-border/20 rounded-lg overflow-hidden">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-px">
            {week.map((day) => {
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
                      const isAppt = item.source === "appointment";
                      const dotColor = item.isOverdue
                        ? "bg-red-500"
                        : isGoogle
                          ? "bg-[#4285F4]"
                          : isAppt
                            ? getApptColorClasses(item.color).dot
                            : "bg-primary";
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-1 text-[9px] leading-tight truncate cursor-pointer hover:opacity-80 ${item.isCompleted ? "opacity-40 line-through" : ""}`}
                          title={item.title}
                          onClick={() => isAppt && onClickAppt?.(item)}
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

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [color, setColor] = useState("emerald");

  // Participants state
  const [selectedParticipants, setSelectedParticipants] = useState<Array<{ userId: number; name: string }>>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [showParticipantPicker, setShowParticipantPicker] = useState(false);

  // Fetch tenant users for participant picker
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
      // Load existing participants
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
      // Default: current user as participant
      if (user) {
        setSelectedParticipants([{ userId: user.id, name: user.name || "Eu" }]);
      } else {
        setSelectedParticipants([]);
      }
    }
    setParticipantSearch("");
    setShowParticipantPicker(false);
  }, [open, editItem, defaultDate, defaultHour, user]);

  const createMut = trpc.agenda.createAppointment.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
  });

  const updateMut = trpc.agenda.updateAppointment.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
  });

  const deleteMut = trpc.agenda.deleteAppointment.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
  });

  const isPending = createMut.isPending || updateMut.isPending || deleteMut.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const startAt = new Date(startStr).getTime();
    let endAt = new Date(endStr).getTime();
    if (allDay) {
      // For all-day, set end to end of day
      const endDate = new Date(endStr);
      endDate.setHours(23, 59, 59, 999);
      endAt = endDate.getTime();
    }
    if (endAt <= startAt) endAt = startAt + 60 * 60 * 1000;

    const participantIds = selectedParticipants.map(p => p.userId);

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      startAt,
      endAt,
      allDay,
      location: location.trim() || undefined,
      color,
      participantIds,
    };

    if (isEdit && editId) {
      updateMut.mutate({ id: editId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const handleDelete = () => {
    if (!editId) return;
    if (confirm("Excluir este compromisso?")) {
      deleteMut.mutate({ id: editId });
    }
  };

  const handleToggleComplete = () => {
    if (!editId) return;
    updateMut.mutate({ id: editId, isCompleted: !editItem?.isCompleted });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">
            {isEdit ? "Editar Compromisso" : "Novo Compromisso"}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {isEdit ? "Altere os dados do compromisso" : "Crie um compromisso na sua agenda CRM"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="appt-title" className="text-[12px]">Título *</Label>
            <Input
              id="appt-title"
              placeholder="Ex: Reunião com cliente, Follow-up..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 text-[13px]"
              autoFocus
              required
            />
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="appt-allday"
              checked={allDay}
              onCheckedChange={setAllDay}
            />
            <Label htmlFor="appt-allday" className="text-[12px] cursor-pointer">Dia inteiro</Label>
          </div>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="appt-start" className="text-[12px]">Início</Label>
              <Input
                id="appt-start"
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? startStr.split("T")[0] : startStr}
                onChange={(e) => {
                  setStartStr(e.target.value);
                  // Auto-adjust end if start is after end
                  if (!allDay) {
                    const s = new Date(e.target.value).getTime();
                    const eVal = new Date(endStr).getTime();
                    if (s >= eVal) {
                      setEndStr(toLocalInputDatetime(new Date(s + 60 * 60 * 1000)));
                    }
                  }
                }}
                className="h-9 text-[13px]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-end" className="text-[12px]">{allDay ? "Fim" : "Término"}</Label>
              <Input
                id="appt-end"
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? endStr.split("T")[0] : endStr}
                onChange={(e) => setEndStr(e.target.value)}
                className="h-9 text-[13px]"
                required
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="appt-location" className="text-[12px] flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Local (opcional)
            </Label>
            <Input
              id="appt-location"
              placeholder="Ex: Escritório, Google Meet, Zoom..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-9 text-[13px]"
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label className="text-[12px]">Cor</Label>
            <div className="flex items-center gap-2">
              {APPOINTMENT_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-6 h-6 rounded-full ${c.tw} transition-all ${
                    color === c.value ? "ring-2 ring-offset-2 ring-offset-background ring-foreground/50 scale-110" : "opacity-60 hover:opacity-100"
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-1.5">
            <Label className="text-[12px] flex items-center gap-1">
              <Users className="h-3 w-3" /> Participantes
            </Label>
            {/* Selected participants */}
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
              {selectedParticipants.map(p => (
                <span
                  key={p.userId}
                  className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full text-[11px] font-medium"
                >
                  <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate max-w-[100px]">{p.name}</span>
                  {p.userId !== user?.id && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground ml-0.5"
                      onClick={() => setSelectedParticipants(prev => prev.filter(x => x.userId !== p.userId))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-full border border-dashed border-border hover:border-foreground/30 transition-colors"
                onClick={() => setShowParticipantPicker(!showParticipantPicker)}
              >
                <Plus className="h-3 w-3" />
                Adicionar
              </button>
            </div>
            {/* Participant search picker */}
            {showParticipantPicker && (
              <div className="border border-border rounded-lg bg-popover p-2 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuário..."
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="h-7 text-[12px] pl-7"
                    autoFocus
                  />
                </div>
                <div className="max-h-[120px] overflow-y-auto space-y-0.5">
                  {(tenantUsersQ.data || []).filter(u => {
                    // Exclude already selected
                    if (selectedParticipants.some(p => p.userId === u.userId)) return false;
                    // Filter by search
                    if (participantSearch) {
                      const q = participantSearch.toLowerCase();
                      return u.name.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
                    }
                    return true;
                  }).map(u => (
                    <button
                      key={u.userId}
                      type="button"
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-left transition-colors"
                      onClick={() => {
                        setSelectedParticipants(prev => [...prev, { userId: u.userId, name: u.name }]);
                        setParticipantSearch("");
                      }}
                    >
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium truncate">{u.name}</p>
                        {u.email && <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>}
                      </div>
                    </button>
                  ))}
                  {tenantUsersQ.isLoading && (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!tenantUsersQ.isLoading && (tenantUsersQ.data || []).filter(u => !selectedParticipants.some(p => p.userId === u.userId)).length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-2">Nenhum usuário disponível</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="appt-desc" className="text-[12px]">Descrição (opcional)</Label>
            <Textarea
              id="appt-desc"
              placeholder="Detalhes adicionais..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-[13px] min-h-[60px] resize-none"
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              {isEdit && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[12px] text-red-500 hover:text-red-600 hover:bg-red-500/10 gap-1"
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`h-8 text-[12px] gap-1 ${editItem?.isCompleted ? "text-amber-500" : "text-emerald-500"}`}
                    onClick={handleToggleComplete}
                    disabled={isPending}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {editItem?.isCompleted ? "Reabrir" : "Concluir"}
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-8 text-[12px]" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="h-8 text-[12px] gap-1" disabled={isPending || !title.trim()}>
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

  // Responsive: default to day on mobile
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return "day";
    return "week";
  });

  const [currentDate, setCurrentDate] = useState(() => toLocalDate(new Date()));

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<AgendaItem | null>(null);
  const [defaultHour, setDefaultHour] = useState<number | undefined>(undefined);

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
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
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
  const apptCount = items.filter(i => i.source === "appointment").length;
  const overdueCount = items.filter(i => i.isOverdue).length;

  const isGoogleConnected = googleStatusQ.data?.connected ?? false;

  // Handlers
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
                {apptCount > 0 && " + Compromissos"}
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
            {apptCount > 0 && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                {apptCount} compromisso{apptCount > 1 ? "s" : ""}
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

            {/* Create Appointment Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => openCreateModal()}
            >
              <Plus className="h-3 w-3" />
              Compromisso
            </Button>

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
            {viewMode === "day" && <DayView items={items} date={currentDate} onClickAppt={openEditModal} onClickHour={(h) => openCreateModal(h)} />}
            {viewMode === "week" && <WeekView items={items} weekStart={startOfWeek(currentDate)} onClickAppt={openEditModal} />}
            {viewMode === "month" && <MonthView items={items} date={currentDate} onClickAppt={openEditModal} />}
          </>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[10px] text-muted-foreground">Tarefas CRM</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-muted-foreground">Compromissos</span>
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
