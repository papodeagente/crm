import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Tenants owned by Bruno
const [brunoTenants] = await conn.execute("SELECT id, name, plan, status FROM tenants WHERE ownerUserId = 1");
console.log("=== TENANTS OWNED BY BRUNO (userId=1) ===");
for (const t of brunoTenants) console.log(JSON.stringify(t));

// crm_users structure
const [crmCols] = await conn.execute("SHOW COLUMNS FROM crm_users");
console.log("\n=== CRM_USERS STRUCTURE ===");
for (const c of crmCols) console.log(`${c.Field}: ${c.Type}`);

// crm_users in test tenants
const [crmUsers] = await conn.execute("SELECT id, tenantId, name, email FROM crm_users WHERE tenantId IN (270006, 270007) LIMIT 5");
console.log("\n=== CRM USERS IN TEST TENANTS ===");
for (const u of crmUsers) console.log(JSON.stringify(u));

// user_roles structure
const [urCols] = await conn.execute("SHOW COLUMNS FROM user_roles");
console.log("\n=== USER_ROLES STRUCTURE ===");
for (const c of urCols) console.log(`${c.Field}: ${c.Type}`);

// Check if there's a superAdmin or isSuperAdmin column
const [superCheck] = await conn.execute("SELECT COLUMN_NAME, TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE (COLUMN_NAME LIKE '%super%' OR COLUMN_NAME LIKE '%Super%') AND TABLE_SCHEMA = DATABASE()");
console.log("\n=== SUPER ADMIN COLUMNS ===");
for (const s of superCheck) console.log(`${s.TABLE_NAME}.${s.COLUMN_NAME}`);

await conn.end();
