/**
 * Reactivation Alert Scheduler
 *
 * Identifies at-risk clients (approaching ex-customer status) and
 * creates notifications + queues WhatsApp reactivation messages.
 *
 * Runs daily, checks for:
 * - Clients 60-90 days without purchase → "gentle reminder"
 * - Clients 90-120 days without purchase → "reactivation offer"
 * - Packages running low (<=2 sessions) or expiring within 7 days → renewal alert
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { createNotification } from "./db";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // Daily
const INITIAL_DELAY_MS = 5 * 60 * 1000; // 5 min after startup

// Track which contact+window combos we've notified about (resets daily)
const notifiedReactivations = new Set<string>();

async function checkReactivationAlerts() {
  const db = await getDb();
  if (!db) return;

  try {
    // ─── 1. At-risk clients (60-120 days without purchase) ───
    const atRiskClients = await db.execute(sql`
      SELECT
        c.id AS "contactId",
        c.name,
        c.phone,
        c."tenantId",
        MAX(d."updatedAt") AS "lastPurchaseDate",
        EXTRACT(DAY FROM NOW() - MAX(d."updatedAt"))::int AS "daysSince"
      FROM contacts c
      INNER JOIN deals d ON d."contactId" = c.id AND d."tenantId" = c."tenantId" AND d.status = 'won' AND d."deletedAt" IS NULL
      WHERE c."deletedAt" IS NULL
      GROUP BY c.id, c.name, c.phone, c."tenantId"
      HAVING EXTRACT(DAY FROM NOW() - MAX(d."updatedAt")) BETWEEN 60 AND 120
      ORDER BY "daysSince" DESC
      LIMIT 200
    `);

    for (const client of (atRiskClients as any).rows || []) {
      const days = Number(client.daysSince);
      const window = days >= 90 ? "reactivation" : "reminder";
      const key = `${client.contactId}:${window}`;
      if (notifiedReactivations.has(key)) continue;

      const title = window === "reactivation"
        ? `🔄 Reativação: ${client.name} (${days} dias sem compra)`
        : `⚠️ Atenção: ${client.name} (${days} dias sem compra)`;

      const body = window === "reactivation"
        ? `${client.name} está há ${days} dias sem comprar. Considere enviar uma oferta de reativação para evitar perder este cliente.`
        : `${client.name} está há ${days} dias sem retornar. Envie uma mensagem de acompanhamento.`;

      await createNotification(client.tenantId, {
        type: "reactivation_alert",
        title,
        body,
        entityType: "contact",
        entityId: String(client.contactId),
      });

      notifiedReactivations.add(key);
    }

    // ─── 2. Packages running low ───
    const expiringPackages = await db.execute(sql`
      SELECT
        cp.id AS "packageId",
        cp."tenantId",
        cp.name AS "packageName",
        cp."totalSessions",
        cp."usedSessions",
        cp."expiresAt",
        c.id AS "contactId",
        c.name AS "contactName",
        c.phone AS "contactPhone"
      FROM client_packages cp
      INNER JOIN contacts c ON c.id = cp."contactId" AND c."tenantId" = cp."tenantId"
      WHERE cp.status = 'active'
        AND (
          (cp."totalSessions" - cp."usedSessions") <= 2
          OR (cp."expiresAt" IS NOT NULL AND cp."expiresAt" <= NOW() + INTERVAL '7 days')
        )
      LIMIT 100
    `);

    for (const pkg of (expiringPackages as any).rows || []) {
      const remaining = pkg.totalSessions - pkg.usedSessions;
      const key = `pkg:${pkg.packageId}`;
      if (notifiedReactivations.has(key)) continue;

      const isExpiring = pkg.expiresAt && new Date(pkg.expiresAt) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const title = isExpiring
        ? `📦 Pacote expirando: ${pkg.packageName} — ${pkg.contactName}`
        : `📦 Pacote acabando: ${pkg.packageName} — ${remaining} sessões restantes`;

      const body = isExpiring
        ? `O pacote "${pkg.packageName}" de ${pkg.contactName} expira em breve. Ofereça renovação.`
        : `${pkg.contactName} tem apenas ${remaining} sessão(ões) restante(s) no pacote "${pkg.packageName}". Hora de oferecer renovação!`;

      await createNotification(pkg.tenantId, {
        type: "package_expiring",
        title,
        body,
        entityType: "contact",
        entityId: String(pkg.contactId),
      });

      notifiedReactivations.add(key);
    }

    // ─── 3. Referral window open (30 days post-service) ───
    const referralCandidates = await db.execute(sql`
      SELECT
        c.id AS "contactId",
        c.name,
        c.phone,
        c."tenantId",
        c."referralWindowStart"
      FROM contacts c
      WHERE c."deletedAt" IS NULL
        AND c."referralWindowStart" IS NOT NULL
        AND c."referralWindowStart" <= NOW() - INTERVAL '1 day'
        AND c."referralWindowStart" >= NOW() - INTERVAL '3 days'
        AND COALESCE(c."referralCount", 0) = 0
      LIMIT 100
    `);

    for (const cand of (referralCandidates as any).rows || []) {
      const key = `ref:${cand.contactId}`;
      if (notifiedReactivations.has(key)) continue;

      await createNotification(cand.tenantId, {
        type: "referral_opportunity",
        title: `🎁 Oportunidade de indicação: ${cand.name}`,
        body: `${cand.name} completou um atendimento recentemente. Envie uma mensagem incentivando indicações.`,
        entityType: "contact",
        entityId: String(cand.contactId),
      });

      notifiedReactivations.add(key);
    }

  } catch (err: any) {
    console.error("[ReactivationScheduler] Error:", err.message);
  }
}

let reactivationInterval: ReturnType<typeof setInterval> | null = null;

export function startReactivationScheduler() {
  if (reactivationInterval) return;
  console.log("[ReactivationScheduler] Started (daily check)");
  // Initial run after delay
  setTimeout(() => {
    checkReactivationAlerts();
    // Clear tracking set daily for fresh alerts
    reactivationInterval = setInterval(() => {
      notifiedReactivations.clear();
      checkReactivationAlerts();
    }, CHECK_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}

export function stopReactivationScheduler() {
  if (reactivationInterval) {
    clearInterval(reactivationInterval);
    reactivationInterval = null;
  }
}
