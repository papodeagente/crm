/**
 * Identity Resolver — nome + foto + LID do contato.
 *
 * Este módulo é a fonte canônica de verdade pra:
 * - prioridade de nome ([NAME_PRIORITY]) e sobrescrita controlada
 * - fast-path de resolução LID → contactId via índices DB (sem HTTP)
 * - enrichment em background (avatar + vname via Z-API /contacts/{id})
 *
 * Decisão de produto: `whatsapp_profile` (senderName) vence sempre, inclusive
 * edição manual no CRM. Ver specs/domains/inbox.spec.md.
 */

import { getDb } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { contacts, channelIdentities, waIdentities } from "../drizzle/schema";

// ════════════════════════════════════════════════════════════
// NAME PRIORITY
// ════════════════════════════════════════════════════════════

export const NAME_PRIORITY = {
  crm: 5,              // edit manual no CRM — vence TUDO (decisão do usuário)
  whatsapp_profile: 4, // body.senderName (nome do perfil WA do remetente)
  lead_form: 3,        // RD/forms/integrações
  whatsapp_push: 2,    // fallback de webhook sem senderName explícito (chatName/agenda do dono)
  phone_fallback: 1,   // "+5581..." quando nada mais existe
} as const;

export type NameSource = keyof typeof NAME_PRIORITY;

const BANNED_NAMES = new Set(["você", "voce", "you", "tu"]);

/**
 * Rejeita strings que não devem virar `contacts.name`:
 *  - vazias/whitespace
 *  - começam com "+"
 *  - apenas dígitos
 *  - contêm "@" (é JID, não nome)
 *  - palavras banidas (Você/You/tu)
 */
export function isValidName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith("+")) return false;
  if (trimmed.includes("@")) return false;
  const cleaned = trimmed.replace(/[\s\-\(\)\+]/g, "");
  if (/^\d+$/.test(cleaned)) return false;
  if (BANNED_NAMES.has(trimmed.toLowerCase())) return false;
  return true;
}

/**
 * True se `newSource` deve sobrescrever `currentSource` em `contacts.name`.
 * Regra: prioridade nova >= atual. Se atual é null, sempre sobrescreve.
 */
export function shouldUpdateName(
  currentSource: NameSource | string | null | undefined,
  newSource: NameSource,
): boolean {
  if (!currentSource) return true;
  const curPrio = (NAME_PRIORITY as Record<string, number>)[currentSource];
  if (curPrio === undefined) return true; // source desconhecido → trata como fraco
  const newPrio = NAME_PRIORITY[newSource];
  return newPrio >= curPrio;
}

/**
 * True se devemos sobrescrever `contacts.avatarUrl`.
 * Regras:
 *   - current null → sempre atualiza
 *   - new URL é do nosso S3 (amazonaws) → sempre atualiza (persistente)
 *   - current é não-S3 → sempre atualiza (substitui URL volátil por nova)
 *   - current é S3 e new também → atualiza se current > 7 dias
 */
export function shouldUpdatePhoto(
  currentUrl: string | null | undefined,
  currentUpdatedAt: Date | null | undefined,
  newUrl: string | null | undefined,
): boolean {
  if (!newUrl) return false;
  if (!currentUrl) return true;
  const currentIsS3 = /\.amazonaws\.com\//.test(currentUrl);
  const newIsS3 = /\.amazonaws\.com\//.test(newUrl);
  if (newIsS3 && !currentIsS3) return true;
  if (!newIsS3 && currentIsS3) return false; // não troca S3 por volátil
  // ambos S3 ou ambos voláteis: refresh se >7 dias
  if (!currentUpdatedAt) return true;
  const ageMs = Date.now() - new Date(currentUpdatedAt).getTime();
  return ageMs > 7 * 24 * 60 * 60 * 1000;
}

// ════════════════════════════════════════════════════════════
// QUICK RESOLVE (só índices, sem HTTP)
// ════════════════════════════════════════════════════════════

export type QuickResolveSource =
  | "channel_identities"
  | "contacts_lid"
  | "contacts_phone"
  | "wa_identities_legacy";

export interface QuickResolveResult {
  contactId: number;
  source: QuickResolveSource;
}

/**
 * Resolve contactId por índice DB (3 lookups, O(1) cada).
 * Ordem:
 *   1. channel_identities (fonte primária — unique por externalId)
 *   2. contacts.whatsappLid (fast-path criado no backfill)
 *   3. wa_identities (legacy fallback — mantido por backwards-compat)
 *   4. contacts.phoneE164 (quando webhook trouxe phone real)
 *
 * Retorna null se nenhum matchou — caller deve cair pra resolução via HTTP
 * (Z-API /chats/{lid}) ou criação de novo contato.
 */
