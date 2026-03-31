/**
 * MessageContextMenu — Reply, copy, edit, delete, forward, react
 * Extracted from WhatsAppChat.tsx lines 527-610
 */

import { useState, useRef, useEffect } from "react";
import { Smile, Reply, Forward, Copy, Pencil, Trash2 } from "lucide-react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import QuickReactionPicker from "./QuickReactionPicker";

interface Message {
  id: number;
  messageId?: string | null;
  fromMe: boolean;
  messageType: string;
  content: string | null;
}

interface MessageContextMenuProps {
  msg: Message;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onDelete: () => void;
  onEdit: () => void;
  onForward: () => void;
  onCopy: () => void;
  onClose: () => void;
}

export default function MessageContextMenu({
  msg, onReply, onReact, onDelete, onEdit, onForward, onCopy, onClose
}: MessageContextMenuProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const handleReaction = (emoji: string) => {
    if (emoji === "__picker__") {
      setShowFullPicker(true);
      setShowReactionPicker(false);
      return;
    }
    onReact(emoji);
  };

  const isTextMessage = msg.messageType === "conversation" || msg.messageType === "extendedTextMessage" || msg.messageType === "text";

  return (
    <div ref={menuRef} className={`absolute ${msg.fromMe ? "right-0" : "left-0"} top-0 z-50 flex flex-col items-end gap-1`}>
      {/* Quick reactions */}
      {showReactionPicker && !showFullPicker && (
        <QuickReactionPicker onSelect={handleReaction} />
      )}

      {/* Full emoji picker */}
      {showFullPicker && (
        <div className="absolute bottom-full mb-2 z-50">
          <Picker data={data} onEmojiSelect={(e: any) => { onReact(e.native); }} theme="light" previewPosition="none" skinTonePosition="none" locale="pt" />
        </div>
      )}

      {/* Context menu */}
      <div className="bg-card rounded-xl shadow-xl border border-border overflow-hidden min-w-[180px] animate-in fade-in slide-in-from-top-1 duration-150">
        <button onClick={() => { setShowReactionPicker(!showReactionPicker); setShowFullPicker(false); }}
          className="flex items-center gap-3 w-full px-3 py-2 hover:bg-muted transition-colors text-left text-sm">
          <Smile className="w-4 h-4 text-muted-foreground" /> Reagir
        </button>
        <button onClick={onReply}
          className="flex items-center gap-3 w-full px-3 py-2 hover:bg-muted transition-colors text-left text-sm">
          <Reply className="w-4 h-4 text-muted-foreground" /> Responder
        </button>
        <button onClick={onForward}
          className="flex items-center gap-3 w-full px-3 py-2 hover:bg-muted transition-colors text-left text-sm">
          <Forward className="w-4 h-4 text-muted-foreground" /> Encaminhar
        </button>
        {isTextMessage && msg.content && (
          <button onClick={onCopy}
            className="flex items-center gap-3 w-full px-3 py-2 hover:bg-muted transition-colors text-left text-sm">
            <Copy className="w-4 h-4 text-muted-foreground" /> Copiar
          </button>
        )}
        {msg.fromMe && isTextMessage && (
          <button onClick={onEdit}
            className="flex items-center gap-3 w-full px-3 py-2 hover:bg-muted transition-colors text-left text-sm">
            <Pencil className="w-4 h-4 text-muted-foreground" /> Editar
          </button>
        )}
        <button onClick={onDelete}
          className="flex items-center gap-3 w-full px-3 py-2 hover:bg-muted transition-colors text-left text-sm text-destructive">
          <Trash2 className="w-4 h-4" /> Apagar
        </button>
      </div>
    </div>
  );
}
