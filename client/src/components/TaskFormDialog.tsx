import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  X, Phone, Mail, Video, MessageSquare, CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import { useTenantId } from "@/hooks/useTenantId";

export const taskTypeOptions = [
  { value: "task", label: "Tarefa", icon: CheckSquare },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "phone", label: "Telefone", icon: Phone },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "video_call", label: "Videoconferência", icon: Video },
];

export function getTaskTypeIcon(type: string) {
  return taskTypeOptions.find(t => t.value === type)?.icon || CheckSquare;
}

export function getTaskTypeLabel(type: string) {
  return taskTypeOptions.find(t => t.value === type)?.label || "Tarefa";
}

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill deal context (when creating from a deal page) */
  dealId?: number;
  dealTitle?: string;
  /** Pre-fill for editing an existing task */
  editTask?: {
    id: number;
    title: string;
    description?: string | null;
    taskType?: string | null;
    dueAt?: string | Date | null;
    entityType: string;
    entityId: number;
    status?: string;
    priority?: string | null;
    assignedToUserId?: number | null;
  };
  /** Existing assignee user IDs for edit mode */
  editAssigneeIds?: number[];
  /** Callback after successful create/update */
  onSuccess?: () => void;
  /** Whether to show deal/account selectors (for general task creation) */
  showDealSelector?: boolean;
}

