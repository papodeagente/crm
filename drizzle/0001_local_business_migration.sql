-- Migration: Transform travel CRM → local business CRM
-- Idempotent: handles case where DB was created with new schema values already

-- ═══════════════════════════════════════════════════════════
-- 1. SAFELY RENAME ENUM VALUES (skip if already renamed)
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN ALTER TYPE "category" RENAME VALUE 'flight' TO 'servico'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "category" RENAME VALUE 'hotel' TO 'pacote'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "category" RENAME VALUE 'tour' TO 'consulta'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "category" RENAME VALUE 'transfer' TO 'procedimento'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "category" RENAME VALUE 'insurance' TO 'assinatura'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "category" RENAME VALUE 'cruise' TO 'produto'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "category" RENAME VALUE 'visa' TO 'outro_legado'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN ALTER TYPE "productType" RENAME VALUE 'flight' TO 'servico'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "productType" RENAME VALUE 'hotel' TO 'pacote'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "productType" RENAME VALUE 'tour' TO 'consulta'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "productType" RENAME VALUE 'transfer' TO 'procedimento'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "productType" RENAME VALUE 'insurance' TO 'assinatura'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "productType" RENAME VALUE 'cruise' TO 'produto'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "productType" RENAME VALUE 'visa' TO 'outro_legado'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN ALTER TYPE "dateField" RENAME VALUE 'boardingDate' TO 'appointmentDate'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "dateField" RENAME VALUE 'returnDate' TO 'followUpDate'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN ALTER TYPE "deadlineReference" RENAME VALUE 'boarding_date' TO 'appointment_date'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "deadlineReference" RENAME VALUE 'return_date' TO 'follow_up_date'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN ALTER TYPE "deal_participants_role" RENAME VALUE 'traveler' TO 'client'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "deal_participants_role" RENAME VALUE 'companion' TO 'dependent'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN ALTER TYPE "trip_items_type" RENAME TO "service_delivery_items_type"; EXCEPTION WHEN undefined_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "service_delivery_items_type" RENAME VALUE 'flight' TO 'sessao'; EXCEPTION WHEN invalid_parameter_value OR undefined_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "service_delivery_items_type" RENAME VALUE 'hotel' TO 'consulta'; EXCEPTION WHEN invalid_parameter_value OR undefined_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "service_delivery_items_type" RENAME VALUE 'tour' TO 'procedimento'; EXCEPTION WHEN invalid_parameter_value OR undefined_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "service_delivery_items_type" RENAME VALUE 'transfer' TO 'retorno'; EXCEPTION WHEN invalid_parameter_value OR undefined_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "service_delivery_items_type" RENAME VALUE 'insurance' TO 'avaliacao'; EXCEPTION WHEN invalid_parameter_value OR undefined_object THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN ALTER TYPE "trips_status" RENAME TO "service_deliveries_status"; EXCEPTION WHEN undefined_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "service_deliveries_status" RENAME VALUE 'planning' TO 'scheduled'; EXCEPTION WHEN invalid_parameter_value OR undefined_object THEN NULL; END $$;--> statement-breakpoint
ALTER TYPE "service_deliveries_status" ADD VALUE IF NOT EXISTS 'confirmed';--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 2. CREATE NEW ENUM TYPES (IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN CREATE TYPE "appointmentStatus" AS ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "referralStatus" AS ENUM('pending', 'converted', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "referralRewardType" AS ENUM('discount', 'credit', 'gift', 'none'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "clientPackageStatus" AS ENUM('active', 'completed', 'expired', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 3. RENAME COLUMNS IN deals (safe — skip if already renamed)
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN ALTER TABLE "deals" RENAME COLUMN "boardingDate" TO "appointmentDate"; EXCEPTION WHEN undefined_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "deals" RENAME COLUMN "returnDate" TO "followUpDate"; EXCEPTION WHEN undefined_column THEN NULL; END $$;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 4. RENAME COLUMNS IN deal_products
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN ALTER TABLE "deal_products" RENAME COLUMN "checkIn" TO "serviceStart"; EXCEPTION WHEN undefined_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "deal_products" RENAME COLUMN "checkOut" TO "serviceEnd"; EXCEPTION WHEN undefined_column THEN NULL; END $$;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 5. RENAME COLUMNS + ADD COLUMNS IN product_catalog
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN ALTER TABLE "product_catalog" RENAME COLUMN "destination" TO "location"; EXCEPTION WHEN undefined_column THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "product_catalog" RENAME COLUMN "duration" TO "durationMinutes"; EXCEPTION WHEN undefined_column THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "product_catalog" ADD COLUMN IF NOT EXISTS "isRecurring" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "product_catalog" ADD COLUMN IF NOT EXISTS "recurringIntervalDays" integer;--> statement-breakpoint
ALTER TABLE "product_catalog" ADD COLUMN IF NOT EXISTS "sessionsIncluded" integer;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 6. RENAME TABLES (safe)
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN ALTER TABLE "trips" RENAME TO "service_deliveries"; EXCEPTION WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "trip_items" RENAME TO "service_delivery_items"; EXCEPTION WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER INDEX "trips_tenant_idx" RENAME TO "sd_tenant_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER INDEX "ti_tenant_idx" RENAME TO "sdi_tenant_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 7. ADD NEW COLUMNS TO crm_appointments
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "serviceType" varchar(100);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "crm_appointments" ADD COLUMN "status" "appointmentStatus" DEFAULT 'scheduled' NOT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "recurrenceRule" text;--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "recurrenceParentId" integer;--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "reminderSentAt" timestamp;--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "professionalId" integer;--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "contactPhone" varchar(32);--> statement-breakpoint

DO $$ BEGIN ALTER INDEX "ca_tenant_user_range_idx" RENAME TO "appt_tenant_user_range_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER INDEX "ca_tenant_range_idx" RENAME TO "appt_tenant_range_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER INDEX "ca_tenant_deal_idx" RENAME TO "appt_tenant_deal_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "appt_tenant_status_idx" ON "crm_appointments" USING btree ("tenantId", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appt_tenant_professional_idx" ON "crm_appointments" USING btree ("tenantId", "professionalId");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 8. ADD referral-related columns to contacts
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "referralCount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "referralWindowStart" timestamp;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 9. CREATE TABLE: referrals
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "referrals" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "referrerId" integer NOT NULL,
  "referredId" integer NOT NULL,
  "dealId" integer,
  "status" "referralStatus" DEFAULT 'pending' NOT NULL,
  "rewardType" "referralRewardType" DEFAULT 'none' NOT NULL,
  "rewardValue" numeric(12, 2),
  "rewardDelivered" boolean DEFAULT false NOT NULL,
  "notes" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ref_tenant_idx" ON "referrals" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ref_tenant_referrer_idx" ON "referrals" USING btree ("tenantId", "referrerId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ref_tenant_referred_idx" ON "referrals" USING btree ("tenantId", "referredId");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 10. CREATE TABLE: client_packages
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "client_packages" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "contactId" integer NOT NULL,
  "productId" integer,
  "name" varchar(255) NOT NULL,
  "totalSessions" integer NOT NULL,
  "usedSessions" integer DEFAULT 0 NOT NULL,
  "status" "clientPackageStatus" DEFAULT 'active' NOT NULL,
  "priceTotal" numeric(12, 2),
  "expiresAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cpkg_tenant_idx" ON "client_packages" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cpkg_tenant_contact_idx" ON "client_packages" USING btree ("tenantId", "contactId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cpkg_tenant_status_idx" ON "client_packages" USING btree ("tenantId", "status");--> statement-breakpoint
