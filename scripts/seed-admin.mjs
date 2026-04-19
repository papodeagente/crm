import pg from 'pg';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log('[Seed] No DATABASE_URL, skipping');
  process.exit(0);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

async function seed() {
  await client.connect();

  // Check if super admin already exists
  const existing = await client.query("SELECT id FROM crm_users WHERE email = $1", ['bruno@entur.com.br']);
  if (existing.rows.length > 0) {
    console.log('[Seed] Super admin already exists, skipping');
    await client.end();
    return;
  }

  // Create tenant
  const trialDays = 365;
  const trialExpiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

  const tenantRes = await client.query(`
    INSERT INTO tenants (name, slug, plan, status, "billingStatus", "isLegacy", "hotmartEmail", "freemiumDays", "freemiumExpiresAt", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    RETURNING id
  `, ['Entur', 'entur', 'scale', 'active', 'active', false, 'bruno@entur.com.br', trialDays, trialExpiresAt]);

  const tenantId = tenantRes.rows[0].id;
  console.log('[Seed] Tenant created:', tenantId);

  // Hash password
  const passwordHash = await bcrypt.hash('Bruna2016*', 12);

  // Create super admin user
  const userRes = await client.query(`
    INSERT INTO crm_users ("tenantId", name, email, "passwordHash", role, status, "isSuperAdmin", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    RETURNING id
  `, [tenantId, 'Bruno Barbosa', 'bruno@entur.com.br', passwordHash, 'admin', 'active', true]);

  const userId = userRes.rows[0].id;
  console.log('[Seed] Super admin created:', userId);

  // Update tenant owner
  await client.query('UPDATE tenants SET "ownerUserId" = $1 WHERE id = $2', [userId, tenantId]);

  // Create subscription
  await client.query(`
    INSERT INTO subscriptions ("tenantId", provider, plan, status, "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, NOW(), NOW())
  `, [tenantId, 'hotmart', 'scale', 'active']);

  console.log('[Seed] Super admin setup complete! Email: bruno@entur.com.br');
  await client.end();
}

seed().catch(e => {
  console.error('[Seed] Error:', e.message);
  process.exit(0); // Don't crash the app
});
