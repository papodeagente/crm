import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { whatsappManager } from "./whatsapp";
import {
  getSessionsByUser,
  getMessages,
  getMessagesByContact,
  getLogs,
  getAllLogs,
  getChatbotSettings,
  upsertChatbotSettings,
} from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  whatsapp: router({
    // Connect a new session
    connect: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        const state = await whatsappManager.connect(input.sessionId, ctx.user.id);
        return {
          sessionId: state.sessionId,
          status: state.status,
          qrDataUrl: state.qrDataUrl,
          user: state.user,
        };
      }),

    // Disconnect a session
    disconnect: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input }) => {
        await whatsappManager.disconnect(input.sessionId);
        return { success: true };
      }),

    // Get session status
    status: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(({ input }) => {
        const session = whatsappManager.getSession(input.sessionId);
        return {
          status: session?.status || "disconnected",
          qrDataUrl: session?.qrDataUrl || null,
          user: session?.user || null,
        };
      }),

    // List all sessions for user
    sessions: protectedProcedure.query(async ({ ctx }) => {
      const dbSessions = await getSessionsByUser(ctx.user.id);
      return dbSessions.map((s) => {
        const live = whatsappManager.getSession(s.sessionId);
        return {
          ...s,
          liveStatus: live?.status || "disconnected",
          qrDataUrl: live?.qrDataUrl || null,
          user: live?.user || null,
        };
      });
    }),

    // Send text message
    sendMessage: protectedProcedure
      .input(
        z.object({
          sessionId: z.string(),
          number: z.string().min(1),
          message: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        const result = await whatsappManager.sendTextMessage(input.sessionId, input.number, input.message);
        return { success: true, messageId: result?.key?.id };
      }),

    // Send media message
    sendMedia: protectedProcedure
      .input(
        z.object({
          sessionId: z.string(),
          number: z.string().min(1),
          mediaUrl: z.string().url(),
          mediaType: z.enum(["image", "audio", "document"]),
          caption: z.string().optional(),
          fileName: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await whatsappManager.sendMediaMessage(
          input.sessionId,
          input.number,
          input.mediaUrl,
          input.mediaType,
          input.caption,
          input.fileName
        );
        return { success: true, messageId: result?.key?.id };
      }),

    // Get messages history
    messages: protectedProcedure
      .input(
        z.object({
          sessionId: z.string(),
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().min(0).default(0),
        })
      )
      .query(async ({ input }) => {
        return getMessages(input.sessionId, input.limit, input.offset);
      }),

    // Get messages by contact
    messagesByContact: protectedProcedure
      .input(
        z.object({
          sessionId: z.string(),
          remoteJid: z.string(),
          limit: z.number().min(1).max(200).default(50),
        })
      )
      .query(async ({ input }) => {
        return getMessagesByContact(input.sessionId, input.remoteJid, input.limit);
      }),

    // Get activity logs
    logs: protectedProcedure
      .input(
        z.object({
          sessionId: z.string().optional(),
          limit: z.number().min(1).max(500).default(100),
        })
      )
      .query(async ({ input }) => {
        if (input.sessionId) {
          return getLogs(input.sessionId, input.limit);
        }
        return getAllLogs(input.limit);
      }),

    // Chatbot settings
    getChatbotSettings: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        return getChatbotSettings(input.sessionId);
      }),

    updateChatbotSettings: protectedProcedure
      .input(
        z.object({
          sessionId: z.string(),
          enabled: z.boolean(),
          systemPrompt: z.string().optional(),
          maxTokens: z.number().min(50).max(4000).optional(),
        })
      )
      .mutation(async ({ input }) => {
        await upsertChatbotSettings(input.sessionId, input.enabled, input.systemPrompt, input.maxTokens);
        return { success: true };
      }),

    // Upload media file
    uploadMedia: protectedProcedure
      .input(
        z.object({
          fileName: z.string(),
          fileBase64: z.string(),
          contentType: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const fileBuffer = Buffer.from(input.fileBase64, "base64");
        const fileKey = `whatsapp-media/${nanoid()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, fileBuffer, input.contentType);
        return { url, fileKey };
      }),
  }),
});

export type AppRouter = typeof appRouter;
