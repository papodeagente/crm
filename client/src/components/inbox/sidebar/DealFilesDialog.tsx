/**
 * DealFilesDialog — Wraps the full DealFilesPanel in a modal dialog for use in sidebar.
 */
import { X, Paperclip } from "lucide-react";
import DealFilesPanel from "@/components/DealFilesPanel";

interface DealFilesDialogProps {
  open: boolean;
  onClose: () => void;
  dealId: number;
}

export default function DealFilesDialog({ open, onClose, dealId }: DealFilesDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-border/50 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <Paperclip className="w-[18px] h-[18px] text-white" />
            </div>
            <h3 className="text-[16px] font-semibold text-foreground">Documentos</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Full DealFilesPanel */}
        <div className="flex-1 overflow-y-auto">
          <DealFilesPanel dealId={dealId} />
        </div>
      </div>
    </div>
  );
}
