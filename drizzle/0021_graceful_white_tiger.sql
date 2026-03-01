CREATE TABLE `task_assignees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`tenantId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_assignees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `taskType` varchar(32) DEFAULT 'task';--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `description` text;--> statement-breakpoint
CREATE INDEX `ta_task_idx` ON `task_assignees` (`taskId`);--> statement-breakpoint
CREATE INDEX `ta_user_idx` ON `task_assignees` (`userId`);