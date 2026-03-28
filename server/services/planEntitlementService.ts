/**
 * Plan Entitlement Service
 * Resolves the effective entitlement for a tenant by combining:
 * 1. Base plan features (from plan_definitions + plan_features DB tables)
 * 2. Active add-ons (from tenant_addons)
 * 3. Non-expired overrides (from tenant_entitlement_overrides)
 *
 * Fallback: if plan_definitions is empty, uses shared/plans.ts static data.
 * NEVER throws exceptions — returns minimum safe entitlement on error.
 */
import { eq, and, sql, isNull, or } from "drizzle-orm";
import { getDb } from "../db";
import {
  planDefinitions,
  planFeatures,
  tenantAddons,
  tenantEntitlementOverrides,
  tenants,
} from "../../drizzle/schema";
import { getPlanDefinition, type PlanFeatures } from "../../shared/plans";

export interface FeatureEntitlement {
  isEnabled: boolean;
  limitValue: number | null;
}

export interface EffectiveEntitlement {
  features: Record<string, FeatureEntitlement>;
  addons: {
    whatsappNumbers: number;
    extraUsers: number;
    extraStorageGb: number;
  };
}

// Minimum safe entitlement (fallback of last resort)
const MINIMUM_ENTITLEMENT: EffectiveEntitlement = {
  features: {
    crmCore: { isEnabled: true, limitValue: null },
    whatsappEmbedded: { isEnabled: false, limitValue: null },
    segmentedBroadcast: { isEnabled: false, limitValue: null },
    rfvEnabled: { isEnabled: false, limitValue: null },
    salesAutomation: { isEnabled: false, limitValue: null },
    prioritySupport: { isEnabled: false, limitValue: null },
    communityAccess: { isEnabled: true, limitValue: null },
    maxUsers: { isEnabled: true, limitValue: 1 },
    maxWhatsAppAccounts: { isEnabled: true, limitValue: 0 },
    maxAttendantsPerAccount: { isEnabled: true, limitValue: 0 },
  },
  addons: { whatsappNumbers: 0, extraUsers: 0, extraStorageGb: 0 },
};

/**
 * Build entitlement from shared/plans.ts static definitions (fallback)
 */
function buildStaticEntitlement(planSlug: string): EffectiveEntitlement {
  const def = getPlanDefinition(planSlug);
  const features: Record<string, FeatureEntitlement> = {};
  for (const [key, val] of Object.entries(def.features)) {
    features[key] = { isEnabled: val, limitValue: null };
  }
  features.maxUsers = { isEnabled: true, limitValue: def.maxUsers };
  features.maxWhatsAppAccounts = { isEnabled: true, limitValue: def.maxWhatsAppAccounts };
  features.maxAttendantsPerAccount = { isEnabled: true, limitValue: def.maxAttendantsPerAccount };
  return {
    features,
    addons: { whatsappNumbers: 0, extraUsers: 0, extraStorageGb: 0 },
  };
}

/**
 * Resolve the effective entitlement for a tenant.
 * Combines: plan base features + active add-ons + non-expired overrides.
 * NEVER throws — returns minimum safe entitlement on any error.
 */
export async function getEffectiveEntitlement(tenantId: number): Promise<EffectiveEntitlement> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[PlanEntitlement] No DB connection, using minimum entitlement");
      return MINIMUM_ENTITLEMENT;
    }

    // 1. Get tenant's current plan slug
    const [tenantRow] = await db
      .select({ plan: tenants.plan })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const planSlug = tenantRow?.plan ?? "start";

    // 2. Try to load plan from DB (plan_definitions + plan_features)
    const [planDef] = await db
      .select()
      .from(planDefinitions)
      .where(eq(planDefinitions.slug, planSlug))
      .limit(1);

    if (!planDef) {
      // Check if plan_definitions table has ANY rows
      const allPlans = await db.select({ id: planDefinitions.id }).from(planDefinitions).limit(1);
      if (allPlans.length === 0) {
        console.warn("[PlanEntitlement] plan_definitions is empty, falling back to shared/plans.ts");
        // Still need to check add-ons and overrides
        const staticEntitlement = buildStaticEntitlement(planSlug);
        return await applyAddonsAndOverrides(db, tenantId, staticEntitlement);
      }
      // plan_definitions has rows but this slug wasn't found — use static fallback
      console.warn(`[PlanEntitlement] Plan slug "${planSlug}" not found in DB, falling back to shared/plans.ts`);
      const staticEntitlement = buildStaticEntitlement(planSlug);
      return await applyAddonsAndOverrides(db, tenantId, staticEntitlement);
    }

    // 3. Load plan features from DB
    const dbFeatures = await db
      .select()
      .from(planFeatures)
      .where(eq(planFeatures.planId, planDef.id));

    const features: Record<string, FeatureEntitlement> = {};
    for (const f of dbFeatures) {
      features[f.featureKey] = {
        isEnabled: f.isEnabled,
        limitValue: f.limitValue,
      };
    }

    const entitlement: EffectiveEntitlement = {
      features,
      addons: { whatsappNumbers: 0, extraUsers: 0, extraStorageGb: 0 },
    };

    // 4. Apply add-ons and overrides
    return await applyAddonsAndOverrides(db, tenantId, entitlement);
  } catch (err: any) {
    console.error("[PlanEntitlement] Error resolving entitlement, using minimum:", err.message);
    return MINIMUM_ENTITLEMENT;
  }
}

/**
 * Apply active add-ons and non-expired overrides to an entitlement.
 */
async function applyAddonsAndOverrides(
  db: any,
  tenantId: number,
  entitlement: EffectiveEntitlement
): Promise<EffectiveEntitlement> {
  try {
    const now = new Date();

    // Sum active add-ons
    const activeAddons = await db
      .select()
      .from(tenantAddons)
      .where(
        and(
          eq(tenantAddons.tenantId, tenantId),
          eq(tenantAddons.status, "active"),
          or(
            isNull(tenantAddons.expiresAt),
            sql`${tenantAddons.expiresAt} > ${now}`
          )
        )
      );

    for (const addon of activeAddons) {
      const qty = addon.quantity ?? 1;
      switch (addon.addonType) {
        case "whatsapp_number":
          entitlement.addons.whatsappNumbers += qty;
          break;
        case "extra_user":
          entitlement.addons.extraUsers += qty;
          break;
        case "extra_storage_gb":
          entitlement.addons.extraStorageGb += qty;
          break;
      }
    }

    // Apply non-expired overrides (highest priority)
    const overrides = await db
      .select()
      .from(tenantEntitlementOverrides)
      .where(
        and(
          eq(tenantEntitlementOverrides.tenantId, tenantId),
          or(
            isNull(tenantEntitlementOverrides.expiresAt),
            sql`${tenantEntitlementOverrides.expiresAt} > ${now}`
          )
        )
      );

    for (const ov of overrides) {
      entitlement.features[ov.featureKey] = {
        isEnabled: ov.isEnabled,
        limitValue: ov.limitValue,
      };
    }

    return entitlement;
  } catch (err: any) {
    console.error("[PlanEntitlement] Error applying addons/overrides:", err.message);
    return entitlement; // Return what we have so far
  }
}
