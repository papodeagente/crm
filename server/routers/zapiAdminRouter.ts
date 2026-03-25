/**
 * Z-API Admin Router — Super Admin only
 * 
 * Endpoints for managing Z-API instances across all tenants:
 * - List all instances with tenant info
 * - Provision (liberar) Z-API for a tenant manually
 * - Deprovision (revogar) Z-API for a tenant
 * - Get instance connection status from Z-API API
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { verifySaasSession, isSuperAdmin, SAAS_COOKIE } from "../saasAuth";

export const zapiAdminRouter = router({
  /**
   * List all Z-API instances with tenant info
   */
  listInstances: publicProcedure.query(async ({ ctx }) => {
    const cookie = ctx.req?.cookies?.[SAAS_COOKIE];
    const session = cookie ? await verifySaasSession(cookie) : null;
    if (!session || !isSuperAdmin(session.email)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
    }

    const { getDb } = await import("../db");
    const { tenantZapiInstances, tenants, whatsappSessions } = await import("../../drizzle/schema");
    const { eq, sql } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Get all Z-API instances with tenant info
    const instances = await db
      .select({
        id: tenantZapiInstances.id,
        tenantId: tenantZapiInstances.tenantId,
        zapiInstanceId: tenantZapiInstances.zapiInstanceId,
        instanceName: tenantZapiInstances.instanceName,
        status: tenantZapiInstances.status,
        subscribedAt: tenantZapiInstances.subscribedAt,
        cancelledAt: tenantZapiInstances.cancelledAt,
        expiresAt: tenantZapiInstances.expiresAt,
        createdAt: tenantZapiInstances.createdAt,
        tenantName: tenants.name,
        tenantPlan: tenants.plan,
        tenantBillingStatus: tenants.billingStatus,
        tenantStatus: tenants.status,
      })
      .from(tenantZapiInstances)
      .leftJoin(tenants, eq(tenantZapiInstances.tenantId, tenants.id))
      .orderBy(sql`${tenantZapiInstances.createdAt} DESC`);

    // Get WhatsApp session status for each instance
    const sessionsMap = new Map<string, string>();
    const sessions = await db
      .select({
        providerInstanceId: whatsappSessions.providerInstanceId,
        status: whatsappSessions.status,
        phoneNumber: whatsappSessions.phoneNumber,
        pushName: whatsappSessions.pushName,
      })
      .from(whatsappSessions)
      .where(eq(whatsappSessions.provider, "zapi"));

    for (const s of sessions) {
      if (s.providerInstanceId) {
        sessionsMap.set(s.providerInstanceId, JSON.stringify({
          status: s.status,
          phoneNumber: s.phoneNumber,
          pushName: s.pushName,
        }));
      }
    }

    return instances.map((inst) => {
      const sessionData = inst.zapiInstanceId ? sessionsMap.get(inst.zapiInstanceId) : null;
      const parsed = sessionData ? JSON.parse(sessionData) : null;
      return {
        ...inst,
        whatsappStatus: parsed?.status || "unknown",
        whatsappPhone: parsed?.phoneNumber || null,
        whatsappPushName: parsed?.pushName || null,
      };
    });
  }),

  /**
   * List tenants that DON'T have a Z-API instance (candidates for manual provisioning)
   */
  listTenantsWithoutZapi: publicProcedure.query(async ({ ctx }) => {
    const cookie = ctx.req?.cookies?.[SAAS_COOKIE];
    const session = cookie ? await verifySaasSession(cookie) : null;
    if (!session || !isSuperAdmin(session.email)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
    }

    const { getDb } = await import("../db");
    const { tenantZapiInstances, tenants } = await import("../../drizzle/schema");
    const { eq, notInArray, sql } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Get tenant IDs that have active Z-API instances
    const activeInstances = await db
      .select({ tenantId: tenantZapiInstances.tenantId })
      .from(tenantZapiInstances)
      .where(eq(tenantZapiInstances.status, "active"));

    const activeTenantIds = activeInstances.map((i) => i.tenantId);

    // Get all active tenants that don't have an active Z-API instance
    const tenantsWithout = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        plan: tenants.plan,
        billingStatus: tenants.billingStatus,
        status: tenants.status,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .where(
        activeTenantIds.length > 0
          ? sql`${tenants.id} NOT IN (${sql.join(activeTenantIds.map(id => sql`${id}`), sql`, `)})`
          : sql`1=1`
      )
      .orderBy(tenants.name);

    return tenantsWithout;
  }),

  /**
   * Manually provision Z-API for a tenant (bypass payment check)
   */
  provisionForTenant: publicProcedure
    .input(z.object({
      tenantId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const cookie = ctx.req?.cookies?.[SAAS_COOKIE];
      const session = cookie ? await verifySaasSession(cookie) : null;
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const { getDb } = await import("../db");
      const { tenants } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get tenant info
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant não encontrado" });
      }

      // Provision Z-API instance
      const { provisionZapiForTenant } = await import("../services/zapiProvisioningService");
      const result = await provisionZapiForTenant(input.tenantId, tenant.name);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Falha ao provisionar Z-API: ${result.error}`,
        });
      }

      console.log(`[ZapiAdmin] Super admin ${session.email} manually provisioned Z-API for tenant ${input.tenantId} (${tenant.name})`);

      return {
        success: true,
        instanceId: result.instanceId,
        alreadyProvisioned: result.alreadyProvisioned,
        tenantName: tenant.name,
      };
    }),

  /**
   * Deprovision (cancel) Z-API for a tenant
   */
  deprovisionForTenant: publicProcedure
    .input(z.object({
      tenantId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const cookie = ctx.req?.cookies?.[SAAS_COOKIE];
      const session = cookie ? await verifySaasSession(cookie) : null;
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const { deprovisionZapiForTenant } = await import("../services/zapiProvisioningService");
      const result = await deprovisionZapiForTenant(input.tenantId);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Falha ao revogar Z-API: ${result.error}`,
        });
      }

      console.log(`[ZapiAdmin] Super admin ${session.email} deprovisioned Z-API for tenant ${input.tenantId}`);

      return { success: true };
    }),

  /**
   * Check real-time connection status of a Z-API instance via API
   */
  checkInstanceStatus: publicProcedure
    .input(z.object({
      zapiInstanceId: z.string(),
      zapiToken: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const cookie = ctx.req?.cookies?.[SAAS_COOKIE];
      const session = cookie ? await verifySaasSession(cookie) : null;
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (clientToken) {
          headers["Client-Token"] = clientToken;
        }

        const res = await fetch(
          `https://api.z-api.io/instances/${input.zapiInstanceId}/token/${input.zapiToken}/status`,
          { headers, signal: AbortSignal.timeout(10000) }
        );

        if (!res.ok) {
          return { connected: false, error: `HTTP ${res.status}`, phone: null };
        }

        const data = await res.json();
        return {
          connected: data.connected === true,
          phone: data.smartphoneConnected ? data.phoneNumber || null : null,
          smartphoneConnected: data.smartphoneConnected || false,
          error: null,
        };
      } catch (err: any) {
        return { connected: false, error: err.message, phone: null };
      }
    }),

  /**
   * List alerts (unresolved by default)
   */
  listAlerts: publicProcedure
    .input(z.object({
      resolved: z.boolean().optional().default(false),
      type: z.enum(["disconnected", "billing_overdue", "instance_error"]).optional(),
      limit: z.number().optional().default(50),
    }).optional())
    .query(async ({ input, ctx }) => {
      const cookie = ctx.req?.cookies?.[SAAS_COOKIE];
      const session = cookie ? await verifySaasSession(cookie) : null;
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const { getDb } = await import("../db");
      const { zapiAdminAlerts } = await import("../../drizzle/schema");
      const { eq, and, sql, desc } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const filters = [eq(zapiAdminAlerts.resolved, input?.resolved ?? false)];
      if (input?.type) {
        filters.push(eq(zapiAdminAlerts.type, input.type));
      }

      const alerts = await db
        .select()
        .from(zapiAdminAlerts)
        .where(and(...filters))
        .orderBy(desc(zapiAdminAlerts.createdAt))
        .limit(input?.limit ?? 50);

      return alerts;
    }),

  /**
   * Get alert counts by type and severity
   */
  getAlertCounts: publicProcedure.query(async ({ ctx }) => {
    const cookie = ctx.req?.cookies?.[SAAS_COOKIE];
    const session = cookie ? await verifySaasSession(cookie) : null;
    if (!session || !isSuperAdmin(session.email)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
    }

    const { getAlertCounts } = await import("../services/zapiAlertService");
    return await getAlertCounts();
  }),

  /**
   * Resolve a single alert
   */
  resolveAlert: publicProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const cookie = ctx.req?.cookies?.[SAAS_COOKIE];
      const session = cookie ? await verifySaasSession(cookie) : null;
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const { resolveAlert } = await import("../services/zapiAlertService");
      const success = await resolveAlert(input.alertId, session.email);
      if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao resolver alerta" });

      console.log(`[ZapiAdmin] Alert ${input.alertId} resolved by ${session.email}`);
      return { success: true };
    }),

  /**
   * Resolve all alerts for a tenant
   */
  resolveAllForTenant: publicProcedure
    .input(z.object({ tenantId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const cookie = ctx.req?.cookies?.[SAAS_COOKIE];
      const session = cookie ? await verifySaasSession(cookie) : null;
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const { resolveAllAlertsForTenant } = await import("../services/zapiAlertService");
      const count = await resolveAllAlertsForTenant(input.tenantId, session.email);

      console.log(`[ZapiAdmin] ${count} alerts resolved for tenant ${input.tenantId} by ${session.email}`);
      return { success: true, resolved: count };
    }),

  /**
   * Manually trigger an alert check (for testing/immediate check)
   */
  runAlertCheck: publicProcedure.mutation(async ({ ctx }) => {
    const cookie = ctx.req?.cookies?.[SAAS_COOKIE];
    const session = cookie ? await verifySaasSession(cookie) : null;
    if (!session || !isSuperAdmin(session.email)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
    }

    const { runZapiAlertCheck } = await import("../services/zapiAlertService");
    const result = await runZapiAlertCheck();

    console.log(`[ZapiAdmin] Manual alert check triggered by ${session.email}: ${JSON.stringify(result)}`);
    return result;
  }),

  /**
   * Get summary stats for the Z-API admin dashboard
   */
  getStats: publicProcedure.query(async ({ ctx }) => {
    const cookie = ctx.req?.cookies?.[SAAS_COOKIE];
    const session = cookie ? await verifySaasSession(cookie) : null;
    if (!session || !isSuperAdmin(session.email)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
    }

    const { getDb } = await import("../db");
    const { tenantZapiInstances, whatsappSessions } = await import("../../drizzle/schema");
    const { eq, sql, and } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const [activeCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tenantZapiInstances)
      .where(eq(tenantZapiInstances.status, "active"));

    const [cancelledCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tenantZapiInstances)
      .where(eq(tenantZapiInstances.status, "cancelled"));

    const [pendingCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tenantZapiInstances)
      .where(eq(tenantZapiInstances.status, "pending"));

    const [connectedCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(whatsappSessions)
      .where(
        and(
          eq(whatsappSessions.provider, "zapi"),
          eq(whatsappSessions.status, "connected")
        )
      );

    return {
      active: Number(activeCount?.count || 0),
      cancelled: Number(cancelledCount?.count || 0),
      pending: Number(pendingCount?.count || 0),
      connected: Number(connectedCount?.count || 0),
    };
  }),
});
