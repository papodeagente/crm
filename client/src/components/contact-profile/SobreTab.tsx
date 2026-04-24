import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Mail, Phone, FileText, Calendar, Tag, User, Edit2, Save, X,
  Plus, CheckCircle2, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

interface SobreTabProps {
  contact: any;
  contactId: number;
  metrics: { totalDeals: number; wonDeals: number; totalSpentCents: number; daysSinceLastPurchase: number | null };
}

function formatCurrency(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
}

export default function SobreTab({ contact, contactId, metrics }: SobreTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: "", email: "", phone: "", notes: "", birthDate: "", weddingDate: "" });
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [customFieldEdits, setCustomFieldEdits] = useState<Record<number, string>>({});

  const utils = trpc.useUtils();
  const customFieldsQ = trpc.customFields.list.useQuery({ entity: "contact" });
  const customValuesQ = trpc.contactProfile.getCustomFieldValues.useQuery(
    { entityType: "contact", entityId: contactId },
    { enabled: !!contactId }
  );

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

  const customFields = (customFieldsQ.data || []) as any[];
  const customValues = (customValuesQ.data || []) as any[];
  const valueMap = useMemo(() => {
    const map: Record<number, string> = {};
    customValues.forEach((v: any) => { map[v.fieldId] = v.value || ""; });
    return map;
  }, [customValues]);
  const visibleFields = useMemo(() => customFields.filter((f: any) => f.isVisibleOnProfile), [customFields]);

  function startEdit() {
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
    updateContact.mutate({
      id: contactId,
      name: editData.name,
      email: editData.email || undefined,
      phone: editData.phone || undefined,
      birthDate: editData.birthDate || null,
      weddingDate: editData.weddingDate || null,
    });
  }

  function startEditCustom() {
    const edits: Record<number, string> = {};
    customFields.forEach((f: any) => {
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

  const conversionRate = metrics.totalDeals > 0 ? Math.round((metrics.wonDeals / metrics.totalDeals) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Negociações", value: String(metrics.totalDeals), sub: `${metrics.wonDeals} fechada(s)`, color: "text-blue-400" },
          { label: "Conversão", value: `${conversionRate}%`, sub: `${metrics.wonDeals}/${metrics.totalDeals}`, color: "text-emerald-400" },
          { label: "Total Comprado", value: formatCurrency(metrics.totalSpentCents), sub: "Negociações ganhas", color: "text-purple-400" },
          { label: "Última Compra", value: metrics.daysSinceLastPurchase !== null ? `${metrics.daysSinceLastPurchase}d` : "—", sub: metrics.daysSinceLastPurchase !== null ? "atrás" : "Nenhuma", color: "text-amber-400" },
        ].map((m) => (
          <Card key={m.label} className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contact info */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-[#2E7D5B]" /> Dados Pessoais
            </CardTitle>
            {!isEditing ? (
              <Button size="sm" variant="ghost" onClick={startEdit} className="h-7 text-xs">
                <Edit2 className="h-3 w-3 mr-1" /> Editar
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-7 text-xs">
                  <X className="h-3 w-3 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={updateContact.isPending} className="h-7 text-xs bg-[#2E7D5B] hover:bg-[#256B4D] text-white">
                  <Save className="h-3 w-3 mr-1" /> Salvar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              {isEditing ? (
                <Input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} placeholder="email@exemplo.com" className="bg-background/50" />
              ) : (
                <span className="text-sm">{contact.email || <span className="text-muted-foreground italic">Sem email</span>}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              {isEditing ? (
                <Input type="tel" value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} placeholder="(11) 99999-9999" className="bg-background/50" />
              ) : (
                <span className="text-sm">{contact.phone || <span className="text-muted-foreground italic">Sem telefone</span>}</span>
              )}
            </div>
          </div>
          {contact.docId && (
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">{contact.docId}</span>
            </div>
          )}

          {isEditing && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Aniversário</label>
                  <DatePicker value={editData.birthDate} onChange={(v) => setEditData({ ...editData, birthDate: v })} placeholder="Selecionar data" className="bg-background/50 h-9" monthDay />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Casamento</label>
                  <DatePicker value={editData.weddingDate} onChange={(v) => setEditData({ ...editData, weddingDate: v })} placeholder="Selecionar data" className="bg-background/50 h-9" monthDay />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
                <Textarea value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} placeholder="Notas sobre o contato..." className="bg-background/50 min-h-[80px]" />
              </div>
            </>
          )}

          {!isEditing && (contact.birthDate || contact.weddingDate) && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-xs">
                {contact.birthDate && (
                  <div>
                    <span className="text-muted-foreground">Aniversário</span>
                    <p className="text-foreground font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> {contact.birthDate}</p>
                  </div>
                )}
                {contact.weddingDate && (
                  <div>
                    <span className="text-muted-foreground">Casamento</span>
                    <p className="text-foreground font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> {contact.weddingDate}</p>
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
                <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
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
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Tag className="h-4 w-4 text-[#2E7D5B]" /> Campos Personalizados
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
                  <Button size="sm" onClick={saveCustomFields} disabled={setCustomValues.isPending} className="h-7 text-xs bg-[#2E7D5B] hover:bg-[#256B4D] text-white">
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
                <p className="text-sm text-muted-foreground">Nenhum campo personalizado</p>
                <Link href="/settings/custom-fields">
                  <Button variant="link" size="sm" className="mt-1 text-xs"><Plus className="h-3 w-3 mr-1" /> Configurar</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {(isEditingCustom ? customFields : visibleFields).map((field: any) => (
                  <div key={field.id}>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.label}</label>
                    {isEditingCustom ? (
                      field.fieldType === "select" ? (
                        <Select value={customFieldEdits[field.id] || "_none_"} onValueChange={(v) => setCustomFieldEdits({ ...customFieldEdits, [field.id]: v === "_none_" ? "" : v })}>
                          <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none_">Nenhum</SelectItem>
                            {(Array.isArray(field.optionsJson) ? field.optionsJson : []).map((opt: string) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : field.fieldType === "checkbox" ? (
                        <div className="flex items-center gap-2 pt-1">
                          <Checkbox checked={customFieldEdits[field.id] === "true"} onCheckedChange={(c) => setCustomFieldEdits({ ...customFieldEdits, [field.id]: c ? "true" : "false" })} />
                          <span className="text-sm">{field.label}</span>
                        </div>
                      ) : field.fieldType === "textarea" ? (
                        <Textarea value={customFieldEdits[field.id] || ""} onChange={(e) => setCustomFieldEdits({ ...customFieldEdits, [field.id]: e.target.value })} className="bg-background/50 min-h-[60px]" />
                      ) : (
                        <Input value={customFieldEdits[field.id] || ""} onChange={(e) => setCustomFieldEdits({ ...customFieldEdits, [field.id]: e.target.value })} className="bg-background/50" />
                      )
                    ) : (
                      <span className="text-sm">
                        {field.fieldType === "checkbox"
                          ? (valueMap[field.id] === "true" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-muted-foreground" />)
                          : (valueMap[field.id] || <span className="text-muted-foreground italic">Não preenchido</span>)
                        }
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
