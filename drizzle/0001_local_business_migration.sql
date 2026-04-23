-- Migration: Transform travel CRM → local business CRM
-- Renames enums, columns, tables. Adds new tables for appointments, referrals, packages.

-- ═══════════════════════════════════════════════════════════
-- 1. ALTER ENUM VALUES
-- ═══════════════════════════════════════════════════════════

-- category enum: flight/hotel/tour/transfer/insurance/cruise/visa/other → servico/pacote/consulta/procedimento/assinatura/produto/other
ALTER TYPE "category" RENAME VALUE 'flight' TO 'servico';--> statement-breakpoint
ALTER TYPE "category" RENAME VALUE 'hotel' TO 'pacote';--> statement-breakpoint
ALTER TYPE "category" RENAME VALUE 'tour' TO 'consulta';--> statement-breakpoint
ALTER TYPE "category" RENAME VALUE 'transfer' TO 'procedimento';--> statement-breakpoint
ALTER TYPE "category" RENAME VALUE 'insurance' TO 'assinatura';--> statement-breakpoint
ALTER TYPE "category" RENAME VALUE 'cruise' TO 'produto';--> statement-breakpoint
-- 'visa' is no longer needed, rename to something and then remove later or keep
ALTER TYPE "category" RENAME VALUE 'visa' TO 'outro_legado';--> statement-breakpoint

-- productType enum: same transformation
ALTER TYPE "productType" RENAME VALUE 'flight' TO 'servico';--> statement-breakpoint
ALTER TYPE "productType" RENAME VALUE 'hotel' TO 'pacote';--> statement-breakpoint
ALTER TYPE "productType" RENAME VALUE 'tour' TO 'consulta';--> statement-breakpoint
ALTER TYPE "productType" RENAME VALUE 'transfer' TO 'procedimento';--> statement-breakpoint
ALTER TYPE "productType" RENAME VALUE 'insurance' TO 'assinatura';--> statement-breakpoint
ALTER TYPE "productType" RENAME VALUE 'cruise' TO 'produto';--> statement-breakpoint
ALTER TYPE "productType" RENAME VALUE 'visa' TO 'outro_legado';--> statement-breakpoint

-- dateField enum: boardingDate/returnDate → appointmentDate/followUpDate
ALTER TYPE "dateField" RENAME VALUE 'boardingDate' TO 'appointmentDate';--> statement-breakpoint
ALTER TYPE "dateField" RENAME VALUE 'returnDate' TO 'followUpDate';--> statement-breakpoint

-- deadlineReference enum: boarding_date/return_date → appointment_date/follow_up_date
ALTER TYPE "deadlineReference" RENAME VALUE 'boarding_date' TO 'appointment_date';--> statement-breakpoint
ALTER TYPE "deadlineReference" RENAME VALUE 'return_date' TO 'follow_up_date';--> statement-breakpoint

-- deal_participants_role enum: traveler/companion → client/dependent
ALTER TYPE "deal_participants_role" RENAME VALUE 'traveler' TO 'client';--> statement-breakpoint
ALTER TYPE "deal_participants_role" RENAME VALUE 'companion' TO 'dependent';--> statement-breakpoint

-- trip_items_type → service_delivery_items_type (rename enum type itself + values)
ALTER TYPE "trip_items_type" RENAME TO "service_delivery_items_type";--> statement-breakpoint
ALTER TYPE "service_delivery_items_type" RENAME VALUE 'flight' TO 'sessao';--> statement-breakpoint
ALTER TYPE "service_delivery_items_type" RENAME VALUE 'hotel' TO 'consulta';--> statement-breakpoint
ALTER TYPE "service_delivery_items_type" RENAME VALUE 'tour' TO 'procedimento';--> statement-breakpoint
ALTER TYPE "service_delivery_items_type" RENAME VALUE 'transfer' TO 'retorno';--> statement-breakpoint
ALTER TYPE "service_delivery_items_type" RENAME VALUE 'insurance' TO 'avaliacao';--> statement-breakpoint

