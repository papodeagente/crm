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
  isSync?: boolean;
}

export interface WhatsAppMessageStatusEvent {
  sessionId: string;
  messageId: string;
  status: string;
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

interface ConversationUpdatedEvent {
  type: string;
  waConversationId: number;
  sessionId: string;
  remoteJid: string;
  authorUserId: number;
  authorName: string;
  timestamp: number;
}

/** Conversation ownership change event (claim, assign, transfer, enqueue, finish) */
export interface ConversationOwnershipEvent {
  conversationId: number;
  sessionId: string;
  remoteJid: string;
  assignedUserId: number | null;
  assignedTeamId: number | null;
  assignedAgentName: string | null;
  assignedAgentAvatar: string | null;
  assignmentStatus: string;
  queuedAt: string | null;
  lastMessage: string | null;
  lastMessageAt: number | null;
  lastMessageType: string | null;
  lastFromMe: boolean;
  lastStatus: string | null;
  unreadCount: number;
  contactPushName: string | null;
}

/** PART 5: Full conversation preview update from server (single source of truth) */
export interface ConversationPreviewEvent {
  sessionId: string;
  remoteJid: string;
  conversationId: number;
  lastMessage: string | null;
  lastMessageAt: number;
  lastMessageStatus: string | null;
  lastMessageType: string | null;
  lastFromMe: boolean;
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
  private _lastConversationPreview: ConversationPreviewEvent | null = null;
  private _lastConversationOwnership: ConversationOwnershipEvent | null = null;
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
    console.log("[Socket] Creating singleton connection");
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
      console.log("[Socket] Connected:", socket.id);
      this._isConnected = true;
      this.notify();
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
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
      const _socketIoReceiveTime = Date.now();
      const _emitAt = (data as any)._traceEmitAt;
      console.log(`[TRACE][SOCKETIO_DELIVER] timestamp: ${_socketIoReceiveTime} | transport_latency: ${_emitAt ? _socketIoReceiveTime - _emitAt : 'N/A'}ms | msgId: ${(data as any).messageId || 'N/A'} | remoteJid: ${data.remoteJid?.substring(0, 15)}`);
      console.log("[Socket] Message received:", data.remoteJid, data.fromMe, data.content?.substring(0, 30));
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
      console.log("[Socket] Transcription update:", data.messageId, data.status);
      this._lastTranscriptionUpdate = data;
      this.notify();
    });

    // Conversation updated (internal notes, assignments, etc.)
    socket.on("conversationUpdated", (data: ConversationUpdatedEvent) => {
      this._lastConversationUpdate = data;
      this.notify();
    });

    // PART 5: Conversation preview update (full payload from server)
    socket.on("whatsapp:conversation:preview", (data: ConversationPreviewEvent) => {
      console.log("[Socket] Conversation preview update:", data.remoteJid?.substring(0, 15), data.lastMessageStatus);
      this._lastConversationPreview = data;
      this.notify();
    });

    // Conversation ownership change (claim, assign, transfer, enqueue, finish)
    socket.on("whatsapp:conversation:ownership", (data: ConversationOwnershipEvent) => {
      console.log("[Socket] Ownership change:", data.remoteJid?.substring(0, 15), "assignedTo:", data.assignedUserId);
      this._lastConversationOwnership = data;
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
      lastConversationPreview: this._lastConversationPreview,
      lastConversationOwnership: this._lastConversationOwnership,
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
    next.lastConversationPreview !== snapshotCache.lastConversationPreview ||
    next.lastConversationOwnership !== snapshotCache.lastConversationOwnership
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
    lastConversationPreview: state.lastConversationPreview,
    lastConversationOwnership: state.lastConversationOwnership,
    clearQr,
  };
}
