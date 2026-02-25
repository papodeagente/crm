import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Briefcase, MoreHorizontal, Trash2, TrendingUp, DollarSign } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const TENANT_ID = 1;

const statusStyles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  open: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Aberto" },
  won: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Ganho" },
  lost: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Perdido" },
};

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
  const totalValue = (deals.data || []).reduce((sum: number, d: any) => sum + (d.valueCents || 0), 0);
  const openCount = (deals.data || []).filter((d: any) => d.status === "open").length;
  const wonCount = (deals.data || []).filter((d: any) => d.status === "won").length;

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Negócios</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {openCount} abertos \u2022 {wonCount} ganhos \u2022 Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValue / 100)}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-9 gap-2 px-5 rounded-xl shadow-soft bg-gradient-to-r from-primary to-[oklch(0.50_0.14_264)] hover:opacity-90 text-[13px] font-semibold">
              <Plus className="h-4 w-4" />Novo Negócio
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-lg">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><Briefcase className="h-4 w-4 text-primary" /></div>
                Novo Negócio
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-3">
              <div><Label className="text-[12px] font-medium">Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Pacote Cancún - João" className="mt-1.5 h-10 rounded-xl" /></div>
              <div><Label className="text-[12px] font-medium">Valor (R$)</Label><Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="5000.00" type="number" className="mt-1.5 h-10 rounded-xl" /></div>
              <Button className="w-full h-11 rounded-xl text-[14px] font-semibold shadow-soft bg-gradient-to-r from-primary to-[oklch(0.50_0.14_264)] hover:opacity-90" disabled={!title || createDeal.isPending} onClick={() => {
                if (!defaultPipeline) { toast.error("Crie um pipeline primeiro na seção Funil."); return; }
                createDeal.mutate({ tenantId: TENANT_ID, title, pipelineId: defaultPipeline.id, stageId: 1, valueCents: value ? Math.round(parseFloat(value) * 100) : undefined });
              }}>
                {createDeal.isPending ? "Criando..." : "Criar Negócio"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border-0 shadow-soft p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center"><Briefcase className="h-5 w-5 text-blue-600" /></div>
          <div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Abertos</p><p className="text-lg font-bold">{openCount}</p></div>
        </div>
        <div className="rounded-2xl bg-white border-0 shadow-soft p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
          <div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Ganhos</p><p className="text-lg font-bold">{wonCount}</p></div>
        </div>
        <div className="rounded-2xl bg-white border-0 shadow-soft p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center"><DollarSign className="h-5 w-5 text-violet-600" /></div>
          <div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Valor Total</p><p className="text-lg font-bold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValue / 100)}</p></div>
        </div>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-soft rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Título</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Valor</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Status</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Probabilidade</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Criado em</th>
                <th className="p-3.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {deals.isLoading ? (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground text-sm">Carregando...</td></tr>
              ) : !deals.data?.length ? (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">
                  <Briefcase className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm">Nenhum negócio encontrado.</p>
                </td></tr>
              ) : deals.data.map((d: any) => {
                const ss = statusStyles[d.status] || statusStyles["open"];
                return (
                  <tr key={d.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-[12px] font-bold text-primary shrink-0">
                          {d.title?.charAt(0)?.toUpperCase() || "N"}
                        </div>
                        <span className="font-semibold">{d.title}</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-semibold">{d.valueCents ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(d.valueCents / 100) : "—"}</td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${ss.bg} ${ss.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                        {ss.label}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {d.probability != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${d.probability}%` }} />
                          </div>
                          <span className="text-[12px] text-muted-foreground">{d.probability}%</span>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="p-3.5 text-muted-foreground">{d.createdAt ? new Date(d.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => toast("Edição em breve")}>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
