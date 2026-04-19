/**
 * Trash Auto-Purge Scheduler
 *
 * Automatically hard-deletes items that have been in the trash (soft-deleted)
 * for more than 30 days. Runs once per day.
 *
 * Covers: deals, contacts
 */
import { getDb } from "./db";
import { sql } from "drizzle-orm";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // Run once per day
const PURGE_AFTER_DAYS = 30;

/**
 * Purge all soft-deleted items older than PURGE_AFTER_DAYS from the trash.
 * Returns the count of purged deals and contacts.
 */
export async function purgeExpiredTrashItems(): Promise<{
  purgedDeals: number;
  purgedContacts: number;
}> {
  const db = await getDb();
  if (!db) return { purgedDeals: 0, purgedContacts: 0 };

  let purgedDeals = 0;
  let purgedContacts = 0;

  try {
    // Hard-delete deals that have been in trash for more than 30 days
    const dealResult = await db.execute(sql`
      DELETE FROM deals
      WHERE "deletedAt" IS NOT NULL
        AND "deletedAt" < NOW() - INTERVAL '1 day' * ${PURGE_AFTER_DAYS}
    `);
    purgedDeals = (dealResult as any).rowCount || 0;

    // Hard-delete contacts that have been in trash for more than 30 days
    const contactResult = await db.execute(sql`
      DELETE FROM crm_contacts
      WHERE "deletedAt" IS NOT NULL
        AND "deletedAt" < NOW() - INTERVAL '1 day' * ${PURGE_AFTER_DAYS}
    `);
    purgedContacts = (contactResult as any).rowCount || 0;
  } catch (err) {
    console.error("[TrashAutoPurge] Error during purge:", err);
  }

  return { purgedDeals, purgedContacts };
}

/**
 * Start the trash auto-purge scheduler.
 * Runs once per day to clean up items older than 30 days in the trash.
 */
export function startTrashAutoPurgeScheduler() {
  async function tick() {
    try {
      const result = await purgeExpiredTrashItems();
      const total = result.purgedDeals + result.purgedContacts;
      if (total > 0) {
        console.log(
          `[TrashAutoPurge] Purged ${result.purgedDeals} deal(s) and ${result.purgedContacts} contact(s) older than ${PURGE_AFTER_DAYS} days`
        );
      }
    } catch (err) {
      console.error("[TrashAutoPurge] Tick error:", err);
    }
  }

  // Run once after startup delay (5 minutes)
  setTimeout(tick, 5 * 60 * 1000);
  // Then every 24 hours
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log(
    `[TrashAutoPurge] Started — auto-purging trash items older than ${PURGE_AFTER_DAYS} days (daily check)`
  );
}

// Export constant for testing
export { PURGE_AFTER_DAYS };
