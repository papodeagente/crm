/**
 * EditMessageModal — Edit message via Z-API /send-text with editMessageId
 * Extracted from WhatsAppChat.tsx lines 1239-1259
 */

import { useState } from "react";
import { Pencil } from "lucide-react";

interface EditMessageModalProps {
  currentText: string;
  onSave: (newText: string) => void;
  onClose: () => void;
}

export default function EditMessageModal({ currentText, onSave, onClose }: EditMessageModalProps) {
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
