/**
 * Message Queue Infrastructure — BullMQ + Redis
 * 
 * Provides event-driven message processing with:
 * - Fast webhook ACK (enqueue only)
 * - Worker-based async processing
 * - Deduplication via messageId
 * - Retry with exponential backoff
 * - Graceful fallback to synchronous processing if Redis unavailable
 * 
 * Requires: REDIS_URL environment variable (e.g., redis://host:6379)
 * Optional: USE_QUEUE=false to force synchronous processing
 */

import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";

// ── Types ──────────────────────────────────────────────────────

export interface MessageEventPayload {
  tenantId: number;
  sessionId: string;
  instanceName: string;
  event: string;
  data: any;
  receivedAt: number; // timestamp when webhook received the event
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// ── Redis Connection ───────────────────────────────────────────

let redisConnection: IORedis | null = null;
let connectionReady = false;
let connectionFailed = false;
let initAttempted = false;

function getRedisUrl(): string | null {
  return process.env.REDIS_URL || null;
}

/**
 * Get or create the Redis connection.
 * Returns null if REDIS_URL is not configured or connection failed.
 */
export function getRedisConnection(): IORedis | null {
  if (connectionFailed) return null;
  if (redisConnection && connectionReady) return redisConnection;
  if (redisConnection) return redisConnection; // Connection in progress
  if (initAttempted) return null; // Already tried and failed

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    connectionFailed = true;
    initAttempted = true;
    console.log("[Queue] No REDIS_URL configured — using synchronous message processing");
    return null;
  }

  initAttempted = true;

  try {
    let firstErrorLogged = false;

    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: true,
      connectTimeout: 10000,
      retryStrategy(times) {
        if (times > 5) {
          if (!firstErrorLogged) {
            console.warn("[Queue] Redis connection failed after 5 retries — falling back to sync processing");
            firstErrorLogged = true;
          }
          connectionFailed = true;
          return null; // Stop retrying
        }
        return Math.min(times * 500, 3000);
      },
      lazyConnect: true,
    });

    redisConnection.on("ready", () => {
      connectionReady = true;
      connectionFailed = false;
      console.log("Redis connected - async queue enabled");
    });

    redisConnection.on("error", (err) => {
      if (!firstErrorLogged) {
        console.warn("[Queue] Redis error:", err.message);
        firstErrorLogged = true;
      }
    });

    redisConnection.on("close", () => {
      connectionReady = false;
    });

    redisConnection.on("reconnecting", () => {
      // Silent reconnection
    });

    // Initiate connection
    redisConnection.connect().catch((err) => {
      if (!firstErrorLogged) {
        console.warn("[Queue] Redis connect failed:", err.message);
        firstErrorLogged = true;
      }
      connectionFailed = true;
      redisConnection = null;
    });

    return redisConnection;
  } catch (e: any) {
    console.warn("[Queue] Failed to create Redis connection:", e.message);
    connectionFailed = true;
    return null;
  }
}

/**
 * Check if the queue system is enabled and available.
 * Returns true only when Redis is connected and USE_QUEUE is not explicitly disabled.
 */
export function isQueueEnabled(): boolean {
  const flag = process.env.USE_QUEUE ?? "true";
  if (flag !== "true") return false;
  
  // Try to get connection if not yet attempted
  if (!initAttempted) {
    getRedisConnection();
  }
  
  return !connectionFailed;
}

export function isRedisReady(): boolean {
  return connectionReady && !connectionFailed;
}

// ── Queue Instances ────────────────────────────────────────────

const QUEUE_NAME = "whatsapp-messages";

let messageQueue: Queue | null = null;
let messageWorker: Worker | null = null;

export function getMessageQueue(): Queue | null {
  if (messageQueue) return messageQueue;
  
  const redis = getRedisConnection();
  if (!redis) return null;

  try {
    messageQueue = new Queue(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
        removeOnFail: { count: 5000 },     // Keep last 5000 failed jobs
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000, // 1s, 2s, 4s
        },
      },
    });

    console.log("[Queue] Message queue created");
    return messageQueue;
  } catch (e: any) {
    console.warn("[Queue] Failed to create message queue:", e.message);
    return null;
  }
}

// ── Enqueue ────────────────────────────────────────────────────

/**
 * Enqueue a webhook event for async processing.
 * Returns true if enqueued, false if queue unavailable (caller should process sync).
 */
