-- ════════════════════════════════════════════════════════════
-- 0018_crm_users_super_admin.sql — flag de Super Admin SaaS
-- Adiciona isSuperAdmin em crm_users e marca o email protegido.
-- Idempotente.
-- ════════════════════════════════════════════════════════════

ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE crm_users SET "isSuperAdmin" = TRUE WHERE LOWER(email) = 'bruno@entur.com.br';
