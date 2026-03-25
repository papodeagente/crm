/**
 * Lead Processor — Idempotent inbound lead processing with cross-source deduplication.
 *
 * Handles leads from:
 *   - Landing Page webhooks (source = "landing")
 *   - Meta Lead Ads (source = "meta_lead_ads")
 *   - RD Station Marketing (source = "rdstation")
 *   - WordPress/Elementor (source = "wordpress")
 *   - Any future source
 *
 * Flow:
 *   1. Normalize payload (phone E164, email lower, trim)
 *   2. Generate dedupe_key = source + (lead_id || sha256(email+phone))
 *   3. Check EventLog for existing success → return existing deal_id
 *   4. Cross-source dedup: find existing contact by email OR phone (any source)
 *   5. If duplicate found → merge contacts if needed, link to existing contact
 *   6. Upsert Contact (create or update empty fields)
 *   7. Create Deal in default pipeline, stage "Novo lead"
 *   8. Record conversion event in contact_conversion_events
 *   9. Log success in EventLog
 *  10. On error → log failure in EventLog
 */

import { getDb, createNotification } from "./db";
import { createDeal } from "./crmDb";
import { createHash } from "crypto";
import {
  contacts, deals, pipelines, pipelineStages,
  leadEventLog, crmUsers,
} from "../drizzle/schema";
import { eq, and, or, sql, asc, lt, ne } from "drizzle-orm";
import { normalizeBrazilianPhone } from "./phoneUtils";
import {
  findDuplicateContacts,
  mergeContacts,
  recordConversionEvent,
  canonicalizeEmail,
  canonicalizePhone,
  extractPhoneLast11,
} from "./services/contactDedup";

// ─── Types ───────────────────────────────────────────────

export interface InboundLeadPayload {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  source: string;
  lead_id?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
  rdCustomFields?: Record<string, string>;
  meta?: Record<string, any>;
  raw?: Record<string, any>;
  /** RD Station conversion data */
  conversionIdentifier?: string;
  conversionName?: string;
  assetName?: string;
  assetType?: string;
  formName?: string;
  landingPage?: string;
  trafficSource?: string;
}

export interface ProcessResult {
  success: boolean;
  dealId?: number;
  contactId?: number;
  dedupeKey: string;
  isExisting: boolean;
  mergePerformed?: boolean;
  mergeId?: number;
  conversionEventId?: number;
  error?: string;
}

// ─── Normalization ───────────────────────────────────────

function normalizeEmail(email?: string): string | undefined {
  if (!email) return undefined;
  return email.trim().toLowerCase().replace(/\s+/g, "");
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (!digits || digits.length < 8) return undefined;
  const normalized = normalizeBrazilianPhone(digits);
  return normalized ? `+${normalized}` : undefined;
}

function normalizeName(name?: string): string {
  if (!name) return "Lead sem nome";
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function generateDedupeKey(source: string, payload: InboundLeadPayload): string {
  if (payload.lead_id) {
    return `${source}:${payload.lead_id}`;
  }
  const email = normalizeEmail(payload.email) || "";
  const phone = normalizePhone(payload.phone) || "";
  const hash = createHash("sha256").update(`${email}|${phone}`).digest("hex").substring(0, 16);
  return `${source}:${hash}`;
}

/**
 * Generate idempotency key for conversion events.
 * Uses tenant_id + source + lead_id + event_type + conversion_identifier + timestamp (day-level).
 */
function generateConversionIdempotencyKey(
  tenantId: number,
  source: string,
  leadId?: string,
  email?: string,
  phone?: string,
  conversionIdentifier?: string,
): string {
  const parts = [
    String(tenantId),
    source,
    leadId || "",
    email || "",
    phone || "",
    conversionIdentifier || "",
  ];
  const hash = createHash("sha256").update(parts.join("|")).digest("hex").substring(0, 24);
  return `conv:${hash}`;
}

// ─── Round-Robin Owner Assignment ────────────────────────

let lastAssignedIndex = 0;

async function getNextOwner(tenantId: number): Promise<number | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  // Get all active CRM users for this tenant, ordered by id
  const users = await db
    .select({ id: crmUsers.id })
    .from(crmUsers)
    .where(and(eq(crmUsers.tenantId, tenantId), eq(crmUsers.status, "active")))
    .orderBy(asc(crmUsers.id));

  if (users.length === 0) return undefined;

  lastAssignedIndex = (lastAssignedIndex + 1) % users.length;
  return users[lastAssignedIndex]!.id;
}

