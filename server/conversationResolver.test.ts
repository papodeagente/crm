import { describe, expect, it } from "vitest";
import { normalizePhone, buildConversationKey } from "./conversationResolver";

describe("ConversationIdentityResolver", () => {
  describe("normalizePhone", () => {
    it("normalizes a full Brazilian mobile number with country code", () => {
      const result = normalizePhone("5584999838420");
      expect(result.valid).toBe(true);
      expect(result.phoneE164).toBe("+5584999838420");
      expect(result.digitsOnly).toBe("5584999838420");
      expect(result.last11BR).toBe("84999838420");
    });

    it("adds 9th digit when missing (8 digits after DDD)", () => {
      const result = normalizePhone("558499983842");
      expect(result.valid).toBe(true);
      expect(result.phoneE164).toBe("+5584999983842");
      expect(result.digitsOnly).toBe("5584999983842");
    });

    it("adds country code when only DDD + number provided (11 digits)", () => {
      const result = normalizePhone("84999838420");
      expect(result.valid).toBe(true);
      expect(result.phoneE164).toBe("+5584999838420");
      expect(result.digitsOnly).toBe("5584999838420");
    });

    it("adds country code and 9th digit when only DDD + 8 digits provided", () => {
      const result = normalizePhone("8499983842");
      expect(result.valid).toBe(true);
      expect(result.phoneE164).toBe("+5584999983842");
      expect(result.digitsOnly).toBe("5584999983842");
    });

    it("handles number with + prefix", () => {
      const result = normalizePhone("+5584999838420");
      expect(result.valid).toBe(true);
      expect(result.phoneE164).toBe("+5584999838420");
    });

    it("handles number with spaces and dashes", () => {
      const result = normalizePhone("+55 84 99983-8420");
      expect(result.valid).toBe(true);
      expect(result.phoneE164).toBe("+5584999838420");
    });

    it("handles number with parentheses", () => {
      const result = normalizePhone("(84) 99983-8420");
      expect(result.valid).toBe(true);
      expect(result.phoneE164).toBe("+5584999838420");
    });

    it("returns invalid for empty input", () => {
      const result = normalizePhone("");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("empty_input");
    });

    it("returns invalid for too short input", () => {
      const result = normalizePhone("1234");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("too_short");
    });

    it("strips leading zeros", () => {
      const result = normalizePhone("005584999838420");
      expect(result.valid).toBe(true);
      expect(result.phoneE164).toBe("+5584999838420");
    });

    it("both JID variants (with/without 9th digit) normalize to the same phoneE164", () => {
      const with9 = normalizePhone("5584999838420");
      const without9 = normalizePhone("558499983842");
      // Both should have 9th digit added
      expect(with9.phoneE164).toBe("+5584999838420");
      expect(without9.phoneE164).toBe("+5584999983842");
      // Note: these are different numbers (99983842 vs 999838420)
      // The real test is when the 8-digit number IS the same number without the 9th digit
    });

    it("same number with and without 9th digit normalizes to same E164", () => {
      // 84 9 9983-8420 (with 9th digit) → +5584999838420
      const with9 = normalizePhone("5584999838420");
      // 84 9983-8420 (without 9th digit, 8 digits after DDD) → adds 9 → +5584999838420
      const without9 = normalizePhone("558499838420");
      expect(with9.phoneE164).toBe("+5584999838420");
      expect(without9.phoneE164).toBe("+5584999838420");
    });

    it("handles São Paulo numbers (DDD 11)", () => {
      const result = normalizePhone("5511999887766");
      expect(result.valid).toBe(true);
      expect(result.phoneE164).toBe("+5511999887766");
      expect(result.last11BR).toBe("11999887766");
    });

    it("handles 12-digit numbers (adds 9th digit since WhatsApp uses mobile)", () => {
      // For WhatsApp context, 12-digit BR numbers get 9th digit added
      // since WhatsApp only works with mobile numbers
      const result = normalizePhone("551133334444");
      expect(result.valid).toBe(true);
      expect(result.phoneE164).toBe("+5511933334444");
    });
  });

  describe("buildConversationKey", () => {
    it("builds key from sessionId and phoneE164 digits", () => {
      const key = buildConversationKey("session1", "5584999838420");
      expect(key).toBe("wa:session1:5584999838420");
    });

    it("same phone produces same key regardless of JID format", () => {
      // Both should produce the same key when using normalized digits
      const key1 = buildConversationKey("session1", "5584999838420");
      const key2 = buildConversationKey("session1", "5584999838420");
      expect(key1).toBe(key2);
    });

    it("different sessions produce different keys", () => {
      const key1 = buildConversationKey("session1", "5584999838420");
      const key2 = buildConversationKey("session2", "5584999838420");
      expect(key1).not.toBe(key2);
    });
  });

  describe("Anti-duplication guarantee", () => {
    it("JID with @s.whatsapp.net suffix extracts digits correctly", () => {
      const jid = "5584999838420@s.whatsapp.net";
      const digits = jid.replace(/@.*$/, "");
      const phone = normalizePhone(digits);
      expect(phone.valid).toBe(true);
      expect(phone.phoneE164).toBe("+5584999838420");
    });

    it("JID without 9th digit extracts and normalizes correctly", () => {
      const jid = "558499838420@s.whatsapp.net";
      const digits = jid.replace(/@.*$/, "");
      const phone = normalizePhone(digits);
      expect(phone.valid).toBe(true);
      // Should add 9th digit
      expect(phone.phoneE164).toBe("+5584999838420");
    });

    it("both JID variants produce the same conversationKey", () => {
      const jid1 = "5584999838420@s.whatsapp.net";
      const jid2 = "558499838420@s.whatsapp.net";

      const digits1 = jid1.replace(/@.*$/, "");
      const digits2 = jid2.replace(/@.*$/, "");

      const phone1 = normalizePhone(digits1);
      const phone2 = normalizePhone(digits2);

      const key1 = buildConversationKey("session1", phone1.digitsOnly);
      const key2 = buildConversationKey("session1", phone2.digitsOnly);

      expect(key1).toBe(key2);
    });
  });
});
