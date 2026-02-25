import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";

const TENANT_ID = 1;

export default function Portal() {
  const tickets = trpc.portal.tickets.list.useQuery({ tenantId: TENANT_ID });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Portal do Cliente</h1><p className="text-muted-foreground">Gerencie tickets e acesso dos clientes.</p></div>
        <Button onClick={() => toast("Criação de ticket em breve")}><Plus className="h-4 w-4 mr-2" />Novo Ticket</Button>
      </div>
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/30"><th className="text-left p-3 font-medium">#</th><th className="text-left p-3 font-medium">Assunto</th><th className="text-left p-3 font-medium">Prioridade</th><th className="text-left p-3 font-medium">Status</th><th className="text-left p-3 font-medium">Criado em</th></tr></thead>
        <tbody>
          {tickets.isLoading ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
          : !tickets.data?.length ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground"><Ticket className="h-8 w-8 mx-auto mb-2 opacity-40" />Nenhum ticket encontrado.</td></tr>
          : tickets.data.map((t: any) => (
            <tr key={t.id} className="border-b hover:bg-muted/20">
              <td className="p-3 font-medium">#{t.id}</td>
              <td className="p-3">{t.subject}</td>
              <td className="p-3"><Badge variant="secondary">{t.priority || "medium"}</Badge></td>
              <td className="p-3"><Badge variant="secondary">{t.status || "open"}</Badge></td>
              <td className="p-3 text-muted-foreground">{t.createdAt ? new Date(t.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table></div></CardContent></Card>
    </div>
  );
}
