/**
 * QuickReactionPicker — 6 quick emoji reactions + full picker trigger
 * Extracted from WhatsAppChat.tsx lines 510-525
 */

import { Smile } from "lucide-react";

interface QuickReactionPickerProps {
  onSelect: (emoji: string) => void;
}

const quickEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function QuickReactionPicker({ onSelect }: QuickReactionPickerProps) {
  return (
    <div className="flex items-center gap-1 bg-card rounded-full shadow-xl border border-border px-2 py-1.5 animate-in fade-in zoom-in-95 duration-150">
      {quickEmojis.map((e) => (
        <button key={e} onClick={() => onSelect(e)} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-full transition-colors text-lg">
          {e}
        </button>
      ))}
      <button onClick={() => onSelect("__picker__")} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-full transition-colors">
        <Smile className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}
