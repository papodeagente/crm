/**
 * Contact Deduplication & Merge Service
 * 
 * Responsibilities:
 * 1. Canonicalize contact identifiers (email lowercase, phone E.164)
 * 2. Find duplicate contacts by email, phone, or both
 * 3. Execute merge: move deals, tasks, conversion events to primary contact
 * 4. Snapshot before/after for audit and rollback
 * 5. Revert merge: restore secondary contact and reassign entities
 */

import { getDb } from "../db";
import {
  contacts,
  deals,
  tasks,
  contactConversionEvents,
  contactMerges,
  waConversations,
  crmNotes,
  type ContactMerge,
  type InsertContactMerge,
} from "../../drizzle/schema";
import { eq, and, or, ne, sql, inArray } from "drizzle-orm";

// ─── Canonicalization ────────────────────────────────────────

export function canonicalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function canonicalizePhone(phone: string): string {
  // Strip all non-digit chars
  const digits = phone.replace(/\D/g, "");
  // If starts with 55 and has 12-13 digits, it's Brazilian
  if (digits.startsWith("55") && digits.length >= 12) {
    return `+${digits}`;
  }
  // If 10-11 digits, assume Brazilian (add +55)
  if (digits.length >= 10 && digits.length <= 11) {
    return `+55${digits}`;
  }
  // Otherwise return with + prefix
  return digits.length > 0 ? `+${digits}` : "";
}

export function extractPhoneLast11(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 11 ? digits.slice(-11) : digits;
}

// ─── Duplicate Detection ─────────────────────────────────────

export interface DuplicateMatch {
  contactId: number;
  matchType: "email" | "phone" | "email_and_phone";
  matchedEmail?: string;
  matchedPhone?: string;
  confidence: "high" | "medium";
}

export async function findDuplicateContacts(
  tenantId: number,
  email?: string,
  phone?: string,
  excludeContactId?: number
): Promise<DuplicateMatch[]> {
  const db = await getDb();
  if (!db) return [];

  const canonEmail = email ? canonicalizeEmail(email) : undefined;
  const canonPhone = phone ? canonicalizePhone(phone) : undefined;
  const phoneLast11 = canonPhone ? extractPhoneLast11(canonPhone) : undefined;

  if (!canonEmail && !canonPhone) return [];

  const conditions: any[] = [];
  if (canonEmail) {
    conditions.push(eq(contacts.email, canonEmail));
  }
  if (canonPhone) {
    conditions.push(eq(contacts.phone, canonPhone));
    conditions.push(eq(contacts.phoneE164, canonPhone));
    if (phoneLast11) {
      conditions.push(eq(contacts.phoneLast11, phoneLast11));
    }
  }

  const baseWhere = excludeContactId
    ? and(eq(contacts.tenantId, tenantId), ne(contacts.id, excludeContactId), or(...conditions))
    : and(eq(contacts.tenantId, tenantId), or(...conditions));

  const matches = await db
    .select()
    .from(contacts)
    .where(baseWhere!)
    .limit(10);

  return matches.map((c) => {
    const emailMatch = canonEmail && c.email && canonicalizeEmail(c.email) === canonEmail;
    const phoneMatch = canonPhone && (
      (c.phone && canonicalizePhone(c.phone) === canonPhone) ||
      (c.phoneE164 && c.phoneE164 === canonPhone) ||
      (c.phoneLast11 && phoneLast11 && c.phoneLast11 === phoneLast11)
    );

    let matchType: "email" | "phone" | "email_and_phone";
    let confidence: "high" | "medium";

    if (emailMatch && phoneMatch) {
      matchType = "email_and_phone";
      confidence = "high";
    } else if (emailMatch) {
      matchType = "email";
      confidence = "high";
    } else {
      matchType = "phone";
      confidence = "medium";
    }

    return {
      contactId: c.id,
      matchType,
      matchedEmail: emailMatch ? c.email || undefined : undefined,
      matchedPhone: phoneMatch ? (c.phone || c.phoneE164 || undefined) : undefined,
      confidence,
    };
  });
}

// ─── Merge Execution ─────────────────────────────────────────

export interface MergeResult {
  mergeId: number;
  primaryContactId: number;
  secondaryContactId: number;
  movedDeals: number;
  movedTasks: number;
  movedConversions: number;
}

/**
 * Merge secondaryContactId INTO primaryContactId.
 * - Moves all deals, tasks, conversion events from secondary to primary
 * - Fills empty fields on primary from secondary
 * - Marks secondary as merged (soft-delete via lifecycle_stage = "merged")
 * - Creates audit record in contact_merges
 */
