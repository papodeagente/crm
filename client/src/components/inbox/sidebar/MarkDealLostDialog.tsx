/**
 * MarkDealLostDialog — Select loss reason + optional notes to mark deal as lost
 */
import { useState } from "react";
import { XCircle, X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface MarkDealLostDialogProps {
  open: boolean;
  onClose: () => void;
  dealId: number;
}

export default function MarkDealLostDialog({ open, onClose, dealId }: MarkDealLostDialogProps) {
  const [reasonId, setReasonId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const dealQ = trpc.crm.deals.get.useQuery({ id: dealId }, { enabled: open });
  const pipelinesQ = trpc.crm.pipelines.list.useQuery({}, { enabled: open });
  const pipelineType = (pipelinesQ.data as any[])?.find((p: any) => p.id === (dealQ.data as any)?.pipelineId)?.pipelineType as "sales" | "post_sale" | "support" | "recovery" | undefined;
  const reasonsQ = trpc.crm.lossReasons.list.useQuery({ pipelineType } as any, { enabled: open && !!pipelineType });
  const reasons = (reasonsQ.data || []) as Array<{ id: number; name: string }>;

  const utils = trpc.useUtils();
  const updateMut = trpc.crm.deals.update.useMutation({
    onSuccess: () => {
      utils.crm.deals.get.invalidate({ id: dealId });
      utils.contactProfile.getDeals.invalidate();
      utils.contactProfile.getMetrics.invalidate();
      toast.success("Negociação marcada como perdida");
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar"),
  });

  const handleConfirm = () => {
    if (!reasonId) {
      toast.error("Selecione um motivo de perda");
      return;
    }
    updateMut.mutate({
      id: dealId,
      status: "lost",
      lossReasonId: reasonId,
      lossNotes: notes.trim() || undefined,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm mx-4 border border-border/50" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center">
              <XCircle className="w-[18px] h-[18px] text-red-500" />
            </div>
            <h3 className="text-[16px] font-semibold text-foreground">Marcar como Perdida</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Motivo da perda *</label>
            <select
              value={reasonId || ""}
              onChange={e => setReasonId(Number(e.target.value) || null)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary"
            >
              <option value="">Selecione...</option>
              {reasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Observações (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Por que essa negociação foi perdida?"
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={!reasonId || updateMut.isPending}
            className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {updateMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar Perda
          </button>
        </div>
      </div>
    </div>
  );
}
