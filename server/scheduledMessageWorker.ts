/**
 * Scheduled Message Worker (BullMQ)
 *
 * Processes scheduled WhatsApp messages for the CRM:
 * - Delayed jobs fire at scheduledAt time
 * - Worker fetches scheduled message → resolves Z-API provider → sends
 * - Updates DB status → saves to wa_messages → updates wa_conversations → emits socket
 * - Safety sweep on startup + every 60s catches missed jobs (e.g. after restart)
 */

import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { getDb, getPendingScheduledMessages, markScheduledMessageSent, markScheduledMessageFailed } from "./db";
import { scheduledMessages, waMessages, waConversations } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { getIo } from "./socketSingleton";

// ═══════════════════════════════════════════════════════════════════════
// Redis Connection
// ═══════════════════════════════════════════════════════════════════════

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redis: IORedis | null = null;

function getRedis(): IORedis {
  if (!redis) {
    redis = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    redis.on("error", (err) => {
      console.error("[ScheduledMsg] Redis error:", err.message);
    });
  }
  return redis;
}

// ═══════════════════════════════════════════════════════════════════════
// Queue + Worker
// ═══════════════════════════════════════════════════════════════════════

const QUEUE_NAME = "crm-scheduled-messages";

let queue: Queue | null = null;
let worker: Worker | null = null;
let sweepInterval: ReturnType<typeof setInterval> | null = null;

interface ScheduledJobData {
  scheduledMessageId: number;
}

// ─── Worker processor ──────────────────────────────────────────────

async function processScheduledMessage(job: Job<ScheduledJobData>) {
  const { scheduledMessageId } = job.data;
  console.log(`[ScheduledMsg] Processing job ${job.id} → scheduledMessage #${scheduledMessageId}`);

  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // 1. Fetch the scheduled message
  const [msg] = await db.select().from(scheduledMessages).where(eq(scheduledMessages.id, scheduledMessageId)).limit(1);
  if (!msg) { console.log(`[ScheduledMsg] #${scheduledMessageId} not found, skipping`); return; }
  if (msg.status !== "pending") { console.log(`[ScheduledMsg] #${scheduledMessageId} status=${msg.status}, skipping`); return; }

  // 2. Resolve provider (Z-API) via sessionId
  let provider;
  try {
    const { resolveProviderForSession } = await import("./providers/providerFactory");
    provider = await resolveProviderForSession(msg.sessionId);
  } catch (err: any) {
    console.error(`[ScheduledMsg] #${scheduledMessageId} PERMANENT FAIL: no provider for session ${msg.sessionId}`);
    await markScheduledMessageFailed(scheduledMessageId);
    return;
  }

  // 3. Get instanceName from whatsappManager
  const { whatsappManager } = await import("./whatsappEvolution");
  const instanceName = whatsappManager.getInstanceNameForSession(msg.sessionId) || msg.sessionId;

  // 4. Send via provider
  const contentType = msg.contentType || "text";
  let sendResult;

  try {
    if (contentType === "text") {
      sendResult = await provider.sendText(instanceName, msg.remoteJid, msg.content);
    } else if (msg.mediaUrl) {
      const mediaMap: Record<string, "image" | "video" | "audio" | "document"> = {
        image: "image",
        video: "video",
        audio: "audio",
        document: "document",
      };
      sendResult = await provider.sendMedia(instanceName, msg.remoteJid, msg.mediaUrl, mediaMap[contentType] || "document", {
        caption: msg.content || undefined,
      });
    } else {
      sendResult = await provider.sendText(instanceName, msg.remoteJid, msg.content);
    }
  } catch (err: any) {
    // Network/API errors are transient → throw to let BullMQ retry
    throw err;
  }

  console.log(`[ScheduledMsg] #${scheduledMessageId} sent → messageId=${sendResult.messageId}`);

  // 5. Mark as sent
  await markScheduledMessageSent(scheduledMessageId);

  // 6. Save to wa_messages table
  const messageId = sendResult.messageId || `sched_${scheduledMessageId}_${Date.now()}`;

  await db.insert(waMessages).values({
    tenantId: msg.tenantId,
    sessionId: msg.sessionId,
    remoteJid: msg.remoteJid,
    messageId,
    fromMe: true,
    messageType: contentType,
    content: msg.content,
    mediaUrl: msg.mediaUrl,
    status: "sent",
    structuredData: { scheduled: true, scheduledMessageId },
  });

  // 7. Update wa_conversations lastMessage fields
  const preview = msg.content?.substring(0, 255) || (contentType !== "text" ? `[${contentType}]` : "");
  await db.update(waConversations)
    .set({
      lastMessagePreview: preview,
      lastMessageAt: new Date(),
      lastMessageType: contentType,
      lastFromMe: true,
    })
    .where(and(
      eq(waConversations.tenantId, msg.tenantId),
      eq(waConversations.sessionId, msg.sessionId),
      eq(waConversations.remoteJid, msg.remoteJid),
    ));

  // 8. Emit socket event
  const io = getIo();
  if (io) {
    io.emit("inbox:newMessage", {
      sessionId: msg.sessionId,
      remoteJid: msg.remoteJid,
      message: {
        messageId,
        fromMe: true,
        messageType: contentType,
        content: msg.content,
        mediaUrl: msg.mediaUrl,
        status: "sent",
        timestamp: new Date().toISOString(),
        scheduled: true,
      },
    });
  }

  console.log(`[ScheduledMsg] #${scheduledMessageId} complete ✓`);
}

