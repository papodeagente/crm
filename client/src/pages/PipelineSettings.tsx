import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  GitBranch, Zap, GripVertical, AlertTriangle, Archive,
  Play, Pause, Copy, ArrowRight, Loader2, Star,
} from "lucide-react";
import { toast } from "sonner";

/* ─── Types ─── */
interface PipelineData {
  id: number; tenantId: number; name: string; description: string | null;
  color: string | null; pipelineType: string; isDefault: number | boolean;
  isArchived: number | boolean; createdAt: string; updatedAt: string;
}
interface StageData {
  id: number; tenantId: number; pipelineId: number; name: string;
  color: string | null; orderIndex: number; probabilityDefault: number | null;
  isWon: number | boolean; isLost: number | boolean; createdAt: string;
}
interface AutomationData {
  id: number; tenantId: number; name: string; sourcePipelineId: number;
  triggerEvent: string; triggerStageId: number | null;
  targetPipelineId: number; targetStageId: number;
  copyProducts: number | boolean; copyParticipants: number | boolean;
  copyCustomFields: number | boolean; isActive: number | boolean;
  createdAt: string; updatedAt: string;
}

const PIPELINE_TYPES: Record<string, { label: string; color: string }> = {
  sales: { label: "Vendas", color: "bg-emerald-500/15 text-emerald-400" },
  post_sale: { label: "Pós-Venda", color: "bg-sky-500/15 text-sky-400" },
  support: { label: "Suporte", color: "bg-amber-500/15 text-amber-400" },
  custom: { label: "Personalizado", color: "bg-violet-500/15 text-violet-400" },
};

const TRIGGER_EVENTS: Record<string, string> = {
  deal_won: "Venda Ganha",
  deal_lost: "Venda Perdida",
  stage_reached: "Etapa Alcançada",
};

const STAGE_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

