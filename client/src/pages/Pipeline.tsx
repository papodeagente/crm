import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Plus, LayoutGrid, List, Calendar as CalendarIcon,
  RefreshCw, TrendingUp, Info, Filter, ArrowUpDown, Plane, X,
  DollarSign, MapPin, Clock, GripVertical, Building2, User,
  Package, History, Trash2, Pencil, Link2, Unlink,
} from "lucide-react";
import { useState, useMemo, useRef, useCallback } from "react";
import { toast } from "sonner";

const TENANT_ID = 1;

type ViewMode = "kanban" | "list";
type SortMode = "created_desc" | "created_asc" | "value_desc" | "value_asc";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  open: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  won: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  lost: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

const categoryLabels: Record<string, string> = {
  flight: "Aéreo", hotel: "Hotel", tour: "Passeio", transfer: "Transfer",
  insurance: "Seguro", cruise: "Cruzeiro", visa: "Visto", other: "Outro",
};

const categoryIcons: Record<string, string> = {
  flight: "✈️", hotel: "🏨", tour: "🗺️", transfer: "🚐",
  insurance: "🛡️", cruise: "🚢", visa: "📋", other: "📦",
};

function getStatusStyle(status: string) {
  return statusColors[status] || statusColors["open"];
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Pipeline() {
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("created_desc");
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState<number | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [draggedDealId, setDraggedDealId] = useState<number | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const pipelines = trpc.crm.pipelines.list.useQuery({ tenantId: TENANT_ID });
  const activePipeline = selectedPipelineId
    ? pipelines.data?.find((p: any) => p.id === selectedPipelineId)
    : pipelines.data?.[0];

  const stages = trpc.crm.pipelines.stages.useQuery(
    { tenantId: TENANT_ID, pipelineId: activePipeline?.id ?? 0 },
    { enabled: !!activePipeline }
  );

  const deals = trpc.crm.deals.list.useQuery(
    { tenantId: TENANT_ID, pipelineId: activePipeline?.id, limit: 200 },
    { enabled: !!activePipeline }
  );

  const contacts = trpc.crm.contacts.list.useQuery({ tenantId: TENANT_ID, limit: 200 });
  const allAccounts = trpc.crm.accounts.list.useQuery({ tenantId: TENANT_ID });
  const tasks = trpc.crm.tasks.list.useQuery({ tenantId: TENANT_ID, entityType: "deal" });

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
        utils.crm.deals.list.setData(
          { tenantId: TENANT_ID, pipelineId: activePipeline?.id, limit: 200 },
          ctx.prev
        );
      }
      toast.error("Erro ao mover negociação");
    },
    onSettled: () => {
      utils.crm.deals.list.invalidate();
    },
  });

  // Sort deals
  const sortedDeals = useMemo(() => {
    if (!deals.data) return [];
    let filtered = [...deals.data];
    if (statusFilter !== "all") {
      filtered = filtered.filter((d: any) => d.status === statusFilter);
    }
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

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, dealId: number) => {
    setDraggedDealId(dealId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(dealId));
    // Make ghost semi-transparent
    const el = e.currentTarget as HTMLElement;
    setTimeout(() => { el.style.opacity = "0.4"; }, 0);
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedDealId(null);
    setDragOverStageId(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStageId(stageId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStageId(null);
  }, []);

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
      tenantId: TENANT_ID,
      dealId,
      fromStageId: deal.stageId,
      toStageId,
      fromStageName: fromStage?.name || "Desconhecida",
      toStageName: toStage?.name || "Desconhecida",
    });

    toast.success(`Movido para "${toStage?.name}"`);
  }, [sortedDeals, stages.data, moveStage]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="border-b bg-white px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* View toggle */}
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Pipeline selector */}
          <Select
            value={String(activePipeline?.id ?? "")}
            onValueChange={(v) => setSelectedPipelineId(Number(v))}
          >
            <SelectTrigger className="w-[200px] h-9 text-sm">
              <SelectValue placeholder="Selecionar funil" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.data?.map((p: any) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="open">Em aberto</SelectItem>
              <SelectItem value="won">Ganhos</SelectItem>
              <SelectItem value="lost">Perdidos</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_desc">Criadas por último</SelectItem>
              <SelectItem value="created_asc">Criadas primeiro</SelectItem>
              <SelectItem value="value_desc">Maior valor</SelectItem>
              <SelectItem value="value_asc">Menor valor</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm">
            <Filter className="h-3.5 w-3.5" />
            Filtros (0)
          </Button>

          <div className="flex-1" />

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => utils.crm.deals.list.invalidate()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setShowCreateDeal(true)}
            className="h-9 gap-1.5 bg-cyan-500 hover:bg-cyan-600 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Criar
          </Button>
        </div>

        <div className="mt-2">
          <Badge variant="secondary" className="text-xs font-normal">{totalDeals} Negociações</Badge>
        </div>
      </div>

      {/* Kanban Board */}
      {viewMode === "kanban" ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 p-4 h-full min-w-max">
            {stages.isLoading ? (
              <p className="text-muted-foreground p-4">Carregando etapas...</p>
            ) : !stages.data?.length ? (
              <div className="flex items-center justify-center w-full text-muted-foreground">
                <p>Nenhuma etapa configurada neste pipeline.</p>
              </div>
            ) : (
              stages.data.map((stage: any) => {
                const stageDeals = sortedDeals.filter((d: any) => d.stageId === stage.id);
                const stageValue = stageDeals.reduce((sum: number, d: any) => sum + (d.valueCents || 0), 0);
                const isDragOver = dragOverStageId === stage.id;

                return (
                  <div
                    key={stage.id}
                    className="w-[320px] flex-shrink-0 flex flex-col h-full"
                    onDragOver={(e) => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, stage.id)}
                  >
                    {/* Stage header */}
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-foreground truncate max-w-[140px]">
                          {stage.name}
                        </h3>
                        <span className="text-xs text-muted-foreground">({stageDeals.length})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          {stageValue > 0 ? formatCurrency(stageValue) : "R$ 0,00"}
                        </span>
                        <button className="p-0.5 hover:bg-muted rounded" onClick={() => utils.crm.deals.list.invalidate()}>
                          <RefreshCw className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button className="p-0.5 hover:bg-muted rounded">
                          <TrendingUp className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    {/* Cards container — drop zone */}
                    <ScrollArea className={`flex-1 rounded-lg border transition-all duration-200 ${isDragOver ? "bg-cyan-50/60 border-cyan-400 ring-2 ring-cyan-200" : "bg-muted/30 border-border/40"}`}>
                      <div className="p-2 space-y-2 min-h-[200px]">
                        {stageDeals.map((deal: any) => (
                          <DealCard
                            key={deal.id}
                            deal={deal}
                            contacts={contacts.data || []}
                            tasks={(tasks.data || []).filter((t: any) => t.entityId === deal.id)}
                            onCreateTask={() => setShowCreateTask(deal.id)}
                            onOpenDrawer={() => setSelectedDealId(deal.id)}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            isDragging={draggedDealId === deal.id}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* List view */
        <div className="flex-1 overflow-auto p-4">
          <div className="bg-white rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Negociação</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Contato</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Etapa</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Valor</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {sortedDeals.map((deal: any) => {
                  const contact = (contacts.data || []).find((c: any) => c.id === deal.contactId);
                  const stage = (stages.data || []).find((s: any) => s.id === deal.stageId);
                  const style = getStatusStyle(deal.status);
                  return (
                    <tr
                      key={deal.id}
                      className="border-b hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedDealId(deal.id)}
                    >
                      <td className="p-3 font-medium">{deal.title}</td>
                      <td className="p-3 text-muted-foreground">{contact?.name || "—"}</td>
                      <td className="p-3"><Badge variant="secondary" className="text-xs">{stage?.name || "—"}</Badge></td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {deal.status === "open" ? "Em aberto" : deal.status === "won" ? "Ganho" : "Perdido"}
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium">{deal.valueCents ? formatCurrency(deal.valueCents) : "—"}</td>
                      <td className="p-3 text-muted-foreground text-xs">{formatDate(deal.createdAt)}</td>
                    </tr>
                  );
                })}
                {sortedDeals.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma negociação encontrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Deal Dialog */}
      <CreateDealDialog
        open={showCreateDeal}
        onOpenChange={setShowCreateDeal}
        pipelineId={activePipeline?.id}
        stages={stages.data || []}
        contacts={contacts.data || []}
      />

      {/* Create Task Dialog */}
      {showCreateTask !== null && (
        <CreateTaskDialog
          open={true}
          onOpenChange={() => setShowCreateTask(null)}
          dealId={showCreateTask}
        />
      )}

      {/* Deal Drawer */}
      {selectedDealId !== null && (
        <DealDrawer
          dealId={selectedDealId}
          onClose={() => setSelectedDealId(null)}
          contacts={contacts.data || []}
          accounts={allAccounts.data || []}
          stages={stages.data || []}
        />
      )}
    </div>
  );
}

/* ─── Deal Card (Draggable) ─── */
function DealCard({ deal, contacts, tasks, onCreateTask, onOpenDrawer, onDragStart, onDragEnd, isDragging }: {
  deal: any;
  contacts: any[];
  tasks: any[];
  onCreateTask: () => void;
  onOpenDrawer: () => void;
  onDragStart: (e: React.DragEvent, dealId: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  isDragging: boolean;
}) {
  const contact = contacts.find((c: any) => c.id === deal.contactId);
  const style = getStatusStyle(deal.status);
  const pendingTasks = tasks.filter((t: any) => t.status === "pending" || t.status === "in_progress");
  const nextTask = pendingTasks[0];

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onDragEnd={onDragEnd}
      className={`shadow-sm hover:shadow-md transition-all border-border/60 bg-white cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40 scale-95" : ""}`}
    >
      <CardContent className="p-3 space-y-2">
        {/* Status badge + info icon */}
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-sm ${style.bg} ${style.text}`}>
            <span className={`h-1.5 w-1.5 rounded-sm ${style.dot}`} />
            {deal.status === "open" ? "Nova" : deal.status === "won" ? "Ganha" : "Perdida"}
          </span>
          <div className="flex items-center gap-0.5">
            <button className="p-0.5 hover:bg-muted rounded" onClick={(e) => { e.stopPropagation(); onOpenDrawer(); }}>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
          </div>
        </div>

        {/* Title — clickable */}
        <p
          className="font-semibold text-sm leading-tight text-foreground cursor-pointer hover:text-primary transition-colors"
          onClick={onOpenDrawer}
        >
          {deal.title}
        </p>

        {/* Contact */}
        {contact && (
          <p className="text-xs text-muted-foreground truncate">{contact.name}</p>
        )}

        {/* Date & value row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" />
            {formatDate(deal.createdAt)}
          </span>
          {deal.valueCents > 0 && (
            <span className="flex items-center gap-1 font-medium text-foreground">
              <DollarSign className="h-3 w-3" />
              {formatCurrency(deal.valueCents)}
            </span>
          )}
        </div>

        {/* Next task */}
        {nextTask && (
          <div className="flex items-center gap-1.5 text-[11px] text-cyan-700 bg-cyan-50 px-2 py-1 rounded">
            <Clock className="h-3 w-3" />
            <span className="truncate">{nextTask.title}</span>
            {nextTask.dueAt && <span className="ml-auto shrink-0">{formatDate(nextTask.dueAt)}</span>}
          </div>
        )}

        {/* Create task button */}
        <button
          onClick={(e) => { e.stopPropagation(); onCreateTask(); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-center py-1.5 border border-dashed border-border/60 rounded-md hover:border-border transition-colors mt-1"
        >
          <Plus className="h-3 w-3" />
          Criar Tarefa
        </button>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DEAL DRAWER — Full detail panel with tabs
   ═══════════════════════════════════════════════════════════════ */
function DealDrawer({ dealId, onClose, contacts, accounts, stages }: {
  dealId: number;
  onClose: () => void;
  contacts: any[];
  accounts: any[];
  stages: any[];
}) {
  const utils = trpc.useUtils();
  const deal = trpc.crm.deals.get.useQuery({ tenantId: TENANT_ID, id: dealId });
  const products = trpc.crm.deals.products.list.useQuery({ tenantId: TENANT_ID, dealId });
  const history = trpc.crm.deals.history.list.useQuery({ tenantId: TENANT_ID, dealId });
  const participants = trpc.crm.deals.participants.list.useQuery({ tenantId: TENANT_ID, dealId });
  const dealTasks = trpc.crm.tasks.list.useQuery({ tenantId: TENANT_ID, entityType: "deal", entityId: dealId });
  const dealNotes = trpc.crm.notes.list.useQuery({ tenantId: TENANT_ID, entityType: "deal", entityId: dealId });

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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer panel */}
      <div className="relative w-full max-w-[640px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-sm ${style.bg} ${style.text}`}>
                <span className={`h-1.5 w-1.5 rounded-sm ${style.dot}`} />
                {d.status === "open" ? "Em aberto" : d.status === "won" ? "Ganha" : "Perdida"}
              </span>
              <Badge variant="secondary" className="text-[11px]">{stage?.name || "—"}</Badge>
            </div>
            <h2 className="text-lg font-bold text-foreground truncate">{d.title}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {contact && <span className="flex items-center gap-1"><User className="h-3 w-3" />{contact.name}</span>}
              {account && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{account.name}</span>}
              {(d.valueCents ?? 0) > 0 && <span className="font-semibold text-foreground">{formatCurrency(d.valueCents!)}</span>}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 h-10">
            <TabsTrigger value="details" className="text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Detalhes</TabsTrigger>
            <TabsTrigger value="products" className="text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Orçamento {products.data?.length ? `(${products.data.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="participants" className="text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Participantes {participants.data?.length ? `(${participants.data.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Histórico {history.data?.length ? `(${history.data.length})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* ─── Details Tab ─── */}
          <TabsContent value="details" className="flex-1 overflow-auto m-0">
            <div className="p-4 space-y-4">
              {/* Contact association */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Contato Associado
                </Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={d.contactId ? String(d.contactId) : "none"}
                    onValueChange={(v) => updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, contactId: v === "none" ? null : Number(v) })}
                  >
                    <SelectTrigger className="flex-1 h-9 text-sm">
                      <SelectValue placeholder="Selecionar contato..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {contacts.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {d.contactId && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, contactId: null })}>
                      <Unlink className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Account association */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Empresa Associada
                </Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={d.accountId ? String(d.accountId) : "none"}
                    onValueChange={(v) => updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, accountId: v === "none" ? null : Number(v) })}
                  >
                    <SelectTrigger className="flex-1 h-9 text-sm">
                      <SelectValue placeholder="Selecionar empresa..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {accounts.map((a: any) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {d.accountId && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, accountId: null })}>
                      <Unlink className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Status / Stage */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Status</Label>
                  <Select
                    value={d.status || "open"}
                    onValueChange={(v) => updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, status: v as any })}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Em aberto</SelectItem>
                      <SelectItem value="won">Ganho</SelectItem>
                      <SelectItem value="lost">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Valor (R$)</Label>
                  <Input
                    type="number"
                    className="h-9 text-sm"
                    defaultValue={d.valueCents ? (d.valueCents / 100).toFixed(2) : ""}
                    onBlur={(e) => {
                      const v = Math.round(parseFloat(e.target.value || "0") * 100);
                      if (v !== (d.valueCents ?? 0)) updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, valueCents: v });
                    }}
                  />
                </div>
              </div>

              <Separator />

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notas</Label>
                {(dealNotes.data || []).map((n: any) => (
                  <div key={n.id} className="bg-muted/30 rounded-lg p-3 text-sm">
                    <p>{n.body}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{formatDateTime(n.createdAt)}</p>
                  </div>
                ))}
                <AddNoteForm onAdd={(body) => createNote.mutate({ tenantId: TENANT_ID, entityType: "deal", entityId: dealId, body })} />
              </div>

              {/* Tasks */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tarefas</Label>
                {(dealTasks.data || []).map((t: any) => (
                  <div key={t.id} className={`flex items-center gap-2 text-sm p-2 rounded-lg border ${t.status === "done" ? "bg-emerald-50/50 line-through text-muted-foreground" : "bg-white"}`}>
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{t.title}</span>
                    {t.dueAt && <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(t.dueAt)}</span>}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ─── Products/Budget Tab ─── */}
          <TabsContent value="products" className="flex-1 overflow-auto m-0">
            <div className="p-4 space-y-3">
              {/* Total */}
              <div className="flex items-center justify-between bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-3 border border-cyan-100">
                <span className="text-sm font-medium text-muted-foreground">Total do Orçamento</span>
                <span className="text-lg font-bold text-foreground">{formatCurrency(totalProducts)}</span>
              </div>

              {/* Product list */}
              {(products.data || []).map((p: any) => (
                <div key={p.id} className="border rounded-lg p-3 bg-white space-y-1">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{categoryIcons[p.category] || "📦"}</span>
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">{categoryLabels[p.category] || p.category}{p.supplier ? ` • ${p.supplier}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-sm">{formatCurrency((p.unitPriceCents || 0) * (p.quantity || 1) - (p.discountCents || 0))}</span>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => deleteProduct.mutate({ tenantId: TENANT_ID, id: p.id, dealId, productName: p.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>Qtd: {p.quantity || 1}</span>
                    <span>Unit: {formatCurrency(p.unitPriceCents || 0)}</span>
                    {p.discountCents > 0 && <span className="text-red-500">Desc: -{formatCurrency(p.discountCents)}</span>}
                    {p.checkIn && <span>Check-in: {formatDate(p.checkIn)}</span>}
                    {p.checkOut && <span>Check-out: {formatDate(p.checkOut)}</span>}
                  </div>
                </div>
              ))}

              {(products.data || []).length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">Nenhum produto adicionado ao orçamento.</p>
              )}

              <Separator />

              {/* Add product form */}
              <AddProductForm dealId={dealId} onAdd={(data) => createProduct.mutate({ tenantId: TENANT_ID, dealId, ...data })} />
            </div>
          </TabsContent>

          {/* ─── Participants Tab ─── */}
          <TabsContent value="participants" className="flex-1 overflow-auto m-0">
            <div className="p-4 space-y-3">
              {(participants.data || []).map((p: any) => {
                const pc = contacts.find((c: any) => c.id === p.contactId);
                return (
                  <div key={p.id} className="flex items-center justify-between border rounded-lg p-3 bg-white">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                        {pc?.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{pc?.name || `Contato #${p.contactId}`}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{p.role?.replace("_", " ") || "outro"}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => removeParticipant.mutate({ tenantId: TENANT_ID, id: p.id, dealId })}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                );
              })}

              {(participants.data || []).length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">Nenhum participante vinculado.</p>
              )}

              <Separator />

              <AddParticipantForm
                contacts={contacts}
                existingIds={(participants.data || []).map((p: any) => p.contactId)}
                onAdd={(contactId, role) => addParticipant.mutate({ tenantId: TENANT_ID, dealId, contactId, role: role as any })}
              />
            </div>
          </TabsContent>

          {/* ─── History Tab ─── */}
          <TabsContent value="history" className="flex-1 overflow-auto m-0">
            <div className="p-4">
              {(history.data || []).length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">Nenhum registro no histórico.</p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

                  <div className="space-y-4">
                    {(history.data || []).map((h: any) => (
                      <div key={h.id} className="flex gap-3 relative">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                          h.action === "stage_moved" ? "bg-cyan-100 text-cyan-700" :
                          h.action === "created" ? "bg-emerald-100 text-emerald-700" :
                          h.action === "product_added" || h.action === "product_removed" ? "bg-amber-100 text-amber-700" :
                          h.action === "participant_added" || h.action === "participant_removed" ? "bg-purple-100 text-purple-700" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {h.action === "stage_moved" ? <TrendingUp className="h-3.5 w-3.5" /> :
                           h.action === "created" ? <Plus className="h-3.5 w-3.5" /> :
                           h.action.includes("product") ? <Package className="h-3.5 w-3.5" /> :
                           h.action.includes("participant") ? <User className="h-3.5 w-3.5" /> :
                           <History className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="text-sm font-medium">{h.description}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            <span>{h.actorName || "Sistema"}</span>
                            <span>•</span>
                            <span>{formatDateTime(h.createdAt)}</span>
                          </div>
                          {h.fromStageName && h.toStageName && (
                            <div className="flex items-center gap-2 mt-1 text-xs">
                              <Badge variant="secondary" className="text-[10px]">{h.fromStageName}</Badge>
                              <span className="text-muted-foreground">→</span>
                              <Badge className="text-[10px] bg-cyan-100 text-cyan-800 hover:bg-cyan-100">{h.toStageName}</Badge>
                            </div>
                          )}
                          {h.fieldChanged && h.oldValue && h.newValue && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <span className="line-through">{h.oldValue}</span> → <span className="font-medium text-foreground">{h.newValue}</span>
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
    </div>
  );
}

/* ─── Add Note Form ─── */
function AddNoteForm({ onAdd }: { onAdd: (body: string) => void }) {
  const [body, setBody] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Adicionar nota..."
        className="flex-1 h-9 text-sm"
        onKeyDown={(e) => { if (e.key === "Enter" && body.trim()) { onAdd(body.trim()); setBody(""); } }}
      />
      <Button size="sm" className="h-9" disabled={!body.trim()} onClick={() => { onAdd(body.trim()); setBody(""); }}>
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
      <Button variant="outline" className="w-full gap-1.5" onClick={() => setExpanded(true)}>
        <Plus className="h-4 w-4" />
        Adicionar Produto
      </Button>
    );
  }

  function handleSubmit() {
    if (!name.trim()) { toast.error("Nome do produto é obrigatório"); return; }
    const priceCents = Math.round(parseFloat(unitPrice.replace(/[^\d,]/g, "").replace(",", ".") || "0") * 100);
    onAdd({
      name: name.trim(),
      category,
      quantity: Number(quantity) || 1,
      unitPriceCents: priceCents,
      supplier: supplier || undefined,
    });
    setName(""); setCategory("other"); setQuantity("1"); setUnitPrice(""); setSupplier("");
    setExpanded(false);
  }

  return (
    <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Novo Produto</p>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Nome *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Voo SP → Cancún" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(categoryLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{categoryIcons[k]} {v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Qtd</Label>
          <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Preço unitário (R$)</Label>
          <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0,00" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Fornecedor</Label>
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Opcional" className="mt-1 h-8 text-sm" />
        </div>
      </div>
      <Button size="sm" className="w-full bg-cyan-500 hover:bg-cyan-600 text-white" onClick={handleSubmit}>
        Adicionar ao Orçamento
      </Button>
    </div>
  );
}

/* ─── Add Participant Form ─── */
function AddParticipantForm({ contacts, existingIds, onAdd }: {
  contacts: any[];
  existingIds: number[];
  onAdd: (contactId: number, role: string) => void;
}) {
  const [contactId, setContactId] = useState("");
  const [role, setRole] = useState("traveler");
  const available = contacts.filter((c: any) => !existingIds.includes(c.id));

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adicionar Participante</p>
      <div className="flex gap-2">
        <Select value={contactId} onValueChange={setContactId}>
          <SelectTrigger className="flex-1 h-9 text-sm"><SelectValue placeholder="Selecionar contato..." /></SelectTrigger>
          <SelectContent>
            {available.map((c: any) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="traveler">Viajante</SelectItem>
            <SelectItem value="decision_maker">Decisor</SelectItem>
            <SelectItem value="payer">Pagador</SelectItem>
            <SelectItem value="companion">Acompanhante</SelectItem>
            <SelectItem value="other">Outro</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm" className="h-9"
          disabled={!contactId}
          onClick={() => { onAdd(Number(contactId), role); setContactId(""); }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Create Deal Dialog ─── */
function CreateDealDialog({ open, onOpenChange, pipelineId, stages, contacts }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId?: number;
  stages: any[];
  contacts: any[];
}) {
  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [valueCents, setValueCents] = useState("");
  const [destination, setDestination] = useState("");
  const [travelDates, setTravelDates] = useState("");
  const [passengers, setPassengers] = useState("");

  const utils = trpc.useUtils();
  const createDeal = trpc.crm.deals.create.useMutation({
    onSuccess: () => {
      utils.crm.deals.list.invalidate();
      onOpenChange(false);
      resetForm();
      toast.success("Negociação criada com sucesso!");
    },
    onError: (err) => toast.error("Erro ao criar: " + err.message),
  });

  function resetForm() {
    setTitle(""); setContactId(""); setStageId(""); setValueCents("");
    setDestination(""); setTravelDates(""); setPassengers("");
  }

  function handleSubmit() {
    if (!title || !stageId || !pipelineId) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    const fullTitle = destination ? `${title} – ${destination}` : title;
    const value = valueCents ? Math.round(parseFloat(valueCents.replace(/[^\d,]/g, "").replace(",", ".")) * 100) : undefined;

    createDeal.mutate({
      tenantId: TENANT_ID,
      title: fullTitle,
      pipelineId,
      stageId: Number(stageId),
      contactId: contactId ? Number(contactId) : undefined,
      valueCents: value,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            Nova Negociação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-medium">Título da negociação *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Pacote Cancún – Família Silva" className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Contato</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Etapa do funil *</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {stages.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Plane className="h-3.5 w-3.5" />
              Dados da Viagem
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Destino</Label>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ex: Cancún, México" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium">Valor do pacote</Label>
                <Input value={valueCents} onChange={(e) => setValueCents(e.target.value)} placeholder="Ex: 4.997,00" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Datas de viagem</Label>
                <Input value={travelDates} onChange={(e) => setTravelDates(e.target.value)} placeholder="Ex: 15/03 a 22/03/2026" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium">Passageiros</Label>
                <Input value={passengers} onChange={(e) => setPassengers(e.target.value)} placeholder="Ex: 2 adultos, 1 criança" className="mt-1" />
              </div>
            </div>
          </div>

          <Button
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
            onClick={handleSubmit}
            disabled={createDeal.isPending}
          >
            {createDeal.isPending ? "Criando..." : "Criar Negociação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Create Task Dialog ─── */
function CreateTaskDialog({ open, onOpenChange, dealId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: number;
}) {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const utils = trpc.useUtils();

  const createTask = trpc.crm.tasks.create.useMutation({
    onSuccess: () => {
      utils.crm.tasks.list.invalidate();
      onOpenChange(false);
      setTitle(""); setDueAt("");
      toast.success("Tarefa criada!");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader><DialogTitle>Criar Tarefa</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-medium">Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Ligar para confirmar reserva" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium">Data de vencimento</Label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="mt-1" />
          </div>
          <Button
            className="w-full"
            disabled={!title || createTask.isPending}
            onClick={() => createTask.mutate({ tenantId: TENANT_ID, entityType: "deal", entityId: dealId, title, dueAt: dueAt || undefined })}
          >
            {createTask.isPending ? "Criando..." : "Criar Tarefa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
