-- ════════════════════════════════════════════════════════════
-- 0017_extraction_config_type.sql — adiciona 'extraction' ao enum configType
-- Necessário para getAiTrainingConfig(tenantId, 'extraction') usado pelo
-- aiEntityExtractionService. Idempotente.
-- ════════════════════════════════════════════════════════════

ALTER TYPE "configType" ADD VALUE IF NOT EXISTS 'extraction';
