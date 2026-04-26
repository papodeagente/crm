/**
 * SidebarTasks — Task list with full TaskFormDialog for creation/editing
 */
import { useState } from "react";
import { Plus, Check, MessageCircle, Phone, Mail, ClipboardList, Pencil } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import TaskFormDialog from "@/components/TaskFormDialog";
import TaskActionPopover from "@/components/TaskActionPopover";

const taskTypeIcons: Record<string, any> = {
  whatsapp: MessageCircle,
  phone: Phone,
  email: Mail,
  task: ClipboardList,
};
const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgente", color: "text-red-500" },
  high: { label: "Alta", color: "text-orange-500" },
  medium: { label: "Média", color: "text-blue-500" },
  low: { label: "Baixa", color: "text-muted-foreground" },
};

function formatRelativeDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d atrás`;
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  return `${days}d`;
}

export default function SidebarTasks({ contactId }: { contactId: number }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);

  const tasksQ = trpc.crm.tasks.list.useQuery(
    { entityType: "contact", entityId: contactId, status: "pending" },
    { enabled: !!contactId, staleTime: 30_000 }
  );
  const tasks = (tasksQ.data?.tasks || tasksQ.data || []) as Array<{
    id: number; title: string; taskType: string; dueAt: string | null; status: string; priority: string;
    description?: string;
  }>;

  const utils = trpc.useUtils();
  const updateMut = trpc.crm.tasks.update.useMutation({
    onSuccess: () => {
      utils.crm.tasks.list.invalidate();
      toast.success("Tarefa atualizada");
    },
    onError: (err: any) => toast.error(err.message || "Erro"),
  });

  return (
    <div className="px-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="sidebar-section-trigger !p-0">Tarefas ({tasks.length})</span>
        <button
          onClick={() => setShowCreate(true)}
          className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <p className="text-[12px] text-muted-foreground text-center py-3">Nenhuma tarefa pendente</p>
      ) : (
        <div className="space-y-0.5">
          {tasks.map((task) => {
            const Icon = taskTypeIcons[task.taskType] || ClipboardList;
            const pCfg = priorityConfig[task.priority] || priorityConfig.medium;

            return (
              <div key={task.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent/30 transition-colors group">
                <button
                  onClick={() => updateMut.mutate({ id: task.id, status: "done" })}
                  className="w-5 h-5 rounded-full border border-border flex items-center justify-center shrink-0 hover:border-primary hover:bg-primary/10 transition-colors"
                >
                  <Check className="w-3 h-3 text-transparent group-hover:text-primary transition-colors" />
                </button>
                <Icon className={`w-3.5 h-3.5 shrink-0 ${pCfg.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] text-foreground truncate">{task.title}</p>
                </div>
                {task.dueAt && (
                  <span className={`text-[10px] font-medium shrink-0 ${
                    new Date(task.dueAt) < new Date() ? "text-red-500" : "text-muted-foreground"
                  }`}>
                    {formatRelativeDate(task.dueAt)}
                  </span>
                )}
                <button
                  onClick={() => setEditTask(task)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-opacity"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <TaskFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        contactId={contactId}
        onSuccess={() => tasksQ.refetch()}
      />

      {/* Edit Dialog */}
      {editTask && (
        <TaskFormDialog
          open={!!editTask}
          onOpenChange={(open) => { if (!open) setEditTask(null); }}
          contactId={contactId}
          editTask={editTask}
          onSuccess={() => tasksQ.refetch()}
        />
      )}
    </div>
  );
}
