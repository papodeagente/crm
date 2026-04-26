/**
 * SLA Enforcement Scheduler
 * Monitors conversations for SLA deadline breaches and takes action.
 * Runs every 30 seconds. Only active for tenants with SLA settings.
 * Also tracks first response times for assigned conversations.
 * Safe: if this scheduler crashes, SLA just isn't enforced (conversations continue normally).
 */
import { getDb } from "./db";
import {
  getTenantsWithSla,
  getHelpdeskSettings,
  getBreachedConversations,
  markSlaBreached,
  updateFirstResponseAt,
  enqueueConversation,
  assignConversation,
} from "./db";
import { emitToTenant } from "./socketSingleton";
import { sql } from "drizzle-orm";
import { conversationEvents } from "../drizzle/schema";

const CHECK_INTERVAL_MS = 30_000; // 30 seconds

export async function checkSlaBreaches(): Promise<{ breached: number; escalated: number }> {
  let breached = 0;
  let escalated = 0;

  try {
    const tenantList = await getTenantsWithSla();
    if (tenantList.length === 0) return { breached: 0, escalated: 0 };

    const db = await getDb();
    if (!db) return { breached: 0, escalated: 0 };

    for (const tenant of tenantList) {
      try {
        // First, update firstResponseAt for conversations that have been responded to
        await updateFirstResponseAt(tenant.id);

        const settings = await getHelpdeskSettings(tenant.id);
        const breachedConvs = await getBreachedConversations(tenant.id);
        if (breachedConvs.length === 0) continue;

        for (const conv of breachedConvs) {
          // Mark as breached
          await markSlaBreached(conv.id);

          const breachType = conv.firstResponseAt ? "resolution" : "first_response";

          // Log SLA breach event
          try {
            await db.insert(conversationEvents).values({
              tenantId: tenant.id,
              waConversationId: conv.id,
              sessionId: conv.sessionId,
              remoteJid: conv.remoteJid,
              eventType: "sla_breach",
              fromUserId: conv.assignedUserId || undefined,
              metadata: {
                breachType,
                deadline: conv.slaDeadlineAt,
                assignedUserId: conv.assignedUserId,
              },
            });
          } catch {}

          // Emit real-time event
          emitToTenant("slaBreached", {
            conversationId: conv.id,
            sessionId: conv.sessionId,
            remoteJid: conv.remoteJid,
            tenantId: tenant.id,
            breachType,
            assignedUserId: conv.assignedUserId,
            deadline: conv.slaDeadlineAt,
            timestamp: Date.now(),
          });

          breached++;

          // Take action based on settings
          if (settings.slaBreachAction === "reassign" && conv.assignedUserId) {
            await enqueueConversation(tenant.id, conv.sessionId, conv.remoteJid);
            emitToTenant("conversationUpdated", {
              type: "enqueued",
              sessionId: conv.sessionId,
              remoteJid: conv.remoteJid,
              assignedUserId: null,
              tenantId: tenant.id,
              timestamp: Date.now(),
            });
            escalated++;
          } else if (settings.slaBreachAction === "escalate" && conv.assignedUserId) {
            // Find first admin for this tenant
            const adminResult = await db.execute(sql`
              SELECT id FROM crm_users
              WHERE "tenantId" = ${tenant.id} AND role = 'admin' AND status = 'active'
              LIMIT 1
            `);
            const adminRows = (adminResult as any).rows || (adminResult as any) || [];
            if (adminRows[0]?.id) {
              const adminId = Number(adminRows[0].id);
              await assignConversation(tenant.id, conv.sessionId, conv.remoteJid, adminId);
              emitToTenant("conversationUpdated", {
                type: "assignment",
                sessionId: conv.sessionId,
                remoteJid: conv.remoteJid,
                assignedUserId: adminId,
                tenantId: tenant.id,
                timestamp: Date.now(),
              });
              escalated++;
            }
          }
          // 'notify' action = event emitted above, no reassignment
        }
      } catch (e: any) {
        console.error(`[SLA] Error for tenant ${tenant.id}:`, e.message);
      }
    }
  } catch (e: any) {
    console.error("[SLA] Top-level error:", e.message);
  }

  return { breached, escalated };
}

export function startSlaEnforcementScheduler() {
  async function tick() {
    try {
      const result = await checkSlaBreaches();
      if (result.breached > 0) {
        console.log(`[SLA] ${result.breached} breach(es) detected, ${result.escalated} escalated`);
      }
    } catch (err: any) {
      console.error("[SLA] Tick error:", err.message);
    }
  }

  setInterval(tick, CHECK_INTERVAL_MS);
  console.log("[SLA] Started — checking every 30s for SLA breaches");
}
