import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import {
  X, Phone, Mail, Video, MessageSquare, CheckSquare, Send, Clock, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import QuickMessagesPicker, { type MessageContext } from "@/components/QuickMessagesPicker";
export const taskTypeOptions = [
  { value: "task", label: "Tarefa", icon: CheckSquare },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "whatsapp_scheduled_send", label: "Disparar WhatsApp", icon: Send },
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
  /** Contact ID for whatsapp_scheduled_send */
  contactId?: number;
  contactName?: string;
  contactPhone?: string;
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
    waMessageBody?: string | null;
    waScheduledAt?: string | Date | null;
    waStatus?: string | null;
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
  contactId: propContactId,
  contactName: propContactName,
  contactPhone: propContactPhone,
  editTask,
  editAssigneeIds,
  onSuccess,
  showDealSelector = false,
}: TaskFormDialogProps) {
  const utils = trpc.useUtils();
  const { user: currentUser } = useAuth();
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

  // WhatsApp scheduled send state
  const [waMessageBody, setWaMessageBody] = useState("");

  const isScheduledWhatsApp = taskType === "whatsapp_scheduled_send";

  // Data queries
  const crmUsers = trpc.admin.users.list.useQuery();
  const deals = trpc.crm.deals.list.useQuery(
    { limit: 200 },
    { enabled: showDealSelector }
  );
  const allAccounts = trpc.crm.accounts.list.useQuery(undefined,
    { enabled: showDealSelector }
  );

  // Fetch deal detail to get contactId when in scheduled WA mode
  const effectiveDealIdForContact = showDealSelector ? selectedDealId : (dealId || editTask?.entityId);
  const dealDetail = trpc.crm.deals.get.useQuery(
    { id: effectiveDealIdForContact! },
    { enabled: isScheduledWhatsApp && !!effectiveDealIdForContact }
  );
  const resolvedContactId = propContactId || (dealDetail.data as any)?.contactId;
  const resolvedContactName = propContactName || (dealDetail.data as any)?.contactName;
  const resolvedContactPhone = propContactPhone || (dealDetail.data as any)?.contactPhone || (dealDetail.data as any)?.contactPhoneE164;

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

  const createScheduledWA = trpc.crm.tasks.scheduledWhatsApp.create.useMutation({
    onSuccess: () => {
      toast.success("Disparo de WhatsApp agendado com sucesso!");
      utils.crm.tasks.list.invalidate();
      utils.crm.tasks.overdueSummary.invalidate();
      utils.crm.tasks.pendingCounts.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => toast.error(`Erro ao agendar disparo: ${err.message}`),
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
        // Use local date parts (getFullYear/getMonth/getDate) to display in user's local timezone
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        setDueDate(`${year}-${month}-${day}`);
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
      setWaMessageBody(editTask.waMessageBody || "");
    } else {
      setTitle("");
      setDescription("");
      setTaskType("task");
      const now = new Date();
      // Use local date parts for default values
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      setDueDate(`${year}-${month}-${day}`);
      setDueTime(
        String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0")
      );
      // Default assignee: current logged-in user
      const currentUserId = (currentUser as any)?.userId || (currentUser as any)?.id;
      setAssigneeUserIds(currentUserId ? [currentUserId] : []);
      setMarkAsDone(false);
      setSelectedDealId(dealId || null);
      setSelectedAccountId("none");
      setWaMessageBody("");
    }
  }, [open, editTask, dealId, editAssigneeIds, currentUser]);

  // Filter deals by selected account
  const dealItemsList = (deals.data as any)?.items || (Array.isArray(deals.data) ? deals.data : []);
  const filteredDeals = useMemo(() => {
    if (!dealItemsList || !dealItemsList.length) return [];
    if (selectedAccountId === "none") return dealItemsList;
    return dealItemsList.filter((d: any) => d.accountId === Number(selectedAccountId));
  }, [dealItemsList, selectedAccountId]);

  const effectiveDealId = showDealSelector ? selectedDealId : (dealId || editTask?.entityId);
  const effectiveDealTitle = showDealSelector
    ? (dealItemsList?.find((d: any) => d.id === selectedDealId)?.title || "")
    : (dealTitle || "");

  const handleRemoveAssignee = (userId: number) => {
    setAssigneeUserIds(prev => {
      const next = prev.filter(id => id !== userId);
      if (next.length === 0) {
        toast.error("A tarefa precisa ter pelo menos um responsável.");
        return prev;
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!isScheduledWhatsApp && !title.trim()) {
      toast.error("Informe o assunto da tarefa");
      return;
    }
    if (!dueDate) {
      toast.error("Informe a data do agendamento");
      return;
    }
    if (!dueTime) {
      toast.error("Informe o horário");
      return;
    }

    // Build a proper Date from local date+time inputs, then convert to ISO (UTC)
    // This ensures the backend receives the correct UTC timestamp regardless of server timezone
    const localDate = new Date(`${dueDate}T${dueTime}:00`);
    const dueAt = localDate.toISOString();

    // ── Scheduled WhatsApp Send ──
    if (isScheduledWhatsApp && !isEditMode) {
      if (!waMessageBody.trim()) {
        toast.error("Informe a mensagem do WhatsApp");
        return;
      }
      const targetDealId = effectiveDealId;
      if (!targetDealId) {
        toast.error("Selecione uma negociação");
        return;
      }
      if (!resolvedContactId) {
        toast.error("Negociação sem passageiro vinculado. Vincule um passageiro antes de agendar.");
        return;
      }

      await createScheduledWA.mutateAsync({
        entityType: "deal",
        entityId: targetDealId,
        contactId: resolvedContactId,
        dealId: targetDealId,
        messageBody: waMessageBody,
        scheduledAt: dueAt,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
        assignedToUserId: assigneeUserIds[0] || undefined,
        title: title.trim() || undefined,
      });
      return;
    }

    // ── Regular task ──
    if (!title.trim()) {
      toast.error("Informe o assunto da tarefa");
      return;
    }
    if (assigneeUserIds.length === 0) {
      toast.error("É obrigatório ter pelo menos um responsável. Adicione um responsável para salvar a tarefa.");
      return;
    }

    if (isEditMode && editTask) {
      await updateTask.mutateAsync({
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
          await addAssignee.mutateAsync({ taskId: editTask.id, userId: uid });
        }
      }
      for (const uid of Array.from(currentIds)) {
        if (!newIds.has(uid)) {
          await removeAssignee.mutateAsync({ taskId: editTask.id, userId: uid });
        }
      }
    } else {
      const targetDealId = effectiveDealId;
      if (!targetDealId) {
        toast.error("Selecione uma negociação");
        return;
      }
      await createTask.mutateAsync({
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

  const isPending = createTask.isPending || updateTask.isPending || createScheduledWA.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 rounded-2xl overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-bold text-foreground">
            {isScheduledWhatsApp
              ? "Agendar Disparo de WhatsApp"
              : isEditMode ? "Editar Tarefa" : "Criar Tarefa"}
          </DialogTitle>
        </DialogHeader>

        <Separator className="mt-4" />

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Empresa da negociação */}
          {showDealSelector && (
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">Empresa da negociação</Label>
              <SearchableCombobox
                options={[
                  { value: "none", label: "Todas" },
                  ...(allAccounts.data || []).map((acc: any) => ({
                    value: String(acc.id),
                    label: acc.name,
                  })),
                ]}
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
                placeholder="Buscar empresa..."
                searchPlaceholder="Digite o nome da empresa..."
                clearable
              />
            </div>
          )}

          {/* Negociação */}
          {showDealSelector ? (
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">
                Negociação <span className="text-destructive">*</span>
              </Label>
              <SearchableCombobox
                options={filteredDeals.map((d: any) => ({
                  value: String(d.id),
                  label: d.title,
                  sublabel: d.accountName || d.contactName || undefined,
                }))}
                value={selectedDealId ? String(selectedDealId) : ""}
                onValueChange={(v) => setSelectedDealId(v ? Number(v) : null)}
                placeholder="Buscar negociação..."
                searchPlaceholder="Digite o nome da negociação..."
                emptyText="Nenhuma negociação encontrada."
                loading={deals.isLoading}
              />
            </div>
          ) : effectiveDealTitle ? (
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-muted-foreground">Negociação</Label>
              <div className="h-10 px-3 flex items-center rounded-xl bg-muted/50 text-[13px] text-foreground font-medium">
                {effectiveDealTitle}
              </div>
            </div>
          ) : null}

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

          {/* ── WhatsApp Scheduled Send fields ── */}
          {isScheduledWhatsApp && (
            <>
              {/* Contact info */}
              {resolvedContactName && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <Send className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="text-[13px]">
                    <span className="font-semibold text-foreground">{resolvedContactName}</span>
                    {resolvedContactPhone && (
                      <span className="text-muted-foreground ml-2">{resolvedContactPhone}</span>
                    )}
                  </div>
                </div>
              )}
              {!resolvedContactId && effectiveDealId && !dealDetail.isLoading && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-[13px] text-amber-700">
                    Negociação sem passageiro vinculado. Vincule um passageiro antes de agendar.
                  </span>
                </div>
              )}

              {/* Message body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[13px] font-semibold text-foreground">
                    Mensagem do WhatsApp <span className="text-destructive">*</span>
                  </Label>
                  <QuickMessagesPicker
                    onSelect={(content) => setWaMessageBody(content)}
                    variant="text"
                    side="bottom"
                    align="end"
                    context={{
                      contactName: resolvedContactName || propContactName,
                      contactPhone: resolvedContactPhone || propContactPhone,
                      dealId: effectiveDealId || undefined,
                      dealTitle: effectiveDealTitle || dealTitle,
                    } as MessageContext}
                  />
                </div>
                <Textarea
                  value={waMessageBody}
                  onChange={(e) => setWaMessageBody(e.target.value)}
                  placeholder="Digite a mensagem que será enviada via WhatsApp..."
                  className="min-h-[120px] rounded-xl border-border/60 resize-y"
                />
                <p className="text-[11px] text-muted-foreground">
                  {waMessageBody.length} caracteres
                </p>
              </div>
            </>
          )}

          {/* Assunto da tarefa (optional for scheduled WA) */}
          {!isScheduledWhatsApp && (
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
          )}

          {isScheduledWhatsApp && (
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">
                Titulo da tarefa <span className="text-muted-foreground text-[11px]">(opcional)</span>
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`WhatsApp para ${resolvedContactName || "passageiro"}`}
                className="h-10 rounded-xl border-border/60"
              />
            </div>
          )}

          {/* Descrição (hidden for scheduled WA) */}
          {!isScheduledWhatsApp && (
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">Descrição da tarefa</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição da tarefa"
                className="min-h-[80px] rounded-xl border-border/60 resize-y"
              />
            </div>
          )}

          {/* Responsável */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold text-foreground">
              Responsável {!isScheduledWhatsApp && <span className="text-destructive">*</span>}
              {isScheduledWhatsApp && <span className="text-muted-foreground text-[11px] ml-1">(quem envia)</span>}
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

          {/* Data e Horário */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">
                {isScheduledWhatsApp ? "Data do envio" : "Data do agendamento"} <span className="text-destructive">*</span>
              </Label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="Selecionar data"
                className="h-10 rounded-xl border-border/60"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">
                {isScheduledWhatsApp ? "Horário do envio" : "Horário da tarefa"} <span className="text-destructive">*</span>
              </Label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="h-10 rounded-xl border-border/60"
              />
            </div>
          </div>

          {/* Info box for scheduled WA */}
          {isScheduledWhatsApp && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
              <Clock className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="text-[12px] text-sky-800 dark:text-sky-300 space-y-1">
                <p className="font-medium">Como funciona o disparo agendado</p>
                <p>A mensagem será enviada automaticamente na data e horário definidos, usando o WhatsApp do responsável selecionado. A conversa será vinculada ao responsável no Inbox.</p>
              </div>
            </div>
          )}

          {/* Marcar como concluída (hidden for scheduled WA) */}
          {!isScheduledWhatsApp && (
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
          )}
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
            disabled={isPending || (isScheduledWhatsApp && !resolvedContactId && !!effectiveDealId)}
            className={`rounded-xl px-6 h-10 text-[13px] font-medium ${
              isScheduledWhatsApp
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-primary hover:bg-primary/90"
            }`}
          >
            {isPending
              ? "Salvando..."
              : isScheduledWhatsApp
                ? "Agendar Disparo"
                : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
