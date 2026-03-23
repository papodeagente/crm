/**
 * One-time migration script: Seed default UTM mappings for all existing tenants.
 * Safe to run multiple times (idempotent).
 * 
 * Usage: node server/scripts/seedUtmAllTenants.mjs
 */

import { seedUtmMappingsForAllTenants } from "../services/seedDefaultUtmMappings.ts";

async function main() {
  console.log("[UTM Migration] Starting global UTM provisioning...");
  const result = await seedUtmMappingsForAllTenants();
  console.log("[UTM Migration] Complete!");
  console.log(`  Total tenants: ${result.totalTenants}`);
  console.log(`  Tenants provisioned: ${result.tenantsProvisioned}`);
  console.log(`  Tenants already complete: ${result.tenantsSkipped}`);
  console.log(`  Total mappings created: ${result.totalCreated}`);
  console.log(`  Total mappings skipped: ${result.totalSkipped}`);
  
  if (result.details.length > 0) {
    console.log("\n  Details per tenant:");
    for (const d of result.details) {
      if (d.created > 0) {
        console.log(`    Tenant ${d.tenantId}: +${d.created} created, ${d.skipped} skipped`);
      }
    }
  }
  
  process.exit(0);
}

main().catch((err) => {
  console.error("[UTM Migration] Fatal error:", err);
  process.exit(1);
});
