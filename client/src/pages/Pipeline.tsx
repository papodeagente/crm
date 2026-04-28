import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
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
  ChevronLeft, ChevronRight, Star, Thermometer,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import DealFiltersPanel, { useDealFilters, DealFilterButton } from "@/components/DealFiltersPanel";
import { LeadScoreBadge } from "@/components/LeadScoreBadge";
import SaleCelebration from "@/components/SaleCelebration";
import GenerateChargeDialog from "@/components/deal/GenerateChargeDialog";
import ClassificationBadge from "@/components/ClassificationBadge";
import CustomFieldRenderer from "@/components/CustomFieldRenderer";
import { DatePicker } from "@/components/ui/date-picker";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import TaskFormDialog, { getTaskTypeIcon, getTaskTypeLabel } from "@/components/TaskFormDialog";
import TaskActionPopover from "@/components/TaskActionPopover";
import { formatDate, formatDateTime, formatTime } from "../../../shared/dateUtils";
import { useSocket } from "@/hooks/useSocket";
import { MessageCircle, Send } from "lucide-react";
import BulkWhatsAppDialog from "@/components/BulkWhatsAppDialog";
import BulkActionsBar from "@/components/BulkActionsBar";

type ViewMode = "kanban" | "list";
type SortMode = "created_desc" | "created_asc" | "value_desc" | "value_asc";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  open: { bg: "bg-violet-50 dark:bg-violet-500/15", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  won: { bg: "bg-emerald-50 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  lost: { bg: "bg-red-50 dark:bg-red-500/15", text: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
};

const categoryLabels: Record<string, string> = {
  servico: "Servico", pacote: "Pacote", consulta: "Consulta", procedimento: "Procedimento",
  assinatura: "Assinatura", produto: "Produto", other: "Outro",
};

const categoryIcons: Record<string, string> = {
  servico: "\uD83D\uDCCB", pacote: "\uD83D\uDCE6", consulta: "\uD83D\uDCDD", procedimento: "\u2695\uFE0F",
  assinatura: "\uD83D\uDD04", produto: "\uD83D\uDED2", other: "\uD83D\uDCE6",
};

function getStatusStyle(status: string) {
  return statusColors[status] || statusColors["open"];
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

// formatDate and formatDateTime imported from shared/dateUtils (UTC-3)

export default function Pipeline() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { const v = sessionStorage.getItem("pipelineViewMode"); return (v === "kanban" || v === "list") ? v : "kanban"; } catch { return "kanban"; }
  });
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    try { return sessionStorage.getItem("pipelineStatusFilter") || "open"; } catch { return "open"; }
  });
  const [pipelineInitialized, setPipelineInitialized] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    try { const v = sessionStorage.getItem("pipelineSortMode"); return (v as SortMode) || "created_desc"; } catch { return "created_desc"; }
  });
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState<{ dealId?: number; dealTitle?: string; editTask?: any; editAssigneeIds?: number[]; showDealSelector?: boolean } | null>(null);
  const [, setLocation] = useLocation();
  const [draggedDealId, setDraggedDealId] = useState<number | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<number | null>(null);
  const [selectedDealIds, setSelectedDealIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [allMatchingFilter, setAllMatchingFilter] = useState(false);
  const [listTab, setListTab] = useState<"active" | "trash">("active");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const dealFilters = useDealFilters();
  const [ownerFilter, setOwnerFilter] = useState<number | "all" | "mine">(() => {
    try {
      const v = sessionStorage.getItem("pipelineOwnerFilter");
      if (!v) return "mine";
      if (v === "all" || v === "mine") return v;
      const n = Number(v);
      return isNaN(n) ? "mine" : n;
    } catch { return "mine"; }
  });
  const saasMe = trpc.saasAuth.me.useQuery(undefined, { retry: 1, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });
  const isAdmin = saasMe.data?.role === "admin" || saasMe.data?.isSuperAdmin;
  // Resolve "mine" to the actual userId for the backend filter
  const effectiveOwnerFilter = ownerFilter === "mine" ? (saasMe.data?.userId ?? "all") : ownerFilter;
  const [showIndicators, setShowIndicators] = useState(false);
  const [celebration, setCelebration] = useState<{ open: boolean; title?: string; value?: string }>({ open: false });
  const [showTaskCalendar, setShowTaskCalendar] = useState(false);

  // Bulk WhatsApp states
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const activeSession = trpc.crm.deals.activeSession.useQuery(undefined, { enabled: bulkDialogOpen });
  const bulkSend = trpc.crm.deals.bulkWhatsApp.useMutation({
    onSuccess: () => { setBulkDialogOpen(false); setProgressDialogOpen(true); toast.success("Disparo iniciado!"); },
    onError: (e: any) => toast.error(e.message || "Erro ao iniciar disparo"),
  });
  const bulkProgress = trpc.crm.deals.bulkProgress.useQuery(undefined, { enabled: progressDialogOpen, refetchInterval: progressDialogOpen ? 2000 : false });
  const cancelBulk = trpc.crm.deals.cancelBulk.useMutation({
    onSuccess: () => toast.info("Envio cancelado"),
    onError: (e: any) => toast.error(e.message),
  });
  const sessionConnected = activeSession.data?.status === "connected";
  const sessionConnecting = activeSession.data?.status === "connecting";
  const dealTemplateVars = [
    { var: "{nome}", desc: "Nome do contato principal" },
    { var: "{primeiro_nome}", desc: "Primeiro nome do contato" },
    { var: "{email}", desc: "E-mail do contato" },
    { var: "{telefone}", desc: "Telefone do contato" },
    { var: "{negociacao}", desc: "Título da negociação" },
    { var: "{valor}", desc: "Valor da negociação" },
    { var: "{etapa}", desc: "Etapa do funil" },
    { var: "{empresa}", desc: "Empresa do contato" },
    { var: "{nome_oportunidade}", desc: "Nome/título da oportunidade (deal)" },
    { var: "{produto_principal}", desc: "Produto de maior valor vinculado" },
  ];
  const dealPreviewReplacements: Record<string, string> = {
    "{nome}": "João da Silva",
    "{primeiro_nome}": "João",
    "{email}": "joao@email.com",
    "{telefone}": "(11) 99999-0000",
    "{negociacao}": "Pacote Cancún",
    "{valor}": "R$ 5.000,00",
    "{etapa}": "Proposta Enviada",
    "{empresa}": "Clinica Exemplo",
    "{nome_oportunidade}": "Pacote Cancún",
    "{produto_principal}": "Passagem Aérea Cancún",
  };

  // Listen for sale celebration events from DealDrawer
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setCelebration({ open: true, title: detail?.title, value: detail?.value });
    };
    window.addEventListener("sale-celebration", handler);
    return () => window.removeEventListener("sale-celebration", handler);
  }, []);
  const crmUsers = trpc.admin.users.list.useQuery();

  const utils = trpc.useUtils();
  const pipelines = trpc.crm.pipelines.list.useQuery({});

  // Load user's default pipeline preference
  const defaultPipelinePref = trpc.preferences.get.useQuery(
    { key: "default_pipeline_id" },
    { enabled: true }
  );
  const setDefaultPipelineMut = trpc.preferences.set.useMutation({
    onSuccess: () => {
      utils.preferences.get.invalidate({ key: "default_pipeline_id" });
      toast.success("Funil padrão salvo!");
    },
  });

  // Auto-select pipeline on load: prioritize last visited > default preference > first sales pipeline
  useEffect(() => {
    if (pipelineInitialized || !pipelines.data?.length) return;
    // 1. Check if there's a last visited pipeline in sessionStorage
    const lastVisited = sessionStorage.getItem("lastVisitedPipelineId");
    if (lastVisited) {
      const lastId = Number(lastVisited);
      const exists = pipelines.data.find((p: any) => p.id === lastId && !p.isArchived);
      if (exists) {
        setSelectedPipelineId(lastId);
        setPipelineInitialized(true);
        return;
      }
    }
    // 2. Check user's default pipeline preference
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
    // 3. Fallback: first sales pipeline or first pipeline
    const salesPipeline = pipelines.data.find((p: any) => p.pipelineType === "sales" && !p.isArchived);
    setSelectedPipelineId(salesPipeline?.id ?? pipelines.data[0]?.id ?? null);
    setPipelineInitialized(true);
  }, [pipelines.data, defaultPipelinePref.data, pipelineInitialized]);

  // Persist selected pipeline to sessionStorage whenever it changes
  useEffect(() => {
    if (selectedPipelineId) {
      sessionStorage.setItem("lastVisitedPipelineId", String(selectedPipelineId));
    }
  }, [selectedPipelineId]);

  // Persist pipeline filters to sessionStorage for navigation persistence
  useEffect(() => { try { sessionStorage.setItem("pipelineViewMode", viewMode); } catch {} }, [viewMode]);
  useEffect(() => { try { sessionStorage.setItem("pipelineStatusFilter", statusFilter); } catch {} }, [statusFilter]);
  useEffect(() => { try { sessionStorage.setItem("pipelineOwnerFilter", String(ownerFilter)); } catch {} }, [ownerFilter]);
  useEffect(() => { try { sessionStorage.setItem("pipelineSortMode", sortMode); } catch {} }, [sortMode]);
  const activePipeline = selectedPipelineId
    ? pipelines.data?.find((p: any) => p.id === selectedPipelineId)
    : pipelines.data?.[0];

  const stages = trpc.crm.pipelines.stages.useQuery(
    { pipelineId: activePipeline?.id ?? 0 },
    { enabled: !!activePipeline }
  );

  const deals = trpc.crm.deals.list.useQuery(
    {
      pipelineId: activePipeline?.id,
      limit: 5000,
      status: statusFilter !== "all" ? statusFilter : undefined,
      ...dealFilters.filters,
      ...(effectiveOwnerFilter !== "all" ? { ownerUserId: effectiveOwnerFilter as number } : {}),
    },
    { enabled: !!activePipeline }
  );

  const contacts = trpc.crm.contacts.list.useQuery({ limit: 200 });
  const allAccounts = trpc.crm.accounts.list.useQuery();
  // Optimized: aggregated overdue/pending counts per deal for Kanban cards
  const overdueSummary = trpc.crm.tasks.overdueSummary.useQuery({});
  const pendingCounts = trpc.crm.tasks.pendingCounts.useQuery();
  // WhatsApp unread counts per contact (for deal card badges)
  const waUnread = trpc.crm.dealWhatsApp.unreadByContact.useQuery(undefined,
    { refetchInterval: 60000, staleTime: 30000, refetchIntervalInBackground: false }
  );
  // Real-time: refetch unread counts when a new WhatsApp message arrives
  const { lastMessage: wsLastMessage } = useSocket();
  useEffect(() => {
    if (wsLastMessage) {
      waUnread.refetch();
    }
  }, [wsLastMessage]);
  // Full tasks for calendar and indicators panels
  const allTasks = trpc.crm.tasks.list.useQuery({},
    { enabled: showIndicators || showTaskCalendar }
  );

  const deletedDeals = trpc.crm.deals.listDeleted.useQuery({},
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
      const prev = utils.crm.deals.list.getData({ pipelineId: activePipeline?.id, limit: 5000, status: statusFilter !== "all" ? statusFilter : undefined });
      utils.crm.deals.list.setData(
        { pipelineId: activePipeline?.id, limit: 5000, status: statusFilter !== "all" ? statusFilter : undefined },
        (old: any) => {
          if (!old) return old;
          if (old.items) return { ...old, items: old.items.map((d: any) => d.id === dealId ? { ...d, stageId: toStageId } : d) };
          return old;
        }
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        utils.crm.deals.list.setData({ pipelineId: activePipeline?.id, limit: 5000, status: statusFilter !== "all" ? statusFilter : undefined }, ctx.prev);
      }
      toast.error("Erro ao mover negociação");
    },
    onSettled: () => { utils.crm.deals.list.invalidate(); },
  });

  const dealItems = deals.data?.items || deals.data as any || [];
  const sortedDeals = useMemo(() => {
    if (!dealItems || !Array.isArray(dealItems)) return [];
    let filtered = [...dealItems];
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
  }, [dealItems, statusFilter, sortMode]);

  const totalDeals = sortedDeals.length;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(totalDeals / itemsPerPage));
  const paginatedDeals = useMemo(() => {
    if (viewMode !== "list") return sortedDeals;
    const start = (currentPage - 1) * itemsPerPage;
    return sortedDeals.slice(start, start + itemsPerPage);
  }, [sortedDeals, currentPage, itemsPerPage, viewMode]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, sortMode, dealFilters.filters, effectiveOwnerFilter, activePipeline?.id]);

  const handleDragStart = useCallback((e: React.DragEvent, dealId: number) => {
    setDraggedDealId(dealId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(dealId));
  }, []);

  const handleDragEnd = useCallback((_e: React.DragEvent) => {
    setDraggedDealId(null);
    setDragOverStageId(null);
  }, []);

  // Safety: also clear drag state on any mouseup/pointerup to prevent stuck opacity
  useEffect(() => {
    const clearDrag = () => {
      setDraggedDealId(null);
      setDragOverStageId(null);
    };
    document.addEventListener("drop", clearDrag);
    document.addEventListener("dragend", clearDrag);
    return () => {
      document.removeEventListener("drop", clearDrag);
      document.removeEventListener("dragend", clearDrag);
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStageId(stageId);
  }, []);

  const handleDragLeave = useCallback(() => { setDragOverStageId(null); }, []);

  const [chargeDialogDealId, setChargeDialogDealId] = useState<number | null>(null);

  const handleDrop = useCallback((e: React.DragEvent, toStageId: number) => {
    e.preventDefault();
    setDragOverStageId(null);
    const dealId = Number(e.dataTransfer.getData("text/plain"));
    if (!dealId || !stages.data) return;
    const deal = sortedDeals.find((d: any) => d.id === dealId);
    if (!deal || deal.stageId === toStageId) return;
    const fromStage = stages.data.find((s: any) => s.id === deal.stageId);
    const toStage = stages.data.find((s: any) => s.id === toStageId);
    setDraggedDealId(null);
    moveStage.mutate({
      dealId, fromStageId: deal.stageId, toStageId,
      fromStageName: fromStage?.name || "Desconhecida", toStageName: toStage?.name || "Desconhecida",
    }, {
      onSuccess: () => {
        // Se a etapa de destino marca como ganho e o deal ainda não tem cobrança, abre dialog
        if (toStage?.isWon && !deal.asaasPaymentId) {
          setChargeDialogDealId(dealId);
        }
      },
    });
    toast.success(`Movido para "${toStage?.name}"`);
  }, [sortedDeals, stages.data, moveStage]);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Toolbar — Linha 1: Toggle view + ações */}
      <div className="border-b border-border/40">
        <div className="flex items-center gap-2 px-3 sm:px-5 lg:px-8 py-2.5 flex-wrap">
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
            <PopoverContent align="end" className="w-[calc(100vw-2rem)] sm:w-[420px] p-0 rounded-2xl shadow-xl border-border/50">
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
            <PopoverContent align="end" className="w-[calc(100vw-2rem)] sm:w-[520px] p-0 rounded-2xl shadow-xl border-border/50">
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
              {isAdmin && (
                <DropdownMenuItem onClick={() => { toast.info("Exportação em breve!"); }}>
                  <Download className="h-4 w-4 mr-2" /> Exportar dados
                </DropdownMenuItem>
              )}
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
        <div className="flex items-center gap-2 sm:gap-2.5 px-3 sm:px-5 lg:px-8 pb-3 overflow-x-auto">
          {/* Pipeline selector */}
          <div className="flex items-center gap-1.5 min-w-[140px] sm:flex-1">
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
                      setDefaultPipelineMut.mutate({ key: "default_pipeline_id", value: String(activePipeline.id) });
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
          <Select value={ownerFilter === "mine" ? "mine" : String(effectiveOwnerFilter)} onValueChange={(v) => {
            if (v === "mine") setOwnerFilter("mine");
            else if (v === "all") setOwnerFilter("all");
            else setOwnerFilter(Number(v));
          }}>
            <SelectTrigger className="min-w-[130px] sm:flex-1 h-10 text-[13px] rounded-xl border-border/50 bg-background">
              <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground flex-shrink-0" />
              <SelectValue placeholder="Minhas negociações" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="mine">Minhas negociações</SelectItem>
              <SelectItem value="all">Todas as negociações</SelectItem>
              {crmUsers.data?.filter((u: any) => u.id !== saasMe.data?.userId).map((u: any) => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="min-w-[110px] sm:flex-1 h-10 text-[13px] rounded-xl border-border/50 bg-background">
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
            <SelectTrigger className="min-w-[130px] sm:flex-1 h-10 text-[13px] rounded-xl border-border/50 bg-background hidden sm:flex">
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
        <div className="px-3 sm:px-5 lg:px-8 pb-2">
          <span className="text-[12px] font-medium text-muted-foreground">{totalDeals} Negociações · {statusFilter === 'all' ? 'Todos' : statusFilter === 'open' ? 'Em andamento' : statusFilter === 'won' ? 'Ganhos' : 'Perdidos'}</span>
        </div>
      </div>

      {/* Kanban Board */}
      {viewMode === "kanban" ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden bg-background">
          <div className="flex gap-3 sm:gap-4 p-3 sm:p-5 lg:px-8 h-full min-w-max">
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
                const coolingMs = stage.coolingEnabled && stage.coolingDays ? (stage.coolingDays as number) * 86400000 : 0;

                return (
                  <div
                    key={stage.id}
                    className="w-[280px] sm:w-[310px] flex-shrink-0 flex flex-col h-full"
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
                        {stageDeals.map((deal: any) => {
                          const dealCooling = coolingMs > 0 && deal.status === "open" ? (() => {
                            const lastAct = deal.lastActivityAt ? new Date(deal.lastActivityAt).getTime() : new Date(deal.createdAt).getTime();
                            return (Date.now() - lastAct) > coolingMs;
                          })() : false;
                          return (
                          <DealCard
                            key={deal.id}
                            deal={deal}
                            contacts={(contacts.data as any)?.items || contacts.data || []}
                            accounts={allAccounts.data || []}
                            overdueData={(overdueSummary.data as any)?.[deal.id] || null}
                            pendingCount={(pendingCounts.data as any)?.[deal.id] || 0}
                            waUnreadCount={deal.contactId ? ((waUnread.data as any)?.[deal.contactId] || 0) : 0}
                            onCreateTask={() => setShowTaskForm({ dealId: deal.id, dealTitle: deal.title })}
                            onOpenDeal={() => setLocation(`/deal/${deal.id}`)}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            isDragging={draggedDealId === deal.id}
                            isCooling={dealCooling}
                          />)
                        })}
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

            {selectedDealIds.size > 0 && listTab === "trash" && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[13px] text-muted-foreground font-medium">{selectedDealIds.size} selecionada(s)</span>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px] rounded-lg" onClick={() => restoreDeals.mutate({ ids: Array.from(selectedDealIds) })}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-[12px] rounded-lg" onClick={() => setSelectedDealIds(new Set())}>
                  Limpar seleção
                </Button>
              </div>
            )}
          </div>

          {/* Bulk Actions Bar for active tab */}
          {listTab === "active" && selectedDealIds.size > 0 && (
            <div className="mb-3">
              <BulkActionsBar
                selectedCount={allMatchingFilter ? (totalDeals - ([] as number[]).length) : selectedDealIds.size}
                allMatchingFilter={allMatchingFilter}
                totalFilterCount={totalDeals}
                onClearSelection={() => { setSelectedDealIds(new Set()); setAllMatchingFilter(false); }}
                onSelectAllFilter={() => {
                  setAllMatchingFilter(true);
                  setSelectedDealIds(new Set(sortedDeals.map((d: any) => d.id)));
                }}
                selectedIds={Array.from(selectedDealIds)}
                exclusionIds={[]}
                filterSnapshot={{
                  pipelineId: activePipeline?.id,
                  status: statusFilter !== "all" ? statusFilter : undefined,
                  ...dealFilters.filters,
                  ...(effectiveOwnerFilter !== "all" ? { ownerUserId: effectiveOwnerFilter as number } : {}),
                }}
                stages={stages.data || []}
                users={(crmUsers.data || []).map((u: any) => ({ id: u.id, name: u.name, userId: u.userId }))}
                accounts={(allAccounts.data || []).map((a: any) => ({ id: a.id, name: a.name }))}
                onActionComplete={() => {
                  setSelectedDealIds(new Set());
                  setAllMatchingFilter(false);
                  utils.crm.deals.list.invalidate();
                  utils.crm.deals.listDeleted.invalidate();
                }}
                onWhatsApp={() => setBulkDialogOpen(true)}
              />
            </div>
          )}

          {listTab === "active" && (<>
            <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3.5 w-10">
                      <Checkbox
                        checked={paginatedDeals.length > 0 && paginatedDeals.every((d: any) => selectedDealIds.has(d.id))}
                        onCheckedChange={() => toggleSelectAll(paginatedDeals.map((d: any) => d.id))}
                      />
                    </th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Negociação</th>
                    <th className="text-center p-3.5 font-semibold text-muted-foreground w-14">Resp.</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Contato</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Etapa</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Status</th>
                    <th className="text-right p-3.5 font-semibold text-muted-foreground">Valor</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDeals.map((deal: any) => {
                    const contact = ((contacts.data as any)?.items || contacts.data || []).find((c: any) => c.id === deal.contactId);
                    const stage = (stages.data || []).find((s: any) => s.id === deal.stageId);
                    const style = getStatusStyle(deal.status);
                    const isSelected = selectedDealIds.has(deal.id);
                    const owner = (crmUsers.data || []).find((u: any) => u.id === deal.ownerUserId);
                    const ownerInitials = owner ? owner.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() : "?";
                    return (
                      <tr key={deal.id} className={`border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer ${isSelected ? "bg-primary/5" : ""}`}>
                        <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectDeal(deal.id)} />
                        </td>
                        <td className="p-3.5 font-medium" onClick={() => setLocation(`/deal/${deal.id}`)}>{deal.title}</td>
                        <td className="p-3.5 text-center" onClick={() => setLocation(`/deal/${deal.id}`)}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                                {owner?.avatarUrl ? (
                                  <img src={owner.avatarUrl} alt={owner.name} className="h-7 w-7 rounded-full object-cover" />
                                ) : ownerInitials}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">{owner?.name || "Sem responsável"}</TooltipContent>
                          </Tooltip>
                        </td>
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
                  {paginatedDeals.length === 0 && (
                    <tr><td colSpan={8} className="p-12 text-center text-muted-foreground text-sm">Nenhuma negociação encontrada.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>

            {/* Pagination */}
            {totalDeals > 0 && (
              <div className="flex items-center justify-between mt-4 px-1">
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <span>Exibindo {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, totalDeals)} de {totalDeals}</span>
                  <span className="text-border">|</span>
                  <span>Itens por página:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="bg-muted/50 border border-border/50 rounded-lg px-2 py-1 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={page}
                        variant={page === currentPage ? "default" : "outline"}
                        size="sm"
                        className={`h-8 w-8 p-0 rounded-lg text-[13px] ${page === currentPage ? "" : ""}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>)}

          {listTab !== "active" && (
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
                    const contact = ((contacts.data as any)?.items || contacts.data || []).find((c: any) => c.id === deal.contactId);
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
                bulkDeleteDeals.mutate({ ids: Array.from(selectedDealIds) });
                setShowDeleteConfirm(false);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogs */}
      <SaleCelebration
        open={celebration.open}
        onClose={() => setCelebration({ open: false })}
        dealTitle={celebration.title}
        dealValue={celebration.value}
      />
      <GenerateChargeDialog
        dealId={chargeDialogDealId}
        open={!!chargeDialogDealId}
        onOpenChange={(o) => { if (!o) setChargeDialogDealId(null); }}
      />
      <CreateDealDialog open={showCreateDeal} onOpenChange={setShowCreateDeal} pipelineId={activePipeline?.id} stages={stages.data || []} contacts={(contacts.data as any)?.items || contacts.data || []} accounts={allAccounts.data || []} pipelines={pipelines.data?.filter((p: any) => !p.isArchived) || []} />
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

      {/* Bulk WhatsApp Dialog */}
      <BulkWhatsAppDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedCount={selectedDealIds.size}
        sessionConnected={sessionConnected}
        sessionConnecting={sessionConnecting}
        templateVars={dealTemplateVars}
        previewReplacements={dealPreviewReplacements}
        onSend={(params) => {
          bulkSend.mutate({
            dealIds: Array.from(selectedDealIds),
            messageTemplate: params.messageTemplate,
            sessionId: activeSession.data?.sessionId || "",
            delayMs: params.delayMs,
            randomDelay: params.randomDelay,
          });
        }}
        isSending={bulkSend.isPending}
        progress={bulkProgress.data as any}
        progressOpen={progressDialogOpen}
        onProgressOpenChange={setProgressDialogOpen}
        onCancel={() => cancelBulk.mutate()}
        isCancelling={cancelBulk.isPending}
        onClearSelection={() => setSelectedDealIds(new Set())}
        entityLabel="negociações"
      />
    </div>
  );
}

/* ─── Deal Card ─── */
function DealCard({ deal, contacts, accounts, overdueData, pendingCount, waUnreadCount, onCreateTask, onOpenDeal, onDragStart, onDragEnd, isDragging, isCooling }: {
  deal: any; contacts: any[]; accounts: any[]; overdueData: { count: number; oldestTitle: string; oldestDueAt: string } | null; pendingCount: number; waUnreadCount?: number; onCreateTask: () => void; onOpenDeal: () => void;
  onDragStart: (e: React.DragEvent, dealId: number) => void; onDragEnd: (e: React.DragEvent) => void; isDragging: boolean; isCooling?: boolean;
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
      className={`rounded-xl border p-3 shadow-[0_1px_3px_oklch(0_0_0/0.05)] hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing ${isCooling ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60 ring-1 ring-amber-200 dark:ring-amber-800/40" : "bg-card border-border/50"} ${isDragging ? "ring-2 ring-primary/40 border-primary/30 scale-[0.98]" : ""}`}
    >
      {/* Row 1: Status badge + info icon */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-2 py-0.5 rounded-md ${style.bg} ${style.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
            {deal.status === "open" ? "Em andamento" : deal.status === "won" ? "Ganha" : "Perdida"}
          </span>
          {isCooling && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
              <Thermometer className="h-3 w-3" />
              Esfriando
            </span>
          )}
          {(waUnreadCount ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 animate-pulse">
              <MessageCircle className="h-3 w-3" />
              {waUnreadCount}
            </span>
          )}
        </div>
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

      {/* Row 2: Deal title (bold, clickable) + LeadScore badge */}
      <div className="flex items-start gap-1.5">
        <p className="font-bold text-[13px] leading-snug text-foreground cursor-pointer hover:text-primary transition-colors flex-1" onClick={onOpenDeal}>
          {deal.title}
        </p>
        <LeadScoreBadge score={(deal as any).aiLeadScore} reason={(deal as any).aiLeadScoreReason} size="sm" showLabel={false} className="shrink-0 mt-0.5" />
      </div>

      {/* Row 2b: Contact name — prefer deal.contactName from server JOIN (always present) */}
      {(deal.contactName || contact?.name) && (
        <p className="text-[11.5px] text-muted-foreground truncate mb-1.5">
          <User className="inline h-3 w-3 mr-1 -mt-0.5" />
          {deal.contactName || contact?.name || "Sem nome"}
        </p>
      )}

      {/* Row 3: Value + Date on same line */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2">
        {deal.valueCents > 0 && (
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <DollarSign className="h-3 w-3 text-emerald-500" />
            {formatCurrency(deal.valueCents)}
          </span>
        )}
        <span className="flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" />
          {formatDate(deal.createdAt)}
        </span>
      </div>

      {/* Row 4: Task section — overdue (pink), pending (subtle), or create */}
      {hasOverdue ? (
        <div className="bg-pink-100 dark:bg-pink-900/40 rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-[11px]">
          <OverdueIcon className="h-3.5 w-3.5 shrink-0 text-pink-700 dark:text-pink-300" />
          <span className="font-medium text-pink-800 dark:text-pink-200 truncate flex-1">
            {overdueData.oldestTitle}
          </span>
          <span className="text-pink-600 dark:text-pink-400 whitespace-nowrap text-[10px]">
            {formatDateTime(overdueData.oldestDueAt)}
          </span>
        </div>
      ) : hasPending ? (
        <div className="flex items-center gap-1.5 text-[11px] bg-muted/60 dark:bg-muted/30 px-2.5 py-1.5 rounded-lg">
          <Clock className="h-3 w-3 shrink-0 text-primary" />
          <span className="truncate flex-1 text-muted-foreground font-medium">{pendingCount} tarefa{pendingCount > 1 ? "s" : ""} pendente{pendingCount > 1 ? "s" : ""}</span>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onCreateTask(); }}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 hover:text-primary w-full justify-center py-1.5 border border-dashed border-border/40 rounded-lg hover:border-primary/40 transition-all duration-150"
        >
          <Plus className="h-3 w-3" />
          Criar Tarefa
        </button>
      )}

      {/* Extra overdue count */}
      {hasOverdue && overdueData.count > 1 && (
        <div className="flex items-center gap-1 text-[10px] text-red-500 dark:text-red-400 mt-1 pl-0.5">
          <AlertTriangle className="h-2.5 w-2.5" />
          <span>+{overdueData.count - 1} atrasada{overdueData.count - 1 > 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Row 5: Classification badge — discrete, small */}
      {contact && contact.stageClassification && contact.stageClassification !== "desconhecido" && (
        <div className="mt-1 pt-1.5 border-t border-border/30">
          <ClassificationBadge
            classification={contact.stageClassification}
            variant="badge"
            size="sm"
            showIcon={true}
            showLabel={true}
            referralWindowActive={!!contact.referralWindowStart && (Date.now() - new Date(contact.referralWindowStart).getTime()) < 90 * 24 * 60 * 60 * 1000}
          />
        </div>
      )}
    </div>
  );
}

/* ═══ DEAL DRAWER ═══ */
function DealDrawer({ dealId, onClose, contacts, accounts, stages }: {
  dealId: number; onClose: () => void; contacts: any[]; accounts: any[]; stages: any[];
}) {
  const utils = trpc.useUtils();
  const deal = trpc.crm.deals.get.useQuery({ id: dealId });
  const products = trpc.crm.deals.products.list.useQuery({ dealId });
  const history = trpc.crm.deals.history.list.useQuery({ dealId });
  const participants = trpc.crm.deals.participants.list.useQuery({ dealId });
  const dealTasks = trpc.crm.tasks.list.useQuery({ entityType: "deal", entityId: dealId });
  const dealNotes = trpc.crm.notes.list.useQuery({ entityType: "deal", entityId: dealId });
  const lossReasonsQ = trpc.crm.lossReasons.list.useQuery({});
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
      utils.crm.deals.get.invalidate({ id: dealId });
      utils.crm.deals.list.invalidate();
      utils.crm.deals.history.list.invalidate({ dealId });
      toast.success("Negociação atualizada!");
    },
  });

  const createProduct = trpc.crm.deals.products.create.useMutation({
    onSuccess: () => {
      utils.crm.deals.products.list.invalidate({ dealId });
      utils.crm.deals.history.list.invalidate({ dealId });
      toast.success("Produto adicionado!");
    },
  });

  const deleteProduct = trpc.crm.deals.products.delete.useMutation({
    onSuccess: () => {
      utils.crm.deals.products.list.invalidate({ dealId });
      utils.crm.deals.history.list.invalidate({ dealId });
      toast.success("Produto removido!");
    },
  });

  const addParticipant = trpc.crm.deals.participants.add.useMutation({
    onSuccess: () => {
      utils.crm.deals.participants.list.invalidate({ dealId });
      utils.crm.deals.history.list.invalidate({ dealId });
      toast.success("Participante adicionado!");
    },
  });

  const removeParticipant = trpc.crm.deals.participants.remove.useMutation({
    onSuccess: () => {
      utils.crm.deals.participants.list.invalidate({ dealId });
      utils.crm.deals.history.list.invalidate({ dealId });
      toast.success("Participante removido!");
    },
  });

  const createNote = trpc.crm.notes.create.useMutation({
    onSuccess: () => {
      utils.crm.notes.list.invalidate({ entityType: "deal", entityId: dealId });
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

      <div className="relative w-full max-w-full sm:max-w-[680px] bg-card shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
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
                  <SearchableCombobox
                    options={[
                      { value: "none", label: "Nenhum" },
                      ...contacts.map((c: any) => ({ value: String(c.id), label: c.name, sublabel: c.phone || c.email || undefined })),
                    ]}
                    value={d.contactId ? String(d.contactId) : "none"}
                    onValueChange={(v) => updateDeal.mutate({ id: dealId, contactId: v === "none" ? null : Number(v) })}
                    placeholder="Buscar contato..."
                    searchPlaceholder="Digite o nome do contato..."
                    className="flex-1"
                  />
                  {d.contactId && (
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={() => updateDeal.mutate({ id: dealId, contactId: null })}>
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
                  <SearchableCombobox
                    options={[
                      { value: "none", label: "Nenhuma" },
                      ...accounts.map((a: any) => ({ value: String(a.id), label: a.name })),
                    ]}
                    value={d.accountId ? String(d.accountId) : "none"}
                    onValueChange={(v) => updateDeal.mutate({ id: dealId, accountId: v === "none" ? null : Number(v) })}
                    placeholder="Buscar empresa..."
                    searchPlaceholder="Digite o nome da empresa..."
                    className="flex-1"
                  />
                  {d.accountId && (
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={() => updateDeal.mutate({ id: dealId, accountId: null })}>
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
                    } else if (v === "won") {
                      updateDeal.mutate({ id: dealId, status: "won" }, {
                        onSuccess: () => {
                          utils.crm.deals.get.invalidate({ id: dealId });
                          utils.crm.deals.list.invalidate();
                          // Trigger celebration in parent via custom event
                          window.dispatchEvent(new CustomEvent("sale-celebration", {
                            detail: { title: d.title, value: d.valueCents ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(d.valueCents / 100) : undefined }
                          }));
                        },
                      });
                    } else {
                      updateDeal.mutate({ id: dealId, status: v as any });
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
                <AddNoteForm onAdd={(body) => createNote.mutate({ entityType: "deal", entityId: dealId, body })} />
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
                          updateTaskStatus.mutate({ id: t.id, status: checked ? "done" : "pending" });
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
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => deleteProduct.mutate({ id: p.id, dealId, productName: p.name })}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive/60" />
                      </Button>
                    </div>
                  </div>
                  {p.description && <p className="text-[12px] text-muted-foreground">{p.description}</p>}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>Qtd: {p.quantity || 1}</span>
                    <span>Unit: {formatCurrency(p.unitPriceCents || 0)}</span>
                    {p.discountCents > 0 && <span className="text-destructive">Desc: -{formatCurrency(p.discountCents)}</span>}
                    {p.serviceStart && <span>Inicio do Servico: {formatDate(p.serviceStart)}</span>}
                    {p.serviceEnd && <span>Fim do Servico: {formatDate(p.serviceEnd)}</span>}
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
              <AddProductForm dealId={dealId} onAdd={(data) => createProduct.mutate({ dealId, ...data })} />
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => removeParticipant.mutate({ id: p.id, dealId })}>
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
                onAdd={(contactId, role) => addParticipant.mutate({ dealId, contactId, role: role as any })}
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
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Limpeza de Pele" className="mt-1 h-9 text-[13px] rounded-xl" />
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
  const [role, setRole] = useState("client");
  const available = contacts.filter((c: any) => !existingIds.includes(c.id));

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Adicionar Participante</p>
      <div className="flex gap-2">
        <SearchableCombobox
          options={available.map((c: any) => ({ value: String(c.id), label: c.name, sublabel: c.phone || c.email || undefined }))}
          value={contactId}
          onValueChange={setContactId}
          placeholder="Buscar contato..."
          searchPlaceholder="Digite o nome do contato..."
          className="flex-1"
        />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-[150px] h-10 text-[13px] rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="client">Cliente</SelectItem>
            <SelectItem value="decision_maker">Decisor</SelectItem>
            <SelectItem value="payer">Pagador</SelectItem>
            <SelectItem value="dependent">Dependente</SelectItem>
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
  // Deal fields
  const [title, setTitle] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState<string>(String(pipelineId || ""));
  const [stageId, setStageId] = useState<string>("");
  const [leadSource, setLeadSource] = useState<string>("");
  const [campaign, setCampaign] = useState("");

  // Service dates
  const [appointmentDate, setAppointmentDate] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

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
  const catalogProducts = trpc.productCatalog.products.list.useQuery({ isActive: true, limit: 500 });
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
  const dealCustomFields = trpc.customFields.list.useQuery({ entity: "deal" });
  const visibleFields = (dealCustomFields.data || []).filter((f: any) => f.isVisibleOnForm);

  // Load stages for selected pipeline
  const pipelineStagesQuery = trpc.crm.pipelines.stages.useQuery(
    { pipelineId: Number(selectedPipeline) },
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
    setAppointmentDate(""); setFollowUpDate("");
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
        const acc = await createAccount.mutateAsync({ name: newAccountName.trim() });
        if (acc?.id) finalAccountId = acc.id;
      }

      // 2. Create contact if needed
      let finalContactId = contactId ? Number(contactId) : undefined;
      if (showNewContact && newContactName.trim()) {
        const ct = await createContact.mutateAsync({
          name: newContactName.trim(),
          email: newContactEmail.trim() || undefined,
          phone: newContactPhone.trim() || undefined,
        });
        if (ct?.id) finalContactId = ct.id;
      }

      // 3. Create deal with products
      const deal = await createDeal.mutateAsync({
        title,
        pipelineId: Number(selectedPipeline),
        stageId: Number(stageId),
        contactId: finalContactId,
        accountId: finalAccountId,
        leadSource: leadSource || undefined,
        channelOrigin: campaign || undefined,
        appointmentDate: appointmentDate || null,
        followUpDate: followUpDate || null,
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

            {/* ─── DATAS DO SERVICO ─── */}
            <div className="border border-border/40 rounded-xl p-4 bg-muted/20 space-y-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em] flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" /> Datas do Servico
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[12px] font-medium">Agendamento</Label>
                  <DatePicker
                    value={appointmentDate}
                    onChange={setAppointmentDate}
                    placeholder="Selecionar data"
                    className="mt-1.5 h-10 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-[12px] font-medium">Retorno/Revisao</Label>
                  <DatePicker
                    value={followUpDate}
                    onChange={setFollowUpDate}
                    placeholder="Selecionar data"
                    className="mt-1.5 h-10 rounded-xl"
                  />
                </div>
              </div>
              {appointmentDate && followUpDate && new Date(followUpDate) > new Date(appointmentDate) && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.ceil((new Date(followUpDate).getTime() - new Date(appointmentDate).getTime()) / (1000 * 60 * 60 * 24))} dias de servico
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
                    <SearchableCombobox
                      options={accounts.map((a: any) => ({ value: String(a.id), label: a.name }))}
                      value={accountId}
                      onValueChange={setAccountId}
                      placeholder="Buscar empresa..."
                      searchPlaceholder="Digite o nome da empresa..."
                      className="mt-1.5"
                    />
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
                    <SearchableCombobox
                      options={contacts.map((c: any) => ({ value: String(c.id), label: c.name, sublabel: c.phone || c.email || undefined }))}
                      value={contactId}
                      onValueChange={setContactId}
                      placeholder="Buscar contato..."
                      searchPlaceholder="Digite o nome do contato..."
                      className="mt-1.5"
                    />
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
                {showCustomFields && (
                  <CustomFieldRenderer
                    fields={visibleFields}
                    values={customFieldValues}
                    onChange={(fieldId, val) => setCustomFieldValues(prev => ({ ...prev, [fieldId]: val }))}
                    mode="form"
                  />
                )}
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
                          {formatTime(t.dueAt)}
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
