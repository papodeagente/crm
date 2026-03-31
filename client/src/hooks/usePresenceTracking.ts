import { useEffect, useRef, useCallback, useState } from "react";
import { getSocketInstance } from "./useSocket";
import { trpc } from "@/lib/trpc";

// ─── Types ───

interface UsePresenceTrackingOptions {
  sessionId: string;
  remoteJid: string;
  contactPhone: string; // cleaned phone number for Z-API presence API
}

type PresenceStatus = "composing" | "recording" | "paused" | "available" | null;

interface UsePresenceTrackingResult {
  /** Remote contact's current presence status */
  remotePresence: PresenceStatus;
  /** Call this when user types -- sends COMPOSING to Z-API, auto-PAUSED after 3s */
  sendTyping: () => void;
  /** Call this when recording audio -- sends RECORDING to Z-API */
  sendRecording: () => void;
  /** Explicitly send PAUSED */
  sendPaused: () => void;
}

interface PresenceSocketEvent {
  sessionId: string;
  tenantId: number;
  remoteJid: string;
  status: string;
  timestamp: number;
}

const DEBOUNCE_MS = 3_000;
const PRESENCE_CLEAR_MS = 5_000;

// ─── Hook ───

export function usePresenceTracking(
  opts: UsePresenceTrackingOptions,
): UsePresenceTrackingResult {
  const { sessionId, remoteJid, contactPhone } = opts;

  const [remotePresence, setRemotePresence] = useState<PresenceStatus>(null);

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentAt = useRef<number>(0);

  const sendPresenceMut = trpc.whatsapp.sendPresence.useMutation();

  // ── Helpers ──

  const clearTimers = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (presenceClearTimer.current) clearTimeout(presenceClearTimer.current);
    typingTimer.current = null;
    presenceClearTimer.current = null;
  }, []);

  const sendPaused = useCallback(() => {
    sendPresenceMut.mutate({ sessionId, number: contactPhone, presence: "paused" });
  }, [sessionId, contactPhone, sendPresenceMut]);

  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSentAt.current < DEBOUNCE_MS) return;
    lastSentAt.current = now;

    sendPresenceMut.mutate({ sessionId, number: contactPhone, presence: "composing" });

    // Auto-send paused after 3s of no further typing calls
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      sendPaused();
      typingTimer.current = null;
    }, DEBOUNCE_MS);
  }, [sessionId, contactPhone, sendPresenceMut, sendPaused]);

  const sendRecording = useCallback(() => {
    sendPresenceMut.mutate({ sessionId, number: contactPhone, presence: "recording" });
  }, [sessionId, contactPhone, sendPresenceMut]);

  // ── Receive remote presence via socket ──

  useEffect(() => {
    const socket = getSocketInstance();
    if (!socket) return;

    const handler = (data: PresenceSocketEvent) => {
      if (data.remoteJid !== remoteJid) return;

      const normalized = data.status.toLowerCase() as PresenceStatus;
      setRemotePresence(normalized);

      // Auto-clear after 5s of no updates
      if (presenceClearTimer.current) clearTimeout(presenceClearTimer.current);
      presenceClearTimer.current = setTimeout(() => {
        setRemotePresence(null);
        presenceClearTimer.current = null;
      }, PRESENCE_CLEAR_MS);
    };

    socket.on("whatsapp:presence", handler);
    return () => {
      socket.off("whatsapp:presence", handler);
    };
  }, [remoteJid]);

  // ── Reset on remoteJid change & cleanup on unmount ──

  useEffect(() => {
    setRemotePresence(null);
    clearTimers();
    lastSentAt.current = 0;
    return clearTimers;
  }, [remoteJid, clearTimers]);

  return { remotePresence, sendTyping, sendRecording, sendPaused };
}
