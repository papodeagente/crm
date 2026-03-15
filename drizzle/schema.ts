import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json, bigint, index, uniqueIndex, decimal } from "drizzle-orm/mysql-core";

// ════════════════════════════════════════════════════════════
// EXISTING WHATSAPP API TABLES (preserved)
// ════════════════════════════════════════════════════════════

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isSuperAdmin: boolean("isSuperAdmin").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const whatsappSessions = mysqlTable("whatsapp_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull().unique(),
  userId: int("userId").notNull(),
  tenantId: int("tenantId").default(1).notNull(),
  status: mysqlEnum("status", ["connecting", "connected", "disconnected", "deleted"]).default("disconnected").notNull(),
  phoneNumber: varchar("phoneNumber", { length: 32 }),
  pushName: varchar("pushName", { length: 128 }),
  platform: varchar("platform", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("ws_tenant_idx").on(t.tenantId),
]);

export const waMessages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  tenantId: int("tenantId").default(1).notNull(),
  messageId: varchar("messageId", { length: 256 }),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  fromMe: boolean("fromMe").default(false).notNull(),
  senderAgentId: int("senderAgentId"),
  pushName: varchar("pushName", { length: 128 }),
  messageType: varchar("messageType", { length: 32 }).default("text").notNull(),
  content: text("content"),
  mediaUrl: text("mediaUrl"),
  mediaMimeType: varchar("media_mime_type", { length: 128 }),
  mediaFileName: varchar("media_file_name", { length: 512 }),
  mediaDuration: int("media_duration"),
  isVoiceNote: boolean("is_voice_note").default(false),
  quotedMessageId: varchar("quoted_message_id", { length: 256 }),
  status: varchar("status", { length: 32 }).default("sent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  waConversationId: int("waConversationId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("msg_tenant_idx").on(t.tenantId),
  index("msg_session_jid_idx").on(t.sessionId, t.remoteJid, t.timestamp),
  index("idx_msg_wa_conv").on(t.waConversationId),
  uniqueIndex("idx_unique_msgid_session").on(t.messageId, t.sessionId),
]);

export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  description: text("description"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const chatbotSettings = mysqlTable("chatbot_settings", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull().unique(),
  enabled: boolean("enabled").default(false).notNull(),
  systemPrompt: text("systemPrompt"),
  maxTokens: int("maxTokens").default(500),
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
  replyDelay: int("replyDelay").default(0),
  contextMessageCount: int("contextMessageCount").default(10),
  rateLimitPerHour: int("rateLimitPerHour").default(0),
  rateLimitPerDay: int("rateLimitPerDay").default(0),
  temperature: decimal("temperature", { precision: 3, scale: 2 }).default("0.70"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const chatbotRules = mysqlTable("chatbot_rules", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  ruleType: mysqlEnum("ruleType", ["whitelist", "blacklist"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_session_type").on(t.sessionId, t.ruleType),
]);

// ════════════════════════════════════════════════════════════
// CONVERSATION ASSIGNMENTS (Multi-Agent / SaaS)
// ════════════════════════════════════════════════════════════

export const conversationAssignments = mysqlTable("conversation_assignments", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  assignedUserId: int("assignedUserId"),
  assignedTeamId: int("assignedTeamId"),
  status: mysqlEnum("status", ["open", "pending", "resolved", "closed"]).default("open").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  lastAssignedAt: timestamp("lastAssignedAt"),
  firstResponseAt: timestamp("firstResponseAt"),
  resolvedAt: timestamp("resolvedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("ca_tenant_session_jid_idx").on(t.tenantId, t.sessionId, t.remoteJid),
  index("ca_tenant_user_idx").on(t.tenantId, t.assignedUserId),
  index("ca_tenant_team_idx").on(t.tenantId, t.assignedTeamId),
  index("ca_tenant_status_idx").on(t.tenantId, t.status),
]);

// ════════════════════════════════════════════════════════════
// ASTRA CRM — CORE / TENANTS
// ════════════════════════════════════════════════════════════

export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 128 }),
  plan: mysqlEnum("plan", ["free", "pro", "enterprise"]).default("free").notNull(),
  status: mysqlEnum("status", ["active", "suspended", "cancelled"]).default("active").notNull(),
  ownerUserId: int("ownerUserId"),
  billingCustomerId: varchar("billingCustomerId", { length: 128 }),
  hotmartEmail: varchar("hotmartEmail", { length: 320 }),
  freemiumDays: int("freemiumDays").default(365).notNull(),
  freemiumExpiresAt: timestamp("freemiumExpiresAt"),
  logoUrl: text("logoUrl"),
  settingsJson: json("settingsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ════════════════════════════════════════════════════════════
// M0 — IAM (Identity & Access Management)
// ════════════════════════════════════════════════════════════

export const crmUsers = mysqlTable("crm_users", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  passwordHash: varchar("passwordHash", { length: 512 }),
  role: mysqlEnum("crm_user_role", ["admin", "user"]).default("user").notNull(),
  status: mysqlEnum("status", ["active", "inactive", "invited"]).default("invited").notNull(),
  avatarUrl: text("avatarUrl"),
  lastLoginAt: timestamp("lastLoginAt"),
  lastActiveAt: timestamp("lastActiveAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
}, (t) => [
  index("crm_users_tenant_idx").on(t.tenantId),
  index("crm_users_email_idx").on(t.tenantId, t.email),
]);

export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#6366f1"),
  maxMembers: int("maxMembers").default(50),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("teams_tenant_idx").on(t.tenantId)]);

export const teamMembers = mysqlTable("team_members", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId").notNull(),
  teamId: int("teamId").notNull(),
  role: mysqlEnum("role", ["member", "leader"]).default("member").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("tm_tenant_idx").on(t.tenantId),
  index("tm_team_idx").on(t.teamId),
  index("tm_user_idx").on(t.userId),
]);

// ════════════════════════════════════════════════════════════
// DISTRIBUTION RULES (Auto-assignment strategies)
// ════════════════════════════════════════════════════════════