-- trips_status → service_deliveries_status (rename enum type + values)
ALTER TYPE "trips_status" RENAME TO "service_deliveries_status";--> statement-breakpoint
ALTER TYPE "service_deliveries_status" RENAME VALUE 'planning' TO 'scheduled';--> statement-breakpoint
ALTER TYPE "service_deliveries_status" ADD VALUE IF NOT EXISTS 'confirmed';--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 2. CREATE NEW ENUM TYPES
-- ═══════════════════════════════════════════════════════════

CREATE TYPE "appointmentStatus" AS ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "referralStatus" AS ENUM('pending', 'converted', 'expired');--> statement-breakpoint
CREATE TYPE "referralRewardType" AS ENUM('discount', 'credit', 'gift', 'none');--> statement-breakpoint
CREATE TYPE "clientPackageStatus" AS ENUM('active', 'completed', 'expired', 'cancelled');--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 3. RENAME COLUMNS IN deals
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "deals" RENAME COLUMN "boardingDate" TO "appointmentDate";--> statement-breakpoint
ALTER TABLE "deals" RENAME COLUMN "returnDate" TO "followUpDate";--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 4. RENAME COLUMNS IN deal_products
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "deal_products" RENAME COLUMN "checkIn" TO "serviceStart";--> statement-breakpoint
ALTER TABLE "deal_products" RENAME COLUMN "checkOut" TO "serviceEnd";--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 5. RENAME COLUMNS + ADD COLUMNS IN product_catalog
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "product_catalog" RENAME COLUMN "destination" TO "location";--> statement-breakpoint
ALTER TABLE "product_catalog" RENAME COLUMN "duration" TO "durationMinutes";--> statement-breakpoint
ALTER TABLE "product_catalog" ADD COLUMN IF NOT EXISTS "isRecurring" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "product_catalog" ADD COLUMN IF NOT EXISTS "recurringIntervalDays" integer;--> statement-breakpoint
ALTER TABLE "product_catalog" ADD COLUMN IF NOT EXISTS "sessionsIncluded" integer;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 6. RENAME TABLES: trips → service_deliveries, trip_items → service_delivery_items
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "trips" RENAME TO "service_deliveries";--> statement-breakpoint
ALTER TABLE "trip_items" RENAME TO "service_delivery_items";--> statement-breakpoint

-- Rename indexes on the renamed tables
ALTER INDEX "trips_tenant_idx" RENAME TO "sd_tenant_idx";--> statement-breakpoint
ALTER INDEX "ti_tenant_idx" RENAME TO "sdi_tenant_idx";--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 7. ADD NEW COLUMNS TO crm_appointments
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "serviceType" varchar(100);--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "status" "appointmentStatus" DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "recurrenceRule" text;--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "recurrenceParentId" integer;--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "reminderSentAt" timestamp;--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "professionalId" integer;--> statement-breakpoint
ALTER TABLE "crm_appointments" ADD COLUMN IF NOT EXISTS "contactPhone" varchar(32);--> statement-breakpoint

-- Rename old indexes to new prefix
ALTER INDEX "ca_tenant_user_range_idx" RENAME TO "appt_tenant_user_range_idx";--> statement-breakpoint
ALTER INDEX "ca_tenant_range_idx" RENAME TO "appt_tenant_range_idx";--> statement-breakpoint
ALTER INDEX "ca_tenant_deal_idx" RENAME TO "appt_tenant_deal_idx";--> statement-breakpoint

-- New indexes for appointment queries
CREATE INDEX IF NOT EXISTS "appt_tenant_status_idx" ON "crm_appointments" USING btree ("tenantId", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appt_tenant_professional_idx" ON "crm_appointments" USING btree ("tenantId", "professionalId");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 8. ADD referral-related columns to contacts (if not present)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "referralCount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "referralWindowStart" timestamp;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 9. CREATE NEW TABLE: referrals
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
-- 10. CREATE NEW TABLE: client_packages
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
