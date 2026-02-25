import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ClipboardList, CheckCircle2, Circle, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TENANT_ID = 1;
const priorityColors: Record<string, string> = { low: "bg-gray-100 text-gray-700", medium: "bg-blue-100 text-blue-700", high: "bg-amber-100 text-amber-700", urgent: "bg-red-100 text-red-700" };
const statusIcons: Record<string, any> = { pending: Circle, in_progress: Clock, done: CheckCircle2 };

export default function Tasks() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const utils = trpc.useUtils();

  const tasks = trpc.crm.tasks.list.useQuery({ tenantId: TENANT_ID });
  const createTask = trpc.crm.tasks.create.useMutation({
    onSuccess: () => { utils.crm.tasks.list.invalidate(); setOpen(false); setTitle(""); toast.success("Tarefa criada!"); },
  });
  const updateTask = trpc.crm.tasks.update.useMutation({
    onSuccess: () => { utils.crm.tasks.list.invalidate(); toast.success("Tarefa atualizada!"); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Tarefas</h1><p className="text-muted-foreground">Acompanhe atividades e follow-ups.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Tarefa</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Ligar para cliente" /></div>
              <div><Label>Prioridade</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="low">Baixa</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="high">Alta</SelectItem><SelectItem value="urgent">Urgente</SelectItem></SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={!title} onClick={() => createTask.mutate({ tenantId: TENANT_ID, entityType: "general", entityId: 0, title, priority: priority as any })}>Criar Tarefa</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/30"><th className="text-left p-3 font-medium">Status</th><th className="text-left p-3 font-medium">Título</th><th className="text-left p-3 font-medium">Prioridade</th><th className="text-left p-3 font-medium">Vencimento</th></tr></thead>
        <tbody>
          {tasks.isLoading ? <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
          : !tasks.data?.length ? <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />Nenhuma tarefa encontrada.</td></tr>
          : tasks.data.map((t: any) => {
            const StatusIcon = statusIcons[t.status] || Circle;
            return (
              <tr key={t.id} className="border-b hover:bg-muted/20">
                <td className="p-3"><button onClick={() => updateTask.mutate({ tenantId: TENANT_ID, id: t.id, status: t.status === "done" ? "pending" : "done" })}><StatusIcon className={`h-5 w-5 ${t.status === "done" ? "text-emerald-500" : "text-muted-foreground"}`} /></button></td>
                <td className={`p-3 font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</td>
                <td className="p-3"><Badge variant="secondary" className={priorityColors[t.priority] || ""}>{t.priority}</Badge></td>
                <td className="p-3 text-muted-foreground">{t.dueAt ? new Date(t.dueAt).toLocaleDateString("pt-BR") : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div></CardContent></Card>
    </div>
  );
}