export const distributionRules = mysqlTable("distribution_rules", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  strategy: mysqlEnum("strategy", ["round_robin", "least_busy", "manual", "team_round_robin"]).default("round_robin").notNull(),
  teamId: int("teamId"),
  isActive: boolean("isActive").default(true).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  priority: int("priority").default(0).notNull(),
  // Config JSON: { maxOpenPerAgent, businessHoursOnly, businessHoursStart, businessHoursEnd, businessHoursDays, businessHoursTimezone }
  configJson: json("configJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("dr_tenant_idx").on(t.tenantId),
  index("dr_tenant_active_idx").on(t.tenantId, t.isActive),
]);

export const roles = mysqlTable("crm_roles", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  slug: varchar("slug", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  isSystemRole: boolean("isSystemRole").default(false).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("roles_tenant_idx").on(t.tenantId)]);

export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  description: text("description"),
});

export const rolePermissions = mysqlTable("role_permissions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  roleId: int("roleId").notNull(),
  permissionId: int("permissionId").notNull(),
}, (t) => [index("rp_tenant_idx").on(t.tenantId)]);

export const userRoles = mysqlTable("user_roles", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId").notNull(),
  roleId: int("roleId").notNull(),
}, (t) => [index("ur_tenant_idx").on(t.tenantId)]);

export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  hashedKey: varchar("hashedKey", { length: 512 }).notNull(),
  scopesJson: json("scopesJson"),
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("ak_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// M2 — CRM (Contacts, Deals, Pipelines)
// ════════════════════════════════════════════════════════════

export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  type: mysqlEnum("type", ["person", "company"]).default("person").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  phoneE164: varchar("phoneE164", { length: 32 }),
  phoneDigits: varchar("phoneDigits", { length: 32 }),
  phoneLast11: varchar("phoneLast11", { length: 16 }),
  docId: varchar("docId", { length: 64 }),
  tagsJson: json("tagsJson"),
  source: varchar("source", { length: 64 }),
  lifecycleStage: mysqlEnum("lifecycleStage", ["lead", "prospect", "customer", "churned"]).default("lead").notNull(),
  ownerUserId: int("ownerUserId"),
  teamId: int("teamId"),
  visibilityScope: mysqlEnum("visibilityScope", ["personal", "team", "global"]).default("global").notNull(),
  consentStatus: mysqlEnum("consentStatus", ["pending", "granted", "revoked"]).default("pending").notNull(),
  notes: text("notes"),
  // Strategic classification (9 audiences)
  stageClassification: varchar("stageClassification", { length: 32 }).default("desconhecido").notNull(),
  // Referral window tracking
  referralWindowStart: timestamp("referralWindowStart"),
  referralCount: int("referralCount").default(0).notNull(),
  // Purchase tracking
  lastPurchaseAt: timestamp("lastPurchaseAt"),
  totalPurchases: int("totalPurchases").default(0).notNull(),
  totalSpentCents: bigint("totalSpentCents", { mode: "number" }).default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
  deletedAt: timestamp("deletedAt"),
}, (t) => [
  index("contacts_tenant_idx").on(t.tenantId),
  index("contacts_owner_idx").on(t.tenantId, t.ownerUserId),
  index("contacts_classification_idx").on(t.tenantId, t.stageClassification),
]);

export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  primaryContactId: int("primaryContactId"),
  ownerUserId: int("ownerUserId"),
  teamId: int("teamId"),
  visibilityScope: mysqlEnum("visibilityScope", ["personal", "team", "global"]).default("global").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
}, (t) => [index("accounts_tenant_idx").on(t.tenantId)]);

export const pipelines = mysqlTable("pipelines", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 32 }),
  pipelineType: mysqlEnum("pipelineType", ["sales", "post_sale", "support", "custom"]).default("sales").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  isArchived: boolean("isArchived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("pipelines_tenant_idx").on(t.tenantId)]);

export const pipelineAutomations = mysqlTable("pipeline_automations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sourcePipelineId: int("sourcePipelineId").notNull(),
  triggerEvent: mysqlEnum("triggerEvent", ["deal_won", "deal_lost", "stage_reached"]).default("deal_won").notNull(),
  triggerStageId: int("triggerStageId"),
  targetPipelineId: int("targetPipelineId").notNull(),
  targetStageId: int("targetStageId").notNull(),
  copyProducts: boolean("copyProducts").default(true).notNull(),
  copyParticipants: boolean("copyParticipants").default(true).notNull(),
  copyCustomFields: boolean("copyCustomFields").default(true).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("pa_tenant_idx").on(t.tenantId),
  index("pa_source_idx").on(t.tenantId, t.sourcePipelineId),
]);

export const pipelineStages = mysqlTable("pipeline_stages", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  pipelineId: int("pipelineId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  color: varchar("color", { length: 32 }),
  orderIndex: int("orderIndex").notNull(),
  probabilityDefault: int("probabilityDefault").default(0),
  isWon: boolean("isWon").default(false).notNull(),
  isLost: boolean("isLost").default(false).notNull(),
  coolingEnabled: boolean("coolingEnabled").default(false).notNull(),
  coolingDays: int("coolingDays").default(3),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("ps_tenant_pipeline_idx").on(t.tenantId, t.pipelineId)]);

export const deals = mysqlTable("deals", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  contactId: int("contactId"),
  accountId: int("accountId"),
  pipelineId: int("pipelineId").notNull(),
  stageId: int("stageId").notNull(),
  valueCents: bigint("valueCents", { mode: "number" }).default(0),
  currency: varchar("currency", { length: 3 }).default("BRL"),
  probability: int("probability").default(0),
  status: mysqlEnum("status", ["open", "won", "lost"]).default("open").notNull(),
  expectedCloseAt: timestamp("expectedCloseAt"),
  ownerUserId: int("ownerUserId"),
  teamId: int("teamId"),
  visibilityScope: mysqlEnum("visibilityScope", ["personal", "team", "global"]).default("global").notNull(),
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
  waConversationId: int("waConversationId"),
  lossReasonId: int("lossReasonId"),
  lossNotes: text("lossNotes"),
  boardingDate: timestamp("boardingDate"),
  returnDate: timestamp("returnDate"),
  deletedAt: timestamp("deletedAt"),
}, (t) => [
  index("deals_tenant_pipeline_idx").on(t.tenantId, t.pipelineId, t.stageId),
  index("deals_tenant_status_idx").on(t.tenantId, t.status, t.lastActivityAt),
  index("deals_tenant_owner_idx").on(t.tenantId, t.ownerUserId),
  index("idx_deals_wa_conv").on(t.waConversationId),
]);

