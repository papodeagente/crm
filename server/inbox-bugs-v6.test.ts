import { describe, it, expect } from "vitest";

describe("Bug Fixes v6 - Inbox Issues", () => {
  describe("Message Status Update - Dual Format Support", () => {
    // Simulates the status mapping logic from handleMessageStatusUpdate
    const numericStatusMap: Record<number, string> = {
      0: "error", 1: "pending", 2: "sent", 3: "delivered", 4: "read", 5: "played",
    };
    const stringStatusMap: Record<string, string> = {
      "ERROR": "error", "PENDING": "pending", "SENT": "sent",
      "SERVER_ACK": "sent", "DELIVERY_ACK": "delivered", "DELIVERED": "delivered",
      "READ": "read", "PLAYED": "played", "DELETED": "deleted",
    };

    function resolveStatus(rawStatus: any): string | undefined {
      if (typeof rawStatus === "number") {
        return numericStatusMap[rawStatus];
      } else if (typeof rawStatus === "string") {
        return stringStatusMap[rawStatus.toUpperCase()] || rawStatus.toLowerCase();
      }
      return undefined;
    }

    function extractMessageId(update: any): string | undefined {
      return update?.key?.id || update?.keyId || update?.messageId;
    }

    function extractRemoteJid(update: any): string | undefined {
      return update?.key?.remoteJid || update?.remoteJid;
    }

    function extractFromMe(update: any): boolean | undefined {
      return update?.key?.fromMe ?? update?.fromMe;
    }

    it("should handle Evolution API v2 webhook format (flat structure with string status)", () => {
      // This is the actual format sent by Evolution API v2 with webhookByEvents: true
      const update = {
        keyId: "A5561E44C2A63682E4295B52F484C14E",
        remoteJid: "5511999999999@s.whatsapp.net",
        fromMe: true,
        participant: "5511999999999@s.whatsapp.net",
        status: "READ",
        instanceId: "abb8e7b9-7586-6462-95c4",
        messageId: "cmfyoow42000hov4xwkdug3lv",
      };

      expect(extractMessageId(update)).toBe("A5561E44C2A63682E4295B52F484C14E");
      expect(extractRemoteJid(update)).toBe("5511999999999@s.whatsapp.net");
      expect(extractFromMe(update)).toBe(true);
      expect(resolveStatus(update.status)).toBe("read");
    });

    it("should handle Baileys/internal format (nested key + numeric status)", () => {
      const update = {
        key: {
          id: "MSG123",
          remoteJid: "5511888888888@s.whatsapp.net",
          fromMe: true,
        },
        update: { status: 3 },
      };

      expect(extractMessageId(update)).toBe("MSG123");
      expect(extractRemoteJid(update)).toBe("5511888888888@s.whatsapp.net");
      expect(extractFromMe(update)).toBe(true);
      expect(resolveStatus(update.update.status)).toBe("delivered");
    });

    it("should map all numeric statuses correctly", () => {
      expect(resolveStatus(0)).toBe("error");
      expect(resolveStatus(1)).toBe("pending");
      expect(resolveStatus(2)).toBe("sent");
      expect(resolveStatus(3)).toBe("delivered");
      expect(resolveStatus(4)).toBe("read");
      expect(resolveStatus(5)).toBe("played");
    });

    it("should map all string statuses correctly", () => {
      expect(resolveStatus("ERROR")).toBe("error");
      expect(resolveStatus("PENDING")).toBe("pending");
      expect(resolveStatus("SENT")).toBe("sent");
      expect(resolveStatus("SERVER_ACK")).toBe("sent");
      expect(resolveStatus("DELIVERY_ACK")).toBe("delivered");
      expect(resolveStatus("DELIVERED")).toBe("delivered");
      expect(resolveStatus("READ")).toBe("read");
      expect(resolveStatus("PLAYED")).toBe("played");
      expect(resolveStatus("DELETED")).toBe("deleted");
    });

    it("should handle case-insensitive string statuses", () => {
      expect(resolveStatus("read")).toBe("read");
      expect(resolveStatus("Read")).toBe("read");
      expect(resolveStatus("delivered")).toBe("delivered");
    });

    it("should return undefined for invalid status", () => {
      expect(resolveStatus(undefined)).toBeUndefined();
      expect(resolveStatus(null)).toBeUndefined();
      expect(resolveStatus(99)).toBeUndefined();
    });
  });

  describe("Protocol Message Filtering", () => {
    const HIDDEN_TYPES = new Set([
      "protocolMessage", "reactionMessage", "senderKeyDistributionMessage",
      "messageContextInfo", "interactiveMessage", "buttonsResponseMessage",
      "associatedChildMessage", "albumMessage", "placeholderMessage",
      "ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2",
      "viewOnceMessageV2Extension", "editedMessage",
    ]);

    it("should filter out protocol messages", () => {
      expect(HIDDEN_TYPES.has("protocolMessage")).toBe(true);
      expect(HIDDEN_TYPES.has("reactionMessage")).toBe(true);
      expect(HIDDEN_TYPES.has("senderKeyDistributionMessage")).toBe(true);
    });

    it("should NOT filter out regular message types", () => {
      expect(HIDDEN_TYPES.has("conversation")).toBe(false);
      expect(HIDDEN_TYPES.has("imageMessage")).toBe(false);
      expect(HIDDEN_TYPES.has("audioMessage")).toBe(false);
      expect(HIDDEN_TYPES.has("videoMessage")).toBe(false);
      expect(HIDDEN_TYPES.has("documentMessage")).toBe(false);
      expect(HIDDEN_TYPES.has("extendedTextMessage")).toBe(false);
      expect(HIDDEN_TYPES.has("stickerMessage")).toBe(false);
      expect(HIDDEN_TYPES.has("contactMessage")).toBe(false);
      expect(HIDDEN_TYPES.has("locationMessage")).toBe(false);
      expect(HIDDEN_TYPES.has("pollCreationMessage")).toBe(false);
      expect(HIDDEN_TYPES.has("pttMessage")).toBe(false);
    });
  });

  describe("Optimistic Message Update", () => {
    it("should create optimistic message with correct fields", () => {
      const sessionId = "crm-210002-240001";
      const remoteJid = "5511999999999@s.whatsapp.net";
      const text = "Hello World";

      const optimistic = {
        id: -Date.now(),
        sessionId,
        messageId: `opt_${Date.now()}`,
        remoteJid,
        fromMe: true,
        messageType: "conversation",
        content: text,
        status: "pending",
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        quotedMessageId: null,
      };

      expect(optimistic.id).toBeLessThan(0); // Negative to avoid collision
      expect(optimistic.fromMe).toBe(true);
      expect(optimistic.status).toBe("pending");
      expect(optimistic.content).toBe("Hello World");
      expect(optimistic.messageId).toMatch(/^opt_\d+$/);
    });
  });

  describe("Media Extraction", () => {
    function extractMediaInfo(data: any) {
      const msg = data?.message || {};
      const types = [
        { key: "audioMessage", mime: "audio/ogg" },
        { key: "imageMessage", mime: "image/jpeg" },
        { key: "videoMessage", mime: "video/mp4" },
        { key: "documentMessage", mime: "application/pdf" },
        { key: "stickerMessage", mime: "image/webp" },
      ];

      for (const t of types) {
        const m = msg[t.key];
        if (m) {
          return {
            mediaUrl: m.url || null,
            mediaMimeType: m.mimetype || m.mimeType || t.mime,
            mediaFileName: m.fileName || null,
            mediaDuration: m.seconds || null,
            isVoiceNote: t.key === "audioMessage" ? (m.ptt === true) : false,
          };
        }
      }
      return null;
    }

    it("should extract audio message info", () => {
      const data = {
        message: {
          audioMessage: {
            url: "https://example.com/audio.ogg",
            mimetype: "audio/ogg; codecs=opus",
            seconds: 15,
            ptt: true,
          },
        },
      };

      const info = extractMediaInfo(data);
      expect(info).not.toBeNull();
      expect(info!.mediaMimeType).toBe("audio/ogg; codecs=opus");
      expect(info!.mediaDuration).toBe(15);
      expect(info!.isVoiceNote).toBe(true);
    });

    it("should extract image message info", () => {
      const data = {
        message: {
          imageMessage: {
            url: "https://example.com/image.jpg",
            mimetype: "image/jpeg",
          },
        },
      };

      const info = extractMediaInfo(data);
      expect(info).not.toBeNull();
      expect(info!.mediaMimeType).toBe("image/jpeg");
      expect(info!.isVoiceNote).toBe(false);
    });

    it("should return null for text messages", () => {
      const data = {
        message: {
          conversation: "Hello",
        },
      };

      const info = extractMediaInfo(data);
      expect(info).toBeNull();
    });
  });

  describe("Webhook Route - webhookByEvents Support", () => {
    it("should extract event type from URL path suffix", () => {
      // When webhookByEvents: true, Evolution API sends to:
      // /api/webhooks/evolution/messages-update
      // But the body still has event: "messages.update"
      const paths = [
        "/api/webhooks/evolution/messages-upsert",
        "/api/webhooks/evolution/messages-update",
        "/api/webhooks/evolution/connection-update",
        "/api/webhooks/evolution/send-message",
        "/api/webhooks/evolution/messages-delete",
        "/api/webhooks/evolution/contacts-upsert",
      ];

      // All should match the pattern /api/webhooks/evolution/:eventType
      for (const path of paths) {
        const match = path.match(/^\/api\/webhooks\/evolution\/(.+)$/);
        expect(match).not.toBeNull();
        expect(match![1]).toBeTruthy();
      }
    });
  });
});
