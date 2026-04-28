/**
 * agents.* tRPC router — config CRUD, runs listing, kill-switch, pause-conversation.
 *
 * Replaces the legacy chatbot.* router endpoints (still wired in routers.ts for now;
 * they will be deleted once the new UI is in production).
 */

import { z } from "zod";
import { sql, eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, sessionTenantProcedure, tenantAdminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { agents } from "../../drizzle/schema";

const AgentUpsertInput = z.object({
  sessionId: z.string().nullable().optional(),
  name: z.string().max(128).optional(),
  enabled: z.boolean().optional(),
  modeSwitch: z.enum(["autonomous", "off", "paused"]).optional(),
  systemPrompt: z.string().nullable().optional(),
  provider: z.enum(["openai", "anthropic", "tenant_default"]).optional(),
  model: z.string().nullable().optional(),
  temperature: z.string().or(z.number()).optional(),
  maxTokens: z.number().int().min(50).max(4000).optional(),
  toolsAllowed: z.array(z.string()).optional(),
  respondGroups: z.boolean().optional(),
  respondPrivate: z.boolean().optional(),
  onlyWhenMentioned: z.boolean().optional(),
  greeting: z.string().nullable().optional(),
  away: z.string().nullable().optional(),
  businessHoursEnabled: z.boolean().optional(),
  businessHoursStart: z.string().optional(),
  businessHoursEnd: z.string().optional(),
  businessHoursDays: z.string().optional(),
  businessHoursTimezone: z.string().optional(),
  maxTurns: z.number().int().min(1).max(20).optional(),
  escalateConfidenceBelow: z.string().or(z.number()).optional(),
  contextMessageCount: z.number().int().min(1).max(50).optional(),
  replyDelayMs: z.number().int().min(0).max(60_000).optional(),
  rateLimitPerContactPerHour: z.number().int().min(0).optional(),
  rateLimitPerTenantPerHour: z.number().int().min(0).optional(),
});

function getTenantId(ctx: any): number {
  return Number(ctx.saasUser?.tenantId ?? ctx.tenantId ?? 0);
}

export const agentsRouter = router({
  /** Read agent config for a session (or tenant default). */
  get: tenantAdminProcedure
    .input(z.object({ sessionId: z.string().nullable().optional() }))
    .query(async ({ input, ctx }) => {
      const tenantId = getTenantId(ctx);
      const db = await getDb();
      if (!db) return null;
      const rows = await db.execute(sql`
        SELECT * FROM agents
        WHERE "tenantId" = ${tenantId}
          AND ${input.sessionId ? sql`"sessionId" = ${input.sessionId}` : sql`"sessionId" IS NULL`}
        LIMIT 1
      `);
      return ((rows as any).rows ?? (rows as any))?.[0] ?? null;
    }),

  /** Create or update agent config (upsert keyed by tenantId+sessionId). */
  upsert: tenantAdminProcedure
    .input(AgentUpsertInput)
    .mutation(async ({ input, ctx }) => {
      const tenantId = getTenantId(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      const sessionId = input.sessionId ?? null;
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input)) {
        if (k === "sessionId" || v === undefined) continue;
        cleaned[k] = v;
      }
      // Existing row?
      const existing = await db.select({ id: agents.id }).from(agents)
        .where(sessionId === null
          ? and(eq(agents.tenantId, tenantId), sql`"sessionId" IS NULL`)
          : and(eq(agents.tenantId, tenantId), eq(agents.sessionId, sessionId)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(agents).set({ ...cleaned, updatedAt: new Date() }).where(eq(agents.id, existing[0].id));
        return { ok: true, id: existing[0].id, action: "updated" };
      }
      const inserted = await db.insert(agents)
        .values({ tenantId, sessionId, ...cleaned } as any)
        .returning({ id: agents.id });
      return { ok: true, id: inserted[0]?.id, action: "created" };
    }),

  /** List recent agent_runs (paginated). */
  listRuns: tenantAdminProcedure
    .input(z.object({
      sessionId: z.string().optional(),
      remoteJid: z.string().optional(),
      outcome: z.enum(["replied", "handed_off", "no_action", "errored"]).optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const tenantId = getTenantId(ctx);
      const db = await getDb();
      if (!db) return [];
      const rows = await db.execute(sql`
        SELECT id, "agentId", "sessionId", "remoteJid", "triggerMessageId",
               "inputText", outcome, "replyText",
               "inputTokens", "outputTokens", "durationMs", "errorMessage", "createdAt"
        FROM agent_runs
        WHERE "tenantId" = ${tenantId}
          ${input.sessionId ? sql`AND "sessionId" = ${input.sessionId}` : sql``}
          ${input.remoteJid ? sql`AND "remoteJid" = ${input.remoteJid}` : sql``}
          ${input.outcome ? sql`AND outcome = ${input.outcome}::agent_run_outcome` : sql``}
        ORDER BY "createdAt" DESC
        LIMIT ${input.limit} OFFSET ${input.offset}
      `);
      return ((rows as any).rows ?? (rows as any)) ?? [];
    }),

  /** Detalhe completo de um run (incluindo toolCalls e modelMessages). */
  getRun: tenantAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const tenantId = getTenantId(ctx);
      const db = await getDb();
      if (!db) return null;
      const rows = await db.execute(sql`
        SELECT * FROM agent_runs
        WHERE id = ${input.id} AND "tenantId" = ${tenantId}
        LIMIT 1
      `);
      return ((rows as any).rows ?? (rows as any))?.[0] ?? null;
    }),

  /** Pause/resume agent on a specific conversation (called from Inbox UI). */
  setConversationPaused: sessionTenantProcedure
    .input(z.object({
      sessionId: z.string(),
      remoteJid: z.string(),
      paused: z.boolean(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = getTenantId(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
      if (input.paused) {
        await db.execute(sql`
          INSERT INTO agent_kill_switches ("tenantId", scope, "sessionId", "remoteJid", "pausedBy", reason)
          VALUES (${tenantId}, 'conversation', ${input.sessionId}, ${input.remoteJid}, ${ctx.user?.id ?? null}, ${input.reason ?? null})
        `);
      } else {
        await db.execute(sql`
          DELETE FROM agent_kill_switches
          WHERE "tenantId" = ${tenantId}
            AND scope = 'conversation'
            AND "sessionId" = ${input.sessionId}
            AND "remoteJid" = ${input.remoteJid}
        `);
      }
      return { ok: true };
    }),

  /** Métricas básicas (containment, handoff, custo, p95) — últimos 7 dias. */
  metrics: tenantAdminProcedure
    .input(z.object({ sessionId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const tenantId = getTenantId(ctx);
      const db = await getDb();
      if (!db) return null;
      const rows = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE outcome = 'replied') AS replied,
          COUNT(*) FILTER (WHERE outcome = 'handed_off') AS handed_off,
          COUNT(*) FILTER (WHERE outcome = 'errored') AS errored,
          COUNT(*) FILTER (WHERE outcome = 'no_action') AS no_action,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "durationMs") AS p50_ms,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs") AS p95_ms,
          AVG("inputTokens" + "outputTokens") AS avg_tokens
        FROM agent_runs
        WHERE "tenantId" = ${tenantId}
          AND "createdAt" > NOW() - INTERVAL '7 days'
          ${input.sessionId ? sql`AND "sessionId" = ${input.sessionId}` : sql``}
      `);
      return ((rows as any).rows ?? (rows as any))?.[0] ?? null;
    }),

  /** Knowledge base entries (FAQ / policy / product info) injetadas no system prompt. */
  knowledge: router({
    list: tenantAdminProcedure
      .query(async ({ ctx }) => {
        const tenantId = getTenantId(ctx);
        const { listAgentKnowledge } = await import("../crmDb");
        return listAgentKnowledge(tenantId, { activeOnly: false });
      }),
    create: tenantAdminProcedure
      .input(z.object({
        agentId: z.number().int().nullable().optional(),
        title: z.string().min(1).max(255),
        content: z.string().min(1).max(8000),
        sourceType: z.enum(["faq", "policy", "product_info"]).default("faq"),
        tags: z.string().nullable().optional(),
        isActive: z.boolean().default(true),
        orderIndex: z.number().int().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        const { createAgentKnowledge } = await import("../crmDb");
        return createAgentKnowledge({ ...input, tenantId });
      }),
    update: tenantAdminProcedure
      .input(z.object({
        id: z.number().int(),
        title: z.string().min(1).max(255).optional(),
        content: z.string().min(1).max(8000).optional(),
        sourceType: z.enum(["faq", "policy", "product_info"]).optional(),
        tags: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        orderIndex: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        const { id, ...patch } = input;
        const { updateAgentKnowledge } = await import("../crmDb");
        await updateAgentKnowledge(tenantId, id, patch as any);
        return { ok: true };
      }),
    delete: tenantAdminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        const { deleteAgentKnowledge } = await import("../crmDb");
        await deleteAgentKnowledge(tenantId, input.id);
        return { ok: true };
      }),
  }),
});

export type AgentsRouter = typeof agentsRouter;
