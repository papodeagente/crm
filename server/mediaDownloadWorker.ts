/**
 * Media Download Worker — Rehospeda audio/imagem/video/doc do Z-API pro S3.
 *
 * Problema que resolve: Z-API entrega `mediaUrl` em `mmg.whatsapp.net` que
 * **expira em ~30d**. Precisamos rehospedar em S3 pra garantir que o audio
 * continua tocando depois da expiracao da URL original.
 *
 * Antes: `messageWorker.downloadAndStoreMedia` era fire-and-forget sem retry.
 * Se falhasse (rede, Z-API lento, provider crash), a midia ficava permanentemente
 * indisponivel pro cliente — e ainda era marcada `__unavailable__` no DB,
 * bloqueando retries futuros.
 *
 * Agora: job BullMQ com 3 retries + backoff exponencial. Contador
 * `media_download_attempts` em `messages` limita retries globais. Sem lock
 * permanente — so marca `media_unavailable_since` apos 3 tentativas.
 *
 * Fallback sync se Redis indisponivel (mesmo padrao da fila de transcricao).
 */

import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { nanoid } from "nanoid";
import { getDb } from "./db";
import { eq, and } from "drizzle-orm";
import { waMessages } from "../drizzle/schema";
import { resolveProviderForSession } from "./providers/providerFactory";
import { storagePut } from "./storage";

// ── Types ──────────────────────────────────────────────────────

export interface MediaDownloadJob {
  messageDbId: number;
  sessionId: string;
  instanceName: string;
  messageId: string;
  remoteJid: string;
  fromMe: boolean;
  expectedMimeType?: string | null;
  expectedFileName?: string | null;
}

// ── Constants ──────────────────────────────────────────────────

const QUEUE_NAME = "media-download";
const MAX_RETRIES = 3;
const MAX_CONCURRENT = 5;

// ── Redis ──────────────────────────────────────────────────────

let queueRedisConnection: IORedis | null = null;
let workerRedisConnection: IORedis | null = null;
let mediaQueue: Queue | null = null;
let mediaWorker: Worker | null = null;

function createRedisConnection(name: string): IORedis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const conn = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      connectTimeout: 10000,
      lazyConnect: true,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 500, 5000)),
    });
    let errorLogged = false;
    conn.on("ready", () => console.log(`[MediaDownload] Redis ${name} ready`));
    conn.on("error", (err) => {
      if (!errorLogged) {
        console.error(`[MediaDownload] Redis ${name} error:`, err.message);
        errorLogged = true;
      }
    });
    conn.connect().catch((err) => console.error(`[MediaDownload] Redis ${name} connect failed:`, err.message));
    return conn;
  } catch (err: any) {
    console.error(`[MediaDownload] Failed to create Redis ${name}:`, err.message);
    return null;
  }
}

function getQueue(): Queue | null {
  if (mediaQueue) return mediaQueue;
  if (!queueRedisConnection) queueRedisConnection = createRedisConnection("queue");
  if (!queueRedisConnection) return null;
  mediaQueue = new Queue(QUEUE_NAME, {
    connection: queueRedisConnection,
    defaultJobOptions: {
      attempts: MAX_RETRIES,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
    },
  });
  return mediaQueue;
}

export async function enqueueMediaDownload(job: MediaDownloadJob): Promise<void> {
  const queue = getQueue();
  if (!queue) {
    // Fallback sync
    processMediaDownload(job).catch((err) =>
      console.error(`[MediaDownload] Sync fallback failed for msg ${job.messageDbId}:`, err.message)
    );
    return;
  }
  try {
    await queue.add("download", job, { jobId: `media-${job.messageDbId}` });
    console.log(`[MediaDownload] Enqueued msg ${job.messageDbId} (session ${job.sessionId})`);
  } catch (err: any) {
    console.error(`[MediaDownload] Enqueue failed for msg ${job.messageDbId}:`, err.message);
    processMediaDownload(job).catch(() => {});
  }
}

// ── Processing ─────────────────────────────────────────────────

