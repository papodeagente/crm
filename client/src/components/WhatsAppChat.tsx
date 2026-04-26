/**
 * WhatsAppChat — Orchestrator (Phase 5 rewrite)
 * Composes: ChatHeader, MessageList, ChatInput + inline modals/panels
 * ~450 lines replacing the original 3407-line monolith.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { useTenantId } from "@/hooks/useTenantId";
import { useAuth } from "@/_core/hooks/useAuth";
import { useChatMessages } from "@/hooks/useChatMessages";
import { toast } from "sonner";
import {
  Loader2, X, Check, CalendarClock, Paperclip, Send,
} from "lucide-react";
import { usePresenceTracking } from "@/hooks/usePresenceTracking";
import ChatHeader from "./chat/ChatHeader";
import MessageList from "./chat/MessageList";
import ChatInput from "./chat/ChatInput";
import LocationModal from "./chat/LocationModal";
import ContactModal from "./chat/ContactModal";
import PollModal from "./chat/PollModal";
import EditMessageModal from "./chat/EditMessageModal";
import ImageLightbox from "./chat/ImageLightbox";
import TransferDialog from "./TransferDialog";
import ImportConversationDialog from "@/components/ImportConversationDialog";
import InteractiveMessageComposer from "./chat/InteractiveMessageComposer";
import WhatsAppLabelsSection from "./inbox/WhatsAppLabelsSection";

/* ─── Types ─── */
interface AssignmentInfo {
  assignedUserId?: number | null;
  assignedAgentName?: string | null;
  assignmentStatus?: string | null;
  assignmentPriority?: string | null;
}

interface AgentInfo {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
  status: string;
}

interface ReplyTarget {
  messageId: string;
  content: string;
  fromMe: boolean;
}

interface Message {
  id: number;
  sessionId: string;
  messageId?: string | null;
  remoteJid: string;
  fromMe: boolean;
  messageType: string;
  content: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  mediaDuration?: number | null;
  isVoiceNote?: boolean | null;
  status?: string | null;
  timestamp: string | Date;
  createdAt: string | Date;
  quotedMessageId?: string | null;
  structuredData?: any | null;
  audioTranscription?: string | null;
  audioTranscriptionStatus?: string | null;
  senderAgentId?: number | null;
}

export interface WhatsAppChatProps {
  contact: { id: number; name: string; phone: string; email?: string; avatarUrl?: string } | null;
  sessionId: string;
  remoteJid: string;
  onCreateDeal?: () => void;
  onCreateContact?: () => void;
  hasCrmContact?: boolean;
  assignment?: AssignmentInfo | null;
  agents?: AgentInfo[];
  onAssign?: (agentId: number | null) => void;
  onStatusChange?: (status: "open" | "pending" | "resolved" | "closed") => void;
  myAvatarUrl?: string;
  waConversationId?: number;
  dealId?: number;
  dealTitle?: string;
  dealValueCents?: number;
  dealStageName?: string;
  companyName?: string;
  onOptimisticSend?: (msg: { content: string; messageType?: string }) => void;
  onStatusConfirmed?: (data: { messageId: string; status: string }) => void;
  autoOpenAssign?: boolean;
  onAutoOpenAssignConsumed?: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  pendingFile?: File | null;
  onClearPendingFile?: () => void;
}

