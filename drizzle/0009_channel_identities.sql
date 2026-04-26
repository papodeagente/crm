-- Migration: channel_identities — mapeamento contact ↔ external channel IDs (LID, etc)
-- Idempotent: usa IF NOT EXISTS
-- Refs: porta identityResolver + contactHelpers de entur-os-crm-production
--   - upsertChannelIdentity() chamado em background após resolveInbound

CREATE TABLE IF NOT EXISTS "channel_identities" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "contactId" integer NOT NULL,
  "channel" varchar(32) NOT NULL,
  "externalId" varchar(512) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "channel_identities_channel_external_idx" ON "channel_identities" USING btree ("channel","externalId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_identities_tenant_contact_idx" ON "channel_identities" USING btree ("tenantId","contactId");--> statement-breakpoint
