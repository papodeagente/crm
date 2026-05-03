-- ════════════════════════════════════════════════════════════
-- 0025_proposal_rejection.sql
-- Adiciona colunas pra rastrear rejeição da proposta (espelha o
-- conjunto de aceite). Idempotente.
-- ════════════════════════════════════════════════════════════

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "rejectedClientName" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "rejectedClientEmail" VARCHAR(320),
  ADD COLUMN IF NOT EXISTS "rejectedClientIp" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
