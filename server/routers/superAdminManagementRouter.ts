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
import { users } from "../../drizzle/schema";
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
        lastSignedIn: users.lastSignedIn,
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
