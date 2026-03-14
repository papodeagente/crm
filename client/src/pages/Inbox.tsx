import { useState, useMemo, useEffect, useCallback, useRef, memo } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import WhatsAppChat from "@/components/WhatsAppChat";
import {
  Search, MessageSquare, MoreVertical, ArrowLeft,
  Check, CheckCheck, Clock, Phone, Loader2,
  MessageCircle, Briefcase, Plus, X, Volume2, VolumeX,
  UserPlus, Lock, Users, UserCheck, UserX, ArrowRightLeft,
  CircleDot, ChevronDown, WifiOff, RefreshCw
} from "lucide-react";
import { formatTime } from "../../../shared/dateUtils";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useTenantId } from "@/hooks/useTenantId";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { Inbox as InboxIcon, ListOrdered, Contact2, LayoutGrid, HandMetal, Timer, ArrowRightLeft as Transfer } from "lucide-react";

/* ═══════════════════════════════════════════════════════
   NOTIFICATION SOUND (Web Audio API — WhatsApp style)
   ═══════════════════════════════════════════════════════ */

const MUTE_KEY = "entur_inbox_muted";

function createNotificationSound(): () => void {
  let audioCtx: AudioContext | null = null;
  return () => {
    try {
      if (!audioCtx) audioCtx = new AudioContext();
      const ctx = audioCtx;
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now);
      osc1.connect(gain);
      osc1.start(now);
      osc1.stop(now + 0.12);
      const gain2 = ctx.createGain();
      gain2.connect(ctx.destination);
      gain2.gain.setValueAtTime(0.12, now + 0.13);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(660, now + 0.13);
      osc2.connect(gain2);
      osc2.start(now + 0.13);
      osc2.stop(now + 0.3);
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
    eventMessage: "📅 Evento",
  };
  if (content && content.length > 0 && !content.startsWith("[")) {
    const mapped = typeMap[messageType];
    if (mapped && content.startsWith("[")) return mapped;
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
    case "pending": return <Clock className="w-[14px] h-[14px] text-muted-foreground/60 shrink-0" />;
    case "sent": return <Check className="w-[15px] h-[15px] text-muted-foreground/60 shrink-0" />;
    case "delivered": return <CheckCheck className="w-[15px] h-[15px] text-muted-foreground/60 shrink-0" />;
    case "read": case "played": return <CheckCheck className="w-[15px] h-[15px] text-wa-tint shrink-0" />;
    default: return <Check className="w-[15px] h-[15px] text-muted-foreground/60 shrink-0" />;
  }
});
StatusTick.displayName = "StatusTick";

/* ═══════════════════════════════════════════════════════
   AVATAR — WhatsApp style with real profile picture
   ═══════════════════════════════════════════════════════ */

const WaAvatar = memo(({ name, size = 49, pictureUrl }: { name: string; size?: number; pictureUrl?: string | null }) => {
  const [imgError, setImgError] = useState(false);

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

  // Default WhatsApp avatar SVG
  return (
    <div className="rounded-full bg-muted/60 shrink-0 overflow-hidden" style={{ width: size, height: size }}>
      <svg viewBox="0 0 212 212" width={size} height={size}>
        <path className="fill-muted" d="M106 0C47.5 0 0 47.5 0 106s47.5 106 106 106 106-47.5 106-106S164.5 0 106 0z" />
        <path className="fill-muted-foreground/30" d="M106 45c-20.7 0-37.5 16.8-37.5 37.5S85.3 120 106 120s37.5-16.8 37.5-37.5S126.7 45 106 45zm0 105c-28.3 0-52.5 14.3-52.5 32v10h105v-10c0-17.7-24.2-32-52.5-32z" />
      </svg>
    </div>
  );
});
WaAvatar.displayName = "WaAvatar";

/* ═══════════════════════════════════════════════════════
   CONVERSATION ITEM — WhatsApp Web faithful
   ═══════════════════════════════════════════════════════ */

