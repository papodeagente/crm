import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { toast } from "sonner";
import {
  Check, CheckCheck, Clock, Download, File, Image as ImageIcon,
  Mic, MicOff, Paperclip, Pause, Phone, Play, Search, Send, Smile,
  Video, X, Camera, FileText, ArrowDown, Volume2, Loader2, ChevronDown
} from "lucide-react";

// ─── Types ───
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
}

interface WhatsAppChatProps {
  contact: { id: number; name: string; phone: string; email?: string; avatarUrl?: string } | null;
  sessionId: string;
  remoteJid: string;
  onCreateDeal?: () => void;
  onCreateContact?: () => void;
  hasCrmContact?: boolean;
}

// ─── Status Ticks Component ───
const MessageStatus = memo(({ status, isFromMe }: { status: string | null | undefined; isFromMe: boolean }) => {
  if (!isFromMe) return null;

  switch (status) {
    case "pending":
      return <Clock className="w-3 h-3 text-muted-foreground/70 inline-block ml-1" />;
    case "sent":
      return <Check className="w-3.5 h-3.5 text-muted-foreground/70 inline-block ml-1" />;
    case "delivered":
      return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground/70 inline-block ml-1" />;
    case "read":
      return <CheckCheck className="w-3.5 h-3.5 text-sky-400 inline-block ml-1" />;
    case "played":
      return <CheckCheck className="w-3.5 h-3.5 text-sky-400 inline-block ml-1" />;
    default:
      return <Check className="w-3.5 h-3.5 text-muted-foreground/70 inline-block ml-1" />;
  }
});
MessageStatus.displayName = "MessageStatus";

// ─── Audio Player Component ───
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
    if (isPlaying) { audio.pause(); } else { audio.play(); }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-card/20 flex items-center justify-center shrink-0 hover:bg-card/30 transition-colors">
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="relative h-1 bg-black/10 rounded-full overflow-hidden">
          <div className="absolute left-0 top-0 h-full bg-current rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[10px] opacity-70">
          {isPlaying ? formatDuration(currentTime) : formatDuration(totalDuration || 0)}
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

