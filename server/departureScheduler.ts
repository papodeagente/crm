/**
 * Departure Notification Scheduler
 * 
 * Creates notifications for upcoming departures (deals with status "won" and boardingDate set).
 * Notification windows:
 *   - 7 days before departure
 *   - 3 days before departure
 *   - 1 day before departure
 *   - Day of departure
 * 
 * Runs every hour and uses an in-memory tracking set to avoid duplicate notifications.
 */
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { createNotification } from "./db";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every 1 hour

// Track which deal+window combos we've already notified about
// Format: "dealId:window" e.g. "123:7d", "123:3d", "123:1d", "123:today"
const notifiedDepartures = new Set<string>();

/**
 * Determine which notification window a departure falls into.
 * Returns null if no notification should be sent.
 */
function getDepartureWindow(boardingDate: Date, now: Date): { key: string; label: string; emoji: string } | null {
  const diffMs = boardingDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Day of departure (0 to less than 1 day)
  if (diffDays >= 0 && diffDays < 1) {
    return { key: "today", label: "hoje", emoji: "🛫" };
  }
  // 1 day before (1 to less than 2 days)
  if (diffDays >= 1 && diffDays < 2) {
    return { key: "1d", label: "amanhã", emoji: "⚠️" };
  }
  // 3 days before (3 to less than 4 days)
  if (diffDays >= 3 && diffDays < 4) {
    return { key: "3d", label: "em 3 dias", emoji: "📅" };
  }
  // 7 days before (7 to less than 8 days)
  if (diffDays >= 7 && diffDays < 8) {
    return { key: "7d", label: "em 7 dias", emoji: "✈️" };
  }

  return null;
}

/**
 * Check all tenants for upcoming departures and create notifications.
 */
export async function checkUpcomingDepartures(): Promise<{ notificationsCreated: number }> {
  const db = await getDb();
  if (!db) return { notificationsCreated: 0 };

  const now = new Date();
  let notificationsCreated = 0;

  try {
    // Find all deals with status "won", boardingDate within the next 8 days, not deleted
    const result = await db.execute(sql`
      SELECT
        d.id,
        d."tenantId",
        d.title,
        d."boardingDate",
        d."returnDate",
        d."ownerUserId",
        d."contactId",
        c.name AS "contactName",
        u.name AS "ownerName"
      FROM deals d
      LEFT JOIN crm_contacts c ON c.id = d."contactId" AND c."tenantId" = d."tenantId"
      LEFT JOIN crm_users u ON u.id = d."ownerUserId" AND u."tenantId" = d."tenantId"
      WHERE d.status = 'won'
        AND d."boardingDate" IS NOT NULL
        AND d."boardingDate" >= CURRENT_DATE
        AND d."boardingDate" <= CURRENT_DATE + INTERVAL '8 days'
        AND d."deletedAt" IS NULL
    `);

    const deals = result as unknown as any[];

    for (const deal of deals) {
      const boardingDate = new Date(deal.boardingDate);
      const window = getDepartureWindow(boardingDate, now);
      if (!window) continue;

      const trackingKey = `${deal.id}:${window.key}`;
      if (notifiedDepartures.has(trackingKey)) continue;

      const boardingDateStr = boardingDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "America/Sao_Paulo",
      });

      const contactInfo = deal.contactName ? ` — ${deal.contactName}` : "";
      const ownerInfo = deal.ownerName ? ` (Resp: ${deal.ownerName})` : "";

      await createNotification(deal.tenantId, {
        type: "departure_soon",
        title: `${window.emoji} Embarque ${window.label}: ${deal.title}${contactInfo}`,
        body: `A viagem "${deal.title}"${contactInfo} embarca ${window.label} (${boardingDateStr}).${ownerInfo} Verifique se está tudo preparado!`,
        entityType: "deal",
        entityId: String(deal.id),
      });

      notifiedDepartures.add(trackingKey);
      notificationsCreated++;
    }

    // Clean up old entries from the tracking set (keep it manageable)
    if (notifiedDepartures.size > 5000) {
      const activeDealIds = new Set(deals.map((d: any) => d.id));
      Array.from(notifiedDepartures).forEach(key => {
        const dealId = parseInt(key.split(":")[0]);
        if (!activeDealIds.has(dealId)) {
          notifiedDepartures.delete(key);
        }
      });
    }
  } catch (err) {
    console.error("[DepartureScheduler] Error:", err);
  }

  return { notificationsCreated };
}

/**
 * Start the departure notification scheduler.
 * Checks every hour for upcoming departures.
 */
export function startDepartureScheduler() {
  async function tick() {
    try {
      const result = await checkUpcomingDepartures();
      if (result.notificationsCreated > 0) {
        console.log(`[DepartureScheduler] Created ${result.notificationsCreated} departure notifications`);
      }
    } catch (err) {
      console.error("[DepartureScheduler] Tick error:", err);
    }
  }

  // Run once after startup delay (2 minutes)
  setTimeout(tick, 120_000);
  // Then every hour
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log("[DepartureScheduler] Started — checking every 1h for departures within 7 days");
}

// Export for testing
export { getDepartureWindow, notifiedDepartures };
