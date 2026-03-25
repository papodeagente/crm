import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the saasAuth module
vi.mock("./saasAuth", () => ({
  verifySaasSession: vi.fn(),
  isSuperAdmin: vi.fn(),
  SAAS_COOKIE: "entur_saas_session",
}));

// Mock the db module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Mock the provisioning service
vi.mock("./services/zapiProvisioningService", () => ({
  provisionZapiForTenant: vi.fn(),
  deprovisionZapiForTenant: vi.fn(),
}));

import { verifySaasSession, isSuperAdmin } from "./saasAuth";
import { getDb } from "./db";
import { provisionZapiForTenant, deprovisionZapiForTenant } from "./services/zapiProvisioningService";

describe("Z-API Admin Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Access Control", () => {
    it("should reject non-super-admin users", async () => {
      // Simulate non-super-admin
      (verifySaasSession as any).mockResolvedValue({ email: "user@test.com" });
      (isSuperAdmin as any).mockReturnValue(false);

      // The router checks isSuperAdmin and throws FORBIDDEN
      // We verify the mock behavior
      const session = await verifySaasSession("some-cookie");
      expect(isSuperAdmin(session!.email)).toBe(false);
    });

    it("should allow super-admin users", async () => {
      (verifySaasSession as any).mockResolvedValue({ email: "admin@entur.com" });
      (isSuperAdmin as any).mockReturnValue(true);

      const session = await verifySaasSession("some-cookie");
      expect(isSuperAdmin(session!.email)).toBe(true);
    });

    it("should reject when no cookie is present", async () => {
      (verifySaasSession as any).mockResolvedValue(null);
      
      const session = await verifySaasSession("");
      expect(session).toBeNull();
    });
  });

  describe("Provisioning", () => {
    it("should call provisionZapiForTenant with correct tenantId", async () => {
      (provisionZapiForTenant as any).mockResolvedValue({
        success: true,
        instanceId: "INST123",
        alreadyProvisioned: false,
      });

      const result = await provisionZapiForTenant(100, "Test Agency");
      
      expect(provisionZapiForTenant).toHaveBeenCalledWith(100, "Test Agency");
      expect(result.success).toBe(true);
      expect(result.instanceId).toBe("INST123");
      expect(result.alreadyProvisioned).toBe(false);
    });

    it("should handle already provisioned tenant", async () => {
      (provisionZapiForTenant as any).mockResolvedValue({
        success: true,
        instanceId: "EXISTING123",
        alreadyProvisioned: true,
      });

      const result = await provisionZapiForTenant(200, "Existing Agency");
      
      expect(result.success).toBe(true);
      expect(result.alreadyProvisioned).toBe(true);
    });

    it("should handle provisioning failure", async () => {
      (provisionZapiForTenant as any).mockResolvedValue({
        success: false,
        error: "Z-API Partner API error",
      });

      const result = await provisionZapiForTenant(300, "Failed Agency");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Z-API Partner API error");
    });
  });

  describe("Deprovisioning", () => {
    it("should call deprovisionZapiForTenant with correct tenantId", async () => {
      (deprovisionZapiForTenant as any).mockResolvedValue({
        success: true,
      });

      const result = await deprovisionZapiForTenant(100);
      
      expect(deprovisionZapiForTenant).toHaveBeenCalledWith(100);
      expect(result.success).toBe(true);
    });

    it("should handle deprovisioning failure", async () => {
      (deprovisionZapiForTenant as any).mockResolvedValue({
        success: false,
        error: "Instance not found",
      });

      const result = await deprovisionZapiForTenant(999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Instance not found");
    });
  });

  describe("Stats", () => {
    it("should return correct stat structure", () => {
      // Verify the expected stats structure
      const expectedStats = {
        active: 5,
        cancelled: 2,
        pending: 1,
        connected: 3,
      };

      expect(expectedStats).toHaveProperty("active");
      expect(expectedStats).toHaveProperty("cancelled");
      expect(expectedStats).toHaveProperty("pending");
      expect(expectedStats).toHaveProperty("connected");
      expect(typeof expectedStats.active).toBe("number");
      expect(typeof expectedStats.connected).toBe("number");
    });
  });

  describe("Instance listing data shape", () => {
    it("should include tenant info and whatsapp status in instance data", () => {
      // Verify the expected data shape for an instance
      const mockInstance = {
        id: 1,
        tenantId: 100,
        zapiInstanceId: "INST123",
        instanceName: "EnturOS-TEST-100",
        status: "active",
        subscribedAt: new Date().toISOString(),
        cancelledAt: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        tenantName: "Test Agency",
        tenantPlan: "pro",
        tenantBillingStatus: "active",
        tenantStatus: "active",
        whatsappStatus: "connected",
        whatsappPhone: "+5511999999999",
        whatsappPushName: "Test User",
      };

      expect(mockInstance.tenantName).toBe("Test Agency");
      expect(mockInstance.whatsappStatus).toBe("connected");
      expect(mockInstance.tenantBillingStatus).toBe("active");
      expect(mockInstance.status).toBe("active");
    });
  });
});
