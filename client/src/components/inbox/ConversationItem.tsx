import { memo, useState, useEffect } from "react";
import {
  Check, CheckCheck, Clock, Pin, Timer,
  ArrowRightLeft, Users, CheckCircle2, X,
} from "lucide-react";
import { formatTime } from "../../../../shared/dateUtils";
import InstantTooltip from "@/components/InstantTooltip";

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */

export function formatConversationTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);
  if (diffDays === 0) return formatTime(d);
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function formatPhoneNumber(jid: string): string {
  if (!jid) return "Desconhecido";
  // LID JIDs don't contain phone numbers - show friendly label
  if (jid.endsWith("@lid")) return "Cliente WhatsApp";
  const phone = jid.split("@")[0];
  // Skip non-numeric strings (corrupted JIDs)
  if (!/^\d+$/.test(phone)) return "Cliente WhatsApp";
  if (phone.startsWith("55") && phone.length >= 12) {
    const ddd = phone.substring(2, 4);
    const num = phone.substring(4);
    if (num.length === 9) return `(${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`;
    if (num.length === 8) return `(${ddd}) ${num.substring(0, 4)}-${num.substring(4)}`;
  }
  return `+${phone}`;
}

export function getMessagePreview(content: string | null, messageType: string | null): string {
  if (!messageType || messageType === "text" || messageType === "conversation" || messageType === "extendedTextMessage") {
    return content || "";
  }
  const typeMap: Record<string, string> = {
    imageMessage: "\u{1F4F7} Foto", image: "\u{1F4F7} Foto",
    videoMessage: "\u{1F4F9} V\u00EDdeo", video: "\u{1F4F9} V\u00EDdeo",
    audioMessage: "\u{1F3A4} \u00C1udio", audio: "\u{1F3A4} \u00C1udio", pttMessage: "\u{1F3A4} \u00C1udio",
    documentMessage: "\u{1F4C4} Documento", document: "\u{1F4C4} Documento",
    documentWithCaptionMessage: "\u{1F4C4} Documento",
    stickerMessage: "\u{1F3F7}\uFE0F Sticker",
    contactMessage: "\u{1F464} Contato", contactsArrayMessage: "\u{1F465} Contatos",
    locationMessage: "\u{1F4CD} Localiza\u00E7\u00E3o", liveLocationMessage: "\u{1F4CD} Localiza\u00E7\u00E3o ao vivo",
    viewOnceMessage: "\u{1F4F7} Visualiza\u00E7\u00E3o \u00FAnica", viewOnceMessageV2: "\u{1F4F7} Visualiza\u00E7\u00E3o \u00FAnica",
    pollCreationMessage: "\u{1F4CA} Enquete", pollCreationMessageV3: "\u{1F4CA} Enquete",
    pollUpdateMessage: "\u{1F4CA} Voto na enquete",
    eventMessage: "\u{1F4C5} Evento",
    // Rich message types from WhatsApp Business API
    templateMessage: "\u{1F4DD} Template",
    interactiveMessage: "\u{1F518} Mensagem interativa",
    buttonsMessage: "\u{1F518} Bot\u00F5es",
    listMessage: "\u{1F4CB} Lista",
    listResponseMessage: "\u2705 Resposta da lista",
    buttonsResponseMessage: "\u2705 Resposta do bot\u00E3o",
    templateButtonReplyMessage: "\u2705 Resposta do template",
    interactiveResponseMessage: "\u2705 Resposta interativa",
    orderMessage: "\u{1F6D2} Pedido",
    productMessage: "\u{1F6CD}\uFE0F Produto",
    groupInviteMessage: "\u{1F465} Convite de grupo",
    albumMessage: "\u{1F4F7} \u00C1lbum",
    associatedChildMessage: "\u{1F4F7} Foto do \u00E1lbum",
    lottieStickerMessage: "\u{1F3F7}\uFE0F Figurinha animada",
    editedMessage: "\u270F\uFE0F Editada",
    placeholderMessage: "\u{1F4AC} Mensagem",
    ptvMessage: "\u{1F3A5} V\u00EDdeo circular",
  };
  // If we have real content (not a bracket placeholder), prefer showing it
  if (content && content.length > 0 && !content.startsWith("[")) {
    // For rich types, show the type icon + content for better context
    const prefix = typeMap[messageType];
    if (prefix && (messageType === "templateMessage" || messageType === "interactiveMessage" ||
        messageType === "buttonsMessage" || messageType === "listMessage")) {
      // Show icon + first part of content for these types
      const emoji = prefix.split(" ")[0];
      return `${emoji} ${content}`;
    }
    return content;
  }
  return typeMap[messageType] || content || "";
}