export async function enqueueMessageEvent(payload: MessageEventPayload): Promise<boolean> {
  const queue = getMessageQueue();
  if (!queue) return false;

  try {
    // BullMQ does not allow colons (:) in custom job IDs — use dashes instead
    let jobId: string | undefined;
    if (payload.event === "messages.upsert" || payload.event === "send.message") {
      jobId = payload.data?.key?.id
        ? `${payload.instanceName}-${payload.data.key.id}`.replace(/:/g, "-")
        : undefined;
    } else if (payload.event === "messages.update") {
      // For status updates, allow multiple updates for the same message
      const updateId = payload.data?.key?.id || payload.data?.keyId || payload.data?.messageId;
      const status = payload.data?.update?.status ?? payload.data?.status;
      jobId = updateId ? `status-${payload.instanceName}-${updateId}-${status}`.replace(/:/g, "-") : undefined;
    } else if (payload.event === "messages.delete") {
      const deleteId = payload.data?.key?.id || payload.data?.id;
      jobId = deleteId ? `delete-${payload.instanceName}-${deleteId}`.replace(/:/g, "-") : undefined;
    }

    // Priority: status updates are lower priority than new messages
    const priority = (payload.event === "messages.upsert" || payload.event === "send.message") ? 1 : 2;

    await queue.add(payload.event, payload, {
      jobId,
      priority,
    });

    return true;
  } catch (e: any) {
    console.warn("[Queue] Failed to enqueue event:", e.message);
    return false;
  }
}

// ── Worker Setup ───────────────────────────────────────────────

type MessageProcessor = (payload: MessageEventPayload) => Promise<void>;

/**
 * Start the message processing worker.
 * The processor function should handle the actual message processing logic.
 */
export function startMessageWorker(processor: MessageProcessor): Worker | null {
  if (messageWorker) return messageWorker;

  const redis = getRedisConnection();
  if (!redis) return null;

  try {
    messageWorker = new Worker(
      QUEUE_NAME,
      async (job: Job<MessageEventPayload>) => {
        const startTime = Date.now();
        const { data: payload } = job;

        try {
          await processor(payload);
          
          const elapsed = Date.now() - startTime;
          if (elapsed > 1000) {
            console.warn(`[Worker] Slow job ${job.id}: ${elapsed}ms (${payload.event})`);
          }
        } catch (error: any) {
          console.error(`[Worker] Job ${job.id} failed (${payload.event}):`, error.message);
          throw error; // BullMQ will retry based on attempts config
        }
      },
      {
        connection: redis,
        concurrency: 5, // Process up to 5 messages in parallel
        limiter: {
          max: 50,      // Max 50 jobs
          duration: 1000, // per second
        },
      }
    );

    messageWorker.on("completed", (_job) => {
      // Silent — logged only if slow
    });

    messageWorker.on("failed", (job, err) => {
      console.error(`[Worker] Job ${job?.id} permanently failed:`, err.message);
    });

    let workerErrorCount = 0;
    messageWorker.on("error", (err) => {
      workerErrorCount++;
      if (workerErrorCount <= 3) {
        console.error("[Worker] Worker error:", err.message);
        if (workerErrorCount === 3) {
          console.warn("[Worker] Suppressing further worker errors (Redis unavailable, sync fallback active)");
        }
      }
    });

    console.log("[Queue] Message worker started (concurrency: 5)");
    return messageWorker;
  } catch (e: any) {
    console.warn("[Queue] Failed to start worker:", e.message);
    return null;
  }
}

// ── Stats ──────────────────────────────────────────────────────

export async function getQueueStats(): Promise<QueueStats | null> {
  const queue = getMessageQueue();
  if (!queue) return null;

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  } catch {
    return null;
  }
}

// ── Graceful Shutdown ──────────────────────────────────────────

export async function shutdownQueue(): Promise<void> {
  try {
    if (messageWorker) {
      await messageWorker.close();
      messageWorker = null;
    }
    if (messageQueue) {
      await messageQueue.close();
      messageQueue = null;
    }
    if (redisConnection) {
      redisConnection.disconnect();
      redisConnection = null;
    }
    connectionReady = false;
    console.log("[Queue] Graceful shutdown complete");
  } catch (e: any) {
    console.error("[Queue] Shutdown error:", e.message);
  }
}
