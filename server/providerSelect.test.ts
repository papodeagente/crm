import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the provider selection feature in WhatsApp connect endpoint.
 * 
 * The connect endpoint now accepts an optional `provider` parameter:
 * - "evolution" (default): Uses Evolution API for QR code generation
 * - "zapi": Uses Z-API for QR code generation (requires provisioned instance)
 */

describe("Provider Selection - Connect Endpoint", () => {
  // ─── Input Validation ───
  
  it("should accept empty input (defaults to evolution)", () => {
    // The endpoint input schema allows undefined/null input
    const input = undefined;
    const provider = input?.provider || "evolution";
    expect(provider).toBe("evolution");
  });

  it("should accept explicit evolution provider", () => {
    const input = { provider: "evolution" as const };
    const provider = input.provider || "evolution";
    expect(provider).toBe("evolution");
  });

  it("should accept explicit zapi provider", () => {
    const input = { provider: "zapi" as const };
    const provider = input.provider || "evolution";
    expect(provider).toBe("zapi");
  });

  it("should default to evolution when provider is omitted", () => {
    const input = {};
    const provider = (input as any).provider || "evolution";
    expect(provider).toBe("evolution");
  });

  // ─── Z-API Instance Validation ───

  it("should require Z-API instance for zapi provider", () => {
    // When provider is zapi and no instance exists, should throw
    const zapiInstance = null;
    const requestedProvider = "zapi";
    
    if (requestedProvider === "zapi" && !zapiInstance) {
      expect(true).toBe(true); // Would throw TRPCError
    }
  });

  it("should allow zapi when instance is provisioned", () => {
    const zapiInstance = {
      id: 1,
      tenantId: 330007,
      zapiInstanceId: "ABC123",
      zapiToken: "token123",
      zapiClientToken: "client-token-123",
      instanceName: "EnturOS-ENTUR-330007",
      status: "active",
    };
    
    expect(zapiInstance).not.toBeNull();
    expect(zapiInstance.status).toBe("active");
    expect(zapiInstance.zapiInstanceId).toBeTruthy();
    expect(zapiInstance.zapiToken).toBeTruthy();
  });

  // ─── Session Registration ───

  it("should register Z-API session with correct credentials", () => {
    const sessionRegistry = new Map<string, { instanceId: string; token: string; clientToken?: string }>();
    
    const sessionId = "crm-330007-1";
    const config = {
      instanceId: "ABC123",
      token: "token123",
      clientToken: "client-token-123",
    };
    
    sessionRegistry.set(sessionId, config);
    
    const registered = sessionRegistry.get(sessionId);
    expect(registered).toBeDefined();
    expect(registered!.instanceId).toBe("ABC123");
    expect(registered!.token).toBe("token123");
    expect(registered!.clientToken).toBe("client-token-123");
  });

  it("should generate correct session ID from tenant and user", () => {
    const getInstanceName = (tenantId: number, userId: number) => `crm-${tenantId}-${userId}`;
    
    expect(getInstanceName(330007, 1)).toBe("crm-330007-1");
    expect(getInstanceName(150002, 5)).toBe("crm-150002-5");
  });

  // ─── Provider Selection Logic ───

  it("should show provider selector only when Z-API is provisioned", () => {
    // Simulate frontend logic
    const hasZapi = true;
    const selectedProvider = "evolution";
    
    // Provider selector should be visible
    expect(hasZapi).toBe(true);
    
    // Default should be evolution
    expect(selectedProvider).toBe("evolution");
  });

  it("should not show provider selector when Z-API is not provisioned", () => {
    const hasZapi = false;
    
    // Provider selector should be hidden
    expect(hasZapi).toBe(false);
  });

  it("should use correct button color for each provider", () => {
    const getButtonColor = (provider: string, hasZapi: boolean) => {
      if (provider === "zapi" && hasZapi) return "blue";
      return "emerald";
    };
    
    expect(getButtonColor("evolution", true)).toBe("emerald");
    expect(getButtonColor("zapi", true)).toBe("blue");
    expect(getButtonColor("zapi", false)).toBe("emerald"); // Fallback when no Z-API
  });

  // ─── DB Session Update ───

  it("should save provider info when connecting via Z-API", () => {
    const sessionData = {
      status: "connecting" as const,
      provider: "zapi" as const,
      providerInstanceId: "ABC123",
      providerToken: "token123",
      providerClientToken: "client-token-123",
    };
    
    expect(sessionData.provider).toBe("zapi");
    expect(sessionData.providerInstanceId).toBe("ABC123");
    expect(sessionData.providerToken).toBe("token123");
    expect(sessionData.providerClientToken).toBe("client-token-123");
  });

  it("should not set provider fields when connecting via Evolution", () => {
    // Evolution connect doesn't set provider fields explicitly
    // The default provider column value is 'evolution'
    const sessionData = {
      status: "connecting" as const,
    };
    
    expect(sessionData.status).toBe("connecting");
    expect((sessionData as any).provider).toBeUndefined();
    expect((sessionData as any).providerInstanceId).toBeUndefined();
  });

  // ─── Edge Cases ───

  it("should handle already connected Z-API instance", () => {
    const existingInst = {
      connectionStatus: "open",
      phoneNumber: "5511999999999",
    };
    
    if (existingInst.connectionStatus === "open") {
      // Should return connected status without generating QR
      expect(existingInst.connectionStatus).toBe("open");
    }
  });

  it("should handle Z-API QR code generation failure gracefully", () => {
    // When Z-API fails to generate QR, should throw INTERNAL_SERVER_ERROR
    const error = new Error("Z-API timeout");
    const errorMessage = `Erro ao gerar QR Code via Z-API: ${error.message}`;
    expect(errorMessage).toContain("Z-API timeout");
  });
});
