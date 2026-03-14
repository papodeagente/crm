import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { toast } from "sonner";
import {
  Check, CheckCheck, Clock, Download, File, Image as ImageIcon,
  Mic, MicOff, Paperclip, Pause, Phone, Play, Search, Send, Smile,
  Video, X, Camera, FileText, ArrowDown, Volume2, Loader2, ChevronDown,
  UserPlus, Briefcase, Users, Reply, Trash2, Pencil, Forward, MapPin,
  Contact, BarChart3, Copy, Ban, StickyNote, ArrowRightLeft, History, Sparkles, Brain
} from "lucide-react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

import { formatTime, SYSTEM_TIMEZONE, SYSTEM_LOCALE } from "../../../shared/dateUtils";
import TransferDialog from "./TransferDialog";
import { useTenantId } from "@/hooks/useTenantId";

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
  myAvatarUrl?: string;
  // Helpdesk
  waConversationId?: number;
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

/* ─── Waveform bars generator (deterministic from duration) ─── */
function generateWaveformBars(count: number, seed: number = 42): number[] {
  const bars: number[] = [];
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 16807 + 0) % 2147483647;
    const normalized = (s % 100) / 100;
    // Create a natural-looking waveform with peaks in the middle
    const position = i / count;
    const envelope = Math.sin(position * Math.PI) * 0.6 + 0.4;
    bars.push(Math.max(0.12, normalized * envelope));
  }
  return bars;
}

/* ─── Audio Player (WhatsApp Web style) ─── */
const AudioPlayer = memo(({ src, duration, isVoice, fromMe, avatarUrl }: {
  src: string; duration?: number | null; isVoice?: boolean; fromMe?: boolean; avatarUrl?: string | null;
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const barCount = 28;
  const [bars] = useState(() => generateWaveformBars(barCount, Math.round((duration || 10) * 137)));

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
    if (isPlaying) { audio.pause(); } else { audio.playbackRate = playbackRate; audio.play(); }
    setIsPlaying(!isPlaying);
  }, [isPlaying, playbackRate]);

  const cycleSpeed = useCallback(() => {
    const speeds = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const newRate = speeds[nextIdx];
    setPlaybackRate(newRate);
    if (audioRef.current) audioRef.current.playbackRate = newRate;
  }, [playbackRate]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const audio = audioRef.current;
    if (audio && totalDuration > 0) {
      audio.currentTime = pct * totalDuration;
      setCurrentTime(audio.currentTime);
    }
  }, [totalDuration]);

  const formatDur = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
  const accentColor = fromMe ? "#53bdeb" : "#00a884";
  const unplayedColor = fromMe ? "rgba(83,189,235,0.3)" : "rgba(0,168,132,0.25)";

  return (
    <div className="flex items-center gap-2.5 min-w-[250px] max-w-[340px] py-1">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Avatar - always show photo if available, like WhatsApp Web */}
      <div className="relative shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-[52px] h-[52px] rounded-full object-cover shadow-sm" />
        ) : (
          <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center bg-gradient-to-br shadow-sm"
            style={{ background: fromMe ? "linear-gradient(135deg, #53bdeb 0%, #3a9fd4 100%)" : "linear-gradient(135deg, #25d366 0%, #00a884 100%)" }}>
            <Mic className="w-6 h-6 text-white" />
          </div>
        )}
        {/* Mic badge for voice notes */}
        {isVoice && (
          <div className="absolute -bottom-0.5 -right-0.5 w-[20px] h-[20px] rounded-full flex items-center justify-center shadow-sm"
            style={{ backgroundColor: accentColor }}>
            <Mic className="w-[11px] h-[11px] text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        {/* Play button + Waveform row */}
        <div className="flex items-center gap-2">
          <button onClick={togglePlay}
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95"
            style={{ color: accentColor }}>
            {isPlaying
              ? <Pause className="w-[20px] h-[20px]" fill="currentColor" />
              : <Play className="w-[20px] h-[20px] ml-0.5" fill="currentColor" />
            }
          </button>

          {/* Waveform with seek dot */}
          <div className="flex-1 relative cursor-pointer" onClick={handleSeek}>
            <div className="flex items-center gap-[2px] h-[32px]">
              {bars.map((h, i) => {
                const barProgress = i / barCount;
                const isPlayed = barProgress <= progress;
                return (
                  <div
                    key={i}
                    className="rounded-full transition-colors duration-100 flex-1"
                    style={{
                      minWidth: "3px",
                      maxWidth: "4px",
                      height: `${Math.max(4, h * 30)}px`,
                      backgroundColor: isPlayed ? accentColor : unplayedColor,
                    }}
                  />
                );
              })}
            </div>
            {/* Seek dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-[12px] h-[12px] rounded-full shadow-md transition-all duration-75"
              style={{
                left: `calc(${progress * 100}% - 6px)`,
                backgroundColor: accentColor,
              }}
            />
          </div>
        </div>

        {/* Duration + Speed control */}
        <div className="flex items-center justify-between pl-[42px] pr-1">
          <span className="text-[11px] tabular-nums text-muted-foreground/70">
            {isPlaying ? formatDur(currentTime) : formatDur(totalDuration || 0)}
          </span>
          <button
            onClick={cycleSpeed}
            className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full transition-all hover:scale-105"
            style={{
              color: playbackRate !== 1 ? "white" : accentColor,
              backgroundColor: playbackRate !== 1 ? accentColor : "transparent",
              border: `1.5px solid ${accentColor}`,
            }}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
});
AudioPlayer.displayName = "AudioPlayer";

