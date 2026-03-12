import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { toast } from "sonner";
import {
  Check, CheckCheck, Clock, Download, File, Image as ImageIcon,
  Mic, MicOff, Paperclip, Pause, Phone, Play, Search, Send, Smile,
  Video, X, Camera, FileText, ArrowDown, Volume2, Loader2, ChevronDown,
  UserPlus, Briefcase, Users, Reply, Trash2, Pencil, Forward, MapPin,
  Contact, BarChart3, Copy, Ban
} from "lucide-react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

import { formatTime, SYSTEM_TIMEZONE, SYSTEM_LOCALE } from "../../../shared/dateUtils";

/* ─── Types ─── */
interface Message {
  id: number;
  sessionId: string;
  messageId?: string | null;
  remoteJid: string;
  fromMe: boolean;
  messageType: string;
  content: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  mediaDuration?: number | null;
  isVoiceNote?: boolean | null;
  status?: string | null;
  timestamp: string | Date;
  createdAt: string | Date;
  quotedMessageId?: string | null;
}

interface AssignmentInfo {
  assignedUserId?: number | null;
  assignedAgentName?: string | null;
  assignmentStatus?: string | null;
  assignmentPriority?: string | null;
}

interface AgentInfo {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
  status: string;
}

interface ReplyTarget {
  messageId: string;
  content: string;
  fromMe: boolean;
}

export interface WhatsAppChatProps {
  contact: { id: number; name: string; phone: string; email?: string; avatarUrl?: string } | null;
  sessionId: string;
  remoteJid: string;
  onCreateDeal?: () => void;
  onCreateContact?: () => void;
  hasCrmContact?: boolean;
  // Multi-agent
  assignment?: AssignmentInfo | null;
  agents?: AgentInfo[];
  onAssign?: (agentId: number | null) => void;
  onStatusChange?: (status: "open" | "pending" | "resolved" | "closed") => void;
}

