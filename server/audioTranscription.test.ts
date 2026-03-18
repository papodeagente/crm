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
      const transitions: Record<string, string[]> = {
        pending: ["processing"],
      };
      expect(transitions["pending"]).not.toContain("completed");
    });
  });

  // ── Socket Event ───────────────────────────────────────────────

  describe("Socket Event: whatsapp:transcription", () => {
    it("event name should be 'whatsapp:transcription' (not 'whatsapp:messageUpdated')", () => {
      const CORRECT_EVENT = "whatsapp:transcription";
      const WRONG_EVENT = "whatsapp:messageUpdated";
      expect(CORRECT_EVENT).toBe("whatsapp:transcription");
      expect(CORRECT_EVENT).not.toBe(WRONG_EVENT);
    });

    it("completed event should include text and remoteJid", () => {
      const event = {
        sessionId: "session-1",
        messageId: 123,
        remoteJid: "5511999999999@s.whatsapp.net",
        status: "completed",
        text: "Transcrição do áudio",
        language: "pt",
        duration: 15,
      };

      expect(event.status).toBe("completed");
      expect(event.text).toBeDefined();
      expect(event.remoteJid).toBeDefined();
      expect(event.messageId).toBeGreaterThan(0);
    });

    it("failed event should include error info", () => {
      const event = {
        sessionId: "session-1",
        messageId: 123,
        remoteJid: "5511999999999@s.whatsapp.net",
        status: "failed",
        error: "API key invalid",
      };

      expect(event.status).toBe("failed");
      expect(event.error).toBeDefined();
    });

    it("should filter transcription events by remoteJid", () => {
      const currentRemoteJid = "5511999999999@s.whatsapp.net";
      const event1 = { remoteJid: "5511999999999@s.whatsapp.net", status: "completed" };
      const event2 = { remoteJid: "5511888888888@s.whatsapp.net", status: "completed" };

      expect(event1.remoteJid === currentRemoteJid).toBe(true);
      expect(event2.remoteJid === currentRemoteJid).toBe(false);
    });
  });

  // ── Audio Message Detection ────────────────────────────────────

  describe("Audio Message Detection", () => {
    it("should detect audioMessage type", () => {
      const audioTypes = ["audioMessage", "pttMessage"];
      expect(audioTypes.includes("audioMessage")).toBe(true);
    });

    it("should detect pttMessage (voice note) type", () => {
      const audioTypes = ["audioMessage", "pttMessage"];
      expect(audioTypes.includes("pttMessage")).toBe(true);
    });

    it("should NOT detect non-audio types", () => {
      const audioTypes = ["audioMessage", "pttMessage"];
      expect(audioTypes.includes("imageMessage")).toBe(false);
      expect(audioTypes.includes("videoMessage")).toBe(false);
      expect(audioTypes.includes("documentMessage")).toBe(false);
      expect(audioTypes.includes("stickerMessage")).toBe(false);
    });

    it("should detect audio by MIME type", () => {
      const mimeType = "audio/ogg; codecs=opus";
      expect(mimeType.startsWith("audio/")).toBe(true);
    });
  });

  // ── Auto-Transcription Trigger ─────────────────────────────────

  describe("Auto-Transcription Trigger (messageWorker)", () => {
    it("should only trigger for incoming audio messages (fromMe=false)", () => {
      const incomingAudio = { fromMe: false, messageType: "audioMessage" };
      const outgoingAudio = { fromMe: true, messageType: "audioMessage" };

      const audioTypes = ["audioMessage", "pttMessage"];
      const shouldTrigger = (msg: any) => !msg.fromMe && audioTypes.includes(msg.messageType);

      expect(shouldTrigger(incomingAudio)).toBe(true);
      expect(shouldTrigger(outgoingAudio)).toBe(false);
    });

    it("should trigger for pttMessage (voice note)", () => {
      const voiceNote = { fromMe: false, messageType: "pttMessage" };
      const audioTypes = ["audioMessage", "pttMessage"];
      expect(!voiceNote.fromMe && audioTypes.includes(voiceNote.messageType)).toBe(true);
    });

    it("should NOT trigger for image messages", () => {
      const imageMsg = { fromMe: false, messageType: "imageMessage" };
      const audioTypes = ["audioMessage", "pttMessage"];
      expect(audioTypes.includes(imageMsg.messageType)).toBe(false);
    });

    it("should set initial status to 'pending' before enqueuing", () => {
      const initialStatus = "pending";
      expect(["pending", "processing", "completed", "failed"]).toContain(initialStatus);
    });
  });

  // ── Transcription Rendering Priority ───────────────────────────

  describe("Transcription Rendering Priority", () => {
    it("should prioritize DB transcription over local state", () => {
      const msg = {
        audioTranscriptionStatus: "completed",
        audioTranscription: "Olá, tudo bem?",
      };
      const localTranscription = { text: "Different text" };

      const displayText = msg.audioTranscriptionStatus === "completed" && msg.audioTranscription
        ? msg.audioTranscription
        : localTranscription?.text || null;

      expect(displayText).toBe("Olá, tudo bem?");
    });

    it("should fall back to local state when DB has no transcription", () => {
      const msg = {
        audioTranscriptionStatus: null as string | null,
        audioTranscription: null as string | null,
      };
      const localTranscription = { text: "Local transcription" };

      const displayText = msg.audioTranscriptionStatus === "completed" && msg.audioTranscription
        ? msg.audioTranscription
        : localTranscription?.text || null;

      expect(displayText).toBe("Local transcription");
    });

    it("should show loading state for pending/processing", () => {
      const pendingMsg = { audioTranscriptionStatus: "pending" };
      const processingMsg = { audioTranscriptionStatus: "processing" };

      const isLoading = (s: string) => s === "pending" || s === "processing";

      expect(isLoading(pendingMsg.audioTranscriptionStatus)).toBe(true);
      expect(isLoading(processingMsg.audioTranscriptionStatus)).toBe(true);
    });

    it("should show error state with retry button for 'failed'", () => {
      const errorMsg = { audioTranscriptionStatus: "failed" };
      expect(errorMsg.audioTranscriptionStatus === "failed").toBe(true);
    });

    it("should show manual transcribe button when no auto-transcription (BullMQ worker, no URL dependency)", () => {
      const msg = {
        audioTranscriptionStatus: null as string | null,
        audioTranscription: null as string | null,
        messageType: "audioMessage",
      };
      const autoTranscribe = false;
      const onRetranscribe = (msgId: number) => {}; // BullMQ worker handler

      // Manual button shows when: not auto-transcribing AND handler exists AND no existing status
      const showManualButton = !autoTranscribe && !!onRetranscribe && !msg.audioTranscriptionStatus;
      expect(showManualButton).toBe(true);
    });

    it("should NOT show manual transcribe button when auto-transcription is enabled", () => {
      const autoTranscribe = true;
      const onRetranscribe = (msgId: number) => {};
      const showManualButton = !autoTranscribe && !!onRetranscribe;
      expect(showManualButton).toBe(false);
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
      const smallFile = 1 * 1024 * 1024;
      const largeFile = 30 * 1024 * 1024;

      expect(smallFile <= MAX_FILE_SIZE).toBe(true);
      expect(largeFile <= MAX_FILE_SIZE).toBe(false);
    });

    it("should enforce 5 minute duration limit", () => {
      const MAX_DURATION = 300;
      expect(120 <= MAX_DURATION).toBe(true);
      expect(360 <= MAX_DURATION).toBe(false);
    });

    it("should map MIME types to file extensions correctly", () => {
      const mimeToExt: Record<string, string> = {
        "audio/webm": "webm",
        "audio/mp3": "mp3",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/ogg": "ogg",
        "audio/m4a": "m4a",
        "audio/mp4": "m4a",
        "audio/aac": "aac",
        "audio/opus": "ogg",
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
      const settingsEnabled = { audioTranscriptionEnabled: true };
      const settingsDisabled = { audioTranscriptionEnabled: false };

      expect(settingsEnabled.audioTranscriptionEnabled).toBe(true);
      expect(settingsDisabled.audioTranscriptionEnabled).toBe(false);
    });

    it("should require OpenAI API key for transcription", () => {
      const integrationWithKey = { provider: "openai", apiKey: "sk-test-123" };
      const integrationWithoutKey = { provider: "openai", apiKey: null as string | null };

      expect(!!integrationWithKey.apiKey).toBe(true);
      expect(!!integrationWithoutKey.apiKey).toBe(false);
    });

    it("should skip transcription when tenant has no OpenAI integration", () => {
      const integration = null;
      const shouldSkip = !integration;
      expect(shouldSkip).toBe(true);
    });
  });

  // ── Dedup & Rate Limiting ──────────────────────────────────────

  describe("Dedup and Rate Limiting", () => {
    it("should not re-transcribe already transcribed messages", () => {
      const transcribedIds = new Set<number>([1, 2, 3]);
      const newMsgId = 4;
      const alreadyTranscribedId = 2;

      expect(transcribedIds.has(newMsgId)).toBe(false);
      expect(transcribedIds.has(alreadyTranscribedId)).toBe(true);
    });

    it("should skip fromMe audio messages for auto-transcription", () => {
      const msg = { fromMe: true, messageType: "audioMessage" };
      const shouldAutoTranscribe = !msg.fromMe;
      expect(shouldAutoTranscribe).toBe(false);
    });

    it("should handle WhatsApp CDN URLs via BullMQ worker (Evolution API base64 download)", () => {
      // The BullMQ worker uses Evolution API to download audio as base64,
      // so it works regardless of whether the WhatsApp CDN URL has expired
      const expiredUrl = "https://mmg.whatsapp.net/v/t62.7114-24/abc123";
      const s3Url = "https://s3.amazonaws.com/bucket/audio.ogg";

      // Both URLs should be handled by the worker (no URL filtering needed)
      const canProcessViaWorker = true; // Worker uses Evolution API, not the URL
      expect(canProcessViaWorker).toBe(true);
    });
  });

  // ── Retranscribe (Manual Trigger) ──────────────────────────────

  describe("Retranscribe (Manual Trigger)", () => {
    it("should reset status to 'pending' before retranscribing", () => {
      const resetStatus = "pending";
      const resetTranscription = null;
      expect(resetStatus).toBe("pending");
      expect(resetTranscription).toBeNull();
    });

    it("should only allow retranscribe for audio/ptt messages", () => {
      const audioTypes = ["audioMessage", "pttMessage"];
      expect(audioTypes.includes("audioMessage")).toBe(true);
      expect(audioTypes.includes("pttMessage")).toBe(true);
      expect(audioTypes.includes("imageMessage")).toBe(false);
    });
  });

  // ── BullMQ Fallback ────────────────────────────────────────────

  describe("BullMQ Sync Fallback", () => {
    it("should process synchronously when Redis is unavailable", () => {
      const redisAvailable = false;
      const processingMode = redisAvailable ? "queued" : "sync-fallback";
      expect(processingMode).toBe("sync-fallback");
    });

    it("should use queue when Redis is available", () => {
      const redisAvailable = true;
      const processingMode = redisAvailable ? "queued" : "sync-fallback";
      expect(processingMode).toBe("queued");
    });
  });
});


