-- Migration: Inbox helpdesk columns — SLA tracking, LID linking, agent availability
-- Idempotent: usa IF NOT EXISTS
-- Refs: porta slaEnforcementScheduler, idleAgentScheduler, helpdeskDistributionScheduler
--   + suporte a LID (chatLid em wa_conversations) e capacidade de agente (crm_users)

-- ═══════════════════════════════════════════════════════════
-- wa_conversations: LID cross-reference + SLA breach tracking
-- (firstResponseAt, queuedAt, slaDeadlineAt já existem em 0000)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "wa_conversations" ADD COLUMN IF NOT EXISTS "chatLid" varchar(128);--> statement-breakpoint
ALTER TABLE "wa_conversations" ADD COLUMN IF NOT EXISTS "slaBreachedAt" timestamp;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_wc_chatLid" ON "wa_conversations" USING btree ("tenantId","sessionId","chatLid");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- crm_users: capacidade do agente (load balancing helpdesk)
-- (isAvailable já existe em 0006)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "crm_users" ADD COLUMN IF NOT EXISTS "availabilityStatus" varchar(16) DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_users" ADD COLUMN IF NOT EXISTS "maxConcurrentChats" integer;--> statement-breakpoint
