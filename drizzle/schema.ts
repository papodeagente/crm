import { integer, pgEnum, pgTable, text, timestamp, varchar, boolean, json, bigint, index, uniqueIndex, numeric, serial } from "drizzle-orm/pg-core";

// ════════════════════════════════════════════════════════════
// ENUM TYPE DEFINITIONS (PostgreSQL)
// ════════════════════════════════════════════════════════════

export const visibilityScopeEnum = pgEnum("visibilityScope", ["personal", "team", "global"]);
export const ai_integrations_providerEnum = pgEnum("ai_integrations_provider", ["openai", "anthropic"]);
export const configTypeEnum = pgEnum("configType", ["suggestion", "summary", "analysis", "extraction"]);
export const alerts_statusEnum = pgEnum("alerts_status", ["active", "resolved", "dismissed"]);
export const bulk_campaign_messages_statusEnum = pgEnum("bulk_campaign_messages_status", ["pending", "sending", "sent", "delivered", "read", "failed", "skipped"]);
export const bulk_campaigns_statusEnum = pgEnum("bulk_campaigns_status", ["running", "completed", "cancelled", "failed"]);
export const channels_statusEnum = pgEnum("channels_status", ["active", "inactive", "error"]);
export const channels_typeEnum = pgEnum("channels_type", ["whatsapp", "instagram", "email", "webchat"]);
export const ruleTypeEnum = pgEnum("ruleType", ["whitelist", "blacklist"]);
export const consentStatusEnum = pgEnum("consentStatus", ["pending", "granted", "revoked"]);
export const lifecycleStageEnum = pgEnum("lifecycleStage", ["lead", "prospect", "customer", "churned", "merged"]);
export const contacts_typeEnum = pgEnum("contacts_type", ["person", "company"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "urgent"]);
export const conversation_assignments_statusEnum = pgEnum("conversation_assignments_status", ["open", "pending", "resolved", "closed"]);
export const conversations_statusEnum = pgEnum("conversations_status", ["open", "pending", "closed"]);
export const courses_statusEnum = pgEnum("courses_status", ["draft", "published", "archived"]);
export const crm_tasks_statusEnum = pgEnum("crm_tasks_status", ["pending", "in_progress", "done", "cancelled"]);
export const crm_user_roleEnum = pgEnum("crm_user_role", ["admin", "user"]);
export const crm_users_statusEnum = pgEnum("crm_users_status", ["active", "inactive", "invited"]);
export const entityTypeEnum = pgEnum("entityType", ["contact", "deal", "company"]);
export const entityEnum = pgEnum("entity", ["contact", "deal", "company"]);
export const fieldTypeEnum = pgEnum("fieldType", ["text", "number", "date", "select", "multiselect", "checkbox", "textarea", "email", "phone", "url", "currency"]);
export const conditionEnum = pgEnum("condition", ["days_before", "days_after", "on_date"]);
export const dateFieldEnum = pgEnum("dateField", ["appointmentDate", "followUpDate", "expectedCloseAt", "createdAt"]);
export const dealStatusFilterEnum = pgEnum("dealStatusFilter", ["open", "won", "lost"]);
export const deal_participants_roleEnum = pgEnum("deal_participants_role", ["decision_maker", "client", "payer", "dependent", "other"]);
export const categoryEnum = pgEnum("category", ["servico", "pacote", "consulta", "procedimento", "assinatura", "produto", "other"]);
export const deals_statusEnum = pgEnum("deals_status", ["open", "won", "lost"]);
export const strategyEnum = pgEnum("strategy", ["round_robin", "least_busy", "manual", "team_round_robin"]);
export const enrollments_statusEnum = pgEnum("enrollments_status", ["enrolled", "in_progress", "completed"]);
export const actorTypeEnum = pgEnum("actorType", ["user", "system", "api", "webhook"]);
export const scopeEnum = pgEnum("scope", ["user", "company"]);
export const directionEnum = pgEnum("direction", ["inbound", "outbound"]);
export const inbox_messages_statusEnum = pgEnum("inbox_messages_status", ["pending", "sent", "delivered", "read", "failed"]);
export const integration_connections_statusEnum = pgEnum("integration_connections_status", ["connected", "disconnected", "error"]);
export const integration_credentials_statusEnum = pgEnum("integration_credentials_status", ["active", "revoked"]);
export const integrations_statusEnum = pgEnum("integrations_status", ["active", "inactive", "error"]);
export const jobs_statusEnum = pgEnum("jobs_status", ["pending", "running", "completed", "failed"]);
export const audio_transcription_statusEnum = pgEnum("audio_transcription_status", ["pending", "processing", "completed", "failed"]);
export const triggerEventEnum = pgEnum("triggerEvent", ["deal_won", "deal_lost", "stage_reached"]);
export const pipelineTypeEnum = pgEnum("pipelineType", ["sales", "post_sale", "support", "custom"]);
export const billing_cycleEnum = pgEnum("billing_cycle", ["monthly", "annual"]);
export const portal_tickets_statusEnum = pgEnum("portal_tickets_status", ["open", "in_progress", "resolved", "closed"]);
export const portal_users_statusEnum = pgEnum("portal_users_status", ["active", "inactive"]);
export const productTypeEnum = pgEnum("productType", ["servico", "pacote", "consulta", "procedimento", "assinatura", "produto", "other"]);
export const proposals_statusEnum = pgEnum("proposals_status", ["draft", "sent", "viewed", "accepted", "rejected", "expired"]);
export const contentTypeEnum = pgEnum("contentType", ["text", "image", "video", "audio", "document"]);
export const enturFieldTypeEnum = pgEnum("enturFieldType", ["standard", "custom"]);
export const targetEntityEnum = pgEnum("targetEntity", ["deal", "contact", "company"]);
export const assignmentModeEnum = pgEnum("assignmentMode", ["specific_user", "random_all", "random_team"]);
export const rd_station_webhook_log_statusEnum = pgEnum("rd_station_webhook_log_status", ["success", "failed", "duplicate"]);
export const scheduled_messages_statusEnum = pgEnum("scheduled_messages_status", ["pending", "sent", "failed", "cancelled"]);
export const share_statusEnum = pgEnum("share_status", ["active", "revoked"]);
export const planEnum = pgEnum("plan", ["free", "pro", "enterprise", "start", "growth", "scale"]);
export const subscriptions_statusEnum = pgEnum("subscriptions_status", ["active", "trialing", "past_due", "cancelled", "expired"]);
export const deadlineOffsetUnitEnum = pgEnum("deadlineOffsetUnit", ["minutes", "hours", "days"]);
export const deadlineReferenceEnum = pgEnum("deadlineReference", ["current_date", "appointment_date", "follow_up_date"]);
export const taskTypeEnum = pgEnum("taskType", ["whatsapp", "phone", "email", "video", "task"]);
export const team_members_roleEnum = pgEnum("team_members_role", ["member", "leader"]);
export const tenant_addons_statusEnum = pgEnum("tenant_addons_status", ["active", "cancelled", "expired"]);
export const zapi_instance_statusEnum = pgEnum("zapi_instance_status", ["active", "pending", "cancelled", "expired"]);
export const billingStatusEnum = pgEnum("billingStatus", ["active", "trialing", "past_due", "restricted", "cancelled", "expired"]);
export const tenants_statusEnum = pgEnum("tenants_status", ["active", "suspended", "cancelled"]);
export const service_delivery_items_typeEnum = pgEnum("trip_items_type", ["sessao", "consulta", "procedimento", "retorno", "avaliacao", "other"]);
export const documentsStatusEnum = pgEnum("documentsStatus", ["pending", "partial", "complete"]);
export const service_deliveries_statusEnum = pgEnum("trips_status", ["scheduled", "confirmed", "in_progress", "completed", "cancelled"]);
export const users_roleEnum = pgEnum("users_role", ["user", "admin"]);
export const channel_statusEnum = pgEnum("channel_status", ["active", "inactive"]);
export const wa_conversations_statusEnum = pgEnum("wa_conversations_status", ["open", "pending", "resolved", "closed"]);
export const webhooks_statusEnum = pgEnum("webhooks_status", ["active", "inactive"]);
export const whatsapp_sessions_providerEnum = pgEnum("whatsapp_sessions_provider", ["evolution", "zapi"]);
export const whatsapp_sessions_statusEnum = pgEnum("whatsapp_sessions_status", ["connecting", "connected", "disconnected", "deleted"]);
export const alert_severityEnum = pgEnum("alert_severity", ["critical", "warning", "info"]);
export const alert_typeEnum = pgEnum("alert_type", ["disconnected", "billing_overdue", "instance_error"]);
export const conversationEventsEventTypeEnum = pgEnum("conversation_events_eventType", ["created", "assigned", "transferred", "note", "resolved", "reopened", "queued", "sla_breach", "closed", "priority_changed"]);
export const dedupeMatchTypeEnum = pgEnum("dedupeMatchType", ["lead_id", "email", "phone", "email_and_phone", "manual_merge", "new_contact"]);
export const matchTypeEnum = pgEnum("matchType", ["lead_id", "email", "phone", "email_and_phone", "manual"]);
export const contact_merges_statusEnum = pgEnum("contact_merges_status", ["pending_review", "confirmed", "reverted"]);
export const addonTypeEnum = pgEnum("addon_type", ["whatsapp_number", "extra_user", "extra_storage_gb"]);


// ════════════════════════════════════════════════════════════
// EXISTING WHATSAPP API TABLES (preserved)
// ════════════════════════════════════════════════════════════

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: users_roleEnum("role").default("user").notNull(),
  isSuperAdmin: boolean("isSuperAdmin").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const whatsappSessions = pgTable("whatsapp_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull().unique(),
  userId: integer("userId").notNull(),
  tenantId: integer("tenantId").default(1).notNull(),
  status: whatsapp_sessions_statusEnum("status").default("disconnected").notNull(),
  phoneNumber: varchar("phoneNumber", { length: 32 }),
  pushName: varchar("pushName", { length: 128 }),
  platform: varchar("platform", { length: 64 }),
  /** WhatsApp API provider: 'zapi' (evolution kept for backward DB compatibility) */
  provider: whatsapp_sessions_providerEnum("provider").default("zapi").notNull(),
  /** Z-API instance ID (only for zapi provider) */
  providerInstanceId: varchar("providerInstanceId", { length: 128 }),
  /** Z-API token (only for zapi provider) */
  providerToken: text("providerToken"),
  /** Z-API client/security token (only for zapi provider) */
  providerClientToken: text("providerClientToken"),
  /** Prefixar nome do agente nas mensagens enviadas (porta entur-os-crm) */
  showAgentNamePrefix: boolean("showAgentNamePrefix").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("ws_tenant_idx").on(t.tenantId),
]);

export const waMessages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  tenantId: integer("tenantId").default(1).notNull(),
  messageId: varchar("messageId", { length: 256 }),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  fromMe: boolean("fromMe").default(false).notNull(),
  senderAgentId: integer("senderAgentId"),
  pushName: varchar("pushName", { length: 128 }),
  messageType: varchar("messageType", { length: 32 }).default("text").notNull(),
  content: text("content"),
  mediaUrl: text("mediaUrl"),
  mediaMimeType: varchar("media_mime_type", { length: 128 }),
  mediaFileName: varchar("media_file_name", { length: 512 }),
  mediaDuration: integer("media_duration"),
  isVoiceNote: boolean("is_voice_note").default(false),
  quotedMessageId: varchar("quoted_message_id", { length: 256 }),
  structuredData: json("structured_data"),
  status: varchar("status", { length: 32 }).default("sent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  waConversationId: integer("waConversationId"),
  audioTranscription: text("audio_transcription"),
  audioTranscriptionStatus: audio_transcription_statusEnum("audio_transcription_status"),
  audioTranscriptionLanguage: varchar("audio_transcription_language", { length: 16 }),
  audioTranscriptionDuration: integer("audio_transcription_duration"),
  /** Tentativas de download de mídia (porta entur-os-crm) */
  mediaDownloadAttempts: integer("media_download_attempts").default(0).notNull(),
  /** Quando a mídia foi marcada indisponível (cooldown 10min) */
  mediaUnavailableSince: timestamp("media_unavailable_since"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("msg_tenant_idx").on(t.tenantId),
  index("msg_session_jid_idx").on(t.sessionId, t.remoteJid, t.timestamp),
  index("idx_msg_wa_conv").on(t.waConversationId),
  uniqueIndex("idx_unique_msgid_session").on(t.messageId, t.sessionId),
]);

/**
 * Reactions on messages.
 * Each reaction is a separate row linked to the target message by targetMessageId (the WhatsApp messageId).
 * When a user sends a new reaction on the same message, the old one is replaced (upsert by senderJid + targetMessageId).
 * An empty emoji ("") means the reaction was removed.
 */
export const waReactions = pgTable("wa_reactions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  targetMessageId: varchar("targetMessageId", { length: 256 }).notNull(),
  senderJid: varchar("senderJid", { length: 128 }).notNull(),
  emoji: varchar("emoji", { length: 32 }).notNull(),
  fromMe: boolean("fromMe").default(false).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (t) => [
  index("idx_react_target").on(t.sessionId, t.targetMessageId),
  uniqueIndex("idx_react_unique").on(t.sessionId, t.targetMessageId, t.senderJid),
]);

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  description: text("description"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const chatbotSettings = pgTable("chatbot_settings", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull().unique(),
  enabled: boolean("enabled").default(false).notNull(),
  systemPrompt: text("systemPrompt"),
  maxTokens: integer("maxTokens").default(500),
  // Mode: 'all' = respond to everyone, 'whitelist' = only listed, 'blacklist' = everyone except listed
  mode: varchar("mode", { length: 32 }).default("all").notNull(),
  // Chat type filters
  respondGroups: boolean("respondGroups").default(true).notNull(),
  respondPrivate: boolean("respondPrivate").default(true).notNull(),
  onlyWhenMentioned: boolean("onlyWhenMentioned").default(false).notNull(),
  // Trigger words (comma-separated)
  triggerWords: text("triggerWords"),
  // Auto messages
  welcomeMessage: text("welcomeMessage"),
  awayMessage: text("awayMessage"),
  // Business hours
  businessHoursEnabled: boolean("businessHoursEnabled").default(false).notNull(),
  businessHoursStart: varchar("businessHoursStart", { length: 5 }).default("09:00"),
  businessHoursEnd: varchar("businessHoursEnd", { length: 5 }).default("18:00"),
  businessHoursDays: varchar("businessHoursDays", { length: 32 }).default("1,2,3,4,5"),
  businessHoursTimezone: varchar("businessHoursTimezone", { length: 64 }).default("America/Sao_Paulo"),
  // Behavior
  replyDelay: integer("replyDelay").default(0),
  contextMessageCount: integer("contextMessageCount").default(10),
  rateLimitPerHour: integer("rateLimitPerHour").default(0),
  rateLimitPerDay: integer("rateLimitPerDay").default(0),
  temperature: numeric("temperature", { precision: 3, scale: 2 }).default("0.70"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const chatbotRules = pgTable("chatbot_rules", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  ruleType: ruleTypeEnum("ruleType").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_session_type").on(t.sessionId, t.ruleType),
]);

// ════════════════════════════════════════════════════════════
// CONVERSATION ASSIGNMENTS (Multi-Agent / SaaS)
// ════════════════════════════════════════════════════════════

export const conversationAssignments = pgTable("conversation_assignments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  assignedUserId: integer("assignedUserId"),
  assignedTeamId: integer("assignedTeamId"),
  status: conversation_assignments_statusEnum("status").default("open").notNull(),
  priority: priorityEnum("priority").default("medium").notNull(),
  lastAssignedAt: timestamp("lastAssignedAt"),
  firstResponseAt: timestamp("firstResponseAt"),
  resolvedAt: timestamp("resolvedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("ca_tenant_session_jid_idx").on(t.tenantId, t.sessionId, t.remoteJid),
  index("ca_tenant_user_idx").on(t.tenantId, t.assignedUserId),
  index("ca_tenant_team_idx").on(t.tenantId, t.assignedTeamId),
  index("ca_tenant_status_idx").on(t.tenantId, t.status),
]);

// ════════════════════════════════════════════════════════════
// ASTRA CRM — CORE / TENANTS
// ════════════════════════════════════════════════════════════

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 128 }),
  plan: planEnum("plan").default("start").notNull(),
  status: tenants_statusEnum("status").default("active").notNull(),
  billingStatus: billingStatusEnum("billingStatus").default("active").notNull(),
  isLegacy: boolean("isLegacy").default(false).notNull(),
  ownerUserId: integer("ownerUserId"),
  billingCustomerId: varchar("billingCustomerId", { length: 128 }),
  hotmartEmail: varchar("hotmartEmail", { length: 320 }),
  freemiumDays: integer("freemiumDays").default(365).notNull(),
  freemiumExpiresAt: timestamp("freemiumExpiresAt"),
  logoUrl: text("logoUrl"),
  settingsJson: json("settingsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════
// M0 — IAM (Identity & Access Management)
// ════════════════════════════════════════════════════════════

export const crmUsers = pgTable("crm_users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  passwordHash: varchar("passwordHash", { length: 512 }),
  role: crm_user_roleEnum("crm_user_role").default("user").notNull(),
  status: crm_users_statusEnum("status").default("invited").notNull(),
  avatarUrl: text("avatarUrl"),
  isAvailable: boolean("isAvailable").default(true).notNull(),
  /** Helpdesk: capacidade do agente (load balancing) */
  availabilityStatus: varchar("availabilityStatus", { length: 16 }).default("auto").notNull(),
  maxConcurrentChats: integer("maxConcurrentChats"),
  lastLoginAt: timestamp("lastLoginAt"),
  lastActiveAt: timestamp("lastActiveAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdBy: integer("createdBy"),
  updatedBy: integer("updatedBy"),
}, (t) => [
  index("crm_users_tenant_idx").on(t.tenantId),
  index("crm_users_email_idx").on(t.tenantId, t.email),
]);

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#6366f1"),
  maxMembers: integer("maxMembers").default(50),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("teams_tenant_idx").on(t.tenantId)]);

