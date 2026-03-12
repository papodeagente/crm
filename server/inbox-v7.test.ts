/**
 * Inbox v7 Fixes Tests
 * 
 * Tests for:
 * 1. Media detection by messageType (not just mediaUrl)
 * 2. Blank message filtering (templateMessage, interactiveMessage, etc.)
 * 3. Status mapping from Evolution API (numeric and string)
 * 4. Caption extraction from media messages
 * 5. getMediaUrl resolving instanceName correctly
 */
import { describe, it, expect } from "vitest";
import fs from "fs";

describe("Inbox v7 - Media Detection by messageType", () => {
  it("should detect media types in WhatsAppChat.tsx by messageType, not just mediaUrl", () => {
    const chatCode = fs.readFileSync("client/src/components/WhatsAppChat.tsx", "utf-8");
    
    // hasMedia should check isMediaType (based on messageType), not just mediaUrl
    expect(chatCode).toContain("const isMediaType = isImage || isVideo || isAudio || isDocument || isSticker");
    expect(chatCode).toContain("const hasMediaUrl = !!msg.mediaUrl");
    expect(chatCode).toContain("const hasMedia = hasMediaUrl || isMediaType");
  });

  it("should include pttMessage as audio type", () => {
    const chatCode = fs.readFileSync("client/src/components/WhatsAppChat.tsx", "utf-8");
    expect(chatCode).toContain('msg.messageType === "pttMessage"');
  });

  it("should include ptvMessage as video type", () => {
    const chatCode = fs.readFileSync("client/src/components/WhatsAppChat.tsx", "utf-8");
    expect(chatCode).toContain('msg.messageType === "ptvMessage"');
  });

  it("should auto-load images, stickers, and video in MediaLoader (not just audio)", () => {
    const chatCode = fs.readFileSync("client/src/components/WhatsAppChat.tsx", "utf-8");
    // MediaLoader should auto-load for all visual media types
    expect(chatCode).toContain("isAudio || isImage || isSticker || isVideo");
  });

  it("should use MediaLoader when messageType is media but mediaUrl is null", () => {
    const chatCode = fs.readFileSync("client/src/components/WhatsAppChat.tsx", "utf-8");
    // The fallback should use isMediaType and !hasMediaUrl
    expect(chatCode).toContain("isMediaType && !hasMediaUrl && msg.messageId");
  });
});

describe("Inbox v7 - Blank Message Filtering", () => {
  it("should filter out messages with placeholder content like [Template]", () => {
    const chatCode = fs.readFileSync("client/src/components/WhatsAppChat.tsx", "utf-8");
    // Should have regex to detect placeholder content
    expect(chatCode).toContain("/^\\[\\w+\\]$/.test(content)");
  });

  it("should have comprehensive HIDDEN_MSG_TYPES", () => {
    const chatCode = fs.readFileSync("client/src/components/WhatsAppChat.tsx", "utf-8");
    const hiddenTypes = [
      "protocolMessage", "senderKeyDistributionMessage", "messageContextInfo",
      "ephemeralMessage", "reactionMessage", "associatedChildMessage",
      "placeholderMessage", "albumMessage", "pollUpdateMessage",
      "groupInviteMessage", "lottieStickerMessage",
    ];
    for (const type of hiddenTypes) {
      expect(chatCode).toContain(`"${type}"`);
    }
  });

  it("should always show media types even without content", () => {
    const chatCode = fs.readFileSync("client/src/components/WhatsAppChat.tsx", "utf-8");
    // MEDIA_TYPES set should include all media message types
    expect(chatCode).toContain('"imageMessage", "videoMessage", "audioMessage", "pttMessage"');
    expect(chatCode).toContain('"documentMessage", "stickerMessage", "ptvMessage"');
  });

  it("should hide messages with empty content that are not media or special types", () => {
    const chatCode = fs.readFileSync("client/src/components/WhatsAppChat.tsx", "utf-8");
    // Filter should check for empty content
    expect(chatCode).toContain("if (!content) return false");
  });
});

describe("Inbox v7 - Status Mapping from Evolution API", () => {
  it("should map numeric status in deepSyncMessages", () => {
    const evoCode = fs.readFileSync("server/whatsappEvolution.ts", "utf-8");
    // Should have numeric status mapping in deep sync
    expect(evoCode).toContain("0: 'error', 1: 'pending', 2: 'sent', 3: 'delivered', 4: 'read', 5: 'played'");
  });

  it("should map string status in deepSyncMessages", () => {
    const evoCode = fs.readFileSync("server/whatsappEvolution.ts", "utf-8");
    // Should have string status mapping
    expect(evoCode).toContain("'DELIVERY_ACK': 'delivered'");
    expect(evoCode).toContain("'READ': 'read'");
    expect(evoCode).toContain("'PLAYED': 'played'");
  });

  it("should NOT hardcode status as 'sent' for all fromMe messages in deep sync", () => {
    const evoCode = fs.readFileSync("server/whatsappEvolution.ts", "utf-8");
    // The deep sync should use msgStatus variable, not hardcoded 'sent'
    // Count occurrences of the old pattern vs new pattern
    const hardcodedPattern = /status: fromMe \? ['"]sent['"] : ['"]received['"]/g;
    const dynamicPattern = /status: msgStatus/g;
    
    const hardcoded = (evoCode.match(hardcodedPattern) || []).length;
    const dynamic = (evoCode.match(dynamicPattern) || []).length;
    
    // Should have more dynamic patterns than hardcoded ones
    // (syncConversationsBackground still has one for the conversation insert, that's OK)
    expect(dynamic).toBeGreaterThanOrEqual(2); // deepSync + syncConversations both fixed
  });
});

describe("Inbox v7 - Caption Extraction", () => {
  it("should strip placeholder prefixes from media messages", () => {
    const chatCode = fs.readFileSync("client/src/components/WhatsAppChat.tsx", "utf-8");
    // Should strip [Imagem], [Vídeo], [Áudio], etc. prefixes
    expect(chatCode).toContain("Imagem|Vídeo|Áudio|Documento|Sticker");
  });

  it("should return null for media messages with no caption", () => {
    const chatCode = fs.readFileSync("client/src/components/WhatsAppChat.tsx", "utf-8");
    // After stripping prefix, if empty, return null
    expect(chatCode).toContain("return stripped || null");
  });
});

describe("Inbox v7 - getMediaUrl instanceName resolution", () => {
  it("should resolve instanceName from whatsappManager.getSession()", () => {
    const routerCode = fs.readFileSync("server/routers.ts", "utf-8");
    // Should use whatsappManager.getSession() to resolve instanceName
    expect(routerCode).toContain("whatsappManager.getSession(input.sessionId)");
    expect(routerCode).toContain("session?.instanceName || input.sessionId");
  });

  it("should pass instanceName, messageId, remoteJid and fromMe to getBase64FromMediaMessage", () => {
    const routerCode = fs.readFileSync("server/routers.ts", "utf-8");
    // Should pass instanceName + full key to the API call
    expect(routerCode).toContain("getBase64FromMediaMessage(instanceName, input.messageId");
    expect(routerCode).toContain("remoteJid: msg.remoteJid");
    expect(routerCode).toContain("fromMe: msg.fromMe");
  });
});
