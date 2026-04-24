-- Migration: Client Profile Page — evolutions, anamnesis, treatments, debits, documents
-- Idempotent: uses IF NOT EXISTS / DO EXCEPTION blocks

-- ═══════════════════════════════════════════════════════════
-- 1. CREATE NEW ENUM TYPES
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN CREATE TYPE "anamnesis_question_type" AS ENUM('text', 'textarea', 'boolean', 'select', 'multiselect', 'number', 'date'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "treatment_status" AS ENUM('active', 'completed', 'cancelled', 'paused'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "debit_status" AS ENUM('pending', 'partial', 'paid', 'overdue', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "document_category" AS ENUM('receita', 'atestado', 'imagem', 'contrato', 'exame', 'consentimento', 'outro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 2. CREATE TABLE: client_evolutions
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "client_evolutions" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "contactId" integer NOT NULL,
  "appointmentId" integer,
  "treatmentId" integer,
  "title" varchar(255) NOT NULL,
  "content" text NOT NULL,
  "professionalId" integer,
  "photos" json,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "evo_tenant_contact_idx" ON "client_evolutions" USING btree ("tenantId", "contactId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evo_tenant_created_idx" ON "client_evolutions" USING btree ("tenantId", "createdAt");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 3. CREATE TABLE: anamnesis_templates
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "anamnesis_templates" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "isDefault" boolean DEFAULT false NOT NULL,
  "isActive" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "at_tenant_idx" ON "anamnesis_templates" USING btree ("tenantId");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 4. CREATE TABLE: anamnesis_questions
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "anamnesis_questions" (
  "id" serial PRIMARY KEY NOT NULL,
  "templateId" integer NOT NULL,
  "tenantId" integer NOT NULL,
  "section" varchar(255),
  "question" text NOT NULL,
  "questionType" "anamnesis_question_type" DEFAULT 'text' NOT NULL,
  "options" json,
  "isRequired" boolean DEFAULT false NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "aq_template_idx" ON "anamnesis_questions" USING btree ("templateId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aq_tenant_idx" ON "anamnesis_questions" USING btree ("tenantId");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 5. CREATE TABLE: anamnesis_responses
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "anamnesis_responses" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "contactId" integer NOT NULL,
  "templateId" integer NOT NULL,
  "answers" json NOT NULL,
  "filledByUserId" integer,
  "filledAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ar_tenant_contact_idx" ON "anamnesis_responses" USING btree ("tenantId", "contactId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ar_template_idx" ON "anamnesis_responses" USING btree ("templateId");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 6. CREATE TABLE: client_treatments
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "client_treatments" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "contactId" integer NOT NULL,
  "dealId" integer,
  "name" varchar(255) NOT NULL,
  "description" text,
  "status" "treatment_status" DEFAULT 'active' NOT NULL,
  "totalSessions" integer,
  "completedSessions" integer DEFAULT 0 NOT NULL,
  "startDate" timestamp,
  "endDate" timestamp,
  "valueCents" integer,
  "professionalId" integer,
  "notes" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ct_tenant_contact_idx" ON "client_treatments" USING btree ("tenantId", "contactId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ct_tenant_status_idx" ON "client_treatments" USING btree ("tenantId", "status");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 7. CREATE TABLE: client_debits
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "client_debits" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "contactId" integer NOT NULL,
  "dealId" integer,
  "treatmentId" integer,
  "description" varchar(500) NOT NULL,
  "totalCents" integer NOT NULL,
  "paidCents" integer DEFAULT 0 NOT NULL,
  "status" "debit_status" DEFAULT 'pending' NOT NULL,
  "dueDate" timestamp,
  "paidAt" timestamp,
  "paymentMethod" varchar(64),
  "notes" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cd_tenant_contact_idx" ON "client_debits" USING btree ("tenantId", "contactId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cd_tenant_status_idx" ON "client_debits" USING btree ("tenantId", "status");--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════
-- 8. CREATE TABLE: client_documents
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "client_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "contactId" integer NOT NULL,
  "category" "document_category" DEFAULT 'outro' NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "fileUrl" text NOT NULL,
  "fileName" varchar(255) NOT NULL,
  "mimeType" varchar(128),
  "sizeBytes" integer,
  "uploadedByUserId" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cdoc_tenant_contact_idx" ON "client_documents" USING btree ("tenantId", "contactId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cdoc_tenant_category_idx" ON "client_documents" USING btree ("tenantId", "category");--> statement-breakpoint
