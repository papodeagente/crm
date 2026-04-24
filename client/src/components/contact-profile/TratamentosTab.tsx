import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Activity, Loader2, PlayCircle, PauseCircle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface TratamentosTabProps {
  contactId: number;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function statusConfig(s: string) {
  switch (s) {
    case "active": return { label: "Ativo", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: PlayCircle };
    case "completed": return { label: "Concluído", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: CheckCircle2 };
    case "paused": return { label: "Pausado", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: PauseCircle };
    case "cancelled": return { label: "Cancelado", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: XCircle };
    default: return { label: s, color: "bg-muted text-muted-foreground", icon: Activity };
  }
}

export default function TratamentosTab({ contactId }: TratamentosTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", totalSessions: "", valueCents: "", notes: "" });

  const treatmentsQ = trpc.treatments.list.useQuery({ contactId });
  const utils = trpc.useUtils();

  const createMut = trpc.treatments.create.useMutation({
    onSuccess: () => {
      utils.treatments.list.invalidate({ contactId });
      setCreateOpen(false);
      setForm({ name: "", description: "", totalSessions: "", valueCents: "", notes: "" });
      toast.success("Tratamento criado");
    },
    onError: () => toast.error("Erro ao criar tratamento"),
  });

  const addSessionMut = trpc.treatments.addSession.useMutation({
    onSuccess: (data) => {
      utils.treatments.list.invalidate({ contactId });
      if (data?.status === "completed") toast.success("Tratamento concluído!");
      else toast.success("Sessão registrada");
    },
  });

  const updateMut = trpc.treatments.update.useMutation({
    onSuccess: () => {
      utils.treatments.list.invalidate({ contactId });
      toast.success("Tratamento atualizado");
    },
  });

  const treatments = (treatmentsQ.data || []) as any[];

  function handleCreate() {
    if (!form.name) return;
    createMut.mutate({
      contactId,
      name: form.name,
      description: form.description || undefined,
      totalSessions: form.totalSessions ? Number(form.totalSessions) : undefined,
      valueCents: form.valueCents ? Math.round(Number(form.valueCents) * 100) : undefined,
      notes: form.notes || undefined,
    });
  }

  if (treatmentsQ.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#2E7D5B]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tratamentos ({treatments.length})</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#2E7D5B] hover:bg-[#256B4D] text-white h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo Tratamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Tratamento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Limpeza de Pele" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes do tratamento..." className="min-h-[60px]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Total de Sessões</label>
                  <Input type="number" value={form.totalSessions} onChange={(e) => setForm({ ...form, totalSessions: e.target.value })} placeholder="10" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
                  <Input type="number" step="0.01" value={form.valueCents} onChange={(e) => setForm({ ...form, valueCents: e.target.value })} placeholder="500.00" />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={createMut.isPending || !form.name} className="w-full bg-[#2E7D5B] hover:bg-[#256B4D] text-white">
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Tratamento"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {treatments.length === 0 ? (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="text-center py-12">
            <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum tratamento registrado</p>
          </CardContent>
        </Card>
      ) : (
        treatments.map((t: any) => {
          const sc = statusConfig(t.status);
          const Icon = sc.icon;
          const progress = t.totalSessions ? Math.round((t.completedSessions / t.totalSessions) * 100) : 0;
          return (
            <Card key={t.id} className="border-border/50 bg-card/80">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#2E7D5B]" />
                      <p className="font-semibold text-sm">{t.name}</p>
                      <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                    {t.professionalName && <p className="text-xs text-muted-foreground">Profissional: {t.professionalName}</p>}
                  </div>
                  <div className="text-right">
                    {t.valueCents && <p className="text-sm font-bold">{formatCurrency(t.valueCents)}</p>}
                  </div>
                </div>

                {t.totalSessions && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t.completedSessions} / {t.totalSessions} sessões</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {t.status === "active" && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addSessionMut.mutate({ id: t.id })}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Registrar Sessão
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-400" onClick={() => updateMut.mutate({ id: t.id, status: "paused" })}>
                      <PauseCircle className="h-3 w-3 mr-1" /> Pausar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => updateMut.mutate({ id: t.id, status: "cancelled" })}>
                      <XCircle className="h-3 w-3 mr-1" /> Cancelar
                    </Button>
                  </div>
                )}
                {t.status === "paused" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateMut.mutate({ id: t.id, status: "active" })}>
                    <PlayCircle className="h-3 w-3 mr-1" /> Retomar
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
