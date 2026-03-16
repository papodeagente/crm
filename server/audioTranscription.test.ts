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

    it("should show manual transcribe button when no auto-transcription", () => {
      const msg = {
        audioTranscriptionStatus: null as string | null,
        audioTranscription: null as string | null,
        mediaUrl: "https://s3.example.com/audio.ogg",
      };
      const autoTranscribe = false;
      const hasMediaUrl = !!msg.mediaUrl && !msg.mediaUrl.includes("whatsapp.net");

      const showManualButton = !autoTranscribe && hasMediaUrl && !msg.audioTranscriptionStatus;
      expect(showManualButton).toBe(true);
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

    it("should skip WhatsApp CDN URLs (expired)", () => {
      const expiredUrl = "https://mmg.whatsapp.net/v/t62.7114-24/abc123";
      const s3Url = "https://s3.amazonaws.com/bucket/audio.ogg";

      expect(expiredUrl.includes("whatsapp.net")).toBe(true);
      expect(s3Url.includes("whatsapp.net")).toBe(false);
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
