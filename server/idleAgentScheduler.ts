/**
 * Idle Agent Scheduler
 * Returns conversations from inactive agents back to the queue.
 * Runs every 60 seconds. Only active for tenants with idleAgentTimeoutMinutes > 0.
 * Only affects agents in 'auto' or 'offline' availability — never times out agents
 * who manually set themselves to 'available'.
 * Safe: if this scheduler crashes, conversations stay with their agent (no loss).
 */
import { getDb } from "./db";
import {
  getTenantsWithIdleTimeout,
  getHelpdeskSettings,
  getIdleAgentConversations,
  enqueueConversation,
} from "./db";
import { emitToTenant } from "./socketSingleton";
import { conversationEvents } from "../drizzle/schema";

const CHECK_INTERVAL_MS = 60_000; // 60 seconds

export async function checkIdleAgents(): Promise<{ returned: number }> {
  let returned = 0;

  try {
    const tenantList = await getTenantsWithIdleTimeout();
    if (tenantList.length === 0) return { returned: 0 };

    const db = await getDb();
    if (!db) return { returned: 0 };

    for (const tenant of tenantList) {
      try {
        const settings = await getHelpdeskSettings(tenant.id);
        if (!settings.idleAgentTimeoutMinutes || settings.idleAgentTimeoutMinutes <= 0) continue;

        const idleConvs = await getIdleAgentConversations(tenant.id, settings.idleAgentTimeoutMinutes);
        if (idleConvs.length === 0) continue;

        for (const conv of idleConvs) {
          await enqueueConversation(tenant.id, conv.sessionId, conv.remoteJid);

          // Log idle timeout event
          try {
            await db.insert(conversationEvents).values({
              tenantId: tenant.id,
              waConversationId: conv.id,
              sessionId: conv.sessionId,
              remoteJid: conv.remoteJid,
              eventType: "queued",
              fromUserId: conv.assignedUserId || undefined,
              metadata: { reason: "idle_timeout", previousAgent: conv.assignedUserId },
            });
          } catch {}

          emitToTenant("conversationUpdated", {
            type: "enqueued",
            sessionId: conv.sessionId,
            remoteJid: conv.remoteJid,
            assignedUserId: null,
            tenantId: tenant.id,
            timestamp: Date.now(),
          });

          returned++;
        }

        if (returned > 0) {
          console.log(`[IdleAgent] Returned ${returned} conversations from idle agents for tenant ${tenant.id}`);
        }
      } catch (e: any) {
        console.error(`[IdleAgent] Error for tenant ${tenant.id}:`, e.message);
      }
    }
  } catch (e: any) {
    console.error("[IdleAgent] Top-level error:", e.message);
  }

  return { returned };
}

export function startIdleAgentScheduler() {
  async function tick() {
    try {
      const result = await checkIdleAgents();
      if (result.returned > 0) {
        console.log(`[IdleAgent] Total ${result.returned} conversations returned to queue`);
      }
    } catch (err: any) {
      console.error("[IdleAgent] Tick error:", err.message);
    }
  }

  setInterval(tick, CHECK_INTERVAL_MS);
  console.log("[IdleAgent] Started — checking every 60s for idle agents");
}
