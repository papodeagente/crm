import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log('[Migrate] No DATABASE_URL, skipping');
  process.exit(0);
}

console.log('[Migrate] Connecting to database...');
console.log('[Migrate] Host:', DATABASE_URL.replace(/\/\/.*@/, '//***@'));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const drizzleDir = path.resolve(__dirname, '..', 'drizzle');

const client = new pg.Client({ connectionString: DATABASE_URL });

async function migrate() {
  try {
    await client.connect();
    console.log('[Migrate] Connected successfully');
  } catch (err) {
    console.error('[Migrate] Connection failed:', err.message);
    throw err;
  }

  // Check if tables already exist
  const tableCheck = await client.query(`
    SELECT COUNT(*) as cnt FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  const existingTables = parseInt(tableCheck.rows[0].cnt);
  console.log('[Migrate] Existing tables:', existingTables);

  if (existingTables > 10) {
    console.log('[Migrate] Tables already exist, skipping migration');
    await client.end();
    return;
  }

  // Read migration SQL directly
  const sqlFile = path.join(drizzleDir, '0000_tough_kang.sql');
  if (!fs.existsSync(sqlFile)) {
    console.error('[Migrate] SQL file not found:', sqlFile);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlFile, 'utf8');
  const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  console.log(`[Migrate] Running ${statements.length} statements...`);

  let applied = 0;
  for (let i = 0; i < statements.length; i++) {
    try {
      await client.query(statements[i]);
      applied++;
      if (applied % 50 === 0) {
        console.log(`[Migrate] Progress: ${applied}/${statements.length}`);
      }
    } catch (err) {
      console.error(`[Migrate] Statement ${i + 1} FAILED: ${err.message}`);
      console.error(`[Migrate] SQL: ${statements[i].substring(0, 300)}`);
      // Skip "already exists" errors
      if (err.code === '42710' || err.code === '42P07') {
        console.log('[Migrate] Skipping (already exists)');
        applied++;
        continue;
      }
      throw err;
    }
  }

  console.log(`[Migrate] Done! Applied ${applied} statements`);
  await client.end();
}

migrate().catch(e => {
  console.error('[Migrate] FATAL:', e.message);
  process.exit(1);
});
