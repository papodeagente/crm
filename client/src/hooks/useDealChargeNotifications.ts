import { useEffect } from "react";
import { toast } from "sonner";
import { getSocketInstance } from "./useSocket";
import { trpc } from "@/lib/trpc";

interface DealChargeUpdated {
  dealId: number;
  paymentId: string;
  status: string;
  paid: boolean;
  paidAt: string | null;
}

export function useDealChargeNotifications() {
  const utils = trpc.useUtils();

  useEffect(() => {
    const socket = getSocketInstance();
    if (!socket) return;

    function handler(data: DealChargeUpdated) {
      utils.crm.deals.invalidate();
      if (data.paid) {
        toast.success(`💰 Cobrança paga (deal #${data.dealId})`, {
          description: `Status Asaas: ${data.status}`,
          duration: 8000,
        });
      } else if (data.status === "OVERDUE") {
        toast.warning(`Cobrança vencida (deal #${data.dealId})`);
      }
    }

    socket.on("dealChargeUpdated", handler);
    return () => { socket.off("dealChargeUpdated", handler); };
  }, [utils]);
}