// ─── Enqueue a delayed job ─────────────────────────────────────────

export async function enqueueScheduledMessage(scheduledMessageId: number, scheduledAt: Date) {
  if (!queue) {
    console.warn("[ScheduledMsg] Queue not initialized, cannot enqueue");
    return;
  }
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  await queue.add(
    "send",
    { scheduledMessageId } satisfies ScheduledJobData,
    {
      delay,
      jobId: `sched-${scheduledMessageId}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  );
  console.log(`[ScheduledMsg] Enqueued #${scheduledMessageId} with delay=${Math.round(delay / 1000)}s`);
}

// ─── Remove a delayed job (on cancel) ──────────────────────────────

export async function cancelScheduledJob(scheduledMessageId: number) {
  if (!queue) return;
  try {
    const job = await queue.getJob(`sched-${scheduledMessageId}`);
    if (job) await job.remove();
    console.log(`[ScheduledMsg] Removed job sched-${scheduledMessageId}`);
  } catch (err: any) {
    console.warn(`[ScheduledMsg] Could not remove job sched-${scheduledMessageId}:`, err.message);
  }
}

// ─── Safety sweep: enqueue any missed pending messages ─────────────

async function sweepPendingMessages() {
  try {
    const pending = await getPendingScheduledMessages();
    if (pending.length === 0) return;
    console.log(`[ScheduledMsg] Sweep found ${pending.length} missed messages`);
    for (const msg of pending) {
      await enqueueScheduledMessage(msg.id, msg.scheduledAt);
    }
  } catch (err: any) {
    console.error("[ScheduledMsg] Sweep error:", err.message);
  }
}

// ─── Init / Shutdown ───────────────────────────────────────────────

export async function initScheduledMessageWorker() {
  const connection = getRedis();

  queue = new Queue(QUEUE_NAME, { connection });

  worker = new Worker(QUEUE_NAME, processScheduledMessage, {
    connection,
    concurrency: 3,
  });

  worker.on("failed", (job, err) => {
    console.error(`[ScheduledMsg] Job ${job?.id} failed:`, err.message);
  });

  worker.on("completed", (job) => {
    console.log(`[ScheduledMsg] Job ${job.id} completed`);
  });

  // Initial sweep for any messages missed during downtime
  await sweepPendingMessages();

  // Periodic sweep every 60s as safety net
  sweepInterval = setInterval(sweepPendingMessages, 60_000);

  console.log("[ScheduledMsg] Queue + Worker initialized ✓");
}

export async function shutdownScheduledMessageWorker() {
  if (sweepInterval) clearInterval(sweepInterval);
  if (worker) await worker.close();
  if (queue) await queue.close();
  if (redis) redis.disconnect();
  console.log("[ScheduledMsg] Shutdown complete");
}
