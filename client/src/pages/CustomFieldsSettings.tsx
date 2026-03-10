import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { AdminOnlyGuard } from "@/components/AdminOnlyGuard";
import {
  ArrowLeft, Plus, Edit2, Trash2, GripVertical, Eye, EyeOff,
  ChevronDown, ChevronUp, Save, X, Tag, Settings2, Type,
  Hash, Calendar, List, CheckSquare, AlignLeft, Mail, Phone,
  Globe, DollarSign, ListChecks, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Types ───
interface CustomField {
  id: number;
  tenantId: number;
  entity: string;
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

const FIELD_TYPES = [
  { value: "text", label: "Texto", icon: Type, desc: "Campo de texto simples" },
  { value: "number", label: "Número", icon: Hash, desc: "Valor numérico" },
  { value: "date", label: "Data", icon: Calendar, desc: "Seletor de data" },
  { value: "select", label: "Seleção Única", icon: List, desc: "Dropdown com opções" },
  { value: "multiselect", label: "Seleção Múltipla", icon: ListChecks, desc: "Múltiplas opções" },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare, desc: "Sim ou Não" },
  { value: "textarea", label: "Texto Longo", icon: AlignLeft, desc: "Área de texto expandida" },
  { value: "email", label: "Email", icon: Mail, desc: "Endereço de email" },
  { value: "phone", label: "Telefone", icon: Phone, desc: "Número de telefone" },
  { value: "url", label: "URL", icon: Globe, desc: "Link da web" },
  { value: "currency", label: "Moeda", icon: DollarSign, desc: "Valor monetário" },
];

const ENTITIES = [
  { value: "contact", label: "Contatos" },
  { value: "deal", label: "Negociações" },
  { value: "account", label: "Contas" },
  { value: "trip", label: "Viagens" },
];

function getFieldIcon(fieldType: string) {
  const ft = FIELD_TYPES.find((t) => t.value === fieldType);
  return ft?.icon || Type;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// ─── Field Form Dialog ───
function FieldFormDialog({
  open, onClose, onSave, field, isPending
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  field: CustomField | null;
  isPending: boolean;
}) {
  const [label, setLabel] = useState(field?.label || "");
  const [name, setName] = useState(field?.name || "");
  const [fieldType, setFieldType] = useState(field?.fieldType || "text");
  const [placeholder, setPlaceholder] = useState(field?.placeholder || "");
  const [defaultValue, setDefaultValue] = useState(field?.defaultValue || "");
  const [isRequired, setIsRequired] = useState(field?.isRequired || false);
  const [isVisibleOnForm, setIsVisibleOnForm] = useState(field?.isVisibleOnForm ?? true);
  const [isVisibleOnProfile, setIsVisibleOnProfile] = useState(field?.isVisibleOnProfile ?? true);
  const [groupName, setGroupName] = useState(field?.groupName || "");
  const [optionsText, setOptionsText] = useState(
    Array.isArray(field?.optionsJson) ? field.optionsJson.join("\n") : ""
  );
  const [autoSlug, setAutoSlug] = useState(!field);

  const needsOptions = fieldType === "select" || fieldType === "multiselect";

  function handleLabelChange(v: string) {
    setLabel(v);
    if (autoSlug) setName(slugify(v));
  }

  function handleSave() {
    if (!label.trim() || !name.trim()) {
      toast.error("Nome e label são obrigatórios");
      return;
    }
    const options = needsOptions
      ? optionsText.split("\n").map((s) => s.trim()).filter(Boolean)
      : undefined;

    onSave({
      label: label.trim(),
      name: name.trim(),
      fieldType,
      placeholder: placeholder.trim() || undefined,
      defaultValue: defaultValue.trim() || undefined,
      isRequired,
      isVisibleOnForm,
      isVisibleOnProfile,
      groupName: groupName.trim() || undefined,
      optionsJson: options,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{field ? "Editar Campo" : "Novo Campo Personalizado"}</DialogTitle>
          <DialogDescription>
            {field ? "Altere as propriedades do campo." : "Configure um novo campo para personalizar seu CRM."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Label */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Label (nome visível)</label>
            <Input value={label} onChange={(e) => handleLabelChange(e.target.value)} placeholder="Ex: Data de Nascimento" />
          </div>

          {/* Slug */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Identificador (slug)
              {autoSlug && <span className="text-xs text-muted-foreground ml-2">— gerado automaticamente</span>}
            </label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setAutoSlug(false); }}
              placeholder="data_nascimento"
              className="font-mono text-sm"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Tipo do Campo</label>
            <div className="grid grid-cols-3 gap-2">
              {FIELD_TYPES.map((ft) => {
                const Icon = ft.icon;
                const isActive = fieldType === ft.value;
                return (
                  <button
                    key={ft.value}
                    type="button"
                    onClick={() => setFieldType(ft.value)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all text-xs ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/50 bg-background/50 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium truncate">{ft.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options for select/multiselect */}
          {needsOptions && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Opções <span className="text-xs text-muted-foreground">(uma por linha)</span>
              </label>
              <Textarea
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder={"Opção 1\nOpção 2\nOpção 3"}
                className="min-h-[100px] font-mono text-sm"
              />
            </div>
          )}

          {/* Placeholder */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Placeholder</label>
            <Input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} placeholder="Texto de ajuda..." />
          </div>

          {/* Default value */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Valor Padrão</label>
            <Input value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} placeholder="Opcional" />
          </div>

          {/* Group */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Grupo (opcional)</label>
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ex: Dados Pessoais" />
          </div>

          <Separator />

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Obrigatório</p>
                <p className="text-xs text-muted-foreground">Campo deve ser preenchido</p>
              </div>
              <Switch checked={isRequired} onCheckedChange={setIsRequired} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Visível no Cadastro</p>
                <p className="text-xs text-muted-foreground">Aparece no formulário de criação/edição</p>
              </div>
              <Switch checked={isVisibleOnForm} onCheckedChange={setIsVisibleOnForm} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Visível no Perfil</p>
                <p className="text-xs text-muted-foreground">Aparece na página de perfil do contato</p>
              </div>
              <Switch checked={isVisibleOnProfile} onCheckedChange={setIsVisibleOnProfile} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            {field ? "Salvar" : "Criar Campo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───
export default function CustomFieldsSettings() {
  const tenantId = 1;
  const [activeEntity, setActiveEntity] = useState<string>("contact");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fieldsQ = trpc.customFields.list.useQuery({ tenantId, entity: activeEntity as any });
  const utils = trpc.useUtils();

  const createField = trpc.customFields.create.useMutation({
    onSuccess: () => {
      utils.customFields.list.invalidate({ tenantId, entity: activeEntity as any });
      setDialogOpen(false);
      setEditingField(null);
      toast.success("Campo criado com sucesso");
    },
    onError: () => toast.error("Erro ao criar campo"),
  });

  const updateField = trpc.customFields.update.useMutation({
    onSuccess: () => {
      utils.customFields.list.invalidate({ tenantId, entity: activeEntity as any });
      setDialogOpen(false);
      setEditingField(null);
      toast.success("Campo atualizado");
    },
    onError: () => toast.error("Erro ao atualizar campo"),
  });

  const deleteField = trpc.customFields.delete.useMutation({
    onSuccess: () => {
      utils.customFields.list.invalidate({ tenantId, entity: activeEntity as any });
      setDeleteConfirm(null);
      toast.success("Campo excluído");
    },
    onError: () => toast.error("Erro ao excluir campo"),
  });

  const reorderFields = trpc.customFields.reorder.useMutation({
    onSuccess: () => {
      utils.customFields.list.invalidate({ tenantId, entity: activeEntity as any });
    },
  });

  const fields = (fieldsQ.data || []) as CustomField[];

  function handleCreate() {
    setEditingField(null);
    setDialogOpen(true);
  }

  function handleEdit(field: CustomField) {
    setEditingField(field);
    setDialogOpen(true);
  }

  function handleSave(data: any) {
    if (editingField) {
      updateField.mutate({ tenantId, id: editingField.id, ...data });
    } else {
      createField.mutate({ tenantId, entity: activeEntity as any, ...data });
    }
  }

  function handleMoveUp(idx: number) {
    if (idx === 0) return;
    const ids = fields.map((f) => f.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    reorderFields.mutate({ tenantId, entity: activeEntity as any, orderedIds: ids });
  }

  function handleMoveDown(idx: number) {
    if (idx >= fields.length - 1) return;
    const ids = fields.map((f) => f.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    reorderFields.mutate({ tenantId, entity: activeEntity as any, orderedIds: ids });
  }

  function toggleVisibility(field: CustomField, key: "isVisibleOnForm" | "isVisibleOnProfile") {
    updateField.mutate({
      tenantId,
      id: field.id,
      [key]: !field[key],
    });
  }

  return (
    <AdminOnlyGuard pageTitle="Campos personalizados">
    <div className="container max-w-4xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings" style={{ pointerEvents: "auto" }}>
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Campos Personalizados</h1>
          <p className="text-sm text-muted-foreground">Configure campos extras para personalizar seu CRM</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" /> Novo Campo
        </Button>
      </div>

      {/* Entity tabs */}
      <div className="flex gap-2">
        {ENTITIES.map((e) => (
          <button
            key={e.value}
            onClick={() => setActiveEntity(e.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeEntity === e.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* Fields list */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Campos de {ENTITIES.find((e) => e.value === activeEntity)?.label}
            <Badge variant="outline" className="ml-2 text-xs">{fields.length} campos</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fieldsQ.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : fields.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum campo personalizado</p>
              <p className="text-xs text-muted-foreground mt-1">Crie campos para personalizar o cadastro</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-1" /> Criar Primeiro Campo
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field, idx) => {
                const Icon = getFieldIcon(field.fieldType);
                const typeInfo = FIELD_TYPES.find((t) => t.value === field.fieldType);
                return (
                  <div
                    key={field.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors group"
                  >
                    {/* Reorder */}
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx >= fields.length - 1}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Icon */}
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{field.label}</p>
                        {field.isRequired && (
                          <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">Obrigatório</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">{field.name}</code>
                        <span className="text-[10px] text-muted-foreground">{typeInfo?.label}</span>
                        {field.groupName && (
                          <span className="text-[10px] text-muted-foreground">• {field.groupName}</span>
                        )}
                      </div>
                    </div>

                    {/* Visibility toggles */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleVisibility(field, "isVisibleOnForm")}
                        className={`p-1.5 rounded-md transition-colors ${
                          field.isVisibleOnForm
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-muted/50 text-muted-foreground"
                        }`}
                        title={field.isVisibleOnForm ? "Visível no cadastro" : "Oculto no cadastro"}
                      >
                        {field.isVisibleOnForm ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => toggleVisibility(field, "isVisibleOnProfile")}
                        className={`p-1.5 rounded-md transition-colors ${
                          field.isVisibleOnProfile
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-muted/50 text-muted-foreground"
                        }`}
                        title={field.isVisibleOnProfile ? "Visível no perfil" : "Oculto no perfil"}
                      >
                        {field.isVisibleOnProfile ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(field)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(field.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5">
          <div className="p-1 rounded bg-emerald-500/15"><Eye className="h-3 w-3 text-emerald-400" /></div>
          Visível no cadastro
        </span>
        <span className="flex items-center gap-1.5">
          <div className="p-1 rounded bg-blue-500/15"><Eye className="h-3 w-3 text-blue-400" /></div>
          Visível no perfil
        </span>
        <span className="flex items-center gap-1.5">
          <div className="p-1 rounded bg-muted/50"><EyeOff className="h-3 w-3 text-muted-foreground" /></div>
          Oculto
        </span>
      </div>

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <FieldFormDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditingField(null); }}
          onSave={handleSave}
          field={editingField}
          isPending={createField.isPending || updateField.isPending}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Campo</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este campo? Todos os valores salvos para este campo serão perdidos. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteField.mutate({ tenantId, id: deleteConfirm })}
              disabled={deleteField.isPending}
            >
              {deleteField.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AdminOnlyGuard>
  );
}
