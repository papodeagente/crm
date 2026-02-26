import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import WhatsAppChat from "@/components/WhatsAppChat";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, MessageSquare, Filter, MoreVertical, ArrowLeft,
  Check, CheckCheck, Clock, Mic, Image as ImageIcon, Video,
  FileText, Phone, Loader2, Users, ChevronDown
} from "lucide-react";

// ─── Helpers ───
function formatTime(date: string | Date | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) {
    return d.toLocaleDateString("pt-BR", { weekday: "short" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function getContactName(jid: string): string {
  if (!jid) return "Desconhecido";
  // Group JID
  if (jid.includes("@g.us")) {
    return jid.split("@")[0];
  }
  // Extract phone number from JID
  const phone = jid.split("@")[0];
  // Format Brazilian number
  if (phone.startsWith("55") && phone.length >= 12) {
    const ddd = phone.substring(2, 4);
    const num = phone.substring(4);
    if (num.length === 9) {
      return `(${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`;
    }
    if (num.length === 8) {
      return `(${ddd}) ${num.substring(0, 4)}-${num.substring(4)}`;
    }
  }
  return phone;
}

function getMessagePreview(content: string | null, messageType: string | null): string {
  if (!messageType || messageType === "text" || messageType === "conversation" || messageType === "extendedTextMessage") {
    return content || "";
  }
  if (messageType === "imageMessage" || messageType === "image") return "📷 Foto";
  if (messageType === "videoMessage" || messageType === "video") return "📹 Vídeo";
  if (messageType === "audioMessage" || messageType === "audio") return "🎤 Áudio";
  if (messageType === "documentMessage" || messageType === "document") return "📄 Documento";
  if (messageType === "stickerMessage") return "🏷️ Sticker";
  if (messageType === "contactMessage") return "👤 Contato";
  if (messageType === "locationMessage") return "📍 Localização";
  return content || `[${messageType}]`;
}

// ─── Status Ticks for conversation list ───
function ConvStatusTick({ status, fromMe }: { status: string | null; fromMe: boolean }) {
  if (!fromMe) return null;
  switch (status) {
    case "pending":
      return <Clock className="w-3.5 h-3.5 text-[#667781]/60 shrink-0" />;
    case "sent":
      return <Check className="w-3.5 h-3.5 text-[#667781]/60 shrink-0" />;
    case "delivered":
      return <CheckCheck className="w-3.5 h-3.5 text-[#667781]/60 shrink-0" />;
    case "read":
    case "played":
      return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />;
    default:
      return <Check className="w-3.5 h-3.5 text-[#667781]/60 shrink-0" />;
  }
}

// ─── WhatsApp Avatar ───
function WaAvatar({ name, size = 49, isGroup = false }: { name: string; size?: number; isGroup?: boolean }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="rounded-full bg-[#DFE5E7] flex items-center justify-center shrink-0 overflow-hidden"
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
}

// ─── Conversation Item ───
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

function ConversationItem({
  conv,
  isActive,
  contactName,
  onClick,
}: {
  conv: ConvItem;
  isActive: boolean;
  contactName: string;
  onClick: () => void;
}) {
  const isGroup = conv.remoteJid.includes("@g.us");
  const fromMe = conv.lastFromMe === true || conv.lastFromMe === 1;
  const unread = Number(conv.unreadCount) || 0;
  const preview = getMessagePreview(conv.lastMessage, conv.lastMessageType);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors duration-75 ${
        isActive
          ? "bg-[#F0F2F5]"
          : "hover:bg-[#F5F6F6]"
      }`}
    >
      <WaAvatar name={contactName} size={49} isGroup={isGroup} />
      <div className="flex-1 min-w-0 border-b border-[#E9EDEF] py-0.5" style={{ borderBottom: "none" }}>
        <div className="flex items-center justify-between">
          <p className="text-[16px] text-[#111B21] truncate font-normal leading-tight">
            {contactName}
          </p>
          <span className={`text-[12px] shrink-0 ml-2 ${unread > 0 ? "text-[#25D366] font-medium" : "text-[#667781]"}`}>
            {formatTime(conv.lastTimestamp)}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <ConvStatusTick status={conv.lastStatus} fromMe={fromMe} />
          <p className="text-[14px] text-[#667781] truncate flex-1 leading-tight">
            {preview || "Sem mensagens"}
          </p>
          {unread > 0 && (
            <span className="bg-[#25D366] text-white text-[11px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1.5 shrink-0">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Empty State (WhatsApp Web style) ───
function EmptyChat() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#F0F2F5]">
      <div className="text-center max-w-md px-6">
        <div className="w-[320px] h-[188px] mx-auto mb-8 relative">
          <svg viewBox="0 0 303 172" width="320" height="188">
            <path fill="#DAF7C3" d="M229.565 160.229c32.647-16.166 55.349-51.227 55.349-91.229 0-56.243-45.694-101.937-101.937-101.937S80.04 12.757 80.04 69c0 40.002 22.702 75.063 55.349 91.229L151.5 172l15.612-11.771h62.453z"/>
            <path fill="#FFF" d="M180.5 84.5c0 16.016-12.984 29-29 29s-29-12.984-29-29 12.984-29 29-29 29 12.984 29 29z"/>
            <path fill="#DAF7C3" d="M151.5 60.5c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24zm-3.6 36l-12-12 3.4-3.4 8.6 8.6 18.6-18.6 3.4 3.4-22 22z"/>
          </svg>
        </div>
        <h2 className="text-[32px] font-light text-[#41525D] mb-4">WhatsApp Web</h2>
        <p className="text-[14px] text-[#667781] leading-relaxed">
          Envie e receba mensagens diretamente do seu CRM. Selecione uma conversa ao lado para começar.
        </p>
        <div className="mt-8 flex items-center justify-center gap-2 text-[13px] text-[#667781]/60">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#25D366]" />
          Conectado e sincronizado
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ───
export default function InboxPage() {
  const { lastMessage } = useSocket();
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Get active WhatsApp session
  const sessionsQ = trpc.whatsapp.sessions.useQuery();
  const activeSession = useMemo(
    () => (sessionsQ.data || []).find((s: any) => s.liveStatus === "connected"),
    [sessionsQ.data]
  );

  // Get conversations list
  const conversationsQ = trpc.whatsapp.conversations.useQuery(
    { sessionId: activeSession?.sessionId || "" },
    { enabled: !!activeSession?.sessionId, refetchInterval: 10000 }
  );

  // Get CRM contacts to match names
  const contactsQ = trpc.crm.contacts.list.useQuery(
    { tenantId: 1, limit: 500 },
    { enabled: true }
  );

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
        // Store with and without country code
        map.set(cleaned, { id: c.id, name: c.name, phone: c.phone, email: c.email || undefined, avatarUrl: undefined });
        if (cleaned.startsWith("55")) {
          map.set(cleaned.substring(2), { id: c.id, name: c.name, phone: c.phone, email: c.email || undefined, avatarUrl: undefined });
        } else {
          map.set(`55${cleaned}`, { id: c.id, name: c.name, phone: c.phone, email: c.email || undefined, avatarUrl: undefined });
        }
      }
    }
    return map;
  }, [contactsQ.data]);

  // Find CRM contact for a JID
  const getContactForJid = useCallback((jid: string) => {
    const phone = jid.split("@")[0];
    return contactNameMap.get(phone) || null;
  }, [contactNameMap]);

  // Get display name for a JID
  const getDisplayName = useCallback((jid: string) => {
    const contact = getContactForJid(jid);
    if (contact) return contact.name;
    return getContactName(jid);
  }, [getContactForJid]);

  // Refetch on new messages
  useEffect(() => {
    if (lastMessage) {
      conversationsQ.refetch();
    }
  }, [lastMessage]);

  // Select conversation
  const handleSelectConv = useCallback((jid: string) => {
    setSelectedJid(jid);
    setShowMobileChat(true);
    // Mark as read
    if (activeSession?.sessionId) {
      markRead.mutate({ sessionId: activeSession.sessionId, remoteJid: jid });
    }
  }, [activeSession?.sessionId, markRead]);

  // Filter conversations
  const filteredConvs = useMemo(() => {
    const convs = (conversationsQ.data || []) as ConvItem[];
    if (!search) return convs;
    const s = search.toLowerCase();
    return convs.filter((c) => {
      const name = getDisplayName(c.remoteJid).toLowerCase();
      const phone = c.remoteJid.split("@")[0];
      const msg = (c.lastMessage || "").toLowerCase();
      return name.includes(s) || phone.includes(s) || msg.includes(s);
    });
  }, [conversationsQ.data, search, getDisplayName]);

  // Selected contact for WhatsAppChat
  const selectedContact = useMemo(() => {
    if (!selectedJid) return null;
    const crmContact = getContactForJid(selectedJid);
    if (crmContact) return crmContact;
    // Create a virtual contact
    const phone = selectedJid.split("@")[0];
    return { id: 0, name: getContactName(selectedJid), phone, email: undefined, avatarUrl: undefined };
  }, [selectedJid, getContactForJid]);

  // No session state
  if (!activeSession && !sessionsQ.isLoading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center bg-[#F0F2F5]">
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

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-[#F0F2F5]">
      {/* ─── LEFT PANEL: Conversations List ─── */}
      <div
        className={`w-full md:w-[420px] lg:w-[440px] border-r border-[#E9EDEF] flex flex-col bg-white shrink-0 ${
          showMobileChat ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#F0F2F5]">
          <div className="flex items-center gap-3">
            <WaAvatar name="Me" size={40} />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-[#DFE5E7] rounded-full transition-colors">
              <Filter className="w-5 h-5 text-[#54656F]" />
            </button>
            <button className="p-2 hover:bg-[#DFE5E7] rounded-full transition-colors">
              <MoreVertical className="w-5 h-5 text-[#54656F]" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-2.5 py-1.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#54656F]" />
            <Input
              className="pl-10 h-[35px] rounded-lg bg-[#F0F2F5] border-0 text-[14px] text-[#111B21] placeholder:text-[#667781] focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="Pesquisar ou começar uma nova conversa"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 px-3 py-1.5">
          <button className="px-3 py-1 rounded-full bg-[#25D366]/10 text-[#25D366] text-[13px] font-medium">
            Todas
          </button>
          <button className="px-3 py-1 rounded-full bg-[#F0F2F5] text-[#54656F] text-[13px] hover:bg-[#E9EDEF] transition-colors">
            Não lidas
          </button>
          <button className="px-3 py-1 rounded-full bg-[#F0F2F5] text-[#54656F] text-[13px] hover:bg-[#E9EDEF] transition-colors">
            Grupos
          </button>
        </div>

        {/* Conversations list */}
        <ScrollArea className="flex-1">
          {conversationsQ.isLoading || sessionsQ.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-[#25D366] animate-spin" />
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <MessageSquare className="w-12 h-12 text-[#667781]/20 mb-3" />
              <p className="text-[14px] text-[#667781]">
                {search ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
              </p>
              {!search && (
                <p className="text-[13px] text-[#667781]/60 mt-1">
                  Envie uma mensagem para iniciar uma conversa
                </p>
              )}
            </div>
          ) : (
            filteredConvs.map((conv) => (
              <ConversationItem
                key={conv.remoteJid}
                conv={conv}
                isActive={selectedJid === conv.remoteJid}
                contactName={getDisplayName(conv.remoteJid)}
                onClick={() => handleSelectConv(conv.remoteJid)}
              />
            ))
          )}
        </ScrollArea>
      </div>

      {/* ─── RIGHT PANEL: Chat ─── */}
      <div
        className={`flex-1 flex flex-col ${
          !showMobileChat ? "hidden md:flex" : "flex"
        }`}
      >
        {!selectedJid || !activeSession ? (
          <EmptyChat />
        ) : (
          <div className="flex flex-col h-full relative">
            {/* Mobile back button */}
            <button
              onClick={() => { setShowMobileChat(false); }}
              className="md:hidden absolute top-3 left-2 z-20 p-1.5 bg-white/80 rounded-full shadow-sm"
            >
              <ArrowLeft className="w-5 h-5 text-[#54656F]" />
            </button>

            <WhatsAppChat
              contact={selectedContact}
              sessionId={activeSession.sessionId}
              remoteJid={selectedJid}
            />
          </div>
        )}
      </div>
    </div>
  );
}
