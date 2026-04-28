/**
 * Agent dispatcher — entry point invoked by the message pipeline.
 *
 * Responsibilities:
 *   1. Gating (kill-switch, business hours, already-assigned, fromMe filter, group filter, rate limit).
 *   2. Load agent config + conversation history.
 *   3. Run agentLoop.
 *   4. Send reply via WhatsApp manager (when outcome="replied").
 *   5. Persist agent_runs + agent_conversation_state.
 *   6. Log AI usage (token cost).
 *
 * Designed to be safe to call inline from a worker — never throws to caller.
 */

import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import { whatsappManager } from "../../whatsappEvolution";
import { runAgent } from "./agentLoop";
import type { ToolContext } from "./agentTools/types";

export type DispatchInput = {
  tenantId: number;
  sessionId: string;
  remoteJid: string;
  triggerMessageId?: string;
  triggerText: string;
  fromMe: boolean;
  isGroup: boolean;
};

export type DispatchOutcome = "replied" | "handed_off" | "no_action" | "errored";

export async function dispatchAgent(input: DispatchInput): Promise<{ outcome: DispatchOutcome; reason?: string }> {
  const t0 = Date.now();
  const db = await getDb();
  if (!db) return logNoAction(input, "db_unavailable");

  // 0. Filtros básicos
  if (input.fromMe) return logNoAction(input, "fromMe");
  if (!input.triggerText?.trim()) return logNoAction(input, "empty_trigger");

  // 1. Carrega agent config (per-session ou tenant default)
  const agentRow = await loadAgent(input.tenantId, input.sessionId);
  if (!agentRow) return logNoAction(input, "no_agent_config");
  if (!agentRow.enabled || agentRow.modeSwitch !== "autonomous") {
    return logNoAction(input, `mode_${agentRow.modeSwitch}`, agentRow.id);
  }

  // 2. Filtros de chat type
  if (input.isGroup && !agentRow.respondGroups) return logNoAction(input, "group_filtered", agentRow.id);
  if (!input.isGroup && !agentRow.respondPrivate) return logNoAction(input, "private_filtered", agentRow.id);

  // 3. Conversa já atribuída a humano → não responder
  const conv = await loadConversation(input.tenantId, input.sessionId, input.remoteJid);
  if (conv?.assignedUserId) return logNoAction(input, "already_assigned", agentRow.id);

  // 4. Kill-switches granulares
  if (await hasKillSwitch(input.tenantId, input.sessionId, input.remoteJid)) {
    return logNoAction(input, "kill_switch", agentRow.id);
  }

  // 5. Horário comercial
  if (agentRow.businessHoursEnabled && !isWithinBusinessHours(agentRow)) {
    return logNoAction(input, "off_hours", agentRow.id);
  }

  // 6. Rate limit
  if (await isRateLimited(input.tenantId, input.remoteJid, agentRow)) {
    return logNoAction(input, "rate_limited", agentRow.id);
  }

  // 7. Estado da conversa (cria se não existir)
  const state = await ensureConversationState(input.tenantId, input.sessionId, input.remoteJid, agentRow.id);
  if (state.status !== "active") return logNoAction(input, `state_${state.status}`, agentRow.id);

  // 8. Histórico recente
  const history = await loadHistory(
    input.sessionId,
    input.remoteJid,
    agentRow.contextMessageCount ?? 10,
    input.triggerMessageId
  );

  // 9. Run agent loop
  const ctx: ToolContext = {
    tenantId: input.tenantId,
    sessionId: input.sessionId,
    remoteJid: input.remoteJid,
    agentId: agentRow.id,
    conversationStateId: state.id,
  };

  // Injeta knowledge base (FAQ/policy/product_info) ativos no system prompt
  let augmentedSystemPrompt = agentRow.systemPrompt as string | null;
  try {
    const { listAgentKnowledge } = await import("../../crmDb");
    const entries = await listAgentKnowledge(input.tenantId, { activeOnly: true });
    if (entries.length > 0) {
      const groups: Record<string, string[]> = { faq: [], policy: [], product_info: [] };
      for (const e of entries as any[]) {
        const t = e.sourceType || "faq";
        if (!groups[t]) groups[t] = [];
        groups[t].push(`- ${e.title}: ${e.content}`);
      }
      const sections: string[] = [];
      if (groups.policy?.length) sections.push(`## Políticas e regras\n${groups.policy.join("\n")}`);
      if (groups.product_info?.length) sections.push(`## Informações de produtos/serviços\n${groups.product_info.join("\n")}`);
      if (groups.faq?.length) sections.push(`## Perguntas frequentes (use para responder dúvidas comuns)\n${groups.faq.join("\n")}`);
      const kbBlock = sections.join("\n\n");
      if (kbBlock) {
        const base = augmentedSystemPrompt || "";
        augmentedSystemPrompt = `${base ? base + "\n\n" : ""}${kbBlock}\n\nSe a pergunta do cliente é coberta por essas informações, responda diretamente sem precisar usar tools.`;
      }
    }
  } catch (e: any) {
    console.warn("[agentDispatcher] knowledge injection failed:", e?.message);
  }

  const result = await runAgent({
    agent: {
      id: agentRow.id,
      systemPrompt: augmentedSystemPrompt,
      model: agentRow.model,
      temperature: agentRow.temperature,
      maxTokens: agentRow.maxTokens,
      maxTurns: agentRow.maxTurns,
      toolsAllowed: Array.isArray(agentRow.toolsAllowed) ? agentRow.toolsAllowed : ["lookup_crm", "qualify", "deal", "handoff"],
      escalateConfidenceBelow: agentRow.escalateConfidenceBelow,
    },
    history,
    triggerMessage: input.triggerText,
    ctx,
  });

  // 10. Enviar reply (se outcome=replied)
  if (result.outcome === "replied" && result.replyText) {
    if ((agentRow.replyDelayMs ?? 0) > 0) {
      await sleep(Math.min(agentRow.replyDelayMs, 5000));
    }
    try {
      await whatsappManager.sendTextMessage(input.sessionId, input.remoteJid, result.replyText);
    } catch (e: any) {
      result.outcome = "errored";
      result.errorMessage = `send failed: ${e?.message ?? "unknown"}`;
    }
  }

  // 11. Persist agent_run
  const durationMs = Date.now() - t0;
  await persistRun({
    tenantId: input.tenantId,
    agentId: agentRow.id,
    conversationStateId: state.id,
    sessionId: input.sessionId,
    remoteJid: input.remoteJid,
    triggerMessageId: input.triggerMessageId ?? null,
    inputText: input.triggerText,
    outcome: result.outcome,
    replyText: result.replyText ?? null,
    toolCalls: result.toolCalls,
    modelMessages: result.modelMessages,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    durationMs,
    errorMessage: result.errorMessage ?? null,
  });

  // 12. Atualiza state
  await db.execute(sql`
    UPDATE agent_conversation_state
    SET "turnsCount" = "turnsCount" + ${result.outcome === "replied" ? 1 : 0},
        status = ${result.outcome === "handed_off" ? "handed_off" : "active"},
        "lastRunAt" = NOW(),
        "updatedAt" = NOW()
    WHERE id = ${state.id}
  `);

  return { outcome: result.outcome, reason: result.errorMessage };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loadAgent(tenantId: number, sessionId: string) {
  const db = await getDb();
  if (!db) return null;
  // Prefer agent específico da sessão, fallback para tenant-default (sessionId IS NULL)
  const rows = await db.execute(sql`
    SELECT * FROM agents
    WHERE "tenantId" = ${tenantId}
      AND ("sessionId" = ${sessionId} OR "sessionId" IS NULL)
    ORDER BY "sessionId" NULLS LAST
    LIMIT 1
  `);
  const r = ((rows as any).rows ?? (rows as any))?.[0];
  return r ? r : null;
}

async function loadConversation(tenantId: number, sessionId: string, remoteJid: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.execute(sql`
    SELECT id, "assignedUserId", status
    FROM wa_conversations
    WHERE "tenantId" = ${tenantId} AND "sessionId" = ${sessionId} AND "remoteJid" = ${remoteJid}
    LIMIT 1
  `);
  const r = ((rows as any).rows ?? (rows as any))?.[0];
  return r ?? null;
}

async function hasKillSwitch(tenantId: number, sessionId: string, remoteJid: string) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.execute(sql`
    SELECT 1 FROM agent_kill_switches
    WHERE "tenantId" = ${tenantId}
      AND (
        scope = 'tenant'
        OR (scope = 'session' AND "sessionId" = ${sessionId})
        OR (scope = 'conversation' AND "sessionId" = ${sessionId} AND "remoteJid" = ${remoteJid})
      )
    LIMIT 1
  `);
  const arr = (rows as any).rows ?? (rows as any) ?? [];
  return arr.length > 0;
}

