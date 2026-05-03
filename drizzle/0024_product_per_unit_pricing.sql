-- ════════════════════════════════════════════════════════════
-- 0024_product_per_unit_pricing.sql
-- Suporte a precificação por unidade de medida (ex.: mL para estética).
-- Adiciona snapshot de imagem em deal_products e proposal_items para
-- que a foto do catálogo apareça no orçamento enviado ao cliente.
-- Idempotente — usa IF NOT EXISTS em todas as colunas.
-- ════════════════════════════════════════════════════════════

-- product_catalog: modo de preço + unidade + preço por unidade
ALTER TABLE product_catalog
  ADD COLUMN IF NOT EXISTS "pricingMode" VARCHAR(16) NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS "unitOfMeasure" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "pricePerUnitCents" BIGINT;

-- deal_products: snapshot completo (não depende do catálogo após criação)
ALTER TABLE deal_products
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "pricingMode" VARCHAR(16) NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS "unitOfMeasure" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "quantityPerUnit" NUMERIC(10, 3),
  ADD COLUMN IF NOT EXISTS "pricePerUnitCents" BIGINT;

-- proposal_items: snapshot da imagem (renderizada no PDF/HTML do orçamento)
ALTER TABLE proposal_items
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "quantityPerUnit" NUMERIC(10, 3);
