import { getDb } from "../db";
import { crmUsers, userRoles, roles, rolePermissions, permissions, teamMembers } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface AuthContext {
  tenantId: number;
  userId: number;
  roleId: number;
  roleSlug: string;
  permissions: string[];
  scope: "personal" | "team" | "branch" | "global";
  teamIds: number[];
  branchId: number | null;
  locale: string;
  timezone: string;
  ipAddress: string;
  userAgent: string;
}

export async function buildAuthContext(
  tenantId: number,
  crmUserId: number,
  req?: { ip?: string; headers?: Record<string, any> }
): Promise<AuthContext | null> {
  const db = await getDb();
  if (!db) return null;

  // Get user
  const user = await db.select().from(crmUsers)
    .where(and(eq(crmUsers.id, crmUserId), eq(crmUsers.tenantId, tenantId)))
    .limit(1);
  if (!user.length) return null;

  // Get user roles
  const userRoleRows = await db.select().from(userRoles)
    .where(and(eq(userRoles.userId, crmUserId), eq(userRoles.tenantId, tenantId)));

  let roleSlug = "user";
  let roleId = 0;
  let scope: AuthContext["scope"] = "personal";

  if (userRoleRows.length > 0) {
    const roleRow = await db.select().from(roles)
      .where(eq(roles.id, userRoleRows[0].roleId))
      .limit(1);
    if (roleRow.length) {
      roleSlug = roleRow[0].slug;
      roleId = roleRow[0].id;
      if (roleSlug === "admin") scope = "global";
      else if (roleSlug === "manager") scope = "team";
      else scope = "personal";
    }
  }

  // Get permissions
  const roleIds = userRoleRows.map(r => r.roleId);
  let permKeys: string[] = [];
  if (roleIds.length > 0) {
    const rpRows = await db.select().from(rolePermissions)
      .where(and(
        eq(rolePermissions.tenantId, tenantId),
        inArray(rolePermissions.roleId, roleIds)
      ));
    const permIds = rpRows.map(rp => rp.permissionId);
    if (permIds.length > 0) {
      const permRows = await db.select().from(permissions)
        .where(inArray(permissions.id, permIds));
      permKeys = permRows.map(p => p.key);
    }
  }

  // Get team memberships
  const teamRows = await db.select().from(teamMembers)
    .where(and(eq(teamMembers.userId, crmUserId), eq(teamMembers.tenantId, tenantId)));
  const teamIds = teamRows.map(t => t.teamId);

  return {
    tenantId,
    userId: crmUserId,
    roleId,
    roleSlug,
    permissions: permKeys,
    scope,
    teamIds,
    branchId: null,
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    ipAddress: req?.ip || "0.0.0.0",
    userAgent: req?.headers?.["user-agent"] || "",
  };
}

export function hasPermission(ctx: AuthContext, permission: string): boolean {
  if (ctx.roleSlug === "admin") return true;
  return ctx.permissions.includes(permission);
}

export function canAccessEntity(
  ctx: AuthContext,
  entityTenantId: number,
  entityOwnerUserId?: number | null,
  entityTeamId?: number | null
): boolean {
  if (ctx.tenantId !== entityTenantId) return false;
  if (ctx.scope === "global") return true;
  if (ctx.scope === "team" && entityTeamId && ctx.teamIds.includes(entityTeamId)) return true;
  if (ctx.scope === "personal" && entityOwnerUserId === ctx.userId) return true;
  return ctx.scope === "team" && entityOwnerUserId === ctx.userId;
}
