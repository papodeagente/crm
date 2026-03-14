/**
 * Direct import test script
 * Calls the runImport function directly to test the full import flow
 */

import { createConnection } from 'mysql2/promise';

const TOKEN = '645c346a88cd99000fa7b641';
const TENANT_ID = 240007;
const BASE = 'https://crm.rdstation.com/api/v1';

async function fetchJSON(url) {
  const res = await fetch(url);
  return res.json();
}

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);
  
  console.log("=== Step 1: Clean all existing RD Station data ===");
  
  // Delete in proper order (foreign key constraints)
  console.log("Deleting tasks...");
  await conn.execute(`DELETE FROM crm_tasks WHERE tenantId = ${TENANT_ID}`);
  
  console.log("Deleting deal_products...");
  await conn.execute(`DELETE FROM deal_products WHERE tenantId = ${TENANT_ID}`);
  
  console.log("Deleting deal_history...");
  await conn.execute(`DELETE FROM deal_history WHERE tenantId = ${TENANT_ID}`);
  
  console.log("Deleting deals...");
  await conn.execute(`DELETE FROM deals WHERE tenantId = ${TENANT_ID}`);
  
  console.log("Deleting contacts...");
  await conn.execute(`DELETE FROM contacts WHERE tenantId = ${TENANT_ID}`);
  
  console.log("Deleting accounts...");
  await conn.execute(`DELETE FROM accounts WHERE tenantId = ${TENANT_ID}`);
  
  console.log("Deleting pipeline_stages (non-default)...");
  await conn.execute(`DELETE FROM pipeline_stages WHERE tenantId = ${TENANT_ID} AND pipelineId NOT IN (330012, 330013)`);
  
  console.log("Deleting pipelines (non-default)...");
  await conn.execute(`DELETE FROM pipelines WHERE tenantId = ${TENANT_ID} AND id NOT IN (330012, 330013)`);
  
  console.log("Deleting products...");
  await conn.execute(`DELETE FROM product_catalog WHERE tenantId = ${TENANT_ID}`);
  
  console.log("Deleting lead_sources...");
  await conn.execute(`DELETE FROM lead_sources WHERE tenantId = ${TENANT_ID}`);
  
  console.log("Deleting campaigns...");
  await conn.execute(`DELETE FROM campaigns WHERE tenantId = ${TENANT_ID}`);
  
  console.log("Deleting loss_reasons...");
  await conn.execute(`DELETE FROM loss_reasons WHERE tenantId = ${TENANT_ID}`);
  
  // Check rdExternalId columns exist
  try {
    await conn.execute(`SELECT rdExternalId FROM contacts LIMIT 1`);
  } catch {
    console.log("Adding rdExternalId columns...");
    const tables = ['contacts', 'deals', 'pipelines', 'pipeline_stages', 'accounts', 'crm_tasks', 'product_catalog', 'lead_sources', 'campaigns', 'loss_reasons', 'crm_users'];
    for (const t of tables) {
      try {
        await conn.execute(`ALTER TABLE ${t} ADD COLUMN rdExternalId VARCHAR(64) DEFAULT NULL`);
        console.log(`  Added rdExternalId to ${t}`);
      } catch (e) {
        if (!e.message.includes('Duplicate column')) throw e;
      }
    }
  }
  
  console.log("\n✅ Clean complete. Verifying...");
  const [dealCount] = await conn.execute(`SELECT COUNT(*) as cnt FROM deals WHERE tenantId = ${TENANT_ID}`);
  const [contactCount] = await conn.execute(`SELECT COUNT(*) as cnt FROM contacts WHERE tenantId = ${TENANT_ID}`);
  const [pipelineCount] = await conn.execute(`SELECT COUNT(*) as cnt FROM pipelines WHERE tenantId = ${TENANT_ID}`);
  console.log(`Deals: ${dealCount[0].cnt}, Contacts: ${contactCount[0].cnt}, Pipelines: ${pipelineCount[0].cnt}`);
  
  console.log("\n=== Step 2: Fetch data from RD Station ===");
  
  // Fetch pipelines
  const rdPipelines = await fetchJSON(`${BASE}/deal_pipelines?token=${TOKEN}`);
  console.log(`Pipelines: ${rdPipelines.length}`);
  
  // Build stage→pipeline map
  const stageToPipelineRd = new Map();
  for (const p of rdPipelines) {
    for (const s of p.deal_stages || []) {
      stageToPipelineRd.set(s._id, p.id);
    }
  }
  
  // Create pipelines and stages
  console.log("\n=== Step 3: Import Pipelines & Stages ===");
  const pipelineMap = new Map(); // rdId → dbId
  const stageMap = new Map(); // rdId → dbId
  
  for (const p of rdPipelines) {
    const rdId = p.id;
    const [result] = await conn.execute(
      `INSERT INTO pipelines (tenantId, name, isDefault, rdExternalId) VALUES (?, ?, 0, ?)`,
      [TENANT_ID, p.name, rdId]
    );
    const dbPipelineId = result.insertId;
    pipelineMap.set(rdId, dbPipelineId);
    console.log(`  Pipeline "${p.name}" → id ${dbPipelineId}`);
    
    for (let i = 0; i < (p.deal_stages || []).length; i++) {
      const s = p.deal_stages[i];
      const [stageResult] = await conn.execute(
        `INSERT INTO pipeline_stages (tenantId, pipelineId, name, orderIndex, rdExternalId) VALUES (?, ?, ?, ?, ?)`,
        [TENANT_ID, dbPipelineId, s.name, i, s._id]
      );
      stageMap.set(s._id, stageResult.insertId);
    }
  }
  console.log(`Created ${pipelineMap.size} pipelines, ${stageMap.size} stages`);
  
  // Fetch users
  console.log("\n=== Step 4: Import Users ===");
  const usersRes = await fetchJSON(`${BASE}/users?token=${TOKEN}`);
  const rdUsers = usersRes.users || usersRes || [];
  const userMap = new Map(); // rdId → dbId
  
  for (const u of rdUsers) {
    // Check if CRM user already exists with this email
    const [existing] = await conn.execute(
      `SELECT id FROM crm_users WHERE tenantId = ? AND email = ?`,
      [TENANT_ID, u.email]
    );
    if (existing.length > 0) {
      userMap.set(u._id, existing[0].id);
      // Update rdExternalId
      await conn.execute(`UPDATE crm_users SET rdExternalId = ? WHERE id = ?`, [u._id, existing[0].id]);
    } else {
      const [result] = await conn.execute(
        `INSERT INTO crm_users (tenantId, name, email, status, rdExternalId) VALUES (?, ?, ?, 'active', ?)`,
        [TENANT_ID, u.name?.trim() || u.email, u.email, u._id]
      );
      userMap.set(u._id, result.insertId);
    }
  }
  console.log(`Mapped ${userMap.size} users`);
  
  // Fetch contacts
  console.log("\n=== Step 5: Import Contacts ===");
  let contactPage = 1;
  let totalContacts = 0;
  const contactMap = new Map(); // rdId → dbId
  const contactByEmail = new Map(); // email → dbId
  
  while (true) {
    const res = await fetchJSON(`${BASE}/contacts?token=${TOKEN}&limit=200&page=${contactPage}`);
    const contacts = res.contacts || [];
    if (contacts.length === 0) break;
    
    for (const c of contacts) {
      const rdId = c._id;
      const name = (c.name || '').trim() || 'Sem nome';
      const email = c.emails?.[0]?.email || null;
      const phone = c.phones?.[0]?.phone || null;
      
      const [result] = await conn.execute(
        `INSERT INTO contacts (tenantId, name, email, phone, source, type, rdExternalId) VALUES (?, ?, ?, ?, 'rd_station_crm', 'person', ?)`,
        [TENANT_ID, name, email, phone, rdId]
      );
      contactMap.set(rdId, result.insertId);
      if (email) contactByEmail.set(email.toLowerCase().trim(), result.insertId);
      totalContacts++;
    }
    
    if (contactPage % 10 === 0) console.log(`  Imported ${totalContacts} contacts (page ${contactPage})...`);
    contactPage++;
    if (contacts.length < 200) break;
  }
  console.log(`✅ Imported ${totalContacts} contacts`);
  
  // Fetch organizations
  console.log("\n=== Step 6: Import Organizations ===");
  let orgPage = 1;
  let totalOrgs = 0;
  const orgMap = new Map(); // rdId → dbId
  
  while (true) {
    const res = await fetchJSON(`${BASE}/organizations?token=${TOKEN}&limit=200&page=${orgPage}`);
    const orgs = res.organizations || [];
    if (orgs.length === 0) break;
    
    for (const o of orgs) {
      const rdId = o._id;
      const [result] = await conn.execute(
        `INSERT INTO accounts (tenantId, name, rdExternalId) VALUES (?, ?, ?)`,
        [TENANT_ID, o.name || 'Sem nome', rdId]
      );
      orgMap.set(rdId, result.insertId);
      totalOrgs++;
    }
    
    if (orgPage % 10 === 0) console.log(`  Imported ${totalOrgs} organizations (page ${orgPage})...`);
    orgPage++;
    if (orgs.length < 200) break;
  }
  console.log(`✅ Imported ${totalOrgs} organizations`);
  
  // Fetch deals
  console.log("\n=== Step 7: Import Deals ===");
  let totalDeals = 0;
  let dealsOpen = 0;
  let dealsWon = 0;
  let dealsLost = 0;
  let dealsWithoutContact = 0;
  
  // Get fallback pipeline/stage
  const [defaultPipelines] = await conn.execute(`SELECT id FROM pipelines WHERE tenantId = ? AND isDefault = 1 LIMIT 1`, [TENANT_ID]);
  let fallbackPipelineId = defaultPipelines[0]?.id;
  let fallbackStageId;
  if (fallbackPipelineId) {
    const [defaultStages] = await conn.execute(`SELECT id FROM pipeline_stages WHERE tenantId = ? AND pipelineId = ? ORDER BY orderIndex LIMIT 1`, [TENANT_ID, fallbackPipelineId]);
    fallbackStageId = defaultStages[0]?.id;
  }
  
  // If no default pipeline, use the first imported one
  if (!fallbackPipelineId) {
    const firstPipeline = pipelineMap.values().next().value;
    fallbackPipelineId = firstPipeline;
    const [firstStages] = await conn.execute(`SELECT id FROM pipeline_stages WHERE tenantId = ? AND pipelineId = ? ORDER BY orderIndex LIMIT 1`, [TENANT_ID, fallbackPipelineId]);
    fallbackStageId = firstStages[0]?.id;
  }
  
  for (const p of rdPipelines) {
    const rdPipelineId = p.id;
    let dealPage = 1;
    let pipelineDeals = 0;
    
    while (true) {
      const res = await fetchJSON(`${BASE}/deals?token=${TOKEN}&deal_pipeline_id=${rdPipelineId}&limit=200&page=${dealPage}`);
      const deals = res.deals || [];
      if (deals.length === 0) break;
      
      for (const d of deals) {
        const rdId = d._id || d.id;
        
        // Resolve pipeline and stage
        let stageId = fallbackStageId;
        let pipelineId = fallbackPipelineId;
        
        if (d.deal_stage?._id) {
          const mappedStageId = stageMap.get(d.deal_stage._id);
          if (mappedStageId) {
            stageId = mappedStageId;
            const rdPipeId = stageToPipelineRd.get(d.deal_stage._id);
            if (rdPipeId) {
              const mappedPipeId = pipelineMap.get(rdPipeId);
              if (mappedPipeId) pipelineId = mappedPipeId;
            }
          }
        }
        
        // Resolve contact
        let contactId = null;
        if (d.contacts?.length > 0) {
          const fc = d.contacts[0];
          if (fc._id && contactMap.has(fc._id)) {
            contactId = contactMap.get(fc._id);
          } else if (fc.emails?.[0]?.email) {
            contactId = contactByEmail.get(fc.emails[0].email.toLowerCase().trim()) || null;
          }
        }
        if (!contactId) dealsWithoutContact++;
        
        // Resolve account
        let accountId = null;
        if (d.organization?._id && orgMap.has(d.organization._id)) {
          accountId = orgMap.get(d.organization._id);
        }
        
        // Resolve owner
        let ownerUserId = null;
        if (d.user?._id && userMap.has(d.user._id)) {
          ownerUserId = userMap.get(d.user._id);
        }
        
        // Determine status
        let status = 'open';
        if (d.win === true) { status = 'won'; dealsWon++; }
        else if (d.win === false) { status = 'lost'; dealsLost++; }
        else { dealsOpen++; }
        
        const valueCents = Math.round((d.amount_total || 0) * 100);
        const createdAt = d.created_at ? new Date(d.created_at) : new Date();
        
        await conn.execute(
          `INSERT INTO deals (tenantId, title, contactId, accountId, pipelineId, stageId, valueCents, status, ownerUserId, leadSource, rdExternalId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'rd_station_crm', ?, ?)`,
          [TENANT_ID, d.name || 'Negociação importada', contactId, accountId, pipelineId, stageId, valueCents, status, ownerUserId, rdId, createdAt]
        );
        
        totalDeals++;
        pipelineDeals++;
      }
      
      dealPage++;
      if (deals.length < 200) break;
    }
    
    console.log(`  Pipeline "${p.name}": ${pipelineDeals} deals imported`);
  }
  console.log(`\n✅ Imported ${totalDeals} deals (open: ${dealsOpen}, won: ${dealsWon}, lost: ${dealsLost})`);
  console.log(`  Deals without contact: ${dealsWithoutContact}`);
  
  // Fetch tasks
  console.log("\n=== Step 8: Import Tasks ===");
  let taskPage = 1;
  let totalTasks = 0;
  
  while (true) {
    const res = await fetchJSON(`${BASE}/tasks?token=${TOKEN}&limit=200&page=${taskPage}`);
    const tasks = res.tasks || [];
    if (tasks.length === 0) break;
    
    for (const t of tasks) {
      const rdId = t._id;
      
      // Resolve deal
      let dealId = null;
      if (t.deal?._id) {
        // Find the deal by rdExternalId
        const [dealRows] = await conn.execute(
          `SELECT id FROM deals WHERE tenantId = ? AND rdExternalId = ? LIMIT 1`,
          [TENANT_ID, t.deal._id]
        );
        dealId = dealRows[0]?.id || null;
      }
      
      // Resolve assignee
      let assigneeUserId = null;
      if (t.user?._id && userMap.has(t.user._id)) {
        assigneeUserId = userMap.get(t.user._id);
      }
      
      const dueAt = t.date ? new Date(t.date) : null;
      const status = t.done === true ? 'done' : 'pending';
      
      await conn.execute(
        `INSERT INTO crm_tasks (tenantId, title, taskType, entityType, entityId, dueAt, status, assignedToUserId, rdExternalId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [TENANT_ID, t.subject || 'Tarefa importada', t.type || 'task', dealId ? 'deal' : null, dealId, dueAt, status, assigneeUserId, rdId]
      );
      totalTasks++;
    }
    
    if (taskPage % 10 === 0) console.log(`  Imported ${totalTasks} tasks (page ${taskPage})...`);
    taskPage++;
    if (tasks.length < 200) break;
  }
  console.log(`✅ Imported ${totalTasks} tasks`);
  
  // Final validation
  console.log("\n=== Step 9: Validation ===");
  const [finalDeals] = await conn.execute(`SELECT status, COUNT(*) as cnt FROM deals WHERE tenantId = ${TENANT_ID} AND deletedAt IS NULL GROUP BY status`);
  console.log("Deals by status:", JSON.stringify(finalDeals));
  
  const [finalPipeDeals] = await conn.execute(`SELECT p.name, d.status, COUNT(*) as cnt FROM deals d JOIN pipelines p ON d.pipelineId = p.id WHERE d.tenantId = ${TENANT_ID} AND d.deletedAt IS NULL GROUP BY p.name, d.status ORDER BY p.name, d.status`);
  console.log("\nDeals by pipeline and status:");
  for (const r of finalPipeDeals) {
    console.log(`  ${r.name} | ${r.status}: ${r.cnt}`);
  }
  
  const [finalContacts] = await conn.execute(`SELECT COUNT(*) as cnt FROM contacts WHERE tenantId = ${TENANT_ID} AND deletedAt IS NULL`);
  console.log(`\nTotal contacts: ${finalContacts[0].cnt}`);
  
  const [finalTasks] = await conn.execute(`SELECT COUNT(*) as cnt FROM crm_tasks WHERE tenantId = ${TENANT_ID}`);
  console.log(`Total tasks: ${finalTasks[0].cnt}`);
  
  const [finalPipelines] = await conn.execute(`SELECT id, name FROM pipelines WHERE tenantId = ${TENANT_ID} ORDER BY id`);
  console.log("\nPipelines:");
  for (const p of finalPipelines) {
    console.log(`  ${p.id}: ${p.name}`);
  }
  
  // Check open deals per pipeline
  const [openByPipeline] = await conn.execute(`SELECT p.name, COUNT(*) as cnt FROM deals d JOIN pipelines p ON d.pipelineId = p.id WHERE d.tenantId = ${TENANT_ID} AND d.deletedAt IS NULL AND d.status = 'open' GROUP BY p.name ORDER BY cnt DESC`);
  console.log("\nOpen deals by pipeline:");
  for (const r of openByPipeline) {
    console.log(`  ${r.name}: ${r.cnt}`);
  }
  
  await conn.end();
  console.log("\n=== Import Complete ===");
}

main().catch(console.error);
