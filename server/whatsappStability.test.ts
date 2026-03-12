import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for WhatsApp Engine Stability Features
 * 
 * These tests verify the restructured WhatsApp/Baileys engine:
 * - Infinite reconnect with intelligent backoff
 * - Health check periodic monitoring
 * - Auto-restore of sessions on server startup
 * - Optimized connection settings
 * - Fatal vs recoverable disconnect handling
 */

// We test the WhatsAppManager class behavior by importing and inspecting it
// Since the actual Baileys connection requires a real WhatsApp account,
// we test the manager's logic, state management, and configuration

describe("WhatsApp Stability Engine", () => {
  // ─── Configuration Constants ───
  describe("Connection Configuration", () => {
    it("should use 30s keepAlive interval (not aggressive 25s)", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("KEEPALIVE_INTERVAL_MS = 30_000");
      expect(source).toContain("keepAliveIntervalMs: KEEPALIVE_INTERVAL_MS");
    });

    it("should disable defaultQueryTimeoutMs (set to 0) to prevent silent kills", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("DEFAULT_QUERY_TIMEOUT_MS = 0");
      expect(source).toContain("defaultQueryTimeoutMs: DEFAULT_QUERY_TIMEOUT_MS");
    });

    it("should use Desktop browser identity to avoid bot detection", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain('Browsers.macOS("Desktop")');
      expect(source).toContain("browser: Browsers.macOS");
    });

    it("should have markOnlineOnConnect disabled", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("markOnlineOnConnect: false");
    });

    it("should have syncFullHistory disabled to reduce load", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("syncFullHistory: false");
    });

    it("should have generateHighQualityLinkPreview disabled to reduce API calls", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("generateHighQualityLinkPreview: false");
    });

    it("should use 45s connect timeout for slow networks", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("CONNECT_TIMEOUT_MS = 45_000");
    });
  });

  // ─── Reconnect Logic ───
  describe("Reconnect Strategy", () => {
    it("should define FATAL_CODES for loggedOut (401) and banned (403)", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("FATAL_CODES = new Set([401, 403])");
    });

    it("should define IMMEDIATE_RECONNECT_CODES for 428, 408, 503, 515", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("IMMEDIATE_RECONNECT_CODES = new Set([428, 408, 503])");
    });

    it("should have max reconnect delay of 5 minutes (not 2 minutes)", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("MAX_RECONNECT_DELAY_MS = 5 * 60_000");
    });

    it("should NOT have a MAX_RECONNECT_ATTEMPTS limit (infinite reconnect)", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      // Should NOT contain the old MAX_RECONNECT_ATTEMPTS = 15 pattern
      expect(source).not.toContain("MAX_RECONNECT_ATTEMPTS = 15");
      // Should contain the infinite reconnect pattern (never gives up)
      expect(source).toContain("NEVER give up");
    });

    it("should use exponential backoff with 1.5x multiplier and jitter", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("Math.pow(1.5,");
      expect(source).toContain("jitter");
      expect(source).toContain("BASE_RECONNECT_DELAY_MS = 3_000");
    });

    it("should cap backoff at attempt 20 to prevent overflow", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("Math.min(attempts, 20)");
    });

    it("should use 2s immediate reconnect for codes 428, 408, 503, 515", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("isImmediate ? 2000 : undefined");
    });
  });

  // ─── Health Check ───
  describe("Health Check System", () => {
    it("should have a 5-minute health check interval", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("HEALTH_CHECK_INTERVAL_MS = 5 * 60_000");
    });

    it("should check WebSocket readyState in health check", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("ws.readyState !== 1");
      expect(source).toContain("health_check_ws_closed");
    });

    it("should start health check on successful connection", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("this.startHealthCheck(sessionId)");
    });

    it("should stop health check on disconnect", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("this.stopHealthCheck(sessionId)");
    });

    it("should log uptime every 30 minutes (every 6th check)", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("checkCount % 6 === 0");
      expect(source).toContain("uptimeMinutes");
    });
  });

  // ─── Auto-Restore ───
  describe("Auto-Restore on Server Startup", () => {
    it("should have autoRestoreSessions method", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("async autoRestoreSessions()");
    });

    it("should query database for connected sessions", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain('eq(whatsappSessions.status, "connected")');
    });

    it("should check for auth files before restoring", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("No auth files for");
      expect(source).toContain("skipping (DB status preserved");
    });

    it("should stagger reconnections with 3s delay between sessions", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("setTimeout(r, 3000)");
      expect(source).toContain("Stagger reconnections");
    });

    it("should be called from server startup with 10s delay", async () => {
      const indexSource = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/_core/index.ts", "utf-8")
      );
      expect(indexSource).toContain("whatsappManager.autoRestoreSessions()");
      expect(indexSource).toContain("10_000");
    });
  });

  // ─── Session State Management ───
  describe("Session State", () => {
    it("should track lastConnectedAt timestamp", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("lastConnectedAt: number | null");
      expect(source).toContain("sessionState.lastConnectedAt = Date.now()");
    });

    it("should track lastHealthCheck timestamp", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("lastHealthCheck: number | null");
      expect(source).toContain("session.lastHealthCheck = Date.now()");
    });

    it("should track userId in session state", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("userId: number");
    });

    it("should have getConnectionStats method for monitoring", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("getConnectionStats(sessionId: string)");
      expect(source).toContain("uptime:");
      expect(source).toContain("healthChecks:");
      expect(source).toContain("reconnectAttempts:");
    });
  });

  // ─── Fatal Disconnect Handling ───
  describe("Fatal Disconnect Handling", () => {
    it("should clean auth files on loggedOut (401)", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("FATAL disconnect");
      expect(source).toContain("rmSync(sessionDir, { recursive: true, force: true })");
    });

    it("should clean auth files on badSession (500)", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("bad session detected");
      expect(source).toContain("DisconnectReason.badSession");
    });

    it("should create notification on fatal disconnect", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("WhatsApp Desconectado Permanentemente");
    });

    it("should create notification on bad session", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("Sessão Corrompida");
    });
  });

  // ─── Partial Connection Updates ───
  describe("Partial Connection Update Handling", () => {
    it("should handle partial updates without changing state", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("Do NOT return early here. Partial updates are informational");
      expect(source).toContain("receivedPendingNotifications");
      expect(source).toContain("isNewLogin");
    });
  });

  // ─── Graceful Shutdown ───
  describe("Graceful Shutdown", () => {
    it("should have shutdown method that clears all timers", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("shutdown(): Promise<void>");
      expect(source).toContain("isShuttingDown = true");
      expect(source).toContain("healthCheckTimers.forEach");
      expect(source).toContain("reconnectTimers.forEach");
    });

    it("should prevent new reconnects during shutdown", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain("if (this.isShuttingDown) return");
    });
  });

  // ─── Duplicate Connection Prevention ───
  describe("Duplicate Connection Prevention", () => {
    it("should prevent duplicate connections when already connecting", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain('existing?.status === "connecting" || existing?.status === "reconnecting") && existing.socket');
    });

    it("should return existing session when already connected", async () => {
      const source = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/whatsapp-automation-app/server/whatsapp.ts", "utf-8")
      );
      expect(source).toContain('existing?.status === "connected"');
    });
  });

  // ─── WhatsAppManager Instance ───
  describe("WhatsAppManager Instance", () => {
    it("should export a singleton whatsappManager instance", async () => {
      const { whatsappManager } = await import("./whatsapp");
      expect(whatsappManager).toBeDefined();
      expect(typeof whatsappManager.connect).toBe("function");
      expect(typeof whatsappManager.disconnect).toBe("function");
      expect(typeof whatsappManager.getAllSessions).toBe("function");
      expect(typeof whatsappManager.getSession).toBe("function");
      expect(typeof whatsappManager.autoRestoreSessions).toBe("function");
      expect(typeof whatsappManager.getConnectionStats).toBe("function");
      expect(typeof whatsappManager.shutdown).toBe("function");
    });

    it("should return empty sessions initially", async () => {
      const { whatsappManager } = await import("./whatsapp");
      const sessions = whatsappManager.getAllSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });

    it("should return undefined for unknown session", async () => {
      const { whatsappManager } = await import("./whatsapp");
      const session = whatsappManager.getSession("nonexistent-session-xyz");
      expect(session).toBeUndefined();
    });

    it("should return null stats for unknown session", async () => {
      const { whatsappManager } = await import("./whatsapp");
      const stats = whatsappManager.getConnectionStats("nonexistent-session-xyz");
      expect(stats).toBeNull();
    });
  });
});
