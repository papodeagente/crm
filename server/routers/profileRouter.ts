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

    // Check Google Calendar connection
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
      googleCalendar: gcToken ? {
        connected: true,
        email: gcToken.calendarEmail,
        connectedAt: gcToken.createdAt,
      } : {
        connected: false,
        email: null,
        connectedAt: null,
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

  // ─── CONNECT GOOGLE CALENDAR ───
  connectGoogleCalendar: publicProcedure
    .input(z.object({
      accessToken: z.string().min(1),
      refreshToken: z.string().optional(),
      expiresAt: z.string().optional(),
      scope: z.string().optional(),
      calendarEmail: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireSaasUser(ctx);
      const { getDb } = await import("../db");
      const { googleCalendarTokens } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Deactivate any existing tokens for this user
      await db.update(googleCalendarTokens).set({
        isActive: false,
      }).where(and(
        eq(googleCalendarTokens.userId, session.userId),
        eq(googleCalendarTokens.tenantId, session.tenantId),
      ));

      // Insert new token
      await db.insert(googleCalendarTokens).values({
        userId: session.userId,
        tenantId: session.tenantId,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken || null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        scope: input.scope || null,
        calendarEmail: input.calendarEmail || null,
        isActive: true,
      });

      return { success: true };
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

  // ─── LIST GOOGLE CALENDAR EVENTS ───
  listCalendarEvents: publicProcedure
    .input(z.object({
      timeMin: z.string().optional(),
      timeMax: z.string().optional(),
      maxResults: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const session = await requireSaasUser(ctx);
      const { getDb } = await import("../db");
      const { googleCalendarTokens } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [token] = await db.select().from(googleCalendarTokens)
        .where(and(
          eq(googleCalendarTokens.userId, session.userId),
          eq(googleCalendarTokens.tenantId, session.tenantId),
          eq(googleCalendarTokens.isActive, true),
        ))
        .limit(1);

      if (!token) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Google Calendar não conectado" });
      }

      // Fetch events from Google Calendar API
      const now = new Date();
      const timeMin = input.timeMin || now.toISOString();
      const timeMax = input.timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("maxResults", String(input.maxResults));
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired — mark as inactive
          await db.update(googleCalendarTokens).set({ isActive: false })
            .where(eq(googleCalendarTokens.id, token.id));
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Token do Google Calendar expirado. Reconecte sua conta." });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao buscar eventos do Google Calendar" });
      }

      const data = await res.json();
      return {
        events: (data.items || []).map((e: any) => ({
          id: e.id,
          summary: e.summary || "(Sem título)",
          description: e.description || "",
          start: e.start?.dateTime || e.start?.date || "",
          end: e.end?.dateTime || e.end?.date || "",
          location: e.location || "",
          htmlLink: e.htmlLink || "",
          status: e.status || "",
          organizer: e.organizer?.email || "",
        })),
      };
    }),
});
