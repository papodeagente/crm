import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Activity, Loader2, PlayCircle, PauseCircle, CheckCircle2,
  XCircle, ChevronLeft, ChevronRight, Trash2
} from "lucide-react";
import { toast } from "sonner";

interface TratamentosTabProps {
  contactId: number;
  contact?: any;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
}

function statusLabel(s: string) {
  switch (s) {
    case "active": return "Ativo";
    case "completed": return "Concluído";
    case "paused": return "Pausado";
    case "cancelled": return "Cancelado";
    default: return s;
  }
}

export default function TratamentosTab({ contactId, contact }: TratamentosTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [form, setForm] = useState({ name: "", description: "", totalSessions: "", valueCents: "", notes: "" });

  // Consultation notes
  const [previsao, setPrevisao] = useState("");
  const [executado, setExecutado] = useState("");
  const [proximaPrevisao, setProximaPrevisao] = useState("");

  const treatmentsQ = trpc.treatments.list.useQuery({ contactId });
  const utils = trpc.useUtils();

  // Load consultation notes from contact
  useEffect(() => {
    if (contact?.consultationNotes) {
      setPrevisao(contact.consultationNotes.previsao || "");
      setExecutado(contact.consultationNotes.executado || "");
      setProximaPrevisao(contact.consultationNotes.proximaPrevisao || "");
    }
  }, [contact?.consultationNotes]);

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

  const updateContactMut = trpc.crm.contacts.update.useMutation({
    onSuccess: () => {
      utils.crm.contacts.get.invalidate({ id: contactId });
      toast.success("Notas da consulta salvas");
    },
    onError: () => toast.error("Erro ao salvar notas"),
  });

  const treatments = (treatmentsQ.data || []) as any[];
  const filtered = showCompleted ? treatments : treatments.filter((t: any) => t.status !== "completed" && t.status !== "cancelled");
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const paginated = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const startItem = totalItems === 0 ? 0 : page * rowsPerPage + 1;
  const endItem = Math.min((page + 1) * rowsPerPage, totalItems);

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

  function handleSaveNotes() {
    updateContactMut.mutate({
      id: contactId,
      consultationNotes: {
        previsao: previsao || undefined,
        executado: executado || undefined,
        proximaPrevisao: proximaPrevisao || undefined,
      },
    });
  }

  if (treatmentsQ.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#2E7D5B]" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h3 className="text-base font-semibold">Tratamentos</h3>

      {/* Treatments Table */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-0">
          {/* Table header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
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

            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={showCompleted} onCheckedChange={(c) => { setShowCompleted(!!c); setPage(0); }} />
              Mostrar finalizados
            </label>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-t border-b border-border/50 bg-muted/20">
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Tratamentos</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Sessões</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Início Execuç.</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Fim Execução</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum registro encontrado
                    </td>
                  </tr>
                ) : (
                  paginated.map((t: any) => (
                    <tr key={t.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Activity className="h-3.5 w-3.5 text-[#2E7D5B] shrink-0" />
                          <div>
                            <p className="font-medium text-foreground">{t.name}</p>
                            {t.description && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{t.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-3 py-3">
                        <span className="font-medium">{t.completedSessions || 0}</span>
                        {t.totalSessions && <span className="text-muted-foreground">/{t.totalSessions}</span>}
                      </td>
                      <td className="text-center px-3 py-3 text-muted-foreground">{formatDate(t.createdAt)}</td>
                      <td className="text-center px-3 py-3 text-muted-foreground">{formatDate(t.startDate)}</td>
                      <td className="text-center px-3 py-3 text-muted-foreground">{formatDate(t.endDate)}</td>
                      <td className="text-center px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {t.status === "active" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-emerald-400 hover:text-emerald-500"
                                title="Registrar Sessão"
                                onClick={() => addSessionMut.mutate({ id: t.id })}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-amber-400 hover:text-amber-500"
                                title="Pausar"
                                onClick={() => updateMut.mutate({ id: t.id, status: "paused" })}
                              >
                                <PauseCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-500"
                                title="Cancelar"
                                onClick={() => updateMut.mutate({ id: t.id, status: "cancelled" })}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {t.status === "paused" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-blue-400 hover:text-blue-500"
                              title="Retomar"
                              onClick={() => updateMut.mutate({ id: t.id, status: "active" })}
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(t.status === "completed" || t.status === "cancelled") && (
                            <span className="text-[10px] text-muted-foreground">{statusLabel(t.status)}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-end px-4 py-2 border-t border-border/30 gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Linhas por página:</span>
              <Select value={String(rowsPerPage)} onValueChange={v => { setRowsPerPage(Number(v)); setPage(0); }}>
                <SelectTrigger className="h-7 w-14 text-xs border-0 bg-transparent"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="text-xs text-muted-foreground">
              {startItem}-{endItem} de {totalItems}
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consultation Notes */}
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Previsão para esta consulta</label>
          <Textarea
            value={previsao}
            onChange={e => setPrevisao(e.target.value)}
            placeholder="Digite..."
            className="min-h-[80px] bg-background/50"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Executado nessa consulta</label>
          <Textarea
            value={executado}
            onChange={e => setExecutado(e.target.value)}
            placeholder="Digite..."
            className="min-h-[80px] bg-background/50"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Previsão para Próxima consulta</label>
          <Textarea
            value={proximaPrevisao}
            onChange={e => setProximaPrevisao(e.target.value)}
            placeholder="Digite..."
            className="min-h-[80px] bg-background/50"
          />
        </div>

        <div className="flex justify-center pt-1">
          <Button
            onClick={handleSaveNotes}
            disabled={updateContactMut.isPending}
            className="bg-[#2E7D5B] hover:bg-[#256B4D] text-white h-9 px-8 text-xs font-semibold uppercase"
          >
            {updateContactMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "SALVAR"}
          </Button>
        </div>
      </div>
    </div>
  );
}