function isWithinBusinessHours(agent: any): boolean {
  try {
    const tz = agent.businessHoursTimezone || "America/Sao_Paulo";
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = fmt.formatToParts(now);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = weekdayMap[get("weekday")] ?? -1;
    const allowedDays = String(agent.businessHoursDays || "1,2,3,4,5").split(",").map((d: string) => parseInt(d.trim(), 10));
    if (!allowedDays.includes(dow)) return false;
    const hour = parseInt(get("hour"), 10);
    const minute = parseInt(get("minute"), 10);
    const cur = hour * 60 + minute;
    const [sh, sm] = String(agent.businessHoursStart || "09:00").split(":").map((n: string) => parseInt(n, 10));
    const [eh, em] = String(agent.businessHoursEnd || "18:00").split(":").map((n: string) => parseInt(n, 10));
    return cur >= sh * 60 + sm && cur <= eh * 60 + em;
  } catch {
    return true; // fail-open: se TZ falhar, deixa passar
  }
}

async function isRateLimited(tenantId: number, remoteJid: string, agent: any): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const perContact = agent.rateLimitPerContactPerHour ?? 20;
  const perTenant = agent.rateLimitPerTenantPerHour ?? 500;
  const rows = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE "remoteJid" = ${remoteJid}) AS contact_count,
      COUNT(*) AS tenant_count
    FROM agent_runs
    WHERE "tenantId" = ${tenantId}
      AND "createdAt" > NOW() - INTERVAL '1 hour'
      AND outcome IN ('replied','handed_off')
  `);
  const r = ((rows as any).rows ?? (rows as any))?.[0];
  if (!r) return false;
  return Number(r.contact_count) >= perContact || Number(r.tenant_count) >= perTenant;
}

async function ensureConversationState(tenantId: number, sessionId: string, remoteJid: string, agentId: number) {
  const db = await getDb();
  if (!db) throw new Error("db unavailable");
  const rows = await db.execute(sql`
    SELECT id, status FROM agent_conversation_state
    WHERE "tenantId" = ${tenantId} AND "sessionId" = ${sessionId} AND "remoteJid" = ${remoteJid}
    LIMIT 1
  `);
  let r = ((rows as any).rows ?? (rows as any))?.[0];
  if (r) return r;
  const inserted = await db.execute(sql`
    INSERT INTO agent_conversation_state ("tenantId", "sessionId", "remoteJid", "agentId", status)
    VALUES (${tenantId}, ${sessionId}, ${remoteJid}, ${agentId}, 'active')
    RETURNING id, status
  `);
  return ((inserted as any).rows ?? (inserted as any))?.[0];
}

async function loadHistory(
  sessionId: string,
  remoteJid: string,
  limit: number,
  excludeMessageId?: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT content, "fromMe", timestamp, "messageType"
    FROM messages
    WHERE "sessionId" = ${sessionId}
      AND "remoteJid" = ${remoteJid}
      AND "messageType" NOT IN ('protocolMessage','senderKeyDistributionMessage','messageContextInfo','reactionMessage','ephemeralMessage')
      AND content IS NOT NULL AND content <> ''
      ${excludeMessageId ? sql`AND "messageId" <> ${excludeMessageId}` : sql``}
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `);
  const arr = ((rows as any).rows ?? (rows as any) ?? []) as Array<{ content: string; fromMe: boolean }>;
  return arr
    .reverse()
    .map(r => ({ role: r.fromMe ? "assistant" : "user", content: String(r.content) } as const));
}

