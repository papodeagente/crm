/**
 * Guardrails for agent reply text.
 *
 * - PII redaction (BR CPF, credit card numbers)
 * - Length cap
 * - Confidence heuristic → escalate
 *
 * Pure functions — no DB access.
 */

const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CARD_RE = /\b(?:\d[ -]*?){13,16}\b/g;
const LOW_CONFIDENCE_PHRASES = [
  "não tenho certeza",
  "não sei dizer",
  "não consigo ajudar com isso",
  "preciso verificar",
  "talvez seja melhor falar com",
  "não estou autorizad",
];

export type GuardrailResult = {
  cleanText: string;
  shouldEscalate: boolean;
  reason?: string;
  redactionsApplied: string[];
};

export function runGuardrails(rawText: string, opts: { maxLength?: number; escalateConfidenceBelow?: number } = {}): GuardrailResult {
  const maxLen = opts.maxLength ?? 1000;
  const redactions: string[] = [];

  let text = (rawText || "").trim();

  // 1. PII redaction
  if (CPF_RE.test(text)) {
    text = text.replace(CPF_RE, "[CPF removido]");
    redactions.push("cpf");
  }
  if (CARD_RE.test(text)) {
    text = text.replace(CARD_RE, "[cartão removido]");
    redactions.push("card");
  }

  // 2. Length cap
  if (text.length > maxLen) {
    text = text.slice(0, maxLen - 1) + "…";
  }

  // 3. Heurística de confiança baixa → escalar
  const lower = text.toLowerCase();
  const matchedPhrase = LOW_CONFIDENCE_PHRASES.find(p => lower.includes(p));
  if (matchedPhrase) {
    return {
      cleanText: text,
      shouldEscalate: true,
      reason: `Resposta sinalizou baixa confiança ("${matchedPhrase}")`,
      redactionsApplied: redactions,
    };
  }

  // 4. Texto vazio → escalar
  if (text.length === 0) {
    return {
      cleanText: "",
      shouldEscalate: true,
      reason: "Resposta vazia do modelo",
      redactionsApplied: redactions,
    };
  }

  return { cleanText: text, shouldEscalate: false, redactionsApplied: redactions };
}