// ─── Single Message Bubble ───
const MessageBubble = memo(({ msg, isFirst, isLast }: { msg: Message; isFirst: boolean; isLast: boolean }) => {
  const fromMe = msg.fromMe;
  const time = new Date(msg.timestamp || msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const isImage = msg.messageType === "imageMessage" || msg.messageType === "image" || msg.mediaMimeType?.startsWith("image/");
  const isVideo = msg.messageType === "videoMessage" || msg.messageType === "video" || msg.mediaMimeType?.startsWith("video/");
  const isAudio = msg.messageType === "audioMessage" || msg.messageType === "audio" || msg.mediaMimeType?.startsWith("audio/");
  const isDocument = msg.messageType === "documentMessage" || msg.messageType === "document";
  const isSticker = msg.messageType === "stickerMessage";
  const hasMedia = !!(msg.mediaUrl);

  // Bubble styles
  const bubbleBase = fromMe
    ? "bg-emerald-100 dark:bg-emerald-900/40 text-foreground"
    : "bg-card text-foreground";

  const bubbleRadius = fromMe
    ? `rounded-lg ${isFirst ? "rounded-tr-none" : ""}`
    : `rounded-lg ${isFirst ? "rounded-tl-none" : ""}`;

  // Render media content
  const renderMedia = () => {
    if (!hasMedia) return null;

    if (isImage && msg.mediaUrl) {
      return (
        <div className="relative -mx-1.5 -mt-1 mb-1 overflow-hidden rounded-md">
          <img
            src={msg.mediaUrl}
            alt="Imagem"
            className="max-w-[300px] w-full h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
            loading="lazy"
            onClick={() => window.open(msg.mediaUrl!, "_blank")}
          />
        </div>
      );
    }

    if (isVideo && msg.mediaUrl) {
      return (
        <div className="relative -mx-1.5 -mt-1 mb-1 overflow-hidden rounded-md">
          <video
            src={msg.mediaUrl}
            controls
            className="max-w-[300px] w-full h-auto rounded-md"
            preload="metadata"
          />
        </div>
      );
    }

    if (isAudio && msg.mediaUrl) {
      return (
        <AudioPlayer
          src={msg.mediaUrl}
          duration={msg.mediaDuration}
          isVoice={msg.isVoiceNote || false}
        />
      );
    }

    if (isDocument && msg.mediaUrl) {
      return (
        <a
          href={msg.mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 -mx-1 rounded-md bg-black/5 hover:bg-black/10 transition-colors mb-1"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
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
      return (
        <img
          src={msg.mediaUrl}
          alt="Sticker"
          className="w-32 h-32 object-contain"
          loading="lazy"
        />
      );
    }

    return null;
  };

  // Text content (skip for pure media without caption)
  const textContent = msg.content && !msg.content.startsWith("[") ? msg.content : (isImage || isVideo || isAudio || isDocument || isSticker) ? null : msg.content;

  return (
    <div className={`flex ${fromMe ? "justify-end" : "justify-start"} px-[7%] mb-[2px] ${isFirst ? "mt-2" : ""}`}>
      <div className={`relative max-w-[65%] px-2 py-1 shadow-sm ${bubbleBase} ${bubbleRadius}`} style={{ minWidth: "80px" }}>
        {/* Tail */}
        {isFirst && (
          <div className={`absolute top-0 w-2 h-3 ${fromMe ? "-right-2" : "-left-2"}`}>
            <svg viewBox="0 0 8 13" width="8" height="13">
              {fromMe ? (
                <path className="fill-emerald-100 dark:fill-emerald-900/40" d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
              ) : (
                <path className="fill-card" d="M2.812 1H8v11.193L1.533 3.568C.474 2.156 1.042 1 2.812 1z" />
              )}
            </svg>
          </div>
        )}

        {renderMedia()}

        {textContent && (
          <span className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">{textContent}</span>
        )}

        {/* Time + Status */}
        <span className="float-right ml-2 mt-1 flex items-center gap-0.5 relative -bottom-0.5">
          <span className="text-[11px] text-muted-foreground leading-none">{time}</span>
          <MessageStatus status={msg.status} isFromMe={fromMe} />
        </span>
      </div>
    </div>
  );
});
MessageBubble.displayName = "MessageBubble";

// ─── Date Separator ───
const DateSeparator = memo(({ date }: { date: string }) => (
  <div className="flex justify-center my-3">
    <span className="bg-card text-muted-foreground text-[12.5px] px-3 py-1 rounded-lg shadow-sm font-medium">
      {date}
    </span>
  </div>
));
DateSeparator.displayName = "DateSeparator";

// ─── Attach Menu ───
function AttachMenu({ onSelect, onClose }: { onSelect: (type: string) => void; onClose: () => void }) {
  const items = [
    { type: "image", icon: ImageIcon, label: "Fotos e Vídeos", color: "#BF59CF" },
    { type: "camera", icon: Camera, label: "Câmera", color: "#D3396D" },
    { type: "document", icon: FileText, label: "Documento", color: "#5F66CD" },
  ];

  return (
    <div className="absolute bottom-full left-0 mb-2 bg-card rounded-xl shadow-xl border border-border overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-150">
      {items.map((item) => (
        <button
          key={item.type}
          onClick={() => { onSelect(item.type); onClose(); }}
          className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: item.color }}>
            <item.icon className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-[14px] text-foreground/80">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Voice Recorder ───
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

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.start(100);
        startTimeRef.current = Date.now();
        timerRef.current = setInterval(() => {
          setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 100);
      } catch (e) {
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
      const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      onSend(blob, finalDuration);
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

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 w-full px-4 py-2 bg-muted rounded-lg">
      <button onClick={handleCancel} className="p-2 hover:bg-muted rounded-full transition-colors">
        <X className="w-5 h-5 text-red-500" />
      </button>
      <div className="flex-1 flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm text-muted-foreground font-medium tabular-nums">{formatDuration(duration)}</span>
        {/* Waveform visualization */}
        <div className="flex items-center gap-[2px] flex-1">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full bg-emerald-500 transition-all duration-100"
              style={{
                height: `${Math.random() * 20 + 4}px`,
                animationDelay: `${i * 50}ms`,
              }}
            />
          ))}
        </div>
      </div>
      <button onClick={handleSend} className="p-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-full transition-colors">
        <Send className="w-5 h-5 text-white" />
      </button>
    </div>
  );
}

// ─── MAIN COMPONENT ───
export default function WhatsAppChat({ contact, sessionId, remoteJid, onCreateDeal, onCreateContact, hasCrmContact }: WhatsAppChatProps) {
  const { lastMessage } = useSocket();
  const [messageText, setMessageText] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const messagesQ = trpc.whatsapp.messagesByContact.useQuery(
    { sessionId, remoteJid, limit: 100 },
    { enabled: !!sessionId && !!remoteJid, refetchInterval: 8000 }
  );

  const sendMessage = trpc.whatsapp.sendMessage.useMutation({
    onSuccess: () => { messagesQ.refetch(); },
    onError: () => toast.error("Erro ao enviar mensagem"),
  });

  const uploadMedia = trpc.whatsapp.uploadMedia.useMutation();
  const sendMedia = trpc.whatsapp.sendMedia.useMutation({
    onSuccess: () => { messagesQ.refetch(); },
    onError: () => toast.error("Erro ao enviar mídia"),
  });

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // Only auto-scroll if user is near bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      scrollToBottom(true);
    }
  }, [messagesQ.data, lastMessage]);

  // Refetch when new message arrives for this contact
  useEffect(() => {
    if (lastMessage && lastMessage.remoteJid === remoteJid) {
      messagesQ.refetch();
    }
  }, [lastMessage, remoteJid]);

  // Scroll detection for "scroll to bottom" button
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

  // Initial scroll to bottom
  useEffect(() => {
    if (messagesQ.data && messagesQ.data.length > 0) {
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [messagesQ.data?.length]);

  // Send text message
  const handleSend = useCallback(() => {
    if (!messageText.trim() || isSending) return;
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;

    sendMessage.mutate({ sessionId, number, message: messageText.trim() });
    setMessageText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "42px";
    }
  }, [messageText, sessionId, contact, isSending]);

  // Handle file selection (images/videos)
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;

    for (const file of Array.from(files)) {
      setIsSending(true);
      try {
        const base64 = await fileToBase64(file);
        const { url } = await uploadMedia.mutateAsync({
          fileName: file.name,
          fileBase64: base64,
          contentType: file.type,
        });

        let mediaType: "image" | "video" | "document" = "document";
        if (file.type.startsWith("image/")) mediaType = "image";
        else if (file.type.startsWith("video/")) mediaType = "video";

        await sendMedia.mutateAsync({
          sessionId,
          number,
          mediaUrl: url,
          mediaType,
          fileName: file.name,
          mimetype: file.type,
        });
        toast.success("Mídia enviada");
      } catch (err) {
        toast.error("Erro ao enviar arquivo");
      } finally {
        setIsSending(false);
      }
    }
    e.target.value = "";
  }, [sessionId, contact]);

  // Handle document selection
  const handleDocSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;

    for (const file of Array.from(files)) {
      setIsSending(true);
      try {
        const base64 = await fileToBase64(file);
        const { url } = await uploadMedia.mutateAsync({
          fileName: file.name,
          fileBase64: base64,
          contentType: file.type,
        });

        await sendMedia.mutateAsync({
          sessionId,
          number,
          mediaUrl: url,
          mediaType: "document",
          fileName: file.name,
          mimetype: file.type,
        });
        toast.success("Documento enviado");
      } catch (err) {
        toast.error("Erro ao enviar documento");
      } finally {
        setIsSending(false);
      }
    }
    e.target.value = "";
  }, [sessionId, contact]);

  // Handle voice recording
  const handleVoiceSend = useCallback(async (blob: Blob, duration: number) => {
    setIsRecording(false);
    const number = contact?.phone?.replace(/\D/g, "") || "";
    if (!number) return;

    setIsSending(true);
    try {
      const base64 = await blobToBase64(blob);
      const { url } = await uploadMedia.mutateAsync({
        fileName: `voice-${Date.now()}.webm`,
        fileBase64: base64,
        contentType: "audio/webm;codecs=opus",
      });

      await sendMedia.mutateAsync({
        sessionId,
        number,
        mediaUrl: url,
        mediaType: "audio",
        ptt: true,
        mimetype: "audio/ogg; codecs=opus",
        duration,
      });
      toast.success("Áudio enviado");
    } catch (err) {
      toast.error("Erro ao enviar áudio");
    } finally {
      setIsSending(false);
    }
  }, [sessionId, contact]);

  // Handle attach menu selection
  const handleAttachSelect = useCallback((type: string) => {
    if (type === "image" || type === "camera") {
      fileInputRef.current?.click();
    } else if (type === "document") {
      docInputRef.current?.click();
    }
  }, []);

  // Auto-resize textarea
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    const el = e.target;
    el.style.height = "42px";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, []);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const msgs = [...(messagesQ.data || [])].reverse(); // oldest first
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";

    for (const msg of msgs) {
      const d = new Date(msg.timestamp || msg.createdAt);
      const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let label = dateStr;
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

  return (
    <div className="flex flex-col h-full bg-background rounded-lg overflow-hidden border border-border">
      {/* WhatsApp doodle background pattern */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='300' height='300' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M30 10 L35 20 L25 20Z M10 40 L15 50 L5 50Z M50 35 L55 45 L45 45Z' fill='%23000' opacity='0.3'/%3E%3Ccircle cx='45' cy='15' r='3' fill='%23000' opacity='0.2'/%3E%3Ccircle cx='15' cy='30' r='2' fill='%23000' opacity='0.2'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='300' height='300' fill='url(%23p)'/%3E%3C/svg%3E")`,
      }} />

      {/* ─── Header ─── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-muted border-b border-border z-10">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          {contact?.avatarUrl ? (
            <img src={contact.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg viewBox="0 0 212 212" width="40" height="40">
              <path className="fill-muted" d="M106 0C47.5 0 0 47.5 0 106s47.5 106 106 106 106-47.5 106-106S164.5 0 106 0z" />
              <path className="fill-card" d="M106 45c-20.7 0-37.5 16.8-37.5 37.5S85.3 120 106 120s37.5-16.8 37.5-37.5S126.7 45 106 45zm0 105c-28.3 0-52.5 14.3-52.5 32v10h105v-10c0-17.7-24.2-32-52.5-32z" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-medium text-foreground truncate">{contact?.name || "Contato"}</p>
          <p className="text-[13px] text-muted-foreground truncate">{contact?.phone || ""}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {onCreateContact && !hasCrmContact && (
            <button
              onClick={onCreateContact}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-full transition-colors"
              title="Criar contato no CRM"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="16" y1="11" x2="22" y2="11"/>
              </svg>
              Criar Contato
            </button>
          )}
          {onCreateDeal && (
            <button
              onClick={onCreateDeal}
              className="p-1.5 hover:bg-muted rounded-full transition-colors group relative"
              title="Criar negociação"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="stroke-muted-foreground" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 3h-8l-2 4h12z"/>
                <line x1="12" y1="12" x2="12" y2="18"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </button>
          )}
          <button className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <Search className="w-5 h-5 text-muted-foreground" />
          </button>
          <button className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* ─── Messages Area ─── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative py-2" style={{ scrollBehavior: "smooth" }}>
        {messagesQ.isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : groupedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-3">
              <Send className="w-7 h-7 text-emerald-500" />
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
                return <MessageBubble key={msg.id} msg={msg} isFirst={isFirst} isLast={isLast} />;
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-card shadow-lg flex items-center justify-center hover:bg-muted transition-colors z-20"
          >
            <ArrowDown className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* ─── Input Area ─── */}
      <div className="bg-muted border-t border-border px-4 py-2.5 z-10">
        {isRecording ? (
          <VoiceRecorder
            onSend={handleVoiceSend}
            onCancel={() => setIsRecording(false)}
          />
        ) : (
          <div className="flex items-end gap-2">
            {/* Emoji button (placeholder) */}
            <button className="p-2 hover:bg-muted rounded-full transition-colors shrink-0 self-end mb-0.5">
              <Smile className="w-6 h-6 text-muted-foreground" />
            </button>

            {/* Attach button */}
            <div className="relative shrink-0 self-end mb-0.5">
              <button
                onClick={() => setShowAttach(!showAttach)}
                className={`p-2 rounded-full transition-colors ${showAttach ? "bg-muted" : "hover:bg-muted"}`}
              >
                <Paperclip className="w-6 h-6 text-muted-foreground rotate-45" />
              </button>
              {showAttach && <AttachMenu onSelect={handleAttachSelect} onClose={() => setShowAttach(false)} />}
            </div>

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={messageText}
                onChange={handleTextareaChange}
                placeholder="Mensagem"
                rows={1}
                className="w-full bg-card rounded-lg px-3 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground border-none outline-none resize-none leading-[20px]"
                style={{ height: "42px", maxHeight: "140px" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
            </div>

            {/* Send or Mic button */}
            {messageText.trim() ? (
              <button
                onClick={handleSend}
                disabled={sendMessage.isPending || isSending}
                className="p-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-full transition-colors shrink-0 self-end disabled:opacity-50"
              >
                {sendMessage.isPending || isSending ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Send className="w-5 h-5 text-white" />
                )}
              </button>
            ) : (
              <button
                onClick={() => setIsRecording(true)}
                className="p-2.5 hover:bg-muted rounded-full transition-colors shrink-0 self-end"
              >
                <Mic className="w-6 h-6 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
        multiple
        className="hidden"
        onChange={handleDocSelect}
      />

      {/* Sending overlay */}
      {isSending && (
        <div className="absolute inset-0 bg-black/10 flex items-center justify-center z-30 rounded-lg">
          <div className="bg-card rounded-xl px-6 py-4 shadow-xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span className="text-sm text-foreground">Enviando...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Utilities ───
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
