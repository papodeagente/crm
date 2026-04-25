import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { useLocation } from "wouter";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  ArrowLeft, ArrowRight, Plus, Trash2, Edit2, Loader2, Link2, Unlink,
  Settings, Zap, AlertCircle, CheckCircle2, HelpCircle, RefreshCw,
} from "lucide-react";
/* ── Campos comuns do RD Station para sugestão ── */
const RD_COMMON_FIELDS = [
  { key: "email", label: "Email" },
  { key: "name", label: "Nome" },
  { key: "personal_phone", label: "Telefone pessoal" },
  { key: "mobile_phone", label: "Telefone celular" },
  { key: "company", label: "Empresa" },
  { key: "job_title", label: "Cargo" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado" },
  { key: "country", label: "País" },
  { key: "website", label: "Website" },
  { key: "twitter", label: "Twitter" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "tags", label: "Tags" },
  { key: "lead_stage", label: "Estágio do Lead" },
  { key: "traffic_source", label: "Fonte de tráfego (utm_source)" },
  { key: "traffic_medium", label: "Mídia de tráfego (utm_medium)" },
  { key: "traffic_campaign", label: "Campanha de tráfego (utm_campaign)" },
  { key: "utm_source", label: "UTM Source" },
  { key: "utm_medium", label: "UTM Medium" },
  { key: "utm_campaign", label: "UTM Campaign" },
  { key: "utm_term", label: "UTM Term" },
  { key: "utm_content", label: "UTM Content" },
];

export default function RDFieldMappings() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [, setLocation] = useLocation();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Queries
  const mappingsQ = trpc.fieldMappings.list.useQuery(undefined, { enabled: isAdmin });
  const standardFieldsQ = trpc.fieldMappings.enturStandardFields.useQuery(undefined, { enabled: isAdmin });
  const customFieldsQ = trpc.fieldMappings.enturCustomFields.useQuery(undefined, { enabled: isAdmin });

  if (!adminLoading && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4 py-20">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          O Mapeamento de Campos é exclusivo para administradores.
        </p>
        <button
          onClick={() => setLocation("/settings")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Voltar às Configurações
        </button>
      </div>
    );
  }

  const mappings = mappingsQ.data || [];
  const standardFields = standardFieldsQ.data || [];
  const customFieldsList = customFieldsQ.data || [];

  // Mutations
  const createMapping = trpc.fieldMappings.create.useMutation({
    onSuccess: () => { mappingsQ.refetch(); setShowAdd(false); toast.success("Mapeamento criado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMapping = trpc.fieldMappings.update.useMutation({
    onSuccess: () => { mappingsQ.refetch(); setEditingId(null); toast.success("Mapeamento atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMapping = trpc.fieldMappings.delete.useMutation({
    onSuccess: () => { mappingsQ.refetch(); toast.success("Mapeamento removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  // Active/inactive counts
  const activeMappings = mappings.filter((m: any) => m.isActive);
  const inactiveMappings = mappings.filter((m: any) => !m.isActive);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3 mb-1">
            <Link to="/settings/rdstation" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Link2 className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Mapeamento de Campos</h1>
                <p className="text-xs text-muted-foreground">RD Station Marketing ↔ Clinilucro</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Info Card */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
          <div className="flex gap-3">
            <HelpCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Como funciona o mapeamento?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Quando um lead chega do RD Station via webhook, o sistema verifica os mapeamentos configurados aqui.
                Para cada campo do RD Station mapeado, o valor é automaticamente copiado para o campo correspondente no Clinilucro.
                Isso permite que <strong>campos personalizados</strong> do RD Station (como interesse, orçamento, destino preferido)
                sejam vinculados a campos do seu CRM sem intervenção manual.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="text-[10px]">
                  <Zap className="h-3 w-3 mr-1" /> Automático a cada webhook
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  <Settings className="h-3 w-3 mr-1" /> Campos padrão + personalizados
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{mappings.length}</p>
            <p className="text-xs text-muted-foreground">Total de mapeamentos</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{activeMappings.length}</p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{inactiveMappings.length}</p>
            <p className="text-xs text-muted-foreground">Inativos</p>
          </div>
        </div>

        {/* Add Button */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Mapeamentos configurados</h2>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo Mapeamento
          </Button>
        </div>

        {/* Mappings List */}
        {mappingsQ.isLoading ? (
          <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : mappings.length === 0 ? (
          <div className="text-center py-12 bg-card border border-dashed border-border rounded-xl">
            <Unlink className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum mapeamento configurado</p>
            <p className="text-xs text-muted-foreground mt-1">Crie mapeamentos para vincular campos do RD Station aos campos do Clinilucro</p>
            <Button size="sm" className="mt-4" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar primeiro mapeamento
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-[1fr_40px_1fr_100px] gap-3 px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <span>Campo RD Station</span>
              <span></span>
              <span>Campo Clinilucro</span>
              <span className="text-right">Ações</span>
            </div>

            {mappings.map((m: any) => {
              const enturLabel = m.enturFieldType === "standard"
                ? standardFields.find((f: any) => f.key === m.enturFieldKey)?.label || m.enturFieldKey || "—"
                : customFieldsList.find((f: any) => f.id === m.enturCustomFieldId)?.label || `Campo #${m.enturCustomFieldId}`;

              return (
                <div
                  key={m.id}
                  className={`grid grid-cols-[1fr_40px_1fr_100px] gap-3 items-center p-4 bg-card border rounded-lg transition-all ${
                    m.isActive ? "border-border hover:border-primary/30" : "border-border/50 opacity-60"
                  }`}
                >
                  {/* RD Station Field */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-orange-500/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-orange-600">RD</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.rdFieldLabel}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{m.rdFieldKey}</p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <ArrowRight className={`h-4 w-4 ${m.isActive ? "text-primary" : "text-muted-foreground/40"}`} />
                  </div>

                  {/* Clinilucro Field */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary">EN</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{enturLabel}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${
                            m.targetEntity === "deal" ? "bg-blue-500/10 text-blue-600 border-blue-200" :
                            m.targetEntity === "contact" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" :
                            "bg-amber-500/10 text-amber-600 border-amber-200"
                          }`}
                        >
                          {m.targetEntity === "deal" ? "Negociacao" : m.targetEntity === "contact" ? "Cliente" : "Empresa"}
                        </Badge>
                        <Badge variant={m.enturFieldType === "standard" ? "secondary" : "outline"} className="text-[9px]">
                          {m.enturFieldType === "standard" ? "Padrão" : "Personalizado"}
                        </Badge>
                        {m.isActive ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => updateMapping.mutate({ id: m.id, isActive: !m.isActive })}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                      title={m.isActive ? "Desativar" : "Ativar"}
                    >
                      {m.isActive ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditingId(m.id)}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-primary" />
                    </button>
                    <button
                      onClick={() => { if (confirm("Remover este mapeamento?")) deleteMapping.mutate({ id: m.id}); }}
                      className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* UTM Default Mappings Info */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Mapeamentos automáticos (UTMs)
          </h3>
          <p className="text-xs text-muted-foreground">
            Os seguintes campos UTM são mapeados automaticamente pelo sistema quando um lead chega do RD Station.
            Não é necessário criar mapeamentos manuais para eles.
          </p>
          <div className="space-y-1.5">
            {[
              { rd: "utm_source / traffic_source", entur: "Negociação → UTM Source (Origem)" },
              { rd: "utm_medium / traffic_medium", entur: "Negociação → UTM Medium (Mídia)" },
              { rd: "utm_campaign / traffic_campaign", entur: "Negociação → UTM Campaign (Campanha)" },
              { rd: "utm_term", entur: "Negociação → UTM Term (Termo/Palavra-chave)" },
              { rd: "utm_content", entur: "Negociação → UTM Content (Conteúdo/Criativo)" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
                <Badge variant="outline" className="text-[10px] shrink-0 bg-orange-500/5 text-orange-600 border-orange-200">
                  {item.rd}
                </Badge>
                <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs text-foreground">{item.entur}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 ml-auto shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dialog: Create Mapping */}
      <MappingDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        standardFields={standardFields}
        customFields={customFieldsList}
        onSave={(data) => createMapping.mutate({ ...data })}
        isPending={createMapping.isPending}
      />

      {/* Dialog: Edit Mapping */}
      {editingId && (
        <MappingDialog
          open={true}
          onOpenChange={() => setEditingId(null)}
          standardFields={standardFields}
          customFields={customFieldsList}
          initialData={mappings.find((m: any) => m.id === editingId)}
          onSave={(data) => updateMapping.mutate({ id: editingId, ...data })}
          isPending={updateMapping.isPending}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* MAPPING DIALOG                                              */
/* ════════════════════════════════════════════════════════════ */

function MappingDialog({
  open, onOpenChange, standardFields, customFields, initialData, onSave, isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  standardFields: Array<{ key: string; label: string; entity: string }>;
  customFields: Array<{ id: number; key: string; label: string; entity: string; fieldType: string }>;
  initialData?: any;
  onSave: (data: { rdFieldKey: string; rdFieldLabel: string; targetEntity: "deal" | "contact" | "company"; enturFieldType: "standard" | "custom"; enturFieldKey?: string; enturCustomFieldId?: number }) => void;
  isPending: boolean;
}) {
  const [rdFieldKey, setRdFieldKey] = useState(initialData?.rdFieldKey || "");
  const [rdFieldLabel, setRdFieldLabel] = useState(initialData?.rdFieldLabel || "");
  const [targetEntity, setTargetEntity] = useState<"deal" | "contact" | "company">(initialData?.targetEntity || "deal");
  const [enturFieldType, setEnturFieldType] = useState<"standard" | "custom">(initialData?.enturFieldType || "standard");
  const [enturFieldKey, setEnturFieldKey] = useState(initialData?.enturFieldKey || "");
  const [enturCustomFieldId, setEnturCustomFieldId] = useState<number | null>(initialData?.enturCustomFieldId || null);
  const [rdSearch, setRdSearch] = useState("");

  // Filter standard/custom fields by selected entity
  const entityMap: Record<string, string> = { deal: "deal", contact: "contact", company: "account" };
  const filteredStandardFields = useMemo(() => {
    return standardFields.filter(f => f.entity === entityMap[targetEntity]);
  }, [standardFields, targetEntity]);
  const filteredCustomFields = useMemo(() => {
    return customFields.filter(f => f.entity === targetEntity || (targetEntity === "company" && f.entity === "account"));
  }, [customFields, targetEntity]);

  const filteredRdFields = useMemo(() => {
    if (!rdSearch.trim()) return RD_COMMON_FIELDS;
    const term = rdSearch.toLowerCase();
    return RD_COMMON_FIELDS.filter(f =>
      f.key.toLowerCase().includes(term) || f.label.toLowerCase().includes(term)
    );
  }, [rdSearch]);

  const canSave = rdFieldKey.trim() && rdFieldLabel.trim() && (
    (enturFieldType === "standard" && enturFieldKey) ||
    (enturFieldType === "custom" && enturCustomFieldId)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Mapeamento" : "Novo Mapeamento"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-2">
          {/* RD Station Field */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-orange-500/10 flex items-center justify-center">
                <span className="text-[9px] font-bold text-orange-600">RD</span>
              </div>
              <h3 className="text-sm font-semibold">Campo do RD Station</h3>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Chave do campo (field key)</label>
              <Input
                placeholder="Ex: cf_destino_interesse, company, job_title"
                value={rdFieldKey}
                onChange={(e) => setRdFieldKey(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome amigável</label>
              <Input
                placeholder="Ex: Interesse, Empresa, Cargo"
                value={rdFieldLabel}
                onChange={(e) => setRdFieldLabel(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Quick select from common fields */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Ou selecione um campo comum:</label>
              <Input
                placeholder="Buscar campo do RD Station..."
                value={rdSearch}
                onChange={(e) => setRdSearch(e.target.value)}
                className="mt-1 mb-2"
              />
              <div className="max-h-[120px] overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {filteredRdFields.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => { setRdFieldKey(f.key); setRdFieldLabel(f.label); }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors ${
                      rdFieldKey === f.key ? "bg-primary/10 text-primary font-medium" : ""
                    }`}
                  >
                    <span className="font-mono text-muted-foreground">{f.key}</span>
                    <span className="ml-2">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Divider with arrow */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 border-t border-border" />
            <ArrowRight className="h-5 w-5 text-primary" />
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Target Entity */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-violet-500/10 flex items-center justify-center">
                <span className="text-[9px] font-bold text-violet-600">→</span>
              </div>
              <h3 className="text-sm font-semibold">Entidade de destino</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["deal", "contact", "company"] as const).map((entity) => {
                const labels = { deal: "Negociacao", contact: "Cliente", company: "Empresa" };
                const colors = { deal: "bg-blue-500/10 text-blue-600 border-blue-200", contact: "bg-emerald-500/10 text-emerald-600 border-emerald-200", company: "bg-amber-500/10 text-amber-600 border-amber-200" };
                return (
                  <button
                    key={entity}
                    onClick={() => { setTargetEntity(entity); setEnturFieldKey(""); setEnturCustomFieldId(null); }}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      targetEntity === entity
                        ? colors[entity] + " ring-2 ring-offset-1 ring-primary/30"
                        : "bg-card border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {labels[entity]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clinilucro Field */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                <span className="text-[9px] font-bold text-primary">EN</span>
              </div>
              <h3 className="text-sm font-semibold">Campo do Clinilucro</h3>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo de campo</label>
              <Select value={enturFieldType} onValueChange={(v) => { setEnturFieldType(v as any); setEnturFieldKey(""); setEnturCustomFieldId(null); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Campo padrão do sistema</SelectItem>
                  <SelectItem value="custom">Campo personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {enturFieldType === "standard" ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Selecione o campo padrão</label>
                {filteredStandardFields.length === 0 ? (
                  <div className="mt-2 p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Nenhum campo padrao disponivel para {targetEntity === "deal" ? "Negociacao" : targetEntity === "contact" ? "Cliente" : "Empresa"}</p>
                  </div>
                ) : (
                  <Select value={enturFieldKey} onValueChange={setEnturFieldKey}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Escolha um campo..." /></SelectTrigger>
                    <SelectContent>
                      {filteredStandardFields.map((f) => (
                        <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Selecione o campo personalizado</label>
                {filteredCustomFields.length === 0 ? (
                  <div className="mt-2 p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Nenhum campo personalizado de {targetEntity === "deal" ? "Negociacao" : targetEntity === "contact" ? "Cliente" : "Empresa"}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Crie campos personalizados em Configurações → Campos Personalizados</p>
                  </div>
                ) : (
                  <Select
                    value={enturCustomFieldId ? String(enturCustomFieldId) : ""}
                    onValueChange={(v) => setEnturCustomFieldId(parseInt(v))}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Escolha um campo..." /></SelectTrigger>
                    <SelectContent>
                      {filteredCustomFields.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {f.label} <span className="text-muted-foreground ml-1">({f.fieldType})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!canSave || isPending}
            onClick={() => onSave({
              rdFieldKey,
              rdFieldLabel,
              targetEntity,
              enturFieldType,
              enturFieldKey: enturFieldType === "standard" ? enturFieldKey : undefined,
              enturCustomFieldId: enturFieldType === "custom" ? (enturCustomFieldId || undefined) : undefined,
            })}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {initialData ? "Salvar" : "Criar Mapeamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
