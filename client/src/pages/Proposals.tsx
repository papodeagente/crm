import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  FileText, Plus, Eye, Send as SendIcon, CheckCircle, XCircle, Clock,
  CreditCard, ExternalLink, RefreshCw, Loader2, Copy, Download, MessageCircle, Pencil,
} from "lucide-react";
import { formatDate } from "../../../shared/dateUtils";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";

const statusStyles: Record<string, { bg: string; text: string; dot: string; label: string; icon: any }> = {
  draft: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", label: "Rascunho", icon: Clock },
  sent: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Enviada", icon: SendIcon },
  viewed: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Visualizada", icon: Eye },
  accepted: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Aceita", icon: CheckCircle },
  rejected: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Rejeitada", icon: XCircle },
  expired: { bg: "bg-slate-50", text: "text-slate-500", dot: "bg-slate-300", label: "Expirada", icon: Clock },
};

const paidStatuses = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
const paymentStatusLabel: Record<string, string> = {
  PENDING: "Aguardando",
  RECEIVED: "Pago",
  CONFIRMED: "Confirmado",
  RECEIVED_IN_CASH: "Pago (dinheiro)",
  OVERDUE: "Vencida",
  REFUNDED: "Estornada",
  REFUND_REQUESTED: "Estorno solicitado",
  CHARGEBACK_REQUESTED: "Chargeback",
  AWAITING_RISK_ANALYSIS: "Análise de risco",
};

