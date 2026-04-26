-- Migration: AI usage log + deal entity extraction + AI columns on deals
-- Idempotent: usa IF NOT EXISTS / DO blocks
-- Refs: porta de entur-os-crm-production (aiUsageLog, aiEntityExtractionService, aiSummaryService, aiLeadScoringService)

-- ═══════════════════════════════════════════════════════════
-- ai_usage_log: telemetria de consumo LLM por feature/tenant
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "ai_usage_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "feature" varchar(32) NOT NULL,
  "provider" varchar(32) NOT NULL,
  "model" varchar(128) NOT NULL,
  "inputTokens" integer,
  "outputTokens" integer,
  "totalTokens" integer,
  "estimatedCostCents" integer,
  "dealId" integer,
  "userId" integer,
  "durationMs" integer,
  "success" boolean DEFAULT false NOT NULL,
  "errorCode" varchar(64),
  "createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ai_usage_tenant_created_idx" ON "ai_usage_log" USING btree ("tenantId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_tenant_feature_idx" ON "ai_usage_log" USING btree ("tenantId","feature","createdAt");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- deal_extracted_entities: entidades extraídas pela IA da conversa WhatsApp
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "deal_extracted_entities" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "dealId" integer NOT NULL,
  "fieldKey" varchar(64) NOT NULL,
  "value" text,
  "confidence" integer DEFAULT 0,
  "source" varchar(32) DEFAULT 'whatsapp' NOT NULL,
  "acceptedByUserId" integer,
  "acceptedAt" timestamp,
  "dismissedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "dee_tenant_deal_idx" ON "deal_extracted_entities" USING btree ("tenantId","dealId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dee_deal_field_unique" ON "deal_extracted_entities" USING btree ("dealId","fieldKey");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- deals: colunas de IA (summary + lead scoring)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "aiSummary" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "aiSummaryUpdatedAt" timestamp;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "aiLeadScore" varchar(16);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "aiLeadScoreReason" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "aiLeadScoreAt" timestamp;--> statement-breakpoint
