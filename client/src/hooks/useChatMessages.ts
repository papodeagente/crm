import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { SYSTEM_TIMEZONE, SYSTEM_LOCALE } from "../../../shared/dateUtils";

/* ─── Types ─── */
export interface Message {
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

export interface MessageGroup {
  date: string;
  messages: Message[];
}

/* ─── Status Order Map — monotonic enforcement ─── */
const STATUS_ORDER_MAP: Record<string, number> = {
  error: 0, pending: 1, sending: 2, sent: 3, server_ack: 3,
  delivered: 4, delivery_ack: 4, read: 5, played: 6, received: -1,
};

/* ─── Hidden message types (protocol/system) ─── */
const HIDDEN_MSG_TYPES = new Set([
  "protocolMessage", "senderKeyDistributionMessage", "messageContextInfo",
  "ephemeralMessage", "reactionMessage", "associatedChildMessage",
  "placeholderMessage", "albumMessage", "peerDataOperationRequestResponseMessage",
  "botInvokeMessage", "newsletterAdminInviteMessage", "encReactionMessage",
  "keepInChatMessage", "pinInChatMessage", "pollUpdateMessage",
  "groupInviteMessage", "lottieStickerMessage",
]);

/* ─── Media / special / rich types for groupedMessages filter ─── */
const MEDIA_TYPES = new Set([
  "imageMessage", "videoMessage", "audioMessage", "pttMessage",
  "documentMessage", "stickerMessage", "ptvMessage",
]);
const SPECIAL_TYPES = new Set([
  "locationMessage", "contactMessage", "contactsArrayMessage",
  "pollCreationMessage", "pollCreationMessageV3",
]);
const RICH_TYPES = new Set([
  "templateMessage", "interactiveMessage", "buttonsMessage",
  "listMessage", "buttonsResponseMessage", "listResponseMessage",
  "highlyStructuredMessage", "productMessage", "orderMessage",
]);

/* ─── Hook interface ─── */
export interface UseChatMessagesOptions {
  sessionId: string;
  remoteJid: string;
  waConversationId?: number;
  socketConnected: boolean;
}

export interface UseChatMessagesResult {
  groupedMessages: MessageGroup[];
  rawMessages: Message[];
  isLoading: boolean;
  hasMoreMessages: boolean;
  loadMoreMessages: () => void;
  reactionsMap: Record<string, Array<{ emoji: string; senderJid: string; fromMe: boolean }>>;
  localStatusUpdates: Record<string, string>;
  transcriptions: Record<number, { text?: string; loading?: boolean; error?: string }>;
  setTranscriptions: React.Dispatch<React.SetStateAction<Record<number, { text?: string; loading?: boolean; error?: string }>>>;
  refetchMessages: () => void;
  refetchNotes: () => void;
  notesData: any[];
  globalNotesData: any[];
  /** Current pagination limit — needed by orchestrator for optimistic cache updates */
  msgLimit: number;
}

const INITIAL_MSG_LIMIT = 50;

/* ═══════════════════════════════════════════════════════════════════════════ */
export function useChatMessages({
  sessionId,
  remoteJid,
  waConversationId,
  socketConnected,
}: UseChatMessagesOptions): UseChatMessagesResult {
  const { lastMessage, lastStatusUpdate, lastMediaUpdate, lastConversationUpdate, lastTranscriptionUpdate, lastReaction } = useSocket();
  const utils = trpc.useUtils();

  /* ── Pagination ── */
  const [msgLimit, setMsgLimit] = useState(INITIAL_MSG_LIMIT);
  useEffect(() => { setMsgLimit(INITIAL_MSG_LIMIT); }, [remoteJid]);

  const loadMoreMessages = useCallback(() => {
    setMsgLimit(prev => prev + 50);
  }, []);

  /* ── Messages query ── */
  const messagesQ = trpc.whatsapp.messagesByContact.useQuery(
    { sessionId, remoteJid, limit: msgLimit },
    { enabled: !!sessionId && !!remoteJid, refetchInterval: socketConnected ? false : 30000, staleTime: 5000, refetchIntervalInBackground: false },
  );
  const hasMoreMessages = (messagesQ.data?.length || 0) >= msgLimit;

  /* ── Notes queries ── */
  const notesQ = trpc.whatsapp.notes.list.useQuery(
    { waConversationId: waConversationId || 0 },
    { enabled: !!waConversationId, refetchInterval: socketConnected ? false : 30000, staleTime: 15000, refetchIntervalInBackground: false },
  );
  const globalNotesQ = trpc.whatsapp.notes.globalByContact.useQuery(
    { remoteJid },
    { enabled: !!remoteJid, staleTime: 30000 },
  );

  /* ── Reactions query ── */
  const messageIds = useMemo(() => {
    return (messagesQ.data || []).map(m => m.messageId).filter((id): id is string => !!id);
  }, [messagesQ.data]);

  const reactionsQ = trpc.whatsapp.reactions.useQuery(
    { sessionId, messageIds },
    { enabled: !!sessionId && messageIds.length > 0, staleTime: 30000 },
  );

  /* ── Reactions map (local state) ── */
  const [reactionsMap, setReactionsMap] = useState<Record<string, Array<{ emoji: string; senderJid: string; fromMe: boolean }>>>({});

  // Hydrate from query
  useEffect(() => {
    if (!reactionsQ.data) return;
    const map: Record<string, Array<{ emoji: string; senderJid: string; fromMe: boolean }>> = {};
    for (const r of reactionsQ.data) {
      if (!r.emoji) continue;
      if (!map[r.targetMessageId]) map[r.targetMessageId] = [];
      map[r.targetMessageId].push({ emoji: r.emoji, senderJid: r.senderJid, fromMe: r.fromMe });
    }
    setReactionsMap(map);
  }, [reactionsQ.data]);

  // Real-time reaction socket events
  useEffect(() => {
    if (!lastReaction || lastReaction.remoteJid !== remoteJid) return;
    setReactionsMap(prev => {
      const targetId = lastReaction.targetMessageId;
      const filtered = [...(prev[targetId] || [])].filter(r => r.senderJid !== lastReaction.senderJid);
      if (lastReaction.emoji) {
        filtered.push({ emoji: lastReaction.emoji, senderJid: lastReaction.senderJid, fromMe: lastReaction.fromMe });
      }
      return { ...prev, [targetId]: filtered };
    });
  }, [lastReaction, remoteJid]);

  /* ── Local status updates (monotonic) ── */
  const [localStatusUpdates, setLocalStatusUpdates] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!lastStatusUpdate?.messageId) return;
    setLocalStatusUpdates(prev => {
      const currentStatus = prev[lastStatusUpdate.messageId];
      const currentOrder = currentStatus ? (STATUS_ORDER_MAP[currentStatus] ?? -1) : -1;
      const newOrder = STATUS_ORDER_MAP[lastStatusUpdate.status] ?? -1;
      if (newOrder > currentOrder) {
        return { ...prev, [lastStatusUpdate.messageId]: lastStatusUpdate.status };
      }
      return prev;
    });
  }, [lastStatusUpdate]);

  // Merge local overrides with server data on refetch — keep only higher overrides
  useEffect(() => {
    if (!messagesQ.data) return;
    setLocalStatusUpdates(prev => {
      if (Object.keys(prev).length === 0) return prev;
      const newOverrides: Record<string, string> = {};
      let hasOverrides = false;
      for (const [msgId, socketStatus] of Object.entries(prev)) {
        const serverMsg = messagesQ.data.find((m: any) => m.messageId === msgId);
        if (serverMsg) {
          const serverOrder = serverMsg.status ? (STATUS_ORDER_MAP[serverMsg.status] ?? -1) : -1;
          const socketOrder = STATUS_ORDER_MAP[socketStatus] ?? -1;
          if (socketOrder > serverOrder) {
            newOverrides[msgId] = socketStatus;
            hasOverrides = true;
          }
        } else {
          newOverrides[msgId] = socketStatus;
          hasOverrides = true;
        }
      }
      return hasOverrides ? newOverrides : {};
    });
  }, [messagesQ.dataUpdatedAt]);

  /* ── Transcriptions (local state) ── */
  const [transcriptions, setTranscriptions] = useState<Record<number, { text?: string; loading?: boolean; error?: string }>>({});

  // Socket transcription update
  useEffect(() => {
    if (!lastTranscriptionUpdate || lastTranscriptionUpdate.remoteJid !== remoteJid) return;
    messagesQ.refetch();
    if (lastTranscriptionUpdate.status === "completed" && lastTranscriptionUpdate.text) {
      setTranscriptions(prev => ({ ...prev, [lastTranscriptionUpdate.messageId]: { text: lastTranscriptionUpdate.text } }));
    } else if (lastTranscriptionUpdate.status === "failed") {
      setTranscriptions(prev => ({ ...prev, [lastTranscriptionUpdate.messageId]: { error: lastTranscriptionUpdate.error || "Falha" } }));
    }
  }, [lastTranscriptionUpdate, remoteJid]);

  /* ── Socket message → cache update (reconciliation) ── */
  useEffect(() => {
    if (!lastMessage || lastMessage.remoteJid !== remoteJid) return;
    const queryKey = { sessionId, remoteJid, limit: msgLimit };

    if (lastMessage.fromMe) {
      utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
        if (!old) return old;
        // Reconcile: find oldest unconfirmed optimistic message with matching content
        const optIdx = old.findIndex((m: any) =>
          m.messageId?.startsWith("opt_") && m.status === "pending" && m.content === lastMessage.content,
        );
        if (optIdx >= 0) {
          const reconciled = {
            ...old[optIdx],
            messageId: lastMessage.messageId || old[optIdx].messageId,
            status: "sent",
            id: (lastMessage as any).id || old[optIdx].id,
          };
          const updated = [...old];
          updated[optIdx] = reconciled;
          return updated;
        }
        // Deduplicate by messageId
        if (old.some((m: any) => m.messageId === lastMessage.messageId)) return old;
        // New fromMe from another device/tab
        const socketMsg = {
          id: (lastMessage as any).id || -Date.now(),
          sessionId: lastMessage.sessionId || sessionId,
          messageId: lastMessage.messageId || `socket_${Date.now()}`,
          remoteJid: lastMessage.remoteJid,
          fromMe: true,
          messageType: lastMessage.messageType || "conversation",
          content: lastMessage.content || "",
          status: "sent",
          timestamp: lastMessage.timestamp ? new Date(lastMessage.timestamp).toISOString() : new Date().toISOString(),
          createdAt: new Date().toISOString(),
          quotedMessageId: null,
        };
        return [socketMsg, ...old].slice(0, msgLimit + 20);
      });
    } else {
      // Incoming message from contact
      const socketMsg = {
        id: (lastMessage as any).id || -Date.now(),
        sessionId: lastMessage.sessionId || sessionId,
        messageId: lastMessage.messageId || `socket_${Date.now()}`,
        remoteJid: lastMessage.remoteJid,
        fromMe: false,
        messageType: lastMessage.messageType || "conversation",
        content: lastMessage.content || "",
        status: "received",
        timestamp: lastMessage.timestamp ? new Date(lastMessage.timestamp).toISOString() : new Date().toISOString(),
        createdAt: new Date().toISOString(),
        quotedMessageId: null,
      };
      utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
        if (!old) return [socketMsg];
        if (old.some((m: any) => m.messageId === socketMsg.messageId)) return old;
        return [socketMsg, ...old].slice(0, msgLimit + 20);
      });
    }
  }, [lastMessage, remoteJid, sessionId, msgLimit, utils]);

  /* ── Socket media update → refetch ── */
  useEffect(() => {
    if (lastMediaUpdate && lastMediaUpdate.remoteJid === remoteJid) messagesQ.refetch();
  }, [lastMediaUpdate, remoteJid]);

  /* ── Socket conversationUpdated → refetch notes ── */
  useEffect(() => {
    if (lastConversationUpdate && lastConversationUpdate.type === "internal_note" && lastConversationUpdate.remoteJid === remoteJid) {
      notesQ.refetch();
    }
  }, [lastConversationUpdate, remoteJid]);

  /* ── groupedMessages memo — merge messages + notes, filter, group by date ── */
  const groupedMessages = useMemo(() => {
    const msgs: Message[] = [...(messagesQ.data || [])].reverse().filter(m => {
      if (HIDDEN_MSG_TYPES.has(m.messageType)) return false;
      if (MEDIA_TYPES.has(m.messageType)) return true;
      if (SPECIAL_TYPES.has(m.messageType)) return true;
      if (RICH_TYPES.has(m.messageType)) return true;
      const content = m.content?.trim();
      if (!content) return false;
      if (/^\[\w+\]$/.test(content)) return false;
      return true;
    });

    // Merge notes as virtual messages
    const noteItems: Message[] = ((notesQ.data || []) as any[]).map((note: any) => ({
      id: -note.id,
      sessionId: "",
      messageId: `note_${note.id}`,
      remoteJid: "",
      fromMe: true,
      messageType: "internal_note",
      content: note.content,
      mediaUrl: null,
      status: null,
      timestamp: note.createdAt,
      createdAt: note.createdAt,
      pushName: note.authorName || "Agente",
      mediaFileName: note.authorAvatar || null,
      _noteCategory: note.category || "other",
      _notePriority: note.priority || "normal",
      _noteIsGlobal: !!note.isCustomerGlobalNote,
      _noteMentionedUserIds: note.mentionedUserIds,
    } as any));

    // Sort chronologically
    const combined = [...msgs, ...noteItems].sort((a, b) => {
      const tA = new Date(a.timestamp || a.createdAt).getTime();
      const tB = new Date(b.timestamp || b.createdAt).getTime();
      return tA - tB;
    });

    // Group by date
    const groups: MessageGroup[] = [];
    let currentDate = "";
    for (const msg of combined) {
      const d = new Date(msg.timestamp || msg.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      let label = d.toLocaleDateString(SYSTEM_LOCALE, { day: "2-digit", month: "long", year: "numeric", timeZone: SYSTEM_TIMEZONE });
      if (d.toDateString() === today.toDateString()) label = "Hoje";
      else if (d.toDateString() === yesterday.toDateString()) label = "Ontem";
      if (label !== currentDate) {
        currentDate = label;
        groups.push({ date: label, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    }
    return groups;
  }, [messagesQ.data, notesQ.data]);

  /* ── Raw messages (reversed for quote lookup) ── */
  const rawMessages = useMemo(() => [...(messagesQ.data || [])].reverse(), [messagesQ.data]);

  return {
    groupedMessages,
    rawMessages,
    isLoading: messagesQ.isLoading,
    hasMoreMessages,
    loadMoreMessages,
    reactionsMap,
    localStatusUpdates,
    transcriptions,
    setTranscriptions,
    refetchMessages: () => messagesQ.refetch(),
    refetchNotes: () => notesQ.refetch(),
    notesData: (notesQ.data || []) as any[],
    globalNotesData: (globalNotesQ.data || []) as any[],
    msgLimit,
  };
}
