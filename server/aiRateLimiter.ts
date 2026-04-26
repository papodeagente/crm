/**
 * aiRateLimiter.ts — in-memory rate limit por userId pra endpoints de IA.
 *
 * Previne clique compulsivo + abuso acidental. Limites conservadores:
 *  - 20 chamadas/hora por usuário
 *  - 100 chamadas/dia por usuário
 *
 * Ver specs/domains/ai-deal-intelligence.spec.md § Invariantes operacionais #4.
 *
 * Escopo: in-memory (reset em deploy). Suficiente pra proteção do limite "humano".
 * Limites de provider (OpenAI/Anthropic) são enforçados pelo próprio provider.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const AI_RATE_LIMIT_PER_HOUR = 20;
export const AI_RATE_LIMIT_PER_DAY = 100;

interface UserHits {
  hour: number[];  // timestamps (ms) dentro da última hora
  day: number[];   // timestamps (ms) dentro das últimas 24h
}

// Map<userId, UserHits> — cleanup lazy (ao registrar)
const hits = new Map<number, UserHits>();

/**
 * Registra uma chamada e verifica limites.
 * Throw "RATE_LIMIT_USER" se excedeu.
 */
export function recordAiCall(userId: number): void {
  const now = Date.now();
  const entry = hits.get(userId) || { hour: [], day: [] };

  // Limpa timestamps expirados
  entry.hour = entry.hour.filter(t => now - t < HOUR_MS);
  entry.day = entry.day.filter(t => now - t < DAY_MS);

  if (entry.hour.length >= AI_RATE_LIMIT_PER_HOUR) {
    throw new Error("RATE_LIMIT_USER");
  }
  if (entry.day.length >= AI_RATE_LIMIT_PER_DAY) {
    throw new Error("RATE_LIMIT_USER");
  }

  entry.hour.push(now);
  entry.day.push(now);
  hits.set(userId, entry);
}

/** Limpa Map inteiro (útil em testes). */
export function _resetAiRateLimiter(): void {
  hits.clear();
}
