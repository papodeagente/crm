import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Plane, MapPin, Calendar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TENANT_ID = 1;

const tripStatusStyles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  planning: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", label: "Planejando" },
  booked: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Reservado" },
  confirmed: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Confirmado" },
  in_progress: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Em andamento" },
  completed: { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500", label: "Concluído" },
  cancelled: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Cancelado" },
};

export default function Trips() {
  const [open, setOpen] = useState(false);
  const [dest, setDest] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const utils = trpc.useUtils();

  const trips = trpc.crm.trips.list.useQuery({ tenantId: TENANT_ID });
  const createTrip = trpc.crm.trips.create.useMutation({
    onSuccess: () => { utils.crm.trips.list.invalidate(); setOpen(false); setDest(""); setStartDate(""); setEndDate(""); toast.success("Viagem criada!"); },
  });

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Viagens</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie roteiros e pacotes de viagem.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-9 gap-2 px-5 rounded-xl shadow-soft bg-gradient-to-r from-primary to-[oklch(0.50_0.14_264)] hover:opacity-90 text-[13px] font-semibold">
              <Plus className="h-4 w-4" />Nova Viagem
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-lg">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><Plane className="h-4 w-4 text-primary" /></div>
                Nova Viagem
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-3">
              <div><Label className="text-[12px] font-medium">Destino *</Label><Input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="Ex: Cancún, México" className="mt-1.5 h-10 rounded-xl" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-[12px] font-medium">Ida</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1.5 h-10 rounded-xl" /></div>
                <div><Label className="text-[12px] font-medium">Volta</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1.5 h-10 rounded-xl" /></div>
              </div>
              <Button className="w-full h-11 rounded-xl text-[14px] font-semibold shadow-soft bg-gradient-to-r from-primary to-[oklch(0.50_0.14_264)] hover:opacity-90" disabled={!dest || createTrip.isPending} onClick={() => createTrip.mutate({ tenantId: TENANT_ID, destinationSummary: dest, startDate: startDate || undefined, endDate: endDate || undefined })}>
                {createTrip.isPending ? "Criando..." : "Criar Viagem"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-soft rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Destino</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Ida</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Volta</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {trips.isLoading ? (
                <tr><td colSpan={4} className="p-12 text-center text-muted-foreground text-sm">Carregando...</td></tr>
              ) : !trips.data?.length ? (
                <tr><td colSpan={4} className="p-12 text-center text-muted-foreground">
                  <Plane className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm">Nenhuma viagem cadastrada.</p>
                </td></tr>
              ) : trips.data.map((t: any) => {
                const ss = tripStatusStyles[t.status] || tripStatusStyles["planning"];
                return (
                  <tr key={t.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-50 to-violet-50 flex items-center justify-center shrink-0">
                          <MapPin className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-semibold">{t.destinationSummary || "—"}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-muted-foreground">
                      {t.startDate ? <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{new Date(t.startDate).toLocaleDateString("pt-BR")}</span> : "—"}
                    </td>
                    <td className="p-3.5 text-muted-foreground">
                      {t.endDate ? <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{new Date(t.endDate).toLocaleDateString("pt-BR")}</span> : "—"}
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${ss.bg} ${ss.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                        {ss.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
