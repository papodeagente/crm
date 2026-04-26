/**
 * aiEntityExtractionWorker.ts
 *
 * Fase 1 — Worker assíncrono pra extração de entidades de viagem.
 * Chamado on-demand via router `ai.extractEntities`. Usa BullMQ se Redis disponível,
 * caso contrário roda síncrono em background (fire-and-forget via Promise).
 *
 * Cadência automática (ex: a cada 10 msgs novas) fica pra Fase 2 — por ora só trigger manual
 * pra evitar custo inesperado em tenants que não pediram.
 */

import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { extractDealEntities, type ExtractionResult } from "./aiEntityExtractionService";

const QUEUE_NAME = "ai-entity-extraction";
const MAX_CONCURRENT = 2;
const MAX_RETRIES = 2;

export interface EntityExtractionJob {
  tenantId: number;
  dealId: number;
  integrationId?: number;
  overrideModel?: string;
  requestedByUserId?: number;
}

let queueRedisConnection: IORedis | null = null;
let workerRedisConnection: IORedis | null = null;
let extractionQueue: Queue | null = null;
let extractionWorker: Worker | null = null;

function getRedisUrl(): string | null {
  return process.env.REDIS_URL || null;
}

function createRedisConnection(name: string): IORedis | null {
  const url = getRedisUrl();
  if (!url) return null;
  try {
    const conn = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      connectTimeout: 10_000,
      lazyConnect: true,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 500, 5000)),
    });
    let errorLogged = false;
    conn.on("error", (err) => {
      if (!errorLogged) {
        console.error(`[AiEntityExtraction] Redis ${name} error:`, err.message);
        errorLogged = true;
      }
    });
    conn.connect().catch((err) => {
      console.error(`[AiEntityExtraction] Redis ${name} connect failed:`, err.message);
    });
    return conn;
  } catch (err: any) {
    console.error(`[AiEntityExtraction] Failed to create Redis ${name} connection:`, err.message);
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

export function getExtractionQueue(): Queue | null {
  if (extractionQueue) return extractionQueue;
  const conn = getQueueRedisConnection();
  if (!conn) return null;
  extractionQueue = new Queue(QUEUE_NAME, {
    connection: conn,
    defaultJobOptions: {
      attempts: MAX_RETRIES,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
    },
  });
  return extractionQueue;
}

/** Enfileira extração. Se Redis indisponível, roda síncrono em fire-and-forget. */
export async function enqueueEntityExtraction(job: EntityExtractionJob): Promise<{ async: boolean }> {
  const queue = getExtractionQueue();
  if (!queue) {
    // Fallback síncrono — roda em background sem bloquear o caller
    runExtractionSafe(job);
    return { async: false };
  }

  try {
    await queue.add("extract", job, {
      jobId: `extract-${job.tenantId}-${job.dealId}`,
    });
    return { async: true };
  } catch (err: any) {
    console.error(`[AiEntityExtraction] Failed to enqueue deal=${job.dealId}:`, err.message);
    runExtractionSafe(job);
    return { async: false };
  }
}

function runExtractionSafe(job: EntityExtractionJob): void {
  extractDealEntities({
    tenantId: job.tenantId,
    dealId: job.dealId,
    integrationId: job.integrationId,
    overrideModel: job.overrideModel,
  })
    .then((result: ExtractionResult) => {
      console.log(`[AiEntityExtraction] deal=${job.dealId} extracted ${result.entities.length} entities (${result.provider}/${result.model})`);
    })
    .catch((err: any) => {
      console.warn(`[AiEntityExtraction] deal=${job.dealId} sync fallback failed:`, err?.message);
    });
}

export function initAiEntityExtractionWorker(): void {
  const conn = getWorkerRedisConnection();
  if (!conn) {
    console.log("[AiEntityExtraction] No Redis URL, worker not started (sync fallback active)");
    return;
  }

  extractionWorker = new Worker(
    QUEUE_NAME,
    async (job: Job<EntityExtractionJob>) => {
      const { tenantId, dealId, integrationId, overrideModel } = job.data;
      try {
        const result = await extractDealEntities({ tenantId, dealId, integrationId, overrideModel });
        console.log(`[AiEntityExtraction] job=${job.id} deal=${dealId} extracted=${result.entities.length}`);
      } catch (err: any) {
        console.error(`[AiEntityExtraction] job=${job.id} error:`, err.message);
        throw err;
      }
    },
    {
      connection: conn,
      concurrency: MAX_CONCURRENT,
    },
  );

  extractionWorker.on("failed", (job, err) => {
    console.error(`[AiEntityExtraction] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${MAX_RETRIES}):`, err.message);
  });
  extractionWorker.on("ready", () => {
    console.log("[AiEntityExtraction] Worker ready");
  });
  extractionWorker.on("error", (err) => {
    console.error("[AiEntityExtraction] Worker error:", err.message);
  });

  console.log("[AiEntityExtraction] Worker started");
}
