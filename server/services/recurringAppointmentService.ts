/**
 * Recurring Appointment Service
 *
 * Generates future appointment instances based on recurrence rules.
 * Runs daily to create appointments up to 60 days ahead.
 *
 * Recurrence is stored as simple interval in days (e.g., 15 = every 15 days).
 * The recurrenceRule field stores the interval: "INTERVAL:15" (days).
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

const HORIZON_DAYS = 60;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // Once per day

function parseRecurrenceRule(rule: string): number | null {
  if (!rule) return null;
  const match = rule.match(/INTERVAL:(\d+)/);
  return match ? parseInt(match[1]) : null;
}

async function generateRecurringAppointments() {
  const db = await getDb();
  if (!db) return;

  try {
    // Find parent appointments with recurrence rules that are completed
    const parents = await db.execute(sql`
      SELECT id, "tenantId", "userId", title, description, location, color,
             "serviceType", "recurrenceRule", "contactId", "dealId",
             "professionalId", "contactPhone", price, "startAt", "endAt"
      FROM crm_appointments
      WHERE "recurrenceRule" IS NOT NULL
        AND "recurrenceRule" != ''
        AND "deletedAt" IS NULL
        AND status = 'completed'
    `);

    const now = new Date();
    const horizonEnd = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);

    for (const parent of parents.rows as any[]) {
      const intervalDays = parseRecurrenceRule(parent.recurrenceRule);
      if (!intervalDays || intervalDays < 1) continue;

      // Check if a future recurring appointment already exists
      const existing = await db.execute(sql`
        SELECT id FROM crm_appointments
        WHERE "recurrenceParentId" = ${parent.id}
          AND "startAt" > NOW()
          AND "deletedAt" IS NULL
        LIMIT 1
      `);

      if (existing.rows.length > 0) continue;

      // Calculate next appointment date
      const parentStart = new Date(parent.startAt);
      const parentEnd = new Date(parent.endAt);
      const durationMs = parentEnd.getTime() - parentStart.getTime();

      let nextStart = new Date(parentStart.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      // If next is in the past, fast-forward
      while (nextStart < now) {
        nextStart = new Date(nextStart.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      }

      if (nextStart > horizonEnd) continue;

      const nextEnd = new Date(nextStart.getTime() + durationMs);

      await db.execute(sql`
        INSERT INTO crm_appointments (
          "tenantId", "userId", title, description, location, color,
          "serviceType", "recurrenceRule", "recurrenceParentId",
          "contactId", "dealId", "professionalId", "contactPhone",
          price, "startAt", "endAt", status, "allDay", "isCompleted",
          "createdAt", "updatedAt"
        ) VALUES (
          ${parent.tenantId}, ${parent.userId}, ${parent.title}, ${parent.description},
          ${parent.location}, ${parent.color}, ${parent.serviceType},
          ${parent.recurrenceRule}, ${parent.id},
          ${parent.contactId}, ${parent.dealId}, ${parent.professionalId},
          ${parent.contactPhone}, ${parent.price},
          ${nextStart}, ${nextEnd}, 'scheduled', false, false,
          NOW(), NOW()
        )
      `);

      console.log(`[RecurringAppt] Created next appointment for parent #${parent.id} on ${nextStart.toISOString()}`);
    }
  } catch (err: any) {
    console.error("[RecurringAppt] Error:", err.message);
  }
}

let recurringInterval: ReturnType<typeof setInterval> | null = null;

export function startRecurringAppointmentScheduler() {
  if (recurringInterval) return;
  console.log("[RecurringAppt] Scheduler started (daily)");
  // Run after 30s delay on startup, then daily
  setTimeout(generateRecurringAppointments, 30_000);
  recurringInterval = setInterval(generateRecurringAppointments, CHECK_INTERVAL_MS);
}

export function stopRecurringAppointmentScheduler() {
  if (recurringInterval) {
    clearInterval(recurringInterval);
    recurringInterval = null;
  }
}
