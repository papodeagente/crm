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
  listTenantUsersAdmin,
  updateUserStatusAdmin,
  deleteTenantCompletely,
  SAAS_COOKIE,
  SESSION_DURATION_MS,
  requestPasswordReset,
  resetPasswordWithToken,
  inviteUserToTenant,
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

    // Fetch avatarUrl from DB (not stored in JWT)
    let avatarUrl: string | null = null;
    try {
      const { getDb } = await import("../db");
      const { crmUsers } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const [user] = await db.select({ avatarUrl: crmUsers.avatarUrl }).from(crmUsers).where(eq(crmUsers.id, session.userId)).limit(1);
        if (user) avatarUrl = user.avatarUrl;
      }
    } catch (e) {
      // Silently ignore — avatarUrl is optional
    }

    return {
      ...session,
      avatarUrl,
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

  // ─── REQUEST PASSWORD RESET ───
  requestPasswordReset: publicProcedure
    .input(z.object({
      email: z.string().email("Email inválido"),
      origin: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        // requestPasswordReset imported statically at top
        await requestPasswordReset(input.email, input.origin);
      } catch (e) {
        // Always return success to prevent email enumeration
        console.error("[PasswordReset] Error:", e);
      }
      return { success: true, message: "Se o email existir, você receberá um link de redefinição." };
    }),

  // ─── RESET PASSWORD ───
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      newPassword: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    }))
    .mutation(async ({ input }) => {
      // resetPasswordWithToken imported statically at top
      const result = await resetPasswordWithToken(input.token, input.newPassword);
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error || "Token inválido ou expirado" });
      }
      return { success: true };
    }),

  // ─── INVITE USER (send email) ───
  inviteUser: publicProcedure
    .input(z.object({
      tenantId: z.number(),
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      role: z.enum(["admin", "user"]).default("user"),
      origin: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify caller is authenticated and is admin
      const cookies = parseCookies(ctx.req.headers.cookie);
      const token = cookies.get(SAAS_COOKIE);
      const session = await verifySaasSession(token);
      if (!session) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Não autenticado" });
      }
      if (session.role !== "admin" && !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem convidar usuários" });
      }
      // inviteUserToTenant imported statically at top
      const result = await inviteUserToTenant({
        tenantId: input.tenantId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        inviterName: session.name,
        origin: input.origin,
      });
      return result;
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

  // List users for a tenant (superadmin only)
  adminListTenantUsers: publicProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ ctx, input }) => {
      const cookies = parseCookies(ctx.req.headers.cookie);
      const token = cookies.get(SAAS_COOKIE);
      const session = await verifySaasSession(token);
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return listTenantUsersAdmin(input.tenantId);
    }),

  // Update user status (superadmin only)
  adminUpdateUserStatus: publicProcedure
    .input(z.object({
      userId: z.number(),
      status: z.enum(["active", "inactive"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const cookies = parseCookies(ctx.req.headers.cookie);
      const token = cookies.get(SAAS_COOKIE);
      const session = await verifySaasSession(token);
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return updateUserStatusAdmin(input.userId, input.status);
    }),

  // Delete tenant completely (superadmin only)
  adminDeleteTenant: publicProcedure
    .input(z.object({
      tenantId: z.number().min(1),
      confirmName: z.string().min(1, "Confirme o nome da agência"),
    }))
    .mutation(async ({ ctx, input }) => {
      const cookies = parseCookies(ctx.req.headers.cookie);
      const token = cookies.get(SAAS_COOKIE);
      const session = await verifySaasSession(token);
      if (!session || !isSuperAdmin(session.email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      // Verify tenant exists and name matches
      const { getDb } = await import("../db");
      const { tenants } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, input.tenantId)).limit(1);
      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Agência não encontrada" });
      }
      if (tenant.name.toLowerCase() !== input.confirmName.toLowerCase()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nome da agência não confere. Exclusão cancelada." });
      }
      // Prevent deleting the root tenant "Entur" — the only protected tenant
      if (tenant.name.toLowerCase() === "entur") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "O tenant 'Entur' é o tenant raiz e não pode ser excluído." });
      }
      const result = await deleteTenantCompletely(input.tenantId);
      if (!result.success) {
        console.error(`[SuperAdmin] Tenant ${input.tenantId} deletion had errors:`, result.errors);
      }
      return result;
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
