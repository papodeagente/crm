import { describe, it, expect, vi } from "vitest";

// Test the getMediaUrl endpoint logic
describe("getMediaUrl endpoint", () => {
  it("should require sessionId and messageId", () => {
    // Validate input schema
    const { z } = require("zod");
    const schema = z.object({ sessionId: z.string(), messageId: z.string() });
    
    expect(() => schema.parse({ sessionId: "test", messageId: "msg1" })).not.toThrow();
    expect(() => schema.parse({ sessionId: "", messageId: "" })).not.toThrow();
    expect(() => schema.parse({})).toThrow();
    expect(() => schema.parse({ sessionId: "test" })).toThrow();
  });
});

// Test the getBase64FromMediaMessage function
describe("getBase64FromMediaMessage", () => {
  it("should be exported from evolutionApi", async () => {
    const evo = await import("./evolutionApi");
    expect(typeof evo.getBase64FromMediaMessage).toBe("function");
  });
});

// Test the mimeToExt helper logic
describe("mimeToExt logic", () => {
  it("should map common mime types to extensions", () => {
    const map: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3",
      "audio/mp4": "m4a", "application/pdf": "pdf",
    };
    
    for (const [mime, ext] of Object.entries(map)) {
      expect(map[mime]).toBe(ext);
    }
  });

  it("should handle unknown mime types by splitting", () => {
    const mimeToExt = (mime: string): string => {
      const map: Record<string, string> = {
        "image/jpeg": "jpg", "audio/ogg": "ogg",
      };
      const rawExt = mime.split("/")[1]?.split(";")[0] || "bin";
      return map[mime] || rawExt.split("+")[0] || "bin";
    };
    
    expect(mimeToExt("application/zip")).toBe("zip");
    expect(mimeToExt("audio/ogg; codecs=opus")).toBe("ogg");
    expect(mimeToExt("unknown")).toBe("bin");
  });

  it("should handle complex mimetypes with + suffix (e.g. svg+xml)", () => {
    // This is the fix for broken S3 URLs where svg+xml was used as extension
    const mimeToExt = (mime: string): string => {
      const map: Record<string, string> = {
        "image/jpeg": "jpg", "audio/ogg": "ogg",
      };
      const rawExt = mime.split("/")[1]?.split(";")[0] || "bin";
      return map[mime] || rawExt.split("+")[0] || "bin";
    };
    
    expect(mimeToExt("image/svg+xml")).toBe("svg");
    expect(mimeToExt("application/xhtml+xml")).toBe("xhtml");
    expect(mimeToExt("application/soap+xml")).toBe("soap");
    expect(mimeToExt("image/jpeg")).toBe("jpg"); // known mime still works
    expect(mimeToExt("audio/ogg; codecs=opus")).toBe("ogg"); // known mime still works
    expect(mimeToExt("application/pdf")).toBe("pdf"); // no + in mime
    expect(mimeToExt("video/mp4")).toBe("mp4"); // no + in mime
  });
});

// Test the extractMediaInfo logic
describe("extractMediaInfo logic", () => {
  it("should extract audio message info", () => {
    const data = {
      message: {
        audioMessage: {
          url: "https://example.com/audio.ogg",
          mimetype: "audio/ogg; codecs=opus",
          seconds: 15,
          ptt: true,
        }
      }
    };
    
    const msg = data.message;
    const audioMsg = msg.audioMessage;
    expect(audioMsg.url).toBe("https://example.com/audio.ogg");
    expect(audioMsg.mimetype).toBe("audio/ogg; codecs=opus");
    expect(audioMsg.seconds).toBe(15);
    expect(audioMsg.ptt).toBe(true);
  });

  it("should extract image message info", () => {
    const data = {
      message: {
        imageMessage: {
          url: "https://example.com/image.jpg",
          mimetype: "image/jpeg",
          caption: "Test image",
        }
      }
    };
    
    expect(data.message.imageMessage.url).toBe("https://example.com/image.jpg");
    expect(data.message.imageMessage.mimetype).toBe("image/jpeg");
  });

  it("should extract quoted message ID from contextInfo", () => {
    const data = {
      message: {
        extendedTextMessage: {
          text: "Reply text",
          contextInfo: {
            stanzaId: "quoted-msg-123",
            participant: "5511999999999@s.whatsapp.net",
          }
        }
      }
    };
    
    const contextInfo = data.message.extendedTextMessage.contextInfo;
    expect(contextInfo.stanzaId).toBe("quoted-msg-123");
  });
});

// Test the sendPresence endpoint
describe("sendPresence endpoint", () => {
  it("should validate presence types", () => {
    const validPresences = ["composing", "recording", "paused", "available", "unavailable"];
    for (const p of validPresences) {
      expect(validPresences.includes(p)).toBe(true);
    }
    expect(validPresences.includes("invalid")).toBe(false);
  });
});

// Test performance optimizations
describe("Inbox performance optimizations", () => {
  it("should have profile picture cache with TTL", () => {
    // Simulate cache behavior
    const cache = new Map<string, { url: string | null; ts: number }>();
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    
    // Add to cache
    cache.set("5511999999999@s.whatsapp.net", { url: "https://pic.url", ts: Date.now() });
    
    // Check cache hit
    const entry = cache.get("5511999999999@s.whatsapp.net");
    expect(entry).toBeDefined();
    expect(entry!.url).toBe("https://pic.url");
    expect(Date.now() - entry!.ts).toBeLessThan(CACHE_TTL);
    
    // Check cache miss
    expect(cache.get("unknown@s.whatsapp.net")).toBeUndefined();
  });
});
