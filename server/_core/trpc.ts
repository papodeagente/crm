import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
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
