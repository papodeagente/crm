/**
 * Appointment Reminder & Follow-up Scheduler
 *
 * Pre-appointment:
 * - 24h before: reminder with service details
 * - 2h before: confirmation request
 *
 * Post-appointment:
 * - 2h after completed: thank-you follow-up
 * - 1h after no-show: re-schedule invitation
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { getActiveSessionForTenant } from "./bulkMessage";
import { whatsappManager } from "./whatsappEvolution";

const REMINDER_WINDOWS = [
  { label: "24h", hoursBeforeStart: 24, type: "reminder_24h", column: "reminder24hSentAt" },
  { label: "2h", hoursBeforeStart: 2, type: "reminder_2h", column: "reminder2hSentAt" },
];

const POST_WINDOWS = [
  { label: "follow-up", hoursAfterEnd: 2, type: "follow_up", column: "followUpSentAt", statusFilter: "completed" },
  { label: "no-show", hoursAfterEnd: 1, type: "no_show", column: "noShowFollowUpSentAt", statusFilter: "no_show" },
];

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const TZ = "America/Sao_Paulo";

function formatTime(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: TZ });
}

function phoneToJid(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  if (withCountry.length < 12) return null;
  return `${withCountry}@s.whatsapp.net`;
}

async function sendViaWhatsApp(tenantId: number, phone: string, message: string): Promise<boolean> {
  const jid = phoneToJid(phone);
  if (!jid) return false;

  const session = await getActiveSessionForTenant(tenantId);
  if (!session || session.status !== "connected") {
    console.warn(`[AppointmentReminder] No active WhatsApp session for tenant ${tenantId}`);
    return false;
  }

  await whatsappManager.sendTextMessage(session.sessionId, jid, message);
  return true;
}

async function processPreAppointmentReminders() {
  const db = await getDb();
  if (!db) return;

  for (const window of REMINDER_WINDOWS) {
    const now = new Date();
    const targetStart = new Date(now.getTime() + window.hoursBeforeStart * 60 * 60 * 1000);
    const targetEnd = new Date(targetStart.getTime() + CHECK_INTERVAL_MS);

    const appointments = await db.execute(sql`
      SELECT
        a.id, a."tenantId", a.title, a."serviceType", a."startAt", a."endAt",
        a.location, a."contactPhone", a."contactId",
        c.name as "contactName", c.phone as "contactPhoneFromContact"
      FROM crm_appointments a
      LEFT JOIN contacts c ON c.id = a."contactId" AND c."tenantId" = a."tenantId"
      WHERE a."startAt" >= ${targetStart}
        AND a."startAt" < ${targetEnd}
        AND a.status IN ('scheduled', 'confirmed')
        AND a."deletedAt" IS NULL
        AND a.${sql.raw(`"${window.column}"`)} IS NULL
    `);

    for (const appt of (appointments as any).rows as any[]) {
      const phone = appt.contactPhone || appt.contactPhoneFromContact;
      if (!phone) continue;

      const startTime = new Date(appt.startAt);
      const timeStr = formatTime(startTime);
      const dateStr = formatDate(startTime);
      const service = appt.serviceType || appt.title;
      const name = appt.contactName || "cliente";
      const loc = appt.location ? ` em ${appt.location}` : "";

      let message = "";
      if (window.type === "reminder_24h") {
        message = `Ola ${name}! Lembramos que voce tem ${service} amanha (${dateStr}) as ${timeStr}${loc}. Nos vemos la! 😊`;
      } else {
        message = `${name}, seu ${service} e em 2 horas (${timeStr})${loc}. Confirma presenca? Responda SIM ou NAO.`;
      }

      try {
        const sent = await sendViaWhatsApp(appt.tenantId, phone, message);
        if (sent) {
          await db.execute(sql`
            UPDATE crm_appointments SET ${sql.raw(`"${window.column}"`)} = NOW() WHERE id = ${appt.id}
          `);
          console.log(`[AppointmentReminder] ${window.label} sent for appt #${appt.id}`);
        }
        // If not sent (no session), don't mark — will retry next cycle
      } catch (err: any) {
        console.error(`[AppointmentReminder] Failed ${window.label} for appt #${appt.id}:`, err.message);
      }
    }
  }
}

async function processPostAppointmentAutomations() {
  const db = await getDb();
  if (!db) return;

  for (const window of POST_WINDOWS) {
    const now = new Date();
    const windowEnd = new Date(now.getTime() - window.hoursAfterEnd * 60 * 60 * 1000);
    const windowStart = new Date(windowEnd.getTime() - CHECK_INTERVAL_MS);

    const appointments = await db.execute(sql`
      SELECT
        a.id, a."tenantId", a.title, a."serviceType", a."startAt", a."endAt",
        a.location, a."contactPhone", a."contactId",
        c.name as "contactName", c.phone as "contactPhoneFromContact"
      FROM crm_appointments a
      LEFT JOIN contacts c ON c.id = a."contactId" AND c."tenantId" = a."tenantId"
      WHERE a.status = ${window.statusFilter}
        AND a."deletedAt" IS NULL
        AND a.${sql.raw(`"${window.column}"`)} IS NULL
        AND a."endAt" >= ${windowStart}
        AND a."endAt" < ${windowEnd}
    `);

    for (const appt of (appointments as any).rows as any[]) {
      const phone = appt.contactPhone || appt.contactPhoneFromContact;
      if (!phone) continue;

      const service = appt.serviceType || appt.title;
      const name = appt.contactName || "cliente";

      let message = "";
      if (window.type === "follow_up") {
        message = `Ola ${name}! Obrigado pela visita. Como foi seu ${service}? Estamos disponiveis para qualquer duvida. Ate a proxima! 😊`;
      } else {
        message = `Ola ${name}, sentimos sua falta no ${service} de hoje. Gostaria de reagendar? Estamos a disposicao!`;
      }

      try {
        const sent = await sendViaWhatsApp(appt.tenantId, phone, message);
        if (sent) {
          await db.execute(sql`
            UPDATE crm_appointments SET ${sql.raw(`"${window.column}"`)} = NOW() WHERE id = ${appt.id}
          `);
          console.log(`[AppointmentReminder] ${window.label} sent for appt #${appt.id}`);
        }
      } catch (err: any) {
        console.error(`[AppointmentReminder] Failed ${window.label} for appt #${appt.id}:`, err.message);
      }
    }
  }
}

async function runScheduler() {
  try {
    await processPreAppointmentReminders();
    await processPostAppointmentAutomations();
  } catch (err: any) {
    console.error("[AppointmentReminder] Scheduler error:", err.message);
  }
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startAppointmentReminderScheduler() {
  if (reminderInterval) return;
  console.log("[AppointmentReminder] Scheduler started (every 5 min)");
  runScheduler();
  reminderInterval = setInterval(runScheduler, CHECK_INTERVAL_MS);
}

export function stopAppointmentReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
