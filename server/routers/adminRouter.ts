import { z } from "zod";
import { tenantProcedure, getTenantId, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as crm from "../crmDb";
import { emitEvent } from "../middleware/eventLog";
import { inviteUserToTenant } from "../saasAuth";
import { runDbRepair } from "../dbRepair";
import { reprocessStuckTranscriptions } from "../audioTranscriptionWorker";

export const adminRouter = router({
  // ─── TENANTS ───
  tenants: router({
    list: tenantProcedure.query(async () => {
      return crm.listTenants();
    }),
    create: tenantProcedure
      .input(z.object({ name: z.string().min(1), plan: z.enum(["free", "pro", "enterprise"]).optional() }))
      .mutation(async ({ input, ctx }) => {
        const result = await crm.createTenant({ ...input });
        return result;
      }),
    get: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return crm.getTenantById(input.id);
      }),
  }),

  // ─── CRM USERS ───
  users: router({
    list: tenantProcedure
      
      .query(async ({ input, ctx }) => {
        return crm.listCrmUsers(getTenantId(ctx));
      }),
    create: tenantProcedure
      .input(z.object({ name: z.string().min(1), email: z.string().email(), phone: z.string().optional(), role: z.enum(["admin", "user"]).default("user"), origin: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        // Only admins can create users
        if (ctx.saasUser?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem adicionar usuários" });
        }
        // Use inviteUserToTenant to create user + send invite email
        try {
          // inviteUserToTenant imported statically at top of file
          const result = await inviteUserToTenant({
            tenantId: getTenantId(ctx),
            name: input.name,
            email: input.email,
            phone: input.phone,
            role: input.role,
            inviterName: ctx.user.name || "Administrador",
            origin: input.origin || "https://crm.acelerador.tur.br",
          });
          await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "crm_user", entityId: result?.userId, action: "create" });
          return { id: result.userId };
        } catch (error: any) {
          if (error.message === "EMAIL_EXISTS_IN_TENANT") {
            throw new TRPCError({ code: "CONFLICT", message: "Este email já está cadastrado neste tenant" });
          }
          // Fallback: create without email if email service fails
          const result = await crm.createCrmUser({ ...input, tenantId: getTenantId(ctx), createdBy: ctx.user.id });
          await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "crm_user", entityId: result?.id, action: "create" });
          return result;
        }
      }),
    get: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return crm.getCrmUserById(getTenantId(ctx), input.id);
      }),
    update: tenantProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), email: z.string().email().optional(), phone: z.string().optional(), role: z.enum(["admin", "user"]).optional(), status: z.enum(["active", "inactive", "invited"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        // Only admins can update users
        if (ctx.saasUser?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem editar usuários" });
        }
const tenantId = getTenantId(ctx); const { id, role, ...data } = input;
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
    delete: tenantProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await crm.deleteCrmUser(getTenantId(ctx), input.id);
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "crm_user", entityId: input.id, action: "delete" });
        return { success: true };
      }),
  }),

  // ─── TEAMS ───
  teams: router({
    list: tenantProcedure
      
      .query(async ({ input, ctx }) => {
        return crm.listTeams(getTenantId(ctx));
      }),
    create: tenantProcedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createTeam({ ...input, tenantId: getTenantId(ctx) });
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "team", entityId: result?.id, action: "create" });
        return result;
      }),
    members: tenantProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input, ctx }) => {
        return crm.getTeamMembers(getTenantId(ctx), input.teamId);
      }),
    addMember: tenantProcedure
      .input(z.object({ teamId: z.number(), userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await crm.addTeamMember({ ...input, tenantId: getTenantId(ctx) });
        return { success: true };
      }),
    removeMember: tenantProcedure
      .input(z.object({ teamId: z.number(), userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await crm.removeTeamMember(getTenantId(ctx), input.userId, input.teamId);
        return { success: true };
      }),
  }),

  // ─── ROLES & PERMISSIONS ───
  roles: router({
    list: tenantProcedure
      
      .query(async ({ input, ctx }) => {
        return crm.listRoles(getTenantId(ctx));
      }),
    create: tenantProcedure
      .input(z.object({ slug: z.string(), name: z.string(), description: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        return crm.createRole({ ...input, tenantId: getTenantId(ctx) });
      }),
    assign: tenantProcedure
      .input(z.object({ userId: z.number(), roleId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await crm.assignRole({ ...input, tenantId: getTenantId(ctx) });
        return { success: true };
      }),
    permissions: tenantProcedure.query(async () => {
      return crm.listPermissions();
    }),
    assignPermission: tenantProcedure
      .input(z.object({ roleId: z.number(), permissionId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await crm.assignPermissionToRole({ ...input, tenantId: getTenantId(ctx) });
        return { success: true };
      }),
  }),

  // ─── EVENT LOG / AUDITORIA ───
  eventLog: router({
    list: tenantProcedure
      .input(z.object({ entityType: z.string().optional(), entityId: z.number().optional(), limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input, ctx }) => {
        return crm.listEventLog(getTenantId(ctx), input);
      }),
  }),

  // ─── DB REPAIR ───
  dbRepair: tenantProcedure
    .mutation(async ({ ctx }) => {
      // Only allow owner (admin) to run repair
      if (ctx.saasUser?.role !== "admin" && ctx.user.openId !== process.env.OWNER_OPEN_ID) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem executar reparos" });
      }
      return runDbRepair();
    }),
  // ─── REPROCESS STUCK TRANSCRIPTIONS ───
  reprocessTranscriptions: tenantProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.saasUser?.role !== "admin" && ctx.user.openId !== process.env.OWNER_OPEN_ID) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem reprocessar transcrições" });
      }
      return reprocessStuckTranscriptions(getTenantId(ctx));
    }),
});