/** Rehospeda a midia: baixa via provider, salva S3, atualiza DB. */
export async function processMediaDownload(data: MediaDownloadJob): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { messageDbId, sessionId, instanceName, messageId, remoteJid, fromMe, expectedMimeType, expectedFileName } = data;

  // Incrementa contador de tentativas antes de tentar (mesmo que falhe, o contador sobe)
  await db.update(waMessages)
    .set({ mediaDownloadAttempts: (await currentAttempts(messageDbId)) + 1 })
    .where(eq(waMessages.id, messageDbId));

  let base64Data: { base64: string; mimetype: string; fileName?: string } | null = null;
  try {
    const provider = await resolveProviderForSession(sessionId);
    base64Data = await provider.getBase64FromMediaMessage(instanceName, messageId, { remoteJid, fromMe });
  } catch (err: any) {
    console.warn(`[MediaDownload] Provider getBase64 failed for msg ${messageDbId}:`, err.message);
    throw err; // Deixa BullMQ retry
  }

  if (!base64Data?.base64) {
    const attempts = await currentAttempts(messageDbId);
    if (attempts >= MAX_RETRIES) {
      // Ultima tentativa — marcar indisponivel (agora com timestamp, nao lock permanente)
      await db.update(waMessages)
        .set({ mediaUnavailableSince: new Date() })
        .where(eq(waMessages.id, messageDbId));
      console.warn(`[MediaDownload] Msg ${messageDbId} marked unavailable after ${attempts} attempts`);
    }
    throw new Error("Provider returned no base64 data");
  }

  // Upload S3
  const mimetype = base64Data.mimetype || expectedMimeType || "application/octet-stream";
  const rawExt = mimetype.split("/")[1]?.split(";")[0] || "bin";
  const ext = rawExt.split("+")[0]; // svg+xml → svg
  const fileKey = `whatsapp-media/${sessionId}/${nanoid()}.${ext}`;
  const buffer = Buffer.from(base64Data.base64, "base64");
  const { url } = await storagePut(fileKey, buffer, mimetype);

  // Atualiza DB com URL permanente + limpa marcadores
  await db.update(waMessages)
    .set({
      mediaUrl: url,
      mediaMimeType: mimetype,
      mediaFileName: base64Data.fileName || expectedFileName || null,
      mediaUnavailableSince: null,
    })
    .where(eq(waMessages.id, messageDbId));

  // Emite socket pra UI recarregar
  try {
    const [msg] = await db.select({ tenantId: waMessages.tenantId, remoteJid: waMessages.remoteJid })
      .from(waMessages).where(eq(waMessages.id, messageDbId)).limit(1);
    if (msg) {
      const { whatsappManager } = await import("./whatsappEvolution");
      whatsappManager.emit("media_update", {
        sessionId,
        tenantId: msg.tenantId,
        remoteJid: msg.remoteJid,
        messageId,
        mediaUrl: url,
      });
    }
  } catch (err: any) {
    console.warn(`[MediaDownload] Emit media_update failed:`, err.message);
  }

  console.log(`[MediaDownload] Rehospedado msg ${messageDbId} → ${url.substring(0, 80)}...`);
}

async function currentAttempts(messageDbId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ attempts: waMessages.mediaDownloadAttempts })
    .from(waMessages).where(eq(waMessages.id, messageDbId)).limit(1);
  return row?.attempts ?? 0;
}

// ── Worker Init ────────────────────────────────────────────────

export function initMediaDownloadWorker(): void {
  if (!workerRedisConnection) workerRedisConnection = createRedisConnection("worker");
  if (!workerRedisConnection) {
    console.log("[MediaDownload] No Redis URL, worker not started (sync fallback active)");
    return;
  }

  mediaWorker = new Worker(
    QUEUE_NAME,
    async (job: Job<MediaDownloadJob>) => {
      try {
        await processMediaDownload(job.data);
      } catch (err: any) {
        console.error(`[MediaDownload] Job ${job.id} error:`, err.message);
        throw err;
      }
    },
    {
      connection: workerRedisConnection,
      concurrency: MAX_CONCURRENT,
    }
  );

  mediaWorker.on("completed", (job) => {
    console.log(`[MediaDownload] Job ${job.id} completed`);
  });
  mediaWorker.on("failed", (job, err) => {
    console.error(`[MediaDownload] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${MAX_RETRIES}):`, err.message);
  });

  console.log(`[MediaDownload] Worker initialized (concurrency=${MAX_CONCURRENT})`);
}

export async function shutdownMediaDownloadWorker(): Promise<void> {
  try {
    if (mediaWorker) { await mediaWorker.close(); mediaWorker = null; }
    if (mediaQueue) { await mediaQueue.close(); mediaQueue = null; }
    if (workerRedisConnection) { workerRedisConnection.disconnect(); workerRedisConnection = null; }
    if (queueRedisConnection) { queueRedisConnection.disconnect(); queueRedisConnection = null; }
  } catch (err: any) {
    console.error("[MediaDownload] Shutdown error:", err.message);
  }
}
