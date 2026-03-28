/**
 * Tests for WhatsApp API — Z-API Only
 *
 * Evolution API has been fully removed from the system.
 * These tests validate the Z-API provider and WhatsApp manager exports.
 */
import { describe, it, expect } from "vitest";

describe("Z-API Credentials", () => {
  it("should have ZAPI_CLIENT_TOKEN configured", () => {
    const token = process.env.ZAPI_CLIENT_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(5);
  });
  it("should have ZAPI_PARTNER_TOKEN configured", () => {
    const token = process.env.ZAPI_PARTNER_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(5);
  });
});

describe("Z-API Provider Exports", () => {
  it("should export zapiProvider with all required methods", async () => {
    const { zapiProvider } = await import("./providers/zapiProvider");
    expect(zapiProvider).toBeDefined();
    expect(zapiProvider.type).toBe("zapi");
    const requiredMethods = [
      "createInstance", "connectInstance", "deleteInstance", "fetchAllInstances",
      "fetchInstance", "restartInstance", "logoutInstance",
      "sendText", "sendMedia", "sendReaction", "sendContact", "sendLocation",
      "sendSticker", "sendAudio", "sendTextWithQuote",
      "findChats", "findMessages", "findContacts",
      "archiveChat", "markMessageAsUnread", "markMessageAsRead",
      "updateBlockStatus", "checkIsWhatsApp",
      "fetchAllGroups", "findGroupByJid", "createGroup",
      "getBase64FromMediaMessage",
      "healthCheck", "findWebhook", "setWebhook", "ensureWebhook",
      "normalizeWebhookPayload",
    ];
    for (const method of requiredMethods) {
      expect(typeof (zapiProvider as any)[method]).toBe("function");
    }
  });
});

describe("WhatsApp Manager", () => {
  it("should export whatsappManager singleton with correct interface", async () => {
    const { whatsappManager } = await import("./whatsappEvolution");
    expect(whatsappManager).toBeDefined();
    expect(typeof whatsappManager.connect).toBe("function");
    expect(typeof whatsappManager.disconnect).toBe("function");
    expect(typeof whatsappManager.deleteSession).toBe("function");
    expect(typeof whatsappManager.sendTextMessage).toBe("function");
    expect(typeof whatsappManager.sendMediaMessage).toBe("function");
    expect(typeof whatsappManager.getSession).toBe("function");
    expect(typeof whatsappManager.getProfilePicture).toBe("function");
    expect(typeof whatsappManager.getProfilePictures).toBe("function");
    expect(typeof whatsappManager.syncContacts).toBe("function");
    expect(typeof whatsappManager.resolveJidPublic).toBe("function");
  });

  it("should return undefined for non-existent session", async () => {
    const { whatsappManager } = await import("./whatsappEvolution");
    const session = whatsappManager.getSession("non-existent-session-xyz");
    expect(session).toBeUndefined();
  });
});
