import { useEffect, useRef, useState, useCallback } from "react";
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

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [qrData, setQrData] = useState<WhatsAppQREvent | null>(null);
  const [waStatus, setWaStatus] = useState<WhatsAppStatusEvent | null>(null);
  const [lastMessage, setLastMessage] = useState<WhatsAppMessageEvent | null>(null);

  useEffect(() => {
    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("whatsapp:qr", (data: WhatsAppQREvent) => {
      setQrData(data);
    });

    socket.on("whatsapp:status", (data: WhatsAppStatusEvent) => {
      setWaStatus(data);
      if (data.status === "connected") {
        setQrData(null);
      }
    });

    socket.on("whatsapp:message", (data: WhatsAppMessageEvent) => {
      setLastMessage(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const clearQr = useCallback(() => setQrData(null), []);

  return { isConnected, qrData, waStatus, lastMessage, clearQr };
}
