import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft, Mail, Phone, FileText, Calendar, DollarSign,
  TrendingUp, Clock, ShoppingCart, Award, Edit2, Save, X,
  ChevronRight, Building2, Tag, User, MoreHorizontal, Plus,
  CheckCircle2, XCircle, AlertCircle, Loader2
} from "lucide-react";
import { formatDateShort as fmtDateShort } from "../../../shared/dateUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import ConversionHistory from "@/components/ConversionHistory";
import MergeHistory from "@/components/MergeHistory";
import DuplicateAlert from "@/components/DuplicateAlert";

// ─── Types ───
interface ContactMetrics {
  totalDeals: number;
  wonDeals: number;
  totalSpentCents: number;
  daysSinceLastPurchase: number | null;
}

interface ContactDeal {
  id: number;
  title: string;
  status: string;
  valueCents: number;
  currency: string;
  probability: number;
  expectedCloseAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  stageName: string | null;
  pipelineName: string | null;
}

interface CustomFieldValue {
  id: number;
  fieldId: number;
  value: string | null;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  optionsJson: any;
  isRequired: boolean;
  isVisibleOnProfile: boolean;
  groupName: string | null;
}

interface CustomFieldDef {
  id: number;
  name: string;
  label: string;
  fieldType: string;
  optionsJson: any;
  defaultValue: string | null;
  placeholder: string | null;
  isRequired: boolean;
  isVisibleOnForm: boolean;
  isVisibleOnProfile: boolean;
  sortOrder: number;
  groupName: string | null;
}

// ─── Helpers ───
function formatCurrency(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
}

function statusColor(status: string) {
  switch (status) {
    case "won": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "lost": return "bg-red-500/15 text-red-400 border-red-500/30";
    case "open": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    default: return "bg-muted text-muted-foreground";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "won": return "Ganho";
    case "lost": return "Perdido";
    case "open": return "Em andamento";
    default: return status;
  }
}

function lifecycleLabel(stage: string) {
  switch (stage) {
    case "lead": return "Lead";
    case "prospect": return "Prospect";
    case "customer": return "Cliente";
    case "churned": return "Churned";
    default: return stage;
  }
}

function lifecycleColor(stage: string) {
  switch (stage) {
    case "lead": return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    case "prospect": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "customer": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "churned": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground";
  }
}

// ─── Metric Card ───
function MetricCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Custom Field Renderer ───
function CustomFieldInput({ field, value, onChange }: {
  field: CustomFieldDef; value: string; onChange: (v: string) => void;
}) {
  let parsedOpts = field.optionsJson;
  if (typeof parsedOpts === "string") { try { parsedOpts = JSON.parse(parsedOpts); } catch { parsedOpts = null; } }
  const options: string[] = Array.isArray(parsedOpts) ? parsedOpts : [];

  switch (field.fieldType) {
    case "text":
    case "email":
    case "phone":
    case "url":
      return (
        <Input
          type={field.fieldType === "email" ? "email" : field.fieldType === "phone" ? "tel" : field.fieldType === "url" ? "url" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || field.label}
          className="bg-background/50"
        />
      );
    case "number":
    case "currency":
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "0"}
          className="bg-background/50"
        />
      );
    case "date":
      return (
        <DatePicker
          value={value}
          onChange={onChange}
          placeholder={field.placeholder || field.label}
          className="bg-background/50 h-9"
        />
      );
    case "textarea":
      return (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || field.label}
          className="bg-background/50 min-h-[80px]"
        />
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            checked={value === "true"}
            onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
          />
          <span className="text-sm text-foreground">{field.label}</span>
        </div>
      );
    case "select":
      return (
        <Select value={value || "_none_"} onValueChange={(v) => onChange(v === "_none_" ? "" : v)}>
          <SelectTrigger className="bg-background/50">
            <SelectValue placeholder={field.placeholder || "Selecionar..."} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none_">Nenhum</SelectItem>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multiselect": {
      const selected = value ? value.split("|||").filter(Boolean) : [];
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const isSelected = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const next = isSelected
                    ? selected.filter((s) => s !== opt)
                    : [...selected, opt];
                  onChange(next.join("|||"));
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  isSelected
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    }
    default:
      return (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || field.label}
          className="bg-background/50"
        />
      );
  }
}

