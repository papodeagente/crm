import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Users, MessageSquare, Clock, Loader2, Search,
  ChevronDown, ChevronUp, Phone, AlertCircle, Timer,
  ArrowRightLeft, UserCheck, CircleDot, Headphones,
  Inbox, UserPlus, RotateCcw, Eye, Activity,
} from "lucide-react";

/* ─── Types ─── */
interface AgentData {
  agentId: number;
  agentName: string;
  agentEmail: string;
  agentAvatar?: string;
  agentStatus: string;
  isOnline: number;
  lastActiveAt?: string;
  activeConversations: number;
  unreadConversations: number;
  oldestConversation?: number;
  newestConversation?: number;
}

interface QueueItem {
  remoteJid: string;
  contactPushName?: string;
  contactName?: string;
  lastMessage?: string;
  lastMessageAt?: number;
  unreadCount?: number;
  waitingSince?: number;
}

interface AgentConv {
  conversationId: number;
  remoteJid: string;
  contactPushName?: string;
  contactName?: string;
  lastMessage?: string;
  lastTimestamp?: number;
  unreadCount?: number;
  conversationStatus?: string;
}

export default function Supervision() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [, setLocation] = useLocation();
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [assigningJid, setAssigningJid] = useState<string | null>(null);
  const [selectedAgentForAssign, setSelectedAgentForAssign] = useState<number | null>(null);

  // Get sessions
  const sessionsQ = trpc.whatsapp.sessions.useQuery();
  const sessions = (sessionsQ.data as any[] || []);
  const onlineSessions = sessions.filter((s: any) => s.status === "open" || s.status === "connected");
  const activeSessionId = selectedSession || onlineSessions[0]?.sessionId || "";

  // Get agent workload
  const workloadQ = trpc.whatsapp.supervision.agentWorkload.useQuery(
    { sessionId: activeSessionId },
    { enabled: !!activeSessionId, refetchInterval: 10000, staleTime: 5000, refetchIntervalInBackground: false }
  );

  // Get queue stats with items
  const queueQ = trpc.whatsapp.supervision.queueStats.useQuery(
    { sessionId: activeSessionId },
    { enabled: !!activeSessionId, refetchInterval: 10000, staleTime: 5000, refetchIntervalInBackground: false }
  );

  // Get agent conversations when expanded
  const agentConvsQ = trpc.whatsapp.supervision.agentConversations.useQuery(
    { sessionId: activeSessionId, agentId: expandedAgent || 0, limit: 30 },
    { enabled: !!activeSessionId && !!expandedAgent, refetchInterval: 15000, staleTime: 10000, refetchIntervalInBackground: false }
  );

  // Mutations
  const assignToAgentMut = trpc.whatsapp.supervision.assignToAgent.useMutation({
    onSuccess: () => {
      toast.success("Conversa atribuída com sucesso");
      workloadQ.refetch();
      queueQ.refetch();
      setAssigningJid(null);
      setSelectedAgentForAssign(null);
    },
    onError: (e) => toast.error(e.message || "Erro ao atribuir"),
  });

  const returnToQueueMut = trpc.whatsapp.supervision.returnToQueue.useMutation({
    onSuccess: () => {
      toast.success("Conversa devolvida à fila");
      workloadQ.refetch();
      queueQ.refetch();
      if (expandedAgent) agentConvsQ.refetch();
    },
    onError: (e) => toast.error(e.message || "Erro ao devolver"),
  });

  const agents = (workloadQ.data || []) as AgentData[];
  const queueStats = queueQ.data as { total: number; oldest: any; items: QueueItem[] } | undefined;
  const queueItems = queueStats?.items || [];

  const filteredAgents = useMemo(() => {
    if (!search) return agents;
    return agents.filter((a) =>
      a.agentName?.toLowerCase().includes(search.toLowerCase()) ||
      a.agentEmail?.toLowerCase().includes(search.toLowerCase())
    );
  }, [agents, search]);

  const totalActive = agents.reduce((sum, a) => sum + Number(a.activeConversations || 0), 0);
  const totalUnread = agents.reduce((sum, a) => sum + Number(a.unreadConversations || 0), 0);
  const onlineAgents = agents.filter((a) => Number(a.isOnline) === 1).length;
  const avgPerAgent = agents.length > 0 ? (totalActive / agents.length).toFixed(1) : "0";

  // Oldest wait time
  const oldestWait = queueStats?.oldest ? formatWaitTime(new Date(queueStats.oldest).getTime()) : "—";

  const handleAssign = useCallback((remoteJid: string, agentId: number) => {
    assignToAgentMut.mutate({ sessionId: activeSessionId, remoteJid, agentId });
  }, [activeSessionId, assignToAgentMut]);

  const handleReturnToQueue = useCallback((remoteJid: string) => {
    returnToQueueMut.mutate({ sessionId: activeSessionId, remoteJid });
  }, [activeSessionId, returnToQueueMut]);

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          O painel de supervisão é exclusivo para administradores.
        </p>
        <button
          onClick={() => setLocation("/inbox")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Voltar ao Inbox
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* ─── Header ─── */}
      <div className="border-b border-border bg-card/50 px-4 md:px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Supervisão</h1>
              <p className="text-[12px] text-muted-foreground flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Atualiza a cada 10s
              </p>
            </div>
          </div>

          {/* Session selector */}
          {onlineSessions.length > 1 && (
            <select
              value={activeSessionId}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-[13px] text-foreground outline-none"
            >
              {onlineSessions.map((s: any) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {s.instanceName || s.sessionId}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ─── KPI Cards ─── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            icon={<Users className="w-5 h-5" />}
            label="Atendentes Online"
            value={`${onlineAgents}`}
            sub={`de ${agents.length} total`}
            color="emerald"
          />
          <KpiCard
            icon={<MessageSquare className="w-5 h-5" />}
            label="Em Atendimento"
            value={`${totalActive}`}
            sub={`${totalUnread} não lidos`}
            color="blue"
          />
          <KpiCard
            icon={<Inbox className="w-5 h-5" />}
            label="Na Fila"
            value={`${queueStats?.total || 0}`}
            sub={queueItems.length > 0 ? `Mais antigo: ${oldestWait}` : "Fila vazia"}
            color="amber"
            highlight={Number(queueStats?.total || 0) > 5}
          />
          <KpiCard
            icon={<Clock className="w-5 h-5" />}
            label="Tempo Espera"
            value={oldestWait}
            sub="Mais antigo na fila"
            color="red"
            highlight={Number(queueStats?.total || 0) > 0}
          />
          <KpiCard
            icon={<ArrowRightLeft className="w-5 h-5" />}
            label="Média/Agente"
            value={avgPerAgent}
            sub="conversas ativas"
            color="violet"
          />
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 h-full">
          {/* ─── Left: Agents Panel (3/5) ─── */}
          <div className="lg:col-span-3 border-r border-border overflow-auto">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-500" />
                  Atendentes ({agents.length})
                </h2>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="pl-8 pr-3 py-1.5 bg-muted/50 border border-border rounded-lg text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-blue-400 w-40"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2">
              {workloadQ.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-[14px]">
                  {search ? "Nenhum agente encontrado" : "Nenhum agente cadastrado"}
                </div>
              ) : (
                filteredAgents.map((agent) => (
                  <AgentCard
                    key={agent.agentId}
                    agent={agent}
                    isExpanded={expandedAgent === agent.agentId}
                    onToggle={() => setExpandedAgent(expandedAgent === agent.agentId ? null : agent.agentId)}
                    conversations={expandedAgent === agent.agentId ? (agentConvsQ.data as AgentConv[] || []) : []}
                    isLoadingConvs={expandedAgent === agent.agentId && agentConvsQ.isLoading}
                    avgTickets={agents.length > 0 ? totalActive / agents.length : 0}
                    sessionId={activeSessionId}
                    onReturnToQueue={handleReturnToQueue}
                    isReturning={returnToQueueMut.isPending}
                  />
                ))
              )}
            </div>
          </div>

          {/* ─── Right: Queue Panel (2/5) ─── */}
          <div className="lg:col-span-2 overflow-auto">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
              <h2 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                <Inbox className="w-4 h-4 text-amber-500" />
                Fila de Espera
                {Number(queueStats?.total || 0) > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-500 text-white animate-pulse">
                    {queueStats?.total}
                  </span>
                )}
              </h2>
            </div>

            <div className="p-4">
              {queueQ.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : queueItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                    <UserCheck className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-[15px] font-medium text-foreground">Fila vazia</p>
                  <p className="text-[12px] text-muted-foreground mt-1">Todos os clientes estão sendo atendidos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {queueItems.map((item) => {
                    const name = item.contactName || item.contactPushName || item.remoteJid?.split("@")[0] || "Desconhecido";
                    const waitTime = item.waitingSince ? formatWaitTime(new Date(item.waitingSince).getTime()) : null;
                    const isAssigning = assigningJid === item.remoteJid;

                    return (
                      <div key={item.remoteJid} className="bg-card border border-border rounded-xl p-3 hover:border-amber-400/40 transition-all group">
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Phone className="w-4 h-4 text-amber-600" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-foreground truncate">{name}</p>
                            {item.lastMessage && (
                              <p className="text-[12px] text-muted-foreground truncate mt-0.5">{item.lastMessage}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              {waitTime && (
                                <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                                  <Timer className="w-3 h-3" />
                                  {waitTime}
                                </span>
                              )}
                              {item.unreadCount && Number(item.unreadCount) > 0 && (
                                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold">
                                  {item.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                          {!isAssigning ? (
                            <>
                              <button
                                onClick={() => setAssigningJid(item.remoteJid)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 text-[12px] font-medium rounded-lg hover:bg-blue-500/20 transition-colors"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                Atribuir
                              </button>
                              <button
                                onClick={() => setLocation(`/inbox?jid=${item.remoteJid}`)}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-muted/50 text-muted-foreground text-[12px] font-medium rounded-lg hover:bg-muted transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Ver
                              </button>
                            </>
                          ) : (
                            /* Agent selection for assignment */
                            <div className="flex-1 flex items-center gap-2">
                              <select
                                value={selectedAgentForAssign || ""}
                                onChange={(e) => setSelectedAgentForAssign(Number(e.target.value))}
                                className="flex-1 px-2 py-1.5 bg-muted/50 border border-border rounded-lg text-[12px] text-foreground outline-none"
                              >
                                <option value="">Selecionar agente...</option>
                                {agents.map((a) => (
                                  <option key={a.agentId} value={a.agentId}>
                                    {a.agentName} ({a.activeConversations} ativos)
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => {
                                  if (selectedAgentForAssign) {
                                    handleAssign(item.remoteJid, selectedAgentForAssign);
                                  }
                                }}
                                disabled={!selectedAgentForAssign || assignToAgentMut.isPending}
                                className="px-3 py-1.5 bg-blue-500 text-white text-[12px] font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                              >
                                {assignToAgentMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "OK"}
                              </button>
                              <button
                                onClick={() => { setAssigningJid(null); setSelectedAgentForAssign(null); }}
                                className="px-2 py-1.5 text-muted-foreground text-[12px] rounded-lg hover:bg-muted transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── KPI Card ─── */
function KpiCard({ icon, label, value, sub, color, highlight }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string; highlight?: boolean;
}) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/20" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/20" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/20" },
    red: { bg: "bg-red-500/10", text: "text-red-600", border: "border-red-500/20" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-600", border: "border-violet-500/20" },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`bg-card border rounded-xl p-3 transition-all ${highlight ? `${c.border} border-2 shadow-sm` : "border-border"}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.bg} ${c.text}`}>
          {icon}
        </div>
        <span className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

/* ─── Agent Card ─── */
function AgentCard({
  agent, isExpanded, onToggle, conversations, isLoadingConvs, avgTickets, sessionId, onReturnToQueue, isReturning,
}: {
  agent: AgentData; isExpanded: boolean; onToggle: () => void;
  conversations: AgentConv[]; isLoadingConvs: boolean; avgTickets: number;
  sessionId: string; onReturnToQueue: (jid: string) => void; isReturning: boolean;
}) {
  const initials = agent.agentName?.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase() || "?";
  const isOnline = Number(agent.isOnline) === 1;
  const active = Number(agent.activeConversations || 0);
  const unread = Number(agent.unreadConversations || 0);
  // Only show overloaded when agent has significantly more than average AND at least 10 active
  const isOverloaded = active >= 10 && avgTickets > 0 && active > avgTickets * 2;

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-all ${
      isOverloaded ? "border-amber-400/50 shadow-sm shadow-amber-500/5" : "border-border"
    }`}>
      {/* Agent header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        {/* Avatar with status */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {agent.agentAvatar ? (
              <img src={agent.agentAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[13px] font-bold text-muted-foreground">{initials}</span>
            )}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${
            isOnline ? "bg-green-500" : "bg-gray-400"
          }`} />
        </div>

        {/* Name + status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-semibold text-foreground truncate">{agent.agentName}</p>
            {isOverloaded && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium shrink-0">
                Sobrecarregado
              </span>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground truncate">{agent.agentEmail}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center">
            <p className="text-[20px] font-bold text-foreground leading-none">{active}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">ativos</p>
          </div>
          {unread > 0 && (
            <div className="text-center">
              <p className="text-[16px] font-bold text-red-500 leading-none">{unread}</p>
              <p className="text-[10px] text-red-400 mt-0.5">não lidos</p>
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded: conversations list */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/10 px-4 py-3">
          {isLoadingConvs ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-center text-[13px] text-muted-foreground py-4">
              Nenhuma conversa ativa
            </p>
          ) : (
            <div className="space-y-1.5">
              {conversations.map((conv) => {
                const name = conv.contactName || conv.contactPushName || conv.remoteJid?.split("@")[0] || "Desconhecido";
                return (
                  <div key={conv.conversationId || conv.remoteJid} className="flex items-center gap-3 px-3 py-2 bg-card rounded-lg border border-border/50 group/conv">
                    <CircleDot className={`w-3 h-3 shrink-0 ${
                      conv.conversationStatus === "open" ? "text-green-500" :
                      conv.conversationStatus === "pending" ? "text-amber-500" : "text-gray-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {conv.lastMessage || "Sem mensagens"}
                      </p>
                    </div>
                    {conv.unreadCount && Number(conv.unreadCount) > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {conv.lastTimestamp ? formatRelativeTime(new Date(conv.lastTimestamp).getTime()) : ""}
                    </span>
                    {/* Return to queue button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onReturnToQueue(conv.remoteJid); }}
                      disabled={isReturning}
                      title="Devolver à fila"
                      className="opacity-0 group-hover/conv:opacity-100 transition-opacity p-1 rounded hover:bg-amber-500/10 text-amber-600"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Utilities ─── */
function formatWaitTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "< 1min";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}h${mins}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
