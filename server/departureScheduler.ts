/**
 * Appointment Reminder Scheduler
 *
 * Creates notifications for upcoming appointments (deals with status "won" and appointmentDate set).
 * Notification windows:
 *   - 7 days before appointment
 *   - 3 days before appointment
 *   - 1 day before appointment
 *   - Day of appointment
 *
 * Runs every hour and uses an in-memory tracking set to avoid duplicate notifications.
 */
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { createNotification } from "./db";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every 1 hour

// Track which deal+window combos we've already notified about
// Format: "dealId:window" e.g. "123:7d", "123:3d", "123:1d", "123:today"
const notifiedAppointments = new Set<string>();

/**
 * Determine which notification window an appointment falls into.
 * Returns null if no notification should be sent.
 */
function getAppointmentWindow(appointmentDate: Date, now: Date): { key: string; label: string; emoji: string } | null {
  const diffMs = appointmentDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Day of appointment (0 to less than 1 day)
  if (diffDays >= 0 && diffDays < 1) {
    return { key: "today", label: "hoje", emoji: "📅" };
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
    return { key: "7d", label: "em 7 dias", emoji: "🗓️" };
  }

  return null;
}

/**
 * Check all tenants for upcoming appointments and create notifications.
 */
export async function checkUpcomingAppointments(): Promise<{ notificationsCreated: number }> {
  const db = await getDb();
  if (!db) return { notificationsCreated: 0 };

  const now = new Date();
  let notificationsCreated = 0;

  try {
    // Find all deals with status "won", appointmentDate within the next 8 days, not deleted
    const result = await db.execute(sql`
      SELECT
        d.id,
        d."tenantId",
        d.title,
        d."appointmentDate",
        d."followUpDate",
        d."ownerUserId",
        d."contactId",
        c.name AS "contactName",
        u.name AS "ownerName"
      FROM deals d
      LEFT JOIN crm_contacts c ON c.id = d."contactId" AND c."tenantId" = d."tenantId"
      LEFT JOIN crm_users u ON u.id = d."ownerUserId" AND u."tenantId" = d."tenantId"
      WHERE d.status = 'won'
        AND d."appointmentDate" IS NOT NULL
        AND d."appointmentDate" >= CURRENT_DATE
        AND d."appointmentDate" <= CURRENT_DATE + INTERVAL '8 days'
        AND d."deletedAt" IS NULL
    `);

    const deals = result as unknown as any[];

    for (const deal of deals) {
      const appointmentDate = new Date(deal.appointmentDate);
      const window = getAppointmentWindow(appointmentDate, now);
      if (!window) continue;

      const trackingKey = `${deal.id}:${window.key}`;
      if (notifiedAppointments.has(trackingKey)) continue;

      const appointmentDateStr = appointmentDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "America/Sao_Paulo",
      });

      const contactInfo = deal.contactName ? ` — ${deal.contactName}` : "";
      const ownerInfo = deal.ownerName ? ` (Resp: ${deal.ownerName})` : "";

      await createNotification(deal.tenantId, {
        type: "appointment_soon",
        title: `${window.emoji} Atendimento ${window.label}: ${deal.title}${contactInfo}`,
        body: `O atendimento "${deal.title}"${contactInfo} está agendado para ${window.label} (${appointmentDateStr}).${ownerInfo} Verifique se está tudo preparado!`,
        entityType: "deal",
        entityId: String(deal.id),
      });

      notifiedAppointments.add(trackingKey);
      notificationsCreated++;
    }

    // Clean up old entries from the tracking set (keep it manageable)
    if (notifiedAppointments.size > 5000) {
      const activeDealIds = new Set(deals.map((d: any) => d.id));
      Array.from(notifiedAppointments).forEach(key => {
        const dealId = parseInt(key.split(":")[0]);
        if (!activeDealIds.has(dealId)) {
          notifiedAppointments.delete(key);
        }
      });
    }
  } catch (err) {
    console.error("[AppointmentScheduler] Error:", err);
  }

  return { notificationsCreated };
}

// Backward-compatible aliases
export const checkUpcomingDepartures = checkUpcomingAppointments;
export const notifiedDepartures = notifiedAppointments;
export const getDepartureWindow = getAppointmentWindow;

/**
 * Start the appointment notification scheduler.
 * Checks every hour for upcoming appointments.
 */
export function startAppointmentScheduler() {
  async function tick() {
    try {
      const result = await checkUpcomingAppointments();
      if (result.notificationsCreated > 0) {
        console.log(`[AppointmentScheduler] Created ${result.notificationsCreated} appointment notifications`);
      }
    } catch (err) {
      console.error("[AppointmentScheduler] Tick error:", err);
    }
  }

  // Run once after startup delay (2 minutes)
  setTimeout(tick, 120_000);
  // Then every hour
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log("[AppointmentScheduler] Started — checking every 1h for appointments within 7 days");
}

// Backward-compatible alias
export const startDepartureScheduler = startAppointmentScheduler;