function CustomFieldDisplay({ field, value }: { field: CustomFieldDef; value: string }) {
  if (!value && value !== "false") return <span className="text-muted-foreground text-sm italic">Não preenchido</span>;

  switch (field.fieldType) {
    case "checkbox":
      return value === "true"
        ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        : <XCircle className="h-4 w-4 text-muted-foreground" />;
    case "currency":
      return <span className="text-sm font-medium text-foreground">{formatCurrency(Number(value) * 100)}</span>;
    case "date":
      return <span className="text-sm text-foreground">{formatDate(value)}</span>;
    case "multiselect":
      return (
        <div className="flex flex-wrap gap-1">
          {value.split("|||").filter(Boolean).map((v) => (
            <Badge key={v} variant="outline" className="text-xs">{v}</Badge>
          ))}
        </div>
      );
    case "url":
      return <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{value}</a>;
    case "email":
      return <a href={`mailto:${value}`} className="text-sm text-primary hover:underline">{value}</a>;
    case "phone":
      return <a href={`tel:${value}`} className="text-sm text-primary hover:underline">{value}</a>;
    default:
      return <span className="text-sm text-foreground">{value}</span>;
  }
}

// ─── Main Component ───
export default function ContactProfile() {
  const [, params] = useRoute("/contact/:id");
  const contactId = Number(params?.id);
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<{ name: string; email: string; phone: string; notes: string; birthDate: string; weddingDate: string }>({ name: "", email: "", phone: "", notes: "", birthDate: "", weddingDate: "" });
  const [customFieldEdits, setCustomFieldEdits] = useState<Record<number, string>>({});
  const [isEditingCustom, setIsEditingCustom] = useState(false);

  // Queries
  const contactQ = trpc.crm.contacts.get.useQuery({ id: contactId }, { enabled: !!contactId });
  const metricsQ = trpc.contactProfile.getMetrics.useQuery({ contactId }, { enabled: !!contactId });
  const dealsQ = trpc.contactProfile.getDeals.useQuery({ contactId }, { enabled: !!contactId });
  const customFieldsQ = trpc.customFields.list.useQuery({ entity: "contact" });
  const customValuesQ = trpc.contactProfile.getCustomFieldValues.useQuery(
    { entityType: "contact", entityId: contactId },
    { enabled: !!contactId }
  );

  // Mutations
  const utils = trpc.useUtils();
  const updateContact = trpc.crm.contacts.update.useMutation({
    onSuccess: () => {
      utils.crm.contacts.get.invalidate({ id: contactId });
      setIsEditing(false);
      toast.success("Contato atualizado");
    },
    onError: () => toast.error("Erro ao atualizar contato"),
  });
  const setCustomValues = trpc.contactProfile.setCustomFieldValues.useMutation({
    onSuccess: () => {
      utils.contactProfile.getCustomFieldValues.invalidate({ entityType: "contact", entityId: contactId });
      setIsEditingCustom(false);
      toast.success("Campos personalizados salvos");
    },
    onError: () => toast.error("Erro ao salvar campos"),
  });

  const contact = contactQ.data as any;
  const metrics = (metricsQ.data || { totalDeals: 0, wonDeals: 0, totalSpentCents: 0, daysSinceLastPurchase: null }) as ContactMetrics;
  const deals = (dealsQ.data || []) as ContactDeal[];
  const customFields = (customFieldsQ.data || []) as CustomFieldDef[];
  const customValues = (customValuesQ.data || []) as CustomFieldValue[];

  // Build value map
  const valueMap = useMemo(() => {
    const map: Record<number, string> = {};
    customValues.forEach((v) => { map[v.fieldId] = v.value || ""; });
    return map;
  }, [customValues]);

  // Visible fields on profile
  const visibleFields = useMemo(() =>
    customFields.filter((f) => f.isVisibleOnProfile),
    [customFields]
  );

  // Group fields
  const groupedFields = useMemo(() => {
    const groups: Record<string, CustomFieldDef[]> = {};
    visibleFields.forEach((f) => {
      const g = f.groupName || "Informações Adicionais";
      if (!groups[g]) groups[g] = [];
      groups[g].push(f);
    });
    return groups;
  }, [visibleFields]);

  function startEdit() {
    if (!contact) return;
    setEditData({
      name: contact.name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      notes: contact.notes || "",
      birthDate: contact.birthDate || "",
      weddingDate: contact.weddingDate || "",
    });
    setIsEditing(true);
  }

  function saveEdit() {
    updateContact.mutate({ id: contactId,
      name: editData.name,
      email: editData.email || undefined,
      phone: editData.phone || undefined,
      birthDate: editData.birthDate || null,
      weddingDate: editData.weddingDate || null,
    });
  }

  function startEditCustom() {
    const edits: Record<number, string> = {};
    // Show ALL custom fields in edit mode, not just visibleOnProfile
    customFields.forEach((f) => {
      edits[f.id] = valueMap[f.id] || f.defaultValue || "";
    });
    setCustomFieldEdits(edits);
    setIsEditingCustom(true);
  }

  function saveCustomFields() {
    const values = Object.entries(customFieldEdits).map(([fieldId, value]) => ({
      fieldId: Number(fieldId),
      value: value || null,
    }));
    setCustomValues.mutate({ entityType: "contact", entityId: contactId, values });
  }

  if (!contactId || contactQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Contato não encontrado</p>
        <Link href="/contacts">
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
        </Link>
      </div>
    );
  }

  const conversionRate = metrics.totalDeals > 0
    ? Math.round((metrics.wonDeals / metrics.totalDeals) * 100)
    : 0;

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/contacts">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-4 flex-1">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
            {(contact.name || "?")[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="text-xl font-bold bg-background/50 max-w-md"
              />
            ) : (
              <h1 className="text-2xl font-bold text-foreground truncate">{contact.name}</h1>
            )}
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline" className={lifecycleColor(contact.lifecycleStage)}>
                {lifecycleLabel(contact.lifecycleStage)}
              </Badge>
              {contact.source && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" /> {contact.source}
                </span>
              )}
              {contact.type === "company" && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Empresa
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={updateContact.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Salvar
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Edit2 className="h-4 w-4 mr-1" /> Editar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={FileText}
          label="Cotações Feitas"
          value={String(metrics.totalDeals)}
          sub={`${metrics.wonDeals} fechada${metrics.wonDeals !== 1 ? "s" : ""}`}
          color="bg-blue-500/15 text-blue-400"
        />
        <MetricCard
          icon={Award}
          label="Taxa de Conversão"
          value={`${conversionRate}%`}
          sub={`${metrics.wonDeals} de ${metrics.totalDeals} negociações`}
          color="bg-emerald-500/15 text-emerald-400"
        />
        <MetricCard
          icon={DollarSign}
          label="Total Comprado"
          value={formatCurrency(metrics.totalSpentCents)}
          sub="Negociações ganhas"
          color="bg-purple-500/15 text-purple-400"
        />
        <MetricCard
          icon={Clock}
          label="Última Compra"
          value={metrics.daysSinceLastPurchase !== null ? `${metrics.daysSinceLastPurchase} dias` : "—"}
          sub={metrics.daysSinceLastPurchase !== null ? "atrás" : "Nenhuma compra"}
          color="bg-amber-500/15 text-amber-400"
        />
      </div>

      {/* Duplicate Alert */}
      <DuplicateAlert contactId={contactId} email={contact.email} phone={contact.phone} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Contact info + Custom fields */}
        <div className="space-y-6">
          {/* Basic Info */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Dados do Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  {isEditing ? (
                    <Input
                      type="email"
                      value={editData.email}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      placeholder="email@exemplo.com"
                      className="bg-background/50"
                    />
                  ) : (
                    <span className="text-sm text-foreground">
                      {contact.email || <span className="text-muted-foreground italic">Sem email</span>}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  {isEditing ? (
                    <Input
                      type="tel"
                      value={editData.phone}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                      className="bg-background/50"
                    />
                  ) : (
                    <span className="text-sm text-foreground">
                      {contact.phone || <span className="text-muted-foreground italic">Sem telefone</span>}
                    </span>
                  )}
                </div>
                {contact.docId && (
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">{contact.docId}</span>
                  </div>
                )}
              </div>

              {isEditing && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Aniversário</label>
                      <DatePicker
                        value={editData.birthDate}
                        onChange={(v) => setEditData({ ...editData, birthDate: v })}
                        placeholder="Selecionar data"
                        className="bg-background/50 h-9"
                        monthDay
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Casamento</label>
                      <DatePicker
                        value={editData.weddingDate}
                        onChange={(v) => setEditData({ ...editData, weddingDate: v })}
                        placeholder="Selecionar data"
                        className="bg-background/50 h-9"
                        monthDay
                      />
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
                    <Textarea
                      value={editData.notes}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      placeholder="Notas sobre o contato..."
                      className="bg-background/50 min-h-[80px]"
                    />
                  </div>
                </>
              )}

              {/* Birthday & Wedding display (view mode) */}
              {!isEditing && (contact.birthDate || contact.weddingDate) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {contact.birthDate && (
                      <div>
                        <span className="text-muted-foreground">Aniversário</span>
                        <p className="text-foreground font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {contact.birthDate}
                        </p>
                      </div>
                    )}
                    {contact.weddingDate && (
                      <div>
                        <span className="text-muted-foreground">Casamento</span>
                        <p className="text-foreground font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {contact.weddingDate}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {!isEditing && contact.notes && (
                <>
                  <Separator />
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{contact.notes}</p>
                  </div>
                </>
              )}

              <Separator />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Criado em</span>
                  <p className="text-foreground font-medium">{formatDate(contact.createdAt)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Atualizado em</span>
                  <p className="text-foreground font-medium">{formatDate(contact.updatedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Custom Fields */}
          {(visibleFields.length > 0 || customFields.length > 0) && (
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    Campos Personalizados
                  </CardTitle>
                  {!isEditingCustom ? (
                    <Button size="sm" variant="ghost" onClick={startEditCustom} className="h-7 text-xs">
                      <Edit2 className="h-3 w-3 mr-1" /> Editar
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setIsEditingCustom(false)} className="h-7 text-xs">
                        <X className="h-3 w-3 mr-1" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={saveCustomFields} disabled={setCustomValues.isPending} className="h-7 text-xs">
                        <Save className="h-3 w-3 mr-1" /> Salvar
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {customFields.length === 0 ? (
                  <div className="text-center py-6">
                    <Tag className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum campo personalizado configurado</p>
                    <Link href="/settings/custom-fields">
                      <Button variant="link" size="sm" className="mt-1 text-xs">
                        <Plus className="h-3 w-3 mr-1" /> Configurar campos
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      // In edit mode show ALL fields, in view mode show only visibleOnProfile
                      const fieldsToShow = isEditingCustom ? customFields : visibleFields;
                      const groups: Record<string, typeof fieldsToShow> = {};
                      fieldsToShow.forEach((f) => {
                        const g = f.groupName || "Informações Adicionais";
                        if (!groups[g]) groups[g] = [];
                        groups[g].push(f);
                      });
                      return Object.entries(groups).map(([group, fields]) => (
                        <div key={group}>
                          {Object.keys(groups).length > 1 && (
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group}</p>
                          )}
                          <div className="space-y-3">
                            {fields.map((field) => (
                              <div key={field.id}>
                                {field.fieldType !== "checkbox" && (
                                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.label}</label>
                                )}
                                {isEditingCustom ? (
                                  <CustomFieldInput
                                    field={field}
                                    value={customFieldEdits[field.id] || ""}
                                    onChange={(v) => setCustomFieldEdits({ ...customFieldEdits, [field.id]: v })}
                                  />
                                ) : (
                                  <CustomFieldDisplay field={field} value={valueMap[field.id] || ""} />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Deals */}
        <div className="lg:col-span-2">
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  Negociações ({deals.length})
                </CardTitle>
                <Link href="/pipeline">
                  <Button size="sm" variant="outline" className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Nova Negociação
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {dealsQ.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : deals.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma negociação encontrada</p>
                  <p className="text-xs text-muted-foreground mt-1">Crie uma negociação vinculada a este contato</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Summary bar */}
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-6 text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-blue-400" />
                          Abertas: {deals.filter((d) => d.status === "open").length}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          Ganhas: {deals.filter((d) => d.status === "won").length}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-red-400" />
                          Perdidas: {deals.filter((d) => d.status === "lost").length}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Valor total aberto</p>
                      <p className="text-sm font-bold text-foreground">
                        {formatCurrency(deals.filter((d) => d.status === "open").reduce((s, d) => s + (d.valueCents || 0), 0))}
                      </p>
                    </div>
                  </div>

                  {/* Deal list */}
                  {deals.map((deal) => (
                    <Link key={deal.id} href={`/deal/${deal.id}`}>
                      <div className="flex items-center gap-4 p-3 rounded-lg border border-border/30 hover:bg-muted/30 transition-colors cursor-pointer group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                              {deal.title}
                            </p>
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColor(deal.status)}`}>
                              {statusLabel(deal.status)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {deal.pipelineName && <span>{deal.pipelineName}</span>}
                            {deal.stageName && (
                              <>
                                <ChevronRight className="h-3 w-3" />
                                <span>{deal.stageName}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{formatDate(deal.createdAt)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(deal.valueCents || 0, deal.currency)}
                          </p>
                          {deal.probability > 0 && (
                            <p className="text-[10px] text-muted-foreground">{deal.probability}% prob.</p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Conversion History + Merge History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversionHistory contactId={contactId} />
        <MergeHistory contactId={contactId} />
      </div>
    </div>
  );
}
