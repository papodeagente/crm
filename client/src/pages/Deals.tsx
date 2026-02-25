import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Briefcase, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const TENANT_ID = 1;
const statusColors: Record<string, string> = { open: "bg-blue-100 text-blue-700", won: "bg-emerald-100 text-emerald-700", lost: "bg-red-100 text-red-700" };
const statusLabels: Record<string, string> = { open: "Aberto", won: "Ganho", lost: "Perdido" };

export default function Deals() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const utils = trpc.useUtils();

  const deals = trpc.crm.deals.list.useQuery({ tenantId: TENANT_ID, limit: 100 });
  const pipelines = trpc.crm.pipelines.list.useQuery({ tenantId: TENANT_ID });
  const createDeal = trpc.crm.deals.create.useMutation({
    onSuccess: () => { utils.crm.deals.list.invalidate(); setOpen(false); setTitle(""); setValue(""); toast.success("Negócio criado!"); },
  });

  const defaultPipeline = pipelines.data?.[0];
  const defaultStage = defaultPipeline?.id ? undefined : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Negócios</h1>
          <p className="text-muted-foreground">Acompanhe todos os seus negócios e oportunidades.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Negócio</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Negócio</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Pacote Cancún - João" /></div>
              <div><Label>Valor (R$)</Label><Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="5000.00" type="number" /></div>
              <Button className="w-full" disabled={!title || createDeal.isPending} onClick={() => {
                if (!defaultPipeline) { toast.error("Crie um pipeline primeiro na seção Funil."); return; }
                createDeal.mutate({ tenantId: TENANT_ID, title, pipelineId: defaultPipeline.id, stageId: 1, valueCents: value ? Math.round(parseFloat(value) * 100) : undefined });
              }}>
                {createDeal.isPending ? "Criando..." : "Criar Negócio"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-medium">Título</th>
                <th className="text-left p-3 font-medium">Valor</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Probabilidade</th>
                <th className="text-left p-3 font-medium">Criado em</th>
                <th className="p-3 w-10"></th>
              </tr></thead>
              <tbody>
                {deals.isLoading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
                ) : !deals.data?.length ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground"><Briefcase className="h-8 w-8 mx-auto mb-2 opacity-40" />Nenhum negócio encontrado.</td></tr>
                ) : deals.data.map((d: any) => (
                  <tr key={d.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium">{d.title}</td>
                    <td className="p-3">{d.valueCents ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(d.valueCents / 100) : "—"}</td>
                    <td className="p-3"><Badge variant="secondary" className={statusColors[d.status] || ""}>{statusLabels[d.status] || d.status}</Badge></td>
                    <td className="p-3">{d.probability != null ? `${d.probability}%` : "—"}</td>
                    <td className="p-3 text-muted-foreground">{d.createdAt ? new Date(d.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toast("Edição em breve")}>Editar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
