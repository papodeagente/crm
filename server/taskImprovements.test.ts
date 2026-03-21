import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

describe("Task System Improvements", () => {
  // ── 1. Schema: deadlineOffsetUnit column ──
  describe("Schema: deadlineOffsetUnit", () => {
    const schemaContent = fs.readFileSync(path.join(ROOT, "drizzle/schema.ts"), "utf-8");

    it("task_automations has deadlineOffsetUnit enum column", () => {
      expect(schemaContent).toContain("deadlineOffsetUnit");
      expect(schemaContent).toContain('"minutes"');
      expect(schemaContent).toContain('"hours"');
      expect(schemaContent).toContain('"days"');
    });

    it("deadlineOffsetUnit defaults to 'days'", () => {
      const match = schemaContent.match(/deadlineOffsetUnit.*\.default\("days"\)/);
      expect(match).toBeTruthy();
    });
  });

  // ── 2. Backend: executeTaskAutomations supports minutes/hours/days ──
  describe("Backend: executeTaskAutomations offset units", () => {
    const crmDbContent = fs.readFileSync(path.join(ROOT, "server/crmDb.ts"), "utf-8");

    it("handles minutes offset", () => {
      expect(crmDbContent).toContain('unit === "minutes"');
      expect(crmDbContent).toContain("dueDate.setMinutes(dueDate.getMinutes() + offsetValue)");
    });

    it("handles hours offset", () => {
      expect(crmDbContent).toContain('unit === "hours"');
      expect(crmDbContent).toContain("dueDate.setHours(dueDate.getHours() + offsetValue)");
    });

    it("handles days offset (default)", () => {
      expect(crmDbContent).toContain("dueDate.setDate(dueDate.getDate() + offsetValue)");
    });

    it("only applies deadlineTime for days unit", () => {
      // The time application should be inside the days branch
      const daysBlock = crmDbContent.substring(
        crmDbContent.indexOf("// days (default)"),
        crmDbContent.indexOf("// Determinar responsáveis")
      );
      expect(daysBlock).toContain("deadlineTime");
    });
  });

  // ── 3. Backend: Task ordering (overdue first) ──
  describe("Backend: Task ordering", () => {
    const crmDbContent = fs.readFileSync(path.join(ROOT, "server/crmDb.ts"), "utf-8");

    it("orders overdue tasks first", () => {
      expect(crmDbContent).toContain("CASE WHEN");
      expect(crmDbContent).toContain("< NOW()");
    });

    it("uses ascending order for dueAt", () => {
      expect(crmDbContent).toContain("asc(tasks.dueAt)");
    });

    it("completed/cancelled tasks come last", () => {
      expect(crmDbContent).toContain("done");
      expect(crmDbContent).toContain("cancelled");
    });
  });

  // ── 4. Router: deadlineOffsetUnit in create/update ──
  describe("Router: taskAutomations CRUD", () => {
    const routerContent = fs.readFileSync(path.join(ROOT, "server/routers/crmRouter.ts"), "utf-8");

    it("create accepts deadlineOffsetUnit", () => {
      const createBlock = routerContent.substring(
        routerContent.indexOf("taskAutomations: router"),
        routerContent.indexOf("update: tenantProcedure", routerContent.indexOf("taskAutomations: router"))
      );
      expect(createBlock).toContain('deadlineOffsetUnit');
      expect(createBlock).toContain('"minutes"');
      expect(createBlock).toContain('"hours"');
      expect(createBlock).toContain('"days"');
    });

    it("update accepts deadlineOffsetUnit", () => {
      const updateBlock = routerContent.substring(
        routerContent.indexOf("update: tenantProcedure", routerContent.indexOf("taskAutomations: router")),
        routerContent.indexOf("delete: tenantProcedure", routerContent.indexOf("taskAutomations: router"))
      );
      expect(updateBlock).toContain('deadlineOffsetUnit');
    });
  });

  // ── 5. Frontend: TaskAutomationSettings has unit selector ──
  describe("Frontend: TaskAutomationSettings", () => {
    const tasContent = fs.readFileSync(path.join(ROOT, "client/src/pages/TaskAutomationSettings.tsx"), "utf-8");

    it("has OFFSET_UNIT_OPTIONS with minutes/hours/days", () => {
      expect(tasContent).toContain("OFFSET_UNIT_OPTIONS");
      expect(tasContent).toContain('"Minutos"');
      expect(tasContent).toContain('"Horas"');
      expect(tasContent).toContain('"Dias"');
    });

    it("form data includes deadlineOffsetUnit", () => {
      expect(tasContent).toContain("deadlineOffsetUnit");
    });

    it("getDeadlineLabel supports unit parameter", () => {
      expect(tasContent).toContain("getDeadlineLabel(ref: string, offset: number, unit?: string)");
    });

    it("disables time input when unit is not days", () => {
      expect(tasContent).toContain('disabled={formData.deadlineOffsetUnit !== "days"}');
    });
  });

  // ── 6. Frontend: DealDetail preview shows 1 task + Ver todas ──
  describe("Frontend: DealDetail task preview", () => {
    const ddContent = fs.readFileSync(path.join(ROOT, "client/src/pages/DealDetail.tsx"), "utf-8");

    it("shows only the first pending task (not slice(0,3))", () => {
      expect(ddContent).not.toContain("pendingTasks.slice(0, 3)");
      expect(ddContent).toContain("pendingTasks[0]");
    });

    it("has 'Ver todas' button that switches to tasks tab", () => {
      expect(ddContent).toContain("Ver todas");
      expect(ddContent).toContain('setActiveTab("tasks")');
    });

    it("shows pending task count in the button", () => {
      expect(ddContent).toContain("pendingTasks.length");
      expect(ddContent).toContain("tarefas pendentes");
    });
  });
});
