import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus, Loader2, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";

interface EvolucoesTabProps {
  contactId: number;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

export default function EvolucoesTab({ contactId }: EvolucoesTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "" });

  const evolutionsQ = trpc.evolutions.list.useQuery({ contactId });
  const utils = trpc.useUtils();

  const createMut = trpc.evolutions.create.useMutation({
    onSuccess: () => {
      utils.evolutions.list.invalidate({ contactId });
      setCreateOpen(false);
      setForm({ title: "", content: "" });
      toast.success("Evolução registrada");
    },
    onError: () => toast.error("Erro ao registrar evolução"),
  });

  const deleteMut = trpc.evolutions.delete.useMutation({
    onSuccess: () => {
      utils.evolutions.list.invalidate({ contactId });
      toast.success("Evolução removida");
    },
  });

  const evolutions = (evolutionsQ.data || []) as any[];

  function handleCreate() {
    if (!form.title || !form.content) return;
    createMut.mutate({ contactId, title: form.title, content: form.content });
  }

  if (evolutionsQ.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#2E7D5B]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Evoluções ({evolutions.length})</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#2E7D5B] hover:bg-[#256B4D] text-white h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Nova Evolução
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nova Evolução</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Título *</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Sessão de limpeza - Retorno" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Conteúdo * (registros clínicos, observações)</label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Descreva a evolução do atendimento, observações clínicas, procedimentos realizados..."
                  className="min-h-[200px]"
                />
              </div>
              <Button onClick={handleCreate} disabled={createMut.isPending || !form.title || !form.content} className="w-full bg-[#2E7D5B] hover:bg-[#256B4D] text-white">
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Evolução"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {evolutions.length === 0 ? (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="text-center py-12">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma evolução registrada</p>
            <p className="text-xs text-muted-foreground mt-1">Registre atendimentos e observações clínicas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {evolutions.map((evo: any) => (
            <Card key={evo.id} className="border-border/50 bg-card/80">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{evo.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(evo.createdAt)}</span>
                      {evo.professionalName && <span>• {evo.professionalName}</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => deleteMut.mutate({ id: evo.id })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3" dangerouslySetInnerHTML={{ __html: evo.content }} />
                {evo.photos && evo.photos.length > 0 && (
                  <div className="flex gap-2 pt-2">
                    {evo.photos.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Foto ${i + 1}`} className="h-16 w-16 object-cover rounded-lg border border-border/50" />
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