export async function mergeContacts(
  tenantId: number,
  primaryContactId: number,
  secondaryContactId: number,
  matchType: "lead_id" | "email" | "phone" | "email_and_phone" | "manual",
  createdBy: string = "system"
): Promise<MergeResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Fetch both contacts
  const [primary] = await db.select().from(contacts)
    .where(and(eq(contacts.id, primaryContactId), eq(contacts.tenantId, tenantId)));
  const [secondary] = await db.select().from(contacts)
    .where(and(eq(contacts.id, secondaryContactId), eq(contacts.tenantId, tenantId)));

  if (!primary) throw new Error(`Primary contact #${primaryContactId} not found`);
  if (!secondary) throw new Error(`Secondary contact #${secondaryContactId} not found`);

  // 2. Snapshot before merge
  const snapshotBefore = {
    primary: { ...primary },
    secondary: { ...secondary },
  };

  // 3. Move deals from secondary to primary
  const secondaryDeals = await db.select({ id: deals.id }).from(deals)
    .where(and(eq(deals.contactId, secondaryContactId), eq(deals.tenantId, tenantId)));
  const movedDealIds = secondaryDeals.map(d => d.id);

  if (movedDealIds.length > 0) {
    await db.update(deals)
      .set({ contactId: primaryContactId })
      .where(and(eq(deals.contactId, secondaryContactId), eq(deals.tenantId, tenantId)));
  }

  // 4. Move tasks from secondary to primary (tasks use entityType/entityId)
  const secondaryTasks = await db.select({ id: tasks.id }).from(tasks)
    .where(and(eq(tasks.entityType, "contact"), eq(tasks.entityId, secondaryContactId), eq(tasks.tenantId, tenantId)));
  const movedTaskIds = secondaryTasks.map(t => t.id);

  if (movedTaskIds.length > 0) {
    await db.update(tasks)
      .set({ entityId: primaryContactId })
      .where(and(eq(tasks.entityType, "contact"), eq(tasks.entityId, secondaryContactId), eq(tasks.tenantId, tenantId)));
  }

  // 5. Move conversion events from secondary to primary
  const secondaryConversions = await db.select({ id: contactConversionEvents.id }).from(contactConversionEvents)
    .where(and(eq(contactConversionEvents.contactId, secondaryContactId), eq(contactConversionEvents.tenantId, tenantId)));
  const movedConversionIds = secondaryConversions.map(c => c.id);

  if (movedConversionIds.length > 0) {
    await db.update(contactConversionEvents)
      .set({ contactId: primaryContactId })
      .where(and(eq(contactConversionEvents.contactId, secondaryContactId), eq(contactConversionEvents.tenantId, tenantId)));
  }

  // 5b. Move WhatsApp conversations from secondary to primary
  await db.update(waConversations)
    .set({ contactId: primaryContactId })
    .where(and(eq(waConversations.contactId, secondaryContactId), eq(waConversations.tenantId, tenantId)));

  // 5c. Move notes from secondary to primary
  await db.update(crmNotes)
    .set({ entityId: primaryContactId })
    .where(and(eq(crmNotes.entityType, "contact"), eq(crmNotes.entityId, secondaryContactId), eq(crmNotes.tenantId, tenantId)));

  // 6. Fill empty fields on primary from secondary
  const updates: Record<string, any> = {};
  if (!primary.email && secondary.email) updates.email = secondary.email;
  if (!primary.phone && secondary.phone) updates.phone = secondary.phone;
  if (!primary.phoneE164 && secondary.phoneE164) updates.phoneE164 = secondary.phoneE164;
  if (!primary.phoneDigits && secondary.phoneDigits) updates.phoneDigits = secondary.phoneDigits;
  if (!primary.phoneLast11 && secondary.phoneLast11) updates.phoneLast11 = secondary.phoneLast11;
  if ((!primary.name || primary.name === "Lead sem nome") && secondary.name) updates.name = secondary.name;

  // Merge tags
  const primaryTags = (primary.tagsJson as string[] | null) || [];
  const secondaryTags = (secondary.tagsJson as string[] | null) || [];
  const tagSet = new Set([...primaryTags, ...secondaryTags]);
  const mergedTags = Array.from(tagSet);
  if (mergedTags.length > primaryTags.length) {
    updates.tagsJson = mergedTags;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(contacts).set(updates).where(eq(contacts.id, primaryContactId));
  }

  // 7. Soft-delete secondary contact (mark as merged)
  await db.update(contacts).set({
    lifecycleStage: "merged" as any,
    mergedIntoContactId: primaryContactId,
    tagsJson: [...secondaryTags, `merged_into:${primaryContactId}`],
  }).where(eq(contacts.id, secondaryContactId));

  // 8. Fetch updated primary for snapshot after
  const [updatedPrimary] = await db.select().from(contacts).where(eq(contacts.id, primaryContactId));

  // 9. Build reason string
  const reason = matchType === "manual"
    ? `Merge manual pelo usuário ${createdBy}`
    : `Contatos unificados automaticamente por ${matchType === "email_and_phone" ? "email e telefone" : matchType}`;

  // 10. Create merge audit record
  const [mergeRecord] = await db.insert(contactMerges).values({
    tenantId,
    primaryContactId,
    secondaryContactId,
    reason,
    matchType,
    createdBy,
    status: matchType === "manual" ? "confirmed" : "pending_review",
    snapshotBeforeMerge: snapshotBefore,
    snapshotAfterMerge: updatedPrimary ? { ...updatedPrimary } : null,
    movedDealIds,
    movedTaskIds,
    movedConversionEventIds: movedConversionIds,
    reversible: true,
  }).returning({ id: contactMerges.id });

  return {
    mergeId: mergeRecord!.id,
    primaryContactId,
    secondaryContactId,
    movedDeals: movedDealIds.length,
    movedTasks: movedTaskIds.length,
    movedConversions: movedConversionIds.length,
  };
}

