import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { AdminOnlyGuard } from "@/components/AdminOnlyGuard";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTenantId } from "@/hooks/useTenantId";
import {
  ArrowLeft, Plus, Pencil, Trash2, Zap, Clock,
  MessageCircle, Phone, Mail, Video, CheckSquare,
  CalendarDays, Plane, RotateCcw, GripVertical,
} from "lucide-react";

const TASK_TYPE_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-green-600" },
  { value: "phone", label: "Telefone", icon: Phone, color: "text-blue-600" },
  { value: "email", label: "E-mail", icon: Mail, color: "text-amber-600" },
  { value: "video", label: "Vídeo", icon: Video, color: "text-purple-600" },
  { value: "task", label: "Tarefa", icon: CheckSquare, color: "text-teal-600" },
];

const DEADLINE_REF_OPTIONS = [
  { value: "current_date", label: "Data atual (ao mover)", icon: CalendarDays },
  { value: "boarding_date", label: "Data do embarque", icon: Plane },
  { value: "return_date", label: "Data do retorno", icon: RotateCcw },
];

interface AutomationFormData {
  stageId: number;
  taskTitle: string;
  taskDescription: string;
  taskType: string;
  deadlineReference: string;
  deadlineOffsetDays: number;
  deadlineOffsetUnit: "minutes" | "hours" | "days";
  deadlineTime: string;
  assignToOwner: boolean;
  isActive: boolean;
}

const OFFSET_UNIT_OPTIONS = [
  { value: "minutes" as const, label: "Minutos" },
  { value: "hours" as const, label: "Horas" },
  { value: "days" as const, label: "Dias" },
];

const defaultFormData: AutomationFormData = {
  stageId: 0,
  taskTitle: "",
  taskDescription: "",
  taskType: "task",
  deadlineReference: "current_date",
  deadlineOffsetDays: 0,
  deadlineOffsetUnit: "days",
  deadlineTime: "09:00",
  assignToOwner: true,
  isActive: true,
};

