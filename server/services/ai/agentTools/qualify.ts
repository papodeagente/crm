/**
 * Tool: qualify
 *
 * Persists qualified fields the agent has identified from the conversation
 * (destination, dates, pax, budget, etc.) into agent_conversation_state.qualifiedFields.
 *
 * The agent's LLM brain already has full conversation context — this tool just
 * stores what it has decided. We don't run a second LLM call here; the agent is
 * the one extracting.
 */

import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "../../../db";
import type { ToolContext, ToolDescriptor, ToolResult } from "./types";

const Input = z.object({
  fields: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .describe("Mapa de campos qualificados (ex.: destino, data_ida, passageiros_adultos, orcamento_max)."),
  goal: z
    .enum(["qualifying", "scheduling", "supporting"])
    .optional()
    .describe("Estado atual da conversa: qualifying (coletando info), scheduling (marcando), supporting (suporte)."),
});

export const qualifyTool: ToolDescriptor = {
  name: "qualify",
  manifest: {
    type: "function",
    function: {
      name: "qualify",
      description:
        "Registra os campos qualificados pela conversa (destino, datas, passageiros, orçamento, etc.). Use para guardar progresso à medida que o cliente fornece informações. Pode ser chamada múltiplas vezes — campos novos se mesclam, valores existentes são atualizados.",
      parameters: {
        type: "object",
        properties: {
          fields: {
            type: "object",
            description: "Pares chave/valor com os campos coletados.",
            additionalProperties: true,
          },
          goal: {
            type: "string",
            enum: ["qualifying", "scheduling", "supporting"],
            description: "Estado atual da conversa.",
          },
        },
        required: ["fields"],
      },
    },
  },
  async execute(rawInput, ctx: ToolContext): Promise<ToolResult<{ stored: Record<string, unknown>; goal?: string }>> {
    const parsed = Input.safeParse(rawInput);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    const { fields, goal } = parsed.data;

    const db = await getDb();
    if (!db) return { ok: false, error: "DB indisponível" };

    // Upsert agent_conversation_state com merge dos qualifiedFields
    const existingRows = await db.execute(sql`
      SELECT id, "qualifiedFields"
      FROM agent_conversation_state
      WHERE "tenantId" = ${ctx.tenantId}
        AND "sessionId" = ${ctx.sessionId}
        AND "remoteJid" = ${ctx.remoteJid}
      LIMIT 1
    `);
    const existing = ((existingRows as any).rows ?? (existingRows as any))?.[0];
    const previous = (existing?.qualifiedFields as Record<string, unknown>) || {};
    const merged = { ...previous, ...fields };

    if (existing) {
      await db.execute(sql`
        UPDATE agent_conversation_state
        SET "qualifiedFields" = ${JSON.stringify(merged)}::json,
            goal = COALESCE(${goal ?? null}, goal),
            "updatedAt" = NOW()
        WHERE id = ${existing.id}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO agent_conversation_state ("tenantId", "sessionId", "remoteJid", "agentId", goal, "qualifiedFields")
        VALUES (${ctx.tenantId}, ${ctx.sessionId}, ${ctx.remoteJid}, ${ctx.agentId}, ${goal ?? "qualifying"}, ${JSON.stringify(merged)}::json)
      `);
    }

    return { ok: true, data: { stored: merged, goal } };
  },
};
