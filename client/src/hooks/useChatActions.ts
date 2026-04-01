/**
 * useChatActions — Extracted tRPC mutations and action callbacks from WhatsAppChat.tsx.
 *
 * Wraps all send/action mutations:
 *   sendMessage, sendTextWithQuote, uploadMedia, sendMedia,
 *   sendReaction, deleteMessage, editMessage, sendLocation,
 *   sendContact, sendPoll, sendPresence, notes CRUD, transfer,
 *   transcribe, retranscribe, summarize, pin, archive, setPriority,
 *   tags, scheduledMessages.
 *
 * Exposes handler callbacks:
 *   handleSend, handleFileSelect, handleDocSelect, handleVoiceSend,
 *   handleReact, handleDelete, handleEditStart, handleEditSave,
 *   handleForward, handleLocationSend, handleContactSend,
 *   handlePollSend, handleTranscribe, handleRetranscribe, handleSummarize.
 */

import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Helpers ─────────────────────────────────────────────

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

// ── Types ───────────────────────────────────────────────

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

export interface ReplyTarget {
  messageId: string;
  content: string;
  fromMe: boolean;
}

export interface UseChatActionsOptions {
  sessionId: string;
  remoteJid: string;
  contactPhone: string;
  waConversationId?: number;
  msgLimit: number;
  socketConnected: boolean;
  onOptimisticSend?: (msg: { content: string; messageType?: string }) => void;
  onNotesChanged?: () => void;
  onMessagesChanged?: () => void;
}

export interface UseChatActionsResult {
  // Send
  handleSend: () => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDocSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleVoiceSend: (blob: Blob, duration: number) => Promise<void>;
  // Message text state
  messageText: string;
  setMessageText: (text: string) => void;
  // Reply
  replyTarget: ReplyTarget | null;
  setReplyTarget: (target: ReplyTarget | null) => void;
  // Edit
  editTarget: { messageId: string; text: string } | null;
  handleEditStart: (messageId: string, text: string) => void;
  handleEditSave: (newText: string) => void;
  // Actions
  handleReact: (key: { remoteJid: string; fromMe: boolean; id: string }, emoji: string) => void;
  handleDelete: (remoteJid: string, messageId: string, fromMe: boolean) => void;
  handleForward: (msg: any) => void;
  handleLocationSend: (lat: number, lng: number, name: string, address: string) => void;
  handleContactSend: (contacts: Array<{ fullName: string; phoneNumber: string }>) => void;
  handlePollSend: (name: string, values: string[], selectableCount: number) => void;
  // AI
  handleTranscribe: (msgId: number, audioUrl: string) => void;
  handleRetranscribe: (msgId: number) => void;
  handleSummarize: () => void;
  summaryText: string;
  summaryLoading: boolean;
  // Notes
  isNoteMode: boolean;
  setIsNoteMode: (v: boolean) => void;
  noteCategory: string;
  setNoteCategory: (v: string) => void;
  // Presence
  sendPresenceComposing: () => void;
  sendPresencePaused: () => void;
  // State flags
  isSending: boolean;
  // Pin/Archive/Priority
  pinConversation: (pinned: boolean) => void;
  archiveConversation: () => void;
  setPriority: (priority: string) => void;
  // Transfer
  executeTransfer: (targetAgentId: number, note?: string) => void;
}

// ── Hook ────────────────────────────────────────────────

