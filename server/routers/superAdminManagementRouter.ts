/**
 * Super Admin Management Router
 * Gerenciamento de super admins: listar, adicionar, remover.
 * bruno@entur.com.br é protegido contra qualquer tipo de exclusão.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { verifySaasSession, isSuperAdminAsync, SAAS_COOKIE } from "../saasAuth";
import { getDb } from "../db";
import { crmUsers as users, tenants } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

const PROTECTED_EMAIL = "bruno@entur.com.br";

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  cookieHeader.split(";").forEach((cookie) => {
    const [key, ...vals] = cookie.trim().split("=");
    if (key) map.set(key.trim(), vals.join("=").trim());
  });
  return map;
}

async function requireSuperAdmin(ctx: any) {
  const cookies = parseCookies(ctx.req?.headers?.cookie);
  const token = cookies.get(SAAS_COOKIE);
  const session = token ? await verifySaasSession(token) : null;
  if (!session || !(await isSuperAdminAsync(session.email))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
  }
  return session;
}

export const superAdminManagementRouter = router({
  /**
   * Listar todos os super admins
   */
  list: publicProcedure.query(async ({ ctx }) => {
    await requireSuperAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

    const superAdmins = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isSuperAdmin: users.isSuperAdmin,
        createdAt: users.createdAt,
        lastSignedIn: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.isSuperAdmin, true))
      .orderBy(users.createdAt);

    return superAdmins.map((u) => ({
      ...u,
      isProtected: u.email?.toLowerCase() === PROTECTED_EMAIL,
    }));
  }),

  /**
   * Buscar usuário por email para adicionar como super admin
   */
  searchByEmail: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      await requireSuperAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          isSuperAdmin: users.isSuperAdmin,
        })
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      return user || null;
    }),

  /**
   * Promover um usuário a super admin
   */
  promote: publicProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireSuperAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      // Buscar o usuário
      const [user] = await db
        .select({ id: users.id, email: users.email, name: users.name, isSuperAdmin: users.isSuperAdmin })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
      }

      if (user.isSuperAdmin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário já é super admin" });
      }

      await db
        .update(users)
        .set({ isSuperAdmin: true })
        .where(eq(users.id, input.userId));

      console.log(`[SuperAdmin] ${session.email} promoveu ${user.email} a super admin`);

      return { success: true, email: user.email, name: user.name };
    }),

  /**
   * Promover por email (caso o usuário não exista ainda no sistema, apenas busca)
   */
  promoteByEmail: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireSuperAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      const emailLower = input.email.toLowerCase();

      // Buscar o usuário pelo email
      const [user] = await db
        .select({ id: users.id, email: users.email, name: users.name, isSuperAdmin: users.isSuperAdmin })
        .from(users)
        .where(eq(users.email, emailLower))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuário não encontrado. O usuário precisa ter feito login pelo menos uma vez no sistema.",
        });
      }

      if (user.isSuperAdmin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário já é super admin" });
      }

      await db
        .update(users)
        .set({ isSuperAdmin: true })
        .where(eq(users.id, user.id));

      console.log(`[SuperAdmin] ${session.email} promoveu ${user.email} a super admin via email`);

      return { success: true, email: user.email, name: user.name };
    }),

  /**
   * Remover super admin (rebaixar)
   */
  demote: publicProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireSuperAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      // Buscar o usuário
      const [user] = await db
        .select({ id: users.id, email: users.email, name: users.name, isSuperAdmin: users.isSuperAdmin })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
      }

      // Proteção: bruno@entur.com.br não pode ser removido
      if (user.email?.toLowerCase() === PROTECTED_EMAIL) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Este super admin é protegido e não pode ser removido.",
        });
      }

      if (!user.isSuperAdmin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário não é super admin" });
      }

      // Não permitir auto-remoção
      if (user.email?.toLowerCase() === session.email.toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não pode remover a si mesmo como super admin.",
        });
      }

      await db
        .update(users)
        .set({ isSuperAdmin: false })
        .where(eq(users.id, input.userId));

      console.log(`[SuperAdmin] ${session.email} removeu ${user.email} de super admin`);

      return { success: true, email: user.email, name: user.name };
    }),

  /**
   * Lista de tenants (id + name) para o seletor.
   */
  listTenants: publicProcedure.query(async ({ ctx }) => {
    await requireSuperAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
    return db.select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
      .from(tenants)
      .orderBy(tenants.id);
  }),

  /**
   * Cria usuário diretamente em qualquer tenant — bypassa o fluxo de
   * convite/email. Útil para suporte: senha já definida, status active.
   */
  createUserInTenant: publicProcedure
    .input(z.object({
      tenantId: z.number().int(),
      name: z.string().min(1).max(255),
      email: z.string().email(),
      password: z.string().min(8).max(128),
      role: z.enum(["admin", "user"]).default("admin"),
      phone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireSuperAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      const emailLower = input.email.toLowerCase();

      // Tenant existe?
      const [tenant] = await db.select({ id: tenants.id, name: tenants.name }).from(tenants).where(eq(tenants.id, input.tenantId)).limit(1);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant não encontrado" });

      // Email já existe nesse tenant?
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, input.tenantId), eq(users.email, emailLower)))
        .limit(1);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Esse email já está cadastrado nesse tenant" });
      }

      const { hashPassword } = await import("../saasAuth");
      const passwordHash = await hashPassword(input.password);

      const [created] = await db.insert(users).values({
        tenantId: input.tenantId,
        name: input.name,
        email: emailLower,
        phone: input.phone || null,
        passwordHash,
        role: input.role,
        status: "active",
      }).returning({ id: users.id, email: users.email, role: users.role });

      console.log(`[SuperAdmin] ${session.email} criou usuário ${created.email} (role=${created.role}) no tenant ${tenant.id} (${tenant.name})`);
      return { success: true, userId: created.id, email: created.email, tenantId: tenant.id, tenantName: tenant.name };
    }),

  /**
   * Reset manual de senha de qualquer usuário em qualquer tenant.
   * Apenas Super Admin. Audit log via console (depois pode virar tabela).
   */
  resetUserPassword: publicProcedure
    .input(z.object({
      email: z.string().email(),
      newPassword: z.string().min(8).max(128),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireSuperAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      const emailLower = input.email.toLowerCase();
      const [user] = await db
        .select({ id: users.id, email: users.email, name: users.name, tenantId: users.tenantId })
        .from(users)
        .where(eq(users.email, emailLower))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuário não encontrado com esse email.",
        });
      }

      const { hashPassword } = await import("../saasAuth");
      const passwordHash = await hashPassword(input.newPassword);
      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() } as any)
        .where(eq(users.id, user.id));

      console.log(`[SuperAdmin] ${session.email} resetou senha de ${user.email} (tenant ${user.tenantId})`);
      return { success: true, email: user.email, name: user.name, tenantId: user.tenantId };
    }),

  /**
   * Contagem de super admins
   */
  count: publicProcedure.query(async ({ ctx }) => {
    await requireSuperAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(eq(users.isSuperAdmin, true));

    return { count: result?.count ?? 0 };
  }),
});
