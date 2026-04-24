import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { DollarSign, Plus, Loader2, CreditCard, XCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface DebitosTabProps {
  contactId: number;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
}

function statusConfig(s: string) {
  switch (s) {
    case "pending": return { label: "Pendente", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: AlertTriangle };
    case "partial": return { label: "Parcial", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: CreditCard };
    case "paid": return { label: "Pago", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 };
    case "overdue": return { label: "Vencido", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: AlertTriangle };
    case "cancelled": return { label: "Cancelado", color: "bg-muted text-muted-foreground", icon: XCircle };
    default: return { label: s, color: "bg-muted text-muted-foreground", icon: DollarSign };
  }
}

export default function DebitosTab({ contactId }: DebitosTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<number | null>(null);
  const [form, setForm] = useState({ description: "", totalCents: "", paymentMethod: "", notes: "" });
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("");

  const debitsQ = trpc.debits.list.useQuery({ contactId });
  const statsQ = trpc.debits.stats.useQuery({ contactId });
  const utils = trpc.useUtils();

  const createMut = trpc.debits.create.useMutation({
    onSuccess: () => {
      utils.debits.list.invalidate({ contactId });
      utils.debits.stats.invalidate({ contactId });
      setCreateOpen(false);
      setForm({ description: "", totalCents: "", paymentMethod: "", notes: "" });
      toast.success("Débito criado");
    },
    onError: () => toast.error("Erro ao criar débito"),
  });

  const payMut = trpc.debits.addPayment.useMutation({
    onSuccess: (data) => {
      utils.debits.list.invalidate({ contactId });
      utils.debits.stats.invalidate({ contactId });
      setPayOpen(null);
      setPayAmount("");
      if (data?.status === "paid") toast.success("Débito quitado!");
      else toast.success("Pagamento registrado");
    },
    onError: () => toast.error("Erro ao registrar pagamento"),
  });

  const cancelMut = trpc.debits.cancel.useMutation({
    onSuccess: () => {
      utils.debits.list.invalidate({ contactId });
      utils.debits.stats.invalidate({ contactId });
      toast.success("Débito cancelado");
    },
  });

  const debits = (debitsQ.data || []) as any[];
  const stats = (statsQ.data || { totalOwed: 0, totalPaid: 0, pendingCount: 0 }) as any;

  function handleCreate() {
    if (!form.description || !form.totalCents) return;
    createMut.mutate({
      contactId,
      description: form.description,
      totalCents: Math.round(Number(form.totalCents) * 100),
      paymentMethod: form.paymentMethod || undefined,
      notes: form.notes || undefined,
    });
  }

  if (debitsQ.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#2E7D5B]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Débitos ({debits.length})</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#2E7D5B] hover:bg-[#256B4D] text-white h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo Débito
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Débito</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Descrição *</label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Sessão de limpeza de pele" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Valor (R$) *</label>
                  <Input type="number" step="0.01" value={form.totalCents} onChange={(e) => setForm({ ...form, totalCents: e.target.value })} placeholder="150.00" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Forma de Pagamento</label>
                  <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                      <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Observações</label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas..." className="min-h-[60px]" />
              </div>
              <Button onClick={handleCreate} disabled={createMut.isPending || !form.description || !form.totalCents} className="w-full bg-[#2E7D5B] hover:bg-[#256B4D] text-white">
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Débito"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{formatCurrency(stats.totalOwed)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Pago</p>
            <p className="text-lg font-bold text-emerald-400">{formatCurrency(stats.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-lg font-bold text-amber-400">{formatCurrency(stats.totalOwed - stats.totalPaid)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Debit list */}
      {debits.length === 0 ? (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="text-center py-12">
            <DollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum débito registrado</p>
          </CardContent>
        </Card>
      ) : (
        debits.map((d: any) => {
          const sc = statusConfig(d.status);
          const Icon = sc.icon;
          const paidPercent = d.totalCents > 0 ? Math.round((d.paidCents / d.totalCents) * 100) : 0;
          const remaining = d.totalCents - d.paidCents;
          return (
            <Card key={d.id} className="border-border/50 bg-card/80">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#2E7D5B]" />
                      <p className="font-medium text-sm">{d.description}</p>
                      <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                    </div>
                    {d.treatmentName && <p className="text-xs text-muted-foreground">Tratamento: {d.treatmentName}</p>}
                    {d.dueDate && <p className="text-xs text-muted-foreground">Vencimento: {formatDate(d.dueDate)}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(d.totalCents)}</p>
                    {d.paidCents > 0 && d.status !== "paid" && (
                      <p className="text-xs text-emerald-400">Pago: {formatCurrency(d.paidCents)}</p>
                    )}
                  </div>
                </div>

                {d.status !== "paid" && d.status !== "cancelled" && (
                  <>
                    <Progress value={paidPercent} className="h-1.5" />
                    <div className="flex gap-2">
                      <Dialog open={payOpen === d.id} onOpenChange={(o) => { setPayOpen(o ? d.id : null); if (!o) setPayAmount(""); }}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            <CreditCard className="h-3 w-3 mr-1" /> Registrar Pagamento
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <p className="text-sm">Restante: <strong>{formatCurrency(remaining)}</strong></p>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
                              <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={String(remaining / 100)} />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Forma de Pagamento</label>
                              <Select value={payMethod} onValueChange={setPayMethod}>
                                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pix">PIX</SelectItem>
                                  <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                                  <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                  <SelectItem value="boleto">Boleto</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button onClick={() => { if (payAmount) payMut.mutate({ id: d.id, amountCents: Math.round(Number(payAmount) * 100), paymentMethod: payMethod || undefined }); }}
                              disabled={payMut.isPending || !payAmount} className="w-full bg-[#2E7D5B] hover:bg-[#256B4D] text-white">
                              {payMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => cancelMut.mutate({ id: d.id })}>
                        <XCircle className="h-3 w-3 mr-1" /> Cancelar
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
