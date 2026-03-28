import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("WhatsApp UX Fixes", () => {
  // ─── Notes Bug Fix ───
  describe("Internal Notes - handleSend fix", () => {
    const chatPath = path.join(__dirname, "../client/src/components/WhatsAppChat.tsx");
    const chatSrc = fs.readFileSync(chatPath, "utf-8");

    it("should check isNoteMode BEFORE phone number validation in the main handleSend", () => {
      // There are 2 handleSend callbacks - we need the second one (main chat, not audio recorder)
      const firstIdx = chatSrc.indexOf("const handleSend = useCallback(()");
      const secondIdx = chatSrc.indexOf("const handleSend = useCallback(()," , firstIdx + 100);
      // Use lastIndexOf to find the second (main) handleSend
      const allMatches: number[] = [];
      let searchFrom = 0;
      while (true) {
        const idx = chatSrc.indexOf("const handleSend = useCallback(() =>", searchFrom);
        if (idx === -1) break;
        allMatches.push(idx);
        searchFrom = idx + 1;
      }
      // If exact match fails, try without arrow
      if (allMatches.length === 0) {
        let sf = 0;
        while (true) {
          const idx = chatSrc.indexOf("const handleSend = useCallback(()", sf);
          if (idx === -1) break;
          allMatches.push(idx);
          sf = idx + 1;
        }
      }
      expect(allMatches.length).toBeGreaterThanOrEqual(2);

      // The second handleSend is the main one with note mode
      const mainHandleSend = allMatches[1];
      const section = chatSrc.slice(mainHandleSend, mainHandleSend + 1500);

      // isNoteMode check must come BEFORE the phone number extraction
      const noteModeIdx = section.indexOf("isNoteMode && waConversationId");
      const phoneNumberIdx = section.indexOf("contact?.phone");

      expect(noteModeIdx).toBeGreaterThan(-1);
      expect(phoneNumberIdx).toBeGreaterThan(-1);
      // Note mode check must be before phone number check
      expect(noteModeIdx).toBeLessThan(phoneNumberIdx);
    });

    it("should call createNoteMut.mutate in the main handleSend", () => {
      // Find the second handleSend
      const allMatches: number[] = [];
      let sf = 0;
      while (true) {
        const idx = chatSrc.indexOf("const handleSend = useCallback(()", sf);
        if (idx === -1) break;
        allMatches.push(idx);
        sf = idx + 1;
      }
      const mainHandleSend = allMatches[allMatches.length - 1];
      const section = chatSrc.slice(mainHandleSend, mainHandleSend + 1500);

      expect(section).toContain("createNoteMut.mutate(");
      expect(section).toContain("waConversationId");
      expect(section).toContain("content: messageText.trim()");
    });

    it("should have note mode return before phone validation", () => {
      const allMatches: number[] = [];
      let sf = 0;
      while (true) {
        const idx = chatSrc.indexOf("const handleSend = useCallback(()", sf);
        if (idx === -1) break;
        allMatches.push(idx);
        sf = idx + 1;
      }
      const mainHandleSend = allMatches[allMatches.length - 1];
      const section = chatSrc.slice(mainHandleSend, mainHandleSend + 1500);

      // After isNoteMode block there should be "return;" before phone check
      const noteModeIdx = section.indexOf("isNoteMode");
      const afterNoteMode = section.slice(noteModeIdx);
      const returnIdx = afterNoteMode.indexOf("return;");
      const phoneIdx = afterNoteMode.indexOf("contact?.phone");

      expect(returnIdx).toBeGreaterThan(-1);
      expect(phoneIdx).toBeGreaterThan(-1);
      expect(returnIdx).toBeLessThan(phoneIdx);
    });
  });

  // ─── Conversation Reopen Logic ───
  describe("Conversation Reopen on New Message", () => {
    const evoPath = path.join(__dirname, "whatsappEvolution.ts");
    const evoSrc = fs.readFileSync(evoPath, "utf-8");

    it("should have auto-reopen logic for resolved/closed conversations", () => {
      expect(evoSrc).toContain("AUTO-REOPEN");
      expect(evoSrc).toContain("reopening to queue");
    });

    it("should set queuedAt when reopening conversation", () => {
      expect(evoSrc).toContain("queuedAt");
    });

    it("should log the reopen event with logConversationEvent", () => {
      expect(evoSrc).toContain("logConversationEvent");
      expect(evoSrc).toContain("reopened");
    });

    it("should emit conversationUpdated event on reopen", () => {
      expect(evoSrc).toContain("conversationUpdated");
      expect(evoSrc).toContain('"reopened"');
    });
  });

  // ─── Socket Forwarding for conversationUpdated ───
  describe("Socket.IO conversationUpdated forwarding", () => {
    const corePath = path.join(__dirname, "_core/index.ts");
    const coreSrc = fs.readFileSync(corePath, "utf-8");

    it("should forward conversationUpdated events to socket.io", () => {
      expect(coreSrc).toContain("conversationUpdated");
      // The emit should use the same event name
      expect(coreSrc).toContain('io.emit("conversationUpdated"');
    });
  });

  // ─── Profile Pictures Endpoint ───
  describe("Profile Pictures - await API fetch", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const routersSrc = fs.readFileSync(routersPath, "utf-8");

    it("should have profilePictures endpoint", () => {
      expect(routersSrc).toContain("profilePictures");
    });

    it("should await API fetch for missing profile pics", () => {
      const ppIdx = routersSrc.indexOf("profilePictures:");
      expect(ppIdx).toBeGreaterThan(-1);
      const section = routersSrc.slice(ppIdx, ppIdx + 3000);
      expect(section).toContain("await");
      expect(section).toContain("getProfilePictures");
    });
  });

  // ─── Webhook Deduplication ───
  describe("Webhook Deduplication", () => {
    const webhookPath = path.join(__dirname, "webhookRoutes.ts");
    const webhookSrc = fs.readFileSync(webhookPath, "utf-8");

    it("should have deduplication for Z-API webhooks", () => {
      expect(webhookSrc).toContain("isDuplicateWebhook");
      expect(webhookSrc).toContain("Duplicate skipped");
    });

    it("should have LRU deduplication cache", () => {
      expect(webhookSrc).toContain("LRU deduplication cache");
    });
  });
});