// ─── Default Pipeline & Stage ────────────────────────────

async function getDefaultPipelineAndStage(tenantId: number): Promise<{ pipelineId: number; stageId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  // Try to find default pipeline
  let pipelineRows = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.isDefault, true)))
    .limit(1);

  // Fallback: first sales pipeline
  if (pipelineRows.length === 0) {
    pipelineRows = await db
      .select()
      .from(pipelines)
      .where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.pipelineType, "sales")))
      .limit(1);
  }

  // Fallback: any pipeline
  if (pipelineRows.length === 0) {
    pipelineRows = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.tenantId, tenantId))
      .limit(1);
  }

  if (pipelineRows.length === 0) return null;
  const pipeline = pipelineRows[0]!;

  // Get first stage (lowest orderIndex)
  const stages = await db
    .select()
    .from(pipelineStages)
    .where(and(eq(pipelineStages.tenantId, tenantId), eq(pipelineStages.pipelineId, pipeline.id)))
    .orderBy(asc(pipelineStages.orderIndex))
    .limit(1);

  if (stages.length === 0) return null;

  return { pipelineId: pipeline.id, stageId: stages[0]!.id };
}

// ─── Cross-Source Contact Finder ────────────────────────

/**
 * Find existing contact by email OR phone across ALL sources within the same tenant.
 * This is the core dedup logic that prevents duplicate contacts regardless of source.
 * 
 * Priority:
 * 1. Match by lead_id (RD Station) if available
 * 2. Match by email (exact, case-insensitive)
 * 3. Match by phone (E164 normalized)
 * 4. Match by phoneLast11 (fallback for different country code formats)
 */
async function findExistingContact(
  tenantId: number,
  data: { email?: string; phone?: string; lead_id?: string },
  excludeContactId?: number
): Promise<{ contact: any; matchType: "lead_id" | "email" | "phone" | "email_and_phone" } | null> {
  const db = await getDb();
  if (!db) return null;

  const normalizedEmail = data.email ? canonicalizeEmail(data.email) : undefined;
  const normalizedPhone = data.phone ? canonicalizePhone(data.phone) : undefined;
  const phoneLast11 = normalizedPhone ? extractPhoneLast11(normalizedPhone) : undefined;

  // 1. Try lead_id match first (via external_lead_id in conversion events)
  // This is handled by the dedupe key in leadEventLog, so we skip here

  // 2. Build conditions for email OR phone match
  const conditions: any[] = [];
  if (normalizedEmail) {
    conditions.push(eq(contacts.email, normalizedEmail));
  }
  if (normalizedPhone) {
    conditions.push(eq(contacts.phone, normalizedPhone));
    conditions.push(eq(contacts.phoneE164, normalizedPhone));
    if (phoneLast11) {
      conditions.push(eq(contacts.phoneLast11, phoneLast11));
    }
  }

  if (conditions.length === 0) return null;

  // Build WHERE clause: same tenant + NOT merged + (email OR phone match)
  const baseConditions: any[] = [
    eq(contacts.tenantId, tenantId),
    ne(contacts.lifecycleStage, "merged"),
  ];
  if (excludeContactId) {
    baseConditions.push(ne(contacts.id, excludeContactId));
  }

  const existing = await db
    .select()
    .from(contacts)
    .where(and(...baseConditions, or(...conditions)))
    .limit(5);

  if (existing.length === 0) return null;

  // Determine best match and match type
  for (const c of existing) {
    const emailMatch = normalizedEmail && c.email && canonicalizeEmail(c.email) === normalizedEmail;
    const phoneMatch = normalizedPhone && (
      (c.phone && canonicalizePhone(c.phone) === normalizedPhone) ||
      (c.phoneE164 && c.phoneE164 === normalizedPhone) ||
      (c.phoneLast11 && phoneLast11 && c.phoneLast11 === phoneLast11)
    );

    if (emailMatch && phoneMatch) {
      return { contact: c, matchType: "email_and_phone" };
    }
    if (emailMatch) {
      return { contact: c, matchType: "email" };
    }
    if (phoneMatch) {
      return { contact: c, matchType: "phone" };
    }
  }

  return null;
}

