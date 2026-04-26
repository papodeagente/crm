/**
 * DealAiSummaryStrip — Faixa no topo do DealDetail com o resumo dinâmico da deal
 * gerado por IA. Mostra também o LeadScore badge e botões.
 *
 * Regras invioláveis:
 *  - Se tenant não tem integração ativa → aviso com CTA pra Integrações → IA.
 *  - Se integração ativa mas feature flag OFF → aviso "recurso desligado" com CTA.
 *  - Só mostra botões cujos features estão ATIVOS (flag ON).
 *
 * Ver `specs/domains/ai-deal-intelligence.spec.md`.
 */

import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles, RefreshCw, AlertTriangle, ArrowRight, Loader2, Thermometer } from "lucide-react";
import { LeadScoreBadge } from "./LeadScoreBadge";
import { formatDateTime } from "../../../shared/dateUtils";

interface DealAiSummaryStripProps {
  dealId: number;
  aiSummary: string | null | undefined;
  aiSummaryUpdatedAt: string | Date | null | undefined;
  aiLeadScore: string | null | undefined;
  aiLeadScoreReason: string | null | undefined;
  aiLeadScoreAt?: string | Date | null;
  onRefetch: () => void;
}

export function DealAiSummaryStrip({
  dealId,
  aiSummary,
  aiSummaryUpdatedAt,
  aiLeadScore,
  aiLeadScoreReason,
  aiLeadScoreAt,
  onRefetch,
}: DealAiSummaryStripProps) {
  const [, setLocation] = useLocation();

  const integrationsQ = trpc.ai.availableModels.useQuery();
  const flagsQ = trpc.ai.getFeatureFlags.useQuery();
  const hasIntegration = (integrationsQ.data?.models?.length || 0) > 0;
  const leadScoringOn = !!flagsQ.data?.leadScoringEnabled;
  const dealSummaryOn = !!flagsQ.data?.dealSummaryEnabled;

  const refreshSummary = trpc.ai.refreshDealSummary.useMutation({
    onSuccess: () => {
      toast.success("Resumo atualizado");
      onRefetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const rescore = trpc.ai.rescoreDeal.useMutation({
    onSuccess: (data) => {
      toast.success(`Deal marcada como ${data.score === "hot" ? "quente" : data.score === "warm" ? "morna" : "fria"}`);
      onRefetch();
    },
    onError: (err) => toast.error(err.message),
  });

  // Caso A: sem integração AI configurada e sem resumo histórico → CTA pra configurar.
  if (!hasIntegration && !aiSummary) {
    return (
      <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/5 px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-muted-foreground flex-1">
            Configure uma IA em Integrações pra ativar resumo automático da deal.
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 gap-1"
            onClick={() => setLocation("/settings/integrations")}
          >
            Configurar IA <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  // Caso B: tem integração mas admin ainda não habilitou NENHUMA feature de IA → banner com CTA.
  if (hasIntegration && !leadScoringOn && !dealSummaryOn && !aiSummary && !aiLeadScore) {
    return (
      <div className="shrink-0 border-b border-violet-500/20 bg-violet-500/5 px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
          <span className="text-muted-foreground flex-1">
            IA configurada. Ative os recursos de IA (Termômetro e Resumo) em Configurações → IA.
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-500/10 gap-1"
            onClick={() => setLocation("/settings/integrations")}
          >
            Ativar recursos <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  const updatedLabel = aiSummaryUpdatedAt ? formatDateTime(aiSummaryUpdatedAt) : null;
  const loading = refreshSummary.isPending || rescore.isPending;

  // Quando uma feature está desativada mas já existem dados históricos (score/resumo de quando
  // estava ativa), continuamos mostrando — mas os botões refletem o estado atual da flag.
  return (
    <div className="shrink-0 border-b border-border bg-gradient-to-r from-primary/5 via-primary/3 to-transparent px-3 py-2">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-primary/70 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-primary/70 uppercase tracking-wide">Resumo IA</span>
            <LeadScoreBadge
              score={aiLeadScore}
              reason={aiLeadScoreReason}
              size="sm"
              dealId={dealId}
              scoredAt={aiLeadScoreAt ?? null}
              interactive
            />
            {updatedLabel && (
              <span className="text-[11px] text-muted-foreground">atualizado em {updatedLabel}</span>
            )}
          </div>
          {loading ? (
            <p className="text-[13px] text-muted-foreground italic leading-snug mt-0.5 flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analisando conversa…
            </p>
          ) : (
            <p className="text-[13px] text-foreground leading-snug mt-0.5">
              {aiSummary || (
                <span className="text-muted-foreground italic">
                  {dealSummaryOn
                    ? 'Ainda não há resumo. Clique em "Resumo" pra gerar.'
                    : "Resumo automático está desativado. Ative em Configurações → IA."}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {dealSummaryOn && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              disabled={loading || !hasIntegration}
              onClick={() => refreshSummary.mutate({ dealId })}
              title="Re-gerar resumo com IA"
            >
              {refreshSummary.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Resumo
            </Button>
          )}
          {leadScoringOn && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              disabled={loading || !hasIntegration}
              onClick={() => rescore.mutate({ dealId })}
              title="Re-avaliar termômetro (quente/morno/frio)"
            >
              {rescore.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Thermometer className="h-3 w-3" />}
              Termômetro
            </Button>
          )}
          {!leadScoringOn && !dealSummaryOn && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 text-violet-600 hover:text-violet-700"
              onClick={() => setLocation("/settings/integrations")}
              title="Ativar recursos de IA em Configurações"
            >
              <Sparkles className="h-3 w-3" /> Ativar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
