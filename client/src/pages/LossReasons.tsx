import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, RotateCcw, XCircle,
  MoreHorizontal, Archive, AlertTriangle,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TENANT_ID = 1;

export default function LossReasons() {
  const [, setLocation] = useLocation();
  const [showDeleted, setShowDeleted] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{ id: number; name: string; hard?: boolean } | null>(null);

  // Queries
  const reasonsQuery = trpc.crm.lossReasons.list.useQuery({ tenantId: TENANT_ID, includeDeleted: showDeleted });
  const utils = trpc.useUtils();

  // Mutations
  const createReason = trpc.crm.lossReasons.create.useMutation({
    onSuccess: () => { utils.crm.lossReasons.list.invalidate(); toast.success("Motivo de perda criado com sucesso"); setDialogOpen(false); },
    onError: () => toast.error("Erro ao criar motivo de perda"),
  });
  const updateReason = trpc.crm.lossReasons.update.useMutation({
    onSuccess: () => { utils.crm.lossReasons.list.invalidate(); toast.success("Motivo de perda atualizado"); setDialogOpen(false); },
    onError: () => toast.error("Erro ao atualizar motivo de perda"),
  });
  const deleteReason = trpc.crm.lossReasons.delete.useMutation({
    onSuccess: () => { utils.crm.lossReasons.list.invalidate(); toast.success("Motivo movido para lixeira"); setDeleteDialog(null); },
  });
  const restoreReason = trpc.crm.lossReasons.restore.useMutation({
    onSuccess: () => { utils.crm.lossReasons.list.invalidate(); toast.success("Motivo restaurado"); },
  });
  const hardDeleteReason = trpc.crm.lossReasons.hardDelete.useMutation({
    onSuccess: () => { utils.crm.lossReasons.list.invalidate(); toast.success("Motivo excluído permanentemente"); setDeleteDialog(null); },
  });

  const activeReasons = useMemo(() => (reasonsQuery.data || []).filter((r: any) => !r.isDeleted), [reasonsQuery.data]);
  const deletedReasons = useMemo(() => (reasonsQuery.data || []).filter((r: any) => r.isDeleted), [reasonsQuery.data]);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setDialogOpen(true);
  }
  function openEdit(reason: any) {
    setEditing(reason);
    setName(reason.name);
    setDescription(reason.description || "");
    setDialogOpen(true);
  }
  function handleSave() {
    if (!name.trim()) return;
    if (editing) {
      updateReason.mutate({ id: editing.id, name: name.trim(), description: description.trim() || undefined });
    } else {
      createReason.mutate({ tenantId: TENANT_ID, name: name.trim(), description: description.trim() || undefined });
    }
  }
  function handleDelete() {
    if (!deleteDialog) return;
    if (deleteDialog.hard) {
      hardDeleteReason.mutate({ id: deleteDialog.id });
    } else {
      deleteReason.mutate({ id: deleteDialog.id });
    }
  }

  return (
    <div className="page-content max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => setLocation("/settings")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-500/15 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Motivos de Perda</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie os motivos pelos quais negociações são perdidas</p>
            </div>
          </div>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo Motivo</Button>
        </div>
      </div>

      {/* Toggle deleted */}
      <div className="flex justify-end mb-4">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} className="rounded" />
          Mostrar excluídos
        </label>
      </div>

      {/* Info */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Quando uma negociação é marcada como "Perdida", o vendedor pode selecionar um motivo desta lista.
          Isso ajuda a identificar padrões e melhorar seu processo de vendas.
        </p>
      </div>

      {/* Active Reasons */}
      <div className="space-y-2">
        {activeReasons.map((reason: any) => (
          <Card key={reason.id} className="group">
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <XCircle className="h-4 w-4 text-red-400/60 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">{reason.name}</span>
                {reason.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{reason.description}</p>
                )}
              </div>
              {reason.usageCount > 0 && (
                <Badge variant="secondary" className="text-xs">{reason.usageCount} uso{reason.usageCount !== 1 ? "s" : ""}</Badge>
              )}
              {!reason.isActive && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(reason)}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeleteDialog({ id: reason.id, name: reason.name })} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        ))}
        {activeReasons.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <XCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum motivo de perda cadastrado</p>
            <p className="text-xs mt-1">Crie motivos para entender por que negociações são perdidas</p>
          </div>
        )}
      </div>

      {/* Deleted Reasons (Trash) */}
      {showDeleted && deletedReasons.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Archive className="h-3.5 w-3.5" /> Lixeira ({deletedReasons.length})
          </p>
          <div className="space-y-2 opacity-60">
            {deletedReasons.map((reason: any) => (
              <Card key={reason.id}>
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <XCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  <span className="text-sm text-muted-foreground flex-1 line-through">{reason.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => restoreReason.mutate({ id: reason.id })}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteDialog({ id: reason.id, name: reason.name, hard: true })}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir definitivamente
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Motivo de Perda" : "Novo Motivo de Perda"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome do motivo *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Preço alto, Concorrência, Sem orçamento..." />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Descrição (opcional)</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva quando este motivo deve ser usado..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!name.trim() || createReason.isPending || updateReason.isPending}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteDialog?.hard ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <Trash2 className="h-5 w-5" />}
              {deleteDialog?.hard ? "Excluir permanentemente" : "Mover para lixeira"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.hard
                ? `Tem certeza que deseja excluir permanentemente "${deleteDialog?.name}"? Esta ação não pode ser desfeita.`
                : `"${deleteDialog?.name}" será movido para a lixeira. Você poderá restaurá-lo depois.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={deleteDialog?.hard ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}>
              {deleteDialog?.hard ? "Excluir permanentemente" : "Mover para lixeira"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
