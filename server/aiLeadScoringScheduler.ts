/**
 * aiLeadScoringScheduler.ts
 *
 * Roda diariamente (~3am UTC) pra re-pontuar deals abertas de todos os tenants
 * com integração de IA ativa. On-demand é exposto via `ai.rescoreDeal`.
 *
 * Cadência: 1x ao dia. Override via env `AI_LEAD_SCORING_INTERVAL_MS` (pra dev/teste).
 */

import { scoreDealsForAllTenants } from "./aiLeadScoringService";

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const BOOT_DELAY_MS = 5 * 60 * 1000; // 5min — dá respiro aos outros workers no boot

export function startAiLeadScoringScheduler(): void {
  const envInterval = Number(process.env.AI_LEAD_SCORING_INTERVAL_MS);
  const INTERVAL_MS =
    Number.isFinite(envInterval) && envInterval >= 60_000 ? envInterval : DEFAULT_INTERVAL_MS;

  async function run() {
    try {
      await scoreDealsForAllTenants(100);
    } catch (err: any) {
      console.error("[AiLeadScoring Scheduler] Fatal error:", err?.message);
    }
  }

  setTimeout(run, BOOT_DELAY_MS);
  setInterval(run, INTERVAL_MS);

  const human = INTERVAL_MS >= 3600_000 ? `${Math.round(INTERVAL_MS / 3600_000)}h` : `${Math.round(INTERVAL_MS / 60_000)}min`;
  console.log(`[AiLeadScoring Scheduler] Started — interval=${human}, first run in ${BOOT_DELAY_MS / 60_000}min`);
}
