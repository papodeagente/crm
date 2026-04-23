/**
 * BulkActionsBar — Barra de ações em massa para a visão lista do Pipeline.
 * 
 * Features:
 * - Contador de itens selecionados
 * - Limpar seleção
 * - Ações: Transferir, Alterar Status, Adicionar/Alterar, Criar Tarefa, Mover, Exportar, Excluir
 * - "Selecionar todos os X itens deste filtro"
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRightLeft, RefreshCw, Pencil, ListPlus, ArrowRight,
  Download, Trash2, X, Loader2, CheckCircle2, AlertTriangle, Send,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface BulkActionsBarProps {
  selectedCount: number;
  allMatchingFilter: boolean;
  totalFilterCount: number;
  onClearSelection: () => void;
  onSelectAllFilter: () => void;
  // Selection data
  selectedIds: number[];
  exclusionIds: number[];
  filterSnapshot: any;
  // Pipeline data
  stages: Array<{ id: number; name: string }>;
  users: Array<{ id: number; name: string; userId?: number }>;
  accounts: Array<{ id: number; name: string }>;
  // Callbacks
  onActionComplete: () => void;
  onWhatsApp?: () => void;
}

function buildSelectionInput(props: BulkActionsBarProps) {
  if (props.allMatchingFilter) {
    return {
      allMatchingFilter: true,
      exclusionIds: props.exclusionIds,
      filterSnapshot: props.filterSnapshot,
    };
  }
  return { selectedIds: props.selectedIds };
}

export default function BulkActionsBar(props: BulkActionsBarProps) {
  const {
    selectedCount, allMatchingFilter, totalFilterCount,
    onClearSelection, onSelectAllFilter, stages, users, accounts,
    onActionComplete,
  } = props;

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Transfer state
  const [transferUserId, setTransferUserId] = useState<string>("");

  // Change status state
  const [newStatus, setNewStatus] = useState<string>("");

  // Move stage state
  const [moveStageId, setMoveStageId] = useState<string>("");

  // Update fields state
  const [updateLeadSource, setUpdateLeadSource] = useState("");
  const [updateChannelOrigin, setUpdateChannelOrigin] = useState("");
  const [updateAccountId, setUpdateAccountId] = useState<string>("");

  // Create task state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskType, setTaskType] = useState("task");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignToOwner, setTaskAssignToOwner] = useState(true);

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const utils = trpc.useUtils();

  // Mutations
  const transferMut = trpc.crm.deals.bulkActions.transfer.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.totalProcessed} negociação(ões) transferida(s)`);
      if (data.totalSkipped > 0) toast.warning(`${data.totalSkipped} ignorada(s)`);
      onActionComplete();
      setActiveModal(null);
    },
    onError: (e) => toast.error(e.message || "Erro ao transferir"),
  });

  const changeStatusMut = trpc.crm.deals.bulkActions.changeStatus.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.totalProcessed} negociação(ões) com status alterado`);
      if (data.totalSkipped > 0) toast.warning(`${data.totalSkipped} ignorada(s)`);
      onActionComplete();
      setActiveModal(null);
    },
    onError: (e) => toast.error(e.message || "Erro ao alterar status"),
  });

  const moveStageMut = trpc.crm.deals.bulkActions.moveStage.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.totalProcessed} negociação(ões) movida(s) de etapa`);
      if (data.totalSkipped > 0) toast.warning(`${data.totalSkipped} ignorada(s)`);
      onActionComplete();
      setActiveModal(null);
    },
    onError: (e) => toast.error(e.message || "Erro ao mover etapa"),
  });

  const updateFieldsMut = trpc.crm.deals.bulkActions.updateFields.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.totalProcessed} negociação(ões) atualizada(s)`);
      if (data.totalSkipped > 0) toast.warning(`${data.totalSkipped} ignorada(s)`);
      onActionComplete();
      setActiveModal(null);
    },
    onError: (e) => toast.error(e.message || "Erro ao atualizar campos"),
  });

  const createTaskMut = trpc.crm.deals.bulkActions.createTask.useMutation({
    onSuccess: (data) => {
      toast.success(`Tarefa criada em ${data.totalProcessed} negociação(ões)`);
      if (data.totalSkipped > 0) toast.warning(`${data.totalSkipped} ignorada(s)`);
      onActionComplete();
      setActiveModal(null);
    },
    onError: (e) => toast.error(e.message || "Erro ao criar tarefas"),
  });

  const bulkDeleteMut = trpc.crm.deals.bulkDelete.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} negociação(ões) movida(s) para a lixeira`);
      onActionComplete();
      setShowDeleteConfirm(false);
    },
    onError: () => toast.error("Erro ao excluir negociações"),
  });

  const isPending = transferMut.isPending || changeStatusMut.isPending || moveStageMut.isPending ||
    updateFieldsMut.isPending || createTaskMut.isPending || bulkDeleteMut.isPending;

  // ─── Handlers ───

  function handleTransfer() {
    if (!transferUserId) { toast.error("Selecione o novo responsável"); return; }
    const sel = buildSelectionInput(props);
    transferMut.mutate({ ...sel, newOwnerUserId: Number(transferUserId) });
  }

  function handleChangeStatus() {
    if (!newStatus) { toast.error("Selecione o novo status"); return; }
    const sel = buildSelectionInput(props);
    changeStatusMut.mutate({ ...sel, newStatus: newStatus as any });
  }

  function handleMoveStage() {
    if (!moveStageId) { toast.error("Selecione a etapa destino"); return; }
    const stage = stages.find(s => s.id === Number(moveStageId));
    const sel = buildSelectionInput(props);
    moveStageMut.mutate({ ...sel, toStageId: Number(moveStageId), toStageName: stage?.name || "" });
  }

  function handleUpdateFields() {
    const fields: any = {};
    if (updateLeadSource) fields.leadSource = updateLeadSource;
    if (updateChannelOrigin) fields.channelOrigin = updateChannelOrigin;
    if (updateAccountId) fields.accountId = updateAccountId === "none" ? null : Number(updateAccountId);
    if (Object.keys(fields).length === 0) { toast.error("Preencha ao menos um campo"); return; }
    const sel = buildSelectionInput(props);
    updateFieldsMut.mutate({ ...sel, fields });
  }

  function handleCreateTask() {
    if (!taskTitle.trim()) { toast.error("Informe o título da tarefa"); return; }
    const sel = buildSelectionInput(props);
    createTaskMut.mutate({
      ...sel,
      title: taskTitle,
      taskType,
      priority: taskPriority as any,
      dueAt: taskDueAt || undefined,
      description: taskDescription || undefined,
      assignToOwner: taskAssignToOwner,
    });
  }

  function handleDelete() {
    if (allMatchingFilter) {
      toast.error("Para excluir todos do filtro, selecione individualmente por segurança.");
      return;
    }
    bulkDeleteMut.mutate({ ids: props.selectedIds });
  }

  async function handleExport() {
    try {
      setIsProcessing(true);
      const sel = buildSelectionInput(props);
      const result = await utils.crm.deals.bulkActions.export.fetch(sel as any);
      if (!result?.deals?.length) { toast.warning("Nenhuma negociação para exportar"); setIsProcessing(false); return; }
      
      // Generate CSV
      const headers = ["ID", "Titulo", "Status", "Valor (R$)", "Etapa", "Responsavel", "Cliente ID", "Empresa ID", "Criado em"];
      const rows = result.deals.map((d: any) => [
        d.id,
        `"${(d.title || "").replace(/"/g, '""')}"`,
        d.status === "open" ? "Em andamento" : d.status === "won" ? "Ganho" : "Perdido",
        d.valueCents ? (d.valueCents / 100).toFixed(2) : "0",
        d.stageId,
        d.ownerUserId || "",
        d.contactId || "",
        d.accountId || "",
        d.createdAt ? new Date(d.createdAt).toLocaleDateString("pt-BR") : "",
      ]);
      const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `negociacoes_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${result.totalExported} negociação(ões) exportada(s)`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao exportar");
    } finally {
      setIsProcessing(false);
    }
  }

  function resetModals() {
    setTransferUserId("");
    setNewStatus("");
    setMoveStageId("");
    setUpdateLeadSource("");
    setUpdateChannelOrigin("");
    setUpdateAccountId("");
    setTaskTitle("");
    setTaskType("task");
    setTaskPriority("medium");
    setTaskDueAt("");
    setTaskDescription("");
    setTaskAssignToOwner(true);
  }

  if (selectedCount === 0) return null;

  const showSelectAllBanner = !allMatchingFilter && selectedCount < totalFilterCount;

  return (
    <>
      {/* ─── Top Action Bar ─── */}
      <div className="bg-slate-800 dark:bg-slate-900 text-white rounded-xl px-5 py-3 flex items-center gap-3 flex-wrap shadow-lg animate-in slide-in-from-top-2 duration-200">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-white/15 text-white text-[13px] font-semibold px-3 py-1 rounded-lg">
            {selectedCount} selecionado{selectedCount !== 1 ? "s" : ""}
          </Badge>
          <button
            onClick={onClearSelection}
            className="text-[13px] text-cyan-300 hover:text-cyan-100 font-medium transition-colors"
          >
            Limpar seleção
          </button>
        </div>

        <div className="h-5 w-px bg-white/20 mx-1" />

        {/* Actions */}
        <div className="flex items-center gap-1 flex-wrap">
          {props.onWhatsApp && (
            <ActionButton icon={<Send className="h-3.5 w-3.5" />} label="Disparar WhatsApp" onClick={props.onWhatsApp} disabled={isPending} whatsapp />
          )}
          <ActionButton icon={<ArrowRightLeft className="h-3.5 w-3.5" />} label="Transferir" onClick={() => { resetModals(); setActiveModal("transfer"); }} disabled={isPending} />
          <ActionButton icon={<RefreshCw className="h-3.5 w-3.5" />} label="Alterar status" onClick={() => { resetModals(); setActiveModal("status"); }} disabled={isPending} />
          <ActionButton icon={<Pencil className="h-3.5 w-3.5" />} label="Adicionar ou Alterar" onClick={() => { resetModals(); setActiveModal("update"); }} disabled={isPending} />
          <ActionButton icon={<ListPlus className="h-3.5 w-3.5" />} label="Criar" onClick={() => { resetModals(); setActiveModal("createTask"); }} disabled={isPending} />
          <ActionButton icon={<ArrowRight className="h-3.5 w-3.5" />} label="Mover" onClick={() => { resetModals(); setActiveModal("move"); }} disabled={isPending} />
          <ActionButton icon={<Download className="h-3.5 w-3.5" />} label="Exportar" onClick={handleExport} disabled={isPending || isProcessing} />
          <ActionButton icon={<Trash2 className="h-3.5 w-3.5" />} label="Excluir" onClick={() => setShowDeleteConfirm(true)} disabled={isPending} destructive />
        </div>
      </div>

      {/* ─── Select All Filter Banner ─── */}
      {showSelectAllBanner && (
        <div className="bg-muted/60 border border-border/50 rounded-xl px-4 py-2.5 text-center text-[13px] text-muted-foreground mt-2">
          <button
            onClick={onSelectAllFilter}
            className="text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Selecionar todos os {totalFilterCount} itens deste filtro
          </button>
        </div>
      )}

      {/* ─── Transfer Modal ─── */}
      <Dialog open={activeModal === "transfer"} onOpenChange={(o) => !o && setActiveModal(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Transferir {selectedCount} negociação(ões)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[13px] font-medium">Novo responsável</Label>
              <Select value={transferUserId} onValueChange={setTransferUserId}>
                <SelectTrigger className="mt-1.5 rounded-lg"><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.userId || u.id} value={String(u.userId || u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModal(null)} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleTransfer} disabled={transferMut.isPending || !transferUserId} className="rounded-lg">
              {transferMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Change Status Modal ─── */}
      <Dialog open={activeModal === "status"} onOpenChange={(o) => !o && setActiveModal(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Alterar status de {selectedCount} negociação(ões)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[13px] font-medium">Novo status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="mt-1.5 rounded-lg"><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Em andamento</SelectItem>
                  <SelectItem value="won">Ganho</SelectItem>
                  <SelectItem value="lost">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModal(null)} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleChangeStatus} disabled={changeStatusMut.isPending || !newStatus} className="rounded-lg">
              {changeStatusMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Alterar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Move Stage Modal ─── */}
      <Dialog open={activeModal === "move"} onOpenChange={(o) => !o && setActiveModal(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              Mover {selectedCount} negociação(ões) de etapa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[13px] font-medium">Etapa destino</Label>
              <Select value={moveStageId} onValueChange={setMoveStageId}>
                <SelectTrigger className="mt-1.5 rounded-lg"><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                <SelectContent>
                  {stages.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModal(null)} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleMoveStage} disabled={moveStageMut.isPending || !moveStageId} className="rounded-lg">
              {moveStageMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Update Fields Modal ─── */}
      <Dialog open={activeModal === "update"} onOpenChange={(o) => !o && setActiveModal(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Adicionar ou Alterar em {selectedCount} negociação(ões)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-[12px] text-muted-foreground">Preencha apenas os campos que deseja alterar. Campos vazios não serão modificados.</p>
            <div>
              <Label className="text-[13px] font-medium">Origem do lead</Label>
              <Input value={updateLeadSource} onChange={e => setUpdateLeadSource(e.target.value)} placeholder="Ex: Google, Indicação, Instagram" className="mt-1.5 rounded-lg" />
            </div>
            <div>
              <Label className="text-[13px] font-medium">Canal de origem</Label>
              <Input value={updateChannelOrigin} onChange={e => setUpdateChannelOrigin(e.target.value)} placeholder="Ex: WhatsApp, Site, Telefone" className="mt-1.5 rounded-lg" />
            </div>
            <div>
              <Label className="text-[13px] font-medium">Empresa</Label>
              <Select value={updateAccountId} onValueChange={setUpdateAccountId}>
                <SelectTrigger className="mt-1.5 rounded-lg"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (remover)</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModal(null)} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleUpdateFields} disabled={updateFieldsMut.isPending} className="rounded-lg">
              {updateFieldsMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Create Task Modal ─── */}
      <Dialog open={activeModal === "createTask"} onOpenChange={(o) => !o && setActiveModal(null)}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListPlus className="h-5 w-5 text-primary" />
              Criar tarefa em {selectedCount} negociação(ões)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[13px] font-medium">Título da tarefa *</Label>
              <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Ex: Follow-up com cliente" className="mt-1.5 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[13px] font-medium">Tipo</Label>
                <Select value={taskType} onValueChange={setTaskType}>
                  <SelectTrigger className="mt-1.5 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">Tarefa</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="phone">Ligação</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[13px] font-medium">Prioridade</Label>
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger className="mt-1.5 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-[13px] font-medium">Data de vencimento</Label>
              <Input type="datetime-local" value={taskDueAt} onChange={e => setTaskDueAt(e.target.value)} className="mt-1.5 rounded-lg" />
            </div>
            <div>
              <Label className="text-[13px] font-medium">Descrição</Label>
              <Textarea value={taskDescription} onChange={e => setTaskDescription(e.target.value)} placeholder="Descrição opcional..." rows={2} className="mt-1.5 rounded-lg" />
            </div>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input type="checkbox" checked={taskAssignToOwner} onChange={e => setTaskAssignToOwner(e.target.checked)} className="rounded" />
              Atribuir ao responsável de cada negociação
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModal(null)} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleCreateTask} disabled={createTaskMut.isPending || !taskTitle.trim()} className="rounded-lg">
              {createTaskMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Criar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir negociações
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja mover <strong>{selectedCount}</strong> negociação(ões) para a lixeira?
              {allMatchingFilter && (
                <span className="block mt-2 text-destructive font-medium">
                  Atenção: Todos os itens do filtro serão afetados.
                </span>
              )}
              <span className="block mt-1">Os clientes vinculados não serão apagados.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={bulkDeleteMut.isPending}
            >
              {bulkDeleteMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ActionButton({ icon, label, onClick, disabled, destructive, whatsapp }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; destructive?: boolean; whatsapp?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-150 disabled:opacity-40 ${
        whatsapp
          ? "text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
          : destructive
            ? "text-red-300 hover:bg-red-500/20 hover:text-red-200"
            : "text-white/90 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