/* ─── WhatsApp Text Formatting ─── */
function formatWhatsAppText(text: string): React.ReactNode {
  // Process WhatsApp formatting: *bold*, _italic_, ~strikethrough~, ```monospace```
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const patterns = [
    { regex: /\*([^*]+)\*/, tag: "b" },
    { regex: /_([^_]+)_/, tag: "i" },
    { regex: /~([^~]+)~/, tag: "s" },
    { regex: /```([^`]+)```/, tag: "code" },
  ];

  while (remaining.length > 0) {
    let earliest = -1;
    let earliestPattern: typeof patterns[0] | null = null;
    let earliestMatch: RegExpExecArray | null = null;

    for (const p of patterns) {
      const m = p.regex.exec(remaining);
      if (m && (earliest === -1 || m.index < earliest)) {
        earliest = m.index;
        earliestPattern = p;
        earliestMatch = m;
      }
    }

    if (!earliestMatch || !earliestPattern) {
      parts.push(remaining);
      break;
    }

    if (earliest > 0) parts.push(remaining.substring(0, earliest));

    const inner = earliestMatch[1];
    if (earliestPattern.tag === "b") parts.push(<strong key={key++}>{inner}</strong>);
    else if (earliestPattern.tag === "i") parts.push(<em key={key++}>{inner}</em>);
    else if (earliestPattern.tag === "s") parts.push(<s key={key++}>{inner}</s>);
    else if (earliestPattern.tag === "code") parts.push(<code key={key++} className="bg-foreground/10 px-1 py-0.5 rounded text-[13px] font-mono">{inner}</code>);

    remaining = remaining.substring(earliest + earliestMatch[0].length);
  }

  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>;
}

/* ─── Status Ticks ─── */
const MessageStatus = memo(({ status, isFromMe }: { status: string | null | undefined; isFromMe: boolean }) => {
  if (!isFromMe) return null;
  switch (status) {
    case "pending": return <Clock className="w-[13px] h-[13px] text-muted-foreground/60 inline-block ml-1" />;
    case "sent": return <Check className="w-[14px] h-[14px] text-muted-foreground/60 inline-block ml-1" />;
    case "delivered": return <CheckCheck className="w-[14px] h-[14px] text-muted-foreground/60 inline-block ml-1" />;
    case "read": case "played": return <CheckCheck className="w-[14px] h-[14px] text-wa-tint inline-block ml-1" />;
    default: return <Check className="w-[14px] h-[14px] text-muted-foreground/60 inline-block ml-1" />;
  }
});
MessageStatus.displayName = "MessageStatus";

/* ─── Audio Player ─── */
const AudioPlayer = memo(({ src, duration, isVoice }: { src: string; duration?: number | null; isVoice?: boolean }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => { if (audio.duration && isFinite(audio.duration)) setTotalDuration(audio.duration); };
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause(); else audio.play();
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const formatDur = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 hover:bg-foreground/15 transition-colors">
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="relative h-[5px] bg-foreground/10 rounded-full overflow-hidden">
          <div className="absolute left-0 top-0 h-full bg-current rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[10px] opacity-60 tabular-nums">
          {isPlaying ? formatDur(currentTime) : formatDur(totalDuration || 0)}
        </span>
      </div>
      {isVoice && (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Mic className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
});
AudioPlayer.displayName = "AudioPlayer";

/* ─── Media Loader (download on demand) ─── */
function MediaLoader({ sessionId, messageId, messageType, mediaDuration, isVoiceNote, mediaFileName, mediaMimeType }: {
  sessionId: string; messageId: string; messageType: string;
  mediaDuration?: number | null; isVoiceNote?: boolean | null;
  mediaFileName?: string | null; mediaMimeType?: string | null;
}) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const getMediaUrlMut = trpc.whatsapp.getMediaUrl.useMutation();

  const isAudio = ["audioMessage", "pttMessage"].includes(messageType);
  const isImage = messageType === "imageMessage";
  const isVideo = messageType === "videoMessage";
  const isDocument = messageType === "documentMessage";
  const isSticker = messageType === "stickerMessage";

  const handleLoad = useCallback(async () => {
    if (loading || mediaUrl) return;
    setLoading(true);
    setError(false);
    try {
      const result = await getMediaUrlMut.mutateAsync({ sessionId, messageId });
      setMediaUrl(result.url);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [sessionId, messageId, loading, mediaUrl]);

  // Auto-load for audio messages
  useEffect(() => {
    if (isAudio && !mediaUrl && !loading && !error) {
      handleLoad();
    }
  }, [isAudio]);

  if (mediaUrl) {
    if (isAudio) return <AudioPlayer src={mediaUrl} duration={mediaDuration} isVoice={isVoiceNote || false} />;
    if (isImage) return (
      <div className="relative -mx-1 -mt-0.5 mb-1 overflow-hidden rounded-md">
        <img src={mediaUrl} alt="Imagem" className="max-w-[300px] w-full h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity" loading="lazy" onClick={() => window.open(mediaUrl, "_blank")} />
      </div>
    );
    if (isVideo) return (
      <div className="relative -mx-1 -mt-0.5 mb-1 overflow-hidden rounded-md">
        <video src={mediaUrl} controls className="max-w-[300px] w-full h-auto rounded-md" preload="metadata" />
      </div>
    );
    if (isDocument) return (
      <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 -mx-0.5 rounded-md bg-foreground/5 hover:bg-foreground/10 transition-colors mb-1">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-white" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{mediaFileName || "Documento"}</p>
          <p className="text-[11px] text-muted-foreground">{mediaMimeType || "Arquivo"}</p>
        </div>
        <Download className="w-4 h-4 text-muted-foreground shrink-0" />
      </a>
    );
    if (isSticker) return <img src={mediaUrl} alt="Sticker" className="w-32 h-32 object-contain" loading="lazy" />;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2 -mx-0.5 rounded-md bg-foreground/5 mb-1 min-w-[200px]">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Carregando mídia...</span>
      </div>
    );
  }

  if (error) {
    return (
      <button onClick={handleLoad} className="flex items-center gap-2 p-2 -mx-0.5 rounded-md bg-foreground/5 hover:bg-foreground/10 transition-colors mb-1 min-w-[200px]">
        <Download className="w-5 h-5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Mídia indisponível. Toque para tentar novamente.</span>
      </button>
    );
  }

  return (
    <button onClick={handleLoad} className="flex items-center gap-2 p-2 -mx-0.5 rounded-md bg-foreground/5 hover:bg-foreground/10 transition-colors mb-1 min-w-[200px]">
      <Download className="w-5 h-5 text-wa-tint" />
      <span className="text-xs text-muted-foreground">
        {isAudio ? `🎤 Áudio${mediaDuration ? ` (${Math.floor(mediaDuration / 60)}:${(mediaDuration % 60).toString().padStart(2, "0")})` : ""}` :
         isImage ? "🖼️ Imagem" : isVideo ? "🎥 Vídeo" : isDocument ? `📄 ${mediaFileName || "Documento"}` : "📎 Mídia"}
        {" "}— Toque para carregar
      </span>
    </button>
  );
}

/* ─── Reaction Picker (Quick Emojis) ─── */
function QuickReactionPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const quickEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
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

/* ─── Message Context Menu ─── */
function MessageContextMenu({
  msg, onReply, onReact, onDelete, onEdit, onForward, onCopy, onClose
}: {
  msg: Message;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onDelete: () => void;
  onEdit: () => void;
  onForward: () => void;
  onCopy: () => void;
  onClose: () => void;
}) {
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

/* ─── Message Bubble ─── */
const MessageBubble = memo(({
  msg, isFirst, isLast, allMessages,
  onReply, onReact, onDelete, onEdit, onForward
}: {
  msg: Message; isFirst: boolean; isLast: boolean; allMessages: Message[];
  onReply: (target: ReplyTarget) => void;
  onReact: (key: { remoteJid: string; fromMe: boolean; id: string }, emoji: string) => void;
  onDelete: (remoteJid: string, messageId: string, fromMe: boolean) => void;
  onEdit: (messageId: string, currentText: string) => void;
  onForward: (msg: Message) => void;
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const fromMe = msg.fromMe;
  const time = formatTime(msg.timestamp || msg.createdAt);

  const isImage = msg.messageType === "imageMessage" || msg.messageType === "image" || msg.mediaMimeType?.startsWith("image/");
  const isVideo = msg.messageType === "videoMessage" || msg.messageType === "video" || msg.mediaMimeType?.startsWith("video/");
  const isAudio = msg.messageType === "audioMessage" || msg.messageType === "audio" || msg.mediaMimeType?.startsWith("audio/");
  const isDocument = msg.messageType === "documentMessage" || msg.messageType === "document";
  const isSticker = msg.messageType === "stickerMessage";
  const isLocation = msg.messageType === "locationMessage";
  const isContact = msg.messageType === "contactMessage" || msg.messageType === "contactsArrayMessage";
  const isPoll = msg.messageType === "pollCreationMessage";
  const hasMedia = !!msg.mediaUrl;

  const bubbleBase = fromMe
    ? "bg-wa-bubble-out text-foreground"
    : "bg-wa-bubble-in text-foreground";

  const bubbleRadius = fromMe
    ? `rounded-[7.5px] ${isFirst ? "rounded-tr-none" : ""}`
    : `rounded-[7.5px] ${isFirst ? "rounded-tl-none" : ""}`;

  // Find quoted message
  const quotedMsg = msg.quotedMessageId
    ? allMessages.find(m => m.messageId === msg.quotedMessageId)
    : null;

  const renderQuotedMessage = () => {
    if (!quotedMsg) return null;
    const quotedContent = quotedMsg.content || (quotedMsg.mediaUrl ? "[Mídia]" : "");
    return (
      <div className="bg-foreground/5 border-l-4 border-wa-tint rounded-md px-2.5 py-1.5 mb-1 -mx-0.5 cursor-pointer hover:bg-foreground/8 transition-colors">
        <p className="text-[11px] font-semibold text-wa-tint">{quotedMsg.fromMe ? "Você" : "Contato"}</p>
        <p className="text-[12px] text-muted-foreground truncate max-w-[250px]">{quotedContent}</p>
      </div>
    );
  };

  const renderMedia = () => {
    if (isLocation && msg.content) {
      // Parse location from content
      try {
        const loc = JSON.parse(msg.content);
        return (
          <div className="relative -mx-1 -mt-0.5 mb-1 overflow-hidden rounded-md">
            <a href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`} target="_blank" rel="noopener noreferrer"
              className="block bg-muted p-3 hover:bg-muted/80 transition-colors">
              <MapPin className="w-5 h-5 text-destructive mb-1" />
              <p className="text-sm font-medium">{loc.name || "Localização"}</p>
              {loc.address && <p className="text-xs text-muted-foreground">{loc.address}</p>}
            </a>
          </div>
        );
      } catch { /* not JSON location */ }
    }

    if (isContact && msg.content) {
      return (
        <div className="flex items-center gap-2 p-2 -mx-0.5 rounded-md bg-foreground/5 mb-1">
          <Contact className="w-8 h-8 text-wa-tint" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{msg.content}</p>
            <p className="text-[11px] text-muted-foreground">Contato</p>
          </div>
        </div>
      );
    }

    if (isPoll && msg.content) {
      return (
        <div className="p-2 -mx-0.5 rounded-md bg-foreground/5 mb-1">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-wa-tint" />
            <p className="text-sm font-medium">Enquete</p>
          </div>
          <p className="text-[13px]">{msg.content}</p>
        </div>
      );
    }

    if (!hasMedia) return null;

    if (isImage && msg.mediaUrl) {
      return (
        <div className="relative -mx-1 -mt-0.5 mb-1 overflow-hidden rounded-md">
          <img src={msg.mediaUrl} alt="Imagem" className="max-w-[300px] w-full h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity" loading="lazy" onClick={() => window.open(msg.mediaUrl!, "_blank")} />
        </div>
      );
    }
    if (isVideo && msg.mediaUrl) {
      return (
        <div className="relative -mx-1 -mt-0.5 mb-1 overflow-hidden rounded-md">
          <video src={msg.mediaUrl} controls className="max-w-[300px] w-full h-auto rounded-md" preload="metadata" />
        </div>
      );
    }
    if (isAudio && msg.mediaUrl) {
      return <AudioPlayer src={msg.mediaUrl} duration={msg.mediaDuration} isVoice={msg.isVoiceNote || false} />;
    }
    if (isDocument && msg.mediaUrl) {
      return (
        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 -mx-0.5 rounded-md bg-foreground/5 hover:bg-foreground/10 transition-colors mb-1">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{msg.mediaFileName || "Documento"}</p>
            <p className="text-[11px] text-muted-foreground">{msg.mediaMimeType || "Arquivo"}</p>
          </div>
          <Download className="w-4 h-4 text-muted-foreground shrink-0" />
        </a>
      );
    }
    if (isSticker && msg.mediaUrl) {
      return <img src={msg.mediaUrl} alt="Sticker" className="w-32 h-32 object-contain" loading="lazy" />;
    }
    // Fallback: media message without URL - offer to download on demand
    if (hasMedia && !msg.mediaUrl && msg.messageId) {
      return <MediaLoader sessionId={msg.sessionId} messageId={msg.messageId} messageType={msg.messageType}
        mediaDuration={msg.mediaDuration} isVoiceNote={msg.isVoiceNote} mediaFileName={msg.mediaFileName} mediaMimeType={msg.mediaMimeType} />;
    }
    return null;
  };

  const textContent = msg.content && !msg.content.startsWith("[") && !isLocation && !isContact && !isPoll
    ? msg.content
    : (isImage || isVideo || isAudio || isDocument || isSticker || isLocation || isContact || isPoll) ? null : msg.content;

  return (
    <div className={`group flex ${fromMe ? "justify-end" : "justify-start"} px-[63px] mb-[2px] ${isFirst ? "mt-[12px]" : ""}`}>
      <div className="relative max-w-[65%]">
        {/* Hover action button */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`absolute top-1 ${fromMe ? "left-0 -translate-x-full -ml-1" : "right-0 translate-x-full ml-1"} w-7 h-7 rounded-full bg-card/80 shadow border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-card`}
        >
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {/* Context menu */}
        {showMenu && msg.messageId && (
          <MessageContextMenu
            msg={msg}
            onReply={() => {
              onReply({ messageId: msg.messageId!, content: msg.content || "[Mídia]", fromMe: msg.fromMe });
              setShowMenu(false);
            }}
            onReact={(emoji) => {
              onReact({ remoteJid: msg.remoteJid, fromMe: msg.fromMe, id: msg.messageId! }, emoji);
              setShowMenu(false);
            }}
            onDelete={() => {
              onDelete(msg.remoteJid, msg.messageId!, msg.fromMe);
              setShowMenu(false);
            }}
            onEdit={() => {
              onEdit(msg.messageId!, msg.content || "");
              setShowMenu(false);
            }}
            onForward={() => {
              onForward(msg);
              setShowMenu(false);
            }}
            onCopy={() => {
              if (msg.content) navigator.clipboard.writeText(msg.content);
              toast.success("Copiado");
              setShowMenu(false);
            }}
            onClose={() => setShowMenu(false)}
          />
        )}

        <div className={`relative px-[9px] pt-[6px] pb-[8px] shadow-sm ${bubbleBase} ${bubbleRadius}`} style={{ minWidth: "80px" }}>
          {/* Tail SVG */}
          {isFirst && (
            <div className={`absolute top-0 w-[8px] h-[13px] ${fromMe ? "-right-[8px]" : "-left-[8px]"}`}>
              <svg viewBox="0 0 8 13" width="8" height="13">
                {fromMe ? (
                  <path className="fill-wa-bubble-out" d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
                ) : (
                  <path className="fill-wa-bubble-in" d="M2.812 1H8v11.193L1.533 3.568C.474 2.156 1.042 1 2.812 1z" />
                )}
              </svg>
            </div>
          )}

          {renderQuotedMessage()}
          {renderMedia()}

          {textContent && (
            <span className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">{formatWhatsAppText(textContent)}</span>
          )}

          {/* Time + Status */}
          <span className="float-right ml-2 mt-[3px] flex items-center gap-0.5 relative -bottom-0.5">
            <span className="text-[11px] text-muted-foreground/70 leading-none tabular-nums">{time}</span>
            <MessageStatus status={msg.status} isFromMe={fromMe} />
          </span>
        </div>
      </div>
    </div>
  );
});
MessageBubble.displayName = "MessageBubble";

