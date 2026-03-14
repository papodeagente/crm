import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { useLocation } from "wouter";
import {
  Users, MessageSquare, Clock, ArrowRightLeft, Loader2,
  ChevronDown, ChevronUp, Phone, Search, BarChart3,
  CircleDot, AlertCircle, CheckCircle2, Timer,
} from "lucide-react";

interface AgentData {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string;
  status: string;
  openTickets: number;
  conversations?: any[];
}

interface QueueItem {
  remoteJid: string;
  contactName?: string;
  lastMessageAt?: number;
  waitingSince?: number;
}

export default function Supervision() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [, setLocation] = useLocation();
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [selectedSession, setSelectedSession] = useState<string>("");

  // Get sessions
  const sessionsQ = trpc.whatsapp.sessions.useQuery();
  const sessions = (sessionsQ.data as any[] || []);
  const onlineSessions = sessions.filter((s: any) => s.status === "open" || s.status === "connected");

  // Auto-select first online session
  const activeSessionId = selectedSession || onlineSessions[0]?.sessionId || "";

  // Get agent workload
  const workloadQ = trpc.whatsapp.supervision.agentWorkload.useQuery(
    { sessionId: activeSessionId },
    { enabled: !!activeSessionId, refetchInterval: 15000 }
  );

  // Get queue stats
  const queueQ = trpc.whatsapp.supervision.queueStats.useQuery(
    { sessionId: activeSessionId },
    { enabled: !!activeSessionId, refetchInterval: 15000 }
  );

  // Get agent conversations when expanded
  const agentConvsQ = trpc.whatsapp.supervision.agentConversations.useQuery(
    { sessionId: activeSessionId, agentId: expandedAgent || 0, limit: 20 },
    { enabled: !!activeSessionId && !!expandedAgent }
  );

  const agents = (workloadQ.data as AgentData[] || []);
  const queueStats = queueQ.data as { total: number; items: QueueItem[] } | undefined;

  const filteredAgents = useMemo(() => {
    if (!search) return agents;
    return agents.filter((a: AgentData) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email?.toLowerCase().includes(search.toLowerCase())
    );
  }, [agents, search]);

  const totalOpenTickets = agents.reduce((sum: number, a: AgentData) => sum + (a.openTickets || 0), 0);
  const onlineAgents = agents.filter((a: AgentData) => a.status === "online").length;

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
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Painel de Supervisão</h1>
              <p className="text-[12px] text-muted-foreground">Monitore agentes, fila e atendimentos em tempo real</p>
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

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label="Agentes Online"
            value={`${onlineAgents}/${agents.length}`}
            color="green"
          />
          <StatCard
            icon={<MessageSquare className="w-4 h-4" />}
            label="Chamados Abertos"
            value={totalOpenTickets.toString()}
            color="blue"
          />
          <StatCard
            icon={<Clock className="w-4 h-4" />}
            label="Na Fila"
            value={(queueStats?.total || 0).toString()}
            color="amber"
          />
          <StatCard
            icon={<ArrowRightLeft className="w-4 h-4" />}
            label="Média por Agente"
            value={agents.length > 0 ? (totalOpenTickets / agents.length).toFixed(1) : "0"}
            color="purple"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agents panel - 2/3 */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                Agentes ({agents.length})
              </h2>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar agente..."
                  className="pl-8 pr-3 py-1.5 bg-muted/50 border border-border rounded-lg text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-blue-400 w-48"
                />
              </div>
            </div>

            {workloadQ.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-[14px]">
                {search ? "Nenhum agente encontrado" : "Nenhum agente cadastrado"}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAgents.map((agent: AgentData) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isExpanded={expandedAgent === agent.id}
                    onToggle={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                    conversations={expandedAgent === agent.id ? (agentConvsQ.data as any[] || []) : []}
                    isLoadingConvs={expandedAgent === agent.id && agentConvsQ.isLoading}
                    avgTickets={agents.length > 0 ? totalOpenTickets / agents.length : 0}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Queue panel - 1/3 */}
          <div>
            <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Fila de Espera ({queueStats?.total || 0})
            </h2>

            {queueQ.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !queueStats?.items?.length ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-[14px] font-medium text-foreground">Fila vazia</p>
                <p className="text-[12px] text-muted-foreground mt-1">Todos os clientes estão sendo atendidos</p>
              </div>
            ) : (
              <div className="space-y-2">
                {queueStats.items.map((item: QueueItem, i: number) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-3 hover:border-amber-400/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">
                          {item.contactName || item.remoteJid?.split("@")[0] || "Desconhecido"}
                        </p>
                        {item.waitingSince && (
                          <p className="text-[11px] text-amber-600 flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            Esperando há {formatWaitTime(item.waitingSince)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: "bg-green-500/10 text-green-600",
    blue: "bg-blue-500/10 text-blue-600",
    amber: "bg-amber-500/10 text-amber-600",
    purple: "bg-purple-500/10 text-purple-600",
  };
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground pl-1">{value}</p>
    </div>
  );
}

function AgentCard({
  agent,
  isExpanded,
  onToggle,
  conversations,
  isLoadingConvs,
  avgTickets,
}: {
  agent: AgentData;
  isExpanded: boolean;
  onToggle: () => void;
  conversations: any[];
  isLoadingConvs: boolean;
  avgTickets: number;
}) {
  const initials = agent.name?.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase() || "?";
  const isOnline = agent.status === "online";
  const isOverloaded = agent.openTickets > avgTickets * 1.5 && avgTickets > 0;

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-all ${
      isOverloaded ? "border-amber-400/40" : "border-border"
    }`}>
      {/* Agent header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {agent.avatarUrl ? (
              <img src={agent.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[13px] font-bold text-muted-foreground">{initials}</span>
            )}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${
            isOnline ? "bg-green-500" : "bg-gray-400"
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-medium text-foreground truncate">{agent.name}</p>
            {isOverloaded && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                Sobrecarregado
              </span>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground truncate">{agent.email}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[18px] font-bold text-foreground">{agent.openTickets}</p>
            <p className="text-[10px] text-muted-foreground">chamados</p>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded conversations */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          {isLoadingConvs ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-center text-[13px] text-muted-foreground py-4">
              Nenhuma conversa ativa
            </p>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-card rounded-lg border border-border/50">
                  <CircleDot className={`w-3.5 h-3.5 shrink-0 ${
                    conv.ticketStatus === "open" ? "text-green-500" :
                    conv.ticketStatus === "pending" ? "text-amber-500" : "text-gray-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">
                      {conv.contactName || conv.remoteJid?.split("@")[0] || "Desconhecido"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {conv.lastMessage || "Sem mensagens"}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {conv.lastMessageAt ? formatRelativeTime(conv.lastMessageAt) : ""}
                  </span>
                </div>
              ))}
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
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}min`;
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
