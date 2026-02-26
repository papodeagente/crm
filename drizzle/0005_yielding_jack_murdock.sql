CREATE TABLE `chatbot_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(128) NOT NULL,
	`remoteJid` varchar(128) NOT NULL,
	`contactName` varchar(255),
	`ruleType` enum('whitelist','blacklist') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatbot_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(500) NOT NULL,
	`body` text,
	`entityType` varchar(64),
	`entityId` varchar(128),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `mode` varchar(32) DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `respondGroups` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `respondPrivate` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `onlyWhenMentioned` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `triggerWords` text;--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `welcomeMessage` text;--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `awayMessage` text;--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `businessHoursEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `businessHoursStart` varchar(5) DEFAULT '09:00';--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `businessHoursEnd` varchar(5) DEFAULT '18:00';--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `businessHoursDays` varchar(32) DEFAULT '1,2,3,4,5';--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `businessHoursTimezone` varchar(64) DEFAULT 'America/Sao_Paulo';--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `replyDelay` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `contextMessageCount` int DEFAULT 10;--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `rateLimitPerHour` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `rateLimitPerDay` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `chatbot_settings` ADD `temperature` decimal(3,2) DEFAULT '0.70';--> statement-breakpoint
ALTER TABLE `messages` ADD `pushName` varchar(128);--> statement-breakpoint
CREATE INDEX `idx_session_type` ON `chatbot_rules` (`sessionId`,`ruleType`);--> statement-breakpoint
CREATE INDEX `notif_tenant_idx` ON `notifications` (`tenantId`);--> statement-breakpoint
CREATE INDEX `notif_tenant_read_idx` ON `notifications` (`tenantId`,`isRead`);