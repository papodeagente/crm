/**
 * Audio Transcription Worker — Background processing for WhatsApp audio messages
 * 
 * Uses BullMQ + Redis for async processing:
 * 1. Audio message detected → job enqueued
 * 2. Worker downloads audio from Evolution API (base64)
 * 3. Worker sends audio to OpenAI Whisper API using tenant's API key
 * 4. Transcription saved to wa_messages
 * 5. Socket event emitted to update CRM UI
 * 
 * Safety:
 * - Max 3 concurrent jobs per tenant
 * - Max 25MB audio size
 * - Max 5 min audio duration
 * - 3 retries on failure
 * - Timeout safety: jobs stuck in "processing" > 3min are marked failed
 * - Never sends transcription to WhatsApp
 * 
 * IMPORTANT: BullMQ requires SEPARATE Redis connections for Queue and Worker.
 * Sharing a single connection causes deadlock where the worker never consumes jobs.
 * 
 * Redis connection pattern aligned with messageQueue.ts:
 * - enableReadyCheck: true
 * - lazyConnect: true
 * - explicit conn.connect()
 * - "ready" event tracking (not "connect")
 * - connectionReady/connectionFailed flags
 */

import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { getDb } from "./db";
import { eq, and, lt } from "drizzle-orm";
import { waMessages } from "../drizzle/schema";
import { getActiveAiIntegration, getTenantAiSettings } from "./db";
import * as evo from "./evolutionApi";

// ── Types ──────────────────────────────────────────────────────

export interface AudioTranscriptionJob {
  messageId: number;        // DB row id
  externalMessageId: string; // WhatsApp message ID
  sessionId: string;
  instanceName: string;
  tenantId: number;
  remoteJid: string;
  fromMe: boolean;
  mediaMimeType: string;
  mediaDuration: number | null;
}

// ── Constants ──────────────────────────────────────────────────

const QUEUE_NAME = "audio-transcription";
const MAX_AUDIO_SIZE_MB = 25;
const MAX_AUDIO_DURATION_SEC = 300; // 5 minutes
const MAX_CONCURRENT_PER_TENANT = 3;
const MAX_RETRIES = 3;
const PROCESSING_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes — mark as failed if stuck

// ── Redis Connections (SEPARATE for Queue and Worker) ─────────
// Pattern aligned with messageQueue.ts: enableReadyCheck, lazyConnect, ready event

let queueRedis: IORedis | null = null;
let workerRedis: IORedis | null = null;
let transcriptionQueue: Queue | null = null;
let transcriptionWorker: Worker | null = null;

let queueConnectionReady = false;
let queueConnectionFailed = false;
let workerConnectionReady = false;
let workerConnectionFailed = false;

function getRedisUrl(): string | null {
  return process.env.REDIS_URL || null;
}

function createRedisConnection(label: string, onReady: () => void, onFailed: () => void): IORedis | null {
  const url = getRedisUrl();
  if (!url) return null;

  try {
    let firstErrorLogged = false;

    const conn = new IORedis(url, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: true,
      connectTimeout: 10000,
      retryStrategy(times) {
        if (times > 5) {
          if (!firstErrorLogged) {
            console.warn(`[AudioTranscription] Redis ${label} connection failed after 5 retries`);
            firstErrorLogged = true;
          }
          onFailed();
          return null; // Stop retrying
        }
        return Math.min(times * 500, 3000);
      },
      lazyConnect: true,
    });

    conn.on("ready", () => {
      onReady();
      console.log(`[AudioTranscription] Redis ${label} ready`);
    });

    conn.on("error", (err) => {
      if (!firstErrorLogged) {
        console.warn(`[AudioTranscription] Redis ${label} error:`, err.message);
        firstErrorLogged = true;
      }
    });

    conn.on("close", () => {
      // Silent close
    });

    conn.on("reconnecting", () => {
      // Silent reconnection
    });

    // Initiate connection explicitly
    conn.connect().catch((err) => {
      if (!firstErrorLogged) {
        console.warn(`[AudioTranscription] Redis ${label} connect failed:`, err.message);
        firstErrorLogged = true;
      }
      onFailed();
    });

    return conn;
  } catch (err: any) {
    console.error(`[AudioTranscription] Redis ${label} creation failed:`, err.message);
    onFailed();
    return null;
  }
}