export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  userId: integer("userId").notNull(),
  teamId: integer("teamId").notNull(),
  role: team_members_roleEnum("role").default("member").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("tm_tenant_idx").on(t.tenantId),
  index("tm_team_idx").on(t.teamId),
  index("tm_user_idx").on(t.userId),
]);

// ════════════════════════════════════════════════════════════
// DISTRIBUTION RULES (Auto-assignment strategies)
// ════════════════════════════════════════════════════════════

export const distributionRules = pgTable("distribution_rules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  strategy: strategyEnum("strategy").default("round_robin").notNull(),
  teamId: integer("teamId"),
  isActive: boolean("isActive").default(true).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  priority: integer("priority").default(0).notNull(),
  // Config JSON: { maxOpenPerAgent, businessHoursOnly, businessHoursStart, businessHoursEnd, businessHoursDays, businessHoursTimezone }
  configJson: json("configJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("dr_tenant_idx").on(t.tenantId),
  index("dr_tenant_active_idx").on(t.tenantId, t.isActive),
]);

export const roles = pgTable("crm_roles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  slug: varchar("slug", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  isSystemRole: boolean("isSystemRole").default(false).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("roles_tenant_idx").on(t.tenantId)]);

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  description: text("description"),
});

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  roleId: integer("roleId").notNull(),
  permissionId: integer("permissionId").notNull(),
}, (t) => [index("rp_tenant_idx").on(t.tenantId)]);

export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  userId: integer("userId").notNull(),
  roleId: integer("roleId").notNull(),
}, (t) => [index("ur_tenant_idx").on(t.tenantId)]);

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  hashedKey: varchar("hashedKey", { length: 512 }).notNull(),
  scopesJson: json("scopesJson"),
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("ak_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// M2 — CRM (Contacts, Deals, Pipelines)
// ════════════════════════════════════════════════════════════

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  type: contacts_typeEnum("type").default("person").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  phoneE164: varchar("phoneE164", { length: 32 }),
  phoneDigits: varchar("phoneDigits", { length: 32 }),
  phoneLast11: varchar("phoneLast11", { length: 16 }),
  docId: varchar("docId", { length: 64 }),
  tagsJson: json("tagsJson"),
  source: varchar("source", { length: 64 }),
  lifecycleStage: lifecycleStageEnum("lifecycleStage").default("lead").notNull(),
  /** If this contact was merged into another, points to the canonical contact */
  mergedIntoContactId: integer("mergedIntoContactId"),
  ownerUserId: integer("ownerUserId"),
  teamId: integer("teamId"),
  visibilityScope: visibilityScopeEnum("visibilityScope").default("global").notNull(),
  consentStatus: consentStatusEnum("consentStatus").default("pending").notNull(),
  notes: text("notes"),
  // Strategic classification (9 audiences)
  stageClassification: varchar("stageClassification", { length: 32 }).default("desconhecido").notNull(),
  // Referral window tracking
  referralWindowStart: timestamp("referralWindowStart"),
  referralCount: integer("referralCount").default(0).notNull(),
  // Purchase tracking
  lastPurchaseAt: timestamp("lastPurchaseAt"),
  totalPurchases: integer("totalPurchases").default(0).notNull(),
  totalSpentCents: bigint("totalSpentCents", { mode: "number" }).default(0).notNull(),
  // ASAAS customer linkage (per tenant)
  asaasCustomerId: varchar("asaasCustomerId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdBy: integer("createdBy"),
  updatedBy: integer("updatedBy"),
  // Date fields for birthday/wedding notifications
  birthDate: varchar("birthDate", { length: 10 }), // MM-DD format or YYYY-MM-DD
  weddingDate: varchar("weddingDate", { length: 10 }), // MM-DD format
  gender: varchar("gender", { length: 32 }),
  referredBy: varchar("referredBy", { length: 255 }),
  convenioNumero: varchar("convenioNumero", { length: 64 }),
  convenioNome: varchar("convenioNome", { length: 255 }),
  consultationNotes: json("consultationNotes").$type<{ previsao?: string; executado?: string; proximaPrevisao?: string }>(),
  /** Avatar/foto WA — refrescado por profilePicRefresher (porta entur-os-crm) */
  avatarUrl: text("avatarUrl"),
  /** LID WhatsApp do contato — fast-path resolver via índice */
  whatsappLid: varchar("whatsappLid", { length: 128 }),
  whatsappLidCheckedAt: timestamp("whatsappLidCheckedAt"),
  /** Origem do nome — controla prioridade de sobrescrita (ver identityResolver) */
  nameSource: varchar("nameSource", { length: 32 }),
  profilePicUpdatedAt: timestamp("profilePicUpdatedAt"),
  deletedAt: timestamp("deletedAt"),
}, (t) => [
  index("contacts_tenant_idx").on(t.tenantId),
  index("contacts_owner_idx").on(t.tenantId, t.ownerUserId),
  index("contacts_classification_idx").on(t.tenantId, t.stageClassification),
  index("idx_contacts_email").on(t.tenantId, t.email),
  index("idx_contacts_phone").on(t.tenantId, t.phoneE164),
  index("idx_contacts_phone_last11").on(t.tenantId, t.phoneLast11),
  index("idx_contacts_merged").on(t.mergedIntoContactId),
  index("contacts_whatsapp_lid_idx").on(t.tenantId, t.whatsappLid),
]);

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  primaryContactId: integer("primaryContactId"),
  ownerUserId: integer("ownerUserId"),
  teamId: integer("teamId"),
  visibilityScope: visibilityScopeEnum("visibilityScope").default("global").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdBy: integer("createdBy"),
  updatedBy: integer("updatedBy"),
}, (t) => [index("accounts_tenant_idx").on(t.tenantId)]);

export const pipelines = pgTable("pipelines", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 32 }),
  pipelineType: pipelineTypeEnum("pipelineType").default("sales").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  isArchived: boolean("isArchived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("pipelines_tenant_idx").on(t.tenantId)]);

export const pipelineAutomations = pgTable("pipeline_automations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sourcePipelineId: integer("sourcePipelineId").notNull(),
  triggerEvent: triggerEventEnum("triggerEvent").default("deal_won").notNull(),
  triggerStageId: integer("triggerStageId"),
  targetPipelineId: integer("targetPipelineId").notNull(),
  targetStageId: integer("targetStageId").notNull(),
  copyProducts: boolean("copyProducts").default(true).notNull(),
  copyParticipants: boolean("copyParticipants").default(true).notNull(),
  copyCustomFields: boolean("copyCustomFields").default(true).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("pa_tenant_idx").on(t.tenantId),
  index("pa_source_idx").on(t.tenantId, t.sourcePipelineId),
]);

export const pipelineStages = pgTable("pipeline_stages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  pipelineId: integer("pipelineId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  color: varchar("color", { length: 32 }),
  orderIndex: integer("orderIndex").notNull(),
  probabilityDefault: integer("probabilityDefault").default(0),
  isWon: boolean("isWon").default(false).notNull(),
  isLost: boolean("isLost").default(false).notNull(),
  coolingEnabled: boolean("coolingEnabled").default(false).notNull(),
  coolingDays: integer("coolingDays").default(3),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("ps_tenant_pipeline_idx").on(t.tenantId, t.pipelineId)]);

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  contactId: integer("contactId"),
  accountId: integer("accountId"),
  pipelineId: integer("pipelineId").notNull(),
  stageId: integer("stageId").notNull(),
  valueCents: bigint("valueCents", { mode: "number" }).default(0),
  currency: varchar("currency", { length: 3 }).default("BRL"),
  probability: integer("probability").default(0),
  status: deals_statusEnum("status").default("open").notNull(),
  expectedCloseAt: timestamp("expectedCloseAt"),
  ownerUserId: integer("ownerUserId"),
  teamId: integer("teamId"),
  visibilityScope: visibilityScopeEnum("visibilityScope").default("global").notNull(),
  channelOrigin: varchar("channelOrigin", { length: 64 }),
  leadSource: varchar("leadSource", { length: 64 }),
  utmSource: varchar("utmSource", { length: 255 }),
  utmMedium: varchar("utmMedium", { length: 255 }),
  utmCampaign: varchar("utmCampaign", { length: 255 }),
  utmTerm: varchar("utmTerm", { length: 255 }),
  utmContent: varchar("utmContent", { length: 255 }),
  utmJson: json("utmJson"),
  rdCustomFields: json("rdCustomFields").$type<Record<string, string>>(),
  metaJson: json("metaJson"),
  rawPayloadJson: json("rawPayloadJson"),
  dedupeKey: varchar("dedupeKey", { length: 255 }),
  lastActivityAt: timestamp("lastActivityAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdBy: integer("createdBy"),
  updatedBy: integer("updatedBy"),
  waConversationId: integer("waConversationId"),
  lossReasonId: integer("lossReasonId"),
  lossNotes: text("lossNotes"),
  appointmentDate: timestamp("appointmentDate"),
  followUpDate: timestamp("followUpDate"),
  deletedAt: timestamp("deletedAt"),
  /** Conversion tracking fields */
  lastConversionAt: timestamp("lastConversionAt"),
  lastConversionSource: varchar("lastConversionSource", { length: 64 }),
  lastWebhookName: varchar("lastWebhookName", { length: 255 }),
  lastUtmSource: varchar("lastUtmSource", { length: 255 }),
  lastUtmMedium: varchar("lastUtmMedium", { length: 255 }),
  lastUtmCampaign: varchar("lastUtmCampaign", { length: 255 }),
  conversionCount: integer("conversionCount").notNull().default(1),
  /** AI deal intelligence (port from entur-os-crm) */
  aiSummary: text("aiSummary"),
  aiSummaryUpdatedAt: timestamp("aiSummaryUpdatedAt"),
  aiLeadScore: varchar("aiLeadScore", { length: 16 }),
  aiLeadScoreReason: text("aiLeadScoreReason"),
  aiLeadScoreAt: timestamp("aiLeadScoreAt"),
  /** Asaas charge (cobrança gerada após o deal ser ganho) */
  asaasPaymentId: varchar("asaasPaymentId", { length: 64 }),
  asaasInvoiceUrl: text("asaasInvoiceUrl"),
  asaasBankSlipUrl: text("asaasBankSlipUrl"),
  asaasBillingType: varchar("asaasBillingType", { length: 32 }),
  asaasPaymentStatus: varchar("asaasPaymentStatus", { length: 32 }),
  asaasDueDate: timestamp("asaasDueDate"),
  asaasPaidAt: timestamp("asaasPaidAt"),
  asaasLinkSentToWhatsappAt: timestamp("asaasLinkSentToWhatsappAt"),
}, (t) => [
  index("deals_tenant_pipeline_idx").on(t.tenantId, t.pipelineId, t.stageId),
  index("deals_tenant_status_idx").on(t.tenantId, t.status, t.lastActivityAt),
  index("deals_tenant_owner_idx").on(t.tenantId, t.ownerUserId),
  index("idx_deals_wa_conv").on(t.waConversationId),
  index("deals_tenant_contact_status_idx").on(t.tenantId, t.contactId, t.status),
  index("deals_tenant_contact_pipeline_idx").on(t.tenantId, t.contactId, t.pipelineId, t.status),
  index("deals_asaas_payment_idx").on(t.asaasPaymentId),
]);

// ═══════════════════════════════════════
// TASK AUTOMATIONS — Regras de criação automática de tarefas por etapa
// ═══════════════════════════════════════
export const taskAutomations = pgTable("task_automations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  pipelineId: integer("pipelineId").notNull(),
  stageId: integer("stageId").notNull(),
  taskTitle: varchar("taskTitle", { length: 255 }).notNull(),
  taskDescription: text("taskDescription"),
  taskType: taskTypeEnum("taskType").default("task").notNull(),
  // Referência de prazo: "current_date", "boarding_date", "return_date"
  deadlineReference: deadlineReferenceEnum("deadlineReference").default("current_date").notNull(),
  // Offset: positivo = depois, negativo = antes
  deadlineOffsetDays: integer("deadlineOffsetDays").default(0).notNull(),
  // Unidade do offset: minutes, hours, days
  deadlineOffsetUnit: deadlineOffsetUnitEnum("deadlineOffsetUnit").default("days").notNull(),
  // Hora do dia para a tarefa (ex: "09:00")
  deadlineTime: varchar("deadlineTime", { length: 5 }).default("09:00").notNull(),
  // Atribuir a quem? null = dono do deal
  assignToOwner: boolean("assignToOwner").default(true).notNull(),
  assignToUserIds: json("assignToUserIds").$type<number[]>(),
  // Template de mensagem WhatsApp (usado quando taskType = "whatsapp")
  waMessageTemplate: text("waMessageTemplate"),
  isActive: boolean("isActive").default(true).notNull(),
  orderIndex: integer("orderIndex").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("task_auto_tenant_pipeline_idx").on(t.tenantId, t.pipelineId),
  index("task_auto_tenant_stage_idx").on(t.tenantId, t.stageId),
]);

// ═══════════════════════════════════════
// STAGE OWNER RULES (Mudar responsável ao mover etapa)
// ═══════════════════════════════════════
export const stageOwnerRules = pgTable("stage_owner_rules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  pipelineId: integer("pipelineId").notNull(),
  stageId: integer("stageId").notNull(),
  assignToUserId: integer("assignToUserId").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("sor_tenant_pipeline_idx").on(t.tenantId, t.pipelineId),
  index("sor_tenant_stage_idx").on(t.tenantId, t.stageId),
]);

