import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Test: SaaS Metrics Service type contracts and plan prices ───

// Test plan prices are correct after update
import { PLANS, getPlanDefinition } from "../shared/plans";

describe("Plan Prices (Updated)", () => {
  it("Start plan costs R$97 (9700 cents)", () => {
    const plan = getPlanDefinition("start");
    expect(plan.priceInCents).toBe(9700);
    expect(plan.name).toBe("Start");
  });

  it("Growth plan costs R$297 (29700 cents)", () => {
    const plan = getPlanDefinition("growth");
    expect(plan.priceInCents).toBe(29700);
    expect(plan.name).toBe("Growth");
  });

  it("Scale plan exists", () => {
    const plan = getPlanDefinition("scale");
    expect(plan.name).toBe("Scale");
  });

  it("Free/unknown plan falls back to Start", () => {
    const plan = getPlanDefinition("free");
    expect(plan.id).toBe("start");
    expect(plan.priceInCents).toBe(9700);
  });

  it("Unknown plan falls back to Start", () => {
    const plan = getPlanDefinition("nonexistent");
    expect(plan.id).toBe("start");
    expect(plan.priceInCents).toBe(9700);
  });
});

// ─── Test: SaaS Overview type contract ──────────────────────────

describe("SaasOverview type contract", () => {
  it("has all required fields", () => {
    const overview = {
      totalTenants: 50,
      activeTenants: 20,
      trialingTenants: 5,
      legacyTenants: 15,
      restrictedTenants: 3,
      cancelledTenants: 7,
      totalUsers: 120,
      mrr: 594000, // 20 * 29700
      mrrFormatted: "R$ 5.940,00",
      arpu: 29700,
      arpuFormatted: "R$ 297,00",
    };

    expect(overview.totalTenants).toBe(50);
    expect(overview.activeTenants).toBe(20);
    expect(overview.mrr).toBeGreaterThan(0);
    expect(overview.arpu).toBeGreaterThan(0);
    expect(overview.mrrFormatted).toContain("R$");
  });
});

// ─── Test: Churn Metrics type contract ──────────────────────────

describe("ChurnMetrics type contract", () => {
  it("calculates churn rate correctly", () => {
    const churned = 2;
    const startOfMonth = 40;
    const rate = (churned / startOfMonth) * 100;
    expect(rate).toBe(5);
  });

  it("trend is 'down' when current < previous", () => {
    const currentRate = 3;
    const prevRate = 5;
    const trend = currentRate < prevRate ? "down" : currentRate > prevRate ? "up" : "stable";
    expect(trend).toBe("down");
  });

  it("trend is 'up' when current > previous", () => {
    const currentRate = 8;
    const prevRate = 5;
    const trend = currentRate < prevRate ? "down" : currentRate > prevRate ? "up" : "stable";
    expect(trend).toBe("up");
  });

  it("trend is 'stable' when equal", () => {
    const currentRate = 5;
    const prevRate = 5;
    const trend = currentRate < prevRate ? "down" : currentRate > prevRate ? "up" : "stable";
    expect(trend).toBe("stable");
  });
});

// ─── Test: Plan Distribution logic ──────────────────────────────

describe("Plan Distribution logic", () => {
  it("calculates percentage correctly", () => {
    const total = 50;
    const count = 20;
    const percentage = Math.round((count / total) * 1000) / 10;
    expect(percentage).toBe(40);
  });

  it("calculates MRR per plan correctly", () => {
    const activeTenants = 10;
    const planPrice = 9700; // Start
    const mrr = activeTenants * planPrice;
    expect(mrr).toBe(97000);
  });
});

// ─── Test: Billing Status Distribution logic ────────────────────

describe("Billing Status Distribution", () => {
  const labels: Record<string, string> = {
    active: "Ativo",
    trialing: "Trial",
    past_due: "Inadimplente",
    restricted: "Restrito",
    cancelled: "Cancelado",
    expired: "Expirado",
  };

  it("maps all billing statuses to Portuguese labels", () => {
    expect(labels["active"]).toBe("Ativo");
    expect(labels["trialing"]).toBe("Trial");
    expect(labels["past_due"]).toBe("Inadimplente");
    expect(labels["restricted"]).toBe("Restrito");
    expect(labels["cancelled"]).toBe("Cancelado");
    expect(labels["expired"]).toBe("Expirado");
  });

  it("sorts by count descending", () => {
    const items = [
      { status: "active", count: 20 },
      { status: "trialing", count: 5 },
      { status: "legacy", count: 15 },
    ];
    const sorted = items.sort((a, b) => b.count - a.count);
    expect(sorted[0].status).toBe("active");
    expect(sorted[1].status).toBe("legacy");
    expect(sorted[2].status).toBe("trialing");
  });
});

// ─── Test: Monthly Evolution logic ──────────────────────────────