function getQueueRedis(): IORedis | null {
  if (queueConnectionFailed) return null;
  if (queueRedis) return queueRedis;
  queueRedis = createRedisConnection(
    "queue",
    () => { queueConnectionReady = true; queueConnectionFailed = false; },
    () => { queueConnectionFailed = true; }
  );
  return queueRedis;
}

function getWorkerRedis(): IORedis | null {
  if (workerConnectionFailed) return null;
  if (workerRedis) return workerRedis;
  workerRedis = createRedisConnection(
    "worker",
    () => { workerConnectionReady = true; workerConnectionFailed = false; },
    () => { workerConnectionFailed = true; }
  );
  return workerRedis;
}

// ── Queue ──────────────────────────────────────────────────────

export function getTranscriptionQueue(): Queue | null {
  if (transcriptionQueue) return transcriptionQueue;
  const conn = getQueueRedis();
  if (!conn) return null;
  transcriptionQueue = new Queue(QUEUE_NAME, {
    connection: conn,
    defaultJobOptions: {
      attempts: MAX_RETRIES,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  });
  return transcriptionQueue;
}

/**
 * Enqueue an audio message for transcription.
 * If Redis/BullMQ is unavailable, falls back to synchronous processing.
 */
export async function enqueueAudioTranscription(job: AudioTranscriptionJob): Promise<boolean> {
  const t0 = Date.now();
  const queue = getTranscriptionQueue();

  // If queue is null (no Redis URL or connection failed), use sync fallback
  if (!queue) {
    console.log(`[TRANSCRIPTION_JOB_CREATED] msgId=${job.messageId} mode=sync_fallback (no Redis)`);
    processTranscriptionJob(job).catch(err => {
      console.error(`[TRANSCRIPTION_FAILED] msgId=${job.messageId} stage=sync_fallback error="${err.message}"`);
    });
    return true;
  }

  // If queue exists but Redis connection is not ready yet, also use sync fallback
  if (!queueConnectionReady) {
    console.log(`[TRANSCRIPTION_JOB_CREATED] msgId=${job.messageId} mode=sync_fallback (Redis not ready)`);
    processTranscriptionJob(job).catch(err => {
      console.error(`[TRANSCRIPTION_FAILED] msgId=${job.messageId} stage=sync_fallback error="${err.message}"`);
    });
    return true;
  }

  try {
    await queue.add("transcribe", job, {
      jobId: `transcribe-${job.messageId}`,
    });
    console.log(`[TRANSCRIPTION_JOB_CREATED] msgId=${job.messageId} tenant=${job.tenantId} session=${job.sessionId} mode=bullmq enqueueMs=${Date.now() - t0}`);
    return true;
  } catch (err: any) {
    // BullMQ enqueue failed — fall back to sync processing
    console.error(`[TRANSCRIPTION_ENQUEUE_FAILED] msgId=${job.messageId} error="${err.message}" — falling back to sync`);
    processTranscriptionJob(job).catch(syncErr => {
      console.error(`[TRANSCRIPTION_FAILED] msgId=${job.messageId} stage=sync_fallback error="${syncErr.message}"`);
    });
    return true;
  }
}

// ── Worker Processing ──────────────────────────────────────────

async function processTranscriptionJob(data: AudioTranscriptionJob): Promise<void> {
  const pipelineStart = Date.now();
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { messageId, externalMessageId, sessionId, instanceName, tenantId, remoteJid, fromMe, mediaMimeType, mediaDuration } = data;

  console.log(`[TRANSCRIPTION_PROCESSING] msgId=${messageId} tenant=${tenantId} session=${sessionId} instance=${instanceName}`);

  // ── Step 1: Check tenant AI settings ──
  const t1 = Date.now();
  const aiSettings = await getTenantAiSettings(tenantId);
  if (!aiSettings.audioTranscriptionEnabled) {
    console.log(`[TRANSCRIPTION_SKIPPED] msgId=${messageId} reason=transcription_disabled tenant=${tenantId} checkMs=${Date.now() - t1}`);
    return;
  }

  const aiIntegration = await getActiveAiIntegration(tenantId, "openai");
  if (!aiIntegration || !aiIntegration.apiKey) {
    console.log(`[TRANSCRIPTION_SKIPPED] msgId=${messageId} reason=no_openai_key tenant=${tenantId} checkMs=${Date.now() - t1}`);
    await db.update(waMessages)
      .set({ audioTranscriptionStatus: "failed" })
      .where(eq(waMessages.id, messageId));
    return;
  }
  console.log(`[AI_SETTINGS_CHECKED] msgId=${messageId} hasKey=true checkMs=${Date.now() - t1}`);

  // ── Step 2: Check duration limit ──
  if (mediaDuration && mediaDuration > MAX_AUDIO_DURATION_SEC) {
    console.log(`[TRANSCRIPTION_SKIPPED] msgId=${messageId} reason=too_long duration=${mediaDuration}s max=${MAX_AUDIO_DURATION_SEC}s`);
    await db.update(waMessages)
      .set({ audioTranscriptionStatus: "failed" })
      .where(eq(waMessages.id, messageId));
    return;
  }

  // ── Step 3: Set status to processing ──
  await db.update(waMessages)
    .set({ audioTranscriptionStatus: "processing" })
    .where(eq(waMessages.id, messageId));

  // ── Step 4: Download audio from Evolution API ──
  const t4 = Date.now();
  let base64Data: string;
  let mimeType: string;
  try {
    console.log(`[AUDIO_DOWNLOAD_STARTED] msgId=${messageId} instance=${instanceName} extMsgId=${externalMessageId}`);
    const mediaResult = await evo.getBase64FromMediaMessage(instanceName, externalMessageId, {
      remoteJid,
      fromMe,
    });
    if (!mediaResult || !mediaResult.base64) {
      throw new Error("Failed to download media from Evolution API — empty base64");
    }
    base64Data = mediaResult.base64;
    mimeType = mediaResult.mimetype || mediaMimeType || "audio/ogg";
    const sizeMB = (Buffer.from(base64Data, "base64").length / (1024 * 1024)).toFixed(2);
    console.log(`[AUDIO_DOWNLOAD_FINISHED] msgId=${messageId} sizeMB=${sizeMB} mimeType=${mimeType} downloadMs=${Date.now() - t4}`);
  } catch (err: any) {
    console.error(`[TRANSCRIPTION_FAILED] msgId=${messageId} stage=media_download error="${err.message}" downloadMs=${Date.now() - t4}`);
    await db.update(waMessages)
      .set({ audioTranscriptionStatus: "failed" })
      .where(eq(waMessages.id, messageId));
    throw err; // Let BullMQ retry (or propagate in sync mode)
  }

  // ── Step 5: Check size limit ──
  const sizeBytes = Buffer.from(base64Data, "base64").length;
  const sizeMB = sizeBytes / (1024 * 1024);
  if (sizeMB > MAX_AUDIO_SIZE_MB) {
    console.log(`[TRANSCRIPTION_SKIPPED] msgId=${messageId} reason=too_large sizeMB=${sizeMB.toFixed(1)} max=${MAX_AUDIO_SIZE_MB}MB`);
    await db.update(waMessages)
      .set({ audioTranscriptionStatus: "failed" })
      .where(eq(waMessages.id, messageId));
    return;
  }

  // ── Step 6: Call OpenAI Whisper API with tenant's API key ──
  const t6 = Date.now();
  try {
    const audioBuffer = Buffer.from(base64Data, "base64");
    const ext = getFileExtension(mimeType);
    const filename = `audio.${ext}`;

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", audioBlob, filename);
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    formData.append("prompt", "Transcreva o áudio do usuário para texto. O idioma principal é português brasileiro.");

    console.log(`[OPENAI_REQUEST_STARTED] msgId=${messageId} sizeMB=${sizeMB.toFixed(2)} mimeType=${mimeType} ext=${ext}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout for OpenAI

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiIntegration.apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Whisper API error: ${response.status} ${response.statusText} ${errorText}`);
    }

    const result = await response.json() as {
      text: string;
      language?: string;
      duration?: number;
      segments?: any[];
    };

    console.log(`[OPENAI_REQUEST_FINISHED] msgId=${messageId} status=${response.status} language=${result.language} duration=${result.duration?.toFixed(1)}s whisperMs=${Date.now() - t6}`);

    if (!result.text || typeof result.text !== "string") {
      throw new Error("Invalid Whisper API response: no text field");
    }

    // ── Step 7: Save transcription ──
    const t7 = Date.now();
    await db.update(waMessages)
      .set({
        audioTranscription: result.text,
        audioTranscriptionStatus: "completed",
        audioTranscriptionLanguage: result.language || "pt",
        audioTranscriptionDuration: result.duration ? Math.round(result.duration) : mediaDuration,
      })
      .where(eq(waMessages.id, messageId));

    console.log(`[TRANSCRIPT_SAVED_DB] msgId=${messageId} textLen=${result.text.length} saveMs=${Date.now() - t7}`);

    // ── Step 8: Emit socket event to update CRM UI ──
    const t8 = Date.now();
    emitTranscriptionUpdate(tenantId, sessionId, messageId, {
      transcription: result.text,
      status: "completed",
      language: result.language || "pt",
      duration: result.duration ? Math.round(result.duration) : mediaDuration,
      remoteJid,
    });

    console.log(`[SOCKET_EMIT_TRANSCRIPT] msgId=${messageId} emitMs=${Date.now() - t8}`);
    console.log(`[TRANSCRIPTION_COMPLETED] msgId=${messageId} text="${result.text.substring(0, 80)}..." totalMs=${Date.now() - pipelineStart}`);

  } catch (err: any) {
    const isAbort = err.name === "AbortError";
    console.error(`[TRANSCRIPTION_FAILED] msgId=${messageId} stage=openai_request error="${isAbort ? "TIMEOUT (120s)" : err.message}" whisperMs=${Date.now() - t6} totalMs=${Date.now() - pipelineStart}`);
    await db.update(waMessages)
      .set({ audioTranscriptionStatus: "failed" })
      .where(eq(waMessages.id, messageId));
    throw err; // Let BullMQ retry
  }
}