// ═══════════════════════════════════════
// TASK AUTOMATIONS — Regras de criação automática de tarefas por etapa
// ═══════════════════════════════════════
export const taskAutomations = mysqlTable("task_automations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  pipelineId: int("pipelineId").notNull(),
  stageId: int("stageId").notNull(),
  taskTitle: varchar("taskTitle", { length: 255 }).notNull(),
  taskDescription: text("taskDescription"),
  taskType: mysqlEnum("taskType", ["whatsapp", "phone", "email", "video", "task"]).default("task").notNull(),
  // Referência de prazo: "current_date", "boarding_date", "return_date"
  deadlineReference: mysqlEnum("deadlineReference", ["current_date", "boarding_date", "return_date"]).default("current_date").notNull(),
  // Offset em dias: positivo = depois, negativo = antes
  deadlineOffsetDays: int("deadlineOffsetDays").default(0).notNull(),
  // Hora do dia para a tarefa (ex: "09:00")
  deadlineTime: varchar("deadlineTime", { length: 5 }).default("09:00").notNull(),
  // Atribuir a quem? null = dono do deal
  assignToOwner: boolean("assignToOwner").default(true).notNull(),
  assignToUserIds: json("assignToUserIds").$type<number[]>(),
  isActive: boolean("isActive").default(true).notNull(),
  orderIndex: int("orderIndex").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("task_auto_tenant_pipeline_idx").on(t.tenantId, t.pipelineId),
  index("task_auto_tenant_stage_idx").on(t.tenantId, t.stageId),
]);

