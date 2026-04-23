import { describe, expect, it, vi, beforeEach } from "vitest";
import { getDepartureWindow, checkUpcomingDepartures, notifiedDepartures } from "./departureScheduler";

// Mock db module
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue({
      execute: vi.fn().mockResolvedValue([[], []]),
    }),
    createNotification: vi.fn().mockResolvedValue({ insertId: 1 }),
  };
});

describe("appointmentScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifiedDepartures.clear();
  });

  describe("getAppointmentWindow", () => {
    it("should return 'today' for appointments happening today (0-1 day)", () => {
      const now = new Date("2025-06-15T10:00:00Z");
      const appointment = new Date("2025-06-15T18:00:00Z"); // same day, 8h later
      const result = getDepartureWindow(appointment, now);
      expect(result).not.toBeNull();
      expect(result!.key).toBe("today");
      expect(result!.label).toBe("hoje");
      expect(result!.emoji).toBe("📅");
    });

    it("should return '1d' for appointments tomorrow (1-2 days)", () => {
      const now = new Date("2025-06-15T10:00:00Z");
      const appointment = new Date("2025-06-16T14:00:00Z"); // ~28h later
      const result = getDepartureWindow(appointment, now);
      expect(result).not.toBeNull();
      expect(result!.key).toBe("1d");
      expect(result!.label).toBe("amanhã");
      expect(result!.emoji).toBe("⚠️");
    });

    it("should return '3d' for appointments in 3 days (3-4 days)", () => {
      const now = new Date("2025-06-15T10:00:00Z");
      const appointment = new Date("2025-06-18T14:00:00Z"); // ~3.17 days
      const result = getDepartureWindow(appointment, now);
      expect(result).not.toBeNull();
      expect(result!.key).toBe("3d");
      expect(result!.label).toBe("em 3 dias");
      expect(result!.emoji).toBe("📅");
    });

    it("should return '7d' for appointments in 7 days (7-8 days)", () => {
      const now = new Date("2025-06-15T10:00:00Z");
      const appointment = new Date("2025-06-22T14:00:00Z"); // ~7.17 days
      const result = getDepartureWindow(appointment, now);
      expect(result).not.toBeNull();
      expect(result!.key).toBe("7d");
      expect(result!.label).toBe("em 7 dias");
      expect(result!.emoji).toBe("🗓️");
    });

    it("should return null for appointments in 2 days (between windows)", () => {
      const now = new Date("2025-06-15T10:00:00Z");
      const appointment = new Date("2025-06-17T14:00:00Z"); // ~2.17 days
      const result = getDepartureWindow(appointment, now);
      expect(result).toBeNull();
    });

    it("should return null for appointments in 5 days (between windows)", () => {
      const now = new Date("2025-06-15T10:00:00Z");
      const appointment = new Date("2025-06-20T14:00:00Z"); // ~5.17 days
      const result = getDepartureWindow(appointment, now);
      expect(result).toBeNull();
    });

    it("should return null for past appointments", () => {
      const now = new Date("2025-06-15T10:00:00Z");
      const appointment = new Date("2025-06-14T10:00:00Z"); // yesterday
      const result = getDepartureWindow(appointment, now);
      expect(result).toBeNull();
    });
  });

  describe("checkUpcomingAppointments", () => {
    it("should return 0 notifications when no deals found", async () => {
      const result = await checkUpcomingDepartures();
      expect(result.notificationsCreated).toBe(0);
    });

    it("should track notified appointments to avoid duplicates", async () => {
      // Simulate adding a tracking key
      notifiedDepartures.add("123:today");
      expect(notifiedDepartures.has("123:today")).toBe(true);
      expect(notifiedDepartures.has("123:3d")).toBe(false);
    });

    it("should allow different windows for the same deal", () => {
      notifiedDepartures.add("100:7d");
      notifiedDepartures.add("100:3d");
      notifiedDepartures.add("100:1d");
      notifiedDepartures.add("100:today");
      expect(notifiedDepartures.size).toBe(4);
    });

    it("should not re-notify the same deal+window combo", () => {
      const key = "200:3d";
      notifiedDepartures.add(key);
      // Trying to add again shouldn't increase size
      notifiedDepartures.add(key);
      expect(notifiedDepartures.size).toBe(1);
    });
  });

  describe("notification window coverage", () => {
    it("should cover all 4 notification windows", () => {
      const now = new Date("2025-06-15T12:00:00Z");

      // Today
      const todayResult = getDepartureWindow(new Date("2025-06-15T18:00:00Z"), now);
      expect(todayResult?.key).toBe("today");

      // Tomorrow
      const tomorrowResult = getDepartureWindow(new Date("2025-06-16T18:00:00Z"), now);
      expect(tomorrowResult?.key).toBe("1d");

      // 3 days
      const threeDaysResult = getDepartureWindow(new Date("2025-06-18T18:00:00Z"), now);
      expect(threeDaysResult?.key).toBe("3d");

      // 7 days
      const sevenDaysResult = getDepartureWindow(new Date("2025-06-22T18:00:00Z"), now);
      expect(sevenDaysResult?.key).toBe("7d");
    });

    it("should have correct emoji for each window", () => {
      const now = new Date("2025-06-15T12:00:00Z");

      expect(getDepartureWindow(new Date("2025-06-15T18:00:00Z"), now)?.emoji).toBe("📅");
      expect(getDepartureWindow(new Date("2025-06-16T18:00:00Z"), now)?.emoji).toBe("⚠️");
      expect(getDepartureWindow(new Date("2025-06-18T18:00:00Z"), now)?.emoji).toBe("📅");
      expect(getDepartureWindow(new Date("2025-06-22T18:00:00Z"), now)?.emoji).toBe("🗓️");
    });
  });
});
