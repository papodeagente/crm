/**
 * PublicProposal — visualização pública da proposta em /p/:token (sem login).
 *
 * Usa ProposalView (compartilhado com o preview do editor) e adiciona o fluxo
 * de aceite com pad de assinatura.
 */

import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ProposalView, { type ProposalViewData } from "@/components/proposals/ProposalView";
import SignaturePad from "@/components/proposals/SignaturePad";

export default function PublicProposal() {
  const [, params] = useRoute("/p/:token");
  const token = params?.token || "";
  const proposalQ = trpc.publicProposal.get.useQuery(
    { token },
    { enabled: !!token, retry: false, refetchOnWindowFocus: false }
  );
  const acceptMut = trpc.publicProposal.accept.useMutation();

  const [showAccept, setShowAccept] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  if (proposalQ.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (proposalQ.error || !proposalQ.data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <AlertCircle className="h-10 w-10 text-amber-500 mb-3" />
        <h1 className="text-xl font-bold mb-2">Proposta não encontrada</h1>
        <p className="text-muted-foreground text-sm">O link parece estar inválido ou a proposta foi removida.</p>
      </div>
    );
  }

  const p = proposalQ.data as any as ProposalViewData;
  const branding = p.branding || {};
  const primary = branding.primaryColor || "#5A8A1F";
  const isAccepted = (p as any).status === "accepted" || accepted;
  const isExpired = (p as any).isExpired && !isAccepted;

  async function handleAccept() {
    if (!signerName.trim()) {
      toast.error("Por favor, informe seu nome.");
      return;
    }
    try {
      const r: any = await acceptMut.mutateAsync({
        token,
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim() || undefined,
        signatureDataUrl: signatureDataUrl || undefined,
      } as any);
      setAccepted(true);
      setShowAccept(false);
      if (r?.asaasInvoiceUrl) setPaymentUrl(r.asaasInvoiceUrl);
      toast.success("Proposta aceita ✓");
    } catch (e: any) {
      toast.error(e.message || "Erro ao aceitar proposta");
    }
  }

  // Banner notes (status / expired)
  const statusBanner = isAccepted ? (
    <div className="bg-emerald-50 border-b border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-700/40 px-6 py-3 flex items-center gap-3">
      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold text-emerald-700 dark:text-emerald-400">Proposta aceita</p>
        <p className="text-xs text-muted-foreground">Obrigado! A equipe entrará em contato em breve.</p>
      </div>
    </div>
  ) : isExpired ? (
    <div className="bg-amber-50 border-b border-amber-200 dark:bg-amber-950/30 dark:border-amber-700/40 px-6 py-3 flex items-center gap-3">
      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="text-sm">Esta proposta expirou. Solicite uma nova ao seu contato.</p>
    </div>
  ) : null;

  // Override asaasInvoiceUrl on accept response
  const proposalData: ProposalViewData = {
    ...p,
    asaasInvoiceUrl: paymentUrl || p.asaasInvoiceUrl,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950" style={{ fontFamily: branding.fontFamily ? `${branding.fontFamily}, Inter, sans-serif` : undefined }}>
      <div className="h-1.5" style={{ backgroundColor: primary }} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {statusBanner && (
          <div className="rounded-2xl overflow-hidden mb-4 shadow-sm">{statusBanner}</div>
        )}
        <ProposalView
          data={proposalData}
          bottomSlot={!isAccepted && !isExpired ? (
            <div className="p-6 sm:p-8 border-t bg-slate-50/50 dark:bg-slate-800/20 text-center">
              <p className="text-sm text-muted-foreground mb-3">Confirme abaixo se aceita a proposta nas condições descritas:</p>
              <Button
                size="lg"
                onClick={() => setShowAccept(true)}
                style={{ backgroundColor: primary }}
                className="gap-2 text-white hover:opacity-90"
              >
                <Sparkles className="h-4 w-4" />
                Aceitar proposta
              </Button>
            </div>
          ) : null}
        />
      </div>

      <Dialog open={showAccept} onOpenChange={setShowAccept}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aceitar proposta #{p.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Confirme seu nome e assine no pad abaixo para registrar o aceite.
            </p>
            <div>
              <label className="text-xs text-muted-foreground">Nome completo *</label>
              <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Como aparece no documento" autoFocus />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email (opcional)</label>
              <Input type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Assinatura (opcional)</label>
              <SignaturePad value={signatureDataUrl} onChange={setSignatureDataUrl} primaryColor={primary} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAccept(false)}>Cancelar</Button>
            <Button
              onClick={handleAccept}
              disabled={acceptMut.isPending || !signerName.trim()}
              style={{ backgroundColor: primary }}
              className="text-white"
            >
              {acceptMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirmar aceite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
