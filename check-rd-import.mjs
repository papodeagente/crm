import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const queries = [
  ["contacts_rd", "SELECT COUNT(*) as cnt FROM contacts WHERE source = 'rd_station_crm' AND deletedAt IS NULL"],
  ["contacts_all", "SELECT COUNT(*) as cnt FROM contacts WHERE deletedAt IS NULL"],
  ["deals_rd", "SELECT COUNT(*) as cnt FROM deals WHERE leadSource = 'rd_station_crm' AND deletedAt IS NULL"],
  ["deals_all", "SELECT COUNT(*) as cnt FROM deals WHERE deletedAt IS NULL"],
  ["deals_open", "SELECT COUNT(*) as cnt FROM deals WHERE leadSource = 'rd_station_crm' AND status = 'open' AND deletedAt IS NULL"],
  ["deals_won", "SELECT COUNT(*) as cnt FROM deals WHERE leadSource = 'rd_station_crm' AND status = 'won' AND deletedAt IS NULL"],
  ["deals_lost", "SELECT COUNT(*) as cnt FROM deals WHERE leadSource = 'rd_station_crm' AND status = 'lost' AND deletedAt IS NULL"],
  ["deals_no_contact", "SELECT COUNT(*) as cnt FROM deals WHERE leadSource = 'rd_station_crm' AND contactId IS NULL AND deletedAt IS NULL"],
  ["deals_no_pipeline", "SELECT COUNT(*) as cnt FROM deals WHERE leadSource = 'rd_station_crm' AND pipelineId IS NULL AND deletedAt IS NULL"],
  ["pipelines", "SELECT COUNT(*) as cnt FROM pipelines"],
  ["stages", "SELECT COUNT(*) as cnt FROM pipeline_stages"],
  ["tasks", "SELECT COUNT(*) as cnt FROM crm_tasks"],
  ["accounts", "SELECT COUNT(*) as cnt FROM accounts"],
  ["lead_sources", "SELECT COUNT(*) as cnt FROM lead_sources"],
  ["campaigns", "SELECT COUNT(*) as cnt FROM campaigns"],
  ["loss_reasons", "SELECT COUNT(*) as cnt FROM loss_reasons"],
  ["tenants", "SELECT id, name FROM tenants"],
];

console.log("=== Estado Atual do Banco ===\n");

for (const [label, sql] of queries) {
  try {
    const [rows] = await conn.query(sql);
    if (rows[0]?.cnt !== undefined) {
      console.log(`${label}: ${rows[0].cnt}`);
    } else {
      console.log(`${label}:`, JSON.stringify(rows));
    }
  } catch (e) {
    console.log(`${label}: ERROR - ${e.message}`);
  }
}

// Check pipeline details
console.log("\n=== Funis ===");
const [pipelines] = await conn.query("SELECT id, tenantId, name, isDefault FROM pipelines ORDER BY tenantId, id");
for (const p of pipelines) {
  console.log(`  Pipeline ${p.id} (tenant ${p.tenantId}): ${p.name} ${p.isDefault ? '[DEFAULT]' : ''}`);
  const [stages] = await conn.query("SELECT id, name, orderIndex FROM pipeline_stages WHERE pipelineId = ? ORDER BY orderIndex", [p.id]);
  for (const s of stages) {
    console.log(`    Stage ${s.id}: ${s.name} (order: ${s.orderIndex})`);
  }
}

// Check deals per pipeline
console.log("\n=== Negociações por Funil ===");
const [dealsByPipeline] = await conn.query(`
  SELECT p.name as pipeline, COUNT(d.id) as cnt, d.status
  FROM deals d
  JOIN pipelines p ON d.pipelineId = p.id
  WHERE d.leadSource = 'rd_station_crm' AND d.deletedAt IS NULL
  GROUP BY p.name, d.status
  ORDER BY p.name, d.status
`);
for (const r of dealsByPipeline) {
  console.log(`  ${r.pipeline}: ${r.cnt} (${r.status})`);
}

// Check sample contacts
console.log("\n=== Amostra de Contatos RD (10 primeiros) ===");
const [sampleContacts] = await conn.query(`
  SELECT id, name, email, phone, source FROM contacts 
  WHERE source = 'rd_station_crm' AND deletedAt IS NULL 
  ORDER BY id LIMIT 10
`);
for (const c of sampleContacts) {
  console.log(`  ${c.id}: ${c.name} | ${c.email || '-'} | ${c.phone || '-'}`);
}

// Check deals without contacts
console.log("\n=== Negociações RD sem contato (10 primeiras) ===");
const [dealsNoContact] = await conn.query(`
  SELECT id, title, status, pipelineId, stageId FROM deals 
  WHERE leadSource = 'rd_station_crm' AND contactId IS NULL AND deletedAt IS NULL 
  ORDER BY id LIMIT 10
`);
for (const d of dealsNoContact) {
  console.log(`  ${d.id}: ${d.title} | status: ${d.status} | pipeline: ${d.pipelineId} | stage: ${d.stageId}`);
}

// Check tasks
console.log("\n=== Tarefas (amostra) ===");
const [sampleTasks] = await conn.query(`
  SELECT id, title, entityType, entityId, status, taskType FROM crm_tasks 
  ORDER BY id DESC LIMIT 10
`);
for (const t of sampleTasks) {
  console.log(`  ${t.id}: ${t.title} | ${t.entityType}:${t.entityId} | ${t.status} | ${t.taskType}`);
}

// Check if there are duplicate contacts
console.log("\n=== Contatos Duplicados (email) ===");
const [dupeContacts] = await conn.query(`
  SELECT email, COUNT(*) as cnt FROM contacts 
  WHERE source = 'rd_station_crm' AND deletedAt IS NULL AND email IS NOT NULL AND email != ''
  GROUP BY email HAVING cnt > 1 
  ORDER BY cnt DESC LIMIT 10
`);
for (const d of dupeContacts) {
  console.log(`  ${d.email}: ${d.cnt} duplicatas`);
}

// Check duplicate pipelines
console.log("\n=== Funis Duplicados ===");
const [dupePipelines] = await conn.query(`
  SELECT tenantId, name, COUNT(*) as cnt FROM pipelines 
  GROUP BY tenantId, name HAVING cnt > 1
`);
for (const d of dupePipelines) {
  console.log(`  Tenant ${d.tenantId}: "${d.name}" aparece ${d.cnt}x`);
}

await conn.end();
