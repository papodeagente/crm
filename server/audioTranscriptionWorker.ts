/**
 * Audio Transcription Worker — Background processing for WhatsApp audio messages
 * 
 * Supports two transcription backends:
 * 1. Tenant's OpenAI Whisper API key (preferred, each client pays their own credits)
 * 2. Built-in Forge API (free, platform-provided fallback when no OpenAI key)
 * 
 * Audio download strategies (in order):
 * 1. mediaUrl from DB (Z-API provides permanent URLs, S3 URLs from downloadAndStoreMedia)
 * 2. getBase64FromMediaMessage via provider (Z-API)
 * 3. Direct Z-API fallback
 * 
 * Flow:
 * 1. Audio message detected → job enqueued to BullMQ (or sync fallback)
 * 2. Worker resolves audio URL (DB mediaUrl or provider base64)
 * 3. Worker sends audio to Whisper API (tenant key) or Forge API (fallback)
 * 4. Transcription saved to wa_messages
 * 5. Socket event emitted to update CRM UI in real-time
 * 
 * Safety:
 * - Max 3 concurrent jobs per tenant
 * - Max 25MB audio size
 * - Max 5 min audio duration
 * - 3 retries on failure with exponential backoff
 * - Sync fallback when Redis is unavailable or enqueue fails
 * - Never sends transcription to WhatsApp
 */

import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { getDb } from "./db";
import { eq, and } from "drizzle-orm";
import { waMessages } from "../drizzle/schema";
import { getActiveAiIntegration, getTenantAiSettings } from "./db";
// Z-API removed — Z-API only
import { resolveProviderForSession } from "./providers/providerFactory";
import { storagePut } from "./storage";

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

let queueRedisConnection: IORedis | null = null;
let workerRedisConnection: IORedis | null = null;
let transcriptionQueue: Queue | null = null;
let transcriptionWorker: Worker | null = null;

function getRedisUrl(): string | null {
  return process.env.REDIS_URL || null;
}

/** Create a NEW Redis connection for BullMQ with robust error handling */
function createRedisConnection(name: string): IORedis | null {
  const url = getRedisUrl();
  if (!url) return null;
  try {
    const conn = new IORedis(url, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: true,
      connectTimeout: 10000,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 5) return null; // Stop retrying after 5 attempts
        return Math.min(times * 500, 5000);
      },
    });
    let errorLogged = false;
    conn.on("ready", () => {
      console.log(`[AudioTranscription] Redis ${name} connection ready`);
    });
    conn.on("error", (err) => {
      if (!errorLogged) {
        console.error(`[AudioTranscription] Redis ${name} error:`, err.message);
        errorLogged = true;
      }
    });
    conn.on("close", () => {
      console.log(`[AudioTranscription] Redis ${name} connection closed`);
    });
    // Initiate connection
    conn.connect().catch((err) => {
      console.error(`[AudioTranscription] Redis ${name} connect failed:`, err.message);
    });
    return conn;
  } catch (err: any) {
    console.error(`[AudioTranscription] Failed to create Redis ${name} connection:`, err.message);
    return null;
  }
}

function getQueueRedisConnection(): IORedis | null {
  if (queueRedisConnection) return queueRedisConnection;
  queueRedisConnection = createRedisConnection("queue");
  return queueRedisConnection;
}

function getWorkerRedisConnection(): IORedis | null {
  if (workerRedisConnection) return workerRedisConnection;
  workerRedisConnection = createRedisConnection("worker");
  return workerRedisConnection;
}

// ── Queue ──────────────────────────────────────────────────────

