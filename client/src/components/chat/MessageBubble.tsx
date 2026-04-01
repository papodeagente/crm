import { useState, memo } from "react";
import { Check, CheckCheck, Clock, Download, FileText, Mic, Image as ImageIcon, Play, ChevronDown, MapPin, Contact, BarChart3, Loader2 } from "lucide-react";
import { formatTime } from "../../../../shared/dateUtils";
import { toast } from "sonner";
import MediaLoader from "./MediaLoader";
import AudioPlayer from "./AudioPlayer";
import MessageContextMenu from "./MessageContextMenu";
import RichMessageRenderer, { isRichMessageType } from "@/components/RichMessageRenderer";

/* ─── Types ─── */
export interface Message {
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
  structuredData?: any | null;
  audioTranscription?: string | null;
  audioTranscriptionStatus?: string | null;
  senderAgentId?: number | null;
}

export interface ReplyTarget {
  messageId: string;
  content: string;
  fromMe: boolean;
}

/* ─── Status Order Map — Single source of truth for monotonic enforcement ─── */
export const STATUS_ORDER_MAP: Record<string, number> = {
  error: 0, pending: 1, sending: 2, sent: 3, server_ack: 3,
  delivered: 4, delivery_ack: 4, read: 5, played: 6,
};

/* ─── WhatsApp Text Formatting ─── */
const URL_REGEX = /(?:https?:\/\/|www\.)[-\w+&@#/%?=~|!:,.;]*[-\w+&@#/%=~|]|(?:[a-zA-Z0-9][-a-zA-Z0-9]*\.)+(?:com|org|net|br|io|dev|app|me|co|info|biz|gov|edu)(?:\/[-\w+&@#/%?=~|!:,.;]*[-\w+&@#/%=~|])?/gi;

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || /^vbscript:/i.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function linkifyText(text: string, keyBase: number): { nodes: React.ReactNode[]; nextKey: number } {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let k = keyBase;
  URL_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = URL_REGEX.exec(text)) !== null) {
    if (m.index > lastIndex) nodes.push(text.substring(lastIndex, m.index));
    const href = normalizeUrl(m[0]);
    if (href) {
      nodes.push(
        <a
          key={`link-${k++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-blue-500 hover:text-blue-600 underline underline-offset-2 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {m[0]}
        </a>
      );
    } else {
      nodes.push(m[0]);
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.substring(lastIndex));
  return { nodes, nextKey: k };
}

export function formatWhatsAppText(text: string): React.ReactNode {
  // Process WhatsApp formatting: *bold*, _italic_, ~strikethrough~, ```monospace```
  // Then linkify plain text segments
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
      const { nodes, nextKey } = linkifyText(remaining, key);
      parts.push(...nodes);
      key = nextKey;
      break;
    }

    if (earliest > 0) {
      const { nodes, nextKey } = linkifyText(remaining.substring(0, earliest), key);
      parts.push(...nodes);
      key = nextKey;
    }

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
export const MessageStatus = memo(({ status, isFromMe }: { status: string | null | undefined; isFromMe: boolean }) => {
  if (!isFromMe) return null;
  switch (status) {
    case "sending": return <Clock className="w-[13px] h-[13px] text-muted-foreground/40 inline-block ml-1 animate-pulse" />;
    case "pending": return <Clock className="w-[13px] h-[13px] text-muted-foreground/60 inline-block ml-1" />;
    case "sent": return <Check className="w-[14px] h-[14px] text-muted-foreground/60 inline-block ml-1" />;
    case "delivered": return <CheckCheck className="w-[14px] h-[14px] text-muted-foreground/60 inline-block ml-1" />;
    case "read": case "played": return <CheckCheck className="w-[14px] h-[14px] text-wa-tint inline-block ml-1" />;
    default: return <Check className="w-[14px] h-[14px] text-muted-foreground/60 inline-block ml-1" />;
  }
});
MessageStatus.displayName = "MessageStatus";

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
      <img src={msg.mediaUrl!} alt="Imagem" className="max-w-full sm:max-w-[300px] w-full h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity rounded-lg" loading="lazy"
        onClick={() => onImageClick?.(msg.mediaUrl!)}
        onError={() => setBroken(true)} />
    </div>
  );
}

/* ─── Message Bubble ─── */
const MessageBubble = memo(({
  msg, isFirst, isLast, allMessages,
  onReply, onReact, onDelete, onEdit, onForward, contactAvatarUrl, myAvatarUrl, onImageClick,
  autoTranscribe, onTranscribe, transcriptions, onRetranscribe, reactions,
  agentMap, showAgentNames
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
  onRetranscribe?: (msgId: number) => void;
  reactions?: Array<{ emoji: string; senderJid: string; fromMe: boolean }>;
  agentMap?: Record<number, string>;
  showAgentNames?: boolean;
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
      <div className="rounded-[7.5px] mb-[3px] -mx-[1px] cursor-pointer overflow-hidden" style={{
        backgroundColor: fromMe ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.06)',
        borderLeft: '4px solid var(--wa-tint)',
        padding: '5px 12px 7px 8px',
      }}>
        <p className="text-[12.5px] font-medium" style={{ color: 'var(--wa-tint)' }}>{quotedMsg.fromMe ? "Você" : "Passageiro"}</p>
        <p className="text-[12.5px] truncate max-w-full sm:max-w-[300px]" style={{ color: 'var(--wa-text-secondary)' }}>{quotedContent}</p>
      </div>
    );
  };

  const renderMedia = () => {
    if (isLocation && msg.content) {
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
            <p className="text-[11px] text-muted-foreground">Passageiro</p>
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
            <video src={msg.mediaUrl} controls className="max-w-full sm:max-w-[300px] w-full h-auto rounded-md" preload="metadata" />
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

  // Check if this is a rich message type that has a dedicated renderer
  const isRichType = isRichMessageType(msg.messageType);

  // Show text content: hide placeholder text like "[Imagem]", "[Áudio]" for media messages
  // But show captions for images/videos (e.g. "[Imagem] Beautiful sunset" -> "Beautiful sunset")
  const textContent = (() => {
    if (!msg.content) return null;
    if (isLocation || isContact || isPoll) return null; // These have their own rendering via RichMessageRenderer
    if (isRichType) return null; // Rich types handle their own content rendering
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
    <div className={`group flex ${fromMe ? "justify-end" : "justify-start"} px-[63px] mb-[2px] ${isFirst ? "mt-[2px]" : ""}`}>
      <div className="relative max-w-[65%]">
        {/* Hover dropdown arrow (WhatsApp Web style) */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`absolute top-[2px] ${fromMe ? "right-[4px]" : "right-[4px]"} w-[24px] h-[24px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-full`}
          style={{ background: fromMe ? 'linear-gradient(135deg, transparent 30%, var(--wa-bubble-out))' : 'linear-gradient(135deg, transparent 30%, var(--wa-bubble-in))' }}
        >
          <ChevronDown className="w-[18px] h-[18px]" style={{ color: 'var(--wa-text-secondary)' }} />
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

        <div className={`relative px-[9px] pt-[6px] pb-[8px] ${bubbleBase} ${bubbleRadius}`} style={{ minWidth: "80px", boxShadow: '0 1px 0.5px var(--wa-msg-shadow)' }}>
          {/* Tail SVG */}
          {isFirst && (
            <div className={`absolute top-0 ${fromMe ? "-right-[8px]" : "-left-[8px]"}`} style={{ width: 8, height: 13 }}>
              <svg viewBox="0 0 8 13" width="8" height="13">
                {fromMe ? (
                  <path fill="var(--wa-bubble-out)" d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
                ) : (
                  <path fill="var(--wa-bubble-in)" d="M2.812 1H8v11.193L1.533 3.568C.474 2.156 1.042 1 2.812 1z" />
                )}
              </svg>
            </div>
          )}

          {/* Agent name label */}
          {showAgentNames && fromMe && msg.senderAgentId && agentMap?.[msg.senderAgentId] && isFirst && (
            <p className="text-[11px] font-semibold mb-0.5 truncate" style={{ color: 'var(--wa-tint)' }}>
              {agentMap[msg.senderAgentId]}
            </p>
          )}
          {renderQuotedMessage()}
          {renderMedia()}

          {/* Rich message types (template, interactive, buttons, list, poll, etc.) */}
          {isRichType && (
            <RichMessageRenderer
              messageType={msg.messageType}
              content={msg.content}
              structuredData={msg.structuredData}
              fromMe={fromMe}
            />
          )}

          {/* Audio transcription — uses DB fields first, then local state fallback */}
          {isAudio && (() => {
            // Priority 1: DB-persisted transcription
            if (msg.audioTranscriptionStatus === "completed" && msg.audioTranscription) return (
              <div className="mt-1 px-2 py-1.5 bg-violet-50 dark:bg-violet-950/20 rounded">
                <div className="flex items-center gap-1 mb-0.5">
                  <FileText className="h-3 w-3 text-violet-500" />
                  <span className="text-[10px] font-medium text-violet-500 uppercase">Transcrição</span>
                </div>
                <p className="text-[13px] text-foreground leading-[18px]">{msg.audioTranscription}</p>
              </div>
            );
            if (msg.audioTranscriptionStatus === "pending" || msg.audioTranscriptionStatus === "processing") return (
              <div className="mt-1 px-2 py-1.5 bg-violet-50 dark:bg-violet-950/20 rounded text-[12px] text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Transcrevendo...
              </div>
            );
            if (msg.audioTranscriptionStatus === "failed") return (
              <div className="mt-1 px-2 py-1 bg-red-50 dark:bg-red-950/20 rounded text-[11px] text-red-500 flex items-center justify-between">
                <span>Erro na transcrição</span>
                {onTranscribe && msg.mediaUrl && (
                  <button onClick={() => onTranscribe(msg.id, msg.mediaUrl!)} className="text-violet-500 hover:text-violet-600 ml-2">Tentar novamente</button>
                )}
              </div>
            );
            // Priority 2: Local state (frontend-triggered transcription)
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
                Erro: {t.error}
              </div>
            );
            // Priority 3: Manual transcribe button (if no auto-transcription)
            if (!autoTranscribe && onTranscribe && msg.mediaUrl && !msg.mediaUrl.includes('whatsapp.net')) return (
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

          {/* Time + Status (WhatsApp Web style) */}
          <span className="float-right ml-[4px] mt-[3px] flex items-center gap-[3px] relative -bottom-[1px]">
            <span className="text-[11px] leading-none tabular-nums" style={{ color: fromMe ? 'rgba(0,0,0,0.45)' : 'var(--wa-text-secondary)', fontSize: '11px' }}>{time}</span>
            <MessageStatus status={msg.status} isFromMe={fromMe} />
          </span>
        </div>

        {/* Reactions (WhatsApp Web style) */}
        {reactions && reactions.length > 0 && (
          <div className={`flex flex-wrap gap-[2px] mt-[-6px] mb-[2px] relative z-[1] ${fromMe ? 'justify-end' : 'justify-start'}`}>
            {(() => {
              const grouped = reactions.reduce<Record<string, { count: number; fromMe: boolean }>>((acc, r) => {
                if (!acc[r.emoji]) acc[r.emoji] = { count: 0, fromMe: false };
                acc[r.emoji].count++;
                if (r.fromMe) acc[r.emoji].fromMe = true;
                return acc;
              }, {});
              return Object.entries(grouped).map(([emoji, info]) => (
                <span
                  key={emoji}
                  className="inline-flex items-center gap-[2px] rounded-full text-xs cursor-pointer"
                  style={{
                    padding: '1px 6px',
                    backgroundColor: 'var(--wa-panel)',
                    boxShadow: '0 1px 3px var(--wa-msg-shadow)',
                    border: info.fromMe ? '1px solid var(--wa-tint)' : '1px solid transparent',
                  }}
                  title={info.fromMe ? 'Você reagiu' : ''}
                >
                  <span className="text-[16px] leading-[22px]">{emoji}</span>
                  {info.count > 1 && <span className="text-[11px]" style={{ color: 'var(--wa-text-secondary)' }}>{info.count}</span>}
                </span>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
});
MessageBubble.displayName = "MessageBubble";

export default MessageBubble;
