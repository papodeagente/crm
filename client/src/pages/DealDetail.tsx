import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { useState, useMemo, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, Calendar, ChevronRight, Clock, DollarSign,
  Edit2, FileText, GripVertical, History, Loader2, MapPin, MessageCircle,
  MoreHorizontal, Package, Phone, Plane, Plus, Send, ShoppingBag,
  Trash2, User, Users, X, Check, AlertCircle
} from "lucide-react";

const TENANT_ID = 1;

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

function formatCurrency(cents: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(d: string | Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(d: string | Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

// ─── MAIN PAGE ───
export default function DealDetail() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [matched, params] = useRoute("/deal/:id");
  const dealId = params?.id ? parseInt(params.id, 10) : 0;

  const [activeTab, setActiveTab] = useState<"details" | "budget" | "participants" | "history" | "whatsapp">("details");

  // Queries
  const dealQ = trpc.crm.deals.get.useQuery({ tenantId: TENANT_ID, id: dealId }, { enabled: dealId > 0 });
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
  const contactsQ = trpc.crm.contacts.list.useQuery({ tenantId: TENANT_ID, limit: 200 });
  const accountsQ = trpc.crm.accounts.list.useQuery({ tenantId: TENANT_ID });

  const deal = dealQ.data;
  const contact = contactQ.data;
  const currentStage = stagesQ.data?.find((s: any) => s.id === deal?.stageId);

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

  const tabs = [
    { key: "details" as const, label: "Detalhes", icon: FileText },
    { key: "budget" as const, label: "Orçamento", icon: ShoppingBag },
    { key: "participants" as const, label: "Participantes", icon: Users },
    { key: "history" as const, label: "Histórico", icon: History },
    { key: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* ─── TOP BAR ─── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/pipeline")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Pipeline
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <h1 className="text-lg font-semibold text-foreground">{deal.title}</h1>
          <Badge variant="outline" className="text-xs font-medium">
            {currentStage?.name || "—"}
          </Badge>
          <Badge
            variant="outline"
            className={`text-xs ${deal.status === "won" ? "border-green-300 text-green-700 bg-green-50" : deal.status === "lost" ? "border-red-300 text-red-700 bg-red-50" : "border-blue-300 text-blue-700 bg-blue-50"}`}
          >
            {deal.status === "open" ? "Aberta" : deal.status === "won" ? "Ganha" : "Perdida"}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-foreground">{formatCurrency(deal.valueCents)}</span>
        </div>
      </div>

      {/* ─── CONTENT ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── LEFT: Info + Tabs ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-6 pt-3 pb-0 border-b border-border/30">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative
                    ${isActive
                      ? "text-foreground bg-background border border-border/40 border-b-transparent -mb-px"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.key === "whatsapp" && contact?.phone && (
                    <span className="ml-1 w-2 h-2 rounded-full bg-green-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "details" && (
              <DetailsTab
                deal={deal}
                contact={contact}
                account={accountQ.data}
                currentStage={currentStage}
                stages={stagesQ.data || []}
                contacts={contactsQ.data || []}
                accounts={accountsQ.data || []}
                onRefresh={() => dealQ.refetch()}
              />
            )}
            {activeTab === "budget" && (
              <BudgetTab
                dealId={dealId}
                products={productsQ.data || []}
                onRefresh={() => productsQ.refetch()}
              />
            )}
            {activeTab === "participants" && (
              <ParticipantsTab
                dealId={dealId}
                participants={participantsQ.data || []}
                contacts={contactsQ.data || []}
                onRefresh={() => participantsQ.refetch()}
              />
            )}
            {activeTab === "history" && (
              <HistoryTab history={historyQ.data || []} />
            )}
            {activeTab === "whatsapp" && (
              <WhatsAppTab contact={contact} />
            )}
          </div>
        </div>

        {/* ─── RIGHT: Quick Info Sidebar ─── */}
        <div className="w-72 border-l border-border/30 bg-muted/10 p-5 overflow-y-auto hidden lg:block">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Resumo</h3>

          <div className="space-y-4">
            {/* Contact */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Contato</p>
              {contact ? (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{contact.name}</p>
                    {contact.phone && (
                      <p className="text-xs text-muted-foreground">{contact.phone}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhum contato</p>
              )}
            </div>

            <Separator className="opacity-30" />

            {/* Account */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Empresa</p>
              {accountQ.data ? (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
                    <Building2 className="h-3.5 w-3.5 text-orange-600" />
                  </div>
                  <p className="text-sm font-medium">{accountQ.data.name}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhuma empresa</p>
              )}
            </div>

            <Separator className="opacity-30" />

            {/* Value */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="text-xl font-semibold">{formatCurrency(deal.valueCents)}</p>
            </div>

            <Separator className="opacity-30" />

            {/* Stage */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Etapa</p>
              <p className="text-sm font-medium">{currentStage?.name || "—"}</p>
              {currentStage?.probabilityDefault !== undefined && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${currentStage.probabilityDefault}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{currentStage.probabilityDefault}%</span>
                </div>
              )}
            </div>

            <Separator className="opacity-30" />

            {/* Dates */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Criada em</p>
              <p className="text-sm">{formatDate(deal.createdAt)}</p>
            </div>

            {deal.expectedCloseAt && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Previsão de fechamento</p>
                <p className="text-sm">{formatDate(deal.expectedCloseAt)}</p>
              </div>
            )}

            <Separator className="opacity-30" />

            {/* Budget summary */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Orçamento</p>
              <p className="text-sm font-medium">{productsQ.data?.length || 0} itens</p>
              <p className="text-sm">
                {formatCurrency(
                  (productsQ.data || []).reduce((sum: number, p: any) => sum + (p.quantity * p.unitPriceCents - (p.discountCents || 0)), 0)
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DETAILS TAB ───
function DetailsTab({ deal, contact, account, currentStage, stages, contacts, accounts, onRefresh }: any) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const updateDeal = trpc.crm.deals.update.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Atualizado"); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const handleSave = (field: string, value: any) => {
    updateDeal.mutate({ tenantId: TENANT_ID, id: deal.id, [field]: value });
    setEditingField(null);
  };

  const notesQ = trpc.crm.notes.list.useQuery({ tenantId: TENANT_ID, entityType: "deal", entityId: deal.id });
  const createNote = trpc.crm.notes.create.useMutation({
    onSuccess: () => { notesQ.refetch(); setNewNote(""); toast.success("Nota adicionada"); },
  });
  const [newNote, setNewNote] = useState("");

  return (
    <div className="max-w-3xl space-y-6">
      {/* Title */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Título</label>
        {editingField === "title" ? (
          <div className="flex gap-2">
            <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
            <Button size="sm" onClick={() => handleSave("title", editValue)}><Check className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingField(null)}><X className="h-3.5 w-3.5" /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <h2 className="text-xl font-semibold">{deal.title}</h2>
            <button onClick={() => { setEditingField("title"); setEditValue(deal.title); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Contact & Account */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Contato</label>
          <Select
            value={deal.contactId ? String(deal.contactId) : "none"}
            onValueChange={(v) => handleSave("contactId", v === "none" ? null : parseInt(v))}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecionar contato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {contacts.map((c: any) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Empresa</label>
          <Select
            value={deal.accountId ? String(deal.accountId) : "none"}
            onValueChange={(v) => handleSave("accountId", v === "none" ? null : parseInt(v))}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecionar empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {accounts.map((a: any) => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stage & Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Etapa</label>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">{currentStage?.name || "—"}</Badge>
            {currentStage?.probabilityDefault !== undefined && (
              <span className="text-xs text-muted-foreground">{currentStage.probabilityDefault}% prob.</span>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Status</label>
          <Select value={deal.status} onValueChange={(v) => handleSave("status", v)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Aberta</SelectItem>
              <SelectItem value="won">Ganha</SelectItem>
              <SelectItem value="lost">Perdida</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Value */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Valor</label>
        {editingField === "value" ? (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">R$</span>
            <Input
              type="number"
              step="0.01"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              autoFocus
              className="w-48"
            />
            <Button size="sm" onClick={() => handleSave("valueCents", Math.round(parseFloat(editValue) * 100))}><Check className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingField(null)}><X className="h-3.5 w-3.5" /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <p className="text-2xl font-semibold">{formatCurrency(deal.valueCents)}</p>
            <button onClick={() => { setEditingField("value"); setEditValue(String((deal.valueCents || 0) / 100)); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      <Separator className="opacity-30" />

      {/* Notes */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Notas</h3>
        <div className="space-y-2">
          {(notesQ.data || []).map((note: any) => (
            <div key={note.id} className="p-3 bg-muted/30 rounded-lg border border-border/20">
              <p className="text-sm whitespace-pre-wrap">{note.body}</p>
              <p className="text-xs text-muted-foreground mt-1.5">{formatDate(note.createdAt)} {formatTime(note.createdAt)}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Adicionar uma nota..."
            className="min-h-[60px] text-sm"
          />
          <Button
            size="sm"
            disabled={!newNote.trim()}
            onClick={() => createNote.mutate({ tenantId: TENANT_ID, entityType: "deal", entityId: deal.id, body: newNote })}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── BUDGET TAB ───
function BudgetTab({ dealId, products, onRefresh }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", category: "other", quantity: 1, unitPriceCents: 0, supplier: "", description: "", notes: "" });

  const createProduct = trpc.crm.deals.products.create.useMutation({
    onSuccess: () => { onRefresh(); setShowAdd(false); setForm({ name: "", category: "other", quantity: 1, unitPriceCents: 0, supplier: "", description: "", notes: "" }); toast.success("Produto adicionado"); },
    onError: () => toast.error("Erro ao adicionar"),
  });
  const deleteProduct = trpc.crm.deals.products.delete.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Produto removido"); },
  });

  const total = products.reduce((sum: number, p: any) => sum + (p.quantity * p.unitPriceCents - (p.discountCents || 0)), 0);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Itens do Orçamento</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{products.length} itens — Total: {formatCurrency(total)}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum item no orçamento</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p: any) => {
            const Icon = categoryIcons[p.category] || Package;
            const itemTotal = p.quantity * p.unitPriceCents - (p.discountCents || 0);
            return (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-background border border-border/30 rounded-lg hover:border-border/60 transition-colors group">
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
                    <span>{p.quantity}x {formatCurrency(p.unitPriceCents)}</span>
                    {p.discountCents > 0 && <span className="text-green-600">-{formatCurrency(p.discountCents)}</span>}
                  </div>
                </div>
                <p className="text-sm font-semibold shrink-0">{formatCurrency(itemTotal)}</p>
                <button
                  onClick={() => deleteProduct.mutate({ tenantId: TENANT_ID, id: p.id, dealId, productName: p.name })}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </button>
              </div>
            );
          })}

          {/* Total bar */}
          <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/10 rounded-lg">
            <p className="text-sm font-semibold">Total do Orçamento</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(total)}</p>
          </div>
        </div>
      )}

      {/* Add Product Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Produto</DialogTitle>
          </DialogHeader>
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
                description: form.description || undefined, notes: form.notes || undefined,
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

// ─── PARTICIPANTS TAB ───
function ParticipantsTab({ dealId, participants, contacts, onRefresh }: any) {
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
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{participants.length} Participantes</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>

      {participants.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum participante adicionado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {participants.map((p: any) => {
            const c = contacts.find((ct: any) => ct.id === p.contactId);
            return (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-background border border-border/30 rounded-lg group">
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
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
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

// ─── HISTORY TAB ───
function HistoryTab({ history }: { history: any[] }) {
  const actionIcons: Record<string, typeof History> = {
    created: Plus, stage_moved: ArrowLeft, field_changed: Edit2,
    status_changed: AlertCircle, product_added: Package, product_updated: Edit2,
    product_removed: Trash2, participant_added: Users, participant_removed: Users,
  };

  const actionColors: Record<string, string> = {
    created: "bg-green-100 text-green-700",
    stage_moved: "bg-blue-100 text-blue-700",
    field_changed: "bg-yellow-100 text-yellow-700",
    status_changed: "bg-purple-100 text-purple-700",
    product_added: "bg-teal-100 text-teal-700",
    product_removed: "bg-red-100 text-red-700",
    participant_added: "bg-indigo-100 text-indigo-700",
    participant_removed: "bg-red-100 text-red-700",
  };

  return (
    <div className="max-w-3xl">
      {history.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum registro no histórico</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border/40" />
          <div className="space-y-0">
            {history.map((h: any, i: number) => {
              const Icon = actionIcons[h.action] || History;
              const color = actionColors[h.action] || "bg-gray-100 text-gray-700";
              return (
                <div key={h.id} className="relative flex gap-3 pb-5 pl-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm">{h.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{h.actorName || "Sistema"}</span>
                      <span>·</span>
                      <span>{formatDate(h.createdAt)} {formatTime(h.createdAt)}</span>
                    </div>
                    {h.oldValue && h.newValue && (
                      <div className="flex items-center gap-2 mt-1.5 text-xs">
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded line-through">{h.oldValue}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded">{h.newValue}</span>
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

// ─── WHATSAPP TAB ───
function WhatsAppTab({ contact }: { contact: any }) {
  const { lastMessage } = useSocket();
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get active WhatsApp sessions
  const sessionsQ = trpc.whatsapp.sessions.useQuery();
  const activeSession = (sessionsQ.data || []).find((s: any) => s.liveStatus === "connected");

  // Build remoteJid from contact phone
  const remoteJid = useMemo(() => {
    if (!contact?.phone) return null;
    const cleaned = contact.phone.replace(/\D/g, "");
    return `${cleaned}@s.whatsapp.net`;
  }, [contact?.phone]);

  // Get messages for this contact
  const messagesQ = trpc.whatsapp.messagesByContact.useQuery(
    { sessionId: activeSession?.sessionId || "", remoteJid: remoteJid || "", limit: 100 },
    { enabled: !!activeSession?.sessionId && !!remoteJid, refetchInterval: 5000 }
  );

  const sendMessage = trpc.whatsapp.sendMessage.useMutation({
    onSuccess: () => {
      setMessageText("");
      messagesQ.refetch();
      toast.success("Mensagem enviada");
    },
    onError: () => toast.error("Erro ao enviar mensagem"),
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQ.data, lastMessage]);

  // Refetch when new message arrives for this contact
  useEffect(() => {
    if (lastMessage && lastMessage.remoteJid === remoteJid) {
      messagesQ.refetch();
    }
  }, [lastMessage]);

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
        <User className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-sm font-medium">Nenhum contato associado</p>
        <p className="text-xs mt-1">Associe um contato na aba Detalhes para ver a conversa do WhatsApp</p>
      </div>
    );
  }

  if (!contact.phone) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
        <Phone className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-sm font-medium">Contato sem telefone</p>
        <p className="text-xs mt-1">Adicione um número de telefone ao contato "{contact.name}" para iniciar a conversa</p>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
        <MessageCircle className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-sm font-medium">Nenhuma sessão WhatsApp ativa</p>
        <p className="text-xs mt-1">Conecte uma sessão na página WhatsApp para enviar mensagens</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => window.location.href = "/whatsapp"}>
          Ir para WhatsApp
        </Button>
      </div>
    );
  }

  const messages = messagesQ.data || [];

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border/30">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <MessageCircle className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <p className="text-sm font-semibold">{contact.name}</p>
          <p className="text-xs text-muted-foreground">{contact.phone} · via {activeSession.sessionId}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-green-600">Conectado</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhuma mensagem ainda</p>
            <p className="text-xs mt-1">Envie a primeira mensagem para {contact.name}</p>
          </div>
        ) : (
          messages.map((msg: any, i: number) => (
            <div key={msg.id || i} className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm ${
                  msg.fromMe
                    ? "bg-[#007AFF] text-white rounded-br-md"
                    : "bg-[#E9E9EB] text-gray-900 rounded-bl-md"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${msg.fromMe ? "text-white/60" : "text-gray-500"}`}>
                  {formatTime(msg.timestamp || msg.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-border/30">
        <div className="flex items-end gap-2">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={`Mensagem para ${contact.name}...`}
            className="min-h-[44px] max-h-[120px] resize-none text-sm rounded-2xl"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (messageText.trim() && activeSession) {
                  sendMessage.mutate({
                    sessionId: activeSession.sessionId,
                    number: contact.phone.replace(/\D/g, ""),
                    message: messageText.trim(),
                  });
                }
              }
            }}
          />
          <Button
            size="icon"
            className="h-[44px] w-[44px] rounded-full shrink-0"
            disabled={!messageText.trim() || sendMessage.isPending}
            onClick={() => {
              if (messageText.trim() && activeSession) {
                sendMessage.mutate({
                  sessionId: activeSession.sessionId,
                  number: contact.phone.replace(/\D/g, ""),
                  message: messageText.trim(),
                });
              }
            }}
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
