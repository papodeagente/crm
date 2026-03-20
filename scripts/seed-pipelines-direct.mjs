/**
 * Seed default pipelines for tenants that don't have them.
 * Uses direct DB connection via Drizzle.
 */
import dotenv from "dotenv";
dotenv.config();

import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const SALES_STAGES = [
  { name: "Novo atendimento", orderIndex: 0, probabilityDefault: 5, color: "#3b82f6" },
  { name: "Primeiro contato", orderIndex: 1, probabilityDefault: 10, color: "#06b6d4" },
  { name: "Diagnóstico", orderIndex: 2, probabilityDefault: 25, color: "#8b5cf6" },
  { name: "Cotação", orderIndex: 3, probabilityDefault: 40, color: "#f59e0b" },
  { name: "Apresentação", orderIndex: 4, probabilityDefault: 60, color: "#f97316" },
  { name: "Acompanhamento", orderIndex: 5, probabilityDefault: 75, color: "#22c55e" },
  { name: "Reserva", orderIndex: 6, probabilityDefault: 90, color: "#10b981" },
];

const POST_SALE_STAGES = [
  { name: "Novo cliente", orderIndex: 0, probabilityDefault: 100, color: "#3b82f6" },
  { name: "Aguardando embarque", orderIndex: 1, probabilityDefault: 100, color: "#06b6d4" },
  { name: "30D para embarque", orderIndex: 2, probabilityDefault: 100, color: "#8b5cf6" },
  { name: "Pré embarque", orderIndex: 3, probabilityDefault: 100, color: "#f59e0b" },
  { name: "Em viagem", orderIndex: 4, probabilityDefault: 100, color: "#22c55e" },
  { name: "Pós viagem", orderIndex: 5, probabilityDefault: 100, color: "#f97316" },
  { name: "Viagem finalizada", orderIndex: 6, probabilityDefault: 100, color: "#10b981" },
];

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // Get tenants without pipelines
  const [tenants] = await conn.query(
    "SELECT t.id, t.name FROM tenants t WHERE NOT EXISTS (SELECT 1 FROM pipelines p WHERE p.tenantId = t.id)"
  );
  
  console.log(`Found ${tenants.length} tenants without pipelines`);
  
  for (const tenant of tenants) {
    console.log(`\nSeeding pipelines for tenant ${tenant.id} (${tenant.name})...`);
    
    // Create Sales Pipeline
    const [salesResult] = await conn.query(
      `INSERT INTO pipelines (tenantId, name, description, color, pipelineType, isDefault, createdAt, updatedAt) 
       VALUES (?, 'Funil de Vendas', 'Pipeline principal de vendas', '#3b82f6', 'sales', 1, NOW(), NOW())`,
      [tenant.id]
    );
    const salesPipelineId = salesResult.insertId;
    console.log(`  Created Sales Pipeline: ${salesPipelineId}`);
    
    // Create Sales Stages
    for (const stage of SALES_STAGES) {
      await conn.query(
        `INSERT INTO pipeline_stages (tenantId, pipelineId, name, orderIndex, probabilityDefault, color, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [tenant.id, salesPipelineId, stage.name, stage.orderIndex, stage.probabilityDefault, stage.color]
      );
    }
    console.log(`  Created ${SALES_STAGES.length} sales stages`);
    
    // Create Post-Sale Pipeline
    const [postSaleResult] = await conn.query(
      `INSERT INTO pipelines (tenantId, name, description, color, pipelineType, isDefault, createdAt, updatedAt) 
       VALUES (?, 'Funil de Pós-Venda', 'Pipeline de acompanhamento pós-venda', '#22c55e', 'post_sale', 0, NOW(), NOW())`,
      [tenant.id]
    );
    const postSalePipelineId = postSaleResult.insertId;
    console.log(`  Created Post-Sale Pipeline: ${postSalePipelineId}`);
    
    // Create Post-Sale Stages
    let firstStageId = null;
    for (const stage of POST_SALE_STAGES) {
      const [stageResult] = await conn.query(
        `INSERT INTO pipeline_stages (tenantId, pipelineId, name, orderIndex, probabilityDefault, color, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [tenant.id, postSalePipelineId, stage.name, stage.orderIndex, stage.probabilityDefault, stage.color]
      );
      if (firstStageId === null) firstStageId = stageResult.insertId;
    }
    console.log(`  Created ${POST_SALE_STAGES.length} post-sale stages`);
    
    // Create automation: DealWon in Sales → Post-Sale
    await conn.query(
      `INSERT INTO pipeline_automations (tenantId, name, sourcePipelineId, triggerEvent, targetPipelineId, targetStageId, copyProducts, copyParticipants, copyCustomFields, isActive, createdAt, updatedAt) 
       VALUES (?, 'Venda Ganha → Pós-Venda', ?, 'deal_won', ?, ?, 1, 1, 1, 1, NOW(), NOW())`,
      [tenant.id, salesPipelineId, postSalePipelineId, firstStageId]
    );
    console.log(`  Created automation: DealWon → Post-Sale`);
  }
  
  await conn.end();
  console.log("\nDone!");
}

main().catch(console.error);