export const dealParticipants = pgTable("deal_participants", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  dealId: integer("dealId").notNull(),
  contactId: integer("contactId").notNull(),
  role: deal_participants_roleEnum("role").default("traveler").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("dp_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// PRODUCT CATALOG (Catálogo de Produtos Turísticos)
// ════════════════════════════════════════════════════════════

export const productCategories = pgTable("product_categories", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  icon: varchar("icon", { length: 64 }),
  color: varchar("color", { length: 32 }),
  parentId: integer("parentId"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("pc_tenant_idx").on(t.tenantId),
]);

export const productCatalog = pgTable("product_catalog", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  categoryId: integer("categoryId"),
  productType: productTypeEnum("productType").default("other").notNull(),
  basePriceCents: bigint("basePriceCents", { mode: "number" }).default(0).notNull(),
  costPriceCents: bigint("costPriceCents", { mode: "number" }).default(0),
  currency: varchar("currency", { length: 3 }).default("BRL"),
  supplier: varchar("supplier", { length: 255 }),
  location: varchar("location", { length: 255 }),
  durationMinutes: integer("durationMinutes"),
  imageUrl: text("imageUrl"),
  sku: varchar("sku", { length: 64 }),
  isActive: boolean("isActive").default(true).notNull(),
  isRecurring: boolean("isRecurring").default(false).notNull(),
  recurringIntervalDays: integer("recurringIntervalDays"),
  sessionsIncluded: integer("sessionsIncluded"),
  detailsJson: json("detailsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("pcat_tenant_idx").on(t.tenantId),
  index("pcat_tenant_type_idx").on(t.tenantId, t.productType),
  index("pcat_tenant_cat_idx").on(t.tenantId, t.categoryId),
  index("pcat_tenant_active_idx").on(t.tenantId, t.isActive),
]);

// ════════════════════════════════════════════════════════════
// DEAL ITEMS (Itens da Negociação — referência ao Catálogo)
// ════════════════════════════════════════════════════════════

export const dealProducts = pgTable("deal_products", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  dealId: integer("dealId").notNull(),
  productId: integer("productId").notNull(),               // FK obrigatória → product_catalog.id
  name: varchar("name", { length: 255 }).notNull(),     // snapshot do nome no momento da adição
  description: text("description"),                      // snapshot da descrição
  category: categoryEnum("category").default("other").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  unitPriceCents: bigint("unitPriceCents", { mode: "number" }).default(0).notNull(),  // snapshot do preço base
  discountCents: bigint("discountCents", { mode: "number" }).default(0),
  finalPriceCents: bigint("finalPriceCents", { mode: "number" }).default(0),          // (qty * unit) - discount
  currency: varchar("currency", { length: 3 }).default("BRL"),
  supplier: varchar("supplier", { length: 255 }),
  serviceStart: timestamp("serviceStart"),
  serviceEnd: timestamp("serviceEnd"),
  catalogProductId: integer("catalogProductId"),              // mantido para compatibilidade (deprecated)
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("dp_prod_tenant_deal_idx").on(t.tenantId, t.dealId),
  index("dp_prod_product_idx").on(t.productId),
  index("dp_prod_catalog_idx").on(t.catalogProductId),
]);

// ════════════════════════════════════════════════════════════
// DEAL HISTORY (Histórico de Movimentações)
// ════════════════════════════════════════════════════════════

export const dealHistory = pgTable("deal_history", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  dealId: integer("dealId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  description: text("description").notNull(),
  fromStageId: integer("fromStageId"),
  toStageId: integer("toStageId"),
  fromStageName: varchar("fromStageName", { length: 128 }),
  toStageName: varchar("toStageName", { length: 128 }),
  fieldChanged: varchar("fieldChanged", { length: 64 }),
  oldValue: text("oldValue"),
  newValue: text("newValue"),
  actorUserId: integer("actorUserId"),
  actorName: varchar("actorName", { length: 255 }),
  metadataJson: json("metadataJson"),
  /** Timeline category for filtering (conversion, whatsapp, task, funnel, proposal, product, note, assignment, automation, audit, imported_data) */
  eventCategory: varchar("eventCategory", { length: 32 }),
  /** Source of the event (user, system, webhook, automation, rd_station, whatsapp, api) */
  eventSource: varchar("eventSource", { length: 32 }),
  /** Optional contact reference for contact-scoped timeline */
  contactId: integer("contactId"),
  /** Idempotency key to prevent duplicate events */
  dedupeKey: varchar("dedupeKey", { length: 255 }),
  /** Timestamp of when the event actually occurred (may differ from createdAt for imported events) */
  occurredAt: timestamp("occurredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("dh_tenant_deal_idx").on(t.tenantId, t.dealId),
  index("dh_tenant_deal_cat_idx").on(t.tenantId, t.dealId, t.eventCategory),
  index("dh_tenant_contact_idx").on(t.tenantId, t.contactId),
  index("dh_dedupe_idx").on(t.dedupeKey),
  index("dh_occurred_idx").on(t.tenantId, t.dealId, t.occurredAt),
]);

// ════════════════════════════════════════════════════════════
// SERVICE DELIVERIES (Pos-venda: entrega de servico)
// ════════════════════════════════════════════════════════════

export const serviceDeliveries = pgTable("service_deliveries", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  dealId: integer("dealId"),
  status: service_deliveries_statusEnum("status").default("scheduled").notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  serviceSummary: text("serviceSummary"),
  totalValueCents: bigint("totalValueCents", { mode: "number" }).default(0),
  currency: varchar("currency", { length: 3 }).default("BRL"),
  progressStatus: documentsStatusEnum("documentsStatus").default("pending").notNull(),
  ownerUserId: integer("ownerUserId"),
  teamId: integer("teamId"),
  visibilityScope: visibilityScopeEnum("visibilityScope").default("global").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdBy: integer("createdBy"),
  updatedBy: integer("updatedBy"),
}, (t) => [index("sd_tenant_idx").on(t.tenantId)]);

export const serviceDeliveryItems = pgTable("service_delivery_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  serviceDeliveryId: integer("serviceDeliveryId").notNull(),
  type: service_delivery_items_typeEnum("type").default("other").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  professional: varchar("professional", { length: 255 }),
  detailsJson: json("detailsJson"),
  priceCents: bigint("priceCents", { mode: "number" }).default(0),
  currency: varchar("currency", { length: 3 }).default("BRL"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("sdi_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// ACTIVITIES (Tasks, Notes, Attachments)
// ════════════════════════════════════════════════════════════

export const tasks = pgTable("crm_tasks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  entityType: varchar("entityType", { length: 32 }).notNull(),
  entityId: integer("entityId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  taskType: varchar("taskType", { length: 32 }).default("task"),
  dueAt: timestamp("dueAt"),
  status: crm_tasks_statusEnum("status").default("pending").notNull(),
  priority: priorityEnum("priority").default("medium").notNull(),
  assignedToUserId: integer("assignedToUserId"),
  createdByUserId: integer("createdByUserId"),
  description: text("description"),
  googleEventId: varchar("googleEventId", { length: 512 }),
  googleCalendarSynced: boolean("googleCalendarSynced").default(false),
  // ── WhatsApp Scheduled Send fields ──
  waMessageBody: text("waMessageBody"),
  waScheduledAt: timestamp("waScheduledAt"),
  waTimezone: varchar("waTimezone", { length: 64 }),
  waStatus: varchar("waStatus", { length: 32 }), // draft, scheduled, processing, sent, failed, cancelled
  waSentAt: timestamp("waSentAt"),
  waFailedAt: timestamp("waFailedAt"),
  waFailureReason: text("waFailureReason"),
  waMessageId: varchar("waMessageId", { length: 256 }),
  waConversationId: integer("waConversationId"),
  waChannelId: integer("waChannelId"),
  waContactId: integer("waContactId"),
  waRetryCount: integer("waRetryCount").default(0),
  waProcessingLockId: varchar("waProcessingLockId", { length: 64 }),
  waProcessingLockedAt: timestamp("waProcessingLockedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("tasks_tenant_idx").on(t.tenantId), index("tasks_wa_scheduled_idx").on(t.taskType, t.waStatus, t.waScheduledAt)]);

export const taskAssignees = pgTable("task_assignees", {
  id: serial("id").primaryKey(),
  taskId: integer("taskId").notNull(),
  userId: integer("userId").notNull(),
  tenantId: integer("tenantId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("ta_task_idx").on(t.taskId), index("ta_user_idx").on(t.userId)]);

export const crmNotes = pgTable("crm_notes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  entityType: varchar("entityType", { length: 32 }).notNull(),
  entityId: integer("entityId").notNull(),
  body: text("body"),
  createdByUserId: integer("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("notes_tenant_idx").on(t.tenantId)]);

export const crmAttachments = pgTable("crm_attachments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  entityType: varchar("entityType", { length: 32 }).notNull(),
  entityId: integer("entityId").notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  sizeBytes: integer("sizeBytes"),
  uploadedByUserId: integer("uploadedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("attach_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// M1 — INBOX OMNICHANNEL
// ════════════════════════════════════════════════════════════

export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  type: channels_typeEnum("type").default("whatsapp").notNull(),
  connectionId: varchar("connectionId", { length: 128 }),
  name: varchar("name", { length: 128 }),
  status: channels_statusEnum("status").default("inactive").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("channels_tenant_idx").on(t.tenantId)]);

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  channelId: integer("channelId").notNull(),
  providerThreadId: varchar("providerThreadId", { length: 256 }),
  contactId: integer("contactId"),
  dealId: integer("dealId"),
  tripId: integer("tripId"),
  status: conversations_statusEnum("status").default("open").notNull(),
  assignedToUserId: integer("assignedToUserId"),
  assignedTeamId: integer("assignedTeamId"),
  priority: priorityEnum("priority").default("medium").notNull(),
  lastMessageAt: timestamp("lastMessageAt"),
  slaDueAt: timestamp("slaDueAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("conv_tenant_channel_idx").on(t.tenantId, t.channelId, t.lastMessageAt),
  index("conv_tenant_status_idx").on(t.tenantId, t.status),
]);

export const inboxMessages = pgTable("inbox_messages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  conversationId: integer("conversationId").notNull(),
  direction: directionEnum("direction").default("inbound").notNull(),
  providerMessageId: varchar("providerMessageId", { length: 256 }),
  senderLabel: varchar("senderLabel", { length: 128 }),
  bodyText: text("bodyText"),
  bodyJson: json("bodyJson"),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  readAt: timestamp("readAt"),
  status: inbox_messages_statusEnum("status").default("pending").notNull(),
  errorJson: json("errorJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("im_tenant_conv_idx").on(t.tenantId, t.conversationId, t.sentAt)]);

// ════════════════════════════════════════════════════════════
// M3 — PROPOSTAS
// ════════════════════════════════════════════════════════════

export const proposalTemplates = pgTable("proposal_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  htmlBody: text("htmlBody"),
  variablesJson: json("variablesJson"),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("pt_tenant_idx").on(t.tenantId)]);

export const proposals = pgTable("proposals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  dealId: integer("dealId").notNull(),
  version: integer("version").default(1).notNull(),
  status: proposals_statusEnum("status").default("draft").notNull(),
  totalCents: bigint("totalCents", { mode: "number" }).default(0),
  /** Soma dos itens (qty * unitPriceCents - itemDiscount). */
  subtotalCents: bigint("subtotalCents", { mode: "number" }).default(0),
  /** Desconto adicional aplicado sobre o subtotal. */
  discountCents: bigint("discountCents", { mode: "number" }).default(0),
  /** Tributos / taxa adicional. */
  taxCents: bigint("taxCents", { mode: "number" }).default(0),
  currency: varchar("currency", { length: 3 }).default("BRL"),
  pdfUrl: text("pdfUrl"),
  /** Token público p/ exibição em /p/:token (cliente sem login). */
  publicToken: varchar("publicToken", { length: 48 }),
  /** Snapshot dos dados do cliente no momento do envio. */
  clientSnapshotJson: json("clientSnapshotJson"),
  /** Notas livres / observações públicas (aparecem na proposta). */
  notes: text("notes"),
  /** Validade da proposta. */
  validUntil: timestamp("validUntil"),
  /** Template (futuro: layouts diferentes). */
  templateId: integer("templateId"),
  sentAt: timestamp("sentAt"),
  acceptedAt: timestamp("acceptedAt"),
  acceptedClientName: varchar("acceptedClientName", { length: 255 }),
  acceptedClientEmail: varchar("acceptedClientEmail", { length: 320 }),
  acceptedClientIp: varchar("acceptedClientIp", { length: 64 }),
  // ASAAS payment linkage
  asaasPaymentId: varchar("asaasPaymentId", { length: 64 }),
  asaasInvoiceUrl: text("asaasInvoiceUrl"),
  asaasBankSlipUrl: text("asaasBankSlipUrl"),
  asaasBillingType: varchar("asaasBillingType", { length: 32 }),
  asaasPaymentStatus: varchar("asaasPaymentStatus", { length: 32 }),
  asaasDueDate: timestamp("asaasDueDate"),
  asaasPaidAt: timestamp("asaasPaidAt"),
  // WhatsApp notification idempotency timestamps
  whatsappFollowupAt: timestamp("whatsappFollowupAt"),
  whatsappPaidNotifiedAt: timestamp("whatsappPaidNotifiedAt"),
  whatsappOverdueNotifiedAt: timestamp("whatsappOverdueNotifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdBy: integer("createdBy"),
}, (t) => [
  index("proposals_tenant_idx").on(t.tenantId),
  index("proposals_asaas_payment_idx").on(t.asaasPaymentId),
  uniqueIndex("proposals_public_token_idx").on(t.publicToken),
]);

// ASAAS webhook event audit + idempotency
export const asaasWebhookEvents = pgTable("asaas_webhook_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  eventId: varchar("eventId", { length: 128 }).notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  paymentId: varchar("paymentId", { length: 64 }),
  rawPayload: json("rawPayload"),
  processedAt: timestamp("processedAt"),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("asaas_evt_eventid_idx").on(t.eventId), index("asaas_evt_payment_idx").on(t.paymentId)]);

export const proposalItems = pgTable("proposal_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  proposalId: integer("proposalId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  qty: integer("qty").default(1).notNull(),
  unit: varchar("unit", { length: 16 }), // "un", "h", "sessão", "kg" — exibido na coluna Unidade
  unitPriceCents: bigint("unitPriceCents", { mode: "number" }).default(0),
  discountCents: bigint("discountCents", { mode: "number" }).default(0),
  totalCents: bigint("totalCents", { mode: "number" }).default(0),
  /** FK opcional para product_catalog quando importado. */
  productId: integer("productId"),
  /** Ordenação manual (drag-drop). */
  orderIndex: integer("orderIndex").default(0).notNull(),
  metaJson: json("metaJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("pi_tenant_idx").on(t.tenantId),
  index("pi_proposal_order_idx").on(t.proposalId, t.orderIndex),
]);

export const proposalSignatures = pgTable("proposal_signatures", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  proposalId: integer("proposalId").notNull(),
  signerName: varchar("signerName", { length: 255 }).notNull(),
  signerEmail: varchar("signerEmail", { length: 320 }),
  signatureDataUrl: text("signatureDataUrl"), // PNG base64 da assinatura desenhada
  signedAt: timestamp("signedAt"),
  ip: varchar("ip", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("psig_tenant_idx").on(t.tenantId), index("psig_proposal_idx").on(t.proposalId)]);

// ════════════════════════════════════════════════════════════
// M4 — PORTAL DO CLIENTE
// ════════════════════════════════════════════════════════════

export const portalUsers = pgTable("portal_users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  contactId: integer("contactId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  authMethod: varchar("authMethod", { length: 32 }).default("magic_link"),
  passwordHash: varchar("passwordHash", { length: 512 }),
  status: portal_users_statusEnum("status").default("active").notNull(),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("pu_tenant_idx").on(t.tenantId)]);

export const portalSessions = pgTable("portal_sessions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  portalUserId: integer("portalUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
}, (t) => [index("ps_tenant_idx").on(t.tenantId)]);

export const portalTickets = pgTable("portal_tickets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  contactId: integer("contactId").notNull(),
  tripId: integer("tripId"),
  conversationId: integer("conversationId"),
  status: portal_tickets_statusEnum("status").default("open").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  priority: priorityEnum("priority").default("medium").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("ptk_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// M5 — GESTÃO
// ════════════════════════════════════════════════════════════

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }),
  scope: scopeEnum("scope").default("user").notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  teamId: integer("teamId"),
  userId: integer("userId"),
  companyId: integer("companyId"),
  metricKey: varchar("metricKey", { length: 64 }).notNull(),
  targetValue: bigint("targetValue", { mode: "number" }).default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("goals_tenant_idx").on(t.tenantId)]);

export const performanceSnapshots = pgTable("performance_snapshots", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  entityType: varchar("entityType", { length: 32 }).notNull(),
  entityId: integer("entityId").notNull(),
  metricsJson: json("metricsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("perf_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// M6 — INSIGHTS / ANALYTICS
// ════════════════════════════════════════════════════════════

export const metricsDaily = pgTable("metrics_daily", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  date: timestamp("date").notNull(),
  metricKey: varchar("metricKey", { length: 64 }).notNull(),
  valueNum: bigint("valueNum", { mode: "number" }).default(0),
  dimensionsJson: json("dimensionsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("md_tenant_idx").on(t.tenantId)]);

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  status: alerts_statusEnum("status").default("active").notNull(),
  entityType: varchar("entityType", { length: 32 }),
  entityId: integer("entityId"),
  firedAt: timestamp("firedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
  payloadJson: json("payloadJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("alerts_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// M7 — ACADEMY
// ════════════════════════════════════════════════════════════

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  coverUrl: text("coverUrl"),
  status: courses_statusEnum("status").default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("courses_tenant_idx").on(t.tenantId)]);

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  courseId: integer("courseId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  contentUrl: text("contentUrl"),
  contentBody: text("contentBody"),
  orderIndex: integer("orderIndex").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("lessons_tenant_idx").on(t.tenantId)]);

export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  userId: integer("userId").notNull(),
  courseId: integer("courseId").notNull(),
  status: enrollments_statusEnum("status").default("enrolled").notNull(),
  progressJson: json("progressJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("enroll_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// M8 — INTEGRATION HUB
// ════════════════════════════════════════════════════════════

export const integrations = pgTable("integrations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  status: integrations_statusEnum("status").default("inactive").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("integ_tenant_idx").on(t.tenantId)]);

export const integrationConnections = pgTable("integration_connections", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  integrationId: integer("integrationId").notNull(),
  connectionId: varchar("connectionId", { length: 128 }),
  status: integration_connections_statusEnum("status").default("disconnected").notNull(),
  lastHealthAt: timestamp("lastHealthAt"),
  metaJson: json("metaJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("ic_tenant_idx").on(t.tenantId)]);

export const integrationCredentials = pgTable("integration_credentials", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  encryptedSecret: text("encryptedSecret").notNull(),
  rotatedAt: timestamp("rotatedAt"),
  status: integration_credentials_statusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("icred_tenant_idx").on(t.tenantId)]);

export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  endpoint: text("endpoint").notNull(),
  secretHash: varchar("secretHash", { length: 512 }),
  status: webhooks_statusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("wh_tenant_idx").on(t.tenantId)]);

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  status: jobs_statusEnum("status").default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  nextRunAt: timestamp("nextRunAt"),
  payloadJson: json("payloadJson"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("jobs_tenant_idx").on(t.tenantId)]);

export const jobDlq = pgTable("job_dlq", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  jobId: integer("jobId").notNull(),
  failedAt: timestamp("failedAt").defaultNow().notNull(),
  errorJson: json("errorJson"),
  payloadJson: json("payloadJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("dlq_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// EVENT LOG (Transversal — Auditoria)
// ════════════════════════════════════════════════════════════

export const eventLog = pgTable("event_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  actorUserId: integer("actorUserId"),
  actorType: actorTypeEnum("actorType").default("user").notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: integer("entityId"),
  action: varchar("action", { length: 64 }).notNull(),
  beforeJson: json("beforeJson"),
  afterJson: json("afterJson"),
  metadataJson: json("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("el_tenant_idx").on(t.tenantId, t.occurredAt),
  index("el_entity_idx").on(t.tenantId, t.entityType, t.entityId),
]);

// ════════════════════════════════════════════════════════════
// CUSTOM FIELDS (Campos Personalizados por Tenant)
// ════════════════════════════════════════════════════════════

export const customFields = pgTable("custom_fields", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  entity: entityEnum("entity").default("contact").notNull(),
  name: varchar("name", { length: 128 }).notNull(), // slug/key
  label: varchar("label", { length: 255 }).notNull(), // display label
  fieldType: fieldTypeEnum("fieldType").default("text").notNull(),
  optionsJson: json("optionsJson"), // for select/multiselect: ["opt1","opt2",...]
  defaultValue: text("defaultValue"),
  placeholder: varchar("placeholder", { length: 255 }),
  isRequired: boolean("isRequired").default(false).notNull(),
  isVisibleOnForm: boolean("isVisibleOnForm").default(true).notNull(),
  isVisibleOnProfile: boolean("isVisibleOnProfile").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  groupName: varchar("groupName", { length: 128 }), // optional grouping
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("cf_tenant_entity_idx").on(t.tenantId, t.entity),
  index("cf_tenant_sort_idx").on(t.tenantId, t.entity, t.sortOrder),
]);

export const customFieldValues = pgTable("custom_field_values", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  fieldId: integer("fieldId").notNull(),
  entityType: entityTypeEnum("entityType").default("contact").notNull(),
  entityId: integer("entityId").notNull(),
  value: text("value"), // stored as string, parsed by fieldType
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("cfv_tenant_entity_idx").on(t.tenantId, t.entityType, t.entityId),
  index("cfv_field_idx").on(t.fieldId),
]);

// ════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ════════════════════════════════════════════════════════════

export type DealProduct = typeof dealProducts.$inferSelect;
export type InsertDealProduct = typeof dealProducts.$inferInsert;
export type DealHistoryEntry = typeof dealHistory.$inferSelect;
export type InsertDealHistory = typeof dealHistory.$inferInsert;

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type WhatsappSession = typeof whatsappSessions.$inferSelect;
export type WaMessage = typeof waMessages.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type ChatbotSettings = typeof chatbotSettings.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type CrmUser = typeof crmUsers.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type DistributionRule = typeof distributionRules.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Pipeline = typeof pipelines.$inferSelect;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type PipelineAutomation = typeof pipelineAutomations.$inferSelect;
export type ServiceDelivery = typeof serviceDeliveries.$inferSelect;
export type ServiceDeliveryItem = typeof serviceDeliveryItems.$inferSelect;
// Backwards compat aliases
export const trips = serviceDeliveries;
export const tripItems = serviceDeliveryItems;
export type Trip = ServiceDelivery;
export type TripItem = ServiceDeliveryItem;
export type Task = typeof tasks.$inferSelect;
export type TaskAssignee = typeof taskAssignees.$inferSelect;
export type CrmNote = typeof crmNotes.$inferSelect;
export type CrmAttachment = typeof crmAttachments.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type InboxMessage = typeof inboxMessages.$inferSelect;
export type ProposalTemplate = typeof proposalTemplates.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type ProposalItem = typeof proposalItems.$inferSelect;
export type PortalUser = typeof portalUsers.$inferSelect;
export type PortalTicket = typeof portalTickets.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type MetricDaily = typeof metricsDaily.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type IntegrationConnection = typeof integrationConnections.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type EventLogEntry = typeof eventLog.$inferSelect;

// ════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  type: varchar("type", { length: 64 }).notNull(), // whatsapp_message, deal_moved, task_due, contact_created, deal_created
  title: varchar("title", { length: 500 }).notNull(),
  body: text("body"),
  entityType: varchar("entityType", { length: 64 }), // deal, contact, task, message
  entityId: varchar("entityId", { length: 128 }), // ID or JID
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("notif_tenant_idx").on(t.tenantId),
  index("notif_tenant_read_idx").on(t.tenantId, t.isRead),
]);

export type Notification = typeof notifications.$inferSelect;
export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = typeof productCategories.$inferInsert;
export type ProductCatalogItem = typeof productCatalog.$inferSelect;
export type InsertProductCatalogItem = typeof productCatalog.$inferInsert;
export type CustomField = typeof customFields.$inferSelect;
export type InsertCustomField = typeof customFields.$inferInsert;
export type CustomFieldValue = typeof customFieldValues.$inferSelect;
export type InsertCustomFieldValue = typeof customFieldValues.$inferInsert;


// ════════════════════════════════════════════════════════════
// AI CONVERSATION ANALYSIS
// ════════════════════════════════════════════════════════════

export const aiConversationAnalyses = pgTable("ai_conversation_analyses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  dealId: integer("dealId").notNull(),
  contactId: integer("contactId"),
  analyzedBy: integer("analyzedBy"), // userId who triggered analysis
  overallScore: integer("overallScore"), // 0-100
  toneScore: integer("toneScore"), // 0-100
  responsivenessScore: integer("responsivenessScore"), // 0-100
  clarityScore: integer("clarityScore"), // 0-100
  closingScore: integer("closingScore"), // 0-100
  summary: text("summary"),
  strengths: json("strengths"), // string[]
  improvements: json("improvements"), // string[]
  suggestions: json("suggestions"), // string[]
  missedOpportunities: json("missedOpportunities"), // string[]
  responseTimeAvg: varchar("responseTimeAvg", { length: 64 }), // e.g. "15 min"
  messagesAnalyzed: integer("messagesAnalyzed").default(0),
  rawAnalysis: text("rawAnalysis"), // full LLM response for debugging
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("ai_analysis_tenant_idx").on(t.tenantId),
  index("ai_analysis_deal_idx").on(t.tenantId, t.dealId),
]);
export type AiConversationAnalysis = typeof aiConversationAnalyses.$inferSelect;
export type InsertAiConversationAnalysis = typeof aiConversationAnalyses.$inferInsert;


// ════════════════════════════════════════════════════════════
// CONVERSATION IDENTITY RESOLVER
// ════════════════════════════════════════════════════════════

export const waConversations = pgTable("wa_conversations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().default(1),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  contactId: integer("contactId"),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  conversationKey: varchar("conversationKey", { length: 256 }).notNull(),
  phoneE164: varchar("phoneE164", { length: 32 }),
  phoneDigits: varchar("phoneDigits", { length: 32 }),
  phoneLast11: varchar("phoneLast11", { length: 16 }),
  lastMessageAt: timestamp("lastMessageAt"),
  lastMessagePreview: text("lastMessagePreview"),
  lastMessageType: varchar("lastMessageType", { length: 32 }),
  lastFromMe: boolean("lastFromMe").default(false),
  lastStatus: varchar("lastStatus", { length: 32 }),
  unreadCount: integer("unreadCount").default(0),
  status: wa_conversations_statusEnum("status").default("open").notNull(),
  contactPushName: varchar("contactPushName", { length: 128 }),
  mergedIntoId: integer("mergedIntoId"),
  // Helpdesk fields (denormalized from conversation_assignments)
  assignedUserId: integer("assignedUserId"),
  assignedTeamId: integer("assignedTeamId"),
  queuedAt: timestamp("queuedAt"),
  firstResponseAt: timestamp("firstResponseAt"),
  slaDeadlineAt: timestamp("slaDeadlineAt"),
  /** SLA breach tracking (porta entur-os-crm) */
  slaBreachedAt: timestamp("slaBreachedAt"),
  /** LID cross-reference (porta entur-os-crm) */
  chatLid: varchar("chatLid", { length: 128 }),
  waChannelId: integer("waChannelId"), // Part 2: links to wa_channels for channel-based identity
  isPinned: boolean("isPinned").default(false).notNull(),
  isArchived: boolean("isArchived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_wc_tenant_session").on(t.tenantId, t.sessionId, t.lastMessageAt),
  index("idx_wc_tenant_contact").on(t.tenantId, t.contactId),
  index("idx_wc_tenant_jid").on(t.tenantId, t.sessionId, t.remoteJid),
  index("idx_wc_phone").on(t.tenantId, t.phoneE164),
  index("idx_wc_merged").on(t.mergedIntoId),
  index("idx_wc_assigned_user").on(t.tenantId, t.assignedUserId),
  index("idx_wc_queued").on(t.tenantId, t.queuedAt),
  uniqueIndex("idx_wc_conv_key").on(t.conversationKey),
]);

export const waIdentities = pgTable("wa_identities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().default(1),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  contactId: integer("contactId"),
  remoteJid: varchar("remoteJid", { length: 128 }),
  waId: varchar("waId", { length: 128 }),
  phoneE164: varchar("phoneE164", { length: 32 }),
  confidenceScore: integer("confidenceScore").default(60),
  firstSeenAt: timestamp("firstSeenAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
}, (t) => [
  index("idx_wi_tenant_session").on(t.tenantId, t.sessionId),
  index("idx_wi_contact").on(t.tenantId, t.contactId),
  index("idx_wi_phone").on(t.tenantId, t.phoneE164),
]);

export const waAuditLog = pgTable("wa_audit_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().default(1),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: varchar("entityId", { length: 128 }),
  inputsJson: json("inputsJson"),
  outputsJson: json("outputsJson"),
  correlationId: varchar("correlationId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_wal_tenant_action").on(t.tenantId, t.action, t.createdAt),
  index("idx_wal_correlation").on(t.correlationId),
]);

export type WaConversation = typeof waConversations.$inferSelect;
export type InsertWaConversation = typeof waConversations.$inferInsert;
export type WaIdentity = typeof waIdentities.$inferSelect;
export type InsertWaIdentity = typeof waIdentities.$inferInsert;
export type WaAuditLogEntry = typeof waAuditLog.$inferSelect;


// ════════════════════════════════════════════════════════════
// LEAD CAPTURE & INTEGRATIONS
// ════════════════════════════════════════════════════════════

export const leadEventLog = pgTable("lead_event_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().default(1),
  type: varchar("type", { length: 64 }).notNull().default("inbound_lead"),
  source: varchar("source", { length: 64 }).notNull(),
  dedupeKey: varchar("dedupeKey", { length: 255 }).notNull(),
  payload: json("payload"),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  error: text("error"),
  dealId: integer("dealId"),
  contactId: integer("contactId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_lel_tenant_source").on(t.tenantId, t.source, t.createdAt),
  index("idx_lel_tenant_status").on(t.tenantId, t.status, t.createdAt),
]);

export const metaIntegrationConfig = pgTable("meta_integration_config", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().default(1),
  pageId: varchar("pageId", { length: 128 }),
  pageName: varchar("pageName", { length: 255 }),
  accessToken: text("accessToken"),
  appSecret: varchar("appSecret", { length: 255 }),
  verifyToken: varchar("verifyToken", { length: 128 }),
  formsJson: json("formsJson"),
  status: varchar("status", { length: 32 }).notNull().default("disconnected"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const webhookConfig = pgTable("webhook_config", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().default(1),
  webhookSecret: varchar("webhookSecret", { length: 128 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Tracking Script Tokens ─────────────────────────────

export const trackingTokens = pgTable("tracking_tokens", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().default(1),
  token: varchar("token", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull().default("Meu Site"),
  allowedDomains: json("allowedDomains"), // string[] — empty = allow all
  isActive: boolean("isActive").default(true).notNull(),
  lastSeenAt: timestamp("lastSeenAt"),
  totalLeads: integer("totalLeads").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type TrackingToken = typeof trackingTokens.$inferSelect;
export type InsertTrackingToken = typeof trackingTokens.$inferInsert;

export type LeadEventLog = typeof leadEventLog.$inferSelect;
export type InsertLeadEventLog = typeof leadEventLog.$inferInsert;
export type MetaIntegrationConfig = typeof metaIntegrationConfig.$inferSelect;
export type WebhookConfig = typeof webhookConfig.$inferSelect;

// ════════════════════════════════════════════════════════════
// LEAD SOURCES & CAMPAIGNS
// ════════════════════════════════════════════════════════════

export const leadSources = pgTable("lead_sources", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().default(1),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }).default("#6366f1"),
  isActive: boolean("isActive").default(true).notNull(),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("ls_tenant_idx").on(t.tenantId),
  index("ls_tenant_active_idx").on(t.tenantId, t.isActive, t.isDeleted),
]);

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().default(1),
  sourceId: integer("sourceId"), // FK to lead_sources
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }).default("#8b5cf6"),
  isActive: boolean("isActive").default(true).notNull(),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("camp_tenant_idx").on(t.tenantId),
  index("camp_source_idx").on(t.sourceId),
  index("camp_tenant_active_idx").on(t.tenantId, t.isActive, t.isDeleted),
]);

// ════════════════════════════════════════════════════════════
// LOSS REASONS (Motivos de Perda de Venda)
// ════════════════════════════════════════════════════════════

export const lossReasons = pgTable("loss_reasons", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().default(1),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
  usageCount: integer("usageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("lr_tenant_idx").on(t.tenantId),
  index("lr_tenant_active_idx").on(t.tenantId, t.isActive, t.isDeleted),
]);

export type LeadSource = typeof leadSources.$inferSelect;
export type InsertLeadSource = typeof leadSources.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;
export type LossReason = typeof lossReasons.$inferSelect;
export type InsertLossReason = typeof lossReasons.$inferInsert;

// ════════════════════════════════════════════════════════════
// RD STATION MARKETING INTEGRATION
// ════════════════════════════════════════════════════════════

export const rdStationConfig = pgTable("rd_station_config", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().default(1),
  name: varchar("name", { length: 255 }),
  webhookToken: varchar("webhookToken", { length: 128 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  autoCreateDeal: boolean("autoCreateDeal").default(true).notNull(),
  defaultPipelineId: integer("defaultPipelineId"),
  defaultStageId: integer("defaultStageId"),
  defaultSource: varchar("defaultSource", { length: 255 }),
  defaultCampaign: varchar("defaultCampaign", { length: 255 }),
  defaultOwnerUserId: integer("defaultOwnerUserId"),
  assignmentTeamId: integer("assignmentTeamId"),
  assignmentMode: assignmentModeEnum("assignmentMode").default("random_all").notNull(),
  lastRoundRobinUserId: integer("lastRoundRobinUserId"),
  autoWhatsAppEnabled: boolean("autoWhatsAppEnabled").default(false).notNull(),
  autoWhatsAppMessageTemplate: text("autoWhatsAppMessageTemplate"),
  dealNameTemplate: text("dealNameTemplate"),
  autoProductId: integer("autoProductId"),
  totalLeadsReceived: integer("totalLeadsReceived").default(0).notNull(),
  lastLeadReceivedAt: timestamp("lastLeadReceivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("rdcfg_tenant_idx").on(t.tenantId),
]);

export const rdStationWebhookLog = pgTable("rd_station_webhook_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().default(1),
  rdLeadId: varchar("rdLeadId", { length: 255 }),
  conversionIdentifier: varchar("conversionIdentifier", { length: 255 }),
  email: varchar("email", { length: 320 }),
  name: varchar("name", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  utmSource: varchar("utmSource", { length: 255 }),
  utmMedium: varchar("utmMedium", { length: 255 }),
  utmCampaign: varchar("utmCampaign", { length: 255 }),
  utmContent: varchar("utmContent", { length: 255 }),
  utmTerm: varchar("utmTerm", { length: 255 }),
  status: rd_station_webhook_log_statusEnum("status").default("success").notNull(),
  dealId: integer("dealId"),
  contactId: integer("contactId"),
  configId: integer("configId"),
  autoWhatsAppStatus: varchar("autoWhatsAppStatus", { length: 32 }),
  autoWhatsAppError: text("autoWhatsAppError"),
  autoProductStatus: varchar("autoProductStatus", { length: 32 }),
  autoProductError: text("autoProductError"),
  autoTasksCreated: integer("autoTasksCreated").default(0),
  autoTasksFailed: integer("autoTasksFailed").default(0),
  autoTasksError: text("autoTasksError"),
  customDealName: boolean("customDealName").default(false),
  error: text("error"),
  rawPayload: json("rawPayload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("rdlog_tenant_idx").on(t.tenantId),
  index("rdlog_status_idx").on(t.tenantId, t.status),
  index("rdlog_created_idx").on(t.tenantId, t.createdAt),
  index("rdlog_config_idx").on(t.configId),
]);

export type RdStationConfig = typeof rdStationConfig.$inferSelect;
export type InsertRdStationConfig = typeof rdStationConfig.$inferInsert;
export type RdStationWebhookLog = typeof rdStationWebhookLog.$inferSelect;

// ════════════════════════════════════════════════════════════
// RD STATION CONFIG TASKS (Templates de Tarefas Automáticas)
// ════════════════════════════════════════════════════════════

export const rdStationConfigTasks = pgTable("rd_station_config_tasks", {
  id: serial("id").primaryKey(),
  configId: integer("configId").notNull(),
  tenantId: integer("tenantId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  taskType: varchar("taskType", { length: 32 }).default("task"),
  assignedToUserId: integer("assignedToUserId"),
  dueDaysOffset: integer("dueDaysOffset").default(0).notNull(),
  dueTime: varchar("dueTime", { length: 5 }),
  priority: priorityEnum("priority").default("medium").notNull(),
  orderIndex: integer("orderIndex").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("rdctask_config_idx").on(t.configId),
  index("rdctask_tenant_idx").on(t.tenantId),
]);

export type RdStationConfigTask = typeof rdStationConfigTasks.$inferSelect;
export type InsertRdStationConfigTask = typeof rdStationConfigTasks.$inferInsert;


// ════════════════════════════════════════════════════════════
// RD STATION FIELD MAPPINGS
// ════════════════════════════════════════════════════════════

export const rdFieldMappings = pgTable("rd_field_mappings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  rdFieldKey: varchar("rdFieldKey", { length: 255 }).notNull(), // campo do RD Station (ex: "cf_interesse", "company", "job_title")
  rdFieldLabel: varchar("rdFieldLabel", { length: 255 }).notNull(), // label amigável do campo RD
  targetEntity: targetEntityEnum("targetEntity").default("deal").notNull(), // entidade de destino no Entur OS
  enturFieldType: enturFieldTypeEnum("enturFieldType").default("custom").notNull(), // tipo: campo padrão ou personalizado
  enturFieldKey: varchar("enturFieldKey", { length: 255 }), // campo padrão do Entur (ex: "contact.email", "deal.utmSource") ou null se custom
  enturCustomFieldId: integer("enturCustomFieldId"), // FK para custom_fields.id se for campo personalizado
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("rdfm_tenant_idx").on(t.tenantId),
  index("rdfm_rd_key_idx").on(t.tenantId, t.rdFieldKey),
]);
export type RdFieldMapping = typeof rdFieldMappings.$inferSelect;
export type InsertRdFieldMapping = typeof rdFieldMappings.$inferInsert;


// ════════════════════════════════════════════════════════════
// SUBSCRIPTIONS & BILLING
// ════════════════════════════════════════════════════════════

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  provider: varchar("provider", { length: 32 }).default("hotmart").notNull(),
  plan: planEnum("plan").default("start").notNull(),
  status: subscriptions_statusEnum("status").default("trialing").notNull(),
  // Hotmart external references
  hotmartTransactionId: varchar("hotmartTransactionId", { length: 255 }),
  hotmartSubscriptionId: varchar("hotmartSubscriptionId", { length: 255 }),
  hotmartProductId: varchar("hotmartProductId", { length: 255 }),
  hotmartOfferId: varchar("hotmartOfferId", { length: 255 }),
  hotmartBuyerEmail: varchar("hotmartBuyerEmail", { length: 320 }),
  hotmartBuyerName: varchar("hotmartBuyerName", { length: 255 }),
  // Pricing
  priceInCents: integer("priceInCents").default(9700),
  currency: varchar("currency", { length: 8 }).default("BRL"),
  // Trial
  trialStartedAt: timestamp("trialStartedAt"),
  trialEndsAt: timestamp("trialEndsAt"),
  // Period
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  // Lifecycle
  cancelledAt: timestamp("cancelledAt"),
  lastEventAt: timestamp("lastEventAt"),
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("sub_tenant_idx").on(t.tenantId),
  index("sub_hotmart_idx").on(t.hotmartSubscriptionId),
  index("sub_status_idx").on(t.status),
  index("sub_buyer_email_idx").on(t.hotmartBuyerEmail),
]);

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ════════════════════════════════════════════════════════════
// SUBSCRIPTION EVENTS (Hotmart webhook audit trail)
// ════════════════════════════════════════════════════════════

export const subscriptionEvents = pgTable("subscription_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  subscriptionId: integer("subscriptionId"),
  provider: varchar("provider", { length: 32 }).default("hotmart").notNull(),
  externalEvent: varchar("externalEvent", { length: 128 }).notNull(),
  internalStatus: varchar("internalStatus", { length: 64 }).notNull(),
  transactionId: varchar("transactionId", { length: 255 }),
  buyerEmail: varchar("buyerEmail", { length: 320 }),
  rawPayload: json("rawPayload"),
  processed: boolean("processed").default(false).notNull(),
  processedAt: timestamp("processedAt"),
  errorMessage: text("errorMessage"),
  idempotencyKey: varchar("idempotencyKey", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("se_tenant_idx").on(t.tenantId),
  index("se_subscription_idx").on(t.subscriptionId),
  index("se_idempotency_idx").on(t.idempotencyKey),
  index("se_created_idx").on(t.createdAt),
  index("se_buyer_email_idx").on(t.buyerEmail),
]);

export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;
export type InsertSubscriptionEvent = typeof subscriptionEvents.$inferInsert;


// ════════════════════════════════════════════════════════════
// USER PREFERENCES
// ════════════════════════════════════════════════════════════

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  tenantId: integer("tenantId").notNull(),
  prefKey: varchar("prefKey", { length: 128 }).notNull(),
  prefValue: text("prefValue"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("up_user_tenant_idx").on(t.userId, t.tenantId),
  index("up_user_key_idx").on(t.userId, t.tenantId, t.prefKey),
]);
export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

// ═══════════════════════════════════════
// PASSWORD RESET TOKENS
// ═══════════════════════════════════════

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  token: varchar("token", { length: 128 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("prt_token_idx").on(t.token),
  index("prt_user_idx").on(t.userId),
]);
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;


// ════════════════════════════════════════════════════════════
// DATE-BASED AUTOMATIONS — Regras de movimentação automática por data
// ════════════════════════════════════════════════════════════

export const dateAutomations = pgTable("date_automations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  pipelineId: integer("pipelineId").notNull(),
  // Campo de data de referência no deal
  dateField: dateFieldEnum("dateField").notNull(),
  // Condição: "days_before" = N dias antes da data, "days_after" = N dias depois, "on_date" = no dia exato
  condition: conditionEnum("condition").notNull(),
  // Número de dias (0 para "on_date")
  offsetDays: integer("offsetDays").default(0).notNull(),
  // Etapa de origem (opcional: se null, aplica a qualquer etapa do pipeline)
  sourceStageId: integer("sourceStageId"),
  // Etapa de destino
  targetStageId: integer("targetStageId").notNull(),
  // Apenas mover deals com status específico (null = qualquer status)
  dealStatusFilter: dealStatusFilterEnum("dealStatusFilter").default("open"),
  isActive: boolean("isActive").default(true).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("da_tenant_idx").on(t.tenantId),
  index("da_tenant_pipeline_idx").on(t.tenantId, t.pipelineId),
]);
export type DateAutomation = typeof dateAutomations.$inferSelect;
export type InsertDateAutomation = typeof dateAutomations.$inferInsert;


// ════════════════════════════════════════════════════════════
// WA CONTACTS (LID ↔ Phone mapping from Baileys contacts.upsert)
// ════════════════════════════════════════════════════════════

export const waContacts = pgTable("wa_contacts", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 100 }).notNull(),
  jid: varchar("jid", { length: 100 }).notNull(),           // Primary JID (could be @s.whatsapp.net or @lid)
  lid: varchar("lid", { length: 100 }),                       // LID format (@lid)
  phoneNumber: varchar("phoneNumber", { length: 100 }),       // Phone number (@s.whatsapp.net)
  pushName: varchar("pushName", { length: 255 }),             // Contact's self-set name
  savedName: varchar("savedName", { length: 255 }),           // Name saved in phone contacts
  verifiedName: varchar("verifiedName", { length: 255 }),     // Business verified name
  profilePictureUrl: text("profilePictureUrl"),
  /** Quando o avatar foi atualizado pela última vez (porta profilePicRefresher) */
  profilePicUpdatedAt: timestamp("profilePicUpdatedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("wac_session_jid_idx").on(t.sessionId, t.jid),
  index("wac_session_lid_idx").on(t.sessionId, t.lid),
  index("wac_session_phone_idx").on(t.sessionId, t.phoneNumber),
]);
export type WaContact = typeof waContacts.$inferSelect;


// ═══════════════════════════════════════
// MATRIZ RFV — Classificação Automática de Contatos
// ═══════════════════════════════════════

export const rfvAudienceEnum = pgEnum("audience_type", [
  "desconhecido",
  "seguidor",
  "lead",
  "oportunidade",
  "nao_cliente",
  "cliente_primeira_compra",
  "cliente_recorrente",
  "ex_cliente",
  "indicado",
]);

export const rfvFlagEnum = pgEnum("rfv_flag", [
  "none",
  "potencial_indicador",
  "risco_ex_cliente",
  "abordagem_nao_cliente",
]);

export const rfvContacts = pgTable("rfv_contacts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  
  // Dados do contato
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  
  // Scores RFV
  vScore: bigint("vScore", { mode: "number" }).default(0).notNull(), // valor total comprado em centavos
  fScore: integer("fScore").default(0).notNull(), // quantidade de compras
  rScore: integer("rScore").default(9999).notNull(), // dias desde última compra
  
  // Classificação
  audienceType: varchar("audienceType", { length: 32 }).default("desconhecido").notNull(),
  rfvFlag: varchar("rfvFlag", { length: 32 }).default("none").notNull(),
  
  // Métricas
  totalAtendimentos: integer("totalAtendimentos").default(0).notNull(),
  totalVendasGanhas: integer("totalVendasGanhas").default(0).notNull(),
  totalVendasPerdidas: integer("totalVendasPerdidas").default(0).notNull(),
  taxaConversao: numeric("taxaConversao", { precision: 5, scale: 2 }).default("0").notNull(),
  
  // Datas
  lastActionDate: timestamp("lastActionDate"),
  lastPurchaseAt: timestamp("lastPurchaseAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  
  // Referências
  contactId: integer("contactId"), // link para contacts table (opcional)
  createdBy: integer("createdBy"),
  
  // Soft delete
  deletedAt: timestamp("deletedAt"),
}, (t) => [
  index("rfv_tenant_idx").on(t.tenantId),
  index("rfv_tenant_audience_idx").on(t.tenantId, t.audienceType),
  index("rfv_tenant_email_idx").on(t.tenantId, t.email),
  index("rfv_tenant_phone_idx").on(t.tenantId, t.phone),
  index("rfv_tenant_flag_idx").on(t.tenantId, t.rfvFlag),
]);

export type RfvContact = typeof rfvContacts.$inferSelect;
export type NewRfvContact = typeof rfvContacts.$inferInsert;

export const contactActionLogs = pgTable("contact_action_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  rfvContactId: integer("rfvContactId").notNull(),
  actionType: varchar("actionType", { length: 64 }).notNull(), // "import", "recalc", "manual_edit", "csv_import"
  description: text("description"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: integer("createdBy"),
}, (t) => [
  index("cal_tenant_idx").on(t.tenantId),
  index("cal_rfv_contact_idx").on(t.rfvContactId),
]);

export type ContactActionLog = typeof contactActionLogs.$inferSelect;


// ════════════════════════════════════════════════════════════
// RFV FILTER SNAPSHOTS (for notification change detection)
// ════════════════════════════════════════════════════════════

export const rfvFilterSnapshots = pgTable("rfv_filter_snapshots", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  filterKey: varchar("filterKey", { length: 64 }).notNull(), // e.g. potencial_ex_cliente
  previousCount: integer("previousCount").default(0).notNull(),
  currentCount: integer("currentCount").default(0).notNull(),
  lastCheckedAt: timestamp("lastCheckedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("rfv_snap_tenant_idx").on(t.tenantId),
  index("rfv_snap_tenant_filter_idx").on(t.tenantId, t.filterKey),
]);

export type RfvFilterSnapshot = typeof rfvFilterSnapshots.$inferSelect;
export type NewRfvFilterSnapshot = typeof rfvFilterSnapshots.$inferInsert;


// ════════════════════════════════════════════════════════════
// BULK CAMPAIGNS (WhatsApp mass messaging registry)
// ════════════════════════════════════════════════════════════

export const bulkCampaigns = pgTable("bulk_campaigns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  userId: integer("userId").notNull(),
  userName: varchar("userName", { length: 255 }),
  name: varchar("name", { length: 255 }).notNull(),
  messageTemplate: text("messageTemplate").notNull(),
  source: varchar("source", { length: 64 }).default("rfv").notNull(), // rfv, contacts, manual
  audienceFilter: varchar("audienceFilter", { length: 128 }), // which filter was active
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  intervalMs: integer("intervalMs").default(3000).notNull(),
  totalContacts: integer("totalContacts").default(0).notNull(),
  sentCount: integer("sentCount").default(0).notNull(),
  failedCount: integer("failedCount").default(0).notNull(),
  skippedCount: integer("skippedCount").default(0).notNull(),
  deliveredCount: integer("deliveredCount").default(0).notNull(),
  readCount: integer("readCount").default(0).notNull(),
  status: bulk_campaigns_statusEnum("status").default("running").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("bc_tenant_idx").on(t.tenantId),
  index("bc_tenant_status_idx").on(t.tenantId, t.status),
  index("bc_tenant_created_idx").on(t.tenantId, t.createdAt),
]);

