-- ════════════════════════════════════════════════════════════
-- 0019_automation_rules.sql — automações por gatilho de data
-- Idempotente.
-- ════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE "automation_trigger_field" AS ENUM ('birthDate', 'weddingDate', 'appointmentDate', 'followUpDate');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS automation_rules (
  id SERIAL PRIMARY KEY,
  "tenantId" INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  "triggerField" "automation_trigger_field" NOT NULL,
  "offsetDays" INTEGER NOT NULL DEFAULT 0,
  "timeOfDay" VARCHAR(5) NOT NULL DEFAULT '09:00',
  "messageTemplate" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdBy" INTEGER,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ar_tenant_active_idx ON automation_rules ("tenantId", "isActive");

CREATE TABLE IF NOT EXISTS automation_rule_runs (
  id SERIAL PRIMARY KEY,
  "ruleId" INTEGER NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "targetType" VARCHAR(16) NOT NULL,
  "targetId" INTEGER NOT NULL,
  "runDate" VARCHAR(10) NOT NULL,
  "scheduledMessageId" INTEGER,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS arr_unique_run ON automation_rule_runs ("ruleId", "targetType", "targetId", "runDate");
CREATE INDEX IF NOT EXISTS arr_tenant_idx ON automation_rule_runs ("tenantId");
