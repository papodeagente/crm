/**
 * ContactModal — Select a saved contact to share via WhatsApp
 */

import { useState, useMemo } from "react";
import { Contact, Search, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ContactModalProps {
  onSend: (contacts: Array<{ fullName: string; phoneNumber: string }>) => void;
  onClose: () => void;
}

export default function ContactModal({ onSend, onClose }: ContactModalProps) {
  const [search, setSearch] = useState("");
  const contactsQ = trpc.crm.contacts.list.useQuery({ limit: 200 }, { staleTime: 30_000 });

  const filtered = useMemo(() => {
    const list = (contactsQ.data as any)?.items || [];
    if (!search.trim()) return list.slice(0, 50);
    const q = search.toLowerCase();
    return list.filter((c: any) => {
      const name = (c.name || "").toLowerCase();
      const phone = (c.phone || c.phoneNumber || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q);
    }).slice(0, 50);
  }, [contactsQ.data, search]);

  const handleSelect = (contact: any) => {
    const name = contact.name || "Sem nome";
    const phone = contact.phone || contact.phoneNumber || "";
    if (!phone) {
      toast.error("Este contato não possui telefone cadastrado.");
      return;
    }
    onSend([{ fullName: name, phoneNumber: phone }]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl border border-border w-[420px] max-w-[90vw] flex flex-col max-h-[70vh]" onClick={e => e.stopPropagation()}>
        <div className="p-4 pb-3 border-b border-border">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Contact className="w-5 h-5 text-wa-tint" /> Enviar Passageiro
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {contactsQ.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhum contato encontrado.
            </div>
          ) : (
            <div className="py-1">
              {filtered.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted/60 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-primary">
                      {(c.name || "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate">{c.name || "Sem nome"}</p>
                    <p className="text-[12px] text-muted-foreground truncate">
                      {c.phone || c.phoneNumber || "Sem telefone"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