export type BulkCampaign = typeof bulkCampaigns.$inferSelect;
export type NewBulkCampaign = typeof bulkCampaigns.$inferInsert;

export const bulkCampaignMessages = pgTable("bulk_campaign_messages", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull(),
  tenantId: integer("tenantId").notNull(),
  contactId: integer("contactId"),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 32 }),
  messageContent: text("messageContent"), // the actual interpolated message sent
  status: bulk_campaign_messages_statusEnum("status").default("pending").notNull(),
  errorMessage: text("errorMessage"),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  readAt: timestamp("readAt"),
  waMessageId: varchar("waMessageId", { length: 256 }), // WhatsApp message ID for tracking delivery/read
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("bcm_campaign_idx").on(t.campaignId),
  index("bcm_tenant_idx").on(t.tenantId),
  index("bcm_campaign_status_idx").on(t.campaignId, t.status),
  index("bcm_wa_msg_idx").on(t.waMessageId),
]);

export type BulkCampaignMessage = typeof bulkCampaignMessages.$inferSelect;
export type NewBulkCampaignMessage = typeof bulkCampaignMessages.$inferInsert;


// ════════════════════════════════════════════════════════════
// GOOGLE CALENDAR INTEGRATION (per user)
// ════════════════════════════════════════════════════════════

