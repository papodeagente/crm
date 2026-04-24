import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ClipboardList, MapPin, Calendar, User, DollarSign, ArrowRight, ChevronRight, Settings, Loader2, MoreHorizontal, Eye } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useLocation, Link } from "wouter";
import { formatDateShort } from "../../../shared/dateUtils";


/* ─── Types ─── */
interface StageData {
  id: number; name: string; color: string | null; orderIndex: number;
  probabilityDefault: number | null; isWon: number | boolean; isLost: number | boolean;
}
interface DealData {
  id: number; name: string; valueCents: number | null; status: string;
  stageId: number | null; contactId: number | null; contactName?: string;
  createdAt: string; updatedAt: string;
}

function formatCurrency(cents: number | null) {
  if (!cents) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return formatDateShort(d) || "—";
}

export default function ServiceDelivery() {
  const [, setLocation] = useLocation();

  // Find the post_sale pipeline
  const pipelinesQ = trpc.crm.pipelines.list.useQuery({});
  const pipelines = (pipelinesQ.data || []) as any[];
  const postSalePipeline = useMemo(() => {
    return pipelines.find((p: any) => p.pipelineType === "post_sale" && !p.isArchived) || pipelines.find((p: any) => !p.isArchived);
  }, [pipelines]);

  const pipelineId = postSalePipeline?.id;

  // Stages
  const stagesQ = trpc.crm.pipelines.stages.useQuery(
    { pipelineId: pipelineId! },
    { enabled: !!pipelineId }
  );
  const stages = useMemo(() => {
    const raw = (stagesQ.data || []) as unknown as StageData[];
    return [...raw].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [stagesQ.data]);

  // Deals in this pipeline
  const dealsQ = trpc.crm.deals.list.useQuery({});
  const allDeals = (dealsQ.data || []) as unknown as DealData[];
  const pipelineDeals = useMemo(() => {
    if (!pipelineId) return [];
    const stageIds = new Set(stages.map(s => s.id));
    return allDeals.filter(d => d.stageId && stageIds.has(d.stageId) && d.status === "open");
  }, [allDeals, stages, pipelineId]);

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const map: Record<number, DealData[]> = {};
    stages.forEach(s => { map[s.id] = []; });
    pipelineDeals.forEach(d => {
      if (d.stageId && map[d.stageId]) map[d.stageId].push(d);
    });
    return map;
  }, [pipelineDeals, stages]);

  // Move deal mutation
  const utils = trpc.useUtils();
  const moveDeal = trpc.crm.deals.moveStage.useMutation({
    onSuccess: () => {
      utils.crm.deals.list.invalidate();
      toast.success("Negociação movida");
    },
  });

  // Create deal dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newDealName, setNewDealName] = useState("");
  const [newDealStage, setNewDealStage] = useState<number>(0);
  const createDeal = trpc.crm.deals.create.useMutation({
    onSuccess: () => {
      utils.crm.deals.list.invalidate();
      setShowCreate(false);
      setNewDealName("");
      toast.success("Negociacao criada no pos-venda");
    },
  });

  // Pipeline selector for multiple post-sale pipelines
  const postSalePipelines = useMemo(() => pipelines.filter((p: any) => p.pipelineType === "post_sale" && !p.isArchived), [pipelines]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const activePipelineId = selectedPipelineId || pipelineId;

  // No pipeline found
  if (pipelinesQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!postSalePipeline) {
    return (
      <div className="page-content max-w-2xl mx-auto text-center py-20">
        <div className="h-16 w-16 rounded-2xl bg-sky-500/15 flex items-center justify-center mx-auto mb-4">
          <ClipboardList className="h-8 w-8 text-sky-400" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Funil de Pos-Venda nao configurado</h2>
        <p className="text-[13px] text-muted-foreground mb-6 max-w-md mx-auto">
          Para usar a gestao de Servicos, crie um funil do tipo <strong>"Pos-Venda"</strong> em Configuracoes &gt; Funis & Etapas,
          com as etapas da jornada do cliente (Agendamento, Execucao, Acompanhamento, etc.).
        </p>
        <Button onClick={() => setLocation("/settings/pipelines")} className="gap-2">
          <Settings className="h-4 w-4" /> Configurar Funis
        </Button>
      </div>
    );
  }

  return (
    <div className="p-5 lg:px-6 space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{
            background: "linear-gradient(135deg, oklch(0.55 0.20 220), oklch(0.60 0.20 260))"
          }}>
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Servicos — Pos-Venda</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Funil: <strong>{postSalePipeline.name}</strong> · {pipelineDeals.length} negociações ativas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocation("/settings/pipelines")} className="gap-1.5 h-8">
            <Settings className="h-3.5 w-3.5" /> Etapas
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 h-8">
                <Plus className="h-3.5 w-3.5" /> Novo Servico
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Nova Negociacao de Servico</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Nome / Servico</Label>
                  <Input value={newDealName} onChange={e => setNewDealName(e.target.value)} placeholder="Ex: Limpeza de Pele - Joao Silva" className="mt-1" />
                </div>
                <div>
                  <Label>Etapa Inicial</Label>
                  <Select value={String(newDealStage || stages[0]?.id || "")} onValueChange={v => setNewDealStage(Number(v))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {stages.filter(s => !s.isWon && !s.isLost).map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
                <Button
                  disabled={!newDealName.trim() || createDeal.isPending}
                  onClick={() => {
                    const stageId = newDealStage || stages[0]?.id;
                    if (!stageId || !pipelineId) return;
                    createDeal.mutate({
                      title: newDealName,
                      stageId,
                      pipelineId,
                    });
                  }}
                >
                  {createDeal.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-3 h-full min-h-[500px]" style={{ minWidth: `${stages.length * 280}px` }}>
          {stages.map((stage, i) => {
            const stageDeals = dealsByStage[stage.id] || [];
            const stageTotal = stageDeals.reduce((sum, d) => sum + (d.valueCents || 0), 0);
            const nextStage = stages[i + 1];

            return (
              <div key={stage.id} className="flex-1 min-w-[260px] max-w-[320px] flex flex-col">
                {/* Stage header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color || "#10b981" }} />
                  <span className="text-[13px] font-semibold text-foreground truncate">{stage.name}</span>
                  <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                    {stageDeals.length} · {formatCurrency(stageTotal)}
                  </span>
                </div>

                {/* Cards container */}
                <div className="flex-1 space-y-2 overflow-y-auto pr-1 pb-2">
                  {stageDeals.map(deal => (
                    <div
                      key={deal.id}
                      className="surface p-3 cursor-pointer hover:bg-accent/30 transition-all group"
                      onClick={() => setLocation(`/deal/${deal.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13px] font-medium text-foreground leading-snug">{deal.name}</span>
                        <Eye className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                      </div>
                      {deal.contactName && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground truncate">{deal.contactName}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[12px] font-medium text-foreground">
                          {formatCurrency(deal.valueCents)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(deal.createdAt)}</span>
                      </div>
                      {/* Quick move to next stage */}
                      {nextStage && !stage.isWon && !stage.isLost && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveDeal.mutate({
                              dealId: deal.id,
                              fromStageId: stage.id,
                              toStageId: nextStage.id,
                              fromStageName: stage.name,
                              toStageName: nextStage.name,
                            });
                          }}
                          className="mt-2 w-full flex items-center justify-center gap-1 py-1 rounded-md text-[11px] text-primary/70 hover:text-primary hover:bg-primary/5 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <ArrowRight className="h-3 w-3" />
                          Mover para {nextStage.name}
                        </button>
                      )}
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <div className="flex items-center justify-center h-24 rounded-xl border border-dashed border-border/40">
                      <p className="text-[11px] text-muted-foreground/50">Nenhuma negociação</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary bar */}
      <div className="shrink-0 flex items-center gap-6 py-3 px-4 rounded-xl bg-muted/30 border border-border/20">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground">Total ativo:</span>
          <span className="text-[13px] font-semibold text-foreground">{pipelineDeals.length} negociações</span>
        </div>
        <div className="h-4 w-px bg-border/30" />
        <div className="flex items-center gap-2">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[13px] font-semibold text-foreground">
            {formatCurrency(pipelineDeals.reduce((sum, d) => sum + (d.valueCents || 0), 0))}
          </span>
        </div>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" className="text-[12px] h-7 gap-1" onClick={() => setLocation("/settings/pipelines")}>
            <Settings className="h-3 w-3" /> Configurar Etapas
          </Button>
        </div>
      </div>
    </div>
  );
}
