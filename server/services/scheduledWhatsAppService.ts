/**
 * ═══════════════════════════════════════════════════════════════
 * Scheduled WhatsApp Send Service
 * ═══════════════════════════════════════════════════════════════
 * 
 * Handles the lifecycle of whatsapp_scheduled_send tasks:
 * - Create / schedule / cancel / reschedule
 * - Process scheduled tasks via job worker with idempotent lock
 * - Send via existing WhatsApp infrastructure (no bypass)
 * - Link conversation to task owner in Inbox
 * - Full audit trail (DealHistory + ConversationEvents)
 * 
 * DOES NOT alter WhatsApp core, Inbox core, Z-API, or reconciliation.
 */

import { getDb } from "../db";
import { tasks, contacts, deals, dealHistory, conversationEvents, waConversations, conversationAssignments } from "../../drizzle/schema";
import { eq, and, lte, sql, isNull, or } from "drizzle-orm";
import { resolveConversation } from "../conversationResolver";
import { assignConversation } from "../db";
import { getActiveSessionForTenant } from "../bulkMessage";
import { whatsappManager } from "../whatsappEvolution";
import { randomUUID } from "crypto";

// ─── Constants ───
const TASK_TYPE = "whatsapp_scheduled_send";
const MAX_RETRIES = 3;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 min stale lock threshold

// ─── Types ───
export interface CreateScheduledWhatsAppInput {
  tenantId: number;
  entityType: string;
  entityId: number;
  contactId: number;
  dealId?: number;
  messageBody: string;
  scheduledAt: string; // ISO string
  timezone: string;
  channelId?: number;
  createdByUserId: number;
  assignedToUserId?: number;
  priority?: "low" | "medium" | "high" | "urgent";
  title?: string;
}

export interface RescheduleInput {
  taskId: number;
  tenantId: number;
  scheduledAt: string;
  timezone?: string;
  messageBody?: string;
}

// ─── Send text via WhatsApp manager (Z-API only) ───
async function sendTextViaAnyManager(sessionId: string, jid: string, text: string): Promise<any> {
  const session = whatsappManager.getSession(sessionId);
  if (session && session.status === "connected") {
    return whatsappManager.sendTextMessage(sessionId, jid, text);
  }
  throw new Error(`Sessão ${sessionId} não está conectada`);
}

// ─── Phone to JID ───
function phoneToJid(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `${withCountry}@s.whatsapp.net`;
}

// ═══════════════════════════════════════════════════════════════
// CREATE
// ═══════════════════════════════════════════════════════════════

export async function createScheduledWhatsApp(input: CreateScheduledWhatsAppInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Validate contact exists and belongs to tenant
  const [contact] = await db.select({ id: contacts.id, phone: contacts.phone, phoneE164: contacts.phoneE164, name: contacts.name })
    .from(contacts)
    .where(and(eq(contacts.tenantId, input.tenantId), eq(contacts.id, input.contactId)))
    .limit(1);

  if (!contact) throw new Error("Contato não encontrado neste tenant");

  const phone = contact.phoneE164 || contact.phone;
  if (!phone) throw new Error("Contato não possui telefone válido");

  const jid = phoneToJid(phone);
  if (!jid) throw new Error("Telefone do contato não é válido para WhatsApp");

  if (!input.messageBody || input.messageBody.trim().length === 0) {
    throw new Error("Mensagem não pode estar vazia");
  }

  const scheduledDate = new Date(input.scheduledAt);
  if (isNaN(scheduledDate.getTime())) throw new Error("Data de agendamento inválida");

  const title = input.title || `WhatsApp para ${contact.name || phone}`;

  const [result] = await db.insert(tasks).values({
    tenantId: input.tenantId,
    entityType: input.entityType,
    entityId: input.entityId,
    title,
    taskType: TASK_TYPE,
    dueAt: scheduledDate,
    status: "pending",
    priority: input.priority || "medium",
    assignedToUserId: input.assignedToUserId || input.createdByUserId,
    createdByUserId: input.createdByUserId,
    description: `Envio agendado de WhatsApp para ${contact.name || phone}`,
    waMessageBody: input.messageBody.trim(),
    waScheduledAt: scheduledDate,
    waTimezone: input.timezone || "America/Sao_Paulo",
    waStatus: "scheduled",
    waContactId: input.contactId,
    waChannelId: input.channelId || null,
    waRetryCount: 0,
  }).returning({ id: tasks.id });

  // Audit: deal history
  if (input.dealId) {
    await db.insert(dealHistory).values({
      tenantId: input.tenantId,
      dealId: input.dealId,
      action: "wa_scheduled_created",
      description: `Tarefa de envio WhatsApp agendada para ${scheduledDate.toLocaleString("pt-BR", { timeZone: input.timezone || "America/Sao_Paulo" })} — ${contact.name || phone}`,
      actorUserId: input.createdByUserId,
    });
  }

  console.log(`[WA-Scheduled] Created task #${result.id} for tenant ${input.tenantId}, contact ${input.contactId}, scheduled at ${input.scheduledAt}`);

  return { id: result.id, waStatus: "scheduled" };
}

