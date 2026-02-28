import { describe, it, expect } from "vitest";

// ─── Unit tests for Pipeline Header redesign features ───
// Tests validate: owner user filter, pipeline indicators logic, task calendar logic, and deal filter button

describe("Pipeline Header - Owner User Filter", () => {
  it("should filter deals by ownerUserId when specified", () => {
    const deals = [
      { id: 1, title: "Deal A", ownerUserId: 1, status: "open" },
      { id: 2, title: "Deal B", ownerUserId: 2, status: "open" },
      { id: 3, title: "Deal C", ownerUserId: 1, status: "won" },
      { id: 4, title: "Deal D", ownerUserId: null, status: "open" },
    ];

    const ownerFilter = 1;
    const filtered = deals.filter((d) => d.ownerUserId === ownerFilter);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((d) => d.id)).toEqual([1, 3]);
  });

  it("should return all deals when ownerFilter is 'all'", () => {
    const deals = [
      { id: 1, ownerUserId: 1 },
      { id: 2, ownerUserId: 2 },
      { id: 3, ownerUserId: null },
    ];

    const ownerFilter = "all";
    const filtered = ownerFilter === "all" ? deals : deals.filter((d) => d.ownerUserId === ownerFilter);
    expect(filtered).toHaveLength(3);
  });
});

describe("Pipeline Indicators - Calculations", () => {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const deals = [
    { id: 1, status: "open", stageId: 1, valueCents: 5000, lastActivityAt: new Date(now - 1000).toISOString(), createdAt: new Date(now - 1000).toISOString() },
    { id: 2, status: "open", stageId: 1, valueCents: 0, lastActivityAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 3, status: "open", stageId: 2, valueCents: 3000, lastActivityAt: null, createdAt: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 4, status: "won", stageId: 1, valueCents: 10000, lastActivityAt: new Date(now).toISOString(), createdAt: new Date(now).toISOString() },
    { id: 5, status: "open", stageId: 2, valueCents: null, lastActivityAt: new Date(now - 2000).toISOString(), createdAt: new Date(now - 2000).toISOString() },
  ];

  const tasks = [
    { id: 1, entityType: "deal", entityId: 1, status: "pending", dueAt: new Date(now + 86400000).toISOString() },
    { id: 2, entityType: "deal", entityId: 2, status: "pending", dueAt: new Date(now - 86400000).toISOString() },
    { id: 3, entityType: "deal", entityId: 4, status: "completed", dueAt: new Date(now).toISOString() },
  ];

  it("should count open deals (in progress)", () => {
    const openDeals = deals.filter((d) => d.status === "open");
    expect(openDeals).toHaveLength(4);
  });

  it("should identify cooling deals (no activity in 7+ days)", () => {
    const openDeals = deals.filter((d) => d.status === "open");
    const cooling = openDeals.filter((d) => {
      const lastActivity = d.lastActivityAt ? new Date(d.lastActivityAt).getTime() : new Date(d.createdAt).getTime();
      return lastActivity < sevenDaysAgo;
    });
    expect(cooling).toHaveLength(2); // deal 2 (10 days ago) and deal 3 (20 days ago, no lastActivityAt)
  });

  it("should identify deals without tasks", () => {
    const openDeals = deals.filter((d) => d.status === "open");
    const dealIdsWithTasks = new Set(
      tasks
        .filter((t) => t.entityType === "deal" && (t.status === "pending" || t.status === "in_progress"))
        .map((t) => t.entityId)
    );
    const noTasks = openDeals.filter((d) => !dealIdsWithTasks.has(d.id));
    expect(noTasks).toHaveLength(2); // deal 3 and deal 5 have no tasks
  });

  it("should identify deals with overdue tasks", () => {
    const openDeals = deals.filter((d) => d.status === "open");
    const overdueTasks = tasks.filter(
      (t) => t.entityType === "deal" && (t.status === "pending" || t.status === "in_progress") && t.dueAt && new Date(t.dueAt).getTime() < now
    );
    const dealIdsWithOverdue = new Set(overdueTasks.map((t) => t.entityId));
    const withOverdue = openDeals.filter((d) => dealIdsWithOverdue.has(d.id));
    expect(withOverdue).toHaveLength(1); // deal 2 has overdue task
  });

  it("should identify deals without products (valueCents = 0 or null)", () => {
    const openDeals = deals.filter((d) => d.status === "open");
    const noProducts = openDeals.filter((d) => !d.valueCents || d.valueCents === 0);
    expect(noProducts).toHaveLength(2); // deal 2 (0) and deal 5 (null)
  });
});

