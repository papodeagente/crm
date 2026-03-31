/**
 * ChatHeader — Chat header with contact info, agent assignment, and actions menu
 * Extracted from WhatsAppChat.tsx lines 2290-2537
 */

import { useState, useEffect } from "react";
import {
  Search, X, Users, MoreVertical, Check, UserPlus, Briefcase,
  ArrowRightLeft, FileText, History, Brain, Pin, Archive, Tag,
  CalendarClock,
} from "lucide-react";
import InstantTooltip from "@/components/InstantTooltip";

interface AgentInfo {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
  status: string;
}

interface AssignmentInfo {
  assignedUserId?: number | null;
  assignedAgentName?: string | null;
  assignmentStatus?: string | null;
  assignmentPriority?: string | null;
}

interface ChatHeaderProps {
  contact: { id: number; name: string; phone: string; email?: string; avatarUrl?: string } | null;
  sessionId: string;
  remoteJid: string;
  assignment?: AssignmentInfo | null;
  agents?: AgentInfo[];
  showAgentNames: boolean;
  autoOpenAssign?: boolean;
  onAssign?: (agentId: number | null) => void;
  onStatusChange?: (status: "open" | "pending" | "resolved" | "closed") => void;
  onToggleAgentNames: (show: boolean) => void;
  onAutoOpenAssignConsumed?: () => void;
  // More menu actions
  onCreateDeal?: () => void;
  onCreateContact?: () => void;
  hasCrmContact?: boolean;
  waConversationId?: number;
  onTransfer: () => void;
  onImport: () => void;
  onToggleTimeline: () => void;
  showTimeline: boolean;
  onSummarize: () => void;
  summaryLoading: boolean;
  onPin: () => void;
  onArchive: () => void;
  onSetPriority: (priority: "low" | "medium" | "high" | "urgent") => void;
  onToggleTagsPanel: () => void;
  onScheduleMessage: () => void;
}

