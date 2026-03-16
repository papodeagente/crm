import { getDb } from "./db";
import { createNotification } from "./db";
import * as crm from "./crmDb";
import { sendBirthdayNotificationEmail, sendWeddingNotificationEmail, sendMonthlyBirthdayReport } from "./emailService";
import { tenants } from "../drizzle/schema";

/**
 * Check for today's birthdays and wedding anniversaries across all tenants.
 * Creates in-app notifications and sends email alerts.
 */
export async function runDailyBirthdayCheck(): Promise<{ tenantsChecked: number; birthdayNotifications: number; weddingNotifications: number }> {
  const db = await getDb();
  if (!db) return { tenantsChecked: 0, birthdayNotifications: 0, weddingNotifications: 0 };

  // Get all active tenants
  const allTenants = await db.select().from(tenants);
  let birthdayNotifications = 0;
  let weddingNotifications = 0;

  for (const tenant of allTenants) {
    try {
      // Check today's birthdays
      const birthdayContacts = await crm.getContactsWithDateToday(tenant.id, "birthDate");
      for (const contact of birthdayContacts) {
        await createNotification(tenant.id, {
          type: "birthday",
          title: `🎂 Aniversário: ${contact.name}`,
          body: `Hoje é aniversário de ${contact.name}! ${contact.phone ? `Telefone: ${contact.phone}` : ""}`,
          entityType: "contact",
          entityId: String(contact.id),
        });
        birthdayNotifications++;
      }

      // Check today's wedding anniversaries
      const weddingContacts = await crm.getContactsWithDateToday(tenant.id, "weddingDate");
      for (const contact of weddingContacts) {
        await createNotification(tenant.id, {
          type: "wedding_anniversary",
          title: `💍 Aniversário de casamento: ${contact.name}`,
          body: `Hoje é aniversário de casamento de ${contact.name}! ${contact.phone ? `Telefone: ${contact.phone}` : ""}`,
          entityType: "contact",
          entityId: String(contact.id),
        });
        weddingNotifications++;
      }

      // Send email alerts for upcoming dates (next 7 days) to tenant owner
      if (tenant.hotmartEmail) {
        const upcomingBirthdays = await crm.getContactsWithUpcomingDates(tenant.id, { daysAhead: 7, dateType: "birthDate" });
        if (upcomingBirthdays.length > 0) {
          await sendBirthdayNotificationEmail({
            to: tenant.hotmartEmail,
            contacts: upcomingBirthdays.map(c => ({ name: c.name, birthDate: c.birthDate || "", phone: c.phone })),
            daysAhead: 7,
          });
        }

        const upcomingWeddings = await crm.getContactsWithUpcomingDates(tenant.id, { daysAhead: 7, dateType: "weddingDate" });
        if (upcomingWeddings.length > 0) {
          await sendWeddingNotificationEmail({
            to: tenant.hotmartEmail,
            contacts: upcomingWeddings.map(c => ({ name: c.name, weddingDate: c.weddingDate || "", phone: c.phone })),
            daysAhead: 7,
          });
        }
      }
    } catch (err) {
      console.error(`[BirthdayScheduler] Error for tenant ${tenant.id}:`, err);
    }
  }

  return { tenantsChecked: allTenants.length, birthdayNotifications, weddingNotifications };
}

/**
 * Send monthly birthday/wedding report for all tenants
 */
export async function runMonthlyBirthdayReport(): Promise<{ emailsSent: number }> {
  const db = await getDb();
  if (!db) return { emailsSent: 0 };

  const allTenants = await db.select().from(tenants);
  let emailsSent = 0;

  const now = new Date();
  const nextMonth = now.getMonth() + 2; // 1-indexed, next month
  const year = nextMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();
  const month = nextMonth > 12 ? 1 : nextMonth;

  for (const tenant of allTenants) {
    try {
      if (!tenant.hotmartEmail) continue;

      const birthdayContacts = await crm.getContactsWithDateInMonth(tenant.id, month, "birthDate");
      const weddingContacts = await crm.getContactsWithDateInMonth(tenant.id, month, "weddingDate");

      if (birthdayContacts.length === 0 && weddingContacts.length === 0) continue;

      await sendMonthlyBirthdayReport({
        to: tenant.hotmartEmail,
        month,
        year,
        birthdayContacts: birthdayContacts.map(c => ({ name: c.name, birthDate: c.birthDate || "", phone: c.phone })),
        weddingContacts: weddingContacts.map(c => ({ name: c.name, weddingDate: c.weddingDate || "", phone: c.phone })),
      });
      emailsSent++;
    } catch (err) {
      console.error(`[BirthdayScheduler] Monthly report error for tenant ${tenant.id}:`, err);
    }
  }

  return { emailsSent };
}

/**
 * Start the birthday/wedding notification scheduler
 * - Daily check at startup + every 24h
 * - Monthly report on the 25th of each month (checked hourly)
 */
export function startBirthdayScheduler() {
  const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const HOURLY_CHECK_MS = 60 * 60 * 1000; // 1 hour

  let lastDailyRun: string | null = null;
  let lastMonthlyRun: string | null = null;

  async function dailyRun() {
    const today = new Date().toISOString().slice(0, 10);
    if (lastDailyRun === today) return; // Already ran today
    lastDailyRun = today;

    try {
      const result = await runDailyBirthdayCheck();
      if (result.birthdayNotifications > 0 || result.weddingNotifications > 0) {
        console.log(`[BirthdayScheduler] Daily check: ${result.birthdayNotifications} birthday + ${result.weddingNotifications} wedding notifications across ${result.tenantsChecked} tenants`);
      }
    } catch (err) {
      console.error("[BirthdayScheduler] Daily check error:", err);
    }
  }

  async function monthlyRun() {
    const now = new Date();
    const day = now.getDate();
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
    if (day !== 25 || lastMonthlyRun === monthKey) return;
    lastMonthlyRun = monthKey;

    try {
      const result = await runMonthlyBirthdayReport();
      console.log(`[BirthdayScheduler] Monthly report: ${result.emailsSent} emails sent`);
    } catch (err) {
      console.error("[BirthdayScheduler] Monthly report error:", err);
    }
  }

  async function tick() {
    await dailyRun();
    await monthlyRun();
  }

  // Run once on startup after a delay
  setTimeout(tick, 60_000);

  // Then check every hour
  setInterval(tick, HOURLY_CHECK_MS);

  console.log("[BirthdayScheduler] Started — daily birthday check + monthly report on 25th");
}