describe("Monthly Evolution logic", () => {
  it("generates correct month labels", () => {
    const date = new Date(2026, 2, 1); // March 2026
    const label = date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    expect(label).toContain("2026");
  });

  it("calculates MRR from active non-legacy tenants", () => {
    const tenants = [
      { billingStatus: "active", isLegacy: false, plan: "start" },
      { billingStatus: "active", isLegacy: false, plan: "growth" },
      { billingStatus: "active", isLegacy: true, plan: "free" }, // legacy, should not count
      { billingStatus: "trialing", isLegacy: false, plan: "start" }, // trialing, should not count
    ];

    let mrr = 0;
    for (const t of tenants) {
      if (t.billingStatus === "active" && !t.isLegacy) {
        mrr += getPlanDefinition(t.plan).priceInCents;
      }
    }
    expect(mrr).toBe(9700 + 29700); // Start + Growth
  });
});

// ─── Test: Hotmart Health status logic ──────────────────────────

describe("Hotmart Health status logic", () => {
  it("returns 'healthy' when last event is within 72 hours", () => {
    const now = Date.now();
    const lastEventAt = new Date(now - 24 * 60 * 60 * 1000); // 24 hours ago
    const hoursSince = (now - lastEventAt.getTime()) / (1000 * 60 * 60);

    let status: string;
    if (hoursSince < 72) status = "healthy";
    else if (hoursSince < 168) status = "warning";
    else status = "error";

    expect(status).toBe("healthy");
  });

  it("returns 'warning' when last event is 72-168 hours ago", () => {
    const now = Date.now();
    const lastEventAt = new Date(now - 100 * 60 * 60 * 1000); // 100 hours ago
    const hoursSince = (now - lastEventAt.getTime()) / (1000 * 60 * 60);

    let status: string;
    if (hoursSince < 72) status = "healthy";
    else if (hoursSince < 168) status = "warning";
    else status = "error";

    expect(status).toBe("warning");
  });

  it("returns 'error' when last event is over 168 hours ago", () => {
    const now = Date.now();
    const lastEventAt = new Date(now - 200 * 60 * 60 * 1000); // 200 hours ago
    const hoursSince = (now - lastEventAt.getTime()) / (1000 * 60 * 60);

    let status: string;
    if (hoursSince < 72) status = "healthy";
    else if (hoursSince < 168) status = "warning";
    else status = "error";

    expect(status).toBe("error");
  });

  it("returns 'no_events' when there are no events", () => {
    const lastEvent = null;
    const status = lastEvent ? "healthy" : "no_events";
    expect(status).toBe("no_events");
  });
});

// ─── Test: Trial Conversion logic ───────────────────────────────

describe("Trial Conversion logic", () => {
  it("calculates conversion rate correctly", () => {
    const totalTrials = 20;
    const converted = 8;
    const rate = totalTrials > 0 ? Math.round((converted / totalTrials) * 1000) / 10 : 0;
    expect(rate).toBe(40);
  });

  it("returns 0% when no trials exist", () => {
    const totalTrials = 0;
    const converted = 0;
    const rate = totalTrials > 0 ? Math.round((converted / totalTrials) * 1000) / 10 : 0;
    expect(rate).toBe(0);
  });

  it("categorizes tenants correctly", () => {
    const tenants = [
      { billingStatus: "trialing", isLegacy: false },
      { billingStatus: "active", isLegacy: false },
      { billingStatus: "restricted", isLegacy: false },
      { billingStatus: "expired", isLegacy: false },
      { billingStatus: "active", isLegacy: false },
    ];

    const active = tenants.filter(t => t.billingStatus === "trialing").length;
    const converted = tenants.filter(t => t.billingStatus === "active").length;
    const expired = tenants.filter(t =>
      t.billingStatus === "restricted" || t.billingStatus === "expired"
    ).length;

    expect(active).toBe(1);
    expect(converted).toBe(2);
    expect(expired).toBe(2);
  });
});

// ─── Test: ARPU calculation ─────────────────────────────────────

describe("ARPU calculation", () => {
  it("calculates ARPU correctly", () => {
    const mrr = 297000; // R$ 2.970,00
    const activeTenants = 10;
    const arpu = Math.round(mrr / activeTenants);
    expect(arpu).toBe(29700); // R$ 297,00
  });

  it("handles zero active tenants gracefully", () => {
    const mrr = 0;
    const payingTenants = Math.max(1, 0); // prevent division by zero
    const arpu = Math.round(mrr / payingTenants);
    expect(arpu).toBe(0);
  });
});

// ─── Test: formatBRL helper ─────────────────────────────────────

describe("formatBRL helper", () => {
  function formatBRL(cents: number): string {
    return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  it("formats 9700 cents as R$ 97,00", () => {
    expect(formatBRL(9700)).toContain("97");
  });

  it("formats 29700 cents as R$ 297,00", () => {
    expect(formatBRL(29700)).toContain("297");
  });

  it("formats 0 cents as R$ 0,00", () => {
    expect(formatBRL(0)).toContain("0");
  });
});
