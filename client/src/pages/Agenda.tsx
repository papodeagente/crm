import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  User,
  Scissors,
  DollarSign,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { useState, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";

// ─── Constants ───

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7h–21h
const HOUR_HEIGHT = 64; // px per hour slot
const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type ViewMode = "day" | "week";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/80 border-blue-600",
  confirmed: "bg-emerald-500/80 border-emerald-600",
  in_progress: "bg-amber-500/80 border-amber-600",
  completed: "bg-gray-400/60 border-gray-500",
  cancelled: "bg-red-400/50 border-red-500 line-through opacity-60",
  no_show: "bg-orange-400/60 border-orange-500",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

// ─── Helpers ───

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDays(base: Date): Date[] {
  const d = new Date(base);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return day;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

function formatCurrency(amount: number | null | undefined) {
  if (amount == null) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

// ─── Main Component ───

export default function Agenda() {
  const utils = trpc.useUtils();

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [baseDate, setBaseDate] = useState(() => new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [detailAppt, setDetailAppt] = useState<any | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");
  const [formServiceType, setFormServiceType] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndDate, setFormEndDate] = useState("");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formProfessionalId, setFormProfessionalId] = useState("");
  const [formRecurrence, setFormRecurrence] = useState("none");

  // Date range for query
  const weekDays = useMemo(() => getWeekDays(baseDate), [baseDate]);
  const queryRange = useMemo(() => {
    if (viewMode === "day") {
      const dayAfter = new Date(baseDate);
      dayAfter.setDate(dayAfter.getDate() + 1);
      return { from: toLocalDateStr(baseDate), to: toLocalDateStr(dayAfter) };
    }
    const start = weekDays[0];
    const end = new Date(weekDays[6]);
    end.setDate(end.getDate() + 1);
    return { from: toLocalDateStr(start), to: toLocalDateStr(end) };
  }, [viewMode, baseDate, weekDays]);

  // Queries
  const agendaQuery = trpc.agenda.unified.useQuery(queryRange, {
    refetchOnWindowFocus: false,
  });
  const tenantUsersQuery = trpc.agenda.tenantUsers.useQuery();

  // Mutations
  const createMut = trpc.agenda.createAppointment.useMutation({
    onSuccess: () => {
      utils.agenda.unified.invalidate();
      toast.success("Agendamento criado!");
      resetForm();
      setCreateOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar"),
  });

  const confirmMut = trpc.agenda.confirmAppointment.useMutation({
    onSuccess: () => { utils.agenda.unified.invalidate(); setDetailAppt(null); toast.success("Confirmado!"); },
  });
  const completeMut = trpc.agenda.completeAppointment.useMutation({
    onSuccess: () => { utils.agenda.unified.invalidate(); setDetailAppt(null); toast.success("Concluído!"); },
  });
  const cancelMut = trpc.agenda.cancelAppointment.useMutation({
    onSuccess: () => { utils.agenda.unified.invalidate(); setDetailAppt(null); toast.success("Cancelado."); },
  });

  const tenantUsers = (tenantUsersQuery.data as any[]) || [];

  // Filter appointments from unified data
  const appointments = useMemo(() => {
    const items = agendaQuery.data;
    if (!items || !Array.isArray(items)) return [];
    return items.filter((item: any) => item.source === "appointment" || item.source === "google");
  }, [agendaQuery.data]);

  // Helpers
  function resetForm() {
    setFormTitle(""); setFormContactPhone(""); setFormServiceType("");
    setFormPrice(""); setFormLocation(""); setFormNotes("");
    setFormStartDate(""); setFormStartTime("09:00");
    setFormEndDate(""); setFormEndTime("10:00");
    setFormProfessionalId(""); setFormRecurrence("none");
  }

  function openCreate(date?: Date, hour?: number) {
    const d = date || new Date();
    setFormStartDate(toLocalDateStr(d));
    setFormEndDate(toLocalDateStr(d));
    if (hour !== undefined) {
      setFormStartTime(`${String(hour).padStart(2, "0")}:00`);
      setFormEndTime(`${String(hour + 1).padStart(2, "0")}:00`);
    }
    setCreateOpen(true);
  }

  function handleCreate() {
    if (!formTitle.trim()) { toast.error("Informe o título."); return; }
    if (!formStartDate || !formStartTime) { toast.error("Informe data e horário."); return; }

    const startAt = new Date(`${formStartDate}T${formStartTime}:00`).getTime();
    const endDate = formEndDate || formStartDate;
    const endAt = new Date(`${endDate}T${formEndTime}:00`).getTime();

    if (isNaN(startAt) || isNaN(endAt)) { toast.error("Data/horário inválido."); return; }
    if (endAt <= startAt) { toast.error("Horário de fim deve ser depois do início."); return; }

    createMut.mutate({
      title: formTitle.trim(),
      startAt,
      endAt,
      contactPhone: formContactPhone.trim() || undefined,
      serviceType: formServiceType.trim() || undefined,
      price: formPrice ? parseFloat(formPrice) : undefined,
      location: formLocation.trim() || undefined,
      notes: formNotes.trim() || undefined,
      professionalId: formProfessionalId ? Number(formProfessionalId) : undefined,
      recurrenceRule: formRecurrence !== "none" ? formRecurrence : undefined,
    });
  }

  function getApptNumericId(appt: any): number {
    if (typeof appt.id === "string" && appt.id.startsWith("appt-")) {
      return Number(appt.id.replace("appt-", ""));
    }
    return typeof appt.id === "number" ? appt.id : 0;
  }

  function getProfName(id: number | null | undefined): string {
    if (!id) return "";
    const u = tenantUsers.find((u: any) => u.userId === id);
    return u?.name || u?.email || "";
  }

  // Navigation
  function navigate(dir: number) {
    const d = new Date(baseDate);
    if (viewMode === "day") d.setDate(d.getDate() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setBaseDate(d);
  }

  function getTitle(): string {
    if (viewMode === "day") {
      return baseDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    }
    const s = weekDays[0];
    const e = weekDays[6];
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()} — ${e.getDate()} de ${MONTHS_PT[s.getMonth()]}`;
    }
    return `${s.getDate()} ${MONTHS_PT[s.getMonth()].slice(0, 3)} — ${e.getDate()} ${MONTHS_PT[e.getMonth()].slice(0, 3)}`;
  }

  // Get appointments for a specific day
  function getApptsForDay(day: Date) {
    return appointments.filter((a: any) => {
      const start = new Date(a.startAt);
      return isSameDay(start, day);
    });
  }

  // Calculate position/height of an appointment block in the calendar
  function getApptStyle(appt: any) {
    const start = new Date(appt.startAt);
    const end = new Date(appt.endAt || start.getTime() + 3600000);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const top = (startHour - HOURS[0]) * HOUR_HEIGHT;
    const height = Math.max((endHour - startHour) * HOUR_HEIGHT, 24);
    return { top: `${top}px`, height: `${height}px` };
  }

  const today = new Date();
  const isLoading = agendaQuery.isLoading;

  return (
    <div className="page-content flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-5 w-5 text-[#2E7D5B]" />
          <h1 className="text-xl font-semibold tracking-tight">Agenda</h1>
          <Badge variant="secondary" className="text-xs">
            {appointments.length} agendamento{appointments.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <Button size="sm" className="gap-2 bg-[#2E7D5B] hover:bg-[#256B4D]" onClick={() => openCreate()}>
          <Plus className="h-4 w-4" />
          Novo Agendamento
        </Button>
      </div>

      {/* Nav bar */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-1">
          <Button variant={viewMode === "day" ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setViewMode("day")}>
            Dia
          </Button>
          <Button variant={viewMode === "week" ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setViewMode("week")}>
            Semana
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[180px] text-center">{getTitle()}</span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setBaseDate(new Date())}>
            Hoje
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto border rounded-lg bg-card">
          {/* Day headers */}
          <div className="flex sticky top-0 z-20 bg-card border-b">
            {/* Time gutter */}
            <div className="w-16 shrink-0 border-r" />
            {/* Day columns */}
            {(viewMode === "week" ? weekDays : [baseDate]).map((day, i) => {
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={i}
                  className={`flex-1 text-center py-2 border-r last:border-r-0 ${isToday ? "bg-[#2E7D5B]/5" : ""}`}
                >
                  <p className="text-xs text-muted-foreground">{DAYS_PT[day.getDay()]}</p>
                  <p className={`text-lg font-semibold ${isToday ? "text-[#2E7D5B]" : "text-foreground"}`}>
                    {day.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="flex relative">
            {/* Time labels */}
            <div className="w-16 shrink-0 border-r">
              {HOURS.map((h) => (
                <div key={h} className="border-b" style={{ height: `${HOUR_HEIGHT}px` }}>
                  <span className="text-[11px] text-muted-foreground px-2 -mt-2 block">
                    {formatHour(h)}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns with appointments */}
            {(viewMode === "week" ? weekDays : [baseDate]).map((day, colIdx) => {
              const dayAppts = getApptsForDay(day);
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={colIdx}
                  className={`flex-1 relative border-r last:border-r-0 ${isToday ? "bg-[#2E7D5B]/[0.02]" : ""}`}
                >
                  {/* Hour grid lines (clickable) */}
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="border-b border-border/50 cursor-pointer hover:bg-accent/30 transition-colors"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      onClick={() => openCreate(day, h)}
                    />
                  ))}

                  {/* Current time indicator */}
                  {isToday && (() => {
                    const now = new Date();
                    const nowHour = now.getHours() + now.getMinutes() / 60;
                    if (nowHour < HOURS[0] || nowHour > HOURS[HOURS.length - 1] + 1) return null;
                    const top = (nowHour - HOURS[0]) * HOUR_HEIGHT;
                    return (
                      <div
                        className="absolute left-0 right-0 z-10 pointer-events-none"
                        style={{ top: `${top}px` }}
                      >
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                          <div className="flex-1 h-px bg-red-500" />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Appointment blocks */}
                  {dayAppts.map((appt: any, idx: number) => {
                    const style = getApptStyle(appt);
                    const status = appt.status || "scheduled";
                    const colorClass = STATUS_COLORS[status] || STATUS_COLORS.scheduled;
                    const startDate = new Date(appt.startAt);
                    const endDate = new Date(appt.endAt || appt.startAt + 3600000);
                    const timeStr = `${startDate.getHours().toString().padStart(2, "0")}:${startDate.getMinutes().toString().padStart(2, "0")}`;
                    const endTimeStr = `${endDate.getHours().toString().padStart(2, "0")}:${endDate.getMinutes().toString().padStart(2, "0")}`;

                    return (
                      <div
                        key={appt.id}
                        className={`absolute left-1 right-1 rounded-md border-l-[3px] px-2 py-1 cursor-pointer overflow-hidden text-white shadow-sm hover:shadow-md transition-shadow z-10 ${colorClass}`}
                        style={{ top: style.top, height: style.height }}
                        onClick={(e) => { e.stopPropagation(); setDetailAppt(appt); }}
                      >
                        <p className="text-[11px] font-semibold truncate leading-tight">
                          {appt.title}
                        </p>
                        <p className="text-[10px] opacity-80 truncate">
                          {timeStr} — {endTimeStr}
                        </p>
                        {appt.serviceType && (
                          <p className="text-[10px] opacity-70 truncate">{appt.serviceType}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Título *</Label>
              <Input placeholder="Ex: Corte de cabelo, Consulta..." value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Data início *</Label>
                <Input type="date" value={formStartDate} onChange={(e) => { setFormStartDate(e.target.value); if (!formEndDate) setFormEndDate(e.target.value); }} />
              </div>
              <div className="grid gap-2">
                <Label>Horário início *</Label>
                <Input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Data fim</Label>
                <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Horário fim</Label>
                <Input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Telefone do cliente</Label>
                <Input placeholder="(11) 99999-9999" value={formContactPhone} onChange={(e) => setFormContactPhone(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Tipo de serviço</Label>
                <Input placeholder="Ex: Corte, Limpeza..." value={formServiceType} onChange={(e) => setFormServiceType(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0,00" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Local</Label>
                <Input placeholder="Sala 1, Consultório..." value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
              </div>
            </div>
            {tenantUsers.length > 0 && (
              <div className="grid gap-2">
                <Label>Profissional</Label>
                <Select value={formProfessionalId} onValueChange={setFormProfessionalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantUsers.map((u: any) => (
                      <SelectItem key={u.userId} value={String(u.userId)}>{u.name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Recorrência</Label>
              <Select value={formRecurrence} onValueChange={setFormRecurrence}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem recorrência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem recorrência</SelectItem>
                  <SelectItem value="INTERVAL:7">Semanal (7 dias)</SelectItem>
                  <SelectItem value="INTERVAL:15">Quinzenal (15 dias)</SelectItem>
                  <SelectItem value="INTERVAL:30">Mensal (30 dias)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea placeholder="Anotações..." rows={3} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending} className="bg-[#2E7D5B] hover:bg-[#256B4D]">
              {createMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailAppt} onOpenChange={(open) => { if (!open) setDetailAppt(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          {detailAppt && (() => {
            const status = detailAppt.status || "scheduled";
            const startDate = new Date(detailAppt.startAt);
            const endDate = new Date(detailAppt.endAt || detailAppt.startAt + 3600000);
            const numericId = getApptNumericId(detailAppt);
            const isTerminal = status === "completed" || status === "cancelled" || status === "no_show";

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {detailAppt.title}
                    <Badge variant="outline" className="text-[11px]">
                      {STATUS_LABELS[status] || status}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {startDate.toLocaleDateString("pt-BR")} · {startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — {endDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {detailAppt.serviceType && (
                    <div className="flex items-center gap-2 text-sm">
                      <Scissors className="h-4 w-4 text-muted-foreground" />
                      <span>{detailAppt.serviceType}</span>
                    </div>
                  )}
                  {detailAppt.contactPhone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{detailAppt.contactPhone}</span>
                    </div>
                  )}
                  {detailAppt.contactName && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{detailAppt.contactName}</span>
                    </div>
                  )}
                  {detailAppt.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{detailAppt.location}</span>
                    </div>
                  )}
                  {detailAppt.price != null && detailAppt.price > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-emerald-600">{formatCurrency(detailAppt.price)}</span>
                    </div>
                  )}
                  {detailAppt.professionalId && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Prof: {getProfName(detailAppt.professionalId)}</span>
                    </div>
                  )}
                  {detailAppt.notes && (
                    <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{detailAppt.notes}</p>
                  )}
                </div>
                {!isTerminal && numericId > 0 && (
                  <DialogFooter className="gap-2 sm:gap-2">
                    {status === "scheduled" && (
                      <Button size="sm" variant="outline" className="text-blue-600" onClick={() => confirmMut.mutate({ id: numericId })} disabled={confirmMut.isPending}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar
                      </Button>
                    )}
                    {(status === "scheduled" || status === "confirmed" || status === "in_progress") && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => completeMut.mutate({ id: numericId })} disabled={completeMut.isPending}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir
                      </Button>
                    )}
                    {(status === "scheduled" || status === "confirmed") && (
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => cancelMut.mutate({ id: numericId })} disabled={cancelMut.isPending}>
                        <XCircle className="h-4 w-4 mr-1" /> Cancelar
                      </Button>
                    )}
                  </DialogFooter>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
