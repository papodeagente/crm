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
 * Feature flag: process.env.USE_QUEUE (defaults to "true")
 */

import { Queue, Worker, Job, QueueEvents } from "bullmq";
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

function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://127.0.0.1:6379";
}

export function getRedisConnection(): IORedis | null {
  if (connectionFailed) return null;
  if (redisConnection) return redisConnection;

  // Check if REDIS_URL is configured — if not, skip silently
  if (!process.env.REDIS_URL) {
    connectionFailed = true;
    console.log("[Queue] No REDIS_URL configured — using synchronous message processing");
    return null;
  }

  try {
    let errorLogged = false;
    redisConnection = new IORedis(getRedisUrl(), {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: true,
      retryStrategy(times) {
        if (times > 3) {
          if (!errorLogged) {
            console.warn("[Queue] Redis connection failed after 3 retries, falling back to sync processing");
            errorLogged = true;
          }
          connectionFailed = true;
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redisConnection.on("ready", () => {
      connectionReady = true;
      connectionFailed = false;
      console.log("[Queue] Redis connected successfully");
    });

    redisConnection.on("error", (err) => {
      // Only log the first error, suppress subsequent ones
      if (!connectionFailed && !errorLogged) {
        console.warn("[Queue] Redis error:", err.message);
        errorLogged = true;
      }
    });

    redisConnection.on("close", () => {
      connectionReady = false;
    });

    // Try to connect
    redisConnection.connect().catch(() => {
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

export function isQueueEnabled(): boolean {
  const flag = process.env.USE_QUEUE ?? "true";
  return flag === "true" && !connectionFailed;
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
    const jobId = payload.data?.key?.id
      ? `${payload.sessionId}:${payload.data.key.id}`
      : undefined;

    await queue.add(payload.event, payload, {
      jobId, // Dedup: same messageId won't be enqueued twice
      priority: payload.event === "messages.upsert" ? 1 : 2,
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
            console.warn(`[Worker] Slow job ${job.id}: ${elapsed}ms`);
          }
        } catch (error: any) {
          console.error(`[Worker] Job ${job.id} failed:`, error.message);
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

    messageWorker.on("completed", (job) => {
      // Silent — logged only if slow
    });

    messageWorker.on("failed", (job, err) => {
      console.error(`[Worker] Job ${job?.id} permanently failed:`, err.message);
    });

    messageWorker.on("error", (err) => {
      console.error("[Worker] Worker error:", err.message);
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
