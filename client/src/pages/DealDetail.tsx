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
  ArrowLeft, Building2, Calendar, Check, CheckCheck, ChevronDown, ChevronRight, ChevronUp,
  Clock, Copy, DollarSign, Edit2, ExternalLink, FileText, Flag, GripVertical,
  History, Loader2, Mail, MapPin, MessageCircle, MessageSquarePlus, Mic, MoreHorizontal,
  Package, Phone, Plane, Play, Plus, Send, ShoppingBag, ThumbsDown, ThumbsUp,
  Trash2, User, Users, X, AlertCircle, ClipboardList, Paperclip, Tag,
  Sparkles, BarChart3, TrendingUp, TrendingDown, Star, Target, Lightbulb, RefreshCw, Award, Search
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
  const waMessagesCountQ = trpc.crm.dealWhatsApp.count.useQuery({ tenantId: TENANT_ID, dealId }, { enabled: dealId > 0 });
  const contactsQ = trpc.crm.contacts.list.useQuery({ tenantId: TENANT_ID, limit: 200 });
  const accountsQ = trpc.crm.accounts.list.useQuery({ tenantId: TENANT_ID });
  const customFieldsQ = trpc.customFields.list.useQuery({ tenantId: TENANT_ID, entity: "deal" });
  const customValuesQ = trpc.contactProfile.getCustomFieldValues.useQuery(
    { tenantId: TENANT_ID, entityType: "deal", entityId: dealId },
    { enabled: dealId > 0 }
  );

  const leadSourcesQ = trpc.crm.leadSources.list.useQuery({ tenantId: TENANT_ID });
  const campaignsQ = trpc.crm.campaigns.list.useQuery({ tenantId: TENANT_ID });

  /* ─── Mutations ─── */
  const moveStage = trpc.crm.deals.moveStage.useMutation({
    onSuccess: () => { dealQ.refetch(); historyQ.refetch(); toast.success("Etapa alterada"); },
    onError: () => toast.error("Erro ao mover etapa"),
  });
  const updateDeal = trpc.crm.deals.update.useMutation({
    onSuccess: () => { dealQ.refetch(); historyQ.refetch(); toast.success("Atualizado"); },
    onError: () => toast.error("Erro ao atualizar"),
  });
  const updateContact = trpc.crm.contacts.update.useMutation({
    onSuccess: () => { contactQ.refetch(); toast.success("Contato atualizado"); },
    onError: () => toast.error("Erro ao atualizar contato"),
  });
  const createContact = trpc.crm.contacts.create.useMutation({
    onSuccess: (data) => {
      if (data?.id) updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, contactId: data.id });
      contactsQ.refetch();
      toast.success("Contato criado e vinculado");
    },
    onError: () => toast.error("Erro ao criar contato"),
  });
  const updateAccount = trpc.crm.accounts.update.useMutation({
    onSuccess: () => { accountQ.refetch(); toast.success("Empresa atualizada"); },
    onError: () => toast.error("Erro ao atualizar empresa"),
  });
  const createAccount = trpc.crm.accounts.create.useMutation({
    onSuccess: (data) => {
      if (data?.id) updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, accountId: data.id });
      accountsQ.refetch();
      toast.success("Empresa criada e vinculada");
    },
    onError: () => toast.error("Erro ao criar empresa"),
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
    deal: true, contact: true, company: true, responsible: true, utm: false, custom: false,
  });
  const toggleSection = (key: keyof typeof sidebarSections) =>
    setSidebarSections((prev) => ({ ...prev, [key]: !prev[key] }));

  /* ─── Content tabs ─── */
  const [activeTab, setActiveTab] = useState<"history" | "tasks" | "products" | "participants" | "whatsapp" | "ai-analysis">("history");

  /* ─── Edit states ─── */
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDealField, setEditingDealField] = useState<string | null>(null);
  const [dealFieldDraft, setDealFieldDraft] = useState("");
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showEditContactDialog, setShowEditContactDialog] = useState(false);
  const [showEditAccountDialog, setShowEditAccountDialog] = useState(false);
  const [contactDraft, setContactDraft] = useState({ name: "", phone: "", email: "" });
  const [accountDraft, setAccountDraft] = useState({ name: "" });
  const [contactMode, setContactMode] = useState<"create" | "link">("create");
  const [accountMode, setAccountMode] = useState<"create" | "link">("create");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

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
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="h-8 text-lg font-semibold w-64"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && titleDraft.trim()) {
                        updateDeal.mutate({ tenantId: TENANT_ID, id: deal.id, title: titleDraft.trim() });
                        setEditingTitle(false);
                      }
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                  />
                  <button onClick={() => { if (titleDraft.trim()) { updateDeal.mutate({ tenantId: TENANT_ID, id: deal.id, title: titleDraft.trim() }); } setEditingTitle(false); }} className="p-1 hover:bg-muted/60 rounded">
                    <Check className="h-4 w-4 text-primary" />
                  </button>
                  <button onClick={() => setEditingTitle(false)} className="p-1 hover:bg-muted/60 rounded">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <h1
                  className="text-lg font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors group/title flex items-center gap-1.5"
                  onClick={() => { setTitleDraft(deal.title); setEditingTitle(true); }}
                  title="Clique para editar o nome"
                >
                  {deal.title}
                  <Edit2 className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity" />
                </h1>
              )}
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
                {/* Nome - editável */}
                <EditableSidebarField
                  label="Nome"
                  value={deal.title}
                  isEditing={editingDealField === "title"}
                  onStartEdit={() => { setEditingDealField("title"); setDealFieldDraft(deal.title); }}
                  draft={dealFieldDraft}
                  onDraftChange={setDealFieldDraft}
                  onSave={() => { if (dealFieldDraft.trim()) updateDeal.mutate({ tenantId: TENANT_ID, id: deal.id, title: dealFieldDraft.trim() }); setEditingDealField(null); }}
                  onCancel={() => setEditingDealField(null)}
                />
                {/* Valor - editável */}
                <EditableSidebarField
                  label="Valor total"
                  value={fmt$(deal.valueCents)}
                  className="text-lg font-semibold"
                  isEditing={editingDealField === "value"}
                  onStartEdit={() => { setEditingDealField("value"); setDealFieldDraft(String((deal.valueCents || 0) / 100)); }}
                  draft={dealFieldDraft}
                  onDraftChange={setDealFieldDraft}
                  onSave={() => { updateDeal.mutate({ tenantId: TENANT_ID, id: deal.id, valueCents: Math.round(parseFloat(dealFieldDraft || "0") * 100) }); setEditingDealField(null); }}
                  onCancel={() => setEditingDealField(null)}
                  inputType="number"
                  inputPrefix="R$"
                />
                {/* Criada em - não editável */}
                <SidebarField label="Criada em" value={fmtDateTime(deal.createdAt)} />
                {/* Previsão de fechamento - editável */}
                <EditableSidebarField
                  label="Previsão de fech."
                  value={deal.expectedCloseAt ? fmtDate(deal.expectedCloseAt) : "—"}
                  isEditing={editingDealField === "expectedClose"}
                  onStartEdit={() => { setEditingDealField("expectedClose"); setDealFieldDraft(deal.expectedCloseAt ? new Date(deal.expectedCloseAt).toISOString().split("T")[0] : ""); }}
                  draft={dealFieldDraft}
                  onDraftChange={setDealFieldDraft}
                  onSave={() => { updateDeal.mutate({ tenantId: TENANT_ID, id: deal.id, expectedCloseAt: dealFieldDraft || null }); setEditingDealField(null); }}
                  onCancel={() => setEditingDealField(null)}
                  inputType="date"
                />
                {/* Fonte - editável com select */}
                <div className="flex items-baseline justify-between gap-3 group">
                  <span className="text-xs text-muted-foreground shrink-0">Fonte</span>
                  {editingDealField === "source" ? (
                    <div className="flex items-center gap-1">
                      <Select
                        value={dealFieldDraft || "none"}
                        onValueChange={(v) => {
                          const val = v === "none" ? null : v;
                          updateDeal.mutate({ tenantId: TENANT_ID, id: deal.id, channelOrigin: val });
                          setEditingDealField(null);
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-32">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {(leadSourcesQ.data || []).filter((s: any) => s.isActive).map((s: any) => (
                            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button onClick={() => setEditingDealField(null)} className="p-0.5"><X className="h-3 w-3 text-muted-foreground" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingDealField("source"); setDealFieldDraft(deal.channelOrigin || ""); }}
                      className="text-sm text-foreground text-right truncate hover:text-primary transition-colors flex items-center gap-1 group-hover:text-primary"
                    >
                      {deal.channelOrigin || "—"}
                      <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                </div>
                {/* Status - não editável (usa botões de venda/perda) */}
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
                    <div className="min-w-0 flex-1">
                      <Link href={`/contact/${contact.id}`} className="text-sm font-medium text-primary hover:underline truncate block">
                        {contact.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setShowEditContactDialog(true); setContactDraft({ name: contact.name, phone: contact.phone || "", email: contact.email || "" }); }}
                        className="p-1 hover:bg-muted/60 rounded" title="Editar contato"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => { updateDeal.mutate({ tenantId: TENANT_ID, id: deal.id, contactId: null }); }}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-500/10 rounded" title="Desvincular contato"
                      >
                        <X className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                  {contact.phone && (
                    <ContactInfoRow icon={Phone} value={contact.phone} copyable whatsapp />
                  )}
                  {contact.email && (
                    <ContactInfoRow icon={Mail} value={contact.email} copyable />
                  )}
                  {contact.lifecycleStage && (
                    <div className="flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground capitalize">{contact.lifecycleStage}</span>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => { setShowContactDialog(true); setContactMode("create"); setContactDraft({ name: "", phone: "", email: "" }); setSelectedContactId(null); }}
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
                  <p className="text-sm font-medium flex-1">{account.name}</p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setShowEditAccountDialog(true); setAccountDraft({ name: account.name }); }}
                      className="p-1 hover:bg-muted/60 rounded" title="Editar empresa"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => { updateDeal.mutate({ tenantId: TENANT_ID, id: deal.id, accountId: null }); }}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-500/10 rounded" title="Desvincular empresa"
                    >
                      <X className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Não há empresa na negociação
                  </p>
                  <button
                    onClick={() => { setShowAccountDialog(true); setAccountMode("create"); setAccountDraft({ name: "" }); setSelectedAccountId(null); }}
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

            {/* ── Rastreamento (UTMs) ── */}
            {(deal.utmSource || deal.utmMedium || deal.utmCampaign || deal.utmTerm || deal.utmContent || deal.channelOrigin === "rdstation") && (
              <>
                <SidebarSection
                  title="Rastreamento"
                  open={sidebarSections.utm}
                  onToggle={() => toggleSection("utm")}
                >
                  <div className="space-y-1">
                    {deal.utmSource && (
                      <SidebarField label="Origem (utm_source)" value={deal.utmSource} />
                    )}
                    {deal.utmMedium && (
                      <SidebarField label="Mídia (utm_medium)" value={deal.utmMedium} />
                    )}
                    {deal.utmCampaign && (
                      <SidebarField label="Campanha (utm_campaign)" value={deal.utmCampaign} />
                    )}
                    {deal.utmTerm && (
                      <SidebarField label="Termo (utm_term)" value={deal.utmTerm} />
                    )}
                    {deal.utmContent && (
                      <SidebarField label="Conteúdo (utm_content)" value={deal.utmContent} />
                    )}
                    {deal.channelOrigin === "rdstation" && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Badge variant="secondary" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-200">
                          RD Station
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">Integração ativa</span>
                      </div>
                    )}
                    {!deal.utmSource && !deal.utmMedium && !deal.utmCampaign && !deal.utmTerm && !deal.utmContent && (
                      <p className="text-xs text-muted-foreground">UTMs não disponíveis para este lead</p>
                    )}
                  </div>
                </SidebarSection>
                <SidebarDivider />
              </>
            )}

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
              { key: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle, count: waMessagesCountQ.data || 0 },
              { key: "ai-analysis" as const, label: "Análise IA", icon: Sparkles },
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
                contactName={contact?.name || "Contato"}
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
              <WhatsAppPanel contact={contact} dealId={dealId} />
            )}
            {activeTab === "ai-analysis" && (
              <AiAnalysisPanel dealId={dealId} contactName={contact?.name || "Contato"} />
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

      {/* ═══ Dialog: Adicionar Contato ═══ */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Adicionar Contato
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={contactMode === "create" ? "default" : "outline"}
                size="sm"
                onClick={() => setContactMode("create")}
              >Criar novo</Button>
              <Button
                variant={contactMode === "link" ? "default" : "outline"}
                size="sm"
                onClick={() => setContactMode("link")}
              >Vincular existente</Button>
            </div>
            {contactMode === "create" ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                  <Input value={contactDraft.name} onChange={(e) => setContactDraft(d => ({ ...d, name: e.target.value }))} placeholder="Nome do contato" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                  <Input value={contactDraft.phone} onChange={(e) => setContactDraft(d => ({ ...d, phone: e.target.value }))} placeholder="+55 11 99999-9999" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input value={contactDraft.email} onChange={(e) => setContactDraft(d => ({ ...d, email: e.target.value }))} placeholder="email@exemplo.com" />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Selecione um contato</label>
                <Select value={selectedContactId ? String(selectedContactId) : ""} onValueChange={(v) => setSelectedContactId(Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Buscar contato..." /></SelectTrigger>
                  <SelectContent>
                    {(contactsQ.data || []).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.phone ? ` — ${c.phone}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowContactDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (contactMode === "create") {
                  if (!contactDraft.name.trim()) { toast.error("Nome é obrigatório"); return; }
                  createContact.mutate({ tenantId: TENANT_ID, name: contactDraft.name.trim(), phone: contactDraft.phone || undefined, email: contactDraft.email || undefined });
                } else {
                  if (!selectedContactId) { toast.error("Selecione um contato"); return; }
                  updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, contactId: selectedContactId });
                }
                setShowContactDialog(false);
              }}
              disabled={createContact.isPending}
            >
              {contactMode === "create" ? "Criar e vincular" : "Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Editar Contato ═══ */}
      <Dialog open={showEditContactDialog} onOpenChange={setShowEditContactDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Editar Contato
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome *</label>
              <Input value={contactDraft.name} onChange={(e) => setContactDraft(d => ({ ...d, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Telefone</label>
              <Input value={contactDraft.phone} onChange={(e) => setContactDraft(d => ({ ...d, phone: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input value={contactDraft.email} onChange={(e) => setContactDraft(d => ({ ...d, email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditContactDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!contactDraft.name.trim()) { toast.error("Nome é obrigatório"); return; }
                const cId = deal?.contactId;
                if (cId) updateContact.mutate({ tenantId: TENANT_ID, id: cId, name: contactDraft.name.trim(), phone: contactDraft.phone || undefined, email: contactDraft.email || undefined });
                setShowEditContactDialog(false);
              }}
              disabled={updateContact.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Adicionar Empresa ═══ */}
      <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Adicionar Empresa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={accountMode === "create" ? "default" : "outline"}
                size="sm"
                onClick={() => setAccountMode("create")}
              >Criar nova</Button>
              <Button
                variant={accountMode === "link" ? "default" : "outline"}
                size="sm"
                onClick={() => setAccountMode("link")}
              >Vincular existente</Button>
            </div>
            {accountMode === "create" ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome da empresa *</label>
                <Input value={accountDraft.name} onChange={(e) => setAccountDraft({ name: e.target.value })} placeholder="Nome da empresa" />
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Selecione uma empresa</label>
                <Select value={selectedAccountId ? String(selectedAccountId) : ""} onValueChange={(v) => setSelectedAccountId(Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Buscar empresa..." /></SelectTrigger>
                  <SelectContent>
                    {(accountsQ.data || []).map((a: any) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAccountDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (accountMode === "create") {
                  if (!accountDraft.name.trim()) { toast.error("Nome é obrigatório"); return; }
                  createAccount.mutate({ tenantId: TENANT_ID, name: accountDraft.name.trim() });
                } else {
                  if (!selectedAccountId) { toast.error("Selecione uma empresa"); return; }
                  updateDeal.mutate({ tenantId: TENANT_ID, id: dealId, accountId: selectedAccountId });
                }
                setShowAccountDialog(false);
              }}
              disabled={createAccount.isPending}
            >
              {accountMode === "create" ? "Criar e vincular" : "Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Editar Empresa ═══ */}
      <Dialog open={showEditAccountDialog} onOpenChange={setShowEditAccountDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Editar Empresa
            </DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome da empresa *</label>
            <Input value={accountDraft.name} onChange={(e) => setAccountDraft({ name: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditAccountDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!accountDraft.name.trim()) { toast.error("Nome é obrigatório"); return; }
                const aId = deal?.accountId;
                if (aId) updateAccount.mutate({ tenantId: TENANT_ID, id: aId, name: accountDraft.name.trim() });
                setShowEditAccountDialog(false);
              }}
              disabled={updateAccount.isPending}
            >
              Salvar
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

function EditableSidebarField({ label, value, className, isEditing, onStartEdit, draft, onDraftChange, onSave, onCancel, inputType, inputPrefix }: {
  label: string; value: string; className?: string; isEditing: boolean;
  onStartEdit: () => void; draft: string; onDraftChange: (v: string) => void;
  onSave: () => void; onCancel: () => void;
  inputType?: "text" | "number" | "date"; inputPrefix?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 group">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      {isEditing ? (
        <div className="flex items-center gap-1">
          {inputPrefix && <span className="text-xs text-muted-foreground">{inputPrefix}</span>}
          <Input
            type={inputType || "text"}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            className="h-7 text-xs w-32"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") onCancel();
            }}
          />
          <button onClick={onSave} className="p-0.5 hover:bg-muted/60 rounded"><Check className="h-3 w-3 text-primary" /></button>
          <button onClick={onCancel} className="p-0.5 hover:bg-muted/60 rounded"><X className="h-3 w-3 text-muted-foreground" /></button>
        </div>
      ) : (
        <button
          onClick={onStartEdit}
          className={`text-sm text-foreground text-right truncate hover:text-primary transition-colors flex items-center gap-1 group-hover:text-primary ${className || ""}`}
        >
          {value}
          <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}
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

function HistoryPanel({ history, notes, dealId, contactName, onNoteCreated }: {
  history: any[]; notes: any[]; dealId: number; contactName: string; onNoteCreated: () => void;
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

  const [expandedBackups, setExpandedBackups] = useState<Set<number>>(new Set());
  const toggleBackup = (id: number) => setExpandedBackups(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const actionIcons: Record<string, typeof History> = {
    created: Plus, stage_moved: ArrowLeft, field_changed: Edit2,
    status_changed: AlertCircle, product_added: Package, product_updated: Edit2,
    product_removed: Trash2, participant_added: Users, participant_removed: Users,
    note: MessageSquarePlus, whatsapp_backup: MessageCircle,
  };
  const actionColors: Record<string, string> = {
    created: "bg-emerald-500/15 text-emerald-500",
    stage_moved: "bg-blue-500/15 text-blue-500",
    field_changed: "bg-yellow-500/15 text-yellow-500",
    status_changed: "bg-purple-500/15 text-purple-500",
    product_added: "bg-violet-500/15 text-violet-500",
    product_removed: "bg-red-500/15 text-red-500",
    participant_added: "bg-indigo-500/15 text-indigo-500",
    participant_removed: "bg-red-500/15 text-red-500",
    note: "bg-primary/15 text-primary",
    whatsapp_backup: "bg-green-500/15 text-green-600",
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
              const isWhatsAppBackup = item.action === "whatsapp_backup";
              const isExpanded = expandedBackups.has(item.id);
              const meta = item.metadataJson || {};
              const conversation: string = meta.conversation || "";

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
                    ) : isWhatsAppBackup ? (
                      <div>
                        <button
                          onClick={() => toggleBackup(item.id)}
                          className="flex items-center gap-2 text-sm hover:text-foreground transition-colors group w-full text-left"
                        >
                          <strong className="text-green-600 dark:text-green-400">WhatsApp</strong>
                          <span>{item.description}</span>
                          <ChevronDown className={`h-3.5 w-3.5 ml-auto text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                        {isExpanded && conversation && (
                          <div className="mt-3 rounded-lg border border-green-500/20 bg-green-500/5 overflow-hidden">
                            <div className="px-3 py-2 bg-green-600 dark:bg-green-700 text-white text-xs font-medium flex items-center gap-2">
                              <MessageCircle className="h-3.5 w-3.5" />
                              Conversa com {meta.contactName || contactName}
                            </div>
                            <div className="p-3 max-h-[500px] overflow-y-auto space-y-1">
                              {conversation.split("\n").map((line: string, i: number) => {
                                const dateSep = line.match(/^\u2500\u2500 (.+) \u2500\u2500$/);
                                if (dateSep) {
                                  return (
                                    <div key={i} className="flex items-center gap-2 py-2">
                                      <div className="flex-1 h-px bg-border" />
                                      <span className="text-[10px] text-muted-foreground font-medium px-2 py-0.5 bg-muted rounded-full">{dateSep[1]}</span>
                                      <div className="flex-1 h-px bg-border" />
                                    </div>
                                  );
                                }
                                if (!line.trim()) return null;
                                const msgMatch = line.match(/^\[(.+?)\] (.+?): (.+)$/);
                                if (msgMatch) {
                                  const [, time, sender, text] = msgMatch;
                                  const isAgent = sender !== (meta.contactName || contactName);
                                  return (
                                    <div key={i} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                                      <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
                                        isAgent
                                          ? "bg-green-600 dark:bg-green-700 text-white rounded-br-sm"
                                          : "bg-muted text-foreground rounded-bl-sm"
                                      }`}>
                                        {!isAgent && <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">{sender}</p>}
                                        <p className="whitespace-pre-wrap break-words">{text}</p>
                                        <p className={`text-[10px] mt-0.5 text-right ${isAgent ? "text-green-200" : "text-muted-foreground"}`}>{time}</p>
                                      </div>
                                    </div>
                                  );
                                }
                                return <p key={i} className="text-xs text-muted-foreground">{line}</p>;
                              })}
                            </div>
                          </div>
                        )}
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
  const [editingItem, setEditingItem] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [addForm, setAddForm] = useState({ quantity: 1, unitPriceCents: 0, discountCents: 0, supplier: "", notes: "" });
  const [editForm, setEditForm] = useState({ quantity: 1, unitPriceCents: 0, discountCents: 0, supplier: "", notes: "" });

  const catalogQ = trpc.productCatalog.products.list.useQuery(
    { tenantId: TENANT_ID, isActive: true, limit: 200 },
    { enabled: showAdd }
  );
  const catalogProducts = catalogQ.data || [];

  const filteredCatalog = useMemo(() => {
    if (!searchTerm.trim()) return catalogProducts;
    const term = searchTerm.toLowerCase();
    return catalogProducts.filter((p: any) =>
      p.name.toLowerCase().includes(term) ||
      (p.supplier || "").toLowerCase().includes(term) ||
      (p.sku || "").toLowerCase().includes(term)
    );
  }, [catalogProducts, searchTerm]);

  const createProduct = trpc.crm.deals.products.create.useMutation({
    onSuccess: () => {
      onRefresh(); setShowAdd(false); setSelectedProduct(null); setSearchTerm("");
      setAddForm({ quantity: 1, unitPriceCents: 0, discountCents: 0, supplier: "", notes: "" });
      toast.success("Produto adicionado ao orçamento");
    },
  });
  const updateProduct = trpc.crm.deals.products.update.useMutation({
    onSuccess: () => { onRefresh(); setEditingItem(null); toast.success("Item atualizado"); },
  });
  const deleteProduct = trpc.crm.deals.products.delete.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Produto removido"); },
  });

  const total = products.reduce((sum: number, p: any) => sum + (p.finalPriceCents || (p.quantity * p.unitPriceCents - (p.discountCents || 0))), 0);

  const handleSelectCatalogProduct = (product: any) => {
    setSelectedProduct(product);
    setAddForm({
      quantity: 1,
      unitPriceCents: product.basePriceCents,
      discountCents: 0,
      supplier: product.supplier || "",
      notes: "",
    });
  };

  const addFinalPrice = addForm.quantity * addForm.unitPriceCents - addForm.discountCents;
  const editFinalPrice = editForm.quantity * editForm.unitPriceCents - editForm.discountCents;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Produtos e Serviços</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{products.length} itens — Total: {fmt$(total)}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setShowAdd(true); setSelectedProduct(null); setSearchTerm(""); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar do Catálogo
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Nenhum item no orçamento</p>
          <p className="text-xs mt-1">Adicione produtos do catálogo</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p: any) => {
            const Icon = categoryIcons[p.category] || Package;
            const itemTotal = p.finalPriceCents || (p.quantity * p.unitPriceCents - (p.discountCents || 0));
            return (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg hover:border-primary/30 hover:shadow-sm transition-all group">
                <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <Badge variant="outline" className="text-[10px] shrink-0">{categoryLabels[p.category] || p.category}</Badge>
                    {p.productId > 0 && <Badge variant="secondary" className="text-[9px] shrink-0">Catálogo #{p.productId}</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {p.supplier && <span>{p.supplier}</span>}
                    <span>{p.quantity}x {fmt$(p.unitPriceCents)}</span>
                    {(p.discountCents || 0) > 0 && <span className="text-emerald-600">-{fmt$(p.discountCents)}</span>}
                  </div>
                </div>
                <p className="text-sm font-semibold shrink-0">{fmt$(itemTotal)}</p>
                <button
                  onClick={() => {
                    setEditingItem(p);
                    setEditForm({
                      quantity: p.quantity, unitPriceCents: p.unitPriceCents,
                      discountCents: p.discountCents || 0, supplier: p.supplier || "", notes: p.notes || "",
                    });
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-primary/10 rounded"
                >
                  <Edit2 className="h-3.5 w-3.5 text-primary" />
                </button>
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

      {/* DIALOG: Adicionar Produto do Catálogo */}
      <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (!open) { setSelectedProduct(null); setSearchTerm(""); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>{selectedProduct ? "Configurar Item" : "Buscar no Catálogo"}</DialogTitle></DialogHeader>

          {!selectedProduct ? (
            <div className="flex-1 overflow-hidden flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto por nome, fornecedor ou SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 max-h-[400px] pr-1">
                {catalogQ.isLoading ? (
                  <div className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
                ) : filteredCatalog.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">{searchTerm ? "Nenhum produto encontrado" : "Catálogo vazio"}</p>
                    <p className="text-xs mt-1">Cadastre produtos no catálogo primeiro</p>
                  </div>
                ) : (
                  filteredCatalog.map((p: any) => {
                    const Icon = categoryIcons[p.productType] || Package;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectCatalogProduct(p)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                      >
                        <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <Badge variant="outline" className="text-[10px]">{categoryLabels[p.productType] || p.productType}</Badge>
                            {p.supplier && <span>{p.supplier}</span>}
                            {p.sku && <span className="text-muted-foreground/60">SKU: {p.sku}</span>}
                          </div>
                        </div>
                        <p className="text-sm font-semibold shrink-0 text-primary">{fmt$(p.basePriceCents)}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  {(() => { const Icon = categoryIcons[selectedProduct.productType] || Package; return <Icon className="h-5 w-5 text-primary" />; })()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{selectedProduct.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {categoryLabels[selectedProduct.productType] || selectedProduct.productType}
                    {selectedProduct.supplier && ` • ${selectedProduct.supplier}`}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Quantidade</label>
                  <Input type="number" min={1} value={addForm.quantity} onChange={(e) => setAddForm({ ...addForm, quantity: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Preço unitário (R$)</label>
                  <Input type="number" step="0.01" value={addForm.unitPriceCents / 100} onChange={(e) => setAddForm({ ...addForm, unitPriceCents: Math.round(parseFloat(e.target.value || "0") * 100) })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Desconto (R$)</label>
                <Input type="number" step="0.01" value={addForm.discountCents / 100} onChange={(e) => setAddForm({ ...addForm, discountCents: Math.round(parseFloat(e.target.value || "0") * 100) })} />
              </div>
              <Input placeholder="Fornecedor (opcional)" value={addForm.supplier} onChange={(e) => setAddForm({ ...addForm, supplier: e.target.value })} />
              <Textarea placeholder="Observações (opcional)" value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} className="min-h-[50px]" />

              <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/10 rounded-lg">
                <span className="text-sm font-medium">Subtotal do item</span>
                <span className="text-lg font-bold text-primary">{fmt$(addFinalPrice)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedProduct ? (
              <>
                <Button variant="ghost" onClick={() => setSelectedProduct(null)}>Voltar</Button>
                <Button
                  disabled={createProduct.isPending}
                  onClick={() => createProduct.mutate({
                    tenantId: TENANT_ID, dealId, productId: selectedProduct.id,
                    quantity: addForm.quantity,
                    unitPriceCents: addForm.unitPriceCents,
                    discountCents: addForm.discountCents || undefined,
                    supplier: addForm.supplier || undefined,
                    notes: addForm.notes || undefined,
                  })}
                >
                  {createProduct.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Adicionar ao Orçamento
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Fechar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Editar Item da Negociação */}
      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar Item: {editingItem?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Quantidade</label>
                <Input type="number" min={1} value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Preço unitário (R$)</label>
                <Input type="number" step="0.01" value={editForm.unitPriceCents / 100} onChange={(e) => setEditForm({ ...editForm, unitPriceCents: Math.round(parseFloat(e.target.value || "0") * 100) })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Desconto (R$)</label>
              <Input type="number" step="0.01" value={editForm.discountCents / 100} onChange={(e) => setEditForm({ ...editForm, discountCents: Math.round(parseFloat(e.target.value || "0") * 100) })} />
            </div>
            <Input placeholder="Fornecedor" value={editForm.supplier} onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })} />
            <Textarea placeholder="Observações" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="min-h-[50px]" />
            <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/10 rounded-lg">
              <span className="text-sm font-medium">Subtotal</span>
              <span className="text-lg font-bold text-primary">{fmt$(editFinalPrice)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingItem(null)}>Cancelar</Button>
            <Button
              disabled={updateProduct.isPending}
              onClick={() => updateProduct.mutate({
                tenantId: TENANT_ID, id: editingItem.id, dealId,
                quantity: editForm.quantity, unitPriceCents: editForm.unitPriceCents,
                discountCents: editForm.discountCents, supplier: editForm.supplier || undefined,
                notes: editForm.notes || undefined,
              })}
            >
              {updateProduct.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar Alterações
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

/* ═══════════════════════════════════════════════════════════════════
   AI ANALYSIS PANEL
   ═══════════════════════════════════════════════════════════════════ */

function ScoreCircle({ score, label, size = "md" }: { score: number; label: string; size?: "sm" | "md" | "lg" }) {
  const radius = size === "lg" ? 45 : size === "md" ? 32 : 24;
  const stroke = size === "lg" ? 6 : size === "md" ? 4 : 3;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const svgSize = (radius + stroke) * 2;
  const color = score >= 80 ? "text-emerald-500" : score >= 60 ? "text-yellow-500" : score >= 40 ? "text-orange-500" : "text-red-500";
  const bgColor = score >= 80 ? "stroke-emerald-500/15" : score >= 60 ? "stroke-yellow-500/15" : score >= 40 ? "stroke-orange-500/15" : "stroke-red-500/15";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg width={svgSize} height={svgSize} className="-rotate-90">
          <circle cx={radius + stroke} cy={radius + stroke} r={radius} fill="none" strokeWidth={stroke} className={bgColor} />
          <circle cx={radius + stroke} cy={radius + stroke} r={radius} fill="none" strokeWidth={stroke}
            className={color} style={{ strokeDasharray: circumference, strokeDashoffset: offset, strokeLinecap: "round", transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${color} ${size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-sm"}`}>{score}</span>
        </div>
      </div>
      <span className={`text-muted-foreground font-medium text-center ${size === "lg" ? "text-sm" : "text-[11px]"}`}>{label}</span>
    </div>
  );
}

function AiAnalysisPanel({ dealId, contactName }: { dealId: number; contactName: string }) {
  const [showHistory, setShowHistory] = useState(false);

  const latestQ = trpc.aiAnalysis.getLatest.useQuery({ dealId });
  const historyQ = trpc.aiAnalysis.getHistory.useQuery({ dealId }, { enabled: showHistory });
  const analyzeMut = trpc.aiAnalysis.analyze.useMutation({
    onSuccess: () => {
      latestQ.refetch();
      historyQ.refetch();
      toast.success("Análise concluída!");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const analysis = latestQ.data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Análise de Atendimento por IA</h3>
            <p className="text-xs text-muted-foreground">Avaliação automática da conversa com {contactName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {analysis && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs"
            >
              <History className="h-3.5 w-3.5 mr-1" />
              Histórico
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => analyzeMut.mutate({ dealId, forceNew: !!analysis })}
            disabled={analyzeMut.isPending}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
          >
            {analyzeMut.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Analisando...</>
            ) : analysis ? (
              <><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Re-analisar</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Analisar Atendimento</>
            )}
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {analyzeMut.isPending && (
        <div className="flex flex-col items-center justify-center py-16 bg-card rounded-xl border border-border">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center animate-pulse">
              <Sparkles className="h-8 w-8 text-violet-500 animate-spin" style={{ animationDuration: "3s" }} />
            </div>
          </div>
          <p className="text-sm font-medium mt-4">Analisando conversa com IA...</p>
          <p className="text-xs text-muted-foreground mt-1">Isso pode levar alguns segundos</p>
        </div>
      )}

      {/* Empty state */}
      {!analysis && !analyzeMut.isPending && (
        <div className="flex flex-col items-center justify-center py-16 bg-card rounded-xl border border-border">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Nenhuma análise realizada</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center">
            Clique em "Analisar Atendimento" para que a IA avalie a conversa do WhatsApp e sugira melhorias
          </p>
        </div>
      )}

      {/* Analysis results */}
      {analysis && !analyzeMut.isPending && (
        <div className="space-y-6">
          {/* Score overview */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-2 mb-6">
              <Award className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Pontuação Geral</h4>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {analysis.messagesAnalyzed} mensagens analisadas · {analysis.createdAt ? new Date(analysis.createdAt).toLocaleString("pt-BR") : ""}
              </span>
            </div>
            <div className="flex items-center justify-center gap-8 flex-wrap">
              <ScoreCircle score={analysis.overallScore || 0} label="Geral" size="lg" />
              <div className="flex gap-6 flex-wrap justify-center">
                <ScoreCircle score={analysis.toneScore || 0} label="Tom e Empatia" />
                <ScoreCircle score={analysis.responsivenessScore || 0} label="Responsividade" />
                <ScoreCircle score={analysis.clarityScore || 0} label="Clareza" />
                <ScoreCircle score={analysis.closingScore || 0} label="Fechamento" />
              </div>
            </div>
            {analysis.responseTimeAvg && (
              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Tempo médio de resposta: <strong className="text-foreground">{analysis.responseTimeAvg}</strong>
              </div>
            )}
          </div>

          {/* Summary */}
          {analysis.summary && (
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold">Resumo</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
            </div>
          )}

          {/* Strengths & Improvements grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            {(analysis.strengths as string[] | null)?.length ? (
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Pontos Fortes</h4>
                </div>
                <ul className="space-y-2">
                  {(analysis.strengths as string[]).map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Star className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Improvements */}
            {(analysis.improvements as string[] | null)?.length ? (
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4 text-orange-500" />
                  <h4 className="text-sm font-semibold text-orange-600 dark:text-orange-400">Pontos de Melhoria</h4>
                </div>
                <ul className="space-y-2">
                  {(analysis.improvements as string[]).map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertCircle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {/* Suggestions */}
          {(analysis.suggestions as string[] | null)?.length ? (
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <h4 className="text-sm font-semibold">Sugestões de Melhoria</h4>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {(analysis.suggestions as string[]).map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="h-6 w-6 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">{i + 1}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{s}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Missed Opportunities */}
          {(analysis.missedOpportunities as string[] | null)?.length ? (
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-red-500" />
                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400">Oportunidades Perdidas</h4>
              </div>
              <ul className="space-y-2">
                {(analysis.missedOpportunities as string[]).map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Target className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {/* History panel */}
      {showHistory && (historyQ.data || []).length > 1 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Histórico de Análises</h4>
          </div>
          <div className="space-y-2">
            {(historyQ.data || []).map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                <ScoreCircle score={a.overallScore || 0} label="" size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{a.summary?.slice(0, 80)}...</p>
                  <p className="text-[10px] text-muted-foreground">
                    {a.messagesAnalyzed} msgs · {a.createdAt ? new Date(a.createdAt).toLocaleString("pt-BR") : ""}
                  </p>
                </div>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <span>Tom: {a.toneScore}</span>
                  <span>Resp: {a.responsivenessScore}</span>
                  <span>Clar: {a.clarityScore}</span>
                  <span>Fech: {a.closingScore}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   WHATSAPP PANEL
   ═══════════════════════════════════════════════════════════════════ */

function WhatsAppPanel({ contact, dealId }: { contact: any; dealId: number }) {
  const [viewMode, setViewMode] = useState<"history" | "live">("history");
  const [loadMoreBefore, setLoadMoreBefore] = useState<number | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch full message history from DB
  const messagesQ = trpc.crm.dealWhatsApp.messages.useQuery(
    { tenantId: TENANT_ID, dealId, limit: 200, beforeId: loadMoreBefore },
    { enabled: dealId > 0 }
  );

  // Live chat setup
  const sessionsQ = trpc.whatsapp.sessions.useQuery();
  const activeSession = (sessionsQ.data || []).find((s: any) => s.liveStatus === "connected");
  const resolveQ = trpc.whatsapp.resolveJid.useQuery(
    { sessionId: activeSession?.sessionId || "", phone: contact?.phone || "" },
    { enabled: !!activeSession?.sessionId && !!contact?.phone }
  );
  const remoteJid = resolveQ.data?.jid || null;

  // Auto-scroll to bottom on load
  useEffect(() => {
    if (messagesQ.data?.messages?.length && scrollRef.current && viewMode === "history") {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesQ.data?.messages?.length, viewMode]);

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

  const msgs = messagesQ.data?.messages || [];
  const sessionMap = messagesQ.data?.sessionMap || {};

  // Group messages by date
  const groupedByDate = useMemo(() => {
    const groups: { date: string; messages: typeof msgs }[] = [];
    let currentDate = "";
    let currentGroup: typeof msgs = [];
    for (const msg of msgs) {
      const d = new Date(msg.timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      if (d !== currentDate) {
        if (currentGroup.length) groups.push({ date: currentDate, messages: currentGroup });
        currentDate = d;
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }
    }
    if (currentGroup.length) groups.push({ date: currentDate, messages: currentGroup });
    return groups;
  }, [msgs]);

  return (
    <div className="flex flex-col h-[calc(100vh-280px)]">
      {/* Tab toggle: History vs Live */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
        <button
          onClick={() => setViewMode("history")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            viewMode === "history" ? "bg-green-600 text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <History className="h-3.5 w-3.5" />
          Histórico Completo ({msgs.length})
        </button>
        <button
          onClick={() => setViewMode("live")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            viewMode === "live" ? "bg-green-600 text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          Chat ao Vivo
        </button>
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground">Contato: {contact.name} · {contact.phone}</span>
      </div>

      {viewMode === "history" ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wMykiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjcCkiLz48L3N2Zz4=')] bg-repeat">
          {messagesQ.isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-3">Carregando histórico de mensagens...</p>
            </div>
          ) : msgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">Nenhuma mensagem encontrada</p>
              <p className="text-xs mt-1">As mensagens do WhatsApp com este contato aparecerão aqui</p>
            </div>
          ) : (
            <>
              {messagesQ.data?.hasMore && (
                <div className="flex justify-center mb-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => setLoadMoreBefore(msgs[0]?.id)}
                  >
                    Carregar mensagens anteriores
                  </Button>
                </div>
              )}
              {groupedByDate.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-2 py-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-muted-foreground font-medium px-3 py-1 bg-muted rounded-full shadow-sm">{group.date}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  {group.messages.map((msg: any) => {
                    const time = new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                    const senderName = msg.fromMe ? (sessionMap[msg.sessionId] || "Agente") : (msg.pushName || contact.name);
                    const isMedia = msg.messageType !== "text" && msg.messageType !== "conversation";

                    return (
                      <div key={msg.id} className={`flex mb-1 ${msg.fromMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                          msg.fromMe
                            ? "bg-green-600 dark:bg-green-700 text-white rounded-br-sm"
                            : "bg-card text-foreground border border-border rounded-bl-sm"
                        }`}>
                          {!msg.fromMe && (
                            <p className="text-[10px] font-semibold mb-0.5 text-muted-foreground">{senderName}</p>
                          )}
                          {msg.fromMe && msg.senderAgentId && (
                            <p className="text-[10px] font-semibold mb-0.5 text-green-200">{senderName}</p>
                          )}
                          {isMedia && msg.mediaUrl ? (
                            <div className="mb-1">
                              {msg.messageType === "image" ? (
                                <img src={msg.mediaUrl} alt="" className="rounded max-w-full max-h-48 object-cover" />
                              ) : msg.messageType === "audio" || msg.isVoiceNote ? (
                                <div className="flex items-center gap-2">
                                  <Mic className="h-4 w-4" />
                                  <span className="text-xs">Áudio {msg.mediaDuration ? `(${Math.ceil(msg.mediaDuration)}s)` : ""}</span>
                                </div>
                              ) : msg.messageType === "video" ? (
                                <div className="flex items-center gap-2">
                                  <Play className="h-4 w-4" />
                                  <span className="text-xs">Vídeo</span>
                                </div>
                              ) : msg.messageType === "document" ? (
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  <span className="text-xs">{msg.mediaFileName || "Documento"}</span>
                                </div>
                              ) : (
                                <span className="text-xs italic">[{msg.messageType}]</span>
                              )}
                              {msg.content && <p className="whitespace-pre-wrap break-words mt-1">{msg.content}</p>}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msg.content || `[${msg.messageType}]`}</p>
                          )}
                          <div className={`flex items-center gap-1 mt-0.5 ${msg.fromMe ? "justify-end" : ""}`}>
                            <span className={`text-[10px] ${msg.fromMe ? "text-green-200" : "text-muted-foreground"}`}>{time}</span>
                            {msg.fromMe && (
                              msg.status === "read" ? <CheckCheck className="h-3 w-3 text-blue-300" /> :
                              msg.status === "delivered" ? <CheckCheck className="h-3 w-3 text-green-200" /> :
                              msg.status === "sent" ? <Check className="h-3 w-3 text-green-200" /> :
                              <Clock className="h-3 w-3 text-green-200" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        /* Live chat mode */
        activeSession && remoteJid ? (
          <div className="flex-1 relative">
            <WhatsAppChat
              contact={contact}
              sessionId={activeSession.sessionId}
              remoteJid={remoteJid}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">
              {!activeSession ? "Nenhuma sessão WhatsApp ativa" : "Número não encontrado no WhatsApp"}
            </p>
            <p className="text-xs mt-1">
              {!activeSession ? "Conecte uma sessão na página WhatsApp" : `O número ${contact.phone} não foi encontrado`}
            </p>
            {!activeSession && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => window.location.href = "/whatsapp"}>
                Ir para WhatsApp
              </Button>
            )}
          </div>
        )
      )}
    </div>
  );
}
