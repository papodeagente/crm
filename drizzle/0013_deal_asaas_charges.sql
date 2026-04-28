-- ════════════════════════════════════════════════════════════
-- 0013_deal_asaas_charges.sql — campos asaas* em deals
-- Idempotente. Mesmo padrão de proposals.
-- ════════════════════════════════════════════════════════════

ALTER TABLE deals ADD COLUMN IF NOT EXISTS "asaasPaymentId" VARCHAR(64);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "asaasInvoiceUrl" TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "asaasBankSlipUrl" TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "asaasBillingType" VARCHAR(32);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "asaasPaymentStatus" VARCHAR(32);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "asaasDueDate" TIMESTAMP;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "asaasPaidAt" TIMESTAMP;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS "asaasLinkSentToWhatsappAt" TIMESTAMP;

CREATE INDEX IF NOT EXISTS deals_asaas_payment_idx ON deals ("asaasPaymentId");