// ═══════════════════════════════════════════════════════════════
// CANCEL
// ═══════════════════════════════════════════════════════════════

export async function cancelScheduledWhatsApp(taskId: number, tenantId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [task] = await db.select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId), eq(tasks.taskType, TASK_TYPE)))
    .limit(1);

  if (!task) throw new Error("Tarefa não encontrada");
  if (task.waStatus === "sent") throw new Error("Tarefa já foi enviada, não pode ser cancelada");
  if (task.waStatus === "processing") throw new Error("Tarefa está sendo processada, aguarde");
  if (task.waStatus === "cancelled") throw new Error("Tarefa já está cancelada");

  await db.update(tasks).set({
    waStatus: "cancelled",
    status: "cancelled",
  }).where(eq(tasks.id, taskId));

  // Audit
  if (task.entityType === "deal" && task.entityId) {
    await db.insert(dealHistory).values({
      tenantId,
      dealId: task.entityId,
      action: "wa_scheduled_cancelled",
      description: `Envio WhatsApp agendado cancelado — ${task.title}`,
      actorUserId: userId,
    });
  }

  console.log(`[WA-Scheduled] Task #${taskId} cancelled by user ${userId}`);
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// RESCHEDULE
// ═══════════════════════════════════════════════════════════════

export async function rescheduleWhatsApp(input: RescheduleInput, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [task] = await db.select()
    .from(tasks)
    .where(and(eq(tasks.id, input.taskId), eq(tasks.tenantId, input.tenantId), eq(tasks.taskType, TASK_TYPE)))
    .limit(1);

  if (!task) throw new Error("Tarefa não encontrada");
  if (task.waStatus === "sent") throw new Error("Tarefa já foi enviada");
  if (task.waStatus === "processing") throw new Error("Tarefa está sendo processada");

  const newDate = new Date(input.scheduledAt);
  if (isNaN(newDate.getTime())) throw new Error("Data inválida");

  const updateData: any = {
    waScheduledAt: newDate,
    dueAt: newDate,
    waStatus: "scheduled",
    waProcessingLockId: null,
    waProcessingLockedAt: null,
    waRetryCount: 0,
    waFailedAt: null,
    waFailureReason: null,
  };
  if (input.timezone) updateData.waTimezone = input.timezone;
  if (input.messageBody) updateData.waMessageBody = input.messageBody.trim();

  await db.update(tasks).set(updateData).where(eq(tasks.id, input.taskId));

  // Audit
  if (task.entityType === "deal" && task.entityId) {
    await db.insert(dealHistory).values({
      tenantId: input.tenantId,
      dealId: task.entityId,
      action: "wa_scheduled_rescheduled",
      description: `Envio WhatsApp reprogramado para ${newDate.toLocaleString("pt-BR", { timeZone: input.timezone || task.waTimezone || "America/Sao_Paulo" })}`,
      actorUserId: userId,
    });
  }

  console.log(`[WA-Scheduled] Task #${input.taskId} rescheduled to ${input.scheduledAt}`);
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// RETRY (manual)
// ═══════════════════════════════════════════════════════════════

export async function retryScheduledWhatsApp(taskId: number, tenantId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [task] = await db.select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId), eq(tasks.taskType, TASK_TYPE)))
    .limit(1);

  if (!task) throw new Error("Tarefa não encontrada");
  if (task.waStatus !== "failed") throw new Error("Apenas tarefas com falha podem ser reenviadas");

  await db.update(tasks).set({
    waStatus: "scheduled",
    waScheduledAt: new Date(), // send now
    waProcessingLockId: null,
    waProcessingLockedAt: null,
    waFailedAt: null,
    waFailureReason: null,
  }).where(eq(tasks.id, taskId));

  console.log(`[WA-Scheduled] Task #${taskId} retried by user ${userId}`);
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// JOB PROCESSOR — Idempotent, locked, safe
// ═══════════════════════════════════════════════════════════════

