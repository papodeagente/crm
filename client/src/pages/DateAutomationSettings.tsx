import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTenantId } from "@/hooks/useTenantId";
import { useLocation } from "wouter";
import { AdminOnlyGuard } from "@/components/AdminOnlyGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, CalendarClock,
  Play, Clock, ArrowRight, Filter, Zap,
} from "lucide-react";

const DATE_FIELD_OPTIONS = [
  { value: "boardingDate", label: "Data do embarque" },
  { value: "returnDate", label: "Data do retorno" },
  { value: "expectedCloseAt", label: "Data de fechamento prevista" },
  { value: "createdAt", label: "Data de criação" },
];

const CONDITION_OPTIONS = [
  { value: "days_before", label: "Dias antes da data" },
  { value: "days_after", label: "Dias depois da data" },
  { value: "on_date", label: "No dia exato" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "open", label: "Em andamento" },
  { value: "won", label: "Ganho" },
  { value: "lost", label: "Perdido" },
];

interface AutomationFormData {
  name: string;
  description: string;
  pipelineId: number;
  dateField: string;
  condition: string;
  offsetDays: number;
  sourceStageId: number | null;
  targetStageId: number;
  dealStatusFilter: string | null;
  isActive: boolean;
}

const defaultFormData: AutomationFormData = {
  name: "",
  description: "",
  pipelineId: 0,
  dateField: "boardingDate",
  condition: "days_before",
  offsetDays: 30,
  sourceStageId: null,
  targetStageId: 0,
  dealStatusFilter: "open",
  isActive: true,
};

