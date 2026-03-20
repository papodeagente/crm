CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`primaryContactId` int,
	`ownerUserId` int,
	`teamId` int,
	`visibilityScope` enum('personal','team','global') NOT NULL DEFAULT 'global',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	`updatedBy` int,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`status` enum('active','resolved','dismissed') NOT NULL DEFAULT 'active',
	`entityType` varchar(32),
	`entityId` int,
	`firedAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	`payloadJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`hashedKey` varchar(512) NOT NULL,
	`scopesJson` json,
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`type` enum('whatsapp','instagram','email','webchat') NOT NULL DEFAULT 'whatsapp',
	`connectionId` varchar(128),
	`name` varchar(128),
	`status` enum('active','inactive','error') NOT NULL DEFAULT 'inactive',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `channels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`type` enum('person','company') NOT NULL DEFAULT 'person',
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(32),
	`docId` varchar(64),
	`tagsJson` json,
	`source` varchar(64),
	`lifecycleStage` enum('lead','prospect','customer','churned') NOT NULL DEFAULT 'lead',
	`ownerUserId` int,
	`teamId` int,
	`visibilityScope` enum('personal','team','global') NOT NULL DEFAULT 'global',
	`consentStatus` enum('pending','granted','revoked') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	`updatedBy` int,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`channelId` int NOT NULL,
	`providerThreadId` varchar(256),
	`contactId` int,
	`dealId` int,
	`tripId` int,
	`status` enum('open','pending','closed') NOT NULL DEFAULT 'open',
	`assignedToUserId` int,
	`assignedTeamId` int,
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`lastMessageAt` timestamp,
	`slaDueAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`coverUrl` text,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`entityType` varchar(32) NOT NULL,
	`entityId` int NOT NULL,
	`fileUrl` text NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(128),
	`sizeBytes` int,
	`uploadedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crm_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`entityType` varchar(32) NOT NULL,
	`entityId` int NOT NULL,
	`body` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crm_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(32),
	`passwordHash` varchar(512),
	`status` enum('active','inactive','invited') NOT NULL DEFAULT 'invited',
	`avatarUrl` text,
	`lastLoginAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	`updatedBy` int,
	CONSTRAINT `crm_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deal_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`dealId` int NOT NULL,
	`contactId` int NOT NULL,
	`role` enum('decision_maker','traveler','payer','companion','other') NOT NULL DEFAULT 'traveler',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deal_participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`contactId` int,
	`accountId` int,
	`pipelineId` int NOT NULL,
	`stageId` int NOT NULL,
	`valueCents` bigint DEFAULT 0,
	`currency` varchar(3) DEFAULT 'BRL',
	`probability` int DEFAULT 0,
	`status` enum('open','won','lost') NOT NULL DEFAULT 'open',
	`expectedCloseAt` timestamp,
	`ownerUserId` int,
	`teamId` int,
	`visibilityScope` enum('personal','team','global') NOT NULL DEFAULT 'global',
	`channelOrigin` varchar(64),
	`lastActivityAt` timestamp DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	`updatedBy` int,
	CONSTRAINT `deals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`courseId` int NOT NULL,
	`status` enum('enrolled','in_progress','completed') NOT NULL DEFAULT 'enrolled',
	`progressJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`actorUserId` int,
	`actorType` enum('user','system','api','webhook') NOT NULL DEFAULT 'user',
	`entityType` varchar(64) NOT NULL,
	`entityId` int,
	`action` varchar(64) NOT NULL,
	`beforeJson` json,
	`afterJson` json,
	`metadataJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `event_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`teamId` int,
	`userId` int,
	`metricKey` varchar(64) NOT NULL,
	`targetValue` bigint DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inbox_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`conversationId` int NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL DEFAULT 'inbound',
	`providerMessageId` varchar(256),
	`senderLabel` varchar(128),
	`bodyText` text,
	`bodyJson` json,
	`sentAt` timestamp,
	`deliveredAt` timestamp,
	`readAt` timestamp,
	`status` enum('pending','sent','delivered','read','failed') NOT NULL DEFAULT 'pending',
	`errorJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inbox_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`integrationId` int NOT NULL,
	`connectionId` varchar(128),
	`status` enum('connected','disconnected','error') NOT NULL DEFAULT 'disconnected',
	`lastHealthAt` timestamp,
	`metaJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`provider` varchar(64) NOT NULL,
	`encryptedSecret` text NOT NULL,
	`rotatedAt` timestamp,
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_credentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`provider` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`status` enum('active','inactive','error') NOT NULL DEFAULT 'inactive',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_dlq` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`jobId` int NOT NULL,
	`failedAt` timestamp NOT NULL DEFAULT (now()),
	`errorJson` json,
	`payloadJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_dlq_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`nextRunAt` timestamp,
	`payloadJson` json,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`courseId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`contentUrl` text,
	`contentBody` text,
	`orderIndex` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lessons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metrics_daily` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`date` timestamp NOT NULL,
	`metricKey` varchar(64) NOT NULL,
	`valueNum` bigint DEFAULT 0,
	`dimensionsJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `metrics_daily_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `performance_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`entityType` varchar(32) NOT NULL,
	`entityId` int NOT NULL,
	`metricsJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `performance_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`description` text,
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `pipeline_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`pipelineId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`orderIndex` int NOT NULL,
	`probabilityDefault` int DEFAULT 0,
	`isWon` boolean NOT NULL DEFAULT false,
	`isLost` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pipeline_stages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pipelines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pipelines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portal_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`portalUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `portal_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portal_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`contactId` int NOT NULL,
	`tripId` int,
	`conversationId` int,
	`status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
	`subject` varchar(255) NOT NULL,
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portal_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portal_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`contactId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`authMethod` varchar(32) DEFAULT 'magic_link',
	`passwordHash` varchar(512),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`lastLoginAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portal_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proposal_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`proposalId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`qty` int NOT NULL DEFAULT 1,
	`unitPriceCents` bigint DEFAULT 0,
	`totalCents` bigint DEFAULT 0,
	`metaJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proposal_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proposal_signatures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`proposalId` int NOT NULL,
	`signerName` varchar(255) NOT NULL,
	`signerEmail` varchar(320),
	`signedAt` timestamp,
	`ip` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proposal_signatures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proposal_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`htmlBody` text,
	`variablesJson` json,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proposal_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`dealId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` enum('draft','sent','viewed','accepted','rejected','expired') NOT NULL DEFAULT 'draft',
	`totalCents` bigint DEFAULT 0,
	`currency` varchar(3) DEFAULT 'BRL',
	`pdfUrl` text,
	`sentAt` timestamp,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	CONSTRAINT `proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`roleId` int NOT NULL,
	`permissionId` int NOT NULL,
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`isSystemRole` boolean NOT NULL DEFAULT false,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crm_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`entityType` varchar(32) NOT NULL,
	`entityId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`dueAt` timestamp,
	`status` enum('pending','in_progress','done','cancelled') NOT NULL DEFAULT 'pending',
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`assignedToUserId` int,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crm_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`teamId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`plan` enum('starter','business','enterprise') NOT NULL DEFAULT 'starter',
	`status` enum('active','suspended','cancelled') NOT NULL DEFAULT 'active',
	`billingCustomerId` varchar(128),
	`settingsJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trip_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`tripId` int NOT NULL,
	`type` enum('flight','hotel','tour','transfer','insurance','other') NOT NULL DEFAULT 'other',
	`title` varchar(255) NOT NULL,
	`supplier` varchar(255),
	`detailsJson` json,
	`priceCents` bigint DEFAULT 0,
	`currency` varchar(3) DEFAULT 'BRL',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trip_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`dealId` int,
	`status` enum('planning','confirmed','in_progress','completed','cancelled') NOT NULL DEFAULT 'planning',
	`startDate` timestamp,
	`endDate` timestamp,
	`destinationSummary` text,
	`totalValueCents` bigint DEFAULT 0,
	`currency` varchar(3) DEFAULT 'BRL',
	`documentsStatus` enum('pending','partial','complete') NOT NULL DEFAULT 'pending',
	`ownerUserId` int,
	`teamId` int,
	`visibilityScope` enum('personal','team','global') NOT NULL DEFAULT 'global',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	`updatedBy` int,
	CONSTRAINT `trips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`roleId` int NOT NULL,
	CONSTRAINT `user_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`provider` varchar(64) NOT NULL,
	`endpoint` text NOT NULL,
	`secretHash` varchar(512),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `accounts_tenant_idx` ON `accounts` (`tenantId`);--> statement-breakpoint
CREATE INDEX `alerts_tenant_idx` ON `alerts` (`tenantId`);--> statement-breakpoint
CREATE INDEX `ak_tenant_idx` ON `api_keys` (`tenantId`);--> statement-breakpoint
CREATE INDEX `channels_tenant_idx` ON `channels` (`tenantId`);--> statement-breakpoint
CREATE INDEX `contacts_tenant_idx` ON `contacts` (`tenantId`);--> statement-breakpoint
CREATE INDEX `contacts_owner_idx` ON `contacts` (`tenantId`,`ownerUserId`);--> statement-breakpoint
CREATE INDEX `conv_tenant_channel_idx` ON `conversations` (`tenantId`,`channelId`,`lastMessageAt`);--> statement-breakpoint
CREATE INDEX `conv_tenant_status_idx` ON `conversations` (`tenantId`,`status`);--> statement-breakpoint
CREATE INDEX `courses_tenant_idx` ON `courses` (`tenantId`);--> statement-breakpoint
CREATE INDEX `attach_tenant_idx` ON `crm_attachments` (`tenantId`);--> statement-breakpoint
CREATE INDEX `notes_tenant_idx` ON `crm_notes` (`tenantId`);--> statement-breakpoint
CREATE INDEX `crm_users_tenant_idx` ON `crm_users` (`tenantId`);--> statement-breakpoint
CREATE INDEX `crm_users_email_idx` ON `crm_users` (`tenantId`,`email`);--> statement-breakpoint
CREATE INDEX `dp_tenant_idx` ON `deal_participants` (`tenantId`);--> statement-breakpoint
CREATE INDEX `deals_tenant_pipeline_idx` ON `deals` (`tenantId`,`pipelineId`,`stageId`);--> statement-breakpoint
CREATE INDEX `deals_tenant_status_idx` ON `deals` (`tenantId`,`status`,`lastActivityAt`);--> statement-breakpoint
CREATE INDEX `deals_tenant_owner_idx` ON `deals` (`tenantId`,`ownerUserId`);--> statement-breakpoint
CREATE INDEX `enroll_tenant_idx` ON `enrollments` (`tenantId`);--> statement-breakpoint
CREATE INDEX `el_tenant_idx` ON `event_log` (`tenantId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `el_entity_idx` ON `event_log` (`tenantId`,`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `goals_tenant_idx` ON `goals` (`tenantId`);--> statement-breakpoint
CREATE INDEX `im_tenant_conv_idx` ON `inbox_messages` (`tenantId`,`conversationId`,`sentAt`);--> statement-breakpoint
CREATE INDEX `ic_tenant_idx` ON `integration_connections` (`tenantId`);--> statement-breakpoint
CREATE INDEX `icred_tenant_idx` ON `integration_credentials` (`tenantId`);--> statement-breakpoint
CREATE INDEX `integ_tenant_idx` ON `integrations` (`tenantId`);--> statement-breakpoint
CREATE INDEX `dlq_tenant_idx` ON `job_dlq` (`tenantId`);--> statement-breakpoint
CREATE INDEX `jobs_tenant_idx` ON `jobs` (`tenantId`);--> statement-breakpoint
CREATE INDEX `lessons_tenant_idx` ON `lessons` (`tenantId`);--> statement-breakpoint
CREATE INDEX `md_tenant_idx` ON `metrics_daily` (`tenantId`);--> statement-breakpoint
CREATE INDEX `perf_tenant_idx` ON `performance_snapshots` (`tenantId`);--> statement-breakpoint
CREATE INDEX `ps_tenant_pipeline_idx` ON `pipeline_stages` (`tenantId`,`pipelineId`);--> statement-breakpoint
CREATE INDEX `pipelines_tenant_idx` ON `pipelines` (`tenantId`);--> statement-breakpoint
CREATE INDEX `ps_tenant_idx` ON `portal_sessions` (`tenantId`);--> statement-breakpoint
CREATE INDEX `pt_tenant_idx` ON `portal_tickets` (`tenantId`);--> statement-breakpoint
CREATE INDEX `pu_tenant_idx` ON `portal_users` (`tenantId`);--> statement-breakpoint
CREATE INDEX `pi_tenant_idx` ON `proposal_items` (`tenantId`);--> statement-breakpoint
CREATE INDEX `psig_tenant_idx` ON `proposal_signatures` (`tenantId`);--> statement-breakpoint
CREATE INDEX `pt_tenant_idx` ON `proposal_templates` (`tenantId`);--> statement-breakpoint
CREATE INDEX `proposals_tenant_idx` ON `proposals` (`tenantId`);--> statement-breakpoint
CREATE INDEX `rp_tenant_idx` ON `role_permissions` (`tenantId`);--> statement-breakpoint
CREATE INDEX `roles_tenant_idx` ON `crm_roles` (`tenantId`);--> statement-breakpoint
CREATE INDEX `tasks_tenant_idx` ON `crm_tasks` (`tenantId`);--> statement-breakpoint
CREATE INDEX `tm_tenant_idx` ON `team_members` (`tenantId`);--> statement-breakpoint
CREATE INDEX `teams_tenant_idx` ON `teams` (`tenantId`);--> statement-breakpoint
CREATE INDEX `ti_tenant_idx` ON `trip_items` (`tenantId`);--> statement-breakpoint
CREATE INDEX `trips_tenant_idx` ON `trips` (`tenantId`);--> statement-breakpoint
CREATE INDEX `ur_tenant_idx` ON `user_roles` (`tenantId`);--> statement-breakpoint
CREATE INDEX `wh_tenant_idx` ON `webhooks` (`tenantId`);