/**
 * Deal Message Link Service
 *
 * Auto-links WhatsApp messages to open deals for the same contact.
 * This ensures deal conversation history is immutable and preserved
 * even if messages are deleted from the inbox or sessions are disconnected.
 */
import { eq, and, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { deals, contacts, dealMessageLinks, waMessages } from "../../drizzle/schema";
import { getAllJidVariants } from "../phoneUtils";

/**
 * Link a newly inserted message to all open deals for the matching contact.
 * Called fire-and-forget after message insertion — should not block message processing.
 */
export async function linkMessageToDeals(tenantId: number, messageDbId: number, remoteJid: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // Find contacts matching this JID
    const jidVariants = getAllJidVariants(remoteJid);
    const phoneLast11Values = jidVariants
      .map(j => j.replace(/@.*$/, ""))
      .map(d => d.length >= 11 ? d.slice(-11) : d)
      .filter(d => d.length >= 10);

    if (!phoneLast11Values.length) return;

    // Find open deals for contacts with matching phone
    const openDeals = await db.select({ dealId: deals.id })
      .from(deals)
      .innerJoin(contacts, eq(contacts.id, deals.contactId))
      .where(and(
        eq(deals.tenantId, tenantId),
        eq(deals.status, "open"),
        inArray(contacts.phoneLast11, phoneLast11Values),
      ));

    if (!openDeals.length) return;

    // Insert links (ignore conflicts for idempotency)
    for (const { dealId } of openDeals) {
      await db.insert(dealMessageLinks).values({
        tenantId,
        dealId,
        messageDbId,
        linkedBy: "auto",
      }).onConflictDoNothing();
    }
  } catch (err) {
    // Fire-and-forget: log but don't throw
    console.error("[DealMessageLink] Error linking message:", (err as Error).message);
  }
}

/**
 * Backfill deal_message_links for existing deals.
 * Finds all messages matching each deal's contact phone and creates links.
 */
export async function backfillDealMessageLinks(tenantId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Get all open deals with contacts that have phones
  const dealContacts = await db.select({
    dealId: deals.id,
    phone: contacts.phone,
  })
    .from(deals)
    .innerJoin(contacts, eq(contacts.id, deals.contactId))
    .where(and(
      eq(deals.tenantId, tenantId),
      eq(deals.status, "open"),
      sql`${contacts.phone} IS NOT NULL AND ${contacts.phone} != ''`,
    ));

  let totalLinked = 0;

  for (const { dealId, phone } of dealContacts) {
    if (!phone) continue;
    const jidVariants = getAllJidVariants(phone);

    // Get message IDs for this contact
    const msgs = await db.select({ id: waMessages.id })
      .from(waMessages)
      .where(and(
        eq(waMessages.tenantId, tenantId),
        jidVariants.length === 1
          ? eq(waMessages.remoteJid, jidVariants[0])
          : inArray(waMessages.remoteJid, jidVariants),
      ));

    if (!msgs.length) continue;

    // Batch insert links
    const values = msgs.map(m => ({
      tenantId,
      dealId,
      messageDbId: m.id,
      linkedBy: "backfill" as const,
    }));

    // Insert in batches of 500
    for (let i = 0; i < values.length; i += 500) {
      const batch = values.slice(i, i + 500);
      await db.insert(dealMessageLinks).values(batch).onConflictDoNothing();
      totalLinked += batch.length;
    }
  }

  return totalLinked;
}
