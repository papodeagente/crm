/**
 * Lead Processor — Idempotent inbound lead processing.
 *
 * Handles leads from:
 *   - Landing Page webhooks (source = "landing")
 *   - Meta Lead Ads (source = "meta_lead_ads")
 *   - Any future source
 *
 * Flow:
 *   1. Normalize payload (phone E164, email lower, trim)
 *   2. Generate dedupe_key = source + (lead_id || sha256(email+phone))
 *   3. Check EventLog for existing success → return existing deal_id
 *   4. Upsert Contact (create or update empty fields)
 *   5. Create Deal in default pipeline, stage "Novo lead"
 *   6. Log success in EventLog
 *   7. On error → log failure in EventLog
 */

import { getDb, createNotification } from "./db";
import { createHash } from "crypto";
import {
  contacts, deals, pipelines, pipelineStages,
  leadEventLog, crmUsers,
} from "../drizzle/schema";
import { eq, and, or, sql, asc, lt } from "drizzle-orm";
import { normalizeBrazilianPhone } from "./phoneUtils";

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
}

export interface ProcessResult {
  success: boolean;
  dealId?: number;
  contactId?: number;
  dedupeKey: string;
  isExisting: boolean;
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

// ─── Upsert Contact ─────────────────────────────────────

async function upsertContact(
  tenantId: number,
  data: { name: string; email?: string; phone?: string; source: string }
): Promise<{ id: number; isNew: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const phoneE164 = data.phone;
  const phoneDigits = phoneE164 ? phoneE164.replace(/\D/g, "") : undefined;
  const phoneLast11 = phoneDigits && phoneDigits.length >= 11 ? phoneDigits.slice(-11) : phoneDigits;

  // Try to find existing contact by email or phone
  const conditions: any[] = [];
  if (data.email) {
    conditions.push(eq(contacts.email, data.email));
  }
  if (phoneE164) {
    conditions.push(eq(contacts.phone, phoneE164));
    conditions.push(eq(contacts.phoneE164, phoneE164));
    if (phoneLast11) {
      conditions.push(eq(contacts.phoneLast11, phoneLast11));
    }
  }

  if (conditions.length > 0) {
    const existing = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), or(...conditions)))
      .limit(1);

    if (existing.length > 0) {
      const contact = existing[0]!;
      // Update empty fields
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

      return { id: contact.id, isNew: false };
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

  return { id: result!.id, isNew: true };
}

// ─── Main Processor ──────────────────────────────────────

export async function processInboundLead(
  tenantId: number,
  payload: InboundLeadPayload
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
    // 5. Upsert Contact
    const contact = await upsertContact(tenantId, {
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      source: payload.source,
    });

    // 6. Get default pipeline & stage
    const pipelineInfo = await getDefaultPipelineAndStage(tenantId);
    if (!pipelineInfo) {
      throw new Error("Nenhum pipeline encontrado. Crie um pipeline antes de receber leads.");
    }

    // 7. Round-robin owner
    const ownerUserId = await getNextOwner(tenantId);

    // 8. Create Deal
    const dealTitle = `${normalizedName} • ${payload.source}`;
    const [dealResult] = await db.insert(deals).values({
      tenantId,
      title: dealTitle,
      contactId: contact.id,
      pipelineId: pipelineInfo.pipelineId,
      stageId: pipelineInfo.stageId,
      status: "open",
      ownerUserId: ownerUserId ?? undefined,
      channelOrigin: payload.source,
      leadSource: payload.source,
      utmSource: payload.utm?.source || undefined,
      utmMedium: payload.utm?.medium || undefined,
      utmCampaign: payload.utm?.campaign || undefined,
      utmTerm: payload.utm?.term || undefined,
      utmContent: payload.utm?.content || undefined,
      utmJson: payload.utm ? (payload.utm as any) : undefined,
      rdCustomFields: payload.rdCustomFields ? (payload.rdCustomFields as any) : undefined,
      metaJson: payload.meta ? (payload.meta as any) : undefined,
      rawPayloadJson: payload.raw ? (payload.raw as any) : (payload as any),
      dedupeKey,
    }).$returningId();

    const dealId = dealResult!.id;

    // 9. Update event log → success
    await db
      .update(leadEventLog)
      .set({ status: "success", dealId, contactId: contact.id })
      .where(eq(leadEventLog.id, eventLogId));

    console.log(`[LeadProcessor] Lead processed: ${dedupeKey} → deal #${dealId}, contact #${contact.id} (${contact.isNew ? "new" : "existing"})`);

    // 10. Notificação in-app para a equipe
    try {
      const sourceLabel = payload.source === "meta_lead_ads" ? "Meta Lead Ads" : payload.source === "landing" ? "Landing Page" : payload.source;
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
    };
  } catch (error: any) {
    // 10. Log failure
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
