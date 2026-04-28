-- ════════════════════════════════════════════════════════════
-- 0015_proposal_signatures.sql — assinatura PNG no aceite público
-- ════════════════════════════════════════════════════════════

ALTER TABLE proposal_signatures ADD COLUMN IF NOT EXISTS "signatureDataUrl" TEXT;
CREATE INDEX IF NOT EXISTS psig_proposal_idx ON proposal_signatures ("proposalId");
