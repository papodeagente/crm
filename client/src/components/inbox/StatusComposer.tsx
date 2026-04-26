/**
 * StatusComposer — Post WhatsApp Status/Stories via Z-API
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { X, Type, Image as ImageIcon, Video, Send, Palette } from "lucide-react";
import { toast } from "sonner";

interface StatusComposerProps {
  sessionId: string;
  onClose: () => void;
}

const BG_COLORS = [
  "#075e54", "#128c7e", "#25d366", "#dcf8c6",
  "#1a237e", "#283593", "#3949ab", "#5c6bc0",
  "#b71c1c", "#c62828", "#d32f2f", "#e53935",
  "#f57f17", "#f9a825", "#fbc02d", "#ffca28",
  "#4a148c", "#6a1b9a", "#7b1fa2", "#8e24aa",
];

const FONTS = [
  { value: 0, label: "Sans Serif" },
  { value: 1, label: "Serif" },
  { value: 2, label: "Norican" },
  { value: 3, label: "Courier" },
  { value: 4, label: "Oswald" },
];

export default function StatusComposer({ sessionId, onClose }: StatusComposerProps) {
  const [mode, setMode] = useState<"text" | "image" | "video">("text");
  const [text, setText] = useState("");
  const [bgColor, setBgColor] = useState("#075e54");
  const [font, setFont] = useState(0);
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");

  const sendTextMut = trpc.whatsapp.sendStatusText.useMutation({
    onSuccess: () => { toast.success("Status publicado!"); onClose(); },
    onError: (e) => toast.error(e.message || "Erro ao publicar status"),
  });
  const sendImageMut = trpc.whatsapp.sendStatusImage.useMutation({
    onSuccess: () => { toast.success("Status com imagem publicado!"); onClose(); },
    onError: (e) => toast.error(e.message || "Erro ao publicar status"),
  });
  const sendVideoMut = trpc.whatsapp.sendStatusVideo.useMutation({
    onSuccess: () => { toast.success("Status com vídeo publicado!"); onClose(); },
    onError: (e) => toast.error(e.message || "Erro ao publicar status"),
  });

  const isSending = sendTextMut.isPending || sendImageMut.isPending || sendVideoMut.isPending;

  const handleSend = () => {
    if (mode === "text") {
      if (!text.trim()) return toast.error("Digite o texto do status");
      sendTextMut.mutate({ sessionId, message: text.trim(), backgroundColor: bgColor, font });
    } else if (mode === "image") {
      if (!mediaUrl.trim()) return toast.error("Insira a URL da imagem");
      sendImageMut.mutate({ sessionId, image: mediaUrl.trim(), caption: caption.trim() || undefined });
    } else {
      if (!mediaUrl.trim()) return toast.error("Insira a URL do vídeo");
      sendVideoMut.mutate({ sessionId, video: mediaUrl.trim(), caption: caption.trim() || undefined });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl border border-border w-[460px] max-w-[95vw] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="text-lg font-semibold">Publicar Status</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-5 h-5" /></button>
        </div>
        {/* Mode selector */}
        <div className="flex border-b border-border shrink-0">
          {([
            { mode: "text" as const, icon: Type, label: "Texto" },
            { mode: "image" as const, icon: ImageIcon, label: "Imagem" },
            { mode: "video" as const, icon: Video, label: "Vídeo" },
          ]).map(t => (
            <button key={t.mode} onClick={() => setMode(t.mode)}
              className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${mode === t.mode ? "text-wa-tint border-b-2 border-wa-tint" : "text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {mode === "text" && (
            <>
              {/* Preview */}
              <div className="rounded-lg p-4 min-h-[120px] flex items-center justify-center" style={{ backgroundColor: bgColor }}>
                <p className="text-white text-center text-lg whitespace-pre-wrap">{text || "Seu status aqui..."}</p>
              </div>
              <textarea placeholder="Texto do status..." value={text} onChange={e => setText(e.target.value)} rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint resize-none" />
              <div>
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1"><Palette className="w-3 h-3" /> Cor de fundo</label>
                <div className="flex flex-wrap gap-1.5">
                  {BG_COLORS.map(color => (
                    <button key={color} onClick={() => setBgColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${bgColor === color ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fonte</label>
                <div className="flex flex-wrap gap-1.5">
                  {FONTS.map(f => (
                    <button key={f.value} onClick={() => setFont(f.value)}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${font === f.value ? "bg-wa-tint text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {(mode === "image" || mode === "video") && (
            <>
              <input type="text" placeholder={mode === "image" ? "URL da imagem" : "URL do vídeo"} value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
              <textarea placeholder="Legenda (opcional)" value={caption} onChange={e => setCaption(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint resize-none" />
              {mediaUrl && mode === "image" && (
                <img src={mediaUrl} alt="Preview" className="rounded-lg max-h-[200px] object-contain mx-auto" onError={e => (e.currentTarget.style.display = "none")} />
              )}
            </>
          )}
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors">Cancelar</button>
          <button onClick={handleSend} disabled={isSending}
            className="px-4 py-2 text-sm bg-wa-tint text-white rounded-lg hover:opacity-90 transition-colors flex items-center gap-1.5 disabled:opacity-50">
            <Send className="w-4 h-4" /> {isSending ? "Publicando..." : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}
