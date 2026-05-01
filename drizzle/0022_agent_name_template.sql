-- ════════════════════════════════════════════════════════════
-- 0022_agent_name_template.sql — template do prefixo de nome do atendente
-- Idempotente.
-- ════════════════════════════════════════════════════════════

ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS "agentNameTemplate" VARCHAR(255) NOT NULL DEFAULT '*{nome}:* ';
