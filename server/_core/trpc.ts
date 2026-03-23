import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// ─── Presence tracking: update lastActiveAt with 60s debounce ───
const lastActiveCache = new Map<number, number>(); // userId -> lastUpdateTimestamp
const PRESENCE_DEBOUNCE_MS = 60_000; // Only update DB once per minute per user

async function touchPresence(userId: number) {
  const now = Date.now();
  const lastUpdate = lastActiveCache.get(userId) || 0;
  if (now - lastUpdate < PRESENCE_DEBOUNCE_MS) return; // skip if updated recently
  lastActiveCache.set(userId, now);
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (db) {
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`UPDATE crm_users SET lastActiveAt = NOW() WHERE id = ${userId}`);
    }
  } catch (_) { /* non-critical */ }
}

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Track presence (fire-and-forget, non-blocking)
  if (ctx.saasUser?.userId) {
    touchPresence(ctx.saasUser.userId).catch(() => {});
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * Session-protected procedure: validates that the sessionId in the input
 * belongs to the logged-in user before executing the handler.
 * 
 * Access rules:
 * - Platform owner (Manus OAuth, non-SaaS): full access to all sessions
 * - CRM admin: can access any session in their tenant
 * - Regular SaaS user: can ONLY access their own sessions
 * 
 * Usage: Replace `protectedProcedure` with `sessionProtectedProcedure` 
 * on any endpoint that accepts `sessionId` in its input.
 */
const validateSessionMiddleware = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Extract sessionId from input (works for both query and mutation)
  // Use type assertion to access rawInput which exists at runtime but isn't in the TS type
  const rawInput = (opts as any).rawInput as Record<string, unknown> | undefined;
  const sessionId = rawInput?.sessionId as string | undefined;

  if (sessionId) {
    const { validateSessionOwnership } = await import("../db");
    const userId = ctx.saasUser?.userId || ctx.user.id;
    await validateSessionOwnership(sessionId, userId, {
      tenantId: ctx.saasUser?.tenantId,
      role: ctx.saasUser?.role,
      isSaasUser: !!ctx.saasUser,
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const sessionProtectedProcedure = t.procedure.use(validateSessionMiddleware);

/**
 * sessionTenantProcedure: combines tenant isolation + session ownership validation.
 * Use for ALL WhatsApp endpoints that accept sessionId AND need tenant context.
 * 
 * Guarantees:
 * 1. ctx.saasUser exists with valid tenantId (from JWT)
 * 2. ctx.tenantId is injected automatically
 * 3. sessionId in input belongs to the user (or user has admin/share access)
 * 4. Cross-tenant session access is blocked
 */
const requireTenantAndSession = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (!ctx.saasUser || !ctx.saasUser.tenantId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sessão de tenant não encontrada. Faça login novamente.",
    });
  }

  const tenantId = ctx.saasUser.tenantId;

  // Validate session ownership
  const rawInput = (opts as any).rawInput as Record<string, unknown> | undefined;
  const sessionId = rawInput?.sessionId as string | undefined;

  if (sessionId) {
    const { validateSessionOwnership } = await import("../db");
    const userId = ctx.saasUser.userId || ctx.user.id;
    await validateSessionOwnership(sessionId, userId, {
      tenantId,
      role: ctx.saasUser.role,
      isSaasUser: true,
    });
  }

  // Track presence
  touchPresence(ctx.saasUser.userId).catch(() => {});

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      saasUser: ctx.saasUser,
      tenantId,
    },
  });
});

export const sessionTenantProcedure = t.procedure.use(requireTenantAndSession);

/**
 * sessionTenantAdminProcedure: combines session ownership + tenant isolation + admin role check.
 * Use for admin-only WhatsApp endpoints (supervision, chatbot settings).
 */
