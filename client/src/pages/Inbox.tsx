import { useState, useMemo, useEffect, useCallback, useRef, memo } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import WhatsAppChat from "@/components/WhatsAppChat";
import {
  Search, MessageSquare, MoreVertical, ArrowLeft,
  Check, CheckCheck, Clock, Phone, Loader2, Users,
  MessageCircle, Briefcase, Plus, X, Volume2, VolumeX
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

/* ═══════════════════════════════════════════════════════
   NOTIFICATION SOUND (Web Audio API)
   ═══════════════════════════════════════════════════════ */

const MUTE_KEY = "astra_inbox_muted";

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
    } catch {
      // Audio not supported or blocked
    }
  };
}

const playNotification = createNotificationSound();

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */

function formatTime(date: string | Date | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatPhoneNumber(jid: string): string {
  if (!jid) return "Desconhecido";
  if (jid.includes("@g.us")) return jid.split("@")[0];
  const phone = jid.split("@")[0];
  if (phone.startsWith("55") && phone.length >= 12) {
    const ddd = phone.substring(2, 4);
    const num = phone.substring(4);
    if (num.length === 9) return `(${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`;
    if (num.length === 8) return `(${ddd}) ${num.substring(0, 4)}-${num.substring(4)}`;
  }
  return phone;
}

function getMessagePreview(content: string | null, messageType: string | null): string {
  if (!messageType || messageType === "text" || messageType === "conversation" || messageType === "extendedTextMessage") {
    return content || "";
  }
  const typeMap: Record<string, string> = {
    imageMessage: "📷 Foto", image: "📷 Foto",
    videoMessage: "📹 Vídeo", video: "📹 Vídeo",
    audioMessage: "🎤 Áudio", audio: "🎤 Áudio",
    documentMessage: "📄 Documento", document: "📄 Documento",
    stickerMessage: "🏷️ Sticker",
    contactMessage: "👤 Contato",
    locationMessage: "📍 Localização",
    templateMessage: "📋 Template",
    interactiveMessage: "📋 Mensagem interativa",
    listMessage: "📋 Lista",
    protocolMessage: "⚙️ Protocolo",
    senderKeyDistributionMessage: "🔑 Chave",
  };
  return typeMap[messageType] || content || `[${messageType}]`;
}

/* ═══════════════════════════════════════════════════════
   STATUS TICKS
   ═══════════════════════════════════════════════════════ */

const StatusTick = memo(({ status, fromMe }: { status: string | null; fromMe: boolean }) => {
  if (!fromMe) return null;
  switch (status) {
    case "pending": return <Clock className="w-[14px] h-[14px] text-[#8696a0] shrink-0" />;
    case "sent": return <Check className="w-[16px] h-[16px] text-[#8696a0] shrink-0" />;
    case "delivered": return <CheckCheck className="w-[16px] h-[16px] text-[#8696a0] shrink-0" />;
    case "read": case "played": return <CheckCheck className="w-[16px] h-[16px] text-[#53bdeb] shrink-0" />;
    default: return <Check className="w-[16px] h-[16px] text-[#8696a0] shrink-0" />;
  }
});
StatusTick.displayName = "StatusTick";

/* ═══════════════════════════════════════════════════════
   AVATAR with real profile picture
   ═══════════════════════════════════════════════════════ */

const WaAvatar = memo(({ name, size = 49, isGroup = false, pictureUrl }: { name: string; size?: number; isGroup?: boolean; pictureUrl?: string | null }) => {
  const [imgError, setImgError] = useState(false);

  if (pictureUrl && !imgError) {
    return (
      <div
        className="rounded-full shrink-0 overflow-hidden"
        style={{ width: size, height: size }}
      >
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

  return (
    <div
      className="rounded-full bg-[#DFE5E7] flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {isGroup ? (
        <Users className="text-white" style={{ width: size * 0.45, height: size * 0.45 }} />
      ) : (
        <svg viewBox="0 0 212 212" width={size} height={size}>
          <path fill="#DFE5E7" d="M106 0C47.5 0 0 47.5 0 106s47.5 106 106 106 106-47.5 106-106S164.5 0 106 0z" />
          <path fill="#FFF" d="M106 45c-20.7 0-37.5 16.8-37.5 37.5S85.3 120 106 120s37.5-16.8 37.5-37.5S126.7 45 106 45zm0 105c-28.3 0-52.5 14.3-52.5 32v10h105v-10c0-17.7-24.2-32-52.5-32z" />
        </svg>
      )}
    </div>
  );
});
WaAvatar.displayName = "WaAvatar";

/* ═══════════════════════════════════════════════════════
   CONVERSATION ITEM
   ═══════════════════════════════════════════════════════ */

interface ConvItem {
  remoteJid: string;
  lastMessage: string | null;
  lastMessageType: string | null;
  lastFromMe: boolean | number;
  lastTimestamp: string | Date | null;
  lastStatus: string | null;
  unreadCount: number | string;
  totalMessages: number | string;
}

const ConversationItem = memo(({
  conv, isActive, contactName, pictureUrl, onClick,
}: {
  conv: ConvItem; isActive: boolean; contactName: string; pictureUrl?: string | null; onClick: () => void;
}) => {
  const isGroup = conv.remoteJid.includes("@g.us");
  const fromMe = conv.lastFromMe === true || conv.lastFromMe === 1;
  const unread = Number(conv.unreadCount) || 0;
  const preview = getMessagePreview(conv.lastMessage, conv.lastMessageType);
  const time = formatTime(conv.lastTimestamp);

  return (
    <div
      onClick={onClick}
      className={`flex items-center px-3 cursor-pointer transition-colors duration-100 ${
        isActive ? "bg-[#F0F2F5]" : "hover:bg-[#F5F6F6]"
      }`}
    >
      <div className="py-[6px] pr-[13px]">
        <WaAvatar name={contactName} size={49} isGroup={isGroup} pictureUrl={pictureUrl} />
      </div>
      <div className="flex-1 min-w-0 py-[6px] border-b border-[#E9EDEF]">
        <div className="flex items-baseline justify-between mb-[2px]">
          <span className="text-[17px] text-[#111B21] truncate leading-[21px]">
            {contactName}
          </span>
          <span className={`text-[12px] ml-[6px] shrink-0 leading-[14px] ${
            unread > 0 ? "text-[#25D366]" : "text-[#667781]"
          }`}>
            {time}
          </span>
        </div>
        <div className="flex items-center gap-[3px]">
          <StatusTick status={conv.lastStatus} fromMe={fromMe} />
          <span className="text-[14px] text-[#667781] truncate flex-1 leading-[20px]">
            {preview || "Sem mensagens"}
          </span>
          {unread > 0 && (
            <span className="bg-[#25D366] text-white text-[11px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-[6px] shrink-0 ml-[6px]">
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
   CREATE DEAL DIALOG
   ═══════════════════════════════════════════════════════ */

function CreateDealDialog({
  open, onClose, contactName, contactPhone, contactJid, sessionId,
}: {
  open: boolean; onClose: () => void; contactName: string; contactPhone: string; contactJid: string; sessionId: string;
}) {
  const [, navigate] = useLocation();
  const [title, setTitle] = useState(`Negociação - ${contactName}`);
  const [value, setValue] = useState("");

  // Get pipelines and stages
  const pipelinesQ = trpc.crm.pipelines.list.useQuery({ tenantId: 1 });
  const pipelines = (pipelinesQ.data || []) as any[];
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);

  const stagesQ = trpc.crm.pipelines.stages.useQuery(
    { tenantId: 1, pipelineId: selectedPipelineId! },
    { enabled: !!selectedPipelineId }
  );
  const stages = (stagesQ.data || []) as any[];
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);

  // Auto-select first pipeline
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      setSelectedPipelineId(pipelines[0].id);
    }
  }, [pipelines, selectedPipelineId]);

  // Auto-select first stage
  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) {
      setSelectedStageId(stages[0].id);
    }
  }, [stages, selectedStageId]);

  // Find or create contact
  const contactsQ = trpc.crm.contacts.list.useQuery({ tenantId: 1, search: contactPhone.replace(/\D/g, ""), limit: 5 });
  const existingContact = useMemo(() => {
    const cleaned = contactPhone.replace(/\D/g, "");
    return ((contactsQ.data || []) as any[]).find((c: any) => {
      const cPhone = (c.phone || "").replace(/\D/g, "");
      return cPhone === cleaned || cPhone === `55${cleaned}` || `55${cPhone}` === cleaned;
    });
  }, [contactsQ.data, contactPhone]);

  const createContact = trpc.crm.contacts.create.useMutation();
  const createDeal = trpc.crm.deals.create.useMutation();

  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !selectedPipelineId || !selectedStageId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setCreating(true);
    try {
      let contactId = existingContact?.id;

      // Create contact if not exists
      if (!contactId) {
        const newContact = await createContact.mutateAsync({
          tenantId: 1,
          name: contactName,
          phone: contactPhone,
          source: "whatsapp",
        });
        contactId = (newContact as any)?.id;
      }

      // Create deal
      const deal = await createDeal.mutateAsync({
        tenantId: 1,
        title: title.trim(),
        contactId,
        pipelineId: selectedPipelineId,
        stageId: selectedStageId,
        valueCents: value ? Math.round(parseFloat(value) * 100) : undefined,
      });

      toast.success("Negociação criada com sucesso!");
      onClose();

      // Navigate to deal
      if ((deal as any)?.id) {
        navigate(`/deal/${(deal as any).id}`);
      }
    } catch (e) {
      toast.error("Erro ao criar negociação");
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E9EDEF]">
          <h3 className="text-[16px] font-semibold text-[#111B21]">Nova Negociação</h3>
          <button onClick={onClose} className="p-1 hover:bg-[#F0F2F5] rounded-full">
            <X className="w-5 h-5 text-[#54656F]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Contact info */}
          <div className="flex items-center gap-3 p-3 bg-[#F0F2F5] rounded-lg">
            <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-sm">
              {contactName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-[#111B21]">{contactName}</p>
              <p className="text-xs text-[#667781]">{contactPhone}</p>
            </div>
            {existingContact && (
              <span className="ml-auto text-[11px] bg-[#E7FCE3] text-[#008069] px-2 py-0.5 rounded-full">
                Contato CRM
              </span>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="text-[13px] text-[#667781] mb-1 block">Título da negociação *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-[#D1D7DB] rounded-lg text-sm text-[#111B21] focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]"
            />
          </div>

          {/* Value */}
          <div>
            <label className="text-[13px] text-[#667781] mb-1 block">Valor (R$)</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-[#D1D7DB] rounded-lg text-sm text-[#111B21] focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]"
            />
          </div>

          {/* Pipeline */}
          <div>
            <label className="text-[13px] text-[#667781] mb-1 block">Pipeline *</label>
            <select
              value={selectedPipelineId || ""}
              onChange={(e) => { setSelectedPipelineId(Number(e.target.value)); setSelectedStageId(null); }}
              className="w-full px-3 py-2 border border-[#D1D7DB] rounded-lg text-sm text-[#111B21] focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] bg-white"
            >
              {pipelines.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Stage */}
          <div>
            <label className="text-[13px] text-[#667781] mb-1 block">Etapa *</label>
            <select
              value={selectedStageId || ""}
              onChange={(e) => setSelectedStageId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-[#D1D7DB] rounded-lg text-sm text-[#111B21] focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] bg-white"
            >
              {stages.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[#E9EDEF]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#667781] hover:bg-[#F0F2F5] rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !title.trim() || !selectedPipelineId || !selectedStageId}
            className="px-4 py-2 text-sm text-white bg-[#25D366] hover:bg-[#20BA5C] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar Negociação
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   EMPTY CHAT STATE (WhatsApp Web default screen)
   ═══════════════════════════════════════════════════════ */

function EmptyChat() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: "#F0F2F5" }}>
      <div className="text-center max-w-[560px] px-8">
        <div className="mb-[28px]">
          <svg viewBox="0 0 303 172" width="250" height="148" className="mx-auto opacity-30">
            <path fill="#25D366" d="M229.565 160.229c32.647-16.166 55.349-51.227 55.349-91.229 0-56.243-45.694-101.937-101.937-101.937S80.04 12.757 80.04 69c0 40.002 22.702 75.063 55.349 91.229L151.5 172l15.612-11.771h62.453z"/>
            <path fill="#FFF" d="M180.5 84.5c0 16.016-12.984 29-29 29s-29-12.984-29-29 12.984-29 29-29 29 12.984 29 29z"/>
          </svg>
        </div>
        <h1 className="text-[32px] font-light text-[#41525D] leading-[38px] mb-[14px]">
          ASTRA WhatsApp
        </h1>
        <p className="text-[14px] text-[#667781] leading-[20px]">
          Envie e receba mensagens sem manter seu celular conectado.
          <br />
          Selecione uma conversa ao lado para começar.
        </p>
        <div className="mt-[40px] pt-[20px] border-t border-[#E9EDEF]">
          <p className="text-[14px] text-[#667781]/60 flex items-center justify-center gap-[6px]">
            <span className="inline-block w-[6px] h-[6px] rounded-full bg-[#25D366]" />
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
    <div className="flex h-full items-center justify-center" style={{ backgroundColor: "#F0F2F5" }}>
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 rounded-full bg-[#25D366]/10 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-10 h-10 text-[#25D366]" />
        </div>
        <h2 className="text-xl font-medium text-[#111B21] mb-2">Nenhuma sessão WhatsApp ativa</h2>
        <p className="text-[14px] text-[#667781] mb-4">
          Conecte uma sessão na página WhatsApp para ver suas conversas aqui.
        </p>
        <a
          href="/whatsapp"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg text-sm font-medium hover:bg-[#20BA5C] transition-colors"
        >
          <Phone className="w-4 h-4" />
          Ir para WhatsApp
        </a>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════ */

export default function InboxPage() {
  const { lastMessage } = useSocket();
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "groups">("all");
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) === "true"; } catch { return false; }
  });
  const prevMessageRef = useRef<typeof lastMessage>(null);

  // Get active WhatsApp session
  const sessionsQ = trpc.whatsapp.sessions.useQuery();
  const activeSession = useMemo(
    () => (sessionsQ.data || []).find((s: any) => s.liveStatus === "connected"),
    [sessionsQ.data]
  );

  // Get conversations list
  const conversationsQ = trpc.whatsapp.conversations.useQuery(
    { sessionId: activeSession?.sessionId || "" },
    { enabled: !!activeSession?.sessionId, refetchInterval: 8000 }
  );

  // Get CRM contacts to match names
  const contactsQ = trpc.crm.contacts.list.useQuery(
    { tenantId: 1, limit: 500 },
    { enabled: true }
  );

  // Batch fetch profile pictures
  const convJids = useMemo(() => {
    return ((conversationsQ.data || []) as ConvItem[]).map((c) => c.remoteJid);
  }, [conversationsQ.data]);

  const profilePicsQ = trpc.whatsapp.profilePictures.useQuery(
    { sessionId: activeSession?.sessionId || "", jids: convJids.slice(0, 50) },
    { enabled: !!activeSession?.sessionId && convJids.length > 0, staleTime: 5 * 60 * 1000 }
  );

  const profilePicMap = useMemo(() => {
    return (profilePicsQ.data || {}) as Record<string, string | null>;
  }, [profilePicsQ.data]);

  // Mark as read mutation
  const markRead = trpc.whatsapp.markRead.useMutation({
    onSuccess: () => conversationsQ.refetch(),
  });

  // Build contact name map from CRM contacts (phone -> name)
  const contactNameMap = useMemo(() => {
    const map = new Map<string, { id: number; name: string; phone: string; email?: string; avatarUrl?: string }>();
    for (const c of (contactsQ.data as any[]) || []) {
      if (c.phone) {
        const cleaned = c.phone.replace(/\D/g, "");
        const entry = { id: c.id, name: c.name, phone: c.phone, email: c.email || undefined, avatarUrl: undefined };
        map.set(cleaned, entry);
        if (cleaned.startsWith("55")) {
          map.set(cleaned.substring(2), entry);
        } else {
          map.set(`55${cleaned}`, entry);
        }
      }
    }
    return map;
  }, [contactsQ.data]);

  const getContactForJid = useCallback((jid: string) => {
    const phone = jid.split("@")[0];
    return contactNameMap.get(phone) || null;
  }, [contactNameMap]);

  const getDisplayName = useCallback((jid: string) => {
    const contact = getContactForJid(jid);
    if (contact) return contact.name;
    return formatPhoneNumber(jid);
  }, [getContactForJid]);

  // Refetch on new messages + play notification sound
  useEffect(() => {
    if (!lastMessage) return;
    conversationsQ.refetch();

    // Play sound only for incoming messages (not from me)
    const isNew = !prevMessageRef.current ||
      lastMessage.timestamp !== prevMessageRef.current.timestamp ||
      lastMessage.remoteJid !== prevMessageRef.current.remoteJid ||
      lastMessage.content !== prevMessageRef.current.content;

    if (isNew && !lastMessage.fromMe && !isMuted) {
      const isCurrentConv = selectedJid === lastMessage.remoteJid;
      if (!isCurrentConv) {
        playNotification();
      }
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

  // Filter conversations
  const filteredConvs = useMemo(() => {
    let convs = (conversationsQ.data || []) as ConvItem[];

    if (filter === "unread") {
      convs = convs.filter((c) => Number(c.unreadCount) > 0);
    } else if (filter === "groups") {
      convs = convs.filter((c) => c.remoteJid.includes("@g.us"));
    }

    if (search) {
      const s = search.toLowerCase();
      convs = convs.filter((c) => {
        const name = getDisplayName(c.remoteJid).toLowerCase();
        const phone = c.remoteJid.split("@")[0];
        return name.includes(s) || phone.includes(s);
      });
    }

    return convs;
  }, [conversationsQ.data, search, filter, getDisplayName]);

  // Selected contact for WhatsAppChat (with profile picture)
  const selectedContact = useMemo(() => {
    if (!selectedJid) return null;
    const crmContact = getContactForJid(selectedJid);
    const pic = profilePicMap[selectedJid] || undefined;
    if (crmContact) return { ...crmContact, avatarUrl: pic };
    const phone = selectedJid.split("@")[0];
    return { id: 0, name: formatPhoneNumber(selectedJid), phone, email: undefined, avatarUrl: pic };
  }, [selectedJid, getContactForJid, profilePicMap]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      try { localStorage.setItem(MUTE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  // No session state
  if (!activeSession && !sessionsQ.isLoading) {
    return (
      <div style={{ height: "calc(100vh - 56px)" }}>
        <NoSession />
      </div>
    );
  }

  return (
    <div
      className="flex overflow-hidden"
      style={{
        height: "calc(100vh - 56px)",
        backgroundColor: "#eae6df",
      }}
    >
      {/* ═══ LEFT PANEL: Conversations List ═══ */}
      <div
        className={`flex flex-col bg-white ${
          showMobileChat ? "hidden md:flex" : "flex"
        }`}
        style={{
          width: "100%",
          maxWidth: "440px",
          minWidth: "340px",
          borderRight: "1px solid #d1d7db",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            height: "59px",
            padding: "10px 16px",
            backgroundColor: "#F0F2F5",
          }}
        >
          <WaAvatar name="Eu" size={40} />
          <div className="flex items-center gap-[10px]">
            <button
              onClick={toggleMute}
              className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-[#D9DBDE] transition-colors relative group"
              title={isMuted ? "Ativar som de notificação" : "Silenciar notificações"}
            >
              {isMuted ? (
                <VolumeX className="w-[22px] h-[22px] text-[#EA4335]" />
              ) : (
                <Volume2 className="w-[22px] h-[22px] text-[#54656F]" />
              )}
              {/* Tooltip */}
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[#111B21] text-white text-[11px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {isMuted ? "Som desativado" : "Som ativado"}
              </span>
            </button>
            <button className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-[#D9DBDE] transition-colors">
              <MessageCircle className="w-[22px] h-[22px] text-[#54656F]" />
            </button>
            <button className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-[#D9DBDE] transition-colors">
              <MoreVertical className="w-[22px] h-[22px] text-[#54656F]" />
            </button>
          </div>
        </div>

        {/* ── Search Bar ── */}
        <div className="shrink-0" style={{ padding: "7px 12px", backgroundColor: "#FFFFFF" }}>
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ height: "35px", backgroundColor: "#F0F2F5", padding: "0 8px 0 12px" }}
          >
            <Search
              className="shrink-0 transition-all duration-200"
              style={{ width: "16px", height: "16px", color: searchFocused ? "#25D366" : "#54656F" }}
            />
            <input
              type="text"
              placeholder="Pesquisar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="flex-1 bg-transparent border-none outline-none text-[14px] text-[#111B21] placeholder:text-[#667781]"
              style={{ paddingLeft: "12px", height: "100%" }}
            />
          </div>
        </div>

        {/* ── Filter Tabs ── */}
        <div className="flex items-center gap-[6px] shrink-0" style={{ padding: "6px 12px" }}>
          {(["all", "unread", "groups"] as const).map((f) => {
            const labels = { all: "Todas", unread: "Não lidas", groups: "Grupos" };
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="rounded-full text-[13px] font-medium transition-colors"
                style={{
                  padding: "5px 12px",
                  backgroundColor: active ? "#E7FCE3" : "#F0F2F5",
                  color: active ? "#008069" : "#54656F",
                }}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>

        {/* ── Conversations List ── */}
        <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
          {conversationsQ.isLoading || sessionsQ.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-[#25D366] animate-spin" />
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <MessageSquare className="w-12 h-12 text-[#667781]/20 mb-3" />
              <p className="text-[14px] text-[#667781]">
                {search ? "Nenhuma conversa encontrada" : filter === "unread" ? "Nenhuma conversa não lida" : "Nenhuma conversa ainda"}
              </p>
            </div>
          ) : (
            filteredConvs.map((conv) => (
              <ConversationItem
                key={conv.remoteJid}
                conv={conv}
                isActive={selectedJid === conv.remoteJid}
                contactName={getDisplayName(conv.remoteJid)}
                pictureUrl={profilePicMap[conv.remoteJid]}
                onClick={() => handleSelectConv(conv.remoteJid)}
              />
            ))
          )}
        </div>
      </div>

      {/* ═══ RIGHT PANEL: Chat Area ═══ */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          !showMobileChat ? "hidden md:flex" : "flex"
        }`}
        style={{ position: "relative" }}
      >
        {!selectedJid || !activeSession ? (
          <EmptyChat />
        ) : (
          <div className="flex flex-col h-full w-full" style={{ position: "relative" }}>
            {/* Mobile back button overlay */}
            <button
              onClick={() => setShowMobileChat(false)}
              className="md:hidden absolute top-[10px] left-[6px] z-30 p-[6px] rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.85)", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
            >
              <ArrowLeft className="w-5 h-5 text-[#54656F]" />
            </button>

            <WhatsAppChat
              contact={selectedContact}
              sessionId={activeSession.sessionId}
              remoteJid={selectedJid}
              onCreateDeal={() => setShowCreateDeal(true)}
            />
          </div>
        )}
      </div>

      {/* ═══ CREATE DEAL DIALOG ═══ */}
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
    </div>
  );
}
