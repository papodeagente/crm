/**
 * Bulk WhatsApp Messaging — Send template messages to multiple RFV contacts
 * with rate-limiting, progress tracking, variable substitution,
 * and full campaign registry with per-message status tracking.
 */
import { getDb } from "./db";
import { rfvContacts, whatsappSessions, bulkCampaigns, bulkCampaignMessages } from "../drizzle/schema";
import { eq, and, inArray, desc, sql, count } from "drizzle-orm";
import { whatsappManager as baileysManager } from "./whatsapp";
import { whatsappManager as evolutionManager } from "./whatsappEvolution";

// ─── Dual-manager helper ───
// Sessions may be managed by Baileys (legacy) or Evolution API (SaaS tenants).
// This helper checks both managers to find the active session.
function getSessionFromAnyManager(sessionId: string): { status: string; socket?: any } | undefined {
  // Try Evolution API first (most common for SaaS tenants)
  const evoSession = evolutionManager.getSession(sessionId);
  if (evoSession) return evoSession;
  // Fall back to Baileys
  const baileysSession = baileysManager.getSession(sessionId);
  if (baileysSession) return baileysSession;
  return undefined;
}

async function sendTextMessageViaAnyManager(sessionId: string, jid: string, text: string): Promise<any> {
  // Try Evolution API first
  const evoSession = evolutionManager.getSession(sessionId);
  if (evoSession && evoSession.status === "connected") {
    return evolutionManager.sendTextMessage(sessionId, jid, text);
  }
  // Fall back to Baileys
  return baileysManager.sendTextMessage(sessionId, jid, text);
}

async function connectViaAnyManager(sessionId: string, userId: number, tenantId: number): Promise<any> {
  // Try Evolution API first (SaaS tenants use crm- prefix)
  if (sessionId.startsWith("crm-")) {
    return evolutionManager.connect(sessionId, userId, tenantId);
  }
  // Fall back to Baileys
  return baileysManager.connect(sessionId, userId, tenantId);
}

// ─── Types ───
export interface BulkSendRequest {
  tenantId: number;
  userId: number;
  userName?: string;
  contactIds: number[];
  messageTemplate: string;
  sessionId: string;
  delayMs?: number;
  randomDelay?: boolean; // If true, use random interval between delayMs*0.5 and delayMs*1.5
  delayMinMs?: number;   // Min delay when randomDelay is true (default: delayMs * 0.5)
  delayMaxMs?: number;   // Max delay when randomDelay is true (default: delayMs * 1.5)
  campaignName?: string;
  source?: string;
  audienceFilter?: string;
}

export interface BulkSendResult {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  results: {
    contactId: number;
    name: string;
    phone: string | null;
    status: "sent" | "failed" | "skipped";
    error?: string;
  }[];
}

// ─── In-memory progress tracking ───
interface BulkJobProgress {
  tenantId: number;
  campaignId: number;
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  status: "running" | "completed" | "cancelled";
  startedAt: Date;
  results: BulkSendResult["results"];
}

const activeJobs = new Map<string, BulkJobProgress>();

function jobKey(tenantId: number): string {
  return `bulk-${tenantId}`;
}

/**
 * Get the progress of the current bulk send job for a tenant
 */
export function getBulkSendProgress(tenantId: number): BulkJobProgress | null {
  return activeJobs.get(jobKey(tenantId)) || null;
}

/**
 * Cancel the current bulk send job for a tenant
 */
export function cancelBulkSend(tenantId: number): boolean {
  const job = activeJobs.get(jobKey(tenantId));
  if (job && job.status === "running") {
    job.status = "cancelled";
    return true;
  }
  return false;
}

/**
 * Replace template variables with contact data.
 * Supported variables: {nome}, {primeiro_nome}, {email}, {telefone}, {publico}, {valor}
 */
export function interpolateTemplate(template: string, contact: {
  name: string;
  email: string | null;
  phone: string | null;
  audienceType: string;
  vScore: number;
}): string {
  const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(contact.vScore / 100);
  const firstName = contact.name.split(" ")[0];
  
  return template
    .replace(/\{nome\}/gi, contact.name)
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{email\}/gi, contact.email || "")
    .replace(/\{telefone\}/gi, contact.phone || "")
    .replace(/\{publico\}/gi, contact.audienceType)
    .replace(/\{valor\}/gi, valor);
}

/**
 * Normalize phone number to WhatsApp JID format
 */
function phoneToJid(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `${withCountry}@s.whatsapp.net`;
}

/**
 * Send bulk WhatsApp messages to selected RFV contacts.
 * Creates a campaign record and tracks each message individually.
 */