export default function Proposals() {
  const proposals = trpc.proposals.list.useQuery({});
  const asaasStatus = trpc.asaas.getStatus.useQuery();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pdfBusy, setPdfBusy] = useState<number | null>(null);
  const [waBusy, setWaBusy] = useState<number | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [dealSearch, setDealSearch] = useState("");

  const dealsQ = trpc.crm.deals.list.useQuery(
    { limit: 100 } as any,
    { enabled: showNewDialog }
  );
  const deals = useMemo(() => {
    const list = (dealsQ.data as any)?.items || (dealsQ.data as any) || [];
    if (!dealSearch) return list.slice(0, 50);
    const q = dealSearch.toLowerCase();
    return list.filter((d: any) =>
      String(d.title || "").toLowerCase().includes(q) ||
      String(d.contactName || "").toLowerCase().includes(q)
    ).slice(0, 50);
  }, [dealsQ.data, dealSearch]);

  const createMut = trpc.proposals.create.useMutation({
    onSuccess: (data: any) => {
      setShowNewDialog(false);
      utils.proposals.list.invalidate();
      if (data?.id) navigate(`/proposals/${data.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendWhatsApp = trpc.proposals.sendWhatsApp.useMutation({
    onSuccess: () => {
      toast.success("Proposta enviada via WhatsApp!");
      utils.proposals.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setWaBusy(null),
  });

  const handleDownloadPdf = async (proposalId: number) => {
    setPdfBusy(proposalId);
    try {
      const result = await utils.client.proposals.getPdfBase64.query({ id: proposalId });
      const bytes = atob(result.base64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = result.fileName; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar PDF");
    } finally {
      setPdfBusy(null);
    }
  };

  const handleSendWhatsApp = (proposalId: number) => {
    setWaBusy(proposalId);
    sendWhatsApp.mutate({ id: proposalId });
  };

  const generateCharge = trpc.asaas.generateChargeForProposal.useMutation({
    onSuccess: (data) => {
      toast.success("Cobrança gerada no ASAAS!");
      if (data.invoiceUrl) {
        window.open(data.invoiceUrl, "_blank", "noopener");
      }
      utils.proposals.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setBusyId(null),
  });

  const syncCharge = trpc.asaas.syncProposalCharge.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado.");
      utils.proposals.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setBusyId(null),
  });

  const handleGenerate = (id: number) => {
    setBusyId(id);
    generateCharge.mutate({ proposalId: id, billingType: "UNDEFINED" });
  };

  const handleSync = (id: number) => {
    setBusyId(id);
    syncCharge.mutate({ proposalId: id });
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const asaasConnected = asaasStatus.data?.connected;

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Propostas</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Crie, envie e cobre suas propostas direto pelo ASAAS.</p>
        </div>
        <Button className="h-9 gap-2 px-5 rounded-lg bg-primary hover:bg-primary/90 shadow-sm text-[13px] font-medium transition-colors" onClick={() => setShowNewDialog(true)}>
          <Plus className="h-4 w-4" />Nova Proposta
        </Button>
      </div>

      {!asaasStatus.isLoading && !asaasConnected && (
        <Card className="border border-amber-200 bg-amber-50/40 shadow-none rounded-xl">
          <div className="p-4 flex items-start gap-3">
            <CreditCard className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-[13px] font-medium text-amber-900">ASAAS não conectado</p>
              <p className="text-[12px] text-amber-700/80 mt-0.5">Vá em <strong>Integrações → ASAAS</strong> para conectar sua conta e gerar cobranças automaticamente.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="text-left p-3.5 font-semibold text-muted-foreground">#</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Negócio</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Valor</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Status</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Pagamento</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Criada em</th>
                <th className="text-right p-3.5 font-semibold text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {proposals.isLoading ? (
                <tr><td colSpan={7} className="p-12 text-center text-muted-foreground text-sm">Carregando...</td></tr>
              ) : !proposals.data?.length ? (
                <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm">Nenhuma proposta encontrada.</p>
                </td></tr>
              ) : proposals.data.map((p: any) => {
                const ss = statusStyles[p.status] || statusStyles["draft"];
                const isPaid = p.asaasPaymentStatus && paidStatuses.has(p.asaasPaymentStatus);
                const payLabel = p.asaasPaymentStatus ? (paymentStatusLabel[p.asaasPaymentStatus] || p.asaasPaymentStatus) : null;
                const busy = busyId === p.id && (generateCharge.isPending || syncCharge.isPending);
                return (
                  <tr key={p.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-semibold">#{p.id}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-muted-foreground">Negócio #{p.dealId}</td>
                    <td className="p-3.5 font-semibold">{p.totalCents ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.totalCents / 100) : "—"}</td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${ss.bg} ${ss.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                        {ss.label}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {payLabel ? (
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${isPaid ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                          <CreditCard className="h-3 w-3" />
                          {payLabel}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="p-3.5 text-muted-foreground">{p.createdAt ? formatDate(p.createdAt) : "—"}</td>
                    <td className="p-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/proposals/${p.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-[11px]"
                            title="Editar proposta"
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-[11px]"
                          onClick={() => handleDownloadPdf(p.id)}
                          disabled={pdfBusy === p.id}
                          title="Baixar PDF da proposta"
                        >
                          {pdfBusy === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                          onClick={() => handleSendWhatsApp(p.id)}
                          disabled={waBusy === p.id}
                          title="Enviar PDF + cobrança via WhatsApp"
                        >
                          {waBusy === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
                          WhatsApp
                        </Button>
                        {p.asaasPaymentId ? (
                          <>
                            {p.asaasInvoiceUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1.5 text-[11px]"
                                onClick={() => window.open(p.asaasInvoiceUrl, "_blank", "noopener")}
                              >
                                <ExternalLink className="h-3 w-3" />Ver
                              </Button>
                            )}
                            {p.asaasInvoiceUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => copyLink(p.asaasInvoiceUrl)}
                                title="Copiar link"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleSync(p.id)}
                              disabled={busy}
                              title="Atualizar status"
                            >
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-[11px]"
                            onClick={() => handleGenerate(p.id)}
                            disabled={busy || !asaasConnected || !p.totalCents}
                            title={!asaasConnected ? "Conecte o ASAAS em Integrações" : !p.totalCents ? "Defina um valor para a proposta" : "Gerar cobrança no ASAAS"}
                          >
                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
                            Cobrar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova proposta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Selecione o negócio que será origem desta proposta.</p>
            <Input
              placeholder="Buscar por título ou cliente..."
              value={dealSearch}
              onChange={(e) => setDealSearch(e.target.value)}
            />
            <div className="border rounded-lg max-h-72 overflow-y-auto">
              {dealsQ.isLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
                </div>
              ) : deals.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum negócio encontrado.</p>
              ) : (
                deals.map((d: any) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => createMut.mutate({ dealId: d.id })}
                    disabled={createMut.isPending}
                    className="w-full text-left px-3 py-2 border-b last:border-0 hover:bg-accent/40 transition-colors"
                  >
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.contactName || "Sem contato"} · #{d.id}</p>
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
