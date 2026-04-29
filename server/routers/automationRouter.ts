/**
 * Automation Rules Router — CRUD + preview de regras de automação WhatsApp.
 */
import { z } from "zod";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure, tenantWriteProcedure, getTenantId } from "../_core/trpc";
import { getDb, rowsOf } from "../db";

const triggerFieldEnum = z.enum(["birthDate", "weddingDate", "appointmentDate", "followUpDate"]);
const timeOfDayRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const RuleInput = z.object({
  name: z.string().min(1).max(255),
  triggerField: triggerFieldEnum,
  offsetDays: z.number().int().min(-365).max(365),
  timeOfDay: z.string().regex(timeOfDayRegex, "Use HH:MM (00-23, 00-59)"),
  messageTemplate: z.string().min(1).max(4000),
  isActive: z.boolean().default(true),
});

export const automationRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const tenantId = getTenantId(ctx);
    const r = await db.execute(sql`
      SELECT id, name, "triggerField", "offsetDays", "timeOfDay", "messageTemplate",
             "isActive", "createdAt", "updatedAt"
      FROM automation_rules WHERE "tenantId" = ${tenantId}
      ORDER BY "isActive" DESC, id DESC
    `);
    return rowsOf(r);
  }),

  create: tenantWriteProcedure
    .input(RuleInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
      const tenantId = getTenantId(ctx);
      const r = await db.execute(sql`
        INSERT INTO automation_rules
          ("tenantId", name, "triggerField", "offsetDays", "timeOfDay", "messageTemplate", "isActive", "createdBy")
        VALUES (${tenantId}, ${input.name}, ${input.triggerField}::automation_trigger_field, ${input.offsetDays},
                ${input.timeOfDay}, ${input.messageTemplate}, ${input.isActive}, ${ctx.user?.id ?? null})
        RETURNING id
      `);
      return { id: (rowsOf(r)[0] as any)?.id, ok: true };
    }),

  update: tenantWriteProcedure
    .input(z.object({ id: z.number().int() }).merge(RuleInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
      const tenantId = getTenantId(ctx);
      const { id, ...patch } = input;
      const sets: any[] = [];
      const set = (col: string, val: any, cast?: string) => {
        sets.push(sql`${sql.raw(`"${col}"`)} = ${val}${cast ? sql.raw(`::${cast}`) : sql``}`);
      };
      if (patch.name !== undefined) set("name", patch.name);
      if (patch.triggerField !== undefined) set("triggerField", patch.triggerField, "automation_trigger_field");
      if (patch.offsetDays !== undefined) set("offsetDays", patch.offsetDays);
      if (patch.timeOfDay !== undefined) set("timeOfDay", patch.timeOfDay);
      if (patch.messageTemplate !== undefined) set("messageTemplate", patch.messageTemplate);
      if (patch.isActive !== undefined) set("isActive", patch.isActive);
      sets.push(sql`"updatedAt" = NOW()`);
      const setSql = sets.reduce((acc, s, i) => i === 0 ? s : sql`${acc}, ${s}`, sql``);
      await db.execute(sql`
        UPDATE automation_rules SET ${setSql}
        WHERE id = ${id} AND "tenantId" = ${tenantId}
      `);
      return { ok: true };
    }),

  delete: tenantWriteProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
      const tenantId = getTenantId(ctx);
      await db.execute(sql`DELETE FROM automation_rules WHERE id = ${input.id} AND "tenantId" = ${tenantId}`);
      return { ok: true };
    }),

  /** Lista os runs (envios já programados) das últimas N execuções. */
  recentRuns: tenantProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const tenantId = getTenantId(ctx);
      const limit = input?.limit ?? 50;
      const r = await db.execute(sql`
        SELECT arr.id, arr."ruleId", ar.name AS "ruleName", arr."targetType", arr."targetId",
               arr."runDate", arr."scheduledMessageId", arr."createdAt",
               sm."scheduledAt", sm.status AS "messageStatus"
        FROM automation_rule_runs arr
        LEFT JOIN automation_rules ar ON ar.id = arr."ruleId"
        LEFT JOIN scheduled_messages sm ON sm.id = arr."scheduledMessageId"
        WHERE arr."tenantId" = ${tenantId}
        ORDER BY arr.id DESC
        LIMIT ${limit}
      `);
      return rowsOf(r);
    }),

  /** Roda manualmente um sweep agora (admin). */
  runNow: tenantWriteProcedure.mutation(async () => {
    const { runAutomationSweep } = await import("../automationRuleWorker");
    await runAutomationSweep();
    return { ok: true };
  }),
});

export type AutomationRouter = typeof automationRouter;
