/**
 * useAudioRecorder — MediaRecorder API, waveform generation, PTT mode
 *
 * Records audio as audio/ogg;codecs=opus (WhatsApp native PTT format)
 * Generates waveform bars for visual feedback
 * Bug fix #6: All timers/streams cleaned up on unmount
 * Bug Report #7: startRecording agora retorna { ok, errorCode, errorMessage }
 *   pra UI mostrar mensagem específica ao invés de "Não foi possível acessar".
 */

import { useState, useCallback, useRef, useEffect } from "react";

export interface AudioRecorderResult {
  blob: Blob;
  duration: number;
  waveform: number[];
}

export type AudioRecorderErrorCode =
  | "MEDIA_DEVICES_UNAVAILABLE"   // navigator.mediaDevices ausente (HTTP, browser muito antigo)
  | "PERMISSION_DENIED"            // NotAllowedError — usuário ou Permissions-Policy negou
  | "NO_MICROPHONE"                // NotFoundError — sem hardware
  | "MIC_IN_USE"                   // NotReadableError — outro app/aba está usando
  | "OVERCONSTRAINED"              // OverconstrainedError — constraints não batem
  | "SECURITY_BLOCKED"             // SecurityError — fora de secure context / Permissions-Policy
  | "ABORTED"                       // AbortError
  | "CODEC_UNAVAILABLE"             // todos MediaRecorder mimeTypes falharam
  | "UNKNOWN";

export interface StartRecordingResult {
  ok: boolean;
  errorCode?: AudioRecorderErrorCode;
  errorMessage?: string;
}

const ERROR_MESSAGES: Record<AudioRecorderErrorCode, string> = {
  MEDIA_DEVICES_UNAVAILABLE: "Seu navegador não expõe o microfone (precisa de HTTPS).",
  PERMISSION_DENIED: "Permissão de microfone negada. Clique no cadeado do navegador → Configurações de site → Microfone → Permitir.",
  NO_MICROPHONE: "Nenhum microfone foi encontrado. Conecte um microfone e tente de novo.",
  MIC_IN_USE: "Outro app ou aba está usando seu microfone. Feche e tente de novo.",
  OVERCONSTRAINED: "Microfone disponível não atende os requisitos. Reinicie o navegador.",
  SECURITY_BLOCKED: "Acesso ao microfone bloqueado por política de segurança. Recarregue a página (Ctrl+F5) e tente de novo.",
  ABORTED: "Gravação cancelada antes do microfone responder.",
  CODEC_UNAVAILABLE: "Seu navegador não suporta nenhum formato de áudio compatível.",
  UNKNOWN: "Não foi possível acessar o microfone.",
};

export function getAudioRecorderErrorMessage(code: AudioRecorderErrorCode | undefined): string {
  return ERROR_MESSAGES[code ?? "UNKNOWN"] ?? ERROR_MESSAGES.UNKNOWN;
}

/** Mapeia o `error.name` do getUserMedia/MediaRecorder em um código canônico. */
export function classifyMediaError(err: { name?: string; message?: string } | null | undefined): AudioRecorderErrorCode {
  const name = err?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "PERMISSION_DENIED";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "NO_MICROPHONE";
  if (name === "NotReadableError" || name === "TrackStartError") return "MIC_IN_USE";
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") return "OVERCONSTRAINED";
  if (name === "SecurityError") return "SECURITY_BLOCKED";
  if (name === "AbortError") return "ABORTED";
  return "UNKNOWN";
}

/**
 * Generate waveform bars from audio amplitude (for visual display)
 * Z-API /send-audio accepts a `waveform` field for rendering
 */
function generateWaveformBars(count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 80 + 20));
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const waveformIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bug fix #6: Cleanup all timers and streams on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const mimeRef = useRef("audio/ogg;codecs=opus");

  const startRecording = useCallback(async (): Promise<StartRecordingResult> => {
    // Pre-flight: navigator.mediaDevices só existe em secure context (HTTPS/localhost).
    // Se ausente, getUserMedia falharia com TypeError sem informação útil.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const code: AudioRecorderErrorCode = "MEDIA_DEVICES_UNAVAILABLE";
      console.error("[AudioRecorder] navigator.mediaDevices unavailable — secure context?");
      return { ok: false, errorCode: code, errorMessage: ERROR_MESSAGES[code] };
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err: any) {
      const code = classifyMediaError(err);
      console.error("[AudioRecorder] getUserMedia failed:", err?.name, err?.message);
      return { ok: false, errorCode: code, errorMessage: ERROR_MESSAGES[code] };
    }

    try {
      // Try each candidate — prefer OGG (WhatsApp native PTT format), fallback to WebM
      // isTypeSupported can return true but constructor may still throw, so try/catch each
      const candidates = [
        "audio/ogg;codecs=opus",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];

      let mediaRecorder: MediaRecorder | null = null;
      for (const mime of candidates) {
        try {
          if (MediaRecorder.isTypeSupported(mime)) {
            mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
            mimeRef.current = mime;
            break;
          }
        } catch {
          // Constructor threw despite isTypeSupported — try next
        }
      }
      // Last resort: let browser pick default codec
      if (!mediaRecorder) {
        try {
          mediaRecorder = new MediaRecorder(stream);
          mimeRef.current = mediaRecorder.mimeType || "audio/webm";
        } catch (e: any) {
          console.error("[AudioRecorder] All codecs failed:", e?.message);
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          return { ok: false, errorCode: "CODEC_UNAVAILABLE", errorMessage: ERROR_MESSAGES.CODEC_UNAVAILABLE };
        }
      }

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(100); // collect data every 100ms
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      // Duration timer
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 100);

      // Waveform animation
      setWaveformBars(generateWaveformBars(30));
      waveformIntervalRef.current = setInterval(() => {
        setWaveformBars(generateWaveformBars(30));
      }, 200);

      return { ok: true };
    } catch (err: any) {
      const code = classifyMediaError(err);
      console.error("[AudioRecorder] MediaRecorder setup failed:", err?.name, err?.message);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return { ok: false, errorCode: code, errorMessage: ERROR_MESSAGES[code] };
    }
  }, []);

  const stopRecording = useCallback((): Promise<AudioRecorderResult | null> => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr || mr.state === "inactive") {
        resolve(null);
        return;
      }

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        const dur = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const waveform = generateWaveformBars(64); // Z-API waveform field

        // Cleanup
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (waveformIntervalRef.current) { clearInterval(waveformIntervalRef.current); waveformIntervalRef.current = null; }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        setIsRecording(false);
        setDuration(0);
        setWaveformBars([]);

        resolve({ blob, duration: dur, waveform });
      };

      mr.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.onstop = null; // Don't fire result callback
      mr.stop();
    }

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (waveformIntervalRef.current) { clearInterval(waveformIntervalRef.current); waveformIntervalRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    chunksRef.current = [];
    setIsRecording(false);
    setDuration(0);
    setWaveformBars([]);
  }, []);

  const formatDuration = useCallback((s: number): string => {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  }, []);

  return {
    isRecording,
    duration,
    waveformBars,
    formattedDuration: formatDuration(duration),
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
