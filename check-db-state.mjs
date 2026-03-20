import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const queries = [
  ["Pipelines (tenant 1)", "SELECT name, COUNT(*) as cnt FROM pipelines WHERE tenantId = 1 GROUP BY name ORDER BY cnt DESC LIMIT 10"],
  ["Contacts total", "SELECT COUNT(*) as total FROM contacts WHERE tenantId = 1 AND deletedAt IS NULL"],
  ["Contacts with email duplicates", "SELECT email, COUNT(*) as cnt FROM contacts WHERE tenantId = 1 AND deletedAt IS NULL AND email IS NOT NULL AND email != '' GROUP BY email HAVING cnt > 1 LIMIT 5"],
  ["Deals total", "SELECT COUNT(*) as total FROM deals WHERE tenantId = 1 AND deletedAt IS NULL"],
  ["Deals without contact", "SELECT COUNT(*) as total FROM deals WHERE tenantId = 1 AND deletedAt IS NULL AND contactId IS NULL"],
  ["Accounts total", "SELECT COUNT(*) as total FROM accounts WHERE tenantId = 1"],
  ["CRM Users", "SELECT COUNT(*) as total FROM crm_users WHERE tenantId = 1"],
  ["Tasks total", "SELECT COUNT(*) as total FROM crm_tasks WHERE tenantId = 1"],
  ["rdExternalId column exists?", "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'contacts' AND COLUMN_NAME = 'rdExternalId'"],
];

for (const [label, q] of queries) {
  try {
    const [rows] = await conn.execute(q);
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.log(`\n=== ${label} === ERROR: ${e.message}`);
  }
}

await conn.end();
