import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, LayoutGrid, List, Calendar as CalendarIcon,
  RefreshCw, TrendingUp, Info, ArrowUpDown, Plane, X,
  DollarSign, MapPin, Clock, GripVertical, Building2, User,
  Package, History, Trash2, Pencil, Link2, Unlink, RotateCcw,
  MoreVertical, Download, AlertTriangle, Flame, CheckCircle2,
  ChevronLeft, ChevronRight, Star,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import DealFiltersPanel, { useDealFilters, DealFilterButton } from "@/components/DealFiltersPanel";
import ClassificationBadge from "@/components/ClassificationBadge";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useTenantId } from "@/hooks/useTenantId";
import TaskFormDialog, { getTaskTypeIcon, getTaskTypeLabel } from "@/components/TaskFormDialog";
import TaskActionPopover from "@/components/TaskActionPopover";

type ViewMode = "kanban" | "list";
type SortMode = "created_desc" | "created_asc" | "value_desc" | "value_asc";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  open: { bg: "bg-violet-50 dark:bg-violet-500/15", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  won: { bg: "bg-emerald-50 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  lost: { bg: "bg-red-50 dark:bg-red-500/15", text: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
};

const categoryLabels: Record<string, string> = {
  flight: "Aéreo", hotel: "Hotel", tour: "Passeio", transfer: "Transfer",
  insurance: "Seguro", cruise: "Cruzeiro", visa: "Visto", other: "Outro",
};

const categoryIcons: Record<string, string> = {
  flight: "\u2708\uFE0F", hotel: "\uD83C\uDFE8", tour: "\uD83D\uDDFA\uFE0F", transfer: "\uD83D\uDE90",
  insurance: "\uD83D\uDEE1\uFE0F", cruise: "\uD83D\uDEA2", visa: "\uD83D\uDCCB", other: "\uD83D\uDCE6",
};

function getStatusStyle(status: string) {
  return statusColors[status] || statusColors["open"];
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Pipeline() {
  const TENANT_ID = useTenantId();
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [pipelineInitialized, setPipelineInitialized] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("created_desc");
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState<{ dealId?: number; dealTitle?: string; editTask?: any; editAssigneeIds?: number[]; showDealSelector?: boolean } | null>(null);
  const [, setLocation] = useLocation();
  const [draggedDealId, setDraggedDealId] = useState<number | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<number | null>(null);
  const [selectedDealIds, setSelectedDealIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [listTab, setListTab] = useState<"active" | "trash">("active");
  const dealFilters = useDealFilters();
  const [ownerFilter, setOwnerFilter] = useState<number | "all">("all");
  const [showIndicators, setShowIndicators] = useState(false);
  const [showTaskCalendar, setShowTaskCalendar] = useState(false);
  const crmUsers = trpc.admin.users.list.useQuery({ tenantId: TENANT_ID });

  const utils = trpc.useUtils();
  const pipelines = trpc.crm.pipelines.list.useQuery({ tenantId: TENANT_ID });

  // Load user's default pipeline preference
  const defaultPipelinePref = trpc.preferences.get.useQuery(
    { tenantId: TENANT_ID, key: "default_pipeline_id" },
    { enabled: !!TENANT_ID }
  );
  const setDefaultPipelineMut = trpc.preferences.set.useMutation({
    onSuccess: () => {
      utils.preferences.get.invalidate({ tenantId: TENANT_ID, key: "default_pipeline_id" });
      toast.success("Funil padrão salvo!");
    },
  });

  // Auto-select default pipeline on load
  useEffect(() => {
    if (pipelineInitialized || !pipelines.data?.length) return;
    const prefVal = defaultPipelinePref.data?.value;
    if (prefVal) {
      const prefId = Number(prefVal);
      const exists = pipelines.data.find((p: any) => p.id === prefId && !p.isArchived);
      if (exists) {
        setSelectedPipelineId(prefId);
        setPipelineInitialized(true);
        return;
      }
    }
    // Fallback: first sales pipeline or first pipeline
    const salesPipeline = pipelines.data.find((p: any) => p.pipelineType === "sales" && !p.isArchived);
    setSelectedPipelineId(salesPipeline?.id ?? pipelines.data[0]?.id ?? null);
    setPipelineInitialized(true);
  }, [pipelines.data, defaultPipelinePref.data, pipelineInitialized]);
  const activePipeline = selectedPipelineId
    ? pipelines.data?.find((p: any) => p.id === selectedPipelineId)
    : pipelines.data?.[0];

  const stages = trpc.crm.pipelines.stages.useQuery(
    { tenantId: TENANT_ID, pipelineId: activePipeline?.id ?? 0 },
    { enabled: !!activePipeline }
  );

  const deals = trpc.crm.deals.list.useQuery(
    {
      tenantId: TENANT_ID,
      pipelineId: activePipeline?.id,
      limit: 200,
      ...dealFilters.filters,
      ...(ownerFilter !== "all" ? { ownerUserId: ownerFilter } : {}),
    },
    { enabled: !!activePipeline }
  );

  const contacts = trpc.crm.contacts.list.useQuery({ tenantId: TENANT_ID, limit: 200 });
  const allAccounts = trpc.crm.accounts.list.useQuery({ tenantId: TENANT_ID });
  // Optimized: aggregated overdue/pending counts per deal for Kanban cards
  const overdueSummary = trpc.crm.tasks.overdueSummary.useQuery({ tenantId: TENANT_ID });
  const pendingCounts = trpc.crm.tasks.pendingCounts.useQuery({ tenantId: TENANT_ID });
  // Full tasks for calendar and indicators panels
  const allTasks = trpc.crm.tasks.list.useQuery(
    { tenantId: TENANT_ID },
    { enabled: showIndicators || showTaskCalendar }
  );

  const deletedDeals = trpc.crm.deals.listDeleted.useQuery(
    { tenantId: TENANT_ID },
    { enabled: listTab === "trash" }
  );

  const bulkDeleteDeals = trpc.crm.deals.bulkDelete.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} negociação(ões) movida(s) para a lixeira`);
      setSelectedDealIds(new Set());
      utils.crm.deals.list.invalidate();
      utils.crm.deals.listDeleted.invalidate();
    },
    onError: () => toast.error("Erro ao excluir negociações"),
  });

  const restoreDeals = trpc.crm.deals.restore.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} negociação(ões) restaurada(s)`);
      setSelectedDealIds(new Set());
      utils.crm.deals.list.invalidate();
      utils.crm.deals.listDeleted.invalidate();
    },
    onError: () => toast.error("Erro ao restaurar negociações"),
  });

  const toggleSelectDeal = useCallback((dealId: number) => {
    setSelectedDealIds(prev => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId); else next.add(dealId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((dealIds: number[]) => {
    setSelectedDealIds(prev => {
      const allSelected = dealIds.every(id => prev.has(id));
      if (allSelected) return new Set();
      return new Set(dealIds);
    });
  }, []);

  const moveStage = trpc.crm.deals.moveStage.useMutation({
    onMutate: async ({ dealId, toStageId }) => {
      await utils.crm.deals.list.cancel();
      const prev = utils.crm.deals.list.getData({ tenantId: TENANT_ID, pipelineId: activePipeline?.id, limit: 200 });
      utils.crm.deals.list.setData(
        { tenantId: TENANT_ID, pipelineId: activePipeline?.id, limit: 200 },
        (old: any) => old?.map((d: any) => d.id === dealId ? { ...d, stageId: toStageId } : d)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        utils.crm.deals.list.setData({ tenantId: TENANT_ID, pipelineId: activePipeline?.id, limit: 200 }, ctx.prev);
      }
      toast.error("Erro ao mover negociação");
    },
    onSettled: () => { utils.crm.deals.list.invalidate(); },
  });

  const sortedDeals = useMemo(() => {
    if (!deals.data) return [];
    let filtered = [...deals.data];
    if (statusFilter !== "all") filtered = filtered.filter((d: any) => d.status === statusFilter);
    filtered.sort((a: any, b: any) => {
      switch (sortMode) {
        case "created_asc": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "value_desc": return (b.valueCents || 0) - (a.valueCents || 0);
        case "value_asc": return (a.valueCents || 0) - (b.valueCents || 0);
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return filtered;
  }, [deals.data, statusFilter, sortMode]);

  const totalDeals = sortedDeals.length;

  const handleDragStart = useCallback((e: React.DragEvent, dealId: number) => {
    setDraggedDealId(dealId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(dealId));
  }, []);

  const handleDragEnd = useCallback((_e: React.DragEvent) => {
    setDraggedDealId(null);
    setDragOverStageId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStageId(stageId);
  }, []);

  const handleDragLeave = useCallback(() => { setDragOverStageId(null); }, []);

  const handleDrop = useCallback((e: React.DragEvent, toStageId: number) => {
    e.preventDefault();
    setDragOverStageId(null);
    const dealId = Number(e.dataTransfer.getData("text/plain"));
    if (!dealId || !stages.data) return;
    const deal = sortedDeals.find((d: any) => d.id === dealId);
    if (!deal || deal.stageId === toStageId) return;
    const fromStage = stages.data.find((s: any) => s.id === deal.stageId);
    const toStage = stages.data.find((s: any) => s.id === toStageId);
    moveStage.mutate({
      tenantId: TENANT_ID, dealId, fromStageId: deal.stageId, toStageId,
      fromStageName: fromStage?.name || "Desconhecida", toStageName: toStage?.name || "Desconhecida",
    });
    toast.success(`Movido para "${toStage?.name}"`);
  }, [sortedDeals, stages.data, moveStage]);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Toolbar — Linha 1: Toggle view + ações */}
      <div className="border-b border-border/40">
        <div className="flex items-center gap-2 px-5 lg:px-8 py-2.5">
          {/* View toggle */}
          <div className="flex bg-muted/60 rounded-xl p-1 gap-0.5">
            <Tooltip><TooltipTrigger asChild>
              <button
                onClick={() => setViewMode("kanban")}
                className={`p-2 rounded-lg transition-all duration-200 ${viewMode === "kanban" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </TooltipTrigger><TooltipContent side="bottom"><p className="text-xs">Funil</p></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-all duration-200 ${viewMode === "list" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="h-4 w-4" />
              </button>
            </TooltipTrigger><TooltipContent side="bottom"><p className="text-xs">Lista</p></TooltipContent></Tooltip>
          </div>

          <div className="flex-1" />

          {/* Indicadores profundos */}
          <Popover open={showIndicators} onOpenChange={setShowIndicators}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className={`h-9 w-9 rounded-xl transition-colors ${showIndicators ? 'bg-primary/10 text-primary' : ''}`}>
                <Tooltip><TooltipTrigger asChild><TrendingUp className="h-4 w-4" /></TooltipTrigger>
                <TooltipContent side="bottom"><p className="text-xs">Indicadores do Pipeline</p></TooltipContent></Tooltip>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[420px] p-0 rounded-2xl shadow-xl border-border/50">
              <PipelineIndicatorsPanel deals={sortedDeals} tasks={allTasks.data?.tasks || []} stages={stages.data || []} />
            </PopoverContent>
          </Popover>

          {/* Calendário de tarefas */}
          <Popover open={showTaskCalendar} onOpenChange={setShowTaskCalendar}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className={`h-9 w-9 rounded-xl transition-colors ${showTaskCalendar ? 'bg-primary/10 text-primary' : ''}`}>
                <Tooltip><TooltipTrigger asChild><CalendarIcon className="h-4 w-4" /></TooltipTrigger>
                <TooltipContent side="bottom"><p className="text-xs">Calendário de Tarefas</p></TooltipContent></Tooltip>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[520px] p-0 rounded-2xl shadow-xl border-border/50">
              <TaskCalendarPanel tasks={allTasks.data?.tasks || []} deals={sortedDeals} onEditTask={(t: any) => setShowTaskForm({ editTask: t, editAssigneeIds: t.assignedToUserId ? [t.assignedToUserId] : [] })} />
            </PopoverContent>
          </Popover>

          {/* 3 pontos — ações */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <DropdownMenuItem onClick={() => { toast.info("Exportação em breve!"); }}>
                <Download className="h-4 w-4 mr-2" /> Exportar dados
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => utils.crm.deals.list.invalidate()}>
                <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Botão Criar */}
          <Button
            onClick={() => setShowCreateDeal(true)}
            className="h-9 gap-2 px-5 rounded-xl shadow-sm bg-primary hover:bg-primary/90 transition-colors text-[13px] font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Criar
          </Button>
        </div>

        {/* Linha 2: Filtros inline — funil na esquerda, Filtros na direita, selects proporcionais */}
        <div className="flex items-center gap-2.5 px-5 lg:px-8 pb-3">
          {/* Pipeline selector */}
          <div className="flex items-center gap-1.5 flex-1">
            <Select value={String(activePipeline?.id ?? "")} onValueChange={(v) => setSelectedPipelineId(Number(v))}>
              <SelectTrigger className="flex-1 h-10 text-[13px] rounded-xl border-border/50 bg-background">
                <SelectValue placeholder="Selecionar funil" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {pipelines.data?.filter((p: any) => !p.isArchived).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    if (activePipeline) {
                      setDefaultPipelineMut.mutate({ tenantId: TENANT_ID, key: "default_pipeline_id", value: String(activePipeline.id) });
                    }
                  }}
                  className={`p-2 rounded-lg transition-all duration-200 flex-shrink-0 ${
                    defaultPipelinePref.data?.value === String(activePipeline?.id)
                      ? "text-yellow-500 hover:text-yellow-400"
                      : "text-muted-foreground hover:text-yellow-500"
                  }`}
                >
                  <Star className={`h-4 w-4 ${defaultPipelinePref.data?.value === String(activePipeline?.id) ? "fill-current" : ""}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">{defaultPipelinePref.data?.value === String(activePipeline?.id) ? "Funil padrão" : "Definir como funil padrão"}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* User filter */}
          <Select value={String(ownerFilter)} onValueChange={(v) => setOwnerFilter(v === "all" ? "all" : Number(v))}>
            <SelectTrigger className="flex-1 h-10 text-[13px] rounded-xl border-border/50 bg-background">
              <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground flex-shrink-0" />
              <SelectValue placeholder="Todas as negociações" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todas as negociações</SelectItem>
              {crmUsers.data?.map((u: any) => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="flex-1 h-10 text-[13px] rounded-xl border-border/50 bg-background">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Em andamento</SelectItem>
              <SelectItem value="won">Ganhos</SelectItem>
              <SelectItem value="lost">Perdidos</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="flex-1 h-10 text-[13px] rounded-xl border-border/50 bg-background">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground flex-shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="created_desc">Criadas por último</SelectItem>
              <SelectItem value="created_asc">Criadas primeiro</SelectItem>
              <SelectItem value="value_desc">Maior valor</SelectItem>
              <SelectItem value="value_asc">Menor valor</SelectItem>
            </SelectContent>
          </Select>

          {/* Botão Filtros — sempre na cor de destaque, ponta direita */}
          <Button
            onClick={() => dealFilters.setIsOpen(true)}
            className="h-10 gap-2 px-5 rounded-xl text-[13px] font-medium flex-shrink-0 transition-all bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filtros{dealFilters.activeCount > 0 ? ` (${dealFilters.activeCount})` : ""}
          </Button>
        </div>

        {/* Contagem */}
        <div className="px-5 lg:px-8 pb-2">
          <span className="text-[12px] font-medium text-muted-foreground">{totalDeals} Negociações · {statusFilter === 'all' ? 'Todos' : statusFilter === 'open' ? 'Em andamento' : statusFilter === 'won' ? 'Ganhos' : 'Perdidos'}</span>
        </div>
      </div>

      {/* Kanban Board */}
      {viewMode === "kanban" ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden bg-background">
          <div className="flex gap-4 p-5 lg:px-8 h-full min-w-max">
            {stages.isLoading ? (
              <p className="text-muted-foreground p-4 text-sm">Carregando etapas...</p>
            ) : !stages.data?.length ? (
              <div className="flex items-center justify-center w-full text-muted-foreground">
                <p className="text-sm">Nenhuma etapa configurada neste pipeline.</p>
              </div>
            ) : (
              stages.data.map((stage: any) => {
                const stageDeals = sortedDeals.filter((d: any) => d.stageId === stage.id);
                const stageValue = stageDeals.reduce((sum: number, d: any) => sum + (d.valueCents || 0), 0);
                const isDragOver = dragOverStageId === stage.id;

                return (
                  <div
                    key={stage.id}
                    className="w-[310px] flex-shrink-0 flex flex-col h-full"
                    onDragOver={(e) => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, stage.id)}
                  >
                    {/* Stage header */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[13px] text-foreground truncate max-w-[150px]">{stage.name}</h3>
                        <span className="text-[12px] text-muted-foreground font-medium">({stageDeals.length})</span>
                      </div>
                      <span className="text-[12px] font-semibold text-primary">
                        {stageValue > 0 ? formatCurrency(stageValue) : "R$ 0,00"}
                      </span>
                    </div>

                    {/* Cards container */}
                    <div className={`flex-1 rounded-2xl border transition-all duration-200 overflow-y-auto scrollbar-thin ${
                      isDragOver
                        ? "bg-primary/[0.06] border-primary/40 ring-2 ring-primary/20"
                        : "bg-muted/30 dark:bg-card/30 border-border/40"
                    }`}>
                      <div className="p-2.5 space-y-2.5 min-h-[200px]">
                        {stageDeals.map((deal: any) => (
                          <DealCard
                            key={deal.id}
                            deal={deal}
                            contacts={contacts.data || []}
                            accounts={allAccounts.data || []}
                            overdueData={(overdueSummary.data as any)?.[deal.id] || null}
                            pendingCount={(pendingCounts.data as any)?.[deal.id] || 0}
                            onCreateTask={() => setShowTaskForm({ dealId: deal.id, dealTitle: deal.title })}
                            onOpenDeal={() => setLocation(`/deal/${deal.id}`)}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            isDragging={draggedDealId === deal.id}
                          />
                        ))}
                        {stageDeals.length === 0 && (
                          <div className="flex items-center justify-center h-24 text-[12px] text-muted-foreground/60">
                            Arraste negociações aqui
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* List view */
        <div className="flex-1 overflow-auto p-5 lg:px-8 bg-background">
          {/* Tabs: Ativas / Lixeira */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex bg-muted/60 rounded-xl p-1 gap-0.5">
              <button
                onClick={() => { setListTab("active"); setSelectedDealIds(new Set()); }}
                className={`px-4 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-200 ${listTab === "active" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Ativas
              </button>
              <button
                onClick={() => { setListTab("trash"); setSelectedDealIds(new Set()); }}
                className={`px-4 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5 ${listTab === "trash" ? "bg-card text-destructive shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Lixeira
              </button>
            </div>

            {selectedDealIds.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[13px] text-muted-foreground font-medium">{selectedDealIds.size} selecionada(s)</span>
                {listTab === "active" ? (
                  <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-[12px] rounded-lg" onClick={() => setShowDeleteConfirm(true)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px] rounded-lg" onClick={() => restoreDeals.mutate({ tenantId: TENANT_ID, ids: Array.from(selectedDealIds) })}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restaurar
                  </Button>
                )}
              </div>
            )}
          </div>

          {listTab === "active" ? (
            <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3.5 w-10">
                      <Checkbox
                        checked={sortedDeals.length > 0 && sortedDeals.every((d: any) => selectedDealIds.has(d.id))}
                        onCheckedChange={() => toggleSelectAll(sortedDeals.map((d: any) => d.id))}
                      />
                    </th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Negociação</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Contato</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Etapa</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Status</th>
                    <th className="text-right p-3.5 font-semibold text-muted-foreground">Valor</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDeals.map((deal: any) => {
                    const contact = (contacts.data || []).find((c: any) => c.id === deal.contactId);
                    const stage = (stages.data || []).find((s: any) => s.id === deal.stageId);
                    const style = getStatusStyle(deal.status);
                    const isSelected = selectedDealIds.has(deal.id);
                    return (
                      <tr key={deal.id} className={`border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer ${isSelected ? "bg-primary/5" : ""}`}>
                        <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectDeal(deal.id)} />
                        </td>
                        <td className="p-3.5 font-medium" onClick={() => setLocation(`/deal/${deal.id}`)}>{deal.title}</td>
                        <td className="p-3.5 text-muted-foreground" onClick={() => setLocation(`/deal/${deal.id}`)}>{contact?.name || "—"}</td>
                        <td className="p-3.5" onClick={() => setLocation(`/deal/${deal.id}`)}><Badge variant="secondary" className="text-[11px] rounded-lg">{stage?.name || "—"}</Badge></td>
                        <td className="p-3.5" onClick={() => setLocation(`/deal/${deal.id}`)}>
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                            {deal.status === "open" ? "Em andamento" : deal.status === "won" ? "Ganho" : "Perdido"}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-semibold" onClick={() => setLocation(`/deal/${deal.id}`)}>{deal.valueCents ? formatCurrency(deal.valueCents) : "—"}</td>
                        <td className="p-3.5 text-muted-foreground" onClick={() => setLocation(`/deal/${deal.id}`)}>{formatDate(deal.createdAt)}</td>
                      </tr>
                    );
                  })}
                  {sortedDeals.length === 0 && (
                    <tr><td colSpan={7} className="p-12 text-center text-muted-foreground text-sm">Nenhuma negociação encontrada.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3.5 w-10">
                      <Checkbox
                        checked={(deletedDeals.data || []).length > 0 && (deletedDeals.data || []).every((d: any) => selectedDealIds.has(d.id))}
                        onCheckedChange={() => toggleSelectAll((deletedDeals.data || []).map((d: any) => d.id))}
                      />
                    </th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Negociação</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Contato</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Status</th>
                    <th className="text-right p-3.5 font-semibold text-muted-foreground">Valor</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Excluído em</th>
                  </tr>
                </thead>
                <tbody>
                  {(deletedDeals.data || []).map((deal: any) => {
                    const contact = (contacts.data || []).find((c: any) => c.id === deal.contactId);
                    const style = getStatusStyle(deal.status);
                    const isSelected = selectedDealIds.has(deal.id);
                    return (
                      <tr key={deal.id} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${isSelected ? "bg-primary/5" : ""}`}>
                        <td className="p-3.5">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectDeal(deal.id)} />
                        </td>
                        <td className="p-3.5 font-medium text-muted-foreground line-through">{deal.title}</td>
                        <td className="p-3.5 text-muted-foreground">{contact?.name || "—"}</td>
                        <td className="p-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                            {deal.status === "open" ? "Em andamento" : deal.status === "won" ? "Ganho" : "Perdido"}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-semibold text-muted-foreground">{deal.valueCents ? formatCurrency(deal.valueCents) : "—"}</td>
                        <td className="p-3.5 text-muted-foreground">{deal.deletedAt ? formatDate(deal.deletedAt) : "—"}</td>
                      </tr>
                    );
                  })}
                  {(deletedDeals.data || []).length === 0 && (
                    <tr><td colSpan={6} className="p-12 text-center text-muted-foreground text-sm">Lixeira vazia.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir negociações</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja mover {selectedDealIds.size} negociação(ões) para a lixeira? Os contatos vinculados não serão apagados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                bulkDeleteDeals.mutate({ tenantId: TENANT_ID, ids: Array.from(selectedDealIds) });
                setShowDeleteConfirm(false);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogs */}
      <CreateDealDialog open={showCreateDeal} onOpenChange={setShowCreateDeal} pipelineId={activePipeline?.id} stages={stages.data || []} contacts={contacts.data || []} accounts={allAccounts.data || []} pipelines={pipelines.data?.filter((p: any) => !p.isArchived) || []} />
      {showTaskForm && (
        <TaskFormDialog
          open={true}
          onOpenChange={() => setShowTaskForm(null)}
          dealId={showTaskForm.dealId}
          dealTitle={showTaskForm.dealTitle}
          editTask={showTaskForm.editTask}
          editAssigneeIds={showTaskForm.editAssigneeIds}
          showDealSelector={showTaskForm.showDealSelector}
        />
      )}
      <DealFiltersPanel
        open={dealFilters.isOpen}
        onOpenChange={dealFilters.setIsOpen}
        filters={dealFilters.filters}
        onApply={(f) => { dealFilters.setFilters(f); }}
        onClear={dealFilters.clear}
      />
    </div>
  );
}

/* ─── Deal Card ─── */
function DealCard({ deal, contacts, accounts, overdueData, pendingCount, onCreateTask, onOpenDeal, onDragStart, onDragEnd, isDragging }: {
  deal: any; contacts: any[]; accounts: any[]; overdueData: { count: number; oldestTitle: string; oldestDueAt: string } | null; pendingCount: number; onCreateTask: () => void; onOpenDeal: () => void;
  onDragStart: (e: React.DragEvent, dealId: number) => void; onDragEnd: (e: React.DragEvent) => void; isDragging: boolean;
}) {
  const contact = contacts.find((c: any) => c.id === deal.contactId);
  const account = accounts.find((a: any) => a.id === deal.accountId);
  const style = getStatusStyle(deal.status);
  const hasOverdue = !!overdueData && overdueData.count > 0;
  const hasPending = pendingCount > 0;

  // Build the overdue task type icon from title heuristic
  const overdueTaskIcon = hasOverdue ? (() => {
    const title = (overdueData.oldestTitle || "").toLowerCase();
    if (title.includes("whatsapp") || title.includes("primeiro contato")) return "whatsapp";
    if (title.includes("telefone") || title.includes("ligar")) return "phone";
    if (title.includes("email") || title.includes("e-mail")) return "email";
    if (title.includes("vídeo") || title.includes("video")) return "video_call";
    return "task";
  })() : "task";
  const OverdueIcon = getTaskTypeIcon(overdueTaskIcon);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onDragEnd={onDragEnd}
      className={`bg-card rounded-xl border p-3.5 shadow-[0_1px_4px_oklch(0_0_0/0.06)] hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing space-y-2.5 ${isDragging ? "opacity-60 scale-[0.97] ring-2 ring-primary/40 border-primary/30" : "border-border/50"}`}
    >
      {/* Status + info icon */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md ${style.bg} ${style.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {deal.status === "open" ? "Em andamento" : deal.status === "won" ? "Ganha" : "Perdida"}
        </span>
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <button className="p-1 hover:bg-primary/10 rounded-full transition-colors" onClick={(e) => e.stopPropagation()}>
              <Info className="h-4 w-4 text-primary" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent side="right" align="start" className="w-[320px] p-0 z-[100]">
            <div className="p-4 space-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-sm">Sobre a Negociação</h4>
              </div>
              <Separator className="mb-3" />
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">DADOS GERAIS</p>
              <div className="space-y-3 text-[12.5px]">
                <div>
                  <p className="text-muted-foreground text-[11px]">Fonte</p>
                  <p className="font-semibold">{deal.leadSource || deal.channelOrigin || "Desconhecido"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Campanha</p>
                  <p className="font-semibold">{deal.utmCampaign || "Não preenchido"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Empresa</p>
                  <p className="font-semibold">{account?.name || "Não vinculada"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Data de criação</p>
                  <p className="font-semibold">{deal.createdAt ? formatDateTime(deal.createdAt) : "Não preenchido"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Último contato</p>
                  <p className="font-semibold">{deal.lastActivityAt ? formatDateTime(deal.lastActivityAt) : "Não preenchido"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Previsão de fechamento</p>
                  <p className="font-semibold">{deal.expectedCloseAt ? formatDate(deal.expectedCloseAt) : "Não preenchido"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Identificador</p>
                  <p className="font-semibold">#{deal.id}</p>
                </div>
              </div>
            </div>
            <div className="border-t p-3">
              <Button size="sm" className="w-full" onClick={onOpenDeal}>
                Abrir Negociação
              </Button>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>

      {/* Title */}
      <p className="font-bold text-[13.5px] leading-snug text-foreground cursor-pointer hover:text-primary transition-colors" onClick={onOpenDeal}>
        {deal.title}
      </p>

      {/* Classification badge — strip variant for visual impact */}
      {contact && (
        <ClassificationBadge
          classification={contact.stageClassification || "desconhecido"}
          variant="strip"
          referralWindowActive={!!contact.referralWindowStart && (Date.now() - new Date(contact.referralWindowStart).getTime()) < 90 * 24 * 60 * 60 * 1000}
        />
      )}

      {/* Date & source */}
      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" />
          {formatDate(deal.createdAt)}
        </span>
        {deal.utmCampaign && (
          <span className="flex items-center gap-1 truncate max-w-[120px]" title={deal.utmCampaign}>
            <TrendingUp className="h-3 w-3 shrink-0" />
            {deal.utmCampaign.length > 20 ? deal.utmCampaign.slice(0, 18) + "..." : deal.utmCampaign}
          </span>
        )}
      </div>

      {/* Overdue task — pink/rose background row */}
      {hasOverdue && (
        <div className="bg-pink-200 dark:bg-pink-900/50 rounded-lg px-2.5 py-2 flex items-center gap-2 text-[11.5px]">
          <OverdueIcon className="h-3.5 w-3.5 shrink-0 text-pink-800 dark:text-pink-200" />
          <span className="font-semibold text-pink-900 dark:text-pink-100 truncate flex-1">
            {overdueData.oldestTitle}
          </span>
          <span className="text-pink-700 dark:text-pink-300 whitespace-nowrap text-[10.5px]">
            {formatDateTime(overdueData.oldestDueAt)}
          </span>
        </div>
      )}

      {/* Extra overdue count if more than 1 */}
      {hasOverdue && overdueData.count > 1 && (
        <div className="flex items-center gap-1.5 text-[10.5px] text-red-600 dark:text-red-400 pl-1">
          <AlertTriangle className="h-3 w-3" />
          <span>+{overdueData.count - 1} tarefa{overdueData.count - 1 > 1 ? "s" : ""} atrasada{overdueData.count - 1 > 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Pending tasks indicator */}
      {hasPending && !hasOverdue && (
        <div className="flex items-center gap-1.5 text-[11px] bg-primary/[0.08] dark:bg-primary/[0.12] border border-primary/15 px-2.5 py-2 rounded-lg">
          <Clock className="h-3 w-3 shrink-0 text-primary" />
          <span className="truncate flex-1 text-foreground font-medium">{pendingCount} tarefa{pendingCount > 1 ? "s" : ""} pendente{pendingCount > 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Create task */}
      {!hasPending && !hasOverdue && (
        <button
          onClick={(e) => { e.stopPropagation(); onCreateTask(); }}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-primary w-full justify-center py-2 border border-dashed border-border/50 rounded-xl hover:border-primary/40 transition-all duration-200"
        >
          <Plus className="h-3 w-3" />
          Criar Tarefa
        </button>
      )}
    </div>
  );
}

/* ═══ DEAL DRAWER ═══ */
function DealDrawer({ dealId, onClose, contacts, accounts, stages }: {
  dealId: number; onClose: () => void; contacts: any[]; accounts: any[]; stages: any[];
}) {
  const TENANT_ID = useTenantId();
  const utils = trpc.useUtils();
  const deal = trpc.crm.deals.get.useQuery({ tenantId: TENANT_ID, id: dealId });
  const products = trpc.crm.deals.products.list.useQuery({ tenantId: TENANT_ID, dealId });
  const history = trpc.crm.deals.history.list.useQuery({ tenantId: TENANT_ID, dealId });
  const participants = trpc.crm.deals.participants.list.useQuery({ tenantId: TENANT_ID, dealId });
  const dealTasks = trpc.crm.tasks.list.useQuery({ tenantId: TENANT_ID, entityType: "deal", entityId: dealId });
  const dealNotes = trpc.crm.notes.list.useQuery({ tenantId: TENANT_ID, entityType: "deal", entityId: dealId });
  const lossReasonsQ = trpc.crm.lossReasons.list.useQuery({ tenantId: TENANT_ID });
  const lossReasonsList = (lossReasonsQ.data || []).filter((r: any) => r.isActive && !r.isDeleted);
  const [showLossDialog, setShowLossDialog] = useState(false);
  const [lossDialogDealId, setLossDialogDealId] = useState<number | null>(null);
  const [selectedLossReasonId, setSelectedLossReasonId] = useState<number | null>(null);
  const [lossNotes, setLossNotes] = useState("");
  const [showDrawerTaskForm, setShowDrawerTaskForm] = useState<any>(null);

  const updateTaskStatus = trpc.crm.tasks.update.useMutation({
    onSuccess: () => {
      utils.crm.tasks.list.invalidate();
      utils.crm.tasks.overdueSummary.invalidate();
      utils.crm.tasks.pendingCounts.invalidate();
      toast.success("Tarefa atualizada!");
    },
  });

  const updateDeal = trpc.crm.deals.update.useMutation({
    onSuccess: () => {
      utils.crm.deals.get.invalidate({ tenantId: TENANT_ID, id: dealId });
      utils.crm.deals.list.invalidate();
      utils.crm.deals.history.list.invalidate({ tenantId: TENANT_ID, dealId });
      toast.success("Negociação atualizada!");
    },
  });

  const createProduct = trpc.crm.deals.products.create.useMutation({
    onSuccess: () => {
      utils.crm.deals.products.list.invalidate({ tenantId: TENANT_ID, dealId });
      utils.crm.deals.history.list.invalidate({ tenantId: TENANT_ID, dealId });
      toast.success("Produto adicionado!");
    },
  });

  const deleteProduct = trpc.crm.deals.products.delete.useMutation({
    onSuccess: () => {
      utils.crm.deals.products.list.invalidate({ tenantId: TENANT_ID, dealId });
      utils.crm.deals.history.list.invalidate({ tenantId: TENANT_ID, dealId });
      toast.success("Produto removido!");
    },
  });

  const addParticipant = trpc.crm.deals.participants.add.useMutation({
    onSuccess: () => {
      utils.crm.deals.participants.list.invalidate({ tenantId: TENANT_ID, dealId });
      utils.crm.deals.history.list.invalidate({ tenantId: TENANT_ID, dealId });
      toast.success("Participante adicionado!");
    },
  });

  const removeParticipant = trpc.crm.deals.participants.remove.useMutation({
    onSuccess: () => {
      utils.crm.deals.participants.list.invalidate({ tenantId: TENANT_ID, dealId });
      utils.crm.deals.history.list.invalidate({ tenantId: TENANT_ID, dealId });
      toast.success("Participante removido!");
    },
  });

  const createNote = trpc.crm.notes.create.useMutation({
    onSuccess: () => {
      utils.crm.notes.list.invalidate({ tenantId: TENANT_ID, entityType: "deal", entityId: dealId });
      toast.success("Nota adicionada!");
    },
  });

  const d = deal.data;
  if (!d) return null;

  const contact = contacts.find((c: any) => c.id === d.contactId);
  const account = accounts.find((a: any) => a.id === d.accountId);
  const stage = stages.find((s: any) => s.id === d.stageId);
  const style = getStatusStyle(d.status || "open");

  const totalProducts = (products.data || []).reduce((sum: number, p: any) => {
    return sum + ((p.unitPriceCents || 0) * (p.quantity || 1)) - (p.discountCents || 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-full max-w-[680px] bg-card shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/40 bg-gradient-to-r from-card to-muted/20">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                  {d.status === "open" ? "Em andamento" : d.status === "won" ? "Ganha" : "Perdida"}
                </span>
                <Badge variant="secondary" className="text-[11px] rounded-lg">{stage?.name || "—"}</Badge>
              </div>
              <h2 className="text-xl font-bold text-foreground truncate">{d.title}</h2>
              <div className="flex items-center gap-4 mt-2 text-[13px] text-muted-foreground">
                {contact && <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{contact.name}</span>}
                {account && <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{account.name}</span>}
                {(d.valueCents ?? 0) > 0 && <span className="font-bold text-foreground text-[15px]">{formatCurrency(d.valueCents!)}</span>}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl shrink-0 hover:bg-muted/60" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b border-border/40 bg-transparent px-6 h-11 gap-1">
            <TabsTrigger value="details" className="text-[13px] font-medium data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3">Detalhes</TabsTrigger>
            <TabsTrigger value="products" className="text-[13px] font-medium data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3">
              Orçamento {products.data?.length ? `(${products.data.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="participants" className="text-[13px] font-medium data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3">
              Participantes {participants.data?.length ? `(${participants.data.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-[13px] font-medium data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3">
              Histórico {history.data?.length ? `(${history.data.length})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="flex-1 overflow-auto m-0">
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Contato Associado
                </Label>
                <div className="flex items-center gap-2">
                  <Select value={d.contactId ? String(d.contactId) : "none"} onValueChange={(v) => updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, contactId: v === "none" ? null : Number(v) })}>
                    <SelectTrigger className="flex-1 h-10 text-[13px] rounded-xl"><SelectValue placeholder="Selecionar contato..." /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">Nenhum</SelectItem>
                      {contacts.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {d.contactId && (
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={() => updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, contactId: null })}>
                      <Unlink className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Empresa Associada
                </Label>
                <div className="flex items-center gap-2">
                  <Select value={d.accountId ? String(d.accountId) : "none"} onValueChange={(v) => updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, accountId: v === "none" ? null : Number(v) })}>
                    <SelectTrigger className="flex-1 h-10 text-[13px] rounded-xl"><SelectValue placeholder="Selecionar empresa..." /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {accounts.map((a: any) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {d.accountId && (
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={() => updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, accountId: null })}>
                      <Unlink className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>

              <Separator className="bg-border/40" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium">Status</Label>
                  <Select value={d.status || "open"} onValueChange={(v) => {
                    if (v === "lost") {
                      setLossDialogDealId(dealId);
                      setShowLossDialog(true);
                    } else {
                      updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, status: v as any });
                    }
                  }}>
                    <SelectTrigger className="h-10 text-[13px] rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="open">Em andamento</SelectItem>
                      <SelectItem value="won">Ganho</SelectItem>
                      <SelectItem value="lost">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium">Valor (R$)</Label>
                  <div className="h-10 flex items-center px-3 text-[13px] rounded-xl bg-muted/50 border border-border text-muted-foreground">
                    {d.valueCents ? formatCurrency(d.valueCents) : "R$ 0,00"}
                    <span className="ml-auto text-[10px] text-muted-foreground/60">via Produtos</span>
                  </div>
                </div>
              </div>

              <Separator className="bg-border/40" />

              <div className="space-y-3">
                <Label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Notas</Label>
                {(dealNotes.data || []).map((n: any) => (
                  <div key={n.id} className="bg-muted/30 rounded-xl p-3.5 text-[13px]">
                    <p>{n.body}</p>
                    <p className="text-[11px] text-muted-foreground mt-1.5">{formatDateTime(n.createdAt)}</p>
                  </div>
                ))}
                <AddNoteForm onAdd={(body) => createNote.mutate({ tenantId: TENANT_ID, entityType: "deal", entityId: dealId, body })} />
              </div>

              <Separator className="bg-border/40" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Tarefas</Label>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-primary" onClick={() => setShowDrawerTaskForm({ dealId, dealTitle: d.title })}>
                    <Plus className="h-3 w-3" /> Criar tarefa
                  </Button>
                </div>
                {(dealTasks.data?.tasks || []).map((t: any) => {
                  const isOverdue = (t.status === "pending" || t.status === "in_progress") && t.dueAt && new Date(t.dueAt).getTime() < Date.now();
                  return (
                    <div key={t.id} className={`flex items-center gap-2.5 text-[13px] p-3 rounded-xl border ${t.status === "done" ? "bg-emerald-500/10 border-emerald-200 dark:border-emerald-800" : isOverdue ? "bg-red-50/60 dark:bg-red-950/20 border-red-300 dark:border-red-800" : "bg-card border-border/40"}`}>
                      <Checkbox
                        checked={t.status === "done"}
                        onCheckedChange={(checked) => {
                          updateTaskStatus.mutate({ tenantId: TENANT_ID, id: t.id, status: checked ? "done" : "pending" });
                        }}
                        className="shrink-0"
                      />
                      <span className={`flex-1 truncate ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                      {isOverdue && <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 rounded-md shrink-0">ATRASADA</Badge>}
                      {t.dueAt && <span className="text-[11px] text-muted-foreground shrink-0">{formatDateTime(t.dueAt)}</span>}
                      <button
                        onClick={() => setShowDrawerTaskForm({ editTask: t, editAssigneeIds: t.assignedToUserId ? [t.assignedToUserId] : [] })}
                        className="p-1 hover:bg-muted/60 rounded-lg transition-colors shrink-0"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="flex-1 overflow-auto m-0">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between bg-gradient-to-r from-primary/[0.06] to-accent/[0.04] rounded-2xl p-4 border border-primary/10">
                <span className="text-[13px] font-medium text-muted-foreground">Total do Orçamento</span>
                <span className="text-xl font-bold text-foreground">{formatCurrency(totalProducts)}</span>
              </div>

              {(products.data || []).map((p: any) => (
                <div key={p.id} className="border border-border/40 rounded-xl p-4 bg-card space-y-2 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{categoryIcons[p.category] || "\uD83D\uDCE6"}</span>
                      <div>
                        <p className="font-semibold text-[13px]">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">{categoryLabels[p.category] || p.category}{p.supplier ? ` \u2022 ${p.supplier}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[13px]">{formatCurrency((p.unitPriceCents || 0) * (p.quantity || 1) - (p.discountCents || 0))}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => deleteProduct.mutate({ tenantId: TENANT_ID, id: p.id, dealId, productName: p.name })}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive/60" />
                      </Button>
                    </div>
                  </div>
                  {p.description && <p className="text-[12px] text-muted-foreground">{p.description}</p>}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>Qtd: {p.quantity || 1}</span>
                    <span>Unit: {formatCurrency(p.unitPriceCents || 0)}</span>
                    {p.discountCents > 0 && <span className="text-destructive">Desc: -{formatCurrency(p.discountCents)}</span>}
                    {p.checkIn && <span>Check-in: {formatDate(p.checkIn)}</span>}
                    {p.checkOut && <span>Check-out: {formatDate(p.checkOut)}</span>}
                  </div>
                </div>
              ))}

              {(products.data || []).length === 0 && (
                <div className="text-center py-10 text-[13px] text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p>Nenhum produto adicionado ao orçamento.</p>
                </div>
              )}

              <Separator className="bg-border/40" />
              <AddProductForm dealId={dealId} onAdd={(data) => createProduct.mutate({ tenantId: TENANT_ID, dealId, ...data })} />
            </div>
          </TabsContent>

          {/* Participants Tab */}
          <TabsContent value="participants" className="flex-1 overflow-auto m-0">
            <div className="p-6 space-y-4">
              {(participants.data || []).map((p: any) => {
                const pc = contacts.find((c: any) => c.id === p.contactId);
                return (
                  <div key={p.id} className="flex items-center justify-between border border-border/40 rounded-xl p-3.5 bg-card hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-[13px] font-bold text-primary">
                        {pc?.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold">{pc?.name || `Contato #${p.contactId}`}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{p.role?.replace("_", " ") || "outro"}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => removeParticipant.mutate({ tenantId: TENANT_ID, id: p.id, dealId })}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive/60" />
                    </Button>
                  </div>
                );
              })}

              {(participants.data || []).length === 0 && (
                <div className="text-center py-10 text-[13px] text-muted-foreground">
                  <User className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p>Nenhum participante vinculado.</p>
                </div>
              )}

              <Separator className="bg-border/40" />
              <AddParticipantForm
                contacts={contacts}
                existingIds={(participants.data || []).map((p: any) => p.contactId)}
                onAdd={(contactId, role) => addParticipant.mutate({ tenantId: TENANT_ID, dealId, contactId, role: role as any })}
              />
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="flex-1 overflow-auto m-0">
            <div className="p-6">
              {(history.data || []).length === 0 ? (
                <div className="text-center py-10 text-[13px] text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p>Nenhum registro no histórico.</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[18px] top-4 bottom-4 w-px bg-border/60" />
                  <div className="space-y-5">
                    {(history.data || []).map((h: any) => (
                      <div key={h.id} className="flex gap-4 relative">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 z-10 ${
                          h.action === "stage_moved" ? "bg-primary/10 text-primary" :
                          h.action === "created" ? "bg-emerald-100 text-emerald-700" :
                          h.action.includes("product") ? "bg-amber-100 text-amber-700" :
                          h.action.includes("participant") ? "bg-violet-100 text-violet-700" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {h.action === "stage_moved" ? <TrendingUp className="h-4 w-4" /> :
                           h.action === "created" ? <Plus className="h-4 w-4" /> :
                           h.action.includes("product") ? <Package className="h-4 w-4" /> :
                           h.action.includes("participant") ? <User className="h-4 w-4" /> :
                           <History className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="text-[13px] font-medium">{h.description}</p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                            <span>{h.actorName || "Sistema"}</span>
                            <span>\u2022</span>
                            <span>{formatDateTime(h.createdAt)}</span>
                          </div>
                          {h.fromStageName && h.toStageName && (
                            <div className="flex items-center gap-2 mt-2 text-[12px]">
                              <Badge variant="secondary" className="text-[10px] rounded-lg">{h.fromStageName}</Badge>
                              <span className="text-muted-foreground">\u2192</span>
                              <Badge className="text-[10px] rounded-lg bg-primary/10 text-primary hover:bg-primary/10">{h.toStageName}</Badge>
                            </div>
                          )}
                          {h.fieldChanged && h.oldValue && h.newValue && (
                            <p className="text-[12px] text-muted-foreground mt-1">
                              <span className="line-through">{h.oldValue}</span> \u2192 <span className="font-medium text-foreground">{h.newValue}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Loss Reason Dialog ── */}
      <Dialog open={showLossDialog} onOpenChange={(open) => {
        setShowLossDialog(open);
        if (!open) { setSelectedLossReasonId(null); setLossNotes(""); setLossDialogDealId(null); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <X className="h-5 w-5" />
              Marcar como perda
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Motivo da perda <span className="text-red-500">*</span></Label>
              {lossReasonsList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum motivo cadastrado. Cadastre motivos em Configurações.</p>
              ) : (
                <div className="grid gap-2 max-h-[200px] overflow-y-auto">
                  {lossReasonsList.map((reason: any) => (
                    <button
                      key={reason.id}
                      type="button"
                      onClick={() => setSelectedLossReasonId(reason.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all text-sm ${
                        selectedLossReasonId === reason.id
                          ? "border-red-500 bg-red-50 dark:bg-red-500/10 ring-1 ring-red-500"
                          : "border-border hover:border-red-300 hover:bg-muted/50"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedLossReasonId === reason.id ? "border-red-500" : "border-muted-foreground/30"
                      }`}>
                        {selectedLossReasonId === reason.id && <div className="w-2 h-2 rounded-full bg-red-500" />}
                      </div>
                      <span className="font-medium">{reason.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Observações (opcional)</Label>
              <Input
                value={lossNotes}
                onChange={(e) => setLossNotes(e.target.value)}
                placeholder="Detalhes adicionais..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={() => { setShowLossDialog(false); setSelectedLossReasonId(null); setLossNotes(""); }}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!selectedLossReasonId}
              onClick={() => {
                if (!selectedLossReasonId || !lossDialogDealId) return;
                updateDeal.mutate({
                  tenantId: TENANT_ID,
                  id: lossDialogDealId,
                  status: "lost",
                  lossReasonId: selectedLossReasonId,
                  lossNotes: lossNotes || null,
                });
                setShowLossDialog(false);
                setSelectedLossReasonId(null);
                setLossNotes("");
                setLossDialogDealId(null);
              }}
            >
              Confirmar perda
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Form Dialog for Drawer */}
      {showDrawerTaskForm && (
        <TaskFormDialog
          open={true}
          onOpenChange={() => setShowDrawerTaskForm(null)}
          dealId={showDrawerTaskForm.dealId || dealId}
          dealTitle={showDrawerTaskForm.dealTitle || d?.title}
          editTask={showDrawerTaskForm.editTask}
          editAssigneeIds={showDrawerTaskForm.editAssigneeIds}
        />
      )}
    </div>
  );
}

/* ─── Add Note Form ─── */
function AddNoteForm({ onAdd }: { onAdd: (body: string) => void }) {
  const [body, setBody] = useState("");
  return (
    <div className="flex gap-2">
      <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Adicionar nota..." className="flex-1 h-10 text-[13px] rounded-xl"
        onKeyDown={(e) => { if (e.key === "Enter" && body.trim()) { onAdd(body.trim()); setBody(""); } }} />
      <Button size="sm" className="h-10 px-4 rounded-xl" disabled={!body.trim()} onClick={() => { onAdd(body.trim()); setBody(""); }}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/* ─── Add Product Form ─── */
function AddProductForm({ dealId, onAdd }: { dealId: number; onAdd: (data: any) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <Button variant="outline" className="w-full gap-2 h-10 rounded-xl border-dashed border-border/60 text-[13px]" onClick={() => setExpanded(true)}>
        <Plus className="h-4 w-4" />
        Adicionar Produto
      </Button>
    );
  }

  function handleSubmit() {
    if (!name.trim()) { toast.error("Nome do produto é obrigatório"); return; }
    const priceCents = Math.round(parseFloat(unitPrice.replace(/[^\d,]/g, "").replace(",", ".") || "0") * 100);
    onAdd({ name: name.trim(), category, quantity: Number(quantity) || 1, unitPriceCents: priceCents, supplier: supplier || undefined });
    setName(""); setCategory("other"); setQuantity("1"); setUnitPrice(""); setSupplier("");
    setExpanded(false);
  }

  return (
    <div className="border border-border/40 rounded-xl p-4 bg-muted/20 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Novo Produto</p>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setExpanded(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[12px] font-medium">Nome *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Voo SP \u2192 Cancún" className="mt-1 h-9 text-[13px] rounded-xl" />
        </div>
        <div>
          <Label className="text-[12px] font-medium">Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="mt-1 h-9 text-[13px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              {Object.entries(categoryLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{categoryIcons[k]} {v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-[12px] font-medium">Qtd</Label>
          <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1 h-9 text-[13px] rounded-xl" />
        </div>
        <div>
          <Label className="text-[12px] font-medium">Preço unitário (R$)</Label>
          <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0,00" className="mt-1 h-9 text-[13px] rounded-xl" />
        </div>
        <div>
          <Label className="text-[12px] font-medium">Fornecedor</Label>
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Opcional" className="mt-1 h-9 text-[13px] rounded-xl" />
        </div>
      </div>
      <Button className="w-full rounded-lg h-10 text-[13px] font-medium shadow-sm bg-primary hover:bg-primary/90 transition-colors text-primary-foreground" onClick={handleSubmit}>
        Adicionar ao Orçamento
      </Button>
    </div>
  );
}

/* ─── Add Participant Form ─── */
function AddParticipantForm({ contacts, existingIds, onAdd }: { contacts: any[]; existingIds: number[]; onAdd: (contactId: number, role: string) => void }) {
  const [contactId, setContactId] = useState("");
  const [role, setRole] = useState("traveler");
  const available = contacts.filter((c: any) => !existingIds.includes(c.id));

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Adicionar Participante</p>
      <div className="flex gap-2">
        <Select value={contactId} onValueChange={setContactId}>
          <SelectTrigger className="flex-1 h-10 text-[13px] rounded-xl"><SelectValue placeholder="Selecionar contato..." /></SelectTrigger>
          <SelectContent className="rounded-xl">
            {available.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-[150px] h-10 text-[13px] rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="traveler">Viajante</SelectItem>
            <SelectItem value="decision_maker">Decisor</SelectItem>
            <SelectItem value="payer">Pagador</SelectItem>
            <SelectItem value="companion">Acompanhante</SelectItem>
            <SelectItem value="other">Outro</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="h-10 px-4 rounded-xl" disabled={!contactId} onClick={() => { onAdd(Number(contactId), role); setContactId(""); }}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Create Deal Dialog ─── */
const LEAD_SOURCES = [
  { value: "indicacao", label: "Indicação" },
  { value: "google", label: "Google" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "wordpress", label: "Website" },
  { value: "tracking_script", label: "Tracking Script" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "email_marketing", label: "E-mail Marketing" },
  { value: "telefone", label: "Telefone" },
  { value: "evento", label: "Evento" },
  { value: "outro", label: "Outro" },
];

function CreateDealDialog({ open, onOpenChange, pipelineId, stages, contacts, accounts, pipelines }: {
  open: boolean; onOpenChange: (open: boolean) => void; pipelineId?: number; stages: any[]; contacts: any[]; accounts: any[]; pipelines: any[];
}) {
  const TENANT_ID = useTenantId();
  // Deal fields
  const [title, setTitle] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState<string>(String(pipelineId || ""));
  const [stageId, setStageId] = useState<string>("");
  const [leadSource, setLeadSource] = useState<string>("");
  const [campaign, setCampaign] = useState("");

  // Travel dates
  const [boardingDate, setBoardingDate] = useState("");
  const [returnDate, setReturnDate] = useState("");

  // Products
  const [selectedProducts, setSelectedProducts] = useState<Array<{ productId: number; name: string; quantity: number; unitPriceCents: number; productType: string }>>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Account (empresa) fields
  const [accountId, setAccountId] = useState<string>("");
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");

  // Contact fields
  const [contactId, setContactId] = useState<string>("");
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");

  // Custom fields
  const [showCustomFields, setShowCustomFields] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});

  const utils = trpc.useUtils();

  // Load catalog products
  const catalogProducts = trpc.productCatalog.products.list.useQuery({ tenantId: TENANT_ID, isActive: true, limit: 500 });
  const filteredCatalogProducts = useMemo(() => {
    const all = catalogProducts.data || [];
    if (!productSearch.trim()) return all;
    const q = productSearch.toLowerCase();
    return all.filter((p: any) => p.name.toLowerCase().includes(q) || (p.supplier || "").toLowerCase().includes(q) || (p.destination || "").toLowerCase().includes(q));
  }, [catalogProducts.data, productSearch]);

  // Calculate total from selected products
  const totalValueCents = useMemo(() => {
    return selectedProducts.reduce((sum, p) => sum + (p.quantity * p.unitPriceCents), 0);
  }, [selectedProducts]);

  // Load custom fields for deals
  const dealCustomFields = trpc.customFields.list.useQuery({ tenantId: TENANT_ID, entity: "deal" });
  const visibleFields = (dealCustomFields.data || []).filter((f: any) => f.isVisibleOnForm);

  // Load stages for selected pipeline
  const pipelineStagesQuery = trpc.crm.pipelines.stages.useQuery(
    { tenantId: TENANT_ID, pipelineId: Number(selectedPipeline) },
    { enabled: !!selectedPipeline }
  );
  const currentStages = selectedPipeline && Number(selectedPipeline) !== pipelineId
    ? (pipelineStagesQuery.data || [])
    : stages;

  const createDeal = trpc.crm.deals.create.useMutation({
    onSuccess: () => { utils.crm.deals.list.invalidate(); utils.crm.contacts.list.invalidate(); utils.crm.accounts.list.invalidate(); onOpenChange(false); resetForm(); toast.success("Negociação criada com sucesso!"); },
    onError: (err) => toast.error("Erro ao criar: " + err.message),
  });
  const createContact = trpc.crm.contacts.create.useMutation();
  const createAccount = trpc.crm.accounts.create.useMutation();
  const setFieldValues = trpc.contactProfile.setCustomFieldValues.useMutation();

  function resetForm() {
    setTitle(""); setStageId(""); setLeadSource(""); setCampaign("");
    setBoardingDate(""); setReturnDate("");
    setAccountId(""); setShowNewAccount(false); setNewAccountName("");
    setContactId(""); setShowNewContact(false); setNewContactName(""); setNewContactEmail(""); setNewContactPhone("");
    setShowCustomFields(false); setCustomFieldValues({});
    setSelectedProducts([]); setProductSearch(""); setShowProductPicker(false);
    setSelectedPipeline(String(pipelineId || ""));
  }

  function addProduct(product: any) {
    const existing = selectedProducts.find(p => p.productId === product.id);
    if (existing) {
      setSelectedProducts(prev => prev.map(p => p.productId === product.id ? { ...p, quantity: p.quantity + 1 } : p));
    } else {
      setSelectedProducts(prev => [...prev, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPriceCents: product.basePriceCents || 0,
        productType: product.productType || "other",
      }]);
    }
    setProductSearch("");
    setShowProductPicker(false);
  }

  function removeProduct(productId: number) {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
  }

  function updateProductQty(productId: number, qty: number) {
    if (qty < 1) return;
    setSelectedProducts(prev => prev.map(p => p.productId === productId ? { ...p, quantity: qty } : p));
  }

  function updateProductPrice(productId: number, priceCents: number) {
    setSelectedProducts(prev => prev.map(p => p.productId === productId ? { ...p, unitPriceCents: priceCents } : p));
  }

  async function handleSubmit() {
    if (!title) { toast.error("Informe o título da negociação."); return; }
    if (!selectedPipeline) { toast.error("Selecione o funil de vendas."); return; }
    if (!stageId) { toast.error("Selecione a etapa do funil."); return; }

    try {
      // 1. Create account if needed
      let finalAccountId = accountId ? Number(accountId) : undefined;
      if (showNewAccount && newAccountName.trim()) {
        const acc = await createAccount.mutateAsync({ tenantId: TENANT_ID, name: newAccountName.trim() });
        if (acc?.id) finalAccountId = acc.id;
      }

      // 2. Create contact if needed
      let finalContactId = contactId ? Number(contactId) : undefined;
      if (showNewContact && newContactName.trim()) {
        const ct = await createContact.mutateAsync({
          tenantId: TENANT_ID, name: newContactName.trim(),
          email: newContactEmail.trim() || undefined,
          phone: newContactPhone.trim() || undefined,
        });
        if (ct?.id) finalContactId = ct.id;
      }

      // 3. Create deal with products
      const deal = await createDeal.mutateAsync({
        tenantId: TENANT_ID,
        title,
        pipelineId: Number(selectedPipeline),
        stageId: Number(stageId),
        contactId: finalContactId,
        accountId: finalAccountId,
        leadSource: leadSource || undefined,
        channelOrigin: campaign || undefined,
        boardingDate: boardingDate || null,
        returnDate: returnDate || null,
        products: selectedProducts.length > 0 ? selectedProducts.map(p => ({
          productId: p.productId,
          quantity: p.quantity,
          unitPriceCents: p.unitPriceCents,
        })) : undefined,
      });

      // 4. Set custom field values if any
      const cfEntries = Object.entries(customFieldValues).filter(([, v]) => v.trim());
      if (deal?.id && cfEntries.length > 0) {
        await setFieldValues.mutateAsync({
          tenantId: TENANT_ID,
          entityType: "deal",
          entityId: deal.id,
          values: cfEntries.map(([fid, val]) => ({ fieldId: Number(fid), value: val })),
        });
      }
    } catch {
      // errors handled by mutation onError
    }
  }

  const isSubmitting = createDeal.isPending || createContact.isPending || createAccount.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] rounded-2xl p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2.5 text-lg">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="h-4.5 w-4.5 text-primary" />
            </div>
            Criar Negociação
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] px-6 pb-6">
          <div className="space-y-5 pt-4">
            {/* ─── DADOS DA NEGOCIAÇÃO ─── */}
            <div>
              <Label className="text-[12px] font-semibold">Nome da negociação <span className="text-destructive">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Digite o nome da negociação" className="mt-1.5 h-10 rounded-xl" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[12px] font-semibold">Funil de vendas</Label>
                <Select value={selectedPipeline} onValueChange={(v) => { setSelectedPipeline(v); setStageId(""); }}>
                  <SelectTrigger className="mt-1.5 h-10 rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {pipelines.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[12px] font-semibold">Etapa do funil <span className="text-destructive">*</span></Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger className="mt-1.5 h-10 rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {currentStages.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[12px] font-semibold">Fonte</Label>
                <Select value={leadSource} onValueChange={setLeadSource}>
                  <SelectTrigger className="mt-1.5 h-10 rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {LEAD_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[12px] font-semibold">Campanha</Label>
                <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Ex: Black Friday 2026" className="mt-1.5 h-10 rounded-xl" />
              </div>
            </div>

            {/* ─── DATAS DA VIAGEM ─── */}
            <div className="border border-border/40 rounded-xl p-4 bg-muted/20 space-y-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em] flex items-center gap-1.5">
                <Plane className="h-3.5 w-3.5" /> Datas da Viagem
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[12px] font-medium">Data de Embarque</Label>
                  <Input
                    type="date"
                    value={boardingDate}
                    onChange={(e) => setBoardingDate(e.target.value)}
                    className="mt-1.5 h-10 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-[12px] font-medium">Data de Retorno</Label>
                  <Input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="mt-1.5 h-10 rounded-xl"
                  />
                </div>
              </div>
              {boardingDate && returnDate && new Date(returnDate) > new Date(boardingDate) && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.ceil((new Date(returnDate).getTime() - new Date(boardingDate).getTime()) / (1000 * 60 * 60 * 24))} dias de viagem
                </p>
              )}
            </div>

            {/* ─── PRODUTOS E SERVIÇOS ─── */}
            <div className="border border-border/40 rounded-xl p-4 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em] flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Produtos e Serviços
                </p>
                <button
                  type="button"
                  className="flex items-center gap-1 text-[12px] text-primary hover:text-primary/80 font-medium transition-colors"
                  onClick={() => setShowProductPicker(!showProductPicker)}
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>

              {/* Product picker */}
              {showProductPicker && (
                <div className="space-y-2">
                  <Input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar produto ou serviço..."
                    className="h-9 rounded-lg text-[13px]"
                    autoFocus
                  />
                  <div className="max-h-[180px] overflow-y-auto rounded-lg border border-border/40 bg-background">
                    {filteredCatalogProducts.length === 0 ? (
                      <div className="p-3 text-center text-[12px] text-muted-foreground">
                        {catalogProducts.isLoading ? "Carregando..." : "Nenhum produto encontrado"}
                      </div>
                    ) : (
                      filteredCatalogProducts.map((p: any) => {
                        const alreadyAdded = selectedProducts.some(sp => sp.productId === p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={alreadyAdded}
                            onClick={() => addProduct(p)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors border-b border-border/20 last:border-0 ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[14px]">{categoryIcons[p.productType] || '📦'}</span>
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium truncate">{p.name}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {p.supplier ? p.supplier : ''}{p.supplier && p.destination ? ' · ' : ''}{p.destination || ''}
                                </p>
                              </div>
                            </div>
                            <span className="text-[12px] font-medium text-foreground/70 whitespace-nowrap ml-2">
                              {formatCurrency(p.basePriceCents || 0)}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Selected products list */}
              {selectedProducts.length > 0 && (
                <div className="space-y-2">
                  {selectedProducts.map((p) => (
                    <div key={p.productId} className="flex items-center gap-2 bg-background rounded-lg border border-border/30 px-3 py-2">
                      <span className="text-[14px]">{categoryIcons[p.productType] || '📦'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{p.name}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => updateProductQty(p.productId, p.quantity - 1)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors text-[14px]">−</button>
                        <span className="text-[12px] font-medium w-5 text-center">{p.quantity}</span>
                        <button type="button" onClick={() => updateProductQty(p.productId, p.quantity + 1)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors text-[14px]">+</button>
                      </div>
                      <div className="w-[100px] shrink-0">
                        <Input
                          type="text"
                          value={(p.unitPriceCents / 100).toFixed(2).replace('.', ',')}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9,]/g, '').replace(',', '.');
                            const cents = Math.round(parseFloat(raw || '0') * 100);
                            if (!isNaN(cents)) updateProductPrice(p.productId, cents);
                          }}
                          className="h-7 text-[12px] text-right rounded-md px-2"
                        />
                      </div>
                      <button type="button" onClick={() => removeProduct(p.productId)} className="h-6 w-6 rounded flex items-center justify-center text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Total */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Valor Total</span>
                    <span className="text-[15px] font-bold text-primary">{formatCurrency(totalValueCents)}</span>
                  </div>
                </div>
              )}

              {selectedProducts.length === 0 && !showProductPicker && (
                <p className="text-[12px] text-muted-foreground/60 text-center py-2">
                  Nenhum produto adicionado. O valor será calculado automaticamente.
                </p>
              )}
            </div>

            {/* ─── INFORMAÇÕES DA EMPRESA ─── */}
            <div className="border border-border/40 rounded-xl p-4 bg-muted/20 space-y-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em] flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Informações da Empresa
              </p>

              {!showNewAccount ? (
                <>
                  <div>
                    <Label className="text-[12px] font-medium">Empresa da negociação</Label>
                    <Select value={accountId} onValueChange={setAccountId}>
                      <SelectTrigger className="mt-1.5 h-10 rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {accounts.map((a: any) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-[13px] text-primary hover:text-primary/80 font-medium transition-colors"
                    onClick={() => { setShowNewAccount(true); setAccountId(""); }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar empresa
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-[12px] font-medium">Nome da empresa</Label>
                    <Input value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="Nome da empresa" className="mt-1.5 h-10 rounded-xl" />
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground font-medium transition-colors"
                    onClick={() => { setShowNewAccount(false); setNewAccountName(""); }}
                  >
                    <X className="h-3.5 w-3.5" /> Cancelar e selecionar existente
                  </button>
                </>
              )}
            </div>

            {/* ─── INFORMAÇÕES DO CONTATO ─── */}
            <div className="border border-border/40 rounded-xl p-4 bg-muted/20 space-y-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em] flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Informações do Contato
              </p>

              {!showNewContact ? (
                <>
                  <div>
                    <Label className="text-[12px] font-medium">Contato</Label>
                    <Select value={contactId} onValueChange={setContactId}>
                      <SelectTrigger className="mt-1.5 h-10 rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {contacts.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-[13px] text-primary hover:text-primary/80 font-medium transition-colors"
                    onClick={() => { setShowNewContact(true); setContactId(""); }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar contato
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-[12px] font-medium">Nome do contato <span className="text-destructive">*</span></Label>
                    <Input value={newContactName} onChange={(e) => setNewContactName(e.target.value)} placeholder="Nome completo" className="mt-1.5 h-10 rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[12px] font-medium">E-mail</Label>
                      <Input value={newContactEmail} onChange={(e) => setNewContactEmail(e.target.value)} placeholder="email@exemplo.com" type="email" className="mt-1.5 h-10 rounded-xl" />
                    </div>
                    <div>
                      <Label className="text-[12px] font-medium">Telefone</Label>
                      <Input value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} placeholder="(84) 99999-0000" type="tel" className="mt-1.5 h-10 rounded-xl" />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground font-medium transition-colors"
                    onClick={() => { setShowNewContact(false); setNewContactName(""); setNewContactEmail(""); setNewContactPhone(""); }}
                  >
                    <X className="h-3.5 w-3.5" /> Cancelar e selecionar existente
                  </button>
                </>
              )}
            </div>

            {/* ─── CAMPOS PERSONALIZADOS ─── */}
            {visibleFields.length > 0 && (
              <div className="border border-border/40 rounded-xl p-4 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em] flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> Campos Personalizados
                  </p>
                  <button
                    type="button"
                    className="text-[12px] text-primary hover:text-primary/80 font-medium"
                    onClick={() => setShowCustomFields(!showCustomFields)}
                  >
                    {showCustomFields ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                {showCustomFields && visibleFields.map((field: any) => (
                  <div key={field.id}>
                    <Label className="text-[12px] font-medium">
                      {field.label} {field.isRequired && <span className="text-destructive">*</span>}
                    </Label>
                    {field.fieldType === "select" ? (
                      <Select value={customFieldValues[field.id] || ""} onValueChange={(v) => setCustomFieldValues(prev => ({ ...prev, [field.id]: v }))}>
                        <SelectTrigger className="mt-1.5 h-10 rounded-xl"><SelectValue placeholder={field.placeholder || "Selecionar"} /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {(field.optionsJson || []).map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : field.fieldType === "textarea" ? (
                      <textarea
                        value={customFieldValues[field.id] || ""}
                        onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                        placeholder={field.placeholder || ""}
                        className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
                      />
                    ) : field.fieldType === "checkbox" ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        <Checkbox
                          checked={customFieldValues[field.id] === "true"}
                          onCheckedChange={(checked) => setCustomFieldValues(prev => ({ ...prev, [field.id]: String(!!checked) }))}
                        />
                        <span className="text-sm">{field.placeholder || "Sim"}</span>
                      </div>
                    ) : (
                      <Input
                        value={customFieldValues[field.id] || ""}
                        onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                        placeholder={field.placeholder || ""}
                        type={field.fieldType === "number" || field.fieldType === "currency" ? "number" : field.fieldType === "date" ? "date" : field.fieldType === "email" ? "email" : field.fieldType === "url" ? "url" : "text"}
                        className="mt-1.5 h-10 rounded-xl"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full h-11 rounded-lg text-[14px] font-medium shadow-sm bg-primary hover:bg-primary/90 transition-colors text-primary-foreground"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Criando..." : "Criar Negociação"}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* CreateTaskDialog removed — replaced by TaskFormDialog component */

/* ─── Pipeline Indicators Panel ─── */
function PipelineIndicatorsPanel({ deals, tasks, stages }: { deals: any[]; tasks: any[]; stages: any[] }) {
  const TENANT_ID = useTenantId();
  const openDeals = deals.filter((d: any) => d.status === "open");
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Em andamento
  const inProgress = openDeals.length;

  // Esfriando (sem atividade nos últimos 7 dias)
  const cooling = openDeals.filter((d: any) => {
    const lastActivity = d.lastActivityAt ? new Date(d.lastActivityAt).getTime() : new Date(d.createdAt).getTime();
    return lastActivity < sevenDaysAgo;
  }).length;

  // Sem tarefas
  const dealIdsWithTasks = new Set(tasks.filter((t: any) => t.entityType === "deal" && (t.status === "pending" || t.status === "in_progress")).map((t: any) => t.entityId));
  const noTasks = openDeals.filter((d: any) => !dealIdsWithTasks.has(d.id)).length;

  // Com tarefas atrasadas
  const overdueTasks = tasks.filter((t: any) => t.entityType === "deal" && (t.status === "pending" || t.status === "in_progress") && t.dueAt && new Date(t.dueAt).getTime() < now);
  const dealIdsWithOverdue = new Set(overdueTasks.map((t: any) => t.entityId));
  const withOverdue = openDeals.filter((d: any) => dealIdsWithOverdue.has(d.id)).length;

  // Sem produtos ou serviços (valueCents = 0 ou null)
  const noProducts = openDeals.filter((d: any) => !d.valueCents || d.valueCents === 0).length;

  const indicators = [
    { label: "Em andamento", value: inProgress, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10", icon: TrendingUp },
    { label: "Esfriando", value: cooling, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", icon: Flame },
    { label: "Sem tarefas", value: noTasks, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-500/10", icon: CheckCircle2 },
    { label: "Com tarefas atrasadas", value: withOverdue, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10", icon: AlertTriangle },
    { label: "Sem produtos ou serviços", value: noProducts, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-500/10", icon: Package },
  ];

  // Per-stage breakdown
  const stageBreakdown = stages.map((stage: any) => {
    const stageDeals = openDeals.filter((d: any) => d.stageId === stage.id);
    const stageCooling = stageDeals.filter((d: any) => {
      const la = d.lastActivityAt ? new Date(d.lastActivityAt).getTime() : new Date(d.createdAt).getTime();
      return la < sevenDaysAgo;
    }).length;
    const stageNoTasks = stageDeals.filter((d: any) => !dealIdsWithTasks.has(d.id)).length;
    const stageOverdue = stageDeals.filter((d: any) => dealIdsWithOverdue.has(d.id)).length;
    return { name: stage.name, total: stageDeals.length, cooling: stageCooling, noTasks: stageNoTasks, overdue: stageOverdue };
  });

  return (
    <div className="p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Indicadores do Pipeline</h3>
      <div className="space-y-2.5">
        {indicators.map((ind) => (
          <div key={ind.label} className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl ${ind.bg}`}>
            <div className="flex items-center gap-2.5">
              <ind.icon className={`h-4 w-4 ${ind.color}`} />
              <span className="text-[13px] font-medium text-foreground">{ind.label}</span>
            </div>
            <span className={`text-sm font-bold ${ind.color}`}>{ind.value}</span>
          </div>
        ))}
      </div>

      {stageBreakdown.length > 0 && (
        <>
          <Separator className="my-4" />
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Por Etapa</h4>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {stageBreakdown.filter(s => s.total > 0).map((s) => (
              <div key={s.name} className="flex items-center justify-between text-[12px] px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="text-foreground font-medium truncate max-w-[140px]">{s.name}</span>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span title="Total">{s.total}</span>
                  {s.cooling > 0 && <span className="text-amber-500" title="Esfriando">{s.cooling}🔥</span>}
                  {s.noTasks > 0 && <span className="text-slate-400" title="Sem tarefas">{s.noTasks}📋</span>}
                  {s.overdue > 0 && <span className="text-red-500" title="Atrasadas">{s.overdue}⚠️</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Task Calendar Panel ─── */
function TaskCalendarPanel({ tasks, deals, onEditTask }: { tasks: any[]; deals: any[]; onEditTask?: (task: any) => void }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    (tasks || []).forEach((t: any) => {
      if (!t.dueAt) return;
      const d = new Date(t.dueAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const selectedTasks = selectedDate ? (tasksByDate[selectedDate] || []) : [];

  const getDealTitle = (entityId: number) => {
    const deal = deals.find((d: any) => d.id === entityId);
    return deal?.title || `Deal #${entityId}`;
  };

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Calendário de Tarefas</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-[13px] font-medium text-foreground min-w-[130px] text-center">
            {monthNames[month]} {year}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {dayNames.map((d) => (
          <div key={d} className="text-[10px] font-semibold text-muted-foreground text-center py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayTasks = tasksByDate[dateKey] || [];
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          const hasOverdue = dayTasks.some((t: any) => (t.status === "pending" || t.status === "in_progress") && new Date(t.dueAt).getTime() < Date.now());
          const hasPending = dayTasks.some((t: any) => t.status === "pending" || t.status === "in_progress");

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(dateKey === selectedDate ? null : dateKey)}
              className={`h-10 rounded-xl text-[12px] font-medium relative transition-all duration-150 ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isToday
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-foreground hover:bg-muted/60"
              }`}
            >
              {day}
              {dayTasks.length > 0 && (
                <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                  isSelected ? "bg-primary-foreground" : hasOverdue ? "bg-red-500" : hasPending ? "bg-primary" : "bg-emerald-500"
                }`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date tasks */}
      {selectedDate && (
        <>
          <Separator className="my-3" />
          <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
            {selectedTasks.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-3">Nenhuma tarefa neste dia</p>
            ) : (
              selectedTasks.map((t: any) => {
                const isOverdue = (t.status === "pending" || t.status === "in_progress") && t.dueAt && new Date(t.dueAt).getTime() < Date.now();
                return (
                  <TaskActionPopover
                    key={t.id}
                    task={t}
                    onEdit={() => onEditTask?.(t)}
                    side="left"
                    align="start"
                  >
                    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all ${
                      isOverdue ? "bg-red-50 dark:bg-red-500/10" : "bg-muted/40"
                    }`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        t.status === "done" ? "bg-emerald-500" : isOverdue ? "bg-red-500" : "bg-primary"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${t.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {t.title}
                        </p>
                        {t.entityType === "deal" && (
                          <p className="text-[11px] text-muted-foreground truncate">{getDealTitle(t.entityId)}</p>
                        )}
                      </div>
                      {isOverdue && <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 rounded-md">ATRASADA</Badge>}
                      {t.dueAt && (
                        <span className="text-[11px] text-muted-foreground flex-shrink-0">
                          {new Date(t.dueAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </TaskActionPopover>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
