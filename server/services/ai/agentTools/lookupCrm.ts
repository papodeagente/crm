/**
 * Tool: lookup_crm
 * Reads contact + active deals + recent activity for the conversation's remoteJid.
 * Pure DB read — no side effects.
 */

import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "../../../db";
import type { ToolContext, ToolDescriptor, ToolResult } from "./types";

const Input = z.object({
  // Optional override; when omitted we use ctx.remoteJid (preferred).
  remoteJid: z.string().optional(),
});

type Out = {
  contact: { id: number; name: string | null; email: string | null; phone: string | null } | null;
  deals: Array<{ id: number; title: string; stageName: string | null; status: string; valueCents: number | null }>;
  conversationSummary: string;
};

export const lookupCrmTool: ToolDescriptor = {
  name: "lookup_crm",
  manifest: {
    type: "function",
    function: {
      name: "lookup_crm",
      description:
        "Busca dados do CRM (contato, deals ativos, atividade recente) para a conversa atual. Use ANTES de prometer ou criar coisas — para evitar duplicatas e contextualizar a resposta.",
      parameters: {
        type: "object",
        properties: {
          remoteJid: {
            type: "string",
            description: "Opcional. Se omitido, usa o JID da conversa atual.",
          },
        },
      },
    },
  },
  async execute(rawInput, ctx: ToolContext): Promise<ToolResult<Out>> {
    const parsed = Input.safeParse(rawInput ?? {});
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    const remoteJid = parsed.data.remoteJid || ctx.remoteJid;

    const db = await getDb();
    if (!db) return { ok: false, error: "DB indisponível" };

    // Contato via wa_conversations.contactId (já está resolvido)
    const convRows = await db.execute(sql`
      SELECT wc."contactId", wc."contactPushName", wc."phoneE164",
             c.name AS contact_name, c.email AS contact_email, c.phone AS contact_phone
      FROM wa_conversations wc
      LEFT JOIN contacts c ON c.id = wc."contactId"
      WHERE wc."tenantId" = ${ctx.tenantId}
        AND wc."sessionId" = ${ctx.sessionId}
        AND wc."remoteJid" = ${remoteJid}
      LIMIT 1
    `);
    const convRow = (convRows as any).rows?.[0] ?? (convRows as any)[0];
    const contactId: number | null = convRow?.contactId ?? null;
    const contact = contactId
      ? {
          id: contactId,
          name: convRow?.contact_name ?? convRow?.contactPushName ?? null,
          email: convRow?.contact_email ?? null,
          phone: convRow?.contact_phone ?? convRow?.phoneE164 ?? null,
        }
      : null;

    // Deals ativos do contato
    let deals: Out["deals"] = [];
    if (contactId) {
      const dealRows = await db.execute(sql`
        SELECT d.id, d.title, d.status, d."valueCents", ps.name AS "stageName"
        FROM deals d
        LEFT JOIN pipeline_stages ps ON ps.id = d."stageId"
        WHERE d."tenantId" = ${ctx.tenantId}
          AND d."contactId" = ${contactId}
          AND d."deletedAt" IS NULL
          AND d.status = 'open'
        ORDER BY d."updatedAt" DESC
        LIMIT 5
      `);
      const rows = (dealRows as any).rows ?? (dealRows as any) ?? [];
      deals = rows.map((r: any) => ({
        id: Number(r.id),
        title: String(r.title),
        stageName: r.stageName ?? null,
        status: String(r.status),
        valueCents: r.valueCents ? Number(r.valueCents) : null,
      }));
    }

    const summary = [
      contact ? `Contato: ${contact.name ?? "sem nome"}${contact.phone ? ` (${contact.phone})` : ""}` : "Contato não cadastrado no CRM.",
      deals.length > 0
        ? `Deals abertos: ${deals.map(d => `#${d.id} "${d.title}" em ${d.stageName ?? "?"}`).join("; ")}`
        : "Nenhum deal aberto.",
    ].join(" ");

    return { ok: true, data: { contact, deals, conversationSummary: summary } };
  },
};
