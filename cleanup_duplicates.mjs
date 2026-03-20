import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Try to read DATABASE_URL from .env file
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  try {
    const envPath = resolve(process.cwd(), '.env');
    const envContent = readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) dbUrl = match[1].trim();
  } catch {}
}

// Try .env.local
if (!dbUrl) {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const envContent = readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) dbUrl = match[1].trim();
  } catch {}
}

if (!dbUrl) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection(dbUrl);
  
  // Count duplicates
  const [dupCount] = await conn.execute(
    `SELECT COUNT(*) as cnt FROM (
      SELECT messageId, sessionId FROM messages 
      WHERE messageId IS NOT NULL 
      GROUP BY messageId, sessionId 
      HAVING COUNT(*) > 1
    ) t`
  );
  console.log("Duplicate groups:", dupCount[0].cnt);

  // Find IDs to delete (keep the one with lowest id)
  const [dupeIds] = await conn.execute(
    `SELECT m2.id
    FROM messages m1
    JOIN messages m2 
      ON m1.messageId = m2.messageId 
      AND m1.sessionId = m2.sessionId 
      AND m1.id < m2.id
    WHERE m1.messageId IS NOT NULL`
  );
  
  console.log("Duplicate rows to delete:", dupeIds.length);
  
  if (dupeIds.length === 0) {
    console.log("No duplicates found!");
    await conn.end();
    return;
  }

  // Delete in batches of 500
  const ids = dupeIds.map(r => r.id);
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500);
    const placeholders = batch.map(() => '?').join(',');
    await conn.execute(`DELETE FROM messages WHERE id IN (${placeholders})`, batch);
    deleted += batch.length;
    console.log(`Deleted ${deleted}/${ids.length}`);
  }
  
  console.log(`Done! Deleted ${deleted} duplicate messages.`);
  
  // Verify
  const [remaining] = await conn.execute(
    `SELECT COUNT(*) as cnt FROM (
      SELECT messageId, sessionId FROM messages 
      WHERE messageId IS NOT NULL 
      GROUP BY messageId, sessionId 
      HAVING COUNT(*) > 1
    ) t`
  );
  console.log("Remaining duplicate groups:", remaining[0].cnt);
  
  const [total] = await conn.execute(`SELECT COUNT(*) as cnt FROM messages`);
  console.log("Total messages remaining:", total[0].cnt);
  
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
