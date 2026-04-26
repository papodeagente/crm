/**
 * aiModelCatalog.ts
 *
 * Catálogo central de modelos recomendados por tipo de tarefa de IA.
 * Cada consumidor (sugestão, análise, extração, etc.) usa este mapa para:
 *  - Marcar ⭐ Recomendado no dropdown de seleção de modelo
 *  - Escolher fallback quando o tenant não definiu preferência
 *
 * Padrão: toda feature de IA permite override de provider+modelo no ponto de uso.
 * Ver `specs/domains/ai-integrations.spec.md`.
 */

export type AiTaskType =
  | "suggestion"
  | "analysis"
  | "summary"
  | "extraction"
  | "scoring"
  | "proposal"
  | "coaching"
  | "prediction";

/** IDs de modelos exatos expostos pelos dropdowns (precisam bater com `OPENAI_MODELS` / `ANTHROPIC_MODELS`). */
export const TASK_RECOMMENDED_MODELS: Record<AiTaskType, readonly string[]> = {
  // rápido, bom pra mensagens curtas
  suggestion: ["gpt-4.1", "claude-sonnet-4-6"],
  // long context + raciocínio pra avaliar conversa completa
  analysis: ["gpt-5.4", "claude-opus-4-6"],
  summary: ["gpt-4.1", "claude-sonnet-4-6"],
  // preciso e barato — extrair entidades não precisa do modelo mais caro
  extraction: ["gpt-4.1-mini", "claude-haiku-4-5"],
  // classificar quente/morno/frio — idem extração
  scoring: ["gpt-4.1-mini", "claude-haiku-4-5"],
  // saída longa, tom comercial
  proposal: ["gpt-5.4", "claude-opus-4-6"],
  coaching: ["gpt-5.4", "claude-opus-4-6"],
  // raciocínio econômico pra prever close probability
  prediction: ["gpt-5-mini", "claude-sonnet-4-6"],
} as const;

export function isRecommendedModel(task: AiTaskType, modelId: string): boolean {
  return TASK_RECOMMENDED_MODELS[task]?.includes(modelId) ?? false;
}

/** Escolhe o primeiro modelo recomendado disponível entre os IDs que o tenant já tem ativo. */
export function pickRecommendedModel(task: AiTaskType, availableModelIds: string[]): string | null {
  const recs = TASK_RECOMMENDED_MODELS[task] ?? [];
  for (const id of recs) {
    if (availableModelIds.includes(id)) return id;
  }
  return null;
}
