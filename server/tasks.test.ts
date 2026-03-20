import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const TENANT_ID = 1;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
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

describe("crm.tasks", () => {
  describe("crm.tasks.list", () => {
    it("returns tasks with pagination structure (tasks array + total)", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.crm.tasks.list({
        tenantId: TENANT_ID,
        limit: 10,
        offset: 0,
      });

      expect(result).toHaveProperty("tasks");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.tasks)).toBe(true);
      expect(typeof result.total).toBe("number");
    });

    it("filters by taskType correctly", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.crm.tasks.list({
        tenantId: TENANT_ID,
        taskType: "whatsapp",
        limit: 10,
        offset: 0,
      });

      expect(result).toHaveProperty("tasks");
      expect(result).toHaveProperty("total");
      for (const task of result.tasks) {
        expect(task.taskType).toBe("whatsapp");
      }
    });

    it("filters by status done correctly", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.crm.tasks.list({
        tenantId: TENANT_ID,
        status: "done",
        limit: 10,
        offset: 0,
      });

      expect(result).toHaveProperty("tasks");
      for (const task of result.tasks) {
        expect(task.status).toBe("done");
      }
    });

    it("filters by status pending correctly", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.crm.tasks.list({
        tenantId: TENANT_ID,
        status: "pending",
        limit: 10,
        offset: 0,
      });

      expect(result).toHaveProperty("tasks");
      for (const task of result.tasks) {
        expect(task.status).toBe("pending");
      }
    });

    it("respects limit and offset for pagination", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const page1 = await caller.crm.tasks.list({
        tenantId: TENANT_ID,
        limit: 5,
        offset: 0,
      });

      const page2 = await caller.crm.tasks.list({
        tenantId: TENANT_ID,
        limit: 5,
        offset: 5,
      });

      expect(page1.tasks.length).toBeLessThanOrEqual(5);
      expect(page2.tasks.length).toBeLessThanOrEqual(5);
      if (page1.tasks.length > 0 && page2.tasks.length > 0) {
        expect(page1.tasks[0].id).not.toBe(page2.tasks[0].id);
      }
    });

    it("sorts by dueDate ascending", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.crm.tasks.list({
        tenantId: TENANT_ID,
        sortBy: "dueDate",
        sortOrder: "asc",
        limit: 10,
        offset: 0,
      });

      expect(result).toHaveProperty("tasks");
      for (let i = 1; i < result.tasks.length; i++) {
        const prev = result.tasks[i - 1].dueDate;
        const curr = result.tasks[i].dueDate;
        if (prev && curr) {
          expect(new Date(prev).getTime()).toBeLessThanOrEqual(new Date(curr).getTime());
        }
      }
    });
  });

  describe("crm.tasks.create", () => {
    it("creates a task with required fields", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.crm.tasks.create({
        tenantId: TENANT_ID,
        entityType: "deal",
        entityId: 1,
        title: "Test Task from Vitest",
        taskType: "task",
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      });

      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    });

    it("creates a task with whatsapp type", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.crm.tasks.create({
        tenantId: TENANT_ID,
        entityType: "deal",
        entityId: 1,
        title: "WhatsApp task test",
        taskType: "whatsapp",
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      });

      expect(result).toHaveProperty("id");
    });
  });

  describe("crm.tasks.update", () => {
    it("updates a task title", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // First create a task
      const created = await caller.crm.tasks.create({
        tenantId: TENANT_ID,
        entityType: "deal",
        entityId: 1,
        title: "Original Title",
        taskType: "task",
      });

      // Then update it
      const result = await caller.crm.tasks.update({
        tenantId: TENANT_ID,
        id: created.id,
        title: "Updated Title",
        taskType: "email",
      });

      expect(result).toHaveProperty("success");
      expect(result.success).toBe(true);
    });
  });

  describe("crm.tasks.update status", () => {
    it("marks task as done via update", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create a task
      const created = await caller.crm.tasks.create({
        tenantId: TENANT_ID,
        entityType: "deal",
        entityId: 1,
        title: "Task to mark done",
        taskType: "task",
      });

      // Mark as done via update
      const result = await caller.crm.tasks.update({
        tenantId: TENANT_ID,
        id: created.id,
        status: "done",
      });

      expect(result).toHaveProperty("success");
      expect(result.success).toBe(true);
    });
  });
});