export default function ChatHeader({
  contact, sessionId, remoteJid, assignment, agents, showAgentNames,
  autoOpenAssign, onAssign, onStatusChange, onToggleAgentNames,
  onAutoOpenAssignConsumed, onCreateDeal, onCreateContact, hasCrmContact,
  waConversationId, onTransfer, onImport, onToggleTimeline, showTimeline,
  onSummarize, summaryLoading, onPin, onArchive, onSetPriority,
  onToggleTagsPanel, onScheduleMessage,
}: ChatHeaderProps) {
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Auto-open agent dropdown when triggered from ConversationItem
  useEffect(() => {
    if (autoOpenAssign) {
      setShowAgentDropdown(true);
      onAutoOpenAssignConsumed?.();
    }
  }, [autoOpenAssign]);

  return (
    <div className="flex items-center gap-[15px] px-[16px] h-[59px] shrink-0 z-10" style={{ backgroundColor: 'var(--wa-panel-header)', borderBottom: '1px solid var(--wa-divider)' }}>
      {/* Avatar */}
      <div className="w-[40px] h-[40px] rounded-full shrink-0 overflow-hidden cursor-pointer">
        {contact?.avatarUrl ? (
          <img src={contact.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <svg viewBox="0 0 212 212" width="40" height="40">
            <path fill="var(--wa-search-bg)" d="M106 0C47.5 0 0 47.5 0 106s47.5 106 106 106 106-47.5 106-106S164.5 0 106 0z" />
            <path fill="var(--wa-text-secondary)" opacity="0.3" d="M106 45c-20.7 0-37.5 16.8-37.5 37.5S85.3 120 106 120s37.5-16.8 37.5-37.5S126.7 45 106 45zm0 105c-28.3 0-52.5 14.3-52.5 32v10h105v-10c0-17.7-24.2-32-52.5-32z" />
          </svg>
        )}
      </div>

      {/* Contact info */}
      <div className="flex-1 min-w-0 cursor-pointer">
        <p className="text-[16px] font-medium truncate leading-[21px]" style={{ color: 'var(--wa-text-primary)' }}>{contact?.name || "Passageiro"}</p>
        <div className="flex items-center gap-1.5 text-[13px] leading-[20px] truncate" style={{ color: 'var(--wa-text-secondary)' }}>
          <svg viewBox="0 0 24 24" width="12" height="12" className="shrink-0" fill="#25d366">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          </svg>
          <span className="shrink-0">WhatsApp</span>
          <span className="shrink-0">💬</span>
          <span className="truncate">{contact?.phone ? `+${contact.phone.replace(/\D/g, '')}` : ""}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-[2px]">
        {/* Assignment button */}
        {(assignment || agents?.length) && (
          <div className="relative">
            <InstantTooltip label={assignment?.assignedAgentName ? `Atribuído: ${assignment.assignedAgentName}` : "Atribuir"}>
              <button
                onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-[var(--wa-hover)] transition-colors"
              >
                <Users className="w-[20px] h-[20px]" style={{ color: assignment?.assignedAgentName ? 'var(--wa-tint)' : 'var(--wa-text-secondary)' }} />
              </button>
            </InstantTooltip>
            {/* Agent assignment dropdown */}
            {showAgentDropdown && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Atribuir a</p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <button
                    onClick={() => { onAssign?.(null); setShowAgentDropdown(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-sm text-muted-foreground">Remover atribuição</span>
                  </button>
                  {(agents || []).map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => { onAssign?.(agent.id); setShowAgentDropdown(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors text-left ${
                        assignment?.assignedUserId === agent.id ? "bg-wa-tint/5" : ""
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-wa-tint/15 flex items-center justify-center overflow-hidden shrink-0">
                        {agent.avatarUrl ? (
                          <img src={agent.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-wa-tint">
                            {agent.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground truncate">{agent.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{agent.email}</p>
                      </div>
                      {assignment?.assignedUserId === agent.id && (
                        <Check className="w-4 h-4 text-wa-tint shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                {/* Status section */}
                <div className="border-t border-border px-3 py-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                  <div className="flex flex-wrap gap-1">
                    {(["open", "pending", "resolved", "closed"] as const).map(s => {
                      const statusLabels: Record<string, string> = { open: "Aberto", pending: "Pendente", resolved: "Resolvido", closed: "Fechado" };
                      const statusColors: Record<string, string> = { open: "bg-blue-500/10 text-blue-600", pending: "bg-yellow-500/10 text-yellow-600", resolved: "bg-green-500/10 text-green-600", closed: "bg-muted text-muted-foreground" };
                      return (
                        <button
                          key={s}
                          onClick={() => { onStatusChange?.(s); setShowAgentDropdown(false); }}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                            assignment?.assignmentStatus === s
                              ? statusColors[s] + " ring-1 ring-current/20"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {statusLabels[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Show agent names toggle */}
                <div className="border-t border-border px-3 py-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAgentNames}
                      onChange={(e) => onToggleAgentNames(e.target.checked)}
                      className="rounded border-border text-wa-tint focus:ring-wa-tint/30 w-3.5 h-3.5"
                    />
                    <span className="text-[11px] text-muted-foreground">Mostrar nome do atendente nas mensagens</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Search button */}
        <InstantTooltip label="Buscar na conversa">
          <button className="w-[40px] h-[40px] flex items-center justify-center hover:bg-[var(--wa-hover)] rounded-full transition-colors">
            <Search className="w-[20px] h-[20px]" style={{ color: 'var(--wa-text-secondary)' }} />
          </button>
        </InstantTooltip>
        {/* More menu */}
        <div className="relative">
          <InstantTooltip label="Menu">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="w-[40px] h-[40px] flex items-center justify-center hover:bg-[var(--wa-hover)] rounded-full transition-colors"
            >
              <MoreVertical className="w-[20px] h-[20px]" style={{ color: 'var(--wa-text-secondary)' }} />
            </button>
          </InstantTooltip>
          {showMoreMenu && (
            <div className="absolute top-full right-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              {onCreateContact && !hasCrmContact && (
                <button
                  onClick={() => { onCreateContact(); setShowMoreMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left text-[13px] text-foreground"
                >
                  <UserPlus className="w-4 h-4 text-muted-foreground" />
                  Criar Passageiro
                </button>
              )}
              {onCreateDeal && (
                <button
                  onClick={() => { onCreateDeal(); setShowMoreMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left text-[13px] text-foreground"
                >
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  Criar Negociação
                </button>
              )}
              {waConversationId && (
                <button
                  onClick={() => { onTransfer(); setShowMoreMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left text-[13px] text-foreground"
                >
                  <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                  Transferir Conversa
                </button>
              )}
              <button
                onClick={() => { onImport(); setShowMoreMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left text-[13px] text-foreground"
              >
                <FileText className="w-4 h-4 text-muted-foreground" />
                Importar como Anotação
              </button>
              <button
                onClick={() => { onToggleTimeline(); setShowMoreMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left text-[13px] text-foreground"
              >
                <History className="w-4 h-4 text-muted-foreground" />
                {showTimeline ? "Ocultar Timeline" : "Timeline de Eventos"}
              </button>
              <button
                onClick={() => { onSummarize(); setShowMoreMenu(false); }}
                disabled={summaryLoading}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left text-[13px] text-foreground"
              >
                <Brain className="w-4 h-4 text-muted-foreground" />
                {summaryLoading ? "Gerando Resumo..." : "Resumo IA"}
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { onPin(); setShowMoreMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left text-[13px] text-foreground"
              >
                <Pin className="w-4 h-4 text-muted-foreground -rotate-45" />
                Fixar Conversa
              </button>
              <button
                onClick={() => { onArchive(); setShowMoreMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left text-[13px] text-foreground"
              >
                <Archive className="w-4 h-4 text-muted-foreground" />
                Arquivar Conversa
              </button>
              <button
                onClick={() => { onToggleTagsPanel(); setShowMoreMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left text-[13px] text-foreground"
              >
                <Tag className="w-4 h-4 text-muted-foreground" />
                Tags
              </button>
              {/* Priority */}
              <div className="px-3 py-2 border-t border-border">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Prioridade</p>
                <div className="flex flex-wrap gap-1">
                  {(["low", "medium", "high", "urgent"] as const).map(p => {
                    const labels: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };
                    const colors: Record<string, string> = { low: "bg-muted text-muted-foreground", medium: "bg-blue-500/10 text-blue-600", high: "bg-orange-500/10 text-orange-600", urgent: "bg-red-500/10 text-red-600" };
                    return (
                      <button
                        key={p}
                        onClick={() => { onSetPriority(p); setShowMoreMenu(false); }}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                          assignment?.assignmentPriority === p
                            ? colors[p] + " ring-1 ring-current/20"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {labels[p]}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Schedule message */}
              <button
                onClick={() => { onScheduleMessage(); setShowMoreMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left text-[13px] text-foreground border-t border-border"
              >
                <CalendarClock className="w-4 h-4 text-muted-foreground" />
                Agendar Mensagem
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
