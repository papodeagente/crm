import { describe, it, expect } from "vitest";
import fs from "fs";

describe("Inbox v9 - Media Download Fixes", () => {
  const evoApiCode = fs.readFileSync("server/evolutionApi.ts", "utf-8");
  const routerCode = fs.readFileSync("server/routers.ts", "utf-8");
  const evoManagerCode = fs.readFileSync("server/whatsappEvolution.ts", "utf-8");

  describe("getBase64FromMediaMessage - Full Key Support", () => {
    it("should accept options with remoteJid and fromMe", () => {
      expect(evoApiCode).toContain("options?: { remoteJid?: string; fromMe?: boolean; convertToMp4?: boolean }");
    });

    it("should include remoteJid in the key when provided", () => {
      expect(evoApiCode).toContain('if (options?.remoteJid) key.remoteJid = options.remoteJid');
    });

    it("should include fromMe in the key when provided", () => {
      expect(evoApiCode).toContain('if (options?.fromMe !== undefined) key.fromMe = options.fromMe');
    });

    it("should NOT double JSON.stringify the body", () => {
      // The body should be passed as an object to evoFetch, not pre-stringified
      // Find the getBase64FromMediaMessage function body
      const fnStart = evoApiCode.indexOf("export async function getBase64FromMediaMessage");
      const fnEnd = evoApiCode.indexOf("\n}", fnStart + 100);
      const fnBody = evoApiCode.substring(fnStart, fnEnd);
      // Should NOT have JSON.stringify in the body parameter
      expect(fnBody).not.toContain("body: JSON.stringify");
      // Should have body as an object with message key
      expect(fnBody).toContain("message: { key }");
    });
  });

  describe("getMediaUrl Router - Passes Full Key", () => {
    it("should pass remoteJid from the message to getBase64FromMediaMessage", () => {
      expect(routerCode).toContain("remoteJid: msg.remoteJid");
    });

    it("should pass fromMe from the message to getBase64FromMediaMessage", () => {
      expect(routerCode).toContain("fromMe: msg.fromMe");
    });

    it("should return unavailable:true instead of throwing when media not available", () => {
      expect(routerCode).toContain("return { url: null, mimetype: null, unavailable: true }");
    });

    it("should mark unavailable messages in DB to avoid retries", () => {
      expect(routerCode).toContain('mediaMimeType: "__unavailable__"');
    });
  });

  describe("Webhook Handler - Passes Full Key", () => {
    it("should pass remoteJid and fromMe when downloading media in webhook", () => {
      // The getBase64FromMediaMessage call in the webhook handler should include remoteJid and fromMe
      expect(evoManagerCode).toContain("getBase64FromMediaMessage(session.instanceName, messageId, {");
      expect(evoManagerCode).toContain("remoteJid,");
      expect(evoManagerCode).toContain("fromMe,");
    });
  });

  describe("Sync - Media Extraction and Download", () => {
    it("should extract media info during sync", () => {
      expect(evoManagerCode).toContain("this.extractMediaInfo(msg)");
    });

    it("should include mediaUrl in sync insertBatch", () => {
      expect(evoManagerCode).toContain("mediaUrl: syncMediaInfo.mediaUrl || null");
    });

    it("should include mediaMimeType in sync insertBatch", () => {
      expect(evoManagerCode).toContain("mediaMimeType: syncMediaInfo.mediaMimeType || null");
    });

    it("should have downloadMediaBatch method", () => {
      expect(evoManagerCode).toContain("private async downloadMediaBatch");
    });

    it("should call downloadMediaBatch after sync insert", () => {
      expect(evoManagerCode).toContain("this.downloadMediaBatch(session, mediaMessages)");
    });

    it("downloadMediaBatch should pass remoteJid and fromMe", () => {
      const batchSection = evoManagerCode.substring(
        evoManagerCode.indexOf("downloadMediaBatch"),
        evoManagerCode.indexOf("downloadMediaBatch") + 1000
      );
      expect(batchSection).toContain("remoteJid: msg.remoteJid");
      expect(batchSection).toContain("fromMe: msg.fromMe");
    });
  });
});