// ── Socket Emit ────────────────────────────────────────────────

function emitTranscriptionUpdate(
  tenantId: number,
  sessionId: string,
  messageId: number,
  data: { transcription: string; status: string; language: string; duration: number | null; remoteJid: string }
) {
  try {
    const { getIo } = require("./socketSingleton");
    const io = getIo();
    if (io) {
      io.emit("whatsapp:transcription", {
        tenantId,
        sessionId,
        messageId,
        remoteJid: data.remoteJid,
        status: data.status,
        text: data.transcription,
        language: data.language,
        duration: data.duration,
      });
    }
  } catch (err: any) {
    console.error(`[AudioTranscription] Socket emit failed:`, err.message);
  }
}

// ── Worker Initialization ──────────────────────────────────────

export function initAudioTranscriptionWorker(): void {
  // IMPORTANT: Worker MUST use a SEPARATE Redis connection from the Queue.
  // Sharing connections causes BullMQ deadlock where worker never consumes jobs.
  const conn = getWorkerRedis();
  if (!conn) {
    console.log("[AudioTranscription] No Redis URL, worker not started (sync fallback active)");
    return;
  }

  // Wait for Redis to be ready before creating the worker
  // BullMQ needs a fully ready connection to start consuming
  const startWorker = () => {
    if (transcriptionWorker) return; // Already started

    transcriptionWorker = new Worker(
      QUEUE_NAME,
      async (job: Job<AudioTranscriptionJob>) => {
        console.log(`[AudioTranscription] Worker picked up job ${job.id} (msgId=${job.data.messageId})`);
        await processTranscriptionJob(job.data);
      },
      {
        connection: conn,
        concurrency: MAX_CONCURRENT_PER_TENANT,
        limiter: {
          max: MAX_CONCURRENT_PER_TENANT,
          duration: 1000,
        },
      }
    );

    transcriptionWorker.on("completed", (job) => {
      console.log(`[AudioTranscription] Job ${job.id} completed successfully`);
    });

    transcriptionWorker.on("failed", (job, err) => {
      console.error(`[AudioTranscription] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${MAX_RETRIES}): ${err.message}`);
    });

    transcriptionWorker.on("error", (err) => {
      console.error(`[AudioTranscription] Worker error:`, err.message);
    });

    transcriptionWorker.on("active", (job) => {
      console.log(`[AudioTranscription] Job ${job.id} now active`);
    });

    console.log("[AudioTranscription] Worker started (separate Redis connections for queue and worker)");

    // ── Timeout Safety: recover stuck "processing" jobs ──
    startStuckJobRecovery();
  };

  // If already ready, start immediately
  if (workerConnectionReady) {
    startWorker();
  } else {
    // Wait for the ready event
    conn.once("ready", () => {
      startWorker();
    });

    // Also handle case where connection fails
    const failTimeout = setTimeout(() => {
      if (!workerConnectionReady && !transcriptionWorker) {
        console.warn("[AudioTranscription] Redis worker connection timed out after 15s — sync fallback active");
      }
    }, 15000);

    conn.once("ready", () => clearTimeout(failTimeout));
  }
}

