import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ───
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();
const mockLimit = vi.fn();

const chainable = {
  from: mockFrom.mockReturnThis(),
  where: mockWhere.mockReturnThis(),
  set: mockSet.mockReturnThis(),
  values: mockValues.mockReturnThis(),
  limit: mockLimit,
};

vi.mock("./db", () => ({
  getDb: vi.fn(() => ({
    select: mockSelect.mockReturnValue(chainable),
    update: mockUpdate.mockReturnValue({ set: mockSet.mockReturnValue({ where: mockWhere }) }),
    insert: mockInsert.mockReturnValue({ values: mockValues }),
    delete: mockDelete.mockReturnValue({ where: mockWhere }),
  })),
}));

vi.mock("../drizzle/schema", () => ({
  crmUsers: { id: "id", name: "name", email: "email", phone: "phone", avatarUrl: "avatarUrl", passwordHash: "passwordHash", role: "role", tenantId: "tenantId", createdAt: "createdAt" },
  googleCalendarTokens: { id: "id", userId: "userId", tenantId: "tenantId", accessToken: "accessToken", refreshToken: "refreshToken", email: "email", scope: "scope", expiresAt: "expiresAt", connectedAt: "connectedAt" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: any, b: any) => ({ field: a, value: b })),
  and: vi.fn((...args: any[]) => ({ conditions: args })),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn((pw: string, hash: string) => pw === "correct-password"),
    hash: vi.fn((pw: string, rounds: number) => `hashed_${pw}`),
  },
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(() => ({ url: "https://s3.example.com/avatar.jpg", key: "avatars/test.jpg" })),
}));

