/**
 * WhatsAppChat — Orchestrator (Phase 5 rewrite)
 * Composes: ChatHeader, MessageList, ChatInput + inline modals/panels
 * ~450 lines replacing the original 3407-line monolith.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { useTenantId } from "@/hooks/useTenantId";
import { useChatMessages } from "@/hooks/useChatMessages";
import { toast } from "sonner";
import {
  Loader2, X, Check, CalendarClock,
} from "lucide-react";
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
  autoOpenAssign?: boolean;
  onAutoOpenAssignConsumed?: () => void;
}

/* ─── Utilities ─── */
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

/* ═══════════════════════════════════════════════════════
   MAIN CHAT COMPONENT
   ═══════════════════════════════════════════════════════ */

export default function WhatsAppChat({
  contact, sessionId, remoteJid,
  onCreateDeal, onCreateContact, hasCrmContact,
  assignment, agents, onAssign, onStatusChange,
  myAvatarUrl, waConversationId,
  dealId, dealTitle, dealValueCents, dealStageName, companyName,
  onOptimisticSend, autoOpenAssign, onAutoOpenAssignConsumed,
}: WhatsAppChatProps) {
  const tenantId = useTenantId();
  const { lastMessage, isConnected: socketConnected } = useSocket();
  const utils = trpc.useUtils();

  /* ── Chat messages hook (queries, socket, reactions, status, transcriptions, notes) ── */
  const chat = useChatMessages({ sessionId, remoteJid, waConversationId, socketConnected });

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
    };
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
    if (!socketConnected) setTimeout(() => chat.refetchMessages(), 400);
  }, [chat.refetchMessages, socketConnected]);

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
    onError: () => toast.error("Erro ao enviar mídia"),
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
  const scheduledQ = trpc.whatsapp.scheduledMessages.list.useQuery(
    { status: "pending" },
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
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number || !sessionId) return;
    sendPresenceMut.mutate({ sessionId, number, presence: "composing" });
  }, [sessionId, contact]);

  const sendPresencePaused = useCallback(() => {
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number || !sessionId) return;
    sendPresenceMut.mutate({ sessionId, number, presence: "paused" });
  }, [sessionId, contact]);

  const handleSend = useCallback((text: string) => {
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;
    sendMessage.mutate({ sessionId, number, message: text });
  }, [sessionId, contact, sendMessage]);

  const handleSendWithQuote = useCallback((text: string, quotedMessageId: string, quotedText: string) => {
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;
    sendTextWithQuote.mutate({ sessionId, number, message: text, quotedMessageId, quotedText });
  }, [sessionId, contact, sendTextWithQuote]);

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

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;
    for (const file of Array.from(files)) {
      setIsSending(true);
      try {
        const base64 = await fileToBase64(file);
        const { url } = await uploadMedia.mutateAsync({ fileName: file.name, fileBase64: base64, contentType: file.type });
        let mediaType: "image" | "video" | "document" = "document";
        if (file.type.startsWith("image/")) mediaType = "image";
        else if (file.type.startsWith("video/")) mediaType = "video";
        await sendMedia.mutateAsync({ sessionId, number, mediaUrl: url, mediaType, fileName: file.name, mimetype: file.type });
        toast.success("Mídia enviada");
      } catch { toast.error("Erro ao enviar arquivo"); }
      finally { setIsSending(false); }
    }
    e.target.value = "";
  }, [sessionId, contact]);

  const handleDocSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;
    for (const file of Array.from(files)) {
      setIsSending(true);
      try {
        const base64 = await fileToBase64(file);
        const { url } = await uploadMedia.mutateAsync({ fileName: file.name, fileBase64: base64, contentType: file.type });
        await sendMedia.mutateAsync({ sessionId, number, mediaUrl: url, mediaType: "document", fileName: file.name, mimetype: file.type });
        toast.success("Documento enviado");
      } catch { toast.error("Erro ao enviar documento"); }
      finally { setIsSending(false); }
    }
    e.target.value = "";
  }, [sessionId, contact]);

  const handleVoiceSend = useCallback(async (blob: Blob, duration: number) => {
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;
    setIsSending(true);
    try {
      const base64 = await blobToBase64(blob);
      const { url } = await uploadMedia.mutateAsync({ fileName: `voice-${Date.now()}.webm`, fileBase64: base64, contentType: "audio/webm;codecs=opus" });
      await sendMedia.mutateAsync({ sessionId, number, mediaUrl: url, mediaType: "audio", ptt: true, mimetype: "audio/ogg; codecs=opus", duration });
      toast.success("Áudio enviado");
    } catch { toast.error("Erro ao enviar áudio"); }
    finally { setIsSending(false); }
  }, [sessionId, contact]);

  const handleAttachSelect = useCallback((type: string) => {
    // "image", "camera", "document" are handled by ChatInput's internal file inputs
    if (type === "location") setShowLocationModal(true);
    else if (type === "contact") setShowContactModal(true);
    else if (type === "poll") setShowPollModal(true);
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
    if (!editTarget) return;
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;
    editMessageMut.mutate({ sessionId, number, messageId: editTarget.messageId, newText });
    setEditTarget(null);
  }, [editTarget, sessionId, contact, editMessageMut]);

  const handleForward = useCallback((msg: Message) => {
    const content = msg.content || msg.mediaUrl || "";
    navigator.clipboard.writeText(content);
    toast.success("Conteúdo copiado. Cole em outra conversa para encaminhar.");
  }, []);

  const handleStartRecording = useCallback(() => {
    sendPresenceMut.mutate({ sessionId, number: contact?.phone?.replace(/\D/g, "") || "", presence: "recording" });
  }, [sessionId, contact, sendPresenceMut]);

  /* ══════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════ */

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
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
        onPin={() => pinMut.mutate({ sessionId, remoteJid, pin: true })}
        onArchive={() => archiveMut.mutate({ sessionId, remoteJid, archive: true })}
        onSetPriority={(p) => setPriorityMut.mutate({ sessionId, remoteJid, priority: p })}
        onToggleTagsPanel={() => setShowTagsPanel(prev => !prev)}
        onScheduleMessage={() => setShowScheduleModal(true)}
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
            const number = contact?.phone?.replace(/\D/g, "") || "";
            if (!number) return;
            sendLocationMut.mutate({ sessionId, number, latitude: lat, longitude: lng, name, address });
          }}
          onClose={() => setShowLocationModal(false)}
        />
      )}
      {showContactModal && (
        <ContactModal
          onSend={(contacts) => {
            const number = contact?.phone?.replace(/\D/g, "") || "";
            if (!number) return;
            sendContactMut.mutate({ sessionId, number, contacts });
          }}
          onClose={() => setShowContactModal(false)}
        />
      )}
      {showPollModal && (
        <PollModal
          onSend={(name, values, selectableCount) => {
            const number = contact?.phone?.replace(/\D/g, "") || "";
            if (!number) return;
            sendPollMut.mutate({ sessionId, number, name, values, selectableCount });
          }}
          onClose={() => setShowPollModal(false)}
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
    </div>
  );
}
