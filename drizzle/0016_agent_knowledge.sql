-- ════════════════════════════════════════════════════════════
-- 0016_agent_knowledge.sql — knowledge base do agente IA
-- Idempotente.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agent_knowledge_entries (
  id SERIAL PRIMARY KEY,
  "tenantId" INTEGER NOT NULL,
  "agentId" INTEGER,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  "sourceType" VARCHAR(32) NOT NULL DEFAULT 'faq',
  tags VARCHAR(255),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_kb_tenant_idx ON agent_knowledge_entries ("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS agent_kb_agent_idx ON agent_knowledge_entries ("agentId");
