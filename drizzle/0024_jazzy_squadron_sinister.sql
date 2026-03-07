CREATE TABLE `date_automations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`pipelineId` int NOT NULL,
	`dateField` enum('boardingDate','returnDate','expectedCloseAt','createdAt') NOT NULL,
	`condition` enum('days_before','days_after','on_date') NOT NULL,
	`offsetDays` int NOT NULL DEFAULT 0,
	`sourceStageId` int,
	`targetStageId` int NOT NULL,
	`dealStatusFilter` enum('open','won','lost') DEFAULT 'open',
	`isActive` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `date_automations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `da_tenant_idx` ON `date_automations` (`tenantId`);--> statement-breakpoint
CREATE INDEX `da_tenant_pipeline_idx` ON `date_automations` (`tenantId`,`pipelineId`);