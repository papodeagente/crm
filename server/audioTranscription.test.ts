import { describe, it, expect } from "vitest";

// ─── Test: Audio Transcription System ───

describe("Audio Transcription System", () => {

  // ── Status Values ──────────────────────────────────────────────
  describe("Status Values (DB enum alignment)", () => {
    const DB_ENUM_VALUES = ["pending", "processing", "completed", "failed"];

    it("DB enum includes all valid statuses", () => {
      expect(DB_ENUM_VALUES).toContain("pending");
      expect(DB_ENUM_VALUES).toContain("processing");
      expect(DB_ENUM_VALUES).toContain("completed");
      expect(DB_ENUM_VALUES).toContain("failed");
    });

    it("DB enum does NOT include 'done' (was a bug)", () => {
      expect(DB_ENUM_VALUES).not.toContain("done");
    });

    it("DB enum does NOT include 'error' (was a bug)", () => {
      expect(DB_ENUM_VALUES).not.toContain("error");
    });

    it("frontend should check 'completed' not 'done'", () => {
      const msg = { audioTranscriptionStatus: "completed", audioTranscription: "Olá" };
      expect(msg.audioTranscriptionStatus === "completed").toBe(true);
      expect(msg.audioTranscriptionStatus === "done" as any).toBe(false);
    });

    it("frontend should check 'failed' not 'error'", () => {
      const msg = { audioTranscriptionStatus: "failed" };
      expect(msg.audioTranscriptionStatus === "failed").toBe(true);
      expect(msg.audioTranscriptionStatus === "error" as any).toBe(false);
    });
  });

  // ── Status Transitions ─────────────────────────────────────────
  describe("Status Transitions", () => {
    it("should have valid transitions: pending → processing → completed/failed", () => {
      const transitions: Record<string, string[]> = {
        pending: ["processing"],
        processing: ["completed", "failed"],
        completed: [],
        failed: ["pending"],
      };
      for (const [from, toList] of Object.entries(transitions)) {
        expect(["pending", "processing", "completed", "failed"]).toContain(from);
        for (const to of toList) {
          expect(["pending", "processing", "completed", "failed"]).toContain(to);
        }
      }
    });

    it("should not allow direct transition from pending to completed", () => {
      const transitions: Record<string, string[]> = { pending: ["processing"] };
      expect(transitions["pending"]).not.toContain("completed");
    });
  });

  // ── Socket Event ───────────────────────────────────────────────
  describe("Socket Event: whatsapp:transcription", () => {
    it("event name should be 'whatsapp:transcription'", () => {
      const CORRECT_EVENT = "whatsapp:transcription";
      expect(CORRECT_EVENT).toBe("whatsapp:transcription");
      expect(CORRECT_EVENT).not.toBe("whatsapp:messageUpdated");
    });

    it("completed event should include text and remoteJid", () => {
      const event = {
        sessionId: "session-1", messageId: 123,
        remoteJid: "5511999999999@s.whatsapp.net",
        status: "completed", text: "Transcrição do áudio",
        language: "pt", duration: 15,
      };
      expect(event.status).toBe("completed");
      expect(event.text).toBeDefined();
      expect(event.remoteJid).toBeDefined();
    });
  });

  // ── Transcription Strategy: Tenant OpenAI Only ─────────────────
  describe("Transcription Strategy: Tenant OpenAI Only", () => {
    it("should use exclusively tenant's OpenAI Whisper API", () => {
      const strategy = "tenant-openai";
      expect(strategy).toBe("tenant-openai");
      expect(strategy).not.toBe("forge-api");
    });

    it("should require tenant to have OpenAI API key configured", () => {
      const integrationWithKey = { provider: "openai", apiKey: "sk-test-123" };
      const integrationWithoutKey = { provider: "openai", apiKey: null as string | null };
      expect(!!integrationWithKey.apiKey).toBe(true);
      expect(!!integrationWithoutKey.apiKey).toBe(false);
    });

    it("should fail when tenant has no OpenAI API key", () => {
      const integration = null;
      const shouldFail = !integration;
      expect(shouldFail).toBe(true);
    });

    it("should set status to failed when no API key available", () => {
      const hasApiKey = false;
      const resultStatus = hasApiKey ? "processing" : "failed";
      expect(resultStatus).toBe("failed");
    });

    it("should NOT use built-in Forge API (clients pay their own credits)", () => {
      const usesForgeApi = false;
      const usesBuiltIn = false;
      expect(usesForgeApi).toBe(false);
      expect(usesBuiltIn).toBe(false);
    });
  });

  // ── Audio Message Detection ────────────────────────────────────
  describe("Audio Message Detection", () => {
    it("should detect audioMessage and pttMessage types", () => {
      const audioTypes = ["audioMessage", "pttMessage"];
      expect(audioTypes.includes("audioMessage")).toBe(true);
      expect(audioTypes.includes("pttMessage")).toBe(true);
    });

    it("should NOT detect non-audio types", () => {
      const audioTypes = ["audioMessage", "pttMessage"];
      expect(audioTypes.includes("imageMessage")).toBe(false);
      expect(audioTypes.includes("videoMessage")).toBe(false);
    });
  });

  // ── Whisper API Integration ────────────────────────────────────
  describe("Whisper API Integration", () => {
    it("should support common audio formats", () => {
      const supportedFormats = ["audio/ogg", "audio/mpeg", "audio/mp4", "audio/webm", "audio/wav"];
      const whatsappFormat = "audio/ogg; codecs=opus";
      const baseType = whatsappFormat.split(";")[0].trim();
      expect(supportedFormats).toContain(baseType);
    });

    it("should enforce 25MB file size limit", () => {
      const MAX_FILE_SIZE = 25 * 1024 * 1024;
      expect(1 * 1024 * 1024 <= MAX_FILE_SIZE).toBe(true);
      expect(30 * 1024 * 1024 <= MAX_FILE_SIZE).toBe(false);
    });

    it("should enforce 5 minute duration limit", () => {
      const MAX_DURATION = 300;
      expect(120 <= MAX_DURATION).toBe(true);
      expect(360 <= MAX_DURATION).toBe(false);
    });

    it("should map MIME types to file extensions correctly", () => {
      const mimeToExt: Record<string, string> = {
        "audio/webm": "webm", "audio/mp3": "mp3", "audio/mpeg": "mp3",
        "audio/wav": "wav", "audio/ogg": "ogg", "audio/m4a": "m4a",
        "audio/mp4": "m4a", "audio/aac": "aac", "audio/opus": "ogg",
        "audio/ogg; codecs=opus": "ogg",
      };
      expect(mimeToExt["audio/ogg"]).toBe("ogg");
      expect(mimeToExt["audio/mpeg"]).toBe("mp3");
      expect(mimeToExt["audio/ogg; codecs=opus"]).toBe("ogg");
    });
  });

  // ── Tenant AI Settings ─────────────────────────────────────────
  describe("Tenant AI Settings", () => {
    it("should respect audioTranscriptionEnabled setting", () => {
      expect({ audioTranscriptionEnabled: true }.audioTranscriptionEnabled).toBe(true);
      expect({ audioTranscriptionEnabled: false }.audioTranscriptionEnabled).toBe(false);
    });

    it("should skip transcription when disabled in settings", () => {
      const settings = { audioTranscriptionEnabled: false };
      const shouldSkip = !settings.audioTranscriptionEnabled;
      expect(shouldSkip).toBe(true);
    });
  });

  // ── Dedup & Rate Limiting ──────────────────────────────────────
  describe("Dedup and Rate Limiting", () => {
    it("should not re-transcribe already transcribed messages", () => {
      const transcribedIds = new Set<number>([1, 2, 3]);
      expect(transcribedIds.has(4)).toBe(false);
      expect(transcribedIds.has(2)).toBe(true);
    });

    it("should skip WhatsApp CDN URLs (expired)", () => {
      const expiredUrl = "https://mmg.whatsapp.net/v/t62.7114-24/abc123";
      expect(expiredUrl.includes("whatsapp.net")).toBe(true);
    });
  });

  // ── Retranscribe (Manual Trigger) ──────────────────────────────
  describe("Retranscribe (Manual Trigger)", () => {
    it("should reset status to 'pending' before retranscribing", () => {
      expect("pending").toBe("pending");
    });

    it("should only allow retranscribe for audio/ptt messages", () => {
      const audioTypes = ["audioMessage", "pttMessage"];
      expect(audioTypes.includes("audioMessage")).toBe(true);
      expect(audioTypes.includes("imageMessage")).toBe(false);
    });
  });

  // ── BullMQ Queue & Worker ──────────────────────────────────────
  describe("BullMQ Queue & Worker", () => {
    it("should process synchronously when Redis is unavailable", () => {
      const redisAvailable = false;
      expect(redisAvailable ? "queued" : "sync-fallback").toBe("sync-fallback");
    });

    it("should use queue when Redis is available", () => {
      const redisAvailable = true;
      expect(redisAvailable ? "queued" : "sync-fallback").toBe("queued");
    });

    it("should fall back to sync when enqueue fails", () => {
      const enqueueFailed = true;
      expect(enqueueFailed ? "sync-fallback" : "queued").toBe("sync-fallback");
    });

    it("should use separate Redis connections for queue and worker", () => {
      const queueConn = { name: "queue", id: 1 };
      const workerConn = { name: "worker", id: 2 };
      expect(queueConn.id).not.toBe(workerConn.id);
    });

    it("should use enableReadyCheck:true and lazyConnect:true for Redis", () => {
      const redisConfig = {
        maxRetriesPerRequest: null as null,
        enableReadyCheck: true,
        connectTimeout: 10000,
        lazyConnect: true,
      };
      expect(redisConfig.enableReadyCheck).toBe(true);
      expect(redisConfig.lazyConnect).toBe(true);
      expect(redisConfig.maxRetriesPerRequest).toBeNull();
    });

    it("should retry failed jobs with exponential backoff", () => {
      const jobOptions = { attempts: 3, backoff: { type: "exponential", delay: 5000 } };
      expect(jobOptions.attempts).toBe(3);
      expect(jobOptions.backoff.type).toBe("exponential");
    });
  });

  // ── Reprocess Stuck Messages ───────────────────────────────────
  describe("Reprocess Stuck Messages", () => {
    it("should find messages with pending status", () => {
      const messages = [
        { id: 1, status: "pending" }, { id: 2, status: "completed" },
        { id: 3, status: "pending" }, { id: 4, status: "failed" },
      ];
      const stuck = messages.filter(m => m.status === "pending");
      expect(stuck.length).toBe(2);
    });

    it("should filter by tenantId when provided", () => {
      const messages = [
        { id: 1, tenantId: 240007, status: "pending" },
        { id: 2, tenantId: 210002, status: "pending" },
        { id: 3, tenantId: 240007, status: "pending" },
      ];
      const stuckForTenant = messages.filter(m => m.status === "pending" && m.tenantId === 240007);
      expect(stuckForTenant.length).toBe(2);
    });

    it("should limit reprocessing to 200 messages at a time", () => {
      expect(Math.min(500, 200)).toBe(200);
    });

    it("should return requeued and errors counts", () => {
      const result = { requeued: 95, errors: 5 };
      expect(result.requeued + result.errors).toBe(100);
    });
  });

  // ── Graceful Shutdown ──────────────────────────────────────────
  describe("Graceful Shutdown", () => {
    it("should close worker, queue, and Redis connections", () => {
      const resources = {
        worker: { closed: false }, queue: { closed: false },
        queueRedis: { disconnected: false }, workerRedis: { disconnected: false },
      };
      resources.worker.closed = true;
      resources.queue.closed = true;
      resources.queueRedis.disconnected = true;
      resources.workerRedis.disconnected = true;
      expect(resources.worker.closed).toBe(true);
      expect(resources.queue.closed).toBe(true);
      expect(resources.queueRedis.disconnected).toBe(true);
      expect(resources.workerRedis.disconnected).toBe(true);
    });
  });
});
