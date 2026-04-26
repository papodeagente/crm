/**
 * SidebarDeals — Deal list with vertical stepper funnel + inline actions
 */
import { useState, useEffect, useMemo } from "react";
import {
  Plus, ChevronDown, ChevronRight, Briefcase, Pencil, Package, Users,
  Paperclip, ThumbsUp, ThumbsDown, Loader2, Trophy, XCircle, ExternalLink,
  Check, MessageCircle, Phone, Mail, ClipboardList, MoreHorizontal,
  GitBranch, ArrowRightLeft, ArrowRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import TaskFormDialog from "@/components/TaskFormDialog";
import TaskActionPopover from "@/components/TaskActionPopover";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const fmt$ = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

interface ContactDeal {
  id: number;
  title: string;
  status: string;
  valueCents: number;
  currency: string;
  probability: number;
  expectedCloseAt: string | null;
  createdAt: string;
  stageName: string | null;
  pipelineName: string | null;
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  open: { label: "Em andamento", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  won: { label: "Ganho", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  lost: { label: "Perdido", color: "bg-red-500/10 text-red-600 dark:text-red-400", dot: "bg-red-500" },
};

// ─── Task type icons ───
const taskTypeIcons: Record<string, any> = {
  whatsapp: MessageCircle, phone: Phone, email: Mail, task: ClipboardList,
};
const priorityColors: Record<string, string> = {
  urgent: "text-red-500", high: "text-orange-500", medium: "text-blue-500", low: "text-muted-foreground",
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

// ─── Deal Tasks Section (embedded in expanded deal) ───
function DealTasksSection({ dealId, dealTitle }: { dealId: number; dealTitle: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [showDone, setShowDone] = useState(false);

  const tasksQ = trpc.crm.tasks.list.useQuery(
    { entityType: "deal", entityId: dealId },
    { enabled: !!dealId, staleTime: 30_000 }
  );
  const allTasks = (tasksQ.data?.tasks || tasksQ.data || []) as any[];
  const pendingTasks = allTasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled");
  const doneTasks = allTasks.filter((t: any) => t.status === "done" || t.status === "cancelled");

  const utils = trpc.useUtils();
  const updateMut = trpc.crm.tasks.update.useMutation({
    onSuccess: () => { utils.crm.tasks.list.invalidate(); },
    onError: (err: any) => toast.error(err.message || "Erro"),
  });

  return (
    <div className="pt-2 border-t border-border/40">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Tarefas ({pendingTasks.length})
        </span>
        <button
          onClick={() => setShowCreate(true)}
          className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Pending tasks */}
      {pendingTasks.length === 0 && doneTasks.length === 0 && (
        <p className="text-[11px] text-muted-foreground text-center py-2">Nenhuma tarefa</p>
      )}
      <div className="space-y-0.5">
        {pendingTasks.map((task: any) => {
          const Icon = taskTypeIcons[task.taskType] || ClipboardList;
          const pColor = priorityColors[task.priority] || priorityColors.medium;
          const isOverdue = task.dueAt && new Date(task.dueAt) < new Date();
          return (
            <div key={task.id} className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-accent/30 transition-colors group">
              <button
                onClick={() => { updateMut.mutate({ id: task.id, status: "done" }); toast.success("Tarefa concluída"); }}
                className="w-4.5 h-4.5 rounded-full border border-border flex items-center justify-center shrink-0 hover:border-emerald-500 hover:bg-emerald-500/10 transition-colors"
              >
                <Check className="w-2.5 h-2.5 text-transparent group-hover:text-emerald-500 transition-colors" />
              </button>
              <Icon className={`w-3 h-3 shrink-0 ${pColor}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-foreground truncate">{task.title}</p>
              </div>
              {task.dueAt && (
                <span className={`text-[9px] font-medium shrink-0 ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
                  {formatRelativeDate(task.dueAt)}
                </span>
              )}
              <TaskActionPopover
                task={task}
                onEdit={() => setEditTask(task)}
                side="left"
              >
                <button className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-opacity">
                  <MoreHorizontal className="w-3 h-3" />
                </button>
              </TaskActionPopover>
            </div>
          );
        })}
      </div>

      {/* Done toggle */}
      {doneTasks.length > 0 && (
        <>
          <button
            onClick={() => setShowDone(!showDone)}
            className="flex items-center gap-1 mt-1 px-1.5 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDone ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Concluídas ({doneTasks.length})
          </button>
          {showDone && (
            <div className="space-y-0.5">
              {doneTasks.map((task: any) => (
                <div key={task.id} className="flex items-center gap-1.5 p-1.5 rounded-lg opacity-50">
                  <div className="w-4.5 h-4.5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-emerald-500" />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate flex-1 line-through">{task.title}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create dialog */}
      <TaskFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        dealId={dealId}
        dealTitle={dealTitle}
        onSuccess={() => tasksQ.refetch()}
      />

      {/* Edit dialog */}
      {editTask && (
        <TaskFormDialog
          open
          onOpenChange={() => setEditTask(null)}
          dealId={dealId}
          dealTitle={dealTitle}
          editTask={editTask}
          onSuccess={() => tasksQ.refetch()}
        />
      )}
    </div>
  );
}

interface DealDetailProps {
  dealId: number;
  // Passados do card resumido porque getDealById nao faz JOIN com pipelines/stages
  pipelineName?: string | null;
  stageName?: string | null;
  onClose: () => void;
  onEdit: (dealId: number) => void;
  onProducts: (dealId: number) => void;
  onParticipants: (dealId: number) => void;
  onFiles: (dealId: number) => void;
  onMarkLost: (dealId: number) => void;
}

function SidebarDealDetail({ dealId, pipelineName, stageName, onClose, onEdit, onProducts, onParticipants, onFiles, onMarkLost }: DealDetailProps) {
  const dealQ = trpc.crm.deals.get.useQuery({ id: dealId }, { enabled: !!dealId });
  const deal = dealQ.data as any;

  const pipelineId = deal?.pipelineId;
  const stagesQ = trpc.crm.pipelines.stages.useQuery(
    { pipelineId: pipelineId! },
    { enabled: !!pipelineId }
  );
  const stages = (stagesQ.data || []) as Array<{ id: number; name: string; color: string | null; orderIndex: number; isWon?: boolean; isLost?: boolean }>;
  const sortedStages = stages.sort((a, b) => a.orderIndex - b.orderIndex);

  const utils = trpc.useUtils();
  const moveStageMut = trpc.crm.deals.moveStage.useMutation({
    onSuccess: () => {
      utils.crm.deals.get.invalidate({ id: dealId });
      utils.contactProfile.getDeals.invalidate();
      utils.contactProfile.getMetrics.invalidate();
      toast.success("Etapa atualizada");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao mover"),
  });

  const winMut = trpc.crm.deals.update.useMutation({
    onSuccess: () => {
      utils.crm.deals.get.invalidate({ id: dealId });
      utils.contactProfile.getDeals.invalidate();
      utils.contactProfile.getMetrics.invalidate();
      toast.success("Negociação marcada como ganha!");
    },
    onError: (err: any) => toast.error(err.message || "Erro"),
  });

  // ─── Trocar funil inline (Popover) ───────────────────────────
  const [changePipelineOpen, setChangePipelineOpen] = useState(false);
  const [targetPipelineId, setTargetPipelineId] = useState<number | null>(null);
  const [targetStageId, setTargetStageId] = useState<number | null>(null);

  const pipelinesQ = trpc.crm.pipelines.list.useQuery({}, { enabled: changePipelineOpen });
  const availablePipelines = useMemo(() => {
    const list = (pipelinesQ.data || []) as Array<{ id: number; name: string; isArchived?: boolean }>;
    return list.filter((p) => !p.isArchived && p.id !== pipelineId);
  }, [pipelinesQ.data, pipelineId]);

  const targetStagesQ = trpc.crm.pipelines.stages.useQuery(
    { pipelineId: targetPipelineId! },
    { enabled: !!targetPipelineId },
  );
  const targetStages = useMemo(() => {
    const list = (targetStagesQ.data || []) as Array<{ id: number; name: string; orderIndex: number }>;
    return [...list].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [targetStagesQ.data]);

  // Pre-seleciona primeira etapa automaticamente quando funil novo é escolhido
  useEffect(() => {
    if (targetPipelineId && targetStages.length > 0) {
      setTargetStageId((prev) => (prev && targetStages.some((s) => s.id === prev) ? prev : targetStages[0].id));
    }
  }, [targetPipelineId, targetStages]);

  const changePipelineMut = trpc.crm.deals.changePipeline.useMutation({
    onSuccess: (_data, vars) => {
      utils.crm.deals.get.invalidate({ id: dealId });
      utils.contactProfile.getDeals.invalidate();
      utils.contactProfile.getMetrics.invalidate();
      toast.success(`Movida pra ${vars.newPipelineName} → ${vars.newStageName}`);
      setChangePipelineOpen(false);
      setTargetPipelineId(null);
      setTargetStageId(null);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao trocar funil"),
  });

  const handleChangePipeline = () => {
    if (!targetPipelineId || !targetStageId) return;
    const pipelineName = availablePipelines.find((p) => p.id === targetPipelineId)?.name || "";
    const stageName = targetStages.find((s) => s.id === targetStageId)?.name || "";
    changePipelineMut.mutate({
      dealId,
      newPipelineId: targetPipelineId,
      newStageId: targetStageId,
      newPipelineName: pipelineName,
      newStageName: stageName,
    });
  };

  if (!deal) return null;

  const currentIdx = sortedStages.findIndex(s => s.id === deal.stageId);

  const handleMoveStage = (stage: typeof sortedStages[0]) => {
    if (stage.id === deal.stageId || moveStageMut.isPending) return;
    moveStageMut.mutate({
      dealId, fromStageId: deal.stageId, toStageId: stage.id,
      fromStageName: deal.stageName || "", toStageName: stage.name,
    });
  };

  return (
    <div className="px-3 py-2 bg-accent/30 rounded-lg mt-1 space-y-3">
      {/* Header: Funil atual + botao Trocar */}
      {pipelineName && (
        <div className="flex items-center justify-between gap-2 -mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <GitBranch className="h-3.5 w-3.5 text-violet-600 shrink-0" />
            <span className="text-[11px] text-muted-foreground shrink-0">Funil:</span>
            <span className="text-[12px] font-semibold text-foreground truncate">{pipelineName}</span>
          </div>
          <Popover open={changePipelineOpen} onOpenChange={(o) => {
            setChangePipelineOpen(o);
            if (!o) { setTargetPipelineId(null); setTargetStageId(null); }
          }}>
            <PopoverTrigger asChild>
              <button
                className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-700 hover:bg-violet-500/10 px-1.5 py-0.5 rounded transition-colors shrink-0"
                title="Mover pra outro funil"
              >
                <ArrowRightLeft className="h-3 w-3" />
                Trocar
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3">
              <div className="space-y-3">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">Mover pra outro funil</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Escolha o funil e a etapa destino.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Novo funil</Label>
                  <Select
                    value={targetPipelineId ? String(targetPipelineId) : ""}
                    onValueChange={(v) => {
                      setTargetPipelineId(Number(v));
                      setTargetStageId(null);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={pipelinesQ.isLoading ? "Carregando..." : "Selecione o funil"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePipelines.length === 0 ? (
                        <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                          Nenhum outro funil disponível
                        </div>
                      ) : (
                        availablePipelines.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {targetPipelineId && (
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Etapa de destino</Label>
                    <Select
                      value={targetStageId ? String(targetStageId) : ""}
                      onValueChange={(v) => setTargetStageId(Number(v))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={targetStagesQ.isLoading ? "Carregando..." : "Selecione a etapa"} />
                      </SelectTrigger>
                      <SelectContent>
                        {targetStages.length === 0 ? (
                          <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                            Esse funil não tem etapas configuradas
                          </div>
                        ) : (
                          targetStages.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {targetPipelineId && targetStageId && (
                  <div className="p-2 rounded-md bg-muted/40 text-[11px] space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span className="font-medium">De:</span>
                      <span>{pipelineName} / {stageName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-foreground">
                      <ArrowRight className="h-3 w-3 text-violet-600 shrink-0" />
                      <span className="font-medium">Pra:</span>
                      <span className="font-semibold">
                        {availablePipelines.find((p) => p.id === targetPipelineId)?.name} / {targetStages.find((s) => s.id === targetStageId)?.name}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setChangePipelineOpen(false)} disabled={changePipelineMut.isPending}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleChangePipeline}
                    disabled={!targetPipelineId || !targetStageId || changePipelineMut.isPending}
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {changePipelineMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Mover
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Vertical Stepper — Pipeline Stages */}
      {sortedStages.length > 0 && (
        <div className="relative pl-1">
          {sortedStages.map((s, idx) => {
            const isCurrent = s.id === deal.stageId;
            const isPast = idx < currentIdx;
            const isFuture = idx > currentIdx;
            const isLast = idx === sortedStages.length - 1;
            const stageColor = s.color || "#600FED";

            return (
              <div key={s.id} className="relative flex items-start gap-2.5">
                {/* Vertical line connector */}
                {!isLast && (
                  <div
                    className="absolute left-[7px] top-[18px] w-[2px] h-[calc(100%-4px)]"
                    style={{
                      background: isPast ? stageColor : "var(--border)",
                      opacity: isPast ? 0.6 : 0.4,
                    }}
                  />
                )}

                {/* Circle indicator */}
                <button
                  onClick={() => handleMoveStage(s)}
                  disabled={moveStageMut.isPending || isCurrent}
                  className="relative z-10 shrink-0 mt-[2px] transition-all"
                  title={`Mover para ${s.name}`}
                >
                  {isCurrent ? (
                    <div
                      className="w-4 h-4 rounded-full border-[2.5px] flex items-center justify-center"
                      style={{ borderColor: stageColor, backgroundColor: stageColor }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  ) : isPast ? (
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: stageColor, opacity: 0.7 }}
                    />
                  ) : (
                    <div
                      className="w-4 h-4 rounded-full border-2 hover:border-[2.5px] transition-all"
                      style={{ borderColor: "var(--border)" }}
                    />
                  )}
                </button>

                {/* Stage label + info */}
                <button
                  onClick={() => handleMoveStage(s)}
                  disabled={moveStageMut.isPending || isCurrent}
                  className={`flex-1 text-left pb-2.5 transition-colors ${isCurrent ? "" : "hover:opacity-80"}`}
                >
                  <span className={`text-[12px] leading-tight ${
                    isCurrent
                      ? "font-bold text-foreground"
                      : isPast
                      ? "font-medium text-foreground/70"
                      : "font-medium text-muted-foreground"
                  }`}>
                    {s.name}
                  </span>
                  {isCurrent && (
                    <span
                      className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
                      style={{ backgroundColor: stageColor }}
                    >
                      ATUAL
                    </span>
                  )}
                </button>
              </div>
            );
          })}
          {moveStageMut.isPending && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          )}
        </div>
      )}

      {/* Deal info grid */}
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <div>
          <span className="text-muted-foreground">Valor</span>
          <p className="font-semibold text-foreground">{fmt$(deal.valueCents || 0)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Probabilidade</span>
          <p className="font-semibold text-foreground">{deal.probability ?? 0}%</p>
        </div>
        {deal.expectedCloseAt && (
          <div>
            <span className="text-muted-foreground">Previsão</span>
            <p className="font-semibold text-foreground">
              {new Date(deal.expectedCloseAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </p>
          </div>
        )}
        {deal.boardingDate && (
          <div>
            <span className="text-muted-foreground">Embarque</span>
            <p className="font-semibold text-foreground">
              {new Date(deal.boardingDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </p>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1 pt-1 border-t border-border/40">
        <button
          onClick={() => onEdit(dealId)}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          title="Editar negociação"
        >
          <Pencil className="w-3 h-3" /> Editar
        </button>
        <button
          onClick={() => onProducts(dealId)}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          title="Produtos"
        >
          <Package className="w-3 h-3" /> Produtos
        </button>
        <button
          onClick={() => onParticipants(dealId)}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          title="Participantes"
        >
          <Users className="w-3 h-3" /> Passag.
        </button>
        <button
          onClick={() => onFiles(dealId)}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          title="Arquivos"
        >
          <Paperclip className="w-3 h-3" /> Arq.
        </button>
        <a
          href={`/deal/${dealId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium text-primary hover:text-primary/80 hover:bg-primary/10 transition-colors"
          title="Ir para negociação"
        >
          <ExternalLink className="w-3 h-3" /> Abrir
        </a>
      </div>

      {/* Tasks */}
      <DealTasksSection dealId={dealId} dealTitle={deal?.title || ""} />

      {/* Win / Lose buttons */}
      {deal.status === "open" && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => winMut.mutate({ id: dealId, status: "won" })}
            disabled={winMut.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
          >
            <ThumbsUp className="w-3.5 h-3.5" /> Ganho
          </button>
          <button
            onClick={() => onMarkLost(dealId)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
          >
            <ThumbsDown className="w-3.5 h-3.5" /> Perdido
          </button>
        </div>
      )}
    </div>
  );
}

interface SidebarDealsProps {
  contactId: number;
  onCreateDeal: () => void;
  onEditDeal: (dealId: number) => void;
  onDealProducts: (dealId: number) => void;
  onDealParticipants: (dealId: number) => void;
  onDealFiles: (dealId: number) => void;
  onMarkDealLost: (dealId: number) => void;
}

export default function SidebarDeals({
  contactId, onCreateDeal, onEditDeal, onDealProducts, onDealParticipants, onDealFiles, onMarkDealLost,
}: SidebarDealsProps) {
  const [expandedDealId, setExpandedDealId] = useState<number | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const dealsQ = trpc.contactProfile.getDeals.useQuery(
    { contactId },
    { enabled: !!contactId, staleTime: 60_000 }
  );
  const deals = (dealsQ.data || []) as ContactDeal[];

  const openDeals = deals.filter(d => d.status === "open");
  const closedDeals = deals.filter(d => d.status !== "open");

  return (
    <div className="px-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="sidebar-section-trigger !p-0">Negociações ({deals.length})</span>
        <button
          onClick={onCreateDeal}
          className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="Nova negociação"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Open deals */}
      {openDeals.length === 0 && closedDeals.length === 0 ? (
        <div className="text-center py-4">
          <Briefcase className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[12px] text-muted-foreground">Nenhuma negociação</p>
          <button
            onClick={onCreateDeal}
            className="mt-2 text-[12px] font-medium text-primary hover:underline"
          >
            Criar primeira negociação
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {openDeals.map((deal) => {
            const isExpanded = expandedDealId === deal.id;
            const sc = statusConfig[deal.status] || statusConfig.open;
            return (
              <div key={deal.id}>
                <button
                  onClick={() => setExpandedDealId(isExpanded ? null : deal.id)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors text-left"
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{deal.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-foreground">{fmt$(deal.valueCents)}</span>
                      {deal.pipelineName && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400" title={`Funil: ${deal.pipelineName}`}>
                          <GitBranch className="h-2.5 w-2.5" />
                          {deal.pipelineName}
                        </span>
                      )}
                      {deal.stageName && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sc.color}`}>
                          {deal.stageName}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                {isExpanded && (
                  <SidebarDealDetail
                    dealId={deal.id}
                    pipelineName={deal.pipelineName}
                    stageName={deal.stageName}
                    onClose={() => setExpandedDealId(null)}
                    onEdit={onEditDeal}
                    onProducts={onDealProducts}
                    onParticipants={onDealParticipants}
                    onFiles={onDealFiles}
                    onMarkLost={onMarkDealLost}
                  />
                )}
              </div>
            );
          })}

          {/* Closed deals toggle */}
          {closedDeals.length > 0 && (
            <>
              <button
                onClick={() => setShowClosed(!showClosed)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {showClosed ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Finalizadas ({closedDeals.length})
              </button>
              {showClosed && closedDeals.map((deal) => {
                const isExpanded = expandedDealId === deal.id;
                const sc = statusConfig[deal.status] || statusConfig.open;
                const StatusIcon = deal.status === "won" ? Trophy : XCircle;
                return (
                  <div key={deal.id}>
                    <button
                      onClick={() => setExpandedDealId(isExpanded ? null : deal.id)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors text-left"
                    >
                      <StatusIcon className={`w-3.5 h-3.5 shrink-0 ${deal.status === "won" ? "text-emerald-500" : "text-red-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-muted-foreground truncate">{deal.title}</p>
                        <span className="text-[11px] text-muted-foreground">{fmt$(deal.valueCents)} · {sc.label}</span>
                      </div>
                    </button>
                    {isExpanded && (
                      <SidebarDealDetail
                        dealId={deal.id}
                        onClose={() => setExpandedDealId(null)}
                        onEdit={onEditDeal}
                        onProducts={onDealProducts}
                        onParticipants={onDealParticipants}
                        onFiles={onDealFiles}
                        onMarkLost={onMarkDealLost}
                      />
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