// ─── Upsert Contact (with cross-source dedup) ──────────

async function upsertContact(
  tenantId: number,
  data: { name: string; email?: string; phone?: string; source: string; lead_id?: string }
): Promise<{ id: number; isNew: boolean; matchType: "lead_id" | "email" | "phone" | "email_and_phone" | "new_contact"; mergePerformed?: boolean; mergeId?: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const phoneE164 = data.phone;
  const phoneDigits = phoneE164 ? phoneE164.replace(/\D/g, "") : undefined;
  const phoneLast11 = phoneDigits && phoneDigits.length >= 11 ? phoneDigits.slice(-11) : phoneDigits;

  // Cross-source dedup: find existing contact by email OR phone (any source)
  const existingMatch = await findExistingContact(tenantId, {
    email: data.email,
    phone: phoneE164,
    lead_id: data.lead_id,
  });

  if (existingMatch) {
    const contact = existingMatch.contact;
    // Update empty fields on existing contact
    const updates: Record<string, any> = {};
    if (!contact.email && data.email) updates.email = data.email;
    if (!contact.phone && phoneE164) updates.phone = phoneE164;
    if (!contact.phoneE164 && phoneE164) updates.phoneE164 = phoneE164;
    if (!contact.phoneDigits && phoneDigits) updates.phoneDigits = phoneDigits;
    if (!contact.phoneLast11 && phoneLast11) updates.phoneLast11 = phoneLast11;
    if (!contact.name || contact.name === "Lead sem nome") updates.name = data.name;

    // Append source tag
    const currentTags = (contact.tagsJson as string[] | null) || [];
    const sourceTag = `lead:${data.source}`;
    if (!currentTags.includes(sourceTag)) {
      updates.tagsJson = [...currentTags, sourceTag];
    }

    if (Object.keys(updates).length > 0) {
      await db.update(contacts).set(updates).where(eq(contacts.id, contact.id));
    }

    return {
      id: contact.id,
      isNew: false,
      matchType: existingMatch.matchType,
    };
  }

  // No existing contact found — check if there are MULTIPLE contacts that should be merged
  // (e.g., one contact with email only, another with phone only, and now a lead arrives with both)
  if (data.email && phoneE164) {
    const emailMatch = await findExistingContact(tenantId, { email: data.email });
    const phoneMatch = await findExistingContact(tenantId, { phone: phoneE164 });

    if (emailMatch && phoneMatch && emailMatch.contact.id !== phoneMatch.contact.id) {
      // Two different contacts match — merge them
      // Choose the older one as primary (lower ID = created first)
      const primary = emailMatch.contact.id < phoneMatch.contact.id ? emailMatch.contact : phoneMatch.contact;
      const secondary = emailMatch.contact.id < phoneMatch.contact.id ? phoneMatch.contact : emailMatch.contact;

      try {
        const mergeResult = await mergeContacts(
          tenantId,
          primary.id,
          secondary.id,
          "email_and_phone",
          "system:lead_processor"
        );

        // Update primary with any new data
        const updates: Record<string, any> = {};
        if (!primary.email && data.email) updates.email = data.email;
        if (!primary.phone && phoneE164) updates.phone = phoneE164;
        if (!primary.phoneE164 && phoneE164) updates.phoneE164 = phoneE164;
        if (!primary.phoneDigits && phoneDigits) updates.phoneDigits = phoneDigits;
        if (!primary.phoneLast11 && phoneLast11) updates.phoneLast11 = phoneLast11;
        if ((!primary.name || primary.name === "Lead sem nome") && data.name !== "Lead sem nome") updates.name = data.name;

        const currentTags = (primary.tagsJson as string[] | null) || [];
        const sourceTag = `lead:${data.source}`;
        if (!currentTags.includes(sourceTag)) {
          updates.tagsJson = [...currentTags, sourceTag];
        }

        if (Object.keys(updates).length > 0) {
          await db.update(contacts).set(updates).where(eq(contacts.id, primary.id));
        }

        console.log(`[LeadProcessor] Auto-merged contacts #${secondary.id} → #${primary.id} (email+phone match)`);

        return {
          id: primary.id,
          isNew: false,
          matchType: "email_and_phone",
          mergePerformed: true,
          mergeId: mergeResult.mergeId,
        };
      } catch (mergeErr: any) {
        console.error(`[LeadProcessor] Auto-merge failed: ${mergeErr.message}`);
        // Fall through to use the email match as primary
        return {
          id: emailMatch.contact.id,
          isNew: false,
          matchType: "email",
        };
      }
    }

    // If only one matched, use it
    if (emailMatch) {
      const contact = emailMatch.contact;
      const updates: Record<string, any> = {};
      if (!contact.phone && phoneE164) updates.phone = phoneE164;
      if (!contact.phoneE164 && phoneE164) updates.phoneE164 = phoneE164;
      if (!contact.phoneDigits && phoneDigits) updates.phoneDigits = phoneDigits;
      if (!contact.phoneLast11 && phoneLast11) updates.phoneLast11 = phoneLast11;
      if ((!contact.name || contact.name === "Lead sem nome") && data.name !== "Lead sem nome") updates.name = data.name;
      const currentTags = (contact.tagsJson as string[] | null) || [];
      const sourceTag = `lead:${data.source}`;
      if (!currentTags.includes(sourceTag)) updates.tagsJson = [...currentTags, sourceTag];
      if (Object.keys(updates).length > 0) {
        await db.update(contacts).set(updates).where(eq(contacts.id, contact.id));
      }
      return { id: contact.id, isNew: false, matchType: "email" };
    }

    if (phoneMatch) {
      const contact = phoneMatch.contact;
      const updates: Record<string, any> = {};
      if (!contact.email && data.email) updates.email = data.email;
      if ((!contact.name || contact.name === "Lead sem nome") && data.name !== "Lead sem nome") updates.name = data.name;
      const currentTags = (contact.tagsJson as string[] | null) || [];
      const sourceTag = `lead:${data.source}`;
      if (!currentTags.includes(sourceTag)) updates.tagsJson = [...currentTags, sourceTag];
      if (Object.keys(updates).length > 0) {
        await db.update(contacts).set(updates).where(eq(contacts.id, contact.id));
      }
      return { id: contact.id, isNew: false, matchType: "phone" };
    }
  }

  // Create new contact
  const [result] = await db.insert(contacts).values({
    tenantId,
    name: data.name,
    email: data.email || undefined,
    phone: phoneE164 || undefined,
    phoneE164: phoneE164 || undefined,
    phoneDigits: phoneDigits || undefined,
    phoneLast11: phoneLast11 || undefined,
    source: data.source,
    lifecycleStage: "lead",
    tagsJson: [`lead:${data.source}`],
  }).$returningId();

  return { id: result!.id, isNew: true, matchType: "new_contact" };
}

