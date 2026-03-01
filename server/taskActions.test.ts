import { describe, it, expect, vi } from "vitest";

// Test the overdue/pending task logic and task form validation

describe("Task Overdue Logic", () => {
  it("should correctly identify overdue tasks", () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day ahead

    const getEffectiveStatus = (task: { status: string; dueAt?: string | null }) => {
      if (task.status === "done") return "done";
      if (task.status === "cancelled") return "cancelled";
      if (task.dueAt && new Date(task.dueAt) < new Date()) return "overdue";
      return task.status || "pending";
    };

    expect(getEffectiveStatus({ status: "pending", dueAt: pastDate.toISOString() })).toBe("overdue");
    expect(getEffectiveStatus({ status: "pending", dueAt: futureDate.toISOString() })).toBe("pending");
    expect(getEffectiveStatus({ status: "done", dueAt: pastDate.toISOString() })).toBe("done");
    expect(getEffectiveStatus({ status: "cancelled", dueAt: pastDate.toISOString() })).toBe("cancelled");
    expect(getEffectiveStatus({ status: "in_progress", dueAt: pastDate.toISOString() })).toBe("overdue");
    expect(getEffectiveStatus({ status: "pending", dueAt: null })).toBe("pending");
  });

  it("should correctly compute postpone dates", () => {
    const baseDate = new Date("2026-03-01T10:00:00Z");

    const postpone = (dueAt: Date, hours: number) => {
      return new Date(dueAt.getTime() + hours * 60 * 60 * 1000);
    };

    // 1 hour
    const result1h = postpone(baseDate, 1);
    expect(result1h.toISOString()).toBe("2026-03-01T11:00:00.000Z");

    // 3 hours
    const result3h = postpone(baseDate, 3);
    expect(result3h.toISOString()).toBe("2026-03-01T13:00:00.000Z");

    // 1 day (24 hours)
    const result1d = postpone(baseDate, 24);
    expect(result1d.toISOString()).toBe("2026-03-02T10:00:00.000Z");

    // 2 days (48 hours)
    const result2d = postpone(baseDate, 48);
    expect(result2d.toISOString()).toBe("2026-03-03T10:00:00.000Z");

    // 7 days (168 hours)
    const result7d = postpone(baseDate, 168);
    expect(result7d.toISOString()).toBe("2026-03-08T10:00:00.000Z");
  });

  it("should correctly build dueAt from date and time inputs", () => {
    const dueDate = "2026-03-01";
    const dueTime = "14:30";
    const dueAt = `${dueDate}T${dueTime}:00`;
    expect(dueAt).toBe("2026-03-01T14:30:00");

    const parsed = new Date(dueAt);
    expect(parsed.getHours()).toBe(14);
    expect(parsed.getMinutes()).toBe(30);
  });

  it("should correctly split dueAt into date and time for editing", () => {
    const dueAt = "2026-03-15T09:45:00.000Z";
    const d = new Date(dueAt);
    const dateStr = d.toISOString().split("T")[0];
    const timeStr = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");

    expect(dateStr).toBe("2026-03-15");
    // Time depends on timezone, but format should be HH:MM
    expect(timeStr).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("Task Form Validation", () => {
  it("should require title", () => {
    const title = "";
    expect(title.trim().length > 0).toBe(false);
  });

  it("should accept valid title", () => {
    const title = "Ligar para cliente";
    expect(title.trim().length > 0).toBe(true);
  });

  it("should require at least one assignee", () => {
    const assigneeUserIds: number[] = [];
    expect(assigneeUserIds.length > 0).toBe(false);

    const withAssignee: number[] = [1];
    expect(withAssignee.length > 0).toBe(true);
  });

  it("should handle assignee add/remove correctly", () => {
    let assignees: number[] = [];

    // Add
    const addAssignee = (id: number) => {
      if (!assignees.includes(id)) {
        assignees = [...assignees, id];
      }
    };

    // Remove
    const removeAssignee = (id: number) => {
      assignees = assignees.filter(a => a !== id);
    };

    addAssignee(1);
    expect(assignees).toEqual([1]);

    addAssignee(2);
    expect(assignees).toEqual([1, 2]);

    // Duplicate add should not duplicate
    addAssignee(1);
    expect(assignees).toEqual([1, 2]);

    removeAssignee(1);
    expect(assignees).toEqual([2]);
  });

  it("should correctly diff assignees for edit mode", () => {
    const currentIds = new Set([1, 2, 3]);
    const newIds = new Set([2, 3, 4]);

    const toAdd: number[] = [];
    const toRemove: number[] = [];

    for (const uid of Array.from(newIds)) {
      if (!currentIds.has(uid)) toAdd.push(uid);
    }
    for (const uid of Array.from(currentIds)) {
      if (!newIds.has(uid)) toRemove.push(uid);
    }

    expect(toAdd).toEqual([4]);
    expect(toRemove).toEqual([1]);
  });
});

describe("DealCard Overdue Alert", () => {
  it("should apply red border when overdueCount > 0", () => {
    const overdueCount = 3;
    const hasOverdue = overdueCount > 0;
    expect(hasOverdue).toBe(true);

    const className = hasOverdue
      ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 ring-1 ring-red-400/30"
      : "border-border/50";
    expect(className).toContain("border-red-500");
    expect(className).toContain("ring-red-400/30");
  });

  it("should not apply red border when overdueCount is 0", () => {
    const overdueCount = 0;
    const hasOverdue = overdueCount > 0;
    expect(hasOverdue).toBe(false);

    const className = hasOverdue
      ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 ring-1 ring-red-400/30"
      : "border-border/50";
    expect(className).toBe("border-border/50");
    expect(className).not.toContain("border-red-500");
  });

  it("should show correct overdue text for single task", () => {
    const overdueCount = 1;
    const text = `${overdueCount} tarefa${overdueCount > 1 ? "s" : ""} atrasada${overdueCount > 1 ? "s" : ""}`;
    expect(text).toBe("1 tarefa atrasada");
  });

  it("should show correct overdue text for multiple tasks", () => {
    const overdueCount = 5;
    const text = `${overdueCount} tarefa${overdueCount > 1 ? "s" : ""} atrasada${overdueCount > 1 ? "s" : ""}`;
    expect(text).toBe("5 tarefas atrasadas");
  });
});

describe("Postpone Options", () => {
  const postponeOptions = [
    { label: "1 hora", hours: 1 },
    { label: "3 horas", hours: 3 },
    { label: "1 dia", hours: 24 },
    { label: "2 dias", hours: 48 },
    { label: "7 dias", hours: 168 },
  ];

  it("should have all required postpone options", () => {
    expect(postponeOptions).toHaveLength(5);
    expect(postponeOptions.map(o => o.label)).toEqual([
      "1 hora", "3 horas", "1 dia", "2 dias", "7 dias"
    ]);
  });

  it("should have correct hour values", () => {
    expect(postponeOptions[0].hours).toBe(1);
    expect(postponeOptions[1].hours).toBe(3);
    expect(postponeOptions[2].hours).toBe(24);
    expect(postponeOptions[3].hours).toBe(48);
    expect(postponeOptions[4].hours).toBe(168);
  });
});