export function useChatActions(opts: UseChatActionsOptions): UseChatActionsResult {
  const { sessionId, remoteJid, contactPhone, waConversationId, msgLimit, socketConnected, onOptimisticSend, onNotesChanged, onMessagesChanged } = opts;

  const utils = trpc.useUtils();

  // ── Local state ───────────────────────────────────────
  const [messageText, setMessageText] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [editTarget, setEditTarget] = useState<{ messageId: string; text: string } | null>(null);
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [noteCategory, setNoteCategory] = useState("other");
  const [isSending, setIsSending] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Record<number, { text?: string; loading?: boolean; error?: string }>>({});

  // ── Optimistic message helpers ────────────────────────
  const optimisticIdCounter = useRef(0);
  const queryKey = { sessionId, remoteJid, limit: msgLimit };

  const addOptimisticMessage = useCallback((text: string, quotedId?: string | null): string => {
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
  }, [sessionId, remoteJid, utils, msgLimit]);

  const delayedRefetch = useCallback(() => {
    if (!socketConnected) setTimeout(() => onMessagesChanged?.(), 400);
  }, [socketConnected, onMessagesChanged]);

  // ── Mutations ─────────────────────────────────────────

  // Track clientMsgIds for optimistic reconciliation
  const lastClientMsgIdRef = useRef<string | null>(null);
  const lastQuoteClientMsgIdRef = useRef<string | null>(null);

  const sendMessage = trpc.whatsapp.sendMessage.useMutation({
    onMutate: (vars) => {
      const clientMsgId = addOptimisticMessage(vars.message);
      lastClientMsgIdRef.current = clientMsgId;
      onOptimisticSend?.({ content: vars.message, messageType: "conversation" });
    },
    onSuccess: (result) => {
      const clientMsgId = lastClientMsgIdRef.current;
      if (result.messageId && clientMsgId) {
        utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
          if (!old) return old;
          return old.map((m: any) => m.messageId === clientMsgId ? { ...m, messageId: result.messageId, status: "sent" } : m);
        });
      }
      delayedRefetch();
    },
    onError: () => {
      const clientMsgId = lastClientMsgIdRef.current;
      utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
        if (!old) return old;
        return clientMsgId ? old.filter((m: any) => m.messageId !== clientMsgId) : old.filter((m: any) => !m.messageId?.startsWith("opt_"));
      });
      toast.error("Erro ao enviar mensagem");
    },
  });

  const sendTextWithQuote = trpc.whatsapp.sendTextWithQuote.useMutation({
    onMutate: (vars) => {
      const clientMsgId = addOptimisticMessage(vars.message, vars.quotedMessageId);
      lastQuoteClientMsgIdRef.current = clientMsgId;
      onOptimisticSend?.({ content: vars.message, messageType: "conversation" });
    },
    onSuccess: (result) => {
      const clientMsgId = lastQuoteClientMsgIdRef.current;
      if (result.messageId && clientMsgId) {
        utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
          if (!old) return old;
          return old.map((m: any) => m.messageId === clientMsgId ? { ...m, messageId: result.messageId, status: "sent" } : m);
        });
      }
      delayedRefetch();
      setReplyTarget(null);
    },
    onError: () => {
      const clientMsgId = lastQuoteClientMsgIdRef.current;
      utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
        if (!old) return old;
        return clientMsgId ? old.filter((m: any) => m.messageId !== clientMsgId) : old.filter((m: any) => !m.messageId?.startsWith("opt_"));
      });
      toast.error("Erro ao enviar resposta");
    },
  });

  const uploadMedia = trpc.whatsapp.uploadMedia.useMutation();
  const sendMedia = trpc.whatsapp.sendMedia.useMutation({
    onMutate: (vars) => {
      const mediaLabel = vars.mediaType === "image" ? "Imagem" : vars.mediaType === "video" ? "Video" : vars.mediaType === "audio" ? "Audio" : "Documento";
      onOptimisticSend?.({ content: mediaLabel, messageType: vars.mediaType || "document" });
    },
    onSuccess: () => delayedRefetch(),
    onError: () => toast.error("Erro ao enviar midia"),
  });

  const sendReaction = trpc.whatsapp.sendReaction.useMutation({
    onSuccess: () => toast.success("Reacao enviada"),
    onError: () => toast.error("Erro ao enviar reacao"),
  });

  const deleteMessageMut = trpc.whatsapp.deleteMessage.useMutation({
    onSuccess: () => { onMessagesChanged?.(); toast.success("Mensagem apagada"); },
    onError: () => toast.error("Erro ao apagar mensagem"),
  });

  const editMessageMut = trpc.whatsapp.editMessage.useMutation({
    onSuccess: () => { onMessagesChanged?.(); toast.success("Mensagem editada"); },
    onError: () => toast.error("Erro ao editar mensagem"),
  });

  const sendPresenceMut = trpc.whatsapp.sendPresence.useMutation();

  const sendLocationMut = trpc.whatsapp.sendLocation.useMutation({
    onMutate: () => { onOptimisticSend?.({ content: "Localizacao", messageType: "locationMessage" }); },
    onSuccess: () => { onMessagesChanged?.(); toast.success("Localizacao enviada"); },
    onError: () => toast.error("Erro ao enviar localizacao"),
  });

  const sendContactMut = trpc.whatsapp.sendContact.useMutation({
    onMutate: () => { onOptimisticSend?.({ content: "Contato", messageType: "contactMessage" }); },
    onSuccess: () => { onMessagesChanged?.(); toast.success("Contato enviado"); },
    onError: () => toast.error("Erro ao enviar contato"),
  });

  const sendPollMut = trpc.whatsapp.sendPoll.useMutation({
    onMutate: () => { onOptimisticSend?.({ content: "Enquete", messageType: "pollCreationMessage" }); },
    onSuccess: () => { onMessagesChanged?.(); toast.success("Enquete enviada"); },
    onError: () => toast.error("Erro ao enviar enquete"),
  });

  // Notes
  const createNoteMut = trpc.whatsapp.notes.create.useMutation({
    onSuccess: () => { onNotesChanged?.(); toast.success("Nota interna adicionada"); setMessageText(""); setIsNoteMode(false); setNoteCategory("other"); },
    onError: (e) => toast.error(e.message || "Erro ao criar nota"),
  });
  const deleteNoteMut = trpc.whatsapp.notes.delete.useMutation({
    onSuccess: () => { onNotesChanged?.(); toast.success("Nota excluida"); },
    onError: (e) => toast.error(e.message || "Erro ao excluir nota"),
  });
  const updateNoteMut = trpc.whatsapp.notes.update.useMutation({
    onSuccess: () => { onNotesChanged?.(); toast.success("Nota atualizada"); },
    onError: (e) => toast.error(e.message || "Erro ao atualizar nota"),
  });

  // Transfer
  const transferMut = trpc.whatsapp.transfer.execute.useMutation({
    onSuccess: () => toast.success("Conversa transferida com sucesso"),
    onError: (e) => toast.error(e.message || "Erro ao transferir"),
  });

  // AI
  const transcribeMut = trpc.ai.transcribe.useMutation();
  const retranscribeMut = trpc.ai.retranscribeAudio.useMutation();
  const summarizeMut = trpc.ai.summarizeConversation.useMutation();

  // Pin / Archive / Priority
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

  // ── Callbacks ─────────────────────────────────────────

  const handleSend = useCallback(() => {
    if (!messageText.trim() || isSending) return;

    if (isNoteMode && waConversationId) {
      createNoteMut.mutate({
        waConversationId,
        sessionId,
        remoteJid,
        content: messageText.trim(),
        category: noteCategory as any,
      });
      setMessageText("");
      return;
    }

    if (!contactPhone) return;

    if (replyTarget) {
      sendTextWithQuote.mutate({
        sessionId,
        number: contactPhone,
        message: messageText.trim(),
        quotedMessageId: replyTarget.messageId,
        quotedText: replyTarget.content,
      });
    } else {
      sendMessage.mutate({ sessionId, number: contactPhone, message: messageText.trim() });
    }
    setMessageText("");
    setReplyTarget(null);
    sendPresenceMut.mutate({ sessionId, number: contactPhone, presence: "paused" });
  }, [messageText, sessionId, contactPhone, isSending, replyTarget, isNoteMode, waConversationId, remoteJid, noteCategory]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !contactPhone) return;
    for (const file of Array.from(files)) {
      setIsSending(true);
      try {
        const base64 = await fileToBase64(file);
        const { url } = await uploadMedia.mutateAsync({ fileName: file.name, fileBase64: base64, contentType: file.type });
        let mediaType: "image" | "video" | "document" = "document";
        if (file.type.startsWith("image/")) mediaType = "image";
        else if (file.type.startsWith("video/")) mediaType = "video";
        await sendMedia.mutateAsync({ sessionId, number: contactPhone, mediaUrl: url, mediaType, fileName: file.name, mimetype: file.type });
        toast.success("Midia enviada");
      } catch { toast.error("Erro ao enviar arquivo"); }
      finally { setIsSending(false); }
    }
    e.target.value = "";
  }, [sessionId, contactPhone]);

  const handleDocSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !contactPhone) return;
    for (const file of Array.from(files)) {
      setIsSending(true);
      try {
        const base64 = await fileToBase64(file);
        const { url } = await uploadMedia.mutateAsync({ fileName: file.name, fileBase64: base64, contentType: file.type });
        await sendMedia.mutateAsync({ sessionId, number: contactPhone, mediaUrl: url, mediaType: "document", fileName: file.name, mimetype: file.type });
        toast.success("Documento enviado");
      } catch { toast.error("Erro ao enviar documento"); }
      finally { setIsSending(false); }
    }
    e.target.value = "";
  }, [sessionId, contactPhone]);

  const handleVoiceSend = useCallback(async (blob: Blob, duration: number) => {
    if (!contactPhone) return;
    setIsSending(true);
    try {
      const base64 = await blobToBase64(blob);
      const { url } = await uploadMedia.mutateAsync({ fileName: `voice-${Date.now()}.webm`, fileBase64: base64, contentType: "audio/webm;codecs=opus" });
      await sendMedia.mutateAsync({ sessionId, number: contactPhone, mediaUrl: url, mediaType: "audio", ptt: true, mimetype: "audio/ogg; codecs=opus", duration });
      toast.success("Audio enviado");
    } catch { toast.error("Erro ao enviar audio"); }
    finally { setIsSending(false); }
  }, [sessionId, contactPhone]);

  const handleReact = useCallback((key: { remoteJid: string; fromMe: boolean; id: string }, emoji: string) => {
    const reactQK = { sessionId, remoteJid: key.remoteJid, limit: msgLimit };
    utils.whatsapp.messagesByContact.setData(reactQK, (old: any) => {
      if (!old) return old;
      return old.map((m: any) => {
        if (m.messageId === key.id) {
          const existing = m.reactions || [];
          const filtered = existing.filter((r: any) => r.senderJid !== "me");
          return { ...m, reactions: [...filtered, { senderJid: "me", emoji, timestamp: Date.now() }] };
        }
        return m;
      });
    });
    sendReaction.mutate({ sessionId, key, reaction: emoji });
  }, [sessionId, msgLimit]);

  const handleDelete = useCallback((rJid: string, messageId: string, fromMe: boolean) => {
    if (confirm("Apagar esta mensagem para todos?")) {
      deleteMessageMut.mutate({ sessionId, remoteJid: rJid, messageId, fromMe });
    }
  }, [sessionId]);

  const handleEditStart = useCallback((messageId: string, text: string) => {
    setEditTarget({ messageId, text });
  }, []);

  const handleEditSave = useCallback((newText: string) => {
    if (!editTarget || !contactPhone) return;
    editMessageMut.mutate({ sessionId, number: contactPhone, messageId: editTarget.messageId, newText });
    setEditTarget(null);
  }, [editTarget, sessionId, contactPhone]);

  const handleForward = useCallback((msg: any) => {
    const content = msg.content || msg.mediaUrl || "";
    navigator.clipboard.writeText(content);
    toast.success("Conteudo copiado. Cole em outra conversa para encaminhar.");
  }, []);

  const handleLocationSend = useCallback((lat: number, lng: number, name: string, address: string) => {
    if (!contactPhone) return;
    sendLocationMut.mutate({ sessionId, number: contactPhone, latitude: lat, longitude: lng, name, address });
  }, [sessionId, contactPhone]);

  const handleContactSend = useCallback((contacts: Array<{ fullName: string; phoneNumber: string }>) => {
    if (!contactPhone) return;
    sendContactMut.mutate({ sessionId, number: contactPhone, contacts });
  }, [sessionId, contactPhone]);

  const handlePollSend = useCallback((name: string, values: string[], selectableCount: number) => {
    if (!contactPhone) return;
    sendPollMut.mutate({ sessionId, number: contactPhone, name, values, selectableCount });
  }, [sessionId, contactPhone]);

  const handleTranscribe = useCallback((msgId: number, audioUrl: string) => {
    setTranscriptions(prev => ({ ...prev, [msgId]: { loading: true } }));
    transcribeMut.mutate({ audioUrl }, {
      onSuccess: (data) => setTranscriptions(prev => ({ ...prev, [msgId]: { text: data.text } })),
      onError: (err) => {
        const msg = err.message === "OPENAI_REQUIRED" ? "Conecte a API da OpenAI em Integracoes > IA" : (err.message || "Falha");
        setTranscriptions(prev => ({ ...prev, [msgId]: { error: msg } }));
      },
    });
  }, [transcribeMut]);

  const handleRetranscribe = useCallback((msgId: number) => {
    setTranscriptions(prev => ({ ...prev, [msgId]: { loading: true } }));
    retranscribeMut.mutate({ messageId: msgId }, {
      onSuccess: () => {
        const pollInterval = setInterval(() => { utils.whatsapp.messagesByContact.invalidate(); }, 5000);
        setTimeout(() => clearInterval(pollInterval), 60000);
      },
      onError: (err) => setTranscriptions(prev => ({ ...prev, [msgId]: { error: err.message || "Falha na transcricao" } })),
    });
  }, [retranscribeMut, utils]);

  const handleSummarize = useCallback(() => {
    setSummaryLoading(true);
    setSummaryText("");
    summarizeMut.mutate({ sessionId, remoteJid }, {
      onSuccess: (data) => {
        setSummaryText(typeof data.summary === "string" ? data.summary : String(data.summary || ""));
        setSummaryLoading(false);
      },
      onError: (err) => { setSummaryText(`Erro: ${err.message}`); setSummaryLoading(false); },
    });
  }, [summarizeMut, sessionId, remoteJid]);

  // Presence
  const sendPresenceComposing = useCallback(() => {
    if (!contactPhone || !sessionId) return;
    sendPresenceMut.mutate({ sessionId, number: contactPhone, presence: "composing" });
  }, [sessionId, contactPhone]);

  const sendPresencePaused = useCallback(() => {
    if (!contactPhone || !sessionId) return;
    sendPresenceMut.mutate({ sessionId, number: contactPhone, presence: "paused" });
  }, [sessionId, contactPhone]);

  // Pin / Archive / Priority
  const pinConversation = useCallback((pinned: boolean) => {
    pinMut.mutate({ sessionId, remoteJid, pin: pinned });
  }, [sessionId, remoteJid]);

  const archiveConversation = useCallback(() => {
    archiveMut.mutate({ sessionId, remoteJid, archive: true });
  }, [sessionId, remoteJid]);

  const setPriorityFn = useCallback((priority: string) => {
    setPriorityMut.mutate({ sessionId, remoteJid, priority: priority as any });
  }, [sessionId, remoteJid]);

  // Transfer
  const executeTransfer = useCallback((targetAgentId: number, note?: string) => {
    transferMut.mutate({ sessionId, remoteJid, toUserId: targetAgentId, note });
  }, [sessionId, remoteJid]);

  // ── Return ────────────────────────────────────────────

  return {
    handleSend,
    handleFileSelect,
    handleDocSelect,
    handleVoiceSend,
    messageText,
    setMessageText,
    replyTarget,
    setReplyTarget,
    editTarget,
    handleEditStart,
    handleEditSave,
    handleReact,
    handleDelete,
    handleForward,
    handleLocationSend,
    handleContactSend,
    handlePollSend,
    handleTranscribe,
    handleRetranscribe,
    handleSummarize,
    summaryText,
    summaryLoading,
    isNoteMode,
    setIsNoteMode,
    noteCategory,
    setNoteCategory,
    sendPresenceComposing,
    sendPresencePaused,
    isSending,
    pinConversation,
    archiveConversation,
    setPriority: setPriorityFn,
    executeTransfer,
  };
}
