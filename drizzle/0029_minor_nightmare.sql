CREATE TABLE `bulk_campaign_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`tenantId` int NOT NULL,
	`contactId` int,
	`contactName` varchar(255) NOT NULL,
	`contactPhone` varchar(32),
	`messageContent` text,
	`status` enum('pending','sending','sent','delivered','read','failed','skipped') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`sentAt` timestamp,
	`deliveredAt` timestamp,
	`readAt` timestamp,
	`waMessageId` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bulk_campaign_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bulk_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255),
	`name` varchar(255) NOT NULL,
	`messageTemplate` text NOT NULL,
	`source` varchar(64) NOT NULL DEFAULT 'rfv',
	`audienceFilter` varchar(128),
	`sessionId` varchar(128) NOT NULL,
	`intervalMs` int NOT NULL DEFAULT 3000,
	`totalContacts` int NOT NULL DEFAULT 0,
	`sentCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`skippedCount` int NOT NULL DEFAULT 0,
	`deliveredCount` int NOT NULL DEFAULT 0,
	`readCount` int NOT NULL DEFAULT 0,
	`status` enum('running','completed','cancelled','failed') NOT NULL DEFAULT 'running',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bulk_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `bcm_campaign_idx` ON `bulk_campaign_messages` (`campaignId`);--> statement-breakpoint
CREATE INDEX `bcm_tenant_idx` ON `bulk_campaign_messages` (`tenantId`);--> statement-breakpoint
CREATE INDEX `bcm_campaign_status_idx` ON `bulk_campaign_messages` (`campaignId`,`status`);--> statement-breakpoint
CREATE INDEX `bcm_wa_msg_idx` ON `bulk_campaign_messages` (`waMessageId`);--> statement-breakpoint
CREATE INDEX `bc_tenant_idx` ON `bulk_campaigns` (`tenantId`);--> statement-breakpoint
CREATE INDEX `bc_tenant_status_idx` ON `bulk_campaigns` (`tenantId`,`status`);--> statement-breakpoint
CREATE INDEX `bc_tenant_created_idx` ON `bulk_campaigns` (`tenantId`,`createdAt`);