export async function quickResolveContact(
  tenantId: number,
  ids: { chatLid?: string | null; phoneE164?: string | null },
): Promise<QuickResolveResult | null> {
  const db = await getDb();
  if (!db) return null;
  const { chatLid, phoneE164 } = ids;

  if (chatLid && chatLid.includes("@lid")) {
    // 1. channel_identities
    const ci = await db
      .select({ contactId: channelIdentities.contactId })
      .from(channelIdentities)
      .where(and(
        eq(channelIdentities.tenantId, tenantId),
        eq(channelIdentities.channel, "whatsapp_unofficial"),
        eq(channelIdentities.externalId, chatLid),
      ))
      .limit(1);
    if (ci[0]) return { contactId: ci[0].contactId, source: "channel_identities" };

    // 2. contacts.whatsappLid
    const cl = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(
        eq(contacts.tenantId, tenantId),
        eq(contacts.whatsappLid, chatLid),
      ))
      .limit(1);
    if (cl[0]) return { contactId: cl[0].id, source: "contacts_lid" };

    // 3. wa_identities (legacy)
    const wi = await db
      .select({ contactId: waIdentities.contactId })
      .from(waIdentities)
      .where(and(
        eq(waIdentities.tenantId, tenantId),
        eq(waIdentities.remoteJid, chatLid),
      ))
      .limit(1);
    if (wi[0]?.contactId) return { contactId: wi[0].contactId, source: "wa_identities_legacy" };
  }

  // 4. contacts.phoneE164
  if (phoneE164) {
    const cp = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(
        eq(contacts.tenantId, tenantId),
        eq(contacts.phoneE164, phoneE164),
      ))
      .limit(1);
    if (cp[0]) return { contactId: cp[0].id, source: "contacts_phone" };
  }

  return null;
}

// ════════════════════════════════════════════════════════════
// BACKGROUND ENRICHMENT (fire-and-forget)
// ════════════════════════════════════════════════════════════

/**
 * Enriquece contato via Z-API.
 *
 * IMPORTANTE — nome: `/contacts/{id}` retorna o nome que o DONO da instância tem
 * na agenda do celular dele (idêntico a `body.chatName` do webhook). NÃO é o
 * perfil real do contato. Por isso NÃO tocamos em `contacts.name` aqui.
 * O nome vem apenas via `body.senderName` de mensagens inbound reais.
 *
 * O que persistimos:
 *   1. `contacts.avatarUrl` — rehospedada em S3 (URL Z-API volátil expira)
 *   2. `contacts.whatsappLid` + `whatsappLidCheckedAt`
 *   3. `channel_identities` (channel=whatsapp_unofficial, externalId=LID)
 *
 * Fire-and-forget — errors são logados mas não propagam.
 */
