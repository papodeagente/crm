/**
 * WhatsAppLabelsSection — Z-API native WhatsApp Business labels
 * Displays in the tags panel alongside CRM-level tags
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { X, Plus, Tag } from "lucide-react";
import { toast } from "sonner";

interface WhatsAppLabelsSectionProps {
  sessionId: string;
  remoteJid: string;
}

const WA_LABEL_COLORS: Record<number, string> = {
  0: "#00a884", 1: "#53bdeb", 2: "#ffd279", 3: "#ff7eb6", 4: "#a78bfa",
  5: "#f87171", 6: "#fb923c", 7: "#a3e635", 8: "#38bdf8", 9: "#c084fc",
  10: "#f472b6", 11: "#34d399", 12: "#fbbf24", 13: "#60a5fa", 14: "#e879f9",
  15: "#4ade80", 16: "#f97316", 17: "#818cf8", 18: "#fb7185", 19: "#2dd4bf",
};

export default function WhatsAppLabelsSection({ sessionId, remoteJid }: WhatsAppLabelsSectionProps) {
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(0);

  const labelsQ = trpc.whatsapp.getLabels.useQuery(
    { sessionId },
    { staleTime: 60_000, retry: 1 }
  );

  const addLabelMut = trpc.whatsapp.addLabelToChat.useMutation({
    onSuccess: () => toast.success("Etiqueta adicionada"),
    onError: (e) => toast.error(e.message || "Erro ao adicionar etiqueta"),
  });

  const removeLabelMut = trpc.whatsapp.removeLabelFromChat.useMutation({
    onSuccess: () => toast.success("Etiqueta removida"),
    onError: (e) => toast.error(e.message || "Erro ao remover etiqueta"),
  });

  const createLabelMut = trpc.whatsapp.createLabel.useMutation({
    onSuccess: () => {
      toast.success("Etiqueta criada");
      labelsQ.refetch();
      setNewLabelName("");
    },
    onError: (e) => toast.error(e.message || "Erro ao criar etiqueta"),
  });

  const labels = (labelsQ.data as any[]) || [];
  const chatId = remoteJid.includes("@") ? remoteJid : `${remoteJid}@s.whatsapp.net`;

  return (
    <div className="border-t border-border">
      <div className="px-4 py-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
          <Tag className="w-3 h-3" /> Etiquetas WhatsApp
        </p>
        {labelsQ.isLoading ? (
          <p className="text-[11px] text-muted-foreground">Carregando...</p>
        ) : labels.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nenhuma etiqueta</p>
        ) : (
          <div className="space-y-1">
            {labels.map((label: any) => (
              <div key={label.id} className="flex items-center justify-between group">
                <button
                  onClick={() => addLabelMut.mutate({ sessionId, chatId, tagId: label.id })}
                  className="flex items-center gap-2 px-2 py-1 rounded text-left text-[12px] hover:bg-muted transition-colors flex-1"
                >
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: WA_LABEL_COLORS[label.color] || label.hexColor || "#888" }} />
                  {label.name}
                </button>
                <button
                  onClick={() => removeLabelMut.mutate({ sessionId, chatId, tagId: label.id })}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted rounded transition-all"
                  title="Remover etiqueta"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Create new WhatsApp label */}
      <div className="px-4 py-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          <select
            value={newLabelColor} onChange={(e) => setNewLabelColor(Number(e.target.value))}
            className="w-8 h-6 rounded cursor-pointer border border-border text-[10px] bg-background p-0 text-center"
            style={{ backgroundColor: WA_LABEL_COLORS[newLabelColor] || "#888", color: "white" }}
          >
            {Object.entries(WA_LABEL_COLORS).map(([k, color]) => (
              <option key={k} value={k} style={{ backgroundColor: color, color: "white" }}>
                {Number(k) + 1}
              </option>
            ))}
          </select>
          <input
            value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)}
            placeholder="Nova etiqueta..."
            className="flex-1 text-[12px] bg-muted/50 rounded px-2 py-1 outline-none focus:ring-1 ring-primary"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newLabelName.trim()) {
                createLabelMut.mutate({ sessionId, name: newLabelName.trim(), color: newLabelColor });
              }
            }}
          />
          <button
            disabled={!newLabelName.trim()}
            onClick={() => newLabelName.trim() && createLabelMut.mutate({ sessionId, name: newLabelName.trim(), color: newLabelColor })}
            className="text-[11px] text-primary font-medium hover:underline disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
