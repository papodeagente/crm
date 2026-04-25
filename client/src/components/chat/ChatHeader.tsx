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

// ─── DDI → ISO2 country lookup (top countries; falls back to globe) ───
const DDI_TO_ISO2: Array<[string, string]> = [
  ["55", "BR"], ["1", "US"], ["351", "PT"], ["54", "AR"], ["56", "CL"],
  ["57", "CO"], ["58", "VE"], ["52", "MX"], ["598", "UY"], ["595", "PY"],
  ["591", "BO"], ["593", "EC"], ["51", "PE"], ["44", "GB"], ["33", "FR"],
  ["49", "DE"], ["34", "ES"], ["39", "IT"], ["31", "NL"], ["32", "BE"],
  ["41", "CH"], ["43", "AT"], ["46", "SE"], ["47", "NO"], ["45", "DK"],
  ["353", "IE"], ["48", "PL"], ["7", "RU"], ["380", "UA"], ["86", "CN"],
  ["81", "JP"], ["82", "KR"], ["91", "IN"], ["62", "ID"], ["63", "PH"],
  ["66", "TH"], ["84", "VN"], ["60", "MY"], ["65", "SG"], ["971", "AE"],
  ["972", "IL"], ["27", "ZA"], ["20", "EG"], ["234", "NG"], ["254", "KE"],
  ["61", "AU"], ["64", "NZ"], ["90", "TR"], ["30", "GR"], ["421", "SK"],
  ["420", "CZ"], ["36", "HU"], ["40", "RO"], ["359", "BG"],
];

function iso2ToFlagEmoji(iso2: string): string {
  const cps = iso2.toUpperCase().split("").map(c => 0x1F1E6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...cps);
}

function ddiFromPhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // Try longest DDI first
  const sorted = [...DDI_TO_ISO2].sort((a, b) => b[0].length - a[0].length);
  for (const [ddi] of sorted) {
    if (digits.startsWith(ddi)) return ddi;
  }
  return null;
}

function flagFromPhone(phone: string | undefined | null): string | null {
  const ddi = ddiFromPhone(phone);
  if (!ddi) return null;
  const found = DDI_TO_ISO2.find(([d]) => d === ddi);
  return found ? iso2ToFlagEmoji(found[1]) : null;
}

const LIFECYCLE_LABEL: Record<string, string> = { lead: "Lead", prospect: "Prospect", customer: "Cliente", churned: "Churned" };
const LIFECYCLE_CLS: Record<string, string> = {
  lead: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  prospect: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  customer: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  churned: "bg-red-500/15 text-red-400 border-red-500/30",
};

interface ChatHeaderProps {
  contact: { id: number; name: string; phone: string; email?: string; avatarUrl?: string; lifecycleStage?: string | null } | null;
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
  searchOpen?: boolean;
  onToggleSearch?: () => void;
}

export default function ChatHeader({
  contact, sessionId, remoteJid, assignment, agents, showAgentNames,
  autoOpenAssign, onAssign, onStatusChange, onToggleAgentNames,
  onAutoOpenAssignConsumed, onCreateDeal, onCreateContact, hasCrmContact,
  waConversationId, onTransfer, onImport, onToggleTimeline, showTimeline,
  onSummarize, summaryLoading, onPin, onArchive, onSetPriority,
  onToggleTagsPanel, onScheduleMessage,
  searchOpen, onToggleSearch,
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
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[16px] font-medium truncate leading-[21px]" style={{ color: 'var(--wa-text-primary)' }}>{contact?.name || "Cliente"}</p>
          {contact?.lifecycleStage && LIFECYCLE_LABEL[contact.lifecycleStage] && (
            <span
              className={`shrink-0 px-1.5 py-0 rounded-full border text-[10px] font-medium ${LIFECYCLE_CLS[contact.lifecycleStage] || ""}`}
              title="Estágio do contato"
            >
              {LIFECYCLE_LABEL[contact.lifecycleStage]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[13px] leading-[20px] truncate" style={{ color: 'var(--wa-text-secondary)' }}>
          <svg viewBox="0 0 24 24" width="12" height="12" className="shrink-0" fill="#25d366">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          </svg>
          <span className="shrink-0">WhatsApp</span>
          {(() => { const flag = flagFromPhone(contact?.phone); return flag ? <span className="shrink-0" title="País detectado pelo DDI">{flag}</span> : <span className="shrink-0">💬</span>; })()}
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
        <InstantTooltip label={searchOpen ? "Fechar busca" : "Buscar na conversa"}>
          <button
            onClick={onToggleSearch}
            className={`w-[40px] h-[40px] flex items-center justify-center rounded-full transition-colors ${searchOpen ? "bg-[var(--wa-hover)]" : "hover:bg-[var(--wa-hover)]"}`}
          >
            <Search className="w-[20px] h-[20px]" style={{ color: searchOpen ? 'var(--wa-tint)' : 'var(--wa-text-secondary)' }} />
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
                  Criar Cliente
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
