import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as crm from "../crmDb";
import { emitEvent } from "../middleware/eventLog";

export const adminRouter = router({
  // ─── TENANTS ───
  tenants: router({
    list: protectedProcedure.query(async () => {
      return crm.listTenants();
    }),
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1), plan: z.enum(["free", "pro", "enterprise"]).optional() }))
      .mutation(async ({ input }) => {
        const result = await crm.createTenant(input);
        return result;
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return crm.getTenantById(input.id);
      }),
  }),

  // ─── CRM USERS ───
  users: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return crm.listCrmUsers(input.tenantId);
      }),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), name: z.string().min(1), email: z.string().email(), phone: z.string().optional(), role: z.enum(["admin", "user"]).default("user"), origin: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        // Only admins can create users
        if (ctx.saasUser?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem adicionar usuários" });
        }
        // Use inviteUserToTenant to create user + send invite email
        try {
          const { inviteUserToTenant } = await import("../saasAuth");
          const result = await inviteUserToTenant({
            tenantId: input.tenantId,
            name: input.name,
            email: input.email,
            phone: input.phone,
            role: input.role,
            inviterName: ctx.user.name || "Administrador",
            origin: input.origin || "https://crm.acelerador.tur.br",
          });
          await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "crm_user", entityId: result?.userId, action: "create" });
          return { id: result.userId };
        } catch (error: any) {
          if (error.message === "EMAIL_EXISTS_IN_TENANT") {
            throw new TRPCError({ code: "CONFLICT", message: "Este email já está cadastrado neste tenant" });
          }
          // Fallback: create without email if email service fails
          const result = await crm.createCrmUser({ ...input, createdBy: ctx.user.id });
          await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "crm_user", entityId: result?.id, action: "create" });
          return result;
        }
      }),
    get: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .query(async ({ input }) => {
        return crm.getCrmUserById(input.tenantId, input.id);
      }),
    update: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number(), name: z.string().optional(), email: z.string().email().optional(), phone: z.string().optional(), role: z.enum(["admin", "user"]).optional(), status: z.enum(["active", "inactive", "invited"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        // Only admins can update users
        if (ctx.saasUser?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem editar usuários" });
        }
        const { tenantId, id, role, ...data } = input;
        // Update user fields
        await crm.updateCrmUser(tenantId, id, { ...data, updatedBy: ctx.user.id });
        // Update role if provided (via direct SQL since crmDb may not support it)
        if (role) {
          const { getDb } = await import("../db");
          const { crmUsers } = await import("../../drizzle/schema");
          const { eq, and } = await import("drizzle-orm");
          const db = await getDb();
          if (db) {
            await db.update(crmUsers).set({ role }).where(and(eq(crmUsers.id, id), eq(crmUsers.tenantId, tenantId)));
          }
        }
        await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "crm_user", entityId: id, action: "update" });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await crm.deleteCrmUser(input.tenantId, input.id);
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "crm_user", entityId: input.id, action: "delete" });
        return { success: true };
      }),
  }),

  // ─── TEAMS ───
  teams: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return crm.listTeams(input.tenantId);
      }),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), name: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createTeam(input);
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "team", entityId: result?.id, action: "create" });
        return result;
      }),
    members: protectedProcedure
      .input(z.object({ tenantId: z.number(), teamId: z.number() }))
      .query(async ({ input }) => {
        return crm.getTeamMembers(input.tenantId, input.teamId);
      }),
    addMember: protectedProcedure
      .input(z.object({ tenantId: z.number(), teamId: z.number(), userId: z.number() }))
      .mutation(async ({ input }) => {
        await crm.addTeamMember(input);
        return { success: true };
      }),
    removeMember: protectedProcedure
      .input(z.object({ tenantId: z.number(), teamId: z.number(), userId: z.number() }))
      .mutation(async ({ input }) => {
        await crm.removeTeamMember(input.tenantId, input.userId, input.teamId);
        return { success: true };
      }),
  }),

  // ─── ROLES & PERMISSIONS ───
  roles: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return crm.listRoles(input.tenantId);
      }),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), slug: z.string(), name: z.string(), description: z.string().optional() }))
      .mutation(async ({ input }) => {
        return crm.createRole(input);
      }),
    assign: protectedProcedure
      .input(z.object({ tenantId: z.number(), userId: z.number(), roleId: z.number() }))
      .mutation(async ({ input }) => {
        await crm.assignRole(input);
        return { success: true };
      }),
    permissions: protectedProcedure.query(async () => {
      return crm.listPermissions();
    }),
    assignPermission: protectedProcedure
      .input(z.object({ tenantId: z.number(), roleId: z.number(), permissionId: z.number() }))
      .mutation(async ({ input }) => {
        await crm.assignPermissionToRole(input);
        return { success: true };
      }),
  }),

  // ─── EVENT LOG / AUDITORIA ───
  eventLog: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), entityType: z.string().optional(), entityId: z.number().optional(), limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return crm.listEventLog(input.tenantId, input);
      }),
  }),
});
