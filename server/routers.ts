import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { superAdminDashRouter } from "./routers/superAdminDashRouter";
import { superAdminPlansRouter } from "./routers/superAdminPlansRouter";
import { superAdminManagementRouter } from "./routers/superAdminManagementRouter";
import { publicProcedure, tenantProcedure, tenantWriteProcedure, tenantAdminProcedure, sessionTenantProcedure, sessionTenantWriteProcedure, sessionTenantAdminProcedure, getTenantId, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { whatsappManager } from "./whatsappEvolution";
import { zapiProvider } from "./providers/zapiProvider";
import { getIo } from "./socketSingleton";
import {
  getSessionsByUser,
  getSessionsByTenant,
  getMessages,
  getMessagesByContact,
  getReactionsForMessages,
  getLogs,
  getAllLogs,
  getChatbotSettings,
  upsertChatbotSettings,
  getChatbotRules,
  addChatbotRule,
  removeChatbotRule,
  // getConversationsList, // DEPRECATED: redirected to getWaConversationsList
  markConversationRead,
  getDashboardMetrics,
  getPipelineSummary,
  getRecentActivity,
  getUpcomingTasks,
  globalSearch,
  globalSearchWithVisibility,
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  // Multi-agent / SaaS
  // getConversationsListMultiAgent, // DEPRECATED: redirected to getWaConversationsList
  assignConversation,
  updateAssignmentStatus,
  finishAttendance,
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
  // Session sharing
  getActiveShareForUser,
  getSharesForSession,
  getAllSharesForTenant,
  createSessionShare,
  revokeSessionShare,
  revokeAllSharesForSession,
  getSessionBySessionId,
  // Helpdesk
  createInternalNote,
  getInternalNotes,
  deleteInternalNote,
  updateInternalNote,
  getCustomerGlobalNotes,
  getConversationEvents,
  logConversationEvent,
  getQueueConversations,
  claimConversation,
  enqueueConversation,
  getAgentWorkload,
  getAgentConversations,
  getQueueStats,
  getQuickReplies,
  createQuickReply,
  deleteQuickReply,
  updateQuickReply,
  incrementQuickReplyUsage,
  // Conversation Tags
  listConversationTags,
  createConversationTag,
  deleteConversationTag,
  getTagsForConversation,
  addTagToConversation,
  removeTagFromConversation,
  // Pin / Archive
  pinConversation,
  archiveConversation,
  // Scheduled Messages
  listScheduledMessages,
  createScheduledMessage,
  cancelScheduledMessage,
  getProfilePicturesFromDb,
  transferConversationWithNote,
  // AI Integrations
  listAiIntegrations,
  getAiIntegration,
  getActiveAiIntegration,
  createAiIntegration,
  updateAiIntegration,
  deleteAiIntegration,
  testAiApiKey,
  // Tenant AI settings
  getTenantAiSettings,
  updateTenantAiSettings,
  getAnyActiveAiIntegration,
  // AI Training configs
  getAiTrainingConfig,
  listAiTrainingConfigs,
  upsertAiTrainingConfig,
  deleteAiTrainingConfig,
  callTenantAi,
  // Conversation locks (Part 8)
  acquireConversationLock,
  releaseConversationLock,
  getConversationLock,
} from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// CRM Routers
import { adminRouter } from "./routers/adminRouter";
import { crmRouter } from "./routers/crmRouter";
import { inboxRouter } from "./routers/inboxRouter";
import { proposalRouter, portalRouter, managementRouter, insightsRouter, academyRouter, integrationHubRouter, tenantBrandingRouter, whatsappQuickRouter } from "./routers/featureRouters";
import { asaasRouter } from "./routers/asaasRouter";
import { productCatalogRouter } from "./routers/productCatalogRouter";
import { aiAnalysisRouter } from "./routers/aiAnalysisRouter";
import { utmAnalyticsRouter } from "./routers/utmAnalyticsRouter";
import { sourcesCampaignsRouter } from "./routers/sourcesCampaignsRouter";
import { rdCrmImportRouter } from "./routers/rdCrmImportRouter";
import { saasAuthRouter } from "./routers/saasAuthRouter";
import { billingRouter } from "./routers/billingRouter";
import { inviteUserToTenant } from "./saasAuth";
import { assertCanAddUser } from "./services/billingAccessService";
import { rfvRouter } from "./routers/rfvRouter";
import { profileRouter } from "./routers/profileRouter";
import { analyticsRouter } from "./routers/analyticsRouter";
import { zapiAdminRouter } from "./routers/zapiAdminRouter";
import { exportRouter } from "./routers/exportRouter";
import { getHomeExecutive, getHomeTasks, getHomeRFV, getHomeOnboarding, toggleOnboardingStep, dismissOnboarding, isOnboardingDismissed, getHomeFilterOptions, getUpcomingAppointments } from "./services/homeService";
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
import { trackingTokens, rdStationConfig, rdStationWebhookLog, rdFieldMappings, customFields, crmUsers as crmUsersSchema, pipelines, pipelineStages, whatsappSessions, rdStationConfigTasks, productCatalog } from "../drizzle/schema";
import { generateTrackerScript } from "./tracker-script";
import { eq, and, desc, asc, sql, lt } from "drizzle-orm";
import { generateSuggestion, refineSuggestion, splitTextNaturally, type ResponseStyle } from "./aiSuggestionService";
import { requestSuggestion, cancelSuggestion, cancelChatSuggestions } from "./aiSuggestionWorker";

/** Parse AI suggestion response into parts array. Handles JSON or plain text fallback. */
function parseAiSuggestionParts(raw: string): { full: string; parts: string[] } {
  // Strip any dashes used as em-dash or bullet
  const cleaned = raw.replace(/[\u2014\u2013]/g, ",").replace(/^\s*[-\*]\s+/gm, "");
  try {
    // Try to parse JSON from the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.parts) && parsed.parts.length > 0) {
        const parts = parsed.parts.map((p: string) => p.replace(/[\u2014\u2013]/g, ",").trim()).filter(Boolean);
        return { full: parts.join("\n\n"), parts };
      }
    }
  } catch {}
  // Fallback: split by double newline or single newline for multi-part
  const lines = cleaned.split(/\n\n+/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    return { full: lines.join("\n\n"), parts: lines };
  }
  // Single message fallback
  return { full: cleaned.trim(), parts: [cleaned.trim()] };
}

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
            const crmUser = await db.execute(
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
    connect: tenantWriteProcedure
      .input(z.object({ provider: z.enum(["zapi"]).optional() }).optional())
      .mutation(async ({ input, ctx }) => {
        // Each CRM user gets exactly ONE WhatsApp instance
        // No sessionId needed — system generates it automatically
        const tenantId = getTenantId(ctx);
        const { assertFeatureAccess } = await import("./services/planLimitsService");
        await assertFeatureAccess(tenantId, "whatsappEmbedded");
        const userId = ctx.saasUser?.userId || ctx.user.id;

        // Block connection if user has an active session share
        if (tenantId > 0) {
          const activeShare = await getActiveShareForUser(tenantId, userId);
          if (activeShare) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Você está usando uma sessão compartilhada. Para conectar seu próprio WhatsApp, peça ao administrador para revogar o compartilhamento.",
            });
          }
        }

        // ─── Z-API PROVIDER ───
        const { getZapiInstanceForTenant } = await import("./services/zapiProvisioningService");
        const { registerZApiSession } = await import("./providers/zapiProvider");
        const { zapiProvider } = await import("./providers/zapiProvider");

        const zapiInstance = await getZapiInstanceForTenant(tenantId);
        if (!zapiInstance) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Nenhuma instância Z-API provisionada para este tenant. Solicite ao administrador.",
          });
        }

        // Validate that the Z-API instance is still active (not cancelled/expired)
        if (zapiInstance.status !== "active") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Instância Z-API está ${zapiInstance.status}. Solicite ao administrador para reativar.`,
          });
        }

        const sessionId = `crm-${tenantId}-${userId}`;

        // Register Z-API session credentials
        registerZApiSession(sessionId, {
          instanceId: zapiInstance.zapiInstanceId,
          token: zapiInstance.zapiToken,
          clientToken: zapiInstance.zapiClientToken || undefined,
        });

        // Check if already connected via Z-API
        try {
          const existingInst = await zapiProvider.fetchInstance(sessionId);
          if (existingInst?.connectionStatus === "open") {
            // Already connected — update DB and return
            const db = await getDb();
            const [existingSession] = await db!.select({ id: whatsappSessions.id })
              .from(whatsappSessions)
              .where(eq(whatsappSessions.sessionId, sessionId))
              .limit(1);
            
            const sessionData = {
              status: "connected" as const,
              provider: "zapi" as const,
              providerInstanceId: zapiInstance.zapiInstanceId,
              providerToken: zapiInstance.zapiToken,
              providerClientToken: zapiInstance.zapiClientToken,
              phoneNumber: existingInst.phoneNumber || null,
            };

            if (existingSession) {
              await db!.update(whatsappSessions).set(sessionData).where(eq(whatsappSessions.sessionId, sessionId));
            } else {
              await db!.insert(whatsappSessions).values({ sessionId, userId, tenantId, ...sessionData });
            }

            return { sessionId, status: "connected", qrDataUrl: null, user: null };
          }
        } catch (e) {
          // Instance might not exist yet on Z-API side, continue to QR
        }

        // Generate QR code via Z-API
        try {
          const qrResult = await zapiProvider.connectInstance(sessionId);
          const qrDataUrl = qrResult?.base64 || null;

          // Save/update session in DB with Z-API provider info
          const db = await getDb();
          const [existingSession] = await db!.select({ id: whatsappSessions.id })
            .from(whatsappSessions)
            .where(eq(whatsappSessions.sessionId, sessionId))
            .limit(1);

          const sessionData = {
            status: "connecting" as const,
            provider: "zapi" as const,
            providerInstanceId: zapiInstance.zapiInstanceId,
            providerToken: zapiInstance.zapiToken,
            providerClientToken: zapiInstance.zapiClientToken,
          };

          if (existingSession) {
            await db!.update(whatsappSessions).set(sessionData).where(eq(whatsappSessions.sessionId, sessionId));
          } else {
            await db!.insert(whatsappSessions).values({ sessionId, userId, tenantId, ...sessionData });
          }

          // Also update in-memory session for WebSocket/polling
          whatsappManager.setSessionState(sessionId, {
            instanceName: sessionId,
            sessionId,
            userId,
            tenantId,
            status: "connecting",
            qrCode: qrDataUrl,
            qrDataUrl,
            user: null,
            lastConnectedAt: null,
            connectingStartedAt: Date.now(),
          });

          return { sessionId, status: "connecting", qrDataUrl, user: null };
        } catch (e: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao gerar QR Code via Z-API: ${e.message}`,
          });
        }
      }),
    disconnect: sessionTenantProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await whatsappManager.disconnect(input.sessionId);
        return { success: true };
      }),
    // Soft-delete: move session to trash (any user can do this)
    deleteSession: sessionTenantProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await whatsappManager.deleteSession(input.sessionId, false);
        return { success: true };
      }),
    // Hard-delete: permanently remove session (admin only)
    hardDeleteSession: sessionTenantProcedure
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
    status: sessionTenantProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input, ctx }) => {
        const session = await whatsappManager.getSessionLive(input.sessionId);
        return { status: session?.status || "disconnected", qrDataUrl: session?.qrDataUrl || null, user: session?.user || null };
      }),
    // Request pairing code as alternative to QR code (Z-API phone-code)
    requestPairingCode: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), phoneNumber: z.string().min(8).max(20) }))
      .mutation(async ({ ctx, input }) => {
        const code = await zapiProvider.getPhoneCode(input.sessionId, input.phoneNumber);
        if (!code) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível gerar o código de pareamento. Verifique se a instância está ativa." });
        }
        return { code };
      }),
    // Get own profile picture URL
    getInstanceProfilePicture: sessionTenantProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        const url = await zapiProvider.getOwnProfilePicture(input.sessionId);
        return { url };
      }),
    // Update own profile picture
    updateInstanceProfilePicture: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), imageUrl: z.string().url() }))
      .mutation(async ({ input }) => {
        const success = await zapiProvider.updateOwnProfilePicture(input.sessionId, input.imageUrl);
        if (!success) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível atualizar a foto de perfil." });
        }
        return { success: true };
      }),
    sessions: tenantProcedure.query(async ({ ctx }) => {
      // Each user has their own WhatsApp instance (Evolution API)
      // Filter by the CRM userId (saasUser.id) so users only see their own sessions
      const saasUserId = ctx.saasUser?.userId;
      const tenantId = getTenantId(ctx);
      const userId = saasUserId || ctx.user.id;

      // 1. Get user's own sessions
      let dbSessions = await getSessionsByUser(userId);

      // Determine the canonical session name for this user
      const canonicalName = `crm-${tenantId}-${userId}`;

      // Check live status from Evolution API for each session
      const results = await Promise.all(dbSessions.map(async (s) => {
        const live = await whatsappManager.getSessionLive(s.sessionId);
        const liveStatus = live?.status || s.status || "disconnected";
        return { ...s, liveStatus, qrDataUrl: live?.qrDataUrl || null, user: live?.user || null, isShared: false, sharedByName: null as string | null };
      }));

      // Filter out phantom sessions: if a session is not the canonical name
      // AND its liveStatus is disconnected, remove it from results
      const filtered = results.filter(s => {
        if (s.sessionId === canonicalName) return true;
        if (s.liveStatus === "connected") return true;
        return false;
      });

      const ownSessions = filtered.length > 0 ? filtered : (results.length > 0 ? [results.find(s => s.sessionId === canonicalName) || results[0]] : results);

      // 2. Check for active session share
      if (tenantId > 0) {
        const activeShare = await getActiveShareForUser(tenantId, userId);
        if (activeShare) {
          // Fetch the shared session details
          const sharedSession = await getSessionBySessionId(activeShare.sourceSessionId);
          if (sharedSession) {
            const live = await whatsappManager.getSessionLive(sharedSession.sessionId);
            const liveStatus = live?.status || sharedSession.status || "disconnected";
            // Get the name of the user who owns the shared session
            let sharedByName: string | null = null;
            try {
              const db = await getDb();
              if (db) {
                const ownerRows = await db.execute(sql`SELECT name FROM crm_users WHERE id = ${activeShare.sourceUserId} LIMIT 1`);
                const ownerRow = (ownerRows as unknown as any[])[0];
                if (ownerRow?.name) sharedByName = String(ownerRow.name);
              }
            } catch { /* ignore */ }

            const sharedResult = {
              ...sharedSession,
              liveStatus,
              qrDataUrl: null as string | null,
              user: live?.user || null,
              isShared: true,
              sharedByName,
              shareId: activeShare.id,
            };
            // Shared session comes FIRST (priority)
            return [sharedResult, ...ownSessions];
          }
        }
      }

      return ownSessions;
    }),
    // Resolve a phone number to the actual WhatsApp JID
    resolveJid: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), phone: z.string().min(1) }))
      .query(async ({ input, ctx }) => {
        const jid = await whatsappManager.resolveJidPublic(input.sessionId, input.phone);
        return { jid };
      }),
    sendMessage: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string(), number: z.string().min(1), message: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const agentId = ctx.user?.id;
        const result = await whatsappManager.sendTextMessage(input.sessionId, input.number, input.message, agentId);
        return { success: true, messageId: result?.key?.id, remoteJid: result?.key?.remoteJid };
      }),
    sendMedia: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string(), number: z.string().min(1), mediaUrl: z.string().url(), mediaType: z.enum(["image", "audio", "document", "video"]), caption: z.string().optional(), fileName: z.string().optional(), ptt: z.boolean().optional(), mimetype: z.string().optional(), duration: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const agentId = ctx.user?.id;
        const result = await whatsappManager.sendMediaMessage(input.sessionId, input.number, input.mediaUrl, input.mediaType, input.caption, input.fileName, { ptt: input.ptt, mimetype: input.mimetype, duration: input.duration }, agentId);
        return { success: true, messageId: result?.key?.id };
      }),
    // ─── REACTIONS & INTERACTIONS ───
    sendReaction: sessionTenantWriteProcedure
      .input(z.object({
        sessionId: z.string(),
        key: z.object({ remoteJid: z.string(), fromMe: z.boolean(), id: z.string() }),
        reaction: z.string(), // emoji or empty string to remove
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await whatsappManager.sendReaction(input.sessionId, input.key, input.reaction);
        return { success: true, messageId: result?.key?.id };
      }),
    sendSticker: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string(), number: z.string().min(1), stickerUrl: z.string().url() }))
      .mutation(async ({ input, ctx }) => {
        const result = await whatsappManager.sendSticker(input.sessionId, input.number, input.stickerUrl);
        return { success: true, messageId: result?.key?.id };
      }),
    sendLocation: sessionTenantWriteProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        latitude: z.number(),
        longitude: z.number(),
        name: z.string(),
        address: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await whatsappManager.sendLocation(input.sessionId, input.number, input.latitude, input.longitude, input.name, input.address);
        return { success: true, messageId: result?.key?.id };
      }),
    sendContact: sessionTenantWriteProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        contacts: z.array(z.object({ fullName: z.string(), wuid: z.string().optional(), phoneNumber: z.string() })),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await whatsappManager.sendContact(input.sessionId, input.number, input.contacts);
        return { success: true, messageId: result?.key?.id };
      }),
    sendPoll: sessionTenantWriteProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        name: z.string().min(1),
        values: z.array(z.string().min(1)).min(2).max(12),
        selectableCount: z.number().min(1).default(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await whatsappManager.sendPoll(input.sessionId, input.number, input.name, input.values, input.selectableCount);
        return { success: true, messageId: result?.key?.id };
      }),
    sendTextWithQuote: sessionTenantWriteProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        message: z.string().min(1),
        quotedMessageId: z.string(),
        quotedText: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const agentId = ctx.user?.id;
        const result = await whatsappManager.sendTextWithQuote(input.sessionId, input.number, input.message, input.quotedMessageId, input.quotedText, agentId);
        return { success: true, messageId: result?.key?.id };
      }),
    sendLink: sessionTenantWriteProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        linkUrl: z.string().url(),
        message: z.string().optional(),
        image: z.string().url().optional(),
        title: z.string().optional(),
        linkDescription: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await whatsappManager.sendLink(input.sessionId, input.number, input.linkUrl, {
          message: input.message,
          image: input.image,
          title: input.title,
          linkDescription: input.linkDescription,
        });
        return { success: true, messageId: result?.key?.id };
      }),
    // Product catalog (WhatsApp Business)
    getCatalogProducts: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), nextCursor: z.string().optional() }))
      .query(async ({ input }) => {
        return zapiProvider.getCatalogProducts(input.sessionId, input.nextCursor);
      }),
    sendProduct: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string(), number: z.string().min(1), catalogPhone: z.string().min(1), productId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const result = await zapiProvider.sendProduct(input.sessionId, input.number, input.catalogPhone, input.productId);
        return { success: true, messageId: result?.key?.id };
      }),
    sendCatalog: sessionTenantWriteProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        catalogPhone: z.string().min(1),
        message: z.string().optional(),
        title: z.string().optional(),
        catalogDescription: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await zapiProvider.sendCatalog(input.sessionId, input.number, input.catalogPhone, {
          message: input.message,
          title: input.title,
          catalogDescription: input.catalogDescription,
        });
        return { success: true, messageId: result?.key?.id };
      }),
    deleteMessage: sessionTenantWriteProcedure
      .input(z.object({
        sessionId: z.string(),
        remoteJid: z.string(),
        messageId: z.string(),
        fromMe: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        await whatsappManager.deleteMessage(input.sessionId, input.remoteJid, input.messageId, input.fromMe);
        return { success: true };
      }),
    editMessage: sessionTenantWriteProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        messageId: z.string(),
        newText: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await whatsappManager.editMessage(input.sessionId, input.number, input.messageId, input.newText);
        return { success: true, messageId: result?.key?.id };
      }),
    sendPresence: sessionTenantWriteProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        presence: z.enum(["composing", "recording", "paused"]),
      }))
      .mutation(async ({ input, ctx }) => {
        await whatsappManager.sendPresenceUpdate(input.sessionId, input.number, input.presence);
        return { success: true };
      }),
    // ── Send Broken Message (server-side with composing presence) ──
    sendBrokenMessage: sessionTenantWriteProcedure
      .input(z.object({
        sessionId: z.string(),
        number: z.string().min(1),
        parts: z.array(z.string().min(1)).min(1).max(10),
        pacing: z.enum(["fast", "normal", "human"]).default("normal"),
      }))
      .mutation(async ({ input, ctx }) => {
        const agentId = ctx.user?.id;
        const pacingConfig = {
          fast: { minDelay: 400, maxDelay: 800, composingTime: 300 },
          normal: { minDelay: 1000, maxDelay: 2000, composingTime: 800 },
          human: { minDelay: 2000, maxDelay: 4000, composingTime: 1500 },
        };
        const config = pacingConfig[input.pacing];
        const results: { messageId?: string; part: number }[] = [];

        for (let i = 0; i < input.parts.length; i++) {
          const part = input.parts[i];

          // Send "composing" presence before each part
          try {
            await whatsappManager.sendPresenceUpdate(input.sessionId, input.number, "composing");
          } catch {}

          // Wait composing time (proportional to message length)
          const charFactor = Math.min(part.length / 50, 2);
          const composingWait = Math.floor(config.composingTime * (0.5 + charFactor * 0.5));
          await new Promise(r => setTimeout(r, composingWait));

          // Send the message
          const result = await whatsappManager.sendTextMessage(input.sessionId, input.number, part, agentId);
          results.push({ messageId: result?.key?.id, part: i });

          // Delay between parts (not after last)
          if (i < input.parts.length - 1) {
            const delay = config.minDelay + Math.floor(Math.random() * (config.maxDelay - config.minDelay));
            await new Promise(r => setTimeout(r, delay));
          }
        }

        // Send "paused" presence after all parts
        try {
          await whatsappManager.sendPresenceUpdate(input.sessionId, input.number, "paused");
        } catch {}

        return { success: true, sentParts: results.length, results };
      }),

    archiveChat: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string(), archive: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await whatsappManager.archiveChat(input.sessionId, input.remoteJid, input.archive);
        return { success: true };
      }),
    pinChat: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string(), pin: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await whatsappManager.pinChat(input.sessionId, input.remoteJid, input.pin);
        return { success: true };
      }),
    muteChat: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string(), mute: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await whatsappManager.muteChat(input.sessionId, input.remoteJid, input.mute);
        return { success: true };
      }),
    deleteChat: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await whatsappManager.deleteChat(input.sessionId, input.remoteJid);
        return { success: true };
      }),
    pinMessage: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string(), messageId: z.string(), pin: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await whatsappManager.pinMessage(input.sessionId, input.remoteJid, input.messageId, input.pin);
        return { success: true };
      }),
    forwardMessage: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string(), fromJid: z.string(), toJid: z.string(), messageId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        return whatsappManager.forwardMessage(input.sessionId, input.fromJid, input.toJid, input.messageId);
      }),
    blockContact: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string(), number: z.string().min(1), block: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await whatsappManager.blockContact(input.sessionId, input.number, input.block);
        return { success: true };
      }),
    checkIsWhatsApp: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), numbers: z.array(z.string().min(1)) }))
      .mutation(async ({ input, ctx }) => {
        return whatsappManager.checkIsWhatsApp(input.sessionId, input.numbers);
      }),
    markAsUnread: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string(), messageId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await whatsappManager.markAsUnread(input.sessionId, input.remoteJid, input.messageId);
        return { success: true };
      }),
    fetchContactProfile: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), jid: z.string() }))
      .query(async ({ input, ctx }) => {
        return whatsappManager.fetchContactProfile(input.sessionId, input.jid);
      }),
    fetchBusinessProfile: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), jid: z.string() }))
      .query(async ({ input, ctx }) => {
        return whatsappManager.fetchContactBusinessProfile(input.sessionId, input.jid);
      }),
    // ─── Profile Management ───
    updateProfileName: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string(), name: z.string().min(1).max(25) }))
      .mutation(async ({ input }) => {
        const success = await whatsappManager.updateProfileName(input.sessionId, input.name);
        return { success };
      }),
    updateProfileDescription: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string(), description: z.string().max(500) }))
      .mutation(async ({ input }) => {
        const success = await whatsappManager.updateProfileDescription(input.sessionId, input.description);
        return { success };
      }),
    getDeviceInfo: sessionTenantProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        return whatsappManager.getDeviceInfo(input.sessionId);
      }),
    getBlockedContacts: sessionTenantProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        return whatsappManager.getBlockedContacts(input.sessionId);
      }),
    getMessageQueue: sessionTenantProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        return whatsappManager.getMessageQueue(input.sessionId);
      }),
    clearMessageQueue: sessionTenantWriteProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input }) => {
        const success = await whatsappManager.clearMessageQueue(input.sessionId);
        return { success };
      }),
    // ─── CONVERSATION LOCKS (Part 8) ───
    acquireLock: tenantWriteProcedure
      .input(z.object({ waConversationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        const agentId = ctx.user!.id;
        const agentName = ctx.saasUser?.name || ctx.user!.name || "Agent";
        return acquireConversationLock(tenantId, input.waConversationId, agentId, agentName);
      }),
    releaseLock: tenantWriteProcedure
      .input(z.object({ waConversationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        const agentId = ctx.user!.id;
        await releaseConversationLock(tenantId, input.waConversationId, agentId);
        return { success: true };
      }),
    getLock: tenantProcedure
      .input(z.object({ waConversationId: z.number() }))
      .query(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        return getConversationLock(tenantId, input.waConversationId);
      }),
    // ─── EXISTING QUERIES ───
    messages: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), limit: z.number().min(1).max(200).default(50), beforeId: z.number().optional() }))
      .query(async ({ input, ctx }) => getMessages(input.sessionId, input.limit, input.beforeId)),
    messagesByContact: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string(), limit: z.number().min(1).max(200).default(50), beforeId: z.number().optional() }))
      .query(async ({ input, ctx }) => getMessagesByContact(input.sessionId, input.remoteJid, input.limit, input.beforeId)),
    reactions: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), messageIds: z.array(z.string()).max(200) }))
      .query(async ({ input, ctx }) => getReactionsForMessages(input.sessionId, input.messageIds)),
    logs: sessionTenantProcedure
      .input(z.object({ sessionId: z.string().optional(), limit: z.number().min(1).max(500).default(100) }))
      .query(async ({ input, ctx }) => input.sessionId ? getLogs(input.sessionId, input.limit) : getAllLogs(input.limit)),
    getChatbotSettings: sessionTenantAdminProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input, ctx }) => getChatbotSettings(input.sessionId)),
    updateChatbotSettings: sessionTenantAdminProcedure
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
      .mutation(async ({ input, ctx }) => {
        const { sessionId, ...data } = input;
        await upsertChatbotSettings(sessionId, data as any);
        return { success: true };
      }),
    // Chatbot Rules (whitelist/blacklist)
    getChatbotRules: sessionTenantAdminProcedure
      .input(z.object({ sessionId: z.string(), ruleType: z.enum(["whitelist", "blacklist"]).optional() }))
      .query(async ({ input, ctx }) => getChatbotRules(input.sessionId, input.ruleType)),
    addChatbotRule: sessionTenantAdminProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string().min(1), ruleType: z.enum(["whitelist", "blacklist"]), contactName: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        await addChatbotRule(input.sessionId, input.remoteJid, input.ruleType, input.contactName);
        return { success: true };
      }),
    removeChatbotRule: tenantAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await removeChatbotRule(input.id);
        return { success: true };
      }),
    // Conversations list — LEGACY (redirects to optimized wa_conversations query)
    // Kept for backward compatibility; frontend should use waConversations instead
    conversations: sessionTenantProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input, ctx }) => {
        // Redirect to optimized query that reads from wa_conversations (no subqueries)
        return getWaConversationsList(input.sessionId, 0);
      }),
    // Conversations list with multi-agent assignment info — LEGACY
    conversationsMultiAgent: sessionTenantProcedure
      .input(z.object({
        sessionId: z.string(),
        assignedUserId: z.number().optional(),
        assignedTeamId: z.number().optional(),
        status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
        unassignedOnly: z.boolean().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const { sessionId, ...filter } = input;
        // Redirect to optimized query that reads from wa_conversations (no subqueries)
        return getWaConversationsList(sessionId, getTenantId(ctx), filter);
      }),
    // ─── WA Conversations (canônico — usa wa_conversations) ───
    waConversations: sessionTenantProcedure
      .input(z.object({
        sessionId: z.string(),
        assignedUserId: z.number().optional(),
        assignedTeamId: z.number().optional(),
        status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
        unassignedOnly: z.boolean().optional(),
        cursor: z.string().optional(), // ISO timestamp for cursor-based pagination
      }))
      .query(async ({ input, ctx }) => {
        const { sessionId, ...filter } = input;
        return getWaConversationsList(sessionId, getTenantId(ctx), filter);
      }),
    // Messages by canonical conversation ID
    messagesByConversation: tenantProcedure
      .input(z.object({
        conversationId: z.number(),
        limit: z.number().min(1).max(200).default(50),
        beforeId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => getMessagesByConversationId(input.conversationId, input.limit, input.beforeId)),
    // Mark wa_conversation as read
    markWaConversationRead: tenantWriteProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await markWaConversationReadDb(input.conversationId);
        return { success: true };
      }),
    // Assign conversation to an agent
    assignConversation: sessionTenantProcedure
      .input(z.object({
        sessionId: z.string(),
        remoteJid: z.string(),
        assignedUserId: z.number().nullable(),
        assignedTeamId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        const result = await assignConversation(tenantId, input.sessionId, input.remoteJid, input.assignedUserId, input.assignedTeamId);
        const io = getIo();
        if (io) {
          io.emit("conversationUpdated", {
            type: "assignment",
            sessionId: input.sessionId,
            remoteJid: input.remoteJid,
            assignedUserId: input.assignedUserId,
            assignedTeamId: input.assignedTeamId ?? null,
            timestamp: Date.now(),
          });
        }
        return result;
      }),
    // Transfer conversation to another agent
    transferConversation: sessionTenantProcedure
      .input(z.object({
        sessionId: z.string(),
        remoteJid: z.string(),
        toUserId: z.number(),
        toTeamId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        const result = await assignConversation(tenantId, input.sessionId, input.remoteJid, input.toUserId, input.toTeamId);
        const io = getIo();
        if (io) {
          io.emit("conversationUpdated", {
            type: "transfer",
            sessionId: input.sessionId,
            remoteJid: input.remoteJid,
            assignedUserId: input.toUserId,
            assignedTeamId: input.toTeamId ?? null,
            timestamp: Date.now(),
          });
        }
        return result;
      }),
    // Update conversation assignment status
    updateAssignmentStatus: sessionTenantProcedure
      .input(z.object({
        sessionId: z.string(),
        remoteJid: z.string(),
        status: z.enum(["open", "pending", "resolved", "closed"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        await updateAssignmentStatus(tenantId, input.sessionId, input.remoteJid, input.status);
        const io = getIo();
        if (io) {
          io.emit("conversationUpdated", {
            type: "status_change",
            sessionId: input.sessionId,
            remoteJid: input.remoteJid,
            status: input.status,
            timestamp: Date.now(),
          });
        }
        return { success: true };
      }),
    // Finish attendance — resolve and unassign from agent
    finishAttendance: sessionTenantProcedure
      .input(z.object({
        sessionId: z.string(),
        remoteJid: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.saasUser?.userId || (ctx as any).user?.id || 0;
        // Use tenantId from ctx (SaaS user) first, then input, then default to 1
        const tenantId = getTenantId(ctx);
        console.log(`[finishAttendance RPC] userId=${userId} tenantId=${tenantId} (ctx=${(ctx as any).saasUser?.tenantId}, input=${getTenantId(ctx)})`);
        await finishAttendance(tenantId, input.sessionId, input.remoteJid, userId);
        const io = getIo();
        if (io) {
          io.emit("conversationUpdated", {
            type: "finished",
            sessionId: input.sessionId,
            remoteJid: input.remoteJid,
            assignedUserId: null,
            status: "resolved",
            timestamp: Date.now(),
          });
        }
        return { success: true };
      }),
    // Get assignment for a specific conversation
    getAssignment: sessionTenantProcedure
      .input(z.object({
        sessionId: z.string(),
        remoteJid: z.string(),
      }))
      .query(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        return getAssignmentForConversation(tenantId, input.sessionId, input.remoteJid);
      }),
    // Get available agents for a tenant
    agents: tenantProcedure
      .query(async ({ input, ctx }) => getAgentsForTenant(getTenantId(ctx))),
    // Get teams for a tenant
    teams: tenantProcedure
      .query(async ({ input, ctx }) => getTeamsForTenant(getTenantId(ctx))),
    // Auto-assign via round-robin
    autoAssign: sessionTenantProcedure
      .input(z.object({
        sessionId: z.string(),
        remoteJid: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        const agentId = await getNextRoundRobinAgent(tenantId);
        if (!agentId) return { assigned: false, reason: "Nenhum agente disponível" };
        const result = await assignConversation(tenantId, input.sessionId, input.remoteJid, agentId);
        return { assigned: true, assignment: result };
      }),
    // Mark conversation as read
    markRead: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await markConversationRead(input.sessionId, input.remoteJid);
        return { success: true };
      }),
    // Sync on conversation open — fetch last 10 messages, insert only missing
    syncOnOpen: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string(), conversationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const session = whatsappManager.getSession(input.sessionId);
        if (!session || session.status !== "connected") return { inserted: 0, skipped: 0 };
        const { syncOnConversationOpen } = await import("./messageReconciliation");
        return syncOnConversationOpen(
          input.sessionId,
          session.tenantId,
          session.instanceName,
          input.remoteJid,
          input.conversationId
        );
      }),
    // Get profile picture for a single JID
    profilePicture: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), jid: z.string() }))
      .query(async ({ input, ctx }) => {
        const url = await whatsappManager.getProfilePicture(input.sessionId, input.jid);
        return { url };
      }),
    // Get profile pictures for multiple JIDs (batch)
    profilePictures: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), jids: z.array(z.string()).max(100) }))
      .query(async ({ input, ctx }) => {
        // Fast DB query first
        const dbResult = await getProfilePicturesFromDb(input.sessionId, input.jids);
        // Find JIDs missing pics in DB — fetch from API and AWAIT results (max 25 per call)
        const missingJids = input.jids.filter(j => !dbResult[j]).slice(0, 25);
        if (missingJids.length > 0) {
          try {
            const apiResult = await whatsappManager.getProfilePictures(input.sessionId, missingJids);
            const db = await getDb();
            for (const [jid, url] of Object.entries(apiResult)) {
              if (url) {
                dbResult[jid] = url; // Update the response with the fetched URL
                // Save to DB in background for next time
                if (db) {
                  const { waContacts } = await import("../drizzle/schema");
                  db.update(waContacts)
                    .set({ profilePictureUrl: url })
                    .where(and(eq(waContacts.sessionId, input.sessionId), eq(waContacts.jid, jid)))
                    .catch(() => {});
                }
              }
            }
          } catch (e) {
            // Silently ignore — return DB results only
          }
        }
        return dbResult;
      }),
    uploadMedia: tenantWriteProcedure
      .input(z.object({ fileName: z.string(), fileBase64: z.string(), contentType: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const fileBuffer = Buffer.from(input.fileBase64, "base64");
        const fileKey = `whatsapp-media/${nanoid()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, fileBuffer, input.contentType);
        return { url, fileKey };
      }),
    // Download media from Evolution API for messages that don't have mediaUrl yet
    getMediaUrl: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), messageId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const { resolveProviderForSession } = await import("./providers/providerFactory");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { waMessages } = await import("../drizzle/schema");
        const [msg] = await db.select().from(waMessages)
          .where(and(eq(waMessages.sessionId, input.sessionId), eq(waMessages.messageId, input.messageId)))
          .limit(1);
        if (!msg) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
        // Already has media URL cached (only if it's a permanent S3/CDN URL, not a temporary WhatsApp URL)
        if (msg.mediaUrl && !msg.mediaUrl.includes('whatsapp.net')) {
          return { url: msg.mediaUrl, mimetype: msg.mediaMimeType, unavailable: false };
        }
        // Already marked as unavailable - don't retry
        if (msg.mediaUrl === null && msg.mediaMimeType === "__unavailable__") {
          return { url: null, mimetype: null, unavailable: true };
        }
        // Download from provider - resolve the correct provider for this session
        const session = whatsappManager.getSession(input.sessionId);
        const instanceName = session?.instanceName || input.sessionId;
        let base64Data: { base64: string; mimetype: string; fileName?: string } | null = null;
        try {
          const provider = await resolveProviderForSession(input.sessionId);
          base64Data = await provider.getBase64FromMediaMessage(instanceName, input.messageId, {
            remoteJid: msg.remoteJid,
            fromMe: msg.fromMe,
          });
        } catch (err: any) {
          console.warn(`[getMediaUrl] Provider getBase64 failed:`, err.message);
        }
        if (!base64Data?.base64) {
          // Mark as unavailable in DB so we don't keep retrying
          await db.update(waMessages)
            .set({ mediaMimeType: "__unavailable__" })
            .where(eq(waMessages.id, msg.id));
          return { url: null, mimetype: null, unavailable: true };
        }
        // Upload to S3
        // Handle complex mimetypes like image/svg+xml → svg, audio/ogg; codecs=opus → ogg
        const rawExt = (base64Data.mimetype || "bin").split("/")[1]?.split(";")[0] || "bin";
        const ext = rawExt.split("+")[0]; // svg+xml → svg, gzip+json → gzip
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
    waContactsMap: sessionTenantProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input, ctx }) => {
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
    syncContacts: sessionTenantProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const result = await whatsappManager.syncContacts(input.sessionId);
        return result;
      }),
    // Trigger deep sync of all messages from Evolution API
    triggerDeepSync: sessionTenantProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const result = await whatsappManager.triggerDeepSync(input.sessionId);
        return result;
      }),
    // Manual trigger for daily backup
    triggerDailyBackup: tenantWriteProcedure
      .mutation(async () => {
        const { runDailyWhatsAppBackup } = await import("./whatsappDailyBackup");
        const result = await runDailyWhatsAppBackup();
        return result;
      }),
    // ─── Conversation Identity Resolver: Migration & Reconciliation ───
    migrateConversations: tenantWriteProcedure
      .mutation(async ({ input, ctx }) => {
        const { migrateExistingData } = await import("./conversationResolver");
        return migrateExistingData(getTenantId(ctx));
      }),
    reconcileGhosts: sessionTenantProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const { reconcileGhostThreads } = await import("./conversationResolver");
        return reconcileGhostThreads(getTenantId(ctx), input.sessionId);
      }),
    // Repair contact names contaminated by owner's name
    repairContactNames: tenantWriteProcedure
      .mutation(async ({ ctx }) => {
        const db = await (await import("./db")).getDb();
        if (!db) throw new Error("Database not available");
        const { whatsappSessions, waConversations, waContacts, contacts } = await import("../drizzle/schema");
        const { eq, and, sql } = await import("drizzle-orm");

        // Get all sessions with their owner pushName
        const sessions = await db.select({
          sessionId: whatsappSessions.sessionId,
          tenantId: whatsappSessions.tenantId,
          pushName: whatsappSessions.pushName,
          phoneNumber: whatsappSessions.phoneNumber,
        }).from(whatsappSessions)
          .where(sql`${whatsappSessions.pushName} IS NOT NULL AND ${whatsappSessions.pushName} != ''`);

        let totalConvsFixed = 0;
        let totalContactsFixed = 0;
        const details: { sessionId: string; ownerName: string; convsFixed: number; contactsFixed: number }[] = [];

        for (const session of sessions) {
          const ownerName = session.pushName!;
          let convsFixed = 0;
          let contactsFixed = 0;

          // 1) Fix wa_conversations: find conversations where contactPushName == ownerName
          const contaminated = await db.select({
            id: waConversations.id,
            remoteJid: waConversations.remoteJid,
          }).from(waConversations)
            .where(and(
              eq(waConversations.sessionId, session.sessionId),
              eq(waConversations.contactPushName, ownerName)
            ));

          if (contaminated.length > 0) {
            // Try to find real names from wa_contacts
            const contactNames = await db.select({
              jid: waContacts.jid,
              pushName: waContacts.pushName,
              savedName: waContacts.savedName,
              verifiedName: waContacts.verifiedName,
            }).from(waContacts)
              .where(eq(waContacts.sessionId, session.sessionId));
            const nameMap = new Map<string, string>();
            for (const c of contactNames) {
              const realName = c.savedName || c.verifiedName || c.pushName;
              if (realName && realName !== ownerName && realName.trim() !== '') {
                const cleaned = realName.replace(/[\s\-\(\)\+]/g, '');
                if (!/^\d+$/.test(cleaned)) {
                  nameMap.set(c.jid, realName);
                }
              }
            }

            // Also check incoming messages for real pushNames
            for (const conv of contaminated) {
              if (!nameMap.has(conv.remoteJid)) {
                const msgRows = await db.execute(
                  sql`SELECT pushName FROM messages WHERE sessionId = ${session.sessionId} AND remoteJid = ${conv.remoteJid} AND fromMe = false AND pushName IS NOT NULL AND pushName != '' AND pushName != ${ownerName} ORDER BY id DESC LIMIT 1`
                );
                const msgData = msgRows as any[];
                if (msgData?.[0]?.pushName) {
                  nameMap.set(conv.remoteJid, msgData[0].pushName);
                }
              }
            }

            // Update contaminated conversations
            for (const conv of contaminated) {
              const realName = nameMap.get(conv.remoteJid);
              await db.update(waConversations)
                .set({ contactPushName: realName || null })
                .where(eq(waConversations.id, conv.id));
              convsFixed++;
            }
          }

          // 2) Fix contacts table: find CRM contacts where name == ownerName
          const contaminatedContacts = await db.select({
            id: contacts.id,
            phoneE164: contacts.phoneE164,
            phone: contacts.phone,
          }).from(contacts)
            .where(and(
              eq(contacts.tenantId, session.tenantId),
              eq(contacts.name, ownerName)
            ));

          for (const contact of contaminatedContacts) {
            // Try to find real name from wa_contacts by matching phone
            const phone = contact.phoneE164 || contact.phone || '';
            const digits = phone.replace(/\D/g, '');
            if (!digits) continue;

            // Build JID variants to search
            const jidVariants = [
              `${digits}@s.whatsapp.net`,
              digits.startsWith('55') && digits.length === 13 ? `${digits.slice(0,4)}${digits.slice(5)}@s.whatsapp.net` : null,
              digits.startsWith('55') && digits.length === 12 ? `${digits.slice(0,4)}9${digits.slice(4)}@s.whatsapp.net` : null,
            ].filter(Boolean) as string[];

            let realName: string | null = null;
            for (const jid of jidVariants) {
              const waContact = await db.select({ pushName: waContacts.pushName, savedName: waContacts.savedName })
                .from(waContacts)
                .where(eq(waContacts.jid, jid))
                .limit(1);
              if (waContact[0]) {
                const name = waContact[0].savedName || waContact[0].pushName;
                if (name && name !== ownerName) {
                  realName = name;
                  break;
                }
              }
            }

            // Update contact name: use real name or fallback to phone number
            await db.update(contacts)
              .set({ name: realName || `+${digits}`, updatedAt: new Date() })
              .where(eq(contacts.id, contact.id));
            contactsFixed++;
          }

          totalConvsFixed += convsFixed;
          totalContactsFixed += contactsFixed;
          details.push({ sessionId: session.sessionId, ownerName, convsFixed, contactsFixed });
        }

        return {
          totalConvsFixed,
          totalContactsFixed,
          sessionsProcessed: sessions.length,
          details,
        };
      }),
    // WhatsApp contact import settings
    getContactImportSettings: tenantProcedure
      .query(async ({ input, ctx }) => {
        const db = await (await import("./db")).getDb();
        if (!db) return { importContactsFromAgenda: false };
        const { tenants } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const rows = await db.select({ settingsJson: tenants.settingsJson }).from(tenants).where(eq(tenants.id, getTenantId(ctx))).limit(1);
        const settings = (rows[0]?.settingsJson as any) || {};
        return { importContactsFromAgenda: settings.whatsapp?.importContactsFromAgenda ?? false };
      }),
    saveContactImportSettings: tenantWriteProcedure
      .input(z.object({ importContactsFromAgenda: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const db = await (await import("./db")).getDb();
        if (!db) return { success: false };
        const { tenants } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const rows = await db.select({ settingsJson: tenants.settingsJson }).from(tenants).where(eq(tenants.id, getTenantId(ctx))).limit(1);
        const currentSettings = (rows[0]?.settingsJson as any) || {};
        if (!currentSettings.whatsapp) currentSettings.whatsapp = {};
        currentSettings.whatsapp.importContactsFromAgenda = input.importContactsFromAgenda;
        await db.update(tenants).set({ settingsJson: currentSettings }).where(eq(tenants.id, getTenantId(ctx)));
        return { success: true };
      }),
    // Cleanup synced contacts: remove contacts with source="whatsapp" that have NO deals and were NOT manually created
    cleanupSyncedContacts: tenantWriteProcedure
      .input(z.object({ dryRun: z.boolean().default(true) }))
      .mutation(async ({ input, ctx }) => {
        const db = await (await import("./db")).getDb();
        if (!db) throw new Error("Database not available");
        const { contacts, deals } = await import("../drizzle/schema");
        const { eq, and, sql, isNull } = await import("drizzle-orm");

        // Find contacts with source="whatsapp" that have NO associated deals
        // A contact has a deal if deals.contactId matches the contact.id
        const syncedContacts = await db.execute(
          sql`SELECT c.id, c.name, c.phone, c.phoneE164, c.source, c.createdAt
              FROM contacts c
              WHERE c.tenantId = ${getTenantId(ctx)}
                AND c.source = 'whatsapp'
                AND c.id NOT IN (
                  SELECT DISTINCT d.contactId FROM deals d WHERE d.tenantId = ${getTenantId(ctx)} AND d.contactId IS NOT NULL
                )`
        );

        const toDelete = (syncedContacts as any[]) || [];
        const count = toDelete.length;

        if (input.dryRun) {
          return {
            dryRun: true,
            contactsToDelete: count,
            sample: toDelete.slice(0, 20).map((c: any) => ({ id: c.id, name: c.name, phone: c.phoneE164 || c.phone })),
          };
        }

        // Actually delete the contacts
        if (count > 0) {
          const ids = toDelete.map((c: any) => c.id);
          // Delete in batches of 100 to avoid query size limits
          for (let i = 0; i < ids.length; i += 100) {
            const batch = ids.slice(i, i + 100);
            await db.execute(
              sql`DELETE FROM contacts WHERE id IN (${sql.join(batch.map((id: number) => sql`${id}`), sql`, `)})`
            );
          }
        }

        return {
          dryRun: false,
          contactsDeleted: count,
        };
      }),
    // Get wa_conversations debug info
    debugConversations: sessionTenantProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input, ctx }) => {
        const db = (await import("./db")).getDb;
        const dbInst = await db();
        if (!dbInst) return { conversations: [], identities: [] };
        const { waConversations, waIdentities } = await import("../drizzle/schema");
        const { eq, and, desc } = await import("drizzle-orm");
        const convs = await dbInst.select().from(waConversations)
          .where(and(eq(waConversations.tenantId, getTenantId(ctx)), eq(waConversations.sessionId, input.sessionId)))
          .orderBy(desc(waConversations.lastMessageAt))
          .limit(100);
        const ids = await dbInst.select().from(waIdentities)
          .where(and(eq(waIdentities.tenantId, getTenantId(ctx)), eq(waIdentities.sessionId, input.sessionId)))
          .orderBy(desc(waIdentities.lastSeenAt))
          .limit(100);
        return { conversations: convs, identities: ids };
      }),

    // ─── SESSION SHARING (Admin) ───
    // List all shares for the tenant
    listShares: tenantProcedure
      .query(async ({ ctx, input }) => {
        const role = ctx.saasUser?.role;
        if (role !== "admin" && ctx.saasUser) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem gerenciar compartilhamentos." });
        }
        const shares = await getAllSharesForTenant(getTenantId(ctx));
        // Enrich with user names
        const db = await getDb();
        if (!db) return shares.map(s => ({ ...s, targetUserName: null, sourceUserName: null, sharedByName: null }));
        const userIds = Array.from(new Set([...shares.map(s => s.targetUserId), ...shares.map(s => s.sourceUserId), ...shares.map(s => s.sharedBy)]));
        if (userIds.length === 0) return [];
        const userRows = await db.execute(sql`SELECT id, name, email FROM crm_users WHERE id IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
        const userMap = new Map((userRows as unknown as any[]).map((u: any) => [Number(u.id), { name: String(u.name), email: String(u.email) }]));
        return shares.map(s => ({
          ...s,
          targetUserName: userMap.get(s.targetUserId)?.name || null,
          targetUserEmail: userMap.get(s.targetUserId)?.email || null,
          sourceUserName: userMap.get(s.sourceUserId)?.name || null,
          sharedByName: userMap.get(s.sharedBy)?.name || null,
        }));
      }),

    // Share a session with a user
    shareSession: tenantWriteProcedure
      .input(z.object({
        sourceSessionId: z.string(),
        targetUserIds: z.array(z.number()).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const role = ctx.saasUser?.role;
        if (role !== "admin" && ctx.saasUser) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem compartilhar sessões." });
        }
        const adminUserId = ctx.saasUser?.userId || ctx.user.id;

        // Verify the session exists and belongs to this tenant
        const session = await getSessionBySessionId(input.sourceSessionId);
        if (!session || session.tenantId !== getTenantId(ctx)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada." });
        }

        // Cannot share with yourself
        const filteredTargets = input.targetUserIds.filter(id => id !== session.userId);
        if (filteredTargets.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível compartilhar a sessão com o próprio dono." });
        }

        // Create shares for each target user
        const results = [];
        for (const targetUserId of filteredTargets) {
          // Disconnect target user's own session if connected
          const targetCanonical = `crm-${getTenantId(ctx)}-${targetUserId}`;
          try {
            const targetSession = await getSessionBySessionId(targetCanonical);
            if (targetSession) {
              const live = await whatsappManager.getSessionLive(targetCanonical);
              if (live?.status === "connected") {
                await whatsappManager.disconnect(targetCanonical);
                console.log(`[SessionShare] Disconnected ${targetCanonical} because user ${targetUserId} is receiving shared session ${input.sourceSessionId}`);
              }
            }
          } catch (e) {
            console.warn(`[SessionShare] Failed to disconnect ${targetCanonical}:`, e);
          }

          const result = await createSessionShare(
            getTenantId(ctx),
            input.sourceSessionId,
            session.userId,
            targetUserId,
            adminUserId,
          );
          results.push(result);
        }

        return { success: true, created: results.length };
      }),

    // Revoke a specific share
    revokeShare: tenantWriteProcedure
      .input(z.object({ shareId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const role = ctx.saasUser?.role;
        if (role !== "admin" && ctx.saasUser) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem revogar compartilhamentos." });
        }
        await revokeSessionShare(input.shareId, getTenantId(ctx));
        return { success: true };
      }),

    // Revoke all shares for a session
    revokeAllShares: tenantWriteProcedure
      .input(z.object({ sourceSessionId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const role = ctx.saasUser?.role;
        if (role !== "admin" && ctx.saasUser) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem revogar compartilhamentos." });
        }
        await revokeAllSharesForSession(getTenantId(ctx), input.sourceSessionId);
        return { success: true };
      }),

    // Get all tenant sessions (for admin to choose which to share)
    tenantSessions: tenantProcedure
      .query(async ({ ctx, input }) => {
        const role = ctx.saasUser?.role;
        if (role !== "admin" && ctx.saasUser) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem ver todas as sessões." });
        }
        const sessions = await getSessionsByTenant(getTenantId(ctx));
        // Enrich with live status and owner name
        const db = await getDb();
        const enriched = await Promise.all(sessions.map(async (s) => {
          const live = await whatsappManager.getSessionLive(s.sessionId);
          let ownerName: string | null = null;
          if (db) {
            try {
              const rows = await db.execute(sql`SELECT name FROM crm_users WHERE id = ${s.userId} LIMIT 1`);
              const row = (rows as unknown as any[])[0];
              if (row?.name) ownerName = String(row.name);
            } catch { /* ignore */ }
          }
          return {
            ...s,
            liveStatus: live?.status || s.status || "disconnected",
            ownerName,
            user: live?.user || null,
          };
        }));
        return enriched;
      }),

    // Get active share for current user (used by frontend to show banner)
    myActiveShare: tenantProcedure
      .query(async ({ ctx, input }) => {
        const userId = ctx.saasUser?.userId || ctx.user.id;
        const share = await getActiveShareForUser(getTenantId(ctx), userId);
        if (!share) return null;
        // Enrich with owner name and phone
        const session = await getSessionBySessionId(share.sourceSessionId);
        let ownerName: string | null = null;
        try {
          const db = await getDb();
          if (db) {
            const rows = await db.execute(sql`SELECT name FROM crm_users WHERE id = ${share.sourceUserId} LIMIT 1`);
            const row = (rows as unknown as any[])[0];
            if (row?.name) ownerName = String(row.name);
          }
        } catch { /* ignore */ }
        return {
          ...share,
          ownerName,
          phoneNumber: session?.phoneNumber || null,
          pushName: session?.pushName || null,
        };
      }),

    // ─── Helpdesk: Internal Notes ───
    notes: router({
    list: tenantProcedure
      .input(z.object({ waConversationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        return getInternalNotes(tenantId, input.waConversationId);
      }),
    create: sessionTenantProcedure
      .input(z.object({
        waConversationId: z.number(),
        sessionId: z.string(),
        remoteJid: z.string(),
        content: z.string().min(1),
        mentionedUserIds: z.array(z.number()).optional(),
        category: z.enum(["client", "financial", "documentation", "operation", "other"]).optional(),
        priority: z.enum(["normal", "high", "urgent"]).optional(),
        isCustomerGlobalNote: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        const userId = ctx.saasUser?.userId || ctx.user.id;
        const result = await createInternalNote(
          tenantId, input.waConversationId, input.sessionId, input.remoteJid,
          userId, input.content, input.mentionedUserIds,
          input.category, input.priority, input.isCustomerGlobalNote
        );
        // Emit socket event for real-time update to all agents
        const io = getIo();
        if (io) {
          io.emit("conversationUpdated", {
            type: "internal_note",
            waConversationId: input.waConversationId,
            sessionId: input.sessionId,
            remoteJid: input.remoteJid,
            authorUserId: userId,
            authorName: ctx.saasUser?.name || ctx.user.name || "Agente",
            timestamp: Date.now(),
          });
        }
        return result;
      }),
    update: tenantWriteProcedure
      .input(z.object({
        noteId: z.number(),
        content: z.string().min(1).optional(),
        category: z.string().optional(),
        priority: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        await updateInternalNote(tenantId, input.noteId, {
          content: input.content,
          category: input.category,
          priority: input.priority,
        });
        return { success: true };
      }),
    delete: tenantWriteProcedure
      .input(z.object({ noteId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        await deleteInternalNote(tenantId, input.noteId);
        return { success: true };
      }),
    globalByContact: tenantProcedure
      .input(z.object({ remoteJid: z.string() }))
      .query(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        return getCustomerGlobalNotes(tenantId, input.remoteJid);
      }),
    }),

    // ─── Helpdesk: Conversation Events / Timeline ───
    events: router({
    list: tenantProcedure
      .input(z.object({ waConversationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        return getConversationEvents(tenantId, input.waConversationId);
      }),
    }),

    // ─── Helpdesk: Queue (Fila) ───
    queue: router({
    list: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), limit: z.number().max(200).default(100) }))
      .query(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        return getQueueConversations(input.sessionId, tenantId, input.limit);
      }),
    claim: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        const userId = ctx.saasUser?.userId || ctx.user.id;
        const result = await claimConversation(tenantId, input.sessionId, input.remoteJid, userId);
        const io = getIo();
        if (io) {
          io.emit("conversationUpdated", {
            type: "claimed",
            sessionId: input.sessionId,
            remoteJid: input.remoteJid,
            assignedUserId: userId,
            timestamp: Date.now(),
          });
        }
        return result;
      }),
    enqueue: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), remoteJid: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        await enqueueConversation(tenantId, input.sessionId, input.remoteJid);
        const io = getIo();
        if (io) {
          io.emit("conversationUpdated", {
            type: "enqueued",
            sessionId: input.sessionId,
            remoteJid: input.remoteJid,
            assignedUserId: null,
            timestamp: Date.now(),
          });
        }
        return { success: true };
      }),
    stats: sessionTenantProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        return getQueueStats(tenantId, input.sessionId);
      }),
    }),

    // ─── Helpdesk: Transfer ───
    transfer: router({
    execute: sessionTenantProcedure
      .input(z.object({
        sessionId: z.string(),
        remoteJid: z.string(),
        toUserId: z.number(),
        toTeamId: z.number().optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        const fromUserId = ctx.saasUser?.userId || ctx.user.id;
        const result = await transferConversationWithNote(
          tenantId, input.sessionId, input.remoteJid,
          fromUserId, input.toUserId, input.toTeamId, input.note
        );
        const io = getIo();
        if (io) {
          io.emit("conversationUpdated", {
            type: "transfer",
            sessionId: input.sessionId,
            remoteJid: input.remoteJid,
            assignedUserId: input.toUserId,
            assignedTeamId: input.toTeamId ?? null,
            timestamp: Date.now(),
          });
        }
        return result;
      }),
    }),

    // ─── Helpdesk: Supervision Dashboard ───
    supervision: router({
    agentWorkload: sessionTenantAdminProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        return getAgentWorkload(tenantId, input.sessionId);
      }),
    agentConversations: sessionTenantAdminProcedure
      .input(z.object({ sessionId: z.string(), agentId: z.number(), limit: z.number().max(50).default(10) }))
      .query(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        return getAgentConversations(tenantId, input.sessionId, input.agentId, input.limit);
      }),
    queueStats: sessionTenantAdminProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        return getQueueStats(tenantId, input.sessionId);
      }),
    // Assign a queue conversation to a specific agent (admin action)
    assignToAgent: sessionTenantAdminProcedure
      .input(z.object({
        sessionId: z.string(),
        remoteJid: z.string(),
        agentId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        const result = await assignConversation(tenantId, input.sessionId, input.remoteJid, input.agentId);
        const io = getIo();
        if (io) {
          io.emit("conversationUpdated", {
            type: "assignment",
            sessionId: input.sessionId,
            remoteJid: input.remoteJid,
            assignedUserId: input.agentId,
            timestamp: Date.now(),
          });
        }
        return result;
      }),
    // Return a conversation from an agent back to the queue
    returnToQueue: sessionTenantAdminProcedure
      .input(z.object({
        sessionId: z.string(),
        remoteJid: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        await enqueueConversation(tenantId, input.sessionId, input.remoteJid);
        const io = getIo();
        if (io) {
          io.emit("conversationUpdated", {
            type: "enqueued",
            sessionId: input.sessionId,
            remoteJid: input.remoteJid,
            assignedUserId: null,
            timestamp: Date.now(),
          });
        }
        return { success: true };
      }),
    // Transfer conversation between agents (admin action from supervision panel)
    transferBetweenAgents: sessionTenantAdminProcedure
      .input(z.object({
        sessionId: z.string(),
        remoteJid: z.string(),
        fromAgentId: z.number(),
        toAgentId: z.number(),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        const result = await assignConversation(tenantId, input.sessionId, input.remoteJid, input.toAgentId);
        // Log the transfer event
        await transferConversationWithNote(
          tenantId, input.sessionId, input.remoteJid,
          input.fromAgentId, input.toAgentId,
          null,
          input.note || `Transferido pelo supervisor ${ctx.user?.name || 'Admin'}`
        );
        const io = getIo();
        if (io) {
          io.emit("conversationUpdated", {
            type: "transfer",
            sessionId: input.sessionId,
            remoteJid: input.remoteJid,
            assignedUserId: input.toAgentId,
            fromAgentId: input.fromAgentId,
            timestamp: Date.now(),
          });
        }
         return result;
      }),
    }),
    // ─── Helpdesk: Quick Replies ───
    quickReplies: router({
    list: tenantProcedure
      .input(z.object({ teamId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        return getQuickReplies(tenantId, input.teamId);
      }),
    create: tenantWriteProcedure
      .input(z.object({
        shortcut: z.string().min(1).max(32),
        title: z.string().min(1).max(128),
        content: z.string().min(1),
        teamId: z.number().optional(),
        category: z.string().optional(),
        contentType: z.enum(["text", "image", "video", "audio", "document"]).optional(),
        mediaUrl: z.string().max(1024).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        const userId = ctx.saasUser?.userId || ctx.user.id;
        return createQuickReply(tenantId, { ...input, createdBy: userId });
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(),
        shortcut: z.string().min(1).max(32).optional(),
        title: z.string().min(1).max(128).optional(),
        content: z.string().min(1).optional(),
        category: z.string().optional(),
        contentType: z.enum(["text", "image", "video", "audio", "document"]).optional(),
        mediaUrl: z.string().max(1024).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        const { id, ...data } = input;
        await updateQuickReply(tenantId, id, data);
        return { success: true };
      }),
    incrementUsage: tenantProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        await incrementQuickReplyUsage(tenantId, input.id);
        return { success: true };
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        await deleteQuickReply(tenantId, input.id);
        return { success: true };
      }),
    }),

    // ─── Conversation Tags ───
    conversationTags: router({
      list: tenantProcedure.query(async ({ ctx }) => {
        return listConversationTags(getTenantId(ctx));
      }),
      create: tenantWriteProcedure
        .input(z.object({
          name: z.string().min(1).max(100),
          color: z.string().max(20).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          return createConversationTag(getTenantId(ctx), input.name, input.color);
        }),
      delete: tenantWriteProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          await deleteConversationTag(getTenantId(ctx), input.id);
          return { success: true };
        }),
      getForConversation: tenantProcedure
        .input(z.object({ waConversationId: z.number() }))
        .query(async ({ input }) => {
          return getTagsForConversation(input.waConversationId);
        }),
      addToConversation: tenantWriteProcedure
        .input(z.object({ waConversationId: z.number(), tagId: z.number() }))
        .mutation(async ({ input }) => {
          await addTagToConversation(input.waConversationId, input.tagId);
          return { success: true };
        }),
      removeFromConversation: tenantWriteProcedure
        .input(z.object({ waConversationId: z.number(), tagId: z.number() }))
        .mutation(async ({ input }) => {
          await removeTagFromConversation(input.waConversationId, input.tagId);
          return { success: true };
        }),
    }),

    // ─── Conversation Ops (Pin / Archive / Priority) ───
    conversationOps: router({
      pin: sessionTenantWriteProcedure
        .input(z.object({
          sessionId: z.string(),
          remoteJid: z.string(),
          pin: z.boolean(),
        }))
        .mutation(async ({ ctx, input }) => {
          await pinConversation(getTenantId(ctx), input.sessionId, input.remoteJid, input.pin);
          return { success: true };
        }),
      archive: sessionTenantWriteProcedure
        .input(z.object({
          sessionId: z.string(),
          remoteJid: z.string(),
          archive: z.boolean(),
        }))
        .mutation(async ({ ctx, input }) => {
          await archiveConversation(getTenantId(ctx), input.sessionId, input.remoteJid, input.archive);
          return { success: true };
        }),
      setPriority: sessionTenantWriteProcedure
        .input(z.object({
          sessionId: z.string(),
          remoteJid: z.string(),
          priority: z.enum(["low", "medium", "high", "urgent"]),
        }))
        .mutation(async ({ ctx, input }) => {
          const tenantId = getTenantId(ctx);
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
          const { conversationAssignments } = await import("../drizzle/schema");
          await db.update(conversationAssignments)
            .set({ priority: input.priority })
            .where(and(
              eq(conversationAssignments.tenantId, tenantId),
              eq(conversationAssignments.sessionId, input.sessionId),
              eq(conversationAssignments.remoteJid, input.remoteJid),
            ));
          return { success: true };
        }),
    }),

    // ─── Scheduled Messages ───
    scheduledMessages: router({
      list: sessionTenantProcedure
        .input(z.object({ status: z.string().optional() }).optional())
        .query(async ({ ctx, input }) => {
          return listScheduledMessages(getTenantId(ctx), input?.status);
        }),
      create: sessionTenantWriteProcedure
        .input(z.object({
          sessionId: z.string(),
          remoteJid: z.string(),
          content: z.string().min(1),
          contentType: z.enum(["text", "image", "video", "audio", "document"]).optional(),
          mediaUrl: z.string().max(1024).optional(),
          scheduledAt: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
          const tenantId = getTenantId(ctx);
          const userId = ctx.saasUser?.userId || ctx.user?.id;
          const result = await createScheduledMessage(tenantId, {
            ...input,
            scheduledAt: new Date(input.scheduledAt),
            createdBy: userId,
          });
          // Enqueue BullMQ job if worker is available
          try {
            const { enqueueScheduledMessage } = await import("./scheduledMessageWorker");
            if (result?.id) {
              await enqueueScheduledMessage(result.id, new Date(input.scheduledAt));
            }
          } catch {
            // Worker not yet initialized — sweep will pick it up
          }
          return result;
        }),
      cancel: sessionTenantWriteProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          await cancelScheduledMessage(getTenantId(ctx), input.id);
          try {
            const { cancelScheduledJob } = await import("./scheduledMessageWorker");
            await cancelScheduledJob(input.id);
          } catch {
            // Worker not available
          }
          return { success: true };
        }),
    }),
  }),

  // ─── Message Monitoring ───
  monitoring: router({
    statusMetrics: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), periodDays: z.number().min(1).max(365).default(7), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        return getMessageStatusMetrics(input.sessionId, input.periodDays, input.dateFrom, input.dateTo);
      }),
    volumeOverTime: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), periodDays: z.number().min(1).max(365).default(7), granularity: z.enum(["hour", "day"]).default("day"), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        return getMessageVolumeOverTime(input.sessionId, input.periodDays, input.granularity, input.dateFrom, input.dateTo);
      }),
    deliveryRate: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), periodDays: z.number().min(1).max(365).default(7), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        return getDeliveryRateMetrics(input.sessionId, input.periodDays, input.dateFrom, input.dateTo);
      }),
    recentActivity: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), limit: z.number().min(1).max(200).default(50) }))
      .query(async ({ input, ctx }) => {
        return getRecentMessageActivity(input.sessionId, input.limit);
      }),
    typeDistribution: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), periodDays: z.number().min(1).max(365).default(7), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        return getMessageTypeDistribution(input.sessionId, input.periodDays, input.dateFrom, input.dateTo);
      }),
    topContacts: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), periodDays: z.number().min(1).max(365).default(7), limit: z.number().min(1).max(50).default(10), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        return getTopContactsByVolume(input.sessionId, input.periodDays, input.limit, input.dateFrom, input.dateTo);
      }),
    responseTime: sessionTenantProcedure
      .input(z.object({ sessionId: z.string(), periodDays: z.number().min(1).max(365).default(7), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        return getResponseTimeMetrics(input.sessionId, input.periodDays, input.dateFrom, input.dateTo);
      }),
    fixWebhooks: tenantWriteProcedure
      .mutation(async () => {
        const results: Array<{ instance: string; ok: boolean }> = [];
        const sessions = whatsappManager.getAllSessions();
        for (const sess of sessions) {
          if (sess.status === "connected") {
            // Use provider factory to resolve correct provider for webhook fix
            let ok = false;
            try {
              const { resolveProviderForSession: resolveProvider } = await import("./providers/providerFactory");
              const provider = await resolveProvider(sess.sessionId);
              ok = await provider.ensureWebhook(sess.instanceName);
            } catch {
              console.warn(`[fixWebhooks] Provider ensureWebhook failed for ${sess.instanceName}, skipping`);
              ok = false;
            }
            results.push({ instance: sess.instanceName, ok });
          }
        }
        return { fixed: results.filter(r => r.ok).length, total: results.length, results };
      }),
    // Provider metrics — observability (Z-API only)
    providerMetrics: tenantProcedure
      .query(async () => {
        const { getAllProviderMetrics, getSessionsByProvider } = await import("./providers/providerFactory");
        const metrics = getAllProviderMetrics();
        const zapiSessions = await getSessionsByProvider("zapi");
        return {
          metrics,
          sessionCounts: {
            zapi: zapiSessions.length,
          },
          sessions: {
            zapi: zapiSessions,
          },
        };
      }),
    // Z-API Provisioning — get provisioned instance for tenant
    zapiProvisioningStatus: tenantProcedure
      .query(async ({ ctx }) => {
        const { getZapiInstanceForTenant, hasZapiInstance } = await import("./services/zapiProvisioningService");
        const tid = getTenantId(ctx);
        const instance = await getZapiInstanceForTenant(tid);
        return {
          provisioned: instance !== null,
          instance: instance ? {
            id: instance.id,
            zapiInstanceId: instance.zapiInstanceId,
            instanceName: instance.instanceName,
            status: instance.status,
            subscribedAt: instance.subscribedAt,
            expiresAt: instance.expiresAt,
            createdAt: instance.createdAt,
          } : null,
        };
      }),
    // Z-API Provisioning — manually provision for tenant (admin)
    zapiProvision: tenantWriteProcedure
      .mutation(async ({ ctx }) => {
        const { provisionZapiForTenant } = await import("./services/zapiProvisioningService");
        const { tenants } = await import("../drizzle/schema");
        const tid = getTenantId(ctx);
        // Get tenant name
        const db = await getDb();
        const [tenant] = await db!.select().from(tenants).where(eq(tenants.id, tid)).limit(1);
        const result = await provisionZapiForTenant(tid, tenant?.name || `Tenant-${tid}`);
        return result;
      }),
    // Z-API Provisioning — deprovision for tenant (admin)
    zapiDeprovision: tenantWriteProcedure
      .mutation(async ({ ctx }) => {
        const { deprovisionZapiForTenant } = await import("./services/zapiProvisioningService");
        const tid = getTenantId(ctx);
        return deprovisionZapiForTenant(tid);
      }),
  }),

  // ─── Dashboard ───
  dashboard: router({
    metrics: tenantProcedure
      .input(z.object({ pipelineId: z.number().optional(), dealStatus: z.enum(['open', 'won', 'lost', 'all']).optional(), dateFrom: z.string().optional(), dateTo: z.string().optional(), userId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        // Non-admin users see only their own deal metrics; admin can filter by specific user
        const isAdmin = ctx.saasUser?.role === "admin";
        const ownerFilter = input.userId ? input.userId : (isAdmin ? undefined : ctx.saasUser?.userId);
        return getDashboardMetrics(getTenantId(ctx), ownerFilter, input.pipelineId, input.dealStatus, input.dateFrom, input.dateTo);
      }),
    pipelineSummary: tenantProcedure
      .input(z.object({ pipelineId: z.number().optional(), dealStatus: z.enum(['open', 'won', 'lost', 'all']).optional(), dateFrom: z.string().optional(), dateTo: z.string().optional(), userId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        // Non-admin users see only their own pipeline summary; admin can filter by specific user
        const isAdmin = ctx.saasUser?.role === "admin";
        const ownerFilter = input.userId ? input.userId : (isAdmin ? undefined : ctx.saasUser?.userId);
        return getPipelineSummary(getTenantId(ctx), ownerFilter, input.pipelineId, input.dealStatus, input.dateFrom, input.dateTo);
      }),
    recentActivity: tenantProcedure
      .input(z.object({ limit: z.number().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        return getRecentActivity(getTenantId(ctx), input.limit, input.dateFrom, input.dateTo);
      }),
    upcomingTasks: tenantProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        return getUpcomingTasks(getTenantId(ctx), ctx.user?.id, input.limit);
      }),
    whatsappMetrics: tenantProcedure
      .query(async ({ input, ctx }) => {
        return getDashboardWhatsAppMetrics(getTenantId(ctx));
      }),
    dealsTimeline: tenantProcedure
      .input(z.object({ days: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        return getDashboardDealsTimeline(getTenantId(ctx), input.days);
      }),
    conversionRates: tenantProcedure
      .query(async ({ input, ctx }) => {
        return getDashboardConversionRates(getTenantId(ctx));
      }),
    funnelData: tenantProcedure
      .input(z.object({ pipelineId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        return getDashboardFunnelData(getTenantId(ctx), input.pipelineId);
      }),
    allPipelines: tenantProcedure
      .query(async ({ input, ctx }) => {
        return getDashboardAllPipelines(getTenantId(ctx));
      }),
   }),

  // ─── Home Dashboard (Redesigned) ───
  home: router({
    filterOptions: tenantProcedure
      .query(async ({ ctx }) => {
        const isAdmin = ctx.saasUser?.role === "admin";
        if (!isAdmin) return { users: [], teams: [] };
        return getHomeFilterOptions(getTenantId(ctx));
      }),
    executive: tenantProcedure
      .input(z.object({ userId: z.number().optional(), teamId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const isAdmin = ctx.saasUser?.role === "admin";
        if (!isAdmin) {
          // Non-admin always sees only their own data
          return getHomeExecutive(getTenantId(ctx), ctx.saasUser?.userId);
        }
        // Admin: apply filter if provided
        const userId = input?.userId;
        const teamId = input?.teamId;
        return getHomeExecutive(getTenantId(ctx), userId, teamId);
      }),
    tasks: tenantProcedure
      .input(z.object({ limit: z.number().optional(), userId: z.number().optional(), teamId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const isAdmin = ctx.saasUser?.role === "admin";
        if (!isAdmin) {
          // Non-admin always sees only their own tasks
          return getHomeTasks(getTenantId(ctx), ctx.saasUser?.userId, input.limit);
        }
        // Admin: apply filter if provided
        const userId = input.userId;
        const teamId = input.teamId;
        return getHomeTasks(getTenantId(ctx), userId, input.limit, teamId);
      }),
    rfv: tenantProcedure
      .query(async ({ ctx }) => {
        return getHomeRFV(getTenantId(ctx));
      }),
    onboarding: tenantProcedure
      .query(async ({ ctx }) => {
        const dismissed = await isOnboardingDismissed(getTenantId(ctx));
        if (dismissed) return { dismissed: true, steps: [], completedCount: 0, totalSteps: 0, progressPercent: 100 };
        return { dismissed: false, ...(await getHomeOnboarding(getTenantId(ctx))) };
      }),
    toggleOnboardingStep: tenantProcedure
      .input(z.object({ stepKey: z.string(), completed: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        return toggleOnboardingStep(getTenantId(ctx), ctx.user!.id, input.stepKey, input.completed);
      }),
    dismissOnboarding: tenantProcedure
      .mutation(async ({ ctx }) => {
        return dismissOnboarding(getTenantId(ctx), ctx.user!.id);
      }),
    /** Proximos atendimentos: vendas fechadas com data de atendimento futura */
    upcomingDepartures: tenantProcedure
      .input(z.object({ userId: z.number().optional(), teamId: z.number().optional(), limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const isAdmin = ctx.saasUser?.role === "admin";
        const userId = isAdmin ? input?.userId : ctx.saasUser?.userId;
        const teamId = isAdmin ? input?.teamId : undefined;
        return getUpcomingAppointments(getTenantId(ctx), userId, teamId, input?.limit ?? 20);
      }),
    /** AI-powered intelligent forecast for the current month */
    aiForecast: tenantProcedure
      .input(z.object({ userId: z.number().optional(), teamId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const tenantId = getTenantId(ctx);
        const isAdmin = ctx.saasUser?.role === "admin";
        const userId = isAdmin ? input?.userId : ctx.saasUser?.userId;
        const teamId = isAdmin ? input?.teamId : undefined;

        // Get the executive data first (already has basic forecast)
        const exec = await getHomeExecutive(tenantId, userId, teamId);

        // Try to generate AI-powered forecast
        try {
          const trainingConfig = await getAiTrainingConfig(tenantId, "analysis");
          const customInstructions = trainingConfig?.instructions || "";

          const systemPrompt = `Você é um analista comercial sênior. Analise os dados de vendas do mês atual e gere uma previsão inteligente de fechamento.

Seu papel:
1. Calcular uma previsão conservadora, realista e otimista
2. Considerar a taxa de conversão atual e o pipeline ativo
3. Dar um veredicto claro sobre a saúde do mês
4. Sugerir 2-3 ações prioritárias

IMPORTANTE:
- Responda EXCLUSIVAMENTE em português brasileiro
- Seja direto e use números concretos
- Considere que estamos no dia ${new Date().getDate()} do mês
${customInstructions ? `\n--- INSTRUÇÕES PERSONALIZADAS DO GESTOR ---\n${customInstructions}` : ""}`;

          const userPrompt = `## Dados do Mês Atual
- Negociações ativas: ${exec.activeDeals}
- Valor no pipeline: R$ ${(exec.activeValueCents / 100).toFixed(2)}
- Negociações ganhas: ${exec.wonDeals}
- Valor vendido: R$ ${(exec.wonValueCents / 100).toFixed(2)}
- Negociações perdidas: ${exec.lostDeals}
- Taxa de conversão: ${exec.conversionRate}%
- Previsão simples (fórmula): R$ ${(exec.forecastCents / 100).toFixed(2)}
- Negociações sem tarefa: ${exec.dealsWithoutTask}
- Negociações esfriando: ${exec.coolingDeals}

Gere a previsão inteligente no formato JSON.`;

          const result = await callTenantAi({
            tenantId,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            maxTokens: 800,
            responseFormat: {
              type: "json_schema",
              json_schema: {
                name: "ai_forecast",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    conservativeCents: { type: "integer", description: "Previsão conservadora em centavos" },
                    realisticCents: { type: "integer", description: "Previsão realista em centavos" },
                    optimisticCents: { type: "integer", description: "Previsão otimista em centavos" },
                    verdict: { type: "string", enum: ["excellent", "good", "attention", "critical"], description: "Veredicto" },
                    summary: { type: "string", description: "Resumo da previsão em 2-3 frases" },
                    actions: { type: "array", items: { type: "string" }, description: "2-3 ações prioritárias" },
                  },
                  required: ["conservativeCents", "realisticCents", "optimisticCents", "verdict", "summary", "actions"],
                  additionalProperties: false,
                },
              },
            },
          });

          const parsed = JSON.parse(result.content);
          return {
            available: true,
            provider: result.provider,
            model: result.model,
            forecast: parsed,
            basicForecastCents: exec.forecastCents,
          };
        } catch (err: any) {
          console.error("[Home AI Forecast] Error:", err.message);
          return {
            available: false,
            error: err.message === "NO_AI_CONFIGURED" ? "no_ai" : "error",
            basicForecastCents: exec.forecastCents,
          };
        }
      }),
  }),

  // ─── User Preferences ───
  preferences: router({
    get: tenantProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input, ctx }) => {
        const val = await getUserPreference(ctx.user!.id, getTenantId(ctx), input.key);
        return { key: input.key, value: val };
      }),
    set: tenantProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await setUserPreference(ctx.user!.id, getTenantId(ctx), input.key, input.value);
        return { success: true };
      }),
    getAll: tenantProcedure
      .query(async ({ input, ctx }) => {
        return getAllUserPreferences(ctx.user!.id, getTenantId(ctx));
      }),
  }),

  // ─── Global Search ───
  search: router({
    global: tenantProcedure
      .input(z.object({ query: z.string().min(1).max(100), limit: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const { resolveVisibilityFilter } = await import("./services/visibilityService");
        const isAdmin = ctx.saasUser?.role === "admin";
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const tenantId = getTenantId(ctx);
        const dealVis = await resolveVisibilityFilter(userId, tenantId, "deals", isAdmin);
        const contactVis = await resolveVisibilityFilter(userId, tenantId, "contacts", isAdmin);
        return globalSearchWithVisibility(tenantId, input.query, input.limit, {
          dealOwnerIds: dealVis.ownerUserIds,
          contactOwnerIds: contactVis.ownerUserIds,
        });
      }),
  }),

  // ─── Notifications ───
  notifications: router({
    list: tenantProcedure
      .input(z.object({
        onlyUnread: z.boolean().optional(),
        limit: z.number().optional(),
        beforeId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const allNotifs = await getNotifications(getTenantId(ctx), {
          onlyUnread: input.onlyUnread,
          limit: (input.limit ?? 50) * 3, // fetch more to filter
          beforeId: input.beforeId,
        });
        // Filter by user notification preferences
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const tenantId = getTenantId(ctx);
        const prefVal = await getUserPreference(userId, tenantId, "notification_preferences");
        if (prefVal) {
          try {
            const prefs = JSON.parse(prefVal) as Record<string, boolean>;
            const filtered = allNotifs.filter((n: any) => prefs[n.type] !== false);
            return filtered.slice(0, input.limit ?? 50);
          } catch { /* fallback to all */ }
        }
        return allNotifs.slice(0, input.limit ?? 50);
      }),
    unreadCount: tenantProcedure
      .query(async ({ input, ctx }) => {
        const allNotifs = await getNotifications(getTenantId(ctx), { onlyUnread: true, limit: 200 });
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const tenantId = getTenantId(ctx);
        const prefVal = await getUserPreference(userId, tenantId, "notification_preferences");
        if (prefVal) {
          try {
            const prefs = JSON.parse(prefVal) as Record<string, boolean>;
            return allNotifs.filter((n: any) => prefs[n.type] !== false).length;
          } catch { /* fallback */ }
        }
        return allNotifs.length;
      }),
    markRead: tenantProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await markNotificationRead(input.id);
        return { success: true };
      }),
    markAllRead: tenantProcedure
      .mutation(async ({ input, ctx }) => {
        await markAllNotificationsRead(getTenantId(ctx));
        return { success: true };
      }),
    // ─── Notification Preferences ───
    getPreferences: tenantProcedure
      .query(async ({ ctx }) => {
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const tenantId = getTenantId(ctx);
        const val = await getUserPreference(userId, tenantId, "notification_preferences");
        // Default preferences: 4 types ON, rest OFF
        const defaults: Record<string, boolean> = {
          deal_created: true,
          rfv_filter_alert: true,
          task_due_soon: true,
          birthday: true,
          appointment_soon: true,
          // Optional (off by default)
          deal_moved: false,
          contact_created: false,
          task_created: false,
          whatsapp_message: false,
          whatsapp_connected: false,
          whatsapp_disconnected: false,
          whatsapp_warning: false,
          wedding_anniversary: false,
          new_lead: false,
          automation_triggered: false,
        };
        if (val) {
          try {
            const saved = JSON.parse(val) as Record<string, boolean>;
            return { ...defaults, ...saved };
          } catch { /* fallback */ }
        }
        return defaults;
      }),
    setPreferences: tenantProcedure
      .input(z.object({ preferences: z.record(z.string(), z.boolean()) }))
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const tenantId = getTenantId(ctx);
        await setUserPreference(userId, tenantId, "notification_preferences", JSON.stringify(input.preferences));
        return { success: true };
      }),
  }),

  // ─── Birthday & Wedding Dates ───
  dateCelebrations: router({
    upcoming: tenantProcedure
      .input(z.object({
        dateType: z.enum(["birthDate", "weddingDate"]),
        daysAhead: z.number().default(7),
      }))
      .query(async ({ input, ctx }) => {
        const crm = await import("./crmDb");
        return crm.getContactsWithUpcomingDates(getTenantId(ctx), { daysAhead: input.daysAhead, dateType: input.dateType });
      }),
    today: tenantProcedure
      .input(z.object({
        dateType: z.enum(["birthDate", "weddingDate"]),
      }))
      .query(async ({ input, ctx }) => {
        const crm = await import("./crmDb");
        return crm.getContactsWithDateToday(getTenantId(ctx), input.dateType);
      }),
    inMonth: tenantProcedure
      .input(z.object({
        month: z.number().min(1).max(12),
        dateType: z.enum(["birthDate", "weddingDate"]),
      }))
      .query(async ({ input, ctx }) => {
        const crm = await import("./crmDb");
        return crm.getContactsWithDateInMonth(getTenantId(ctx), input.month, input.dateType);
      }),
  }),

  // ─── Team & Agent Management ───
  teamManagement: router({
    // ── Teams CRUD ──
    listTeams: tenantProcedure
      .query(async ({ ctx }) => getTeamsForTenant(getTenantId(ctx))),
    getTeam: tenantProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input, ctx }) => getTeamWithMembers(input.teamId, getTenantId(ctx))),
    createTeam: tenantProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        color: z.string().optional(),
        maxMembers: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        const { ...data } = input;
        return createTeam(tenantId, data);
      }),
    updateTeam: tenantProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        maxMembers: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        return updateTeam(id, tenantId, data);
      }),
    deleteTeam: tenantProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteTeam(input.id, getTenantId(ctx));
        return { success: true };
      }),
    // ── Team Members ──
    addMember: tenantWriteProcedure
      .input(z.object({
        teamId: z.number(),
        userId: z.number(),
        role: z.enum(["member", "leader"]).default("member"),
      }))
      .mutation(async ({ input, ctx }) => addTeamMember(getTenantId(ctx), input.teamId, input.userId, input.role)),
    removeMember: tenantWriteProcedure
      .input(z.object({
        teamId: z.number(),
        userId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await removeTeamMember(getTenantId(ctx), input.teamId, input.userId);
        return { success: true };
      }),
    updateMemberRole: tenantWriteProcedure
      .input(z.object({
        teamId: z.number(),
        userId: z.number(),
        role: z.enum(["member", "leader"]),
      }))
      .mutation(async ({ input, ctx }) => {
        await updateTeamMemberRole(getTenantId(ctx), input.teamId, input.userId, input.role);
        return { success: true };
      }),
    // ── Agents ──
    inviteAgent: tenantWriteProcedure
      .input(z.object({
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
        // Check user limit (trial = 1 user, Start = 1, Growth+ = unlimited)
        await assertCanAddUser(getTenantId(ctx));
        try {
          // inviteUserToTenant imported statically at top of file
          const result = await inviteUserToTenant({
            tenantId: getTenantId(ctx),
            name: input.name,
            email: input.email,
            phone: input.phone,
            role: input.role,
            inviterName: ctx.user.name || "Administrador",
            origin: input.origin || "https://crm.enturos.com",
          });
          return { success: true, userId: result.userId, emailSent: result.emailSent };
        } catch (e: any) {
          if (e.message === "EMAIL_EXISTS_IN_TENANT") {
            throw new TRPCError({ code: "CONFLICT", message: "Este email já está cadastrado neste tenant" });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message || "Erro ao convidar agente" });
        }
      }),
    listAgents: tenantProcedure
      .query(async ({ input, ctx }) => getAgentsWithTeams(getTenantId(ctx))),
    updateAgentStatus: tenantWriteProcedure
      .input(z.object({
        userId: z.number(),
        status: z.enum(["active", "inactive", "invited"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only admins can update agent status
        if (ctx.saasUser?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem alterar status de agentes" });
        }
        await updateAgentStatus(getTenantId(ctx), input.userId, input.status);
        return { success: true };
      }),
    updateAgentRole: tenantWriteProcedure
      .input(z.object({
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
        await db.update(crmUsersTable).set({ role: input.role }).where(andOp(eqOp(crmUsersTable.id, input.userId), eqOp(crmUsersTable.tenantId, getTenantId(ctx))));
        return { success: true };
      }),
    // ── Distribution Rules ──
    listRules: tenantProcedure
      .query(async ({ input, ctx }) => getDistributionRules(getTenantId(ctx))),
    createRule: tenantWriteProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        strategy: z.enum(["round_robin", "least_busy", "manual", "team_round_robin"]),
        teamId: z.number().nullable().optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        priority: z.number().optional(),
        configJson: z.any().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
const tenantId = getTenantId(ctx); const { ...data } = input;
        return createDistributionRule(tenantId, data);
      }),
    updateRule: tenantWriteProcedure
      .input(z.object({
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
      .mutation(async ({ input, ctx }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        return updateDistributionRule(id, tenantId, data);
      }),
    deleteRule: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteDistributionRule(input.id, getTenantId(ctx));
        return { success: true };
      }),
    toggleRule: tenantWriteProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await toggleDistributionRule(input.id, getTenantId(ctx), input.isActive);
        return { success: true };
      }),
  }),

  // ─── Clinilucro CRM Modules ───
  admin: adminRouter,       // M0: Admin/IAM
  crm: crmRouter,           // M2: CRM (Contacts, Deals, Pipelines, Trips, Tasks, Notes)
  inbox: inboxRouter,       // M1: Inbox Omnichannel
  proposals: proposalRouter, // M3: Propostas
  asaas: asaasRouter,       // ASAAS payment integration
  tenantBranding: tenantBrandingRouter, // Clinic name + logo (used on PDFs)
  whatsappQuick: whatsappQuickRouter, // Envio rápido de WhatsApp por contato
  portal: portalRouter,     // M4: Portal do Cliente
  management: managementRouter, // M5: Gestão
  insights: insightsRouter, // M6: Insights
  academy: academyRouter,   // M7: Academy
  integrationHub: integrationHubRouter, // M8: Integration Hub
  productCatalog: productCatalogRouter, // M9: Catálogo de Produtos Turísticos
  aiAnalysis: aiAnalysisRouter, // M10: Análise de Atendimento por IA
  utmAnalytics: utmAnalyticsRouter, // M11: Dashboard de Rastreamento UTM
  sourcesCampaigns: sourcesCampaignsRouter, // Relatório Fontes e Campanhas
  rdCrmImport: rdCrmImportRouter, // M12: Importação do RD Station CRM
  saasAuth: saasAuthRouter, // SaaS Authentication (email/senha)
  billing: billingRouter, // Billing & Subscription management
  zapiAdmin: zapiAdminRouter, // Super Admin Z-API Instance Management
  rfv: rfvRouter, // M13: Matriz RFV — Classificação Automática de Contatos
  crmAnalytics: analyticsRouter, // M14: Análises de Negociações (KPIs, Funil, Motivos de Perda)
  export: exportRouter, // Exportação de planilhas (Contatos, Negociações, RFV)
  profile: profileRouter, // Perfil do usuário (avatar, nome, senha, Google Calendar)

  // ─── Contact Profile & Custom Fields ───
  contactProfile: router({
    getMetrics: tenantProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ input, ctx }) => {
        return getContactMetrics(getTenantId(ctx), input.contactId);
      }),
    getDeals: tenantProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ input, ctx }) => {
        return getContactDeals(getTenantId(ctx), input.contactId);
      }),
    getCustomFieldValues: tenantProcedure
      .input(z.object({ entityType: z.enum(["contact", "deal", "company"]), entityId: z.number() }))
      .query(async ({ input, ctx }) => {
        return getCustomFieldValues(getTenantId(ctx), input.entityType, input.entityId);
      }),
    setCustomFieldValues: tenantWriteProcedure
      .input(z.object({
        entityType: z.enum(["contact", "deal", "company"]),
        entityId: z.number(),
        values: z.array(z.object({ fieldId: z.number(), value: z.string().nullable() })),
      }))
      .mutation(async ({ input, ctx }) => {
        await setCustomFieldValues(getTenantId(ctx), input.entityType, input.entityId, input.values);
        return { success: true };
      }),
  }),

  customFields: router({
    list: tenantProcedure
      .input(z.object({ entity: z.enum(["contact", "deal", "company"]) }))
      .query(async ({ input, ctx }) => {
        return listCustomFields(getTenantId(ctx), input.entity);
      }),
    get: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return getCustomFieldById(getTenantId(ctx), input.id);
      }),
    create: tenantWriteProcedure
      .input(z.object({
        entity: z.enum(["contact", "deal", "company"]),
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
      .mutation(async ({ input, ctx }) => {
        return createCustomField({ ...input, tenantId: getTenantId(ctx) });
      }),
    update: tenantWriteProcedure
      .input(z.object({
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
      .mutation(async ({ input, ctx }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        return updateCustomField(tenantId, id, data);
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteCustomField(getTenantId(ctx), input.id);
        return { success: true };
      }),
    reorder: tenantWriteProcedure
      .input(z.object({ entity: z.enum(["contact", "deal", "company"]), orderedIds: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        await reorderCustomFields(getTenantId(ctx), input.entity, input.orderedIds);
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════
  // LEAD CAPTURE & INTEGRATIONS
  // ═══════════════════════════════════════
  leadCapture: router({
    // Webhook config
    getWebhookConfig: tenantProcedure
      .query(async ({ input, ctx }) => {
        const config = await getWebhookConfig(getTenantId(ctx));
        return config;
      }),
    generateWebhookToken: tenantWriteProcedure
      .mutation(async ({ input, ctx }) => {
        const secret = randomBytes(32).toString("hex");
        const config = await upsertWebhookConfig(getTenantId(ctx), secret);
        return config;
      }),

    // Meta integration
    getMetaConfig: tenantAdminProcedure
      .query(async ({ input, ctx }) => {
        const config = await getMetaConfig(getTenantId(ctx));
        // Don't expose full access token to frontend
        if (config?.accessToken) {
          return { ...config, accessToken: "••••" + config.accessToken.slice(-8) };
        }
        return config;
      }),
    connectMeta: tenantAdminProcedure
      .input(z.object({
        pageId: z.string(),
        pageName: z.string().optional(),
        accessToken: z.string(),
        appSecret: z.string().optional(),
        verifyToken: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const verifyToken = input.verifyToken || randomBytes(16).toString("hex");
        const config = await upsertMetaConfig(getTenantId(ctx), {
          pageId: input.pageId,
          pageName: input.pageName,
          accessToken: input.accessToken,
          appSecret: input.appSecret,
          verifyToken,
          status: "connected",
        });
        return config;
      }),
    disconnectMeta: tenantAdminProcedure
      .mutation(async ({ input, ctx }) => {
        await disconnectMeta(getTenantId(ctx));
        return { success: true };
      }),

    // Event logs
    listEvents: tenantProcedure
      .input(z.object({
        source: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().optional(),
        beforeId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const [events, total] = await Promise.all([
          listLeadEvents(getTenantId(ctx), input),
          countLeadEvents(getTenantId(ctx), input),
        ]);
        return { events, total };
      }),
    reprocessEvent: tenantWriteProcedure
      .input(z.object({ eventId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return reprocessLeadEvent(getTenantId(ctx), input.eventId);
      }),

    // ─── Tracking Script Tokens ────────────────────────
    listTrackingTokens: tenantProcedure
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(trackingTokens)
          .where(eq(trackingTokens.tenantId, getTenantId(ctx)))
          .orderBy(desc(trackingTokens.createdAt));
      }),

    createTrackingToken: tenantWriteProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        allowedDomains: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const token = randomBytes(32).toString("hex");
        const [result] = await db.insert(trackingTokens).values({
          tenantId: getTenantId(ctx),
          token,
          name: input.name,
          allowedDomains: input.allowedDomains || null,
        }).returning({ id: trackingTokens.id });
        return { id: result!.id, token, name: input.name };
      }),

    updateTrackingToken: tenantWriteProcedure
      .input(z.object({
        tokenId: z.number(),
        name: z.string().min(1).max(255).optional(),
        allowedDomains: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
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
          .where(and(eq(trackingTokens.id, input.tokenId), eq(trackingTokens.tenantId, getTenantId(ctx))));
        return { success: true };
      }),

    deleteTrackingToken: tenantWriteProcedure
      .input(z.object({ tokenId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db
          .delete(trackingTokens)
          .where(and(eq(trackingTokens.id, input.tokenId), eq(trackingTokens.tenantId, getTenantId(ctx))));
        return { success: true };
      }),

    getTrackingSnippet: tenantProcedure
      .input(z.object({
        tokenId: z.number(),
        collectUrl: z.string().url(),
      }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const rows = await db
          .select()
          .from(trackingTokens)
          .where(and(eq(trackingTokens.id, input.tokenId), eq(trackingTokens.tenantId, getTenantId(ctx))))
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

    verifyTrackingInstallation: tenantProcedure
      .input(z.object({
        url: z.string().url(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get all tokens for this tenant
        const tenantTokens = await db
          .select()
          .from(trackingTokens)
          .where(eq(trackingTokens.tenantId, getTenantId(ctx)));

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
    getConfig: tenantAdminProcedure
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return null;
        const rows = await db
          .select()
          .from(rdStationConfig)
          .where(eq(rdStationConfig.tenantId, getTenantId(ctx)))
          .limit(1);
        return rows[0] || null;
      }),

    setupIntegration: tenantAdminProcedure
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Check if already exists
        const existing = await db
          .select()
          .from(rdStationConfig)
          .where(eq(rdStationConfig.tenantId, getTenantId(ctx)))
          .limit(1);

        if (existing.length > 0) {
          return existing[0];
        }

        // Generate a unique webhook token
        const token = randomBytes(32).toString("hex");
        const [result] = await db.insert(rdStationConfig).values({
          tenantId: getTenantId(ctx),
          webhookToken: token,
        }).returning({ id: rdStationConfig.id });

        const rows = await db
          .select()
          .from(rdStationConfig)
          .where(eq(rdStationConfig.id, result!.id))
          .limit(1);
        return rows[0]!;
      }),

    regenerateToken: tenantAdminProcedure
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const newToken = randomBytes(32).toString("hex");
        await db
          .update(rdStationConfig)
          .set({ webhookToken: newToken })
          .where(eq(rdStationConfig.tenantId, getTenantId(ctx)));

        const rows = await db
          .select()
          .from(rdStationConfig)
          .where(eq(rdStationConfig.tenantId, getTenantId(ctx)))
          .limit(1);
        return rows[0]!;
      }),

    toggleActive: tenantAdminProcedure
      .input(z.object({ isActive: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db
          .update(rdStationConfig)
          .set({ isActive: input.isActive })
          .where(eq(rdStationConfig.tenantId, getTenantId(ctx)));
        return { success: true };
      }),

    getWebhookLogs: tenantAdminProcedure
      .input(z.object({
        status: z.enum(["success", "failed", "duplicate"]).optional(),
        limit: z.number().default(50),
        beforeId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { logs: [], total: 0 };

        const conditions: any[] = [eq(rdStationWebhookLog.tenantId, getTenantId(ctx))];
        if (input.status) {
          conditions.push(eq(rdStationWebhookLog.status, input.status));
        }
        if (input.beforeId) {
          conditions.push(lt(rdStationWebhookLog.id, input.beforeId));
        }

        const logs = await db
          .select()
          .from(rdStationWebhookLog)
          .where(and(...conditions))
          .orderBy(desc(rdStationWebhookLog.createdAt))
          .limit(input.limit);

        const countConditions: any[] = [eq(rdStationWebhookLog.tenantId, getTenantId(ctx))];
        if (input.status) {
          countConditions.push(eq(rdStationWebhookLog.status, input.status));
        }
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(rdStationWebhookLog)
          .where(and(...countConditions));

        return {
          logs,
          total: Number(countResult[0]?.count || 0),
        };
      }),

    getStats: tenantAdminProcedure
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { total: 0, success: 0, failed: 0, duplicate: 0 };

        const stats = await db
          .select({
            status: rdStationWebhookLog.status,
            count: sql<number>`count(*)`,
          })
          .from(rdStationWebhookLog)
          .where(eq(rdStationWebhookLog.tenantId, getTenantId(ctx)))
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

    // ─── Multi-Config CRUD ───────────────────────────────

    listConfigs: tenantAdminProcedure
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(rdStationConfig)
          .where(eq(rdStationConfig.tenantId, getTenantId(ctx)))
          .orderBy(desc(rdStationConfig.createdAt));
      }),

    createConfig: tenantAdminProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        defaultPipelineId: z.number().optional(),
        defaultStageId: z.number().optional(),
        defaultSource: z.string().max(255).optional(),
        defaultCampaign: z.string().max(255).optional(),
        defaultOwnerUserId: z.number().optional(),
        assignmentTeamId: z.number().nullable().optional(),
        assignmentMode: z.enum(["specific_user", "random_all", "random_team"]).default("random_all"),
        autoWhatsAppEnabled: z.boolean().default(false),
        autoWhatsAppMessageTemplate: z.string().optional(),
        dealNameTemplate: z.string().optional(),
        autoProductId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const token = randomBytes(32).toString("hex");
        const [result] = await db.insert(rdStationConfig).values({
          tenantId: getTenantId(ctx),
          name: input.name,
          webhookToken: token,
          defaultPipelineId: input.defaultPipelineId ?? null,
          defaultStageId: input.defaultStageId ?? null,
          defaultSource: input.defaultSource ?? null,
          defaultCampaign: input.defaultCampaign ?? null,
          defaultOwnerUserId: input.defaultOwnerUserId ?? null,
          assignmentTeamId: input.assignmentTeamId ?? null,
          assignmentMode: input.assignmentMode,
          autoWhatsAppEnabled: input.autoWhatsAppEnabled,
          autoWhatsAppMessageTemplate: input.autoWhatsAppMessageTemplate ?? null,
          dealNameTemplate: input.dealNameTemplate ?? null,
          autoProductId: input.autoProductId ?? null,
        }).returning({ id: rdStationConfig.id });

        const rows = await db
          .select()
          .from(rdStationConfig)
          .where(eq(rdStationConfig.id, result!.id))
          .limit(1);
        return rows[0]!;
      }),

    updateConfig: tenantAdminProcedure
      .input(z.object({
        configId: z.number(),
        name: z.string().min(1).max(255).optional(),
        isActive: z.boolean().optional(),
        autoCreateDeal: z.boolean().optional(),
        defaultPipelineId: z.number().nullable().optional(),
        defaultStageId: z.number().nullable().optional(),
        defaultSource: z.string().max(255).nullable().optional(),
        defaultCampaign: z.string().max(255).nullable().optional(),
        defaultOwnerUserId: z.number().nullable().optional(),
        assignmentTeamId: z.number().nullable().optional(),
        assignmentMode: z.enum(["specific_user", "random_all", "random_team"]).optional(),
        autoWhatsAppEnabled: z.boolean().optional(),
        autoWhatsAppMessageTemplate: z.string().nullable().optional(),
        dealNameTemplate: z.string().nullable().optional(),
        autoProductId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { configId, ...updates } = input;
        const tenantId = getTenantId(ctx);
        // Only include defined fields
        const setObj: Record<string, any> = {};
        if (updates.name !== undefined) setObj.name = updates.name;
        if (updates.isActive !== undefined) setObj.isActive = updates.isActive;
        if (updates.autoCreateDeal !== undefined) setObj.autoCreateDeal = updates.autoCreateDeal;
        if (updates.defaultPipelineId !== undefined) setObj.defaultPipelineId = updates.defaultPipelineId;
        if (updates.defaultStageId !== undefined) setObj.defaultStageId = updates.defaultStageId;
        if (updates.defaultSource !== undefined) setObj.defaultSource = updates.defaultSource;
        if (updates.defaultCampaign !== undefined) setObj.defaultCampaign = updates.defaultCampaign;
        if (updates.defaultOwnerUserId !== undefined) setObj.defaultOwnerUserId = updates.defaultOwnerUserId;
        if (updates.assignmentTeamId !== undefined) setObj.assignmentTeamId = updates.assignmentTeamId;
        if (updates.assignmentMode !== undefined) setObj.assignmentMode = updates.assignmentMode;
        if (updates.autoWhatsAppEnabled !== undefined) setObj.autoWhatsAppEnabled = updates.autoWhatsAppEnabled;
        if (updates.autoWhatsAppMessageTemplate !== undefined) setObj.autoWhatsAppMessageTemplate = updates.autoWhatsAppMessageTemplate;
        if (updates.dealNameTemplate !== undefined) setObj.dealNameTemplate = updates.dealNameTemplate;
        if (updates.autoProductId !== undefined) setObj.autoProductId = updates.autoProductId;

        if (Object.keys(setObj).length > 0) {
          await db
            .update(rdStationConfig)
            .set(setObj)
            .where(and(eq(rdStationConfig.id, configId), eq(rdStationConfig.tenantId, tenantId)));
        }

        const rows = await db
          .select()
          .from(rdStationConfig)
          .where(and(eq(rdStationConfig.id, configId), eq(rdStationConfig.tenantId, tenantId)))
          .limit(1);
        return rows[0] ?? null;
      }),

    deleteConfig: tenantAdminProcedure
      .input(z.object({ configId: z.number(), }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db
          .delete(rdStationConfig)
          .where(and(eq(rdStationConfig.id, input.configId), eq(rdStationConfig.tenantId, getTenantId(ctx))));
        return { success: true };
      }),

    getConfigLogs: tenantAdminProcedure
      .input(z.object({
        configId: z.number(),
        status: z.enum(["success", "failed", "duplicate"]).optional(),
        limit: z.number().default(50),
        beforeId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { logs: [], total: 0 };

        const conditions: any[] = [
          eq(rdStationWebhookLog.tenantId, getTenantId(ctx)),
          eq(rdStationWebhookLog.configId, input.configId),
        ];
        if (input.status) conditions.push(eq(rdStationWebhookLog.status, input.status));
        if (input.beforeId) conditions.push(lt(rdStationWebhookLog.id, input.beforeId));

        const logs = await db
          .select()
          .from(rdStationWebhookLog)
          .where(and(...conditions))
          .orderBy(desc(rdStationWebhookLog.createdAt))
          .limit(input.limit);

        const countConditions: any[] = [
          eq(rdStationWebhookLog.tenantId, getTenantId(ctx)),
          eq(rdStationWebhookLog.configId, input.configId),
        ];
        if (input.status) countConditions.push(eq(rdStationWebhookLog.status, input.status));
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(rdStationWebhookLog)
          .where(and(...countConditions));

        return {
          logs,
          total: Number(countResult[0]?.count || 0),
        };
      }),

    regenerateConfigToken: tenantAdminProcedure
      .input(z.object({ configId: z.number(), }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const newToken = randomBytes(32).toString("hex");
        await db
          .update(rdStationConfig)
          .set({ webhookToken: newToken })
          .where(and(eq(rdStationConfig.id, input.configId), eq(rdStationConfig.tenantId, getTenantId(ctx))));

        const rows = await db
          .select()
          .from(rdStationConfig)
          .where(and(eq(rdStationConfig.id, input.configId), eq(rdStationConfig.tenantId, getTenantId(ctx))))
          .limit(1);
        return rows[0] ?? null;
      }),

    // ─── Helper: list pipelines & stages for config form ───
    listPipelines: tenantAdminProcedure
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const rows = await db
          .select()
          .from(pipelines)
          .where(eq(pipelines.tenantId, getTenantId(ctx)))
          .orderBy(asc(pipelines.id));
        return rows;
      }),

    listStages: tenantAdminProcedure
      .input(z.object({ pipelineId: z.number() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const rows = await db
          .select()
          .from(pipelineStages)
          .where(and(eq(pipelineStages.tenantId, getTenantId(ctx)), eq(pipelineStages.pipelineId, input.pipelineId)))
          .orderBy(asc(pipelineStages.orderIndex));
        return rows;
      }),

    listTeamsForAssignment: tenantAdminProcedure
      .query(async ({ input, ctx }) => {
        return getTeamsForTenant(getTenantId(ctx));
      }),
    listTeamMembers: tenantAdminProcedure
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const rows = await db
          .select({ id: crmUsersSchema.id, name: crmUsersSchema.name, email: crmUsersSchema.email, role: crmUsersSchema.role })
          .from(crmUsersSchema)
          .where(and(eq(crmUsersSchema.tenantId, getTenantId(ctx)), eq(crmUsersSchema.status, "active")))
          .orderBy(asc(crmUsersSchema.name));
        return rows;
      }),

    // ─── Config Task Templates CRUD ───
    listConfigTasks: tenantAdminProcedure
      .input(z.object({ configId: z.number(), }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(rdStationConfigTasks)
          .where(and(eq(rdStationConfigTasks.configId, input.configId), eq(rdStationConfigTasks.tenantId, getTenantId(ctx))))
          .orderBy(asc(rdStationConfigTasks.orderIndex));
      }),

    addConfigTask: tenantAdminProcedure
      .input(z.object({
        configId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        taskType: z.string().max(32).default("task"),
        assignedToUserId: z.number().nullable().optional(),
        dueDaysOffset: z.number().min(0).max(365).default(0),
        dueTime: z.string().max(5).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get next orderIndex
        const existing = await db
          .select({ maxOrder: sql<number>`COALESCE(MAX(${rdStationConfigTasks.orderIndex}), -1)` })
          .from(rdStationConfigTasks)
          .where(and(eq(rdStationConfigTasks.configId, input.configId), eq(rdStationConfigTasks.tenantId, getTenantId(ctx))));
        const nextOrder = (existing[0]?.maxOrder ?? -1) + 1;

        const [result] = await db.insert(rdStationConfigTasks).values({
          configId: input.configId,
          tenantId: getTenantId(ctx),
          title: input.title,
          description: input.description ?? null,
          taskType: input.taskType,
          assignedToUserId: input.assignedToUserId ?? null,
          dueDaysOffset: input.dueDaysOffset,
          dueTime: input.dueTime ?? null,
          priority: input.priority,
          orderIndex: nextOrder,
        }).returning({ id: rdStationConfigTasks.id });

        const rows = await db.select().from(rdStationConfigTasks).where(eq(rdStationConfigTasks.id, result!.id)).limit(1);
        return rows[0]!;
      }),

    updateConfigTask: tenantAdminProcedure
      .input(z.object({
        taskId: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().nullable().optional(),
        taskType: z.string().max(32).optional(),
        assignedToUserId: z.number().nullable().optional(),
        dueDaysOffset: z.number().min(0).max(365).optional(),
        dueTime: z.string().max(5).nullable().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { taskId, ...updates } = input;
        const tenantId = getTenantId(ctx);
        const setObj: Record<string, any> = {};
        if (updates.title !== undefined) setObj.title = updates.title;
        if (updates.description !== undefined) setObj.description = updates.description;
        if (updates.taskType !== undefined) setObj.taskType = updates.taskType;
        if (updates.assignedToUserId !== undefined) setObj.assignedToUserId = updates.assignedToUserId;
        if (updates.dueDaysOffset !== undefined) setObj.dueDaysOffset = updates.dueDaysOffset;
        if (updates.dueTime !== undefined) setObj.dueTime = updates.dueTime;
        if (updates.priority !== undefined) setObj.priority = updates.priority;

        if (Object.keys(setObj).length > 0) {
          await db.update(rdStationConfigTasks).set(setObj)
            .where(and(eq(rdStationConfigTasks.id, taskId), eq(rdStationConfigTasks.tenantId, tenantId)));
        }

        const rows = await db.select().from(rdStationConfigTasks).where(eq(rdStationConfigTasks.id, taskId)).limit(1);
        return rows[0] ?? null;
      }),

    removeConfigTask: tenantAdminProcedure
      .input(z.object({ taskId: z.number(), }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(rdStationConfigTasks)
          .where(and(eq(rdStationConfigTasks.id, input.taskId), eq(rdStationConfigTasks.tenantId, getTenantId(ctx))));
        return { success: true };
      }),

    // ─── Helper: list active products for auto-product selector ───
    listProducts: tenantAdminProcedure
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select({ id: productCatalog.id, name: productCatalog.name, productType: productCatalog.productType, basePriceCents: productCatalog.basePriceCents })
          .from(productCatalog)

          .where(and(eq(productCatalog.tenantId, getTenantId(ctx)), eq(productCatalog.isActive, true)))
          .orderBy(asc(productCatalog.name));
      }),

    // ─── Helper: check WhatsApp session status for tenant ───
    getWhatsAppStatus: tenantAdminProcedure
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { connected: false, sessionId: null as string | null };
        const rows = await db
          .select({ sessionId: whatsappSessions.sessionId })
          .from(whatsappSessions)
          .where(and(eq(whatsappSessions.tenantId, getTenantId(ctx)), eq(whatsappSessions.status, "connected")))
          .limit(1);
        return {
          connected: rows.length > 0,
          sessionId: rows[0]?.sessionId ?? null,
        };
      }),
  }),

  // ── Field Mappings (RD Station ↔ Clinilucro) ──
  fieldMappings: router({
    list: tenantAdminProcedure
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const mappings = await db.select().from(rdFieldMappings)
          .where(eq(rdFieldMappings.tenantId, getTenantId(ctx)))
          .orderBy(rdFieldMappings.createdAt);
        return mappings;
      }),

    create: tenantAdminProcedure
      .input(z.object({
        rdFieldKey: z.string().min(1),
        rdFieldLabel: z.string().min(1),
        targetEntity: z.enum(["deal", "contact", "company"]).default("deal"),
        enturFieldType: z.enum(["standard", "custom"]),
        enturFieldKey: z.string().optional(),
        enturCustomFieldId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [result] = await db.insert(rdFieldMappings).values({
          tenantId: getTenantId(ctx),
          rdFieldKey: input.rdFieldKey,
          rdFieldLabel: input.rdFieldLabel,
          targetEntity: input.targetEntity,
          enturFieldType: input.enturFieldType,
          enturFieldKey: input.enturFieldKey || null,
          enturCustomFieldId: input.enturCustomFieldId || null,
        }).returning({ id: rdFieldMappings.id });
        return { id: result!.id };
      }),

    update: tenantAdminProcedure
      .input(z.object({
        id: z.number(),
        rdFieldKey: z.string().min(1).optional(),
        rdFieldLabel: z.string().min(1).optional(),
        targetEntity: z.enum(["deal", "contact", "company"]).optional(),
        enturFieldType: z.enum(["standard", "custom"]).optional(),
        enturFieldKey: z.string().nullable().optional(),
        enturCustomFieldId: z.number().nullable().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, ...updates } = input;
        const tenantId = getTenantId(ctx);
        await db.update(rdFieldMappings).set(updates)
          .where(and(eq(rdFieldMappings.id, id), eq(rdFieldMappings.tenantId, tenantId)));
        return { success: true };
      }),

    delete: tenantAdminProcedure
      .input(z.object({ id: z.number(), }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(rdFieldMappings)
          .where(and(eq(rdFieldMappings.id, input.id), eq(rdFieldMappings.tenantId, getTenantId(ctx))));
        return { success: true };
      }),

    // Lista campos padrão do Clinilucro disponíveis para mapeamento
    enturStandardFields: tenantAdminProcedure
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

    // Lista campos personalizados do Clinilucro disponíveis para mapeamento
    enturCustomFields: tenantAdminProcedure
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const fields = await db.select().from(customFields)
          .where(eq(customFields.tenantId, getTenantId(ctx)))
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

  // ════════════════════════════════════════════════════════════
  // AI INTEGRATIONS — OpenAI & Anthropic configuration
  // ════════════════════════════════════════════════════════════
  ai: router({
    list: tenantAdminProcedure
      .query(async ({ input, ctx }) => {
        const integrations = await listAiIntegrations(getTenantId(ctx));
        // Mask API keys for security
        return integrations.map(i => ({
          ...i,
          apiKey: i.apiKey ? `${i.apiKey.substring(0, 8)}...${i.apiKey.substring(i.apiKey.length - 4)}` : "",
        }));
      }),

    get: tenantAdminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const integration = await getAiIntegration(getTenantId(ctx), input.id);
        if (!integration) throw new TRPCError({ code: "NOT_FOUND", message: "Integration not found" });
        return {
          ...integration,
          apiKey: integration.apiKey ? `${integration.apiKey.substring(0, 8)}...${integration.apiKey.substring(integration.apiKey.length - 4)}` : "",
        };
      }),

    create: tenantAdminProcedure
      .input(z.object({
        provider: z.enum(["openai", "anthropic"]),
        apiKey: z.string().min(10),
        defaultModel: z.string().min(1),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = (ctx as any).user?.id ?? 0;
        return createAiIntegration({ ...input, tenantId: getTenantId(ctx), createdBy: userId });
      }),

    update: tenantAdminProcedure
      .input(z.object({
        id: z.number(),
        apiKey: z.string().min(10).optional(),
        defaultModel: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        await updateAiIntegration(tenantId, id, data);
        return { success: true };
      }),

    delete: tenantAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteAiIntegration(getTenantId(ctx), input.id);
        return { success: true };
      }),

    testKey: tenantAdminProcedure
      .input(z.object({
        provider: z.enum(["openai", "anthropic"]),
        apiKey: z.string().min(10),
        model: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        return testAiApiKey(input.provider, input.apiKey, input.model);
      }),

    // Invoke AI completion (generic endpoint for both providers)
    invoke: tenantAdminProcedure
      .input(z.object({
        provider: z.enum(["openai", "anthropic"]),
        messages: z.array(z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string(),
        })),
        maxTokens: z.number().optional(),
        model: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const integration = await getActiveAiIntegration(getTenantId(ctx), input.provider);
        if (!integration) {
          throw new TRPCError({ code: "NOT_FOUND", message: `No active ${input.provider} integration found` });
        }
        const model = input.model || integration.defaultModel;
        const maxTokens = input.maxTokens || 1024;

        try {
          if (input.provider === "openai") {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${integration.apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: input.messages,
                max_completion_tokens: maxTokens,
              }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: body?.error?.message || `OpenAI API error: ${res.status}` });
            }
            const data = await res.json();
            return {
              content: data.choices?.[0]?.message?.content || "",
              model: data.model,
              usage: data.usage,
            };
          } else {
            // Anthropic Claude
            const systemMsg = input.messages.find(m => m.role === "system");
            const nonSystemMsgs = input.messages.filter(m => m.role !== "system");
            const body: any = {
              model,
              messages: nonSystemMsgs.map(m => ({ role: m.role, content: m.content })),
              max_tokens: maxTokens,
            };
            if (systemMsg) body.system = systemMsg.content;
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": integration.apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify(body),
            });
            if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: errBody?.error?.message || `Anthropic API error: ${res.status}` });
            }
            const data = await res.json();
            return {
              content: data.content?.[0]?.text || "",
              model: data.model,
              usage: { prompt_tokens: data.usage?.input_tokens, completion_tokens: data.usage?.output_tokens, total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) },
            };
          }
        } catch (err: any) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message || "AI invocation failed" });
        }
      }),

    // ── Tenant AI Settings ──
    getSettings: tenantProcedure
      .query(async ({ input, ctx }) => {
        return getTenantAiSettings(getTenantId(ctx));
      }),

    updateSettings: tenantWriteProcedure
      .input(z.object({
        defaultAiProvider: z.enum(["openai", "anthropic"]).optional(),
        defaultAiModel: z.string().optional(),
        audioTranscriptionEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
const tenantId = getTenantId(ctx); const { ...patch } = input;
        await updateTenantAiSettings(tenantId, patch);
        return { success: true };
      }),

    // ── AI Suggestion (SPIN Selling) — uses isolated service ──
    suggest: tenantProcedure
      .input(z.object({
        // Legacy: messages from frontend (kept for backward compat, ignored when sessionId+remoteJid present)
        messages: z.array(z.object({
          fromMe: z.boolean(),
          content: z.string(),
          timestamp: z.string().optional(),
        })).optional(),
        contactName: z.string().optional(),
        dealTitle: z.string().optional(),
        dealValue: z.number().optional(),
        dealStage: z.string().optional(),
        integrationId: z.number().optional(),
        overrideModel: z.string().optional(),
        // New: fetch from DB directly
        sessionId: z.string().optional(),
        remoteJid: z.string().optional(),
        style: z.enum(["default", "shorter", "human", "objective", "consultive"]).optional(),
        customInstruction: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // New path: use isolated service when sessionId + remoteJid are provided
        if (input.sessionId && input.remoteJid) {
          const result = await generateSuggestion({
            tenantId: getTenantId(ctx),
            sessionId: input.sessionId,
            remoteJid: input.remoteJid,
            contactName: input.contactName,
            integrationId: input.integrationId,
            overrideModel: input.overrideModel,
            style: input.style as ResponseStyle,
            customInstruction: input.customInstruction,
          });
          return {
            suggestion: result.suggestion,
            parts: result.parts,
            provider: result.provider,
            model: result.model,
            intentClassified: result.intentClassified,
            durationMs: result.durationMs,
            contextMessageCount: result.contextMessageCount,
            hasCrmContext: result.hasCrmContext,
          };
        }

        // Legacy fallback: use messages from frontend
        let integration: any = null;
        if (input.integrationId) {
          integration = await getAiIntegration(getTenantId(ctx), input.integrationId);
        }
        if (!integration) {
          integration = await getAnyActiveAiIntegration(getTenantId(ctx));
        }
        if (!integration) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "NO_AI_CONFIGURED",
          });
        }
        const settings = await getTenantAiSettings(getTenantId(ctx));
        const model = input.overrideModel || settings.defaultAiModel || integration.defaultModel;

        // Build context from conversation
        const msgs = input.messages || [];
        const conversationContext = msgs
          .slice(-30)
          .map(m => `${m.fromMe ? "Agente" : (input.contactName || "Cliente")}: ${m.content}`)
          .join("\n");

        const dealContext = input.dealTitle
          ? `\n\nContexto do Negócio:\n- Título: ${input.dealTitle}\n- Valor: R$ ${((input.dealValue || 0) / 100).toFixed(2)}\n- Etapa: ${input.dealStage || "N/A"}`
          : "";

        const systemPrompt = `Você é um assistente que ajuda o AGENTE (vendedor) de uma agência de viagens a responder mensagens no WhatsApp.

CONTEXTO:
- Na conversa abaixo, "Agente" é o vendedor da agência (VOCÊ está escrevendo para ele).
- "${input.contactName || "Cliente"}" é o cliente que está conversando com o agente.
- Você deve sugerir o que o AGENTE deve responder ao cliente.

REGRAS:
1. Analise TODA a conversa para entender o contexto completo. Preste atenção especial na ÚLTIMA mensagem do cliente.
2. Sua resposta é o que o AGENTE vai enviar para o cliente. Você NÃO é o cliente. Você está ajudando o AGENTE a responder.
3. Se a última mensagem é do cliente dizendo "oi" ou "teste", o agente deve cumprimentar e perguntar como pode ajudar.
4. Se a última mensagem é do agente, sugira uma mensagem de follow-up ou aguarde (responda algo como "Oi, tudo bem? Posso te ajudar com algo?").
5. A resposta deve soar 100% humana, natural, como digitada por uma pessoa real no WhatsApp.
6. NUNCA use travessão, asteriscos, bullet points ou formatação markdown. Apenas texto corrido.
7. Use português brasileiro informal.
8. Responda APENAS com JSON válido: {"parts": ["mensagem 1", "mensagem 2"]}
9. Cada "part" é uma mensagem separada. Use 1 a 3 partes curtas (1-2 frases cada).
10. Não inclua explicações fora do JSON.`;

        const userPrompt = `Conversa entre o AGENTE (vendedor) e ${input.contactName || "o cliente"}:\n\n${conversationContext}${dealContext}\n\nO que o AGENTE deve responder ao cliente agora? Lembre-se: você está escrevendo A RESPOSTA DO AGENTE, não do cliente. Responda APENAS em JSON: {"parts": ["msg1", "msg2"]}`;

        try {
          if (integration.provider === "openai") {
            // Reasoning models (gpt-5*, o4*, o3*) use "developer" role instead of "system" and max_completion_tokens
            const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
            const systemRole = isReasoningModel ? "developer" : "system";
            const tokenParam = isReasoningModel ? { max_completion_tokens: 500 } : { max_tokens: 500 };
            const requestBody: Record<string, unknown> = {
                model,
                messages: [
                  { role: systemRole, content: systemPrompt },
                  { role: "user", content: userPrompt },
                ],
                ...tokenParam,
              };
            // Add reasoning_effort for reasoning models to speed up response
            if (isReasoningModel) {
              requestBody.reasoning_effort = "low";
            }
            console.log(`[AI Suggest] Calling OpenAI: model=${model}, systemRole=${systemRole}, reasoning=${isReasoningModel}`);
            // Use AbortController with 55s timeout to avoid proxy timeout
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 55000);
            let res: Response;
            try {
              res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${integration.apiKey}` },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
              });
            } catch (fetchErr: any) {
              clearTimeout(timeout);
              if (fetchErr.name === 'AbortError') {
                console.error(`[AI Suggest] OpenAI TIMEOUT: model=${model}`);
                throw new TRPCError({ code: "TIMEOUT", message: `O modelo ${model} demorou demais para responder. Tente um modelo mais rápido como gpt-4.1-mini.` });
              }
              throw fetchErr;
            }
            clearTimeout(timeout);
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              console.error(`[AI Suggest] OpenAI ERROR: status=${res.status}, model=${model}, error=`, JSON.stringify(body));
              throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: body?.error?.message || `OpenAI error: ${res.status}` });
            }
            console.log(`[AI Suggest] OpenAI SUCCESS: model=${model}`);
            const data = await res.json();
            const raw = data.choices?.[0]?.message?.content || "";
            const parsed = parseAiSuggestionParts(raw);
            return { suggestion: parsed.full, parts: parsed.parts, provider: "openai", model };
          } else {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": integration.apiKey, "anthropic-version": "2023-06-01" },
              body: JSON.stringify({
                model,
                system: systemPrompt,
                messages: [{ role: "user", content: userPrompt }],
                max_tokens: 500,
              }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: body?.error?.message || `Anthropic error: ${res.status}` });
            }
            const data = await res.json();
            const raw = data.content?.[0]?.text || "";
            const parsed = parseAiSuggestionParts(raw);
            return { suggestion: parsed.full, parts: parsed.parts, provider: "anthropic", model };
          }
        } catch (err: any) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message || "AI suggestion failed" });
        }
      }),

    // ── Audio Transcription via OpenAI Whisper ──
    transcribe: tenantProcedure
      .input(z.object({
        audioUrl: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if tenant has OpenAI integration (optional — Forge API is fallback)
        const integration = await getActiveAiIntegration(getTenantId(ctx), "openai");
        const hasTenantKey = !!(integration?.apiKey);

        try {
          if (hasTenantKey) {
            // Use tenant's OpenAI Whisper API
            const audioRes = await fetch(input.audioUrl);
            if (!audioRes.ok) throw new Error(`Failed to download audio: ${audioRes.status}`);
            const audioBuffer = await audioRes.arrayBuffer();
            const audioBlob = new Blob([audioBuffer]);

            const urlPath = new URL(input.audioUrl).pathname;
            const ext = urlPath.split(".").pop() || "ogg";

            const formData = new FormData();
            formData.append("file", audioBlob, `audio.${ext}`);
            formData.append("model", "whisper-1");
            formData.append("language", "pt");
            formData.append("response_format", "json");

            const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${integration!.apiKey}` },
              body: formData,
            });

            if (!whisperRes.ok) {
              const body = await whisperRes.json().catch(() => ({}));
              throw new Error(body?.error?.message || `Whisper API error: ${whisperRes.status}`);
            }

            const result = await whisperRes.json();
            return { text: result.text || "", language: result.language || "pt" };
          } else {
            // Fallback: use built-in Forge API (free, platform-provided)
            const { transcribeAudio } = await import("./_core/voiceTranscription");
            const forgeResult = await transcribeAudio({
              audioUrl: input.audioUrl,
              language: "pt",
              prompt: "Transcreva o áudio do usuário para texto.",
            });
            if ("error" in forgeResult) {
              throw new Error(`Forge API error: ${(forgeResult as any).error}`);
            }
            const result = forgeResult as { text: string; language?: string };
            return { text: result.text || "", language: result.language || "pt" };
          }
        } catch (err: any) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message || "Transcription failed" });
        }
      }),

    // ── Retranscribe audio message (manual trigger) ──
    retranscribeAudio: tenantProcedure
      .input(z.object({
        messageId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { waMessages } = await import("../drizzle/schema");
        const [msg] = await db.select()
          .from(waMessages)
          .where(and(
            eq(waMessages.id, input.messageId),
            eq(waMessages.tenantId, getTenantId(ctx)),
          ))
          .limit(1);
        if (!msg) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
        if (msg.messageType !== "audioMessage" && msg.messageType !== "pttMessage") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Not an audio message" });
        }
        await db.update(waMessages)
          .set({ audioTranscriptionStatus: "pending", audioTranscription: null })
          .where(eq(waMessages.id, input.messageId));
        const { enqueueAudioTranscription } = await import("./audioTranscriptionWorker");
        await enqueueAudioTranscription({
          messageId: msg.id,
          externalMessageId: msg.messageId || "",
          sessionId: msg.sessionId,
          instanceName: msg.sessionId,
          tenantId: msg.tenantId,
          remoteJid: msg.remoteJid,
          fromMe: msg.fromMe,
          mediaMimeType: msg.mediaMimeType || "audio/ogg",
          mediaDuration: msg.mediaDuration,
        });
        return { success: true };
      }),

    // ── Refine existing suggestion with different style ──
    refine: tenantProcedure
      .input(z.object({
        originalText: z.string(),
        style: z.enum(["default", "shorter", "human", "objective", "consultive"]),
        integrationId: z.number().optional(),
        overrideModel: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return refineSuggestion({
          tenantId: getTenantId(ctx),
          originalText: input.originalText,
          style: input.style as ResponseStyle,
          integrationId: input.integrationId,
          overrideModel: input.overrideModel,
        });
      }),

    // ── Split text into natural parts for broken sending ──
    splitParts: publicProcedure
      .input(z.object({ text: z.string() }))
      .mutation(({ input }) => {
        return { parts: splitTextNaturally(input.text) };
      }),

    // ── Async AI Suggestion (non-blocking, streaming via socket) ──
    suggestAsync: tenantProcedure
      .input(z.object({
        requestId: z.string(),
        sessionId: z.string(),
        remoteJid: z.string(),
        contactName: z.string().optional(),
        integrationId: z.number().optional(),
        overrideModel: z.string().optional(),
        style: z.enum(["default", "shorter", "human", "objective", "consultive"]).optional(),
        customInstruction: z.string().optional(),
      }))
      .mutation(({ input, ctx }) => {
        return requestSuggestion({
          requestId: input.requestId,
          tenantId: getTenantId(ctx),
          sessionId: input.sessionId,
          remoteJid: input.remoteJid,
          contactName: input.contactName,
          integrationId: input.integrationId,
          overrideModel: input.overrideModel,
          style: input.style,
          customInstruction: input.customInstruction,
        });
      }),

    // ── Cancel AI Suggestion ──
    cancel: tenantProcedure
      .input(z.object({
        requestId: z.string().optional(),
        sessionId: z.string().optional(),
        remoteJid: z.string().optional(),
      }))
      .mutation(({ input }) => {
        if (input.requestId) {
          return { cancelled: cancelSuggestion(input.requestId) ? 1 : 0 };
        }
        if (input.sessionId && input.remoteJid) {
          return { cancelled: cancelChatSuggestions(input.sessionId, input.remoteJid) };
        }
        return { cancelled: 0 };
      }),

    // List available models per provider
    models: publicProcedure
      .input(z.object({ provider: z.enum(["openai", "anthropic"]) }))
      .query(({ input }) => {
        if (input.provider === "openai") {
          return [
            { id: "gpt-4.1", name: "GPT-4.1", description: "Melhor custo-benefício para chat", contextWindow: "1M" },
            { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "Rápido e econômico", contextWindow: "128K" },
            { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", description: "Ultra econômico", contextWindow: "128K" },
            { id: "gpt-5-mini", name: "GPT-5 Mini", description: "Raciocínio rápido", contextWindow: "400K" },
            { id: "gpt-5.4", name: "GPT-5.4", description: "Modelo mais inteligente para raciocínio", contextWindow: "1M" },
            { id: "o4-mini", name: "o4-mini", description: "Raciocínio avançado econômico", contextWindow: "200K" },
          ];
        } else {
          return [
            { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", description: "Mais rápido e econômico", contextWindow: "200K" },
            { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "Melhor equilíbrio entre velocidade e inteligência", contextWindow: "1M" },
            { id: "claude-opus-4-6", name: "Claude Opus 4.6", description: "Mais inteligente para agentes e código", contextWindow: "1M" },
          ];
        }
      }),

    // ── AI Training Configs CRUD ──
    trainingConfigs: router({
      list: tenantAdminProcedure
        .query(async ({ ctx }) => {
          return listAiTrainingConfigs(getTenantId(ctx));
        }),

      get: tenantAdminProcedure
        .input(z.object({ configType: z.enum(["suggestion", "summary", "analysis"]) }))
        .query(async ({ ctx, input }) => {
          return getAiTrainingConfig(getTenantId(ctx), input.configType);
        }),

      upsert: tenantAdminProcedure
        .input(z.object({
          configType: z.enum(["suggestion", "summary", "analysis"]),
          instructions: z.string().min(1).max(5000),
        }))
        .mutation(async ({ ctx, input }) => {
          const userId = (ctx as any).user?.id ?? 0;
          return upsertAiTrainingConfig({
            tenantId: getTenantId(ctx),
            configType: input.configType,
            instructions: input.instructions,
            updatedBy: userId,
          });
        }),

      delete: tenantAdminProcedure
        .input(z.object({ configType: z.enum(["suggestion", "summary", "analysis"]) }))
        .mutation(async ({ ctx, input }) => {
          await deleteAiTrainingConfig(getTenantId(ctx), input.configType);
          return { success: true };
        }),
    }),

    // ── Summarize conversation with AI ──
    summarizeConversation: tenantProcedure
      .input(z.object({
        sessionId: z.string(),
        remoteJid: z.string(),
        maxMessages: z.number().optional().default(50),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { waMessages } = await import("../drizzle/schema");

        // Fetch recent messages for this conversation
        const messages = await db.select({
          id: waMessages.id,
          content: waMessages.content,
          fromMe: waMessages.fromMe,
          pushName: waMessages.pushName,
          messageType: waMessages.messageType,
          timestamp: waMessages.timestamp,
          audioTranscription: waMessages.audioTranscription,
        })
          .from(waMessages)
          .where(
            and(
              eq(waMessages.sessionId, input.sessionId),
              eq(waMessages.remoteJid, input.remoteJid),
              eq(waMessages.tenantId, tenantId),
            )
          )
          .orderBy(waMessages.timestamp)
          .limit(input.maxMessages);

        if (messages.length === 0) {
          return { summary: "Nenhuma mensagem encontrada nesta conversa." };
        }

        // Format messages for LLM
        const formatted = messages.map((m) => {
          const sender = m.fromMe ? "Agente" : (m.pushName || "Cliente");
          const time = m.timestamp ? new Date(m.timestamp).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
          const isAudio = m.messageType === "audioMessage" || m.messageType === "pttMessage" || m.messageType === "audio";
          let text = m.content || "";
          if (isAudio) {
            text = m.audioTranscription ? `[Áudio transcrito: ${m.audioTranscription}]` : "[Áudio não transcrito]";
          } else if (m.messageType === "imageMessage") {
            text = text ? `[Imagem] ${text}` : "[Imagem]";
          } else if (m.messageType === "videoMessage") {
            text = text ? `[Vídeo] ${text}` : "[Vídeo]";
          } else if (m.messageType === "documentMessage") {
            text = text ? `[Documento] ${text}` : "[Documento]";
          } else if (m.messageType === "stickerMessage") {
            text = "[Sticker]";
          } else if (m.messageType === "locationMessage") {
            text = "[Localização]";
          } else if (m.messageType === "contactMessage" || m.messageType === "contactsArrayMessage") {
            text = "[Contato]";
          }
          return `[${time}] ${sender}: ${text}`;
        }).join("\n");

        // Call tenant's AI provider to generate summary
        try {
          const summaryTraining = await getAiTrainingConfig(tenantId, "summary");
          const customInstructions = summaryTraining?.instructions || "";

          const systemContent = `Você é um assistente de atendimento ao cliente. Gere um resumo conciso da conversa de WhatsApp abaixo.

O resumo deve conter:
1. **Assunto principal** da conversa (1 linha)
2. **Pontos-chave** discutidos (lista curta)
3. **Status atual** (aguardando resposta do cliente, aguardando ação do agente, resolvido, etc.)
4. **Próximos passos** sugeridos (se houver)

Seja direto e objetivo. Use português brasileiro. Máximo 200 palavras.
${customInstructions ? `\n--- INSTRUÇÕES PERSONALIZADAS ---\n${customInstructions}` : ""}`;

          const aiResult = await callTenantAi({
            tenantId,
            messages: [
              { role: "system", content: systemContent },
              { role: "user", content: `Conversa (${messages.length} mensagens):\n\n${formatted}` },
            ],
            maxTokens: 500,
          });
          return { summary: aiResult.content || "Não foi possível gerar o resumo." };
        } catch (err: any) {
          if (err.message === "NO_AI_CONFIGURED") {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Nenhum provedor de IA configurado. Acesse Integrações > IA para configurar." });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao gerar resumo: ${err.message}` });
        }
      }),
  }),

  // ─── Plan & Limits ───
  plan: router({
    summary: tenantProcedure.query(async ({ ctx }) => {
      const { getTenantPlanSummary } = await import("./services/planLimitsService");
      return getTenantPlanSummary(getTenantId(ctx));
    }),
    canAddUser: tenantProcedure.query(async ({ ctx }) => {
      const { canAddUser } = await import("./services/planLimitsService");
      return canAddUser(getTenantId(ctx));
    }),
    /** Retorna todos os planos ativos e públicos (do banco com cache, ou fallback estático) */
    active: publicProcedure.query(async () => {
      const { getPublicPlans, getFeatureDescriptions } = await import("./services/dynamicPlanService");
      const plans = await getPublicPlans();
      return { plans, featureDescriptions: getFeatureDescriptions() };
    }),
    /** Endpoint público seguro para landing page — sem IDs internos nem dados de billing */
    public: publicProcedure.query(async () => {
      const { getPublicPlans } = await import("./services/publicPlansService");
      return getPublicPlans();
    }),
  }),

  // ─── Agenda Unificada (Home Calendar) ───
  agenda: router({
    unified: tenantProcedure
      .input(z.object({
        from: z.string(), // YYYY-MM-DD
        to: z.string(),   // YYYY-MM-DD
        userId: z.number().optional(),
        teamId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { getUnifiedAgenda } = await import("./services/agendaService");
        const userId = input.userId; // All tenant users see all appointments; optional filter via input
        const teamId = input.teamId;
        return getUnifiedAgenda(getTenantId(ctx), { from: input.from, to: input.to, userId, teamId });
      }),
    syncGoogle: tenantWriteProcedure
      .mutation(async ({ ctx }) => {
        const { syncGoogleCalendar } = await import("./services/agendaService");
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        return syncGoogleCalendar(getTenantId(ctx), userId);
      }),
    disconnectGoogle: tenantWriteProcedure
      .mutation(async ({ ctx }) => {
        const { disconnectGoogleCalendar } = await import("./services/agendaService");
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        return disconnectGoogleCalendar(getTenantId(ctx), userId);
      }),
    googleStatus: tenantProcedure
      .query(async ({ ctx }) => {
        const { getGoogleCalendarStatus } = await import("./services/agendaService");
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        return getGoogleCalendarStatus(getTenantId(ctx), userId);
      }),
    // List tenant users for participant picker
    tenantUsers: tenantProcedure
      .query(async ({ ctx }) => {
        const crm = await import("./crmDb");
        const users = await crm.listCrmUsers(getTenantId(ctx));
        return (users || []).map((u: any) => ({
          userId: u.userId,
          name: u.name || u.email || `Usuário #${u.userId}`,
          email: u.email || null,
          role: u.role || "user",
        }));
      }),
    // Get participants for a specific appointment
    getParticipants: tenantProcedure
      .input(z.object({ appointmentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getAppointmentParticipants } = await import("./services/agendaService");
        return getAppointmentParticipants(getTenantId(ctx), input.appointmentId);
      }),
    createAppointment: tenantWriteProcedure
      .input(z.object({
        title: z.string().min(1).max(500),
        description: z.string().max(5000).optional(),
        startAt: z.number(),  // UTC timestamp ms
        endAt: z.number(),    // UTC timestamp ms
        allDay: z.boolean().optional(),
        location: z.string().max(500).optional(),
        color: z.string().max(20).optional(),
        dealId: z.number().optional(),
        contactId: z.number().optional(),
        participantIds: z.array(z.number()).optional(),
        serviceType: z.string().max(100).optional(),
        status: z.enum(["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"]).optional(),
        recurrenceRule: z.string().optional(),
        notes: z.string().optional(),
        price: z.number().optional(),
        professionalId: z.number().optional(),
        contactPhone: z.string().max(32).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createAppointment } = await import("./services/agendaService");
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        return createAppointment(getTenantId(ctx), userId, input);
      }),
    updateAppointment: tenantWriteProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().max(5000).optional(),
        startAt: z.number().optional(),
        endAt: z.number().optional(),
        allDay: z.boolean().optional(),
        location: z.string().max(500).optional(),
        color: z.string().max(20).optional(),
        dealId: z.number().optional(),
        contactId: z.number().optional(),
        isCompleted: z.boolean().optional(),
        participantIds: z.array(z.number()).optional(),
        serviceType: z.string().max(100).optional(),
        status: z.enum(["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"]).optional(),
        recurrenceRule: z.string().optional(),
        notes: z.string().optional(),
        price: z.number().optional(),
        professionalId: z.number().optional(),
        contactPhone: z.string().max(32).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateAppointment } = await import("./services/agendaService");
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const isAdmin = ctx.saasUser?.role === "admin";
        return updateAppointment(getTenantId(ctx), userId, isAdmin, input);
      }),
    confirmAppointment: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { updateAppointment } = await import("./services/agendaService");
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        return updateAppointment(getTenantId(ctx), userId, true, { id: input.id, status: "confirmed" } as any);
      }),
    completeAppointment: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { updateAppointment } = await import("./services/agendaService");
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        return updateAppointment(getTenantId(ctx), userId, true, { id: input.id, status: "completed", isCompleted: true } as any);
      }),
    cancelAppointment: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { updateAppointment } = await import("./services/agendaService");
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        return updateAppointment(getTenantId(ctx), userId, true, { id: input.id, status: "cancelled" } as any);
      }),
    deleteAppointment: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteAppointment } = await import("./services/agendaService");
        const userId = ctx.saasUser?.userId || ctx.user!.id;
        const isAdmin = ctx.saasUser?.role === "admin";
        return deleteAppointment(getTenantId(ctx), userId, isAdmin, input.id);
      }),
  }),

  // ─── Custom Messages (Mensagens Personalizadas) ───
  customMessages: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      const { listCustomMessages } = await import("./services/customMessagesService");
      return listCustomMessages(getTenantId(ctx));
    }),
    listByCategory: tenantProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ ctx, input }) => {
        const { listCustomMessagesByCategory } = await import("./services/customMessagesService");
        return listCustomMessagesByCategory(getTenantId(ctx), input.category);
      }),
    create: tenantWriteProcedure
      .input(z.object({
        category: z.string(),
        title: z.string().min(1).max(255),
        content: z.string().min(1),
        orderIndex: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createCustomMessage } = await import("./services/customMessagesService");
        return createCustomMessage({
          tenantId: getTenantId(ctx),
          category: input.category,
          title: input.title,
          content: input.content,
          orderIndex: input.orderIndex ?? 0,
          isActive: true,
          createdBy: ctx.user!.id,
        });
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        content: z.string().min(1).optional(),
        category: z.string().optional(),
        orderIndex: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateCustomMessage } = await import("./services/customMessagesService");
        const { id, ...data } = input;
        return updateCustomMessage(getTenantId(ctx), id, data);
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteCustomMessage } = await import("./services/customMessagesService");
        return deleteCustomMessage(getTenantId(ctx), input.id);
      }),
    categories: publicProcedure.query(async () => {
      const { CUSTOM_MESSAGE_CATEGORIES } = await import("./services/customMessagesService");
      return CUSTOM_MESSAGE_CATEGORIES;
    }),
  }),

  // ─── Referrals (Indicacoes) ───
  referrals: router({
    list: tenantProcedure
      .input(z.object({
        referrerId: z.number().optional(),
        status: z.enum(["pending", "converted", "expired"]).optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const { listReferrals } = await import("./services/referralService");
        return listReferrals(getTenantId(ctx), input || {});
      }),
    stats: tenantProcedure
      .query(async ({ ctx }) => {
        const { getReferralStats } = await import("./services/referralService");
        return getReferralStats(getTenantId(ctx));
      }),
    create: tenantWriteProcedure
      .input(z.object({
        referrerId: z.number(),
        referredId: z.number(),
        dealId: z.number().optional(),
        rewardType: z.enum(["discount", "credit", "gift", "none"]).optional(),
        rewardValue: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createReferral } = await import("./services/referralService");
        return createReferral({ tenantId: getTenantId(ctx), ...input });
      }),
    convert: tenantWriteProcedure
      .input(z.object({ referralId: z.number(), dealId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { convertReferral } = await import("./services/referralService");
        return convertReferral(input.referralId, input.dealId);
      }),
    markRewardDelivered: tenantWriteProcedure
      .input(z.object({ referralId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { markRewardDelivered } = await import("./services/referralService");
        return markRewardDelivered(input.referralId);
      }),
  }),

  // ─── Client Packages (Pacotes de Sessoes) ───
  packages: router({
    list: tenantProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getContactPackages } = await import("./services/packageService");
        return getContactPackages(getTenantId(ctx), input.contactId);
      }),
    expiring: tenantProcedure
      .query(async ({ ctx }) => {
        const { getExpiringPackages } = await import("./services/packageService");
        return getExpiringPackages(getTenantId(ctx));
      }),
    create: tenantWriteProcedure
      .input(z.object({
        contactId: z.number(),
        productId: z.number().optional(),
        name: z.string().min(1).max(255),
        totalSessions: z.number().min(1),
        priceTotal: z.number().optional(),
        expiresAt: z.number().optional(), // timestamp ms
      }))
      .mutation(async ({ ctx, input }) => {
        const { createPackage } = await import("./services/packageService");
        return createPackage({
          tenantId: getTenantId(ctx),
          contactId: input.contactId,
          productId: input.productId,
          name: input.name,
          totalSessions: input.totalSessions,
          priceTotal: input.priceTotal,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        });
      }),
    useSession: tenantWriteProcedure
      .input(z.object({ packageId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { useSession } = await import("./services/packageService");
        return useSession(input.packageId, getTenantId(ctx));
      }),
    cancel: tenantWriteProcedure
      .input(z.object({ packageId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { cancelPackage } = await import("./services/packageService");
        return cancelPackage(input.packageId, getTenantId(ctx));
      }),
  }),

  // ─── Client Evolutions (Evolucoes Clinicas) ───
  evolutions: router({
    list: tenantProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { listEvolutions } = await import("./services/evolutionService");
        return listEvolutions(getTenantId(ctx), input.contactId);
      }),
    create: tenantWriteProcedure
      .input(z.object({
        contactId: z.number(),
        appointmentId: z.number().optional(),
        treatmentId: z.number().optional(),
        title: z.string().min(1).max(255),
        content: z.string().min(1),
        professionalId: z.number().optional(),
        photos: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createEvolution } = await import("./services/evolutionService");
        return createEvolution({ tenantId: getTenantId(ctx), ...input });
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        photos: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateEvolution } = await import("./services/evolutionService");
        return updateEvolution(input.id, getTenantId(ctx), input);
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteEvolution } = await import("./services/evolutionService");
        return deleteEvolution(input.id, getTenantId(ctx));
      }),
  }),

  // ─── Anamnesis (Fichas de Anamnese) ───
  anamnesis: router({
    templates: router({
      list: tenantProcedure.query(async ({ ctx }) => {
        const { listTemplates } = await import("./services/anamnesisService");
        return listTemplates(getTenantId(ctx));
      }),
      create: tenantWriteProcedure
        .input(z.object({
          name: z.string().min(1).max(255),
          description: z.string().optional(),
          isDefault: z.boolean().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { createTemplate } = await import("./services/anamnesisService");
          return createTemplate(getTenantId(ctx), input.name, input.description, input.isDefault);
        }),
      update: tenantWriteProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          isDefault: z.boolean().optional(),
          isActive: z.boolean().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { updateTemplate } = await import("./services/anamnesisService");
          return updateTemplate(input.id, getTenantId(ctx), input);
        }),
    }),
    questions: router({
      list: tenantProcedure
        .input(z.object({ templateId: z.number() }))
        .query(async ({ ctx, input }) => {
          const { listQuestions } = await import("./services/anamnesisService");
          return listQuestions(input.templateId, getTenantId(ctx));
        }),
      create: tenantWriteProcedure
        .input(z.object({
          templateId: z.number(),
          section: z.string().optional(),
          question: z.string().min(1),
          questionType: z.enum(["text", "textarea", "boolean", "select", "multiselect", "number", "date"]),
          options: z.array(z.string()).optional(),
          isRequired: z.boolean().optional(),
          sortOrder: z.number().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { createQuestion } = await import("./services/anamnesisService");
          return createQuestion(getTenantId(ctx), input.templateId, input);
        }),
      update: tenantWriteProcedure
        .input(z.object({
          id: z.number(),
          section: z.string().optional(),
          question: z.string().optional(),
          questionType: z.enum(["text", "textarea", "boolean", "select", "multiselect", "number", "date"]).optional(),
          options: z.array(z.string()).optional(),
          isRequired: z.boolean().optional(),
          sortOrder: z.number().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { updateQuestion } = await import("./services/anamnesisService");
          return updateQuestion(input.id, getTenantId(ctx), input);
        }),
      delete: tenantWriteProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const { deleteQuestion } = await import("./services/anamnesisService");
          return deleteQuestion(input.id, getTenantId(ctx));
        }),
    }),
    responses: router({
      list: tenantProcedure
        .input(z.object({ contactId: z.number() }))
        .query(async ({ ctx, input }) => {
          const { getContactResponses } = await import("./services/anamnesisService");
          return getContactResponses(getTenantId(ctx), input.contactId);
        }),
      save: tenantWriteProcedure
        .input(z.object({
          contactId: z.number(),
          templateId: z.number(),
          answers: z.record(z.string(), z.string()),
          observation: z.string().optional(),
          filledByMode: z.enum(["professional", "patient"]).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { saveResponse } = await import("./services/anamnesisService");
          const userId = (ctx as any).session?.userId;
          return saveResponse(getTenantId(ctx), { ...input, filledByUserId: userId });
        }),
    }),
  }),

  // ─── Client Treatments (Tratamentos) ───
  treatments: router({
    list: tenantProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { listTreatments } = await import("./services/treatmentService");
        return listTreatments(getTenantId(ctx), input.contactId);
      }),
    create: tenantWriteProcedure
      .input(z.object({
        contactId: z.number(),
        dealId: z.number().optional(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        totalSessions: z.number().optional(),
        startDate: z.number().optional(), // timestamp ms
        endDate: z.number().optional(),
        valueCents: z.number().optional(),
        professionalId: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createTreatment } = await import("./services/treatmentService");
        return createTreatment({
          tenantId: getTenantId(ctx),
          ...input,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        });
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["active", "completed", "cancelled", "paused"]).optional(),
        totalSessions: z.number().optional(),
        valueCents: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateTreatment } = await import("./services/treatmentService");
        return updateTreatment(input.id, getTenantId(ctx), input);
      }),
    addSession: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { addSession } = await import("./services/treatmentService");
        return addSession(input.id, getTenantId(ctx));
      }),
  }),

  // ─── Client Debits (Debitos Financeiros) ───
  debits: router({
    list: tenantProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { listDebits } = await import("./services/debitService");
        return listDebits(getTenantId(ctx), input.contactId);
      }),
    stats: tenantProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getDebitStats } = await import("./services/debitService");
        return getDebitStats(getTenantId(ctx), input.contactId);
      }),
    create: tenantWriteProcedure
      .input(z.object({
        contactId: z.number(),
        dealId: z.number().optional(),
        treatmentId: z.number().optional(),
        description: z.string().min(1).max(500),
        totalCents: z.number().min(1),
        dueDate: z.number().optional(), // timestamp ms
        paymentMethod: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createDebit } = await import("./services/debitService");
        return createDebit({
          tenantId: getTenantId(ctx),
          ...input,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        });
      }),
    addPayment: tenantWriteProcedure
      .input(z.object({
        id: z.number(),
        amountCents: z.number().min(1),
        paymentMethod: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { addPayment } = await import("./services/debitService");
        return addPayment(input.id, getTenantId(ctx), input.amountCents, input.paymentMethod);
      }),
    cancel: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { cancelDebit } = await import("./services/debitService");
        return cancelDebit(input.id, getTenantId(ctx));
      }),
  }),

  // ─── Client Documents (Documentos Categorizados) ───
  clientDocuments: router({
    list: tenantProcedure
      .input(z.object({ contactId: z.number(), category: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const { listDocuments } = await import("./services/clientDocumentService");
        return listDocuments(getTenantId(ctx), input.contactId, input.category);
      }),
    create: tenantWriteProcedure
      .input(z.object({
        contactId: z.number(),
        category: z.enum(["receita", "atestado", "imagem", "contrato", "exame", "consentimento", "outro"]),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        fileUrl: z.string().min(1),
        fileName: z.string().min(1),
        mimeType: z.string().optional(),
        sizeBytes: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createDocument } = await import("./services/clientDocumentService");
        const userId = (ctx as any).session?.userId;
        return createDocument({ tenantId: getTenantId(ctx), ...input, uploadedByUserId: userId });
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteDocument } = await import("./services/clientDocumentService");
        return deleteDocument(input.id, getTenantId(ctx));
      }),
  }),

  // ─── Recurrence Analytics Dashboard ───
  recurrenceAnalytics: router({
    summary: tenantProcedure
      .input(z.object({ days: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const { sql } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return null;
        const tenantId = getTenantId(ctx);
        const days = input.days || 90;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const result = await db.execute(sql`
          SELECT
            (SELECT COUNT(DISTINCT "contactId") FROM deals WHERE "tenantId" = ${tenantId} AND status = 'won' AND "deletedAt" IS NULL) AS "totalClientes",
            (SELECT COUNT(DISTINCT d1."contactId") FROM deals d1
             WHERE d1."tenantId" = ${tenantId} AND d1.status = 'won' AND d1."deletedAt" IS NULL
             AND (SELECT COUNT(*) FROM deals d2 WHERE d2."contactId" = d1."contactId" AND d2."tenantId" = ${tenantId} AND d2.status = 'won' AND d2."deletedAt" IS NULL) >= 2
            ) AS "clientesRecorrentes",
            (SELECT COALESCE(AVG(sub.cnt), 0) FROM (
              SELECT COUNT(*) as cnt FROM deals WHERE "tenantId" = ${tenantId} AND status = 'won' AND "deletedAt" IS NULL GROUP BY "contactId"
            ) sub) AS "mediaComprasPorCliente",
            (SELECT COALESCE(AVG(sub.total), 0) FROM (
              SELECT SUM("valueCents") as total FROM deals WHERE "tenantId" = ${tenantId} AND status = 'won' AND "deletedAt" IS NULL GROUP BY "contactId"
            ) sub) AS "ticketMedioCliente",
            (SELECT COUNT(*) FROM client_packages WHERE "tenantId" = ${tenantId} AND status = 'active') AS "pacotesAtivos",
            (SELECT COUNT(*) FROM client_packages WHERE "tenantId" = ${tenantId} AND status = 'completed') AS "pacotesConcluidos",
            (SELECT COALESCE(SUM("usedSessions"), 0) FROM client_packages WHERE "tenantId" = ${tenantId} AND status IN ('active', 'completed')) AS "sessoesUsadas",
            (SELECT COALESCE(SUM("totalSessions"), 0) FROM client_packages WHERE "tenantId" = ${tenantId} AND status IN ('active', 'completed')) AS "sessoesTotais",
            (SELECT COUNT(*) FROM referrals WHERE "tenantId" = ${tenantId}) AS "totalIndicacoes",
            (SELECT COUNT(*) FROM referrals WHERE "tenantId" = ${tenantId} AND status = 'converted') AS "indicacoesConvertidas"
        `);

        const row = (result as any).rows?.[0] || {};
        const totalClientes = Number(row.totalClientes || 0);
        const clientesRecorrentes = Number(row.clientesRecorrentes || 0);
        const taxaRetorno = totalClientes > 0 ? Math.round((clientesRecorrentes / totalClientes) * 100) : 0;
        const sessoesUsadas = Number(row.sessoesUsadas || 0);
        const sessoesTotais = Number(row.sessoesTotais || 0);
        const taxaUsoPacotes = sessoesTotais > 0 ? Math.round((sessoesUsadas / sessoesTotais) * 100) : 0;

        return {
          totalClientes,
          clientesRecorrentes,
          taxaRetorno,
          mediaComprasPorCliente: Number(Number(row.mediaComprasPorCliente || 0).toFixed(1)),
          ticketMedioCliente: Number(row.ticketMedioCliente || 0),
          pacotesAtivos: Number(row.pacotesAtivos || 0),
          pacotesConcluidos: Number(row.pacotesConcluidos || 0),
          taxaUsoPacotes,
          totalIndicacoes: Number(row.totalIndicacoes || 0),
          indicacoesConvertidas: Number(row.indicacoesConvertidas || 0),
        };
      }),
    monthlyRecurrence: tenantProcedure
      .input(z.object({ months: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const { sql } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return [];
        const tenantId = getTenantId(ctx);
        const months = input.months || 6;
        const since = new Date();
        since.setMonth(since.getMonth() - months);

        const result = await db.execute(sql`
          SELECT
            TO_CHAR(d."updatedAt", 'YYYY-MM') AS month,
            COUNT(DISTINCT d."contactId") AS "uniqueClients",
            COUNT(*) AS "totalDeals",
            COALESCE(SUM(d."valueCents"), 0) AS "revenue",
            COUNT(DISTINCT CASE
              WHEN (SELECT COUNT(*) FROM deals d2 WHERE d2."contactId" = d."contactId" AND d2."tenantId" = ${tenantId} AND d2.status = 'won' AND d2."deletedAt" IS NULL AND d2."updatedAt" < d."updatedAt") > 0
              THEN d."contactId"
            END) AS "returningClients"
          FROM deals d
          WHERE d."tenantId" = ${tenantId}
            AND d.status = 'won'
            AND d."deletedAt" IS NULL
            AND d."updatedAt" >= ${since}
          GROUP BY TO_CHAR(d."updatedAt", 'YYYY-MM')
          ORDER BY month ASC
        `);

        return ((result as any).rows || []).map((r: any) => ({
          month: r.month,
          uniqueClients: Number(r.uniqueClients || 0),
          totalDeals: Number(r.totalDeals || 0),
          revenue: Number(r.revenue || 0),
          returningClients: Number(r.returningClients || 0),
        }));
      }),
    topRecurringClients: tenantProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const { sql } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return [];
        const tenantId = getTenantId(ctx);

        const result = await db.execute(sql`
          SELECT
            c.id, c.name, c.phone,
            COUNT(d.id) AS "totalPurchases",
            COALESCE(SUM(d."valueCents"), 0) AS "totalSpent",
            MAX(d."updatedAt") AS "lastPurchase",
            COALESCE(c."referralCount", 0) AS "referralCount"
          FROM contacts c
          INNER JOIN deals d ON d."contactId" = c.id AND d."tenantId" = ${tenantId} AND d.status = 'won' AND d."deletedAt" IS NULL
          WHERE c."tenantId" = ${tenantId} AND c."deletedAt" IS NULL
          GROUP BY c.id, c.name, c.phone, c."referralCount"
          HAVING COUNT(d.id) >= 2
          ORDER BY "totalSpent" DESC
          LIMIT ${input.limit || 10}
        `);

        return ((result as any).rows || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          totalPurchases: Number(r.totalPurchases || 0),
          totalSpent: Number(r.totalSpent || 0),
          lastPurchase: r.lastPurchase,
          referralCount: Number(r.referralCount || 0),
        }));
      }),
  }),

  superAdminDash: superAdminDashRouter,
  superAdminPlans: superAdminPlansRouter,
  superAdminManagement: superAdminManagementRouter,
});

export type AppRouter = typeof appRouter;
