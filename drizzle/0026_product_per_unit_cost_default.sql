-- ════════════════════════════════════════════════════════════
-- 0026_product_per_unit_cost_default.sql
-- Refina precificação por mL/g: agora também armazena custo por unidade
-- (pra calcular margem por mL) e quantidade padrão sugerida ao
-- adicionar o produto a um orçamento. Idempotente.
-- ════════════════════════════════════════════════════════════

ALTER TABLE product_catalog
  ADD COLUMN IF NOT EXISTS "costPerUnitCents" BIGINT,
  ADD COLUMN IF NOT EXISTS "defaultQuantityPerUnit" NUMERIC(10, 3);
