/**
 * SidebarContactCard — CRM contact card with inline editing, phone flag, lifecycle dropdown
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { Mail, Phone, Check, X, Pencil, ChevronDown, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import PhoneDisplay from "@/components/ui/PhoneDisplay";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { WaAvatar } from "@/components/inbox/ConversationItem";

interface ContactData {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  lifecycleStage?: string | null;
}

const stageConfig: Record<string, { label: string; color: string; bg: string }> = {
  lead: { label: "Lead", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/15" },
  prospect: { label: "Prospect", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/15" },
  customer: { label: "Cliente", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15" },
  churned: { label: "Perdido", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/15" },
};
const stageKeys = ["lead", "prospect", "customer", "churned"] as const;

interface SidebarContactCardProps {
  contact: ContactData;
  onUpdated?: () => void;
  onOpenDetails?: () => void;
}

export default function SidebarContactCard({ contact, onUpdated, onOpenDetails }: SidebarContactCardProps) {
  const [editingField, setEditingField] = useState<"name" | "email" | "phone" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [phoneEditValue, setPhoneEditValue] = useState<string>("");
  const [showStageDropdown, setShowStageDropdown] = useState(false);
  const stageDropdownRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const updateMut = trpc.crm.contacts.update.useMutation({
    onSuccess: () => {
      utils.crm.contacts.get.invalidate({ id: contact.id });
      onUpdated?.();
      setEditingField(null);
      setShowStageDropdown(false);
      toast.success("Contato atualizado");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar"),
  });

  // Close stage dropdown on outside click
  useEffect(() => {
    if (!showStageDropdown) return;
    const handler = (e: MouseEvent) => {
      if (stageDropdownRef.current && !stageDropdownRef.current.contains(e.target as Node)) {
        setShowStageDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showStageDropdown]);

  const startEdit = useCallback((field: "name" | "email" | "phone") => {
    setEditingField(field);
    if (field === "phone") {
      const raw = contact.phone || "";
      setPhoneEditValue(raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`);
    } else {
      setEditValue(field === "name" ? (contact.name || "") : (contact.email || ""));
    }
  }, [contact]);

  const saveEdit = useCallback(() => {
    if (!editingField) return;
    const data: any = { id: contact.id };
    if (editingField === "phone") {
      data.phone = phoneEditValue;
    } else {
      data[editingField] = editValue.trim();
    }
    updateMut.mutate(data);
  }, [editingField, editValue, phoneEditValue, contact.id]);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue("");
    setPhoneEditValue("");
  }, []);

  const handleStageChange = (stage: string) => {
    updateMut.mutate({ id: contact.id, lifecycleStage: stage as any });
  };

  const stage = stageConfig[contact.lifecycleStage || ""] || null;

  return (
    <div className="px-4 pt-5 pb-3">
      {/* Avatar + Name row */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 inbox-avatar-ring rounded-full">
          <WaAvatar name={contact.name || "?"} size={48} pictureUrl={contact.avatarUrl} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name */}
          {editingField === "name" ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                className="flex-1 text-[15px] font-semibold bg-background/50 border border-border/50 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/30 min-w-0"
              />
              <button onClick={saveEdit} className="p-0.5 text-emerald-500 hover:text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={cancelEdit} className="p-0.5 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1 group">
              <p className="text-[15px] font-semibold text-foreground truncate">{contact.name}</p>
              <button onClick={() => startEdit("name")} className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-opacity">
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Lifecycle stage — clickable dropdown */}
          <div className="relative mt-1" ref={stageDropdownRef}>
            <button
              onClick={() => setShowStageDropdown(!showStageDropdown)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors hover:opacity-80 ${
                stage ? `${stage.bg} ${stage.color}` : "bg-muted text-muted-foreground"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {stage?.label || "Sem estágio"}
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {showStageDropdown && (
              <div className="absolute z-50 mt-1 left-0 bg-popover text-popover-foreground border border-border rounded-xl shadow-lg py-1 min-w-[140px]">
                {stageKeys.map((key) => {
                  const cfg = stageConfig[key];
                  const isActive = contact.lifecycleStage === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleStageChange(key)}
                      disabled={updateMut.isPending}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-muted/60 ${
                        isActive ? "bg-muted/40" : ""
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${cfg.bg.replace("/15", "")}`}
                        style={{ backgroundColor: isActive ? "currentColor" : undefined }}
                      />
                      <span className={cfg.color}>{cfg.label}</span>
                      {isActive && <Check className="w-3 h-3 ml-auto text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contact details */}
      <div className="mt-3 space-y-1.5">
        {/* Phone — with flag */}
        <div className="flex items-center gap-2 text-[12.5px] group">
          <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {editingField === "phone" ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <PhoneInput
                international
                defaultCountry="BR"
                value={phoneEditValue}
                onChange={(val) => setPhoneEditValue(val || "")}
                className="flex-1 text-[12.5px] bg-background/50 border border-border/50 rounded-lg px-2 py-0.5 focus-within:ring-1 focus-within:ring-primary/30 min-w-0 [&>input]:border-0 [&>input]:bg-transparent [&>input]:outline-none [&>input]:text-[12.5px] [&>input]:h-6"
              />
              <button onClick={saveEdit} className="p-0.5 text-emerald-500"><Check className="w-3 h-3" /></button>
              <button onClick={cancelEdit} className="p-0.5 text-muted-foreground"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <>
              {contact.phone ? (
                <PhoneDisplay phone={contact.phone} size="sm" />
              ) : (
                <span className="text-muted-foreground">Sem telefone</span>
              )}
              <button onClick={() => startEdit("phone")} className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-opacity">
                <Pencil className="w-3 h-3" />
              </button>
            </>
          )}
        </div>

        {/* Email */}
        <div className="flex items-center gap-2 text-[12.5px] group">
          <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {editingField === "email" ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                className="flex-1 text-[12.5px] bg-background/50 border border-border/50 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/30 min-w-0"
                placeholder="email@exemplo.com"
              />
              <button onClick={saveEdit} className="p-0.5 text-emerald-500"><Check className="w-3 h-3" /></button>
              <button onClick={cancelEdit} className="p-0.5 text-muted-foreground"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <>
              <span className="truncate text-muted-foreground">{contact.email || "Sem email"}</span>
              <button onClick={() => startEdit("email")} className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-opacity">
                <Pencil className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit details button (replaces "Ver perfil completo" link) */}
      <button
        onClick={onOpenDetails}
        className="flex items-center gap-1 mt-3 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <FileText className="w-3 h-3" />
        Editar detalhes do contato
      </button>
    </div>
  );
}
