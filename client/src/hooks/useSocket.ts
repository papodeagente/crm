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
  content: string;
  fromMe: boolean;
  remoteJid: string;
  messageType: string;
  timestamp: number;
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
  }

  getSnapshot() {
    return {
      isConnected: this._isConnected,
      qrData: this._qrData,
      waStatus: this._waStatus,
      lastMessage: this._lastMessage,
      lastStatusUpdate: this._lastStatusUpdate,
      lastMediaUpdate: this._lastMediaUpdate,
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
    next.lastMediaUpdate !== snapshotCache.lastMediaUpdate
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
    clearQr,
  };
}