/* ─── Date Separator ─── */
const DateSeparator = memo(({ date }: { date: string }) => (
  <div className="flex justify-center my-[12px]">
    <span className="bg-wa-bubble-in text-muted-foreground text-[12.5px] px-3 py-[5px] rounded-[7.5px] shadow-sm font-medium">
      {date}
    </span>
  </div>
));
DateSeparator.displayName = "DateSeparator";

/* ─── Attach Menu ─── */
function AttachMenu({ onSelect, onClose }: { onSelect: (type: string) => void; onClose: () => void }) {
  const items = [
    { type: "image", icon: ImageIcon, label: "Fotos e Vídeos", color: "oklch(0.60 0.20 320)" },
    { type: "camera", icon: Camera, label: "Câmera", color: "oklch(0.55 0.20 350)" },
    { type: "document", icon: FileText, label: "Documento", color: "oklch(0.50 0.20 280)" },
    { type: "location", icon: MapPin, label: "Localização", color: "oklch(0.55 0.18 145)" },
    { type: "contact", icon: Contact, label: "Contato", color: "oklch(0.55 0.15 250)" },
    { type: "poll", icon: BarChart3, label: "Enquete", color: "oklch(0.55 0.18 60)" },
  ];

  return (
    <div className="absolute bottom-full left-0 mb-2 bg-card rounded-xl shadow-xl border border-border overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-150">
      {items.map((item) => (
        <button key={item.type} onClick={() => { onSelect(item.type); onClose(); }}
          className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted transition-colors text-left">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: item.color }}>
            <item.icon className="w-[18px] h-[18px] text-white" />
          </div>
          <span className="text-[14px] text-foreground/80">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── Voice Recorder ─── */
function VoiceRecorder({ onSend, onCancel }: { onSend: (blob: Blob, duration: number) => void; onCancel: () => void }) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startRecording = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mediaRecorder.start(100);
        startTimeRef.current = Date.now();
        timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000)), 100);
      } catch {
        toast.error("Não foi possível acessar o microfone");
        onCancel();
      }
    };
    startRecording();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleSend = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm;codecs=opus" });
      onSend(blob, Math.floor((Date.now() - startTimeRef.current) / 1000));
    };
    mr.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, [onSend]);

  const handleCancel = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    onCancel();
  }, [onCancel]);

  const formatDur = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-3 w-full px-4 py-2 bg-wa-input-bg rounded-lg">
      <button onClick={handleCancel} className="p-2 hover:bg-muted rounded-full transition-colors">
        <X className="w-5 h-5 text-destructive" />
      </button>
      <div className="flex-1 flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
        <span className="text-sm text-muted-foreground font-medium tabular-nums">{formatDur(duration)}</span>
        <div className="flex items-center gap-[2px] flex-1">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="w-[3px] rounded-full bg-wa-tint transition-all duration-100" style={{ height: `${Math.random() * 20 + 4}px` }} />
          ))}
        </div>
      </div>
      <button onClick={handleSend} className="p-2.5 bg-wa-tint hover:opacity-90 rounded-full transition-colors">
        <Send className="w-5 h-5 text-white" />
      </button>
    </div>
  );
}

