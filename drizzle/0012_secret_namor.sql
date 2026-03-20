CREATE TABLE `lead_event_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL DEFAULT 1,
	`type` varchar(64) NOT NULL DEFAULT 'inbound_lead',
	`source` varchar(64) NOT NULL,
	`dedupeKey` varchar(255) NOT NULL,
	`payload` json,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`error` text,
	`dealId` int,
	`contactId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lead_event_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meta_integration_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL DEFAULT 1,
	`pageId` varchar(128),
	`pageName` varchar(255),
	`accessToken` text,
	`appSecret` varchar(255),
	`verifyToken` varchar(128),
	`formsJson` json,
	`status` varchar(32) NOT NULL DEFAULT 'disconnected',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_integration_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tracking_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL DEFAULT 1,
	`token` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL DEFAULT 'Meu Site',
	`allowedDomains` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastSeenAt` timestamp,
	`totalLeads` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tracking_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `tracking_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `wa_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL DEFAULT 1,
	`action` varchar(64) NOT NULL,
	`entityType` varchar(64),
	`entityId` varchar(128),
	`inputsJson` json,
	`outputsJson` json,
	`correlationId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wa_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wa_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL DEFAULT 1,
	`sessionId` varchar(128) NOT NULL,
	`contactId` int,
	`remoteJid` varchar(128) NOT NULL,
	`conversationKey` varchar(256) NOT NULL,
	`phoneE164` varchar(32),
	`phoneDigits` varchar(32),
	`phoneLast11` varchar(16),
	`lastMessageAt` timestamp,
	`lastMessagePreview` text,
	`lastMessageType` varchar(32),
	`lastFromMe` boolean DEFAULT false,
	`lastStatus` varchar(32),
	`unreadCount` int DEFAULT 0,
	`status` enum('open','pending','resolved','closed') NOT NULL DEFAULT 'open',
	`contactPushName` varchar(128),
	`mergedIntoId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wa_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wa_identities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL DEFAULT 1,
	`sessionId` varchar(128) NOT NULL,
	`contactId` int,
	`remoteJid` varchar(128),
	`waId` varchar(128),
	`phoneE164` varchar(32),
	`confidenceScore` int DEFAULT 60,
	`firstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wa_identities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL DEFAULT 1,
	`webhookSecret` varchar(128) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhook_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `phoneE164` varchar(32);--> statement-breakpoint
ALTER TABLE `contacts` ADD `phoneDigits` varchar(32);--> statement-breakpoint
ALTER TABLE `contacts` ADD `phoneLast11` varchar(16);--> statement-breakpoint
ALTER TABLE `contacts` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `deals` ADD `leadSource` varchar(64);--> statement-breakpoint
ALTER TABLE `deals` ADD `utmJson` json;--> statement-breakpoint
ALTER TABLE `deals` ADD `metaJson` json;--> statement-breakpoint
ALTER TABLE `deals` ADD `rawPayloadJson` json;--> statement-breakpoint
ALTER TABLE `deals` ADD `dedupeKey` varchar(255);--> statement-breakpoint
ALTER TABLE `deals` ADD `waConversationId` int;--> statement-breakpoint
ALTER TABLE `deals` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `messages` ADD `waConversationId` int;--> statement-breakpoint
CREATE INDEX `idx_lel_tenant_source` ON `lead_event_log` (`tenantId`,`source`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_lel_tenant_status` ON `lead_event_log` (`tenantId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_wal_tenant_action` ON `wa_audit_log` (`tenantId`,`action`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_wal_correlation` ON `wa_audit_log` (`correlationId`);--> statement-breakpoint
CREATE INDEX `idx_wc_tenant_session` ON `wa_conversations` (`tenantId`,`sessionId`,`lastMessageAt`);--> statement-breakpoint
CREATE INDEX `idx_wc_tenant_contact` ON `wa_conversations` (`tenantId`,`contactId`);--> statement-breakpoint
CREATE INDEX `idx_wc_tenant_jid` ON `wa_conversations` (`tenantId`,`sessionId`,`remoteJid`);--> statement-breakpoint
CREATE INDEX `idx_wc_phone` ON `wa_conversations` (`tenantId`,`phoneE164`);--> statement-breakpoint
CREATE INDEX `idx_wc_merged` ON `wa_conversations` (`mergedIntoId`);--> statement-breakpoint
CREATE INDEX `idx_wi_tenant_session` ON `wa_identities` (`tenantId`,`sessionId`);--> statement-breakpoint
CREATE INDEX `idx_wi_contact` ON `wa_identities` (`tenantId`,`contactId`);--> statement-breakpoint
CREATE INDEX `idx_wi_phone` ON `wa_identities` (`tenantId`,`phoneE164`);--> statement-breakpoint
CREATE INDEX `idx_deals_wa_conv` ON `deals` (`waConversationId`);--> statement-breakpoint
CREATE INDEX `idx_msg_wa_conv` ON `messages` (`waConversationId`);