/* ─── Media Loader (download on demand) ─── */
function MediaLoader({ sessionId, messageId, messageType, mediaDuration, isVoiceNote, mediaFileName, mediaMimeType, fromMe, avatarUrl, onImageClick }: {
  sessionId: string; messageId: string; messageType: string;
  mediaDuration?: number | null; isVoiceNote?: boolean | null;
  mediaFileName?: string | null; mediaMimeType?: string | null;
  fromMe?: boolean; avatarUrl?: string | null;
  onImageClick?: (url: string) => void;
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

  const [unavailable, setUnavailable] = useState(false);

  const handleLoad = useCallback(async () => {
    if (loading || mediaUrl || unavailable) return;
    setLoading(true);
    setError(false);
    try {
      const result = await getMediaUrlMut.mutateAsync({ sessionId, messageId });
      if (result.unavailable || !result.url) {
        setUnavailable(true);
      } else {
        setMediaUrl(result.url);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [sessionId, messageId, loading, mediaUrl, unavailable]);

  // Auto-load for images, stickers, and audio messages
  useEffect(() => {
    if ((isAudio || isImage || isSticker || isVideo) && !mediaUrl && !loading && !error && !unavailable) {
      handleLoad();
    }
  }, [isAudio, isImage, isSticker, isVideo]);

  if (mediaUrl) {
    if (isAudio) return <AudioPlayer src={mediaUrl} duration={mediaDuration} isVoice={isVoiceNote || false} fromMe={fromMe} avatarUrl={avatarUrl} />;
    if (isImage) return (
      <div className="relative -mx-1 -mt-0.5 mb-1 overflow-hidden rounded-md">
        <img src={mediaUrl} alt="Imagem" className="max-w-[300px] w-full h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity rounded-lg" loading="lazy" onClick={() => onImageClick?.(mediaUrl)}
          onError={() => setUnavailable(true)} />
      </div>
    );
    if (isVideo) return (
      <div className="relative -mx-1 -mt-0.5 mb-1 overflow-hidden rounded-md">
        <video src={mediaUrl} controls className="max-w-[300px] w-full h-auto rounded-md" preload="metadata"
          onError={() => setUnavailable(true)} />
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
    if (isSticker) return <img src={mediaUrl} alt="Sticker" className="w-32 h-32 object-contain" loading="lazy"
      onError={() => setUnavailable(true)} />;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2 -mx-0.5 rounded-md bg-foreground/5 mb-1 min-w-[200px]">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Carregando mídia...</span>
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="flex items-center gap-2 p-2 -mx-0.5 rounded-md bg-foreground/5 mb-1 min-w-[160px]">
        {isAudio ? <Mic className="w-4 h-4 text-muted-foreground/60" /> :
         isImage ? <ImageIcon className="w-4 h-4 text-muted-foreground/60" /> :
         isVideo ? <Play className="w-4 h-4 text-muted-foreground/60" /> :
         isDocument ? <FileText className="w-4 h-4 text-muted-foreground/60" /> :
         <Download className="w-4 h-4 text-muted-foreground/60" />}
        <span className="text-xs text-muted-foreground/60 italic">
          {isAudio ? `Áudio${mediaDuration ? ` (${Math.floor(mediaDuration / 60)}:${(mediaDuration % 60).toString().padStart(2, "0")})` : ""}` :
           isImage ? "Imagem" : isVideo ? "Vídeo" : isDocument ? (mediaFileName || "Documento") : "Mídia"}
          {" "}— expirado
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <button onClick={handleLoad} className="flex items-center gap-2 p-2 -mx-0.5 rounded-md bg-foreground/5 hover:bg-foreground/10 transition-colors mb-1 min-w-[200px]">
        <Download className="w-5 h-5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Erro ao carregar. Toque para tentar novamente.</span>
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

/* ─── Image with Fallback to MediaLoader ─── */
function ImageWithFallback({ msg, fromMe, myAvatarUrl, contactAvatarUrl, onImageClick, isSticker }: {
  msg: Message; fromMe: boolean; myAvatarUrl?: string; contactAvatarUrl?: string;
  onImageClick?: (url: string) => void; isSticker?: boolean;
}) {
  const [broken, setBroken] = useState(false);

  // If image failed to load, fall back to MediaLoader for re-download
  if (broken && msg.messageId) {
    return <MediaLoader
      sessionId={msg.sessionId} messageId={msg.messageId}
      messageType={msg.messageType} mediaDuration={msg.mediaDuration}
      isVoiceNote={msg.isVoiceNote} mediaFileName={msg.mediaFileName}
      mediaMimeType={msg.mediaMimeType} fromMe={fromMe}
      avatarUrl={fromMe ? myAvatarUrl : contactAvatarUrl}
      onImageClick={onImageClick}
    />;
  }

  if (isSticker) {
    return <img src={msg.mediaUrl!} alt="Sticker" className="w-32 h-32 object-contain" loading="lazy"
      onError={() => setBroken(true)} />;
  }

  return (
    <div className="relative -mx-1 -mt-0.5 mb-1 overflow-hidden rounded-md">
      <img src={msg.mediaUrl!} alt="Imagem" className="max-w-[300px] w-full h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity rounded-lg" loading="lazy"
        onClick={() => onImageClick?.(msg.mediaUrl!)}
        onError={() => setBroken(true)} />
    </div>
  );
}

/* ─── Message Bubble ─── */
const MessageBubble = memo(({
  msg, isFirst, isLast, allMessages,
  onReply, onReact, onDelete, onEdit, onForward, contactAvatarUrl, myAvatarUrl, onImageClick,
  autoTranscribe, onTranscribe, transcriptions
}: {
  msg: Message; isFirst: boolean; isLast: boolean; allMessages: Message[];
  onReply: (target: ReplyTarget) => void;
  onReact: (key: { remoteJid: string; fromMe: boolean; id: string }, emoji: string) => void;
  onDelete: (remoteJid: string, messageId: string, fromMe: boolean) => void;
  onEdit: (messageId: string, currentText: string) => void;
  onForward: (msg: Message) => void;
  contactAvatarUrl?: string;
  myAvatarUrl?: string;
  onImageClick?: (url: string) => void;
  autoTranscribe?: boolean;
  onTranscribe?: (msgId: number, audioUrl: string) => void;
  transcriptions?: Record<number, { text?: string; loading?: boolean; error?: string }>;
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const fromMe = msg.fromMe;
  const time = formatTime(msg.timestamp || msg.createdAt);

  const isImage = msg.messageType === "imageMessage" || msg.messageType === "image" || msg.mediaMimeType?.startsWith("image/");
  const isVideo = msg.messageType === "videoMessage" || msg.messageType === "video" || msg.messageType === "ptvMessage" || msg.mediaMimeType?.startsWith("video/");
  const isAudio = msg.messageType === "audioMessage" || msg.messageType === "pttMessage" || msg.messageType === "audio" || msg.mediaMimeType?.startsWith("audio/");
  const isDocument = msg.messageType === "documentMessage" || msg.messageType === "document";
  const isSticker = msg.messageType === "stickerMessage";
  const isLocation = msg.messageType === "locationMessage";
  const isContact = msg.messageType === "contactMessage" || msg.messageType === "contactsArrayMessage";
  const isPoll = msg.messageType === "pollCreationMessage" || msg.messageType === "pollCreationMessageV3";
  const isPtv = msg.messageType === "ptvMessage"; // Video message (round video)
  // Detect media by messageType (not just mediaUrl), since most messages have mediaUrl=null
  const isMediaType = isImage || isVideo || isAudio || isDocument || isSticker;
  // Only treat permanent S3/CDN URLs as valid; WhatsApp CDN URLs (mmg.whatsapp.net, web.whatsapp.net) expire
  const hasMediaUrl = !!msg.mediaUrl && !msg.mediaUrl.includes('whatsapp.net');
  const hasMedia = hasMediaUrl || isMediaType;

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

    // If we have a mediaUrl, render the media directly
    if (hasMediaUrl) {
      if (isImage && msg.mediaUrl) {
        return <ImageWithFallback msg={msg} fromMe={fromMe} myAvatarUrl={myAvatarUrl} contactAvatarUrl={contactAvatarUrl} onImageClick={onImageClick} />;
      }
      if (isVideo && msg.mediaUrl) {
        return (
          <div className="relative -mx-1 -mt-0.5 mb-1 overflow-hidden rounded-md">
            <video src={msg.mediaUrl} controls className="max-w-[300px] w-full h-auto rounded-md" preload="metadata" />
          </div>
        );
      }
      if (isAudio && msg.mediaUrl) {
        return <AudioPlayer src={msg.mediaUrl} duration={msg.mediaDuration} isVoice={msg.isVoiceNote || false} fromMe={fromMe} avatarUrl={fromMe ? myAvatarUrl : contactAvatarUrl} />;
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
        return <ImageWithFallback msg={msg} fromMe={fromMe} myAvatarUrl={myAvatarUrl} contactAvatarUrl={contactAvatarUrl} onImageClick={onImageClick} isSticker />;
      }
    }

    // No mediaUrl but it's a media type message - use MediaLoader to download on demand
    if (isMediaType && !hasMediaUrl && msg.messageId) {
      return <MediaLoader sessionId={msg.sessionId} messageId={msg.messageId} messageType={msg.messageType}
        mediaDuration={msg.mediaDuration} isVoiceNote={msg.isVoiceNote} mediaFileName={msg.mediaFileName} mediaMimeType={msg.mediaMimeType}
        fromMe={fromMe} avatarUrl={fromMe ? myAvatarUrl : contactAvatarUrl} onImageClick={onImageClick} />;
    }
    return null;
  };

  // Show text content: hide placeholder text like "[Imagem]", "[Áudio]" for media messages
  // But show captions for images/videos (e.g. "[Imagem] Beautiful sunset" -> "Beautiful sunset")
  const textContent = (() => {
    if (!msg.content) return null;
    if (isLocation || isContact || isPoll) return null; // These have their own rendering
    if (isMediaType || isPtv) {
      // Strip placeholder prefixes like "[Imagem] ", "[Vídeo] ", etc.
      const stripped = msg.content
        .replace(/^\[(Imagem|Vídeo|Áudio|Documento|Sticker)\]\s*/i, "")
        .trim();
      return stripped || null; // Return caption if exists, null otherwise
    }
    return msg.content;
  })();

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

          {/* Audio transcription */}
          {isAudio && msg.mediaUrl && !msg.mediaUrl.includes('whatsapp.net') && (() => {
            const t = transcriptions?.[msg.id];
            if (t?.loading) return (
              <div className="mt-1 px-2 py-1.5 bg-violet-50 dark:bg-violet-950/20 rounded text-[12px] text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Transcrevendo...
              </div>
            );
            if (t?.text) return (
              <div className="mt-1 px-2 py-1.5 bg-violet-50 dark:bg-violet-950/20 rounded">
                <div className="flex items-center gap-1 mb-0.5">
                  <FileText className="h-3 w-3 text-violet-500" />
                  <span className="text-[10px] font-medium text-violet-500 uppercase">Transcrição</span>
                </div>
                <p className="text-[13px] text-foreground leading-[18px]">{t.text}</p>
              </div>
            );
            if (t?.error) return (
              <div className="mt-1 px-2 py-1 bg-red-50 dark:bg-red-950/20 rounded text-[11px] text-red-500">
                Erro na transcrição: {t.error}
              </div>
            );
            // Show manual transcribe button if not auto
            if (!autoTranscribe && onTranscribe) return (
              <button
                onClick={() => onTranscribe(msg.id, msg.mediaUrl!)}
                className="mt-1 text-[11px] text-violet-500 hover:text-violet-600 flex items-center gap-1 transition-colors"
              >
                <FileText className="h-3 w-3" /> Transcrever áudio
              </button>
            );
            return null;
          })()}

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
    { type: "image", icon: ImageIcon, label: "Fotos e V\u00eddeos", color: "#7C3AED" },
    { type: "camera", icon: Camera, label: "C\u00e2mera", color: "#EC4899" },
    { type: "document", icon: FileText, label: "Documento", color: "#6366F1" },
    { type: "location", icon: MapPin, label: "Localiza\u00e7\u00e3o", color: "#10B981" },
    { type: "contact", icon: Contact, label: "Contato", color: "#3B82F6" },
    { type: "poll", icon: BarChart3, label: "Enquete", color: "#F59E0B" },
  ];

  return (
    <div className="absolute bottom-full left-0 mb-2 bg-card/95 backdrop-blur-sm rounded-xl shadow-2xl border border-border/50 overflow-hidden z-50 min-w-[200px]"
      style={{ animation: "slideUpFade 0.15s ease-out" }}>
      <div className="py-1.5">
        {items.map((item, i) => (
          <button key={item.type} onClick={() => { onSelect(item.type); onClose(); }}
            className="flex items-center gap-3 w-full px-3.5 py-2 hover:bg-muted/60 transition-all text-left group"
            style={{ animationDelay: `${i * 30}ms` }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110" style={{ backgroundColor: item.color }}>
              <item.icon className="w-[17px] h-[17px] text-white" />
            </div>
            <span className="text-[13.5px] font-medium text-foreground/80 group-hover:text-foreground transition-colors">{item.label}</span>
          </button>
        ))}
      </div>
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

export default function WhatsAppChat({ contact, sessionId, remoteJid, onCreateDeal, onCreateContact, hasCrmContact, assignment, agents, onAssign, onStatusChange, myAvatarUrl, waConversationId }: WhatsAppChatProps) {
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplyFilter, setQuickReplyFilter] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [showAiSuggestion, setShowAiSuggestion] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Record<number, { text?: string; loading?: boolean; error?: string }>>({});
  const tenantId = useTenantId();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const presenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Internal notes queries
  const notesQ = trpc.whatsapp.notes.list.useQuery(
    { waConversationId: waConversationId || 0 },
    { enabled: !!waConversationId, refetchInterval: 30000, staleTime: 15000 }
  );
  const createNoteMut = trpc.whatsapp.notes.create.useMutation({
    onSuccess: () => { notesQ.refetch(); toast.success("Nota interna adicionada"); setMessageText(""); setIsNoteMode(false); },
    onError: (e) => toast.error(e.message || "Erro ao criar nota"),
  });

  // Quick replies
  const quickRepliesQ = trpc.whatsapp.quickReplies.list.useQuery(
    {},
    { staleTime: 5 * 60 * 1000 }
  );
  const filteredQuickReplies = useMemo(() => {
    const replies = (quickRepliesQ.data || []) as Array<{ id: number; shortcut: string; title: string; content: string; category?: string | null }>;
    if (!quickReplyFilter) return replies.slice(0, 10);
    const f = quickReplyFilter.toLowerCase();
    return replies.filter(r => r.shortcut.toLowerCase().includes(f) || r.title.toLowerCase().includes(f)).slice(0, 10);
  }, [quickRepliesQ.data, quickReplyFilter]);

  // Conversation events/timeline
  const eventsQ = trpc.whatsapp.events.list.useQuery(
    { waConversationId: waConversationId || 0 },
    { enabled: !!waConversationId && showTimeline, refetchInterval: 60000, staleTime: 30000 }
  );

  // Transfer mutation
  const transferMut = trpc.whatsapp.transfer.execute.useMutation({
    onSuccess: () => { eventsQ.refetch(); notesQ.refetch(); toast.success("Conversa transferida com sucesso"); },
    onError: (e) => toast.error(e.message || "Erro ao transferir"),
  });

  // AI Suggestion mutation
  const aiSuggestMut = trpc.ai.suggest.useMutation({
    onSuccess: (data) => {
      setAiSuggestion(data.suggestion);
      setShowAiSuggestion(true);
    },
    onError: (err) => {
      if (err.message === "NO_AI_CONFIGURED") {
        toast.error("Nenhuma IA configurada. Vá em Integrações > IA para conectar sua API.", { duration: 5000 });
      } else {
        toast.error(err.message || "Erro ao gerar sugestão");
      }
    },
  });

  const handleAiSuggest = () => {
    if (!tenantId) { toast.error("Tenant não identificado"); return; }
    const msgs = (messagesQ.data || []).filter((m: any) => m.content).map((m: any) => ({
      fromMe: m.fromMe,
      content: m.content || "",
      timestamp: m.timestamp,
    }));
    if (msgs.length === 0) { toast.error("Sem mensagens para analisar"); return; }
    aiSuggestMut.mutate({
      tenantId,
      messages: msgs.reverse(),
      contactName: contact?.name,
    });
  };

  const useAiSuggestion = () => {
    if (aiSuggestion) {
      setMessageText(aiSuggestion);
      setShowAiSuggestion(false);
      setAiSuggestion(null);
    }
  };

  // AI Settings query (for auto-transcription)
  const aiSettingsQ = trpc.ai.getSettings.useQuery(
    { tenantId: tenantId || 0 },
    { enabled: !!tenantId, staleTime: 60000 }
  );

  // Transcription mutation
  const transcribeMut = trpc.ai.transcribe.useMutation();

  const handleTranscribe = useCallback((msgId: number, audioUrl: string) => {
    if (!tenantId) return;
    setTranscriptions(prev => ({ ...prev, [msgId]: { loading: true } }));
    transcribeMut.mutate(
      { tenantId, audioUrl },
      {
        onSuccess: (data) => {
          setTranscriptions(prev => ({ ...prev, [msgId]: { text: data.text } }));
        },
        onError: (err) => {
          if (err.message === "OPENAI_REQUIRED") {
            setTranscriptions(prev => ({ ...prev, [msgId]: { error: "Conecte a API da OpenAI em Integrações > IA" } }));
          } else {
            setTranscriptions(prev => ({ ...prev, [msgId]: { error: err.message || "Falha" } }));
          }
        },
      }
    );
  }, [tenantId, transcribeMut]);

  // Queries
  const messagesQ = trpc.whatsapp.messagesByContact.useQuery(
    { sessionId, remoteJid, limit: 100 },
    { enabled: !!sessionId && !!remoteJid, refetchInterval: 8000, staleTime: 3000 }
  );

  const utils = trpc.useUtils();

  // Auto-transcribe new audio messages
  const autoTranscribedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!aiSettingsQ.data?.audioTranscriptionEnabled || !tenantId) return;
    const msgs = messagesQ.data || [];
    for (const m of msgs) {
      const isAudio = m.messageType === "audioMessage" || m.messageType === "pttMessage" || m.messageType === "audio" || m.mediaMimeType?.startsWith("audio/");
      if (isAudio && m.mediaUrl && !m.mediaUrl.includes('whatsapp.net') && !m.fromMe && !autoTranscribedRef.current.has(m.id) && !transcriptions[m.id]) {
        autoTranscribedRef.current.add(m.id);
        handleTranscribe(m.id, m.mediaUrl);
      }
    }
  }, [messagesQ.data, aiSettingsQ.data?.audioTranscriptionEnabled, tenantId, handleTranscribe, transcriptions]);

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

  // Delayed refetch: wait a bit for the DB insert to complete before refetching
  const delayedRefetch = useCallback(() => {
    setTimeout(() => messagesQ.refetch(), 400);
  }, [messagesQ]);

  const sendMessage = trpc.whatsapp.sendMessage.useMutation({
    onMutate: (vars) => addOptimisticMessage(vars.message),
    onSuccess: (result) => {
      // Update optimistic message with real messageId so it merges with server data
      if (result.messageId) {
        const queryKey = { sessionId, remoteJid, limit: 100 };
        utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
          if (!old) return old;
          return old.map((m: any) =>
            m.messageId?.startsWith("opt_") ? { ...m, messageId: result.messageId, status: "sent" } : m
          );
        });
      }
      delayedRefetch();
    },
    onError: () => {
      // Remove optimistic message on error
      const queryKey = { sessionId, remoteJid, limit: 100 };
      utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
        if (!old) return old;
        return old.filter((m: any) => !m.messageId?.startsWith("opt_"));
      });
      toast.error("Erro ao enviar mensagem");
    },
  });

  const sendTextWithQuote = trpc.whatsapp.sendTextWithQuote.useMutation({
    onMutate: (vars) => addOptimisticMessage(vars.message, vars.quotedMessageId),
    onSuccess: (result) => {
      if (result.messageId) {
        const queryKey = { sessionId, remoteJid, limit: 100 };
        utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
          if (!old) return old;
          return old.map((m: any) =>
            m.messageId?.startsWith("opt_") ? { ...m, messageId: result.messageId, status: "sent" } : m
          );
        });
      }
      delayedRefetch();
      setReplyTarget(null);
    },
    onError: () => {
      const queryKey = { sessionId, remoteJid, limit: 100 };
      utils.whatsapp.messagesByContact.setData(queryKey, (old: any) => {
        if (!old) return old;
        return old.filter((m: any) => !m.messageId?.startsWith("opt_"));
      });
      toast.error("Erro ao enviar resposta");
    },
  });

  const uploadMedia = trpc.whatsapp.uploadMedia.useMutation();
  const sendMedia = trpc.whatsapp.sendMedia.useMutation({
    onSuccess: () => delayedRefetch(),
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

  // Close emoji picker and attach menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (showAttach && attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttach(false);
      }
    };
    if (showEmojiPicker || showAttach) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPicker, showAttach]);

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

    // Internal note mode: send as note instead of WA message
    if (isNoteMode && waConversationId) {
      createNoteMut.mutate({
        waConversationId,
        sessionId,
        remoteJid,
        content: messageText.trim(),
      });
      setMessageText("");
      if (textareaRef.current) textareaRef.current.style.height = "42px";
      return;
    }

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
  }, [messageText, sessionId, contact, isSending, replyTarget, isNoteMode, waConversationId, remoteJid]);

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
    const val = e.target.value;
    setMessageText(val);
    const el = e.target;
    el.style.height = "42px";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";

    // Quick replies trigger: typing / at start shows quick replies
    if (val.startsWith("/")) {
      setShowQuickReplies(true);
      setQuickReplyFilter(val.substring(1));
    } else {
      setShowQuickReplies(false);
      setQuickReplyFilter("");
    }

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
    "placeholderMessage", "albumMessage", "peerDataOperationRequestResponseMessage",
    "botInvokeMessage", "newsletterAdminInviteMessage", "encReactionMessage",
    "keepInChatMessage", "pinInChatMessage", "pollUpdateMessage",
    "groupInviteMessage", "lottieStickerMessage",
  ]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    // Known media types that will render via MediaLoader even without content
    const MEDIA_TYPES = new Set([
      "imageMessage", "videoMessage", "audioMessage", "pttMessage",
      "documentMessage", "stickerMessage", "ptvMessage",
    ]);
    // Types that have their own special rendering
    const SPECIAL_TYPES = new Set([
      "locationMessage", "contactMessage", "contactsArrayMessage",
      "pollCreationMessage", "pollCreationMessageV3",
    ]);
    const msgs = [...(messagesQ.data || [])].reverse()
      .filter(m => {
        // Always hide protocol/system messages
        if (HIDDEN_MSG_TYPES.has(m.messageType)) return false;
        // Media types are always shown (MediaLoader handles missing URLs)
        if (MEDIA_TYPES.has(m.messageType)) return true;
        // Special types with their own rendering
        if (SPECIAL_TYPES.has(m.messageType)) return true;
        // For other types: hide if content is empty or just a placeholder like "[Template]"
        const content = m.content?.trim();
        if (!content) return false;
        // Hide messages that are just type placeholders with no real content
        if (/^\[\w+\]$/.test(content)) return false;
        return true;
      });
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
          {/* Transfer button */}
          {waConversationId && (
            <button
              onClick={() => setShowTransfer(true)}
              title="Transferir conversa"
              className="w-[34px] h-[34px] flex items-center justify-center hover:bg-wa-hover rounded-full transition-colors text-muted-foreground"
            >
              <ArrowRightLeft className="w-[18px] h-[18px]" />
            </button>
          )}
          {/* Timeline toggle */}
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            title="Timeline de eventos"
            className={`w-[34px] h-[34px] flex items-center justify-center rounded-full transition-colors ${
              showTimeline ? "bg-blue-500/15 text-blue-500" : "hover:bg-wa-hover text-muted-foreground"
            }`}
          >
            <History className="w-[18px] h-[18px]" />
          </button>
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
                      contactAvatarUrl={contact?.avatarUrl}
                      myAvatarUrl={myAvatarUrl}
                      onImageClick={setLightboxUrl}
                      autoTranscribe={aiSettingsQ.data?.audioTranscriptionEnabled}
                      onTranscribe={handleTranscribe}
                      transcriptions={transcriptions}
                    />
                  );
                })}
              </div>
            ))
          )}
          {/* Internal Notes (displayed inline as yellow bubbles) */}
          {notesQ.data && (notesQ.data as any[]).length > 0 && (
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-amber-300/30" />
                <span className="text-[11px] font-medium text-amber-600 uppercase tracking-wider flex items-center gap-1">
                  <StickyNote className="w-3 h-3" /> Notas Internas
                </span>
                <div className="h-px flex-1 bg-amber-300/30" />
              </div>
              {(notesQ.data as any[]).map((note: any) => (
                <div key={note.id} className="flex justify-end mb-1.5">
                  <div className="max-w-[75%] bg-amber-100 border border-amber-200 rounded-lg px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                      <StickyNote className="w-3 h-3 text-amber-600" />
                      <span className="text-[11px] font-semibold text-amber-700">{note.authorName || 'Agente'}</span>
                      <span className="text-[10px] text-amber-500">
                        {new Date(note.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[14px] text-amber-900 whitespace-pre-wrap">{note.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Conversation Events Timeline */}
          {showTimeline && eventsQ.data && (eventsQ.data as any[]).length > 0 && (
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-blue-300/30" />
                <span className="text-[11px] font-medium text-blue-600 uppercase tracking-wider flex items-center gap-1">
                  <History className="w-3 h-3" /> Timeline
                </span>
                <div className="h-px flex-1 bg-blue-300/30" />
              </div>
              {(eventsQ.data as any[]).map((event: any) => (
                <div key={event.id} className="flex justify-center mb-1.5">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 shadow-sm max-w-[85%]">
                    <div className="flex items-center gap-2 text-[12px]">
                      {event.eventType === 'transfer' && <ArrowRightLeft className="w-3 h-3 text-blue-500" />}
                      {event.eventType === 'assignment' && <Users className="w-3 h-3 text-green-500" />}
                      {event.eventType === 'status_change' && <Check className="w-3 h-3 text-purple-500" />}
                      {event.eventType === 'note' && <StickyNote className="w-3 h-3 text-amber-500" />}
                      <span className="text-blue-700">
                        {event.eventType === 'transfer' && `Transferido por ${event.actorName || 'Sistema'}`}
                        {event.eventType === 'assignment' && `Atribuído a ${event.metadata?.toAgentName || 'agente'}`}
                        {event.eventType === 'status_change' && `Status: ${event.metadata?.newStatus || ''}`}
                        {event.eventType === 'note' && `Nota de ${event.actorName || 'Agente'}`}
                        {event.eventType === 'queue_claim' && `Puxado da fila por ${event.actorName || 'Agente'}`}
                      </span>
                      <span className="text-blue-400 text-[10px]">
                        {new Date(event.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {event.metadata?.note && (
                      <p className="text-[11px] text-blue-600 mt-0.5 italic">"{event.metadata.note}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
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

      {/* ─── Note Mode Banner ─── */}
      {isNoteMode && (
        <div className="bg-amber-400/20 border-t border-amber-400/40 px-4 py-2 flex items-center gap-2 z-10 shrink-0">
          <StickyNote className="w-4 h-4 text-amber-600" />
          <span className="text-[13px] font-medium text-amber-700">Modo Nota Interna</span>
          <span className="text-[12px] text-amber-600/80">— Só a equipe verá esta mensagem</span>
          <button onClick={() => setIsNoteMode(false)} className="ml-auto p-1 hover:bg-amber-400/30 rounded-full transition-colors">
            <X className="w-4 h-4 text-amber-600" />
          </button>
        </div>
      )}

      {/* ─── Input Area ─── */}
      <div className={`border-t px-3 py-[5px] z-10 shrink-0 transition-colors ${isNoteMode ? "bg-amber-50 border-amber-300" : "bg-wa-panel-header border-wa-divider"}`}>
        {isRecording ? (
          <VoiceRecorder onSend={handleVoiceSend} onCancel={() => setIsRecording(false)} />
        ) : (
          <div className="flex items-end gap-1.5">
            {/* Note toggle button */}
            <button
              onClick={() => setIsNoteMode(!isNoteMode)}
              title={isNoteMode ? "Voltar para mensagem" : "Nota interna (só equipe vê)"}
              className={`w-[42px] h-[42px] flex items-center justify-center rounded-full transition-all duration-200 shrink-0 self-end ${
                isNoteMode ? "bg-amber-400/30 text-amber-600" : "hover:bg-wa-hover text-muted-foreground"
              }`}
            >
              <StickyNote className="w-[20px] h-[20px]" />
            </button>

            {/* Emoji picker */}
            <div className="relative shrink-0 self-end" ref={emojiPickerRef}>
              <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); if (!showEmojiPicker) setShowAttach(false); }}
                className={`w-[42px] h-[42px] flex items-center justify-center rounded-full transition-all duration-200 ${showEmojiPicker ? "bg-wa-tint/15 text-wa-tint" : "hover:bg-wa-hover text-muted-foreground"}`}>
                <Smile className="w-[22px] h-[22px]" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 z-50 rounded-xl overflow-hidden shadow-xl border border-border/50">
                  <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="light" previewPosition="none" skinTonePosition="none" locale="pt" perLine={8} />
                </div>
              )}
            </div>

            {/* Attach menu */}
            <div className="relative shrink-0 self-end" ref={attachMenuRef}>
              <button onClick={() => { setShowAttach(!showAttach); if (!showAttach) setShowEmojiPicker(false); }}
                className={`w-[42px] h-[42px] flex items-center justify-center rounded-full transition-all duration-200 ${showAttach ? "bg-wa-tint/15 text-wa-tint" : "hover:bg-wa-hover text-muted-foreground"}`}>
                <Paperclip className={`w-[22px] h-[22px] transition-transform duration-200 ${showAttach ? "rotate-[135deg]" : "rotate-45"}`} />
              </button>
              {showAttach && <AttachMenu onSelect={handleAttachSelect} onClose={() => setShowAttach(false)} />}
            </div>

            {/* AI Suggestion button */}
            <button
              onClick={handleAiSuggest}
              disabled={aiSuggestMut.isPending}
              title="Sugestão de resposta com IA (SPIN Selling)"
              className={`w-[42px] h-[42px] flex items-center justify-center rounded-full transition-all duration-200 shrink-0 self-end ${
                aiSuggestMut.isPending ? "bg-violet-500/20 text-violet-500" : showAiSuggestion ? "bg-violet-500/20 text-violet-500" : "hover:bg-wa-hover text-muted-foreground"
              }`}
            >
              {aiSuggestMut.isPending ? <Loader2 className="w-[20px] h-[20px] animate-spin" /> : <Sparkles className="w-[20px] h-[20px]" />}
            </button>

            {/* Text input */}
            <div className="flex-1 relative">
              {/* AI Suggestion popup */}
              {showAiSuggestion && aiSuggestion && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-1.5 flex items-center justify-between border-b border-violet-200 dark:border-violet-800">
                    <div className="flex items-center gap-1.5">
                      <Brain className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wider">Sugestão IA (SPIN Selling)</span>
                    </div>
                    <button onClick={() => { setShowAiSuggestion(false); setAiSuggestion(null); }} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="px-3 py-2 text-[13px] text-foreground whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                    {aiSuggestion}
                  </div>
                  <div className="px-3 py-2 flex gap-2 border-t border-violet-200 dark:border-violet-800">
                    <button
                      onClick={useAiSuggestion}
                      className="flex-1 text-[12px] font-medium bg-violet-500 hover:bg-violet-600 text-white rounded-md py-1.5 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Copy className="h-3 w-3" /> Usar esta sugestão
                    </button>
                    <button
                      onClick={handleAiSuggest}
                      disabled={aiSuggestMut.isPending}
                      className="text-[12px] font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 rounded-md px-3 py-1.5 transition-colors border border-violet-200 dark:border-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30 flex items-center gap-1.5"
                    >
                      {aiSuggestMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Gerar outra
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Replies popup */}
              {showQuickReplies && filteredQuickReplies.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-xl max-h-[200px] overflow-y-auto z-50">
                  <div className="px-3 py-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wider border-b border-border/50">
                    Respostas Rápidas
                  </div>
                  {filteredQuickReplies.map((qr) => (
                    <button
                      key={qr.id}
                      className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors border-b border-border/20 last:border-0"
                      onClick={() => {
                        setMessageText(qr.content);
                        setShowQuickReplies(false);
                        setQuickReplyFilter("");
                        textareaRef.current?.focus();
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-wa-tint bg-wa-tint/10 px-1.5 py-0.5 rounded">/{qr.shortcut}</span>
                        <span className="text-[13px] font-medium text-foreground truncate">{qr.title}</span>
                      </div>
                      <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{qr.content.substring(0, 80)}</p>
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef} value={messageText} onChange={handleTextareaChange}
                placeholder={isNoteMode ? "Escreva uma nota interna (só a equipe vê)..." : "Mensagem (digite / para respostas rápidas)"} rows={1}
                className={`w-full rounded-lg px-3 py-2.5 text-[15px] placeholder:text-muted-foreground outline-none resize-none leading-[20px] transition-colors ${
                  isNoteMode
                    ? "bg-amber-100 border-amber-300 text-amber-900 focus:border-amber-400"
                    : "bg-wa-input-bg border-wa-divider text-foreground focus:border-wa-tint/50"
                } border`}
                style={{ height: "42px", maxHeight: "140px" }}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && showQuickReplies) { setShowQuickReplies(false); return; }
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (showQuickReplies) { setShowQuickReplies(false); } else { handleSend(); } }
                }}
              />
            </div>

            {/* Send / Mic button */}
            {messageText.trim() ? (
              <button onClick={handleSend} disabled={sendMessage.isPending || sendTextWithQuote.isPending || isSending || createNoteMut.isPending}
                className={`w-[42px] h-[42px] flex items-center justify-center hover:opacity-90 rounded-full transition-all shrink-0 self-end disabled:opacity-50 ${
                  isNoteMode ? "bg-amber-500" : "bg-wa-tint"
                }`}>
                {sendMessage.isPending || sendTextWithQuote.isPending || isSending || createNoteMut.isPending
                  ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                  : isNoteMode
                    ? <StickyNote className="w-[20px] h-[20px] text-white" />
                    : <Send className="w-[20px] h-[20px] text-white" />}
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
      {/* ─── Transfer Dialog ─── */}
      {showTransfer && waConversationId && (
        <TransferDialog
          open={showTransfer}
          onClose={() => setShowTransfer(false)}
          waConversationId={waConversationId}
          sessionId={sessionId}
          remoteJid={remoteJid}
          currentAgentId={assignment?.assignedUserId}
          contactName={contact?.name || remoteJid.split("@")[0]}
        />
      )}

      {/* ─── Image Lightbox ─── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setLightboxUrl(null); }}
          tabIndex={0}
          role="dialog"
          aria-label="Visualizar imagem"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxUrl(null); }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); window.open(lightboxUrl, '_blank'); }}
            className="absolute top-4 right-16 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
            title="Abrir em nova aba"
          >
            <Download className="w-6 h-6 text-white" />
          </button>
          <img
            src={lightboxUrl}
            alt="Imagem ampliada"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
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
