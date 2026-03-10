import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { verifySaasSession, SAAS_COOKIE, createSaasSessionToken, SESSION_DURATION_MS } from "../saasAuth";
import { getSessionCookieOptions } from "../_core/cookies";
import { storagePut } from "../storage";

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  cookieHeader.split(";").forEach((cookie) => {
    const [key, ...vals] = cookie.trim().split("=");
    if (key) map.set(key.trim(), vals.join("=").trim());
  });
  return map;
}

async function requireSaasUser(ctx: any) {
  const cookies = parseCookies(ctx.req.headers.cookie);
  const token = cookies.get(SAAS_COOKIE);
  const session = await verifySaasSession(token);
  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Não autenticado" });
  }
  return session;
}

export const profileRouter = router({
  // ─── GET PROFILE ───
  getProfile: publicProcedure.query(async ({ ctx }) => {
    const session = await requireSaasUser(ctx);
    const { getDb } = await import("../db");
    const { crmUsers, googleCalendarTokens } = await import("../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [user] = await db.select({
      id: crmUsers.id,
      name: crmUsers.name,
      email: crmUsers.email,
      phone: crmUsers.phone,
      avatarUrl: crmUsers.avatarUrl,
      role: crmUsers.role,
      createdAt: crmUsers.createdAt,
    }).from(crmUsers).where(eq(crmUsers.id, session.userId)).limit(1);

    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });

    // Check Google Calendar connection status via MCP
    const { checkGoogleCalendarStatus } = await import("../googleCalendarSync");
    const gcStatus = await checkGoogleCalendarStatus();

    // Also check DB for stored connection info
    const [gcToken] = await db.select({
      id: googleCalendarTokens.id,
      calendarEmail: googleCalendarTokens.calendarEmail,
      isActive: googleCalendarTokens.isActive,
      createdAt: googleCalendarTokens.createdAt,
    }).from(googleCalendarTokens)
      .where(and(
        eq(googleCalendarTokens.userId, session.userId),
        eq(googleCalendarTokens.tenantId, session.tenantId),
        eq(googleCalendarTokens.isActive, true),
      ))
      .limit(1);

    return {
      ...user,
      tenantId: session.tenantId,
      googleCalendar: {
        connected: gcStatus.available,
        mcpAvailable: gcStatus.available,
        email: gcToken?.calendarEmail || null,
        connectedAt: gcToken?.createdAt || null,
        message: gcStatus.message,
      },
    };
  }),

  // ─── UPDATE PROFILE (name, phone) ───
  updateProfile: publicProcedure
    .input(z.object({
      name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
      phone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireSaasUser(ctx);
      const { getDb } = await import("../db");
      const { crmUsers } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(crmUsers).set({
        name: input.name,
        phone: input.phone || null,
      }).where(eq(crmUsers.id, session.userId));

      // Refresh the session token with updated name
      const newToken = await createSaasSessionToken({
        userId: session.userId,
        tenantId: session.tenantId,
        email: session.email,
        name: input.name,
        role: session.role,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(SAAS_COOKIE, newToken, {
        ...cookieOptions,
        maxAge: SESSION_DURATION_MS,
      });

      return { success: true };
    }),

  // ─── UPLOAD AVATAR ───
  uploadAvatar: publicProcedure
    .input(z.object({
      base64: z.string().min(1, "Imagem é obrigatória"),
      mimeType: z.string().refine(
        (v) => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(v),
        "Formato de imagem inválido"
      ),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireSaasUser(ctx);
      const { getDb } = await import("../db");
      const { crmUsers } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Decode base64
      const buffer = Buffer.from(input.base64, "base64");

      // Max 5MB
      if (buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Imagem deve ter no máximo 5MB" });
      }

      const ext = input.mimeType.split("/")[1] || "png";
      const suffix = Math.random().toString(36).slice(2, 10);
      const fileKey = `avatars/${session.tenantId}/${session.userId}-${suffix}.${ext}`;

      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      await db.update(crmUsers).set({
        avatarUrl: url,
      }).where(eq(crmUsers.id, session.userId));

      return { success: true, avatarUrl: url };
    }),

  // ─── REMOVE AVATAR ───
  removeAvatar: publicProcedure.mutation(async ({ ctx }) => {
    const session = await requireSaasUser(ctx);
    const { getDb } = await import("../db");
    const { crmUsers } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db.update(crmUsers).set({
      avatarUrl: null,
    }).where(eq(crmUsers.id, session.userId));

    return { success: true };
  }),

  // ─── CHANGE PASSWORD ───
  changePassword: publicProcedure
    .input(z.object({
      currentPassword: z.string().min(1, "Senha atual é obrigatória"),
      newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireSaasUser(ctx);
      const { getDb } = await import("../db");
      const { crmUsers } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const bcrypt = await import("bcryptjs");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get current password hash
      const [user] = await db.select({
        passwordHash: crmUsers.passwordHash,
      }).from(crmUsers).where(eq(crmUsers.id, session.userId)).limit(1);

      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Conta sem senha configurada" });
      }

      // Verify current password
      const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta" });
      }

      // Hash new password
      const newHash = await bcrypt.hash(input.newPassword, 12);
      await db.update(crmUsers).set({
        passwordHash: newHash,
      }).where(eq(crmUsers.id, session.userId));

      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════
  // GOOGLE CALENDAR INTEGRATION (via MCP)
  // ═══════════════════════════════════════════════════════════

  // ─── CHECK GOOGLE CALENDAR STATUS ───
  googleCalendarStatus: publicProcedure.query(async ({ ctx }) => {
    await requireSaasUser(ctx);
    const { checkGoogleCalendarStatus } = await import("../googleCalendarSync");
    return checkGoogleCalendarStatus();
  }),

  // ─── CONNECT GOOGLE CALENDAR (mark as connected in DB) ───
  connectGoogleCalendar: publicProcedure
    .input(z.object({
      calendarEmail: z.string().optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      const session = await requireSaasUser(ctx);
      const { getDb } = await import("../db");
      const { googleCalendarTokens } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify MCP connectivity first
      const { checkGoogleCalendarStatus } = await import("../googleCalendarSync");
      const status = await checkGoogleCalendarStatus();
      if (!status.available) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Google Calendar não está disponível. Verifique a configuração do MCP.",
        });
      }

      // Deactivate any existing tokens for this user
      await db.update(googleCalendarTokens).set({
        isActive: false,
      }).where(and(
        eq(googleCalendarTokens.userId, session.userId),
        eq(googleCalendarTokens.tenantId, session.tenantId),
      ));

      // Insert connection record (MCP handles auth, we just track the connection)
      await db.insert(googleCalendarTokens).values({
        userId: session.userId,
        tenantId: session.tenantId,
        accessToken: "mcp-managed", // MCP handles tokens
        refreshToken: null,
        expiresAt: null,
        scope: "https://www.googleapis.com/auth/calendar",
        calendarEmail: input?.calendarEmail || null,
        isActive: true,
      });

      return { success: true, message: "Google Calendar conectado via MCP" };
    }),

  // ─── DISCONNECT GOOGLE CALENDAR ───
  disconnectGoogleCalendar: publicProcedure.mutation(async ({ ctx }) => {
    const session = await requireSaasUser(ctx);
    const { getDb } = await import("../db");
    const { googleCalendarTokens } = await import("../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db.update(googleCalendarTokens).set({
      isActive: false,
    }).where(and(
      eq(googleCalendarTokens.userId, session.userId),
      eq(googleCalendarTokens.tenantId, session.tenantId),
    ));

    return { success: true };
  }),

  // ─── LIST GOOGLE CALENDAR EVENTS (via MCP) ───
  listCalendarEvents: publicProcedure
    .input(z.object({
      timeMin: z.string().optional(),
      timeMax: z.string().optional(),
      maxResults: z.number().default(20),
      query: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireSaasUser(ctx);
      const { fetchCalendarEventsForImport } = await import("../googleCalendarSync");

      const events = await fetchCalendarEventsForImport({
        timeMin: input.timeMin,
        timeMax: input.timeMax,
        maxResults: input.maxResults,
      });

      return { events };
    }),

  // ─── SYNC SINGLE TASK TO GOOGLE CALENDAR ───
  syncTaskToCalendar: publicProcedure
    .input(z.object({
      taskId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireSaasUser(ctx);
      const { getDb } = await import("../db");
      const { tasks } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get the task
      const [task] = await db.select().from(tasks)
        .where(and(
          eq(tasks.id, input.taskId),
          eq(tasks.tenantId, session.tenantId),
        ))
        .limit(1);

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada" });
      }

      const { syncTaskToCalendar: doSync } = await import("../googleCalendarSync");
      const result = await doSync({
        id: task.id,
        title: task.title,
        description: task.description,
        dueAt: task.dueAt,
        priority: task.priority,
        status: task.status,
        entityType: task.entityType,
        entityId: task.entityId,
        googleEventId: task.googleEventId,
      });

      if (result.synced && result.eventId) {
        // Update task with Google Event ID
        await db.update(tasks).set({
          googleEventId: result.eventId,
          googleCalendarSynced: true,
        }).where(eq(tasks.id, task.id));
      }

      return {
        success: result.synced,
        eventId: result.eventId,
        message: result.synced
          ? "Tarefa sincronizada com o Google Calendar"
          : "Falha ao sincronizar tarefa",
      };
    }),

  // ─── BULK SYNC ALL TASKS TO GOOGLE CALENDAR ───
  syncAllTasksToCalendar: publicProcedure.mutation(async ({ ctx }) => {
    const session = await requireSaasUser(ctx);
    const { getDb } = await import("../db");
    const { tasks } = await import("../../drizzle/schema");
    const { eq, and, isNull, or } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // Get all unsynced pending/in_progress tasks for this tenant
    const unsyncedTasks = await db.select().from(tasks)
      .where(and(
        eq(tasks.tenantId, session.tenantId),
        or(
          eq(tasks.status, "pending"),
          eq(tasks.status, "in_progress"),
        ),
        or(
          eq(tasks.googleCalendarSynced, false),
          isNull(tasks.googleCalendarSynced),
        ),
      ));

    if (unsyncedTasks.length === 0) {
      return { synced: 0, failed: 0, total: 0, message: "Nenhuma tarefa pendente para sincronizar" };
    }

    const { bulkSyncTasksToCalendar } = await import("../googleCalendarSync");
    const result = await bulkSyncTasksToCalendar(unsyncedTasks);

    // Update synced tasks in DB
    for (const r of result.results) {
      if (r.success && r.eventId) {
        await db.update(tasks).set({
          googleEventId: r.eventId,
          googleCalendarSynced: true,
        }).where(eq(tasks.id, r.taskId));
      }
    }

    return {
      synced: result.synced,
      failed: result.failed,
      total: unsyncedTasks.length,
      message: `${result.synced} tarefa(s) sincronizada(s), ${result.failed} falha(s)`,
    };
  }),

  // ─── REMOVE TASK FROM GOOGLE CALENDAR ───
  removeTaskFromCalendar: publicProcedure
    .input(z.object({
      taskId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireSaasUser(ctx);
      const { getDb } = await import("../db");
      const { tasks } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [task] = await db.select().from(tasks)
        .where(and(
          eq(tasks.id, input.taskId),
          eq(tasks.tenantId, session.tenantId),
        ))
        .limit(1);

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada" });
      }

      if (!task.googleEventId) {
        return { success: true, message: "Tarefa não estava sincronizada" };
      }

      const { removeTaskFromCalendar: doRemove } = await import("../googleCalendarSync");
      const removed = await doRemove(task.googleEventId);

      if (removed) {
        await db.update(tasks).set({
          googleEventId: null,
          googleCalendarSynced: false,
        }).where(eq(tasks.id, task.id));
      }

      return {
        success: removed,
        message: removed
          ? "Evento removido do Google Calendar"
          : "Falha ao remover evento do Google Calendar",
      };
    }),

  // ─── IMPORT CALENDAR EVENTS AS TASKS ───
  importCalendarEventsAsTasks: publicProcedure
    .input(z.object({
      eventIds: z.array(z.string()).min(1),
      entityType: z.string().default("contact"),
      entityId: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireSaasUser(ctx);
      const { getDb } = await import("../db");
      const { tasks } = await import("../../drizzle/schema");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { getCalendarEvent } = await import("../googleCalendar");

      let imported = 0;
      let failed = 0;

      for (const eventId of input.eventIds) {
        try {
          const event = await getCalendarEvent(eventId);
          if (!event) {
            failed++;
            continue;
          }

          const startTime = event.start?.dateTime || event.start?.date;
          const dueAt = startTime ? new Date(startTime) : null;

          await db.insert(tasks).values({
            tenantId: session.tenantId,
            entityType: input.entityType,
            entityId: input.entityId,
            title: (event as any).summary || "(Sem título)",
            description: (event as any).description || `Importado do Google Calendar`,
            taskType: "event",
            dueAt,
            status: "pending",
            priority: "medium",
            assignedToUserId: session.userId,
            createdByUserId: session.userId,
            googleEventId: eventId,
            googleCalendarSynced: true,
          });

          imported++;
        } catch (error) {
          console.error(`[GCal Import] Failed to import event ${eventId}:`, error);
          failed++;
        }
      }

      return {
        imported,
        failed,
        message: `${imported} evento(s) importado(s) como tarefa(s)`,
      };
    }),
});
