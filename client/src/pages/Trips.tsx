import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Plane } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TENANT_ID = 1;

export default function Trips() {
  const [open, setOpen] = useState(false);
  const [dest, setDest] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const utils = trpc.useUtils();

  const trips = trpc.crm.trips.list.useQuery({ tenantId: TENANT_ID });
  const createTrip = trpc.crm.trips.create.useMutation({
    onSuccess: () => { utils.crm.trips.list.invalidate(); setOpen(false); setDest(""); toast.success("Viagem criada!"); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Viagens</h1><p className="text-muted-foreground">Gerencie roteiros e pacotes de viagem.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Viagem</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Viagem</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Destino *</Label><Input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="Ex: Cancún, México" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Ida</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                <div><Label>Volta</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
              </div>
              <Button className="w-full" disabled={!dest} onClick={() => createTrip.mutate({ tenantId: TENANT_ID, destinationSummary: dest, startDate: startDate || undefined, endDate: endDate || undefined })}>Criar Viagem</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/30">
          <th className="text-left p-3 font-medium">Destino</th><th className="text-left p-3 font-medium">Ida</th><th className="text-left p-3 font-medium">Volta</th><th className="text-left p-3 font-medium">Status</th>
        </tr></thead>
        <tbody>
          {trips.isLoading ? <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
          : !trips.data?.length ? <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><Plane className="h-8 w-8 mx-auto mb-2 opacity-40" />Nenhuma viagem cadastrada.</td></tr>
          : trips.data.map((t: any) => (
            <tr key={t.id} className="border-b hover:bg-muted/20"><td className="p-3 font-medium">{t.destinationSummary || "—"}</td>
              <td className="p-3 text-muted-foreground">{t.startDate ? new Date(t.startDate).toLocaleDateString("pt-BR") : "—"}</td>
              <td className="p-3 text-muted-foreground">{t.endDate ? new Date(t.endDate).toLocaleDateString("pt-BR") : "—"}</td>
              <td className="p-3"><Badge variant="secondary">{t.status || "planning"}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table></div></CardContent></Card>
    </div>
  );
}