// ── Stuck Job Recovery ─────────────────────────────────────────

/**
 * Periodically checks for messages stuck in "processing" status for too long
 * and marks them as "failed" so they can be retried or shown as errors.
 */
function startStuckJobRecovery(): void {
  const RECOVERY_INTERVAL_MS = 60_000; // Check every minute

  setInterval(async () => {
    try {
      const db = await getDb();
      if (!db) return;

      const cutoff = new Date(Date.now() - PROCESSING_TIMEOUT_MS);
      
      // Find messages stuck in "processing" for more than PROCESSING_TIMEOUT_MS
      const stuck = await db.select({ id: waMessages.id, messageId: waMessages.messageId })
        .from(waMessages)
        .where(and(
          eq(waMessages.audioTranscriptionStatus, "processing"),
          lt(waMessages.createdAt, cutoff)
        ))
        .limit(50);

      if (stuck.length > 0) {
        console.log(`[STUCK_JOB_RECOVERY] Found ${stuck.length} stuck transcription jobs, marking as failed`);
        for (const msg of stuck) {
          await db.update(waMessages)
            .set({ audioTranscriptionStatus: "failed" })
            .where(eq(waMessages.id, msg.id));
          console.log(`[STUCK_JOB_RECOVERY] Marked msgId=${msg.id} (extId=${msg.messageId}) as failed`);
        }
      }
    } catch (err: any) {
      console.error(`[STUCK_JOB_RECOVERY] Error:`, err.message);
    }
  }, RECOVERY_INTERVAL_MS);
}

/**
 * Recover all pending jobs that were never picked up by the worker.
 * Called once at startup to re-enqueue orphaned jobs.
 */
export async function recoverPendingJobs(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const pending = await db.select({
    id: waMessages.id,
    messageId: waMessages.messageId,
    sessionId: waMessages.sessionId,
    remoteJid: waMessages.remoteJid,
    fromMe: waMessages.fromMe,
  })
    .from(waMessages)
    .where(eq(waMessages.audioTranscriptionStatus, "pending"))
    .limit(100);

  if (pending.length === 0) return 0;

  console.log(`[PENDING_JOB_RECOVERY] Found ${pending.length} pending transcription jobs, marking as failed for retry`);

  // Mark all as failed so the UI shows the correct state and user can retry
  for (const msg of pending) {
    await db.update(waMessages)
      .set({ audioTranscriptionStatus: "failed" })
      .where(eq(waMessages.id, msg.id));
  }

  return pending.length;
}

// ── Helpers ────────────────────────────────────────────────────

function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/opus": "ogg",
    "audio/ogg; codecs=opus": "ogg",
  };
  return mimeToExt[mimeType] || "ogg";
}
