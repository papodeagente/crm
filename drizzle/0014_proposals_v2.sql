-- ════════════════════════════════════════════════════════════
-- 0014_proposals_v2.sql — editor visual + branding + público
-- Idempotente.
-- ════════════════════════════════════════════════════════════

-- ── proposals ──
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS "subtotalCents" BIGINT DEFAULT 0;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS "discountCents" BIGINT DEFAULT 0;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS "taxCents" BIGINT DEFAULT 0;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS "publicToken" VARCHAR(48);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS "clientSnapshotJson" JSON;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS "validUntil" TIMESTAMP;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS "templateId" INTEGER;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS "acceptedClientName" VARCHAR(255);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS "acceptedClientEmail" VARCHAR(320);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS "acceptedClientIp" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS proposals_public_token_idx ON proposals ("publicToken") WHERE "publicToken" IS NOT NULL;

-- ── proposal_items ──
ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS unit VARCHAR(16);
ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS "discountCents" BIGINT DEFAULT 0;
ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS "productId" INTEGER;
ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS "orderIndex" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS pi_proposal_order_idx ON proposal_items ("proposalId", "orderIndex");
