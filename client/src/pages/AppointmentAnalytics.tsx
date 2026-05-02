import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, CalendarCheck, CalendarX, AlertTriangle, TrendingUp,
  CheckCircle2, XCircle, Clock, Loader2, DollarSign, Sparkles, Target,
} from "lucide-react";
import DateRangeFilter, { useDateFilter } from "@/components/DateRangeFilter";

/**
 * Análise de Agenda × Vendas — relatório no tom de gestor sênior comercial
 * de clínica. Não é um dump de números, é uma leitura crítica: cada KPI tem
 * benchmark do setor, diagnóstico e recomendação acionável.
 *
 * Tudo é alimentado por crmAnalytics.appointmentVendings (mesma tabela
 * crm_appointments correlacionada com deals via dealId).
 */

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function formatCompact(cents: number): string {
  const val = cents / 100;
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `R$ ${(val / 1_000).toFixed(1)}K`;
  return formatCurrency(cents);
}

// Benchmarks de mercado para clínicas (estética/odonto/saúde):
// - Comparecimento saudável: 80–90%
// - No-show aceitável: 8–15%; >20% = crítico
// - Conversão appointment → venda: depende muito do tipo, mas 35–55% é uma faixa típica
//   de clínicas com funil estruturado (consultas avaliativas que viram fechamento)
function diagnoseAttendance(rate: number): { tone: "ok" | "warn" | "alert"; verdict: string } {
  if (rate >= 85) return { tone: "ok", verdict: "Excelente — acima da média do setor (80–85%)" };
  if (rate >= 75) return { tone: "warn", verdict: "Aceitável — há espaço pra subir 5–10pp" };
  if (rate > 0) return { tone: "alert", verdict: "Abaixo do esperado — investigar causas operacionais" };
  return { tone: "warn", verdict: "Sem volume suficiente para diagnóstico" };
}

function diagnoseNoShow(rate: number): { tone: "ok" | "warn" | "alert"; verdict: string } {
  if (rate <= 10) return { tone: "ok", verdict: "Saudável — fluxo de confirmação está funcionando" };
  if (rate <= 18) return { tone: "warn", verdict: "Atenção — reforçar lembretes 24h e 2h antes" };
  if (rate > 0) return { tone: "alert", verdict: "Crítico — a operação está perdendo agenda diariamente" };
  return { tone: "ok", verdict: "Sem registro de faltas no período" };
}

function diagnoseConversion(rate: number, decided: number): { tone: "ok" | "warn" | "alert"; verdict: string } {
  if (decided === 0) return { tone: "warn", verdict: "Sem deals decididos — vincule appointments às negociações para medir" };
  if (rate >= 50) return { tone: "ok", verdict: "Excelente — funil pós-consulta está convertendo" };
  if (rate >= 30) return { tone: "warn", verdict: "Mediano — revisar abordagem comercial pós-consulta" };
  return { tone: "alert", verdict: "Baixo — a consulta gera oportunidade mas não vira venda" };
}

