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
  getChatbotRules,
  addChatbotRule,
  removeChatbotRule,
  getConversationsList,
  markConversationRead,
  getDashboardMetrics,
  getPipelineSummary,
  getRecentActivity,
  getUpcomingTasks,
  globalSearch,
} from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// CRM Routers
import { adminRouter } from "./routers/adminRouter";
import { crmRouter } from "./routers/crmRouter";
import { inboxRouter } from "./routers/inboxRouter";
import { proposalRouter, portalRouter, managementRouter, insightsRouter, academyRouter, integrationHubRouter } from "./routers/featureRouters";

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

  // ─── WhatsApp API (existing) ───
  whatsapp: router({
    connect: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        const state = await whatsappManager.connect(input.sessionId, ctx.user.id);
        return { sessionId: state.sessionId, status: state.status, qrDataUrl: state.qrDataUrl, user: state.user };
      }),
    disconnect: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input }) => {
        await whatsappManager.disconnect(input.sessionId);
        return { success: true };
      }),
    status: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(({ input }) => {
        const session = whatsappManager.getSession(input.sessionId);
        return { status: session?.status || "disconnected", qrDataUrl: session?.qrDataUrl || null, user: session?.user || null };
      }),
    sessions: protectedProcedure.query(async ({ ctx }) => {
      const dbSessions = await getSessionsByUser(ctx.user.id);
      return dbSessions.map((s) => {
        const live = whatsappManager.getSession(s.sessionId);
        return { ...s, liveStatus: live?.status || "disconnected", qrDataUrl: live?.qrDataUrl || null, user: live?.user || null };
      });
    }),
    // Resolve a phone number to the actual WhatsApp JID
    resolveJid: protectedProcedure
      .input(z.object({ sessionId: z.string(), phone: z.string().min(1) }))
      .query(async ({ input }) => {
        const jid = await whatsappManager.resolveJidPublic(input.sessionId, input.phone);
        return { jid };
      }),
    sendMessage: protectedProcedure
      .input(z.object({ sessionId: z.string(), number: z.string().min(1), message: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const result = await whatsappManager.sendTextMessage(input.sessionId, input.number, input.message);
        return { success: true, messageId: result?.key?.id, remoteJid: result?.key?.remoteJid };
      }),
    sendMedia: protectedProcedure
      .input(z.object({ sessionId: z.string(), number: z.string().min(1), mediaUrl: z.string().url(), mediaType: z.enum(["image", "audio", "document", "video"]), caption: z.string().optional(), fileName: z.string().optional(), ptt: z.boolean().optional(), mimetype: z.string().optional(), duration: z.number().optional() }))
      .mutation(async ({ input }) => {
        const result = await whatsappManager.sendMediaMessage(input.sessionId, input.number, input.mediaUrl, input.mediaType, input.caption, input.fileName, { ptt: input.ptt, mimetype: input.mimetype, duration: input.duration });
        return { success: true, messageId: result?.key?.id };
      }),
    messages: protectedProcedure
      .input(z.object({ sessionId: z.string(), limit: z.number().min(1).max(200).default(50), offset: z.number().min(0).default(0) }))
      .query(async ({ input }) => getMessages(input.sessionId, input.limit, input.offset)),
    messagesByContact: protectedProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string(), limit: z.number().min(1).max(200).default(50), beforeId: z.number().optional() }))
      .query(async ({ input }) => getMessagesByContact(input.sessionId, input.remoteJid, input.limit, input.beforeId)),
    logs: protectedProcedure
      .input(z.object({ sessionId: z.string().optional(), limit: z.number().min(1).max(500).default(100) }))
      .query(async ({ input }) => input.sessionId ? getLogs(input.sessionId, input.limit) : getAllLogs(input.limit)),
    getChatbotSettings: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => getChatbotSettings(input.sessionId)),
    updateChatbotSettings: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        enabled: z.boolean().optional(),
        systemPrompt: z.string().optional(),
        maxTokens: z.number().min(50).max(4000).optional(),
        mode: z.enum(["all", "whitelist", "blacklist"]).optional(),
        respondGroups: z.boolean().optional(),
        respondPrivate: z.boolean().optional(),
        onlyWhenMentioned: z.boolean().optional(),
        triggerWords: z.string().nullable().optional(),
        welcomeMessage: z.string().nullable().optional(),
        awayMessage: z.string().nullable().optional(),
        businessHoursEnabled: z.boolean().optional(),
        businessHoursStart: z.string().optional(),
        businessHoursEnd: z.string().optional(),
        businessHoursDays: z.string().optional(),
        businessHoursTimezone: z.string().optional(),
        replyDelay: z.number().min(0).max(60).optional(),
        contextMessageCount: z.number().min(1).max(50).optional(),
        rateLimitPerHour: z.number().min(0).optional(),
        rateLimitPerDay: z.number().min(0).optional(),
        temperature: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { sessionId, ...data } = input;
        await upsertChatbotSettings(sessionId, data as any);
        return { success: true };
      }),
    // Chatbot Rules (whitelist/blacklist)
    getChatbotRules: protectedProcedure
      .input(z.object({ sessionId: z.string(), ruleType: z.enum(["whitelist", "blacklist"]).optional() }))
      .query(async ({ input }) => getChatbotRules(input.sessionId, input.ruleType)),
    addChatbotRule: protectedProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string().min(1), ruleType: z.enum(["whitelist", "blacklist"]), contactName: z.string().optional() }))
      .mutation(async ({ input }) => {
        await addChatbotRule(input.sessionId, input.remoteJid, input.ruleType, input.contactName);
        return { success: true };
      }),
    removeChatbotRule: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await removeChatbotRule(input.id);
        return { success: true };
      }),
    // Conversations list (grouped by remoteJid with last message)
    conversations: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => getConversationsList(input.sessionId)),
    // Mark conversation as read
    markRead: protectedProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string() }))
      .mutation(async ({ input }) => {
        await markConversationRead(input.sessionId, input.remoteJid);
        return { success: true };
      }),
    // Get profile picture for a single JID
    profilePicture: protectedProcedure
      .input(z.object({ sessionId: z.string(), jid: z.string() }))
      .query(async ({ input }) => {
        const url = await whatsappManager.getProfilePicture(input.sessionId, input.jid);
        return { url };
      }),
    // Get profile pictures for multiple JIDs (batch)
    profilePictures: protectedProcedure
      .input(z.object({ sessionId: z.string(), jids: z.array(z.string()).max(50) }))
      .query(async ({ input }) => {
        const pictures = await whatsappManager.getProfilePictures(input.sessionId, input.jids);
        return pictures;
      }),
    uploadMedia: protectedProcedure
      .input(z.object({ fileName: z.string(), fileBase64: z.string(), contentType: z.string() }))
      .mutation(async ({ input }) => {
        const fileBuffer = Buffer.from(input.fileBase64, "base64");
        const fileKey = `whatsapp-media/${nanoid()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, fileBuffer, input.contentType);
        return { url, fileKey };
      }),
    // Manual trigger for daily backup
    triggerDailyBackup: protectedProcedure
      .mutation(async () => {
        const { runDailyWhatsAppBackup } = await import("./whatsappDailyBackup");
        const result = await runDailyWhatsAppBackup();
        return result;
      }),
  }),

  // ─── Dashboard ───
  dashboard: router({
    metrics: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return getDashboardMetrics(input.tenantId);
      }),
    pipelineSummary: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return getPipelineSummary(input.tenantId);
      }),
    recentActivity: protectedProcedure
      .input(z.object({ tenantId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return getRecentActivity(input.tenantId, input.limit);
      }),
    upcomingTasks: protectedProcedure
      .input(z.object({ tenantId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return getUpcomingTasks(input.tenantId, input.limit);
      }),
  }),

  // ─── Global Search ───
  search: router({
    global: protectedProcedure
      .input(z.object({ tenantId: z.number(), query: z.string().min(1).max(100), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return globalSearch(input.tenantId, input.query, input.limit);
      }),
  }),

  // ─── ASTRA CRM Modules ───
  admin: adminRouter,       // M0: Admin/IAM
  crm: crmRouter,           // M2: CRM (Contacts, Deals, Pipelines, Trips, Tasks, Notes)
  inbox: inboxRouter,       // M1: Inbox Omnichannel
  proposals: proposalRouter, // M3: Propostas
  portal: portalRouter,     // M4: Portal do Cliente
  management: managementRouter, // M5: Gestão
  insights: insightsRouter, // M6: Insights
  academy: academyRouter,   // M7: Academy
  integrationHub: integrationHubRouter, // M8: Integration Hub
});

export type AppRouter = typeof appRouter;