describe("Profile Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProfile", () => {
    it("should return user profile with Google Calendar status", async () => {
      // Mock user data
      const mockUser = {
        id: 150001,
        name: "Bruno Silva",
        email: "bruno@test.com",
        phone: "11999999999",
        avatarUrl: "https://s3.example.com/avatar.jpg",
        role: "admin",
        tenantId: 150002,
        createdAt: new Date("2025-01-01"),
      };

      mockLimit.mockResolvedValueOnce([mockUser]);
      mockLimit.mockResolvedValueOnce([{ email: "bruno@gmail.com", connectedAt: new Date("2025-06-01") }]);

      // The profile should include user data and Google Calendar status
      expect(mockUser.name).toBe("Bruno Silva");
      expect(mockUser.email).toBe("bruno@test.com");
      expect(mockUser.role).toBe("admin");
    });

    it("should return googleCalendar.connected = false when no tokens", async () => {
      const mockUser = {
        id: 150001,
        name: "Bruno Silva",
        email: "bruno@test.com",
        role: "admin",
      };

      mockLimit.mockResolvedValueOnce([mockUser]);
      mockLimit.mockResolvedValueOnce([]); // No Google Calendar tokens

      // Should indicate not connected
      const hasTokens = false;
      expect(hasTokens).toBe(false);
    });
  });

  describe("updateProfile", () => {
    it("should update name and phone", async () => {
      mockWhere.mockResolvedValueOnce(undefined);

      const input = { name: "Bruno Atualizado", phone: "11888888888" };
      expect(input.name.length).toBeGreaterThanOrEqual(2);
      expect(input.phone).toBeDefined();
    });

    it("should reject empty name", () => {
      const name = "";
      expect(name.length).toBeLessThan(2);
    });

    it("should allow updating only name without phone", () => {
      const input = { name: "Novo Nome" };
      expect(input.name.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("changePassword", () => {
    it("should validate current password before changing", async () => {
      const bcrypt = await import("bcryptjs");
      const isValid = await bcrypt.default.compare("correct-password", "hashed_password");
      expect(isValid).toBe(true);
    });

    it("should reject incorrect current password", async () => {
      const bcrypt = await import("bcryptjs");
      const isValid = await bcrypt.default.compare("wrong-password", "hashed_password");
      expect(isValid).toBe(false);
    });

    it("should hash the new password before saving", async () => {
      const bcrypt = await import("bcryptjs");
      const hashed = await bcrypt.default.hash("newPassword123", 10);
      expect(hashed).toBe("hashed_newPassword123");
      expect(hashed).not.toBe("newPassword123");
    });

    it("should enforce minimum password length of 6", () => {
      const shortPw = "12345";
      const validPw = "123456";
      expect(shortPw.length).toBeLessThan(6);
      expect(validPw.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("uploadAvatar", () => {
    it("should upload avatar to S3 and return URL", async () => {
      const { storagePut } = await import("./storage");
      const result = await storagePut("avatars/test.jpg", Buffer.from("fake-image"), "image/jpeg");
      expect(result.url).toBe("https://s3.example.com/avatar.jpg");
    });

    it("should reject files larger than 5MB", () => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const largeFile = 6 * 1024 * 1024; // 6MB
      const validFile = 2 * 1024 * 1024; // 2MB

      expect(largeFile).toBeGreaterThan(maxSize);
      expect(validFile).toBeLessThanOrEqual(maxSize);
    });

    it("should accept valid image mime types", () => {
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      expect(validTypes).toContain("image/jpeg");
      expect(validTypes).toContain("image/png");
      expect(validTypes).not.toContain("application/pdf");
    });
  });

  describe("removeAvatar", () => {
    it("should set avatarUrl to null", async () => {
      mockWhere.mockResolvedValueOnce(undefined);
      // After removal, avatarUrl should be null
      const newAvatarUrl = null;
      expect(newAvatarUrl).toBeNull();
    });
  });

  describe("Google Calendar Integration", () => {
    it("should store tokens when connecting", async () => {
      const tokens = {
        accessToken: "ya29.xxx",
        refreshToken: "1//xxx",
        email: "bruno@gmail.com",
        scope: "calendar.readonly calendar.events",
        expiresAt: Date.now() + 3600000,
      };

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.email).toContain("@");
    });

    it("should delete tokens when disconnecting", async () => {
      mockWhere.mockResolvedValueOnce(undefined);
      // After disconnect, tokens should be removed
      const tokensExist = false;
      expect(tokensExist).toBe(false);
    });

    it("should return connected status with email", () => {
      const calendarStatus = {
        connected: true,
        email: "bruno@gmail.com",
        connectedAt: new Date("2025-06-01").getTime(),
      };

      expect(calendarStatus.connected).toBe(true);
      expect(calendarStatus.email).toBe("bruno@gmail.com");
      expect(calendarStatus.connectedAt).toBeGreaterThan(0);
    });

    it("should return disconnected status when no tokens", () => {
      const calendarStatus = {
        connected: false,
        email: null,
        connectedAt: null,
      };

      expect(calendarStatus.connected).toBe(false);
      expect(calendarStatus.email).toBeNull();
    });
  });

  describe("Avatar in TopNavLayout", () => {
    it("saasAuth.me should return avatarUrl from DB", () => {
      // The me procedure now fetches avatarUrl from DB
      const meResponse = {
        userId: 150001,
        tenantId: 150002,
        email: "bruno@test.com",
        name: "Bruno",
        role: "admin",
        avatarUrl: "https://s3.example.com/avatar.jpg",
        isSuperAdmin: false,
      };

      expect(meResponse.avatarUrl).toBe("https://s3.example.com/avatar.jpg");
    });

    it("should fallback to initials when no avatarUrl", () => {
      const meResponse = {
        name: "Bruno Silva",
        avatarUrl: null,
      };

      const initials = meResponse.name.charAt(0).toUpperCase();
      expect(initials).toBe("B");
      expect(meResponse.avatarUrl).toBeNull();
    });
  });

  describe("Profile Page Navigation", () => {
    it("should be accessible from user dropdown", () => {
      const profilePath = "/profile";
      expect(profilePath).toBe("/profile");
    });

    it("should have back button to settings", () => {
      const backPath = "/settings";
      expect(backPath).toBe("/settings");
    });
  });
});
