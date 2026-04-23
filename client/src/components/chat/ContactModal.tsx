/**
 * ContactModal — Send contact via Z-API /send-contact
 * Extracted from WhatsAppChat.tsx lines 1156-1181
 */

import { useState } from "react";
import { Contact } from "lucide-react";
import { toast } from "sonner";

interface ContactModalProps {
  onSend: (contacts: Array<{ fullName: string; phoneNumber: string }>) => void;
  onClose: () => void;
}

export default function ContactModal({ onSend, onClose }: ContactModalProps) {
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl border border-border w-[400px] max-w-[90vw] p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Contact className="w-5 h-5 text-wa-tint" /> Enviar Cliente
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
