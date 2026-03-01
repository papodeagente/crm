import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, CheckCircle2, Circle, Clock, AlertTriangle,
  Phone, Mail, MessageSquare, Video, ClipboardList,
  List, Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  ChevronDown, Filter, Users, X, Info,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useTenantId } from "@/hooks/useTenantId";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Types & Config ───
const TASK_TYPES = [
  { value: "all", label: "Todos os tipos", icon: ClipboardList },
  { value: "call", label: "Chamada", icon: Phone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "meeting", label: "Reunião", icon: Video },
  { value: "task", label: "Tarefa", icon: ClipboardList },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "open", label: "Em aberto" },
  { value: "done", label: "Concluída" },
  { value: "overdue", label: "Atrasada" },
];

const statusBadge: Record<string, { label: string; className: string }> = {
  done: { label: "COMPLETA", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  pending: { label: "PENDENTE", className: "bg-blue-100 text-blue-700 border-blue-200" },
  in_progress: { label: "EM ANDAMENTO", className: "bg-amber-100 text-amber-700 border-amber-200" },
  cancelled: { label: "CANCELADA", className: "bg-gray-100 text-gray-500 border-gray-200" },
  overdue: { label: "ATRASADA", className: "bg-red-100 text-red-700 border-red-200" },
};

function getTaskTypeIcon(type: string | null | undefined) {
  switch (type) {
    case "call": return Phone;
    case "whatsapp": return MessageSquare;
    case "email": return Mail;
    case "meeting": return Video;
    default: return ClipboardList;
  }
}

function getTaskTypeColor(type: string | null | undefined) {
  switch (type) {
    case "call": return "text-green-600";
    case "whatsapp": return "text-emerald-600";
    case "email": return "text-blue-600";
    case "meeting": return "text-purple-600";
    default: return "text-slate-500";
  }
}

function getEffectiveStatus(task: any): string {
  if (task.status === "done") return "done";
  if (task.status === "cancelled") return "cancelled";
  if (task.dueAt && new Date(task.dueAt) < new Date()) return "overdue";
  return task.status || "pending";
}

function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(amount: number | null | undefined) {
  if (!amount && amount !== 0) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

type ViewMode = "list" | "calendar";
type CalendarView = "day" | "week" | "month";

// ─── Main Component ───
export default function Tasks() {
  const TENANT_ID = useTenantId();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  // Filters
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<"dueAt" | "title">("dueAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Pagination
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("task");
  const [newDueAt, setNewDueAt] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDescription, setNewDescription] = useState("");

  // Summary expanded
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Data
  const crmUsers = trpc.admin.users.list.useQuery({ tenantId: TENANT_ID });

  const tasksQuery = trpc.crm.tasks.list.useQuery({
    tenantId: TENANT_ID,
    status: statusFilter !== "all" ? statusFilter : undefined,
    taskType: typeFilter !== "all" ? typeFilter : undefined,
    assigneeUserId: assigneeFilter !== "all" ? Number(assigneeFilter) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  // Summary query (all tasks for this week, no filters)
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const summaryQuery = trpc.crm.tasks.list.useQuery({
    tenantId: TENANT_ID,
    dateFrom: weekStart.toISOString().split("T")[0],
    dateTo: weekEnd.toISOString().split("T")[0],
    limit: 500,
  });

  const createTask = trpc.crm.tasks.create.useMutation({
    onSuccess: () => {
      utils.crm.tasks.list.invalidate();
      setCreateOpen(false);
      setNewTitle("");
      setNewDueAt("");
      setNewDescription("");
      toast.success("Tarefa criada com sucesso!");
    },
    onError: () => toast.error("Erro ao criar tarefa"),
  });

  const updateTask = trpc.crm.tasks.update.useMutation({
    onSuccess: () => {
      utils.crm.tasks.list.invalidate();
      toast.success("Tarefa atualizada!");
    },
  });

  // Computed
  const taskList = tasksQuery.data?.tasks || [];
  const totalTasks = tasksQuery.data?.total || 0;
  const totalPages = Math.ceil(totalTasks / PAGE_SIZE);

  const summaryTasks = summaryQuery.data?.tasks || [];
  const summaryDone = summaryTasks.filter((t: any) => t.status === "done").length;
  const summaryOverdue = summaryTasks.filter((t: any) => getEffectiveStatus(t) === "overdue").length;
  const summaryPending = summaryTasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled").length;

  // Sort tasks locally
  const sortedTasks = useMemo(() => {
    const sorted = [...taskList].sort((a: any, b: any) => {
      if (sortField === "dueAt") {
        const aDate = a.dueAt ? new Date(a.dueAt).getTime() : 0;
        const bDate = b.dueAt ? new Date(b.dueAt).getTime() : 0;
        return sortDir === "asc" ? aDate - bDate : bDate - aDate;
      }
      return sortDir === "asc"
        ? (a.title || "").localeCompare(b.title || "")
        : (b.title || "").localeCompare(a.title || "");
    });
    return sorted;
  }, [taskList, sortField, sortDir]);

  // Active filter count
  const activeFilters = [
    assigneeFilter !== "all",
    typeFilter !== "all",
    statusFilter !== "all",
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;

  const clearFilters = useCallback(() => {
    setAssigneeFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }, []);

  // Calendar navigation
  const navigateCalendar = (dir: number) => {
    const d = new Date(calendarDate);
    if (calendarView === "day") d.setDate(d.getDate() + dir);
    else if (calendarView === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCalendarDate(d);
  };

  const calendarTitle = useMemo(() => {
    const d = calendarDate;
    if (calendarView === "day") {
      return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    } else if (calendarView === "week") {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} — ${end.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [calendarDate, calendarView]);

  // Calendar tasks query (broader date range for calendar)
  const calendarRange = useMemo(() => {
    const d = new Date(calendarDate);
    if (calendarView === "day") {
      return { from: d.toISOString().split("T")[0], to: d.toISOString().split("T")[0] };
    } else if (calendarView === "week") {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: start.toISOString().split("T")[0], to: end.toISOString().split("T")[0] };
    }
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { from: start.toISOString().split("T")[0], to: end.toISOString().split("T")[0] };
  }, [calendarDate, calendarView]);

  const calendarTasksQuery = trpc.crm.tasks.list.useQuery({
    tenantId: TENANT_ID,
    dateFrom: calendarRange.from,
    dateTo: calendarRange.to,
    taskType: typeFilter !== "all" ? typeFilter : undefined,
    assigneeUserId: assigneeFilter !== "all" ? Number(assigneeFilter) : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    limit: 500,
  }, { enabled: viewMode === "calendar" });

  return (
    <div className="p-5 lg:px-8 space-y-4">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Tarefas</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-muted/40 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-all duration-200 ${viewMode === "list" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`p-2 rounded-lg transition-all duration-200 ${viewMode === "calendar" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Create button */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-9 gap-2 px-5 rounded-lg bg-primary hover:bg-primary/90 shadow-sm text-[13px] font-medium">
                <Plus className="h-4 w-4" />Criar tarefa
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5 text-lg">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ClipboardList className="h-4 w-4 text-primary" />
                  </div>
                  Criar tarefa
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-3">
                <div>
                  <Label className="text-[12px] font-medium">Título *</Label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Ligar para confirmar reserva" className="mt-1.5 h-10 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[12px] font-medium">Tipo</Label>
                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger className="mt-1.5 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="task">Tarefa</SelectItem>
                        <SelectItem value="call">Chamada</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="meeting">Reunião</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[12px] font-medium">Prioridade</Label>
                    <Select value={newPriority} onValueChange={setNewPriority}>
                      <SelectTrigger className="mt-1.5 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-[12px] font-medium">Data e hora</Label>
                  <Input type="datetime-local" value={newDueAt} onChange={(e) => setNewDueAt(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
                </div>
                <div>
                  <Label className="text-[12px] font-medium">Descrição</Label>
                  <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Detalhes da tarefa..." className="mt-1.5 rounded-xl min-h-[80px]" />
                </div>
                <Button
                  className="w-full h-11 rounded-lg text-[14px] font-medium bg-primary hover:bg-primary/90 shadow-sm"
                  disabled={!newTitle || createTask.isPending}
                  onClick={() => createTask.mutate({
                    tenantId: TENANT_ID, entityType: "general", entityId: 0,
                    title: newTitle, taskType: newType,
                    priority: newPriority as any,
                    dueAt: newDueAt || undefined,
                    description: newDescription || undefined,
                  })}
                >
                  {createTask.isPending ? "Criando..." : "Criar Tarefa"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ─── Filters Bar ─── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Responsável */}
        <Select value={assigneeFilter} onValueChange={(v) => { setAssigneeFilter(v); setPage(0); }}>
          <SelectTrigger className="h-9 w-[200px] rounded-xl border-border/50 bg-card text-[13px]">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="Todas as tarefas" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Todas as tarefas</SelectItem>
            {(crmUsers.data || []).map((u: any) => (
              <SelectItem key={u.id} value={String(u.id)}>{u.name || u.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Período */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 rounded-xl border-border/50 bg-card text-[13px] gap-2 font-normal">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              {dateFrom || dateTo ? `${dateFrom || "..."} — ${dateTo || "..."}` : "Período"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] rounded-xl p-4 space-y-3" align="start">
            <div>
              <Label className="text-[11px] font-medium text-muted-foreground">De</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="mt-1 h-9 rounded-lg text-[13px]" />
            </div>
            <div>
              <Label className="text-[11px] font-medium text-muted-foreground">Até</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="mt-1 h-9 rounded-lg text-[13px]" />
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="w-full text-[12px]" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                Limpar período
              </Button>
            )}
          </PopoverContent>
        </Popover>

        {/* Tipo */}
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="h-9 w-[200px] rounded-xl border-border/50 bg-card text-[13px]">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="Todos os tipos" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {TASK_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                <div className="flex items-center gap-2">
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="h-9 w-[180px] rounded-xl border-border/50 bg-card text-[13px]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="Todos os status" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filter count / clear */}
        {activeFilters > 0 && (
          <Button variant="outline" size="sm" className="h-9 rounded-xl gap-1.5 text-[13px] border-primary/30 text-primary" onClick={clearFilters}>
            <Filter className="h-3.5 w-3.5" />
            Filtros ({activeFilters})
            <X className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>

      {/* ─── Summary Card ─── */}
      <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-3.5 text-[13px] font-medium text-foreground hover:bg-muted/20 transition-colors"
          onClick={() => setSummaryOpen(!summaryOpen)}
        >
          <span>Resumo das tarefas da semana</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${summaryOpen ? "rotate-180" : ""}`} />
        </button>
        {summaryOpen && (
          <div className="px-3.5 pb-3.5 grid grid-cols-3 gap-3">
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{summaryPending}</p>
              <p className="text-[11px] text-blue-600/70 font-medium mt-0.5">Em aberto</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{summaryOverdue}</p>
              <p className="text-[11px] text-red-600/70 font-medium mt-0.5">Atrasadas</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{summaryDone}</p>
              <p className="text-[11px] text-emerald-600/70 font-medium mt-0.5">Concluídas</p>
            </div>
          </div>
        )}
      </Card>

      {/* ─── Content ─── */}
      {viewMode === "list" ? (
        <TaskListView
          tasks={sortedTasks}
          total={totalTasks}
          isLoading={tasksQuery.isLoading}
          sortField={sortField}
          sortDir={sortDir}
          onSort={(field) => {
            if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
            else { setSortField(field); setSortDir("asc"); }
          }}
          onToggleStatus={(task: any) => {
            updateTask.mutate({
              tenantId: TENANT_ID,
              id: task.id,
              status: task.status === "done" ? "pending" : "done",
            });
          }}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : (
        <TaskCalendarView
          tasks={calendarTasksQuery.data?.tasks || []}
          isLoading={calendarTasksQuery.isLoading}
          calendarView={calendarView}
          calendarDate={calendarDate}
          calendarTitle={calendarTitle}
          onViewChange={setCalendarView}
          onNavigate={navigateCalendar}
          onToday={() => setCalendarDate(new Date())}
          onToggleStatus={(task: any) => {
            updateTask.mutate({
              tenantId: TENANT_ID,
              id: task.id,
              status: task.status === "done" ? "pending" : "done",
            });
          }}
        />
      )}
    </div>
  );
}

// ─── List View ───
function TaskListView({
  tasks, total, isLoading, sortField, sortDir, onSort, onToggleStatus,
  page, totalPages, onPageChange,
}: {
  tasks: any[]; total: number; isLoading: boolean;
  sortField: string; sortDir: string;
  onSort: (field: "dueAt" | "title") => void;
  onToggleStatus: (task: any) => void;
  page: number; totalPages: number; onPageChange: (p: number) => void;
}) {
  return (
    <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border/30 bg-muted/20">
              <th className="text-left p-3 font-semibold text-muted-foreground w-10"></th>
              <th className="text-left p-3 font-semibold text-muted-foreground min-w-[280px]">
                <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => onSort("title")}>
                  TAREFAS
                  {sortField === "title" && <ChevronDown className={`h-3 w-3 ${sortDir === "desc" ? "rotate-180" : ""}`} />}
                </button>
              </th>
              <th className="text-left p-3 font-semibold text-muted-foreground w-[110px]">STATUS</th>
              <th className="text-left p-3 font-semibold text-muted-foreground w-[170px]">
                <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => onSort("dueAt")}>
                  DATA E HORA
                  {sortField === "dueAt" && <ChevronDown className={`h-3 w-3 ${sortDir === "desc" ? "rotate-180" : ""}`} />}
                </button>
              </th>
              <th className="text-left p-3 font-semibold text-muted-foreground w-[140px]">RESPONSÁVEIS</th>
              <th className="text-left p-3 font-semibold text-muted-foreground min-w-[180px]">NEGOCIAÇÃO</th>
              <th className="text-right p-3 font-semibold text-muted-foreground w-[130px]">VALOR TOTAL</th>
              <th className="w-10 p-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="p-12 text-center text-muted-foreground text-sm">Carregando tarefas...</td></tr>
            ) : !tasks.length ? (
              <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm">Nenhuma tarefa encontrada.</p>
              </td></tr>
            ) : tasks.map((t: any) => {
              const effectiveStatus = getEffectiveStatus(t);
              const badge = statusBadge[effectiveStatus] || statusBadge.pending;
              const TypeIcon = getTaskTypeIcon(t.taskType);
              const typeColor = getTaskTypeColor(t.taskType);
              return (
                <tr key={t.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors group">
                  {/* Checkbox */}
                  <td className="p-3">
                    <button
                      className="p-0.5 rounded-md hover:bg-muted/40 transition-colors"
                      onClick={() => onToggleStatus(t)}
                    >
                      {t.status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : effectiveStatus === "overdue" ? (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground" />
                      )}
                    </button>
                  </td>
                  {/* Title + type icon */}
                  <td className="p-3">
                    <div className="flex items-start gap-2">
                      <TypeIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${typeColor}`} />
                      <span className={`font-medium leading-snug ${t.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {t.title}
                      </span>
                    </div>
                  </td>
                  {/* Status badge */}
                  <td className="p-3">
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                  {/* Date */}
                  <td className="p-3 text-[12px] text-muted-foreground whitespace-nowrap">
                    {formatDateTime(t.dueAt)}
                  </td>
                  {/* Assignees */}
                  <td className="p-3">
                    <div className="flex items-center -space-x-1.5">
                      {(t.assignees || []).slice(0, 3).map((a: any, i: number) => (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            {a.avatarUrl ? (
                              <img src={a.avatarUrl} alt={a.name} className="h-7 w-7 rounded-full border-2 border-card object-cover" />
                            ) : (
                              <div className="h-7 w-7 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                {(a.name || "?").substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </TooltipTrigger>
                          <TooltipContent side="bottom"><p className="text-xs">{a.name}</p></TooltipContent>
                        </Tooltip>
                      ))}
                      {(t.assignees || []).length > 3 && (
                        <div className="h-7 w-7 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          +{t.assignees.length - 3}
                        </div>
                      )}
                      {(!t.assignees || t.assignees.length === 0) && (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  {/* Deal */}
                  <td className="p-3">
                    {t.deal ? (
                      <div>
                        <p className="text-[12px] font-medium text-primary truncate max-w-[200px]">{t.deal.title}</p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                  {/* Amount */}
                  <td className="p-3 text-right text-[13px] font-medium text-foreground whitespace-nowrap">
                    {t.deal?.amount ? formatCurrency(t.deal.amount) : "—"}
                  </td>
                  {/* Info */}
                  <td className="p-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-1 rounded-lg hover:bg-muted/40 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[250px]">
                        <div className="text-xs space-y-1">
                          <p><strong>Tipo:</strong> {t.taskType || "tarefa"}</p>
                          <p><strong>Prioridade:</strong> {t.priority || "média"}</p>
                          {t.description && <p><strong>Descrição:</strong> {t.description}</p>}
                          <p><strong>Criada em:</strong> {formatDateTime(t.createdAt)}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-3 border-t border-border/20">
          <p className="text-[12px] text-muted-foreground">
            Mostrando {page * 50 + 1}–{Math.min((page + 1) * 50, total)} de {total} tarefas
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)} className="h-8 w-8 p-0 rounded-lg">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[12px] text-muted-foreground px-2">{page + 1} / {totalPages}</span>
            <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} className="h-8 w-8 p-0 rounded-lg">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Calendar View ───
function TaskCalendarView({
  tasks, isLoading, calendarView, calendarDate, calendarTitle,
  onViewChange, onNavigate, onToday, onToggleStatus,
}: {
  tasks: any[]; isLoading: boolean;
  calendarView: CalendarView; calendarDate: Date; calendarTitle: string;
  onViewChange: (v: CalendarView) => void;
  onNavigate: (dir: number) => void;
  onToday: () => void;
  onToggleStatus: (task: any) => void;
}) {
  return (
    <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
      {/* Calendar header */}
      <div className="flex items-center justify-between p-3.5 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 rounded-lg text-[12px]" onClick={onToday}>
            Hoje
          </Button>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => onNavigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => onNavigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-[14px] font-semibold capitalize">{calendarTitle}</h2>
        </div>
        <div className="flex items-center bg-muted/40 rounded-lg p-0.5 gap-0.5">
          {(["day", "week", "month"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${calendarView === v ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground text-sm">Carregando calendário...</div>
      ) : calendarView === "month" ? (
        <MonthView tasks={tasks} date={calendarDate} onToggleStatus={onToggleStatus} />
      ) : calendarView === "week" ? (
        <WeekView tasks={tasks} date={calendarDate} onToggleStatus={onToggleStatus} />
      ) : (
        <DayView tasks={tasks} date={calendarDate} onToggleStatus={onToggleStatus} />
      )}
    </Card>
  );
}

// ─── Month View ───
function MonthView({ tasks, date, onToggleStatus }: { tasks: any[]; date: Date; onToggleStatus: (t: any) => void }) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = new Date();

  // Group tasks by day
  const tasksByDay: Record<string, any[]> = {};
  tasks.forEach((t: any) => {
    if (!t.dueAt) return;
    const d = new Date(t.dueAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!tasksByDay[key]) tasksByDay[key] = [];
    tasksByDay[key].push(t);
  });

  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  while (days.length % 7 !== 0) days.push(null);

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="p-2">
      <div className="grid grid-cols-7 gap-0">
        {weekDays.map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-2">{d}</div>
        ))}
        {days.map((day, i) => {
          if (day === null) return <div key={i} className="min-h-[100px] border border-border/10 bg-muted/5" />;
          const key = `${year}-${month}-${day}`;
          const dayTasks = tasksByDay[key] || [];
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          return (
            <div key={i} className={`min-h-[100px] border border-border/10 p-1 ${isToday ? "bg-primary/5" : ""}`}>
              <div className={`text-[11px] font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {day}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((t: any) => {
                  const TypeIcon = getTaskTypeIcon(t.taskType);
                  const effectiveStatus = getEffectiveStatus(t);
                  const bgColor = effectiveStatus === "done" ? "bg-emerald-100 dark:bg-emerald-900/30" : effectiveStatus === "overdue" ? "bg-red-100 dark:bg-red-900/30" : "bg-blue-100 dark:bg-blue-900/30";
                  return (
                    <button
                      key={t.id}
                      className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] truncate flex items-center gap-1 ${bgColor} hover:opacity-80 transition-opacity`}
                      onClick={() => onToggleStatus(t)}
                    >
                      <TypeIcon className="h-2.5 w-2.5 flex-shrink-0" />
                      <span className="truncate">{t.title}</span>
                    </button>
                  );
                })}
                {dayTasks.length > 3 && (
                  <p className="text-[9px] text-muted-foreground text-center">+{dayTasks.length - 3} mais</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ───
function WeekView({ tasks, date, onToggleStatus }: { tasks: any[]; date: Date; onToggleStatus: (t: any) => void }) {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  const today = new Date();
  const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6:00 - 21:00

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  // Group tasks by day and hour
  const tasksByDayHour: Record<string, any[]> = {};
  tasks.forEach((t: any) => {
    if (!t.dueAt) return;
    const d = new Date(t.dueAt);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const hour = d.getHours();
    const key = `${dayKey}-${hour}`;
    if (!tasksByDayHour[key]) tasksByDayHour[key] = [];
    tasksByDayHour[key].push(t);
  });

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="overflow-auto max-h-[600px]">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] min-w-[800px]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border/20" />
        {weekDays.map((d, i) => {
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div key={i} className={`sticky top-0 z-10 bg-card border-b border-border/20 text-center py-2 ${isToday ? "bg-primary/5" : ""}`}>
              <p className="text-[10px] text-muted-foreground font-medium">{dayNames[i]}</p>
              <p className={`text-[14px] font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{d.getDate()}</p>
            </div>
          );
        })}
        {/* Time slots */}
        {hours.map((hour) => (
          <>
            <div key={`h-${hour}`} className="text-[10px] text-muted-foreground text-right pr-2 pt-1 border-r border-border/10 h-[60px]">
              {String(hour).padStart(2, "0")}:00
            </div>
            {weekDays.map((d, dayIdx) => {
              const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
              const key = `${dayKey}-${hour}`;
              const slotTasks = tasksByDayHour[key] || [];
              const isToday = d.toDateString() === today.toDateString();
              return (
                <div key={`${hour}-${dayIdx}`} className={`border-b border-r border-border/10 h-[60px] p-0.5 ${isToday ? "bg-primary/[0.02]" : ""}`}>
                  {slotTasks.map((t: any) => {
                    const TypeIcon = getTaskTypeIcon(t.taskType);
                    const effectiveStatus = getEffectiveStatus(t);
                    const bgColor = effectiveStatus === "done" ? "bg-emerald-200/70 dark:bg-emerald-800/40 border-emerald-300" : effectiveStatus === "overdue" ? "bg-red-200/70 dark:bg-red-800/40 border-red-300" : "bg-blue-200/70 dark:bg-blue-800/40 border-blue-300";
                    return (
                      <button
                        key={t.id}
                        className={`w-full text-left px-1 py-0.5 rounded text-[10px] truncate flex items-center gap-1 border ${bgColor} hover:opacity-80 transition-opacity mb-0.5`}
                        onClick={() => onToggleStatus(t)}
                        title={t.title}
                      >
                        <TypeIcon className="h-2.5 w-2.5 flex-shrink-0" />
                        <span className="truncate">{t.title}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

// ─── Day View ───
function DayView({ tasks, date, onToggleStatus }: { tasks: any[]; date: Date; onToggleStatus: (t: any) => void }) {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const hours = Array.from({ length: 18 }, (_, i) => i + 5); // 5:00 - 22:00

  // Group tasks by hour
  const tasksByHour: Record<number, any[]> = {};
  tasks.forEach((t: any) => {
    if (!t.dueAt) return;
    const d = new Date(t.dueAt);
    if (d.toDateString() !== date.toDateString()) return;
    const hour = d.getHours();
    if (!tasksByHour[hour]) tasksByHour[hour] = [];
    tasksByHour[hour].push(t);
  });

  return (
    <div className="overflow-auto max-h-[600px]">
      <div className="min-w-[400px]">
        {hours.map((hour) => {
          const slotTasks = tasksByHour[hour] || [];
          const isCurrentHour = isToday && today.getHours() === hour;
          return (
            <div key={hour} className={`flex border-b border-border/10 ${isCurrentHour ? "bg-primary/5" : ""}`}>
              <div className="w-[70px] text-[11px] text-muted-foreground text-right pr-3 pt-2 flex-shrink-0 border-r border-border/10">
                {String(hour).padStart(2, "0")}:00
              </div>
              <div className="flex-1 min-h-[60px] p-1 space-y-1">
                {slotTasks.map((t: any) => {
                  const TypeIcon = getTaskTypeIcon(t.taskType);
                  const effectiveStatus = getEffectiveStatus(t);
                  const bgColor = effectiveStatus === "done" ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200" : effectiveStatus === "overdue" ? "bg-red-50 dark:bg-red-900/20 border-red-200" : "bg-blue-50 dark:bg-blue-900/20 border-blue-200";
                  const badge = statusBadge[effectiveStatus] || statusBadge.pending;
                  return (
                    <div key={t.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${bgColor} hover:shadow-sm transition-shadow`}>
                      <button onClick={() => onToggleStatus(t)} className="flex-shrink-0">
                        {t.status === "done" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-muted-foreground/40" />}
                      </button>
                      <TypeIcon className={`h-4 w-4 flex-shrink-0 ${getTaskTypeColor(t.taskType)}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-medium truncate ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                        {t.deal && <p className="text-[11px] text-primary truncate">{t.deal.title}</p>}
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${badge.className}`}>
                        {badge.label}
                      </span>
                      <div className="flex items-center -space-x-1 flex-shrink-0">
                        {(t.assignees || []).slice(0, 2).map((a: any, i: number) => (
                          a.avatarUrl ? (
                            <img key={i} src={a.avatarUrl} alt={a.name} className="h-6 w-6 rounded-full border-2 border-card object-cover" />
                          ) : (
                            <div key={i} className="h-6 w-6 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                              {(a.name || "?").substring(0, 2).toUpperCase()}
                            </div>
                          )
                        ))}
                      </div>
                      <span className="text-[11px] text-muted-foreground flex-shrink-0">
                        {new Date(t.dueAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
