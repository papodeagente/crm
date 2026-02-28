import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  registerTenantAndUser,
  loginWithEmail,
  createSaasSessionToken,
  verifySaasSession,
  checkTenantAccess,
  isSuperAdmin,
  listAllTenantsAdmin,
  updateFreemiumPeriod,
  updateTenantPlan,
  SAAS_COOKIE,
  SESSION_DURATION_MS,
} from "../saasAuth";
import { getSessionCookieOptions } from "../_core/cookies";

export const saasAuthRouter = router({
  // ─── REGISTER ───
  register: publicProcedure
    .input(z.object({
      companyName: z.string().min(2, "Nome da empresa deve ter pelo menos 2 caracteres"),
      userName: z.string().min(2, "Seu nome deve ter pelo menos 2 caracteres"),
      email: z.string().email("Email inválido"),
      password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      phone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await registerTenantAndUser(input);
        
        // Create session token
        const token = await createSaasSessionToken({
          userId: result.userId,
          tenantId: result.tenantId,
          email: result.email,
          name: result.name,
          role: "admin",
        });

        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(SAAS_COOKIE, token, {
          ...cookieOptions,
          maxAge: SESSION_DURATION_MS,
        });

        return {
          success: true,
          userId: result.userId,
          tenantId: result.tenantId,
        };
      } catch (error: any) {
        if (error.message === "EMAIL_EXISTS") {
          throw new TRPCError({ code: "CONFLICT", message: "Este email já está cadastrado" });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao criar conta" });
      }
    }),

  // ─── LOGIN ───
  login: publicProcedure
    .input(z.object({
      email: z.string().email("Email inválido"),
      password: z.string().min(1, "Senha é obrigatória"),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await loginWithEmail(input.email, input.password);

        // Create session token
        const token = await createSaasSessionToken({
          userId: result.userId,
          tenantId: result.tenantId,
          email: result.email,
          name: result.name,
          role: result.role,
        });

        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(SAAS_COOKIE, token, {
          ...cookieOptions,
          maxAge: SESSION_DURATION_MS,
        });

        return {
          success: true,
          userId: result.userId,
          tenantId: result.tenantId,
          tenant: result.tenant,
        };
      } catch (error: any) {
        if (error.message === "INVALID_CREDENTIALS") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha incorretos" });
        }
        if (error.message === "ACCOUNT_INACTIVE") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Conta desativada. Entre em contato com o suporte." });
        }
        if (error.message === "SUBSCRIPTION_EXPIRED") {
          throw new TRPCError({ code: "FORBIDDEN", message: "SUBSCRIPTION_EXPIRED" });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao fazer login" });
      }
    }),

  // ─── ME (current SaaS session) ───
  me: publicProcedure.query(async ({ ctx }) => {
    const cookies = parseCookies(ctx.req.headers.cookie);
    const token = cookies.get(SAAS_COOKIE);
    const session = await verifySaasSession(token);
    if (!session) return null;

    // Check tenant access
    const access = await checkTenantAccess(session.tenantId);

    return {
      ...session,
      isSuperAdmin: isSuperAdmin(session.email),
      access,
    };
  }),

  // ─── LOGOUT ───
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(SAAS_COOKIE, cookieOptions);
    return { success: true };
  }),

  // ─── CHECK ACCESS ───
  checkAccess: publicProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return checkTenantAccess(input.tenantId);
    }),

  // ═══════════════════════════════════════
  // SUPERADMIN ROUTES
  // ═══════════════════════════════════════

  // List all tenants (superadmin only)
  adminListTenants: publicProcedure.query(async ({ ctx }) => {
    const cookies = parseCookies(ctx.req.headers.cookie);
    const token = cookies.get(SAAS_COOKIE);
    const session = await verifySaasSession(token);
    if (!session || !isSuperAdmin(session.email)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
    }
    return listAllTenantsAdmin();
  }),

  // Update freemium period (superadmin only)
  adminUpdateFreemium: publicProcedure
    .input(z.object({
      tenantId: z.number(),
      days: z.number().min(7, "Mínimo de 7 dias"),
    }))
    .mutation(async ({ ctx, input }) => {
      const cookies = parseCookies(ctx.req.headers.cookie);
      const token = cookies.get(SAAS_COOKIE);
      const session = await verifySaasSession(token);
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return updateFreemiumPeriod(input.tenantId, input.days);
    }),

  // Update tenant plan (superadmin only)
  adminUpdatePlan: publicProcedure
    .input(z.object({
      tenantId: z.number(),
      plan: z.enum(["free", "pro", "enterprise"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const cookies = parseCookies(ctx.req.headers.cookie);
      const token = cookies.get(SAAS_COOKIE);
      const session = await verifySaasSession(token);
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return updateTenantPlan(input.tenantId, input.plan);
    }),

  // Suspend/Activate tenant (superadmin only)
  adminToggleTenantStatus: publicProcedure
    .input(z.object({
      tenantId: z.number(),
      status: z.enum(["active", "suspended", "cancelled"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const cookies = parseCookies(ctx.req.headers.cookie);
      const token = cookies.get(SAAS_COOKIE);
      const session = await verifySaasSession(token);
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      const { getDb } = await import("../db");
      const { tenants } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(tenants).set({ status: input.status }).where(eq(tenants.id, input.tenantId));
      return { success: true };
    }),
});

// Helper to parse cookies
function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  cookieHeader.split(";").forEach((cookie) => {
    const [key, ...vals] = cookie.trim().split("=");
    if (key) map.set(key.trim(), vals.join("=").trim());
  });
  return map;
}
