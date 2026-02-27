import { describe, it, expect } from "vitest";
import {
  normalizeBrazilianPhone,
  normalizeJid,
  phoneToJid,
  jidToPhone,
  formatPhoneDisplay,
  isSamePhone,
  getAllJidVariants,
} from "./phoneUtils";

describe("phoneUtils", () => {
  describe("normalizeBrazilianPhone", () => {
    it("normalizes 13-digit number with 9th digit (already correct)", () => {
      expect(normalizeBrazilianPhone("5584999838420")).toBe("5584999838420");
    });

    it("adds 9th digit to 12-digit number (missing 9)", () => {
      expect(normalizeBrazilianPhone("558499838420")).toBe("5584999838420");
    });

    it("handles number with + prefix", () => {
      expect(normalizeBrazilianPhone("+5584999838420")).toBe("5584999838420");
    });

    it("handles number with spaces and dashes", () => {
      expect(normalizeBrazilianPhone("+55 (84) 99983-8420")).toBe("5584999838420");
    });

    it("adds country code 55 to 11-digit number", () => {
      expect(normalizeBrazilianPhone("84999838420")).toBe("5584999838420");
    });

    it("adds country code 55 and 9th digit to 10-digit number", () => {
      expect(normalizeBrazilianPhone("8499838420")).toBe("5584999838420");
    });

    it("handles number with leading 0", () => {
      expect(normalizeBrazilianPhone("08499838420")).toBe("5584999838420");
    });

    it("handles empty string", () => {
      expect(normalizeBrazilianPhone("")).toBe("");
    });

    it("handles different DDD codes", () => {
      expect(normalizeBrazilianPhone("5511987654321")).toBe("5511987654321");
      expect(normalizeBrazilianPhone("551187654321")).toBe("5511987654321");
    });
  });

  describe("normalizeJid", () => {
    it("normalizes individual JID with 12 digits (adds 9th digit)", () => {
      expect(normalizeJid("558499838420@s.whatsapp.net")).toBe("5584999838420@s.whatsapp.net");
    });

    it("keeps correct 13-digit JID unchanged", () => {
      expect(normalizeJid("5584999838420@s.whatsapp.net")).toBe("5584999838420@s.whatsapp.net");
    });

    it("does not touch group JIDs", () => {
      expect(normalizeJid("120363123456789@g.us")).toBe("120363123456789@g.us");
    });

    it("does not touch status broadcast", () => {
      expect(normalizeJid("status@broadcast")).toBe("status@broadcast");
    });

    it("handles raw phone number without @", () => {
      expect(normalizeJid("558499838420")).toBe("5584999838420@s.whatsapp.net");
    });
  });

  describe("phoneToJid", () => {
    it("converts phone to normalized JID", () => {
      expect(phoneToJid("+5584999838420")).toBe("5584999838420@s.whatsapp.net");
    });

    it("converts phone without 9th digit to normalized JID", () => {
      expect(phoneToJid("+558499838420")).toBe("5584999838420@s.whatsapp.net");
    });

    it("converts phone without country code", () => {
      expect(phoneToJid("84999838420")).toBe("5584999838420@s.whatsapp.net");
    });
  });

  describe("jidToPhone", () => {
    it("converts JID to formatted phone", () => {
      expect(jidToPhone("5584999838420@s.whatsapp.net")).toBe("+5584999838420");
    });

    it("normalizes JID without 9th digit", () => {
      expect(jidToPhone("558499838420@s.whatsapp.net")).toBe("+5584999838420");
    });
  });

  describe("formatPhoneDisplay", () => {
    it("formats phone for display", () => {
      expect(formatPhoneDisplay("+5584999838420")).toBe("+55 (84) 99983-8420");
    });

    it("formats phone without 9th digit for display", () => {
      expect(formatPhoneDisplay("558499838420")).toBe("+55 (84) 99983-8420");
    });
  });

  describe("isSamePhone", () => {
    it("recognizes same number with and without 9th digit", () => {
      expect(isSamePhone("5584999838420@s.whatsapp.net", "558499838420@s.whatsapp.net")).toBe(true);
    });

    it("recognizes same number in different formats", () => {
      expect(isSamePhone("+5584999838420", "84999838420")).toBe(true);
    });

    it("rejects different numbers", () => {
      expect(isSamePhone("5584999838420", "5584999838421")).toBe(false);
    });
  });

  describe("getAllJidVariants", () => {
    it("returns both variants for 13-digit number", () => {
      const variants = getAllJidVariants("+5584999838420");
      expect(variants).toContain("5584999838420@s.whatsapp.net");
      expect(variants).toContain("558499838420@s.whatsapp.net");
      expect(variants.length).toBe(2);
    });

    it("returns both variants for 12-digit number", () => {
      const variants = getAllJidVariants("558499838420");
      expect(variants).toContain("5584999838420@s.whatsapp.net");
      expect(variants).toContain("558499838420@s.whatsapp.net");
      expect(variants.length).toBe(2);
    });

    it("returns both variants for JID format", () => {
      const variants = getAllJidVariants("558499838420@s.whatsapp.net");
      expect(variants).toContain("5584999838420@s.whatsapp.net");
      expect(variants).toContain("558499838420@s.whatsapp.net");
    });
  });
});