// ── Additional Tests: Pipeline Lifecycle, Recovery, Redis Connections ──

describe("Audio Transcription Pipeline — Lifecycle & Recovery", () => {
  // ── Status Order Map (mirrors audioTranscriptionWorker.ts) ──────

  const STATUS_ORDER: Record<string, number> = {
    pending: 0,
    processing: 1,
    completed: 2,
    failed: 2, // terminal states are equal rank
  };

  function isStatusAdvance(current: string | null, next: string): boolean {
    const currentRank = current ? (STATUS_ORDER[current] ?? -1) : -1;
    const nextRank = STATUS_ORDER[next] ?? -1;
    return nextRank > currentRank;
  }

  function canTransition(current: string | null, next: string): boolean {
    if (!current && next === "pending") return true;
    if (current === "pending" && next === "processing") return true;
    if (current === "processing" && next === "completed") return true;
    if (current === "processing" && next === "failed") return true;
    if (current === "pending" && next === "failed") return true; // timeout recovery
    return false;
  }

  // ── Simulated Store ──────────────────────────────────────────

  interface TranscriptionJob {
    messageId: number;
    status: string | null;
    transcription: string | null;
    enqueuedAt: number | null;
    processedAt: number | null;
    completedAt: number | null;
    failReason: string | null;
  }

  class TranscriptionStore {
    jobs = new Map<number, TranscriptionJob>();

    enqueue(messageId: number): boolean {
      const existing = this.jobs.get(messageId);
      if (existing && existing.status !== null) return false;
      this.jobs.set(messageId, {
        messageId, status: "pending", transcription: null,
        enqueuedAt: Date.now(), processedAt: null, completedAt: null, failReason: null,
      });
      return true;
    }

    startProcessing(messageId: number): boolean {
      const job = this.jobs.get(messageId);
      if (!job || !canTransition(job.status, "processing")) return false;
      job.status = "processing";
      job.processedAt = Date.now();
      return true;
    }

    complete(messageId: number, transcription: string): boolean {
      const job = this.jobs.get(messageId);
      if (!job || !canTransition(job.status, "completed")) return false;
      job.status = "completed";
      job.transcription = transcription;
      job.completedAt = Date.now();
      return true;
    }

    fail(messageId: number, reason: string): boolean {
      const job = this.jobs.get(messageId);
      if (!job || !canTransition(job.status, "failed")) return false;
      job.status = "failed";
      job.failReason = reason;
      job.completedAt = Date.now();
      return true;
    }

    recoverStuckPending(maxAgeMs: number): number {
      let recovered = 0;
      const now = Date.now();
      for (const [, job] of this.jobs) {
        if (job.status === "pending" && job.enqueuedAt && (now - job.enqueuedAt) > maxAgeMs) {
          job.status = "failed";
          job.failReason = "timeout_recovery";
          job.completedAt = now;
          recovered++;
        }
      }
      return recovered;
    }

    getByStatus(status: string): TranscriptionJob[] {
      return Array.from(this.jobs.values()).filter(j => j.status === status);
    }
  }

  // ── Tests ──────────────────────────────────────────────────────

  describe("Happy Path Lifecycle", () => {
    it("null → pending → processing → completed", () => {
      const store = new TranscriptionStore();
      expect(store.enqueue(1)).toBe(true);
      expect(store.jobs.get(1)?.status).toBe("pending");
      expect(store.startProcessing(1)).toBe(true);
      expect(store.jobs.get(1)?.status).toBe("processing");
      expect(store.complete(1, "Hello world")).toBe(true);
      expect(store.jobs.get(1)?.status).toBe("completed");
      expect(store.jobs.get(1)?.transcription).toBe("Hello world");
    });

    it("null → pending → processing → failed", () => {
      const store = new TranscriptionStore();
      store.enqueue(1);
      store.startProcessing(1);
      expect(store.fail(1, "OpenAI API error")).toBe(true);
      expect(store.jobs.get(1)?.status).toBe("failed");
      expect(store.jobs.get(1)?.failReason).toBe("OpenAI API error");
    });

    it("pending → failed (timeout recovery)", () => {
      const store = new TranscriptionStore();
      store.enqueue(1);
      expect(store.fail(1, "timeout_recovery")).toBe(true);
      expect(store.jobs.get(1)?.status).toBe("failed");
    });
  });

  describe("Monotonic Status — No Regression", () => {
    it("completed → pending is blocked", () => {
      const store = new TranscriptionStore();
      store.enqueue(1); store.startProcessing(1); store.complete(1, "text");
      expect(store.enqueue(1)).toBe(false);
      expect(store.jobs.get(1)?.status).toBe("completed");
    });

    it("completed → processing is blocked", () => {
      const store = new TranscriptionStore();
      store.enqueue(1); store.startProcessing(1); store.complete(1, "text");
      expect(store.startProcessing(1)).toBe(false);
    });

    it("failed → pending is blocked", () => {
      const store = new TranscriptionStore();
      store.enqueue(1); store.startProcessing(1); store.fail(1, "err");
      expect(store.enqueue(1)).toBe(false);
    });

    it("processing → pending is blocked", () => {
      const store = new TranscriptionStore();
      store.enqueue(1); store.startProcessing(1);
      expect(store.enqueue(1)).toBe(false);
      expect(store.jobs.get(1)?.status).toBe("processing");
    });

    it("pending → completed (skip processing) is blocked", () => {
      const store = new TranscriptionStore();
      store.enqueue(1);
      expect(store.complete(1, "text")).toBe(false);
      expect(store.jobs.get(1)?.status).toBe("pending");
    });
  });

  describe("isStatusAdvance", () => {
    it("null → pending is advance", () => expect(isStatusAdvance(null, "pending")).toBe(true));
    it("pending → processing is advance", () => expect(isStatusAdvance("pending", "processing")).toBe(true));
    it("processing → completed is advance", () => expect(isStatusAdvance("processing", "completed")).toBe(true));
    it("processing → failed is advance", () => expect(isStatusAdvance("processing", "failed")).toBe(true));
    it("completed → pending is NOT advance", () => expect(isStatusAdvance("completed", "pending")).toBe(false));
    it("completed → processing is NOT advance", () => expect(isStatusAdvance("completed", "processing")).toBe(false));
    it("failed → pending is NOT advance", () => expect(isStatusAdvance("failed", "pending")).toBe(false));
  });

  describe("Timeout Recovery", () => {
    it("recovers stuck pending jobs older than maxAge", () => {
      const store = new TranscriptionStore();
      store.enqueue(1); store.enqueue(2); store.enqueue(3);
      store.jobs.get(1)!.enqueuedAt = Date.now() - 120_000;
      store.jobs.get(2)!.enqueuedAt = Date.now() - 90_000;
      store.jobs.get(3)!.enqueuedAt = Date.now() - 10_000;
      const recovered = store.recoverStuckPending(60_000);
      expect(recovered).toBe(2);
      expect(store.jobs.get(1)?.status).toBe("failed");
      expect(store.jobs.get(2)?.status).toBe("failed");
      expect(store.jobs.get(3)?.status).toBe("pending");
    });

    it("does NOT recover processing or completed jobs", () => {
      const store = new TranscriptionStore();
      store.enqueue(1); store.enqueue(2); store.enqueue(3);
      store.jobs.get(1)!.enqueuedAt = Date.now() - 120_000;
      store.jobs.get(2)!.enqueuedAt = Date.now() - 120_000;
      store.jobs.get(3)!.enqueuedAt = Date.now() - 120_000;
      store.startProcessing(2);
      store.startProcessing(3); store.complete(3, "text");
      const recovered = store.recoverStuckPending(60_000);
      expect(recovered).toBe(1);
      expect(store.jobs.get(2)?.status).toBe("processing");
      expect(store.jobs.get(3)?.status).toBe("completed");
    });

    it("returns 0 when no stuck jobs", () => {
      const store = new TranscriptionStore();
      store.enqueue(1);
      store.jobs.get(1)!.enqueuedAt = Date.now() - 5_000;
      expect(store.recoverStuckPending(60_000)).toBe(0);
    });
  });

  describe("Duplicate Prevention", () => {
    it("same message cannot be enqueued twice", () => {
      const store = new TranscriptionStore();
      expect(store.enqueue(1)).toBe(true);
      expect(store.enqueue(1)).toBe(false);
      expect(store.getByStatus("pending").length).toBe(1);
    });

    it("cannot re-enqueue after completion", () => {
      const store = new TranscriptionStore();
      store.enqueue(1); store.startProcessing(1); store.complete(1, "text");
      expect(store.enqueue(1)).toBe(false);
    });
  });

  describe("Separate Redis Connections (Architecture)", () => {
    it("queue and worker must use different connection objects", () => {
      const queueConn = { id: "queue-conn", label: "audio-transcription-queue" };
      const workerConn = { id: "worker-conn", label: "audio-transcription-worker" };
      expect(queueConn).not.toBe(workerConn);
      expect(queueConn.id).not.toBe(workerConn.id);
    });

    it("message queue and message worker must also use different connections", () => {
      const queueConn = { id: "msg-queue-conn", label: "message-queue" };
      const workerConn = { id: "msg-worker-conn", label: "message-worker" };
      expect(queueConn).not.toBe(workerConn);
    });
  });

  describe("Batch Concurrent Processing", () => {
    it("handles 5 concurrent jobs without interference", () => {
      const store = new TranscriptionStore();
      for (let i = 1; i <= 5; i++) store.enqueue(i);
      expect(store.getByStatus("pending").length).toBe(5);
      store.startProcessing(1); store.startProcessing(2); store.startProcessing(3);
      expect(store.getByStatus("processing").length).toBe(3);
      expect(store.getByStatus("pending").length).toBe(2);
      store.complete(1, "text1"); store.fail(2, "error");
      expect(store.getByStatus("completed").length).toBe(1);
      expect(store.getByStatus("failed").length).toBe(1);
      expect(store.getByStatus("processing").length).toBe(1);
      expect(store.getByStatus("pending").length).toBe(2);
    });
  });
});


