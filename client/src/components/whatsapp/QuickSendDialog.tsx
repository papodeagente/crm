import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, MessageCircle, AlertTriangle } from "lucide-react";

interface QuickSendDialogProps {
  contactId: number;
  contactName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickSendDialog({ contactId, contactName, open, onOpenChange }: QuickSendDialogProps) {
  const [message, setMessage] = useState("");
  const status = trpc.whatsappQuick.contactStatus.useQuery(
    { contactId },
    { enabled: open },
  );
  const send = trpc.whatsappQuick.send.useMutation({
    onSuccess: () => {
      toast.success("Mensagem enviada!");
      setMessage("");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const canSend = status.data?.canSend === true;
  const reason = !canSend ? (status.data as any)?.reason : null;
  const reasonText =
    reason === "no_phone" ? "Contato sem telefone cadastrado."
    : reason === "no_session" ? "Conecte o WhatsApp da clínica em Configurações → WhatsApp."
    : reason === "contact_not_found" ? "Contato não encontrado."
    : reason ? "Não é possível enviar agora." : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            Enviar WhatsApp{contactName ? ` para ${contactName}` : ""}
          </DialogTitle>
        </DialogHeader>

        {reasonText && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{reasonText}</span>
          </div>
        )}

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Digite a mensagem..."
          rows={5}
          maxLength={4000}
          disabled={!canSend || send.isPending}
        />
        <p className="text-[11px] text-muted-foreground text-right">{message.length}/4000</p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={send.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => send.mutate({ contactId, message: message.trim() })}
            disabled={!canSend || !message.trim() || send.isPending}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {send.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