export async function backgroundResolveExtras(
  tenantId: number,
  contactId: number,
  phoneOrLid: string,
  instanceName: string,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const { zapiProvider } = await import("./providers/zapiProvider");
    const profile = await zapiProvider.getContactProfile(instanceName, phoneOrLid);
    if (!profile) return;

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    // Avatar — baixa e rehosta em S3 pra URL persistente.
    // Sem isso, a imgUrl (pps.whatsapp.net) expira em horas.
    if (profile.imgUrl) {
      const [cur] = await db
        .select({ avatarUrl: contacts.avatarUrl, updatedAt: contacts.updatedAt })
        .from(contacts)
        .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
        .limit(1);
      if (cur && shouldUpdatePhoto(cur.avatarUrl, cur.updatedAt, profile.imgUrl)) {
        try {
          const rehosted = await rehostAvatarToS3(profile.imgUrl, tenantId, contactId);
          updates.avatarUrl = rehosted || profile.imgUrl; // fallback URL volátil se S3 falhar
        } catch (err: any) {
          console.warn(`[IdentityResolver] avatar rehost failed contact=${contactId}:`, err.message);
          updates.avatarUrl = profile.imgUrl;
        }
      }
    }

    // LID + timestamp de check
    if (profile.lid) {
      updates.whatsappLid = profile.lid;
      updates.whatsappLidCheckedAt = new Date();
    }

    if (Object.keys(updates).length > 1) {
      await db
        .update(contacts)
        .set(updates as any)
        .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));
    }

    // Upsert channel_identities (chaveado por channel+externalId)
    if (profile.lid) {
      await db
        .insert(channelIdentities)
        .values({
          tenantId,
          contactId,
          channel: "whatsapp_unofficial",
          externalId: profile.lid,
        })
        .onConflictDoNothing();
    }

    // ── Merge proativo LID ↔ phone ──
    // Quando descobrimos o LID de um contato com phone, qualquer conversa
    // separada criada pelo LID (ex.: "12345@lid") é mesclada na canônica
    // do phoneE164. Sem esse merge, a Inbox mostra a conversa duplicada.
    if (profile.lid) {
      try {
        const lidJid = profile.lid.includes("@") ? profile.lid : `${profile.lid.replace(/\D/g, "")}@lid`;
        // Acha conversa com remoteJid igual ao LID (não mesclada)
        const lidConvs = await db.execute(sql`
          SELECT id, "sessionId", "remoteJid", "phoneE164" FROM wa_conversations
          WHERE "tenantId" = ${tenantId}
            AND ("remoteJid" = ${lidJid} OR "chatLid" = ${lidJid})
            AND "mergedIntoId" IS NULL
        `);
        const lidRows = ((lidConvs as any).rows ?? lidConvs) as any[];

        for (const lidRow of lidRows) {
          // Procura conversa canônica (pelo phoneE164 do contato) na mesma sessão
          const [contactRow] = await db
            .select({ phoneE164: contacts.phoneE164 })
            .from(contacts)
            .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
            .limit(1);
          const phoneE164 = contactRow?.phoneE164;
          if (!phoneE164) continue;

          const canonicalRows = await db.execute(sql`
            SELECT id FROM wa_conversations
            WHERE "tenantId" = ${tenantId}
              AND "sessionId" = ${lidRow.sessionId}
              AND "phoneE164" = ${phoneE164}
              AND id <> ${lidRow.id}
              AND "mergedIntoId" IS NULL
            ORDER BY id ASC LIMIT 1
          `);
          const canonical = ((canonicalRows as any).rows ?? canonicalRows)?.[0];
          if (!canonical) {
            // Não há canônica ainda — apenas grava phoneE164 na LID conv pra
            // virar canônica em si.
            await db.execute(sql`
              UPDATE wa_conversations SET "phoneE164" = ${phoneE164}
              WHERE id = ${lidRow.id}
            `);
            continue;
          }

          // Merge: reatribui mensagens e marca a LID conv como ghost.
          await db.execute(sql`UPDATE messages SET "waConversationId" = ${canonical.id} WHERE "waConversationId" = ${lidRow.id}`);
          await db.execute(sql`UPDATE deals SET "waConversationId" = ${canonical.id} WHERE "waConversationId" = ${lidRow.id}`);
          await db.execute(sql`
            UPDATE wa_conversations
            SET "mergedIntoId" = ${canonical.id}, status = 'closed', "updatedAt" = NOW()
            WHERE id = ${lidRow.id}
          `);
          console.log(`[IdentityResolver] merged LID conv #${lidRow.id} → canonical #${canonical.id} (contact=${contactId})`);
        }
      } catch (mergeErr: any) {
        console.warn(`[IdentityResolver] LID merge failed contact=${contactId}:`, mergeErr.message);
      }
    }

    console.log(`[IdentityResolver] enriched contact=${contactId} tenant=${tenantId} lid=${profile.lid || "none"} avatar=${!!updates.avatarUrl}`);
  } catch (err: any) {
    console.warn(`[IdentityResolver] backgroundResolveExtras failed for contact=${contactId}:`, err.message);
  }
}

/**
 * Baixa URL da Z-API (pps.whatsapp.net etc.) e rehosts em nosso S3.
 * Retorna URL S3 permanente ou null se falhar.
 */
async function rehostAvatarToS3(sourceUrl: string, tenantId: number, contactId: number): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > 2 * 1024 * 1024) return null; // max 2MB

    // Hash do conteúdo pra key estável — mesma foto, mesma chave (idempotente).
    const { createHash } = await import("crypto");
    const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const key = `contact-avatar/${tenantId}/${contactId}-${hash}.${ext}`;

    const { storagePut } = await import("./storage");
    const { url } = await storagePut(key, buffer, contentType);
    return url;
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════
// UPSERT CHANNEL IDENTITY (uso direto pelo webhook/resolver)
// ════════════════════════════════════════════════════════════

export async function upsertChannelIdentity(
  tenantId: number,
  contactId: number,
  externalId: string,
  channel = "whatsapp_unofficial",
): Promise<void> {
  if (!externalId || !contactId) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .insert(channelIdentities)
      .values({ tenantId, contactId, channel, externalId })
      .onConflictDoNothing();
  } catch (err: any) {
    console.warn(`[IdentityResolver] upsertChannelIdentity failed:`, err.message);
  }
}
