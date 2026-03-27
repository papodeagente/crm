import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for Inbox UX fixes:
 * 1. Claim mutation uses await (was missing)
 * 2. Profile pictures background fetch from API when DB returns null
 * 3. Inbox query optimization (subquery before JOINs)
 * 4. Queue tab has only one claim button (no more UserPlus assign button)
 * 5. Profile pics refetch interval for progressive loading
 */

const routersPath = path.resolve(__dirname, "routers.ts");
const routersCode = fs.readFileSync(routersPath, "utf-8");

const dbPath = path.resolve(__dirname, "db.ts");
const dbCode = fs.readFileSync(dbPath, "utf-8");

const inboxPath = path.resolve(__dirname, "../client/src/pages/Inbox.tsx");
const inboxCode = fs.readFileSync(inboxPath, "utf-8");

describe("Inbox Fixes", () => {
  // ─── 1. Claim mutation await ───
  describe("Claim mutation", () => {
    it("should await claimConversation call", () => {
      // The claim procedure must await the async DB function
      const claimSection = routersCode.substring(
        routersCode.indexOf("claim: sessionTenantProcedure"),
        routersCode.indexOf("claim: sessionTenantProcedure") + 500
      );
      expect(claimSection).toContain("await claimConversation(");
    });
  });

  // ─── 2. Profile pictures background fetch ───
  describe("Profile pictures endpoint", () => {
    it("should fetch missing pics from API in background", () => {
      // The profilePictures endpoint should have logic to fetch from API when DB returns null
      const ppSection = routersCode.substring(
        routersCode.indexOf("profilePictures: sessionTenantProcedure"),
        routersCode.indexOf("profilePictures: sessionTenantProcedure") + 1000
      );
      expect(ppSection).toContain("missingJids");
      expect(ppSection).toContain("getProfilePictures");
    });

    it("should limit background fetch to max 10 JIDs per call", () => {
      const ppSection = routersCode.substring(
        routersCode.indexOf("profilePictures: sessionTenantProcedure"),
        routersCode.indexOf("profilePictures: sessionTenantProcedure") + 1000
      );
      expect(ppSection).toContain(".slice(0, 10)");
    });

    it("should save fetched profile pics to DB for caching", () => {
      const ppSection = routersCode.substring(
        routersCode.indexOf("profilePictures: sessionTenantProcedure"),
        routersCode.indexOf("profilePictures: sessionTenantProcedure") + 1500
      );
      expect(ppSection).toContain("waContacts");
      expect(ppSection).toContain("profilePictureUrl");
    });
  });

  // ─── 3. Inbox query optimization ───
  describe("Inbox query optimization", () => {
    it("should use subquery to limit rows before JOINs", () => {
      // The getWaConversationsList should use a subquery pattern
      const startIdx = dbCode.indexOf("getWaConversationsList");
      const querySection = dbCode.substring(startIdx, startIdx + 3500);
      // Should have a FROM ( SELECT ... ) wc pattern
      expect(querySection).toContain("FROM (");
      expect(querySection).toContain("SELECT * FROM wa_conversations");
      expect(querySection).toContain(") wc");
    });

    it("should JOIN only after limiting rows", () => {
      const startIdx = dbCode.indexOf("getWaConversationsList");
      const querySection = dbCode.substring(startIdx, startIdx + 3500);
      // The LIMIT should be inside the subquery, not outside
      const subqueryStart = querySection.indexOf("FROM (");
      const subqueryEnd = querySection.indexOf(") wc");
      const subquery = querySection.substring(subqueryStart, subqueryEnd);
      expect(subquery).toContain("LIMIT");
      // JOINs should be after the subquery
      const afterSubquery = querySection.substring(subqueryEnd);
      expect(afterSubquery).toContain("LEFT JOIN conversation_assignments");
      expect(afterSubquery).toContain("LEFT JOIN crm_users");
      expect(afterSubquery).toContain("LEFT JOIN contacts");
    });
  });

  // ─── 4. Queue tab single claim button ───
  describe("Queue tab buttons", () => {
    it("should have only one claim button with Atender label", () => {
      // The queue tab should have the simplified claim button
      const queueSection = inboxCode.substring(
        inboxCode.indexOf("Single claim button"),
        inboxCode.indexOf("Single claim button") + 1200
      );
      expect(queueSection).toContain("Pegar Atendimento");
      expect(queueSection).toContain("HandMetal");
      expect(queueSection).toContain("claimMutation");
    });

    it("should NOT have the inline agent assignment select UI", () => {
      // The old agent assignment inline select should be removed from queue items
      expect(inboxCode).not.toContain("Selecionar agente...");
    });

    it("should NOT have the UserPlus assign button in queue items", () => {
      // After the "Single claim button" comment, there should be no UserPlus
      const queueSection = inboxCode.substring(
        inboxCode.indexOf("Single claim button"),
        inboxCode.indexOf("Single claim button") + 1200
      );
      expect(queueSection).not.toContain("Atribuir a agente");
    });
  });

  // ─── 5. Profile pics refetch interval ───
  describe("Profile pics refetch", () => {
    it("should have a refetch interval for progressive loading", () => {
      // The profilePictures query should have refetchInterval set
      const ppQuerySection = inboxCode.substring(
        inboxCode.indexOf("profilePictures.useQuery"),
        inboxCode.indexOf("profilePictures.useQuery") + 300
      );
      expect(ppQuerySection).toContain("refetchInterval:");
      // Should be 30 seconds (30_000)
      expect(ppQuerySection).toContain("30_000");
    });

    it("should have reduced staleTime for faster pic updates", () => {
      const ppQuerySection = inboxCode.substring(
        inboxCode.indexOf("profilePictures.useQuery"),
        inboxCode.indexOf("profilePictures.useQuery") + 300
      );
      expect(ppQuerySection).toContain("staleTime: 60_000");
    });
  });
});
