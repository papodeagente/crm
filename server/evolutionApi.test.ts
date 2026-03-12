import { describe, it, expect } from "vitest";

describe("Evolution API Credentials", () => {
  it("should have EVOLUTION_API_URL configured", () => {
    const url = process.env.EVOLUTION_API_URL;
    expect(url).toBeDefined();
    expect(url).toContain("https://");
  });

  it("should have EVOLUTION_API_KEY configured", () => {
    const key = process.env.EVOLUTION_API_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(10);
  });

  it("should connect to Evolution API server", async () => {
    const url = process.env.EVOLUTION_API_URL;
    const key = process.env.EVOLUTION_API_KEY;
    
    const response = await fetch(`${url}/`, {
      headers: { apikey: key! },
    });
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.status).toBe(200);
    expect(data.message).toContain("Evolution API");
    expect(data.version).toBeDefined();
  });

  it("should be able to list instances", async () => {
    const url = process.env.EVOLUTION_API_URL;
    const key = process.env.EVOLUTION_API_KEY;
    
    const response = await fetch(`${url}/instance/fetchInstances`, {
      headers: { apikey: key! },
    });
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("Evolution API Module Exports", () => {
  it("should export all required functions from evolutionApi", async () => {
    const mod = await import("./evolutionApi");
    expect(typeof mod.createInstance).toBe("function");
    expect(typeof mod.deleteInstance).toBe("function");
    expect(typeof mod.getConnectionState).toBe("function");
    expect(typeof mod.connectInstance).toBe("function");
    expect(typeof mod.logoutInstance).toBe("function");
    expect(typeof mod.sendText).toBe("function");
    expect(typeof mod.sendMedia).toBe("function");
    expect(typeof mod.fetchAllInstances).toBe("function");
    expect(typeof mod.getProfilePicture).toBe("function");
    expect(typeof mod.healthCheck).toBe("function");
    expect(typeof mod.getInstanceName).toBe("function");
  });
});

describe("WhatsApp Evolution Manager", () => {
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