async function persistRun(params: {
  tenantId: number;
  agentId: number;
  conversationStateId: number;
  sessionId: string;
  remoteJid: string;
  triggerMessageId: string | null;
  inputText: string;
  outcome: string;
  replyText: string | null;
  toolCalls: unknown;
  modelMessages: unknown;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  errorMessage: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql`
      INSERT INTO agent_runs (
        "tenantId", "agentId", "conversationStateId", "sessionId", "remoteJid",
        "triggerMessageId", "inputText", outcome, "replyText",
        "toolCalls", "modelMessages",
        "inputTokens", "outputTokens", "durationMs", "errorMessage"
      ) VALUES (
        ${params.tenantId}, ${params.agentId}, ${params.conversationStateId}, ${params.sessionId}, ${params.remoteJid},
        ${params.triggerMessageId}, ${params.inputText}, ${params.outcome}::agent_run_outcome, ${params.replyText},
        ${JSON.stringify(params.toolCalls)}::json, ${JSON.stringify(params.modelMessages)}::json,
        ${params.inputTokens}, ${params.outputTokens}, ${params.durationMs}, ${params.errorMessage}
      )
    `);
  } catch (e: any) {
    console.error("[agentDispatcher] failed to persist run:", e?.message);
  }
}

async function logNoAction(input: DispatchInput, reason: string, agentId?: number): Promise<{ outcome: DispatchOutcome; reason: string }> {
  // Best-effort: log no_action only when we know which agent (avoids spamming if no agent at all)
  if (agentId) {
    const db = await getDb();
    if (db) {
      try {
        await db.execute(sql`
          INSERT INTO agent_runs (
            "tenantId", "agentId", "sessionId", "remoteJid",
            "triggerMessageId", "inputText", outcome, "errorMessage"
          ) VALUES (
            ${input.tenantId}, ${agentId}, ${input.sessionId}, ${input.remoteJid},
            ${input.triggerMessageId ?? null}, ${input.triggerText}, 'no_action'::agent_run_outcome, ${reason}
          )
        `);
      } catch {
        /* não-crítico */
      }
    }
  }
  return { outcome: "no_action", reason };
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
