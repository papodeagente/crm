import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Bug 2: AI suggestion context should use full conversation ──
describe("AI Suggestion Context Size", () => {
  it("should use default maxMessages (80) instead of hardcoded 10", async () => {
    // Read the aiSuggestionWorker.ts to verify the limit was increased
    const fs = await import("fs");
    const workerCode = fs.readFileSync("server/aiSuggestionWorker.ts", "utf-8");
    
    // The old code had fetchConversationMessages(sessionId, remoteJid, 10)
    // The fix removes the 10 limit so it uses the default (80)
    const fetchCalls = workerCode.match(/fetchConversationMessages\([^)]+\)/g) || [];
    for (const call of fetchCalls) {
      // Should NOT have a hardcoded small limit like 10
      expect(call).not.toMatch(/,\s*10\s*\)/);
    }
  });
});

// ── Bug 3: Internal notes should have edit/delete functionality ──
describe("Internal Notes CRUD", () => {
  it("updateInternalNote function should exist in db.ts", async () => {
    const fs = await import("fs");
    const dbCode = fs.readFileSync("server/db.ts", "utf-8");
    expect(dbCode).toContain("export async function updateInternalNote");
  });

  it("notes.update tRPC endpoint should exist", async () => {
    const fs = await import("fs");
    const routersCode = fs.readFileSync("server/routers.ts", "utf-8");
    // The notes router should have an update mutation
    expect(routersCode).toContain("update: tenantProcedure");
    // It should accept noteId and content
    expect(routersCode).toContain("noteId: z.number()");
    expect(routersCode).toContain("content: z.string().min(1).optional()");
  });

  it("notes.delete tRPC endpoint should exist", async () => {
    const fs = await import("fs");
    const routersCode = fs.readFileSync("server/routers.ts", "utf-8");
    expect(routersCode).toContain("delete: tenantProcedure");
    expect(routersCode).toContain("deleteInternalNote");
  });

  it("WhatsAppChat should have edit/delete buttons for notes", async () => {
    const fs = await import("fs");
    const chatCode = fs.readFileSync("client/src/components/WhatsAppChat.tsx", "utf-8");
    // Should have deleteNoteMut and updateNoteMut
    expect(chatCode).toContain("deleteNoteMut");
    expect(chatCode).toContain("updateNoteMut");
    // Should have editing state
    expect(chatCode).toContain("editingNoteId");
    expect(chatCode).toContain("editingNoteText");
    // Should have edit/delete UI elements
    expect(chatCode).toContain("Editar nota");
    expect(chatCode).toContain("Excluir esta nota interna?");
  });
});

// ── Bug 1: AI sent message should appear immediately in inbox ──
describe("AI Suggestion Send - Optimistic Update", () => {
  it("AiSuggestionPanel should add optimistic messages on send", async () => {
    const fs = await import("fs");
    const panelCode = fs.readFileSync("client/src/components/AiSuggestionPanel.tsx", "utf-8");
    // Should call onSendBroken callback to notify parent of sent messages
    expect(panelCode).toContain("onSendBroken");
    // Should have the send broken mutation
    expect(panelCode).toContain("sendBrokenMut");
  });
});

// ── Bug 4: Finish attendance should update convStore immediately ──
describe("Finish Attendance - Optimistic Store Update", () => {
  it("finishMut should update convStore with resolved status", async () => {
    const fs = await import("fs");
    const inboxCode = fs.readFileSync("client/src/pages/Inbox.tsx", "utf-8");
    // The finishMut onSuccess should call convStore.updateAssignment
    const finishSection = inboxCode.slice(
      inboxCode.indexOf("finishAttendance.useMutation"),
      inboxCode.indexOf("finishAttendance.useMutation") + 500
    );
    expect(finishSection).toContain("convStore.updateAssignment");
    expect(finishSection).toContain('assignedUserId: null');
    expect(finishSection).toContain('"resolved"');
  });
});

// ── Bug 5: Claim from queue should update convStore immediately ──
describe("Claim from Queue - Optimistic Store Update", () => {
  it("claimMutation should update convStore with user assignment", async () => {
    const fs = await import("fs");
    const inboxCode = fs.readFileSync("client/src/pages/Inbox.tsx", "utf-8");
    // The claimMutation onSuccess should call convStore.updateAssignment
    const claimSection = inboxCode.slice(
      inboxCode.indexOf("queue.claim.useMutation"),
      inboxCode.indexOf("queue.claim.useMutation") + 500
    );
    expect(claimSection).toContain("convStore.updateAssignment");
    expect(claimSection).toContain("myUserId");
    expect(claimSection).toContain('"open"');
    // Should also refetch conversations to get full data
    expect(claimSection).toContain("conversationsQ.refetch");
  });
});
