/**
 * Z-API Alert Service
 * 
 * Monitors Z-API instances for:
 * 1. Disconnected WhatsApp sessions (instance active but WA disconnected)
 * 2. Billing overdue tenants with active Z-API instances (past_due, restricted, cancelled, expired)
 * 3. Instance errors (API unreachable, etc.)
 * 
 * Creates alerts in zapi_admin_alerts and notifies the owner for critical ones.
 */

import { getDb } from "../db";
import { zapiAdminAlerts, tenantZapiInstances, tenants, whatsappSessions } from "../../drizzle/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

const BILLING_OVERDUE_STATUSES = ["past_due", "restricted", "cancelled", "expired"];

export interface AlertCheckResult {
  disconnectedAlerts: number;
  billingAlerts: number;
  totalNew: number;
  autoResolved: number;
}

/**
 * Run a full check of all Z-API instances and generate alerts
 */
export async function runZapiAlertCheck(): Promise<AlertCheckResult> {
  const db = await getDb();
  if (!db) {
    console.warn("[ZapiAlerts] Database unavailable, skipping check");
    return { disconnectedAlerts: 0, billingAlerts: 0, totalNew: 0, autoResolved: 0 };
  }

  let disconnectedAlerts = 0;
  let billingAlerts = 0;
  let autoResolved = 0;

  // ─── 1. Check for disconnected WhatsApp sessions ───
  const activeInstances = await db
    .select({
      id: tenantZapiInstances.id,
      tenantId: tenantZapiInstances.tenantId,
      zapiInstanceId: tenantZapiInstances.zapiInstanceId,
      instanceName: tenantZapiInstances.instanceName,
      tenantName: tenants.name,
    })
    .from(tenantZapiInstances)
    .leftJoin(tenants, eq(tenantZapiInstances.tenantId, tenants.id))
    .where(eq(tenantZapiInstances.status, "active"));

  for (const inst of activeInstances) {
    // Check WhatsApp session status for this instance
    const [session] = await db
      .select({ status: whatsappSessions.status })
      .from(whatsappSessions)
      .where(
        and(
          eq(whatsappSessions.provider, "zapi"),
          eq(whatsappSessions.providerInstanceId, inst.zapiInstanceId)
        )
      )
      .limit(1);

    const isDisconnected = !session || session.status !== "connected";
    const alertKey = `disconnected:${inst.tenantId}:${inst.zapiInstanceId}`;

    if (isDisconnected) {
      // Create alert if not already exists (unresolved)
      const [existing] = await db
        .select({ id: zapiAdminAlerts.id })
        .from(zapiAdminAlerts)
        .where(
          and(
            eq(zapiAdminAlerts.alertKey, alertKey),
            eq(zapiAdminAlerts.resolved, false)
          )
        )
        .limit(1);

      if (!existing) {
        await db.insert(zapiAdminAlerts).values({
          tenantId: inst.tenantId,
          tenantName: inst.tenantName || `Tenant ${inst.tenantId}`,
          type: "disconnected",
          severity: "critical",
          message: `WhatsApp desconectado para "${inst.tenantName || inst.tenantId}" (instância ${inst.instanceName})`,
          metadata: JSON.stringify({
            zapiInstanceId: inst.zapiInstanceId,
            instanceName: inst.instanceName,
            sessionStatus: session?.status || "no_session",
          }),
          alertKey,
          ownerNotified: false,
        });
        disconnectedAlerts++;
      }
    } else {
      // Auto-resolve if previously disconnected but now connected
      const [existingAlert] = await db
        .select({ id: zapiAdminAlerts.id })
        .from(zapiAdminAlerts)
        .where(
          and(
            eq(zapiAdminAlerts.alertKey, alertKey),
            eq(zapiAdminAlerts.resolved, false)
          )
        )
        .limit(1);

      if (existingAlert) {
        await db
          .update(zapiAdminAlerts)
          .set({
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy: "auto",
          })
          .where(eq(zapiAdminAlerts.id, existingAlert.id));
        autoResolved++;
      }
    }
  }

  // ─── 2. Check for billing overdue tenants with active Z-API ───
  const activeTenantIds = activeInstances.map((i) => i.tenantId);

  if (activeTenantIds.length > 0) {
    const overdueTenantsWithZapi = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        billingStatus: tenants.billingStatus,
        plan: tenants.plan,
      })
      .from(tenants)
      .where(
        and(
          sql`${tenants.id} IN (${sql.join(activeTenantIds.map(id => sql`${id}`), sql`, `)})`,
          sql`${tenants.billingStatus} IN (${sql.join(BILLING_OVERDUE_STATUSES.map(s => sql`${s}`), sql`, `)})`
        )
      );

    for (const tenant of overdueTenantsWithZapi) {
      const alertKey = `billing_overdue:${tenant.id}`;

      const [existing] = await db
        .select({ id: zapiAdminAlerts.id })
        .from(zapiAdminAlerts)
        .where(
          and(
            eq(zapiAdminAlerts.alertKey, alertKey),
            eq(zapiAdminAlerts.resolved, false)
          )
        )
        .limit(1);

      if (!existing) {
        const severity = tenant.billingStatus === "cancelled" || tenant.billingStatus === "expired"
          ? "critical"
          : "warning";

        await db.insert(zapiAdminAlerts).values({
          tenantId: tenant.id,
          tenantName: tenant.name,
          type: "billing_overdue",
          severity,
          message: `Tenant "${tenant.name}" está ${tenant.billingStatus} mas possui instância Z-API ativa (plano: ${tenant.plan})`,
          metadata: JSON.stringify({
            billingStatus: tenant.billingStatus,
            plan: tenant.plan,
          }),
          alertKey,
          ownerNotified: false,
        });
        billingAlerts++;
      }
    }

    // Auto-resolve billing alerts for tenants that are now in good standing
    const goodStandingTenantIds = activeInstances
      .filter((inst) => {
        const overdueIds = overdueTenantsWithZapi.map((t) => t.id);
        return !overdueIds.includes(inst.tenantId);
      })
      .map((inst) => inst.tenantId);

    if (goodStandingTenantIds.length > 0) {
      const billingAlertsToResolve = await db
        .select({ id: zapiAdminAlerts.id })
        .from(zapiAdminAlerts)
        .where(
          and(
            eq(zapiAdminAlerts.type, "billing_overdue"),
            eq(zapiAdminAlerts.resolved, false),
            sql`${zapiAdminAlerts.tenantId} IN (${sql.join(goodStandingTenantIds.map(id => sql`${id}`), sql`, `)})`
          )
        );

      for (const alert of billingAlertsToResolve) {
        await db
          .update(zapiAdminAlerts)
          .set({
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy: "auto",
          })
          .where(eq(zapiAdminAlerts.id, alert.id));
        autoResolved++;
      }
    }
  }

  // ─── 3. Notify owner for new critical alerts ───
  const totalNew = disconnectedAlerts + billingAlerts;
  if (totalNew > 0) {
    const unnotifiedAlerts = await db
      .select({
        id: zapiAdminAlerts.id,
        type: zapiAdminAlerts.type,
        severity: zapiAdminAlerts.severity,
        message: zapiAdminAlerts.message,
        tenantName: zapiAdminAlerts.tenantName,
      })
      .from(zapiAdminAlerts)
      .where(
        and(
          eq(zapiAdminAlerts.ownerNotified, false),
          eq(zapiAdminAlerts.resolved, false),
          eq(zapiAdminAlerts.severity, "critical")
        )
      );

    if (unnotifiedAlerts.length > 0) {
      const alertSummary = unnotifiedAlerts
        .map((a) => `- [${a.type === "disconnected" ? "DESCONECTADO" : "INADIMPLENTE"}] ${a.message}`)
        .join("\n");

      try {
        await notifyOwner({
          title: `⚠️ ${unnotifiedAlerts.length} alerta(s) Z-API crítico(s)`,
          content: `Foram detectados ${unnotifiedAlerts.length} alertas críticos no monitoramento Z-API:\n\n${alertSummary}\n\nAcesse o painel Super Admin > Z-API para mais detalhes.`,
        });

        // Mark as notified
        const alertIds = unnotifiedAlerts.map((a) => a.id);
        if (alertIds.length > 0) {
          await db
            .update(zapiAdminAlerts)
            .set({ ownerNotified: true })
            .where(sql`${zapiAdminAlerts.id} IN (${sql.join(alertIds.map(id => sql`${id}`), sql`, `)})`);
        }
      } catch (err) {
        console.warn("[ZapiAlerts] Failed to notify owner:", err);
      }
    }
  }

  return { disconnectedAlerts, billingAlerts, totalNew, autoResolved };
}

