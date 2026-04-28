/**
 * PublicProposal — visualização pública da proposta em /p/:token (sem login).
 *
 * Layout standalone, mobile-first. Mostra:
 *   - Logo + nome da empresa (branding do tenant)
 *   - Bloco "Proposta para X"
 *   - Tabela de itens
 *   - Totais
 *   - Notas
 *   - Botão "Aceitar proposta" (modal com nome+email) → atualiza status
 *   - Link Asaas se houver cobrança
 */

import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2, AlertCircle, Loader2, Calendar, ExternalLink, Sparkles, Mail,
} from "lucide-react";
import { toast } from "sonner";

function brl(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function formatDate(d: any) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDocId(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return raw;
}

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
        <p className="text-muted-foreground text-sm">
          O link parece estar inválido ou a proposta foi removida.
        </p>
      </div>
    );
  }

  const p = proposalQ.data as any;
  const branding = p.branding || {};
  const primary = branding.primaryColor || "#5A8A1F";
  const isAccepted = p.status === "accepted" || accepted;
  const isExpired = p.isExpired && !isAccepted;

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
      });
      setAccepted(true);
      setShowAccept(false);
      if (r?.asaasInvoiceUrl) {
        setPaymentUrl(r.asaasInvoiceUrl);
      }
      toast.success("Proposta aceita ✓");
    } catch (e: any) {
      toast.error(e.message || "Erro ao aceitar proposta");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950" style={{ fontFamily: branding.fontFamily ? `${branding.fontFamily}, Inter, sans-serif` : undefined }}>
      {/* Banner topo */}
      <div className="h-1.5" style={{ backgroundColor: primary }} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border overflow-hidden">

          {/* Header */}
          <div className="p-6 sm:p-8 border-b flex items-start gap-4">
            {branding.logoUrl && (
              <img
                src={branding.logoUrl}
                alt={branding.name || "Logo"}
                className="h-14 w-14 object-contain rounded-md"
              />
            )}
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold">{branding.name || "Empresa"}</h1>
              <p className="text-sm text-muted-foreground">Proposta comercial</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Proposta</p>
              <p className="text-lg font-bold">#{p.id}</p>
              {p.sentAt && <p className="text-xs text-muted-foreground">Emitida em {formatDate(p.sentAt)}</p>}
            </div>
          </div>

          {/* Status banners */}
          {isAccepted && (
            <div className="bg-emerald-50 border-b border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-700/40 px-6 py-3 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">Proposta aceita</p>
                <p className="text-xs text-muted-foreground">Obrigado! A equipe entrará em contato em breve.</p>
              </div>
            </div>
          )}
          {isExpired && (
            <div className="bg-amber-50 border-b border-amber-200 dark:bg-amber-950/30 dark:border-amber-700/40 px-6 py-3 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm">Esta proposta expirou em {formatDate(p.validUntil)}. Solicite uma nova ao seu contato.</p>
            </div>
          )}

          {/* Cliente */}
          {p.client && (
            <div className="p-6 sm:p-8 border-b">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Proposta para</p>
              <p className="text-lg font-bold">{p.client.name}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                {p.client.email && <span>{p.client.email}</span>}
                {p.client.phone && <span>{p.client.phone}</span>}
                {p.client.docId && <span>CPF/CNPJ: {formatDocId(p.client.docId)}</span>}
              </div>
              {p.validUntil && !isExpired && (
                <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Válida até {formatDate(p.validUntil)}
                </p>
              )}
            </div>
          )}

          {/* Itens */}
          <div className="p-6 sm:p-8">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Itens</h2>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: primary }} className="text-white">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-xs">Descrição</th>
                    <th className="text-center px-2 py-2 font-semibold text-xs w-12">Qtd</th>
                    <th className="text-center px-2 py-2 font-semibold text-xs w-12 hidden sm:table-cell">Unid.</th>
                    <th className="text-right px-2 py-2 font-semibold text-xs w-24 hidden sm:table-cell">Preço</th>
                    <th className="text-right px-3 py-2 font-semibold text-xs w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {p.items.map((item: any, idx: number) => (
                    <tr key={item.id} className={`border-t ${idx % 2 ? "bg-slate-50/50 dark:bg-slate-800/30" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.title}</p>
                        {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                      </td>
                      <td className="text-center px-2 py-3">{item.qty}</td>
                      <td className="text-center px-2 py-3 text-muted-foreground hidden sm:table-cell">{item.unit || "un"}</td>
                      <td className="text-right px-2 py-3 hidden sm:table-cell tabular-nums">{brl(item.unitPriceCents, p.currency)}</td>
                      <td className="text-right px-3 py-3 font-bold tabular-nums">{brl(item.totalCents, p.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totais */}
            <div className="mt-5 ml-auto max-w-xs space-y-1.5 text-sm">
              {p.subtotalCents !== p.totalCents && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{brl(p.subtotalCents, p.currency)}</span>
                  </div>
                  {p.discountCents > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Desconto</span>
                      <span className="tabular-nums">-{brl(p.discountCents, p.currency)}</span>
                    </div>
                  )}
                  {p.taxCents > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Impostos / taxas</span>
                      <span className="tabular-nums">+{brl(p.taxCents, p.currency)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="border-t pt-2 mt-2 flex justify-between items-baseline">
                <span className="font-bold text-base">Total</span>
                <span className="text-2xl font-bold tabular-nums" style={{ color: primary }}>
                  {brl(p.totalCents, p.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Notas */}
          {p.notes && (
            <div className="p-6 sm:p-8 border-t">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Observações</h2>
              <p className="text-sm whitespace-pre-wrap">{p.notes}</p>
            </div>
          )}

          {/* Aceite + pagamento */}
          {!isAccepted && !isExpired && (
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
          )}

          {(isAccepted || paymentUrl || p.asaasInvoiceUrl) && (p.asaasInvoiceUrl || paymentUrl) && (
            <div className="p-6 sm:p-8 border-t text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Pagamento</p>
              <a
                href={paymentUrl || p.asaasInvoiceUrl}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: primary }}
              >
                <ExternalLink className="h-4 w-4" />
                Pagar com PIX, Boleto ou Cartão
              </a>
              <p className="text-xs text-muted-foreground mt-2">Pagamento processado via Asaas — seguro e rastreável</p>
            </div>
          )}

          {/* Footer branding */}
          {(branding.address || branding.phone || branding.website || branding.footerText) && (
            <div className="p-6 sm:p-8 border-t bg-slate-50 dark:bg-slate-800/20 text-center text-xs text-muted-foreground">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                {branding.address && <span>{branding.address}</span>}
                {branding.phone && <span>{branding.phone}</span>}
                {branding.website && <span>{branding.website}</span>}
              </div>
              {branding.footerText && <p className="mt-2">{branding.footerText}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Accept dialog */}
      <Dialog open={showAccept} onOpenChange={setShowAccept}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aceitar proposta #{p.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Por favor, confirme seu nome para registrar o aceite.
            </p>
            <div>
              <label className="text-xs text-muted-foreground">Seu nome completo *</label>
              <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Como aparece no seu documento" autoFocus />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email (opcional)</label>
              <Input type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAccept(false)}>Cancelar</Button>
            <Button onClick={handleAccept} disabled={acceptMut.isPending || !signerName.trim()} style={{ backgroundColor: primary }} className="text-white">
              {acceptMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirmar aceite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
