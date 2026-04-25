-- Migration: Proposal follow-up tracking
-- Idempotent: usa IF NOT EXISTS

ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "whatsappFollowupAt" timestamp;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "whatsappPaidNotifiedAt" timestamp;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "whatsappOverdueNotifiedAt" timestamp;--> statement-breakpoint