/**
 * Resolve an alert manually (by super admin)
 */
export async function resolveAlert(alertId: number, resolvedBy: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(zapiAdminAlerts)
    .set({
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy,
    })
    .where(eq(zapiAdminAlerts.id, alertId));

  return true;
}

/**
 * Resolve all alerts for a tenant
 */
export async function resolveAllAlertsForTenant(tenantId: number, resolvedBy: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .update(zapiAdminAlerts)
    .set({
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy,
    })
    .where(
      and(
        eq(zapiAdminAlerts.tenantId, tenantId),
        eq(zapiAdminAlerts.resolved, false)
      )
    );

  return (result as any)?.[0]?.affectedRows || 0;
}

/**
 * Get alert counts by type and severity
 */
export async function getAlertCounts(): Promise<{
  total: number;
  critical: number;
  warning: number;
  disconnected: number;
  billingOverdue: number;
}> {
  const db = await getDb();
  if (!db) return { total: 0, critical: 0, warning: 0, disconnected: 0, billingOverdue: 0 };

  const [counts] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      critical: sql<number>`SUM(CASE WHEN ${zapiAdminAlerts.severity} = 'critical' THEN 1 ELSE 0 END)`,
      warning: sql<number>`SUM(CASE WHEN ${zapiAdminAlerts.severity} = 'warning' THEN 1 ELSE 0 END)`,
      disconnected: sql<number>`SUM(CASE WHEN ${zapiAdminAlerts.type} = 'disconnected' THEN 1 ELSE 0 END)`,
      billingOverdue: sql<number>`SUM(CASE WHEN ${zapiAdminAlerts.type} = 'billing_overdue' THEN 1 ELSE 0 END)`,
    })
    .from(zapiAdminAlerts)
    .where(eq(zapiAdminAlerts.resolved, false));

  return {
    total: Number(counts?.total || 0),
    critical: Number(counts?.critical || 0),
    warning: Number(counts?.warning || 0),
    disconnected: Number(counts?.disconnected || 0),
    billingOverdue: Number(counts?.billingOverdue || 0),
  };
}
