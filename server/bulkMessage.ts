/**
 * Bulk WhatsApp Messaging — Send template messages to multiple RFV contacts
 * with rate-limiting, progress tracking, and variable substitution.
 */
import { getDb } from "./db";
import { rfvContacts, whatsappSessions } from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { whatsappManager } from "./whatsapp";

// ─── Types ───
export interface BulkSendRequest {
  tenantId: number;
  contactIds: number[];
  messageTemplate: string;
  sessionId: string;
  delayMs?: number; // delay between messages (default 3000ms)
}

export interface BulkSendResult {
  total: number;
  sent: number;
  failed: number;
  skipped: number; // no phone number
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
 * Supported variables: {nome}, {email}, {telefone}, {publico}, {valor}
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
 * Runs asynchronously with progress tracking.
 */
export async function startBulkSend(request: BulkSendRequest): Promise<{ jobId: string }> {
  const { tenantId, contactIds, messageTemplate, sessionId, delayMs = 3000 } = request;
  const key = jobKey(tenantId);

  // Check if there's already a running job
  const existing = activeJobs.get(key);
  if (existing && existing.status === "running") {
    throw new Error("Já existe um envio em massa em andamento para esta agência. Aguarde ou cancele.");
  }

  // Verify session is connected
  const session = whatsappManager.getSession(sessionId);
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

  // Initialize job progress
  const job: BulkJobProgress = {
    tenantId,
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
  processBulkSend(key, job, contacts, messageTemplate, sessionId, delayMs).catch((err) => {
    console.error("[BulkSend] Fatal error:", err);
    job.status = "completed";
  });

  return { jobId: key };
}

async function processBulkSend(
  key: string,
  job: BulkJobProgress,
  contacts: any[],
  messageTemplate: string,
  sessionId: string,
  delayMs: number,
) {
  for (const contact of contacts) {
    // Check if cancelled
    if (job.status === "cancelled") {
      break;
    }

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
    } else {
      const jid = phoneToJid(contact.phone);
      if (!jid) {
        result.status = "skipped";
        result.error = "Telefone inválido";
        job.skipped++;
      } else {
        try {
          const message = interpolateTemplate(messageTemplate, contact);
          await whatsappManager.sendTextMessage(sessionId, jid, message);
          result.status = "sent";
          job.sent++;
        } catch (err: any) {
          result.status = "failed";
          result.error = err.message || "Erro desconhecido";
          job.failed++;
        }
      }
    }

    job.results.push(result);
    job.processed++;

    // Rate-limit delay between messages (skip for last message)
    if (job.status === "running" && job.processed < job.total) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  job.status = job.status === "cancelled" ? "cancelled" : "completed";

  // Clean up job after 5 minutes
  setTimeout(() => {
    activeJobs.delete(key);
  }, 5 * 60 * 1000);
}

/**
 * Get active session for a tenant
 */
export async function getActiveSessionForTenant(tenantId: number): Promise<{ sessionId: string; status: string } | null> {
  const db = await getDb();
  if (!db) return null;

  const sessions = await db
    .select()
    .from(whatsappSessions)
    .where(eq(whatsappSessions.tenantId, tenantId));

  // Find the first connected session
  for (const s of sessions) {
    const live = whatsappManager.getSession(s.sessionId);
    if (live && live.status === "connected") {
      return { sessionId: s.sessionId, status: "connected" };
    }
  }

  // Return first session even if disconnected
  if (sessions.length > 0) {
    const live = whatsappManager.getSession(sessions[0].sessionId);
    return { sessionId: sessions[0].sessionId, status: live?.status || "disconnected" };
  }

  return null;
}
