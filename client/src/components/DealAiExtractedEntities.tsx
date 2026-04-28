/**
 * DealAiExtractedEntities — Painel de sidebar listando entidades de viagem
 * extraídas automaticamente da conversa WhatsApp (destino, datas, passageiros,
 * orçamento, ocasião, preferências).
 *
 * Agente vê sugestões da IA + confiança + pode Aceitar ou Dispensar.
 * Ver `specs/domains/ai-deal-intelligence.spec.md`.
 */

import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X, Sparkles, RefreshCw, Loader2, AlertTriangle, ArrowRight } from "lucide-react";

const FIELD_LABELS: Record<string, string> = {
  procedimento: "Procedimento de interesse",
  area_corpo: "Área do corpo",
  objetivo: "Objetivo",
  urgencia: "Urgência",
  orcamento: "Orçamento",
  agendamento_desejado: "Agendamento desejado",
  contraindicacoes: "Contraindicações",
  ja_realizou: "Já realizou antes",
  preferencias: "Preferências",
  // Legados (turismo) — mantidos para exibir entries antigas se houver
  destino: "Destino",
  origem: "Origem",
  data_ida: "Data de ida",
  data_volta: "Data de volta",
  passageiros_adultos: "Adultos",
  passageiros_criancas: "Crianças",
  orcamento_max: "Orçamento (legado)",
  ocasiao: "Ocasião",
};

interface DealAiExtractedEntitiesProps {
  dealId: number;
}

export function DealAiExtractedEntities({ dealId }: DealAiExtractedEntitiesProps) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const integrationsQ = trpc.ai.availableModels.useQuery();
  const hasIntegration = (integrationsQ.data?.models?.length || 0) > 0;

  const entitiesQ = trpc.ai.listExtractedEntities.useQuery(
    { dealId },
    { enabled: dealId > 0 },
  );

  const extract = trpc.ai.extractEntities.useMutation({
    onSuccess: (data) => {
      if (data.queued) {
        toast.info("Extração em andamento. Atualize em alguns segundos.");
      } else if ("entities" in data) {
        toast.success(`${data.entities.length} dado(s) detectado(s)`);
      }
      setTimeout(() => utils.ai.listExtractedEntities.invalidate({ dealId }), 1500);
    },
    onError: (err) => toast.error(`Erro ao extrair: ${err.message}`),
  });

  const accept = trpc.ai.acceptEntity.useMutation({
    onSuccess: () => utils.ai.listExtractedEntities.invalidate({ dealId }),
    onError: (err) => toast.error(err.message),
  });

  const dismiss = trpc.ai.dismissEntity.useMutation({
    onSuccess: () => utils.ai.listExtractedEntities.invalidate({ dealId }),
    onError: (err) => toast.error(err.message),
  });

  if (!hasIntegration) {
    return (
      <div className="py-2 text-xs">
        <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 rounded-md p-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="text-muted-foreground flex-1">Configure IA pra extrair dados automaticamente.</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] px-2 text-amber-600 gap-1"
            onClick={() => setLocation("/settings/integrations")}
          >
            Configurar <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  const entities = entitiesQ.data || [];
  const pending = entities.filter((e) => !e.acceptedAt && !e.dismissedAt);
  const accepted = entities.filter((e) => e.acceptedAt);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {entities.length === 0
            ? "Nenhum dado extraído ainda"
            : `${pending.length} pendente(s) · ${accepted.length} aceito(s)`}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1"
          disabled={extract.isPending}
          onClick={() => extract.mutate({ dealId, wait: true })}
        >
          {extract.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : entities.length === 0 ? (
            <Sparkles className="h-3 w-3" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {entities.length === 0 ? "Extrair" : "Re-extrair"}
        </Button>
      </div>

      {entitiesQ.isLoading && (
        <div className="text-xs text-muted-foreground py-2 text-center">Carregando…</div>
      )}

      {!entitiesQ.isLoading && entities.length === 0 && (
        <div className="text-xs text-muted-foreground py-3 text-center italic">
          Clique em "Extrair" pra IA analisar as mensagens da deal.
        </div>
      )}

      {pending.map((entity) => (
        <div key={entity.id} className="border border-border rounded-md p-2 bg-muted/30 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted-foreground">
                {FIELD_LABELS[entity.fieldKey] || entity.fieldKey}
              </div>
              <div className="text-[13px] text-foreground break-words">{entity.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Confiança: {entity.confidence}%
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                onClick={() => accept.mutate({ dealId, entityId: entity.id })}
                disabled={accept.isPending}
                title="Aceitar"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                onClick={() => dismiss.mutate({ dealId, entityId: entity.id })}
                disabled={dismiss.isPending}
                title="Dispensar"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      {accepted.length > 0 && (
        <details className="mt-2">
          <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
            Aceitos ({accepted.length})
          </summary>
          <div className="mt-1 space-y-1">
            {accepted.map((e) => (
              <div key={e.id} className="flex items-baseline justify-between gap-2 py-0.5">
                <span className="text-[11px] text-muted-foreground">{FIELD_LABELS[e.fieldKey] || e.fieldKey}</span>
                <span className="text-[12px] text-foreground truncate">{e.value}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
