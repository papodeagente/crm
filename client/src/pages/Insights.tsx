import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Users, Briefcase, Trophy, TrendingUp, DollarSign, Target,
  Send, MessageSquare, CheckCheck, Check, Eye, Clock, AlertTriangle,
  Activity, BarChart3, Zap, ArrowUpRight, ArrowDownRight, RefreshCw,
  Wifi, WifiOff, MessageCircle, Image, Mic, FileText, Video, Sticker,
  PieChart as PieChartIcon, Inbox, Megaphone
} from "lucide-react";
import UTMDashboard from "./UTMDashboard";
import DateRangeFilter, { useDateFilter, getPresetDates } from "@/components/DateRangeFilter";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { formatTime as formatTimeOfDay, formatTimeWithSeconds, SYSTEM_TIMEZONE, SYSTEM_LOCALE } from "../../../shared/dateUtils";


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

function formatDuration(seconds: number | null): string {
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

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
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

// ─── CRM Dashboard ───
function CRMDashboard() {
  const { user } = useAuth();
  const dateFilter = useDateFilter("all");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const teamMembers = trpc.rdStation.listTeamMembers.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const isAdmin = (user as any)?.role === "admin";

  const userIdNum = selectedUserId !== "all" ? Number(selectedUserId) : undefined;
  const insightsInput = (dateFilter.dates.dateFrom || dateFilter.dates.dateTo || userIdNum)
    ? { dateFrom: dateFilter.dates.dateFrom, dateTo: dateFilter.dates.dateTo, userId: userIdNum }
    : undefined;
  const dashboard = trpc.insights.dashboard.useQuery(insightsInput, { staleTime: 30000 });
  const homeData = trpc.dashboard.metrics.useQuery({ dateFrom: dateFilter.dates.dateFrom, dateTo: dateFilter.dates.dateTo, userId: userIdNum }, { refetchInterval: 60000, staleTime: 30000, refetchIntervalInBackground: false });
  const pipelineSummary = trpc.dashboard.pipelineSummary.useQuery({ dateFrom: dateFilter.dates.dateFrom, dateTo: dateFilter.dates.dateTo, userId: userIdNum }, { refetchInterval: 60000, staleTime: 30000, refetchIntervalInBackground: false });
  const d = dashboard.data;
  const h = homeData.data;

  const metrics = [
    { label: "Passageiros", value: d?.totalContacts ?? 0, icon: Users, bg: "bg-blue-50 dark:bg-blue-500/10", iconColor: "text-blue-600 dark:text-blue-400" },
    { label: "Em andamento", value: d?.openDeals ?? 0, icon: Briefcase, bg: "bg-amber-50 dark:bg-amber-500/10", iconColor: "text-amber-600 dark:text-amber-400" },
    { label: "Negócios Ganhos", value: d?.wonDeals ?? 0, icon: Trophy, bg: "bg-emerald-50 dark:bg-emerald-500/10", iconColor: "text-emerald-600 dark:text-emerald-400" },
    { label: "Conversas Abertas", value: d?.openConversations ?? 0, icon: Inbox, bg: "bg-violet-50 dark:bg-violet-500/10", iconColor: "text-violet-600 dark:text-violet-400" },
  ];

  // Pipeline stages chart data
  const pipelineChartData = useMemo(() => {
    return (pipelineSummary.data || []).map((s: any) => ({
      name: s.stageName,
      deals: Number(s.dealCount) || 0,
      valor: Number(s.totalValueCents) / 100 || 0,
    }));
  }, [pipelineSummary.data]);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <DateRangeFilter
          preset={dateFilter.preset}
          onPresetChange={dateFilter.setPreset}
          customFrom={dateFilter.customFrom}
          onCustomFromChange={dateFilter.setCustomFrom}
          customTo={dateFilter.customTo}
          onCustomToChange={dateFilter.setCustomTo}
          onReset={dateFilter.reset}
        />

        {isAdmin && (teamMembers.data || []).length > 0 && (
          <SearchableCombobox
            options={[
              { value: "all", label: "Todos os usuários" },
              ...(teamMembers.data || []).map((m: any) => ({ value: String(m.id), label: m.name })),
            ]}
            value={selectedUserId}
            onValueChange={setSelectedUserId}
            placeholder="Usuário"
            searchPlaceholder="Buscar usuário..."
            className="h-8 w-auto min-w-[160px] text-xs"
          />
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label} className="border border-border/40 shadow-none rounded-xl hover:shadow-md transition-shadow">
            <div className="p-5 flex items-center gap-4">
              <div className={`h-11 w-11 rounded-xl ${m.bg} flex items-center justify-center shrink-0`}>
                <m.icon className={`h-5 w-5 ${m.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{dashboard.isLoading ? "—" : m.value}</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mt-0.5">{m.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pipeline value */}
        <Card className="border border-border/40 shadow-none rounded-xl">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[14px] font-semibold">Valor Total do Pipeline</p>
                <p className="text-[12px] text-muted-foreground">Soma de todos os negócios abertos</p>
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight">
              {dashboard.isLoading ? "—" : formatCurrency(d?.pipelineValueCents ?? 0)}
            </p>
          </div>
        </Card>

        {/* Home dashboard metrics */}
        <Card className="border border-border/40 shadow-none rounded-xl">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-[14px] font-semibold">Resumo do Período</p>
                <p className="text-[12px] text-muted-foreground">Variação em relação ao período anterior equivalente</p>
              </div>
            </div>
            {h ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Negócios</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl font-bold">{h.activeDeals}</span>
                    {h.activeDealsChange !== 0 && (
                      <span className={`text-xs flex items-center ${h.activeDealsChange > 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {h.activeDealsChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {h.activeDealsChange > 0 ? "+" : ""}{h.activeDealsChange}%
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Contatos</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl font-bold">{h.totalContacts}</span>
                    {h.totalContactsChange !== 0 && (
                      <span className={`text-xs flex items-center ${h.totalContactsChange > 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {h.totalContactsChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {h.totalContactsChange > 0 ? "+" : ""}{h.totalContactsChange}%
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Viagens</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl font-bold">{h.activeTrips}</span>
                    {h.activeTripsChange !== 0 && (
                      <span className={`text-xs flex items-center ${h.activeTripsChange > 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {h.activeTripsChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {h.activeTripsChange > 0 ? "+" : ""}{h.activeTripsChange}%
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Tarefas Pendentes</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl font-bold">{h.pendingTasks}</span>
                    {h.pendingTasksChange !== 0 && (
                      <span className={`text-xs flex items-center ${h.pendingTasksChange > 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {h.pendingTasksChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {h.pendingTasksChange > 0 ? "+" : ""}{h.pendingTasksChange}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
            )}
          </div>
        </Card>
      </div>

      {/* Pipeline stages chart */}
      {pipelineChartData.length > 0 && (
        <Card className="border border-border/40 shadow-none rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Negócios por Etapa do Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={pipelineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                  formatter={(value: any, name: string) => [name === "valor" ? formatCurrency(value * 100) : value, name === "valor" ? "Valor" : "Negócios"]}
                />
                <Bar dataKey="deals" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Negócios" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Messages Dashboard ───
function MessagesDashboard() {
  const { user } = useAuth();
  const { lastMessage, lastStatusUpdate, isConnected } = useSocket();
  const dateFilter = useDateFilter("last7");
  const [selectedMsgUserId, setSelectedMsgUserId] = useState<string>("all");
  const teamMembersMsg = trpc.rdStation.listTeamMembers.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const isAdminMsg = (user as any)?.role === "admin";
  const periodDays = useMemo(() => {
    if (dateFilter.preset === "all") return 365;
    if (dateFilter.preset === "custom") {
      if (dateFilter.customFrom && dateFilter.customTo) {
        const diff = Math.ceil((new Date(dateFilter.customTo).getTime() - new Date(dateFilter.customFrom).getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(1, diff);
      }
      return 30;
    }
    const presetMap: Record<string, number> = { last7: 7, last30: 30, last3months: 90, last6months: 180, thisYear: 365, lastYear: 365, lastMonth: 30 };
    return presetMap[dateFilter.preset] || 30;
  }, [dateFilter.preset, dateFilter.customFrom, dateFilter.customTo]);
  const [msgTab, setMsgTab] = useState("overview");
  const [liveEvents, setLiveEvents] = useState<Array<{ type: string; data: any; ts: number }>>([]);

  // Admin can see all tenant sessions; non-admin sees only their own
  const allTenantSessions = trpc.whatsapp.tenantSessions.useQuery(undefined, { enabled: !!user && isAdminMsg, staleTime: 60000 });
  const ownSessions = trpc.whatsapp.sessions.useQuery(undefined, { enabled: !!user, staleTime: 60000 });
  const sessions = useMemo(() => {
    if (isAdminMsg && selectedMsgUserId !== "all" && allTenantSessions.data) {
      return allTenantSessions.data.filter((s: any) => String(s.userId) === selectedMsgUserId);
    }
    if (isAdminMsg && selectedMsgUserId === "all" && allTenantSessions.data) {
      return allTenantSessions.data;
    }
    return ownSessions.data || [];
  }, [isAdminMsg, selectedMsgUserId, allTenantSessions.data, ownSessions.data]);
  const [selectedSession, setSelectedSession] = useState("");

  useEffect(() => {
    if (sessions.length > 0 && !selectedSession) {
      setSelectedSession(sessions[0].sessionId);
    }
  }, [sessions, selectedSession]);

  // When user filter changes, auto-select first session of that user
  useEffect(() => {
    if (sessions.length > 0) {
      setSelectedSession(sessions[0].sessionId);
    } else {
      setSelectedSession("");
    }
  }, [selectedMsgUserId]);

  const queryEnabled = !!selectedSession && !!user;

  const dateFrom = dateFilter.dates.dateFrom;
  const dateTo = dateFilter.dates.dateTo;

  const statusMetrics = trpc.monitoring.statusMetrics.useQuery(
    { sessionId: selectedSession, periodDays, dateFrom, dateTo },
    { enabled: queryEnabled, refetchInterval: 60000, staleTime: 30000, refetchIntervalInBackground: false }
  );
  const volumeOverTime = trpc.monitoring.volumeOverTime.useQuery(
    { sessionId: selectedSession, periodDays, granularity: periodDays <= 2 ? "hour" : "day", dateFrom, dateTo },
    { enabled: queryEnabled, refetchInterval: 60000, staleTime: 30000, refetchIntervalInBackground: false }
  );
  const deliveryRate = trpc.monitoring.deliveryRate.useQuery(
    { sessionId: selectedSession, periodDays, dateFrom, dateTo },
    { enabled: queryEnabled, refetchInterval: 60000, staleTime: 30000, refetchIntervalInBackground: false }
  );
  const recentActivity = trpc.monitoring.recentActivity.useQuery(
    { sessionId: selectedSession, limit: 50 },
    { enabled: queryEnabled, refetchInterval: 30000, staleTime: 15000, refetchIntervalInBackground: false }
  );
  const typeDistribution = trpc.monitoring.typeDistribution.useQuery(
    { sessionId: selectedSession, periodDays, dateFrom, dateTo },
    { enabled: queryEnabled, refetchInterval: 120000, staleTime: 60000, refetchIntervalInBackground: false }
  );
  const topContacts = trpc.monitoring.topContacts.useQuery(
    { sessionId: selectedSession, periodDays, limit: 10, dateFrom, dateTo },
    { enabled: queryEnabled, refetchInterval: 120000, staleTime: 60000, refetchIntervalInBackground: false }
  );
  const responseTime = trpc.monitoring.responseTime.useQuery(
    { sessionId: selectedSession, periodDays, dateFrom, dateTo },
    { enabled: queryEnabled, refetchInterval: 120000, staleTime: 60000, refetchIntervalInBackground: false }
  );

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

  const volumeChartData = useMemo(() => {
    return (volumeOverTime.data || []).map((row: any) => ({
      time: periodDays <= 2
        ? formatTimeOfDay(row.timeBucket)
        : new Date(row.timeBucket + "T00:00:00").toLocaleDateString(SYSTEM_LOCALE, { day: "2-digit", month: "2-digit", timeZone: SYSTEM_TIMEZONE }),
      enviadas: Number(row.sent) || 0,
      recebidas: Number(row.received) || 0,
    }));
  }, [volumeOverTime.data, periodDays]);

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

  return (
    <div className="space-y-5">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${isConnected ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
              {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isConnected ? "Conectado" : "Desconectado"}
            </div>
          </TooltipTrigger>
          <TooltipContent>Socket.IO {isConnected ? "ativo" : "inativo"} — atualizações em tempo real</TooltipContent>
        </Tooltip>

        {isAdminMsg && (teamMembersMsg.data || []).length > 0 && (
          <SearchableCombobox
            options={[
              { value: "all", label: "Todos os usuários" },
              ...(teamMembersMsg.data || []).map((m: any) => ({ value: String(m.id), label: m.name })),
            ]}
            value={selectedMsgUserId}
            onValueChange={setSelectedMsgUserId}
            placeholder="Usuário"
            searchPlaceholder="Buscar usuário..."
            className="h-8 w-auto min-w-[160px] text-xs"
          />
        )}

        {sessions.length > 1 && (
          <SearchableCombobox
            options={sessions.map((s: any) => ({
              value: s.sessionId,
              label: s.ownerName ? `${s.ownerName} (${s.sessionId})` : s.sessionId,
            }))}
            value={selectedSession}
            onValueChange={setSelectedSession}
            placeholder="Sessão"
            searchPlaceholder="Buscar sessão..."
            className="w-[180px] h-8 text-xs"
          />
        )}

        <DateRangeFilter
          preset={dateFilter.preset}
          onPresetChange={dateFilter.setPreset}
          customFrom={dateFilter.customFrom}
          onCustomFromChange={dateFilter.setCustomFrom}
          customTo={dateFilter.customTo}
          onCustomToChange={dateFilter.setCustomTo}
          onReset={dateFilter.reset}
        />

        <Button variant="outline" size="sm" onClick={handleRefresh} className="h-8 w-8 p-0">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total de Mensagens</p>
                <p className="text-2xl font-bold tracking-tight">{formatNumber(metrics.total)}</p>
                <p className="text-xs text-muted-foreground">{periodDays === 1 ? "Hoje" : `Últimos ${periodDays} dias`}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Activity className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Enviadas</p>
                <p className="text-2xl font-bold tracking-tight">{formatNumber(metrics.totalSent)}</p>
                <p className="text-xs text-muted-foreground">{metrics.totalDelivered} entregues</p>
              </div>
              <div className="rounded-lg bg-violet-500/10 p-2.5 text-violet-500"><Send className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recebidas</p>
                <p className="text-2xl font-bold tracking-tight">{formatNumber(metrics.totalReceived)}</p>
              </div>
              <div className="rounded-lg bg-cyan-500/10 p-2.5 text-cyan-500"><MessageSquare className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tempo de Resposta</p>
                <p className="text-2xl font-bold tracking-tight">{formatDuration(responseTime.data?.avgResponseTimeSec)}</p>
                <p className="text-xs text-muted-foreground">Média</p>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-500"><Clock className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-tabs for messages */}
      <Tabs value={msgTab} onValueChange={setMsgTab}>
        <TabsList className="h-9">
          <TabsTrigger value="overview" className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" /> Volume</TabsTrigger>
          <TabsTrigger value="delivery" className="gap-1.5 text-xs"><CheckCheck className="h-3.5 w-3.5" /> Entrega</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5 text-xs"><Zap className="h-3.5 w-3.5" /> Atividade</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Contatos</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Volume de Mensagens</CardTitle>
              </CardHeader>
              <CardContent>
                {volumeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={volumeChartData}>
                      <defs>
                        <linearGradient id="gradSent2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradReceived2" x1="0" y1="0" x2="0" y2="1">
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
                      <Area type="monotone" dataKey="enviadas" stroke="#8b5cf6" fill="url(#gradSent2)" strokeWidth={2} />
                      <Area type="monotone" dataKey="recebidas" stroke="#06b6d4" fill="url(#gradReceived2)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados para o período</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Tipos de Mensagem</CardTitle>
              </CardHeader>
              <CardContent>
                {typeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={typeChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                        {typeChartData.map((entry: any, index: number) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
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
                        {formatTimeWithSeconds(evt.ts)}
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

        {/* Delivery */}
        <TabsContent value="delivery" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Funil de Entrega</CardTitle>
              </CardHeader>
              <CardContent>
                {deliveryRate.data ? (() => {
                  const total = Number(deliveryRate.data.totalSent) || 0;
                  if (total === 0) return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem enviada no período</p>;
                  const delivered = Number(deliveryRate.data.delivered) || 0;
                  const readCount = Number(deliveryRate.data.readCount) || 0;
                  const played = Number(deliveryRate.data.played) || 0;
                  const failed = Number(deliveryRate.data.failed) || 0;
                  const pending = Number(deliveryRate.data.pending) || 0;
                  const deliveryPct = ((delivered / total) * 100).toFixed(1);
                  const readPct = ((readCount / total) * 100).toFixed(1);

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
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-3 pt-2">
                        <div className="flex-1 rounded-lg bg-blue-500/10 p-3 text-center">
                          <p className="text-lg font-bold text-blue-500">{deliveryPct}%</p>
                          <p className="text-[11px] text-muted-foreground">Taxa de Entrega</p>
                        </div>
                        <div className="flex-1 rounded-lg bg-emerald-500/10 p-3 text-center">
                          <p className="text-lg font-bold text-emerald-500">{readPct}%</p>
                          <p className="text-[11px] text-muted-foreground">Taxa de Leitura</p>
                        </div>
                      </div>
                    </div>
                  );
                })() : <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Carregando...</div>}
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
                      <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
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

          {/* Response time */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Tempo de Resposta</CardTitle>
            </CardHeader>
            <CardContent>
              {responseTime.data ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-lg bg-muted/30 p-4 text-center">
                    <p className="text-2xl font-bold">{formatDuration(responseTime.data.avgResponseTimeSec)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Média</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-4 text-center">
                    <p className="text-2xl font-bold">{formatDuration(responseTime.data.medianResponseTimeSec)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Mediana</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-4 text-center">
                    <p className="text-2xl font-bold">{formatDuration(responseTime.data.minResponseTimeSec)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Mais Rápido</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-4 text-center">
                    <p className="text-2xl font-bold">{formatDuration(responseTime.data.maxResponseTimeSec)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Mais Lento</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados de tempo de resposta</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Atividade Recente</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.isLoading ? (
                <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted/30 animate-pulse" />)}</div>
              ) : (recentActivity.data || []).length > 0 ? (
                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                  {(recentActivity.data || []).slice(0, 30).map((msg: any) => (
                    <div key={msg.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className={`shrink-0 rounded-full p-1.5 ${msg.fromMe ? "bg-violet-500/10 text-violet-500" : "bg-cyan-500/10 text-cyan-500"}`}>
                        {msg.fromMe ? <Send className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{msg.pushName || formatJid(msg.remoteJid)}</span>
                          <StatusBadge status={msg.fromMe ? (msg.status || "sent") : "received"} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {msg.content ? msg.content.substring(0, 80) : `[${msg.messageType}]`}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(msg.timestamp)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade recente</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts */}
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

// ─── Main Page ───
export default function Insights() {
  const [mainTab, setMainTab] = useState("crm");

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Análises</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Métricas e análises do seu CRM e mensagens WhatsApp.</p>
      </div>

      {/* Main tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="crm" className="gap-1.5">
            <Briefcase className="h-4 w-4" /> CRM
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5">
            <MessageSquare className="h-4 w-4" /> Mensagens WhatsApp
          </TabsTrigger>
          <TabsTrigger value="utm" className="gap-1.5">
            <Megaphone className="h-4 w-4" /> Vendas por UTM
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crm" className="mt-5">
          <CRMDashboard />
        </TabsContent>

        <TabsContent value="messages" className="mt-5">
          <MessagesDashboard />
        </TabsContent>

        <TabsContent value="utm" className="mt-5">
          <UTMDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