interface ConvItem {
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
  conv, isActive, contactName, pictureUrl, onClick,
}: {
  conv: ConvItem; isActive: boolean; contactName: string; pictureUrl?: string | null; onClick: () => void;
}) => {
  const fromMe = conv.lastFromMe === true || conv.lastFromMe === 1;
  const unread = Number(conv.unreadCount) || 0;
  const preview = getMessagePreview(conv.lastMessage, conv.lastMessageType);
  const time = formatConversationTime(conv.lastTimestamp);

  return (
    <div
      onClick={onClick}
      className={`flex items-center px-3 cursor-pointer transition-colors duration-75 ${
        isActive ? "bg-wa-active" : "hover:bg-wa-hover"
      }`}
    >
      <div className="py-[6px] pr-[13px] relative">
        <WaAvatar name={contactName} size={49} pictureUrl={pictureUrl} />
        {/* Assignment status dot */}
        {conv.assignmentStatus && conv.assignmentStatus !== "open" && (
          <div className="absolute bottom-[6px] right-[10px]">
            <StatusDot status={conv.assignmentStatus} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 py-[10px] border-b border-wa-divider">
        <div className="flex items-center justify-between mb-[2px] gap-1">
          <span className="text-[16px] text-foreground truncate leading-[21px] font-normal flex-1 min-w-0">
            {contactName}
          </span>
          <div className="flex items-center gap-[5px] shrink-0">
            <AgentBadge name={conv.assignedAgentName} avatarUrl={conv.assignedAgentAvatar} />
            <span className={`text-[12px] leading-[14px] ${
              unread > 0 ? "text-wa-unread font-medium" : "text-muted-foreground"
            }`}>
              {time}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-[3px]">
          <StatusTick status={conv.lastStatus} fromMe={fromMe} />
          <span className={`text-[13.5px] truncate flex-1 leading-[20px] ${
            unread > 0 ? "text-foreground/80" : "text-muted-foreground"
          }`}>
            {preview || "Sem mensagens"}
          </span>
          {unread > 0 && (
            <span className="bg-wa-unread text-white text-[11px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-[5px] shrink-0 ml-[4px]">
              {unread > 99 ? "99+" : unread}
            </span>
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

  const formattedPhone = formatPhoneNumber(phone + "@s.whatsapp.net");

  useEffect(() => {
    if (open) {
      setName(pushName || "");
      setEmail("");
      setNotes("");
    }
  }, [open, pushName]);

  const createContact = trpc.crm.contacts.create.useMutation();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const cleaned = phone.replace(/\D/g, "");
      const formatted = cleaned.startsWith("55") ? `+${cleaned}` : `+55${cleaned}`;
      await createContact.mutateAsync({
        tenantId,
        name: name.trim(),
        phone: formatted,
        email: email.trim() || undefined,
      });
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
    <div className="flex-1 flex flex-col items-center justify-center bg-wa-chat-bg">
      <div className="text-center max-w-[500px] px-8">
        <div className="mb-8">
          <div className="w-[72px] h-[72px] mx-auto rounded-full bg-wa-tint/10 flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-wa-tint" />
          </div>
        </div>
        <h1 className="text-[28px] font-light text-foreground/80 leading-[34px] mb-3">
          ENTUR OS WhatsApp
        </h1>
        <p className="text-[14px] text-muted-foreground leading-[20px]">
          Envie e receba mensagens sem manter seu celular conectado.
          <br />
          Selecione uma conversa ao lado para começar.
        </p>
        <div className="mt-10 pt-5 border-t border-wa-divider">
          <p className="text-[13px] text-muted-foreground/60 flex items-center justify-center gap-2">
            <Lock className="w-3.5 h-3.5" />
            Criptografia de ponta a ponta
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
  const { lastMessage } = useSocket();
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
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
  const prevMessageRef = useRef<typeof lastMessage>(null);

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

  // Use wa_conversations table (canonical, with correct names and ordering)
  const conversationsQ = trpc.whatsapp.waConversations.useQuery(
    { sessionId: activeSession?.sessionId || "", tenantId },
    { enabled: !!activeSession?.sessionId, refetchInterval: isConnected ? 15000 : 60000, staleTime: 10000 }
  );

  // Agents list for assignment
  const agentsQ = trpc.whatsapp.agents.useQuery({ tenantId }, { staleTime: 5 * 60 * 1000 });
  const agents = useMemo(() => (agentsQ.data || []) as Array<{ id: number; name: string; email: string; avatarUrl?: string | null; status: string }>, [agentsQ.data]);

  // Queue conversations
  const queueQ = trpc.whatsapp.queue.list.useQuery(
    { sessionId: activeSession?.sessionId || "", limit: 100 },
    { enabled: !!activeSession?.sessionId && (activeTab === "queue" || activeTab === "all"), refetchInterval: isConnected ? 15000 : 60000, staleTime: 10000 }
  );
  const queueStatsQ = trpc.whatsapp.queue.stats.useQuery(
    { sessionId: activeSession?.sessionId || "" },
    { enabled: !!activeSession?.sessionId, refetchInterval: 30000, staleTime: 15000 }
  );
  const claimMutation = trpc.whatsapp.queue.claim.useMutation({
    onSuccess: () => { conversationsQ.refetch(); queueQ.refetch(); queueStatsQ.refetch(); toast.success("Conversa atribuída a você"); },
    onError: (e) => toast.error(e.message || "Erro ao puxar conversa"),
  });

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
    onSuccess: () => { conversationsQ.refetch(); queueQ.refetch(); queueStatsQ.refetch(); toast.success("Conversa atribuída com sucesso"); },
    onError: (e) => toast.error(e.message || "Erro ao atribuir conversa"),
  });
  const updateStatusMutation = trpc.whatsapp.updateAssignmentStatus.useMutation({
    onSuccess: () => { conversationsQ.refetch(); },
  });

  const contactsQ = trpc.crm.contacts.list.useQuery(
    { tenantId, limit: 500 },
    { enabled: true, staleTime: 5 * 60 * 1000 }
  );

  // Profile pictures
  const convJids = useMemo(() => {
    return ((conversationsQ.data || []) as ConvItem[]).map((c) => c.remoteJid);
  }, [conversationsQ.data]);

  // Only fetch profile pics for visible conversations (top 30) and with long staleTime
  const visibleJids = useMemo(() => convJids.slice(0, 30), [convJids]);
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
      conversationsQ.refetch();
      const resolvedMsg = data.resolved > 0 ? ` (${data.resolved} LIDs resolvidos)` : "";
      toast.success(`Contatos sincronizados: ${data.synced}/${data.total}${resolvedMsg}`);
    },
    onError: (e) => toast.error(e.message || "Erro ao sincronizar contatos"),
  });

  // PushName map from conversations
  const pushNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of (conversationsQ.data || []) as ConvItem[]) {
      if (c.contactPushName) map.set(c.remoteJid, c.contactPushName);
    }
    return map;
  }, [conversationsQ.data]);

  // Mark as read
  const markRead = trpc.whatsapp.markRead.useMutation({
    onSuccess: () => conversationsQ.refetch(),
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

  // Notification sound on new messages
  useEffect(() => {
    if (!lastMessage) return;
    conversationsQ.refetch();
    const isNew = !prevMessageRef.current ||
      lastMessage.timestamp !== prevMessageRef.current.timestamp ||
      lastMessage.remoteJid !== prevMessageRef.current.remoteJid ||
      lastMessage.content !== prevMessageRef.current.content;
    if (isNew && !lastMessage.fromMe && !isMuted) {
      if (selectedJid !== lastMessage.remoteJid) playNotification();
    }
    prevMessageRef.current = lastMessage;
  }, [lastMessage]);

  // Select conversation
  const handleSelectConv = useCallback((jid: string) => {
    setSelectedJid(jid);
    setShowMobileChat(true);
    if (activeSession?.sessionId) {
      markRead.mutate({ sessionId: activeSession.sessionId, remoteJid: jid });
    }
  }, [activeSession?.sessionId, markRead]);

  // Current user ID for filtering "mine" tab
  const meQ = trpc.auth.me.useQuery();
  const myUserId = useMemo(() => (meQ.data as any)?.saasUser?.userId || (meQ.data as any)?.id || 0, [meQ.data]);

  // Filter conversations based on active tab
  const filteredConvs = useMemo(() => {
    let convs = (conversationsQ.data || []) as ConvItem[];
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
  }, [conversationsQ.data, search, filter, activeTab, getDisplayName, myUserId]);

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
    return ((conversationsQ.data || []) as ConvItem[]).filter((c) => c.assignedUserId === myUserId).length;
  }, [conversationsQ.data, myUserId]);

  // Queue count for badge
  const queueCount = useMemo(() => {
    return (queueStatsQ.data as any)?.waiting || 0;
  }, [queueStatsQ.data]);

  // Get assignment for selected conversation
  const selectedAssignment = useMemo(() => {
    if (!selectedJid) return null;
    const conv = (conversationsQ.data as ConvItem[] || []).find(c => c.remoteJid === selectedJid);
    if (!conv) return null;
    return {
      assignedUserId: conv.assignedUserId,
      assignedAgentName: conv.assignedAgentName,
      assignmentStatus: conv.assignmentStatus,
      assignmentPriority: conv.assignmentPriority,
    };
  }, [selectedJid, conversationsQ.data]);

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
    if (!selectedJid) return null;
    const crmContact = getContactForJid(selectedJid);
    const pic = profilePicMap[selectedJid] || undefined;
    const selectedConv = (conversationsQ.data as ConvItem[] || []).find(c => c.remoteJid === selectedJid);
    const displayName = getDisplayName(selectedJid, selectedConv);
    const phone = selectedJid.split("@")[0];
    if (crmContact) return { ...crmContact, name: displayName, avatarUrl: pic };
    return { id: 0, name: displayName, phone, email: undefined, avatarUrl: pic };
  }, [selectedJid, getContactForJid, profilePicMap, getDisplayName, conversationsQ.data]);

  const hasCrmContact = useMemo(() => {
    if (!selectedJid) return false;
    return !!getContactForJid(selectedJid);
  }, [selectedJid, getContactForJid]);

  // Get waConversationId for selected conversation (for notes/events)
  const selectedWaConversationId = useMemo(() => {
    if (!selectedJid) return undefined;
    const conv = (conversationsQ.data as ConvItem[] || []).find(c => c.remoteJid === selectedJid);
    return conv?.conversationId;
  }, [selectedJid, conversationsQ.data]);

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
    <div className="flex flex-col h-full overflow-hidden bg-wa-chat-bg">
      {/* ═══ RECONNECTION BANNER ═══ */}
      {!isConnected && activeSession && (
        <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-amber-500/90 text-white text-sm">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>WhatsApp desconectado — visualizando histórico. Reconecte para enviar mensagens.</span>
          </div>
          <a href="/whatsapp" className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors">
            Reconectar
          </a>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
      {/* ═══ LEFT PANEL: Conversations List ═══ */}
      <div
        className={`flex flex-col bg-wa-panel ${showMobileChat ? "hidden md:flex" : "flex"}`}
        style={{
          width: "100%",
          maxWidth: "420px",
          minWidth: "320px",
          borderRight: "1px solid var(--wa-divider)",
          position: "relative",
        }}
      >
        {/* New Chat Panel (slide-over) */}
        <NewChatPanel
          open={showNewChat}
          onClose={() => setShowNewChat(false)}
          onSelectJid={(jid) => { handleSelectConv(jid); setShowNewChat(false); }}
          sessionId={activeSession?.sessionId || ""}
        />

        {/* ── Header ── */}
        <div className="flex items-center justify-between shrink-0 h-[59px] px-4 bg-wa-panel-header border-b border-wa-divider">
          <WaAvatar name="Eu" size={40} />
          <div className="flex items-center gap-1">
            <button
              onClick={toggleMute}
              className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-wa-hover transition-colors relative group"
              title={isMuted ? "Ativar som de notificação" : "Silenciar notificações"}
            >
              {isMuted ? <VolumeX className="w-[20px] h-[20px] text-destructive" /> : <Volume2 className="w-[20px] h-[20px] text-muted-foreground" />}
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[11px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {isMuted ? "Som desativado" : "Som ativado"}
              </span>
            </button>
            <button
              onClick={() => {
                if (!activeSession?.sessionId) { toast.error("Nenhuma sessão ativa"); return; }
                syncContactsMut.mutate({ sessionId: activeSession.sessionId });
              }}
              disabled={syncContactsMut.isPending}
              className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-wa-hover transition-colors relative group"
              title="Sincronizar contatos"
            >
              <RefreshCw className={`w-[20px] h-[20px] text-muted-foreground ${syncContactsMut.isPending ? "animate-spin" : ""}`} />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[11px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {syncContactsMut.isPending ? "Sincronizando..." : "Sincronizar contatos"}
              </span>
            </button>
            <button onClick={() => setShowNewChat(true)} className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-wa-hover transition-colors" title="Nova conversa">
              <MessageCircle className="w-[20px] h-[20px] text-muted-foreground" />
            </button>
            <button className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-wa-hover transition-colors">
              <MoreVertical className="w-[20px] h-[20px] text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* ── Search Bar ── */}
        <div className="shrink-0 px-3 py-[7px] bg-wa-panel">
          <div className="flex items-center rounded-lg overflow-hidden h-[35px] bg-wa-search-bg px-3">
            <Search
              className="shrink-0 transition-colors duration-200"
              style={{ width: "15px", height: "15px" }}
              color={searchFocused ? "var(--wa-tint)" : undefined}
            />
            <input
              type="text" placeholder="Pesquisar" value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="flex-1 bg-transparent border-none outline-none text-[14px] text-foreground placeholder:text-muted-foreground pl-3 h-full"
            />
          </div>
        </div>

        {/* ── Main Tabs (Meus Chats | Fila | Contatos WA | Todas) ── */}
        <div className="flex items-center shrink-0 border-b border-wa-divider">
          {([
            { id: "mine" as InboxTab, label: "Meus Chats", icon: <InboxIcon className="w-[14px] h-[14px]" />, badge: myConvsCount },
            { id: "queue" as InboxTab, label: "Fila", icon: <Timer className="w-[14px] h-[14px]" />, badge: queueCount },
            { id: "contacts" as InboxTab, label: "Contatos", icon: <Contact2 className="w-[14px] h-[14px]" />, badge: 0 },
            ...(isAdmin ? [{ id: "all" as InboxTab, label: "Todas", icon: <LayoutGrid className="w-[14px] h-[14px]" />, badge: 0 }] : []),
          ]).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setFilter("all"); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-[10px] text-[13px] font-medium transition-colors relative ${
                  active
                    ? "text-wa-tint"
                    : "text-muted-foreground hover:text-foreground hover:bg-wa-hover/50"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-[4px] ${
                    active ? "bg-wa-tint text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
                {active && <div className="absolute bottom-0 left-[20%] right-[20%] h-[2px] bg-wa-tint rounded-t" />}
              </button>
            );
          })}
        </div>
        {/* ── Secondary Filter (only for mine/all tabs) ── */}
        {(activeTab === "mine" || activeTab === "all") && (
          <div className="flex items-center gap-[6px] shrink-0 px-3 py-[5px] overflow-x-auto scrollbar-none">
            {(["all", "unread"] as const).map((f) => {
              const labels: Record<string, string> = { all: "Todas", unread: "Não lidas" };
              const active = filter === f;
              return (
                <button
                  key={f} onClick={() => setFilter(f)}
                  className={`rounded-full text-[12px] font-medium transition-colors px-2.5 py-[4px] shrink-0 ${
                    active ? "bg-wa-tint/15 text-wa-tint" : "bg-wa-search-bg text-muted-foreground hover:bg-wa-hover"
                  }`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>
        )}

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
                filteredConvs.map((conv) => (
                  <ConversationItem
                    key={conv.remoteJid}
                    conv={conv}
                    isActive={selectedJid === conv.remoteJid}
                    contactName={getDisplayName(conv.remoteJid, conv)}
                    pictureUrl={profilePicMap[conv.remoteJid]}
                    onClick={() => handleSelectConv(conv.remoteJid)}
                  />
                ))
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
                filteredQueueConvs.map((conv) => (
                  <div key={conv.remoteJid} className="relative group">
                    <ConversationItem
                      conv={conv}
                      isActive={selectedJid === conv.remoteJid}
                      contactName={getDisplayName(conv.remoteJid, conv)}
                      pictureUrl={profilePicMap[conv.remoteJid]}
                      onClick={() => handleSelectConv(conv.remoteJid)}
                    />
                    {/* Claim button overlay */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeSession?.sessionId) {
                          claimMutation.mutate({ sessionId: activeSession.sessionId, remoteJid: conv.remoteJid });
                        }
                      }}
                      disabled={claimMutation.isPending}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-wa-tint text-white text-[11px] font-medium px-3 py-1.5 rounded-lg shadow-lg hover:opacity-90 flex items-center gap-1"
                    >
                      <HandMetal className="w-3 h-3" />
                      Puxar
                    </button>
                  </div>
                ))
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
                      className="w-full flex items-center gap-3 px-3 hover:bg-wa-hover transition-colors text-left"
                    >
                      <div className="py-[6px] pr-[2px]">
                        <WaAvatar name={contact.displayName} size={49} pictureUrl={profilePicMap[contact.jid]} />
                      </div>
                      <div className="flex-1 min-w-0 py-[10px] border-b border-wa-divider">
                        <p className="text-[15px] text-foreground truncate">{contact.displayName}</p>
                        <p className="text-[13px] text-muted-foreground truncate">
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
        {!selectedJid || !activeSession ? (
          <EmptyChat />
        ) : (
          <div className="flex flex-col h-full w-full relative">
            {/* Mobile back button */}
            <button
              onClick={() => setShowMobileChat(false)}
              className="md:hidden absolute top-[10px] left-[6px] z-30 p-[6px] rounded-full bg-card/85 shadow-sm backdrop-blur-sm"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>

            <WhatsAppChat
              contact={selectedContact}
              sessionId={activeSession.sessionId}
              remoteJid={selectedJid}
              onCreateDeal={() => setShowCreateDeal(true)}
              onCreateContact={() => setShowCreateContact(true)}
              hasCrmContact={hasCrmContact}
              assignment={selectedAssignment}
              agents={agents}
              onAssign={handleAssign}
              onStatusChange={handleStatusChange}
              myAvatarUrl={activeSession.user?.imgUrl}
              waConversationId={selectedWaConversationId}
            />
          </div>
        )}
      </div>

      {/* ═══ DIALOGS ═══ */}
      {selectedJid && activeSession && (
        <CreateDealDialog
          open={showCreateDeal}
          onClose={() => setShowCreateDeal(false)}
          contactName={selectedContact?.name || "Contato"}
          contactPhone={selectedJid.split("@")[0]}
          contactJid={selectedJid}
          sessionId={activeSession.sessionId}
        />
      )}
      {selectedJid && (
        <CreateContactDialog
          open={showCreateContact}
          onClose={() => setShowCreateContact(false)}
          phone={selectedJid.split("@")[0]}
          pushName={selectedContact?.name || ""}
          onCreated={() => { contactsQ.refetch(); setShowCreateContact(false); }}
        />
      )}
      </div>
    </div>
  );
}