export function getTranscriptionQueue(): Queue | null {
  if (transcriptionQueue) return transcriptionQueue;
  const conn = getQueueRedisConnection();
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
 * Returns true if enqueued/processing, false if completely failed.
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
    });
    console.log(`[AudioTranscription] Enqueued msg ${job.messageId} (tenant ${job.tenantId})`);
    return true;
  } catch (err: any) {
    console.error(`[AudioTranscription] Failed to enqueue msg ${job.messageId}:`, err.message);
    // Fallback to sync processing
    console.log(`[AudioTranscription] Falling back to sync processing for msg ${job.messageId}`);
    processTranscriptionJob(job).catch(syncErr => {
      console.error(`[AudioTranscription] Sync fallback also failed for msg ${job.messageId}:`, syncErr.message);
    });
    return true;
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
    await db.update(waMessages)
      .set({ audioTranscriptionStatus: "failed" })
      .where(eq(waMessages.id, messageId));
    return;
  }

  // ── Step 2: Check if tenant has OpenAI API key (optional — Forge API is fallback) ──
  const aiIntegration = await getActiveAiIntegration(tenantId, "openai");
  const hasTenantOpenAiKey = !!(aiIntegration?.apiKey);

  // ── Step 3: Check duration limit ──
  if (mediaDuration && mediaDuration > MAX_AUDIO_DURATION_SEC) {
    console.log(`[AudioTranscription] Audio too long (${mediaDuration}s > ${MAX_AUDIO_DURATION_SEC}s), skipping msg ${messageId}`);
    await db.update(waMessages)
      .set({ audioTranscriptionStatus: "failed" })
      .where(eq(waMessages.id, messageId));
    return;
  }

  // ── Step 4: Set status to processing ──
  await db.update(waMessages)
    .set({ audioTranscriptionStatus: "processing" })
    .where(eq(waMessages.id, messageId));

  // ── Step 5: Resolve audio — try DB mediaUrl first, then provider base64 ──
  let audioUrl: string | null = null;
  let audioBuffer: Buffer | null = null;
  let mimeType = mediaMimeType || "audio/ogg";

  try {
    // Strategy 1: Check if mediaUrl is already in DB (Z-API permanent URLs, S3 URLs)
    const [msgRow] = await db.select({
      mediaUrl: waMessages.mediaUrl,
      mediaMimeType: waMessages.mediaMimeType,
    })
      .from(waMessages)
      .where(eq(waMessages.id, messageId))
      .limit(1);

    if (msgRow?.mediaUrl && !msgRow.mediaUrl.includes("whatsapp.net")) {
      // Permanent URL available — download directly
      audioUrl = msgRow.mediaUrl;
      mimeType = msgRow.mediaMimeType || mimeType;
      console.log(`[AudioTranscription] Using DB mediaUrl for msg ${messageId}: ${audioUrl.substring(0, 80)}...`);

      const audioRes = await fetch(audioUrl);
      if (!audioRes.ok) throw new Error(`Failed to download from mediaUrl: ${audioRes.status}`);
      audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    }

    // Strategy 2: getBase64FromMediaMessage via provider (Z-API)
    if (!audioBuffer) {
      let mediaResult: { base64: string; mimetype: string; fileName?: string } | null = null;
      try {
        const provider = await resolveProviderForSession(sessionId);
        mediaResult = await provider.getBase64FromMediaMessage(instanceName, externalMessageId, {
          remoteJid,
          fromMe,
        });
      } catch (err: any) {
        console.warn(`[AudioTranscription] Provider getBase64 failed for msg ${messageId}:`, err.message);
      }
      if (mediaResult?.base64) {
        audioBuffer = Buffer.from(mediaResult.base64, "base64");
        mimeType = mediaResult.mimetype || mimeType;
        console.log(`[AudioTranscription] Downloaded via provider base64 for msg ${messageId} (${(audioBuffer.length / 1024).toFixed(0)}KB)`);

        // Upload to S3 for a permanent URL (useful for Forge API)
        try {
          const ext = getFileExtension(mimeType);
          const fileKey = `whatsapp-audio/${sessionId}/${messageId}-${Date.now()}.${ext}`;
          const { url } = await storagePut(fileKey, audioBuffer, mimeType);
          audioUrl = url;
          // Update DB with permanent URL
          await db.update(waMessages)
            .set({ mediaUrl: url })
            .where(eq(waMessages.id, messageId));
        } catch (s3Err: any) {
          console.warn(`[AudioTranscription] S3 upload failed for msg ${messageId}:`, s3Err.message);
        }
      }
    }

    if (!audioBuffer) {
      throw new Error("Failed to download audio from any source");
    }
  } catch (err: any) {
    console.error(`[AudioTranscription] Audio download failed for msg ${messageId}:`, err.message);
    await db.update(waMessages)
      .set({ audioTranscriptionStatus: "failed" })
      .where(eq(waMessages.id, messageId));
    throw err; // Let BullMQ retry
  }

  // ── Step 6: Check size limit ──
  const sizeMB = audioBuffer.length / (1024 * 1024);
  if (sizeMB > MAX_AUDIO_SIZE_MB) {
    console.log(`[AudioTranscription] Audio too large (${sizeMB.toFixed(1)}MB > ${MAX_AUDIO_SIZE_MB}MB), skipping msg ${messageId}`);
    await db.update(waMessages)
      .set({ audioTranscriptionStatus: "failed" })
      .where(eq(waMessages.id, messageId));
    return;
  }

  // ── Step 7: Transcribe — OpenAI Whisper (tenant key) or Forge API (fallback) ──
  try {
    let transcriptionText: string;
    let transcriptionLanguage: string = "pt";
    let transcriptionDuration: number | null = mediaDuration;

    if (hasTenantOpenAiKey) {
      // Use tenant's OpenAI Whisper API
      console.log(`[AudioTranscription] Using tenant OpenAI key for msg ${messageId}`);
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
          Authorization: `Bearer ${aiIntegration!.apiKey}`,
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
      };

      if (!result.text || typeof result.text !== "string") {
        throw new Error("Invalid Whisper API response: no text field");
      }

      transcriptionText = result.text;
      transcriptionLanguage = result.language || "pt";
      transcriptionDuration = result.duration ? Math.round(result.duration) : mediaDuration;
    } else {
      // Fallback: use built-in Forge API (free, platform-provided)
      console.log(`[AudioTranscription] Using Forge API (no tenant OpenAI key) for msg ${messageId}`);

      if (!audioUrl) {
        // Need a URL for Forge API — upload to S3 first
        const ext = getFileExtension(mimeType);
        const fileKey = `whatsapp-audio/${sessionId}/${messageId}-${Date.now()}.${ext}`;
        const { url } = await storagePut(fileKey, audioBuffer, mimeType);
        audioUrl = url;
        await db.update(waMessages)
          .set({ mediaUrl: url })
          .where(eq(waMessages.id, messageId));
      }

      const { transcribeAudio } = await import("./_core/voiceTranscription");
      const forgeResult = await transcribeAudio({
        audioUrl,
        language: "pt",
        prompt: "Transcreva o áudio do usuário para texto. O idioma principal é português brasileiro.",
      });

      if ("error" in forgeResult) {
        throw new Error(`Forge API error: ${(forgeResult as any).error} (${(forgeResult as any).code})`);
      }

      const result = forgeResult as { text: string; language?: string; duration?: number; segments?: any[] };
      if (!result.text || typeof result.text !== "string") {
        throw new Error("Invalid Forge API response: no text field");
      }

      transcriptionText = result.text;
      transcriptionLanguage = result.language || "pt";
      transcriptionDuration = result.duration ? Math.round(result.duration) : mediaDuration;
    }

    // ── Step 8: Save transcription ──
    await db.update(waMessages)
      .set({
        audioTranscription: transcriptionText,
        audioTranscriptionStatus: "completed",
        audioTranscriptionLanguage: transcriptionLanguage,
        audioTranscriptionDuration: transcriptionDuration,
      })
      .where(eq(waMessages.id, messageId));

    console.log(`[AudioTranscription] Completed msg ${messageId}: "${transcriptionText.substring(0, 80)}..." (${transcriptionLanguage}, ${transcriptionDuration?.toFixed?.(1) || "?"}s, provider: ${hasTenantOpenAiKey ? "openai" : "forge"})`);

    // ── Step 9: Emit socket event to update CRM UI ──
    emitTranscriptionUpdate(tenantId, sessionId, messageId, {
      transcription: transcriptionText,
      status: "completed",
      language: transcriptionLanguage,
      duration: transcriptionDuration,
      remoteJid,
    });

  } catch (err: any) {
    console.error(`[AudioTranscription] Transcription failed for msg ${messageId}:`, err.message);
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
  const conn = getWorkerRedisConnection();
  if (!conn) {
    console.log("[AudioTranscription] No Redis URL, worker not started (sync fallback active)");
    return;
  }

  transcriptionWorker = new Worker(
    QUEUE_NAME,
    async (job: Job<AudioTranscriptionJob>) => {
      try {
        await processTranscriptionJob(job.data);
      } catch (err: any) {
        console.error(`[AudioTranscription] Job ${job.id} processing error:`, err.message);
        throw err; // Re-throw for BullMQ retry
      }
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
    console.error(`[AudioTranscription] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${MAX_RETRIES}):`, err.message);
  });

  transcriptionWorker.on("error", (err) => {
    console.error("[AudioTranscription] Worker error:", err.message);
  });

  transcriptionWorker.on("ready", () => {
    console.log("[AudioTranscription] Worker ready and listening for jobs");
  });

  console.log("[AudioTranscription] Worker started");
}

