-- ════════════════════════════════════════════════════════════
-- 0021_ws_tenant_user_unique.sql — 1 sessão WhatsApp por (tenant, user)
-- Idempotente.
--
-- Antes desta constraint, o mesmo usuário podia ter múltiplas sessões
-- (uma legacy "zapi-{tenantId}-{ts}" + uma canônica "crm-{tenantId}-{userId}")
-- causando dropdown de "Sessões disponíveis" com duplicatas.
-- ════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS ws_tenant_user_unique
  ON whatsapp_sessions ("tenantId", "userId");
