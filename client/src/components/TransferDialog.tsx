import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowRightLeft, X, Users, Loader2, StickyNote, Search } from "lucide-react";

interface TransferDialogProps {
  open: boolean;
  onClose: () => void;
  waConversationId: number;
  sessionId: string;
  remoteJid: string;
  currentAgentId?: number | null;
  contactName: string;
}

export default function TransferDialog({
  open,
  onClose,
  waConversationId,
  sessionId,
  remoteJid,
  currentAgentId,
  contactName,
}: TransferDialogProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");

  const transferMut = trpc.whatsapp.transfer.execute.useMutation({
    onSuccess: () => {
      toast.success("Conversa transferida com sucesso");
      onClose();
    },
    onError: (e) => toast.error(e.message || "Erro ao transferir conversa"),
  });

  // Get agents from the tenant
  const agentsQ = trpc.whatsapp.agents.useQuery(undefined, { enabled: open });

  if (!open) return null;

  const agents = (agentsQ.data as any[] || []).filter(
    (a: any) => a.id !== currentAgentId
  );

  const filteredAgents = agents.filter((a: any) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleTransfer = () => {
    if (!selectedAgentId) {
      toast.error("Selecione um agente para transferir");
      return;
    }
    transferMut.mutate({
      sessionId,
      remoteJid,
      toUserId: selectedAgentId,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-blue-500/10 border-b border-border px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-foreground">Transferir Conversa</h3>
            <p className="text-[12px] text-muted-foreground truncate">
              {contactName}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar agente..."
              className="w-full pl-9 pr-3 py-2.5 bg-muted/50 border border-border rounded-lg text-[14px] text-foreground placeholder:text-muted-foreground outline-none focus:border-blue-400 transition-colors"
            />
          </div>
        </div>

        {/* Agent list */}
        <div className="px-5 py-3 max-h-[240px] overflow-y-auto">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Selecione o agente destino
          </p>
          {agentsQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAgents.length === 0 ? (
            <p className="text-center text-[13px] text-muted-foreground py-8">
              {search ? "Nenhum agente encontrado" : "Nenhum agente disponível"}
            </p>
          ) : (
            <div className="space-y-1">
              {filteredAgents.map((agent: any) => {
                const initials = agent.name?.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase() || "?";
                const isSelected = selectedAgentId === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                      isSelected
                        ? "bg-blue-500/10 border border-blue-400/30 ring-1 ring-blue-400/20"
                        : "hover:bg-muted/70 border border-transparent"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                      isSelected ? "bg-blue-500/20" : "bg-muted"
                    }`}>
                      {agent.avatarUrl ? (
                        <img src={agent.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className={`text-[12px] font-bold ${isSelected ? "text-blue-500" : "text-muted-foreground"}`}>
                          {initials}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[14px] font-medium truncate ${isSelected ? "text-blue-600" : "text-foreground"}`}>
                        {agent.name}
                      </p>
                      <p className="text-[12px] text-muted-foreground truncate">{agent.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        agent.status === "online"
                          ? "bg-green-500/10 text-green-600"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {agent.status === "online" ? "Online" : "Offline"}
                      </span>
                      {agent.openTickets !== undefined && (
                        <span className="text-[11px] text-muted-foreground">
                          {agent.openTickets} chamados
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Note */}
        <div className="px-5 pb-3">
          <div className="relative">
            <StickyNote className="absolute left-3 top-3 w-4 h-4 text-amber-500" />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota para o agente destino (opcional)..."
              rows={2}
              className="w-full pl-9 pr-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[14px] text-amber-900 placeholder:text-amber-400 outline-none resize-none focus:border-amber-400 transition-colors"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 bg-muted/30 border-t border-border flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-[14px] font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleTransfer}
            disabled={!selectedAgentId || transferMut.isPending}
            className="flex-1 px-4 py-2.5 text-[14px] font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {transferMut.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Transferindo...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                Transferir
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