// ─── Merge Revert ────────────────────────────────────────────

export async function revertMerge(
  tenantId: number,
  mergeId: number,
  revertedBy: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  // 1. Get merge record
  const [merge] = await db.select().from(contactMerges)
    .where(and(eq(contactMerges.id, mergeId), eq(contactMerges.tenantId, tenantId)));

  if (!merge) return { success: false, error: "Merge record not found" };
  if (merge.status === "reverted") return { success: false, error: "Merge already reverted" };
  if (!merge.reversible) return { success: false, error: "Merge is not reversible" };

  const snapshot = merge.snapshotBeforeMerge as any;
  if (!snapshot?.primary || !snapshot?.secondary) {
    return { success: false, error: "Snapshot data missing, cannot revert" };
  }

  const secondaryContactId = merge.secondaryContactId;
  const primaryContactId = merge.primaryContactId;

  // 2. Restore secondary contact from snapshot
  const secondarySnapshot = snapshot.secondary;
  await db.update(contacts).set({
    name: secondarySnapshot.name,
    email: secondarySnapshot.email,
    phone: secondarySnapshot.phone,
    phoneE164: secondarySnapshot.phoneE164,
    phoneDigits: secondarySnapshot.phoneDigits,
    phoneLast11: secondarySnapshot.phoneLast11,
    lifecycleStage: secondarySnapshot.lifecycleStage || "lead",
    mergedIntoContactId: null,
    tagsJson: secondarySnapshot.tagsJson,
    source: secondarySnapshot.source,
  }).where(eq(contacts.id, secondaryContactId));

  // 3. Restore primary contact from snapshot
  const primarySnapshot = snapshot.primary;
  await db.update(contacts).set({
    name: primarySnapshot.name,
    email: primarySnapshot.email,
    phone: primarySnapshot.phone,
    phoneE164: primarySnapshot.phoneE164,
    phoneDigits: primarySnapshot.phoneDigits,
    phoneLast11: primarySnapshot.phoneLast11,
    tagsJson: primarySnapshot.tagsJson,
  }).where(eq(contacts.id, primaryContactId));

  // 4. Move deals back to secondary
  const movedDealIds = (merge.movedDealIds as number[]) || [];
  if (movedDealIds.length > 0) {
    await db.update(deals)
      .set({ contactId: secondaryContactId })
      .where(and(
        inArray(deals.id, movedDealIds),
        eq(deals.tenantId, tenantId)
      ));
  }

  // 5. Move tasks back to secondary
  const movedTaskIds = (merge.movedTaskIds as number[]) || [];
  if (movedTaskIds.length > 0) {
    await db.update(tasks)
      .set({ entityId: secondaryContactId })
      .where(and(
        inArray(tasks.id, movedTaskIds),
        eq(tasks.tenantId, tenantId)
      ));
  }

  // 6. Move conversion events back to secondary
  const movedConversionIds = (merge.movedConversionEventIds as number[]) || [];
  if (movedConversionIds.length > 0) {
    await db.update(contactConversionEvents)
      .set({ contactId: secondaryContactId })
      .where(and(
        inArray(contactConversionEvents.id, movedConversionIds),
        eq(contactConversionEvents.tenantId, tenantId)
      ));
  }

  // 7. Update merge record
  await db.update(contactMerges).set({
    status: "reverted",
    revertedAt: new Date(),
    revertedBy,
  }).where(eq(contactMerges.id, mergeId));

  return { success: true };
}