export const googleCalendarTokens = pgTable("google_calendar_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  tenantId: integer("tenantId").notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  tokenType: varchar("tokenType", { length: 32 }).default("Bearer"),
  expiresAt: timestamp("expiresAt"),
  scope: text("scope"),
  calendarEmail: varchar("calendarEmail", { length: 320 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("gct_user_tenant_idx").on(t.userId, t.tenantId),
  index("gct_tenant_idx").on(t.tenantId),
]);

export type GoogleCalendarToken = typeof googleCalendarTokens.$inferSelect;
export type InsertGoogleCalendarToken = typeof googleCalendarTokens.$inferInsert;

// ════════════════════════════════════════════════════════════
// SESSION SHARING (Admin shares WhatsApp session with users)
// ════════════════════════════════════════════════════════════

export const sessionShares = pgTable("session_shares", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  sourceSessionId: varchar("sourceSessionId", { length: 128 }).notNull(),
  sourceUserId: integer("sourceUserId").notNull(),
  targetUserId: integer("targetUserId").notNull(),
  status: share_statusEnum("share_status").default("active").notNull(),
  sharedBy: integer("sharedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
}, (t) => [
  index("ss_tenant_idx").on(t.tenantId),
  index("ss_target_user_idx").on(t.tenantId, t.targetUserId),
  index("ss_source_session_idx").on(t.tenantId, t.sourceSessionId),
]);

export type SessionShare = typeof sessionShares.$inferSelect;
export type InsertSessionShare = typeof sessionShares.$inferInsert;


// ════════════════════════════════════════════════════════════
// HELPDESK — Conversation Events (Timeline)
// ════════════════════════════════════════════════════════════
export const conversationEvents = pgTable("conversation_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  waConversationId: integer("waConversationId").notNull(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  eventType: conversationEventsEventTypeEnum("eventType").notNull(),
  fromUserId: integer("fromUserId"),
  toUserId: integer("toUserId"),
  fromTeamId: integer("fromTeamId"),
  toTeamId: integer("toTeamId"),
  content: text("content"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("ce_tenant_conv_idx").on(t.tenantId, t.waConversationId, t.createdAt),
  index("ce_tenant_session_idx").on(t.tenantId, t.sessionId),
  index("ce_event_type_idx").on(t.tenantId, t.eventType),
]);
export type ConversationEvent = typeof conversationEvents.$inferSelect;
export type InsertConversationEvent = typeof conversationEvents.$inferInsert;

// ════════════════════════════════════════════════════════════
// HELPDESK — Internal Notes (visible only to team)
// ════════════════════════════════════════════════════════════
export const internalNotes = pgTable("internal_notes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  waConversationId: integer("waConversationId").notNull(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  authorUserId: integer("authorUserId").notNull(),
  content: text("content").notNull(),
  mentionedUserIds: json("mentionedUserIds"),
  category: varchar("category", { length: 32 }).default("other").notNull(),
  priority: varchar("priority", { length: 16 }).default("normal").notNull(),
  isCustomerGlobalNote: boolean("isCustomerGlobalNote").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("in_tenant_conv_idx").on(t.tenantId, t.waConversationId, t.createdAt),
  index("in_author_idx").on(t.tenantId, t.authorUserId),
  index("in_global_note_idx").on(t.tenantId, t.isCustomerGlobalNote),
]);
export type InternalNote = typeof internalNotes.$inferSelect;
export type InsertInternalNote = typeof internalNotes.$inferInsert;

