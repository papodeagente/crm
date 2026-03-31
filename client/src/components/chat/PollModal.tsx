/**
 * PollModal — Create poll via Z-API /send-poll
 * Extracted from WhatsAppChat.tsx lines 1183-1237
 */

import { useState } from "react";
import { BarChart3, X } from "lucide-react";
import { toast } from "sonner";

interface PollModalProps {
  onSend: (name: string, values: string[], selectableCount: number) => void;
  onClose: () => void;
}

export default function PollModal({ onSend, onClose }: PollModalProps) {
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
