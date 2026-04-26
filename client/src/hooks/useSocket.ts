import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { io, Socket } from "socket.io-client";

interface WhatsAppQREvent {
  sessionId: string;
  qr: string;
  qrDataUrl: string;
}

interface WhatsAppStatusEvent {
  sessionId: string;
  status: "connected" | "disconnected";
  user?: any;
  statusCode?: number;
}

interface WhatsAppMessageEvent {
  sessionId: string;
  messageId: string | null;
  content: string;
  fromMe: boolean;
  remoteJid: string;
  messageType: string;
  timestamp: number;
  status?: string;   // Backend now sends status ("sent" | "received") in socket event
  isSync?: boolean;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  mediaDuration?: number | null;
  isVoiceNote?: boolean;
}

export interface WhatsAppMessageStatusEvent {
  sessionId: string;
  messageId: string;
  status: string;
  remoteJid?: string | null;  // Backend sends remoteJid for conversation lookup
  timestamp: number;
}

interface WhatsAppMediaUpdateEvent {
  sessionId: string;
  remoteJid: string;
  messageId: string;
  mediaUrl: string;
  timestamp: number;
}

interface TranscriptionUpdateEvent {
  sessionId: string;
  messageId: number;
  remoteJid: string;
  status: string;
  text?: string;
  error?: string;
}

interface ReactionEvent {
  sessionId: string;
  targetMessageId: string;
  senderJid: string;
  emoji: string;
  fromMe: boolean;
  remoteJid: string;
  tenantId?: number;
}

interface ConversationUpdatedEvent {
  type: string;
  waConversationId: number;
  sessionId: string;
  remoteJid: string;
  authorUserId: number;
  authorName: string;
  timestamp: number;
}

// ─── Singleton Socket Manager ───
// Ensures only ONE Socket.IO connection exists across all components

