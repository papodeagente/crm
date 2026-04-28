/**
 * Aba "Negociações" — KPIs comerciais + tabela completa de deals do contato.
 *
 * KPIs: total negociado, ganho, em andamento, conversão, ticket médio,
 * ciclo médio de venda, dias desde última compra, motivos de perda por etapa.
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, DollarSign, Trophy, Target, Clock, Calendar,
  AlertCircle, Loader2, Activity, Flame, BarChart3, ChevronRight,
} from "lucide-react";

interface Props {
  contactId: number;
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
    case "won": return { label: "Ganha", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" };
    case "lost": return { label: "Perdida", color: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" };
    case "open": return { label: "Em andamento", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" };
    default: return { label: s, color: "bg-muted text-muted-foreground" };
  }
}

export default function NegociacoesTab({ contactId }: Props) {
  const metricsQ = trpc.contactProfile.getCommercialMetrics.useQuery({ contactId });
  const dealsQ = trpc.contactProfile.getDeals.useQuery({ contactId });

  const m = metricsQ.data;
  const deals = (dealsQ.data || []) as any[];

  const groupedDeals = useMemo(() => {
    const open = deals.filter(d => d.status === "open");
    const won = deals.filter(d => d.status === "won");
    const lost = deals.filter(d => d.status === "lost");
    return { open, won, lost };
  }, [deals]);

  if (metricsQ.isLoading || dealsQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando indicadores…
      </div>
    );
  }

  const conversionPct = m?.conversionRate != null ? `${Math.round(m.conversionRate * 100)}%` : "—";

  return (
    <div className="space-y-6">
      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          icon={DollarSign}
          label="Total negociado"
          value={formatCurrency(m?.totalNegotiatedCents ?? 0)}
          sub={`${m?.totalDeals ?? 0} negociações`}
        />
        <Kpi
          icon={Trophy}
          label="Total ganho"
          value={formatCurrency(m?.totalWonCents ?? 0)}
          sub={`${m?.wonDeals ?? 0} ganhas`}
          highlight
        />
        <Kpi
          icon={Activity}
          label="Em andamento"
          value={formatCurrency(m?.totalOpenCents ?? 0)}
          sub={`${m?.openDeals ?? 0} ativas`}
        />
        <Kpi
          icon={AlertCircle}
          label="Total perdido"
          value={formatCurrency(m?.totalLostCents ?? 0)}
          sub={`${m?.lostDeals ?? 0} perdidas`}
        />

        <Kpi
          icon={Target}
          label="Conversão"
          value={conversionPct}
          sub={m?.lostDeals != null ? `${m.wonDeals} ganhas / ${m.lostDeals} perdidas` : ""}
        />
        <Kpi
          icon={TrendingUp}
          label="Ticket médio"
          value={m?.avgTicketCents != null ? formatCurrency(m.avgTicketCents) : "—"}
          sub="por negociação ganha"
        />
        <Kpi
          icon={Clock}
          label="Ciclo médio"
          value={m?.avgSalesCycleDays != null ? `${m.avgSalesCycleDays}d` : "—"}
          sub="da abertura ao fechamento"
        />
        <Kpi
          icon={Calendar}
          label="Última compra"
          value={m?.daysSinceLastWon != null ? `${m.daysSinceLastWon}d atrás` : "Nunca"}
          sub={m?.lastWonAt ? formatDate(m.lastWonAt) : ""}
        />
      </div>

      {/* ─── Motivos de perda por etapa ─── */}
      {m?.lostByStage && m.lostByStage.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold">Onde estão sendo perdidas</h3>
            </div>
            <div className="space-y-2">
              {m.lostByStage.map((s: any) => (
                <div key={s.stageName} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.stageName}</span>
                  <span className="font-medium">
                    {s.count}× <span className="text-muted-foreground">·</span>{" "}
                    <span className="text-red-600 dark:text-red-400">{formatCurrency(s.valueCents)}</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Tabela de negociações ─── */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Todas as negociações ({deals.length})</h3>
          </div>
          {deals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Sem negociações registradas para este contato.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Negociação</th>
                    <th className="text-left px-3 py-2 font-medium">Etapa</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-right px-3 py-2 font-medium">Valor</th>
                    <th className="text-left px-3 py-2 font-medium">Criada</th>
                    <th className="text-left px-3 py-2 font-medium">Última atividade</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d: any) => {
                    const sc = statusConfig(d.status);
                    return (
                      <tr key={d.id} className="border-t hover:bg-accent/30">
                        <td className="px-4 py-2">
                          <Link href={`/deals/${d.id}`} className="font-medium hover:text-primary truncate block max-w-[260px]">
                            {d.title || `Negociação #${d.id}`}
                          </Link>
                          {d.pipelineName && (
                            <span className="text-[11px] text-muted-foreground">{d.pipelineName}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">{d.stageName ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-xs ${sc.color}`}>{sc.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          {d.valueCents ? formatCurrency(d.valueCents, d.currency) : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(d.createdAt)}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(d.lastActivityAt || d.updatedAt)}</td>
                        <td className="px-2 py-2 text-right">
                          <Link href={`/deals/${d.id}`} className="inline-flex text-muted-foreground hover:text-primary">
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {deals.length > 0 && (
            <div className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>{groupedDeals.open.length} em andamento</span>
              <span>·</span>
              <span>{groupedDeals.won.length} ganhas</span>
              <span>·</span>
              <span>{groupedDeals.lost.length} perdidas</span>
              {m?.daysSinceLastDeal != null && (
                <>
                  <span>·</span>
                  <span>Última criada há {m.daysSinceLastDeal}d</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  highlight = false,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/40" : ""}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wider">
          <Icon className="h-3 w-3" />
          {label}
        </div>
        <p className={`mt-1 text-lg font-bold tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</p>
        {sub ? <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}
