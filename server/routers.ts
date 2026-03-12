import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { whatsappManager } from "./whatsappEvolution";
import {
  getSessionsByUser,
  getSessionsByTenant,
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
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  // Multi-agent / SaaS
  getConversationsListMultiAgent,
  assignConversation,
  updateAssignmentStatus,
  getAssignmentForConversation,
  getAgentsForTenant,
  getTeamsForTenant,
  getNextRoundRobinAgent,
  // Team management
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamWithMembers,
  addTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  // Agent management
  getAgentsWithTeams,
  updateAgentStatus,
  // Distribution rules
  getDistributionRules,
  createDistributionRule,
  updateDistributionRule,
  deleteDistributionRule,
  toggleDistributionRule,
  // Contact profile & custom fields
  getContactMetrics,
  getContactDeals,
  listCustomFields,
  getCustomFieldById,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  reorderCustomFields,
  getCustomFieldValues,
  setCustomFieldValues,
  // WA Conversations (canônico)
  getWaConversationsList,
  getMessagesByConversationId,
  markWaConversationReadDb,
  // Message monitoring metrics
  getMessageStatusMetrics,
  getMessageVolumeOverTime,
  getDeliveryRateMetrics,
  getRecentMessageActivity,
  getMessageTypeDistribution,
  getTopContactsByVolume,
  getResponseTimeMetrics,
  getUserPreference,
  setUserPreference,
  getAllUserPreferences,
  getDashboardWhatsAppMetrics,
  getDashboardDealsTimeline,
  getDashboardConversionRates,
  getDashboardFunnelData,
  getDashboardAllPipelines,
} from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// CRM Routers
import { adminRouter } from "./routers/adminRouter";
import { crmRouter } from "./routers/crmRouter";
import { inboxRouter } from "./routers/inboxRouter";
import { proposalRouter, portalRouter, managementRouter, insightsRouter, academyRouter, integrationHubRouter } from "./routers/featureRouters";
import { productCatalogRouter } from "./routers/productCatalogRouter";
import { aiAnalysisRouter } from "./routers/aiAnalysisRouter";
import { utmAnalyticsRouter } from "./routers/utmAnalyticsRouter";
import { rdCrmImportRouter } from "./routers/rdCrmImportRouter";
import { saasAuthRouter } from "./routers/saasAuthRouter";
import { inviteUserToTenant } from "./saasAuth";
import { rfvRouter } from "./routers/rfvRouter";
import { profileRouter } from "./routers/profileRouter";
import {
  listLeadEvents,
  countLeadEvents,
  reprocessLeadEvent,
  getWebhookConfig,
  upsertWebhookConfig,
  getMetaConfig,
  upsertMetaConfig,
  disconnectMeta,
} from "./leadProcessor";
import { randomBytes } from "crypto";
import { getDb } from "./db";
import { trackingTokens, rdStationConfig, rdStationWebhookLog, rdFieldMappings, customFields } from "../drizzle/schema";
import { generateTrackerScript } from "./tracker-script";
import { eq, and, desc, sql } from "drizzle-orm";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async (opts) => {
      if (opts.ctx.saasUser && opts.ctx.user) {
        return {
          ...opts.ctx.user,
          tenantId: opts.ctx.saasUser.tenantId,
          saasEmail: opts.ctx.saasUser.email,
        };
      }
      // For Manus OAuth users (owner), try to find their CRM user to get tenantId
      if (opts.ctx.user && !opts.ctx.saasUser) {
        try {
          const db = await getDb();
          if (db && opts.ctx.user.email) {
            const [crmUser] = await db.execute(
              sql`SELECT id, tenantId FROM crm_users WHERE email = ${opts.ctx.user.email} LIMIT 1`
            );
            const row = (crmUser as unknown as any[])[0];
            if (row?.tenantId) {
              return {
                ...opts.ctx.user,
                tenantId: Number(row.tenantId),
              };
            }
          }
        } catch (e) {
          // Fallback to user without tenantId
        }
      }
      return opts.ctx.user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie("entur_saas_session", { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── WhatsApp API (existing) ───
  whatsapp: router({
    connect: protectedProcedure
      .mutation(async ({ ctx }) => {
        // Each CRM user gets exactly ONE WhatsApp instance
        // No sessionId needed — system generates it automatically
        const tenantId = ctx.saasUser?.tenantId || 0;
        const userId = ctx.saasUser?.userId || ctx.user.id;
        const state = await whatsappManager.connectUser(userId, tenantId);
        
        // If already connected, return immediately
        if (state.status === "connected") {
          return { sessionId: state.sessionId, status: state.status, qrDataUrl: null, user: state.user };
        }
        
        // Wait up to 15 seconds for QR code to be generated
        const startWait = Date.now();
        const MAX_WAIT_MS = 15_000;
        while (Date.now() - startWait < MAX_WAIT_MS) {
          const current = whatsappManager.getSession(state.sessionId);
          if (!current) break;
          if (current.qrDataUrl) {
            return { sessionId: current.sessionId, status: current.status, qrDataUrl: current.qrDataUrl, user: current.user };
          }
          if (current.status === "connected") {
            return { sessionId: current.sessionId, status: current.status, qrDataUrl: null, user: current.user };
          }
          await new Promise(r => setTimeout(r, 500));
        }
        
        const finalState = whatsappManager.getSession(state.sessionId);
        return {
          sessionId: state.sessionId,
          status: finalState?.status || state.status,
          qrDataUrl: finalState?.qrDataUrl || null,
          user: finalState?.user || null,
        };
      }),
    disconnect: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input }) => {
        await whatsappManager.disconnect(input.sessionId);
        return { success: true };
      }),
    // Soft-delete: move session to trash (any user can do this)
    deleteSession: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input }) => {
        await whatsappManager.deleteSession(input.sessionId, false);
        return { success: true };
      }),
    // Hard-delete: permanently remove session (admin only)
    hardDeleteSession: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // Only admins can hard-delete
        const role = (ctx.saasUser as any)?.crmUserRole || ctx.saasUser?.role;
        if (role !== "admin") {
          throw new Error("Apenas administradores podem excluir permanentemente uma sess\u00e3o.");
        }
        await whatsappManager.deleteSession(input.sessionId, true);
        return { success: true };
      }),
    status: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        const session = await whatsappManager.getSessionLive(input.sessionId);
        return { status: session?.status || "disconnected", qrDataUrl: session?.qrDataUrl || null, user: session?.user || null };
      }),
    // Request pairing code as alternative to QR code
    requestPairingCode: protectedProcedure
      .input(z.object({ sessionId: z.string(), phoneNumber: z.string().min(8).max(20) }))
      .mutation(async ({ ctx, input }) => {
        // Evolution API does not support pairing codes directly.
        // Connection is done via QR code only.
        throw new TRPCError({ code: "BAD_REQUEST", message: "A conexão via código de pareamento não está disponível com a Evolution API. Use o QR Code para conectar." });
      }),
    sessions: protectedProcedure.query(async ({ ctx }) => {
      // Each user has their own WhatsApp instance (Evolution API)
      // Filter by the CRM userId (saasUser.id) so users only see their own sessions
      const saasUserId = ctx.saasUser?.userId;
      const tenantId = ctx.saasUser?.tenantId || 0;
      let dbSessions;
      if (saasUserId) {
        dbSessions = await getSessionsByUser(saasUserId);
      } else {
        dbSessions = await getSessionsByUser(ctx.user.id);
      }

      // Determine the canonical session name for this user
      const userId = saasUserId || ctx.user.id;
      const canonicalName = `crm-${tenantId}-${userId}`;

      // Check live status from Evolution API for each session
      const results = await Promise.all(dbSessions.map(async (s) => {
        const live = await whatsappManager.getSessionLive(s.sessionId);
        const liveStatus = live?.status || s.status || "disconnected";
        return { ...s, liveStatus, qrDataUrl: live?.qrDataUrl || null, user: live?.user || null };
      }));

      // Filter out phantom sessions: if a session is not the canonical name
      // AND its liveStatus is disconnected, remove it from results
      const filtered = results.filter(s => {
        if (s.sessionId === canonicalName) return true; // Always keep canonical
        if (s.liveStatus === "connected") return true; // Keep any connected session
        return false; // Remove disconnected legacy sessions
      });

      // If no sessions remain but we had some, return the canonical one if it exists
      if (filtered.length === 0 && results.length > 0) {
        const canonical = results.find(s => s.sessionId === canonicalName);
        if (canonical) return [canonical];
      }

      return filtered.length > 0 ? filtered : results;
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
    // ─── REACTIONS & INTERACTIONS ───
    sendReaction: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        key: z.object({ remoteJid: z.string(), fromMe: z.boolean(), id: z.string() }),
        reaction: z.string(), // emoji or empty string to remove
      }))
      .mutation(async ({ input }) => {
        const result = await whatsappManager.sendReaction(input.sessionId, input.key, input.reaction);
        return { success: true, messageId: result?.key?.id };
      }),
    sendSticker: protectedProcedure
      .input(z.object({ sessionId: z.string(), number: z.string().min(1), stickerUrl: z.string().url() }))
      .mutation(async ({ input }) => {
        const result = await whatsappManager.sendSticker(input.sessionId, input.number, input.stickerUrl);
        return { success: true, messageId: result?.key?.id };
      }),
    sendLocation: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        latitude: z.number(),
        longitude: z.number(),
        name: z.string(),
        address: z.string(),
      }))
      .mutation(async ({ input }) => {
        const result = await whatsappManager.sendLocation(input.sessionId, input.number, input.latitude, input.longitude, input.name, input.address);
        return { success: true, messageId: result?.key?.id };
      }),
    sendContact: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        contacts: z.array(z.object({ fullName: z.string(), wuid: z.string().optional(), phoneNumber: z.string() })),
      }))
      .mutation(async ({ input }) => {
        const result = await whatsappManager.sendContact(input.sessionId, input.number, input.contacts);
        return { success: true, messageId: result?.key?.id };
      }),
    sendPoll: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        name: z.string().min(1),
        values: z.array(z.string().min(1)).min(2).max(12),
        selectableCount: z.number().min(1).default(1),
      }))
      .mutation(async ({ input }) => {
        const result = await whatsappManager.sendPoll(input.sessionId, input.number, input.name, input.values, input.selectableCount);
        return { success: true, messageId: result?.key?.id };
      }),
    sendTextWithQuote: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        message: z.string().min(1),
        quotedMessageId: z.string(),
        quotedText: z.string(),
      }))
      .mutation(async ({ input }) => {
        const result = await whatsappManager.sendTextWithQuote(input.sessionId, input.number, input.message, input.quotedMessageId, input.quotedText);
        return { success: true, messageId: result?.key?.id };
      }),
    deleteMessage: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        remoteJid: z.string(),
        messageId: z.string(),
        fromMe: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await whatsappManager.deleteMessage(input.sessionId, input.remoteJid, input.messageId, input.fromMe);
        return { success: true };
      }),
    editMessage: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        messageId: z.string(),
        newText: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const result = await whatsappManager.editMessage(input.sessionId, input.number, input.messageId, input.newText);
        return { success: true, messageId: result?.key?.id };
      }),
    sendPresence: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        presence: z.enum(["composing", "recording", "paused"]),
      }))
      .mutation(async ({ input }) => {
        await whatsappManager.sendPresenceUpdate(input.sessionId, input.number, input.presence);
        return { success: true };
      }),
    archiveChat: protectedProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string(), archive: z.boolean() }))
      .mutation(async ({ input }) => {
        await whatsappManager.archiveChat(input.sessionId, input.remoteJid, input.archive);
        return { success: true };
      }),
    blockContact: protectedProcedure
      .input(z.object({ sessionId: z.string(), number: z.string().min(1), block: z.boolean() }))
      .mutation(async ({ input }) => {
        await whatsappManager.blockContact(input.sessionId, input.number, input.block);
        return { success: true };
      }),
    checkIsWhatsApp: protectedProcedure
      .input(z.object({ sessionId: z.string(), numbers: z.array(z.string().min(1)) }))
      .mutation(async ({ input }) => {
        return whatsappManager.checkIsWhatsApp(input.sessionId, input.numbers);
      }),
    markAsUnread: protectedProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string(), messageId: z.string() }))
      .mutation(async ({ input }) => {
        await whatsappManager.markAsUnread(input.sessionId, input.remoteJid, input.messageId);
        return { success: true };
      }),
    fetchContactProfile: protectedProcedure
      .input(z.object({ sessionId: z.string(), jid: z.string() }))
      .query(async ({ input }) => {
        return whatsappManager.fetchContactProfile(input.sessionId, input.jid);
      }),
    fetchBusinessProfile: protectedProcedure
      .input(z.object({ sessionId: z.string(), jid: z.string() }))
      .query(async ({ input }) => {
        return whatsappManager.fetchContactBusinessProfile(input.sessionId, input.jid);
      }),
    // ─── EXISTING QUERIES ───
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
    // Conversations list (grouped by remoteJid with last message) — LEGACY
    conversations: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => getConversationsList(input.sessionId)),
    // Conversations list with multi-agent assignment info — LEGACY
    conversationsMultiAgent: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        tenantId: z.number().default(1),
        assignedUserId: z.number().optional(),
        assignedTeamId: z.number().optional(),
        status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
        unassignedOnly: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        const { sessionId, tenantId, ...filter } = input;
        return getConversationsListMultiAgent(sessionId, tenantId, filter);
      }),
    // ─── WA Conversations (canônico — usa wa_conversations) ───
    waConversations: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        tenantId: z.number().default(1),
        assignedUserId: z.number().optional(),
        assignedTeamId: z.number().optional(),
        status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
        unassignedOnly: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        const { sessionId, tenantId, ...filter } = input;
        return getWaConversationsList(sessionId, tenantId, filter);
      }),
    // Messages by canonical conversation ID
    messagesByConversation: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        limit: z.number().min(1).max(200).default(50),
        beforeId: z.number().optional(),
      }))
      .query(async ({ input }) => getMessagesByConversationId(input.conversationId, input.limit, input.beforeId)),
    // Mark wa_conversation as read
    markWaConversationRead: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input }) => {
        await markWaConversationReadDb(input.conversationId);
        return { success: true };
      }),
    // Assign conversation to an agent
    assignConversation: protectedProcedure
      .input(z.object({
        tenantId: z.number().default(1),
        sessionId: z.string(),
        remoteJid: z.string(),
        assignedUserId: z.number().nullable(),
        assignedTeamId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await assignConversation(input.tenantId, input.sessionId, input.remoteJid, input.assignedUserId, input.assignedTeamId);
        return result;
      }),
    // Transfer conversation to another agent
    transferConversation: protectedProcedure
      .input(z.object({
        tenantId: z.number().default(1),
        sessionId: z.string(),
        remoteJid: z.string(),
        toUserId: z.number(),
        toTeamId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await assignConversation(input.tenantId, input.sessionId, input.remoteJid, input.toUserId, input.toTeamId);
        return result;
      }),
    // Update conversation assignment status
    updateAssignmentStatus: protectedProcedure
      .input(z.object({
        tenantId: z.number().default(1),
        sessionId: z.string(),
        remoteJid: z.string(),
        status: z.enum(["open", "pending", "resolved", "closed"]),
      }))
      .mutation(async ({ input }) => {
        await updateAssignmentStatus(input.tenantId, input.sessionId, input.remoteJid, input.status);
        return { success: true };
      }),
    // Get assignment for a specific conversation
    getAssignment: protectedProcedure
      .input(z.object({
        tenantId: z.number().default(1),
        sessionId: z.string(),
        remoteJid: z.string(),
      }))
      .query(async ({ input }) => {
        return getAssignmentForConversation(input.tenantId, input.sessionId, input.remoteJid);
      }),
    // Get available agents for a tenant
    agents: protectedProcedure
      .input(z.object({ tenantId: z.number().default(1) }))
      .query(async ({ input }) => getAgentsForTenant(input.tenantId)),
    // Get teams for a tenant
    teams: protectedProcedure
      .input(z.object({ tenantId: z.number().default(1) }))
      .query(async ({ input }) => getTeamsForTenant(input.tenantId)),
    // Auto-assign via round-robin
    autoAssign: protectedProcedure
      .input(z.object({
        tenantId: z.number().default(1),
        sessionId: z.string(),
        remoteJid: z.string(),
      }))
      .mutation(async ({ input }) => {
        const agentId = await getNextRoundRobinAgent(input.tenantId);
        if (!agentId) return { assigned: false, reason: "Nenhum agente disponível" };
        const result = await assignConversation(input.tenantId, input.sessionId, input.remoteJid, agentId);
        return { assigned: true, assignment: result };
      }),
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
    // Download media from Evolution API for messages that don't have mediaUrl yet
    getMediaUrl: protectedProcedure
      .input(z.object({ sessionId: z.string(), messageId: z.string() }))
      .mutation(async ({ input }) => {
        const { getBase64FromMediaMessage } = await import("./evolutionApi");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { waMessages } = await import("../drizzle/schema");
        const [msg] = await db.select().from(waMessages)
          .where(and(eq(waMessages.sessionId, input.sessionId), eq(waMessages.messageId, input.messageId)))
          .limit(1);
        if (!msg) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
        // Already has media URL cached (only if it's a permanent S3/CDN URL, not a temporary WhatsApp URL)
        if (msg.mediaUrl && !msg.mediaUrl.includes('whatsapp.net/')) {
          return { url: msg.mediaUrl, mimetype: msg.mediaMimeType, unavailable: false };
        }
        // Already marked as unavailable - don't retry
        if (msg.mediaUrl === null && msg.mediaMimeType === "__unavailable__") {
          return { url: null, mimetype: null, unavailable: true };
        }
        // Download from Evolution API - resolve the instanceName from the session
        const session = whatsappManager.getSession(input.sessionId);
        const instanceName = session?.instanceName || input.sessionId;
        const base64Data = await getBase64FromMediaMessage(instanceName, input.messageId, {
          remoteJid: msg.remoteJid,
          fromMe: msg.fromMe,
        });
        if (!base64Data?.base64) {
          // Mark as unavailable in DB so we don't keep retrying
          await db.update(waMessages)
            .set({ mediaMimeType: "__unavailable__" })
            .where(eq(waMessages.id, msg.id));
          return { url: null, mimetype: null, unavailable: true };
        }
        // Upload to S3
        const ext = (base64Data.mimetype || "bin").split("/")[1]?.split(";")[0] || "bin";
        const fileKey = `whatsapp-media/${input.sessionId}/${nanoid()}.${ext}`;
        const buffer = Buffer.from(base64Data.base64, "base64");
        const { url } = await storagePut(fileKey, buffer, base64Data.mimetype || "application/octet-stream");
        // Update the message in DB
        await db.update(waMessages)
          .set({ mediaUrl: url, mediaMimeType: base64Data.mimetype || null, mediaFileName: base64Data.fileName || null })
          .where(eq(waMessages.id, msg.id));
        return { url, mimetype: base64Data.mimetype, unavailable: false };
      }),
    // WA Contacts map (LID ↔ Phone resolution)
    waContactsMap: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return {};
        const { waContacts } = await import("../drizzle/schema");
        // Search contacts from ALL sessions to maximize name coverage
        // (contacts from old sessions like 'Whatsapp' have savedName data)
        const rows = await db.select().from(waContacts)
          .where(sql`${waContacts.jid} LIKE '%@s.whatsapp.net'`);
        // Build a map: jid -> { phoneNumber, pushName, savedName, verifiedName }
        // Merge duplicates: keep the best data from each record
        const map: Record<string, { phoneNumber: string | null; pushName: string | null; savedName: string | null; verifiedName: string | null }> = {};
        for (const r of rows) {
          const existing = map[r.jid];
          if (!existing) {
            map[r.jid] = {
              phoneNumber: r.phoneNumber,
              pushName: r.pushName,
              savedName: r.savedName,
              verifiedName: r.verifiedName,
            };
          } else {
            // Merge: prefer non-null values
            if (r.savedName && !existing.savedName) existing.savedName = r.savedName;
            if (r.verifiedName && !existing.verifiedName) existing.verifiedName = r.verifiedName;
            if (r.pushName && !existing.pushName) existing.pushName = r.pushName;
            if (r.phoneNumber && !existing.phoneNumber) existing.phoneNumber = r.phoneNumber;
          }
        }
        return map;
      }),
    // Force sync contacts from WhatsApp
    syncContacts: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input }) => {
        const result = await whatsappManager.syncContacts(input.sessionId);
        return result;
      }),
    // Trigger deep sync of all messages from Evolution API
    triggerDeepSync: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input }) => {
        const result = await whatsappManager.triggerDeepSync(input.sessionId);
        return result;
      }),
    // Manual trigger for daily backup
    triggerDailyBackup: protectedProcedure
      .mutation(async () => {
        const { runDailyWhatsAppBackup } = await import("./whatsappDailyBackup");
        const result = await runDailyWhatsAppBackup();
        return result;
      }),
    // ─── Conversation Identity Resolver: Migration & Reconciliation ───
    migrateConversations: protectedProcedure
      .input(z.object({ tenantId: z.number().default(1) }))
      .mutation(async ({ input }) => {
        const { migrateExistingData } = await import("./conversationResolver");
        return migrateExistingData(input.tenantId);
      }),
    reconcileGhosts: protectedProcedure
      .input(z.object({ tenantId: z.number().default(1), sessionId: z.string() }))
      .mutation(async ({ input }) => {
        const { reconcileGhostThreads } = await import("./conversationResolver");
        return reconcileGhostThreads(input.tenantId, input.sessionId);
      }),
    // Get wa_conversations debug info
    debugConversations: protectedProcedure
      .input(z.object({ tenantId: z.number().default(1), sessionId: z.string() }))
      .query(async ({ input }) => {
        const db = (await import("./db")).getDb;
        const dbInst = await db();
        if (!dbInst) return { conversations: [], identities: [] };
        const { waConversations, waIdentities } = await import("../drizzle/schema");
        const { eq, and, desc } = await import("drizzle-orm");
        const convs = await dbInst.select().from(waConversations)
          .where(and(eq(waConversations.tenantId, input.tenantId), eq(waConversations.sessionId, input.sessionId)))
          .orderBy(desc(waConversations.lastMessageAt))
          .limit(100);
        const ids = await dbInst.select().from(waIdentities)
          .where(and(eq(waIdentities.tenantId, input.tenantId), eq(waIdentities.sessionId, input.sessionId)))
          .orderBy(desc(waIdentities.lastSeenAt))
          .limit(100);
        return { conversations: convs, identities: ids };
      }),
  }),

  // ─── Message Monitoring ───
  monitoring: router({
    statusMetrics: protectedProcedure
      .input(z.object({ sessionId: z.string(), periodDays: z.number().min(1).max(365).default(7) }))
      .query(async ({ input }) => {
        return getMessageStatusMetrics(input.sessionId, input.periodDays);
      }),
    volumeOverTime: protectedProcedure
      .input(z.object({ sessionId: z.string(), periodDays: z.number().min(1).max(365).default(7), granularity: z.enum(["hour", "day"]).default("day") }))
      .query(async ({ input }) => {
        return getMessageVolumeOverTime(input.sessionId, input.periodDays, input.granularity);
      }),
    deliveryRate: protectedProcedure
      .input(z.object({ sessionId: z.string(), periodDays: z.number().min(1).max(365).default(7) }))
      .query(async ({ input }) => {
        return getDeliveryRateMetrics(input.sessionId, input.periodDays);
      }),
    recentActivity: protectedProcedure
      .input(z.object({ sessionId: z.string(), limit: z.number().min(1).max(200).default(50) }))
      .query(async ({ input }) => {
        return getRecentMessageActivity(input.sessionId, input.limit);
      }),
    typeDistribution: protectedProcedure
      .input(z.object({ sessionId: z.string(), periodDays: z.number().min(1).max(365).default(7) }))
      .query(async ({ input }) => {
        return getMessageTypeDistribution(input.sessionId, input.periodDays);
      }),
    topContacts: protectedProcedure
      .input(z.object({ sessionId: z.string(), periodDays: z.number().min(1).max(365).default(7), limit: z.number().min(1).max(50).default(10) }))
      .query(async ({ input }) => {
        return getTopContactsByVolume(input.sessionId, input.periodDays, input.limit);
      }),
    responseTime: protectedProcedure
      .input(z.object({ sessionId: z.string(), periodDays: z.number().min(1).max(365).default(7) }))
      .query(async ({ input }) => {
        return getResponseTimeMetrics(input.sessionId, input.periodDays);
      }),
  }),

  // ─── Dashboard ───
  dashboard: router({
    metrics: protectedProcedure
      .input(z.object({ tenantId: z.number(), pipelineId: z.number().optional(), dealStatus: z.enum(['open', 'won', 'lost', 'all']).optional() }))
      .query(async ({ input }) => {
        // Dashboard shows global metrics for the tenant (no owner filter)
        return getDashboardMetrics(input.tenantId, undefined, input.pipelineId, input.dealStatus);
      }),
    pipelineSummary: protectedProcedure
      .input(z.object({ tenantId: z.number(), pipelineId: z.number().optional(), dealStatus: z.enum(['open', 'won', 'lost', 'all']).optional() }))
      .query(async ({ input }) => {
        // Dashboard shows global pipeline summary for the tenant (no owner filter)
        return getPipelineSummary(input.tenantId, undefined, input.pipelineId, input.dealStatus);
      }),
    recentActivity: protectedProcedure
      .input(z.object({ tenantId: z.number(), limit: z.number().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
      .query(async ({ input }) => {
        return getRecentActivity(input.tenantId, input.limit, input.dateFrom, input.dateTo);
      }),
    upcomingTasks: protectedProcedure
      .input(z.object({ tenantId: z.number(), limit: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        return getUpcomingTasks(input.tenantId, ctx.user?.id, input.limit);
      }),
    whatsappMetrics: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return getDashboardWhatsAppMetrics(input.tenantId);
      }),
    dealsTimeline: protectedProcedure
      .input(z.object({ tenantId: z.number(), days: z.number().optional() }))
      .query(async ({ input }) => {
        return getDashboardDealsTimeline(input.tenantId, input.days);
      }),
    conversionRates: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return getDashboardConversionRates(input.tenantId);
      }),
    funnelData: protectedProcedure
      .input(z.object({ tenantId: z.number(), pipelineId: z.number().optional() }))
      .query(async ({ input }) => {
        return getDashboardFunnelData(input.tenantId, input.pipelineId);
      }),
    allPipelines: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return getDashboardAllPipelines(input.tenantId);
      }),
  }),

  // ─── User Preferences ───
  preferences: router({
    get: protectedProcedure
      .input(z.object({ tenantId: z.number(), key: z.string() }))
      .query(async ({ input, ctx }) => {
        const val = await getUserPreference(ctx.user!.id, input.tenantId, input.key);
        return { key: input.key, value: val };
      }),
    set: protectedProcedure
      .input(z.object({ tenantId: z.number(), key: z.string(), value: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await setUserPreference(ctx.user!.id, input.tenantId, input.key, input.value);
        return { success: true };
      }),
    getAll: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input, ctx }) => {
        return getAllUserPreferences(ctx.user!.id, input.tenantId);
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

  // ─── Notifications ───
  notifications: router({
    list: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        onlyUnread: z.boolean().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return getNotifications(input.tenantId, {
          onlyUnread: input.onlyUnread,
          limit: input.limit,
          offset: input.offset,
        });
      }),
    unreadCount: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return getUnreadNotificationCount(input.tenantId);
      }),
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await markNotificationRead(input.id);
        return { success: true };
      }),
    markAllRead: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .mutation(async ({ input }) => {
        await markAllNotificationsRead(input.tenantId);
        return { success: true };
      }),
  }),

  // ─── Team & Agent Management ───
  teamManagement: router({
    // ── Teams CRUD ──
    listTeams: protectedProcedure
      .input(z.object({ tenantId: z.number().default(1) }))
      .query(async ({ input }) => getTeamsForTenant(input.tenantId)),
    getTeam: protectedProcedure
      .input(z.object({ tenantId: z.number().default(1), teamId: z.number() }))
      .query(async ({ input }) => getTeamWithMembers(input.teamId, input.tenantId)),
    createTeam: protectedProcedure
      .input(z.object({
        tenantId: z.number().default(1),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        color: z.string().optional(),
        maxMembers: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { tenantId, ...data } = input;
        return createTeam(tenantId, data);
      }),
    updateTeam: protectedProcedure
      .input(z.object({
        tenantId: z.number().default(1),
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        maxMembers: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { tenantId, id, ...data } = input;
        return updateTeam(id, tenantId, data);
      }),
    deleteTeam: protectedProcedure
      .input(z.object({ tenantId: z.number().default(1), id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteTeam(input.id, input.tenantId);
        return { success: true };
      }),
    // ── Team Members ──
    addMember: protectedProcedure
      .input(z.object({
        tenantId: z.number().default(1),
        teamId: z.number(),
        userId: z.number(),
        role: z.enum(["member", "leader"]).default("member"),
      }))
      .mutation(async ({ input }) => addTeamMember(input.tenantId, input.teamId, input.userId, input.role)),
    removeMember: protectedProcedure
      .input(z.object({
        tenantId: z.number().default(1),
        teamId: z.number(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await removeTeamMember(input.tenantId, input.teamId, input.userId);
        return { success: true };
      }),
    updateMemberRole: protectedProcedure
      .input(z.object({
        tenantId: z.number().default(1),
        teamId: z.number(),
        userId: z.number(),
        role: z.enum(["member", "leader"]),
      }))
      .mutation(async ({ input }) => {
        await updateTeamMemberRole(input.tenantId, input.teamId, input.userId, input.role);
        return { success: true };
      }),
    // ── Agents ──
    inviteAgent: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        role: z.enum(["admin", "user"]).default("user"),
        origin: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only admins can invite agents
        if (ctx.saasUser?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem convidar agentes" });
        }
        try {
          // inviteUserToTenant imported statically at top of file
          const result = await inviteUserToTenant({
            tenantId: input.tenantId,
            name: input.name,
            email: input.email,
            phone: input.phone,
            role: input.role,
            inviterName: ctx.user.name || "Administrador",
            origin: input.origin || "https://crm.acelerador.tur.br",
          });
          return { success: true, userId: result.userId, emailSent: result.emailSent };
        } catch (e: any) {
          if (e.message === "EMAIL_EXISTS_IN_TENANT") {
            throw new TRPCError({ code: "CONFLICT", message: "Este email já está cadastrado neste tenant" });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message || "Erro ao convidar agente" });
        }
      }),
    listAgents: protectedProcedure
      .input(z.object({ tenantId: z.number().default(1) }))
      .query(async ({ input }) => getAgentsWithTeams(input.tenantId)),
    updateAgentStatus: protectedProcedure
      .input(z.object({
        tenantId: z.number().default(1),
        userId: z.number(),
        status: z.enum(["active", "inactive", "invited"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only admins can update agent status
        if (ctx.saasUser?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem alterar status de agentes" });
        }
        await updateAgentStatus(input.tenantId, input.userId, input.status);
        return { success: true };
      }),
    updateAgentRole: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        userId: z.number(),
        role: z.enum(["admin", "user"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only admins can change roles
        if (ctx.saasUser?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem alterar permissões" });
        }
        // Cannot change own role
        if (ctx.saasUser?.userId === input.userId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode alterar sua própria permissão" });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { crmUsers: crmUsersTable } = await import("../drizzle/schema");
        const { eq: eqOp, and: andOp } = await import("drizzle-orm");
        await db.update(crmUsersTable).set({ role: input.role }).where(andOp(eqOp(crmUsersTable.id, input.userId), eqOp(crmUsersTable.tenantId, input.tenantId)));
        return { success: true };
      }),
    // ── Distribution Rules ──
    listRules: protectedProcedure
      .input(z.object({ tenantId: z.number().default(1) }))
      .query(async ({ input }) => getDistributionRules(input.tenantId)),
    createRule: protectedProcedure
      .input(z.object({
        tenantId: z.number().default(1),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        strategy: z.enum(["round_robin", "least_busy", "manual", "team_round_robin"]),
        teamId: z.number().nullable().optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        priority: z.number().optional(),
        configJson: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        const { tenantId, ...data } = input;
        return createDistributionRule(tenantId, data);
      }),
    updateRule: protectedProcedure
      .input(z.object({
        tenantId: z.number().default(1),
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        strategy: z.enum(["round_robin", "least_busy", "manual", "team_round_robin"]).optional(),
        teamId: z.number().nullable().optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        priority: z.number().optional(),
        configJson: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        const { tenantId, id, ...data } = input;
        return updateDistributionRule(id, tenantId, data);
      }),
    deleteRule: protectedProcedure
      .input(z.object({ tenantId: z.number().default(1), id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteDistributionRule(input.id, input.tenantId);
        return { success: true };
      }),
    toggleRule: protectedProcedure
      .input(z.object({ tenantId: z.number().default(1), id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        await toggleDistributionRule(input.id, input.tenantId, input.isActive);
        return { success: true };
      }),
  }),

  // ─── ENTUR OS CRM Modules ───
  admin: adminRouter,       // M0: Admin/IAM
  crm: crmRouter,           // M2: CRM (Contacts, Deals, Pipelines, Trips, Tasks, Notes)
  inbox: inboxRouter,       // M1: Inbox Omnichannel
  proposals: proposalRouter, // M3: Propostas
  portal: portalRouter,     // M4: Portal do Cliente
  management: managementRouter, // M5: Gestão
  insights: insightsRouter, // M6: Insights
  academy: academyRouter,   // M7: Academy
  integrationHub: integrationHubRouter, // M8: Integration Hub
  productCatalog: productCatalogRouter, // M9: Catálogo de Produtos Turísticos
  aiAnalysis: aiAnalysisRouter, // M10: Análise de Atendimento por IA
  utmAnalytics: utmAnalyticsRouter, // M11: Dashboard de Rastreamento UTM
  rdCrmImport: rdCrmImportRouter, // M12: Importação do RD Station CRM
  saasAuth: saasAuthRouter, // SaaS Authentication (email/senha)
  rfv: rfvRouter, // M13: Matriz RFV — Classificação Automática de Contatos
  profile: profileRouter, // Perfil do usuário (avatar, nome, senha, Google Calendar)

  // ─── Contact Profile & Custom Fields ───
  contactProfile: router({
    getMetrics: protectedProcedure
      .input(z.object({ tenantId: z.number(), contactId: z.number() }))
      .query(async ({ input }) => {
        return getContactMetrics(input.tenantId, input.contactId);
      }),
    getDeals: protectedProcedure
      .input(z.object({ tenantId: z.number(), contactId: z.number() }))
      .query(async ({ input }) => {
        return getContactDeals(input.tenantId, input.contactId);
      }),
    getCustomFieldValues: protectedProcedure
      .input(z.object({ tenantId: z.number(), entityType: z.enum(["contact", "deal", "account", "trip"]), entityId: z.number() }))
      .query(async ({ input }) => {
        return getCustomFieldValues(input.tenantId, input.entityType, input.entityId);
      }),
    setCustomFieldValues: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        entityType: z.enum(["contact", "deal", "account", "trip"]),
        entityId: z.number(),
        values: z.array(z.object({ fieldId: z.number(), value: z.string().nullable() })),
      }))
      .mutation(async ({ input }) => {
        await setCustomFieldValues(input.tenantId, input.entityType, input.entityId, input.values);
        return { success: true };
      }),
  }),

  customFields: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), entity: z.enum(["contact", "deal", "account", "trip"]) }))
      .query(async ({ input }) => {
        return listCustomFields(input.tenantId, input.entity);
      }),
    get: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .query(async ({ input }) => {
        return getCustomFieldById(input.tenantId, input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        entity: z.enum(["contact", "deal", "account", "trip"]),
        name: z.string().min(1).max(128),
        label: z.string().min(1).max(255),
        fieldType: z.enum(["text", "number", "date", "select", "multiselect", "checkbox", "textarea", "email", "phone", "url", "currency"]),
        optionsJson: z.any().optional(),
        defaultValue: z.string().optional(),
        placeholder: z.string().optional(),
        isRequired: z.boolean().optional(),
        isVisibleOnForm: z.boolean().optional(),
        isVisibleOnProfile: z.boolean().optional(),
        sortOrder: z.number().optional(),
        groupName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return createCustomField(input);
      }),
    update: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        id: z.number(),
        label: z.string().optional(),
        fieldType: z.string().optional(),
        optionsJson: z.any().optional(),
        defaultValue: z.string().optional(),
        placeholder: z.string().optional(),
        isRequired: z.boolean().optional(),
        isVisibleOnForm: z.boolean().optional(),
        isVisibleOnProfile: z.boolean().optional(),
        sortOrder: z.number().optional(),
        groupName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { tenantId, id, ...data } = input;
        return updateCustomField(tenantId, id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCustomField(input.tenantId, input.id);
        return { success: true };
      }),
    reorder: protectedProcedure
      .input(z.object({ tenantId: z.number(), entity: z.enum(["contact", "deal", "account", "trip"]), orderedIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await reorderCustomFields(input.tenantId, input.entity, input.orderedIds);
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════
  // LEAD CAPTURE & INTEGRATIONS
  // ═══════════════════════════════════════
  leadCapture: router({
    // Webhook config
    getWebhookConfig: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        const config = await getWebhookConfig(input.tenantId);
        return config;
      }),
    generateWebhookToken: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .mutation(async ({ input }) => {
        const secret = randomBytes(32).toString("hex");
        const config = await upsertWebhookConfig(input.tenantId, secret);
        return config;
      }),

    // Meta integration
    getMetaConfig: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        const config = await getMetaConfig(input.tenantId);
        // Don't expose full access token to frontend
        if (config?.accessToken) {
          return { ...config, accessToken: "••••" + config.accessToken.slice(-8) };
        }
        return config;
      }),
    connectMeta: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        pageId: z.string(),
        pageName: z.string().optional(),
        accessToken: z.string(),
        appSecret: z.string().optional(),
        verifyToken: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const verifyToken = input.verifyToken || randomBytes(16).toString("hex");
        const config = await upsertMetaConfig(input.tenantId, {
          pageId: input.pageId,
          pageName: input.pageName,
          accessToken: input.accessToken,
          appSecret: input.appSecret,
          verifyToken,
          status: "connected",
        });
        return config;
      }),
    disconnectMeta: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .mutation(async ({ input }) => {
        await disconnectMeta(input.tenantId);
        return { success: true };
      }),

    // Event logs
    listEvents: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        source: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const [events, total] = await Promise.all([
          listLeadEvents(input.tenantId, input),
          countLeadEvents(input.tenantId, input),
        ]);
        return { events, total };
      }),
    reprocessEvent: protectedProcedure
      .input(z.object({ tenantId: z.number(), eventId: z.number() }))
      .mutation(async ({ input }) => {
        return reprocessLeadEvent(input.tenantId, input.eventId);
      }),

    // ─── Tracking Script Tokens ────────────────────────
    listTrackingTokens: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(trackingTokens)
          .where(eq(trackingTokens.tenantId, input.tenantId))
          .orderBy(desc(trackingTokens.createdAt));
      }),

    createTrackingToken: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        name: z.string().min(1).max(255),
        allowedDomains: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const token = randomBytes(32).toString("hex");
        const [result] = await db.insert(trackingTokens).values({
          tenantId: input.tenantId,
          token,
          name: input.name,
          allowedDomains: input.allowedDomains || null,
        }).$returningId();
        return { id: result!.id, token, name: input.name };
      }),

    updateTrackingToken: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        tokenId: z.number(),
        name: z.string().min(1).max(255).optional(),
        allowedDomains: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const updates: Record<string, any> = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.allowedDomains !== undefined) updates.allowedDomains = input.allowedDomains;
        if (input.isActive !== undefined) updates.isActive = input.isActive;
        if (Object.keys(updates).length === 0) return { success: true };
        await db
          .update(trackingTokens)
          .set(updates)
          .where(and(eq(trackingTokens.id, input.tokenId), eq(trackingTokens.tenantId, input.tenantId)));
        return { success: true };
      }),

    deleteTrackingToken: protectedProcedure
      .input(z.object({ tenantId: z.number(), tokenId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db
          .delete(trackingTokens)
          .where(and(eq(trackingTokens.id, input.tokenId), eq(trackingTokens.tenantId, input.tenantId)));
        return { success: true };
      }),

    getTrackingSnippet: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        tokenId: z.number(),
        collectUrl: z.string().url(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const rows = await db
          .select()
          .from(trackingTokens)
          .where(and(eq(trackingTokens.id, input.tokenId), eq(trackingTokens.tenantId, input.tenantId)))
          .limit(1);
        if (rows.length === 0) throw new Error("Token not found");
        const tokenRow = rows[0]!;
        const script = generateTrackerScript(tokenRow.token, input.collectUrl);
        // Use a bootstrap technique that WP Rocket / LiteSpeed / Autoptimize cannot intercept.
        // The outer <script> is tiny and creates the real script element programmatically.
        // This bypasses type="rocketlazyloadscript" and similar lazy-load rewrites.
        const escaped = script.replace(/<\//g, '<\\/');
        const bootstrap = `<script data-cfasync="false" data-no-optimize="1" data-pagespeed-no-defer>
(function(){var s=document.createElement('script');s.textContent=${JSON.stringify(escaped)};document.head.appendChild(s);})()
</script>`;
        return { snippet: bootstrap };
      }),

    verifyTrackingInstallation: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        url: z.string().url(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get all tokens for this tenant
        const tenantTokens = await db
          .select()
          .from(trackingTokens)
          .where(eq(trackingTokens.tenantId, input.tenantId));

        if (!tenantTokens.length) {
          return {
            installed: false,
            status: "no_tokens" as const,
            message: "Nenhum token de tracking criado. Crie um token primeiro.",
            details: null,
          };
        }

        try {
          // Fetch the page HTML
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(input.url, {
            signal: controller.signal,
            headers: {
              "User-Agent": "ENTUR-OS-Tracker-Verifier/1.0",
              "Accept": "text/html",
            },
            redirect: "follow",
          });
          clearTimeout(timeout);

          if (!res.ok) {
            return {
              installed: false,
              status: "fetch_error" as const,
              message: `N\u00e3o foi poss\u00edvel acessar a p\u00e1gina (HTTP ${res.status}).`,
              details: { httpStatus: res.status },
            };
          }

          const html = await res.text();

          // Check for each token in the HTML
          for (const t of tenantTokens) {
            if (html.includes(t.token)) {
              return {
                installed: true,
                status: "active" as const,
                message: `Script encontrado e ativo! Token "${t.name}" detectado na p\u00e1gina.`,
                details: {
                  tokenId: t.id,
                  tokenName: t.name,
                  isActive: t.isActive,
                  totalLeads: t.totalLeads,
                },
              };
            }
          }

          // Check if there's ANY entur tracker script (maybe wrong token)
          const hasTrackerRef = html.includes("/tracker.js") || html.includes("__entur_tracker_loaded") || html.includes("/api/collect");
          if (hasTrackerRef) {
            return {
              installed: false,
              status: "wrong_token" as const,
              message: "Um script de tracking foi encontrado, mas o token n\u00e3o pertence a esta conta. Verifique se copiou o c\u00f3digo correto.",
              details: null,
            };
          }

          return {
            installed: false,
            status: "not_found" as const,
            message: "Script de tracking n\u00e3o encontrado nesta p\u00e1gina. Verifique se o c\u00f3digo foi inserido no <head> ou <body>.",
            details: null,
          };
        } catch (err: any) {
          if (err.name === "AbortError") {
            return {
              installed: false,
              status: "timeout" as const,
              message: "Tempo esgotado ao tentar acessar a p\u00e1gina. Verifique se a URL est\u00e1 correta e acess\u00edvel.",
              details: null,
            };
          }
          return {
            installed: false,
            status: "error" as const,
            message: `Erro ao verificar: ${err.message || "Falha de conex\u00e3o"}`,
            details: null,
          };
        }
      }),
  }),

  // ─── RD Station Marketing Integration ───
  rdStation: router({
    getConfig: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const rows = await db
          .select()
          .from(rdStationConfig)
          .where(eq(rdStationConfig.tenantId, input.tenantId))
          .limit(1);
        return rows[0] || null;
      }),

    setupIntegration: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Check if already exists
        const existing = await db
          .select()
          .from(rdStationConfig)
          .where(eq(rdStationConfig.tenantId, input.tenantId))
          .limit(1);

        if (existing.length > 0) {
          return existing[0];
        }

        // Generate a unique webhook token
        const token = randomBytes(32).toString("hex");
        const [result] = await db.insert(rdStationConfig).values({
          tenantId: input.tenantId,
          webhookToken: token,
        }).$returningId();

        const rows = await db
          .select()
          .from(rdStationConfig)
          .where(eq(rdStationConfig.id, result!.id))
          .limit(1);
        return rows[0]!;
      }),

    regenerateToken: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const newToken = randomBytes(32).toString("hex");
        await db
          .update(rdStationConfig)
          .set({ webhookToken: newToken })
          .where(eq(rdStationConfig.tenantId, input.tenantId));

        const rows = await db
          .select()
          .from(rdStationConfig)
          .where(eq(rdStationConfig.tenantId, input.tenantId))
          .limit(1);
        return rows[0]!;
      }),

    toggleActive: protectedProcedure
      .input(z.object({ tenantId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db
          .update(rdStationConfig)
          .set({ isActive: input.isActive })
          .where(eq(rdStationConfig.tenantId, input.tenantId));
        return { success: true };
      }),

    getWebhookLogs: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        status: z.enum(["success", "failed", "duplicate"]).optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { logs: [], total: 0 };

        const conditions: any[] = [eq(rdStationWebhookLog.tenantId, input.tenantId)];
        if (input.status) {
          conditions.push(eq(rdStationWebhookLog.status, input.status));
        }

        const logs = await db
          .select()
          .from(rdStationWebhookLog)
          .where(and(...conditions))
          .orderBy(desc(rdStationWebhookLog.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(rdStationWebhookLog)
          .where(and(...conditions));

        return {
          logs,
          total: Number(countResult[0]?.count || 0),
        };
      }),

    getStats: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { total: 0, success: 0, failed: 0, duplicate: 0 };

        const stats = await db
          .select({
            status: rdStationWebhookLog.status,
            count: sql<number>`count(*)`,
          })
          .from(rdStationWebhookLog)
          .where(eq(rdStationWebhookLog.tenantId, input.tenantId))
          .groupBy(rdStationWebhookLog.status);

        const result = { total: 0, success: 0, failed: 0, duplicate: 0 };
        for (const row of stats) {
          const count = Number(row.count);
          result.total += count;
          if (row.status === "success") result.success = count;
          if (row.status === "failed") result.failed = count;
          if (row.status === "duplicate") result.duplicate = count;
        }
        return result;
      }),
  }),

  // ── Field Mappings (RD Station ↔ Entur OS) ──
  fieldMappings: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const mappings = await db.select().from(rdFieldMappings)
          .where(eq(rdFieldMappings.tenantId, input.tenantId))
          .orderBy(rdFieldMappings.createdAt);
        return mappings;
      }),

    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        rdFieldKey: z.string().min(1),
        rdFieldLabel: z.string().min(1),
        enturFieldType: z.enum(["standard", "custom"]),
        enturFieldKey: z.string().optional(),
        enturCustomFieldId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [result] = await db.insert(rdFieldMappings).values({
          tenantId: input.tenantId,
          rdFieldKey: input.rdFieldKey,
          rdFieldLabel: input.rdFieldLabel,
          enturFieldType: input.enturFieldType,
          enturFieldKey: input.enturFieldKey || null,
          enturCustomFieldId: input.enturCustomFieldId || null,
        }).$returningId();
        return { id: result!.id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        tenantId: z.number(),
        rdFieldKey: z.string().min(1).optional(),
        rdFieldLabel: z.string().min(1).optional(),
        enturFieldType: z.enum(["standard", "custom"]).optional(),
        enturFieldKey: z.string().nullable().optional(),
        enturCustomFieldId: z.number().nullable().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, tenantId, ...updates } = input;
        await db.update(rdFieldMappings).set(updates)
          .where(and(eq(rdFieldMappings.id, id), eq(rdFieldMappings.tenantId, tenantId)));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number(), tenantId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(rdFieldMappings)
          .where(and(eq(rdFieldMappings.id, input.id), eq(rdFieldMappings.tenantId, input.tenantId)));
        return { success: true };
      }),

    // Lista campos padrão do Entur OS disponíveis para mapeamento
    enturStandardFields: protectedProcedure
      .query(async () => {
        return [
          { key: "contact.name", label: "Contato — Nome", entity: "contact" },
          { key: "contact.email", label: "Contato — Email", entity: "contact" },
          { key: "contact.phone", label: "Contato — Telefone", entity: "contact" },
          { key: "account.name", label: "Empresa — Nome", entity: "account" },
          { key: "deal.title", label: "Negociação — Título", entity: "deal" },
          { key: "deal.valueCents", label: "Negociação — Valor", entity: "deal" },
          { key: "deal.utmSource", label: "Negociação — UTM Source", entity: "deal" },
          { key: "deal.utmMedium", label: "Negociação — UTM Medium", entity: "deal" },
          { key: "deal.utmCampaign", label: "Negociação — UTM Campaign", entity: "deal" },
          { key: "deal.utmTerm", label: "Negociação — UTM Term", entity: "deal" },
          { key: "deal.utmContent", label: "Negociação — UTM Content", entity: "deal" },
          { key: "deal.channelOrigin", label: "Negociação — Canal de Origem", entity: "deal" },
          { key: "deal.leadSource", label: "Negociação — Fonte do Lead", entity: "deal" },
        ];
      }),

    // Lista campos personalizados do Entur OS disponíveis para mapeamento
    enturCustomFields: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const fields = await db.select().from(customFields)
          .where(eq(customFields.tenantId, input.tenantId))
          .orderBy(customFields.entity, customFields.sortOrder);
        return fields.map(f => ({
          id: f.id,
          key: `custom.${f.name}`,
          label: `${f.entity === "deal" ? "Negociação" : f.entity === "contact" ? "Contato" : "Empresa"} — ${f.label}`,
          entity: f.entity,
          fieldType: f.fieldType,
        }));
      }),
  }),
});

export type AppRouter = typeof appRouter;
