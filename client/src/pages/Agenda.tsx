import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  RefreshCw,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  formatDate,
  formatTime,
  formatDateLong,
  formatMonthYear,
  formatDateRange,
} from "../../../shared/dateUtils";

// ─── Types & Config ───

type ViewMode = "week" | "day" | "month";

interface AppointmentItem {
  id: number;
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  location?: string | null;
  color?: string | null;
  serviceType?: string | null;
  status?: string | null;
  notes?: string | null;
  price?: number | null;
  professionalId?: number | null;
  contactPhone?: string | null;
  recurrenceRule?: string | null;
  type?: string;
  professional?: { id: number; name: string } | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  scheduled: {
    label: "Agendado",
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
  confirmed: {
    label: "Confirmado",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  in_progress: {
    label: "Em andamento",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  completed: {
    label: "Concluído",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  no_show: {
    label: "Não compareceu",
    className: "bg-orange-100 text-orange-700 border-orange-200",
  },
};

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Sem recorrência" },
  { value: "INTERVAL:7", label: "Semanal (7 dias)" },
  { value: "INTERVAL:15", label: "Quinzenal (15 dias)" },
  { value: "INTERVAL:30", label: "Mensal (30 dias)" },
];

function formatCurrency(amount: number | null | undefined) {
  if (amount == null) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

function getDateRange(view: ViewMode, baseDate: Date) {
  const d = new Date(baseDate);
  if (view === "day") {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setMilliseconds(-1);
    return { from: start, to: end };
  }
  if (view === "week") {
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  }
  // month
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from: start, to: end };
}

function getViewTitle(view: ViewMode, baseDate: Date) {
  if (view === "day") return formatDateLong(baseDate);
  if (view === "week") {
    const start = new Date(baseDate);
    start.setDate(baseDate.getDate() - baseDate.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return formatDateRange(start, end);
  }
  return formatMonthYear(baseDate);
}

function navigateDate(view: ViewMode, baseDate: Date, dir: number) {
  const d = new Date(baseDate);
  if (view === "day") d.setDate(d.getDate() + dir);
  else if (view === "week") d.setDate(d.getDate() + dir * 7);
  else d.setMonth(d.getMonth() + dir);
  return d;
}

// ─── Main Component ───

export default function Agenda() {
  const utils = trpc.useUtils();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [baseDate, setBaseDate] = useState(() => new Date());

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
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

  // Computed date range
  const dateRange = useMemo(
    () => getDateRange(viewMode, baseDate),
    [viewMode, baseDate],
  );

  // Queries
  const agendaQuery = trpc.agenda.unified.useQuery({
    from: dateRange.from.getTime(),
    to: dateRange.to.getTime(),
  });

  const tenantUsersQuery = trpc.agenda.tenantUsers.useQuery();

  // Mutations
  const createAppointment = trpc.agenda.createAppointment.useMutation({
    onSuccess: () => {
      utils.agenda.unified.invalidate();
      toast.success("Agendamento criado com sucesso!");
      resetForm();
      setCreateOpen(false);
    },
    onError: (err) => toast.error(err.message || "Erro ao criar agendamento"),
  });

  const confirmAppointment = trpc.agenda.confirmAppointment.useMutation({
    onSuccess: () => {
      utils.agenda.unified.invalidate();
      toast.success("Agendamento confirmado!");
    },
    onError: (err) => toast.error(err.message || "Erro ao confirmar"),
  });

  const completeAppointment = trpc.agenda.completeAppointment.useMutation({
    onSuccess: () => {
      utils.agenda.unified.invalidate();
      toast.success("Agendamento concluído!");
    },
    onError: (err) => toast.error(err.message || "Erro ao concluir"),
  });

  const cancelAppointment = trpc.agenda.cancelAppointment.useMutation({
    onSuccess: () => {
      utils.agenda.unified.invalidate();
      toast.success("Agendamento cancelado.");
    },
    onError: (err) => toast.error(err.message || "Erro ao cancelar"),
  });

  // Helpers
  function resetForm() {
    setFormTitle("");
    setFormContactPhone("");
    setFormServiceType("");
    setFormPrice("");
    setFormLocation("");
    setFormNotes("");
    setFormStartDate("");
    setFormStartTime("09:00");
    setFormEndDate("");
    setFormEndTime("10:00");
    setFormProfessionalId("");
    setFormRecurrence("none");
  }

  function handleCreate() {
    if (!formTitle.trim()) {
      toast.error("Informe o título do agendamento.");
      return;
    }
    if (!formStartDate || !formStartTime) {
      toast.error("Informe a data e horário de início.");
      return;
    }

    const startAt = new Date(`${formStartDate}T${formStartTime}`).getTime();
    const endAt =
      formEndDate && formEndTime
        ? new Date(`${formEndDate}T${formEndTime}`).getTime()
        : new Date(`${formStartDate}T${formEndTime}`).getTime();

    createAppointment.mutate({
      title: formTitle.trim(),
      startAt,
      endAt,
      contactPhone: formContactPhone.trim() || undefined,
      serviceType: formServiceType.trim() || undefined,
      price: formPrice ? parseFloat(formPrice) : undefined,
      location: formLocation.trim() || undefined,
      notes: formNotes.trim() || undefined,
      professionalId: formProfessionalId
        ? Number(formProfessionalId)
        : undefined,
      recurrenceRule:
        formRecurrence !== "none" ? formRecurrence : undefined,
    });
  }

  // Filter only appointment items from unified agenda
  const appointments = useMemo(() => {
    const items = (agendaQuery.data as any[]) || [];
    return items
      .filter(
        (item: any) =>
          item.type === "appointment" || item.type === "calendar",
      )
      .sort(
        (a: any, b: any) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
  }, [agendaQuery.data]);

  // Group appointments by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, AppointmentItem[]> = {};
    for (const apt of appointments) {
      const dateKey = formatDate(apt.startAt);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(apt);
    }
    return groups;
  }, [appointments]);

  const tenantUsers = (tenantUsersQuery.data as any[]) || [];

  function getProfessionalName(professionalId: number | null | undefined) {
    if (!professionalId) return "";
    const user = tenantUsers.find((u: any) => u.id === professionalId);
    return user?.name || user?.email || "";
  }

  // Set default form dates when opening the dialog
  function handleOpenCreate() {
    const today = new Date().toISOString().split("T")[0];
    setFormStartDate(today);
    setFormEndDate(today);
    setCreateOpen(true);
  }

  return (
    <div className="p-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Agenda
          </h1>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">
            Gerencie seus agendamentos e compromissos
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="h-9 gap-2 rounded-lg text-[13px]"
              onClick={handleOpenCreate}
            >
              <Plus className="h-4 w-4" />
              Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Agendamento</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Title */}
              <div className="grid gap-2">
                <Label htmlFor="apt-title">Título *</Label>
                <Input
                  id="apt-title"
                  placeholder="Ex: Corte de cabelo, Consulta..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              {/* Date / Time row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="apt-start-date">Data início *</Label>
                  <Input
                    id="apt-start-date"
                    type="date"
                    value={formStartDate}
                    onChange={(e) => {
                      setFormStartDate(e.target.value);
                      if (!formEndDate) setFormEndDate(e.target.value);
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="apt-start-time">Horário início *</Label>
                  <Input
                    id="apt-start-time"
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="apt-end-date">Data fim</Label>
                  <Input
                    id="apt-end-date"
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="apt-end-time">Horário fim</Label>
                  <Input
                    id="apt-end-time"
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Contact phone + service type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="apt-phone">Telefone do cliente</Label>
                  <Input
                    id="apt-phone"
                    placeholder="(11) 99999-9999"
                    value={formContactPhone}
                    onChange={(e) => setFormContactPhone(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="apt-service">Tipo de serviço</Label>
                  <Input
                    id="apt-service"
                    placeholder="Ex: Corte, Limpeza..."
                    value={formServiceType}
                    onChange={(e) => setFormServiceType(e.target.value)}
                  />
                </div>
              </div>

              {/* Price + Location */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="apt-price">Valor (R$)</Label>
                  <Input
                    id="apt-price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="apt-location">Local</Label>
                  <Input
                    id="apt-location"
                    placeholder="Sala 1, Consultório..."
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                  />
                </div>
              </div>

              {/* Professional */}
              <div className="grid gap-2">
                <Label>Profissional</Label>
                <Select
                  value={formProfessionalId}
                  onValueChange={setFormProfessionalId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantUsers.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Recurrence */}
              <div className="grid gap-2">
                <Label>Recorrência</Label>
                <Select
                  value={formRecurrence}
                  onValueChange={setFormRecurrence}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem recorrência" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="grid gap-2">
                <Label htmlFor="apt-notes">Observações</Label>
                <Textarea
                  id="apt-notes"
                  placeholder="Anotações sobre o agendamento..."
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createAppointment.isPending}
              >
                {createAppointment.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Criar Agendamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* View tabs + Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
        >
          <TabsList>
            <TabsTrigger value="day">Dia</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="month">Mês</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setBaseDate(navigateDate(viewMode, baseDate, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[160px] text-center">
            {getViewTitle(viewMode, baseDate)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setBaseDate(navigateDate(viewMode, baseDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[13px]"
            onClick={() => setBaseDate(new Date())}
          >
            Hoje
          </Button>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="secondary" className="gap-1.5 py-1 px-3">
          <CalendarIcon className="h-3.5 w-3.5" />
          {appointments.length} agendamento{appointments.length !== 1 ? "s" : ""}
        </Badge>
        {agendaQuery.isLoading && (
          <Badge variant="outline" className="gap-1.5 py-1 px-3 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando...
          </Badge>
        )}
      </div>

      {/* Appointment list */}
      {agendaQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : appointments.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-base font-medium text-foreground mb-1">
            Nenhum agendamento encontrado
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Não há agendamentos para o período selecionado.
          </p>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleOpenCreate}
          >
            <Plus className="h-4 w-4" />
            Criar Agendamento
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([dateLabel, dayAppointments]) => (
            <div key={dateLabel}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {dateLabel}
                <Badge variant="outline" className="ml-1 text-xs">
                  {dayAppointments.length}
                </Badge>
              </h3>
              <div className="space-y-2">
                {dayAppointments.map((apt) => (
                  <AppointmentCard
                    key={apt.id}
                    appointment={apt}
                    professionalName={getProfessionalName(apt.professionalId)}
                    onConfirm={() => confirmAppointment.mutate({ id: apt.id })}
                    onComplete={() => completeAppointment.mutate({ id: apt.id })}
                    onCancel={() => cancelAppointment.mutate({ id: apt.id })}
                    isConfirming={confirmAppointment.isPending}
                    isCompleting={completeAppointment.isPending}
                    isCancelling={cancelAppointment.isPending}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Appointment Card ───

function AppointmentCard({
  appointment,
  professionalName,
  onConfirm,
  onComplete,
  onCancel,
  isConfirming,
  isCompleting,
  isCancelling,
}: {
  appointment: AppointmentItem;
  professionalName: string;
  onConfirm: () => void;
  onComplete: () => void;
  onCancel: () => void;
  isConfirming: boolean;
  isCompleting: boolean;
  isCancelling: boolean;
}) {
  const status = appointment.status || "scheduled";
  const statusInfo = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  const isTerminal = status === "completed" || status === "cancelled" || status === "no_show";

  return (
    <Card className="p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Left: time + info */}
        <div className="flex gap-3 min-w-0 flex-1">
          {/* Time block */}
          <div className="flex flex-col items-center justify-center min-w-[56px] text-center">
            <span className="text-lg font-semibold text-foreground leading-tight">
              {formatTime(appointment.startAt)}
            </span>
            {appointment.endAt && (
              <span className="text-xs text-muted-foreground">
                {formatTime(appointment.endAt)}
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="w-px bg-border self-stretch" />

          {/* Details */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground truncate">
                {appointment.title}
              </span>
              <Badge
                variant="outline"
                className={`text-[11px] px-1.5 py-0 ${statusInfo.className}`}
              >
                {statusInfo.label}
              </Badge>
            </div>

            <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
              {appointment.serviceType && (
                <span className="flex items-center gap-1">
                  <Scissors className="h-3 w-3" />
                  {appointment.serviceType}
                </span>
              )}
              {appointment.contactPhone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {appointment.contactPhone}
                </span>
              )}
              {appointment.price != null && appointment.price > 0 && (
                <span className="flex items-center gap-1 font-medium text-emerald-600">
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(appointment.price)}
                </span>
              )}
              {professionalName && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {professionalName}
                </span>
              )}
              {appointment.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {appointment.location}
                </span>
              )}
            </div>

            {appointment.notes && (
              <p className="text-xs text-muted-foreground/70 truncate">
                {appointment.notes}
              </p>
            )}
          </div>
        </div>

        {/* Right: actions */}
        {!isTerminal && (
          <div className="flex items-center gap-1.5 shrink-0">
            {status === "scheduled" && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={onConfirm}
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                Confirmar
              </Button>
            )}
            {(status === "scheduled" || status === "confirmed" || status === "in_progress") && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={onComplete}
                disabled={isCompleting}
              >
                {isCompleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                Concluir
              </Button>
            )}
            {(status === "scheduled" || status === "confirmed") && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={onCancel}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                Cancelar
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
