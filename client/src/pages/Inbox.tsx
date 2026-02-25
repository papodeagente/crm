import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Inbox as InboxIcon, Send, Search, User, Clock, MessageSquare, Hash, Globe } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TENANT_ID = 1;

const statusStyles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  open: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Aberta" },
  pending: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Pendente" },
  resolved: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Resolvida" },
  closed: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", label: "Fechada" },
};

export default function InboxPage() {
  const [selectedConv, setSelectedConv] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const conversations = trpc.inbox.conversations.list.useQuery({ tenantId: TENANT_ID, limit: 50 });
  const messages = trpc.inbox.messages.list.useQuery(
    { tenantId: TENANT_ID, conversationId: selectedConv ?? 0, limit: 100 },
    { enabled: !!selectedConv }
  );
  const sendMessage = trpc.inbox.messages.send.useMutation({
    onSuccess: () => { utils.inbox.messages.list.invalidate(); setMessageText(""); },
  });

  const activeConv = conversations.data?.find((c: any) => c.id === selectedConv);

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Column 1: Conversation list */}
      <div className="w-[340px] border-r border-border/30 flex flex-col shrink-0 bg-white/80">
        <div className="p-4 border-b border-border/30">
          <h2 className="text-[15px] font-bold text-foreground mb-3">Inbox</h2>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10 h-9 rounded-xl border-border/50 bg-muted/30 text-[13px]" placeholder="Buscar conversas..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {conversations.isLoading ? (
            <p className="p-6 text-[13px] text-muted-foreground text-center">Carregando...</p>
          ) : !conversations.data?.length ? (
            <div className="p-10 text-center text-muted-foreground">
              <InboxIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-[13px]">Nenhuma conversa.</p>
            </div>
          ) : conversations.data.map((conv: any) => {
            const ss = statusStyles[conv.status] || statusStyles["open"];
            return (
              <button
                key={conv.id}
                onClick={() => setSelectedConv(conv.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-border/20 hover:bg-muted/30 transition-all duration-150 ${selectedConv === conv.id ? "bg-primary/[0.04] border-l-2 border-l-primary" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold truncate">Conversa #{conv.id}</p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${ss.bg} ${ss.text}`}>
                        <span className={`h-1 w-1 rounded-full ${ss.dot}`} />
                        {ss.label}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground truncate mt-0.5">{conv.lastMessagePreview || "Sem mensagens"}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </ScrollArea>
      </div>

      {/* Column 2: Messages */}
      <div className="flex-1 flex flex-col bg-muted/10">
        {!selectedConv ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-14 w-14 mx-auto mb-4 text-muted-foreground/20" />
              <p className="text-[15px] font-medium text-muted-foreground/60">Selecione uma conversa</p>
              <p className="text-[13px] text-muted-foreground/40 mt-1">Escolha uma conversa para ver as mensagens.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3.5 border-b border-border/30 bg-white/80 backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold">Conversa #{selectedConv}</p>
                  <p className="text-[12px] text-muted-foreground">{activeConv?.status || "open"}</p>
                </div>
              </div>
            </div>

            {/* Messages area */}
            <ScrollArea className="flex-1 px-5 py-4">
              {messages.isLoading ? (
                <p className="text-[13px] text-muted-foreground text-center py-8">Carregando...</p>
              ) : !messages.data?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-[13px]">Nenhuma mensagem nesta conversa.</p>
                </div>
              ) : messages.data.map((msg: any) => (
                <div key={msg.id} className={`mb-3 flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[65%] rounded-2xl px-4 py-2.5 text-[13px] ${
                    msg.direction === "outbound"
                      ? "bg-gradient-to-r from-primary to-[oklch(0.50_0.14_264)] text-white rounded-br-lg"
                      : "bg-white border border-border/30 shadow-[0_1px_2px_oklch(0_0_0/0.03)] rounded-bl-lg"
                  }`}>
                    <p>{msg.bodyText}</p>
                    <p className={`text-[10px] mt-1.5 ${msg.direction === "outbound" ? "text-white/60" : "text-muted-foreground"}`}>
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </p>
                  </div>
                </div>
              ))}
            </ScrollArea>

            {/* Input area */}
            <div className="px-5 py-3.5 border-t border-border/30 bg-white/80 backdrop-blur-sm flex gap-2.5">
              <Input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 h-10 rounded-xl border-border/50 text-[13px]"
                onKeyDown={(e) => { if (e.key === "Enter" && messageText.trim()) { sendMessage.mutate({ tenantId: TENANT_ID, conversationId: selectedConv, bodyText: messageText }); } }}
              />
              <Button
                size="icon"
                className="h-10 w-10 rounded-xl shadow-soft bg-gradient-to-r from-primary to-[oklch(0.50_0.14_264)] hover:opacity-90"
                disabled={!messageText.trim() || sendMessage.isPending}
                onClick={() => sendMessage.mutate({ tenantId: TENANT_ID, conversationId: selectedConv, bodyText: messageText })}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Column 3: Details */}
      {selectedConv && activeConv && (
        <div className="w-[280px] border-l border-border/30 hidden lg:flex flex-col bg-white/80">
          <div className="p-5 border-b border-border/30">
            <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Detalhes</h3>
          </div>
          <div className="p-5 space-y-5">
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-1.5"><Hash className="h-3 w-3" />Canal</p>
              <p className="text-[13px] font-medium">{activeConv.channelId || "—"}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-1.5"><Globe className="h-3 w-3" />Status</p>
              {(() => {
                const ss = statusStyles[activeConv.status] || statusStyles["open"];
                return (
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${ss.bg} ${ss.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                    {ss.label}
                  </span>
                );
              })()}
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-1.5"><Clock className="h-3 w-3" />Criada em</p>
              <p className="text-[13px] font-medium">{activeConv.createdAt ? new Date(activeConv.createdAt).toLocaleDateString("pt-BR") : "—"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
