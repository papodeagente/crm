import mysql from 'mysql2/promise';
// Quick check after fix

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get all JIDs without pushName
const [noNames] = await conn.query('SELECT remoteJid FROM wa_conversations WHERE sessionId = "crm-210002-240001" AND (contactPushName IS NULL OR contactPushName = "")');
console.log('JIDs without name in DB:', noNames.length);

// Fetch contacts from Evolution API
const resp = await fetch('https://evo.entur.cloud/chat/findContacts/crm-210002-240001', {
  method: 'POST',
  headers: { 'apikey': 'WQMo37DNvuabEhxb8IG7q2340XGt8gu6', 'Content-Type': 'application/json' },
  body: '{}'
});
const contacts = await resp.json();

// Build contact name map
const contactMap = new Map();
for (const c of contacts) {
  if (c.remoteJid && c.pushName && c.pushName.trim() !== '') {
    contactMap.set(c.remoteJid, c.pushName);
  }
}
console.log('Contacts with pushName in Evolution:', contactMap.size);

let canFix = 0;
let cantFix = 0;
for (const row of noNames) {
  if (contactMap.has(row.remoteJid)) canFix++;
  else cantFix++;
}
console.log('Can fix from contacts:', canFix);
console.log('Cannot fix (no pushName anywhere):', cantFix);

// Also check chats for name or lastMessage.pushName
const resp2 = await fetch('https://evo.entur.cloud/chat/findChats/crm-210002-240001', {
  method: 'POST',
  headers: { 'apikey': 'WQMo37DNvuabEhxb8IG7q2340XGt8gu6', 'Content-Type': 'application/json' },
  body: '{}'
});
const chats = await resp2.json();

// Build chat name map from name field and lastMessage.pushName
const chatNameMap = new Map();
for (const c of chats) {
  if (c.remoteJid) {
    const name = c.name || c.pushName || (c.lastMessage && c.lastMessage.pushName);
    if (name && name.trim() !== '') {
      chatNameMap.set(c.remoteJid, name);
    }
  }
}

let canFixFromChats = 0;
for (const row of noNames) {
  if (contactMap.has(row.remoteJid)) continue; // already counted
  if (chatNameMap.has(row.remoteJid)) canFixFromChats++;
}
console.log('Can fix from chat name/lastMessage.pushName:', canFixFromChats);

// Check how the Inbox query returns names
const [inboxSample] = await conn.query(`
  SELECT c.remoteJid, c.contactPushName, c.lastMessageBody, c.updatedAt 
  FROM wa_conversations c 
  WHERE c.sessionId = "crm-210002-240001" 
  ORDER BY c.updatedAt DESC 
  LIMIT 10
`);
console.log('\nInbox sample (top 10 by updatedAt):');
for (const row of inboxSample) {
  console.log(`  ${row.remoteJid} -> name: "${row.contactPushName || 'NULL'}" | msg: "${(row.lastMessageBody || '').substring(0, 30)}"`);
}

// Check how many total conversations exist vs what Evolution API has
console.log('\nTotal chats in Evolution API:', chats.length);
const individualChats = chats.filter(c => c.remoteJid && c.remoteJid.endsWith('@s.whatsapp.net'));
console.log('Individual chats (non-group):', individualChats.length);

await conn.end();
