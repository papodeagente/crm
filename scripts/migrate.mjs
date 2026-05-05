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

const drizzleDir = path.resolve(process.cwd(), 'drizzle');
const client = new pg.Client({ connectionString: DATABASE_URL });

async function migrate() {
  try {
    await client.connect();
    console.log('[Migrate] Connected successfully');
  } catch (err) {
    console.error('[Migrate] Connection failed:', err.message);
    throw err;
  }

  // Always scan all SQL files (sorted). Migrations são idempotentes (CREATE TABLE
  // IF NOT EXISTS, ADD COLUMN IF NOT EXISTS) e os erros "já existe" são tolerados
  // pelos códigos 42710/42P07/42701 abaixo. O journal foi removido como fonte da
  // verdade porque entries fora do journal (aplicadas manualmente) eram puladas
  // no startup, deixando o schema do código fora de sincronia com o banco.
  const migrationFiles = fs.readdirSync(drizzleDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`[Migrate] Found ${migrationFiles.length} migration files`);

  let totalApplied = 0;
  let totalSkipped = 0;

  for (const sqlFileName of migrationFiles) {
    const sqlFile = path.join(drizzleDir, sqlFileName);
    if (!fs.existsSync(sqlFile)) {
      console.log(`[Migrate] SKIP: ${sqlFileName} not found`);
      continue;
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');
    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
    console.log(`[Migrate] ${sqlFileName}: ${statements.length} statements`);

    let applied = 0;
    let skipped = 0;
    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
        applied++;
      } catch (err) {
        // Skip "already exists" errors
        if (err.code === '42710' || err.code === '42P07' || err.code === '42701') {
          skipped++;
          continue;
        }
        console.error(`[Migrate] ${sqlFileName} stmt ${i + 1} FAILED: ${err.message}`);
        console.error(`[Migrate] SQL: ${statements[i].substring(0, 300)}`);
        throw err;
      }
    }

    totalApplied += applied;
    totalSkipped += skipped;
    console.log(`[Migrate] ${sqlFileName}: ${applied} applied, ${skipped} skipped`);
  }

  console.log(`[Migrate] Done! Total: ${totalApplied} applied, ${totalSkipped} skipped`);
  await client.end();
}

migrate().catch(e => {
  console.error('[Migrate] FATAL:', e.message);
  process.exit(1);
});
