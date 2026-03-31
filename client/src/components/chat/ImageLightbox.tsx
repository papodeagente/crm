/**
 * ImageLightbox — Fullscreen image viewer with zoom
 * Extracted from WhatsAppChat.tsx lines 3355-3385
 */

import { X, Download } from "lucide-react";

interface ImageLightboxProps {
  url: string;
  onClose: () => void;
}

export default function ImageLightbox({ url, onClose }: ImageLightboxProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-zoom-out"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      tabIndex={0}
      role="dialog"
      aria-label="Visualizar imagem"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
      >
        <X className="w-6 h-6 text-white" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); window.open(url, '_blank'); }}
        className="absolute top-4 right-16 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
      >
        <Download className="w-6 h-6 text-white" />
      </button>
      <img
        src={url}
        alt="Imagem ampliada"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