/* ─── Main Page ─── */
export default function PipelineSettings() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  // toast from sonner (imported at top)
  const tenantId = (user as any)?.tenantId || 1;

  const [activeTab, setActiveTab] = useState<"pipelines" | "automations">("pipelines");
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);

  // Pipeline dialogs
  const [showPipelineDialog, setShowPipelineDialog] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<PipelineData | null>(null);
  const [pipelineForm, setPipelineForm] = useState({ name: "", description: "", color: "#10b981", pipelineType: "sales" });

  // Stage dialogs
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [editingStage, setEditingStage] = useState<StageData | null>(null);
  const [stageForm, setStageForm] = useState({ name: "", color: "#10b981", probabilityDefault: 0, isWon: false, isLost: false });

  // Automation dialogs
  const [showAutoDialog, setShowAutoDialog] = useState(false);
  const [editingAuto, setEditingAuto] = useState<AutomationData | null>(null);
  const [autoForm, setAutoForm] = useState({
    name: "", sourcePipelineId: 0, triggerEvent: "deal_won" as string,
    triggerStageId: undefined as number | undefined,
    targetPipelineId: 0, targetStageId: 0,
    copyProducts: true, copyParticipants: true, copyCustomFields: true,
  });

  // Queries
  const pipelinesQ = trpc.crm.pipelines.list.useQuery({ tenantId, includeArchived: true });
  const pipelines = (pipelinesQ.data || []) as unknown as PipelineData[];
  const activePipelines = pipelines.filter(p => !p.isArchived);

  const stagesQ = trpc.crm.pipelines.stages.useQuery(
    { tenantId, pipelineId: selectedPipelineId! },
    { enabled: !!selectedPipelineId }
  );
  const stages = (stagesQ.data || []) as unknown as StageData[];
  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.orderIndex - b.orderIndex), [stages]);

  const automationsQ = trpc.crm.pipelineAutomations.list.useQuery({ tenantId });
  const automations = (automationsQ.data || []) as unknown as AutomationData[];

  // Target stages for automation form
  const targetStagesQ = trpc.crm.pipelines.stages.useQuery(
    { tenantId, pipelineId: autoForm.targetPipelineId },
    { enabled: autoForm.targetPipelineId > 0 }
  );
  const targetStages = (targetStagesQ.data || []) as unknown as StageData[];

  // Source stages for trigger
  const sourceStagesQ = trpc.crm.pipelines.stages.useQuery(
    { tenantId, pipelineId: autoForm.sourcePipelineId },
    { enabled: autoForm.sourcePipelineId > 0 && autoForm.triggerEvent === "stage_reached" }
  );
  const sourceStages = (sourceStagesQ.data || []) as unknown as StageData[];

  // User default pipeline preference
  const defaultPipelinePref = trpc.preferences.get.useQuery(
    { tenantId, key: "default_pipeline_id" },
    { enabled: !!tenantId }
  );
  const defaultPipelineId = defaultPipelinePref.data?.value ? Number(defaultPipelinePref.data.value) : null;

  // Mutations
  const utils = trpc.useUtils();
  const createPipeline = trpc.crm.pipelines.create.useMutation({
    onSuccess: () => { utils.crm.pipelines.list.invalidate(); setShowPipelineDialog(false); toast.success("Funil criado"); },
  });
  const updatePipeline = trpc.crm.pipelines.update.useMutation({
    onSuccess: () => { utils.crm.pipelines.list.invalidate(); setShowPipelineDialog(false); toast.success("Funil atualizado"); },
  });
  const deletePipeline = trpc.crm.pipelines.delete.useMutation({
    onSuccess: () => {
      utils.crm.pipelines.list.invalidate();
      if (selectedPipelineId === editingPipeline?.id) setSelectedPipelineId(null);
      toast.success("Funil arquivado");
    },
  });
  const createStage = trpc.crm.pipelines.createStage.useMutation({
    onSuccess: () => { utils.crm.pipelines.stages.invalidate(); setShowStageDialog(false); toast.success("Etapa criada"); },
  });
  const updateStage = trpc.crm.pipelines.updateStage.useMutation({
    onSuccess: () => { utils.crm.pipelines.stages.invalidate(); setShowStageDialog(false); toast.success("Etapa atualizada"); },
  });
  const deleteStage = trpc.crm.pipelines.deleteStage.useMutation({
    onSuccess: () => { utils.crm.pipelines.stages.invalidate(); toast.success("Etapa excluída"); },
    onError: (err) => { toast.error(err.message); },
  });
  const reorderStages = trpc.crm.pipelines.reorderStages.useMutation({
    onSuccess: () => { utils.crm.pipelines.stages.invalidate(); },
  });
  const createAutomation = trpc.crm.pipelineAutomations.create.useMutation({
    onSuccess: () => { utils.crm.pipelineAutomations.list.invalidate(); setShowAutoDialog(false); toast.success("Automação criada"); },
  });
  const updateAutomation = trpc.crm.pipelineAutomations.update.useMutation({
    onSuccess: () => { utils.crm.pipelineAutomations.list.invalidate(); setShowAutoDialog(false); toast.success("Automação atualizada"); },
  });
  const deleteAutomation = trpc.crm.pipelineAutomations.delete.useMutation({
    onSuccess: () => { utils.crm.pipelineAutomations.list.invalidate(); toast.success("Automação excluída"); },
  });
  const setDefaultPipelineMut = trpc.preferences.set.useMutation({
    onSuccess: () => {
      utils.preferences.get.invalidate({ tenantId, key: "default_pipeline_id" });
      toast.success("Funil padrão definido!");
    },
  });

  // Auto-select first pipeline
  if (!selectedPipelineId && activePipelines.length > 0) {
    setSelectedPipelineId(activePipelines[0].id);
  }

  /* ─── Handlers ─── */
  function openCreatePipeline() {
    setEditingPipeline(null);
    setPipelineForm({ name: "", description: "", color: "#10b981", pipelineType: "sales" });
    setShowPipelineDialog(true);
  }
  function openEditPipeline(p: PipelineData) {
    setEditingPipeline(p);
    setPipelineForm({ name: p.name, description: p.description || "", color: p.color || "#10b981", pipelineType: p.pipelineType });
    setShowPipelineDialog(true);
  }
  function savePipeline() {
    if (!pipelineForm.name.trim()) return;
    if (editingPipeline) {
      updatePipeline.mutate({ tenantId, id: editingPipeline.id, ...pipelineForm });
    } else {
      createPipeline.mutate({ tenantId, ...pipelineForm, pipelineType: pipelineForm.pipelineType as any });
    }
  }

  function openCreateStage() {
    if (!selectedPipelineId) return;
    setEditingStage(null);
    setStageForm({ name: "", color: STAGE_COLORS[sortedStages.length % STAGE_COLORS.length], probabilityDefault: 0, isWon: false, isLost: false });
    setShowStageDialog(true);
  }
  function openEditStage(s: StageData) {
    setEditingStage(s);
    setStageForm({ name: s.name, color: s.color || "#10b981", probabilityDefault: s.probabilityDefault || 0, isWon: !!s.isWon, isLost: !!s.isLost });
    setShowStageDialog(true);
  }
  function saveStage() {
    if (!stageForm.name.trim() || !selectedPipelineId) return;
    if (editingStage) {
      updateStage.mutate({ tenantId, id: editingStage.id, ...stageForm });
    } else {
      createStage.mutate({ tenantId, pipelineId: selectedPipelineId, ...stageForm, orderIndex: sortedStages.length });
    }
  }
  function moveStage(stageId: number, direction: "up" | "down") {
    const idx = sortedStages.findIndex(s => s.id === stageId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedStages.length) return;
    const newOrders = sortedStages.map((s, i) => {
      if (i === idx) return { id: s.id, orderIndex: swapIdx };
      if (i === swapIdx) return { id: s.id, orderIndex: idx };
      return { id: s.id, orderIndex: i };
    });
    reorderStages.mutate({ tenantId, pipelineId: selectedPipelineId!, stageOrders: newOrders });
  }

  function openCreateAutomation() {
    setEditingAuto(null);
    setAutoForm({
      name: "", sourcePipelineId: activePipelines[0]?.id || 0, triggerEvent: "deal_won",
      triggerStageId: undefined, targetPipelineId: activePipelines[1]?.id || activePipelines[0]?.id || 0,
      targetStageId: 0, copyProducts: true, copyParticipants: true, copyCustomFields: true,
    });
    setShowAutoDialog(true);
  }
  function openEditAutomation(a: AutomationData) {
    setEditingAuto(a);
    setAutoForm({
      name: a.name, sourcePipelineId: a.sourcePipelineId, triggerEvent: a.triggerEvent,
      triggerStageId: a.triggerStageId || undefined,
      targetPipelineId: a.targetPipelineId, targetStageId: a.targetStageId,
      copyProducts: !!a.copyProducts, copyParticipants: !!a.copyParticipants, copyCustomFields: !!a.copyCustomFields,
    });
    setShowAutoDialog(true);
  }
  function saveAutomation() {
    if (!autoForm.name.trim() || !autoForm.sourcePipelineId || !autoForm.targetPipelineId || !autoForm.targetStageId) return;
    if (editingAuto) {
      updateAutomation.mutate({ tenantId, id: editingAuto.id, ...autoForm });
    } else {
      createAutomation.mutate({ tenantId, ...autoForm, triggerEvent: autoForm.triggerEvent as any });
    }
  }
  function toggleAutomation(a: AutomationData) {
    updateAutomation.mutate({ tenantId, id: a.id, isActive: !a.isActive });
  }

  const selectedPipeline = activePipelines.find(p => p.id === selectedPipelineId);

  return (
    <div className="page-content max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setLocation("/settings")} className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-accent transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{
          background: "linear-gradient(135deg, oklch(0.55 0.25 160), oklch(0.60 0.20 200))"
        }}>
          <GitBranch className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Funis & Etapas</h1>
          <p className="text-[13px] text-muted-foreground">Gerencie funis de vendas, pós-venda e automações</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-muted/40 w-fit">
        <button
          onClick={() => setActiveTab("pipelines")}
          className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${activeTab === "pipelines" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <GitBranch className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />Funis & Etapas
        </button>
        <button
          onClick={() => setActiveTab("automations")}
          className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${activeTab === "automations" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Zap className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />Automações
        </button>
      </div>

      {activeTab === "pipelines" && (
        <div className="flex gap-6">
          {/* Pipeline list sidebar */}
          <div className="w-[260px] shrink-0 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Funis</h3>
              <Button size="sm" variant="ghost" onClick={openCreatePipeline} className="h-7 px-2">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {activePipelines.map(p => {
              const isDefault = defaultPipelineId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPipelineId(p.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all group ${
                    selectedPipelineId === p.id
                      ? "bg-primary/10 border border-primary/20"
                      : "surface hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: p.color || "#10b981" }} />
                    <span className="text-[13px] font-medium text-foreground truncate flex-1">{p.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDefaultPipelineMut.mutate({ tenantId, key: "default_pipeline_id", value: String(p.id) });
                      }}
                      className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isDefault
                          ? "text-amber-400"
                          : "text-muted-foreground/30 hover:text-amber-400 opacity-0 group-hover:opacity-100"
                      }`}
                      title={isDefault ? "Funil padrão" : "Definir como funil padrão"}
                    >
                      <Star className={`h-3.5 w-3.5 ${isDefault ? "fill-amber-400" : ""}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 ml-5">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${PIPELINE_TYPES[p.pipelineType]?.color || "bg-muted text-muted-foreground"}`}>
                      {PIPELINE_TYPES[p.pipelineType]?.label || p.pipelineType}
                    </span>
                    {isDefault && <span className="text-[10px] text-amber-500 font-semibold">Padrão</span>}
                  </div>
                  <div className="flex gap-1 mt-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); openEditPipeline(p); }} className="h-6 w-6 rounded flex items-center justify-center hover:bg-accent">
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deletePipeline.mutate({ tenantId, id: p.id }); }} className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/10">
                      <Archive className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                </button>
              );
            })}
            {activePipelines.length === 0 && (
              <div className="text-center py-8">
                <p className="text-[13px] text-muted-foreground">Nenhum funil criado</p>
                <Button size="sm" variant="outline" onClick={openCreatePipeline} className="mt-3">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Criar Funil
                </Button>
              </div>
            )}
          </div>

          {/* Stage editor */}
          <div className="flex-1 min-w-0">
            {selectedPipeline ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{selectedPipeline.name}</h2>
                    {selectedPipeline.description && (
                      <p className="text-[13px] text-muted-foreground mt-0.5">{selectedPipeline.description}</p>
                    )}
                  </div>
                  <Button size="sm" onClick={openCreateStage}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Nova Etapa
                  </Button>
                </div>

                {/* Stage pipeline visualization */}
                <div className="flex gap-0 mb-6 overflow-x-auto pb-2">
                  {sortedStages.map((s, i) => (
                    <div
                      key={s.id}
                      className="relative flex-1 min-w-[120px]"
                    >
                      <div
                        className="h-12 flex items-center justify-center text-white text-[12px] font-medium px-3 truncate"
                        style={{
                          backgroundColor: s.color || STAGE_COLORS[i % STAGE_COLORS.length],
                          clipPath: i === 0
                            ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)"
                            : i === sortedStages.length - 1
                            ? "polygon(12px 0, 100% 0, 100% 100%, 0 100%, 12px 50%)"
                            : "polygon(12px 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)",
                        }}
                      >
                        {s.name}
                      </div>
                      <div className="text-center mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {s.probabilityDefault || 0}%
                          {s.isWon ? " · Ganho" : s.isLost ? " · Perdido" : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Stage list */}
                <div className="space-y-1.5">
                  {sortedStages.map((s, i) => (
                    <div key={s.id} className="surface flex items-center gap-3 p-3 group">
                      <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                      <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: s.color || STAGE_COLORS[i % STAGE_COLORS.length] }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-medium text-foreground">{s.name}</span>
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">Prob: {s.probabilityDefault || 0}%</span>
                          {s.isWon ? <span className="text-[11px] text-emerald-400 font-medium">Etapa de Ganho</span> : null}
                          {s.isLost ? <span className="text-[11px] text-red-400 font-medium">Etapa de Perda</span> : null}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button disabled={i === 0} onClick={() => moveStage(s.id, "up")} className="h-7 w-7 rounded flex items-center justify-center hover:bg-accent disabled:opacity-30">
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button disabled={i === sortedStages.length - 1} onClick={() => moveStage(s.id, "down")} className="h-7 w-7 rounded flex items-center justify-center hover:bg-accent disabled:opacity-30">
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => openEditStage(s)} className="h-7 w-7 rounded flex items-center justify-center hover:bg-accent">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => deleteStage.mutate({ tenantId, id: s.id })} className="h-7 w-7 rounded flex items-center justify-center hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {sortedStages.length === 0 && (
                    <div className="text-center py-12 surface">
                      <p className="text-[13px] text-muted-foreground mb-3">Nenhuma etapa neste funil</p>
                      <Button size="sm" variant="outline" onClick={openCreateStage}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Criar Primeira Etapa
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-20">
                <GitBranch className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-[15px] text-muted-foreground">Selecione um funil para editar suas etapas</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "automations" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Automações de Transição</h2>
              <p className="text-[13px] text-muted-foreground">Configure transições automáticas entre funis</p>
            </div>
            <Button size="sm" onClick={openCreateAutomation}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nova Automação
            </Button>
          </div>

          {/* Info card */}
          <div className="surface p-4 mb-6 border-l-4 border-primary/50">
            <div className="flex gap-3">
              <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-medium text-foreground">Como funciona?</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Quando uma negociação é marcada como <strong>ganha</strong> ou <strong>perdida</strong> em um funil de origem,
                  o sistema cria automaticamente uma nova negociação no funil de destino, copiando contato, produtos e participantes conforme configurado.
                  Ideal para mover vendas ganhas para um funil de pós-venda/viagens.
                </p>
              </div>
            </div>
          </div>

          {/* Automations list */}
          <div className="space-y-3">
            {automations.map(a => {
              const sourcePipeline = pipelines.find(p => p.id === a.sourcePipelineId);
              const targetPipeline = pipelines.find(p => p.id === a.targetPipelineId);
              return (
                <div key={a.id} className="surface p-4 group">
                  <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${a.isActive ? "bg-primary/15" : "bg-muted"}`}>
                      <Zap className={`h-5 w-5 ${a.isActive ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-foreground">{a.name}</span>
                        {!a.isActive && <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Inativa</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[12px] px-2 py-1 rounded-lg bg-accent/50 text-foreground">
                          {sourcePipeline?.name || "—"}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-medium">
                          {TRIGGER_EVENTS[a.triggerEvent] || a.triggerEvent}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[12px] px-2 py-1 rounded-lg bg-accent/50 text-foreground">
                          {targetPipeline?.name || "—"}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-2">
                        {a.copyProducts ? <span className="text-[11px] text-muted-foreground">📦 Produtos</span> : null}
                        {a.copyParticipants ? <span className="text-[11px] text-muted-foreground">👥 Participantes</span> : null}
                        {a.copyCustomFields ? <span className="text-[11px] text-muted-foreground">📋 Campos</span> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!a.isActive} onCheckedChange={() => toggleAutomation(a)} />
                      <button onClick={() => openEditAutomation(a)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => deleteAutomation.mutate({ tenantId, id: a.id })} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {automations.length === 0 && (
              <div className="text-center py-16 surface">
                <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-[15px] text-muted-foreground mb-1">Nenhuma automação configurada</p>
                <p className="text-[12px] text-muted-foreground mb-4">Crie automações para mover negociações entre funis automaticamente</p>
                <Button size="sm" variant="outline" onClick={openCreateAutomation}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Criar Automação
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Pipeline Dialog ─── */}
      <Dialog open={showPipelineDialog} onOpenChange={setShowPipelineDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingPipeline ? "Editar Funil" : "Novo Funil"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome do Funil</Label>
              <Input value={pipelineForm.name} onChange={e => setPipelineForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Funil de Vendas" className="mt-1" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={pipelineForm.description} onChange={e => setPipelineForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição opcional" className="mt-1" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={pipelineForm.pipelineType} onValueChange={v => setPipelineForm(f => ({ ...f, pipelineType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Vendas</SelectItem>
                    <SelectItem value="post_sale">Pós-Venda</SelectItem>
                    <SelectItem value="support">Suporte</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {STAGE_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setPipelineForm(f => ({ ...f, color: c }))}
                      className={`h-7 w-7 rounded-full border-2 transition-all ${pipelineForm.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPipelineDialog(false)}>Cancelar</Button>
            <Button onClick={savePipeline} disabled={!pipelineForm.name.trim() || createPipeline.isPending || updatePipeline.isPending}>
              {(createPipeline.isPending || updatePipeline.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {editingPipeline ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Stage Dialog ─── */}
      <Dialog open={showStageDialog} onOpenChange={setShowStageDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingStage ? "Editar Etapa" : "Nova Etapa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome da Etapa</Label>
              <Input value={stageForm.name} onChange={e => setStageForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Qualificação" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Probabilidade (%)</Label>
                <Input type="number" min={0} max={100} value={stageForm.probabilityDefault} onChange={e => setStageForm(f => ({ ...f, probabilityDefault: Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {STAGE_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setStageForm(f => ({ ...f, color: c }))}
                      className={`h-6 w-6 rounded-full border-2 transition-all ${stageForm.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={stageForm.isWon} onCheckedChange={v => setStageForm(f => ({ ...f, isWon: v, isLost: v ? false : f.isLost }))} />
                <span className="text-[13px] text-foreground">Etapa de Ganho</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={stageForm.isLost} onCheckedChange={v => setStageForm(f => ({ ...f, isLost: v, isWon: v ? false : f.isWon }))} />
                <span className="text-[13px] text-foreground">Etapa de Perda</span>
              </label>
            </div>
            {(stageForm.isWon || stageForm.isLost) && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-300">
                  {stageForm.isWon
                    ? "Negociações nesta etapa serão marcadas como ganhas. Automações de 'Venda Ganha' serão disparadas."
                    : "Negociações nesta etapa serão marcadas como perdidas."}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStageDialog(false)}>Cancelar</Button>
            <Button onClick={saveStage} disabled={!stageForm.name.trim() || createStage.isPending || updateStage.isPending}>
              {(createStage.isPending || updateStage.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {editingStage ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Automation Dialog ─── */}
      <Dialog open={showAutoDialog} onOpenChange={setShowAutoDialog}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editingAuto ? "Editar Automação" : "Nova Automação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome da Automação</Label>
              <Input value={autoForm.name} onChange={e => setAutoForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Venda → Pós-Venda" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Funil de Origem</Label>
                <Select value={String(autoForm.sourcePipelineId)} onValueChange={v => setAutoForm(f => ({ ...f, sourcePipelineId: Number(v) }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {activePipelines.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Evento Gatilho</Label>
                <Select value={autoForm.triggerEvent} onValueChange={v => setAutoForm(f => ({ ...f, triggerEvent: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deal_won">Venda Ganha</SelectItem>
                    <SelectItem value="deal_lost">Venda Perdida</SelectItem>
                    <SelectItem value="stage_reached">Etapa Alcançada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {autoForm.triggerEvent === "stage_reached" && (
              <div>
                <Label>Etapa Gatilho</Label>
                <Select value={String(autoForm.triggerStageId || "")} onValueChange={v => setAutoForm(f => ({ ...f, triggerStageId: Number(v) }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                  <SelectContent>
                    {sourceStages.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Funil de Destino</Label>
                <Select value={String(autoForm.targetPipelineId)} onValueChange={v => setAutoForm(f => ({ ...f, targetPipelineId: Number(v), targetStageId: 0 }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {activePipelines.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Etapa Inicial no Destino</Label>
                <Select value={String(autoForm.targetStageId || "")} onValueChange={v => setAutoForm(f => ({ ...f, targetStageId: Number(v) }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {targetStages.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">O que copiar para a nova negociação?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={autoForm.copyProducts} onCheckedChange={v => setAutoForm(f => ({ ...f, copyProducts: v }))} />
                  <span className="text-[13px]">Produtos</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={autoForm.copyParticipants} onCheckedChange={v => setAutoForm(f => ({ ...f, copyParticipants: v }))} />
                  <span className="text-[13px]">Participantes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={autoForm.copyCustomFields} onCheckedChange={v => setAutoForm(f => ({ ...f, copyCustomFields: v }))} />
                  <span className="text-[13px]">Campos</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoDialog(false)}>Cancelar</Button>
            <Button onClick={saveAutomation} disabled={!autoForm.name.trim() || !autoForm.targetStageId || createAutomation.isPending || updateAutomation.isPending}>
              {(createAutomation.isPending || updateAutomation.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {editingAuto ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
