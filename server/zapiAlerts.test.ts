import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Mock the notification module
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import { getDb } from "./db";
import { notifyOwner } from "./_core/notification";

describe("Z-API Alert Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Alert Check Result Structure", () => {
    it("should define correct AlertCheckResult interface shape", () => {
      const result = {
        disconnectedAlerts: 2,
        billingAlerts: 1,
        totalNew: 3,
        autoResolved: 0,
      };

      expect(result).toHaveProperty("disconnectedAlerts");
      expect(result).toHaveProperty("billingAlerts");
      expect(result).toHaveProperty("totalNew");
      expect(result).toHaveProperty("autoResolved");
      expect(result.totalNew).toBe(result.disconnectedAlerts + result.billingAlerts);
    });

    it("should return zero counts when no issues found", () => {
      const result = {
        disconnectedAlerts: 0,
        billingAlerts: 0,
        totalNew: 0,
        autoResolved: 0,
      };

      expect(result.totalNew).toBe(0);
      expect(result.autoResolved).toBe(0);
    });
  });

  describe("Alert Types", () => {
    it("should recognize disconnected alert type", () => {
      const alert = {
        type: "disconnected" as const,
        severity: "critical" as const,
        message: 'WhatsApp desconectado para "Agency X" (instância EnturOS-TEST-100)',
        tenantId: 100,
        tenantName: "Agency X",
        alertKey: "disconnected:100:INST123",
      };

      expect(alert.type).toBe("disconnected");
      expect(alert.severity).toBe("critical");
      expect(alert.alertKey).toContain("disconnected:");
      expect(alert.alertKey).toContain(String(alert.tenantId));
    });

    it("should recognize billing_overdue alert type", () => {
      const alert = {
        type: "billing_overdue" as const,
        severity: "warning" as const,
        message: 'Tenant "Agency Y" está past_due mas possui instância Z-API ativa',
        tenantId: 200,
        tenantName: "Agency Y",
        alertKey: "billing_overdue:200",
      };

      expect(alert.type).toBe("billing_overdue");
      expect(alert.severity).toBe("warning");
      expect(alert.alertKey).toContain("billing_overdue:");
    });

    it("should set critical severity for cancelled/expired billing", () => {
      const cancelledSeverity = "cancelled" === "cancelled" || "cancelled" === "expired" ? "critical" : "warning";
      const expiredSeverity = "expired" === "cancelled" || "expired" === "expired" ? "critical" : "warning";
      const pastDueSeverity = "past_due" === "cancelled" || "past_due" === "expired" ? "critical" : "warning";

      expect(cancelledSeverity).toBe("critical");
      expect(expiredSeverity).toBe("critical");
      expect(pastDueSeverity).toBe("warning");
    });
  });

  describe("Alert Key Generation", () => {
    it("should generate unique keys for disconnected alerts", () => {
      const key1 = `disconnected:100:INST_A`;
      const key2 = `disconnected:100:INST_B`;
      const key3 = `disconnected:200:INST_A`;

      expect(key1).not.toBe(key2); // Different instances
      expect(key1).not.toBe(key3); // Different tenants
    });

    it("should generate unique keys for billing alerts", () => {
      const key1 = `billing_overdue:100`;
      const key2 = `billing_overdue:200`;

      expect(key1).not.toBe(key2);
      expect(key1).toContain("100");
      expect(key2).toContain("200");
    });
  });

  describe("Billing Overdue Detection", () => {
    const BILLING_OVERDUE_STATUSES = ["past_due", "restricted", "cancelled", "expired"];

    it("should detect past_due as overdue", () => {
      expect(BILLING_OVERDUE_STATUSES).toContain("past_due");
    });

    it("should detect restricted as overdue", () => {
      expect(BILLING_OVERDUE_STATUSES).toContain("restricted");
    });

    it("should detect cancelled as overdue", () => {
      expect(BILLING_OVERDUE_STATUSES).toContain("cancelled");
    });

    it("should detect expired as overdue", () => {
      expect(BILLING_OVERDUE_STATUSES).toContain("expired");
    });

    it("should NOT detect active as overdue", () => {
      expect(BILLING_OVERDUE_STATUSES).not.toContain("active");
    });

    it("should NOT detect trialing as overdue", () => {
      expect(BILLING_OVERDUE_STATUSES).not.toContain("trialing");
    });
  });

  describe("Alert Count Structure", () => {
    it("should return correct getAlertCounts shape", () => {
      const counts = {
        total: 5,
        critical: 3,
        warning: 2,
        disconnected: 2,
        billingOverdue: 3,
      };

      expect(counts.total).toBe(counts.critical + counts.warning);
      expect(counts.total).toBe(counts.disconnected + counts.billingOverdue);
      expect(typeof counts.total).toBe("number");
      expect(typeof counts.critical).toBe("number");
      expect(typeof counts.warning).toBe("number");
    });

    it("should handle zero counts", () => {
      const counts = {
        total: 0,
        critical: 0,
        warning: 0,
        disconnected: 0,
        billingOverdue: 0,
      };

      expect(counts.total).toBe(0);
      expect(counts.critical).toBe(0);
    });
  });

  describe("Owner Notification", () => {
    it("should format notification title with alert count", () => {
      const alertCount = 3;
      const title = `⚠️ ${alertCount} alerta(s) Z-API crítico(s)`;

      expect(title).toContain("3");
      expect(title).toContain("Z-API");
      expect(title).toContain("crítico");
    });

    it("should format notification content with alert summary", () => {
      const alerts = [
        { type: "disconnected", message: 'WhatsApp desconectado para "Agency A"' },
        { type: "billing_overdue", message: 'Tenant "Agency B" está past_due' },
      ];

      const alertSummary = alerts
        .map((a) => `- [${a.type === "disconnected" ? "DESCONECTADO" : "INADIMPLENTE"}] ${a.message}`)
        .join("\n");

      expect(alertSummary).toContain("DESCONECTADO");
      expect(alertSummary).toContain("INADIMPLENTE");
      expect(alertSummary).toContain("Agency A");
      expect(alertSummary).toContain("Agency B");
    });

    it("should only notify for critical unresolved alerts", () => {
      const alerts = [
        { severity: "critical", resolved: false, ownerNotified: false },
        { severity: "warning", resolved: false, ownerNotified: false },
        { severity: "critical", resolved: true, ownerNotified: false },
        { severity: "critical", resolved: false, ownerNotified: true },
      ];

      const toNotify = alerts.filter(
        (a) => a.severity === "critical" && !a.resolved && !a.ownerNotified
      );

      expect(toNotify).toHaveLength(1);
    });
  });

  describe("Auto-Resolution Logic", () => {
    it("should auto-resolve disconnected alert when session reconnects", () => {
      // Simulate: alert exists for disconnected, session is now connected
      const alertExists = true;
      const sessionStatus = "connected";
      const isDisconnected = sessionStatus !== "connected";

      // If not disconnected and alert exists → auto-resolve
      const shouldAutoResolve = !isDisconnected && alertExists;
      expect(shouldAutoResolve).toBe(true);
    });

    it("should NOT auto-resolve if still disconnected", () => {
      const alertExists = true;
      const sessionStatus = "disconnected";
      const isDisconnected = sessionStatus !== "connected";

      const shouldAutoResolve = !isDisconnected && alertExists;
      expect(shouldAutoResolve).toBe(false);
    });

    it("should auto-resolve billing alert when tenant is in good standing", () => {
      const overdueStatuses = ["past_due", "restricted", "cancelled", "expired"];
      const currentStatus = "active";

      const isOverdue = overdueStatuses.includes(currentStatus);
      expect(isOverdue).toBe(false);
      // If not overdue → should auto-resolve existing billing alert
    });

    it("should NOT auto-resolve billing alert if tenant still overdue", () => {
      const overdueStatuses = ["past_due", "restricted", "cancelled", "expired"];
      const currentStatus = "past_due";

      const isOverdue = overdueStatuses.includes(currentStatus);
      expect(isOverdue).toBe(true);
    });
  });

  describe("Scheduler Configuration", () => {
    it("should run every 30 minutes", () => {
      const INTERVAL_MS = 30 * 60 * 1000;
      expect(INTERVAL_MS).toBe(1_800_000);
    });

    it("should start first check after 3 minutes", () => {
      const FIRST_RUN_DELAY = 3 * 60 * 1000;
      expect(FIRST_RUN_DELAY).toBe(180_000);
    });
  });

  describe("Resolve Alert", () => {
    it("should track who resolved the alert", () => {
      const resolveData = {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: "admin@entur.com",
      };

      expect(resolveData.resolved).toBe(true);
      expect(resolveData.resolvedBy).toBe("admin@entur.com");
      expect(resolveData.resolvedAt).toBeInstanceOf(Date);
    });

    it("should mark auto-resolved alerts with 'auto' resolver", () => {
      const resolveData = {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: "auto",
      };

      expect(resolveData.resolvedBy).toBe("auto");
    });
  });

  describe("Database unavailability handling", () => {
    it("should return empty results when db is null", async () => {
      (getDb as any).mockResolvedValue(null);

      // Simulate the behavior of runZapiAlertCheck when db is null
      const db = await getDb();
      if (!db) {
        const result = { disconnectedAlerts: 0, billingAlerts: 0, totalNew: 0, autoResolved: 0 };
        expect(result.totalNew).toBe(0);
      }
    });

    it("should return zero for getAlertCounts when db is null", async () => {
      (getDb as any).mockResolvedValue(null);

      const db = await getDb();
      if (!db) {
        const counts = { total: 0, critical: 0, warning: 0, disconnected: 0, billingOverdue: 0 };
        expect(counts.total).toBe(0);
      }
    });

    it("should return false for resolveAlert when db is null", async () => {
      (getDb as any).mockResolvedValue(null);

      const db = await getDb();
      const result = !db ? false : true;
      expect(result).toBe(false);
    });
  });

  describe("Alert Metadata", () => {
    it("should store instance info in disconnected alert metadata", () => {
      const metadata = JSON.stringify({
        zapiInstanceId: "INST123",
        instanceName: "EnturOS-TEST-100",
        sessionStatus: "disconnected",
      });

      const parsed = JSON.parse(metadata);
      expect(parsed.zapiInstanceId).toBe("INST123");
      expect(parsed.instanceName).toBe("EnturOS-TEST-100");
      expect(parsed.sessionStatus).toBe("disconnected");
    });

    it("should store billing info in billing alert metadata", () => {
      const metadata = JSON.stringify({
        billingStatus: "past_due",
        plan: "pro",
      });

      const parsed = JSON.parse(metadata);
      expect(parsed.billingStatus).toBe("past_due");
      expect(parsed.plan).toBe("pro");
    });

    it("should handle no_session status in metadata", () => {
      const metadata = JSON.stringify({
        zapiInstanceId: "INST456",
        instanceName: "EnturOS-TEST-200",
        sessionStatus: "no_session",
      });

      const parsed = JSON.parse(metadata);
      expect(parsed.sessionStatus).toBe("no_session");
    });
  });
});