export async function startBulkSend(request: BulkSendRequest): Promise<{ jobId: string; campaignId: number }> {
  const { tenantId, userId, userName, contactIds, messageTemplate, sessionId, delayMs = 3000, randomDelay = false, delayMinMs, delayMaxMs, source = "rfv", audienceFilter } = request;
  const key = jobKey(tenantId);

  // Check if there's already a running job
  const existing = activeJobs.get(key);
  if (existing && existing.status === "running") {
    throw new Error("Já existe um envio em massa em andamento para esta agência. Aguarde ou cancele.");
  }

  // Verify session is connected
  const session = getSessionFromAnyManager(sessionId);
  if (!session || session.status !== "connected") {
    throw new Error("Sessão WhatsApp não está conectada. Conecte-se primeiro.");
  }

  // Fetch contacts from DB
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const contacts = await db
    .select()
    .from(rfvContacts)
    .where(and(
      eq(rfvContacts.tenantId, tenantId),
      inArray(rfvContacts.id, contactIds),
    ));

  if (contacts.length === 0) {
    throw new Error("Nenhum contato encontrado com os IDs fornecidos.");
  }

  // Generate campaign name if not provided
  const campaignName = request.campaignName || `Campanha ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  // Create campaign record in DB
  const [campaignResult] = await db.insert(bulkCampaigns).values({
    tenantId,
    userId,
    userName: userName || null,
    name: campaignName,
    messageTemplate,
    source,
    audienceFilter: audienceFilter || null,
    sessionId,
    intervalMs: delayMs,
    totalContacts: contacts.length,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    status: "running",
  });

  const campaignId = campaignResult.insertId;

  // Pre-create all message records as "pending"
  const messageRecords = contacts.map((contact) => ({
    campaignId,
    tenantId,
    contactId: contact.id,
    contactName: contact.name,
    contactPhone: contact.phone || null,
    messageContent: null as string | null,
    status: "pending" as const,
  }));

  // Insert in batches of 100 to avoid query size limits
  for (let i = 0; i < messageRecords.length; i += 100) {
    const batch = messageRecords.slice(i, i + 100);
    await db.insert(bulkCampaignMessages).values(batch);
  }

  // Initialize job progress
  const job: BulkJobProgress = {
    tenantId,
    campaignId,
    total: contacts.length,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    status: "running",
    startedAt: new Date(),
    results: [],
  };
  activeJobs.set(key, job);

  // Run async (don't await — fire and forget)
  processBulkSend(key, job, campaignId, contacts, messageTemplate, sessionId, delayMs, randomDelay, delayMinMs, delayMaxMs).catch((err) => {
    console.error("[BulkSend] Fatal error:", err);
    job.status = "completed";
    // Mark campaign as failed
    getDb().then(db2 => {
      if (db2) {
        db2.update(bulkCampaigns)
          .set({ status: "failed", completedAt: new Date() })
          .where(eq(bulkCampaigns.id, campaignId))
          .catch(console.error);
      }
    });
  });

  return { jobId: key, campaignId };
}

async function processBulkSend(
  key: string,
  job: BulkJobProgress,
  campaignId: number,
  contacts: any[],
  messageTemplate: string,
  sessionId: string,
  delayMs: number,
  randomDelay: boolean = false,
  delayMinMs?: number,
  delayMaxMs?: number,
) {
  const db = await getDb();
  if (!db) return;

  // Fetch the campaign message records to get their IDs
  const campaignMessages = await db
    .select({ id: bulkCampaignMessages.id, contactId: bulkCampaignMessages.contactId })
    .from(bulkCampaignMessages)
    .where(eq(bulkCampaignMessages.campaignId, campaignId));

  // Build a map: contactId → campaignMessageId
  const msgIdMap = new Map<number, number>();
  for (const m of campaignMessages) {
    if (m.contactId) msgIdMap.set(m.contactId, m.id);
  }

  for (const contact of contacts) {
    // Check if cancelled
    if (job.status === "cancelled") {
      // Mark remaining messages as skipped
      await db.update(bulkCampaignMessages)
        .set({ status: "skipped", errorMessage: "Campanha cancelada" })
        .where(and(
          eq(bulkCampaignMessages.campaignId, campaignId),
          eq(bulkCampaignMessages.status, "pending"),
        ));
      break;
    }

    const msgId = msgIdMap.get(contact.id);
    const result: BulkSendResult["results"][0] = {
      contactId: contact.id,
      name: contact.name,
      phone: contact.phone,
      status: "skipped",
    };

    if (!contact.phone) {
      result.status = "skipped";
      result.error = "Sem telefone";
      job.skipped++;
      if (msgId) {
        await db.update(bulkCampaignMessages)
          .set({ status: "skipped", errorMessage: "Sem telefone" })
          .where(eq(bulkCampaignMessages.id, msgId));
      }
    } else {
      const jid = phoneToJid(contact.phone);
      if (!jid) {
        result.status = "skipped";
        result.error = "Telefone inválido";
        job.skipped++;
        if (msgId) {
          await db.update(bulkCampaignMessages)
            .set({ status: "skipped", errorMessage: "Telefone inválido" })
            .where(eq(bulkCampaignMessages.id, msgId));
        }
      } else {
        // Mark as sending
        if (msgId) {
          await db.update(bulkCampaignMessages)
            .set({ status: "sending" })
            .where(eq(bulkCampaignMessages.id, msgId));
        }

        try {
          const message = interpolateTemplate(messageTemplate, contact);
          const sendResult = await sendTextMessageViaAnyManager(sessionId, jid, message);
          const waMessageId = sendResult?.key?.id || null;
          
          result.status = "sent";
          job.sent++;

          if (msgId) {
            await db.update(bulkCampaignMessages)
              .set({
                status: "sent",
                messageContent: message,
                sentAt: new Date(),
                waMessageId,
              })
              .where(eq(bulkCampaignMessages.id, msgId));
          }
        } catch (err: any) {
          result.status = "failed";
          result.error = err.message || "Erro desconhecido";
          job.failed++;

          if (msgId) {
            await db.update(bulkCampaignMessages)
              .set({
                status: "failed",
                messageContent: interpolateTemplate(messageTemplate, contact),
                errorMessage: err.message || "Erro desconhecido",
              })
              .where(eq(bulkCampaignMessages.id, msgId));
          }
        }
      }
    }

    job.results.push(result);
    job.processed++;

    // Update campaign counters every message
    await db.update(bulkCampaigns)
      .set({
        sentCount: job.sent,
        failedCount: job.failed,
        skippedCount: job.skipped,
      })
      .where(eq(bulkCampaigns.id, campaignId));

    // Rate-limit delay between messages (skip for last message)
    if (job.status === "running" && job.processed < job.total) {
      let actualDelay = delayMs;
      if (randomDelay) {
        // Random interval between min and max to avoid WhatsApp blocking patterns
        const min = delayMinMs ?? Math.round(delayMs * 0.5);
        const max = delayMaxMs ?? Math.round(delayMs * 1.5);
        actualDelay = Math.round(min + Math.random() * (max - min));
      }
      await new Promise((resolve) => setTimeout(resolve, actualDelay));
    }
  }

  // Finalize campaign
  const finalStatus = job.status === "cancelled" ? "cancelled" : "completed";
  job.status = finalStatus === "cancelled" ? "cancelled" : "completed";

  await db.update(bulkCampaigns)
    .set({
      status: finalStatus,
      sentCount: job.sent,
      failedCount: job.failed,
      skippedCount: job.skipped,
      completedAt: new Date(),
    })
    .where(eq(bulkCampaigns.id, campaignId));

  console.log(`[BulkSend] Campaign ${campaignId} ${finalStatus}: ${job.sent} sent, ${job.failed} failed, ${job.skipped} skipped out of ${job.total}`);

  // Clean up in-memory job after 5 minutes
  setTimeout(() => {
    activeJobs.delete(key);
  }, 5 * 60 * 1000);
}

// ─── Campaign Query Functions ───

/**
 * List campaigns for a tenant with pagination
 */
export async function listCampaigns(tenantId: number, opts: {
  page?: number;
  pageSize?: number;
  status?: string;
} = {}): Promise<{ campaigns: any[]; total: number }> {
  const db = await getDb();
  if (!db) return { campaigns: [], total: 0 };

  const page = opts.page || 1;
  const pageSize = opts.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(bulkCampaigns.tenantId, tenantId)];
  if (opts.status) {
    conditions.push(eq(bulkCampaigns.status, opts.status as any));
  }

  const [campaigns, totalResult] = await Promise.all([
    db.select()
      .from(bulkCampaigns)
      .where(and(...conditions))
      .orderBy(desc(bulkCampaigns.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() })
      .from(bulkCampaigns)
      .where(and(...conditions)),
  ]);

  return {
    campaigns,
    total: Number(totalResult[0]?.total || 0),
  };
}

/**
 * Get a single campaign with summary stats
 */
export async function getCampaignDetail(campaignId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return null;

  const [campaign] = await db.select()
    .from(bulkCampaigns)
    .where(and(eq(bulkCampaigns.id, campaignId), eq(bulkCampaigns.tenantId, tenantId)));

  if (!campaign) return null;

  // Get status breakdown
  const statusCounts = await db
    .select({
      status: bulkCampaignMessages.status,
      count: count(),
    })
    .from(bulkCampaignMessages)
    .where(eq(bulkCampaignMessages.campaignId, campaignId))
    .groupBy(bulkCampaignMessages.status);

  const breakdown: Record<string, number> = {};
  for (const row of statusCounts) {
    breakdown[row.status] = Number(row.count);
  }

  return { ...campaign, breakdown };
}

/**
 * Get messages for a campaign with pagination
 */
export async function getCampaignMessages(campaignId: number, tenantId: number, opts: {
  page?: number;
  pageSize?: number;
  status?: string;
} = {}): Promise<{ messages: any[]; total: number }> {
  const db = await getDb();
  if (!db) return { messages: [], total: 0 };

  const page = opts.page || 1;
  const pageSize = opts.pageSize || 50;
  const offset = (page - 1) * pageSize;

  const conditions = [
    eq(bulkCampaignMessages.campaignId, campaignId),
    eq(bulkCampaignMessages.tenantId, tenantId),
  ];
  if (opts.status) {
    conditions.push(eq(bulkCampaignMessages.status, opts.status as any));
  }

  const [messages, totalResult] = await Promise.all([
    db.select()
      .from(bulkCampaignMessages)
      .where(and(...conditions))
      .orderBy(bulkCampaignMessages.id)
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() })
      .from(bulkCampaignMessages)
      .where(and(...conditions)),
  ]);

  return {
    messages,
    total: Number(totalResult[0]?.total || 0),
  };
}

/**
 * Get active session for a specific user within a tenant.
 * This ensures each user sends from their own WhatsApp number.
 * Falls back to tenant-wide search only if userId is not provided.
 */
export async function getActiveSessionForTenant(tenantId: number, userId?: number): Promise<{ sessionId: string; status: string } | null> {
  const db = await getDb();
  if (!db) return null;

  // If userId is provided, prioritize that user's sessions first
  let sessions;
  if (userId) {
    sessions = await db
      .select()
      .from(whatsappSessions)
      .where(and(
        eq(whatsappSessions.tenantId, tenantId),
        eq(whatsappSessions.userId, userId),
      ));
    
    // Try to find connected/connecting session for this specific user
    const userResult = findBestSession(sessions, tenantId);
    if (userResult) return userResult;
    
    // If no session found for this user, DO NOT fall back to other users' sessions
    // This prevents sending from the wrong number
    console.log(`[ActiveSession] No session found for user ${userId} in tenant ${tenantId}`);
    return null;
  }

  // Legacy fallback: no userId provided, search all tenant sessions
  sessions = await db
    .select()
    .from(whatsappSessions)
    .where(eq(whatsappSessions.tenantId, tenantId));

  return findBestSession(sessions, tenantId);
}

/** Internal helper: find the best session from a list of candidates */
function findBestSession(sessions: any[], tenantId: number): { sessionId: string; status: string } | null {
  if (sessions.length === 0) return null;

  // Find the first connected session (in-memory takes priority — check BOTH managers)
  for (const s of sessions) {
    const live = getSessionFromAnyManager(s.sessionId);
    if (live && live.status === "connected") {
      return { sessionId: s.sessionId, status: "connected" };
    }
  }

  // Check if any session is currently connecting (in-memory)
  for (const s of sessions) {
    const live = getSessionFromAnyManager(s.sessionId);
    if (live && live.status === "connecting") {
      return { sessionId: s.sessionId, status: "connecting" };
    }
  }

  // No live connected session found.
  // Check if DB says "connected" — if so, trigger auto-reconnect in background
  for (const s of sessions) {
    if (s.status === "connected") {
      const live = getSessionFromAnyManager(s.sessionId);
      if (!live) {
        console.log(`[ActiveSession] DB says connected but no in-memory session for ${s.sessionId}. Triggering reconnect (tenant: ${s.tenantId})...`);
        connectViaAnyManager(s.sessionId, s.userId, s.tenantId).catch((e: any) => {
          console.error(`[ActiveSession] Auto-reconnect failed for ${s.sessionId}:`, e);
        });
        return { sessionId: s.sessionId, status: "connecting" };
      }
    }
  }

  // Return first session with its actual status
  const firstSession = sessions[0];
  const live = getSessionFromAnyManager(firstSession.sessionId);
  return { sessionId: firstSession.sessionId, status: live?.status || firstSession.status || "disconnected" };
}
