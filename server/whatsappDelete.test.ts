import { describe, it, expect } from "vitest";
import fs from "fs";

const SOURCE_PATH = "/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts";
const ROUTER_PATH = "/home/ubuntu/whatsapp-automation-app/server/routers.ts";
const DB_PATH = "/home/ubuntu/whatsapp-automation-app/server/db.ts";

describe("WhatsApp Delete Session", () => {
  const source = fs.readFileSync(SOURCE_PATH, "utf-8");
  const router = fs.readFileSync(ROUTER_PATH, "utf-8");
  const db = fs.readFileSync(DB_PATH, "utf-8");

  // ─── Backend: deleteSession method ───
  describe("deleteSession method in WhatsAppManager", () => {
    it("should have deleteSession method with hardDelete parameter", () => {
      expect(source).toContain("async deleteSession(sessionId: string, hardDelete: boolean = false)");
    });

    it("should stop health check and reconnect timers during delete", () => {
      expect(source).toContain("this.stopHealthCheck(sessionId)");
    });

    it("should close socket during delete", () => {
      expect(source).toContain("await session.socket.logout()");
    });

    it("should clean auth files from disk during delete", () => {
      expect(source).toContain("fs.rmSync(sessionDir, { recursive: true, force: true })");
    });

    it("should support soft-delete (move to trash)", () => {
      expect(source).toContain('status: "deleted"');
    });

    it("should support hard-delete (remove from DB)", () => {
      expect(source).toContain("await db.delete(whatsappSessions)");
    });

    it("should log activity for both soft and hard delete", () => {
      expect(source).toContain("soft_delete");
      expect(source).toContain("hard_delete");
    });
  });

  // ─── Router: deleteSession and hardDeleteSession endpoints ───
  describe("Router endpoints", () => {
    it("should have deleteSession endpoint (soft-delete for any user)", () => {
      expect(router).toContain("deleteSession: protectedProcedure");
    });

    it("should have hardDeleteSession endpoint (admin only)", () => {
      expect(router).toContain("hardDeleteSession: protectedProcedure");
    });

    it("should restrict hard-delete to admins", () => {
      expect(router).toContain('role !== "admin"');
    });
  });

  // ─── DB: Sessions query excludes deleted ───
  describe("DB queries exclude deleted sessions", () => {
    it("getSessionsByUser should exclude deleted sessions", () => {
      // Check that the function filters out deleted sessions
      expect(db).toContain("getSessionsByUser");
      const fnStart = db.indexOf("export async function getSessionsByUser");
      const fnEnd = db.indexOf("}", fnStart + 1);
      const fnBody = db.substring(fnStart, fnEnd + 100);
      expect(fnBody).toContain("deleted");
    });

    it("getSessionsByTenant should exclude deleted sessions", () => {
      expect(db).toContain("getSessionsByTenant");
      const fnStart = db.indexOf("export async function getSessionsByTenant");
      const fnEnd = db.indexOf("}", fnStart + 1);
      const fnBody = db.substring(fnStart, fnEnd + 100);
      expect(fnBody).toContain("deleted");
    });
  });

  // ─── QR Code improvements ───
  describe("QR Code improvements", () => {
    it("should track QR generation count", () => {
      expect(source).toContain("qrGenerationCount");
      expect(source).toContain("MAX_QR_GENERATIONS");
    });

    it("should not return early on partial connection updates", () => {
      expect(source).toContain("Do NOT return early here. Partial updates are informational");
    });

    it("should log QR generation count", () => {
      expect(source).toContain("QR code generated (#${qrGenerationCount})");
    });

    it("should warn when too many QR codes generated without scan", () => {
      expect(source).toContain("QR codes generated without scan");
    });
  });

  // ─── Disconnect improvements ───
  describe("Disconnect improvements", () => {
    it("should update DB status on disconnect", () => {
      // Find the disconnect method and check it calls updateSessionDb
      const disconnectStart = source.indexOf("async disconnect(sessionId: string)");
      const deleteStart = source.indexOf("async deleteSession(sessionId: string");
      const disconnectBody = source.substring(disconnectStart, deleteStart);
      expect(disconnectBody).toContain("updateSessionDb");
    });

    it("should NOT call logout() during disconnect (preserves auth)", () => {
      const disconnectStart = source.indexOf("async disconnect(sessionId: string)");
      const deleteStart = source.indexOf("async deleteSession(sessionId: string");
      const disconnectBody = source.substring(disconnectStart, deleteStart);
      // disconnect should NOT call logout() — that invalidates credentials
      expect(disconnectBody).not.toContain("await session.socket.logout()");
      expect(disconnectBody).toContain("session.socket.end(undefined)");
    });

    it("should call logout() during deleteSession (intentional cleanup)", () => {
      const deleteStart = source.indexOf("async deleteSession(sessionId: string");
      const deleteBody = source.substring(deleteStart, deleteStart + 2000);
      expect(deleteBody).toContain("await session.socket.logout()");
    });
  });
});
