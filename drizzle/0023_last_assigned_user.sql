-- ════════════════════════════════════════════════════════════
-- 0023_last_assigned_user.sql
-- Adiciona lastAssignedUserId em wa_conversations para que, ao reabrir
-- uma conversa finalizada (cliente volta a falar), ela seja roteada de
-- volta para o último atendente em vez de cair na fila.
-- Idempotente.
-- ════════════════════════════════════════════════════════════

ALTER TABLE wa_conversations
  ADD COLUMN IF NOT EXISTS "lastAssignedUserId" INTEGER;

CREATE INDEX IF NOT EXISTS idx_wc_last_assigned_user
  ON wa_conversations ("tenantId", "lastAssignedUserId");
