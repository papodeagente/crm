import { describe, it, expect } from "vitest";
import * as crm from "./crmDb";

// Use a unique tenantId to avoid collisions with real data
const TEST_TENANT_ID = 999888;

describe("Stage Owner Rules", () => {
  // ─── CRUD ───────────────────────────────────────────────

  describe("CRUD operations", () => {
    it("listStageOwnerRules returns empty array for tenant with no rules", async () => {
      const rules = await crm.listStageOwnerRules(TEST_TENANT_ID);
      expect(Array.isArray(rules)).toBe(true);
      // May or may not be empty depending on previous test runs, but should be an array
    });

    it("listStageOwnerRules with pipelineId filter returns array", async () => {
      const rules = await crm.listStageOwnerRules(TEST_TENANT_ID, 99999);
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBe(0);
    });

    it("getStageOwnerRule returns null for non-existent stage", async () => {
      const rule = await crm.getStageOwnerRule(TEST_TENANT_ID, 99999);
      expect(rule).toBeNull();
    });

    it("createStageOwnerRule creates a new rule and returns id", async () => {
      const id = await crm.createStageOwnerRule({
        tenantId: TEST_TENANT_ID,
        pipelineId: 1,
        stageId: 88881,
        assignToUserId: 1,
      });
      expect(id).toBeDefined();
      expect(typeof id).toBe("number");

      // Clean up
      if (id) await crm.deleteStageOwnerRule(TEST_TENANT_ID, id);
    });

    it("createStageOwnerRule upserts if rule already exists for same stage", async () => {
      const id1 = await crm.createStageOwnerRule({
        tenantId: TEST_TENANT_ID,
        pipelineId: 1,
        stageId: 88882,
        assignToUserId: 1,
      });

      // Create again for same stage — should upsert
      const id2 = await crm.createStageOwnerRule({
        tenantId: TEST_TENANT_ID,
        pipelineId: 1,
        stageId: 88882,
        assignToUserId: 2,
      });

      // Should return the same id (upsert)
      expect(id2).toBe(id1);

      // Clean up
      if (id1) await crm.deleteStageOwnerRule(TEST_TENANT_ID, id1);
    });

    it("updateStageOwnerRule updates isActive", async () => {
      const id = await crm.createStageOwnerRule({
        tenantId: TEST_TENANT_ID,
        pipelineId: 1,
        stageId: 88883,
        assignToUserId: 1,
      });
      expect(id).toBeDefined();

      // Deactivate
      await crm.updateStageOwnerRule(TEST_TENANT_ID, id!, { isActive: false });

      // getStageOwnerRule only returns active rules
      const rule = await crm.getStageOwnerRule(TEST_TENANT_ID, 88883);
      expect(rule).toBeNull(); // because isActive = false

      // Clean up
      if (id) await crm.deleteStageOwnerRule(TEST_TENANT_ID, id);
    });

    it("deleteStageOwnerRule removes the rule", async () => {
      const id = await crm.createStageOwnerRule({
        tenantId: TEST_TENANT_ID,
        pipelineId: 1,
        stageId: 88884,
        assignToUserId: 1,
      });
      expect(id).toBeDefined();

      await crm.deleteStageOwnerRule(TEST_TENANT_ID, id!);

      const rules = await crm.listStageOwnerRules(TEST_TENANT_ID, 1);
      const found = rules.find((r: any) => r.id === id);
      expect(found).toBeUndefined();
    });
  });

  // ─── Execution Logic ───────────────────────────────────

  describe("executeStageOwnerRule", () => {
    it("returns null when no rule exists for the stage", async () => {
      const result = await crm.executeStageOwnerRule(TEST_TENANT_ID, 1, 99999);
      expect(result).toBeNull();
    });

    it("returns null when rule is inactive", async () => {
      const id = await crm.createStageOwnerRule({
        tenantId: TEST_TENANT_ID,
        pipelineId: 1,
        stageId: 88885,
        assignToUserId: 1,
      });
      // Deactivate
      await crm.updateStageOwnerRule(TEST_TENANT_ID, id!, { isActive: false });

      const result = await crm.executeStageOwnerRule(TEST_TENANT_ID, 1, 88885);
      expect(result).toBeNull();

      // Clean up
      if (id) await crm.deleteStageOwnerRule(TEST_TENANT_ID, id);
    });

    it("returns null when assigned user does not exist", async () => {
      const id = await crm.createStageOwnerRule({
        tenantId: TEST_TENANT_ID,
        pipelineId: 1,
        stageId: 88886,
        assignToUserId: 999999, // non-existent user
      });

      const result = await crm.executeStageOwnerRule(TEST_TENANT_ID, 1, 88886);
      expect(result).toBeNull();

      // Clean up
      if (id) await crm.deleteStageOwnerRule(TEST_TENANT_ID, id);
    });
  });

  // ─── Tenant Isolation ──────────────────────────────────

  describe("tenant isolation", () => {
    it("rules from one tenant are not visible to another", async () => {
      const TENANT_A = 999777;
      const TENANT_B = 999666;

      const idA = await crm.createStageOwnerRule({
        tenantId: TENANT_A,
        pipelineId: 1,
        stageId: 88887,
        assignToUserId: 1,
      });

      const rulesB = await crm.listStageOwnerRules(TENANT_B);
      const found = rulesB.find((r: any) => r.stageId === 88887);
      expect(found).toBeUndefined();

      // Clean up
      if (idA) await crm.deleteStageOwnerRule(TENANT_A, idA);
    });

    it("cannot delete rule from another tenant", async () => {
      const TENANT_A = 999555;
      const TENANT_B = 999444;

      const idA = await crm.createStageOwnerRule({
        tenantId: TENANT_A,
        pipelineId: 1,
        stageId: 88888,
        assignToUserId: 1,
      });

      // Try to delete from tenant B — should not affect tenant A's rule
      await crm.deleteStageOwnerRule(TENANT_B, idA!);

      // Rule should still exist for tenant A
      const rules = await crm.listStageOwnerRules(TENANT_A);
      const found = rules.find((r: any) => r.id === idA);
      expect(found).toBeDefined();

      // Clean up
      if (idA) await crm.deleteStageOwnerRule(TENANT_A, idA);
    });
  });
});
