/**
 * Tool: handoff
 *
 * Hands the conversation off to a human via round-robin assignment.
 * After this tool runs the agent loop terminates (no further LLM calls).
 */

import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb, assignConversation, getNextRoundRobinAgent } from "../../../db";
import type { ToolContext, ToolDescriptor, ToolResult } from "./types";

const Input = z.object({
  reason: z.enum(["low_confidence", "user_request", "complex_intent", "off_hours", "max_turns", "policy"]),
  summary: z.string().min(1).max(2000),
});

type Out = { assignedUserId: number | null; reason: string };

export const handoffTool: ToolDescriptor = {
  name: "handoff",
  manifest: {
    type: "function",
    function: {
      name: "handoff",
      description:
        "Transfere a conversa para um agente humano via round-robin. Use quando: cliente pedir humano, intenção complexa fora do escopo, baixa confiança, ou política exigir. Inclua um SUMMARY claro com o contexto que o humano vai precisar.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            enum: ["low_confidence", "user_request", "complex_intent", "off_hours", "max_turns", "policy"],
          },
          summary: {
            type: "string",
            description: "Resumo do contexto da conversa para o humano que vai assumir.",
          },
        },
        required: ["reason", "summary"],
      },
    },
  },
  async execute(rawInput, ctx: ToolContext): Promise<ToolResult<Out>> {
    const parsed = Input.safeParse(rawInput);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    const { reason, summary } = parsed.data;

    const db = await getDb();
    if (!db) return { ok: false, error: "DB indisponível" };

    let assignedUserId: number | null = null;
    try {
      assignedUserId = await getNextRoundRobinAgent(ctx.tenantId);
    } catch {
      assignedUserId = null;
    }

    if (assignedUserId) {
      try {
        await assignConversation(ctx.tenantId, ctx.sessionId, ctx.remoteJid, assignedUserId);
      } catch (e: any) {
        return { ok: false, error: `Falha ao atribuir: ${e?.message ?? "erro"}` };
      }
    }
    // Marca o estado como handed_off mesmo quando não há agente disponível
    await db.execute(sql`
      UPDATE agent_conversation_state
      SET status = 'handed_off', "updatedAt" = NOW()
      WHERE "tenantId" = ${ctx.tenantId}
        AND "sessionId" = ${ctx.sessionId}
        AND "remoteJid" = ${ctx.remoteJid}
    `);

    // Log evento na timeline da conversa, se a tabela existir
    try {
      await db.execute(sql`
        INSERT INTO conversation_events ("tenantId", "sessionId", "remoteJid", "eventType", metadata, "createdAt")
        SELECT ${ctx.tenantId}, ${ctx.sessionId}, ${ctx.remoteJid}, 'handoff_by_agent',
               ${JSON.stringify({ reason, summary, assignedUserId })}::json, NOW()
        WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_events')
      `);
    } catch {
      /* tabela pode não existir em alguns ambientes; não falhar */
    }

    return { ok: true, data: { assignedUserId, reason } };
  },
};
