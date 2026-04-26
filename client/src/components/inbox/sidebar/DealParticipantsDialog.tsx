/**
 * DealParticipantsDialog — Manage deal participants with roles and country flags
 */
import { useState, useMemo } from "react";
import { Users, X, Search, Loader2, Trash2, UserPlus, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import PhoneDisplay from "@/components/ui/PhoneDisplay";

const roleLabels: Record<string, string> = {
  decision_maker: "Decisor",
  traveler: "Viajante",
  payer: "Pagador",
  companion: "Acompanhante",
  other: "Outro",
};
const roleKeys = ["decision_maker", "traveler", "payer", "companion", "other"] as const;

interface DealParticipantsDialogProps {
  open: boolean;
  onClose: () => void;
  dealId: number;
}

export default function DealParticipantsDialog({ open, onClose, dealId }: DealParticipantsDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("traveler");
  const [showSearch, setShowSearch] = useState(false);

  const participantsQ = trpc.crm.deals.participants.list.useQuery({ dealId }, { enabled: !!dealId && open });
  const participants = (participantsQ.data || []) as any[];

  const contactsQ = trpc.crm.contacts.list.useQuery(
    { limit: 50, search: search || undefined },
    { enabled: open && showSearch && search.length > 0 }
  );
  const contacts = useMemo(() => {
    const items = (contactsQ.data as any)?.items || contactsQ.data || [];
    const existingIds = new Set(participants.map((p: any) => p.contactId));
    return (items as any[]).filter((c: any) => !existingIds.has(c.id));
  }, [contactsQ.data, participants]);

  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.crm.deals.participants.list.invalidate({ dealId });
  };

  const addMut = trpc.crm.deals.participants.add.useMutation({
    onSuccess: () => { invalidate(); setSearch(""); setSelectedContactId(null); setShowSearch(false); toast.success("Participante adicionado"); },
    onError: (err: any) => toast.error(err.message || "Erro"),
  });
  const removeMut = trpc.crm.deals.participants.remove.useMutation({
    onSuccess: () => { invalidate(); toast.success("Participante removido"); },
    onError: (err: any) => toast.error(err.message || "Erro"),
  });

  const handleAdd = () => {
    if (!selectedContactId) return;
    const contact = contacts.find((c: any) => c.id === selectedContactId);
    (addMut.mutate as any)({ dealId, contactId: selectedContactId, name: contact?.name || "Participante", relationship: selectedRole as any });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-border/50" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <Users className="w-[18px] h-[18px] text-white" />
            </div>
            <h3 className="text-[16px] font-semibold text-foreground">Participantes</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-4">
          {/* Add participant */}
          {!showSearch ? (
            <button
              onClick={() => setShowSearch(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20 transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Adicionar Participante
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-accent/30 border border-border/50 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSelectedContactId(null); }}
                  placeholder="Buscar contato..."
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:border-primary"
                />
              </div>
              {contacts.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-lg border border-border">
                  {contacts.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedContactId(c.id); setSearch(c.name); }}
                      className={`w-full px-3 py-2 text-left hover:bg-muted/60 text-sm flex items-center gap-2 ${
                        selectedContactId === c.id ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        {c.phone && <PhoneDisplay phone={c.phone} size="sm" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
                  className="flex-1 px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:border-primary"
                >
                  {roleKeys.map(k => <option key={k} value={k}>{roleLabels[k]}</option>)}
                </select>
                <button
                  onClick={handleAdd}
                  disabled={!selectedContactId || addMut.isPending}
                  className="px-4 py-2 text-sm text-white bg-primary rounded-xl disabled:opacity-50 flex items-center gap-1"
                >
                  {addMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Adicionar
                </button>
              </div>
              <button onClick={() => { setShowSearch(false); setSearch(""); }} className="text-[11px] text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
            </div>
          )}

          {/* Participant list */}
          {participants.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-[12px] text-muted-foreground">Nenhum participante</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {participants.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-primary">
                      {(p.contactName || "?").substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{p.contactName || `#${p.contactId}`}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent border border-border font-medium text-muted-foreground">
                        {roleLabels[p.role] || p.role}
                      </span>
                      {p.contactPhone && <PhoneDisplay phone={p.contactPhone} size="sm" />}
                    </div>
                  </div>
                  <button
                    onClick={() => removeMut.mutate({ id: p.id, dealId })}
                    disabled={removeMut.isPending}
                    className="p-1 hover:bg-destructive/10 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors">Fechar</button>
        </div>
      </div>
    </div>
  );
}
