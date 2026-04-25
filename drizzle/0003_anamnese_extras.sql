-- Migration: Anamnese — extras (slug, hasExtraField, observation, filledByMode)
-- Idempotent: usa IF NOT EXISTS / DO blocks

-- ═══════════════════════════════════════════════════════════
-- anamnesis_templates: adicionar slug
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "anamnesis_templates" ADD COLUMN IF NOT EXISTS "slug" varchar(64);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "at_tenant_slug_idx" ON "anamnesis_templates" USING btree ("tenantId", "slug");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- anamnesis_questions: adicionar hasExtraField + extraFieldLabel
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "anamnesis_questions" ADD COLUMN IF NOT EXISTS "hasExtraField" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "anamnesis_questions" ADD COLUMN IF NOT EXISTS "extraFieldLabel" varchar(128);--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- anamnesis_responses: adicionar observation + filledByMode
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "anamnesis_responses" ADD COLUMN IF NOT EXISTS "observation" text;--> statement-breakpoint
ALTER TABLE "anamnesis_responses" ADD COLUMN IF NOT EXISTS "filledByMode" varchar(16) DEFAULT 'professional' NOT NULL;--> statement-breakpoint