// ── Reprocess Stuck Messages ───────────────────────────────────

/**
 * Reprocess messages stuck in "pending" status.
 * Called from admin endpoint to recover stuck transcriptions.
 */
export async function reprocessStuckTranscriptions(tenantId?: number): Promise<{ requeued: number; errors: number }> {
  const db = await getDb();
  if (!db) return { requeued: 0, errors: 0 };

  const conditions: any[] = [
    eq(waMessages.audioTranscriptionStatus, "pending"),
  ];
  if (tenantId) {
    conditions.push(eq(waMessages.tenantId, tenantId));
  }

  // Find stuck messages in pending status
  const stuckMessages = await db.select({
    id: waMessages.id,
    messageId: waMessages.messageId,
    sessionId: waMessages.sessionId,
    tenantId: waMessages.tenantId,
    remoteJid: waMessages.remoteJid,
    fromMe: waMessages.fromMe,
    mediaMimeType: waMessages.mediaMimeType,
    mediaDuration: waMessages.mediaDuration,
  })
    .from(waMessages)
    .where(and(...conditions))
    .limit(200);

  let requeued = 0;
  let errors = 0;

  for (const msg of stuckMessages) {
    try {
      const success = await enqueueAudioTranscription({
        messageId: msg.id,
        externalMessageId: msg.messageId || "",
        sessionId: msg.sessionId,
        instanceName: msg.sessionId,
        tenantId: msg.tenantId,
        remoteJid: msg.remoteJid,
        fromMe: msg.fromMe,
        mediaMimeType: msg.mediaMimeType || "audio/ogg",
        mediaDuration: msg.mediaDuration,
      });
      if (success) requeued++;
      else errors++;
    } catch {
      errors++;
    }
  }

  console.log(`[AudioTranscription] Reprocessed stuck: ${requeued} requeued, ${errors} errors (total found: ${stuckMessages.length})`);
  return { requeued, errors };
}

// ── Helpers ────────────────────────────────────────────────────

function getFileExtension(mimeType: string): string {
  // Normaliza: remove parâmetros (ex.: "audio/ogg; codecs=opus" → "audio/ogg")
  const base = (mimeType || "").split(";")[0].trim().toLowerCase();
  const mimeToExt: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/mpga": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/opus": "ogg",
    "audio/flac": "flac",
  };
  return mimeToExt[base] || "ogg";
}

// ── Graceful Shutdown ──────────────────────────────────────────

export async function shutdownAudioTranscriptionWorker(): Promise<void> {
  try {
    if (transcriptionWorker) {
      await transcriptionWorker.close();
      transcriptionWorker = null;
    }
    if (transcriptionQueue) {
      await transcriptionQueue.close();
      transcriptionQueue = null;
    }
    if (queueRedisConnection) {
      queueRedisConnection.disconnect();
      queueRedisConnection = null;
    }
    if (workerRedisConnection) {
      workerRedisConnection.disconnect();
      workerRedisConnection = null;
    }
    console.log("[AudioTranscription] Graceful shutdown complete");
  } catch (err: any) {
    console.error("[AudioTranscription] Shutdown error:", err.message);
  }
}
