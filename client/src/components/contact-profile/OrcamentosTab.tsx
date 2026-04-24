import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, DollarSign, Loader2, Plus, ShoppingCart } from "lucide-react";
import { Link } from "wouter";

interface OrcamentosTabProps {
  contactId: number;
  deals: any[];
  isLoading: boolean;
}

function formatCurrency(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
}

function statusConfig(s: string) {
  switch (s) {
    case "won": return { label: "Aprovado", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    case "lost": return { label: "Reprovado", color: "bg-red-500/15 text-red-400 border-red-500/30" };
    case "open": return { label: "Em análise", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
    default: return { label: s, color: "bg-muted text-muted-foreground" };
  }
}

export default function OrcamentosTab({ contactId, deals, isLoading }: OrcamentosTabProps) {
  const approvedDeals = deals.filter((d: any) => d.status === "won");
  const openDeals = deals.filter((d: any) => d.status === "open");

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#2E7D5B]" /></div>;
  }

  const displayDeals = [...openDeals, ...approvedDeals];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Orçamentos ({displayDeals.length})
        </h3>
        <Link href="/pipeline">
          <Button size="sm" className="bg-[#2E7D5B] hover:bg-[#256B4D] text-white h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo Orçamento
          </Button>
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Em Análise</p>
            <p className="text-lg font-bold text-blue-400">{openDeals.length}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(openDeals.reduce((s: number, d: any) => s + (d.valueCents || 0), 0))}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Aprovados</p>
            <p className="text-lg font-bold text-emerald-400">{approvedDeals.length}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(approvedDeals.reduce((s: number, d: any) => s + (d.valueCents || 0), 0))}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{displayDeals.length}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(displayDeals.reduce((s: number, d: any) => s + (d.valueCents || 0), 0))}</p>
          </CardContent>
        </Card>
      </div>

      {displayDeals.length === 0 ? (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="text-center py-12">
            <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum orçamento encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {displayDeals.map((deal: any) => {
            const sc = statusConfig(deal.status);
            return (
              <Link key={deal.id} href={`/deal/${deal.id}`}>
                <Card className="border-border/50 bg-card/80 hover:bg-muted/30 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{deal.title}</p>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${sc.color}`}>{sc.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {deal.pipelineName && <span>{deal.pipelineName}</span>}
                          {deal.stageName && <><ChevronRight className="h-3 w-3" /><span>{deal.stageName}</span></>}
                          <span>• {formatDate(deal.createdAt)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-sm font-bold">{formatCurrency(deal.valueCents || 0, deal.currency)}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 ml-2" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
