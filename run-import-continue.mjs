/**
 * Continue import from where it left off
 * Pipelines and stages are already created (360032-360038)
 * Need to import: users, contacts, organizations, deals, tasks
 */

import { createConnection } from 'mysql2/promise';

const TOKEN = '645c346a88cd99000fa7b641';
const TENANT_ID = 240007;
const BASE = 'https://crm.rdstation.com/api/v1';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);
  
  // Load existing pipelines and stages from DB
  const [dbPipelines] = await conn.execute('SELECT id, name, rdExternalId FROM pipelines WHERE tenantId = ? AND rdExternalId IS NOT NULL', [TENANT_ID]);
  const [dbStages] = await conn.execute('SELECT id, pipelineId, name, rdExternalId FROM pipeline_stages WHERE tenantId = ? AND rdExternalId IS NOT NULL', [TENANT_ID]);
  
  const pipelineMap = new Map(); // rdId → dbId
  for (const p of dbPipelines) pipelineMap.set(p.rdExternalId, p.id);
  
  const stageMap = new Map(); // rdId → dbId
  for (const s of dbStages) stageMap.set(s.rdExternalId, s.id);
  
  console.log(`Loaded ${pipelineMap.size} pipelines, ${stageMap.size} stages from DB`);
  
  // Build stage→pipeline map from RD Station
  const rdPipelines = await fetchJSON(`${BASE}/deal_pipelines?token=${TOKEN}`);
  const stageToPipelineRd = new Map();
  for (const p of rdPipelines) {
    const pId = p.id || p._id;
    for (const s of p.deal_stages || []) {
      stageToPipelineRd.set(s._id, pId);
    }
  }
  
  // Get fallback pipeline/stage
  const [defaultPipelines] = await conn.execute('SELECT id FROM pipelines WHERE tenantId = ? AND isDefault = 1 LIMIT 1', [TENANT_ID]);
  let fallbackPipelineId = defaultPipelines[0]?.id || dbPipelines[0]?.id;
  const [defaultStages] = await conn.execute('SELECT id FROM pipeline_stages WHERE tenantId = ? AND pipelineId = ? ORDER BY orderIndex LIMIT 1', [TENANT_ID, fallbackPipelineId]);
  let fallbackStageId = defaultStages[0]?.id;
  
  // === USERS ===
  console.log("\n=== Import Users ===");
  const usersRes = await fetchJSON(`${BASE}/users?token=${TOKEN}`);
  const rdUsers = usersRes.users || usersRes || [];
  const userMap = new Map();
  
  for (const u of rdUsers) {
    const [existing] = await conn.execute('SELECT id FROM crm_users WHERE tenantId = ? AND email = ?', [TENANT_ID, u.email]);
    if (existing.length > 0) {
      userMap.set(u._id, existing[0].id);
      await conn.execute('UPDATE crm_users SET rdExternalId = ? WHERE id = ?', [u._id, existing[0].id]);
    } else {
      const [result] = await conn.execute(
        'INSERT INTO crm_users (tenantId, name, email, status, rdExternalId) VALUES (?, ?, ?, ?, ?)',
        [TENANT_ID, (u.name || '').trim() || u.email, u.email, 'active', u._id]
      );
      userMap.set(u._id, result.insertId);
    }
  }
  console.log(`✅ Mapped ${userMap.size} users`);
  
  // === CONTACTS ===
  console.log("\n=== Import Contacts ===");
  let contactPage = 1;
  let totalContacts = 0;
  const contactMap = new Map();
  const contactByEmail = new Map();
  
  while (true) {
    const res = await fetchJSON(`${BASE}/contacts?token=${TOKEN}&limit=200&page=${contactPage}`);
    const contacts = res.contacts || [];
    if (contacts.length === 0) break;
    
    for (const c of contacts) {
      const rdId = c._id;
      const name = (c.name || '').trim() || 'Sem nome';
      const email = c.emails?.[0]?.email || null;
      const rawPhone = c.phones?.[0]?.phone || null;
      const phone = rawPhone ? rawPhone.substring(0, 32) : null;
      
      const [result] = await conn.execute(
        'INSERT INTO contacts (tenantId, name, email, phone, source, type, rdExternalId) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [TENANT_ID, name, email, phone, 'rd_station_crm', 'person', rdId]
      );
      contactMap.set(rdId, result.insertId);
      if (email) contactByEmail.set(email.toLowerCase().trim(), result.insertId);
      totalContacts++;
    }
    
    if (contactPage % 10 === 0) console.log(`  ${totalContacts} contacts (page ${contactPage})...`);
    contactPage++;
    if (contacts.length < 200) break;
  }
  console.log(`✅ Imported ${totalContacts} contacts`);
  
  // === ORGANIZATIONS ===
  console.log("\n=== Import Organizations ===");
  let orgPage = 1;
  let totalOrgs = 0;
  const orgMap = new Map();
  
  while (true) {
    const res = await fetchJSON(`${BASE}/organizations?token=${TOKEN}&limit=200&page=${orgPage}`);
    const orgs = res.organizations || [];
    if (orgs.length === 0) break;
    
    for (const o of orgs) {
      const [result] = await conn.execute(
        'INSERT INTO accounts (tenantId, name, rdExternalId) VALUES (?, ?, ?)',
        [TENANT_ID, o.name || 'Sem nome', o._id]
      );
      orgMap.set(o._id, result.insertId);
      totalOrgs++;
    }
    
    if (orgPage % 10 === 0) console.log(`  ${totalOrgs} organizations (page ${orgPage})...`);
    orgPage++;
    if (orgs.length < 200) break;
  }
  console.log(`✅ Imported ${totalOrgs} organizations`);
  
  // === DEALS ===
  console.log("\n=== Import Deals ===");
  let totalDeals = 0;
  let dealsOpen = 0, dealsWon = 0, dealsLost = 0;
  let dealsWithoutContact = 0;
  let dealsWithoutStage = 0;
  
  for (const p of rdPipelines) {
    const rdPipelineId = p.id || p._id;
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
          } else {
            dealsWithoutStage++;
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
          'INSERT INTO deals (tenantId, title, contactId, accountId, pipelineId, stageId, valueCents, status, ownerUserId, leadSource, rdExternalId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [TENANT_ID, d.name || 'Negociação importada', contactId, accountId, pipelineId, stageId, valueCents, status, ownerUserId, 'rd_station_crm', rdId, createdAt]
        );
        
        totalDeals++;
        pipelineDeals++;
      }
      
      dealPage++;
      if (deals.length < 200) break;
    }
    
    console.log(`  Pipeline "${p.name}": ${pipelineDeals} deals`);
  }
  console.log(`\n✅ Imported ${totalDeals} deals (open: ${dealsOpen}, won: ${dealsWon}, lost: ${dealsLost})`);
  console.log(`  Without contact: ${dealsWithoutContact}, Without mapped stage: ${dealsWithoutStage}`);
  
  // === TASKS ===
  console.log("\n=== Import Tasks ===");
  let taskPage = 1;
  let totalTasks = 0;
  let tasksWithDeal = 0;
  
  while (true) {
    const res = await fetchJSON(`${BASE}/tasks?token=${TOKEN}&limit=200&page=${taskPage}`);
    const tasks = res.tasks || [];
    if (tasks.length === 0) break;
    
    for (const t of tasks) {
      const rdId = t._id;
      
      // Resolve deal
      let dealId = null;
      if (t.deal?._id) {
        const [dealRows] = await conn.execute(
          'SELECT id FROM deals WHERE tenantId = ? AND rdExternalId = ? LIMIT 1',
          [TENANT_ID, t.deal._id]
        );
        dealId = dealRows[0]?.id || null;
        if (dealId) tasksWithDeal++;
      }
      
      // Resolve assignee
      let assigneeUserId = null;
      if (t.user?._id && userMap.has(t.user._id)) {
        assigneeUserId = userMap.get(t.user._id);
      }
      
      const dueAt = t.date ? new Date(t.date) : null;
      const status = t.done === true ? 'done' : 'pending';
      
      await conn.execute(
        'INSERT INTO crm_tasks (tenantId, title, taskType, entityType, entityId, dueAt, status, assignedToUserId, rdExternalId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [TENANT_ID, t.subject || 'Tarefa importada', t.type || 'task', dealId ? 'deal' : null, dealId, dueAt, status, assigneeUserId, rdId]
      );
      totalTasks++;
    }
    
    if (taskPage % 20 === 0) console.log(`  ${totalTasks} tasks (page ${taskPage})...`);
    taskPage++;
    if (tasks.length < 200) break;
  }
  console.log(`✅ Imported ${totalTasks} tasks (${tasksWithDeal} linked to deals)`);
  
  // === VALIDATION ===
  console.log("\n=== VALIDATION ===");
  
  const [finalDeals] = await conn.execute('SELECT status, COUNT(*) as cnt FROM deals WHERE tenantId = ? AND deletedAt IS NULL GROUP BY status', [TENANT_ID]);
  console.log("Deals by status:");
  for (const r of finalDeals) console.log(`  ${r.status}: ${r.cnt}`);
  
  const [openByPipeline] = await conn.execute(
    'SELECT p.name, d.status, COUNT(*) as cnt FROM deals d JOIN pipelines p ON d.pipelineId = p.id WHERE d.tenantId = ? AND d.deletedAt IS NULL GROUP BY p.name, d.status ORDER BY p.name, d.status',
    [TENANT_ID]
  );
  console.log("\nDeals by pipeline and status:");
  for (const r of openByPipeline) console.log(`  ${r.name} | ${r.status}: ${r.cnt}`);
  
  // Compare with RD Station
  console.log("\n--- Comparison with RD Station ---");
  for (const p of rdPipelines) {
    const rdPipeId = p.id || p._id;
    const dbPipeId = pipelineMap.get(rdPipeId);
    
    // RD Station counts
    const rdOpen = (await fetchJSON(`${BASE}/deals?token=${TOKEN}&deal_pipeline_id=${rdPipeId}&win=null&limit=1&page=1`)).total || 0;
    
    // DB counts
    const [dbOpen] = await conn.execute('SELECT COUNT(*) as cnt FROM deals WHERE tenantId = ? AND pipelineId = ? AND status = ? AND deletedAt IS NULL', [TENANT_ID, dbPipeId, 'open']);
    
    const match = rdOpen === dbOpen[0].cnt ? '✅' : '❌';
    console.log(`${match} ${p.name}: RD=${rdOpen} open, DB=${dbOpen[0].cnt} open`);
  }
  
  const [totalContactsDb] = await conn.execute('SELECT COUNT(*) as cnt FROM contacts WHERE tenantId = ? AND deletedAt IS NULL', [TENANT_ID]);
  const rdContactsTotal = (await fetchJSON(`${BASE}/contacts?token=${TOKEN}&limit=1&page=1`)).total || 0;
  console.log(`\nContacts: RD=${rdContactsTotal}, DB=${totalContactsDb[0].cnt} ${rdContactsTotal === totalContactsDb[0].cnt ? '✅' : '⚠️'}`);
  
  const [totalTasksDb] = await conn.execute('SELECT COUNT(*) as cnt FROM crm_tasks WHERE tenantId = ?', [TENANT_ID]);
  const rdTasksTotal = (await fetchJSON(`${BASE}/tasks?token=${TOKEN}&limit=1&page=1`)).total || 0;
  console.log(`Tasks: RD=${rdTasksTotal}, DB=${totalTasksDb[0].cnt} ${rdTasksTotal === totalTasksDb[0].cnt ? '✅' : '⚠️'}`);
  
  await conn.end();
  console.log("\n=== Import Complete ===");
}

main().catch(console.error);
