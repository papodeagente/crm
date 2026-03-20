import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Eye, Send as SendIcon, CheckCircle, XCircle, Clock } from "lucide-react";
import { formatDate } from "../../../shared/dateUtils";
import { toast } from "sonner";
const statusStyles: Record<string, { bg: string; text: string; dot: string; label: string; icon: any }> = {
  draft: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", label: "Rascunho", icon: Clock },
  sent: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Enviada", icon: SendIcon },
  viewed: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Visualizada", icon: Eye },
  accepted: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Aceita", icon: CheckCircle },
  rejected: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Rejeitada", icon: XCircle },
  expired: { bg: "bg-slate-50", text: "text-slate-500", dot: "bg-slate-300", label: "Expirada", icon: Clock },
};

export default function Proposals() {
  const proposals = trpc.proposals.list.useQuery({});

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Propostas</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Crie e acompanhe propostas comerciais.</p>
        </div>
        <Button className="h-9 gap-2 px-5 rounded-lg bg-primary hover:bg-primary/90 shadow-sm text-[13px] font-medium transition-colors" onClick={() => toast("Criação de proposta em breve")}>
          <Plus className="h-4 w-4" />Nova Proposta
        </Button>
      </div>

      {/* Table */}
      <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="text-left p-3.5 font-semibold text-muted-foreground">#</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Negócio</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Valor</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Status</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Criada em</th>
              </tr>
            </thead>
            <tbody>
              {proposals.isLoading ? (
                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground text-sm">Carregando...</td></tr>
              ) : !proposals.data?.length ? (
                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm">Nenhuma proposta encontrada.</p>
                </td></tr>
              ) : proposals.data.map((p: any) => {
                const ss = statusStyles[p.status] || statusStyles["draft"];
                return (
                  <tr key={p.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-semibold">#{p.id}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-muted-foreground">Negócio #{p.dealId}</td>
                    <td className="p-3.5 font-semibold">{p.totalCents ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.totalCents / 100) : "—"}</td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${ss.bg} ${ss.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                        {ss.label}
                      </span>
                    </td>
                    <td className="p-3.5 text-muted-foreground">{p.createdAt ? formatDate(p.createdAt) : "—"}</td>
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