class SocketManager {
  private socket: Socket | null = null;
  private listeners = new Set<() => void>();
  private _isConnected = false;
  private _qrData: WhatsAppQREvent | null = null;
  private _waStatus: WhatsAppStatusEvent | null = null;
  private _lastMessage: WhatsAppMessageEvent | null = null;
  private _lastStatusUpdate: WhatsAppMessageStatusEvent | null = null;
  private _lastMediaUpdate: WhatsAppMediaUpdateEvent | null = null;
  private _lastConversationUpdate: ConversationUpdatedEvent | null = null;
  private _lastTranscriptionUpdate: TranscriptionUpdateEvent | null = null;
  private _lastReaction: ReactionEvent | null = null;
  private _lastEditedMessage: { sessionId: string; messageId: string; remoteJid?: string; newText: string; timestamp: number } | null = null;
  private _lastPresenceUpdate: { userId: number; availabilityStatus: string; tenantId: number; timestamp: number } | null = null;
  private _lastSlaBreached: { conversationId: number; sessionId: string; remoteJid: string; tenantId: number; breachType: string; assignedUserId: number | null; timestamp: number } | null = null;
  private refCount = 0;

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    this.refCount++;
    this.ensureConnected();
    return () => {
      this.listeners.delete(listener);
      this.refCount--;
      // Don't disconnect — keep the socket alive for the app lifetime
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private ensureConnected() {
    if (this.socket) return;
    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    this.socket = socket;

    socket.on("connect", () => {
      this._isConnected = true;
      this.notify();
    });

    socket.on("disconnect", () => {
      this._isConnected = false;
      this.notify();
    });

    socket.on("whatsapp:qr", (data: WhatsAppQREvent) => {
      this._qrData = data;
      this.notify();
    });

    socket.on("whatsapp:status", (data: WhatsAppStatusEvent) => {
      this._waStatus = data;
      if (data.status === "connected") {
        this._qrData = null;
      }
      this.notify();
    });

    socket.on("whatsapp:message", (data: WhatsAppMessageEvent) => {
      this._lastMessage = data;
      this.notify();
    });

    socket.on("whatsapp:message:status", (data: WhatsAppMessageStatusEvent) => {
      this._lastStatusUpdate = data;
      this.notify();
    });

    // Media update — triggers refetch but NOT notification sound
    socket.on("whatsapp:media_update", (data: WhatsAppMediaUpdateEvent) => {
      this._lastMediaUpdate = data;
      this.notify();
    });

    // Audio transcription completed
    socket.on("whatsapp:transcription", (data: TranscriptionUpdateEvent) => {
      this._lastTranscriptionUpdate = data;
      this.notify();
    });

    // Reaction on a message
    socket.on("whatsapp:reaction", (data: ReactionEvent) => {
      this._lastReaction = data;
      this.notify();
    });

    socket.on("whatsapp:message:edited", (data: { sessionId: string; messageId: string; newText: string; timestamp: number }) => {
      this._lastEditedMessage = data;
      this.notify();
    });

    // Conversation updated (internal notes, assignments, etc.)
    socket.on("conversationUpdated", (data: ConversationUpdatedEvent) => {
      this._lastConversationUpdate = data;
      this.notify();
    });

    // Agent presence/availability changed
    socket.on("agentPresenceChanged", (data: any) => {
      this._lastPresenceUpdate = data;
      this.notify();
    });

    // SLA breached
    socket.on("slaBreached", (data: any) => {
      this._lastSlaBreached = data;
      this.notify();
    });
  }

  getSnapshot() {
    return {
      isConnected: this._isConnected,
      qrData: this._qrData,
      waStatus: this._waStatus,
      lastMessage: this._lastMessage,
      lastStatusUpdate: this._lastStatusUpdate,
      lastMediaUpdate: this._lastMediaUpdate,
      lastConversationUpdate: this._lastConversationUpdate,
      lastTranscriptionUpdate: this._lastTranscriptionUpdate,
      lastReaction: this._lastReaction,
      lastEditedMessage: this._lastEditedMessage,
      lastPresenceUpdate: this._lastPresenceUpdate,
      lastSlaBreached: this._lastSlaBreached,
    };
  }

  clearQr() {
    this._qrData = null;
    this.notify();
  }

  /** Get the raw socket instance for direct event listening */
  getSocket(): Socket | null {
    this.ensureConnected();
    return this.socket;
  }
}

const socketManager = new SocketManager();

// Stable reference for useSyncExternalStore
let snapshotCache = socketManager.getSnapshot();
function getSnapshot() {
  const next = socketManager.getSnapshot();
  // Only create new reference if values actually changed
  if (
    next.isConnected !== snapshotCache.isConnected ||
    next.qrData !== snapshotCache.qrData ||
    next.waStatus !== snapshotCache.waStatus ||
    next.lastMessage !== snapshotCache.lastMessage ||
    next.lastStatusUpdate !== snapshotCache.lastStatusUpdate ||
    next.lastMediaUpdate !== snapshotCache.lastMediaUpdate ||
    next.lastConversationUpdate !== snapshotCache.lastConversationUpdate ||
    next.lastTranscriptionUpdate !== snapshotCache.lastTranscriptionUpdate ||
    next.lastReaction !== snapshotCache.lastReaction ||
    next.lastEditedMessage !== snapshotCache.lastEditedMessage ||
    next.lastPresenceUpdate !== snapshotCache.lastPresenceUpdate ||
    next.lastSlaBreached !== snapshotCache.lastSlaBreached
  ) {
    snapshotCache = next;
  }
  return snapshotCache;
}

function subscribe(listener: () => void) {
  return socketManager.subscribe(listener);
}

/** Get the raw socket instance for direct event listening (e.g., AI suggestion streaming) */
export function getSocketInstance(): Socket | null {
  return socketManager.getSocket();
}

export function useSocket() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const clearQr = useCallback(() => socketManager.clearQr(), []);

  return {
    isConnected: state.isConnected,
    qrData: state.qrData,
    waStatus: state.waStatus,
    lastMessage: state.lastMessage,
    lastStatusUpdate: state.lastStatusUpdate,
    lastMediaUpdate: state.lastMediaUpdate,
    lastConversationUpdate: state.lastConversationUpdate,
    lastTranscriptionUpdate: state.lastTranscriptionUpdate,
    lastReaction: state.lastReaction,
    lastEditedMessage: state.lastEditedMessage,
    lastPresenceUpdate: state.lastPresenceUpdate,
    lastSlaBreached: state.lastSlaBreached,
    clearQr,
  };
}