// ─── Main Processor ──────────────────────────────────────

export interface ProcessInboundLeadOptions {
  pipelineId?: number;
  stageId?: number;
  ownerUserId?: number;
  source?: string;
  campaign?: string;
  dealTitle?: string;
}

export async function processInboundLead(
  tenantId: number,
  payload: InboundLeadPayload,
  options?: ProcessInboundLeadOptions
): Promise<ProcessResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Normalize
  const normalizedName = normalizeName(payload.name);
  const normalizedEmail = normalizeEmail(payload.email);
  const normalizedPhone = normalizePhone(payload.phone);

  // 2. Generate dedupe key
  const dedupeKey = generateDedupeKey(payload.source, {
    ...payload,
    email: normalizedEmail,
    phone: normalizedPhone,
  });

  // 3. Check idempotency — already processed?
  const existingLog = await db
    .select()
    .from(leadEventLog)
    .where(eq(leadEventLog.dedupeKey, dedupeKey))
    .limit(1);

  if (existingLog.length > 0 && existingLog[0]!.status === "success") {
    // Even for duplicates, record the conversion event (idempotent via idempotencyKey)
    const convIdempotencyKey = generateConversionIdempotencyKey(
      tenantId, payload.source, payload.lead_id, normalizedEmail, normalizedPhone, payload.conversionIdentifier
    );
    if (existingLog[0]!.contactId) {
      await recordConversionEvent({
        tenantId,
        contactId: existingLog[0]!.contactId,
        integrationSource: payload.source,
        externalLeadId: payload.lead_id,
        eventType: "conversion",
        conversionIdentifier: payload.conversionIdentifier,
        conversionName: payload.conversionName,
        assetName: payload.assetName,
        assetType: payload.assetType,
        trafficSource: payload.trafficSource,
        utmSource: payload.utm?.source,
        utmMedium: payload.utm?.medium,
        utmCampaign: payload.utm?.campaign,
        utmContent: payload.utm?.content,
        utmTerm: payload.utm?.term,
        formName: payload.formName,
        landingPage: payload.landingPage,
        rawPayload: payload.raw,
        dedupeMatchType: "lead_id",
        matchedExistingContactId: existingLog[0]!.contactId,
        dealId: existingLog[0]!.dealId ?? undefined,
        idempotencyKey: convIdempotencyKey,
      });
    }

    return {
      success: true,
      dealId: existingLog[0]!.dealId ?? undefined,
      contactId: existingLog[0]!.contactId ?? undefined,
      dedupeKey,
      isExisting: true,
    };
  }

  // 4. Create pending event log entry (or update existing failed one)
  let eventLogId: number;
  if (existingLog.length > 0) {
    eventLogId = existingLog[0]!.id;
    await db
      .update(leadEventLog)
      .set({ status: "processing", error: null })
      .where(eq(leadEventLog.id, eventLogId));
  } else {
    const [logResult] = await db.insert(leadEventLog).values({
      tenantId,
      type: "inbound_lead",
      source: payload.source,
      dedupeKey,
      payload: payload as any,
      status: "processing",
    }).$returningId();
    eventLogId = logResult!.id;
  }

  try {
    // 5. Upsert Contact (with cross-source dedup and auto-merge)
    const contact = await upsertContact(tenantId, {
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      source: payload.source,
      lead_id: payload.lead_id,
    });

    // 6. Get pipeline & stage (from options or default)
    let pipelineInfo: { pipelineId: number; stageId: number } | null = null;
    if (options?.pipelineId && options?.stageId) {
      pipelineInfo = { pipelineId: options.pipelineId, stageId: options.stageId };
    } else if (options?.pipelineId) {
      // Pipeline specified but no stage — get first stage of that pipeline
      const stageRows = await db
        .select()
        .from(pipelineStages)
        .where(and(eq(pipelineStages.tenantId, tenantId), eq(pipelineStages.pipelineId, options.pipelineId)))
        .orderBy(asc(pipelineStages.orderIndex))
        .limit(1);
      if (stageRows.length > 0) {
        pipelineInfo = { pipelineId: options.pipelineId, stageId: stageRows[0]!.id };
      }
    }
    if (!pipelineInfo) {
      pipelineInfo = await getDefaultPipelineAndStage(tenantId);
    }
    if (!pipelineInfo) {
      throw new Error("Nenhum pipeline encontrado. Crie um pipeline antes de receber leads.");
    }

    // 7. Owner (from options or round-robin)
    const ownerUserId = options?.ownerUserId ?? await getNextOwner(tenantId);

    // 8. Create Deal (using centralized createDeal for clean field handling + error messages)
    const dealTitle = options?.dealTitle || `${normalizedName} \u2022 ${payload.source}`;
    const dealResult = await createDeal({
      tenantId,
      title: dealTitle,
      contactId: contact.id,
      pipelineId: pipelineInfo.pipelineId,
      stageId: pipelineInfo.stageId,
      status: "open",
      ownerUserId: ownerUserId ?? undefined,
      channelOrigin: options?.source || payload.source,
      leadSource: options?.source || payload.source,
      utmSource: payload.utm?.source || undefined,
      utmMedium: payload.utm?.medium || undefined,
      utmCampaign: options?.campaign || payload.utm?.campaign || undefined,
      utmTerm: payload.utm?.term || undefined,
      utmContent: payload.utm?.content || undefined,
      utmJson: payload.utm ? (payload.utm as any) : undefined,
      rdCustomFields: payload.rdCustomFields ? (payload.rdCustomFields as any) : undefined,
      metaJson: payload.meta ? (payload.meta as any) : undefined,
      rawPayloadJson: payload.raw ? (payload.raw as any) : (payload as any),
      dedupeKey,
    });
    if (!dealResult) throw new Error('Falha ao criar negociação - banco de dados indisponível');
    const dealId = dealResult.id;

    // 9. Record conversion event
    const convIdempotencyKey = generateConversionIdempotencyKey(
      tenantId, payload.source, payload.lead_id, normalizedEmail, normalizedPhone, payload.conversionIdentifier
    );
    let conversionEventId: number | null = null;
    try {
      conversionEventId = await recordConversionEvent({
        tenantId,
        contactId: contact.id,
        integrationSource: payload.source,
        externalLeadId: payload.lead_id,
        eventType: "conversion",
        conversionIdentifier: payload.conversionIdentifier,
        conversionName: payload.conversionName,
        assetName: payload.assetName,
        assetType: payload.assetType,
        trafficSource: payload.trafficSource,
        utmSource: payload.utm?.source,
        utmMedium: payload.utm?.medium,
        utmCampaign: payload.utm?.campaign,
        utmContent: payload.utm?.content,
        utmTerm: payload.utm?.term,
        formName: payload.formName,
        landingPage: payload.landingPage,
        rawPayload: payload.raw,
        dedupeMatchType: contact.matchType,
        matchedExistingContactId: contact.isNew ? undefined : contact.id,
        dealId,
        idempotencyKey: convIdempotencyKey,
      });
    } catch (convErr: any) {
      console.warn(`[LeadProcessor] Failed to record conversion event: ${convErr.message}`);
    }

    // 10. Update event log → success
    await db
      .update(leadEventLog)
      .set({ status: "success", dealId, contactId: contact.id })
      .where(eq(leadEventLog.id, eventLogId));

    console.log(`[LeadProcessor] Lead processed: ${dedupeKey} → deal #${dealId}, contact #${contact.id} (${contact.isNew ? "new" : "existing"}, match: ${contact.matchType}${contact.mergePerformed ? ", merged" : ""})`);

    // 11. Notificação in-app para a equipe
    try {
      const sourceLabel = payload.source === "meta_lead_ads" ? "Meta Lead Ads" : payload.source === "landing" ? "Landing Page" : payload.source === "rdstation" ? "RD Station" : payload.source;
      const contactInfo = [normalizedName];
      if (normalizedEmail) contactInfo.push(normalizedEmail);
      if (normalizedPhone) contactInfo.push(normalizedPhone);

      await createNotification(tenantId, {
        type: "new_lead",
        title: `Novo lead via ${sourceLabel}`,
        body: `${contactInfo.join(" • ")}${payload.utm?.campaign ? ` — Campanha: ${payload.utm.campaign}` : ""}`,
        entityType: "deal",
        entityId: String(dealId),
      });
    } catch (notifErr) {
      console.warn(`[LeadProcessor] Falha ao criar notificação para lead ${dedupeKey}:`, notifErr);
    }

    return {
      success: true,
      dealId,
      contactId: contact.id,
      dedupeKey,
      isExisting: false,
      mergePerformed: contact.mergePerformed,
      mergeId: contact.mergeId,
      conversionEventId: conversionEventId ?? undefined,
    };
  } catch (error: any) {
    // 12. Log failure
    const errorMsg = error?.message || String(error);
    await db
      .update(leadEventLog)
      .set({ status: "failed", error: errorMsg })
      .where(eq(leadEventLog.id, eventLogId));

    console.error(`[LeadProcessor] Lead failed: ${dedupeKey} — ${errorMsg}`);

    return {
      success: false,
      dedupeKey,
      isExisting: false,
      error: errorMsg,
    };
  }
}

