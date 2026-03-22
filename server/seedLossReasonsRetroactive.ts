/**
 * Retroactive seed: runs once on server startup to ensure all existing tenants
 * have the default loss reasons. Idempotent — safe to run multiple times.
 */
import { getDb } from "./db";
import { tenants } from "../drizzle/schema";
import { seedDefaultLossReasons } from "./seedLossReasons";

export async function seedLossReasonsForAllTenants(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const allTenants = await db.select({ id: tenants.id }).from(tenants);

    let totalInserted = 0;
    for (const t of allTenants) {
      const inserted = await seedDefaultLossReasons(t.id);
      totalInserted += inserted;
    }

    console.log(
      `[SeedLossReasons] Retroactive seed complete: ${allTenants.length} tenants checked, ${totalInserted} total reasons inserted`
    );
  } catch (e) {
    console.error("[SeedLossReasons] Retroactive seed error:", e);
  }
}
