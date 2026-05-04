/**
 * ProposalsAnalytics — análise comercial de propostas (orçamentos visuais).
 *
 * Foco: medir saúde do funil de fechamento depois que o orçamento foi pra
 * o cliente. Onde estamos perdendo? Quem fecha mais? Quanto tempo leva
 * entre enviar e ouvir "sim"?
 */
import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, FileText, CheckCircle2, XCircle, Clock, Loader2,
  Send, Eye, DollarSign, Sparkles, TrendingUp, AlertTriangle, Award,
} from "lucide-react";
import DateRangeFilter, { useDateFilter } from "@/components/DateRangeFilter";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function formatCompact(cents: number): string {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
  return formatCurrency(cents);
}

// Benchmarks de mercado (clínica de estética):
//  - Taxa de aceite saudável: ≥60% (cliente já passou pela consulta avaliativa)
//  - Tempo até decisão saudável: ≤3 dias (mais que isso, esfria)
function diagnoseAcceptance(rate: number, decided: number): { tone: "ok" | "warn" | "alert"; label: string } {
  if (decided === 0) return { tone: "warn", label: "Sem decisões" };
  if (rate >= 60) return { tone: "ok", label: "Saudável" };
  if (rate >= 40) return { tone: "warn", label: "Mediano" };
  return { tone: "alert", label: "Baixo" };
}
function diagnoseCycle(days: number, accepted: number): { tone: "ok" | "warn" | "alert"; label: string } {
  if (accepted === 0) return { tone: "warn", label: "—" };
  if (days <= 3) return { tone: "ok", label: "Rápido" };
  if (days <= 7) return { tone: "warn", label: "Mediano" };
  return { tone: "alert", label: "Lento" };
}

function ToneBadge({ tone, children }: { tone: "ok" | "warn" | "alert"; children: React.ReactNode }) {
  const cls = tone === "ok"
    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
    : tone === "warn"
    ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
    : "bg-red-500/10 text-red-500 border-red-500/30";
  return <Badge variant="outline" className={`text-[10px] font-semibold ${cls}`}>{children}</Badge>;
}

