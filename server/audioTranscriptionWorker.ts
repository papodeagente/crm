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
 * - Never sends transcription to WhatsApp
 */

import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { getDb } from "./db";
import { eq, and } from "drizzle-orm";
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

// ── Redis Connection ───────────────────────────────────────────

let redisConnection: IORedis | null = null;
let transcriptionQueue: Queue | null = null;
let transcriptionWorker: Worker | null = null;

function getRedisUrl(): string | null {
  return process.env.REDIS_URL || null;
}

function getRedisConnection(): IORedis | null {
  if (redisConnection) return redisConnection;
  const url = getRedisUrl();
  if (!url) return null;
  try {
    redisConnection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });
    return redisConnection;
  } catch {
    return null;
  }
}

// ── Queue ──────────────────────────────────────────────────────

export function getTranscriptionQueue(): Queue | null {
  if (transcriptionQueue) return transcriptionQueue;
  const conn = getRedisConnection();
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
 * Returns true if enqueued, false if queue unavailable.
 */
export async function enqueueAudioTranscription(job: AudioTranscriptionJob): Promise<boolean> {
  const queue = getTranscriptionQueue();
  if (!queue) {
    // No Redis — process synchronously as fallback
    console.log(`[AudioTranscription] No Redis, processing synchronously for msg ${job.messageId}`);
    processTranscriptionJob(job).catch(err => {
      console.error(`[AudioTranscription] Sync fallback failed for msg ${job.messageId}:`, err.message);
    });
    return true;
  }

  try {
    await queue.add("transcribe", job, {
      jobId: `transcribe-${job.messageId}`,
      // Group by tenant for concurrency control
    });
    console.log(`[AudioTranscription] Enqueued msg ${job.messageId} (tenant ${job.tenantId})`);
    return true;
  } catch (err: any) {
    console.error(`[AudioTranscription] Failed to enqueue msg ${job.messageId}:`, err.message);
    return false;
  }
}

// ── Worker Processing ──────────────────────────────────────────

async function processTranscriptionJob(data: AudioTranscriptionJob): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { messageId, externalMessageId, sessionId, instanceName, tenantId, remoteJid, fromMe, mediaMimeType, mediaDuration } = data;

  console.log(`[AudioTranscription] Processing msg ${messageId} (tenant ${tenantId}, session ${sessionId})`);

  // ── Step 1: Check tenant AI settings ──
  const aiSettings = await getTenantAiSettings(tenantId);
  if (!aiSettings.audioTranscriptionEnabled) {
    console.log(`[AudioTranscription] Transcription disabled for tenant ${tenantId}, skipping`);
    return;
  }

  const aiIntegration = await getActiveAiIntegration(tenantId, "openai");
  if (!aiIntegration || !aiIntegration.apiKey) {
    console.log(`[AudioTranscription] No OpenAI API key for tenant ${tenantId}, skipping`);
    await db.update(waMessages)
      .set({ audioTranscriptionStatus: "failed" })
      .where(eq(waMessages.id, messageId));
    return;
  }

  // ── Step 2: Check duration limit ──
  if (mediaDuration && mediaDuration > MAX_AUDIO_DURATION_SEC) {
    console.log(`[AudioTranscription] Audio too long (${mediaDuration}s > ${MAX_AUDIO_DURATION_SEC}s), skipping msg ${messageId}`);
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
  let base64Data: string;
  let mimeType: string;
  try {
    const mediaResult = await evo.getBase64FromMediaMessage(instanceName, externalMessageId, {
      remoteJid,
      fromMe,
    });
    if (!mediaResult || !mediaResult.base64) {
      throw new Error("Failed to download media from Evolution API");
    }
    base64Data = mediaResult.base64;
    mimeType = mediaResult.mimetype || mediaMimeType || "audio/ogg";
  } catch (err: any) {
    console.error(`[AudioTranscription] Media download failed for msg ${messageId}:`, err.message);
    await db.update(waMessages)
      .set({ audioTranscriptionStatus: "failed" })
      .where(eq(waMessages.id, messageId));
    throw err; // Let BullMQ retry
  }

  // ── Step 5: Check size limit ──
  const sizeBytes = Buffer.from(base64Data, "base64").length;
  const sizeMB = sizeBytes / (1024 * 1024);
  if (sizeMB > MAX_AUDIO_SIZE_MB) {
    console.log(`[AudioTranscription] Audio too large (${sizeMB.toFixed(1)}MB > ${MAX_AUDIO_SIZE_MB}MB), skipping msg ${messageId}`);
    await db.update(waMessages)
      .set({ audioTranscriptionStatus: "failed" })
      .where(eq(waMessages.id, messageId));
    return;
  }

  // ── Step 6: Call OpenAI Whisper API with tenant's API key ──
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

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiIntegration.apiKey}`,
      },
      body: formData,
    });

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

    if (!result.text || typeof result.text !== "string") {
      throw new Error("Invalid Whisper API response: no text field");
    }

    // ── Step 7: Save transcription ──
    await db.update(waMessages)
      .set({
        audioTranscription: result.text,
        audioTranscriptionStatus: "completed",
        audioTranscriptionLanguage: result.language || "pt",
        audioTranscriptionDuration: result.duration ? Math.round(result.duration) : mediaDuration,
      })
      .where(eq(waMessages.id, messageId));

    console.log(`[AudioTranscription] Completed msg ${messageId}: "${result.text.substring(0, 80)}..." (${result.language}, ${result.duration?.toFixed(1)}s)`);

    // ── Step 8: Emit socket event to update CRM UI ──
    emitTranscriptionUpdate(tenantId, sessionId, messageId, {
      transcription: result.text,
      status: "completed",
      language: result.language || "pt",
      duration: result.duration ? Math.round(result.duration) : mediaDuration,
      remoteJid,
    });

  } catch (err: any) {
    console.error(`[AudioTranscription] Whisper API failed for msg ${messageId}:`, err.message);
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
  const conn = getRedisConnection();
  if (!conn) {
    console.log("[AudioTranscription] No Redis URL, worker not started (sync fallback active)");
    return;
  }

  transcriptionWorker = new Worker(
    QUEUE_NAME,
    async (job: Job<AudioTranscriptionJob>) => {
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
    console.log(`[AudioTranscription] Job ${job.id} completed`);
  });

  transcriptionWorker.on("failed", (job, err) => {
    console.error(`[AudioTranscription] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${MAX_RETRIES}):`, err.message);
  });

  console.log("[AudioTranscription] Worker started");
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