export default function TaskFormDialog({
  open,
  onOpenChange,
  dealId,
  dealTitle,
  editTask,
  editAssigneeIds,
  onSuccess,
  showDealSelector = false,
}: TaskFormDialogProps) {
  const TENANT_ID = useTenantId();
  const utils = trpc.useUtils();
  const isEditMode = !!editTask;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("task");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [assigneeUserIds, setAssigneeUserIds] = useState<number[]>([]);
  const [markAsDone, setMarkAsDone] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("none");

  // Data queries
  const crmUsers = trpc.admin.users.list.useQuery({ tenantId: TENANT_ID });
  const deals = trpc.crm.deals.list.useQuery(
    { tenantId: TENANT_ID, limit: 200 },
    { enabled: showDealSelector }
  );
  const allAccounts = trpc.crm.accounts.list.useQuery(
    { tenantId: TENANT_ID },
    { enabled: showDealSelector }
  );

  // Mutations
  const createTask = trpc.crm.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Tarefa criada com sucesso!");
      utils.crm.tasks.list.invalidate();
      utils.crm.tasks.overdueSummary.invalidate();
      utils.crm.tasks.pendingCounts.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => toast.error(`Erro ao criar tarefa: ${err.message}`),
  });

  const updateTask = trpc.crm.tasks.update.useMutation({
    onSuccess: () => {
      toast.success("Tarefa atualizada com sucesso!");
      utils.crm.tasks.list.invalidate();
      utils.crm.tasks.overdueSummary.invalidate();
      utils.crm.tasks.pendingCounts.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => toast.error(`Erro ao atualizar tarefa: ${err.message}`),
  });

  const addAssignee = trpc.crm.tasks.addAssignee.useMutation();
  const removeAssignee = trpc.crm.tasks.removeAssignee.useMutation();

  // Initialize form when opening
  useEffect(() => {
    if (!open) return;
    if (editTask) {
      setTitle(editTask.title || "");
      setDescription(editTask.description || "");
      setTaskType(editTask.taskType || "task");
      if (editTask.dueAt) {
        const d = new Date(editTask.dueAt);
        setDueDate(d.toISOString().split("T")[0]);
        setDueTime(
          String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0")
        );
      } else {
        setDueDate("");
        setDueTime("");
      }
      setAssigneeUserIds(editAssigneeIds || (editTask.assignedToUserId ? [editTask.assignedToUserId] : []));
      setMarkAsDone(editTask.status === "done");
      setSelectedDealId(editTask.entityType === "deal" ? editTask.entityId : null);
    } else {
      setTitle("");
      setDescription("");
      setTaskType("task");
      const now = new Date();
      setDueDate(now.toISOString().split("T")[0]);
      setDueTime(
        String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0")
      );
      setAssigneeUserIds([]);
      setMarkAsDone(false);
      setSelectedDealId(dealId || null);
      setSelectedAccountId("none");
    }
  }, [open, editTask, dealId, editAssigneeIds]);

  // Filter deals by selected account
  const filteredDeals = useMemo(() => {
    if (!deals.data) return [];
    if (selectedAccountId === "none") return deals.data;
    return deals.data.filter((d: any) => d.accountId === Number(selectedAccountId));
  }, [deals.data, selectedAccountId]);

  const effectiveDealId = showDealSelector ? selectedDealId : (dealId || editTask?.entityId);
  const effectiveDealTitle = showDealSelector
    ? (deals.data?.find((d: any) => d.id === selectedDealId)?.title || "")
    : (dealTitle || "");

  const handleRemoveAssignee = (userId: number) => {
    setAssigneeUserIds(prev => prev.filter(id => id !== userId));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Informe o assunto da tarefa");
      return;
    }
    if (!dueDate) {
      toast.error("Informe a data do agendamento");
      return;
    }
    if (!dueTime) {
      toast.error("Informe o horário da tarefa");
      return;
    }
    if (assigneeUserIds.length === 0) {
      toast.error("Selecione ao menos um responsável");
      return;
    }

    const dueAt = `${dueDate}T${dueTime}:00`;

    if (isEditMode && editTask) {
      await updateTask.mutateAsync({
        tenantId: TENANT_ID,
        id: editTask.id,
        title,
        description: description || undefined,
        taskType,
        dueAt,
        status: markAsDone ? "done" : (editTask.status === "done" && !markAsDone ? "pending" : undefined),
      });
      // Sync assignees
      const currentIds = new Set(editAssigneeIds || []);
      const newIds = new Set(assigneeUserIds);
      for (const uid of assigneeUserIds) {
        if (!currentIds.has(uid)) {
          await addAssignee.mutateAsync({ tenantId: TENANT_ID, taskId: editTask.id, userId: uid });
        }
      }
      for (const uid of Array.from(currentIds)) {
        if (!newIds.has(uid)) {
          await removeAssignee.mutateAsync({ tenantId: TENANT_ID, taskId: editTask.id, userId: uid });
        }
      }
    } else {
      const targetDealId = effectiveDealId;
      if (!targetDealId) {
        toast.error("Selecione uma negociação");
        return;
      }
      await createTask.mutateAsync({
        tenantId: TENANT_ID,
        entityType: "deal",
        entityId: targetDealId,
        title,
        description: description || undefined,
        taskType,
        dueAt,
        markAsDone,
        assigneeUserIds,
      });
    }
  };

  const isPending = createTask.isPending || updateTask.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 rounded-2xl overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-bold text-foreground">
            {isEditMode ? "Editar Tarefa" : "Criar Tarefa"}
          </DialogTitle>
        </DialogHeader>

        <Separator className="mt-4" />

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Empresa da negociação */}
          {showDealSelector && (
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">Empresa da negociação</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="h-10 rounded-xl border-border/60">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todas</SelectItem>
                  {(allAccounts.data || []).map((acc: any) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Negociação */}
          {showDealSelector ? (
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">
                Negociação <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedDealId ? String(selectedDealId) : ""}
                onValueChange={(v) => setSelectedDealId(Number(v))}
              >
                <SelectTrigger className="h-10 rounded-xl border-border/60">
                  <SelectValue placeholder="Selecionar negociação" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {filteredDeals.map((d: any) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : effectiveDealTitle ? (
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-muted-foreground">Negociação</Label>
              <div className="h-10 px-3 flex items-center rounded-xl bg-muted/40 border border-border/40 text-[13px] text-foreground font-medium">
                {effectiveDealTitle}
              </div>
            </div>
          ) : null}

          {/* Assunto da tarefa */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold text-foreground">
              Assunto da tarefa <span className="text-destructive">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Assunto da tarefa"
              className="h-10 rounded-xl border-border/60"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold text-foreground">Descrição da tarefa</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição da tarefa"
              className="min-h-[80px] rounded-xl border-border/60 resize-y"
            />
          </div>

          {/* Responsável */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold text-foreground">
              Responsável <span className="text-destructive">*</span>
            </Label>
            <div className="border border-border/60 rounded-xl p-2.5 min-h-[42px]">
              <div className="flex flex-wrap gap-1.5 mb-1">
                {assigneeUserIds.map(uid => {
                  const user = (crmUsers.data || []).find((u: any) => u.id === uid);
                  return (
                    <Badge
                      key={uid}
                      variant="secondary"
                      className="text-[12px] rounded-lg px-2.5 py-1 gap-1.5 font-medium bg-secondary/80"
                    >
                      {user?.name || `Usuário #${uid}`}
                      <button
                        type="button"
                        onClick={() => handleRemoveAssignee(uid)}
                        className="hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
              <Select
                value=""
                onValueChange={(v) => {
                  if (v) {
                    const id = Number(v);
                    setAssigneeUserIds(prev => prev.includes(id) ? prev : [...prev, id]);
                  }
                }}
              >
                <SelectTrigger className="h-8 border-0 shadow-none px-1 text-[12px] text-muted-foreground bg-transparent focus:ring-0">
                  <SelectValue placeholder="+ Adicionar responsável" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {(crmUsers.data || [])
                    .filter((u: any) => !assigneeUserIds.includes(u.id))
                    .map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tipo de tarefa */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold text-foreground">
              Tipo de tarefa <span className="text-destructive">*</span>
            </Label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger className="h-10 rounded-xl border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {taskTypeOptions.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Data e Horário */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">
                Data do agendamento <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-10 rounded-xl border-border/60"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">
                Horário da tarefa <span className="text-destructive">*</span>
              </Label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="h-10 rounded-xl border-border/60"
              />
            </div>
          </div>

          {/* Marcar como concluída */}
          <div className="flex items-center gap-2.5 pt-1">
            <Checkbox
              id="markAsDone"
              checked={markAsDone}
              onCheckedChange={(checked) => setMarkAsDone(checked === true)}
            />
            <Label htmlFor="markAsDone" className="text-[13px] text-foreground cursor-pointer">
              {isEditMode ? "Marcar como concluída" : "Marcar como concluída ao criar"}
            </Label>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-5 h-10 text-[13px] font-medium"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-xl px-6 h-10 text-[13px] font-medium bg-primary hover:bg-primary/90"
          >
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
