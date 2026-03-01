import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ClipboardList, CheckCircle2, Circle, Clock, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DateRangeFilter, { useDateFilter } from "@/components/DateRangeFilter";
import { useTenantId } from "@/hooks/useTenantId";


const priorityStyles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  low: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", label: "Baixa" },
  medium: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Média" },
  high: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Alta" },
  urgent: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Urgente" },
};

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Circle, color: "text-muted-foreground", label: "Pendente" },
  in_progress: { icon: Clock, color: "text-blue-500", label: "Em andamento" },
  done: { icon: CheckCircle2, color: "text-emerald-500", label: "Concluída" },
};

export default function Tasks() {
  const TENANT_ID = useTenantId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueAt, setDueAt] = useState("");
  const utils = trpc.useUtils();
  const dateFilter = useDateFilter("all");

  const tasks = trpc.crm.tasks.list.useQuery({ tenantId: TENANT_ID, dateFrom: dateFilter.dates.dateFrom, dateTo: dateFilter.dates.dateTo });
  const createTask = trpc.crm.tasks.create.useMutation({
    onSuccess: () => { utils.crm.tasks.list.invalidate(); setOpen(false); setTitle(""); setDueAt(""); toast.success("Tarefa criada!"); },
  });
  const updateTask = trpc.crm.tasks.update.useMutation({
    onSuccess: () => { utils.crm.tasks.list.invalidate(); toast.success("Tarefa atualizada!"); },
  });

  const pending = (tasks.data || []).filter((t: any) => t.status !== "done").length;
  const done = (tasks.data || []).filter((t: any) => t.status === "done").length;

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Tarefas</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {pending} pendentes \u2022 {done} concluídas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter
            preset={dateFilter.preset}
            onPresetChange={dateFilter.setPreset}
            customFrom={dateFilter.customFrom}
            onCustomFromChange={dateFilter.setCustomFrom}
            customTo={dateFilter.customTo}
            onCustomToChange={dateFilter.setCustomTo}
            onReset={dateFilter.reset}
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="h-9 gap-2 px-5 rounded-lg bg-primary hover:bg-primary/90 shadow-sm text-[13px] font-medium transition-colors">
                <Plus className="h-4 w-4" />Nova Tarefa
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[440px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-lg">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><ClipboardList className="h-4 w-4 text-primary" /></div>
                Nova Tarefa
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-3">
              <div><Label className="text-[12px] font-medium">Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Ligar para confirmar reserva" className="mt-1.5 h-10 rounded-xl" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-[12px] font-medium">Prioridade</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="mt-1.5 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-[12px] font-medium">Vencimento</Label>
                  <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
                </div>
              </div>
              <Button className="w-full h-11 rounded-lg text-[14px] font-medium bg-primary hover:bg-primary/90 shadow-sm transition-colors" disabled={!title || createTask.isPending} onClick={() => createTask.mutate({ tenantId: TENANT_ID, entityType: "general", entityId: 0, title, priority: priority as any, dueAt: dueAt || undefined })}>
                {createTask.isPending ? "Criando..." : "Criar Tarefa"}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="text-left p-3.5 font-semibold text-muted-foreground w-12">Status</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Título</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Prioridade</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {tasks.isLoading ? (
                <tr><td colSpan={4} className="p-12 text-center text-muted-foreground text-sm">Carregando...</td></tr>
              ) : !tasks.data?.length ? (
                <tr><td colSpan={4} className="p-12 text-center text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm">Nenhuma tarefa encontrada.</p>
                </td></tr>
              ) : tasks.data.map((t: any) => {
                const sc = statusConfig[t.status] || statusConfig["pending"];
                const StatusIcon = sc.icon;
                const ps = priorityStyles[t.priority] || priorityStyles["medium"];
                const isOverdue = t.dueAt && t.status !== "done" && new Date(t.dueAt) < new Date();
                return (
                  <tr key={t.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="p-3.5">
                      <button
                        className="p-1 rounded-lg hover:bg-muted/40 transition-colors"
                        onClick={() => updateTask.mutate({ tenantId: TENANT_ID, id: t.id, status: t.status === "done" ? "pending" : "done" })}
                      >
                        <StatusIcon className={`h-5 w-5 ${sc.color} transition-colors`} />
                      </button>
                    </td>
                    <td className={`p-3.5 font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${ps.bg} ${ps.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ps.dot}`} />
                        {ps.label}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {t.dueAt ? (
                        <span className={`flex items-center gap-1.5 text-[12px] ${isOverdue ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                          {isOverdue && <AlertTriangle className="h-3.5 w-3.5" />}
                          {new Date(t.dueAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
