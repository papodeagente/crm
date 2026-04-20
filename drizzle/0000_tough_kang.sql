CREATE TYPE "public"."actorType" AS ENUM('user', 'system', 'api', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."addon_type" AS ENUM('whatsapp_number', 'extra_user', 'extra_storage_gb');--> statement-breakpoint
CREATE TYPE "public"."ai_integrations_provider" AS ENUM('openai', 'anthropic');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('disconnected', 'billing_overdue', 'instance_error');--> statement-breakpoint
CREATE TYPE "public"."alerts_status" AS ENUM('active', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."assignmentMode" AS ENUM('specific_user', 'random_all', 'random_team');--> statement-breakpoint
CREATE TYPE "public"."audio_transcription_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."billingStatus" AS ENUM('active', 'trialing', 'past_due', 'restricted', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."bulk_campaign_messages_status" AS ENUM('pending', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."bulk_campaigns_status" AS ENUM('running', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('flight', 'hotel', 'tour', 'transfer', 'insurance', 'cruise', 'visa', 'other');--> statement-breakpoint
CREATE TYPE "public"."channel_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."channels_status" AS ENUM('active', 'inactive', 'error');--> statement-breakpoint
CREATE TYPE "public"."channels_type" AS ENUM('whatsapp', 'instagram', 'email', 'webchat');--> statement-breakpoint
CREATE TYPE "public"."condition" AS ENUM('days_before', 'days_after', 'on_date');--> statement-breakpoint
CREATE TYPE "public"."configType" AS ENUM('suggestion', 'summary', 'analysis');--> statement-breakpoint
CREATE TYPE "public"."consentStatus" AS ENUM('pending', 'granted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."contact_merges_status" AS ENUM('pending_review', 'confirmed', 'reverted');--> statement-breakpoint
CREATE TYPE "public"."contacts_type" AS ENUM('person', 'company');--> statement-breakpoint
CREATE TYPE "public"."contentType" AS ENUM('text', 'image', 'video', 'audio', 'document');--> statement-breakpoint
CREATE TYPE "public"."conversation_events_eventType" AS ENUM('created', 'assigned', 'transferred', 'note', 'resolved', 'reopened', 'queued', 'sla_breach', 'closed', 'priority_changed');--> statement-breakpoint
CREATE TYPE "public"."conversation_assignments_status" AS ENUM('open', 'pending', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."conversations_status" AS ENUM('open', 'pending', 'closed');--> statement-breakpoint
CREATE TYPE "public"."courses_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."crm_tasks_status" AS ENUM('pending', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."crm_user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."crm_users_status" AS ENUM('active', 'inactive', 'invited');--> statement-breakpoint
CREATE TYPE "public"."custom_msg_category" AS ENUM('primeiro_contato', 'reativacao', 'pedir_indicacao', 'receber_indicado', 'recuperacao_vendas', 'objecoes', 'outros');--> statement-breakpoint
CREATE TYPE "public"."dateField" AS ENUM('boardingDate', 'returnDate', 'expectedCloseAt', 'createdAt');--> statement-breakpoint
CREATE TYPE "public"."deadlineOffsetUnit" AS ENUM('minutes', 'hours', 'days');--> statement-breakpoint
CREATE TYPE "public"."deadlineReference" AS ENUM('current_date', 'boarding_date', 'return_date');--> statement-breakpoint
CREATE TYPE "public"."dealStatusFilter" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."deal_participants_role" AS ENUM('decision_maker', 'traveler', 'payer', 'companion', 'other');--> statement-breakpoint
CREATE TYPE "public"."deals_status" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."dedupeMatchType" AS ENUM('lead_id', 'email', 'phone', 'email_and_phone', 'manual_merge', 'new_contact');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."documentsStatus" AS ENUM('pending', 'partial', 'complete');--> statement-breakpoint
CREATE TYPE "public"."enrollments_status" AS ENUM('enrolled', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."entity" AS ENUM('contact', 'deal', 'company');--> statement-breakpoint
CREATE TYPE "public"."entityType" AS ENUM('contact', 'deal', 'company');--> statement-breakpoint
CREATE TYPE "public"."enturFieldType" AS ENUM('standard', 'custom');--> statement-breakpoint
CREATE TYPE "public"."fieldType" AS ENUM('text', 'number', 'date', 'select', 'multiselect', 'checkbox', 'textarea', 'email', 'phone', 'url', 'currency');--> statement-breakpoint
CREATE TYPE "public"."inbox_messages_status" AS ENUM('pending', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."integration_connections_status" AS ENUM('connected', 'disconnected', 'error');--> statement-breakpoint
CREATE TYPE "public"."integration_credentials_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."integrations_status" AS ENUM('active', 'inactive', 'error');--> statement-breakpoint
CREATE TYPE "public"."jobs_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."lifecycleStage" AS ENUM('lead', 'prospect', 'customer', 'churned', 'merged');--> statement-breakpoint
CREATE TYPE "public"."matchType" AS ENUM('lead_id', 'email', 'phone', 'email_and_phone', 'manual');--> statement-breakpoint
CREATE TYPE "public"."pipelineType" AS ENUM('sales', 'post_sale', 'support', 'custom');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'pro', 'enterprise', 'start', 'growth', 'scale');--> statement-breakpoint
CREATE TYPE "public"."portal_tickets_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."portal_users_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."productType" AS ENUM('flight', 'hotel', 'tour', 'transfer', 'insurance', 'cruise', 'visa', 'package', 'other');--> statement-breakpoint
CREATE TYPE "public"."proposals_status" AS ENUM('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."rd_station_webhook_log_status" AS ENUM('success', 'failed', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."audience_type" AS ENUM('desconhecido', 'seguidor', 'lead', 'oportunidade', 'nao_cliente', 'cliente_primeira_compra', 'cliente_recorrente', 'ex_cliente', 'indicado');--> statement-breakpoint
CREATE TYPE "public"."rfv_flag" AS ENUM('none', 'potencial_indicador', 'risco_ex_cliente', 'abordagem_nao_cliente');--> statement-breakpoint
CREATE TYPE "public"."ruleType" AS ENUM('whitelist', 'blacklist');--> statement-breakpoint
CREATE TYPE "public"."scheduled_messages_status" AS ENUM('pending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."scope" AS ENUM('user', 'company');--> statement-breakpoint
CREATE TYPE "public"."share_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."strategy" AS ENUM('round_robin', 'least_busy', 'manual', 'team_round_robin');--> statement-breakpoint
CREATE TYPE "public"."subscriptions_status" AS ENUM('active', 'trialing', 'past_due', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."targetEntity" AS ENUM('deal', 'contact', 'company');--> statement-breakpoint
CREATE TYPE "public"."taskType" AS ENUM('whatsapp', 'phone', 'email', 'video', 'task');--> statement-breakpoint
CREATE TYPE "public"."team_members_role" AS ENUM('member', 'leader');--> statement-breakpoint
CREATE TYPE "public"."tenant_addons_status" AS ENUM('active', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."tenants_status" AS ENUM('active', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."triggerEvent" AS ENUM('deal_won', 'deal_lost', 'stage_reached');--> statement-breakpoint
CREATE TYPE "public"."trip_items_type" AS ENUM('flight', 'hotel', 'tour', 'transfer', 'insurance', 'other');--> statement-breakpoint
CREATE TYPE "public"."trips_status" AS ENUM('planning', 'confirmed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."users_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."visibilityScope" AS ENUM('personal', 'team', 'global');--> statement-breakpoint
CREATE TYPE "public"."wa_conversations_status" AS ENUM('open', 'pending', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."webhooks_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_sessions_provider" AS ENUM('evolution', 'zapi');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_sessions_status" AS ENUM('connecting', 'connected', 'disconnected', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."zapi_instance_status" AS ENUM('active', 'pending', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"primaryContactId" integer,
	"ownerUserId" integer,
	"teamId" integer,
	"visibilityScope" "visibilityScope" DEFAULT 'global' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer,
	"updatedBy" integer
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionId" varchar(128),
	"eventType" varchar(64) NOT NULL,
	"description" text,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addon_offer_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"addon_type" "addon_type" NOT NULL,
	"hotmart_offer_code" varchar(100) NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_conversation_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"dealId" integer NOT NULL,
	"contactId" integer,
	"analyzedBy" integer,
	"overallScore" integer,
	"toneScore" integer,
	"responsivenessScore" integer,
	"clarityScore" integer,
	"closingScore" integer,
	"summary" text,
	"strengths" json,
	"improvements" json,
	"suggestions" json,
	"missedOpportunities" json,
	"responseTimeAvg" varchar(64),
	"messagesAnalyzed" integer DEFAULT 0,
	"rawAnalysis" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"provider" "ai_integrations_provider" NOT NULL,
	"apiKey" text NOT NULL,
	"defaultModel" varchar(128) NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_suggestion_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"userId" integer,
	"provider" varchar(32) NOT NULL,
	"model" varchar(128) NOT NULL,
	"intentClassified" varchar(32),
	"style" varchar(32) DEFAULT 'default',
	"durationMs" integer,
	"contextMessageCount" integer,
	"hasCrmContext" boolean DEFAULT false,
	"success" boolean DEFAULT true NOT NULL,
	"errorMessage" text,
	"wasEdited" boolean,
	"wasSent" boolean,
	"sendMethod" varchar(32),
	"partsCount" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_training_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"configType" "configType" NOT NULL,
	"instructions" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"updatedBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"type" varchar(64) NOT NULL,
	"status" "alerts_status" DEFAULT 'active' NOT NULL,
	"entityType" varchar(32),
	"entityId" integer,
	"firedAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp,
	"payloadJson" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"hashedKey" varchar(512) NOT NULL,
	"scopesJson" json,
	"lastUsedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_campaign_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"contactId" integer,
	"contactName" varchar(255) NOT NULL,
	"contactPhone" varchar(32),
	"messageContent" text,
	"status" "bulk_campaign_messages_status" DEFAULT 'pending' NOT NULL,
	"errorMessage" text,
	"sentAt" timestamp,
	"deliveredAt" timestamp,
	"readAt" timestamp,
	"waMessageId" varchar(256),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"userId" integer NOT NULL,
	"userName" varchar(255),
	"name" varchar(255) NOT NULL,
	"messageTemplate" text NOT NULL,
	"source" varchar(64) DEFAULT 'rfv' NOT NULL,
	"audienceFilter" varchar(128),
	"sessionId" varchar(128) NOT NULL,
	"intervalMs" integer DEFAULT 3000 NOT NULL,
	"totalContacts" integer DEFAULT 0 NOT NULL,
	"sentCount" integer DEFAULT 0 NOT NULL,
	"failedCount" integer DEFAULT 0 NOT NULL,
	"skippedCount" integer DEFAULT 0 NOT NULL,
	"deliveredCount" integer DEFAULT 0 NOT NULL,
	"readCount" integer DEFAULT 0 NOT NULL,
	"status" "bulk_campaigns_status" DEFAULT 'running' NOT NULL,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer DEFAULT 1 NOT NULL,
	"sourceId" integer,
	"name" varchar(255) NOT NULL,
	"color" varchar(7) DEFAULT '#8b5cf6',
	"isActive" boolean DEFAULT true NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_change_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"instanceId" varchar(128) NOT NULL,
	"previousPhone" varchar(32),
	"newPhone" varchar(32) NOT NULL,
	"detectedAt" timestamp DEFAULT now() NOT NULL,
	"previousChannelId" integer,
	"newChannelId" integer
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"type" "channels_type" DEFAULT 'whatsapp' NOT NULL,
	"connectionId" varchar(128),
	"name" varchar(128),
	"status" "channels_status" DEFAULT 'inactive' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbot_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionId" varchar(128) NOT NULL,
	"remoteJid" varchar(128) NOT NULL,
	"contactName" varchar(255),
	"ruleType" "ruleType" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbot_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionId" varchar(128) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"systemPrompt" text,
	"maxTokens" integer DEFAULT 500,
	"mode" varchar(32) DEFAULT 'all' NOT NULL,
	"respondGroups" boolean DEFAULT true NOT NULL,
	"respondPrivate" boolean DEFAULT true NOT NULL,
	"onlyWhenMentioned" boolean DEFAULT false NOT NULL,
	"triggerWords" text,
	"welcomeMessage" text,
	"awayMessage" text,
	"businessHoursEnabled" boolean DEFAULT false NOT NULL,
	"businessHoursStart" varchar(5) DEFAULT '09:00',
	"businessHoursEnd" varchar(5) DEFAULT '18:00',
	"businessHoursDays" varchar(32) DEFAULT '1,2,3,4,5',
	"businessHoursTimezone" varchar(64) DEFAULT 'America/Sao_Paulo',
	"replyDelay" integer DEFAULT 0,
	"contextMessageCount" integer DEFAULT 10,
	"rateLimitPerHour" integer DEFAULT 0,
	"rateLimitPerDay" integer DEFAULT 0,
	"temperature" numeric(3, 2) DEFAULT '0.70',
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chatbot_settings_sessionId_unique" UNIQUE("sessionId")
);
--> statement-breakpoint
CREATE TABLE "contact_action_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"rfvContactId" integer NOT NULL,
	"actionType" varchar(64) NOT NULL,
	"description" text,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer
);
--> statement-breakpoint
CREATE TABLE "contact_conversion_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"contactId" integer NOT NULL,
	"integrationSource" varchar(64) NOT NULL,
	"externalLeadId" varchar(255),
	"eventType" varchar(64) DEFAULT 'conversion' NOT NULL,
	"conversionIdentifier" varchar(512),
	"conversionName" varchar(512),
	"assetName" varchar(512),
	"assetType" varchar(64),
	"trafficSource" varchar(255),
	"utmSource" varchar(255),
	"utmMedium" varchar(255),
	"utmCampaign" varchar(512),
	"utmContent" varchar(512),
	"utmTerm" varchar(512),
	"formName" varchar(512),
	"landingPage" varchar(1024),
	"rawPayload" json,
	"receivedAt" timestamp DEFAULT now() NOT NULL,
	"dedupeMatchType" "dedupeMatchType" DEFAULT 'new_contact' NOT NULL,
	"matchedExistingContactId" integer,
	"mergeEventId" integer,
	"idempotencyKey" varchar(255) NOT NULL,
	"dealId" integer,
	"dealDecision" varchar(64),
	"dealDecisionReason" varchar(512),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_merges" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"primaryContactId" integer NOT NULL,
	"secondaryContactId" integer NOT NULL,
	"reason" varchar(512) NOT NULL,
	"matchType" "matchType" NOT NULL,
	"createdBy" varchar(128) DEFAULT 'system' NOT NULL,
	"status" "contact_merges_status" DEFAULT 'pending_review' NOT NULL,
	"snapshotBeforeMerge" json NOT NULL,
	"snapshotAfterMerge" json,
	"movedDealIds" json,
	"movedTaskIds" json,
	"movedConversionEventIds" json,
	"reversible" boolean DEFAULT true NOT NULL,
	"confirmedAt" timestamp,
	"confirmedBy" varchar(128),
	"revertedAt" timestamp,
	"revertedBy" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"type" "contacts_type" DEFAULT 'person' NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(320),
	"phone" varchar(32),
	"phoneE164" varchar(32),
	"phoneDigits" varchar(32),
	"phoneLast11" varchar(16),
	"docId" varchar(64),
	"tagsJson" json,
	"source" varchar(64),
	"lifecycleStage" "lifecycleStage" DEFAULT 'lead' NOT NULL,
	"mergedIntoContactId" integer,
	"ownerUserId" integer,
	"teamId" integer,
	"visibilityScope" "visibilityScope" DEFAULT 'global' NOT NULL,
	"consentStatus" "consentStatus" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"stageClassification" varchar(32) DEFAULT 'desconhecido' NOT NULL,
	"referralWindowStart" timestamp,
	"referralCount" integer DEFAULT 0 NOT NULL,
	"lastPurchaseAt" timestamp,
	"totalPurchases" integer DEFAULT 0 NOT NULL,
	"totalSpentCents" bigint DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer,
	"updatedBy" integer,
	"birthDate" varchar(10),
	"weddingDate" varchar(10),
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "conversation_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"sessionId" varchar(128) NOT NULL,
	"remoteJid" varchar(128) NOT NULL,
	"assignedUserId" integer,
	"assignedTeamId" integer,
	"status" "conversation_assignments_status" DEFAULT 'open' NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"lastAssignedAt" timestamp,
	"firstResponseAt" timestamp,
	"resolvedAt" timestamp,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"waConversationId" integer NOT NULL,
	"sessionId" varchar(128) NOT NULL,
	"remoteJid" varchar(128) NOT NULL,
	"eventType" "conversation_events_eventType" NOT NULL,
	"fromUserId" integer,
	"toUserId" integer,
	"fromTeamId" integer,
	"toTeamId" integer,
	"content" text,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_locks" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"waConversationId" integer NOT NULL,
	"agentId" integer NOT NULL,
	"agentName" varchar(128),
	"lockedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(20) DEFAULT '#6366f1' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"channelId" integer NOT NULL,
	"providerThreadId" varchar(256),
	"contactId" integer,
	"dealId" integer,
	"tripId" integer,
	"status" "conversations_status" DEFAULT 'open' NOT NULL,
	"assignedToUserId" integer,
	"assignedTeamId" integer,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"lastMessageAt" timestamp,
	"slaDueAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"coverUrl" text,
	"status" "courses_status" DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_appointment_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointmentId" integer NOT NULL,
	"userId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"startAt" timestamp NOT NULL,
	"endAt" timestamp NOT NULL,
	"allDay" boolean DEFAULT false NOT NULL,
	"location" varchar(500),
	"color" varchar(20) DEFAULT 'emerald',
	"dealId" integer,
	"contactId" integer,
	"isCompleted" boolean DEFAULT false NOT NULL,
	"completedAt" timestamp,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"entityType" varchar(32) NOT NULL,
	"entityId" integer NOT NULL,
	"fileUrl" text NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"mimeType" varchar(128),
	"sizeBytes" integer,
	"uploadedByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"entityType" varchar(32) NOT NULL,
	"entityId" integer NOT NULL,
	"body" text,
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(32),
	"passwordHash" varchar(512),
	"crm_user_role" "crm_user_role" DEFAULT 'user' NOT NULL,
	"status" "crm_users_status" DEFAULT 'invited' NOT NULL,
	"avatarUrl" text,
	"lastLoginAt" timestamp,
	"lastActiveAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer,
	"updatedBy" integer
);
--> statement-breakpoint
CREATE TABLE "custom_field_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"fieldId" integer NOT NULL,
	"entityType" "entityType" DEFAULT 'contact' NOT NULL,
	"entityId" integer NOT NULL,
	"value" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"entity" "entity" DEFAULT 'contact' NOT NULL,
	"name" varchar(128) NOT NULL,
	"label" varchar(255) NOT NULL,
	"fieldType" "fieldType" DEFAULT 'text' NOT NULL,
	"optionsJson" json,
	"defaultValue" text,
	"placeholder" varchar(255),
	"isRequired" boolean DEFAULT false NOT NULL,
	"isVisibleOnForm" boolean DEFAULT true NOT NULL,
	"isVisibleOnProfile" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"groupName" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"category" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"orderIndex" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "date_automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"pipelineId" integer NOT NULL,
	"dateField" "dateField" NOT NULL,
	"condition" "condition" NOT NULL,
	"offsetDays" integer DEFAULT 0 NOT NULL,
	"sourceStageId" integer,
	"targetStageId" integer NOT NULL,
	"dealStatusFilter" "dealStatusFilter" DEFAULT 'open',
	"isActive" boolean DEFAULT true NOT NULL,
	"lastRunAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"dealId" integer NOT NULL,
	"fileName" varchar(512) NOT NULL,
	"fileKey" varchar(1024) NOT NULL,
	"url" text NOT NULL,
	"mimeType" varchar(128),
	"sizeBytes" bigint DEFAULT 0,
	"description" varchar(512),
	"uploadedBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "deal_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"dealId" integer NOT NULL,
	"action" varchar(64) NOT NULL,
	"description" text NOT NULL,
	"fromStageId" integer,
	"toStageId" integer,
	"fromStageName" varchar(128),
	"toStageName" varchar(128),
	"fieldChanged" varchar(64),
	"oldValue" text,
	"newValue" text,
	"actorUserId" integer,
	"actorName" varchar(255),
	"metadataJson" json,
	"eventCategory" varchar(32),
	"eventSource" varchar(32),
	"contactId" integer,
	"dedupeKey" varchar(255),
	"occurredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"dealId" integer NOT NULL,
	"contactId" integer NOT NULL,
	"role" "deal_participants_role" DEFAULT 'traveler' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"dealId" integer NOT NULL,
	"productId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" "category" DEFAULT 'other' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unitPriceCents" bigint DEFAULT 0 NOT NULL,
	"discountCents" bigint DEFAULT 0,
	"finalPriceCents" bigint DEFAULT 0,
	"currency" varchar(3) DEFAULT 'BRL',
	"supplier" varchar(255),
	"checkIn" timestamp,
	"checkOut" timestamp,
	"catalogProductId" integer,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"contactId" integer,
	"accountId" integer,
	"pipelineId" integer NOT NULL,
	"stageId" integer NOT NULL,
	"valueCents" bigint DEFAULT 0,
	"currency" varchar(3) DEFAULT 'BRL',
	"probability" integer DEFAULT 0,
	"status" "deals_status" DEFAULT 'open' NOT NULL,
	"expectedCloseAt" timestamp,
	"ownerUserId" integer,
	"teamId" integer,
	"visibilityScope" "visibilityScope" DEFAULT 'global' NOT NULL,
	"channelOrigin" varchar(64),
	"leadSource" varchar(64),
	"utmSource" varchar(255),
	"utmMedium" varchar(255),
	"utmCampaign" varchar(255),
	"utmTerm" varchar(255),
	"utmContent" varchar(255),
	"utmJson" json,
	"rdCustomFields" json,
	"metaJson" json,
	"rawPayloadJson" json,
	"dedupeKey" varchar(255),
	"lastActivityAt" timestamp DEFAULT now(),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer,
	"updatedBy" integer,
	"waConversationId" integer,
	"lossReasonId" integer,
	"lossNotes" text,
	"boardingDate" timestamp,
	"returnDate" timestamp,
	"deletedAt" timestamp,
	"lastConversionAt" timestamp,
	"lastConversionSource" varchar(64),
	"lastWebhookName" varchar(255),
	"lastUtmSource" varchar(255),
	"lastUtmMedium" varchar(255),
	"lastUtmCampaign" varchar(255),
	"conversionCount" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distribution_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"strategy" "strategy" DEFAULT 'round_robin' NOT NULL,
	"teamId" integer,
	"isActive" boolean DEFAULT true NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"configJson" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"userId" integer NOT NULL,
	"courseId" integer NOT NULL,
	"status" "enrollments_status" DEFAULT 'enrolled' NOT NULL,
	"progressJson" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"occurredAt" timestamp DEFAULT now() NOT NULL,
	"actorUserId" integer,
	"actorType" "actorType" DEFAULT 'user' NOT NULL,
	"entityType" varchar(64) NOT NULL,
	"entityId" integer,
	"action" varchar(64) NOT NULL,
	"beforeJson" json,
	"afterJson" json,
	"metadataJson" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255),
	"scope" "scope" DEFAULT 'user' NOT NULL,
	"periodStart" timestamp NOT NULL,
	"periodEnd" timestamp NOT NULL,
	"teamId" integer,
	"userId" integer,
	"companyId" integer,
	"metricKey" varchar(64) NOT NULL,
	"targetValue" bigint DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"userId" integer NOT NULL,
	"googleEventId" varchar(512) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"startAt" timestamp NOT NULL,
	"endAt" timestamp NOT NULL,
	"allDay" boolean DEFAULT false,
	"location" varchar(500),
	"status" varchar(50) DEFAULT 'confirmed',
	"htmlLink" varchar(1000),
	"sourceCalendarId" varchar(500),
	"rawJson" json,
	"syncedAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_calendar_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"accessToken" text NOT NULL,
	"refreshToken" text,
	"tokenType" varchar(32) DEFAULT 'Bearer',
	"expiresAt" timestamp,
	"scope" text,
	"calendarEmail" varchar(320),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"conversationId" integer NOT NULL,
	"direction" "direction" DEFAULT 'inbound' NOT NULL,
	"providerMessageId" varchar(256),
	"senderLabel" varchar(128),
	"bodyText" text,
	"bodyJson" json,
	"sentAt" timestamp,
	"deliveredAt" timestamp,
	"readAt" timestamp,
	"status" "inbox_messages_status" DEFAULT 'pending' NOT NULL,
	"errorJson" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"integrationId" integer NOT NULL,
	"connectionId" varchar(128),
	"status" "integration_connections_status" DEFAULT 'disconnected' NOT NULL,
	"lastHealthAt" timestamp,
	"metaJson" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"provider" varchar(64) NOT NULL,
	"encryptedSecret" text NOT NULL,
	"rotatedAt" timestamp,
	"status" "integration_credentials_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"provider" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"status" "integrations_status" DEFAULT 'inactive' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"waConversationId" integer NOT NULL,
	"sessionId" varchar(128) NOT NULL,
	"remoteJid" varchar(128) NOT NULL,
	"authorUserId" integer NOT NULL,
	"content" text NOT NULL,
	"mentionedUserIds" json,
	"category" varchar(32) DEFAULT 'other' NOT NULL,
	"priority" varchar(16) DEFAULT 'normal' NOT NULL,
	"isCustomerGlobalNote" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_dlq" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"jobId" integer NOT NULL,
	"failedAt" timestamp DEFAULT now() NOT NULL,
	"errorJson" json,
	"payloadJson" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"type" varchar(64) NOT NULL,
	"status" "jobs_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"nextRunAt" timestamp,
	"payloadJson" json,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_event_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer DEFAULT 1 NOT NULL,
	"type" varchar(64) DEFAULT 'inbound_lead' NOT NULL,
	"source" varchar(64) NOT NULL,
	"dedupeKey" varchar(255) NOT NULL,
	"payload" json,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"error" text,
	"dealId" integer,
	"contactId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer DEFAULT 1 NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" varchar(7) DEFAULT '#6366f1',
	"isActive" boolean DEFAULT true NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"courseId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"contentUrl" text,
	"contentBody" text,
	"orderIndex" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loss_reasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer DEFAULT 1 NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"deletedAt" timestamp,
	"usageCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_integration_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer DEFAULT 1 NOT NULL,
	"pageId" varchar(128),
	"pageName" varchar(255),
	"accessToken" text,
	"appSecret" varchar(255),
	"verifyToken" varchar(128),
	"formsJson" json,
	"status" varchar(32) DEFAULT 'disconnected' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"date" timestamp NOT NULL,
	"metricKey" varchar(64) NOT NULL,
	"valueNum" bigint DEFAULT 0,
	"dimensionsJson" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"type" varchar(64) NOT NULL,
	"title" varchar(500) NOT NULL,
	"body" text,
	"entityType" varchar(64),
	"entityId" varchar(128),
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"token" varchar(128) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"periodStart" timestamp NOT NULL,
	"periodEnd" timestamp NOT NULL,
	"entityType" varchar(32) NOT NULL,
	"entityId" integer NOT NULL,
	"metricsJson" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(128) NOT NULL,
	"description" text,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "pipeline_automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"sourcePipelineId" integer NOT NULL,
	"triggerEvent" "triggerEvent" DEFAULT 'deal_won' NOT NULL,
	"triggerStageId" integer,
	"targetPipelineId" integer NOT NULL,
	"targetStageId" integer NOT NULL,
	"copyProducts" boolean DEFAULT true NOT NULL,
	"copyParticipants" boolean DEFAULT true NOT NULL,
	"copyCustomFields" boolean DEFAULT true NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"pipelineId" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"color" varchar(32),
	"orderIndex" integer NOT NULL,
	"probabilityDefault" integer DEFAULT 0,
	"isWon" boolean DEFAULT false NOT NULL,
	"isLost" boolean DEFAULT false NOT NULL,
	"coolingEnabled" boolean DEFAULT false NOT NULL,
	"coolingDays" integer DEFAULT 3,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"color" varchar(32),
	"pipelineType" "pipelineType" DEFAULT 'sales' NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"isArchived" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"billing_cycle" "billing_cycle" DEFAULT 'monthly' NOT NULL,
	"hotmart_offer_code" varchar(100),
	"description" text,
	"commercial_copy" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"feature_key" varchar(100) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"limit_value" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"portalUserId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "portal_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"contactId" integer NOT NULL,
	"tripId" integer,
	"conversationId" integer,
	"status" "portal_tickets_status" DEFAULT 'open' NOT NULL,
	"subject" varchar(255) NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"contactId" integer NOT NULL,
	"email" varchar(320) NOT NULL,
	"authMethod" varchar(32) DEFAULT 'magic_link',
	"passwordHash" varchar(512),
	"status" "portal_users_status" DEFAULT 'active' NOT NULL,
	"lastLoginAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"categoryId" integer,
	"productType" "productType" DEFAULT 'other' NOT NULL,
	"basePriceCents" bigint DEFAULT 0 NOT NULL,
	"costPriceCents" bigint DEFAULT 0,
	"currency" varchar(3) DEFAULT 'BRL',
	"supplier" varchar(255),
	"destination" varchar(255),
	"duration" varchar(128),
	"imageUrl" text,
	"sku" varchar(64),
	"isActive" boolean DEFAULT true NOT NULL,
	"detailsJson" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"icon" varchar(64),
	"color" varchar(32),
	"parentId" integer,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"proposalId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"qty" integer DEFAULT 1 NOT NULL,
	"unitPriceCents" bigint DEFAULT 0,
	"totalCents" bigint DEFAULT 0,
	"metaJson" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_signatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"proposalId" integer NOT NULL,
	"signerName" varchar(255) NOT NULL,
	"signerEmail" varchar(320),
	"signedAt" timestamp,
	"ip" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"htmlBody" text,
	"variablesJson" json,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"dealId" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "proposals_status" DEFAULT 'draft' NOT NULL,
	"totalCents" bigint DEFAULT 0,
	"currency" varchar(3) DEFAULT 'BRL',
	"pdfUrl" text,
	"sentAt" timestamp,
	"acceptedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer
);
--> statement-breakpoint
CREATE TABLE "quick_replies" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"teamId" integer,
	"shortcut" varchar(32) NOT NULL,
	"title" varchar(128) NOT NULL,
	"content" text NOT NULL,
	"contentType" "contentType" DEFAULT 'text' NOT NULL,
	"mediaUrl" varchar(1024),
	"category" varchar(64),
	"usageCount" integer DEFAULT 0 NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_field_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"rdFieldKey" varchar(255) NOT NULL,
	"rdFieldLabel" varchar(255) NOT NULL,
	"targetEntity" "targetEntity" DEFAULT 'deal' NOT NULL,
	"enturFieldType" "enturFieldType" DEFAULT 'custom' NOT NULL,
	"enturFieldKey" varchar(255),
	"enturCustomFieldId" integer,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_station_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer DEFAULT 1 NOT NULL,
	"name" varchar(255),
	"webhookToken" varchar(128) NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"autoCreateDeal" boolean DEFAULT true NOT NULL,
	"defaultPipelineId" integer,
	"defaultStageId" integer,
	"defaultSource" varchar(255),
	"defaultCampaign" varchar(255),
	"defaultOwnerUserId" integer,
	"assignmentTeamId" integer,
	"assignmentMode" "assignmentMode" DEFAULT 'random_all' NOT NULL,
	"lastRoundRobinUserId" integer,
	"autoWhatsAppEnabled" boolean DEFAULT false NOT NULL,
	"autoWhatsAppMessageTemplate" text,
	"dealNameTemplate" text,
	"autoProductId" integer,
	"totalLeadsReceived" integer DEFAULT 0 NOT NULL,
	"lastLeadReceivedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_station_config_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"configId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"taskType" varchar(32) DEFAULT 'task',
	"assignedToUserId" integer,
	"dueDaysOffset" integer DEFAULT 0 NOT NULL,
	"dueTime" varchar(5),
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"orderIndex" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_station_webhook_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer DEFAULT 1 NOT NULL,
	"rdLeadId" varchar(255),
	"conversionIdentifier" varchar(255),
	"email" varchar(320),
	"name" varchar(255),
	"phone" varchar(64),
	"utmSource" varchar(255),
	"utmMedium" varchar(255),
	"utmCampaign" varchar(255),
	"utmContent" varchar(255),
	"utmTerm" varchar(255),
	"status" "rd_station_webhook_log_status" DEFAULT 'success' NOT NULL,
	"dealId" integer,
	"contactId" integer,
	"configId" integer,
	"autoWhatsAppStatus" varchar(32),
	"autoWhatsAppError" text,
	"autoProductStatus" varchar(32),
	"autoProductError" text,
	"autoTasksCreated" integer DEFAULT 0,
	"autoTasksFailed" integer DEFAULT 0,
	"autoTasksError" text,
	"customDealName" boolean DEFAULT false,
	"error" text,
	"rawPayload" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfv_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(320),
	"phone" varchar(32),
	"vScore" bigint DEFAULT 0 NOT NULL,
	"fScore" integer DEFAULT 0 NOT NULL,
	"rScore" integer DEFAULT 9999 NOT NULL,
	"audienceType" varchar(32) DEFAULT 'desconhecido' NOT NULL,
	"rfvFlag" varchar(32) DEFAULT 'none' NOT NULL,
	"totalAtendimentos" integer DEFAULT 0 NOT NULL,
	"totalVendasGanhas" integer DEFAULT 0 NOT NULL,
	"totalVendasPerdidas" integer DEFAULT 0 NOT NULL,
	"taxaConversao" numeric(5, 2) DEFAULT '0' NOT NULL,
	"lastActionDate" timestamp,
	"lastPurchaseAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"contactId" integer,
	"createdBy" integer,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "rfv_filter_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"filterKey" varchar(64) NOT NULL,
	"previousCount" integer DEFAULT 0 NOT NULL,
	"currentCount" integer DEFAULT 0 NOT NULL,
	"lastCheckedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"roleId" integer NOT NULL,
	"permissionId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"isSystemRole" boolean DEFAULT false NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"sessionId" varchar(128) NOT NULL,
	"remoteJid" varchar(128) NOT NULL,
	"content" text NOT NULL,
	"contentType" "contentType" DEFAULT 'text' NOT NULL,
	"mediaUrl" varchar(1024),
	"scheduledAt" timestamp NOT NULL,
	"status" "scheduled_messages_status" DEFAULT 'pending' NOT NULL,
	"sentAt" timestamp,
	"createdBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"sourceSessionId" varchar(128) NOT NULL,
	"sourceUserId" integer NOT NULL,
	"targetUserId" integer NOT NULL,
	"share_status" "share_status" DEFAULT 'active' NOT NULL,
	"sharedBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"revokedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "stage_owner_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"pipelineId" integer NOT NULL,
	"stageId" integer NOT NULL,
	"assignToUserId" integer NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"subscriptionId" integer,
	"provider" varchar(32) DEFAULT 'hotmart' NOT NULL,
	"externalEvent" varchar(128) NOT NULL,
	"internalStatus" varchar(64) NOT NULL,
	"transactionId" varchar(255),
	"buyerEmail" varchar(320),
	"rawPayload" json,
	"processed" boolean DEFAULT false NOT NULL,
	"processedAt" timestamp,
	"errorMessage" text,
	"idempotencyKey" varchar(512),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"provider" varchar(32) DEFAULT 'hotmart' NOT NULL,
	"plan" "plan" DEFAULT 'start' NOT NULL,
	"status" "subscriptions_status" DEFAULT 'trialing' NOT NULL,
	"hotmartTransactionId" varchar(255),
	"hotmartSubscriptionId" varchar(255),
	"hotmartProductId" varchar(255),
	"hotmartOfferId" varchar(255),
	"hotmartBuyerEmail" varchar(320),
	"hotmartBuyerName" varchar(255),
	"priceInCents" integer DEFAULT 9700,
	"currency" varchar(8) DEFAULT 'BRL',
	"trialStartedAt" timestamp,
	"trialEndsAt" timestamp,
	"currentPeriodStart" timestamp,
	"currentPeriodEnd" timestamp,
	"cancelledAt" timestamp,
	"lastEventAt" timestamp,
	"lastSyncAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_assignees" (
	"id" serial PRIMARY KEY NOT NULL,
	"taskId" integer NOT NULL,
	"userId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"pipelineId" integer NOT NULL,
	"stageId" integer NOT NULL,
	"taskTitle" varchar(255) NOT NULL,
	"taskDescription" text,
	"taskType" "taskType" DEFAULT 'task' NOT NULL,
	"deadlineReference" "deadlineReference" DEFAULT 'current_date' NOT NULL,
	"deadlineOffsetDays" integer DEFAULT 0 NOT NULL,
	"deadlineOffsetUnit" "deadlineOffsetUnit" DEFAULT 'days' NOT NULL,
	"deadlineTime" varchar(5) DEFAULT '09:00' NOT NULL,
	"assignToOwner" boolean DEFAULT true NOT NULL,
	"assignToUserIds" json,
	"waMessageTemplate" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"orderIndex" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"entityType" varchar(32) NOT NULL,
	"entityId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"taskType" varchar(32) DEFAULT 'task',
	"dueAt" timestamp,
	"status" "crm_tasks_status" DEFAULT 'pending' NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"assignedToUserId" integer,
	"createdByUserId" integer,
	"description" text,
	"googleEventId" varchar(512),
	"googleCalendarSynced" boolean DEFAULT false,
	"waMessageBody" text,
	"waScheduledAt" timestamp,
	"waTimezone" varchar(64),
	"waStatus" varchar(32),
	"waSentAt" timestamp,
	"waFailedAt" timestamp,
	"waFailureReason" text,
	"waMessageId" varchar(256),
	"waConversationId" integer,
	"waChannelId" integer,
	"waContactId" integer,
	"waRetryCount" integer DEFAULT 0,
	"waProcessingLockId" varchar(64),
	"waProcessingLockedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"userId" integer NOT NULL,
	"teamId" integer NOT NULL,
	"role" "team_members_role" DEFAULT 'member' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#6366f1',
	"maxMembers" integer DEFAULT 50,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_addons" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"addon_type" "addon_type" NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"hotmart_transaction_id" varchar(200),
	"hotmart_offer_code" varchar(100),
	"activated_by_user_id" integer,
	"status" "tenant_addons_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_entitlement_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"feature_key" varchar(100) NOT NULL,
	"is_enabled" boolean NOT NULL,
	"limit_value" integer,
	"reason" varchar(500) NOT NULL,
	"expires_at" timestamp,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_zapi_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"zapiInstanceId" varchar(128) NOT NULL,
	"zapiToken" text NOT NULL,
	"zapiClientToken" text,
	"instanceName" varchar(255) NOT NULL,
	"zapi_instance_status" "zapi_instance_status" DEFAULT 'pending' NOT NULL,
	"subscribedAt" timestamp,
	"cancelledAt" timestamp,
	"expiresAt" timestamp,
	"webhookBaseUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(128),
	"plan" "plan" DEFAULT 'start' NOT NULL,
	"status" "tenants_status" DEFAULT 'active' NOT NULL,
	"billingStatus" "billingStatus" DEFAULT 'active' NOT NULL,
	"isLegacy" boolean DEFAULT false NOT NULL,
	"ownerUserId" integer,
	"billingCustomerId" varchar(128),
	"hotmartEmail" varchar(320),
	"freemiumDays" integer DEFAULT 365 NOT NULL,
	"freemiumExpiresAt" timestamp,
	"logoUrl" text,
	"settingsJson" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer DEFAULT 1 NOT NULL,
	"token" varchar(64) NOT NULL,
	"name" varchar(255) DEFAULT 'Meu Site' NOT NULL,
	"allowedDomains" json,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastSeenAt" timestamp,
	"totalLeads" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tracking_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "trip_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"tripId" integer NOT NULL,
	"type" "trip_items_type" DEFAULT 'other' NOT NULL,
	"title" varchar(255) NOT NULL,
	"supplier" varchar(255),
	"detailsJson" json,
	"priceCents" bigint DEFAULT 0,
	"currency" varchar(3) DEFAULT 'BRL',
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"dealId" integer,
	"status" "trips_status" DEFAULT 'planning' NOT NULL,
	"startDate" timestamp,
	"endDate" timestamp,
	"destinationSummary" text,
	"totalValueCents" bigint DEFAULT 0,
	"currency" varchar(3) DEFAULT 'BRL',
	"documentsStatus" "documentsStatus" DEFAULT 'pending' NOT NULL,
	"ownerUserId" integer,
	"teamId" integer,
	"visibilityScope" "visibilityScope" DEFAULT 'global' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer,
	"updatedBy" integer
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"prefKey" varchar(128) NOT NULL,
	"prefValue" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"userId" integer NOT NULL,
	"roleId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "users_role" DEFAULT 'user' NOT NULL,
	"isSuperAdmin" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "wa_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer DEFAULT 1 NOT NULL,
	"action" varchar(64) NOT NULL,
	"entityType" varchar(64),
	"entityId" varchar(128),
	"inputsJson" json,
	"outputsJson" json,
	"correlationId" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"instanceId" varchar(128) NOT NULL,
	"phoneNumber" varchar(32) NOT NULL,
	"channel_status" "channel_status" DEFAULT 'active' NOT NULL,
	"connectedAt" timestamp DEFAULT now() NOT NULL,
	"disconnectedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionId" varchar(100) NOT NULL,
	"jid" varchar(100) NOT NULL,
	"lid" varchar(100),
	"phoneNumber" varchar(100),
	"pushName" varchar(255),
	"savedName" varchar(255),
	"verifiedName" varchar(255),
	"profilePictureUrl" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_conversation_tag_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"waConversationId" integer NOT NULL,
	"tagId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer DEFAULT 1 NOT NULL,
	"sessionId" varchar(128) NOT NULL,
	"contactId" integer,
	"remoteJid" varchar(128) NOT NULL,
	"conversationKey" varchar(256) NOT NULL,
	"phoneE164" varchar(32),
	"phoneDigits" varchar(32),
	"phoneLast11" varchar(16),
	"lastMessageAt" timestamp,
	"lastMessagePreview" text,
	"lastMessageType" varchar(32),
	"lastFromMe" boolean DEFAULT false,
	"lastStatus" varchar(32),
	"unreadCount" integer DEFAULT 0,
	"status" "wa_conversations_status" DEFAULT 'open' NOT NULL,
	"contactPushName" varchar(128),
	"mergedIntoId" integer,
	"assignedUserId" integer,
	"assignedTeamId" integer,
	"queuedAt" timestamp,
	"firstResponseAt" timestamp,
	"slaDeadlineAt" timestamp,
	"waChannelId" integer,
	"isPinned" boolean DEFAULT false NOT NULL,
	"isArchived" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer DEFAULT 1 NOT NULL,
	"sessionId" varchar(128) NOT NULL,
	"contactId" integer,
	"remoteJid" varchar(128),
	"waId" varchar(128),
	"phoneE164" varchar(32),
	"confidenceScore" integer DEFAULT 60,
	"firstSeenAt" timestamp DEFAULT now() NOT NULL,
	"lastSeenAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionId" varchar(128) NOT NULL,
	"tenantId" integer DEFAULT 1 NOT NULL,
	"messageId" varchar(256),
	"remoteJid" varchar(128) NOT NULL,
	"fromMe" boolean DEFAULT false NOT NULL,
	"senderAgentId" integer,
	"pushName" varchar(128),
	"messageType" varchar(32) DEFAULT 'text' NOT NULL,
	"content" text,
	"mediaUrl" text,
	"media_mime_type" varchar(128),
	"media_file_name" varchar(512),
	"media_duration" integer,
	"is_voice_note" boolean DEFAULT false,
	"quoted_message_id" varchar(256),
	"structured_data" json,
	"status" varchar(32) DEFAULT 'sent',
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"waConversationId" integer,
	"audio_transcription" text,
	"audio_transcription_status" "audio_transcription_status",
	"audio_transcription_language" varchar(16),
	"audio_transcription_duration" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionId" varchar(128) NOT NULL,
	"targetMessageId" varchar(256) NOT NULL,
	"senderJid" varchar(128) NOT NULL,
	"emoji" varchar(32) NOT NULL,
	"fromMe" boolean DEFAULT false NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer DEFAULT 1 NOT NULL,
	"webhookSecret" varchar(128) NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"provider" varchar(64) NOT NULL,
	"endpoint" text NOT NULL,
	"secretHash" varchar(512),
	"status" "webhooks_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionId" varchar(128) NOT NULL,
	"userId" integer NOT NULL,
	"tenantId" integer DEFAULT 1 NOT NULL,
	"status" "whatsapp_sessions_status" DEFAULT 'disconnected' NOT NULL,
	"phoneNumber" varchar(32),
	"pushName" varchar(128),
	"platform" varchar(64),
	"provider" "whatsapp_sessions_provider" DEFAULT 'zapi' NOT NULL,
	"providerInstanceId" varchar(128),
	"providerToken" text,
	"providerClientToken" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_sessions_sessionId_unique" UNIQUE("sessionId")
);
--> statement-breakpoint
CREATE TABLE "zapi_admin_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"tenantName" varchar(255),
	"alert_type" "alert_type" NOT NULL,
	"alert_severity" "alert_severity" DEFAULT 'warning' NOT NULL,
	"message" text NOT NULL,
	"metadata" json,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolvedAt" timestamp,
	"resolvedBy" varchar(320),
	"alertKey" varchar(255) NOT NULL,
	"ownerNotified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "accounts_tenant_idx" ON "accounts" USING btree ("tenantId");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_addon_offer" ON "addon_offer_codes" USING btree ("addon_type","hotmart_offer_code");--> statement-breakpoint
CREATE INDEX "ai_analysis_tenant_idx" ON "ai_conversation_analyses" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "ai_analysis_deal_idx" ON "ai_conversation_analyses" USING btree ("tenantId","dealId");--> statement-breakpoint
CREATE INDEX "ai_tenant_idx" ON "ai_integrations" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "ai_tenant_provider_idx" ON "ai_integrations" USING btree ("tenantId","provider");--> statement-breakpoint
CREATE INDEX "aisl_tenant_idx" ON "ai_suggestion_logs" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "aisl_tenant_created_idx" ON "ai_suggestion_logs" USING btree ("tenantId","createdAt");--> statement-breakpoint
CREATE INDEX "aitc_tenant_idx" ON "ai_training_configs" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "aitc_tenant_type_idx" ON "ai_training_configs" USING btree ("tenantId","configType");--> statement-breakpoint
CREATE INDEX "alerts_tenant_idx" ON "alerts" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "ak_tenant_idx" ON "api_keys" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "bcm_campaign_idx" ON "bulk_campaign_messages" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "bcm_tenant_idx" ON "bulk_campaign_messages" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "bcm_campaign_status_idx" ON "bulk_campaign_messages" USING btree ("campaignId","status");--> statement-breakpoint
CREATE INDEX "bcm_wa_msg_idx" ON "bulk_campaign_messages" USING btree ("waMessageId");--> statement-breakpoint
CREATE INDEX "bc_tenant_idx" ON "bulk_campaigns" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "bc_tenant_status_idx" ON "bulk_campaigns" USING btree ("tenantId","status");--> statement-breakpoint
CREATE INDEX "bc_tenant_created_idx" ON "bulk_campaigns" USING btree ("tenantId","createdAt");--> statement-breakpoint
CREATE INDEX "camp_tenant_idx" ON "campaigns" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "camp_source_idx" ON "campaigns" USING btree ("sourceId");--> statement-breakpoint
CREATE INDEX "camp_tenant_active_idx" ON "campaigns" USING btree ("tenantId","isActive","isDeleted");--> statement-breakpoint
CREATE INDEX "cce_tenant_instance_idx" ON "channel_change_events" USING btree ("tenantId","instanceId");--> statement-breakpoint
CREATE INDEX "channels_tenant_idx" ON "channels" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_session_type" ON "chatbot_rules" USING btree ("sessionId","ruleType");--> statement-breakpoint
CREATE INDEX "cal_tenant_idx" ON "contact_action_logs" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "cal_rfv_contact_idx" ON "contact_action_logs" USING btree ("rfvContactId");--> statement-breakpoint
CREATE INDEX "cce_tenant_contact_idx" ON "contact_conversion_events" USING btree ("tenantId","contactId");--> statement-breakpoint
CREATE INDEX "cce_tenant_source_idx" ON "contact_conversion_events" USING btree ("tenantId","integrationSource");--> statement-breakpoint
CREATE INDEX "cce_idempotency_idx" ON "contact_conversion_events" USING btree ("idempotencyKey");--> statement-breakpoint
CREATE INDEX "cce_external_lead_idx" ON "contact_conversion_events" USING btree ("tenantId","externalLeadId");--> statement-breakpoint
CREATE INDEX "cce_received_at_idx" ON "contact_conversion_events" USING btree ("tenantId","receivedAt");--> statement-breakpoint
CREATE INDEX "cmerge_tenant_idx" ON "contact_merges" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "cmerge_primary_idx" ON "contact_merges" USING btree ("tenantId","primaryContactId");--> statement-breakpoint
CREATE INDEX "cmerge_secondary_idx" ON "contact_merges" USING btree ("tenantId","secondaryContactId");--> statement-breakpoint
CREATE INDEX "cmerge_status_idx" ON "contact_merges" USING btree ("tenantId","status");--> statement-breakpoint
CREATE INDEX "contacts_tenant_idx" ON "contacts" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "contacts_owner_idx" ON "contacts" USING btree ("tenantId","ownerUserId");--> statement-breakpoint
CREATE INDEX "contacts_classification_idx" ON "contacts" USING btree ("tenantId","stageClassification");--> statement-breakpoint
CREATE INDEX "idx_contacts_email" ON "contacts" USING btree ("tenantId","email");--> statement-breakpoint
CREATE INDEX "idx_contacts_phone" ON "contacts" USING btree ("tenantId","phoneE164");--> statement-breakpoint
CREATE INDEX "idx_contacts_phone_last11" ON "contacts" USING btree ("tenantId","phoneLast11");--> statement-breakpoint
CREATE INDEX "idx_contacts_merged" ON "contacts" USING btree ("mergedIntoContactId");--> statement-breakpoint
CREATE INDEX "ca_tenant_session_jid_idx" ON "conversation_assignments" USING btree ("tenantId","sessionId","remoteJid");--> statement-breakpoint
CREATE INDEX "ca_tenant_user_idx" ON "conversation_assignments" USING btree ("tenantId","assignedUserId");--> statement-breakpoint
CREATE INDEX "ca_tenant_team_idx" ON "conversation_assignments" USING btree ("tenantId","assignedTeamId");--> statement-breakpoint
CREATE INDEX "ca_tenant_status_idx" ON "conversation_assignments" USING btree ("tenantId","status");--> statement-breakpoint
CREATE INDEX "ce_tenant_conv_idx" ON "conversation_events" USING btree ("tenantId","waConversationId","createdAt");--> statement-breakpoint
CREATE INDEX "ce_tenant_session_idx" ON "conversation_events" USING btree ("tenantId","sessionId");--> statement-breakpoint
CREATE INDEX "ce_event_type_idx" ON "conversation_events" USING btree ("tenantId","eventType");--> statement-breakpoint
CREATE INDEX "cl_tenant_conv_idx" ON "conversation_locks" USING btree ("tenantId","waConversationId");--> statement-breakpoint
CREATE INDEX "cl_expires_idx" ON "conversation_locks" USING btree ("expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "ct_tenant_name_idx" ON "conversation_tags" USING btree ("tenantId","name");--> statement-breakpoint
CREATE INDEX "conv_tenant_channel_idx" ON "conversations" USING btree ("tenantId","channelId","lastMessageAt");--> statement-breakpoint
CREATE INDEX "conv_tenant_status_idx" ON "conversations" USING btree ("tenantId","status");--> statement-breakpoint
CREATE INDEX "courses_tenant_idx" ON "courses" USING btree ("tenantId");--> statement-breakpoint
CREATE UNIQUE INDEX "cap_appt_user_uniq" ON "crm_appointment_participants" USING btree ("appointmentId","userId");--> statement-breakpoint
CREATE INDEX "cap_user_idx" ON "crm_appointment_participants" USING btree ("tenantId","userId");--> statement-breakpoint
CREATE INDEX "ca_tenant_user_range_idx" ON "crm_appointments" USING btree ("tenantId","userId","startAt","endAt");--> statement-breakpoint
CREATE INDEX "ca_tenant_range_idx" ON "crm_appointments" USING btree ("tenantId","startAt","endAt");--> statement-breakpoint
CREATE INDEX "ca_tenant_deal_idx" ON "crm_appointments" USING btree ("tenantId","dealId");--> statement-breakpoint
CREATE INDEX "attach_tenant_idx" ON "crm_attachments" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "notes_tenant_idx" ON "crm_notes" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "crm_users_tenant_idx" ON "crm_users" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "crm_users_email_idx" ON "crm_users" USING btree ("tenantId","email");--> statement-breakpoint
CREATE INDEX "cfv_tenant_entity_idx" ON "custom_field_values" USING btree ("tenantId","entityType","entityId");--> statement-breakpoint
CREATE INDEX "cfv_field_idx" ON "custom_field_values" USING btree ("fieldId");--> statement-breakpoint
CREATE INDEX "cf_tenant_entity_idx" ON "custom_fields" USING btree ("tenantId","entity");--> statement-breakpoint
CREATE INDEX "cf_tenant_sort_idx" ON "custom_fields" USING btree ("tenantId","entity","sortOrder");--> statement-breakpoint
CREATE INDEX "cm_tenant_idx" ON "custom_messages" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "cm_tenant_category_idx" ON "custom_messages" USING btree ("tenantId","category");--> statement-breakpoint
CREATE INDEX "da_tenant_idx" ON "date_automations" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "da_tenant_pipeline_idx" ON "date_automations" USING btree ("tenantId","pipelineId");--> statement-breakpoint
CREATE INDEX "df_tenant_idx" ON "deal_files" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "df_deal_idx" ON "deal_files" USING btree ("tenantId","dealId");--> statement-breakpoint
CREATE INDEX "dh_tenant_deal_idx" ON "deal_history" USING btree ("tenantId","dealId");--> statement-breakpoint
CREATE INDEX "dh_tenant_deal_cat_idx" ON "deal_history" USING btree ("tenantId","dealId","eventCategory");--> statement-breakpoint
CREATE INDEX "dh_tenant_contact_idx" ON "deal_history" USING btree ("tenantId","contactId");--> statement-breakpoint
CREATE INDEX "dh_dedupe_idx" ON "deal_history" USING btree ("dedupeKey");--> statement-breakpoint
CREATE INDEX "dh_occurred_idx" ON "deal_history" USING btree ("tenantId","dealId","occurredAt");--> statement-breakpoint
CREATE INDEX "dp_tenant_idx" ON "deal_participants" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "dp_prod_tenant_deal_idx" ON "deal_products" USING btree ("tenantId","dealId");--> statement-breakpoint
CREATE INDEX "dp_prod_product_idx" ON "deal_products" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "dp_prod_catalog_idx" ON "deal_products" USING btree ("catalogProductId");--> statement-breakpoint
CREATE INDEX "deals_tenant_pipeline_idx" ON "deals" USING btree ("tenantId","pipelineId","stageId");--> statement-breakpoint
CREATE INDEX "deals_tenant_status_idx" ON "deals" USING btree ("tenantId","status","lastActivityAt");--> statement-breakpoint
CREATE INDEX "deals_tenant_owner_idx" ON "deals" USING btree ("tenantId","ownerUserId");--> statement-breakpoint
CREATE INDEX "idx_deals_wa_conv" ON "deals" USING btree ("waConversationId");--> statement-breakpoint
CREATE INDEX "deals_tenant_contact_status_idx" ON "deals" USING btree ("tenantId","contactId","status");--> statement-breakpoint
CREATE INDEX "deals_tenant_contact_pipeline_idx" ON "deals" USING btree ("tenantId","contactId","pipelineId","status");--> statement-breakpoint
CREATE INDEX "dr_tenant_idx" ON "distribution_rules" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "dr_tenant_active_idx" ON "distribution_rules" USING btree ("tenantId","isActive");--> statement-breakpoint
CREATE INDEX "enroll_tenant_idx" ON "enrollments" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "el_tenant_idx" ON "event_log" USING btree ("tenantId","occurredAt");--> statement-breakpoint
CREATE INDEX "el_entity_idx" ON "event_log" USING btree ("tenantId","entityType","entityId");--> statement-breakpoint
CREATE INDEX "goals_tenant_idx" ON "goals" USING btree ("tenantId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gcal_tenant_user_event" ON "google_calendar_events" USING btree ("tenantId","userId","googleEventId");--> statement-breakpoint
CREATE INDEX "idx_gcal_tenant_user_range" ON "google_calendar_events" USING btree ("tenantId","userId","startAt","endAt");--> statement-breakpoint
CREATE INDEX "idx_gcal_tenant_range" ON "google_calendar_events" USING btree ("tenantId","startAt","endAt");--> statement-breakpoint
CREATE INDEX "gct_user_tenant_idx" ON "google_calendar_tokens" USING btree ("userId","tenantId");--> statement-breakpoint
CREATE INDEX "gct_tenant_idx" ON "google_calendar_tokens" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "im_tenant_conv_idx" ON "inbox_messages" USING btree ("tenantId","conversationId","sentAt");--> statement-breakpoint
CREATE INDEX "ic_tenant_idx" ON "integration_connections" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "icred_tenant_idx" ON "integration_credentials" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "integ_tenant_idx" ON "integrations" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "in_tenant_conv_idx" ON "internal_notes" USING btree ("tenantId","waConversationId","createdAt");--> statement-breakpoint
CREATE INDEX "in_author_idx" ON "internal_notes" USING btree ("tenantId","authorUserId");--> statement-breakpoint
CREATE INDEX "in_global_note_idx" ON "internal_notes" USING btree ("tenantId","isCustomerGlobalNote");--> statement-breakpoint
CREATE INDEX "dlq_tenant_idx" ON "job_dlq" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "jobs_tenant_idx" ON "jobs" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_lel_tenant_source" ON "lead_event_log" USING btree ("tenantId","source","createdAt");--> statement-breakpoint
CREATE INDEX "idx_lel_tenant_status" ON "lead_event_log" USING btree ("tenantId","status","createdAt");--> statement-breakpoint
CREATE INDEX "ls_tenant_idx" ON "lead_sources" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "ls_tenant_active_idx" ON "lead_sources" USING btree ("tenantId","isActive","isDeleted");--> statement-breakpoint
CREATE INDEX "lessons_tenant_idx" ON "lessons" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "lr_tenant_idx" ON "loss_reasons" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "lr_tenant_active_idx" ON "loss_reasons" USING btree ("tenantId","isActive","isDeleted");--> statement-breakpoint
CREATE INDEX "md_tenant_idx" ON "metrics_daily" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "notif_tenant_idx" ON "notifications" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "notif_tenant_read_idx" ON "notifications" USING btree ("tenantId","isRead");--> statement-breakpoint
CREATE INDEX "prt_token_idx" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "prt_user_idx" ON "password_reset_tokens" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "perf_tenant_idx" ON "performance_snapshots" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pa_tenant_idx" ON "pipeline_automations" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pa_source_idx" ON "pipeline_automations" USING btree ("tenantId","sourcePipelineId");--> statement-breakpoint
CREATE INDEX "ps_tenant_pipeline_idx" ON "pipeline_stages" USING btree ("tenantId","pipelineId");--> statement-breakpoint
CREATE INDEX "pipelines_tenant_idx" ON "pipelines" USING btree ("tenantId");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_plan_slug" ON "plan_definitions" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_plan_feature" ON "plan_features" USING btree ("plan_id","feature_key");--> statement-breakpoint
CREATE INDEX "idx_pf_plan" ON "plan_features" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "ps_tenant_idx" ON "portal_sessions" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "ptk_tenant_idx" ON "portal_tickets" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pu_tenant_idx" ON "portal_users" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pcat_tenant_idx" ON "product_catalog" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pcat_tenant_type_idx" ON "product_catalog" USING btree ("tenantId","productType");--> statement-breakpoint
CREATE INDEX "pcat_tenant_cat_idx" ON "product_catalog" USING btree ("tenantId","categoryId");--> statement-breakpoint
CREATE INDEX "pcat_tenant_active_idx" ON "product_catalog" USING btree ("tenantId","isActive");--> statement-breakpoint
CREATE INDEX "pc_tenant_idx" ON "product_categories" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pi_tenant_idx" ON "proposal_items" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "psig_tenant_idx" ON "proposal_signatures" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pt_tenant_idx" ON "proposal_templates" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "proposals_tenant_idx" ON "proposals" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "qr_tenant_idx" ON "quick_replies" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "qr_tenant_team_idx" ON "quick_replies" USING btree ("tenantId","teamId");--> statement-breakpoint
CREATE INDEX "qr_shortcut_idx" ON "quick_replies" USING btree ("tenantId","shortcut");--> statement-breakpoint
CREATE INDEX "rdfm_tenant_idx" ON "rd_field_mappings" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "rdfm_rd_key_idx" ON "rd_field_mappings" USING btree ("tenantId","rdFieldKey");--> statement-breakpoint
CREATE INDEX "rdcfg_tenant_idx" ON "rd_station_config" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "rdctask_config_idx" ON "rd_station_config_tasks" USING btree ("configId");--> statement-breakpoint
CREATE INDEX "rdctask_tenant_idx" ON "rd_station_config_tasks" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "rdlog_tenant_idx" ON "rd_station_webhook_log" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "rdlog_status_idx" ON "rd_station_webhook_log" USING btree ("tenantId","status");--> statement-breakpoint
CREATE INDEX "rdlog_created_idx" ON "rd_station_webhook_log" USING btree ("tenantId","createdAt");--> statement-breakpoint
CREATE INDEX "rdlog_config_idx" ON "rd_station_webhook_log" USING btree ("configId");--> statement-breakpoint
CREATE INDEX "rfv_tenant_idx" ON "rfv_contacts" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "rfv_tenant_audience_idx" ON "rfv_contacts" USING btree ("tenantId","audienceType");--> statement-breakpoint
CREATE INDEX "rfv_tenant_email_idx" ON "rfv_contacts" USING btree ("tenantId","email");--> statement-breakpoint
CREATE INDEX "rfv_tenant_phone_idx" ON "rfv_contacts" USING btree ("tenantId","phone");--> statement-breakpoint
CREATE INDEX "rfv_tenant_flag_idx" ON "rfv_contacts" USING btree ("tenantId","rfvFlag");--> statement-breakpoint
CREATE INDEX "rfv_snap_tenant_idx" ON "rfv_filter_snapshots" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "rfv_snap_tenant_filter_idx" ON "rfv_filter_snapshots" USING btree ("tenantId","filterKey");--> statement-breakpoint
CREATE INDEX "rp_tenant_idx" ON "role_permissions" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "roles_tenant_idx" ON "crm_roles" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "sm_tenant_status_idx" ON "scheduled_messages" USING btree ("tenantId","status");--> statement-breakpoint
CREATE INDEX "sm_scheduled_idx" ON "scheduled_messages" USING btree ("scheduledAt");--> statement-breakpoint
CREATE INDEX "ss_tenant_idx" ON "session_shares" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "ss_target_user_idx" ON "session_shares" USING btree ("tenantId","targetUserId");--> statement-breakpoint
CREATE INDEX "ss_source_session_idx" ON "session_shares" USING btree ("tenantId","sourceSessionId");--> statement-breakpoint
CREATE INDEX "sor_tenant_pipeline_idx" ON "stage_owner_rules" USING btree ("tenantId","pipelineId");--> statement-breakpoint
CREATE INDEX "sor_tenant_stage_idx" ON "stage_owner_rules" USING btree ("tenantId","stageId");--> statement-breakpoint
CREATE INDEX "se_tenant_idx" ON "subscription_events" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "se_subscription_idx" ON "subscription_events" USING btree ("subscriptionId");--> statement-breakpoint
CREATE INDEX "se_idempotency_idx" ON "subscription_events" USING btree ("idempotencyKey");--> statement-breakpoint
CREATE INDEX "se_created_idx" ON "subscription_events" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "se_buyer_email_idx" ON "subscription_events" USING btree ("buyerEmail");--> statement-breakpoint
CREATE INDEX "sub_tenant_idx" ON "subscriptions" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "sub_hotmart_idx" ON "subscriptions" USING btree ("hotmartSubscriptionId");--> statement-breakpoint
CREATE INDEX "sub_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sub_buyer_email_idx" ON "subscriptions" USING btree ("hotmartBuyerEmail");--> statement-breakpoint
CREATE INDEX "ta_task_idx" ON "task_assignees" USING btree ("taskId");--> statement-breakpoint
CREATE INDEX "ta_user_idx" ON "task_assignees" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "task_auto_tenant_pipeline_idx" ON "task_automations" USING btree ("tenantId","pipelineId");--> statement-breakpoint
CREATE INDEX "task_auto_tenant_stage_idx" ON "task_automations" USING btree ("tenantId","stageId");--> statement-breakpoint
CREATE INDEX "tasks_tenant_idx" ON "crm_tasks" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "tasks_wa_scheduled_idx" ON "crm_tasks" USING btree ("taskType","waStatus","waScheduledAt");--> statement-breakpoint
CREATE INDEX "tm_tenant_idx" ON "team_members" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "tm_team_idx" ON "team_members" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "tm_user_idx" ON "team_members" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "teams_tenant_idx" ON "teams" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_ta_tenant" ON "tenant_addons" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ta_tenant_type" ON "tenant_addons" USING btree ("tenant_id","addon_type");--> statement-breakpoint
CREATE INDEX "idx_ta_transaction" ON "tenant_addons" USING btree ("hotmart_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_override" ON "tenant_entitlement_overrides" USING btree ("tenant_id","feature_key");--> statement-breakpoint
CREATE INDEX "idx_ov_tenant" ON "tenant_entitlement_overrides" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tzi_tenant_idx" ON "tenant_zapi_instances" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "tzi_zapi_instance_idx" ON "tenant_zapi_instances" USING btree ("zapiInstanceId");--> statement-breakpoint
CREATE INDEX "ti_tenant_idx" ON "trip_items" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "trips_tenant_idx" ON "trips" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "up_user_tenant_idx" ON "user_preferences" USING btree ("userId","tenantId");--> statement-breakpoint
CREATE INDEX "up_user_key_idx" ON "user_preferences" USING btree ("userId","tenantId","prefKey");--> statement-breakpoint
CREATE INDEX "ur_tenant_idx" ON "user_roles" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_wal_tenant_action" ON "wa_audit_log" USING btree ("tenantId","action","createdAt");--> statement-breakpoint
CREATE INDEX "idx_wal_correlation" ON "wa_audit_log" USING btree ("correlationId");--> statement-breakpoint
CREATE INDEX "wach_tenant_instance_idx" ON "wa_channels" USING btree ("tenantId","instanceId");--> statement-breakpoint
CREATE INDEX "wach_tenant_phone_idx" ON "wa_channels" USING btree ("tenantId","phoneNumber");--> statement-breakpoint
CREATE INDEX "wac_session_jid_idx" ON "wa_contacts" USING btree ("sessionId","jid");--> statement-breakpoint
CREATE INDEX "wac_session_lid_idx" ON "wa_contacts" USING btree ("sessionId","lid");--> statement-breakpoint
CREATE INDEX "wac_session_phone_idx" ON "wa_contacts" USING btree ("sessionId","phoneNumber");--> statement-breakpoint
CREATE UNIQUE INDEX "wctl_conv_tag_idx" ON "wa_conversation_tag_links" USING btree ("waConversationId","tagId");--> statement-breakpoint
CREATE INDEX "wctl_tag_idx" ON "wa_conversation_tag_links" USING btree ("tagId");--> statement-breakpoint
CREATE INDEX "idx_wc_tenant_session" ON "wa_conversations" USING btree ("tenantId","sessionId","lastMessageAt");--> statement-breakpoint
CREATE INDEX "idx_wc_tenant_contact" ON "wa_conversations" USING btree ("tenantId","contactId");--> statement-breakpoint
CREATE INDEX "idx_wc_tenant_jid" ON "wa_conversations" USING btree ("tenantId","sessionId","remoteJid");--> statement-breakpoint
CREATE INDEX "idx_wc_phone" ON "wa_conversations" USING btree ("tenantId","phoneE164");--> statement-breakpoint
CREATE INDEX "idx_wc_merged" ON "wa_conversations" USING btree ("mergedIntoId");--> statement-breakpoint
CREATE INDEX "idx_wc_assigned_user" ON "wa_conversations" USING btree ("tenantId","assignedUserId");--> statement-breakpoint
CREATE INDEX "idx_wc_queued" ON "wa_conversations" USING btree ("tenantId","queuedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wc_conv_key" ON "wa_conversations" USING btree ("conversationKey");--> statement-breakpoint
CREATE INDEX "idx_wi_tenant_session" ON "wa_identities" USING btree ("tenantId","sessionId");--> statement-breakpoint
CREATE INDEX "idx_wi_contact" ON "wa_identities" USING btree ("tenantId","contactId");--> statement-breakpoint
CREATE INDEX "idx_wi_phone" ON "wa_identities" USING btree ("tenantId","phoneE164");--> statement-breakpoint
CREATE INDEX "msg_tenant_idx" ON "messages" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "msg_session_jid_idx" ON "messages" USING btree ("sessionId","remoteJid","timestamp");--> statement-breakpoint
CREATE INDEX "idx_msg_wa_conv" ON "messages" USING btree ("waConversationId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_unique_msgid_session" ON "messages" USING btree ("messageId","sessionId");--> statement-breakpoint
CREATE INDEX "idx_react_target" ON "wa_reactions" USING btree ("sessionId","targetMessageId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_react_unique" ON "wa_reactions" USING btree ("sessionId","targetMessageId","senderJid");--> statement-breakpoint
CREATE INDEX "wh_tenant_idx" ON "webhooks" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "ws_tenant_idx" ON "whatsapp_sessions" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "zaa_tenant_idx" ON "zapi_admin_alerts" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "zaa_type_idx" ON "zapi_admin_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "zaa_resolved_idx" ON "zapi_admin_alerts" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "zaa_alert_key_idx" ON "zapi_admin_alerts" USING btree ("alertKey");