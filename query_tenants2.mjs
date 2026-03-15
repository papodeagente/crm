import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check users with tenantId
const [brunoTenants] = await conn.execute("SELECT id, name, email, role, tenantId FROM users WHERE email = 'bruno@entur.com.br'");
console.log("=== BRUNO USER ===");
for (const u of brunoTenants) {
  console.log(`ID: ${u.id} | Name: ${u.name} | Email: ${u.email} | Role: ${u.role} | TenantId: ${u.tenantId}`);
}

// Check all tables that reference tenantId
const [tables] = await conn.execute("SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME = 'tenantId' AND TABLE_SCHEMA = DATABASE()");
console.log("\n=== TABLES WITH tenantId ===");
for (const t of tables) {
  console.log(`Table: ${t.TABLE_NAME}`);
}

// Count data per tenant for Teste Turismo (270006) and Teste 2 (270007)
for (const tenantId of [270006, 270007]) {
  console.log(`\n=== DATA FOR TENANT ${tenantId} ===`);
  for (const t of tables) {
    try {
      const [rows] = await conn.execute(`SELECT COUNT(*) as cnt FROM \`${t.TABLE_NAME}\` WHERE tenantId = ?`, [tenantId]);
      if (rows[0].cnt > 0) {
        console.log(`  ${t.TABLE_NAME}: ${rows[0].cnt} rows`);
      }
    } catch(e) { /* skip */ }
  }
}

// Check users table schema
const [schema] = await conn.execute("SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND TABLE_SCHEMA = DATABASE()");
console.log("\n=== FULL USERS SCHEMA ===");
for (const c of schema) {
  console.log(`${c.COLUMN_NAME}: ${c.COLUMN_TYPE}`);
}

// Check tenants table schema
const [tSchema] = await conn.execute("SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tenants' AND TABLE_SCHEMA = DATABASE()");
console.log("\n=== FULL TENANTS SCHEMA ===");
for (const c of tSchema) {
  console.log(`${c.COLUMN_NAME}: ${c.COLUMN_TYPE}`);
}

await conn.end();
