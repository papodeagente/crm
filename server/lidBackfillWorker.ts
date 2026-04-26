/**
 * LID Backfill Worker — popula contacts.whatsappLid proativamente para que
 * mensagens futuras com apenas chatLid tenham fast-path de resolução.
 *
 * Cron simples com setInterval. Flag de ambiente LID_BACKFILL_ENABLED=true
 * habilita o processamento (default off — permite deploy silencioso).
 *
 * Critério de seleção: contacts com phone preenchido + (whatsappLid IS NULL
 * OR whatsappLid='not_whatsapp' com checkedAt > 30 dias). Batch de 50 por run.
 * Rate-limit: 1 request/segundo ao Z-API.
 */

import { getDb } from "./db";
import { contacts, whatsappSessions } from "../drizzle/schema";
import { and, eq, isNull, isNotNull, or, sql } from "drizzle-orm";
import { backgroundResolveExtras } from "./identityResolver";

const BATCH_SIZE = 200;
const RATE_LIMIT_MS = 200; // 5 req/s Z-API (bem abaixo do rate-limit da plataforma)
const RECHECK_AFTER_DAYS = 30;

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/** Um tick do worker: pega até BATCH_SIZE contatos e resolve LID de cada um. */
export async function runLidBackfillBatch(): Promise<{ processed: number; errors: number }> {
  const db = await getDb();
  if (!db) return { processed: 0, errors: 0 };

  // Seleciona candidatos:
  //   - whatsappLid IS NULL (nunca checado), OU
  //   - whatsappLid = 'not_whatsapp' AND whatsappLidCheckedAt < NOW() - 30 days, OU
  //   - avatarUrl NÃO-S3 (volátil) — precisa rehospedar, OU
  //   - avatarUrl NULL e whatsappLid resolvido (nunca buscou avatar)
  const rows = await db.execute(sql`
    SELECT id, "tenantId", phone, "phoneE164"
    FROM contacts
    WHERE phone IS NOT NULL
      AND "deletedAt" IS NULL
      AND (
        "whatsappLid" IS NULL
        OR (
          "whatsappLid" = 'not_whatsapp'
          AND ("whatsappLidCheckedAt" IS NULL OR "whatsappLidCheckedAt" < NOW() - INTERVAL '${sql.raw(String(RECHECK_AFTER_DAYS))} days')
        )
        OR ("avatarUrl" IS NOT NULL AND "avatarUrl" NOT LIKE '%amazonaws.com/%')
        OR ("avatarUrl" IS NULL AND "whatsappLid" IS NOT NULL AND "whatsappLid" != 'not_whatsapp')
      )
    ORDER BY "updatedAt" DESC
    LIMIT ${sql.raw(String(BATCH_SIZE))}
  `);

  const candidates = (rows as any).rows || rows as any;
  if (!candidates.length) return { processed: 0, errors: 0 };

  // Cache sessionId por tenant pra evitar SELECT repetido
  const sessionByTenant = new Map<number, string | null>();
  async function getSessionId(tenantId: number): Promise<string | null> {
    if (sessionByTenant.has(tenantId)) return sessionByTenant.get(tenantId)!;
    const [row] = await db!
      .select({ sessionId: whatsappSessions.sessionId })
      .from(whatsappSessions)
      .where(eq(whatsappSessions.tenantId, tenantId))
      .limit(1);
    const sid = row?.sessionId || null;
    sessionByTenant.set(tenantId, sid);
    return sid;
  }

  const { zapiProvider } = await import("./providers/zapiProvider");
  let processed = 0;
  let errors = 0;

  for (const c of candidates) {
    const contactId = c.id as number;
    const tenantId = c.tenantId as number;
    const rawPhone = (c.phoneE164 || c.phone || "").replace(/\D/g, "");
    if (!rawPhone || rawPhone.length < 8) continue;

    try {
      const sessionId = await getSessionId(tenantId);
      if (!sessionId) continue; // tenant sem sessão ativa — skip

      const check = await zapiProvider.phoneExists(sessionId, rawPhone);

      if (!check.exists) {
        await db.update(contacts)
          .set({
            whatsappLid: "not_whatsapp",
            whatsappLidCheckedAt: new Date(),
            updatedAt: new Date(),
          } as any)
          .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));
      } else {
        const lidOrPhone = check.lid || rawPhone;
        await backgroundResolveExtras(tenantId, contactId, lidOrPhone, sessionId);
      }
      processed++;
    } catch (err: any) {
      errors++;
      console.warn(`[LidBackfill] Error contact=${contactId}:`, err.message);
    }

    await sleep(RATE_LIMIT_MS);
  }

  return { processed, errors };
}

/** Scheduler: interval 5min, first run após 60s. Habilitado via LID_BACKFILL_ENABLED=true. */
export function startLidBackfillWorker(): void {
  if (process.env.LID_BACKFILL_ENABLED !== "true") {
    console.log("[LidBackfill] Worker disabled (LID_BACKFILL_ENABLED != 'true')");
    return;
  }

  const INTERVAL_MS = 60 * 1000;

  async function run() {
    const t0 = Date.now();
    try {
      const result = await runLidBackfillBatch();
      const durMs = Date.now() - t0;
      console.log(`[LidBackfill] tick processed=${result.processed} errors=${result.errors} duration=${Math.round(durMs/1000)}s`);
    } catch (err: any) {
      console.error("[LidBackfill] Fatal:", err.message);
    }
  }

  setTimeout(run, 30_000);
  setInterval(run, INTERVAL_MS);
  console.log(`[LidBackfill] Worker started (interval=1min, batch=${BATCH_SIZE}, rate=${RATE_LIMIT_MS}ms)`);
}
