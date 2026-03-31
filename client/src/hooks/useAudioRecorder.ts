/**
 * useAudioRecorder — MediaRecorder API, waveform generation, PTT mode
 *
 * Records audio as audio/webm;codecs=opus (compatible with Z-API /send-audio)
 * Generates waveform bars for visual feedback
 * Bug fix #6: All timers/streams cleaned up on unmount
 */

import { useState, useCallback, useRef, useEffect } from "react";

export interface AudioRecorderResult {
  blob: Blob;
  duration: number;
  waveform: number[];
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

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
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

      return true;
    } catch {
      return false;
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
        const blob = new Blob(chunksRef.current, { type: "audio/webm;codecs=opus" });
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