/* ═══════════════════════════════════════════════════════
   STATUS TICKS
   ═══════════════════════════════════════════════════════ */

export const StatusTick = memo(({ status, fromMe }: { status: string | null; fromMe: boolean }) => {
  if (!fromMe) return null;
  switch (status) {
    case "sending": return <Clock className="w-[16px] h-[16px] shrink-0 animate-pulse" />;
    case "pending": return <Clock className="w-[16px] h-[16px] shrink-0" />;
    case "sent": return <Check className="w-[16px] h-[16px] shrink-0" />;
    case "delivered": return <CheckCheck className="w-[16px] h-[16px] shrink-0" />;
    case "read": case "played": return <CheckCheck className="w-[16px] h-[16px] shrink-0 text-blue-400" />;
    default: return <Check className="w-[16px] h-[16px] shrink-0" />;
  }
});
StatusTick.displayName = "StatusTick";

/* ═══════════════════════════════════════════════════════
   AVATAR — WhatsApp style with real profile picture
   ═══════════════════════════════════════════════════════ */

// Gradient palette for avatar initials — vibrant, modern colors
const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-pink-500",
  "from-amber-500 to-orange-500",
  "from-indigo-500 to-blue-600",
  "from-fuchsia-500 to-pink-600",
  "from-teal-500 to-green-500",
  "from-sky-500 to-indigo-500",
  "from-red-500 to-rose-500",
  "from-lime-500 to-emerald-500",
  "from-cyan-500 to-blue-500",
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function getInitials(name: string): string {
  if (!name || !name.trim()) return "?";
  const cleaned = name.replace(/[^a-zA-Z0-9\s\u00C0-\u024F]/g, "").trim();
  if (!cleaned) return name.charAt(0).toUpperCase();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return words[0].substring(0, 2).toUpperCase();
}