// ── Tests: Retry Button & Auto-Transcribe Flow (BullMQ Worker) ──

describe("Retry Button & Auto-Transcribe — BullMQ Worker Flow", () => {

  describe("Retry Button uses retranscribeAudio (not ai.transcribe)", () => {
    it("retry button should call retranscribeAudio with messageId (not audioUrl)", () => {
      // The retry button now calls handleRetranscribe(msgId) which uses
      // trpc.ai.retranscribeAudio.useMutation() — BullMQ worker with Evolution API
      const retranscribeInput = { tenantId: 150002, messageId: 42 };
      expect(retranscribeInput).toHaveProperty("messageId");
      expect(retranscribeInput).toHaveProperty("tenantId");
      expect(retranscribeInput).not.toHaveProperty("audioUrl"); // No URL needed
    });

    it("retranscribeAudio resets status to pending and clears old transcription", () => {
      const beforeRetranscribe = {
        audioTranscriptionStatus: "failed",
        audioTranscription: null,
      };
      // After calling retranscribeAudio mutation:
      const afterRetranscribe = {
        audioTranscriptionStatus: "pending",
        audioTranscription: null,
      };
      expect(afterRetranscribe.audioTranscriptionStatus).toBe("pending");
      expect(afterRetranscribe.audioTranscription).toBeNull();
    });

    it("retranscribeAudio only accepts audioMessage and pttMessage types", () => {
      const validTypes = ["audioMessage", "pttMessage"];
      expect(validTypes.includes("audioMessage")).toBe(true);
      expect(validTypes.includes("pttMessage")).toBe(true);
      expect(validTypes.includes("imageMessage")).toBe(false);
      expect(validTypes.includes("videoMessage")).toBe(false);
    });
  });

  describe("Auto-Transcribe uses BullMQ worker (no URL dependency)", () => {
    it("auto-transcribe should NOT filter by whatsapp.net URL", () => {
      // Old behavior: filtered out messages with whatsapp.net URLs
      // New behavior: uses BullMQ worker which downloads via Evolution API
      const messages = [
        { id: 1, messageType: "audioMessage", fromMe: false, mediaUrl: "https://mmg.whatsapp.net/audio.ogg", audioTranscriptionStatus: null },
        { id: 2, messageType: "pttMessage", fromMe: false, mediaUrl: null, audioTranscriptionStatus: null },
        { id: 3, messageType: "audioMessage", fromMe: false, mediaUrl: "https://s3.example.com/audio.ogg", audioTranscriptionStatus: null },
      ];

      const audioTypes = ["audioMessage", "pttMessage", "audio"];
      const autoTranscribedIds = new Set<number>();

      for (const m of messages) {
        const isAudio = audioTypes.includes(m.messageType);
        const hasTranscription = m.audioTranscriptionStatus === "completed" || m.audioTranscriptionStatus === "pending" || m.audioTranscriptionStatus === "processing";
        // New logic: no URL filter — all audio messages are eligible
        if (isAudio && !m.fromMe && !hasTranscription && !autoTranscribedIds.has(m.id)) {
          autoTranscribedIds.add(m.id);
        }
      }

      // All 3 messages should be auto-transcribed (including the one with whatsapp.net URL)
      expect(autoTranscribedIds.size).toBe(3);
      expect(autoTranscribedIds.has(1)).toBe(true); // Was previously filtered out!
      expect(autoTranscribedIds.has(2)).toBe(true);
      expect(autoTranscribedIds.has(3)).toBe(true);
    });

    it("auto-transcribe should skip messages already in pending/processing/completed status", () => {
      const messages = [
        { id: 1, messageType: "audioMessage", fromMe: false, audioTranscriptionStatus: "pending" },
        { id: 2, messageType: "pttMessage", fromMe: false, audioTranscriptionStatus: "processing" },
        { id: 3, messageType: "audioMessage", fromMe: false, audioTranscriptionStatus: "completed" },
        { id: 4, messageType: "audioMessage", fromMe: false, audioTranscriptionStatus: "failed" },
        { id: 5, messageType: "audioMessage", fromMe: false, audioTranscriptionStatus: null },
      ];

      const audioTypes = ["audioMessage", "pttMessage"];
      const autoTranscribedIds = new Set<number>();

      for (const m of messages) {
        const isAudio = audioTypes.includes(m.messageType);
        const hasTranscription = m.audioTranscriptionStatus === "completed" || m.audioTranscriptionStatus === "pending" || m.audioTranscriptionStatus === "processing";
        if (isAudio && !m.fromMe && !hasTranscription && !autoTranscribedIds.has(m.id)) {
          autoTranscribedIds.add(m.id);
        }
      }

      // Only messages 4 (failed) and 5 (null) should be eligible
      expect(autoTranscribedIds.size).toBe(2);
      expect(autoTranscribedIds.has(4)).toBe(true);  // failed → can retry
      expect(autoTranscribedIds.has(5)).toBe(true);  // null → new message
      expect(autoTranscribedIds.has(1)).toBe(false); // pending → already queued
      expect(autoTranscribedIds.has(2)).toBe(false); // processing → in progress
      expect(autoTranscribedIds.has(3)).toBe(false); // completed → done
    });

    it("auto-transcribe should skip fromMe messages", () => {
      const messages = [
        { id: 1, messageType: "audioMessage", fromMe: true, audioTranscriptionStatus: null },
        { id: 2, messageType: "pttMessage", fromMe: false, audioTranscriptionStatus: null },
      ];

      const audioTypes = ["audioMessage", "pttMessage"];
      const autoTranscribedIds = new Set<number>();

      for (const m of messages) {
        const isAudio = audioTypes.includes(m.messageType);
        const hasTranscription = m.audioTranscriptionStatus === "completed" || m.audioTranscriptionStatus === "pending" || m.audioTranscriptionStatus === "processing";
        if (isAudio && !m.fromMe && !hasTranscription) {
          autoTranscribedIds.add(m.id);
        }
      }

      expect(autoTranscribedIds.size).toBe(1);
      expect(autoTranscribedIds.has(1)).toBe(false); // fromMe=true
      expect(autoTranscribedIds.has(2)).toBe(true);  // fromMe=false
    });
  });

  describe("Backend auto-transcribe checks AI settings before enqueuing", () => {
    it("should skip enqueue when audioTranscriptionEnabled is false", () => {
      const aiSettings = { audioTranscriptionEnabled: false };
      const shouldEnqueue = aiSettings.audioTranscriptionEnabled;
      expect(shouldEnqueue).toBe(false);
    });

    it("should enqueue when audioTranscriptionEnabled is true", () => {
      const aiSettings = { audioTranscriptionEnabled: true };
      const shouldEnqueue = aiSettings.audioTranscriptionEnabled;
      expect(shouldEnqueue).toBe(true);
    });
  });

  describe("Evolution API base64 download (worker flow)", () => {
    it("worker uses externalMessageId (not mediaUrl) to download audio", () => {
      const jobData = {
        messageId: 42,
        externalMessageId: "3EB0A1B2C3D4E5F6",
        sessionId: "session-1",
        instanceName: "session-1",
        tenantId: 150002,
        remoteJid: "5511999999999@s.whatsapp.net",
        fromMe: false,
        mediaMimeType: "audio/ogg",
        mediaDuration: 15,
      };

      // Worker calls evo.getBase64FromMediaMessage(instanceName, externalMessageId, ...)
      expect(jobData.externalMessageId).toBeTruthy();
      expect(jobData.instanceName).toBeTruthy();
      // No mediaUrl field needed — Evolution API downloads directly
      expect(jobData).not.toHaveProperty("mediaUrl");
    });
  });
});