export default function TaskAutomationSettings() {
  const tenantId = useTenantId();
  const [, setLocation] = useLocation();
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AutomationFormData>(defaultFormData);

  // Queries
  const pipelinesQ = trpc.crm.pipelines.list.useQuery({},
    { enabled: true }
  );
  const stagesQ = trpc.crm.pipelines.stages.useQuery(
    { pipelineId: selectedPipelineId! },
    { enabled: !!selectedPipelineId }
  );
  const automationsQ = trpc.crm.taskAutomations.list.useQuery(
    { pipelineId: selectedPipelineId ?? undefined },
    { enabled: true }
  );

  const utils = trpc.useUtils();

  // Mutations
  const createMut = trpc.crm.taskAutomations.create.useMutation({
    onSuccess: () => {
      utils.crm.taskAutomations.list.invalidate();
      toast.success("Automação criada com sucesso");
      setShowForm(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMut = trpc.crm.taskAutomations.update.useMutation({
    onSuccess: () => {
      utils.crm.taskAutomations.list.invalidate();
      toast.success("Automação atualizada com sucesso");
      setShowForm(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMut = trpc.crm.taskAutomations.delete.useMutation({
    onSuccess: () => {
      utils.crm.taskAutomations.list.invalidate();
      toast.success("Automação removida com sucesso");
    },
    onError: (err) => toast.error(err.message),
  });

  const pipelines = pipelinesQ.data ?? [];
  const stages = stagesQ.data ?? [];
  const automations = automationsQ.data ?? [];

  // Auto-select first pipeline
  if (pipelines.length > 0 && !selectedPipelineId) {
    setSelectedPipelineId(pipelines[0].id);
  }

  // Group automations by stage
  const automationsByStage = useMemo(() => {
    const map: Record<number, typeof automations> = {};
    for (const a of automations) {
      if (selectedPipelineId && a.pipelineId !== selectedPipelineId) continue;
      if (!map[a.stageId]) map[a.stageId] = [];
      map[a.stageId].push(a);
    }
    return map;
  }, [automations, selectedPipelineId]);

  function resetForm() {
    setFormData(defaultFormData);
    setEditingId(null);
  }

  function openCreate(stageId: number) {
    resetForm();
    setFormData({ ...defaultFormData, stageId });
    setShowForm(true);
  }

  function openEdit(auto: any) {
    setEditingId(auto.id);
    setFormData({
      stageId: auto.stageId,
      taskTitle: auto.taskTitle,
      taskDescription: auto.taskDescription || "",
      taskType: auto.taskType || "task",
      deadlineReference: auto.deadlineReference || "current_date",
      deadlineOffsetDays: auto.deadlineOffsetDays ?? 0,
      deadlineOffsetUnit: auto.deadlineOffsetUnit || "days",
      deadlineTime: auto.deadlineTime || "09:00",
      assignToOwner: auto.assignToOwner ?? true,
      isActive: auto.isActive ?? true,
    });
    setShowForm(true);
  }

  function handleSave() {
    if (!tenantId || !selectedPipelineId) return;
    if (!formData.taskTitle.trim()) {
      toast.error("O título da tarefa é obrigatório.");
      return;
    }
    if (!formData.stageId) {
      toast.error("Selecione uma etapa.");
      return;
    }

    if (editingId) {
      updateMut.mutate({
        id: editingId, pipelineId: selectedPipelineId,
        ...formData,
        taskType: formData.taskType as any,
        deadlineReference: formData.deadlineReference as any,
        taskDescription: formData.taskDescription || null,
      });
    } else {
      createMut.mutate({ pipelineId: selectedPipelineId,
        ...formData,
        taskType: formData.taskType as any,
        deadlineReference: formData.deadlineReference as any,
      });
    }
  }

  function handleDelete(id: number) {
    deleteMut.mutate({ id});
  }

  function handleToggleActive(auto: any) {
    updateMut.mutate({ id: auto.id, isActive: !auto.isActive });
  }

  function getDeadlineLabel(ref: string, offset: number, unit?: string) {
    const direction = offset >= 0 ? "depois" : "antes";
    const absOffset = Math.abs(offset);
    const refLabel = DEADLINE_REF_OPTIONS.find(o => o.value === ref)?.label || ref;
    if (offset === 0) return `No momento da ${refLabel.toLowerCase()}`;
    const unitLabel = unit === "minutes" ? (absOffset === 1 ? "minuto" : "minutos")
      : unit === "hours" ? (absOffset === 1 ? "hora" : "horas")
      : (absOffset === 1 ? "dia" : "dias");
    return `${absOffset} ${unitLabel} ${direction} da ${refLabel.toLowerCase()}`;
  }

  return (
    <AdminOnlyGuard pageTitle="Automação de vendas">
    <div className="page-content max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")} className="shrink-0" style={{ pointerEvents: "auto" }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <Zap className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Automação de Vendas</h1>
            <p className="text-[13px] text-muted-foreground">Configure tarefas automáticas ao mover negociações entre etapas</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="mb-6 border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">Como funciona a automação de tarefas</p>
              <p className="text-xs text-amber-700 mt-1">
                Quando uma negociação é movida para uma etapa do funil, o sistema cria automaticamente as tarefas configuradas.
                O prazo pode ser calculado com base na <strong>data atual</strong>, na <strong>data do embarque</strong> ou na <strong>data do retorno</strong> da negociação.
                Use valores negativos para criar tarefas com prazo ANTES da data de referência (ex: -30 = 30 dias antes do embarque).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Selector */}
      <div className="flex items-center gap-4 mb-6">
        <Label className="text-sm font-medium whitespace-nowrap">Funil:</Label>
        <Select
          value={selectedPipelineId?.toString() || ""}
          onValueChange={(v) => setSelectedPipelineId(Number(v))}
        >
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Selecione um funil" />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((p: any) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.name} {p.pipelineType === "post_sale" ? "(Pós-Venda)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stages with Automations */}
      {stages.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Selecione um funil para ver as etapas e configurar automações.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {stages.map((stage: any) => {
            const stageAutomations = automationsByStage[stage.id] || [];
            return (
              <Card key={stage.id} className="overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: stage.color || "#6b7280" }}
                      />
                      <CardTitle className="text-base">{stage.name}</CardTitle>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {stageAutomations.length} automação{stageAutomations.length !== 1 ? "ões" : ""}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCreate(stage.id)}
                      className="gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {stageAutomations.length === 0 ? (
                    <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                      Nenhuma automação configurada para esta etapa.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {stageAutomations.map((auto: any) => {
                        const typeOpt = TASK_TYPE_OPTIONS.find(t => t.value === auto.taskType);
                        const TypeIcon = typeOpt?.icon || CheckSquare;
                        return (
                          <div key={auto.id} className={`flex items-center gap-3 px-4 py-3 ${!auto.isActive ? "opacity-50" : ""}`}>
                            <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${typeOpt?.color || "text-gray-600"} bg-muted/50`}>
                              <TypeIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{auto.taskTitle}</p>
                              <p className="text-xs text-muted-foreground">
                                {getDeadlineLabel(auto.deadlineReference, auto.deadlineOffsetDays, auto.deadlineOffsetUnit)} {(auto.deadlineOffsetUnit || "days") === "days" ? `· às ${auto.deadlineTime || "09:00"}` : ""}
                                {auto.assignToOwner && " · Atribuir ao responsável"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Switch
                                checked={auto.isActive}
                                onCheckedChange={() => handleToggleActive(auto)}
                                className="scale-90"
                              />
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(auto)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(auto.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar automação" : "Nova automação de tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Stage (read-only when creating from stage button) */}
            <div>
              <Label className="text-sm font-medium">Etapa do funil *</Label>
              <Select
                value={formData.stageId?.toString() || ""}
                onValueChange={(v) => setFormData({ ...formData, stageId: Number(v) })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Task Title */}
            <div>
              <Label className="text-sm font-medium">Título da tarefa *</Label>
              <Input
                className="mt-1"
                value={formData.taskTitle}
                onChange={(e) => setFormData({ ...formData, taskTitle: e.target.value })}
                placeholder="Ex: Enviar mensagem de boas-vindas"
              />
            </div>

            {/* Task Description */}
            <div>
              <Label className="text-sm font-medium">Descrição</Label>
              <Input
                className="mt-1"
                value={formData.taskDescription}
                onChange={(e) => setFormData({ ...formData, taskDescription: e.target.value })}
                placeholder="Descrição opcional da tarefa"
              />
            </div>

            {/* Task Type */}
            <div>
              <Label className="text-sm font-medium">Tipo de tarefa *</Label>
              <Select
                value={formData.taskType}
                onValueChange={(v) => setFormData({ ...formData, taskType: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className={`h-4 w-4 ${opt.color}`} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deadline Reference */}
            <div>
              <Label className="text-sm font-medium">Referência de prazo *</Label>
              <Select
                value={formData.deadlineReference}
                onValueChange={(v) => setFormData({ ...formData, deadlineReference: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEADLINE_REF_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="h-4 w-4 text-muted-foreground" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Use "Data do embarque" ou "Data do retorno" para tarefas do funil de pós-venda.
              </p>
            </div>

            {/* Offset Value + Unit + Time */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-sm font-medium">Deslocamento</Label>
                <Input
                  type="number"
                  className="mt-1"
                  value={formData.deadlineOffsetDays}
                  onChange={(e) => setFormData({ ...formData, deadlineOffsetDays: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  + depois, - antes
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Unidade</Label>
                <Select
                  value={formData.deadlineOffsetUnit}
                  onValueChange={(v) => setFormData({ ...formData, deadlineOffsetUnit: v as any })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFSET_UNIT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Horário</Label>
                <Input
                  type="time"
                  className="mt-1"
                  value={formData.deadlineTime}
                  onChange={(e) => setFormData({ ...formData, deadlineTime: e.target.value })}
                  disabled={formData.deadlineOffsetUnit !== "days"}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.deadlineOffsetUnit !== "days" ? "Usa hora atual" : ""}
                </p>
              </div>
            </div>

            {/* Assign to Owner */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Atribuir ao responsável da negociação</p>
                <p className="text-xs text-muted-foreground">A tarefa será atribuída automaticamente ao dono do deal</p>
              </div>
              <Switch
                checked={formData.assignToOwner}
                onCheckedChange={(v) => setFormData({ ...formData, assignToOwner: v })}
              />
            </div>

            {/* Active */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Automação ativa</p>
                <p className="text-xs text-muted-foreground">Desative para pausar sem excluir</p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "Salvando..." : editingId ? "Salvar alterações" : "Criar automação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AdminOnlyGuard>
  );
}