// ════════════════════════════════════════════════════════════
// HELPDESK — Quick Replies (message templates per team)
// ════════════════════════════════════════════════════════════
export const quickReplies = pgTable("quick_replies", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  teamId: integer("teamId"),
  shortcut: varchar("shortcut", { length: 32 }).notNull(),
  title: varchar("title", { length: 128 }).notNull(),
  content: text("content").notNull(),
  contentType: contentTypeEnum("contentType").default("text").notNull(),
  mediaUrl: varchar("mediaUrl", { length: 1024 }),
  category: varchar("category", { length: 64 }),
  usageCount: integer("usageCount").default(0).notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("qr_tenant_idx").on(t.tenantId),
  index("qr_tenant_team_idx").on(t.tenantId, t.teamId),
  index("qr_shortcut_idx").on(t.tenantId, t.shortcut),
]);
export type QuickReply = typeof quickReplies.$inferSelect;
export type InsertQuickReply = typeof quickReplies.$inferInsert;


// ════════════════════════════════════════════════════════════
// AI INTEGRATIONS — OpenAI & Anthropic Claude configuration
// ════════════════════════════════════════════════════════════
export const aiIntegrations = pgTable("ai_integrations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  provider: ai_integrations_providerEnum("provider").notNull(),
  apiKey: text("apiKey").notNull(),
  defaultModel: varchar("defaultModel", { length: 128 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("ai_tenant_idx").on(t.tenantId),
  index("ai_tenant_provider_idx").on(t.tenantId, t.provider),
]);
export type AiIntegration = typeof aiIntegrations.$inferSelect;
export type InsertAiIntegration = typeof aiIntegrations.$inferInsert;

// ════════════════════════════════════════════════════════════
// AI Suggestion Logs (Telemetry)
// ════════════════════════════════════════════════════════════
export const aiSuggestionLogs = pgTable("ai_suggestion_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  userId: integer("userId"),
  provider: varchar("provider", { length: 32 }).notNull(),
  model: varchar("model", { length: 128 }).notNull(),
  intentClassified: varchar("intentClassified", { length: 32 }),
  style: varchar("style", { length: 32 }).default("default"),
  durationMs: integer("durationMs"),
  contextMessageCount: integer("contextMessageCount"),
  hasCrmContext: boolean("hasCrmContext").default(false),
  success: boolean("success").default(true).notNull(),
  errorMessage: text("errorMessage"),
  wasEdited: boolean("wasEdited"),
  wasSent: boolean("wasSent"),
  sendMethod: varchar("sendMethod", { length: 32 }), // "use_field", "send_broken", null
  partsCount: integer("partsCount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("aisl_tenant_idx").on(t.tenantId),
  index("aisl_tenant_created_idx").on(t.tenantId, t.createdAt),
]);
export type AiSuggestionLog = typeof aiSuggestionLogs.$inferSelect;
export type InsertAiSuggestionLog = typeof aiSuggestionLogs.$inferInsert;

// ════════════════════════════════════════════════════════════
// CRM HARDENING — Channel Detection (Part 1)
// ════════════════════════════════════════════════════════════
export const waChannels = pgTable("wa_channels", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  instanceId: varchar("instanceId", { length: 128 }).notNull(), // sessionId / instance name
  phoneNumber: varchar("phoneNumber", { length: 32 }).notNull(),
  status: channel_statusEnum("channel_status").default("active").notNull(),
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  disconnectedAt: timestamp("disconnectedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("wach_tenant_instance_idx").on(t.tenantId, t.instanceId),
  index("wach_tenant_phone_idx").on(t.tenantId, t.phoneNumber),
]);
export type WaChannel = typeof waChannels.$inferSelect;
export type InsertWaChannel = typeof waChannels.$inferInsert;

// ════════════════════════════════════════════════════════════
// CRM HARDENING — Agent Collision Prevention (Part 8)
// ════════════════════════════════════════════════════════════
export const conversationLocks = pgTable("conversation_locks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  waConversationId: integer("waConversationId").notNull(),
  agentId: integer("agentId").notNull(),
  agentName: varchar("agentName", { length: 128 }),
  lockedAt: timestamp("lockedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
}, (t) => [
  index("cl_tenant_conv_idx").on(t.tenantId, t.waConversationId),
  index("cl_expires_idx").on(t.expiresAt),
]);
export type ConversationLock = typeof conversationLocks.$inferSelect;
export type InsertConversationLock = typeof conversationLocks.$inferInsert;

// ════════════════════════════════════════════════════════════
// CRM HARDENING — Channel Change Events (Part 9)
// ════════════════════════════════════════════════════════════
export const channelChangeEvents = pgTable("channel_change_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  instanceId: varchar("instanceId", { length: 128 }).notNull(),
  previousPhone: varchar("previousPhone", { length: 32 }),
  newPhone: varchar("newPhone", { length: 32 }).notNull(),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  previousChannelId: integer("previousChannelId"),
  newChannelId: integer("newChannelId"),
}, (t) => [
  index("cce_tenant_instance_idx").on(t.tenantId, t.instanceId),
]);
export type ChannelChangeEvent = typeof channelChangeEvents.$inferSelect;
export type InsertChannelChangeEvent = typeof channelChangeEvents.$inferInsert;

// ════════════════════════════════════════════════════════════
// Z-API Partner Provisioning
// ════════════════════════════════════════════════════════════
export const tenantZapiInstances = pgTable("tenant_zapi_instances", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  zapiInstanceId: varchar("zapiInstanceId", { length: 128 }).notNull(),
  zapiToken: text("zapiToken").notNull(),
  zapiClientToken: text("zapiClientToken"),
  instanceName: varchar("instanceName", { length: 255 }).notNull(),
  status: zapi_instance_statusEnum("zapi_instance_status").default("pending").notNull(),
  subscribedAt: timestamp("subscribedAt"),
  cancelledAt: timestamp("cancelledAt"),
  expiresAt: timestamp("expiresAt"),
  webhookBaseUrl: text("webhookBaseUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("tzi_tenant_idx").on(t.tenantId),
  index("tzi_zapi_instance_idx").on(t.zapiInstanceId),
]);
export type TenantZapiInstance = typeof tenantZapiInstances.$inferSelect;
export type InsertTenantZapiInstance = typeof tenantZapiInstances.$inferInsert;

// ════════════════════════════════════════════════════════════
// Z-API Admin Alerts
// ════════════════════════════════════════════════════════════

export const zapiAdminAlerts = pgTable("zapi_admin_alerts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  tenantName: varchar("tenantName", { length: 255 }),
  type: alert_typeEnum("alert_type").notNull(),
  severity: alert_severityEnum("alert_severity").default("warning").notNull(),
  message: text("message").notNull(),
  /** Additional context (e.g. instanceId, billingStatus, etc.) */
  metadata: json("metadata"),
  /** Whether the alert has been resolved/dismissed */
  resolved: boolean("resolved").default(false).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  resolvedBy: varchar("resolvedBy", { length: 320 }),
  /** Unique key to prevent duplicate alerts (e.g. "disconnected:tenantId:instanceId") */
  alertKey: varchar("alertKey", { length: 255 }).notNull(),
  /** Whether owner was notified about this alert */
  ownerNotified: boolean("ownerNotified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("zaa_tenant_idx").on(t.tenantId),
  index("zaa_type_idx").on(t.type),
  index("zaa_resolved_idx").on(t.resolved),
  index("zaa_alert_key_idx").on(t.alertKey),
]);
export type ZapiAdminAlert = typeof zapiAdminAlerts.$inferSelect;
export type InsertZapiAdminAlert = typeof zapiAdminAlerts.$inferInsert;

// ════════════════════════════════════════════════════════════
// CONTACT CONVERSION EVENTS — Histórico de conversões do contato
// ════════════════════════════════════════════════════════════

export const contactConversionEvents = pgTable("contact_conversion_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  contactId: integer("contactId").notNull(),
  /** Integration source: rdstation_marketing, meta_lead_ads, landing, tracking_script, elementor, manual */
  integrationSource: varchar("integrationSource", { length: 64 }).notNull(),
  /** RD Station lead_id or external lead identifier */
  externalLeadId: varchar("externalLeadId", { length: 255 }),
  /** Event type: conversion, opportunity, sale, etc. */
  eventType: varchar("eventType", { length: 64 }).notNull().default("conversion"),
  /** Conversion identifier (form name, page, etc.) */
  conversionIdentifier: varchar("conversionIdentifier", { length: 512 }),
  /** Human-readable conversion name */
  conversionName: varchar("conversionName", { length: 512 }),
  /** Asset name (landing page, form, ad, etc.) */
  assetName: varchar("assetName", { length: 512 }),
  /** Asset type (landing_page, form, popup, ad, etc.) */
  assetType: varchar("assetType", { length: 64 }),
  /** Traffic source */
  trafficSource: varchar("trafficSource", { length: 255 }),
  /** UTM fields */
  utmSource: varchar("utmSource", { length: 255 }),
  utmMedium: varchar("utmMedium", { length: 255 }),
  utmCampaign: varchar("utmCampaign", { length: 512 }),
  utmContent: varchar("utmContent", { length: 512 }),
  utmTerm: varchar("utmTerm", { length: 512 }),
  /** Form name or landing page URL */
  formName: varchar("formName", { length: 512 }),
  landingPage: varchar("landingPage", { length: 1024 }),
  /** Raw webhook payload for audit */
  rawPayload: json("rawPayload"),
  /** When the event was received */
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  /** How this event was matched to the contact */
  dedupeMatchType: dedupeMatchTypeEnum("dedupeMatchType").notNull().default("new_contact"),
  /** If matched to an existing contact, store the matched contact ID */
  matchedExistingContactId: integer("matchedExistingContactId"),
  /** If this event triggered a merge, link to the merge record */
  mergeEventId: integer("mergeEventId"),
  /** Idempotency key to prevent duplicate event processing */
  idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull(),
  /** Deal created or linked by this event */
  dealId: integer("dealId"),
  /** Decision made by the system: reused_existing_deal | created_new_deal | reopened_existing_context */
  dealDecision: varchar("dealDecision", { length: 64 }),
  /** Human-readable reason for the decision */
  dealDecisionReason: varchar("dealDecisionReason", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("cce_tenant_contact_idx").on(t.tenantId, t.contactId),
  index("cce_tenant_source_idx").on(t.tenantId, t.integrationSource),
  index("cce_idempotency_idx").on(t.idempotencyKey),
  index("cce_external_lead_idx").on(t.tenantId, t.externalLeadId),
  index("cce_received_at_idx").on(t.tenantId, t.receivedAt),
]);
export type ContactConversionEvent = typeof contactConversionEvents.$inferSelect;
export type InsertContactConversionEvent = typeof contactConversionEvents.$inferInsert;

