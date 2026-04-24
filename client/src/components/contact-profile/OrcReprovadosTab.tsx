import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, XCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";

interface OrcReprovadosTabProps {
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

export default function OrcReprovadosTab({ contactId, deals, isLoading }: OrcReprovadosTabProps) {
  const rejectedDeals = deals.filter((d: any) => d.status === "lost");

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#2E7D5B]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Orçamentos Reprovados ({rejectedDeals.length})
        </h3>
      </div>

      {/* Summary */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total perdido</p>
              <p className="text-xl font-bold text-red-400">
                {formatCurrency(rejectedDeals.reduce((s: number, d: any) => s + (d.valueCents || 0), 0))}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Quantidade</p>
              <p className="text-xl font-bold text-red-400">{rejectedDeals.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {rejectedDeals.length === 0 ? (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="text-center py-12">
            <XCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum orçamento reprovado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rejectedDeals.map((deal: any) => (
            <Link key={deal.id} href={`/deal/${deal.id}`}>
              <Card className="border-border/50 bg-card/80 hover:bg-muted/30 transition-colors cursor-pointer opacity-75">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-400" />
                        <p className="font-medium text-sm truncate">{deal.title}</p>
                        <Badge variant="outline" className="text-[10px] bg-red-500/15 text-red-400 border-red-500/30">Perdido</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {deal.pipelineName && <span>{deal.pipelineName}</span>}
                        {deal.stageName && <><ChevronRight className="h-3 w-3" /><span>{deal.stageName}</span></>}
                        <span>• {formatDate(deal.createdAt)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-bold text-red-400">{formatCurrency(deal.valueCents || 0, deal.currency)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 ml-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
