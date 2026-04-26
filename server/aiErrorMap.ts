/**
 * AI Error Map — mapeia erros crus de OpenAI/Anthropic/guardrails internos
 * em mensagens PT-BR claras pro usuário final.
 *
 * Motivação: antes os toasts mostravam strings tipo "rate_limit_exceeded" ou
 * "invalid_api_key" direto da API. Usuário não entende e culpa o CRM.
 *
 * Ver specs/domains/ai-deal-intelligence.spec.md § Invariantes operacionais #6.
 */

export type AiErrorCode =
  // Guardrails internos
  | "LEAD_SCORING_DISABLED"
  | "DEAL_SUMMARY_DISABLED"
  | "NO_AI_CONFIGURED"
  | "INSUFFICIENT_DATA"
  | "RATE_LIMIT_DEAL"
  | "RATE_LIMIT_USER"
  | "DEAL_NOT_FOUND"
  // Provider errors mapeados
  | "INVALID_API_KEY"
  | "PROVIDER_RATE_LIMIT"
  | "INSUFFICIENT_QUOTA"
  | "PROVIDER_TIMEOUT"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export interface AiErrorMapped {
  code: AiErrorCode;
  message: string;   // mensagem PT-BR amigável pro usuário
  userAction?: string; // sugestão do que fazer (opcional)
}

const MESSAGES: Record<AiErrorCode, { message: string; userAction?: string }> = {
  LEAD_SCORING_DISABLED: {
    message: "O Termômetro está desativado. Um admin precisa ligar em Configurações → Integrações → IA.",
    userAction: "settings_ai",
  },
  DEAL_SUMMARY_DISABLED: {
    message: "O Resumo automático está desativado. Um admin precisa ligar em Configurações → Integrações → IA.",
    userAction: "settings_ai",
  },
  NO_AI_CONFIGURED: {
    message: "Nenhum provedor de IA configurado. Acesse Integrações → IA para configurar.",
    userAction: "settings_ai",
  },
  INSUFFICIENT_DATA: {
    message: "Dados insuficientes. A conversa precisa de pelo menos 3 mensagens do cliente (ou 10 no total) antes de ser pontuada pela IA.",
  },
  RATE_LIMIT_DEAL: {
    message: "Esta negociação foi analisada há menos de 5 minutos. Aguarde antes de re-pontuar.",
  },
  RATE_LIMIT_USER: {
    message: "Você atingiu o limite de análises por hora. Tente daqui a alguns minutos.",
  },
  DEAL_NOT_FOUND: {
    message: "Negociação não encontrada.",
  },
  INVALID_API_KEY: {
    message: "Sua chave de IA está inválida. Reconfigure em Integrações → IA.",
    userAction: "settings_ai",
  },
  PROVIDER_RATE_LIMIT: {
    message: "A IA atingiu o limite da sua conta no provedor. Tente em alguns minutos.",
  },
  INSUFFICIENT_QUOTA: {
    message: "Sua conta do provedor de IA está sem créditos. Recarregue para continuar.",
  },
  PROVIDER_TIMEOUT: {
    message: "Sem resposta da IA no tempo esperado. Tente novamente.",
  },
  NETWORK_ERROR: {
    message: "Falha de rede ao chamar a IA. Tente novamente.",
  },
  UNKNOWN: {
    message: "Erro desconhecido ao chamar a IA. Tente novamente; se persistir, reporte pelo módulo de Suporte.",
  },
};

/**
 * Recebe qualquer erro (Error, string, objeto de response) e devolve
 * um código canônico + mensagem PT-BR amigável.
 */
export function mapAiError(err: unknown): AiErrorMapped {
  // Já veio com code canônico (guardrails internos)
  if (err instanceof Error) {
    const code = detectCode(err.message);
    return { code, ...MESSAGES[code] };
  }
  if (typeof err === "string") {
    const code = detectCode(err);
    return { code, ...MESSAGES[code] };
  }
  // Shape de erro do SDK OpenAI/Anthropic: { status, code, message, type }
  const anyErr = err as any;
  const raw = `${anyErr?.code || ""} ${anyErr?.type || ""} ${anyErr?.message || ""} ${anyErr?.status || ""}`.toLowerCase();
  const code = detectCode(raw);
  return { code, ...MESSAGES[code] };
}

function detectCode(raw: string): AiErrorCode {
  const s = raw.toLowerCase();
  // Guardrails internos (são lançados como Error com esse código exato)
  if (s.includes("lead_scoring_disabled")) return "LEAD_SCORING_DISABLED";
  if (s.includes("deal_summary_disabled")) return "DEAL_SUMMARY_DISABLED";
  if (s.includes("no_ai_configured") || s.includes("no ai")) return "NO_AI_CONFIGURED";
  if (s.includes("insufficient_data")) return "INSUFFICIENT_DATA";
  if (s.includes("rate_limit_deal")) return "RATE_LIMIT_DEAL";
  if (s.includes("rate_limit_user")) return "RATE_LIMIT_USER";
  if (s.includes("deal_not_found")) return "DEAL_NOT_FOUND";
  // Provider errors
  if (s.includes("invalid_api_key") || s.includes("authentication") || s.includes("401")) return "INVALID_API_KEY";
  if (s.includes("insufficient_quota") || s.includes("exceeded your current quota") || s.includes("billing")) return "INSUFFICIENT_QUOTA";
  if (s.includes("rate_limit") || s.includes("429")) return "PROVIDER_RATE_LIMIT";
  if (s.includes("timeout") || s.includes("timed out")) return "PROVIDER_TIMEOUT";
  if (s.includes("fetch failed") || s.includes("network") || s.includes("econnrefused")) return "NETWORK_ERROR";
  return "UNKNOWN";
}