// ─── Confirm Merge ───────────────────────────────────────────

export async function confirmMerge(
  tenantId: number,
  mergeId: number,
  confirmedBy: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  const [merge] = await db.select().from(contactMerges)
    .where(and(eq(contactMerges.id, mergeId), eq(contactMerges.tenantId, tenantId)));

  if (!merge) return { success: false, error: "Merge record not found" };
  if (merge.status === "confirmed") return { success: false, error: "Already confirmed" };
  if (merge.status === "reverted") return { success: false, error: "Cannot confirm a reverted merge" };

  await db.update(contactMerges).set({
    status: "confirmed",
    confirmedAt: new Date(),
    confirmedBy,
    reversible: false,
  }).where(eq(contactMerges.id, mergeId));

  return { success: true };
}

// ─── Record Conversion Event ─────────────────────────────────

export interface ConversionEventData {
  tenantId: number;
  contactId: number;
  integrationSource: string;
  externalLeadId?: string;
  eventType?: string;
  conversionIdentifier?: string;
  conversionName?: string;
  assetName?: string;
  assetType?: string;
  trafficSource?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  formName?: string;
  landingPage?: string;
  rawPayload?: any;
  dedupeMatchType: "lead_id" | "email" | "phone" | "email_and_phone" | "manual_merge" | "new_contact";
  matchedExistingContactId?: number;
  dealId?: number;
  dealDecision?: string;
  dealDecisionReason?: string;
  idempotencyKey: string;
}

export async function recordConversionEvent(data: ConversionEventData): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // Check idempotency
  const [existing] = await db.select({ id: contactConversionEvents.id })
    .from(contactConversionEvents)
    .where(eq(contactConversionEvents.idempotencyKey, data.idempotencyKey))
    .limit(1);

  if (existing) return existing.id;

  const [result] = await db.insert(contactConversionEvents).values({
    tenantId: data.tenantId,
    contactId: data.contactId,
    integrationSource: data.integrationSource,
    externalLeadId: data.externalLeadId,
    eventType: data.eventType || "conversion",
    conversionIdentifier: data.conversionIdentifier,
    conversionName: data.conversionName,
    assetName: data.assetName,
    assetType: data.assetType,
    trafficSource: data.trafficSource,
    utmSource: data.utmSource,
    utmMedium: data.utmMedium,
    utmCampaign: data.utmCampaign,
    utmContent: data.utmContent,
    utmTerm: data.utmTerm,
    formName: data.formName,
    landingPage: data.landingPage,
    rawPayload: data.rawPayload,
    dedupeMatchType: data.dedupeMatchType,
    matchedExistingContactId: data.matchedExistingContactId,
    dealId: data.dealId,
    dealDecision: data.dealDecision,
    dealDecisionReason: data.dealDecisionReason,
    idempotencyKey: data.idempotencyKey,
  }).returning({ id: contactConversionEvents.id });

  return result?.id || null;
}

// ─── Get Conversion History ──────────────────────────────────

export async function getConversionHistory(tenantId: number, contactId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(contactConversionEvents)
    .where(and(
      eq(contactConversionEvents.tenantId, tenantId),
      eq(contactConversionEvents.contactId, contactId)
    ))
    .orderBy(sql`${contactConversionEvents.receivedAt} DESC`)
    .limit(100);
}

// ─── Get Merge History ───────────────────────────────────────

export async function getMergeHistory(tenantId: number, contactId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(contactMerges)
    .where(and(
      eq(contactMerges.tenantId, tenantId),
      or(
        eq(contactMerges.primaryContactId, contactId),
        eq(contactMerges.secondaryContactId, contactId)
      )
    ))
    .orderBy(sql`${contactMerges.createdAt} DESC`)
    .limit(50);
}

// ─── Get Pending Merges for Tenant ───────────────────────────

export async function getPendingMerges(tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(contactMerges)
    .where(and(
      eq(contactMerges.tenantId, tenantId),
      eq(contactMerges.status, "pending_review")
    ))
    .orderBy(sql`${contactMerges.createdAt} DESC`)
    .limit(50);
}