/* ─── Utilities ─── */
type PreviewItem = { file: File; dataUri: string; mediaType: "image" | "video" | "document"; caption: string };
const MAX_FILES = 30;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function detectMediaType(file: File, forceDoc?: boolean): "image" | "video" | "document" {
  if (forceDoc) return "document";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

async function filesToPreviewItems(files: File[], forceDoc?: boolean): Promise<PreviewItem[]> {
  const items: PreviewItem[] = [];
  for (const file of files.slice(0, MAX_FILES)) {
    const base64 = await fileToBase64(file);
    const dataUri = `data:${file.type || "application/octet-stream"};base64,${base64}`;
    items.push({ file, dataUri, mediaType: detectMediaType(file, forceDoc), caption: "" });
  }
  return items;
}

/* ═══════════════════════════════════════════════════════
   MAIN CHAT COMPONENT
   ═══════════════════════════════════════════════════════ */

export default function WhatsAppChat({
  contact, sessionId, remoteJid,
  onCreateDeal, onCreateContact, hasCrmContact,
  assignment, agents, onAssign, onStatusChange,
  myAvatarUrl, waConversationId,
  dealId, dealTitle, dealValueCents, dealStageName, companyName,
  onOptimisticSend, onStatusConfirmed, autoOpenAssign, onAutoOpenAssignConsumed,
  onToggleSidebar, sidebarOpen,
  pendingFile, onClearPendingFile,
}: WhatsAppChatProps) {
  const tenantId = useTenantId();
  const { user: authUser } = useAuth();
  const { lastMessage, isConnected: socketConnected } = useSocket();
  const utils = trpc.useUtils();

  /* ── Chat messages hook (queries, socket, reactions, status, transcriptions, notes) ── */
  const chat = useChatMessages({ sessionId, remoteJid, waConversationId, socketConnected });

  /* ── Presence tracking (typing indicator) ── */
  const contactPhone = contact?.phone?.replace(/\D/g, "") || "";
  const { remotePresence } = usePresenceTracking({ sessionId, remoteJid, contactPhone });

  /**
   * Número canônico pra ENVIO de mensagem. SEMPRE deriva do remoteJid
   * da conversa — essa é a fonte de verdade, vinda do webhook Z-API.
   *
   * NUNCA usar contact.phone aqui. Razão: se o contato foi salvo com
   * phone errado (ex: CRM prefixou +55 num número de Portugal +351),
   * o envio vai pro JID errado e a Z-API cria conversa duplicada no
   * número inexistente. Regressão real reportada com cliente portuguesa:
   * conversa 351937914301@... foi duplicada em 55351937914301@... e a
   * mensagem da atendente jamais chegou.
   *
   * Se o remoteJid for LID (@lid), usa só a parte numérica — a Z-API
   * resolve o phone real a partir do LID.
   */
  const sendNumber = (remoteJid || "").split("@")[0].replace(/\D/g, "")
    || contact?.phone?.replace(/\D/g, "")
    || "";

  /* ── UI toggle state ── */
  const [isSending, setIsSending] = useState(false);
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showInteractiveComposer, setShowInteractiveComposer] = useState(false);
  const [editTarget, setEditTarget] = useState<{ messageId: string; text: string } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showAgentNames, setShowAgentNames] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  // Tags panel
  const [showTagsPanel, setShowTagsPanel] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  // Schedule modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  // Schedule message text (shared with ChatInput messageText for schedule modal)
  const [scheduleMessageText, setScheduleMessageText] = useState("");
  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  // Media preview before sending (multi-file carousel)
  const [previewFiles, setPreviewFiles] = useState<PreviewItem[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [sendProgress, setSendProgress] = useState(0); // 0 = not sending, N = Nth file sent
  const addFileInputRef = useRef<HTMLInputElement>(null);

  /* ── Agent map for MessageList ── */
  const agentMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (agents) for (const a of agents) map[a.id] = a.name;
    return map;
  }, [agents]);

  /* ── Timeline events query ── */
  const eventsQ = trpc.whatsapp.events.list.useQuery(
    { waConversationId: waConversationId || 0 },
    { enabled: !!waConversationId && showTimeline, refetchInterval: 60000, staleTime: 30000, refetchIntervalInBackground: false },
  );

  /* ── AI Settings (for auto-transcription) ── */
  const aiSettingsQ = trpc.ai.getSettings.useQuery(undefined, { enabled: true, staleTime: 60000 });

  /* ══════════════════════════════════════════════════════
     MUTATIONS
     ══════════════════════════════════════════════════════ */

  /* ── Optimistic update helper ── */
  const optimisticIdCounter = useRef(0);
  const addOptimisticMessage = useCallback((text: string, quotedId?: string | null): string => {
    const queryKey = { sessionId, remoteJid, limit: chat.msgLimit };
    const clientMsgId = `opt_${Date.now()}_${++optimisticIdCounter.current}`;
    const optimistic: Message = {
      id: -Date.now() - optimisticIdCounter.current,
      sessionId,
      messageId: clientMsgId,
      remoteJid,
      fromMe: true,
      messageType: "conversation",
      content: text,
      status: "pending",
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      quotedMessageId: quotedId || null,
      senderAgentId: authUser?.id || null,
    } as any;
    utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
      if (!old) return [optimistic];
      return [optimistic, ...old];
    });
    setTimeout(() => {
      const el = document.querySelector("[data-chat-scroll]");
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
    return clientMsgId;
  }, [sessionId, remoteJid, utils, chat.msgLimit]);

  const delayedRefetch = useCallback(() => {
    // Smart refetch: preserve recently-sent messages that the server might not have yet.
    // The server socket event provides real-time confirmation, but the refetch syncs DB metadata.
    setTimeout(async () => {
      const queryKey = { sessionId, remoteJid, limit: chat.msgLimit };
      // Snapshot sent messages before refetch
      const before = utils.whatsapp.messagesByContact.getData(queryKey);
      const recentSent = (before || []).filter((m: any) =>
        m.fromMe && Date.now() - new Date(m.timestamp || m.createdAt).getTime() < 30000
      );

      await chat.refetchMessages();

      // Re-add any recently-sent messages that the refetch dropped
      if (recentSent.length > 0) {
        utils.whatsapp.messagesByContact.setData(queryKey, (current: any) => {
          if (!current) return current;
          const currentIds = new Set(current.map((m: any) => m.messageId));
          const missing = recentSent.filter((m: any) => m.messageId && !currentIds.has(m.messageId));
          if (missing.length === 0) return current;
          return [...missing, ...current];
        });
      }
    }, 2000);
  }, [chat.refetchMessages, sessionId, remoteJid, chat.msgLimit, utils]);

  /* ── Send message ── */
  const lastClientMsgIdRef = useRef<string | null>(null);
  const sendMessage = trpc.whatsapp.sendMessage.useMutation({
    onMutate: (vars) => {
      const clientMsgId = addOptimisticMessage(vars.message);
      lastClientMsgIdRef.current = clientMsgId;
      onOptimisticSend?.({ content: vars.message, messageType: "conversation" });
    },
    onSuccess: (result) => {
      const clientMsgId = lastClientMsgIdRef.current;
      if (result.messageId && clientMsgId) {
        const queryKey = { sessionId, remoteJid, limit: chat.msgLimit };
        utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
          if (!old) return old;
          return old.map((m: any) =>
            m.messageId === clientMsgId ? { ...m, messageId: result.messageId, status: "sent" } : m,
          );
        });
      }
      if (result.messageId) {
        onStatusConfirmed?.({ messageId: result.messageId, status: "sent" });
      }
      delayedRefetch();
    },
    onError: () => {
      const clientMsgId = lastClientMsgIdRef.current;
      const queryKey = { sessionId, remoteJid, limit: chat.msgLimit };
      utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
        if (!old) return old;
        return clientMsgId
          ? old.filter((m: any) => m.messageId !== clientMsgId)
          : old.filter((m: any) => !m.messageId?.startsWith("opt_"));
      });
      toast.error("Erro ao enviar mensagem");
    },
  });

  /* ── Send text with quote ── */
  const lastQuoteClientMsgIdRef = useRef<string | null>(null);
  const sendTextWithQuote = trpc.whatsapp.sendTextWithQuote.useMutation({
    onMutate: (vars) => {
      const clientMsgId = addOptimisticMessage(vars.message, vars.quotedMessageId);
      lastQuoteClientMsgIdRef.current = clientMsgId;
      onOptimisticSend?.({ content: vars.message, messageType: "conversation" });
    },
    onSuccess: (result) => {
      const clientMsgId = lastQuoteClientMsgIdRef.current;
      if (result.messageId && clientMsgId) {
        const queryKey = { sessionId, remoteJid, limit: chat.msgLimit };
        utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
          if (!old) return old;
          return old.map((m: any) =>
            m.messageId === clientMsgId ? { ...m, messageId: result.messageId, status: "sent" } : m,
          );
        });
      }
      if (result.messageId) {
        onStatusConfirmed?.({ messageId: result.messageId, status: "sent" });
      }
      delayedRefetch();
      setReplyTarget(null);
    },
    onError: () => {
      const clientMsgId = lastQuoteClientMsgIdRef.current;
      const queryKey = { sessionId, remoteJid, limit: chat.msgLimit };
      utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
        if (!old) return old;
        return clientMsgId
          ? old.filter((m: any) => m.messageId !== clientMsgId)
          : old.filter((m: any) => !m.messageId?.startsWith("opt_"));
      });
      toast.error("Erro ao enviar resposta");
    },
  });

  /* ── Media ── */
  const uploadMedia = trpc.whatsapp.uploadMedia.useMutation();
  const sendMedia = trpc.whatsapp.sendMedia.useMutation({
    onMutate: (vars) => {
      const mediaLabel = vars.mediaType === "image" ? "📷 Imagem" : vars.mediaType === "video" ? "🎥 Vídeo" : vars.mediaType === "audio" ? "🎤 Áudio" : "📄 Documento";
      onOptimisticSend?.({ content: mediaLabel, messageType: vars.mediaType || "document" });
    },
    onSuccess: () => delayedRefetch(),
  });

  /* ── Reaction / Delete / Edit ── */
  const sendReaction = trpc.whatsapp.sendReaction.useMutation({
    onSuccess: () => toast.success("Reação enviada"),
    onError: () => toast.error("Erro ao enviar reação"),
  });
  const deleteMessageMut = trpc.whatsapp.deleteMessage.useMutation({
    onSuccess: () => { chat.refetchMessages(); toast.success("Mensagem apagada"); },
    onError: () => toast.error("Erro ao apagar mensagem"),
  });
  const editMessageMut = trpc.whatsapp.editMessage.useMutation({
    onSuccess: () => { chat.refetchMessages(); toast.success("Mensagem editada"); },
    onError: () => toast.error("Erro ao editar mensagem"),
  });

  /* ── Presence ── */
  const sendPresenceMut = trpc.whatsapp.sendPresence.useMutation();

  /* ── Location / Contact / Poll ── */
  const sendLocationMut = trpc.whatsapp.sendLocation.useMutation({
    onMutate: () => { onOptimisticSend?.({ content: "📍 Localização", messageType: "locationMessage" }); },
    onSuccess: () => { chat.refetchMessages(); toast.success("Localização enviada"); },
    onError: () => toast.error("Erro ao enviar localização"),
  });
  const sendContactMut = trpc.whatsapp.sendContact.useMutation({
    onMutate: () => { onOptimisticSend?.({ content: "👤 Passageiro", messageType: "contactMessage" }); },
    onSuccess: () => { chat.refetchMessages(); toast.success("Passageiro enviado"); },
    onError: () => toast.error("Erro ao enviar passageiro"),
  });
  const sendPollMut = trpc.whatsapp.sendPoll.useMutation({
    onMutate: () => { onOptimisticSend?.({ content: "📊 Enquete", messageType: "pollCreationMessage" }); },
    onSuccess: () => { chat.refetchMessages(); toast.success("Enquete enviada"); },
    onError: () => toast.error("Erro ao enviar enquete"),
  });
  const sendButtonListMut = trpc.whatsapp.sendButtonList.useMutation({
    onMutate: () => { onOptimisticSend?.({ content: "🔘 Mensagem com botões", messageType: "buttonsMessage" }); },
    onSuccess: () => { chat.refetchMessages(); toast.success("Mensagem com botões enviada"); },
    onError: (e) => toast.error(e.message || "Erro ao enviar botões"),
  });
  const sendOptionListMut = trpc.whatsapp.sendOptionList.useMutation({
    onMutate: () => { onOptimisticSend?.({ content: "📋 Lista de opções", messageType: "listMessage" }); },
    onSuccess: () => { chat.refetchMessages(); toast.success("Lista de opções enviada"); },
    onError: (e) => toast.error(e.message || "Erro ao enviar lista"),
  });
  const sendCarouselMut = trpc.whatsapp.sendCarousel.useMutation({
    onMutate: () => { onOptimisticSend?.({ content: "🎠 Carousel", messageType: "interactiveMessage" }); },
    onSuccess: () => { chat.refetchMessages(); toast.success("Carousel enviado"); },
    onError: (e) => toast.error(e.message || "Erro ao enviar carousel"),
  });

  /* ── Notes CRUD ── */
  const createNoteMut = trpc.whatsapp.notes.create.useMutation({
    onSuccess: () => {
      chat.refetchNotes();
      toast.success("Nota interna adicionada");
      setIsNoteMode(false);
    },
    onError: (e) => toast.error(e.message || "Erro ao criar nota"),
  });
  const deleteNoteMut = trpc.whatsapp.notes.delete.useMutation({
    onSuccess: () => { chat.refetchNotes(); toast.success("Nota excluída"); },
    onError: (e) => toast.error(e.message || "Erro ao excluir nota"),
  });
  const updateNoteMut = trpc.whatsapp.notes.update.useMutation({
    onSuccess: () => { chat.refetchNotes(); toast.success("Nota atualizada"); setEditingNoteId(null); },
    onError: (e) => toast.error(e.message || "Erro ao atualizar nota"),
  });

  /* ── Pin / Archive / Priority ── */
  const pinMut = trpc.whatsapp.conversationOps.pin.useMutation({
    onSuccess: () => toast.success("Conversa atualizada"),
    onError: (e) => toast.error(e.message),
  });
  const archiveMut = trpc.whatsapp.conversationOps.archive.useMutation({
    onSuccess: () => toast.success("Conversa arquivada"),
    onError: (e) => toast.error(e.message),
  });
  const setPriorityMut = trpc.whatsapp.conversationOps.setPriority.useMutation({
    onSuccess: () => toast.success("Prioridade atualizada"),
    onError: (e) => toast.error(e.message),
  });
  const readChatMut = trpc.whatsapp.readChat.useMutation({
    onSuccess: () => toast.success("Conversa marcada como lida"),
    onError: (e) => toast.error(e.message || "Erro ao marcar como lida"),
  });
  const clearChatMut = trpc.whatsapp.clearChat.useMutation({
    onSuccess: () => toast.success("Conversa limpa"),
    onError: (e) => toast.error(e.message || "Erro ao limpar conversa"),
  });
  const setChatExpirationMut = trpc.whatsapp.setChatExpiration.useMutation({
    onSuccess: () => toast.success("Mensagens temporárias atualizadas"),
    onError: (e) => toast.error(e.message || "Erro ao configurar mensagens temporárias"),
  });
  const addChatNotesMut = trpc.whatsapp.addChatNotes.useMutation({
    onSuccess: () => toast.success("Nota adicionada ao chat"),
    onError: (e) => toast.error(e.message || "Erro ao adicionar nota"),
  });

  /* ── Tags ── */
  const tagsQ = trpc.whatsapp.conversationTags.list.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const convTagsQ = trpc.whatsapp.conversationTags.getForConversation.useQuery(
    { waConversationId: waConversationId || 0 },
    { enabled: !!waConversationId },
  );
  const createTagMut = trpc.whatsapp.conversationTags.create.useMutation({
    onSuccess: () => { tagsQ.refetch(); setNewTagName(""); },
  });
  const addTagMut = trpc.whatsapp.conversationTags.addToConversation.useMutation({
    onSuccess: () => convTagsQ.refetch(),
  });
  const removeTagMut = trpc.whatsapp.conversationTags.removeFromConversation.useMutation({
    onSuccess: () => convTagsQ.refetch(),
  });

  /* ── Scheduled messages ── */
  // Filtra por sessionId + remoteJid — só as agendadas pro contato aberto.
  // Antes listava TODAS do tenant, aparecia no contato errado.
  const scheduledQ = trpc.whatsapp.scheduledMessages.list.useQuery(
    { status: "pending", sessionId, remoteJid } as any,
    { enabled: showScheduleModal },
  );
  const createScheduledMut = trpc.whatsapp.scheduledMessages.create.useMutation({
    onSuccess: () => { scheduledQ.refetch(); toast.success("Mensagem agendada"); setShowScheduleModal(false); },
    onError: (e) => toast.error(e.message),
  });
  const cancelScheduledMut = trpc.whatsapp.scheduledMessages.cancel.useMutation({
    onSuccess: () => { scheduledQ.refetch(); toast.success("Agendamento cancelado"); },
  });

  /* ── AI: Transcribe / Retranscribe / Summarize ── */
  const transcribeMut = trpc.ai.transcribe.useMutation();
  const retranscribeMut = trpc.ai.retranscribeAudio.useMutation();
  const summarizeMut = trpc.ai.summarizeConversation.useMutation();

  const handleTranscribe = useCallback((msgId: number, audioUrl: string) => {
    chat.setTranscriptions(prev => ({ ...prev, [msgId]: { loading: true } }));
    transcribeMut.mutate(
      { audioUrl },
      {
        onSuccess: (data) => {
          chat.setTranscriptions(prev => ({ ...prev, [msgId]: { text: data.text } }));
        },
        onError: (err) => {
          const errorMsg = err.message === "OPENAI_REQUIRED"
            ? "Conecte a API da OpenAI em Integrações > IA"
            : err.message || "Falha";
          chat.setTranscriptions(prev => ({ ...prev, [msgId]: { error: errorMsg } }));
        },
      },
    );
  }, [transcribeMut, chat.setTranscriptions]);

  const handleRetranscribe = useCallback((msgId: number) => {
    chat.setTranscriptions(prev => ({ ...prev, [msgId]: { loading: true } }));
    retranscribeMut.mutate(
      { messageId: msgId },
      {
        onSuccess: () => {
          const pollInterval = setInterval(() => { utils.whatsapp.messagesByContact.invalidate(); }, 5000);
          setTimeout(() => clearInterval(pollInterval), 60000);
        },
        onError: (err) => {
          chat.setTranscriptions(prev => ({ ...prev, [msgId]: { error: err.message || "Falha na transcrição" } }));
        },
      },
    );
  }, [retranscribeMut, utils, chat.setTranscriptions]);

  const handleSummarize = useCallback(() => {
    setSummaryLoading(true);
    setSummaryText("");
    setShowSummary(true);
    summarizeMut.mutate(
      { sessionId, remoteJid },
      {
        onSuccess: (data) => {
          setSummaryText(typeof data.summary === "string" ? data.summary : String(data.summary || ""));
          setSummaryLoading(false);
        },
        onError: (err) => {
          setSummaryText(`Erro: ${err.message}`);
          setSummaryLoading(false);
        },
      },
    );
  }, [summarizeMut, sessionId, remoteJid]);

  /* ── Auto-transcribe new audio messages ── */
  const autoTranscribedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!aiSettingsQ.data?.audioTranscriptionEnabled || !tenantId) return;
    const msgs = chat.rawMessages || [];
    for (const m of msgs) {
      const isAudio = m.messageType === "audioMessage" || m.messageType === "pttMessage" || m.messageType === "audio" || m.mediaMimeType?.startsWith("audio/");
      const hasDbTranscription = m.audioTranscription && m.audioTranscriptionStatus === "completed";
      const isPendingOrProcessing = m.audioTranscriptionStatus === "pending" || m.audioTranscriptionStatus === "processing";
      if (isAudio && !hasDbTranscription && !isPendingOrProcessing && !autoTranscribedRef.current.has(m.id) && !chat.transcriptions[m.id]) {
        autoTranscribedRef.current.add(m.id);
        handleRetranscribe(m.id);
      }
    }
  }, [chat.rawMessages, aiSettingsQ.data?.audioTranscriptionEnabled, handleRetranscribe, chat.transcriptions]);

  /* ══════════════════════════════════════════════════════
     HANDLERS
     ══════════════════════════════════════════════════════ */

  const sendPresenceComposing = useCallback(() => {
    const number = sendNumber;
    if (!number || !sessionId) return;
    sendPresenceMut.mutate({ sessionId, number, presence: "composing" });
  }, [sessionId, sendNumber, sendPresenceMut]);

  const sendPresencePaused = useCallback(() => {
    const number = sendNumber;
    if (!number || !sessionId) return;
    sendPresenceMut.mutate({ sessionId, number, presence: "paused" });
  }, [sessionId, sendNumber, sendPresenceMut]);

  const handleSend = useCallback((text: string) => {
    const number = sendNumber;
    if (!number) return;
    sendMessage.mutate({ sessionId, number, message: text });
  }, [sessionId, sendNumber, sendMessage]);

  const handleSendWithQuote = useCallback((text: string, quotedMessageId: string, quotedText: string) => {
    const number = sendNumber;
    if (!number) return;
    sendTextWithQuote.mutate({ sessionId, number, message: text, quotedMessageId, quotedText });
  }, [sessionId, sendNumber, sendTextWithQuote]);

  const handleCreateNote = useCallback((data: { content: string; category: string; priority: string; isGlobal: boolean; mentions: number[] }) => {
    if (!waConversationId) return;
    createNoteMut.mutate({
      waConversationId,
      sessionId,
      remoteJid,
      content: data.content,
      category: data.category as any,
      priority: data.priority as any,
      isCustomerGlobalNote: data.isGlobal,
      mentionedUserIds: data.mentions.length > 0 ? data.mentions : undefined,
    });
  }, [waConversationId, sessionId, remoteJid, createNoteMut]);

  const addPreviewFiles = useCallback(async (newFiles: File[], forceDoc?: boolean) => {
    const items = await filesToPreviewItems(newFiles, forceDoc);
    setPreviewFiles(prev => {
      const combined = [...prev, ...items].slice(0, MAX_FILES);
      if (prev.length + items.length > MAX_FILES) {
        toast.warning(`Limite de ${MAX_FILES} arquivos por envio`);
      }
      return combined;
    });
    // If preview was empty, reset index to 0
    setActivePreviewIndex(prev => prev === 0 ? 0 : prev);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    await addPreviewFiles(Array.from(files));
    e.target.value = "";
  }, [addPreviewFiles]);

  const handleDocSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    await addPreviewFiles(Array.from(files), true);
    e.target.value = "";
  }, [addPreviewFiles]);

  const handleVoiceSend = useCallback(async (blob: Blob, duration: number) => {
    const number = sendNumber;
    if (!number) return;
    setIsSending(true);
    try {
      const base64 = await blobToBase64(blob);
      const mime = blob.type || "audio/ogg;codecs=opus";
      const dataUri = `data:${mime};base64,${base64}`;
      await sendMedia.mutateAsync({ sessionId, number, mediaUrl: dataUri, mediaType: "audio", ptt: true, mimetype: mime, duration });
      toast.success("Áudio enviado");
    } catch { toast.error("Erro ao enviar áudio"); }
    finally { setIsSending(false); }
  }, [sessionId, sendNumber, sendMedia]);

  const handleAttachSelect = useCallback((type: string) => {
    // "image", "camera", "document" are handled by ChatInput's internal file inputs
    if (type === "location") setShowLocationModal(true);
    else if (type === "contact") setShowContactModal(true);
    else if (type === "poll") setShowPollModal(true);
    else if (type === "interactive") setShowInteractiveComposer(true);
  }, []);

  const handleReact = useCallback((key: { remoteJid: string; fromMe: boolean; id: string }, emoji: string) => {
    sendReaction.mutate({ sessionId, key, reaction: emoji });
  }, [sessionId, sendReaction]);

  const handleDelete = useCallback((rJid: string, messageId: string, fromMe: boolean) => {
    if (confirm("Apagar esta mensagem para todos?")) {
      deleteMessageMut.mutate({ sessionId, remoteJid: rJid, messageId, fromMe });
    }
  }, [sessionId, deleteMessageMut]);

  const handleEditStart = useCallback((messageId: string, currentText: string) => {
    setEditTarget({ messageId, text: currentText });
  }, []);

  const handleEditSave = useCallback((newText: string) => {
    if (!editTarget || !remoteJid) return;
    editMessageMut.mutate({ sessionId, number: remoteJid, messageId: editTarget.messageId, newText });
    setEditTarget(null);
  }, [editTarget, sessionId, remoteJid, editMessageMut]);

  const handleForward = useCallback((msg: Message) => {
    const content = msg.content || msg.mediaUrl || "";
    navigator.clipboard.writeText(content);
    toast.success("Conteúdo copiado. Cole em outra conversa para encaminhar.");
  }, []);

  const handleStartRecording = useCallback(() => {
    if (!sendNumber) return;
    sendPresenceMut.mutate({ sessionId, number: sendNumber, presence: "recording" });
  }, [sessionId, sendNumber, sendPresenceMut]);

  /* ── Drag-and-drop handlers ── */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (!files?.length) return;
    await addPreviewFiles(Array.from(files));
  }, [addPreviewFiles]);

  /* ── Media preview send handler (sequential multi-file) ── */
  const handlePreviewSend = useCallback(async () => {
    if (!previewFiles.length) return;
    const number = sendNumber;
    if (!number) return;
    setIsSending(true);
    setSendProgress(0);
    let sent = 0;
    try {
      for (const item of previewFiles) {
        await sendMedia.mutateAsync({
          sessionId, number,
          mediaUrl: item.dataUri,
          mediaType: item.mediaType,
          fileName: item.file.name,
          mimetype: item.file.type,
          caption: item.caption || undefined,
        });
        sent++;
        setSendProgress(sent);
      }
      toast.success(previewFiles.length === 1 ? "Mídia enviada" : `${sent} arquivos enviados`);
      setPreviewFiles([]);
      setActivePreviewIndex(0);
    } catch {
      toast.error(sent > 0 ? `Erro após ${sent}/${previewFiles.length} arquivos` : "Erro ao enviar arquivo");
    } finally {
      setIsSending(false);
      setSendProgress(0);
    }
  }, [previewFiles, sessionId, contact, sendMedia]);

  /* ── Paste file handler (Ctrl+V / Cmd+V) — supports multiple files ── */
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!remoteJid) return;
      const items = e.clipboardData?.items;
      if (!items?.length) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const f = items[i].getAsFile();
          if (f) pastedFiles.push(f);
        }
      }
      if (!pastedFiles.length) return;

      e.preventDefault();
      addPreviewFiles(pastedFiles);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [remoteJid, addPreviewFiles]);

  /* ── Pending file from drag-drop on conversation list ── */
  const pendingFileProcessed = useRef(false);
  useEffect(() => {
    if (pendingFile && !pendingFileProcessed.current) {
      pendingFileProcessed.current = true;
      addPreviewFiles([pendingFile]);
      onClearPendingFile?.();
    }
    if (!pendingFile) pendingFileProcessed.current = false;
  }, [pendingFile, onClearPendingFile, addPreviewFiles]);

  /* ══════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════ */

  return (
    <div
      className="flex flex-col h-full overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ChatHeader
        contact={contact}
        sessionId={sessionId}
        remoteJid={remoteJid}
        assignment={assignment}
        agents={agents}
        showAgentNames={showAgentNames}
        autoOpenAssign={autoOpenAssign}
        onAssign={onAssign}
        onStatusChange={onStatusChange}
        onToggleAgentNames={setShowAgentNames}
        onAutoOpenAssignConsumed={onAutoOpenAssignConsumed}
        onCreateDeal={onCreateDeal}
        onCreateContact={onCreateContact}
        hasCrmContact={hasCrmContact}
        waConversationId={waConversationId}
        onTransfer={() => setShowTransfer(true)}
        onImport={() => setShowImportDialog(true)}
        onToggleTimeline={() => setShowTimeline(prev => !prev)}
        showTimeline={showTimeline}
        onSummarize={handleSummarize}
        summaryLoading={summaryLoading}
        onSetPriority={(p) => setPriorityMut.mutate({ sessionId, remoteJid, priority: p })}
        onScheduleMessage={() => setShowScheduleModal(true)}
        remotePresence={remotePresence}
        onToggleSidebar={onToggleSidebar}
        sidebarOpen={sidebarOpen}
      />

      <MessageList
        groupedMessages={chat.groupedMessages}
        allMessages={chat.rawMessages}
        isLoading={chat.isLoading}
        hasMoreMessages={chat.hasMoreMessages}
        loadMoreMessages={chat.loadMoreMessages}
        contactName={contact?.name}
        contactAvatarUrl={contact?.avatarUrl}
        myAvatarUrl={myAvatarUrl}
        sessionId={sessionId}
        remoteJid={remoteJid}
        localStatusUpdates={chat.localStatusUpdates}
        reactionsMap={chat.reactionsMap}
        agents={agents}
        agentMap={agentMap}
        showAgentNames={showAgentNames}
        autoTranscribe={!!aiSettingsQ.data?.audioTranscriptionEnabled}
        transcriptions={chat.transcriptions}
        onReply={setReplyTarget}
        onReact={handleReact}
        onDelete={handleDelete}
        onEditStart={handleEditStart}
        onForward={handleForward}
        onImageClick={(url) => setLightboxUrl(url)}
        onTranscribe={handleTranscribe}
        onRetranscribe={handleRetranscribe}
        onEditNote={(noteId, text) => { setEditingNoteId(noteId); setEditingNoteText(text); }}
        onDeleteNote={(noteId) => deleteNoteMut.mutate({ noteId })}
        onSaveEditedNote={(noteId, text) => updateNoteMut.mutate({ noteId, content: text })}
        editingNoteId={editingNoteId}
        editingNoteText={editingNoteText}
        onSetEditingNoteText={setEditingNoteText}
        onCancelEditNote={() => setEditingNoteId(null)}
        updateNotePending={updateNoteMut.isPending}
        globalNotes={chat.globalNotesData}
        showSummary={showSummary}
        summaryText={summaryText}
        summaryLoading={summaryLoading}
        onSummarize={handleSummarize}
        onCloseSummary={() => setShowSummary(false)}
        showTimeline={showTimeline}
        timelineEvents={eventsQ.data as any[] || null}
        lastMessage={lastMessage}
      />

      <ChatInput
        sessionId={sessionId}
        remoteJid={remoteJid}
        contact={contact}
        tenantId={tenantId}
        replyTarget={replyTarget}
        onClearReply={() => setReplyTarget(null)}
        onSend={handleSend}
        onSendWithQuote={handleSendWithQuote}
        isSending={isSending}
        sendPending={sendMessage.isPending || sendTextWithQuote.isPending}
        isNoteMode={isNoteMode}
        onToggleNoteMode={() => setIsNoteMode(prev => !prev)}
        onCreateNote={handleCreateNote}
        createNotePending={createNoteMut.isPending}
        agents={agents}
        waConversationId={waConversationId}
        onVoiceSend={handleVoiceSend}
        onStartRecording={handleStartRecording}
        onFileSelect={handleFileSelect}
        onDocSelect={handleDocSelect}
        onAttachSelect={handleAttachSelect}
        onTyping={sendPresenceComposing}
        onPaused={sendPresencePaused}
        dealId={dealId}
        dealTitle={dealTitle}
        dealValueCents={dealValueCents}
        dealStageName={dealStageName}
        companyName={companyName}
        onRefetchMessages={chat.refetchMessages}
      />

      {/* Note: Hidden file inputs are inside ChatInput — no duplicates needed here */}

      {/* ─── Modals ─── */}
      {showLocationModal && (
        <LocationModal
          onSend={(lat, lng, name, address) => {
            const number = sendNumber;
            if (!number) return;
            sendLocationMut.mutate({ sessionId, number, latitude: lat, longitude: lng, name, address });
          }}
          onClose={() => setShowLocationModal(false)}
        />
      )}
      {showContactModal && (
        <ContactModal
          onSend={(contacts) => {
            const number = sendNumber;
            if (!number) return;
            sendContactMut.mutate({ sessionId, number, contacts });
          }}
          onClose={() => setShowContactModal(false)}
        />
      )}
      {showPollModal && (
        <PollModal
          onSend={(name, values, selectableCount) => {
            const number = sendNumber;
            if (!number) return;
            sendPollMut.mutate({ sessionId, number, name, values, selectableCount });
          }}
          onClose={() => setShowPollModal(false)}
        />
      )}
      {showInteractiveComposer && (
        <InteractiveMessageComposer
          onSendButtons={(data) => {
            const number = sendNumber;
            if (!number) return;
            sendButtonListMut.mutate({ sessionId, number, ...data });
          }}
          onSendList={(data) => {
            const number = sendNumber;
            if (!number) return;
            sendOptionListMut.mutate({ sessionId, number, ...data });
          }}
          onSendCarousel={(data) => {
            const number = sendNumber;
            if (!number) return;
            sendCarouselMut.mutate({ sessionId, number, ...data });
          }}
          onClose={() => setShowInteractiveComposer(false)}
        />
      )}
      {editTarget && (
        <EditMessageModal
          currentText={editTarget.text}
          onSave={handleEditSave}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* ─── Sending overlay ─── */}
      {isSending && (
        <div className="absolute inset-0 bg-background/20 backdrop-blur-sm flex items-center justify-center z-30">
          <div className="bg-card rounded-xl px-6 py-4 shadow-xl flex items-center gap-3 border border-border">
            <Loader2 className="w-5 h-5 animate-spin text-wa-tint" />
            <span className="text-sm text-foreground">Enviando...</span>
          </div>
        </div>
      )}

      {/* ─── Transfer Dialog ─── */}
      {showTransfer && waConversationId && (
        <TransferDialog
          open={showTransfer}
          onClose={() => setShowTransfer(false)}
          waConversationId={waConversationId}
          sessionId={sessionId}
          remoteJid={remoteJid}
          currentAgentId={assignment?.assignedUserId}
          contactName={contact?.name || remoteJid.split("@")[0]}
        />
      )}

      {/* ─── Import Conversation Dialog ─── */}
      <ImportConversationDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        sessionId={sessionId}
        remoteJid={remoteJid}
        dealId={dealId ?? null}
        waConversationId={waConversationId ?? null}
        contactName={contact?.name || remoteJid.split("@")[0]}
        contactId={contact?.id}
      />

      {/* ─── Tags Panel (slide-in from right) ─── */}
      {showTagsPanel && waConversationId && (
        <div className="absolute top-0 right-0 w-72 h-full bg-card border-l border-border z-40 flex flex-col shadow-xl animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Tags da Conversa</h3>
            <button onClick={() => setShowTagsPanel(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
          </div>
          {/* Current tags */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[11px] text-muted-foreground mb-2">Tags atuais:</p>
            <div className="flex flex-wrap gap-1">
              {(convTagsQ.data as any[] || []).map((tag: any) => (
                <span key={tag.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-white" style={{ backgroundColor: tag.color }}>
                  {tag.name}
                  <button onClick={() => removeTagMut.mutate({ waConversationId, tagId: tag.id })} className="hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {(!convTagsQ.data || (convTagsQ.data as any[]).length === 0) && (
                <span className="text-[11px] text-muted-foreground">Nenhuma tag</span>
              )}
            </div>
          </div>
          {/* Available tags */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <p className="text-[11px] text-muted-foreground mb-2">Adicionar tag:</p>
            <div className="space-y-1">
              {(tagsQ.data as any[] || []).map((tag: any) => {
                const isLinked = (convTagsQ.data as any[] || []).some((ct: any) => ct.id === tag.id);
                return (
                  <button
                    key={tag.id}
                    disabled={isLinked}
                    onClick={() => addTagMut.mutate({ waConversationId, tagId: tag.id })}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[12px] transition-colors ${
                      isLinked ? "opacity-40 cursor-not-allowed" : "hover:bg-muted"
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                    {isLinked && <Check className="w-3 h-3 ml-auto text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Create new tag */}
          <div className="px-4 py-3 border-t border-border">
            <div className="flex items-center gap-2">
              <input
                type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0"
              />
              <input
                value={newTagName} onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Nova tag..."
                className="flex-1 text-[12px] bg-muted/50 rounded px-2 py-1 outline-none focus:ring-1 ring-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTagName.trim()) {
                    createTagMut.mutate({ name: newTagName.trim(), color: newTagColor });
                  }
                }}
              />
              <button
                disabled={!newTagName.trim()}
                onClick={() => newTagName.trim() && createTagMut.mutate({ name: newTagName.trim(), color: newTagColor })}
                className="text-[11px] text-primary font-medium hover:underline disabled:opacity-40"
              >
                Criar
              </button>
            </div>
          </div>
          {/* WhatsApp Business Labels (Z-API native) */}
          <WhatsAppLabelsSection sessionId={sessionId} remoteJid={remoteJid} />
        </div>
      )}

      {/* ─── Schedule Message Modal ─── */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowScheduleModal(false)}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-[420px] max-w-[95vw] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-[15px] font-semibold flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-primary" />
                Agendar Mensagem
              </h3>
              <button onClick={() => setShowScheduleModal(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-[12px] font-medium text-muted-foreground">Mensagem</label>
                <textarea
                  value={scheduleMessageText}
                  onChange={(e) => setScheduleMessageText(e.target.value)}
                  placeholder="Escreva a mensagem..."
                  rows={3}
                  className="w-full mt-1 rounded-lg bg-muted/50 border border-border px-3 py-2 text-[13px] outline-none focus:ring-1 ring-primary resize-none"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[12px] font-medium text-muted-foreground">Data</label>
                  <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full mt-1 rounded-lg bg-muted/50 border border-border px-3 py-2 text-[13px] outline-none focus:ring-1 ring-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-[12px] font-medium text-muted-foreground">Hora</label>
                  <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full mt-1 rounded-lg bg-muted/50 border border-border px-3 py-2 text-[13px] outline-none focus:ring-1 ring-primary" />
                </div>
              </div>
              {/* Pending scheduled messages for this conversation */}
              {scheduledQ.data && (scheduledQ.data as any[]).filter((s: any) => s.remoteJid === remoteJid).length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1">Agendadas para este contato:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {(scheduledQ.data as any[]).filter((s: any) => s.remoteJid === remoteJid).map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between bg-muted/50 rounded px-2 py-1.5 text-[11px]">
                        <div className="min-w-0 flex-1">
                          <span className="text-muted-foreground">{new Date(s.scheduledAt).toLocaleString("pt-BR")}</span>
                          <p className="truncate text-foreground">{s.content}</p>
                        </div>
                        <button
                          onClick={() => cancelScheduledMut.mutate({ id: s.id })}
                          className="text-red-500 hover:text-red-600 shrink-0 ml-2"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
              <button onClick={() => setShowScheduleModal(false)} className="px-4 py-2 text-[13px] text-muted-foreground hover:bg-muted rounded-lg">
                Cancelar
              </button>
              <button
                disabled={!scheduleMessageText.trim() || !scheduleDate || !scheduleTime || createScheduledMut.isPending}
                onClick={() => {
                  const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
                  if (scheduledAt <= new Date()) { toast.error("Data deve ser no futuro"); return; }
                  createScheduledMut.mutate({
                    sessionId,
                    remoteJid,
                    content: scheduleMessageText.trim(),
                    scheduledAt: scheduledAt.toISOString(),
                  });
                }}
                className="px-4 py-2 text-[13px] bg-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-40"
              >
                {createScheduledMut.isPending ? "Agendando..." : "Agendar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Image Lightbox ─── */}
      {lightboxUrl && (
        <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

      {/* ─── Drag-and-drop overlay ─── */}
      {isDragOver && (
        <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm flex items-center justify-center z-40 border-2 border-dashed border-primary rounded-lg pointer-events-none">
          <div className="bg-card rounded-xl px-8 py-5 shadow-xl flex flex-col items-center gap-2 border border-primary/30">
            <Paperclip className="w-8 h-8 text-primary" />
            <span className="text-sm font-medium text-foreground">Solte o arquivo aqui</span>
          </div>
        </div>
      )}

      {/* ─── Multi-file media preview carousel ─── */}
      {previewFiles.length > 0 && (() => {
        const active = previewFiles[activePreviewIndex] || previewFiles[0];
        const total = previewFiles.length;
        return (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            onClick={() => { if (!isSending) { setPreviewFiles([]); setActivePreviewIndex(0); } }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !isSending) { setPreviewFiles([]); setActivePreviewIndex(0); }
              if (e.key === "ArrowLeft") setActivePreviewIndex(i => Math.max(0, i - 1));
              if (e.key === "ArrowRight") setActivePreviewIndex(i => Math.min(total - 1, i + 1));
              if (e.key === "Delete" || e.key === "Backspace") {
                if (isSending) return;
                // Only remove if focus is not on the caption input
                if ((e.target as HTMLElement)?.tagName === "INPUT") return;
                setPreviewFiles(prev => {
                  const next = prev.filter((_, idx) => idx !== activePreviewIndex);
                  setActivePreviewIndex(i => Math.min(i, Math.max(0, next.length - 1)));
                  return next;
                });
              }
            }}
            tabIndex={-1}
          >
            <div className="bg-card border border-border rounded-xl shadow-2xl w-[520px] max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h3 className="text-[14px] font-semibold truncate">
                  {total > 1 ? `${total} arquivos` : active?.file.name}
                </h3>
                <div className="flex items-center gap-1">
                  {!isSending && (
                    <button
                      onClick={() => addFileInputRef.current?.click()}
                      className="p-1.5 hover:bg-muted rounded text-muted-foreground"
                      title="Adicionar mais arquivos"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => { if (!isSending) { setPreviewFiles([]); setActivePreviewIndex(0); } }}
                    className="p-1.5 hover:bg-muted rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Main preview area */}
              {active && (
                <div className="flex-1 flex items-center justify-center p-4 bg-muted/30 min-h-[200px] max-h-[50vh] overflow-auto relative">
                  {active.mediaType === "image" ? (
                    <img src={active.dataUri} alt="Preview" className="max-w-full max-h-[45vh] rounded-lg object-contain" />
                  ) : active.mediaType === "video" ? (
                    <video src={active.dataUri} controls className="max-w-full max-h-[45vh] rounded-lg" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
                      <Paperclip className="w-12 h-12" />
                      <span className="text-sm font-medium">{active.file.name}</span>
                      <span className="text-xs">{active.file.size >= 1048576 ? `${(active.file.size / 1048576).toFixed(1)} MB` : `${(active.file.size / 1024).toFixed(1)} KB`}</span>
                    </div>
                  )}
                  {/* Sent checkmark overlay */}
                  {isSending && sendProgress > activePreviewIndex && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
                      <Check className="w-10 h-10 text-green-400" />
                    </div>
                  )}
                </div>
              )}

              {/* Thumbnail strip (only when multiple files) */}
              {total > 1 && (
                <div className="px-4 py-2 border-t border-border flex items-center gap-2 overflow-x-auto">
                  {previewFiles.map((item, idx) => (
                    <div
                      key={idx}
                      className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                        idx === activePreviewIndex ? "border-primary ring-1 ring-primary/30" : "border-transparent hover:border-muted-foreground/30"
                      }`}
                      onClick={() => setActivePreviewIndex(idx)}
                    >
                      {item.mediaType === "image" ? (
                        <img src={item.dataUri} alt="" className="w-full h-full object-cover" />
                      ) : item.mediaType === "video" ? (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground font-medium">VID</span>
                        </div>
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Paperclip className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      {/* Remove button */}
                      {!isSending && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewFiles(prev => {
                              const next = prev.filter((_, i) => i !== idx);
                              setActivePreviewIndex(i => Math.min(i, Math.max(0, next.length - 1)));
                              return next;
                            });
                          }}
                          className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-white rounded-full flex items-center justify-center text-[10px] leading-none shadow"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {/* Sent checkmark on thumbnail */}
                      {isSending && sendProgress > idx && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Check className="w-4 h-4 text-green-400" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Caption + send */}
              <div className="px-4 py-3 border-t border-border space-y-3">
                {active && (
                  <input
                    type="text"
                    value={active.caption}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPreviewFiles(prev => prev.map((item, idx) => idx === activePreviewIndex ? { ...item, caption: val } : item));
                    }}
                    placeholder={total > 1 ? `Legenda para ${active.file.name}...` : "Adicionar legenda..."}
                    className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-[13px] outline-none focus:ring-1 ring-primary"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handlePreviewSend(); }}
                    disabled={isSending}
                    autoFocus
                  />
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { if (!isSending) { setPreviewFiles([]); setActivePreviewIndex(0); } }}
                    className="px-4 py-2 text-[13px] text-muted-foreground hover:bg-muted rounded-lg"
                    disabled={isSending}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePreviewSend}
                    disabled={isSending}
                    className="px-4 py-2 text-[13px] bg-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {total > 1 ? `Enviando ${sendProgress}/${total}...` : "Enviando..."}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        {total > 1 ? `Enviar ${total}` : "Enviar"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Hidden file input for adding more files */}
            <input
              ref={addFileInputRef}
              type="file"
              accept="image/*,video/*,application/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar"
              multiple
              className="hidden"
              onChange={async (e) => {
                if (e.target.files?.length) await addPreviewFiles(Array.from(e.target.files));
                e.target.value = "";
              }}
            />
          </div>
        );
      })()}
    </div>
  );
}