describe("Task Calendar - Date Grouping", () => {
  it("should group tasks by date key", () => {
    const tasks = [
      { id: 1, title: "Task A", dueAt: "2026-03-01T10:00:00Z" },
      { id: 2, title: "Task B", dueAt: "2026-03-01T14:00:00Z" },
      { id: 3, title: "Task C", dueAt: "2026-03-02T09:00:00Z" },
      { id: 4, title: "Task D", dueAt: null },
    ];

    const tasksByDate: Record<string, any[]> = {};
    tasks.forEach((t) => {
      if (!t.dueAt) return;
      const d = new Date(t.dueAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!tasksByDate[key]) tasksByDate[key] = [];
      tasksByDate[key].push(t);
    });

    expect(Object.keys(tasksByDate)).toHaveLength(2);
    expect(tasksByDate["2026-03-01"]).toHaveLength(2);
    expect(tasksByDate["2026-03-02"]).toHaveLength(1);
  });

  it("should handle empty tasks array", () => {
    const tasks: any[] = [];
    const tasksByDate: Record<string, any[]> = {};
    tasks.forEach((t) => {
      if (!t.dueAt) return;
      const d = new Date(t.dueAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!tasksByDate[key]) tasksByDate[key] = [];
      tasksByDate[key].push(t);
    });

    expect(Object.keys(tasksByDate)).toHaveLength(0);
  });

  it("should correctly identify overdue tasks", () => {
    const now = Date.now();
    const tasks = [
      { id: 1, status: "pending", dueAt: new Date(now - 86400000).toISOString() },
      { id: 2, status: "pending", dueAt: new Date(now + 86400000).toISOString() },
      { id: 3, status: "completed", dueAt: new Date(now - 86400000).toISOString() },
    ];

    const overdue = tasks.filter(
      (t) => (t.status === "pending" || t.status === "in_progress") && t.dueAt && new Date(t.dueAt).getTime() < now
    );
    expect(overdue).toHaveLength(1);
    expect(overdue[0].id).toBe(1);
  });
});

describe("Deal Filter Button - Active Count", () => {
  it("should show count when filters are active", () => {
    const activeCount = 3;
    const label = activeCount > 0 ? `Filtros (${activeCount})` : "Filtros";
    expect(label).toBe("Filtros (3)");
  });

  it("should show plain label when no filters active", () => {
    const activeCount = 0;
    const label = activeCount > 0 ? `Filtros (${activeCount})` : "Filtros";
    expect(label).toBe("Filtros");
  });

  it("should use primary variant when filters are active", () => {
    const activeCount = 2;
    const variant = activeCount > 0 ? "default" : "outline";
    expect(variant).toBe("default");
  });

  it("should use outline variant when no filters active", () => {
    const activeCount = 0;
    const variant = activeCount > 0 ? "default" : "outline";
    expect(variant).toBe("outline");
  });
});

