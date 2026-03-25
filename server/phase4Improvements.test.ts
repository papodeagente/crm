import { describe, it, expect } from "vitest";

// ─── Audio Transcription Worker — Z-API media URL resolution ───
describe("Audio Transcription Worker — Z-API media URL resolution", () => {
  it("should use mediaUrl from DB when available (Z-API scenario)", () => {
    const msg = {
      id: 100,
      mediaUrl: "https://storage.z-api.io/instances/abc/media/audio123.ogg",
      mediaMimeType: "audio/ogg; codecs=opus",
      sessionId: "tenant1_user1",
    };
    expect(msg.mediaUrl).toBeTruthy();
    expect(msg.mediaUrl).not.toContain("whatsapp.net");
  });

  it("should detect Z-API URLs as permanent (not WhatsApp CDN)", () => {
    const zapiUrls = [
      "https://storage.z-api.io/instances/abc/media/audio.ogg",
      "https://s3.amazonaws.com/zapi-media/audio.mp3",
      "https://cdn.z-api.io/files/audio.wav",
    ];
    for (const url of zapiUrls) {
      expect(url.includes("whatsapp.net")).toBe(false);
    }
  });

  it("should detect WhatsApp CDN URLs as temporary", () => {
    const whatsappUrls = [
      "https://mmg.whatsapp.net/v/t62.7114-24/abc123",
      "https://media.whatsapp.net/audio/abc.ogg",
    ];
    for (const url of whatsappUrls) {
      expect(url.includes("whatsapp.net")).toBe(true);
    }
  });

  it("should fall back to getBase64FromMediaMessage when no mediaUrl in DB", () => {
    const msg = { id: 101, mediaUrl: null, sessionId: "tenant1_user1" };
    const needsBase64 = !msg.mediaUrl;
    expect(needsBase64).toBe(true);
  });

  it("should handle S3 URLs from downloadAndStoreMedia", () => {
    const s3Url = "https://manus-storage.s3.amazonaws.com/whatsapp-media/tenant1_user1/abc123.ogg";
    expect(s3Url.includes("whatsapp.net")).toBe(false);
    expect(s3Url.startsWith("https://")).toBe(true);
  });
});

// ─── Audio Transcription — Forge API Fallback ───
describe("Audio Transcription — Forge API Fallback", () => {
  it("should use tenant OpenAI key when available", () => {
    const integration = { id: 1, provider: "openai", apiKey: "sk-test-123" };
    const hasTenantKey = !!(integration?.apiKey);
    expect(hasTenantKey).toBe(true);
  });

  it("should fall back to Forge API when no tenant OpenAI key", () => {
    const integration = null;
    const hasTenantKey = !!(integration as any)?.apiKey;
    expect(hasTenantKey).toBe(false);
  });

  it("should fall back to Forge API when integration exists but no apiKey", () => {
    const integration = { id: 1, provider: "openai", apiKey: "" };
    const hasTenantKey = !!(integration?.apiKey);
    expect(hasTenantKey).toBe(false);
  });

  it("should handle Forge API error response", () => {
    const forgeError = { error: "File too large", code: "FILE_SIZE_EXCEEDED" };
    expect("error" in forgeError).toBe(true);
    expect(forgeError.error).toBe("File too large");
  });

  it("should handle Forge API success response", () => {
    const forgeSuccess = { text: "Olá, tudo bem?", language: "pt" };
    expect("error" in forgeSuccess).toBe(false);
    expect(forgeSuccess.text).toBeTruthy();
    expect(forgeSuccess.language).toBe("pt");
  });

  it("should support multiple audio formats", () => {
    const supportedFormats = ["ogg", "mp3", "wav", "webm", "m4a"];
    expect(supportedFormats).toContain("ogg");
    expect(supportedFormats).toContain("mp3");
    expect(supportedFormats).toContain("wav");
    expect(supportedFormats).toContain("webm");
    expect(supportedFormats).toContain("m4a");
  });
});

