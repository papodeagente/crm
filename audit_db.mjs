import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
const pool = mysql.createPool(DATABASE_URL);
const db = drizzle(pool);

async function main() {
  // 1. Total messages
  const [r1] = await db.execute(sql`SELECT COUNT(*) as cnt FROM messages`);
  console.log("Total messages:", r1[0]?.cnt);

  // 2. Total conversations
  const [r2] = await db.execute(sql`SELECT COUNT(*) as cnt FROM wa_conversations`);
  console.log("Total conversations:", r2[0]?.cnt);

  // 3. Distinct sessions
  const [r3] = await db.execute(sql`SELECT COUNT(DISTINCT sessionId) as cnt FROM messages`);
  console.log("Distinct sessions:", r3[0]?.cnt);

  // 4. Table stats
  const [r4] = await db.execute(sql`SHOW TABLE STATUS LIKE 'messages'`);
  const row = r4[0];
  console.log(`\nMessages table stats:`);
  console.log(`  Data size: ${(Number(row?.Data_length) / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Index size: ${(Number(row?.Index_length) / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Estimated rows: ${row?.Rows}`);
  console.log(`  Avg row length: ${row?.Avg_row_length} bytes`);

  // 5. Messages indexes
  const [r5] = await db.execute(sql`SHOW INDEX FROM messages`);
  console.log("\nMessages indexes:");
  r5.forEach(i => console.log(`  ${i.Key_name}: (${i.Column_name}) Seq=${i.Seq_in_index} Cardinality=${i.Cardinality} Null=${i.Null}`));

  // 6. WA Conversations indexes
  const [r6] = await db.execute(sql`SHOW INDEX FROM wa_conversations`);
  console.log("\nWA Conversations indexes:");
  r6.forEach(i => console.log(`  ${i.Key_name}: (${i.Column_name}) Seq=${i.Seq_in_index} Cardinality=${i.Cardinality}`));

  // 7. Messages per session distribution
  const [r7] = await db.execute(sql`
    SELECT sessionId, COUNT(*) as cnt 
    FROM messages 
    GROUP BY sessionId 
    ORDER BY cnt DESC 
    LIMIT 10
  `);
  console.log("\nTop 10 sessions by message count:");
  r7.forEach(r => console.log(`  ${r.sessionId}: ${r.cnt} messages`));

  // 8. Messages per month (growth trend)
  const [r8] = await db.execute(sql`
    SELECT DATE_FORMAT(timestamp, '%Y-%m') as month, COUNT(*) as cnt 
    FROM messages 
    GROUP BY month 
    ORDER BY month DESC 
    LIMIT 12
  `);
  console.log("\nMessages per month (last 12):");
  r8.forEach(r => console.log(`  ${r.month}: ${r.cnt}`));

  // 9. Check for slow query patterns - conversations with most messages
  const [r9] = await db.execute(sql`
    SELECT remoteJid, sessionId, COUNT(*) as cnt 
    FROM messages 
    GROUP BY remoteJid, sessionId 
    ORDER BY cnt DESC 
    LIMIT 10
  `);
  console.log("\nTop 10 conversations by message count:");
  r9.forEach(r => console.log(`  ${r.sessionId}/${r.remoteJid}: ${r.cnt} messages`));

  // 10. Check all tables with tenantId and their sizes
  const [r10] = await db.execute(sql`
    SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY DATA_LENGTH DESC
    LIMIT 20
  `);
  console.log("\nTop 20 tables by size:");
  r10.forEach(r => console.log(`  ${r.TABLE_NAME}: ${r.TABLE_ROWS} rows, ${(Number(r.DATA_LENGTH) / 1024 / 1024).toFixed(2)} MB data, ${(Number(r.INDEX_LENGTH) / 1024 / 1024).toFixed(2)} MB index`));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
