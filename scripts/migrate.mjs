import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log('[Migrate] No DATABASE_URL, skipping');
  process.exit(0);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const drizzleDir = path.resolve(__dirname, '..', 'drizzle');

const client = new pg.Client({ connectionString: DATABASE_URL });

async function migrate() {
  await client.connect();

  // Create drizzle migrations tracking table if not exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT
    )
  `);

  // Get already applied migrations
  const applied = await client.query('SELECT hash FROM "__drizzle_migrations"');
  const appliedHashes = new Set(applied.rows.map(r => r.hash));

  // Read migration files
  const metaDir = path.join(drizzleDir, 'meta');
  const journalPath = path.join(metaDir, '_journal.json');

  if (!fs.existsSync(journalPath)) {
    console.log('[Migrate] No journal found, skipping');
    await client.end();
    return;
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));

  for (const entry of journal.entries) {
    const hash = entry.tag;
    if (appliedHashes.has(hash)) {
      console.log(`[Migrate] Already applied: ${hash}`);
      continue;
    }

    const sqlFile = path.join(drizzleDir, `${hash}.sql`);
    if (!fs.existsSync(sqlFile)) {
      console.error(`[Migrate] SQL file not found: ${sqlFile}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');
    // Split by drizzle statement breakpoint
    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

    console.log(`[Migrate] Applying: ${hash} (${statements.length} statements)`);

    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
      } catch (err) {
        console.error(`[Migrate] Statement ${i + 1}/${statements.length} failed:`, err.message);
        console.error(`[Migrate] SQL:`, statements[i].substring(0, 200));
        throw err;
      }
    }

    await client.query(
      'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
      [hash, Date.now()]
    );

    console.log(`[Migrate] Applied: ${hash}`);
  }

  console.log('[Migrate] All migrations applied');
  await client.end();
}

migrate().catch(e => {
  console.error('[Migrate] Error:', e.message);
  console.error('[Migrate] Stack:', e.stack);
  process.exit(1);
});
