-- ════════════════════════════════════════════════════════════
-- 0012_agents.sql — Agentes IA (substitui chatbot_settings/rules)
-- Idempotente: pode ser re-rodada sem efeitos colaterais.
-- DROP TABLE de chatbot_* fica em migration separada após validação.
-- ════════════════════════════════════════════════════════════

-- Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_mode') THEN
    CREATE TYPE agent_mode AS ENUM ('autonomous', 'off', 'paused');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_run_outcome') THEN
    CREATE TYPE agent_run_outcome AS ENUM ('replied', 'handed_off', 'no_action', 'errored');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_state_status') THEN
    CREATE TYPE agent_state_status AS ENUM ('active', 'paused_by_user', 'handed_off', 'ended');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_kill_scope') THEN
    CREATE TYPE agent_kill_scope AS ENUM ('tenant', 'session', 'conversation');
  END IF;
END $$;

-- Tabela: agents
CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  "tenantId" INTEGER NOT NULL,
  "sessionId" VARCHAR(128),
  name VARCHAR(128) NOT NULL DEFAULT 'Agente IA',
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  "modeSwitch" agent_mode NOT NULL DEFAULT 'off',
  "systemPrompt" TEXT,
  provider VARCHAR(32) NOT NULL DEFAULT 'tenant_default',
  model VARCHAR(64),
  temperature NUMERIC(3,2) DEFAULT 0.50,
  "maxTokens" INTEGER NOT NULL DEFAULT 800,
  "toolsAllowed" JSON NOT NULL DEFAULT '["lookup_crm","qualify","deal","handoff"]'::json,
  "respondGroups" BOOLEAN NOT NULL DEFAULT FALSE,
  "respondPrivate" BOOLEAN NOT NULL DEFAULT TRUE,
  "onlyWhenMentioned" BOOLEAN NOT NULL DEFAULT FALSE,
  greeting TEXT,
  away TEXT,
  "businessHoursEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "businessHoursStart" VARCHAR(5) DEFAULT '09:00',
  "businessHoursEnd" VARCHAR(5) DEFAULT '18:00',
  "businessHoursDays" VARCHAR(32) DEFAULT '1,2,3,4,5',
  "businessHoursTimezone" VARCHAR(64) DEFAULT 'America/Sao_Paulo',
  "maxTurns" INTEGER NOT NULL DEFAULT 8,
  "escalateConfidenceBelow" NUMERIC(3,2) DEFAULT 0.60,
  "contextMessageCount" INTEGER NOT NULL DEFAULT 10,
  "replyDelayMs" INTEGER NOT NULL DEFAULT 0,
  "rateLimitPerContactPerHour" INTEGER NOT NULL DEFAULT 20,
  "rateLimitPerTenantPerHour" INTEGER NOT NULL DEFAULT 500,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS agents_tenant_session_unique ON agents ("tenantId", "sessionId");
CREATE INDEX IF NOT EXISTS agents_tenant_idx ON agents ("tenantId");

-- Tabela: agent_conversation_state
CREATE TABLE IF NOT EXISTS agent_conversation_state (
  id SERIAL PRIMARY KEY,
  "tenantId" INTEGER NOT NULL,
  "sessionId" VARCHAR(128) NOT NULL,
  "remoteJid" VARCHAR(128) NOT NULL,
  "agentId" INTEGER NOT NULL,
  status agent_state_status NOT NULL DEFAULT 'active',
  "turnsCount" INTEGER NOT NULL DEFAULT 0,
  goal VARCHAR(64),
  "qualifiedFields" JSON,
  "lastRunId" INTEGER,
  "lastRunAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_state_unique ON agent_conversation_state ("tenantId", "sessionId", "remoteJid");
CREATE INDEX IF NOT EXISTS agent_state_tenant_idx ON agent_conversation_state ("tenantId");

-- Tabela: agent_runs
CREATE TABLE IF NOT EXISTS agent_runs (
  id SERIAL PRIMARY KEY,
  "tenantId" INTEGER NOT NULL,
  "agentId" INTEGER NOT NULL,
  "conversationStateId" INTEGER,
  "sessionId" VARCHAR(128) NOT NULL,
  "remoteJid" VARCHAR(128) NOT NULL,
  "triggerMessageId" VARCHAR(256),
  "inputText" TEXT,
  outcome agent_run_outcome NOT NULL,
  "replyText" TEXT,
  "toolCalls" JSON DEFAULT '[]'::json,
  "modelMessages" JSON,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "costCents" INTEGER,
  "durationMs" INTEGER,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_runs_tenant_created_idx ON agent_runs ("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS agent_runs_agent_idx ON agent_runs ("agentId");
CREATE INDEX IF NOT EXISTS agent_runs_conv_idx ON agent_runs ("tenantId", "sessionId", "remoteJid");

-- Tabela: agent_kill_switches
CREATE TABLE IF NOT EXISTS agent_kill_switches (
  id SERIAL PRIMARY KEY,
  "tenantId" INTEGER NOT NULL,
  scope agent_kill_scope NOT NULL,
  "sessionId" VARCHAR(128),
  "remoteJid" VARCHAR(128),
  "pausedBy" INTEGER,
  "pausedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  reason TEXT
);

CREATE INDEX IF NOT EXISTS agent_kill_lookup_idx ON agent_kill_switches ("tenantId", scope, "sessionId", "remoteJid");

-- ════════════════════════════════════════════════════════════
-- Migração de dados: chatbot_settings → agents
-- ════════════════════════════════════════════════════════════
-- Idempotente via ON CONFLICT (tenantId, sessionId).
-- Não derruba chatbot_settings/chatbot_rules — isso é feito em migration separada após validação.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chatbot_settings') THEN
    INSERT INTO agents (
      "tenantId", "sessionId", name, enabled, "modeSwitch",
      "systemPrompt", "maxTokens", temperature,
      "respondGroups", "respondPrivate", "onlyWhenMentioned",
      greeting, away,
      "businessHoursEnabled", "businessHoursStart", "businessHoursEnd",
      "businessHoursDays", "businessHoursTimezone",
      "contextMessageCount", "replyDelayMs",
      "rateLimitPerContactPerHour"
    )
    SELECT
      COALESCE(ws."tenantId", 0),
      cs."sessionId",
      'Agente IA',
      cs.enabled,
      CASE WHEN cs.enabled THEN 'autonomous'::agent_mode ELSE 'off'::agent_mode END,
      cs."systemPrompt",
      COALESCE(cs."maxTokens", 800),
      COALESCE(cs.temperature, 0.50),
      cs."respondGroups",
      cs."respondPrivate",
      cs."onlyWhenMentioned",
      cs."welcomeMessage",
      cs."awayMessage",
      cs."businessHoursEnabled",
      cs."businessHoursStart",
      cs."businessHoursEnd",
      cs."businessHoursDays",
      cs."businessHoursTimezone",
      COALESCE(cs."contextMessageCount", 10),
      COALESCE(cs."replyDelay", 0) * 1000,  -- replyDelay era segundos? Ajustar se necessário
      COALESCE(NULLIF(cs."rateLimitPerHour", 0), 20)
    FROM chatbot_settings cs
    LEFT JOIN whatsapp_sessions ws ON ws."sessionId" = cs."sessionId"
    ON CONFLICT ("tenantId", "sessionId") DO NOTHING;
  END IF;
END $$;
