/**
 * Tool: deal
 *
 * Creates a deal or moves it to a new stage. Used after qualify when the agent
 * has enough info to commit a record in the pipeline.
 */

import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { createDeal, updateDeal } from "../../../crmDb";
import type { ToolContext, ToolDescriptor, ToolResult } from "./types";

const Input = z.object({
  action: z.enum(["create", "update_stage"]),
  contactId: z.number().int().optional(),
  dealId: z.number().int().optional(),
  title: z.string().max(200).optional(),
  stageName: z.string().max(64).optional(),
  valueCents: z.number().int().nonnegative().optional(),
});

type Out = { dealId: number; action: string; stageId?: number; stageName?: string };

async function findDefaultPipelineAndStage(tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  const rows = await db.execute(sql`
    SELECT p.id AS "pipelineId", ps.id AS "stageId", ps.name AS "stageName"
    FROM pipelines p
    JOIN pipeline_stages ps ON ps."pipelineId" = p.id
    WHERE p."tenantId" = ${tenantId}
      AND p."deletedAt" IS NULL
      AND ps."deletedAt" IS NULL
    ORDER BY p."isDefault" DESC NULLS LAST, p.id ASC, ps."order" ASC NULLS LAST, ps.id ASC
    LIMIT 1
  `);
  const r = ((rows as any).rows ?? (rows as any))?.[0];
  if (!r) throw new Error("Nenhum pipeline configurado");
  return {
    pipelineId: Number(r.pipelineId),
    stageId: Number(r.stageId),
    stageName: r.stageName as string,
  };
}

async function findStageByName(tenantId: number, stageName: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.execute(sql`
    SELECT ps.id, ps.name, ps."pipelineId"
    FROM pipeline_stages ps
    JOIN pipelines p ON p.id = ps."pipelineId"
    WHERE p."tenantId" = ${tenantId}
      AND ps."deletedAt" IS NULL
      AND p."deletedAt" IS NULL
      AND LOWER(ps.name) = LOWER(${stageName})
    LIMIT 1
  `);
  const r = ((rows as any).rows ?? (rows as any))?.[0];
  return r
    ? { id: Number(r.id), name: r.name as string, pipelineId: Number(r.pipelineId) }
    : null;
}

export const dealTool: ToolDescriptor = {
  name: "deal",
  manifest: {
    type: "function",
    function: {
      name: "deal",
      description:
        "Cria um deal (negociação) no pipeline OU move um deal existente para outra etapa. Use APENAS quando tiver dados suficientes (mínimo: título). Para mover, informe stageName exato (ex.: 'Qualificado', 'Proposta enviada').",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update_stage"] },
          contactId: { type: "integer", description: "ID do contato (use lookup_crm para descobrir)." },
          dealId: { type: "integer", description: "ID do deal — obrigatório para update_stage." },
          title: { type: "string", description: "Título do deal — obrigatório para create." },
          stageName: { type: "string", description: "Nome exato da etapa." },
          valueCents: { type: "integer", description: "Valor estimado em centavos (opcional)." },
        },
        required: ["action"],
      },
    },
  },
  async execute(rawInput, ctx: ToolContext): Promise<ToolResult<Out>> {
    const parsed = Input.safeParse(rawInput);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    const { action, contactId, dealId, title, stageName, valueCents } = parsed.data;

    if (action === "create") {
      if (!title) return { ok: false, error: "title é obrigatório para create" };
      let pipelineId: number;
      let stageId: number;
      let resolvedStageName: string;
      if (stageName) {
        const found = await findStageByName(ctx.tenantId, stageName);
        if (!found) return { ok: false, error: `Etapa "${stageName}" não encontrada` };
        pipelineId = found.pipelineId;
        stageId = found.id;
        resolvedStageName = found.name;
      } else {
        const def = await findDefaultPipelineAndStage(ctx.tenantId);
        pipelineId = def.pipelineId;
        stageId = def.stageId;
        resolvedStageName = def.stageName;
      }
      try {
        const created = await createDeal({
          tenantId: ctx.tenantId,
          title,
          contactId,
          pipelineId,
          stageId,
          valueCents,
          leadSource: "whatsapp",
          channelOrigin: "ai_agent",
          status: "open",
        });
        if (!created?.id) return { ok: false, error: "Falha ao criar deal" };
        return { ok: true, data: { dealId: created.id, action, stageId, stageName: resolvedStageName } };
      } catch (e: any) {
        return { ok: false, error: e?.message ?? "Erro ao criar deal" };
      }
    }

    // update_stage
    if (!dealId || !stageName) return { ok: false, error: "dealId e stageName são obrigatórios para update_stage" };
    const stage = await findStageByName(ctx.tenantId, stageName);
    if (!stage) return { ok: false, error: `Etapa "${stageName}" não encontrada` };
    try {
      await updateDeal(ctx.tenantId, dealId, { stageId: stage.id, pipelineId: stage.pipelineId });
      return { ok: true, data: { dealId, action, stageId: stage.id, stageName: stage.name } };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Erro ao mover deal" };
    }
  },
};
