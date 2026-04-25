/**
 * Proposal follow-up scheduler
 *
 * Runs hourly. For each tenant, finds proposals that:
 *  - status = "sent" (delivered to client, not yet accepted/rejected)
 *  - sentAt is older than tenant's whatsappFollowupDays setting (default 3 days)
 *  - whatsappFollowupAt is null (idempotency — only follow up once)
 *  - asaasPaymentStatus is not "RECEIVED"/"CONFIRMED"/"RECEIVED_IN_CASH"
 *
 * Sends a WhatsApp follow-up message and stamps whatsappFollowupAt.
 */
import { getDb } from "./db";
import { proposals, tenants } from "../drizzle/schema";
import { and, eq, isNull, lt, inArray } from "drizzle-orm";
import { sendProposalWhatsAppNotification } from "./services/proposalNotifications";

const PAID_STATUSES = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

export async function runProposalFollowupCheck(): Promise<{ tenantsChecked: number; followupsSent: number; followupsSkipped: number }> {
  const db = await getDb();
  if (!db) return { tenantsChecked: 0, followupsSent: 0, followupsSkipped: 0 };

  const allTenants = await db.select({ id: tenants.id, settingsJson: tenants.settingsJson }).from(tenants);
  let followupsSent = 0;
  let followupsSkipped = 0;

  for (const tenant of allTenants) {
    try {
      const settings = (tenant.settingsJson || {}) as any;
      const enabled = settings.whatsappAutoFollowup !== false; // default ON
      if (!enabled) continue;

      const days = typeof settings.whatsappFollowupDays === "number" ? settings.whatsappFollowupDays : 3;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const candidates = await db
        .select({ id: proposals.id, asaasPaymentStatus: proposals.asaasPaymentStatus })
        .from(proposals)
        .where(
          and(
            eq(proposals.tenantId, tenant.id),
            eq(proposals.status, "sent"),
            lt(proposals.sentAt, cutoff),
            isNull(proposals.whatsappFollowupAt),
          ),
        )
        .limit(50); // safety cap per tenant per tick

      for (const p of candidates) {
        if (p.asaasPaymentStatus && PAID_STATUSES.includes(p.asaasPaymentStatus)) {
          followupsSkipped++;
          continue;
        }

        const result = await sendProposalWhatsAppNotification(tenant.id, p.id, "followup");
        if (result.sent) {
          await db
            .update(proposals)
            .set({ whatsappFollowupAt: new Date() })
            .where(and(eq(proposals.id, p.id), eq(proposals.tenantId, tenant.id)));
          followupsSent++;
        } else {
          // Don't stamp — let it retry next tick (unless reason is permanent like "no contact")
          // But to avoid loops on perma-failures, stamp anyway after first attempt.
          await db
            .update(proposals)
            .set({ whatsappFollowupAt: new Date() })
            .where(and(eq(proposals.id, p.id), eq(proposals.tenantId, tenant.id)));
          followupsSkipped++;
        }
      }
    } catch (err) {
      console.error(`[ProposalFollowup] Error for tenant ${tenant.id}:`, err);
    }
  }

  return { tenantsChecked: allTenants.length, followupsSent, followupsSkipped };
}

export function startProposalFollowupScheduler() {
  const HOURLY_MS = 60 * 60 * 1000;

  async function tick() {
    try {
      const r = await runProposalFollowupCheck();
      if (r.followupsSent > 0 || r.followupsSkipped > 0) {
        console.log(`[ProposalFollowup] sent=${r.followupsSent} skipped=${r.followupsSkipped} tenants=${r.tenantsChecked}`);
      }
    } catch (err) {
      console.error("[ProposalFollowup] tick error:", err);
    }
  }

  setTimeout(tick, 90_000); // first run 90s after boot
  setInterval(tick, HOURLY_MS);
  console.log("[ProposalFollowup] Started — hourly check");
}
