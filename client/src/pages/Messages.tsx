import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { MessageSquare, ArrowUpRight, ArrowDownLeft, Image, FileAudio, FileText } from "lucide-react";
import { useState, useEffect } from "react";

function formatTimestamp(ts: string | Date) {
  return new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatJid(jid: string) {
  return jid.replace("@s.whatsapp.net", "").replace("@g.us", " (grupo)");
}

function MessageTypeIcon({ type }: { type: string }) {
  if (type.includes("image")) return <Image className="h-3 w-3" />;
  if (type.includes("audio")) return <FileAudio className="h-3 w-3" />;
  if (type.includes("document")) return <FileText className="h-3 w-3" />;
  return null;
}

export default function Messages() {
  const [sessionId, setSessionId] = useState("");
  const { lastMessage } = useSocket();
  const sessionsQuery = trpc.whatsapp.sessions.useQuery();
  const allSessions = sessionsQuery.data || [];
  const messagesQuery = trpc.whatsapp.messages.useQuery(
    { sessionId, limit: 100, offset: 0 },
    { enabled: !!sessionId, refetchInterval: 5000 }
  );

  useEffect(() => {
    if (lastMessage?.sessionId === sessionId) { messagesQuery.refetch(); }
  }, [lastMessage]);

  const messagesList = messagesQuery.data || [];
  const contactGroups = messagesList.reduce((acc, msg) => {
    const jid = msg.remoteJid;
    if (!acc[jid]) acc[jid] = [];
    acc[jid].push(msg);
    return acc;
  }, {} as Record<string, typeof messagesList>);
  const contacts = Object.keys(contactGroups).sort();

  return (
    <div className="p-5 lg:px-8 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Mensagens</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Histórico de mensagens enviadas e recebidas.</p>
      </div>

      <Card className="border-0 shadow-soft rounded-2xl">
        <div className="p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><MessageSquare className="h-4 w-4 text-primary" /></div>
            <p className="text-[14px] font-semibold">Selecionar Sessão</p>
          </div>
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Selecione uma sessão para ver as mensagens" /></SelectTrigger>
            <SelectContent className="rounded-xl">
              {allSessions.map((s) => (
                <SelectItem key={s.sessionId} value={s.sessionId}>{s.sessionId} ({s.pushName || s.phoneNumber || s.status})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {sessionId && messagesList.length === 0 && !messagesQuery.isLoading && (
        <Card className="border-0 shadow-soft rounded-2xl">
          <div className="py-16 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-[14px] font-medium text-muted-foreground/60">Nenhuma mensagem encontrada</p>
          </div>
        </Card>
      )}

      {contacts.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {contacts.map((jid) => {
            const msgs = contactGroups[jid];
            const sortedMsgs = [...msgs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            return (
              <Card key={jid} className="border-0 shadow-soft rounded-2xl">
                <div className="p-5 pb-3 border-b border-border/20">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-[12px] font-bold text-primary">
                      {formatJid(jid).slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold">{formatJid(jid)}</p>
                      <p className="text-[11px] text-muted-foreground">{msgs.length} mensagens</p>
                    </div>
                  </div>
                </div>
                <ScrollArea className="h-[300px]">
                  <div className="p-4 space-y-2">
                    {sortedMsgs.map((msg) => (
                      <div key={msg.id} className={`flex gap-2 ${msg.fromMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[13px] ${msg.fromMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted/60 rounded-bl-md"}`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            {msg.fromMe ? <ArrowUpRight className="h-3 w-3 opacity-60" /> : <ArrowDownLeft className="h-3 w-3 opacity-60" />}
                            <MessageTypeIcon type={msg.messageType} />
                            <span className="text-[10px] opacity-60">{formatTimestamp(msg.timestamp)}</span>
                          </div>
                          <p className="whitespace-pre-wrap break-words">{msg.content || `[${msg.messageType}]`}</p>
                          {msg.mediaUrl && (
                            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] underline opacity-70 mt-1.5 block">Ver mídia</a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
