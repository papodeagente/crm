import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Activity, Wifi, WifiOff, QrCode, MessageSquare, Bot, AlertTriangle } from "lucide-react";
import { useState } from "react";

function formatTimestamp(ts: string | Date) {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "connected":
      return <Wifi className="h-4 w-4 text-primary" />;
    case "disconnected":
      return <WifiOff className="h-4 w-4 text-destructive" />;
    case "qr_generated":
      return <QrCode className="h-4 w-4 text-yellow-500" />;
    case "message_sent":
    case "media_sent":
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case "chatbot_reply":
      return <Bot className="h-4 w-4 text-purple-500" />;
    case "chatbot_error":
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
}

function getEventBadge(eventType: string) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    connected: "default",
    disconnected: "destructive",
    qr_generated: "outline",
    message_sent: "secondary",
    media_sent: "secondary",
    chatbot_reply: "outline",
    chatbot_error: "destructive",
    manual_disconnect: "destructive",
  };
  return variants[eventType] || "secondary";
}

export default function Logs() {
  const [sessionFilter, setSessionFilter] = useState("all");

  const sessionsQuery = trpc.whatsapp.sessions.useQuery();
  const allSessions = sessionsQuery.data || [];

  const logsQuery = trpc.whatsapp.logs.useQuery(
    {
      sessionId: sessionFilter === "all" ? undefined : sessionFilter,
      limit: 200,
    },
    { refetchInterval: 5000 }
  );

  const logs = logsQuery.data || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Logs de Atividades</h1>
          <p className="text-muted-foreground mt-1">Monitore eventos e atividades do WhatsApp em tempo real</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Eventos</CardTitle>
                <CardDescription>{logs.length} eventos registrados</CardDescription>
              </div>
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por sessão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as sessões</SelectItem>
                  {allSessions.map((s) => (
                    <SelectItem key={s.sessionId} value={s.sessionId}>
                      {s.sessionId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="py-12 text-center">
                <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum evento registrado</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/30 transition-colors"
                    >
                      <div className="mt-0.5">{getEventIcon(log.eventType)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={getEventBadge(log.eventType)} className="text-xs">
                            {log.eventType}
                          </Badge>
                          {log.sessionId && (
                            <span className="text-xs text-muted-foreground">
                              {log.sessionId}
                            </span>
                          )}
                        </div>
                        <p className="text-sm mt-1">{log.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(log.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
