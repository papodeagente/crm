/**
 * useInboxSocket — Bridge between Socket.IO events and ConversationStore
 *
 * Handles:
 * - whatsapp:message       → store.handleMessage() + notification sound
 * - whatsapp:message:status → store.handleStatusUpdate()
 * - conversationUpdated    → store.updateAssignment()
 *
 * Does NOT touch React Query / tRPC — the parent component uses
 * the `onNewConversation` callback when a refetch is needed.
 */

import { useEffect, useRef } from "react";
import { useSocket } from "./useSocket";
import { useConversationStore, makeConvKey, getJidFromKey } from "./useConversationStore";
import type { ConvEntry } from "./useConversationStore";
import { playNotification } from "../components/inbox/NotificationSound";

// ── Constants ──────────────────────────────────────────────────────────────────

const PREVIEW_SKIP_TYPES = [
  "protocolMessage", "senderKeyDistributionMessage", "messageContextInfo",
  "ephemeralMessage", "reactionMessage", "editedMessage",
  "deviceSentMessage", "bcallMessage", "callLogMesssage",
  "keepInChatMessage", "encReactionMessage", "viewOnceMessageV2Extension",
];

const SOUND_SKIP_TYPES = [
  ...PREVIEW_SKIP_TYPES,
  "internal_note",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

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
  if (content && content.length > 0 && !content.startsWith("[")) {
    const prefix = typeMap[messageType];
    if (prefix && (messageType === "templateMessage" || messageType === "interactiveMessage" ||
        messageType === "buttonsMessage" || messageType === "listMessage")) {
      const emoji = prefix.split(" ")[0];
      return `${emoji} ${content}`;
    }
    return content;
  }
  return typeMap[messageType] || content || "";
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UseInboxSocketOptions {
  sessionId: string | null;
  isMuted: boolean;
  selectedKeyRef: React.RefObject<string | null>;
  soundSuppressedUntilRef: React.RefObject<number>;
  onNewConversation?: () => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useInboxSocket(opts: UseInboxSocketOptions): void {
  const { sessionId, isMuted, selectedKeyRef, soundSuppressedUntilRef, onNewConversation } = opts;

  const { lastMessage, lastStatusUpdate, lastConversationUpdate } = useSocket();
  const convStore = useConversationStore();

  // Bug fix #8: Dedup by messageId — track processed IDs to avoid duplicate sounds.
  // Falls back to signature-based dedup when messageId is absent.
  const processedMsgRef = useRef<Set<string>>(new Set());

  // ── 1. Message handler ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!lastMessage) return;

    // Validation: require remoteJid + timestamp
    if (!lastMessage.remoteJid || !lastMessage.timestamp) return;

    // Session mismatch — ignore messages from other sessions
    if (lastMessage.sessionId && sessionId && lastMessage.sessionId !== sessionId) return;

    // Skip protocol/system types from preview update
    if (PREVIEW_SKIP_TYPES.includes(lastMessage.messageType)) return;

    // Skip group messages
    if (lastMessage.remoteJid.endsWith("@g.us")) return;

    // ── Instant update via deterministic store ──
    const handled = convStore.handleMessage({
      sessionId: lastMessage.sessionId || sessionId || "",
      remoteJid: lastMessage.remoteJid,
      content: lastMessage.content || getMessagePreview(null, lastMessage.messageType),
      fromMe: lastMessage.fromMe,
      messageType: lastMessage.messageType,
      timestamp: lastMessage.timestamp,          // Bug fix #1: Z-API momment (ms) — backend guarantees ms
      status: (lastMessage as any).status,
      isSync: (lastMessage as any).isSync,
      messageId: lastMessage.messageId || undefined,
      pushName: (lastMessage as any).pushName || undefined,
    }, selectedKeyRef.current);

    // Conversation not in store — notify parent to refetch
    if (!handled) {
      onNewConversation?.();
    }

    // ── Notification Sound Guards ─────────────────────────────────────────────

    // Bug fix #8: Dedup by messageId first, fall back to content+timestamp signature
    const dedupKey = lastMessage.messageId
      ? `id:${lastMessage.messageId}`
      : `sig:${lastMessage.remoteJid}:${lastMessage.content}:${lastMessage.timestamp}`;

    if (processedMsgRef.current.has(dedupKey)) return;
    if (processedMsgRef.current.size > 200) processedMsgRef.current.clear();
    processedMsgRef.current.add(dedupKey);

    // Guard: NEVER play sound for own messages
    if (lastMessage.fromMe) return;

    // Guard: Skip sync batches (history sync, initial load)
    if ((lastMessage as any).isSync || (lastMessage as any).syncBatch) return;

    // Guard: Skip non-inbox event types for sound
    if (SOUND_SKIP_TYPES.includes(lastMessage.messageType)) return;

    // Guard: Skip group messages (redundant but explicit for sound path)
    if (lastMessage.remoteJid.endsWith("@g.us")) return;

    // Guard: Skip if muted
    if (isMuted) return;

    // Guard: Skip if sound is suppressed (conversation just opened / hydration)
    if (Date.now() < soundSuppressedUntilRef.current) return;

    // Guard: Skip if this is the currently viewed conversation
    const currentJid = selectedKeyRef.current ? getJidFromKey(selectedKeyRef.current) : null;
    if (currentJid === lastMessage.remoteJid) return;

    // All guards passed — play notification
    playNotification();
  }, [lastMessage]);

  // ── 2. Status update handler (monotonic progression) ────────────────────────
  useEffect(() => {
    if (!lastStatusUpdate) return;
    const remoteJid = lastStatusUpdate.remoteJid;
    if (!remoteJid) return;
    const sid = lastStatusUpdate.sessionId || sessionId || "";
    convStore.handleStatusUpdate({
      sessionId: sid,
      remoteJid,
      status: lastStatusUpdate.status,
      messageId: lastStatusUpdate.messageId,
    });
  }, [lastStatusUpdate]);

  // ── 3. Conversation update handler (assignments, queue changes) ─────────────
  useEffect(() => {
    if (!lastConversationUpdate) return;
    const { type, sessionId: evtSessionId, remoteJid, assignedUserId, status } = lastConversationUpdate as any;
    if (!remoteJid) return;
    const sid = evtSessionId || sessionId || "";
    const key = makeConvKey(sid, remoteJid);

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
    } else if (type === "reopened") {
      convStore.updateAssignment(key, {
        assignedUserId: null,
        assignmentStatus: "open",
      });
    } else if (type === "status_change") {
      convStore.updateAssignment(key, {
        assignmentStatus: status || null,
      });
    }
  }, [lastConversationUpdate]);
}
