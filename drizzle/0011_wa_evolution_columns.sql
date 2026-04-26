-- Migration: WhatsApp Evolution columns — agent name prefix, media metadata, LID identity
-- Idempotent: usa IF NOT EXISTS
-- Refs: porta whatsappEvolution.ts (+632 linhas) e identityResolver/mediaDownloadWorker

-- ═══════════════════════════════════════════════════════════
-- whatsapp_sessions: prefixar nome do agente nas mensagens
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "whatsapp_sessions" ADD COLUMN IF NOT EXISTS "showAgentNamePrefix" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- messages (waMessages): structured data + media retry/metadata
-- ═══════════════════════════════════════════════════════════

-- (mediaMimeType, mediaFileName, structuredData já existem em 0000 como
--  media_mime_type, media_file_name, structured_data — não recriar)
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "media_download_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "media_unavailable_since" timestamp;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- contacts: WhatsApp LID resolution + name source + avatar + pic timestamp
-- (phoneLast11 já existe em 0000; avatarUrl é novo aqui)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "avatarUrl" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "whatsappLid" varchar(128);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "whatsappLidCheckedAt" timestamp;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "nameSource" varchar(32);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "profilePicUpdatedAt" timestamp;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- wa_contacts: timestamp da última atualização do avatar
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "wa_contacts" ADD COLUMN IF NOT EXISTS "profilePicUpdatedAt" timestamp;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "contacts_whatsapp_lid_idx" ON "contacts" USING btree ("tenantId","whatsappLid");--> statement-breakpoint
