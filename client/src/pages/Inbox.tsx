import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Inbox as InboxIcon, Send, Search, User, Clock,
  MessageSquare, Hash, Globe, Phone, Mail, MapPin,
  Briefcase, FileText, Paperclip, Smile,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

const TENANT_ID = 1;

const statusConfig: Record<string, { dot: string; label: string }> = {
  open: { dot: "bg-blue-500", label: "Aberta" },
  pending: { dot: "bg-amber-500", label: "Pendente" },
  resolved: { dot: "bg-emerald-500", label: "Resolvida" },
  closed: { dot: "bg-neutral-400", label: "Fechada" },
};

function timeAgo(date: string | Date | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return "agora";
  if (diff < 60) return `${diff}min`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function InboxPage() {
  const [selectedConv, setSelectedConv] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  const filteredConvs = (conversations.data || []).filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return String(c.id).includes(s) || (c.lastMessagePreview || "").toLowerCase().includes(s);
  });

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* ─── Column 1: Conversations ─── */}
      <div className="w-[320px] border-r border-border/40 flex flex-col shrink-0 bg-[var(--sidebar-bg,oklch(0.985_0_0))]">
        {/* Search */}
        <div className="p-3.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              className="pl-9 h-8 rounded-lg bg-muted/50 border-0 text-[13px] placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/30"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {conversations.isLoading ? (
            <div className="p-8 text-center">
              <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          ) : !filteredConvs.length ? (
            <div className="p-10 text-center">
              <InboxIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
              <p className="text-[13px] text-muted-foreground/60">Nenhuma conversa</p>
            </div>
          ) : filteredConvs.map((conv: any) => {
            const sc = statusConfig[conv.status] || statusConfig["open"];
            const isActive = selectedConv === conv.id;
            return (
              <button
                key={conv.id}
                onClick={() => setSelectedConv(conv.id)}
                className={`w-full text-left px-3.5 py-3 transition-colors duration-100 ${
                  isActive ? "bg-primary/[0.08]" : "hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center">
                      <User className="h-4.5 w-4.5 text-muted-foreground/70" />
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${sc.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-[13px] truncate ${isActive ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}>
                        Conversa #{conv.id}
                      </p>
                      <span className="text-[11px] text-muted-foreground/60 shrink-0 ml-2">
                        {timeAgo(conv.updatedAt || conv.createdAt)}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground/70 truncate mt-0.5 leading-relaxed">
                      {conv.lastMessagePreview || "Sem mensagens"}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </ScrollArea>
      </div>

      {/* ─── Column 2: Messages (iMessage style) ─── */}
      <div className="flex-1 flex flex-col bg-white">
        {!selectedConv ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-[15px] font-medium text-muted-foreground/50">Selecione uma conversa</p>
              <p className="text-[13px] text-muted-foreground/35 mt-1">Escolha uma conversa ao lado para ver as mensagens</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground/70" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-foreground">Conversa #{selectedConv}</p>
                  <p className="text-[11px] text-muted-foreground/60">
                    {statusConfig[activeConv?.status || "open"]?.label || "Aberta"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground/60 hover:text-foreground">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground/60 hover:text-foreground">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages — iMessage bubbles */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {messages.isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : !messages.data?.length ? (
                <div className="text-center py-16">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/15" />
                  <p className="text-[13px] text-muted-foreground/40">Nenhuma mensagem</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.data.map((msg: any, i: number) => {
                    const isOut = msg.direction === "outbound";
                    const prev = messages.data[i - 1];
                    const showGap = prev && (new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 300000);

                    return (
                      <div key={msg.id}>
                        {showGap && (
                          <div className="flex justify-center py-3">
                            <span className="text-[11px] text-muted-foreground/40 bg-muted/30 px-3 py-1 rounded-full">
                              {new Date(msg.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[60%] px-4 py-2.5 text-[13.5px] leading-relaxed ${
                            isOut
                              ? "bg-primary text-primary-foreground rounded-[20px] rounded-br-[6px]"
                              : "bg-muted/50 text-foreground rounded-[20px] rounded-bl-[6px]"
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.bodyText}</p>
                            <p className={`text-[10px] mt-1 text-right ${isOut ? "text-primary-foreground/50" : "text-muted-foreground/50"}`}>
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input — clean Apple style */}
            <div className="px-4 py-3 border-t border-border/30 bg-white">
              <div className="flex items-end gap-2">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground/50 hover:text-foreground shrink-0">
                  <Paperclip className="h-4.5 w-4.5" />
                </Button>
                <div className="flex-1 relative">
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Mensagem..."
                    className="h-10 rounded-full border-border/40 bg-muted/20 text-[13.5px] pr-10 focus-visible:ring-1 focus-visible:ring-primary/30"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && messageText.trim()) {
                        e.preventDefault();
                        sendMessage.mutate({ tenantId: TENANT_ID, conversationId: selectedConv!, bodyText: messageText });
                      }
                    }}
                  />
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-muted-foreground/40">
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 shadow-sm shrink-0 transition-colors"
                  disabled={!messageText.trim() || sendMessage.isPending}
                  onClick={() => sendMessage.mutate({ tenantId: TENANT_ID, conversationId: selectedConv!, bodyText: messageText })}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── Column 3: Contact details with tabs ─── */}
      {selectedConv && activeConv && (
        <div className="w-[300px] border-l border-border/30 hidden xl:flex flex-col bg-white">
          {/* Profile header */}
          <div className="p-5 border-b border-border/30 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <User className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-[15px] font-semibold text-foreground">Conversa #{selectedConv}</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className={`h-2 w-2 rounded-full ${statusConfig[activeConv.status]?.dot || "bg-blue-500"}`} />
              <span className="text-[12px] text-muted-foreground">{statusConfig[activeConv.status]?.label || "Aberta"}</span>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start rounded-none border-b border-border/30 bg-transparent px-3 h-10 gap-0">
              <TabsTrigger value="info" className="text-[12px] font-medium data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 py-2">
                Info
              </TabsTrigger>
              <TabsTrigger value="deals" className="text-[12px] font-medium data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 py-2">
                Negociações
              </TabsTrigger>
              <TabsTrigger value="tasks" className="text-[12px] font-medium data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 py-2">
                Tarefas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="flex-1 overflow-auto m-0">
              <div className="p-4 space-y-4">
                <DetailRow icon={Hash} label="ID" value={`#${activeConv.id}`} />
                <DetailRow icon={Globe} label="Canal" value={activeConv.channelId ? `Canal #${activeConv.channelId}` : "Direto"} />
                <DetailRow icon={Clock} label="Criada em" value={activeConv.createdAt ? new Date(activeConv.createdAt).toLocaleDateString("pt-BR") : "—"} />
                <DetailRow icon={Mail} label="E-mail" value="—" />
                <DetailRow icon={Phone} label="Telefone" value="—" />
                <DetailRow icon={MapPin} label="Localização" value="—" />
              </div>
            </TabsContent>

            <TabsContent value="deals" className="flex-1 overflow-auto m-0">
              <div className="p-4">
                <div className="text-center py-8">
                  <Briefcase className="h-7 w-7 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-[12px] text-muted-foreground/50">Nenhuma negociação vinculada</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="flex-1 overflow-auto m-0">
              <div className="p-4">
                <div className="text-center py-8">
                  <FileText className="h-7 w-7 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-[12px] text-muted-foreground/50">Nenhuma tarefa vinculada</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

/* ─── Detail Row ─── */
function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground/60 font-medium">{label}</p>
        <p className="text-[13px] text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