export async function processScheduledWhatsAppTasks(): Promise<{ processed: number; sent: number; failed: number }> {
  const db = await getDb();
  if (!db) return { processed: 0, sent: 0, failed: 0 };

  const now = new Date();
  const lockId = randomUUID();
  const staleLockThreshold = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  // Step 1: Atomically lock eligible tasks (scheduled + due + not locked or stale lock)
  const lockResult = await db.execute(sql`
    UPDATE crm_tasks
    SET "waProcessingLockId" = ${lockId},
        "waProcessingLockedAt" = NOW(),
        "waStatus" = 'processing'
    WHERE id IN (
      SELECT id FROM crm_tasks
      WHERE "taskType" = ${TASK_TYPE}
        AND "waStatus" IN ('scheduled')
        AND "waScheduledAt" <= ${now}
        AND ("waProcessingLockId" IS NULL OR "waProcessingLockedAt" < ${staleLockThreshold})
      LIMIT 10
      FOR UPDATE SKIP LOCKED
    )
  `);

  const lockedCount = lockResult.rowCount ?? 0;
  if (lockedCount === 0) return { processed: 0, sent: 0, failed: 0 };

  // Step 2: Fetch locked tasks
  const lockedTasks = await db.select()
    .from(tasks)
    .where(and(eq(tasks.waProcessingLockId, lockId), eq(tasks.waStatus, "processing" as any)));

  let sent = 0;
  let failed = 0;

  for (const task of lockedTasks) {
    try {
      await processSingleTask(db, task);
      sent++;
    } catch (err: any) {
      console.error(`[WA-Scheduled] Task #${task.id} failed:`, err.message);
      failed++;
    }
  }

  console.log(`[WA-Scheduled] Job complete: ${lockedTasks.length} processed, ${sent} sent, ${failed} failed`);
  return { processed: lockedTasks.length, sent, failed };
}

