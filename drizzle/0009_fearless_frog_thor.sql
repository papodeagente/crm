CREATE TABLE `pipeline_automations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`sourcePipelineId` int NOT NULL,
	`triggerEvent` enum('deal_won','deal_lost','stage_reached') NOT NULL DEFAULT 'deal_won',
	`triggerStageId` int,
	`targetPipelineId` int NOT NULL,
	`targetStageId` int NOT NULL,
	`copyProducts` boolean NOT NULL DEFAULT true,
	`copyParticipants` boolean NOT NULL DEFAULT true,
	`copyCustomFields` boolean NOT NULL DEFAULT true,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pipeline_automations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `pipeline_stages` ADD `color` varchar(32);--> statement-breakpoint
ALTER TABLE `pipelines` ADD `description` text;--> statement-breakpoint
ALTER TABLE `pipelines` ADD `color` varchar(32);--> statement-breakpoint
ALTER TABLE `pipelines` ADD `pipelineType` enum('sales','post_sale','support','custom') DEFAULT 'sales' NOT NULL;--> statement-breakpoint
ALTER TABLE `pipelines` ADD `isArchived` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `pa_tenant_idx` ON `pipeline_automations` (`tenantId`);--> statement-breakpoint
CREATE INDEX `pa_source_idx` ON `pipeline_automations` (`tenantId`,`sourcePipelineId`);