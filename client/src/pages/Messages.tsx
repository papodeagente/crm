import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { MessageSquare, ArrowUpRight, ArrowDownLeft, Image, FileAudio, FileText } from "lucide-react";
import { useState, useEffect } from "react";

function formatTimestamp(ts: string | Date) {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  // Refetch when new message arrives via socket
  useEffect(() => {
    if (lastMessage?.sessionId === sessionId) {
      messagesQuery.refetch();
    }
  }, [lastMessage]);

  const messagesList = messagesQuery.data || [];

  // Group messages by contact
  const contactGroups = messagesList.reduce((acc, msg) => {
    const jid = msg.remoteJid;
    if (!acc[jid]) acc[jid] = [];
    acc[jid].push(msg);
    return acc;
  }, {} as Record<string, typeof messagesList>);

  const contacts = Object.keys(contactGroups).sort();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mensagens</h1>
          <p className="text-muted-foreground mt-1">Histórico de mensagens enviadas e recebidas</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selecionar Sessão</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma sessão para ver as mensagens" />
              </SelectTrigger>
              <SelectContent>
                {allSessions.map((s) => (
                  <SelectItem key={s.sessionId} value={s.sessionId}>
                    {s.sessionId} ({s.pushName || s.phoneNumber || s.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {sessionId && messagesList.length === 0 && !messagesQuery.isLoading && (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma mensagem encontrada para esta sessão</p>
            </CardContent>
          </Card>
        )}

        {contacts.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {contacts.map((jid) => {
              const msgs = contactGroups[jid];
              const sortedMsgs = [...msgs].sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
              return (
                <Card key={jid}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      {formatJid(jid)}
                    </CardTitle>
                    <CardDescription>{msgs.length} mensagens</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="space-y-2">
                        {sortedMsgs.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex gap-2 ${msg.fromMe ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                                msg.fromMe
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              <div className="flex items-center gap-1 mb-1">
                                {msg.fromMe ? (
                                  <ArrowUpRight className="h-3 w-3 opacity-70" />
                                ) : (
                                  <ArrowDownLeft className="h-3 w-3 opacity-70" />
                                )}
                                <MessageTypeIcon type={msg.messageType} />
                                <span className="text-[10px] opacity-70">
                                  {formatTimestamp(msg.timestamp)}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap break-words">{msg.content || `[${msg.messageType}]`}</p>
                              {msg.mediaUrl && (
                                <a
                                  href={msg.mediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs underline opacity-80 mt-1 block"
                                >
                                  Ver mídia
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