async function processSingleTask(db: any, task: any): Promise<void> {
  const tenantId = task.tenantId;
  const contactId = task.waContactId;
  const ownerUserId = task.assignedToUserId || task.createdByUserId;

  // ── Validate contact ──
  const [contact] = await db.select({ id: contacts.id, phone: contacts.phone, phoneE164: contacts.phoneE164, name: contacts.name })
    .from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
    .limit(1);

  if (!contact) {
    await markFailed(db, task.id, "Contato não encontrado");
    return;
  }

  const phone = contact.phoneE164 || contact.phone;
  if (!phone) {
    await markFailed(db, task.id, "Contato sem telefone válido");
    return;
  }

  const jid = phoneToJid(phone);
  if (!jid) {
    await markFailed(db, task.id, "Telefone inválido para WhatsApp");
    return;
  }

  // ── Get active session for tenant ──
  const session = await getActiveSessionForTenant(tenantId, ownerUserId);
  if (!session || session.status !== "connected") {
    const retryCount = (task.waRetryCount || 0) + 1;
    if (retryCount >= MAX_RETRIES) {
      await markFailed(db, task.id, `Canal WhatsApp indisponível após ${MAX_RETRIES} tentativas (status: ${session?.status || "sem sessão"})`, retryCount);
    } else {
      // Retry later — put back to scheduled
      await db.update(tasks).set({
        waStatus: "scheduled",
        waRetryCount: retryCount,
        waProcessingLockId: null,
        waProcessingLockedAt: null,
        waScheduledAt: new Date(Date.now() + 60_000 * retryCount), // backoff: 1min, 2min, 3min
      }).where(eq(tasks.id, task.id));
      console.log(`[WA-Scheduled] Task #${task.id} retry ${retryCount}/${MAX_RETRIES} — channel unavailable`);
    }
    return;
  }

  // ── SEND MESSAGE via existing infrastructure ──
  let sendResult: any;
  try {
    sendResult = await sendTextViaAnyManager(session.sessionId, jid, task.waMessageBody);
  } catch (err: any) {
    const retryCount = (task.waRetryCount || 0) + 1;
    if (retryCount >= MAX_RETRIES) {
      await markFailed(db, task.id, `Erro ao enviar: ${err.message}`, retryCount);
    } else {
      await db.update(tasks).set({
        waStatus: "scheduled",
        waRetryCount: retryCount,
        waProcessingLockId: null,
        waProcessingLockedAt: null,
        waScheduledAt: new Date(Date.now() + 60_000 * retryCount),
      }).where(eq(tasks.id, task.id));
    }
    return;
  }

  const waMessageId = sendResult?.key?.id || null;

  // ── Resolve/create conversation and link to task owner ──
  let conversationId: number | null = null;
  try {
    const convResult = await resolveConversation(tenantId, session.sessionId, jid, contact.id, contact.name);
    conversationId = convResult.conversationId;

    // Assign conversation to task owner
    await assignConversation(tenantId, session.sessionId, jid, ownerUserId, undefined, ownerUserId);

    // Log conversation event
    if (conversationId) {
      await db.insert(conversationEvents).values({
        tenantId,
        waConversationId: conversationId,
        sessionId: session.sessionId,
        remoteJid: jid,
        eventType: "wa_scheduled_send",
        toUserId: ownerUserId,
        metadata: JSON.stringify({
          taskId: task.id,
          waMessageId,
          scheduledAt: task.waScheduledAt,
          source: "scheduled_task",
        }),
      });
    }
  } catch (err: any) {
    console.error(`[WA-Scheduled] Task #${task.id} — conversation resolution warning:`, err.message);
    // Don't fail the task — message was already sent
  }

  // ── Mark as sent ──
  await db.update(tasks).set({
    waStatus: "sent",
    waSentAt: new Date(),
    waMessageId,
    waConversationId: conversationId,
    status: "done",
    waProcessingLockId: null,
    waProcessingLockedAt: null,
  }).where(eq(tasks.id, task.id));

  // ── Audit: deal history ──
  if (task.entityType === "deal" && task.entityId) {
    await db.insert(dealHistory).values({
      tenantId,
      dealId: task.entityId,
      action: "wa_scheduled_sent",
      description: `WhatsApp enviado para ${contact.name || phone} — tarefa agendada concluída`,
      actorUserId: ownerUserId,
      metadataJson: JSON.stringify({ taskId: task.id, waMessageId, conversationId }),
    });
  }

  console.log(`[WA-Scheduled] Task #${task.id} SENT to ${jid} (msgId: ${waMessageId}, convId: ${conversationId})`);
}

async function markFailed(db: any, taskId: number, reason: string, retryCount?: number): Promise<void> {
  await db.update(tasks).set({
    waStatus: "failed",
    waFailedAt: new Date(),
    waFailureReason: reason,
    waRetryCount: retryCount ?? undefined,
    waProcessingLockId: null,
    waProcessingLockedAt: null,
  }).where(eq(tasks.id, taskId));

  console.log(`[WA-Scheduled] Task #${taskId} FAILED: ${reason}`);
}

// ═══════════════════════════════════════════════════════════════
// JOB LIFECYCLE — Start/Stop interval
// ═══════════════════════════════════════════════════════════════

let jobInterval: ReturnType<typeof setInterval> | null = null;
const JOB_INTERVAL_MS = 30_000; // Check every 30 seconds

export function startScheduledWhatsAppWorker(): void {
  if (jobInterval) return;
  console.log(`[WA-Scheduled] Worker started (interval: ${JOB_INTERVAL_MS / 1000}s)`);
  jobInterval = setInterval(async () => {
    try {
      await processScheduledWhatsAppTasks();
    } catch (err: any) {
      console.error("[WA-Scheduled] Worker error:", err.message);
    }
  }, JOB_INTERVAL_MS);
}

export function stopScheduledWhatsAppWorker(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log("[WA-Scheduled] Worker stopped");
  }
}
