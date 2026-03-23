import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSocket, type WhatsAppMessageStatusEvent } from "@/hooks/useSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Send, MessageSquare, CheckCheck, Check, Eye, Clock, AlertTriangle,
  TrendingUp, TrendingDown, Activity, BarChart3, Users, Zap,
  ArrowUpRight, ArrowDownRight, RefreshCw, Wifi, WifiOff,
  MessageCircle, Image, Mic, FileText, Video, Sticker
} from "lucide-react";
import { formatTime as fmtTime, formatTimeWithSeconds as fmtTimeWS, SYSTEM_TIMEZONE, SYSTEM_LOCALE } from "../../../shared/dateUtils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

// ─── Status helpers ───

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; bgClass: string }> = {
  sent: { label: "Enviado", color: "#f59e0b", icon: <Check className="h-3.5 w-3.5" />, bgClass: "bg-amber-500/10 text-amber-500" },
  delivered: { label: "Entregue", color: "#3b82f6", icon: <CheckCheck className="h-3.5 w-3.5" />, bgClass: "bg-blue-500/10 text-blue-500" },
  read: { label: "Lido", color: "#22c55e", icon: <CheckCheck className="h-3.5 w-3.5" />, bgClass: "bg-emerald-500/10 text-emerald-500" },
  played: { label: "Reproduzido", color: "#8b5cf6", icon: <Eye className="h-3.5 w-3.5" />, bgClass: "bg-violet-500/10 text-violet-500" },
  received: { label: "Recebido", color: "#06b6d4", icon: <MessageSquare className="h-3.5 w-3.5" />, bgClass: "bg-cyan-500/10 text-cyan-500" },
  failed: { label: "Falha", color: "#ef4444", icon: <AlertTriangle className="h-3.5 w-3.5" />, bgClass: "bg-red-500/10 text-red-500" },
  pending: { label: "Pendente", color: "#94a3b8", icon: <Clock className="h-3.5 w-3.5" />, bgClass: "bg-slate-500/10 text-slate-400" },
};

const MSG_TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <MessageCircle className="h-4 w-4" />,
  imageMessage: <Image className="h-4 w-4" />,
  audioMessage: <Mic className="h-4 w-4" />,
  videoMessage: <Video className="h-4 w-4" />,
  documentMessage: <FileText className="h-4 w-4" />,
  stickerMessage: <Sticker className="h-4 w-4" />,
};

const CHART_COLORS = ["#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#f97316"];

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatTime(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatJid(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, "").replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "+$1 ($2) $3-$4");
}

function timeAgo(ts: string | Date): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return "agora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

// ─── Components ───

