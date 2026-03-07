/**
 * RFV Filter Notifications — Detects new contacts entering smart filters
 * and creates notifications using the existing notification system.
 *
 * Flow:
 * 1. Get current smart filter counts for each tenant
 * 2. Compare with stored snapshots (rfv_filter_snapshots)
 * 3. If count increased → create notification
 * 4. Update snapshots with current counts
 */

import { getDb } from "./db";
import { rfvFilterSnapshots, tenants } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSmartFilterCounts, SMART_FILTERS, SMART_FILTER_CONFIG, type SmartFilter } from "./rfv";
import { createNotification } from "./db";

// ─── Types ───

interface FilterChange {
  filterKey: SmartFilter;
  previousCount: number;
  currentCount: number;
  newContacts: number;
}

// ─── Core Logic ───

/**
 * Check a single tenant for new contacts in smart filters.
 * Returns an array of filter changes (only those with increases).
 */
export async function checkTenantRfvFilters(tenantId: number): Promise<FilterChange[]> {
  const db = await getDb();
  if (!db) return [];

  // 1. Get current counts
  const currentCounts = await getSmartFilterCounts(tenantId);

  // 2. Get stored snapshots
  const snapResult = await db.execute(sql`
    SELECT filterKey, currentCount
    FROM rfv_filter_snapshots
    WHERE tenantId = ${tenantId}
  `);
  const snapRows = (snapResult as unknown as any[][])[0] || [];
  const snapshots = new Map<string, number>();
  for (const row of snapRows) {
    snapshots.set(String(row.filterKey), Number(row.currentCount));
  }

  // 3. Compare and detect increases
  const changes: FilterChange[] = [];

  for (const filterKey of SMART_FILTERS) {
    const current = currentCounts[filterKey] || 0;
    const previous = snapshots.get(filterKey) ?? 0;

    if (current > previous) {
      changes.push({
        filterKey,
        previousCount: previous,
        currentCount: current,
        newContacts: current - previous,
      });
    }

    // 4. Upsert snapshot
    if (snapshots.has(filterKey)) {
      await db.execute(sql`
        UPDATE rfv_filter_snapshots
        SET previousCount = currentCount,
            currentCount = ${current},
            lastCheckedAt = NOW()
        WHERE tenantId = ${tenantId} AND filterKey = ${filterKey}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO rfv_filter_snapshots (tenantId, filterKey, previousCount, currentCount, lastCheckedAt)
        VALUES (${tenantId}, ${filterKey}, 0, ${current}, NOW())
      `);
    }
  }

  return changes;
}

/**
 * Create notifications for filter changes.
 */
export async function createRfvNotifications(tenantId: number, changes: FilterChange[]): Promise<number> {
  let created = 0;

  for (const change of changes) {
    const config = SMART_FILTER_CONFIG[change.filterKey];
    const plural = change.newContacts > 1 ? "novos contatos" : "novo contato";

    await createNotification(tenantId, {
      type: "rfv_filter_alert",
      title: `${change.newContacts} ${plural} em "${config.label}"`,
      body: `O filtro "${config.label}" passou de ${change.previousCount} para ${change.currentCount} contatos. ${config.description}.`,
      entityType: "rfv_filter",
      entityId: change.filterKey,
    });

    created++;
  }

  return created;
}

/**
 * Run the full check for a single tenant: detect changes + create notifications.
 */
export async function runRfvNotificationCheck(tenantId: number): Promise<{
  changes: FilterChange[];
  notificationsCreated: number;
}> {
  const changes = await checkTenantRfvFilters(tenantId);
  let notificationsCreated = 0;

  if (changes.length > 0) {
    notificationsCreated = await createRfvNotifications(tenantId, changes);
  }

  return { changes, notificationsCreated };
}

/**
 * Run the check for ALL active tenants.
 * This is the function called by the periodic job.
 */
export async function runRfvNotificationCheckForAllTenants(): Promise<{
  tenantsChecked: number;
  totalNotifications: number;
  details: Array<{ tenantId: number; changes: FilterChange[]; notificationsCreated: number }>;
}> {
  const db = await getDb();
  if (!db) return { tenantsChecked: 0, totalNotifications: 0, details: [] };

  // Get all active tenants
  const tenantResult = await db.execute(sql`
    SELECT id FROM tenants WHERE status = 'active'
  `);
  const tenantRows = (tenantResult as unknown as any[][])[0] || [];
  const tenantIds = tenantRows.map((r: any) => Number(r.id));

  const details: Array<{ tenantId: number; changes: FilterChange[]; notificationsCreated: number }> = [];
  let totalNotifications = 0;

  for (const tenantId of tenantIds) {
    try {
      const result = await runRfvNotificationCheck(tenantId);
      details.push({ tenantId, ...result });
      totalNotifications += result.notificationsCreated;
    } catch (err) {
      console.error(`[RFV Notifications] Error checking tenant ${tenantId}:`, err);
    }
  }

  return {
    tenantsChecked: tenantIds.length,
    totalNotifications,
    details,
  };
}

/**
 * Get the current snapshot state for a tenant (for display purposes).
 */
export async function getRfvFilterSnapshots(tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT filterKey, previousCount, currentCount, lastCheckedAt
    FROM rfv_filter_snapshots
    WHERE tenantId = ${tenantId}
    ORDER BY filterKey
  `);
  const rows = (result as unknown as any[][])[0] || [];

  return rows.map((r: any) => ({
    filterKey: String(r.filterKey) as SmartFilter,
    previousCount: Number(r.previousCount),
    currentCount: Number(r.currentCount),
    lastCheckedAt: new Date(r.lastCheckedAt).getTime(),
  }));
}
