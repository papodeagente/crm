-- ════════════════════════════════════════════════════════════
-- 0020_product_treatment_fields.sql — campos de tratamento estético
-- Idempotente.
-- ════════════════════════════════════════════════════════════

ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS specialty VARCHAR(128);
ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS contraindications TEXT;
ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS "returnReminderDays" INTEGER;
ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS complexity VARCHAR(16);

CREATE INDEX IF NOT EXISTS pcat_tenant_specialty_idx
  ON product_catalog ("tenantId", specialty);
