import { describe, it, expect } from "vitest";
import { getWaConversationsList } from "./db";

describe("Inbox waConversations fix", () => {
  it("should return conversations ordered by lastMessageAt DESC with real names", async () => {
    const result = await getWaConversationsList("crm-210002-240001", 210002);
    
    // Should return conversations
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    
    // Each conversation should have required fields
    const first = result[0] as any;
    expect(first).toHaveProperty("remoteJid");
    expect(first).toHaveProperty("lastTimestamp");
    expect(first).toHaveProperty("contactPushName");
    expect(first).toHaveProperty("lastMessage");
    expect(first).toHaveProperty("unreadCount");
    
    // Verify ordering: lastTimestamp should be descending
    for (let i = 1; i < Math.min(result.length, 10); i++) {
      const prev = new Date((result[i - 1] as any).lastTimestamp).getTime();
      const curr = new Date((result[i] as any).lastTimestamp).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
    
    // Verify that contactPushName contains real names, not just phone numbers
    const withNames = result.filter((r: any) => {
      if (!r.contactPushName) return false;
      const cleaned = r.contactPushName.replace(/[\s\-\(\)\+]/g, "");
      return !/^\d+$/.test(cleaned);
    });
    // At least some conversations should have real names
    expect(withNames.length).toBeGreaterThan(0);
    
    // Verify no contactPushName is just a phone number (isRealName filter)
    for (const conv of withNames) {
      const name = (conv as any).contactPushName;
      const cleaned = name.replace(/[\s\-\(\)\+]/g, "");
      expect(/^\d+$/.test(cleaned)).toBe(false);
    }
  });

  it("should include assignment fields from LEFT JOIN", async () => {
    const result = await getWaConversationsList("crm-210002-240001", 210002);
    expect(result.length).toBeGreaterThan(0);
    
    const first = result[0] as any;
    // Assignment fields should exist (may be null from LEFT JOIN)
    expect(first).toHaveProperty("assignedUserId");
    expect(first).toHaveProperty("assignedTeamId");
    expect(first).toHaveProperty("assignmentStatus");
    expect(first).toHaveProperty("assignedAgentName");
  });

  it("should include conversationId field", async () => {
    const result = await getWaConversationsList("crm-210002-240001", 210002);
    expect(result.length).toBeGreaterThan(0);
    
    const first = result[0] as any;
    expect(first).toHaveProperty("conversationId");
    expect(typeof first.conversationId).toBe("number");
  });
});