const requireTenantSessionAndAdmin = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (!ctx.saasUser || !ctx.saasUser.tenantId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sess\u00e3o de tenant n\u00e3o encontrada. Fa\u00e7a login novamente.",
    });
  }

  if (ctx.saasUser.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas administradores podem acessar esta funcionalidade.",
    });
  }

  const tenantId = ctx.saasUser.tenantId;

  // Validate session ownership
  const rawInput = (opts as any).rawInput as Record<string, unknown> | undefined;
  const sessionId = rawInput?.sessionId as string | undefined;

  if (sessionId) {
    const { validateSessionOwnership } = await import("../db");
    const userId = ctx.saasUser.userId || ctx.user.id;
    await validateSessionOwnership(sessionId, userId, {
      tenantId,
      role: ctx.saasUser.role,
      isSaasUser: true,
    });
  }

  touchPresence(ctx.saasUser.userId).catch(() => {});

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      saasUser: ctx.saasUser,
      tenantId,
    },
  });
});

export const sessionTenantAdminProcedure = t.procedure.use(requireTenantSessionAndAdmin);

// ═══════════════════════════════════════════════════════════════════
// TENANT ISOLATION — Guard Rail Central
// ═══════════════════════════════════════════════════════════════════

/**
 * tenantProcedure: middleware obrigatório para TODOS os endpoints que
 * acessam dados de tenant. Garante que:
 * 1. ctx.saasUser existe (throw UNAUTHORIZED se não)
 * 2. ctx.tenantId é injetado automaticamente a partir do JWT
 * 3. Qualquer input.tenantId do cliente é IGNORADO
 * 4. Log de segurança se input.tenantId divergir do JWT
 */
const requireTenant = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (!ctx.saasUser || !ctx.saasUser.tenantId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sessão de tenant não encontrada. Faça login novamente.",
    });
  }

  const tenantId = ctx.saasUser.tenantId;

  // Security log: detect if client tried to send a different tenantId
  const rawInput = (opts as any).rawInput as Record<string, unknown> | undefined;
  if (rawInput?.tenantId && rawInput.tenantId !== tenantId) {
    console.warn(
      `[SECURITY] Tenant mismatch blocked: user=${ctx.saasUser.userId} ` +
      `jwt_tenant=${tenantId} input_tenant=${rawInput.tenantId} ` +
      `path=${(opts as any).path || 'unknown'}`
    );
  }

  // Track presence
  touchPresence(ctx.saasUser.userId).catch(() => {});

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      saasUser: ctx.saasUser,
      tenantId,
    },
  });
});

export const tenantProcedure = t.procedure.use(requireTenant);

/**
 * tenantAdminProcedure: like tenantProcedure but also requires admin role
 */
const requireTenantAdmin = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (!ctx.saasUser || !ctx.saasUser.tenantId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sessão de tenant não encontrada. Faça login novamente.",
    });
  }

  if (ctx.saasUser.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas administradores podem executar esta ação.",
    });
  }

  const tenantId = ctx.saasUser.tenantId;
  touchPresence(ctx.saasUser.userId).catch(() => {});

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      saasUser: ctx.saasUser,
      tenantId,
    },
  });
});

export const tenantAdminProcedure = t.procedure.use(requireTenantAdmin);

/**
 * Helper: extract tenantId safely from context.
 * Use in procedures that already use tenantProcedure.
 * Throws if tenantId is missing (should never happen with tenantProcedure).
 */
export function getTenantId(ctx: any): number {
  const tid = ctx.tenantId ?? ctx.saasUser?.tenantId;
  if (!tid || tid <= 0) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Tenant não identificado.",
    });
  }
  return tid;
}

/**
 * Helper: assert that an entity belongs to the expected tenant.
 * Use after fetching an entity to verify ownership before update/delete.
 */
export function assertTenantOwnership(
  entityTenantId: number | null | undefined,
  expectedTenantId: number,
  entityType: string = "entity",
  entityId?: number | string
): void {
  if (!entityTenantId || entityTenantId !== expectedTenantId) {
    console.warn(
      `[SECURITY] Cross-tenant access blocked: ` +
      `expected_tenant=${expectedTenantId} entity_tenant=${entityTenantId} ` +
      `type=${entityType} id=${entityId || 'unknown'}`
    );
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Acesso negado: ${entityType} não pertence ao seu tenant.`,
    });
  }
}
