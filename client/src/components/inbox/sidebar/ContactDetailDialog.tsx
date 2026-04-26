/**
 * ContactDetailDialog — Edit all extra contact fields (personal, address, professional)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { User, X, Loader2, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import CustomFieldRenderer, { customFieldValuesToArray } from "@/components/CustomFieldRenderer";
import type { CustomFieldDef } from "@/components/CustomFieldRenderer";
import AccountCombobox from "@/components/AccountCombobox";

interface ContactDetailDialogProps {
  open: boolean;
  onClose: () => void;
  contactId: number;
}

const maritalOptions = [
  { value: "", label: "—" },
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
  { value: "uniao_estavel", label: "União Estável" },
];

const monthOptions = [
  { value: "", label: "—" },
  { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" }, { value: "04", label: "Abril" },
  { value: "05", label: "Maio" }, { value: "06", label: "Junho" },
  { value: "07", label: "Julho" }, { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" }, { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
];

export default function ContactDetailDialog({ open, onClose, contactId }: ContactDetailDialogProps) {
  const contactQ = trpc.crm.contacts.get.useQuery({ id: contactId }, { enabled: !!contactId && open });
  const contact = contactQ.data as any;

  const [form, setForm] = useState<Record<string, any>>({});
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (contact) {
      setForm({
        name: contact.name || "",
        email: contact.email || "",
        cpf: contact.cpf || "",
        birthDate: contact.birthDate?.substring(0, 10) || "",
        weddingDate: contact.weddingDate?.substring(0, 10) || "",
        maritalStatus: contact.maritalStatus || "",
        spouseName: contact.spouseName || "",
        childrenNames: contact.childrenNames || [],
        vacationMonth: contact.vacationMonth || "",
        jobTitle: contact.jobTitle || "",
        website: contact.website || "",
        addressZipCode: contact.addressZipCode || "",
        addressStreet: contact.addressStreet || "",
        addressNumber: contact.addressNumber || "",
        addressComplement: contact.addressComplement || "",
        addressNeighborhood: contact.addressNeighborhood || "",
        city: contact.city || "",
        state: contact.state || "",
        country: contact.country || "",
        accountId: contact.accountId || null,
      });
      const raw = contact.phone || contact.phoneE164 || "";
      setPhone(raw.startsWith("+") ? raw : raw ? `+${raw.replace(/\D/g, "")}` : "");
    }
  }, [contact]);

  // CEP auto-fill via ViaCEP
  const handleCepBlur = useCallback(async () => {
    const cep = (form.addressZipCode || "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(prev => ({
          ...prev,
          addressStreet: data.logradouro || prev.addressStreet,
          addressNeighborhood: data.bairro || prev.addressNeighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch {}
  }, [form.addressZipCode]);

  const formatCep = (val: string) => {
    const digits = val.replace(/\D/g, "").substring(0, 8);
    return digits.length > 5 ? `${digits.substring(0, 5)}-${digits.substring(5)}` : digits;
  };

  // Custom fields
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});
  const contactCustomFields = trpc.customFields.list.useQuery(
    { entity: "contact" as const },
    { enabled: open }
  );
  const formFields = useMemo(() => {
    return ((contactCustomFields.data || []) as CustomFieldDef[]).filter(f => f.isVisibleOnForm);
  }, [contactCustomFields.data]);

  const customValuesQ = trpc.contactProfile.getCustomFieldValues.useQuery(
    { entityType: "contact", entityId: contactId },
    { enabled: !!contactId && open }
  );

  useEffect(() => {
    if (customValuesQ.data) {
      const vals: Record<number, string> = {};
      (customValuesQ.data as any[]).forEach((v: any) => { vals[v.fieldId] = v.value || ""; });
      setCustomFieldValues(vals);
    }
  }, [customValuesQ.data]);

  const utils = trpc.useUtils();
  const updateMut = trpc.crm.contacts.update.useMutation();
  const setFieldValuesMut = trpc.contactProfile.setCustomFieldValues.useMutation();

  const handleSave = async () => {
    const childrenArr = (form.childrenNames || []).filter((n: string) => n.trim());

    try {
      await (updateMut.mutateAsync as any)({
        id: contactId,
        name: form.name || undefined,
        email: form.email || undefined,
        phone: phone || undefined,
        cpf: form.cpf || undefined,
        birthDate: form.birthDate || null,
        weddingDate: form.weddingDate || null,
        maritalStatus: form.maritalStatus || undefined,
        spouseName: form.spouseName || undefined,
        childrenNames: childrenArr.length > 0 ? childrenArr : undefined,
        vacationMonth: form.vacationMonth || undefined,
        jobTitle: form.jobTitle || undefined,
        website: form.website || undefined,
        addressZipCode: form.addressZipCode || undefined,
        addressStreet: form.addressStreet || undefined,
        addressNumber: form.addressNumber || undefined,
        addressComplement: form.addressComplement || undefined,
        addressNeighborhood: form.addressNeighborhood || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        country: form.country || undefined,
        accountId: form.accountId || null,
      });

      // Save custom field values
      const cfEntries = customFieldValuesToArray(customFieldValues).filter(v => v.value);
      if (cfEntries.length > 0) {
        await setFieldValuesMut.mutateAsync({
          entityType: "contact",
          entityId: contactId,
          values: cfEntries,
        });
      }

      utils.crm.contacts.get.invalidate({ id: contactId });
      utils.contactProfile.getCustomFieldValues.invalidate();
      toast.success("Contato atualizado");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    }
  };

  const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  if (!open) return null;

  const inputCls = "w-full px-3 py-2 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors";
  const labelCls = "text-[12px] text-muted-foreground mb-1 block font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-border/50" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <User className="w-[18px] h-[18px] text-white" />
            </div>
            <h3 className="text-[16px] font-semibold text-foreground">Detalhes do Contato</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
          {!contact ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Basic */}
              <section>
                <h4 className="text-[13px] font-semibold text-foreground mb-3">Informações Básicas</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Nome</label>
                    <input value={form.name} onChange={e => set("name", e.target.value)} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Telefone</label>
                    <PhoneInput
                      international
                      defaultCountry="BR"
                      value={phone}
                      onChange={(val) => setPhone(val || "")}
                      className={`${inputCls} [&>input]:border-0 [&>input]:bg-transparent [&>input]:outline-none [&>input]:h-full [&>input]:text-sm`}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Email</label>
                    <input type="email" value={form.email} onChange={e => set("email", e.target.value)} className={inputCls} />
                  </div>
                </div>
              </section>

              {/* Personal */}
              <section>
                <h4 className="text-[13px] font-semibold text-foreground mb-3">Dados Pessoais</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>CPF</label>
                    <input value={form.cpf} onChange={e => set("cpf", e.target.value)} placeholder="000.000.000-00" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Data de Nascimento</label>
                    <input type="date" value={form.birthDate} onChange={e => set("birthDate", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Data de Casamento</label>
                    <input type="date" value={form.weddingDate} onChange={e => set("weddingDate", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Estado Civil</label>
                    <select value={form.maritalStatus} onChange={e => set("maritalStatus", e.target.value)} className={inputCls}>
                      {maritalOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Mês de Férias</label>
                    <select value={form.vacationMonth} onChange={e => set("vacationMonth", e.target.value)} className={inputCls}>
                      {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Cônjuge</label>
                    <input value={form.spouseName} onChange={e => set("spouseName", e.target.value)} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Filhos</label>
                    <div className="space-y-2">
                      {(form.childrenNames || []).map((child: string, i: number) => (
                        <div key={i} className="flex gap-2">
                          <input
                            value={child}
                            onChange={e => { const arr = [...(form.childrenNames || [])]; arr[i] = e.target.value; set("childrenNames", arr); }}
                            placeholder="Nome do filho(a)"
                            className={inputCls}
                          />
                          <button type="button" onClick={() => set("childrenNames", (form.childrenNames || []).filter((_: any, j: number) => j !== i))} className="p-2 hover:bg-muted rounded-lg transition-colors shrink-0">
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => set("childrenNames", [...(form.childrenNames || []), ""])} className="flex items-center gap-1 text-[12px] text-primary hover:text-primary/80 font-medium transition-colors">
                        <Plus className="w-3 h-3" /> Adicionar filho
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Professional */}
              <section>
                <h4 className="text-[13px] font-semibold text-foreground mb-3">Profissional</h4>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Empresa</label>
                    <AccountCombobox value={form.accountId} onChange={(v) => set("accountId", v)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className={labelCls}>Cargo</label>
                    <input value={form.jobTitle} onChange={e => set("jobTitle", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Website</label>
                    <input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://" className={inputCls} />
                  </div>
                </div>
              </section>

              {/* Address */}
              <section>
                <h4 className="text-[13px] font-semibold text-foreground mb-3">Endereço</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>CEP</label>
                    <input value={form.addressZipCode} onChange={e => set("addressZipCode", formatCep(e.target.value))} onBlur={handleCepBlur} placeholder="00000-000" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>País</label>
                    <input value={form.country} onChange={e => set("country", e.target.value)} placeholder="Brasil" className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Rua</label>
                    <input value={form.addressStreet} onChange={e => set("addressStreet", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Número</label>
                    <input value={form.addressNumber} onChange={e => set("addressNumber", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Complemento</label>
                    <input value={form.addressComplement} onChange={e => set("addressComplement", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Bairro</label>
                    <input value={form.addressNeighborhood} onChange={e => set("addressNeighborhood", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Cidade</label>
                    <input value={form.city} onChange={e => set("city", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Estado</label>
                    <input value={form.state} onChange={e => set("state", e.target.value)} placeholder="RN" className={inputCls} />
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={updateMut.isPending || setFieldValuesMut.isPending}
            className="px-4 py-2 text-sm text-white bg-primary hover:opacity-90 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {updateMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
