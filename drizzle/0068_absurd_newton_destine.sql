CREATE TABLE `stage_owner_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`pipelineId` int NOT NULL,
	`stageId` int NOT NULL,
	`assignToUserId` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stage_owner_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contacts` MODIFY COLUMN `lifecycleStage` enum('lead','prospect','customer','churned','merged') NOT NULL DEFAULT 'lead';--> statement-breakpoint
ALTER TABLE `contact_conversion_events` ADD `dealDecision` varchar(64);--> statement-breakpoint
ALTER TABLE `contact_conversion_events` ADD `dealDecisionReason` varchar(512);--> statement-breakpoint
ALTER TABLE `contacts` ADD `mergedIntoContactId` int;--> statement-breakpoint
ALTER TABLE `deals` ADD `lastConversionAt` timestamp;--> statement-breakpoint
ALTER TABLE `deals` ADD `lastConversionSource` varchar(64);--> statement-breakpoint
ALTER TABLE `deals` ADD `lastWebhookName` varchar(255);--> statement-breakpoint
ALTER TABLE `deals` ADD `lastUtmSource` varchar(255);--> statement-breakpoint
ALTER TABLE `deals` ADD `lastUtmMedium` varchar(255);--> statement-breakpoint
ALTER TABLE `deals` ADD `lastUtmCampaign` varchar(255);--> statement-breakpoint
ALTER TABLE `deals` ADD `conversionCount` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `waMessageBody` text;--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `waScheduledAt` timestamp;--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `waTimezone` varchar(64);--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `waStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `waSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `waFailedAt` timestamp;--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `waFailureReason` text;--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `waMessageId` varchar(256);--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `waConversationId` int;--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `waChannelId` int;--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `waContactId` int;--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `waRetryCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `waProcessingLockId` varchar(64);--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `waProcessingLockedAt` timestamp;--> statement-breakpoint
CREATE INDEX `sor_tenant_pipeline_idx` ON `stage_owner_rules` (`tenantId`,`pipelineId`);--> statement-breakpoint
CREATE INDEX `sor_tenant_stage_idx` ON `stage_owner_rules` (`tenantId`,`stageId`);--> statement-breakpoint
CREATE INDEX `idx_contacts_email` ON `contacts` (`tenantId`,`email`);--> statement-breakpoint
CREATE INDEX `idx_contacts_phone` ON `contacts` (`tenantId`,`phoneE164`);--> statement-breakpoint
CREATE INDEX `idx_contacts_phone_last11` ON `contacts` (`tenantId`,`phoneLast11`);--> statement-breakpoint
CREATE INDEX `idx_contacts_merged` ON `contacts` (`mergedIntoContactId`);--> statement-breakpoint
CREATE INDEX `deals_tenant_contact_status_idx` ON `deals` (`tenantId`,`contactId`,`status`);--> statement-breakpoint
CREATE INDEX `deals_tenant_contact_pipeline_idx` ON `deals` (`tenantId`,`contactId`,`pipelineId`,`status`);--> statement-breakpoint
CREATE INDEX `tasks_wa_scheduled_idx` ON `crm_tasks` (`taskType`,`waStatus`,`waScheduledAt`);