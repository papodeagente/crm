/**
 * SidebarCustomFields — Custom field values (view/edit) for a contact
 */
import { useState, useMemo } from "react";
import { Pencil, Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface FieldDef {
  id: number;
  name: string;
  label: string;
  fieldType: string;
  optionsJson: any;
  isVisibleOnProfile: boolean;
  groupName: string | null;
}
interface FieldValue {
  fieldId: number;
  value: string | null;
}

const inputCls = "w-full text-[12.5px] bg-background/50 border border-border/50 rounded-lg px-2 py-1 mt-0.5 focus:outline-none focus:ring-1 focus:ring-primary/30";

function EditField({ f, val, onChange }: { f: FieldDef; val: string; onChange: (v: string) => void }) {
  const options: string[] = Array.isArray(f.optionsJson) ? f.optionsJson : [];

  if (f.fieldType === "select") {
    return (
      <select value={val} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">—</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }

  if (f.fieldType === "multiselect") {
    const selected = val ? val.split("|||").filter(Boolean) : [];
    const toggle = (opt: string) => {
      const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
      onChange(next.join("|||"));
    };
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${active ? "bg-primary/15 border-primary/40 text-primary font-medium" : "bg-muted/30 border-border/40 text-muted-foreground hover:border-border"}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (f.fieldType === "textarea") {
    return <textarea value={val} onChange={(e) => onChange(e.target.value)} rows={2} className={`${inputCls} resize-none`} />;
  }

  if (f.fieldType === "checkbox") {
    return (
      <label className="flex items-center gap-2 mt-0.5">
        <input type="checkbox" checked={val === "true"} onChange={(e) => onChange(String(e.target.checked))} className="rounded border-border text-primary focus:ring-primary/30 w-3.5 h-3.5" />
        <span className="text-[12.5px] text-foreground">{val === "true" ? "Sim" : "Não"}</span>
      </label>
    );
  }

  return (
    <input
      value={val}
      onChange={(e) => onChange(e.target.value)}
      type={f.fieldType === "number" || f.fieldType === "currency" ? "number" : f.fieldType === "date" ? "date" : "text"}
      className={inputCls}
    />
  );
}

function ViewField({ f, val }: { f: FieldDef; val: string }) {
  if (!val) return <p className="text-[12.5px] text-muted-foreground italic mt-0.5">—</p>;

  if (f.fieldType === "multiselect") {
    const items = val.split("|||").filter(Boolean);
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {items.map((item) => (
          <span key={item} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{item}</span>
        ))}
      </div>
    );
  }

  if (f.fieldType === "select") {
    return <p className="text-[12.5px] text-foreground mt-0.5">{val}</p>;
  }

  if (f.fieldType === "checkbox") {
    return <p className="text-[12.5px] text-foreground mt-0.5">{val === "true" ? "Sim" : "Não"}</p>;
  }

  if (f.fieldType === "date" && val) {
    try {
      const d = new Date(val);
      return <p className="text-[12.5px] text-foreground mt-0.5">{d.toLocaleDateString("pt-BR")}</p>;
    } catch { /* fall through */ }
  }

  if (f.fieldType === "currency" && val) {
    const num = Number(val);
    if (!isNaN(num)) {
      return <p className="text-[12.5px] text-foreground mt-0.5">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num)}</p>;
    }
  }

  return <p className="text-[12.5px] text-foreground mt-0.5 whitespace-pre-wrap">{val}</p>;
}

export default function SidebarCustomFields({ contactId }: { contactId: number }) {
  const [isEditing, setIsEditing] = useState(false);
  const [edits, setEdits] = useState<Record<number, string>>({});

  const fieldsQ = trpc.customFields.list.useQuery({ entity: "contact" }, { staleTime: 300_000 });
  const valuesQ = trpc.contactProfile.getCustomFieldValues.useQuery(
    { entityType: "contact", entityId: contactId },
    { enabled: !!contactId, staleTime: 60_000 }
  );

  const fields = (fieldsQ.data || []) as FieldDef[];
  const values = (valuesQ.data || []) as FieldValue[];
  const profileFields = fields.filter(f => f.isVisibleOnProfile);

  const valueMap = useMemo(() => {
    const m: Record<number, string> = {};
    values.forEach(v => { m[v.fieldId] = v.value || ""; });
    return m;
  }, [values]);

  const utils = trpc.useUtils();
  const saveMut = trpc.contactProfile.setCustomFieldValues.useMutation({
    onSuccess: () => {
      utils.contactProfile.getCustomFieldValues.invalidate({ entityType: "contact", entityId: contactId });
      setIsEditing(false);
      setEdits({});
      toast.success("Campos salvos");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const startEdit = () => {
    const initial: Record<number, string> = {};
    profileFields.forEach(f => { initial[f.id] = valueMap[f.id] || ""; });
    setEdits(initial);
    setIsEditing(true);
  };

  const handleSave = () => {
    const arr = Object.entries(edits).map(([fieldId, value]) => ({
      fieldId: Number(fieldId),
      value,
    }));
    saveMut.mutate({ entityType: "contact", entityId: contactId, values: arr });
  };

  if (profileFields.length === 0) return null;

  return (
    <div className="px-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="sidebar-section-trigger !p-0">Campos Personalizados</span>
        {!isEditing ? (
          <button onClick={startEdit} className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="flex gap-1">
            <button onClick={handleSave} disabled={saveMut.isPending} className="p-1 rounded-md text-emerald-500 hover:bg-emerald-500/10">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setIsEditing(false); setEdits({}); }} className="p-1 rounded-md text-muted-foreground hover:bg-muted">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="space-y-2">
        {profileFields.map(f => {
          const val = isEditing ? (edits[f.id] ?? "") : (valueMap[f.id] || "");
          return (
            <div key={f.id}>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{f.label}</label>
              {isEditing ? (
                <EditField f={f} val={val} onChange={(v) => setEdits(prev => ({ ...prev, [f.id]: v }))} />
              ) : (
                <ViewField f={f} val={val} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
