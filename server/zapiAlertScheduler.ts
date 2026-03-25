/**
 * Z-API Alert Scheduler
 * 
 * Runs every 30 minutes to check for:
 * - Disconnected Z-API WhatsApp sessions
 * - Billing overdue tenants with active Z-API instances
 * 
 * Notifies the owner for critical alerts.
 */

import { runZapiAlertCheck } from "./services/zapiAlertService";

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function startZapiAlertScheduler() {
  const run = async () => {
    try {
      const result = await runZapiAlertCheck();
      if (result.totalNew > 0 || result.autoResolved > 0) {
        console.log(
          `[ZapiAlerts] Check complete: ${result.disconnectedAlerts} disconnected, ${result.billingAlerts} billing, ${result.autoResolved} auto-resolved`
        );
      } else {
        console.log("[ZapiAlerts] Check complete: no new alerts");
      }
    } catch (err) {
      console.error("[ZapiAlerts] Scheduler error:", err);
    }
  };

  // Run first check after 3 minutes (let server warm up)
  setTimeout(run, 3 * 60 * 1000);

  // Then run every 30 minutes
  setInterval(run, INTERVAL_MS);

  console.log("[ZapiAlerts] Scheduler started (every 30 min)");
}