/* ─── Location Modal ─── */
function LocationModal({ onSend, onClose }: { onSend: (lat: number, lng: number, name: string, address: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl border border-border w-[400px] max-w-[90vw] p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-wa-tint" /> Enviar Localização
        </h3>
        <div className="space-y-3">
          <input type="text" placeholder="Nome do local" value={name} onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
          <input type="text" placeholder="Endereço" value={address} onChange={e => setAddress(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
          <div className="flex gap-2">
            <input type="text" placeholder="Latitude" value={lat} onChange={e => setLat(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
            <input type="text" placeholder="Longitude" value={lng} onChange={e => setLng(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors">Cancelar</button>
          <button onClick={() => { if (lat && lng && name) { onSend(parseFloat(lat), parseFloat(lng), name, address); onClose(); } else toast.error("Preencha latitude, longitude e nome"); }}
            className="px-4 py-2 text-sm bg-wa-tint text-white rounded-lg hover:opacity-90 transition-colors">Enviar</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Contact Modal ─── */
function ContactModal({ onSend, onClose }: { onSend: (contacts: Array<{ fullName: string; phoneNumber: string }>) => void; onClose: () => void }) {
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl border border-border w-[400px] max-w-[90vw] p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Contact className="w-5 h-5 text-wa-tint" /> Enviar Contato
        </h3>
        <div className="space-y-3">
          <input type="text" placeholder="Nome completo" value={fullName} onChange={e => setFullName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
          <input type="text" placeholder="Número de telefone (ex: 5511999999999)" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors">Cancelar</button>
          <button onClick={() => { if (fullName && phoneNumber) { onSend([{ fullName, phoneNumber }]); onClose(); } else toast.error("Preencha nome e telefone"); }}
            className="px-4 py-2 text-sm bg-wa-tint text-white rounded-lg hover:opacity-90 transition-colors">Enviar</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Poll Modal ─── */
function PollModal({ onSend, onClose }: { onSend: (name: string, values: string[], selectableCount: number) => void; onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiSelect, setMultiSelect] = useState(false);

  const addOption = () => { if (options.length < 12) setOptions([...options, ""]); };
  const updateOption = (i: number, v: string) => { const o = [...options]; o[i] = v; setOptions(o); };
  const removeOption = (i: number) => { if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i)); };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl border border-border w-[420px] max-w-[90vw] p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-wa-tint" /> Criar Enquete
        </h3>
        <div className="space-y-3">
          <input type="text" placeholder="Pergunta da enquete" value={question} onChange={e => setQuestion(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" placeholder={`Opção ${i + 1}`} value={opt} onChange={e => updateOption(i, e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
                {options.length > 2 && (
                  <button onClick={() => removeOption(i)} className="p-1 hover:bg-muted rounded transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            ))}
            {options.length < 12 && (
              <button onClick={addOption} className="text-sm text-wa-tint hover:underline">+ Adicionar opção</button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={multiSelect} onChange={e => setMultiSelect(e.target.checked)} className="rounded" />
            Permitir múltiplas respostas
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors">Cancelar</button>
          <button onClick={() => {
            const validOpts = options.filter(o => o.trim());
            if (question.trim() && validOpts.length >= 2) {
              onSend(question.trim(), validOpts, multiSelect ? validOpts.length : 1);
              onClose();
            } else toast.error("Preencha a pergunta e pelo menos 2 opções");
          }}
            className="px-4 py-2 text-sm bg-wa-tint text-white rounded-lg hover:opacity-90 transition-colors">Criar</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Message Modal ─── */
function EditMessageModal({ currentText, onSave, onClose }: { currentText: string; onSave: (newText: string) => void; onClose: () => void }) {
  const [text, setText] = useState(currentText);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl border border-border w-[400px] max-w-[90vw] p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Pencil className="w-5 h-5 text-wa-tint" /> Editar Mensagem
        </h3>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint resize-none" />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors">Cancelar</button>
          <button onClick={() => { if (text.trim()) { onSave(text.trim()); onClose(); } }}
            className="px-4 py-2 text-sm bg-wa-tint text-white rounded-lg hover:opacity-90 transition-colors">Salvar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN CHAT COMPONENT
   ═══════════════════════════════════════════════════════ */

export default function WhatsAppChat({ contact, sessionId, remoteJid, onCreateDeal, onCreateContact, hasCrmContact, assignment, agents, onAssign, onStatusChange }: WhatsAppChatProps) {
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const { lastMessage, lastStatusUpdate } = useSocket();
  const [messageText, setMessageText] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [localStatusUpdates, setLocalStatusUpdates] = useState<Record<string, string>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [editTarget, setEditTarget] = useState<{ messageId: string; text: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const presenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Queries
  const messagesQ = trpc.whatsapp.messagesByContact.useQuery(
    { sessionId, remoteJid, limit: 100 },
    { enabled: !!sessionId && !!remoteJid, refetchInterval: 8000 }
  );

  const utils = trpc.useUtils();

  // Optimistic update helper: add message to cache immediately
  const addOptimisticMessage = useCallback((text: string, quotedId?: string | null) => {
    const queryKey = { sessionId, remoteJid, limit: 100 };
    const optimistic: Message = {
      id: -Date.now(), // negative ID to avoid collision
      sessionId,
      messageId: `opt_${Date.now()}`,
      remoteJid,
      fromMe: true,
      messageType: "conversation",
      content: text,
      status: "pending",
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      quotedMessageId: quotedId || null,
    };
    utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
      if (!old) return [optimistic];
      return [optimistic, ...old];
    });
    // Scroll to bottom
    setTimeout(() => {
      const el = document.querySelector('[data-chat-scroll]');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }, [sessionId, remoteJid, utils]);

  const sendMessage = trpc.whatsapp.sendMessage.useMutation({
    onMutate: (vars) => addOptimisticMessage(vars.message),
    onSuccess: () => messagesQ.refetch(),
    onError: () => { messagesQ.refetch(); toast.error("Erro ao enviar mensagem"); },
  });

  const sendTextWithQuote = trpc.whatsapp.sendTextWithQuote.useMutation({
    onMutate: (vars) => addOptimisticMessage(vars.message, vars.quotedMessageId),
    onSuccess: () => { messagesQ.refetch(); setReplyTarget(null); },
    onError: () => { messagesQ.refetch(); toast.error("Erro ao enviar resposta"); },
  });

  const uploadMedia = trpc.whatsapp.uploadMedia.useMutation();
  const sendMedia = trpc.whatsapp.sendMedia.useMutation({
    onSuccess: () => messagesQ.refetch(),
    onError: () => toast.error("Erro ao enviar mídia"),
  });

  const sendReaction = trpc.whatsapp.sendReaction.useMutation({
    onSuccess: () => toast.success("Reação enviada"),
    onError: () => toast.error("Erro ao enviar reação"),
  });

  const deleteMessage = trpc.whatsapp.deleteMessage.useMutation({
    onSuccess: () => { messagesQ.refetch(); toast.success("Mensagem apagada"); },
    onError: () => toast.error("Erro ao apagar mensagem"),
  });

  const editMessage = trpc.whatsapp.editMessage.useMutation({
    onSuccess: () => { messagesQ.refetch(); toast.success("Mensagem editada"); },
    onError: () => toast.error("Erro ao editar mensagem"),
  });

  const sendPresenceMut = trpc.whatsapp.sendPresence.useMutation();

  const sendLocationMut = trpc.whatsapp.sendLocation.useMutation({
    onSuccess: () => { messagesQ.refetch(); toast.success("Localização enviada"); },
    onError: () => toast.error("Erro ao enviar localização"),
  });

  const sendContactMut = trpc.whatsapp.sendContact.useMutation({
    onSuccess: () => { messagesQ.refetch(); toast.success("Contato enviado"); },
    onError: () => toast.error("Erro ao enviar contato"),
  });

  const sendPollMut = trpc.whatsapp.sendPoll.useMutation({
    onSuccess: () => { messagesQ.refetch(); toast.success("Enquete enviada"); },
    onError: () => toast.error("Erro ao enviar enquete"),
  });

  // ─── Notification sound ───
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    notificationAudioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgkKuunWI2M1qIo6CWYDg1WIWdmpOBPDhXhZqXkYA+OFeFmZaQgD84V4WZlpCAPzhXhZmWkIA/OFeFmZaQgD84V4WZlpCAPzhX");
  }, []);

  // ─── Sound on new message ───
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (!messagesQ.data) return;
    const currentCount = messagesQ.data.length;
    if (prevMsgCountRef.current > 0 && currentCount > prevMsgCountRef.current) {
      const lastMsg = messagesQ.data[0]; // newest first
      if (lastMsg && !lastMsg.fromMe) {
        notificationAudioRef.current?.play().catch(() => {});
      }
    }
    prevMsgCountRef.current = currentCount;
  }, [messagesQ.data?.length]);

  // ─── Presence: send "composing" while typing ───
  const sendPresenceComposing = useCallback(() => {
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number || !sessionId) return;
    sendPresenceMut.mutate({ sessionId, number, presence: "composing" });
  }, [sessionId, contact]);

  const sendPresencePaused = useCallback(() => {
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number || !sessionId) return;
    sendPresenceMut.mutate({ sessionId, number, presence: "paused" });
  }, [sessionId, contact]);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPicker]);

  // Scroll
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) scrollToBottom(true);
  }, [messagesQ.data, lastMessage]);

  useEffect(() => {
    if (lastMessage && lastMessage.remoteJid === remoteJid) messagesQ.refetch();
  }, [lastMessage, remoteJid]);

  // Update message status in real-time via socket
  useEffect(() => {
    if (lastStatusUpdate && lastStatusUpdate.messageId) {
      setLocalStatusUpdates(prev => ({
        ...prev,
        [lastStatusUpdate.messageId]: lastStatusUpdate.status,
      }));
    }
  }, [lastStatusUpdate]);

  // Clear local status updates when messages are refetched from server
  useEffect(() => {
    if (messagesQ.data) setLocalStatusUpdates({});
  }, [messagesQ.dataUpdatedAt]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      setShowScrollBtn(!isNearBottom);
    };
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (messagesQ.data && messagesQ.data.length > 0) {
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [messagesQ.data?.length]);

  // Send text (with or without reply)
  const handleSend = useCallback(() => {
    if (!messageText.trim() || isSending) return;
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;

    if (replyTarget) {
      sendTextWithQuote.mutate({
        sessionId, number,
        message: messageText.trim(),
        quotedMessageId: replyTarget.messageId,
        quotedText: replyTarget.content,
      });
    } else {
      sendMessage.mutate({ sessionId, number, message: messageText.trim() });
    }
    setMessageText("");
    setReplyTarget(null);
    if (textareaRef.current) textareaRef.current.style.height = "42px";
    // Send paused presence
    sendPresencePaused();
  }, [messageText, sessionId, contact, isSending, replyTarget]);

  // File uploads
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;
    for (const file of Array.from(files)) {
      setIsSending(true);
      try {
        const base64 = await fileToBase64(file);
        const { url } = await uploadMedia.mutateAsync({ fileName: file.name, fileBase64: base64, contentType: file.type });
        let mediaType: "image" | "video" | "document" = "document";
        if (file.type.startsWith("image/")) mediaType = "image";
        else if (file.type.startsWith("video/")) mediaType = "video";
        await sendMedia.mutateAsync({ sessionId, number, mediaUrl: url, mediaType, fileName: file.name, mimetype: file.type });
        toast.success("Mídia enviada");
      } catch { toast.error("Erro ao enviar arquivo"); }
      finally { setIsSending(false); }
    }
    e.target.value = "";
  }, [sessionId, contact]);

  const handleDocSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;
    for (const file of Array.from(files)) {
      setIsSending(true);
      try {
        const base64 = await fileToBase64(file);
        const { url } = await uploadMedia.mutateAsync({ fileName: file.name, fileBase64: base64, contentType: file.type });
        await sendMedia.mutateAsync({ sessionId, number, mediaUrl: url, mediaType: "document", fileName: file.name, mimetype: file.type });
        toast.success("Documento enviado");
      } catch { toast.error("Erro ao enviar documento"); }
      finally { setIsSending(false); }
    }
    e.target.value = "";
  }, [sessionId, contact]);

  // Voice
  const handleVoiceSend = useCallback(async (blob: Blob, duration: number) => {
    setIsRecording(false);
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;
    setIsSending(true);
    try {
      const base64 = await blobToBase64(blob);
      const { url } = await uploadMedia.mutateAsync({ fileName: `voice-${Date.now()}.webm`, fileBase64: base64, contentType: "audio/webm;codecs=opus" });
      await sendMedia.mutateAsync({ sessionId, number, mediaUrl: url, mediaType: "audio", ptt: true, mimetype: "audio/ogg; codecs=opus", duration });
      toast.success("Áudio enviado");
    } catch { toast.error("Erro ao enviar áudio"); }
    finally { setIsSending(false); }
  }, [sessionId, contact]);

  const handleAttachSelect = useCallback((type: string) => {
    if (type === "image" || type === "camera") fileInputRef.current?.click();
    else if (type === "document") docInputRef.current?.click();
    else if (type === "location") setShowLocationModal(true);
    else if (type === "contact") setShowContactModal(true);
    else if (type === "poll") setShowPollModal(true);
  }, []);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    const el = e.target;
    el.style.height = "42px";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";

    // Send composing presence (debounced)
    if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
    sendPresenceComposing();
    presenceTimerRef.current = setTimeout(() => sendPresencePaused(), 3000);
  }, [sendPresenceComposing, sendPresencePaused]);

  // Emoji select
  const handleEmojiSelect = useCallback((emoji: any) => {
    setMessageText(prev => prev + emoji.native);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  }, []);

  // Reaction handler
  const handleReact = useCallback((key: { remoteJid: string; fromMe: boolean; id: string }, emoji: string) => {
    sendReaction.mutate({ sessionId, key, reaction: emoji });
  }, [sessionId]);

  // Delete handler
  const handleDelete = useCallback((rJid: string, messageId: string, fromMe: boolean) => {
    if (confirm("Apagar esta mensagem para todos?")) {
      deleteMessage.mutate({ sessionId, remoteJid: rJid, messageId, fromMe });
    }
  }, [sessionId]);

  // Edit handler
  const handleEditStart = useCallback((messageId: string, currentText: string) => {
    setEditTarget({ messageId, text: currentText });
  }, []);

  const handleEditSave = useCallback((newText: string) => {
    if (!editTarget) return;
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;
    editMessage.mutate({ sessionId, number, messageId: editTarget.messageId, newText });
    setEditTarget(null);
  }, [editTarget, sessionId, contact]);

  // Forward handler
  const handleForward = useCallback((msg: Message) => {
    // Copy content to clipboard and show toast
    const content = msg.content || msg.mediaUrl || "";
    navigator.clipboard.writeText(content);
    toast.success("Conteúdo copiado. Cole em outra conversa para encaminhar.");
  }, []);

  // Location send
  const handleLocationSend = useCallback((lat: number, lng: number, name: string, address: string) => {
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;
    sendLocationMut.mutate({ sessionId, number, latitude: lat, longitude: lng, name, address });
  }, [sessionId, contact]);

  // Contact send
  const handleContactSend = useCallback((contacts: Array<{ fullName: string; phoneNumber: string }>) => {
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;
    sendContactMut.mutate({ sessionId, number, contacts });
  }, [sessionId, contact]);

  // Poll send
  const handlePollSend = useCallback((name: string, values: string[], selectableCount: number) => {
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;
    sendPollMut.mutate({ sessionId, number, name, values, selectableCount });
  }, [sessionId, contact]);

  // Filter out protocol/system messages that should not render as chat bubbles
  const HIDDEN_MSG_TYPES = new Set([
    "protocolMessage", "senderKeyDistributionMessage", "messageContextInfo",
    "ephemeralMessage", "reactionMessage", "associatedChildMessage",
    "placeholderMessage", "albumMessage",
  ]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const msgs = [...(messagesQ.data || [])].reverse()
      .filter(m => !HIDDEN_MSG_TYPES.has(m.messageType));
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";
    for (const msg of msgs) {
      const d = new Date(msg.timestamp || msg.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      let label = d.toLocaleDateString(SYSTEM_LOCALE, { day: "2-digit", month: "long", year: "numeric", timeZone: SYSTEM_TIMEZONE });
      if (d.toDateString() === today.toDateString()) label = "Hoje";
      else if (d.toDateString() === yesterday.toDateString()) label = "Ontem";
      if (label !== currentDate) {
        currentDate = label;
        groups.push({ date: label, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    }
    return groups;
  }, [messagesQ.data]);

  // Flat messages for quote lookup
  const allMessages = useMemo(() => {
    return [...(messagesQ.data || [])].reverse();
  }, [messagesQ.data]);

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3 px-4 h-[59px] shrink-0 bg-wa-panel-header border-b border-wa-divider z-10">
        <div className="w-[40px] h-[40px] rounded-full bg-muted shrink-0 overflow-hidden">
          {contact?.avatarUrl ? (
            <img src={contact.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg viewBox="0 0 212 212" width="40" height="40">
              <path className="fill-muted" d="M106 0C47.5 0 0 47.5 0 106s47.5 106 106 106 106-47.5 106-106S164.5 0 106 0z" />
              <path className="fill-muted-foreground/30" d="M106 45c-20.7 0-37.5 16.8-37.5 37.5S85.3 120 106 120s37.5-16.8 37.5-37.5S126.7 45 106 45zm0 105c-28.3 0-52.5 14.3-52.5 32v10h105v-10c0-17.7-24.2-32-52.5-32z" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-medium text-foreground truncate leading-[21px]">{contact?.name || "Contato"}</p>
          <p className="text-[13px] text-muted-foreground truncate leading-[18px]">{contact?.phone || ""}</p>
        </div>
        <div className="flex items-center gap-0.5">
          {/* Assignment badge */}
          {assignment && (
            <div className="relative">
              <button
                onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-full transition-all mr-1 ${
                  assignment.assignedAgentName
                    ? "bg-wa-tint/10 text-wa-tint hover:bg-wa-tint/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                title={assignment.assignedAgentName ? `Atribuído a ${assignment.assignedAgentName}` : "Sem agente atribuído"}
              >
                <Users className="w-[14px] h-[14px]" />
                <span className="hidden sm:inline max-w-[80px] truncate">
                  {assignment.assignedAgentName || "Atribuir"}
                </span>
                <ChevronDown className="w-[12px] h-[12px]" />
              </button>
              {/* Agent assignment dropdown */}
              {showAgentDropdown && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Atribuir a</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      onClick={() => { onAssign?.(null); setShowAgentDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-sm text-muted-foreground">Remover atribuição</span>
                    </button>
                    {(agents || []).map(agent => (
                      <button
                        key={agent.id}
                        onClick={() => { onAssign?.(agent.id); setShowAgentDropdown(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors text-left ${
                          assignment.assignedUserId === agent.id ? "bg-wa-tint/5" : ""
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-wa-tint/15 flex items-center justify-center overflow-hidden shrink-0">
                          {agent.avatarUrl ? (
                            <img src={agent.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-wa-tint">
                              {agent.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground truncate">{agent.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{agent.email}</p>
                        </div>
                        {assignment.assignedUserId === agent.id && (
                          <Check className="w-4 h-4 text-wa-tint shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  {/* Status section */}
                  <div className="border-t border-border px-3 py-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                    <div className="flex flex-wrap gap-1">
                      {(["open", "pending", "resolved", "closed"] as const).map(s => {
                        const statusLabels: Record<string, string> = { open: "Aberto", pending: "Pendente", resolved: "Resolvido", closed: "Fechado" };
                        const statusColors: Record<string, string> = { open: "bg-blue-500/10 text-blue-600", pending: "bg-yellow-500/10 text-yellow-600", resolved: "bg-green-500/10 text-green-600", closed: "bg-muted text-muted-foreground" };
                        return (
                          <button
                            key={s}
                            onClick={() => { onStatusChange?.(s); setShowAgentDropdown(false); }}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                              assignment.assignmentStatus === s
                                ? statusColors[s] + " ring-1 ring-current/20"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {statusLabels[s]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {onCreateContact && !hasCrmContact && (
            <button onClick={onCreateContact}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-wa-tint hover:opacity-90 text-white text-xs font-medium rounded-full transition-all mr-1"
              title="Criar contato no CRM">
              <UserPlus className="w-[14px] h-[14px]" />
              <span className="hidden sm:inline">Criar Contato</span>
            </button>
          )}
          {onCreateDeal && (
            <button onClick={onCreateDeal}
              className="w-[34px] h-[34px] flex items-center justify-center hover:bg-wa-hover rounded-full transition-colors"
              title="Criar negociação">
              <Briefcase className="w-[18px] h-[18px] text-muted-foreground" />
            </button>
          )}
          <button className="w-[34px] h-[34px] flex items-center justify-center hover:bg-wa-hover rounded-full transition-colors">
            <Search className="w-[18px] h-[18px] text-muted-foreground" />
          </button>
          <button className="w-[34px] h-[34px] flex items-center justify-center hover:bg-wa-hover rounded-full transition-colors">
            <ChevronDown className="w-[18px] h-[18px] text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* ─── Messages Area ─── */}
      <div ref={scrollContainerRef} data-chat-scroll className="flex-1 overflow-y-auto relative scrollbar-thin bg-wa-chat-bg" style={{ scrollBehavior: "smooth" }}>
        {/* WhatsApp doodle pattern */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='300' height='300' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M30 10 L35 20 L25 20Z M10 40 L15 50 L5 50Z M50 35 L55 45 L45 45Z' fill='%23888' opacity='0.3'/%3E%3Ccircle cx='45' cy='15' r='3' fill='%23888' opacity='0.2'/%3E%3Ccircle cx='15' cy='30' r='2' fill='%23888' opacity='0.2'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='300' height='300' fill='url(%23p)'/%3E%3C/svg%3E")`,
        }} />

        <div className="relative z-[1] py-2">
          {messagesQ.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : groupedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-wa-tint/10 flex items-center justify-center mb-3">
                <Send className="w-7 h-7 text-wa-tint" />
              </div>
              <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
              <p className="text-xs mt-1">Envie a primeira mensagem para {contact?.name}</p>
            </div>
          ) : (
            groupedMessages.map((group, gi) => (
              <div key={gi}>
                <DateSeparator date={group.date} />
                {group.messages.map((msg, mi) => {
                  const prev = mi > 0 ? group.messages[mi - 1] : null;
                  const next = mi < group.messages.length - 1 ? group.messages[mi + 1] : null;
                  const isFirst = !prev || prev.fromMe !== msg.fromMe;
                  const isLast = !next || next.fromMe !== msg.fromMe;
                  // Apply real-time status updates from socket
                  const updatedMsg = msg.messageId && localStatusUpdates[msg.messageId]
                    ? { ...msg, status: localStatusUpdates[msg.messageId] }
                    : msg;
                  return (
                    <MessageBubble
                      key={msg.id}
                      msg={updatedMsg}
                      isFirst={isFirst}
                      isLast={isLast}
                      allMessages={allMessages}
                      onReply={setReplyTarget}
                      onReact={handleReact}
                      onDelete={handleDelete}
                      onEdit={handleEditStart}
                      onForward={handleForward}
                    />
                  );
                })}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom */}
        {showScrollBtn && (
          <button onClick={() => scrollToBottom(true)}
            className="absolute bottom-4 right-4 w-[42px] h-[42px] rounded-full bg-wa-panel shadow-lg flex items-center justify-center hover:bg-wa-hover transition-colors z-20 border border-wa-divider">
            <ArrowDown className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* ─── Reply Preview ─── */}
      {replyTarget && (
        <div className="bg-wa-panel-header border-t border-wa-divider px-4 py-2 flex items-center gap-3 z-10 shrink-0">
          <div className="flex-1 bg-foreground/5 border-l-4 border-wa-tint rounded-md px-3 py-2">
            <p className="text-[11px] font-semibold text-wa-tint">{replyTarget.fromMe ? "Você" : contact?.name || "Contato"}</p>
            <p className="text-[12px] text-muted-foreground truncate">{replyTarget.content}</p>
          </div>
          <button onClick={() => setReplyTarget(null)} className="p-1 hover:bg-muted rounded-full transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* ─── Input Area ─── */}
      <div className="bg-wa-panel-header border-t border-wa-divider px-3 py-[5px] z-10 shrink-0">
        {isRecording ? (
          <VoiceRecorder onSend={handleVoiceSend} onCancel={() => setIsRecording(false)} />
        ) : (
          <div className="flex items-end gap-1.5">
            {/* Emoji picker */}
            <div className="relative shrink-0 self-end" ref={emojiPickerRef}>
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`w-[42px] h-[42px] flex items-center justify-center rounded-full transition-colors ${showEmojiPicker ? "bg-wa-hover" : "hover:bg-wa-hover"}`}>
                <Smile className="w-[24px] h-[24px] text-muted-foreground" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 z-50">
                  <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="light" previewPosition="none" skinTonePosition="none" locale="pt" />
                </div>
              )}
            </div>

            {/* Attach menu */}
            <div className="relative shrink-0 self-end">
              <button onClick={() => setShowAttach(!showAttach)}
                className={`w-[42px] h-[42px] flex items-center justify-center rounded-full transition-colors ${showAttach ? "bg-wa-hover" : "hover:bg-wa-hover"}`}>
                <Paperclip className="w-[24px] h-[24px] text-muted-foreground rotate-45" />
              </button>
              {showAttach && <AttachMenu onSelect={handleAttachSelect} onClose={() => setShowAttach(false)} />}
            </div>

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef} value={messageText} onChange={handleTextareaChange}
                placeholder="Mensagem" rows={1}
                className="w-full bg-wa-input-bg rounded-lg px-3 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground border border-wa-divider outline-none resize-none leading-[20px] focus:border-wa-tint/50 transition-colors"
                style={{ height: "42px", maxHeight: "140px" }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
            </div>

            {/* Send / Mic button */}
            {messageText.trim() ? (
              <button onClick={handleSend} disabled={sendMessage.isPending || sendTextWithQuote.isPending || isSending}
                className="w-[42px] h-[42px] flex items-center justify-center bg-wa-tint hover:opacity-90 rounded-full transition-all shrink-0 self-end disabled:opacity-50">
                {sendMessage.isPending || sendTextWithQuote.isPending || isSending ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-[20px] h-[20px] text-white" />}
              </button>
            ) : (
              <button onClick={() => { setIsRecording(true); sendPresenceMut.mutate({ sessionId, number: contact?.phone?.replace(/\D/g, "") || "", presence: "recording" }); }}
                className="w-[42px] h-[42px] flex items-center justify-center hover:bg-wa-hover rounded-full transition-colors shrink-0 self-end">
                <Mic className="w-[24px] h-[24px] text-muted-foreground" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} />
      <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" multiple className="hidden" onChange={handleDocSelect} />

      {/* Modals */}
      {showLocationModal && <LocationModal onSend={handleLocationSend} onClose={() => setShowLocationModal(false)} />}
      {showContactModal && <ContactModal onSend={handleContactSend} onClose={() => setShowContactModal(false)} />}
      {showPollModal && <PollModal onSend={handlePollSend} onClose={() => setShowPollModal(false)} />}
      {editTarget && <EditMessageModal currentText={editTarget.text} onSave={handleEditSave} onClose={() => setEditTarget(null)} />}

      {/* Sending overlay */}
      {isSending && (
        <div className="absolute inset-0 bg-background/20 backdrop-blur-sm flex items-center justify-center z-30">
          <div className="bg-card rounded-xl px-6 py-4 shadow-xl flex items-center gap-3 border border-border">
            <Loader2 className="w-5 h-5 animate-spin text-wa-tint" />
            <span className="text-sm text-foreground">Enviando...</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Utilities ─── */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