// ─── Reprocess Failed Event ──────────────────────────────

export async function reprocessLeadEvent(
  tenantId: number,
  eventId: number
): Promise<ProcessResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(leadEventLog)
    .where(and(eq(leadEventLog.id, eventId), eq(leadEventLog.tenantId, tenantId)))
    .limit(1);

  if (rows.length === 0) {
    return { success: false, dedupeKey: "", isExisting: false, error: "Event not found" };
  }

  const event = rows[0]!;
  if (event.status === "success") {
    return {
      success: true,
      dealId: event.dealId ?? undefined,
      contactId: event.contactId ?? undefined,
      dedupeKey: event.dedupeKey,
      isExisting: true,
    };
  }

  // Reset status and reprocess
  await db
    .update(leadEventLog)
    .set({ status: "pending", error: null })
    .where(eq(leadEventLog.id, eventId));

  const payload = event.payload as InboundLeadPayload;
  return processInboundLead(tenantId, payload);
}

// ─── Query Event Logs ────────────────────────────────────

export async function listLeadEvents(
  tenantId: number,
  opts?: { source?: string; status?: string; limit?: number; offset?: number; beforeId?: number }
) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [eq(leadEventLog.tenantId, tenantId)];
  if (opts?.source) conditions.push(eq(leadEventLog.source, opts.source));
  if (opts?.status) conditions.push(eq(leadEventLog.status, opts.status));
  if (opts?.beforeId) conditions.push(lt(leadEventLog.id, opts.beforeId));

  return db
    .select()
    .from(leadEventLog)
    .where(and(...conditions))
    .orderBy(sql`${leadEventLog.createdAt} DESC`)
    .limit(opts?.limit || 50);
}

