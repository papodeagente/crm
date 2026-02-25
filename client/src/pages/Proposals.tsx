import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";

const TENANT_ID = 1;
const statusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-700", sent: "bg-blue-100 text-blue-700", viewed: "bg-amber-100 text-amber-700", accepted: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-700", expired: "bg-gray-100 text-gray-500" };

export default function Proposals() {
  const proposals = trpc.proposals.list.useQuery({ tenantId: TENANT_ID });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Propostas</h1><p className="text-muted-foreground">Crie e acompanhe propostas comerciais.</p></div>
        <Button onClick={() => toast("Criação de proposta em breve")}><Plus className="h-4 w-4 mr-2" />Nova Proposta</Button>
      </div>
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/30"><th className="text-left p-3 font-medium">#</th><th className="text-left p-3 font-medium">Deal</th><th className="text-left p-3 font-medium">Valor</th><th className="text-left p-3 font-medium">Status</th><th className="text-left p-3 font-medium">Criada em</th></tr></thead>
        <tbody>
          {proposals.isLoading ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
          : !proposals.data?.length ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />Nenhuma proposta encontrada.</td></tr>
          : proposals.data.map((p: any) => (
            <tr key={p.id} className="border-b hover:bg-muted/20">
              <td className="p-3 font-medium">#{p.id}</td>
              <td className="p-3">Deal #{p.dealId}</td>
              <td className="p-3">{p.totalCents ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.totalCents / 100) : "—"}</td>
              <td className="p-3"><Badge variant="secondary" className={statusColors[p.status] || ""}>{p.status}</Badge></td>
              <td className="p-3 text-muted-foreground">{p.createdAt ? new Date(p.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table></div></CardContent></Card>
    </div>
  );
}
