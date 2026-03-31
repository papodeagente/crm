import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Search, ArrowLeft, MessageCircle, Phone, Loader2 } from "lucide-react";
import { WaAvatar, formatPhoneNumber } from "./ConversationItem";

interface NewChatPanelProps {
  open: boolean;
  onClose: () => void;
  onSelectJid: (jid: string, name: string) => void;
  sessionId: string;
}

export default function NewChatPanel({
  open, onClose, onSelectJid, sessionId,
}: NewChatPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const contactsQ = trpc.crm.contacts.list.useQuery({ limit: 500 }, { enabled: open });
  const trpcUtils = trpc.useUtils();

  const contacts = useMemo(() => {
    const list = (((contactsQ.data as any)?.items || contactsQ.data || []) as any) as Array<{ id: number; name: string; phone?: string | null; email?: string | null; accountName?: string | null }>;
    if (!searchTerm.trim()) return list.filter((c) => c.phone);
    const q = searchTerm.toLowerCase();
    return list.filter((c) => c.phone && (c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || (c.accountName && c.accountName.toLowerCase().includes(q))));
  }, [contactsQ.data, searchTerm]);

  const handleSelectContact = async (contact: { name: string; phone?: string | null }) => {
    if (!contact.phone) return;
    setResolving(true); setResolveError("");
    try {
      const result = await trpcUtils.whatsapp.resolveJid.fetch({ sessionId, phone: contact.phone });
      if (result.jid) { onSelectJid(result.jid, contact.name); onClose(); }
      else setResolveError(`${contact.name} não está no WhatsApp`);
    } catch { setResolveError("Erro ao verificar número no WhatsApp"); }
    finally { setResolving(false); }
  };

  const handlePhoneSubmit = async () => {
    const cleaned = phoneInput.replace(/\D/g, "");
    if (cleaned.length < 8) { setResolveError("Digite um número válido"); return; }
    setResolving(true); setResolveError("");
    try {
      const result = await trpcUtils.whatsapp.resolveJid.fetch({ sessionId, phone: cleaned });
      if (result.jid) { onSelectJid(result.jid, formatPhoneNumber(result.jid)); onClose(); }
      else setResolveError("Número não encontrado no WhatsApp");
    } catch { setResolveError("Erro ao verificar número no WhatsApp"); }
    finally { setResolving(false); }
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-card" style={{ animation: "slideInLeft 0.2s ease-out" }}>
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0 h-[59px] px-4 bg-card border-b border-border">
        <button
          onClick={() => { onClose(); setSearchTerm(""); setPhoneInput(""); setResolveError(""); }}
          className="w-[28px] h-[28px] flex items-center justify-center text-foreground hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="w-[20px] h-[20px]" />
        </button>
        <h2 className="text-[16px] font-medium text-foreground">Nova conversa</h2>
      </div>

      {/* Search */}
      <div className="shrink-0 px-3 py-[7px] bg-card">
        <div className="flex items-center rounded-lg overflow-hidden h-[35px] bg-muted px-3">
          <Search className="shrink-0 w-4 h-4 text-muted-foreground" />
          <input
            type="text" placeholder="Pesquisar contatos" value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-foreground placeholder:text-muted-foreground pl-3 h-full"
            autoFocus
          />
        </div>
      </div>

      {/* Phone input */}
      <div className="shrink-0 px-4 py-3 border-b border-border">
        <label className="text-[12px] text-muted-foreground uppercase tracking-wide font-medium mb-2 block">Digitar número</label>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg text-sm text-muted-foreground shrink-0">
            <span>🇧🇷</span><span>+55</span>
          </div>
          <input
            type="tel" placeholder="(84) 99999-9999" value={phoneInput}
            onChange={(e) => { setPhoneInput(e.target.value); setResolveError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handlePhoneSubmit(); }}
            className="flex-1 px-3 py-2 border border-border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
          />
          <button onClick={handlePhoneSubmit} disabled={resolving || phoneInput.replace(/\D/g, "").length < 8}
            className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1">
            {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
          </button>
        </div>
        {resolveError && <p className="text-[12px] text-destructive mt-1.5">{resolveError}</p>}
      </div>

      {/* Contacts list */}
      <div className="shrink-0 px-4 pt-3 pb-1">
        <p className="text-[12px] text-primary uppercase tracking-wide font-medium">Contatos do CRM ({contacts.length})</p>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ overscrollBehavior: "contain" }}>
        {contactsQ.isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Phone className="w-10 h-10 text-muted-foreground/20 mb-2" />
            <p className="text-[13px] text-muted-foreground">{searchTerm ? "Nenhum contato encontrado" : "Nenhum contato com telefone cadastrado"}</p>
          </div>
        ) : contacts.map((contact) => (
          <button
            key={contact.id} onClick={() => handleSelectContact(contact)} disabled={resolving}
            className="w-full flex items-center gap-3 px-4 py-[10px] hover:bg-accent transition-colors text-left disabled:opacity-60"
          >
            <WaAvatar name={contact.name} size={49} />
            <div className="flex-1 min-w-0 border-b border-border py-[6px]">
              <p className="text-[15px] text-foreground truncate">{contact.name}</p>
              <p className="text-[13px] text-muted-foreground truncate">
                {contact.phone || "Sem telefone"}{contact.accountName ? ` · ${contact.accountName}` : ""}
              </p>
            </div>
          </button>
        ))}
      </div>

      {resolving && (
        <div className="absolute inset-0 z-30 bg-background/70 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-[14px] text-muted-foreground">Verificando no WhatsApp...</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