export const dealParticipants = mysqlTable("deal_participants", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  dealId: int("dealId").notNull(),
  contactId: int("contactId").notNull(),
  role: mysqlEnum("role", ["decision_maker", "traveler", "payer", "companion", "other"]).default("traveler").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("dp_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// PRODUCT CATALOG (Catálogo de Produtos Turísticos)
// ════════════════════════════════════════════════════════════

export const productCategories = mysqlTable("product_categories", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  icon: varchar("icon", { length: 64 }),
  color: varchar("color", { length: 32 }),
  parentId: int("parentId"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("pc_tenant_idx").on(t.tenantId),
]);

export const productCatalog = mysqlTable("product_catalog", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  categoryId: int("categoryId"),
  productType: mysqlEnum("productType", ["flight", "hotel", "tour", "transfer", "insurance", "cruise", "visa", "package", "other"]).default("other").notNull(),
  basePriceCents: bigint("basePriceCents", { mode: "number" }).default(0).notNull(),
  costPriceCents: bigint("costPriceCents", { mode: "number" }).default(0),
  currency: varchar("currency", { length: 3 }).default("BRL"),
  supplier: varchar("supplier", { length: 255 }),
  destination: varchar("destination", { length: 255 }),
  duration: varchar("duration", { length: 128 }),
  imageUrl: text("imageUrl"),
  sku: varchar("sku", { length: 64 }),
  isActive: boolean("isActive").default(true).notNull(),
  detailsJson: json("detailsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("pcat_tenant_idx").on(t.tenantId),
  index("pcat_tenant_type_idx").on(t.tenantId, t.productType),
  index("pcat_tenant_cat_idx").on(t.tenantId, t.categoryId),
  index("pcat_tenant_active_idx").on(t.tenantId, t.isActive),
]);

// ════════════════════════════════════════════════════════════
// DEAL ITEMS (Itens da Negociação — referência ao Catálogo)
// ════════════════════════════════════════════════════════════

export const dealProducts = mysqlTable("deal_products", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  dealId: int("dealId").notNull(),
  productId: int("productId").notNull(),               // FK obrigatória → product_catalog.id
  name: varchar("name", { length: 255 }).notNull(),     // snapshot do nome no momento da adição
  description: text("description"),                      // snapshot da descrição
  category: mysqlEnum("category", ["flight", "hotel", "tour", "transfer", "insurance", "cruise", "visa", "other"]).default("other").notNull(),
  quantity: int("quantity").default(1).notNull(),
  unitPriceCents: bigint("unitPriceCents", { mode: "number" }).default(0).notNull(),  // snapshot do preço base
  discountCents: bigint("discountCents", { mode: "number" }).default(0),
  finalPriceCents: bigint("finalPriceCents", { mode: "number" }).default(0),          // (qty * unit) - discount
  currency: varchar("currency", { length: 3 }).default("BRL"),
  supplier: varchar("supplier", { length: 255 }),
  checkIn: timestamp("checkIn"),
  checkOut: timestamp("checkOut"),
  catalogProductId: int("catalogProductId"),              // mantido para compatibilidade (deprecated)
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("dp_prod_tenant_deal_idx").on(t.tenantId, t.dealId),
  index("dp_prod_product_idx").on(t.productId),
  index("dp_prod_catalog_idx").on(t.catalogProductId),
]);

// ════════════════════════════════════════════════════════════
// DEAL HISTORY (Histórico de Movimentações)
// ════════════════════════════════════════════════════════════

export const dealHistory = mysqlTable("deal_history", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  dealId: int("dealId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  description: text("description").notNull(),
  fromStageId: int("fromStageId"),
  toStageId: int("toStageId"),
  fromStageName: varchar("fromStageName", { length: 128 }),
  toStageName: varchar("toStageName", { length: 128 }),
  fieldChanged: varchar("fieldChanged", { length: 64 }),
  oldValue: text("oldValue"),
  newValue: text("newValue"),
  actorUserId: int("actorUserId"),
  actorName: varchar("actorName", { length: 255 }),
  metadataJson: json("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("dh_tenant_deal_idx").on(t.tenantId, t.dealId),
]);

// ════════════════════════════════════════════════════════════
// TRIPS (Pós-venda / M2 + M4)
// ════════════════════════════════════════════════════════════

export const trips = mysqlTable("trips", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  dealId: int("dealId"),
  status: mysqlEnum("status", ["planning", "confirmed", "in_progress", "completed", "cancelled"]).default("planning").notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  destinationSummary: text("destinationSummary"),
  totalValueCents: bigint("totalValueCents", { mode: "number" }).default(0),
  currency: varchar("currency", { length: 3 }).default("BRL"),
  documentsStatus: mysqlEnum("documentsStatus", ["pending", "partial", "complete"]).default("pending").notNull(),
  ownerUserId: int("ownerUserId"),
  teamId: int("teamId"),
  visibilityScope: mysqlEnum("visibilityScope", ["personal", "team", "global"]).default("global").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
}, (t) => [index("trips_tenant_idx").on(t.tenantId)]);

export const tripItems = mysqlTable("trip_items", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  tripId: int("tripId").notNull(),
  type: mysqlEnum("type", ["flight", "hotel", "tour", "transfer", "insurance", "other"]).default("other").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  supplier: varchar("supplier", { length: 255 }),
  detailsJson: json("detailsJson"),
  priceCents: bigint("priceCents", { mode: "number" }).default(0),
  currency: varchar("currency", { length: 3 }).default("BRL"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("ti_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// ACTIVITIES (Tasks, Notes, Attachments)
// ════════════════════════════════════════════════════════════

export const tasks = mysqlTable("crm_tasks", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  entityType: varchar("entityType", { length: 32 }).notNull(),
  entityId: int("entityId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  taskType: varchar("taskType", { length: 32 }).default("task"),
  dueAt: timestamp("dueAt"),
  status: mysqlEnum("status", ["pending", "in_progress", "done", "cancelled"]).default("pending").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  assignedToUserId: int("assignedToUserId"),
  createdByUserId: int("createdByUserId"),
  description: text("description"),
  googleEventId: varchar("googleEventId", { length: 512 }),
  googleCalendarSynced: boolean("googleCalendarSynced").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("tasks_tenant_idx").on(t.tenantId)]);

export const taskAssignees = mysqlTable("task_assignees", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  tenantId: int("tenantId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("ta_task_idx").on(t.taskId), index("ta_user_idx").on(t.userId)]);

export const crmNotes = mysqlTable("crm_notes", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  entityType: varchar("entityType", { length: 32 }).notNull(),
  entityId: int("entityId").notNull(),
  body: text("body"),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("notes_tenant_idx").on(t.tenantId)]);

export const crmAttachments = mysqlTable("crm_attachments", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  entityType: varchar("entityType", { length: 32 }).notNull(),
  entityId: int("entityId").notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  sizeBytes: int("sizeBytes"),
  uploadedByUserId: int("uploadedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("attach_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// M1 — INBOX OMNICHANNEL
// ════════════════════════════════════════════════════════════

export const channels = mysqlTable("channels", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  type: mysqlEnum("type", ["whatsapp", "instagram", "email", "webchat"]).default("whatsapp").notNull(),
  connectionId: varchar("connectionId", { length: 128 }),
  name: varchar("name", { length: 128 }),
  status: mysqlEnum("status", ["active", "inactive", "error"]).default("inactive").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("channels_tenant_idx").on(t.tenantId)]);

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  channelId: int("channelId").notNull(),
  providerThreadId: varchar("providerThreadId", { length: 256 }),
  contactId: int("contactId"),
  dealId: int("dealId"),
  tripId: int("tripId"),
  status: mysqlEnum("status", ["open", "pending", "closed"]).default("open").notNull(),
  assignedToUserId: int("assignedToUserId"),
  assignedTeamId: int("assignedTeamId"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  lastMessageAt: timestamp("lastMessageAt"),
  slaDueAt: timestamp("slaDueAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("conv_tenant_channel_idx").on(t.tenantId, t.channelId, t.lastMessageAt),
  index("conv_tenant_status_idx").on(t.tenantId, t.status),
]);

export const inboxMessages = mysqlTable("inbox_messages", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  conversationId: int("conversationId").notNull(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).default("inbound").notNull(),
  providerMessageId: varchar("providerMessageId", { length: 256 }),
  senderLabel: varchar("senderLabel", { length: 128 }),
  bodyText: text("bodyText"),
  bodyJson: json("bodyJson"),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  readAt: timestamp("readAt"),
  status: mysqlEnum("status", ["pending", "sent", "delivered", "read", "failed"]).default("pending").notNull(),
  errorJson: json("errorJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("im_tenant_conv_idx").on(t.tenantId, t.conversationId, t.sentAt)]);

// ════════════════════════════════════════════════════════════
// M3 — PROPOSTAS
// ════════════════════════════════════════════════════════════

export const proposalTemplates = mysqlTable("proposal_templates", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  htmlBody: text("htmlBody"),
  variablesJson: json("variablesJson"),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("pt_tenant_idx").on(t.tenantId)]);

export const proposals = mysqlTable("proposals", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  dealId: int("dealId").notNull(),
  version: int("version").default(1).notNull(),
  status: mysqlEnum("status", ["draft", "sent", "viewed", "accepted", "rejected", "expired"]).default("draft").notNull(),
  totalCents: bigint("totalCents", { mode: "number" }).default(0),
  currency: varchar("currency", { length: 3 }).default("BRL"),
  pdfUrl: text("pdfUrl"),
  sentAt: timestamp("sentAt"),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
}, (t) => [index("proposals_tenant_idx").on(t.tenantId)]);

export const proposalItems = mysqlTable("proposal_items", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  proposalId: int("proposalId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  qty: int("qty").default(1).notNull(),
  unitPriceCents: bigint("unitPriceCents", { mode: "number" }).default(0),
  totalCents: bigint("totalCents", { mode: "number" }).default(0),
  metaJson: json("metaJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("pi_tenant_idx").on(t.tenantId)]);

export const proposalSignatures = mysqlTable("proposal_signatures", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  proposalId: int("proposalId").notNull(),
  signerName: varchar("signerName", { length: 255 }).notNull(),
  signerEmail: varchar("signerEmail", { length: 320 }),
  signedAt: timestamp("signedAt"),
  ip: varchar("ip", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("psig_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// M4 — PORTAL DO CLIENTE
// ════════════════════════════════════════════════════════════

export const portalUsers = mysqlTable("portal_users", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  contactId: int("contactId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  authMethod: varchar("authMethod", { length: 32 }).default("magic_link"),
  passwordHash: varchar("passwordHash", { length: 512 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("pu_tenant_idx").on(t.tenantId)]);

export const portalSessions = mysqlTable("portal_sessions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  portalUserId: int("portalUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
}, (t) => [index("ps_tenant_idx").on(t.tenantId)]);

export const portalTickets = mysqlTable("portal_tickets", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  contactId: int("contactId").notNull(),
  tripId: int("tripId"),
  conversationId: int("conversationId"),
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"]).default("open").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("pt_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// M5 — GESTÃO
// ════════════════════════════════════════════════════════════

export const goals = mysqlTable("goals", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  teamId: int("teamId"),
  userId: int("userId"),
  metricKey: varchar("metricKey", { length: 64 }).notNull(),
  targetValue: bigint("targetValue", { mode: "number" }).default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("goals_tenant_idx").on(t.tenantId)]);

export const performanceSnapshots = mysqlTable("performance_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  entityType: varchar("entityType", { length: 32 }).notNull(),
  entityId: int("entityId").notNull(),
  metricsJson: json("metricsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("perf_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// M6 — INSIGHTS / ANALYTICS
// ════════════════════════════════════════════════════════════

export const metricsDaily = mysqlTable("metrics_daily", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  date: timestamp("date").notNull(),
  metricKey: varchar("metricKey", { length: 64 }).notNull(),
  valueNum: bigint("valueNum", { mode: "number" }).default(0),
  dimensionsJson: json("dimensionsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("md_tenant_idx").on(t.tenantId)]);

export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["active", "resolved", "dismissed"]).default("active").notNull(),
  entityType: varchar("entityType", { length: 32 }),
  entityId: int("entityId"),
  firedAt: timestamp("firedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
  payloadJson: json("payloadJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("alerts_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// M7 — ACADEMY
// ════════════════════════════════════════════════════════════

export const courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  coverUrl: text("coverUrl"),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("courses_tenant_idx").on(t.tenantId)]);

export const lessons = mysqlTable("lessons", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  courseId: int("courseId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  contentUrl: text("contentUrl"),
  contentBody: text("contentBody"),
  orderIndex: int("orderIndex").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("lessons_tenant_idx").on(t.tenantId)]);

export const enrollments = mysqlTable("enrollments", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId").notNull(),
  courseId: int("courseId").notNull(),
  status: mysqlEnum("status", ["enrolled", "in_progress", "completed"]).default("enrolled").notNull(),
  progressJson: json("progressJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("enroll_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// M8 — INTEGRATION HUB
// ════════════════════════════════════════════════════════════

export const integrations = mysqlTable("integrations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["active", "inactive", "error"]).default("inactive").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("integ_tenant_idx").on(t.tenantId)]);

export const integrationConnections = mysqlTable("integration_connections", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  integrationId: int("integrationId").notNull(),
  connectionId: varchar("connectionId", { length: 128 }),
  status: mysqlEnum("status", ["connected", "disconnected", "error"]).default("disconnected").notNull(),
  lastHealthAt: timestamp("lastHealthAt"),
  metaJson: json("metaJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("ic_tenant_idx").on(t.tenantId)]);

export const integrationCredentials = mysqlTable("integration_credentials", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  encryptedSecret: text("encryptedSecret").notNull(),
  rotatedAt: timestamp("rotatedAt"),
  status: mysqlEnum("status", ["active", "revoked"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("icred_tenant_idx").on(t.tenantId)]);

export const webhooks = mysqlTable("webhooks", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  endpoint: text("endpoint").notNull(),
  secretHash: varchar("secretHash", { length: 512 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("wh_tenant_idx").on(t.tenantId)]);

export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  attempts: int("attempts").default(0).notNull(),
  nextRunAt: timestamp("nextRunAt"),
  payloadJson: json("payloadJson"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("jobs_tenant_idx").on(t.tenantId)]);

export const jobDlq = mysqlTable("job_dlq", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  jobId: int("jobId").notNull(),
  failedAt: timestamp("failedAt").defaultNow().notNull(),
  errorJson: json("errorJson"),
  payloadJson: json("payloadJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("dlq_tenant_idx").on(t.tenantId)]);

// ════════════════════════════════════════════════════════════
// EVENT LOG (Transversal — Auditoria)
// ════════════════════════════════════════════════════════════

export const eventLog = mysqlTable("event_log", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  actorUserId: int("actorUserId"),
  actorType: mysqlEnum("actorType", ["user", "system", "api", "webhook"]).default("user").notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId"),
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

export const customFields = mysqlTable("custom_fields", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  entity: mysqlEnum("entity", ["contact", "deal", "account", "trip"]).default("contact").notNull(),
  name: varchar("name", { length: 128 }).notNull(), // slug/key
  label: varchar("label", { length: 255 }).notNull(), // display label
  fieldType: mysqlEnum("fieldType", ["text", "number", "date", "select", "multiselect", "checkbox", "textarea", "email", "phone", "url", "currency"]).default("text").notNull(),
  optionsJson: json("optionsJson"), // for select/multiselect: ["opt1","opt2",...]
  defaultValue: text("defaultValue"),
  placeholder: varchar("placeholder", { length: 255 }),
  isRequired: boolean("isRequired").default(false).notNull(),
  isVisibleOnForm: boolean("isVisibleOnForm").default(true).notNull(),
  isVisibleOnProfile: boolean("isVisibleOnProfile").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  groupName: varchar("groupName", { length: 128 }), // optional grouping
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("cf_tenant_entity_idx").on(t.tenantId, t.entity),
  index("cf_tenant_sort_idx").on(t.tenantId, t.entity, t.sortOrder),
]);

export const customFieldValues = mysqlTable("custom_field_values", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  fieldId: int("fieldId").notNull(),
  entityType: mysqlEnum("entityType", ["contact", "deal", "account", "trip"]).default("contact").notNull(),
  entityId: int("entityId").notNull(),
  value: text("value"), // stored as string, parsed by fieldType
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
export type Trip = typeof trips.$inferSelect;
export type TripItem = typeof tripItems.$inferSelect;
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

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
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

export const aiConversationAnalyses = mysqlTable("ai_conversation_analyses", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  dealId: int("dealId").notNull(),
  contactId: int("contactId"),
  analyzedBy: int("analyzedBy"), // userId who triggered analysis
  overallScore: int("overallScore"), // 0-100
  toneScore: int("toneScore"), // 0-100
  responsivenessScore: int("responsivenessScore"), // 0-100
  clarityScore: int("clarityScore"), // 0-100
  closingScore: int("closingScore"), // 0-100
  summary: text("summary"),
  strengths: json("strengths"), // string[]
  improvements: json("improvements"), // string[]
  suggestions: json("suggestions"), // string[]
  missedOpportunities: json("missedOpportunities"), // string[]
  responseTimeAvg: varchar("responseTimeAvg", { length: 64 }), // e.g. "15 min"
  messagesAnalyzed: int("messagesAnalyzed").default(0),
  rawAnalysis: text("rawAnalysis"), // full LLM response for debugging
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("ai_analysis_tenant_idx").on(t.tenantId),
  index("ai_analysis_deal_idx").on(t.tenantId, t.dealId),
]);
export type AiConversationAnalysis = typeof aiConversationAnalyses.$inferSelect;
export type InsertAiConversationAnalysis = typeof aiConversationAnalyses.$inferInsert;


// ════════════════════════════════════════════════════════════
// CONVERSATION IDENTITY RESOLVER
// ════════════════════════════════════════════════════════════

export const waConversations = mysqlTable("wa_conversations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(1),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  contactId: int("contactId"),
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
  unreadCount: int("unreadCount").default(0),
  status: mysqlEnum("status", ["open", "pending", "resolved", "closed"]).default("open").notNull(),
  contactPushName: varchar("contactPushName", { length: 128 }),
  mergedIntoId: int("mergedIntoId"),
  // Helpdesk fields (denormalized from conversation_assignments)
  assignedUserId: int("assignedUserId"),
  assignedTeamId: int("assignedTeamId"),
  queuedAt: timestamp("queuedAt"),
  firstResponseAt: timestamp("firstResponseAt"),
  slaDeadlineAt: timestamp("slaDeadlineAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_wc_tenant_session").on(t.tenantId, t.sessionId, t.lastMessageAt),
  index("idx_wc_tenant_contact").on(t.tenantId, t.contactId),
  index("idx_wc_tenant_jid").on(t.tenantId, t.sessionId, t.remoteJid),
  index("idx_wc_phone").on(t.tenantId, t.phoneE164),
  index("idx_wc_merged").on(t.mergedIntoId),
  index("idx_wc_assigned_user").on(t.tenantId, t.assignedUserId),
  index("idx_wc_queued").on(t.tenantId, t.queuedAt),
]);

export const waIdentities = mysqlTable("wa_identities", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(1),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  contactId: int("contactId"),
  remoteJid: varchar("remoteJid", { length: 128 }),
  waId: varchar("waId", { length: 128 }),
  phoneE164: varchar("phoneE164", { length: 32 }),
  confidenceScore: int("confidenceScore").default(60),
  firstSeenAt: timestamp("firstSeenAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_wi_tenant_session").on(t.tenantId, t.sessionId),
  index("idx_wi_contact").on(t.tenantId, t.contactId),
  index("idx_wi_phone").on(t.tenantId, t.phoneE164),
]);

export const waAuditLog = mysqlTable("wa_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(1),
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

export const leadEventLog = mysqlTable("lead_event_log", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(1),
  type: varchar("type", { length: 64 }).notNull().default("inbound_lead"),
  source: varchar("source", { length: 64 }).notNull(),
  dedupeKey: varchar("dedupeKey", { length: 255 }).notNull(),
  payload: json("payload"),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  error: text("error"),
  dealId: int("dealId"),
  contactId: int("contactId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_lel_tenant_source").on(t.tenantId, t.source, t.createdAt),
  index("idx_lel_tenant_status").on(t.tenantId, t.status, t.createdAt),
]);

export const metaIntegrationConfig = mysqlTable("meta_integration_config", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(1),
  pageId: varchar("pageId", { length: 128 }),
  pageName: varchar("pageName", { length: 255 }),
  accessToken: text("accessToken"),
  appSecret: varchar("appSecret", { length: 255 }),
  verifyToken: varchar("verifyToken", { length: 128 }),
  formsJson: json("formsJson"),
  status: varchar("status", { length: 32 }).notNull().default("disconnected"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const webhookConfig = mysqlTable("webhook_config", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(1),
  webhookSecret: varchar("webhookSecret", { length: 128 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Tracking Script Tokens ─────────────────────────────

export const trackingTokens = mysqlTable("tracking_tokens", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(1),
  token: varchar("token", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull().default("Meu Site"),
  allowedDomains: json("allowedDomains"), // string[] — empty = allow all
  isActive: boolean("isActive").default(true).notNull(),
  lastSeenAt: timestamp("lastSeenAt"),
  totalLeads: int("totalLeads").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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

export const leadSources = mysqlTable("lead_sources", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(1),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }).default("#6366f1"),
  isActive: boolean("isActive").default(true).notNull(),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("ls_tenant_idx").on(t.tenantId),
  index("ls_tenant_active_idx").on(t.tenantId, t.isActive, t.isDeleted),
]);

export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(1),
  sourceId: int("sourceId"), // FK to lead_sources
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }).default("#8b5cf6"),
  isActive: boolean("isActive").default(true).notNull(),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("camp_tenant_idx").on(t.tenantId),
  index("camp_source_idx").on(t.sourceId),
  index("camp_tenant_active_idx").on(t.tenantId, t.isActive, t.isDeleted),
]);

// ════════════════════════════════════════════════════════════
// LOSS REASONS (Motivos de Perda de Venda)
// ════════════════════════════════════════════════════════════

export const lossReasons = mysqlTable("loss_reasons", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(1),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
  usageCount: int("usageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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

export const rdStationConfig = mysqlTable("rd_station_config", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(1),
  webhookToken: varchar("webhookToken", { length: 128 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  autoCreateDeal: boolean("autoCreateDeal").default(true).notNull(),
  defaultPipelineId: int("defaultPipelineId"),
  defaultStageId: int("defaultStageId"),
  totalLeadsReceived: int("totalLeadsReceived").default(0).notNull(),
  lastLeadReceivedAt: timestamp("lastLeadReceivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const rdStationWebhookLog = mysqlTable("rd_station_webhook_log", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().default(1),
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
  status: mysqlEnum("status", ["success", "failed", "duplicate"]).default("success").notNull(),
  dealId: int("dealId"),
  contactId: int("contactId"),
  error: text("error"),
  rawPayload: json("rawPayload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("rdlog_tenant_idx").on(t.tenantId),
  index("rdlog_status_idx").on(t.tenantId, t.status),
  index("rdlog_created_idx").on(t.tenantId, t.createdAt),
]);

export type RdStationConfig = typeof rdStationConfig.$inferSelect;
export type InsertRdStationConfig = typeof rdStationConfig.$inferInsert;
export type RdStationWebhookLog = typeof rdStationWebhookLog.$inferSelect;


// ════════════════════════════════════════════════════════════
// RD STATION FIELD MAPPINGS
// ════════════════════════════════════════════════════════════

export const rdFieldMappings = mysqlTable("rd_field_mappings", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  rdFieldKey: varchar("rdFieldKey", { length: 255 }).notNull(), // campo do RD Station (ex: "cf_interesse", "company", "job_title")
  rdFieldLabel: varchar("rdFieldLabel", { length: 255 }).notNull(), // label amigável do campo RD
  enturFieldType: mysqlEnum("enturFieldType", ["standard", "custom"]).default("custom").notNull(), // tipo: campo padrão ou personalizado
  enturFieldKey: varchar("enturFieldKey", { length: 255 }), // campo padrão do Entur (ex: "contact.email", "deal.utmSource") ou null se custom
  enturCustomFieldId: int("enturCustomFieldId"), // FK para custom_fields.id se for campo personalizado
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("rdfm_tenant_idx").on(t.tenantId),
  index("rdfm_rd_key_idx").on(t.tenantId, t.rdFieldKey),
]);
export type RdFieldMapping = typeof rdFieldMappings.$inferSelect;
export type InsertRdFieldMapping = typeof rdFieldMappings.$inferInsert;


// ════════════════════════════════════════════════════════════
// SUBSCRIPTIONS & BILLING
// ════════════════════════════════════════════════════════════

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  plan: mysqlEnum("plan", ["free", "pro", "enterprise"]).default("free").notNull(),
  status: mysqlEnum("status", ["active", "trialing", "past_due", "cancelled", "expired"]).default("trialing").notNull(),
  hotmartTransactionId: varchar("hotmartTransactionId", { length: 255 }),
  hotmartSubscriptionId: varchar("hotmartSubscriptionId", { length: 255 }),
  hotmartProductId: varchar("hotmartProductId", { length: 255 }),
  hotmartBuyerEmail: varchar("hotmartBuyerEmail", { length: 320 }),
  priceInCents: int("priceInCents").default(9700), // R$97,00
  trialStartedAt: timestamp("trialStartedAt"),
  trialEndsAt: timestamp("trialEndsAt"),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("sub_tenant_idx").on(t.tenantId),
  index("sub_hotmart_idx").on(t.hotmartSubscriptionId),
  index("sub_status_idx").on(t.status),
]);

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;


// ════════════════════════════════════════════════════════════
// USER PREFERENCES
// ════════════════════════════════════════════════════════════

export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tenantId: int("tenantId").notNull(),
  prefKey: varchar("prefKey", { length: 128 }).notNull(),
  prefValue: text("prefValue"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("up_user_tenant_idx").on(t.userId, t.tenantId),
  index("up_user_key_idx").on(t.userId, t.tenantId, t.prefKey),
]);
export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

// ═══════════════════════════════════════
// PASSWORD RESET TOKENS
// ═══════════════════════════════════════

export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
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

export const dateAutomations = mysqlTable("date_automations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  pipelineId: int("pipelineId").notNull(),
  // Campo de data de referência no deal
  dateField: mysqlEnum("dateField", ["boardingDate", "returnDate", "expectedCloseAt", "createdAt"]).notNull(),
  // Condição: "days_before" = N dias antes da data, "days_after" = N dias depois, "on_date" = no dia exato
  condition: mysqlEnum("condition", ["days_before", "days_after", "on_date"]).notNull(),
  // Número de dias (0 para "on_date")
  offsetDays: int("offsetDays").default(0).notNull(),
  // Etapa de origem (opcional: se null, aplica a qualquer etapa do pipeline)
  sourceStageId: int("sourceStageId"),
  // Etapa de destino
  targetStageId: int("targetStageId").notNull(),
  // Apenas mover deals com status específico (null = qualquer status)
  dealStatusFilter: mysqlEnum("dealStatusFilter", ["open", "won", "lost"]).default("open"),
  isActive: boolean("isActive").default(true).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("da_tenant_idx").on(t.tenantId),
  index("da_tenant_pipeline_idx").on(t.tenantId, t.pipelineId),
]);
export type DateAutomation = typeof dateAutomations.$inferSelect;
export type InsertDateAutomation = typeof dateAutomations.$inferInsert;


// ════════════════════════════════════════════════════════════
// WA CONTACTS (LID ↔ Phone mapping from Baileys contacts.upsert)
// ════════════════════════════════════════════════════════════

export const waContacts = mysqlTable("wa_contacts", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 100 }).notNull(),
  jid: varchar("jid", { length: 100 }).notNull(),           // Primary JID (could be @s.whatsapp.net or @lid)
  lid: varchar("lid", { length: 100 }),                       // LID format (@lid)
  phoneNumber: varchar("phoneNumber", { length: 100 }),       // Phone number (@s.whatsapp.net)
  pushName: varchar("pushName", { length: 255 }),             // Contact's self-set name
  savedName: varchar("savedName", { length: 255 }),           // Name saved in phone contacts
  verifiedName: varchar("verifiedName", { length: 255 }),     // Business verified name
  profilePictureUrl: text("profilePictureUrl"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("wac_session_jid_idx").on(t.sessionId, t.jid),
  index("wac_session_lid_idx").on(t.sessionId, t.lid),
  index("wac_session_phone_idx").on(t.sessionId, t.phoneNumber),
]);
export type WaContact = typeof waContacts.$inferSelect;


// ═══════════════════════════════════════
// MATRIZ RFV — Classificação Automática de Contatos
// ═══════════════════════════════════════

export const rfvAudienceEnum = mysqlEnum("audience_type", [
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

export const rfvFlagEnum = mysqlEnum("rfv_flag", [
  "none",
  "potencial_indicador",
  "risco_ex_cliente",
  "abordagem_nao_cliente",
]);

export const rfvContacts = mysqlTable("rfv_contacts", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  
  // Dados do contato
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  
  // Scores RFV
  vScore: bigint("vScore", { mode: "number" }).default(0).notNull(), // valor total comprado em centavos
  fScore: int("fScore").default(0).notNull(), // quantidade de compras
  rScore: int("rScore").default(9999).notNull(), // dias desde última compra
  
  // Classificação
  audienceType: varchar("audienceType", { length: 32 }).default("desconhecido").notNull(),
  rfvFlag: varchar("rfvFlag", { length: 32 }).default("none").notNull(),
  
  // Métricas
  totalAtendimentos: int("totalAtendimentos").default(0).notNull(),
  totalVendasGanhas: int("totalVendasGanhas").default(0).notNull(),
  totalVendasPerdidas: int("totalVendasPerdidas").default(0).notNull(),
  taxaConversao: decimal("taxaConversao", { precision: 5, scale: 2 }).default("0").notNull(),
  
  // Datas
  lastActionDate: timestamp("lastActionDate"),
  lastPurchaseAt: timestamp("lastPurchaseAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  
  // Referências
  contactId: int("contactId"), // link para contacts table (opcional)
  createdBy: int("createdBy"),
  
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

export const contactActionLogs = mysqlTable("contact_action_logs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  rfvContactId: int("rfvContactId").notNull(),
  actionType: varchar("actionType", { length: 64 }).notNull(), // "import", "recalc", "manual_edit", "csv_import"
  description: text("description"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
}, (t) => [
  index("cal_tenant_idx").on(t.tenantId),
  index("cal_rfv_contact_idx").on(t.rfvContactId),
]);

export type ContactActionLog = typeof contactActionLogs.$inferSelect;


// ════════════════════════════════════════════════════════════
// RFV FILTER SNAPSHOTS (for notification change detection)
// ════════════════════════════════════════════════════════════

export const rfvFilterSnapshots = mysqlTable("rfv_filter_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  filterKey: varchar("filterKey", { length: 64 }).notNull(), // e.g. potencial_ex_cliente
  previousCount: int("previousCount").default(0).notNull(),
  currentCount: int("currentCount").default(0).notNull(),
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

export const bulkCampaigns = mysqlTable("bulk_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 255 }),
  name: varchar("name", { length: 255 }).notNull(),
  messageTemplate: text("messageTemplate").notNull(),
  source: varchar("source", { length: 64 }).default("rfv").notNull(), // rfv, contacts, manual
  audienceFilter: varchar("audienceFilter", { length: 128 }), // which filter was active
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  intervalMs: int("intervalMs").default(3000).notNull(),
  totalContacts: int("totalContacts").default(0).notNull(),
  sentCount: int("sentCount").default(0).notNull(),
  failedCount: int("failedCount").default(0).notNull(),
  skippedCount: int("skippedCount").default(0).notNull(),
  deliveredCount: int("deliveredCount").default(0).notNull(),
  readCount: int("readCount").default(0).notNull(),
  status: mysqlEnum("status", ["running", "completed", "cancelled", "failed"]).default("running").notNull(),
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

export const bulkCampaignMessages = mysqlTable("bulk_campaign_messages", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  tenantId: int("tenantId").notNull(),
  contactId: int("contactId"),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 32 }),
  messageContent: text("messageContent"), // the actual interpolated message sent
  status: mysqlEnum("status", ["pending", "sending", "sent", "delivered", "read", "failed", "skipped"]).default("pending").notNull(),
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

export const googleCalendarTokens = mysqlTable("google_calendar_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tenantId: int("tenantId").notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  tokenType: varchar("tokenType", { length: 32 }).default("Bearer"),
  expiresAt: timestamp("expiresAt"),
  scope: text("scope"),
  calendarEmail: varchar("calendarEmail", { length: 320 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("gct_user_tenant_idx").on(t.userId, t.tenantId),
  index("gct_tenant_idx").on(t.tenantId),
]);

export type GoogleCalendarToken = typeof googleCalendarTokens.$inferSelect;
export type InsertGoogleCalendarToken = typeof googleCalendarTokens.$inferInsert;

// ════════════════════════════════════════════════════════════
// SESSION SHARING (Admin shares WhatsApp session with users)
// ════════════════════════════════════════════════════════════

export const sessionShares = mysqlTable("session_shares", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  sourceSessionId: varchar("sourceSessionId", { length: 128 }).notNull(),
  sourceUserId: int("sourceUserId").notNull(),
  targetUserId: int("targetUserId").notNull(),
  status: mysqlEnum("share_status", ["active", "revoked"]).default("active").notNull(),
  sharedBy: int("sharedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
export const conversationEvents = mysqlTable("conversation_events", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  waConversationId: int("waConversationId").notNull(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  eventType: mysqlEnum("eventType", [
    "created", "assigned", "transferred", "note", "resolved",
    "reopened", "queued", "sla_breach", "closed", "priority_changed"
  ]).notNull(),
  fromUserId: int("fromUserId"),
  toUserId: int("toUserId"),
  fromTeamId: int("fromTeamId"),
  toTeamId: int("toTeamId"),
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
export const internalNotes = mysqlTable("internal_notes", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  waConversationId: int("waConversationId").notNull(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  authorUserId: int("authorUserId").notNull(),
  content: text("content").notNull(),
  mentionedUserIds: json("mentionedUserIds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("in_tenant_conv_idx").on(t.tenantId, t.waConversationId, t.createdAt),
  index("in_author_idx").on(t.tenantId, t.authorUserId),
]);
export type InternalNote = typeof internalNotes.$inferSelect;
export type InsertInternalNote = typeof internalNotes.$inferInsert;

// ════════════════════════════════════════════════════════════
// HELPDESK — Quick Replies (message templates per team)
// ════════════════════════════════════════════════════════════
export const quickReplies = mysqlTable("quick_replies", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  teamId: int("teamId"),
  shortcut: varchar("shortcut", { length: 32 }).notNull(),
  title: varchar("title", { length: 128 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 64 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
export const aiIntegrations = mysqlTable("ai_integrations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  provider: mysqlEnum("provider", ["openai", "anthropic"]).notNull(),
  apiKey: text("apiKey").notNull(),
  defaultModel: varchar("defaultModel", { length: 128 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("ai_tenant_idx").on(t.tenantId),
  index("ai_tenant_provider_idx").on(t.tenantId, t.provider),
]);
export type AiIntegration = typeof aiIntegrations.$inferSelect;
export type InsertAiIntegration = typeof aiIntegrations.$inferInsert;
