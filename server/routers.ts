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
} from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// CRM Routers
import { adminRouter } from "./routers/adminRouter";
import { crmRouter } from "./routers/crmRouter";
import { inboxRouter } from "./routers/inboxRouter";
import { proposalRouter, portalRouter, managementRouter, insightsRouter, academyRouter, integrationHubRouter } from "./routers/featureRouters";
import { productCatalogRouter } from "./routers/productCatalogRouter";

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
    // Conversations list with multi-agent assignment info
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
    listAgents: protectedProcedure
      .input(z.object({ tenantId: z.number().default(1) }))
      .query(async ({ input }) => getAgentsWithTeams(input.tenantId)),
    updateAgentStatus: protectedProcedure
      .input(z.object({
        tenantId: z.number().default(1),
        userId: z.number(),
        status: z.enum(["active", "inactive", "invited"]),
      }))
      .mutation(async ({ input }) => {
        await updateAgentStatus(input.tenantId, input.userId, input.status);
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
});

export type AppRouter = typeof appRouter;