// ════════════════════════════════════════════════════════════
// CONTACT MERGES — Registro de merges/unificações de contatos
// ════════════════════════════════════════════════════════════

export const contactMerges = pgTable("contact_merges", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  /** The canonical/primary contact that survives the merge */
  primaryContactId: integer("primaryContactId").notNull(),
  /** The secondary contact that was merged into the primary */
  secondaryContactId: integer("secondaryContactId").notNull(),
  /** Human-readable reason for the merge */
  reason: varchar("reason", { length: 512 }).notNull(),
  /** How the match was detected */
  matchType: matchTypeEnum("matchType").notNull(),
  /** Who/what initiated the merge (system, user ID, webhook) */
  createdBy: varchar("createdBy", { length: 128 }).notNull().default("system"),
  /** Merge lifecycle status */
  status: contact_merges_statusEnum("status").notNull().default("pending_review"),
  /** Snapshot of both contacts BEFORE the merge (for rollback) */
  snapshotBeforeMerge: json("snapshotBeforeMerge").notNull(),
  /** Snapshot of the primary contact AFTER the merge */
  snapshotAfterMerge: json("snapshotAfterMerge"),
  /** IDs of deals moved from secondary to primary */
  movedDealIds: json("movedDealIds"),
  /** IDs of tasks moved from secondary to primary */
  movedTaskIds: json("movedTaskIds"),
  /** IDs of conversion events moved from secondary to primary */
  movedConversionEventIds: json("movedConversionEventIds"),
  /** Whether this merge can be reverted */
  reversible: boolean("reversible").default(true).notNull(),
  /** Timestamps for status transitions */
  confirmedAt: timestamp("confirmedAt"),
  confirmedBy: varchar("confirmedBy", { length: 128 }),
  revertedAt: timestamp("revertedAt"),
  revertedBy: varchar("revertedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("cmerge_tenant_idx").on(t.tenantId),
  index("cmerge_primary_idx").on(t.tenantId, t.primaryContactId),
  index("cmerge_secondary_idx").on(t.tenantId, t.secondaryContactId),
  index("cmerge_status_idx").on(t.tenantId, t.status),
]);
export type ContactMerge = typeof contactMerges.$inferSelect;
export type InsertContactMerge = typeof contactMerges.$inferInsert;


// ════════════════════════════════════════════════════════════
// AI TRAINING CONFIGS — Per-tenant AI training/customization
// ════════════════════════════════════════════════════════════
export const aiTrainingConfigs = pgTable("ai_training_configs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  /** Which AI feature this config applies to */
  configType: configTypeEnum("configType").notNull(),
  /** Custom system prompt / training instructions */
  instructions: text("instructions"),
  /** Whether this training config is active */
  isActive: boolean("isActive").default(true).notNull(),
  /** Who last updated */
  updatedBy: integer("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("aitc_tenant_idx").on(t.tenantId),
  index("aitc_tenant_type_idx").on(t.tenantId, t.configType),
]);
export type AiTrainingConfig = typeof aiTrainingConfigs.$inferSelect;
export type InsertAiTrainingConfig = typeof aiTrainingConfigs.$inferInsert;

// ════════════════════════════════════════════════════════════
// DEAL FILES — Repositório de arquivos vinculados a negociações
// ════════════════════════════════════════════════════════════
export const dealFiles = pgTable("deal_files", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  dealId: integer("dealId").notNull(),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileKey: varchar("fileKey", { length: 1024 }).notNull(),
  url: text("url").notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  sizeBytes: bigint("sizeBytes", { mode: "number" }).default(0),
  description: varchar("description", { length: 512 }),
  uploadedBy: integer("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
}, (t) => [
  index("df_tenant_idx").on(t.tenantId),
  index("df_deal_idx").on(t.tenantId, t.dealId),
]);
export type DealFile = typeof dealFiles.$inferSelect;
export type InsertDealFile = typeof dealFiles.$inferInsert;


// ════════════════════════════════════════════════════════════
// PLAN MANAGEMENT (Super Admin Dashboard)
// ════════════════════════════════════════════════════════════

export const planDefinitions = pgTable("plan_definitions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isPublic: boolean("is_public").default(true).notNull(),
  priceCents: integer("price_cents").default(0).notNull(),
  billingCycle: billing_cycleEnum("billing_cycle").default("monthly").notNull(),
  hotmartOfferCode: varchar("hotmart_offer_code", { length: 100 }),
  description: text("description"),
  commercialCopy: text("commercial_copy"),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uq_plan_slug").on(t.slug),
]);

export type PlanDefinition = typeof planDefinitions.$inferSelect;
export type InsertPlanDefinition = typeof planDefinitions.$inferInsert;

export const planFeatures = pgTable("plan_features", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  featureKey: varchar("feature_key", { length: 100 }).notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  limitValue: integer("limit_value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uq_plan_feature").on(t.planId, t.featureKey),
  index("idx_pf_plan").on(t.planId),
]);

export type PlanFeature = typeof planFeatures.$inferSelect;
export type InsertPlanFeature = typeof planFeatures.$inferInsert;

export const tenantAddons = pgTable("tenant_addons", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  addonType: addonTypeEnum("addon_type").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  hotmartTransactionId: varchar("hotmart_transaction_id", { length: 200 }),
  hotmartOfferCode: varchar("hotmart_offer_code", { length: 100 }),
  activatedByUserId: integer("activated_by_user_id"),
  status: tenant_addons_statusEnum("status").default("active").notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_ta_tenant").on(t.tenantId),
  index("idx_ta_tenant_type").on(t.tenantId, t.addonType),
  index("idx_ta_transaction").on(t.hotmartTransactionId),
]);

export type TenantAddon = typeof tenantAddons.$inferSelect;
export type InsertTenantAddon = typeof tenantAddons.$inferInsert;

export const tenantEntitlementOverrides = pgTable("tenant_entitlement_overrides", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  featureKey: varchar("feature_key", { length: 100 }).notNull(),
  isEnabled: boolean("is_enabled").notNull(),
  limitValue: integer("limit_value"),
  reason: varchar("reason", { length: 500 }).notNull(),
  expiresAt: timestamp("expires_at"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uq_override").on(t.tenantId, t.featureKey),
  index("idx_ov_tenant").on(t.tenantId),
]);

export type TenantEntitlementOverride = typeof tenantEntitlementOverrides.$inferSelect;
export type InsertTenantEntitlementOverride = typeof tenantEntitlementOverrides.$inferInsert;

// Add-on offer codes (links Hotmart offer codes to addon types)
export const addonOfferCodes = pgTable("addon_offer_codes", {
  id: serial("id").primaryKey(),
  addonType: addonTypeEnum("addon_type").notNull(),
  hotmartOfferCode: varchar("hotmart_offer_code", { length: 100 }).notNull(),
  priceCents: integer("price_cents").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("uq_addon_offer").on(t.addonType, t.hotmartOfferCode),
]);

export type AddonOfferCode = typeof addonOfferCodes.$inferSelect;
export type InsertAddonOfferCode = typeof addonOfferCodes.$inferInsert;

// ════════════════════════════════════════════════════════════
// GOOGLE CALENDAR EVENTS (synced from Google Calendar API)
// ════════════════════════════════════════════════════════════

export const googleCalendarEvents = pgTable("google_calendar_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  userId: integer("userId").notNull(),
  googleEventId: varchar("googleEventId", { length: 512 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt").notNull(),
  allDay: boolean("allDay").default(false),
  location: varchar("location", { length: 500 }),
  status: varchar("status", { length: 50 }).default("confirmed"),
  htmlLink: varchar("htmlLink", { length: 1000 }),
  sourceCalendarId: varchar("sourceCalendarId", { length: 500 }),
  rawJson: json("rawJson"),
  syncedAt: timestamp("syncedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("idx_gcal_tenant_user_event").on(t.tenantId, t.userId, t.googleEventId),
  index("idx_gcal_tenant_user_range").on(t.tenantId, t.userId, t.startAt, t.endAt),
  index("idx_gcal_tenant_range").on(t.tenantId, t.startAt, t.endAt),
]);

export type GoogleCalendarEvent = typeof googleCalendarEvents.$inferSelect;
export type InsertGoogleCalendarEvent = typeof googleCalendarEvents.$inferInsert;


// ════════════════════════════════════════════════════════════
// CRM APPOINTMENTS (manual calendar entries)
// ════════════════════════════════════════════════════════════

export const appointmentStatusEnum = pgEnum("appointment_status", ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"]);

export const crmAppointments = pgTable("crm_appointments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  userId: integer("userId").notNull(),          // owner / creator
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt").notNull(),
  allDay: boolean("allDay").default(false).notNull(),
  location: varchar("location", { length: 500 }),
  color: varchar("color", { length: 20 }).default("emerald"),
  dealId: integer("dealId"),
  contactId: integer("contactId"),
  // Novos campos para negocios locais
  serviceType: varchar("serviceType", { length: 100 }),
  status: appointmentStatusEnum("status").default("scheduled").notNull(),
  recurrenceRule: text("recurrenceRule"),             // RRULE (RFC 5545)
  recurrenceParentId: integer("recurrenceParentId"),  // FK appointment pai
  reminderSentAt: timestamp("reminderSentAt"),
  reminder24hSentAt: timestamp("reminder24hSentAt"),
  reminder2hSentAt: timestamp("reminder2hSentAt"),
  followUpSentAt: timestamp("followUpSentAt"),
  noShowFollowUpSentAt: timestamp("noShowFollowUpSentAt"),
  notes: text("notes"),
  price: numeric("price", { precision: 12, scale: 2 }),
  professionalId: integer("professionalId"),           // FK crm_users
  contactPhone: varchar("contactPhone", { length: 32 }),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("appt_tenant_user_range_idx").on(t.tenantId, t.userId, t.startAt, t.endAt),
  index("appt_tenant_range_idx").on(t.tenantId, t.startAt, t.endAt),
  index("appt_tenant_deal_idx").on(t.tenantId, t.dealId),
  index("appt_tenant_status_idx").on(t.tenantId, t.status),
  index("appt_tenant_professional_idx").on(t.tenantId, t.professionalId),
]);

export type CrmAppointment = typeof crmAppointments.$inferSelect;
export type InsertCrmAppointment = typeof crmAppointments.$inferInsert;

// ════════════════════════════════════════════════════════════
// CRM APPOINTMENT PARTICIPANTS
// ════════════════════════════════════════════════════════════

export const crmAppointmentParticipants = pgTable("crm_appointment_participants", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointmentId").notNull(),
  userId: integer("userId").notNull(),
  tenantId: integer("tenantId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("cap_appt_user_uniq").on(t.appointmentId, t.userId),
  index("cap_user_idx").on(t.tenantId, t.userId),
]);

export type CrmAppointmentParticipant = typeof crmAppointmentParticipants.$inferSelect;
export type InsertCrmAppointmentParticipant = typeof crmAppointmentParticipants.$inferInsert;


// ════════════════════════════════════════════════════════════
// CUSTOM MESSAGES — Mensagens Personalizadas por Categoria (Comunicação)
// ════════════════════════════════════════════════════════════

export const customMessageCategoryEnum = pgEnum("custom_msg_category", [
  "primeiro_contato",
  "reativacao",
  "pedir_indicacao",
  "receber_indicado",
  "recuperacao_vendas",
  "objecoes",
  "outros",
]);

export const customMessages = pgTable("custom_messages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  orderIndex: integer("orderIndex").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("cm_tenant_idx").on(t.tenantId),
  index("cm_tenant_category_idx").on(t.tenantId, t.category),
]);

export type CustomMessage = typeof customMessages.$inferSelect;
export type InsertCustomMessage = typeof customMessages.$inferInsert;

// ════════════════════════════════════════════════════════════
// INBOX — Conversation Tags
// ════════════════════════════════════════════════════════════
export const conversationTags = pgTable("conversation_tags", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("#6366f1").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("ct_tenant_name_idx").on(t.tenantId, t.name),
]);
export type ConversationTag = typeof conversationTags.$inferSelect;
export type InsertConversationTag = typeof conversationTags.$inferInsert;

// Junction: wa_conversations ↔ conversation_tags
export const waConversationTagLinks = pgTable("wa_conversation_tag_links", {
  id: serial("id").primaryKey(),
  waConversationId: integer("waConversationId").notNull(),
  tagId: integer("tagId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("wctl_conv_tag_idx").on(t.waConversationId, t.tagId),
  index("wctl_tag_idx").on(t.tagId),
]);

// ════════════════════════════════════════════════════════════
// INBOX — Scheduled Messages
// ════════════════════════════════════════════════════════════
export const scheduledMessages = pgTable("scheduled_messages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  content: text("content").notNull(),
  contentType: contentTypeEnum("contentType").default("text").notNull(),
  mediaUrl: varchar("mediaUrl", { length: 1024 }),
  scheduledAt: timestamp("scheduledAt").notNull(),
  status: scheduled_messages_statusEnum("status").default("pending").notNull(),
  sentAt: timestamp("sentAt"),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("sm_tenant_status_idx").on(t.tenantId, t.status),
  index("sm_scheduled_idx").on(t.scheduledAt),
]);
export type ScheduledMessage = typeof scheduledMessages.$inferSelect;
export type InsertScheduledMessage = typeof scheduledMessages.$inferInsert;

// ════════════════════════════════════════════════════════════
// REFERRALS (Sistema de Indicacoes)
// ════════════════════════════════════════════════════════════

export const referralStatusEnum = pgEnum("referral_status", ["pending", "converted", "expired"]);
export const referralRewardTypeEnum = pgEnum("referral_reward_type", ["discount", "credit", "gift", "none"]);

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  referrerId: integer("referrerId").notNull(),     // FK contacts - quem indicou
  referredId: integer("referredId").notNull(),      // FK contacts - quem foi indicado
  dealId: integer("dealId"),                        // FK deals - negocio gerado
  status: referralStatusEnum("status").default("pending").notNull(),
  rewardType: referralRewardTypeEnum("rewardType").default("none").notNull(),
  rewardValue: numeric("rewardValue", { precision: 12, scale: 2 }),
  rewardDelivered: boolean("rewardDelivered").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("ref_tenant_idx").on(t.tenantId),
  index("ref_referrer_idx").on(t.tenantId, t.referrerId),
  index("ref_referred_idx").on(t.tenantId, t.referredId),
]);

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

// ════════════════════════════════════════════════════════════
// CLIENT PACKAGES (Pacotes de Sessoes / Venda Recorrente)
// ════════════════════════════════════════════════════════════

export const clientPackageStatusEnum = pgEnum("client_package_status", ["active", "completed", "expired", "cancelled"]);

