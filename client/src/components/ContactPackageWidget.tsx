import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Package, Plus, AlertTriangle, CalendarClock, Ban, CheckCircle2, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";

function statusBadge(status: string) {
  switch (status) {
    case "active":
      return (
        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
          Ativo
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30">
          Concluido
        </Badge>
      );
    case "expired":
      return (
        <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/30">
          Expirado
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30">
          Cancelado
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
}

function formatCurrency(value: number | string | null | undefined) {
  if (value == null) return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return null;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string | Date | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function ContactPackageWidget({ contactId }: { contactId: number }) {
  const utils = trpc.useUtils();
  const packagesQ = trpc.packages.list.useQuery({ contactId }, { enabled: contactId > 0 });
  const createMut = trpc.packages.create.useMutation({
    onSuccess: () => {
      utils.packages.list.invalidate({ contactId });
      toast.success("Pacote criado com sucesso");
      setCreateOpen(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message || "Erro ao criar pacote"),
  });
  const useSessionMut = trpc.packages.useSession.useMutation({
    onSuccess: () => {
      utils.packages.list.invalidate({ contactId });
      toast.success("Sessao registrada");
    },
    onError: (err) => toast.error(err.message || "Erro ao registrar sessao"),
  });
  const cancelMut = trpc.packages.cancel.useMutation({
    onSuccess: () => {
      utils.packages.list.invalidate({ contactId });
      toast.success("Pacote cancelado");
      setCancelConfirmId(null);
    },
    onError: (err) => toast.error(err.message || "Erro ao cancelar pacote"),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formSessions, setFormSessions] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formExpiry, setFormExpiry] = useState("");

  function resetForm() {
    setFormName("");
    setFormSessions("");
    setFormPrice("");
    setFormExpiry("");
  }

  function handleCreate() {
    const totalSessions = parseInt(formSessions, 10);
    if (!formName.trim() || isNaN(totalSessions) || totalSessions <= 0) {
      toast.error("Preencha o nome e numero de sessoes");
      return;
    }
    const priceTotal = formPrice ? parseFloat(formPrice.replace(",", ".")) : undefined;
    const expiresAt = formExpiry ? new Date(formExpiry).getTime() : undefined;
    createMut.mutate({
      contactId,
      name: formName.trim(),
      totalSessions,
      priceTotal: priceTotal && !isNaN(priceTotal) ? priceTotal : undefined,
      expiresAt,
    });
  }

  const packages = packagesQ.data || [];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Package className="h-4 w-4 text-muted-foreground" />
            Pacotes de Sessoes
          </CardTitle>
          <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Novo Pacote
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Pacote</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label htmlFor="pkg-name" className="text-xs">Nome do pacote</Label>
                  <Input
                    id="pkg-name"
                    placeholder="Ex: Limpeza de Pele 10x"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="pkg-sessions" className="text-xs">Total de sessoes</Label>
                    <Input
                      id="pkg-sessions"
                      type="number"
                      min={1}
                      placeholder="10"
                      value={formSessions}
                      onChange={(e) => setFormSessions(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pkg-price" className="text-xs">Valor (R$)</Label>
                    <Input
                      id="pkg-price"
                      type="text"
                      inputMode="decimal"
                      placeholder="1.500,00"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pkg-expiry" className="text-xs">Validade (opcional)</Label>
                  <Input
                    id="pkg-expiry"
                    type="date"
                    value={formExpiry}
                    onChange={(e) => setFormExpiry(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleCreate} disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  Criar Pacote
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-2">
        {packagesQ.isLoading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-xs">Carregando...</span>
          </div>
        )}

        {!packagesQ.isLoading && packages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Package className="h-8 w-8 mb-2 opacity-30" />
            <span className="text-xs">Nenhum pacote cadastrado</span>
          </div>
        )}

        {packages.map((pkg) => {
          const remaining = pkg.totalSessions - pkg.usedSessions;
          const isLow = pkg.status === "active" && remaining <= 2 && remaining > 0;
          const progress = pkg.totalSessions > 0
            ? Math.round((pkg.usedSessions / pkg.totalSessions) * 100)
            : 0;

          return (
            <div
              key={pkg.id}
              className={`rounded-lg border p-3 space-y-2 ${
                isLow ? "border-yellow-500/50 bg-yellow-500/5" : ""
              }`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isLow && <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                  <span className="text-sm font-medium truncate">{pkg.name}</span>
                </div>
                {statusBadge(pkg.status)}
              </div>

              {/* Progress */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{pkg.usedSessions}/{pkg.totalSessions} sessoes</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                {formatCurrency(pkg.priceTotal) && (
                  <span>{formatCurrency(pkg.priceTotal)}</span>
                )}
                {pkg.expiresAt && (
                  <span className="flex items-center gap-0.5">
                    <CalendarClock className="h-3 w-3" />
                    {formatDate(pkg.expiresAt)}
                  </span>
                )}
              </div>

              {/* Actions */}
              {pkg.status === "active" && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    disabled={useSessionMut.isPending || remaining <= 0}
                    onClick={() => useSessionMut.mutate({ packageId: pkg.id })}
                  >
                    {useSessionMut.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    )}
                    Usar Sessao
                  </Button>

                  {cancelConfirmId === pkg.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        disabled={cancelMut.isPending}
                        onClick={() => cancelMut.mutate({ packageId: pkg.id })}
                      >
                        {cancelMut.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : null}
                        Confirmar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setCancelConfirmId(null)}
                      >
                        Nao
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                      onClick={() => setCancelConfirmId(pkg.id)}
                    >
                      <Ban className="h-3 w-3 mr-1" />
                      Cancelar
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
