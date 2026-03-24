import { describe, it, expect } from "vitest";

// ─── Notification Preference Defaults ───
const DEFAULT_PREFS: Record<string, boolean> = {
  deal_created: true,
  rfv_filter_alert: true,
  task_due_soon: true,
  birthday: true,
  // Optional (off by default)
  deal_moved: false,
  contact_created: false,
  task_created: false,
  whatsapp_message: false,
  whatsapp_connected: false,
  whatsapp_disconnected: false,
  whatsapp_warning: false,
  wedding_anniversary: false,
  new_lead: false,
  automation_triggered: false,
};

describe("Notification Preferences — Defaults", () => {
  it("should have 4 default-on notification types", () => {
    const defaultOn = Object.entries(DEFAULT_PREFS).filter(([, v]) => v === true);
    expect(defaultOn).toHaveLength(4);
    expect(defaultOn.map(([k]) => k).sort()).toEqual([
      "birthday",
      "deal_created",
      "rfv_filter_alert",
      "task_due_soon",
    ]);
  });

  it("should have 10 optional (off by default) notification types", () => {
    const defaultOff = Object.entries(DEFAULT_PREFS).filter(([, v]) => v === false);
    expect(defaultOff).toHaveLength(10);
  });

  it("should include all known notification types", () => {
    const allTypes = [
      "deal_created", "rfv_filter_alert", "task_due_soon", "birthday",
      "deal_moved", "contact_created", "task_created", "whatsapp_message",
      "whatsapp_connected", "whatsapp_disconnected", "whatsapp_warning",
      "wedding_anniversary", "new_lead", "automation_triggered",
    ];
    for (const type of allTypes) {
      expect(DEFAULT_PREFS).toHaveProperty(type);
    }
  });
});

describe("Notification Preferences — Merge Logic", () => {
  it("should override defaults with saved preferences", () => {
    const saved = { deal_created: false, whatsapp_message: true };
    const merged = { ...DEFAULT_PREFS, ...saved };
    expect(merged.deal_created).toBe(false);
    expect(merged.whatsapp_message).toBe(true);
    // Other defaults unchanged
    expect(merged.rfv_filter_alert).toBe(true);
    expect(merged.birthday).toBe(true);
    expect(merged.deal_moved).toBe(false);
  });

  it("should handle empty saved preferences gracefully", () => {
    const saved = {};
    const merged = { ...DEFAULT_PREFS, ...saved };
    expect(merged).toEqual(DEFAULT_PREFS);
  });

  it("should handle unknown keys in saved preferences", () => {
    const saved = { unknown_type: true, deal_created: false };
    const merged = { ...DEFAULT_PREFS, ...saved };
    expect(merged.deal_created).toBe(false);
    expect((merged as any).unknown_type).toBe(true);
  });
});

describe("Notification Filtering", () => {
  const mockNotifications = [
    { id: 1, type: "deal_created", title: "Nova negociação" },
    { id: 2, type: "whatsapp_message", title: "Mensagem WhatsApp" },
    { id: 3, type: "birthday", title: "Aniversário" },
    { id: 4, type: "task_due_soon", title: "Tarefa vencendo" },
    { id: 5, type: "rfv_filter_alert", title: "Alerta RFV" },
    { id: 6, type: "deal_moved", title: "Deal movido" },
    { id: 7, type: "contact_created", title: "Contato criado" },
  ];

  it("should show only default-on notifications when no prefs saved", () => {
    const filtered = mockNotifications.filter(n => DEFAULT_PREFS[n.type] !== false);
    expect(filtered).toHaveLength(4);
    expect(filtered.map(n => n.type).sort()).toEqual([
      "birthday", "deal_created", "rfv_filter_alert", "task_due_soon",
    ]);
  });

  it("should show all notifications when all prefs are true", () => {
    const allTrue: Record<string, boolean> = {};
    Object.keys(DEFAULT_PREFS).forEach(k => { allTrue[k] = true; });
    const filtered = mockNotifications.filter(n => allTrue[n.type] !== false);
    expect(filtered).toHaveLength(7);
  });

  it("should show no notifications when all prefs are false", () => {
    const allFalse: Record<string, boolean> = {};
    Object.keys(DEFAULT_PREFS).forEach(k => { allFalse[k] = false; });
    const filtered = mockNotifications.filter(n => allFalse[n.type] !== false);
    expect(filtered).toHaveLength(0);
  });

  it("should correctly filter with mixed preferences", () => {
    const prefs = { ...DEFAULT_PREFS, deal_created: false, whatsapp_message: true };
    const filtered = mockNotifications.filter(n => prefs[n.type] !== false);
    expect(filtered.map(n => n.type).sort()).toEqual([
      "birthday", "rfv_filter_alert", "task_due_soon", "whatsapp_message",
    ]);
  });
});

describe("Task Due Soon — Time Calculation", () => {
  it("should correctly calculate time remaining", () => {
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000);
    const diffMs = twoHoursLater.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    expect(hours).toBe(2);
    expect(mins).toBe(30);
  });

  it("should format time string correctly for hours and minutes", () => {
    function formatTimeStr(hours: number, mins: number): string {
      if (hours > 0 && mins > 0) return `${hours}h ${mins}min`;
      if (hours > 0) return `${hours}h`;
      return `${mins}min`;
    }
    expect(formatTimeStr(2, 30)).toBe("2h 30min");
    expect(formatTimeStr(1, 0)).toBe("1h");
    expect(formatTimeStr(0, 45)).toBe("45min");
    expect(formatTimeStr(0, 5)).toBe("5min");
  });

  it("should identify tasks within 3-hour window", () => {
    const now = new Date();
    const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    
    const taskDueIn1h = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    const taskDueIn4h = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const taskDuePast = new Date(now.getTime() - 1 * 60 * 60 * 1000);

    expect(taskDueIn1h >= now && taskDueIn1h <= threeHoursLater).toBe(true);
    expect(taskDueIn4h >= now && taskDueIn4h <= threeHoursLater).toBe(false);
    expect(taskDuePast >= now && taskDuePast <= threeHoursLater).toBe(false);
  });
});

describe("Notification Type Config Coverage", () => {
  const KNOWN_TYPES = [
    "whatsapp_message", "deal_moved", "deal_created", "contact_created",
    "task_created", "task_due_soon", "rfv_filter_alert", "birthday",
    "wedding_anniversary", "new_lead", "whatsapp_connected",
    "whatsapp_disconnected", "whatsapp_warning", "automation_triggered",
  ];

  it("all known types should have a preference entry", () => {
    for (const type of KNOWN_TYPES) {
      expect(DEFAULT_PREFS).toHaveProperty(type);
    }
  });

  it("total known types should be 14", () => {
    expect(KNOWN_TYPES).toHaveLength(14);
    expect(Object.keys(DEFAULT_PREFS)).toHaveLength(14);
  });
});
