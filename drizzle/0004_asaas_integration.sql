-- Migration: ASAAS payment integration
-- Idempotent: usa IF NOT EXISTS / DO blocks

-- ═══════════════════════════════════════════════════════════
-- contacts: ASAAS customer linkage
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "asaasCustomerId" varchar(64);--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- proposals: ASAAS payment linkage
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "asaasPaymentId" varchar(64);--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "asaasInvoiceUrl" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "asaasBankSlipUrl" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "asaasBillingType" varchar(32);--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "asaasPaymentStatus" varchar(32);--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "asaasDueDate" timestamp;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "asaasPaidAt" timestamp;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "proposals_asaas_payment_idx" ON "proposals" USING btree ("asaasPaymentId");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- asaas_webhook_events: audit + idempotency
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "asaas_webhook_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer,
  "eventId" varchar(128) NOT NULL,
  "eventType" varchar(64) NOT NULL,
  "paymentId" varchar(64),
  "rawPayload" json,
  "processedAt" timestamp,
  "error" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "asaas_evt_eventid_idx" ON "asaas_webhook_events" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asaas_evt_payment_idx" ON "asaas_webhook_events" USING btree ("paymentId");--> statement-breakpoint