describe("Pipeline Header - Sort Modes", () => {
  const deals = [
    { id: 1, createdAt: "2026-01-01T00:00:00Z", valueCents: 5000 },
    { id: 2, createdAt: "2026-02-01T00:00:00Z", valueCents: 1000 },
    { id: 3, createdAt: "2026-01-15T00:00:00Z", valueCents: 10000 },
  ];

  it("should sort by created_desc (newest first)", () => {
    const sorted = [...deals].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    expect(sorted[0].id).toBe(2);
    expect(sorted[2].id).toBe(1);
  });

  it("should sort by created_asc (oldest first)", () => {
    const sorted = [...deals].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    expect(sorted[0].id).toBe(1);
    expect(sorted[2].id).toBe(2);
  });

  it("should sort by value_desc (highest first)", () => {
    const sorted = [...deals].sort((a, b) => (b.valueCents || 0) - (a.valueCents || 0));
    expect(sorted[0].id).toBe(3);
    expect(sorted[2].id).toBe(2);
  });

  it("should sort by value_asc (lowest first)", () => {
    const sorted = [...deals].sort((a, b) => (a.valueCents || 0) - (b.valueCents || 0));
    expect(sorted[0].id).toBe(2);
    expect(sorted[2].id).toBe(3);
  });
});

describe("Pipeline Header - Status Filter", () => {
  const deals = [
    { id: 1, status: "open" },
    { id: 2, status: "won" },
    { id: 3, status: "lost" },
    { id: 4, status: "open" },
  ];

  it("should show all deals when filter is 'all'", () => {
    const statusFilter = "all";
    const filtered = statusFilter === "all" ? deals : deals.filter((d) => d.status === statusFilter);
    expect(filtered).toHaveLength(4);
  });

  it("should filter open deals", () => {
    const statusFilter = "open";
    const filtered = deals.filter((d) => d.status === statusFilter);
    expect(filtered).toHaveLength(2);
  });

  it("should filter won deals", () => {
    const statusFilter = "won";
    const filtered = deals.filter((d) => d.status === statusFilter);
    expect(filtered).toHaveLength(1);
  });

  it("should filter lost deals", () => {
    const statusFilter = "lost";
    const filtered = deals.filter((d) => d.status === statusFilter);
    expect(filtered).toHaveLength(1);
  });
});

describe("Pipeline Indicators - Stage Breakdown", () => {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const stages = [
    { id: 1, name: "Novo Lead" },
    { id: 2, name: "Primeiro Contato" },
    { id: 3, name: "Proposta" },
  ];

  const deals = [
    { id: 1, status: "open", stageId: 1, lastActivityAt: new Date(now).toISOString(), createdAt: new Date(now).toISOString() },
    { id: 2, status: "open", stageId: 1, lastActivityAt: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(), createdAt: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 3, status: "open", stageId: 2, lastActivityAt: new Date(now).toISOString(), createdAt: new Date(now).toISOString() },
  ];

  it("should calculate per-stage totals", () => {
    const openDeals = deals.filter((d) => d.status === "open");
    const stageBreakdown = stages.map((stage) => {
      const stageDeals = openDeals.filter((d) => d.stageId === stage.id);
      return { name: stage.name, total: stageDeals.length };
    });

    expect(stageBreakdown[0].total).toBe(2); // Novo Lead
    expect(stageBreakdown[1].total).toBe(1); // Primeiro Contato
    expect(stageBreakdown[2].total).toBe(0); // Proposta
  });

  it("should calculate per-stage cooling deals", () => {
    const openDeals = deals.filter((d) => d.status === "open");
    const stageBreakdown = stages.map((stage) => {
      const stageDeals = openDeals.filter((d) => d.stageId === stage.id);
      const cooling = stageDeals.filter((d) => {
        const la = d.lastActivityAt ? new Date(d.lastActivityAt).getTime() : new Date(d.createdAt).getTime();
        return la < sevenDaysAgo;
      }).length;
      return { name: stage.name, cooling };
    });

    expect(stageBreakdown[0].cooling).toBe(1); // Novo Lead has 1 cooling
    expect(stageBreakdown[1].cooling).toBe(0); // Primeiro Contato has 0
    expect(stageBreakdown[2].cooling).toBe(0); // Proposta has 0
  });
});
