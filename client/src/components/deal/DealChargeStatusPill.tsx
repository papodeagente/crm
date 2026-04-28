/**
 * DealChargeStatusPill — pill compacto que mostra status da cobrança Asaas em um deal.
 *
 * Renderiza apenas quando deal tem asaasPaymentId.
 * Click abre mini-dialog com link de pagamento + ações.
 */

import { useState } from "react";
import { CheckCircle2, AlertTriangle, Clock, ExternalLink, Copy } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  asaasPaymentId: string | null | undefined;
  asaasPaymentStatus: string | null | undefined;
  asaasInvoiceUrl: string | null | undefined;
  asaasBankSlipUrl: string | null | undefined;
  asaasBillingType: string | null | undefined;
  asaasDueDate: string | Date | null | undefined;
  className?: string;
}

const PAID = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
const OVERDUE = ["OVERDUE"];
const REFUNDED = ["REFUNDED", "REFUND_REQUESTED"];

function statusInfo(status: string | null | undefined) {
  const s = status || "";
  if (PAID.includes(s)) return { label: "Pago ✓", className: "bg-emerald-100 text-emerald-700 border-emerald-300" };
  if (OVERDUE.includes(s)) return { label: "Vencida", className: "bg-red-100 text-red-700 border-red-300" };
  if (REFUNDED.includes(s)) return { label: "Estornada", className: "bg-amber-100 text-amber-700 border-amber-300" };
  return { label: "Aguardando", className: "bg-blue-100 text-blue-700 border-blue-300" };
}

export default function DealChargeStatusPill({
  asaasPaymentId, asaasPaymentStatus, asaasInvoiceUrl, asaasBankSlipUrl,
  asaasBillingType, asaasDueDate, className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  if (!asaasPaymentId) return null;
  const info = statusInfo(asaasPaymentStatus);
  const link = asaasInvoiceUrl || asaasBankSlipUrl || "";

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${info.className} hover:opacity-80 transition-opacity ${className}`}
        title="Ver cobrança"
      >
        {info.label === "Pago ✓"
          ? <CheckCircle2 className="h-3 w-3" />
          : info.label === "Vencida"
          ? <AlertTriangle className="h-3 w-3" />
          : <Clock className="h-3 w-3" />}
        {info.label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cobrança Asaas</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Status:</span> <strong>{asaasPaymentStatus || "—"}</strong></p>
            <p><span className="text-muted-foreground">Tipo:</span> {asaasBillingType || "—"}</p>
            {asaasDueDate && (
              <p><span className="text-muted-foreground">Vencimento:</span> {new Date(asaasDueDate).toLocaleDateString("pt-BR")}</p>
            )}
            {link && (
              <div className="rounded-lg border bg-muted/30 p-2 flex items-center gap-2">
                <a
                  href={link} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1 flex-1 truncate"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{link}</span>
                </a>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}
                  className="p-1 hover:bg-muted rounded"
                  title="Copiar"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
