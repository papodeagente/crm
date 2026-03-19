import { useState, useMemo, useEffect, useCallback, useRef, memo } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { useConversationStore, makeConvKey, getJidFromKey } from "@/hooks/useConversationStore";
import type { ConvEntry } from "@/hooks/useConversationStore";
import WhatsAppChat from "@/components/WhatsAppChat";
import {
  Search, MessageSquare, MoreVertical, ArrowLeft,
  Check, CheckCheck, Clock, Phone, Loader2,
  MessageCircle, Briefcase, Plus, X, Volume2, VolumeX,
  UserPlus, Lock, Users, UserCheck, UserX, ArrowRightLeft,
  CircleDot, ChevronDown, WifiOff, RefreshCw, CheckCircle2, LogOut
} from "lucide-react";
import { formatTime } from "../../../shared/dateUtils";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useTenantId } from "@/hooks/useTenantId";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { Inbox as InboxIcon, ListOrdered, Contact2, LayoutGrid, HandMetal, Timer, ArrowRightLeft as Transfer } from "lucide-react";
import InstantTooltip from "@/components/InstantTooltip";
import CustomFieldRenderer, { customFieldValuesToArray } from "@/components/CustomFieldRenderer";
import type { CustomFieldDef } from "@/components/CustomFieldRenderer";

/* ═══════════════════════════════════════════════════════
   NOTIFICATION SOUND (Web Audio API — WhatsApp style)
 * With debounce: max 1 sound per 2000ms (Part 6 spec)
   ═══════════════════════════════════════════════════════ */

const MUTE_KEY = "entur_inbox_muted";
const SOUND_DEBOUNCE_MS = 2000; // Part 6: 2000ms debounce per spec

function createNotificationSound(): () => void {
  let audioCtx: AudioContext | null = null;
  let lastPlayedAt = 0;
  return () => {
    const now = Date.now();
    if (now - lastPlayedAt < SOUND_DEBOUNCE_MS) {
      console.log('[NotifSound] Debounced — too soon since last sound');
      return;
    }
    lastPlayedAt = now;
    try {
      if (!audioCtx) audioCtx = new AudioContext();
      const ctx = audioCtx;
      const t = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, t);
      osc1.connect(gain);
      osc1.start(t);
      osc1.stop(t + 0.12);
      const gain2 = ctx.createGain();
      gain2.connect(ctx.destination);
      gain2.gain.setValueAtTime(0.12, t + 0.13);
      gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(660, t + 0.13);
      osc2.connect(gain2);
      osc2.start(t + 0.13);
      osc2.stop(t + 0.3);
      console.log('[NotifSound] Playing notification sound');
    } catch { /* Audio not supported */ }
  };
}
const playNotification = createNotificationSound();

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */

