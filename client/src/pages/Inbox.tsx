import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Inbox as InboxIcon, Send, Search, User, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TENANT_ID = 1;

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
    <div className="flex h-[calc(100vh-8rem)] gap-0 rounded-lg border overflow-hidden bg-card">
      {/* Column 1: Conversation list */}
      <div className="w-80 border-r flex flex-col shrink-0">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder="Buscar conversas..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {conversations.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Carregando...</p>
          ) : !conversations.data?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              <InboxIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma conversa.</p>
            </div>
          ) : conversations.data.map((conv: any) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConv(conv.id)}
              className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${selectedConv === conv.id ? "bg-muted/70" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">Conversa #{conv.id}</p>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{conv.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessagePreview || "Sem mensagens"}</p>
                </div>
              </div>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Column 2: Messages */}
      <div className="flex-1 flex flex-col">
        {!selectedConv ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <InboxIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selecione uma conversa para ver as mensagens.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Conversa #{selectedConv}</p>
                  <p className="text-xs text-muted-foreground">{activeConv?.status || "open"}</p>
                </div>
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              {messages.isLoading ? (
                <p className="text-sm text-muted-foreground text-center">Carregando...</p>
              ) : !messages.data?.length ? (
                <p className="text-sm text-muted-foreground text-center">Nenhuma mensagem nesta conversa.</p>
              ) : messages.data.map((msg: any) => (
                <div key={msg.id} className={`mb-3 flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${msg.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <p>{msg.bodyText}</p>
                    <p className={`text-[10px] mt-1 ${msg.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </p>
                  </div>
                </div>
              ))}
            </ScrollArea>
            <div className="p-3 border-t flex gap-2">
              <Input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Digite sua mensagem..."
                onKeyDown={(e) => { if (e.key === "Enter" && messageText.trim()) { sendMessage.mutate({ tenantId: TENANT_ID, conversationId: selectedConv, bodyText: messageText }); } }}
              />
              <Button size="icon" disabled={!messageText.trim() || sendMessage.isPending} onClick={() => sendMessage.mutate({ tenantId: TENANT_ID, conversationId: selectedConv, bodyText: messageText })}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Column 3: Contact details */}
      {selectedConv && activeConv && (
        <div className="w-72 border-l p-4 hidden lg:block">
          <h3 className="font-semibold text-sm mb-4">Detalhes</h3>
          <div className="space-y-3 text-sm">
            <div><p className="text-muted-foreground text-xs">Canal</p><p>{activeConv.channelId || "—"}</p></div>
            <div><p className="text-muted-foreground text-xs">Status</p><Badge variant="secondary">{activeConv.status}</Badge></div>
            <div><p className="text-muted-foreground text-xs">Prioridade</p><p>{activeConv.priority || "normal"}</p></div>
            <div><p className="text-muted-foreground text-xs">Criada em</p><p>{activeConv.createdAt ? new Date(activeConv.createdAt).toLocaleDateString("pt-BR") : "—"}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
