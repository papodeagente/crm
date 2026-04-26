/**
 * AttachMenu — Dropdown with attachment type options
 * Extracted from WhatsAppChat.tsx lines 1018-1046
 */

import { Image as ImageIcon, Camera, FileText, Contact } from "lucide-react";

interface AttachMenuProps {
  onSelect: (type: string) => void;
  onClose: () => void;
}

const items = [
  { type: "image", icon: ImageIcon, label: "Fotos e Vídeos", color: "#7C3AED" },
  { type: "camera", icon: Camera, label: "Câmera", color: "#EC4899" },
  { type: "document", icon: FileText, label: "Documento", color: "#6366F1" },
  { type: "contact", icon: Contact, label: "Passageiro", color: "#3B82F6" },
];

export default function AttachMenu({ onSelect, onClose }: AttachMenuProps) {
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
