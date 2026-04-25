import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ChevronRight, ChevronDown, ChevronsRight,
  Phone, Mail, Edit2, Loader2, ExternalLink,
  TrendingUp, DollarSign, Trophy, Calendar,
  X, Check, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import CustomFieldRenderer from "@/components/CustomFieldRenderer";

interface Props {
  contactId: number | null;
  fallbackName?: string;
  fallbackPhone?: string;
  fallbackAvatarUrl?: string;
  onCollapse: () => void;
  onCreateContact?: () => void;
}

function formatCurrency(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format((cents || 0) / 100);
}

function lifecycleLabel(stage: string | null | undefined) {
  switch (stage) {
    case "lead": return "Lead";
    case "prospect": return "Prospect";
    case "customer": return "Cliente";
    case "churned": return "Churned";
    default: return "—";
  }
}

function lifecycleColor(stage: string | null | undefined) {
  switch (stage) {
    case "lead": return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    case "prospect": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "customer": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "churned": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground";
  }
}

function dealStatusBadge(status: string) {
  switch (status) {
    case "won": return { label: "Ganha", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    case "lost": return { label: "Perdida", cls: "bg-red-500/15 text-red-400 border-red-500/30" };
    default: return { label: "Aberta", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
  }
}

export default function ContactDetailsSidebar({
  contactId,
  fallbackName,
  fallbackPhone,
  fallbackAvatarUrl,
  onCollapse,
  onCreateContact,
}: Props) {
  const enabled = !!contactId && contactId > 0;
  const utils = trpc.useUtils();

  const contactQ = trpc.crm.contacts.get.useQuery({ id: contactId! }, { enabled });
  const metricsQ = trpc.contactProfile.getMetrics.useQuery({ contactId: contactId! }, { enabled });
  const dealsQ = trpc.contactProfile.getDeals.useQuery({ contactId: contactId! }, { enabled });
  const customFieldsQ = trpc.customFields.list.useQuery({ entity: "contact" }, { enabled });
  const customValuesQ = trpc.contactProfile.getCustomFieldValues.useQuery(
    { entityType: "contact", entityId: contactId! },
    { enabled }
  );

  const updateContact = trpc.crm.contacts.update.useMutation({
    onSuccess: () => {
      utils.crm.contacts.get.invalidate({ id: contactId! });
      setIsEditing(false);
      toast.success("Contato atualizado");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const setCustomValuesM = trpc.contactProfile.setCustomFieldValues.useMutation({
    onSuccess: () => {
      utils.contactProfile.getCustomFieldValues.invalidate({ entityType: "contact", entityId: contactId! });
      setIsEditingCustom(false);
      toast.success("Campos atualizados");
    },
    onError: () => toast.error("Erro ao salvar campos"),
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", lifecycleStage: "" });
  const [openDeals, setOpenDeals] = useState(true);
  const [openClosed, setOpenClosed] = useState(false);
  const [openCustom, setOpenCustom] = useState(true);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [customDraft, setCustomDraft] = useState<Record<number, string>>({});

  const contact: any = contactQ.data;
  const metrics: any = metricsQ.data || { totalDeals: 0, wonDeals: 0, totalSpentCents: 0, daysSinceLastPurchase: null };
  const deals: any[] = (dealsQ.data as any[]) || [];

  const openDealsList = useMemo(() => deals.filter(d => d.status !== "won" && d.status !== "lost"), [deals]);
  const closedDealsList = useMemo(() => deals.filter(d => d.status === "won" || d.status === "lost"), [deals]);

  function startEdit() {
    if (!contact) return;
    setEditForm({
      name: contact.name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      lifecycleStage: contact.lifecycleStage || "lead",
    });
    setIsEditing(true);
  }

  function saveEdit() {
    if (!contactId) return;
    updateContact.mutate({
      id: contactId,
      name: editForm.name || undefined,
      email: editForm.email || undefined,
      phone: editForm.phone || undefined,
      lifecycleStage: (editForm.lifecycleStage || undefined) as any,
    });
  }

  function startEditCustom() {
    const map: Record<number, string> = {};
    const valuesArr = (customValuesQ.data as any[]) || [];
    const valuesMap: Record<number, string> = {};
    valuesArr.forEach((v: any) => { valuesMap[v.fieldId] = v.value || ""; });
    ((customFieldsQ.data as any[]) || []).forEach((f: any) => {
      map[f.id] = valuesMap[f.id] || f.defaultValue || "";
    });
    setCustomDraft(map);
    setIsEditingCustom(true);
  }

  function saveCustom() {
    if (!contactId) return;
    const values = Object.entries(customDraft).map(([fid, v]) => ({
      fieldId: Number(fid),
      value: (v as string)?.trim() || null,
    }));
    setCustomValuesM.mutate({ entityType: "contact", entityId: contactId, values });
  }

  // ─── No CRM contact yet ───
  if (!enabled) {
    return (
      <aside className="w-[320px] border-l border-border/50 bg-card/30 flex flex-col shrink-0">
        <div className="h-14 flex items-center justify-between px-4 border-b border-border/50">
          <p className="text-sm font-semibold">Detalhes do Contato</p>
          <button onClick={onCollapse} className="text-muted-foreground hover:text-foreground" title="Recolher">
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
          <div className="h-16 w-16 rounded-full bg-muted/40 flex items-center justify-center text-2xl font-bold text-muted-foreground">
            {(fallbackName || "?")[0]?.toUpperCase()}
          </div>
          <p className="text-sm font-medium text-foreground">{fallbackName || "Cliente WhatsApp"}</p>
          {fallbackPhone && <p className="text-xs text-muted-foreground">{fallbackPhone}</p>}
          <p className="text-xs text-muted-foreground mt-2">Este número ainda não está cadastrado no CRM.</p>
          {onCreateContact && (
            <Button size="sm" onClick={onCreateContact} className="mt-2 bg-[#2E7D5B] hover:bg-[#256B4D] text-white text-xs h-8">
              <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Cadastrar contato
            </Button>
          )}
        </div>
      </aside>
    );
  }

  // ─── Loading ───
  if (contactQ.isLoading || !contact) {
    return (
      <aside className="w-[320px] border-l border-border/50 bg-card/30 flex flex-col shrink-0">
        <div className="h-14 flex items-center justify-between px-4 border-b border-border/50">
          <p className="text-sm font-semibold">Detalhes do Contato</p>
          <button onClick={onCollapse} className="text-muted-foreground hover:text-foreground">
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[320px] border-l border-border/50 bg-card/30 flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border/50 shrink-0">
        <p className="text-sm font-semibold">Detalhes do Contato</p>
        <button onClick={onCollapse} className="text-muted-foreground hover:text-foreground" title="Recolher painel">
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Avatar + nome */}
        <div className="px-4 pt-4 pb-3 text-center space-y-2">
          {fallbackAvatarUrl ? (
            <img src={fallbackAvatarUrl} alt="" className="h-16 w-16 rounded-full object-cover mx-auto border border-border" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#2E7D5B]/30 to-[#2E7D5B]/10 border-2 border-[#2E7D5B]/30 flex items-center justify-center text-2xl font-bold text-[#2E7D5B] mx-auto">
              {(contact.name || "?")[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-sm font-bold text-foreground truncate">{contact.name}</h2>
            <Badge variant="outline" className={`mt-1 text-[10px] ${lifecycleColor(contact.lifecycleStage)}`}>
              {lifecycleLabel(contact.lifecycleStage)}
            </Badge>
          </div>
          <Link href={`/contact/${contact.id}`}>
            <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground">
              Abrir perfil completo <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>

        <Separator />

        {/* Dados principais (edit inline) */}
        <div className="p-4 space-y-2.5">
          {isEditing ? (
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Nome</label>
                <Input className="h-8 text-xs" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Telefone</label>
                <Input className="h-8 text-xs" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">E-mail</label>
                <Input className="h-8 text-xs" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Estágio</label>
                <Select value={editForm.lifecycleStage} onValueChange={v => setEditForm({ ...editForm, lifecycleStage: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="customer">Cliente</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-7 text-xs flex-1">
                  <X className="h-3 w-3 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={updateContact.isPending} className="h-7 text-xs flex-1 bg-[#2E7D5B] hover:bg-[#256B4D] text-white">
                  <Check className="h-3 w-3 mr-1" /> Salvar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{contact.phone || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{contact.email || "—"}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={startEdit} className="h-7 text-[11px] w-full text-muted-foreground hover:text-foreground">
                <Edit2 className="h-3 w-3 mr-1" /> Editar detalhes
              </Button>
            </>
          )}
        </div>

        <Separator />

        {/* KPIs */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Resumo</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> Negociações
              </div>
              <p className="text-base font-bold text-foreground mt-0.5">{metrics.totalDeals}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Trophy className="h-3 w-3" /> Ganhas
              </div>
              <p className="text-base font-bold text-emerald-400 mt-0.5">{metrics.wonDeals}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <DollarSign className="h-3 w-3" /> Receita
              </div>
              <p className="text-sm font-bold text-[#2E7D5B] mt-0.5 truncate">{formatCurrency(metrics.totalSpentCents)}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="h-3 w-3" /> Última
              </div>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {metrics.daysSinceLastPurchase !== null ? `${metrics.daysSinceLastPurchase}d` : "—"}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Negociações abertas */}
        <div className="px-4 py-3">
          <button
            onClick={() => setOpenDeals(v => !v)}
            className="w-full flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground"
          >
            <span>Negociações ({openDealsList.length})</span>
            {openDeals ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
          {openDeals && (
            <div className="mt-2 space-y-1.5">
              {dealsQ.isLoading ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : openDealsList.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic px-1">Nenhuma negociação aberta</p>
              ) : (
                openDealsList.map((d) => {
                  const sb = dealStatusBadge(d.status);
                  return (
                    <Link key={d.id} href={`/deal/${d.id}`}>
                      <div className="p-2 rounded-md border border-border/50 hover:border-primary/40 hover:bg-accent/40 cursor-pointer transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium truncate">{d.title}</p>
                          <span className="text-xs font-bold text-[#2E7D5B] shrink-0">{formatCurrency(d.valueCents, d.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground truncate">
                            {d.pipelineName ? `${d.pipelineName} · ` : ""}{d.stageName || "—"}
                          </span>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${sb.cls}`}>{sb.label}</Badge>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Negociações finalizadas */}
        {closedDealsList.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-3">
              <button
                onClick={() => setOpenClosed(v => !v)}
                className="w-full flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground"
              >
                <span>Finalizadas ({closedDealsList.length})</span>
                {openClosed ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              {openClosed && (
                <div className="mt-2 space-y-1.5">
                  {closedDealsList.map((d) => {
                    const sb = dealStatusBadge(d.status);
                    return (
                      <Link key={d.id} href={`/deal/${d.id}`}>
                        <div className="p-2 rounded-md border border-border/50 hover:border-primary/40 hover:bg-accent/40 cursor-pointer transition-colors opacity-80">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium truncate">{d.title}</p>
                            <span className="text-xs font-bold text-[#2E7D5B] shrink-0">{formatCurrency(d.valueCents, d.currency)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground truncate">{d.stageName || "—"}</span>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${sb.cls}`}>{sb.label}</Badge>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Campos personalizados */}
        {((customFieldsQ.data as any[]) || []).length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-3">
              <button
                onClick={() => setOpenCustom(v => !v)}
                className="w-full flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground"
              >
                <span>Campos Personalizados</span>
                {openCustom ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              {openCustom && (
                <div className="mt-2">
                  <CustomFieldsBlock
                    fields={(customFieldsQ.data as any[]) || []}
                    values={(customValuesQ.data as any[]) || []}
                    isEditing={isEditingCustom}
                    draft={customDraft}
                    onDraftChange={(fid, v) => setCustomDraft(prev => ({ ...prev, [fid]: v }))}
                    onStartEdit={startEditCustom}
                    onCancelEdit={() => setIsEditingCustom(false)}
                    onSave={saveCustom}
                    saving={setCustomValuesM.isPending}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function CustomFieldsBlock({ fields, values, isEditing, draft, onDraftChange, onStartEdit, onCancelEdit, onSave, saving }: {
  fields: any[];
  values: any[];
  isEditing: boolean;
  draft: Record<number, string>;
  onDraftChange: (fid: number, v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const valuesMap: Record<number, string> = {};
  values.forEach((v: any) => { valuesMap[v.fieldId] = v.value || ""; });

  if (isEditing) {
    return (
      <div className="space-y-2">
        <CustomFieldRenderer
          fields={fields}
          values={draft}
          onChange={(fieldId, val) => onDraftChange(fieldId, val)}
          mode="all"
          compact
        />
        <div className="flex gap-1.5 pt-1">
          <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-7 text-xs flex-1">
            <X className="h-3 w-3 mr-1" /> Cancelar
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving} className="h-7 text-xs flex-1 bg-[#2E7D5B] hover:bg-[#256B4D] text-white">
            <Check className="h-3 w-3 mr-1" /> Salvar
          </Button>
        </div>
      </div>
    );
  }

  const visibleFields = fields.filter((f: any) => f.isVisibleOnProfile || valuesMap[f.id]);

  return (
    <div className="space-y-2">
      {visibleFields.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Nenhum valor preenchido</p>
      ) : (
        <CustomFieldRenderer
          fields={visibleFields}
          values={valuesMap}
          onChange={() => {}}
          mode="profile"
          compact
          readOnly
        />
      )}
      <Button size="sm" variant="ghost" onClick={onStartEdit} className="h-7 text-[11px] w-full text-muted-foreground hover:text-foreground">
        <Edit2 className="h-3 w-3 mr-1" /> Editar campos
      </Button>
    </div>
  );
}
