import { useEffect, useRef, useCallback, useState } from "react";
import { getSocketInstance } from "./useSocket";

// ─── Types ───

interface UsePresenceTrackingOptions {
  sessionId: string;
  remoteJid: string;
  contactPhone: string;
}

type PresenceStatus = "composing" | "recording" | "paused" | "available" | null;

interface UsePresenceTrackingResult {
  /** Remote contact's current presence status */
  remotePresence: PresenceStatus;
  /** No-op: Z-API sends typing via delayTyping on send-text instead */
  sendTyping: () => void;
  /** No-op */
  sendRecording: () => void;
  /** No-op */
  sendPaused: () => void;
}

interface PresenceSocketEvent {
  sessionId: string;
  tenantId: number;
  remoteJid: string;
  status: string;
  timestamp: number;
}

const PRESENCE_CLEAR_MS = 5_000;

// ─── Hook ───

export function usePresenceTracking(
  opts: UsePresenceTrackingOptions,
): UsePresenceTrackingResult {
  const { remoteJid } = opts;

  const [remotePresence, setRemotePresence] = useState<PresenceStatus>(null);

  const presenceClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (presenceClearTimer.current) clearTimeout(presenceClearTimer.current);
    presenceClearTimer.current = null;
  }, []);

  // Z-API has no standalone presence endpoint. Typing indicator is sent
  // via delayTyping parameter on send-text. These are intentional no-ops.
  const sendTyping = useCallback(() => {}, []);
  const sendRecording = useCallback(() => {}, []);
  const sendPaused = useCallback(() => {}, []);

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
    return clearTimers;
  }, [remoteJid, clearTimers]);

  return { remotePresence, sendTyping, sendRecording, sendPaused };
}
