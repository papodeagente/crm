-- Migration: Agent availability toggle (Disponível)
-- Idempotent: usa IF NOT EXISTS

ALTER TABLE "crm_users" ADD COLUMN IF NOT EXISTS "isAvailable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