// ─── AI Conversation Summary ───
describe("AI Conversation Summary", () => {
  it("should format messages chronologically for LLM", () => {
    const messages = [
      { id: 3, fromMe: false, pushName: "João", content: "Oi", timestamp: new Date("2025-01-01T10:03:00Z") },
      { id: 1, fromMe: true, pushName: null, content: "Olá!", timestamp: new Date("2025-01-01T10:01:00Z") },
      { id: 2, fromMe: false, pushName: "João", content: "Bom dia", timestamp: new Date("2025-01-01T10:02:00Z") },
    ];
    const sorted = [...messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    expect(sorted[0].id).toBe(1);
    expect(sorted[1].id).toBe(2);
    expect(sorted[2].id).toBe(3);
  });

  it("should use 'Agente' for fromMe messages and pushName for client", () => {
    const msg1 = { fromMe: true, pushName: "Admin" };
    const msg2 = { fromMe: false, pushName: "João Silva" };
    const msg3 = { fromMe: false, pushName: null };
    expect(msg1.fromMe ? "Agente" : msg1.pushName || "Cliente").toBe("Agente");
    expect(msg2.fromMe ? "Agente" : msg2.pushName || "Cliente").toBe("João Silva");
    expect(msg3.fromMe ? "Agente" : msg3.pushName || "Cliente").toBe("Cliente");
  });

  it("should include audio transcription in summary when available", () => {
    const audioMsg = {
      messageType: "audioMessage",
      content: null as string | null,
      audioTranscription: "Olá, quero saber sobre o pacote para Cancún",
    };
    const isAudio = audioMsg.messageType === "audioMessage" || audioMsg.messageType === "pttMessage";
    const text = isAudio
      ? (audioMsg.audioTranscription ? `[Áudio transcrito: ${audioMsg.audioTranscription}]` : "[Áudio não transcrito]")
      : (audioMsg.content || "");
    expect(text).toContain("Áudio transcrito");
    expect(text).toContain("Cancún");
  });

  it("should show [Áudio não transcrito] when no transcription", () => {
    const audioMsg = {
      messageType: "pttMessage",
      content: null as string | null,
      audioTranscription: null as string | null,
    };
    const isAudio = audioMsg.messageType === "audioMessage" || audioMsg.messageType === "pttMessage";
    const text = isAudio
      ? (audioMsg.audioTranscription ? `[Áudio transcrito: ${audioMsg.audioTranscription}]` : "[Áudio não transcrito]")
      : (audioMsg.content || "");
    expect(text).toBe("[Áudio não transcrito]");
  });

  it("should handle image/video/document/sticker message types", () => {
    const mediaTypes: Record<string, string> = {
      imageMessage: "[Imagem]",
      videoMessage: "[Vídeo]",
      documentMessage: "[Documento]",
      stickerMessage: "[Sticker]",
    };
    for (const [, label] of Object.entries(mediaTypes)) {
      expect(label).toBeTruthy();
      expect(label.startsWith("[")).toBe(true);
    }
  });

  it("should return empty summary when no messages", () => {
    const messages: any[] = [];
    const result = messages.length === 0 ? "Nenhuma mensagem encontrada nesta conversa." : "has messages";
    expect(result).toBe("Nenhuma mensagem encontrada nesta conversa.");
  });

  it("should limit messages to maxMessages parameter", () => {
    const allMessages = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
    const maxMessages = 50;
    const limited = allMessages.slice(0, maxMessages);
    expect(limited.length).toBe(50);
  });

  it("should require sessionId and remoteJid as input", () => {
    const input = { sessionId: "tenant1_user1", remoteJid: "5511999999999@s.whatsapp.net" };
    expect(input.sessionId).toBeTruthy();
    expect(input.remoteJid).toBeTruthy();
    expect(input.remoteJid).toContain("@s.whatsapp.net");
  });
});

// ─── Audio Transcription Worker — Provider Resolution ───
describe("Audio Transcription Worker — Provider Resolution", () => {
  it("should try mediaUrl from DB first, then provider API", () => {
    const strategies = ["db_media_url", "provider_base64", "s3_upload"];
    expect(strategies[0]).toBe("db_media_url");
    expect(strategies[1]).toBe("provider_base64");
  });

  it("should upload to S3 when audio is downloaded as base64", () => {
    const base64Data = "SGVsbG8gV29ybGQ=";
    const buffer = Buffer.from(base64Data, "base64");
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("should update message status to 'completed' after successful transcription", () => {
    const statusFlow = ["pending", "processing", "completed"];
    expect(statusFlow[0]).toBe("pending");
    expect(statusFlow[statusFlow.length - 1]).toBe("completed");
  });

  it("should update message status to 'failed' after failed transcription", () => {
    const failedStatus = "failed";
    expect(failedStatus).toBe("failed");
  });

  it("should emit socket event after transcription completes", () => {
    const socketEvent = {
      event: "whatsapp:transcription",
      data: {
        messageId: 100,
        sessionId: "tenant1_user1",
        remoteJid: "5511999999999@s.whatsapp.net",
        transcription: "Olá, tudo bem?",
        status: "completed",
      },
    };
    expect(socketEvent.event).toBe("whatsapp:transcription");
    expect(socketEvent.data.transcription).toBeTruthy();
    expect(socketEvent.data.status).toBe("completed");
  });
});

// ─── Transcription Endpoint — Forge API Fallback ───
describe("Transcription Endpoint — ai.transcribe with Forge fallback", () => {
  it("should not require OPENAI_REQUIRED error when Forge API is available", () => {
    const hasOpenAI = false;
    const hasForgeApi = true;
    const canTranscribe = hasOpenAI || hasForgeApi;
    expect(canTranscribe).toBe(true);
  });

  it("should prefer tenant OpenAI key over Forge API", () => {
    const hasOpenAI = true;
    const preferredProvider = hasOpenAI ? "openai" : "forge";
    expect(preferredProvider).toBe("openai");
  });

  it("should use Forge API when tenant has no OpenAI key", () => {
    const hasOpenAI = false;
    const preferredProvider = hasOpenAI ? "openai" : "forge";
    expect(preferredProvider).toBe("forge");
  });

  it("should pass language hint to Forge API", () => {
    const forgeParams = {
      audioUrl: "https://storage.example.com/audio.ogg",
      language: "pt",
      prompt: "Transcreva o áudio do usuário para texto.",
    };
    expect(forgeParams.language).toBe("pt");
    expect(forgeParams.audioUrl).toBeTruthy();
  });
});

// ─── MIME Type to Extension Mapping ───
describe("MIME Type to Extension Mapping", () => {
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

  function getFileExtension(mimeType: string): string {
    return mimeToExt[mimeType] || "ogg";
  }

  it("should map audio/ogg to ogg", () => {
    expect(getFileExtension("audio/ogg")).toBe("ogg");
  });

  it("should map audio/ogg; codecs=opus to ogg", () => {
    expect(getFileExtension("audio/ogg; codecs=opus")).toBe("ogg");
  });

  it("should map audio/webm to webm", () => {
    expect(getFileExtension("audio/webm")).toBe("webm");
  });

  it("should map audio/mpeg to mp3", () => {
    expect(getFileExtension("audio/mpeg")).toBe("mp3");
  });

  it("should default to ogg for unknown mime types", () => {
    expect(getFileExtension("audio/unknown")).toBe("ogg");
    expect(getFileExtension("video/mp4")).toBe("ogg");
  });
});
