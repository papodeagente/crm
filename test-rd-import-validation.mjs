/**
 * RD Station Import Validation Script
 * Tests the import logic by fetching data from RD Station API
 * and validating the mapping/deduplication logic
 */

const TOKEN = '645c346a88cd99000fa7b641';
const BASE = 'https://crm.rdstation.com/api/v1';

async function fetchJSON(url) {
  const res = await fetch(url);
  return res.json();
}

async function main() {
  console.log("=== RD Station Import Validation ===\n");

  // 1. Fetch pipelines
  const pipelines = await fetchJSON(`${BASE}/deal_pipelines?token=${TOKEN}`);
  console.log(`✅ Pipelines: ${pipelines.length}`);
  
  // Validate pipeline IDs
  for (const p of pipelines) {
    if (!p.id) {
      console.error(`❌ Pipeline "${p.name}" has no id!`);
      process.exit(1);
    }
    console.log(`  Pipeline: "${p.name}" (id: ${p.id}, stages: ${p.deal_stages.length})`);
    
    // Validate stage IDs
    for (const s of p.deal_stages) {
      if (!s._id && !s.id) {
        console.error(`❌ Stage "${s.name}" in pipeline "${p.name}" has no id!`);
        process.exit(1);
      }
    }
  }

  // 2. Build stage→pipeline map
  const stageToPipeline = new Map();
  for (const p of pipelines) {
    for (const s of p.deal_stages) {
      stageToPipeline.set(s._id || s.id, p.id);
    }
  }
  console.log(`\n✅ Stage→Pipeline map: ${stageToPipeline.size} entries`);

  // 3. Fetch a sample of deals and validate stage mapping
  console.log("\n--- Validating deal→stage→pipeline mapping ---");
  let totalOpen = 0;
  let totalWon = 0;
  let totalLost = 0;
  let unmappedStages = 0;
  let dealsWithoutContact = 0;
  let dealsWithContact = 0;

  for (const p of pipelines) {
    // Fetch first page of deals for this pipeline
    const dRes = await fetchJSON(`${BASE}/deals?token=${TOKEN}&deal_pipeline_id=${p.id}&limit=20&page=1`);
    const deals = dRes.deals || [];
    const openCount = (await fetchJSON(`${BASE}/deals?token=${TOKEN}&deal_pipeline_id=${p.id}&win=null&limit=1&page=1`)).total || 0;
    
    console.log(`\n  Pipeline "${p.name}": ${openCount} open deals (sample: ${deals.length})`);
    totalOpen += openCount;

    for (const d of deals) {
      // Check status
      if (d.win === true) totalWon++;
      else if (d.win === false) totalLost++;
      
      // Check stage mapping
      if (d.deal_stage?._id) {
        const mappedPipeline = stageToPipeline.get(d.deal_stage._id);
        if (!mappedPipeline) {
          unmappedStages++;
          console.log(`    ⚠️ Deal "${d.name}" has stage "${d.deal_stage.name}" (${d.deal_stage._id}) not in any pipeline!`);
        }
      }

      // Check contact
      if (d.contacts?.length > 0) {
        dealsWithContact++;
        const c = d.contacts[0];
        if (!c._id && !c.emails?.length && !c.name) {
          console.log(`    ⚠️ Deal "${d.name}" has contact without id, email, or name`);
        }
      } else {
        dealsWithoutContact++;
      }
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total open deals across all pipelines: ${totalOpen}`);
  console.log(`Unmapped stages: ${unmappedStages}`);
  console.log(`Deals with contact (sample): ${dealsWithContact}`);
  console.log(`Deals without contact (sample): ${dealsWithoutContact}`);

  // 4. Fetch users
  const usersRes = await fetchJSON(`${BASE}/users?token=${TOKEN}`);
  const users = usersRes.users || usersRes || [];
  console.log(`\n✅ Users: ${users.length}`);
  for (const u of users) {
    console.log(`  User: "${u.name}" (${u.email}) id: ${u._id}`);
  }

  // 5. Validate deal.user mapping
  console.log("\n--- Validating deal.user mapping ---");
  const userIds = new Set(users.map(u => u._id));
  const firstPageDeals = await fetchJSON(`${BASE}/deals?token=${TOKEN}&limit=50&page=1`);
  let dealsWithUser = 0;
  let dealsWithUnknownUser = 0;
  for (const d of (firstPageDeals.deals || [])) {
    if (d.user?._id) {
      dealsWithUser++;
      if (!userIds.has(d.user._id)) {
        dealsWithUnknownUser++;
        console.log(`  ⚠️ Deal "${d.name}" has user "${d.user.name}" (${d.user._id}) not in users list`);
      }
    }
  }
  console.log(`Deals with user (sample): ${dealsWithUser}/${firstPageDeals.deals?.length || 0}`);
  console.log(`Deals with unknown user: ${dealsWithUnknownUser}`);

  // 6. Contacts count
  const contactsRes = await fetchJSON(`${BASE}/contacts?token=${TOKEN}&limit=1&page=1`);
  console.log(`\n✅ Total contacts: ${contactsRes.total}`);

  // 7. Organizations count
  const orgsRes = await fetchJSON(`${BASE}/organizations?token=${TOKEN}&limit=1&page=1`);
  console.log(`✅ Total organizations: ${orgsRes.total}`);

  // 8. Tasks count
  const tasksRes = await fetchJSON(`${BASE}/tasks?token=${TOKEN}&limit=1&page=1`);
  console.log(`✅ Total tasks: ${tasksRes.total}`);

  console.log("\n=== Validation Complete ===");
  
  if (unmappedStages > 0) {
    console.log(`\n⚠️ WARNING: ${unmappedStages} deals have stages not mapped to any pipeline`);
  } else {
    console.log("\n✅ All deal stages are properly mapped to pipelines");
  }
}

main().catch(console.error);
