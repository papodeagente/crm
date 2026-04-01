import { useState, useEffect, useMemo } from "react"
import { trpc } from "@/lib/trpc"
import { UserPlus, X, Phone, Loader2 } from "lucide-react"
import { toast } from "sonner"
import CustomFieldRenderer, { customFieldValuesToArray } from "@/components/CustomFieldRenderer"
import type { CustomFieldDef } from "@/components/CustomFieldRenderer"
import { formatPhoneNumber } from "./ConversationItem"

interface CreateContactDialogProps {
  open: boolean;
  onClose: () => void;
  phone: string;
  pushName: string;
  onCreated: () => void;
}

function CreateContactDialog({
  open, onClose, phone, pushName, onCreated,
}: CreateContactDialogProps) {
  const [name, setName] = useState(pushName || "");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});

  const formattedPhone = formatPhoneNumber(phone + "@s.whatsapp.net");

  // Load custom fields for contacts
  const contactCustomFields = trpc.customFields.list.useQuery(
    { entity: "contact" as const },
    { enabled: open }
  );
  const formFields = useMemo(() => {
    return ((contactCustomFields.data || []) as CustomFieldDef[]).filter(f => f.isVisibleOnForm);
  }, [contactCustomFields.data]);

  useEffect(() => {
    if (open) {
      setName(pushName || "");
      setEmail("");
      setNotes("");
      setCustomFieldValues({});
    }
  }, [open, pushName]);

  const createContact = trpc.crm.contacts.create.useMutation();
  const setFieldValues = trpc.contactProfile.setCustomFieldValues.useMutation();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const cleaned = phone.replace(/\D/g, "");
      const formatted = cleaned.startsWith("55") ? `+${cleaned}` : `+55${cleaned}`;
      const result = await createContact.mutateAsync({ name: name.trim(),
        phone: formatted,
        email: email.trim() || undefined,
      });
      // Save custom field values
      const cfEntries = customFieldValuesToArray(customFieldValues).filter(v => v.value);
      if (cfEntries.length > 0 && (result as any)?.id) {
        await setFieldValues.mutateAsync({ entityType: "contact",
          entityId: (result as any).id,
          values: cfEntries,
        });
      }
      toast.success(`Contato "${name.trim()}" criado com sucesso`);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar contato");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-border/50" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <UserPlus className="w-[18px] h-[18px] text-white" />
            </div>
            <h3 className="text-[16px] font-semibold text-foreground">Novo Contato</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
            <Phone className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Telefone (WhatsApp)</p>
              <p className="text-sm font-medium text-foreground">{formattedPhone}</p>
            </div>
          </div>
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Nome *</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nome do contato"
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Observações</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre o contato..."
              rows={2}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none transition-colors"
            />
          </div>
          {/* Custom Fields */}
          {formFields.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-[13px] text-muted-foreground mb-2 font-medium">Campos Personalizados</p>
              <CustomFieldRenderer
                fields={formFields}
                values={customFieldValues}
                onChange={(fieldId, value) => setCustomFieldValues(prev => ({ ...prev, [fieldId]: value }))}
                mode="form"
                compact
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="px-4 py-2 text-sm text-white bg-primary hover:opacity-90 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar Contato
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateContactDialog;
