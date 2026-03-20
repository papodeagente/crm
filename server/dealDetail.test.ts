import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("DealDetail Page - Backend Endpoints", () => {
  // ─── Deal CRUD ───
  it("crm.deals.get procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.deals.get).toBe("function");
  });

  it("crm.deals.update procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.deals.update).toBe("function");
  });

  it("crm.deals.moveStage procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.deals.moveStage).toBe("function");
  });

  // ─── Deal Products (Budget Tab) ───
  it("crm.deals.products.list procedure exists", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.deals.products.list).toBe("function");
  });

  it("crm.deals.products.create procedure exists", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.deals.products.create).toBe("function");
  });

  it("crm.deals.products.update procedure exists", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.deals.products.update).toBe("function");
  });

  it("crm.deals.products.delete procedure exists", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.deals.products.delete).toBe("function");
  });

  // ─── Deal Participants ───
  it("crm.deals.participants.list procedure exists", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.deals.participants.list).toBe("function");
  });

  it("crm.deals.participants.add procedure exists", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.deals.participants.add).toBe("function");
  });

  it("crm.deals.participants.remove procedure exists", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.deals.participants.remove).toBe("function");
  });

  // ─── Deal History ───
  it("crm.deals.history.list procedure exists", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.deals.history.list).toBe("function");
  });

  // ─── Notes ───
  it("crm.notes.list procedure exists", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.notes.list).toBe("function");
  });

  it("crm.notes.create procedure exists", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.notes.create).toBe("function");
  });

  // ─── WhatsApp Integration (WhatsApp Tab) ───
  it("whatsapp.sessions procedure exists for WhatsApp tab", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.whatsapp.sessions).toBe("function");
  });

  it("whatsapp.messagesByContact procedure exists for chat history", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.whatsapp.messagesByContact).toBe("function");
  });

  it("whatsapp.sendMessage procedure exists for sending messages", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.whatsapp.sendMessage).toBe("function");
  });

  // ─── WhatsApp messagesByContact returns empty for unknown contact ───
  it("whatsapp.messagesByContact returns empty array for unknown contact", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whatsapp.messagesByContact({
      sessionId: "test-session",
      remoteJid: "5511999999999@s.whatsapp.net",
      limit: 50,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  // ─── Contacts & Accounts (for association) ───
  it("crm.contacts.get procedure exists for contact details", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.contacts.get).toBe("function");
  });

  it("crm.accounts.get procedure exists for account details", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.accounts.get).toBe("function");
  });

  // ─── Pipeline Stages (for stage display) ───
  it("crm.pipelines.stages procedure exists for stage info", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.crm.pipelines.stages).toBe("function");
  });
});
