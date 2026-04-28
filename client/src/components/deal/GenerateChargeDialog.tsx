/**
 * GenerateChargeDialog — auto-aberto quando um deal vira "won".
 *
 * Estados:
 *   1. ask: pergunta inicial "Quer gerar cobrança?"  (Sim → form, Depois → fecha)
 *   2. form: tipo + valor + vencimento + descrição + bloco WhatsApp
 *   3. submitting / success
 *
 * Bloqueios:
 *   - Asaas não conectado → CTA "Conectar Asaas"
 *   - Contato sem nome ou (sem CPF E sem email) → aviso
 *   - WA sem sessão ativa → switch desabilitado
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, CreditCard, Smartphone, FileText, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  dealId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

const BILLING_OPTIONS: Array<{ value: BillingType; label: string; icon: any }> = [
  { value: "PIX", label: "PIX", icon: Smartphone },
  { value: "BOLETO", label: "Boleto", icon: FileText },
  { value: "CREDIT_CARD", label: "Cartão", icon: CreditCard },
  { value: "UNDEFINED", label: "Link genérico", icon: ExternalLink },
];

function todayPlusDaysISO(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function GenerateChargeDialog({ dealId, open, onOpenChange }: Props) {
  const [step, setStep] = useState<"ask" | "form">("ask");

  const dealQ = trpc.crm.deals.get.useQuery({ id: dealId! }, { enabled: open && !!dealId });
  const asaasStatusQ = trpc.asaas.getStatus.useQuery(undefined, { enabled: open });
  const sessionsQ = trpc.whatsapp.sessions.useQuery(undefined, { enabled: open });

  const deal = dealQ.data as any;
  const contactQ = trpc.crm.contacts.get.useQuery(
    { id: deal?.contactId ?? 0 },
    { enabled: open && !!deal?.contactId }
  );
  const contact = contactQ.data as any;
  const asaasConnected = (asaasStatusQ.data as any)?.connected;
  const hasActiveWaSession = !!(sessionsQ.data as any[])?.some((s: any) => s.status === "connected");

  const valueCentsDefault = Number(deal?.valueCents ?? 0);
  const [billingType, setBillingType] = useState<BillingType>("PIX");
  const [valueCents, setValueCents] = useState<number>(valueCentsDefault);
  const [dueDate, setDueDate] = useState<string>(todayPlusDaysISO(7));
  const [description, setDescription] = useState<string>("");
  const [sendWa, setSendWa] = useState<boolean>(true);
  const [waMessage, setWaMessage] = useState<string>("");

  // Sincroniza valor padrão quando deal carregar
  useMemo(() => {
    if (deal?.valueCents != null) setValueCents(Number(deal.valueCents));
    if (deal?.title) setDescription(deal.title);
  }, [deal?.id]);

  const utils = trpc.useUtils();
  const generateMut = trpc.asaas.generateChargeForDeal.useMutation({
    onSuccess: (data: any) => {
      utils.crm.deals.get.invalidate({ id: dealId! });
      utils.crm.deals.list.invalidate();
      if (data.whatsappSent) {
        toast.success("Cobrança gerada · Link enviado via WhatsApp ✓");
      } else if (data.whatsappError) {
        toast.warning(`Cobrança gerada · WhatsApp falhou: ${data.whatsappError}`);
      } else {
        toast.success("Cobrança gerada");
      }
      onOpenChange(false);
      setStep("ask");
    },
    onError: (e) => toast.error(e.message),
  });

  // Validações de bloqueio
  const blocker = useMemo(() => {
    if (!dealQ.data) return null;
    if (asaasStatusQ.isLoading || dealQ.isLoading) return null;
    if (!asaasConnected) {
      return { type: "asaas" as const, msg: "Conecte o Asaas em Integrações antes de gerar cobranças." };
    }
    if (!contact) {
      return { type: "contact" as const, msg: "Negócio sem contato vinculado." };
    }
    if (!contact.name) {
      return { type: "contact" as const, msg: "Contato sem nome — edite o cadastro." };
    }
    if (!contact.email && !contact.docId) {
      return { type: "contact" as const, msg: "Contato precisa de e-mail OU CPF/CNPJ para gerar cobrança." };
    }
    return null;
  }, [dealQ.isLoading, asaasStatusQ.isLoading, asaasConnected, contact]);

  // Já existe cobrança?
  if (deal?.asaasPaymentId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cobrança já gerada</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Este negócio já possui uma cobrança Asaas:</p>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p><strong>Status:</strong> {deal.asaasPaymentStatus || "—"}</p>
              <p><strong>Tipo:</strong> {deal.asaasBillingType || "—"}</p>
              {deal.asaasInvoiceUrl && (
                <a
                  href={deal.asaasInvoiceUrl} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir link de pagamento
                </a>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function handleGenerate() {
    if (!dealId) return;
    generateMut.mutate({
      dealId,
      billingType,
      dueDateISO: dueDate,
      valueCents: valueCents > 0 ? valueCents : undefined,
      description: description || undefined,
      sendViaWhatsApp: sendWa && hasActiveWaSession,
      whatsappMessage: sendWa && waMessage ? waMessage : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {dealQ.isLoading || asaasStatusQ.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
          </div>
        ) : blocker ? (
          <>
            <DialogHeader>
              <DialogTitle>Não foi possível gerar a cobrança</DialogTitle>
            </DialogHeader>
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{blocker.msg}</span>
            </div>
            <DialogFooter>
              {blocker.type === "asaas" ? (
                <Link href="/integrations">
                  <Button>Conectar Asaas</Button>
                </Link>
              ) : (
                <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
              )}
            </DialogFooter>
          </>
        ) : step === "ask" ? (
          <>
            <DialogHeader>
              <DialogTitle>Negócio fechado! 🎉</DialogTitle>
            </DialogHeader>
            <div className="text-sm space-y-2">
              <p className="text-muted-foreground">Quer gerar a cobrança agora?</p>
              <div className="rounded-lg bg-muted/30 p-3 text-sm">
                <p className="font-semibold">{deal?.title}</p>
                <p className="text-muted-foreground">{contact?.name} · {formatCurrency(valueCentsDefault)}</p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Depois</Button>
              <Button onClick={() => setStep("form")}>Sim, gerar</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Gerar cobrança</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Tipo */}
              <div>
                <Label className="text-xs">Forma de pagamento</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {BILLING_OPTIONS.map(opt => {
                    const active = billingType === opt.value;
                    const Icon = opt.icon;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => setBillingType(opt.value)}
                        className={`rounded-lg border p-2 text-xs flex flex-col items-center gap-1 transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    type="number" step="0.01" min={0.01}
                    value={(valueCents / 100).toFixed(2)}
                    onChange={(e) => setValueCents(Math.round(parseFloat(e.target.value || "0") * 100))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Vencimento</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Descrição</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Aparece no comprovante do cliente"
                />
              </div>

              {/* WhatsApp */}
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Enviar link pelo WhatsApp</p>
                    <p className="text-xs text-muted-foreground">
                      {hasActiveWaSession ? "Ao gerar, manda o link direto para o contato" : "Conecte o WhatsApp para habilitar"}
                    </p>
                  </div>
                  <Switch
                    checked={sendWa && hasActiveWaSession}
                    disabled={!hasActiveWaSession}
                    onCheckedChange={setSendWa}
                  />
                </div>
                {sendWa && hasActiveWaSession && (
                  <Textarea
                    rows={4}
                    placeholder={`Olá, ${(contact?.name || "").split(" ")[0]}! Aqui está o link de pagamento referente a ${deal?.title}: {invoiceUrl}\nVencimento: ${new Date(dueDate).toLocaleDateString("pt-BR")}.`}
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                  />
                )}
                {sendWa && hasActiveWaSession && (
                  <p className="text-[11px] text-muted-foreground">
                    Placeholders: <code className="text-[10px]">{"{primeiroNome}"}</code>{" "}
                    <code className="text-[10px]">{"{nome}"}</code>{" "}
                    <code className="text-[10px]">{"{dealTitle}"}</code>{" "}
                    <code className="text-[10px]">{"{invoiceUrl}"}</code>{" "}
                    <code className="text-[10px]">{"{valor}"}</code>{" "}
                    <code className="text-[10px]">{"{vencimento}"}</code>
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleGenerate} disabled={generateMut.isPending || valueCents <= 0}>
                {generateMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Gerando…</> : "Gerar cobrança"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
