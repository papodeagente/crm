/**
 * Appointment Reminder Scheduler
 *
 * Sends WhatsApp reminders for upcoming appointments:
 * - 24h before: reminder with service details
 * - 2h before: confirmation request
 *
 * Replaces the old departureScheduler (travel-specific).
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";

const REMINDER_WINDOWS = [
  { label: "24h", hoursBeforeStart: 24, message: "reminder_24h" },
  { label: "2h", hoursBeforeStart: 2, message: "reminder_2h" },
];

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

async function sendAppointmentReminders() {
  const db = await getDb();
  if (!db) return;

  try {
    for (const window of REMINDER_WINDOWS) {
      const now = new Date();
      const targetStart = new Date(now.getTime() + window.hoursBeforeStart * 60 * 60 * 1000);
      const targetEnd = new Date(targetStart.getTime() + CHECK_INTERVAL_MS);

      // Find appointments in this reminder window that haven't been reminded yet
      const appointments = await db.execute(sql`
        SELECT
          a.id, a."tenantId", a.title, a."serviceType", a."startAt", a."endAt",
          a.location, a."contactPhone", a."contactId", a."professionalId",
          a."reminderSentAt", a.status,
          c.name as "contactName", c.phone as "contactPhoneFromContact"
        FROM crm_appointments a
        LEFT JOIN contacts c ON c.id = a."contactId" AND c."tenantId" = a."tenantId"
        WHERE a."startAt" >= ${targetStart}
          AND a."startAt" < ${targetEnd}
          AND a.status IN ('scheduled', 'confirmed')
          AND a."deletedAt" IS NULL
          AND (a."reminderSentAt" IS NULL OR a."reminderSentAt" < ${new Date(now.getTime() - 12 * 60 * 60 * 1000)})
      `);

      for (const appt of appointments.rows as any[]) {
        const phone = appt.contactPhone || appt.contactPhoneFromContact;
        if (!phone) continue;

        const startTime = new Date(appt.startAt);
        const timeStr = startTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const dateStr = startTime.toLocaleDateString("pt-BR");
        const service = appt.serviceType || appt.title;
        const name = appt.contactName || "cliente";
        const loc = appt.location ? ` em ${appt.location}` : "";

        let message = "";
        if (window.message === "reminder_24h") {
          message = `Ola ${name}! Lembramos que voce tem ${service} amanha (${dateStr}) as ${timeStr}${loc}. Nos vemos la! 😊`;
        } else {
          message = `${name}, seu ${service} e em 2 horas (${timeStr})${loc}. Confirma presenca? Responda SIM ou NAO.`;
        }

        // Mark as reminded
        await db.execute(sql`
          UPDATE crm_appointments SET "reminderSentAt" = NOW()
          WHERE id = ${appt.id}
        `);

        console.log(`[AppointmentReminder] ${window.label} reminder for appointment #${appt.id} to ${phone}`);

        // TODO: Send via WhatsApp integration
        // For now, log the message. WhatsApp send will be integrated
        // when whatsappManager.sendTextMessage is wired up per tenant session.
      }
    }
  } catch (err: any) {
    console.error("[AppointmentReminder] Error:", err.message);
  }
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startAppointmentReminderScheduler() {
  if (reminderInterval) return;
  console.log("[AppointmentReminder] Scheduler started (every 5 min)");
  sendAppointmentReminders();
  reminderInterval = setInterval(sendAppointmentReminders, CHECK_INTERVAL_MS);
}

export function stopAppointmentReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
