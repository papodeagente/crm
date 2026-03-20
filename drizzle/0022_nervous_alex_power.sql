CREATE TABLE `task_automations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`pipelineId` int NOT NULL,
	`stageId` int NOT NULL,
	`taskTitle` varchar(255) NOT NULL,
	`taskDescription` text,
	`taskType` enum('whatsapp','phone','email','video','task') NOT NULL DEFAULT 'task',
	`deadlineReference` enum('current_date','boarding_date','return_date') NOT NULL DEFAULT 'current_date',
	`deadlineOffsetDays` int NOT NULL DEFAULT 0,
	`deadlineTime` varchar(5) NOT NULL DEFAULT '09:00',
	`assignToOwner` boolean NOT NULL DEFAULT true,
	`assignToUserIds` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`orderIndex` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_automations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tenantId` int NOT NULL,
	`prefKey` varchar(128) NOT NULL,
	`prefValue` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `stageClassification` varchar(32) DEFAULT 'desconhecido' NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `referralWindowStart` timestamp;--> statement-breakpoint
ALTER TABLE `contacts` ADD `referralCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `lastPurchaseAt` timestamp;--> statement-breakpoint
ALTER TABLE `contacts` ADD `totalPurchases` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `totalSpentCents` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `deals` ADD `boardingDate` timestamp;--> statement-breakpoint
ALTER TABLE `deals` ADD `returnDate` timestamp;--> statement-breakpoint
CREATE INDEX `task_auto_tenant_pipeline_idx` ON `task_automations` (`tenantId`,`pipelineId`);--> statement-breakpoint
CREATE INDEX `task_auto_tenant_stage_idx` ON `task_automations` (`tenantId`,`stageId`);--> statement-breakpoint
CREATE INDEX `up_user_tenant_idx` ON `user_preferences` (`userId`,`tenantId`);--> statement-breakpoint
CREATE INDEX `up_user_key_idx` ON `user_preferences` (`userId`,`tenantId`,`prefKey`);--> statement-breakpoint
CREATE INDEX `contacts_classification_idx` ON `contacts` (`tenantId`,`stageClassification`);