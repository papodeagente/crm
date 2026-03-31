/**
 * VoiceRecorder — MediaRecorder UI with timer and waveform bars
 * Extracted from WhatsAppChat.tsx lines 1048-1119
 * Uses the useAudioRecorder hook for recording logic
 */

import { useEffect } from "react";
import { X, Send } from "lucide-react";
import { toast } from "sonner";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

interface VoiceRecorderProps {
  onSend: (blob: Blob, duration: number) => void;
  onCancel: () => void;
}

export default function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const recorder = useAudioRecorder();

  // Start recording immediately on mount
  useEffect(() => {
    recorder.startRecording().then(success => {
      if (!success) {
        toast.error("Não foi possível acessar o microfone");
        onCancel();
      }
    });
  }, []);

  const handleSend = async () => {
    const result = await recorder.stopRecording();
    if (result) {
      onSend(result.blob, result.duration);
    }
  };

  const handleCancel = () => {
    recorder.cancelRecording();
    onCancel();
  };

  return (
    <div className="flex items-center gap-3 w-full px-4 py-2 bg-wa-input-bg rounded-lg">
      <button onClick={handleCancel} className="p-2 hover:bg-muted rounded-full transition-colors">
        <X className="w-5 h-5 text-destructive" />
      </button>
      <div className="flex-1 flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
        <span className="text-sm text-muted-foreground font-medium tabular-nums">{recorder.formattedDuration}</span>
        <div className="flex items-center gap-[2px] flex-1">
          {recorder.waveformBars.map((h, i) => (
            <div key={i} className="w-[3px] rounded-full bg-wa-tint transition-all duration-100" style={{ height: `${Math.max(4, (h / 100) * 24)}px` }} />
          ))}
        </div>
      </div>
      <button onClick={handleSend} className="p-2.5 bg-wa-tint hover:opacity-90 rounded-full transition-colors">
        <Send className="w-5 h-5 text-white" />
      </button>
    </div>
  );
}
