/**
 * LeadScoreBadge — Badge visual para o "termômetro" de uma deal (hot/warm/cold).
 * Preenchido por Fase 1 da IA (ver `specs/domains/ai-deal-intelligence.spec.md`).
 *
 * Uso:
 *   <LeadScoreBadge score={deal.aiLeadScore} reason={deal.aiLeadScoreReason} />
 *   <LeadScoreBadge score={deal.aiLeadScore} reason={...} dealId={deal.id} interactive />
 *
 * Suporta 3 tamanhos (sm=pipeline card, md=deal list, lg=deal detail header).
 * Quando `score` é null/undefined, renderiza nada.
 *
 * Com `interactive` + `dealId`, abre popover rich com critérios + modelo + tokens
 * (transparência pedida pelo admin — sabemos exatamente o que a IA usou).
 */

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";

type LeadScore = "hot" | "warm" | "cold";

interface LeadScoreBadgeProps {
  score: string | null | undefined;
  reason?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
  /** Quando presente + interactive=true, ativa popover rich com detalhes da última execução. */
  dealId?: number;
  interactive?: boolean;
  /** Timestamp da última análise (opcional, vem de deal.aiLeadScoreAt). */
  scoredAt?: string | Date | null;
}

const PRESET: Record<LeadScore, { emoji: string; label: string; bg: string; text: string; border: string; criteria: string }> = {
  hot: {
    emoji: "🔥",
    label: "Quente",
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/20",
    criteria: "Cliente demonstra urgência, pede forma de pagamento, confirma data ou pede dados para reserva.",
  },
  warm: {
    emoji: "🟡",
    label: "Morno",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/20",
    criteria: "Interessado mas sem sinal claro de urgência. Conversa em andamento, ainda sem decisão.",
  },
  cold: {
    emoji: "❄️",
    label: "Frio",
    bg: "bg-sky-500/10",
    text: "text-sky-600 dark:text-sky-400",
    border: "border-sky-500/20",
    criteria: "Sem resposta há dias, objeções não resolvidas ou intenção baixa. Conversa esfriou.",
  },
};

export function LeadScoreBadge(props: LeadScoreBadgeProps) {
  const { score, reason, size = "md", showLabel = true, className, dealId, interactive, scoredAt } = props;
  if (!score) return null;
  const preset = PRESET[score as LeadScore];
  if (!preset) return null;

  const sizeCls =
    size === "sm"
      ? "text-[10px] px-1.5 py-0.5 gap-0.5 rounded-md"
      : size === "lg"
      ? "text-sm px-3 py-1 gap-1.5 rounded-full"
      : "text-xs px-2 py-0.5 gap-1 rounded-full";

  const badge = (
    <span
      title={!interactive ? (reason || preset.label) : undefined}
      className={cn(
        "inline-flex items-center border font-medium whitespace-nowrap",
        preset.bg,
        preset.text,
        preset.border,
        sizeCls,
        interactive ? "cursor-help" : "",
        className,
      )}
    >
      <span>{preset.emoji}</span>
      {showLabel && <span>{preset.label}</span>}
    </span>
  );

  if (!interactive || !dealId) return badge;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex">{badge}</button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <LeadScorePopoverBody
          score={score as LeadScore}
          reason={reason}
          scoredAt={scoredAt}
          dealId={dealId}
        />
      </PopoverContent>
    </Popover>
  );
}

function LeadScorePopoverBody({
  score, reason, scoredAt, dealId,
}: {
  score: LeadScore; reason?: string | null; scoredAt?: string | Date | null; dealId: number;
}) {
  const preset = PRESET[score];
  const detailQ = trpc.ai.getLeadScoreDetail.useQuery({ dealId });
  const detail = detailQ.data;

  const scoredAtLabel = scoredAt ? new Date(scoredAt).toLocaleString("pt-BR") : "—";

  const tokens = detail?.totalTokens ?? null;
  const costCents = detail?.estimatedCostCents ?? null;
  const costLabel = costCents != null
    ? `R$ ${(costCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
    : null;

  return (
    <div>
      <div className={`${preset.bg} ${preset.border} border-b p-3`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{preset.emoji}</span>
          <span className={`text-[14px] font-semibold ${preset.text}`}>{preset.label}</span>
        </div>
        <p className="text-[12px] text-muted-foreground mt-1.5 leading-snug">
          <strong className="text-foreground">Critério:</strong> {preset.criteria}
        </p>
      </div>

      <div className="p-3 space-y-2">
        {reason && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Razão detectada pela IA
            </p>
            <p className="text-[12px] text-foreground mt-1 leading-snug italic">
              "{reason}"
            </p>
          </div>
        )}

        <div className="border-t border-border/60 pt-2 space-y-1 text-[11px]">
          <Row label="Modelo" value={detail?.model || "—"} mono />
          <Row label="Provedor" value={detail?.provider || "—"} />
          <Row label="Última análise" value={scoredAtLabel} />
          <Row
            label="Tokens consumidos"
            value={tokens != null ? tokens.toLocaleString("pt-BR") : "—"}
            mono
          />
          {costLabel && (
            <Row label="Custo estimado" value={`≈ ${costLabel}`} />
          )}
        </div>

        <p className="pt-1 text-[10px] text-muted-foreground/70 leading-relaxed">
          Os tokens foram debitados da sua conta no provedor configurado em Integrações → IA.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}:</span>
      <span className={mono ? "font-mono" : ""}>{value}</span>
    </div>
  );
}

export { PRESET as LEAD_SCORE_PRESET };
export type { LeadScore, LeadScoreBadgeProps };
