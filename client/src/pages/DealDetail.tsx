import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { useState, useMemo, useRef, useEffect } from "react";
import WhatsAppChat from "@/components/WhatsAppChat";
import { useRoute, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, Calendar, Check, ChevronDown, ChevronRight, ChevronUp,
  Clock, Copy, DollarSign, Edit2, ExternalLink, FileText, Flag, GripVertical,
  History, Loader2, Mail, MapPin, MessageCircle, MessageSquarePlus, MoreHorizontal,
  Package, Phone, Plane, Plus, Send, ShoppingBag, ThumbsDown, ThumbsUp,
  Trash2, User, Users, X, AlertCircle, ClipboardList, Paperclip, Tag
} from "lucide-react";

const TENANT_ID = 1;

/* ─── Helpers ─── */
const categoryLabels: Record<string, string> = {
  flight: "Aéreo", hotel: "Hotel", tour: "Passeio", transfer: "Transfer",
  insurance: "Seguro", cruise: "Cruzeiro", visa: "Visto", other: "Outro",
};
const categoryIcons: Record<string, typeof Plane> = {
  flight: Plane, hotel: Building2, tour: MapPin, transfer: GripVertical,
  insurance: FileText, cruise: Plane, visa: FileText, other: Package,
};
const roleLabels: Record<string, string> = {
  decision_maker: "Decisor", traveler: "Viajante", payer: "Pagador",
  companion: "Acompanhante", other: "Outro",
};
const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "text-muted-foreground" },
  medium: { label: "Média", color: "text-yellow-500" },
  high: { label: "Alta", color: "text-orange-500" },
  urgent: { label: "Urgente", color: "text-red-500" },
};
const taskStatusLabels: Record<string, string> = {
  pending: "Pendente", in_progress: "Em andamento", done: "Concluída", cancelled: "Cancelada",
};

function fmt$(cents: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);
}
function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(d: string | Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return `${fmtDate(d)} ${fmtTime(d)}`;
}
function daysInStage(d: string | Date | null | undefined): string {
  if (!d) return "";
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "1 dia";
  return `${diff} dias`;
}