function formatConversationTime(date: string | Date | null | undefined): string {
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

function formatPhoneNumber(jid: string): string {
  if (!jid) return "Desconhecido";
  // LID JIDs don't contain phone numbers - show friendly label
  if (jid.endsWith("@lid")) return "Contato WhatsApp";
  const phone = jid.split("@")[0];
  // Skip non-numeric strings (corrupted JIDs)
  if (!/^\d+$/.test(phone)) return "Contato WhatsApp";
  if (phone.startsWith("55") && phone.length >= 12) {
    const ddd = phone.substring(2, 4);
    const num = phone.substring(4);
    if (num.length === 9) return `(${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`;
    if (num.length === 8) return `(${ddd}) ${num.substring(0, 4)}-${num.substring(4)}`;
  }
  return `+${phone}`;
}

function getMessagePreview(content: string | null, messageType: string | null): string {
  if (!messageType || messageType === "text" || messageType === "conversation" || messageType === "extendedTextMessage") {
    return content || "";
  }
  const typeMap: Record<string, string> = {
    imageMessage: "📷 Foto", image: "📷 Foto",
    videoMessage: "📹 Vídeo", video: "📹 Vídeo",
    audioMessage: "🎤 Áudio", audio: "🎤 Áudio", pttMessage: "🎤 Áudio",
    documentMessage: "📄 Documento", document: "📄 Documento",
    documentWithCaptionMessage: "📄 Documento",
    stickerMessage: "🏷️ Sticker",
    contactMessage: "👤 Contato", contactsArrayMessage: "👥 Contatos",
    locationMessage: "📍 Localização", liveLocationMessage: "📍 Localização ao vivo",
    viewOnceMessage: "📷 Visualização única", viewOnceMessageV2: "📷 Visualização única",
    pollCreationMessage: "📊 Enquete", pollCreationMessageV3: "📊 Enquete",
    pollUpdateMessage: "📊 Voto na enquete",
    eventMessage: "📅 Evento",
    // Rich message types from WhatsApp Business API
    templateMessage: "📝 Template",
    interactiveMessage: "🔘 Mensagem interativa",
    buttonsMessage: "🔘 Botões",
    listMessage: "📋 Lista",
    listResponseMessage: "✅ Resposta da lista",
    buttonsResponseMessage: "✅ Resposta do botão",
    templateButtonReplyMessage: "✅ Resposta do template",
    interactiveResponseMessage: "✅ Resposta interativa",
    orderMessage: "🛒 Pedido",
    productMessage: "🛍️ Produto",
    groupInviteMessage: "👥 Convite de grupo",
    albumMessage: "📷 Álbum",
    associatedChildMessage: "📷 Foto do álbum",
    lottieStickerMessage: "🏷️ Figurinha animada",
    editedMessage: "✏️ Editada",
    placeholderMessage: "💬 Mensagem",
    ptvMessage: "🎥 Vídeo circular",
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

const StatusTick = memo(({ status, fromMe }: { status: string | null; fromMe: boolean }) => {
  if (!fromMe) return null;
  switch (status) {
    case "sending": return <Clock className="w-[16px] h-[16px] shrink-0 animate-pulse" style={{ color: 'var(--wa-text-secondary)' }} />;
    case "pending": return <Clock className="w-[16px] h-[16px] shrink-0" style={{ color: 'var(--wa-text-secondary)' }} />;
    case "sent": return <Check className="w-[16px] h-[16px] shrink-0" style={{ color: 'var(--wa-text-secondary)' }} />;
    case "delivered": return <CheckCheck className="w-[16px] h-[16px] shrink-0" style={{ color: 'var(--wa-text-secondary)' }} />;
    case "read": case "played": return <CheckCheck className="w-[16px] h-[16px] shrink-0" style={{ color: 'var(--wa-tick-read)' }} />;
    default: return <Check className="w-[16px] h-[16px] shrink-0" style={{ color: 'var(--wa-text-secondary)' }} />;
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

const WaAvatar = memo(({ name, size = 49, pictureUrl }: { name: string; size?: number; pictureUrl?: string | null }) => {
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

const UrgencyTimer = memo(({ since, label, compact }: { since: Date | string | number; label?: string; compact?: boolean }) => {
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

interface ConvItem {
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
}

const AgentBadge = memo(({ name, avatarUrl }: { name?: string | null; avatarUrl?: string | null }) => {
  if (!name) return null;
  const initials = name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-1 shrink-0" title={`Atribuído a ${name}`}>
      <div className="w-[18px] h-[18px] rounded-full bg-wa-tint/20 flex items-center justify-center overflow-hidden">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[9px] font-bold text-wa-tint">{initials}</span>
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
}: {
  conv: ConvItem; isActive: boolean; contactName: string; pictureUrl?: string | null; onClick: () => void;
  waitLabel?: string; showTimer?: boolean; showFinish?: boolean; onFinish?: () => void;
}) => {
  const fromMe = conv.lastFromMe === true || conv.lastFromMe === 1;
  const unread = Number(conv.unreadCount) || 0;
  const preview = getMessagePreview(conv.lastMessage, conv.lastMessageType);
  const time = formatConversationTime(conv.lastTimestamp);
  const isWaitingResponse = showTimer && !fromMe && conv.lastTimestamp;

  return (
    <div
      onClick={onClick}
      className={`group/conv flex items-center cursor-pointer transition-colors duration-150 ${
        isActive
          ? "bg-[var(--wa-active)]"
          : "hover:bg-[var(--wa-hover)]"
      }`}
      style={{ paddingLeft: 13, paddingRight: 15 }}
    >
      {/* Avatar */}
      <div className="py-[10px] pr-[13px] relative shrink-0">
        <WaAvatar name={contactName} size={49} pictureUrl={pictureUrl} />
        {conv.assignmentStatus && conv.assignmentStatus !== "open" && (
          <div className="absolute bottom-[10px] right-[12px]">
            <StatusDot status={conv.assignmentStatus} />
          </div>
        )}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0 py-[10px] border-b" style={{ borderColor: 'var(--wa-divider)' }}>
        {/* Row 1: Name + Time */}
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-[17px] truncate flex-1 min-w-0 leading-[21px] ${
            unread > 0 ? "text-[var(--wa-text-primary)] font-normal" : "text-[var(--wa-text-primary)] font-normal"
          }`}>
            {contactName}
          </span>
          <span className={`text-[12px] leading-[14px] shrink-0 ${
            unread > 0 ? "text-[var(--wa-unread)]" : "text-[var(--wa-text-secondary)]"
          }`}>
            {time}
          </span>
        </div>
        {/* Row 2: Ticks + Preview + Badge */}
        <div className="flex items-center gap-[3px] mt-[2px]">
          <StatusTick status={conv.lastStatus} fromMe={fromMe} />
          <span className={`text-[14px] truncate flex-1 leading-[20px] ${
            unread > 0 ? "text-[var(--wa-text-secondary)]" : "text-[var(--wa-text-secondary)]"
          }`}>
            {preview || "Sem mensagens"}
          </span>
          {/* Agent badge */}
          <AgentBadge name={conv.assignedAgentName} avatarUrl={conv.assignedAgentAvatar} />
          {/* Waiting response timer */}
          {isWaitingResponse && (
            <UrgencyTimer since={conv.lastTimestamp!} compact />
          )}
          {/* Urgency timer for queue items */}
          {waitLabel && !showTimer && (
            <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5 shrink-0">
              <Timer className="w-2.5 h-2.5" />
              {waitLabel}
            </span>
          )}
          {unread > 0 && (
            <span className="bg-[var(--wa-unread)] text-white text-[12px] font-medium rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-[6px] shrink-0">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
          {/* Finish attendance button */}
          {showFinish && onFinish && (
            <button
              onClick={(e) => { e.stopPropagation(); onFinish(); }}
              className="w-7 h-7 flex items-center justify-center rounded-full opacity-0 group-hover/conv:opacity-100 transition-all duration-150 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:scale-110 shrink-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
ConversationItem.displayName = "ConversationItem";

/* ═══════════════════════════════════════════════════════
   CREATE CONTACT DIALOG
   ═══════════════════════════════════════════════════════ */

function CreateContactDialog({
  open, onClose, phone, pushName, onCreated,
}: {
  open: boolean; onClose: () => void; phone: string; pushName: string; onCreated: () => void;
}) {
  const tenantId = useTenantId();
  const [name, setName] = useState(pushName || "");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});

  const formattedPhone = formatPhoneNumber(phone + "@s.whatsapp.net");

  // Load custom fields for contacts
  const contactCustomFields = trpc.customFields.list.useQuery(
    { tenantId, entity: "contact" as const },
    { enabled: open }
  );
  const formFields = useMemo(() => {
    return ((contactCustomFields.data || []) as CustomFieldDef[]).filter(f => f.isVisibleOnForm);
  }, [contactCustomFields.data]);

  useEffect(() => {
    if (open) {
      setName(pushName || "");
      setEmail("");
      setNotes("");
      setCustomFieldValues({});
    }
  }, [open, pushName]);

  const createContact = trpc.crm.contacts.create.useMutation();
  const setFieldValues = trpc.contactProfile.setCustomFieldValues.useMutation();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const cleaned = phone.replace(/\D/g, "");
      const formatted = cleaned.startsWith("55") ? `+${cleaned}` : `+55${cleaned}`;
      const result = await createContact.mutateAsync({
        tenantId,
        name: name.trim(),
        phone: formatted,
        email: email.trim() || undefined,
      });
      // Save custom field values
      const cfEntries = customFieldValuesToArray(customFieldValues).filter(v => v.value);
      if (cfEntries.length > 0 && (result as any)?.id) {
        await setFieldValues.mutateAsync({
          tenantId,
          entityType: "contact",
          entityId: (result as any).id,
          values: cfEntries,
        });
      }
      toast.success(`Contato "${name.trim()}" criado com sucesso`);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar contato");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-border/50" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-wa-tint flex items-center justify-center">
              <UserPlus className="w-[18px] h-[18px] text-white" />
            </div>
            <h3 className="text-[16px] font-semibold text-foreground">Novo Contato</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
            <Phone className="w-5 h-5 text-wa-tint" />
            <div>
              <p className="text-xs text-muted-foreground">Telefone (WhatsApp)</p>
              <p className="text-sm font-medium text-foreground">{formattedPhone}</p>
            </div>
          </div>
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Nome *</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nome do contato"
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-wa-tint focus:ring-1 focus:ring-wa-tint/30 transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-wa-tint focus:ring-1 focus:ring-wa-tint/30 transition-colors"
            />
          </div>
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Observações</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre o contato..."
              rows={2}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-wa-tint focus:ring-1 focus:ring-wa-tint/30 resize-none transition-colors"
            />
          </div>
          {/* Custom Fields */}
          {formFields.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-[13px] text-muted-foreground mb-2 font-medium">Campos Personalizados</p>
              <CustomFieldRenderer
                fields={formFields}
                values={customFieldValues}
                onChange={(fieldId, value) => setCustomFieldValues(prev => ({ ...prev, [fieldId]: value }))}
                mode="form"
                compact
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="px-4 py-2 text-sm text-white bg-wa-tint hover:opacity-90 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar Contato
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CREATE DEAL DIALOG
   ═══════════════════════════════════════════════════════ */

function CreateDealDialog({
  open, onClose, contactName, contactPhone, contactJid, sessionId,
}: {
  open: boolean; onClose: () => void; contactName: string; contactPhone: string; contactJid: string; sessionId: string;
}) {
  const tenantId = useTenantId();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState(`Negociação - ${contactName}`);
  const [value, setValue] = useState("");
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});

  const pipelinesQ = trpc.crm.pipelines.list.useQuery({ tenantId });
  const pipelines = (pipelinesQ.data || []) as any[];
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);

  const stagesQ = trpc.crm.pipelines.stages.useQuery(
    { tenantId, pipelineId: selectedPipelineId! },
    { enabled: !!selectedPipelineId }
  );
  const stages = (stagesQ.data || []) as any[];
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);

  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) setSelectedPipelineId(pipelines[0].id);
  }, [pipelines, selectedPipelineId]);

  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) setSelectedStageId(stages[0].id);
  }, [stages, selectedStageId]);

  useEffect(() => {
    if (open) setTitle(`Negociação - ${contactName}`);
  }, [open, contactName]);

  const createDeal = trpc.crm.deals.create.useMutation();
  const createContact = trpc.crm.contacts.create.useMutation();
  const contactsQ = trpc.crm.contacts.list.useQuery({ tenantId, limit: 500 });
  const setFieldValues = trpc.contactProfile.setCustomFieldValues.useMutation();

  // Load custom fields for deals
  const dealCustomFields = trpc.customFields.list.useQuery(
    { tenantId, entity: "deal" as const },
    { enabled: open }
  );
  const formFields = useMemo(() => {
    return ((dealCustomFields.data || []) as CustomFieldDef[]).filter(f => f.isVisibleOnForm);
  }, [dealCustomFields.data]);

  const handleCreate = async () => {
    if (!title.trim() || !selectedPipelineId || !selectedStageId) return;
    try {
      const cleaned = contactPhone.replace(/\D/g, "");
      const formatted = cleaned.startsWith("55") ? `+${cleaned}` : `+55${cleaned}`;
      const contacts = ((contactsQ.data as any)?.items || contactsQ.data || []) as any[];
      let contactId = contacts.find((c: any) => {
        const cPhone = c.phone?.replace(/\D/g, "") || "";
        return cPhone === cleaned || cPhone === cleaned.replace(/^55/, "") || `55${cPhone}` === cleaned;
      })?.id;

      if (!contactId) {
        const newContact = await createContact.mutateAsync({
          tenantId, name: contactName, phone: formatted,
        });
        contactId = (newContact as any).id;
      }

      const deal = await createDeal.mutateAsync({
        tenantId, title: title.trim(),
        pipelineId: selectedPipelineId, stageId: selectedStageId,
        contactId: contactId || undefined,
      });
      // Save custom field values for the deal
      const cfEntries = customFieldValuesToArray(customFieldValues).filter(v => v.value);
      if (cfEntries.length > 0 && (deal as any)?.id) {
        await setFieldValues.mutateAsync({
          tenantId,
          entityType: "deal",
          entityId: (deal as any).id,
          values: cfEntries,
        });
      }
      toast.success("Negociação criada com sucesso!");
      onClose();
      navigate(`/deal/${(deal as any).id}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar negociação");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-border/50" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <Briefcase className="w-[18px] h-[18px] text-white" />
            </div>
            <h3 className="text-[16px] font-semibold text-foreground">Nova Negociação</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Título *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
          </div>
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Valor (R$)</label>
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00"
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
          </div>
          {pipelines.length > 0 && (
            <div>
              <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Pipeline</label>
              <select value={selectedPipelineId || ""} onChange={(e) => { setSelectedPipelineId(Number(e.target.value)); setSelectedStageId(null); }}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary">
                {pipelines.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          {stages.length > 0 && (
            <div>
              <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Etapa</label>
              <select value={selectedStageId || ""} onChange={(e) => setSelectedStageId(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary">
                {stages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {/* Custom Fields */}
          {formFields.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-[13px] text-muted-foreground mb-2 font-medium">Campos Personalizados</p>
              <CustomFieldRenderer
                fields={formFields}
                values={customFieldValues}
                onChange={(fieldId, value) => setCustomFieldValues(prev => ({ ...prev, [fieldId]: value }))}
                mode="form"
                compact
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors">Cancelar</button>
          <button onClick={handleCreate} disabled={!title.trim() || !selectedStageId}
            className="px-4 py-2 text-sm text-white bg-primary hover:opacity-90 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2">
            Criar Negociação
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   NEW CHAT PANEL (slide-over)
   ═══════════════════════════════════════════════════════ */

function NewChatPanel({
  open, onClose, onSelectJid, sessionId,
}: {
  open: boolean; onClose: () => void; onSelectJid: (jid: string, name: string) => void; sessionId: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");

  const tenantId = useTenantId();
  const contactsQ = trpc.crm.contacts.list.useQuery({ tenantId, limit: 500 }, { enabled: open });
  const trpcUtils = trpc.useUtils();

  const contacts = useMemo(() => {
    const list = (((contactsQ.data as any)?.items || contactsQ.data || []) as any) as Array<{ id: number; name: string; phone?: string | null; email?: string | null; accountName?: string | null }>;
    if (!searchTerm.trim()) return list.filter((c) => c.phone);
    const q = searchTerm.toLowerCase();
    return list.filter((c) => c.phone && (c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || (c.accountName && c.accountName.toLowerCase().includes(q))));
  }, [contactsQ.data, searchTerm]);

  const handleSelectContact = async (contact: { name: string; phone?: string | null }) => {
    if (!contact.phone) return;
    setResolving(true); setResolveError("");
    try {
      const result = await trpcUtils.whatsapp.resolveJid.fetch({ sessionId, phone: contact.phone });
      if (result.jid) { onSelectJid(result.jid, contact.name); onClose(); }
      else setResolveError(`${contact.name} não está no WhatsApp`);
    } catch { setResolveError("Erro ao verificar número no WhatsApp"); }
    finally { setResolving(false); }
  };

  const handlePhoneSubmit = async () => {
    const cleaned = phoneInput.replace(/\D/g, "");
    if (cleaned.length < 8) { setResolveError("Digite um número válido"); return; }
    setResolving(true); setResolveError("");
    try {
      const result = await trpcUtils.whatsapp.resolveJid.fetch({ sessionId, phone: cleaned });
      if (result.jid) { onSelectJid(result.jid, formatPhoneNumber(result.jid)); onClose(); }
      else setResolveError("Número não encontrado no WhatsApp");
    } catch { setResolveError("Erro ao verificar número no WhatsApp"); }
    finally { setResolving(false); }
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-wa-panel" style={{ animation: "slideInLeft 0.2s ease-out" }}>
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0 h-[59px] px-4 bg-wa-panel-header border-b border-wa-divider">
        <button
          onClick={() => { onClose(); setSearchTerm(""); setPhoneInput(""); setResolveError(""); }}
          className="w-[28px] h-[28px] flex items-center justify-center text-foreground hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="w-[20px] h-[20px]" />
        </button>
        <h2 className="text-[16px] font-medium text-foreground">Nova conversa</h2>
      </div>

      {/* Search */}
      <div className="shrink-0 px-3 py-[7px] bg-wa-panel">
        <div className="flex items-center rounded-lg overflow-hidden h-[35px] bg-wa-search-bg px-3">
          <Search className="shrink-0 w-4 h-4 text-muted-foreground" />
          <input
            type="text" placeholder="Pesquisar contatos" value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-foreground placeholder:text-muted-foreground pl-3 h-full"
            autoFocus
          />
        </div>
      </div>

      {/* Phone input */}
      <div className="shrink-0 px-4 py-3 border-b border-wa-divider">
        <label className="text-[12px] text-muted-foreground uppercase tracking-wide font-medium mb-2 block">Digitar número</label>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg text-sm text-muted-foreground shrink-0">
            <span>🇧🇷</span><span>+55</span>
          </div>
          <input
            type="tel" placeholder="(84) 99999-9999" value={phoneInput}
            onChange={(e) => { setPhoneInput(e.target.value); setResolveError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handlePhoneSubmit(); }}
            className="flex-1 px-3 py-2 border border-border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:border-wa-tint focus:ring-1 focus:ring-wa-tint/30 transition-colors"
          />
          <button onClick={handlePhoneSubmit} disabled={resolving || phoneInput.replace(/\D/g, "").length < 8}
            className="px-3 py-2 bg-wa-tint text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1">
            {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
          </button>
        </div>
        {resolveError && <p className="text-[12px] text-destructive mt-1.5">{resolveError}</p>}
      </div>

      {/* Contacts list */}
      <div className="shrink-0 px-4 pt-3 pb-1">
        <p className="text-[12px] text-wa-tint uppercase tracking-wide font-medium">Contatos do CRM ({contacts.length})</p>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ overscrollBehavior: "contain" }}>
        {contactsQ.isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-wa-tint animate-spin" /></div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Phone className="w-10 h-10 text-muted-foreground/20 mb-2" />
            <p className="text-[13px] text-muted-foreground">{searchTerm ? "Nenhum contato encontrado" : "Nenhum contato com telefone cadastrado"}</p>
          </div>
        ) : contacts.map((contact) => (
          <button
            key={contact.id} onClick={() => handleSelectContact(contact)} disabled={resolving}
            className="w-full flex items-center gap-3 px-4 py-[10px] hover:bg-wa-hover transition-colors text-left disabled:opacity-60"
          >
            <WaAvatar name={contact.name} size={49} />
            <div className="flex-1 min-w-0 border-b border-wa-divider py-[6px]">
              <p className="text-[15px] text-foreground truncate">{contact.name}</p>
              <p className="text-[13px] text-muted-foreground truncate">
                {contact.phone || "Sem telefone"}{contact.accountName ? ` · ${contact.accountName}` : ""}
              </p>
            </div>
          </button>
        ))}
      </div>

      {resolving && (
        <div className="absolute inset-0 z-30 bg-wa-panel/70 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-wa-tint animate-spin" />
            <p className="text-[14px] text-muted-foreground">Verificando no WhatsApp...</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   EMPTY CHAT STATE — ENTUR OS branded
   ═══════════════════════════════════════════════════════ */

function EmptyChat() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--wa-search-bg)' }}>
      <div className="text-center max-w-[500px] px-8">
        <div className="w-[320px] h-[188px] mx-auto mb-[28px] rounded-full bg-[var(--wa-tint)]/5 flex items-center justify-center">
          <MessageSquare className="w-16 h-16" style={{ color: 'var(--wa-tint)', opacity: 0.4 }} />
        </div>
        <h1 className="text-[32px] font-light leading-tight mb-[14px]" style={{ color: 'var(--wa-text-primary)' }}>
          Entur WhatsApp
        </h1>
        <p className="text-[14px] leading-[20px]" style={{ color: 'var(--wa-text-secondary)' }}>
          Envie e receba mensagens sem precisar manter o celular conectado.
          <br />
          Use em até 4 aparelhos vinculados e 1 celular ao mesmo tempo.
        </p>
        <div className="mt-[40px] pt-[16px]">
          <p className="text-[13px] flex items-center justify-center gap-[6px]" style={{ color: 'var(--wa-text-secondary)', opacity: 0.6 }}>
            <Lock className="w-[13px] h-[13px]" />
            Suas mensagens pessoais são protegidas com criptografia de ponta a ponta
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   NO SESSION STATE
   ═══════════════════════════════════════════════════════ */

function NoSession() {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 rounded-full bg-wa-tint/10 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-10 h-10 text-wa-tint" />
        </div>
        <h2 className="text-xl font-medium text-foreground mb-2">WhatsApp não conectado</h2>
        <p className="text-[14px] text-muted-foreground mb-4">
          Conecte seu WhatsApp para enviar e receber mensagens diretamente pelo sistema.
        </p>
        <a href="/whatsapp"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-wa-tint text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all">
          <Phone className="w-4 h-4" />
          Conectar WhatsApp
        </a>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN INBOX PAGE
   ═══════════════════════════════════════════════════════ */

type InboxTab = "mine" | "queue" | "contacts" | "all";
type AgentFilter = "all" | "unread" | "mine" | "unassigned";

export default function InboxPage() {
  const tenantId = useTenantId();
  const trpcUtils = trpc.useUtils();
  const { lastMessage, lastStatusUpdate, lastConversationUpdate, isConnected: socketConnected } = useSocket();
  // selectedKey = conversationKey (sessionId:remoteJid) — primary selection state
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // selectedJid = remoteJid only — derived for API calls that need just the JID
  const selectedJid = selectedKey ? getJidFromKey(selectedKey) : null;
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [activeTab, setActiveTab] = useState<InboxTab>("mine");
  const [filter, setFilter] = useState<AgentFilter>("all");
  const isAdmin = useIsAdmin();
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) === "true"; } catch { return false; }
  });
  const selectedKeyRef = useRef<string | null>(null);
  // Keep ref in sync with state so socket handler closure always has the latest value
  selectedKeyRef.current = selectedKey;
  const prevMessageRef = useRef<typeof lastMessage>(null);
  // Suppress notification sounds temporarily when opening a conversation
  // This prevents sounds from firing during message hydration/syncOnOpen
  const soundSuppressedUntilRef = useRef<number>(0);
  // Track processed message signatures to avoid duplicate sounds
  const processedMsgRef = useRef<Set<string>>(new Set());

  // ─── Data queries ───
  const sessionsQ = trpc.whatsapp.sessions.useQuery();
  // Find connected session first, otherwise use any session for offline history viewing
  const activeSession = useMemo(
    () => {
      const sessions = sessionsQ.data || [];
      const connected = sessions.find((s: any) => s.liveStatus === "connected");
      if (connected) return connected;
      // Fallback: use first session from DB so we can still show conversation history
      return sessions.length > 0 ? sessions[0] : undefined;
    },
    [sessionsQ.data]
  );
  const isConnected = useMemo(
    () => (sessionsQ.data || []).some((s: any) => s.liveStatus === "connected"),
    [sessionsQ.data]
  );

  // ─── Deterministic Conversation Store ───
  // Socket is the source of truth. Initial load from server, then all updates via socket.
  const convStore = useConversationStore();
  const hydrationDoneRef = useRef(false);

  // Initial load only — fetch conversations once from server
  const conversationsQ = trpc.whatsapp.waConversations.useQuery(
    { sessionId: activeSession?.sessionId || "", tenantId },
    { enabled: !!activeSession?.sessionId && !hydrationDoneRef.current, staleTime: Infinity, refetchInterval: false, refetchOnWindowFocus: false }
  );

  // Hydrate store from initial server data (runs once)
  useEffect(() => {
    if (conversationsQ.data && !hydrationDoneRef.current) {
      convStore.hydrate(conversationsQ.data as ConvEntry[]);
      hydrationDoneRef.current = true;
    }
  }, [conversationsQ.data]);

  // Periodic background sync — only when socket is DISCONNECTED (fallback)
  // When socket is connected, the store is updated in real-time via socket events.
  const bgSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!activeSession?.sessionId || !hydrationDoneRef.current) return;
    // Clear any existing interval
    if (bgSyncRef.current) clearInterval(bgSyncRef.current);
    
    // RECONCILIATION STRATEGY:
    // - Socket disconnected: aggressive polling every 15s to catch up
    // - Socket connected: lightweight reconciliation every 60s to fix any drift
    //   (e.g., missed socket events, race conditions, stale preview/status)
    const interval = socketConnected ? 60000 : 15000;
    bgSyncRef.current = setInterval(() => {
      conversationsQ.refetch().then((result) => {
        if (result.data) {
          convStore.hydrate(result.data as ConvEntry[]);
        }
      });
    }, interval);
    
    return () => { if (bgSyncRef.current) clearInterval(bgSyncRef.current); };
  }, [activeSession?.sessionId, socketConnected]);

  // Agents list for assignment
  const agentsQ = trpc.whatsapp.agents.useQuery({ tenantId }, { staleTime: 5 * 60 * 1000 });
  const agents = useMemo(() => (agentsQ.data || []) as Array<{ id: number; name: string; email: string; avatarUrl?: string | null; status: string }>, [agentsQ.data]);

  // Queue conversations
  const queueQ = trpc.whatsapp.queue.list.useQuery(
    { sessionId: activeSession?.sessionId || "", limit: 100 },
    { enabled: !!activeSession?.sessionId && (activeTab === "queue" || activeTab === "all"), refetchInterval: socketConnected ? 30000 : 10000, staleTime: 5000 }
  );
  const queueStatsQ = trpc.whatsapp.queue.stats.useQuery(
    { sessionId: activeSession?.sessionId || "" },
    { enabled: !!activeSession?.sessionId, refetchInterval: socketConnected ? 60000 : 15000, staleTime: 10000 }
  );
  const claimMutation = trpc.whatsapp.queue.claim.useMutation({
    onSuccess: (_data, variables) => {
      queueQ.refetch(); queueStatsQ.refetch();
      // Optimistically update convStore so the conversation appears in "mine" tab immediately
      const key = makeConvKey(variables.sessionId, variables.remoteJid);
      convStore.updateAssignment(key, {
        assignedUserId: myUserId,
        assignmentStatus: "open",
      });
      // Also refetch conversations to get full data if not in store yet
      conversationsQ.refetch();
      toast.success("Conversa atribuída a você");
    },
    onError: (e) => toast.error(e.message || "Erro ao puxar conversa"),
  });

  // Assign from queue to specific agent (admin only)
  const [assigningQueueJid, setAssigningQueueJid] = useState<string | null>(null);
  const [selectedAgentForQueue, setSelectedAgentForQueue] = useState<number | null>(null);
  const assignFromQueueMut = trpc.whatsapp.supervision.assignToAgent.useMutation({
    onSuccess: () => {
      queueQ.refetch(); queueStatsQ.refetch();
      toast.success("Conversa atribuída ao agente");
      setAssigningQueueJid(null); setSelectedAgentForQueue(null);
    },
    onError: (e) => toast.error(e.message || "Erro ao atribuir"),
  });

  // Finish attendance mutation
  const finishMut = trpc.whatsapp.finishAttendance.useMutation({
    onSuccess: (_data, variables) => {
      queueStatsQ.refetch();
      // Optimistically update convStore so the conversation disappears from "mine" tab immediately
      const key = makeConvKey(variables.sessionId, variables.remoteJid);
      convStore.updateAssignment(key, {
        assignedUserId: null,
        assignmentStatus: "resolved",
      });
      toast.success("Atendimento finalizado");
      setSelectedKey(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao finalizar"),
  });

  const handleFinishAttendance = useCallback((remoteJid: string) => {
    if (!activeSession?.sessionId) return;
    finishMut.mutate({ sessionId: activeSession.sessionId, remoteJid });
  }, [activeSession?.sessionId, finishMut]);

  // WA Contacts for Contacts tab (reuse waContactsMap but as a list)
  const waContactsForTabQ = trpc.whatsapp.waContactsMap.useQuery(
    { sessionId: activeSession?.sessionId || "" },
    { enabled: !!activeSession?.sessionId && activeTab === "contacts", staleTime: 5 * 60 * 1000 }
  );
  const waContactsList = useMemo(() => {
    const map = waContactsForTabQ.data || {};
    return Object.entries(map)
      .map(([jid, c]) => ({
        jid,
        phoneNumber: c.phoneNumber,
        pushName: c.pushName,
        savedName: c.savedName,
        verifiedName: c.verifiedName,
        displayName: c.savedName || c.verifiedName || c.pushName || formatPhoneNumber(jid),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [waContactsForTabQ.data]);

  // Assignment mutations
  const assignMutation = trpc.whatsapp.assignConversation.useMutation({
    onSuccess: () => { queueQ.refetch(); queueStatsQ.refetch(); toast.success("Conversa atribuída com sucesso"); },
    onError: (e) => toast.error(e.message || "Erro ao atribuir conversa"),
  });
  const updateStatusMutation = trpc.whatsapp.updateAssignmentStatus.useMutation({});

  const contactsQ = trpc.crm.contacts.list.useQuery(
    { tenantId, limit: 500 },
    { enabled: true, staleTime: 5 * 60 * 1000 }
  );

  // Profile pictures — derive from store (no dependency on conversationsQ.data)
  const convJids = useMemo(() => {
    return convStore.sortedIds.map(key => getJidFromKey(key));
  }, [convStore.sortedIds]);

  // Fetch profile pics from DB (fast query, no API calls) — can handle more
  const visibleJids = useMemo(() => convJids.slice(0, 100), [convJids]);
  const profilePicsQ = trpc.whatsapp.profilePictures.useQuery(
    { sessionId: activeSession?.sessionId || "", jids: visibleJids },
    { enabled: !!activeSession?.sessionId && visibleJids.length > 0, staleTime: 30 * 60 * 1000, refetchInterval: false }
  );

  const profilePicMap = useMemo(() => (profilePicsQ.data || {}) as Record<string, string | null>, [profilePicsQ.data]);

  // WA Contacts map (LID ↔ Phone resolution from Baileys contacts sync)
  const waContactsMapQ = trpc.whatsapp.waContactsMap.useQuery(
    { sessionId: activeSession?.sessionId || "" },
    { enabled: !!activeSession?.sessionId, staleTime: 10 * 60 * 1000, refetchInterval: false }
  );
  const waContactsMap = useMemo(() => (waContactsMapQ.data || {}) as Record<string, { phoneNumber: string | null; pushName: string | null; savedName: string | null; verifiedName: string | null }>, [waContactsMapQ.data]);

  // Sync contacts mutation
  const syncContactsMut = trpc.whatsapp.syncContacts.useMutation({
    onSuccess: (data: any) => {
      waContactsMapQ.refetch();
      const resolvedMsg = data.resolved > 0 ? ` (${data.resolved} LIDs resolvidos)` : "";
      toast.success(`Contatos sincronizados: ${data.synced}/${data.total}${resolvedMsg}`);
    },
    onError: (e) => toast.error(e.message || "Erro ao sincronizar contatos"),
  });

  // PushName map from store (instant, no conversationsQ dependency)
  const pushNameMap = useMemo(() => {
    const map = new Map<string, string>();
    Array.from(convStore.conversationMap.entries()).forEach(([key, conv]) => {
      const jid = getJidFromKey(key);
      if (conv.contactPushName) map.set(jid, conv.contactPushName);
    });
    return map;
  }, [convStore.version]);

  // Mark as read
  const markRead = trpc.whatsapp.markRead.useMutation({
    // Part 8: No full refetch — unreadCount already set to 0 optimistically in handleSelectConv
  });

  // Contact name map (CRM phone → contact info)
  const contactNameMap = useMemo(() => {
    const map = new Map<string, { id: number; name: string; phone: string; email?: string; avatarUrl?: string }>();
    for (const c of (((contactsQ.data as any)?.items || contactsQ.data || []) as any[])) {
      if (c.phone) {
        const cleaned = c.phone.replace(/\D/g, "");
        const entry = { id: c.id, name: c.name, phone: c.phone, email: c.email || undefined, avatarUrl: undefined };
        map.set(cleaned, entry);
        if (cleaned.startsWith("55")) map.set(cleaned.substring(2), entry);
        else map.set(`55${cleaned}`, entry);
      }
    }
    return map;
  }, [contactsQ.data]);

  const getContactForJid = useCallback((jid: string) => {
    const phone = jid.split("@")[0];
    const directMatch = contactNameMap.get(phone);
    if (directMatch) return directMatch;
    // For LID JIDs, resolve via waContactsMap to get the real phone number
    if (jid.endsWith("@lid")) {
      const waContact = waContactsMap[jid];
      if (waContact?.phoneNumber) {
        const resolvedPhone = waContact.phoneNumber.split("@")[0];
        return contactNameMap.get(resolvedPhone) || null;
      }
    }
    return null;
  }, [contactNameMap, waContactsMap]);

  const isRealName = useCallback((name: string | null | undefined): boolean => {
    if (!name || !name.trim()) return false;
    const cleaned = name.replace(/[\s\-\(\)\+]/g, "");
    return !/^\d+$/.test(cleaned);
  }, []);

  const getDisplayName = useCallback((jid: string, conv?: ConvItem) => {
    // 1. CRM contact match — only use if the name is a real name (not just a phone number)
    const contact = getContactForJid(jid);
    if (contact && isRealName(contact.name)) return contact.name;
    // 2. contactName from wa_conversations JOIN with contacts table
    if (conv?.contactName && isRealName(conv.contactName)) return conv.contactName;
    // 3. WA Contacts map (savedName > verifiedName > pushName)
    const waContact = waContactsMap[jid];
    if (waContact) {
      if (isRealName(waContact.savedName)) return waContact.savedName!;
      if (isRealName(waContact.verifiedName)) return waContact.verifiedName!;
      if (isRealName(waContact.pushName)) return waContact.pushName!;
    }
    // 4. PushName from conversation data (contactPushName in wa_conversations)
    const pushName = pushNameMap.get(jid);
    if (isRealName(pushName)) return pushName!;
    // 5. CRM contact name as fallback (even if it's a phone number, it's still better than raw JID)
    if (contact) return contact.name;
    // 6. For LID JIDs, try to show a resolved phone number instead of the LID
    if (jid.endsWith("@lid")) {
      if (waContact?.phoneNumber) return formatPhoneNumber(waContact.phoneNumber);
      return "Contato WhatsApp";
    }
    // 7. Format the phone number from the JID
    return formatPhoneNumber(jid);
  }, [getContactForJid, pushNameMap, waContactsMap, isRealName]);

  // ─── Socket → Deterministic Store (instant updates) ───
  // Socket is the ONLY source of truth for conversation list updates.
  // No refetch, no polling, no full sort. Target: < 20ms per update.
  useEffect(() => {
    if (!lastMessage) return;
    const _traceReceiveTime = Date.now();
    const _traceEmitAt = (lastMessage as any)._traceEmitAt;
    const _traceMsgId = (lastMessage as any).messageId || 'N/A';
    console.log(`[TRACE][FRONTEND_SOCKET_RECEIVED] timestamp: ${_traceReceiveTime} | delta_from_emit: ${_traceEmitAt ? _traceReceiveTime - _traceEmitAt : 'N/A'}ms | msgId: ${_traceMsgId} | remoteJid: ${lastMessage.remoteJid?.substring(0, 15)}`);

    // ── Validation — ignore events without required fields ──
    if (!lastMessage.remoteJid || !lastMessage.timestamp) {
      console.log(`[TRACE][FILTER_DROPPED] reason: missing_fields | remoteJid: ${lastMessage.remoteJid} | timestamp: ${lastMessage.timestamp} | msgId: ${_traceMsgId}`);
      prevMessageRef.current = lastMessage;
      return;
    }

    // ── Strict Message Ownership — validate sessionId matches active session ──
    const currentSessionId = activeSession?.sessionId || "";
    if (lastMessage.sessionId && currentSessionId && lastMessage.sessionId !== currentSessionId) {
      console.log(`[TRACE][FILTER_DROPPED] reason: session_mismatch | msg_session: ${lastMessage.sessionId} | active_session: ${currentSessionId} | msgId: ${_traceMsgId}`);
      prevMessageRef.current = lastMessage;
      return;
    }

    // Skip non-inbox event types from preview update
    const previewSkipTypes = [
      'protocolMessage', 'senderKeyDistributionMessage', 'messageContextInfo',
      'ephemeralMessage', 'reactionMessage', 'editedMessage',
      'deviceSentMessage', 'bcallMessage', 'callLogMesssage',
      'keepInChatMessage', 'encReactionMessage', 'viewOnceMessageV2Extension',
    ];
    if (previewSkipTypes.includes(lastMessage.messageType)) {
      prevMessageRef.current = lastMessage;
      return;
    }

    // Skip group messages
    if (lastMessage.remoteJid?.endsWith('@g.us')) {
      prevMessageRef.current = lastMessage;
      return;
    }

    // ── INSTANT UPDATE via deterministic store ──
    // handleMessage: O(1) map update + O(n) splice for moveToTop
    // No full sort, no refetch, no cache invalidation
    const _traceStoreStart = Date.now();
    // CRITICAL: Use content directly from socket event — backend guarantees it matches DB preview.
    // No more frontend-side preview generation that could diverge from the DB.
    const handled = convStore.handleMessage({
      sessionId: lastMessage.sessionId || currentSessionId,
      remoteJid: lastMessage.remoteJid,
      content: lastMessage.content || getMessagePreview(null, lastMessage.messageType),
      fromMe: lastMessage.fromMe,
      messageType: lastMessage.messageType,
      timestamp: lastMessage.timestamp,
      status: (lastMessage as any).status,  // Backend now sends status in socket event
      isSync: (lastMessage as any).isSync,
    }, selectedKeyRef.current);
    const _traceStoreEnd = Date.now();
    console.log(`[TRACE][STORE_UPDATED] timestamp: ${_traceStoreEnd} | delta: ${_traceStoreEnd - _traceStoreStart}ms | handled: ${handled} | msgId: ${_traceMsgId}`);
    console.log(`[TRACE][TOTAL_FRONTEND] timestamp: ${_traceStoreEnd} | total_frontend_processing: ${_traceStoreEnd - _traceReceiveTime}ms | total_from_emit: ${_traceEmitAt ? _traceStoreEnd - _traceEmitAt : 'N/A'}ms | msgId: ${_traceMsgId}`);

    // If conversation is new (not in store), do a one-time fetch
    if (!handled) {
      console.log(`[TRACE][NEW_CONV_REFETCH] timestamp: ${Date.now()} | msgId: ${_traceMsgId} — conversation not in store, triggering refetch`);
      conversationsQ.refetch().then((result) => {
        if (result.data) convStore.hydrate(result.data as ConvEntry[]);
        console.log(`[TRACE][NEW_CONV_REFETCH_DONE] timestamp: ${Date.now()} | msgId: ${_traceMsgId}`);
      });
    }

    // ────────────────────────────────────────────────────────────────────────────────
    // Notification Sound Guards
    // ────────────────────────────────────────────────────────────────────────────────
    const msgSig = `${lastMessage.remoteJid}:${lastMessage.content}:${lastMessage.timestamp}`;

    // Guard 1: Skip duplicate messages
    if (processedMsgRef.current.has(msgSig)) {
      prevMessageRef.current = lastMessage;
      return;
    }
    if (processedMsgRef.current.size > 100) processedMsgRef.current.clear();
    processedMsgRef.current.add(msgSig);

    // Guard 2: NEVER play for fromMe messages
    if (lastMessage.fromMe) { prevMessageRef.current = lastMessage; return; }

    // Guard 3: Skip sync batches
    if ((lastMessage as any).isSync || (lastMessage as any).syncBatch) { prevMessageRef.current = lastMessage; return; }

    // Guard 4: Skip non-inbox event types for sound
    const skipTypes = [
      'protocolMessage', 'senderKeyDistributionMessage', 'messageContextInfo',
      'ephemeralMessage', 'reactionMessage', 'editedMessage',
      'internal_note', 'deviceSentMessage', 'bcallMessage',
      'callLogMesssage', 'keepInChatMessage', 'encReactionMessage',
      'viewOnceMessageV2Extension',
    ];
    if (skipTypes.includes(lastMessage.messageType)) { prevMessageRef.current = lastMessage; return; }

    // Guard 5: Skip group messages
    if (lastMessage.remoteJid?.endsWith('@g.us')) { prevMessageRef.current = lastMessage; return; }

    // Guard 6: Skip if muted
    if (isMuted) { prevMessageRef.current = lastMessage; return; }

    // Guard 7: Skip if sound is suppressed (conversation just opened / hydration)
    if (Date.now() < soundSuppressedUntilRef.current) { prevMessageRef.current = lastMessage; return; }

    // Guard 8: Skip if this is the currently viewed conversation
    const currentJid = selectedKeyRef.current ? getJidFromKey(selectedKeyRef.current) : null;
    if (currentJid === lastMessage.remoteJid) { prevMessageRef.current = lastMessage; return; }

    // All guards passed — play notification
    playNotification();
    prevMessageRef.current = lastMessage;
  }, [lastMessage]);

  // Status update via deterministic store — O(1)
  useEffect(() => {
    if (!lastStatusUpdate) return;
    const remoteJid = lastStatusUpdate.remoteJid;
    if (!remoteJid) return;
    const sid = lastStatusUpdate.sessionId || activeSession?.sessionId || "";
    convStore.handleStatusUpdate({ sessionId: sid, remoteJid, status: lastStatusUpdate.status });
  }, [lastStatusUpdate]);

  // ── Assignment/ownership changes via socket — instant tab movement ──
  useEffect(() => {
    if (!lastConversationUpdate) return;
    const { type, sessionId: evtSessionId, remoteJid, assignedUserId, status } = lastConversationUpdate as any;
    if (!remoteJid) return;
    const sid = evtSessionId || activeSession?.sessionId || "";
    const key = makeConvKey(sid, remoteJid);

    // Update the conversation store with new assignment data
    if (type === "assignment" || type === "claimed" || type === "transfer") {
      convStore.updateAssignment(key, {
        assignedUserId: assignedUserId ?? null,
        assignmentStatus: "open",
      });
    } else if (type === "enqueued") {
      convStore.updateAssignment(key, {
        assignedUserId: null,
        assignmentStatus: "open",
      });
    } else if (type === "finished") {
      convStore.updateAssignment(key, {
        assignedUserId: null,
        assignmentStatus: status || "resolved",
      });
    } else if (type === "status_change") {
      convStore.updateAssignment(key, {
        assignmentStatus: status || null,
      });
    }

    // Invalidate queue stats for instant badge update
    queueStatsQ.refetch();
  }, [lastConversationUpdate]);

  // Select conversation
  // Sync on conversation open — lightweight fetch of last 10 messages
  const syncOnOpen = trpc.whatsapp.syncOnOpen.useMutation();
  const handleSelectConv = useCallback((jid: string) => {
    const key = makeConvKey(activeSession?.sessionId || "", jid);
    setSelectedKey(key);
    setShowMobileChat(true);

    // ── Suppress notification sounds for 2 seconds while conversation loads ──
    soundSuppressedUntilRef.current = Date.now() + 2000;

    // ── Instant: mark read in deterministic store (O(1), no refetch) ──
    convStore.markRead(key);

    if (activeSession?.sessionId) {
      markRead.mutate({ sessionId: activeSession.sessionId, remoteJid: jid });
      // Find conversationId from store (O(1) lookup)
      const conv = convStore.getConversation(key);
      if (conv?.conversationId) {
        syncOnOpen.mutate(
          { sessionId: activeSession.sessionId, remoteJid: jid, conversationId: conv.conversationId },
          {
            onSuccess: (r) => {
              // Only re-hydrate if new messages were inserted during sync
              if (r.inserted > 0) {
                conversationsQ.refetch().then((result) => {
                  if (result.data) convStore.hydrate(result.data as ConvEntry[]);
                });
              }
            }
          }
        );
      }
    }
  }, [activeSession?.sessionId, markRead, syncOnOpen, tenantId, convStore]);

  // View queue conversation WITHOUT auto-claiming
  const handleSelectQueueConv = useCallback((jid: string) => {
    const key = makeConvKey(activeSession?.sessionId || "", jid);
    setSelectedKey(key);
    setShowMobileChat(true);
    // Do NOT auto-claim — user must click "Puxar" or "Atribuir" explicitly
  }, []);

  // Current user ID for filtering "mine" tab
  const meQ = trpc.auth.me.useQuery();
  const myUserId = useMemo(() => (meQ.data as any)?.saasUser?.userId || (meQ.data as any)?.id || 0, [meQ.data]);

  // ─── Render from deterministic store (pre-sorted, pre-deduped) ───
  // Store already maintains sorted order via moveToTop. No full sort needed.
  const dedupedConvs = useMemo(() => {
    return convStore.getSorted() as ConvItem[];
  }, [convStore.version]);

  // Filter by tab, unread, and search
  const filteredConvs = useMemo(() => {
    let convs = dedupedConvs;
    // Tab-based primary filter
    if (activeTab === "mine") {
      convs = convs.filter((c) => c.assignedUserId === myUserId);
    } else if (activeTab === "queue") {
      // Queue tab uses its own data source, return empty for main list
      return [];
    } else if (activeTab === "contacts") {
      // Contacts tab uses its own data source
      return [];
    }
    // "all" tab shows everything
    // Secondary filter (within tab)
    if (filter === "unread") convs = convs.filter((c) => Number(c.unreadCount) > 0);
    // Search filter
    if (search) {
      const s = search.toLowerCase();
      convs = convs.filter((c) => {
        const name = getDisplayName(c.remoteJid, c).toLowerCase();
        const phone = c.remoteJid.split("@")[0];
        return name.includes(s) || phone.includes(s);
      });
    }
    return convs;
  }, [dedupedConvs, search, filter, activeTab, getDisplayName, myUserId, convStore.version]);

  // Queue conversations filtered by search
  const filteredQueueConvs = useMemo(() => {
    if (activeTab !== "queue") return [];
    let convs = (queueQ.data || []) as ConvItem[];
    if (search) {
      const s = search.toLowerCase();
      convs = convs.filter((c) => {
        const name = getDisplayName(c.remoteJid, c).toLowerCase();
        const phone = c.remoteJid.split("@")[0];
        return name.includes(s) || phone.includes(s);
      });
    }
    return convs;
  }, [queueQ.data, search, activeTab, getDisplayName]);

  // WA Contacts filtered by search
  const filteredWaContacts = useMemo(() => {
    if (activeTab !== "contacts") return [];
    if (!search) return waContactsList;
    const s = search.toLowerCase();
    return waContactsList.filter((c) => {
      return c.displayName.toLowerCase().includes(s) ||
        (c.phoneNumber && c.phoneNumber.includes(s)) ||
        c.jid.split("@")[0].includes(s);
    });
  }, [waContactsList, search, activeTab]);

  // My conversations count for badge
  const myConvsCount = useMemo(() => {
    return dedupedConvs.filter((c) => c.assignedUserId === myUserId).length;
  }, [dedupedConvs, myUserId]);

  // Queue count for badge
  const queueCount = useMemo(() => {
    return (queueStatsQ.data as any)?.total || 0;
  }, [queueStatsQ.data]);

  // Get assignment for selected conversation (O(1) from store)
  const selectedAssignment = useMemo(() => {
    if (!selectedKey) return null;
    const conv = convStore.getConversation(selectedKey) as ConvItem | undefined;
    if (!conv) return null;
    return {
      assignedUserId: conv.assignedUserId,
      assignedAgentName: conv.assignedAgentName,
      assignmentStatus: conv.assignmentStatus,
      assignmentPriority: conv.assignmentPriority,
    };
  }, [selectedKey, convStore.version]);

  const handleAssign = useCallback((agentId: number | null) => {
    if (!selectedJid || !activeSession?.sessionId) return;
    assignMutation.mutate({
      tenantId,
      sessionId: activeSession.sessionId,
      remoteJid: selectedJid,
      assignedUserId: agentId,
    });
    setShowAssignPanel(false);
  }, [selectedJid, activeSession?.sessionId, assignMutation]);

  const handleStatusChange = useCallback((status: "open" | "pending" | "resolved" | "closed") => {
    if (!selectedJid || !activeSession?.sessionId) return;
    updateStatusMutation.mutate({
      tenantId,
      sessionId: activeSession.sessionId,
      remoteJid: selectedJid,
      status,
    });
  }, [selectedJid, activeSession?.sessionId, updateStatusMutation]);

  // Selected contact info
  const selectedContact = useMemo(() => {
    if (!selectedKey) return null;
    const jid = getJidFromKey(selectedKey);
    const crmContact = getContactForJid(jid);
    const pic = profilePicMap[jid] || undefined;
    const selectedConv = convStore.getConversation(selectedKey) as ConvItem | undefined;
    const displayName = getDisplayName(jid, selectedConv);
    const phone = jid.split("@")[0];
    if (crmContact) return { ...crmContact, name: displayName, avatarUrl: pic };
    return { id: 0, name: displayName, phone, email: undefined, avatarUrl: pic };
  }, [selectedKey, getContactForJid, profilePicMap, getDisplayName, convStore.version]);

  const hasCrmContact = useMemo(() => {
    if (!selectedKey) return false;
    const jid = getJidFromKey(selectedKey);
    return !!getContactForJid(jid);
  }, [selectedKey, getContactForJid]);

  // Get waConversationId for selected conversation (O(1) from store)
  const selectedWaConversationId = useMemo(() => {
    if (!selectedKey) return undefined;
    const conv = convStore.getConversation(selectedKey) as ConvItem | undefined;
    return conv?.conversationId;
  }, [selectedKey, convStore.version]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      try { localStorage.setItem(MUTE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  // No session state
  if (!activeSession && !sessionsQ.isLoading) {
    return <div className="h-full"><NoSession /></div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--wa-chat-bg)' }}>
      {/* ═══ RECONNECTION BANNER ═══ */}
      {!isConnected && activeSession && (
        <div className="shrink-0 flex items-center justify-between px-4 py-[6px]" style={{ backgroundColor: '#ffc107', color: '#3b3a32' }}>
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span className="text-[14px]">Computador não conectado — certifique-se de que o celular está com internet.</span>
          </div>
          <a href="/whatsapp" className="px-3 py-1 bg-white/30 hover:bg-white/50 rounded text-[13px] font-medium transition-colors">
            Reconectar
          </a>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
      {/* ═══ LEFT PANEL: Conversations List ═══ */}
      <div
        className={`flex flex-col ${showMobileChat ? "hidden md:flex" : "flex"}`}
        style={{
          width: "100%",
          maxWidth: "420px",
          minWidth: "320px",
          borderRight: '1px solid var(--wa-divider)',
          position: "relative",
          backgroundColor: 'var(--wa-panel)',
        }}
      >
        {/* New Chat Panel (slide-over) */}
        <NewChatPanel
          open={showNewChat}
          onClose={() => setShowNewChat(false)}
          onSelectJid={(jid) => { handleSelectConv(jid); setShowNewChat(false); }}
          sessionId={activeSession?.sessionId || ""}
        />

        {/* ── Header (WhatsApp Web style) ── */}
        <div className="flex items-center justify-between shrink-0 h-[59px] px-4" style={{ backgroundColor: 'var(--wa-panel-header)' }}>
          <div className="flex items-center gap-2">
            {isConnected && <div className="w-[10px] h-[10px] rounded-full bg-[var(--wa-tint)]" />}
            {!isConnected && <div className="w-[10px] h-[10px] rounded-full bg-amber-400 animate-pulse" />}
          </div>
          <div className="flex items-center gap-[2px]">
            <InstantTooltip label={isMuted ? "Som desativado" : "Som ativado"}>
              <button
                onClick={toggleMute}
                className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-[var(--wa-hover)] transition-colors"
              >
                {isMuted ? <VolumeX className="w-[20px] h-[20px]" style={{ color: 'var(--wa-text-secondary)' }} /> : <Volume2 className="w-[20px] h-[20px]" style={{ color: 'var(--wa-text-secondary)' }} />}
              </button>
            </InstantTooltip>
            <InstantTooltip label={syncContactsMut.isPending ? "Sincronizando..." : "Sincronizar contatos"}>
              <button
                onClick={() => {
                  if (!activeSession?.sessionId) { toast.error("Nenhuma sessão ativa"); return; }
                  syncContactsMut.mutate({ sessionId: activeSession.sessionId });
                }}
                disabled={syncContactsMut.isPending}
                className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-[var(--wa-hover)] transition-colors"
              >
                <RefreshCw className={`w-[20px] h-[20px] ${syncContactsMut.isPending ? "animate-spin" : ""}`} style={{ color: 'var(--wa-text-secondary)' }} />
              </button>
            </InstantTooltip>
            <InstantTooltip label="Nova conversa">
              <button onClick={() => setShowNewChat(true)} className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-[var(--wa-hover)] transition-colors">
                <MessageCircle className="w-[20px] h-[20px]" style={{ color: 'var(--wa-text-secondary)' }} />
              </button>
            </InstantTooltip>
            <button className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-[var(--wa-hover)] transition-colors">
              <MoreVertical className="w-[20px] h-[20px]" style={{ color: 'var(--wa-text-secondary)' }} />
            </button>
          </div>
        </div>

        {/* ── Search Bar (WhatsApp Web style) ── */}
        <div className="shrink-0 py-[6px] px-[12px]" style={{ backgroundColor: 'var(--wa-panel)' }}>
          <div className="flex items-center rounded-lg h-[35px] px-[8px]" style={{ backgroundColor: 'var(--wa-search-bg)' }}>
            <Search
              className="shrink-0 transition-colors duration-200"
              style={{ width: 16, height: 16, color: searchFocused ? 'var(--wa-tint)' : 'var(--wa-text-secondary)' }}
            />
            <input
              type="text" placeholder="Pesquisar" value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="flex-1 bg-transparent border-none outline-none text-[14px] placeholder:text-[var(--wa-text-secondary)] pl-[24px] h-full"
              style={{ color: 'var(--wa-text-primary)' }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="p-0.5 rounded-full hover:bg-[var(--wa-hover)] transition-colors">
                <X className="w-[18px] h-[18px]" style={{ color: 'var(--wa-text-secondary)' }} />
              </button>
            )}
          </div>
        </div>

        {/* ── Filter Tabs (WhatsApp Web pill style) ── */}
        <div className="flex items-center shrink-0 px-[10px] gap-[6px] py-[8px]" style={{ backgroundColor: 'var(--wa-panel)' }}>
          {([
            { id: "mine" as InboxTab, label: "Meus Chats", badge: myConvsCount },
            { id: "queue" as InboxTab, label: "Fila", badge: queueCount },
            { id: "contacts" as InboxTab, label: "Contatos", badge: 0 },
            ...(isAdmin ? [{ id: "all" as InboxTab, label: "Todas", badge: 0 }] : []),
          ]).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setFilter("all"); }}
                className={`flex items-center justify-center gap-[5px] px-[12px] py-[6px] text-[13px] transition-all duration-150 rounded-full whitespace-nowrap ${
                  active
                    ? "bg-[var(--wa-tint)]/15 text-[var(--wa-tint)] font-medium"
                    : "text-[var(--wa-text-secondary)] hover:bg-[var(--wa-hover)]"
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className={`text-[11px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-[4px] ${
                    active ? "bg-[var(--wa-tint)] text-white" : "bg-[var(--wa-search-bg)] text-[var(--wa-text-secondary)]"
                  }`}>
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </button>
            );
          })}
          {/* Unread filter — only for mine/all tabs */}
          {(activeTab === "mine" || activeTab === "all") && (
            <button
              onClick={() => setFilter(filter === "unread" ? "all" : "unread")}
              className={`flex items-center gap-[5px] px-[12px] py-[6px] text-[13px] transition-all duration-150 rounded-full whitespace-nowrap ml-auto ${
                filter === "unread"
                  ? "bg-[var(--wa-tint)]/15 text-[var(--wa-tint)] font-medium"
                  : "text-[var(--wa-text-secondary)] hover:bg-[var(--wa-hover)]"
              }`}
            >
              Não lidas
            </button>
          )}
        </div>

        {/* ── Content List (depends on active tab) ── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ overscrollBehavior: "contain" }}>
          {/* MINE / ALL tabs: show conversations */}
          {(activeTab === "mine" || activeTab === "all") && (
            <>
              {conversationsQ.isLoading || sessionsQ.isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-wa-tint animate-spin" />
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/15 mb-3" />
                  <p className="text-[14px] text-muted-foreground">
                    {search ? "Nenhuma conversa encontrada" : activeTab === "mine" ? "Nenhuma conversa atribuída a você" : "Nenhuma conversa ainda"}
                  </p>
                  {activeTab === "mine" && !search && (
                    <p className="text-[12px] text-muted-foreground/60 mt-1">Puxe conversas da Fila para começar a atender</p>
                  )}
                </div>
              ) : (
                filteredConvs.map((conv) => {
                  const ck = conv.conversationKey || makeConvKey(conv.sessionId || activeSession?.sessionId || "", conv.remoteJid);
                  return (
                  <ConversationItem
                    key={ck}
                    conv={conv}
                    isActive={selectedKey === ck}
                    contactName={getDisplayName(conv.remoteJid, conv)}
                    pictureUrl={profilePicMap[conv.remoteJid]}
                    onClick={() => handleSelectConv(conv.remoteJid)}
                    showTimer={activeTab === "mine"}
                    showFinish={activeTab === "mine"}
                    onFinish={() => handleFinishAttendance(conv.remoteJid)}
                  />
                  );
                })
              )}
            </>
          )}

          {/* QUEUE tab: show waiting conversations */}
          {activeTab === "queue" && (
            <>
              {queueQ.isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-wa-tint animate-spin" />
                </div>
              ) : filteredQueueConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <Timer className="w-12 h-12 text-muted-foreground/15 mb-3" />
                  <p className="text-[14px] text-muted-foreground">
                    {search ? "Nenhuma conversa encontrada na fila" : "Fila vazia"}
                  </p>
                  <p className="text-[12px] text-muted-foreground/60 mt-1">Novas mensagens sem agente aparecerão aqui</p>
                </div>
              ) : (
                filteredQueueConvs.map((conv) => {
                  const waitTime = conv.queuedAt || conv.lastTimestamp;
                  const isAssigningThis = assigningQueueJid === conv.remoteJid;
                  return (
                  <div key={conv.remoteJid} className="group/q relative">
                    <div
                      onClick={() => handleSelectQueueConv(conv.remoteJid)}
                      className="flex items-center px-[10px] cursor-pointer transition-all duration-100"
                      style={{
                        backgroundColor: selectedKey === makeConvKey(conv.sessionId || activeSession?.sessionId || "", conv.remoteJid)
                          ? 'var(--wa-active)' : undefined,
                      }}
                      onMouseEnter={(e) => { if (selectedKey !== makeConvKey(conv.sessionId || activeSession?.sessionId || "", conv.remoteJid)) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--wa-hover)'; }}
                      onMouseLeave={(e) => { if (selectedKey !== makeConvKey(conv.sessionId || activeSession?.sessionId || "", conv.remoteJid)) (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
                    >
                      <div className="py-[6px] pr-[13px]">
                        <WaAvatar name={getDisplayName(conv.remoteJid, conv)} size={49} pictureUrl={profilePicMap[conv.remoteJid]} />
                      </div>
                      <div className="flex-1 min-w-0 py-[10px]" style={{ borderBottom: '1px solid var(--wa-divider)' }}>
                        <div className="flex items-center justify-between gap-[4px]">
                          <span className="text-[17px] truncate leading-[21px] flex-1 min-w-0" style={{ color: 'var(--wa-text-primary)' }}>
                            {getDisplayName(conv.remoteJid, conv)}
                          </span>
                          <div className="flex items-center gap-[6px] shrink-0">
                            {waitTime && <UrgencyTimer since={waitTime} compact />}
                          </div>
                        </div>
                        <div className="flex items-center gap-[4px] mt-[2px]">
                          <span className="text-[14px] truncate flex-1 leading-[20px]" style={{ color: 'var(--wa-text-secondary)' }}>
                            {getMessagePreview(conv.lastMessage, conv.lastMessageType) || "Sem mensagens"}
                          </span>
                          {Number(conv.unreadCount) > 0 && (
                            <span className="text-[12px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-[5px] shrink-0" style={{ backgroundColor: 'var(--wa-unread)', color: '#fff' }}>
                              {Number(conv.unreadCount) > 99 ? "99+" : conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Hover action icons — clean overlay on the right side */}
                    {!isAssigningThis && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/q:opacity-100 transition-all duration-150">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeSession?.sessionId) {
                              claimMutation.mutate({ sessionId: activeSession.sessionId, remoteJid: conv.remoteJid });
                            }
                          }}
                          disabled={claimMutation.isPending}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-wa-tint text-white shadow-lg shadow-wa-tint/30 hover:scale-110 transition-transform"
                          title="Puxar para mim"
                        >
                          <HandMetal className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin.isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssigningQueueJid(conv.remoteJid);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:scale-110 transition-transform"
                            title="Atribuir a agente"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                    {/* Agent assignment inline — slides in below */}
                    {isAssigningThis && (
                      <div className="mx-3 mb-1 flex items-center gap-1.5 p-1.5 bg-blue-500/5 border border-blue-500/20 rounded-lg animate-in slide-in-from-top-1 duration-150">
                        <select
                          value={selectedAgentForQueue || ""}
                          onChange={(e) => setSelectedAgentForQueue(Number(e.target.value))}
                          className="flex-1 px-2 py-1.5 bg-background border border-border rounded-md text-[12px] text-foreground outline-none focus:border-blue-400"
                          autoFocus
                        >
                          <option value="">Selecionar agente...</option>
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedAgentForQueue && activeSession?.sessionId) {
                              assignFromQueueMut.mutate({ sessionId: activeSession.sessionId, remoteJid: conv.remoteJid, agentId: selectedAgentForQueue });
                            }
                          }}
                          disabled={!selectedAgentForQueue || assignFromQueueMut.isPending}
                          className="px-3 py-1.5 bg-blue-500 text-white text-[12px] font-medium rounded-md hover:bg-blue-600 transition-colors disabled:opacity-40"
                        >
                          {assignFromQueueMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirmar"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setAssigningQueueJid(null); setSelectedAgentForQueue(null); }}
                          className="w-7 h-7 flex items-center justify-center text-muted-foreground rounded-md hover:bg-muted transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </>
          )}

          {/* CONTACTS tab: show WA contacts */}
          {activeTab === "contacts" && (
            <>
              {waContactsForTabQ.isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-wa-tint animate-spin" />
                </div>
              ) : filteredWaContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <Contact2 className="w-12 h-12 text-muted-foreground/15 mb-3" />
                  <p className="text-[14px] text-muted-foreground">
                    {search ? "Nenhum contato encontrado" : "Nenhum contato do WhatsApp"}
                  </p>
                  <p className="text-[12px] text-muted-foreground/60 mt-1">Sincronize os contatos na página WhatsApp</p>
                </div>
              ) : (
                <>
                  <div className="px-4 py-2">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                      {filteredWaContacts.length} contatos do WhatsApp
                    </p>
                  </div>
                  {filteredWaContacts.map((contact) => (
                    <button
                      key={contact.jid}
                      onClick={() => handleSelectConv(contact.jid)}
                      className="w-full flex items-center px-[10px] hover:bg-[var(--wa-hover)] transition-all duration-100 text-left"
                    >
                      <div className="py-[6px] pr-[13px]">
                        <WaAvatar name={contact.displayName} size={49} pictureUrl={profilePicMap[contact.jid]} />
                      </div>
                      <div className="flex-1 min-w-0 py-[10px]" style={{ borderBottom: '1px solid var(--wa-divider)' }}>
                        <p className="text-[17px] truncate leading-[21px]" style={{ color: 'var(--wa-text-primary)' }}>{contact.displayName}</p>
                        <p className="text-[14px] truncate leading-[20px] mt-[2px]" style={{ color: 'var(--wa-text-secondary)' }}>
                          {contact.phoneNumber ? formatPhoneNumber(contact.phoneNumber) : formatPhoneNumber(contact.jid)}
                        </p>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══ RIGHT PANEL: Chat Area ═══ */}
      <div className={`flex-1 flex flex-col min-w-0 ${!showMobileChat ? "hidden md:flex" : "flex"}`}>
        {!selectedKey || !activeSession ? (
          <EmptyChat />
        ) : (
          <div className="flex flex-col h-full w-full relative">
            {/* Mobile back button */}
            <button
              onClick={() => setShowMobileChat(false)}
              className="md:hidden absolute top-[14px] left-[8px] z-30 p-[6px] rounded-full backdrop-blur-sm"
              style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>

            <WhatsAppChat
              contact={selectedContact}
              sessionId={activeSession.sessionId}
              remoteJid={selectedJid!}
              onCreateDeal={() => setShowCreateDeal(true)}
              onCreateContact={() => setShowCreateContact(true)}
              hasCrmContact={hasCrmContact}
              assignment={selectedAssignment}
              agents={agents}
              onAssign={handleAssign}
              onStatusChange={handleStatusChange}
              myAvatarUrl={activeSession.user?.imgUrl}
              waConversationId={selectedWaConversationId}
              onOptimisticSend={(msg) => {
                if (!activeSession?.sessionId || !selectedJid) return;
                convStore.handleOptimisticSend({
                  sessionId: activeSession.sessionId,
                  remoteJid: selectedJid,
                  content: msg.content,
                  messageType: msg.messageType,
                });
              }}
            />
          </div>
        )}
      </div>

      {/* ═══ DIALOGS ═══ */}
      {selectedKey && activeSession && (
        <CreateDealDialog
          open={showCreateDeal}
          onClose={() => setShowCreateDeal(false)}
          contactName={selectedContact?.name || "Contato"}
          contactPhone={selectedJid?.split("@")[0] || ""}
          contactJid={selectedJid || ""}
          sessionId={activeSession.sessionId}
        />
      )}
      {selectedKey && (
        <CreateContactDialog
          open={showCreateContact}
          onClose={() => setShowCreateContact(false)}
          phone={selectedJid?.split("@")[0] || ""}
          pushName={selectedContact?.name || ""}
          onCreated={() => { contactsQ.refetch(); setShowCreateContact(false); }}
        />
      )}
      </div>
    </div>
  );
}