export default function DateAutomationSettings() {
  const [, setLocation] = useLocation();
  const tenantId = useTenantId();
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AutomationFormData>({ ...defaultFormData });
  const [selectedPipelineFilter, setSelectedPipelineFilter] = useState<string>("all");

  // Queries
  const { data: automations = [], refetch } = trpc.crm.dateAutomations.list.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId }
  );
  const { data: pipelinesRaw = [] } = trpc.crm.pipelines.list.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId }
  );
  const pipelines = pipelinesRaw.filter((p: any) => !p.isArchived);

  // Get stages for selected pipeline in form
  const { data: formStages = [] } = trpc.crm.pipelines.stages.useQuery(
    { tenantId: tenantId!, pipelineId: form.pipelineId },
    { enabled: !!tenantId && form.pipelineId > 0 }
  );

  // Mutations
  const createMut = trpc.crm.dateAutomations.create.useMutation({
    onSuccess: () => { toast.success("Automação criada com sucesso"); refetch(); setShowDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.crm.dateAutomations.update.useMutation({
    onSuccess: () => { toast.success("Automação atualizada"); refetch(); setShowDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.crm.dateAutomations.delete.useMutation({
    onSuccess: () => { toast.success("Automação excluída"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const runNowMut = trpc.crm.dateAutomations.runNow.useMutation({
    onSuccess: (result) => {
      toast.success(`Executado: ${result.moved} negociações movidas (${result.errors} erros)`);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Filter automations by pipeline
  const filteredAutomations = useMemo(() => {
    if (selectedPipelineFilter === "all") return automations;
    return automations.filter((a: any) => a.pipelineId === Number(selectedPipelineFilter));
  }, [automations, selectedPipelineFilter]);

  // Helper: get pipeline name
  const getPipelineName = (pipelineId: number) => {
    const p = pipelines.find((p: any) => p.id === pipelineId);
    return p?.name || "—";
  };

  // Helper: get stage name
  const getStageName = (stageId: number | null) => {
    if (!stageId) return "Qualquer etapa";
    // We need to find the stage across all pipelines
    return `Etapa #${stageId}`;
  };

  // Helper: format condition text
  const formatCondition = (auto: any) => {
    const dateLabel = DATE_FIELD_OPTIONS.find(d => d.value === auto.dateField)?.label || auto.dateField;
    if (auto.condition === "on_date") return `No dia da ${dateLabel}`;
    if (auto.condition === "days_before") return `${auto.offsetDays} dias antes da ${dateLabel}`;
    return `${auto.offsetDays} dias depois da ${dateLabel}`;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...defaultFormData, pipelineId: pipelines[0]?.id || 0 });
    setShowDialog(true);
  };

  const openEdit = (auto: any) => {
    setEditingId(auto.id);
    setForm({
      name: auto.name,
      description: auto.description || "",
      pipelineId: auto.pipelineId,
      dateField: auto.dateField,
      condition: auto.condition,
      offsetDays: auto.offsetDays,
      sourceStageId: auto.sourceStageId,
      targetStageId: auto.targetStageId,
      dealStatusFilter: auto.dealStatusFilter,
      isActive: auto.isActive,
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!tenantId) return;
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    if (!form.pipelineId) return toast.error("Selecione um funil");
    if (!form.targetStageId) return toast.error("Selecione a etapa de destino");

    if (editingId) {
      updateMut.mutate({
        tenantId,
        id: editingId,
        name: form.name,
        description: form.description || undefined,
        dateField: form.dateField as any,
        condition: form.condition as any,
        offsetDays: form.offsetDays,
        sourceStageId: form.sourceStageId,
        targetStageId: form.targetStageId,
        dealStatusFilter: form.dealStatusFilter as any,
        isActive: form.isActive,
      });
    } else {
      createMut.mutate({
        tenantId,
        name: form.name,
        description: form.description || undefined,
        pipelineId: form.pipelineId,
        dateField: form.dateField as any,
        condition: form.condition as any,
        offsetDays: form.offsetDays,
        sourceStageId: form.sourceStageId || undefined,
        targetStageId: form.targetStageId,
        dealStatusFilter: form.dealStatusFilter as any,
        isActive: form.isActive,
      });
    }
  };

  const handleToggle = (auto: any) => {
    if (!tenantId) return;
    updateMut.mutate({
      tenantId,
      id: auto.id,
      isActive: !auto.isActive,
    });
  };

  if (!tenantId) return null;

  return (
    <AdminOnlyGuard pageTitle="Automações por data">
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")} style={{ pointerEvents: "auto" }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarClock className="h-6 w-6 text-primary" />
              Automações por Data
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Mova negociações automaticamente entre etapas com base em datas (embarque, retorno, etc.)
            </p>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Select value={selectedPipelineFilter} onValueChange={setSelectedPipelineFilter}>
              <SelectTrigger className="w-[220px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por funil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os funis</SelectItem>
                {pipelines.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-xs">
              {filteredAutomations.length} automação(ões)
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runNowMut.mutate({ tenantId: tenantId! })}
              disabled={runNowMut.isPending}
            >
              <Play className="h-4 w-4 mr-1" />
              {runNowMut.isPending ? "Executando..." : "Executar agora"}
            </Button>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nova automação
            </Button>
          </div>
        </div>

        {/* Automations List */}
        {filteredAutomations.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma automação por data</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie regras para mover negociações automaticamente com base em datas como embarque ou retorno.
              </p>
              <Button onClick={openCreate} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Criar primeira automação
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredAutomations.map((auto: any) => (
              <Card key={auto.id} className={`transition-all ${!auto.isActive ? "opacity-60" : ""}`}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className={`h-4 w-4 ${auto.isActive ? "text-amber-500" : "text-muted-foreground"}`} />
                        <h3 className="font-semibold text-sm truncate">{auto.name}</h3>
                        <Badge variant={auto.isActive ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {auto.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      {auto.description && (
                        <p className="text-xs text-muted-foreground mb-2 truncate">{auto.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{getPipelineName(auto.pipelineId)}</Badge>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatCondition(auto)}
                        </span>
                        <ArrowRight className="h-3 w-3" />
                        <span>Mover para etapa #{auto.targetStageId}</span>
                        {auto.dealStatusFilter && (
                          <Badge variant="outline" className="text-[10px]">
                            {STATUS_FILTER_OPTIONS.find(s => s.value === auto.dealStatusFilter)?.label}
                          </Badge>
                        )}
                      </div>
                      {auto.lastRunAt && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Última execução: {new Date(auto.lastRunAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={auto.isActive}
                        onCheckedChange={() => handleToggle(auto)}
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(auto)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Excluir esta automação?")) {
                            deleteMut.mutate({ tenantId: tenantId!, id: auto.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Card */}
        <Card className="mt-8 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Como funciona
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>As automações por data verificam periodicamente (a cada hora) as negociações e movem automaticamente para a etapa configurada quando a condição de data é atendida.</p>
            <p><strong>Exemplo:</strong> "30 dias antes da data de embarque → mover para etapa 30D para embarque". Quando faltar 30 dias ou menos para o embarque, a negociação será movida automaticamente.</p>
            <p>Você também pode executar manualmente clicando em "Executar agora" para processar todas as automações imediatamente.</p>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              {editingId ? "Editar automação" : "Nova automação por data"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <Label>Nome da automação *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Mover para 30D antes do embarque"
              />
            </div>

            {/* Description */}
            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descreva o que esta automação faz"
              />
            </div>

            <Separator />

            {/* Pipeline */}
            <div>
              <Label>Funil *</Label>
              <Select
                value={form.pipelineId ? String(form.pipelineId) : ""}
                onValueChange={(v) => setForm(f => ({ ...f, pipelineId: Number(v), sourceStageId: null, targetStageId: 0 }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funil" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Field */}
            <div>
              <Label>Campo de data de referência *</Label>
              <Select
                value={form.dateField}
                onValueChange={(v) => setForm(f => ({ ...f, dateField: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FIELD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Condition */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Condição *</Label>
                <Select
                  value={form.condition}
                  onValueChange={(v) => setForm(f => ({ ...f, condition: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dias {form.condition === "on_date" ? "(ignorado)" : ""}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.offsetDays}
                  onChange={(e) => setForm(f => ({ ...f, offsetDays: Number(e.target.value) }))}
                  disabled={form.condition === "on_date"}
                />
              </div>
            </div>

            <Separator />

            {/* Source Stage (optional) */}
            <div>
              <Label>Etapa de origem (opcional)</Label>
              <p className="text-xs text-muted-foreground mb-1">Se vazio, aplica a qualquer etapa do funil</p>
              <Select
                value={form.sourceStageId ? String(form.sourceStageId) : "any"}
                onValueChange={(v) => setForm(f => ({ ...f, sourceStageId: v === "any" ? null : Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer etapa</SelectItem>
                  {formStages.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Stage */}
            <div>
              <Label>Etapa de destino *</Label>
              <Select
                value={form.targetStageId ? String(form.targetStageId) : ""}
                onValueChange={(v) => setForm(f => ({ ...f, targetStageId: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {formStages.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deal Status Filter */}
            <div>
              <Label>Filtrar por status da negociação</Label>
              <Select
                value={form.dealStatusFilter || "any"}
                onValueChange={(v) => setForm(f => ({ ...f, dealStatusFilter: v === "any" ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer status</SelectItem>
                  {STATUS_FILTER_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <Label>Automação ativa</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {(createMut.isPending || updateMut.isPending) ? "Salvando..." : editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AdminOnlyGuard>
  );
}