export const clientPackages = pgTable("client_packages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  contactId: integer("contactId").notNull(),        // FK contacts
  productId: integer("productId"),                   // FK product_catalog
  name: varchar("name", { length: 255 }).notNull(),
  totalSessions: integer("totalSessions").notNull(),
  usedSessions: integer("usedSessions").default(0).notNull(),
  status: clientPackageStatusEnum("status").default("active").notNull(),
  priceTotal: numeric("priceTotal", { precision: 12, scale: 2 }),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("cp_tenant_idx").on(t.tenantId),
  index("cp_contact_idx").on(t.tenantId, t.contactId),
  index("cp_status_idx").on(t.tenantId, t.status),
]);

export type ClientPackage = typeof clientPackages.$inferSelect;
export type InsertClientPackage = typeof clientPackages.$inferInsert;

// ════════════════════════════════════════════════════════════
// CLIENT EVOLUTIONS (Evolucoes Clinicas - registro de atendimentos)
// ════════════════════════════════════════════════════════════

export const clientEvolutions = pgTable("client_evolutions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  contactId: integer("contactId").notNull(),
  appointmentId: integer("appointmentId"),           // FK crm_appointments (opcional)
  treatmentId: integer("treatmentId"),               // FK client_treatments (opcional)
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),                // rich text HTML
  professionalId: integer("professionalId"),         // FK crm_users
  photos: json("photos").$type<string[]>(),          // URLs de fotos antes/depois
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("evo_tenant_contact_idx").on(t.tenantId, t.contactId),
  index("evo_tenant_created_idx").on(t.tenantId, t.createdAt),
]);

export type ClientEvolution = typeof clientEvolutions.$inferSelect;
export type InsertClientEvolution = typeof clientEvolutions.$inferInsert;

// ════════════════════════════════════════════════════════════
// ANAMNESIS TEMPLATES & QUESTIONS (Fichas de Anamnese)
// ════════════════════════════════════════════════════════════

export const anamnesisQuestionTypeEnum = pgEnum("anamnesis_question_type", ["text", "textarea", "boolean", "select", "multiselect", "number", "date"]);

export const anamnesisTemplates = pgTable("anamnesis_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  slug: varchar("slug", { length: 64 }),               // identificador estavel (hof, estetica, co2)
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isDefault: boolean("isDefault").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("at_tenant_idx").on(t.tenantId),
  index("at_tenant_slug_idx").on(t.tenantId, t.slug),
]);

export type AnamnesisTemplate = typeof anamnesisTemplates.$inferSelect;
export type InsertAnamnesisTemplate = typeof anamnesisTemplates.$inferInsert;

export const anamnesisQuestions = pgTable("anamnesis_questions", {
  id: serial("id").primaryKey(),
  templateId: integer("templateId").notNull(),
  tenantId: integer("tenantId").notNull(),
  section: varchar("section", { length: 255 }),      // agrupamento (ex: "Saude Geral", "Historico Estetico")
  question: text("question").notNull(),
  questionType: anamnesisQuestionTypeEnum("questionType").default("text").notNull(),
  options: json("options").$type<string[]>(),         // opcoes para select/multiselect
  isRequired: boolean("isRequired").default(false).notNull(),
  hasExtraField: boolean("hasExtraField").default(false).notNull(),
  extraFieldLabel: varchar("extraFieldLabel", { length: 128 }), // ex: "Quais?", "Informações adicionais"
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("aq_template_idx").on(t.templateId),
  index("aq_tenant_idx").on(t.tenantId),
]);

export type AnamnesisQuestion = typeof anamnesisQuestions.$inferSelect;
export type InsertAnamnesisQuestion = typeof anamnesisQuestions.$inferInsert;

export const anamnesisResponses = pgTable("anamnesis_responses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  contactId: integer("contactId").notNull(),
  templateId: integer("templateId").notNull(),
  answers: json("answers").$type<Record<string, string>>().notNull(), // questionId -> answer; chave "{id}_extra" guarda texto complementar
  observation: text("observation"),                    // campo livre de observacoes finais
  filledByMode: varchar("filledByMode", { length: 16 }).default("professional").notNull(), // "professional" | "patient"
  filledByUserId: integer("filledByUserId"),
  filledAt: timestamp("filledAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("ar_tenant_contact_idx").on(t.tenantId, t.contactId),
  index("ar_template_idx").on(t.templateId),
]);

export type AnamnesisResponse = typeof anamnesisResponses.$inferSelect;
export type InsertAnamnesisResponse = typeof anamnesisResponses.$inferInsert;

// ════════════════════════════════════════════════════════════
// CLIENT TREATMENTS (Tratamentos em andamento)
// ════════════════════════════════════════════════════════════

export const treatmentStatusEnum = pgEnum("treatment_status", ["active", "completed", "cancelled", "paused"]);

export const clientTreatments = pgTable("client_treatments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  contactId: integer("contactId").notNull(),
  dealId: integer("dealId"),                          // FK deals (orcamento que gerou)
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: treatmentStatusEnum("status").default("active").notNull(),
  totalSessions: integer("totalSessions"),
  completedSessions: integer("completedSessions").default(0).notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  valueCents: integer("valueCents"),
  professionalId: integer("professionalId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("ct_tenant_contact_idx").on(t.tenantId, t.contactId),
  index("ct_tenant_status_idx").on(t.tenantId, t.status),
]);

export type ClientTreatment = typeof clientTreatments.$inferSelect;
export type InsertClientTreatment = typeof clientTreatments.$inferInsert;

// ════════════════════════════════════════════════════════════
// CLIENT DEBITS (Debitos financeiros do cliente)
// ════════════════════════════════════════════════════════════

export const debitStatusEnum = pgEnum("debit_status", ["pending", "partial", "paid", "overdue", "cancelled"]);

export const clientDebits = pgTable("client_debits", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  contactId: integer("contactId").notNull(),
  dealId: integer("dealId"),                          // FK deals
  treatmentId: integer("treatmentId"),                // FK client_treatments
  description: varchar("description", { length: 500 }).notNull(),
  totalCents: integer("totalCents").notNull(),
  paidCents: integer("paidCents").default(0).notNull(),
  status: debitStatusEnum("status").default("pending").notNull(),
  dueDate: timestamp("dueDate"),
  paidAt: timestamp("paidAt"),
  paymentMethod: varchar("paymentMethod", { length: 64 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("cd_tenant_contact_idx").on(t.tenantId, t.contactId),
  index("cd_tenant_status_idx").on(t.tenantId, t.status),
]);

export type ClientDebit = typeof clientDebits.$inferSelect;
export type InsertClientDebit = typeof clientDebits.$inferInsert;

// ════════════════════════════════════════════════════════════
// CLIENT DOCUMENTS (Documentos categorizados do cliente)
// ════════════════════════════════════════════════════════════

export const documentCategoryEnum = pgEnum("document_category", ["receita", "atestado", "imagem", "contrato", "exame", "consentimento", "outro"]);

export const clientDocuments = pgTable("client_documents", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  contactId: integer("contactId").notNull(),
  category: documentCategoryEnum("category").default("outro").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  fileUrl: text("fileUrl").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  sizeBytes: integer("sizeBytes"),
  uploadedByUserId: integer("uploadedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("cdoc_tenant_contact_idx").on(t.tenantId, t.contactId),
  index("cdoc_tenant_category_idx").on(t.tenantId, t.category),
]);

// ════════════════════════════════════════════════════════════
// PORTS FROM ENTUR-OS-CRM (merge feat/merge-from-entur)
// IA + nego↔WA + LID identity
// ════════════════════════════════════════════════════════════

export const aiUsageLog = pgTable("ai_usage_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  feature: varchar("feature", { length: 32 }).notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  model: varchar("model", { length: 128 }).notNull(),
  inputTokens: integer("inputTokens"),
  outputTokens: integer("outputTokens"),
  totalTokens: integer("totalTokens"),
  estimatedCostCents: integer("estimatedCostCents"),
  dealId: integer("dealId"),
  userId: integer("userId"),
  durationMs: integer("durationMs"),
  success: boolean("success").default(false).notNull(),
  errorCode: varchar("errorCode", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("ai_usage_tenant_created_idx").on(t.tenantId, t.createdAt),
  index("ai_usage_tenant_feature_idx").on(t.tenantId, t.feature, t.createdAt),
]);

export type AiUsageLog = typeof aiUsageLog.$inferSelect;
export type InsertAiUsageLog = typeof aiUsageLog.$inferInsert;

export const dealExtractedEntities = pgTable("deal_extracted_entities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  dealId: integer("dealId").notNull(),
  fieldKey: varchar("fieldKey", { length: 64 }).notNull(),
  value: text("value"),
  confidence: integer("confidence").default(0),
  source: varchar("source", { length: 32 }).default("whatsapp").notNull(),
  acceptedByUserId: integer("acceptedByUserId"),
  acceptedAt: timestamp("acceptedAt"),
  dismissedAt: timestamp("dismissedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("dee_tenant_deal_idx").on(t.tenantId, t.dealId),
  uniqueIndex("dee_deal_field_unique").on(t.dealId, t.fieldKey),
]);

export type DealExtractedEntity = typeof dealExtractedEntities.$inferSelect;

export const dealMessageLinks = pgTable("deal_message_links", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  dealId: integer("dealId").notNull(),
  messageDbId: integer("messageDbId").notNull(),
  linkedAt: timestamp("linkedAt").defaultNow().notNull(),
  linkedBy: varchar("linkedBy", { length: 32 }).default("auto").notNull(),
}, (t) => [
  uniqueIndex("idx_dml_unique").on(t.dealId, t.messageDbId),
  index("idx_dml_deal").on(t.tenantId, t.dealId),
  index("idx_dml_msg").on(t.messageDbId),
]);

export type DealMessageLink = typeof dealMessageLinks.$inferSelect;

export const channelIdentities = pgTable("channel_identities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  contactId: integer("contactId").notNull(),
  channel: varchar("channel", { length: 32 }).notNull(), // "whatsapp_unofficial"
  externalId: varchar("externalId", { length: 512 }).notNull(), // LID ou equivalente
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("channel_identities_channel_external_idx").on(t.channel, t.externalId),
  index("channel_identities_tenant_contact_idx").on(t.tenantId, t.contactId),
]);

// ════════════════════════════════════════════════════════════
// AGENTES IA (substitui chatbotSettings/chatbotRules)
// ════════════════════════════════════════════════════════════

export const agentModeEnum = pgEnum("agent_mode", ["autonomous", "off", "paused"]);
export const agentRunOutcomeEnum = pgEnum("agent_run_outcome", ["replied", "handed_off", "no_action", "errored"]);
export const agentStateStatusEnum = pgEnum("agent_state_status", ["active", "paused_by_user", "handed_off", "ended"]);
export const agentKillScopeEnum = pgEnum("agent_kill_scope", ["tenant", "session", "conversation"]);

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  sessionId: varchar("sessionId", { length: 128 }), // null = aplica a todos os canais do tenant
  name: varchar("name", { length: 128 }).default("Agente IA").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  modeSwitch: agentModeEnum("modeSwitch").default("off").notNull(),
  systemPrompt: text("systemPrompt"),
  provider: varchar("provider", { length: 32 }).default("tenant_default").notNull(),
  model: varchar("model", { length: 64 }),
  temperature: numeric("temperature", { precision: 3, scale: 2 }).default("0.50"),
  maxTokens: integer("maxTokens").default(800).notNull(),
  toolsAllowed: json("toolsAllowed").$type<string[]>().default(["lookup_crm", "qualify", "deal", "handoff"]).notNull(),
  // Filtros (porta da config antiga)
  respondGroups: boolean("respondGroups").default(false).notNull(),
  respondPrivate: boolean("respondPrivate").default(true).notNull(),
  onlyWhenMentioned: boolean("onlyWhenMentioned").default(false).notNull(),
  // Auto messages
  greeting: text("greeting"),
  away: text("away"),
  // Business hours
  businessHoursEnabled: boolean("businessHoursEnabled").default(false).notNull(),
  businessHoursStart: varchar("businessHoursStart", { length: 5 }).default("09:00"),
  businessHoursEnd: varchar("businessHoursEnd", { length: 5 }).default("18:00"),
  businessHoursDays: varchar("businessHoursDays", { length: 32 }).default("1,2,3,4,5"),
  businessHoursTimezone: varchar("businessHoursTimezone", { length: 64 }).default("America/Sao_Paulo"),
  // Loop e qualidade
  maxTurns: integer("maxTurns").default(8).notNull(),
  escalateConfidenceBelow: numeric("escalateConfidenceBelow", { precision: 3, scale: 2 }).default("0.60"),
  contextMessageCount: integer("contextMessageCount").default(10).notNull(),
  replyDelayMs: integer("replyDelayMs").default(0).notNull(),
  // Rate limits
  rateLimitPerContactPerHour: integer("rateLimitPerContactPerHour").default(20).notNull(),
  rateLimitPerTenantPerHour: integer("rateLimitPerTenantPerHour").default(500).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("agents_tenant_session_unique").on(t.tenantId, t.sessionId),
  index("agents_tenant_idx").on(t.tenantId),
]);

export type Agent = typeof agents.$inferSelect;

export const agentConversationState = pgTable("agent_conversation_state", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  agentId: integer("agentId").notNull(),
  status: agentStateStatusEnum("status").default("active").notNull(),
  turnsCount: integer("turnsCount").default(0).notNull(),
  goal: varchar("goal", { length: 64 }), // "qualifying" | "scheduling" | "supporting"
  qualifiedFields: json("qualifiedFields").$type<Record<string, unknown>>(),
  lastRunId: integer("lastRunId"),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("agent_state_unique").on(t.tenantId, t.sessionId, t.remoteJid),
  index("agent_state_tenant_idx").on(t.tenantId),
]);

export type AgentConversationState = typeof agentConversationState.$inferSelect;

export const agentRuns = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  agentId: integer("agentId").notNull(),
  conversationStateId: integer("conversationStateId"),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  triggerMessageId: varchar("triggerMessageId", { length: 256 }),
  inputText: text("inputText"),
  outcome: agentRunOutcomeEnum("outcome").notNull(),
  replyText: text("replyText"),
  toolCalls: json("toolCalls").$type<Array<{ tool: string; input: unknown; output: unknown; durationMs: number }>>().default([]),
  modelMessages: json("modelMessages").$type<unknown[]>(),
  inputTokens: integer("inputTokens"),
  outputTokens: integer("outputTokens"),
  costCents: integer("costCents"),
  durationMs: integer("durationMs"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("agent_runs_tenant_created_idx").on(t.tenantId, t.createdAt),
  index("agent_runs_agent_idx").on(t.agentId),
  index("agent_runs_conv_idx").on(t.tenantId, t.sessionId, t.remoteJid),
]);

export type AgentRun = typeof agentRuns.$inferSelect;

export const agentKillSwitches = pgTable("agent_kill_switches", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  scope: agentKillScopeEnum("scope").notNull(),
  sessionId: varchar("sessionId", { length: 128 }),
  remoteJid: varchar("remoteJid", { length: 128 }),
  pausedBy: integer("pausedBy"),
  pausedAt: timestamp("pausedAt").defaultNow().notNull(),
  reason: text("reason"),
}, (t) => [
  index("agent_kill_lookup_idx").on(t.tenantId, t.scope, t.sessionId, t.remoteJid),
]);

export type AgentKillSwitch = typeof agentKillSwitches.$inferSelect;

/**
 * Knowledge base por tenant — entries injetadas no system prompt do agente IA.
 * Tipos: faq (P&R), policy (regra/política), product_info (info de produto/serviço).
 */
export const agentKnowledgeEntries = pgTable("agent_knowledge_entries", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  /** Quando null, aplica a todos os agentes do tenant. */
  agentId: integer("agentId"),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  /** "faq" | "policy" | "product_info" — controla o cabeçalho na injeção. */
  sourceType: varchar("sourceType", { length: 32 }).default("faq").notNull(),
  /** Tags para filtro futuro (ex: "horário,preço,reembolso"). */
  tags: varchar("tags", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  orderIndex: integer("orderIndex").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("agent_kb_tenant_idx").on(t.tenantId, t.isActive),
  index("agent_kb_agent_idx").on(t.agentId),
]);

export type AgentKnowledgeEntry = typeof agentKnowledgeEntries.$inferSelect;
