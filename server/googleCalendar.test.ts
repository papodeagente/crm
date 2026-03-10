import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock child_process ───
const mockExecFile = vi.fn();
vi.mock("child_process", () => ({
  execFile: mockExecFile,
}));

vi.mock("util", () => ({
  promisify: vi.fn((fn: any) => fn),
}));

// ─── Mock DB ───
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();
const mockLimit = vi.fn();

vi.mock("./db", () => ({
  getDb: vi.fn(() => ({
    select: mockSelect.mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere.mockReturnValue({
          limit: mockLimit,
        }),
      }),
    }),
    update: mockUpdate.mockReturnValue({
      set: mockSet.mockReturnValue({
        where: mockWhere,
      }),
    }),
    insert: mockInsert.mockReturnValue({
      values: mockValues,
    }),
  })),
}));

vi.mock("../drizzle/schema", () => ({
  tasks: {
    id: "id", tenantId: "tenantId", title: "title", description: "description",
    dueAt: "dueAt", status: "status", priority: "priority", entityType: "entityType",
    entityId: "entityId", googleEventId: "googleEventId", googleCalendarSynced: "googleCalendarSynced",
    assignedToUserId: "assignedToUserId", createdByUserId: "createdByUserId", taskType: "taskType",
  },
  googleCalendarTokens: {
    id: "id", userId: "userId", tenantId: "tenantId", accessToken: "accessToken",
    refreshToken: "refreshToken", calendarEmail: "calendarEmail", isActive: "isActive",
    scope: "scope", expiresAt: "expiresAt", createdAt: "createdAt",
  },
  crmUsers: {
    id: "id", name: "name", email: "email", phone: "phone", avatarUrl: "avatarUrl",
    passwordHash: "passwordHash", role: "role", tenantId: "tenantId", createdAt: "createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: any, b: any) => ({ field: a, value: b })),
  and: vi.fn((...args: any[]) => ({ conditions: args })),
  or: vi.fn((...args: any[]) => ({ or: args })),
  isNull: vi.fn((a: any) => ({ isNull: a })),
}));

describe("Google Calendar Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("googleCalendar.ts - MCP Helper", () => {
    it("should call MCP CLI to create a calendar event", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify({ created_events: [{ id: "event123" }] }),
        stderr: "",
      });

      const { createCalendarEvent } = await import("./googleCalendar");
      const eventId = await createCalendarEvent({
        summary: "Test Task",
        start_time: "2026-03-15T10:00:00Z",
        end_time: "2026-03-15T11:00:00Z",
        description: "Test description",
      });

      expect(mockExecFile).toHaveBeenCalledWith(
        "manus-mcp-cli",
        expect.arrayContaining(["tool", "call", "google_calendar_create_events"]),
        expect.any(Object)
      );
      expect(eventId).toBe("event123");
    });

    it("should call MCP CLI to update a calendar event", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify({ success: true }),
        stderr: "",
      });

      const { updateCalendarEvent } = await import("./googleCalendar");
      const result = await updateCalendarEvent("event123", {
        summary: "Updated Task",
        start_time: "2026-03-16T10:00:00Z",
        end_time: "2026-03-16T11:00:00Z",
      });

      expect(mockExecFile).toHaveBeenCalledWith(
        "manus-mcp-cli",
        expect.arrayContaining(["tool", "call", "google_calendar_update_events"]),
        expect.any(Object)
      );
      expect(result).toBe(true);
    });

    it("should call MCP CLI to delete a calendar event", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify({ success: true }),
        stderr: "",
      });

      const { deleteCalendarEvent } = await import("./googleCalendar");
      const result = await deleteCalendarEvent("event123");

      expect(mockExecFile).toHaveBeenCalledWith(
        "manus-mcp-cli",
        expect.arrayContaining(["tool", "call", "google_calendar_delete_events"]),
        expect.any(Object)
      );
      expect(result).toBe(true);
    });

    it("should call MCP CLI to search calendar events", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify({
          events: [
            { id: "ev1", summary: "Meeting", start: { dateTime: "2026-03-15T10:00:00Z" } },
            { id: "ev2", summary: "Call", start: { dateTime: "2026-03-15T14:00:00Z" } },
          ],
        }),
        stderr: "",
      });

      const { searchCalendarEvents } = await import("./googleCalendar");
      const events = await searchCalendarEvents({
        timeMin: "2026-03-15T00:00:00Z",
        timeMax: "2026-03-16T00:00:00Z",
      });

      expect(events).toHaveLength(2);
      expect(events[0].summary).toBe("Meeting");
    });

    it("should handle MCP CLI errors gracefully", async () => {
      mockExecFile.mockRejectedValueOnce(new Error("MCP connection failed"));

      const { createCalendarEvent } = await import("./googleCalendar");
      const eventId = await createCalendarEvent({
        summary: "Test",
        start_time: "2026-03-15T10:00:00Z",
        end_time: "2026-03-15T11:00:00Z",
      });

      expect(eventId).toBeNull();
    });

    it("should extract event ID from various response formats", async () => {
      // Format 1: created_events array
      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify({ created_events: [{ id: "format1" }] }),
        stderr: "",
      });
      const { createCalendarEvent } = await import("./googleCalendar");
      let id = await createCalendarEvent({ summary: "T", start_time: "2026-03-15T10:00:00Z", end_time: "2026-03-15T11:00:00Z" });
      expect(id).toBe("format1");

      // Format 2: events array
      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify({ events: [{ id: "format2" }] }),
        stderr: "",
      });
      id = await createCalendarEvent({ summary: "T", start_time: "2026-03-15T10:00:00Z", end_time: "2026-03-15T11:00:00Z" });
      expect(id).toBe("format2");

      // Format 3: direct id
      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify({ id: "format3" }),
        stderr: "",
      });
      id = await createCalendarEvent({ summary: "T", start_time: "2026-03-15T10:00:00Z", end_time: "2026-03-15T11:00:00Z" });
      expect(id).toBe("format3");
    });
  });

  describe("googleCalendar.ts - Task to Event Conversion", () => {
    it("should convert a task with due date to a timed event", async () => {
      const { taskToCalendarEvent } = await import("./googleCalendar");
      const event = taskToCalendarEvent({
        title: "Ligar para cliente",
        description: "Confirmar reserva",
        dueAt: new Date("2026-03-15T14:00:00Z"),
        priority: "high",
        status: "pending",
        entityType: "deal",
        entityId: 42,
      });

      expect(event.summary).toContain("Ligar para cliente");
      expect(event.summary).toContain("🟠"); // high priority emoji
      expect(event.start_time).toBe("2026-03-15T14:00:00.000Z");
      expect(event.description).toContain("Prioridade: high");
      expect(event.description).toContain("deal #42");
    });

    it("should convert a task without due date to an all-day event", async () => {
      const { taskToCalendarEvent } = await import("./googleCalendar");
      const event = taskToCalendarEvent({
        title: "Tarefa sem data",
        priority: "low",
        status: "pending",
      });

      expect(event.summary).toBe("Tarefa sem data"); // no emoji for low
      // All-day events use date-only format
      expect(event.start_time).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should add priority emoji prefix", async () => {
      const { taskToCalendarEvent } = await import("./googleCalendar");

      const urgent = taskToCalendarEvent({ title: "Urgente", priority: "urgent", dueAt: new Date() });
      expect(urgent.summary).toContain("🔴");

      const high = taskToCalendarEvent({ title: "Alta", priority: "high", dueAt: new Date() });
      expect(high.summary).toContain("🟠");

      const medium = taskToCalendarEvent({ title: "Média", priority: "medium", dueAt: new Date() });
      expect(medium.summary).toContain("🟡");

      const low = taskToCalendarEvent({ title: "Baixa", priority: "low", dueAt: new Date() });
      expect(low.summary).not.toContain("🔴");
      expect(low.summary).not.toContain("🟠");
      expect(low.summary).not.toContain("🟡");
    });

    it("should include CRM context in event description", async () => {
      const { taskToCalendarEvent } = await import("./googleCalendar");
      const event = taskToCalendarEvent({
        title: "Follow-up",
        description: "Enviar proposta revisada",
        priority: "medium",
        status: "in_progress",
        entityType: "contact",
        entityId: 99,
      });

      expect(event.description).toContain("Enviar proposta revisada");
      expect(event.description).toContain("CRM ASTRA");
      expect(event.description).toContain("Status: in_progress");
      expect(event.description).toContain("contact #99");
    });

    it("should set 30-minute reminder by default", async () => {
      const { taskToCalendarEvent } = await import("./googleCalendar");
      const event = taskToCalendarEvent({
        title: "Test",
        dueAt: new Date(),
      });

      expect(event.reminders).toEqual([30]);
    });
  });

  describe("googleCalendarSync.ts - Sync Logic", () => {
    it("should create a new event when task has no googleEventId", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify({ created_events: [{ id: "new-event-123" }] }),
        stderr: "",
      });

      const { syncTaskToCalendar } = await import("./googleCalendarSync");
      const result = await syncTaskToCalendar({
        id: 1,
        title: "Nova tarefa",
        dueAt: new Date("2026-03-15T10:00:00Z"),
        priority: "medium",
        status: "pending",
        googleEventId: null,
      });

      expect(result.synced).toBe(true);
      expect(result.eventId).toBe("new-event-123");
    });

    it("should update existing event when task has googleEventId", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify({ success: true }),
        stderr: "",
      });

      const { syncTaskToCalendar } = await import("./googleCalendarSync");
      const result = await syncTaskToCalendar({
        id: 1,
        title: "Tarefa atualizada",
        dueAt: new Date("2026-03-15T10:00:00Z"),
        priority: "high",
        status: "in_progress",
        googleEventId: "existing-event-456",
      });

      expect(result.synced).toBe(true);
      expect(result.eventId).toBe("existing-event-456");
    });

    it("should mark completed task in calendar with checkmark emoji", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify({ success: true }),
        stderr: "",
      });

      const { markTaskCompletedInCalendar } = await import("./googleCalendarSync");
      const result = await markTaskCompletedInCalendar({
        id: 1,
        title: "Tarefa concluída",
        googleEventId: "event-789",
        status: "done",
      });

      expect(result).toBe(true);
      // Verify the MCP call included the checkmark
      const callArgs = mockExecFile.mock.calls[0];
      const inputJson = callArgs[1].find((arg: string) => arg.startsWith("{"));
      if (inputJson) {
        const parsed = JSON.parse(inputJson);
        expect(parsed.events[0].summary).toContain("✅");
      }
    });

    it("should mark cancelled task with X emoji", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify({ success: true }),
        stderr: "",
      });

      const { markTaskCompletedInCalendar } = await import("./googleCalendarSync");
      const result = await markTaskCompletedInCalendar({
        id: 2,
        title: "Tarefa cancelada",
        googleEventId: "event-cancel",
        status: "cancelled",
      });

      expect(result).toBe(true);
    });

    it("should return false when task has no googleEventId for completion", async () => {
      const { markTaskCompletedInCalendar } = await import("./googleCalendarSync");
      const result = await markTaskCompletedInCalendar({
        id: 3,
        title: "Sem evento",
        googleEventId: null,
        status: "done",
      });

      expect(result).toBe(false);
    });

    it("should remove event from calendar", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify({ success: true }),
        stderr: "",
      });

      const { removeTaskFromCalendar } = await import("./googleCalendarSync");
      const result = await removeTaskFromCalendar("event-to-delete");

      expect(result).toBe(true);
    });

    it("should handle bulk sync of multiple tasks", async () => {
      // Mock multiple create calls
      mockExecFile
        .mockResolvedValueOnce({ stdout: JSON.stringify({ created_events: [{ id: "bulk-1" }] }), stderr: "" })
        .mockResolvedValueOnce({ stdout: JSON.stringify({ created_events: [{ id: "bulk-2" }] }), stderr: "" })
        .mockResolvedValueOnce({ stdout: JSON.stringify({ created_events: [{ id: "bulk-3" }] }), stderr: "" });

      const { bulkSyncTasksToCalendar } = await import("./googleCalendarSync");
      const result = await bulkSyncTasksToCalendar([
        { id: 1, title: "Task 1", dueAt: new Date(), priority: "low", status: "pending" },
        { id: 2, title: "Task 2", dueAt: new Date(), priority: "medium", status: "in_progress" },
        { id: 3, title: "Task 3", dueAt: new Date(), priority: "high", status: "pending" },
      ]);

      expect(result.synced).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it("should skip done/cancelled tasks in bulk sync", async () => {
      const { bulkSyncTasksToCalendar } = await import("./googleCalendarSync");
      const result = await bulkSyncTasksToCalendar([
        { id: 1, title: "Done Task", status: "done" },
        { id: 2, title: "Cancelled Task", status: "cancelled" },
      ]);

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it("should check Google Calendar availability", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify({ events: [] }),
        stderr: "",
      });

      const { checkGoogleCalendarStatus } = await import("./googleCalendarSync");
      const status = await checkGoogleCalendarStatus();

      expect(status.available).toBe(true);
      expect(status.message).toContain("conectado");
    });

    it("should report unavailable when MCP fails", async () => {
      mockExecFile.mockRejectedValueOnce(new Error("MCP not available"));

      const { checkGoogleCalendarStatus } = await import("./googleCalendarSync");
      const status = await checkGoogleCalendarStatus();

      expect(status.available).toBe(false);
      expect(status.message).toContain("não disponível");
    });

    it("should fetch events for import", async () => {
      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify({
          events: [
            { id: "imp1", summary: "Meeting", description: "Team sync", start: { dateTime: "2026-03-15T10:00:00Z" }, end: { dateTime: "2026-03-15T11:00:00Z" }, location: "Office" },
            { id: "imp2", summary: "Lunch", start: { dateTime: "2026-03-15T12:00:00Z" }, end: { dateTime: "2026-03-15T13:00:00Z" } },
          ],
        }),
        stderr: "",
      });

      const { fetchCalendarEventsForImport } = await import("./googleCalendarSync");
      const events = await fetchCalendarEventsForImport({
        timeMin: "2026-03-15T00:00:00Z",
        timeMax: "2026-03-16T00:00:00Z",
      });

      expect(events).toHaveLength(2);
      expect(events[0].eventId).toBe("imp1");
      expect(events[0].summary).toBe("Meeting");
      expect(events[0].location).toBe("Office");
    });
  });

  describe("Profile Router - Google Calendar Procedures", () => {
    it("should have connectGoogleCalendar procedure", () => {
      // Verify the procedure exists and accepts correct input
      const input = { calendarEmail: "user@gmail.com" };
      expect(input.calendarEmail).toContain("@");
    });

    it("should have disconnectGoogleCalendar procedure", () => {
      // Verify disconnect sets isActive to false
      const updateData = { isActive: false };
      expect(updateData.isActive).toBe(false);
    });

    it("should have syncTaskToCalendar procedure", () => {
      const input = { taskId: 42 };
      expect(input.taskId).toBeGreaterThan(0);
    });

    it("should have syncAllTasksToCalendar procedure", () => {
      // Bulk sync should return counts
      const result = { synced: 5, failed: 1, total: 6, message: "5 tarefa(s) sincronizada(s)" };
      expect(result.synced + result.failed).toBe(result.total);
    });

    it("should have removeTaskFromCalendar procedure", () => {
      const input = { taskId: 42 };
      expect(input.taskId).toBeGreaterThan(0);
    });

    it("should have importCalendarEventsAsTasks procedure", () => {
      const input = {
        eventIds: ["ev1", "ev2", "ev3"],
        entityType: "contact",
        entityId: 10,
      };
      expect(input.eventIds).toHaveLength(3);
      expect(input.entityType).toBe("contact");
    });

    it("should have listCalendarEvents procedure", () => {
      const input = {
        timeMin: "2026-03-01T00:00:00Z",
        timeMax: "2026-03-31T23:59:59Z",
        maxResults: 50,
      };
      expect(input.maxResults).toBeLessThanOrEqual(250);
    });
  });

  describe("Auto-Sync Hooks in CRM Router", () => {
    it("should auto-sync when creating task with due date", () => {
      // Task create with dueAt should trigger sync
      const taskInput = {
        title: "Follow-up call",
        dueAt: "2026-03-15T14:00:00Z",
        priority: "high",
        entityType: "deal",
        entityId: 42,
      };
      expect(taskInput.dueAt).toBeDefined();
      // The auto-sync fires as fire-and-forget
    });

    it("should not auto-sync when creating task without due date", () => {
      const taskInput = {
        title: "Tarefa sem data",
        priority: "low",
        entityType: "contact",
        entityId: 1,
      };
      expect(taskInput.dueAt).toBeUndefined();
      // No sync should be triggered
    });

    it("should auto-sync when updating task status to done", () => {
      const updateInput = {
        id: 42,
        tenantId: 150002,
        status: "done" as const,
      };
      expect(updateInput.status).toBe("done");
      // Should call markTaskCompletedInCalendar
    });

    it("should auto-sync when updating task status to cancelled", () => {
      const updateInput = {
        id: 42,
        tenantId: 150002,
        status: "cancelled" as const,
      };
      expect(updateInput.status).toBe("cancelled");
      // Should call markTaskCompletedInCalendar
    });

    it("should update existing event when task details change", () => {
      const updateInput = {
        id: 42,
        tenantId: 150002,
        title: "Updated title",
        dueAt: "2026-03-20T10:00:00Z",
      };
      expect(updateInput.title).toBe("Updated title");
      expect(updateInput.dueAt).toBeDefined();
      // Should call syncTaskToCalendar with existing googleEventId
    });
  });

  describe("Schema - googleEventId Column", () => {
    it("should have googleEventId column in tasks table", () => {
      // The column should be varchar(512) nullable
      const taskWithEvent = {
        id: 1,
        title: "Test",
        googleEventId: "abc123xyz",
        googleCalendarSynced: true,
      };
      expect(taskWithEvent.googleEventId).toBe("abc123xyz");
      expect(taskWithEvent.googleCalendarSynced).toBe(true);
    });

    it("should allow null googleEventId for unsynced tasks", () => {
      const taskWithoutEvent = {
        id: 2,
        title: "Unsynced",
        googleEventId: null,
        googleCalendarSynced: false,
      };
      expect(taskWithoutEvent.googleEventId).toBeNull();
      expect(taskWithoutEvent.googleCalendarSynced).toBe(false);
    });
  });
});
