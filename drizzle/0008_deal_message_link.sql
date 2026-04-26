-- Migration: deal_message_links — auto-link entre mensagens WhatsApp e deals
-- Idempotent: usa IF NOT EXISTS
-- Refs: porta dealMessageLinkService de entur-os-crm-production
--   - linkMessageToDeals() chamado no webhook após cada mensagem (in/out)
--   - backfillDealMessageLinks() utilitário para histórico

CREATE TABLE IF NOT EXISTS "deal_message_links" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "dealId" integer NOT NULL,
  "messageDbId" integer NOT NULL,
  "linkedAt" timestamp DEFAULT now() NOT NULL,
  "linkedBy" varchar(32) DEFAULT 'auto' NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_dml_unique" ON "deal_message_links" USING btree ("dealId","messageDbId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dml_deal" ON "deal_message_links" USING btree ("tenantId","dealId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dml_msg" ON "deal_message_links" USING btree ("messageDbId");--> statement-breakpoint
