/**
 * Helpdesk Auto-Distribution Scheduler
 * Distributes queued conversations to available agents using distribution rules.
 * Runs every 15 seconds. Only active for tenants with autoDistributionEnabled.
 * Safe: if this scheduler crashes, conversations stay in queue (manual claim still works).
 */
import { getDb } from "./db";
import {
  getTenantsWithAutoDistribution,
  getQueuedConversationsForDistribution,
  getNextRoundRobinAgent,
  assignConversation,
  getHelpdeskSettings,
  getDistributionRules,
} from "./db";
import { emitToTenant } from "./socketSingleton";
import { sql } from "drizzle-orm";
import { conversationEvents } from "../drizzle/schema";

const CHECK_INTERVAL_MS = 15_000; // 15 seconds

/**
 * Check business hours for a distribution rule config.
 * Returns true if currently within business hours or if not configured.
 */
function isWithinBusinessHours(configJson: any): boolean {
  if (!configJson?.businessHoursOnly) return true;

  const tz = configJson.businessHoursTimezone || "America/Sao_Paulo";
  const now = new Date();
  let localHour: number, localDay: number;

  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false });
    localHour = parseInt(fmt.format(now));
    const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" });
    const dayStr = dayFmt.format(now);
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    localDay = dayMap[dayStr] ?? now.getDay();
  } catch {
    return true; // If timezone is invalid, allow distribution
  }

  const startHour = parseInt(configJson.businessHoursStart?.split(":")[0] || "0");
  const endHour = parseInt(configJson.businessHoursEnd?.split(":")[0] || "24");
  const days = configJson.businessHoursDays
    ? (typeof configJson.businessHoursDays === "string"
        ? configJson.businessHoursDays.split(",").map(Number)
        : configJson.businessHoursDays)
    : [1, 2, 3, 4, 5]; // Default Mon-Fri

  if (!days.includes(localDay)) return false;
  if (localHour < startHour || localHour >= endHour) return false;
  return true;
}

export async function processQueueDistribution(): Promise<{ distributed: number }> {
  let distributed = 0;

  try {
    const tenantList = await getTenantsWithAutoDistribution();
    if (tenantList.length === 0) return { distributed: 0 };

    const db = await getDb();
    if (!db) return { distributed: 0 };

    for (const tenant of tenantList) {
      try {
        // Check if any active distribution rule allows auto-distribute
        const rules = await getDistributionRules(tenant.id);
        const activeRules = rules.filter((r: any) => r.isActive && r.strategy !== "manual");
        if (activeRules.length === 0) continue;

        // Check business hours on the first active rule
        const firstRule = activeRules[0];
        if (!isWithinBusinessHours(firstRule.configJson)) continue;

        // Get queued conversations (FIFO)
        const queued = await getQueuedConversationsForDistribution(tenant.id, 20);
        if (queued.length === 0) continue;

        for (const conv of queued) {
          const agentId = await getNextRoundRobinAgent(tenant.id);
          if (!agentId) break; // No available agents — stop for this tenant

          await assignConversation(tenant.id, conv.sessionId, conv.remoteJid, agentId);

          // Log auto-distribution event
          try {
            await db.insert(conversationEvents).values({
              tenantId: tenant.id,
              waConversationId: conv.id,
              sessionId: conv.sessionId,
              remoteJid: conv.remoteJid,
              eventType: "assigned",
              toUserId: agentId,
              metadata: { autoDistributed: true },
            });
          } catch {}

          emitToTenant("conversationUpdated", {
            type: "assignment",
            sessionId: conv.sessionId,
            remoteJid: conv.remoteJid,
            assignedUserId: agentId,
            tenantId: tenant.id,
            timestamp: Date.now(),
          });

          distributed++;
        }
      } catch (e: any) {
        console.error(`[HelpdeskDistribution] Error for tenant ${tenant.id}:`, e.message);
      }
    }
  } catch (e: any) {
    console.error("[HelpdeskDistribution] Top-level error:", e.message);
  }

  return { distributed };
}

export function startHelpdeskDistributionScheduler() {
  async function tick() {
    try {
      const result = await processQueueDistribution();
      if (result.distributed > 0) {
        console.log(`[HelpdeskDistribution] Auto-distributed ${result.distributed} conversations`);
      }
    } catch (err: any) {
      console.error("[HelpdeskDistribution] Tick error:", err.message);
    }
  }

  // Don't run immediately — let startup complete first
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log("[HelpdeskDistribution] Started — checking every 15s for queued conversations");
}