function MetricCard({ title, value, subtitle, icon, trend, trendLabel }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ReactNode; trend?: "up" | "down" | "neutral"; trendLabel?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{icon}</div>
        </div>
        {trend && trendLabel && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {trend === "up" ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
            ) : trend === "down" ? (
              <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
            ) : null}
            <span className={trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}>
              {trendLabel}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <Badge variant="outline" className={`gap-1 text-[11px] font-medium border-0 ${config.bgClass}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

function DeliveryFunnel({ data }: { data: any }) {
  if (!data) return null;
  const total = Number(data.totalSent) || 0;
  if (total === 0) return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem enviada no período</p>;

  const delivered = Number(data.delivered) || 0;
  const readCount = Number(data.readCount) || 0;
  const played = Number(data.played) || 0;
  const failed = Number(data.failed) || 0;
  const pending = Number(data.pending) || 0;

  const deliveryRate = total > 0 ? ((delivered / total) * 100).toFixed(1) : "0";
  const readRate = total > 0 ? ((readCount / total) * 100).toFixed(1) : "0";

  const funnelData = [
    { name: "Enviadas", value: total, color: "#f59e0b" },
    { name: "Entregues", value: delivered, color: "#3b82f6" },
    { name: "Lidas", value: readCount, color: "#22c55e" },
    ...(played > 0 ? [{ name: "Reproduzidas", value: played, color: "#8b5cf6" }] : []),
    ...(failed > 0 ? [{ name: "Falhas", value: failed, color: "#ef4444" }] : []),
    ...(pending > 0 ? [{ name: "Pendentes", value: pending, color: "#94a3b8" }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Funnel bars */}
      <div className="space-y-3">
        {funnelData.map((item) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium">{formatNumber(item.value)} <span className="text-muted-foreground text-xs">({pct.toFixed(1)}%)</span></span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 pt-2">
        <div className="flex-1 rounded-lg bg-blue-500/10 p-3 text-center">
          <p className="text-lg font-bold text-blue-500">{deliveryRate}%</p>
          <p className="text-[11px] text-muted-foreground">Taxa de Entrega</p>
        </div>
        <div className="flex-1 rounded-lg bg-emerald-500/10 p-3 text-center">
          <p className="text-lg font-bold text-emerald-500">{readRate}%</p>
          <p className="text-[11px] text-muted-foreground">Taxa de Leitura</p>
        </div>
      </div>
    </div>
  );
}

function ActivityFeed({ data, isLoading }: { data: any[]; isLoading: boolean }) {
  if (isLoading) return <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted/30 animate-pulse" />)}</div>;
  if (!data?.length) return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade recente</p>;

  return (
    <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
      {data.slice(0, 30).map((msg: any) => (
        <div key={msg.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/30 transition-colors">
          <div className={`shrink-0 rounded-full p-1.5 ${msg.fromMe ? "bg-violet-500/10 text-violet-500" : "bg-cyan-500/10 text-cyan-500"}`}>
            {msg.fromMe ? <Send className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">
                {msg.pushName || formatJid(msg.remoteJid)}
              </span>
              <StatusBadge status={msg.fromMe ? (msg.status || "sent") : "received"} />
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {MSG_TYPE_ICONS[msg.messageType] || null}
              {msg.content ? msg.content.substring(0, 80) : `[${msg.messageType}]`}
            </p>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(msg.timestamp)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───

export default function MessageMonitoring() {
  const { user } = useAuth();
  const { lastMessage, lastStatusUpdate, isConnected } = useSocket();
  const [periodDays, setPeriodDays] = useState(7);
  const [activeTab, setActiveTab] = useState("overview");
  const [liveEvents, setLiveEvents] = useState<Array<{ type: string; data: any; ts: number }>>([]);

  // Get sessions
  const sessionsQuery = trpc.whatsapp.sessions.useQuery(undefined, { enabled: !!user });
  const sessions = sessionsQuery.data || [];
  const [selectedSession, setSelectedSession] = useState("");

  useEffect(() => {
    if (sessions.length > 0 && !selectedSession) {
      setSelectedSession(sessions[0].sessionId);
    }
  }, [sessions, selectedSession]);

  const queryEnabled = !!selectedSession && !!user;

  // Queries
  const statusMetrics = trpc.monitoring.statusMetrics.useQuery(
    { sessionId: selectedSession, periodDays },
    { enabled: queryEnabled, refetchInterval: 30000, staleTime: 15000, refetchIntervalInBackground: false }
  );
  const volumeOverTime = trpc.monitoring.volumeOverTime.useQuery(
    { sessionId: selectedSession, periodDays, granularity: periodDays <= 2 ? "hour" : "day" },
    { enabled: queryEnabled, refetchInterval: 30000, staleTime: 15000, refetchIntervalInBackground: false }
  );
  const deliveryRate = trpc.monitoring.deliveryRate.useQuery(
    { sessionId: selectedSession, periodDays },
    { enabled: queryEnabled, refetchInterval: 30000, staleTime: 15000, refetchIntervalInBackground: false }
  );
  const recentActivity = trpc.monitoring.recentActivity.useQuery(
    { sessionId: selectedSession, limit: 50 },
    { enabled: queryEnabled, refetchInterval: 15000, staleTime: 10000, refetchIntervalInBackground: false }
  );
  const typeDistribution = trpc.monitoring.typeDistribution.useQuery(
    { sessionId: selectedSession, periodDays },
    { enabled: queryEnabled, refetchInterval: 60000, staleTime: 30000, refetchIntervalInBackground: false }
  );
  const topContacts = trpc.monitoring.topContacts.useQuery(
    { sessionId: selectedSession, periodDays, limit: 10 },
    { enabled: queryEnabled, refetchInterval: 60000, staleTime: 30000, refetchIntervalInBackground: false }
  );
  const responseTime = trpc.monitoring.responseTime.useQuery(
    { sessionId: selectedSession, periodDays },
    { enabled: queryEnabled, refetchInterval: 60000, staleTime: 30000, refetchIntervalInBackground: false }
  );

  // Live events from Socket.IO
  useEffect(() => {
    if (lastMessage) {
      setLiveEvents(prev => [{ type: "message", data: lastMessage, ts: Date.now() }, ...prev].slice(0, 50));
    }
  }, [lastMessage]);

  useEffect(() => {
    if (lastStatusUpdate) {
      setLiveEvents(prev => [{ type: "status", data: lastStatusUpdate, ts: Date.now() }, ...prev].slice(0, 50));
    }
  }, [lastStatusUpdate]);

  // Computed metrics
  const metrics = useMemo(() => {
    const statusData = statusMetrics.data || [];
    let totalSent = 0, totalReceived = 0, totalDelivered = 0, totalRead = 0;
    for (const row of statusData) {
      const count = Number(row.count) || 0;
      switch (row.statusGroup) {
        case "received": totalReceived = count; break;
        case "sent": totalSent += count; break;
        case "delivered": totalDelivered += count; totalSent += count; break;
        case "read": totalRead += count; totalSent += count; break;
        case "played": totalRead += count; totalSent += count; break;
      }
    }
    return { totalSent, totalReceived, totalDelivered, totalRead, total: totalSent + totalReceived };
  }, [statusMetrics.data]);

  // Volume chart data
  const volumeChartData = useMemo(() => {
    return (volumeOverTime.data || []).map((row: any) => ({
      time: periodDays <= 2
        ? fmtTime(row.timeBucket)
        : new Date(row.timeBucket + "T00:00:00").toLocaleDateString(SYSTEM_LOCALE, { day: "2-digit", month: "2-digit", timeZone: SYSTEM_TIMEZONE }),
      enviadas: Number(row.sent) || 0,
      recebidas: Number(row.received) || 0,
    }));
  }, [volumeOverTime.data, periodDays]);

  // Type distribution for pie chart
  const typeChartData = useMemo(() => {
    return (typeDistribution.data || []).map((row: any, i: number) => ({
      name: row.messageType === "text" ? "Texto" :
        row.messageType === "imageMessage" ? "Imagem" :
        row.messageType === "audioMessage" ? "Áudio" :
        row.messageType === "videoMessage" ? "Vídeo" :
        row.messageType === "documentMessage" ? "Documento" :
        row.messageType === "stickerMessage" ? "Sticker" :
        row.messageType,
      value: Number(row.count) || 0,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [typeDistribution.data]);

  const handleRefresh = useCallback(() => {
    statusMetrics.refetch();
    volumeOverTime.refetch();
    deliveryRate.refetch();
    recentActivity.refetch();
    typeDistribution.refetch();
    topContacts.refetch();
    responseTime.refetch();
  }, [statusMetrics, volumeOverTime, deliveryRate, recentActivity, typeDistribution, topContacts, responseTime]);

  if (!user) return null;

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monitoramento de Mensagens</h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe o status de envio e recebimento em tempo real</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${isConnected ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isConnected ? "Conectado" : "Desconectado"}
              </div>
            </TooltipTrigger>
            <TooltipContent>Socket.IO {isConnected ? "ativo" : "inativo"} — atualizações em tempo real</TooltipContent>
          </Tooltip>

          {/* Session selector */}
          {sessions.length > 1 && (
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sessão" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s: any) => (
                  <SelectItem key={s.sessionId} value={s.sessionId}>{s.sessionId}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Period selector */}
          <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={handleRefresh} className="shrink-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Mensagens"
          value={formatNumber(metrics.total)}
          subtitle={`${periodDays === 1 ? "Hoje" : `Últimos ${periodDays} dias`}`}
          icon={<Activity className="h-5 w-5" />}
        />
        <MetricCard
          title="Enviadas"
          value={formatNumber(metrics.totalSent)}
          subtitle={`${metrics.totalDelivered} entregues`}
          icon={<Send className="h-5 w-5" />}
        />
        <MetricCard
          title="Recebidas"
          value={formatNumber(metrics.totalReceived)}
          icon={<MessageSquare className="h-5 w-5" />}
        />
        <MetricCard
          title="Tempo de Resposta"
          value={formatTime(responseTime.data?.avgResponseTimeSec)}
          subtitle="Média"
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="delivery" className="gap-1.5"><CheckCheck className="h-4 w-4" /> Entrega</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><Zap className="h-4 w-4" /> Atividade</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5"><Users className="h-4 w-4" /> Contatos</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Volume chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Volume de Mensagens</CardTitle>
              </CardHeader>
              <CardContent>
                {volumeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={volumeChartData}>
                      <defs>
                        <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradReceived" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Area type="monotone" dataKey="enviadas" stroke="#8b5cf6" fill="url(#gradSent)" strokeWidth={2} />
                      <Area type="monotone" dataKey="recebidas" stroke="#06b6d4" fill="url(#gradReceived)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados para o período</div>
                )}
              </CardContent>
            </Card>

            {/* Type distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Tipos de Mensagem</CardTitle>
              </CardHeader>
              <CardContent>
                {typeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={typeChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {typeChartData.map((entry: any, index: number) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Live events */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  Eventos em Tempo Real
                </CardTitle>
                <span className="text-xs text-muted-foreground">{liveEvents.length} eventos</span>
              </div>
            </CardHeader>
            <CardContent>
              {liveEvents.length > 0 ? (
                <div className="space-y-1 max-h-[250px] overflow-y-auto pr-1">
                  {liveEvents.slice(0, 20).map((evt, i) => (
                    <div key={`${evt.ts}-${i}`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors text-sm">
                      {evt.type === "message" ? (
                        <>
                          <div className={`shrink-0 rounded-full p-1.5 ${evt.data.fromMe ? "bg-violet-500/10 text-violet-500" : "bg-cyan-500/10 text-cyan-500"}`}>
                            {evt.data.fromMe ? <Send className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                          </div>
                          <span className="truncate flex-1">
                            {evt.data.fromMe ? "Enviada" : "Recebida"}: {evt.data.content?.substring(0, 60) || `[${evt.data.messageType}]`}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="shrink-0 rounded-full p-1.5 bg-blue-500/10 text-blue-500">
                            <CheckCheck className="h-3 w-3" />
                          </div>
                          <span className="truncate flex-1">
                            Status atualizado: <StatusBadge status={evt.data.status} />
                          </span>
                        </>
                      )}
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {fmtTimeWS(evt.ts)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Aguardando eventos...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Delivery Tab */}
        <TabsContent value="delivery" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Funil de Entrega</CardTitle>
              </CardHeader>
              <CardContent>
                <DeliveryFunnel data={deliveryRate.data} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Distribuição de Status</CardTitle>
              </CardHeader>
              <CardContent>
                {(statusMetrics.data || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={(statusMetrics.data || []).map((row: any) => ({
                      status: STATUS_CONFIG[row.statusGroup]?.label || row.statusGroup,
                      count: Number(row.count) || 0,
                      fill: STATUS_CONFIG[row.statusGroup]?.color || "#94a3b8",
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="status" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {(statusMetrics.data || []).map((row: any, i: number) => (
                          <Cell key={i} fill={STATUS_CONFIG[row.statusGroup]?.color || "#94a3b8"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Response time card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Tempo de Resposta</CardTitle>
            </CardHeader>
            <CardContent>
              {responseTime.data ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-lg bg-muted/30 p-4 text-center">
                    <p className="text-2xl font-bold">{formatTime(responseTime.data.avgResponseTimeSec)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Média</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-4 text-center">
                    <p className="text-2xl font-bold">{formatTime(responseTime.data.medianResponseTimeSec)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Mediana</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-4 text-center">
                    <p className="text-2xl font-bold">{formatTime(responseTime.data.minResponseTimeSec)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Mais Rápido</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-4 text-center">
                    <p className="text-2xl font-bold">{formatTime(responseTime.data.maxResponseTimeSec)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Mais Lento</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados de tempo de resposta</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Atividade Recente</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed data={recentActivity.data || []} isLoading={recentActivity.isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Contatos Mais Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              {(topContacts.data || []).length > 0 ? (
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/50">
                    <span>Contato</span>
                    <span className="text-right">Enviadas</span>
                    <span className="text-right">Recebidas</span>
                    <span className="text-right">Total</span>
                    <span className="text-right">Última Ativ.</span>
                  </div>
                  {(topContacts.data || []).map((contact: any, i: number) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {(contact.contactName || "?")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{contact.contactName || formatJid(contact.remoteJid)}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{formatJid(contact.remoteJid)}</p>
                        </div>
                      </div>
                      <span className="text-sm text-right font-medium text-violet-500">{formatNumber(Number(contact.sent))}</span>
                      <span className="text-sm text-right font-medium text-cyan-500">{formatNumber(Number(contact.received))}</span>
                      <span className="text-sm text-right font-bold">{formatNumber(Number(contact.totalMessages))}</span>
                      <span className="text-xs text-right text-muted-foreground">{timeAgo(contact.lastActivity)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados de contatos</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
