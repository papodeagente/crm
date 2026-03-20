CREATE TABLE `rd_station_config_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`configId` int NOT NULL,
	`tenantId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`taskType` varchar(32) DEFAULT 'task',
	`assignedToUserId` int,
	`dueDaysOffset` int NOT NULL DEFAULT 0,
	`dueTime` varchar(5),
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`orderIndex` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rd_station_config_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `rd_station_config` ADD `dealNameTemplate` text;--> statement-breakpoint
ALTER TABLE `rd_station_config` ADD `autoProductId` int;--> statement-breakpoint
CREATE INDEX `rdctask_config_idx` ON `rd_station_config_tasks` (`configId`);--> statement-breakpoint
CREATE INDEX `rdctask_tenant_idx` ON `rd_station_config_tasks` (`tenantId`);