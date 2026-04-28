import { useState, useEffect, useMemo } from "react"
import { trpc } from "@/lib/trpc"
import { UserPlus, UserCheck, X, Loader2, AlertTriangle, Phone, Mail } from "lucide-react"
import { toast } from "sonner"
import PhoneInput from "react-phone-number-input"
import "react-phone-number-input/style.css"
import CustomFieldRenderer, { customFieldValuesToArray } from "@/components/CustomFieldRenderer"
import type { CustomFieldDef } from "@/components/CustomFieldRenderer"

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneValue, setPhoneValue] = useState("");
  const [docId, setDocId] = useState("");
  const [creating, setCreating] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});
  const [debouncedPhone, setDebouncedPhone] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [forceCreate, setForceCreate] = useState(false);

  const contactCustomFields = trpc.customFields.list.useQuery(
    { entity: "contact" as const },
    { enabled: open }
  );
  const formFields = useMemo(() => {
    return ((contactCustomFields.data || []) as CustomFieldDef[]).filter(f => f.isVisibleOnForm);
  }, [contactCustomFields.data]);

  // Real-time uniqueness check (debounced)
  const uniquenessQ = trpc.crm.contacts.checkUniqueness.useQuery(
    { phone: debouncedPhone || undefined, email: debouncedEmail || undefined },
    { enabled: open && (debouncedPhone.length >= 8 || debouncedEmail.length >= 5), staleTime: 10_000 }
  );

  useEffect(() => {
    if (open) {
      setName(pushName || "");
      setEmail("");
      setDocId("");
      const raw = phone.replace(/\D/g, "");
      const formattedPhone = raw ? (raw.startsWith("+") ? raw : `+${raw.startsWith("55") ? raw : `55${raw}`}`) : "";
      setPhoneValue(formattedPhone);
      setCustomFieldValues({});
      setDebouncedPhone(formattedPhone); setDebouncedEmail("");
      setForceCreate(false);
    }
  }, [open, pushName, phone]);

  // Debounce phone for uniqueness check
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPhone(phoneValue), 500);
    return () => clearTimeout(t);
  }, [phoneValue]);

  // Debounce email for uniqueness check
  useEffect(() => {
    const t = setTimeout(() => setDebouncedEmail(email.trim()), 500);
    return () => clearTimeout(t);
  }, [email]);

  const utils = trpc.useUtils();
  const createContact = trpc.crm.contacts.create.useMutation();
  const setFieldValues = trpc.contactProfile.setCustomFieldValues.useMutation();
  const linkConversations = trpc.crm.contacts.linkConversations.useMutation();

  // Matched contacts from uniqueness check
  const matchedContacts = useMemo(() => {
    if (!uniquenessQ.data?.warnings) return [];
    const seen = new Set<number>();
    return uniquenessQ.data.warnings.flatMap(w => w.existingContacts).filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [uniquenessQ.data]);

  const hasEmailMatch = uniquenessQ.data?.warnings?.some(w => w.type === "email_exists") ?? false;
  const emailMatchBlock = hasEmailMatch && debouncedEmail.length > 0;
  const phoneMatchRequiresEmail = (uniquenessQ.data as any)?.requiresEmail === true;
  const hasPhoneMatch = matchedContacts.length > 0 && !hasEmailMatch;

  const handleAssociate = async (contactId: number, contactName: string) => {
    try {
      if (phoneValue) {
        await linkConversations.mutateAsync({ contactId, phone: phoneValue });
      }
      utils.crm.contacts.list.invalidate();
      utils.crm.contacts.get.invalidate();
      toast.success(`Conversa associada a "${contactName}"`);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao associar passageiro");
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const result = await createContact.mutateAsync({
        name: name.trim(),
        phone: phoneValue || undefined,
        email: email.trim() || undefined,
        docId: docId ? docId.replace(/\D/g, "") : undefined,
      });

      // Save custom field values
      const cfEntries = customFieldValuesToArray(customFieldValues).filter(v => v.value);
      if (cfEntries.length > 0 && (result as any)?.id) {
        await setFieldValues.mutateAsync({
          entityType: "contact",
          entityId: (result as any).id,
          values: cfEntries,
        });
      }

      utils.crm.contacts.list.invalidate();
      utils.crm.contacts.get.invalidate();
      toast.success(`Passageiro "${name.trim()}" criado com sucesso`);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar passageiro");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  const inputCls = "w-full px-3 py-2 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors";
  const labelCls = "text-[12px] text-muted-foreground mb-1 block font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-border/50 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <UserPlus className="w-[18px] h-[18px] text-white" />
            </div>
            <h3 className="text-[16px] font-semibold text-foreground">Novo Passageiro</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-5">
          {/* Duplicate match banner */}
          {matchedContacts.length > 0 && (
            <section className="rounded-xl border border-amber-300/50 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p className="text-[13px] font-semibold">
                  {hasEmailMatch ? "Email já cadastrado" : "Telefone já cadastrado"}
                </p>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {hasEmailMatch
                  ? "Este email já pertence a um passageiro existente. Associe a conversa ao passageiro abaixo."
                  : "Este passageiro já existe no sistema. Associe a conversa ao contato abaixo."}
              </p>
              {matchedContacts.map(contact => (
                <div key={contact.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[14px] font-bold text-primary">{contact.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{contact.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {contact.phone && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Phone className="w-3 h-3" />{contact.phone}
                        </span>
                      )}
                      {contact.email && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Mail className="w-3 h-3" />{contact.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAssociate(contact.id, contact.name)}
                    disabled={linkConversations.isPending}
                    className="shrink-0 px-3 py-2 text-[12px] font-medium text-white bg-primary hover:opacity-90 rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {linkConversations.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                    Associar
                  </button>
                </div>
              ))}
              {hasPhoneMatch && !forceCreate && (
                <button
                  onClick={() => setForceCreate(true)}
                  className="text-[11px] text-muted-foreground hover:underline mt-1"
                >
                  Não é o mesmo passageiro? Criar novo mesmo assim
                </button>
              )}
            </section>
          )}

          {/* Basic */}
          <section>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Nome completo *</label>
                <input value={name} onChange={e => setName(e.target.value)} autoFocus className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Telefone</label>
                <PhoneInput
                  international
                  defaultCountry="BR"
                  value={phoneValue}
                  onChange={(val) => setPhoneValue(val || "")}
                  className={`${inputCls} [&>input]:border-0 [&>input]:bg-transparent [&>input]:outline-none [&>input]:h-full [&>input]:text-sm`}
                />
              </div>
              <div>
                <label className={labelCls}>Email {phoneMatchRequiresEmail && <span className="text-amber-500">*</span>}</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" className={`${inputCls} ${emailMatchBlock ? "border-red-400 focus:border-red-400 focus:ring-red-400/30" : ""}`} />
                {emailMatchBlock && (
                  <p className="text-[11px] text-red-500 mt-1">Este email já pertence a outro passageiro</p>
                )}
                {phoneMatchRequiresEmail && !email.trim() && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Informe um email para diferenciar do passageiro existente</p>
                )}
              </div>
              <div>
                <label className={labelCls}>CPF / CNPJ <span className="text-muted-foreground/70">(usado em cobranças Asaas)</span></label>
                <input
                  value={docId}
                  onChange={e => setDocId(e.target.value)}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  inputMode="numeric"
                  className={`${inputCls} font-mono`}
                />
              </div>
            </div>
          </section>

          {/* Custom Fields */}
          {formFields.length > 0 && (
            <section className="border-t border-border pt-3">
              <p className="text-[13px] text-muted-foreground mb-2 font-medium">Campos Personalizados</p>
              <CustomFieldRenderer
                fields={formFields}
                values={customFieldValues}
                onChange={(fieldId, value) => setCustomFieldValues(prev => ({ ...prev, [fieldId]: value }))}
                mode="form"
                compact
              />
            </section>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || emailMatchBlock || (hasPhoneMatch && !forceCreate) || (phoneMatchRequiresEmail && !forceCreate && !email.trim())}
            className="px-4 py-2 text-sm text-white bg-primary hover:opacity-90 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar Passageiro
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateContactDialog;
