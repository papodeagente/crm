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
import {
  Plus, LayoutGrid, List, MoreVertical, Calendar as CalendarIcon,
  RefreshCw, TrendingUp, Info, Filter, ArrowUpDown, Plane, Users as UsersIcon,
  DollarSign, MapPin, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const TENANT_ID = 1;

type ViewMode = "kanban" | "list";
type SortMode = "created_desc" | "created_asc" | "value_desc" | "value_asc";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  open: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  won: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  lost: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  Nova: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  "Em andamento": { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-500" },
  Perdida: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
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

export default function Pipeline() {
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("created_desc");
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState<number | null>(null);

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
  const tasks = trpc.crm.tasks.list.useQuery({ tenantId: TENANT_ID, entityType: "deal" });

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

          {/* Filter button */}
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm">
            <Filter className="h-3.5 w-3.5" />
            Filtros (0)
          </Button>

          <div className="flex-1" />

          {/* Right actions */}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => utils.crm.deals.list.invalidate()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <TrendingUp className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setShowCreateDeal(true)}
            className="h-9 gap-1.5 bg-cyan-500 hover:bg-cyan-600 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Criar
          </Button>
        </div>

        {/* Count */}
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

                return (
                  <div key={stage.id} className="w-[320px] flex-shrink-0 flex flex-col h-full">
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

                    {/* Cards container */}
                    <ScrollArea className="flex-1 rounded-lg bg-muted/30 border border-border/40">
                      <div className="p-2 space-y-2 min-h-[200px]">
                        {stageDeals.map((deal: any) => (
                          <DealCard
                            key={deal.id}
                            deal={deal}
                            contacts={contacts.data || []}
                            tasks={(tasks.data || []).filter((t: any) => t.entityId === deal.id)}
                            onCreateTask={() => setShowCreateTask(deal.id)}
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
                    <tr key={deal.id} className="border-b hover:bg-muted/20 transition-colors">
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
    </div>
  );
}

/* ─── Deal Card ─── */
function DealCard({ deal, contacts, tasks, onCreateTask }: {
  deal: any;
  contacts: any[];
  tasks: any[];
  onCreateTask: () => void;
}) {
  const contact = contacts.find((c: any) => c.id === deal.contactId);
  const style = getStatusStyle(deal.status);
  const pendingTasks = tasks.filter((t: any) => t.status === "pending" || t.status === "in_progress");
  const nextTask = pendingTasks[0];

  return (
    <Card className="shadow-sm hover:shadow-md transition-all border-border/60 bg-white">
      <CardContent className="p-3 space-y-2">
        {/* Status badge + info icon */}
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-sm ${style.bg} ${style.text}`}>
            <span className={`h-1.5 w-1.5 rounded-sm ${style.dot}`} />
            {deal.status === "open" ? "Nova" : deal.status === "won" ? "Ganha" : "Perdida"}
          </span>
          <button className="p-0.5 hover:bg-muted rounded">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Title */}
        <p className="font-semibold text-sm leading-tight text-foreground">{deal.title}</p>

        {/* Contact & company */}
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

        {/* Channel origin */}
        {deal.channelOrigin && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {deal.channelOrigin}
          </p>
        )}

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
          onClick={onCreateTask}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-center py-1.5 border border-dashed border-border/60 rounded-md hover:border-border transition-colors mt-1"
        >
          <Plus className="h-3 w-3" />
          Criar Tarefa
        </button>
      </CardContent>
    </Card>
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
  const [notes, setNotes] = useState("");

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
    setDestination(""); setTravelDates(""); setPassengers(""); setNotes("");
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
          {/* Title */}
          <div>
            <Label className="text-xs font-medium">Título da negociação *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Pacote Cancún – Família Silva" className="mt-1" />
          </div>

          {/* Contact + Stage row */}
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

          {/* Travel-specific fields */}
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

          {/* Notes */}
          <div>
            <Label className="text-xs font-medium">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações adicionais sobre a negociação..." className="mt-1 h-20 resize-none" />
          </div>

          {/* Submit */}
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
