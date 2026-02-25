import { TRPCError } from "@trpc/server";
import { AuthContext, hasPermission } from "./authContext";

export function requirePermission(ctx: AuthContext, permission: string): void {
  if (!hasPermission(ctx, permission)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Permissão negada: ${permission}`,
    });
  }
}

export function requireTenantAccess(ctx: AuthContext, tenantId: number): void {
  if (ctx.tenantId !== tenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso negado: tenant inválido",
    });
  }
}

export function requireRole(ctx: AuthContext, ...allowedRoles: string[]): void {
  if (!allowedRoles.includes(ctx.roleSlug)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Cargo requerido: ${allowedRoles.join(" ou ")}`,
    });
  }
}
