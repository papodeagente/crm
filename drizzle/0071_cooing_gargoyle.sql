CREATE TABLE `ai_training_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`configType` enum('suggestion','summary','analysis') NOT NULL,
	`instructions` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_training_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `aitc_tenant_idx` ON `ai_training_configs` (`tenantId`);--> statement-breakpoint
CREATE INDEX `aitc_tenant_type_idx` ON `ai_training_configs` (`tenantId`,`configType`);