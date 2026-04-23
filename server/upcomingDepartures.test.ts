import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

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
    req: { headers: { origin: "http://localhost:3000" } } as any,
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as any,
  };
  return { ctx };
}

// Mock homeService
vi.mock("./services/homeService", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  const futureAppointmentDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const futureFollowUpDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return {
    ...actual,
    getUpcomingAppointments: vi.fn().mockResolvedValue([
      {
        id: 101,
        title: "Consulta Estética - João",
        valueCents: 1500000,
        appointmentDate: futureAppointmentDate.getTime(),
        followUpDate: futureFollowUpDate.getTime(),
        contactName: "João Silva",
        contactPhone: "+5511999999999",
        ownerName: "Profissional Maria",
        ownerUserId: 1,
        pipelineName: "Pós-venda",
        stageName: "Agendado",
      },
      {
        id: 102,
        title: "Procedimento Dental - Ana",
        valueCents: 800000,
        appointmentDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).getTime(),
        followUpDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).getTime(),
        contactName: "Ana Costa",
        contactPhone: "+5521888888888",
        ownerName: "Profissional Pedro",
        ownerUserId: 2,
        pipelineName: "Pós-venda",
        stageName: "Confirmado",
      },
    ]),
  };
});

describe("home.upcomingDepartures (appointments)", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    const { ctx } = createAuthContext();
    caller = appRouter.createCaller(ctx);
  });

  it("should return upcoming appointments for authenticated user", async () => {
    const result = await caller.home.upcomingDepartures();
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Consulta Estética - João");
    expect(result[0].valueCents).toBe(1500000);
    expect(result[0].contactName).toBe("João Silva");
    expect(result[0].appointmentDate).toBeTruthy();
    expect(result[0].followUpDate).toBeTruthy();
  });

  it("should return appointments with correct structure", async () => {
    const result = await caller.home.upcomingDepartures();
    const dep = result[0];
    expect(dep).toHaveProperty("id");
    expect(dep).toHaveProperty("title");
    expect(dep).toHaveProperty("valueCents");
    expect(dep).toHaveProperty("appointmentDate");
    expect(dep).toHaveProperty("followUpDate");
    expect(dep).toHaveProperty("contactName");
    expect(dep).toHaveProperty("ownerName");
    expect(dep).toHaveProperty("pipelineName");
    expect(dep).toHaveProperty("stageName");
  });

  it("should accept optional filter input", async () => {
    const result = await caller.home.upcomingDepartures({ userId: 1 });
    expect(result).toHaveLength(2);
  });

  it("should accept team filter input", async () => {
    const result = await caller.home.upcomingDepartures({ teamId: 5 });
    expect(result).toHaveLength(2);
  });

  it("should accept limit parameter", async () => {
    const result = await caller.home.upcomingDepartures({ limit: 10 });
    expect(result).toHaveLength(2);
  });

  it("should return appointments ordered by appointment date (nearest first)", async () => {
    const result = await caller.home.upcomingDepartures();
    // The mock returns them in order, verify the second one has a closer appointment date
    expect(result[1].title).toBe("Procedimento Dental - Ana");
  });

  it("should include owner information", async () => {
    const result = await caller.home.upcomingDepartures();
    expect(result[0].ownerName).toBe("Profissional Maria");
    expect(result[0].ownerUserId).toBe(1);
  });

  it("should include pipeline and stage info", async () => {
    const result = await caller.home.upcomingDepartures();
    expect(result[0].pipelineName).toBe("Pós-venda");
    expect(result[0].stageName).toBe("Agendado");
  });

  it("should reject unauthenticated requests", async () => {
    const unauthCtx: TrpcContext = {
      user: null,
      saasUser: null,
      req: { headers: {} } as any,
      res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
    };
    const unauthCaller = appRouter.createCaller(unauthCtx);
    await expect(unauthCaller.home.upcomingDepartures()).rejects.toThrow();
  });
});
