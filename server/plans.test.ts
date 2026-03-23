import { describe, expect, it } from "vitest";
import {
  PLANS,
  LEGACY_PLAN_MAP,
  getPlanDefinition,
  planHasFeature,
  getPlanUserLimit,
  type PlanId,
} from "../shared/plans";

// ─── Plan Definitions ─────────────────────────────────────────────

describe("Plan Definitions", () => {
  it("defines exactly 3 plans: start, growth, scale", () => {
    const planIds = Object.keys(PLANS);
    expect(planIds).toEqual(["start", "growth", "scale"]);
  });

  describe("Start plan", () => {
    const plan = PLANS.start;

    it("has correct name", () => {
      expect(plan.name).toBe("Start");
    });

    it("limits to 1 user", () => {
      expect(plan.maxUsers).toBe(1);
    });

    it("limits to 1 WhatsApp instance", () => {
      expect(plan.maxWhatsAppInstances).toBe(1);
    });

    it("limits to 1 user per instance", () => {
      expect(plan.maxUsersPerInstance).toBe(1);
    });

    it("does NOT include automation center", () => {
      expect(plan.features.automationCenter).toBe(false);
    });

    it("does NOT include strategic classification", () => {
      expect(plan.features.strategicClassification).toBe(false);
    });

    it("includes all core features", () => {
      expect(plan.features.allCoreFeatures).toBe(true);
    });

    it("costs R$ 67/mês (6700 cents)", () => {
      expect(plan.priceInCents).toBe(6700);
    });
  });

  describe("Growth plan", () => {
    const plan = PLANS.growth;

    it("has correct name", () => {
      expect(plan.name).toBe("Growth");
    });

    it("allows up to 5 users", () => {
      expect(plan.maxUsers).toBe(5);
    });

    it("limits to 1 WhatsApp instance", () => {
      expect(plan.maxWhatsAppInstances).toBe(1);
    });

    it("allows up to 5 users per instance", () => {
      expect(plan.maxUsersPerInstance).toBe(5);
    });

    it("includes automation center", () => {
      expect(plan.features.automationCenter).toBe(true);
    });

    it("includes strategic classification", () => {
      expect(plan.features.strategicClassification).toBe(true);
    });

    it("costs R$ 97/mês (9700 cents)", () => {
      expect(plan.priceInCents).toBe(9700);
    });
  });

  describe("Scale plan", () => {
    const plan = PLANS.scale;

    it("has correct name", () => {
      expect(plan.name).toBe("Scale");
    });

    it("allows unlimited users (-1)", () => {
      expect(plan.maxUsers).toBe(-1);
    });

    it("allows unlimited WhatsApp instances (-1)", () => {
      expect(plan.maxWhatsAppInstances).toBe(-1);
    });

    it("allows unlimited users per instance (-1)", () => {
      expect(plan.maxUsersPerInstance).toBe(-1);
    });

    it("includes automation center", () => {
      expect(plan.features.automationCenter).toBe(true);
    });

    it("includes strategic classification", () => {
      expect(plan.features.strategicClassification).toBe(true);
    });

    it("price is 0 (sob consulta)", () => {
      expect(plan.priceInCents).toBe(0);
    });
  });
});

// ─── Legacy Plan Mapping ──────────────────────────────────────────

describe("Legacy Plan Mapping", () => {
  it("maps 'free' to 'start'", () => {
    expect(LEGACY_PLAN_MAP["free"]).toBe("start");
  });

  it("maps 'pro' to 'growth'", () => {
    expect(LEGACY_PLAN_MAP["pro"]).toBe("growth");
  });

  it("maps 'enterprise' to 'scale'", () => {
    expect(LEGACY_PLAN_MAP["enterprise"]).toBe("scale");
  });
});

// ─── getPlanDefinition ────────────────────────────────────────────

describe("getPlanDefinition", () => {
  it("returns correct plan for direct ID", () => {
    expect(getPlanDefinition("start").id).toBe("start");
    expect(getPlanDefinition("growth").id).toBe("growth");
    expect(getPlanDefinition("scale").id).toBe("scale");
  });

  it("resolves legacy 'free' to Start plan", () => {
    const plan = getPlanDefinition("free");
    expect(plan.id).toBe("start");
    expect(plan.name).toBe("Start");
  });

  it("resolves legacy 'pro' to Growth plan", () => {
    const plan = getPlanDefinition("pro");
    expect(plan.id).toBe("growth");
    expect(plan.name).toBe("Growth");
  });

  it("resolves legacy 'enterprise' to Scale plan", () => {
    const plan = getPlanDefinition("enterprise");
    expect(plan.id).toBe("scale");
    expect(plan.name).toBe("Scale");
  });

  it("falls back to Start for unknown plan", () => {
    const plan = getPlanDefinition("unknown_plan");
    expect(plan.id).toBe("start");
  });

  it("falls back to Start for empty string", () => {
    const plan = getPlanDefinition("");
    expect(plan.id).toBe("start");
  });
});

// ─── planHasFeature ───────────────────────────────────────────────

describe("planHasFeature", () => {
  it("Start does NOT have automationCenter", () => {
    expect(planHasFeature("start", "automationCenter")).toBe(false);
  });

  it("Start does NOT have strategicClassification", () => {
    expect(planHasFeature("start", "strategicClassification")).toBe(false);
  });

  it("Start HAS allCoreFeatures", () => {
    expect(planHasFeature("start", "allCoreFeatures")).toBe(true);
  });

  it("Growth HAS automationCenter", () => {
    expect(planHasFeature("growth", "automationCenter")).toBe(true);
  });

  it("Growth HAS strategicClassification", () => {
    expect(planHasFeature("growth", "strategicClassification")).toBe(true);
  });

  it("Scale HAS all features", () => {
    expect(planHasFeature("scale", "automationCenter")).toBe(true);
    expect(planHasFeature("scale", "strategicClassification")).toBe(true);
    expect(planHasFeature("scale", "allCoreFeatures")).toBe(true);
  });

  it("legacy 'free' resolves and blocks automationCenter", () => {
    expect(planHasFeature("free", "automationCenter")).toBe(false);
  });

  it("legacy 'pro' resolves and allows automationCenter", () => {
    expect(planHasFeature("pro", "automationCenter")).toBe(true);
  });
});

// ─── getPlanUserLimit ─────────────────────────────────────────────

describe("getPlanUserLimit", () => {
  it("Start allows 1 user", () => {
    expect(getPlanUserLimit("start")).toBe(1);
  });

  it("Growth allows 5 users", () => {
    expect(getPlanUserLimit("growth")).toBe(5);
  });

  it("Scale allows unlimited users (-1)", () => {
    expect(getPlanUserLimit("scale")).toBe(-1);
  });

  it("legacy 'free' resolves to 1 user", () => {
    expect(getPlanUserLimit("free")).toBe(1);
  });

  it("unknown plan defaults to Start (1 user)", () => {
    expect(getPlanUserLimit("nonexistent")).toBe(1);
  });
});