function KpiCard({
  label, value, subtitle, icon: Icon, color, bg, badge,
}: {
  label: string; value: string; subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; bg: string;
  badge?: { tone: "ok" | "warn" | "alert"; label: string };
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${bg}`}>
            <Icon className={`h-4.5 w-4.5 ${color}`} />
          </div>
          {badge && <ToneBadge tone={badge.tone}>{badge.label}</ToneBadge>}
        </div>
        <p className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-[26px] font-extrabold text-foreground leading-tight mt-1">{value}</p>
        {subtitle && <p className="text-[11.5px] text-muted-foreground mt-1.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function ProposalsAnalytics() {
  const [, navigate] = useLocation();
  const dateFilter = useDateFilter("all");

  const filterInput = useMemo(() => ({
    dateFrom: dateFilter.dates.dateFrom,
    dateTo: dateFilter.dates.dateTo,
  }), [dateFilter.dates]);

  const dataQ = trpc.crmAnalytics.proposals.useQuery(filterInput);
  const m = dataQ.data;

  const acceptDx = m ? diagnoseAcceptance(m.acceptanceRate, m.accepted + m.rejected) : null;
  const cycleDx = m ? diagnoseCycle(m.avgDaysToAccept, m.accepted) : null;

  // Diagnóstico narrativo
  const narrative = useMemo(() => {
    if (!m) return [];
    const lines: string[] = [];
    if (m.totalProposals === 0) {
      lines.push("Nenhuma proposta gerada no período. Antes de medir aceite, precisa ter orçamento saindo — verifique o fluxo de produtos → orçamento dentro das negociações.");
      return lines;
    }
    lines.push(
      `No período, **${m.totalProposals} ${m.totalProposals === 1 ? "proposta" : "propostas"}** foram registradas. Distribuição: ${m.draft} em rascunho, ${m.sent} enviadas, ${m.viewed} visualizadas, ${m.accepted} aceitas e ${m.rejected} rejeitadas.`,
    );

    const decided = m.accepted + m.rejected;
    if (decided > 0) {
      lines.push(
        `A taxa de aceite efetiva (sobre as decididas) é **${m.acceptanceRate}%** ${acceptDx ? `(${acceptDx.label.toLowerCase()})` : ""}. Receita confirmada: **${formatCompact(m.acceptedValueCents)}**${m.rejectedValueCents > 0 ? `, contra ${formatCompact(m.rejectedValueCents)} em propostas recusadas` : ""}.`,
      );
    }

    if (m.accepted > 0 && m.avgDaysToAccept > 0) {
      lines.push(
        `Tempo médio entre envio e aceite: **${m.avgDaysToAccept} dias** ${cycleDx ? `(${cycleDx.label.toLowerCase()})` : ""}. Cliente que decide rápido confia mais — quem demora 7+ dias geralmente desiste.`,
      );
    }

    if ((m.sent + m.viewed) > 0) {
      lines.push(
        `**${m.sent + m.viewed} ${m.sent + m.viewed === 1 ? "proposta esperando" : "propostas esperando"}** decisão (${formatCompact(m.pendingValueCents)} em jogo). Vale fazer follow-up estruturado — a janela mais quente é nas primeiras 48h após o envio.`,
      );
    }

    if (m.byOwner.length > 1) {
      const top = m.byOwner[0];
      const worst = [...m.byOwner].filter(o => o.sent >= 2).sort((a, b) => a.acceptanceRate - b.acceptanceRate)[0];
      if (top.ownerName) {
        lines.push(
          `Maior receita confirmada via proposta: **${top.ownerName}** com ${formatCompact(top.acceptedValueCents)} (${top.acceptanceRate}% de aceite em ${top.accepted + top.rejected} decididas).`,
        );
      }
      if (worst && worst.ownerName && worst !== top && worst.acceptanceRate < 40) {
        lines.push(
          `Atenção: **${worst.ownerName}** tem ${worst.acceptanceRate}% de aceite (${worst.accepted}/${worst.accepted + worst.rejected}). Vale revisar abordagem comercial ou qualificação dos leads atribuídos.`,
        );
      }
    }

    return lines;
  }, [m, acceptDx, cycleDx]);

  // Recomendações dinâmicas
  const recommendations = useMemo(() => {
    if (!m || m.totalProposals === 0) return [];
    const recs: string[] = [];
    if (m.acceptanceRate > 0 && m.acceptanceRate < 50) {
      recs.push("Taxa de aceite abaixo de 50% — auditar argumentos de fechamento e revisar precificação. Clínicas com proposta visual + WhatsApp atingem 60-70%.");
    }
    if (m.avgDaysToAccept > 5) {
      recs.push("Ciclo médio de fechamento longo (>5 dias). Implementar follow-up automático: WhatsApp em D+1 e D+3 reduz drop-off em 20-30%.");
    }
    if ((m.sent + m.viewed) > 5) {
      recs.push(`${m.sent + m.viewed} propostas pendentes — varrer a fila e marcar follow-up imediato para todas com mais de 48h sem resposta.`);
    }
    if (m.rejected > 0 && m.rejectionRate > 30) {
      recs.push("Taxa de rejeição acima de 30% — abrir cada proposta rejeitada e tabular o motivo. Padrão de objeção (preço, timing, escopo) aponta o gargalo real.");
    }
    if (m.draft > 3) {
      recs.push(`${m.draft} propostas paradas em rascunho — atendentes começam mas não enviam. Investigar por que: falta de produto, falta de fechamento na consulta, ou falta de processo de envio.`);
    }
    if (recs.length === 0) {
      recs.push("Funil de propostas saudável. Próximo passo: definir meta de aceite por agente e medir variação MoM.");
    }
    return recs;
  }, [m]);

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate("/analytics")}
            className="h-9 w-9 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight">Análise de orçamentos</h1>
            <p className="text-[13px] text-muted-foreground">
              Quanto sai como proposta, quanto volta como venda, quanto tempo leva — visão de gestor sênior.
            </p>
          </div>
        </div>
        <DateRangeFilter
          compact
          preset={dateFilter.preset}
          onPresetChange={dateFilter.setPreset}
          customFrom={dateFilter.customFrom}
          onCustomFromChange={dateFilter.setCustomFrom}
          customTo={dateFilter.customTo}
          onCustomToChange={dateFilter.setCustomTo}
          onReset={dateFilter.reset}
        />
      </div>

      {dataQ.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !m ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Sem dados.</CardContent></Card>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total de propostas"
              value={String(m.totalProposals)}
              subtitle={`${m.accepted} aceitas · ${m.rejected} rejeitadas · ${m.sent + m.viewed} pendentes`}
              icon={FileText}
              color="text-blue-500"
              bg="bg-blue-500/10"
            />
            <KpiCard
              label="Taxa de aceite"
              value={`${m.acceptanceRate}%`}
              subtitle={`${m.accepted} aceitas / ${m.accepted + m.rejected} decididas`}
              icon={CheckCircle2}
              color="text-emerald-500"
              bg="bg-emerald-500/10"
              badge={acceptDx || undefined}
            />
            <KpiCard
              label="Receita confirmada"
              value={formatCompact(m.acceptedValueCents)}
              subtitle={`Ticket médio: ${formatCompact(m.avgAcceptedTicket)}`}
              icon={DollarSign}
              color="text-violet-500"
              bg="bg-violet-500/10"
            />
            <KpiCard
              label="Ciclo médio"
              value={m.avgDaysToAccept > 0 ? `${m.avgDaysToAccept} ${m.avgDaysToAccept === 1 ? "dia" : "dias"}` : "—"}
              subtitle="Envio → aceite"
              icon={Clock}
              color="text-amber-500"
              bg="bg-amber-500/10"
              badge={cycleDx || undefined}
            />
          </div>

          {/* Funil de propostas */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-[15px] flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Funil de propostas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Rascunho", value: m.draft, color: "bg-slate-500/10 text-slate-500", icon: FileText },
                  { label: "Enviada", value: m.sent, color: "bg-blue-500/10 text-blue-500", icon: Send },
                  { label: "Visualizada", value: m.viewed, color: "bg-cyan-500/10 text-cyan-500", icon: Eye },
                  { label: "Aceita", value: m.accepted, color: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 },
                  { label: "Rejeitada", value: m.rejected, color: "bg-rose-500/10 text-rose-500", icon: XCircle },
                  { label: "Expirada", value: m.expired, color: "bg-amber-500/10 text-amber-500", icon: Clock },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className={`rounded-lg p-3 ${s.color}`}>
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3 h-3 opacity-70" />
                        <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{s.label}</p>
                      </div>
                      <p className="text-[24px] font-extrabold leading-tight mt-0.5">{s.value}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Diagnóstico do gestor */}
          {narrative.length > 0 && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                  Diagnóstico do gestor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-[13.5px] leading-relaxed text-foreground/90">
                {narrative.map((p, i) => (
                  <p key={i} dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>') }} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Ranking por agente */}
          {m.byOwner.length > 0 && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2">
                  <Award className="h-4 w-4 text-emerald-500" />
                  Performance por agente
                </CardTitle>
                <p className="text-[12px] text-muted-foreground">
                  Quem mais converteu propostas em receita confirmada.
                </p>
              </CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead className="border-y border-border/40 bg-muted/30">
                      <tr className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                        <th className="text-left px-4 py-2 font-semibold">Agente</th>
                        <th className="text-right px-3 py-2 font-semibold">Enviadas</th>
                        <th className="text-right px-3 py-2 font-semibold">Aceitas</th>
                        <th className="text-right px-3 py-2 font-semibold">Rejeitadas</th>
                        <th className="text-right px-3 py-2 font-semibold">Taxa</th>
                        <th className="text-right px-3 py-2 font-semibold">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.byOwner.map((o) => {
                        const dx = diagnoseAcceptance(o.acceptanceRate, o.accepted + o.rejected);
                        return (
                          <tr key={o.ownerUserId ?? o.ownerName ?? "x"} className="border-b border-border/30 hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-medium">{o.ownerName || "—"}</td>
                            <td className="text-right px-3 py-2.5 tabular-nums">{o.sent}</td>
                            <td className="text-right px-3 py-2.5 tabular-nums text-emerald-500">{o.accepted}</td>
                            <td className="text-right px-3 py-2.5 tabular-nums text-rose-500">{o.rejected}</td>
                            <td className="text-right px-3 py-2.5 tabular-nums">
                              <span className={
                                dx.tone === "ok" ? "text-emerald-500 font-semibold" :
                                dx.tone === "warn" ? "text-amber-500" : "text-red-500"
                              }>
                                {(o.accepted + o.rejected) > 0 ? `${o.acceptanceRate}%` : "—"}
                              </span>
                            </td>
                            <td className="text-right px-3 py-2.5 tabular-nums font-semibold">
                              {formatCompact(o.acceptedValueCents)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Próximas ações */}
          {recommendations.length > 0 && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Próximas ações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed">
                      <span className="text-emerald-500 mt-0.5">→</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={() => navigate("/proposals")}>
              <FileText className="h-4 w-4 mr-1" />
              Ver propostas
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
