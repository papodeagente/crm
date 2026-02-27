import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // 1. Check conversation_assignments for duplicates
  console.log('=== CONVERSATION ASSIGNMENTS ===');
  const [assignments] = await conn.execute('SELECT id, tenantId, sessionId, remoteJid, assignedUserId, status, createdAt FROM conversation_assignments ORDER BY remoteJid');
  assignments.forEach(r => console.log(r.id, '|', r.remoteJid, '|', r.assignedUserId, '|', r.status));
  console.log('Total assignments:', assignments.length);
  
  // 2. Find duplicate JIDs in assignments (same number, different format)
  console.log('\n=== DUPLICATE ASSIGNMENTS (same phone, different JID) ===');
  const jidMap = {};
  for (const a of assignments) {
    const phone = a.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    if (!jidMap[phone]) jidMap[phone] = [];
    jidMap[phone].push(a);
  }
  for (const [phone, items] of Object.entries(jidMap)) {
    if (items.length > 1) {
      console.log('Phone:', phone, '- Assignments:', items.length);
      items.forEach(a => console.log('  ', a.id, a.remoteJid, a.status));
    }
  }
  
  // 3. Check for JIDs with 13 digits (with 9) vs 12 digits (without 9)
  console.log('\n=== JID FORMAT ANALYSIS ===');
  const [jids] = await conn.execute("SELECT DISTINCT remoteJid FROM messages WHERE remoteJid LIKE '%@s.whatsapp.net'");
  const with9 = [];
  const without9 = [];
  for (const r of jids) {
    const phone = r.remoteJid.replace('@s.whatsapp.net', '');
    if (phone.startsWith('55') && phone.length === 13) {
      with9.push({ jid: r.remoteJid, phone });
    } else if (phone.startsWith('55') && phone.length === 12) {
      without9.push({ jid: r.remoteJid, phone });
    }
  }
  console.log('JIDs with 13 digits (with 9):', with9.length);
  with9.forEach(j => console.log('  ', j.jid));
  console.log('JIDs with 12 digits (without 9):', without9.length);
  
  // 4. Check groups in messages
  const [groups] = await conn.execute("SELECT DISTINCT remoteJid FROM messages WHERE remoteJid LIKE '%@g.us'");
  console.log('\n=== GROUPS IN MESSAGES ===');
  console.log('Total groups:', groups.length);
  groups.forEach(g => console.log('  ', g.remoteJid));
  
  // 5. Check groups in conversation_assignments
  const [groupAssignments] = await conn.execute("SELECT * FROM conversation_assignments WHERE remoteJid LIKE '%@g.us'");
  console.log('\n=== GROUPS IN ASSIGNMENTS ===');
  console.log('Total group assignments:', groupAssignments.length);
  groupAssignments.forEach(g => console.log('  ', g.id, g.remoteJid, g.status));
  
  // 6. Check total messages count
  const [totalMsgs] = await conn.execute('SELECT COUNT(*) as cnt FROM messages');
  console.log('\n=== TOTAL MESSAGES ===');
  console.log('Total:', totalMsgs[0].cnt);
  
  // 7. Check the specific problematic number mentioned by user
  console.log('\n=== SPECIFIC: 5584999838420 ===');
  const [specific] = await conn.execute("SELECT remoteJid, COUNT(*) as cnt, fromMe FROM messages WHERE remoteJid LIKE '%99838420%' GROUP BY remoteJid, fromMe");
  specific.forEach(r => console.log(r.remoteJid, '| fromMe:', r.fromMe, '| count:', r.cnt));
  
  await conn.end();
}

main().catch(console.error);
