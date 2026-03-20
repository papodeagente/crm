import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [total] = await conn.query('SELECT COUNT(*) as cnt FROM wa_conversations WHERE sessionId = "crm-210002-240001"');
const [withName] = await conn.query('SELECT COUNT(*) as cnt FROM wa_conversations WHERE sessionId = "crm-210002-240001" AND contactPushName IS NOT NULL AND contactPushName != ""');
const [withoutName] = await conn.query('SELECT COUNT(*) as cnt FROM wa_conversations WHERE sessionId = "crm-210002-240001" AND (contactPushName IS NULL OR contactPushName = "")');

console.log('Total conversations:', total[0].cnt);
console.log('With name:', withName[0].cnt);
console.log('Without name:', withoutName[0].cnt);

// Sample top 10 conversations
const [sample] = await conn.query('SELECT remoteJid, contactPushName FROM wa_conversations WHERE sessionId = "crm-210002-240001" ORDER BY updatedAt DESC LIMIT 10');
console.log('\nTop 10 conversations:');
for (const row of sample) {
  const phone = row.remoteJid.replace('@s.whatsapp.net', '');
  console.log(`  ${phone} -> ${row.contactPushName || 'SEM NOME'}`);
}

await conn.end();
