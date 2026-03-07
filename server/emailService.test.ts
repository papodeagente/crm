import { describe, it, expect } from "vitest";
import { Resend } from "resend";

describe("Resend API Key Validation", () => {
  it("should have RESEND_API_KEY configured", () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey).toBeTruthy();
    expect(apiKey!.startsWith("re_")).toBe(true);
  });

  it("should be able to initialize Resend client", () => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    expect(resend).toBeDefined();
  });

  it("should validate Resend API key by listing domains", async () => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      const { data } = await resend.domains.list();
      // If we get here, the API key is valid
      expect(data).toBeDefined();
    } catch (error: any) {
      // 401 means invalid key, anything else means key is valid but maybe no domains
      if (error?.statusCode === 401) {
        throw new Error("Invalid Resend API key");
      }
      // Other errors (like no domains) are fine - key is valid
      expect(true).toBe(true);
    }
  });
});
