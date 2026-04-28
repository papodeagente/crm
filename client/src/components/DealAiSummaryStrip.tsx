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
import { Sparkles, RefreshCw, Loader2, Thermometer } from "lucide-react";
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

  // Sem integração e sem dados históricos → não renderiza nada (CTA de config fica em Configurações → IA).
  if (!hasIntegration && !aiSummary && !aiLeadScore) return null;

  // Tem integração mas nenhuma feature ativa e sem dados históricos → também esconde.
  // Quando o admin ativar uma feature em Configurações → IA, a faixa volta automaticamente.
  if (hasIntegration && !leadScoringOn && !dealSummaryOn && !aiSummary && !aiLeadScore) return null;

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