export const WaAvatar = memo(({ name, size = 49, pictureUrl }: { name: string; size?: number; pictureUrl?: string | null }) => {
  const [imgError, setImgError] = useState(false);
  const fontSize = size < 36 ? 11 : size < 44 ? 13 : 16;

  if (pictureUrl && !imgError) {
    return (
      <div className="rounded-full shrink-0 overflow-hidden" style={{ width: size, height: size }}>
        <img
          src={pictureUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // WhatsApp Web default avatar — gray circle with white silhouette
  const gradient = getAvatarGradient(name);
  const initials = getInitials(name);
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${gradient === 'from-violet-500 to-purple-600' ? '#7c3aed, #9333ea' : gradient === 'from-blue-500 to-cyan-500' ? '#3b82f6, #06b6d4' : gradient === 'from-emerald-500 to-teal-500' ? '#10b981, #14b8a6' : gradient === 'from-rose-500 to-pink-500' ? '#f43f5e, #ec4899' : gradient === 'from-amber-500 to-orange-500' ? '#f59e0b, #f97316' : '#6b7280, #9ca3af'})` }}
    >
      <span className="text-white font-semibold select-none leading-none" style={{ fontSize }}>
        {initials}
      </span>
    </div>
  );
});
WaAvatar.displayName = "WaAvatar";

/* ═══════════════════════════════════════════════════════
   URGENCY TIMER — live countdown with color coding
   Green < 5min | Yellow 5-15min | Orange 15-30min | Red > 30min
   ═══════════════════════════════════════════════════════ */

function getUrgencyColor(minutes: number): { text: string; bg: string; ring: string; dot: string } {
  if (minutes < 5) return { text: "text-emerald-400", bg: "bg-emerald-400/10", ring: "ring-emerald-400/20", dot: "bg-emerald-400" };
  if (minutes < 15) return { text: "text-yellow-400", bg: "bg-yellow-400/10", ring: "ring-yellow-400/20", dot: "bg-yellow-400" };
  if (minutes < 30) return { text: "text-orange-400", bg: "bg-orange-400/10", ring: "ring-orange-400/20", dot: "bg-orange-400" };
  return { text: "text-red-400", bg: "bg-red-400/10", ring: "ring-red-400/20", dot: "bg-red-400" };
}

function formatTimerDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}:${sec.toString().padStart(2, "0")}`;
  const hrs = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hrs}h${remMin.toString().padStart(2, "0")}`;
}

export const UrgencyTimer = memo(({ since, label, compact }: { since: Date | string | number; label?: string; compact?: boolean }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const sinceMs = new Date(since).getTime();
    const update = () => setElapsed(Math.max(0, Date.now() - sinceMs));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [since]);

  const minutes = elapsed / 60000;
  const colors = getUrgencyColor(minutes);
  const display = formatTimerDuration(elapsed);

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md ${colors.bg} ${colors.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} animate-pulse`} />
        {display}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md ring-1 ${colors.bg} ${colors.text} ${colors.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} animate-pulse`} />
      {label && <span className="font-sans text-[9px] opacity-70">{label}</span>}
      {display}
    </span>
  );
});
UrgencyTimer.displayName = "UrgencyTimer";

/* ═══════════════════════════════════════════════════════
   CONVERSATION ITEM — WhatsApp Web faithful
   ═══════════════════════════════════════════════════════ */

export interface ConvItem {
  conversationKey?: string;
  sessionId?: string;
  remoteJid: string;
  lastMessage: string | null;
  lastMessageType: string | null;
  lastFromMe: boolean | number;
  lastTimestamp: string | Date | null;
  lastStatus: string | null;
  contactPushName: string | null;
  unreadCount: number | string;
  totalMessages?: number | string;
  // Multi-agent fields
  assignedUserId?: number | null;
  assignedTeamId?: number | null;
  assignmentStatus?: string | null;
  assignmentPriority?: string | null;
  assignedAgentName?: string | null;
  assignedAgentAvatar?: string | null;
  lastSenderAgentId?: number | null;
  // Fields from wa_conversations
  conversationId?: number;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  queuedAt?: string | Date | null;
  // Pin / Archive / Priority
  isPinned?: boolean | number;
  isArchived?: boolean | number;
}

// Priority colors for badges
const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  urgent: { bg: "bg-red-500/15", text: "text-red-500", label: "Urgente" },
  high: { bg: "bg-orange-500/15", text: "text-orange-500", label: "Alta" },
  medium: { bg: "bg-blue-500/15", text: "text-blue-500", label: "M\u00E9dia" },
  low: { bg: "bg-muted", text: "text-muted-foreground", label: "Baixa" },
};

const AgentBadge = memo(({ name, avatarUrl }: { name?: string | null; avatarUrl?: string | null }) => {
  if (!name) return null;
  const initials = name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-1 shrink-0" title={`Atribu\u00EDdo a ${name}`}>
      <div className="w-[18px] h-[18px] rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[9px] font-bold text-primary">{initials}</span>
        )}
      </div>
    </div>
  );
});
AgentBadge.displayName = "AgentBadge";

const StatusDot = memo(({ status }: { status?: string | null }) => {
  if (!status || status === "open") return null;
  const colors: Record<string, string> = {
    pending: "bg-yellow-400",
    resolved: "bg-green-500",
    closed: "bg-muted-foreground/40",
  };
  return <div className={`w-[7px] h-[7px] rounded-full shrink-0 ${colors[status] || ""}`} title={status} />;
});
StatusDot.displayName = "StatusDot";

const ConversationItem = memo(({
  conv, isActive, contactName, pictureUrl, onClick, waitLabel, showTimer, showFinish, onFinish,
  onTransfer, onAssignClick,
}: {
  conv: ConvItem; isActive: boolean; contactName: string; pictureUrl?: string | null; onClick: () => void;
  waitLabel?: string; showTimer?: boolean; showFinish?: boolean; onFinish?: () => void;
  onTransfer?: () => void; onAssignClick?: () => void;
}) => {
  const fromMe = conv.lastFromMe === true || conv.lastFromMe === 1;
  const unread = Number(conv.unreadCount) || 0;
  const preview = getMessagePreview(conv.lastMessage, conv.lastMessageType);
  const time = formatConversationTime(conv.lastTimestamp);
  const isWaitingResponse = showTimer && !fromMe && conv.lastTimestamp;

  return (
    <div
      onClick={onClick}
      className={`inbox-conv-item group/conv flex items-center gap-3 px-3.5 py-3 cursor-pointer ${isActive ? "active" : ""}`}
    >
      {/* Avatar with channel badge + ring */}
      <div className="relative shrink-0">
        <div className={`inbox-avatar-ring rounded-full`}>
          <WaAvatar name={contactName} size={46} pictureUrl={pictureUrl} />
        </div>
        {/* WhatsApp channel badge */}
        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center ring-2 ring-background">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          </svg>
        </div>
        {conv.assignmentStatus && conv.assignmentStatus !== "open" && (
          <div className="absolute top-0 right-0">
            <StatusDot status={conv.assignmentStatus} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Name + badges + time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {(conv.isPinned === true || conv.isPinned === 1) && (
              <Pin className="w-3 h-3 text-primary shrink-0 -rotate-45" />
            )}
            <span className={`text-[15px] truncate leading-tight ${
              unread > 0 ? "text-foreground font-medium" : "text-foreground font-normal"
            }`}>
              {contactName}
            </span>
            {conv.assignmentPriority && conv.assignmentPriority !== "low" && (
              <span className={`text-[9px] px-1 py-[1px] rounded font-semibold shrink-0 ${PRIORITY_COLORS[conv.assignmentPriority]?.bg || ""} ${PRIORITY_COLORS[conv.assignmentPriority]?.text || ""}`}>
                {PRIORITY_COLORS[conv.assignmentPriority]?.label || conv.assignmentPriority}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isWaitingResponse && (
              <span className="flex items-center gap-1 text-[10px] font-medium tabular-nums text-emerald-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <UrgencyTimer since={conv.lastTimestamp!} compact />
              </span>
            )}
            <span className={`text-[12px] tabular-nums ${
              unread > 0 ? "text-primary font-medium" : "text-muted-foreground"
            }`}>
              {time}
            </span>
          </div>
        </div>

        {/* Row 2: Preview + badges + actions */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <StatusTick status={conv.lastStatus} fromMe={fromMe} />
            <span className={`text-[13.5px] truncate leading-snug ${
              unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"
            }`}>
              {preview || "Sem mensagens"}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Wait badge */}
            {waitLabel && !showTimer && (
              <span className="text-[9px] text-amber-400 bg-amber-400/10 px-1.5 py-[2px] rounded-md font-semibold flex items-center gap-0.5">
                <Timer className="w-2.5 h-2.5" />
                {waitLabel}
              </span>
            )}
            {/* Unread badge — gradient with glow */}
            {unread > 0 && (
              <span className="inbox-unread-badge">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
            {/* Action buttons */}
            {onTransfer && (
              <InstantTooltip label="Transferir">
                <button
                  onClick={(e) => { e.stopPropagation(); onTransfer(); }}
                  className="w-7 h-7 flex items-center justify-center rounded-md shrink-0 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all opacity-0 group-hover/conv:opacity-100"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
              </InstantTooltip>
            )}
            {onAssignClick && (
              <InstantTooltip label={conv.assignedAgentName ? `Atribu\u00EDdo: ${conv.assignedAgentName}` : "Atribuir"}>
                <button
                  onClick={(e) => { e.stopPropagation(); onAssignClick(); }}
                  className="w-7 h-7 flex items-center justify-center rounded-md shrink-0 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all opacity-0 group-hover/conv:opacity-100"
                  style={{ color: conv.assignedAgentName ? 'var(--primary)' : undefined }}
                >
                  <Users className="w-3.5 h-3.5" />
                </button>
              </InstantTooltip>
            )}
            {showFinish && onFinish && (
              <InstantTooltip label="Finalizar">
                <button
                  onClick={(e) => { e.stopPropagation(); onFinish(); }}
                  className="w-7 h-7 flex items-center justify-center rounded-md shrink-0 text-emerald-400 hover:bg-emerald-500/15 transition-all opacity-0 group-hover/conv:opacity-100"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              </InstantTooltip>
            )}
            {conv.assignedAgentName && !onAssignClick && (
              <AgentBadge name={conv.assignedAgentName} avatarUrl={conv.assignedAgentAvatar} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
ConversationItem.displayName = "ConversationItem";

export default ConversationItem;
