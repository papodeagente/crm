import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Ticket } from "lucide-react";
import { toast } from "sonner";

const TENANT_ID = 1;

const priorityStyles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  low: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", label: "Baixa" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Média" },
  high: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500", label: "Alta" },
  urgent: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Urgente" },
};

const ticketStatusStyles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  open: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Aberto" },
  in_progress: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Em andamento" },
  resolved: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Resolvido" },
  closed: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", label: "Fechado" },
};

export default function Portal() {
  const tickets = trpc.portal.tickets.list.useQuery({ tenantId: TENANT_ID });

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Portal do Cliente</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie tickets e acesso dos clientes.</p>
        </div>
        <Button className="h-9 gap-2 px-5 rounded-lg bg-primary hover:bg-primary/90 shadow-sm text-[13px] font-medium transition-colors" onClick={() => toast("Criação de ticket em breve")}>
          <Plus className="h-4 w-4" />Novo Ticket
        </Button>
      </div>

      {/* Table */}
      <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="text-left p-3.5 font-semibold text-muted-foreground">#</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Assunto</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Prioridade</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Status</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {tickets.isLoading ? (
                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground text-sm">Carregando...</td></tr>
              ) : !tickets.data?.length ? (
                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">
                  <Ticket className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm">Nenhum ticket encontrado.</p>
                </td></tr>
              ) : tickets.data.map((t: any) => {
                const ps = priorityStyles[t.priority] || priorityStyles["medium"];
                const ts = ticketStatusStyles[t.status] || ticketStatusStyles["open"];
                return (
                  <tr key={t.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                          <Ticket className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-semibold">#{t.id}</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-medium">{t.subject}</td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${ps.bg} ${ps.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ps.dot}`} />{ps.label}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${ts.bg} ${ts.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ts.dot}`} />{ts.label}
                      </span>
                    </td>
                    <td className="p-3.5 text-muted-foreground">{t.createdAt ? new Date(t.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
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
