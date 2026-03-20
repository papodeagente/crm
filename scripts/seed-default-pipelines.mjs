/**
 * Seed default pipelines for existing tenants that don't have them.
 * Run: node scripts/seed-default-pipelines.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// We'll use the tRPC caller approach via a direct HTTP call to the running server
const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

async function main() {
  console.log("Seeding default pipelines for tenants without pipelines...");
  
  // Call the seedDefaultPipelines endpoint for each tenant
  // The endpoint already handles checking if pipelines exist
  const tenantIds = [1, 2, 3]; // Known tenant IDs
  
  for (const tenantId of tenantIds) {
    try {
      console.log(`\nProcessing tenant ${tenantId}...`);
      const resp = await fetch(`${BASE_URL}/api/trpc/crm.classification.seedDefaultPipelines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: { tenantId }
        }),
      });
      
      if (resp.ok) {
        const data = await resp.json();
        console.log(`  Tenant ${tenantId}: ${JSON.stringify(data?.result?.data?.json || "done")}`);
      } else {
        const text = await resp.text();
        console.log(`  Tenant ${tenantId}: HTTP ${resp.status} - ${text.substring(0, 200)}`);
      }
    } catch (err) {
      console.log(`  Tenant ${tenantId}: Error - ${err.message}`);
    }
  }
  
  console.log("\nDone!");
}

main().catch(console.error);
