/**
 * Super Admin Plans Router
 * Dashboard de gestão de planos, features, add-ons e entitlements.
 * Todas as procedures protegidas por requireSuperAdmin.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, and, sql, desc, isNull, or } from "drizzle-orm";
import { getDb } from "../db";
import {
  planDefinitions,
  planFeatures,
  tenantAddons,
  tenantEntitlementOverrides,
  addonOfferCodes,
  tenants,
} from "../../drizzle/schema";
import { verifySaasSession, isSuperAdminAsync, SAAS_COOKIE } from "../saasAuth";
import { emitEvent } from "../middleware/eventLog";
import { getEffectiveEntitlement } from "../services/planEntitlementService";
import { invalidatePlanCache } from "../services/dynamicPlanService";

// ─── Cookie parser ─────────────────────────────────────────────────
function parseCookies(cookieHeader?: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const pair of cookieHeader.split(";")) {
    const [k, ...v] = pair.trim().split("=");
    if (k) map.set(k, v.join("="));
  }
  return map;
}

// ─── Super Admin Guard ─────────────────────────────────────────────
async function requireSuperAdmin(ctx: any) {
  const cookies = parseCookies(ctx.req?.headers?.cookie);
  const token = cookies.get(SAAS_COOKIE);
  const session = token ? await verifySaasSession(token) : null;
  if (!session || !(await isSuperAdminAsync(session.email))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
  }
  return session;
}

// ─── Canonical feature keys ────────────────────────────────────────
const FEATURE_KEYS: { key: string; label: string; hasLimit: boolean }[] = [
  { key: "crmCore", label: "CRM Completo", hasLimit: false },
  { key: "whatsappEmbedded", label: "WhatsApp no CRM", hasLimit: false },
  { key: "segmentedBroadcast", label: "Disparo Segmentado", hasLimit: false },
  { key: "rfvEnabled", label: "Matriz RFV", hasLimit: false },
  { key: "salesAutomation", label: "Automação de Vendas", hasLimit: false },
  { key: "prioritySupport", label: "Suporte Prioritário", hasLimit: false },
  { key: "communityAccess", label: "Comunidade Acelera Turismo", hasLimit: false },
  { key: "maxUsers", label: "Máximo de Usuários", hasLimit: true },
  { key: "maxWhatsAppAccounts", label: "Máximo de Contas WhatsApp", hasLimit: true },
  { key: "maxAttendantsPerAccount", label: "Máximo de Atendentes por Conta", hasLimit: true },
];

// ─── Addon types ───────────────────────────────────────────────────
const ADDON_TYPES = [
  { type: "whatsapp_number" as const, label: "Número WhatsApp Adicional", unit: "número" },
  { type: "extra_user" as const, label: "Usuário Adicional", unit: "usuário" },
  { type: "extra_storage_gb" as const, label: "Armazenamento Extra", unit: "GB" },
];

export const superAdminPlansRouter = router({
  // ═══════════════════════════════════════════════════════════
  // PLANS
  // ═══════════════════════════════════════════════════════════

  plans: router({
    /** List all plans with features and tenant count */
    list: publicProcedure.query(async ({ ctx }) => {
      await requireSuperAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const allPlans = await db.select().from(planDefinitions).orderBy(planDefinitions.id);
      const allFeatures = await db.select().from(planFeatures);

      // Count tenants per plan
      const tenantRows = await db
        .select({ plan: tenants.plan, cnt: sql<number>`COUNT(*)` })
        .from(tenants)
        .groupBy(sql`${tenants.plan}`);
      const tenantCountMap: Record<string, number> = {};
      for (const r of tenantRows) {
        tenantCountMap[r.plan ?? "start"] = Number(r.cnt);
      }

      return allPlans.map((p) => ({
        ...p,
        features: allFeatures.filter((f) => f.planId === p.id),
        tenantCount: tenantCountMap[p.slug] ?? 0,
      }));
    }),

    /** Get single plan with all features */
    get: publicProcedure
      .input(z.object({ planId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireSuperAdmin(ctx);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [plan] = await db.select().from(planDefinitions).where(eq(planDefinitions.id, input.planId)).limit(1);
        if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado" });

        const features = await db.select().from(planFeatures).where(eq(planFeatures.planId, plan.id));
        return { ...plan, features };
      }),

    /** Create new plan + seed default features (all disabled) */
    create: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/),
        priceCents: z.number().int().min(0),
        billingCycle: z.enum(["monthly", "annual"]).default("monthly"),
        hotmartOfferCode: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireSuperAdmin(ctx);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Check slug uniqueness
        const existing = await db.select({ id: planDefinitions.id })
          .from(planDefinitions)
          .where(eq(planDefinitions.slug, input.slug))
          .limit(1);
        if (existing.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: `Slug "${input.slug}" já existe` });
        }

        const [newPlan] = await db.insert(planDefinitions).values({
          name: input.name,
          slug: input.slug,
          priceCents: input.priceCents,
          billingCycle: input.billingCycle,
          hotmartOfferCode: input.hotmartOfferCode ?? null,
          description: input.description ?? null,
        }).returning({ id: planDefinitions.id });

        // Seed default features (all disabled, no limits)
        const featureSeeds = FEATURE_KEYS.map((fk) => ({
          planId: newPlan.id,
          featureKey: fk.key,
          isEnabled: false,
          limitValue: fk.hasLimit ? 0 : null,
        }));
        await db.insert(planFeatures).values(featureSeeds);

        invalidatePlanCache();
        return { id: newPlan.id, slug: input.slug };
      }),

    /** Update plan (slug is immutable) */
    update: publicProcedure
      .input(z.object({
        planId: z.number(),
        name: z.string().min(1).optional(),
        priceCents: z.number().int().min(0).optional(),
        billingCycle: z.enum(["monthly", "annual"]).optional(),
        hotmartOfferCode: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        isPublic: z.boolean().optional(),
        forceDeactivate: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireSuperAdmin(ctx);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [plan] = await db.select().from(planDefinitions).where(eq(planDefinitions.id, input.planId)).limit(1);
        if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado" });

        // Block deactivation if tenants are active and forceDeactivate not set
        if (input.isActive === false && plan.isActive) {
          const tenantCount = await db
            .select({ cnt: sql<number>`COUNT(*)` })
            .from(tenants)
            .where(sql`${tenants.plan} = ${plan.slug}`);
          const count = Number(tenantCount[0]?.cnt ?? 0);
          if (count > 0 && !input.forceDeactivate) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: `Plano tem ${count} tenant(s) ativo(s). Use forceDeactivate=true para confirmar.`,
            });
          }
        }

        const updateData: Record<string, any> = { updatedAt: new Date() };
        if (input.name !== undefined) updateData.name = input.name;
        if (input.priceCents !== undefined) updateData.priceCents = input.priceCents;
        if (input.billingCycle !== undefined) updateData.billingCycle = input.billingCycle;
        if (input.hotmartOfferCode !== undefined) updateData.hotmartOfferCode = input.hotmartOfferCode;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;
        if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;

        await db.update(planDefinitions).set(updateData).where(eq(planDefinitions.id, input.planId));
        invalidatePlanCache();
        return { success: true };
      }),

    /** Upsert a feature for a plan */
    setFeature: publicProcedure
      .input(z.object({
        planId: z.number(),
        featureKey: z.string().min(1),
        isEnabled: z.boolean(),
        limitValue: z.number().int().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await requireSuperAdmin(ctx);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Check plan exists
        const [plan] = await db.select().from(planDefinitions).where(eq(planDefinitions.id, input.planId)).limit(1);
        if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado" });

        // Upsert: try update first, then insert
        const existing = await db.select()
          .from(planFeatures)
          .where(and(eq(planFeatures.planId, input.planId), eq(planFeatures.featureKey, input.featureKey)))
          .limit(1);

        if (existing.length > 0) {
          await db.update(planFeatures).set({
            isEnabled: input.isEnabled,
            limitValue: input.limitValue ?? null,
          }).where(eq(planFeatures.id, existing[0].id));
        } else {
          await db.insert(planFeatures).values({
            planId: input.planId,
            featureKey: input.featureKey,
            isEnabled: input.isEnabled,
            limitValue: input.limitValue ?? null,
          });
        }

        // EventLog
        await emitEvent({
          tenantId: 0, // system-level
          actorType: "system",
          entityType: "plan_feature",
          entityId: input.planId,
          action: "plan_feature_updated",
          afterJson: { planId: input.planId, featureKey: input.featureKey, isEnabled: input.isEnabled, limitValue: input.limitValue },
        });

        invalidatePlanCache();
        return { success: true };
      }),

    /** List canonical feature keys with PT-BR labels */
    listFeatureKeys: publicProcedure.query(async ({ ctx }) => {
      await requireSuperAdmin(ctx);
      return FEATURE_KEYS;
    }),
  }),

  // ═══════════════════════════════════════════════════════════
  // ADD-ONS
  // ═══════════════════════════════════════════════════════════

  addons: router({
    /** List addon types with labels */
    listTypes: publicProcedure.query(async ({ ctx }) => {
      await requireSuperAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get linked offer codes
      const offerCodes = await db.select().from(addonOfferCodes);
      return ADDON_TYPES.map((at) => ({
        ...at,
        offerCodes: offerCodes.filter((oc) => oc.addonType === at.type),
      }));
    }),

    /** Link a Hotmart offer code to an addon type */
    linkOfferCode: publicProcedure
      .input(z.object({
        addonType: z.enum(["whatsapp_number", "extra_user", "extra_storage_gb"]),
        hotmartOfferCode: z.string().min(1),
        priceCents: z.number().int().min(0).default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireSuperAdmin(ctx);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Check if already exists
        const existing = await db.select()
          .from(addonOfferCodes)
          .where(and(
            eq(addonOfferCodes.addonType, input.addonType),
            eq(addonOfferCodes.hotmartOfferCode, input.hotmartOfferCode),
          ))
          .limit(1);

        if (existing.length > 0) {
          await db.update(addonOfferCodes).set({ priceCents: input.priceCents })
            .where(eq(addonOfferCodes.id, existing[0].id));
        } else {
          await db.insert(addonOfferCodes).values({
            addonType: input.addonType,
            hotmartOfferCode: input.hotmartOfferCode,
            priceCents: input.priceCents,
          });
        }

        return { success: true };
      }),

    /** Recent addon activations (last 20) */
    recentActivations: publicProcedure.query(async ({ ctx }) => {
      await requireSuperAdmin(ctx);
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select({
          id: tenantAddons.id,
          tenantId: tenantAddons.tenantId,
          addonType: tenantAddons.addonType,
          quantity: tenantAddons.quantity,
          status: tenantAddons.status,
          hotmartTransactionId: tenantAddons.hotmartTransactionId,
          createdAt: tenantAddons.createdAt,
          tenantName: tenants.name,
        })
        .from(tenantAddons)
        .leftJoin(tenants, eq(tenantAddons.tenantId, tenants.id))
        .orderBy(desc(tenantAddons.createdAt))
        .limit(20);

      return rows;
    }),
  }),

  // ═══════════════════════════════════════════════════════════
  // TENANT ENTITLEMENT
  // ═══════════════════════════════════════════════════════════

  tenants: router({
    /** Get effective entitlement for a tenant */
    getEntitlement: publicProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireSuperAdmin(ctx);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const entitlement = await getEffectiveEntitlement(input.tenantId);

        // Get active add-ons with details
        const now = new Date();
        const activeAddons = await db
          .select()
          .from(tenantAddons)
          .where(
            and(
              eq(tenantAddons.tenantId, input.tenantId),
              eq(tenantAddons.status, "active"),
              or(isNull(tenantAddons.expiresAt), sql`${tenantAddons.expiresAt} > ${now}`)
            )
          );

        // Get active overrides
        const overrides = await db
          .select()
          .from(tenantEntitlementOverrides)
          .where(
            and(
              eq(tenantEntitlementOverrides.tenantId, input.tenantId),
              or(
                isNull(tenantEntitlementOverrides.expiresAt),
                sql`${tenantEntitlementOverrides.expiresAt} > ${now}`
              )
            )
          );

        // Get tenant plan
        const [tenant] = await db.select({ plan: tenants.plan, billingStatus: tenants.billingStatus })
          .from(tenants)
          .where(eq(tenants.id, input.tenantId))
          .limit(1);

        return {
          planSlug: tenant?.plan ?? "start",
          billingStatus: tenant?.billingStatus,
          entitlement,
          addons: activeAddons,
          overrides,
        };
      }),

    /** Assign a plan to a tenant (does NOT change billingStatus) */
    assignPlan: publicProcedure
      .input(z.object({
        tenantId: z.number(),
        planSlug: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireSuperAdmin(ctx);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Verify plan exists
        const [plan] = await db.select()
          .from(planDefinitions)
          .where(eq(planDefinitions.slug, input.planSlug))
          .limit(1);
        if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado" });

        // Get current plan
        const [tenant] = await db.select({ plan: tenants.plan })
          .from(tenants)
          .where(eq(tenants.id, input.tenantId))
          .limit(1);
        if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant não encontrado" });

        const oldPlan = tenant.plan;

        // Update ONLY the plan field — billingStatus stays untouched
        await db.update(tenants).set({ plan: input.planSlug as any })
          .where(eq(tenants.id, input.tenantId));

        // EventLog (obrigatório)
        await emitEvent({
          tenantId: input.tenantId,
          actorType: "system",
          entityType: "tenant",
          entityId: input.tenantId,
          action: "plan_changed",
          beforeJson: { plan: oldPlan },
          afterJson: { plan: input.planSlug },
          metadataJson: { source: "super_admin_dashboard" },
        });

        return { success: true, oldPlan, newPlan: input.planSlug };
      }),

    /** Set or update an entitlement override for a tenant */
    setOverride: publicProcedure
      .input(z.object({
        tenantId: z.number(),
        featureKey: z.string().min(1),
        isEnabled: z.boolean(),
        limitValue: z.number().int().nullable().optional(),
        reason: z.string().min(10, "Motivo deve ter pelo menos 10 caracteres"),
        expiresAt: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await requireSuperAdmin(ctx);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Upsert override
        const existing = await db.select()
          .from(tenantEntitlementOverrides)
          .where(and(
            eq(tenantEntitlementOverrides.tenantId, input.tenantId),
            eq(tenantEntitlementOverrides.featureKey, input.featureKey),
          ))
          .limit(1);

        const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

        if (existing.length > 0) {
          await db.update(tenantEntitlementOverrides).set({
            isEnabled: input.isEnabled,
            limitValue: input.limitValue ?? null,
            reason: input.reason,
            expiresAt,
          }).where(eq(tenantEntitlementOverrides.id, existing[0].id));
        } else {
          await db.insert(tenantEntitlementOverrides).values({
            tenantId: input.tenantId,
            featureKey: input.featureKey,
            isEnabled: input.isEnabled,
            limitValue: input.limitValue ?? null,
            reason: input.reason,
            expiresAt,
            createdBy: 0, // super admin
          });
        }

        await emitEvent({
          tenantId: input.tenantId,
          actorType: "system",
          entityType: "entitlement_override",
          action: "override_set",
          afterJson: { featureKey: input.featureKey, isEnabled: input.isEnabled, limitValue: input.limitValue, reason: input.reason },
        });

        return { success: true };
      }),

    /** Remove an entitlement override */
    removeOverride: publicProcedure
      .input(z.object({
        tenantId: z.number(),
        featureKey: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireSuperAdmin(ctx);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const existing = await db.select()
          .from(tenantEntitlementOverrides)
          .where(and(
            eq(tenantEntitlementOverrides.tenantId, input.tenantId),
            eq(tenantEntitlementOverrides.featureKey, input.featureKey),
          ))
          .limit(1);

        if (existing.length > 0) {
          await db.delete(tenantEntitlementOverrides)
            .where(eq(tenantEntitlementOverrides.id, existing[0].id));
        }

        await emitEvent({
          tenantId: input.tenantId,
          actorType: "system",
          entityType: "entitlement_override",
          action: "override_removed",
          afterJson: { featureKey: input.featureKey },
        });

        return { success: true };
      }),

    /** Grant an add-on manually to a tenant */
    grantAddon: publicProcedure
      .input(z.object({
        tenantId: z.number(),
        addonType: z.enum(["whatsapp_number", "extra_user", "extra_storage_gb"]),
        quantity: z.number().int().min(1).default(1),
        reason: z.string().min(10, "Motivo deve ter pelo menos 10 caracteres"),
        expiresAt: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireSuperAdmin(ctx);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

        const [addon] = await db.insert(tenantAddons).values({
          tenantId: input.tenantId,
          addonType: input.addonType,
          quantity: input.quantity,
          status: "active",
          expiresAt,
          activatedByUserId: 0, // super admin
        }).returning({ id: tenantAddons.id });

        await emitEvent({
          tenantId: input.tenantId,
          actorType: "system",
          entityType: "tenant_addon",
          entityId: addon.id,
          action: "addon_granted_manually",
          afterJson: { addonType: input.addonType, quantity: input.quantity, reason: input.reason },
        });

        return { success: true, addonId: addon.id };
      }),

    /** Revoke (cancel) an add-on */
    revokeAddon: publicProcedure
      .input(z.object({
        addonId: z.number(),
        reason: z.string().min(10, "Motivo deve ter pelo menos 10 caracteres"),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireSuperAdmin(ctx);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [addon] = await db.select()
          .from(tenantAddons)
          .where(eq(tenantAddons.id, input.addonId))
          .limit(1);
        if (!addon) throw new TRPCError({ code: "NOT_FOUND", message: "Add-on não encontrado" });

        await db.update(tenantAddons).set({
          status: "cancelled",
          updatedAt: new Date(),
        }).where(eq(tenantAddons.id, input.addonId));

        await emitEvent({
          tenantId: addon.tenantId,
          actorType: "system",
          entityType: "tenant_addon",
          entityId: input.addonId,
          action: "addon_revoked",
          afterJson: { addonType: addon.addonType, reason: input.reason },
        });

        return { success: true };
      }),
  }),
});
