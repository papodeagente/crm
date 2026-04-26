/**
 * Profile Picture Refresher — atualiza foto de perfil de um JID específico
 * no momento em que mensagens chegam/são enviadas.
 *
 * Independe de existir contato CRM (`contacts` table pode estar vazio pro
 * destinatário). Escreve em `wa_contacts.profilePictureUrl` (per session)
 * e, opcionalmente, em `contacts.avatarUrl` (se match por phoneLast11).
 *
 * - Rehospeda imgUrl do Z-API em S3 (URL permanente)
 * - Cache em memória + TTL no DB pra não bater Z-API em toda mensagem
 * - Fire-and-forget — erros são silenciosos
 */

import IORedis from "ioredis";
import { getDb } from "./db";
import { contacts, waContacts } from "../drizzle/schema";
import { eq, and, or, isNull, not, sql } from "drizzle-orm";

const REFRESH_TTL_SEC = 24 * 60 * 60; // 24h entre refreshes do mesmo JID
const LOCK_TTL_SEC = 30;

// Cache Redis pra distributed lock (evita N chamadas paralelas mesmo JID).
let _redis: IORedis | null = null;
let _redisTried = false;
function getRedis(): IORedis | null {
  if (_redis) return _redis;
  if (_redisTried) return null;
  _redisTried = true;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    _redis = new IORedis(url, { maxRetriesPerRequest: 3, lazyConnect: true, connectTimeout: 5000 });
    _redis.on("error", () => {});
    _redis.connect().catch(() => {});
    return _redis;
  } catch { return null; }
}

async function shouldRefresh(sessionId: string, jid: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return true;
  const key = `pic-refresh:${sessionId}:${jid}`;
  try {
    const ok = await r.set(key, "1", "EX", REFRESH_TTL_SEC, "NX");
    return ok === "OK";
  } catch { return true; }
}

async function tryLock(sessionId: string, jid: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return true;
  try {
    const ok = await r.set(`pic-lock:${sessionId}:${jid}`, "1", "EX", LOCK_TTL_SEC, "NX");
    return ok === "OK";
  } catch { return true; }
}

/**
 * Dispara refresh da foto pro JID. Curto-circuito se:
 *  - JID @g.us (grupo) / @lid — ignora
 *  - Já refrescou esse JID nas últimas 24h (cache Redis)
 *  - Lock Redis (outra request já está processando)
 */
export async function refreshProfilePicForJid(
  sessionId: string,
  tenantId: number,
  jid: string,
): Promise<void> {
  if (!jid || jid.endsWith("@g.us") || jid.endsWith("@lid")) return;
  if (!(await shouldRefresh(sessionId, jid))) return;
  if (!(await tryLock(sessionId, jid))) return;

  try {
    const db = await getDb();
    if (!db) return;

    // Se já tem URL S3 válida pro JID, só atualiza TTL e retorna.
    const [existing] = await db
      .select({ pic: waContacts.profilePictureUrl, updatedAt: waContacts.profilePicUpdatedAt })
      .from(waContacts)
      .where(and(eq(waContacts.sessionId, sessionId), eq(waContacts.jid, jid)))
      .limit(1);
    const hasFreshS3 = !!existing?.pic
      && /\.amazonaws\.com\//.test(existing.pic)
      && existing.updatedAt
      && (Date.now() - new Date(existing.updatedAt).getTime()) < 7 * 24 * 60 * 60 * 1000;
    if (hasFreshS3) return;

    const phone = jid.split("@")[0].replace(/\D/g, "");
    if (!phone || phone.length < 8) return;

    const { zapiProvider } = await import("./providers/zapiProvider");
    const sourceUrl = await zapiProvider.getProfilePicture(sessionId, phone);
    if (!sourceUrl || sourceUrl === "null") return;

    // Rehost em S3
    const s3Url = await rehostToS3(sourceUrl, tenantId);
    if (!s3Url) return;

    // Update wa_contacts (session cache) — upsert se não existe
    await db
      .insert(waContacts)
      .values({
        sessionId,
        jid,
        phoneNumber: jid.endsWith("@s.whatsapp.net") ? jid.replace("@s.whatsapp.net", "") : null,
        profilePictureUrl: s3Url,
        profilePicUpdatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [waContacts.sessionId, waContacts.jid],
        set: { profilePictureUrl: s3Url, profilePicUpdatedAt: new Date() },
      })
      .catch(() => { /* noop */ });

    // Propaga pra contacts.avatarUrl (se existe contato matching por phoneLast11)
    const last11 = phone.slice(-11);
    if (last11.length >= 10) {
      await db
        .update(contacts)
        .set({ avatarUrl: s3Url, updatedAt: new Date() })
        .where(and(
          eq(contacts.tenantId, tenantId),
          eq(contacts.phoneLast11, last11),
          or(isNull(contacts.avatarUrl), not(eq(contacts.avatarUrl, s3Url))),
        ))
        .catch(() => { /* noop */ });
    }

    console.log(`[ProfilePicRefresher] updated session=${sessionId} jid=${jid} → ${s3Url.slice(-50)}`);
  } catch (err: any) {
    console.warn(`[ProfilePicRefresher] error session=${sessionId} jid=${jid}:`, err.message);
  }
}

async function rehostToS3(sourceUrl: string, tenantId: number): Promise<string | null> {
  if (/\.amazonaws\.com\//.test(sourceUrl)) return sourceUrl;
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 2 * 1024 * 1024) return null;
    const { createHash } = await import("crypto");
    const hash = createHash("sha256").update(buf).digest("hex").slice(0, 16);
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const key = `contact-avatar/${tenantId}/${hash}.${ext}`;
    const { storagePut } = await import("./storage");
    const { url } = await storagePut(key, buf, ct);
    return url;
  } catch {
    return null;
  }
}
