/**
 * MediaLoader — Download-on-demand media loader with fallback states
 * Extracted from WhatsAppChat.tsx lines 389-508
 * Note: Z-API media files expire in 30 days
 */

import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Download, Loader2, Mic, Image as ImageIcon, Play, FileText,
} from "lucide-react";
import AudioPlayer from "./AudioPlayer";

interface MediaLoaderProps {
  sessionId: string;
  messageId: string;
  messageType: string;
  mediaDuration?: number | null;
  isVoiceNote?: boolean | null;
  mediaFileName?: string | null;
  mediaMimeType?: string | null;
  fromMe?: boolean;
  avatarUrl?: string | null;
  onImageClick?: (url: string) => void;
}

export default function MediaLoader({
  sessionId, messageId, messageType, mediaDuration, isVoiceNote,
  mediaFileName, mediaMimeType, fromMe, avatarUrl, onImageClick,
}: MediaLoaderProps) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const getMediaUrlMut = trpc.whatsapp.getMediaUrl.useMutation();

  const isAudio = ["audioMessage", "pttMessage"].includes(messageType);
  const isImage = messageType === "imageMessage";
  const isVideo = messageType === "videoMessage";
  const isDocument = messageType === "documentMessage";
  const isSticker = messageType === "stickerMessage";

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
        <img src={mediaUrl} alt="Imagem" className="max-w-full sm:max-w-[300px] w-full h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity rounded-lg" loading="lazy" onClick={() => onImageClick?.(mediaUrl)}
          onError={() => setUnavailable(true)} />
      </div>
    );
    if (isVideo) return (
      <div className="relative -mx-1 -mt-0.5 mb-1 overflow-hidden rounded-md">
        <video src={mediaUrl} controls className="max-w-full sm:max-w-[300px] w-full h-auto rounded-md" preload="metadata"
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
    // Nao mostra "expirado" — a causa real geralmente e falha de download.
    // Permite retry manual: usuario toca e tentamos de novo (cooldown de 10min no backend).
    return (
      <button
        onClick={() => { setUnavailable(false); handleLoad(); }}
        className="flex items-center gap-2 p-2 -mx-0.5 rounded-md bg-foreground/5 hover:bg-foreground/10 transition-colors mb-1 min-w-[200px]"
        title="Toque pra tentar de novo"
      >
        {isAudio ? <Mic className="w-4 h-4 text-muted-foreground" /> :
         isImage ? <ImageIcon className="w-4 h-4 text-muted-foreground" /> :
         isVideo ? <Play className="w-4 h-4 text-muted-foreground" /> :
         isDocument ? <FileText className="w-4 h-4 text-muted-foreground" /> :
         <Download className="w-4 h-4 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground italic">
          {isAudio ? `Áudio${mediaDuration ? ` (${Math.floor(mediaDuration / 60)}:${(mediaDuration % 60).toString().padStart(2, "0")})` : ""}` :
           isImage ? "Imagem" : isVideo ? "Vídeo" : isDocument ? (mediaFileName || "Documento") : "Mídia"}
          {" "}— toque para tentar de novo
        </span>
      </button>
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
