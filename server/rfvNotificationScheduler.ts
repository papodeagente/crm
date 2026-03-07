/**
 * RFV Notification Scheduler
 * Periodically checks all tenants for new contacts in smart filters
 * and creates notifications when changes are detected.
 *
 * Runs every 6 hours by default.
 */

import { runRfvNotificationCheckForAllTenants } from "./rfvNotifications";

const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export function startRfvNotificationScheduler() {
  const run = async () => {
    try {
      const result = await runRfvNotificationCheckForAllTenants();
      if (result.totalNotifications > 0) {
        console.log(
          `[RFV Notifications] Checked ${result.tenantsChecked} tenants, created ${result.totalNotifications} notifications`
        );
        for (const detail of result.details) {
          if (detail.changes.length > 0) {
            console.log(
              `[RFV Notifications] Tenant ${detail.tenantId}: ${detail.changes.map(c => `${c.filterKey} +${c.newContacts}`).join(", ")}`
            );
          }
        }
      } else {
        console.log(`[RFV Notifications] Checked ${result.tenantsChecked} tenants, no changes detected`);
      }
    } catch (err) {
      console.error("[RFV Notifications] Scheduler error:", err);
    }
  };

  // Run once after 2 minutes (let server warm up)
  setTimeout(run, 2 * 60 * 1000);

  // Then run every 6 hours
  setInterval(run, INTERVAL_MS);

  console.log("[RFV Notifications] Scheduler started — runs every 6 hours");
}