/* ════════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                   */
/* ════════════════════════════════════════════════════════════ */
export default function DealDetail() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [matched, params] = useRoute("/deal/:id");
  const dealId = params?.id ? parseInt(params.id, 10) : 0;

  /* ─── Queries ─── */
  const dealQ = trpc.crm.deals.get.useQuery({ tenantId: TENANT_ID, id: dealId }, { enabled: dealId > 0 });
  const pipelinesQ = trpc.crm.pipelines.list.useQuery({ tenantId: TENANT_ID });
  const stagesQ = trpc.crm.pipelines.stages.useQuery(
    { tenantId: TENANT_ID, pipelineId: dealQ.data?.pipelineId || 0 },
    { enabled: !!dealQ.data?.pipelineId }
  );
  const contactQ = trpc.crm.contacts.get.useQuery(
    { tenantId: TENANT_ID, id: dealQ.data?.contactId || 0 },
    { enabled: !!dealQ.data?.contactId }
  );
  const accountQ = trpc.crm.accounts.get.useQuery(
    { tenantId: TENANT_ID, id: dealQ.data?.accountId || 0 },
    { enabled: !!dealQ.data?.accountId }
  );
  const productsQ = trpc.crm.deals.products.list.useQuery({ tenantId: TENANT_ID, dealId }, { enabled: dealId > 0 });
  const participantsQ = trpc.crm.deals.participants.list.useQuery({ tenantId: TENANT_ID, dealId }, { enabled: dealId > 0 });
  const historyQ = trpc.crm.deals.history.list.useQuery({ tenantId: TENANT_ID, dealId }, { enabled: dealId > 0 });
  const tasksQ = trpc.crm.tasks.list.useQuery({ tenantId: TENANT_ID, entityType: "deal", entityId: dealId }, { enabled: dealId > 0 });
  const notesQ = trpc.crm.notes.list.useQuery({ tenantId: TENANT_ID, entityType: "deal", entityId: dealId }, { enabled: dealId > 0 });
  const contactsQ = trpc.crm.contacts.list.useQuery({ tenantId: TENANT_ID, limit: 200 });
  const accountsQ = trpc.crm.accounts.list.useQuery({ tenantId: TENANT_ID });
  const customFieldsQ = trpc.customFields.list.useQuery({ tenantId: TENANT_ID, entity: "deal" });
  const customValuesQ = trpc.contactProfile.getCustomFieldValues.useQuery(
    { tenantId: TENANT_ID, entityType: "deal", entityId: dealId },
    { enabled: dealId > 0 }
  );

  /* ─── Mutations ─── */
  const moveStage = trpc.crm.deals.moveStage.useMutation({
    onSuccess: () => { dealQ.refetch(); historyQ.refetch(); toast.success("Etapa alterada"); },
    onError: () => toast.error("Erro ao mover etapa"),
  });
  const updateDeal = trpc.crm.deals.update.useMutation({
    onSuccess: () => { dealQ.refetch(); historyQ.refetch(); toast.success("Atualizado"); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deal = dealQ.data;
  const stages = useMemo(() => (stagesQ.data || []).sort((a: any, b: any) => a.orderIndex - b.orderIndex), [stagesQ.data]);
  const currentStage = stages.find((s: any) => s.id === deal?.stageId);
  const currentStageIdx = stages.findIndex((s: any) => s.id === deal?.stageId);
  const pipeline = (pipelinesQ.data || []).find((p: any) => p.id === deal?.pipelineId);
  const contact = contactQ.data;
  const account = accountQ.data;

  /* ─── Sidebar collapsed sections ─── */
  const [sidebarSections, setSidebarSections] = useState({
    deal: true, contact: true, company: true, responsible: true, custom: false,
  });
  const toggleSection = (key: keyof typeof sidebarSections) =>
    setSidebarSections((prev) => ({ ...prev, [key]: !prev[key] }));

  /* ─── Content tabs ─── */
  const [activeTab, setActiveTab] = useState<"history" | "tasks" | "products" | "participants" | "whatsapp">("history");

  /* ─── Status dialogs ─── */
  const [showWonDialog, setShowWonDialog] = useState(false);
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [lostReason, setLostReason] = useState("");

  /* ─── Loading / Error states ─── */
  if (!matched || !dealId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Negociação não encontrada</p>
      </div>
    );
  }
  if (dealQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!deal) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Negociação não encontrada</p>
        <Button variant="outline" size="sm" onClick={() => setLocation("/pipeline")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar ao Pipeline
        </Button>
      </div>
    );
  }

  const handleMoveStage = (toStage: any) => {
    if (!currentStage || toStage.id === currentStage.id) return;
    moveStage.mutate({
      tenantId: TENANT_ID,
      dealId: deal.id,
      fromStageId: currentStage.id,
      toStageId: toStage.id,
      fromStageName: currentStage.name,
      toStageName: toStage.name,
    });
  };

  const handleMarkWon = () => {
    updateDeal.mutate({ tenantId: TENANT_ID, id: deal.id, status: "won" });
    setShowWonDialog(false);
  };

  const handleMarkLost = () => {
    updateDeal.mutate({ tenantId: TENANT_ID, id: deal.id, status: "lost" });
    setShowLostDialog(false);
    setLostReason("");
  };

  const pendingTasks = (tasksQ.data || []).filter((t: any) => t.status === "pending" || t.status === "in_progress");

  return (
    <div className="h-full flex flex-col bg-background">
      {/* ════════════════════════════════════════════════════════ */}
      {/* TOP HEADER — Title + Pipeline badge + Action buttons    */}
      {/* ════════════════════════════════════════════════════════ */}
      <div className="shrink-0 border-b border-border bg-card">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setLocation("/pipeline")}
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/60 transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground truncate">{deal.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {pipeline && (
                  <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-wider">
                    {pipeline.name}
                  </Badge>
                )}
                {deal.status !== "open" && (
                  <Badge
                    className={`text-[10px] font-semibold ${
                      deal.status === "won"
                        ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                        : "bg-red-500/15 text-red-600 border-red-500/30"
                    }`}
                    variant="outline"
                  >
                    {deal.status === "won" ? "GANHA" : "PERDIDA"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {deal.status === "open" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                  onClick={() => setShowLostDialog(true)}
                >
                  <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                  Marcar perda
                </Button>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                  onClick={() => setShowWonDialog(true)}
                >
                  <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                  Marcar venda
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════ */}
        {/* STAGE BAR — Clickable pipeline stages                   */}
        {/* ════════════════════════════════════════════════════════ */}
        {stages.length > 0 && deal.status === "open" && (
          <div className="flex items-stretch px-5 pb-3 gap-0.5 overflow-x-auto">
            {stages.map((stage: any, idx: number) => {
              const isActive = stage.id === deal.stageId;
              const isPast = idx < currentStageIdx;
              const isWon = stage.isWon;
              const isLost = stage.isLost;

              let bgClass = "bg-muted/50 dark:bg-muted/30 text-muted-foreground hover:bg-muted/80";
              if (isActive) bgClass = "bg-primary text-primary-foreground shadow-sm font-semibold";
              else if (isPast) bgClass = "bg-primary/30 text-primary dark:bg-primary/20 dark:text-primary";
              if (isWon) bgClass = isPast || isActive ? "bg-emerald-500 text-white font-semibold" : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400";
              if (isLost) bgClass = isPast || isActive ? "bg-red-500 text-white font-semibold" : "bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400";

              return (
                <button
                  key={stage.id}
                  onClick={() => handleMoveStage(stage)}
                  disabled={moveStage.isPending}
                  className={`relative flex-1 min-w-0 py-2.5 px-3 text-xs font-medium truncate transition-all
                    ${idx === 0 ? "rounded-l-lg" : ""} ${idx === stages.length - 1 ? "rounded-r-lg" : ""}
                    ${bgClass}
                    ${!isActive ? "cursor-pointer" : "cursor-default"}
                  `}
                  title={`${stage.name}${isActive ? ` (${daysInStage(deal.lastActivityAt || deal.createdAt)})` : ""}`}
                >
                  <span className="truncate block text-center">
                    {stage.name}
                    {isActive && (
                      <span className="ml-1 opacity-80">({daysInStage(deal.lastActivityAt || deal.createdAt)})</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT — Sidebar left + Content right             */}
      {/* ════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── LEFT SIDEBAR ─── */}
        <aside className="w-[380px] shrink-0 border-r border-border bg-card overflow-y-auto hidden lg:block">
          <div className="p-4 space-y-0">
            {/* ── Negociação ── */}
            <SidebarSection
              title="Negociação"
              open={sidebarSections.deal}
              onToggle={() => toggleSection("deal")}
            >
              <div className="space-y-3">
                <SidebarField label="Nome" value={deal.title} />
                <SidebarField label="Valor total" value={fmt$(deal.valueCents)} className="text-lg font-semibold" />
                <SidebarField label="Criada em" value={fmtDateTime(deal.createdAt)} />
                {deal.expectedCloseAt && (
                  <SidebarField label="Previsão de fech." value={fmtDate(deal.expectedCloseAt)} />
                )}
                <SidebarField label="Fonte" value={deal.channelOrigin || "—"} />
                <SidebarField
                  label="Status"
                  value={deal.status === "open" ? "Aberta" : deal.status === "won" ? "Ganha" : "Perdida"}
                />
              </div>
            </SidebarSection>

            <SidebarDivider />

            {/* ── Contatos ── */}
            <SidebarSection
              title="Contatos"
              open={sidebarSections.contact}
              onToggle={() => toggleSection("contact")}
            >
              {contact ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <Link href={`/contact/${contact.id}`} className="text-sm font-medium text-primary hover:underline truncate block">
                        {contact.name}
                      </Link>
                    </div>
                  </div>
                  {contact.phone && (
                    <ContactInfoRow icon={Phone} value={contact.phone} copyable whatsapp />
                  )}
                  {contact.email && (
                    <ContactInfoRow icon={Mail} value={contact.email} copyable />
                  )}
                  <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1">
                    <ChevronDown className="h-3 w-3" />
                    Informações adicionais
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => toast.info("Associe um contato na edição da negociação")}
                  className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar contato
                </button>
              )}
            </SidebarSection>

            <SidebarDivider />

            {/* ── Empresa ── */}
            <SidebarSection
              title="Empresa"
              open={sidebarSections.company}
              onToggle={() => toggleSection("company")}
            >
              {account ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">{account.name}</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Não há empresa na negociação, clique no botão abaixo para associar uma empresa
                  </p>
                  <button
                    onClick={() => toast.info("Associe uma empresa na edição da negociação")}
                    className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar empresa
                  </button>
                </div>
              )}
            </SidebarSection>

            <SidebarDivider />

            {/* ── Responsável ── */}
            <SidebarSection
              title="Responsável"
              open={sidebarSections.responsible}
              onToggle={() => toggleSection("responsible")}
            >
              <SidebarField
                label="Responsável"
                value={user?.name || "Não atribuído"}
              />
            </SidebarSection>

            <SidebarDivider />

            {/* ── Campos Personalizados ── */}
            <SidebarSection
              title="Campos personalizados"
              open={sidebarSections.custom}
              onToggle={() => toggleSection("custom")}
            >
              <CustomFieldsSidebar
                fields={customFieldsQ.data || []}
                values={customValuesQ.data || []}
                dealId={dealId}
                onRefresh={() => customValuesQ.refetch()}
              />
            </SidebarSection>
          </div>
        </aside>

        {/* ─── RIGHT CONTENT ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ── Próximas Tarefas (top card) ── */}
          <div className="shrink-0 border-b border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                Próximas tarefas
              </h3>
              <CreateTaskButton dealId={dealId} onCreated={() => tasksQ.refetch()} />
            </div>
            {pendingTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma tarefa pendente</p>
            ) : (
              <div className="space-y-2">
                {pendingTasks.slice(0, 3).map((task: any) => (
                  <TaskRow key={task.id} task={task} onUpdate={() => tasksQ.refetch()} />
                ))}
                {pendingTasks.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    Mostrando 3/{pendingTasks.length} tarefas
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Tab bar ── */}
          <div className="shrink-0 flex items-center gap-0 px-4 border-b border-border bg-card">
            {[
              { key: "history" as const, label: "Histórico", icon: History },
              { key: "tasks" as const, label: "Tarefas", icon: ClipboardList, count: (tasksQ.data || []).length },
              { key: "products" as const, label: "Produtos e Serviços", icon: ShoppingBag, count: (productsQ.data || []).length },
              { key: "participants" as const, label: "Participantes", icon: Users, count: (participantsQ.data || []).length },
              { key: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors relative
                    ${isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1 text-[10px] bg-muted/60 px-1.5 py-0.5 rounded-full">{tab.count}</span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Tab content ── */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "history" && (
              <HistoryPanel
                history={historyQ.data || []}
                notes={notesQ.data || []}
                dealId={dealId}
                onNoteCreated={() => { notesQ.refetch(); historyQ.refetch(); }}
              />
            )}
            {activeTab === "tasks" && (
              <TasksPanel
                tasks={tasksQ.data || []}
                dealId={dealId}
                onRefresh={() => tasksQ.refetch()}
              />
            )}
            {activeTab === "products" && (
              <ProductsPanel
                products={productsQ.data || []}
                dealId={dealId}
                onRefresh={() => { productsQ.refetch(); dealQ.refetch(); }}
              />
            )}
            {activeTab === "participants" && (
              <ParticipantsPanel
                participants={participantsQ.data || []}
                contacts={contactsQ.data || []}
                dealId={dealId}
                onRefresh={() => participantsQ.refetch()}
              />
            )}
            {activeTab === "whatsapp" && (
              <WhatsAppPanel contact={contact} />
            )}
          </div>
        </div>
      </div>

      {/* ── Won Dialog ── */}
      <Dialog open={showWonDialog} onOpenChange={setShowWonDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-emerald-500" />
              Marcar como venda
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja marcar a negociação <strong>"{deal.title}"</strong> como ganha?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowWonDialog(false)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleMarkWon}>
              Confirmar venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Lost Dialog ── */}
      <Dialog open={showLostDialog} onOpenChange={setShowLostDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsDown className="h-5 w-5 text-red-500" />
              Marcar como perda
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Motivo da perda (opcional):
          </p>
          <Textarea
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Ex: Cliente escolheu concorrente, preço alto..."
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLostDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleMarkLost}>
              Confirmar perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* SIDEBAR COMPONENTS                                          */
/* ════════════════════════════════════════════════════════════ */

function SidebarSection({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="py-3">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full group"
      >
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function SidebarDivider() {
  return <div className="border-b border-border" />;
}

function SidebarField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm text-foreground text-right truncate ${className || ""}`}>{value}</span>
    </div>
  );
}

function ContactInfoRow({ icon: Icon, value, copyable, whatsapp }: {
  icon: typeof Phone; value: string; copyable?: boolean; whatsapp?: boolean;
}) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast.success("Copiado!");
  };
  return (
    <div className="flex items-center gap-2 group">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-sm text-primary truncate">{value}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {copyable && (
          <button onClick={handleCopy} className="p-0.5 hover:bg-muted/60 rounded" title="Copiar">
            <Copy className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
        {whatsapp && (
          <button
            onClick={() => window.open(`https://wa.me/${value.replace(/\D/g, "")}`, "_blank")}
            className="p-0.5 hover:bg-muted/60 rounded"
            title="Abrir WhatsApp"
          >
            <MessageCircle className="h-3 w-3 text-green-500" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Custom Fields Sidebar ─── */
function CustomFieldsSidebar({ fields, values, dealId, onRefresh }: any) {
  const setValues = trpc.contactProfile.setCustomFieldValues.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Campo atualizado"); },
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");

  const visibleFields = (fields || []).filter((f: any) => f.isVisibleOnProfile || f.isVisibleOnForm);

  if (visibleFields.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhum campo personalizado configurado.{" "}
        <Link href="/settings/custom-fields" className="text-primary hover:underline">Configurar</Link>
      </p>
    );
  }

  const valuesMap = new Map((values || []).map((v: any) => [v.fieldId, v.value]));

  return (
    <div className="space-y-2.5">
      {visibleFields.map((field: any) => {
        const currentVal: string = String(valuesMap.get(field.id) || "");
        const isEditing = editingId === field.id;

        return (
          <div key={field.id} className="flex items-baseline justify-between gap-2 group">
            <span className="text-xs text-muted-foreground shrink-0 truncate max-w-[120px]">{field.label}</span>
            {isEditing ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  className="h-6 text-xs w-28"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                  setValues.mutate({
                    tenantId: TENANT_ID,
                    entityType: "deal",
                    entityId: dealId,
                    values: [{ fieldId: field.id, value: editVal }],
                  });
                      setEditingId(null);
                    }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <button
                  onClick={() => {
                    setValues.mutate({
                      tenantId: TENANT_ID,
                      entityType: "deal",
                      entityId: dealId,
                      values: [{ fieldId: field.id, value: editVal }],
                    });
                    setEditingId(null);
                  }}
                  className="p-0.5"
                >
                  <Check className="h-3 w-3 text-primary" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setEditingId(field.id); setEditVal(String(currentVal)); }}
                className="text-sm text-foreground text-right truncate hover:text-primary transition-colors"
              >
                {currentVal || "—"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* TASK COMPONENTS                                             */
/* ════════════════════════════════════════════════════════════ */

function CreateTaskButton({ dealId, onCreated }: { dealId: number; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState("medium");

  const createTask = trpc.crm.tasks.create.useMutation({
    onSuccess: () => {
      onCreated();
      setOpen(false);
      setTitle("");
      setDueAt("");
      setPriority("medium");
      toast.success("Tarefa criada");
    },
  });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="text-xs">
        <Plus className="h-3 w-3 mr-1" /> Criar tarefa
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Título da tarefa" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Prazo</label>
                <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="text-xs" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Prioridade</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              disabled={!title.trim()}
              onClick={() => createTask.mutate({
                tenantId: TENANT_ID, entityType: "deal", entityId: dealId,
                title, dueAt: dueAt || undefined, priority: priority as any,
              })}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaskRow({ task, onUpdate }: { task: any; onUpdate: () => void }) {
  const updateTask = trpc.crm.tasks.update.useMutation({
    onSuccess: () => { onUpdate(); toast.success("Tarefa atualizada"); },
  });
  const pri = priorityConfig[task.priority] || priorityConfig.medium;
  const isOverdue = task.dueAt && new Date(task.dueAt) < new Date() && task.status !== "done";

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
      isOverdue ? "border-red-500/40 bg-red-500/5 dark:bg-red-500/10" : "border-border bg-background hover:border-primary/30 hover:shadow-sm"
    }`}>
      <button
        onClick={() => updateTask.mutate({ tenantId: TENANT_ID, id: task.id, status: "done" })}
        className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 hover:border-primary hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors"
        title="Marcar como concluída"
      >
        {task.status === "done" && <Check className="h-3 w-3 text-primary" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.dueAt && (
            <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
              <Clock className="h-2.5 w-2.5" />
              Prazo: {fmtDateTime(task.dueAt)}
            </span>
          )}
          <span className={`text-[10px] ${pri.color}`}>
            <Flag className="h-2.5 w-2.5 inline mr-0.5" />{pri.label}
          </span>
        </div>
      </div>
      <Badge variant="outline" className="text-[10px] shrink-0">
        {taskStatusLabels[task.status] || task.status}
      </Badge>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* HISTORY PANEL                                               */
/* ════════════════════════════════════════════════════════════ */

function HistoryPanel({ history, notes, dealId, onNoteCreated }: {
  history: any[]; notes: any[]; dealId: number; onNoteCreated: () => void;
}) {
  const [newNote, setNewNote] = useState("");
  const createNote = trpc.crm.notes.create.useMutation({
    onSuccess: () => { onNoteCreated(); setNewNote(""); toast.success("Anotação criada"); },
  });

  // Merge history + notes into unified timeline
  const timeline = useMemo(() => {
    const items: any[] = [];
    (history || []).forEach((h: any) => {
      items.push({ type: "history", ...h, sortDate: new Date(h.createdAt).getTime() });
    });
    (notes || []).forEach((n: any) => {
      items.push({
        type: "note", id: `note-${n.id}`, action: "note",
        description: n.body, actorName: "Anotação", createdAt: n.createdAt,
        sortDate: new Date(n.createdAt).getTime(),
      });
    });
    return items.sort((a, b) => b.sortDate - a.sortDate);
  }, [history, notes]);

  const actionIcons: Record<string, typeof History> = {
    created: Plus, stage_moved: ArrowLeft, field_changed: Edit2,
    status_changed: AlertCircle, product_added: Package, product_updated: Edit2,
    product_removed: Trash2, participant_added: Users, participant_removed: Users,
    note: MessageSquarePlus,
  };
  const actionColors: Record<string, string> = {
    created: "bg-emerald-500/15 text-emerald-500",
    stage_moved: "bg-blue-500/15 text-blue-500",
    field_changed: "bg-yellow-500/15 text-yellow-500",
    status_changed: "bg-purple-500/15 text-purple-500",
    product_added: "bg-teal-500/15 text-teal-500",
    product_removed: "bg-red-500/15 text-red-500",
    participant_added: "bg-indigo-500/15 text-indigo-500",
    participant_removed: "bg-red-500/15 text-red-500",
    note: "bg-primary/15 text-primary",
  };

  return (
    <div className="p-5">
      {/* Create note */}
      <div className="flex items-start gap-3 mb-6">
        <div className="flex-1">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Criar anotação..."
            className="min-h-[60px] text-sm resize-none"
          />
        </div>
        <Button
          size="sm"
          disabled={!newNote.trim() || createNote.isPending}
          onClick={() => createNote.mutate({ tenantId: TENANT_ID, entityType: "deal", entityId: dealId, body: newNote })}
          className="mt-0"
        >
          <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />
          Criar anotação
        </Button>
      </div>

      {/* Timeline */}
      {timeline.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Nenhum histórico ainda</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-0">
            {timeline.map((item: any) => {
              const Icon = actionIcons[item.action] || History;
              const color = actionColors[item.action] || "bg-muted text-muted-foreground";
              const isNote = item.type === "note";

              return (
                <div key={item.id} className="relative flex gap-3 pb-5 pl-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    {isNote ? (
                      <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{item.description}</p>
                      </div>
                    ) : (
                      <p className="text-sm">
                        {item.actorName && <strong>{item.actorName}</strong>}{" "}
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{fmtDateTime(item.createdAt)}</span>
                    </div>
                    {item.oldValue && item.newValue && (
                      <div className="flex items-center gap-2 mt-1.5 text-xs">
                        <span className="px-1.5 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded line-through">{item.oldValue}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded">{item.newValue}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* TASKS PANEL                                                 */
/* ════════════════════════════════════════════════════════════ */

function TasksPanel({ tasks, dealId, onRefresh }: { tasks: any[]; dealId: number; onRefresh: () => void }) {
  const updateTask = trpc.crm.tasks.update.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Tarefa atualizada"); },
  });

  const pending = tasks.filter((t: any) => t.status === "pending" || t.status === "in_progress");
  const done = tasks.filter((t: any) => t.status === "done" || t.status === "cancelled");

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Todas as Tarefas ({tasks.length})</h3>
        <CreateTaskButton dealId={dealId} onCreated={onRefresh} />
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Nenhuma tarefa criada</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pendentes ({pending.length})</p>
              {pending.map((task: any) => (
                <TaskRow key={task.id} task={task} onUpdate={onRefresh} />
              ))}
            </div>
          )}
          {done.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Concluídas ({done.length})</p>
              {done.map((task: any) => (
                <TaskRow key={task.id} task={task} onUpdate={onRefresh} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* PRODUCTS PANEL                                              */
/* ════════════════════════════════════════════════════════════ */

function ProductsPanel({ products, dealId, onRefresh }: { products: any[]; dealId: number; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", category: "other", quantity: 1, unitPriceCents: 0, supplier: "", description: "" });

  const createProduct = trpc.crm.deals.products.create.useMutation({
    onSuccess: () => { onRefresh(); setShowAdd(false); setForm({ name: "", category: "other", quantity: 1, unitPriceCents: 0, supplier: "", description: "" }); toast.success("Produto adicionado"); },
  });
  const deleteProduct = trpc.crm.deals.products.delete.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Produto removido"); },
  });

  const total = products.reduce((sum: number, p: any) => sum + (p.quantity * p.unitPriceCents - (p.discountCents || 0)), 0);

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Produtos e Serviços</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{products.length} itens — Total: {fmt$(total)}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Nenhum item no orçamento</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p: any) => {
            const Icon = categoryIcons[p.category] || Package;
            const itemTotal = p.quantity * p.unitPriceCents - (p.discountCents || 0);
            return (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg hover:border-primary/30 hover:shadow-sm transition-all group">
                <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <Badge variant="outline" className="text-[10px] shrink-0">{categoryLabels[p.category] || p.category}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {p.supplier && <span>{p.supplier}</span>}
                    <span>{p.quantity}x {fmt$(p.unitPriceCents)}</span>
                    {p.discountCents > 0 && <span className="text-emerald-600">-{fmt$(p.discountCents)}</span>}
                  </div>
                </div>
                <p className="text-sm font-semibold shrink-0">{fmt$(itemTotal)}</p>
                <button
                  onClick={() => deleteProduct.mutate({ tenantId: TENANT_ID, id: p.id, dealId, productName: p.name })}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/10 rounded"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </button>
              </div>
            );
          })}
          <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/10 rounded-lg">
            <p className="text-sm font-semibold">Total do Orçamento</p>
            <p className="text-lg font-bold text-primary">{fmt$(total)}</p>
          </div>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar Produto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome do produto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Quantidade</label>
                <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Preço unitário (R$)</label>
                <Input type="number" step="0.01" value={form.unitPriceCents / 100} onChange={(e) => setForm({ ...form, unitPriceCents: Math.round(parseFloat(e.target.value || "0") * 100) })} />
              </div>
            </div>
            <Input placeholder="Fornecedor" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            <Textarea placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-[60px]" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button
              disabled={!form.name.trim()}
              onClick={() => createProduct.mutate({
                tenantId: TENANT_ID, dealId, name: form.name, category: form.category as any,
                quantity: form.quantity, unitPriceCents: form.unitPriceCents, supplier: form.supplier || undefined,
                description: form.description || undefined,
              })}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* PARTICIPANTS PANEL                                          */
/* ════════════════════════════════════════════════════════════ */

function ParticipantsPanel({ participants, contacts, dealId, onRefresh }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedContact, setSelectedContact] = useState("");
  const [selectedRole, setSelectedRole] = useState("traveler");

  const addParticipant = trpc.crm.deals.participants.add.useMutation({
    onSuccess: () => { onRefresh(); setShowAdd(false); toast.success("Participante adicionado"); },
  });
  const removeParticipant = trpc.crm.deals.participants.remove.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Participante removido"); },
  });

  const existingIds = participants.map((p: any) => p.contactId);
  const availableContacts = (contacts || []).filter((c: any) => !existingIds.includes(c.id));

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{participants.length} Participantes</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>

      {participants.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Nenhum participante adicionado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {participants.map((p: any) => {
            const c = contacts.find((ct: any) => ct.id === p.contactId);
            return (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg hover:shadow-sm transition-all group">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{c?.name || `Contato #${p.contactId}`}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{roleLabels[p.role] || p.role}</Badge>
                    {c?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                    {c?.email && <span>{c.email}</span>}
                  </div>
                </div>
                <button
                  onClick={() => removeParticipant.mutate({ tenantId: TENANT_ID, id: p.id, dealId })}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/10 rounded"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Adicionar Participante</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={selectedContact} onValueChange={setSelectedContact}>
              <SelectTrigger><SelectValue placeholder="Selecionar contato" /></SelectTrigger>
              <SelectContent>
                {availableContacts.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(roleLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button
              disabled={!selectedContact}
              onClick={() => addParticipant.mutate({
                tenantId: TENANT_ID, dealId, contactId: parseInt(selectedContact), role: selectedRole as any,
              })}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* WHATSAPP PANEL                                              */
/* ════════════════════════════════════════════════════════════ */

function WhatsAppPanel({ contact }: { contact: any }) {
  const sessionsQ = trpc.whatsapp.sessions.useQuery();
  const activeSession = (sessionsQ.data || []).find((s: any) => s.liveStatus === "connected");

  const resolveQ = trpc.whatsapp.resolveJid.useQuery(
    { sessionId: activeSession?.sessionId || "", phone: contact?.phone || "" },
    { enabled: !!activeSession?.sessionId && !!contact?.phone }
  );
  const remoteJid = resolveQ.data?.jid || null;

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
        <User className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-sm font-medium">Nenhum contato associado</p>
        <p className="text-xs mt-1">Associe um contato na sidebar para ver a conversa do WhatsApp</p>
      </div>
    );
  }

  if (!contact.phone) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
        <Phone className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-sm font-medium">Contato sem telefone</p>
        <p className="text-xs mt-1">Adicione um número de telefone ao contato "{contact.name}"</p>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
        <MessageCircle className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-sm font-medium">Nenhuma sessão WhatsApp ativa</p>
        <p className="text-xs mt-1">Conecte uma sessão na página WhatsApp</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => window.location.href = "/whatsapp"}>
          Ir para WhatsApp
        </Button>
      </div>
    );
  }

  if (resolveQ.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 mb-3 animate-spin opacity-40" />
        <p className="text-sm">Verificando número no WhatsApp...</p>
      </div>
    );
  }

  if (!remoteJid) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
        <Phone className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-sm font-medium">Número não encontrado no WhatsApp</p>
        <p className="text-xs mt-1">O número {contact.phone} não foi encontrado</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-280px)] relative">
      <WhatsAppChat
        contact={contact}
        sessionId={activeSession.sessionId}
        remoteJid={remoteJid}
      />
    </div>
  );
}
