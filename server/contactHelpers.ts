/**
 * Contact Helpers — triggers fire-and-forget usados após create/update
 * para resolver LID + avatar + nome via Z-API em background.
 *
 * Usa lock Redis ("lid-resolve:{contactId}" TTL 30s) para evitar duplicação
 * quando múltiplos eventos disparam em sequência.
 */

import IORedis from "ioredis";
import { getDb } from "./db";
import { eq, and } from "drizzle-orm";
import { contacts, whatsappSessions } from "../drizzle/schema";
import { backgroundResolveExtras } from "./identityResolver";

// ── Redis lock (lazy init) ───────────────────────────────────────
let _redis: IORedis | null = null;
let _redisTried = false;

function getRedis(): IORedis | null {
  if (_redis) return _redis;
  if (_redisTried) return null;
  _redisTried = true;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    _redis = new IORedis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 5000,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
    });
    _redis.on("error", () => { /* silent */ });
    _redis.connect().catch(() => {});
    return _redis;
  } catch {
    return null;
  }
}

async function tryAcquireLock(key: string, ttlSec: number): Promise<boolean> {
  const r = getRedis();
  if (!r) return true; // sem Redis, prossegue sem lock (best-effort)
  try {
    const ok = await r.set(key, "1", "EX", ttlSec, "NX");
    return ok === "OK";
  } catch {
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────

/**
 * Dispara resolução de LID + enrichment pro contato.
 * Chamado fire-and-forget por createContact, updateContact (quando phone muda)
 * e createConversion.
 *
 * Escolhe a primeira whatsapp_session conectada do tenant para chamar Z-API.
 * Se não tem sessão conectada, apenas retorna (worker periódico vai reprocessar).
 */
export async function resolveLidForContact(
  tenantId: number,
  contactId: number,
): Promise<void> {
  const locked = await tryAcquireLock(`lid-resolve:${contactId}`, 30);
  if (!locked) {
    console.log(`[resolveLidForContact] skip lock contact=${contactId} tenant=${tenantId}`);
    return;
  }

  try {
    const db = await getDb();
    if (!db) return;
    console.log(`[resolveLidForContact] starting contact=${contactId} tenant=${tenantId}`);

    const [contact] = await db
      .select({
        phone: contacts.phone,
        phoneE164: contacts.phoneE164,
        whatsappLid: contacts.whatsappLid,
        whatsappLidCheckedAt: contacts.whatsappLidCheckedAt,
        avatarUrl: contacts.avatarUrl,
      })
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
      .limit(1);

    if (!contact?.phone && !contact?.phoneE164) {
      console.log(`[resolveLidForContact] skip no-phone contact=${contactId}`);
      return;
    }

    // Skip se sentinela ainda dentro da janela de 30 dias (re-check após).
    const RECHECK_MS = 30 * 24 * 60 * 60 * 1000;
    if (contact.whatsappLid === "not_whatsapp" && contact.whatsappLidCheckedAt) {
      const ageMs = Date.now() - new Date(contact.whatsappLidCheckedAt).getTime();
      if (ageMs < RECHECK_MS) {
        console.log(`[resolveLidForContact] skip sentinel contact=${contactId}`);
        return;
      }
    }
    // Skip apenas se tem LID resolvido E avatar PERMANENTE (S3).
    // Avatar volátil (pps.whatsapp.net, etc.) precisa ser rehospedado.
    const avatarIsS3 = !!contact.avatarUrl && /\.amazonaws\.com\//.test(contact.avatarUrl);
    if (contact.whatsappLid && contact.whatsappLid !== "not_whatsapp" && avatarIsS3) {
      console.log(`[resolveLidForContact] skip already-resolved contact=${contactId}`);
      return;
    }
    console.log(`[resolveLidForContact] proceeding contact=${contactId} lid=${contact.whatsappLid || 'null'} avatarIsS3=${avatarIsS3}`);

    // Pega primeira sessão ativa do tenant (sessionId === instanceName no Z-API)
    const [session] = await db
      .select({ sessionId: whatsappSessions.sessionId })
      .from(whatsappSessions)
      .where(eq(whatsappSessions.tenantId, tenantId))
      .limit(1);
    if (!session?.sessionId) return;

    const { zapiProvider } = await import("./providers/zapiProvider");
    const rawPhone = (contact.phoneE164 || contact.phone || "").replace(/\D/g, "");
    if (!rawPhone || rawPhone.length < 8) return;

    const check = await zapiProvider.phoneExists(session.sessionId, rawPhone);
    if (!check.exists) {
      // Sentinela — re-check em 30 dias
      await db
        .update(contacts)
        .set({
          whatsappLid: "not_whatsapp",
          whatsappLidCheckedAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));
      return;
    }

    const lidOrPhone = check.lid || rawPhone;
    // Delega enrichment completo (avatar + name + upsert channel_identities).
    await backgroundResolveExtras(tenantId, contactId, lidOrPhone, session.sessionId);
  } catch (err: any) {
    console.warn(`[contactHelpers] resolveLidForContact failed contact=${contactId}:`, err.message);
  }
}
