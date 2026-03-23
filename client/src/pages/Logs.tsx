import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Activity, Wifi, WifiOff, QrCode, MessageSquare, Bot, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { formatDateTimeShort, formatTimeWithSeconds, SYSTEM_TIMEZONE, SYSTEM_LOCALE } from "../../../shared/dateUtils";

function formatTimestamp(ts: string | Date) {
  const d = new Date(ts);
  return d.toLocaleString(SYSTEM_LOCALE, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: SYSTEM_TIMEZONE });
}

const eventConfig: Record<string, { icon: any; bg: string; color: string; label: string }> = {
  connected: { icon: Wifi, bg: "bg-emerald-50", color: "text-emerald-600", label: "Conectado" },
  disconnected: { icon: WifiOff, bg: "bg-red-50", color: "text-red-600", label: "Desconectado" },
  qr_generated: { icon: QrCode, bg: "bg-amber-50", color: "text-amber-600", label: "QR Code" },
  message_sent: { icon: MessageSquare, bg: "bg-blue-50", color: "text-blue-600", label: "Mensagem" },
  media_sent: { icon: MessageSquare, bg: "bg-blue-50", color: "text-blue-600", label: "Mídia" },
  chatbot_reply: { icon: Bot, bg: "bg-violet-50", color: "text-violet-600", label: "Chatbot" },
  chatbot_error: { icon: AlertTriangle, bg: "bg-red-50", color: "text-red-600", label: "Erro IA" },
  manual_disconnect: { icon: WifiOff, bg: "bg-red-50", color: "text-red-600", label: "Desconexão" },
};

export default function Logs() {
  const [sessionFilter, setSessionFilter] = useState("all");
  const sessionsQuery = trpc.whatsapp.sessions.useQuery();
  const allSessions = sessionsQuery.data || [];
  const logsQuery = trpc.whatsapp.logs.useQuery(
    { sessionId: sessionFilter === "all" ? undefined : sessionFilter, limit: 200 },
    { refetchInterval: 15000, staleTime: 10000, refetchIntervalInBackground: false }
  );
  const logs = logsQuery.data || [];

  return (
    <div className="p-5 lg:px-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Logs de Atividades</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Monitore eventos do WhatsApp em tempo real. <span className="font-medium">{logs.length} eventos</span></p>
        </div>
        <Select value={sessionFilter} onValueChange={setSessionFilter}>
          <SelectTrigger className="w-[200px] h-9 rounded-xl text-[13px]"><SelectValue placeholder="Filtrar por sessão" /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Todas as sessões</SelectItem>
            {allSessions.map((s) => (<SelectItem key={s.sessionId} value={s.sessionId}>{s.sessionId}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <Card className="border border-border/40 shadow-none rounded-xl">
        {logs.length === 0 ? (
          <div className="py-16 text-center">
            <Activity className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-[14px] font-medium text-muted-foreground/60">Nenhum evento registrado</p>
            <p className="text-[13px] text-muted-foreground/40 mt-1">Os eventos aparecerão aqui em tempo real.</p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="divide-y divide-border/20">
              {logs.map((log) => {
                const cfg = eventConfig[log.eventType] || { icon: Activity, bg: "bg-slate-50", color: "text-slate-600", label: log.eventType };
                const Icon = cfg.icon;
                return (
                  <div key={log.id} className="flex items-start gap-3.5 p-4 hover:bg-muted/20 transition-colors">
                    <div className={`h-9 w-9 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        {log.sessionId && <span className="text-[11px] text-muted-foreground font-mono">{log.sessionId}</span>}
                      </div>
                      <p className="text-[13px] mt-1 text-foreground">{log.description}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatTimestamp(log.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}