function ToneBadge({ tone, children }: { tone: "ok" | "warn" | "alert"; children: React.ReactNode }) {
  const cls = tone === "ok"
    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
    : tone === "warn"
    ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
    : "bg-red-500/10 text-red-500 border-red-500/30";
  return (
    <Badge variant="outline" className={`text-[10.5px] font-semibold ${cls}`}>
      {children}
    </Badge>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  diagnosis?: { tone: "ok" | "warn" | "alert"; verdict: string };
}

function KpiCard({ label, value, subtitle, icon: Icon, color, bg, diagnosis }: KpiCardProps) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${bg}`}>
            <Icon className={`h-4.5 w-4.5 ${color}`} />
          </div>
          {diagnosis && <ToneBadge tone={diagnosis.tone}>{diagnosis.tone === "ok" ? "Saudável" : diagnosis.tone === "warn" ? "Atenção" : "Crítico"}</ToneBadge>}
        </div>
        <p className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-[28px] font-extrabold text-foreground leading-tight mt-1">{value}</p>
        {subtitle && <p className="text-[11.5px] text-muted-foreground mt-1.5">{subtitle}</p>}
        {diagnosis && (
          <p className="text-[11.5px] text-muted-foreground mt-2 leading-snug border-t border-border/40 pt-2">
            {diagnosis.verdict}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AppointmentAnalytics() {
  const [, navigate] = useLocation();
  const dateFilter = useDateFilter("last30");

  const filterInput = useMemo(() => ({
    dateFrom: dateFilter.dates.dateFrom,
    dateTo: dateFilter.dates.dateTo,
  }), [dateFilter.dates]);

  const dataQ = trpc.crmAnalytics.appointmentVendings.useQuery(filterInput);
  const m = dataQ.data;

  const attendanceDx = m ? diagnoseAttendance(m.attendanceRate) : null;
  const noShowDx = m ? diagnoseNoShow(m.noShowRate) : null;
  const convDx = m ? diagnoseConversion(m.conversionRate, m.wonDealsFromAppointments + m.lostDealsFromAppointments) : null;

  // Narrativa: parágrafos curtos no estilo de um gestor comercial sênior.
  const narrative = useMemo(() => {
    if (!m) return [];
    const lines: string[] = [];
    if (m.totalAppointments === 0) {
      lines.push("Nenhum agendamento no período selecionado. Antes de avaliar conversão, é preciso ocupar a agenda — esse é o primeiro indicador de saúde comercial de uma clínica.");
      return lines;
    }

    // Diagnóstico operacional
    lines.push(
      `No período selecionado a clínica registrou **${m.totalAppointments} consultas** na agenda. Dessas, ${m.completed} foram concluídas, ${m.noShow} resultaram em falta e ${m.cancelled} foram canceladas com antecedência. A taxa de comparecimento ficou em **${m.attendanceRate}%** ${attendanceDx ? `(${attendanceDx.verdict.toLowerCase()})` : ""}.`,
    );

    // Diagnóstico de no-show específico
    if (m.noShow > 0) {
      const lossText = m.potentialLossCents > 0 ? ` Junto com cancelamentos, há **${formatCompact(m.potentialLossCents)}** em negociações abertas ou perdidas vinculadas a essas faltas — receita que está escapando do funil.` : "";
      lines.push(
        `Sobre as ${m.noShow} faltas (${m.noShowRate}% das consultas que deveriam ter acontecido): ${noShowDx?.verdict || ""}.${lossText}`,
      );
    }

    // Diagnóstico comercial
    const decided = m.wonDealsFromAppointments + m.lostDealsFromAppointments;
    if (decided > 0) {
      lines.push(
        `No funil comercial pós-consulta, **${m.wonDealsFromAppointments} negociações foram fechadas** contra ${m.lostDealsFromAppointments} perdidas — conversão de **${m.conversionRate}%**. ${convDx?.verdict || ""}. Receita realizada: **${formatCompact(m.wonRevenueCents)}**${m.avgDaysAppointmentToWon > 0 ? `, com ciclo médio de ${m.avgDaysAppointmentToWon} dias da consulta até o fechamento.` : "."}`,
      );
    } else if (m.appointmentsWithDeal > 0) {
      lines.push(
        `${m.appointmentsWithDeal} consultas estão atreladas a negociações em aberto. Vale acompanhar de perto — todo dia que a negociação não avança é dia de ar para a concorrência.`,
      );
    } else {
      lines.push(
        "Nenhuma consulta tem negociação vinculada — sem isso, é impossível medir a contribuição da agenda no resultado comercial. Garanta que toda marcação no sistema parta de uma negociação.",
      );
    }

    // Recovery
    if (m.noShow > 0) {
      if (m.noShowRecoveredCount > 0) {
        lines.push(
          `Boa notícia: ${m.noShowRecoveredCount} clientes que faltaram (${m.noShowRecoveryRate}%) acabaram fechando depois — sinal de que o follow-up de no-show está funcionando. Mantenha esse processo afiado.`,
        );
      } else {
        lines.push(
          "Nenhum cliente que faltou retornou a fechar negócio no período. Considere: cadência de WhatsApp 24h após no-show, oferta de reagendamento imediato e abordagem no novo agendamento como retomada (não como reinício do funil).",
        );
      }
    }

    return lines;
  }, [m, attendanceDx, noShowDx, convDx]);

  // Recomendações dinâmicas
  const recommendations = useMemo(() => {
    if (!m || m.totalAppointments === 0) return [];
    const recs: string[] = [];
    if (m.noShowRate > 15) {
      recs.push("Implementar lembrete por WhatsApp em D-1 (24h antes) e D-0 manhã (2h antes). Confirmação ativa reduz no-show em 30–50% em clínicas comparáveis.");
    }
    if (m.cancellationRate > 20) {
      recs.push("Avaliar política de cancelamento: clínicas com alto cancelamento prévio costumam ter problema de qualificação no agendamento (cliente não estava pronto para vir).");
    }
    if (m.conversionRate < 35 && (m.wonDealsFromAppointments + m.lostDealsFromAppointments) >= 10) {
      recs.push("Conversão pós-consulta abaixo de 35% pede revisão da abordagem: oferta no momento, fechamento imediato (mesma sessão), gatilho de urgência via desconto à vista.");
    }
    if (m.appointmentsWithDeal < m.totalAppointments * 0.7) {
      recs.push("Mais de 30% das consultas estão sem negociação vinculada. Padronizar o cadastro: toda marcação parte de uma negociação para que o resultado comercial seja rastreável.");
    }
    if (m.noShowRecoveryRate < 10 && m.noShow >= 5) {
      recs.push("Criar fluxo de recuperação de no-show: WhatsApp + ligação no mesmo dia da falta. Janela de 24h é onde o reagendamento ainda é possível com alta taxa de sucesso.");
    }
    if (recs.length === 0) {
      recs.push("Indicadores estão dentro de bandas saudáveis. Manter a operação e considerar metas mais agressivas: comparecimento >90% e conversão >55% como próximos patamares.");
    }
    return recs;
  }, [m]);

  return (
    <div className="container max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
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
            <h1 className="text-[22px] font-extrabold tracking-tight">Agenda × Vendas</h1>
            <p className="text-[13px] text-muted-foreground">
              Comparecimento, no-show, cancelamento e conversão da agenda em vendas — leitura no tom de gestor comercial sênior.
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
          {/* KPIs principais — operacional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Comparecimento"
              value={`${m.attendanceRate}%`}
              subtitle={`${m.completed} de ${m.completed + m.noShow} consultas presentes`}
              icon={CheckCircle2}
              color="text-emerald-500"
              bg="bg-emerald-500/10"
              diagnosis={attendanceDx || undefined}
            />
            <KpiCard
              label="No-show"
              value={`${m.noShowRate}%`}
              subtitle={`${m.noShow} faltas no período`}
              icon={CalendarX}
              color="text-orange-500"
              bg="bg-orange-500/10"
              diagnosis={noShowDx || undefined}
            />
            <KpiCard
              label="Cancelamento"
              value={`${m.cancellationRate}%`}
              subtitle={`${m.cancelled} canceladas com antecedência`}
              icon={XCircle}
              color="text-rose-500"
              bg="bg-rose-500/10"
            />
            <KpiCard
              label="Confirmação"
              value={`${m.confirmationRate}%`}
              subtitle="Quanto da agenda passa pela confirmação ativa"
              icon={Clock}
              color="text-blue-500"
              bg="bg-blue-500/10"
            />
          </div>

          {/* KPIs comerciais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Conversão pós-consulta"
              value={`${m.conversionRate}%`}
              subtitle={`${m.wonDealsFromAppointments} fechadas / ${m.lostDealsFromAppointments} perdidas`}
              icon={Target}
              color="text-emerald-500"
              bg="bg-emerald-500/10"
              diagnosis={convDx || undefined}
            />
            <KpiCard
              label="Receita realizada"
              value={formatCompact(m.wonRevenueCents)}
              subtitle="Soma dos deals ganhos via consulta"
              icon={DollarSign}
              color="text-emerald-500"
              bg="bg-emerald-500/10"
            />
            <KpiCard
              label="Receita em risco"
              value={formatCompact(m.potentialLossCents)}
              subtitle="Deals abertos/perdidos vinculados a faltas e cancelamentos"
              icon={AlertTriangle}
              color="text-amber-500"
              bg="bg-amber-500/10"
            />
            <KpiCard
              label="Recovery de no-show"
              value={`${m.noShowRecoveryRate}%`}
              subtitle={`${m.noShowRecoveredCount} clientes que faltaram fecharam depois`}
              icon={TrendingUp}
              color="text-violet-500"
              bg="bg-violet-500/10"
            />
          </div>

          {/* Diagnóstico narrativo (gestor sênior) */}
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

          {/* Funil clínico */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-[15px] flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-emerald-500" />
                Funil clínico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Agendados", value: m.scheduled, color: "bg-blue-500/10 text-blue-500" },
                  { label: "Confirmados", value: m.confirmed, color: "bg-emerald-500/10 text-emerald-500" },
                  { label: "Em andamento", value: m.inProgress, color: "bg-amber-500/10 text-amber-500" },
                  { label: "Concluídos", value: m.completed, color: "bg-green-500/10 text-green-500" },
                  { label: "Faltas", value: m.noShow, color: "bg-orange-500/10 text-orange-500" },
                  { label: "Cancelados", value: m.cancelled, color: "bg-rose-500/10 text-rose-500" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-lg p-3 ${s.color}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{s.label}</p>
                    <p className="text-[24px] font-extrabold leading-tight mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recomendações */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-[15px] flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-500" />
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
        </>
      )}
    </div>
  );
}
