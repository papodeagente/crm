import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Inbox Performance Tests
 * 
 * Validates that the inbox query uses ONLY wa_conversations table
 * (no JOIN with wa_messages) and that the write path updates
 * pre-computed fields atomically.
 */

// Mock the database module
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
  };
});

describe("Inbox Query Optimization", () => {
  it("getWaConversationsList should NOT contain JOIN with wa_messages", async () => {
    // Read the db.ts source to verify no JOIN with wa_messages in the inbox query
    const fs = await import("fs");
    const dbSource = fs.readFileSync("./server/db.ts", "utf-8");
    
    // Find the getWaConversationsList function body
    const fnStart = dbSource.indexOf("export async function getWaConversationsList");
    expect(fnStart).toBeGreaterThan(-1);
    
    // Get the function body (up to the next export)
    const afterFn = dbSource.slice(fnStart);
    const nextExport = afterFn.indexOf("\nexport ", 10);
    const fnBody = nextExport > 0 ? afterFn.slice(0, nextExport) : afterFn.slice(0, 3000);
    
    // Verify NO JOIN with wa_messages
    expect(fnBody).not.toMatch(/JOIN\s+wa_messages/i);
    expect(fnBody).not.toMatch(/FROM\s+wa_messages/i);
    expect(fnBody).not.toMatch(/GROUP\s+BY.*wa_messages/i);
    
    // Verify it queries wa_conversations directly
    expect(fnBody).toMatch(/wa_conversations/);
    
    // Verify it uses pre-computed fields
    expect(fnBody).toMatch(/lastMessagePreview/);
    expect(fnBody).toMatch(/lastMessageAt/);
    expect(fnBody).toMatch(/lastFromMe/);
    expect(fnBody).toMatch(/unreadCount/);
  });

  it("getWaConversationsList should use assignment filters on wa_conversations (not conversation_assignments)", async () => {
    const fs = await import("fs");
    const dbSource = fs.readFileSync("./server/db.ts", "utf-8");
    
    const fnStart = dbSource.indexOf("export async function getWaConversationsList");
    const afterFn = dbSource.slice(fnStart);
    const nextExport = afterFn.indexOf("\nexport ", 10);
    const fnBody = nextExport > 0 ? afterFn.slice(0, nextExport) : afterFn.slice(0, 3000);
    
    // Should filter on wc.assignedUserId, NOT ca.assignedUserId
    expect(fnBody).toMatch(/wc\.assignedUserId/);
    // Should NOT reference conversation_assignments table alias
    expect(fnBody).not.toMatch(/ca\.assignedUserId/);
  });

  it("getWaConversationsList should ORDER BY lastMessageAt DESC", async () => {
    const fs = await import("fs");
    const dbSource = fs.readFileSync("./server/db.ts", "utf-8");
    
    const fnStart = dbSource.indexOf("export async function getWaConversationsList");
    const afterFn = dbSource.slice(fnStart);
    const nextExport = afterFn.indexOf("\nexport ", 10);
    const fnBody = nextExport > 0 ? afterFn.slice(0, nextExport) : afterFn.slice(0, 3000);
    
    // Should order by lastMessageAt DESC
    expect(fnBody).toMatch(/ORDER BY.*lastMessageAt\s+DESC/i);
  });
});

describe("updateConversationLastMessage atomicity", () => {
  it("should update all pre-computed fields in a single UPDATE", async () => {
    const fs = await import("fs");
    const resolverSource = fs.readFileSync("./server/conversationResolver.ts", "utf-8");
    
    const fnStart = resolverSource.indexOf("function updateConversationLastMessage");
    expect(fnStart).toBeGreaterThan(-1);
    
    const afterFn = resolverSource.slice(fnStart);
    const nextFn = afterFn.indexOf("\nexport ", 10);
    const fnBody = nextFn > 0 ? afterFn.slice(0, nextFn) : afterFn.slice(0, 1500);
    
    // Should update all pre-computed fields
    expect(fnBody).toMatch(/lastMessageAt/);
    expect(fnBody).toMatch(/lastMessagePreview/);
    expect(fnBody).toMatch(/lastMessageType/);
    expect(fnBody).toMatch(/lastFromMe/);
    expect(fnBody).toMatch(/lastStatus/);
    expect(fnBody).toMatch(/unreadCount/);
    
    // Should use conditional update (only if newer)
    expect(fnBody).toMatch(/lastMessageAt\s*(IS NULL|<=)/i);
  });
});

describe("Frontend polling optimization", () => {
  it("Inbox.tsx should disable background sync when socket is connected", async () => {
    const fs = await import("fs");
    const inboxSource = fs.readFileSync("./client/src/pages/Inbox.tsx", "utf-8");
    
    // Should reference socketConnected to conditionally enable polling
    expect(inboxSource).toMatch(/socketConnected/);
    
    // Background sync should be conditional on socket state
    expect(inboxSource).toMatch(/!socketConnected/);
  });

  it("WhatsAppChat.tsx should disable refetchInterval when socket is connected", async () => {
    const fs = await import("fs");
    const chatSource = fs.readFileSync("./client/src/components/WhatsAppChat.tsx", "utf-8");
    
    // Should use socketConnected to conditionally set refetchInterval
    expect(chatSource).toMatch(/socketConnected\s*\?\s*false\s*:\s*30000/);
    
    // Should have optimistic cache update via setData instead of refetch
    expect(chatSource).toMatch(/utils\.whatsapp\.messagesByContact\.setData/);
  });

  it("WhatsAppChat.tsx should NOT call messagesQ.refetch() on socket message", async () => {
    const fs = await import("fs");
    const chatSource = fs.readFileSync("./client/src/components/WhatsAppChat.tsx", "utf-8");
    
    // Find the socket message handler
    const socketHandler = chatSource.indexOf("Socket message → optimistic cache update");
    expect(socketHandler).toBeGreaterThan(-1);
    
    // The handler should NOT contain messagesQ.refetch()
    const handlerBlock = chatSource.slice(socketHandler, socketHandler + 1000);
    expect(handlerBlock).not.toMatch(/messagesQ\.refetch\(\)/);
    expect(handlerBlock).toMatch(/setData/);
  });
});

describe("Database index verification", () => {
  it("wa_conversations should have composite index on (tenantId, sessionId, lastMessageAt)", async () => {
    const fs = await import("fs");
    const schemaSource = fs.readFileSync("./drizzle/schema.ts", "utf-8");
    
    // Should have the composite index for the inbox query
    expect(schemaSource).toMatch(/idx_wc_tenant_session.*tenantId.*sessionId.*lastMessageAt/s);
  });
});