export async function countLeadEvents(
  tenantId: number,
  opts?: { source?: string; status?: string }
) {
  const db = await getDb();
  if (!db) return 0;

  const conditions: any[] = [eq(leadEventLog.tenantId, tenantId)];
  if (opts?.source) conditions.push(eq(leadEventLog.source, opts.source));
  if (opts?.status) conditions.push(eq(leadEventLog.status, opts.status));

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(leadEventLog)
    .where(and(...conditions));

  return rows[0]?.count || 0;
}

// ─── Webhook Config Helpers ──────────────────────────────

import { webhookConfig, metaIntegrationConfig } from "../drizzle/schema";

export async function getWebhookConfig(tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(webhookConfig)
    .where(eq(webhookConfig.tenantId, tenantId))
    .limit(1);
  return rows[0] || null;
}

export async function upsertWebhookConfig(tenantId: number, secret: string) {
  const db = await getDb();
  if (!db) return null;

  const existing = await getWebhookConfig(tenantId);
  if (existing) {
    await db
      .update(webhookConfig)
      .set({ webhookSecret: secret })
      .where(eq(webhookConfig.id, existing.id));
    return { ...existing, webhookSecret: secret };
  }

  const [result] = await db.insert(webhookConfig).values({ tenantId, webhookSecret: secret }).$returningId();
  return { id: result!.id, tenantId, webhookSecret: secret };
}

export async function getMetaConfig(tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(metaIntegrationConfig)
    .where(eq(metaIntegrationConfig.tenantId, tenantId))
    .limit(1);
  return rows[0] || null;
}

export async function upsertMetaConfig(
  tenantId: number,
  data: { pageId?: string; pageName?: string; accessToken?: string; appSecret?: string; verifyToken?: string; formsJson?: any; status?: string }
) {
  const db = await getDb();
  if (!db) return null;

  const existing = await getMetaConfig(tenantId);
  if (existing) {
    await db
      .update(metaIntegrationConfig)
      .set(data)
      .where(eq(metaIntegrationConfig.id, existing.id));
    return { ...existing, ...data };
  }

  const [result] = await db.insert(metaIntegrationConfig).values({ tenantId, ...data }).$returningId();
  return { id: result!.id, tenantId, ...data };
}

export async function disconnectMeta(tenantId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(metaIntegrationConfig)
    .set({ status: "disconnected", accessToken: null, pageId: null, pageName: null, formsJson: null })
    .where(eq(metaIntegrationConfig.tenantId, tenantId));
}
